import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countGrossMismatches,
  grossMismatch,
  lineGross,
  orderSubtotal,
  toPrintableLines,
} from '../lib/platform/docu/order-line-totals.ts';
import { TOLERANCE_ABSOLUTE, TOLERANCE_RELATIVE } from '../lib/platform/docu/line-audit.ts';

// ---------------------------------------------------------------------------
// The second Bakubung run.
//
// After `129456b` made product matching honest, the same three-page NebulaPOS
// purchase order came back with 22 items, raw descriptions preserved and no
// forced matches — and two CHARACTER-level misreads that the honesty pass could
// not have caught, because nothing about them is a matching decision:
//
//   "Apple Top Red @ 560.90"   the paper prints 569.90
//   "Graphis Black/White"      the paper prints GRAPES BLACK / GRAPES WHITE
//
// The digit one is machine-detectable and always was: the paper prints its own
// amount column, and 1 × 560.90 is not the 569.90 printed beside it. This suite
// is that cross-check.
// ---------------------------------------------------------------------------

test('lineGross multiplies quantity by unit price, to the cent', () => {
  assert.equal(lineGross({ quantity: '1', unit_price: '569.90' }), 569.9);
  assert.equal(lineGross({ quantity: '3', unit_price: '12.35' }), 37.05);
  // Floating point: 0.1 * 3 is 0.30000000000000004 before rounding.
  assert.equal(lineGross({ quantity: '3', unit_price: '0.1' }), 0.3);
});

test('lineGross treats a blank, missing or unreadable figure as zero', () => {
  assert.equal(lineGross({ quantity: '5', unit_price: '' }), 0);
  assert.equal(lineGross({ quantity: '', unit_price: '10' }), 0);
  assert.equal(lineGross({}), 0);
  assert.equal(lineGross({ quantity: '—', unit_price: 'n/a' }), 0);
});

test('lineGross reads currency-decorated figures the way the rest of Doc-U does', () => {
  assert.equal(lineGross({ quantity: '2', unit_price: 'R 45.50' }), 91);
});

test('orderSubtotal sums the lines and rounds once, at the end', () => {
  const lines = [
    { quantity: '1', unit_price: '569.90' },
    { quantity: '2', unit_price: '23.80' },
    { quantity: '4', unit_price: '' },
  ];
  assert.equal(orderSubtotal(lines), 617.5);
  assert.equal(orderSubtotal([]), 0);
});

// --- the cross-check -------------------------------------------------------

test('the 560.90 line is caught: qty × price does not equal the printed amount', () => {
  const off = grossMismatch({ quantity: '1', unit_price: '560.90', raw_amount: '569.90' });
  assert.ok(off, 'a transposed digit must not pass silently');
  assert.equal(off.paper, 569.9);
  assert.equal(off.gross, 560.9);
  assert.equal(off.difference, -9);
});

test('a line that reconciles raises nothing', () => {
  assert.equal(grossMismatch({ quantity: '1', unit_price: '569.90', raw_amount: '569.90' }), null);
  assert.equal(grossMismatch({ quantity: '6', unit_price: '23.80', raw_amount: '142.80' }), null);
});

test('the tolerance is line-audit’s, not a second opinion', () => {
  // Within a cent: a rounding artefact on the paper, not a misreading.
  assert.equal(TOLERANCE_ABSOLUTE, 0.01);
  assert.equal(grossMismatch({ quantity: '3', unit_price: '33.33', raw_amount: '100.00' }), null);
  // Within half a percent of a big line: also fine.
  assert.equal(TOLERANCE_RELATIVE, 0.005);
  assert.equal(grossMismatch({ quantity: '1', unit_price: '10000.00', raw_amount: '10040.00' }), null);
  // Twenty cents on a ten-rand line clears both legs — 2% is not a rounding
  // artefact, and neither is the 1.6% that separates 560.90 from 569.90.
  assert.ok(grossMismatch({ quantity: '1', unit_price: '10.00', raw_amount: '10.20' }));
});

test('no paper amount means no question to ask', () => {
  assert.equal(grossMismatch({ quantity: '5', unit_price: '20.00', raw_amount: '' }), null);
  assert.equal(grossMismatch({ quantity: '5', unit_price: '20.00' }), null);
});

test('an unpriced line is silent — that is the normal state of an order line', () => {
  // The single most important negative: an order priced from our own list
  // arrives with every unit_price blank. Warning "R 0.00 ≠ R 569.90" on all 22
  // rows would be noise, and noise is how a real warning gets ignored.
  assert.equal(grossMismatch({ quantity: '1', unit_price: '', raw_amount: '569.90' }), null);
  assert.equal(grossMismatch({ quantity: '', unit_price: '569.90', raw_amount: '569.90' }), null);
});

test('a zero quantity against a printed amount IS a question', () => {
  // Distinct from the blank above: "0" was read, and zero of something cannot
  // have cost 569.90 — one of the two figures is wrong.
  const off = grossMismatch({ quantity: '0', unit_price: '569.90', raw_amount: '569.90' });
  assert.ok(off);
  assert.equal(off.gross, 0);
});

test('countGrossMismatches counts only the rows in question', () => {
  const lines = [
    { quantity: '1', unit_price: '560.90', raw_amount: '569.90' }, // out
    { quantity: '6', unit_price: '23.80', raw_amount: '142.80' }, // fine
    { quantity: '2', unit_price: '', raw_amount: '80.00' }, // unpriced — silent
    { quantity: '4', unit_price: '10.00', raw_amount: '' }, // no paper amount
    { quantity: '3', unit_price: '5.00', raw_amount: '20.00' }, // out
  ];
  assert.equal(countGrossMismatches(lines), 2);
  assert.equal(countGrossMismatches([]), 0);
});

// --- printing the live rows ------------------------------------------------

test('toPrintableLines carries the on-screen rows, trimmed', () => {
  const out = toPrintableLines([
    { description: '  Apples Top Red  ', quantity: ' 1 ', unit: ' boxes ', unit_price: ' 569.90 ' },
  ]);
  assert.deepEqual(out, [
    { description: 'Apples Top Red', quantity: '1', unit: 'boxes', unit_price: '569.90', confidence: 100 },
  ]);
});

test('toPrintableLines drops rows with no product name', () => {
  const out = toPrintableLines([
    { description: 'Grapes Black', quantity: '2', unit: 'boxes', unit_price: '80.00' },
    { description: '   ', quantity: '9', unit: '', unit_price: '99.00' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, 'Grapes Black');
});

test('toPrintableLines sets no amount — the sheet derives it from the same two factors', () => {
  const [line] = toPrintableLines([{ description: 'X', quantity: '2', unit: '', unit_price: '10' }]);
  assert.equal(line.amount, undefined);
});

test('printing follows the edit, not the save', () => {
  // The whole point of feeding the sheet the live rows: the reviewer has just
  // corrected 560.90 to 569.90 and has NOT pressed Confirm.
  const edited = [{ description: 'Apples Top Red', quantity: '1', unit: 'boxes', unit_price: '569.90' }];
  assert.equal(toPrintableLines(edited)[0].unit_price, '569.90');
  assert.equal(lineGross(edited[0]), 569.9);
});
