import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTION_MAX_CHARS,
  OBSERVATION_MAX_CHARS,
  buildFallbackObservation,
  buildObservePrompt,
  evaluateObservationReply,
  generateObservation,
  verifyNumberFidelity,
  windowDays,
} from '../lib/platform/price-watch/observe.ts';
import type { FindingFacts } from '../lib/platform/price-watch/observe.ts';

// No live API calls anywhere in this file: every model reply is canned and the
// Claude call is injected.

const FACTS: FindingFacts = {
  itemName: 'Tomatoes Saladette 6kg Box',
  supplierName: 'Fresh Valley Produce',
  lineSupplier: null,
  baseUnit: 'kg',
  latestPrice: 18.75,
  medianPrice: 15.4,
  deltaPct: 21.8,
  randImpact: 12480.37,
  windowStart: '2026-06-14',
  windowEnd: '2026-08-13',
  evidenceCount: 4,
};

function reply(observation: string, action = 'Query the increase with the supplier.'): string {
  return JSON.stringify({ observation, recommended_action: action });
}

// 1. Window maths ------------------------------------------------------------

test('windowDays is the whole-day span of the trailing window', () => {
  assert.equal(windowDays(FACTS), 60);
  assert.equal(windowDays({ ...FACTS, windowStart: 'not-a-date' }), null);
});

// 2. The validator accepts formatting variants -------------------------------

test('verifyNumberFidelity accepts every reasonable way of writing a given value', () => {
  const good = [
    'Tomatoes Saladette moved to R18.75 per kg.',
    'Tomatoes Saladette moved to R 18.75 per kg from a median of R 15.40.',
    'The annual impact is R 12,480.37.',
    'The annual impact is R12 480.37.', // space as the thousands separator
    'The annual impact is about R 12,480.', // rounded to the precision shown
    'That is 21.8% above the median.',
    'That is 22% above the median.', // 21.8 rounded to 0 decimals
    'Latest price 18.8 per kg.', // 18.75 rounded to 1 decimal
    'Across 4 documents between 2026-06-14 and 2026-08-13.',
    'Over the last 60 days.',
    'Tomatoes Saladette 6kg Box is dearer.', // number inside the given item name
  ];
  for (const text of good) {
    const report = verifyNumberFidelity(text, FACTS);
    assert.equal(report.ok, true, `${text} -> ${report.violations.join(', ')}`);
  }
});

test('verifyNumberFidelity finds numbers even when it accepts them', () => {
  const report = verifyNumberFidelity('R 12,480.37 over 60 days across 4 documents.', FACTS);
  assert.deepEqual(report.numbers, ['12,480.37', '60', '4']);
  assert.equal(report.ok, true);
});

// 3. The validator rejects invented and mangled numbers ----------------------

test('an invented number is a violation that names the number', () => {
  const report = verifyNumberFidelity(
    'The price rose to R18.75 per kg, costing about R 9,500.00 a year.',
    FACTS,
  );
  assert.equal(report.ok, false);
  assert.equal(report.violations.length, 1);
  assert.match(report.violations[0], /"9,500\.00"/);
});

test('a mangled number is a violation even when it is close', () => {
  const report = verifyNumberFidelity('The annual impact is R 12,481.37.', FACTS);
  assert.equal(report.ok, false);
  assert.match(report.violations[0], /12,481\.37/);
});

test('arithmetic the model did itself is caught', () => {
  // 18.75 - 15.40 = 3.35 is a real difference, but it was never given, so the
  // agent may not state it: "never invent numbers" includes correct ones.
  const report = verifyNumberFidelity('Each kg now costs R 3.35 more than the median.', FACTS);
  assert.equal(report.ok, false);
  assert.match(report.violations[0], /3\.35/);
});

test('a wrong figure inside the recommended action is caught too', () => {
  const { violations } = evaluateObservationReply(
    reply('Tomatoes Saladette is now R18.75 per kg.', 'Negotiate the R 7,000 back from them.'),
    FACTS,
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0], /7,000/);
});

test('ISO dates are not dissected into suspicious numbers', () => {
  const report = verifyNumberFidelity('Between 2026-06-14 and 2026-08-13 nothing else changed.', FACTS);
  assert.equal(report.ok, true);
});

// 4. The deterministic fallback must satisfy its own validator ----------------

test('the fallback template is built only from given values and passes the validator', () => {
  const fallback = buildFallbackObservation(FACTS);
  const report = verifyNumberFidelity(
    `${fallback.observation} ${fallback.recommendedAction}`,
    FACTS,
  );
  assert.equal(report.ok, true, report.violations.join(', '));
  assert.match(fallback.observation, /R 18\.75 per kg/);
  assert.match(fallback.observation, /21\.8%/);
  assert.match(fallback.observation, /R 12,480\.37/);
  assert.match(fallback.observation, /4 documents/);
});

test('the fallback names the market agent when the finding has one', () => {
  const facts = { ...FACTS, lineSupplier: 'Botha Roodt' };
  const fallback = buildFallbackObservation(facts);
  assert.match(fallback.observation, /Botha Roodt at Fresh Valley Produce/);
  assert.equal(verifyNumberFidelity(fallback.observation, facts).ok, true);
});

test('the fallback pluralises a single evidence document', () => {
  const fallback = buildFallbackObservation({ ...FACTS, evidenceCount: 1 });
  assert.match(fallback.observation, /1 document\./);
});

// 5. Reply shape checks ------------------------------------------------------

test('evaluateObservationReply accepts a well-formed, faithful reply', () => {
  const { value, violations } = evaluateObservationReply(
    reply('Tomatoes Saladette from Fresh Valley Produce is now R 18.75 per kg, 21.8% above its R 15.40 median.'),
    FACTS,
  );
  assert.deepEqual(violations, []);
  assert.equal(value?.recommendedAction, 'Query the increase with the supplier.');
});

test('evaluateObservationReply rejects non-JSON and missing fields', () => {
  const notJson = evaluateObservationReply('Prices went up a bit.', FACTS);
  assert.equal(notJson.value, null);
  assert.match(notJson.violations[0], /not the required JSON object/);

  const missing = evaluateObservationReply('{"observation":"   "}', FACTS);
  assert.equal(missing.value, null);
  assert.equal(missing.violations.length, 2);
});

test('over-long output is rejected rather than truncated', () => {
  const long = `Tomatoes Saladette is now R 18.75 per kg. ${'Filler prose. '.repeat(40)}`;
  const { value, violations } = evaluateObservationReply(reply(long), FACTS);
  assert.equal(value, null);
  assert.match(violations[0], new RegExp(String(OBSERVATION_MAX_CHARS)));

  const longAction = evaluateObservationReply(reply('Fine.', 'x'.repeat(ACTION_MAX_CHARS + 1)), FACTS);
  assert.equal(longAction.value, null);
});

test('markdown fences around the JSON are tolerated', () => {
  const { value } = evaluateObservationReply(
    `\`\`\`json\n${reply('Tomatoes Saladette is now R 18.75 per kg.')}\n\`\`\``,
    FACTS,
  );
  assert.equal(value?.observation, 'Tomatoes Saladette is now R 18.75 per kg.');
});

// 6. Retry-then-fallback orchestration ---------------------------------------

test('a faithful first answer is used as-is', async () => {
  let calls = 0;
  const out = await generateObservation(FACTS, async () => {
    calls += 1;
    return reply('Tomatoes Saladette is now R 18.75 per kg, 21.8% above its R 15.40 median.');
  });
  assert.equal(calls, 1);
  assert.equal(out.source, 'model');
  assert.deepEqual(out.violations, []);
});

test('one violation buys exactly one retry, and the retry is told what was wrong', async () => {
  const prompts: string[] = [];
  const out = await generateObservation(FACTS, async (prompt, attempt) => {
    prompts.push(prompt.user);
    return attempt === 1
      ? reply('Tomatoes Saladette is now R 18.75 per kg, costing R 9,500 a year.')
      : reply('Tomatoes Saladette is now R 18.75 per kg, costing R 12,480.37 a year.');
  });
  assert.equal(out.source, 'model_retry');
  assert.deepEqual(out.violations, []);
  assert.equal(prompts.length, 2);
  // The first prompt carries no correction; the second names the exact number.
  assert.doesNotMatch(prompts[0], /REJECTED/);
  assert.match(prompts[1], /REJECTED/);
  assert.match(prompts[1], /9,500/);
});

test('a second failure falls back to the deterministic template', async () => {
  let calls = 0;
  const out = await generateObservation(FACTS, async () => {
    calls += 1;
    return reply('Prices doubled, costing R 25,000 a year.');
  });
  assert.equal(calls, 2);
  assert.equal(out.source, 'template');
  assert.ok(out.violations.length > 0);
  assert.deepEqual(
    { observation: out.observation, recommendedAction: out.recommendedAction },
    buildFallbackObservation(FACTS),
  );
  assert.equal(verifyNumberFidelity(out.observation, FACTS).ok, true);
});

test('a transport failure falls back without a second billed attempt', async () => {
  let calls = 0;
  const out = await generateObservation(FACTS, async () => {
    calls += 1;
    throw new Error('529 overloaded_error');
  });
  assert.equal(calls, 1);
  assert.equal(out.source, 'template');
  assert.match(out.violations[0], /could not be reached/);
  assert.equal(out.observation, buildFallbackObservation(FACTS).observation);
});

// 7. Prompt --------------------------------------------------------------

test('buildObservePrompt passes structured values only and forbids arithmetic', () => {
  const { system, user } = buildObservePrompt(FACTS);
  const payload = JSON.parse(user.replace(/^STRUCTURED VALUES:\n/, '')) as Record<string, unknown>;
  assert.equal(payload.latest_unit_price_rand, 18.75);
  assert.equal(payload.window_days, 60);
  assert.equal(payload.evidence_documents, 4);
  assert.match(system, /You may ONLY write numbers that appear in the structured values/);
  assert.match(system, /Do NOT calculate anything/);
});
