/**
 * The pure half of the Brief's read path: what KIND of thing a finding is, and
 * what its evidence should be called.
 *
 * lib/platform/agent-findings.ts is the read path itself, and it cannot be unit
 * tested — it imports `supabase-server`, which imports `next/headers`, which
 * only exists inside a request. The decisions it makes, though, are pure
 * functions of an agent slug and a row, and those decisions are the ones that go
 * wrong quietly: a finding counted in the greeting that should not have been, a
 * card labelled "3 documents" when it cites three invoices, a receipt that never
 * ages out. So they live here, where `node --test` can pin them, and
 * agent-findings.ts is left with the I/O.
 *
 * Framework-free and dependency-free, like agents/dedupe-keys.ts beside it.
 */

import { DEBTORS_WATCH_AGENT, DOC_WATCH_AGENT, STOCK_COVER_AGENT } from './dedupe-keys.ts';

// ---------------------------------------------------------------------------
// Receipts vs findings
// ---------------------------------------------------------------------------

/**
 * Agents whose findings are RECEIPTS, not problems.
 *
 * Doc Watch writes one card per document read. Twelve invoices arriving
 * overnight is not twelve things needing the owner's attention, and a greeting
 * that said "12 things need your attention" on a quiet Tuesday would teach them
 * to stop reading the number that matters. So these rows are split out of the
 * open feed, rendered in their own lighter band below the real findings
 * (components/platform/brief/ReadOvernightBand.tsx), and counted nowhere — not
 * in the greeting, not in the rail's badge.
 */
export const INFORMATIONAL_AGENTS: readonly string[] = [DOC_WATCH_AGENT];

/**
 * How long a receipt stays on the Brief before it moves to History.
 *
 * Compared AT READ TIME — there is no cron and no status write behind this. A
 * nightly job whose only purpose was to flip yesterday's "read this morning"
 * cards to resolved would be a moving part that can fail; a comparison against
 * `created_at` cannot. 48 hours, so an owner who does not open Vyso on Saturday
 * still sees Friday's paper on Sunday morning.
 */
export const INFORMATIONAL_TTL_HOURS = 48;

/**
 * True when a finding is a receipt rather than something to act on.
 *
 * Deliberately BELT AND BRACES: the slug must be listed above AND the row must
 * carry no rand figure and no recommendation. If a future version of Doc Watch
 * ever learns to price something, that finding stops being a receipt and starts
 * counting, without anyone having to remember to edit the list.
 */
export function isInformationalFinding(finding: {
  agent: string;
  rand_impact: number | null;
  recommended_action: string | null;
}): boolean {
  return (
    INFORMATIONAL_AGENTS.includes(finding.agent) &&
    finding.rand_impact == null &&
    finding.recommended_action == null
  );
}

/** True when a receipt has outlived its window and belongs in History. An
 *  unparseable timestamp is treated as NOT expired — a card that lingers is a
 *  smaller wrong than one that vanishes. */
export function isInformationalExpired(createdAt: string, now: Date): boolean {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  return created < now.getTime() - INFORMATIONAL_TTL_HOURS * 3_600_000;
}

// ---------------------------------------------------------------------------
// What an agent's evidence_refs point at
// ---------------------------------------------------------------------------

/**
 * `evidence_refs` is a bare `uuid[]` with no type column, and as of Phase C the
 * ids in it are no longer all `documents.id`: Debtors Watch cites `of_invoices`
 * rows and Stock Cover cites a `pp_stock_items` line (through its dedupe key —
 * its refs array is empty). Adding an `evidence_kind` column was considered and
 * rejected (plan `.ai/plan_agents_phase_c.md`, "Shared changes"): the agent slug
 * already says what kind of thing an agent cites, so the resolver branches on it
 * and no migration is needed.
 */
export type EvidenceKind = 'documents' | 'invoices' | 'stock';

/** The default is `documents` — the only case before Phase C — so an agent
 *  nobody has taught this function about degrades to the behaviour the Brief
 *  already had rather than to nothing. */
export function evidenceKindOf(agent: string): EvidenceKind {
  if (agent === DEBTORS_WATCH_AGENT) return 'invoices';
  if (agent === STOCK_COVER_AGENT) return 'stock';
  // price_watch and doc_watch both cite Doc-U documents.
  return 'documents';
}

/** Plural nouns for the document types agents cite. Anything outside this map
 *  (or a mixed set) degrades to the honest catch-all, "documents". */
const EVIDENCE_NOUNS: Record<string, [singular: string, plural: string]> = {
  invoice: ['invoice', 'invoices'],
  statement: ['statement', 'statements'],
  delivery_note: ['delivery note', 'delivery notes'],
  price_list: ['price list', 'price lists'],
  order: ['order', 'orders'],
};

/** "3 invoices" / "1 statement" / "4 documents" for a set of document types. */
export function documentEvidenceLabel(count: number, types: readonly (string | null)[]): string {
  const distinct = new Set(types.filter((t): t is string => !!t));
  const noun = distinct.size === 1 ? EVIDENCE_NOUNS[[...distinct][0]] : undefined;
  const [singular, plural] = noun ?? ['document', 'documents'];
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "2 invoices" / "1 invoice" — Debtors Watch's refs are of_invoices ids, whose
 *  noun is never in doubt. */
export function invoiceEvidenceLabel(count: number): string {
  return `${count} ${count === 1 ? 'invoice' : 'invoices'}`;
}

/** Stock Cover cites exactly one catalogue line, named by its dedupe key. */
export const STOCK_EVIDENCE_LABEL = '1 stock line';
