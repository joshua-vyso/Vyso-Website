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
import {
  selectReconciliationSupersedeTarget,
  type SupersedeCandidateRow,
} from './supersede-reconciliation-target';
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
 * A SUCCESSOR IS NOT ALWAYS A ROW OF THE SAME SOURCE. When the targeted source
 * was absorbed into another source's canonical order — the Four Seasons case —
 * the replacement carries a different `source_attachment_id` and so is absent
 * from the query below entirely. Looking only there would read a COMPLETED
 * supersede as an interrupted one and restore the document it archived, putting
 * two active documents back on the email. Such a successor is therefore found
 * through the archived row's own link, and only counts when the pair points
 * both ways.
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

  /** The bidirectionally-linked replacement filed against ANOTHER source part. */
  const reconciledSuccessor = async (row: SourceDocumentRow): Promise<SourceDocumentRow | null> => {
    if (!row.superseded_by_document_id) return null;
    const { data: linked, error: linkedError } = await supabase
      .from('documents')
      .select('id, source_attachment_id, status, document_type, superseded_at, superseded_by_document_id, supersedes_document_id')
      .eq('id', row.superseded_by_document_id)
      .eq('org_id', input.orgId)
      .maybeSingle();
    if (linkedError) throw new Error(`Could not inspect the reconciled replacement: ${linkedError.message}`);
    const successor = (linked ?? null) as SourceDocumentRow | null;
    // BOTH WAYS OR NOT AT ALL. A half-written pair is an interrupted supersede,
    // and an interrupted supersede is exactly what this function repairs.
    return successor && successor.supersedes_document_id === row.id ? successor : null;
  };

  let restored: 'none' | 'restored' = 'none';
  for (const row of archived) {
    const sameSourceSuccessor = rows.find((entry) => entry.supersedes_document_id === row.id);
    const successor = sameSourceSuccessor ?? (await reconciledSuccessor(row));
    // A replacement that landed AND is usable: this is a completed supersede,
    // and completed supersedes are permanent.
    if (successor && (successor.status === 'extracted' || successor.status === 'approved')) continue;
    // Only a SAME-SOURCE replacement is ever parked. The park exists to free the
    // index slot the original is about to reclaim, and a replacement on another
    // source part never held that slot — archiving it would take a document this
    // email still needs out of circulation for no reason at all.
    if (sameSourceSuccessor && sameSourceSuccessor.superseded_at === null) {
      // Park the unusable replacement FIRST — that is what frees the index slot
      // the original is about to reclaim. Order matters; reversing these two
      // writes makes the second one fail on the unique index.
      const { error: parkError } = await supabase
        .from('documents')
        .update({
          superseded_at: new Date().toISOString(),
          supersede_reason: 'Replacement abandoned before it became reviewable; the previous document was restored.',
        })
        .eq('id', sameSourceSuccessor.id)
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

/** Every outcome the supersede audit entry can carry, from the log's own type. */
type SupersedeOutcome = Extract<EmailIngestReprocessLogEntry, { kind: 'supersede' }>['outcome'];

type ReconciledSupersedeResult =
  | { outcome: 'superseded_via_reconciliation'; documentId: string; why: null }
  | { outcome: 'no_replacement' | 'ambiguous_replacement'; documentId: null; why: string };

/**
 * SUPERSEDE THROUGH THE DOCUMENT THAT ABSORBED THE TARGETED SOURCE.
 *
 * Reached only when a controlled `supersede_source` produced no successor of the
 * targeted source's own — which, on a message whose order lives in an
 * attachment, is the ORDINARY result of a body-targeted reprocess: Wave B
 * reconciles the body INTO the attachment's canonical order rather than filing a
 * second order for one message (the Four Seasons case, where the old zero-line
 * body document was left active beside the attachment document).
 *
 * `reconciledDocumentId` comes from the run itself; the stored row is then
 * checked against the five conditions in supersede-reconciliation-target.ts,
 * which refuses on missing provenance, ambiguity and cross-ingest rows. NO
 * DOCUMENT IS CREATED HERE — both rows already exist, and the whole operation is
 * the two supersede links between them.
 */
async function supersedeThroughReconciledDocument(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    emailIngestId: string;
    targetSource: string;
    oldDocumentId: string;
    reason: string;
    reconciledDocumentId: string | null;
  },
): Promise<ReconciledSupersedeResult> {
  const refuse = (why: string): ReconciledSupersedeResult => ({ outcome: 'no_replacement', documentId: null, why });

  const { data, error } = await supabase
    .from('documents')
    .select('id, email_ingest_id, source_attachment_id, status, superseded_at, supersedes_document_id, extracted_data')
    .eq('org_id', input.orgId)
    .eq('email_ingest_id', input.emailIngestId)
    .is('superseded_at', null);
  if (error) return refuse(`Could not inspect the reconciled documents: ${error.message}`);

  const decision = selectReconciliationSupersedeTarget({
    targetSource: input.targetSource,
    emailIngestId: input.emailIngestId,
    oldDocumentId: input.oldDocumentId,
    reconciledDocumentId: input.reconciledDocumentId,
    candidates: (data ?? []) as SupersedeCandidateRow[],
  });
  if (decision.outcome === 'no_replacement') return refuse(decision.why);
  if (decision.outcome === 'ambiguous_replacement') {
    return { outcome: 'ambiguous_replacement', documentId: null, why: decision.why };
  }

  // ── THE TWO WRITES, SUCCESSOR LINK FIRST ────────────────────────────────
  // The opposite order to the direct-successor swap in document-ingest.ts, and
  // for the same reason it is ordered at all. There the old row must be archived
  // to free the partial unique index slot its replacement is about to take; here
  // the replacement sits on a DIFFERENT source part, so the two rows never
  // contend and the index imposes no order. What remains is the crash question,
  // and only this order answers it safely: a process killed between the writes
  // leaves the old document ACTIVE with an unused link on its replacement —
  // today's state, which the next run simply redoes — instead of an archived
  // document with no successor, the one state this feature must never leave.
  const { data: linked, error: linkError } = await supabase
    .from('documents')
    .update({ supersedes_document_id: input.oldDocumentId })
    .eq('id', decision.documentId)
    .eq('org_id', input.orgId)
    .is('superseded_at', null)
    // One predecessor column, one predecessor: a link already written is another
    // supersede's, and this one gives way rather than overwrite it.
    .is('supersedes_document_id', null)
    .select('id')
    .maybeSingle();
  if (linkError) return refuse(`Could not link the reconciled document to the one it replaces: ${linkError.message}`);
  if (!linked) return refuse('The reconciled document is no longer an unlinked active document.');

  const { data: archivedOld, error: archiveError } = await supabase
    .from('documents')
    .update({
      superseded_at: new Date().toISOString(),
      superseded_by_document_id: decision.documentId,
      supersede_reason: input.reason.slice(0, 500),
    })
    .eq('id', input.oldDocumentId)
    .eq('org_id', input.orgId)
    // Only an ACTIVE row may be superseded — the same guard the direct path uses,
    // so a worker that got here first is not overwritten.
    .is('superseded_at', null)
    .select('id')
    .maybeSingle();
  if (archiveError || !archivedOld) {
    // COMPENSATION. The old document was never archived, so the link that says
    // it was must go — and only the link this call wrote is cleared.
    await supabase
      .from('documents')
      .update({ supersedes_document_id: null })
      .eq('id', decision.documentId)
      .eq('org_id', input.orgId)
      .eq('supersedes_document_id', input.oldDocumentId);
    return refuse(
      archiveError
        ? `Could not mark the previous document superseded: ${archiveError.message}`
        : 'The targeted document is no longer the active copy for this source.',
    );
  }
  return { outcome: 'superseded_via_reconciliation', documentId: decision.documentId, why: null };
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
      ingestDocument: async ({ bytes, filename, mediaType, sourceContentType, sourceType, sourceAttachmentId, note, customerEvidence, messageBodyText }) => {
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
          // The covering email's own body — the only voice the amendment
          // detector hears on a formal-document lane. A PDF's printed
          // conditions are not a request; see the PO JBG0118352 note in
          // lib/platform/docu/order-amendment.ts.
          messageBodyText: messageBodyText ?? null,
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

  // ── WHAT REPLACED THE OLD DOCUMENT ──────────────────────────────────────
  // A successor of the targeted source's own is the direct answer and needs no
  // further work. Failing that, the targeted source may have been absorbed into
  // another source's canonical order this run — the Four Seasons case — and that
  // document then becomes the replacement, under the five conditions in
  // supersede-reconciliation-target.ts. Only if THAT also declines does the run
  // keep the original fail-safe and leave the old document active.
  let supersedeOutcome: SupersedeOutcome = supersedeNewDocumentId ? 'superseded' : 'no_replacement';
  let supersedeReplacementId: string | null = supersedeNewDocumentId;
  let supersedeDetail: string | null = null;
  if (supersedeTarget && !supersedeNewDocumentId && supersedeOldDocumentId) {
    try {
      const viaReconciliation = await supersedeThroughReconciledDocument(supabase, {
        orgId: ingest.org_id,
        emailIngestId: ingest.id,
        targetSource: supersedeTarget,
        oldDocumentId: supersedeOldDocumentId,
        reason: reprocessReason,
        // THE RUN'S OWN ANSWER, not a re-query: the core reports the canonical
        // document it reconciled this source into, and the conditions verify
        // that row rather than going looking for a plausible one.
        reconciledDocumentId: result.reconciledSourceDocumentIds[supersedeTarget] ?? null,
      });
      supersedeOutcome = viaReconciliation.outcome;
      supersedeReplacementId = viaReconciliation.documentId;
      supersedeDetail = viaReconciliation.why;
    } catch (error) {
      // An audit line is never worth a thrown finalisation: the old document is
      // still active, which is the safe state, so the run reports it as such.
      supersedeDetail = error instanceof Error ? error.message : 'The reconciled replacement could not be resolved.';
    }
  }

  if (supersedeTarget) {
    await appendReprocessLog(supabase, ingest, [{
      kind: 'supersede',
      at: new Date().toISOString(),
      initiator,
      reason: reprocessReason,
      target_source: supersedeTarget,
      old_document_id: supersedeOldDocumentId,
      new_document_id: supersedeReplacementId,
      // "No replacement" is a real, reportable outcome — the source may no longer
      // be triaged as processable, or it may have reconciled into an existing
      // attachment order that could not be verified as the replacement.
      outcome: supersedeOutcome,
      error: supersedeReplacementId
        ? null
        : (supersedeDetail ?? processingError ?? 'The targeted source produced no replacement document.'),
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
