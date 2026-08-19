import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { runXeroWatch, type XeroWatchSummary } from '@/lib/platform/xero-watch/run';
import { agentOrgIds, NO_ORGS_MESSAGE } from '@/lib/platform/agents/org-allowlist';

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
 * ORG ALLOWLIST — the shared one, `AGENTS_ORG_IDS` falling back to
 * `PRICE_WATCH_ORG_IDS`. Note the ASYMMETRY with the sync route beside it, which
 * has no allowlist: syncing copies rows an owner has already consented to inside
 * Xero, whereas THIS route writes opinions into a customer's Brief, and an agent
 * that defaulted to "every org" would do that off data nobody has reviewed.
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
    // 200, not an error: the cron fired correctly and nothing is enabled. A 5xx
    // here would page us nightly for a working system.
    return NextResponse.json({ ok: true, ran: 0, message: NO_ORGS_MESSAGE });
  }

  // Serial, like the other agent routes': a handful of orgs and a handful of
  // queries each, and one org's failure must not cancel the others' in-flight
  // reads.
  type RunResult = XeroWatchSummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  for (const orgId of orgIds) {
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

  return NextResponse.json({ ok: true, ran: summaries.length, summaries });
}
