import { NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { canSeeMoney } from '@/lib/platform/access';
import { rateLimitAllowed } from '@/lib/platform/rate-limit';
import { connectedXeroOrgIds, syncXeroOrg, type XeroSyncSummary } from '@/lib/platform/xero-sync';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * The Xero sync's two doors (plan `.ai/plan_plugins_xero.md`, X1 "Sync + mirror").
 *
 * GET  — the nightly cron. `Bearer CRON_SECRET`, every connected org.
 * POST — "Sync now" on the plugin page. A signed-in owner/admin, their own org,
 *        six times an hour.
 *
 * ONE ROUTE, TWO METHODS, rather than two routes, because they run the SAME
 * function over the same tables and the only difference is who is asking and
 * for whom. Splitting them would put the org-selection logic in two files and
 * invite them to disagree about what "connected" means.
 *
 * WHY THIS IS UNDER `/api/integrations/xero/` AND NOT `/api/agents/`. It is not
 * an agent: it writes no findings and forms no opinion. It is the integration
 * moving rows, and it sits with the connect/callback/disconnect routes that own
 * the same connection.
 *
 * THE SERVICE ROLE IS USED ON BOTH PATHS, including the signed-in one — and that
 * is the one thing here worth reading twice. The mirror is service-role-write
 * only (supabase/xero-sync.sql), because the sync also runs from a cron with no
 * session for RLS to key off. So the POST path establishes the caller's right to
 * sync THEIR org — signed in, owner or admin, `session.org.id` and nothing they
 * sent — and then hands that org id, and only that org id, to `syncXeroOrg`,
 * which filters every statement on it. The org id never comes from the request
 * body. There is no body.
 *
 * NO CRON SCHEDULE COLLISION. 03:20 UTC, twenty minutes before Doc Watch and ten
 * before Xero Watch reads what this wrote (vercel.json). The order matters to a
 * reader of the Brief, not to correctness: `syncXeroOrg` is idempotent and Xero
 * Watch simply sees an older mirror if it ever ran first.
 */

/** Six an hour. Enough that an owner watching a reconciliation can re-sync after
 *  each change they make in Xero; low enough that a stuck browser tab cannot
 *  spend the tenant's whole rate-limit budget. */
const MANUAL_SYNC_LIMIT = 6;
const MANUAL_SYNC_WINDOW_SECONDS = 3_600;

type RunResult = XeroSyncSummary | { orgId: string; failed: true; error: string };

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

  // NO ORG ALLOWLIST HERE, unlike the agent routes — and the difference is
  // deliberate. `AGENTS_ORG_IDS` exists because an agent WRITES OPINIONS into a
  // customer's Brief off data nobody has reviewed, so it must be opted into. This
  // route only copies rows an owner has already granted Vyso access to through
  // Xero's own consent screen. The connection IS the opt-in, and gating it a
  // second time would mean a customer who connected Xero and saw nothing happen.
  const orgIds = await connectedXeroOrgIds(supabase);
  if (orgIds.length === 0) {
    // 200, not an error: the cron fired correctly and no org has Xero connected.
    return NextResponse.json({ ok: true, ran: 0, message: 'No organisation has Xero connected.' });
  }

  // Serial, like the agent routes': these are a handful of orgs, each already
  // paced against Xero's per-tenant rate limit, and running them one at a time
  // keeps one org's failure from cancelling the others' in-flight reads.
  const summaries: RunResult[] = [];
  for (const orgId of orgIds) {
    try {
      summaries.push(await syncXeroOrg(supabase, orgId, { log: (m) => console.log(m) }));
    } catch (error) {
      // `syncXeroOrg` turns ordinary problems into warnings rather than throwing,
      // so reaching here means something genuinely unexpected broke.
      const message = error instanceof Error ? error.message : String(error);
      console.error('xero-sync: run failed', orgId, message);
      summaries.push({ orgId, failed: true, error: message });
    }
  }

  return NextResponse.json({ ok: true, ran: summaries.length, summaries });
}

export async function POST() {
  const session = await getPlatformSession();
  if (!session?.org) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // The same gate the plugin page carries. A member cannot see the button; this
  // is what stops them calling the endpoint it would have posted to.
  if (!canSeeMoney(session.profile?.role)) {
    return NextResponse.json({ error: 'Only an owner or admin can sync Xero.' }, { status: 403 });
  }

  const orgId = session.org.id;
  const allowed = await rateLimitAllowed(
    `xero-sync:${orgId}`,
    MANUAL_SYNC_LIMIT,
    MANUAL_SYNC_WINDOW_SECONDS,
  );
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Xero has been synced ${MANUAL_SYNC_LIMIT} times in the last hour. It syncs itself every night — try again shortly.`,
      },
      { status: 429 },
    );
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  try {
    const summary = await syncXeroOrg(supabase, orgId);
    return NextResponse.json({ ok: summary.ok, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Xero sync failed.';
    console.error('xero-sync: manual run failed', orgId, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
