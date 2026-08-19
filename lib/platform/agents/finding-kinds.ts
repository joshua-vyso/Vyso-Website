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

import {
  DEBTORS_WATCH_AGENT,
  DOC_WATCH_AGENT,
  STOCK_COVER_AGENT,
  XERO_WATCH_AGENT,
  parseXeroWatchDedupeKey,
  type StockCoverRule,
} from './dedupe-keys.ts';

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
export type EvidenceKind = 'documents' | 'invoices' | 'stock' | 'xero';

/** The default is `documents` — the only case before Phase C — so an agent
 *  nobody has taught this function about degrades to the behaviour the Brief
 *  already had rather than to nothing. */
export function evidenceKindOf(agent: string): EvidenceKind {
  if (agent === DEBTORS_WATCH_AGENT) return 'invoices';
  if (agent === STOCK_COVER_AGENT) return 'stock';
  if (agent === XERO_WATCH_AGENT) return 'xero';
  // price_watch and doc_watch both cite Doc-U documents.
  return 'documents';
}

/**
 * XERO WATCH IS THE FIRST AGENT WHOSE REFS ARE NOT ONE KIND OF ROW.
 *
 * Four of its five rules cite `xero_invoices` mirror rows; the fifth — "these
 * bills are in Doc-U but not in Xero" — cites `documents.id`, because the whole
 * point of that finding is paper that has NO Xero row to point at. One agent
 * slug, two tables.
 *
 * `evidence_refs` has no type column (the decision `agent-findings.ts` records:
 * the agent slug was supposed to be enough), so the tie-breaker is the dedupe
 * key's RULE, which is recorded on every Xero finding by construction. A key
 * that will not parse falls back to the mirror, because that is four rules out of
 * five and the resolver verifies its ids against the table before it links
 * anything — a wrong guess costs a missing link, never a wrong one.
 */
export function xeroRefsAreDocuments(dedupeKey: string | null | undefined): boolean {
  return parseXeroWatchDedupeKey(dedupeKey ?? '')?.rule === 'missing';
}

/** "3 Xero invoices" / "1 Xero invoice" — named for the system they live in,
 *  because an owner reading this card has OrderFlow invoices on the same Brief
 *  and the two are different rows about (sometimes) the same money. */
export function xeroInvoiceEvidenceLabel(count: number): string {
  return `${count} Xero ${count === 1 ? 'invoice' : 'invoices'}`;
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

// ---------------------------------------------------------------------------
// How the DETAIL page introduces that evidence
// ---------------------------------------------------------------------------

/**
 * The module a kind of evidence lives in, by the name the owner knows it by.
 *
 * The detail page's whole claim on trust is "every sentence here comes from a
 * row you have", so the strip says WHERE that row is before it offers a link
 * into it. Before Phase C there was only ever one answer (Doc-U) and it was
 * hardcoded in the component; now there are three, and the mapping is a fact
 * about agents rather than about markup.
 */
export function evidenceSourceName(kind: EvidenceKind): string {
  if (kind === 'invoices') return 'OrderFlow';
  if (kind === 'stock') return 'ProcurePulse';
  // Xero, by name. The owner knows exactly what that means, and saying "Plugins"
  // would name the section rather than the system the rows are actually in.
  if (kind === 'xero') return 'Xero';
  return 'Doc-U';
}

/**
 * "Evidence" or "Subject" — what the strip IS for this kind of finding.
 *
 * Stock Cover cites nothing: `evidence_refs` is empty and the stock line named
 * by its dedupe key is not proof of the finding, it is the thing the finding is
 * about. Calling that section "Evidence" would be a small lie about what the
 * agent did, so it gets the honest word instead.
 */
export function evidenceHeadingWord(kind: EvidenceKind): string {
  // Xero joins stock on "Subject" for the same reason: its rows are what a
  // finding is ABOUT, not proof that Vyso computed something. "R 41 000 of
  // supplier bills fall due by Friday" does not need the bills as evidence — it
  // IS the bills — and calling them evidence would be a small lie about what the
  // agent did. (The one Xero rule that genuinely cites proof, "these Doc-U bills
  // never reached Xero", resolves as `documents` and gets the honest "Evidence".)
  return kind === 'stock' || kind === 'xero' ? 'Subject' : 'Evidence';
}

/** "Evidence · 3 invoices from OrderFlow" / "Subject · stock line" /
 *  "Subject · 3 Xero invoices". */
export function evidenceHeading(kind: EvidenceKind, label: string): string {
  if (kind === 'stock') return `${evidenceHeadingWord(kind)} · ${STOCK_EVIDENCE_LABEL}`;
  if (kind === 'xero') return `${evidenceHeadingWord(kind)} · ${label}`;
  return `${evidenceHeadingWord(kind)} · ${label} from ${evidenceSourceName(kind)}`;
}

/**
 * What the page says when the rows a finding points at cannot be read any more.
 *
 * The noun has to match what was actually cited. The pre-Phase-C copy ("the
 * documents behind this finding") appeared under a Debtors Watch card that cites
 * no documents at all — false in the one place the product is asking to be
 * believed. Same sentence, true noun.
 */
export function evidenceMissingCopy(kind: EvidenceKind): string {
  if (kind === 'invoices') return 'The invoices behind this finding are no longer available.';
  if (kind === 'stock') return 'The stock line behind this finding is no longer available.';
  if (kind === 'xero') {
    // Worded as a fact about the MIRROR, not about Xero. The rows may be alive
    // and well in Xero; what has happened is that Vyso's copy of them has gone —
    // a disconnect, or a sync that has not run since they were cited. Saying "no
    // longer in Xero" would be a claim about the customer's accounting system
    // that this product cannot make.
    return 'The Xero invoices behind this finding are no longer in Vyso’s copy of your ledger.';
  }
  return 'The documents behind this finding are no longer available.';
}

/**
 * "40 days past terms" — the same words Debtors Watch's own observation uses, so
 * the headline and the invoice under it cannot describe the same lateness two
 * different ways.
 *
 * Null (say nothing) for an invoice with no due date and for one that is not
 * actually late: "0 days past terms" on a strip whose heading is about overdue
 * money would read as a bug.
 */
export function daysPastTermsLabel(days: number | null): string | null {
  if (days == null || !Number.isFinite(days)) return null;
  const whole = Math.floor(days);
  if (whole <= 0) return null;
  return `${whole} ${whole === 1 ? 'day' : 'days'} past terms`;
}

/** Which of Stock Cover's two rules raised a finding, in words — read off the
 *  dedupe key, which is the only record of it. */
export function stockRuleLabel(rule: StockCoverRule): string {
  return rule === 'count_variance' ? 'Count variance' : 'Low cover';
}
