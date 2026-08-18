import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { canSeeBrief } from '@/lib/platform/access';
import { rateLimitAllowed } from '@/lib/platform/rate-limit';
import { sendTestBrief } from '@/lib/platform/brief-notify';
import {
  listSchedules,
  normaliseSlots,
  saveSchedules,
  type BriefSlotKind,
} from '@/lib/platform/brief-schedules';

export const runtime = 'nodejs';

/**
 * The signed-in user's brief times — GET to read, PUT to replace, POST to send
 * one to themselves right now (`.ai/plan_brief_schedules.md` §3).
 *
 * THE ORG AND THE USER COME FROM THE SESSION, NEVER FROM THE BODY. A body that
 * could name a user id would be a body that could schedule an email into
 * somebody else's inbox, or read what times a colleague has chosen. The
 * profile row is re-read on every request rather than trusted from a client,
 * and `canSeeBrief` is checked here as well as at send time — a member has no
 * Brief to be notified about, so offering them the setting would be offering
 * them a screen the product will not honour.
 *
 * `resolveUser` rather than `getPlatformSession` so the same route works for a
 * cookie session and for the mobile app's `Authorization: Bearer` token, which
 * is the pattern every other route that a client component posts to already
 * follows (app/api/finch/chats/route.ts).
 */

/** What the settings card sends and receives. `slots` is the COMPLETE list —
 *  a PUT with an empty array turns brief notifications off. */
interface PutBody {
  slots?: unknown;
}

/** The test send's body: which slot the button was pressed on, so the preview
 *  says "morning brief" if that is the one being tested. */
interface TestBody {
  kind?: unknown;
  local_time?: unknown;
  days?: unknown;
}

async function caller(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id, role, full_name')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null; role: string | null; full_name: string | null }>();

  if (!profile?.org_id) {
    return { error: NextResponse.json({ error: 'No organisation on this account.' }, { status: 403 }) } as const;
  }
  if (!canSeeBrief(profile.role)) {
    // The same 403 a member gets from every other money surface. Not a 404:
    // the route exists, and pretending otherwise would only make the settings
    // card harder to debug for the admin who does have access.
    return { error: NextResponse.json({ error: 'The Brief is for owners and admins.' }, { status: 403 }) } as const;
  }

  return {
    auth,
    orgId: profile.org_id,
    fullName: profile.full_name,
    error: null,
  } as const;
}

export async function GET(req: Request) {
  const ctx = await caller(req);
  if (ctx.error) return ctx.error;

  const { slots, tableMissing } = await listSchedules(ctx.orgId, ctx.auth.userId, ctx.auth.supabase);
  return NextResponse.json({ slots, tableMissing, email: ctx.auth.email });
}

/**
 * Replace this person's schedules with the list in the body.
 *
 * Replace-all at the API level; identity-preserving underneath (see
 * `saveSchedules`), so editing a time keeps that slot's delivery history and
 * the "since your last brief" block does not reset every time somebody opens
 * settings.
 */
export async function PUT(req: Request) {
  const ctx = await caller(req);
  if (ctx.error) return ctx.error;

  const body = (await req.json().catch(() => ({}))) as PutBody;
  const { slots, error } = normaliseSlots(body.slots);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const result = await saveSchedules(ctx.orgId, ctx.auth.userId, slots, ctx.auth.supabase);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ slots: result.slots });
}

/**
 * "Send me a test now."
 *
 * ONLY EVER TO THE CALLER'S OWN ADDRESS — `ctx.auth.email`, from the verified
 * session, with no way for a body to name a recipient. That is what keeps this
 * button from being an open relay for a business's supplier prices.
 *
 * RATE LIMITED to 3 an hour per user. Composing a brief is four database reads
 * and a Resend call, and a button that can be held down is a button that will
 * be. The limiter fails OPEN (lib/platform/rate-limit.ts) because it is
 * defence in depth, not the control: the recipient is fixed either way.
 *
 * Writes NO delivery row, and ignores the schedule's days and time entirely —
 * a test that counted as today's delivery would suppress the real 07:00 brief
 * tomorrow morning.
 */
export async function POST(req: Request) {
  const ctx = await caller(req);
  if (ctx.error) return ctx.error;

  const to = ctx.auth.email;
  if (!to) {
    return NextResponse.json({ error: 'This account has no email address.' }, { status: 400 });
  }

  if (!(await rateLimitAllowed(`brief-test:${ctx.auth.userId}`, 3, 3600))) {
    return NextResponse.json(
      { error: 'You have sent a few test briefs already — try again in an hour.' },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as TestBody;
  const kind: BriefSlotKind =
    body.kind === 'morning' || body.kind === 'evening' ? body.kind : 'custom';
  const localTime = typeof body.local_time === 'string' ? body.local_time : '';
  const days = Array.isArray(body.days) ? (body.days as unknown[]).filter((d): d is number => typeof d === 'number') : [];

  try {
    await sendTestBrief(
      ctx.auth.supabase,
      ctx.orgId,
      ctx.auth.userId,
      { to, firstName: (ctx.fullName ?? '').trim().split(/\s+/)[0] ?? '', kind, localTime, days },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('brief-schedules: test send failed', ctx.auth.userId, message);
    return NextResponse.json({ error: 'The test brief could not be sent.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent: to });
}
