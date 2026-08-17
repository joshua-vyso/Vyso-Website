/**
 * The price history behind one finding — `agent_findings` row → the
 * `pw_price_points` series it was raised from (`.ai/plan_brief_chat_v2.md` §4
 * W3).
 *
 * WHY THIS FILE EXISTS. A finding stores no supplier and no item: the schema is
 * one shared sink for every agent (supabase/agents-price-watch.sql), so the
 * only columns it has are `observation`, `evidence_refs` and `dedupe_key`. The
 * detail page has to draw a real chart from that, which means turning a finding
 * back into a series identity. There are exactly two ways to do it and this
 * module uses both, in order of cost.
 *
 * 1. THE DEDUPE KEY, PARSED. `run.ts` builds it as
 *    `price_watch:<supplier_id>:<pw_item_id>:<iso-week>[:<market agent>]` and
 *    documents the format as load-bearing rather than incidental — the nightly
 *    run itself parses it back (`parseDedupeKey`, run.ts:489) to work out which
 *    series already have an open finding. So it is a supported inverse, not a
 *    string this file is guessing at, and `parseDedupeKey` is IMPORTED rather
 *    than re-implemented: two parsers for one format is how the Brief and the
 *    cron end up disagreeing about which series a finding belongs to.
 *    Cost: zero queries.
 *
 * 2. EVIDENCE DOCUMENTS, when the key can't be parsed (a hand-written row, or a
 *    key written by a future version). `pw_price_points where document_id = any
 *    (evidence_refs)` gives back the points those invoices produced, and the
 *    series with the most of them is the one the finding is about. Cost: one
 *    extra query, and only on the rows the fast path can't read.
 *
 * THE SERIES KEY IS THREE COLUMNS, NOT TWO. Market statements carry a per-line
 * market agent (`line_supplier`) distinct from the document's supplier, and
 * different agents charge different prices for the same produce — so the real
 * key is (supplier_id, line_supplier, pw_item_id) (see the DDL comment above
 * `pw_price_points`). Dropping `line_supplier` would draw one zig-zag line
 * through several agents' prices and call it a trend.
 *
 * SOFT ON FAILURE, LIKE THE EVIDENCE RESOLVER. Everything here decorates a page
 * that already has something to say. A missing relation (the migration hasn't
 * been applied), a permissions surprise, an unreadable key — all return `null`,
 * and the detail page renders without the chart rather than 500-ing on a
 * finding the owner can otherwise read. Nothing here throws.
 *
 * TRUTHFULNESS (agent-findings.ts rule 3). `deltaPct` and `monthlyVolume` are
 * null when they cannot be established, never 0. "at your current ~0 kg/month"
 * would be a claim about the business, and a wrong one.
 *
 * Import style matches the rest of this folder: relative, explicit `.ts`, no
 * `@/` alias, so `node --test tests/price-watch-series.test.ts` can load the
 * pure seam below. `SupabaseClient` is a TYPE import for the same reason — it
 * is erased, so the test never has to resolve the package.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation } from '../db-errors.ts';
import { parseDedupeKey } from './run.ts';

/** The one agent whose findings have a price series. `agent_findings.agent` is
 *  free text shared by every future agent, so this is checked, not assumed. */
export const PRICE_WATCH_AGENT = 'price_watch';

/** Points read per series. Two years of daily buying, comfortably — and a hard
 *  stop so one pathological item can't stream ten thousand rows into an SVG. */
const SERIES_LIMIT = 400;

/** The window the volume estimate is taken over, and what it is divided by to
 *  become "per month". Ninety days rather than thirty because produce buying is
 *  lumpy: one skipped week in a 30-day window halves the figure. */
const VOLUME_WINDOW_DAYS = 90;
const VOLUME_WINDOW_MONTHS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** One invoice line, as the chart and the evidence list read it. */
export interface SeriesPoint {
  /** 'YYYY-MM-DD' — the extracted invoice date, not the upload date. */
  invoice_date: string;
  /** Normalised to the item's `base_unit`, so a pack-size change is not a move. */
  unit_price: number;
  document_id: string;
  line_index: number;
  quantity_base: number;
}

/** A row as PostgREST hands it back: `numeric` arrives as number or string
 *  depending on driver and precision, so every figure is coerced below. */
export interface SeriesPointRow {
  invoice_date: string | null;
  unit_price: number | string | null;
  quantity_base: number | string | null;
  document_id: string;
  line_index: number | string;
}

/** The shaping — what `shapeSeries` derives, with nothing named yet. */
export interface SeriesShape {
  /** Ascending by invoice date, then by line index within a date. */
  points: SeriesPoint[];
  first: SeriesPoint | null;
  last: SeriesPoint | null;
  /** Percentage move from the first point to the last. Null with fewer than two
   *  points, or when the first price is zero (no percentage of nothing). */
  deltaPct: number | null;
  /** Base units bought per month, averaged over the last 90 days. Null when
   *  nothing was bought in that window — silence, not zero. */
  monthlyVolume: number | null;
}

/** The shaping, plus who and what it is about. */
export interface FindingSeries extends SeriesShape {
  /** 'kg' | 'unit' | 'l' — from `pw_items`. Null when the item can't be read. */
  base_unit: string | null;
  item_name: string | null;
  supplier_name: string | null;
  /** The per-line market agent, when this series belongs to one. */
  line_supplier: string | null;
}

/** The series identity a finding resolves to. */
interface SeriesKey {
  supplierId: string;
  pwItemId: string;
  lineSupplier: string | null;
}

/** Just enough of an `agent_findings` row to resolve its series. Declared
 *  structurally rather than importing `AgentFinding`, so this module stays free
 *  of anything that reaches `next/headers`. */
export interface FindingRef {
  agent: string;
  dedupe_key: string;
  evidence_refs: string[];
}

type Db = SupabaseClient;

/** `null` and `''` mean the same thing here — "no market agent" — because
 *  `line_supplier` is nullable text and a normaliser upstream could leave
 *  either. Comparing through this function means a plain invoice's series can
 *  never be split in two by the difference. */
function agentKey(value: string | null | undefined): string {
  return (value ?? '').trim();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Rows → the series the chart draws.
 *
 * PURE, AND SEPARATE FROM THE QUERY ON PURPOSE. Ordering, coercion, the delta
 * and the volume window are the parts that rot silently: a wrong sort turns a
 * rise into a fall, and a wrong window turns "380 kg/month" into a number the
 * owner will price a supplier negotiation against. tests/price-watch-series.
 * test.ts pins all of it; the query around it is one `.select()`.
 *
 * Rows that cannot be believed — no date, an unparseable price — are DROPPED
 * rather than defaulted. A point at R0 would be drawn, and would be a lie.
 *
 * `now` is a parameter, not `Date.now()`, so the volume window is testable and
 * so one render's figures all agree on a single clock.
 */
export function shapeSeries(rows: SeriesPointRow[], now: Date): SeriesShape {
  const points: SeriesPoint[] = [];
  for (const row of rows) {
    const date = (row.invoice_date ?? '').trim();
    if (!ISO_DATE.test(date)) continue;
    const price = toNumber(row.unit_price);
    if (price == null) continue;
    const lineIndex = toNumber(row.line_index) ?? 0;
    points.push({
      invoice_date: date,
      unit_price: price,
      document_id: row.document_id,
      line_index: lineIndex,
      // A missing quantity is 0 for the SUM (it adds nothing) — unlike a
      // missing price, it doesn't make the point unusable for the chart.
      quantity_base: toNumber(row.quantity_base) ?? 0,
    });
  }

  // ISO dates sort lexically, so no Date objects are needed for the ordering.
  points.sort(
    (a, b) => a.invoice_date.localeCompare(b.invoice_date) || a.line_index - b.line_index,
  );

  const first = points[0] ?? null;
  const last = points.length > 0 ? points[points.length - 1] : null;

  const deltaPct =
    points.length >= 2 && first && last && first.unit_price !== 0
      ? ((last.unit_price - first.unit_price) / first.unit_price) * 100
      : null;

  const cutoff = new Date(now.getTime() - VOLUME_WINDOW_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  let volume = 0;
  for (const p of points) {
    // >= : a point exactly on the boundary is inside the window.
    if (p.invoice_date >= cutoff) volume += p.quantity_base;
  }

  return {
    points,
    first,
    last,
    deltaPct,
    monthlyVolume: volume > 0 ? volume / VOLUME_WINDOW_MONTHS : null,
  };
}

/**
 * Which series is this finding about?
 *
 * Fast path first (the key), evidence documents second. Returns null when
 * neither can answer — the caller then draws no chart, which is the honest
 * outcome for a finding whose provenance can't be reconstructed.
 */
async function resolveKey(
  db: Db,
  orgId: string,
  finding: FindingRef,
): Promise<SeriesKey | null> {
  const parsed = parseDedupeKey(finding.dedupe_key ?? '');
  if (parsed) {
    return {
      supplierId: parsed.supplierId,
      pwItemId: parsed.pwItemId,
      lineSupplier: parsed.lineSupplier ?? null,
    };
  }

  const refs = finding.evidence_refs ?? [];
  if (refs.length === 0) return null;

  const { data, error } = await db
    .from('pw_price_points')
    .select('supplier_id, pw_item_id, line_supplier')
    .eq('org_id', orgId)
    .in('document_id', refs)
    .limit(SERIES_LIMIT)
    .returns<{ supplier_id: string; pw_item_id: string; line_supplier: string | null }[]>();

  if (error || !data || data.length === 0) return null;

  // An invoice has many lines and a finding cites several invoices, so these
  // rows cover every item on them. The series the finding is about is the one
  // those documents have the most lines for — ties broken by first appearance,
  // which is deterministic given the ordering above.
  const tally = new Map<string, { key: SeriesKey; count: number }>();
  for (const row of data) {
    const id = `${row.supplier_id}::${agentKey(row.line_supplier)}::${row.pw_item_id}`;
    const seen = tally.get(id);
    if (seen) {
      seen.count += 1;
    } else {
      tally.set(id, {
        count: 1,
        key: {
          supplierId: row.supplier_id,
          pwItemId: row.pw_item_id,
          lineSupplier: row.line_supplier,
        },
      });
    }
  }

  let best: { key: SeriesKey; count: number } | null = null;
  for (const entry of tally.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.key ?? null;
}

/** Item name + base unit. Soft: a chart with an unlabelled axis still tells the
 *  truth about the shape of the prices. */
async function readItem(
  db: Db,
  orgId: string,
  pwItemId: string,
): Promise<{ name: string | null; baseUnit: string | null }> {
  const { data, error } = await db
    .from('pw_items')
    .select('name, base_unit')
    .eq('org_id', orgId)
    .eq('id', pwItemId)
    .maybeSingle<{ name: string | null; base_unit: string | null }>();
  if (error || !data) return { name: null, baseUnit: null };
  return { name: data.name ?? null, baseUnit: data.base_unit ?? null };
}

/** Supplier name. Same softness — and note the market agent (`line_supplier`)
 *  is the more specific answer when a series has one; the caller prefers it. */
async function readSupplier(db: Db, orgId: string, supplierId: string): Promise<string | null> {
  const { data, error } = await db
    .from('suppliers')
    .select('name')
    .eq('org_id', orgId)
    .eq('id', supplierId)
    .maybeSingle<{ name: string | null }>();
  if (error || !data) return null;
  return data.name ?? null;
}

/**
 * A finding's price history, ready to draw.
 *
 * The client is passed IN rather than created here: this module has no business
 * reaching `next/headers`, and the caller (a server page) already holds an
 * RLS-scoped client. `org_id` is still pinned on every query — the same
 * belt-and-braces `agent-findings.ts` uses, so a policy regression can't widen
 * a read to another org's prices.
 *
 * Returns null — never a partial or an empty shell — when this finding has no
 * series to show: a different agent, an unresolvable key, or a table that isn't
 * in this database yet.
 */
export async function seriesForFinding(
  db: Db,
  orgId: string,
  finding: FindingRef,
  now: Date = new Date(),
): Promise<FindingSeries | null> {
  // Only Price Watch writes prices. Another agent's evidence documents would
  // still produce points (they are invoices), and charting them would attach a
  // butternut trend to a finding about overdue debtors.
  if (finding.agent !== PRICE_WATCH_AGENT) return null;

  let key: SeriesKey | null = null;
  try {
    key = await resolveKey(db, orgId, finding);
  } catch {
    return null;
  }
  if (!key) return null;

  // `line_supplier` is deliberately NOT in the WHERE clause. It is nullable and
  // the difference between null and '' is not worth a second query shape, so
  // the filter happens in memory over rows the (org_id, supplier_id, …) index
  // has already narrowed to this supplier's lines for this item.
  const { data, error } = await db
    .from('pw_price_points')
    .select('invoice_date, unit_price, quantity_base, document_id, line_index, line_supplier')
    .eq('org_id', orgId)
    .eq('supplier_id', key.supplierId)
    .eq('pw_item_id', key.pwItemId)
    .order('invoice_date', { ascending: false })
    .limit(SERIES_LIMIT)
    .returns<(SeriesPointRow & { line_supplier: string | null })[]>();

  if (error) {
    // Pre-migration or unreadable — no chart, no crash (see the header).
    if (!isMissingRelation(error)) {
      console.error('[price-watch/series] pw_price_points read failed', error.message);
    }
    return null;
  }

  const wanted = agentKey(key.lineSupplier);
  const rows = (data ?? []).filter((r) => agentKey(r.line_supplier) === wanted);
  const shape = shapeSeries(rows, now);
  if (shape.points.length === 0) return null;

  const [item, supplier] = await Promise.all([
    readItem(db, orgId, key.pwItemId),
    readSupplier(db, orgId, key.supplierId),
  ]);

  return {
    ...shape,
    base_unit: item.baseUnit,
    item_name: item.name,
    // The market agent is who the money actually goes to on a statement line,
    // so it is the name the owner recognises; the document's supplier is the
    // fallback for a plain invoice.
    supplier_name: key.lineSupplier?.trim() || supplier,
    line_supplier: key.lineSupplier,
  };
}
