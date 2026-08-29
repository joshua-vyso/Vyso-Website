import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isUniqueViolation } from './db-errors';
import { ingestDocument } from './document-ingest';
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
  graph_id_type: MicrosoftGraphIdType | null;
  status: string;
  attempts: number;
  documents_created: number;
  processed_attachment_ids: string[] | null;
}

type FailMicrosoftGraphIngest = (error: string, status?: 'failed') => Promise<void>;

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
  const messageId = ingest.graph_message_id?.trim() ?? '';
  const graphIdType = ingest.graph_id_type ?? microsoftGraphIdTypeFromConfig('rest_id');
  if (!mailbox || !messageId) {
    await fail('Microsoft ingestion row is missing its mailbox or message id.');
    return;
  }

  const token = await getMicrosoftGraphAppToken();

  // Heal the narrow crash window after a document row was filed but before the
  // attachment id was copied to email_ingests.processed_attachment_ids.
  const { data: existingDocuments, error: existingError } = await supabase
    .from('documents')
    .select('id, source_attachment_id, status')
    .eq('org_id', ingest.org_id)
    .eq('email_ingest_id', ingest.id)
    .not('source_attachment_id', 'is', null);
  if (existingError) throw new Error(`Could not inspect existing attachment copies: ${existingError.message}`);
  const existingRows = (existingDocuments ?? []) as {
    id: string;
    source_attachment_id: string | null;
    status: string;
  }[];
  const processedIds = new Set(ingest.processed_attachment_ids ?? []);
  for (const row of existingRows) {
    if (row.source_attachment_id) processedIds.add(row.source_attachment_id);
  }
  const incompleteCopies = existingRows.filter((row) => row.status === 'pending' || row.status === 'error');
  const successfulCopies = existingRows.length - incompleteCopies.length;

  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: messageId,
      processedAttachmentIds: [...processedIds],
      documentsCreated: Math.max(ingest.documents_created ?? 0, successfulCopies),
      existingErrors: incompleteCopies.length
        ? ['A stored Vyso document copy is still pending or failed extraction; retry it in Doc-U.']
        : [],
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
      ingestDocument: async ({ bytes, filename, mediaType, sourceContentType, sourceAttachmentId, note, customerEvidence }) =>
        ingestDocument({
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
          deferCommit: true,
        }),
      recordMessage: async (message, classification) => {
        const { error } = await supabase
          .from('email_ingests')
          .update({
            graph_conversation_id: message.conversationId,
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

  const unsupported = result.actionableUnsupportedAttachments
    ? `${result.actionableUnsupportedAttachments} business document attachment(s) require review.`
    : null;
  const processingError = [...result.errors, ...(unsupported ? [unsupported] : [])].join('; ').slice(0, 500) || null;
  // Partial success is not completion: one pending/errored document must keep the
  // provider ingest visibly failed even when another attachment succeeded.
  const status = finalMicrosoftGraphIngestStatus(result);
  const { error: finalError } = await supabase
    .from('email_ingests')
    .update({
      status,
      documents_created: result.documentsCreated,
      processed_attachment_ids: result.processedAttachmentIds,
      attachment_diagnostics: result.attachmentDiagnostics,
      ...classificationPatch(result.classification),
      error: processingError,
      processed_at: new Date().toISOString(),
    })
    .eq('id', ingest.id)
    .eq('org_id', ingest.org_id);
  if (finalError) throw new Error(`Could not finalize Microsoft ingestion: ${finalError.message}`);
}
