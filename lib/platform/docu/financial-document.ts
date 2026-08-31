/**
 * Does an expense receipt's own arithmetic hold — and what, if anything, may we
 * say about cash as a result?
 *
 * WHY THIS EXISTS. The Country Club Johannesburg slip is the whole brief on one
 * page: a R583.10 meal, R60.00 gratuity, R643.10 settled, "VAT included
 * R76.06", and a member pre-fund that goes R2 454.68 → R1 811.58. Every one of
 * those figures is checkable against the others, and every one of them is a
 * place a reader can slip a digit. But the far more expensive mistakes on a
 * document like this are not arithmetic at all — they are the two claims it is
 * tempting to make and that the paper does not support:
 *
 *   1. **VAT is not something to add.** R76.06 is INCLUDED in R643.10. A reader
 *      that treats a till slip like a net invoice produces a R719.16 expense out
 *      of thin air, and it reconciles with nothing, so nothing catches it.
 *   2. **A receipt is not a bank statement.** The settlement drew down a
 *      PRE-FUNDED balance. The cash left the bank whenever that balance was
 *      topped up — a date this document does not print. Recognising the expense
 *      today is right; asserting a bank movement today is a fabrication that a
 *      bookkeeper then has to find and unpick. See `CashEffect` in
 *      lib/platform/types.ts: there is no value here that names a bank, on
 *      purpose.
 *
 * And one more, small enough to be missed and wrong enough to matter: **a
 * gratuity is not a tax.** R60.00 of service is not VAT, is not part of the VAT
 * figure, and is not deductible input tax. It is added to the goods to reach the
 * total and it appears in no other sum in this file.
 *
 * SKIP, DON'T ZERO — the same rule `reconcileDocumentTotals` follows, and for
 * the same reason. A check is asked only when the paper printed BOTH of the
 * figures it compares. A slip that prints no subtotal is not a slip whose
 * subtotal is R0.00; it is a slip that said nothing, and inventing the zero
 * would fail a check on a perfectly clean document. Every check here is
 * therefore conditional, and a receipt that prints only a total reconciles
 * silently and correctly by having nothing asked of it.
 *
 * NOTHING IS EVER CORRECTED. Both figures are reported — what the paper printed
 * and what its own parts come to — and the reviewer decides which is right,
 * exactly as the order editor does it. A guess that reconciles is the failure
 * mode, not the goal.
 *
 * Tolerance is `moneyMatches` — a cent, or half a percent, whichever is kinder —
 * imported from line-audit.ts rather than re-implemented, so this screen and the
 * invoice audit can never disagree about what "close enough" means.
 *
 * PURE. No I/O, no React, no Supabase. `.ts`-suffixed relative imports because
 * `node --test` resolves neither extensionless ESM specifiers nor the `@/`
 * alias, and this module is loaded directly by tests/docu-financial-document.test.ts.
 */
import type { CashEffect, ExtractedLineItem, FinancialDocument } from '../types.ts';
import { parseAmount } from './extract.ts';
import { moneyMatches } from './line-audit.ts';
import { inferDecimalSeparator, type DecimalSeparator } from '../locale-number.ts';

export type { CashEffect, FinancialDocument };

const round2 = (n: number): number => Math.round(n * 100) / 100;
const asOpts = (hint?: DecimalSeparator | null) => (hint ? { decimalSeparator: hint } : undefined);

/** The money-bearing subset of a receipt line. `amount` is the row's own printed
 *  total — the only figure of the three that the subtotal check reads. */
export type FinancialLine = Pick<ExtractedLineItem, 'quantity' | 'unit_price' | 'amount'>;

/**
 * ONE reading of this receipt's numeric format, from every money string it
 * carries — the header block AND the rows together.
 *
 * Exported for the same reason `lineSeparatorHint` is: a screen that formed its
 * own opinion could show a figure a second screen disagrees with, on a document
 * that is not itself ambiguous once all its numbers are read at once. A slip
 * printing "583,10" and "1 811,58" is unmistakable in aggregate and a coin toss
 * one figure at a time.
 */
export function financialSeparatorHint(
  fin: FinancialDocument | null | undefined,
  lines: FinancialLine[] = [],
): DecimalSeparator | null {
  const samples: Array<string | null | undefined> = [];
  if (fin) {
    samples.push(
      fin.subtotal,
      fin.gratuity,
      fin.tax_amount,
      fin.total,
      fin.opening_balance,
      fin.settlement_amount,
      fin.closing_balance,
    );
  }
  for (const l of lines) samples.push(l.quantity, l.unit_price, l.amount);
  return inferDecimalSeparator(samples);
}

/** One line of the receipt reconciliation: what the paper printed, what its own
 *  figures imply, and whether the two meet. Same shape and same honesty as
 *  `DocumentTotalCheck` — both numbers survive, neither is corrected. */
export interface FinancialCheck {
  /** Plain words for the screen — "Subtotal", "Total", "Closing balance". */
  label: string;
  /** What the receipt's other figures imply. */
  expected: number;
  /** What the receipt printed. */
  actual: number;
  ok: boolean;
}

/** The pre-fund movement, when the slip printed all three of its figures. */
export interface BalanceMovement {
  opening: number;
  settlement: number;
  closing: number;
  ok: boolean;
}

export interface FinancialReconciliation {
  /** Every check the paper gave us both halves of. Empty when it printed too
   *  little to ask anything — which is a clean receipt, not a broken one. */
  checks: FinancialCheck[];
  /** VAT exactly as printed, or null. Carried so the screen can say "VAT
   *  included R76.06" without parsing it a second time. */
  taxIncluded: number | null;
  /** Is the printed VAT consistent with being INSIDE the total? Null when
   *  either figure is absent — the question was not askable, which is not the
   *  same as it having passed. False is the alarming case: a VAT larger than the
   *  total it is supposedly inside means the two figures are not what we think.
   *
   *  This is a containment check and never an equality one. There is no
   *  arithmetic anywhere in this file that adds `tax_amount` to anything. */
  taxWithinTotal: boolean | null;
  /** The pre-fund drawdown, when all three balance figures were printed. */
  balance: BalanceMovement | null;
  /** The conservative cash claim — see `deriveCashEffect`. */
  cashEffect: CashEffect;
  /** True when every check that COULD be asked passed. A receipt with no
   *  checkable figures is `true` for the same reason a document with no lines
   *  raises no line warnings: nothing disagreed. */
  ok: boolean;
}

/**
 * Did the pre-funded balance move the way the settlement says it did?
 *
 * `opening − settlement ≈ closing`, and the subtraction is the point: on a
 * pre-fund the settlement draws the balance DOWN, so 2 454.68 − 643.10 must
 * reach 1 811.58.
 *
 * THE SETTLEMENT IS EXPECTED UNSIGNED, and the prompt asks for it that way — the
 * amount actually settled, not the "-643.10" the slip prints in its balance
 * column. A signed reading fails this check and lands the document on `unknown`
 * rather than `prefund_drawdown`, which is the right direction to fail in:
 * `Math.abs` here would silently accept a sign we never verified, and a sign
 * error on a balance line is exactly the thing a reviewer needs to see rather
 * than have smoothed over.
 *
 * Returns null when any of the three is absent — skip, don't zero.
 */
function balanceMovement(fin: FinancialDocument, hint?: DecimalSeparator | null): BalanceMovement | null {
  const opening = parseAmount(fin.opening_balance, asOpts(hint));
  const settlement = parseAmount(fin.settlement_amount, asOpts(hint));
  const closing = parseAmount(fin.closing_balance, asOpts(hint));
  if (opening == null || settlement == null || closing == null) return null;
  const expected = round2(opening - settlement);
  return { opening, settlement, closing, ok: moneyMatches(expected, closing) };
}

/**
 * What may we say about cash? Almost always: nothing.
 *
 * `prefund_drawdown` requires the paper to have printed opening, settlement AND
 * closing figures AND for them to reconcile. That is a claim about a member
 * balance, which the slip is a primary record of — and it is the ONLY claim this
 * function will ever make.
 *
 * Everything else is `unknown`, INCLUDING the cases that feel obvious. A slip
 * stamped "CARD" tells us a card was presented; it does not tell us when the
 * acquirer settled, and a same-day bank movement inferred from it would be a
 * guess wearing a fact's clothing. There is no code path here that reads
 * `payment_method`, and that absence is deliberate — see `CashEffect`.
 */
export function deriveCashEffect(
  fin: FinancialDocument | null | undefined,
  hint?: DecimalSeparator | null,
): CashEffect {
  if (!fin) return 'unknown';
  const balance = balanceMovement(fin, hint);
  return balance?.ok ? 'prefund_drawdown' : 'unknown';
}

/**
 * Check an expense receipt against itself.
 *
 * FOUR EQUALITY CHECKS, each skipped rather than guessed at:
 *
 *   (a) **Subtotal.** The rows' own printed amounts, summed, against the printed
 *       subtotal. Asked only when a subtotal is printed AND at least one row
 *       carries an amount — a slip photographed too badly to yield rows has
 *       nothing to sum, and "R 0.00 ≠ R 583.10" on such a document is a false
 *       alarm that teaches the reviewer to stop reading warnings.
 *
 *   (b) **Total.** subtotal + gratuity against the printed total, using only
 *       what was printed: no gratuity line means the total is checked against
 *       the subtotal alone, because a slip that says nothing about service is
 *       not a slip whose service was R0.00 — though here the two happen to
 *       reconcile identically, which is why the omission is safe rather than
 *       merely convenient. VAT is NOT a component of this sum. It is already
 *       inside both sides of it.
 *
 *   (c) **Settlement.** The printed settlement against the printed total. These
 *       are usually the same number twice, and that is exactly what makes the
 *       check worth asking: when they differ, either the slip settled a
 *       different amount than it billed (a part-payment, a rounding, a tip added
 *       at the terminal) or one of the two was misread, and both are things a
 *       reviewer must see rather than have averaged away.
 *
 *   (d) **Closing balance.** opening − settlement against the printed closing —
 *       see `balanceMovement`. This is also the sole gate on `prefund_drawdown`.
 *
 * AND ONE CHECK THAT IS NOT AN EQUALITY. `tax_amount` on a South African till
 * slip is VAT ALREADY INSIDE the total, so the only sane question is whether it
 * is smaller than the total it claims to be inside. It is reported as
 * `taxWithinTotal` rather than pushed into `checks`, because rendering it as
 * "expected 643.10 vs actual 76.06" would read as a failed sum on a correct
 * document, and a reviewer who is shown one of those stops trusting the rest.
 * Nowhere in this function is `tax_amount` added to anything.
 *
 * `hint` is the document-level separator. Omit it and one is inferred from this
 * receipt's own figures; pass it when the caller already formed one, so the
 * card, the stamp and the tests all read "583,10" the same way.
 */
export function reconcileFinancialDocument(
  fin: FinancialDocument | null | undefined,
  lines: FinancialLine[] = [],
  hint?: DecimalSeparator | null,
): FinancialReconciliation | null {
  if (!fin) return null;
  const h = hint !== undefined ? hint : financialSeparatorHint(fin, lines);
  const num = (v: string | null | undefined): number | null => parseAmount(v, asOpts(h));

  const subtotal = num(fin.subtotal);
  const gratuity = num(fin.gratuity);
  const tax = num(fin.tax_amount);
  const total = num(fin.total);
  const settlement = num(fin.settlement_amount);

  const checks: FinancialCheck[] = [];

  // (a) The rows against the printed subtotal.
  const amounts = lines.map((l) => num(l.amount)).filter((n): n is number => n != null);
  if (subtotal != null && amounts.length > 0) {
    const summed = round2(amounts.reduce((acc, n) => acc + n, 0));
    checks.push({ label: 'Subtotal', expected: summed, actual: subtotal, ok: moneyMatches(summed, subtotal) });
  }

  // (b) Goods + service against the printed total. Built by pushing only what
  // is present — the same construction as `reconcileDocumentTotals`, and note
  // what is NOT pushed: the VAT.
  if (total != null && subtotal != null) {
    const built = round2(subtotal + (gratuity ?? 0));
    checks.push({ label: 'Total', expected: built, actual: total, ok: moneyMatches(built, total) });
  }

  // (c) What was billed against what was settled.
  if (total != null && settlement != null) {
    checks.push({ label: 'Settlement', expected: total, actual: settlement, ok: moneyMatches(total, settlement) });
  }

  // (d) The pre-fund movement.
  const balance = balanceMovement(fin, h);
  if (balance) {
    checks.push({
      label: 'Closing balance',
      expected: round2(balance.opening - balance.settlement),
      actual: balance.closing,
      ok: balance.ok,
    });
  }

  return {
    checks,
    taxIncluded: tax,
    // Null, not false, when either figure is missing: "we could not ask" and
    // "we asked and it passed" are different states, and only one of them is
    // evidence about the document.
    taxWithinTotal: tax != null && total != null ? tax < total : null,
    balance,
    cashEffect: balance?.ok ? 'prefund_drawdown' : 'unknown',
    ok: checks.every((c) => c.ok) && (tax == null || total == null || tax < total),
  };
}
