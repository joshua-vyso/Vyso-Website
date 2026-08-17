/**
 * Stock Cover — the run loop. Reads one org's stock catalogue and the last
 * month of its movement ledger, asks detect.ts which lines are worth a card,
 * and writes what comes back to `agent_findings`. It observes and recommends; it
 * never raises a purchase order, adjusts a level or contacts a supplier.
 *
 * Same four rules as the other Phase C agents (see debtors-watch/run.ts): the
 * org id is the only fence, re-runs are free of side effects, ordinary data
 * problems are warnings, and nothing auto-closes.
 *
 * IDEMPOTENCY IS THE ISO WEEK. `stock_cover:<rule>:<stock_item_id>:<iso-week>`
 * against unique(org_id, dedupe_key). A line that is low on Monday is still low
 * on Tuesday and the owner does not need to hear it again; a week later, still
 * low, is new information and gets a new card.
 *
 * WHICH THRESHOLD WINS. `pp_stock_thresholds.low_threshold` is preferred over
 * `pp_stock_items.low_threshold` when a row exists and carries a value — the
 * same precedence InsightGen's stock-low rule uses. The two are supposed to
 * agree (supabase/demo-all-in-one.sql pins them), and preferring the same one
 * everywhere is what keeps the Brief and ProcurePulse from disagreeing about
 * which lines are low if they ever drift.
 *
 * NO MODEL CALLS. Every sentence is a template over numbers the business already
 * has. There is nothing here a language model would make truer.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation, isUniqueViolation } from '../db-errors.ts';
import { isoWeekOf } from '../price-watch/run.ts';
import { todayIso } from '../orderflow-debtors.ts';
import {
  AGENT_NAME,
  WINDOW_DAYS,
  detectStockCoverFindings,
  type StockCoverItem,
  type StockCoverMovement,
} from './detect.ts';

export { AGENT_NAME };

export interface RunStockCoverOptions {
  /** Compute and report everything; write NOTHING. */
  dryRun?: boolean;
  /** Pin "today" (yyyy-mm-dd). Defaults to the UTC day. */
  today?: string;
  log?: (message: string) => void;
}

export interface StockCoverSampleFinding {
  dedupeKey: string;
  observation: string;
  randImpact: number | null;
}

export interface StockCoverSummary {
  orgId: string;
  dryRun: boolean;
  /** True when a table this agent needs isn't in the database yet. */
  tablesMissing: boolean;
  today: string;
  isoWeek: string;
  stockLinesSeen: number;
  movementsSeen: number;
  findingsDetected: number;
  findingsWritten: number;
  findingsSkippedDuplicate: number;
  findingErrors: number;
  sampleFindings: StockCoverSampleFinding[];
  warnings: string[];
}

const SAMPLE_LIMIT = 5;

/** A catalogue read is capped — an org with tens of thousands of lines is not
 *  this agent's problem tonight, and an unbounded select inside a 300s cron is
 *  how a nightly job becomes an outage. */
const STOCK_LIMIT = 2000;
/** One month of ledger for a couple of thousand lines. Same reasoning. */
const MOVEMENT_LIMIT = 20_000;

interface StockRow {
  id: string;
  name: string | null;
  unit: string | null;
  on_hand: number | string | null;
  low_threshold: number | string | null;
  avg_unit_price: number | string | null;
}

interface ThresholdRow {
  stock_item_id: string;
  low_threshold: number | string | null;
}

interface MovementRow {
  stock_item_id: string;
  change: number | string | null;
  reason: string | null;
  occurred_at: string;
}

/** PostgREST returns numerics as number|string depending on driver/precision. */
function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function runStockCover(
  supabase: SupabaseClient,
  orgId: string,
  opts: RunStockCoverOptions = {},
): Promise<StockCoverSummary> {
  const dryRun = opts.dryRun === true;
  const today = opts.today ?? todayIso();
  const log = opts.log ?? (() => {});

  const summary: StockCoverSummary = {
    orgId,
    dryRun,
    tablesMissing: false,
    today,
    isoWeek: isoWeekOf(today),
    stockLinesSeen: 0,
    movementsSeen: 0,
    findingsDetected: 0,
    findingsWritten: 0,
    findingsSkippedDuplicate: 0,
    findingErrors: 0,
    sampleFindings: [],
    warnings: [],
  };

  // ---- 1. The catalogue ---------------------------------------------------
  const { data: stockRows, error: stockError } = await supabase
    .from('pp_stock_items')
    .select('id, name, unit, on_hand, low_threshold, avg_unit_price')
    .eq('org_id', orgId)
    .limit(STOCK_LIMIT)
    .returns<StockRow[]>();

  if (stockError) {
    if (isMissingRelation(stockError)) {
      summary.tablesMissing = true;
      summary.warnings.push('pp_stock_items does not exist in this database — nothing was read.');
      return summary;
    }
    throw new Error(`Could not read stock items: ${stockError.message}`);
  }

  const stock = stockRows ?? [];
  summary.stockLinesSeen = stock.length;
  if (stock.length === 0) {
    log(`stock-cover: ${orgId} has no stock lines — nothing to read.`);
    return summary;
  }

  // ---- 2. Threshold overrides --------------------------------------------
  // Soft: pp_stock_thresholds is a later migration and may not exist. When it
  // doesn't, every line falls back to its own catalogue threshold, which is what
  // ProcurePulse itself renders from.
  const thresholdById = new Map<string, number>();
  const { data: thresholdRows, error: thresholdError } = await supabase
    .from('pp_stock_thresholds')
    .select('stock_item_id, low_threshold')
    .eq('org_id', orgId)
    .limit(STOCK_LIMIT)
    .returns<ThresholdRow[]>();
  if (thresholdError) {
    if (!isMissingRelation(thresholdError)) {
      summary.warnings.push(`pp_stock_thresholds read failed: ${thresholdError.message}`);
    }
  } else {
    for (const row of thresholdRows ?? []) {
      const value = num(row.low_threshold);
      if (value != null) thresholdById.set(row.stock_item_id, value);
    }
  }

  // ---- 3. The last month of ledger ---------------------------------------
  const windowStart = new Date(
    Date.parse(`${today}T00:00:00Z`) - WINDOW_DAYS * 86_400_000,
  ).toISOString();
  const { data: movementRows, error: movementError } = await supabase
    .from('pp_movements')
    .select('stock_item_id, change, reason, occurred_at')
    .eq('org_id', orgId)
    .gte('occurred_at', windowStart)
    .limit(MOVEMENT_LIMIT)
    .returns<MovementRow[]>();

  if (movementError) {
    if (isMissingRelation(movementError)) {
      summary.tablesMissing = true;
      summary.warnings.push('pp_movements does not exist in this database — nothing was read.');
      return summary;
    }
    throw new Error(`Could not read stock movements: ${movementError.message}`);
  }

  const movements: StockCoverMovement[] = [];
  for (const row of movementRows ?? []) {
    const change = num(row.change);
    if (change == null || !row.stock_item_id || !row.occurred_at) continue;
    movements.push({
      stockItemId: row.stock_item_id,
      change,
      reason: row.reason,
      occurredAt: row.occurred_at,
    });
  }
  summary.movementsSeen = movements.length;

  // ---- 4. Flatten the catalogue for the detector --------------------------
  const items: StockCoverItem[] = [];
  let unusable = 0;
  for (const row of stock) {
    const onHand = num(row.on_hand);
    const lowThreshold = thresholdById.get(row.id) ?? num(row.low_threshold);
    // A line with no name, no level or no threshold cannot be spoken about
    // truthfully, so it is skipped rather than described with a placeholder.
    if (!row.name || onHand == null || lowThreshold == null) {
      unusable += 1;
      continue;
    }
    items.push({
      stockItemId: row.id,
      name: row.name,
      unit: row.unit ?? '',
      onHand,
      lowThreshold,
      avgUnitPrice: num(row.avg_unit_price),
    });
  }
  if (unusable > 0) {
    summary.warnings.push(`${unusable} stock line(s) skipped: no name, level or threshold to read.`);
  }

  // ---- 5. Detect ----------------------------------------------------------
  const findings = detectStockCoverFindings(items, movements, {
    today,
    isoWeek: summary.isoWeek,
  });
  summary.findingsDetected = findings.length;
  log(
    `stock-cover: ${orgId} — ${items.length} lines, ${movements.length} movements in ${WINDOW_DAYS}d, ` +
      `${findings.length} findings.`,
  );

  // ---- 6. Write -----------------------------------------------------------
  for (const f of findings) {
    if (summary.sampleFindings.length < SAMPLE_LIMIT) {
      summary.sampleFindings.push({
        dedupeKey: f.dedupeKey,
        observation: f.observation,
        randImpact: f.randImpact,
      });
    }

    if (dryRun) {
      summary.findingsWritten += 1;
      continue;
    }

    const { error } = await supabase.from('agent_findings').insert({
      org_id: orgId,
      agent: AGENT_NAME,
      observation: f.observation,
      // Deliberately EMPTY: a stock finding cites no documents. Which line it is
      // about lives in the dedupe key, and the Brief's evidence resolver reads
      // it from there (lib/platform/agents/dedupe-keys.ts).
      evidence_refs: [],
      rand_impact: f.randImpact,
      recommended_action: f.recommendedAction,
      status: 'new',
      dedupe_key: f.dedupeKey,
    });

    if (!error) {
      summary.findingsWritten += 1;
    } else if (isMissingRelation(error)) {
      summary.tablesMissing = true;
      summary.warnings.push('agent_findings does not exist in this database — nothing was written.');
      break;
    } else if (isUniqueViolation(error)) {
      // Already on the Brief for this line, this rule, this week. Idempotency.
      summary.findingsSkippedDuplicate += 1;
    } else {
      summary.findingErrors += 1;
      summary.warnings.push(`agent_findings insert failed: ${error.message}`);
    }
  }

  return summary;
}
