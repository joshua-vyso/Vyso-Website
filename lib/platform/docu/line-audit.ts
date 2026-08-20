/**
 * Post-extraction arithmetic audit for a document's line items.
 *
 * WHY THIS EXISTS. A photographed, skewed invoice tempts a vision model into
 * reading the price columns off the WRONG ROW: every description is right, but
 * each line carries the neighbouring row's rate and/or amount. The failure is
 * systematic and — crucially — machine-detectable, because on a shifted table
 * `quantity × unit price` stops equalling `amount` on nearly every line, while
 * on a correctly-read table it holds on nearly all of them.
 *
 * So: check the arithmetic on every line; if almost everything fails, try
 * sliding the price/amount columns by a row or two and see whether almost
 * everything then passes. If it does, that is not a coincidence — it is the
 * misalignment, and the slide is the repair. If it does not, we say so and
 * stop: a document whose numbers do not add up is a document for a human, and
 * guessing at it would be worse than flagging it.
 *
 * PURE. No I/O, no Supabase, no model calls — it takes lines in and returns
 * verdicts plus (when it is confident) repaired lines. The caller decides what
 * to do with them; see `lib/ai/anthropic.ts` for the wiring.
 */
import { parseAmount } from './extract.ts';

// --- tolerances & thresholds ------------------------------------------------

/** A line reconciles if it is within a cent, or within 0.5% — whichever is kinder.
 *  The absolute leg carries small lines; the relative leg carries big ones, where
 *  a printed amount is often rounded off the true product. */
export const TOLERANCE_ABSOLUTE = 0.01;
export const TOLERANCE_RELATIVE = 0.005;

/** A row shift is only *considered* once this share of checkable lines fails. */
export const SHIFT_SUSPICION_RATE = 0.6;
/** …and only *accepted* once this share of all lines reconciles after the slide. */
export const SHIFT_ACCEPT_RATE = 0.8;
/** How far the columns are allowed to have slid. Real misreads are 1–2 rows. */
export const MAX_SHIFT = 2;
/** Too few lines and "80% pass" means nothing. */
export const MIN_LINES_FOR_SHIFT = 3;

/** Confidence ceilings. Both sit under DOC_LOW_CONFIDENCE_THRESHOLD (80) so an
 *  audited document always lands in the review queue rather than sailing past it. */
export const REPAIRED_CONFIDENCE_CAP = 75;
export const LINE_MATH_CONFIDENCE_CAP = 70;

/** South African VAT — used only to test whether an extracted total is the
 *  VAT-inclusive view of the line sum. */
export const VAT_RATE = 0.15;

// --- shapes -----------------------------------------------------------------

/** The subset of `ExtractedLineItem` this audit reads. Structural on purpose so
 *  callers keep their own richer line type through the repair. */
export interface AuditableLine {
  description?: string;
  quantity?: string;
  /** Per-pack weight in kg (the extractor normalises "300G" → "0.3"). */
  weight?: string;
  /** weight × quantity, when the extractor could work it out. */
  total_kg?: string;
  unit?: string;
  unit_price?: string;
  amount?: string;
}

export type LineStatus = 'ok' | 'mismatch' | 'unchecked';

/** Which multiplier the line is priced by. */
export type PriceBasis = 'quantity' | 'total_kg' | 'weight';

export interface LineVerdict {
  /** 0-based index into the line array. */
  index: number;
  /** 1-based, for humans — this is the row number a reviewer counts on paper. */
  row: number;
  description: string;
  status: LineStatus;
  /** The multiplier that reconciled ('ok'), or the one we tried ('mismatch'). */
  basis: PriceBasis | null;
  /** multiplier × unit_price. */
  expected: number | null;
  /** The amount as extracted. */
  actual: number | null;
  /** expected − actual. */
  difference: number | null;
}

export interface ColumnShift {
  /** Rows to pull the unit-price column UP by: repaired[i] takes extracted[i + n]. */
  unit_price: number;
  /** Same, for the amount column. */
  amount: number;
}

export type TotalBasis = 'match' | 'match_incl_vat' | 'mismatch' | 'unknown';

export interface TotalCheck {
  /** The document total handed in, if any. */
  total: number | null;
  /** Sum of the (post-repair) line amounts. */
  lineSum: number;
  basis: TotalBasis;
  /** total − lineSum, on the basis chosen. */
  difference: number | null;
}

/** A price/amount pair the repair left behind — it belonged to no line. */
export interface OrphanPair {
  index: number;
  unit_price: string | null;
  amount: string | null;
}

export type AuditDiagnosis = 'clean' | 'row_shift' | 'line_math' | 'not_enough_data';

export interface LineAudit<T extends AuditableLine = AuditableLine> {
  diagnosis: AuditDiagnosis;
  /** Lines with enough numbers to check at all. */
  checked: number;
  passed: number;
  failed: number;
  /** failed / checked, 0 when nothing was checkable. */
  failRate: number;
  /** Verdicts on the lines as finally returned (repaired, when a repair was made). */
  verdicts: LineVerdict[];
  /** 1-based rows that still do not add up. What the review UI lists. */
  failingRows: number[];
  /** Set when `diagnosis === 'row_shift'`. */
  shift: ColumnShift | null;
  /** The realigned lines, or null when nothing was repaired. */
  repaired: T[] | null;
  /** Rows (1-based) the slide could not give a price/amount back to. */
  unresolvedRows: number[];
  /** Whether the last missing amount was reconstructed from the document total. */
  reconstructedFromTotal: boolean;
  orphans: OrphanPair[];
  totalCheck: TotalCheck;
  /** Ceiling to clamp the document's overall confidence to, or null to leave it. */
  confidenceCap: number | null;
  /** One plain sentence for a flag detail / review note, or null when clean. */
  note: string | null;
}

export interface AuditInput<T extends AuditableLine> {
  lines: T[];
  /** The document's own total, if one was extracted. Enables the sum cross-check
   *  and lets a single unrecoverable amount be reconstructed as the residual. */
  total?: number | null;
}

// --- helpers ----------------------------------------------------------------

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Do two money figures agree, within a cent or within 0.5%? */
export function moneyMatches(expected: number, actual: number): boolean {
  const diff = Math.abs(expected - actual);
  return diff <= TOLERANCE_ABSOLUTE || diff <= Math.abs(actual) * TOLERANCE_RELATIVE;
}

/** The multipliers a line could legitimately be priced by, best guess first. */
function multipliers(line: AuditableLine): { basis: PriceBasis; value: number }[] {
  const qty = parseAmount(line.quantity);
  const weight = parseAmount(line.weight);
  const totalKg = parseAmount(line.total_kg) ?? (weight != null && qty != null ? weight * qty : null);
  const byWeightFirst = (line.unit ?? '').trim().toLowerCase() === 'kg';

  const out: { basis: PriceBasis; value: number }[] = [];
  const pushQty = () => { if (qty != null) out.push({ basis: 'quantity', value: qty }); };
  const pushKg = () => { if (totalKg != null) out.push({ basis: 'total_kg', value: totalKg }); };
  if (byWeightFirst) { pushKg(); pushQty(); } else { pushQty(); pushKg(); }
  // A single pack priced by its own weight (quantity 1 and no total_kg).
  if (weight != null && !out.some((m) => m.value === weight)) out.push({ basis: 'weight', value: weight });
  return out;
}

/** The multiplier used when deriving a missing figure — the line's primary basis. */
function primaryMultiplier(line: AuditableLine): { basis: PriceBasis; value: number } | null {
  return multipliers(line)[0] ?? null;
}

/** Check one line's arithmetic. */
export function auditLine(line: AuditableLine, index: number): LineVerdict {
  const description = (line.description ?? '').trim();
  const price = parseAmount(line.unit_price);
  const actual = parseAmount(line.amount);
  const options = multipliers(line);

  if (price == null || actual == null || options.length === 0) {
    return { index, row: index + 1, description, status: 'unchecked', basis: null, expected: null, actual, difference: null };
  }

  for (const m of options) {
    const expected = m.value * price;
    if (moneyMatches(expected, actual)) {
      return {
        index, row: index + 1, description, status: 'ok', basis: m.basis,
        expected: round2(expected), actual, difference: round2(expected - actual),
      };
    }
  }

  const primary = options[0];
  const expected = primary.value * price;
  return {
    index, row: index + 1, description, status: 'mismatch', basis: primary.basis,
    expected: round2(expected), actual, difference: round2(expected - actual),
  };
}

/** Slide the price/amount columns. `repaired[i]` takes `lines[i + shift.<col>]`. */
export function applyShift<T extends AuditableLine>(lines: T[], shift: ColumnShift): T[] {
  return lines.map((line, i) => ({
    ...line,
    unit_price: lines[i + shift.unit_price]?.unit_price ?? '',
    amount: lines[i + shift.amount]?.amount ?? '',
  }));
}

/** Every shift worth trying, gentlest first (and symmetric shifts before skewed
 *  ones at the same magnitude — a whole table sliding as one unit is the commoner
 *  misread, so it should win a tie). */
function shiftCandidates(): ColumnShift[] {
  const out: ColumnShift[] = [];
  for (let n = -MAX_SHIFT; n <= MAX_SHIFT; n += 1) {
    for (let m = -MAX_SHIFT; m <= MAX_SHIFT; m += 1) {
      if (n === 0 && m === 0) continue;
      out.push({ unit_price: n, amount: m });
    }
  }
  const cost = (s: ColumnShift) =>
    Math.abs(s.unit_price) + Math.abs(s.amount) + (s.unit_price === s.amount ? 0 : 0.5);
  return out.sort((a, b) => cost(a) - cost(b));
}

/** Fill a hole the slide left, but only where arithmetic forces the answer:
 *  a line with a quantity and exactly one of (price, amount) implies the other. */
function fillDerivable<T extends AuditableLine>(lines: T[]): T[] {
  return lines.map((line) => {
    const price = parseAmount(line.unit_price);
    const amount = parseAmount(line.amount);
    const m = primaryMultiplier(line);
    if (m == null || m.value === 0) return line;
    if (price != null && amount == null) return { ...line, amount: round2(m.value * price).toFixed(2) };
    if (amount != null && price == null) return { ...line, unit_price: round2(amount / m.value).toFixed(2) };
    return line;
  });
}

/** Compare the line sum against the document total, allowing for VAT. */
export function checkTotal(lineSum: number, total: number | null | undefined): TotalCheck {
  const sum = round2(lineSum);
  if (total == null) return { total: null, lineSum: sum, basis: 'unknown', difference: null };
  if (moneyMatches(sum, total)) return { total, lineSum: sum, basis: 'match', difference: round2(total - sum) };
  if (moneyMatches(sum * (1 + VAT_RATE), total)) {
    return { total, lineSum: sum, basis: 'match_incl_vat', difference: round2(total / (1 + VAT_RATE) - sum) };
  }
  return { total, lineSum: sum, basis: 'mismatch', difference: round2(total - sum) };
}

/** Pairs the slide consumed from nowhere / left behind. */
function findOrphans(lines: AuditableLine[], shift: ColumnShift): OrphanPair[] {
  const usedPrice = new Set<number>();
  const usedAmount = new Set<number>();
  for (let i = 0; i < lines.length; i += 1) {
    usedPrice.add(i + shift.unit_price);
    usedAmount.add(i + shift.amount);
  }
  const out: OrphanPair[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const price = usedPrice.has(i) ? null : (lines[i].unit_price ?? null);
    const amount = usedAmount.has(i) ? null : (lines[i].amount ?? null);
    if (parseAmount(price) != null || parseAmount(amount) != null) {
      out.push({ index: i, unit_price: price || null, amount: amount || null });
    }
  }
  return out;
}

const sumAmounts = (lines: AuditableLine[]): number =>
  round2(lines.reduce((acc, l) => acc + (parseAmount(l.amount) ?? 0), 0));

function tally(verdicts: LineVerdict[]) {
  const checked = verdicts.filter((v) => v.status !== 'unchecked').length;
  const passed = verdicts.filter((v) => v.status === 'ok').length;
  const failed = verdicts.filter((v) => v.status === 'mismatch').length;
  return { checked, passed, failed, failRate: checked === 0 ? 0 : failed / checked };
}

// --- the audit --------------------------------------------------------------

/**
 * Audit a document's lines: per-line verdicts, a document-level diagnosis, and
 * — when the numbers say a whole column slid — the realigned lines.
 */
export function auditLines<T extends AuditableLine>(input: AuditInput<T>): LineAudit<T> {
  const lines = input.lines ?? [];
  const total = input.total ?? null;

  const base = lines.map((l, i) => auditLine(l, i));
  const stats = tally(base);

  const clean = (diagnosis: AuditDiagnosis, note: string | null, cap: number | null): LineAudit<T> => ({
    diagnosis,
    ...stats,
    verdicts: base,
    failingRows: base.filter((v) => v.status === 'mismatch').map((v) => v.row),
    shift: null,
    repaired: null,
    unresolvedRows: [],
    reconstructedFromTotal: false,
    orphans: [],
    totalCheck: checkTotal(sumAmounts(lines), total),
    confidenceCap: cap,
    note,
  });

  if (stats.checked === 0) return clean('not_enough_data', null, null);
  if (stats.failed === 0) return clean('clean', null, null);

  // Only a *systematic* failure looks like a slid column. One or two odd lines
  // is a different problem and must not be "repaired" by moving everything.
  const suspect =
    stats.failRate >= SHIFT_SUSPICION_RATE &&
    lines.length >= MIN_LINES_FOR_SHIFT &&
    stats.checked >= MIN_LINES_FOR_SHIFT;

  if (suspect) {
    let best: { shift: ColumnShift; lines: T[]; passed: number } | null = null;
    for (const shift of shiftCandidates()) {
      const shifted = applyShift(lines, shift);
      const passed = shifted.map((l, i) => auditLine(l, i)).filter((v) => v.status === 'ok').length;
      if (passed / lines.length >= SHIFT_ACCEPT_RATE && (best == null || passed > best.passed)) {
        best = { shift, lines: shifted, passed };
      }
    }

    if (best) {
      // The slide is established. Now close the holes it left — but only where
      // the arithmetic leaves no choice.
      let repaired = fillDerivable(best.lines);
      let reconstructedFromTotal = false;

      // Exactly one amount still missing and a document total on hand: the
      // residual IS that amount. (Assumes the extracted total is on the same
      // basis as the line sum — the note says the columns were realigned and
      // the confidence cap puts the document in front of a human either way.)
      const missing = repaired.map((l, i) => (parseAmount(l.amount) == null ? i : -1)).filter((i) => i >= 0);
      if (missing.length === 1 && total != null) {
        const known = sumAmounts(repaired);
        const residual = round2(total - known);
        if (residual > 0) {
          const i = missing[0];
          const m = primaryMultiplier(repaired[i]);
          repaired = repaired.map((l, j) =>
            j === i
              ? {
                  ...l,
                  amount: residual.toFixed(2),
                  unit_price:
                    parseAmount(l.unit_price) == null && m != null && m.value !== 0
                      ? round2(residual / m.value).toFixed(2)
                      : l.unit_price,
                }
              : l,
          );
          reconstructedFromTotal = true;
        }
      }

      const verdicts = repaired.map((l, i) => auditLine(l, i));
      const after = tally(verdicts);
      const unresolvedRows = verdicts.filter((v) => v.status === 'unchecked').map((v) => v.row);
      const failingRows = verdicts.filter((v) => v.status === 'mismatch').map((v) => v.row);

      const bits = [
        `The price and amount columns were read out of line with the products (${describeShift(best.shift)}) — columns were re-aligned automatically. Worth an eye.`,
      ];
      if (reconstructedFromTotal) bits.push('The last amount was reconstructed from the document total.');
      if (unresolvedRows.length > 0) bits.push(`Row${unresolvedRows.length === 1 ? '' : 's'} ${unresolvedRows.join(', ')} could not be recovered.`);
      if (failingRows.length > 0) bits.push(`Row${failingRows.length === 1 ? '' : 's'} ${failingRows.join(', ')} still do not add up.`);

      return {
        diagnosis: 'row_shift',
        ...after,
        verdicts,
        failingRows,
        shift: best.shift,
        repaired,
        unresolvedRows,
        reconstructedFromTotal,
        orphans: findOrphans(lines, best.shift),
        totalCheck: checkTotal(sumAmounts(repaired), total),
        confidenceCap: REPAIRED_CONFIDENCE_CAP,
        note: bits.join(' '),
      };
    }
  }

  // Arithmetic is off and no clean slide explains it. Do NOT guess — say so.
  const failingRows = base.filter((v) => v.status === 'mismatch').map((v) => v.row);
  const note =
    `Quantity × unit price does not match the amount on ` +
    `${failingRows.length} of ${stats.checked} line${stats.checked === 1 ? '' : 's'} ` +
    `(row${failingRows.length === 1 ? '' : 's'} ${failingRows.join(', ')}). Check these against the paper document.`;
  return clean('line_math', note, LINE_MATH_CONFIDENCE_CAP);
}

/** "+1", or "price +1, amount +2" when the two columns moved differently. */
export function describeShift(shift: ColumnShift): string {
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
  return shift.unit_price === shift.amount
    ? `${sign(shift.unit_price)} row`
    : `price ${sign(shift.unit_price)}, amount ${sign(shift.amount)}`;
}

// --- storage ----------------------------------------------------------------

/**
 * The compact, snake_cased view of an audit that gets persisted alongside the
 * lines in `documents.extracted_data.line_audit`. Deliberately small: the review
 * UI needs the diagnosis, the note and the row numbers, and nothing else earns
 * a place in a jsonb column that is read on every document open.
 */
export interface LineAuditSummary {
  diagnosis: AuditDiagnosis;
  /** Rows (1-based) whose quantity × unit price still does not equal the amount. */
  failing_rows: number[];
  /** Rows (1-based) left without a price or amount after a repair. */
  unresolved_rows: number[];
  checked: number;
  failed: number;
  /** Present only when a repair was applied. */
  shift: ColumnShift | null;
  repaired: boolean;
  reconstructed_from_total: boolean;
  total_basis: TotalBasis;
  note: string | null;
}

/** Reduce a full audit to what is worth storing, or null when nothing happened. */
export function summariseAudit(audit: LineAudit): LineAuditSummary | null {
  if (audit.diagnosis === 'clean' || audit.diagnosis === 'not_enough_data') return null;
  return {
    diagnosis: audit.diagnosis,
    failing_rows: audit.failingRows,
    unresolved_rows: audit.unresolvedRows,
    checked: audit.checked,
    failed: audit.failed,
    shift: audit.shift,
    repaired: audit.repaired != null,
    reconstructed_from_total: audit.reconstructedFromTotal,
    total_basis: audit.totalCheck.basis,
    note: audit.note,
  };
}
