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
import { displayUnitForLine } from './customer-uom-rules.ts';
import type { DocuExtractedData } from './types.ts';
import type { CustomerInterpretationLinePreview } from '../types.ts';

/** One editable row of the review grid. */
export interface ReviewLine {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  raw_unit_price: string;
  /** The paper's own words, carried through edit and re-save untouched. */
  raw: string;
  /** The line total as printed in the paper's own amount column, verbatim. */
  raw_amount: string;
  /** The row's own VAT, printed rate, tax code and VAT-inclusive total, each
   *  verbatim and each blank on the many rows that print none of them. Carried
   *  through the editor untouched for the same reason `raw_amount` is: they are
   *  the evidence the row's two cross-checks are asked against, and a re-save
   *  that dropped them would silently disarm those checks on every later open. */
  raw_tax_amount: string;
  tax_rate: string;
  tax_code: string;
  raw_total_amount: string;
  quantity_source: 'printed' | 'derived' | 'unresolved' | '';
  /**
   * The EXTRACTION's confidence for this line, carried through review unchanged.
   *
   * Here because the save handler used to stamp every line `confidence: 100` on
   * its way out, which is not a correction, it is an erasure: after one Confirm
   * a document that had been read at 40% on six rows was indistinguishable from
   * one read perfectly, and the record of how well the model had actually done
   * — the only thing that makes a later "why did this go wrong?" answerable —
   * was gone. A reviewer confirming a line does not retroactively make the
   * model certain of it. Null on a hand-added row: nothing read it, so there is
   * no reading to report.
   */
  confidence: number | null;
  /** Match + price provenance, once the order has been synced. */
  record: OrderLineRecord | null;
  /** Read-only unattended preview from existing customer mappings/rules. */
  interpretation: CustomerInterpretationLinePreview | null;
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
    raw_unit_price: l.raw_unit_price ?? l.unit_price ?? '',
    raw: ((l.raw_description ?? '').trim() || (l.description ?? '').trim()).trim(),
    raw_amount: l.raw_amount ?? '',
    raw_tax_amount: l.raw_tax_amount ?? '',
    tax_rate: l.tax_rate ?? '',
    tax_code: l.tax_code ?? '',
    raw_total_amount: l.raw_total_amount ?? '',
    quantity_source: l.quantity_source ?? '',
    // Whatever the extraction said, verbatim — including a genuine 0. Null only
    // when the stored line carries no confidence at all, which is a historical
    // row and not a low-confidence one; see the field's own comment above.
    confidence: typeof l.confidence === 'number' ? l.confidence : null,
    record: null,
    interpretation: null,
  }));
  const paired = attachRecords(rows, extractedData?.order_lines);
  // ADDENDUM 4b (plan_customer_uom_rules.md): a line a customer UOM rule
  // already resolved opens showing the INTERPRETED unit, not the printed
  // one — see `displayUnitForLine`. Deliberately only here, at OPEN time, and
  // not folded into `attachRecords` itself: that function is also used to
  // re-pair a "Run matching" rerun onto rows that may carry a unit edit the
  // reviewer has not saved yet (see its own docblock), and this override
  // would silently clobber that edit if it ran on every re-pair.
  const previewByIndex = new Map((extractedData?.customer_interpretation_preview?.lines ?? [])
    .map((preview) => [preview.line_index, preview] as const));
  return paired.map((row, index) => {
    const preview = previewByIndex.get(index) ?? null;
    return {
      ...row,
      description: preview?.interpreted_description ?? row.description,
      unit: row.record
        ? displayUnitForLine(row.record, row.unit)
        : preview?.interpreted_uom ?? row.unit,
      interpretation: preview,
    };
  });
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
