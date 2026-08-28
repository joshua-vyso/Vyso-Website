import {
  MAX_ATTACHMENT_BYTES,
  selectIngestableAttachments,
  type AttachmentLite,
} from './email-ingest-policy.ts';
import type {
  MicrosoftGraphAttachmentMetadata,
  MicrosoftGraphMessageContent,
} from './microsoft-graph-core.ts';

/** The first email-level taxonomy. Document parsing remains in the shared Doc-U pipeline. */
export type MicrosoftEmailClassification =
  | 'customer_order'
  | 'supplier_invoice'
  | 'supplier_statement'
  | 'quote'
  | 'delivery_note'
  | 'credit_note'
  | 'general_correspondence'
  | 'unknown';

export interface MicrosoftEmailClassificationResult {
  classification: MicrosoftEmailClassification;
  /** Same 0–100 convention as documents.confidence. */
  confidence: number;
  /** A bounded machine reason; never copied from message content. */
  reason: string;
}

export interface MicrosoftGraphDocumentSinkResult {
  ok: boolean;
  documentId?: string;
  documentType?: string | null;
  error?: string;
}

export interface MicrosoftGraphIngestDependencies {
  fetchMessage: () => Promise<MicrosoftGraphMessageContent>;
  listAttachments: () => Promise<MicrosoftGraphAttachmentMetadata[]>;
  downloadAttachment: (attachment: MicrosoftGraphAttachmentMetadata) => Promise<Uint8Array>;
  ingestDocument: (input: {
    bytes: Uint8Array;
    filename: string;
    mediaType: string;
    sourceAttachmentId: string;
    note?: string;
  }) => Promise<MicrosoftGraphDocumentSinkResult>;
  recordMessage: (
    message: MicrosoftGraphMessageContent,
    classification: MicrosoftEmailClassificationResult,
  ) => Promise<void>;
  recordAttachmentTotal: (count: number) => Promise<void>;
  recordAttachmentProcessed: (input: {
    attachmentId: string;
    documentId: string;
    documentsCreated: number;
    processedAttachmentIds: string[];
  }) => Promise<void>;
}

export interface MicrosoftGraphIngestResult {
  message: MicrosoftGraphMessageContent;
  classification: MicrosoftEmailClassificationResult;
  documentsCreated: number;
  processedAttachmentIds: string[];
  unsupportedAttachments: number;
  errors: string[];
}

function boundedSignal(value: string | null | undefined, max: number): string {
  return (value ?? '').slice(0, max).toLowerCase();
}

/** Deterministic first pass. Ambiguous documents are decided by the existing parser. */
export function classifyMicrosoftEmail(input: {
  subject?: string | null;
  body?: string | null;
  bodyPreview?: string | null;
  attachmentNames?: readonly string[];
}): MicrosoftEmailClassificationResult {
  const signal = [
    boundedSignal(input.subject, 1_000),
    boundedSignal(input.bodyPreview, 2_000),
    boundedSignal(input.body, 20_000),
    boundedSignal((input.attachmentNames ?? []).join(' '), 5_000),
  ].join('\n');

  if (/\b(credit note|credit memo|tax credit)\b/.test(signal)) {
    return { classification: 'credit_note', confidence: 98, reason: 'credit-note-keyword' };
  }
  if (/\b(tax invoice|supplier invoice|invoice\s+(?:no|number|#))\b/.test(signal)) {
    return { classification: 'supplier_invoice', confidence: 97, reason: 'invoice-keyword' };
  }
  if (/\b(account statement|supplier statement|statement of account)\b/.test(signal)) {
    return { classification: 'supplier_statement', confidence: 96, reason: 'statement-keyword' };
  }
  if (/\b(delivery note|proof of delivery|pod\b)\b/.test(signal)) {
    return { classification: 'delivery_note', confidence: 96, reason: 'delivery-note-keyword' };
  }
  if (/\b(quotation|quote request|request for quote|rfq)\b/.test(signal)) {
    return { classification: 'quote', confidence: 92, reason: 'quote-keyword' };
  }
  if (/\b(purchase order|customer order|new order|order form|order request)\b/.test(signal)) {
    return { classification: 'customer_order', confidence: 90, reason: 'order-keyword' };
  }
  if ((input.body ?? input.bodyPreview ?? '').trim()) {
    return {
      classification: 'general_correspondence',
      confidence: 55,
      reason: 'message-text-only',
    };
  }
  return { classification: 'unknown', confidence: 0, reason: 'no-deterministic-signal' };
}

/** Existing parser output outranks ambiguous email text, but never erases a credit note. */
export function classificationFromDocumentType(
  current: MicrosoftEmailClassificationResult,
  documentType: string | null | undefined,
): MicrosoftEmailClassificationResult {
  if (current.classification === 'credit_note') return current;
  const classification =
    documentType === 'order'
      ? 'customer_order'
      : documentType === 'invoice'
        ? 'supplier_invoice'
        : documentType === 'statement'
          ? 'supplier_statement'
          : documentType === 'delivery_note'
            ? 'delivery_note'
            : null;
  return classification
    ? { classification, confidence: Math.max(current.confidence, 90), reason: 'existing-document-parser' }
    : current;
}

/** Reuse the inbound-email format, inline and size policy without its Resend transport. */
export function selectMicrosoftGraphAttachments(
  attachments: readonly MicrosoftGraphAttachmentMetadata[],
): MicrosoftGraphAttachmentMetadata[] {
  const byId = new Map(attachments.map((attachment) => [attachment.id, attachment]));
  const candidates: AttachmentLite[] = attachments
    .filter((attachment) => attachment.attachmentType?.toLowerCase() === '#microsoft.graph.fileattachment')
    .map((attachment) => ({
      id: attachment.id,
      filename: attachment.name ?? 'document',
      size: attachment.size,
      content_type: attachment.contentType ?? 'application/octet-stream',
      content_disposition: attachment.isInline ? 'inline' : 'attachment',
      download_url: '',
    }));
  return selectIngestableAttachments(candidates)
    .map((candidate) => byId.get(candidate.id))
    .filter((attachment) => attachment !== undefined);
}

function shortFailure(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  return message.slice(0, 300);
}

/**
 * Provider-neutral orchestration around Graph reads. The only sink is the existing
 * Doc-U ingestion function supplied by the server adapter.
 */
export async function ingestMicrosoftGraphMessage(
  input: {
    expectedMessageId: string;
    processedAttachmentIds: readonly string[];
    documentsCreated: number;
    /** Existing Vyso copies that are still pending/errored remain explicit failures. */
    existingErrors?: readonly string[];
  },
  dependencies: MicrosoftGraphIngestDependencies,
): Promise<MicrosoftGraphIngestResult> {
  const message = await dependencies.fetchMessage();
  if (message.id !== input.expectedMessageId) {
    throw new Error('Microsoft Graph returned a different message id.');
  }

  const attachments = message.hasAttachments ? await dependencies.listAttachments() : [];
  let classification = classifyMicrosoftEmail({
    subject: message.subject,
    body: message.body?.content,
    bodyPreview: message.bodyPreview,
    attachmentNames: attachments.map((attachment) => attachment.name ?? ''),
  });
  await dependencies.recordMessage(message, classification);
  await dependencies.recordAttachmentTotal(attachments.length);
  const usable = selectMicrosoftGraphAttachments(attachments);
  const alreadyDone = new Set(input.processedAttachmentIds);
  let documentsCreated = input.documentsCreated;
  const errors: string[] = [...(input.existingErrors ?? [])];

  for (const attachment of usable) {
    if (alreadyDone.has(attachment.id)) continue;
    const filename = (attachment.name ?? 'document').slice(0, 200);
    try {
      const bytes = await dependencies.downloadAttachment(attachment);
      if (bytes.byteLength < 1 || bytes.byteLength > MAX_ATTACHMENT_BYTES) {
        errors.push('Attachment download was empty or exceeded the processing limit.');
        continue;
      }
      const result = await dependencies.ingestDocument({
        bytes,
        filename,
        mediaType: attachment.contentType ?? 'application/octet-stream',
        sourceAttachmentId: attachment.id,
        note: message.subject?.slice(0, 500),
      });
      if (result.documentId) {
        if (result.ok) documentsCreated += 1;
        alreadyDone.add(attachment.id);
        await dependencies.recordAttachmentProcessed({
          attachmentId: attachment.id,
          documentId: result.documentId,
          documentsCreated,
          processedAttachmentIds: [...alreadyDone],
        });
      }
      if (result.ok) {
        classification = classificationFromDocumentType(classification, result.documentType);
      } else {
        errors.push((result.error ?? 'Existing document parser failed.').slice(0, 300));
      }
    } catch (error) {
      errors.push(shortFailure(error, 'Attachment processing failed.'));
    }
  }

  return {
    message,
    classification,
    documentsCreated,
    processedAttachmentIds: [...alreadyDone],
    unsupportedAttachments: Math.max(0, attachments.length - usable.length),
    errors,
  };
}
