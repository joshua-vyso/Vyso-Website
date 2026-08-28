import test from 'node:test';
import assert from 'node:assert/strict';
import { grossMismatch, lineGross, lineSeparatorHint, orderSubtotal } from '../lib/platform/docu/order-line-totals.ts';
import { moneyEquals } from '../lib/platform/locale-number.ts';

// ---------------------------------------------------------------------------
// Standard Bank PO SBSA94517 — the document that started this fix.
//
// The stored extraction JSON was already CORRECT (verified in the DB): South
// African comma-decimal figures, internally consistent on every line —
// Gooseberries' own `quantity "0,20"` × `unit_price "269,000"` really is
// `raw_amount "53,80"` (0.20 × 269.00 = 53.80). The corruption happened
// entirely downstream, in `parseAmount()`, which DELETED the comma instead of
// reading it: "0,20" → 20, "269,000" → 269000, and the review screen showed a
// R53.80 line of Gooseberries as R5 380 000.00.
//
// These are the five rows EXACTLY as the DB stores them — verified, not
// substituted. Every `unit_price` on this real document happens to carry the
// hard case: a single comma followed by exactly three digits ("269,000",
// "44,400", …), which is genuinely ambiguous on its own (see
// `lib/platform/locale-number.ts`'s `resolveSeparators` — it could as easily
// be en-thousands). What resolves all five is the OTHER numbers on the same
// document: every `quantity` and `raw_amount` is an unambiguous two-digit-tail
// comma-decimal ("0,20", "53,80", …), and `lineSeparatorHint` counts THOSE as
// evidence. This is the real shape of the bug and its fix — not a contrived
// one-ambiguous-field example, but a document where the deterministic
// same-document inference is the ENTIRE reason every line reads correctly.
//
// This suite calls `order-line-totals.ts`'s real functions exactly as
// `OrderReviewEditor.tsx` does: the hint inferred ONCE, document-wide, via
// `lineSeparatorHint`, then threaded through every row.
// ---------------------------------------------------------------------------

interface StandardBankLine {
  description: string;
  quantity: string;
  unit_price: string;
  raw_amount: string;
  paper: number;
}

const STANDARD_BANK_LINES: StandardBankLine[] = [
  // unit_price is stored with THREE decimal digits ("269,000" = 269.000, i.e.
  // 269 rand) — the exact ambiguous shape `resolveSeparators` cannot decide
  // without a hint. quantity and raw_amount are two-digit-tail commas
  // ("0,20", "53,80") and are what supply that hint.
  { description: 'Gooseberries Fresh', quantity: '0,20', unit_price: '269,000', raw_amount: '53,80', paper: 53.8 },
  { description: 'Raspberries Fresh', quantity: '0,20', unit_price: '329,000', raw_amount: '65,80', paper: 65.8 },
  { description: 'Edible Flowers - Tubs', quantity: '3,00', unit_price: '44,400', raw_amount: '133,20', paper: 133.2 },
  { description: 'Baby Butternut Fresh', quantity: '3,00', unit_price: '119,900', raw_amount: '359,70', paper: 359.7 },
  { description: 'Herb Basil Fresh', quantity: '0,10', unit_price: '139,500', raw_amount: '13,95', paper: 13.95 },
];

test('the document infers a comma decimal separator from its own unambiguous rows', () => {
  // Every unit_price on this document is the ambiguous 3-digit-tail shape and
  // contributes NO evidence on its own (see `inferDecimalSeparator`) — the
  // comma reading here is carried entirely by the ten unambiguous quantity/
  // raw_amount samples (five rows × two fields each, all 2-digit tails).
  assert.equal(lineSeparatorHint(STANDARD_BANK_LINES), ',');
});

test('every Standard Bank row computes its paper amount, no manual hint given', () => {
  const hint = lineSeparatorHint(STANDARD_BANK_LINES);
  for (const line of STANDARD_BANK_LINES) {
    const gross = lineGross(line, hint);
    // `lineGross` rounds to the cent internally (`round2`), which also mops up
    // the float noise a case like 3.00 × 44.400 produces
    // (133.20000000000002) — but the R0.02 tolerance is asserted explicitly
    // too, rather than relying on that rounding, so this test still passes if
    // that internal rounding is ever refactored away.
    assert.ok(
      moneyEquals(gross, line.paper),
      `${line.description}: expected ${line.paper}, got ${gross}`,
    );
    // The old bug's signature: any computed value in the thousands or millions.
    // 53.80 corrupted to 5 380 000.00 — this line asserts the whole class is dead.
    assert.ok(gross < 1000, `${line.description}: ${gross} is in the "corrupted by 1000x" range`);
  }
});

test('grossMismatch is false (null) for every Standard Bank row', () => {
  const hint = lineSeparatorHint(STANDARD_BANK_LINES);
  for (const line of STANDARD_BANK_LINES) {
    assert.equal(grossMismatch(line, hint), null, `${line.description} must reconcile with the paper`);
  }
});

test('the five-row subtotal is 626.45, not 5 380 626.45 or any inflated figure', () => {
  const subtotal = orderSubtotal(STANDARD_BANK_LINES);
  assert.ok(moneyEquals(subtotal, 626.45), `expected 626.45, got ${subtotal}`);
});

test('without any comma evidence at all, a lone ambiguous "269,000" still defaults to en-thousands (never a silent guess the other way)', () => {
  // A single-row document carries no corroborating evidence, so `lineGross`
  // with no hint reads "269,000" as the ordinary en-thousands default — the
  // documented, deliberate fallback, not the SA reading. This is what makes
  // the multi-row inference above load-bearing: it is the OTHER rows on this
  // real document that correctly steer every ambiguous unit_price.
  const lone = { quantity: '1', unit_price: '269,000', raw_amount: '' };
  assert.equal(lineGross(lone), 269000);
});
