/**
 * Stock Cover — the pure detector. Stock lines and a movement ledger in,
 * findings out. No I/O, no clock of its own; run.ts does the reading and
 * writing.
 *
 * TWO RULES, TWO DIFFERENT CONVERSATIONS.
 *
 * (a) LOW COVER. The line is at or under its low threshold AND it is actually
 *     moving. "Days of cover" is the number the owner buys on — on_hand divided
 *     by the last month's average daily usage — and it is the reason this agent
 *     exists at all: ProcurePulse's alert list already says "low", but "low" on
 *     a line you use twice a month and "low" on a line you use twice a day are
 *     not the same morning. `rand_impact` is NULL here on purpose: nothing has
 *     been lost yet, and putting a rand figure on a reorder would be inventing
 *     one.
 *
 * (b) COUNT VARIANCE. The month's stock counts wrote off ≥ 5% of everything that
 *     came in. That is the shrinkage conversation — theft, breakage, mis-picks,
 *     or a receiving process that is booking more than it lands. Here the money
 *     IS known (units written off × the line's average cost), so `rand_impact`
 *     carries it.
 *
 * A LINE WITH NO USAGE GETS NO COVER FINDING. Dividing by zero is the obvious
 * reason; the real one is that "we have not touched this in a month" is not
 * "we are about to run out". The agent says nothing rather than something
 * alarming and wrong.
 *
 * `stockStatus` and `daysOfCover` are imported from lib/platform/procurepulse.ts
 * — the same pure helpers ProcurePulse's own screens render from — so a line the
 * Brief calls low is exactly a line the stock page shows as low. Nothing about
 * stock levels is re-derived here.
 *
 * DRAFTS ONLY. `recommendedAction` is a sentence. Nothing here raises a purchase
 * order, adjusts a level, or emails a supplier.
 */

import { daysOfCover, rand, stockStatus } from '../procurepulse.ts';
import {
  STOCK_COVER_AGENT,
  buildStockCoverDedupeKey,
  parseStockCoverDedupeKey,
  type StockCoverRule,
} from '../agents/dedupe-keys.ts';

/** The agent slug written to `agent_findings.agent`. */
export const AGENT_NAME = STOCK_COVER_AGENT;

export { buildStockCoverDedupeKey, parseStockCoverDedupeKey, type StockCoverRule };

/** The trailing window both rules read, in days. One month of trading — long
 *  enough that a quiet week does not read as a collapse in usage, short enough
 *  that last season's pattern does not drown this one's. */
export const WINDOW_DAYS = 30;

/** Rule (b): a count that writes off this share of the month's receipts is
 *  worth a look. 5% is the level at which shrinkage stops being the rounding
 *  error every kitchen has. */
export const COUNT_VARIANCE_FLOOR_PCT = 5;

/** The movement reason a stock count writes. One of MovementReason
 *  (lib/platform/types.ts) — matched exactly, because "an adjustment" and "we
 *  sold it" are the difference between the two rules below. */
export const COUNT_ADJUSTMENT_REASON = 'count_adjustment';

/** One stock line, flattened to what the detector needs. */
export interface StockCoverItem {
  stockItemId: string;
  name: string;
  /** Counting unit — boxes / kg / cases. Printed verbatim in the observation. */
  unit: string;
  onHand: number;
  lowThreshold: number;
  /** Average cost per counting unit. Null when the line has never been priced,
   *  in which case rule (b) reports the units and no rand figure. */
  avgUnitPrice: number | null;
}

/** One row of the `pp_movements` ledger. `change` is SIGNED — negative for
 *  consumption, positive for receipts. */
export interface StockCoverMovement {
  stockItemId: string;
  change: number;
  /** A MovementReason for new rows; older rows may carry other strings. */
  reason: string | null;
  /** ISO timestamp. */
  occurredAt: string;
}

export interface StockCoverFinding {
  rule: StockCoverRule;
  stockItemId: string;
  itemName: string;
  observation: string;
  recommendedAction: string | null;
  /** Null for rule (a) — nothing is at stake yet, so the card says nothing. */
  randImpact: number | null;
  dedupeKey: string;
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * "before Friday" / "before 29 August".
 *
 * The plan's copy is "Reorder before {weekday}", which reads perfectly when the
 * line runs out this week and becomes a riddle when it does not — "before
 * Saturday" said twelve days out names the wrong Saturday. So a weekday is used
 * only inside the coming week (the next six days, where there is exactly one of
 * each), and anything further out is given as a date. See .ai/implementation.md,
 * "Phase C agents".
 */
function reorderBy(today: string, daysAhead: number): string {
  const base = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(base)) return 'soon';
  const when = new Date(base + Math.max(0, Math.floor(daysAhead)) * 86_400_000);
  if (daysAhead <= 6) return WEEKDAYS[when.getUTCDay()];
  return `${when.getUTCDate()} ${MONTHS[when.getUTCMonth()]}`;
}

/** A number the owner would say out loud: 12.4 → "12", 0.6 → "1", 0 stays 0. */
function wholeDays(n: number): number {
  return n > 0 && n < 1 ? 1 : Math.round(n);
}

/**
 * Measurement abbreviations that never take a plural — "10 kgs" is not a thing.
 * Everything else in `pp_stock_items.unit` is an English count noun (box, case,
 * crate, tub, bag, bunch, sleeve, bundle) and does.
 */
const UNCOUNTABLE_UNITS = new Set(['kg', 'g', 'l', 'ml', 'mm', 'cm', 'm', 't']);

/** "14 boxes", "10 kg", "1 case". The catalogue stores units in the singular, so
 *  a card that said "wrote off 14 box" would read as a bug in a sentence a human
 *  is meant to trust. */
function qtyWithUnit(qty: number, unit: string): string {
  const u = unit.trim();
  if (!u) return `${qty}`;
  if (qty === 1 || UNCOUNTABLE_UNITS.has(u.toLowerCase())) return `${qty} ${u}`;
  // English plural, enough for every unit this catalogue uses.
  const plural = /(?:s|x|z|ch|sh)$/i.test(u) ? `${u}es` : `${u}s`;
  return `${qty} ${plural}`;
}

/**
 * Findings for every stock line over either line, worst first (rule (b)'s money
 * cases ahead of rule (a)'s levels, since one is a loss already taken and the
 * other is a decision still to make).
 *
 * `today` (yyyy-mm-dd) and `isoWeek` are passed in rather than read from a clock
 * so a run, a test and a hand dry-run against the demo seed all produce one
 * deterministic answer.
 */
export function detectStockCoverFindings(
  items: readonly StockCoverItem[],
  movements: readonly StockCoverMovement[],
  params: { today: string; isoWeek: string },
): StockCoverFinding[] {
  const { today, isoWeek } = params;
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(todayMs)) return [];
  // Inclusive of the window's first day: a movement exactly WINDOW_DAYS ago is
  // "last month's usage", not older than it.
  const windowStartMs = todayMs - WINDOW_DAYS * 86_400_000;

  interface Tally {
    /** Units consumed (positive number) excluding count adjustments — real
     *  usage, so a stock count cannot masquerade as demand. */
    consumed: number;
    /** Units received (positive number). */
    received: number;
    /** Signed sum of count adjustments — negative when the count found less. */
    adjusted: number;
  }
  const tallies = new Map<string, Tally>();
  for (const m of movements) {
    const at = Date.parse(m.occurredAt);
    if (!Number.isFinite(at) || at < windowStartMs || at > todayMs + 86_400_000) continue;
    const change = Number(m.change);
    if (!Number.isFinite(change) || change === 0) continue;
    const t = tallies.get(m.stockItemId) ?? { consumed: 0, received: 0, adjusted: 0 };
    if (m.reason === COUNT_ADJUSTMENT_REASON) {
      t.adjusted += change;
    } else if (change > 0) {
      t.received += change;
    } else {
      t.consumed += -change;
    }
    tallies.set(m.stockItemId, t);
  }

  const findings: StockCoverFinding[] = [];
  for (const item of items) {
    const t = tallies.get(item.stockItemId) ?? { consumed: 0, received: 0, adjusted: 0 };

    // ---- (a) low cover --------------------------------------------------
    // `stockStatus` is ProcurePulse's own definition: 'out' at or below zero,
    // 'low' at or below the threshold. Anything it calls in_stock is not this
    // agent's business.
    if (stockStatus({ on_hand: item.onHand, low_threshold: item.lowThreshold }) !== 'in_stock') {
      const cover = daysOfCover(item.onHand, t.consumed / WINDOW_DAYS);
      // null ⇒ no usage in the window. Say nothing: see the docblock.
      if (cover != null) {
        const days = wholeDays(cover);
        findings.push({
          rule: 'low_cover',
          stockItemId: item.stockItemId,
          itemName: item.name,
          observation:
            `${item.name} has ~${days} ${days === 1 ? 'day' : 'days'} of cover at last month's usage — ` +
            `${qtyWithUnit(item.onHand, item.unit)} on hand, threshold ${item.lowThreshold}.`,
          // A line that is already at zero has nothing to reorder "before".
          recommendedAction:
            days === 0
              ? 'Reorder now — nothing is left on this line'
              : `Reorder before ${reorderBy(today, days)}`,
          // Nothing has been lost yet. A rand figure here would be invented.
          randImpact: null,
          dedupeKey: buildStockCoverDedupeKey('low_cover', item.stockItemId, isoWeek),
        });
      }
    }

    // ---- (b) count variance ---------------------------------------------
    // Measured against what CAME IN, not against what is on hand: a line that
    // received 130kg and wrote off 10kg has a 7.7% problem whether it holds 86kg
    // or 860kg.
    if (t.received > 0 && t.adjusted < 0) {
      const pct = (-t.adjusted / t.received) * 100;
      if (pct >= COUNT_VARIANCE_FLOOR_PCT) {
        const units = Math.round(-t.adjusted * 100) / 100;
        const randImpact =
          item.avgUnitPrice != null && Number.isFinite(item.avgUnitPrice)
            ? units * item.avgUnitPrice
            : null;
        findings.push({
          rule: 'count_variance',
          stockItemId: item.stockItemId,
          itemName: item.name,
          observation:
            `Stock count wrote off ${qtyWithUnit(units, item.unit)} of ${item.name} this month ` +
            `(−${Math.round(pct)}% of what came in)` +
            `${randImpact != null ? ` — ${rand(randImpact)} at cost` : ''} — worth a look.`,
          recommendedAction: 'Check the receiving and count sheets for this line',
          randImpact,
          dedupeKey: buildStockCoverDedupeKey('count_variance', item.stockItemId, isoWeek),
        });
      }
    }
  }

  return findings.sort((a, b) => {
    // A loss already taken outranks a decision still to be made.
    const rank = (f: StockCoverFinding) => (f.rule === 'count_variance' ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if ((b.randImpact ?? 0) !== (a.randImpact ?? 0)) return (b.randImpact ?? 0) - (a.randImpact ?? 0);
    return a.itemName.localeCompare(b.itemName);
  });
}
