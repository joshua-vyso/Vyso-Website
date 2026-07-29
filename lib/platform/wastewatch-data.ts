/**
 * WasteWatch data access — fetches the org's waste data from Supabase
 * (ww_waste_categories, ww_waste_events, ww_devices) and derives EVERY aggregate
 * from the events at read time, so nothing on screen can drift from the log:
 *
 *  - category cost / pct / trend are recomputed from ww_waste_events (the stored
 *    ww_waste_categories columns are only a fallback for categories with no events),
 *  - the cost timeline, the service heatmap and the day-of-week patterns are
 *    bucketed straight out of the events,
 *  - "waste as % of food cost" closes the waste-in-margin loop by dividing the
 *    waste rate by a real food-cost rate (purchases, else sales × cost-of-goods),
 *  - the weekly report, over-portion stats and coaching notes come from the
 *    reason codes and the recipe expectedQty vs qty already modelled on the event.
 *
 * Org-scoped by RLS; empty collections for unseeded orgs → clean empty states.
 *
 * Windows are anchored to the most recent LOGGED event, not to "today" — a log
 * that went quiet last week should still show last week's week, flagged stale,
 * rather than an empty screen.
 */

import { createServerSupabase } from './supabase-server';
import {
  COST_TIMELINE,
  HEATMAP,
  HEATMAP_DAYS,
  type WasteWatchData,
  type WasteCategoryRow,
  type WasteEvent,
  type WasteReason,
  type Device,
  type EmployeeStat,
  type RecipeStat,
  type TimePeriod,
  type FoodCostContext,
  type WeeklyReport,
  type CausePattern,
  type WasteItemStat,
  type OverPortionStat,
  type CoachingNote,
  type DayPattern,
} from './wastewatch';

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function arr<T = unknown>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

const DAY_MS = 86_400_000;
/** Reason codes that stem from a controllable process rather than natural spoilage. */
const PREVENTABLE_REASONS = new Set<WasteReason>(['Over-portioned', 'Prep error', 'Damaged']);
/** How far back the food-cost denominator looks (purchases / sales are "now"-relative). */
const FOOD_COST_WINDOW_DAYS = 30;
/** Order statuses that represent real sales (drafts are not revenue yet). */
const SOLD_STATUSES = ['confirmed', 'invoiced', 'partially_paid', 'paid'];
/** Caps on the revenue lookup — a denominator, not a report; it does not need every row. */
const ORDER_FETCH_LIMIT = 2000;
const ORDER_ID_CHUNK = 150;

const EMPTY_TIMELINE: Record<TimePeriod, number[]> = COST_TIMELINE;
const EMPTY_DELTA: Record<TimePeriod, number | null> = { today: null, week: null, month: null, quarter: null, year: null };

export const EMPTY_WASTEWATCH: WasteWatchData = {
  categories: [],
  events: [],
  devices: [],
  employeeStats: [],
  recipeStats: [],
  preventable: { preventable: 0, unavoidable: 0 },
  timeline: EMPTY_TIMELINE,
  timelineDelta: EMPTY_DELTA,
  timelineDerived: false,
  foodCost: {
    basis: 'none',
    basisLabel: 'No purchase or sales data yet',
    wastePerDay: 0,
    foodCostPerDay: 0,
    pct: null,
    wasteDays: 0,
    foodCostDays: 0,
    revenue: 0,
    cogsPct: null,
    annualised: 0,
  },
  weekly: null,
  overPortion: [],
  coaching: [],
  dayPatterns: [],
  serviceHeatmap: HEATMAP,
  heatmapDerived: false,
};

// ---------------------------------------------------------------------------
// Date helpers — event dates are plain 'YYYY-MM-DD', so everything stays in UTC
// to avoid a timezone shifting an event into the wrong day/bucket.
// ---------------------------------------------------------------------------

function parseIso(iso: string): number | null {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) ? t : null;
}
function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function shiftIso(iso: string, days: number): string {
  const t = parseIso(iso);
  return t == null ? iso : isoOf(t + days * DAY_MS);
}
function daysBetween(fromIso: string, toIso: string): number {
  const a = parseIso(fromIso);
  const b = parseIso(toIso);
  if (a == null || b == null) return 0;
  return Math.round((b - a) / DAY_MS);
}
/** Mon=0 … Sun=6, matching HEATMAP_DAYS. */
function weekdayIndex(iso: string): number | null {
  const t = parseIso(iso);
  if (t == null) return null;
  return (new Date(t).getUTCDay() + 6) % 7;
}
/** Minutes since midnight from a 'HH:MM' event_time; null when unparseable. */
function minutesOf(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  return h * 60 + mi;
}
function monthKeysEnding(anchorIso: string, count: number): string[] {
  const t = parseIso(anchorIso);
  if (t == null) return [];
  const d = new Date(t);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    keys.push(m.toISOString().slice(0, 7));
  }
  return keys;
}
function round(n: number): number {
  return Math.round(n);
}
function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function getWasteWatchData(orgId: string): Promise<WasteWatchData> {
  const sb = await createServerSupabase();
  const [cat, ev, dev] = await Promise.all([
    sb.from('ww_waste_categories').select('*').eq('org_id', orgId).order('sort_order'),
    sb.from('ww_waste_events').select('*').eq('org_id', orgId).order('event_date', { ascending: false }),
    sb.from('ww_devices').select('*').eq('org_id', orgId).order('name'),
  ]);

  const storedCategories: WasteCategoryRow[] = ((cat.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? '#8A8E86',
    cost: num(r.cost),
    pct: num(r.pct),
    trend: arr<number>(r.trend).map((n) => num(n)),
  }));

  const events: WasteEvent[] = ((ev.data as any[]) ?? []).map((r) => ({
    id: r.id,
    date: r.event_date ?? '',
    time: r.event_time ?? '',
    item: r.item ?? '',
    category: r.category ?? '',
    qty: num(r.qty),
    unit: r.unit ?? '',
    cost: num(r.cost),
    reason: r.reason ?? 'Other',
    recipe: r.recipe ?? null,
    employee: r.employee ?? '',
    device: r.device ?? '',
    location: r.location ?? '',
    preventable: !!r.preventable,
    notes: r.notes ?? undefined,
    ingredient: r.ingredient ?? undefined,
    supplier: r.supplier ?? undefined,
    batch: r.batch ?? undefined,
    expectedQty: r.expected_qty != null ? num(r.expected_qty) : undefined,
  }));

  const devices: Device[] = ((dev.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    location: r.location ?? '',
    status: r.status ?? 'offline',
    battery: r.battery != null ? num(r.battery) : null,
    lastSync: r.last_sync ?? '',
    firmware: r.firmware ?? '',
    calibration: r.calibration ?? '',
    eventsToday: num(r.events_today),
    currentUser: r.current_operator ?? null,
    currentRecipe: r.current_recipe ?? null,
    measurements: arr(r.measurements),
    history: arr(r.history),
  }));

  // Windows anchor to the newest logged event so a quiet log still reports.
  const dated = events.filter((e) => parseIso(e.date) != null);
  const anchor = dated.length ? dated.map((e) => e.date).sort().slice(-1)[0] : null;
  const earliest = dated.length ? dated.map((e) => e.date).sort()[0] : null;

  const categories = recomputeCategories(storedCategories, events, anchor);
  const { timeline, timelineDelta, timelineDerived } = buildTimeline(events, anchor);
  const { serviceHeatmap, heatmapDerived } = buildServiceHeatmap(events);
  const foodCost = await deriveFoodCost(sb, orgId, events, anchor, earliest);

  return {
    categories,
    events,
    devices,
    ...deriveAggregates(events),
    timeline,
    timelineDelta,
    timelineDerived,
    foodCost,
    weekly: buildWeeklyReport(events, anchor),
    overPortion: deriveOverPortion(events),
    coaching: deriveCoaching(events),
    dayPatterns: deriveDayPatterns(events),
    serviceHeatmap,
    heatmapDerived,
  };
}

// ---------------------------------------------------------------------------
// Category recompute — the fix for aggregate drift
// ---------------------------------------------------------------------------

/**
 * Recompute each category's cost / pct / trend from the events. Stored columns
 * survive only where events say nothing (a category with no waste logged yet),
 * and categories that appear in the log but no longer exist as rows are
 * synthesised so the donut always sums to the log's total.
 */
function recomputeCategories(stored: WasteCategoryRow[], events: WasteEvent[], anchor: string | null): WasteCategoryRow[] {
  if (events.length === 0) return stored;

  const costByName = new Map<string, number>();
  for (const e of events) {
    if (!e.category) continue;
    costByName.set(e.category, (costByName.get(e.category) ?? 0) + e.cost);
  }
  const total = [...costByName.values()].reduce((s, n) => s + n, 0);

  // 7-point daily trend per category, ending at the anchor day.
  const trendDays = anchor ? Array.from({ length: 7 }, (_, i) => shiftIso(anchor, i - 6)) : [];
  const trendByName = new Map<string, number[]>();
  if (trendDays.length) {
    const index = new Map(trendDays.map((d, i) => [d, i]));
    for (const e of events) {
      const i = index.get(e.date);
      if (i == null || !e.category) continue;
      const series = trendByName.get(e.category) ?? new Array(7).fill(0);
      series[i] += e.cost;
      trendByName.set(e.category, series);
    }
  }

  const trendFor = (name: string, fallback: number[]): number[] => {
    const series = trendByName.get(name);
    if (!series || series.every((n) => n === 0)) return fallback;
    return series.map(round);
  };

  const rows: WasteCategoryRow[] = stored.map((c) => {
    const measured = costByName.get(c.name);
    // No events for this category → keep whatever the stored columns claim.
    if (measured == null) return { ...c, trend: trendFor(c.name, c.trend) };
    return { ...c, cost: round(measured), pct: pctOf(measured, total), trend: trendFor(c.name, c.trend) };
  });

  const known = new Set(stored.map((c) => c.name));
  for (const [name, cost] of costByName) {
    if (known.has(name)) continue;
    rows.push({
      id: `derived:${name}`,
      name,
      color: '#8A8E86',
      cost: round(cost),
      pct: pctOf(cost, total),
      trend: trendFor(name, []),
      derived: true,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Cost timeline — bucketed from the events, illustrative constant as fallback
// ---------------------------------------------------------------------------

function sumBetween(events: WasteEvent[], startIso: string, endIso: string): number {
  let total = 0;
  for (const e of events) if (e.date >= startIso && e.date <= endIso) total += e.cost;
  return total;
}

function buildTimeline(events: WasteEvent[], anchor: string | null): {
  timeline: Record<TimePeriod, number[]>;
  timelineDelta: Record<TimePeriod, number | null>;
  timelineDerived: boolean;
} {
  if (!anchor || events.length === 0) return { timeline: EMPTY_TIMELINE, timelineDelta: EMPTY_DELTA, timelineDerived: false };

  // Today → eight 3-hour buckets across the anchor day.
  const today = new Array(8).fill(0);
  for (const e of events) {
    if (e.date !== anchor) continue;
    const mins = minutesOf(e.time);
    const slot = mins == null ? 7 : Math.min(7, Math.floor(mins / 180));
    today[slot] += e.cost;
  }

  const dailySeries = (endIso: string, days: number) => {
    const out = new Array(days).fill(0);
    const index = new Map(Array.from({ length: days }, (_, i) => [shiftIso(endIso, i - (days - 1)), i]));
    for (const e of events) {
      const i = index.get(e.date);
      if (i != null) out[i] += e.cost;
    }
    return out;
  };
  const week = dailySeries(anchor, 7);

  // Month → six weekly totals ending at the anchor week.
  const month = Array.from({ length: 6 }, (_, i) => {
    const end = shiftIso(anchor, -7 * (5 - i));
    return sumBetween(events, shiftIso(end, -6), end);
  });

  const monthlyTotals = (keys: string[]) => {
    const byMonth = new Map<string, number>();
    for (const e of events) {
      const k = e.date.slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + e.cost);
    }
    return keys.map((k) => byMonth.get(k) ?? 0);
  };
  const quarter = monthlyTotals(monthKeysEnding(anchor, 3));
  const year = monthlyTotals(monthKeysEnding(anchor, 12));

  const derived: Record<TimePeriod, number[]> = {
    today: today.map(round),
    week: week.map(round),
    month: month.map(round),
    quarter: quarter.map(round),
    year: year.map(round),
  };

  const delta = (currStart: string, currEnd: string, prevStart: string, prevEnd: string): number | null => {
    const prev = sumBetween(events, prevStart, prevEnd);
    if (prev <= 0) return null;
    const curr = sumBetween(events, currStart, currEnd);
    return Math.round(((curr - prev) / prev) * 100);
  };

  const timelineDelta: Record<TimePeriod, number | null> = {
    today: delta(anchor, anchor, shiftIso(anchor, -1), shiftIso(anchor, -1)),
    week: delta(shiftIso(anchor, -6), anchor, shiftIso(anchor, -13), shiftIso(anchor, -7)),
    month: delta(shiftIso(anchor, -29), anchor, shiftIso(anchor, -59), shiftIso(anchor, -30)),
    quarter: delta(shiftIso(anchor, -89), anchor, shiftIso(anchor, -179), shiftIso(anchor, -90)),
    year: delta(shiftIso(anchor, -364), anchor, shiftIso(anchor, -729), shiftIso(anchor, -365)),
  };

  // A series that is entirely zero says nothing — fall back to the illustrative one.
  const timeline = { ...derived };
  let anyDerived = false;
  for (const key of Object.keys(derived) as TimePeriod[]) {
    if (derived[key].some((n) => n > 0)) anyDerived = true;
    else timeline[key] = COST_TIMELINE[key];
  }

  return { timeline, timelineDelta, timelineDerived: anyDerived };
}

// ---------------------------------------------------------------------------
// Waste as % of food cost — the waste-in-margin loop
// ---------------------------------------------------------------------------

/**
 * Both sides are expressed as a RATE (rand per day) before dividing. Waste is
 * logged with its own dates while purchases/sales are "now"-relative, so
 * comparing raw window totals would compare two different calendars; comparing
 * daily rates is the honest way to line them up.
 */
async function deriveFoodCost(
  sb: Awaited<ReturnType<typeof createServerSupabase>>,
  orgId: string,
  events: WasteEvent[],
  anchor: string | null,
  earliest: string | null,
): Promise<FoodCostContext> {
  const none = EMPTY_WASTEWATCH.foodCost;
  if (!anchor || !earliest || events.length === 0) return none;

  const wasteStart = (() => {
    const capped = shiftIso(anchor, -(FOOD_COST_WINDOW_DAYS - 1));
    return capped > earliest ? capped : earliest;
  })();
  const wasteDays = Math.max(1, daysBetween(wasteStart, anchor) + 1);
  const wasteCost = sumBetween(events, wasteStart, anchor);
  const wastePerDay = wasteCost / wasteDays;
  if (wastePerDay <= 0) return none;

  const sinceIso = new Date(Date.now() - FOOD_COST_WINDOW_DAYS * DAY_MS).toISOString();

  // 1) Purchases are the truest food-cost denominator when the org records them.
  let purchases = 0;
  try {
    const { data } = await sb
      .from('pp_stock_orders')
      .select('total,status,created_at')
      .eq('org_id', orgId)
      .gte('created_at', sinceIso);
    for (const r of (data as any[]) ?? []) {
      if (String(r.status ?? '') === 'cancelled') continue;
      purchases += num(r.total);
    }
  } catch {
    purchases = 0;
  }

  if (purchases > 0) {
    const foodCostPerDay = purchases / FOOD_COST_WINDOW_DAYS;
    return {
      basis: 'purchases',
      basisLabel: `stock purchases over the last ${FOOD_COST_WINDOW_DAYS} days`,
      wastePerDay: round(wastePerDay),
      foodCostPerDay: round(foodCostPerDay),
      pct: Math.round((wastePerDay / foodCostPerDay) * 1000) / 10,
      wasteDays,
      foodCostDays: FOOD_COST_WINDOW_DAYS,
      revenue: 0,
      cogsPct: null,
      annualised: round(wastePerDay * 365),
    };
  }

  // 2) Otherwise: sales × the org's cost-of-goods ratio (100 − target margin).
  let revenue = 0;
  let cogsPct: number | null = null;
  try {
    const [ord, tgt] = await Promise.all([
      sb.from('of_orders').select('id,status,created_at').eq('org_id', orgId).gte('created_at', sinceIso).limit(ORDER_FETCH_LIMIT),
      sb.from('pl_targets').select('target_margin_pct').eq('org_id', orgId).maybeSingle(),
    ]);
    const ids = ((ord.data as any[]) ?? []).filter((o) => SOLD_STATUSES.includes(String(o.status ?? ''))).map((o) => o.id as string);
    // `in` becomes a query-string filter, so a month of orders is chunked to
    // keep every request URL comfortably inside the server's header limits.
    for (let i = 0; i < ids.length; i += ORDER_ID_CHUNK) {
      const { data: items } = await sb.from('of_order_items').select('qty,unit_price,order_id').eq('org_id', orgId).in('order_id', ids.slice(i, i + ORDER_ID_CHUNK));
      for (const r of (items as any[]) ?? []) revenue += num(r.qty) * num(r.unit_price);
    }
    const margin = (tgt.data as any)?.target_margin_pct;
    if (margin != null && Number.isFinite(Number(margin))) {
      const m = Number(margin);
      if (m > 0 && m < 100) cogsPct = 100 - m;
    }
  } catch {
    revenue = 0;
  }

  if (revenue > 0 && cogsPct != null) {
    const foodCostPerDay = (revenue * (cogsPct / 100)) / FOOD_COST_WINDOW_DAYS;
    if (foodCostPerDay > 0) {
      return {
        basis: 'revenue',
        basisLabel: `sales over the last ${FOOD_COST_WINDOW_DAYS} days × ${Math.round(cogsPct)}% cost of goods`,
        wastePerDay: round(wastePerDay),
        foodCostPerDay: round(foodCostPerDay),
        pct: Math.round((wastePerDay / foodCostPerDay) * 1000) / 10,
        wasteDays,
        foodCostDays: FOOD_COST_WINDOW_DAYS,
        revenue: round(revenue),
        cogsPct: Math.round(cogsPct),
        annualised: round(wastePerDay * 365),
      };
    }
  }

  return {
    ...none,
    wastePerDay: round(wastePerDay),
    wasteDays,
    annualised: round(wastePerDay * 365),
    basisLabel: 'Add stock purchases, or a target margin in PricePilot, to see waste as a % of food cost',
  };
}

// ---------------------------------------------------------------------------
// Weekly waste report (Overview)
// ---------------------------------------------------------------------------

function buildWeeklyReport(events: WasteEvent[], anchor: string | null): WeeklyReport | null {
  if (!anchor || events.length === 0) return null;

  const start = shiftIso(anchor, -6);
  const inWeek = events.filter((e) => e.date >= start && e.date <= anchor);
  if (inWeek.length === 0) return null;

  const total = inWeek.reduce((s, e) => s + e.cost, 0);
  const preventable = inWeek.filter((e) => e.preventable).reduce((s, e) => s + e.cost, 0);
  const prevTotal = sumBetween(events, shiftIso(anchor, -13), shiftIso(anchor, -7));

  // Causes by reason code.
  const byReason = new Map<WasteReason, { cost: number; events: number; preventable: number }>();
  for (const e of inWeek) {
    const cur = byReason.get(e.reason) ?? { cost: 0, events: 0, preventable: 0 };
    cur.cost += e.cost;
    cur.events += 1;
    if (e.preventable) cur.preventable += 1;
    byReason.set(e.reason, cur);
  }
  const topCauses: CausePattern[] = [...byReason.entries()]
    .map(([reason, v]) => ({
      reason,
      cost: round(v.cost),
      events: v.events,
      pct: pctOf(v.cost, total),
      // Preventable if the log says so for most of them, or the reason code implies it.
      preventable: v.preventable * 2 >= v.events || PREVENTABLE_REASONS.has(reason),
    }))
    // Preventable causes are the actionable ones, so they lead.
    .sort((a, b) => Number(b.preventable) - Number(a.preventable) || b.cost - a.cost)
    .slice(0, 5);

  // Items by cost, each with its dominant reason.
  const byItem = new Map<string, { cost: number; events: number; reasons: Map<WasteReason, number> }>();
  for (const e of inWeek) {
    if (!e.item) continue;
    const cur = byItem.get(e.item) ?? { cost: 0, events: 0, reasons: new Map<WasteReason, number>() };
    cur.cost += e.cost;
    cur.events += 1;
    cur.reasons.set(e.reason, (cur.reasons.get(e.reason) ?? 0) + e.cost);
    byItem.set(e.item, cur);
  }
  const topItems: WasteItemStat[] = [...byItem.entries()]
    .map(([item, v]) => ({
      item,
      cost: round(v.cost),
      events: v.events,
      topReason: [...v.reasons.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  // Plain-language next steps, only where the data actually supports one.
  const actions: string[] = [];
  const topPreventable = topCauses.find((c) => c.preventable && c.cost > 0);
  if (topPreventable) {
    actions.push(`“${topPreventable.reason}” is the biggest preventable cause this week at R ${topPreventable.cost.toLocaleString('en-US').replace(/,/g, ' ')} (${topPreventable.pct}% of waste) across ${topPreventable.events} event${topPreventable.events === 1 ? '' : 's'}.`);
  }
  const worstOverPortion = deriveOverPortion(inWeek)[0];
  if (worstOverPortion) {
    actions.push(`${worstOverPortion.recipe} ran ${worstOverPortion.overPct}% over its recipe quantity — tightening the portion spec is worth about R ${worstOverPortion.excessCost.toLocaleString('en-US').replace(/,/g, ' ')} a week.`);
  }
  const spoiledItem = topItems.find((i) => i.topReason === 'Spoiled' || i.topReason === 'Expired' || i.topReason === 'Wilted');
  if (spoiledItem) {
    actions.push(`${spoiledItem.item} spoiled ${spoiledItem.events} time${spoiledItem.events === 1 ? '' : 's'} (R ${spoiledItem.cost.toLocaleString('en-US').replace(/,/g, ' ')}) — trim the next order or move it to faster rotation.`);
  }
  if (actions.length === 0) actions.push('No single cause stands out this week — keep logging and WasteWatch will surface the pattern.');

  const todayIso = new Date().toISOString().slice(0, 10);

  return {
    start,
    end: anchor,
    stale: daysBetween(anchor, todayIso) > 1,
    total: round(total),
    events: inWeek.length,
    preventable: round(preventable),
    preventablePct: pctOf(preventable, total),
    prevTotal: round(prevTotal),
    deltaPct: prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null,
    topCauses,
    topItems,
    actions,
  };
}

// ---------------------------------------------------------------------------
// Reason-code insights (Analytics)
// ---------------------------------------------------------------------------

/** Over-portioning, measured as actual qty vs the recipe's expected qty. */
function deriveOverPortion(events: WasteEvent[]): OverPortionStat[] {
  const map = new Map<string, { events: number; expected: number; actual: number; excess: number; overPcts: number[]; units: Map<string, number> }>();
  for (const e of events) {
    const expected = e.expectedQty;
    if (expected == null || expected <= 0 || e.qty <= expected) continue;
    const key = e.recipe ?? e.item;
    if (!key) continue;
    const cur = map.get(key) ?? { events: 0, expected: 0, actual: 0, excess: 0, overPcts: [], units: new Map<string, number>() };
    cur.events += 1;
    cur.expected += expected;
    cur.actual += e.qty;
    // Only the excess portion of the quantity carries a preventable cost.
    cur.excess += e.qty > 0 ? e.cost * ((e.qty - expected) / e.qty) : 0;
    cur.overPcts.push(((e.qty - expected) / expected) * 100);
    if (e.unit) cur.units.set(e.unit, (cur.units.get(e.unit) ?? 0) + 1);
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([recipe, v]) => ({
      recipe,
      events: v.events,
      expectedQty: Math.round(v.expected * 10) / 10,
      actualQty: Math.round(v.actual * 10) / 10,
      overPct: Math.round(v.overPcts.reduce((s, n) => s + n, 0) / v.overPcts.length),
      excessCost: round(v.excess),
      unit: [...v.units.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
    }))
    .sort((a, b) => b.excessCost - a.excessCost);
}

/**
 * Coaching list. Deliberately constructive: everyone gets a note framed as
 * support, and people below the team average are called out as doing well —
 * a waste leaderboard that only names the worst offenders stops being used.
 */
function deriveCoaching(events: WasteEvent[]): CoachingNote[] {
  const map = new Map<string, { total: number; preventable: number; events: number; reasons: Map<WasteReason, number> }>();
  for (const e of events) {
    if (!e.employee) continue;
    const cur = map.get(e.employee) ?? { total: 0, preventable: 0, events: 0, reasons: new Map<WasteReason, number>() };
    cur.total += e.cost;
    cur.events += 1;
    if (e.preventable) {
      cur.preventable += e.cost;
      cur.reasons.set(e.reason, (cur.reasons.get(e.reason) ?? 0) + e.cost);
    }
    map.set(e.employee, cur);
  }
  if (map.size === 0) return [];

  const list = [...map.entries()];
  const teamAvg = list.reduce((s, [, v]) => s + v.total, 0) / list.length;

  return list
    .map(([name, v]) => {
      const vsTeamPct = teamAvg > 0 ? Math.round(((v.total - teamAvg) / teamAvg) * 100) : 0;
      const topReason = [...v.reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const preventableShare = pctOf(v.preventable, v.total);

      let tone: CoachingNote['tone'];
      let message: string;
      if (vsTeamPct <= -15) {
        tone = 'praise';
        message = `Running ${Math.abs(vsTeamPct)}% below the team average — worth asking what they do differently and sharing it.`;
      } else if (v.preventable > 0 && preventableShare >= 40 && vsTeamPct >= 10) {
        tone = 'coach';
        message = topReason
          ? `Most of their waste is preventable and traced to “${topReason}” — a 10-minute refresher on that step should move it.`
          : 'Most of their waste is preventable — a short refresher on prep technique should move it.';
      } else if (v.preventable > 0 && topReason) {
        tone = 'watch';
        message = `Mostly in line with the team; “${topReason}” shows up more than once — worth a quick word, not a process change.`;
      } else {
        tone = 'watch';
        message = 'Waste here is almost all unavoidable spoilage — this is a purchasing or storage question, not a technique one.';
      }

      return {
        name,
        events: v.events,
        preventableCost: round(v.preventable),
        totalCost: round(v.total),
        topReason,
        vsTeamPct,
        tone,
        message,
      };
    })
    .sort((a, b) => b.preventableCost - a.preventableCost || b.totalCost - a.totalCost);
}

function deriveDayPatterns(events: WasteEvent[]): DayPattern[] {
  const rows: DayPattern[] = HEATMAP_DAYS.map((day) => ({ day, cost: 0, events: 0, preventable: 0 }));
  let any = false;
  for (const e of events) {
    const i = weekdayIndex(e.date);
    if (i == null) continue;
    any = true;
    rows[i].cost += e.cost;
    rows[i].events += 1;
    if (e.preventable) rows[i].preventable += e.cost;
  }
  if (!any) return [];
  return rows.map((r) => ({ ...r, cost: round(r.cost), preventable: round(r.preventable) }));
}

/** Service period × weekday grid, scaled 0–100 so the existing heat shading works. */
const SERVICE_PERIODS: { label: string; endMinute: number }[] = [
  { label: 'Morning', endMinute: 11 * 60 },
  { label: 'Lunch', endMinute: 16 * 60 },
  { label: 'Dinner', endMinute: 24 * 60 },
];

function buildServiceHeatmap(events: WasteEvent[]): { serviceHeatmap: { period: string; values: number[] }[]; heatmapDerived: boolean } {
  const grid = SERVICE_PERIODS.map(() => new Array(7).fill(0));
  let any = false;
  for (const e of events) {
    const day = weekdayIndex(e.date);
    const mins = minutesOf(e.time);
    if (day == null || mins == null) continue;
    const row = SERVICE_PERIODS.findIndex((p) => mins < p.endMinute);
    if (row < 0) continue;
    grid[row][day] += e.cost;
    any = true;
  }
  if (!any) return { serviceHeatmap: HEATMAP, heatmapDerived: false };

  const max = Math.max(...grid.flat());
  if (max <= 0) return { serviceHeatmap: HEATMAP, heatmapDerived: false };

  return {
    serviceHeatmap: SERVICE_PERIODS.map((p, i) => ({ period: p.label, values: grid[i].map((v) => Math.round((v / max) * 100)) })),
    heatmapDerived: true,
  };
}

// ---------------------------------------------------------------------------
// Employee/recipe leaderboards + preventable split, computed from the events.
// ---------------------------------------------------------------------------

function deriveAggregates(events: WasteEvent[]): { employeeStats: EmployeeStat[]; recipeStats: RecipeStat[]; preventable: { preventable: number; unavoidable: number } } {
  // Employees
  const empMap = new Map<string, { cost: number; events: number }>();
  for (const e of events) {
    if (!e.employee) continue;
    const cur = empMap.get(e.employee) ?? { cost: 0, events: 0 };
    cur.cost += e.cost;
    cur.events += 1;
    empMap.set(e.employee, cur);
  }
  const empList = [...empMap.entries()].map(([name, v]) => ({ name, ...v }));
  const teamAvg = empList.length ? empList.reduce((s, e) => s + e.cost, 0) / empList.length : 0;
  const employeeStats: EmployeeStat[] = empList
    .sort((a, b) => b.cost - a.cost)
    .map((e) => {
      const vsTeamPct = teamAvg ? Math.round(((e.cost - teamAvg) / teamAvg) * 100) : 0;
      return { name: e.name, cost: Math.round(e.cost), events: e.events, trend: vsTeamPct > 10 ? 'up' : vsTeamPct < -10 ? 'down' : 'flat', vsTeamPct };
    });

  // Recipes
  const recMap = new Map<string, { cost: number; count: number; overPct: number[] }>();
  for (const e of events) {
    if (!e.recipe) continue;
    const cur = recMap.get(e.recipe) ?? { cost: 0, count: 0, overPct: [] };
    cur.cost += e.cost;
    cur.count += 1;
    if (e.expectedQty && e.expectedQty > 0) cur.overPct.push(Math.max(0, ((e.qty - e.expectedQty) / e.expectedQty) * 100));
    recMap.set(e.recipe, cur);
  }
  const recipeStats: RecipeStat[] = [...recMap.entries()]
    .map(([recipe, v]) => ({
      recipe,
      avgCost: Math.round(v.cost / v.count),
      frequency: v.count,
      wastePct: v.overPct.length ? Math.round(v.overPct.reduce((s, n) => s + n, 0) / v.overPct.length) : 12,
    }))
    .sort((a, b) => b.avgCost - a.avgCost);

  // Preventable split
  let preventable = 0;
  let unavoidable = 0;
  for (const e of events) (e.preventable ? (preventable += e.cost) : (unavoidable += e.cost));

  return { employeeStats, recipeStats, preventable: { preventable: Math.round(preventable), unavoidable: Math.round(unavoidable) } };
}
