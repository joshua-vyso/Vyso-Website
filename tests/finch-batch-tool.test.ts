import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveByName,
  resolveIngredient,
  resolveRecipe,
  NAME_ACCEPT,
  TIE_MARGIN,
  CANDIDATE_LIMIT,
  type AliasRow,
  type CatalogueRow,
  type RecipeRow,
} from '../lib/ai/finch/batch-draft.ts';

/**
 * The name resolution behind `pp_prepare_batch_log`, against a fixed catalogue.
 *
 * These are the tests that matter for this feature: every OTHER part of a batch
 * (the movements, the floor at zero, the output precedence) is already covered
 * by tests/pp-batches.test.ts, and the one thing chat adds is turning "broc"
 * into a real product id. Getting that wrong takes a kilogram off a line the
 * owner never mentioned.
 */

const CATALOGUE: CatalogueRow[] = [
  { id: 'p-broccoli', name: 'Broccoli Florets', unit: 'kg', on_hand: 8 },
  { id: 'p-butternut', name: 'Butternut', unit: 'kg', on_hand: 12 },
  { id: 'p-butternut-cubes', name: 'Butternut Cubes 500g', unit: 'pkt', on_hand: 30 },
  { id: 'p-carrot', name: 'Carrots Loose', unit: 'kg', on_hand: 40 },
];

const NO_ALIASES: AliasRow[] = [];

// ---------------------------------------------------------------------------
// The happy path — a spoken shorthand becomes a real catalogue line
// ---------------------------------------------------------------------------

test('resolveIngredient: "broc" matches the broccoli product', () => {
  const r = resolveIngredient(CATALOGUE, NO_ALIASES, 'broc');
  assert.equal(r.kind, 'matched');
  assert.equal(r.kind === 'matched' && r.item.id, 'p-broccoli');
  assert.equal(r.kind === 'matched' && r.via, 'name');
});

test('resolveIngredient: an exact name wins over a longer product that also starts with it', () => {
  const r = resolveIngredient(CATALOGUE, NO_ALIASES, 'butternut');
  assert.equal(r.kind, 'matched');
  assert.equal(r.kind === 'matched' && r.item.id, 'p-butternut');
});

test('resolveIngredient: matching is case- and whitespace-insensitive', () => {
  const r = resolveIngredient(CATALOGUE, NO_ALIASES, '  BROC  ');
  assert.equal(r.kind === 'matched' && r.item.id, 'p-broccoli');
});

test('resolveIngredient: the matched row carries the unit and on-hand the card shows', () => {
  const r = resolveIngredient(CATALOGUE, NO_ALIASES, 'broc');
  assert.ok(r.kind === 'matched');
  assert.equal(r.item.unit, 'kg');
  assert.equal(r.item.on_hand, 8);
});

// ---------------------------------------------------------------------------
// Ambiguity — two products answer to the same word, so the model must ask
// ---------------------------------------------------------------------------

const TWO_BROCCOLI: CatalogueRow[] = [
  { id: 'p-broccoli', name: 'Broccoli', unit: 'kg', on_hand: 8 },
  { id: 'p-broccoli-florets', name: 'Broccoli Florets', unit: 'kg', on_hand: 3 },
  { id: 'p-carrot', name: 'Carrots Loose', unit: 'kg', on_hand: 40 },
];

test('resolveIngredient: "broc" against two broccoli lines returns candidates, never a pick', () => {
  const r = resolveIngredient(TWO_BROCCOLI, NO_ALIASES, 'broc');
  assert.equal(r.kind, 'ambiguous');
  assert.ok(r.kind === 'ambiguous');
  assert.deepEqual(
    r.candidates.map((c) => c.id).sort(),
    ['p-broccoli', 'p-broccoli-florets'],
  );
});

test('resolveIngredient: naming one of two ambiguous lines exactly resolves it', () => {
  const r = resolveIngredient(TWO_BROCCOLI, NO_ALIASES, 'Broccoli Florets');
  assert.equal(r.kind, 'matched');
  assert.equal(r.kind === 'matched' && r.item.id, 'p-broccoli-florets');
});

test('resolveByName: an ambiguous result is capped at CANDIDATE_LIMIT', () => {
  const many: CatalogueRow[] = Array.from({ length: 7 }, (_, i) => ({
    id: `p-${i}`,
    name: `Broccoli Variant ${i}`,
    unit: 'kg',
    on_hand: i,
  }));
  const r = resolveByName(many, 'broc', (c) => c.name);
  assert.equal(r.kind, 'ambiguous');
  assert.equal(r.kind === 'ambiguous' && r.candidates.length, CANDIDATE_LIMIT);
});

// ---------------------------------------------------------------------------
// Unresolved — a name nothing in the catalogue answers to
// ---------------------------------------------------------------------------

test('resolveIngredient: an unknown product is unresolved, not force-matched', () => {
  const r = resolveIngredient(CATALOGUE, NO_ALIASES, 'quinoa');
  assert.equal(r.kind, 'unresolved');
});

test('resolveIngredient: a blank name is unresolved', () => {
  assert.equal(resolveIngredient(CATALOGUE, NO_ALIASES, '   ').kind, 'unresolved');
});

test('resolveIngredient: an empty catalogue leaves every name unresolved', () => {
  assert.equal(resolveIngredient([], NO_ALIASES, 'broc').kind, 'unresolved');
});

// ---------------------------------------------------------------------------
// Aliases — a human's earlier ruling outranks any score
// ---------------------------------------------------------------------------

test('resolveIngredient: a confirmed alias resolves a name that would otherwise be unresolved', () => {
  const aliases: AliasRow[] = [{ raw_name: 'Green Trees', stock_item_id: 'p-broccoli', status: 'confirmed' }];
  const r = resolveIngredient(CATALOGUE, aliases, 'green trees');
  assert.equal(r.kind, 'matched');
  assert.equal(r.kind === 'matched' && r.item.id, 'p-broccoli');
  assert.equal(r.kind === 'matched' && r.via, 'alias');
});

test('resolveIngredient: a confirmed alias beats an otherwise-ambiguous name score', () => {
  const aliases: AliasRow[] = [{ raw_name: 'broc', stock_item_id: 'p-broccoli-florets', status: 'confirmed' }];
  const r = resolveIngredient(TWO_BROCCOLI, aliases, 'broc');
  assert.equal(r.kind, 'matched');
  assert.equal(r.kind === 'matched' && r.item.id, 'p-broccoli-florets');
  assert.equal(r.kind === 'matched' && r.via, 'alias');
});

test('resolveIngredient: a dismissed alias is ignored — it means "never suggest this"', () => {
  const aliases: AliasRow[] = [{ raw_name: 'green trees', stock_item_id: 'p-broccoli', status: 'dismissed' }];
  assert.equal(resolveIngredient(CATALOGUE, aliases, 'green trees').kind, 'unresolved');
});

test('resolveIngredient: an alias whose product has been deleted resolves to nothing', () => {
  const aliases: AliasRow[] = [{ raw_name: 'green trees', stock_item_id: 'p-gone', status: 'confirmed' }];
  assert.equal(resolveIngredient(CATALOGUE, aliases, 'green trees').kind, 'unresolved');
});

// ---------------------------------------------------------------------------
// Recipes — the same rules, so "which recipe?" is answered as carefully
// ---------------------------------------------------------------------------

const recipe = (id: string, name: string): RecipeRow => ({
  id,
  name,
  output_product: null,
  output_qty: 10,
  output_unit: 'kg',
  output_stock_item_id: null,
});

const RECIPES: RecipeRow[] = [recipe('r-mixed', 'Mixed Veg'), recipe('r-slaw', 'Coleslaw Mix')];

test('resolveRecipe: a partial recipe name matches', () => {
  const r = resolveRecipe(RECIPES, 'mixed veg');
  assert.equal(r.kind === 'matched' && r.item.id, 'r-mixed');
});

test('resolveRecipe: an unknown recipe is unresolved so the tool can refuse by name', () => {
  assert.equal(resolveRecipe(RECIPES, 'ratatouille').kind, 'unresolved');
});

test('resolveRecipe: two recipes answering to the same words come back as candidates', () => {
  const both: RecipeRow[] = [recipe('r-a', 'Mixed Veg'), recipe('r-b', 'Mixed Veg Deluxe')];
  const r = resolveRecipe(both, 'mixed');
  assert.equal(r.kind, 'ambiguous');
  assert.equal(r.kind === 'ambiguous' && r.candidates.length, 2);
});

// ---------------------------------------------------------------------------
// The thresholds themselves — the floor is a decision, not an accident
// ---------------------------------------------------------------------------

test('NAME_ACCEPT sits at the substring tier, so no dice-only guess is ever auto-matched', () => {
  // product-suggest.ts scores every fuzzy match at dice × 0.8, i.e. strictly
  // below 0.8 — so a floor of 0.85 admits literal matches only.
  assert.equal(NAME_ACCEPT, 0.85);
});

test('TIE_MARGIN is a tie-breaker, not a second confidence threshold', () => {
  assert.ok(TIE_MARGIN > 0 && TIE_MARGIN < 0.1);
});
