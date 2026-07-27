import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { mapSdEmailDraft } from '@/lib/platform/serviceden-email-data';
import {
  buildMimeMessage,
  draftContentHash,
  encodeMimeForGmail,
  threadingHeaders,
} from '@/lib/platform/serviceden-email';
import {
  addBusinessDays,
  connectionHasSendScope,
  getGmailAccessToken,
  sendGmailMessage,
} from '@/lib/platform/serviceden-gmail';
import type { SdMailThread } from '@/lib/platform/serviceden';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

const SEND_LEASE_MS = 2 * 60_000;

/**
 * The only path that puts email on the wire. Every safeguard is sequential and
 * server-side: ownership, an explicit approval whose content hash still matches
 * what is about to be sent, a live Gmail connection carrying the send scope,
 * and a compare-and-swap claim so a double-click can never produce two sends.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { service, orgId, userId } = ctx;

  const { data: draft, error: loadError } = await service
    .from('sd_email_drafts')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!draft) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 });

  // A repeated request for an already-sent draft returns the first result
  // instead of sending a second copy.
  if (draft.status === 'sent') {
    return NextResponse.json({
      draft: mapSdEmailDraft(draft),
      alreadySent: true,
      gmailMessageId: draft.gmail_message_id,
      gmailThreadId: draft.gmail_thread_id,
      sentAt: draft.sent_at,
    });
  }

  const leaseCutoff = new Date(Date.now() - SEND_LEASE_MS).toISOString();
  const recoverable = draft.status === 'sending' && String(draft.updated_at ?? '') < leaseCutoff;
  if (draft.status === 'sending' && !recoverable) {
    return NextResponse.json({ error: 'Send already in progress.' }, { status: 409 });
  }
  if (draft.status !== 'approved' && !recoverable) {
    return NextResponse.json({ error: 'Approve this draft before sending it.' }, { status: 409 });
  }

  const claimedAt = new Date().toISOString();
  const claimQuery = service
    .from('sd_email_drafts')
    .update({ status: 'sending', last_error: null, updated_at: claimedAt })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('owner_user_id', userId);
  const { data: claimed, error: claimError } = recoverable
    ? await claimQuery.eq('status', 'sending').lt('updated_at', leaseCutoff).select('*').maybeSingle()
    : await claimQuery.eq('status', 'approved').select('*').maybeSingle();
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
  if (!claimed) return NextResponse.json({ error: 'Send already in progress.' }, { status: 409 });

  const recipient = String(claimed.recipient_email ?? '');
  const subject = String(claimed.subject ?? '');
  const bodyText = String(claimed.body ?? '');

  async function release(status: 'draft' | 'failed', message: string | null) {
    await service
      .from('sd_email_drafts')
      .update({ status, last_error: message ? message.slice(0, 1_000) : null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId)
      .eq('owner_user_id', userId)
      .eq('status', 'sending')
      .eq('updated_at', claimedAt);
  }

  // --- Re-verify everything on the claimed row --------------------------------
  if (String(claimed.approved_content_hash ?? '') !== draftContentHash(recipient, subject, bodyText)) {
    await release('draft', 'The draft changed after it was approved.');
    return NextResponse.json({ error: 'Draft changed after approval. Approve it again to send.' }, { status: 409 });
  }

  const { data: lead } = await service
    .from('sd_leads')
    .select('*')
    .eq('id', String(claimed.lead_id))
    .eq('org_id', orgId)
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (!lead) {
    await release('draft', 'The lead for this draft no longer exists.');
    return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
  }
  if (String(lead.email ?? '').trim().toLowerCase() !== recipient.trim().toLowerCase()) {
    await release('draft', "The lead's email address changed after approval.");
    return NextResponse.json({ error: "The lead's email address changed after approval." }, { status: 409 });
  }
  if (lead.review_status === 'rejected') {
    await release('draft', 'This lead has been dismissed.');
    return NextResponse.json({ error: 'This lead has been dismissed.' }, { status: 409 });
  }

  let connectionId = claimed.gmail_connection_id ? String(claimed.gmail_connection_id) : '';
  if (!connectionId) {
    const { data: fallback } = await service
      .from('sd_gmail_connections')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .neq('status', 'disconnected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    connectionId = fallback?.id ? String(fallback.id) : '';
  }
  const { data: connection } = connectionId
    ? await service
        .from('sd_gmail_connections')
        .select('*')
        .eq('id', connectionId)
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .maybeSingle()
    : { data: null };
  if (!connection) {
    await release('draft', 'Connect Gmail before sending.');
    return NextResponse.json({ error: 'Connect Gmail before sending.' }, { status: 400 });
  }
  if (connection.status !== 'connected') {
    await release('draft', 'The Gmail connection is not ready.');
    return NextResponse.json({ error: 'Reconnect Gmail before sending.' }, { status: 400 });
  }
  const scopes = Array.isArray(connection.scopes) ? connection.scopes.map(String) : [];
  if (!connectionHasSendScope(scopes)) {
    await release('draft', 'Gmail has not granted send permission.');
    return NextResponse.json({ error: 'Reconnect Gmail to grant send permission.', needsReconnect: true }, { status: 400 });
  }

  // --- Reply threading --------------------------------------------------------
  let providerThreadId: string | null = null;
  let inReplyTo: string | null = null;
  let references: string[] = [];
  if (claimed.source_thread_id) {
    const { data: threadRow } = await service
      .from('sd_mail_threads')
      .select('*')
      .eq('id', String(claimed.source_thread_id))
      .eq('org_id', orgId)
      .maybeSingle();
    if (threadRow) {
      const { data: messageRows } = await service
        .from('sd_mail_messages')
        .select('id,direction,from_address,to_addresses,cc_addresses,subject,sent_at,snippet,body_text,internet_message_id')
        .eq('org_id', orgId)
        .eq('thread_id', String(threadRow.id))
        .order('sent_at', { ascending: true });
      const thread: SdMailThread = {
        id: String(threadRow.id),
        providerThreadId: String(threadRow.provider_thread_id ?? ''),
        subject: threadRow.subject ?? null,
        participants: Array.isArray(threadRow.participants) ? threadRow.participants.map(String) : [],
        latestMessageAt: threadRow.latest_message_at ?? null,
        messages: ((messageRows as any[]) ?? []).map((r) => ({
          id: String(r.id),
          direction: r.direction === 'outbound' ? 'outbound' : 'inbound',
          fromAddress: r.from_address ?? '',
          toAddresses: Array.isArray(r.to_addresses) ? r.to_addresses.map(String) : [],
          ccAddresses: Array.isArray(r.cc_addresses) ? r.cc_addresses.map(String) : [],
          subject: r.subject ?? null,
          sentAt: r.sent_at ?? '',
          snippet: r.snippet ?? null,
          bodyText: r.body_text ?? null,
          internetMessageId: r.internet_message_id ?? null,
        })),
      };
      providerThreadId = thread.providerThreadId || null;
      ({ inReplyTo, references } = threadingHeaders(thread));
    }
  }

  // --- Send -------------------------------------------------------------------
  let sent: { id: string; threadId: string };
  const fromAddress = String(connection.email_address ?? '');
  try {
    const { accessToken } = await getGmailAccessToken(ctx, connectionId);
    const mime = buildMimeMessage({
      from: fromAddress,
      to: recipient,
      subject,
      bodyText,
      inReplyTo,
      references,
    });
    sent = await sendGmailMessage(accessToken, encodeMimeForGmail(mime), providerThreadId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gmail could not send this email.';
    await release('failed', message);
    if (/invalid_grant|expired|revoked|reconnect/i.test(message)) {
      await service
        .from('sd_gmail_connections')
        .update({ status: 'reauth_required', last_error: message.slice(0, 1_000), updated_at: new Date().toISOString() })
        .eq('id', connectionId)
        .eq('org_id', orgId)
        .eq('user_id', userId);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // --- Success writes ---------------------------------------------------------
  const sentAt = new Date().toISOString();
  const { data: finished } = await service
    .from('sd_email_drafts')
    .update({
      status: 'sent',
      sent_at: sentAt,
      gmail_message_id: sent.id,
      gmail_thread_id: sent.threadId,
      last_error: null,
      updated_at: sentAt,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('owner_user_id', userId)
    .eq('status', 'sending')
    .select('*')
    .maybeSingle();

  // Mirror the sent message into the conversation view straight away, instead of
  // waiting for the next Gmail sync to discover it.
  const { data: existingThread } = await service
    .from('sd_mail_threads')
    .select('id,subject,participants,message_count')
    .eq('org_id', orgId)
    .eq('connection_id', connectionId)
    .eq('provider_thread_id', sent.threadId)
    .maybeSingle();
  const participants = [...new Set([
    ...(Array.isArray(existingThread?.participants) ? existingThread.participants.map(String) : []),
    fromAddress,
    recipient,
  ].filter(Boolean))];
  const { data: threadRow } = await service
    .from('sd_mail_threads')
    .upsert(
      {
        org_id: orgId,
        connection_id: connectionId,
        lead_id: String(claimed.lead_id),
        provider_thread_id: sent.threadId,
        subject: existingThread?.subject ?? subject,
        participants,
        snippet: bodyText.slice(0, 500),
        latest_message_at: sentAt,
        latest_outbound_at: sentAt,
        message_count: (Number(existingThread?.message_count) || 0) + 1,
        updated_at: sentAt,
      },
      { onConflict: 'connection_id,provider_thread_id' },
    )
    .select('id')
    .maybeSingle();
  if (threadRow) {
    await service.from('sd_mail_messages').upsert(
      {
        org_id: orgId,
        connection_id: connectionId,
        thread_id: String(threadRow.id),
        provider_message_id: sent.id,
        direction: 'outbound',
        from_address: fromAddress,
        to_addresses: [recipient],
        cc_addresses: [],
        subject,
        sent_at: sentAt,
        snippet: bodyText.slice(0, 500),
        body_text: bodyText,
      },
      { onConflict: 'connection_id,provider_message_id' },
    );
  }

  await service.from('sd_lead_activities').insert({
    org_id: orgId,
    lead_id: String(claimed.lead_id),
    activity_type: 'email_sent',
    description: `Approved email sent: ${subject}`.slice(0, 500),
    metadata: { draft_id: id, gmail_message_id: sent.id },
  });

  // A follow-up is an outbound email that follows a previous outbound with no
  // inbound reply since. Anything else leaves the counter alone.
  const lastInbound = lead.last_inbound_at ? Date.parse(String(lead.last_inbound_at)) : 0;
  const lastOutbound = lead.last_outbound_at ? Date.parse(String(lead.last_outbound_at)) : 0;
  const isFollowUp = Boolean(lastOutbound && lastOutbound >= lastInbound);
  const followUpDays = Number(claimed.suggested_follow_up_days) || 0;
  const currentStage = String(lead.stage ?? 'new');
  await service
    .from('sd_leads')
    .update({
      last_outbound_at: sentAt,
      ...(isFollowUp ? { follow_up_count: (Number(lead.follow_up_count) || 0) + 1 } : {}),
      ...(followUpDays > 0 ? { next_follow_up_at: addBusinessDays(sentAt, followUpDays) } : {}),
      ...(currentStage === 'new' ? { stage: 'contacted' } : {}),
      updated_at: sentAt,
    })
    .eq('id', String(claimed.lead_id))
    .eq('org_id', orgId)
    .eq('owner_user_id', userId);

  return NextResponse.json({
    draft: finished ? mapSdEmailDraft(finished) : mapSdEmailDraft({ ...claimed, status: 'sent', sent_at: sentAt, gmail_message_id: sent.id, gmail_thread_id: sent.threadId }),
    gmailMessageId: sent.id,
    gmailThreadId: sent.threadId,
    sentAt,
  });
}
