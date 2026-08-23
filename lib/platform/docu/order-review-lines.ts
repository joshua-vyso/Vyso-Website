/**
 * The rows the ORDER REVIEW EDITOR opens with.
 *
 * WHY THIS IS ITS OWN MODULE. It used to be a `useState` initialiser inside
 * `OrderReviewEditor.tsx`, which made the most consequential question about that
 * screen — "are the numbers on it the post-arithmetic ones?" — answerable only
 * by rendering React. When "Avocado 4 @ 15.75 = R63" reached a reviewer despite
 * `row-arithmetic.ts` existing to prevent exactly that, the first thing anyone
 * needed was a test that walked a real model response all the way to the rows a
 * human sees, and there was no seam to hang one on. This is that seam.
 *
 * IT DOES NOT DO ARITHMETIC, AND MUST NOT. By the time lines reach here they
 * have already been through `applyRowArithmeticToLines` in `lib/ai/order-reader
 * .ts` and been persisted — this function only shapes them for the grid. Making
 * it "helpfully" re-resolve a row would put a second, divergent copy of the
 * total-first rule in the codebase and guarantee the two drift. If the rows
 * arriving here are pre-arithmetic, the bug is upstream in the READER'S
 * ROUTING, which is precisely where it was: `app/api/ai/extract/route.ts` sent
 * untyped rows to the invoice reader, which never runs arithmetic at all.
 *
 * PURE. No React, no I/O. `.ts`-suffixed relative imports so `node --test` can
 * load it directly — it strips types but resolves neither extensionless ESM
 * specifiers nor the `@/` alias.
 */
import type { OrderLineRecord } from './order-line-match.ts';
import type { DocuExtractedData } from './types.ts';

/** One editable row of the review grid. */
export interface ReviewLine {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  /** The paper's own words, carried through edit and re-save untouched. */
  raw: string;
  /** The line total as printed in the paper's own amount column, verbatim. */
  raw_amount: string;
  /** Match + price provenance, once the order has been synced. */
  record: OrderLineRecord | null;
}

/**
 * Build the editor's opening rows from what extraction stored.
 *
 * Provenance records are paired to lines BY THE PAPER'S WORDS rather than by
 * position, because `syncOrderFromDocument` skips lines whose raw text is empty
 * and so its array can be shorter than this one. A per-key queue keeps two rows
 * with identical paper text in their original order.
 *
 * `makeKey` is injected rather than generated here so the caller owns React key
 * identity — and so a test gets stable, readable keys instead of a counter that
 * depends on how many other rows the module has seen this session.
 */
export function buildReviewLines(
  extractedData: DocuExtractedData | null,
  makeKey: () => string,
): ReviewLine[] {
  const rows: ReviewLine[] = (extractedData?.line_items ?? []).map((l) => ({
    key: makeKey(),
    description: l.description ?? '',
    quantity: l.quantity ?? '',
    unit: l.unit ?? '',
    unit_price: l.unit_price ?? '',
    raw: ((l.raw_description ?? '').trim() || (l.description ?? '').trim()).trim(),
    raw_amount: l.raw_amount ?? '',
    record: null,
  }));
  return attachRecords(rows, extractedData?.order_lines);
}

/**
 * Pair provenance records onto rows that already exist, BY THE PAPER'S WORDS.
 *
 * Its own function because the pairing now happens twice: once when the screen
 * opens, and once when a reviewer runs the matching pass from the screen itself
 * on a document whose pass never finished (see OrderReviewEditor's "Run
 * matching" banner). Re-pairing rather than rebuilding is the point there — the
 * rows on screen may carry edits nobody has saved, and `raw` is the one field
 * an edit cannot touch, which is exactly why it is the join key.
 *
 * A row whose paper text matches nothing keeps the record it already had, so a
 * partial write can only ever ADD annotations, never silently strip them.
 */
export function attachRecords<T extends { raw: string; record: OrderLineRecord | null }>(
  rows: T[],
  records: OrderLineRecord[] | null | undefined,
): T[] {
  if (!records?.length) return rows;
  const queues = new Map<string, OrderLineRecord[]>();
  for (const r of records) {
    const k = r.raw_description.trim().toLowerCase();
    const q = queues.get(k) ?? [];
    q.push(r);
    queues.set(k, q);
  }
  return rows.map((row) => {
    const found = queues.get(row.raw.trim().toLowerCase())?.shift() ?? null;
    return found ? { ...row, record: found } : row;
  });
}
