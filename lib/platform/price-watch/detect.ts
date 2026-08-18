/**
 * Price Watch — pure finding detection over price-point-shaped inputs. No
 * I/O: the caller (run.ts, out of this file's scope) reads pw_price_points
 * and any open agent_findings rows and hands them in as plain data.
 *
 * Acceptance criterion 5 (.ai/plan_price_watch_agent.md) requires ALL of:
 *   - latest unit price > trailing 60-day median by >= 8%
 *   - estimated annualised impact >= R1,000 (delta x trailing 12-week
 *     volume, annualised — mirroring the honest-window logic of
 *     supplysync-pricing.ts's measuredAnnualUnits, not importing it: that
 *     function's window is "the whole observed series", ours is a fixed
 *     trailing 12 weeks, so the shape doesn't fit a straight import)
 *   - >= 3 historical price points exist for the series
 *   - no OPEN finding already exists for the same (supplier, item,
 *     direction) — the weekly cron would otherwise re-fire the same
 *     finding every run while the median slowly catches up to the new price
 */

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

/** The columns of one pw_price_points row that detection actually needs
 *  (see supabase/agents-price-watch.sql). Prices/quantities are already
 *  normalised to base_unit by normalize.ts before they reach this file —
 *  detection never looks at raw Doc-U fields. */
export interface PwPricePoint {
  supplierId: string;
  /** Normalised per-line market-agent name, or null on a plain invoice.
   *  Part of the series key: different agents on the same market statement
   *  charge different prices for the same produce (plan "Post-pilot
   *  amendments"). */
  lineSupplier: string | null;
  pwItemId: string;
  documentId: string;
  /** unit_price, already normalised to the item's base_unit. */
  unitPrice: number;
  /** quantity, already normalised to the item's base_unit. */
  quantityBase: number;
  /** yyyy-mm-dd. */
  invoiceDate: string;
  /**
   * HOW this point's per-kg price was derived (normalize.ts's
   * NormalizationBasis), plus the pack multiplier when it was a sub-pack line.
   *
   * Optional because points read back from pw_price_points predate the column —
   * absent reads as one single "unknown" basis, so a series entirely of them is
   * still compared (that is the pre-2026-08-14 behaviour, unchanged), while a
   * series that MIXES known and unknown is suppressed.
   */
  basis?: string | null;
  packsPerBox?: number | null;
}

/** Series identity: everything that must match for two points to be the
 *  same price history. Mirrors (supplier_id, line_supplier, pw_item_id) —
 *  the plan's explicit series key. */
export interface PriceSeriesIdentity {
  supplierId: string;
  lineSupplier: string | null;
  pwItemId: string;
}

export type FindingDirection = 'increase';

/** An existing agent_findings row with status in ('new', 'in_progress') —
 *  just enough shape to suppress a re-fire. Typed generically over direction
 *  (rather than the literal 'increase') so a future decrease-detector can
 *  reuse the same suppression check without widening this file's output. */
export interface OpenFinding extends PriceSeriesIdentity {
  direction: string;
}

export interface FindingCandidate extends PriceSeriesIdentity {
  direction: FindingDirection;
  seriesKey: string;
  latestUnitPrice: number;
  medianUnitPrice: number;
  /** (latest - median) / median * 100, one decimal place. */
  deltaPct: number;
  /** Rounded rand: (latest - median) * annualUnits. */
  randImpact: number;
  /** Trailing-12-week volume, annualised — see trailingAnnualUnits below. */
  annualUnits: number;
  /** Document ids backing this finding: the latest line plus every line in
   *  the trailing median window (>= 1, per acceptance criterion 6). */
  evidenceDocumentIds: string[];
  /** yyyy-mm-dd bounds of the trailing median window actually used. */
  windowStart: string;
  windowEnd: string;
  /** Total points in the series (>= MIN_SERIES_POINTS by construction). */
  pointCount: number;
}

// ---------------------------------------------------------------------------
// Thresholds — every one is a business decision, not a technical default.
// ---------------------------------------------------------------------------

/** Trailing window for the comparison median. 60 days is v1's blunt answer
 *  to seasonal produce-price volatility (plan "Edge cases": no seasonality
 *  modelling in v1); shorter would chase noise, longer would blur through a
 *  real move for weeks.
 *
 *  EXPORTED for Finch's price-history tool (lib/ai/finch/price-watch-data.ts),
 *  which quotes "vs your 60-day median" in a sentence the owner reads. Two
 *  copies of the window is how the chat and the Brief end up disagreeing about
 *  the same series by a few percent. Export only — the value is unchanged. */
export const MEDIAN_WINDOW_DAYS = 60;

/** A price move under 8% is within the range normal produce-market
 *  fluctuation already produces week to week — flagging it would train
 *  Josh to ignore the digest. */
const DELTA_PCT_FLOOR = 8;

/** Below R1,000/year, chasing the increase costs more attention than it's
 *  worth for an SME's buying decisions. */
const RAND_IMPACT_FLOOR = 1000;

/** Fewer than 3 observations isn't a price HISTORY, it's one or two data
 *  points — a "median" of one point is just that point, and would let a
 *  single unusual invoice fire a finding against itself. */
const MIN_SERIES_POINTS = 3;

/** "Trailing 12-week volume" per acceptance criterion 5 — fixed at 84 days,
 *  unlike measuredAnnualUnits's whole-series window, because the annualised
 *  impact should reflect CURRENT buying volume, not a stale average dragged
 *  down by however long the series has existed. */
const VOLUME_WINDOW_DAYS = 84;

/** Below this, extrapolating a handful of deliveries to a full year is a
 *  fiction rather than an estimate — a volume window that short can swing
 *  wildly on which single delivery landed inside it.
 *
 *  Raised 7 -> 14 after the 2026-08-14 backfill (architect decision): on DAILY
 *  market statements a 7-day span is a single week of buying, and annualising
 *  it multiplied ordinary week-to-week volume swings by 52 straight into the
 *  rand impact. Deliberately not raised further — v1 needs some findings to
 *  tune against, and the `verdict` column exists to catch the ones that are
 *  wrong. (supplysync-pricing.ts's measuredAnnualUnits keeps its own 7-day
 *  floor: its window is the whole observed series, not a fixed 12 weeks.) */
const MIN_ANNUALISE_SPAN_DAYS = 14;

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seriesKeyOf(p: PriceSeriesIdentity): string {
  return `${p.supplierId}::${p.lineSupplier ?? ''}::${p.pwItemId}`;
}

/**
 * What a point's price is COMPARABLE to. Two points share a comparison basis
 * only when they were derived the same way — and, for sub-pack lines, from the
 * same pack multiplier.
 *
 * A basis-less point (read back from pw_price_points, which has no such column)
 * collapses to one shared 'unknown' value, so a series entirely of them behaves
 * exactly as it did before this gate existed.
 */
function comparisonBasisOf(p: PwPricePoint): string {
  const basis = (p.basis ?? 'unknown') || 'unknown';
  // packsPerBox only changes the meaning of a sub-pack price. On every other
  // basis it is ignored by normalize.ts, so including it would split series for
  // no reason.
  return basis === 'sub_pack' ? `sub_pack:${p.packsPerBox ?? '?'}` : basis;
}

/**
 * True when every point in a series can honestly be compared with every other.
 *
 * THE LOAD-BEARING RULE (2026-08-14 diagnosis). A series that is mis-scaled but
 * CONSISTENTLY mis-scaled still reports the truth about the things findings are
 * made of: the scale factor cancels in (latest - median) / median, and it
 * cancels again in delta x volume. A series that MIXES bases does not — one
 * 12-punnet tray priced per box against the same produce priced loose per kg is
 * a 12x "price move" that never happened. Correcting sub-pack normalisation
 * WITHOUT this gate was measured to produce a fresh R1.8m broccoli artifact, so
 * the gate ships with the correction, not after it.
 *
 * Suppression, not repair: there is no arithmetic that rescues a series whose
 * points mean different things, and guessing one would be the invented number
 * this agent exists not to produce.
 */
export function seriesIsComparable(points: PwPricePoint[]): boolean {
  if (points.length === 0) return false;
  const first = comparisonBasisOf(points[0]);
  return points.every((p) => comparisonBasisOf(p) === first);
}

/** Counters describing what detection did with each series. Optional: pass one
 *  in to report on suppressions (run.ts does), ignore it to just get findings. */
export interface DetectStats {
  seriesTotal: number;
  /** Series dropped because their points aren't mutually comparable. */
  seriesSuppressedMixedBasis: number;
  /** Series that qualified but already have an open finding. */
  seriesSuppressedOpenFinding: number;
  /** Series shorter than the 3-point history floor. */
  seriesBelowPointFloor: number;
}

export function emptyDetectStats(): DetectStats {
  return {
    seriesTotal: 0,
    seriesSuppressedMixedBasis: 0,
    seriesSuppressedOpenFinding: 0,
    seriesBelowPointFloor: 0,
  };
}

/** yyyy-mm-dd -> epoch ms, local midnight. Matches
 *  supplysync-pricing.ts's measuredAnnualUnits date parsing exactly, so the
 *  two modules can't disagree about what "60 days" or "7 days" means. */
function toTime(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

/** The median, with the even-length average. EXPORTED for the same reason as
 *  MEDIAN_WINDOW_DAYS above: Finch quotes this number back to the owner, and a
 *  second implementation that took the lower of the middle pair would put the
 *  chat a percent off the finding it is explaining. */
export function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Trailing 12-week (84-day) volume, annualised, ending at `asOfDate`. Mirrors
 * measuredAnnualUnits's honesty rule (supplysync-pricing.ts) rather than
 * importing it — that function annualises over WHATEVER span the whole
 * series covers; this one is deliberately bounded to a fixed recent window
 * so an old burst of volume early in a long series can't inflate today's
 * estimate. Returns null (never a guessed number) when:
 *   - fewer than 2 points fall in the window (no span to extrapolate from),
 *   - the points in the window sum to zero volume, or
 *   - the actual span between the earliest and latest point in the window
 *     is under MIN_ANNUALISE_SPAN_DAYS (too short to extrapolate honestly —
 *     e.g. two deliveries on the same day tell you nothing about the year).
 *
 * EXPORTED for Finch's margin-exposure tool (P1.2). That tool sizes the same
 * increase the Brief card already priced, and the owner reads both in one
 * sitting: computing the volume a second way would put "about R361k a year" on
 * the card and a different number in the chat, for the same move.
 */
export function trailingAnnualUnits(series: PwPricePoint[], asOfDate: string): number | null {
  const asOfTime = toTime(asOfDate);
  const windowStart = asOfTime - VOLUME_WINDOW_DAYS * DAY_MS;
  const windowPoints = series.filter((p) => {
    const t = toTime(p.invoiceDate);
    return t >= windowStart && t <= asOfTime;
  });
  if (windowPoints.length < 2) return null;

  const totalQty = windowPoints.reduce((sum, p) => sum + p.quantityBase, 0);
  if (totalQty <= 0) return null;

  const times = windowPoints.map((p) => toTime(p.invoiceDate));
  const spanDays = Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / DAY_MS));
  if (spanDays < MIN_ANNUALISE_SPAN_DAYS) return null;

  return Math.round((totalQty * 365) / spanDays);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect price-increase findings across every (supplier, line_supplier,
 * pw_item) series present in `points`. Pure: same inputs -> same outputs,
 * no clock reads (the "latest" point is the max invoiceDate IN the data,
 * not "today" — a backfill run against old data must produce the same
 * findings every time it's re-run).
 *
 * `openFindings` suppresses a series+direction that already has an open
 * (status new/in_progress) finding — acceptance criterion 5's anti-nagging
 * rule. Everything else about a suppressed series is still computed (so a
 * caller could log "would have fired again") but it's dropped from the
 * returned list.
 */
export function detectPriceFindings(
  points: PwPricePoint[],
  openFindings: OpenFinding[] = [],
  stats: DetectStats = emptyDetectStats(),
): FindingCandidate[] {
  const bySeries = new Map<string, PwPricePoint[]>();
  for (const p of points) {
    // Zero/negative unit prices are not a price signal — a credit-note
    // reversal or extraction noise that would otherwise drag a median
    // toward zero and manufacture a finding out of nothing. Skip, don't
    // clamp: clamping to 0 would still poison the median.
    if (!(p.unitPrice > 0)) continue;
    // A negative normalised quantity is impossible (normalize.ts never
    // produces one) — treat it as bad data rather than let it subtract
    // from a volume total.
    if (p.quantityBase < 0) continue;
    const key = seriesKeyOf(p);
    const arr = bySeries.get(key);
    if (arr) arr.push(p);
    else bySeries.set(key, [p]);
  }

  const openSet = new Set(openFindings.map((f) => `${seriesKeyOf(f)}::${f.direction}`));

  const out: FindingCandidate[] = [];
  for (const [key, unsorted] of bySeries) {
    stats.seriesTotal += 1;

    // < 3 points: acceptance criterion 5's history floor. Checked on the
    // WHOLE series, not just what falls inside the 60-day window below —
    // three ancient points still mean "we have never actually seen the
    // price move before", which is exactly the case a median guards against.
    if (unsorted.length < MIN_SERIES_POINTS) {
      stats.seriesBelowPointFloor += 1;
      continue;
    }

    // Mixed normalisation bases -> these prices are not the same kind of
    // number and comparing them invents a move. See seriesIsComparable.
    if (!seriesIsComparable(unsorted)) {
      stats.seriesSuppressedMixedBasis += 1;
      continue;
    }

    const series = [...unsorted].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate));
    // "Latest" = max invoiceDate. On a same-day tie the stable sort keeps
    // input order, so the last-ingested same-day line becomes "latest" and
    // any others from that day fall into the trailing window as history —
    // an arbitrary but deterministic tie-break.
    const latest = series[series.length - 1];
    const priorPoints = series.slice(0, -1);

    // Trailing 60-day median window, INCLUSIVE of the boundary day itself
    // (invoiceDate exactly 60 days before latest still counts as "within
    // 60 days" — an exclusive bound would make the window's true length
    // depend on which side of midnight the cron happened to run).
    const latestTime = toTime(latest.invoiceDate);
    const windowFloor = latestTime - MEDIAN_WINDOW_DAYS * DAY_MS;
    const windowPoints = priorPoints.filter((p) => toTime(p.invoiceDate) >= windowFloor);
    // Nothing in the window to compare against — not "no change detected",
    // genuinely UNKNOWN. A silent pass here would be indistinguishable from
    // "checked, no move", which is a different (false) claim.
    if (windowPoints.length === 0) continue;

    const median = medianOf(windowPoints.map((p) => p.unitPrice));
    if (!(median > 0)) continue; // guard: a zero/negative median can't be divided into safely

    const deltaPct = ((latest.unitPrice - median) / median) * 100;
    if (deltaPct < DELTA_PCT_FLOOR) continue;

    const annualUnits = trailingAnnualUnits(series, latest.invoiceDate);
    // Can't honestly annualise -> can't honestly claim a rand impact ->
    // no finding. This is the "too short a window = no annualisation"
    // honesty rule carried over from measuredAnnualUnits: an unknown impact
    // fails the >= R1,000 test by construction, it never gets treated as 0
    // (0 would silently claim "we checked, it's below the floor").
    if (annualUnits == null) continue;

    const deltaPerUnit = latest.unitPrice - median;
    const randImpact = Math.round(deltaPerUnit * annualUnits);
    if (randImpact < RAND_IMPACT_FLOOR) continue;

    if (openSet.has(`${key}::increase`)) {
      stats.seriesSuppressedOpenFinding += 1;
      continue;
    }

    out.push({
      supplierId: latest.supplierId,
      lineSupplier: latest.lineSupplier,
      pwItemId: latest.pwItemId,
      direction: 'increase',
      seriesKey: key,
      latestUnitPrice: latest.unitPrice,
      medianUnitPrice: median,
      deltaPct: round1(deltaPct),
      randImpact,
      annualUnits,
      evidenceDocumentIds: [...new Set([latest.documentId, ...windowPoints.map((p) => p.documentId)])],
      windowStart: windowPoints[0].invoiceDate,
      windowEnd: latest.invoiceDate,
      pointCount: series.length,
    });
  }

  // Worst impact first — this is the order the digest (out of this file's
  // scope) will show findings in, capped to its own top-5.
  return out.sort((a, b) => b.randImpact - a.randImpact);
}
