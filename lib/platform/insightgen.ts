/**
 * InsightGen — pure, client-safe layer.
 *
 * Same split every other module uses (`pricepilot.ts` / `planwise.ts` vs their
 * `-data.ts` siblings): the numbers a rule fires on live here so a client
 * component can quote them in the rule book without dragging
 * `insightgen-data.ts` — and with it `next/headers` via `supabase-server` —
 * into the browser bundle. `insightgen-data.ts` re-exports every name below,
 * so server callers are unaffected.
 */

// ---------------------------------------------------------------------------
// Tunables — every threshold used by a rule is named here so the UI can quote it
// ---------------------------------------------------------------------------

/** Days of history the cross-module aggregation covers. */
export const WINDOW_DAYS = 60;
/** Org gross-margin target when pl_targets has none (parity with PricePilot). */
export const DEFAULT_TARGET_MARGIN_PCT = 30;
/** Margin points below target before a food-cost variance is flagged. */
export const MARGIN_WARN_PP = 2;
export const MARGIN_CRITICAL_PP = 5;
/** Supplier price move (%) before a price-jump anomaly fires. */
export const PRICE_JUMP_WARN_PCT = 5;
export const PRICE_JUMP_CRITICAL_PCT = 10;
/** Waste cost week-on-week increase (%) before a waste-spike anomaly fires. */
export const WASTE_SPIKE_WARN_PCT = 25;
export const WASTE_SPIKE_CRITICAL_PCT = 50;
/** Labour as a % of same-day sales before a labour anomaly fires. */
export const LABOUR_WARN_PCT = 30;
export const LABOUR_CRITICAL_PCT = 40;
