/**
 * PricePilot — types + pure helpers for price lists (margins on ProcurePulse
 * base prices), and customer complaints. Sales views read OrderFlow directly.
 */

export type PriceCadence = 'standard' | 'daily' | 'weekly' | 'monthly';
export type ComplaintStatus = 'open' | 'investigating' | 'resolved';

export interface PlPriceList {
  id: string;
  org_id: string;
  name: string;
  customer_id: string | null;
  default_margin_pct: number;
  cadence: PriceCadence;
  /** Customer-pricing validity window (added by pl-validity.sql; null/undefined = always-on). */
  valid_from?: string | null;
  valid_until?: string | null;
  created_at: string;
}

export interface PlOverride {
  id: string;
  org_id: string;
  price_list_id: string;
  stock_item_id: string;
  margin_pct: number;
  created_at: string;
}

export interface PlComplaint {
  id: string;
  org_id: string;
  customer_id: string | null;
  order_id: string | null;
  title: string;
  body: string | null;
  image_url: string | null;
  status: ComplaintStatus;
  created_at: string;
}

export const CADENCES: readonly PriceCadence[] = ['standard', 'daily', 'weekly', 'monthly'];
export const CADENCE_LABEL: Record<PriceCadence, string> = {
  standard: 'Standard',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const COMPLAINT_STATUSES: readonly ComplaintStatus[] = ['open', 'investigating', 'resolved'];
export const COMPLAINT_STATUS_STYLE: Record<ComplaintStatus, { bg: string; fg: string; label: string }> = {
  open: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Open' },
  investigating: { bg: '#FBEEDA', fg: '#854F0B', label: 'Investigating' },
  resolved: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Resolved' },
};

/** Org pricing targets (`pl_targets`) — the MarginWise data PricePilot consumes. */
export interface PlTargets {
  org_id: string;
  target_margin_pct: number | null;
  monthly_revenue_target: number | null;
  monthly_gross_profit_target: number | null;
  monthly_opex: number | null;
  updated_at: string;
}

/** Fallback target margin used for health/opportunity maths when none is set. */
export const DEFAULT_TARGET_MARGIN = 30;

/** Sell price = base × (1 + margin%). */
export function sellPrice(base: number | null | undefined, marginPct: number): number {
  return (Number(base) || 0) * (1 + marginPct / 100);
}

// ---------------------------------------------------------------------------
// Pricing intelligence — catalogue margins, distribution, health, opportunities
// ---------------------------------------------------------------------------

export interface PriceItemLite {
  id: string;
  name: string;
  category: string | null;
  avg_unit_price: number | null;
}

/**
 * Pick the "base" price list a product's catalogue margin is read from: the
 * standard list with no customer (org-wide), else the oldest list. null = none.
 */
export function pickBaseList(lists: PlPriceList[]): PlPriceList | null {
  if (lists.length === 0) return null;
  const sorted = [...lists].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return sorted.find((l) => !l.customer_id && l.cadence === 'standard') ?? sorted.find((l) => !l.customer_id) ?? sorted[0];
}

export interface ProductMargin {
  item: PriceItemLite;
  cost: number | null;
  marginPct: number;
  sell: number;
}

/** Each product's current catalogue margin = its override on the base list, else the list default. */
export function productMargins(
  items: PriceItemLite[],
  base: PlPriceList | null,
  overrides: PlOverride[],
): ProductMargin[] {
  if (!base) return [];
  const ovByItem = new Map<string, number>();
  for (const o of overrides) if (o.price_list_id === base.id) ovByItem.set(o.stock_item_id, Number(o.margin_pct));
  return items.map((item) => {
    const cost = item.avg_unit_price != null ? Number(item.avg_unit_price) : null;
    const marginPct = ovByItem.has(item.id) ? ovByItem.get(item.id)! : Number(base.default_margin_pct);
    return { item, cost, marginPct, sell: sellPrice(cost, marginPct) };
  });
}

export const MARGIN_BANDS = [
  { label: '<10%', min: -Infinity, max: 10, color: '#A32D2D' },
  { label: '10–20%', min: 10, max: 20, color: '#BA7517' },
  { label: '20–30%', min: 20, max: 30, color: '#EF9F27' },
  { label: '30–40%', min: 30, max: 40, color: '#1D9E75' },
  { label: '40%+', min: 40, max: Infinity, color: '#0F6E56' },
] as const;

export interface MarginBand {
  label: string;
  color: string;
  count: number;
  pct: number;
}

/** Distribution of products across margin bands. */
export function marginDistribution(pms: ProductMargin[]): MarginBand[] {
  const total = pms.length || 1;
  return MARGIN_BANDS.map((b) => {
    const count = pms.filter((p) => p.marginPct >= b.min && p.marginPct < b.max).length;
    return { label: b.label, color: b.color, count, pct: Math.round((count / total) * 100) };
  });
}

/** Catalogue-average margin across all priced products. */
export function avgCatalogueMargin(pms: ProductMargin[]): number {
  if (pms.length === 0) return 0;
  return pms.reduce((s, p) => s + p.marginPct, 0) / pms.length;
}

export interface HealthInputs {
  hasBaseList: boolean;
  productCount: number;
  avgMargin: number;
  belowTargetCount: number;
  target: number;
  hasSalesThisMonth: boolean;
}

/**
 * Pricing Health (0–100): is pricing set up (30), is the average margin near
 * target (30), are most products at/above target (25), is pricing actually in
 * use this month (15).
 */
export function pricingHealth(h: HealthInputs): number {
  if (!h.hasBaseList || h.productCount === 0) return h.hasBaseList ? 30 : 0;
  const setup = 30;
  const vsTarget = Math.min(1, h.target > 0 ? h.avgMargin / h.target : 1) * 30;
  const aboveShare = 1 - Math.min(1, h.belowTargetCount / h.productCount);
  const coverage = aboveShare * 25;
  const inUse = h.hasSalesThisMonth ? 15 : 0;
  return Math.max(0, Math.min(100, Math.round(setup + vsTarget + coverage + inUse)));
}

export function healthBand(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Healthy', color: '#0F6E56' };
  if (score >= 55) return { label: 'Needs attention', color: '#854F0B' };
  return { label: 'At risk', color: '#A32D2D' };
}

export interface Opportunity {
  item: PriceItemLite;
  currentMargin: number;
  suggestedMargin: number;
  currentSell: number;
  suggestedSell: number;
  monthlyUnits: number;
  /** Estimated extra monthly gross profit from moving to the suggested margin. */
  monthlyImpact: number;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Margin opportunities: products below the target margin that actually sell.
 * Impact = (target − current) margin × cost × monthly units. Sorted by impact.
 */
export function computeOpportunities(
  pms: ProductMargin[],
  target: number,
  monthlyUnitsByItem: Map<string, number>,
): Opportunity[] {
  const ops: Opportunity[] = [];
  for (const p of pms) {
    if (p.cost == null || p.marginPct >= target) continue;
    const units = monthlyUnitsByItem.get(p.item.id) ?? 0;
    const suggestedSell = sellPrice(p.cost, target);
    const monthlyImpact = (suggestedSell - p.sell) * units;
    ops.push({
      item: p.item,
      currentMargin: p.marginPct,
      suggestedMargin: target,
      currentSell: p.sell,
      suggestedSell,
      monthlyUnits: units,
      monthlyImpact,
      priority: monthlyImpact >= 1000 ? 'high' : monthlyImpact >= 200 ? 'medium' : 'low',
    });
  }
  return ops.sort((a, b) => b.monthlyImpact - a.monthlyImpact);
}

export const PRIORITY_STYLE: Record<Opportunity['priority'], { bg: string; fg: string; label: string }> = {
  high: { bg: '#FCEBEB', fg: '#A32D2D', label: 'High' },
  medium: { bg: '#FBEEDA', fg: '#854F0B', label: 'Medium' },
  low: { bg: '#EEF1F5', fg: '#6B6F68', label: 'Low' },
};

export type Confidence = 'high' | 'medium' | 'low';

export const CONFIDENCE_STYLE: Record<Confidence, { bg: string; fg: string; label: string }> = {
  high: { bg: '#E1F5EE', fg: '#0F6E56', label: 'High confidence' },
  medium: { bg: '#FBEEDA', fg: '#854F0B', label: 'Medium confidence' },
  low: { bg: '#EEF1F5', fg: '#6B6F68', label: 'Low confidence' },
};

/** Deterministic confidence + plain-language reasoning for a suggested price change. */
export function recommendationMeta(o: Opportunity): { confidence: Confidence; reason: string } {
  const gap = o.suggestedMargin - o.currentMargin;
  const confidence: Confidence = o.monthlyUnits >= 10 && gap >= 5 ? 'high' : o.monthlyUnits > 0 ? 'medium' : 'low';
  const sold =
    o.monthlyUnits > 0
      ? `Sold ${Math.round(o.monthlyUnits)} ${o.monthlyUnits === 1 ? 'unit' : 'units'} in the last 30 days. `
      : 'No sales in the last 30 days. ';
  // Reason states the situation only — the live (possibly edited) rand impact is
  // shown separately in the row, so we don't bake a figure in here that could disagree.
  const close = o.monthlyUnits > 0 ? 'Raising it to target lifts gross profit on every sale.' : 'Worth repricing before it sells again.';
  return {
    confidence,
    reason: `Currently ${Math.round(o.currentMargin)}% margin vs your ${Math.round(o.suggestedMargin)}% target. ${sold}${close}`,
  };
}

// ---------------------------------------------------------------------------
// Realized margin (from sales) + the deterministic AI insight line
// ---------------------------------------------------------------------------

export interface SaleLine {
  /** Line revenue = qty × unit price. */
  revenue: number;
  /** Line cost = qty × unit cost; null when the cost is unknown (excluded from margin). */
  cost: number | null;
}

/** Realized gross margin % over the costable lines (null if nothing costable). */
export function marginPctForLines(lines: SaleLine[]): number | null {
  let rev = 0;
  let cost = 0;
  let any = false;
  for (const l of lines) {
    if (l.cost == null) continue;
    rev += l.revenue;
    cost += l.cost;
    any = true;
  }
  if (!any || rev <= 0) return null;
  return ((rev - cost) / rev) * 100;
}

export interface InsightInputs {
  hasBaseList: boolean;
  productCount: number;
  belowTargetCount: number;
  target: number;
  monthlyOpportunity: number;
  avgMargin: number;
  revenueThisMonth: number;
  revenueTarget: number | null;
}

/**
 * One deterministic, data-grounded sentence for the AI Insight card. Picks the
 * most actionable thing it can see; Haiku narration can replace this later.
 */
export function pricingInsight(i: InsightInputs): string {
  if (!i.hasBaseList || i.productCount === 0) {
    return 'Create a price list and set a target margin to start tracking profitability and surfacing pricing opportunities.';
  }
  if (i.belowTargetCount > 0 && i.monthlyOpportunity >= 1) {
    return `${i.belowTargetCount} product${i.belowTargetCount === 1 ? ' is' : 's are'} priced below your ${Math.round(
      i.target,
    )}% target margin. Moving them to target could add about ${zar(i.monthlyOpportunity)} in gross profit each month.`;
  }
  if (i.belowTargetCount > 0) {
    return `${i.belowTargetCount} product${i.belowTargetCount === 1 ? ' is' : 's are'} below your ${Math.round(
      i.target,
    )}% target margin, but none have recent sales — worth repricing before they sell again.`;
  }
  if (i.revenueTarget && i.revenueThisMonth < i.revenueTarget) {
    const pct = Math.round((i.revenueThisMonth / i.revenueTarget) * 100);
    return `Margins look healthy — every product is at or above your ${Math.round(
      i.target,
    )}% target. You're at ${pct}% of this month's revenue goal.`;
  }
  return `Pricing looks healthy — your catalogue averages ${Math.round(
    i.avgMargin,
  )}% margin, at or above your ${Math.round(i.target)}% target across the board.`;
}

// ---------------------------------------------------------------------------
// Version history — published snapshots of a price list (pl_price_list_versions)
// ---------------------------------------------------------------------------

export interface VersionOverride {
  stock_item_id: string;
  margin_pct: number;
}

export interface PlVersion {
  id: string;
  org_id: string;
  price_list_id: string;
  version_no: number;
  default_margin_pct: number;
  overrides: VersionOverride[];
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MarginSnapshot {
  defaultMargin: number;
  overrides: VersionOverride[];
}

export interface OverrideDiff {
  stock_item_id: string;
  kind: 'added' | 'removed' | 'changed';
  from: number | null; // effective margin before
  to: number | null; // effective margin after
}

/** Effective margin of a product under a snapshot (override if set, else the default). */
function effMargin(snap: MarginSnapshot, byItem: Map<string, number>, id: string): number {
  return byItem.has(id) ? byItem.get(id)! : snap.defaultMargin;
}

/** Diff two margin snapshots: default-margin change + per-product override changes. */
export function diffSnapshots(a: MarginSnapshot, b: MarginSnapshot): { defaultChanged: boolean; overrides: OverrideDiff[] } {
  const aMap = new Map(a.overrides.map((o) => [o.stock_item_id, Number(o.margin_pct)]));
  const bMap = new Map(b.overrides.map((o) => [o.stock_item_id, Number(o.margin_pct)]));
  const ids = new Set<string>([...aMap.keys(), ...bMap.keys()]);
  const overrides: OverrideDiff[] = [];
  for (const id of ids) {
    const inA = aMap.has(id);
    const inB = bMap.has(id);
    const from = effMargin(a, aMap, id);
    const to = effMargin(b, bMap, id);
    if (inA && inB) {
      if (aMap.get(id) !== bMap.get(id)) overrides.push({ stock_item_id: id, kind: 'changed', from, to });
    } else if (!inA && inB) {
      overrides.push({ stock_item_id: id, kind: 'added', from, to });
    } else if (inA && !inB) {
      overrides.push({ stock_item_id: id, kind: 'removed', from, to });
    }
  }
  return { defaultChanged: Number(a.defaultMargin) !== Number(b.defaultMargin), overrides };
}

/** Whether two snapshots are identical (used to detect unpublished changes). */
export function snapshotsEqual(a: MarginSnapshot, b: MarginSnapshot): boolean {
  const d = diffSnapshots(a, b);
  return !d.defaultChanged && d.overrides.length === 0;
}

// ---------------------------------------------------------------------------
// Analytics — realized-sales aggregation by customer / category / product
// ---------------------------------------------------------------------------

/** Running accumulator while grouping sale lines by some dimension. */
export interface SalesAgg {
  key: string;
  label: string;
  revenue: number; // full revenue (all lines)
  costableRev: number; // revenue of lines with a known cost
  cost: number; // cost of those lines
  units: number;
}

export interface AnalyticsRow {
  key: string;
  label: string;
  revenue: number;
  profit: number;
  margin: number | null;
  units: number;
  /** Share of the window's total gross profit (0–100). */
  contributionPct: number;
}

export interface AnalyticsTotals {
  revenue: number;
  profit: number;
  margin: number | null;
}

/** Finalize a set of aggregates into sorted rows + totals (margin on costed revenue). */
export function finalizeAggs(aggs: SalesAgg[]): { rows: AnalyticsRow[]; totals: AnalyticsTotals } {
  const totalCostableRev = aggs.reduce((s, a) => s + a.costableRev, 0);
  const totalCost = aggs.reduce((s, a) => s + a.cost, 0);
  const totalProfit = totalCostableRev - totalCost;
  const totalRevenue = aggs.reduce((s, a) => s + a.revenue, 0);
  // Contribution share uses the sum of positive profits as denominator, so shares
  // stay in 0–100 and sum to 100% even when some rows are loss-making.
  const totalPositiveProfit = aggs.reduce((s, a) => s + Math.max(0, a.costableRev - a.cost), 0);
  const rows = aggs
    .map((a) => {
      const profit = a.costableRev - a.cost;
      return {
        key: a.key,
        label: a.label,
        revenue: a.revenue,
        profit,
        units: a.units,
        margin: a.costableRev > 0 ? (profit / a.costableRev) * 100 : null,
        contributionPct: profit > 0 && totalPositiveProfit > 0 ? (profit / totalPositiveProfit) * 100 : 0,
      };
    })
    .sort((x, y) => y.profit - x.profit);
  return {
    rows,
    totals: { revenue: totalRevenue, profit: totalProfit, margin: totalCostableRev > 0 ? (totalProfit / totalCostableRev) * 100 : null },
  };
}

// ---------------------------------------------------------------------------
// Customer pricing — price-list validity window + expiry status
// ---------------------------------------------------------------------------

export type ValidityStatus = 'active' | 'scheduled' | 'expiring' | 'expired' | 'none';

export interface Validity {
  status: ValidityStatus;
  /** Days until expiry (negative if already expired); null when there's no end date. */
  daysUntilExpiry: number | null;
  label: string;
}

export const VALIDITY_STYLE: Record<ValidityStatus, { bg: string; fg: string; label: string }> = {
  active: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Active' },
  scheduled: { bg: '#E6F1FB', fg: '#0C447C', label: 'Scheduled' },
  expiring: { bg: '#FBEEDA', fg: '#854F0B', label: 'Expiring soon' },
  expired: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Expired' },
  none: { bg: '#EEF1F5', fg: '#6B6F68', label: 'No expiry' },
};

/** Days within which an upcoming expiry counts as "expiring soon". */
export const EXPIRY_SOON_DAYS = 14;

function fmtDay(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Validity + expiry status for a price list, evaluated against `today` (day granularity). */
export function priceListValidity(
  list: { valid_from?: string | null; valid_until?: string | null },
  today: Date = new Date(),
): Validity {
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  const from = list.valid_from ? parse(list.valid_from) : null;
  const until = list.valid_until ? parse(list.valid_until) : null;

  if (from != null && from > todayMid) {
    return { status: 'scheduled', daysUntilExpiry: null, label: `Starts ${fmtDay(list.valid_from!)}` };
  }
  if (until == null) return { status: 'none', daysUntilExpiry: null, label: 'No expiry' };

  const days = Math.round((until - todayMid) / 86_400_000);
  if (days < 0) return { status: 'expired', daysUntilExpiry: days, label: `Expired ${fmtDay(list.valid_until!)}` };
  if (days <= EXPIRY_SOON_DAYS) {
    return {
      status: 'expiring',
      daysUntilExpiry: days,
      label: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`,
    };
  }
  return { status: 'active', daysUntilExpiry: days, label: `Valid until ${fmtDay(list.valid_until!)}` };
}

// ---------------------------------------------------------------------------
// Smart notifications — deterministic alerts across the pricing surface
// ---------------------------------------------------------------------------

export type NotificationKind = 'contract_expired' | 'contract_expiring' | 'below_target' | 'cost_spike' | 'reprice';
export type NotificationSeverity = 'high' | 'medium' | 'low';

export interface PpNotification {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  body: string;
  href: string;
}

export const NOTIF_SEVERITY_STYLE: Record<NotificationSeverity, { dot: string; bg: string; fg: string; label: string }> = {
  high: { dot: '#A32D2D', bg: '#FCEBEB', fg: '#A32D2D', label: 'Action needed' },
  medium: { dot: '#854F0B', bg: '#FBEEDA', fg: '#854F0B', label: 'Review' },
  low: { dot: '#6B6F68', bg: '#EEF1F5', fg: '#6B6F68', label: 'Note' },
};

// ---------------------------------------------------------------------------
// Cost-spike detection — reads the pp_stock_items cost series (price_history,
// most-recent last) plus the live avg_unit_price, and flags two distinct shapes:
//
//   step  — a sudden jump against the previous observation (a supplier increase)
//   creep — a smaller-per-step but sustained climb across the whole series
//           (the "price creep" pain: no single alarming jump, a squeezed margin)
//
// Both are honest derivations from recorded costs; nothing is invented.
// ---------------------------------------------------------------------------

export type CostSpikeKind = 'step' | 'creep';

/** A product's observed cost movement, big enough to matter. */
export interface CostSpike {
  id: string;
  name: string;
  kind: CostSpikeKind;
  /** Baseline unit cost the movement is measured from. */
  from: number;
  /** Latest known unit cost. */
  to: number;
  /** % increase from → to (always positive; only rises are reported). */
  pctUp: number;
  /** Observations in the series the call was made on. */
  points: number;
  /** Units sold in the caller's window (0 when unknown). */
  monthlyUnits: number;
  /** Extra cost a month at the current run rate — 0 when units are unknown. */
  monthlyCostImpact: number;
}

/** The shape `detectCostSpikes` reads (a `pp_stock_items` row subset). */
export interface CostHistoryItem {
  id: string;
  name: string;
  avg_unit_price?: number | null;
  price_history?: number[] | null;
}

/** A sudden jump vs the previous observation at/above this % is a `step` spike. */
export const COST_SPIKE_STEP_PCT = 10;
/** A sustained rise across the whole series at/above this % is a `creep` spike. */
export const COST_CREEP_PCT = 8;

/**
 * Detect cost spikes across the catalogue. `unitsByItem` (units sold in the
 * caller's window) is optional and only used to price the impact.
 */
export function detectCostSpikes(
  items: CostHistoryItem[],
  opts: { stepPct?: number; creepPct?: number; limit?: number; unitsByItem?: Map<string, number> } = {},
): CostSpike[] {
  const stepPct = opts.stepPct ?? COST_SPIKE_STEP_PCT;
  const creepPct = opts.creepPct ?? COST_CREEP_PCT;
  const out: CostSpike[] = [];

  for (const it of items) {
    const history = (it.price_history ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
    const live = Number(it.avg_unit_price);
    // The live average cost supersedes the last sparkline point when it differs
    // (the seeded/synced series ends at the live cost, so this is usually a no-op).
    const series =
      Number.isFinite(live) && live > 0
        ? history.length === 0
          ? [live]
          : Math.abs(history[history.length - 1] - live) < 1e-9
            ? history
            : [...history, live]
        : history;
    if (series.length < 2) continue;

    const to = series[series.length - 1];
    const prev = series[series.length - 2];
    const first = series[0];

    const stepUp = prev > 0 ? ((to - prev) / prev) * 100 : 0;
    const creepUp = first > 0 ? ((to - first) / first) * 100 : 0;

    let kind: CostSpikeKind | null = null;
    let from = 0;
    let pctUp = 0;
    if (stepUp >= stepPct) {
      kind = 'step';
      from = prev;
      pctUp = stepUp;
    } else if (creepUp >= creepPct) {
      kind = 'creep';
      from = first;
      pctUp = creepUp;
    }
    if (!kind) continue;

    const monthlyUnits = opts.unitsByItem?.get(it.id) ?? 0;
    out.push({
      id: it.id,
      name: it.name,
      kind,
      from,
      to,
      pctUp,
      points: series.length,
      monthlyUnits,
      monthlyCostImpact: monthlyUnits * (to - from),
    });
  }

  // Biggest money first where we know it, then biggest % — a 3% rise on a
  // high-volume line matters more than 20% on something nobody buys.
  out.sort((a, b) => b.monthlyCostImpact - a.monthlyCostImpact || b.pctUp - a.pctUp);
  return opts.limit != null ? out.slice(0, opts.limit) : out;
}

// ---------------------------------------------------------------------------
// Re-price alerts — a product that has crossed BELOW the target margin and is
// still selling. Same maths as an Opportunity, framed as "what should this cost
// the customer now" (current price → target-margin price → per-unit delta).
// ---------------------------------------------------------------------------

export interface RepriceAlert {
  id: string;
  name: string;
  currentMargin: number;
  targetMargin: number;
  currentSell: number;
  targetSell: number;
  /** Per-unit price increase needed to land on target. */
  deltaSell: number;
  monthlyUnits: number;
  monthlyImpact: number;
  severity: NotificationSeverity;
}

/**
 * Products that crossed the target margin AND still sell — the ones worth an
 * alert rather than a line on a report. `unitsByItem` is the caller's window
 * (30d everywhere in PricePilot today).
 */
export function computeRepriceAlerts(
  pms: ProductMargin[],
  target: number,
  unitsByItem: Map<string, number>,
  opts: { limit?: number } = {},
): RepriceAlert[] {
  const out: RepriceAlert[] = [];
  for (const p of pms) {
    if (p.cost == null || p.marginPct >= target) continue;
    const units = unitsByItem.get(p.item.id) ?? 0;
    if (units <= 0) continue; // no sales → it's an opportunity, not an alert
    const targetSell = sellPrice(p.cost, target);
    const deltaSell = targetSell - p.sell;
    const monthlyImpact = deltaSell * units;
    const gap = target - p.marginPct;
    out.push({
      id: p.item.id,
      name: p.item.name,
      currentMargin: p.marginPct,
      targetMargin: target,
      currentSell: p.sell,
      targetSell,
      deltaSell,
      monthlyUnits: units,
      monthlyImpact,
      severity: gap >= 10 || monthlyImpact >= 1000 ? 'high' : 'medium',
    });
  }
  out.sort((a, b) => b.monthlyImpact - a.monthlyImpact);
  return opts.limit != null ? out.slice(0, opts.limit) : out;
}

export interface NotificationInput {
  expiringContracts: { customer: string; listName: string; listId: string; label: string; expired: boolean }[];
  belowTargetCount: number;
  marginOpportunity: number;
  target: number;
  costSpikes: { id: string; name: string; pctUp: number; kind?: CostSpikeKind; from?: number; to?: number; monthlyCostImpact?: number }[];
  /** Dishes that crossed below target and still sell (see computeRepriceAlerts). */
  repriceAlerts?: RepriceAlert[];
}

/** Build the pricing notification feed from already-computed signals. Sorted by severity. */
export function computeNotifications(i: NotificationInput): PpNotification[] {
  const out: PpNotification[] = [];
  for (const c of i.expiringContracts) {
    if (c.expired) {
      out.push({
        id: `exp-${c.listId}`,
        kind: 'contract_expired',
        severity: 'high',
        title: `${c.customer}'s contract pricing has expired`,
        body: `${c.listName} — ${c.label}. Renew the validity dates to keep it active.`,
        href: '/app/pricepilot/customers',
      });
    } else {
      out.push({
        id: `expsoon-${c.listId}`,
        kind: 'contract_expiring',
        severity: 'medium',
        title: `${c.customer}'s contract pricing expires soon`,
        body: `${c.listName} — ${c.label}.`,
        href: '/app/pricepilot/customers',
      });
    }
  }
  if (i.belowTargetCount > 0) {
    out.push({
      id: 'below-target',
      kind: 'below_target',
      severity: 'medium',
      title: `${i.belowTargetCount} product${i.belowTargetCount === 1 ? ' is' : 's are'} below your ${Math.round(i.target)}% target margin`,
      body:
        i.marginOpportunity >= 1
          ? `Raising them to target could add about ${zar(i.marginOpportunity)} in gross profit a month.`
          : 'Review and reprice them.',
      href: '/app/pricepilot/recommendations',
    });
  }
  for (const r of i.repriceAlerts ?? []) {
    out.push({
      id: `reprice-${r.id}`,
      kind: 'reprice',
      severity: r.severity,
      title: `Re-price ${r.name} — ${Math.round(r.currentMargin)}% vs your ${Math.round(r.targetMargin)}% target`,
      body:
        `Selling at ${zar2(r.currentSell)}; ${zar2(r.targetSell)} would hit target ` +
        `(+${zar2(r.deltaSell)} a unit). ${Math.round(r.monthlyUnits)} sold in the last 30 days` +
        (r.monthlyImpact >= 1 ? ` — about ${zar(r.monthlyImpact)} a month.` : '.'),
      href: `/app/pricepilot/products/${r.id}`,
    });
  }
  for (const s of i.costSpikes) {
    const movement = s.from != null && s.to != null ? `${zar2(s.from)} → ${zar2(s.to)}. ` : '';
    const impact = s.monthlyCostImpact != null && s.monthlyCostImpact >= 1 ? `That's about ${zar(s.monthlyCostImpact)} more a month at current volumes. ` : '';
    out.push({
      id: `spike-${s.id}`,
      kind: 'cost_spike',
      severity: s.pctUp >= 30 ? 'high' : 'medium',
      title:
        s.kind === 'creep'
          ? `Cost creeping up ${Math.round(s.pctUp)}% on ${s.name}`
          : `Cost up ${Math.round(s.pctUp)}% on ${s.name}`,
      body: `${movement}${impact}Your margin on this product has been squeezed — review its selling price.`,
      href: `/app/pricepilot/products/${s.id}`,
    });
  }
  const rank: Record<NotificationSeverity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Rand, plain — e.g. "R 88 000". en-US grouping (comma) → spaces. */
export function zar(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')}`;
}

/** Rand with cents (price lists need precision), e.g. "R 1 234.56". en-US (dot
 *  decimal, comma grouping) → spaces, so the decimal separator survives. */
export function zar2(n: number | null | undefined): string {
  if (n == null) return '—';
  return `R ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ')}`;
}

// ---------------------------------------------------------------------------
// Variance attribution — "I know food cost is high, I don't know WHY"
//
// Decomposes the change in realized gross margin between a baseline window and
// the current window into three effects that sum EXACTLY to the drift:
//
//   mix   — you sold a different blend of products (each at its OLD economics)
//   cost  — what you pay per unit moved (selling prices held at baseline)
//   price — what you charge per unit moved
//
// Formally, over the current window's quantities q₁ with baseline unit price p₀
// / unit cost c₀ and current p₁ / c₁ (new products fall back to p₀=p₁, c₀=c₁ so
// they only ever land in `mix`):
//
//   m_mix  = Σq₁(p₀−c₀) / Σq₁p₀      mix   = m_mix  − m₀
//   m_cost = Σq₁(p₀−c₁) / Σq₁p₀      cost  = m_cost − m_mix
//   m₁     = Σq₁(p₁−c₁) / Σq₁p₁      price = m₁     − m_cost
//                                    ────────────────────────
//                                    total = m₁ − m₀   (exact)
//
// Waste sits OUTSIDE that identity on purpose: WasteWatch cost is not in the
// invoice-line COGS above, so it is reported as its own drag on margin
// (waste ÷ revenue, in points) rather than folded into the decomposition.
// ---------------------------------------------------------------------------

/** One product's costed-sales aggregate within a window. */
export interface VarianceItem {
  key: string;
  label: string;
  units: number;
  /** Revenue of the costed lines only (so margins are comparable window to window). */
  revenue: number;
  cost: number;
}

export type VarianceComponentKey = 'mix' | 'cost' | 'price';

export interface VarianceComponent {
  key: VarianceComponentKey;
  label: string;
  /** Margin points contributed (signed: negative = margin lost). */
  pts: number;
  note: string;
}

export interface VarianceContributor {
  key: string;
  label: string;
  /** Margin points this product's unit-cost move contributed (negative = lost). */
  pts: number;
  /** Rand of extra cost in the current window from the unit-cost move. */
  costDelta: number;
  fromUnitCost: number;
  toUnitCost: number;
  units: number;
}

export interface VarianceWaste {
  baseCost: number;
  currentCost: number;
  /** Waste as a % of costed revenue in each window. */
  basePts: number | null;
  currentPts: number | null;
  /** currentPts − basePts (positive = waste is eating more margin than before). */
  driftPts: number | null;
}

export interface VarianceAttribution {
  hasData: boolean;
  baseMarginPct: number | null;
  currentMarginPct: number | null;
  /** currentMarginPct − baseMarginPct, in margin points. */
  driftPts: number;
  components: VarianceComponent[];
  waste: VarianceWaste;
  /** Current margin once WasteWatch cost is charged against revenue. */
  marginAfterWastePct: number | null;
  /** Products whose unit cost moved most, worst first. */
  topCostDrivers: VarianceContributor[];
  /** Share of current costed revenue from products that also sold in the baseline. */
  coveragePct: number;
  baseRevenue: number;
  currentRevenue: number;
  baseUnits: number;
  currentUnits: number;
}

const EMPTY_VARIANCE: VarianceAttribution = {
  hasData: false,
  baseMarginPct: null,
  currentMarginPct: null,
  driftPts: 0,
  components: [],
  waste: { baseCost: 0, currentCost: 0, basePts: null, currentPts: null, driftPts: null },
  marginAfterWastePct: null,
  topCostDrivers: [],
  coveragePct: 0,
  baseRevenue: 0,
  currentRevenue: 0,
  baseUnits: 0,
  currentUnits: 0,
};

/** Decompose margin drift between two windows. Returns `hasData: false` when either window is empty. */
export function attributeVariance(
  base: VarianceItem[],
  current: VarianceItem[],
  waste: { baseCost: number; currentCost: number } = { baseCost: 0, currentCost: 0 },
  opts: { driverLimit?: number } = {},
): VarianceAttribution {
  const baseByKey = new Map(base.map((b) => [b.key, b]));

  const R0 = base.reduce((s, b) => s + b.revenue, 0);
  const C0 = base.reduce((s, b) => s + b.cost, 0);
  const baseUnits = base.reduce((s, b) => s + b.units, 0);
  const m0 = R0 > 0 ? ((R0 - C0) / R0) * 100 : null;

  let revAtBase = 0; // Σ q₁p₀
  let costAtBase = 0; // Σ q₁c₀
  let costAtCurrent = 0; // Σ q₁c₁
  let revAtCurrent = 0; // Σ q₁p₁
  let coveredRev = 0;
  let currentUnits = 0;
  const drivers: Omit<VarianceContributor, 'pts'>[] = [];

  for (const c of current) {
    if (!(c.units > 0) || !(c.revenue > 0)) continue;
    currentUnits += c.units;
    const p1 = c.revenue / c.units;
    const c1 = c.cost / c.units;
    const b = baseByKey.get(c.key);
    const covered = !!b && b.units > 0 && b.revenue > 0;
    const p0 = covered ? b!.revenue / b!.units : p1;
    const c0 = covered ? b!.cost / b!.units : c1;

    revAtBase += c.units * p0;
    costAtBase += c.units * c0;
    costAtCurrent += c.units * c1;
    revAtCurrent += c.units * p1;
    if (covered) coveredRev += c.revenue;

    if (covered && Math.abs(c1 - c0) > 1e-9) {
      drivers.push({ key: c.key, label: c.label, costDelta: c.units * (c1 - c0), fromUnitCost: c0, toUnitCost: c1, units: c.units });
    }
  }

  if (m0 == null || revAtBase <= 0 || revAtCurrent <= 0) {
    return { ...EMPTY_VARIANCE, baseMarginPct: m0, baseRevenue: R0, baseUnits, currentRevenue: revAtCurrent, currentUnits };
  }

  const mMix = ((revAtBase - costAtBase) / revAtBase) * 100;
  const mCost = ((revAtBase - costAtCurrent) / revAtBase) * 100;
  const m1 = ((revAtCurrent - costAtCurrent) / revAtCurrent) * 100;

  const mixPts = mMix - m0;
  const costPts = mCost - mMix;
  const pricePts = m1 - mCost;

  const components: VarianceComponent[] = [
    {
      key: 'cost',
      label: 'Cost inflation',
      pts: costPts,
      note: 'What you pay per unit, on the same products at the same selling prices.',
    },
    {
      key: 'price',
      label: 'Selling price',
      pts: pricePts,
      note: 'What you charged per unit versus the baseline window.',
    },
    {
      key: 'mix',
      label: 'Sales mix',
      pts: mixPts,
      note: 'A different blend of products sold, each valued at its baseline economics.',
    },
  ];

  const topCostDrivers: VarianceContributor[] = drivers
    .map((d) => ({ ...d, pts: -(d.costDelta / revAtBase) * 100 }))
    .filter((d) => d.costDelta > 0)
    .sort((a, b) => b.costDelta - a.costDelta)
    .slice(0, opts.driverLimit ?? 5);

  const basePts = R0 > 0 ? (waste.baseCost / R0) * 100 : null;
  const currentPts = revAtCurrent > 0 ? (waste.currentCost / revAtCurrent) * 100 : null;

  return {
    hasData: true,
    baseMarginPct: m0,
    currentMarginPct: m1,
    driftPts: m1 - m0,
    components,
    waste: {
      baseCost: waste.baseCost,
      currentCost: waste.currentCost,
      basePts,
      currentPts,
      driftPts: basePts != null && currentPts != null ? currentPts - basePts : null,
    },
    marginAfterWastePct: currentPts != null ? m1 - currentPts : m1,
    topCostDrivers,
    coveragePct: revAtCurrent > 0 ? (coveredRev / revAtCurrent) * 100 : 0,
    baseRevenue: R0,
    currentRevenue: revAtCurrent,
    baseUnits,
    currentUnits,
  };
}

/** Signed margin-point figure, e.g. "+1.4 pts" / "−0.8 pts". */
export function pts(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const v = Number(n.toFixed(digits));
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v).toFixed(digits)} pts`;
}
