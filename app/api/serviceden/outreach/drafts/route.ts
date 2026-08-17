import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { getOutreachLeads } from '@/lib/platform/notion-outreach';
import { SEND_BATCH_LIMIT, draftInboxFor, sendDrafts } from '@/lib/platform/outreach-drafts';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET() {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await draftInboxFor(ctx, await getOutreachLeads());
  if (!result.inbox) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result.inbox);
}

/**
 * Sends drafts. The client must name the draft ids explicitly — there is no
 * "send everything" shortcut on the wire, so a stray POST cannot empty the
 * mailbox, and what the user reviewed is exactly what goes out.
 *
 * Ids are re-checked against the live sendable list before anything is sent: a
 * draft that has since been edited, deleted, or addressed to a non-lead is
 * dropped rather than sent on a stale assumption.
 */
export async function POST(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { draftIds?: unknown };
  const requested = Array.isArray(body.draftIds)
    ? body.draftIds.filter((v): v is string => typeof v === 'string')
    : [];
  if (requested.length === 0) {
    return NextResponse.json({ error: 'No drafts selected.' }, { status: 400 });
  }
  if (requested.length > SEND_BATCH_LIMIT) {
    return NextResponse.json(
      { error: `That is ${requested.length} emails in one go. The batch limit is ${SEND_BATCH_LIMIT}.` },
      { status: 400 },
    );
  }

  const result = await draftInboxFor(ctx, await getOutreachLeads());
  if (!result.inbox) return NextResponse.json({ error: result.error }, { status: 400 });
  if (!result.inbox.canSend) {
    return NextResponse.json(
      { error: 'This Gmail connection is read-only. Reconnect it and grant send access.' },
      { status: 403 },
    );
  }

  const wanted = new Set(requested);
  // Held drafts are never sendable, whatever ids the client passes: this route
  // re-derives the inbox at send time precisely so a reply that arrived since
  // the page loaded still stops the send.
  const toSend = result.inbox.sendable.filter((d) => wanted.has(d.id));
  const heldRequested = result.inbox.held.filter((d) => wanted.has(d.id));
  if (toSend.length === 0) {
    return NextResponse.json({ error: 'Those drafts are no longer sendable. Reload and try again.' }, { status: 409 });
  }

  const outcomes = await sendDrafts(ctx, result.connectionId, toSend);
  return NextResponse.json({
    sent: outcomes.filter((r) => r.ok).length,
    failed: outcomes.filter((r) => !r.ok),
    dropped: requested.length - toSend.length,
    held: heldRequested.map((d) => ({ company: d.company, to: d.to, reason: d.reason })),
    account: result.inbox.account,
  });
}
