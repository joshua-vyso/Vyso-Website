/**
 * WHAT THE MESSAGE ACTUALLY GAVE US, said out loud on the document.
 *
 * This used to draw provenance and conflicts only, and stayed silent about the
 * two cases that most needed a sentence: an order whose details live in the
 * customer's own procurement portal (the email carries the PO number and a link,
 * and no goods at all), and a source whose row structure did not survive the
 * trip. Both used to reach the reviewer as an order with zero lines under the
 * words "No items read — add what the customer ordered", which reads as "Vyso
 * failed" for the first and as "there was nothing here" for the second. Neither
 * is true, and both are answerable questions once they are asked properly.
 *
 * NOTHING HERE RENDERS EMAIL HTML. Every value below is text React escapes; the
 * one anchor is an http/https href the normalizer already filtered, opened in a
 * new tab with `rel="noopener noreferrer"`, and its LABEL is the sender's own
 * displayed URL rather than the tracking wrapper the href usually is.
 */
import type {
  CanonicalOrderStatus,
  DocumentSourceType,
  ExternalOrderSource,
  MessageOrderEvidence,
} from '@/lib/platform/types';

function sourceLabel(sourceType: DocumentSourceType | null | undefined, evidence: MessageOrderEvidence | null | undefined): string | null {
  if (evidence?.primary_source === 'combined') return 'Email + attachment';
  if (evidence?.primary_source === 'email_body' || sourceType === 'email_body') return 'Email body';
  if (sourceType === 'html') return 'HTML attachment';
  if (evidence?.primary_source === 'attachment') return 'Attachment';
  return null;
}

/** A portal's name as a person writes it; the bare host when we cannot name it. */
function providerLabel(external: ExternalOrderSource | null | undefined): string | null {
  if (!external) return null;
  if (external.provider === 'birchstreet') return 'BirchStreet';
  if (external.provider === 'coupa') return 'Coupa';
  if (external.provider === 'sap_ariba') return 'SAP Ariba';
  return external.host || null;
}

/** http/https only — the same rule the normalizer applied, asserted again here. */
function safeHref(href: string | null | undefined): string | null {
  const value = (href ?? '').trim();
  return /^https?:\/\//i.test(value) ? value : null;
}

function externalSentence(
  external: ExternalOrderSource,
  customerName: string | null | undefined,
  purchaseOrderNumber: string | null | undefined,
): string {
  const who = (customerName ?? '').trim();
  const po = (purchaseOrderNumber ?? '').trim();
  const provider = providerLabel(external);
  const opening = ['Customer order detected', [who, po ? `PO ${po}` : ''].filter(Boolean).join(', ')]
    .filter(Boolean)
    .join(' — ');
  return `${opening}. Order details are hosted externally${provider ? ` (${provider})` : ''}. No line items were included in this email.`;
}

function unsafeSentence(productLikeCount: number | null | undefined): string {
  const count = typeof productLikeCount === 'number' && productLikeCount > 0 ? productLikeCount : null;
  return `The email appears to contain a structured order, but its row layout could not be reconstructed reliably. ${
    count ? `${count} product-like values were detected, but quantities` : 'Quantities'
  } and row relationships are ambiguous. No order lines were created.`;
}

/** The one-word verdict for the compact queue row. */
function compactVerdict(status: CanonicalOrderStatus | null | undefined): string | null {
  if (status === 'unavailable') return 'order hosted externally';
  if (status === 'unsafe') return 'row layout unreadable';
  if (status === 'partial') return 'some quantities unread';
  return null;
}

export function MessageOrderEvidenceNotice({
  sourceType,
  evidence,
  customerName,
  purchaseOrderNumber,
  compact = false,
}: {
  sourceType?: DocumentSourceType | null;
  evidence?: MessageOrderEvidence | null;
  /** Header values read off the same document, used only to word the sentence. */
  customerName?: string | null;
  purchaseOrderNumber?: string | null;
  compact?: boolean;
}) {
  const label = sourceLabel(sourceType, evidence);
  const conflicts = evidence?.conflicts ?? [];
  const status = evidence?.canonical_order_status ?? null;
  const external = evidence?.external_source ?? null;
  const verdict = compactVerdict(status);
  const explains = status === 'unavailable' || status === 'unsafe';
  if (!label && conflicts.length === 0 && !verdict) return null;

  if (compact) {
    return (
      <span className={conflicts.length || explains ? 'text-[#854F0B]' : 'text-[#6B6F68]'}>
        {label ?? 'Message evidence'}
        {conflicts.length ? ` · ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}` : ''}
        {verdict ? ` · ${verdict}` : ''}
      </span>
    );
  }

  const attention = conflicts.length > 0 || explains;
  const href = external ? safeHref(external.href) : null;
  return (
    <div className={`rounded-xl border px-4 py-3 ${attention ? 'border-[#F3E2C4] bg-[#FFF9EF]' : 'border-[#CFE0F3] bg-[#F5F9FE]'}`}>
      <p className={`text-[13px] font-semibold ${attention ? 'text-[#854F0B]' : 'text-[#174C87]'}`}>
        Source · {label ?? 'Message evidence'}
      </p>

      {status === 'unavailable' && external ? (
        <div className="mt-2 space-y-2 text-[12px] text-[#6B4B20]">
          <p>{externalSentence(external, customerName, purchaseOrderNumber)}</p>
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-[10px] border border-[#E2D3B4] bg-white px-3 text-[12px] font-medium text-[#854F0B] transition-colors hover:bg-[#FFF4E2]"
            >
              Open order link
              {external.link_text ? <span className="ml-1.5 font-normal text-[#8A6A38]">{external.link_text}</span> : null}
            </a>
          ) : null}
        </div>
      ) : null}

      {status === 'unavailable' && !external ? (
        <p className="mt-2 text-[12px] text-[#6B4B20]">
          This message was read as an order, but it carried no line items — add what the customer ordered, or open
          the original source below.
        </p>
      ) : null}

      {status === 'unsafe' ? (
        <p className="mt-2 text-[12px] text-[#6B4B20]">
          {unsafeSentence(evidence?.detected_line_signals?.product_like_count)}
        </p>
      ) : null}

      {conflicts.length ? (
        <div className="mt-2 space-y-1.5 text-[12px] text-[#6B4B20]">
          <p>Body and attachment disagree. Confirm these values before saving:</p>
          {conflicts.slice(0, 20).map((conflict, index) => (
            <p key={`${conflict.field}-${conflict.line_index ?? 'field'}-${index}`}>
              <span className="font-medium">{conflict.field.replaceAll('_', ' ')}</span>
              {conflict.line_index != null ? ` · line ${conflict.line_index + 1}` : ''}
              {' — attachment: '}
              <span className="font-medium">{conflict.attachment_value || 'blank'}</span>
              {' · email: '}
              <span className="font-medium">{conflict.email_body_value || 'blank'}</span>
            </p>
          ))}
        </div>
      ) : null}

      {!conflicts.length && !explains ? (
        <p className="mt-1 text-[12px] text-[#4C6682]">Source values were preserved with field-level provenance.</p>
      ) : null}
    </div>
  );
}
