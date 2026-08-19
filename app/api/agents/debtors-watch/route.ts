import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runDebtorsWatch, type DebtorsWatchSummary } from '@/lib/platform/debtors-watch/run';
import { agentOrgIds, noOrgsMessage } from '@/lib/platform/agents/org-allowlist';
import { startTimeBudget } from '@/lib/platform/agents/time-budget';

export const maxDuration = 300;

/**
 * Debtors Watch's nightly run (plan `.ai/plan_agents_phase_c.md`, C1).
 *
 * Reads the org's invoice book through the SAME derivations the OrderFlow
 * Dashboard and Finch's chat tools use (lib/platform/orderflow-debtors.ts), and
 * writes a card for every customer whose lateness has crossed the line — where
 * The Brief (/app) and the Monday digest pick it up. It observes and
 * recommends; it never sends a statement or holds an order.
 *
 * Runs on a Vercel Cron at 03:50 UTC (see vercel.json), between Price Watch
 * (03:45) and Stock Cover (03:55) so the three of them land in one window and a
 * 300s ceiling is never shared. The schedule is not load-bearing: runDebtorsWatch
 * is idempotent (findings dedupe on unique(org_id, dedupe_key)), so a missed or
 * doubled run costs nothing.
 *
 * ORGS — EVERY ORGANISATION, via the shared lib/platform/agents/org-allowlist.ts
 * (`AGENTS_ORG_EXCLUDE` is the only var production is expected to set). The loop
 * also stops STARTING orgs 30s before `maxDuration` and names the rest in
 * `orgsSkippedForTime`; a skipped org is picked up by tomorrow's run, which costs
 * nothing because the findings dedupe.
 *
 * Authenticated with CRON_SECRET — Vercel Cron sends it as a bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const orgs = await agentOrgIds(supabase);
  if (orgs.orgIds.length === 0) {
    // 200, not an error: the cron fired correctly and there is simply nothing to
    // run for. A 5xx here would page us nightly for a working system.
    return NextResponse.json({ ok: true, ran: 0, message: noOrgsMessage(orgs), orgs });
  }

  // Serial, like Price Watch's route: these are a handful of queries per org, and
  // running them one at a time keeps one org's failure from cancelling the
  // others' in-flight reads.
  type RunResult = DebtorsWatchSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  const budget = startTimeBudget(maxDuration);
  const orgsSkippedForTime: string[] = [];
  for (const orgId of orgs.orgIds) {
    // Checked BEFORE the org starts and never during it: an org cut in half is
    // how half a Brief gets written.
    if (budget.spent()) {
      orgsSkippedForTime.push(orgId);
      continue;
    }
    try {
      summaries.push(await runDebtorsWatch(supabase, orgId, { log: (m) => console.log(m) }));
    } catch (error) {
      // runDebtorsWatch turns ordinary data problems into warnings rather than
      // throwing, so reaching here means something genuinely unexpected broke.
      // One org's failure must not cancel the others.
      const message = error instanceof Error ? error.message : String(error);
      console.error('debtors-watch: run failed', orgId, message);
      summaries.push({ orgId, failed: true, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    ran: summaries.length,
    summaries,
    orgsSkippedForTime,
    elapsedMs: budget.elapsedMs(),
    orgs,
  });
}
