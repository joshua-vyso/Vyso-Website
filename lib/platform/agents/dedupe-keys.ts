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
