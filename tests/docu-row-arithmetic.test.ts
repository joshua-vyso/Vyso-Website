import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyRowArithmetic,
  applyRowArithmeticToLines,
  resolveRowArithmetic,
  type RowNumbers,
} from '../lib/platform/docu/row-arithmetic.ts';

// ---------------------------------------------------------------------------
// The Bakubung purchase order, second failure mode.
//
// `129456b` fixed the products and `12ff849` fixed the digits. The rows below
// are what was left: the characters transcribed CORRECTLY and the columns paired
// WRONGLY. The paper prints a bulk quantity, a unit quantity and a unit cost, and
// the cost is per UNIT QUANTITY — so the only way to know which two numbers
// multiply is to ask which pairing reproduces the nett the row itself printed.
//
//   paper: AVOCADO   bulk 4 / unit qty 48 / unit cost 15.75 / nett 756.00
//   read:  "Avocado 4.00 boxes @ 15.75 = R63"
//
//   paper: PINEAPPLE bulk 3 / unit qty 18 / unit cost 24.83 / nett 446.94
//   read:  "Pineapple 3 @ 24.83 = 74.49"
//
// Both wrong readings are arithmetically consistent with themselves, which is
// exactly why nothing downstream caught them. Neither is consistent with the
// paper's own total, which is why this can.
// ---------------------------------------------------------------------------

const AVOCADO: RowNumbers = {
  bulk_quantity: '4',
  bulk_unit: 'Box',
  unit_quantity: '48',
  unit: 'Each',
  quantity: '4',
  unit_price: '15.75',
  raw_amount: '756.00',
};

const PINEAPPLE: RowNumbers = {
  bulk_quantity: '3',
  bulk_unit: 'Box',
  unit_quantity: '18',
  unit: 'Each',
  quantity: '3',
  unit_price: '24.83',
  raw_amount: '446.94',
};

// A simple row: one quantity column, one price, one total. The overwhelming
// majority of order lines, and the ones this pass must not touch.
const GRAPES_WHITE: RowNumbers = {
  quantity: '2',
  unit: 'boxes',
  unit_price: '659.00',
  raw_amount: '1318.00',
};

// ---------------------------------------------------------------------------
// The fixture rows
// ---------------------------------------------------------------------------

test('the avocado row: 48 × 15.75 = 756 wins over 4 × 15.75 = 63', () => {
  const v = resolveRowArithmetic(AVOCADO);
  assert.equal(v.resolved, true);
  assert.equal(v.basis, 'unit_quantity');
  assert.equal(v.quantity, 48);
  assert.equal(v.unit_price, 15.75);
  assert.equal(v.total, 756);
  assert.equal(v.paper, 756);
});

test('the avocado row is populated from the winning pairing, not from the extraction', () => {
  const line = applyRowArithmetic({ ...AVOCADO, description: 'Avocado' });
  assert.equal(line.quantity, '48', 'the each figure, not the box figure');
  assert.equal(line.unit_price, '15.75');
  assert.equal(line.arithmetic_basis, 'unit_quantity');
  // Evidence is never rewritten by an arithmetic pass.
  assert.equal(line.raw_amount, '756.00');
  assert.equal(line.description, 'Avocado');
});

test('the pineapple row: 18 × 24.83 = 446.94, not 3 × 24.83 = 74.49', () => {
  const v = resolveRowArithmetic(PINEAPPLE);
  assert.equal(v.resolved, true);
  assert.equal(v.basis, 'unit_quantity');
  assert.equal(v.quantity, 18);
  assert.equal(v.total, 446.94);
});

test('a nett rounded on the paper to 447 still reconciles — the tolerance is the audit’s own', () => {
  const v = resolveRowArithmetic({ ...PINEAPPLE, raw_amount: '447.00' });
  assert.equal(v.resolved, true);
  assert.equal(v.basis, 'unit_quantity');
  assert.equal(v.quantity, 18);
});

test('the cucumber row: 60 each @ 22.90 = 1374, not 4 boxes @ 52.90', () => {
  const v = resolveRowArithmetic({
    bulk_quantity: '4',
    bulk_unit: 'Box',
    unit_quantity: '60',
    unit: 'Each',
    quantity: '4',
    unit_price: '22.90',
    raw_amount: '1374.00',
  });
  assert.equal(v.resolved, true);
  assert.equal(v.quantity, 60);
  assert.equal(v.unit_price, 22.9);
});

test('a simple row passes through untouched — 2 × 659 = 1318', () => {
  const v = resolveRowArithmetic(GRAPES_WHITE);
  assert.equal(v.resolved, true);
  assert.equal(v.basis, 'quantity');
  assert.equal(v.quantity, 2);
  assert.equal(v.unit_price, 659);

  const line = applyRowArithmetic({ ...GRAPES_WHITE, description: 'Grapes White' });
  assert.equal(line.quantity, '2');
  assert.equal(line.unit_price, '659');
  assert.equal(line.unit, 'boxes', 'a unit read off the paper is never replaced');
});

// ---------------------------------------------------------------------------
// The other pairings
// ---------------------------------------------------------------------------

test('a cost printed per BOX resolves on the bulk column', () => {
  const v = resolveRowArithmetic({
    bulk_quantity: '4',
    bulk_unit: 'Box',
    unit_quantity: '48',
    unit: 'Each',
    quantity: '',
    unit_price: '189.00',
    raw_amount: '756.00',
  });
  assert.equal(v.resolved, true);
  assert.equal(v.basis, 'bulk_quantity');
  assert.equal(v.quantity, 4);
  assert.equal(v.unit, 'Box', 'the bulk column is counted in the bulk unit');
});

test('a cost per each billed across every box resolves on bulk × unit', () => {
  const v = resolveRowArithmetic({
    bulk_quantity: '4',
    unit_quantity: '12',
    unit: 'Each',
    quantity: '',
    unit_price: '15.75',
    raw_amount: '756.00',
  });
  assert.equal(v.resolved, true);
  assert.equal(v.basis, 'bulk_times_unit');
  assert.equal(v.quantity, 48);
});

// ---------------------------------------------------------------------------
// The restraint. Every case below must leave the row EXACTLY as extracted.
// ---------------------------------------------------------------------------

test('nothing reconciles: the row is returned byte-identical for the red ring to find', () => {
  const row = {
    bulk_quantity: '4',
    unit_quantity: '48',
    unit: 'Each',
    quantity: '4',
    unit_price: '15.75',
    // A nett no pairing of these numbers produces.
    raw_amount: '999.00',
    description: 'Avocado',
  };
  const v = resolveRowArithmetic(row);
  assert.equal(v.resolved, false);
  assert.equal(v.basis, null);
  assert.equal(v.paper, 999, 'the paper’s figure is still reported');
  assert.deepEqual(applyRowArithmetic(row), row, 'not one field is touched');
});

test('an order with no amount column is never resolved — most orders', () => {
  const row = { quantity: '5', unit: 'boxes', unit_price: '', raw_amount: '' };
  assert.equal(resolveRowArithmetic(row).resolved, false);
  assert.deepEqual(applyRowArithmetic(row), row);
});

test('a printed amount with no unit price is not a question we can ask', () => {
  const row = { quantity: '5', unit_price: '', raw_amount: '250.00' };
  assert.equal(resolveRowArithmetic(row).resolved, false);
  assert.deepEqual(applyRowArithmetic(row), row);
});

test('a zero quantity never wins, however well 0 × anything matches a 0 nett', () => {
  const v = resolveRowArithmetic({ quantity: '0', unit_price: '15.75', raw_amount: '0' });
  assert.equal(v.resolved, false, 'a row that multiplies out to nothing explains nothing');
});

test('a blank unit is filled from the winning basis; a read one is not overwritten', () => {
  const filled = applyRowArithmetic({ ...AVOCADO, unit: '' });
  assert.equal(filled.unit, '', 'the paper named no unit for the each column, so none is invented');

  const bulkWin = applyRowArithmetic({
    bulk_quantity: '4',
    bulk_unit: 'Box',
    unit: '',
    quantity: '',
    unit_price: '189.00',
    raw_amount: '756.00',
  });
  assert.equal(bulkWin.unit, 'Box');
});

// ---------------------------------------------------------------------------
// A document at a time
// ---------------------------------------------------------------------------

test('the whole document: the two-column rows resolve and the simple rows do not move', () => {
  const lines = applyRowArithmeticToLines([
    { ...AVOCADO, description: 'Avocado' },
    { ...PINEAPPLE, description: 'Pineapple' },
    { ...GRAPES_WHITE, description: 'Grapes White' },
    { description: 'Peppers Green', quantity: '3', unit: 'boxes', unit_price: '', raw_amount: '' },
  ]);
  assert.deepEqual(
    lines.map((l) => l.quantity),
    ['48', '18', '2', '3'],
  );
  assert.deepEqual(
    lines.map((l) => l.arithmetic_basis ?? null),
    ['unit_quantity', 'unit_quantity', 'quantity', null],
  );
});
