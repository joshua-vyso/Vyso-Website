/**
 * "Push it to Hubdoc" — the read half of the chat hand-off (Plugins X2 — chat
 * hand-off).
 *
 * WHAT THIS FILE MAY DO, IN ONE SENTENCE: work out which documents the owner
 * meant, decide whether each could go, and describe them. It sends nothing. The
 * only send in the product is still `forwardDocumentToHubdoc`, still reachable
 * only from `POST /api/integrations/hubdoc/send`, and the card this tool feeds
 * posts to that same route when a PERSON presses its button.
 *
 * WHY THAT LINE IS DRAWN HERE AND NOT IN THE MODEL. Josh asked Finch to push an
 * uploaded statement to Hubdoc and Finch said it couldn't — which was true and
 * useless. The fix is not "let the model send": an outbound email carrying a
 * customer's supplier invoice is irreversible and lands in a bookkeeper's inbox,
 * so the drafts-only rule the outreach module holds applies here too. The fix is
 * to let the model do everything up to the press: resolve, check, and show. What
 * the owner gains is that the press is now one press, in the conversation they
 * were already having.
 *
 * EVERY READ GOES THROUGH THE CALLER'S RLS-SCOPED CLIENT, like every other Finch
 * tool. `hubdoc_forwards` and `org_integrations_hubdoc` are admin-select under
 * RLS (supabase/hubdoc.sql), which is the database's own copy of the
 * `canSeeMoney` gate this module checks first.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeLike } from '@/lib/platform/supplysync-feed';
import { isMissingRelation } from '@/lib/platform/db-errors';
import { documentNumber, type DocWatchExtracted } from '@/lib/platform/doc-watch/detect';
import { xeroStatusTone } from '@/lib/platform/plugins';
import { loadHubdocSettings, hubdocSentDocumentIds } from '@/lib/platform/hubdoc';
import {
  hubdocEligibleIds,
  hubdocPrepareDocuments,
  maskHubdocIntakeEmail,
  HUBDOC_CHAT_REFUSALS,
  HUBDOC_DOCUMENT_TYPES,
  type HubdocCandidate,
  type HubdocPreparedDocument,
} from '@/lib/platform/hubdoc-shared';

/** How many documents one hand-off may name. Well under the send route's own
 *  cap of 25 — a card longer than this is a bulk import, not a conversation. */
const MAX_PREPARED = 10;

export type HubdocPrepareResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      /** Never the address itself — see `maskHubdocIntakeEmail`. */
      intake_email_masked: string;
      documents: HubdocPreparedDocument[];
      /** Identifies THIS prepared batch. The card carries it so a second
       *  hand-off in the same conversation is a second card rather than an
       *  overwrite; the send route neither needs nor trusts it (it re-checks
       *  every id against the session's own org). */
      confirm_token: string;
      /** How many of the rows below the card's button will actually post. */
      eligible_count: number;
    };

interface DocumentRow {
  id: string;
  filename: string;
  document_type: string | null;
  status: string;
  supplier_id: string | null;
  storage_path: string | null;
  extracted_data: DocWatchExtracted | null;
  supplier: { name: string | null } | { name: string | null }[] | null;
}

const DOC_COLS =
  'id, filename, document_type, status, supplier_id, storage_path, extracted_data, supplier:suppliers(name)';

/** The embedded to-one relation comes back typed as an array from the select
 *  string alone — the same widening `docu-data.ts` and `hubdoc.ts` do. */
function supplierName(row: DocumentRow): string | null {
  const supplier = Array.isArray(row.supplier) ? (row.supplier[0] ?? null) : row.supplier;
  return supplier?.name?.trim() || null;
}

/**
 * Is Xero connected at all?
 *
 * READ THROUGH THE CALLER'S CLIENT rather than through `xeroConnectionStatus`,
 * which builds a cookie-scoped server client of its own — the agent route also
 * serves bearer-token callers, for whom that read would come back empty and this
 * tool would refuse a perfectly connected org. The verdict is the same one
 * `hubdocStateForDocument` reaches: `xeroStatusTone`, with a DEGRADED connection
 * still counting as connected (a token that needs re-auth does not stop an email
 * to Hubdoc, and hiding the hand-off would punish the owner for the outage).
 */
async function xeroConnected(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('xero_connections')
    .select('status')
    .eq('org_id', orgId)
    .maybeSingle<{ status: string | null }>();
  if (error && !isMissingRelation(error)) return false;
  return xeroStatusTone(data?.status ?? null) !== 'idle';
}

/**
 * Which documents did the owner mean?
 *
 * TWO WAYS IN, AND IDS WIN. The attachment ids the route prepends to the turn
 * are what "push THIS one" resolves to, and the knowledge doc tells the model to
 * pass them — so when ids are given, nothing is searched: those rows, in this
 * org, and no others.
 *
 * THE `query` PATH MATCHES THE WAY `docu_find_documents` DOES — the supplier
 * name resolved against `suppliers` with the same `escapeLike` partial match —
 * plus the filename, because "send the Umgeni statement" and "send
 * umgeni-oct.pdf" are the same request phrased two ways. It is narrowed to the
 * types Hubdoc takes: a search that offered a delivery note would be putting a
 * reason on the card in place of a document the owner might actually have meant.
 */
async function resolveCandidates(
  supabase: SupabaseClient,
  orgId: string,
  input: { documentIds: string[]; query: string },
): Promise<DocumentRow[]> {
  if (input.documentIds.length > 0) {
    const { data, error } = await supabase
      .from('documents')
      .select(DOC_COLS)
      .eq('org_id', orgId)
      .in('id', input.documentIds.slice(0, MAX_PREPARED));
    if (error) throw new Error(`Could not read documents: ${error.message}`);
    const rows = (data ?? []) as unknown as DocumentRow[];
    // Answer in the order the owner (or the turn's attachment line) named them.
    const byId = new Map(rows.map((r) => [r.id, r]));
    return input.documentIds.map((id) => byId.get(id)).filter((r): r is DocumentRow => !!r);
  }

  const query = input.query.trim();
  if (!query) return [];

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id')
    .eq('org_id', orgId)
    .ilike('name', `%${escapeLike(query)}%`)
    .returns<{ id: string }[]>();
  const supplierIds = (suppliers ?? []).map((s) => s.id);

  const filenameMatch = `filename.ilike.%${escapeLike(query)}%`;
  const { data, error } = await supabase
    .from('documents')
    .select(DOC_COLS)
    .eq('org_id', orgId)
    .in('document_type', [...HUBDOC_DOCUMENT_TYPES])
    .or(supplierIds.length ? `${filenameMatch},supplier_id.in.(${supplierIds.join(',')})` : filenameMatch)
    .order('created_at', { ascending: false })
    .limit(MAX_PREPARED);
  if (error) throw new Error(`Could not read documents: ${error.message}`);
  return (data ?? []) as unknown as DocumentRow[];
}

/**
 * Prepare a Hubdoc hand-off for the confirm card. NEVER SENDS.
 *
 * THE GATES, CHEAPEST FIRST, EACH WITH ITS OWN SENTENCE. `hubdocStateForDocument`
 * asks the same three questions for the document page's button, but answers them
 * with `null` — the right answer when the job is "draw a control or don't", and
 * the wrong one here, where the owner asked a question out loud and deserves to
 * be told which of the three is missing and where to fix it.
 */
export async function prepareHubdocSend(
  supabase: SupabaseClient,
  orgId: string,
  canSeeMoney: boolean,
  input: { documentIds?: string[]; query?: string; resend?: boolean },
): Promise<HubdocPrepareResult> {
  if (!canSeeMoney) return { ok: false, reason: HUBDOC_CHAT_REFUSALS.notAdmin };
  if (!orgId) return { ok: false, reason: HUBDOC_CHAT_REFUSALS.notConnected };

  if (!(await xeroConnected(supabase, orgId))) {
    return { ok: false, reason: HUBDOC_CHAT_REFUSALS.notConnected };
  }

  const settings = await loadHubdocSettings(supabase, orgId);
  if (settings.tableMissing) return { ok: false, reason: HUBDOC_CHAT_REFUSALS.tablesMissing };
  if (!settings.intakeEmail) return { ok: false, reason: HUBDOC_CHAT_REFUSALS.noIntakeEmail };

  const documentIds = (input.documentIds ?? [])
    .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
    .map((id) => id.trim());
  const rows = await resolveCandidates(supabase, orgId, {
    documentIds: [...new Set(documentIds)],
    query: input.query ?? '',
  });
  if (rows.length === 0) return { ok: false, reason: HUBDOC_CHAT_REFUSALS.noDocuments };

  const sent = await hubdocSentDocumentIds(supabase, orgId, rows.map((r) => r.id));

  const candidates: HubdocCandidate[] = rows.slice(0, MAX_PREPARED).map((row) => ({
    id: row.id,
    filename: row.filename,
    supplier: supplierName(row),
    number: documentNumber(row.extracted_data?.fields ?? []),
    facts: {
      documentType: row.document_type,
      status: row.status,
      supplierId: row.supplier_id,
      storagePath: row.storage_path,
    },
    alreadySent: sent.has(row.id),
  }));

  const documents = hubdocPrepareDocuments(candidates, { resend: input.resend === true });
  return {
    ok: true,
    intake_email_masked: maskHubdocIntakeEmail(settings.intakeEmail),
    documents,
    confirm_token: crypto.randomUUID(),
    eligible_count: hubdocEligibleIds(documents).length,
  };
}
