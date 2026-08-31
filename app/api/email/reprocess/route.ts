import { NextResponse, after } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { processEmailIngest } from '@/lib/platform/email-ingest';
import { getMicrosoftGraphAppToken } from '@/lib/platform/microsoft-graph';
import {
  fetchMicrosoftGraphMessage,
  findMicrosoftGraphMessagesByConversationId,
  findMicrosoftGraphMessagesByInternetMessageId,
  microsoftGraphIdTypeFromConfig,
} from '@/lib/platform/microsoft-graph-core';
import {
  resolveStaleGraphMessageId,
  type MicrosoftGraphResolution,
  type StaleGraphIngestRow,
} from '@/lib/platform/microsoft-graph-resolve';
import type {
  EmailIngestPendingReprocess,
  EmailIngestReprocessLogEntry,
} from '@/lib/platform/types';

export const maxDuration = 300;

/**
 * CONTROLLED reprocessing of one already-received email — the only entry point
 * in the product that may re-resolve a dead Microsoft Graph locator or replace a
 * document that has already been filed.
 *
 * WHY IT IS NOT /api/email/retry. That route re-queues mail that was never
 * successfully filed, and it deliberately excludes 'done' for exactly the right
 * reason: re-running a finished email pays for the AI again and can rewrite a
 * good row. This route is the narrow, named, reason-bearing exception to that —
 * one email, one source part, one written justification, and an audit entry for
 * every step. Everything it does is additive: `graph_message_id` is never
 * rewritten, `processed_attachment_ids` is never cleared, and no document is
 * ever deleted or edited beyond its four supersede columns.
 *
 * AUTH — either of two, both fail closed:
 *   - an owner/admin session (the convention of /api/email/retry), or
 *   - `Authorization: Bearer ${CRON_SECRET}` (the convention of
 *     /api/email/process).
 * The second exists because a controlled backfill has to be drivable from
 * operational tooling without a browser session; it is the same secret that
 * already authorises the queue drain, and it is compared in full, never logged,
 * and never echoed back in a response. There is no unauthenticated path.
 *
 * Body: { emailIngestId, action, targetSource?, reason }.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Statuses each action is allowed to start from. Anything else is refused. */
const ALLOWED_STATUSES: Record<'retry_failed' | 'supersede_source', readonly string[]> = {
  // The same set /api/email/retry re-queues, minus the ones it cannot reach.
  retry_failed: ['queued', 'failed', 'ignored'],
  // A supersede REPLACES a filed reading. There is nothing to replace on an
  // ingest that never finished, and 'processing' belongs to a live worker.
  supersede_source: ['done'],
};

interface ReprocessIngestRow {
  id: string;
  org_id: string;
  source: string | null;
  status: string;
  mailbox: string | null;
  graph_message_id: string | null;
  graph_message_id_resolved: string | null;
  graph_id_type: 'rest_id' | 'rest_immutable_entry_id' | null;
  internet_message_id: string | null;
  graph_conversation_id: string | null;
  received_at: string | null;
  from_email: string | null;
  subject: string | null;
  reprocess_log: unknown;
}

const INGEST_COLS =
  'id, org_id, source, status, mailbox, graph_message_id, graph_message_id_resolved, graph_id_type, ' +
  'internet_message_id, graph_conversation_id, received_at, from_email, subject, reprocess_log';

export async function POST(req: Request) {
  // ── AUTH ────────────────────────────────────────────────────────────────
  // The cron secret is checked FIRST and in full. Checking it first also keeps
  // an operational bearer token out of resolveUser, which would otherwise try to
  // exchange it as a Supabase access token.
  const cronSecret = process.env.CRON_SECRET ?? '';
  const authorization = req.headers.get('authorization') ?? '';
  const cronAuthorized = Boolean(cronSecret) && authorization === `Bearer ${cronSecret}`;

  let initiator: string;
  let sessionOrgId: string | null = null;
  if (cronAuthorized) {
    initiator = 'cron_secret';
  } else {
    const auth = await resolveUser(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await auth.supabase
      .from('profiles')
      .select('org_id, role')
      .eq('id', auth.userId)
      .maybeSingle<{ org_id: string | null; role: string }>();
    if (!profile?.org_id || (profile.role !== 'owner' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Only an owner or admin can do this.' }, { status: 403 });
    }
    sessionOrgId = profile.org_id;
    initiator = `admin:${auth.userId}`;
  }

  // ── INPUT ───────────────────────────────────────────────────────────────
  // Exact ids only. There is deliberately no search, no "most recent failed",
  // and no wildcard: a route that can replace a filed document must be pointed
  // at precisely one, by someone who can say which.
  const body = (await req.json().catch(() => ({}))) as {
    emailIngestId?: unknown;
    action?: unknown;
    targetSource?: unknown;
    reason?: unknown;
  };
  const emailIngestId = typeof body.emailIngestId === 'string' ? body.emailIngestId.trim() : '';
  if (!UUID_RE.test(emailIngestId)) {
    return NextResponse.json({ error: 'A valid email ingest id is required.' }, { status: 400 });
  }
  const action = body.action === 'retry_failed' || body.action === 'supersede_source' ? body.action : null;
  if (!action) {
    return NextResponse.json({ error: "action must be 'retry_failed' or 'supersede_source'." }, { status: 400 });
  }
  // THE REASON IS MANDATORY. It is the only part of this record that explains to
  // the next person why a filed document stopped being the answer.
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  if (!reason) {
    return NextResponse.json({ error: 'A reason is required.' }, { status: 400 });
  }
  const targetSource = typeof body.targetSource === 'string' ? body.targetSource.trim() : '';
  if (action === 'supersede_source' && (!targetSource || targetSource.length > 500)) {
    return NextResponse.json(
      { error: "targetSource is required for supersede_source ('email-body' or a Graph attachment id)." },
      { status: 400 },
    );
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  // ── THE ROW ─────────────────────────────────────────────────────────────
  // Scoped to the caller's own org for a session caller: the id arrives in the
  // request, so it is not trusted on its own.
  let query = supabase.from('email_ingests').select(INGEST_COLS).eq('id', emailIngestId);
  if (sessionOrgId) query = query.eq('org_id', sessionOrgId);
  const { data, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ error: `Could not read that email: ${error.message}` }, { status: 500 });
  }
  const ingest = data as ReprocessIngestRow | null;
  if (!ingest) {
    return NextResponse.json({ error: 'That email is not in your organisation.' }, { status: 404 });
  }
  if (ingest.source !== 'microsoft_graph') {
    return NextResponse.json(
      { error: 'Controlled reprocessing is only available for Microsoft Graph mail.' },
      { status: 409 },
    );
  }
  if (!ALLOWED_STATUSES[action].includes(ingest.status)) {
    return NextResponse.json(
      { error: `An email with status '${ingest.status}' cannot be ${action === 'supersede_source' ? 'superseded' : 'retried'}.` },
      { status: 409 },
    );
  }
  if (!ingest.mailbox?.trim()) {
    return NextResponse.json({ error: 'That email has no mailbox recorded.' }, { status: 409 });
  }

  // ── IDEMPOTENCY ─────────────────────────────────────────────────────────
  // A repeat of a supersede that already completed for the same source and the
  // same reason is a RECORDED NO-OP, not a second replacement. Two identical
  // requests must not leave two archived documents behind.
  if (action === 'supersede_source') {
    const { data: activeDocument, error: activeError } = await supabase
      .from('documents')
      .select('id, supersedes_document_id')
      .eq('org_id', ingest.org_id)
      .eq('email_ingest_id', ingest.id)
      .eq('source_attachment_id', targetSource)
      .is('superseded_at', null)
      .limit(1)
      .maybeSingle();
    if (activeError) {
      return NextResponse.json(
        { error: `Could not inspect the target document: ${activeError.message}` },
        { status: 500 },
      );
    }
    const active = activeDocument as { id: string; supersedes_document_id: string | null } | null;
    const log = Array.isArray(ingest.reprocess_log) ? (ingest.reprocess_log as EmailIngestReprocessLogEntry[]) : [];
    const alreadyDone = log.some((entry) =>
      entry.kind === 'supersede' &&
      entry.outcome === 'superseded' &&
      entry.target_source === targetSource &&
      entry.reason === reason,
    );
    if (active?.supersedes_document_id && alreadyDone) {
      return NextResponse.json(
        {
          error: 'That source has already been superseded for this reason; nothing was changed.',
          documentId: active.id,
        },
        { status: 409 },
      );
    }
  }

  // ── RE-RESOLUTION ───────────────────────────────────────────────────────
  // GET-only, fail-closed, and against this ingest's OWN mailbox. It is run for
  // both actions because a stored locator that Graph no longer honours makes the
  // read impossible either way — and it is run HERE, not in the worker, so a
  // refusal is answered to the caller instead of being buried in a queue.
  const mailbox = ingest.mailbox.trim();
  const idType = ingest.graph_id_type ?? microsoftGraphIdTypeFromConfig('rest_id');
  const staleRow: StaleGraphIngestRow = {
    id: ingest.id,
    org_id: ingest.org_id,
    mailbox,
    graph_message_id: ingest.graph_message_id,
    graph_message_id_resolved: ingest.graph_message_id_resolved,
    internet_message_id: ingest.internet_message_id,
    graph_conversation_id: ingest.graph_conversation_id,
    received_at: ingest.received_at,
    from_email: ingest.from_email,
    subject: ingest.subject,
  };

  let resolution: MicrosoftGraphResolution;
  try {
    const token = await getMicrosoftGraphAppToken();
    resolution = await resolveStaleGraphMessageId(
      {
        fetchMessage: (messageId) =>
          fetchMicrosoftGraphMessage({ accessToken: token.accessToken, mailbox, messageId, idType }),
        findByInternetMessageId: (internetMessageId) =>
          findMicrosoftGraphMessagesByInternetMessageId({
            accessToken: token.accessToken,
            mailbox,
            internetMessageId,
            idType,
          }),
        findByConversationId: (conversationId) =>
          findMicrosoftGraphMessagesByConversationId({
            accessToken: token.accessToken,
            mailbox,
            conversationId,
            idType,
          }),
      },
      staleRow,
    );
  } catch (err) {
    // A transient Graph fault is not a resolution failure and must not be turned
    // into one — nothing has been written at this point, so the caller can retry.
    return NextResponse.json(
      { error: `Microsoft Graph could not be read: ${err instanceof Error ? err.message : 'unknown error'}` },
      { status: 502 },
    );
  }

  if (resolution.status === 'unresolved') {
    return NextResponse.json(
      {
        error: 'That message could not be identified in the mailbox with certainty; nothing was changed.',
        reason: resolution.reason,
        detail: resolution.detail,
        ...(resolution.candidateCount === undefined ? {} : { candidateCount: resolution.candidateCount }),
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const logEntries: EmailIngestReprocessLogEntry[] = [];
  const identityPatch: Record<string, string> = {};
  if (resolution.status === 'resolved') {
    identityPatch.graph_message_id_resolved = resolution.messageId;
    logEntries.push({
      kind: 'id_resolution',
      at: now,
      initiator,
      original: resolution.originalMessageId,
      resolved: resolution.messageId,
      method: resolution.method,
      // The subject is recorded as a HASH. It can name a customer, a property or
      // a purchase order, and an audit column is not the place for any of them.
      evidence: resolution.evidence,
    });
  }
  // Backfill the business identity the moment it is known, whichever branch we
  // came through: the NEXT resolution for this row is then a direct lookup.
  if (resolution.internetMessageId && !ingest.internet_message_id) {
    identityPatch.internet_message_id = resolution.internetMessageId;
  }

  const pendingReprocess: EmailIngestPendingReprocess = {
    action,
    initiator,
    reason,
    at: now,
    ...(action === 'supersede_source' ? { target_source: targetSource } : {}),
    // Only a supersede carries a status worth protecting; a retry of a failed
    // row keeps the ordinary failure semantics of the pipeline.
    ...(action === 'supersede_source' ? { prior_status: ingest.status } : {}),
  };

  const existingLog = Array.isArray(ingest.reprocess_log)
    ? (ingest.reprocess_log as EmailIngestReprocessLogEntry[])
    : [];
  const combinedLog = [...existingLog, ...logEntries].slice(-50);

  // ONE ROW, ALWAYS. This is an UPDATE of the existing email_ingests row and
  // there is no insert anywhere on this path — one email is one ingest, and a
  // reprocess must never create a second record of the same message.
  const { data: updated, error: updateError } = await supabase
    .from('email_ingests')
    .update({
      ...identityPatch,
      pending_reprocess: pendingReprocess,
      reprocess_log: combinedLog,
      // The exact semantics of /api/email/retry: re-queue, clear the error, and
      // give the row a fresh attempt budget.
      status: 'queued',
      error: null,
      attempts: 0,
    })
    .eq('id', ingest.id)
    .eq('org_id', ingest.org_id)
    // Re-check the status under the update: a worker that claimed this row
    // between the read above and this write must win, not be overwritten.
    .in('status', ALLOWED_STATUSES[action])
    .select('id')
    .maybeSingle();
  if (updateError) {
    return NextResponse.json({ error: `Could not queue the reprocess: ${updateError.message}` }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: 'That email changed status while the request was being prepared; nothing was changed.' },
      { status: 409 },
    );
  }

  after(async () => {
    const client = createServiceSupabase();
    if (client) await processEmailIngest(client, ingest.id);
  });

  return NextResponse.json({
    ok: true,
    id: ingest.id,
    action,
    ...(action === 'supersede_source' ? { targetSource } : {}),
    resolution: resolution.status,
    ...(resolution.status === 'resolved' ? { method: resolution.method } : {}),
  });
}
