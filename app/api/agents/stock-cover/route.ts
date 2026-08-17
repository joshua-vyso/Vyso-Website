import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runStockCover, type StockCoverSummary } from '@/lib/platform/stock-cover/run';
import { agentOrgIds, NO_ORGS_MESSAGE } from '@/lib/platform/agents/org-allowlist';

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
 * ORG ALLOWLIST — the shared one, AGENTS_ORG_IDS falling back to
 * PRICE_WATCH_ORG_IDS (lib/platform/agents/org-allowlist.ts). Unset or empty
 * means DO NOTHING and say so.
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
    return NextResponse.json({ ok: true, ran: 0, message: NO_ORGS_MESSAGE });
  }

  type RunResult = StockCoverSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  for (const orgId of orgIds) {
    try {
      summaries.push(await runStockCover(supabase, orgId, { log: (m) => console.log(m) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('stock-cover: run failed', orgId, message);
      summaries.push({ orgId, failed: true, error: message });
    }
  }

  return NextResponse.json({ ok: true, ran: summaries.length, summaries });
}
