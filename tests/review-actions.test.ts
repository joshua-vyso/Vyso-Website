import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEW_APPROVE_CAP,
  approveAllLabel,
  approveConfirmMessage,
  customerFromQuoteRequest,
  findExistingCustomer,
  mergeApprovalResults,
  normaliseCustomerName,
  parseReviewItemKey,
  reviewItemKey,
  selectApprovable,
  type ReviewApprovalResult,
} from '../lib/platform/review-actions-shared.ts';
import {
  groupReviewQueue,
  reviewItemForDocument,
  reviewItemForQuoteRequest,
  type ReviewDocumentRow,
  type ReviewItem,
  type ReviewQuoteRequestRow,
} from '../lib/platform/review-queue-shared.ts';

/**
 * Review v2's arithmetic (.ai/plan_review_v2.md).
 *
 * WHY THIS IS WORTH A TEST FILE. Nothing here writes to a database, and that is
 * exactly the point: the writes belong to Doc-U and OrderFlow and are guarded
 * where they live. What this wave ADDED is the reasoning ABOUT those writes —
 * which rows a single click sends, what the click is allowed to claim it will
 * do, and how a partial answer folds back into the list. Three failure modes
 * matter and none of them shows up in a screenshot:
 *
 *   1. A batch that sweeps in a row no module can approve — most seriously, a
 *      website enquiry, where the nearest write is "dismiss" and a batched one
 *      would bin real leads.
 *   2. A button that promises fourteen and sends ten.
 *   3. A merge that drops a row whose approval FAILED, so the error is never
 *      seen and the refresh puts the row back as if by magic.
 *
 * Relative, `.ts`-suffixed imports: `node --test` cannot resolve the `@/` alias.
 */

function doc(over: Partial<ReviewDocumentRow> = {}): ReviewDocumentRow {
  return {
    id: 'doc-1',
    filename: 'scan-0042.pdf',
    document_type: 'invoice',
    extracted_data: null,
    status: 'extracted',
    confidence: 96,
    approved_at: null,
    created_at: '2026-08-19T08:00:00Z',
    supplier: { name: 'Umgeni Oils' },
    ...over,
  };
}

function request(over: Partial<ReviewQuoteRequestRow> = {}): ReviewQuoteRequestRow {
  return {
    id: 'req-1',
    contact_name: 'Thandi Mbeki',
    business_name: 'Bakers Delight',
    contact_email: 'thandi@example.co.za',
    from_email: 'forms@example.com',
    message: null,
    requested_items: [],
    received_at: '2026-08-19T10:00:00Z',
    ...over,
  };
}

/** The mixed queue every selection test below runs against: two approvable
 *  invoices, a statement, a flagged document and an enquiry. */
function mixedItems(): ReviewItem[] {
  return [
    reviewItemForDocument(doc({ id: 'inv-1' })),
    reviewItemForDocument(doc({ id: 'inv-2' })),
    reviewItemForDocument(doc({ id: 'stmt-1', document_type: 'statement' })),
    reviewItemForDocument(doc({ id: 'flag-1', status: 'error' })),
    reviewItemForQuoteRequest(request()),
  ];
}

// ---------------------------------------------------------------------------
// Item keys — one string that three surfaces have to agree on
// ---------------------------------------------------------------------------

test('an item key round-trips, and a uuid survives it intact', () => {
  const ref = { kind: 'document' as const, id: '9f0c1a2b-3d4e-5f60-8a9b-0c1d2e3f4a5b' };
  assert.equal(reviewItemKey(ref), `document:${ref.id}`);
  assert.deepEqual(parseReviewItemKey(reviewItemKey(ref)), ref);
});

test('a key from a kind this build does not know parses to null', () => {
  // A deep link from a future version must land on the centred chain, not on a
  // pane fetching a kind nothing here can render.
  assert.equal(parseReviewItemKey('purchase_order:abc'), null);
  assert.equal(parseReviewItemKey('document:'), null);
  assert.equal(parseReviewItemKey('document'), null);
  assert.equal(parseReviewItemKey(':abc'), null);
  assert.equal(parseReviewItemKey(null), null);
  assert.equal(parseReviewItemKey(undefined), null);
});

test('only the FIRST colon separates, so nothing in an id can break the split', () => {
  assert.deepEqual(parseReviewItemKey('quote_request:a:b:c'), { kind: 'quote_request', id: 'a:b:c' });
});

// ---------------------------------------------------------------------------
// Selection — what a batch button actually sends
// ---------------------------------------------------------------------------

test('"Approve all" sends the approvable documents and NOTHING else', () => {
  const picked = selectApprovable(groupReviewQueue(mixedItems()), { scope: 'all' });
  assert.deepEqual(
    picked.map((p) => p.id),
    ['inv-1', 'inv-2', 'stmt-1'],
  );
});

test('a website enquiry is never in a batch, at any scope', () => {
  // The accident this function exists to prevent: OrderFlow's nearest write on a
  // lead is Dismiss, and a task header that batched it would bin real enquiries.
  const groups = groupReviewQueue(mixedItems());
  for (const scope of [
    { scope: 'all' } as const,
    { scope: 'module', module: 'orderflow' } as const,
    { scope: 'task', task: 'orderflow:quotes' } as const,
  ]) {
    const picked = selectApprovable(groups, scope);
    assert.ok(
      picked.every((p) => p.kind !== 'quote_request'),
      `${JSON.stringify(scope)} swept in an enquiry`,
    );
  }
});

test('a flagged document is never in a batch either — Doc-U cannot commit it', () => {
  const groups = groupReviewQueue(mixedItems());
  const picked = selectApprovable(groups, { scope: 'module', module: 'docu' });
  assert.deepEqual(
    picked.map((p) => p.id),
    ['inv-1', 'inv-2', 'stmt-1'],
  );
  assert.deepEqual(selectApprovable(groups, { scope: 'task', task: 'docu:flagged' }), []);
});

test('a task scope sends only that task', () => {
  const groups = groupReviewQueue(mixedItems());
  assert.deepEqual(
    selectApprovable(groups, { scope: 'task', task: 'docu:invoices' }).map((p) => p.id),
    ['inv-1', 'inv-2'],
  );
  assert.deepEqual(
    selectApprovable(groups, { scope: 'task', task: 'docu:statements' }).map((p) => p.id),
    ['stmt-1'],
  );
});

test('a module scope sends every approvable task under it, in the chain’s order', () => {
  const groups = groupReviewQueue(mixedItems());
  assert.deepEqual(
    selectApprovable(groups, { scope: 'module', module: 'docu' }).map((p) => p.id),
    ['inv-1', 'inv-2', 'stmt-1'],
    'invoices before statements — the order drawn is the order sent',
  );
  assert.deepEqual(selectApprovable(groups, { scope: 'module', module: 'orderflow' }), []);
});

test('a batch is capped from the FRONT, so the oldest row is never the silent casualty', () => {
  const many = Array.from({ length: REVIEW_APPROVE_CAP + 10 }, (_, n) =>
    reviewItemForDocument(doc({ id: `d${n}` })),
  );
  const picked = selectApprovable(groupReviewQueue(many), { scope: 'all' });
  assert.equal(picked.length, REVIEW_APPROVE_CAP);
  assert.equal(picked[0].id, 'd0');
});

test('an empty queue selects nothing rather than throwing', () => {
  assert.deepEqual(selectApprovable(groupReviewQueue([]), { scope: 'all' }), []);
});

// ---------------------------------------------------------------------------
// The master button's label — it may not promise more than it will send
// ---------------------------------------------------------------------------

test('the label counts what will be SENT, and says so when that is short of the queue', () => {
  assert.equal(approveAllLabel(14, 14), 'Approve all (14)');
  assert.equal(approveAllLabel(10, 14), 'Approve all you can (10)');
  assert.equal(approveAllLabel(1, 1), 'Approve all (1)');
});

test('nothing approvable gets an honest sentence, not a disabled "Approve all (0)"', () => {
  assert.equal(approveAllLabel(0, 4), 'Nothing here can be approved in bulk');
  assert.equal(approveAllLabel(-1, 4), 'Nothing here can be approved in bulk');
});

test('the label agrees with the selection on the mixed queue', () => {
  // The two numbers in the plan's own example sentence, derived rather than
  // typed: 5 rows on screen, 3 of them batchable.
  const items = mixedItems();
  const approvable = selectApprovable(groupReviewQueue(items), { scope: 'all' }).length;
  assert.equal(approveAllLabel(approvable, items.length), 'Approve all you can (3)');
});

test('the confirm step says the number and that the modules still own the items', () => {
  assert.match(approveConfirmMessage(14), /Approve 14 items/);
  assert.match(approveConfirmMessage(1), /Approve 1 item —/);
  assert.match(approveConfirmMessage(14), /you can still edit them in their modules/);
});

// ---------------------------------------------------------------------------
// Merging results — the succeeded go, the failed stay and say why
// ---------------------------------------------------------------------------

function result(over: Partial<ReviewApprovalResult> = {}): ReviewApprovalResult {
  return { kind: 'document', id: 'inv-1', ok: true, ...over };
}

test('approved rows leave the list; failed rows stay with their own message', () => {
  const items = mixedItems();
  const merged = mergeApprovalResults(items, [
    result({ id: 'inv-1' }),
    result({ id: 'inv-2', ok: false, error: 'That document is already being saved.' }),
    result({ id: 'stmt-1' }),
  ]);

  assert.deepEqual(
    merged.items.map((i) => i.id),
    ['inv-2', 'flag-1', 'req-1'],
  );
  assert.deepEqual(merged.errors, {
    'document:inv-2': 'That document is already being saved.',
  });
});

test('a failure with no message still gets one — a bare red row explains nothing', () => {
  const merged = mergeApprovalResults(mixedItems(), [
    result({ id: 'inv-1', ok: false }),
    result({ id: 'inv-2', ok: false, error: '   ' }),
  ]);
  assert.equal(merged.errors['document:inv-1'], 'Could not approve this one.');
  assert.equal(merged.errors['document:inv-2'], 'Could not approve this one.');
});

test('a result about an item that is not on the list changes nothing', () => {
  const items = mixedItems();
  const merged = mergeApprovalResults(items, [result({ id: 'not-here' })]);
  assert.equal(merged.items.length, items.length);
});

test('the merge does not mutate what it was given', () => {
  const items = mixedItems();
  const before = items.map((i) => i.id);
  mergeApprovalResults(items, [result({ id: 'inv-1' })]);
  assert.deepEqual(
    items.map((i) => i.id),
    before,
  );
});

test('an empty result set is a no-op, not an emptied list', () => {
  const items = mixedItems();
  const merged = mergeApprovalResults(items, []);
  assert.equal(merged.items.length, items.length);
  assert.deepEqual(merged.errors, {});
});

// ---------------------------------------------------------------------------
// "Add as new customer" — a row built from a stranger's contact form
// ---------------------------------------------------------------------------

test('the BUSINESS is the customer, not the person who filled the form in', () => {
  // `of_customers.name` is the legal name on the invoice; a row named after the
  // buyer's receptionist has to be renamed before it can be billed.
  const payload = customerFromQuoteRequest({
    business_name: 'Bakers Delight',
    contact_name: 'Thandi Mbeki',
    contact_email: 'thandi@example.co.za',
    contact_phone: '0821234567',
  });
  assert.deepEqual(payload, {
    name: 'Bakers Delight',
    email: 'thandi@example.co.za',
    phone: '0821234567',
  });
});

test('with no business it falls back to the person, then to the email', () => {
  assert.equal(
    customerFromQuoteRequest({
      business_name: null,
      contact_name: 'Thandi Mbeki',
      contact_email: 'thandi@example.co.za',
      contact_phone: null,
    })?.name,
    'Thandi Mbeki',
  );
  assert.equal(
    customerFromQuoteRequest({
      business_name: '  ',
      contact_name: null,
      contact_email: 'thandi@example.co.za',
      contact_phone: null,
    })?.name,
    'thandi@example.co.za',
  );
});

test('NO EMAIL IS NOT A BLOCKER — of_customers requires only a name', () => {
  // The plan's edge case, answered by the schema: `email` and `phone` are
  // nullable, so an enquiry with a phone number and nothing else still files.
  assert.deepEqual(
    customerFromQuoteRequest({
      business_name: 'Bakers Delight',
      contact_name: null,
      contact_email: null,
      contact_phone: '0821234567',
    }),
    { name: 'Bakers Delight', email: null, phone: '0821234567' },
  );
  assert.deepEqual(
    customerFromQuoteRequest({
      business_name: 'Bakers Delight',
      contact_name: null,
      contact_email: null,
      contact_phone: null,
    }),
    { name: 'Bakers Delight', email: null, phone: null },
  );
});

test('the website’s mailer is NEVER used as the name or the email', () => {
  // `from_email` is the form vendor's robot, not the enquirer — a customer named
  // `forms@` is a customer nobody can contact. It is not even in the input type.
  const payload = customerFromQuoteRequest({
    business_name: null,
    contact_name: null,
    contact_email: null,
    contact_phone: '0821234567',
  });
  assert.equal(payload, null, 'with nothing but a phone number there is no name to file under');
});

test('punctuation-only junk cannot create a customer', () => {
  for (const name of ['()', '--', '. .', ' ', 'x']) {
    assert.equal(
      customerFromQuoteRequest({
        business_name: name,
        contact_name: null,
        contact_email: null,
        contact_phone: null,
      }),
      null,
      `"${name}" should not be filed`,
    );
  }
});

test('the normalisation is the upload path’s, so both agree who is a duplicate', () => {
  assert.equal(normaliseCustomerName('Bakers  Delight (Pty) Ltd'), 'bakers delight pty ltd');
  assert.equal(normaliseCustomerName('BAKERS-DELIGHT'), 'bakers delight');
  assert.equal(normaliseCustomerName('  '), '');
});

test('an existing customer is found by email first, then by normalised name', () => {
  const customers = [
    { id: 'c1', name: 'Someone Else', email: 'thandi@example.co.za' },
    { id: 'c2', name: 'Bakers Delight (Pty) Ltd', email: null },
  ];

  assert.deepEqual(
    findExistingCustomer({ name: 'Bakers Delight', email: 'thandi@example.co.za', phone: null }, customers),
    { id: 'c1', name: 'Someone Else' },
    'email is the stronger identifier and wins',
  );
  assert.deepEqual(
    findExistingCustomer({ name: 'bakers   delight PTY ltd', email: null, phone: null }, customers),
    { id: 'c2', name: 'Bakers Delight (Pty) Ltd' },
  );
  assert.equal(
    findExistingCustomer({ name: 'Nobody Yet', email: 'new@example.com', phone: null }, customers),
    null,
  );
});

test('email matching ignores case and surrounding space', () => {
  const customers = [{ id: 'c1', name: 'Bakers', email: '  Thandi@Example.co.za ' }];
  assert.deepEqual(
    findExistingCustomer({ name: 'Anything', email: 'thandi@example.co.za', phone: null }, customers),
    { id: 'c1', name: 'Bakers' },
  );
});

test('a customer list with no emails at all does not match everything with none', () => {
  // The trap: `undefined === undefined`. A payload with no email must fall
  // through to the name check rather than match the first email-less row.
  const customers = [{ id: 'c1', name: 'Someone Else', email: null }];
  assert.equal(
    findExistingCustomer({ name: 'Bakers Delight', email: null, phone: null }, customers),
    null,
  );
});
