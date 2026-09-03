import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalMarketName,
  dedupeByReference,
  formatPackKg,
  parseMarketCommodity,
} from '../lib/platform/docu/market-line.ts';

// Real commodity cells from the April/May 2026 Johannesburg market statements.
test('parses the market commodity record', () => {
  const p = parseMarketCommodity('BANANAS,18KG BANAN,HAND,1,XL,*,*');
  assert.ok(p);
  assert.equal(p.commodity, 'BANANAS');
  assert.equal(p.pack, '18KG BANAN');
  assert.equal(p.packKg, 18);
  assert.equal(p.variety, 'HAND');
  assert.deepEqual(p.codes, ['1', 'XL', '*', '*']);
});

test('gram packs convert to kilograms; "*" variety is null', () => {
  const p = parseMarketCommodity('BABY BUTTERNUT,300G PUNNE,*,0,*,12,*');
  assert.ok(p);
  assert.equal(p.packKg, 0.3);
  assert.equal(p.variety, null);
});

test('ordinary invoice descriptions are not market lines', () => {
  assert.equal(parseMarketCommodity('Cheddar cheese 5kg block'), null);
  assert.equal(parseMarketCommodity('Chicken, fillets, frozen'), null);
  assert.equal(parseMarketCommodity(''), null);
  assert.equal(parseMarketCommodity(null), null);
});

test('canonical names carry commodity, variety and pack weight only', () => {
  assert.equal(canonicalMarketName('BANANAS,18KG BANAN,HAND,1,XL,*,*'), 'Bananas Hand 18kg');
  assert.equal(canonicalMarketName('BANANAS,18KG BANAN,HAND,1,L,*,*'), 'Bananas Hand 18kg');
  assert.equal(canonicalMarketName('LETTUCE,500G PUNNE,*,0,*,8,*'), 'Lettuce 500g');
  assert.equal(canonicalMarketName('LETTUCE,500G PUNNE,*,0,*,10,*'), 'Lettuce 500g');
  assert.equal(canonicalMarketName('PARSLEY,3KG TOMATO,*,0,*,*,*'), 'Parsley 3kg');
  assert.equal(canonicalMarketName('PARSLEY,2KG MASONI,FLAT,0,*,*,*'), 'Parsley Flat 2kg');
  assert.equal(canonicalMarketName('APPLES,18.50KG CA,GRANNY SMI,1,*,90,*'), 'Apples Granny Smi 18.5kg');
  assert.equal(canonicalMarketName('CORIANDER/DHANYA,3KG TOMATO,*,0,*,*,*'), 'Coriander Dhanya 3kg');
  assert.equal(canonicalMarketName('POTATOES,10KG POCKE,MONDIAL,1,L,*,YEL'), 'Potatoes Mondial 10kg');
  assert.equal(canonicalMarketName('Not a market line'), null);
});

test('pack weights format without float noise', () => {
  assert.equal(formatPackKg(0.3), '300g');
  assert.equal(formatPackKg(0.125), '125g');
  assert.equal(formatPackKg(18.5), '18.5kg');
  assert.equal(formatPackKg(400), '400kg');
});

test('a re-listed reference with identical figures is dropped', () => {
  const lines = [
    { reference: '162652334', quantity: '132', unit_price: '200.00', amount: '26400.00', description: 'Red Peppers' },
    { reference: '162652345', quantity: '40', unit_price: '50.00', amount: '2000.00', description: 'Cabbage' },
    { reference: '162652334', quantity: '132', unit_price: '200.00', amount: '26400.00', description: 'Red Peppers' },
    { reference: '162652345', quantity: '40', unit_price: '50.00', amount: '2000.00', description: 'Cabbage' },
  ];
  const r = dedupeByReference(lines);
  assert.equal(r.lines.length, 2);
  assert.equal(r.dropped, 2);
  assert.equal(r.conflicting, 0);
});

test('a repeated reference with different figures is kept and counted', () => {
  const r = dedupeByReference([
    { reference: '162973365', quantity: '-5', unit_price: '80.00', amount: '-400.00' },
    { reference: '162973365', quantity: '20', unit_price: '80.00', amount: '1600.00' },
  ]);
  assert.equal(r.lines.length, 2);
  assert.equal(r.dropped, 0);
  assert.equal(r.conflicting, 1);
});

test('rows without a reference are never de-duplicated', () => {
  // Two boxes of the same cabbage at the same price from two invoices is normal.
  const r = dedupeByReference([
    { quantity: '80', unit_price: '50.00', amount: '4000.00' },
    { quantity: '80', unit_price: '50.00', amount: '4000.00' },
    { reference: '', quantity: '80', unit_price: '50.00', amount: '4000.00' },
  ]);
  assert.equal(r.lines.length, 3);
  assert.equal(r.dropped, 0);
});
