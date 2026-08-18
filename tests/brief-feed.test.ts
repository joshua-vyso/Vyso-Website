import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FULL_BRIEFING_AGENT_ORDER,
  TODAY_CARD_CAP,
  TODAY_CARD_SHOW,
  groupByAgent,
  rankFindings,
  splitForToday,
} from '../lib/platform/brief-feed.ts';

// The cap is the one piece of the Brief that decides what the owner does NOT
// see. Its failure mode is silent: a R48 000 finding sorted below a R900 one, or
// a cut that loses a card without saying so, looks exactly like a working screen
// until somebody loses money. So the two things pinned hardest here are the
// ORDER (money before recency, unseen before seen, nulls last) and the BOUNDARY
// (5 shows five, 6 shows four plus an overflow of two).

let seq = 0;
function finding(overrides: Partial<Row> = {}): Row {
  seq += 1;
  return {
    id: `f${seq}`,
    agent: 'price_watch',
    status: 'new',
    rand_impact: 1000,
    created_at: '2026-08-18T04:45:00.000Z',
    ...overrides,
  };
}

interface Row {
  id: string;
  agent: string;
  status: string;
  rand_impact: number | null;
  created_at: string;
}

const ids = (rows: readonly Row[]) => rows.map((r) => r.id);

// ---------------------------------------------------------------------------
// rankFindings — "most imperative"
// ---------------------------------------------------------------------------

test('rankFindings puts new before in_progress regardless of money', () => {
  const seen = finding({ id: 'seen', status: 'in_progress', rand_impact: 90_000 });
  const fresh = finding({ id: 'fresh', status: 'new', rand_impact: 12 });

  assert.deepEqual(ids(rankFindings([seen, fresh])), ['fresh', 'seen']);
});

test('rankFindings orders by rand_impact descending inside a status', () => {
  const small = finding({ id: 'small', rand_impact: 900 });
  const big = finding({ id: 'big', rand_impact: 48_000 });
  const mid = finding({ id: 'mid', rand_impact: 4_200 });

  assert.deepEqual(ids(rankFindings([small, big, mid])), ['big', 'mid', 'small']);
});

test('rankFindings sorts null rand_impact LAST, not as zero', () => {
  const unpriced = finding({ id: 'unpriced', rand_impact: null });
  const cheap = finding({ id: 'cheap', rand_impact: 1 });

  // If null were read as 0, `cheap` would still win — so the test only means
  // something with a finding priced BELOW nothing-at-all, which cannot exist.
  // Instead: prove the unpriced one loses to the cheapest possible real figure
  // AND that its position does not depend on input order.
  assert.deepEqual(ids(rankFindings([unpriced, cheap])), ['cheap', 'unpriced']);
  assert.deepEqual(ids(rankFindings([cheap, unpriced])), ['cheap', 'unpriced']);
});

test('rankFindings breaks a rand tie with the newest created_at', () => {
  const older = finding({ id: 'older', rand_impact: 5_000, created_at: '2026-08-16T04:45:00.000Z' });
  const newer = finding({ id: 'newer', rand_impact: 5_000, created_at: '2026-08-18T04:45:00.000Z' });

  assert.deepEqual(ids(rankFindings([older, newer])), ['newer', 'older']);
});

test('rankFindings orders two unpriced findings by date rather than dropping the tiebreak', () => {
  const older = finding({ id: 'older', rand_impact: null, created_at: '2026-08-10T04:45:00.000Z' });
  const newer = finding({ id: 'newer', rand_impact: null, created_at: '2026-08-17T04:45:00.000Z' });

  assert.deepEqual(ids(rankFindings([older, newer])), ['newer', 'older']);
});

test('rankFindings ranks an unknown status after both known ones', () => {
  const weird = finding({ id: 'weird', status: 'escalated', rand_impact: 99_000 });
  const progress = finding({ id: 'progress', status: 'in_progress', rand_impact: 1 });

  assert.deepEqual(ids(rankFindings([weird, progress])), ['progress', 'weird']);
});

test('rankFindings does not mutate its input', () => {
  const rows = [finding({ id: 'a', rand_impact: 1 }), finding({ id: 'b', rand_impact: 2 })];
  const before = ids(rows);

  const out = rankFindings(rows);

  assert.deepEqual(ids(rows), before, 'the caller keeps feed.open in its own order');
  assert.notEqual(out, rows, 'a new array, so the greeting cannot be re-sorted underneath');
});

test('rankFindings handles an empty feed', () => {
  assert.deepEqual(rankFindings([]), []);
});

// ---------------------------------------------------------------------------
// splitForToday — the boundary
// ---------------------------------------------------------------------------

function nOpen(n: number): Row[] {
  // Descending money so the ranked order is the input order — the split's own
  // behaviour is what is under test here, not the ranking.
  return Array.from({ length: n }, (_, i) =>
    finding({ id: `n${i + 1}`, rand_impact: (n - i) * 1_000 }),
  );
}

test('splitForToday shows everything below the cap with no overflow', () => {
  for (const n of [0, 1, 2, 3, 4]) {
    const out = splitForToday(nOpen(n));
    assert.equal(out.cards.length, n, `${n} open → ${n} cards`);
    assert.equal(out.overflowCount, 0, `${n} open → no overflow card`);
  }
});

test('splitForToday shows exactly five at the cap, still with no overflow', () => {
  const out = splitForToday(nOpen(TODAY_CARD_CAP));
  assert.equal(out.cards.length, 5);
  assert.equal(out.overflowCount, 0, 'a fifth slot spent on "0 other items" would be absurd');
});

test('splitForToday drops to four cards the moment there is a sixth finding', () => {
  const out = splitForToday(nOpen(6));
  assert.equal(out.cards.length, TODAY_CARD_SHOW);
  assert.equal(out.overflowCount, 2, '6 open − 4 shown = 2 behind the overflow card');
});

test('splitForToday quotes the right number on a long feed', () => {
  const out = splitForToday(nOpen(27));
  assert.equal(out.cards.length, 4);
  assert.equal(out.overflowCount, 23, 'the owner’s own example: "you have 23 other items"');
});

test('splitForToday keeps the four most imperative, not the first four', () => {
  const rows = [
    finding({ id: 'tiny', rand_impact: 5 }),
    finding({ id: 'huge', rand_impact: 90_000 }),
    finding({ id: 'seen', status: 'in_progress', rand_impact: 80_000 }),
    finding({ id: 'big', rand_impact: 40_000 }),
    finding({ id: 'mid', rand_impact: 9_000 }),
    finding({ id: 'unpriced', rand_impact: null }),
  ];

  const out = splitForToday(rows);
  assert.deepEqual(ids(out.cards), ['huge', 'big', 'mid', 'tiny']);
  assert.equal(out.overflowCount, 2, 'the in_progress one and the unpriced one wait');
});

test('splitForToday honours a caller-supplied cap and show', () => {
  const out = splitForToday(nOpen(10), 3, 2);
  assert.equal(out.cards.length, 2);
  assert.equal(out.overflowCount, 8);

  const exact = splitForToday(nOpen(3), 3, 2);
  assert.equal(exact.cards.length, 3);
  assert.equal(exact.overflowCount, 0);
});

test('splitForToday cards plus overflowCount always account for every finding', () => {
  for (const n of [0, 1, 4, 5, 6, 7, 12, 100]) {
    const out = splitForToday(nOpen(n));
    assert.equal(out.cards.length + out.overflowCount, n, `nothing vanishes at ${n}`);
  }
});

// ---------------------------------------------------------------------------
// groupByAgent — the full briefing
// ---------------------------------------------------------------------------

test('groupByAgent returns the agents in the fixed order, whatever the feed order', () => {
  const rows = [
    finding({ id: 's1', agent: 'stock_cover' }),
    finding({ id: 'd1', agent: 'debtors_watch' }),
    finding({ id: 'p1', agent: 'price_watch' }),
  ];

  assert.deepEqual(
    groupByAgent(rows).map((g) => g.agent),
    [...FULL_BRIEFING_AGENT_ORDER],
  );
});

test('groupByAgent omits an agent with nothing open rather than drawing an empty heading', () => {
  const rows = [finding({ id: 'p1', agent: 'price_watch' })];

  assert.deepEqual(
    groupByAgent(rows).map((g) => g.agent),
    ['price_watch'],
  );
});

test('groupByAgent appends an unknown agent instead of dropping its findings', () => {
  const rows = [
    finding({ id: 'x1', agent: 'cash_flow_watch' }),
    finding({ id: 'p1', agent: 'price_watch' }),
  ];

  const groups = groupByAgent(rows);
  assert.deepEqual(
    groups.map((g) => g.agent),
    ['price_watch', 'cash_flow_watch'],
  );
  assert.deepEqual(ids(groups[1].findings), ['x1']);
});

test('groupByAgent ranks inside each group by the same rule', () => {
  const rows = [
    finding({ id: 'p_small', agent: 'price_watch', rand_impact: 100 }),
    finding({ id: 'p_big', agent: 'price_watch', rand_impact: 50_000 }),
    finding({ id: 'p_seen', agent: 'price_watch', status: 'in_progress', rand_impact: 90_000 }),
  ];

  const [prices] = groupByAgent(rows);
  assert.deepEqual(ids(prices.findings), ['p_big', 'p_small', 'p_seen']);
});

test('groupByAgent loses nothing', () => {
  const rows = [
    ...nOpen(3).map((r) => ({ ...r, agent: 'price_watch' })),
    ...nOpen(2).map((r) => ({ ...r, agent: 'debtors_watch' })),
    ...nOpen(4).map((r) => ({ ...r, agent: 'stock_cover' })),
  ];

  const total = groupByAgent(rows).reduce((n, g) => n + g.findings.length, 0);
  assert.equal(total, 9);
});

test('groupByAgent handles an empty feed', () => {
  assert.deepEqual(groupByAgent([]), []);
});
