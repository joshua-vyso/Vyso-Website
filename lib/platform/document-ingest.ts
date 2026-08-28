import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractDocument } from '@/lib/ai/anthropic';
import { extractOrderDocument } from '@/lib/ai/order-reader';
import { imagePixelSize } from '@/lib/platform/docu/image-size';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import {
  ensureSupplySyncProfile,
  escapeLike,
  feedDocumentToSupplySync,
  lookupSupplierAlias,
  normalizeSupplierName,
  orgHasSupplySync,
} from '@/lib/platform/supplysync-feed';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import {
  buildDirectionRecord,
  matchCounterparty,
  resolveDocumentDirection,
  type CounterpartyCandidate,
  type DocumentDirectionRecord,
  type OrgIdentity,
} from '@/lib/platform/docu/document-direction';
import type { DocumentType, ExtractedData } from '@/lib/platform/types';

/**
 * The one document-ingest pipeline: classify → file into Doc-U → build the
 * OrderFlow order (orders) or feed ProcurePulse (invoices/statements/etc).
 *
 * Shared by every entry point so there is a single audited write path:
 *   - Finch chat          (app/api/ai/agent/ingest-document)  — RLS-scoped client, real user
 *   - Inbound email       (app/api/email/process)             — service-role client, no user
 *
 * The caller owns auth and supplies BOTH the Supabase client and the orgId; this
 * module never derives an org itself. That keeps the rule "orgId comes from a
 * verified source, never from document content" true for every caller.
 *
 * Document content is DATA, never instructions.
 */

/** Initials for a supplier name ("Bacca Valley (Pty) Ltd" → "BV"). */
export function supplierInitials(name: string): string {
  const words = name.replace(/\(.*?\)/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || name.slice(0, 2).toUpperCase();
}

/**
 * Resolve (or create) a suppliers row for the org by name. Re-selects the winner
 * if it loses a create race against the (org_id, lower(name)) unique index.
 */
export async function resolveSupplierId(supabase: SupabaseClient, orgId: string, name: string): Promise<string> {
  const trimmed = name.trim();
  const findExisting = async () => {
    // escapeLike: `trimmed` can be an extracted supplier name — match it as a
    // literal so a name containing % or _ can't match every supplier.
    const { data } = await supabase
      .from('suppliers')
      .select('id')
      .eq('org_id', orgId)
      .ilike('name', escapeLike(trimmed))
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };
  const existing = await findExisting();
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from('suppliers')
    .insert({ org_id: orgId, name: trimmed, initials: supplierInitials(trimmed) })
    .select('id')
    .single();
  if (created) return (created as { id: string }).id;
  if (isUniqueViolation(error)) {
    const winner = await findExisting();
    if (winner) return winner;
  }
  throw error ?? new Error('Could not create supplier');
}

/**
 * Resolve an extracted supplier name to a linked supplier id — the full chain:
 *
 *   self-name guard → alias ruling → resolveSupplierId → SupplySync profile
 *
 * Returns null (file the document UNLINKED, for review) rather than guessing when:
 *   - the name is the org itself (an outgoing/own document — the extractor reads
 *     the ISSUING party, so the org's own invoices surface as its own name; a
 *     "supplier" must never be created from it), or
 *   - the org has dismissed this name in supplier_aliases.
 *
 * The SupplySync profile creation is best-effort: linking the document is the
 * money path, the profile is intelligence — a missing ss migration must not
 * stop documents being filed against suppliers.
 */
export async function resolveSupplierProfile(
  supabase: SupabaseClient,
  orgId: string,
  rawName: string,
): Promise<string | null> {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const { data: org } = await supabase
    .from('organisations')
    .select('name, locked_modules')
    .eq('id', orgId)
    .maybeSingle<{ name: string; locked_modules: string[] | null }>();
  // Only EXACT normalized equality means "the org's own name". Substring
  // containment was far too broad — it dropped legitimate suppliers whose name
  // overlaps the org's (org "Fresh Valley Produce" vs supplier "Valley Produce"),
  // filing their invoices permanently unlinked. normalizeSupplierName already
  // strips legal suffixes, so "Fresh Valley Produce (Pty) Ltd" still matches the
  // bare org name.
  const orgNorm = org?.name ? normalizeSupplierName(org.name) : '';
  const nameNorm = normalizeSupplierName(trimmed);
  if (orgNorm && nameNorm && orgNorm === nameNorm) {
    return null; // the org's own name — outgoing/own document, not a supplier
  }

  let supplierId: string | null = null;
  try {
    const alias = await lookupSupplierAlias(supabase, orgId, trimmed);
    if (alias?.status === 'dismissed') return null;
    if (alias?.status === 'confirmed' && alias.supplierId) supplierId = alias.supplierId;
  } catch {
    /* alias table not migrated yet — fall through to name resolution */
  }

  if (!supplierId) supplierId = await resolveSupplierId(supabase, orgId, trimmed);

  // Create the SupplySync profile unless the org has SupplySync LOCKED. Gate on
  // locked_modules (the app's real module override) — not org_features, which is
  // force-overridden to all-on in getPlatformSession and so is empty for most orgs.
  const supplySyncLocked = (org?.locked_modules ?? []).includes('suppliers');
  if (!supplySyncLocked) {
    try {
      await ensureSupplySyncProfile(supabase, orgId, supplierId, trimmed);
    } catch (err) {
      console.error('[supplysync] could not ensure the supplier profile:', err);
    }
  }
  return supplierId;
}

/**
 * Who the org is, for the outgoing-document check.
 *
 * `organisations.name` is always there; the trading name and VAT number live in
 * Core Data's company profile (`cd_company_profile`), which most orgs complete
 * during onboarding. NOT `of_settings` — that table carries invoice numbering
 * and the default VAT RATE, not the business's identity.
 *
 * Best-effort by design: a missing profile simply means the org is recognised
 * by its registered name alone, and a failed read means the direction check
 * returns 'unknown' and nothing changes. Identity is used to REFUSE work
 * (don't file this as a purchase), so degrading it can only ever restore the
 * previous behaviour.
 */
export async function loadOrgIdentity(supabase: SupabaseClient, orgId: string): Promise<OrgIdentity> {
  const [orgRes, profileRes] = await Promise.all([
    supabase.from('organisations').select('name').eq('id', orgId).maybeSingle<{ name: string | null }>(),
    supabase
      .from('cd_company_profile')
      .select('company_name, vat_number')
      .eq('org_id', orgId)
      .maybeSingle<{ company_name: string | null; vat_number: string | null }>(),
  ]);
  return {
    legalName: orgRes.data?.name ?? null,
    tradingName: profileRes.data?.company_name ?? null,
    vatNumber: profileRes.data?.vat_number ?? null,
  };
}

/** What the caller should write onto the document after the direction check. */
export interface DocumentPartiesVerdict {
  direction: 'incoming' | 'outgoing' | 'unknown';
  /**
   * The supplier name to keep in `extracted_data.supplier`. NULL on an outgoing
   * document — the issuer there is the org itself, and leaving its own name in
   * the supplier slot is what made it show up as a vendor in the first place.
   */
  supplierName: string | null;
  /** `documents.customer_id`, set only when exactly one customer clearly matched. */
  customerId: string | null;
  /** Stored at `extracted_data.direction`. Null unless the document is outgoing. */
  record: DocumentDirectionRecord | null;
}

/**
 * Decide which way an extracted document points, and — when the org issued it —
 * find the customer.
 *
 * THE FAILURE THIS CLOSES. A photographed Turn 'n Slice invoice ("Invoice To:
 * Investec Bank Limited") was filed as a supplier invoice with "Turn n Slice HQ
 * (Pty) Ltd" created as the supplier. `resolveSupplierProfile` refuses the org's
 * own name, but only on EXACT normalised equality, and the letterhead carried one
 * extra token. The decision itself is pure and tested — see
 * `lib/platform/docu/document-direction.ts`; this function is only the two reads
 * around it.
 *
 * The customer list is loaded ONLY for an outgoing document, so the ordinary
 * supplier-invoice path pays for one identity read and nothing else.
 *
 * NEVER CREATES A CUSTOMER. `syncOrderFromDocument` is allowed to create one
 * from an uploaded order because the person who uploaded it is standing there
 * naming their own customer. Here the name comes off a photographed page with
 * nobody watching, so an unmatched counterparty stays blank and the review
 * screen says so.
 */
export async function classifyDocumentParties(
  supabase: SupabaseClient,
  orgId: string,
  extracted: { supplier: string | null; supplierVat?: string | null; billTo: string | null },
): Promise<DocumentPartiesVerdict> {
  const identity = await loadOrgIdentity(supabase, orgId);
  const input = {
    issuer: extracted.supplier,
    issuerVatNumber: extracted.supplierVat ?? null,
    billTo: extracted.billTo,
    identity,
  };
  const verdict = resolveDocumentDirection(input);
  if (verdict.direction !== 'outgoing') {
    return { direction: verdict.direction, supplierName: extracted.supplier, customerId: null, record: null };
  }

  const { data: customerRows } = await supabase
    .from('of_customers')
    .select('id, name')
    .eq('org_id', orgId)
    .returns<CounterpartyCandidate[]>();
  const match = matchCounterparty(extracted.billTo, customerRows ?? []);

  return {
    direction: 'outgoing',
    supplierName: null,
    customerId: match.customerId,
    record: buildDirectionRecord(verdict, input, match),
  };
}

/**
 * The org's "Orders" Doc-U folder id (created on first use). Uses limit(1) rather
 * than maybeSingle() so a pre-existing duplicate folder can't turn the lookup into
 * a multi-row error, and re-reads the winner if it loses a create race.
 * `userId` is null for email ingest (no logged-in user).
 */
export async function ordersFolderId(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
): Promise<string | null> {
  const findExisting = async () => {
    const { data } = await supabase
      .from('document_folders')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', 'Orders')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  };
  const existing = await findExisting();
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from('document_folders')
    .insert({ org_id: orgId, name: 'Orders', ...(userId ? { created_by: userId } : {}) })
    .select('id')
    .maybeSingle();
  if (created) return (created as { id: string }).id;
  if (isUniqueViolation(error)) return await findExisting();
  return null;
}

export interface IngestDocumentInput {
  supabase: SupabaseClient;
  /** Verified org — from the session (chat) or the address token (email). Never from content. */
  orgId: string;
  /** The uploading user, or null when the document arrived by email. */
  userId: string | null;
  base64: string;
  mediaType: string;
  filename: string;
  /** Free-text hint shown to the order reader (chat note / email subject). Data, not instructions. */
  note?: string;
  /** Links the filed document back to the email it arrived on. */
  emailIngestId?: string | null;
  /** Provider attachment id, used to heal retries without filing the same copy twice. */
  sourceAttachmentId?: string | null;
  /** Original provider MIME type, retained independently of Storage metadata. */
  sourceContentType?: string | null;
  /**
   * Extract and FILE the document, but DON'T commit its side effects (OrderFlow
   * orders/invoices, ProcurePulse stock movements). The document lands at status
   * 'extracted', awaiting a human's Save in the Doc-U review queue.
   *
   * Used for inbound EMAIL only. Email arrives with no human present, and committing
   * stock/orders off an unattended stranger- or supplier-sent document with no review
   * is exactly what the queue exists to prevent. Chat and manual uploads commit inline
   * (default false), because the person is right there reviewing as they go.
   */
  deferCommit?: boolean;
}

/**
 * Run a document's downstream side effects: an order becomes an OrderFlow order (and,
 * when confident, an invoice + stock movements); everything else feeds ProcurePulse
 * (stock + supplier prices). Idempotent per source_document_id, so committing twice is
 * safe. Touches NO document status — the caller owns that.
 */
export async function runDocumentSideEffects(
  supabase: SupabaseClient,
  doc: {
    id: string;
    org_id: string;
    document_type: DocumentType | null;
    filename: string;
    supplier_id: string | null;
    extracted_data: ExtractedData | null;
    /** When the document was filed — dates the SupplySync timeline event. */
    created_at?: string | null;
  },
): Promise<{ orderSync?: unknown }> {
  if (doc.document_type === 'order') {
    const orderSync = await syncOrderFromDocument(supabase, { documentId: doc.id, orgId: doc.org_id });
    // syncOrderFromDocument REPORTS failure by returning { ok: false, reason }, it does not
    // throw. Returning that quietly let a caller's try/catch see success and mark the
    // document approved with NO order behind it — the document then leaves the review
    // queue, so the order is lost with no way to retry. An unsuccessful sub-result is a
    // failure; make it one.
    if (!orderSync.ok) {
      throw new Error(`Could not build the order: ${orderSync.reason ?? 'unknown reason'}`);
    }
    return { orderSync };
  }
  if (await orgHasProcurePulse(supabase, doc.org_id)) {
    // Unlike the order sync, a `fed: false` here is NOT a failure — it means
    // 'type-not-routed-to-stock' (e.g. a price list) or 'no-line-items', both of which are
    // legitimate "nothing to do, the document is still fine to keep" outcomes. A real
    // failure throws, and the caller's catch handles it. Don't "fix" this into a throw.
    await feedDocumentToProcurePulse(supabase, {
      id: doc.id,
      org_id: doc.org_id,
      filename: doc.filename,
      document_type: doc.document_type,
      supplier_id: doc.supplier_id,
      extracted_data: doc.extracted_data,
    });
  }
  // SupplySync intelligence (profile timeline + spend rollups) is DERIVED data,
  // recomputed per feed and healed by the next commit for the same supplier — so
  // a failure here must never fail the Save and strand the document in the queue
  // (the exact incident docu-review-columns.sql exists to document). Gated on the
  // org actually using SupplySync, like the ProcurePulse feed above. Log and move on.
  try {
    if (await orgHasSupplySync(supabase, doc.org_id)) {
      await feedDocumentToSupplySync(supabase, doc);
    }
  } catch (err) {
    console.error('[supplysync] feed failed (non-fatal):', err);
  }
  return {};
}

/**
 * A document being committed is "claimed" by stamping approved_at while it is still at
 * status 'extracted'/'pending'. A claim older than this is treated as abandoned and may
 * be re-taken. MUST stay larger than the review route's maxDuration (120s): a live
 * commit holds a fresh claim and so can never be re-taken out from under itself, and a
 * claim this old belongs to a dead worker, so re-running its (idempotent) side effects
 * is safe.
 */
export const COMMIT_STALE_MS = 5 * 60 * 1000;

/** PostgREST `.or()` predicate for "this document is free to Save or Discard". */
export function reviewClaimableOr(staleBeforeIso: string): string {
  return `approved_at.is.null,approved_at.lt.${staleBeforeIso}`;
}

/**
 * Commit a document from the review queue: run its side effects (OrderFlow order/invoice,
 * ProcurePulse stock + supplier prices), then mark it approved. Owner/admin gate + org
 * scoping live in the calling route; the supplied client is RLS-scoped to the caller's org.
 *
 * ATOMIC CLAIM FIRST. Two Saves on one document (two admins, or one admin in two tabs)
 * would otherwise both read 'extracted', both pass a status check, and both run the side
 * effects — two orders, two invoices, stock decremented twice. So the claim is a
 * conditional UPDATE whose WHERE is the lock: exactly one caller flips approved_at off a
 * free/stale value under the row lock, and only that caller proceeds. The side effects
 * are idempotent per source_document_id, so a lone retry after a mid-commit crash re-runs
 * cleanly; the claim is what stops CONCURRENT runs, which idempotency alone cannot.
 */
export async function commitDocument(
  supabase: SupabaseClient,
  params: { documentId: string; orgId: string; userId: string },
): Promise<{ ok: true; documentId: string } | { ok: false; status: number; error: string }> {
  const { documentId } = params;

  const claim = await claimDocumentForCommit(supabase, params);
  if (claim.state !== 'claimed') return claim.result;

  try {
    await runDocumentSideEffects(supabase, claim.row);
  } catch (err) {
    await releaseDocumentClaim(supabase, params);
    return { ok: false, status: 500, error: err instanceof Error ? err.message : 'Could not save the document.' };
  }

  const finalized = await finalizeDocumentCommit(supabase, params);
  if (!finalized.ok) return finalized;
  return { ok: true, documentId };
}

/** The row the claim hands to whatever runs the side effects. */
export interface ClaimedDocumentRow {
  id: string;
  org_id: string;
  document_type: DocumentType | null;
  filename: string;
  supplier_id: string | null;
  extracted_data: ExtractedData | null;
  created_at: string | null;
}

/**
 * Step 1 of a commit: take the claim.
 *
 * Factored out of `commitDocument` UNCHANGED — same UPDATE, same predicates, same
 * four sentences for the not-claimable cases — so the Review chat's fast path and
 * Doc-U's full path serialize against each other on exactly one lock.
 */
async function claimDocumentForCommit(
  supabase: SupabaseClient,
  params: { documentId: string; orgId: string; userId: string },
): Promise<
  | { state: 'claimed'; row: ClaimedDocumentRow }
  | { state: 'refused'; result: { ok: true; documentId: string } | { ok: false; status: number; error: string } }
> {
  const { documentId, orgId, userId } = params;
  const nowIso = new Date().toISOString();
  const staleBefore = new Date(Date.now() - COMMIT_STALE_MS).toISOString();

  // Claim: stamp approved_at while still 'extracted'/'pending', only if it's free or the
  // previous claim went stale. The row lock makes this the single serialization point.
  const { data: claimed, error: claimErr } = await supabase
    .from('documents')
    .update({ approved_at: nowIso, approved_by: userId })
    .eq('id', documentId)
    .eq('org_id', orgId)
    .in('status', ['extracted', 'pending'])
    .or(reviewClaimableOr(staleBefore))
    .select('id, org_id, document_type, filename, supplier_id, extracted_data, created_at')
    .maybeSingle();

  if (claimErr) return { state: 'refused', result: { ok: false, status: 500, error: claimErr.message } };

  if (!claimed) {
    // Not claimable. Distinguish the harmless cases from a live claim.
    const { data: cur } = await supabase
      .from('documents')
      .select('status')
      .eq('id', documentId)
      .eq('org_id', orgId)
      .maybeSingle();
    const status = (cur as { status: string } | null)?.status;
    if (!status) {
      return { state: 'refused', result: { ok: false, status: 404, error: 'That document is not in your organisation.' } };
    }
    // Already committed — the user's intent is met.
    if (status === 'approved') return { state: 'refused', result: { ok: true, documentId } };
    if (status === 'rejected') {
      return { state: 'refused', result: { ok: false, status: 409, error: 'That document was discarded.' } };
    }
    return { state: 'refused', result: { ok: false, status: 409, error: 'That document is already being saved.' } };
  }

  return { state: 'claimed', row: claimed as ClaimedDocumentRow };
}

/** Release a claim so the document returns to the queue for retry. Guarded on
 *  `approved_by` so a stale re-claimer's row is never reset by a superseded worker. */
async function releaseDocumentClaim(
  supabase: SupabaseClient,
  params: { documentId: string; orgId: string; userId: string },
): Promise<void> {
  await supabase
    .from('documents')
    .update({ approved_at: null, approved_by: null })
    .eq('id', params.documentId)
    .eq('org_id', params.orgId)
    .eq('approved_by', params.userId)
    .in('status', ['extracted', 'pending']);
}

/**
 * Step 2 of a commit: flip the status to 'approved'.
 *
 * Only our own live claim may finalize (guards against a Discard or a stale
 * re-claimer that slipped in), and the result is CHECKED rather than assumed —
 * a silent failure here would report success while leaving the document in the
 * queue.
 */
async function finalizeDocumentCommit(
  supabase: SupabaseClient,
  params: { documentId: string; orgId: string; userId: string },
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: finalized, error: finalErr } = await supabase
    .from('documents')
    .update({ status: 'approved' })
    .eq('id', params.documentId)
    .eq('org_id', params.orgId)
    .eq('approved_by', params.userId)
    .in('status', ['extracted', 'pending'])
    .select('id')
    .maybeSingle();

  if (finalErr) {
    return {
      ok: false,
      status: 500,
      error: `Saved the document's data, but could not mark it approved: ${finalErr.message}. Try again — re-saving is safe.`,
    };
  }
  if (!finalized) {
    // Our claim was taken (a stale re-claim) or the row moved on. The side effects are
    // idempotent, so this is not corruption — but don't claim success we can't prove.
    return { ok: false, status: 409, error: 'That document was actioned by someone else. Refresh the queue.' };
  }
  return { ok: true };
}

/**
 * The AUTHORITATIVE half of a commit, and nothing else: claim, then mark approved.
 *
 * WHY THIS EXISTS. `commitDocument` runs the side effects BETWEEN those two writes,
 * and those side effects — an OrderFlow order, an invoice, ProcurePulse stock, the
 * SupplySync rollups — are the reason a batch of twenty took Josh more than five
 * seconds to acknowledge. The Review chat does not need them to have finished
 * before it can say "approved": the status write is what every screen in the
 * platform reads, including the queue this row is leaving. So the chat's route
 * runs THIS inline and hands `commitDocumentFollowUp` to Next's `after()`.
 *
 * THE TRADE-OFF, STATED PLAINLY. The order of the two writes is inverted relative
 * to `commitDocument`, so a follow-up that fails leaves a document at 'approved'
 * with no order behind it — where Doc-U's path would have released the claim and
 * put it back in the queue. That is Josh's explicit call (2026-08-19: "background
 * approve, but don't commit to agents watching for them"): the failure is logged
 * and nothing retries it. `runDocumentSideEffects` is idempotent per
 * `source_document_id`, so a later manual re-save heals it.
 *
 * `commitDocument` IS NOT BUILT OUT OF THIS, deliberately. Doc-U's screen keeps
 * the original order — side effects first, status last, claim released on failure
 * — because that screen's Save is a person waiting for the whole thing to land.
 * Both paths share the same claim and the same finalize; only the middle differs.
 */
export async function commitDocumentFast(
  supabase: SupabaseClient,
  params: { documentId: string; orgId: string; userId: string },
): Promise<
  | { ok: true; documentId: string; followUp: ClaimedDocumentRow | null }
  | { ok: false; status: number; error: string }
> {
  const claim = await claimDocumentForCommit(supabase, params);
  if (claim.state !== 'claimed') {
    // `{ ok: true }` here is the already-approved case: nothing left to follow up.
    return claim.result.ok ? { ...claim.result, followUp: null } : claim.result;
  }

  const finalized = await finalizeDocumentCommit(supabase, params);
  if (!finalized.ok) {
    // Nothing has run yet, so the claim is safe to release — this failure is
    // identical to Doc-U's and the document stays in the queue.
    await releaseDocumentClaim(supabase, params);
    return finalized;
  }

  return { ok: true, documentId: params.documentId, followUp: claim.row };
}

/**
 * The SLOW half, detached. NEVER THROWS and never touches the document's status:
 * by the time this runs the row is already 'approved' and the owner has already
 * been told so. A failure is logged for a human to find and is not retried —
 * there is no watcher, by design.
 */
export async function commitDocumentFollowUp(
  supabase: SupabaseClient,
  row: ClaimedDocumentRow,
): Promise<void> {
  try {
    await runDocumentSideEffects(supabase, row);
  } catch (err) {
    console.error(`[review] follow-up failed for document ${row.id} (already approved):`, err);
  }
}

/**
 * Discard a document from the review queue: mark it rejected, leaving it in the
 * table for audit. Nothing was ever committed, so there is nothing to reverse.
 *
 * LIFTED OUT OF `app/api/docu/review/route.ts` UNCHANGED — same patch, same
 * three predicates, same 404 sentence — because Review v2's pane offers the same
 * decision and a second copy of this UPDATE would be a second opinion about what
 * "discard" means. The route now calls this; so does `approveReviewItems`'s
 * sibling. One write path, one set of guards.
 *
 * THE CLAIM GUARD IS WHY THE `.or()` IS HERE. A Discard that could win a race
 * against an in-flight Save would leave the document 'rejected' while its stock
 * and invoice side effects had already run — the one outcome neither screen may
 * produce. `commitDocument` takes the same predicate for the same reason.
 */
export async function discardDocument(
  supabase: SupabaseClient,
  params: { documentId: string; orgId: string; userId: string },
): Promise<{ ok: true; documentId: string } | { ok: false; status: number; error: string }> {
  const { documentId, orgId, userId } = params;
  const staleBefore = new Date(Date.now() - COMMIT_STALE_MS).toISOString();

  const { data: updated, error } = await supabase
    .from('documents')
    .update({ status: 'rejected', reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('org_id', orgId)
    .in('status', ['extracted', 'pending'])
    .or(reviewClaimableOr(staleBefore))
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  if (!updated) {
    return { ok: false, status: 404, error: 'That document is not in your queue, or is being saved.' };
  }
  return { ok: true, documentId };
}

export type IngestDocumentResult =
  | {
      ok: true;
      documentId: string;
      documentType: string | null;
      /** Orders only. */
      customerName?: string | null;
      supplier?: string | null;
      itemCount: number;
      orderSync?: unknown;
    }
  | { ok: false; status: number; error: string; documentId?: string };

/**
 * Classify a document, file it into Doc-U, and route it: orders become OrderFlow
 * orders (auto-invoiced when the customer matches confidently, else a draft to
 * review); everything else stores its extracted fields and feeds ProcurePulse.
 */
export async function ingestDocument(input: IngestDocumentInput): Promise<IngestDocumentResult> {
  const {
    supabase,
    orgId,
    userId,
    base64,
    mediaType,
    filename,
    note,
    emailIngestId = null,
    sourceAttachmentId = null,
    sourceContentType = null,
    deferCommit = false,
  } = input;

  // Provider retries must converge on one Vyso document and one Storage object.
  // Checking before the model call avoids paying to re-read a copy that already
  // exists; the database unique index remains the authoritative race guard.
  if (emailIngestId && sourceAttachmentId) {
    const { data: existing, error: existingError } = await supabase
      .from('documents')
      .select('id, status, document_type')
      .eq('org_id', orgId)
      .eq('email_ingest_id', emailIngestId)
      .eq('source_attachment_id', sourceAttachmentId)
      .limit(1)
      .maybeSingle();
    if (existingError) {
      return { ok: false, status: 500, error: `Could not check the existing document: ${existingError.message}` };
    }
    if (existing) {
      const row = existing as { id: string; status: string; document_type: string | null };
      if (row.status === 'extracted' || row.status === 'approved') {
        return {
          ok: true,
          documentId: row.id,
          documentType: row.document_type,
          itemCount: 0,
        };
      }
      return {
        ok: false,
        status: 409,
        error: 'The existing Vyso document copy is not successfully extracted.',
        documentId: row.id,
      };
    }
  }

  // 1. Classify (+ generic extract). One Haiku call decides the document type.
  let cls;
  try {
    cls = await extractDocument({ base64, mediaType, filename });
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : 'Could not read this document.' };
  }
  const documentType = cls.document_type;
  const isOrder = documentType === 'order';

  // 2. Upload the file to the private "documents" bucket.
  const safeName = filename.replace(/[^\w.\-() ]+/g, '_');
  // Email attachments use a deterministic, opaque path. If a function dies after
  // Storage accepts the bytes but before the documents row is inserted, the retry
  // reuses this exact object instead of creating an orphaned second copy.
  const attachmentStorageKey = emailIngestId && sourceAttachmentId
    ? createHash('sha256')
      .update(`${emailIngestId}\0${sourceAttachmentId}`, 'utf8')
      .digest('hex')
    : null;
  const storagePath = attachmentStorageKey
    ? `${orgId}/email-ingests/${attachmentStorageKey}`
    : `${orgId}/${randomUUID()}_${safeName}`;
  const bytes = Buffer.from(base64, 'base64');
  // How much paper the reader got. Same stamp the /api/ai/extract path writes —
  // this pipeline serves the chat drop and the inbound-email worker, and a
  // photo emailed in too small misreads exactly like one uploaded too small.
  const imagePixels = imagePixelSize(bytes);
  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, { contentType: mediaType || 'application/octet-stream', upsert: false });
  // A deterministic email object already existing means an earlier attempt made
  // it across the Storage boundary. Continue and heal/create the database row.
  if (upErr && !(attachmentStorageKey && isUniqueViolation(upErr))) {
    return { ok: false, status: 500, error: `Could not save the file: ${upErr.message}` };
  }

  // 3. Insert the Doc-U documents row (Orders folder for orders).
  const folderId = isOrder ? await ordersFolderId(supabase, orgId, userId) : null;
  const { data: inserted, error: insErr } = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      filename,
      status: 'pending',
      storage_path: storagePath,
      uploaded_by: userId,
      document_type: documentType,
      ...(folderId ? { folder_id: folderId } : {}),
      ...(emailIngestId ? { email_ingest_id: emailIngestId } : {}),
      ...(sourceAttachmentId ? { source_attachment_id: sourceAttachmentId } : {}),
      ...(sourceContentType ? { source_content_type: sourceContentType } : {}),
    })
    .select('id')
    .single();
  if ((insErr || !inserted) && emailIngestId && sourceAttachmentId && isUniqueViolation(insErr)) {
    const { data: winner } = await supabase
      .from('documents')
      .select('id, status, document_type')
      .eq('org_id', orgId)
      .eq('email_ingest_id', emailIngestId)
      .eq('source_attachment_id', sourceAttachmentId)
      .limit(1)
      .maybeSingle();
    if (winner) {
      const row = winner as { id: string; status: string; document_type: string | null };
      if (row.status === 'extracted' || row.status === 'approved') {
        return { ok: true, documentId: row.id, documentType: row.document_type, itemCount: 0 };
      }
      return {
        ok: false,
        status: 409,
        error: 'The existing Vyso document copy is not successfully extracted.',
        documentId: row.id,
      };
    }
  }
  if (insErr || !inserted) {
    return { ok: false, status: 500, error: `Could not file the document: ${insErr?.message ?? 'unknown error'}` };
  }
  const documentId = (inserted as { id: string }).id;

  // 4a. ORDER → read with the order reader, then build the OrderFlow order
  //     (auto-invoice when confident, else a draft to review).
  if (isOrder) {
    const { data: catalogueRows } = await supabase
      .from('pp_stock_items')
      .select('name')
      .eq('org_id', orgId)
      .order('name', { ascending: true });
    const products = ((catalogueRows ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean);

    let order;
    try {
      order = await extractOrderDocument({ base64, mediaType, filename, products, note });
    } catch (err) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
      return {
        ok: false,
        status: 500,
        error: err instanceof Error ? err.message : 'Could not read the order.',
        documentId,
      };
    }
    // A model/JSON failure reads as empty — surface it rather than filing a blank order.
    if (!order.customer_name && order.line_items.length === 0) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', documentId);
      return {
        ok: false,
        status: 422,
        error: "I filed the document, but couldn't read an order from it.",
        documentId,
      };
    }
    await supabase
      .from('documents')
      .update({
        status: 'extracted',
        confidence: order.overall_confidence,
        document_type: 'order',
        extracted_data: {
          fields: [],
          line_items: order.line_items,
          customer_name: order.customer_name,
          customer_confidence: order.customer_confidence,
          // Which model read it — see the same stamp in app/api/ai/extract.
          extraction_model: order.model,
          extraction_warning: order.warning ?? null,
          image_pixels: imagePixels,
        },
      })
      .eq('id', documentId);

    // Deferred (email): stop here. The order lands in the review queue at 'extracted';
    // nothing is created in OrderFlow until a human clicks Save.
    let orderSync = null;
    if (!deferCommit) {
      try {
        ({ orderSync = null } = await runDocumentSideEffects(supabase, {
          id: documentId,
          org_id: orgId,
          document_type: 'order',
          filename,
          supplier_id: null,
          extracted_data: null,
        }));
      } catch {
        /* extraction + filing already succeeded — the doc is there to review */
      }
    }
    return {
      ok: true,
      documentId,
      documentType: 'order',
      customerName: order.customer_name,
      itemCount: order.line_items.length,
      orderSync,
    };
  }

  // 4b. NON-ORDER → decide which way the document points, store the extracted
  //     fields, resolve the supplier (alias ruling → suppliers row → SupplySync
  //     profile; null for the org's own name), feed ProcurePulse. Reuses the
  //     classification result.

  // WHICH WAY DOES IT POINT? An invoice on the ORG'S OWN letterhead is one the
  // org issued, and nothing below it should treat the issuer as a vendor. Runs
  // AFTER the line audit and BEFORE supplier resolution, because its whole job
  // is to stop that resolution happening on a document that has no supplier.
  // Best-effort: a failed identity read leaves `direction` unknown, which is
  // exactly the behaviour that shipped before this existed.
  let parties: DocumentPartiesVerdict = {
    direction: 'unknown',
    supplierName: cls.supplier,
    customerId: null,
    record: null,
  };
  try {
    parties = await classifyDocumentParties(supabase, orgId, {
      supplier: cls.supplier,
      supplierVat: cls.supplier_vat,
      billTo: cls.bill_to,
    });
  } catch {
    /* unknown direction — carry on exactly as before */
  }

  let supplierId: string | null = null;
  // Deferred email ingest is a READ/FILE/EXTRACT boundary only. Supplier resolution
  // can create both a suppliers row and a SupplySync profile, so it belongs behind
  // the same human approval boundary as stock, orders and invoices. The extracted
  // supplier name remains in extracted_data for the reviewer to confirm/link.
  if (parties.supplierName && !deferCommit) {
    try {
      supplierId = await resolveSupplierProfile(supabase, orgId, parties.supplierName);
    } catch {
      /* keep it unlinked */
    }
  }
  const extractedData = {
    fields: cls.fields,
    line_items: cls.line_items,
    summary: cls.summary,
    // NULL on an outgoing document. Doc-U's detail panel and flags both fall
    // back to this string when there is no linked supplier row, so leaving the
    // org's own name here would keep showing it as the counterparty.
    supplier: parties.supplierName,
    bill_to: cls.bill_to,
    // Arithmetic audit of the lines (null when they add up) — lib/platform/docu/line-audit.ts.
    line_audit: cls.line_audit,
    image_pixels: imagePixels,
    // Only set when the org issued it — lib/platform/docu/document-direction.ts.
    direction: parties.record,
  };
  await supabase
    .from('documents')
    .update({
      status: 'extracted',
      confidence: cls.overall_confidence,
      document_type: documentType,
      extracted_data: extractedData,
      ...(supplierId ? { supplier_id: supplierId } : {}),
      // Written even when null: an outgoing document whose customer we could not
      // recognise must CLEAR any stale linkage, not inherit one.
      ...(parties.direction === 'outgoing' ? { customer_id: parties.customerId } : {}),
    })
    .eq('id', documentId);

  // Deferred (email): stop here. Stock and supplier prices are NOT touched until a
  // human clicks Save in the review queue.
  if (!deferCommit) {
    try {
      await runDocumentSideEffects(supabase, {
        id: documentId,
        org_id: orgId,
        document_type: documentType,
        filename,
        supplier_id: supplierId,
        // `direction` rides along so the ProcurePulse feed can refuse an
        // outgoing document's lines — see feedDocumentToProcurePulse.
        extracted_data: extractedData,
      });
    } catch {
      /* best-effort — filing already succeeded */
    }
  }

  return {
    ok: true,
    documentId,
    documentType,
    supplier: parties.supplierName ?? null,
    itemCount: cls.line_items.length,
  };
}
