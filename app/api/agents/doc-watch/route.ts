import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runDocWatchSweep, type DocWatchSummary } from '@/lib/platform/doc-watch/run';
import { agentOrgIds, noOrgsMessage } from '@/lib/platform/agents/org-allowlist';
import { startTimeBudget } from '@/lib/platform/agents/time-budget';

export const maxDuration = 300;

/**
 * Doc Watch's nightly sweep (plan `.ai/plan_agents_phase_c.md`, C3, trigger 2).
 *
 * Doc Watch's PRIMARY trigger is not this route: a document scanned through
 * app/api/ai/extract gets its card immediately, inside Next's `after()`, so the
 * Brief is current the moment the user looks at it. This cron is the catch-up
 * for everything that path cannot see — documents ingested by the inbound-email
 * route, and any extraction whose `after()` was cut short by a serverless
 * instance being reclaimed.
 *
 * Runs at 03:40 UTC (see vercel.json), BEFORE Price Watch (03:45): the price
 * agent reads the same documents, and a Brief where "read overnight" appears
 * after the finding raised from it reads backwards.
 *
 * The window is 26 hours on a daily cron — an hour of deliberate overlap, so a
 * run that starts late cannot open a gap. Re-reading a document costs nothing:
 * every write is idempotent on `doc_watch:<document_id>` against
 * unique(org_id, dedupe_key).
 *
 * ORGS — EVERY ORGANISATION, via the shared lib/platform/agents/org-allowlist.ts
 * (`AGENTS_ORG_EXCLUDE` is the only var production is expected to set). The loop
 * stops STARTING orgs 30s before `maxDuration` and names the rest in
 * `orgsSkippedForTime`.
 *
 * A SKIP COSTS MORE HERE THAN ELSEWHERE, and the honest version is: the window is
 * 26 hours, so an org skipped for a whole day has a gap tomorrow's run cannot
 * see. It is not a lost card for most documents — the PRIMARY trigger above
 * writes them at extraction time — but a document ingested by email on a
 * skipped day would get no receipt. `orgsSkippedForTime` being non-empty on
 * THIS route is therefore the signal to fan out (see the Price Watch route's
 * note), not something to leave running.
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

  type RunResult = DocWatchSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  const budget = startTimeBudget(maxDuration);
  const orgsSkippedForTime: string[] = [];
  for (const orgId of orgs.orgIds) {
    if (budget.spent()) {
      orgsSkippedForTime.push(orgId);
      continue;
    }
    try {
      summaries.push(await runDocWatchSweep(supabase, orgId, { log: (m) => console.log(m) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('doc-watch: sweep failed', orgId, message);
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
