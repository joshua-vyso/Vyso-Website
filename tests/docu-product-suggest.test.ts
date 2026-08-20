import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FUZZY_FLOOR,
  SUGGEST_LIMIT,
  scoreOption,
  scoreProductName,
  suggestProducts,
  type ProductOption,
} from '../lib/platform/docu/product-suggest.ts';

// ---------------------------------------------------------------------------
// The catalogue a Turn 'n Slice reviewer is typing against: a handful of
// pp_stock_items rows, plus one confirmed pp_name_alias for a name the org has
// already ruled on.
// ---------------------------------------------------------------------------
const p = (id: string, name: string, unit: string | null = 'box', hint: string | null = null): ProductOption => ({
  id,
  name,
  unit,
  hint,
});

const CATALOGUE: ProductOption[] = [
  p('p1', 'Tomatoes, Roma', 'box', 'Vegetables'),
  p('p2', 'Apples Golden Delicious', 'kg', 'Fruit'),
  p('p3', 'Bananas', 'kg', 'Fruit'),
  p('p4', 'Pineapple Queen', 'each', 'Fruit'),
  p('p5', 'Butternut', 'bag', 'Vegetables'),
];

test('an exact name scores 1, and the dropdown puts it first', () => {
  assert.equal(scoreProductName('Bananas', 'Bananas'), 1);
  assert.equal(scoreProductName('Bananas', '  bananas '), 1);
  assert.equal(suggestProducts(CATALOGUE, 'Bananas')[0].id, 'p3');
});

test('a prefix beats a mid-word substring, so "apple" offers Apples before Pineapple', () => {
  const names = suggestProducts(CATALOGUE, 'apple').map((o) => o.name);
  assert.deepEqual(names, ['Apples Golden Delicious', 'Pineapple Queen']);
});

test('any WORD of the name can start the match — "gold" finds Apples Golden Delicious', () => {
  const hit = suggestProducts(CATALOGUE, 'gold');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].id, 'p2');
});

test('the picked option carries its unit, so selecting fills the line unit too', () => {
  assert.equal(suggestProducts(CATALOGUE, 'tom')[0].unit, 'box');
  assert.equal(suggestProducts(CATALOGUE, 'butter')[0].unit, 'bag');
});

// ---------------------------------------------------------------------------
// Fuzzy — the reason this reuses ProcurePulse's normalizeName/dice rather than
// a fresh string compare: word order, plurals and typos all have to collapse,
// because a reviewer retyping off a scan produces exactly those.
// ---------------------------------------------------------------------------
test('word order does not matter: "roma tomato" finds "Tomatoes, Roma"', () => {
  assert.equal(suggestProducts(CATALOGUE, 'roma tomato')[0].id, 'p1');
});

test('a plural/spelling slip still lands — "tomatos roma"', () => {
  assert.equal(suggestProducts(CATALOGUE, 'tomatos roma')[0].id, 'p1');
});

test('a partial second word is fuzzy-matched above the floor', () => {
  assert.ok(scoreProductName('Tomatoes, Roma', 'tomatoes cherry') >= FUZZY_FLOOR * 0.8);
});

test('every fuzzy score stays below every literal one', () => {
  const substring = scoreProductName('Pineapple Queen', 'apple');
  const fuzzy = scoreProductName('Tomatoes, Roma', 'tomatoes cherry');
  assert.ok(fuzzy < substring, `${fuzzy} should be under the substring tier ${substring}`);
});

test('an unrelated query offers nothing rather than the nearest thing', () => {
  assert.deepEqual(suggestProducts(CATALOGUE, 'zzzqqq'), []);
  assert.equal(scoreProductName('Bananas', 'invoice total'), 0);
});

// ---------------------------------------------------------------------------
// Shape of the list
// ---------------------------------------------------------------------------
test('an empty query offers the head of the catalogue, in the order given', () => {
  const head = suggestProducts(CATALOGUE, '   ', 3).map((o) => o.id);
  assert.deepEqual(head, ['p1', 'p2', 'p3']);
});

test('an alias spelled exactly like its product collapses to one row', () => {
  const withAlias = [...CATALOGUE, p('a1', 'bananas', 'kg', 'also read as')];
  const hits = suggestProducts(withAlias, 'banana');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'p3', 'the product wins, because the caller lists products first');
});

// ---------------------------------------------------------------------------
// Aliases — a confirmed pp_name_alias is a way of FINDING a product, never a
// name to write back into the line.
// ---------------------------------------------------------------------------
const ALIASED: ProductOption[] = [
  { ...p('p1', 'Tomatoes, Roma', 'box', 'Vegetables'), aka: ['Toms Roma', 'TOMATO ROMA 5KG'] },
  p('p3', 'Bananas', 'kg', 'Fruit'),
];

test("typing a supplier's spelling finds the product — and inserts the org's name", () => {
  const hit = suggestProducts(ALIASED, 'toms roma');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].name, 'Tomatoes, Roma', 'the alias matched; the canonical name is what gets inserted');
  assert.equal(hit[0].unit, 'box');
});

test('an option scores as its best-matching name, canonical or alias', () => {
  assert.equal(scoreOption(ALIASED[0], 'Tomatoes, Roma'), 1);
  assert.ok(scoreOption(ALIASED[0], 'TOMATO ROMA') > 0.8);
  assert.equal(scoreOption(ALIASED[1], 'toms'), 0, 'aliases belong to their own product only');
});

test('collapsing a duplicate name keeps both entries findable', () => {
  const dup: ProductOption[] = [
    p('p1', 'Tomatoes, Roma', 'box', 'Vegetables'),
    { ...p('a2', 'Tomatoes, Roma', 'box', null), aka: ['Toms Roma'] },
  ];
  const hits = suggestProducts(dup, 'toms roma');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'p1');
});

test('the list is capped', () => {
  const many = Array.from({ length: 40 }, (_, i) => p(`m${i}`, `Melon ${i}`));
  assert.equal(suggestProducts(many, 'melon').length, SUGGEST_LIMIT);
  assert.equal(suggestProducts(many, 'melon', 3).length, 3);
});

test('blank and malformed names are never offered', () => {
  const messy = [p('b1', '   '), p('b2', ''), ...CATALOGUE];
  assert.equal(suggestProducts(messy, '', 2).length, 2);
  assert.ok(suggestProducts(messy, 'tom').every((o) => o.name.trim().length > 0));
});
