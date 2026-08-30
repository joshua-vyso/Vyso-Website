import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_EMAIL,
  selectIngestableAttachments,
  type AttachmentLite,
} from './email-ingest-policy.ts';
import type {
  MicrosoftGraphAttachmentMetadata,
  MicrosoftGraphMessageContent,
} from './microsoft-graph-core.ts';
import type { DocumentSourceType } from './types.ts';

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
  /** True only when the message asks Vyso's customer to supply actual goods. */
  orderingIntentDetected: boolean;
  /** Which source established the business meaning of the message. */
  primarySource: 'attachment' | 'email_body' | 'combined' | 'none';
  /** Bounded machine codes only. No subject, body, sender or filename content. */
  evidence: string[];
}

export type MicrosoftGraphAttachmentDisposition =
  | 'processable'
  | 'processable_verified_pdf'
  | 'provisional_pdf'
  | 'ignored_inline'
  | 'ignored_attachment_kind'
  | 'ignored_non_document'
  | 'unsupported_media_type'
  | 'unsupported_too_large'
  | 'unsupported_attachment_limit'
  | 'invalid_pdf_signature';

export interface MicrosoftGraphAttachmentDiagnostic {
  attachmentId: string;
  disposition: MicrosoftGraphAttachmentDisposition;
  /** Original Graph metadata, retained separately from Vyso's processing MIME. */
  providerContentType: string;
  processingContentType: string | null;
  fileExtension: string | null;
  /** True when silently dropping this part could lose a business document. */
  actionable: boolean;
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
    sourceContentType: string;
    sourceType: DocumentSourceType;
    sourceAttachmentId: string;
    note?: string;
    customerEvidence: {
      senderEmail: string | null;
      senderName: string | null;
      subject: string | null;
      messageText: string | null;
    };
  }) => Promise<MicrosoftGraphDocumentSinkResult>;
  ingestBodyOrder: (input: {
    message: MicrosoftGraphMessageContent;
  }) => Promise<MicrosoftGraphDocumentSinkResult>;
  reconcileBodyWithOrderDocument: (input: {
    message: MicrosoftGraphMessageContent;
    documentId: string;
    attachmentSourceIds: string[];
    multipleOrderSources: boolean;
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
  actionableUnsupportedAttachments: number;
  attachmentDiagnostics: MicrosoftGraphAttachmentDiagnostic[];
  errors: string[];
}

function boundedSignal(value: string | null | undefined, max: number): string {
  return (value ?? '').slice(0, max).toLowerCase();
}

function boundedEvidence(values: Iterable<string>): string[] {
  return [...new Set(values)].slice(0, 20);
}

function senderDomain(address: string | null | undefined): string | null {
  const value = boundedSignal(address, 320).trim();
  const at = value.lastIndexOf('@');
  return at > 0 && at < value.length - 1 ? value.slice(at + 1) : null;
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'yahoo.com', 'yahoo.co.za', 'proton.me', 'protonmail.com',
]);

type ClassificationSource = 'email_body' | 'attachment';
type Candidate = {
  classification: MicrosoftEmailClassification;
  confidence: number;
  source: ClassificationSource;
  reason: string;
};

const QUANTITY_UNIT_RE = /\b\d+(?:[.,]\d+)?\s*(?:kg|g|grams?|kilograms?|boxes?|punnets?|bags?|crates?|trays?|bunch(?:es)?|packets?|packs?|pockets?|each|ea|doz(?:en)?|tubs?|cartons?)\b/gi;
const EXPLICIT_SUPPLY_RE = /\b(?:please|kindly)\s+(?:send|deliver|supply|arrange)|\bwe\s+need\b|\bcan\s+(?:i|we)\s+(?:get|have)\b|\b(?:i|we)\s+would\s+like\s+to\s+order\b|\border\s+for\b/i;
const STRONG_ORDER_LABEL_RE = /\b(?:purchase\s+order|purchase\s+requisition|requisition|customer\s+order|order\s+form|order\s+request)\b/i;
const ORDER_REFERENCE_RE = /\b(?:purchase\s+order|requisition)(?:\s*(?:no|number|#|ref(?:erence)?)\.?\s*[:#-]?)?\s*[a-z0-9][a-z0-9/_-]{2,}\b|\bpo(?:\s*(?:no|number|#|ref(?:erence)?)\.?\s*[:#-]?)?\s*(?=[a-z0-9/_-]*\d)[a-z0-9][a-z0-9/_-]{2,}\b/i;
const PRICE_ENQUIRY_RE = /\b(?:please\s+(?:send|provide|confirm)\s+(?:the\s+)?(?:price|pricing|prices|quotation|quote)|request(?:ing)?\s+(?:a\s+)?(?:price|pricing|quotation|quote)|how\s+much\s+(?:is|are|for)|price\s+(?:enquiry|inquiry|list)|quote\s+(?:for|on))\b/i;
const AVAILABILITY_ENQUIRY_RE = /\b(?:do\s+you\s+have|is|are)\b[^.!?\n]{0,80}\b(?:available|in\s+stock)\b|\b(?:availability|stock\s+availability)\s+(?:of|for|on)\b/i;
const COMPLAINT_RE = /\b(?:complaint|quality\s+issue|issue\s+with|problem\s+with|damaged|incorrect|wrong|short[- ]delivered|not\s+happy|return(?:ing)?|refund)\b/i;
const HISTORIC_ORDER_RE = /\b(?:status\s+of|follow(?:ing)?\s+up\s+on|regarding|about|where\s+is|delayed)\b[^.!?\n]{0,80}\b(?:order|po|delivery)\b/i;
const ATTACHED_ONLY_RE = /\b(?:please|kindly)\s+(?:see|find)\s+(?:the\s+)?attached\b/i;

function quantityLineCount(value: string): number {
  return [...value.matchAll(QUANTITY_UNIT_RE)].length;
}

function attachmentCandidate(
  attachment: Pick<MicrosoftGraphAttachmentMetadata, 'name' | 'contentType' | 'isInline'>,
): Candidate | null {
  if (attachment.isInline) return null;
  const name = boundedSignal(attachment.name, 500).replace(/[._-]+/g, ' ');
  if (/\b(?:credit\s+note|credit\s+memo)\b/.test(name)) {
    return { classification: 'credit_note', confidence: 97, source: 'attachment', reason: 'attachment-credit-note-label' };
  }
  if (/\b(?:tax\s+invoice|supplier\s+invoice|invoice)(?:\s|\d|$)/.test(name)) {
    return { classification: 'supplier_invoice', confidence: 96, source: 'attachment', reason: 'attachment-invoice-label' };
  }
  if (/\b(?:statement\s+of\s+account|supplier\s+statement|account\s+statement|statement)(?:\s|\d|$)/.test(name)) {
    return { classification: 'supplier_statement', confidence: 94, source: 'attachment', reason: 'attachment-statement-label' };
  }
  if (/\b(?:delivery\s+note|proof\s+of\s+delivery|pod)(?:\s|\d|$)/.test(name)) {
    return { classification: 'delivery_note', confidence: 94, source: 'attachment', reason: 'attachment-delivery-note-label' };
  }
  if (/\b(?:quotation|quote|rfq)(?:\s|\d|$)/.test(name)) {
    return { classification: 'quote', confidence: 91, source: 'attachment', reason: 'attachment-quote-label' };
  }
  if (/\b(?:purchase\s+order|purchase\s+requisition|requisition|customer\s+order)\b|(?:^|\s)po\s*\d{3,}/.test(name)) {
    return { classification: 'customer_order', confidence: 94, source: 'attachment', reason: 'attachment-order-label' };
  }
  return null;
}

function messageCandidates(input: {
  subject: string;
  body: string;
  bodyPreview: string;
}): { candidates: Candidate[]; orderingIntent: boolean; orderIntentExcluded: boolean; evidence: string[] } {
  const { subject } = input;
  const body = input.body || input.bodyPreview;
  const combined = `${subject}\n${input.body}\n${input.bodyPreview}`;
  const evidence: string[] = [];
  const candidates: Candidate[] = [];
  if (input.body.trim()) evidence.push('body:full-text-present');
  if (input.bodyPreview.trim()) evidence.push('body:preview-present');
  const quantities = quantityLineCount(body);
  if (quantities > 0) evidence.push(quantities > 1 ? 'body:multiple-quantity-uom-lines' : 'body:quantity-uom-line');

  const priceEnquiry = PRICE_ENQUIRY_RE.test(combined);
  const availabilityEnquiry = AVAILABILITY_ENQUIRY_RE.test(combined);
  const complaint = COMPLAINT_RE.test(combined);
  const historicReference = HISTORIC_ORDER_RE.test(combined);
  if (priceEnquiry) evidence.push('message:price-enquiry');
  if (availabilityEnquiry) evidence.push('message:availability-enquiry');
  if (complaint) evidence.push('message:complaint');
  if (historicReference) evidence.push('message:historic-order-reference');

  if (/\b(?:credit\s+note|credit\s+memo|tax\s+credit)\b/.test(combined)) {
    candidates.push({ classification: 'credit_note', confidence: 96, source: 'email_body', reason: 'message-credit-note-label' });
  }
  if (/\b(?:tax\s+invoice|supplier\s+invoice|invoice\s+(?:no|number|#))\b/.test(combined)) {
    candidates.push({ classification: 'supplier_invoice', confidence: 95, source: 'email_body', reason: 'message-invoice-label' });
  }
  if (/\b(?:account\s+statement|supplier\s+statement|statement\s+of\s+account)\b/.test(combined)) {
    candidates.push({ classification: 'supplier_statement', confidence: 94, source: 'email_body', reason: 'message-statement-label' });
  }
  if (/\b(?:delivery\s+note|proof\s+of\s+delivery|pod)\b/.test(combined)) {
    candidates.push({ classification: 'delivery_note', confidence: 94, source: 'email_body', reason: 'message-delivery-note-label' });
  }
  if (priceEnquiry || /\b(?:quotation|request\s+for\s+quote|rfq)\b/.test(combined)) {
    candidates.push({ classification: 'quote', confidence: priceEnquiry ? 90 : 88, source: 'email_body', reason: priceEnquiry ? 'message-price-enquiry' : 'message-quote-label' });
  }

  const explicitSupply = EXPLICIT_SUPPLY_RE.test(body);
  const strongOrderLabel = STRONG_ORDER_LABEL_RE.test(subject) || STRONG_ORDER_LABEL_RE.test(body);
  const orderReference = ORDER_REFERENCE_RE.test(subject) || ORDER_REFERENCE_RE.test(body);
  const standaloneOrderSubject = /^\s*(?:new\s+)?order\s*[:#-]?\s*$/i.test(subject);
  const attachedOnly = ATTACHED_ONLY_RE.test(body) && quantities === 0;
  if (explicitSupply) evidence.push('body:explicit-supply-request');
  if (strongOrderLabel) evidence.push('message:order-document-label');
  if (orderReference) evidence.push('message:order-reference');
  if (standaloneOrderSubject) evidence.push('subject:standalone-order');
  if (attachedOnly) evidence.push('body:attachment-pointer-only');

  const excludedIntent = priceEnquiry || availabilityEnquiry || complaint || historicReference;
  const orderingIntent = !excludedIntent && (
    (explicitSupply && quantities > 0) ||
    ((strongOrderLabel || standaloneOrderSubject) && quantities > 0) ||
    (strongOrderLabel && orderReference) ||
    (orderReference && quantities > 0)
  );
  if (orderingIntent && !attachedOnly) {
    candidates.push({
      classification: 'customer_order',
      confidence: quantities > 0 && explicitSupply ? 93 : quantities > 0 ? 90 : 89,
      source: 'email_body',
      reason: 'message-ordering-intent',
    });
  }
  return {
    candidates,
    orderingIntent: orderingIntent && !attachedOnly,
    orderIntentExcluded: excludedIntent,
    evidence,
  };
}

const CLASSIFICATION_PRIORITY: Record<MicrosoftEmailClassification, number> = {
  credit_note: 80,
  supplier_invoice: 70,
  supplier_statement: 60,
  delivery_note: 50,
  quote: 40,
  customer_order: 30,
  general_correspondence: 10,
  unknown: 0,
};

function bestCandidate(candidates: readonly Candidate[]): Candidate | null {
  return [...candidates].sort((a, b) =>
    b.confidence - a.confidence ||
    CLASSIFICATION_PRIORITY[b.classification] - CLASSIFICATION_PRIORITY[a.classification],
  )[0] ?? null;
}

/** Deterministic first pass. Ambiguous documents are decided by the existing parser. */
export function classifyMicrosoftEmail(input: {
  subject?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  body?: string | null;
  bodyPreview?: string | null;
  attachments?: readonly Pick<MicrosoftGraphAttachmentMetadata, 'name' | 'contentType' | 'isInline'>[];
}): MicrosoftEmailClassificationResult {
  const subject = boundedSignal(input.subject, 1_000);
  const body = boundedSignal(input.body, 20_000);
  const bodyPreview = boundedSignal(input.bodyPreview, 2_000);
  const message = messageCandidates({ subject, body, bodyPreview });
  const rawAttachmentCandidates = (input.attachments ?? []).map(attachmentCandidate).filter((value): value is Candidate => value !== null);
  // The message is the business-intent container. An attached old PO does not
  // turn a complaint, availability check or price enquiry into a fresh order.
  const attachmentCandidates = message.orderIntentExcluded
    ? rawAttachmentCandidates.filter((candidate) => candidate.classification !== 'customer_order')
    : rawAttachmentCandidates;
  const candidates = [...message.candidates, ...attachmentCandidates];
  const chosen = bestCandidate(candidates);
  const evidence = [...message.evidence];
  const domain = senderDomain(input.senderEmail);
  if ((input.senderName ?? '').trim()) evidence.push('sender:display-name-present');
  if (domain) evidence.push(FREE_EMAIL_DOMAINS.has(domain) ? 'sender:free-email-domain' : 'sender:business-domain');
  for (const attachment of input.attachments ?? []) {
    if (attachment.isInline) continue;
    const type = (attachment.contentType ?? '').split(';', 1)[0].trim().toLowerCase();
    evidence.push(
      type === 'application/pdf'
        ? 'attachment:mime-pdf'
        : type.startsWith('image/')
          ? 'attachment:mime-image'
          : /(?:spreadsheet|excel|csv)/.test(type)
            ? 'attachment:mime-spreadsheet'
            : genericContentType(type)
              ? 'attachment:mime-generic'
              : 'attachment:mime-other',
    );
  }
  for (const candidate of candidates) evidence.push(candidate.reason);

  if (chosen) {
    const sameClassSources = new Set(candidates
      .filter((candidate) => candidate.classification === chosen.classification)
      .map((candidate) => candidate.source));
    // A PO attachment may carry the structured lines while the body carries
    // only a real delivery/supply instruction. That is combined message
    // evidence, but deliberately not enough to make a body-only order.
    const bodyCorroboratesAttachmentOrder =
      chosen.classification === 'customer_order' &&
      chosen.source === 'attachment' &&
      !message.orderIntentExcluded &&
      message.evidence.some((entry) => [
        'body:explicit-supply-request',
        'message:order-document-label',
        'message:order-reference',
        'subject:standalone-order',
      ].includes(entry)) &&
      !message.evidence.includes('body:attachment-pointer-only');
    const primarySource = sameClassSources.size > 1
      ? 'combined'
      : bodyCorroboratesAttachmentOrder
        ? 'combined'
        : chosen.source;
    return {
      classification: chosen.classification,
      confidence: Math.min(99, chosen.confidence + (primarySource === 'combined' ? 3 : 0)),
      reason: chosen.reason,
      orderingIntentDetected: chosen.classification === 'customer_order' && (
        message.orderingIntent || attachmentCandidates.some((candidate) => candidate.classification === 'customer_order')
      ),
      primarySource,
      evidence: boundedEvidence(evidence),
    };
  }

  if (body.trim() || bodyPreview.trim() || subject.trim()) {
    return {
      classification: 'general_correspondence',
      confidence: 60,
      reason: 'message-no-business-document-intent',
      orderingIntentDetected: false,
      primarySource: 'email_body',
      evidence: boundedEvidence(evidence),
    };
  }
  return {
    classification: 'unknown',
    confidence: 0,
    reason: 'no-deterministic-signal',
    orderingIntentDetected: false,
    primarySource: 'none',
    evidence: boundedEvidence(evidence),
  };
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
  if (!classification) return current;
  if (
    classification === 'customer_order' &&
    current.evidence.some((entry) => [
      'message:price-enquiry',
      'message:availability-enquiry',
      'message:complaint',
      'message:historic-order-reference',
    ].includes(entry))
  ) {
    return {
      ...current,
      evidence: boundedEvidence([...current.evidence, 'attachment:parsed-order-without-new-order-intent']),
    };
  }
  const messageSupportedSameClassification = current.classification === classification &&
    (current.primarySource === 'email_body' || current.primarySource === 'combined');
  return {
    classification,
    confidence: Math.max(current.confidence, 95),
    reason: 'parsed-attachment-document-type',
    orderingIntentDetected: classification === 'customer_order',
    primarySource: messageSupportedSameClassification ? 'combined' : 'attachment',
    evidence: boundedEvidence([...current.evidence, `attachment:parsed-${documentType}`]),
  };
}

function fileExtension(name: string | null | undefined): string | null {
  const match = /\.([a-z0-9]{1,10})$/i.exec((name ?? '').trim());
  return match?.[1]?.toLowerCase() ?? null;
}

function genericContentType(value: string | null | undefined): boolean {
  const type = (value ?? '').split(';', 1)[0].trim().toLowerCase();
  return !type || type === 'application/octet-stream' || type === 'binary/octet-stream';
}

function businessDocumentLike(extension: string | null, contentType: string): boolean {
  if (extension && new Set(['pdf', 'xls', 'xlsx', 'csv', 'doc', 'docx', 'txt', 'rtf', 'eml']).has(extension)) return true;
  return /(?:pdf|spreadsheet|excel|csv|word|rtf|message\/rfc822)/i.test(contentType);
}

/** Distinguish ignored mail furniture from a business document Vyso cannot process yet. */
export function diagnoseMicrosoftGraphAttachments(
  attachments: readonly MicrosoftGraphAttachmentMetadata[],
): MicrosoftGraphAttachmentDiagnostic[] {
  let processable = 0;
  return attachments.map((attachment) => {
    const providerContentType = (attachment.contentType ?? 'application/octet-stream').slice(0, 200);
    const extension = fileExtension(attachment.name);
    const base = {
      attachmentId: attachment.id,
      providerContentType,
      fileExtension: extension,
    };
    if (attachment.attachmentType?.toLowerCase() !== '#microsoft.graph.fileattachment') {
      return { ...base, disposition: 'ignored_attachment_kind', processingContentType: null, actionable: false };
    }
    if (attachment.isInline) {
      return { ...base, disposition: 'ignored_inline', processingContentType: null, actionable: false };
    }
    const actionable = businessDocumentLike(extension, providerContentType);
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      return { ...base, disposition: 'unsupported_too_large', processingContentType: null, actionable };
    }
    const lite: AttachmentLite = {
      id: attachment.id,
      filename: attachment.name ?? 'document',
      size: attachment.size,
      content_type: providerContentType,
      content_disposition: 'attachment',
      download_url: '',
    };
    const supported = selectIngestableAttachments([lite]).length === 1;
    const provisionalPdf = genericContentType(providerContentType) && extension === 'pdf';
    if (supported || provisionalPdf) {
      if (processable >= MAX_ATTACHMENTS_PER_EMAIL) {
        return { ...base, disposition: 'unsupported_attachment_limit', processingContentType: null, actionable: true };
      }
      processable += 1;
      return {
        ...base,
        disposition: supported ? 'processable' : 'provisional_pdf',
        processingContentType: supported ? providerContentType : 'application/pdf',
        actionable: true,
      };
    }
    return {
      ...base,
      disposition: actionable ? 'unsupported_media_type' : 'ignored_non_document',
      processingContentType: null,
      actionable,
    };
  });
}

/** Reuse the inbound-email policy, with one Graph-only provisional PDF lane. */
export function selectMicrosoftGraphAttachments(
  attachments: readonly MicrosoftGraphAttachmentMetadata[],
): MicrosoftGraphAttachmentMetadata[] {
  const selectedIds = new Set(diagnoseMicrosoftGraphAttachments(attachments)
    .filter((entry) => entry.disposition === 'processable' || entry.disposition === 'provisional_pdf')
    .map((entry) => entry.attachmentId));
  return attachments.filter((attachment) => selectedIds.has(attachment.id));
}

/** A generic MIME plus .pdf filename is only trusted after this check. */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 &&
    bytes[3] === 0x46 && bytes[4] === 0x2d;
}

export function finalMicrosoftGraphIngestStatus(result: Pick<
  MicrosoftGraphIngestResult,
  'classification' | 'documentsCreated' | 'actionableUnsupportedAttachments' | 'errors'
>): 'done' | 'failed' | 'ignored' {
  if (result.errors.length > 0 || result.actionableUnsupportedAttachments > 0) return 'failed';
  if (result.documentsCreated > 0) return 'done';
  if (
    result.classification.orderingIntentDetected ||
    ['supplier_invoice', 'supplier_statement', 'delivery_note', 'credit_note'].includes(result.classification.classification)
  ) {
    return 'failed';
  }
  return 'ignored';
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
    /** Existing successful attachment order documents, used after a crash/retry. */
    existingOrderDocuments?: readonly { documentId: string; attachmentId: string }[];
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
    senderName: message.from?.name,
    senderEmail: message.from?.address,
    body: message.body?.content,
    bodyPreview: message.bodyPreview,
    attachments,
  });
  await dependencies.recordMessage(message, classification);
  await dependencies.recordAttachmentTotal(attachments.length);
  const attachmentDiagnostics = diagnoseMicrosoftGraphAttachments(attachments);
  const usable = selectMicrosoftGraphAttachments(attachments);
  const alreadyDone = new Set(input.processedAttachmentIds);
  const orderDocuments = [...(input.existingOrderDocuments ?? [])];
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
      const diagnostic = attachmentDiagnostics.find((entry) => entry.attachmentId === attachment.id);
      if (diagnostic?.disposition === 'provisional_pdf' && !hasPdfSignature(bytes)) {
        diagnostic.disposition = 'invalid_pdf_signature';
        diagnostic.processingContentType = null;
        diagnostic.actionable = true;
        continue;
      }
      if (diagnostic?.disposition === 'provisional_pdf') {
        diagnostic.disposition = 'processable_verified_pdf';
      }
      const processingContentType = diagnostic?.processingContentType ?? attachment.contentType ?? 'application/octet-stream';
      const result = await dependencies.ingestDocument({
        bytes,
        filename,
        mediaType: processingContentType,
        sourceContentType: attachment.contentType ?? 'application/octet-stream',
        sourceType: processingContentType === 'application/pdf' ? 'pdf' : 'image',
        sourceAttachmentId: attachment.id,
        note: message.subject?.slice(0, 500),
        customerEvidence: {
          senderEmail: message.from?.address ?? null,
          senderName: message.from?.name ?? null,
          subject: message.subject ?? null,
          messageText: (message.body?.content ?? message.bodyPreview ?? '').slice(0, 20_000) || null,
        },
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
        if (result.documentId && result.documentType === 'order') {
          orderDocuments.push({ documentId: result.documentId, attachmentId: attachment.id });
        }
      } else {
        errors.push((result.error ?? 'Existing document parser failed.').slice(0, 300));
      }
    } catch (error) {
      errors.push(shortFailure(error, 'Attachment processing failed.'));
    }
  }

  // Wave B: an explicit order carried in the body is a source part of this
  // message. It either becomes the one body-only review document, or reconciles
  // into the existing attachment-backed order. It never creates a second order
  // merely because an attachment also contains order evidence.
  const bodyOrderEvidence = Boolean(message.body?.content?.trim()) && (
    classification.evidence.includes('message-ordering-intent') ||
    (
      classification.classification === 'customer_order' &&
      classification.primarySource === 'combined' &&
      classification.evidence.some((entry) => [
        'body:explicit-supply-request',
        'message:order-document-label',
        'message:order-reference',
        'subject:standalone-order',
      ].includes(entry))
    )
  );
  if (bodyOrderEvidence && !alreadyDone.has('email-body')) {
    try {
      const distinctOrderDocuments = [...new Map(orderDocuments.map((entry) => [entry.documentId, entry])).values()];
      const bodyResult = distinctOrderDocuments.length > 0
        ? await dependencies.reconcileBodyWithOrderDocument({
            message,
            documentId: distinctOrderDocuments[0].documentId,
            attachmentSourceIds: distinctOrderDocuments.map((entry) => entry.attachmentId),
            multipleOrderSources: distinctOrderDocuments.length > 1,
          })
        : await dependencies.ingestBodyOrder({ message });
      if (bodyResult.ok && bodyResult.documentId) {
        if (distinctOrderDocuments.length === 0) documentsCreated += 1;
        alreadyDone.add('email-body');
        await dependencies.recordAttachmentProcessed({
          attachmentId: 'email-body',
          documentId: bodyResult.documentId,
          documentsCreated,
          processedAttachmentIds: [...alreadyDone],
        });
        classification = {
          ...classification,
          classification: 'customer_order',
          orderingIntentDetected: true,
          primarySource: distinctOrderDocuments.length > 0 ? 'combined' : 'email_body',
          reason: distinctOrderDocuments.length > 0 ? 'message-order-reconciled' : 'message-body-order-ingested',
          evidence: boundedEvidence([...classification.evidence, 'email_body:order-source-processed']),
        };
        if (distinctOrderDocuments.length > 1) {
          errors.push('Multiple order attachments require human review; only one canonical message order was reconciled.');
        }
      } else {
        errors.push((bodyResult.error ?? 'Email body order processing failed.').slice(0, 300));
      }
    } catch (error) {
      errors.push(shortFailure(error, 'Email body order processing failed.'));
    }
  }

  const unsupported = attachmentDiagnostics.filter((entry) => entry.disposition.startsWith('unsupported_') || entry.disposition === 'invalid_pdf_signature');
  return {
    message,
    classification,
    documentsCreated,
    processedAttachmentIds: [...alreadyDone],
    unsupportedAttachments: unsupported.length,
    actionableUnsupportedAttachments: unsupported.filter((entry) => entry.actionable).length,
    attachmentDiagnostics,
    errors,
  };
}
