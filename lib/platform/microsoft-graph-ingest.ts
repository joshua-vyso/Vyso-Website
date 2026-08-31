import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isUniqueViolation } from './db-errors';
import { ingestDocument } from './document-ingest';
import {
  ingestMicrosoftEmailBodyOrder,
  ingestMicrosoftHtmlAttachmentOrder,
  reconcileMicrosoftEmailBodyWithOrder,
  supersedeSourcePartId,
  type SupersedeIntent,
} from './microsoft-message-order';
import type {
  EmailIngestPendingReprocess,
  EmailIngestReprocessLogEntry,
} from './types';
import { MAX_ATTACHMENT_BYTES } from './email-ingest-policy';
import {
  downloadMicrosoftGraphFileAttachment,
  fetchMicrosoftGraphAttachmentMetadata,
  fetchMicrosoftGraphMessage,
  microsoftGraphIdTypeFromConfig,
  type MicrosoftGraphIdType,
} from './microsoft-graph-core';
import {
  ingestMicrosoftGraphMessage,
  finalMicrosoftGraphIngestStatus,
  type MicrosoftEmailClassificationResult,
} from './microsoft-graph-ingest-core';
import { getMicrosoftGraphAppToken } from './microsoft-graph';
import type { ValidatedMicrosoftGraphNotification } from './microsoft-graph-webhook';

export interface MicrosoftGraphEmailIngestRow {
  id: string;
  org_id: string;
  mailbox: string | null;
  graph_message_id: string | null;
  /**
   * The CURRENT provider locator, written only by the controlled re-resolution
   * path. `graph_message_id` beside it is never rewritten: it stays the
   * idempotency key and the record of the id the notification actually carried.
   */
  graph_message_id_resolved?: string | null;
  graph_id_type: MicrosoftGraphIdType | null;
  status: string;
  attempts: number;
  documents_created: number;
  processed_attachment_ids: string[] | null;
  /** The single in-flight controlled-reprocess intent, or null. */
  pending_reprocess?: EmailIngestPendingReprocess | null;
}

type FailMicrosoftGraphIngest = (error: string, status?: 'failed') => Promise<void>;

/** The audit trail is bounded: an ingest cannot grow an unbounded jsonb column. */
const MAX_REPROCESS_LOG_ENTRIES = 50;

/**
 * Append audit events to email_ingests.reprocess_log, oldest dropped first.
 *
 * Read-modify-write is safe here because only the worker holding the row's CAS
 * claim ever calls it. Best-effort by design: losing an audit line must never be
 * what fails a reprocess that otherwise succeeded, so a write error is swallowed
 * after being surfaced to the server log (never with message content in it).
 */
async function appendReprocessLog(
  supabase: SupabaseClient,
  ingest: Pick<MicrosoftGraphEmailIngestRow, 'id' | 'org_id'>,
  entries: readonly EmailIngestReprocessLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const { data, error } = await supabase
    .from('email_ingests')
    .select('reprocess_log')
    .eq('id', ingest.id)
    .eq('org_id', ingest.org_id)
    .maybeSingle();
  if (error) {
    console.error('[microsoft-graph-ingest] could not read the reprocess log', error.message);
    return;
  }
  const current = (data as { reprocess_log?: unknown } | null)?.reprocess_log;
  const existing = Array.isArray(current) ? (current as EmailIngestReprocessLogEntry[]) : [];
  const combined = [...existing, ...entries];
  const overflow = combined.length - MAX_REPROCESS_LOG_ENTRIES;
  const capped = overflow > 0
    ? [
        // The truncation is itself recorded: a log that silently loses its head
        // would let an audit read as complete when it is not.
        { kind: 'log_truncated', at: new Date().toISOString(), dropped: overflow } as EmailIngestReprocessLogEntry,
        ...combined.slice(overflow + 1),
      ]
    : combined;
  const { error: writeError } = await supabase
    .from('email_ingests')
    .update({ reprocess_log: capped })
    .eq('id', ingest.id)
    .eq('org_id', ingest.org_id);
  if (writeError) console.error('[microsoft-graph-ingest] could not append the reprocess log', writeError.message);
}

interface SourceDocumentRow {
  id: string;
  source_attachment_id: string | null;
  status: string;
  document_type: string | null;
  superseded_at: string | null;
  superseded_by_document_id: string | null;
  supersedes_document_id: string | null;
}

/**
 * THE CRASH COMPENSATOR for an interrupted supersede.
 *
 * The swap in document-ingest.ts is two writes — mark the old row superseded,
 * then insert its replacement — because the partial unique index refuses to hold
 * two active rows for one source. A process killed between those two writes (or
 * one that filed a replacement and then failed before that replacement was
 * usable) leaves an email whose only document for that source is archived. That
 * is the one state this feature must never leave behind, so it is repaired here,
 * under the row's CAS claim, BEFORE anything else runs.
 *
 * The test is deliberately "does a usable successor exist", not "is
 * superseded_by_document_id set": the successor link is written after the insert,
 * so a null link proves nothing on its own.
 *
 * Nothing is ever deleted. A failed replacement is parked with the same four
 * supersede columns that archived the original — it stays readable by direct id,
 * which is what makes the failure auditable instead of invisible.
 */
async function reclaimInterruptedSupersede(
  supabase: SupabaseClient,
  input: { orgId: string; emailIngestId: string; targetSource: string },
): Promise<'none' | 'restored'> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, source_attachment_id, status, document_type, superseded_at, superseded_by_document_id, supersedes_document_id')
    .eq('org_id', input.orgId)
    .eq('email_ingest_id', input.emailIngestId)
    .eq('source_attachment_id', input.targetSource);
  if (error) throw new Error(`Could not inspect the superseded documents: ${error.message}`);
  const rows = (data ?? []) as SourceDocumentRow[];
  const archived = rows.filter((row) => row.superseded_at !== null);
  if (archived.length === 0) return 'none';

  let restored: 'none' | 'restored' = 'none';
  for (const row of archived) {
    const successor = rows.find((entry) => entry.supersedes_document_id === row.id);
    // A replacement that landed AND is usable: this is a completed supersede,
    // and completed supersedes are permanent.
    if (successor && (successor.status === 'extracted' || successor.status === 'approved')) continue;
    if (successor && successor.superseded_at === null) {
      // Park the unusable replacement FIRST — that is what frees the index slot
      // the original is about to reclaim. Order matters; reversing these two
      // writes makes the second one fail on the unique index.
      const { error: parkError } = await supabase
        .from('documents')
        .update({
          superseded_at: new Date().toISOString(),
          supersede_reason: 'Replacement abandoned before it became reviewable; the previous document was restored.',
        })
        .eq('id', successor.id)
        .eq('org_id', input.orgId);
      if (parkError) throw new Error(`Could not park the abandoned replacement: ${parkError.message}`);
    }
    const { error: restoreError } = await supabase
      .from('documents')
      .update({ superseded_at: null, superseded_by_document_id: null, supersede_reason: null })
      .eq('id', row.id)
      .eq('org_id', input.orgId);
    if (restoreError) throw new Error(`Could not restore the superseded document: ${restoreError.message}`);
    restored = 'restored';
  }
  return restored;
}

/**
 * Persist the provider event before acknowledging Graph. The unique indexes make
 * duplicate notifications a successful no-op instead of a second document run.
 */
export async function enqueueMicrosoftGraphNotifications(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    mailbox: string;
    graphIdType?: MicrosoftGraphIdType;
    notifications: readonly ValidatedMicrosoftGraphNotification[];
  },
): Promise<string[]> {
  const createdIds: string[] = [];
  for (const notification of input.notifications) {
    const { data, error } = await supabase
      .from('email_ingests')
      .insert({
        org_id: input.orgId,
        source: 'microsoft_graph',
        resend_email_id: null,
        message_id: notification.messageId,
        graph_message_id: notification.messageId,
        graph_id_type: input.graphIdType ?? 'rest_id',
        mailbox: input.mailbox,
        from_email: null,
        to_address: input.mailbox,
        status: 'queued',
        tag: 'documents',
        attachments_total: 0,
      })
      .select('id')
      .single();
    if (error) {
      if (isUniqueViolation(error)) continue;
      throw new Error(`Could not persist the Microsoft notification: ${error.message}`);
    }
    const id = (data as { id?: unknown } | null)?.id;
    if (typeof id !== 'string' || !id) {
      throw new Error('Could not persist the Microsoft notification.');
    }
    createdIds.push(id);
  }
  return createdIds;
}

function classificationPatch(classification: MicrosoftEmailClassificationResult) {
  return {
    classification: classification.classification,
    classification_confidence: classification.confidence,
    classification_reason: classification.reason,
    ordering_intent_detected: classification.orderingIntentDetected,
    classification_primary_source: classification.primarySource,
    classification_evidence: classification.evidence,
  };
}

/**
 * Read one queued Graph message and hand supported attachment copies to the existing
 * Doc-U pipeline. Every Microsoft call below is a GET; every write is Supabase/Vyso.
 */
export async function processMicrosoftGraphEmailIngest(
  supabase: SupabaseClient,
  ingest: MicrosoftGraphEmailIngestRow,
  fail: FailMicrosoftGraphIngest,
): Promise<void> {
  const mailbox = ingest.mailbox?.trim() ?? '';
  const originalMessageId = ingest.graph_message_id?.trim() ?? '';
  const resolvedMessageId = ingest.graph_message_id_resolved?.trim() ?? '';
  // THE FETCH LAYER USES `resolved ?? original`, and nothing else in this file
  // ever reads the original again. `graph_message_id` remains frozen as the
  // idempotency key and as the record of the id the notification carried; a
  // re-resolved locator is a separate column precisely so that reading the
  // mailbox and identifying the row stay two different questions.
  const messageId = resolvedMessageId || originalMessageId;
  const graphIdType = ingest.graph_id_type ?? microsoftGraphIdTypeFromConfig('rest_id');

  const pending = ingest.pending_reprocess ?? null;
  const supersedeTarget = pending?.action === 'supersede_source' ? (pending.target_source ?? '').trim() : '';
  const reprocessReason = pending?.reason?.slice(0, 500) ?? '';
  const initiator = pending?.initiator ?? 'unknown';
  // A supersede is raised against a 'done' ingest and must end at 'done' whether
  // it succeeds or fails. A failed experiment does not downgrade a good result.
  const priorStatus = pending?.prior_status ?? null;

  /** Put the ingest back where it was, clear the intent, record why. */
  const abandonReprocess = async (why: string, outcome: 'failed' | 'no_replacement'): Promise<void> => {
    if (supersedeTarget) {
      await reclaimInterruptedSupersede(supabase, {
        orgId: ingest.org_id,
        emailIngestId: ingest.id,
        targetSource: supersedeTarget,
      }).catch((error: unknown) => {
        console.error('[microsoft-graph-ingest] supersede compensation failed', error instanceof Error ? error.message : 'unknown');
      });
      await appendReprocessLog(supabase, ingest, [{
        kind: 'supersede',
        at: new Date().toISOString(),
        initiator,
        reason: reprocessReason,
        target_source: supersedeTarget,
        old_document_id: null,
        new_document_id: null,
        outcome,
        error: why.slice(0, 300),
      }]);
    }
    await supabase
      .from('email_ingests')
      .update({
        pending_reprocess: null,
        ...(priorStatus ? { status: priorStatus } : {}),
        error: why.slice(0, 500),
        processed_at: new Date().toISOString(),
      })
      .eq('id', ingest.id)
      .eq('org_id', ingest.org_id);
  };

  if (!mailbox || !messageId) {
    const why = 'Microsoft ingestion row is missing its mailbox or message id.';
    if (pending) await abandonReprocess(why, 'failed');
    else await fail(why);
    return;
  }

  // Repair an interrupted swap BEFORE anything reads the document rows: this
  // worker holds the CAS claim, so it is the only writer, and every query below
  // then sees one active document per source exactly as it should.
  if (supersedeTarget) {
    await reclaimInterruptedSupersede(supabase, {
      orgId: ingest.org_id,
      emailIngestId: ingest.id,
      targetSource: supersedeTarget,
    });
  }

  const token = await getMicrosoftGraphAppToken();

  // Heal the narrow crash window after a document row was filed but before the
  // attachment id was copied to email_ingests.processed_attachment_ids.
  const { data: existingDocuments, error: existingError } = await supabase
    .from('documents')
    .select('id, source_attachment_id, status, document_type')
    .eq('org_id', ingest.org_id)
    .eq('email_ingest_id', ingest.id)
    // A SUPERSEDED DOCUMENT IS NOT A CURRENT COPY. It stays in the database as
    // the record of what was read before, but it must not seed the skip list, be
    // counted as a success, or be offered up as the order to reconcile a body
    // into — all three of which would let an archived reading go on governing
    // this email.
    .is('superseded_at', null)
    .not('source_attachment_id', 'is', null);
  if (existingError) throw new Error(`Could not inspect existing attachment copies: ${existingError.message}`);
  const existingRows = (existingDocuments ?? []) as {
    id: string;
    source_attachment_id: string | null;
    status: string;
    document_type: string | null;
  }[];
  const processedIds = new Set(ingest.processed_attachment_ids ?? []);
  for (const row of existingRows) {
    const recoverableBodySource =
      row.source_attachment_id === 'email-body' && (row.status === 'pending' || row.status === 'error');
    if (row.source_attachment_id && !recoverableBodySource) processedIds.add(row.source_attachment_id);
  }
  // A body source can be deterministically re-extracted into its existing row;
  // do not poison the retry with the prior incomplete state. Attachment copies
  // retain the existing Doc-U retry semantics.
  const allIncompleteCopies = existingRows.filter((row) => row.status === 'pending' || row.status === 'error');
  const incompleteCopies = allIncompleteCopies.filter((row) => row.source_attachment_id !== 'email-body');
  const successfulCopies = existingRows.length - allIncompleteCopies.length;
  const existingOrderDocuments = existingRows
    .filter((row) =>
      row.document_type === 'order' &&
      (row.status === 'extracted' || row.status === 'approved') &&
      Boolean(row.source_attachment_id) &&
      row.source_attachment_id !== 'email-body' &&
      // THE DOCUMENT ABOUT TO BE REPLACED IS NOT A CANONICAL ORDER FOR THIS RUN.
      // Wave B reconciles the body INTO whichever order document is listed here,
      // by UPDATING it — and updating a row this run is superseding would both
      // rewrite an archived document and reconcile the body into the reading
      // that was just rejected. The replacement re-enters this list from the
      // attachment loop the moment it is filed, so the body still reconciles
      // into the right order; it just reconciles into the new one.
      row.source_attachment_id !== supersedeTarget,
    )
    .map((row) => ({ documentId: row.id, attachmentId: row.source_attachment_id as string }));

  // The ACTIVE document for the targeted source — the one this run replaces.
  // Resolved from the same superseded_at-is-null query above, so a source whose
  // only document is already archived has nothing to supersede and the run
  // simply files a fresh copy.
  const supersedeOldDocumentId = supersedeTarget
    ? existingRows.find((row) => row.source_attachment_id === supersedeTarget)?.id ?? null
    : null;
  /** Non-null ONLY for the one source an operator named. */
  const supersedeIntentFor = (sourcePartId: string): SupersedeIntent | null =>
    supersedeTarget && sourcePartId === supersedeTarget && supersedeOldDocumentId
      ? { documentId: supersedeOldDocumentId, reason: reprocessReason }
      : null;
  /** Set when a replacement was actually filed, for the audit entry. */
  let supersedeNewDocumentId: string | null = null;

  const run = () => ingestMicrosoftGraphMessage(
    {
      expectedMessageId: originalMessageId,
      // Set only when a controlled re-resolution has already verified it. The
      // id-echo assertion in the core then expects the id that was actually
      // requested — re-pointed, not relaxed. A webhook row has no resolved id,
      // so the live notification path is untouched.
      ...(resolvedMessageId ? { resolvedMessageId } : {}),
      processedAttachmentIds: [...processedIds],
      documentsCreated: Math.max(ingest.documents_created ?? 0, successfulCopies),
      existingErrors: incompleteCopies.length
        ? ['A stored Vyso document copy is still pending or failed extraction; retry it in Doc-U.']
        : [],
      existingOrderDocuments,
      // Exactly one id, or none. `processed_attachment_ids` is never cleared —
      // see the gate in microsoft-graph-ingest-core.ts for why a set-membership
      // bypass and a cleared list are not the same thing.
      ...(supersedeTarget ? { reprocessSources: [supersedeTarget] } : {}),
    },
    {
      fetchMessage: async () => {
        const message = await fetchMicrosoftGraphMessage({
          accessToken: token.accessToken,
          mailbox,
          messageId,
          idType: graphIdType,
        });
        return message;
      },
      listAttachments: async () => {
        const page = await fetchMicrosoftGraphAttachmentMetadata({
          accessToken: token.accessToken,
          mailbox,
          messageId,
          idType: graphIdType,
        });
        return page.attachments;
      },
      downloadAttachment: async (attachment) => {
        const copy = await downloadMicrosoftGraphFileAttachment({
          accessToken: token.accessToken,
          mailbox,
          messageId,
          attachmentId: attachment.id,
          maxBytes: MAX_ATTACHMENT_BYTES,
          idType: graphIdType,
        });
        return copy.bytes;
      },
      ingestDocument: async ({ bytes, filename, mediaType, sourceContentType, sourceType, sourceAttachmentId, note, customerEvidence }) => {
        const supersede = supersedeIntentFor(sourceAttachmentId);
        const outcome = await ingestDocument({
          supabase,
          orgId: ingest.org_id,
          userId: null,
          base64: Buffer.from(bytes).toString('base64'),
          mediaType,
          filename,
          note,
          customerEvidence,
          emailIngestId: ingest.id,
          sourceAttachmentId,
          sourceContentType,
          sourceType,
          ...(supersede
            ? {
                supersede,
                storagePartId: supersedeSourcePartId(sourceAttachmentId, supersede.documentId),
              }
            : {}),
          // EVERY reprocess sink is an unattended sink. Nothing on this path
          // commits an order, an invoice or a stock movement; the replacement
          // lands in the review queue exactly as the original did.
          deferCommit: true,
        });
        if (outcome.ok && outcome.supersededDocumentId) supersedeNewDocumentId = outcome.documentId;
        return outcome;
      },
      ingestHtmlAttachmentOrder: async ({ bytes, filename, sourceContentType, sourceAttachmentId, message }) => {
        const outcome = await ingestMicrosoftHtmlAttachmentOrder(supabase, {
          orgId: ingest.org_id,
          emailIngestId: ingest.id,
          message,
          attachment: { id: sourceAttachmentId, name: filename, contentType: sourceContentType, bytes },
          supersede: supersedeIntentFor(sourceAttachmentId),
        });
        if (outcome.ok && outcome.supersededDocumentId) supersedeNewDocumentId = outcome.documentId;
        return outcome;
      },
      ingestBodyOrder: async ({ message }) => {
        const outcome = await ingestMicrosoftEmailBodyOrder(supabase, {
          orgId: ingest.org_id,
          emailIngestId: ingest.id,
          message,
          supersede: supersedeIntentFor('email-body'),
        });
        if (outcome.ok && outcome.supersededDocumentId) supersedeNewDocumentId = outcome.documentId;
        return outcome;
      },
      reconcileBodyWithOrderDocument: async ({ message, documentId, attachmentSourceIds, multipleOrderSources }) =>
        reconcileMicrosoftEmailBodyWithOrder(supabase, {
          orgId: ingest.org_id,
          emailIngestId: ingest.id,
          documentId,
          attachmentSourceIds,
          multipleOrderSources,
          message,
        }),
      recordMessage: async (message, classification) => {
        const { error } = await supabase
          .from('email_ingests')
          .update({
            graph_conversation_id: message.conversationId,
            // THE BUSINESS IDENTITY, recorded on every ingest from now on while
            // the provider locator still works. This is what turns a future
            // re-resolution into a single filtered lookup instead of a
            // mailbox-wide search — and it is the same key an ImmutableId
            // cutover would key off. A historical row learns it the first time
            // its re-resolution succeeds.
            internet_message_id: message.internetMessageId,
            subject: message.subject?.slice(0, 500) ?? null,
            sender_name: message.from?.name?.slice(0, 300) ?? null,
            from_email: message.from?.address?.toLowerCase().slice(0, 320) ?? null,
            received_at: message.receivedDateTime,
            has_attachments: message.hasAttachments,
            ...classificationPatch(classification),
          })
          .eq('id', ingest.id)
          .eq('org_id', ingest.org_id);
        if (error) throw new Error(`Could not store Microsoft message metadata: ${error.message}`);
      },
      recordAttachmentTotal: async (count) => {
        const { error } = await supabase
          .from('email_ingests')
          .update({ attachments_total: count })
          .eq('id', ingest.id)
          .eq('org_id', ingest.org_id);
        if (error) throw new Error(`Could not store Microsoft attachment metadata: ${error.message}`);
      },
      recordAttachmentProcessed: async ({ documentsCreated, processedAttachmentIds }) => {
        const { error } = await supabase
          .from('email_ingests')
          .update({
            documents_created: documentsCreated,
            processed_attachment_ids: processedAttachmentIds,
          })
          .eq('id', ingest.id)
          .eq('org_id', ingest.org_id);
        if (error) throw new Error(`Could not store Microsoft attachment progress: ${error.message}`);
      },
    },
  );

  // A SUPERSEDE THAT THROWS MUST NOT DOWNGRADE A FILED EMAIL. Anything from a
  // dead locator to a reader failure lands here; the compensator inside
  // abandonReprocess puts the old document back in charge, the prior status is
  // restored, and the attempt is recorded. Runs with no prior status to protect
  // (an ordinary retry of a failed row) keep the existing failure semantics and
  // rethrow untouched.
  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run();
  } catch (error) {
    if (!priorStatus) throw error;
    await abandonReprocess(
      error instanceof Error ? error.message : 'The controlled reprocess failed.',
      'failed',
    );
    return;
  }

  const unsupported = result.actionableUnsupportedAttachments
    ? `${result.actionableUnsupportedAttachments} business document attachment(s) require review.`
    : null;
  const processingError = [...result.errors, ...(unsupported ? [unsupported] : [])].join('; ').slice(0, 500) || null;
  // Partial success is not completion: one pending/errored document must keep the
  // provider ingest visibly failed even when another attachment succeeded.
  //
  // A SUPERSEDE IS THE ONE EXCEPTION, and deliberately so. It is only ever raised
  // against an ingest that was already 'done', and whether the replacement landed
  // or not is recorded in reprocess_log — so the ingest ends where it started.
  // Letting an optional re-reading turn a filed email into a failed one would
  // make 'done' mean "done, unless someone tried to improve it".
  const status = supersedeTarget
    ? (priorStatus ?? 'done')
    : finalMicrosoftGraphIngestStatus(result);

  if (supersedeTarget) {
    await appendReprocessLog(supabase, ingest, [{
      kind: 'supersede',
      at: new Date().toISOString(),
      initiator,
      reason: reprocessReason,
      target_source: supersedeTarget,
      old_document_id: supersedeOldDocumentId,
      new_document_id: supersedeNewDocumentId,
      // "No replacement" is a real, reportable outcome — the source may no longer
      // be triaged as processable, or the body may have reconciled into an
      // existing attachment order instead of producing its own document.
      outcome: supersedeNewDocumentId ? 'superseded' : 'no_replacement',
      error: supersedeNewDocumentId
        ? null
        : (processingError ?? 'The targeted source produced no replacement document.'),
    }]);
  }

  const { error: finalError } = await supabase
    .from('email_ingests')
    .update({
      status,
      documents_created: result.documentsCreated,
      processed_attachment_ids: result.processedAttachmentIds,
      attachment_diagnostics: result.attachmentDiagnostics,
      ...classificationPatch(result.classification),
      // The intent is consumed exactly once. Leaving it set would let a routine
      // cron re-drive replay a supersede nobody asked for a second time.
      ...(pending ? { pending_reprocess: null } : {}),
      error: processingError,
      processed_at: new Date().toISOString(),
    })
    .eq('id', ingest.id)
    .eq('org_id', ingest.org_id);
  if (finalError) throw new Error(`Could not finalize Microsoft ingestion: ${finalError.message}`);
}
