import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeLineUnitPrice,
  buildSupplierAliasMap,
  itemDescriptionKey,
} from '../lib/platform/price-watch/normalize.ts';

// ---------------------------------------------------------------------------
// normalizeLineUnitPrice
// ---------------------------------------------------------------------------

test('normalizeLineUnitPrice: a pack-size change with a flat per-kg price normalises to the SAME unitPriceBase', () => {
  // Acceptance criterion 3: 10 x 5kg boxes at R100/box vs 5 x 10kg boxes at
  // R200/box are the same produce at the same R20/kg — a pack-size change
  // alone must never look like a price move.
  const before = normalizeLineUnitPrice({
    description: 'Tomatoes Saladette',
    quantity: '10',
    unit: 'boxes',
    unit_price: '100',
    weight: '5', // 5kg per box
    total_kg: '50',
  });
  const after = normalizeLineUnitPrice({
    description: 'Tomatoes Saladette',
    quantity: '5',
    unit: 'boxes',
    unit_price: '200',
    weight: '10', // 10kg per box
    total_kg: '50',
  });
  assert.ok(before && after);
  assert.equal(before.baseUnit, 'kg');
  assert.equal(after.baseUnit, 'kg');
  assert.equal(before.unitPriceBase, 20);
  assert.equal(after.unitPriceBase, 20);
  // Same total kg purchased either way, expressed as one delivery.
  assert.equal(before.quantityBase, 50);
  assert.equal(after.quantityBase, 50);
});

test('normalizeLineUnitPrice: derives per-unit weight from total_kg/quantity when weight itself is blank', () => {
  // total_kg is defined as weight x quantity, so it's recoverable even when
  // the weight field didn't survive extraction (the "... or total_kg" half
  // of "kg when weight/total_kg allow").
  const r = normalizeLineUnitPrice({
    quantity: '4',
    unit: 'pockets',
    unit_price: '60',
    weight: '',
    total_kg: '24', // implies 6kg per pocket
  });
  assert.ok(r);
  assert.equal(r.baseUnit, 'kg');
  assert.equal(r.unitPriceBase, 10); // R60 per 6kg pocket = R10/kg
  assert.equal(r.quantityBase, 24);
});

test('normalizeLineUnitPrice: a row already priced by weight (unit = kg) is used as-is', () => {
  const r = normalizeLineUnitPrice({
    quantity: '120',
    unit: 'kg',
    unit_price: '18.5',
    weight: '',
    total_kg: '',
  });
  assert.ok(r);
  assert.equal(r.baseUnit, 'kg');
  assert.equal(r.unitPriceBase, 18.5);
  assert.equal(r.quantityBase, 120);
});

test('normalizeLineUnitPrice: a row priced in grams converts to a per-kg price via kgTo', () => {
  const r = normalizeLineUnitPrice({
    quantity: '2000', // 2000g
    unit: 'g',
    unit_price: '0.05', // R0.05 per gram
    weight: '',
    total_kg: '',
  });
  assert.ok(r);
  assert.equal(r.baseUnit, 'kg');
  assert.equal(r.unitPriceBase, 50); // R0.05/g x 1000g/kg = R50/kg
  assert.equal(r.quantityBase, 2); // 2000g -> 2kg
});

test('normalizeLineUnitPrice: no weight information at all falls back to per-counting-unit price', () => {
  const r = normalizeLineUnitPrice({
    quantity: '3',
    unit: 'boxes',
    unit_price: '45',
    weight: '',
    total_kg: '',
  });
  assert.ok(r);
  assert.equal(r.baseUnit, 'unit');
  assert.equal(r.unitPriceBase, 45);
  assert.equal(r.quantityBase, 3);
});

test('normalizeLineUnitPrice: zero and negative unit prices are skipped, not clamped', () => {
  assert.equal(normalizeLineUnitPrice({ unit_price: '0', quantity: '10', weight: '5' }), null);
  assert.equal(normalizeLineUnitPrice({ unit_price: '-12.5', quantity: '10', weight: '5' }), null);
  assert.equal(normalizeLineUnitPrice({ unit_price: '', quantity: '10', weight: '5' }), null);
  assert.equal(normalizeLineUnitPrice({ unit_price: 'not a number', quantity: '10' }), null);
});

test('normalizeLineUnitPrice: a missing quantity with only total_kg still yields a usable kg quantity', () => {
  const r = normalizeLineUnitPrice({
    quantity: '',
    unit: 'boxes',
    unit_price: '80',
    weight: '4',
    total_kg: '40',
  });
  assert.ok(r);
  assert.equal(r.baseUnit, 'kg');
  assert.equal(r.unitPriceBase, 20); // R80 per 4kg box = R20/kg
  assert.equal(r.quantityBase, 40); // total_kg used directly
});

// ---------------------------------------------------------------------------
// buildSupplierAliasMap
// ---------------------------------------------------------------------------

test('buildSupplierAliasMap: merges the real truncated pilot names onto the longest observed form', () => {
  // Straight from .ai/implementation.md's pilot findings: Doc-U's own
  // de-truncation is unreliable, so the same market agent shows up under
  // multiple truncated spellings across statements.
  const map = buildSupplierAliasMap([
    'Botha Roodt & Ki',
    'Botha Roodt & Kie',
    'R S A Market Ag',
    'R S A Market Agents',
  ]);
  assert.equal(map.get('Botha Roodt & Ki'), 'Botha Roodt & Kie');
  assert.equal(map.get('Botha Roodt & Kie'), 'Botha Roodt & Kie');
  assert.equal(map.get('R S A Market Ag'), 'R S A Market Agents');
  assert.equal(map.get('R S A Market Agents'), 'R S A Market Agents');
});

test('buildSupplierAliasMap: does not merge names that only share a short, coincidental prefix', () => {
  // "C L De Villiers" and a hypothetical "C L Deviant Traders" share only
  // "c l de" (6 chars) — well under the 12-char floor, so treating them as
  // the same agent would be a guess, not a de-truncation.
  const map = buildSupplierAliasMap(['C L De Villiers', 'C L Deviant Traders', 'Dapper Agencies']);
  assert.equal(map.get('C L De Villiers'), 'C L De Villiers');
  assert.equal(map.get('C L Deviant Traders'), 'C L Deviant Traders');
  assert.equal(map.get('Dapper Agencies'), 'Dapper Agencies');
});

test('buildSupplierAliasMap: merges transitively across a chain of increasingly-complete truncations', () => {
  const map = buildSupplierAliasMap(['Wenpro Market A', 'Wenpro Market Age', 'Wenpro Market Agents']);
  assert.equal(map.get('Wenpro Market A'), 'Wenpro Market Agents');
  assert.equal(map.get('Wenpro Market Age'), 'Wenpro Market Agents');
  assert.equal(map.get('Wenpro Market Agents'), 'Wenpro Market Agents');
});

test('buildSupplierAliasMap: case and punctuation differences merge regardless of length', () => {
  // Same entity, not a truncation guess — always merges.
  const map = buildSupplierAliasMap(['C L De Villiers', 'c.l. de villiers']);
  const canonical = map.get('C L De Villiers');
  assert.equal(map.get('c.l. de villiers'), canonical);
});

test('buildSupplierAliasMap: ties on length break deterministically by localeCompare', () => {
  const map = buildSupplierAliasMap(['AAAAAAAAAAAA', 'aaaaaaaaaaaa']); // identical when folded
  // Both fold to the same string, so it's an exact-fold merge; the
  // canonical choice must be stable and not depend on Set iteration order.
  const c1 = buildSupplierAliasMap(['AAAAAAAAAAAA', 'aaaaaaaaaaaa']).get('AAAAAAAAAAAA');
  const c2 = buildSupplierAliasMap(['aaaaaaaaaaaa', 'AAAAAAAAAAAA']).get('AAAAAAAAAAAA');
  assert.equal(c1, c2);
  assert.equal(map.get('AAAAAAAAAAAA'), c1);
});

test('buildSupplierAliasMap: blank/whitespace-only names are ignored', () => {
  const map = buildSupplierAliasMap(['', '   ', 'Botha Roodt & Kie']);
  assert.equal(map.size, 1);
  assert.equal(map.get('Botha Roodt & Kie'), 'Botha Roodt & Kie');
});

// ---------------------------------------------------------------------------
// itemDescriptionKey
// ---------------------------------------------------------------------------

test('itemDescriptionKey: word order does not matter (reused from procurepulse normalizeName)', () => {
  assert.equal(itemDescriptionKey('Oranges Navel'), itemDescriptionKey('Navel Oranges'));
});

test('itemDescriptionKey: packaging/unit noise and pack-size numbers are dropped', () => {
  assert.equal(itemDescriptionKey('Baby Butternut 300g Punnet'), itemDescriptionKey('Baby Butternut'));
});

test('itemDescriptionKey: genuinely different produce never collides', () => {
  assert.notEqual(itemDescriptionKey('Onions Red'), itemDescriptionKey('Onions White'));
});
