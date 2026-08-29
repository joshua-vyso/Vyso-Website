import { NextResponse } from 'next/server';
import {
  getMicrosoftGraphAppToken,
  microsoftGraphConfigured,
  microsoftGraphSubscriptionConfigured,
  runMicrosoftOrderInboxSubscriptionRenewal,
} from '@/lib/platform/microsoft-graph';

export const maxDuration = 60;

/**
 * Daily renewal tick for the orders@turnnslice.com Inbox subscription.
 *
 * Subscription lifecycle only: this route GETs and PATCHes
 * /subscriptions/{id} and nothing else — no recreation, no mailbox reads, no
 * ImmutableId change. It renews when Graph reports the subscription within
 * 48h of expiry and no-ops otherwise; see
 * `microsoftGraphRenewalDecision`/`runMicrosoftGraphSubscriptionRenewal` in
 * lib/platform/microsoft-graph-core.ts for the decision and the request
 * sequence. Manual `npm run microsoft:subscription:renew` remains for
 * emergencies; recreating a dead subscription stays a manual, documented
 * cutover, never something this cron can trigger.
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

  if (!microsoftGraphConfigured) {
    return NextResponse.json({ error: 'Microsoft Graph is not configured.' }, { status: 503 });
  }
  if (!microsoftGraphSubscriptionConfigured) {
    return NextResponse.json(
      { error: 'Microsoft Graph subscription id is not configured.' },
      { status: 503 },
    );
  }

  try {
    const { accessToken } = await getMicrosoftGraphAppToken();
    const result = await runMicrosoftOrderInboxSubscriptionRenewal(accessToken);
    return NextResponse.json({ ok: true, action: result.action, expiresAt: result.expiresAt });
  } catch (error) {
    // MicrosoftGraphHttpError/Error messages are already redact()ed by the
    // core transport — never add any logging of tokens, clientState, or the
    // client secret here, including on the misconfigured-subscription-id path.
    const message = error instanceof Error ? error.message : String(error);
    console.error('microsoft-renew: run failed', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
