import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { ComposeError, generateLeadDraft, serviceDenComposeConfigured } from '@/lib/platform/serviceden-compose';
import { mapSdEmailDraft } from '@/lib/platform/serviceden-email-data';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await ctx.service
    .from('sd_email_drafts')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('owner_user_id', ctx.userId)
    .eq('lead_id', id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const drafts = ((data as any[]) ?? []).map(mapSdEmailDraft);
  return NextResponse.json({ drafts }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!serviceDenComposeConfigured) {
    return NextResponse.json({ error: 'Draft writing is not configured on the server.' }, { status: 400 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    threadId?: unknown;
    callToAction?: unknown;
    draftIdToRegenerate?: unknown;
    force?: unknown;
  };

  try {
    const draft = await generateLeadDraft(ctx, id, {
      threadId: typeof body.threadId === 'string' && body.threadId ? body.threadId : null,
      callToAction: typeof body.callToAction === 'string' && body.callToAction.trim() ? body.callToAction.trim().slice(0, 500) : null,
      draftIdToRegenerate:
        typeof body.draftIdToRegenerate === 'string' && body.draftIdToRegenerate ? body.draftIdToRegenerate : undefined,
      force: body.force === true,
    });
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof ComposeError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Could not write this draft.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
