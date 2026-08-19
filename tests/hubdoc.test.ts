import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHubdocEmail,
  hubdocAttachmentFilename,
  hubdocBody,
  hubdocEligibility,
  hubdocForwardLabel,
  hubdocSubject,
  hubdocTooLargeReason,
  validateHubdocIntakeEmail,
  hubdocEligibleIds,
  hubdocPrepareDocuments,
  hubdocSentMessage,
  maskHubdocIntakeEmail,
  HUBDOC_ALREADY_SENT_REASON,
  HUBDOC_CHAT_REFUSALS,
  HUBDOC_FROM,
  HUBDOC_INTAKE_DOMAIN,
  HUBDOC_MAX_ATTACHMENT_BYTES,
} from '../lib/platform/hubdoc-shared.ts';

/**
 * The Hubdoc cross-upload's pure half (plan `.ai/plan_plugins_xero.md`, X2).
 *
 * NO EMAIL WAS SENT BY ANY OF THIS, by instruction and by construction. Nothing
 * in this file imports `resend`, `hubdoc.ts` or a Supabase client — the send is
 * behind `sendThroughResend`, which is only reachable from
 * `forwardDocumentToHubdoc`, which is only reachable from a route. What IS
 * pinned here is the payload that function would hand Resend, built by
 * `buildHubdocEmail`, which is the part worth testing anyway: the attachment
 * shape, the single recipient, and the absence of everything else.
 *
 * WHY THESE FUNCTIONS AND NOT OTHERS. Every send is irreversible and lands in
 * somebody's bookkeeping. The two decisions that make it wrong are "should this
 * document have gone at all" (`hubdocEligibility`) and "where did it go"
 * (`validateHubdocIntakeEmail`), so those get the most cases. The subject line is
 * third because it is the only handle a person has on the document once it is in
 * Hubdoc.
 *
 * Relative, `.ts`-suffixed import: `node --test` cannot resolve the `@/` alias.
 */

// ---------------------------------------------------------------------------
// The intake address
// ---------------------------------------------------------------------------

test('a Hubdoc upload address is accepted with no warning', () => {
  const result = validateHubdocIntakeEmail(`turnandslice@${HUBDOC_INTAKE_DOMAIN}`);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.email, `turnandslice@${HUBDOC_INTAKE_DOMAIN}`);
  assert.equal(result.warning, null);
});

test('the address is trimmed and lower-cased, so one inbox is one row', () => {
  const result = validateHubdocIntakeEmail(`  TurnAndSlice@${HUBDOC_INTAKE_DOMAIN.toUpperCase()}  `);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.email, `turnandslice@${HUBDOC_INTAKE_DOMAIN}`);
});

test('a non-Hubdoc address is ACCEPTED with a warning, not refused', () => {
  // Some businesses point this at their own bookkeeper's mailbox, and Hubdoc's
  // intake domain is Hubdoc's to change. Refusing would strand both.
  const result = validateHubdocIntakeEmail('books@example.co.za');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.email, 'books@example.co.za');
  assert.match(result.warning ?? '', /not a upload\.hubdoc\.com address/i);
});

test('an empty or malformed address is refused with a sentence', () => {
  for (const bad of [null, undefined, '', '   ', 'not-an-email', 'still@wrong', '@nolocal.com']) {
    const result = validateHubdocIntakeEmail(bad);
    assert.equal(result.ok, false, `${JSON.stringify(bad)} must not be accepted`);
    if (result.ok) return;
    assert.ok(result.error.length > 10, 'the error must be a sentence an owner can act on');
  }
});

test('an absurdly long address is refused before the regex sees it', () => {
  const result = validateHubdocIntakeEmail(`${'a'.repeat(250)}@${HUBDOC_INTAKE_DOMAIN}`);
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// What may be sent — the gate that stops the wrong email
// ---------------------------------------------------------------------------

const ELIGIBLE = {
  documentType: 'invoice',
  status: 'extracted',
  supplierId: '00000000-0000-4000-8000-000000000009',
  storagePath: 'org/doc.pdf',
};

test('a read supplier invoice with a file and a supplier may be sent', () => {
  assert.deepEqual(hubdocEligibility(ELIGIBLE), { ok: true });
});

test('a supplier statement may be sent too — Hubdoc codes those as well', () => {
  assert.deepEqual(hubdocEligibility({ ...ELIGIBLE, documentType: 'statement' }), { ok: true });
});

test('a CUSTOMER order is never sent — it is the business’s own revenue', () => {
  const result = hubdocEligibility({ ...ELIGIBLE, documentType: 'order' });
  assert.equal(result.ok, false);
});

test('delivery notes and price lists are not bookkeeping paper', () => {
  for (const type of ['delivery_note', 'price_list', null]) {
    const result = hubdocEligibility({ ...ELIGIBLE, documentType: type });
    assert.equal(result.ok, false, `${type} must not be sendable`);
  }
});

test('a document with no stored file is refused — an empty email reads as a filing', () => {
  const result = hubdocEligibility({ ...ELIGIBLE, storagePath: null });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.reason, /no file/i);
});

test('a document with no supplier is refused: that is how "not customer-side" is known', () => {
  const result = hubdocEligibility({ ...ELIGIBLE, supplierId: null });
  assert.equal(result.ok, false);
});

test('a document Vyso has not read yet is refused, and every decided status too', () => {
  for (const status of ['pending', 'error', 'rejected', 'archived', null]) {
    const result = hubdocEligibility({ ...ELIGIBLE, status });
    assert.equal(result.ok, false, `status ${status} must not be sendable`);
  }
});

test('reviewed and approved documents may be sent', () => {
  for (const status of ['reviewed', 'approved']) {
    assert.deepEqual(hubdocEligibility({ ...ELIGIBLE, status }), { ok: true });
  }
});

test('every refusal is a sentence, never a code', () => {
  const refusals = [
    hubdocEligibility({ ...ELIGIBLE, storagePath: null }),
    hubdocEligibility({ ...ELIGIBLE, documentType: 'order' }),
    hubdocEligibility({ ...ELIGIBLE, supplierId: null }),
    hubdocEligibility({ ...ELIGIBLE, status: 'pending' }),
  ];
  for (const refusal of refusals) {
    assert.equal(refusal.ok, false);
    if (refusal.ok) continue;
    assert.ok(refusal.reason.endsWith('.'), 'shown to an owner, so it ends like a sentence');
    assert.ok(refusal.reason.length > 25);
  }
});

test('the size ceiling names both figures, because "too large" is not actionable', () => {
  const message = hubdocTooLargeReason(22 * 1024 * 1024);
  assert.match(message, /22\.0 MB/);
  assert.match(message, /15\.0 MB/);
  assert.equal(HUBDOC_MAX_ATTACHMENT_BYTES, 15 * 1024 * 1024);
});

// ---------------------------------------------------------------------------
// The subject — the only handle on the document once it is in Hubdoc
// ---------------------------------------------------------------------------

test('supplier first, then the number: the order a bookkeeper searches in', () => {
  assert.equal(
    hubdocSubject({
      supplierName: 'Winelands Protein Co.',
      invoiceNumber: 'INV-9268',
      documentType: 'invoice',
    }),
    'Winelands Protein Co. — invoice INV-9268',
  );
});

test('a statement says statement', () => {
  assert.equal(
    hubdocSubject({ supplierName: 'Cape Fresh', invoiceNumber: 'ST-4', documentType: 'statement' }),
    'Cape Fresh — statement ST-4',
  );
});

test('a missing clause is DROPPED, never printed empty', () => {
  assert.equal(hubdocSubject({ supplierName: 'Cape Fresh', documentType: 'invoice' }), 'Cape Fresh — invoice');
  assert.equal(hubdocSubject({ invoiceNumber: 'INV-9268', documentType: 'invoice' }), 'Invoice INV-9268');
  assert.equal(
    hubdocSubject({ filename: 'scan-002.pdf', documentType: 'invoice' }),
    'Invoice — scan-002.pdf',
  );
  assert.equal(hubdocSubject({ documentType: 'invoice' }), 'Invoice');
});

test('whitespace-only fields count as missing', () => {
  assert.equal(hubdocSubject({ supplierName: '  ', invoiceNumber: '  ', filename: '  ' }), 'Invoice');
});

test('the body says what it is, who sent it and for whom — and nothing else', () => {
  const body = hubdocBody({
    supplierName: 'Winelands Protein Co.',
    invoiceNumber: 'INV-9268',
    documentType: 'invoice',
    orgName: 'Turn ’n Slice',
  });
  assert.equal(body.split('\n').length, 3);
  assert.match(body, /Winelands Protein Co\. — invoice INV-9268\./);
  assert.match(body, /on behalf of Turn ’n Slice/);
  assert.match(body, /attached/);
  assert.doesNotMatch(body, /<[a-z]/i, 'plain text only — a filing inbox is not a marketing list');
});

// ---------------------------------------------------------------------------
// The attachment filename — a MIME header, and then a file on somebody's disk
// ---------------------------------------------------------------------------

test('an ordinary filename survives intact, extension and all', () => {
  assert.equal(hubdocAttachmentFilename('INV-9268 Winelands.pdf'), 'INV-9268 Winelands.pdf');
});

test('a path is reduced to its last segment — no traversal reaches the header', () => {
  assert.equal(hubdocAttachmentFilename('../../etc/passwd'), 'passwd');
  assert.equal(hubdocAttachmentFilename('C:\\Users\\me\\invoice.pdf'), 'invoice.pdf');
});

test('quotes, semicolons and control characters are stripped', () => {
  // A CR/LF in a filename is the header-injection vector; the quote and the
  // semicolon end a quoted MIME parameter early.
  assert.equal(hubdocAttachmentFilename('inv"oice;1\r\n.pdf'), 'invoice1.pdf');
});

test('an unusable filename falls back rather than producing an empty header', () => {
  for (const bad of [null, undefined, '', '   ', '"";']) {
    assert.equal(hubdocAttachmentFilename(bad), 'document.pdf');
  }
});

test('a very long filename is truncated', () => {
  assert.equal(hubdocAttachmentFilename(`${'a'.repeat(300)}.pdf`).length, 120);
});

// ---------------------------------------------------------------------------
// The payload Resend is handed
// ---------------------------------------------------------------------------

test('the attachment is { filename, content } with content as a BASE64 STRING', () => {
  const base64 = Buffer.from('%PDF-1.7 pretend').toString('base64');
  const email = buildHubdocEmail({
    intakeEmail: `turnandslice@${HUBDOC_INTAKE_DOMAIN}`,
    supplierName: 'Winelands Protein Co.',
    invoiceNumber: 'INV-9268',
    filename: 'INV-9268.pdf',
    documentType: 'invoice',
    orgName: 'Turn ’n Slice',
    contentBase64: base64,
  });

  assert.equal(email.attachments.length, 1);
  assert.deepEqual(Object.keys(email.attachments[0]).sort(), ['content', 'filename']);
  assert.equal(email.attachments[0].filename, 'INV-9268.pdf');
  assert.equal(email.attachments[0].content, base64);
  assert.equal(typeof email.attachments[0].content, 'string');
  // Round-trips: what Hubdoc receives is the file, not a description of it.
  assert.equal(Buffer.from(email.attachments[0].content, 'base64').toString(), '%PDF-1.7 pretend');
});

test('exactly one recipient, the platform sender, and no other headers', () => {
  const email = buildHubdocEmail({
    intakeEmail: `turnandslice@${HUBDOC_INTAKE_DOMAIN}`,
    supplierName: 'Cape Fresh',
    filename: 'statement.pdf',
    documentType: 'statement',
    contentBase64: '',
  });
  assert.deepEqual(email.to, [`turnandslice@${HUBDOC_INTAKE_DOMAIN}`]);
  assert.equal(email.from, HUBDOC_FROM);
  // The plan says "reply-to none". This is that, enforced by the shape.
  assert.deepEqual(Object.keys(email).sort(), ['attachments', 'from', 'subject', 'text', 'to']);
});

test('the built subject is the subject builder’s, not a second opinion', () => {
  const input = {
    supplierName: 'Winelands Protein Co.',
    invoiceNumber: 'INV-9268',
    documentType: 'invoice',
  };
  const email = buildHubdocEmail({ ...input, intakeEmail: 'x@y.co', contentBase64: '' });
  assert.equal(email.subject, hubdocSubject(input));
  assert.equal(email.text, hubdocBody({ ...input, orgName: undefined }));
});

// ---------------------------------------------------------------------------
// The log
// ---------------------------------------------------------------------------

test('the log says WHO sent it, because that is the question the log answers', () => {
  assert.equal(hubdocForwardLabel({ status: 'sent', triggeredBy: 'user', resend: false }), 'Sent');
  assert.equal(
    hubdocForwardLabel({ status: 'sent', triggeredBy: 'auto', resend: false }),
    'Sent automatically',
  );
  assert.equal(hubdocForwardLabel({ status: 'sent', triggeredBy: 'user', resend: true }), 'Sent again');
});

test('a failure reads as a failure whatever triggered it', () => {
  assert.equal(hubdocForwardLabel({ status: 'failed', triggeredBy: 'auto', resend: false }), 'Failed');
  assert.equal(hubdocForwardLabel({ status: 'failed', triggeredBy: 'user', resend: true }), 'Failed');
});

// ---------------------------------------------------------------------------
// The chat hand-off (Plugins X2 — chat hand-off)
// ---------------------------------------------------------------------------

/**
 * STILL NO EMAIL. `hubdoc_prepare_send` returns a list and a masked address; the
 * send is the card's button posting to the route that already existed. What is
 * pinned below is the only thing the chat path adds to the decision: WHICH
 * documents get a tick, and what the refusals say — the two things a model must
 * not be able to talk its way past.
 */

/** A document that would pass every gate, so each case below can spoil exactly
 *  one thing and prove which sentence that produces. */
function sendable(overrides: Partial<Parameters<typeof hubdocPrepareDocuments>[0][number]> = {}) {
  return {
    id: 'doc-1',
    filename: 'umgeni-oct.pdf',
    supplier: 'Umgeni Oils',
    number: 'INV-9268',
    facts: {
      documentType: 'invoice',
      status: 'extracted',
      supplierId: 'sup-1',
      storagePath: 'org/doc-1.pdf',
    },
    alreadySent: false,
    ...overrides,
  };
}

test('the intake address is shown recognisably and never in full', () => {
  const masked = maskHubdocIntakeEmail(`turnandslice@${HUBDOC_INTAKE_DOMAIN}`);
  // Enough to recognise: the first two characters and the whole domain. The
  // local part is effectively a bearer secret — anyone holding it can file
  // paperwork into this organisation's books.
  assert.equal(masked, `tu•••@${HUBDOC_INTAKE_DOMAIN}`);
  assert.equal(masked.includes('turnandslice'), false);
});

test('a short or malformed address still masks rather than leaking', () => {
  assert.equal(maskHubdocIntakeEmail('a@x.co'), 'a•••@x.co');
  assert.equal(maskHubdocIntakeEmail('not-an-address'), '•••');
  assert.equal(maskHubdocIntakeEmail(null), '');
});

test('an eligible document is ticked, with nothing to explain', () => {
  const [row] = hubdocPrepareDocuments([sendable()]);
  assert.equal(row.eligible, true);
  assert.equal(row.reason, undefined);
  assert.equal(row.filename, 'umgeni-oct.pdf');
  assert.equal(row.supplier, 'Umgeni Oils');
  assert.equal(row.number, 'INV-9268');
});

test('an ineligible document is KEPT on the card, with the eligibility sentence', () => {
  // Dropping it would be quietly disagreeing with the person who named it.
  const [row] = hubdocPrepareDocuments([
    sendable({ filename: 'delivery-note.pdf', facts: { ...sendable().facts, documentType: 'delivery_note' } }),
  ]);
  assert.equal(row.eligible, false);
  assert.equal(row.reason, 'Hubdoc takes supplier invoices and statements. This document is neither.');
});

test('the reasons come from hubdocEligibility, one per way of being wrong', () => {
  const reasonFor = (facts: Record<string, unknown>) =>
    hubdocPrepareDocuments([sendable({ facts: { ...sendable().facts, ...facts } })])[0].reason;
  assert.match(String(reasonFor({ storagePath: null })), /no file attached/);
  assert.match(String(reasonFor({ supplierId: null })), /not matched a supplier/);
  assert.match(String(reasonFor({ status: 'pending' })), /has not read this document yet/);
});

test('a document Vyso has already sent is greyed, not silently re-sent', () => {
  const [row] = hubdocPrepareDocuments([sendable({ alreadySent: true })]);
  assert.equal(row.eligible, false);
  assert.equal(row.reason, HUBDOC_ALREADY_SENT_REASON);
});

test('resend is the explicit override, and only that', () => {
  const [row] = hubdocPrepareDocuments([sendable({ alreadySent: true })], { resend: true });
  assert.equal(row.eligible, true);
  // It overrides the already-sent check and NOTHING else: a delivery note is
  // still a delivery note however many times somebody asks.
  const [note] = hubdocPrepareDocuments(
    [sendable({ alreadySent: true, facts: { ...sendable().facts, documentType: 'price_list' } })],
    { resend: true },
  );
  assert.equal(note.eligible, false);
  assert.match(String(note.reason), /supplier invoices and statements/);
});

test('why-it-cannot-go beats already-sent when both are true', () => {
  // "It already went" would be a strange thing to say about a document that
  // could never have gone.
  const [row] = hubdocPrepareDocuments([
    sendable({ alreadySent: true, facts: { ...sendable().facts, storagePath: null } }),
  ]);
  assert.match(String(row.reason), /no file attached/);
});

test('only the ticked ids are ever posted to the send route', () => {
  const documents = hubdocPrepareDocuments([
    sendable({ id: 'doc-a' }),
    sendable({ id: 'doc-b', alreadySent: true }),
    sendable({ id: 'doc-c', facts: { ...sendable().facts, supplierId: null } }),
  ]);
  assert.deepEqual(hubdocEligibleIds(documents), ['doc-a']);
});

test('the order the documents were named in is the order they are drawn in', () => {
  const documents = hubdocPrepareDocuments([
    sendable({ id: 'doc-a', filename: 'a.pdf' }),
    sendable({ id: 'doc-b', filename: 'b.pdf' }),
  ]);
  assert.deepEqual(documents.map((d) => d.filename), ['a.pdf', 'b.pdf']);
});

test('the transcript line NAMES what went, up to two of them', () => {
  assert.equal(hubdocSentMessage(['umgeni-oct.pdf']), 'Sent umgeni-oct.pdf to Hubdoc.');
  assert.equal(hubdocSentMessage(['a.pdf', 'b.pdf']), 'Sent a.pdf and b.pdf to Hubdoc.');
  assert.equal(hubdocSentMessage(['a.pdf', 'b.pdf', 'c.pdf', 'd.pdf']), 'Sent a.pdf, b.pdf and 2 more to Hubdoc.');
  // Nothing sent must not read as something sent.
  assert.equal(hubdocSentMessage([]), 'Nothing was sent to Hubdoc.');
  assert.equal(hubdocSentMessage(['  ']), 'Nothing was sent to Hubdoc.');
});

test('every chat refusal says where to fix it — that is the whole point of them', () => {
  assert.match(HUBDOC_CHAT_REFUSALS.notAdmin, /owner or admin/);
  assert.match(HUBDOC_CHAT_REFUSALS.notConnected, /Plugins → Xero/);
  assert.match(HUBDOC_CHAT_REFUSALS.noIntakeEmail, /Plugins → Xero → Hubdoc/);
  assert.match(HUBDOC_CHAT_REFUSALS.tablesMissing, /supabase\/hubdoc\.sql/);
  assert.match(HUBDOC_CHAT_REFUSALS.noDocuments, /which document/);
});
