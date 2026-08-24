import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOutputProduct,
  ingredientMovements,
  outputMovement,
  floorOnHand,
  OUTPUT_FUZZY_ACCEPT,
  type OutputCandidate,
} from '../lib/platform/procurepulse/batch-logic.ts';
import { scoreProductName } from '../lib/platform/docu/product-suggest.ts';

// ---------------------------------------------------------------------------
// resolveOutputProduct — precedence: explicit > recipe-linked > fuzzy > create
// ---------------------------------------------------------------------------

const CATALOGUE: OutputCandidate[] = [
  { id: 'p-mixed-veg', name: 'Mixed Veg' },
  { id: 'p-mixed-veg-old', name: 'Mixed Vegetables (Legacy)' },
  { id: 'p-butternut', name: 'Butternut' },
];

test('resolveOutputProduct: explicit stock_item_id wins even when a better fuzzy match exists', () => {
  const r = resolveOutputProduct({
    explicitStockItemId: 'p-butternut',
    recipeOutputStockItemId: 'p-mixed-veg-old',
    outputProductName: 'Mixed Veg',
    catalogue: CATALOGUE,
    scoreFn: scoreProductName,
  });
  assert.equal(r.kind, 'explicit');
  assert.equal(r.kind === 'explicit' && r.stockItemId, 'p-butternut');
});

test('resolveOutputProduct: recipe-linked wins over a fuzzy match when no explicit pick given', () => {
  const r = resolveOutputProduct({
    explicitStockItemId: null,
    recipeOutputStockItemId: 'p-mixed-veg-old',
    outputProductName: 'Mixed Veg',
    catalogue: CATALOGUE,
    scoreFn: scoreProductName,
  });
  assert.equal(r.kind, 'linked');
  assert.equal(r.kind === 'linked' && r.stockItemId, 'p-mixed-veg-old');
});

test('resolveOutputProduct: falls back to a confident fuzzy match when neither explicit nor linked is given', () => {
  const r = resolveOutputProduct({
    explicitStockItemId: null,
    recipeOutputStockItemId: null,
    outputProductName: 'mixed veg',
    catalogue: CATALOGUE,
    scoreFn: scoreProductName,
  });
  assert.equal(r.kind, 'fuzzy');
  assert.equal(r.kind === 'fuzzy' && r.stockItemId, 'p-mixed-veg');
  assert.ok(r.kind === 'fuzzy' && (r.score ?? 0) >= OUTPUT_FUZZY_ACCEPT);
});

test('resolveOutputProduct: below the acceptance floor creates a new product instead of guessing', () => {
  const r = resolveOutputProduct({
    explicitStockItemId: null,
    recipeOutputStockItemId: null,
    outputProductName: 'Roasted Squash Medley',
    catalogue: CATALOGUE,
    scoreFn: scoreProductName,
  });
  assert.equal(r.kind, 'create');
  assert.equal(r.kind === 'create' && r.name, 'Roasted Squash Medley');
});

test('resolveOutputProduct: empty catalogue always creates', () => {
  const r = resolveOutputProduct({
    explicitStockItemId: null,
    recipeOutputStockItemId: null,
    outputProductName: 'Mixed Veg',
    catalogue: [],
    scoreFn: scoreProductName,
  });
  assert.equal(r.kind, 'create');
});

test('resolveOutputProduct: blank output name with nothing else resolved still creates (falls back to "New product")', () => {
  const r = resolveOutputProduct({
    explicitStockItemId: null,
    recipeOutputStockItemId: null,
    outputProductName: '   ',
    catalogue: CATALOGUE,
    scoreFn: scoreProductName,
  });
  assert.equal(r.kind, 'create');
  assert.equal(r.kind === 'create' && r.name, 'New product');
});

// ---------------------------------------------------------------------------
// ingredientMovements — per-ingredient negative deltas, unresolved lines dropped
// ---------------------------------------------------------------------------

test('ingredientMovements: one negative movement per resolved, positive-qty ingredient', () => {
  const moves = ingredientMovements([
    { stockItemId: 'i-butternut', qtyUsed: 0.6 },
    { stockItemId: 'i-broccoli', qtyUsed: 1.0 },
  ]);
  assert.deepEqual(
    moves,
    [
      { stockItemId: 'i-butternut', change: -0.6, reason: 'recipe_consumed' },
      { stockItemId: 'i-broccoli', change: -1.0, reason: 'recipe_consumed' },
    ],
  );
});

test('ingredientMovements: unresolved (no stock_item_id) lines are dropped, not zeroed', () => {
  const moves = ingredientMovements([
    { stockItemId: null, qtyUsed: 2 },
    { stockItemId: 'i-broccoli', qtyUsed: 1 },
  ]);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].stockItemId, 'i-broccoli');
});

test('ingredientMovements: zero, negative, or non-finite qty is dropped', () => {
  const moves = ingredientMovements([
    { stockItemId: 'a', qtyUsed: 0 },
    { stockItemId: 'b', qtyUsed: -1 },
    { stockItemId: 'c', qtyUsed: NaN },
    { stockItemId: 'd', qtyUsed: 3 },
  ]);
  assert.deepEqual(moves.map((m) => m.stockItemId), ['d']);
});

test('ingredientMovements: custom reason is honoured', () => {
  const moves = ingredientMovements([{ stockItemId: 'a', qtyUsed: 1 }], 'used');
  assert.equal(moves[0].reason, 'used');
});

// ---------------------------------------------------------------------------
// outputMovement — always a positive (or zero) delta
// ---------------------------------------------------------------------------

test('outputMovement: positive qty passes through', () => {
  const m = outputMovement('out-1', 4.2);
  assert.deepEqual(m, { stockItemId: 'out-1', change: 4.2, reason: 'batch_produced' });
});

test('outputMovement: negative or non-finite qty floors to 0, never goes negative', () => {
  assert.equal(outputMovement('out-1', -5).change, 0);
  assert.equal(outputMovement('out-1', NaN).change, 0);
});

// ---------------------------------------------------------------------------
// floorOnHand — the actual "never negative stock" guarantee
// ---------------------------------------------------------------------------

test('floorOnHand: a delta larger than current on_hand floors to 0, not negative', () => {
  assert.equal(floorOnHand(0.5, -1.5), 0);
});

test('floorOnHand: a positive delta adds normally', () => {
  assert.equal(floorOnHand(10, 4.2), 14.2);
});

test('floorOnHand: a non-numeric current value is treated as 0', () => {
  assert.equal(floorOnHand(Number('not-a-number'), 3), 3);
});
