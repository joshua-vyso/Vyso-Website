import type { SupabaseClient } from '@supabase/supabase-js';
import { extractOrderText } from '@/lib/ai/order-reader';
import type { OrderExtractionResult } from '@/lib/ai/order-prompt';
import { coerceOrderExtraction } from '@/lib/ai/order-prompt';
import {
  emailSourceStoragePath,
  ingestDocument,
  type IngestDocumentResult,
} from '@/lib/platform/document-ingest';
import { isUniqueViolation } from '@/lib/platform/db-errors';
import { resolveExistingCustomerForOrg } from '@/lib/platform/docu/customer-match';
import { previewExistingCustomerInterpretation } from '@/lib/platform/docu/customer-interpretation-preview';
import {
  attachmentOnlyOrderEvidence,
  bodyOnlyOrderEvidence,
  EMAIL_BODY_SOURCE_PART_ID,
  reconcileMessageOrder,
  withBodySourceAssessment,
} from '@/lib/platform/docu/message-order-reconciliation';
import {
  assessBodySource,
  assessCanonicalOrder,
  assessmentAdmitsZeroLines,
  type BodySourceAssessment,
  type BodySourceRead,
} from '@/lib/platform/docu/body-source-assessment';
import {
  buildNormalizedReaderSource,
  normalizeEmailHtml,
  type NormalizedEmailHtml,
} from '@/lib/platform/docu/email-html-normalizer';
import type { ExtractedData, MessageOrderEvidence } from '@/lib/platform/types';
import type { MicrosoftGraphMessageContent } from '@/lib/platform/microsoft-graph-core';

const MAX_EMAIL_BODY_SOURCE_BYTES = 1_000_000;

/**
 * The ORIGINAL body, kept beside the derived text rather than instead of it.
 *
 * Until now the only copy Vyso held of an email body was the text it read from,
 * and when that text turned out to be a table Exchange had already destroyed,
 * there was nothing to go back to — the evidence for the whole investigation had
 * to be pulled out of the live mailbox by hand. The 'email-body' object keeps
 * holding the derived text (every existing row, and every reader, still finds
 * exactly what it expects there); this second object holds the bytes the sender
 * sent. Private storage, never rendered, never re-parsed for display.
 */
export const EMAIL_BODY_ORIGINAL_SOURCE_PART_ID = 'email-body-original' as const;

function bodyText(message: MicrosoftGraphMessageContent): string {
  // Preserve the exact text representation Graph returned. Trimming is valid
  // for emptiness checks, but not for the private source-of-truth copy.
  return message.body?.content ?? '';
}

/** Graph's own word for what it sent, faithfully — 'html' or 'text'. */
function bodyContentType(message: MicrosoftGraphMessageContent): string {
  return (message.body?.contentType ?? 'text').toLowerCase() === 'html' ? 'html' : 'text';
}

interface PreparedBodySource {
  /** Exactly what Graph returned. The source of truth, stored untouched. */
  original: string;
  /** 'html' | 'text', as Graph declared it now that we no longer ask for text. */
  contentType: string;
  /** Plain text derived from the original — what classification and storage use. */
  derivedText: string;
  /** What the ORDER READER is given: prose plus serialised table rows. */
  readerSource: string;
  hasTables: boolean;
  read: BodySourceRead;
  normalized: NormalizedEmailHtml;
}

/**
 * One deterministic pass over the body, shared by every caller below.
 *
 * A TEXT body is not put through the HTML parser at all: it has no markup to
 * interpret, and running a parser over it could only invent structure that the
 * sender did not write. That keeps every plain-text order in production on
 * byte-identical behaviour.
 */
function prepareBodySource(
  message: MicrosoftGraphMessageContent,
  orderIntent = true,
): PreparedBodySource {
  const original = bodyText(message);
  const contentType = bodyContentType(message);
  const normalized: NormalizedEmailHtml = contentType === 'html'
    ? normalizeEmailHtml(original)
    : { text: original, textOutsideTables: original, tables: [], links: [] };
  const read = assessBodySource({ contentType, normalized, orderIntent });
  const readerSource = contentType === 'html' ? buildNormalizedReaderSource(normalized) : original;
  return {
    original,
    contentType,
    derivedText: normalized.text,
    readerSource,
    hasTables: normalized.tables.length > 0,
    read,
    normalized,
  };
}

/**
 * Preserve the sender's own bytes, once, beside the derived text.
 *
 * Same 1MB ceiling and the same idempotent upsert convention as the derived
 * copy, and the same silence about content: a body is never logged, only stored.
 * A failure here is reported, never swallowed — losing the original is what put
 * this feature in the backlog.
 */
async function persistOriginalBodyHtml(
  supabase: SupabaseClient,
  input: { orgId: string; emailIngestId: string; original: string },
): Promise<void> {
  const bytes = Buffer.from(input.original, 'utf8');
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_EMAIL_BODY_SOURCE_BYTES) return;
  const storagePath = emailSourceStoragePath(
    input.orgId,
    input.emailIngestId,
    EMAIL_BODY_ORIGINAL_SOURCE_PART_ID,
  );
  const { error } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, { contentType: 'text/html; charset=utf-8', upsert: false });
  if (error && !isUniqueViolation(error)) {
    throw new Error(`Could not preserve the original email body: ${error.message}`);
  }
}

function bodyFilename(subject: string | null): string {
  const base = (subject ?? 'Order email')
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'Order email';
  return `${base} - email body.txt`;
}

async function catalogueNames(supabase: SupabaseClient, orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('pp_stock_items')
    .select('name')
    .eq('org_id', orgId)
    .order('name', { ascending: true });
  if (error) throw new Error(`Could not read the product catalogue: ${error.message}`);
  return ((data ?? []) as { name: string | null }[]).map((row) => row.name?.trim() ?? '').filter(Boolean);
}

interface BodyOrderRead {
  order: OrderExtractionResult;
  assessment: BodySourceAssessment;
  prepared: PreparedBodySource;
}

/**
 * Read the body, then decide whether an order may honestly be built from it.
 *
 * THE ZERO-LINE THROW IS NOW A LAST RESORT, not the first gate. It used to fire
 * on the Four Seasons notification — a message that names the property, the
 * buyer and the purchase-order number and then says the order lives in the
 * customer's portal — and turned the single most reviewable email in the
 * mailbox into a failed ingest with nothing on screen. An order with no lines is
 * a fact about that email, not a fault in reading it, so when the assessment
 * says the lines are UNAVAILABLE (they are somewhere else) or UNSAFE (the row
 * structure did not survive) and there is something a human can act on — a
 * customer, a PO reference, or the link itself — this returns the assessment and
 * lets the review document be filed. It still throws when there is literally
 * nothing reviewable.
 *
 * UNSAFE ORDERS ARRIVE WITH THEIR LINES REMOVED. Ninety-seven guesses about
 * which quantity belonged to which product are not evidence, and filing them
 * would ask a reviewer to audit a hundred rows that nobody sent.
 */
async function readBodyOrder(
  supabase: SupabaseClient,
  orgId: string,
  message: MicrosoftGraphMessageContent,
  allowSupplemental = false,
): Promise<BodyOrderRead> {
  const prepared = prepareBodySource(message);
  if (!prepared.original.trim()) throw new Error('The Microsoft message body is empty.');
  // An HTML body that normalises to nothing readable (an image-only newsletter,
  // a body that was one tracking pixel) is not handed to a model at all: there
  // is no text to transcribe, and asking anyway would spend an unattended AI
  // call to be told so.
  const order = prepared.readerSource.trim()
    ? await extractOrderText({
        subject: message.subject,
        senderName: message.from?.name,
        senderEmail: message.from?.address,
        receivedDateTime: message.receivedDateTime,
        body: prepared.readerSource,
        products: await catalogueNames(supabase, orgId),
        hasTables: prepared.hasTables,
      })
    : emptyOrder();
  const assessment = assessCanonicalOrder(prepared.read, { lines: order.line_items });
  const usable = assessment.canonical_order_status === 'unsafe'
    ? { ...order, line_items: [] }
    : order;
  const result: BodyOrderRead = { order: usable, assessment, prepared };

  const hasSupplementalEvidence = Boolean(
    usable.customer_name ||
    usable.purchase_order_number ||
    usable.order_date ||
    usable.requested_delivery_date ||
    usable.delivery_location ||
    usable.order_notes ||
    usable.line_items.length,
  );
  if (allowSupplemental) {
    // The reconciliation path: an attachment order already exists and IS the
    // reviewable document. A body that turned out to be a link or a shredded
    // table contributes nothing — and must not take the attachment down with it.
    if (!hasSupplementalEvidence && !assessmentAdmitsZeroLines(assessment)) {
      throw new Error('The email body was classified as an order but no reviewable order data could be extracted.');
    }
    return result;
  }
  if (!usable.customer_name && usable.line_items.length === 0) {
    const reviewable = Boolean(usable.purchase_order_number) || Boolean(prepared.read.external_source);
    if (assessmentAdmitsZeroLines(assessment) && reviewable) return result;
    throw new Error('The email body was classified as an order but no reviewable order data could be extracted.');
  }
  return result;
}

/** The shape of "there was nothing to read", without pretending a model said so. */
function emptyOrder(): OrderExtractionResult {
  return {
    customer_name: null,
    customer_confidence: 0,
    purchase_order_number: null,
    order_date: null,
    requested_delivery_date: null,
    delivery_location: null,
    order_notes: null,
    line_items: [],
    overall_confidence: null,
    model: 'vyso/no-readable-body-text',
  };
}

async function persistBodySource(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    emailIngestId: string;
    message: MicrosoftGraphMessageContent;
    prepared: PreparedBodySource;
  },
): Promise<string> {
  // The DERIVED text at the existing path, the ORIGINAL beside it. Old rows and
  // every existing reader of 'email-body' see exactly what they always did.
  if (input.prepared.contentType === 'html') {
    await persistOriginalBodyHtml(supabase, {
      orgId: input.orgId,
      emailIngestId: input.emailIngestId,
      original: input.prepared.original,
    });
  }
  const body = input.prepared.derivedText || bodyText(input.message);
  const bytes = Buffer.from(body, 'utf8');
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_EMAIL_BODY_SOURCE_BYTES) {
    throw new Error('The email body source is empty or exceeds the Vyso processing limit.');
  }
  const storagePath = emailSourceStoragePath(input.orgId, input.emailIngestId, EMAIL_BODY_SOURCE_PART_ID);
  const { error: storageError } = await supabase.storage
    .from('documents')
    .upload(storagePath, bytes, { contentType: 'text/plain; charset=utf-8', upsert: false });
  if (storageError && !isUniqueViolation(storageError)) {
    throw new Error(`Could not preserve the email body source: ${storageError.message}`);
  }
  const { error: ingestError } = await supabase
    .from('email_ingests')
    .update({
      body_source_storage_path: storagePath,
      body_source_content_type: input.message.body?.contentType ?? 'text',
    })
    .eq('id', input.emailIngestId)
    .eq('org_id', input.orgId);
  if (ingestError) throw new Error(`Could not record the email body source: ${ingestError.message}`);
  return storagePath;
}

export async function ingestMicrosoftEmailBodyOrder(
  supabase: SupabaseClient,
  input: { orgId: string; emailIngestId: string; message: MicrosoftGraphMessageContent },
): Promise<IngestDocumentResult> {
  const { order, assessment, prepared } = await readBodyOrder(supabase, input.orgId, input.message);
  // Before anything is filed: the sender's own bytes. If the read above was
  // wrong about this body, the evidence for saying so now exists.
  if (prepared.contentType === 'html') {
    await persistOriginalBodyHtml(supabase, {
      orgId: input.orgId,
      emailIngestId: input.emailIngestId,
      original: prepared.original,
    });
  }
  // THE DOCUMENT HOLDS THE DERIVED TEXT, NEVER THE MARKUP. It is served back to
  // the reviewer's browser from Storage, and raw sender HTML is not something
  // this product renders anywhere, in any frame, ever.
  const storedText = prepared.derivedText || prepared.original;
  const result = await ingestDocument({
    supabase,
    orgId: input.orgId,
    userId: null,
    base64: Buffer.from(storedText, 'utf8').toString('base64'),
    mediaType: 'text/plain; charset=utf-8',
    filename: bodyFilename(input.message.subject),
    customerEvidence: {
      senderEmail: input.message.from?.address ?? null,
      senderName: input.message.from?.name ?? null,
      subject: input.message.subject ?? null,
      messageText: storedText.slice(0, 20_000) || null,
    },
    emailIngestId: input.emailIngestId,
    sourceAttachmentId: EMAIL_BODY_SOURCE_PART_ID,
    sourceContentType: prepared.contentType,
    sourceType: 'email_body',
    preExtractedOrder: order,
    extractionMetadata: { message_order_evidence: bodyOnlyOrderEvidence(order, assessment) },
    deferCommit: true,
  });
  if (!result.ok || !result.documentId) return result;

  const { data: bodyDocument, error } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', result.documentId)
    .eq('org_id', input.orgId)
    .maybeSingle();
  if (error || !(bodyDocument as { storage_path?: string | null } | null)?.storage_path) {
    return {
      ok: false,
      status: 500,
      error: `Could not verify the preserved email body source${error ? `: ${error.message}` : '.'}`,
      documentId: result.documentId,
    };
  }
  const { error: linkError } = await supabase
    .from('email_ingests')
    .update({
      body_source_storage_path: (bodyDocument as { storage_path: string }).storage_path,
      // THE TRUTH ABOUT THE ORIGINAL, which this column could not tell before:
      // it read 'text' on every row in the database, because Vyso had asked
      // Exchange for text. It now records what the sender actually sent.
      body_source_content_type: prepared.contentType,
    })
    .eq('id', input.emailIngestId)
    .eq('org_id', input.orgId);
  if (linkError) {
    return { ok: false, status: 500, error: `Could not record the email body source: ${linkError.message}`, documentId: result.documentId };
  }
  return result;
}

/**
 * AN HTML PURCHASE ORDER ATTACHED TO AN EMAIL IS A DOCUMENT, and reading it is
 * what the Four Seasons case actually needed.
 *
 * That message's body is a portal link and nothing else — but attached to it, at
 * 26KB, was the COMPLETE purchase order: twelve tables, a proper line grid
 * (`# | Item SKU | Product Desc. | Qty | UOM | Price | Extension | Tax | Total`),
 * every figure printed. Attachment triage marked it `ignored_non_document` and
 * dropped it, and Vyso then went looking for the order in the one place it was
 * guaranteed not to be. Nothing here fetches the portal, follows a link, or
 * loads a remote asset: the file is decoded, normalised by the same module that
 * reads bodies, and its tables are handed to the same order reader.
 */
export async function ingestMicrosoftHtmlAttachmentOrder(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    emailIngestId: string;
    message: MicrosoftGraphMessageContent;
    attachment: { id: string; name: string; contentType: string; bytes: Uint8Array };
  },
): Promise<IngestDocumentResult> {
  const bytes = input.attachment.bytes;
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_EMAIL_BODY_SOURCE_BYTES) {
    return { ok: false, status: 413, error: 'The HTML attachment is empty or exceeds the Vyso processing limit.' };
  }
  // Decoded as UTF-8 without a charset negotiation: a mis-declared charset
  // yields replacement characters in a few product names, which a reviewer can
  // see and fix, whereas a decoder that throws loses the whole order.
  const html = Buffer.from(bytes).toString('utf8');
  const normalized = normalizeEmailHtml(html);
  const read = assessBodySource({ contentType: 'html', normalized, orderIntent: true });
  const readerSource = buildNormalizedReaderSource(normalized);
  if (!readerSource.trim()) {
    return { ok: false, status: 422, error: 'The HTML attachment contained no readable order text.' };
  }
  const order = await extractOrderText({
    subject: input.message.subject,
    senderName: input.message.from?.name,
    senderEmail: input.message.from?.address,
    receivedDateTime: input.message.receivedDateTime,
    body: readerSource,
    products: await catalogueNames(supabase, input.orgId),
    hasTables: normalized.tables.length > 0,
  });
  const assessment = assessCanonicalOrder(read, { lines: order.line_items });
  const usable = assessment.canonical_order_status === 'unsafe' ? { ...order, line_items: [] } : order;

  return ingestDocument({
    supabase,
    orgId: input.orgId,
    userId: null,
    // THE DERIVED TEXT IS WHAT IS FILED, not the markup. The document object is
    // served back into a reviewer's browser through a signed URL and an iframe
    // (see DocumentPreview), and sender-authored HTML is never something this
    // product puts in a frame. The original stays in the mailbox, where Graph
    // can be asked for it again.
    base64: Buffer.from(normalized.text || readerSource, 'utf8').toString('base64'),
    mediaType: 'text/plain; charset=utf-8',
    filename: input.attachment.name.slice(0, 200) || 'Attached order.html',
    note: input.message.subject?.slice(0, 500),
    customerEvidence: {
      senderEmail: input.message.from?.address ?? null,
      senderName: input.message.from?.name ?? null,
      subject: input.message.subject ?? null,
      messageText: normalized.text.slice(0, 20_000) || null,
    },
    emailIngestId: input.emailIngestId,
    // The Graph attachment id, so the existing (email_ingest_id,
    // source_attachment_id) unique index makes a retry a no-op rather than a
    // second copy of the same purchase order.
    sourceAttachmentId: input.attachment.id,
    sourceContentType: input.attachment.contentType.slice(0, 200) || 'text/html',
    sourceType: 'html',
    preExtractedOrder: usable,
    extractionMetadata: {
      message_order_evidence: attachmentOnlyOrderEvidence(usable, input.attachment.id, assessment),
    },
    deferCommit: true,
  });
}

function orderFromExtractedData(extracted: ExtractedData, documentConfidence: number | null): OrderExtractionResult {
  const snapshot = extracted.message_order_evidence?.attachment_snapshot;
  if (snapshot) {
    const raw = coerceOrderExtraction(JSON.stringify(snapshot));
    return {
      ...raw,
      model: typeof snapshot.model === 'string' ? snapshot.model : 'stored/attachment-extraction',
      warning: typeof snapshot.warning === 'string' ? snapshot.warning : null,
    };
  }
  return {
    customer_name: extracted.customer_name ?? null,
    customer_confidence: extracted.customer_confidence ?? 0,
    purchase_order_number: extracted.purchase_order_number ?? null,
    order_date: extracted.order_date ?? null,
    requested_delivery_date: extracted.requested_delivery_date ?? null,
    delivery_location: extracted.delivery_location ?? null,
    order_notes: extracted.order_notes ?? null,
    line_items: extracted.line_items ?? [],
    // NULL PASSES THROUGH. `documents.confidence` is nullable and now MEANS
    // something when it is null: the reader recorded no confidence, which is
    // not the same claim as "the reader was certain of nothing". The `?? 0`
    // that used to sit here turned the absence into the worst possible reading
    // of a document, and then that fabricated 0 became the floor of the merged
    // confidence downstream in `reconcileMessageOrder` — so one missing column
    // on the attachment silently zeroed the whole reconciled order.
    overall_confidence: documentConfidence,
    model: extracted.extraction_model ?? 'stored/attachment-extraction',
    warning: extracted.extraction_warning ?? null,
  };
}

export async function reconcileMicrosoftEmailBodyWithOrder(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    emailIngestId: string;
    documentId: string;
    attachmentSourceIds: string[];
    multipleOrderSources: boolean;
    message: MicrosoftGraphMessageContent;
  },
): Promise<IngestDocumentResult> {
  const preparedBody = prepareBodySource(input.message);
  await persistBodySource(supabase, { ...input, prepared: preparedBody });
  const { data: document, error } = await supabase
    .from('documents')
    .select('id, status, document_type, confidence, extracted_data')
    .eq('id', input.documentId)
    .eq('org_id', input.orgId)
    .eq('email_ingest_id', input.emailIngestId)
    .maybeSingle();
  if (error || !document) {
    return { ok: false, status: 404, error: `Could not find the attachment order for reconciliation${error ? `: ${error.message}` : '.'}` };
  }
  const row = document as {
    id: string;
    status: string;
    document_type: string | null;
    confidence: number | null;
    extracted_data: ExtractedData | null;
  };
  if (row.document_type !== 'order' || !row.extracted_data) {
    return { ok: false, status: 409, error: 'The selected attachment document is not an extracted order.', documentId: row.id };
  }

  const body = await readBodyOrder(supabase, input.orgId, input.message, true);
  const reconciled = reconcileMessageOrder({
    attachment: orderFromExtractedData(row.extracted_data, row.confidence),
    body: body.order,
    // The DERIVED text, so the single-line amendment check ("please make that
    // 20") reads prose rather than markup — the phrase it looks for is invisible
    // inside `<p><span>` the moment a customer's client sends HTML.
    bodyText: body.prepared.derivedText,
    attachmentSourceIds: input.attachmentSourceIds,
    multipleOrderSources: input.multipleOrderSources,
  });

  const customerConflict = reconciled.evidence.conflicts.some((entry) => entry.field === 'customer_name');
  let customerMatch = null;
  if (!customerConflict) {
    try {
      customerMatch = await resolveExistingCustomerForOrg(supabase, input.orgId, {
        senderEmail: input.message.from?.address ?? null,
        senderName: input.message.from?.name ?? null,
        subject: input.message.subject ?? null,
        messageText: body.prepared.derivedText.slice(0, 20_000) || null,
        extractedCustomerName: reconciled.order.customer_name,
        purchaseOrderNumber: reconciled.order.purchase_order_number,
        deliveryLocation: reconciled.order.delivery_location,
      });
    } catch {
      customerMatch = null;
    }
  }

  let interpretationPreview = null;
  if (customerMatch?.customerId) {
    try {
      interpretationPreview = await previewExistingCustomerInterpretation(supabase, {
        orgId: input.orgId,
        customerId: customerMatch.customerId,
        lines: reconciled.order.line_items,
      });
    } catch {
      interpretationPreview = null;
    }
  }

  // The body's OWN assessment travels with the merged evidence: the attachment
  // is canonical here, and "the body was a portal link" stays a true and useful
  // statement about this message even when nothing in the order came from it.
  // A conflict outranks it — see `assessCanonicalOrder`.
  const evidence: MessageOrderEvidence = withBodySourceAssessment(
    reconciled.evidence,
    assessCanonicalOrder(body.prepared.read, {
      lines: reconciled.order.line_items,
      conflicts: reconciled.evidence.conflicts.length,
      linesFromAttachment: true,
    }),
  );
  const extracted: ExtractedData = {
    ...row.extracted_data,
    line_items: reconciled.order.line_items,
    customer_name: reconciled.order.customer_name,
    customer_confidence: reconciled.order.customer_confidence,
    purchase_order_number: reconciled.order.purchase_order_number ?? null,
    order_date: reconciled.order.order_date ?? null,
    requested_delivery_date: reconciled.order.requested_delivery_date ?? null,
    delivery_location: reconciled.order.delivery_location ?? null,
    order_notes: reconciled.order.order_notes ?? null,
    customer_id: customerMatch?.customerId ?? null,
    customer_match_confidence: customerMatch?.confidence ?? 0,
    customer_match_method: customerConflict ? 'unresolved' : customerMatch?.method ?? 'unresolved',
    customer_match_reason: customerConflict ? 'message-source-customer-conflict' : customerMatch?.reason ?? 'customer-directory-unavailable',
    customer_match_ambiguous: customerConflict || customerMatch?.ambiguous === true,
    customer_match_candidates: customerMatch?.candidates ?? [],
    customer_match_evidence: customerMatch?.evidence ?? null,
    extraction_model: reconciled.order.model,
    extraction_warning: reconciled.order.warning ?? null,
    message_order_evidence: evidence,
    customer_interpretation_preview: interpretationPreview,
  };
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      status: 'extracted',
      confidence: reconciled.order.overall_confidence,
      extracted_data: extracted,
      customer_id: customerMatch?.customerId ?? null,
    })
    .eq('id', row.id)
    .eq('org_id', input.orgId);
  if (updateError) {
    return { ok: false, status: 500, error: `Could not store reconciled message evidence: ${updateError.message}`, documentId: row.id };
  }
  return {
    ok: true,
    documentId: row.id,
    documentType: 'order',
    customerName: reconciled.order.customer_name,
    itemCount: reconciled.order.line_items.length,
  };
}
