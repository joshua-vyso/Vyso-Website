import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clampMonths,
  groupBySeries,
  itemNameCore,
  linkStockItem,
  marginExposure,
  medianComparison,
  rankPriceItems,
  shapeSeriesForTool,
  type PricePointRow,
  type PwItemRow,
  type PwMatchRow,
} from '../lib/ai/finch/price-watch-data.ts';
import { shapeSeries } from '../lib/platform/price-watch/series.ts';

// Finch's price answers are read out loud to a supplier on the phone. The
// shaping below is where they can be wrong without LOOKING wrong: a median
// taken over the whole series instead of the trailing 60 days understates every
// increase, a name-core rule that is one character too loose links the margin
// of one product to the recipes of another, and both come out of the model as
// confident sentences with a rand figure attached.
//
// THE FIXTURE IS MERIDIAN'S REAL COOKING-OIL SERIES
// (supabase/demo-refresh-2026-08.sql §2a): R558 → R566 → R640 → R664 between
// 8 June and 13 August 2026, on 240/260/280/290 cases. The SQL states the
// answers the demo is built on — +10.1% against a R603.00 median, 5 917 annual
// cases, R360 937 a year — so pinning them here means a change to this file
// that would put a different number in the rehearsal is a failing test, not a
// surprise in front of a prospect.

const NOW = new Date('2026-08-18T09:00:00.000Z');

function point(date: string, price: number, qty: number, doc: string): PricePointRow {
  return {
    supplier_id: 'sup-riebeek',
    line_supplier: null,
    invoice_date: date,
    unit_price: price,
    quantity_base: qty,
    document_id: doc,
    line_index: 0,
  };
}

const OIL: PricePointRow[] = [
  point('2026-06-08', 558, 240, 'doc-a'),
  point('2026-06-30', 566, 260, 'doc-b'),
  point('2026-07-22', 640, 280, 'doc-c'),
  point('2026-08-13', 664, 290, 'doc-d'),
];

/* ── itemNameCore ─────────────────────────────────────────────────────────── */

test('the name core drops the pack-size parenthetical and the punctuation', () => {
  assert.equal(itemNameCore('Cooking oil (5L)'), 'cooking oil');
  assert.equal(itemNameCore('Cooking Oil (4×5L case)'), 'cooking oil');
  assert.equal(itemNameCore('Line Fish Fillet (kg)'), 'line fish fillet');
  assert.equal(itemNameCore('  Baby   Spinach (crate) '), 'baby spinach');
  assert.equal(itemNameCore(null), '');
});

test('two pack sizes of one product share a core; two products do not', () => {
  // This equality is the whole recipe link. If it broke, every margin answer
  // would silently degrade to 'not_linked' rather than fail loudly.
  assert.equal(itemNameCore('Cooking oil (5L)'), itemNameCore('Cooking Oil (4×5L case)'));
  assert.notEqual(itemNameCore('Cooking oil (5L)'), itemNameCore('Olive Oil (5L)'));
});

/* ── rankPriceItems ───────────────────────────────────────────────────────── */

const ITEMS: PwItemRow[] = [
  { id: 'i-oil', name: 'Cooking oil (5L)', base_unit: 'case' },
  { id: 'i-fish', name: 'Line fish fillet', base_unit: 'kg' },
  { id: 'i-cheese', name: 'Cheese block', base_unit: 'kg' },
];

const MATCHES: PwMatchRow[] = [
  { raw_description: 'SUNFLOWER COOKING OIL 4X5L', pw_item_id: 'i-oil', status: 'auto' },
  { raw_description: 'CHEESE CHEDDAR BLOCK 2KG', pw_item_id: 'i-cheese', status: 'confirmed' },
  // A 'review' row is a guess nobody has agreed with — it must not reach a
  // price series.
  { raw_description: 'HAKE LOIN PORTIONS', pw_item_id: 'i-fish', status: 'review' },
];

test('a spoken name resolves to the catalogue item', () => {
  const hits = rankPriceItems(ITEMS, MATCHES, 'cooking oil');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'i-oil');
});

test('an item reachable only through a supplier line description still ranks', () => {
  const hits = rankPriceItems(ITEMS, MATCHES, 'sunflower');
  assert.deepEqual(hits.map((h) => h.id), ['i-oil']);
});

test('a review-status match is never followed', () => {
  // 'hake' reaches i-fish only via a review row, so nothing matches.
  assert.deepEqual(rankPriceItems(ITEMS, MATCHES, 'hake'), []);
});

test('a name nothing matches returns nothing rather than a plausible item', () => {
  assert.deepEqual(rankPriceItems(ITEMS, MATCHES, 'butternut'), []);
  assert.deepEqual(rankPriceItems(ITEMS, MATCHES, '   '), []);
});

test('the cap is honoured', () => {
  const many: PwItemRow[] = Array.from({ length: 10 }, (_, i) => ({
    id: `i-${i}`,
    name: `Cooking oil grade ${i}`,
    base_unit: 'case',
  }));
  assert.equal(rankPriceItems(many, [], 'cooking oil', 6).length, 6);
});

/* ── grouping ─────────────────────────────────────────────────────────────── */

test('a market agent gets its own series, and null/blank are one agent', () => {
  const rows: PricePointRow[] = [
    ...OIL,
    { ...point('2026-08-01', 700, 10, 'doc-e'), line_supplier: 'Botha Roodt & Kie' },
    { ...point('2026-08-02', 705, 10, 'doc-f'), line_supplier: '' },
  ];
  const grouped = groupBySeries(rows);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get('sup-riebeek::')?.length, 5);
  assert.equal(grouped.get('sup-riebeek::Botha Roodt & Kie')?.length, 1);
});

/* ── medianComparison — the 60-day rule ───────────────────────────────────── */

test('the median is the trailing 60 days of PRIOR points, not the whole series', () => {
  const shape = shapeSeries(OIL, NOW);
  const cmp = medianComparison(shape.points);
  // 8 June is 66 days before 13 August, so it falls OUT of the window: the
  // median is of (566, 640), not of (558, 566, 640).
  assert.equal(cmp.pointsInWindow, 2);
  assert.equal(cmp.median, 603);
  assert.equal(Math.round((cmp.deltaPct ?? 0) * 10) / 10, 10.1);
});

test('nothing before the latest point means no median — not "no change"', () => {
  const single = shapeSeries([point('2026-08-13', 664, 290, 'doc-d')], NOW);
  assert.deepEqual(medianComparison(single.points), {
    median: null,
    deltaPct: null,
    pointsInWindow: 0,
  });
  // Two points more than 60 days apart: the earlier one is outside the window.
  const far = shapeSeries([point('2026-01-02', 400, 10, 'x'), point('2026-08-13', 664, 10, 'y')], NOW);
  assert.equal(medianComparison(far.points).median, null);
});

/* ── shapeSeriesForTool ───────────────────────────────────────────────────── */

test("Meridian's cooking-oil series shapes to the numbers the demo SQL states", () => {
  const s = shapeSeriesForTool(OIL, 'Riebeek Oils & Fats', NOW);
  assert.ok(s);
  assert.equal(s.supplier_name, 'Riebeek Oils & Fats');
  assert.equal(s.line_supplier, null);
  assert.equal(s.points_total, 4);
  assert.deepEqual(s.first, { date: '2026-06-08', unit_price: 558 });
  assert.deepEqual(s.last, { date: '2026-08-13', unit_price: 664 });
  // First→last and vs-median are DIFFERENT claims and both are reported.
  assert.equal(s.delta_pct, 19);
  assert.equal(s.median_60d, 603);
  assert.equal(s.delta_vs_median_pct, 10.1);
  // detect.ts's own trailing-12-week annualisation, so the tool and the Brief
  // card cannot quote different volumes for the same series.
  assert.equal(s.annual_volume_estimate, 5917);
  assert.equal(s.monthly_volume_estimate, 493);
  assert.deepEqual(s.evidence_document_ids, ['doc-a', 'doc-b', 'doc-c', 'doc-d']);
});

test('a market agent, not the document supplier, is the name the series carries', () => {
  const agentRows = OIL.map((p) => ({ ...p, line_supplier: 'Botha Roodt & Kie' }));
  const s = shapeSeriesForTool(agentRows, 'Cape Town Market', NOW);
  assert.equal(s?.supplier_name, 'Botha Roodt & Kie');
  assert.equal(s?.line_supplier, 'Botha Roodt & Kie');
});

test('a one-point series reports the point and no move', () => {
  const s = shapeSeriesForTool([point('2026-08-13', 664, 290, 'doc-d')], 'Riebeek Oils & Fats', NOW);
  assert.equal(s?.points_total, 1);
  assert.equal(s?.delta_pct, null);
  assert.equal(s?.median_60d, null);
  assert.equal(s?.delta_vs_median_pct, null);
  // Volume cannot be annualised from one delivery — null, never 0.
  assert.equal(s?.annual_volume_estimate, null);
  assert.equal(s?.monthly_volume_estimate, null);
});

test('no readable rows shape to null rather than an empty shell', () => {
  assert.equal(shapeSeriesForTool([], 'Riebeek Oils & Fats', NOW), null);
});

test('at most 24 dated points are printed, the most recent ones', () => {
  const many: PricePointRow[] = Array.from({ length: 40 }, (_, i) =>
    point(`2026-0${i < 9 ? 7 : 8}-${String((i % 28) + 1).padStart(2, '0')}`, 600 + i, 10, `doc-${i}`),
  );
  const s = shapeSeriesForTool(many, 'Riebeek Oils & Fats', NOW);
  assert.equal(s?.points.length, 24);
  assert.equal(s?.points_total, 40);
  assert.equal(s?.points.at(-1)?.date, s?.last?.date);
});

/* ── linkStockItem ────────────────────────────────────────────────────────── */

const STOCK = [
  { id: 's-21', name: 'Cooking Oil (4×5L case)' },
  { id: 's-16', name: 'Line Fish Fillet (kg)' },
  { id: 's-2', name: 'Baby Spinach (crate)' },
];

test('a buy-side item links to the ProcurePulse line at a different pack size', () => {
  assert.equal(linkStockItem('Cooking oil (5L)', STOCK)?.id, 's-21');
  assert.equal(linkStockItem('Line fish fillet', STOCK)?.id, 's-16');
});

test('ambiguity is a non-match, not a coin toss', () => {
  const twoOils = [...STOCK, { id: 's-99', name: 'Cooking Oil (20L)' }];
  assert.equal(linkStockItem('Cooking oil (5L)', twoOils), null);
});

test('a name with no core, or none in the catalogue, does not link', () => {
  assert.equal(linkStockItem('Oil', STOCK), null);
  assert.equal(linkStockItem(null, STOCK), null);
  assert.equal(linkStockItem('Butternut', STOCK), null);
});

/* ── gating and input clamping ────────────────────────────────────────────── */

test('months clamps into 1…24 and defaults to six', () => {
  assert.equal(clampMonths(undefined), 6);
  assert.equal(clampMonths(0), 6);
  assert.equal(clampMonths('nonsense'), 6);
  assert.equal(clampMonths(3), 3);
  assert.equal(clampMonths(120), 24);
});

test('margin exposure is refused to a caller who may not see money', async () => {
  // The db is deliberately unusable: a restricted caller must be turned away
  // BEFORE a query runs, so this call would throw if the gate ever moved below
  // the read.
  const noDb = null as unknown as SupabaseClient;
  const result = await marginExposure(noDb, 'org-1', false, { pwItemId: 'i-oil' });
  assert.equal(result.ok, false);
  assert.equal('reason' in result && result.reason, 'restricted');
  assert.match(('note' in result && result.note) || '', /admin/i);
});

test('an admin asking with no item id is told so, not queried for', async () => {
  const noDb = null as unknown as SupabaseClient;
  const result = await marginExposure(noDb, 'org-1', true, { pwItemId: '  ' });
  assert.equal(result.ok, false);
  assert.equal('reason' in result && result.reason, 'no_query');
});
