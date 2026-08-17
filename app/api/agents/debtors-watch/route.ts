import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runDebtorsWatch, type DebtorsWatchSummary } from '@/lib/platform/debtors-watch/run';
import { agentOrgIds, NO_ORGS_MESSAGE } from '@/lib/platform/agents/org-allowlist';

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
 * ORG ALLOWLIST — the shared one, AGENTS_ORG_IDS falling back to
 * PRICE_WATCH_ORG_IDS (lib/platform/agents/org-allowlist.ts). Unset or empty
 * means DO NOTHING and say so: an agent that defaulted to "every org" would put
 * customers' debtors books on Briefs nobody asked to have them on.
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

  const orgIds = agentOrgIds();
  if (orgIds.length === 0) {
    // 200, not an error: the cron fired correctly and there is simply nothing
    // enabled. A 5xx here would page us nightly for a working system.
    return NextResponse.json({ ok: true, ran: 0, message: NO_ORGS_MESSAGE });
  }

  // Serial, like Price Watch's route: these are a handful of orgs and a handful
  // of queries each, and running them one at a time keeps one org's failure from
  // cancelling the others' in-flight reads.
  type RunResult = DebtorsWatchSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  for (const orgId of orgIds) {
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

  return NextResponse.json({ ok: true, ran: summaries.length, summaries });
}
