import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runStockCover, type StockCoverSummary } from '@/lib/platform/stock-cover/run';
import { agentOrgIds, noOrgsMessage } from '@/lib/platform/agents/org-allowlist';
import { startTimeBudget } from '@/lib/platform/agents/time-budget';

export const maxDuration = 300;

/**
 * Stock Cover's nightly run (plan `.ai/plan_agents_phase_c.md`, C2).
 *
 * Reads the org's stock catalogue and the last 30 days of its movement ledger,
 * and writes a card for every line that is short of cover or whose monthly count
 * wrote off a material share of what came in — where The Brief (/app) and the
 * Monday digest pick it up. It observes and recommends; it never raises an order
 * or adjusts a level.
 *
 * Runs on a Vercel Cron at 03:55 UTC (see vercel.json), after Price Watch (03:45)
 * and Debtors Watch (03:50). The schedule is not load-bearing: runStockCover is
 * idempotent (findings dedupe on unique(org_id, dedupe_key), keyed by ISO week),
 * so a missed or doubled run costs nothing.
 *
 * ORGS — EVERY ORGANISATION, via the shared lib/platform/agents/org-allowlist.ts
 * (`AGENTS_ORG_EXCLUDE` is the only var production is expected to set). The loop
 * stops STARTING orgs 30s before `maxDuration` and names the rest in
 * `orgsSkippedForTime`; tomorrow's run picks them up, keyed by the same ISO week.
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
    return NextResponse.json({ ok: true, ran: 0, message: noOrgsMessage(orgs), orgs });
  }

  type RunResult = StockCoverSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  const budget = startTimeBudget(maxDuration);
  const orgsSkippedForTime: string[] = [];
  for (const orgId of orgs.orgIds) {
    if (budget.spent()) {
      orgsSkippedForTime.push(orgId);
      continue;
    }
    try {
      summaries.push(await runStockCover(supabase, orgId, { log: (m) => console.log(m) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('stock-cover: run failed', orgId, message);
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
