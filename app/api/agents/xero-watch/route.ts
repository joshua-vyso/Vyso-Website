import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runXeroWatch, type XeroWatchSummary } from '@/lib/platform/xero-watch/run';
import { agentOrgIds, noOrgsMessage } from '@/lib/platform/agents/org-allowlist';
import { startTimeBudget } from '@/lib/platform/agents/time-budget';

export const maxDuration = 300;

/**
 * Xero Watch's nightly run (plan `.ai/plan_plugins_xero.md`, X1).
 *
 * Reads the Xero mirror the 03:20 sync left, the supplier invoices Doc-U has
 * filed, and what Debtors Watch is already saying; writes a card for anything
 * worth the owner's morning — a broken connection, bills Doc-U read that never
 * reached Xero, a contact well past terms, the week's payables, a duplicated
 * bill. It observes and recommends; it never writes to Xero and never sends
 * anything.
 *
 * Runs at 03:30 UTC (vercel.json), TEN MINUTES AFTER the sync it reads and ten
 * before Doc Watch. The ordering is a courtesy to whoever reads the Brief, not a
 * correctness requirement: `runXeroWatch` is idempotent (findings dedupe on
 * unique(org_id, dedupe_key)), and if it ever ran first it would simply read an
 * older mirror — and say so, because that is rule 1's whole job.
 *
 * ORGS — EVERY ORGANISATION, via the shared lib/platform/agents/org-allowlist.ts.
 * The asymmetry with the sync route beside it (which never had an allowlist) is
 * now gone in the only direction it could go: both run for every org. An org
 * with no Xero connection is a cheap no-op here — `connectionStatus: null` and
 * nothing written — so "every org" costs one read for everyone who has not
 * connected Xero. The loop stops STARTING orgs 30s before `maxDuration` and names
 * the rest in `orgsSkippedForTime`.
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
    // 200, not an error: the cron fired correctly and there is nothing to run
    // for. A 5xx here would page us nightly for a working system.
    return NextResponse.json({ ok: true, ran: 0, message: noOrgsMessage(orgs), orgs });
  }

  // Serial, like the other agent routes': a handful of queries per org, and one
  // org's failure must not cancel the others' in-flight reads.
  type RunResult = XeroWatchSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  const budget = startTimeBudget(maxDuration);
  const orgsSkippedForTime: string[] = [];
  for (const orgId of orgs.orgIds) {
    if (budget.spent()) {
      orgsSkippedForTime.push(orgId);
      continue;
    }
    try {
      summaries.push(await runXeroWatch(supabase, orgId, { log: (m) => console.log(m) }));
    } catch (error) {
      // `runXeroWatch` turns ordinary data problems into warnings rather than
      // throwing, so reaching here means something genuinely unexpected broke.
      const message = error instanceof Error ? error.message : String(error);
      console.error('xero-watch: run failed', orgId, message);
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
