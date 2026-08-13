import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPriceFindings, type PwPricePoint, type OpenFinding } from '../lib/platform/price-watch/detect.ts';

// All test dates are built relative to a fixed "latest" date so the maths in
// each assertion is easy to check by hand, and match detect.ts's own
// yyyy-mm-ddT00:00:00 (local midnight) date parsing exactly.
const LATEST = '2026-08-13';
function daysBefore(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - n);
  // Build the yyyy-mm-dd string from LOCAL date components, not
  // toISOString() (which is UTC) — detect.ts parses "date+T00:00:00" as
  // local midnight, so this helper must match that exactly or the
  // day-count arithmetic silently drifts by a day in non-UTC timezones.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const SUPPLIER = 'supplier-1';
const ITEM = 'item-tomatoes';

function point(overrides: Partial<PwPricePoint>): PwPricePoint {
  return {
    supplierId: SUPPLIER,
    lineSupplier: null,
    pwItemId: ITEM,
    documentId: `doc-${overrides.invoiceDate ?? 'x'}-${Math.random().toString(36).slice(2, 6)}`,
    unitPrice: 20,
    quantityBase: 100,
    invoiceDate: LATEST,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pack-size change, flat per-kg price -> no finding (already-normalised inputs)
// ---------------------------------------------------------------------------

test('detectPriceFindings: identical normalised unit price across a pack-size change fires nothing', () => {
  // normalize.ts already proved 10x5kg@R100 and 5x10kg@R200 both become
  // R20/kg — feed detect.ts exactly that steady R20/kg series and confirm
  // no finding, since there is genuinely no price move to report.
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 50 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 50 }),
    point({ invoiceDate: LATEST, unitPrice: 20, quantityBase: 50 }),
  ];
  assert.deepEqual(detectPriceFindings(points), []);
});

// ---------------------------------------------------------------------------
// < 3 points -> nothing
// ---------------------------------------------------------------------------

test('detectPriceFindings: fewer than 3 points in the series fires nothing, even with a huge jump', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 10, quantityBase: 1000 }),
    point({ invoiceDate: LATEST, unitPrice: 30, quantityBase: 1000 }),
  ];
  assert.deepEqual(detectPriceFindings(points), []);
});

// ---------------------------------------------------------------------------
// Below 8% -> nothing
// ---------------------------------------------------------------------------

test('detectPriceFindings: a move under the 8% floor fires nothing, regardless of volume', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 5000 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 5000 }),
    point({ invoiceDate: LATEST, unitPrice: 21, quantityBase: 5000 }), // +5%
  ];
  assert.deepEqual(detectPriceFindings(points), []);
});

// ---------------------------------------------------------------------------
// Below R1,000 impact -> nothing
// ---------------------------------------------------------------------------

test('detectPriceFindings: an 8%+ move with negligible volume fires nothing (impact under R1,000)', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 1 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 1 }),
    point({ invoiceDate: LATEST, unitPrice: 30, quantityBase: 1 }), // +50%, but ~1kg/window of volume
  ];
  const findings = detectPriceFindings(points);
  assert.deepEqual(findings, []);
});

// ---------------------------------------------------------------------------
// A real qualifying finding (sanity baseline the other tests are deltas of)
// ---------------------------------------------------------------------------

test('detectPriceFindings: an 8%+ move with real volume and history DOES fire', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }), // +25%
  ];
  const findings = detectPriceFindings(points);
  assert.equal(findings.length, 1);
  const f = findings[0];
  assert.equal(f.supplierId, SUPPLIER);
  assert.equal(f.pwItemId, ITEM);
  assert.equal(f.direction, 'increase');
  assert.equal(f.medianUnitPrice, 20);
  assert.equal(f.latestUnitPrice, 25);
  assert.equal(f.deltaPct, 25);
  assert.ok(f.randImpact >= 1000);
  assert.ok(f.evidenceDocumentIds.length >= 1);
});

// ---------------------------------------------------------------------------
// Open-finding suppression
// ---------------------------------------------------------------------------

test('detectPriceFindings: an open finding for the same series+direction suppresses a re-fire', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }),
  ];
  const openFindings: OpenFinding[] = [
    { supplierId: SUPPLIER, lineSupplier: null, pwItemId: ITEM, direction: 'increase' },
  ];
  assert.deepEqual(detectPriceFindings(points, openFindings), []);
});

test('detectPriceFindings: an open finding for a DIFFERENT item does not suppress this series', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }),
  ];
  const openFindings: OpenFinding[] = [
    { supplierId: SUPPLIER, lineSupplier: null, pwItemId: 'item-onions', direction: 'increase' },
  ];
  assert.equal(detectPriceFindings(points, openFindings).length, 1);
});

test('detectPriceFindings: an open finding for a DIFFERENT direction does not suppress this series', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }),
  ];
  const openFindings: OpenFinding[] = [
    { supplierId: SUPPLIER, lineSupplier: null, pwItemId: ITEM, direction: 'decrease' },
  ];
  assert.equal(detectPriceFindings(points, openFindings).length, 1);
});

// ---------------------------------------------------------------------------
// line_supplier is part of the series key (market-statement agent granularity)
// ---------------------------------------------------------------------------

test('detectPriceFindings: two market agents for the same supplier+item are independent series', () => {
  const agentA: PwPricePoint[] = [
    point({ lineSupplier: 'Botha Roodt & Kie', invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 500 }),
    point({ lineSupplier: 'Botha Roodt & Kie', invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500 }),
    point({ lineSupplier: 'Botha Roodt & Kie', invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }), // +25%, fires
  ];
  const agentB: PwPricePoint[] = [
    point({ lineSupplier: 'C L De Villiers', invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 500 }),
    point({ lineSupplier: 'C L De Villiers', invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500 }),
    point({ lineSupplier: 'C L De Villiers', invoiceDate: LATEST, unitPrice: 20, quantityBase: 500 }), // flat, no finding
  ];
  const findings = detectPriceFindings([...agentA, ...agentB]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].lineSupplier, 'Botha Roodt & Kie');
});

// ---------------------------------------------------------------------------
// Zero/negative price lines are skipped
// ---------------------------------------------------------------------------

test('detectPriceFindings: zero and negative unit-price points are dropped from the series', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 50), unitPrice: 0, quantityBase: 500 }), // dropped
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: -5, quantityBase: 500 }), // dropped
    point({ invoiceDate: daysBefore(LATEST, 30), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: daysBefore(LATEST, 15), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }),
  ];
  const findings = detectPriceFindings(points);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].pointCount, 3); // only the 3 valid points count
});

test('detectPriceFindings: a series with only zero/negative prices never reaches the 3-point floor', () => {
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 40), unitPrice: 0, quantityBase: 500 }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: -1, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }),
  ];
  assert.deepEqual(detectPriceFindings(points), []);
});

// ---------------------------------------------------------------------------
// Median math on the 60-day window boundary
// ---------------------------------------------------------------------------

test('detectPriceFindings: a point exactly 60 days before latest IS included in the median window', () => {
  const boundaryDate = daysBefore(LATEST, 60);
  const points: PwPricePoint[] = [
    // 61 days back: OUTSIDE the window, must not affect the median.
    point({ invoiceDate: daysBefore(LATEST, 61), unitPrice: 999, quantityBase: 500 }),
    // exactly 60 days back: the boundary itself, must be INCLUDED.
    point({ invoiceDate: boundaryDate, unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }), // +25% vs the boundary point
  ];
  const findings = detectPriceFindings(points);
  assert.equal(findings.length, 1);
  // If the 61-day-old 999 had leaked into the window, the median (and thus
  // deltaPct) would be wildly different from 20 / +25%.
  assert.equal(findings[0].medianUnitPrice, 20);
  assert.equal(findings[0].deltaPct, 25);
  assert.equal(findings[0].windowStart, boundaryDate);
});

test('detectPriceFindings: a point 61 days before latest is EXCLUDED from the median window', () => {
  // Same series as above but drop the boundary point, leaving only the
  // 61-day-old point as "history" — it must be excluded, leaving nothing to
  // compare against, so no finding (not a fabricated median of one stale
  // point).
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 61), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: daysBefore(LATEST, 62), unitPrice: 20, quantityBase: 500 }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500 }),
  ];
  assert.deepEqual(detectPriceFindings(points), []);
});

// ---------------------------------------------------------------------------
// Evidence document ids
// ---------------------------------------------------------------------------

test('detectPriceFindings: evidence document ids cover the latest line and the window used', () => {
  const docLatest = 'doc-latest';
  const docMid = 'doc-mid';
  const docOld = 'doc-old-outside-window';
  const points: PwPricePoint[] = [
    point({ invoiceDate: daysBefore(LATEST, 61), unitPrice: 5, quantityBase: 500, documentId: docOld }),
    point({ invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500, documentId: docMid }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500, documentId: docLatest }),
  ];
  const findings = detectPriceFindings(points);
  assert.equal(findings.length, 1);
  assert.ok(findings[0].evidenceDocumentIds.includes(docLatest));
  assert.ok(findings[0].evidenceDocumentIds.includes(docMid));
  assert.ok(!findings[0].evidenceDocumentIds.includes(docOld));
});

// ---------------------------------------------------------------------------
// Trailing 12-week volume honesty (too-short-window = no annualisation)
// ---------------------------------------------------------------------------

test('detectPriceFindings: a volume window collapsed to a single day cannot be annualised, so no finding', () => {
  // All 3 points land on the same day — an 8%+ move with plenty of raw
  // volume, but there is no honest way to say "and this happens every year"
  // from one day's deliveries.
  const points: PwPricePoint[] = [
    point({ invoiceDate: LATEST, unitPrice: 20, quantityBase: 500, documentId: 'a' }),
    point({ invoiceDate: LATEST, unitPrice: 20, quantityBase: 500, documentId: 'b' }),
    point({ invoiceDate: LATEST, unitPrice: 25, quantityBase: 500, documentId: 'c' }),
  ];
  assert.deepEqual(detectPriceFindings(points), []);
});

// ---------------------------------------------------------------------------
// Findings are sorted worst-impact-first
// ---------------------------------------------------------------------------

test('detectPriceFindings: multiple qualifying series are sorted by randImpact, highest first', () => {
  const smallMove: PwPricePoint[] = [
    point({ pwItemId: 'item-small', invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 500 }),
    point({ pwItemId: 'item-small', invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 500 }),
    point({ pwItemId: 'item-small', invoiceDate: LATEST, unitPrice: 22, quantityBase: 500 }), // +10%
  ];
  const bigMove: PwPricePoint[] = [
    point({ pwItemId: 'item-big', invoiceDate: daysBefore(LATEST, 40), unitPrice: 20, quantityBase: 5000 }),
    point({ pwItemId: 'item-big', invoiceDate: daysBefore(LATEST, 20), unitPrice: 20, quantityBase: 5000 }),
    point({ pwItemId: 'item-big', invoiceDate: LATEST, unitPrice: 30, quantityBase: 5000 }), // +50%, huge volume
  ];
  const findings = detectPriceFindings([...smallMove, ...bigMove]);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].pwItemId, 'item-big');
  assert.equal(findings[1].pwItemId, 'item-small');
  assert.ok(findings[0].randImpact > findings[1].randImpact);
});
