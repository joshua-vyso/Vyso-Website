import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocaleNumber, inferDecimalSeparator, moneyEquals } from '../lib/platform/locale-number.ts';

// ---------------------------------------------------------------------------
// Standard Bank PO SBSA94517: Gooseberries "0,20" × "269,000" (comma-decimal
// SA figures, internally consistent in the DB) came out as R5 380 000.00
// because the old parser deleted the comma instead of reading it. This suite
// pins the algorithm that replaced it.
// ---------------------------------------------------------------------------

test('decimal comma', () => {
  assert.equal(parseLocaleNumber('0,20'), 0.2);
  assert.equal(parseLocaleNumber('269,00'), 269);
  assert.equal(parseLocaleNumber('13,95'), 13.95);
});

test('decimal point', () => {
  assert.equal(parseLocaleNumber('0.20'), 0.2);
  assert.equal(parseLocaleNumber('269.00'), 269);
  assert.equal(parseLocaleNumber('12.5'), 12.5);
});

test('space thousands + comma decimal', () => {
  assert.equal(parseLocaleNumber('1 395,00'), 1395);
  assert.equal(parseLocaleNumber('1 395,00'), 1395, 'NBSP thousands gap');
  assert.equal(parseLocaleNumber('1 395,00'), 1395, 'narrow NBSP thousands gap');
});

test('comma thousands + dot decimal', () => {
  assert.equal(parseLocaleNumber('1,395.00'), 1395);
  assert.equal(parseLocaleNumber('1,234,567'), 1234567);
});

test('dot thousands + comma decimal', () => {
  assert.equal(parseLocaleNumber('1.395,00'), 1395);
  assert.equal(parseLocaleNumber('1.234.567,89'), 1234567.89);
});

test('currency-decorated figures', () => {
  assert.equal(parseLocaleNumber('R 1 395,00'), 1395);
  assert.equal(parseLocaleNumber('R1,395.00'), 1395);
  assert.equal(parseLocaleNumber('ZAR 269,00'), 269);
  assert.equal(parseLocaleNumber('-R 12,50'), -12.5);
});

test('a trailing percent sign is stripped like a currency decorator', () => {
  // `invoice-from-extraction.ts`'s VAT-rate field reads "15%" straight off the
  // extraction; this is the same edge-decoration rule as "R15", not a second
  // parsing path.
  assert.equal(parseLocaleNumber('15%'), 15);
  assert.equal(parseLocaleNumber('14,97%', { decimalSeparator: ',' }), 14.97);
});

test('accounting-negative parens', () => {
  assert.equal(parseLocaleNumber('(12.50)'), -12.5);
  assert.equal(parseLocaleNumber('(R12,50)'), -12.5);
});

test('ambiguous "x,000" only resolves with a hint', () => {
  assert.equal(parseLocaleNumber('269,000'), 269000, 'no hint → en thousands, never a guessed decimal');
  assert.equal(parseLocaleNumber('269,000', { decimalSeparator: ',' }), 269);
  assert.equal(parseLocaleNumber('1.395', { decimalSeparator: ',' }), 1395);
});

test('malformed input never produces a number', () => {
  for (const bad of ['12,34,5', '1.2.3,4', 'abc', '', '-', '12a34', '1,2345.00']) {
    assert.equal(parseLocaleNumber(bad), null, `"${bad}" must be null, not a guess`);
  }
});

test('already-numeric and nullish input pass through', () => {
  assert.equal(parseLocaleNumber(53.8), 53.8);
  assert.equal(parseLocaleNumber(null), null);
  assert.equal(parseLocaleNumber(undefined), null);
  assert.equal(parseLocaleNumber(NaN), null);
});

test('unambiguous en values are unaffected by any hint', () => {
  assert.equal(parseLocaleNumber('1,234,567'), 1234567);
  assert.equal(parseLocaleNumber('5,380.00'), 5380);
  assert.equal(parseLocaleNumber('12.5'), 12.5);
});

// ---------------------------------------------------------------------------
// inferDecimalSeparator — the document-level vote that resolves an otherwise
// ambiguous "269,000" from the OTHER, unambiguous figures on the same doc.
// ---------------------------------------------------------------------------

test('inferDecimalSeparator reads the majority off unambiguous samples', () => {
  assert.equal(inferDecimalSeparator(['0,20', '269,000', '53,80']), ',');
  assert.equal(inferDecimalSeparator(['5,380.00']), '.');
  assert.equal(inferDecimalSeparator(['269,000']), null, 'a single ambiguous sample has no opinion');
  assert.equal(inferDecimalSeparator([]), null);
});

test('inferDecimalSeparator: the whole Standard Bank line set votes comma', () => {
  assert.equal(
    inferDecimalSeparator(['0,20', '269,000', '53,80', '1,10', '327,00', '359,70']),
    ',',
  );
});

test('inferDecimalSeparator is silent on a tie', () => {
  assert.equal(inferDecimalSeparator(['0,20', '12.50']), null);
});

// ---------------------------------------------------------------------------
// moneyEquals — the money helper other modules reuse for a tolerance check.
// ---------------------------------------------------------------------------

test('moneyEquals: within tolerance (2c default) and its epsilon', () => {
  assert.ok(moneyEquals(53.8, 53.8));
  assert.ok(moneyEquals(53.8, 53.81));
  assert.ok(moneyEquals(53.8, 53.82));
  assert.ok(!moneyEquals(53.8, 53.83));
  assert.ok(moneyEquals(1, 1.03, 0.05));
});
