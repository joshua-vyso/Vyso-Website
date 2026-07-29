/**
 * PlanWise actuals — the pure derivation layer that turns live module data
 * (OrderFlow sales, PricePilot unit costs, WasteWatch events, receivables) into
 * the month-to-date numbers PlanWise plans against.
 *
 * The point of this file is *same-day* variance. A budget line is a whole-month
 * number, so comparing it to a part-month actual always reads "under budget"
 * until the 31st. Everything here is therefore PACED: the budget is pro-rated to
 * the elapsed fraction of the month, so "over/under" means over/under *for
 * today*, and a full-month projection is carried alongside it.
 *
 * Pure functions only — no Supabase, no React. Fetching lives in
 * `planwise-data.ts`, which feeds these the rows it read.
 */

import type { VysoModuleKey } from './module-meta';

// ---------------------------------------------------------------------------
// Month pacing
// ---------------------------------------------------------------------------

export interface MonthPace {
  /** Day of month, 1-based (today). */
  day: number;
  /** Days in the current month. */
  days: number;
  /** Elapsed fraction of the month, 0–1 (day ÷ days). */
  elapsed: number;
  /** e.g. "July" — for copy like "68% of July elapsed". */
  monthLabel: string;
  /** Epoch ms at 00:00 on the 1st of this month. */
  monthStart: number;
  /** Epoch ms at 00:00 on the 1st of last month. */
  prevMonthStart: number;
}

export function monthPace(now: Date = new Date()): MonthPace {
  const y = now.getFullYear();
  const m = now.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const day = Math.min(now.getDate(), days);
  return {
    day,
    days,
    elapsed: days > 0 ? day / days : 0,
    monthLabel: now.toLocaleDateString('en-ZA', { month: 'long' }),
    monthStart: new Date(y, m, 1).getTime(),
    prevMonthStart: new Date(y, m - 1, 1).getTime(),
  };
}

// ---------------------------------------------------------------------------
// Category classification + per-category actuals
// ---------------------------------------------------------------------------

/** Which live feed (if any) can measure a budget category month-to-date. */
export type ActualSource = 'orders' | 'cogs' | 'waste' | 'plan';

export const ACTUAL_SOURCE_LABEL: Record<ActualSource, string> = {
  orders: 'Measured · OrderFlow',
  cogs: 'Measured · order cost',
  waste: 'Measured · WasteWatch',
  plan: 'From plan',
};

export type BudgetKind = 'revenue' | 'cogs' | 'waste' | 'other';

/** Categories are free text, so classification is by keyword — same test the
 *  existing revenue/COGS split in planwise-data.ts uses. */
export function classifyBudgetCategory(cat: string): BudgetKind {
  const c = cat.toLowerCase();
  if (c.includes('revenue') || c.includes('sales') || c.includes('income')) return 'revenue';
  if (c.includes('cogs') || c.includes('cost of goods') || c.includes('produce') || c.includes('stock purchase')) return 'cogs';
  if (c.includes('waste') || c.includes('spoilage') || c.includes('shrink')) return 'waste';
  return 'other';
}

/** Minimal budget-line shape these derivations need (avoids a type cycle). */
export interface BudgetLineLike {
  cat: string;
  budgeted: number;
  actual: number;
}

/** The measured month-to-date totals the category maths draws from. */
export interface MeasuredTotals {
  revenueMtd: number;
  cogsMtd: number;
  wasteMtd: number;
  /** False when the org has no realised sales this month — measured revenue/COGS
   *  of 0 is then "unknown", not "zero", so we fall back to the plan. */
  hasSales: boolean;
  /** False when no waste has been logged at all (same reasoning). */
  hasWaste: boolean;
}

export interface CategoryActual {
  cat: string;
  /** Whole-month plan. */
  budgeted: number;
  /** Plan pro-rated to today. */
  pacedBudget: number;
  /** Month-to-date actual (measured where possible, else the stored plan actual paced). */
  mtdActual: number;
  source: ActualSource;
  /** pacedBudget − mtdActual. Positive = under budget *for today*. */
  varianceVsPace: number;
  /** Straight-line run rate to month end. */
  projected: number;
  /** budgeted − projected. Positive = expected to land under. */
  projectedVariance: number;
  /** For a revenue line, over-plan is good; for a cost line it's bad. */
  higherIsBetter: boolean;
}

export function categoryActual(line: BudgetLineLike, measured: MeasuredTotals, pace: MonthPace): CategoryActual {
  const kind = classifyBudgetCategory(line.cat);
  let mtdActual: number;
  let source: ActualSource;

  if (kind === 'revenue' && measured.hasSales) {
    mtdActual = measured.revenueMtd;
    source = 'orders';
  } else if (kind === 'cogs' && measured.hasSales && measured.cogsMtd > 0) {
    mtdActual = measured.cogsMtd;
    source = 'cogs';
  } else if (kind === 'waste' && measured.hasWaste) {
    mtdActual = measured.wasteMtd;
    source = 'waste';
  } else {
    // No live feed for this category — pace the stored month figure so it is at
    // least comparable to the paced budget rather than silently reading "under".
    mtdActual = line.actual * pace.elapsed;
    source = 'plan';
  }

  const pacedBudget = line.budgeted * pace.elapsed;
  const projected = pace.elapsed > 0 ? mtdActual / pace.elapsed : 0;
  return {
    cat: line.cat,
    budgeted: line.budgeted,
    pacedBudget,
    mtdActual,
    source,
    varianceVsPace: pacedBudget - mtdActual,
    projected,
    projectedVariance: line.budgeted - projected,
    higherIsBetter: kind === 'revenue',
  };
}

export function categoryActuals(lines: BudgetLineLike[], measured: MeasuredTotals, pace: MonthPace): CategoryActual[] {
  return lines.map((l) => categoryActual(l, measured, pace));
}

/** Same-day status for a paced category. Tolerance keeps small noise neutral. */
export function paceStatus(a: CategoryActual): { label: string; tone: 'positive' | 'warning' | 'critical' | 'neutral' } {
  if (a.pacedBudget <= 0) return { label: 'No plan', tone: 'neutral' };
  const ratio = a.mtdActual / a.pacedBudget;
  if (a.higherIsBetter) {
    if (ratio >= 1) return { label: 'Ahead of pace', tone: 'positive' };
    if (ratio >= 0.9) return { label: 'Slightly behind', tone: 'warning' };
    return { label: 'Behind pace', tone: 'critical' };
  }
  if (ratio > 1.05) return { label: 'Over pace', tone: 'critical' };
  if (ratio > 1) return { label: 'Edging over', tone: 'warning' };
  return { label: 'Within pace', tone: 'positive' };
}

// ---------------------------------------------------------------------------
// The full actuals bundle
// ---------------------------------------------------------------------------

export interface PlanWiseActuals {
  pace: MonthPace;
  /** Realised (invoiced/paid) revenue this month, from of_orders + of_order_items. */
  revenueMtd: number;
  /** Cost of the same lines, priced at pp_stock_items.avg_unit_price. */
  cogsMtd: number;
  /** Revenue of the lines that had a unit cost (what COGS/margin reconcile to). */
  costedRevenueMtd: number;
  grossProfitMtd: number;
  /** Realised gross margin %, or null when nothing is costed yet. */
  grossMarginPct: number | null;
  /** Same-window revenue last month (1st → same day-of-month) — a fair MoM base. */
  revenuePrevSameWindow: number;
  /** Whole of last month, for the run-rate comparison. */
  revenuePrevFull: number;
  /** Month-on-month growth % on the like-for-like window, or null without a base. */
  growthPct: number | null;
  /** Logged waste cost this month (WasteWatch). */
  wasteMtd: number;
  /** Waste as a share of measured COGS — the number that links waste to food cost. */
  wastePctOfCogs: number | null;
  /** Unpaid receivables (of_invoices where present, else invoiced-not-paid orders). */
  outstanding: number;
  /** The part of `outstanding` already past its due date. */
  outstandingOverdue: number;
  /** Cash on hand proxy: measured GP MTD + last month's close, less the opex ceiling. */
  cashReserve: number;
  /** Per-category paced view of the budget. */
  categories: CategoryActual[];
  hasSales: boolean;
  hasWaste: boolean;
}

export const EMPTY_ACTUALS: PlanWiseActuals = {
  pace: monthPace(new Date(2000, 0, 1)),
  revenueMtd: 0,
  cogsMtd: 0,
  costedRevenueMtd: 0,
  grossProfitMtd: 0,
  grossMarginPct: null,
  revenuePrevSameWindow: 0,
  revenuePrevFull: 0,
  growthPct: null,
  wasteMtd: 0,
  wastePctOfCogs: null,
  outstanding: 0,
  outstandingOverdue: 0,
  cashReserve: 0,
  categories: [],
  hasSales: false,
  hasWaste: false,
};

// ---------------------------------------------------------------------------
// Live decision suggestions
// ---------------------------------------------------------------------------

/** A recommendation PlanWise can make from measured data (not a stored row). */
export interface SuggestedDecision {
  key: string;
  module: VysoModuleKey;
  action: string;
  impact: string;
  impactValue: number;
  priority: 'high' | 'medium' | 'low';
  /** Why PlanWise is suggesting it — shown under the action. */
  because: string;
}

const rand = (n: number) => `R ${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')}`;

/**
 * Turn measured signals into concrete, costed suggestions. Each one names the
 * module that can act on it, so the panel stays a routing surface rather than a
 * list of platitudes. Returns [] when nothing measurable is wrong — the caller
 * falls back to the static starter list so the panel is never blank.
 */
export function suggestDecisions(a: PlanWiseActuals, targetMarginPct: number | null): SuggestedDecision[] {
  const out: SuggestedDecision[] = [];

  if (a.outstanding > 0) {
    out.push({
      key: 'recover-outstanding',
      module: 'orderflow',
      action: 'Recover outstanding invoices',
      impact: `+${rand(a.outstanding)}`,
      impactValue: a.outstanding,
      priority: a.outstandingOverdue > 0 ? 'high' : 'medium',
      because:
        a.outstandingOverdue > 0
          ? `${rand(a.outstandingOverdue)} of it is already past due.`
          : 'Cash sitting in unpaid invoices.',
    });
  }

  if (a.wasteMtd > 0) {
    out.push({
      key: 'cut-waste',
      module: 'wastewatch',
      action: 'Cut logged waste',
      impact: `+${rand(a.wasteMtd * 0.4)} / mo`,
      impactValue: a.wasteMtd * 0.4,
      priority: a.wastePctOfCogs != null && a.wastePctOfCogs > 3 ? 'high' : 'medium',
      because:
        a.wastePctOfCogs != null
          ? `${rand(a.wasteMtd)} logged this month — ${a.wastePctOfCogs.toFixed(1)}% of food cost.`
          : `${rand(a.wasteMtd)} logged this month.`,
    });
  }

  if (targetMarginPct != null && a.grossMarginPct != null && a.grossMarginPct < targetMarginPct && a.costedRevenueMtd > 0) {
    const gap = ((targetMarginPct - a.grossMarginPct) / 100) * a.costedRevenueMtd;
    out.push({
      key: 'close-margin-gap',
      module: 'pricepilot',
      action: 'Reprice below-target products',
      impact: `+${rand(gap)} / mo`,
      impactValue: gap,
      priority: 'high',
      because: `Realised margin is ${a.grossMarginPct.toFixed(1)}% against a ${Math.round(targetMarginPct)}% target.`,
    });
  }

  for (const c of a.categories) {
    if (c.higherIsBetter || c.source === 'plan') continue;
    if (c.projectedVariance >= 0 || c.budgeted <= 0) continue;
    const over = Math.abs(c.projectedVariance);
    if (over < c.budgeted * 0.02) continue; // ignore noise
    out.push({
      key: `overspend-${c.cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      module: c.source === 'waste' ? 'wastewatch' : 'procurepulse',
      action: `Pull ${c.cat} back to plan`,
      impact: `+${rand(over)} / mo`,
      impactValue: over,
      priority: over > c.budgeted * 0.1 ? 'high' : 'medium',
      because: `Tracking to ${rand(c.projected)} against a ${rand(c.budgeted)} plan.`,
    });
  }

  const revenue = a.categories.find((c) => c.higherIsBetter);
  if (revenue && revenue.projectedVariance > 0 && revenue.budgeted > 0) {
    out.push({
      key: 'close-revenue-gap',
      module: 'orderflow',
      action: 'Close the revenue gap',
      impact: `+${rand(revenue.projectedVariance)}`,
      impactValue: revenue.projectedVariance,
      priority: revenue.projectedVariance > revenue.budgeted * 0.1 ? 'high' : 'medium',
      because: `Tracking to ${rand(revenue.projected)} against a ${rand(revenue.budgeted)} target.`,
    });
  }

  return out.sort((x, y) => y.impactValue - x.impactValue);
}
