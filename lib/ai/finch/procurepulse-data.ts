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
  lowThreshold: number;
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
 * Stock lines → what the tool answers with. PURE: the query around it is two
 * `.select()`s, and everything that could be quietly wrong (the usage window,
 * the ranking, which lines count as at risk) is here and tested.
 *
 * RANKED BY HOW SOON, NOT BY HOW LOW. A line at 2 of 40 that nobody touches is
 * not the morning's problem; a line at 12 of 16 that goes out the door daily
 * is. Lines with no usage sort last — unknown is not urgent, and it is not
 * calm either, so they are still listed.
 */
export function shapeStockPosition(
  items: readonly StockLineInput[],
  tallies: ReadonlyMap<string, MovementTally>,
  opts: { query?: string | null; onlyAtRisk?: boolean; limit?: number } = {},
): StockLine[] {
  const wanted = (opts.query ?? '').trim().toLowerCase();
  const limit = opts.limit ?? LINE_LIMIT;

  const lines: StockLine[] = [];
  for (const item of items) {
    if (wanted && !item.name.toLowerCase().includes(wanted)) continue;
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

  return kept
    .sort((a, b) => {
      const ac = a.days_of_cover ?? Number.POSITIVE_INFINITY;
      const bc = b.days_of_cover ?? Number.POSITIVE_INFINITY;
      if (ac !== bc) return ac - bc;
      return a.name.localeCompare(b.name);
    })
    .slice(0, Math.max(1, limit));
}

export interface StockPosition {
  ok: true;
  as_of: string;
  window_days: number;
  lines: StockLine[];
  lines_total: number;
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

  const windowStart = new Date(Date.parse(`${today}T00:00:00Z`) - WINDOW_DAYS * 86_400_000).toISOString();
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

  const items: StockLineInput[] = [];
  for (const row of stockRows ?? []) {
    const onHand = num(row.on_hand);
    const lowThreshold = thresholdById.get(row.id) ?? num(row.low_threshold);
    // A line with no name, level or threshold cannot be spoken about truthfully
    // (stock-cover/run.ts drops these for the same reason).
    if (!row.name || onHand == null || lowThreshold == null) continue;
    items.push({ id: row.id, name: row.name, unit: row.unit ?? '', onHand, lowThreshold });
  }

  const tallies = tallyMovements(movements, { today });
  const onlyAtRisk = input.onlyAtRisk === true;
  const lines = shapeStockPosition(items, tallies, { query: input.query, onlyAtRisk });

  return {
    ok: true,
    as_of: today,
    window_days: WINDOW_DAYS,
    lines,
    lines_total: items.length,
    ...(lines.length === 0
      ? {
          hint: onlyAtRisk
            ? 'nothing is low, out, or under a week of cover'
            : 'no stock lines match',
        }
      : {}),
  };
}
