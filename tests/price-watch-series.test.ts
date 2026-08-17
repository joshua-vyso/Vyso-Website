import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeSeries, type SeriesPointRow } from '../lib/platform/price-watch/series.ts';

// The shaping is the part of the finding detail page that can be wrong without
// looking wrong. A bad sort turns a rise into a fall; a bad window turns
// "at your current ~380 kg/month" into a number the owner will quote at a
// supplier. Both are drawn as confident, finished figures on screen, so the
// ordering, the coercion, the delta and the 90-day window are pinned here
// rather than left to a browser check.

const NOW = new Date('2026-08-17T09:00:00.000Z');

function row(overrides: Partial<SeriesPointRow> = {}): SeriesPointRow {
  return {
    invoice_date: '2026-08-01',
    unit_price: 9.42,
    quantity_base: 120,
    document_id: 'doc-1',
    line_index: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

test('shapeSeries: points come back in invoice-date order however they arrive', () => {
  const { points } = shapeSeries(
    [
      row({ invoice_date: '2026-07-04', document_id: 'c' }),
      row({ invoice_date: '2026-06-02', document_id: 'a' }),
      row({ invoice_date: '2026-06-20', document_id: 'b' }),
    ],
    NOW,
  );

  assert.deepEqual(
    points.map((p) => p.document_id),
    ['a', 'b', 'c'],
  );
});

test('shapeSeries: two lines on the same invoice keep line order', () => {
  const { points } = shapeSeries(
    [
      row({ invoice_date: '2026-06-02', line_index: 7, document_id: 'later' }),
      row({ invoice_date: '2026-06-02', line_index: 2, document_id: 'earlier' }),
    ],
    NOW,
  );

  assert.deepEqual(
    points.map((p) => p.document_id),
    ['earlier', 'later'],
  );
});

test('shapeSeries: first and last are the ends of the ordered series', () => {
  const { first, last } = shapeSeries(
    [
      row({ invoice_date: '2026-07-04', unit_price: 9.42 }),
      row({ invoice_date: '2026-06-02', unit_price: 8.4 }),
    ],
    NOW,
  );

  assert.equal(first?.unit_price, 8.4);
  assert.equal(last?.unit_price, 9.42);
});

// ---------------------------------------------------------------------------
// Coercion and rejection — PostgREST hands numerics back as strings
// ---------------------------------------------------------------------------

test('shapeSeries: string numerics become numbers', () => {
  const { points } = shapeSeries(
    [row({ unit_price: '9.42', quantity_base: '120.5', line_index: '3' })],
    NOW,
  );

  assert.equal(points[0].unit_price, 9.42);
  assert.equal(points[0].quantity_base, 120.5);
  assert.equal(points[0].line_index, 3);
});

test('shapeSeries: a row with no usable price is dropped, not drawn at zero', () => {
  const { points } = shapeSeries(
    [row({ unit_price: null }), row({ unit_price: 'not a price' }), row({ unit_price: 9.42 })],
    NOW,
  );

  assert.equal(points.length, 1);
  assert.equal(points[0].unit_price, 9.42);
});

test('shapeSeries: a row with no usable date is dropped', () => {
  const { points } = shapeSeries(
    [row({ invoice_date: null }), row({ invoice_date: '02/06/2026' }), row()],
    NOW,
  );

  assert.equal(points.length, 1);
});

test('shapeSeries: a missing quantity counts as nothing bought, not a dropped point', () => {
  const { points, monthlyVolume } = shapeSeries(
    [row({ quantity_base: null, invoice_date: '2026-08-01' })],
    NOW,
  );

  assert.equal(points.length, 1);
  assert.equal(points[0].quantity_base, 0);
  // Nothing established → null, never 0.
  assert.equal(monthlyVolume, null);
});

test('shapeSeries: no rows at all', () => {
  const shape = shapeSeries([], NOW);

  assert.deepEqual(shape.points, []);
  assert.equal(shape.first, null);
  assert.equal(shape.last, null);
  assert.equal(shape.deltaPct, null);
  assert.equal(shape.monthlyVolume, null);
});

// ---------------------------------------------------------------------------
// Delta
// ---------------------------------------------------------------------------

test('shapeSeries: deltaPct is the move from the first price to the last', () => {
  const { deltaPct } = shapeSeries(
    [
      row({ invoice_date: '2026-06-02', unit_price: 8 }),
      row({ invoice_date: '2026-08-01', unit_price: 9 }),
    ],
    NOW,
  );

  assert.ok(deltaPct != null);
  assert.ok(Math.abs(deltaPct - 12.5) < 1e-9);
});

test('shapeSeries: a fall is a negative delta', () => {
  const { deltaPct } = shapeSeries(
    [
      row({ invoice_date: '2026-06-02', unit_price: 10 }),
      row({ invoice_date: '2026-08-01', unit_price: 9 }),
    ],
    NOW,
  );

  assert.ok(deltaPct != null && deltaPct < 0);
  assert.ok(Math.abs(deltaPct + 10) < 1e-9);
});

test('shapeSeries: one point is no trend', () => {
  const { deltaPct, first, last } = shapeSeries([row()], NOW);

  assert.equal(deltaPct, null);
  assert.equal(first?.document_id, 'doc-1');
  assert.equal(last?.document_id, 'doc-1');
});

test('shapeSeries: no percentage of a zero first price', () => {
  const { deltaPct } = shapeSeries(
    [
      row({ invoice_date: '2026-06-02', unit_price: 0 }),
      row({ invoice_date: '2026-08-01', unit_price: 9 }),
    ],
    NOW,
  );

  assert.equal(deltaPct, null);
});

// ---------------------------------------------------------------------------
// Monthly volume — 90 days / 3
// ---------------------------------------------------------------------------

test('shapeSeries: monthly volume is the 90-day total over three', () => {
  const { monthlyVolume } = shapeSeries(
    [
      row({ invoice_date: '2026-06-20', quantity_base: 300 }),
      row({ invoice_date: '2026-07-20', quantity_base: 300 }),
      row({ invoice_date: '2026-08-10', quantity_base: 540 }),
    ],
    NOW,
  );

  assert.equal(monthlyVolume, 380);
});

test('shapeSeries: buying older than the window does not inflate the estimate', () => {
  const { monthlyVolume, points } = shapeSeries(
    [
      row({ invoice_date: '2025-01-05', quantity_base: 9000 }),
      row({ invoice_date: '2026-08-10', quantity_base: 300 }),
    ],
    NOW,
  );

  // The old point is still charted — it is real history — it just isn't
  // "current" buying.
  assert.equal(points.length, 2);
  assert.equal(monthlyVolume, 100);
});

test('shapeSeries: a point exactly on the 90-day boundary is inside the window', () => {
  // NOW is 2026-08-17; 90 days back is 2026-05-19.
  const inside = shapeSeries([row({ invoice_date: '2026-05-19', quantity_base: 300 })], NOW);
  const outside = shapeSeries([row({ invoice_date: '2026-05-18', quantity_base: 300 })], NOW);

  assert.equal(inside.monthlyVolume, 100);
  assert.equal(outside.monthlyVolume, null);
});

test('shapeSeries: nothing bought in the window says nothing, not zero', () => {
  const { monthlyVolume } = shapeSeries(
    [row({ invoice_date: '2025-03-01', quantity_base: 500 })],
    NOW,
  );

  assert.equal(monthlyVolume, null);
});
