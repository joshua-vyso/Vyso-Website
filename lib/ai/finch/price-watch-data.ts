/**
 * Price Watch reads for Finch's tools — "how has cooking oil moved this year?",
 * "who else supplies it?", "what is that increase costing me?"
 * (`.ai/plan_finch_read_tools_p12.md` §2, tools 1, 2 and 4).
 *
 * WHY NOTHING HERE COMPUTES A PRICE MOVE OF ITS OWN. The Brief already has a
 * card that says "Riebeek Oils & Fats cooking oil is up 10.1% … about R360 937 a
 * year", and the owner reads that card and asks Finch about it in the same
 * minute. So every figure below comes from the modules that raised the card:
 * `shapeSeries` (lib/platform/price-watch/series.ts) for the ordering, the
 * first/last delta and the volume window, `medianOf` + `MEDIAN_WINDOW_DAYS` +
 * `trailingAnnualUnits` (lib/platform/price-watch/detect.ts) for the 60-day
 * median and the annualised units. A second implementation of any of them would
 * be a chat that quietly contradicts the finding it is explaining, which is
 * worse than a chat that cannot answer.
 *
 * NO `server-only`, NO `@/` ALIAS, RELATIVE `.ts` IMPORTS. Same reason as
 * lib/platform/orderflow-debtors.ts: `node --test` has to be able to load this
 * module so the shaping below is pinned by tests. The `server-only` fence lives
 * on lib/ai/finch/tools.ts, which is the only thing that imports this.
 *
 * SMALL OUTPUTS. Every tool here answers into a Haiku context window, so series
 * are capped at SERIES_LIMIT, points at POINTS_SHOWN and recipes at
 * RECIPE_LIMIT. A tool that returned four hundred invoice lines would push the
 * findings prelude out of the model's attention to say nothing new.
 *
 * SOFT, NEVER THROWN. Everything returns `{ok:false, reason}` — a missing
 * migration (`pw_*` not applied) reads as `not_available`, an unknown item as
 * `not_found`. The runtime turns a throw into "Tool failed", which tells the
 * owner nothing and tells the model less.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation } from '../../platform/db-errors.ts';
import { shapeSeries, type SeriesPoint, type SeriesPointRow } from '../../platform/price-watch/series.ts';
import {
  MEDIAN_WINDOW_DAYS,
  medianOf,
  trailingAnnualUnits,
  type PwPricePoint,
} from '../../platform/price-watch/detect.ts';
import { matchByName } from './name-match.ts';

// ---------------------------------------------------------------------------
// Caps and shapes
// ---------------------------------------------------------------------------

/** Catalogue matches offered for one spoken name. Past six, the model is
 *  choosing from a menu rather than recognising the line the owner meant. */
const ITEM_LIMIT = 6;
/** Separate price series (one per supplier / market agent) in one answer. */
const SERIES_LIMIT = 4;
/** Dated points printed per series — the plan's ≤24. Later points win: the
 *  owner asked how it has moved, not what it cost in March. */
const POINTS_SHOWN = 24;
/** Invoices cited per series. "3 invoices, 8 Jun–13 Aug" is a citation; twenty
 *  document ids is a data dump. */
const EVIDENCE_LIMIT = 6;
/** Recipes named in a margin answer. */
const RECIPE_LIMIT = 6;
/** Hard stop on one read, mirroring series.ts's own SERIES_LIMIT. */
const POINT_READ_LIMIT = 400;
/** How far back a price history looks when the model does not say. */
const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 24;

const DAY_MS = 86_400_000;

/** Every tool in this file answers with one of these rather than throwing. */
export interface ToolFailure {
  ok: false;
  /** 'not_available' (table not migrated) | 'not_found' | 'restricted' | 'no_query'. */
  reason: string;
  /** One sentence the model may repeat to the owner. */
  note?: string;
}

type Db = SupabaseClient;

export interface PwItemRow {
  id: string;
  name: string | null;
  base_unit: string | null;
}

export interface PwMatchRow {
  raw_description: string | null;
  pw_item_id: string | null;
  status: string | null;
}

export interface PricePointRow extends SeriesPointRow {
  supplier_id: string;
  line_supplier: string | null;
}

// ---------------------------------------------------------------------------
// Pure shaping — the parts that rot silently, so the parts that are tested
// ---------------------------------------------------------------------------

/**
 * The comparable core of a product name: everything outside the pack-size
 * parenthetical, lowercased, punctuation-free.
 *
 *   "Cooking oil (5L)"          → "cooking oil"
 *   "Cooking Oil (4×5L case)"   → "cooking oil"
 *   "Line Fish Fillet (kg)"     → "line fish fillet"
 *
 * WHY NOT `matchByName`. The buy-side catalogue (`pw_items`) is named by the
 * Price Watch matcher off supplier line descriptions, while `pp_stock_items` is
 * named by the owner in ProcurePulse. The two describe the same line at
 * different pack sizes almost every time, so a substring rule either misses
 * ("cooking oil (5l)" is not a substring of "cooking oil (4×5l case)") or, with
 * the parenthetical still attached, matches the pack size instead of the
 * product. Stripping it first is the whole trick.
 */
export function itemNameCore(name: string | null | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Below this a "core" is an abbreviation, not a product name, and matching on
 *  it would link two unrelated lines. Same floor `matchByName` uses. */
const MIN_CORE_CHARS = 4;

/**
 * Catalogue items a spoken name could mean, best first.
 *
 * Four tiers, and the order is the point: an unambiguous `matchByName` hit (the
 * SAME rule the OrderFlow order builder uses, so Finch and the builder can never
 * disagree about what "cooking oil" resolves to) is pinned first; then an exact
 * name-core equality; then a containment either way; then an item reached only
 * through a supplier's raw line description. Anything below that scores 0 and is
 * dropped — an empty list is a better answer than a plausible wrong item.
 *
 * Only `confirmed` and `auto` matches are consulted. A `review` row is a guess a
 * human has not agreed with yet, and quoting a price series off one would put an
 * unreviewed link behind a sentence about the owner's money.
 */
export function rankPriceItems(
  items: readonly PwItemRow[],
  matches: readonly PwMatchRow[],
  query: string,
  limit: number = ITEM_LIMIT,
): PwItemRow[] {
  const core = itemNameCore(query);
  if (!core) return [];

  const pinned = matchByName([...items], query, (i) => i.name ?? '');

  // pw_item_id → the confirmed/auto descriptions that reach it.
  const viaDescription = new Set<string>();
  for (const m of matches) {
    if (!m.pw_item_id) continue;
    if (m.status !== 'confirmed' && m.status !== 'auto') continue;
    if (itemNameCore(m.raw_description).includes(core)) viaDescription.add(m.pw_item_id);
  }

  const scored: Array<{ item: PwItemRow; score: number }> = [];
  for (const item of items) {
    const itemCore = itemNameCore(item.name);
    let score = 0;
    if (pinned && item.id === pinned.id) score = 4;
    else if (itemCore && itemCore === core) score = 3;
    else if (
      core.length >= MIN_CORE_CHARS &&
      itemCore.length >= MIN_CORE_CHARS &&
      (itemCore.includes(core) || core.includes(itemCore))
    ) {
      score = 2;
    } else if (viaDescription.has(item.id)) score = 1;
    if (score > 0) scored.push({ item, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || (a.item.name ?? '').localeCompare(b.item.name ?? ''))
    .slice(0, Math.max(1, limit))
    .map((s) => s.item);
}

/** `null` and `''` are one thing — "no market agent" — exactly as series.ts
 *  treats them, so a plain invoice's series is never split in two. */
function agentKey(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Rows → one bucket per (supplier_id, line_supplier). The series key is three
 *  columns, not two: different market agents on one statement charge different
 *  prices for the same produce (supabase/agents-price-watch.sql). */
export function groupBySeries(rows: readonly PricePointRow[]): Map<string, PricePointRow[]> {
  const out = new Map<string, PricePointRow[]>();
  for (const row of rows) {
    const key = `${row.supplier_id}::${agentKey(row.line_supplier)}`;
    const bucket = out.get(key);
    if (bucket) bucket.push(row);
    else out.set(key, [row]);
  }
  return out;
}

/** What "up 10.1% against your 60-day median" is measured from. */
export interface MedianComparison {
  /** The trailing median of the PRIOR points inside the window. Null when there
   *  is nothing prior to compare against — genuinely unknown, not "no move". */
  median: number | null;
  deltaPct: number | null;
  /** How many prior points went into the median, for the citation. */
  pointsInWindow: number;
}

/**
 * The latest price against the trailing 60-day median of everything before it —
 * detect.ts's rule, on the shaped points.
 *
 * FIRST→LAST AND VS-MEDIAN ARE DIFFERENT CLAIMS and the owner will hear them as
 * the same one unless the model is given both. Cooking oil is +19% from June to
 * August and +10.1% against the median: the first is the year's move, the second
 * is the size of the latest step. `shapeSeries` supplies the first; this
 * supplies the second.
 */
export function medianComparison(points: readonly SeriesPoint[]): MedianComparison {
  if (points.length < 2) return { median: null, deltaPct: null, pointsInWindow: 0 };
  const last = points[points.length - 1];
  const lastMs = Date.parse(`${last.invoice_date}T00:00:00Z`);
  if (!Number.isFinite(lastMs)) return { median: null, deltaPct: null, pointsInWindow: 0 };

  // Inclusive floor, like detect.ts: a point exactly 60 days back is inside.
  const floor = lastMs - MEDIAN_WINDOW_DAYS * DAY_MS;
  const prior = points.slice(0, -1).filter((p) => {
    const t = Date.parse(`${p.invoice_date}T00:00:00Z`);
    return Number.isFinite(t) && t >= floor;
  });
  if (prior.length === 0) return { median: null, deltaPct: null, pointsInWindow: 0 };

  const median = medianOf(prior.map((p) => p.unit_price));
  return {
    median,
    // A zero/negative median cannot be divided into; the median itself is still
    // reportable, the percentage is not.
    deltaPct: median > 0 ? ((last.unit_price - median) / median) * 100 : null,
    pointsInWindow: prior.length,
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** One series, as a tool prints it. Everything nullable is null — never 0 —
 *  when it could not be established (series.ts's truthfulness rule). */
export interface ShapedSeries {
  supplier_id: string;
  supplier_name: string | null;
  line_supplier: string | null;
  points: Array<{ date: string; unit_price: number; quantity_base: number; document_id: string }>;
  points_total: number;
  first: { date: string; unit_price: number } | null;
  last: { date: string; unit_price: number } | null;
  delta_pct: number | null;
  median_60d: number | null;
  delta_vs_median_pct: number | null;
  median_points: number;
  monthly_volume_estimate: number | null;
  annual_volume_estimate: number | null;
  evidence_document_ids: string[];
}

/**
 * One (supplier, market agent) bucket → the series the model reads out.
 *
 * `annual_volume_estimate` is `trailingAnnualUnits` — the SAME trailing-12-week
 * annualisation the finding's rand figure was built on — and
 * `monthly_volume_estimate` is that twelfth, so the two cannot drift. Using
 * series.ts's 90-day window here instead would have produced a second, smaller
 * annual figure for the same series and no way for the owner to tell which of
 * the two numbers in front of them was the real one.
 */
export function shapeSeriesForTool(
  rows: readonly PricePointRow[],
  supplierName: string | null,
  now: Date,
): ShapedSeries | null {
  const head = rows[0];
  if (!head) return null;
  const shape = shapeSeries([...rows], now);
  if (shape.points.length === 0) return null;

  const comparison = medianComparison(shape.points);
  const pwPoints: PwPricePoint[] = shape.points.map((p) => ({
    supplierId: head.supplier_id,
    lineSupplier: agentKey(head.line_supplier) || null,
    pwItemId: '',
    documentId: p.document_id,
    unitPrice: p.unit_price,
    quantityBase: p.quantity_base,
    invoiceDate: p.invoice_date,
  }));
  const last = shape.points[shape.points.length - 1];
  const annualUnits = trailingAnnualUnits(pwPoints, last.invoice_date);

  const shown = shape.points.slice(-POINTS_SHOWN);
  return {
    supplier_id: head.supplier_id,
    supplier_name: agentKey(head.line_supplier) || supplierName,
    line_supplier: agentKey(head.line_supplier) || null,
    points: shown.map((p) => ({
      date: p.invoice_date,
      unit_price: round(p.unit_price, 2),
      quantity_base: round(p.quantity_base, 2),
      document_id: p.document_id,
    })),
    points_total: shape.points.length,
    first: shape.first ? { date: shape.first.invoice_date, unit_price: round(shape.first.unit_price, 2) } : null,
    last: shape.last ? { date: shape.last.invoice_date, unit_price: round(shape.last.unit_price, 2) } : null,
    delta_pct: shape.deltaPct == null ? null : round(shape.deltaPct, 1),
    median_60d: comparison.median == null ? null : round(comparison.median, 2),
    delta_vs_median_pct: comparison.deltaPct == null ? null : round(comparison.deltaPct, 1),
    median_points: comparison.pointsInWindow,
    monthly_volume_estimate: annualUnits == null ? null : Math.round(annualUnits / 12),
    annual_volume_estimate: annualUnits,
    evidence_document_ids: [...new Set(shown.map((p) => p.document_id))].slice(0, EVIDENCE_LIMIT),
  };
}

/**
 * The ProcurePulse line a buy-side catalogue item corresponds to, by name core.
 *
 * AMBIGUITY IS A NON-MATCH. Two stock lines sharing a core ("Cooking Oil (4×5L
 * case)" and "Cooking Oil (20L)") means we do not know which one the recipes
 * are about, and picking the first would attach a margin claim to the wrong
 * product. Returns null and the tool says the link could not be made.
 */
export function linkStockItem<T extends { id: string; name: string | null }>(
  pwItemName: string | null,
  stockItems: readonly T[],
): T | null {
  const core = itemNameCore(pwItemName);
  if (core.length < MIN_CORE_CHARS) return null;
  const hits = stockItems.filter((s) => itemNameCore(s.name) === core);
  return hits.length === 1 ? hits[0] : null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Every query in this file pins `org_id` on top of RLS — the belt-and-braces
 *  the rest of the platform uses, so a policy regression cannot widen a read to
 *  another org's prices. */
const NOT_AVAILABLE: ToolFailure = {
  ok: false,
  reason: 'not_available',
  note: 'Price history is not switched on for this business yet.',
};

/** yyyy-mm-dd `months` calendar months before `now`, in UTC. */
function monthsBack(now: Date, months: number): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** id → name, for whichever suppliers a result actually cites. */
async function supplierNames(db: Db, orgId: string, ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return out;
  const { data, error } = await db
    .from('suppliers')
    .select('id, name')
    .eq('org_id', orgId)
    .in('id', unique)
    .returns<Array<{ id: string; name: string | null }>>();
  // Soft: an unnamed supplier is a series with a blank label, not a failed tool.
  if (error || !data) return out;
  for (const row of data) if (row.name) out.set(row.id, row.name);
  return out;
}

export interface FoundItem {
  pw_item_id: string;
  name: string | null;
  base_unit: string | null;
  suppliers: Array<{ supplier_id: string; name: string | null; points: number; last_seen: string | null }>;
}

/**
 * Tool 1 — a spoken name ("cooking oil", "line fish") → the catalogue items it
 * could mean, and who has invoiced each one.
 *
 * The supplier list is the "who else supplies it?" half of the question, and it
 * is read from the price points rather than from a supplier catalogue on
 * purpose: "supplies it" means "has actually invoiced us for it", not "is on
 * our books".
 */
export async function findPriceItems(
  db: Db,
  orgId: string,
  query: string,
): Promise<{ ok: true; items: FoundItem[]; hint?: string } | ToolFailure> {
  const wanted = (query ?? '').trim();
  if (!wanted) return { ok: false, reason: 'no_query', note: 'Say which product to look up.' };

  const { data: itemRows, error: itemError } = await db
    .from('pw_items')
    .select('id, name, base_unit')
    .eq('org_id', orgId)
    .limit(2000)
    .returns<PwItemRow[]>();
  if (itemError) {
    if (isMissingRelation(itemError)) return NOT_AVAILABLE;
    return { ok: false, reason: 'read_failed', note: 'The item catalogue could not be read.' };
  }

  const { data: matchRows } = await db
    .from('pw_item_matches')
    .select('raw_description, pw_item_id, status')
    .eq('org_id', orgId)
    .in('status', ['confirmed', 'auto'])
    .limit(4000)
    .returns<PwMatchRow[]>();

  const ranked = rankPriceItems(itemRows ?? [], matchRows ?? [], wanted);
  if (ranked.length === 0) {
    return { ok: true, items: [], hint: 'no priced lines match' };
  }

  const { data: pointRows } = await db
    .from('pw_price_points')
    .select('pw_item_id, supplier_id, line_supplier, invoice_date')
    .eq('org_id', orgId)
    .in(
      'pw_item_id',
      ranked.map((i) => i.id),
    )
    .order('invoice_date', { ascending: false })
    .limit(POINT_READ_LIMIT)
    .returns<Array<{ pw_item_id: string; supplier_id: string; line_supplier: string | null; invoice_date: string | null }>>();

  const names = await supplierNames(db, orgId, (pointRows ?? []).map((p) => p.supplier_id));

  const items: FoundItem[] = ranked.map((item) => {
    const bySupplier = new Map<string, { supplier_id: string; name: string | null; points: number; last_seen: string | null }>();
    for (const p of pointRows ?? []) {
      if (p.pw_item_id !== item.id) continue;
      const agent = agentKey(p.line_supplier);
      const key = `${p.supplier_id}::${agent}`;
      const entry = bySupplier.get(key) ?? {
        supplier_id: p.supplier_id,
        // The market agent is who the money actually goes to on a statement
        // line, so it is the name the owner recognises.
        name: agent || names.get(p.supplier_id) || null,
        points: 0,
        last_seen: null,
      };
      entry.points += 1;
      const date = (p.invoice_date ?? '').slice(0, 10);
      if (date && (!entry.last_seen || date > entry.last_seen)) entry.last_seen = date;
      bySupplier.set(key, entry);
    }
    return {
      pw_item_id: item.id,
      name: item.name,
      base_unit: item.base_unit,
      suppliers: [...bySupplier.values()].sort((a, b) => b.points - a.points),
    };
  });

  return { ok: true, items };
}

export interface PriceHistory {
  ok: true;
  item: { pw_item_id: string; name: string | null; base_unit: string | null };
  months: number;
  series: ShapedSeries[];
  series_total: number;
  hint?: string;
}

/** Read one item's points, grouped into series. Shared by the history tool and
 *  the margin tool, so the two can never quote different prices. */
async function readSeries(
  db: Db,
  orgId: string,
  pwItemId: string,
  supplierId: string | null,
  months: number,
  now: Date,
): Promise<{ item: PwItemRow; series: ShapedSeries[] } | ToolFailure> {
  const { data: item, error: itemError } = await db
    .from('pw_items')
    .select('id, name, base_unit')
    .eq('org_id', orgId)
    .eq('id', pwItemId)
    .maybeSingle<PwItemRow>();
  if (itemError) {
    if (isMissingRelation(itemError)) return NOT_AVAILABLE;
    return { ok: false, reason: 'read_failed', note: 'The item could not be read.' };
  }
  if (!item) return { ok: false, reason: 'not_found', note: 'No catalogue item with that id.' };

  let query = db
    .from('pw_price_points')
    .select('supplier_id, line_supplier, invoice_date, unit_price, quantity_base, document_id, line_index')
    .eq('org_id', orgId)
    .eq('pw_item_id', pwItemId)
    .gte('invoice_date', monthsBack(now, months));
  if (supplierId) query = query.eq('supplier_id', supplierId);

  const { data: rows, error } = await query
    .order('invoice_date', { ascending: false })
    .limit(POINT_READ_LIMIT)
    .returns<PricePointRow[]>();
  if (error) {
    if (isMissingRelation(error)) return NOT_AVAILABLE;
    return { ok: false, reason: 'read_failed', note: 'The price history could not be read.' };
  }

  const names = await supplierNames(db, orgId, (rows ?? []).map((r) => r.supplier_id));
  const shaped: ShapedSeries[] = [];
  for (const bucket of groupBySeries(rows ?? []).values()) {
    const s = shapeSeriesForTool(bucket, names.get(bucket[0].supplier_id) ?? null, now);
    if (s) shaped.push(s);
  }
  // Most-observed series first: that is the supplier the owner actually buys
  // this line from, and it should not be third in the list behind two one-offs.
  shaped.sort((a, b) => b.points_total - a.points_total);
  return { item, series: shaped };
}

/**
 * Tool 2 — one item's price history, one series per (supplier, market agent),
 * with the first→last move AND the move against the trailing 60-day median.
 */
export async function priceHistory(
  db: Db,
  orgId: string,
  input: { pwItemId: string; supplierId?: string | null; months?: number },
  now: Date = new Date(),
): Promise<PriceHistory | ToolFailure> {
  const pwItemId = (input.pwItemId ?? '').trim();
  if (!pwItemId) return { ok: false, reason: 'no_query', note: 'Say which item to read.' };
  const months = clampMonths(input.months);

  const read = await readSeries(db, orgId, pwItemId, input.supplierId ?? null, months, now);
  if ('ok' in read) return read;

  const kept = read.series.slice(0, SERIES_LIMIT);
  return {
    ok: true,
    item: { pw_item_id: read.item.id, name: read.item.name, base_unit: read.item.base_unit },
    months,
    series: kept,
    series_total: read.series.length,
    ...(kept.length === 0
      ? { hint: `no invoice lines for this item in the last ${months} months` }
      : {}),
  };
}

/** Model-supplied `months` into 1…24, defaulting to six. */
export function clampMonths(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MONTHS;
  return Math.min(n, MAX_MONTHS);
}

export interface MarginExposure {
  ok: true;
  item: { pw_item_id: string; name: string | null; base_unit: string | null };
  supplier: { supplier_id: string; name: string | null; line_supplier: string | null };
  latest_unit_price: number | null;
  median_60d: number | null;
  delta_per_unit: number | null;
  delta_vs_median_pct: number | null;
  monthly_volume_estimate: number | null;
  annual_volume_estimate: number | null;
  /** Rand a year, positive when the move costs the business money. Null when
   *  the volume or the median could not be established — never 0. */
  annual_cost_delta: number | null;
  basis: string;
  recipes: Array<{
    recipe_id: string;
    name: string | null;
    qty_per_batch: number | null;
    unit: string | null;
    uses_per_month: number | null;
    sale_price: number | null;
    target_margin_pct: number | null;
  }>;
  margin_effect:
    | 'not_linked'
    | {
        linked_stock_item: { id: string; name: string | null };
        target_margin_pct: number | null;
        note: string;
      };
}

/**
 * Tool 4 — what an increase on this line costs over a year, and which recipes
 * (if any) carry it into a sale price. ADMIN ONLY: this is a money figure and a
 * margin target, so it obeys the same gate as the debtors tools.
 *
 * `margin_effect: 'not_linked'` is the common and correct answer on this data.
 * The knowledge doc turns it into "your recipes don't reference this line yet,
 * so I can only size the cost, not the margin effect" — the honest sentence.
 * A margin percentage invented from a cost delta would be the single most
 * believable wrong number this agent could produce.
 */
export async function marginExposure(
  db: Db,
  orgId: string,
  canSeeMoney: boolean,
  input: { pwItemId: string; supplierId?: string | null },
  now: Date = new Date(),
): Promise<MarginExposure | ToolFailure> {
  if (!canSeeMoney) {
    return {
      ok: false,
      reason: 'restricted',
      note: 'Margin and cost exposure are only visible to admins.',
    };
  }
  const pwItemId = (input.pwItemId ?? '').trim();
  if (!pwItemId) return { ok: false, reason: 'no_query', note: 'Say which item to size.' };

  const read = await readSeries(db, orgId, pwItemId, input.supplierId ?? null, DEFAULT_MONTHS, now);
  if ('ok' in read) return read;
  const series = read.series[0];
  if (!series) {
    return { ok: false, reason: 'not_found', note: 'No recent invoice lines for this item.' };
  }

  const deltaPerUnit =
    series.last && series.median_60d != null ? round(series.last.unit_price - series.median_60d, 2) : null;
  const annualCostDelta =
    deltaPerUnit != null && series.annual_volume_estimate != null
      ? Math.round(deltaPerUnit * series.annual_volume_estimate)
      : null;

  // ---- the recipe link -----------------------------------------------------
  const { data: stockRows } = await db
    .from('pp_stock_items')
    .select('id, name')
    .eq('org_id', orgId)
    .limit(2000)
    .returns<Array<{ id: string; name: string | null }>>();
  const linked = linkStockItem(read.item.name, stockRows ?? []);

  const recipes: MarginExposure['recipes'] = [];
  let targetMarginPct: number | null = null;
  if (linked) {
    const { data: targets } = await db
      .from('pl_targets')
      .select('target_margin_pct')
      .eq('org_id', orgId)
      .maybeSingle<{ target_margin_pct: number | string | null }>();
    const raw = targets?.target_margin_pct;
    const parsed = raw == null ? NaN : Number(raw);
    targetMarginPct = Number.isFinite(parsed) ? parsed : null;

    const { data: ingredientRows } = await db
      .from('pp_recipe_ingredients')
      .select('recipe_id, qty_per_batch, unit')
      .eq('org_id', orgId)
      .eq('stock_item_id', linked.id)
      .limit(RECIPE_LIMIT)
      .returns<Array<{ recipe_id: string; qty_per_batch: number | string | null; unit: string | null }>>();

    const recipeIds = [...new Set((ingredientRows ?? []).map((r) => r.recipe_id))];
    const nameById = new Map<string, string | null>();
    if (recipeIds.length > 0) {
      const { data: recipeRows } = await db
        .from('pp_recipes')
        .select('id, name')
        .eq('org_id', orgId)
        .in('id', recipeIds)
        .returns<Array<{ id: string; name: string | null }>>();
      for (const r of recipeRows ?? []) nameById.set(r.id, r.name);
    }
    for (const line of ingredientRows ?? []) {
      const qty = line.qty_per_batch == null ? NaN : Number(line.qty_per_batch);
      recipes.push({
        recipe_id: line.recipe_id,
        name: nameById.get(line.recipe_id) ?? null,
        qty_per_batch: Number.isFinite(qty) ? qty : null,
        unit: line.unit,
        // Vyso does not count batches or store a per-recipe sale price yet, and
        // "null" is the only true value here. Guessing one would let the model
        // multiply its way to a margin percentage that nothing supports.
        uses_per_month: null,
        sale_price: null,
        target_margin_pct: targetMarginPct,
      });
    }
  }

  return {
    ok: true,
    item: { pw_item_id: read.item.id, name: read.item.name, base_unit: read.item.base_unit },
    supplier: {
      supplier_id: series.supplier_id,
      name: series.supplier_name,
      line_supplier: series.line_supplier,
    },
    latest_unit_price: series.last?.unit_price ?? null,
    median_60d: series.median_60d,
    delta_per_unit: deltaPerUnit,
    delta_vs_median_pct: series.delta_vs_median_pct,
    monthly_volume_estimate: series.monthly_volume_estimate,
    annual_volume_estimate: series.annual_volume_estimate,
    annual_cost_delta: annualCostDelta,
    basis:
      'latest unit price minus the trailing 60-day median, times the last 12 weeks of buying annualised — an estimate, so say "about"',
    recipes,
    margin_effect:
      linked && recipes.length > 0
        ? {
            linked_stock_item: { id: linked.id, name: linked.name },
            target_margin_pct: targetMarginPct,
            note: 'Batch counts and per-recipe sale prices are not tracked, so the cost is sized but the margin percentage is not.',
          }
        : 'not_linked',
  };
}
