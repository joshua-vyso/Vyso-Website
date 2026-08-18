/**
 * ProcurePulse reads for Finch's stock tool — "what will I run out of this
 * week?" (`.ai/plan_finch_read_tools_p12.md` §2, tool 3).
 *
 * ONE DEFINITION OF "LOW", ONE OF "DAYS OF COVER". `stockStatus` and
 * `daysOfCover` come from lib/platform/procurepulse.ts (the helpers the stock
 * screens render from) and the 30-day usage tally from
 * lib/platform/stock-cover/detect.ts (the one the nightly agent raises cards
 * from). So a line Finch calls low is exactly a line ProcurePulse shows as low
 * and exactly a line the Brief has a card for. Nothing about stock levels is
 * re-derived here — the failure this avoids is not a wrong number, it is three
 * slightly different right ones in three places on the same morning.
 *
 * WHICH THRESHOLD WINS. `pp_stock_thresholds.low_threshold` over
 * `pp_stock_items.low_threshold`, the same precedence stock-cover/run.ts and
 * InsightGen use.
 *
 * NOT MONEY. On-hand, thresholds, usage and count variance are operational
 * facts every member needs to do their job, so there is no `canSeeMoney` gate
 * on this tool — and deliberately no rand figure in its output either, which is
 * what keeps that true. `avg_unit_price` is never read.
 *
 * NO `server-only` / `@/` ALIAS — see the header of price-watch-data.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation } from '../../platform/db-errors.ts';
import { daysOfCover, stockStatus } from '../../platform/procurepulse.ts';
import {
  COUNT_ADJUSTMENT_REASON,
  WINDOW_DAYS,
  tallyMovements,
  type MovementTally,
  type StockCoverMovement,
} from '../../platform/stock-cover/detect.ts';
import type { ToolFailure } from './price-watch-data.ts';

/** Lines returned in one answer — the plan's ≤12. A stock list longer than a
 *  dozen is a report, and the owner should open ProcurePulse for it. */
const LINE_LIMIT = 12;
/** "This week": under a week of cover is the question "what will I run out of
 *  this week?" turned into arithmetic. */
export const AT_RISK_COVER_DAYS = 7;
/** How far back a RECEIPT still counts as "this line is stocked". Three months
 *  is longer than any of this catalogue's lead times and longer than the 30-day
 *  usage window, so a line that has genuinely been bought recently cannot be
 *  mistaken for one nobody stocks. */
export const RECEIPT_WINDOW_DAYS = 90;
/** Hard stop on one catalogue read (stock-cover/run.ts uses the same). */
const STOCK_READ_LIMIT = 2000;
const MOVEMENT_READ_LIMIT = 20_000;

type Db = SupabaseClient;

/** PostgREST hands numerics back as number|string depending on driver. */
function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface StockLineInput {
  id: string;
  name: string;
  unit: string;
  onHand: number;
  /** The threshold that wins (pp_stock_thresholds over the item's own). 0 when
   *  nobody has set one — "not configured", not "configured as zero". */
  lowThreshold: number;
  /** Has anything been RECEIVED on this line in the last 90 days? Decides
   *  whether an empty, thresholdless line is a line about to run out or a line
   *  this business does not stock. */
  hasRecentReceipt?: boolean;
}

export interface StockLine {
  stock_item_id: string;
  name: string;
  unit: string;
  on_hand: number;
  low_threshold: number;
  /** Units consumed in the last 30 days, count adjustments excluded. */
  consumption_30d: number;
  /** Null when the line has not moved at all — "we have not touched this" is
   *  not "we are about to run out", and a number here would say it was. */
  days_of_cover: number | null;
  status: 'ok' | 'low' | 'out';
  /** What the month's stock counts wrote off, when they wrote anything off.
   *  `adjust` is negative (units lost); `pct` is that share of what came in. */
  variance_30d: { adjust: number; pct: number } | null;
}

/**
 * `stockStatus`'s vocabulary, in the words the tool prints. 'in_stock' becomes
 * 'ok' and nothing else changes — the mapping exists so the model never has to
 * decide whether "in_stock" means the same thing as "ok".
 */
function statusOf(onHand: number, lowThreshold: number): StockLine['status'] {
  const s = stockStatus({ on_hand: onHand, low_threshold: lowThreshold });
  return s === 'in_stock' ? 'ok' : s;
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * A line this business does not actually stock.
 *
 * WHAT WENT WRONG WITHOUT THIS. Meridian's catalogue carries rows nobody has
 * configured — no threshold, nothing on hand, nothing received in months, but
 * historic consumption in the ledger. `daysOfCover(0, usage)` is 0 for every
 * one of them, so "what will I run out of this week?" ranked twelve dormant
 * lines above every line the owner actually needed to hear about, and the cap
 * pushed the real answer off the end. The five lines that WERE about to run out
 * did not appear at all.
 *
 * THREE CONDITIONS, ALL OF THEM. No threshold set (nobody has said what low
 * means here), nothing on hand, and no receipt in 90 days. A line failing any
 * one of them is a real line: a threshold means someone is watching it, stock
 * on hand means it exists, and a recent receipt means it is being bought. Only
 * all three together mean "this row is catalogue residue", and residue is not
 * an emergency.
 */
export function isNotStocked(item: StockLineInput): boolean {
  return item.lowThreshold <= 0 && item.onHand <= 0 && item.hasRecentReceipt !== true;
}

/** 'out' before 'low' before 'ok', for lines that tie on how soon. */
const STATUS_RANK: Record<StockLine['status'], number> = { out: 0, low: 1, ok: 2 };

/**
 * How soon this line becomes a problem, as one sortable number.
 *
 * An OUT line is 0 whatever the ledger says. `days_of_cover` stays null on the
 * line itself — the model must still tell the owner the cover is unknown — but
 * "you have none" is a today problem and cannot be sorted below a line with
 * twelve days left just because nothing moved last month.
 */
function urgency(l: StockLine): number {
  if (l.status === 'out') return 0;
  return l.days_of_cover ?? Number.POSITIVE_INFINITY;
}

/** A line someone has set a low threshold on. Configured lines always outrank
 *  unconfigured ones: a threshold is a human saying "tell me about this". */
function isConfigured(l: StockLine): boolean {
  return l.low_threshold > 0;
}

export interface ShapedStockPosition {
  lines: StockLine[];
  /** Lines dropped by `isNotStocked`. Reported rather than silently swallowed:
   *  "12 lines with no threshold set aren't included" is the difference between
   *  a filtered answer and a wrong one. */
  not_stocked_hidden: number;
}

/**
 * Stock lines → what the tool answers with. PURE: the query around it is two
 * `.select()`s, and everything that could be quietly wrong (the usage window,
 * the ranking, which lines count as at risk) is here and tested.
 *
 * RANKED BY HOW SOON, NOT BY HOW LOW. A line at 2 of 40 that nobody touches is
 * not the morning's problem; a line at 12 of 16 that goes out the door daily
 * is. Lines with no usage sort last — unknown is not urgent, and it is not
 * calm either, so they are still listed.
 *
 * NAMING A LINE OVERRIDES ALL OF IT. `query` is the owner asking about one
 * line by name, and they are entitled to an answer about a line nobody has
 * configured — "you have no Garlic-Whole and no threshold on it" is true and
 * useful. The not-stocked filter only applies to the LISTS.
 */
export function shapeStockPosition(
  items: readonly StockLineInput[],
  tallies: ReadonlyMap<string, MovementTally>,
  opts: { query?: string | null; onlyAtRisk?: boolean; limit?: number } = {},
): ShapedStockPosition {
  const wanted = (opts.query ?? '').trim().toLowerCase();
  const limit = opts.limit ?? LINE_LIMIT;

  const lines: StockLine[] = [];
  let hidden = 0;
  for (const item of items) {
    if (wanted && !item.name.toLowerCase().includes(wanted)) continue;
    // Named lines are always answered about; unnamed residue is counted, not listed.
    if (!wanted && isNotStocked(item)) {
      hidden += 1;
      continue;
    }
    const tally = tallies.get(item.id) ?? { consumed: 0, received: 0, adjusted: 0 };
    const cover = daysOfCover(item.onHand, tally.consumed / WINDOW_DAYS);
    const status = statusOf(item.onHand, item.lowThreshold);

    // Measured against what CAME IN, not against what is on hand — the same
    // rule the Stock Cover agent's count-variance card uses.
    const variance =
      tally.received > 0 && tally.adjusted < 0
        ? { adjust: round(tally.adjusted, 2), pct: round((-tally.adjusted / tally.received) * 100, 1) }
        : null;

    lines.push({
      stock_item_id: item.id,
      name: item.name,
      unit: item.unit,
      on_hand: round(item.onHand, 2),
      low_threshold: round(item.lowThreshold, 2),
      consumption_30d: round(tally.consumed, 2),
      days_of_cover: cover,
      status,
      variance_30d: variance,
    });
  }

  const atRisk = (l: StockLine) => l.status !== 'ok' || (l.days_of_cover != null && l.days_of_cover < AT_RISK_COVER_DAYS);
  const kept = opts.onlyAtRisk ? lines.filter(atRisk) : lines;

  const ranked = kept
    .sort((a, b) => {
      // A line someone is watching outranks one nobody has configured, however
      // empty the unconfigured one looks.
      if (isConfigured(a) !== isConfigured(b)) return isConfigured(a) ? -1 : 1;
      const ua = urgency(a);
      const ub = urgency(b);
      if (ua !== ub) return ua - ub;
      if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
      return a.name.localeCompare(b.name);
    })
    .slice(0, Math.max(1, limit));

  return { lines: ranked, not_stocked_hidden: hidden };
}

/**
 * Which lines have had stock COME IN inside the window.
 *
 * A count adjustment is excluded even when it is positive: a stock count that
 * found more than the book said is a correction, not a delivery, and a line
 * whose only positive movement is a correction has still not been bought.
 * Deliberately NOT folded into `tallyMovements` — that one is the 30-day usage
 * window the Brief's cards are raised on, and widening it to 90 days here would
 * change every days-of-cover figure on the platform.
 */
export function receiptedItemIds(
  movements: readonly StockCoverMovement[],
  params: { today: string; windowDays?: number },
): Set<string> {
  const out = new Set<string>();
  const todayMs = Date.parse(`${params.today}T00:00:00Z`);
  if (!Number.isFinite(todayMs)) return out;
  const startMs = todayMs - (params.windowDays ?? RECEIPT_WINDOW_DAYS) * 86_400_000;
  for (const m of movements) {
    if (m.reason === COUNT_ADJUSTMENT_REASON) continue;
    const at = Date.parse(m.occurredAt);
    if (!Number.isFinite(at) || at < startMs || at > todayMs + 86_400_000) continue;
    const change = Number(m.change);
    if (Number.isFinite(change) && change > 0) out.add(m.stockItemId);
  }
  return out;
}

export interface StockPosition {
  ok: true;
  as_of: string;
  window_days: number;
  lines: StockLine[];
  lines_total: number;
  /** Lines left out because nothing is on hand, no threshold is set and none
   *  has come in for 90 days. Say the number; do not list them. */
  not_stocked_hidden: number;
  hint?: string;
}

/**
 * Tool 3 — where the stock stands, and what runs out first.
 *
 * `only_at_risk` is the "what will I run out of this week?" shape: anything
 * already low or out, plus anything with under a week of cover at last month's
 * usage. Without it the tool is a plain lookup ("how much spinach have I got?").
 */
export async function stockPosition(
  db: Db,
  orgId: string,
  input: { query?: string | null; onlyAtRisk?: boolean } = {},
  now: Date = new Date(),
): Promise<StockPosition | ToolFailure> {
  const today = now.toISOString().slice(0, 10);

  const { data: stockRows, error: stockError } = await db
    .from('pp_stock_items')
    .select('id, name, unit, on_hand, low_threshold')
    .eq('org_id', orgId)
    .limit(STOCK_READ_LIMIT)
    .returns<Array<{ id: string; name: string | null; unit: string | null; on_hand: number | string | null; low_threshold: number | string | null }>>();
  if (stockError) {
    if (isMissingRelation(stockError)) {
      return { ok: false, reason: 'not_available', note: 'Stock is not switched on for this business yet.' };
    }
    return { ok: false, reason: 'read_failed', note: 'The stock catalogue could not be read.' };
  }

  // Soft: pp_stock_thresholds is a later migration. Its absence means the
  // item's own threshold is the only one there is, not that stock is unreadable.
  const { data: thresholdRows } = await db
    .from('pp_stock_thresholds')
    .select('stock_item_id, low_threshold')
    .eq('org_id', orgId)
    .limit(STOCK_READ_LIMIT)
    .returns<Array<{ stock_item_id: string; low_threshold: number | string | null }>>();
  const thresholdById = new Map<string, number>();
  for (const row of thresholdRows ?? []) {
    const value = num(row.low_threshold);
    if (value != null) thresholdById.set(row.stock_item_id, value);
  }

  // 90 days, not 30: the usage tally still only reads the last 30 (tallyMovements
  // windows it itself), but "has anything come in on this line?" needs to look
  // further back than one month or a slow-moving line reads as abandoned.
  const windowStart = new Date(Date.parse(`${today}T00:00:00Z`) - RECEIPT_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: movementRows, error: movementError } = await db
    .from('pp_movements')
    .select('stock_item_id, change, reason, occurred_at')
    .eq('org_id', orgId)
    .gte('occurred_at', windowStart)
    .limit(MOVEMENT_READ_LIMIT)
    .returns<Array<{ stock_item_id: string; change: number | string | null; reason: string | null; occurred_at: string }>>();
  if (movementError && isMissingRelation(movementError)) {
    return { ok: false, reason: 'not_available', note: 'The stock movement ledger is not in this database yet.' };
  }

  const movements: StockCoverMovement[] = [];
  for (const row of movementRows ?? []) {
    const change = num(row.change);
    if (change == null || !row.stock_item_id || !row.occurred_at) continue;
    movements.push({ stockItemId: row.stock_item_id, change, reason: row.reason, occurredAt: row.occurred_at });
  }

  const tallies = tallyMovements(movements, { today });
  const receipted = receiptedItemIds(movements, { today });

  const items: StockLineInput[] = [];
  for (const row of stockRows ?? []) {
    const onHand = num(row.on_hand);
    // A MISSING threshold is 0 — "nobody has set one" — not a reason to drop the
    // line. `isNotStocked` is what decides whether it is worth listing, and it
    // needs to see these rows to be able to count them.
    const lowThreshold = thresholdById.get(row.id) ?? num(row.low_threshold) ?? 0;
    // A line with no name or no level cannot be spoken about truthfully
    // (stock-cover/run.ts drops these for the same reason).
    if (!row.name || onHand == null) continue;
    items.push({
      id: row.id,
      name: row.name,
      unit: row.unit ?? '',
      onHand,
      lowThreshold,
      hasRecentReceipt: receipted.has(row.id),
    });
  }

  const onlyAtRisk = input.onlyAtRisk === true;
  const { lines, not_stocked_hidden } = shapeStockPosition(items, tallies, {
    query: input.query,
    onlyAtRisk,
  });

  return {
    ok: true,
    as_of: today,
    window_days: WINDOW_DAYS,
    lines,
    lines_total: items.length,
    not_stocked_hidden,
    ...(lines.length === 0
      ? {
          hint: onlyAtRisk
            ? 'nothing is low, out, or under a week of cover'
            : 'no stock lines match',
        }
      : {}),
  };
}
