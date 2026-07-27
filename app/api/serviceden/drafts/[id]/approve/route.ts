import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { mapSdEmailDraft } from '@/lib/platform/serviceden-email-data';
import { draftContentHash } from '@/lib/platform/serviceden-email';

export const runtime = 'nodejs';

/**
 * Approval records exactly what was approved. The stored hash covers recipient,
 * subject and body, and the send route refuses to send anything whose current
 * content hashes differently — so an edit after approval can never go out.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { acceptStale?: unknown };

  const { data: draft, error: loadError } = await ctx.service
    .from('sd_email_drafts')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('owner_user_id', ctx.userId)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!draft) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });

  const status = String(draft.status);
  if (status !== 'draft' && status !== 'failed') {
    return NextResponse.json(
      { error: status === 'approved' ? 'This draft is already approved.' : 'This draft can no longer be approved.' },
      { status: 409 },
    );
  }
  if (draft.stale_research === true && body.acceptStale !== true) {
    return NextResponse.json(
      { error: 'The company research changed after this draft was written. Regenerate it, or approve again to keep it as is.', staleResearch: true },
      { status: 409 },
    );
  }
  if (!String(draft.subject ?? '').trim() || !String(draft.body ?? '').trim()) {
    return NextResponse.json({ error: 'Add a subject and a message before approving.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data, error } = await ctx.service
    .from('sd_email_drafts')
    .update({
      status: 'approved',
      approved_by: ctx.userId,
      approved_at: now,
      approved_content_hash: draftContentHash(
        String(draft.recipient_email ?? ''),
        String(draft.subject ?? ''),
        String(draft.body ?? ''),
      ),
      last_error: null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('owner_user_id', ctx.userId)
    .in('status', ['draft', 'failed'])
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'This draft changed before it could be approved.' }, { status: 409 });
  return NextResponse.json({ draft: mapSdEmailDraft(data) });
}
