/**
 * THE TIME BUDGET every /api/agents/* route runs its org loop against.
 *
 * The agents used to run for one org, so a serial loop inside a 300s function
 * was free. They now run for EVERY organisation (lib/platform/agents/
 * org-allowlist.ts), and a serial loop over a growing list has an obvious end
 * state: Vercel kills the invocation mid-org at `maxDuration`, the response is
 * never written, and the run reports NOTHING — not the twelve orgs that
 * succeeded, not the one that was cut in half.
 *
 * A killed invocation is not a correctness problem for the agents themselves.
 * Every run is idempotent (findings dedupe on unique(org_id, dedupe_key), price
 * points upsert on (document_id, line_index)), so tomorrow's run redoes the tail
 * and nothing is double-counted. It is a VISIBILITY problem: nobody can tell the
 * difference between "we ran out of time" and "the cron is broken".
 *
 * So a route stops STARTING orgs once the elapsed time crosses
 * `maxDuration - RESERVE_SECONDS`, names the orgs it did not start in
 * `orgsSkippedForTime`, and returns a normal 200. The reserve is the headroom for
 * the org already in flight to finish and the JSON to be written.
 *
 * It is deliberately a "may I start another?" check and NEVER a cancellation:
 * cutting an org off halfway is how half a Brief gets written. The worst case is
 * one org that takes longer than the reserve and gets killed anyway — the same
 * outcome as today, for one org instead of the whole run.
 *
 * `now` is injectable because that is the only way to test this without sleeping.
 * No `.ts`-suffixed relative imports needed here: this module has no imports at
 * all, which is also why the routes can pull it in without cost.
 */

/**
 * Seconds held back from `maxDuration` for the in-flight org to finish and the
 * response to be serialised. Thirty is chosen against the slowest thing an org
 * does — Price Watch's model calls for unseen line descriptions — and is not a
 * guarantee, just the difference between usually reporting and never reporting.
 */
export const TIME_BUDGET_RESERVE_SECONDS = 30;

export interface TimeBudget {
  /** True when no NEW org may be started. Never cancels one already running. */
  spent(): boolean;
  /** Milliseconds since the budget started — for the run's JSON. */
  elapsedMs(): number;
}

/**
 * Start the clock. `maxDurationSeconds` is the route's own `maxDuration` export,
 * passed in rather than read from anywhere, so the guard cannot drift from the
 * limit Vercel actually enforces on that route.
 *
 * `maxDuration` MUST be larger than the reserve or the budget is zero and the
 * route starts nothing at all. The shortest one in this codebase is
 * brief-notify's 60, which leaves 30 seconds — plenty for a route whose whole job
 * on most ticks is one indexed read. The clamp is there so a future 20 cannot
 * produce a negative budget and a guard that never fires; it will still make that
 * route a no-op, loudly, on its first run.
 */
export function startTimeBudget(
  maxDurationSeconds: number,
  now: () => number = Date.now,
): TimeBudget {
  const startedAt = now();
  const budgetMs = Math.max(0, (maxDurationSeconds - TIME_BUDGET_RESERVE_SECONDS) * 1000);
  return {
    spent: () => now() - startedAt >= budgetMs,
    elapsedMs: () => now() - startedAt,
  };
}
