import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AT_RISK_COVER_DAYS,
  shapeStockPosition,
  type StockLineInput,
} from '../lib/ai/finch/procurepulse-data.ts';
import {
  tallyMovements,
  type MovementTally,
  type StockCoverMovement,
} from '../lib/platform/stock-cover/detect.ts';

// "What will I run out of this week?" is the question this shaping answers, and
// the owner acts on the answer by phoning a supplier. Three things can be
// quietly wrong: the ORDER (a list not sorted by how soon buries the line that
// matters), the AT-RISK RULE (a line that is out but has no recent usage must
// still appear), and DAYS OF COVER ON A LINE THAT HAS NOT MOVED (which must be
// null — printing a number there invents urgency, or calm, out of nothing).
//
// THE FIXTURE IS MERIDIAN'S FIVE LOW LINES after supabase/demo-refresh-2026-08.sql
// (§6.4 expects exactly items 2, 16, 21, 23 and 30). On-hand and threshold are
// the seed's; consumption is what §3.1's generator writes over the 30-day
// window, so the days-of-cover figures below are the ones the rehearsal script
// tells Josh to expect.

const TODAY = '2026-08-18';

function line(
  id: string,
  name: string,
  unit: string,
  onHand: number,
  lowThreshold: number,
): StockLineInput {
  return { id, name, unit, onHand, lowThreshold };
}

const ITEMS: StockLineInput[] = [
  line('s-21', 'Cooking Oil (4×5L case)', 'case', 12, 16),
  line('s-16', 'Line Fish Fillet (kg)', 'kg', 0, 20),
  line('s-2', 'Baby Spinach (crate)', 'crate', 6, 12),
  line('s-30', 'Bread Rolls (24/bag)', 'bag', 14, 30),
  line('s-23', 'Fresh Milk (12×1L case)', 'case', 18, 24),
  line('s-13', 'Chicken Portions (10kg box)', 'box', 72, 40),
  // Sitting on its threshold with nothing moving: low, but the cover is unknown.
  line('s-quiet', 'Ceremonial Vinegar (5L)', 'bottle', 3, 5),
];

/** Consumption over the window, as the demo's movement generator writes it. */
const TALLIES = new Map<string, MovementTally>([
  ['s-21', { consumed: 29, received: 74, adjusted: 0 }],
  ['s-16', { consumed: 38, received: 97, adjusted: 0 }],
  ['s-2', { consumed: 23, received: 59, adjusted: 0 }],
  ['s-30', { consumed: 55, received: 146, adjusted: 0 }],
  ['s-23', { consumed: 45, received: 119, adjusted: 0 }],
  ['s-13', { consumed: 42, received: 114, adjusted: -14 }],
]);

/* ── tallyMovements — the window and what counts as usage ─────────────────── */

const mv = (id: string, change: number, reason: string, at: string): StockCoverMovement => ({
  stockItemId: id,
  change,
  reason,
  occurredAt: at,
});

test('a stock count is not demand, and a receipt is not consumption', () => {
  const tally = tallyMovements(
    [
      mv('s-13', 60, 'order_received', '2026-08-05T08:00:00Z'),
      mv('s-13', 54, 'order_received', '2026-08-10T08:00:00Z'),
      mv('s-13', -42, 'recipe_consumed', '2026-08-12T08:00:00Z'),
      mv('s-13', -14, 'count_adjustment', '2026-08-15T14:40:00Z'),
    ],
    { today: TODAY },
  );
  assert.deepEqual(tally.get('s-13'), { consumed: 42, received: 114, adjusted: -14 });
});

test('movements outside the 30-day window are not last month’s usage', () => {
  const tally = tallyMovements(
    [
      mv('s-21', -100, 'recipe_consumed', '2026-06-01T08:00:00Z'),
      mv('s-21', -29, 'recipe_consumed', '2026-08-10T08:00:00Z'),
    ],
    { today: TODAY },
  );
  assert.equal(tally.get('s-21')?.consumed, 29);
});

test('an unreadable "today" tallies nothing rather than guessing a window', () => {
  assert.equal(tallyMovements([mv('s-21', -5, 'transfer', '2026-08-10T08:00:00Z')], { today: 'soon' }).size, 0);
});

/* ── shapeStockPosition ───────────────────────────────────────────────────── */

test('days of cover is on hand over last month’s average daily usage', () => {
  const lines = shapeStockPosition(ITEMS, TALLIES);
  const oil = lines.find((l) => l.stock_item_id === 's-21');
  // 12 cases ÷ (29 ÷ 30 days) = 12.4 days — the "~12 days" the demo tells.
  assert.equal(oil?.days_of_cover, 12.4);
  assert.equal(oil?.on_hand, 12);
  assert.equal(oil?.low_threshold, 16);
  assert.equal(oil?.consumption_30d, 29);
  assert.equal(oil?.status, 'low');
});

test('a line with no movement has UNKNOWN cover, not zero', () => {
  const lines = shapeStockPosition(ITEMS, TALLIES);
  const quiet = lines.find((l) => l.stock_item_id === 's-quiet');
  assert.equal(quiet?.days_of_cover, null);
  assert.equal(quiet?.consumption_30d, 0);
  // Still low: the threshold alone is enough to say that much.
  assert.equal(quiet?.status, 'low');
});

test('status uses ProcurePulse’s own definition, renamed in_stock → ok', () => {
  const lines = shapeStockPosition(ITEMS, TALLIES);
  assert.equal(lines.find((l) => l.stock_item_id === 's-16')?.status, 'out');
  assert.equal(lines.find((l) => l.stock_item_id === 's-2')?.status, 'low');
  assert.equal(lines.find((l) => l.stock_item_id === 's-13')?.status, 'ok');
});

test('only_at_risk answers "what will I run out of this week?"', () => {
  const lines = shapeStockPosition(ITEMS, TALLIES, { onlyAtRisk: true });
  // Soonest first, and the healthy line is gone.
  assert.deepEqual(
    lines.map((l) => l.stock_item_id),
    ['s-16', 's-30', 's-2', 's-23', 's-21', 's-quiet'],
  );
  assert.equal(lines.find((l) => l.stock_item_id === 's-13'), undefined);
  // Unknown cover sorts last — not urgent, not calm, just last.
  assert.equal(lines.at(-1)?.days_of_cover, null);
});

test('a healthy line with under a week of cover is still at risk', () => {
  // Above its threshold, so stockStatus says ok — but it goes out the door fast
  // enough to be gone this week, which is what the question asked.
  const busy = [line('s-fast', 'Mixed Salad Leaf (crate)', 'crate', 20, 5)];
  const tallies = new Map<string, MovementTally>([['s-fast', { consumed: 150, received: 160, adjusted: 0 }]]);
  const lines = shapeStockPosition(busy, tallies, { onlyAtRisk: true });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].status, 'ok');
  assert.ok((lines[0].days_of_cover ?? 99) < AT_RISK_COVER_DAYS);
});

test('count variance is measured against what came in, and carries no rand', () => {
  const lines = shapeStockPosition(ITEMS, TALLIES);
  const chicken = lines.find((l) => l.stock_item_id === 's-13');
  // 14 boxes written off against 114 received = 12.3% — the demo's "-12%".
  assert.deepEqual(chicken?.variance_30d, { adjust: -14, pct: 12.3 });
  assert.equal(Object.keys(chicken ?? {}).some((k) => /rand|cost|price/.test(k)), false);
  // A line whose counts found nothing missing reports null, not a zero variance.
  assert.equal(lines.find((l) => l.stock_item_id === 's-21')?.variance_30d, null);
});

test('a query narrows to the line the user named', () => {
  const lines = shapeStockPosition(ITEMS, TALLIES, { query: 'cooking oil' });
  assert.deepEqual(lines.map((l) => l.stock_item_id), ['s-21']);
  assert.deepEqual(shapeStockPosition(ITEMS, TALLIES, { query: 'butternut' }), []);
});

test('the output is capped so a big catalogue cannot flood the model', () => {
  const many = Array.from({ length: 40 }, (_, i) => line(`s-${i}`, `Line ${i}`, 'box', 5, 10));
  assert.equal(shapeStockPosition(many, new Map()).length, 12);
});
