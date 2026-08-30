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
import type { ExtractedLineItem, OrderDocumentTotals } from '../types.ts';
import { parseAmount } from './extract.ts';
import { moneyMatches } from './line-audit.ts';
import { inferDecimalSeparator, type DecimalSeparator } from '../locale-number.ts';

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The money-bearing subset of an order line — extracted, or live in the editor. */
export interface OrderLineMoney {
  quantity?: string | null;
  unit_price?: string | null;
  /** The line total EXACTLY as printed on the paper ("nett", "amount"), before
   *  anything of ours touched it. Blank on the orders that carry no prices at
   *  all, which is most of them — a WhatsApp list has no amount column.
   *
   *  NET, on a document that separates net from VAT. That was always the
   *  intent, but the prompt used to say "the row's own amount/nett/value
   *  column" and a row printing all three columns made that a coin toss — see
   *  `grossMismatch` below for what the toss cost. */
  raw_amount?: string | null;
  /** The row's own VAT figure as printed, blank when the row prints none. A
   *  blank is NOT a zero: a zero-rated row and a row whose page does not
   *  itemise VAT are different documents, and only one of them can be added up. */
  raw_tax_amount?: string | null;
  /** The row's VAT-INCLUSIVE total as printed, blank when the row prints none. */
  raw_total_amount?: string | null;
}

/**
 * Infer this document's decimal separator ONCE from every numeric string its
 * lines carry (quantity, unit price, the paper's own amount), so a comma-decimal
 * order ("0,20" × "269,000") reads correctly everywhere it is touched.
 *
 * EXPORTED so the review editor and any other caller that walks a full line
 * array ask this ONE question about the document instead of silently forming
 * their own opinion — the failure mode that would let one screen show a figure
 * a second screen disagrees with, of a document that is not itself ambiguous
 * once all its numbers are read together. See `lib/platform/locale-number.ts`
 * for the vote itself; this is only the gathering of what to vote on.
 */
export function lineSeparatorHint(
  lines: Array<
    Pick<OrderLineMoney, 'quantity' | 'unit_price' | 'raw_amount' | 'raw_tax_amount' | 'raw_total_amount'>
  >,
): DecimalSeparator | null {
  const samples: Array<string | null | undefined> = [];
  // The VAT and inclusive-total columns join the vote because they are MONEY
  // STRINGS off the same page, and every extra money string is evidence about
  // one question: does this document write "50,70" or "50.70"? A VAT column is
  // in fact unusually good evidence — two decimal places, every row — and
  // leaving it out would mean the figure most likely to be ambiguous ("50,70")
  // had no say in how it gets read. This is the ONLY sample list the new
  // fields are added to; no other decimal hint anywhere sees them.
  for (const l of lines) {
    samples.push(l.quantity, l.unit_price, l.raw_amount, l.raw_tax_amount, l.raw_total_amount);
  }
  return inferDecimalSeparator(samples);
}

const asOpts = (hint?: DecimalSeparator | null) => (hint ? { decimalSeparator: hint } : undefined);

/**
 * Quantity × unit price, to the cent — the gross for one line.
 *
 * A blank or unreadable figure on either side counts as zero rather than
 * throwing the row away: an order line with no price yet is a normal state (it
 * fills from the price list at sync), and it should read R 0.00 on screen, not
 * a dash that hides the row from the running total.
 *
 * `hint` is the document-level separator from `lineSeparatorHint` — pass the
 * SAME hint for every line of one document (this function reads one line at a
 * time and cannot infer it alone; a single "0,20" is not enough evidence on
 * its own). Omit it for the ordinary, unambiguous case — every existing caller
 * that never passed one keeps parsing exactly as before.
 */
export function lineGross(line: OrderLineMoney, hint?: DecimalSeparator | null): number {
  const qty = parseAmount(line.quantity, asOpts(hint)) ?? 0;
  const price = parseAmount(line.unit_price, asOpts(hint)) ?? 0;
  return round2(qty * price);
}

/** The order's gross, summed over the lines the editor currently holds.
 *  Infers the document's separator once (unless the caller already knows it)
 *  and applies that ONE reading to every line, rather than each line guessing
 *  independently off its own two or three figures. */
export function orderSubtotal(lines: OrderLineMoney[], hint?: DecimalSeparator | null): number {
  const h = hint !== undefined ? hint : lineSeparatorHint(lines);
  return round2(lines.reduce((sum, l) => sum + lineGross(l, h), 0));
}

/** The row's own VAT figure, or null when the row printed none. NEVER derived
 *  from a rate: a VAT we computed would reconcile with itself by construction,
 *  which is the one thing a cross-check must not do. */
export function lineTax(line: OrderLineMoney, hint?: DecimalSeparator | null): number | null {
  return parseAmount(line.raw_tax_amount, asOpts(hint));
}

/** The row's own VAT-INCLUSIVE total as printed, or null. Never written into
 *  `amount` or `unit_price` by anything — both stay net everywhere. */
export function lineTotal(line: OrderLineMoney, hint?: DecimalSeparator | null): number | null {
  return parseAmount(line.raw_total_amount, asOpts(hint));
}

/** WHICH of the row's two questions failed. */
export type GrossMismatchReason =
  /** quantity × unit price does not reach the row's NET. */
  | 'line_math'
  /** net + VAT does not reach the row's printed INCLUSIVE total. */
  | 'vat_total';

/** A row whose arithmetic disagrees with the paper's own figures. */
export interface GrossMismatch {
  /** Which check failed — the two need different sentences on screen, because
   *  they send the reviewer to different columns of the paper. */
  reason: GrossMismatchReason;
  /** What the paper printed for the failing comparison: the row's net for
   *  `line_math`, the row's inclusive total for `vat_total`. */
  paper: number;
  /** What the row's own figures come to: quantity × unit price for
   *  `line_math`, net + VAT for `vat_total`. */
  gross: number;
  /** gross − paper. Signed, so the reviewer can see which way it is out. */
  difference: number;
  /** The row's printed VAT and inclusive total, when it printed them. Carried
   *  so the screen can show the whole row without parsing it a second time. */
  tax?: number | null;
  total?: number | null;
}

/**
 * Does this line's arithmetic agree with the figures printed beside it?
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
 * TAX-AWARE, AND THAT IS THE POINT OF THIS REVISION. A Montecasino order prints
 * three money columns per row — Nett 338.00, VAT 50.70, Total 388.70 — and this
 * function used to compare quantity × unit price against ONE of them without
 * knowing which one it had been handed. A reader that put 388.70 in
 * `raw_amount` (a defensible reading of "the row's own amount column", which is
 * what the prompt used to ask for) turned 1 × 338.00 into a red row on a
 * perfectly correct read. That is worse than no check: the reviewer's whole job
 * here is to look where we point, and pointing at correct rows is how they stop
 * looking. The prompt now names the three columns separately, and this asks the
 * row TWO questions instead of one:
 *
 *   1. `line_math` — does quantity × unit price reach the row's NET?
 *   2. `vat_total` — does net + VAT reach the row's printed INCLUSIVE total?
 *
 * They fail differently and they send the reviewer to different columns, so
 * they are reported separately rather than collapsed into "doesn't add up".
 * Question 1 is asked first: a wrong net makes question 2 meaningless, and
 * reporting the downstream symptom instead of the cause is how a transposed
 * digit gets "fixed" in the wrong column.
 *
 * WHAT COUNTS AS "THE NET" WHEN THERE ISN'T ONE. A row can print a total and a
 * VAT but no net — so net is taken as total − VAT, which is the only figure the
 * paper leaves us no choice about. A row printing a total and NOTHING else is
 * treated as the legacy single-column case and checked against directly; that
 * is defensive rather than expected (the prompt puts a lone money column in
 * `raw_amount`), and it keeps a reader that fills the wrong field from silently
 * disabling the check.
 *
 * NOTHING HERE IS EVER DERIVED FROM A RATE. `tax_rate` is transcribed for the
 * reviewer's eyes and never multiplied by: a VAT we computed ourselves would
 * agree with our own net by construction, and a cross-check that cannot fail is
 * not a cross-check.
 *
 * Tolerance is still `moneyMatches` — a cent, or 0.5%, whichever is kinder —
 * for both questions, and still line-audit.ts's, not a second opinion of our
 * own (see the module doc comment above).
 */
export function grossMismatch(line: OrderLineMoney, hint?: DecimalSeparator | null): GrossMismatch | null {
  if (parseAmount(line.quantity, asOpts(hint)) == null) return null;
  if (parseAmount(line.unit_price, asOpts(hint)) == null) return null;

  const net = parseAmount(line.raw_amount, asOpts(hint));
  const tax = lineTax(line, hint);
  const total = lineTotal(line, hint);
  // Nothing the paper printed to check against. The legacy silent case, and
  // still the commonest one: most orders carry no money columns at all.
  if (net == null && total == null) return null;

  const computed = lineGross(line, hint);
  const evidence = { tax, total };

  // --- 1. quantity × unit price against the row's net ----------------------
  // `paper` stays the NET whenever the paper printed one, so the sentence on
  // screen compares like with like: an inclusive total in this slot would read
  // as "this row comes to 338.00, the paper shows 388.70" on a row where both
  // figures are correct.
  if (net != null) {
    if (!moneyMatches(computed, net)) {
      return { reason: 'line_math', paper: net, gross: computed, difference: round2(computed - net), ...evidence };
    }
  } else if (tax != null) {
    // No net column, but the two figures that bracket it are both printed —
    // total − VAT is then the net, forced by the paper rather than chosen by us.
    const implied = round2(total! - tax);
    if (!moneyMatches(computed, implied)) {
      return { reason: 'line_math', paper: implied, gross: computed, difference: round2(computed - implied), ...evidence };
    }
  } else if (!moneyMatches(computed, total!)) {
    // A lone total, no VAT beside it: indistinguishable from the legacy
    // single-amount row, and checked exactly as that row has always been.
    return { reason: 'line_math', paper: total!, gross: computed, difference: round2(computed - total!), ...evidence };
  }

  // --- 2. net + VAT against the row's printed inclusive total --------------
  // Only askable when the paper printed BOTH ends of the sum. A missing VAT
  // column is read as "the page did not itemise it", not as zero — except that
  // here zero is also the only value that keeps the sum honest when a net and a
  // total are printed with nothing between them, and a genuine zero-rated row
  // (net 125.00, VAT 0.00, total 125.00) passes either way.
  if (net != null && total != null) {
    const inclusive = round2(net + (tax ?? 0));
    if (!moneyMatches(inclusive, total)) {
      return { reason: 'vat_total', paper: total, gross: inclusive, difference: round2(inclusive - total), ...evidence };
    }
  }

  return null;
}

/** One line of the footer reconciliation: what the paper says, what its own
 *  rows say, and whether the two meet. */
export interface DocumentTotalCheck {
  /** Plain words for the screen — "Subtotal", "Grand total". */
  label: string;
  /** What the document's own figures imply. */
  expected: number;
  /** What the footer printed. */
  actual: number;
  ok: boolean;
}

/**
 * Does the document's printed footer agree with the rows above it?
 *
 * TWO CHECKS, AND BOTH ARE SKIPPED RATHER THAN GUESSED AT:
 *
 *   (a) **Subtotal.** The line NETs, summed, against the printed subtotal. Only
 *       asked when a subtotal is printed AND at least one line carries a net —
 *       an order with no money columns has nothing to sum, and "R 0.00 ≠
 *       R 4 981.30" on such a document is a false alarm on every row at once.
 *
 *   (b) **Grand total.** subtotal + freight + VAT − discount against the
 *       printed grand total, using ONLY the components the page actually
 *       printed. A MISSING COMPONENT IS OMITTED FROM THE SUM, NEVER ZEROED,
 *       and that distinction is the whole reason this function exists in this
 *       shape: a page that prints a subtotal, a VAT line and a grand total but
 *       no freight line is not a page whose freight is zero — it is a page that
 *       said nothing about freight, and adding a zero we invented would fail
 *       the check on a document whose freight is simply folded into the
 *       subtotal. Skipped entirely unless a grand total AND at least one
 *       component are printed.
 *
 * Returns null when neither check could be asked, so the caller can render
 * nothing at all rather than an empty panel.
 *
 * Tolerance is `moneyMatches`, exactly as the per-row check uses — a footer
 * that "disagreed" by a cent while the rows agreed would be the two halves of
 * this screen contradicting each other, which is the failure the module
 * docblock above already refuses once.
 */
export function reconcileDocumentTotals(
  lines: OrderLineMoney[],
  totals: OrderDocumentTotals | null | undefined,
  hint?: DecimalSeparator | null,
): { checks: DocumentTotalCheck[] } | null {
  if (!totals) return null;
  const h = hint !== undefined ? hint : lineSeparatorHint(lines);
  const num = (v: string | null | undefined): number | null => parseAmount(v, asOpts(h));

  const subtotal = num(totals.subtotal);
  const taxTotal = num(totals.tax_total);
  const freight = num(totals.freight);
  const discount = num(totals.discount);
  const grandTotal = num(totals.grand_total);

  const checks: DocumentTotalCheck[] = [];

  // (a) The rows' own nets against the printed subtotal.
  const nets = lines.map((l) => parseAmount(l.raw_amount, asOpts(h))).filter((n): n is number => n != null);
  if (subtotal != null && nets.length > 0) {
    const summed = round2(nets.reduce((acc, n) => acc + n, 0));
    checks.push({
      label: 'Subtotal',
      expected: summed,
      actual: subtotal,
      ok: moneyMatches(summed, subtotal),
    });
  }

  // (b) The footer's own components against its own grand total. Built by
  // pushing only what is present — see the docblock on why a missing component
  // must not become a zero.
  if (grandTotal != null) {
    const parts: number[] = [];
    if (subtotal != null) parts.push(subtotal);
    if (freight != null) parts.push(freight);
    if (taxTotal != null) parts.push(taxTotal);
    if (discount != null) parts.push(-discount);
    if (parts.length > 0) {
      const built = round2(parts.reduce((acc, n) => acc + n, 0));
      checks.push({
        label: 'Grand total',
        expected: built,
        actual: grandTotal,
        ok: moneyMatches(built, grandTotal),
      });
    }
  }

  return checks.length > 0 ? { checks } : null;
}

/** How many of these lines disagree with the paper. For the review banner. */
export function countGrossMismatches(lines: OrderLineMoney[], hint?: DecimalSeparator | null): number {
  const h = hint !== undefined ? hint : lineSeparatorHint(lines);
  return lines.reduce((n, l) => n + (grossMismatch(l, h) ? 1 : 0), 0);
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
