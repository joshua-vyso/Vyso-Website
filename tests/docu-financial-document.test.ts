import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deriveCashEffect,
  financialSeparatorHint,
  reconcileFinancialDocument,
} from '../lib/platform/docu/financial-document.ts';
import { EXPENSE_CATEGORIES, coerceExpenseCategory } from '../lib/platform/docu/expense-categories.ts';
import type { FinancialDocument } from '../lib/platform/types.ts';

// ---------------------------------------------------------------------------
// The Country Club Johannesburg slip.
//
// A R583.10 lunch, R60.00 of service, R643.10 settled, "VAT included R76.06",
// paid by drawing a member pre-fund down from R2 454.68 to R1 811.58. Every
// figure on it is checkable against the others, and the two mistakes that cost
// real money are not arithmetic at all:
//
//   - adding the R76.06 to the R643.10 (it is already inside it), and
//   - reading "settled today" as "left the bank today" (it did not — the bank
//     movement was whenever that pre-fund was topped up, a date this paper does
//     not print).
//
// This suite is those two refusals, plus the arithmetic.
// ---------------------------------------------------------------------------

/** The receipt exactly as printed. Verbatim strings, "" where the slip is
 *  silent — the contract `FinancialDocument` is built on. */
const COUNTRY_CLUB: FinancialDocument = {
  merchant: 'The Country Club Johannesburg',
  receipt_reference: 'BILL 004471',
  receipt_datetime: '30 Aug 2026',
  member_or_account: 'Member 10482',
  subtotal: '583.10',
  gratuity: '60.00',
  tax_amount: '76.06',
  total: '643.10',
  currency: 'R',
  payment_method: 'Member account',
  funding_account: 'Member pre-fund',
  opening_balance: '2,454.68',
  settlement_amount: '643.10',
  closing_balance: '1,811.58',
  notes: '',
  expense_category: 'Meals & entertainment',
  cash_effect: 'prefund_drawdown',
};

const COUNTRY_CLUB_LINES = [
  { description: 'GB Carvery', quantity: '1', unit_price: '501.50', amount: '501.50', confidence: 96 },
  { description: 'Coke Zero 300ml', quantity: '2', unit_price: '23.80', amount: '47.60', confidence: 95 },
  { description: 'Grapetiser 330ml', quantity: '1', unit_price: '34.00', amount: '34.00', confidence: 95 },
];

/** A check by label, or a failed assertion — reading `checks[2]` by index is how
 *  a suite starts passing for the wrong reason after a check is reordered. */
function check(recon: ReturnType<typeof reconcileFinancialDocument>, label: string) {
  const hit = recon?.checks.find((c) => c.label === label);
  assert.ok(hit, `expected a "${label}" check`);
  return hit;
}

// ---------------------------------------------------------------------------
// 8. The fixture reconciles, end to end.
// ---------------------------------------------------------------------------

test('the Country Club receipt reconciles against every figure it prints', () => {
  const recon = reconcileFinancialDocument(COUNTRY_CLUB, COUNTRY_CLUB_LINES);
  assert.ok(recon);

  // The three item amounts, summed, are the printed subtotal.
  assert.deepEqual(check(recon, 'Subtotal'), {
    label: 'Subtotal',
    expected: 583.1,
    actual: 583.1,
    ok: true,
  });

  // Goods + service = the printed total. VAT is NOT a component of this sum.
  assert.deepEqual(check(recon, 'Total'), {
    label: 'Total',
    expected: 643.1,
    actual: 643.1,
    ok: true,
  });

  // What was billed is what was settled.
  assert.deepEqual(check(recon, 'Settlement'), {
    label: 'Settlement',
    expected: 643.1,
    actual: 643.1,
    ok: true,
  });

  // The pre-fund moved by exactly the settlement.
  assert.deepEqual(check(recon, 'Closing balance'), {
    label: 'Closing balance',
    expected: 1811.58,
    actual: 1811.58,
    ok: true,
  });

  assert.equal(recon.checks.length, 4);
  assert.equal(recon.ok, true);
});

test('the VAT is carried as INCLUDED and is never added to anything', () => {
  const recon = reconcileFinancialDocument(COUNTRY_CLUB, COUNTRY_CLUB_LINES);
  assert.equal(recon?.taxIncluded, 76.06);
  assert.equal(recon?.taxWithinTotal, true);

  // The load-bearing assertion of this whole file: no check, anywhere, expects
  // or reports 643.10 + 76.06. A reader that treats a till slip like a net
  // invoice invents R719.16 of expense, and it reconciles with nothing.
  const inflated = 643.1 + 76.06;
  for (const c of recon!.checks) {
    assert.notEqual(c.expected, inflated, `"${c.label}" added the VAT to the total`);
    assert.notEqual(c.actual, inflated, `"${c.label}" added the VAT to the total`);
  }
});

// ---------------------------------------------------------------------------
// 9. The pre-fund drawdown — and the bank movement that is NOT asserted.
// ---------------------------------------------------------------------------

test('reconciling balances make the cash effect a pre-fund drawdown, and nothing more', () => {
  const recon = reconcileFinancialDocument(COUNTRY_CLUB, COUNTRY_CLUB_LINES);
  assert.equal(recon?.cashEffect, 'prefund_drawdown');
  assert.deepEqual(recon?.balance, {
    opening: 2454.68,
    settlement: 643.1,
    closing: 1811.58,
    ok: true,
  });
  // `deriveCashEffect` is the same answer reached independently — it is what
  // stamps the stored block at extraction time, and the card must not be able to
  // disagree with the stamp.
  assert.equal(deriveCashEffect(COUNTRY_CLUB, financialSeparatorHint(COUNTRY_CLUB, COUNTRY_CLUB_LINES)), 'prefund_drawdown');
});

test('NO bank cash outflow is asserted anywhere in the reconciliation', () => {
  const recon = reconcileFinancialDocument(COUNTRY_CLUB, COUNTRY_CLUB_LINES);
  // There are exactly two cash effects and neither of them names a bank. A
  // third value is the thing this test exists to stop being added quietly —
  // the moment one exists, somebody posts it to a cash account on the receipt's
  // own date, and the money left the bank on a different day entirely.
  assert.ok(recon?.cashEffect === 'prefund_drawdown' || recon?.cashEffect === 'unknown');
  const keys = Object.keys(recon!);
  for (const k of keys) {
    assert.doesNotMatch(k, /bank|outflow|paid_from_bank|cash_out/i, `"${k}" reads as a bank movement`);
  }
  // And the module itself never mentions one.
  const source = readFileSync(new URL('../lib/platform/docu/financial-document.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /'direct'|"direct"/, "a 'direct' cash effect was introduced");
});

// ---------------------------------------------------------------------------
// 10. A broken balance is reported, not smoothed over.
// ---------------------------------------------------------------------------

test('a closing balance that does not follow from the settlement is reported', () => {
  const broken: FinancialDocument = { ...COUNTRY_CLUB, closing_balance: '1,800.00' };
  const recon = reconcileFinancialDocument(broken, COUNTRY_CLUB_LINES);
  const balance = check(recon, 'Closing balance');
  assert.equal(balance.ok, false);
  // BOTH figures survive. Neither is corrected towards the other — we cannot
  // know whether the balance was misread or the settlement was.
  assert.equal(balance.expected, 1811.58);
  assert.equal(balance.actual, 1800);
  assert.equal(recon?.ok, false);
  // A balance that does not reconcile buys no cash claim at all.
  assert.equal(recon?.cashEffect, 'unknown');
});

test('a mis-summed line set is reported without disturbing the other checks', () => {
  const lines = [...COUNTRY_CLUB_LINES.slice(0, 2), { ...COUNTRY_CLUB_LINES[2], amount: '43.00' }];
  const recon = reconcileFinancialDocument(COUNTRY_CLUB, lines);
  assert.equal(check(recon, 'Subtotal').ok, false);
  assert.equal(check(recon, 'Subtotal').expected, 592.1);
  // The footer still adds up on its own terms — the failure is localised to the
  // check that could actually see it.
  assert.equal(check(recon, 'Total').ok, true);
  assert.equal(check(recon, 'Closing balance').ok, true);
  // …and it still drew down the pre-fund, because that is a different question.
  assert.equal(recon?.cashEffect, 'prefund_drawdown');
});

// ---------------------------------------------------------------------------
// 11. A card receipt with no balances.
// ---------------------------------------------------------------------------

test('a card receipt with no balances recognises the expense and asserts no cash movement', () => {
  const card: FinancialDocument = {
    merchant: 'Shell Rivonia',
    receipt_reference: '00219',
    receipt_datetime: '30 Aug 2026 07:14',
    member_or_account: '',
    subtotal: '500.00',
    gratuity: '',
    tax_amount: '65.22',
    total: '500.00',
    currency: 'R',
    payment_method: 'Card',
    funding_account: '',
    opening_balance: '',
    settlement_amount: '500.00',
    closing_balance: '',
    notes: '',
    expense_category: 'Fuel',
    cash_effect: 'unknown',
  };
  // Hoisted rather than passed inline: `FinancialLine` is the money-bearing
  // SUBSET of a line, so an inline literal carrying `description`/`confidence`
  // trips TypeScript's excess-property check. A real caller hands over whole
  // `ExtractedLineItem`s from a variable, which is exactly this shape.
  const fuelLines = [
    { description: 'Unleaded 95', quantity: '22.03', unit_price: '22.70', amount: '500.00', confidence: 92 },
  ];
  const recon = reconcileFinancialDocument(card, fuelLines);
  // The expense is fully recognised: R500.00, and it reconciles.
  assert.equal(check(recon, 'Total').actual, 500);
  assert.equal(check(recon, 'Settlement').ok, true);
  assert.equal(recon?.ok, true);
  // AND YET: no balance was printed, so no drawdown is claimed — and "Card" on
  // the slip buys nothing, because it says when a card was presented, not when
  // the acquirer settled.
  assert.equal(recon?.balance, null);
  assert.equal(recon?.cashEffect, 'unknown');
  assert.equal(deriveCashEffect(card), 'unknown');
  // No closing-balance check was invented out of the blank fields.
  assert.equal(recon?.checks.some((c) => c.label === 'Closing balance'), false);
});

// ---------------------------------------------------------------------------
// 12. The gratuity is never a tax, and the tax is never double-counted.
// ---------------------------------------------------------------------------

test('the gratuity is treated as goods, never as tax', () => {
  const recon = reconcileFinancialDocument(COUNTRY_CLUB, COUNTRY_CLUB_LINES);
  // R60.00 of service reaches the total through the Total check and appears in
  // no tax figure whatsoever.
  assert.equal(check(recon, 'Total').expected, 643.1);
  assert.equal(recon?.taxIncluded, 76.06);
  assert.notEqual(recon?.taxIncluded, 76.06 + 60);

  // With no VAT printed at all, nothing is invented and the sums are unchanged.
  const noVat: FinancialDocument = { ...COUNTRY_CLUB, tax_amount: '' };
  const reconNoVat = reconcileFinancialDocument(noVat, COUNTRY_CLUB_LINES);
  assert.equal(reconNoVat?.taxIncluded, null);
  assert.equal(reconNoVat?.taxWithinTotal, null, 'an unaskable question must not report as passed');
  assert.equal(check(reconNoVat, 'Total').expected, 643.1);
  assert.equal(reconNoVat?.ok, true);
});

test('a VAT larger than the total it claims to be inside is flagged', () => {
  const wrong: FinancialDocument = { ...COUNTRY_CLUB, tax_amount: '760.60' };
  const recon = reconcileFinancialDocument(wrong, COUNTRY_CLUB_LINES);
  assert.equal(recon?.taxWithinTotal, false);
  assert.equal(recon?.ok, false);
  // It is NOT reported as a failed equality check — "expected 643.10 vs actual
  // 760.60" would read as a broken sum on a document whose sums are fine.
  assert.equal(recon?.checks.every((c) => c.ok), true);
});

// ---------------------------------------------------------------------------
// 13. Comma-decimal receipts.
// ---------------------------------------------------------------------------

test('a comma-decimal receipt reads identically under the document-wide hint', () => {
  const comma: FinancialDocument = {
    ...COUNTRY_CLUB,
    subtotal: '583,10',
    gratuity: '60,00',
    tax_amount: '76,06',
    total: '643,10',
    opening_balance: '2454,68',
    settlement_amount: '643,10',
    closing_balance: '1811,58',
  };
  const lines = [
    { description: 'GB Carvery', quantity: '1', unit_price: '501,50', amount: '501,50', confidence: 96 },
    { description: 'Coke Zero 300ml', quantity: '2', unit_price: '23,80', amount: '47,60', confidence: 95 },
    { description: 'Grapetiser 330ml', quantity: '1', unit_price: '34,00', amount: '34,00', confidence: 95 },
  ];
  const hint = financialSeparatorHint(comma, lines);
  assert.equal(hint, ',');

  const recon = reconcileFinancialDocument(comma, lines, hint);
  assert.equal(check(recon, 'Subtotal').actual, 583.1);
  assert.equal(check(recon, 'Total').actual, 643.1);
  assert.equal(check(recon, 'Closing balance').actual, 1811.58);
  assert.equal(recon?.taxIncluded, 76.06);
  assert.equal(recon?.cashEffect, 'prefund_drawdown');
  assert.equal(recon?.ok, true);
  // The hint is inferred from the receipt's own figures when none is passed, so
  // a caller that forgets one gets the same answer rather than a 1000× one.
  assert.deepEqual(reconcileFinancialDocument(comma, lines), recon);
});

// ---------------------------------------------------------------------------
// Skip, don't zero.
// ---------------------------------------------------------------------------

test('a check the paper printed only one side of is skipped, not failed', () => {
  const sparse: FinancialDocument = {
    ...COUNTRY_CLUB,
    subtotal: '',
    gratuity: '',
    opening_balance: '',
    settlement_amount: '',
    closing_balance: '',
  };
  const recon = reconcileFinancialDocument(sparse, []);
  // Nothing to sum against, nothing to bracket the total with, no balances:
  // NO checks at all, and the document is clean rather than broken.
  assert.deepEqual(recon?.checks, []);
  assert.equal(recon?.ok, true);
  assert.equal(recon?.balance, null);
  assert.equal(recon?.cashEffect, 'unknown');
  // The VAT question is still answerable, because both its figures are printed.
  assert.equal(recon?.taxWithinTotal, true);
});

test('a missing gratuity is absent, not zero — the total is checked against the subtotal alone', () => {
  const noTip: FinancialDocument = { ...COUNTRY_CLUB, gratuity: '', total: '583.10', settlement_amount: '583.10' };
  const recon = reconcileFinancialDocument(noTip, COUNTRY_CLUB_LINES);
  assert.equal(check(recon, 'Total').expected, 583.1);
  assert.equal(check(recon, 'Total').ok, true);
});

test('no financial block at all returns null rather than an empty card', () => {
  assert.equal(reconcileFinancialDocument(null, COUNTRY_CLUB_LINES), null);
  assert.equal(reconcileFinancialDocument(undefined), null);
  assert.equal(deriveCashEffect(null), 'unknown');
});

test('a signed settlement fails into unknown rather than being absolute-valued', () => {
  // The prompt asks for the amount settled, unsigned. A reader that returns the
  // balance column's "-643.10" instead produces 2454.68 − (−643.10) = 3097.78,
  // which does not reach the printed closing balance — so the check fails, the
  // reviewer is shown it, and NO drawdown is claimed. Silently taking the
  // magnitude would accept a sign nobody verified.
  const signed: FinancialDocument = { ...COUNTRY_CLUB, settlement_amount: '-643.10' };
  const recon = reconcileFinancialDocument(signed, COUNTRY_CLUB_LINES);
  assert.equal(check(recon, 'Closing balance').ok, false);
  assert.equal(recon?.cashEffect, 'unknown');
});

// ---------------------------------------------------------------------------
// Expense categories.
// ---------------------------------------------------------------------------

test('a suggested category is accepted only when it is on the fixed list', () => {
  assert.equal(coerceExpenseCategory('Meals & entertainment'), 'Meals & entertainment');
  assert.equal(coerceExpenseCategory('  fuel  '), 'Fuel');
  assert.equal(coerceExpenseCategory('Client Entertainment'), null);
  assert.equal(coerceExpenseCategory(''), null);
  assert.equal(coerceExpenseCategory(undefined), null);
  assert.equal(coerceExpenseCategory(42), null);
  // An unrecognised suggestion becomes NULL, never "Other" — "Other" is a
  // choice a human makes, not a synonym for "we did not know".
  assert.notEqual(coerceExpenseCategory('Sundry'), 'Other');
  assert.equal(EXPENSE_CATEGORIES.includes('Meals & entertainment'), true);
  assert.equal(EXPENSE_CATEGORIES.length, 10);
});

test("the Country Club receipt's suggested category is Meals & entertainment", () => {
  assert.equal(coerceExpenseCategory(COUNTRY_CLUB.expense_category), 'Meals & entertainment');
});
