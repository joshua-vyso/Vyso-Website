import { NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { canSeeMoney } from '@/lib/platform/access';
import { saveHubdocSettings } from '@/lib/platform/hubdoc';
import { validateHubdocIntakeEmail } from '@/lib/platform/hubdoc-shared';

export const runtime = 'nodejs';

/**
 * Where this org's Hubdoc inbox is, and whether Vyso may post to it unprompted
 * (plan `.ai/plan_plugins_xero.md`, X2 "Settings on the plugin page").
 *
 * OWNER OR ADMIN ONLY. The same `canSeeMoney` gate the plugin page carries — a
 * member cannot see the card, and this is what stops them calling the endpoint it
 * would have posted to. Turning `auto_forward` on is the single most consequential
 * switch in the product: it is the only thing that makes Vyso send a customer's
 * documents to a third party without a click.
 *
 * THE ORG ID COMES FROM THE SESSION, NEVER THE BODY. The body carries exactly two
 * fields and both are about the org the caller is already signed in to.
 *
 * THE ADDRESS IS VALIDATED, NOT VERIFIED. Vyso cannot prove an inbox exists
 * without sending to it, so a non-Hubdoc domain is stored with a warning returned
 * for the card to show rather than refused — see `validateHubdocIntakeEmail`.
 *
 * CLEARING THE ADDRESS TURNS AUTO-FORWARD OFF, in the same write. An org with a
 * standing instruction and nowhere to send is a setting that does nothing but
 * generate failed log rows on every upload.
 */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canSeeMoney(session.profile?.role)) {
    return NextResponse.json(
      { error: 'Only an owner or admin can change the Hubdoc settings.' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    intakeEmail?: string | null;
    autoForward?: boolean;
  };

  const raw = (body.intakeEmail ?? '').trim();
  let intakeEmail: string | null = null;
  let warning: string | null = null;
  if (raw) {
    const check = validateHubdocIntakeEmail(raw);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    intakeEmail = check.email;
    warning = check.warning;
  }

  // No address, no standing instruction. See the header.
  const autoForward = Boolean(body.autoForward) && intakeEmail !== null;

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'The Supabase service role is not configured.' }, { status: 503 });
  }

  const result = await saveHubdocSettings(supabase, session.org.id, session.userId, {
    intakeEmail,
    autoForward,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.tableMissing ? 503 : 500 });
  }

  return NextResponse.json({ ok: true, intakeEmail, autoForward, warning });
}
