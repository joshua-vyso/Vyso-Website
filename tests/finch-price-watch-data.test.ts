import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  clampMonths,
  groupBySeries,
  isUuid,
  itemNameCore,
  marginExposure,
  medianComparison,
  rankPriceItems,
  resolveStockLink,
  shapeSeriesForTool,
  stockNameCoreMatches,
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

/** The old `linkStockItem`, rebuilt from the two functions that replaced it —
 *  so the pack-size rule these tests were written for is still pinned. */
function link(name: string | null, items: readonly { id: string; name: string }[]) {
  const resolved = resolveStockLink(stockNameCoreMatches(name, items));
  return resolved.kind === 'linked' ? resolved.item : null;
}

test('a buy-side item links to the ProcurePulse line at a different pack size', () => {
  assert.equal(link('Cooking oil (5L)', STOCK)?.id, 's-21');
  assert.equal(link('Line fish fillet', STOCK)?.id, 's-16');
});

test('a name with no core, or none in the catalogue, does not link', () => {
  assert.equal(link('Oil', STOCK), null);
  assert.equal(link(null, STOCK), null);
  assert.equal(link('Butternut', STOCK), null);
});

/* ── which of two same-named stock lines the margin answer is about ───────── */

// The rehearsal's question 3 answered "your recipes don't reference cooking oil"
// about a line feeding three recipes, because ONE stray catalogue row shared its
// name core and the old rule treated any ambiguity as no link at all. Silence
// there is not caution — it is a confident false statement about the owner's
// margin. These pin the tie-break that replaced it.

test('evidence of use beats a stray row with the same name', () => {
  const resolved = resolveStockLink([
    { id: 's-21', name: 'Cooking Oil (4×5L case)', onHand: 12, hasThreshold: true, hasRecipeRef: true, hasReceipt: true },
    { id: 's-99', name: 'Cooking Oil', onHand: 0 },
  ]);
  assert.equal(resolved.kind, 'linked');
  assert.equal(resolved.kind === 'linked' && resolved.item.id, 's-21');
});

test('with equal evidence, the line actually holding stock wins', () => {
  const resolved = resolveStockLink([
    { id: 's-a', name: 'Cooking Oil (20L)', onHand: 0, hasThreshold: true },
    { id: 's-b', name: 'Cooking Oil (4×5L case)', onHand: 12, hasThreshold: true },
  ]);
  assert.equal(resolved.kind === 'linked' && resolved.item.id, 's-b');
});

test('an unknown level never beats a known one', () => {
  const resolved = resolveStockLink([
    { id: 's-a', name: 'Cooking Oil (20L)', onHand: null },
    { id: 's-b', name: 'Cooking Oil (4×5L case)', onHand: 0 },
  ]);
  assert.equal(resolved.kind === 'linked' && resolved.item.id, 's-b');
});

test('a genuine tie is ambiguous AND names the candidates', () => {
  const resolved = resolveStockLink([
    { id: 's-a', name: 'Cooking Oil (20L)', onHand: 4, hasThreshold: true },
    { id: 's-b', name: 'Cooking Oil (4×5L case)', onHand: 4, hasThreshold: true },
  ]);
  assert.equal(resolved.kind, 'ambiguous');
  assert.deepEqual(
    resolved.kind === 'ambiguous' ? resolved.candidates.map((c) => c.name) : [],
    ['Cooking Oil (20L)', 'Cooking Oil (4×5L case)'],
  );
});

test('nothing matching the name is "none", not an empty tie', () => {
  assert.equal(resolveStockLink([]).kind, 'none');
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

/* ── the supplier filter, and why the rehearsal's first margin call failed ─── */

// WHAT HAPPENED. `pw_margin_exposure` was called with supplier_id set to the
// supplier's NAME ("Riebeek Oils & Fats") rather than its uuid — the tool's own
// description invites that, mid-conversation, when the name is what is being
// discussed. PostgREST passes it straight into a uuid comparison, Postgres
// raises 22P02, supabase-js returns an ERROR (not an empty result), and
// readSeries answered `read_failed: "The price history could not be read."` The
// model told the owner it could not find the item — about an item it had just
// read four invoices for.

interface FakeResult {
  data: unknown;
  error: unknown;
}

/** The smallest thing that behaves like a PostgREST query builder: chainable,
 *  awaitable, and it remembers the `.eq()` filters so the handler can answer
 *  differently for the filtered and unfiltered reads. */
function fakeDb(
  handler: (table: string, filters: Record<string, unknown>) => FakeResult,
): SupabaseClient {
  const make = (table: string) => {
    const filters: Record<string, unknown> = {};
    const run = () => Promise.resolve(handler(table, filters));
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (k: string, v: unknown) => {
        filters[k] = v;
        return builder;
      },
      gt: () => builder,
      gte: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      returns: () => builder,
      maybeSingle: () => run(),
      then: (ok: (v: FakeResult) => unknown, no: (e: unknown) => unknown) => run().then(ok, no),
    };
    return builder;
  };
  return { from: (table: string) => make(table) } as unknown as SupabaseClient;
}

const UUID_ERROR = {
  code: '22P02',
  message: 'invalid input syntax for type uuid: "Riebeek Oils & Fats"',
  details: null,
  hint: null,
};

/** Meridian's oil, one stock line, one recipe — the shape question 3 reads. */
function oilDb(overrides: (table: string, filters: Record<string, unknown>) => FakeResult | null): SupabaseClient {
  return fakeDb((table, filters) => {
    const custom = overrides(table, filters);
    if (custom) return custom;
    switch (table) {
      case 'pw_items':
        return { data: { id: 'i-oil', name: 'Cooking Oil (4×5L case)', base_unit: 'case' }, error: null };
      case 'pw_price_points':
        return { data: OIL, error: null };
      case 'suppliers':
        return { data: [{ id: 'sup-riebeek', name: 'Riebeek Oils & Fats' }], error: null };
      case 'pp_stock_items':
        return { data: [{ id: 's-21', name: 'Cooking Oil (4×5L case)', on_hand: 12 }], error: null };
      case 'pl_targets':
        return { data: { target_margin_pct: 41 }, error: null };
      case 'pp_recipe_ingredients':
        return {
          data: [{ recipe_id: 'r-sauce', stock_item_id: 's-21', qty_per_batch: 0.15, unit: 'case' }],
          error: null,
        };
      case 'pp_recipes':
        return { data: [{ id: 'r-sauce', name: 'Sauce Base — Tomato' }], error: null };
      default:
        return { data: [], error: null };
    }
  });
}

test('a uuid is a uuid; a supplier name is not', () => {
  assert.equal(isUuid('01000000-7e5d-4c1a-9b3f-000000000001'), true);
  assert.equal(isUuid('Riebeek Oils & Fats'), false);
  assert.equal(isUuid(''), false);
  assert.equal(isUuid(null), false);
});

test('a supplier NAME where an id belongs no longer fails the whole read', async () => {
  // The db raises 22P02 the moment a supplier_id filter reaches it — exactly
  // what the live call did. The filter must never get there.
  const db = oilDb((table, filters) =>
    table === 'pw_price_points' && filters.supplier_id ? { data: null, error: UUID_ERROR } : null,
  );
  const result = await marginExposure(db, 'org-1', true, { pwItemId: 'i-oil', supplierId: 'Riebeek Oils & Fats' }, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.supplier_filter, 'ignored');
  // And the answer the rehearsal expects, unchanged by the dropped filter.
  assert.equal(result.delta_per_unit, 61);
  assert.equal(result.annual_volume_estimate, 5917);
  assert.equal(result.annual_cost_delta, 360_937);
});

test('a real supplier id that matches nothing falls back rather than answering "not found"', async () => {
  const db = oilDb((table, filters) =>
    table === 'pw_price_points' && filters.supplier_id ? { data: [], error: null } : null,
  );
  const result = await marginExposure(
    db,
    'org-1',
    true,
    { pwItemId: 'i-oil', supplierId: '99999999-7e5d-4c1a-9b3f-000000000001' },
    NOW,
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.supplier_filter, 'not_matched');
  assert.equal(result.latest_unit_price, 664);
});

test('the recipe link survives a stray catalogue row sharing the name', async () => {
  // Meridian's live org has a second "cooking oil" row with nothing behind it.
  // The old rule called that ambiguous and answered "your recipes don't
  // reference this line" — about a line feeding Sauce Base — Tomato.
  const db = oilDb((table, filters) => {
    if (table === 'pp_stock_items') {
      return {
        data: [
          { id: 's-21', name: 'Cooking Oil (4×5L case)', on_hand: 12 },
          { id: 's-99', name: 'Cooking Oil', on_hand: 0 },
        ],
        error: null,
      };
    }
    if (table === 'pp_stock_thresholds') return { data: [{ stock_item_id: 's-21' }], error: null };
    // The evidence read (`.in`) records no eq filter; the recipe-lines read pins
    // stock_item_id. Same table, two different questions.
    if (table === 'pp_recipe_ingredients' && !filters.stock_item_id) {
      return { data: [{ stock_item_id: 's-21' }], error: null };
    }
    return null;
  });
  const result = await marginExposure(db, 'org-1', true, { pwItemId: 'i-oil' }, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.notEqual(result.margin_effect, 'not_linked');
  assert.equal(
    typeof result.margin_effect === 'object' && 'linked_stock_item' in result.margin_effect
      ? result.margin_effect.linked_stock_item.id
      : null,
    's-21',
  );
  assert.equal(result.recipes[0]?.name, 'Sauce Base — Tomato');
  assert.equal(result.recipes[0]?.target_margin_pct, 41);
});

test('two indistinguishable stock lines are named, and the COST still stands', async () => {
  const db = oilDb((table) =>
    table === 'pp_stock_items'
      ? {
          data: [
            { id: 's-a', name: 'Cooking Oil (20L)', on_hand: 4 },
            { id: 's-b', name: 'Cooking Oil (4×5L case)', on_hand: 4 },
          ],
          error: null,
        }
      : null,
  );
  const result = await marginExposure(db, 'org-1', true, { pwItemId: 'i-oil' }, NOW);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const effect = result.margin_effect;
  assert.equal(typeof effect === 'object' && 'reason' in effect ? effect.reason : null, 'ambiguous_stock_line');
  assert.deepEqual(
    typeof effect === 'object' && 'candidates' in effect ? effect.candidates.map((c) => c.name) : [],
    ['Cooking Oil (20L)', 'Cooking Oil (4×5L case)'],
  );
  // The cost is priced off invoices, not off the stock line — it is not in doubt.
  assert.equal(result.annual_cost_delta, 360_937);
});
