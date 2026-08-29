import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_MATCH_FLOOR,
  SUGGEST_FLOOR,
  bestCatalogueCandidate,
  matchReasonLabel,
  normaliseUnit,
  priceSourceLabel,
  qualifiersConflict,
  resolveOrderLines,
  scoreCatalogueMatch,
  stripCategoryPrefix,
  unitsCompatible,
  type CatalogueItem,
  type OrderLineInput,
} from '../lib/platform/docu/order-line-match.ts';
import { normalizeName } from '../lib/platform/procurepulse/matching.ts';

// ---------------------------------------------------------------------------
// The Turn 'n Slice failure.
//
// A three-page NebulaPOS "Purchase Order" from Bakubung Bush Lodge to Turn 'n
// Slice was read, matched and invoiced at R25,958.95 against a paper total of
// R13,457.60. Not one figure had been misread — every wrong line multiplied out
// perfectly, because the arithmetic is done downstream from the product. The
// PRODUCTS were what went wrong, and each wrong product was then priced from
// Turn 'n Slice's own price list, which is correct behaviour applied to the
// wrong row.
//
// The nine lines named in the failure report are reproduced here verbatim; the
// rest of the eighteen are ordinary lines of the same document family (the same
// "FF - " / "VEG - " NebulaPOS category prefixes, the same produce) and are here
// as the regression guard in the other direction — tightening the matcher until
// the failures stop must not stop the ordinary lines matching.
// ---------------------------------------------------------------------------

/** Turn 'n Slice's catalogue, as the failing lines found it. */
const CATALOGUE: CatalogueItem[] = [
  { id: 'p-apples-top-red', name: 'Apples Top Red', unit: 'boxes' },
  { id: 'p-avocado', name: 'Avocado (box)', unit: 'boxes' },
  { id: 'p-grapes-white', name: 'Grapes White', unit: 'boxes' },
  { id: 'p-grapes-black', name: 'Grapes Black', unit: 'boxes' },
  { id: 'p-strawberries', name: 'Strawberries', unit: 'packets' },
  { id: 'p-cabbage', name: 'Cabbage', unit: 'each' },
  { id: 'p-cauliflower', name: 'Cauliflower', unit: 'each' },
  // The catalogue carries BABY sweet corn and no plain sweet corn. That absence
  // is the whole point: the paper's "Sweet Corn" has no right answer here.
  { id: 'p-baby-sweet-corn', name: 'Baby Sweet Corn', unit: 'punnets' },
  { id: 'p-tomato-yellow-cocktail', name: 'Tomato-Yellow Cocktail', unit: 'punnets' },
  { id: 'p-patty-pan', name: 'Patty Pan', unit: 'punnets' },
  { id: 'p-peppers-green', name: 'Peppers Green', unit: 'boxes' },
  { id: 'p-peppers-red', name: 'Peppers Red', unit: 'boxes' },
  { id: 'p-peppers-yellow', name: 'Peppers Yellow', unit: 'boxes' },
  { id: 'p-naartjies', name: 'Naartjies', unit: 'boxes' },
  { id: 'p-baby-marrow', name: 'Baby Marrow', unit: 'boxes' },
  { id: 'p-tomatoes-round', name: 'Tomatoes Round', unit: 'boxes' },
  { id: 'p-butternut-whole', name: 'Butternut Whole', unit: 'boxes' },
  { id: 'p-butternut-cubed', name: 'Butternut Cubed', unit: 'packets' },
  { id: 'p-bananas', name: 'Bananas', unit: 'boxes' },
  { id: 'p-lettuce-iceberg', name: 'Lettuce Iceberg', unit: 'each' },
];

/**
 * The eighteen paper lines. `raw_description` is what is printed; `description`
 * is what the reader proposed — including, on the four failing rows, the wrong
 * catalogue name it resolved to. The resolver must ignore that rewrite entirely
 * and work from the paper, which is the first of this module's rules.
 */
const PAPER_LINES: OrderLineInput[] = [
  // — the failure report's own lines —
  { raw_description: 'FF - APPLES TOP RED BOX', description: 'Apples Top Red', quantity: '1', unit: 'boxes', unit_price: '569.90' },
  { raw_description: 'FF - AVOCADO BOX', description: 'Avocado', quantity: '4', unit: 'boxes', unit_price: '189.00' },
  // The row that became a SECOND Avocado line, taking the price of a product it
  // shares not one word with.
  { raw_description: 'FF - GRAPES WHITE BOX', description: 'Avocado', quantity: '2', unit: 'boxes', unit_price: '' },
  { raw_description: 'FF - GRAPES BLACK BOX', description: 'Grapes Black', quantity: '2', unit: 'boxes', unit_price: '659.00' },
  { raw_description: 'FF - STRAWBERRIES PKT', description: 'Strawberries', quantity: '20', unit: 'packets', unit_price: '29.90' },
  // Rendered as "Cabbage" — a product it shares not one word with either.
  { raw_description: 'VEG - MIX VEGETABLES 2 PKT', description: 'Cabbage', quantity: '2', unit: 'packets', unit_price: '' },
  { raw_description: 'VEG - CAULIFLOWER', description: 'Cauliflower', quantity: '25', unit: 'each', unit_price: '30.90' },
  // Became "Baby Sweet Corn": R46.40 a unit on the paper, R375 on ours.
  { raw_description: 'VEG - SWEET CORN', description: 'Baby Sweet Corn', quantity: '15', unit: 'punnets', unit_price: '46.40' },
  // Became a SECOND "Tomato-Yellow Cocktail" row.
  { raw_description: 'VEG - PATTY PAN YELLOW', description: 'Tomato-Yellow Cocktail', quantity: '20', unit: 'punnets', unit_price: '23.50' },
  // — the document's ordinary lines, which must keep matching —
  { raw_description: 'VEG - PEPPERS GREEN', description: 'Peppers Green', quantity: '3', unit: 'boxes', unit_price: '' },
  { raw_description: 'VEG - PEPPERS RED', description: 'Peppers Red', quantity: '2', unit: 'boxes', unit_price: '' },
  { raw_description: 'VEG - PEPPERS YELLOW', description: 'Peppers Yellow', quantity: '2', unit: 'boxes', unit_price: '' },
  { raw_description: 'FF - NAARTJIES BOX', description: 'Naartjies', quantity: '1', unit: 'boxes', unit_price: '' },
  { raw_description: 'VEG - BABY MARROW', description: 'Baby Marrow', quantity: '4', unit: 'boxes', unit_price: '' },
  { raw_description: 'VEG - TOMATOES ROUND', description: 'Tomatoes Round', quantity: '6', unit: 'boxes', unit_price: '' },
  { raw_description: 'VEG - BUTTERNUT WHOLE', description: 'Butternut Whole', quantity: '3', unit: 'boxes', unit_price: '' },
  { raw_description: 'FF - BANANAS BOX', description: 'Bananas', quantity: '2', unit: 'boxes', unit_price: '' },
  { raw_description: 'VEG - LETTUCE ICEBERG', description: 'Lettuce Iceberg', quantity: '8', unit: 'each', unit_price: '' },
];

const byRaw = (raw: string) => {
  const i = PAPER_LINES.findIndex((l) => l.raw_description === raw);
  assert.notEqual(i, -1, `fixture has no line "${raw}"`);
  return i;
};

// ---------------------------------------------------------------------------
// The whole document
// ---------------------------------------------------------------------------

test('the Bakubung order: no catalogue product is assigned to two paper lines', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  assert.equal(resolved.length, 18, 'every paper line survives resolution');

  const seen = new Map<string, string[]>();
  for (const r of resolved) {
    if (!r.item) continue;
    const rows = seen.get(r.item.id) ?? [];
    rows.push(r.rawName);
    seen.set(r.item.id, rows);
  }
  for (const [id, rows] of seen) {
    assert.equal(rows.length, 1, `product ${id} was assigned to ${rows.length} lines: ${rows.join(' | ')}`);
  }
});

test('the Bakubung order: every unmatched line keeps the paper text and gets no price', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  const unmatched = resolved.filter((r) => !r.matched);
  assert.ok(unmatched.length > 0, 'the document is supposed to have lines it cannot resolve');

  for (const r of unmatched) {
    // The paper's own words, exactly as printed — not the reader's rewrite.
    assert.equal(r.rawName, PAPER_LINES[r.index].raw_description);
    // And they are what the line is billed as, so nothing downstream can price it
    // from a product we merely suspected.
    assert.equal(r.name, r.rawName);
    assert.equal(r.item, null);
    assert.notEqual(r.reason, 'matched');
  }
});

test('the Bakubung order: every line carries provenance a reviewer can act on', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  for (const [i, r] of resolved.entries()) {
    assert.equal(r.index, i);
    assert.ok(r.rawName.length > 0, 'raw paper text is always present');
    assert.ok(r.name.length > 0);
    assert.ok(r.confidence >= 0 && r.confidence <= 100);
    assert.ok(matchReasonLabel(r.reason).length > 0, 'every reason has a human sentence');
    // A suggestion, when offered, must be a real catalogue row — review turns it
    // into one click, so a dangling id would be a dead button.
    if (r.suggestion) {
      assert.ok(CATALOGUE.some((c) => c.id === r.suggestion!.id && c.name === r.suggestion!.name));
      assert.ok(r.suggestion.confidence >= Math.round(SUGGEST_FLOOR * 100));
    }
    // Matched lines are billed under the catalogue name; refused lines never are.
    if (r.matched) assert.equal(r.name, r.item?.name);
  }
});

test('the Bakubung order: the ordinary lines still match — the fix is not just a blanket refusal', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  const expected: Record<string, string> = {
    'FF - APPLES TOP RED BOX': 'p-apples-top-red',
    'FF - AVOCADO BOX': 'p-avocado',
    'FF - GRAPES WHITE BOX': 'p-grapes-white',
    'FF - GRAPES BLACK BOX': 'p-grapes-black',
    'FF - STRAWBERRIES PKT': 'p-strawberries',
    'VEG - CAULIFLOWER': 'p-cauliflower',
    'VEG - PEPPERS GREEN': 'p-peppers-green',
    'VEG - PEPPERS RED': 'p-peppers-red',
    'VEG - PEPPERS YELLOW': 'p-peppers-yellow',
    'FF - NAARTJIES BOX': 'p-naartjies',
    'VEG - BABY MARROW': 'p-baby-marrow',
    'VEG - TOMATOES ROUND': 'p-tomatoes-round',
    'VEG - BUTTERNUT WHOLE': 'p-butternut-whole',
    'FF - BANANAS BOX': 'p-bananas',
    'VEG - LETTUCE ICEBERG': 'p-lettuce-iceberg',
  };
  for (const [raw, id] of Object.entries(expected)) {
    const r = resolved[byRaw(raw)];
    assert.equal(r.item?.id, id, `"${raw}" should match ${id}, got ${r.item?.id ?? r.reason}`);
    assert.equal(r.matched, true);
  }
});

// ---------------------------------------------------------------------------
// The four failures, one at a time
// ---------------------------------------------------------------------------

test('"FF - GRAPES WHITE BOX" is never the Avocado line, whatever the reader proposed', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  const r = resolved[byRaw('FF - GRAPES WHITE BOX')];
  assert.notEqual(r.item?.id, 'p-avocado');
  // The reader's rewrite said "Avocado". The resolver read the paper instead.
  assert.equal(r.item?.id, 'p-grapes-white');
  assert.equal(r.rawName, 'FF - GRAPES WHITE BOX');
});

test('white grapes fall to review rather than to black grapes when the catalogue lacks them', () => {
  // The same line against a catalogue that carries only BLACK grapes. This is the
  // shape of the original failure with the near-miss removed: there is no right
  // answer, so there must be no answer.
  const withoutWhite = CATALOGUE.filter((c) => c.id !== 'p-grapes-white');
  const [r] = resolveOrderLines([{ raw_description: 'FF - GRAPES WHITE BOX', description: 'Avocado' }], withoutWhite);
  assert.equal(r.matched, false);
  assert.equal(r.item, null);
  assert.equal(r.reason, 'variant_conflict');
  assert.equal(r.name, 'FF - GRAPES WHITE BOX');
  // Refused, but not silently: review reads "we considered Grapes Black".
  assert.equal(r.suggestion?.id, 'p-grapes-black');
});

test('"Sweet Corn" does not become "Baby Sweet Corn" — a size word is a different product', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  const r = resolved[byRaw('VEG - SWEET CORN')];
  assert.equal(r.matched, false);
  assert.equal(r.item, null);
  assert.equal(r.reason, 'low_confidence');
  assert.equal(r.name, 'VEG - SWEET CORN');
  assert.equal(r.suggestion?.id, 'p-baby-sweet-corn', 'the near miss is shown, not taken');
  // The exact band the old token-overlap matcher accepted, and the reason
  // AUTO_MATCH_FLOOR sits above it.
  assert.ok(r.confidence < Math.round(AUTO_MATCH_FLOOR * 100));
  assert.ok(r.confidence >= Math.round(SUGGEST_FLOOR * 100));
});

test('"Patty Pan Yellow" does not become a second "Tomato-Yellow Cocktail"', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  const r = resolved[byRaw('VEG - PATTY PAN YELLOW')];
  assert.notEqual(r.item?.id, 'p-tomato-yellow-cocktail');
  assert.equal(r.matched, false);
  assert.equal(r.name, 'VEG - PATTY PAN YELLOW');
  // A shared colour word is not a shared identity; the closest thing in the
  // catalogue is the patty pan, and even that is only a suggestion.
  assert.equal(r.suggestion?.id, 'p-patty-pan');
});

test('"Mix Vegetables" does not become "Cabbage" — nothing in the catalogue is it', () => {
  const resolved = resolveOrderLines(PAPER_LINES, CATALOGUE);
  const r = resolved[byRaw('VEG - MIX VEGETABLES 2 PKT')];
  assert.equal(r.matched, false);
  assert.equal(r.item, null);
  assert.equal(r.reason, 'no_candidate');
  assert.equal(r.name, 'VEG - MIX VEGETABLES 2 PKT');
  assert.equal(r.suggestion, null, 'inventing a suggestion here would be the same guess in a softer voice');
});

// ---------------------------------------------------------------------------
// The document-wide rule
// ---------------------------------------------------------------------------

test('two paper lines landing on one product send BOTH to review, not one', () => {
  const lines: OrderLineInput[] = [
    { raw_description: 'FF - AVOCADO BOX', description: 'Avocado' },
    { raw_description: 'AVOCADOS', description: 'Avocado' },
    { raw_description: 'VEG - CAULIFLOWER', description: 'Cauliflower' },
  ];
  const resolved = resolveOrderLines(lines, CATALOGUE);
  for (const i of [0, 1]) {
    assert.equal(resolved[i].matched, false, 'keeping the first and dropping the second loses a real line');
    assert.equal(resolved[i].item, null);
    assert.equal(resolved[i].reason, 'duplicate');
    assert.equal(resolved[i].name, resolved[i].rawName, 'both fall back to the paper’s words');
    assert.equal(resolved[i].suggestion?.id, 'p-avocado', 'each still shows what it collided on');
  }
  // The uninvolved line is untouched — a duplicate is not a document-wide alarm.
  assert.equal(resolved[2].item?.id, 'p-cauliflower');
  assert.equal(resolved[2].matched, true);
});

test('a confirmed customer alias pins a line past the gate, but not past the duplicate rule', () => {
  const pinned = CATALOGUE.find((c) => c.id === 'p-cabbage')!;
  const lines: OrderLineInput[] = [
    { raw_description: 'THEIR OWN CODE 4471' },
    { raw_description: 'VEG - CAULIFLOWER' },
  ];
  // A human ruled that "THEIR OWN CODE 4471" is Cabbage — nothing about the
  // string says so, and the pin is honoured anyway.
  const one = resolveOrderLines(lines, CATALOGUE, { pins: new Map([[0, pinned]]) });
  assert.equal(one[0].matched, true);
  assert.equal(one[0].item?.id, 'p-cabbage');
  assert.equal(one[0].confidence, 100);

  // Two pins onto one product is still two paper lines and one product.
  const both = resolveOrderLines(lines, CATALOGUE, {
    pins: new Map([
      [0, pinned],
      [1, pinned],
    ]),
  });
  assert.equal(both[0].reason, 'duplicate');
  assert.equal(both[1].reason, 'duplicate');
  assert.equal(both[0].matched, false);
  assert.equal(both[1].matched, false);
});

test('a line with no paper text at all resolves to nothing rather than to something', () => {
  const [r] = resolveOrderLines([{ raw_description: '   ', description: '' }], CATALOGUE);
  assert.equal(r.rawName, '');
  assert.equal(r.matched, false);
  assert.equal(r.item, null);
  assert.equal(r.suggestion, null);
});

test('a document predating raw capture falls back to the reader’s description', () => {
  // Older documents have only `description`. They must still resolve — degraded
  // to matching on a rewrite, which is what the whole change moves away from,
  // but not broken.
  const [r] = resolveOrderLines([{ description: 'Cauliflower' }], CATALOGUE);
  assert.equal(r.rawName, 'Cauliflower');
  assert.equal(r.item?.id, 'p-cauliflower');
});

// ---------------------------------------------------------------------------
// The primitives
// ---------------------------------------------------------------------------

test('qualifiersConflict fires only when both names speak to the same qualifier', () => {
  const n = normalizeName;
  assert.equal(qualifiersConflict(n('Grapes White'), n('Grapes Black')), true);
  assert.equal(qualifiersConflict(n('Peppers Green'), n('Peppers Red')), true);
  assert.equal(qualifiersConflict(n('Butternut Whole'), n('Butternut Cubed')), true);
  // Silence about colour is not a different colour — it is less specificity,
  // which AUTO_MATCH_FLOOR handles on its own.
  assert.equal(qualifiersConflict(n('Grapes'), n('Grapes White')), false);
  assert.equal(qualifiersConflict(n('Sweet Corn'), n('Baby Sweet Corn')), false);
  // Same qualifier on both sides is agreement, not conflict.
  assert.equal(qualifiersConflict(n('Peppers Yellow'), n('Yellow Peppers')), false);
  // "Mix" and "Mixed" are one qualifier spelled two ways.
  assert.equal(qualifiersConflict(n('Mix Vegetables'), n('Mixed Vegetables')), false);
});

test('scoreCatalogueMatch returns 0 on a qualifier disagreement however alike the strings are', () => {
  assert.equal(scoreCatalogueMatch('FF - GRAPES WHITE BOX', 'Grapes Black'), 0);
  assert.equal(scoreCatalogueMatch('Butternut Whole', 'Butternut Cubed'), 0);
  assert.equal(scoreCatalogueMatch('FF - GRAPES WHITE BOX', 'Grapes White'), 1);
});

test('stripCategoryPrefix drops a POS category code and nothing else', () => {
  assert.equal(stripCategoryPrefix('FF - GRAPES WHITE BOX'), 'GRAPES WHITE BOX');
  assert.equal(stripCategoryPrefix('VEG - CARROTS'), 'CARROTS');
  assert.equal(stripCategoryPrefix('PSAL - MIXED LEAF'), 'MIXED LEAF');
  // Not a category code: a hyphenated product name keeps its own words.
  assert.equal(stripCategoryPrefix('Tomato-Yellow Cocktail'), 'Tomato-Yellow Cocktail');
  assert.equal(stripCategoryPrefix('Strawberries'), 'Strawberries');
});

test('bestCatalogueCandidate is ungated — it reports the near miss it will not take', () => {
  const c = bestCatalogueCandidate('VEG - SWEET CORN', CATALOGUE);
  assert.equal(c?.item.id, 'p-baby-sweet-corn');
  assert.ok(c!.score > 0 && c!.score < AUTO_MATCH_FLOOR, 'reported, and below the auto-assign floor');
});

test('priceSourceLabel names where the money came from, including "nowhere"', () => {
  // Pricing an order from the org's own list is correct — a supplier bills at its
  // own prices — so the label says so rather than hiding it behind a bare number.
  assert.match(priceSourceLabel('price_list', 'Lodge Rates'), /price list.*Lodge Rates/);
  assert.match(priceSourceLabel('document'), /document/i);
  assert.match(priceSourceLabel('none'), /not invoice/i);
  assert.ok(priceSourceLabel('custom', null).length > 0);
  assert.ok(priceSourceLabel('base').length > 0);
});

// ---------------------------------------------------------------------------
// TRY → tray (Capital ground truth, PO POPAR-0017754)
//
// RIDER 3 (plan_customer_uom_rules.md, NON-NEGOTIABLE 3): this block is
// written and run FIRST, against the UNIT_ALIASES table as it stood before
// this change (no "try" entry) — its failure is captured verbatim in
// .ai/implementation_customer_uom_rules.md. Only once that failure was
// recorded was `try: 'tray'` added below. Do not reorder this block relative
// to the mapping it tests, and do not delete the failure record afterwards —
// it is the evidence the test-first rule was actually followed.
// ---------------------------------------------------------------------------

test('TRY folds to tray — Capital prints TRY on its punnet-packet lines', () => {
  assert.equal(normaliseUnit('TRY'), 'tray');
  assert.equal(normaliseUnit('try'), 'tray');
});

test('a printed TRY line is pack-compatible with a catalogue product sold by the tray', () => {
  const strawberryTray: CatalogueItem = {
    id: 'p-strawberry-tray',
    name: 'Strawberry 250gr Punnet Packet',
    unit: 'tray',
  };
  assert.equal(unitsCompatible('TRY', strawberryTray.unit), true);
});
