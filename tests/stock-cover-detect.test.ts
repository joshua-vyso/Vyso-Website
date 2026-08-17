import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectStockCoverFindings,
  buildStockCoverDedupeKey,
  parseStockCoverDedupeKey,
  COUNT_ADJUSTMENT_REASON,
  COUNT_VARIANCE_FLOOR_PCT,
  WINDOW_DAYS,
  type StockCoverItem,
  type StockCoverMovement,
} from '../lib/platform/stock-cover/detect.ts';

// 2026-08-17 is where supabase/demo-refresh-2026-08.sql leaves the Meridian
// workspace, and 2026-W34 is that date's ISO week (isoWeekOf, price-watch/run.ts).
const TODAY = '2026-08-17';
const WEEK = '2026-W34';
const AT = { today: TODAY, isoWeek: WEEK };

/** en-ZA groups thousands with a NON-BREAKING space (U+00A0) — `rand()` formats
 *  every money figure in this product, so the observations carry it. Spelled out
 *  so these expectations are readable rather than hiding a codepoint. */
const NB = '\u00A0';
function zar(whole: number): string {
  return `R ${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NB)}`;
}

/** An ISO timestamp `n` days before TODAY. */
function daysBefore(n: number): string {
  return new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86_400_000).toISOString();
}

function item(overrides: Partial<StockCoverItem> = {}): StockCoverItem {
  return {
    stockItemId: 'item-1',
    name: 'Cooking Oil (4×5L case)',
    unit: 'case',
    onHand: 12,
    lowThreshold: 16,
    avgUnitPrice: 640,
    ...overrides,
  };
}

function used(qty: number, daysAgo: number, stockItemId = 'item-1'): StockCoverMovement {
  return { stockItemId, change: -qty, reason: 'recipe_consumed', occurredAt: daysBefore(daysAgo) };
}
function received(qty: number, daysAgo: number, stockItemId = 'item-1'): StockCoverMovement {
  return { stockItemId, change: qty, reason: 'order_received', occurredAt: daysBefore(daysAgo) };
}
function counted(delta: number, daysAgo: number, stockItemId = 'item-1'): StockCoverMovement {
  return {
    stockItemId,
    change: delta,
    reason: COUNT_ADJUSTMENT_REASON,
    occurredAt: daysBefore(daysAgo),
  };
}

// ---------------------------------------------------------------------------
// Rule (a) — low cover
// ---------------------------------------------------------------------------

const COVER_CASES: Array<{ name: string; item: StockCoverItem; movements: StockCoverMovement[]; fires: boolean }> = [
  {
    name: 'at the threshold, with usage, fires',
    item: item({ onHand: 16, lowThreshold: 16 }),
    movements: [used(30, 5)],
    fires: true,
  },
  {
    name: 'one unit above the threshold does not',
    item: item({ onHand: 17, lowThreshold: 16 }),
    movements: [used(30, 5)],
    fires: false,
  },
  {
    name: 'low but UNUSED all month says nothing — "we have not touched it" is not "we are about to run out"',
    item: item({ onHand: 12, lowThreshold: 16 }),
    movements: [received(40, 5)],
    fires: false,
  },
  {
    name: 'a stock count is not usage, so a low line whose only movement was a count says nothing',
    item: item({ onHand: 12, lowThreshold: 16 }),
    movements: [counted(-8, 3)],
    fires: false,
  },
  {
    name: 'usage older than the window does not keep a line alive',
    item: item({ onHand: 12, lowThreshold: 16 }),
    movements: [used(30, WINDOW_DAYS + 1)],
    fires: false,
  },
  {
    name: 'usage exactly at the window edge still counts',
    item: item({ onHand: 12, lowThreshold: 16 }),
    movements: [used(30, WINDOW_DAYS)],
    fires: true,
  },
  {
    name: 'an out-of-stock line fires (stockStatus: out is not in_stock)',
    item: item({ onHand: 0, lowThreshold: 20 }),
    movements: [used(38, 4)],
    fires: true,
  },
];

for (const c of COVER_CASES) {
  test(`detectStockCoverFindings low cover: ${c.name}`, () => {
    const found = detectStockCoverFindings([c.item], c.movements, AT).filter((f) => f.rule === 'low_cover');
    assert.equal(found.length, c.fires ? 1 : 0);
  });
}

test('detectStockCoverFindings: the cover observation carries days, on-hand and the threshold, and no rand figure', () => {
  const [f] = detectStockCoverFindings([item()], [used(29, 6)], AT);
  assert.equal(
    f.observation,
    "Cooking Oil (4×5L case) has ~12 days of cover at last month's usage — 12 cases on hand, threshold 16.",
  );
  // Nothing is lost yet — a rand figure here would be invented.
  assert.equal(f.randImpact, null);
  assert.equal(f.dedupeKey, buildStockCoverDedupeKey('low_cover', 'item-1', WEEK));
});

test('detectStockCoverFindings: cover inside the coming week names a weekday, further out names a date', () => {
  // 12 units, 60 used in the month ⇒ 2/day ⇒ 6 days of cover ⇒ Sunday 23 Aug.
  const [near] = detectStockCoverFindings([item()], [used(60, 6)], AT);
  assert.equal(near.recommendedAction, 'Reorder before Sunday');
  // 12 units, 29 used ⇒ 12 days ⇒ 29 August, which no weekday name could
  // identify unambiguously.
  const [far] = detectStockCoverFindings([item()], [used(29, 6)], AT);
  assert.equal(far.recommendedAction, 'Reorder before 29 August');
});

test('detectStockCoverFindings: a line already at zero is told to reorder now, not "before" anything', () => {
  const [f] = detectStockCoverFindings(
    [item({ name: 'Line Fish Fillet (kg)', unit: 'kg', onHand: 0, lowThreshold: 20 })],
    [used(38, 4)],
    AT,
  );
  assert.equal(f.recommendedAction, 'Reorder now — nothing is left on this line');
  assert.equal(
    f.observation,
    "Line Fish Fillet (kg) has ~0 days of cover at last month's usage — 0 kg on hand, threshold 20.",
  );
});

// ---------------------------------------------------------------------------
// Rule (b) — count variance
// ---------------------------------------------------------------------------

const VARIANCE_CASES: Array<{ name: string; movements: StockCoverMovement[]; fires: boolean }> = [
  {
    name: `exactly ${COUNT_VARIANCE_FLOOR_PCT}% of receipts fires`,
    movements: [received(100, 10), counted(-5, 2)],
    fires: true,
  },
  {
    name: 'just under the floor does not',
    movements: [received(100, 10), counted(-4, 2)],
    fires: false,
  },
  {
    name: 'a count that found MORE than the book is not shrinkage',
    movements: [received(100, 10), counted(+20, 2)],
    fires: false,
  },
  {
    name: 'nothing received all month ⇒ no percentage to measure against',
    movements: [counted(-40, 2)],
    fires: false,
  },
  {
    name: 'ordinary consumption is never mistaken for a write-off',
    movements: [received(100, 10), used(90, 2)],
    fires: false,
  },
  {
    name: 'a count outside the window does not fire this month',
    movements: [received(100, 10), counted(-40, WINDOW_DAYS + 1)],
    fires: false,
  },
];

for (const c of VARIANCE_CASES) {
  test(`detectStockCoverFindings count variance: ${c.name}`, () => {
    const found = detectStockCoverFindings([item({ onHand: 500, lowThreshold: 16 })], c.movements, AT).filter(
      (f) => f.rule === 'count_variance',
    );
    assert.equal(found.length, c.fires ? 1 : 0);
  });
}

test('detectStockCoverFindings: the variance observation prices the write-off at the line average', () => {
  const [f] = detectStockCoverFindings(
    [item({ name: 'Chicken Portions (10kg box)', unit: 'box', onHand: 72, lowThreshold: 24, avgUnitPrice: 620 })],
    [received(44, 1), received(31, 10), received(40, 13), counted(-14, 2)],
    AT,
  );
  assert.equal(
    f.observation,
    `Stock count wrote off 14 boxes of Chicken Portions (10kg box) this month (−12% of what came in) — ${zar(8_680)} at cost — worth a look.`,
  );
  assert.equal(f.randImpact, 8_680);
  assert.equal(f.dedupeKey, buildStockCoverDedupeKey('count_variance', 'item-1', WEEK));
});

test('detectStockCoverFindings: an unpriced line reports the units and no rand figure', () => {
  const [f] = detectStockCoverFindings(
    [item({ onHand: 500, lowThreshold: 16, avgUnitPrice: null })],
    [received(100, 10), counted(-20, 2)],
    AT,
  );
  assert.equal(f.randImpact, null);
  assert.equal(
    f.observation,
    'Stock count wrote off 20 cases of Cooking Oil (4×5L case) this month (−20% of what came in) — worth a look.',
  );
});

// ---------------------------------------------------------------------------
// The dedupe key
// ---------------------------------------------------------------------------

test('parseStockCoverDedupeKey: round-trips both rules', () => {
  for (const rule of ['low_cover', 'count_variance'] as const) {
    const key = buildStockCoverDedupeKey(rule, 'item-21', WEEK);
    assert.deepEqual(parseStockCoverDedupeKey(key), { rule, stockItemId: 'item-21', isoWeek: WEEK });
  }
});

const BAD_KEYS = [
  '',
  'stock_cover',
  'stock_cover:low_cover:item-21',
  'stock_cover:low_cover:item-21:2026-W34:extra',
  'stock_cover:made_up_rule:item-21:2026-W34',
  'price_watch:low_cover:item-21:2026-W34',
  'stock_cover:low_cover::2026-W34',
];
for (const key of BAD_KEYS) {
  test(`parseStockCoverDedupeKey: refuses to half-read ${JSON.stringify(key)}`, () => {
    assert.equal(parseStockCoverDedupeKey(key), null);
  });
}

// ---------------------------------------------------------------------------
// MERIDIAN — every stock line supabase/demo-refresh-2026-08.sql touches, with
// the movement ledger its §3.1 generator writes.
//
//   base       = greatest(round(low_threshold * 0.9), 2)
//   six slots  = +2.0b, −0.60b, −0.75b, +1.40b, +1.80b, −0.70b   (all rounded)
//   plus §3.2's two count adjustments on 15 Aug (item 13 −14, item 25 −10)
//
// Every slot for these lines lands inside the 30-day window ending 2026-08-17,
// so the tallies below ARE the whole month. This is the fixture the final report
// quotes.
// ---------------------------------------------------------------------------

/** The seed's own magnitude generator, so the fixture is derived rather than
 *  transcribed. Postgres `round()` goes half AWAY from zero, which is what
 *  Math.round does for the positive magnitudes here. */
function meridianMovements(stockItemId: string, lowThreshold: number): StockCoverMovement[] {
  const base = Math.max(Math.round(lowThreshold * 0.9), 2);
  const slots: Array<[change: number, reason: string]> = [
    [Math.round(base * 2.0), 'order_received'],
    [-Math.round(base * 0.6), 'recipe_consumed'],
    [-Math.round(base * 0.75), 'transfer'],
    [Math.round(base * 1.4), 'document_sync'],
    [Math.round(base * 1.8), 'order_received'],
    [-Math.round(base * 0.7), 'recipe_consumed'],
  ];
  return slots.map(([change, reason], slot) => ({
    stockItemId,
    change,
    reason,
    // The exact hour does not matter — every slot is inside the window — so the
    // slot index is spread across it the way §3.1's `slot * 3` days does.
    occurredAt: daysBefore(slot * 3 + 1),
  }));
}

const MERIDIAN_ITEMS: StockCoverItem[] = [
  { stockItemId: 'item-02', name: 'Baby Spinach (crate)',       unit: 'crate', onHand:  6, lowThreshold: 12, avgUnitPrice: 132 },
  { stockItemId: 'item-13', name: 'Chicken Portions (10kg box)', unit: 'box',   onHand: 72, lowThreshold: 24, avgUnitPrice: 620 },
  { stockItemId: 'item-16', name: 'Line Fish Fillet (kg)',       unit: 'kg',    onHand:  0, lowThreshold: 20, avgUnitPrice: 168 },
  { stockItemId: 'item-21', name: 'Cooking Oil (4×5L case)',     unit: 'case',  onHand: 12, lowThreshold: 16, avgUnitPrice: 640 },
  { stockItemId: 'item-23', name: 'Fresh Milk (12×1L case)',     unit: 'case',  onHand: 18, lowThreshold: 24, avgUnitPrice: 168 },
  { stockItemId: 'item-25', name: 'Cheese Block (kg)',           unit: 'kg',    onHand: 86, lowThreshold: 28, avgUnitPrice: 138 },
  { stockItemId: 'item-30', name: 'Bread Rolls (24/bag)',        unit: 'bag',   onHand: 14, lowThreshold: 30, avgUnitPrice:  42 },
];

const MERIDIAN_MOVEMENTS: StockCoverMovement[] = [
  ...MERIDIAN_ITEMS.flatMap((i) => meridianMovements(i.stockItemId, i.lowThreshold)),
  // §3.2 — the monthly count, Sat 15 Aug.
  counted(-14, 2, 'item-13'),
  counted(-10, 2, 'item-25'),
];

test('detectStockCoverFindings: Meridian on 2026-08-17', () => {
  const found = detectStockCoverFindings(MERIDIAN_ITEMS, MERIDIAN_MOVEMENTS, AT);
  assert.deepEqual(
    found.map((f) => f.observation),
    [
      // Money already lost, biggest first.
      `Stock count wrote off 14 boxes of Chicken Portions (10kg box) this month (−12% of what came in) — ${zar(8_680)} at cost — worth a look.`,
      `Stock count wrote off 10 kg of Cheese Block (kg) this month (−8% of what came in) — ${zar(1_380)} at cost — worth a look.`,
      // Then the levels, alphabetically (none carries a rand figure, so there is
      // nothing to rank them by).
      "Baby Spinach (crate) has ~8 days of cover at last month's usage — 6 crates on hand, threshold 12.",
      "Bread Rolls (24/bag) has ~8 days of cover at last month's usage — 14 bags on hand, threshold 30.",
      "Cooking Oil (4×5L case) has ~12 days of cover at last month's usage — 12 cases on hand, threshold 16.",
      "Fresh Milk (12×1L case) has ~12 days of cover at last month's usage — 18 cases on hand, threshold 24.",
      "Line Fish Fillet (kg) has ~0 days of cover at last month's usage — 0 kg on hand, threshold 20.",
    ],
  );
  assert.deepEqual(
    found.map((f) => f.recommendedAction),
    [
      'Check the receiving and count sheets for this line',
      'Check the receiving and count sheets for this line',
      'Reorder before 25 August',
      'Reorder before 25 August',
      'Reorder before 29 August',
      'Reorder before 29 August',
      'Reorder now — nothing is left on this line',
    ],
  );
  assert.deepEqual(found.map((f) => f.randImpact), [8_680, 1_380, null, null, null, null, null]);
});
