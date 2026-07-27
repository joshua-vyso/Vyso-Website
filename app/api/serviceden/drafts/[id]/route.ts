import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { mapSdEmailDraft } from '@/lib/platform/serviceden-email-data';
import { sanitizeHeaderValue, shouldRevokeApproval } from '@/lib/platform/serviceden-email';

export const runtime = 'nodejs';

const EDITABLE = ['draft', 'approved', 'failed'];

/**
 * Editing a draft always revokes its approval: approval is a statement about
 * exact wording, so any change to the recipient, subject or body sends the
 * draft back to `draft` and clears the approved hash the send route checks.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    subject?: unknown;
    body?: unknown;
    recipientEmail?: unknown;
    suggestedFollowUpDays?: unknown;
  };

  const { data: existing, error: loadError } = await ctx.service
    .from('sd_email_drafts')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('owner_user_id', ctx.userId)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });
  if (!EDITABLE.includes(String(existing.status))) {
    return NextResponse.json({ error: 'This draft can no longer be edited.' }, { status: 409 });
  }

  const patch: { recipientEmail?: string; subject?: string; body?: string } = {};
  // The subject becomes a mail header, so it can never carry line breaks.
  if (typeof body.subject === 'string') patch.subject = sanitizeHeaderValue(body.subject).slice(0, 300);
  if (typeof body.body === 'string') patch.body = body.body.slice(0, 20_000);
  if (typeof body.recipientEmail === 'string') {
    const email = body.recipientEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    patch.recipientEmail = email;
  }

  const revoke = shouldRevokeApproval(
    {
      recipientEmail: String(existing.recipient_email ?? ''),
      subject: String(existing.subject ?? ''),
      body: String(existing.body ?? ''),
    },
    patch,
  );

  // The follow-up interval is scheduling metadata, not email content, so it is
  // saved without touching the approval.
  const followUpDays =
    typeof body.suggestedFollowUpDays === 'number' && Number.isFinite(body.suggestedFollowUpDays)
      ? Math.min(30, Math.max(1, Math.round(body.suggestedFollowUpDays)))
      : body.suggestedFollowUpDays === null
        ? null
        : undefined;

  const { data, error } = await ctx.service
    .from('sd_email_drafts')
    .update({
      ...(followUpDays === undefined ? {} : { suggested_follow_up_days: followUpDays }),
      ...(patch.subject === undefined ? {} : { subject: patch.subject }),
      ...(patch.body === undefined ? {} : { body: patch.body }),
      ...(patch.recipientEmail === undefined ? {} : { recipient_email: patch.recipientEmail }),
      ...(revoke
        ? { status: 'draft', approved_at: null, approved_by: null, approved_content_hash: null, last_error: null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('owner_user_id', ctx.userId)
    .in('status', EDITABLE)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'This draft can no longer be edited.' }, { status: 409 });
  return NextResponse.json({ draft: mapSdEmailDraft(data), approvalRevoked: revoke });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const { data, error } = await ctx.service
    .from('sd_email_drafts')
    .update({ status: 'cancelled', approved_at: null, approved_by: null, approved_content_hash: null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ctx.orgId)
    .eq('owner_user_id', ctx.userId)
    .in('status', EDITABLE)
    .select('*')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'This draft can no longer be cancelled.' }, { status: 409 });
  return NextResponse.json({ draft: mapSdEmailDraft(data) });
}
