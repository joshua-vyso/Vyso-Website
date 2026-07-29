/**
 * PlanWise data access.
 *
 * Two jobs:
 *  1. Read the org's *plan* — pw_budget_lines, pw_goals, pw_forecast,
 *     pw_scenarios, pw_decisions.
 *  2. Measure the org's *reality* month-to-date from the modules that own it —
 *     OrderFlow (of_orders / of_order_items / of_invoices) for revenue and
 *     receivables, PricePilot (pp_stock_items.avg_unit_price) for cost of
 *     goods, WasteWatch (ww_waste_events) for waste — and pace the plan against
 *     it so variance is same-day rather than month-end.
 *
 * The realised-sales maths mirrors PricePilot's dashboard exactly (only
 * invoiced/paid orders count; only lines with a known unit cost contribute to
 * COGS and margin) so the two modules never disagree about the same month.
 *
 * Derivations live in `planwise-actuals.ts`; structural constants (sliders,
 * drivers, starter recommendations) stay in `planwise.ts`. Every cross-module
 * read is tolerant of a missing table — an org that has not enabled OrderFlow
 * still gets its plan, just without measured actuals.
 */

import { createServerSupabase } from './supabase-server';
import type {
  PlanWiseData,
  BudgetRow,
  GoalSummary,
  ForecastLine,
  Scenario,
  FlowNode,
  ScenarioBase,
  MonthlyGoal,
  SliderValues,
  PlanDecision,
  Priority,
  RecStatus,
} from './planwise';
import { RECOMMENDATIONS, sortDecisions } from './planwise';
import {
  monthPace,
  categoryActuals,
  suggestDecisions,
  EMPTY_ACTUALS,
  type PlanWiseActuals,
  type MeasuredTotals,
} from './planwise-actuals';
import type { VysoModuleKey } from './module-meta';

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function numArr(v: any): number[] {
  return Array.isArray(v) ? v.map((n) => num(n)) : [];
}
/** Supabase returns `{ data: null, error }` for a table that does not exist yet. */
function rows(res: { data: any } | null | undefined): any[] {
  return (res?.data as any[]) ?? [];
}

/** The shape the module renders when there is no org / no data at all. */
export const EMPTY_PLANWISE: PlanWiseData = {
  budget: [],
  goals: [],
  forecast: [],
  scenarios: [],
  revenueSeries: [],
  totalBudget: 0,
  totalActual: 0,
  scenarioBase: { revenue: 0, expenses: 0, cogs: 0, cash: 0, outstanding: 0, runwayMonths: 0 },
  monthlyGoal: { label: 'Monthly Revenue Goal', targetRevenue: 0, currentForecast: 0 },
  financialFlow: [],
  actuals: EMPTY_ACTUALS,
  decisions: [],
  decisionsNeedSetup: false,
  targetMarginPct: null,
};

/** Statuses that mean an invoice is still owed to us. */
const OPEN_INVOICE_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];

export async function getPlanWiseData(orgId: string): Promise<PlanWiseData> {
  const sb = await createServerSupabase();
  const pace = monthPace();
  // `created_at` is a timestamptz, so an absolute instant is the right bound.
  const prevMonthStartIso = new Date(pace.prevMonthStart).toISOString();
  // `ww_waste_events.event_date` is a plain DATE, so it must be compared to the
  // LOCAL calendar date — toISOString() would shift us a day back west of UTC.
  const ms = new Date(pace.monthStart);
  const monthStartDate = `${ms.getFullYear()}-${String(ms.getMonth() + 1).padStart(2, '0')}-01`;

  const [bud, goa, fc, sce, dec, orders, orderItems, stockItems, waste, invoices, invoiceItems, targetsRow] =
    await Promise.all([
      sb.from('pw_budget_lines').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('pw_goals').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('pw_forecast').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('pw_scenarios').select('*').eq('org_id', orgId).order('sort_order'),
      sb.from('pw_decisions').select('*').eq('org_id', orgId).order('sort_order'),
      // Realised sales only, from the start of LAST month (we need a like-for-like
      // month-on-month base as well as this month's total).
      sb
        .from('of_orders')
        .select('id, status, created_at')
        .eq('org_id', orgId)
        .in('status', ['invoiced', 'paid'])
        .gte('created_at', prevMonthStartIso),
      sb.from('of_order_items').select('order_id, stock_item_id, qty, unit_price').eq('org_id', orgId),
      sb.from('pp_stock_items').select('id, avg_unit_price').eq('org_id', orgId).limit(5000),
      sb.from('ww_waste_events').select('cost, event_date').eq('org_id', orgId).gte('event_date', monthStartDate),
      sb.from('of_invoices').select('id, status, due_date, discount').eq('org_id', orgId).in('status', OPEN_INVOICE_STATUSES),
      sb.from('of_invoice_items').select('invoice_id, qty, unit_price').eq('org_id', orgId),
      sb.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

  // -------------------------------------------------------------------------
  // Plan
  // -------------------------------------------------------------------------

  const allBudget: BudgetRow[] = rows(bud).map((r) => ({
    rowId: r.id,
    cat: r.cat ?? '',
    budgeted: num(r.budgeted),
    actual: num(r.actual),
    profitImpact: num(r.profit_impact),
    suggestedAction: r.suggested_action ?? '',
    module: r.module ?? undefined,
    color: r.color ?? '#6B6F68',
  }));

  const goals: GoalSummary[] = rows(goa).map((r) => ({
    rowId: r.id,
    id: r.goal_key ?? r.id,
    label: r.label ?? '',
    target: num(r.target),
    current: num(r.current),
    unit: (r.unit as GoalSummary['unit']) ?? 'R',
    higherIsBetter: !!r.higher_is_better,
    module: r.module ?? undefined,
    trend: numArr(r.trend),
  }));

  const forecastRows = rows(fc);
  const forecast: ForecastLine[] = forecastRows.map((r) => ({
    rowId: r.id,
    id: r.forecast_key ?? r.id,
    label: r.label ?? '',
    value: num(r.value),
    target: num(r.target),
    rangeLow: num(r.range_low),
    rangeHigh: num(r.range_high),
    confidence: num(r.confidence),
    trend: (r.trend as ForecastLine['trend']) ?? 'flat',
    tone: (r.tone as ForecastLine['tone']) ?? 'neutral',
    data: numArr(r.data),
  }));
  const revRow = forecastRows.find((r) => (r.forecast_key ?? '') === 'rev') ?? forecastRows[0];
  // series may be an array of numbers or of { month, value, kind } points.
  const revenueSeries = Array.isArray(revRow?.series)
    ? revRow.series.map((s: any) => num(s != null && typeof s === 'object' ? s.value : s))
    : [];

  const scenarios: Scenario[] = rows(sce).map((r) => ({
    id: r.scenario_key ?? r.id,
    title: r.title ?? '',
    description: r.description ?? '',
    assumption: r.assumption ?? '',
    sliders: (r.sliders && typeof r.sliders === 'object' ? r.sliders : {}) as SliderValues,
    risk: (r.risk as Scenario['risk']) ?? 'Medium',
    probability: num(r.probability, 50),
  }));

  // -------------------------------------------------------------------------
  // Reality — month-to-date measurement
  // -------------------------------------------------------------------------

  const costByItem = new Map(
    rows(stockItems).map((it) => [it.id as string, it.avg_unit_price != null ? Number(it.avg_unit_price) : null]),
  );
  const orderTs = new Map(rows(orders).map((o) => [o.id as string, new Date(o.created_at).getTime()]));

  // Like-for-like window: 1st → same day-of-month, so a MoM comparison on the
  // 8th isn't measuring 8 days against 31.
  const prevWindowEnd = new Date(pace.prevMonthStart);
  prevWindowEnd.setDate(prevWindowEnd.getDate() + pace.day);
  const prevWindowEndTs = Math.min(prevWindowEnd.getTime(), pace.monthStart);

  let revenueMtd = 0;
  let cogsMtd = 0;
  let costedRevenueMtd = 0;
  let revenuePrevSameWindow = 0;
  let revenuePrevFull = 0;

  for (const it of rows(orderItems) as { order_id: string; stock_item_id: string | null; qty: any; unit_price: any }[]) {
    const ts = orderTs.get(it.order_id);
    if (ts == null) continue; // not a realised order inside our window
    const qty = num(it.qty);
    const revenue = qty * num(it.unit_price);
    if (ts >= pace.monthStart) {
      revenueMtd += revenue;
      const unitCost = it.stock_item_id ? costByItem.get(it.stock_item_id) ?? null : null;
      if (unitCost != null) {
        costedRevenueMtd += revenue;
        cogsMtd += qty * unitCost;
      }
    } else {
      revenuePrevFull += revenue;
      if (ts < prevWindowEndTs) revenuePrevSameWindow += revenue;
    }
  }

  const wasteMtd = rows(waste).reduce((s, w) => s + num(w.cost), 0);
  const hasWaste = rows(waste).length > 0;
  const hasSales = revenueMtd > 0;

  // Receivables: prefer real invoices; fall back to invoiced-not-paid orders for
  // orgs still on the lightweight order flow.
  const openInvoices = rows(invoices) as { id: string; due_date: string | null; discount: any }[];
  const invoiceSubtotal = new Map<string, number>();
  for (const li of rows(invoiceItems) as { invoice_id: string; qty: any; unit_price: any }[]) {
    invoiceSubtotal.set(li.invoice_id, (invoiceSubtotal.get(li.invoice_id) ?? 0) + num(li.qty) * num(li.unit_price));
  }
  const todayMs = Date.now();
  let outstanding = 0;
  let outstandingOverdue = 0;
  for (const inv of openInvoices) {
    const amount = Math.max(0, (invoiceSubtotal.get(inv.id) ?? 0) - num(inv.discount));
    outstanding += amount;
    if (inv.due_date && new Date(inv.due_date).getTime() < todayMs) outstandingOverdue += amount;
  }
  if (openInvoices.length === 0) {
    // Fallback for orgs still on the lightweight order flow (no of_invoices rows):
    // orders billed but not marked paid. Bounded by the two-month order window we
    // fetched, so it under-reports very old debt rather than over-reporting.
    const unpaidOrderIds = new Set(rows(orders).filter((o) => o.status === 'invoiced').map((o) => o.id as string));
    for (const it of rows(orderItems) as { order_id: string; qty: any; unit_price: any }[]) {
      if (unpaidOrderIds.has(it.order_id)) outstanding += num(it.qty) * num(it.unit_price);
    }
  }

  const grossProfitMtd = costedRevenueMtd - cogsMtd;
  const grossMarginPct = costedRevenueMtd > 0 ? (grossProfitMtd / costedRevenueMtd) * 100 : null;
  const growthPct =
    revenuePrevSameWindow > 0 ? ((revenueMtd - revenuePrevSameWindow) / revenuePrevSameWindow) * 100 : null;
  const wastePctOfCogs = cogsMtd > 0 ? (wasteMtd / cogsMtd) * 100 : null;

  const targets = (targetsRow?.data ?? null) as { monthly_opex?: any; target_margin_pct?: any; monthly_revenue_target?: any } | null;
  const opexCeiling = targets?.monthly_opex != null ? Number(targets.monthly_opex) : null;
  const targetMarginPct = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : null;

  const measured: MeasuredTotals = { revenueMtd, cogsMtd, wasteMtd, hasSales, hasWaste };

  // --- Plan split: revenue is a budget line but semantically distinct from
  // spending, so `budget` (the doughnut/table) holds expense lines only and the
  // revenue figures feed the goal + financial flow instead.
  const isRevenue = (c: string) => c.toLowerCase().includes('revenue') || c.toLowerCase().includes('sales');
  const isCogs = (c: string) =>
    c.toLowerCase().includes('cogs') || c.toLowerCase().includes('cost of goods') || c.toLowerCase().includes('produce');
  const revenueRow = allBudget.find((b) => isRevenue(b.cat));
  const revenueBudgeted = revenueRow?.budgeted ?? 0;

  const budget: BudgetRow[] = allBudget.filter((b) => !isRevenue(b.cat));
  const totalBudget = budget.reduce((s, b) => s + b.budgeted, 0);
  const totalActual = budget.reduce((s, b) => s + b.actual, 0);

  // Paced view covers every line INCLUDING revenue, so the revenue gap is on the
  // same footing as the overspends.
  const categories = categoryActuals(allBudget, measured, pace);

  // Working-capital proxy: profit earned so far plus what customers still owe,
  // less the overhead ceiling consumed to date. It is a proxy (Vyso does not read
  // a bank balance), but every input is measured rather than assumed.
  const opexElapsed = opexCeiling != null ? opexCeiling * pace.elapsed : 0;
  const measuredCash = Math.max(0, grossProfitMtd + outstanding - opexElapsed);

  const actuals: PlanWiseActuals = {
    pace,
    revenueMtd,
    cogsMtd,
    costedRevenueMtd,
    grossProfitMtd,
    grossMarginPct,
    revenuePrevSameWindow,
    revenuePrevFull,
    growthPct,
    wasteMtd,
    wastePctOfCogs,
    outstanding,
    outstandingOverdue,
    cashReserve: measuredCash,
    categories,
    hasSales,
    hasWaste,
  };

  // -------------------------------------------------------------------------
  // Derived plan figures — measured where we can measure, planned otherwise
  // -------------------------------------------------------------------------

  const revenueCat = categories.find((c) => c.higherIsBetter);
  // Full-month revenue: the measured run rate once there are sales, else the plan.
  const revenue = hasSales && revenueCat ? revenueCat.projected : revenueRow?.actual ?? 0;
  const cogs = hasSales && cogsMtd > 0 ? cogsMtd / Math.max(pace.elapsed, 0.001) : budget.find((b) => isCogs(b.cat))?.actual ?? 0;
  const expenses = hasSales
    ? categories.filter((c) => !c.higherIsBetter).reduce((s, c) => s + c.projected, 0)
    : totalActual;
  const grossProfit = revenue - cogs;
  const netProfit = revenue - expenses;

  const cash = hasSales ? Math.round(measuredCash) : Math.round(revenue * 0.5);
  const overhead = Math.max(0, expenses - cogs);
  const scenarioBase: ScenarioBase = {
    revenue,
    expenses,
    cogs,
    cash,
    outstanding: outstanding > 0 ? Math.round(outstanding) : Math.round(revenue * 0.06),
    runwayMonths: overhead > 0 ? Math.min(12, Math.max(0.5, Math.round((cash / overhead) * 10) / 10)) : 0,
  };

  const monthlyGoal: MonthlyGoal = {
    label: 'Monthly Revenue Goal',
    targetRevenue:
      (targets?.monthly_revenue_target != null ? Number(targets.monthly_revenue_target) : 0) ||
      revenueBudgeted ||
      num(revRow?.target) ||
      revenue,
    // The forecast is the measured run rate when sales exist — that is what makes
    // the gap same-day rather than a stored number from whenever it was seeded.
    currentForecast: hasSales ? revenue : num(revRow?.value) || revenue,
  };

  // Goals whose "current" we can measure get overwritten from live data, so a
  // stale seeded value never masquerades as today's position.
  const derivedCurrent = new Map<string, number | null>([
    ['revenue', hasSales ? revenueMtd : null],
    ['margin', grossMarginPct],
    ['growth', growthPct],
    ['cash', hasSales ? measuredCash : null],
    ['outstanding', outstanding > 0 ? outstanding : null],
  ]);
  const liveGoals: GoalSummary[] = goals.map((g) => {
    const d = derivedCurrent.get(g.id);
    return d == null ? g : { ...g, current: d, derived: true };
  });

  // Forecast lines carry the measured month-to-date figure alongside the
  // projection, so the editor shows what is already banked before someone
  // overrides where the month lands.
  const measuredExpenses = categories
    .filter((c) => !c.higherIsBetter && c.source !== 'plan')
    .reduce((s, c) => s + c.mtdActual, 0);
  const measuredByForecastKey = new Map<string, number | null>([
    ['rev', hasSales ? revenueMtd : null],
    ['exp', measuredExpenses > 0 ? measuredExpenses : null],
    ['profit', hasSales ? grossProfitMtd : null],
    ['cash', hasSales ? measuredCash : null],
  ]);
  const liveForecast: ForecastLine[] = forecast.map((f) => ({ ...f, measured: measuredByForecastKey.get(f.id) ?? null }));

  const financialFlow: FlowNode[] = revenue
    ? [
        { key: 'revenue', label: 'Revenue', value: revenue, tone: 'neutral', module: 'orderflow' },
        {
          key: 'margins',
          label: 'Gross margin',
          value: revenue ? Math.round((grossProfit / revenue) * 100) : 0,
          tone: 'neutral',
          module: 'pricepilot',
        },
        { key: 'gross', label: 'Gross profit', value: grossProfit, tone: 'positive' },
        {
          key: 'expenses',
          label: 'Expenses',
          value: expenses,
          tone: 'critical',
          children: budget.map((b) => ({
            label: b.cat,
            value: categories.find((c) => c.cat === b.cat)?.projected ?? b.actual,
            module: b.module,
          })),
        },
        { key: 'net', label: 'Net profit', value: netProfit, tone: netProfit >= 0 ? 'positive' : 'critical' },
        { key: 'cash', label: 'Cash position', value: scenarioBase.cash, tone: 'neutral' },
      ]
    : [];

  // -------------------------------------------------------------------------
  // Decisions — tracked rows merged with live suggestions
  // -------------------------------------------------------------------------

  const decisionsNeedSetup = dec.error != null && /pw_decisions|does not exist/i.test(dec.error.message ?? '');
  const tracked: PlanDecision[] = rows(dec).map((r) => ({
    rowId: r.id as string,
    key: r.decision_key ?? (r.id as string),
    module: (r.module ?? 'orderflow') as VysoModuleKey,
    action: r.action ?? '',
    impact: r.impact ?? '',
    impactValue: num(r.impact_value),
    priority: (r.priority as Priority) ?? 'medium',
    status: (r.status as RecStatus) ?? 'open',
    because: r.because ?? null,
    note: r.note ?? null,
  }));
  const trackedKeys = new Set(tracked.map((d) => d.key));

  let suggestions: PlanDecision[] = suggestDecisions(actuals, targetMarginPct)
    .filter((s) => !trackedKeys.has(s.key))
    .map((s) => ({
      rowId: null,
      key: s.key,
      module: s.module,
      action: s.action,
      impact: s.impact,
      impactValue: s.impactValue,
      priority: s.priority,
      status: 'open' as RecStatus,
      because: s.because,
      note: null,
    }));

  // Nothing measurable yet (a fresh org): keep the starter recommendations so the
  // panel still explains what PlanWise will do, rather than going blank.
  if (tracked.length === 0 && suggestions.length === 0) {
    suggestions = RECOMMENDATIONS.map((r) => ({
      rowId: null,
      key: r.id,
      module: r.module,
      action: r.action,
      impact: r.impact,
      impactValue: r.impactValue,
      priority: r.priority,
      status: r.status,
      because: null,
      note: null,
    }));
  }

  return {
    budget,
    goals: liveGoals,
    forecast: liveForecast,
    scenarios,
    revenueSeries,
    totalBudget,
    totalActual,
    scenarioBase,
    monthlyGoal,
    financialFlow,
    actuals,
    decisions: sortDecisions([...tracked, ...suggestions]),
    decisionsNeedSetup,
    targetMarginPct,
  };
}
