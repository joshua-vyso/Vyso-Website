import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_SUGGESTIONS,
  findingRef,
  findingTopic,
  suggestionsFor,
  type OverdueDebtor,
  type SuggestionFinding,
} from '../lib/platform/finch-suggestions.ts';

// A suggestion chip is Vyso putting words in the owner's mouth: click it and
// that sentence becomes their message. So the two things worth pinning are
// (a) that the same business always gets the same row — a chip that moved
// between loads would read as a slot machine — and (b) that the row spans more
// than one kind of work, which is what the per-source quotas exist for.
//
// The topic heuristic gets its own block because it is the one piece of guessing
// in the file, and its failure mode (a mangled fragment presented as a topic) is
// invisible to the person clicking it.

function finding(overrides: Partial<SuggestionFinding> = {}): SuggestionFinding {
  return {
    id: '8c3f21a4-1111-4222-8333-444455556666',
    agent: 'price_watch',
    observation: 'Butternut is up 12% at FreshCo Produce since June.',
    rand_impact: 4200,
    ...overrides,
  };
}

function debtor(overrides: Partial<OverdueDebtor> = {}): OverdueDebtor {
  return { customer: 'Thyme & Basil Catering', days: 18, amount: 'R23 400.00', ...overrides };
}

const EMPTY = { findings: [], overdue: [], recentDocCount: 0 } as const;

// ---------------------------------------------------------------------------
// findingRef — the one name the prelude and the chips must agree on
// ---------------------------------------------------------------------------

test('findingRef: the first uuid segment, short enough to read in a message', () => {
  assert.equal(findingRef('8c3f21a4-1111-4222-8333-444455556666'), '8c3f21a4');
});

test('findingRef: an id with no dashes is its own ref', () => {
  assert.equal(findingRef('legacy-id'.replace('-', '')), 'legacyid');
});

// ---------------------------------------------------------------------------
// findingTopic — what a finding is ABOUT
// ---------------------------------------------------------------------------

test('findingTopic: stops at the claim, keeping the subject', () => {
  assert.equal(findingTopic('Butternut is up 12% at FreshCo Produce since June.'), 'Butternut');
  assert.equal(findingTopic('Sunflower oil has risen 9% against your February average.'), 'Sunflower oil');
  assert.equal(findingTopic('Delivery charges went up at Umgeni Oils.'), 'Delivery charges');
});

test('findingTopic: an observation with no claim marker is clipped, not mangled', () => {
  const topic = findingTopic(
    'Repeated short deliveries against your standing weekly order from Coastal Fresh Produce',
  );
  assert.ok(topic.length <= 34, `topic too long for a pill: ${topic}`);
  assert.ok(topic.endsWith('…'), 'a clipped topic should say so');
  assert.ok(topic.startsWith('Repeated short deliveries'));
});

test('findingTopic: nothing usable yields nothing, rather than a fragment', () => {
  assert.equal(findingTopic(''), '');
  assert.equal(findingTopic('   '), '');
  // A sentence that opens on its claim has no subject to lift out.
  assert.equal(findingTopic('Is this even a finding?'), '');
});

// ---------------------------------------------------------------------------
// suggestionsFor — order, quotas, ceiling
// ---------------------------------------------------------------------------

test('suggestionsFor: never more than MAX_SUGGESTIONS', () => {
  const many = Array.from({ length: 9 }, (_, i) =>
    finding({ id: `${i}aaaaaaa-1111-4222-8333-444455556666`, observation: `Item${i} is up 5%.`, rand_impact: i }),
  );
  assert.equal(MAX_SUGGESTIONS, 4);
  assert.equal(suggestionsFor({ ...EMPTY, findings: many }).length, 4);
});

test('suggestionsFor: findings lead, ordered by rand impact', () => {
  const small = finding({ id: 'aaaaaaaa-0-0-0-0', observation: 'Cabbage is up 3%.', rand_impact: 900 });
  const big = finding({ id: 'bbbbbbbb-0-0-0-0', observation: 'Sunflower oil is up 9%.', rand_impact: 18600 });
  const none = finding({ id: 'cccccccc-0-0-0-0', observation: 'Packaging is up.', rand_impact: null });

  const out = suggestionsFor({ ...EMPTY, findings: [small, none, big] });
  assert.equal(out[0].label, 'Draft an email about Sunflower oil');
  assert.equal(out[1].label, 'Draft an email about Cabbage');
  // The one with no figure is not dropped — it just sorts behind the ones with.
  assert.ok(out.some((s) => s.label === 'Draft an email about Packaging'));
});

test('suggestionsFor: the finding prompt carries the ref so Finch can match it', () => {
  const [first] = suggestionsFor({ ...EMPTY, findings: [finding()] });
  assert.match(first.prompt, /finding 8c3f21a4/);
  // The label stays a pill; only the prompt carries the plumbing.
  assert.doesNotMatch(first.label, /8c3f21a4/);
});

test('suggestionsFor: findings are capped so debtors and documents still get a slot', () => {
  const findings = [
    finding({ id: 'a1111111-0-0-0-0', observation: 'Butternut is up 12%.', rand_impact: 5000 }),
    finding({ id: 'b2222222-0-0-0-0', observation: 'Sunflower oil is up 9%.', rand_impact: 4000 }),
    finding({ id: 'c3333333-0-0-0-0', observation: 'Cabbage is up 3%.', rand_impact: 3000 }),
  ];
  const out = suggestionsFor({ findings, overdue: [debtor()], recentDocCount: 6 });

  assert.deepEqual(
    out.map((s) => s.label),
    [
      'Draft an email about Butternut',
      'Draft an email about Sunflower oil',
      'Draft a payment reminder for Thyme & Basil Catering',
      'Summarise this week’s invoices',
    ],
  );
});

test('suggestionsFor: leftover findings top the row up before the generic openers', () => {
  const findings = [
    finding({ id: 'a1111111-0-0-0-0', observation: 'Butternut is up 12%.', rand_impact: 5000 }),
    finding({ id: 'b2222222-0-0-0-0', observation: 'Sunflower oil is up 9%.', rand_impact: 4000 }),
    finding({ id: 'c3333333-0-0-0-0', observation: 'Cabbage is up 3%.', rand_impact: 3000 }),
  ];
  const out = suggestionsFor({ findings, overdue: [], recentDocCount: 0 });
  assert.equal(out[2].label, 'Draft an email about Cabbage');
  assert.equal(out[3].label, 'What should I look at first today?');
});

test('suggestionsFor: a debtor chip names the customer and how late they are', () => {
  const [chip] = suggestionsFor({ ...EMPTY, overdue: [debtor()] });
  assert.equal(chip.label, 'Draft a payment reminder for Thyme & Basil Catering');
  assert.match(chip.prompt, /18 days past terms/);
});

test('suggestionsFor: the documents chip counts what was actually uploaded', () => {
  const out = suggestionsFor({ ...EMPTY, recentDocCount: 1 });
  const chip = out.find((s) => s.label === 'Summarise this week’s invoices');
  assert.ok(chip);
  assert.match(chip.prompt, /the 1 document uploaded in the last 7 days/);
});

test('suggestionsFor: no data at all still opens a conversation', () => {
  const out = suggestionsFor(EMPTY);
  assert.deepEqual(
    out.map((s) => s.label),
    [
      'What should I look at first today?',
      'Who owes me money?',
      'Summarise this week’s invoices',
      'How is the business doing this month?',
    ],
  );
});

test('suggestionsFor: a user who may not see money is never offered a money chip', () => {
  const out = suggestionsFor({ ...EMPTY, overdue: [debtor()], canSeeMoney: false });
  assert.ok(!out.some((s) => s.label.includes('owes me money')));
  assert.ok(!out.some((s) => s.label.startsWith('Draft a payment reminder')));
  // The row is still four long — it just fills from what they can see.
  assert.equal(out.length, 3);
});

test('suggestionsFor: the same inputs always give the same row', () => {
  const inputs = { findings: [finding()], overdue: [debtor()], recentDocCount: 4 };
  const a = suggestionsFor(inputs);
  const b = suggestionsFor(inputs);
  assert.deepEqual(a, b);
});

test('suggestionsFor: does not mutate the findings it was handed', () => {
  const findings = [
    finding({ id: 'a1111111-0-0-0-0', rand_impact: 10 }),
    finding({ id: 'b2222222-0-0-0-0', rand_impact: 9000 }),
  ];
  const snapshot = findings.map((f) => f.id);
  suggestionsFor({ ...EMPTY, findings });
  assert.deepEqual(findings.map((f) => f.id), snapshot);
});

test('suggestionsFor: two chips never read the same', () => {
  // Two findings whose topics collapse to the same words: the second must not
  // produce a duplicate pill.
  const findings = [
    finding({ id: 'a1111111-0-0-0-0', observation: 'Packaging is up 4%.', rand_impact: 200 }),
    finding({ id: 'b2222222-0-0-0-0', observation: 'Packaging is up 6% elsewhere.', rand_impact: 100 }),
  ];
  const out = suggestionsFor({ ...EMPTY, findings });
  const labels = out.map((s) => s.label);
  assert.equal(new Set(labels).size, labels.length);
});
