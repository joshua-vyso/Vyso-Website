/**
 * The plain-text idempotency keys Phase C's agents write to
 * `agent_findings.dedupe_key`, and the parsers that read them back.
 *
 * WHY THEY LIVE TOGETHER, AND NOT INSIDE EACH AGENT. `agent_findings` stores no
 * customer, item or supplier column — every agent shares one table and one
 * `uuid[]` of evidence. So a key is not only an idempotency token: it is the ONLY
 * place a finding records which row of which table it is about. Price Watch
 * already relies on that (`parseDedupeKey` in its run.ts turns open findings back
 * into price series), and the Brief's evidence resolver now relies on it too — it
 * is how a Stock Cover card knows which stock line to link, given that a stock
 * finding cites no documents at all.
 *
 * That makes the format load-bearing on BOTH sides of a boundary: an agent's
 * nightly cron writes it, and a page render on /app reads it. Defining it in one
 * dependency-free module is what stops those two drifting, and keeps the render
 * path from having to import an agent's detector (and its transitive weight)
 * just to read one string.
 *
 * DEBUGGABLE BY DESIGN, like Price Watch's: a human can read one of these out of
 * the table and know exactly what it is about. Nothing is hashed.
 *
 * A key this file cannot parse IN FULL returns null rather than being half-read.
 * A partial parse would link a card at the wrong customer or the wrong stock
 * line, which is worse than a card with no link at all.
 */

/** Agent slug for Debtors Watch (C1). */
export const DEBTORS_WATCH_AGENT = 'debtors_watch';
/** Agent slug for Stock Cover (C2). */
export const STOCK_COVER_AGENT = 'stock_cover';
/** Agent slug for Doc Watch (C3). */
export const DOC_WATCH_AGENT = 'doc_watch';
/** Agent slug for Xero Watch (Plugins X1). */
export const XERO_WATCH_AGENT = 'xero_watch';

// ---------------------------------------------------------------------------
// Debtors Watch — debtors_watch:<customer_id>:<oldest_overdue_invoice_id>
// ---------------------------------------------------------------------------

/**
 * The oldest overdue invoice, not the week, is what makes this key stable: while
 * the same invoice remains a customer's oldest unpaid one, every nightly run
 * writes the same key and the Brief keeps ONE card for that customer. When it is
 * finally paid the next oldest takes over, the key changes, and a genuinely new
 * situation gets a genuinely new card.
 */
export function buildDebtorsDedupeKey(customerId: string, oldestInvoiceId: string): string {
  return `${DEBTORS_WATCH_AGENT}:${customerId}:${oldestInvoiceId}`;
}

export function parseDebtorsDedupeKey(
  key: string,
): { customerId: string; oldestInvoiceId: string } | null {
  const parts = key.split(':');
  if (parts.length !== 3 || parts[0] !== DEBTORS_WATCH_AGENT) return null;
  const [, customerId, oldestInvoiceId] = parts;
  if (!customerId || !oldestInvoiceId) return null;
  return { customerId, oldestInvoiceId };
}

// ---------------------------------------------------------------------------
// Stock Cover — stock_cover:<rule>:<stock_item_id>:<iso-week>
// ---------------------------------------------------------------------------

/** Which of Stock Cover's two rules raised a finding. Part of the key because a
 *  line can legitimately be BOTH short of cover and short on its count in the
 *  same week, and those are two different conversations. */
export type StockCoverRule = 'low_cover' | 'count_variance';

export const STOCK_COVER_RULES: readonly StockCoverRule[] = ['low_cover', 'count_variance'];

/**
 * The ISO week is what keeps a stock finding from re-firing nightly: a line that
 * is low on Monday is still low on Tuesday, and the owner does not need to be
 * told again. It DOES fire again next week, which is right — a week later, still
 * low, is new information.
 */
export function buildStockCoverDedupeKey(
  rule: StockCoverRule,
  stockItemId: string,
  isoWeek: string,
): string {
  return `${STOCK_COVER_AGENT}:${rule}:${stockItemId}:${isoWeek}`;
}

export function parseStockCoverDedupeKey(
  key: string,
): { rule: StockCoverRule; stockItemId: string; isoWeek: string } | null {
  const parts = key.split(':');
  if (parts.length !== 4 || parts[0] !== STOCK_COVER_AGENT) return null;
  const [, rule, stockItemId, isoWeek] = parts;
  if (!stockItemId || !isoWeek) return null;
  if (!(STOCK_COVER_RULES as readonly string[]).includes(rule)) return null;
  return { rule: rule as StockCoverRule, stockItemId, isoWeek };
}

// ---------------------------------------------------------------------------
// Doc Watch — doc_watch:<document_id>
// ---------------------------------------------------------------------------

/**
 * One card per document, forever. Re-extracting the same document (the retry
 * button in the Doc-U inbox) produces the same key, so the owner does not get a
 * second "read this morning" card for paper they have already seen once.
 */
export function buildDocWatchDedupeKey(documentId: string): string {
  return `${DOC_WATCH_AGENT}:${documentId}`;
}

export function parseDocWatchDedupeKey(key: string): { documentId: string } | null {
  const parts = key.split(':');
  if (parts.length !== 2 || parts[0] !== DOC_WATCH_AGENT) return null;
  if (!parts[1]) return null;
  return { documentId: parts[1] };
}

// ---------------------------------------------------------------------------
// Xero Watch — xero_watch:<rule>:<subject>:<qualifier>
// ---------------------------------------------------------------------------

/**
 * Which of Xero Watch's five rules raised a finding.
 *
 * ONE SHAPE FOR ALL FIVE — `<agent>:<rule>:<subject>:<qualifier>` — rather than
 * five bespoke formats. The Brief's evidence resolver has to read a Xero key on
 * the render path to know WHICH invoices a card is about (`evidence_refs` is a
 * bare uuid array and says nothing about what kind of row it points at), and a
 * resolver that had to try five parsers in turn would fail open on the first
 * ambiguity. A fixed arity means one parse or none.
 *
 * WHAT THE TWO FREE SLOTS HOLD, per rule:
 *   health  — subject: org id,        qualifier: ISO week
 *   missing — subject: org id,        qualifier: ISO week
 *   ar      — subject: Xero contact,  qualifier: the oldest cited mirror invoice
 *   ap      — subject: org id,        qualifier: ISO week
 *   dup     — subject: Xero contact,  qualifier: the normalised invoice number
 *
 * WEEK-KEYED WHERE THE FACT IS A STANDING ONE (health, missing, ap): a
 * connection that has been down since Tuesday is still down on Wednesday and the
 * owner does not need telling twice, but a week later it is news again. Keyed on
 * the ROW where the fact is about one specific thing (ar, dup): while the same
 * invoice is a contact's oldest unpaid one, or the same number is duplicated,
 * every nightly run writes the same key and the Brief keeps one card — the
 * reasoning Debtors Watch's key already follows.
 */
export type XeroWatchRule = 'health' | 'missing' | 'ar' | 'ap' | 'dup';

export const XERO_WATCH_RULES: readonly XeroWatchRule[] = [
  'health',
  'missing',
  'ar',
  'ap',
  'dup',
];

export function buildXeroWatchDedupeKey(
  rule: XeroWatchRule,
  subject: string,
  qualifier: string,
): string {
  return `${XERO_WATCH_AGENT}:${rule}:${subject}:${qualifier}`;
}

export function parseXeroWatchDedupeKey(
  key: string,
): { rule: XeroWatchRule; subject: string; qualifier: string } | null {
  const parts = key.split(':');
  if (parts.length !== 4 || parts[0] !== XERO_WATCH_AGENT) return null;
  const [, rule, subject, qualifier] = parts;
  if (!subject || !qualifier) return null;
  if (!(XERO_WATCH_RULES as readonly string[]).includes(rule)) return null;
  return { rule: rule as XeroWatchRule, subject, qualifier };
}
