import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceField } from '../lib/platform/import-schema.ts';

// coerceField's 'number'/'vat_rate' cases used to be
// `Number(v.replace(/[^0-9.\-]/g, ''))` — it deleted commas instead of reading
// them, so an SA-formatted import cell like "1 234,56" (credit limit, opening
// balance, selling price) landed as "123456", two orders of magnitude off.
// This suite pins the fix: delegation to the shared locale-aware parser in
// lib/platform/locale-number.ts, with each field's original null/0 fallback
// preserved exactly.

test('number: comma-decimal and en-thousands both read correctly', () => {
  assert.equal(coerceField('1 234,56', 'number'), 1234.56);
  assert.equal(coerceField('1,234.56', 'number'), 1234.56); // existing en import, unchanged
  assert.equal(coerceField('0,20', 'number'), 0.2);
});

test('number: malformed cell → null (never a best-effort guess)', () => {
  assert.equal(coerceField('abc', 'number'), null);
  assert.equal(coerceField('12,34,5', 'number'), null);
});

test('number: blank cell → null (unrelated to the parser, pre-existing contract)', () => {
  assert.equal(coerceField('', 'number'), null);
  assert.equal(coerceField(null, 'number'), null);
});

test('vat_rate: percent suffix and comma-decimal', () => {
  assert.equal(coerceField('15%', 'vat_rate'), 15);
  assert.equal(coerceField('15,00', 'vat_rate'), 15);
});

test('vat_rate: zero/exempt/standard letter codes take priority over parsing', () => {
  assert.equal(coerceField('zero', 'vat_rate'), 0);
  assert.equal(coerceField('exempt', 'vat_rate'), 0);
  assert.equal(coerceField('std', 'vat_rate'), 15);
});

test('vat_rate: malformed cell falls back to 0, never null', () => {
  assert.equal(coerceField('n/a', 'vat_rate'), 0);
});
