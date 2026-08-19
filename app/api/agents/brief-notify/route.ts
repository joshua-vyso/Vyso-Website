import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { agentOrgIds, noOrgsMessage } from '@/lib/platform/agents/org-allowlist';
import { startTimeBudget } from '@/lib/platform/agents/time-budget';
import { runBriefNotify, type BriefNotifySummary } from '@/lib/platform/brief-notify';

/**
 * 60, not the 300 the nightly agents use.
 *
 * This route runs every fifteen minutes and does almost nothing on most of
 * them: one indexed read of `brief_schedules`, and an early return when nothing
 * is due. A tick that has taken a minute is a tick that is stuck — on the
 * agents' schedule it would keep a function warm for five minutes doing it, and
 * the next tick is only fourteen minutes behind anyway. The one-hour lookback
 * (DUE_LOOKBACK_MINUTES) is what makes an abandoned tick harmless.
 */
export const maxDuration = 60;

/**
 * Brief notifications — the fifteen-minute tick that sends people their briefs
 * (`.ai/plan_brief_schedules.md` §2).
 *
 * WHAT MAKES THIS SAFE TO RUN EVERY FIFTEEN MINUTES. Nothing here decides
 * "has this already been sent?" by looking at the clock. A run asks which slots
 * fell due in the last hour, drops the ones that already have a
 * `brief_deliveries` row for today's SAST date, and sends the rest — so a
 * doubled tick sends nothing, a tick that arrives twenty minutes late still
 * sends, and a Resend failure is retried on the next tick because the delivery
 * row is written AFTER the send, not before.
 *
 * IT SUPERSEDES THE MONDAY DIGEST, per org. `/api/agents/digest` now stands
 * down for any org that has at least one enabled schedule (see that route), so
 * an org that has moved to per-user briefs does not get both.
 *
 * NO `?now=` OVERRIDE, and no `?force=`. The plan considered both and rejected
 * them: a query parameter that changes which emails go out is a query parameter
 * that will eventually be pasted into a browser by someone debugging at 07:05,
 * and this route's whole contract is "one email per slot per day". Testing a
 * send goes through the settings card's "Send me a test now", which is
 * rate-limited, addressed to the caller alone, and writes no delivery row.
 *
 * ORGS — EVERY ORGANISATION, via the shared lib/platform/agents/org-allowlist.ts.
 * NOTHING ELSE CHANGED: `runBriefNotify` still sends only where a person has
 * actually created a schedule and a slot is due, so an org that has never opened
 * the settings card costs one indexed read of `brief_schedules` and nothing else.
 * Widening the org source is what makes a NEW org's first schedule work without
 * anybody editing an env var — which was the bug this replaced.
 *
 * The loop stops STARTING orgs 30s before `maxDuration` (60 here, so 30 seconds
 * of work) and names the rest in `orgsSkippedForTime`. A skipped org is picked up
 * by the next tick fifteen minutes later, well inside DUE_LOOKBACK_MINUTES — this
 * route is the one where a skip genuinely costs nothing.
 *
 * Env: RESEND_API_KEY (send), SUPABASE_SERVICE_ROLE_KEY (the schedules and the
 * recipients' addresses live behind it), CRON_SECRET (auth).
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

  // The service role is not optional here, and not only for RLS: the
  // recipients' email addresses live in `auth.users`, which only
  // `auth.admin.getUserById` can read (see lib/platform/brief-notify.ts).
  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured.' }, { status: 503 });
  }

  const orgs = await agentOrgIds(supabase);
  if (orgs.orgIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: noOrgsMessage(orgs), orgs });
  }

  // ONE clock for the whole tick. Reading `new Date()` per org would let two
  // orgs on the same run land on opposite sides of a minute boundary, which is
  // how a slot at 07:00 gets sent for one org and deferred for another.
  const now = new Date();

  type RunResult = BriefNotifySummary | { orgId: string; failed: true; error: string };
  const summaries: RunResult[] = [];
  const budget = startTimeBudget(maxDuration);
  const orgsSkippedForTime: string[] = [];
  for (const orgId of orgs.orgIds) {
    if (budget.spent()) {
      orgsSkippedForTime.push(orgId);
      continue;
    }
    try {
      summaries.push(await runBriefNotify(supabase, orgId, now));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('brief-notify: run failed', orgId, message);
      summaries.push({ orgId, failed: true, error: message });
    }
  }

  const sent = summaries.reduce((n, s) => n + ('sent' in s ? s.sent : 0), 0);
  return NextResponse.json({
    ok: true,
    sent,
    summaries,
    orgsSkippedForTime,
    elapsedMs: budget.elapsedMs(),
    orgs,
  });
}
