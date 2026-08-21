import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MATCH_AGENT_SYSTEM,
  applyAgentDecisions,
  buildAgentRequests,
  effectiveUnit,
  normaliseUnit,
  parseAgentDecisions,
  shortlistFor,
  unitsCompatible,
} from '../lib/platform/docu/order-match-agent.ts';
import { resolveOrderLines, type CatalogueItem, type OrderLineInput } from '../lib/platform/docu/order-line-match.ts';

// ---------------------------------------------------------------------------
// The Bakubung catalogue again, plus the one row that makes the pack question
// real: Turn 'n Slice sells avocados BY THE BOX and BY THE KILOGRAM. The two
// score identically on the produce name and are priced in different units, so a
// matcher that only reads names has a coin-flip on every avocado line. The
// paper's own unit column settles it and nothing else can.
// ---------------------------------------------------------------------------
const CATALOGUE: CatalogueItem[] = [
  { id: 'p-avocado-box', name: 'Avocado (box)', unit: 'boxes' },
  { id: 'p-avocado-kg', name: 'Avocado (kg)', unit: 'kg' },
  { id: 'p-grapes-white', name: 'Grapes White', unit: 'boxes' },
  { id: 'p-grapes-black', name: 'Grapes Black', unit: 'boxes' },
  { id: 'p-tomato-yellow-cocktail', name: 'Tomato-Yellow Cocktail', unit: 'punnets' },
  { id: 'p-patty-pan', name: 'Patty Pan', unit: 'punnets' },
  { id: 'p-mushrooms-portabellini', name: 'Mushrooms Portabellini', unit: 'boxes' },
  { id: 'p-cabbage', name: 'Cabbage', unit: 'each' },
  { id: 'p-brinjals', name: 'Brinjals', unit: 'each' },
  { id: 'p-peppers-green', name: 'Peppers Green', unit: 'boxes' },
];

const LINES: OrderLineInput[] = [
  { raw_description: 'FF - AVOCADO BOX', description: 'Avocado', quantity: '4', unit: 'boxes' },
  { raw_description: 'FF - GRAPES WHITE BOX', description: 'Avocado', quantity: '2', unit: 'boxes' },
  { raw_description: 'VEG - PATTY PAN YELLOW', description: 'Tomato-Yellow Cocktail', quantity: '20', unit: 'punnets' },
  { raw_description: 'VEG - MUSHROOM GABLE', description: 'Mushroom Garlic Box', quantity: '1', unit: 'boxes' },
  { raw_description: 'VEG - PEPPERS GREEN', description: 'Peppers Green', quantity: '3', unit: 'boxes' },
];
const UNITS = LINES.map((l) => l.unit ?? null);

const resolveAll = () => resolveOrderLines(LINES, CATALOGUE);
const at = (raw: string) => LINES.findIndex((l) => l.raw_description === raw);

// ---------------------------------------------------------------------------
// Pack / unit compatibility
// ---------------------------------------------------------------------------

test('unit spellings fold before they are compared', () => {
  assert.equal(normaliseUnit('Boxes'), 'box');
  assert.equal(normaliseUnit('BX'), 'box');
  assert.equal(normaliseUnit('Each'), 'each');
  assert.equal(normaliseUnit('kgs'), 'kg');
  assert.equal(normaliseUnit('  '), null);
});

test('a catalogue name carries its pack when the unit column does not', () => {
  assert.equal(effectiveUnit({ id: 'x', name: 'Avocado (box)', unit: null }), 'box');
  assert.equal(effectiveUnit({ id: 'x', name: 'Avocado (kg)', unit: null }), 'kg');
  // The unit column wins when it has something to say.
  assert.equal(effectiveUnit({ id: 'x', name: 'Avocado', unit: 'punnets' }), 'punnet');
});

test('silence is not a conflict — only two named, different units block', () => {
  assert.equal(unitsCompatible('boxes', 'box'), true);
  assert.equal(unitsCompatible('boxes', 'kg'), false);
  assert.equal(unitsCompatible('', 'kg'), true, 'a line with no unit may match anything');
  assert.equal(unitsCompatible('boxes', null), true, 'a product with no unit is not excluded');
});

// ---------------------------------------------------------------------------
// The shortlist
// ---------------------------------------------------------------------------

test('the avocado box line is never even OFFERED the kilogram product', () => {
  const list = shortlistFor('FF - AVOCADO BOX', 'boxes', CATALOGUE);
  const ids = list.map((c) => c.id);
  assert.ok(ids.includes('p-avocado-box'), 'the box product is on the shortlist');
  assert.ok(!ids.includes('p-avocado-kg'), 'the kg product is excluded by the paper’s own unit');
});

test('an avocado line counted in kg gets the kg product and not the box', () => {
  const ids = shortlistFor('AVOCADO', 'kg', CATALOGUE).map((c) => c.id);
  assert.ok(ids.includes('p-avocado-kg'));
  assert.ok(!ids.includes('p-avocado-box'));
});

test('a conflicting variant IS shortlisted — the agent has to be able to see it to refuse it', () => {
  const ids = shortlistFor('FF - GRAPES WHITE BOX', 'boxes', CATALOGUE).map((c) => c.id);
  assert.ok(ids.includes('p-grapes-white'));
  assert.ok(ids.includes('p-grapes-black'), 'hiding the near-variant would leave the agent guessing');
});

test('the shortlist is relaxed enough to carry a name the string gate scores near zero', () => {
  const ids = shortlistFor('VEG - MUSHROOM GABLE', 'boxes', CATALOGUE).map((c) => c.id);
  assert.ok(ids.includes('p-mushrooms-portabellini'), 'only a reader can settle this one');
});

test('the shortlist is capped and ordered by similarity', () => {
  const list = shortlistFor('FF - GRAPES WHITE BOX', 'boxes', CATALOGUE, { limit: 2 });
  assert.equal(list.length, 2);
  assert.ok(list[0].similarity >= list[1].similarity);
});

// ---------------------------------------------------------------------------
// Which lines the agent is asked about
// ---------------------------------------------------------------------------

test('a line the gate settled at effective identity BYPASSES the agent', () => {
  const asked = new Set(buildAgentRequests(resolveAll(), UNITS, CATALOGUE).map((r) => r.index));
  // Both of these are exact once the POS category prefix and the pack word come
  // off, so the gate has already answered them and no model is asked to re-answer.
  assert.ok(!asked.has(at('VEG - PEPPERS GREEN')));
  assert.ok(!asked.has(at('FF - GRAPES WHITE BOX')));
  // These two are the open questions, and they are the whole reason the agent exists.
  assert.ok(asked.has(at('VEG - PATTY PAN YELLOW')));
  assert.ok(asked.has(at('VEG - MUSHROOM GABLE')));
});

test('the agent is shown the paper’s own words and never the reader’s rewrite', () => {
  const requests = buildAgentRequests(resolveAll(), UNITS, CATALOGUE);
  const mushroom = requests.find((r) => r.index === at('VEG - MUSHROOM GABLE'));
  assert.ok(mushroom);
  assert.equal(mushroom.raw_description, 'VEG - MUSHROOM GABLE');
  assert.equal(mushroom.unit, 'boxes');
  assert.ok(
    !JSON.stringify(mushroom).includes('Mushroom Garlic'),
    'the produce the reader invented is not carried into the decision',
  );
});

test('the system prompt states the two rules the failures broke', () => {
  assert.match(MATCH_AGENT_SYSTEM, /NULL IS A CORRECT ANSWER/);
  assert.match(MATCH_AGENT_SYSTEM, /PACK AND UNIT MUST AGREE/);
  assert.match(MATCH_AGENT_SYSTEM, /"GRAPES WHITE" is not "Grapes Black"/);
});

// ---------------------------------------------------------------------------
// Reading the reply
// ---------------------------------------------------------------------------

test('decisions parse from either the object or a bare array, fenced or not', () => {
  const object = parseAgentDecisions('{"decisions":[{"index":0,"productId":"p-avocado-box","confidence":95}]}');
  assert.equal(object.length, 1);
  assert.equal(object[0].productId, 'p-avocado-box');

  const fenced = parseAgentDecisions('```json\n[{"index":1,"productId":null,"confidence":10}]\n```');
  assert.equal(fenced.length, 1);
  assert.equal(fenced[0].productId, null);
});

test('an unreadable reply is no decisions, never a throw', () => {
  assert.deepEqual(parseAgentDecisions('the model apologises for the inconvenience'), []);
  assert.deepEqual(parseAgentDecisions(''), []);
});

// ---------------------------------------------------------------------------
// The invariants, enforced in code rather than in the prompt
// ---------------------------------------------------------------------------

const requestsFor = () => buildAgentRequests(resolveAll(), UNITS, CATALOGUE);

function decide(index: number, productId: string | null, confidence = 90) {
  return { index, productId, confidence, reason: '' };
}

test('the avocado box line takes the BOX product when the agent says so', () => {
  const requests = requestsFor();
  const out = applyAgentDecisions(
    resolveAll(),
    requests,
    [decide(at('FF - AVOCADO BOX'), 'p-avocado-box')],
    CATALOGUE,
  );
  const line = out[at('FF - AVOCADO BOX')];
  assert.equal(line.matched, true);
  assert.equal(line.item?.id, 'p-avocado-box');
  assert.equal(line.name, 'Avocado (box)');
});

// A catalogue that does NOT stock white grapes. Now the line is a genuine open
// question, which is the state the original failure occurred in — and the state
// where an agent can do real damage.
const NO_WHITE = CATALOGUE.filter((c) => c.id !== 'p-grapes-white');
const whiteLines: OrderLineInput[] = [
  { raw_description: 'FF - GRAPES WHITE BOX', description: 'Avocado', quantity: '2', unit: 'boxes' },
];
const whiteUnits = ['boxes'];
const resolveWhite = () => resolveOrderLines(whiteLines, NO_WHITE);
const whiteRequests = () => buildAgentRequests(resolveWhite(), whiteUnits, NO_WHITE);

test('grapes white is never allowed to become an avocado, whatever the agent returns', () => {
  const out = applyAgentDecisions(
    resolveWhite(),
    whiteRequests(),
    // The original failure, forced: the model naming a product that is not even
    // on this line's shortlist, because nothing about grapes resembles an avocado.
    [decide(0, 'p-avocado-box', 99)],
    NO_WHITE,
  );
  assert.equal(out[0].matched, false);
  assert.equal(out[0].item, null);
  assert.equal(out[0].name, 'FF - GRAPES WHITE BOX', 'the paper\u2019s own words are what stands');
});

test('grapes white may not become grapes black — the variant is refused in code', () => {
  const out = applyAgentDecisions(resolveWhite(), whiteRequests(), [decide(0, 'p-grapes-black', 99)], NO_WHITE);
  assert.equal(out[0].matched, false);
  assert.equal(out[0].reason, 'variant_conflict');
  assert.equal(out[0].suggestion?.id, 'p-grapes-black', 'still one click to accept, if a human agrees');
});

test('grapes white DOES take grapes white when the catalogue has it and the agent says so', () => {
  const before = resolveOrderLines(whiteLines, CATALOGUE);
  const requests = buildAgentRequests(before, whiteUnits, CATALOGUE);
  const out = applyAgentDecisions(before, requests, [decide(0, 'p-grapes-white', 95)], CATALOGUE);
  assert.equal(out[0].item?.id, 'p-grapes-white');
  assert.equal(out[0].matched, true);
});

test('patty pan yellow is a tomato under no circumstances', () => {
  const requests = requestsFor();
  const forced = applyAgentDecisions(
    resolveAll(),
    requests,
    [decide(at('VEG - PATTY PAN YELLOW'), 'p-tomato-yellow-cocktail', 99)],
    CATALOGUE,
  );
  const line = forced[at('VEG - PATTY PAN YELLOW')];
  assert.equal(line.matched, false);
  assert.equal(line.name, 'VEG - PATTY PAN YELLOW');
});

test('none is an unmatched row with the raw text and no product', () => {
  const requests = requestsFor();
  const out = applyAgentDecisions(
    resolveAll(),
    requests,
    [decide(at('VEG - PATTY PAN YELLOW'), null, 20)],
    CATALOGUE,
  );
  const line = out[at('VEG - PATTY PAN YELLOW')];
  assert.equal(line.matched, false);
  assert.equal(line.item, null);
  assert.equal(line.reason, 'agent_declined');
  assert.equal(line.name, 'VEG - PATTY PAN YELLOW');
});

test('a line the agent was not asked about keeps the deterministic verdict', () => {
  const before = resolveAll();
  const out = applyAgentDecisions(before, requestsFor(), [], CATALOGUE);
  const i = at('VEG - PEPPERS GREEN');
  assert.equal(out[i].matched, before[i].matched);
  assert.equal(out[i].item?.id, before[i].item?.id);
});

test('silence on a line that WAS asked about is not read as a refusal', () => {
  const before = resolveAll();
  const out = applyAgentDecisions(before, requestsFor(), [], CATALOGUE);
  const i = at('FF - GRAPES WHITE BOX');
  assert.equal(out[i].reason, before[i].reason, 'a transport fault is not a document-wide refusal');
});

test('two lines may still never land on one product, agent or no agent', () => {
  // Two rows the gate leaves open, which the agent then sends to one product.
  const lines: OrderLineInput[] = [
    { raw_description: 'VEG - MUSHROOM GABLE', description: 'Mushroom', unit: 'boxes' },
    { raw_description: 'VEG - MUSHROOM PORTABELLA', description: 'Mushroom', unit: 'boxes' },
  ];
  const units = ['boxes', 'boxes'];
  const before = resolveOrderLines(lines, CATALOGUE);
  const requests = buildAgentRequests(before, units, CATALOGUE);
  const out = applyAgentDecisions(
    before,
    requests,
    requests.map((r) => decide(r.index, 'p-mushrooms-portabellini', 95)),
    CATALOGUE,
  );
  assert.ok(out.every((r) => !r.matched), 'both go to review — we cannot know which row was the real one');
  assert.deepEqual(out.map((r) => r.reason), ['duplicate', 'duplicate']);
});

test('an invented product id changes nothing', () => {
  const before = resolveAll();
  const out = applyAgentDecisions(
    before,
    requestsFor(),
    [decide(at('FF - GRAPES WHITE BOX'), 'p-does-not-exist')],
    CATALOGUE,
  );
  const i = at('FF - GRAPES WHITE BOX');
  assert.equal(out[i].reason, before[i].reason);
});
