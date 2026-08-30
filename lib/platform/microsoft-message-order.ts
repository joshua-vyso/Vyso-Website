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
  bodyOnlyOrderEvidence,
  EMAIL_BODY_SOURCE_PART_ID,
  reconcileMessageOrder,
} from '@/lib/platform/docu/message-order-reconciliation';
import type { ExtractedData, MessageOrderEvidence } from '@/lib/platform/types';
import type { MicrosoftGraphMessageContent } from '@/lib/platform/microsoft-graph-core';

const MAX_EMAIL_BODY_SOURCE_BYTES = 1_000_000;

function bodyText(message: MicrosoftGraphMessageContent): string {
  // Preserve the exact text representation Graph returned. Trimming is valid
  // for emptiness checks, but not for the private source-of-truth copy.
  return message.body?.content ?? '';
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

async function readBodyOrder(
  supabase: SupabaseClient,
  orgId: string,
  message: MicrosoftGraphMessageContent,
  allowSupplemental = false,
): Promise<OrderExtractionResult> {
  const body = bodyText(message);
  if (!body.trim()) throw new Error('The Microsoft message body is empty.');
  const order = await extractOrderText({
    subject: message.subject,
    senderName: message.from?.name,
    senderEmail: message.from?.address,
    receivedDateTime: message.receivedDateTime,
    body,
    products: await catalogueNames(supabase, orgId),
  });
  const hasSupplementalEvidence = Boolean(
    order.customer_name ||
    order.purchase_order_number ||
    order.order_date ||
    order.requested_delivery_date ||
    order.delivery_location ||
    order.order_notes ||
    order.line_items.length,
  );
  if ((!allowSupplemental && !order.customer_name && order.line_items.length === 0) ||
      (allowSupplemental && !hasSupplementalEvidence)) {
    throw new Error('The email body was classified as an order but no reviewable order data could be extracted.');
  }
  return order;
}

async function persistBodySource(
  supabase: SupabaseClient,
  input: { orgId: string; emailIngestId: string; message: MicrosoftGraphMessageContent },
): Promise<string> {
  const body = bodyText(input.message);
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
  const order = await readBodyOrder(supabase, input.orgId, input.message);
  const result = await ingestDocument({
    supabase,
    orgId: input.orgId,
    userId: null,
    base64: Buffer.from(bodyText(input.message), 'utf8').toString('base64'),
    mediaType: 'text/plain; charset=utf-8',
    filename: bodyFilename(input.message.subject),
    customerEvidence: {
      senderEmail: input.message.from?.address ?? null,
      senderName: input.message.from?.name ?? null,
      subject: input.message.subject ?? null,
      messageText: bodyText(input.message).slice(0, 20_000) || null,
    },
    emailIngestId: input.emailIngestId,
    sourceAttachmentId: EMAIL_BODY_SOURCE_PART_ID,
    sourceContentType: input.message.body?.contentType ?? 'text',
    sourceType: 'email_body',
    preExtractedOrder: order,
    extractionMetadata: { message_order_evidence: bodyOnlyOrderEvidence(order) },
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
      body_source_content_type: input.message.body?.contentType ?? 'text',
    })
    .eq('id', input.emailIngestId)
    .eq('org_id', input.orgId);
  if (linkError) {
    return { ok: false, status: 500, error: `Could not record the email body source: ${linkError.message}`, documentId: result.documentId };
  }
  return result;
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
  await persistBodySource(supabase, input);
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

  const bodyOrder = await readBodyOrder(supabase, input.orgId, input.message, true);
  const reconciled = reconcileMessageOrder({
    attachment: orderFromExtractedData(row.extracted_data, row.confidence),
    body: bodyOrder,
    bodyText: bodyText(input.message),
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
        messageText: bodyText(input.message).slice(0, 20_000) || null,
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

  const evidence: MessageOrderEvidence = reconciled.evidence;
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
