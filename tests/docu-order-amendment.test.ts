import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  decideAmendmentLink,
  detectOrderAmendment,
  isAmendmentEvent,
  isOrderAmendmentDocument,
  referencedPurchaseOrder,
  resolveAmendmentLink,
} from '../lib/platform/docu/order-amendment.ts';
import { reviewDocumentTask } from '../lib/platform/review-queue-shared.ts';
import type { OrderAmendment } from '../lib/platform/types.ts';

// ---------------------------------------------------------------------------
// "please deliver Wednesday, not today" is not an order.
//
// PO 144583. A one-line email from a buyer at a Tsogo Sun property, asking to
// move a delivery. Every signal the pipeline reads said 'order': the subject
// carried the PO number, the classifier scored customer_order, the order lane
// read it. It became a NEW zero-line order document with a PERSON as the
// customer, unlinked to the real PO document sitting in the same org with the
// same purchase_order_number on it.
//
// EVERY FIXTURE BELOW IS SYNTHETIC. The names, addresses and reference numbers
// are invented; the SHAPES are the ones that failed.
// ---------------------------------------------------------------------------

const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** The source with its comments removed. These files explain themselves at
 *  length and NAME the things they refuse to do — "no + Add item", "customer_po
 *  at creation only" — so a plain substring search over the whole file finds
 *  the prose that promises the property and calls it the property itself. */
const code = (path: string) =>
  src(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');

/** The linkage read, as a promise-shaped query builder — `resolveAmendmentLink`
 *  chains .from().select().eq().eq().eq().is() and awaits the result. */
function fakeSupabase(rows: Array<{ id: string; org_id: string }>, error: { message: string } | null = null) {
  const builder = {
    calls: [] as Array<[string, unknown]>,
    from(table: string) {
      builder.calls.push(['from', table]);
      return builder;
    },
    select(cols: string) {
      builder.calls.push(['select', cols]);
      return builder;
    },
    eq(col: string, value: unknown) {
      builder.calls.push(['eq', `${col}=${String(value)}`]);
      return builder;
    },
    is(col: string, value: unknown) {
      builder.calls.push(['is', `${col}=${String(value)}`]);
      return builder;
    },
    then(resolve: (r: { data: unknown; error: unknown }) => unknown) {
      return Promise.resolve(resolve({ data: error ? null : rows, error }));
    },
  };
  return builder as unknown as SupabaseClient & { calls: Array<[string, unknown]> };
}

// ---------------------------------------------------------------------------
// 5. The PO 144583 shape itself.
// ---------------------------------------------------------------------------

test('5. a delivery-date-change email about an existing PO is an amendment, not a new order', () => {
  const detection = detectOrderAmendment({
    subject: 'PO 144583 - delivery',
    text: 'Good morning, please can you deliver this order on Wednesday and not today. Thank you.',
    orderNotes: 'Deliver Wednesday, not today.',
    extractedPurchaseOrderNumber: '144583',
    lineCount: 0,
  });
  assert.equal(detection.event, 'order_amendment');
  assert.equal(detection.amendment?.amendment_type, 'delivery_date_change');
  assert.equal(detection.amendment?.referenced_po, '144583');
  // The sender's own sentence, quoted — never a paraphrase of it.
  assert.match(detection.amendment?.note ?? '', /Wednesday/);
  // Detection is pure and has no database, so it must not claim a link.
  assert.equal(detection.amendment?.link_status, 'unresolved');
});

test('5b. the amendment family means "run no order side effects", and a legacy order is not in it', () => {
  assert.equal(isAmendmentEvent('order_amendment'), true);
  assert.equal(isAmendmentEvent('order_cancellation'), true);
  assert.equal(isAmendmentEvent('order_hold'), true);
  assert.equal(isAmendmentEvent('order_instruction_update'), true);
  assert.equal(isAmendmentEvent('new_order'), false);
  // THE LEGACY ROW. Every order filed before `business_event` existed has no
  // such key, and a gate that asked `!== 'new_order'` would have called all of
  // them amendments on the day this shipped.
  assert.equal(isAmendmentEvent(null), false);
  assert.equal(isAmendmentEvent(undefined), false);
  assert.equal(isOrderAmendmentDocument({ document_type: 'order', extracted_data: { fields: [] } }), false);
  assert.equal(isOrderAmendmentDocument({ document_type: 'order', extracted_data: null }), false);
});

// ---------------------------------------------------------------------------
// 6–9. The rest of the family, and the gate that keeps ordinary orders out.
// ---------------------------------------------------------------------------

test('6. a cancellation naming a PO is its own event', () => {
  const detection = detectOrderAmendment({
    subject: 'Cancel PO 144583',
    text: 'Please cancel this PO, we have sourced it elsewhere.',
    lineCount: 0,
  });
  assert.equal(detection.event, 'order_cancellation');
  assert.equal(detection.amendment?.amendment_type, 'cancellation');
  assert.equal(detection.amendment?.referenced_po, '144583');
});

test('7. a hold and an address change are amendments with their own kinds', () => {
  const hold = detectOrderAmendment({
    subject: 'PO 144583',
    text: 'Please hold the order until we confirm the function numbers.',
    lineCount: 0,
  });
  assert.equal(hold.event, 'order_hold');
  assert.equal(hold.amendment?.amendment_type, 'hold');

  const address = detectOrderAmendment({
    subject: 'Purchase order 144583 delivery',
    text: 'Please change the delivery address — we have moved to the new stores entrance.',
    lineCount: 0,
  });
  assert.equal(address.event, 'order_amendment');
  assert.equal(address.amendment?.amendment_type, 'address_change');
});

test('8. an additive quantity change is an amendment EVEN THOUGH it carries a line', () => {
  // The disjunct that matters: "zero lines OR explicit change language". A
  // message that says "add 4 boxes to PO 144583" has a line in it and is
  // emphatically not a new order.
  const detection = detectOrderAmendment({
    subject: 'PO 144583',
    text: 'Please add 4 boxes of tomatoes to PO 144583.',
    lineCount: 1,
  });
  assert.equal(detection.event, 'order_amendment');
  assert.equal(detection.amendment?.amendment_type, 'quantity_change');
});

test('9. THE GATE. All three conditions, or it stays an ordinary new order', () => {
  // (a) A cue with no PO reference. Nothing to amend and nothing to link to.
  assert.equal(
    detectOrderAmendment({ text: 'Please cancel the order.', lineCount: 0 }).event,
    'new_order',
  );
  // (b) A PO with no cue — i.e. every printed purchase order ever.
  assert.equal(
    detectOrderAmendment({
      subject: 'Purchase Order 144583',
      text: '10 boxes tomatoes\n4 crates avocado\nDeliver Wednesday 3 September',
      extractedPurchaseOrderNumber: '144583',
      lineCount: 2,
    }).event,
    'new_order',
  );
  // (c) The catch-all instruction cue on a message that DID produce lines. The
  //     weakest cue must not reclassify an ordinary order whose notes say
  //     "please note delivery before 10am".
  assert.equal(
    detectOrderAmendment({
      subject: 'Order — PO 144583',
      orderNotes: 'Please note delivery before 10am.',
      extractedPurchaseOrderNumber: '144583',
      lineCount: 6,
    }).event,
    'new_order',
  );
  // (d) Nothing at all.
  assert.equal(detectOrderAmendment({ lineCount: 0 }).event, 'new_order');
});

test('9b. the PO reference is read from labelled and bare forms, and refuses two digits', () => {
  assert.equal(referencedPurchaseOrder('Re: PO 144583 delivery'), '144583');
  assert.equal(referencedPurchaseOrder('purchase order no: 144583'), '144583');
  assert.equal(referencedPurchaseOrder('P.O. #144583, please amend'), '144583');
  assert.equal(referencedPurchaseOrder('order 144583.'), '144583');
  // A two-digit "PO 12" is far likelier to be a line reference than a purchase
  // order, and a wrong link is worse than no link.
  assert.equal(referencedPurchaseOrder('see PO 12'), null);
  assert.equal(referencedPurchaseOrder('no reference here'), null);
});

// ---------------------------------------------------------------------------
// Linkage — read-only, one/none/many.
// ---------------------------------------------------------------------------

const amendment: OrderAmendment = {
  amendment_type: 'delivery_date_change',
  referenced_po: '144583',
  link_status: 'unresolved',
};

test('linkage links on exactly one match, and never picks between two', () => {
  assert.deepEqual(
    decideAmendmentLink(amendment, [{ documentId: 'doc-real-po', purchaseOrderNumber: '144583' }]),
    { ...amendment, link_status: 'linked', linked_order_document_id: 'doc-real-po' },
  );
  assert.equal(decideAmendmentLink(amendment, []).link_status, 'unresolved');
  // Two live documents carrying one PO is a data question. Picking the newest
  // would produce a link indistinguishable from one we actually found.
  const many = decideAmendmentLink(amendment, [
    { documentId: 'doc-a', purchaseOrderNumber: '144583' },
    { documentId: 'doc-b', purchaseOrderNumber: '144583' },
  ]);
  assert.equal(many.link_status, 'ambiguous');
  assert.equal(many.linked_order_document_id, undefined);
});

test('the linkage query is READ-ONLY, org-scoped, order-typed and excludes superseded rows', async () => {
  const supabase = fakeSupabase([{ id: 'doc-real-po', org_id: 'org-1' }]);
  const linked = await resolveAmendmentLink(supabase, {
    orgId: 'org-1',
    amendment,
    excludeDocumentId: 'doc-the-amendment',
  });
  assert.equal(linked.link_status, 'linked');
  assert.equal(linked.linked_order_document_id, 'doc-real-po');

  const calls = (supabase as unknown as { calls: Array<[string, unknown]> }).calls;
  const verbs = calls.map(([verb]) => verb);
  // Not merely "no writes happened" — no write VERB is even reachable from this
  // builder's call log. The order this names has been reviewed; the amendment
  // asking to change it has been reviewed by nobody.
  for (const forbidden of ['insert', 'update', 'upsert', 'delete', 'rpc']) {
    assert.equal(verbs.includes(forbidden), false, `${forbidden} must never be called`);
  }
  const predicates = calls.filter(([v]) => v === 'eq' || v === 'is').map(([, p]) => p);
  assert.deepEqual(predicates, [
    'org_id=org-1',
    'document_type=order',
    'extracted_data->>purchase_order_number=144583',
    'superseded_at=null',
  ]);
});

test('the amendment cannot link to itself, and a failed read degrades to unresolved', async () => {
  const selfOnly = await resolveAmendmentLink(fakeSupabase([{ id: 'doc-me', org_id: 'org-1' }]), {
    orgId: 'org-1',
    amendment,
    excludeDocumentId: 'doc-me',
  });
  assert.equal(selfOnly.link_status, 'unresolved');

  const failed = await resolveAmendmentLink(fakeSupabase([], { message: 'connection reset' }), {
    orgId: 'org-1',
    amendment,
  });
  assert.equal(failed.link_status, 'unresolved');
  assert.equal(failed.linked_order_document_id, undefined);

  // A row from another org cannot be linked even if the query returned it.
  const crossOrg = await resolveAmendmentLink(fakeSupabase([{ id: 'doc-x', org_id: 'org-2' }]), {
    orgId: 'org-1',
    amendment,
  });
  assert.equal(crossOrg.link_status, 'unresolved');
});

// ---------------------------------------------------------------------------
// The routing guards — the whole point of the detection.
// ---------------------------------------------------------------------------

test('runDocumentSideEffects returns BEFORE syncOrderFromDocument for an amendment', () => {
  const ingest = src('lib/platform/document-ingest.ts');
  const guard = ingest.indexOf("if (isOrderAmendmentDocument(doc)) return { skipped: 'order_amendment' };");
  const sync = ingest.indexOf('const orderSync = await syncOrderFromDocument(');
  assert.ok(guard > 0, 'the amendment guard exists');
  assert.ok(sync > 0, 'the order sync call exists');
  assert.ok(guard < sync, 'the guard must precede the order sync, not follow it');
});

test('syncOrderFromDocument refuses an amendment on its own, beside its type guard', () => {
  const orderflow = src('lib/platform/orderflow-from-doc.ts');
  assert.match(
    orderflow,
    /if \(isOrderAmendmentDocument\(sourceDoc\)\) return \{ ok: false, reason: 'order-amendment-not-a-new-order' \};/,
  );
  // Defence in depth beside the existing type check, not instead of it: an
  // amendment IS document_type 'order', so the type check waves it through.
  assert.ok(
    orderflow.indexOf("sourceDoc.document_type !== 'order'") <
      orderflow.indexOf('isOrderAmendmentDocument(sourceDoc)'),
  );
});

test('an amendment gets its own review pile, and never "Invoices to approve"', () => {
  assert.equal(
    reviewDocumentTask({
      status: 'extracted',
      document_type: 'order',
      extracted_data: { fields: [], business_event: 'order_amendment' },
    }),
    'docu:order_changes',
  );
  assert.equal(
    reviewDocumentTask({
      status: 'extracted',
      document_type: 'order',
      extracted_data: { fields: [], business_event: 'order_cancellation' },
    }),
    'docu:order_changes',
  );
  // An ordinary order — and a legacy one with no business_event at all — stays
  // exactly where it has always been.
  assert.equal(
    reviewDocumentTask({
      status: 'extracted',
      document_type: 'order',
      extracted_data: { fields: [], business_event: 'new_order' },
    }),
    'docu:invoices',
  );
  assert.equal(reviewDocumentTask({ status: 'extracted', document_type: 'order' }), 'docu:invoices');
  // A flagged document is still flagged first, whatever it turned out to be.
  assert.equal(
    reviewDocumentTask({
      status: 'error',
      document_type: 'order',
      extracted_data: { fields: [], business_event: 'order_amendment' },
    }),
    'docu:flagged',
  );
});

test('the amendment card draws no Items panel and no "+ Add item"', () => {
  const card = code('components/platform/docu/AmendmentReviewCard.tsx');
  // Not disabled — ABSENT. A control that refuses is an invitation to wonder why.
  assert.equal(card.includes('Add item'), false);
  assert.equal(card.includes('OrderReviewEditor'), false);
  assert.equal(card.includes('line_items'), false);
  // And it says out loud that nothing was done to the order.
  assert.match(card, /Operational impact: None/);
  assert.match(card, /has not been changed|has not been cancelled/);
});

// ---------------------------------------------------------------------------
// Analytics protection (Part I): the amendment creates no order.
// ---------------------------------------------------------------------------

test('ANALYTICS: an amendment reaches neither of_orders, the invoice counter, nor PlanWise demand', () => {
  const orderflow = src('lib/platform/orderflow-from-doc.ts');
  const refusal = orderflow.indexOf("reason: 'order-amendment-not-a-new-order'");
  // Everything that writes or allocates sits AFTER the refusal, so an amendment
  // can reach none of it: no of_orders insert, no of_order_items, and no draw
  // on the shared of_next_number invoice counter (which drifted by one for
  // every duplicate order the PO 144583 email produced).
  for (const write of [
    "from('of_orders')\n      .insert(",
    "from('of_order_items').insert(",
    "rpc('of_next_number'",
  ]) {
    const at = orderflow.indexOf(write);
    assert.ok(at > 0, `${write} exists`);
    assert.ok(refusal < at, `${write} must sit after the amendment refusal`);
  }
});

test('ANALYTICS: customer_po is written at CREATION only, never on a re-sync', () => {
  const orderflow = code('lib/platform/orderflow-from-doc.ts');
  assert.match(orderflow, /customer_po: ed\.purchase_order_number \?\? null,/);
  // The update branch above the insert must not touch it: an order somebody has
  // already reviewed may carry a PO a human typed or corrected, and a re-sync
  // must not overwrite that with whatever the extractor read this time.
  const updateBranch = orderflow.slice(
    orderflow.indexOf("await db.from('of_orders').update("),
    orderflow.indexOf("from('of_orders')\n      .insert("),
  );
  assert.equal(updateBranch.includes('customer_po'), false);
  // Exactly ONE write site in the whole file.
  assert.equal((orderflow.match(/customer_po/g) ?? []).length, 1);
});
