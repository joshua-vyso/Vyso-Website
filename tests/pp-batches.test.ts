import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOutputProduct,
  ingredientMovements,
  outputMovement,
  floorOnHand,
  filterRecipes,
  scaleRecipePrefill,
  appendBatchCountNote,
  OUTPUT_FUZZY_ACCEPT,
  type OutputCandidate,
  type RecipePrefillInput,
} from '../lib/platform/procurepulse/batch-logic.ts';
import { scoreProductName } from '../lib/platform/docu/product-suggest.ts';
import { distinctItemUnits } from '../lib/platform/procurepulse/units.ts';

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

// ---------------------------------------------------------------------------
// filterRecipes — the Batches page's recipe typeahead. Root-cause fix: the
// picker used to compute matches only when `query` was non-empty, so
// focusing the field with nothing typed showed nothing — with an org that
// has one recipe, that read as "typeahead does nothing" in production.
// ---------------------------------------------------------------------------

const RECIPES = [
  { name: 'New recipe' },
  { name: 'Mixed Veg' },
  { name: 'Roasted Squash Medley' },
];

test('filterRecipes: empty query returns every recipe (focus-with-no-input case)', () => {
  const matches = filterRecipes(RECIPES, '');
  assert.equal(matches.length, 3);
});

test('filterRecipes: whitespace-only query is treated the same as empty', () => {
  const matches = filterRecipes(RECIPES, '   ');
  assert.equal(matches.length, 3);
});

test('filterRecipes: a single org recipe still appears on an empty query', () => {
  const matches = filterRecipes([{ name: 'New recipe' }], '');
  assert.deepEqual(matches, [{ name: 'New recipe' }]);
});

test('filterRecipes: query filters by case-insensitive substring', () => {
  const matches = filterRecipes(RECIPES, 'veg');
  assert.deepEqual(matches, [{ name: 'Mixed Veg' }]);
});

test('filterRecipes: query with no match returns an empty list', () => {
  assert.deepEqual(filterRecipes(RECIPES, 'nonexistent'), []);
});

test('filterRecipes: respects the max cap, keeping input order', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ name: `Recipe ${i}` }));
  const matches = filterRecipes(many, '', 8);
  assert.equal(matches.length, 8);
  assert.equal(matches[0].name, 'Recipe 0');
});

// ---------------------------------------------------------------------------
// scaleRecipePrefill / appendBatchCountNote — the Batches page's "Batches"
// count multiplier. Josh's ask: set the count once instead of it only ever
// incrementing by one and having to retype the recipe each time.
// ---------------------------------------------------------------------------

const MIXED_VEG_RECIPE: RecipePrefillInput = {
  output_qty: 5,
  output_unit: 'kg',
  ingredients: [
    { stock_item_id: 'i-butternut', product_name: 'Butternut', qty_per_batch: 2, unit: 'kg' },
    { stock_item_id: 'i-broccoli', product_name: 'Broccoli', qty_per_batch: 1.5, unit: 'kg' },
    { stock_item_id: null, product_name: 'Garnish', qty_per_batch: 0, unit: null },
  ],
};

test('scaleRecipePrefill: count of 1 reproduces the plain per-batch quantities', () => {
  const scaled = scaleRecipePrefill(MIXED_VEG_RECIPE, 1);
  assert.equal(scaled.outputQty, '5');
  assert.deepEqual(
    scaled.rows.map((r) => r.qty_used),
    ['2', '1.5', ''],
  );
});

test('scaleRecipePrefill: multiplies every per-batch quantity and the output by the count', () => {
  const scaled = scaleRecipePrefill(MIXED_VEG_RECIPE, 3);
  assert.equal(scaled.outputQty, '15');
  assert.deepEqual(
    scaled.rows.map((r) => r.qty_used),
    ['6', '4.5', ''],
  );
});

test('scaleRecipePrefill: a zero/unset per-batch qty stays blank, not "0", at any count', () => {
  const scaled = scaleRecipePrefill(MIXED_VEG_RECIPE, 4);
  assert.equal(scaled.rows[2].qty_used, '');
});

test('scaleRecipePrefill: non-positive or invalid counts fall back to 1', () => {
  for (const bad of [0, -2, NaN, Infinity]) {
    const scaled = scaleRecipePrefill(MIXED_VEG_RECIPE, bad);
    assert.equal(scaled.outputQty, '5');
  }
});

test('scaleRecipePrefill: rounds off floating-point noise instead of leaking long decimals', () => {
  const recipe: RecipePrefillInput = {
    output_qty: 1,
    output_unit: null,
    ingredients: [{ stock_item_id: 'a', product_name: 'A', qty_per_batch: 0.1, unit: null }],
  };
  const scaled = scaleRecipePrefill(recipe, 3);
  assert.equal(scaled.rows[0].qty_used, '0.3');
});

test('scaleRecipePrefill: stock_item_id and unit pass through unchanged', () => {
  const scaled = scaleRecipePrefill(MIXED_VEG_RECIPE, 2);
  assert.equal(scaled.rows[0].stock_item_id, 'i-butternut');
  assert.equal(scaled.rows[0].unit, 'kg');
  assert.equal(scaled.outputUnit, 'kg');
});

test('appendBatchCountNote: a count of 1 or less leaves notes untouched', () => {
  assert.equal(appendBatchCountNote('Ran a bit hot', 1), 'Ran a bit hot');
  assert.equal(appendBatchCountNote('Ran a bit hot', 0), 'Ran a bit hot');
  assert.equal(appendBatchCountNote('  Ran a bit hot  ', -1), 'Ran a bit hot');
});

test('appendBatchCountNote: appends a "× N batches" marker for a count above 1', () => {
  assert.equal(appendBatchCountNote('Ran a bit hot', 3), 'Ran a bit hot (× 3 batches)');
});

test('appendBatchCountNote: blank notes with a multi-batch count yield just the marker, no stray parens', () => {
  assert.equal(appendBatchCountNote('', 4), '× 4 batches');
  assert.equal(appendBatchCountNote('   ', 4), '× 4 batches');
});

// ---------------------------------------------------------------------------
// distinctItemUnits — the unit <select>'s vocabulary: dedupe case-insensitively,
// sort, and always be able to represent a field's current (possibly odd) value.
// ---------------------------------------------------------------------------

test('distinctItemUnits: dedupes case-insensitively, keeping first-seen casing', () => {
  const units = distinctItemUnits(['kg', 'Kg', 'KG', 'boxes']);
  assert.deepEqual(units, ['boxes', 'kg']);
});

test('distinctItemUnits: sorts alphabetically, case-insensitively', () => {
  const units = distinctItemUnits(['punnets', 'boxes', 'Bags', 'kg']);
  assert.deepEqual(units, ['Bags', 'boxes', 'kg', 'punnets']);
});

test('distinctItemUnits: blank/null/undefined entries are dropped', () => {
  const units = distinctItemUnits(['kg', '', '   ', null, undefined, 'g']);
  assert.deepEqual(units, ['g', 'kg']);
});

test('distinctItemUnits: the org\'s real messy unit list survives intact (no crash, no silent merge of distinct units)', () => {
  const raw = ['boxes', 'pockets', 'punnets', 'bags', 'cartons', 'bunches', 'trays', 'bushels', 'box', 'kg', 'pkt'];
  const units = distinctItemUnits(raw);
  assert.equal(units.length, raw.length); // all distinct once lower-cased, none collide
  assert.deepEqual(units, [...units].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })));
});

test('distinctItemUnits: folding an odd current value in makes it selectable even though no stock item uses it', () => {
  const orgUnits = ['kg', 'boxes'];
  const units = distinctItemUnits([...orgUnits, '250gr pkt']);
  assert.ok(units.includes('250gr pkt'));
});

test('distinctItemUnits: folding in a value already present does not duplicate it', () => {
  const orgUnits = ['kg', 'boxes'];
  const units = distinctItemUnits([...orgUnits, 'KG']);
  assert.deepEqual(units, ['boxes', 'kg']);
});
