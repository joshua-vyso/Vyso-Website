/**
 * LEARNED, COUNTERPARTY-SCOPED PRODUCT LINKS.
 *
 * The thing these tests exist to hold down is the SCOPE. A learned link is a
 * fact about one business's vocabulary — Indaba writes "strawberries" and means
 * the 250g punnets — and the moment it leaks to a second customer it stops being
 * a fact and becomes a guess with a confirmation's authority attached, which is
 * strictly worse than the fuzzy match it replaced: the review screen prints
 * "Learned from your confirmation" beside it, so a reviewer has every reason to
 * trust it and no way to see that nobody ever confirmed it for THEM.
 *
 * So the no-leak case below is not an edge case. It is the feature.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALIAS_SOURCE_REVIEW_CONFIRM,
  aliasKey,
  aliasProvenanceLabel,
  bubbleIsGood,
  bubbleState,
  bubbleText,
  indexAliasesForCustomer,
  lookupAlias,
  pendingConfirmations,
  shortDate,
  type CustomerItemAliasLite,
  type LineConfirmation,
} from '../lib/platform/docu/customer-item-alias.ts';
import { resolveOrderLines, type CatalogueItem } from '../lib/platform/docu/order-line-match.ts';

const INDABA = 'cust-indaba';
const SANDTON = 'cust-sandton';

/** A catalogue where "STRAWBERRIES" genuinely matches nothing. */
const CATALOGUE: CatalogueItem[] = [
  { id: 'p-punnet', name: 'Strawberry Punnets 250g', unit: 'punnets' },
  { id: 'p-sweetcorn', name: 'Sweet Corn (kg)', unit: null },
  { id: 'p-babycorn', name: 'Baby Sweet Corn', unit: null },
];

const LEARNED_FOR_INDABA: CustomerItemAliasLite = {
  customer_id: INDABA,
  raw_name: 'STRAWBERRIES',
  stock_item_id: 'p-punnet',
  source: ALIAS_SOURCE_REVIEW_CONFIRM,
  created_at: '2026-08-14T09:12:00.000Z',
  updated_at: '2026-08-14T09:12:00.000Z',
};

// ---------------------------------------------------------------------------
// The key
// ---------------------------------------------------------------------------

test('aliasKey folds the printer noise a POS varies between runs', () => {
  assert.equal(aliasKey('VEG - SWEET CORN PKT Each'), 'veg - sweet corn pkt each');
  assert.equal(aliasKey('  VEG -  Sweet   Corn Pkt  each '), 'veg - sweet corn pkt each');
});

test('aliasKey keeps the pack word — a packet is not a box', () => {
  assert.notEqual(aliasKey('SWEET CORN PKT'), aliasKey('SWEET CORN BOX'));
});

test('aliasKey on nothing is nothing, and nothing never matches', () => {
  assert.equal(aliasKey(''), '');
  assert.equal(aliasKey(null), '');
  assert.equal(aliasKey('   '), '');
  const index = indexAliasesForCustomer([{ ...LEARNED_FOR_INDABA, raw_name: '   ' }], INDABA);
  assert.equal(index.size, 0);
});

// ---------------------------------------------------------------------------
// The scope — the whole point
// ---------------------------------------------------------------------------

test('a link learned for one customer is invisible to another', () => {
  const forIndaba = indexAliasesForCustomer([LEARNED_FOR_INDABA], INDABA);
  const forSandton = indexAliasesForCustomer([LEARNED_FOR_INDABA], SANDTON);
  assert.equal(lookupAlias(forIndaba, 'STRAWBERRIES')?.stock_item_id, 'p-punnet');
  assert.equal(lookupAlias(forSandton, 'STRAWBERRIES'), null);
});

test('no customer named yet → no vocabulary to read', () => {
  assert.equal(indexAliasesForCustomer([LEARNED_FOR_INDABA], null).size, 0);
});

test('the same raw text resolves for Indaba and stays unmatched for Sandton Sun', () => {
  const line = [{ raw_description: 'STRAWBERRIES' }];

  const forIndaba = indexAliasesForCustomer([LEARNED_FOR_INDABA], INDABA);
  const pinned = CATALOGUE.find((c) => c.id === lookupAlias(forIndaba, 'STRAWBERRIES')?.stock_item_id)!;
  const indaba = resolveOrderLines(line, CATALOGUE, { pins: new Map([[0, pinned]]) });
  assert.equal(indaba[0].matched, true);
  assert.equal(indaba[0].item?.id, 'p-punnet');
  assert.equal(indaba[0].confidence, 100);

  const forSandton = indexAliasesForCustomer([LEARNED_FOR_INDABA], SANDTON);
  assert.equal(lookupAlias(forSandton, 'STRAWBERRIES'), null);
  const sandton = resolveOrderLines(line, CATALOGUE, { pins: new Map() });
  assert.equal(sandton[0].matched, false);
  // And it keeps the paper's own words, unpriced, exactly as before.
  assert.equal(sandton[0].name, 'STRAWBERRIES');
});

// ---------------------------------------------------------------------------
// Precedence
// ---------------------------------------------------------------------------

test('the paper’s words are looked up before the reader’s rewrite', () => {
  const index = indexAliasesForCustomer(
    [
      LEARNED_FOR_INDABA,
      { ...LEARNED_FOR_INDABA, raw_name: 'Strawberries, fresh', stock_item_id: 'p-sweetcorn' },
    ],
    INDABA,
  );
  // Raw wins even when the rewrite also has a ruling of its own.
  assert.equal(lookupAlias(index, 'STRAWBERRIES', 'Strawberries, fresh')?.stock_item_id, 'p-punnet');
  // The rewrite is consulted only when the paper text has no ruling.
  assert.equal(lookupAlias(index, 'PUNNETS SPECIAL', 'Strawberries, fresh')?.stock_item_id, 'p-sweetcorn');
});

test('a learned link beats the matcher, not just the blank', () => {
  // Left alone, this line matches Sweet Corn (kg) on its own. The human has
  // ruled that this customer means the baby corn by it; the ruling wins.
  const unpinned = resolveOrderLines([{ raw_description: 'Sweet Corn' }], CATALOGUE);
  assert.equal(unpinned[0].item?.id, 'p-sweetcorn');

  const pinned = resolveOrderLines([{ raw_description: 'Sweet Corn' }], CATALOGUE, {
    pins: new Map([[0, CATALOGUE[2]]]),
  });
  assert.equal(pinned[0].item?.id, 'p-babycorn');
  assert.equal(pinned[0].confidence, 100);
});

test('a learned link does not buy an exemption from one-product-one-line', () => {
  // Two paper rows pinned to the same product is still a lost line, whoever
  // decided the mapping. Both go back to review carrying the paper's words.
  const out = resolveOrderLines(
    [{ raw_description: 'STRAWBERRIES' }, { raw_description: 'Straws' }],
    CATALOGUE,
    { pins: new Map([[0, CATALOGUE[0]], [1, CATALOGUE[0]]]) },
  );
  assert.equal(out[0].reason, 'duplicate');
  assert.equal(out[1].reason, 'duplicate');
  assert.equal(out[0].name, 'STRAWBERRIES');
});

// ---------------------------------------------------------------------------
// The pack guard, demoted to a note on a line a human ruled on
// ---------------------------------------------------------------------------

test('a pack disagreement on a pinned line is said, not enforced', () => {
  const out = resolveOrderLines(
    [{ raw_description: 'VEG - SWEET CORN PKT Each', unit: 'pkt' }],
    CATALOGUE,
    { pins: new Map([[0, CATALOGUE[1]]]) },
  );
  assert.equal(out[0].matched, true, 'the human chose it — it stands');
  assert.equal(out[0].item?.id, 'p-sweetcorn');
  assert.match(out[0].packNote ?? '', /paper counts this line in pkt/);
  assert.match(out[0].packNote ?? '', /sold by the kg/);
});

test('an agreeing pack says nothing at all', () => {
  const out = resolveOrderLines([{ raw_description: 'STRAWBERRIES', unit: 'punnets' }], CATALOGUE, {
    pins: new Map([[0, CATALOGUE[0]]]),
  });
  assert.equal(out[0].packNote, null);
});

test('an unpinned line carries no pack note — the guard there still refuses outright', () => {
  const out = resolveOrderLines([{ raw_description: 'Sweet Corn', unit: 'pkt' }], CATALOGUE);
  assert.equal(out[0].packNote, null);
  assert.equal(out[0].matched, false, 'Sweet Corn (kg) is refused for a line counted in packets');
});

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

test('shortDate is a UTC date, not the test machine’s timezone', () => {
  assert.equal(shortDate('2026-08-14T09:12:00.000Z'), '14 Aug 2026');
  assert.equal(shortDate(null), '');
  assert.equal(shortDate('not a date'), '');
});

test('a confirmation and a settings-screen mapping are not described alike', () => {
  assert.equal(
    aliasProvenanceLabel(ALIAS_SOURCE_REVIEW_CONFIRM, '2026-08-14T09:12:00.000Z'),
    'Learned from your confirmation on 14 Aug 2026',
  );
  // A row written before the source column existed cannot claim to be a
  // confirmation — we do not know that it was one.
  assert.equal(aliasProvenanceLabel('mapping', '2026-08-14T09:12:00.000Z'), 'From this customer’s order mappings');
  assert.equal(aliasProvenanceLabel(null, null), 'From this customer’s order mappings');
});

// ---------------------------------------------------------------------------
// The bubble
// ---------------------------------------------------------------------------

const CONFIRMED: LineConfirmation = {
  stockItemId: 'p-punnet',
  productName: 'Strawberry Punnets 250g',
  rawName: 'STRAWBERRIES',
  status: 'saved',
};

test('no record is not “not matched”', () => {
  // An unsynced document, or a row the reviewer typed in themselves. Nothing has
  // been claimed about it, so nothing is asked of them.
  assert.deepEqual(bubbleState(null, null), { kind: 'none' });
});

test('amber while the question is open, green once the link is stored', () => {
  assert.deepEqual(bubbleState(false, null), { kind: 'unmatched' });
  assert.deepEqual(bubbleState(true, null), { kind: 'none' });

  const saved = bubbleState(false, CONFIRMED);
  assert.equal(saved.kind, 'saved');
  assert.equal(bubbleIsGood(saved), true);
  assert.match(bubbleText(saved), /Saved\./);
  assert.match(bubbleText(saved), /remember this link for next time/);
  assert.match(bubbleText(saved), /Strawberry Punnets 250g/);
});

test('a confirmation overrides a matched record — the matcher can be confidently wrong', () => {
  assert.equal(bubbleState(true, CONFIRMED).kind, 'saved');
});

test('no customer yet → the line is linked, the link is not promised', () => {
  const state = bubbleState(false, { ...CONFIRMED, status: 'pending_customer' });
  assert.equal(state.kind, 'pending_customer');
  assert.equal(bubbleIsGood(state), false);
  assert.match(bubbleText(state), /Linked for this order/);
  assert.match(bubbleText(state), /Pick the customer and we’ll remember it next time/);
});

test('a failed save says so rather than going green', () => {
  const state = bubbleState(false, { ...CONFIRMED, status: 'failed', message: 'permission denied' });
  assert.equal(bubbleIsGood(state), false);
  assert.match(bubbleText(state), /not remembered/);
  assert.match(bubbleText(state), /permission denied/);
});

test('the saving state is neither the question nor the receipt', () => {
  const state = bubbleState(false, { ...CONFIRMED, status: 'saving' });
  assert.equal(state.kind, 'saving');
  assert.equal(bubbleIsGood(state), false);
});

test('pending links are offered in row order, and only the ones worth storing', () => {
  const map = new Map<string, LineConfirmation>([
    ['l2', { ...CONFIRMED, status: 'pending_customer', rawName: 'STRAWBERRIES' }],
    ['l1', { ...CONFIRMED, status: 'pending_customer', rawName: 'VEG - PATTY PAN' }],
    ['l3', { ...CONFIRMED, status: 'saved' }],
    // A hand-added row: no paper behind it, so no ruling about a customer's
    // wording can be made from it.
    ['l4', { ...CONFIRMED, status: 'pending_customer', rawName: '  ' }],
  ]);
  const out = pendingConfirmations(map, ['l1', 'l2', 'l3', 'l4']);
  assert.deepEqual(
    out.map((c) => c.rawName),
    ['VEG - PATTY PAN', 'STRAWBERRIES'],
  );
});
