/**
 * Per-line money on an uploaded customer ORDER: the gross the review editor
 * shows, and the cross-check against the amount the paper itself printed.
 *
 * WHY THIS EXISTS. `129456b` made the review screen honest about WHICH PRODUCT
 * a line was matched to. It said nothing about whether the FIGURES on the line
 * had been read correctly, and the next run of the same Bakubung purchase order
 * produced "Apple Top Red @ 560.90" where the paper says 569.90 — a single
 * transposed digit, internally consistent with nothing, and invisible because
 * the screen showed the unit price alone. A price column on its own cannot be
 * checked. A price column beside the paper's own line total can:
 *
 *     1 × 560.90 = 560.90, and the paper says 569.90. Those are not the same
 *     number, so one of the three was misread — and we can say so on the row.
 *
 * That is the whole idea. It is the same cross-check `line-audit.ts` runs over
 * an invoice, at the same tolerances (`moneyMatches` — a cent, or half a
 * percent, whichever is kinder), applied one row at a time to an order while a
 * human is still looking at it. The maths is deliberately NOT re-implemented
 * here: a warning that disagreed with the invoice audit about what "close
 * enough" means would be worse than no warning.
 *
 * WHAT WE DO NOT DO. We never "fix" the line. Both the paper's figure and the
 * reader's are shown, and the reviewer decides which is right — the same rule
 * the product matcher follows. A guess that reconciles is exactly the failure
 * mode that invoiced R13,457.60 as R25,958.95.
 *
 * PURE. No I/O, no React, no Supabase. `.ts`-suffixed relative imports because
 * `node --test` resolves neither extensionless ESM specifiers nor the `@/`
 * alias, and this module is loaded directly by tests/docu-order-line-totals.test.ts.
 */
import type { ExtractedLineItem } from '../types.ts';
import { parseAmount } from './extract.ts';
import { moneyMatches } from './line-audit.ts';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The money-bearing subset of an order line — extracted, or live in the editor. */
export interface OrderLineMoney {
  quantity?: string | null;
  unit_price?: string | null;
  /** The line total EXACTLY as printed on the paper ("nett", "amount"), before
   *  anything of ours touched it. Blank on the orders that carry no prices at
   *  all, which is most of them — a WhatsApp list has no amount column. */
  raw_amount?: string | null;
}

/**
 * Quantity × unit price, to the cent — the gross for one line.
 *
 * A blank or unreadable figure on either side counts as zero rather than
 * throwing the row away: an order line with no price yet is a normal state (it
 * fills from the price list at sync), and it should read R 0.00 on screen, not
 * a dash that hides the row from the running total.
 */
export function lineGross(line: OrderLineMoney): number {
  const qty = parseAmount(line.quantity) ?? 0;
  const price = parseAmount(line.unit_price) ?? 0;
  return round2(qty * price);
}

/** The order's gross, summed over the lines the editor currently holds. */
export function orderSubtotal(lines: OrderLineMoney[]): number {
  return round2(lines.reduce((sum, l) => sum + lineGross(l), 0));
}

/** A row whose arithmetic disagrees with the paper's own amount column. */
export interface GrossMismatch {
  /** What the paper printed for this line. */
  paper: number;
  /** Quantity × unit price as the row currently stands. */
  gross: number;
  /** gross − paper. Signed, so the reviewer can see which way it is out. */
  difference: number;
}

/**
 * Does this line's arithmetic agree with the amount printed beside it?
 *
 * Returns null — no warning — in every case where the question cannot fairly be
 * asked, and that restraint is most of the value:
 *
 *   - **The paper printed no amount.** Nothing to check against. Most orders.
 *   - **The line has no quantity, or no unit price.** An unpriced line is the
 *     NORMAL state of an order line before `syncOrderFromDocument` prices it
 *     from the org's list; warning "0.00 ≠ 569.90" on every such row would put
 *     a red mark on a perfectly good order and teach the reviewer to ignore it.
 *     A warning that fires when nothing is wrong is a warning nobody reads.
 *
 * Otherwise the two must reconcile within `moneyMatches` — a cent, or 0.5%,
 * whichever is kinder — and a row that does not is returned with both figures
 * so the screen can print them side by side.
 */
export function grossMismatch(line: OrderLineMoney): GrossMismatch | null {
  const paper = parseAmount(line.raw_amount);
  if (paper == null) return null;
  if (parseAmount(line.quantity) == null) return null;
  if (parseAmount(line.unit_price) == null) return null;

  const gross = lineGross(line);
  if (moneyMatches(gross, paper)) return null;
  return { paper, gross, difference: round2(gross - paper) };
}

/** How many of these lines disagree with the paper. For the review banner. */
export function countGrossMismatches(lines: OrderLineMoney[]): number {
  return lines.reduce((n, l) => n + (grossMismatch(l) ? 1 : 0), 0);
}

/** One editable row of the order review editor, as far as printing cares. */
export interface PrintableOrderLine extends OrderLineMoney {
  description: string;
  unit?: string | null;
}

/**
 * The editor's LIVE rows as extracted line items, for `mapExtractionToSheet`.
 *
 * This is what makes "Print / PDF" print what is on screen rather than what is
 * in the database: the reviewer has just corrected 560.90 to 569.90 and has not
 * pressed Confirm — printing the saved document would hand them the mistake
 * back on paper.
 *
 * No `amount` is set. The sheet derives each line's amount from quantity × unit
 * price, which is precisely `lineGross`, so setting it would only create a
 * second copy of one number that could later disagree with the first.
 */
export function toPrintableLines(lines: PrintableOrderLine[]): ExtractedLineItem[] {
  return lines
    .filter((l) => (l.description ?? '').trim() !== '')
    .map((l) => ({
      description: (l.description ?? '').trim(),
      quantity: (l.quantity ?? '').trim(),
      unit: (l.unit ?? '').trim(),
      unit_price: (l.unit_price ?? '').trim(),
      confidence: 100,
    }));
}
