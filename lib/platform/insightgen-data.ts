/**
 * InsightGen data access — the cross-module insight / reporting brain.
 *
 * Two layers live here:
 *
 *  1. `getInsightGenData` (unchanged): the org's seeded `ig_insights` +
 *     `ig_reports` rows, mapped to UI-agnostic shapes.
 *  2. `getInsightGenBrain` (the real product): a single server-side pass that
 *     READS the other modules' tables — of_orders/of_order_items (sales),
 *     ww_waste_events (waste), sb_employees/sb_attendance (labour),
 *     pp_stock_items/pp_stock_thresholds (stock), ss_* (supplier risk) and
 *     pl_targets (margin target) — and derives the Daily Ops Brief, the derived
 *     insight feed, the rule-based anomalies and the raw report datasets that
 *     back CSV export.
 *
 * Everything derived is honest: each anomaly carries the exact rule that fired
 * it, and every number on screen is computed from rows this org actually has.
 * Org-scoped by RLS; an unseeded org returns empty collections + `hasData:false`
 * so every view falls back to its dashed empty panel.
 */

import { createServerSupabase } from './supabase-server';
import type { VysoModuleKey } from './module-meta';
import {
  WINDOW_DAYS,
  DEFAULT_TARGET_MARGIN_PCT,
  MARGIN_WARN_PP,
  MARGIN_CRITICAL_PP,
  PRICE_JUMP_WARN_PCT,
  PRICE_JUMP_CRITICAL_PCT,
  WASTE_SPIKE_WARN_PCT,
  WASTE_SPIKE_CRITICAL_PCT,
  LABOUR_WARN_PCT,
  LABOUR_CRITICAL_PCT,
} from './insightgen';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Existing shapes (unchanged — the seeded insight/report records)
// ---------------------------------------------------------------------------

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'positive';
export type ReportStatus = 'draft' | 'ready' | 'scheduled';

export interface GenInsight {
  id: string;
  sourceModule: string;
  severity: InsightSeverity;
  text: string;
  metricLabel: string | null;
  metricValue: string | null;
  isAnomaly: boolean;
  /** 'derived' = computed from this org's rows in this request; 'seed' = ig_insights row. */
  origin?: 'seed' | 'derived';
}
export interface GenReport {
  id: string;
  name: string;
  scope: string | null;
  modules: string[];
  schedule: string;
  status: ReportStatus;
  owner: string | null;
  lastRun: string | null;
  /** Rows produced by the most recent recorded run (ig_report_runs), if any. */
  lastRunRows?: number | null;
}
export interface InsightGenData {
  insights: GenInsight[];
  reports: GenReport[];
}

export async function getInsightGenData(orgId: string): Promise<InsightGenData> {
  const sb = await createServerSupabase();
  const [ins, rep] = await Promise.all([
    sb.from('ig_insights').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    sb.from('ig_reports').select('*').eq('org_id', orgId).order('last_run', { ascending: false }),
  ]);

  return { insights: mapInsights(ins.data), reports: mapReports(rep.data, new Map()) };
}

function mapInsights(data: any): GenInsight[] {
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    sourceModule: r.source_module ?? '',
    severity: (r.severity as InsightSeverity) ?? 'info',
    text: r.text ?? '',
    metricLabel: r.metric_label ?? null,
    metricValue: r.metric_value ?? null,
    isAnomaly: !!r.is_anomaly,
    origin: 'seed' as const,
  }));
}

function mapReports(data: any, runs: Map<string, { at: string; rows: number }>): GenReport[] {
  return ((data as any[]) ?? []).map((r) => {
    const run = runs.get(r.id);
    return {
      id: r.id,
      name: r.name ?? '',
      scope: r.scope ?? null,
      modules: Array.isArray(r.modules) ? (r.modules as string[]) : [],
      schedule: r.schedule ?? 'weekly',
      status: (r.status as ReportStatus) ?? 'ready',
      owner: r.owner ?? null,
      lastRun: run?.at ?? r.last_run ?? null,
      lastRunRows: run?.rows ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Brain shapes
// ---------------------------------------------------------------------------

/** One module InsightGen reads from, and whether this org has rows in it. */
export interface ModuleSource {
  key: VysoModuleKey;
  label: string;
  /** Rows found in the window for this module's primary table. */
  rows: number;
  connected: boolean;
}

/** A single line on the Daily Ops Brief. */
export interface BriefStockAlert {
  id: string;
  name: string;
  onHand: number;
  threshold: number;
  unit: string;
}
export interface BriefSupplierRisk {
  id: string;
  supplier: string;
  type: string;
  severity: string;
}

/** The morning snapshot: what happened yesterday and what today looks like. */
export interface DailyOpsBrief {
  /** yyyy-mm-dd of "today" on the server. */
  today: string;
  yesterday: string;
  /** Yesterday's realized sales (order lines on non-draft orders). */
  salesYesterday: number;
  ordersYesterday: number;
  /** Day before yesterday, for the day-on-day delta. */
  salesPrevDay: number;
  wasteYesterday: number;
  wasteEventsYesterday: number;
  wastePreventableYesterday: number;
  staffOnShiftToday: number;
  staffTotal: number;
  labourCostToday: number;
  labourPctOfSales: number | null;
  stockAlerts: BriefStockAlert[];
  supplierRisks: BriefSupplierRisk[];
  docsExpiring: number;
}

/** A rule-based anomaly. `rule` is the literal threshold that fired it. */
export interface Anomaly {
  id: string;
  /** Stable key used to acknowledge the anomaly (ig_anomaly_acks.anomaly_key). */
  key: string;
  module: VysoModuleKey;
  severity: InsightSeverity;
  title: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
  rule: string;
  acknowledged: boolean;
}

/** Raw rows behind a report scope — the CSV export payload. */
export type CellValue = string | number;
export interface ReportDataset {
  key: string;
  module: VysoModuleKey;
  label: string;
  description: string;
  columns: string[];
  rows: CellValue[][];
}

export interface InsightGenBrain {
  /** Seeded ig_insights rows. */
  seeded: GenInsight[];
  /** Insights computed from this org's rows in this request. */
  derived: GenInsight[];
  /** derived + seeded, derived first. */
  insights: GenInsight[];
  reports: GenReport[];
  brief: DailyOpsBrief;
  anomalies: Anomaly[];
  datasets: ReportDataset[];
  sources: ModuleSource[];
  /** Sales revenue per day over the window, oldest first. */
  salesSeries: { date: string; value: number }[];
  /** Waste cost per day over the window, oldest first. */
  wasteSeries: { date: string; value: number }[];
  /** ISO timestamp this brain was computed — replaces the old hard-coded "2m ago". */
  generatedAt: string;
  /** Days of history the aggregation covered. */
  windowDays: number;
  /** False when no module has any rows for this org. */
  hasData: boolean;
}

// ---------------------------------------------------------------------------
// Tunables — every threshold used by a rule is named in `./insightgen` (the
// client-safe layer) and re-exported here so server callers keep one import.
// ---------------------------------------------------------------------------

export {
  WINDOW_DAYS,
  DEFAULT_TARGET_MARGIN_PCT,
  MARGIN_WARN_PP,
  MARGIN_CRITICAL_PP,
  PRICE_JUMP_WARN_PCT,
  PRICE_JUMP_CRITICAL_PCT,
  WASTE_SPIKE_WARN_PCT,
  WASTE_SPIKE_CRITICAL_PCT,
  LABOUR_WARN_PCT,
  LABOUR_CRITICAL_PCT,
} from './insightgen';

/** Rows returned per raw table (report datasets stay exportable, not unbounded). */
const ROW_LIMIT = 2000;

const MODULE_LABEL: Record<VysoModuleKey, string> = {
  docu: 'Doc-U',
  procurepulse: 'ProcurePulse',
  pricepilot: 'PricePilot',
  planwise: 'PlanWise',
  wastewatch: 'WasteWatch',
  shiftboard: 'ShiftBoard',
  supplysync: 'SupplySync',
  insightgen: 'InsightGen',
  orderflow: 'OrderFlow',
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function rows(res: any): any[] {
  return Array.isArray(res?.data) ? (res.data as any[]) : [];
}
/** yyyy-mm-dd for a Date in server-local time (dates in the DB are plain dates). */
function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function dayOffset(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return isoDay(d);
}
/** Percentage change from `a` to `b`; null when there is no baseline. */
function pctChange(a: number, b: number): number | null {
  if (!Number.isFinite(a) || a <= 0) return null;
  return ((b - a) / a) * 100;
}
function round(n: number, dp = 0): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}
/** "R 8 540" — matches the OrderFlow money format used repo-wide. */
function zar(n: number): string {
  return `R ${Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')}`;
}
function signedPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${round(n, 1)}%`;
}
/** Sum of a numeric map's values. */
function sumRange(map: Map<string, number>, from: string, to: string): number {
  let total = 0;
  for (const [k, v] of map) if (k >= from && k <= to) total += v;
  return total;
}

export const EMPTY_BRIEF: DailyOpsBrief = {
  today: '',
  yesterday: '',
  salesYesterday: 0,
  ordersYesterday: 0,
  salesPrevDay: 0,
  wasteYesterday: 0,
  wasteEventsYesterday: 0,
  wastePreventableYesterday: 0,
  staffOnShiftToday: 0,
  staffTotal: 0,
  labourCostToday: 0,
  labourPctOfSales: null,
  stockAlerts: [],
  supplierRisks: [],
  docsExpiring: 0,
};

export const EMPTY_BRAIN: InsightGenBrain = {
  seeded: [],
  derived: [],
  insights: [],
  reports: [],
  brief: EMPTY_BRIEF,
  anomalies: [],
  datasets: [],
  sources: [],
  salesSeries: [],
  wasteSeries: [],
  generatedAt: '',
  windowDays: WINDOW_DAYS,
  hasData: false,
};

// ---------------------------------------------------------------------------
// The brain
// ---------------------------------------------------------------------------

export async function getInsightGenBrain(orgId: string): Promise<InsightGenBrain> {
  const sb = await createServerSupabase();
  const now = new Date();
  const today = isoDay(now);
  const yesterday = dayOffset(now, -1);
  const prevDay = dayOffset(now, -2);
  const windowStart = dayOffset(now, -WINDOW_DAYS);

  const [
    insRes,
    repRes,
    runRes,
    ackRes,
    ordRes,
    itemRes,
    wasteRes,
    empRes,
    attRes,
    stockRes,
    threshRes,
    supRes,
    riskRes,
    docRes,
    pricingRes,
    targetRes,
  ] = await Promise.all([
    sb.from('ig_insights').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(200),
    sb.from('ig_reports').select('*').eq('org_id', orgId).order('last_run', { ascending: false }).limit(200),
    sb.from('ig_report_runs').select('*').eq('org_id', orgId).order('run_at', { ascending: false }).limit(500),
    sb.from('ig_anomaly_acks').select('*').eq('org_id', orgId).limit(500),
    sb
      .from('of_orders')
      .select('id, status, created_at, invoice_number')
      .eq('org_id', orgId)
      .gte('created_at', `${windowStart}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(ROW_LIMIT),
    sb.from('of_order_items').select('order_id, stock_item_id, name, qty, unit, unit_price').eq('org_id', orgId).limit(ROW_LIMIT * 3),
    sb
      .from('ww_waste_events')
      .select('*')
      .eq('org_id', orgId)
      .gte('event_date', windowStart)
      .order('event_date', { ascending: false })
      .limit(ROW_LIMIT),
    sb.from('sb_employees').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('sb_attendance').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('pp_stock_items').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('pp_stock_thresholds').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('ss_suppliers').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('ss_supplier_risks').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('ss_supplier_documents').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('ss_supplier_pricing').select('*').eq('org_id', orgId).limit(ROW_LIMIT),
    sb.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
  ]);

  const orders = rows(ordRes);
  const orderItems = rows(itemRes);
  const wasteEvents = rows(wasteRes);
  const employees = rows(empRes);
  const attendance = rows(attRes);
  const stockItems = rows(stockRes);
  const thresholds = rows(threshRes);
  const suppliers = rows(supRes);
  const risks = rows(riskRes);
  const supplierDocs = rows(docRes);
  const pricing = rows(pricingRes);
  const targetRow = (targetRes as any)?.data ?? null;

  // -- Run history keyed by report -----------------------------------------
  const runByReport = new Map<string, { at: string; rows: number }>();
  for (const r of rows(runRes)) {
    const id = r.report_id as string | null;
    if (!id || runByReport.has(id)) continue; // ordered newest-first
    runByReport.set(id, { at: r.run_at ?? '', rows: num(r.row_count) });
  }
  const ackedKeys = new Set(rows(ackRes).map((r) => String(r.anomaly_key ?? '')));

  // -- Sales ---------------------------------------------------------------
  // of_orders carries no total, so revenue is rebuilt from its line items —
  // the same derivation PricePilot's dashboard uses. Draft orders are excluded:
  // they are not realized revenue.
  const orderMeta = new Map<string, { date: string; status: string; invoice: string }>();
  for (const o of orders) {
    const status = String(o.status ?? 'draft');
    if (status === 'draft') continue;
    orderMeta.set(String(o.id), {
      date: String(o.created_at ?? '').slice(0, 10),
      status,
      invoice: o.invoice_number ?? '',
    });
  }
  const costByItem = new Map<string, number>();
  for (const s of stockItems) {
    if (s.avg_unit_price != null) costByItem.set(String(s.id), num(s.avg_unit_price));
  }

  const salesByDay = new Map<string, number>();
  const ordersByDay = new Map<string, Set<string>>();
  const salesRows: CellValue[][] = [];
  let realizedRevenue = 0;
  let costableRevenue = 0;
  let costOfSales = 0;
  for (const li of orderItems) {
    const meta = orderMeta.get(String(li.order_id));
    if (!meta) continue;
    const qty = num(li.qty);
    const unitPrice = num(li.unit_price);
    const lineTotal = qty * unitPrice;
    salesByDay.set(meta.date, (salesByDay.get(meta.date) ?? 0) + lineTotal);
    const set = ordersByDay.get(meta.date) ?? new Set<string>();
    set.add(String(li.order_id));
    ordersByDay.set(meta.date, set);
    realizedRevenue += lineTotal;
    const unitCost = li.stock_item_id ? costByItem.get(String(li.stock_item_id)) : undefined;
    if (unitCost != null) {
      costableRevenue += lineTotal;
      costOfSales += qty * unitCost;
    }
    salesRows.push([
      meta.date,
      meta.invoice || String(li.order_id).slice(0, 8),
      meta.status,
      String(li.name ?? ''),
      round(qty, 2),
      String(li.unit ?? ''),
      round(unitPrice, 2),
      round(lineTotal, 2),
    ]);
  }
  salesRows.sort((a, b) => String(b[0]).localeCompare(String(a[0])));

  // -- Waste ---------------------------------------------------------------
  const wasteByDay = new Map<string, number>();
  const wasteByReason = new Map<string, number>();
  let wasteTotal = 0;
  let wastePreventable = 0;
  const wasteRows: CellValue[][] = [];
  for (const e of wasteEvents) {
    const date = String(e.event_date ?? '');
    const cost = num(e.cost);
    wasteByDay.set(date, (wasteByDay.get(date) ?? 0) + cost);
    const reason = String(e.reason ?? 'Other');
    wasteByReason.set(reason, (wasteByReason.get(reason) ?? 0) + cost);
    wasteTotal += cost;
    if (e.preventable) wastePreventable += cost;
    wasteRows.push([
      date,
      String(e.item ?? ''),
      String(e.category ?? ''),
      round(num(e.qty), 2),
      String(e.unit ?? ''),
      round(cost, 2),
      reason,
      String(e.employee ?? ''),
      e.preventable ? 'yes' : 'no',
    ]);
  }

  // -- Labour --------------------------------------------------------------
  // sb_attendance is today's roster of record (one row per employee rostered
  // today), so labour cost today = Σ hours worked × that employee's rate.
  const rateById = new Map<string, number>();
  const rateByName = new Map<string, number>();
  for (const e of employees) {
    rateById.set(String(e.id), num(e.rate));
    rateByName.set(String(e.name ?? ''), num(e.rate));
  }
  let labourCostToday = 0;
  let staffOnShiftToday = 0;
  const labourRows: CellValue[][] = [];
  for (const a of attendance) {
    const rate = rateById.get(String(a.employee_id ?? '')) ?? rateByName.get(String(a.name ?? '')) ?? 0;
    const hours = num(a.hours_worked);
    const cost = hours * rate;
    const status = String(a.status ?? '');
    if (status !== 'Absent') staffOnShiftToday += 1;
    labourCostToday += cost;
    labourRows.push([
      String(a.name ?? ''),
      String(a.department ?? ''),
      String(a.scheduled ?? ''),
      String(a.clock_in ?? ''),
      String(a.clock_out ?? ''),
      round(hours, 2),
      status,
      round(num(a.overtime), 2),
      round(rate, 2),
      round(cost, 2),
    ]);
  }
  if (attendance.length === 0) {
    // No attendance rows — fall back to the employee roster's own status field.
    staffOnShiftToday = employees.filter((e) => ['Working', 'On break', 'Scheduled'].includes(String(e.status ?? ''))).length;
  }

  // -- Stock ---------------------------------------------------------------
  const thresholdByItem = new Map<string, number>();
  for (const t of thresholds) {
    if (t.low_threshold != null) thresholdByItem.set(String(t.stock_item_id), num(t.low_threshold));
  }
  const stockAlerts: BriefStockAlert[] = [];
  const stockRows: CellValue[][] = [];
  for (const s of stockItems) {
    const onHand = num(s.on_hand);
    const low = thresholdByItem.get(String(s.id)) ?? num(s.low_threshold);
    if (low > 0 && onHand <= low) {
      stockAlerts.push({ id: String(s.id), name: String(s.name ?? ''), onHand, threshold: low, unit: String(s.unit ?? '') });
    }
    stockRows.push([
      String(s.name ?? ''),
      String(s.category ?? ''),
      String(s.unit ?? ''),
      round(onHand, 2),
      round(low, 2),
      s.avg_unit_price != null ? round(num(s.avg_unit_price), 2) : '',
      s.trend_pct != null ? round(num(s.trend_pct), 1) : '',
      String(s.cheapest_supplier ?? ''),
    ]);
  }
  stockAlerts.sort((a, b) => a.onHand - b.onHand);

  // -- Suppliers -----------------------------------------------------------
  const supplierName = new Map<string, string>(suppliers.map((s) => [String(s.id), String(s.name ?? '')]));
  const openRisks = risks.filter((r) => r.status === 'open' || r.status === 'in_progress');
  const supplierRisks: BriefSupplierRisk[] = openRisks
    .slice()
    .sort((a, b) => severityRank(String(b.severity)) - severityRank(String(a.severity)))
    .slice(0, 6)
    .map((r) => ({
      id: String(r.id),
      supplier: supplierName.get(String(r.supplier_id)) ?? 'Unassigned',
      type: String(r.risk_type ?? ''),
      severity: String(r.severity ?? 'medium'),
    }));
  const docsExpiring = supplierDocs.filter((d) => d.status === 'expiring' || d.status === 'expired' || d.status === 'missing').length;
  const supplierRows: CellValue[][] = suppliers.map((s) => [
    String(s.name ?? ''),
    String(s.category ?? ''),
    String(s.status ?? ''),
    String(s.risk ?? ''),
    round(num(s.on_time_pct), 0),
    round(num(s.spend_mtd), 2),
    String(s.price_trend ?? ''),
    String(s.last_order ?? ''),
  ]);

  // -- Brief ---------------------------------------------------------------
  const salesYesterday = salesByDay.get(yesterday) ?? 0;
  const salesToday = salesByDay.get(today) ?? 0;
  const brief: DailyOpsBrief = {
    today,
    yesterday,
    salesYesterday,
    ordersYesterday: ordersByDay.get(yesterday)?.size ?? 0,
    salesPrevDay: salesByDay.get(prevDay) ?? 0,
    wasteYesterday: round(wasteByDay.get(yesterday) ?? 0, 2),
    wasteEventsYesterday: wasteEvents.filter((e) => String(e.event_date) === yesterday).length,
    wastePreventableYesterday: round(
      wasteEvents.filter((e) => String(e.event_date) === yesterday && e.preventable).reduce((s, e) => s + num(e.cost), 0),
      2,
    ),
    staffOnShiftToday,
    staffTotal: employees.length,
    labourCostToday: round(labourCostToday, 2),
    // Labour % uses today's sales when there are any, else yesterday's — the
    // morning brief is read before the day has traded.
    labourPctOfSales:
      salesToday > 0
        ? round((labourCostToday / salesToday) * 100, 1)
        : salesYesterday > 0
          ? round((labourCostToday / salesYesterday) * 100, 1)
          : null,
    stockAlerts: stockAlerts.slice(0, 6),
    supplierRisks,
    docsExpiring,
  };

  // -- Series --------------------------------------------------------------
  const salesSeries = seriesFrom(salesByDay, windowStart, today);
  const wasteSeries = seriesFrom(wasteByDay, windowStart, today);

  // -- Week-on-week windows ------------------------------------------------
  const last7From = dayOffset(now, -7);
  const prior7From = dayOffset(now, -14);
  const prior7To = dayOffset(now, -8);
  const sales7 = sumRange(salesByDay, last7From, today);
  const salesPrior7 = sumRange(salesByDay, prior7From, prior7To);
  const waste7 = sumRange(wasteByDay, last7From, today);
  const wastePrior7 = sumRange(wasteByDay, prior7From, prior7To);

  // -- Margin vs target ----------------------------------------------------
  const targetMargin = targetRow?.target_margin_pct != null ? num(targetRow.target_margin_pct) : DEFAULT_TARGET_MARGIN_PCT;
  const actualMargin = costableRevenue > 0 ? ((costableRevenue - costOfSales) / costableRevenue) * 100 : null;
  const marginGap = actualMargin != null ? actualMargin - targetMargin : null;

  // -- Derived insights ----------------------------------------------------
  const derived: GenInsight[] = [];
  const push = (i: Omit<GenInsight, 'origin'>) => derived.push({ ...i, origin: 'derived' });

  const salesDelta = pctChange(salesPrior7, sales7);
  if (salesDelta != null) {
    push({
      id: 'd:sales-wow',
      sourceModule: 'orderflow',
      severity: salesDelta >= 0 ? 'positive' : 'warning',
      text: `Sales are ${signedPct(salesDelta)} week-on-week — ${zar(sales7)} over the last 7 days against ${zar(salesPrior7)} the week before.`,
      metricLabel: 'Last 7 days',
      metricValue: zar(sales7),
      isAnomaly: false,
    });
  } else if (sales7 > 0) {
    push({
      id: 'd:sales-wow',
      sourceModule: 'orderflow',
      severity: 'info',
      text: `${zar(sales7)} in realized sales over the last 7 days. No prior week to compare against yet.`,
      metricLabel: 'Last 7 days',
      metricValue: zar(sales7),
      isAnomaly: false,
    });
  }

  if (actualMargin != null) {
    push({
      id: 'd:margin',
      sourceModule: 'pricepilot',
      severity: marginGap != null && marginGap < -MARGIN_WARN_PP ? 'warning' : 'positive',
      text: `Realized gross margin is ${round(actualMargin, 1)}% against a ${round(targetMargin, 1)}% target, measured on ${zar(costableRevenue)} of sales with a known unit cost.`,
      metricLabel: 'Gross margin',
      metricValue: `${round(actualMargin, 1)}%`,
      isAnomaly: false,
    });
  }

  const wasteDelta = pctChange(wastePrior7, waste7);
  if (waste7 > 0) {
    push({
      id: 'd:waste-wow',
      sourceModule: 'wastewatch',
      severity: wasteDelta != null && wasteDelta > WASTE_SPIKE_WARN_PCT ? 'warning' : 'info',
      text:
        wasteDelta != null
          ? `Waste logged ${zar(waste7)} in the last 7 days, ${signedPct(wasteDelta)} on the week before.`
          : `Waste logged ${zar(waste7)} in the last 7 days.`,
      metricLabel: 'Waste (7d)',
      metricValue: zar(waste7),
      isAnomaly: false,
    });
    const topReason = [...wasteByReason.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topReason) {
      push({
        id: 'd:waste-reason',
        sourceModule: 'wastewatch',
        severity: 'info',
        text: `“${topReason[0]}” is the biggest waste reason over ${WINDOW_DAYS} days at ${zar(topReason[1])} — ${round((topReason[1] / (wasteTotal || 1)) * 100, 0)}% of all logged waste.`,
        metricLabel: topReason[0],
        metricValue: zar(topReason[1]),
        isAnomaly: false,
      });
    }
    if (realizedRevenue > 0) {
      // The waste-in-margin loop: what logged waste costs as a share of the
      // revenue actually taken over the same window.
      const sharePct = (wasteTotal / realizedRevenue) * 100;
      push({
        id: 'd:waste-share',
        sourceModule: 'wastewatch',
        severity: sharePct > 5 ? 'warning' : 'info',
        text: `Logged waste is ${round(sharePct, 1)}% of the ${zar(realizedRevenue)} taken over the last ${WINDOW_DAYS} days.`,
        metricLabel: 'Waste vs revenue',
        metricValue: `${round(sharePct, 1)}%`,
        isAnomaly: false,
      });
    }
    if (wasteTotal > 0) {
      push({
        id: 'd:waste-preventable',
        sourceModule: 'wastewatch',
        severity: wastePreventable / wasteTotal > 0.5 ? 'warning' : 'positive',
        text: `${round((wastePreventable / wasteTotal) * 100, 0)}% of logged waste is marked preventable — ${zar(wastePreventable)} of ${zar(wasteTotal)} over ${WINDOW_DAYS} days.`,
        metricLabel: 'Preventable',
        metricValue: zar(wastePreventable),
        isAnomaly: false,
      });
    }
  }

  if (labourCostToday > 0) {
    push({
      id: 'd:labour',
      sourceModule: 'shiftboard',
      severity: brief.labourPctOfSales != null && brief.labourPctOfSales > LABOUR_WARN_PCT ? 'warning' : 'info',
      text:
        brief.labourPctOfSales != null
          ? `Today's labour is ${zar(labourCostToday)} across ${staffOnShiftToday} on shift — ${brief.labourPctOfSales}% of sales.`
          : `Today's labour is ${zar(labourCostToday)} across ${staffOnShiftToday} on shift. No sales recorded yet to measure it against.`,
      metricLabel: 'Labour today',
      metricValue: zar(labourCostToday),
      isAnomaly: false,
    });
  }

  if (stockAlerts.length > 0) {
    push({
      id: 'd:stock',
      sourceModule: 'procurepulse',
      severity: stockAlerts.length >= 5 ? 'warning' : 'info',
      text: `${stockAlerts.length} product${stockAlerts.length === 1 ? ' is' : 's are'} at or below the low-stock threshold, starting with ${stockAlerts[0].name}.`,
      metricLabel: 'Below threshold',
      metricValue: String(stockAlerts.length),
      isAnomaly: false,
    });
  }

  if (openRisks.length > 0 || docsExpiring > 0) {
    push({
      id: 'd:supply',
      sourceModule: 'supplysync',
      severity: openRisks.some((r) => r.severity === 'critical' || r.severity === 'high') ? 'warning' : 'info',
      text: `${openRisks.length} open supplier risk${openRisks.length === 1 ? '' : 's'}${docsExpiring > 0 ? ` and ${docsExpiring} compliance document${docsExpiring === 1 ? '' : 's'} to action` : ''}.`,
      metricLabel: 'Open risks',
      metricValue: String(openRisks.length),
      isAnomaly: false,
    });
  }

  // -- Anomalies (rule-based, each carries the rule that fired it) ----------
  const anomalies: Anomaly[] = [];
  const addAnomaly = (a: Omit<Anomaly, 'id' | 'acknowledged'>) => {
    anomalies.push({ ...a, id: a.key, acknowledged: ackedKeys.has(a.key) });
  };

  if (marginGap != null && marginGap < -MARGIN_WARN_PP) {
    addAnomaly({
      key: 'food-cost-variance',
      module: 'pricepilot',
      severity: marginGap < -MARGIN_CRITICAL_PP ? 'critical' : 'warning',
      title: 'Food-cost variance against target',
      detail: `Realized gross margin of ${round(actualMargin as number, 1)}% is ${round(Math.abs(marginGap), 1)} points below the ${round(targetMargin, 1)}% target on ${zar(costableRevenue)} of costed sales.`,
      metricLabel: 'Margin gap',
      metricValue: `${round(marginGap, 1)} pts`,
      rule: `Fires when realized margin sits more than ${MARGIN_WARN_PP} points below pl_targets.target_margin_pct (critical past ${MARGIN_CRITICAL_PP}). Cost comes from pp_stock_items.avg_unit_price on lines that carry a stock link.`,
    });
  }

  for (const p of pricing) {
    const prev = num(p.previous_price);
    const cur = num(p.current_price);
    const change = pctChange(prev, cur);
    if (change == null || change < PRICE_JUMP_WARN_PCT) continue;
    addAnomaly({
      key: `supplier-price:${p.id}`,
      module: 'supplysync',
      severity: change >= PRICE_JUMP_CRITICAL_PCT ? 'critical' : 'warning',
      title: `${supplierName.get(String(p.supplier_id)) ?? 'Supplier'} raised ${p.item}`,
      detail: `${p.item} moved from ${zar(prev)} to ${zar(cur)} per ${p.unit ?? 'unit'} — ${signedPct(change)}${p.market_avg ? `, against a market average of ${zar(num(p.market_avg))}` : ''}.`,
      metricLabel: 'Price move',
      metricValue: signedPct(change),
      rule: `Fires on any ss_supplier_pricing row where current_price is ${PRICE_JUMP_WARN_PCT}% or more above previous_price (critical at ${PRICE_JUMP_CRITICAL_PCT}%).`,
    });
  }

  if (brief.labourPctOfSales != null && brief.labourPctOfSales > LABOUR_WARN_PCT) {
    addAnomaly({
      key: 'labour-pct-spike',
      module: 'shiftboard',
      severity: brief.labourPctOfSales > LABOUR_CRITICAL_PCT ? 'critical' : 'warning',
      title: 'Labour running high against sales',
      detail: `${zar(labourCostToday)} of labour against ${zar(salesToday > 0 ? salesToday : salesYesterday)} of sales — ${brief.labourPctOfSales}% of revenue, across ${staffOnShiftToday} people on shift.`,
      metricLabel: 'Labour %',
      metricValue: `${brief.labourPctOfSales}%`,
      rule: `Fires when (Σ sb_attendance.hours_worked × sb_employees.rate) exceeds ${LABOUR_WARN_PCT}% of same-day of_orders revenue (critical past ${LABOUR_CRITICAL_PCT}%).`,
    });
  }

  if (wasteDelta != null && wasteDelta > WASTE_SPIKE_WARN_PCT) {
    addAnomaly({
      key: 'waste-spike',
      module: 'wastewatch',
      severity: wasteDelta > WASTE_SPIKE_CRITICAL_PCT ? 'critical' : 'warning',
      title: 'Waste spiked week-on-week',
      detail: `${zar(waste7)} logged in the last 7 days against ${zar(wastePrior7)} the week before — ${signedPct(wasteDelta)}.`,
      metricLabel: 'Waste change',
      metricValue: signedPct(wasteDelta),
      rule: `Fires when ww_waste_events cost for the last 7 days is more than ${WASTE_SPIKE_WARN_PCT}% above the previous 7 days (critical past ${WASTE_SPIKE_CRITICAL_PCT}%).`,
    });
  }

  for (const s of stockAlerts.slice(0, 5)) {
    addAnomaly({
      key: `stock-low:${s.id}`,
      module: 'procurepulse',
      severity: s.onHand <= 0 ? 'critical' : 'warning',
      title: `${s.name} ${s.onHand <= 0 ? 'is out of stock' : 'is below its threshold'}`,
      detail: `${round(s.onHand, 2)} ${s.unit} on hand against a low threshold of ${round(s.threshold, 2)} ${s.unit}.`,
      metricLabel: 'On hand',
      metricValue: `${round(s.onHand, 2)} ${s.unit}`,
      rule: `Fires when pp_stock_items.on_hand is at or below its low threshold (pp_stock_thresholds.low_threshold where set, otherwise the item's own low_threshold).`,
    });
  }

  for (const r of openRisks.filter((x) => x.severity === 'critical' || x.severity === 'high').slice(0, 5)) {
    addAnomaly({
      key: `supplier-risk:${r.id}`,
      module: 'supplysync',
      severity: r.severity === 'critical' ? 'critical' : 'warning',
      title: `${supplierName.get(String(r.supplier_id)) ?? 'Supplier'} — ${r.risk_type}`,
      detail: String(r.description || r.suggested_action || 'Open risk on the supplier register.'),
      metricLabel: 'Severity',
      metricValue: String(r.severity ?? ''),
      rule: 'Fires on any open or in-progress ss_supplier_risks row logged at high or critical severity.',
    });
  }

  anomalies.sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged) || severityWeight(b.severity) - severityWeight(a.severity));

  // Anomalies also read as insights, so the feed matches the anomaly tab.
  for (const a of anomalies) {
    if (a.acknowledged) continue;
    derived.push({
      id: `d:anom:${a.key}`,
      sourceModule: a.module,
      severity: a.severity,
      text: `${a.title} — ${a.detail}`,
      metricLabel: a.metricLabel,
      metricValue: a.metricValue,
      isAnomaly: true,
      origin: 'derived',
    });
  }

  // -- Report datasets -----------------------------------------------------
  const datasets: ReportDataset[] = [
    {
      key: 'sales',
      module: 'orderflow',
      label: 'Sales lines',
      description: 'Every line on a non-draft order in the window, with its line total.',
      columns: ['Date', 'Order', 'Status', 'Item', 'Qty', 'Unit', 'Unit price', 'Line total'],
      rows: salesRows,
    },
    {
      key: 'waste',
      module: 'wastewatch',
      label: 'Waste events',
      description: 'Each logged waste event with cost, reason and whether it was preventable.',
      columns: ['Date', 'Item', 'Category', 'Qty', 'Unit', 'Cost', 'Reason', 'Logged by', 'Preventable'],
      rows: wasteRows,
    },
    {
      key: 'labour',
      module: 'shiftboard',
      label: 'Labour (today)',
      description: 'Today’s attendance with hours, overtime and cost at each employee’s rate.',
      columns: ['Employee', 'Department', 'Scheduled', 'Clock in', 'Clock out', 'Hours', 'Status', 'Overtime', 'Rate', 'Cost'],
      rows: labourRows,
    },
    {
      key: 'stock',
      module: 'procurepulse',
      label: 'Stock levels',
      description: 'Current on-hand against the low threshold, with average unit price.',
      columns: ['Product', 'Category', 'Unit', 'On hand', 'Low threshold', 'Avg unit price', 'Trend %', 'Cheapest supplier'],
      rows: stockRows,
    },
    {
      key: 'suppliers',
      module: 'supplysync',
      label: 'Suppliers',
      description: 'The supplier base with status, risk band, on-time delivery and month-to-date spend.',
      columns: ['Supplier', 'Category', 'Status', 'Risk', 'On-time %', 'Spend MTD', 'Price trend', 'Last order'],
      rows: supplierRows,
    },
  ];

  // -- Sources -------------------------------------------------------------
  const sourceCounts: [VysoModuleKey, number][] = [
    ['orderflow', orders.length],
    ['wastewatch', wasteEvents.length],
    ['shiftboard', employees.length],
    ['procurepulse', stockItems.length],
    ['supplysync', suppliers.length],
    ['pricepilot', costByItem.size],
    ['planwise', targetRow ? 1 : 0],
  ];
  const sources: ModuleSource[] = sourceCounts.map(([key, count]) => ({
    key,
    label: MODULE_LABEL[key],
    rows: count,
    connected: count > 0,
  }));

  const seeded = mapInsights(insRes.data);
  const hasData = sources.some((s) => s.connected) || seeded.length > 0;

  return {
    seeded,
    derived,
    insights: [...derived, ...seeded],
    reports: mapReports(repRes.data, runByReport),
    brief,
    anomalies,
    datasets,
    sources,
    salesSeries,
    wasteSeries,
    generatedAt: now.toISOString(),
    windowDays: WINDOW_DAYS,
    hasData,
  };
}

// ---------------------------------------------------------------------------
// Local helpers used above
// ---------------------------------------------------------------------------

function severityRank(s: string): number {
  return s === 'critical' ? 4 : s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}
function severityWeight(s: InsightSeverity): number {
  return s === 'critical' ? 4 : s === 'warning' ? 3 : s === 'info' ? 2 : 1;
}

/** Dense day series between two ISO days, filling gaps with 0. */
function seriesFrom(map: Map<string, number>, from: string, to: string): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return out;
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = isoDay(d);
    out.push({ date: key, value: round(map.get(key) ?? 0, 2) });
  }
  return out;
}
