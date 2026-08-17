/**
 * agent_findings — the shared sink every Vyso agent writes its findings to
 * (Price Watch today; see supabase/agents-price-watch.sql). This module is the
 * read path behind The Brief (`/app`), the first user-facing surface over that
 * table.
 *
 * Three rules shape everything below.
 *
 * 1. Reads go through the CALLER'S RLS-scoped client (`createServerSupabase`),
 *    never `createServiceSupabase()`. The cron writes with the service role and
 *    filters `org_id` by hand because RLS can't see it; a signed-in UI path has
 *    no such excuse. `org_id` is still filtered explicitly here — the same
 *    belt-and-braces the Doc-U hub uses — so a policy regression can't widen a
 *    query to another org's rows.
 *
 * 2. The migration may not be applied yet. `/app` is the landing page: it has
 *    to render for an org whose database has never seen `agent_findings`. A
 *    relation-missing error therefore becomes an empty, FLAGGED result and the
 *    page shows its designed empty state. Every other error still throws — a
 *    silently empty brief would be a lie about the business.
 *
 * 3. The Brief only says what it can prove. Every number here is derived from
 *    rows that exist; anything that can't be established is `null` (say
 *    nothing) rather than `0` (claim nothing happened).
 *
 * There is no dismiss/restore function in this file ON PURPOSE. This codebase
 * has no server actions and no `revalidatePath` anywhere: a small row mutation
 * is a client component writing through `supabase-browser` with `.eq('id')
 * .eq('org_id')` and then `router.refresh()` to reconcile (the canonical
 * example is components/platform/supplysync/Risk.tsx → `updateRiskStatus`).
 * The Brief's Dismiss follows that exact shape and therefore lives with the
 * card that owns the button, in components/platform/brief/FindingCard.tsx.
 */

import { createServerSupabase } from './supabase-server';
import { isMissingRelation } from './db-errors';
// The dedupe-key module is a dependency-free leaf on purpose: this file is on
// /app's render path, and a Stock Cover card's only record of WHICH stock line
// it is about is its key, so the resolver has to read one without dragging an
// agent's detector (and its transitive weight) into the page bundle.
import { parseStockCoverDedupeKey } from './agents/dedupe-keys';
// The decisions this file makes about WHAT a finding is — receipt or problem,
// documents or invoices or a stock line — are pure, and they are the ones that
// go wrong quietly. They live in a testable module beside the keys; only the I/O
// is left here. Re-exported below, because callers know them by this module.
import {
  documentEvidenceLabel,
  evidenceKindOf,
  invoiceEvidenceLabel,
  isInformationalExpired,
  isInformationalFinding,
  STOCK_EVIDENCE_LABEL,
  type EvidenceKind,
} from './agents/finding-kinds';

export {
  INFORMATIONAL_AGENTS,
  INFORMATIONAL_TTL_HOURS,
  isInformationalFinding,
} from './agents/finding-kinds';

export type FindingStatus = 'new' | 'in_progress' | 'resolved' | 'dismissed';
export type FindingVerdict = 'real' | 'known' | 'wrong' | 'trivial';

/** One row of `agent_findings`. Mirrors the DDL in supabase/agents-price-watch.sql. */
export interface AgentFinding {
  id: string;
  org_id: string;
  /** Agent slug, e.g. 'price_watch'. Free text in the DB — display maps it. */
  agent: string;
  observation: string;
  /** `uuid[]` of `documents.id` this finding was raised from. */
  evidence_refs: string[];
  rand_impact: number | null;
  recommended_action: string | null;
  status: FindingStatus;
  verdict: FindingVerdict | null;
  dedupe_key: string;
  created_at: string;
}

/** Statuses that still want the owner's attention — the top of the Brief. */
export const OPEN_STATUSES: readonly FindingStatus[] = ['new', 'in_progress'];
/** Statuses that are done with — collapsed under History. */
export const HISTORY_STATUSES: readonly FindingStatus[] = ['resolved', 'dismissed'];


/**
 * What a finding's evidence actually is, once resolved against the rows it
 * points at.
 *
 * `evidence_refs` is a bare `uuid[]` with no type column, and as of Phase C the
 * ids in it are no longer all `documents.id`: Debtors Watch cites `of_invoices`
 * rows and Stock Cover cites a `pp_stock_items` line. Adding an
 * `evidence_kind` column was considered and rejected (plan
 * `.ai/plan_agents_phase_c.md`, "Shared changes") — the agent slug already says
 * what kind of thing an agent cites, so `resolveEvidence` branches on
 * `finding.agent` instead and no migration is needed.
 */
export interface EvidenceSummary {
  count: number;
  /** Truthful noun for what was cited: "3 invoices", "2 statements",
   *  "4 documents" when they are mixed or their type is unknown, "1 stock line". */
  label: string;
  /** Where the label links — the first cited row's own page. Null when the ids
   *  resolve to nothing this org can read, in which case the card shows no
   *  evidence link at all rather than a dead one. */
  href: string | null;
}

export interface FindingsSummary {
  /** Findings that need the owner. Receipts (see `INFORMATIONAL_AGENTS`) are
   *  NOT counted here — this is the number in the greeting and the rail badge. */
  openCount: number;
  /** Largest `rand_impact` across OPEN findings; null when none carries a figure. */
  maxRandImpact: number | null;
  /** Distinct suppliers behind the open findings' evidence documents. Null —
   *  not 0 — when it can't be established (no evidence refs, or the documents
   *  read failed), so the ✦ line drops the clause instead of claiming zero. */
  supplierCount: number | null;
}

export interface FindingsFeed {
  open: AgentFinding[];
  /** Receipts — Doc Watch's "read this morning" cards, still inside their
   *  48-hour window. Rendered in their own band below the findings, counted
   *  nowhere. Newest first. */
  informational: AgentFinding[];
  history: AgentFinding[];
  /** True when `agent_findings` isn't in this database yet — the Brief renders
   *  its "Price Watch hasn't run yet" state, not an error. */
  tableMissing: boolean;
  summary: FindingsSummary;
  /** Evidence per open OR informational finding id. Absent for a finding whose
   *  refs resolve to nothing readable — the card then shows no evidence link at
   *  all. */
  evidence: Record<string, EvidenceSummary>;
}

/** Explicit column list rather than `*`: these rows cross the RSC boundary into
 *  the card component, so they should carry exactly the columns it draws. */
const FINDING_COLS =
  'id, org_id, agent, observation, evidence_refs, rand_impact, recommended_action, status, verdict, dedupe_key, created_at';

/** A brief, not an archive. Anything past this belongs to a paged History screen. */
const FEED_LIMIT = 120;

/** Cap on the evidence documents resolved per render — evidence is one line of
 *  context per card, not a report, and does not need every row. */
const EVIDENCE_PROBE_LIMIT = 200;

/** Row shape as PostgREST returns it: numerics arrive as number|string
 *  depending on driver/precision, and `status`/`verdict` are unconstrained text
 *  in the DB, so both are narrowed defensively in `normalise` below. */
type FindingRow = Omit<AgentFinding, 'rand_impact' | 'status' | 'verdict' | 'evidence_refs'> & {
  rand_impact: number | string | null;
  evidence_refs: string[] | null;
  status: string;
  verdict: string | null;
};

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

const EMPTY_SUMMARY: FindingsSummary = { openCount: 0, maxRandImpact: null, supplierCount: null };

function normalise(row: FindingRow): AgentFinding {
  const impact = row.rand_impact == null ? null : Number(row.rand_impact);
  const known =
    (OPEN_STATUSES as readonly string[]).includes(row.status) ||
    (HISTORY_STATUSES as readonly string[]).includes(row.status);
  return {
    ...row,
    evidence_refs: row.evidence_refs ?? [],
    rand_impact: impact != null && Number.isFinite(impact) ? impact : null,
    // A status this build doesn't know reads as 'new' rather than disappearing
    // from the feed — an unseen finding is worse than a mislabelled one.
    status: known ? (row.status as FindingStatus) : 'new',
    verdict: (row.verdict as FindingVerdict | null) ?? null,
  };
}

/**
 * Resolve the open findings' evidence ids against the rows they actually point
 * at — one read per KIND for the whole feed, not one per card.
 *
 * Deliberately soft throughout: this only decorates the cards and the greeting
 * line. Any read that fails simply drops that kind's evidence links (and, for
 * documents, the supplier clause) rather than failing the page to which the
 * Brief is the landing route.
 *
 * `supplierCount` is still derived from DOCUMENTS only, and only from the
 * findings in `countSupplierIdsFor`. An invoice you issued and a stock line you
 * hold have no supplier to count, and a Doc Watch receipt is not a finding at
 * all — folding either into "across N suppliers" would make the greeting say
 * something untrue about how many suppliers need attention.
 */
async function resolveEvidence(
  supabase: ServerSupabase,
  orgId: string,
  findings: AgentFinding[],
  countSupplierIdsFor: ReadonlySet<string>,
): Promise<{ evidence: Record<string, EvidenceSummary>; supplierCount: number | null }> {
  const evidence: Record<string, EvidenceSummary> = {};

  const byKind = new Map<EvidenceKind, AgentFinding[]>();
  for (const f of findings) {
    const kind = evidenceKindOf(f.agent);
    const arr = byKind.get(kind) ?? [];
    arr.push(f);
    byKind.set(kind, arr);
  }

  const supplierCount = await resolveDocumentEvidence(
    supabase,
    orgId,
    byKind.get('documents') ?? [],
    evidence,
    countSupplierIdsFor,
  );
  await resolveInvoiceEvidence(supabase, orgId, byKind.get('invoices') ?? [], evidence);
  await resolveStockEvidence(supabase, orgId, byKind.get('stock') ?? [], evidence);

  return { evidence, supplierCount };
}

/** Price Watch / Doc Watch — ids are `documents.id`. Returns the distinct
 *  supplier count behind the findings named in `countSupplierIdsFor`, or null
 *  when it cannot be established. */
async function resolveDocumentEvidence(
  supabase: ServerSupabase,
  orgId: string,
  findings: AgentFinding[],
  into: Record<string, EvidenceSummary>,
  countSupplierIdsFor: ReadonlySet<string>,
): Promise<number | null> {
  const docIds = [...new Set(findings.flatMap((f) => f.evidence_refs))].slice(0, EVIDENCE_PROBE_LIMIT);
  if (docIds.length === 0) return null;

  const { data, error } = await supabase
    .from('documents')
    .select('id, supplier_id, document_type')
    .eq('org_id', orgId)
    .in('id', docIds)
    .returns<{ id: string; supplier_id: string | null; document_type: string | null }[]>();

  if (error || !data) return null;

  const byId = new Map(data.map((d) => [d.id, d]));
  const suppliers = new Set<string>();
  for (const f of findings) {
    // Only documents that actually came back — an id the user can't read (or
    // that has since been deleted) must not be counted or linked.
    const docs = f.evidence_refs.map((id) => byId.get(id)).filter((d) => d != null);
    if (docs.length === 0) continue;
    into[f.id] = {
      count: docs.length,
      label: documentEvidenceLabel(docs.length, docs.map((d) => d.document_type)),
      // Doc-U has no id-set list route (only `/app/docu/<id>`), so the card
      // links the first cited document; the count still tells the truth about
      // how many there are.
      href: `/app/docu/${docs[0].id}`,
    };
    if (countSupplierIdsFor.has(f.id)) {
      for (const d of docs) if (d.supplier_id) suppliers.add(d.supplier_id);
    }
  }
  return suppliers.size > 0 ? suppliers.size : null;
}

/**
 * Debtors Watch — ids are `of_invoices.id`, in the detector's own worst-first
 * order, so the first one that resolves is the oldest overdue invoice and the
 * right thing to open.
 *
 * The plan's link was the invoices LIST filtered by customer
 * (`/app/orderflow/invoices?customer=…`), but that page reads no search params
 * (app/app/orderflow/invoices/page.tsx), so the filter would silently do
 * nothing. The single-invoice route exists and is exact, so the card links that
 * instead — the same shape the document branch above already uses.
 */
async function resolveInvoiceEvidence(
  supabase: ServerSupabase,
  orgId: string,
  findings: AgentFinding[],
  into: Record<string, EvidenceSummary>,
): Promise<void> {
  const invoiceIds = [...new Set(findings.flatMap((f) => f.evidence_refs))].slice(0, EVIDENCE_PROBE_LIMIT);
  if (invoiceIds.length === 0) return;

  const { data, error } = await supabase
    .from('of_invoices')
    .select('id')
    .eq('org_id', orgId)
    .in('id', invoiceIds)
    .returns<{ id: string }[]>();

  if (error || !data) return;

  const known = new Set(data.map((r) => r.id));
  for (const f of findings) {
    const ids = f.evidence_refs.filter((id) => known.has(id));
    if (ids.length === 0) continue;
    into[f.id] = {
      count: ids.length,
      label: invoiceEvidenceLabel(ids.length),
      href: `/app/orderflow/invoices/${ids[0]}`,
    };
  }
}

/**
 * Stock Cover — `evidence_refs` is EMPTY. A stock finding cites no documents and
 * no invoices; the thing it is about is one `pp_stock_items` row, and the only
 * record of which one is the dedupe key
 * (`stock_cover:<rule>:<stock_item_id>:<iso-week>`).
 *
 * The line is still verified against the catalogue before the card offers a
 * link: a key naming a stock item this org can no longer read gets no evidence
 * at all, rather than a link into a 404. Same rule as everywhere else on this
 * page — only say what you can prove.
 */
async function resolveStockEvidence(
  supabase: ServerSupabase,
  orgId: string,
  findings: AgentFinding[],
  into: Record<string, EvidenceSummary>,
): Promise<void> {
  const wanted = new Map<string, string>(); // finding id → stock item id
  for (const f of findings) {
    const parsed = parseStockCoverDedupeKey(f.dedupe_key ?? '');
    if (parsed) wanted.set(f.id, parsed.stockItemId);
  }
  if (wanted.size === 0) return;

  const itemIds = [...new Set(wanted.values())].slice(0, EVIDENCE_PROBE_LIMIT);
  const { data, error } = await supabase
    .from('pp_stock_items')
    .select('id')
    .eq('org_id', orgId)
    .in('id', itemIds)
    .returns<{ id: string }[]>();

  if (error || !data) return;

  const known = new Set(data.map((r) => r.id));
  for (const [findingId, stockItemId] of wanted) {
    if (!known.has(stockItemId)) continue;
    into[findingId] = {
      count: 1,
      label: STOCK_EVIDENCE_LABEL,
      href: `/app/procurepulse/stock/${stockItemId}`,
    };
  }
}

/**
 * ONE finding, by id — the detail route's read (`/app/finding/[id]`,
 * .ai/plan_brief_chat_v2.md §4 W3).
 *
 * `org_id` is pinned alongside the id, exactly as rule 1 above demands. RLS
 * already scopes the caller, so this is the second lock: a finding belonging to
 * another org must be indistinguishable from one that does not exist, and the
 * page turns both into `notFound()`. Returning the row and letting the page
 * compare orgs would be a slower version of the same check with a window in
 * which it could be forgotten.
 *
 * Null, never a throw, for "no such finding" and for "the migration hasn't been
 * applied" alike (rule 2) — a link to a finding that has since been deleted is
 * a 404, not a 500. Every other error still throws.
 */
export async function getFinding(orgId: string, id: string): Promise<AgentFinding | null> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('agent_findings')
    .select(FINDING_COLS)
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle<FindingRow>();

  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  return data ? normalise(data) : null;
}

/** One cited document, as the detail page's evidence list draws it. The card
 *  shows a filename and a date; the price beside it comes from the price series
 *  (see lib/platform/price-watch/series.ts), which is the only place a line
 *  price exists. */
export interface EvidenceDocument {
  id: string;
  filename: string;
  document_type: string | null;
  created_at: string;
}

/** The evidence behind ONE finding, resolved document by document. */
export interface FindingEvidence {
  documents: EvidenceDocument[];
  /** "3 invoices" — the same truthful noun the cards use. */
  label: string;
  /** The finding cites documents, but none of them can be read any more (they
   *  were deleted, or this user cannot see them). The page says so in words
   *  rather than showing an empty section (plan §5). */
  missing: boolean;
}

/**
 * Resolve one finding's `evidence_refs` against `documents`, in citation order.
 *
 * Separate from `resolveEvidence` above rather than a variant of it: that one
 * summarises a whole feed into a count and a link for every card in one query,
 * this one needs the rows themselves for a single finding. Sharing a function
 * between "one line per card" and "a card per document" would mean the feed
 * paying for columns it never draws.
 *
 * Soft on failure for the same reason the feed's resolver is: this decorates a
 * page that already has an observation, a figure and a recommendation on it.
 */
export async function listFindingEvidence(
  orgId: string,
  finding: Pick<AgentFinding, 'evidence_refs'>,
): Promise<FindingEvidence> {
  const refs = finding.evidence_refs ?? [];
  if (refs.length === 0) return { documents: [], label: '', missing: false };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('documents')
    .select('id, filename, document_type, created_at')
    .eq('org_id', orgId)
    .in('id', refs.slice(0, EVIDENCE_PROBE_LIMIT))
    .returns<EvidenceDocument[]>();

  if (error || !data) return { documents: [], label: '', missing: true };

  // Citation order, not database order: `evidence_refs` is the order the agent
  // read them in, and the chart beside this list runs left to right in the same
  // direction.
  const byId = new Map(data.map((d) => [d.id, d]));
  const documents = refs.map((id) => byId.get(id)).filter((d): d is EvidenceDocument => d != null);

  return {
    documents,
    label: documentEvidenceLabel(documents.length, documents.map((d) => d.document_type)),
    missing: documents.length === 0,
  };
}

/**
 * The whole feed in one round-trip: open findings for the brief, resolved and
 * dismissed ones for History.
 *
 * ONE query, partitioned in memory, rather than two filtered reads — an org's
 * whole findings table is a few dozen rows, and a single ordered read keeps the
 * open/history split a display decision instead of a second network hop.
 *
 * The order clause is the OPEN feed's order: biggest rand figure first (nulls
 * last, so a finding with no price tag never outranks one with a number), newest
 * first within that. History wants recency instead and is re-sorted below —
 * sorting a handful of rows in JS is cheaper than asking Postgres twice.
 */
export async function fetchFindings(orgId: string): Promise<FindingsFeed> {
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from('agent_findings')
    .select(FINDING_COLS)
    .eq('org_id', orgId)
    .order('rand_impact', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT)
    .returns<FindingRow[]>();

  if (error) {
    // Rule 2 — the landing page renders even when the migration hasn't been run.
    if (isMissingRelation(error)) {
      return {
        open: [],
        informational: [],
        history: [],
        tableMissing: true,
        summary: EMPTY_SUMMARY,
        evidence: {},
      };
    }
    throw error;
  }

  const rows = (data ?? []).map(normalise);
  // One clock for the whole partition, so a feed read across a second boundary
  // cannot put two receipts written together on opposite sides of the window.
  const now = new Date();

  const open: AgentFinding[] = [];
  const informational: AgentFinding[] = [];
  const history: AgentFinding[] = [];

  for (const f of rows) {
    if ((HISTORY_STATUSES as readonly string[]).includes(f.status)) {
      history.push(f);
      continue;
    }
    if (!(OPEN_STATUSES as readonly string[]).includes(f.status)) continue;

    if (!isInformationalFinding(f)) {
      open.push(f);
      continue;
    }

    // A receipt older than its window moves to History — computed here, with no
    // cron and no write. Its stored status is still 'new'; it is presented as
    // 'resolved' because that is what has actually happened to it (it did its
    // job and aged out), and because History's card would otherwise label a row
    // nobody dismissed as "Dismissed". Restore puts it back as 'new' and it
    // ages out again on the next render — harmless, and the honest consequence
    // of a rule with no state behind it.
    if (isInformationalExpired(f.created_at, now)) {
      history.push({ ...f, status: 'resolved' });
    } else {
      informational.push(f);
    }
  }

  // ISO-8601 from timestamptz sorts lexically, so no Date objects needed.
  history.sort((a, b) => b.created_at.localeCompare(a.created_at));
  informational.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const impacts = open.map((f) => f.rand_impact).filter((n): n is number => n != null);
  // Evidence is resolved for the receipts too — their band links each card at
  // the document it is about — but only the real findings feed the greeting's
  // supplier count.
  const { evidence, supplierCount } = await resolveEvidence(
    supabase,
    orgId,
    [...open, ...informational],
    new Set(open.map((f) => f.id)),
  );

  return {
    open,
    informational,
    history,
    tableMissing: false,
    evidence,
    summary: {
      openCount: open.length,
      maxRandImpact: impacts.length > 0 ? Math.max(...impacts) : null,
      supplierCount,
    },
  };
}
