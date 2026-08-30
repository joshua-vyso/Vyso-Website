import test from 'node:test';
import assert from 'node:assert/strict';
import type { OrderExtractionResult } from '../lib/ai/order-prompt.ts';
import {
  bodyOnlyOrderEvidence,
  EMAIL_BODY_SOURCE_PART_ID,
  reconcileMessageOrder,
} from '../lib/platform/docu/message-order-reconciliation.ts';

function order(overrides: Partial<OrderExtractionResult> = {}): OrderExtractionResult {
  return {
    customer_name: 'The Capital',
    customer_confidence: 96,
    purchase_order_number: 'PO-123',
    order_date: '2026-08-30',
    requested_delivery_date: '2026-08-31',
    delivery_location: 'Loading bay',
    order_notes: null,
    line_items: [{
      raw_description: 'Potatoes',
      description: 'Potatoes',
      quantity: '10',
      unit: 'kg',
      confidence: 95,
    }],
    overall_confidence: 94,
    model: 'test/model',
    ...overrides,
  };
}

test('body-only evidence is first-class and uses the deterministic source part', () => {
  const evidence = bodyOnlyOrderEvidence(order());
  assert.equal(evidence.primary_source, 'email_body');
  assert.equal(evidence.body_source_part_id, EMAIL_BODY_SOURCE_PART_ID);
  assert.equal(evidence.lines.length, 1);
  assert.equal(evidence.lines[0].source, 'email_body');
  assert.deepEqual(evidence.conflicts, []);
});

test('agreeing body and attachment become one canonical order with both provenance', () => {
  const result = reconcileMessageOrder({
    attachment: order(),
    body: order({
      line_items: [{ raw_description: 'potatoes', description: 'Potatoes', quantity: '10,0', unit: 'KG', confidence: 92 }],
      model: 'test/body',
    }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(result.order.line_items.length, 1);
  assert.equal(result.order.line_items[0].quantity, '10');
  assert.equal(result.evidence.lines[0].source, 'both');
  assert.equal(result.evidence.lines[0].quantity.source, 'both');
  assert.equal(result.evidence.requires_review, false);
  assert.deepEqual(result.evidence.conflicts, []);
});

test('body delivery instructions supplement an attachment without creating another order', () => {
  const result = reconcileMessageOrder({
    attachment: order({ order_notes: null }),
    body: order({ order_notes: 'Please use the rear loading bay.' }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(result.order.order_notes, 'Please use the rear loading bay.');
  assert.equal(result.evidence.fields.order_notes.source, 'email_body');
  assert.equal(result.order.line_items.length, 1);
});

test('quantity conflict clears the canonical quantity and preserves both source values', () => {
  const result = reconcileMessageOrder({
    attachment: order(),
    body: order({
      line_items: [{ raw_description: 'Potatoes', description: 'Potatoes', quantity: '20', unit: 'kg', confidence: 95 }],
    }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(result.order.line_items[0].quantity, '');
  assert.equal(result.order.line_items[0].quantity_source, 'unresolved');
  assert.equal(result.evidence.requires_review, true);
  assert.deepEqual(result.evidence.conflicts.find((entry) => entry.field === 'quantity'), {
    field: 'quantity',
    line_index: 0,
    attachment_value: '10',
    email_body_value: '20',
  });
});

test('a one-line explicit "make that" amendment is a visible conflict, never a silent overwrite', () => {
  const result = reconcileMessageOrder({
    attachment: order(),
    body: order({ line_items: [], order_notes: 'Please make that 20.' }),
    bodyText: 'Please make that 20.',
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(result.order.line_items.length, 1);
  assert.equal(result.order.line_items[0].quantity, '');
  assert.equal(result.order.line_items[0].quantity_source, 'unresolved');
  assert.deepEqual(result.evidence.conflicts.find((entry) => entry.field === 'quantity'), {
    field: 'quantity',
    line_index: 0,
    attachment_value: '10',
    email_body_value: '20',
  });
});

test('a pronoun quantity amendment is never guessed across multiple attachment lines', () => {
  const result = reconcileMessageOrder({
    attachment: order({
      line_items: [
        ...order().line_items,
        { raw_description: 'Carrots', description: 'Carrots', quantity: '5', unit: 'kg', confidence: 95 },
      ],
    }),
    body: order({ line_items: [], order_notes: 'Please make that 20.' }),
    bodyText: 'Please make that 20.',
    attachmentSourceIds: ['attachment-1'],
  });
  assert.deepEqual(result.order.line_items.map((line) => line.quantity), ['10', '5']);
  assert.equal(result.evidence.conflicts.some((entry) => entry.field === 'quantity'), false);
});

test('delivery-date and customer conflicts stay unresolved for human review', () => {
  const result = reconcileMessageOrder({
    attachment: order(),
    body: order({ customer_name: 'Different Customer', requested_delivery_date: '2026-09-01' }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(result.order.customer_name, null);
  assert.equal(result.order.customer_confidence, 0);
  assert.equal(result.order.requested_delivery_date, null);
  assert.ok(result.evidence.conflicts.some((entry) => entry.field === 'customer_name'));
  assert.ok(result.evidence.conflicts.some((entry) => entry.field === 'requested_delivery_date'));
});

test('similar but non-identical products are never fuzzy-merged', () => {
  const result = reconcileMessageOrder({
    attachment: order({
      line_items: [{ raw_description: 'Grapes Black', description: 'Grapes Black', quantity: '2', unit: 'kg', confidence: 90 }],
    }),
    body: order({
      line_items: [{ raw_description: 'Grapes White', description: 'Grapes White', quantity: '2', unit: 'kg', confidence: 90 }],
    }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(result.order.line_items.length, 2);
  assert.deepEqual(result.evidence.lines.map((line) => line.source), ['attachment', 'email_body']);
});

test('multiple attachment order sources are explicit review evidence', () => {
  const result = reconcileMessageOrder({
    attachment: order(),
    body: order(),
    attachmentSourceIds: ['attachment-1', 'attachment-2'],
    multipleOrderSources: true,
  });
  assert.equal(result.evidence.multiple_order_sources, true);
  assert.equal(result.evidence.requires_review, true);
  assert.ok(result.evidence.conflicts.some((entry) => entry.field === 'multiple_order_sources'));
});

test('a reconciled line keeps the row VAT evidence the attachment printed', () => {
  // The merge overrides description, quantity and unit and nothing else — the
  // row's money columns ride through on the spread. Asserted rather than
  // assumed because losing them here is SILENT: `grossMismatch` would fall back
  // to comparing qty × price against a net it can no longer tell apart from an
  // inclusive total, and a correctly-read VAT row would go red in review with
  // nothing on screen to explain why.
  const result = reconcileMessageOrder({
    attachment: order({
      line_items: [{
        raw_description: 'Potatoes',
        description: 'Potatoes',
        quantity: '10',
        unit: 'kg',
        unit_price: '33.80',
        raw_amount: '338.00',
        raw_tax_amount: '50.70',
        tax_rate: '15%',
        tax_code: 'A',
        raw_total_amount: '388.70',
        confidence: 95,
      }],
    }),
    body: order({
      line_items: [{ raw_description: 'potatoes', description: 'Potatoes', quantity: '10', unit: 'KG', confidence: 92 }],
      model: 'test/body',
    }),
    attachmentSourceIds: ['attachment-1'],
  });
  const [line] = result.order.line_items;
  assert.equal(line.raw_amount, '338.00');
  assert.equal(line.raw_tax_amount, '50.70');
  assert.equal(line.tax_rate, '15%');
  assert.equal(line.tax_code, 'A');
  assert.equal(line.raw_total_amount, '388.70');
  // And an attachment-only line, which takes the other spread path.
  const attachmentOnly = reconcileMessageOrder({
    attachment: order({
      line_items: [{
        raw_description: 'Onions',
        description: 'Onions',
        quantity: '5',
        unit: 'kg',
        raw_amount: '125.00',
        raw_tax_amount: '18.75',
        tax_rate: '15%',
        raw_total_amount: '143.75',
        confidence: 90,
      }],
    }),
    body: order({ line_items: [] }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(attachmentOnly.order.line_items[0].raw_tax_amount, '18.75');
  assert.equal(attachmentOnly.order.line_items[0].raw_total_amount, '143.75');
});

test('a half that recorded no confidence abstains instead of voting zero', () => {
  // `overall_confidence` is nullable, and null means "no reading was recorded".
  // Math.min coerces null to 0, so the old merge answered 0% — the one number a
  // reviewer reads as "the machine understood none of this" — for a document
  // one of whose halves simply made no claim.
  const bodySilent = reconcileMessageOrder({
    attachment: order({ overall_confidence: 94 }),
    body: order({ overall_confidence: null, model: 'test/body' }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(bodySilent.order.overall_confidence, 94);

  // Both silent: nothing to report, and nothing invented to fill it.
  const bothSilent = reconcileMessageOrder({
    attachment: order({ overall_confidence: null }),
    body: order({ overall_confidence: null, model: 'test/body' }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(bothSilent.order.overall_confidence, null);

  // A genuine 0 is a reading and still counts — it is null that abstains.
  const explicitZero = reconcileMessageOrder({
    attachment: order({ overall_confidence: 94 }),
    body: order({ overall_confidence: 0, model: 'test/body' }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.equal(explicitZero.order.overall_confidence, 0);
});

test('the conflict cap is a ceiling on a reading, never a reading of its own', () => {
  const capped = reconcileMessageOrder({
    attachment: order({ overall_confidence: 94 }),
    body: order({ overall_confidence: 90, order_date: '2026-09-02', model: 'test/body' }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.ok(capped.evidence.conflicts.length > 0);
  assert.equal(capped.order.overall_confidence, 60);

  // Same conflict, no readings at all: 60 would make an unread document look
  // better than a read one, so there is still nothing to say.
  const uncapped = reconcileMessageOrder({
    attachment: order({ overall_confidence: null }),
    body: order({ overall_confidence: null, order_date: '2026-09-02', model: 'test/body' }),
    attachmentSourceIds: ['attachment-1'],
  });
  assert.ok(uncapped.evidence.conflicts.length > 0);
  assert.equal(uncapped.order.overall_confidence, null);
});
