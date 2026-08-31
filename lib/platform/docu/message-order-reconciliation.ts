/**
 * Pure message-level reconciliation for customer orders.
 *
 * The email is the intent envelope. Body and attachment reads stay distinct
 * evidence until this module compares them; conflicts are never resolved by a
 * hidden "body wins" or "attachment wins" rule.
 */
import type { OrderExtractionResult } from '../../ai/order-prompt.ts';
import { parseLocaleNumber } from '../locale-number.ts';
import type {
  ExtractedLineItem,
  MessageOrderConflict,
  MessageOrderEvidence,
  MessageOrderFieldProvenance,
  MessageOrderLineProvenance,
} from '../types.ts';
import { normaliseUnit } from './order-line-match.ts';
import {
  assessmentRequiresReview,
  type BodySourceAssessment,
} from './body-source-assessment.ts';

export const EMAIL_BODY_SOURCE_PART_ID = 'email-body' as const;

const clean = (value: string | null | undefined): string => (value ?? '').trim();
const textKey = (value: string | null | undefined): string => clean(value)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const referenceKey = (value: string | null | undefined): string => clean(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '');

function singleLineQuantityAmendment(bodyText: string | null | undefined): string | null {
  const match = /\b(?:please\s+)?(?:make|change|update|amend)\s+(?:that|it|the\s+quantity)\s+(?:to\s+)?(\d+(?:[.,]\d+)?)\b/i
    .exec((bodyText ?? '').slice(0, 20_000));
  return match?.[1] ?? null;
}

function valuesAgree(
  field: string,
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  if (field === 'quantity') {
    const a = parseLocaleNumber(left);
    const b = parseLocaleNumber(right);
    return a !== null && b !== null && Math.abs(a - b) <= 0.000001;
  }
  if (field === 'unit') {
    const a = normaliseUnit(left);
    const b = normaliseUnit(right);
    return Boolean(a && b && a === b);
  }
  if (field === 'purchase_order_number') return referenceKey(left) === referenceKey(right);
  return textKey(left) === textKey(right);
}

function oneSource(value: string | null | undefined, source: 'attachment' | 'email_body'):
MessageOrderFieldProvenance {
  return {
    source,
    ...(source === 'attachment' ? { attachment_value: clean(value) || null } : { email_body_value: clean(value) || null }),
  };
}

function reconcileField(
  field: string,
  attachmentValue: string | null | undefined,
  bodyValue: string | null | undefined,
  conflicts: MessageOrderConflict[],
): { value: string | null; provenance: MessageOrderFieldProvenance } {
  const attachment = clean(attachmentValue);
  const body = clean(bodyValue);
  if (!attachment) return { value: body || null, provenance: oneSource(body, 'email_body') };
  if (!body) return { value: attachment, provenance: oneSource(attachment, 'attachment') };
  if (valuesAgree(field, attachment, body)) {
    return {
      value: attachment,
      provenance: {
        source: 'both',
        attachment_value: attachment,
        email_body_value: body,
      },
    };
  }
  conflicts.push({
    field,
    attachment_value: attachment,
    email_body_value: body,
  });
  return {
    value: null,
    provenance: {
      source: 'both',
      attachment_value: attachment,
      email_body_value: body,
      conflict: true,
    },
  };
}

function bodyOnlyLineProvenance(line: ExtractedLineItem, index: number): MessageOrderLineProvenance {
  return {
    line_index: index,
    source: 'email_body',
    raw_description: oneSource(line.raw_description ?? line.description, 'email_body'),
    quantity: oneSource(line.quantity, 'email_body'),
    unit: oneSource(line.unit, 'email_body'),
  };
}

/**
 * Fold a source assessment onto message evidence, additively.
 *
 * SEPARATE FROM RECONCILIATION ON PURPOSE. What the source WAS and whether body
 * and attachment AGREE are two different findings, and merging them in one
 * function is how "the body was a link" would end up looking like a conflict.
 * `requires_review` is only ever raised here, never lowered: an assessment that
 * needs a human cannot cancel a conflict that also needs one.
 */
export function withBodySourceAssessment(
  evidence: MessageOrderEvidence,
  assessment: BodySourceAssessment | null | undefined,
): MessageOrderEvidence {
  if (!assessment) return evidence;
  return {
    ...evidence,
    body_content_kind: assessment.body_content_kind,
    body_parse_status: assessment.body_parse_status,
    canonical_order_status: assessment.canonical_order_status,
    external_source: assessment.external_source ?? null,
    detected_line_signals: assessment.detected_line_signals ?? null,
    requires_review: evidence.requires_review || assessmentRequiresReview(assessment),
  };
}

/** Provenance for a body-only order; no attachment-shaped placeholder is made. */
export function bodyOnlyOrderEvidence(
  body: OrderExtractionResult,
  assessment?: BodySourceAssessment | null,
): MessageOrderEvidence {
  const fields: Record<string, MessageOrderFieldProvenance> = {};
  for (const [field, value] of Object.entries({
    customer_name: body.customer_name,
    purchase_order_number: body.purchase_order_number,
    order_date: body.order_date,
    requested_delivery_date: body.requested_delivery_date,
    delivery_location: body.delivery_location,
    order_notes: body.order_notes,
  })) {
    if (clean(value)) fields[field] = oneSource(value, 'email_body');
  }
  return withBodySourceAssessment({
    primary_source: 'email_body',
    body_source_part_id: EMAIL_BODY_SOURCE_PART_ID,
    attachment_source_ids: [],
    fields,
    lines: body.line_items.map(bodyOnlyLineProvenance),
    conflicts: [],
    requires_review: false,
    multiple_order_sources: false,
  }, assessment);
}

/**
 * Provenance for an order read out of ONE attachment, with no body reading.
 *
 * The HTML purchase-order attachment lane (the real Four Seasons order) needs
 * this: it is an attachment-primary order, and claiming `email_body` provenance
 * for it — the only body-shaped helper that existed — would put the body's name
 * on every field that actually came off the attached document.
 */
export function attachmentOnlyOrderEvidence(
  attachment: OrderExtractionResult,
  attachmentSourceId: string,
  assessment?: BodySourceAssessment | null,
): MessageOrderEvidence {
  const fields: Record<string, MessageOrderFieldProvenance> = {};
  for (const [field, value] of Object.entries({
    customer_name: attachment.customer_name,
    purchase_order_number: attachment.purchase_order_number,
    order_date: attachment.order_date,
    requested_delivery_date: attachment.requested_delivery_date,
    delivery_location: attachment.delivery_location,
    order_notes: attachment.order_notes,
  })) {
    if (clean(value)) fields[field] = oneSource(value, 'attachment');
  }
  return withBodySourceAssessment({
    primary_source: 'attachment',
    body_source_part_id: EMAIL_BODY_SOURCE_PART_ID,
    attachment_source_ids: [attachmentSourceId],
    fields,
    lines: attachment.line_items.map((line, index) => ({
      line_index: index,
      source: 'attachment' as const,
      raw_description: oneSource(line.raw_description ?? line.description, 'attachment'),
      quantity: oneSource(line.quantity, 'attachment'),
      unit: oneSource(line.unit, 'attachment'),
    })),
    conflicts: [],
    requires_review: false,
    multiple_order_sources: false,
  }, assessment);
}

function combinedLine(
  attachment: ExtractedLineItem,
  body: ExtractedLineItem,
  index: number,
  conflicts: MessageOrderConflict[],
): { line: ExtractedLineItem; provenance: MessageOrderLineProvenance } {
  const raw = reconcileField('raw_description', attachment.raw_description ?? attachment.description, body.raw_description ?? body.description, conflicts);
  const quantity = reconcileField('quantity', attachment.quantity, body.quantity, conflicts);
  const unit = reconcileField('unit', attachment.unit, body.unit, conflicts);
  return {
    line: {
      ...attachment,
      raw_description: raw.value ?? (clean(attachment.raw_description) || clean(body.raw_description)),
      description: raw.value ?? '',
      quantity: quantity.value ?? '',
      ...(quantity.provenance.conflict ? { quantity_source: 'unresolved' as const } : {}),
      unit: unit.value ?? '',
      confidence: Math.min(attachment.confidence, body.confidence),
    },
    provenance: {
      line_index: index,
      source: 'both',
      raw_description: raw.provenance,
      quantity: quantity.provenance,
      unit: unit.provenance,
    },
  };
}

/**
 * Reconcile one attachment order with the same message's body order.
 * Exact normalized descriptions are the only automatic line join. This avoids
 * silently treating two similar products as the same row.
 */
export function reconcileMessageOrder(input: {
  attachment: OrderExtractionResult;
  body: OrderExtractionResult;
  bodyText?: string | null;
  attachmentSourceIds: string[];
  multipleOrderSources?: boolean;
}): { order: OrderExtractionResult; evidence: MessageOrderEvidence } {
  const { attachment, body } = input;
  const conflicts: MessageOrderConflict[] = [];
  const fields: Record<string, MessageOrderFieldProvenance> = {};
  const customer = reconcileField('customer_name', attachment.customer_name, body.customer_name, conflicts);
  const po = reconcileField('purchase_order_number', attachment.purchase_order_number, body.purchase_order_number, conflicts);
  const orderDate = reconcileField('order_date', attachment.order_date, body.order_date, conflicts);
  const deliveryDate = reconcileField('requested_delivery_date', attachment.requested_delivery_date, body.requested_delivery_date, conflicts);
  const location = reconcileField('delivery_location', attachment.delivery_location, body.delivery_location, conflicts);

  for (const [field, resolved] of Object.entries({
    customer_name: customer,
    purchase_order_number: po,
    order_date: orderDate,
    requested_delivery_date: deliveryDate,
    delivery_location: location,
  })) {
    if (resolved.value || resolved.provenance.conflict) fields[field] = resolved.provenance;
  }

  const attachmentNotes = clean(attachment.order_notes);
  const bodyNotes = clean(body.order_notes);
  const notes = [attachmentNotes, bodyNotes]
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((other) => textKey(other) === textKey(value)) === index)
    .join('\n');
  if (attachmentNotes || bodyNotes) {
    fields.order_notes = attachmentNotes && bodyNotes
      ? { source: 'both', attachment_value: attachmentNotes, email_body_value: bodyNotes }
      : oneSource(notes, attachmentNotes ? 'attachment' : 'email_body');
  }

  const bodyByDescription = new Map<string, number[]>();
  body.line_items.forEach((line, index) => {
    const key = textKey(line.raw_description ?? line.description);
    if (!key) return;
    bodyByDescription.set(key, [...(bodyByDescription.get(key) ?? []), index]);
  });
  const usedBody = new Set<number>();
  const lines: ExtractedLineItem[] = [];
  const lineProvenance: MessageOrderLineProvenance[] = [];

  for (const attachmentLine of attachment.line_items) {
    const key = textKey(attachmentLine.raw_description ?? attachmentLine.description);
    const bodyIndex = (bodyByDescription.get(key) ?? []).find((index) => !usedBody.has(index));
    if (bodyIndex === undefined) {
      const index = lines.length;
      lines.push({ ...attachmentLine });
      lineProvenance.push({
        line_index: index,
        source: 'attachment',
        raw_description: oneSource(attachmentLine.raw_description ?? attachmentLine.description, 'attachment'),
        quantity: oneSource(attachmentLine.quantity, 'attachment'),
        unit: oneSource(attachmentLine.unit, 'attachment'),
      });
      continue;
    }
    usedBody.add(bodyIndex);
    const index = lines.length;
    const before = conflicts.length;
    const resolved = combinedLine(attachmentLine, body.line_items[bodyIndex], index, conflicts);
    // Only conflicts added by this row receive this row's index.
    for (let i = before; i < conflicts.length; i += 1) conflicts[i].line_index = index;
    lines.push(resolved.line);
    lineProvenance.push(resolved.provenance);
  }

  body.line_items.forEach((line, bodyIndex) => {
    if (usedBody.has(bodyIndex)) return;
    const index = lines.length;
    lines.push({ ...line });
    lineProvenance.push(bodyOnlyLineProvenance(line, index));
  });

  // An explicit pronoun amendment ("please make that 20") has no product name
  // to join. It is safe to attach only when the source order has exactly one
  // line and the body reader found no named lines. Even then, never apply it:
  // preserve both quantities and clear the canonical value for human review.
  if (attachment.line_items.length === 1 && body.line_items.length === 0 && lines.length === 1) {
    const amendedQuantity = singleLineQuantityAmendment(input.bodyText);
    if (amendedQuantity) {
      const attachmentQuantity = clean(attachment.line_items[0].quantity);
      const agrees = valuesAgree('quantity', attachmentQuantity, amendedQuantity);
      lineProvenance[0] = {
        ...lineProvenance[0],
        source: 'both',
        quantity: {
          source: 'both',
          attachment_value: attachmentQuantity || null,
          email_body_value: amendedQuantity,
          ...(!agrees ? { conflict: true } : {}),
        },
      };
      if (!agrees) {
        lines[0] = { ...lines[0], quantity: '', quantity_source: 'unresolved' };
        conflicts.push({
          field: 'quantity',
          line_index: 0,
          attachment_value: attachmentQuantity || null,
          email_body_value: amendedQuantity,
        });
      }
    }
  }

  const multipleOrderSources = input.multipleOrderSources === true;
  if (multipleOrderSources) {
    conflicts.push({
      field: 'multiple_order_sources',
      attachment_value: String(input.attachmentSourceIds.length),
      email_body_value: body.line_items.length ? 'present' : null,
    });
  }

  // THE MERGED READING, OVER THE READINGS THAT EXIST.
  //
  // `overall_confidence` is `number | null`, and null means "no reading was
  // recorded" — not "a reading of zero". `Math.min` disagrees: it coerces null
  // to 0, so the old `Math.min(attachment.overall_confidence, body.overall_
  // confidence, 60)` answered 0% for a perfectly-read attachment the moment the
  // body lane happened to record nothing, and 0% is the one number a reviewer
  // reads as "the machine understood none of this". Taking the minimum of the
  // REAL numbers keeps the honest behaviour — the merged document is only as
  // trustworthy as its least trustworthy half — while a half that made no claim
  // abstains instead of voting zero. Both halves silent leaves the merged
  // reading null, which is the truth about it.
  const readings = [attachment.overall_confidence, body.overall_confidence].filter(
    (value): value is number => typeof value === 'number',
  );
  const mergedConfidence = readings.length ? Math.min(...readings) : null;
  // The conflict cap is a CEILING ON A READING, never a reading of its own: a
  // document with visible conflicts cannot claim more than 60, but if nothing
  // read it we still have no number to cap, and inventing 60 there would make
  // an unread document look better than a read one.
  const overallConfidence = conflicts.length
    ? mergedConfidence === null
      ? null
      : Math.min(mergedConfidence, 60)
    : mergedConfidence;

  return {
    order: {
      ...attachment,
      customer_name: customer.value,
      customer_confidence: customer.provenance.conflict
        ? 0
        : Math.min(attachment.customer_confidence, body.customer_confidence || attachment.customer_confidence),
      purchase_order_number: po.value,
      order_date: orderDate.value,
      requested_delivery_date: deliveryDate.value,
      delivery_location: location.value,
      order_notes: notes || null,
      line_items: lines,
      overall_confidence: overallConfidence,
      model: `${attachment.model}+${body.model}`,
      warning: [attachment.warning, body.warning].filter(Boolean).join(' ') || null,
    },
    evidence: {
      primary_source: 'combined',
      body_source_part_id: EMAIL_BODY_SOURCE_PART_ID,
      attachment_source_ids: [...new Set(input.attachmentSourceIds)],
      fields,
      lines: lineProvenance,
      conflicts,
      requires_review: conflicts.length > 0,
      multiple_order_sources: multipleOrderSources,
      attachment_snapshot: attachment as unknown as Record<string, unknown>,
    },
  };
}
