/**
 * TOTAL-FIRST arithmetic for one row of an uploaded customer ORDER.
 *
 * WHY THIS EXISTS. A NebulaPOS purchase order prints FOUR numbers per row and
 * only three of them are independent:
 *
 *     BULK  B/UNIT   UNIT QTY  UNIT   UNIT COST   NETT
 *      4     Box        48     Each     15.75     756.00
 *
 * That row says "four boxes, forty-eight avocados, fifteen seventy-five each,
 * seven hundred and fifty-six rand". Every reader we have pointed at it — Haiku,
 * then Sonnet — has read the columns correctly and then paired the WRONG two:
 * "Avocado 4.00 boxes @ 15.75 = R63". R63 for four boxes of avocados. The
 * characters were right and the semantics were wrong, and no amount of
 * transcription discipline fixes that, because the mistake is not a misread — it
 * is a wrong assumption about which column multiplies which.
 *
 * THE DOCUMENT ALREADY KNOWS THE ANSWER. It printed the nett. So we do not ask a
 * model which columns pair; we ask the ROW, by trying every pairing the layout
 * admits and keeping the one that reproduces the printed total:
 *
 *     48 × 15.75 = 756.00  ← the paper says 756.00. This one.
 *      4 × 15.75 =  63.00
 *  4 × 48 × 15.75 = 3024.00
 *
 * One hypothesis reconciles, so it wins, and the row is populated from it:
 * quantity 48, unit "Each", unit price 15.75. This is not a guess dressed as a
 * fact — it is the only reading of the row that is arithmetically consistent
 * with what the document itself printed, which is a stronger warrant than any
 * reader's opinion of the column headings.
 *
 * WHEN NOTHING RECONCILES WE CHANGE NOTHING. The row keeps exactly what was
 * extracted and `grossMismatch` (order-line-totals.ts) puts the red ring on it
 * for a human. A row we cannot explain is a question, and quietly rewriting it
 * into agreement with the total is precisely how R13,457.60 was invoiced as
 * R25,958.95. The tolerance is `moneyMatches` — the same cent-or-half-a-percent
 * the invoice audit uses — because two checks that disagreed about "close
 * enough" would be worse than one.
 *
 * PROVIDER-AGNOSTIC. This runs post-extraction over whatever the reader returned,
 * Luna or Claude. It is arithmetic, not reading.
 *
 * PURE. No I/O, no React, no model calls. `.ts`-suffixed relative imports:
 * `node --test` strips types but resolves neither extensionless ESM specifiers
 * nor the `@/` alias, and tests/docu-row-arithmetic.test.ts loads this directly.
 */
import { parseAmount } from './extract.ts';
import { moneyMatches } from './line-audit.ts';
import { inferDecimalSeparator, type DecimalSeparator } from '../locale-number.ts';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const asOpts = (hint?: DecimalSeparator | null) => (hint ? { decimalSeparator: hint } : undefined);

/**
 * The candidate numbers a row offers, exactly as the reader transcribed them.
 *
 * All strings, all optional, all possibly blank — this is what came off a
 * photograph. Nothing here has been decided yet.
 */
export interface RowNumbers {
  /** The outer/pack quantity column ("4"). */
  bulk_quantity?: string | null;
  /** The unit that `bulk_quantity` counts ("Box"). */
  bulk_unit?: string | null;
  /** The inner/each quantity column ("48"). */
  unit_quantity?: string | null;
  /** The unit that `unit_quantity` counts ("Each"). */
  unit?: string | null;
  /** The row's headline quantity, on the many orders that print only one column. */
  quantity?: string | null;
  /** The UNIT COST column. Which quantity it is a cost *per* is the question. */
  unit_price?: string | null;
  /** The same unit cost verbatim, before canonical numeric formatting. */
  raw_unit_price?: string | null;
  /** The NETT / AMOUNT column, copied off the paper. The arbiter. */
  raw_amount?: string | null;
  /** WRITTEN, never read: which pairing won, stamped by `applyRowArithmetic` so
   *  the decision is inspectable after the fact rather than a silent rewrite. */
  arithmetic_basis?: string | null;
  /** Whether the final headline quantity was printed, derived from the row's
   *  own price/total, or could not be established. */
  quantity_source?: 'printed' | 'derived' | 'unresolved' | null;
}

/**
 * Which pairing of columns reproduced the printed total.
 *
 * `quantity` is the ordinary single-column row and is the common case by far;
 * the other three exist because one purchase-order family prints two quantity
 * columns and a cost that belongs to exactly one of them.
 */
export type ArithmeticBasis =
  /** unit_quantity × unit_price — a cost printed per EACH. */
  | 'unit_quantity'
  /** bulk_quantity × unit_price — a cost printed per BOX. */
  | 'bulk_quantity'
  /** bulk_quantity × unit_quantity × unit_price — a cost per each, billed per box. */
  | 'bulk_times_unit'
  /** quantity × unit_price — the ordinary row, and the one we hope for. */
  | 'quantity'
  /** raw_amount ÷ unit_price, used only when the document printed no quantity. */
  | 'amount_divided_by_unit_price';

/** What the row resolved to, or why it did not. */
export interface RowArithmetic {
  /** The winning pairing, or null when nothing reproduced the printed total. */
  basis: ArithmeticBasis | null;
  /** True only when a hypothesis reconciled with the paper's own nett. */
  resolved: boolean;
  /** The quantity the winning pairing multiplied. Null when unresolved. */
  quantity: number | null;
  /** The unit that quantity is counted in, when the row named one. */
  unit: string | null;
  /** The price per one of `quantity`. Null when unresolved. */
  unit_price: number | null;
  /** The total the winning pairing produced — equal, within tolerance, to the paper. */
  total: number | null;
  /** The paper's own printed nett, when it printed one. */
  paper: number | null;
}

const UNRESOLVED: RowArithmetic = {
  basis: null,
  resolved: false,
  quantity: null,
  unit: null,
  unit_price: null,
  total: null,
  paper: null,
};

/**
 * Test every pairing this row admits against the total the row itself printed,
 * and return the one that reproduces it.
 *
 * ORDER MATTERS ONLY FOR TIES. Two hypotheses can reconcile at once — a row
 * whose bulk and unit quantities are both 1, say — and in that case they agree
 * about the money and disagree about nothing that reaches an invoice, so the
 * first is taken. The order below runs the ordinary single-column row FIRST,
 * because the overwhelming majority of order lines are that and a two-column
 * hypothesis that happened to tie must never displace it.
 *
 * Returns an unresolved result — and therefore leaves the row alone — whenever
 * the question cannot fairly be asked: no printed nett, no unit price, or no
 * quantity of any kind.
 */
export function resolveRowArithmetic(row: RowNumbers, hint?: DecimalSeparator | null): RowArithmetic {
  const paper = parseAmount(row.raw_amount, asOpts(hint));
  const price = parseAmount(row.raw_unit_price || row.unit_price, asOpts(hint));
  if (paper == null || price == null) return UNRESOLVED;

  const bulk = parseAmount(row.bulk_quantity, asOpts(hint));
  const unitQty = parseAmount(row.unit_quantity, asOpts(hint));
  const qty = parseAmount(row.quantity, asOpts(hint));
  const unitName = (row.unit ?? '').trim() || null;
  const bulkUnitName = (row.bulk_unit ?? '').trim() || null;

  const hypotheses: { basis: ArithmeticBasis; qty: number | null; unit: string | null }[] = [
    // The ordinary row: one quantity column, one price, one total.
    { basis: 'quantity', qty, unit: unitName },
    // A cost printed per EACH against a separate each column — the Avocado row.
    { basis: 'unit_quantity', qty: unitQty, unit: unitName },
    // A cost printed per BOX against the bulk column.
    { basis: 'bulk_quantity', qty: bulk, unit: bulkUnitName ?? unitName },
    // A cost per each, billed across every each in every box.
    {
      basis: 'bulk_times_unit',
      qty: bulk != null && unitQty != null ? round2(bulk * unitQty) : null,
      unit: unitName,
    },
  ];

  for (const h of hypotheses) {
    if (h.qty == null || h.qty === 0) continue;
    const total = round2(h.qty * price);
    if (!moneyMatches(total, paper)) continue;
    return {
      basis: h.basis,
      resolved: true,
      quantity: h.qty,
      unit: h.unit,
      unit_price: price,
      total,
      paper,
    };
  }

  return { ...UNRESOLVED, paper };
}

/**
 * Apply the resolver to one extracted line, returning the line with `quantity`,
 * `unit` and `unit_price` populated from whichever pairing reproduced the total.
 *
 * WHAT IT WILL NOT DO:
 *
 *   • It never touches `raw_description`, `raw_amount` or `description`. Those
 *     are the record of the document; this pass is about which numbers multiply.
 *   • It derives a missing quantity only from the row's own printed total ÷
 *     printed unit price, reconciles the rounded result back to that total, and
 *     labels it `quantity_source: derived` for review.
 *   • When nothing reconciles, all document evidence stays untouched; only the
 *     additive provenance label is written, and the review editor keeps the red
 *     ring/question visible.
 *   • It never overwrites a unit the reader read with one it did not. A blank
 *     unit is filled from the winning basis; a populated one stands.
 *
 * `arithmetic_basis` is stamped on the line so the decision is inspectable after
 * the fact rather than being a silent rewrite — the same reason
 * `extraction_model` exists.
 */
export function applyRowArithmetic<T extends RowNumbers>(
  line: T,
  hint?: DecimalSeparator | null,
): T & RowNumbers {
  const verdict = resolveRowArithmetic(line, hint);
  const hasPrintedQuantity = [line.quantity, line.bulk_quantity, line.unit_quantity]
    .some((value) => parseAmount(value, asOpts(hint)) != null);

  if (!verdict.resolved || verdict.quantity == null || verdict.unit_price == null) {
    // A quantity may be absent while the row still prints both independent
    // money witnesses. Derive from those only, round to the same precision the
    // UI stores, then reconcile back to the printed total before accepting it.
    if (!hasPrintedQuantity) {
      const paper = parseAmount(line.raw_amount, asOpts(hint));
      const price = parseAmount(line.raw_unit_price || line.unit_price, asOpts(hint));
      if (paper != null && price != null && price !== 0) {
        const quantity = round2(paper / price);
        if (quantity > 0 && moneyMatches(round2(quantity * price), paper)) {
          return {
            ...line,
            quantity: formatNumber(quantity),
            unit_price: formatNumber(price),
            arithmetic_basis: 'amount_divided_by_unit_price',
            quantity_source: 'derived',
          } as T & RowNumbers;
        }
      }
    }
    return {
      ...line,
      quantity_source: hasPrintedQuantity ? 'printed' : 'unresolved',
    } as T & RowNumbers;
  }

  const currentUnit = (line.unit ?? '').trim();
  // Cast: the three fields written are declared on `RowNumbers` and
  // `arithmetic_basis` is an optional string on every line shape that reaches
  // here. A structurally exact return type would buy nothing a caller can use.
  return {
    ...line,
    quantity: formatNumber(verdict.quantity),
    unit: currentUnit || verdict.unit || '',
    unit_price: formatNumber(verdict.unit_price),
    arithmetic_basis: verdict.basis,
    quantity_source: 'printed',
  } as T & RowNumbers;
}

/** Every line of a document, total-first. Infers the document's decimal
 *  separator ONCE from every row's numeric fields and applies that one reading
 *  throughout — a single row's "756,00" is not enough evidence on its own, but
 *  the whole purchase order usually is. */
export function applyRowArithmeticToLines<T extends RowNumbers>(lines: T[]): Array<T & RowNumbers> {
  const samples: Array<string | null | undefined> = [];
  for (const l of lines) {
    samples.push(
      l.bulk_quantity,
      l.unit_quantity,
      l.quantity,
      l.raw_unit_price,
      l.unit_price,
      l.raw_amount,
    );
  }
  const hint = inferDecimalSeparator(samples);
  return lines.map((l) => applyRowArithmetic(l, hint));
}

/** A plain numeric string: integers stay integers, money keeps its cents. */
function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round2(n));
}
