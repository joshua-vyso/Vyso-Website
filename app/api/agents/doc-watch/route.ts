import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runDocWatchSweep, type DocWatchSummary } from '@/lib/platform/doc-watch/run';
import { agentOrgIds, NO_ORGS_MESSAGE } from '@/lib/platform/agents/org-allowlist';

export const maxDuration = 300;

/**
 * Doc Watch's nightly sweep (plan `.ai/plan_agents_phase_c.md`, C3, trigger 2).
 *
 * Doc Watch's PRIMARY trigger is not this route: a document scanned through
 * app/api/ai/extract gets its card immediately, inside Next's `after()`, so the
 * Brief is current the moment the user looks at it. This cron is the catch-up
 * for everything that path cannot see — documents ingested by the inbound-email
 * and WhatsApp routes, and any extraction whose `after()` was cut short by a
 * serverless instance being reclaimed.
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
 * ORG ALLOWLIST — the shared one, AGENTS_ORG_IDS falling back to
 * PRICE_WATCH_ORG_IDS. Unset or empty means DO NOTHING and say so.
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

  type RunResult = DocWatchSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  for (const orgId of orgIds) {
    try {
      summaries.push(await runDocWatchSweep(supabase, orgId, { log: (m) => console.log(m) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('doc-watch: sweep failed', orgId, message);
      summaries.push({ orgId, failed: true, error: message });
    }
  }

  return NextResponse.json({ ok: true, ran: summaries.length, summaries });
}
