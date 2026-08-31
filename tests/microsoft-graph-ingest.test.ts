import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classificationBodyText,
  classifyMicrosoftEmail,
  diagnoseMicrosoftGraphAttachments,
  finalMicrosoftGraphIngestStatus,
  hasPdfSignature,
  ingestMicrosoftGraphMessage,
  selectMicrosoftGraphAttachments,
  type MicrosoftGraphIngestDependencies,
} from '../lib/platform/microsoft-graph-ingest-core.ts';
import type {
  MicrosoftGraphAttachmentMetadata,
  MicrosoftGraphMessageContent,
} from '../lib/platform/microsoft-graph-core.ts';

const MESSAGE_ID = 'AAMk-message-1';

function message(overrides: Partial<MicrosoftGraphMessageContent> = {}): MicrosoftGraphMessageContent {
  return {
    id: MESSAGE_ID,
    subject: 'Tax Invoice IOA76937',
    from: { name: 'Charlien Naude', address: 'charlien@countrymushrooms.co.za' },
    receivedDateTime: '2026-08-28T08:38:57Z',
    hasAttachments: true,
    conversationId: 'conversation-1',
    internetMessageId: '<AAMk-message-1@countrymushrooms.co.za>',
    body: { contentType: 'text', content: 'Tax Invoice IOA76937 from COUNTRY MUSHROOMS (PTY) LTD' },
    bodyPreview: 'Tax Invoice IOA76937 from COUNTRY MUSHROOMS (PTY) LTD',
    ...overrides,
  };
}

function attachment(overrides: Partial<MicrosoftGraphAttachmentMetadata> = {}): MicrosoftGraphAttachmentMetadata {
  return {
    id: 'attachment-1',
    name: 'Tax Invoice IOA76937.PDF',
    contentType: 'application/pdf',
    size: 18_197,
    isInline: false,
    attachmentType: '#microsoft.graph.fileAttachment',
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<MicrosoftGraphIngestDependencies> = {},
): MicrosoftGraphIngestDependencies {
  return {
    fetchMessage: async () => message(),
    listAttachments: async () => [attachment()],
    downloadAttachment: async () => new Uint8Array([37, 80, 68, 70]),
    ingestDocument: async () => ({
      ok: true,
      documentId: 'document-1',
      documentType: 'invoice',
    }),
    ingestHtmlAttachmentOrder: async () => ({
      ok: true,
      documentId: 'html-attachment-document-1',
      documentType: 'order',
    }),
    ingestBodyOrder: async () => ({
      ok: true,
      documentId: 'body-document-1',
      documentType: 'order',
    }),
    reconcileBodyWithOrderDocument: async ({ documentId }) => ({
      ok: true,
      documentId,
      documentType: 'order',
    }),
    recordMessage: async () => {},
    recordAttachmentTotal: async () => {},
    recordAttachmentProcessed: async () => {},
    ...overrides,
  };
}

test('the real Country Mushrooms example classifies as a supplier invoice', () => {
  const result = classifyMicrosoftEmail({
    subject: 'Tax Invoice IOA76937',
    body: 'Tax Invoice IOA76937 from COUNTRY MUSHROOMS (PTY) LTD',
    senderName: 'Charlien Naude',
    senderEmail: 'charlien@countrymushrooms.co.za',
    attachments: [attachment()],
  });
  assert.equal(result.classification, 'supplier_invoice');
  assert.equal(result.orderingIntentDetected, false);
  assert.equal(result.primarySource, 'combined');
  assert.ok(result.confidence >= 95);
  assert.ok(result.evidence.includes('sender:business-domain'));
  assert.ok(result.evidence.includes('attachment:mime-pdf'));
});

test('body-only explicit supply request with quantities has ordering intent', () => {
  const result = classifyMicrosoftEmail({
    subject: 'Monday delivery',
    body: 'Hi, please deliver 10kg potatoes and 5kg carrots Monday.',
  });
  assert.equal(result.classification, 'customer_order');
  assert.equal(result.orderingIntentDetected, true);
  assert.equal(result.primarySource, 'email_body');
  assert.ok(result.evidence.includes('body:explicit-supply-request'));
  assert.ok(result.evidence.includes('body:multiple-quantity-uom-lines'));
});

test('price, availability, complaint and product discussion do not become orders', () => {
  const cases = [
    { body: 'Please send pricing for potatoes', expected: 'quote' },
    { body: 'Do you have strawberries available?', expected: 'general_correspondence' },
    { body: 'We have had issues with the carrots in our last order.', expected: 'general_correspondence' },
    { body: 'The potatoes are looking good this season.', expected: 'general_correspondence' },
  ] as const;
  for (const item of cases) {
    const result = classifyMicrosoftEmail({ subject: 'Produce', body: item.body });
    assert.equal(result.classification, item.expected, item.body);
    assert.equal(result.orderingIntentDetected, false, item.body);
  }
});

test('standalone Order and Requisition need structured or attachment evidence', () => {
  const standalone = classifyMicrosoftEmail({
    subject: 'Order',
    body: 'Please deliver 10kg potatoes and 4 punnets strawberries.',
  });
  assert.equal(standalone.classification, 'customer_order');
  assert.equal(standalone.orderingIntentDetected, true);

  const requisition = classifyMicrosoftEmail({
    subject: 'Purchase Requisition PR-41778',
    body: '10kg potatoes',
  });
  assert.equal(requisition.classification, 'customer_order');
  assert.equal(requisition.orderingIntentDetected, true);

  const unsubstantiated = classifyMicrosoftEmail({ subject: 'Order', body: 'Please see attached.' });
  assert.notEqual(unsubstantiated.classification, 'customer_order');
  assert.equal(unsubstantiated.orderingIntentDetected, false);
});

test('attachment evidence drives orders and invoices while attachment-only prose does not', () => {
  const order = classifyMicrosoftEmail({
    subject: 'Documents',
    body: 'Please see attached.',
    attachments: [attachment({ name: 'PO_144463.pdf', contentType: 'application/octet-stream' })],
  });
  assert.equal(order.classification, 'customer_order');
  assert.equal(order.orderingIntentDetected, true);
  assert.equal(order.primarySource, 'attachment');

  const invoice = classifyMicrosoftEmail({
    body: 'Please see attached.',
    attachments: [attachment({ name: 'Tax Invoice 41778.pdf' })],
  });
  assert.equal(invoice.classification, 'supplier_invoice');
  assert.equal(invoice.primarySource, 'attachment');

  const generic = classifyMicrosoftEmail({
    body: 'Please see attached.',
    attachments: [attachment({ name: 'document.pdf' })],
  });
  assert.notEqual(generic.classification, 'customer_order');
});

test('an old order attached to a complaint is not treated as a new order', () => {
  const result = classifyMicrosoftEmail({
    subject: 'Issue with our last order',
    body: 'We have had issues with the carrots in our last order. Please see attached.',
    attachments: [attachment({ name: 'PO_144463.pdf' })],
  });
  assert.equal(result.classification, 'general_correspondence');
  assert.equal(result.orderingIntentDetected, false);
});

test('unknown mail remains distinct', () => {
  assert.deepEqual(classifyMicrosoftEmail({}), {
    classification: 'unknown',
    confidence: 0,
    reason: 'no-deterministic-signal',
    orderingIntentDetected: false,
    primarySource: 'none',
    evidence: [],
  });
});

test('supported Graph file attachments reuse the existing PDF/image policy', () => {
  const selected = selectMicrosoftGraphAttachments([
    attachment(),
    attachment({ id: 'inline-logo', name: 'logo.png', contentType: 'image/png', isInline: true }),
    attachment({ id: 'spreadsheet', name: 'orders.xlsx', contentType: 'application/vnd.ms-excel' }),
    attachment({ id: 'item', attachmentType: '#microsoft.graph.itemAttachment' }),
  ]);
  assert.deepEqual(selected.map((entry) => entry.id), ['attachment-1']);
});

test('attachment diagnostics distinguish ignored furniture from unsupported business documents', () => {
  const diagnostics = diagnoseMicrosoftGraphAttachments([
    attachment({ id: 'inline', name: 'logo.png', contentType: 'image/png', isInline: true }),
    attachment({ id: 'xlsx', name: 'order.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    attachment({ id: 'bin', name: 'tracking.bin', contentType: 'application/octet-stream' }),
    attachment({ id: 'pdf', name: 'PO_144463.pdf', contentType: 'application/octet-stream' }),
  ]);
  assert.deepEqual(diagnostics.map((entry) => [entry.attachmentId, entry.disposition, entry.actionable]), [
    ['inline', 'ignored_inline', false],
    ['xlsx', 'unsupported_media_type', true],
    ['bin', 'ignored_non_document', false],
    ['pdf', 'provisional_pdf', true],
  ]);
});

test('PDF signature validation is exact and does not trust a filename', () => {
  assert.equal(hasPdfSignature(new TextEncoder().encode('%PDF-1.7\n')), true);
  assert.equal(hasPdfSignature(new TextEncoder().encode('not a pdf')), false);
  assert.equal(hasPdfSignature(new TextEncoder().encode('%PDF')), false);
});

test('a supplier invoice copy flows through the existing document sink once', async () => {
  const progress: string[][] = [];
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      recordAttachmentProcessed: async ({ processedAttachmentIds }) => {
        progress.push(processedAttachmentIds);
      },
    }),
  );
  assert.equal(result.classification.classification, 'supplier_invoice');
  assert.equal(result.documentsCreated, 1);
  assert.deepEqual(result.processedAttachmentIds, ['attachment-1']);
  assert.deepEqual(progress, [['attachment-1']]);
  assert.deepEqual(result.errors, []);
});

test('parsed attachment evidence is reflected without erasing matching message evidence', async () => {
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Order',
        body: { contentType: 'text', content: 'Please deliver 10kg potatoes.' },
        bodyPreview: 'Please deliver 10kg potatoes.',
      }),
      listAttachments: async () => [attachment({ name: 'PO_144463.pdf' })],
      ingestDocument: async () => ({ ok: true, documentId: 'document-1', documentType: 'order' }),
    }),
  );
  assert.equal(result.classification.classification, 'customer_order');
  assert.equal(result.classification.primarySource, 'combined');
  assert.ok(result.classification.evidence.includes('attachment:parsed-order'));
});

test('a valid PDF mislabeled application/octet-stream is verified and normalized Vyso-side', async () => {
  const captured: Array<Parameters<MicrosoftGraphIngestDependencies['ingestDocument']>[0]> = [];
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      listAttachments: async () => [attachment({ name: 'PO_144463.pdf', contentType: 'application/octet-stream' })],
      downloadAttachment: async () => new TextEncoder().encode('%PDF-1.7\nbody'),
      ingestDocument: async (input) => {
        captured.push(input);
        return { ok: true, documentId: 'document-1', documentType: 'order' };
      },
    }),
  );
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.mediaType, 'application/pdf');
  assert.equal(captured[0]?.sourceContentType, 'application/octet-stream');
  assert.equal(result.attachmentDiagnostics[0]?.disposition, 'processable_verified_pdf');
  assert.equal(result.unsupportedAttachments, 0);
  assert.equal(result.documentsCreated, 1);
});

test('a fake PDF filename with invalid bytes remains unsupported and never reaches the parser', async () => {
  let parserCalled = false;
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      listAttachments: async () => [attachment({ name: 'PO_144460.pdf', contentType: 'application/octet-stream' })],
      downloadAttachment: async () => new TextEncoder().encode('PK fake workbook bytes'),
      ingestDocument: async () => {
        parserCalled = true;
        return { ok: true, documentId: 'must-not-exist' };
      },
    }),
  );
  assert.equal(parserCalled, false);
  assert.equal(result.documentsCreated, 0);
  assert.equal(result.actionableUnsupportedAttachments, 1);
  assert.equal(result.attachmentDiagnostics[0]?.disposition, 'invalid_pdf_signature');
  assert.equal(finalMicrosoftGraphIngestStatus(result), 'failed');
});

test('message identity reaches the document sink without becoming an organisation selector', async () => {
  const captured: Array<Parameters<MicrosoftGraphIngestDependencies['ingestDocument']>[0]> = [];
  await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      ingestDocument: async (input) => {
        captured.push(input);
        return { ok: true, documentId: 'document-1', documentType: 'invoice' };
      },
    }),
  );
  assert.deepEqual(captured[0]?.customerEvidence, {
    senderEmail: 'charlien@countrymushrooms.co.za',
    senderName: 'Charlien Naude',
    subject: 'Tax Invoice IOA76937',
    messageText: 'Tax Invoice IOA76937 from COUNTRY MUSHROOMS (PTY) LTD',
  });
  assert.ok(!('orgId' in (captured[0]?.customerEvidence ?? {})));
});

test('Graph message GET failure stops before attachment or parser work', async () => {
  let touchedAttachment = false;
  await assert.rejects(
    ingestMicrosoftGraphMessage(
      { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
      dependencies({
        fetchMessage: async () => {
          throw new Error('Graph GET failed');
        },
        listAttachments: async () => {
          touchedAttachment = true;
          return [];
        },
      }),
    ),
    /Graph GET failed/,
  );
  assert.equal(touchedAttachment, false);
});

test('attachment download failure is recorded without calling the parser', async () => {
  let parserCalled = false;
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      downloadAttachment: async () => {
        throw new Error('Attachment GET failed');
      },
      ingestDocument: async () => {
        parserCalled = true;
        return { ok: true, documentId: 'should-not-exist' };
      },
    }),
  );
  assert.equal(parserCalled, false);
  assert.equal(result.documentsCreated, 0);
  assert.match(result.errors[0], /Attachment GET failed/);
});

test('parser failure and storage failure remain retryable when no document was filed', async () => {
  for (const error of ['Existing parser failed.', 'Could not save the file: storage unavailable']) {
    const result = await ingestMicrosoftGraphMessage(
      { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
      dependencies({ ingestDocument: async () => ({ ok: false, error }) }),
    );
    assert.equal(result.documentsCreated, 0);
    assert.deepEqual(result.processedAttachmentIds, []);
    assert.equal(result.errors[0], error);
  }
});

test('unsupported attachments are left untouched without invoking download or parser', async () => {
  let downloadCalled = false;
  let parserCalled = false;
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      listAttachments: async () => [attachment({ name: 'orders.xlsx', contentType: 'application/vnd.ms-excel' })],
      downloadAttachment: async () => {
        downloadCalled = true;
        return new Uint8Array();
      },
      ingestDocument: async () => {
        parserCalled = true;
        return { ok: true };
      },
    }),
  );
  assert.equal(downloadCalled, false);
  assert.equal(parserCalled, false);
  assert.equal(result.unsupportedAttachments, 1);
  assert.equal(result.actionableUnsupportedAttachments, 1);
  assert.equal(finalMicrosoftGraphIngestStatus(result), 'failed');
});

test('body-only order creates one reviewable source while non-actionable correspondence stays ignored', async () => {
  let bodyCalls = 0;
  const bodyOrder = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Order',
        hasAttachments: false,
        body: { contentType: 'text', content: 'Please deliver 10kg potatoes and 5kg carrots Monday.' },
        bodyPreview: 'Please deliver 10kg potatoes and 5kg carrots Monday.',
      }),
      listAttachments: async () => [],
      ingestBodyOrder: async () => {
        bodyCalls += 1;
        return { ok: true, documentId: 'body-document-1', documentType: 'order' };
      },
    }),
  );
  assert.equal(bodyOrder.classification.orderingIntentDetected, true);
  assert.equal(bodyOrder.classification.primarySource, 'email_body');
  assert.equal(bodyOrder.documentsCreated, 1);
  assert.deepEqual(bodyOrder.processedAttachmentIds, ['email-body']);
  assert.equal(bodyCalls, 1);
  assert.equal(finalMicrosoftGraphIngestStatus(bodyOrder), 'done');

  const correspondence = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Question',
        hasAttachments: false,
        body: { contentType: 'text', content: 'Thank you for the update.' },
        bodyPreview: 'Thank you for the update.',
      }),
      listAttachments: async () => [],
    }),
  );
  assert.equal(correspondence.classification.classification, 'general_correspondence');
  assert.equal(finalMicrosoftGraphIngestStatus(correspondence), 'ignored');
});

test('failed body-only extraction remains failed and retryable', async () => {
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Order',
        hasAttachments: false,
        body: { contentType: 'text', content: 'Please deliver 10kg potatoes Monday.' },
        bodyPreview: 'Please deliver 10kg potatoes Monday.',
      }),
      listAttachments: async () => [],
      ingestBodyOrder: async () => ({ ok: false, error: 'Text order extraction failed.' }),
    }),
  );
  assert.equal(result.documentsCreated, 0);
  assert.deepEqual(result.processedAttachmentIds, []);
  assert.match(result.errors[0], /Text order extraction failed/);
  assert.equal(finalMicrosoftGraphIngestStatus(result), 'failed');
});

test('body plus order attachment reconciles into the attachment document, never a second order', async () => {
  let bodyCreates = 0;
  let reconciles = 0;
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Order',
        body: { contentType: 'text', content: 'Please deliver 10kg potatoes Monday.' },
        bodyPreview: 'Please deliver 10kg potatoes Monday.',
      }),
      listAttachments: async () => [attachment({ name: 'PO_144463.pdf' })],
      ingestDocument: async () => ({ ok: true, documentId: 'attachment-order-1', documentType: 'order' }),
      ingestBodyOrder: async () => {
        bodyCreates += 1;
        return { ok: true, documentId: 'must-not-exist', documentType: 'order' };
      },
      reconcileBodyWithOrderDocument: async ({ documentId }) => {
        reconciles += 1;
        return { ok: true, documentId, documentType: 'order' };
      },
    }),
  );
  assert.equal(bodyCreates, 0);
  assert.equal(reconciles, 1);
  assert.equal(result.documentsCreated, 1);
  assert.deepEqual(new Set(result.processedAttachmentIds), new Set(['attachment-1', 'email-body']));
  assert.equal(result.classification.primarySource, 'combined');
  assert.equal(finalMicrosoftGraphIngestStatus(result), 'done');
});

test('an attachment order plus body-only delivery instruction is combined evidence, not a second order', async () => {
  let bodyCreates = 0;
  let reconciles = 0;
  const sourceMessage = message({
    subject: 'PO attached',
    body: { contentType: 'text', content: 'Please deliver to the rear loading bay.' },
    bodyPreview: 'Please deliver to the rear loading bay.',
  });
  const classified = classifyMicrosoftEmail({
    subject: sourceMessage.subject,
    body: sourceMessage.body?.content,
    bodyPreview: sourceMessage.bodyPreview,
    attachments: [attachment({ name: 'PO_144463.pdf' })],
  });
  assert.equal(classified.classification, 'customer_order');
  assert.equal(classified.primarySource, 'combined');

  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => sourceMessage,
      listAttachments: async () => [attachment({ name: 'PO_144463.pdf' })],
      ingestDocument: async () => ({ ok: true, documentId: 'attachment-order-1', documentType: 'order' }),
      ingestBodyOrder: async () => {
        bodyCreates += 1;
        return { ok: true, documentId: 'must-not-exist', documentType: 'order' };
      },
      reconcileBodyWithOrderDocument: async ({ documentId }) => {
        reconciles += 1;
        return { ok: true, documentId, documentType: 'order' };
      },
    }),
  );
  assert.equal(bodyCreates, 0);
  assert.equal(reconciles, 1);
  assert.equal(result.documentsCreated, 1);
  assert.deepEqual(new Set(result.processedAttachmentIds), new Set(['attachment-1', 'email-body']));
});

test('processed email-body source is idempotent on retry', async () => {
  let bodyCalls = 0;
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: ['email-body'], documentsCreated: 1 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Order',
        hasAttachments: false,
        body: { contentType: 'text', content: 'Please deliver 10kg potatoes Monday.' },
      }),
      listAttachments: async () => [],
      ingestBodyOrder: async () => {
        bodyCalls += 1;
        return { ok: true, documentId: 'duplicate', documentType: 'order' };
      },
    }),
  );
  assert.equal(bodyCalls, 0);
  assert.equal(result.documentsCreated, 1);
  assert.deepEqual(result.processedAttachmentIds, ['email-body']);
});

test('idempotent retry skips a Graph attachment already filed on an earlier attempt', async () => {
  let downloadCalls = 0;
  let parserCalls = 0;
  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      processedAttachmentIds: ['attachment-1'],
      documentsCreated: 1,
    },
    dependencies({
      downloadAttachment: async () => {
        downloadCalls += 1;
        return new Uint8Array([1]);
      },
      ingestDocument: async () => {
        parserCalls += 1;
        return { ok: true, documentId: 'duplicate' };
      },
    }),
  );
  assert.equal(downloadCalls, 0);
  assert.equal(parserCalls, 0);
  assert.equal(result.documentsCreated, 1);
  assert.deepEqual(result.processedAttachmentIds, ['attachment-1']);
});

test('an existing errored Vyso copy stays failed without creating a duplicate document', async () => {
  let parserCalls = 0;
  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      processedAttachmentIds: ['attachment-1'],
      documentsCreated: 0,
      existingErrors: ['The existing document still needs a Doc-U extraction retry.'],
    },
    dependencies({
      ingestDocument: async () => {
        parserCalls += 1;
        return { ok: true, documentId: 'duplicate' };
      },
    }),
  );
  assert.equal(parserCalls, 0);
  assert.equal(result.documentsCreated, 0);
  assert.deepEqual(result.processedAttachmentIds, ['attachment-1']);
  assert.match(result.errors[0], /Doc-U extraction retry/);
});

test('attachment retries use one deterministic Storage path and final status is semantic', () => {
  const documentSource = readFileSync(new URL('../lib/platform/document-ingest.ts', import.meta.url), 'utf8');
  const adapterSource = readFileSync(new URL('../lib/platform/microsoft-graph-ingest.ts', import.meta.url), 'utf8');

  assert.match(documentSource, /createHash\('sha256'\)/);
  assert.ok(documentSource.includes(".update(`${emailIngestId}\\0${sourcePartId}`, 'utf8')"));
  assert.match(documentSource, /return `\$\{orgId\}\/email-ingests\/\$\{key\}`/);
  assert.match(documentSource, /attachmentStorageKey && isUniqueViolation\(upErr\)/);
  assert.match(documentSource, /eq\('source_attachment_id', sourceAttachmentId\)/);
  assert.match(adapterSource, /finalMicrosoftGraphIngestStatus\(result\)/);
});

test('database migration enforces Graph message and attachment idempotency', () => {
  const sql = readFileSync(new URL('../supabase/microsoft-graph-ingest.sql', import.meta.url), 'utf8');
  assert.match(sql, /unique index if not exists email_ingests_graph_message_uidx/i);
  assert.match(sql, /on email_ingests \(org_id, graph_message_id\)/i);
  assert.match(sql, /unique index if not exists documents_ingest_attachment_uidx/i);
  assert.match(sql, /graph_id_type text not null default 'rest_id'/i);
  assert.match(sql, /attachment_diagnostics jsonb not null default '\[\]'::jsonb/i);
  assert.match(sql, /body_source_storage_path text/i);
  assert.match(sql, /source_type text/i);
  assert.match(sql, /'pdf', 'image', 'spreadsheet', 'email_body'/i);
  // The attachment index is now ACTIVE-copy-only, which is what allows a
  // controlled replacement to exist without two live copies of one source. The
  // original message idempotency key beside it is unchanged.
  assert.match(sql, /and superseded_at is null;/i);
  assert.match(sql, /drop index if exists documents_ingest_attachment_uidx;/i);
});

test('persisted Microsoft work is recoverable without after()', () => {
  const worker = readFileSync(new URL('../lib/platform/email-ingest.ts', import.meta.url), 'utf8');
  const cron = readFileSync(new URL('../app/api/email/process/route.ts', import.meta.url), 'utf8');
  const retry = readFileSync(new URL('../app/api/email/retry/route.ts', import.meta.url), 'utf8');
  const schedule = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');

  assert.match(worker, /ingest\.source === 'microsoft_graph'/);
  assert.match(worker, /processMicrosoftGraphEmailIngest/);
  assert.match(cron, /\.eq\('status', 'queued'\)/);
  assert.match(cron, /\.eq\('status', 'processing'\)/);
  assert.match(cron, /STALE_PROCESSING_MS/);
  assert.match(retry, /\['queued', 'failed', 'quarantined', 'ignored'\]/);
  assert.match(schedule, /"path": "\/api\/email\/process"/);
});

test('deferred document ingestion cannot create supplier or operational side effects', () => {
  const source = readFileSync(new URL('../lib/platform/document-ingest.ts', import.meta.url), 'utf8');
  assert.match(source, /parties\.supplierName && !deferCommit/);
  assert.match(source, /if \(!deferCommit\) \{[\s\S]*?runDocumentSideEffects/);
  assert.match(source, /Deferred \(email\): stop here/);
  // THE SAME GUARANTEE, EXTENDED TO THE TWO NEW MODULES. A controlled reprocess
  // is still unattended email ingestion: the resolver and the reprocess route
  // reach no operational table and commit nothing, and the route's only writes
  // are to the ingest row it was pointed at.
  const resolver = readFileSync(new URL('../lib/platform/microsoft-graph-resolve.ts', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../app/api/email/reprocess/route.ts', import.meta.url), 'utf8');
  for (const reprocessSource of [resolver, route]) {
    assert.doesNotMatch(reprocessSource, /runDocumentSideEffects|syncOrderFromDocument|feedDocumentToProcurePulse/);
    assert.doesNotMatch(reprocessSource, /from\('of_orders'\)|from\('of_invoices'\)|from\('pp_movements'\)|from\('pp_stock_items'\)/);
  }
  assert.doesNotMatch(resolver, /\.from\(/, 'the resolver touches no table at all');
  assert.match(route, /deferCommit|processEmailIngest/);
});

test('email-body order source is private, deterministic, deferred and not a fake PDF', () => {
  const source = readFileSync(new URL('../lib/platform/microsoft-message-order.ts', import.meta.url), 'utf8');
  const adapter = readFileSync(new URL('../lib/platform/microsoft-graph-ingest.ts', import.meta.url), 'utf8');
  assert.match(source, /sourceAttachmentId: EMAIL_BODY_SOURCE_PART_ID/);
  assert.match(source, /sourceType: 'email_body'/);
  assert.match(source, /mediaType: 'text\/plain; charset=utf-8'/);
  // THE DOCUMENT HOLDS DERIVED TEXT, NEVER MARKUP. The stored object is served
  // back into a reviewer's browser through a signed URL and an iframe, so
  // sender-authored HTML must not be what lands there; the original is kept
  // separately, privately, and is never rendered.
  assert.match(source, /Buffer\.from\(storedText, 'utf8'\)/);
  assert.match(source, /const storedText = prepared\.derivedText \|\| prepared\.original/);
  assert.match(source, /EMAIL_BODY_ORIGINAL_SOURCE_PART_ID = 'email-body-original'/);
  assert.match(source, /contentType: 'text\/html; charset=utf-8'/);
  assert.match(source, /return message\.body\?\.content \?\? ''/);
  assert.match(source, /deferCommit: true/);
  assert.doesNotMatch(source, /syncOrderFromDocument|\.from\('of_orders'\)|\.from\('of_invoices'\)|\.from\('pp_movements'\)/);
  assert.match(adapter, /recoverableBodySource/);
  assert.match(adapter, /row\.source_attachment_id !== 'email-body'/);
});

test('email-linked orders cannot enter the unmatched-customer auto-create path', () => {
  const source = readFileSync(new URL('../lib/platform/orderflow-from-doc.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!customerId && !sourceDoc\.email_ingest_id\)/);
});

// ---------------------------------------------------------------------------
// Email source usability: html bodies, html attachments, and the honest empty
// order. Fixtures are ANONYMISED shapes of two real production messages.
// ---------------------------------------------------------------------------

/** A procurement-portal notification: metadata, a wrapped link, no goods. */
const PORTAL_NOTIFICATION_BODY = '<html><body>Property: Riverbend<br>Reference Buyer PO number: RVB0044219<br><br>Sent By:<br>Dana Kruger<br><br>TO EDIT THE DOCUMENT CLICK THE BELOW LINK<br><a href="https://links.mailer-example.net/ls/click?upn=EXAMPLE-TOKEN-0000">http://riverbend.birchstreet.net</a><img src="https://links.mailer-example.net/wf/open?upn=EXAMPLE-TOKEN-0000" width="1" height="1"></body></html>';

/** An Outlook standing order form: a real grid, three of its rows written in. */
const ORDER_FORM_BODY = '<html><head><style>p { margin: 0 }</style></head><body><table class="MsoNormalTable">'
  + '<tr><td><b>Item</b></td><td><b>UNIT</b></td><td><b>stock</b></td><td><b>order</b></td></tr>'
  + '<tr><td>Carrots Baby</td><td>pkts</td><td>&nbsp;</td><td>1</td></tr>'
  + '<tr><td>Coriander Fresh</td><td>KG</td><td>&nbsp;</td><td>200g</td></tr>'
  + '<tr><td>Filler Product 3</td><td>BOX</td><td>&nbsp;</td><td>&nbsp;</td></tr>'
  + '<tr><td>Potatoes Large</td><td>BAG</td><td>&nbsp;</td><td>2</td></tr>'
  + '</table><p>Kind Regards</p><p>Dana Kruger</p></body></html>';

test('classification reads an HTML body through the normalizer, table cells included', () => {
  // The quantity signals on an order form live INSIDE the table. Before the
  // normalizer they arrived pre-flattened from Exchange; now they are derived
  // here, and an order form must still classify as an order.
  const derived = classificationBodyText({
    body: { contentType: 'html', content: ORDER_FORM_BODY },
  });
  assert.match(derived, /Carrots Baby/);
  assert.match(derived, /200g/);
  assert.ok(!derived.includes('MsoNormalTable'), 'no markup reaches the classifier');
  assert.ok(!derived.includes('margin: 0'), 'no stylesheet reaches the classifier');

  const result = classifyMicrosoftEmail({
    subject: 'Order form - Riverbend',
    body: derived,
    bodyPreview: 'Order form',
    senderName: 'Dana Kruger',
    senderEmail: 'dana.kruger@riverbend-hotels.example',
    attachments: [],
  });
  assert.equal(result.classification, 'customer_order');
  assert.equal(result.orderingIntentDetected, true);
});

test('an html file attachment is a document, not mail furniture', () => {
  const diagnostics = diagnoseMicrosoftGraphAttachments([
    attachment({ id: 'html-1', name: 'PO_RVB0044219.html', contentType: 'text/html', size: 26_000 }),
    attachment({ id: 'html-2', name: 'PO_RVB0044220.HTM', contentType: 'application/octet-stream', size: 12_000 }),
    attachment({ id: 'html-3', name: 'huge_export.html', contentType: 'text/html', size: 2_000_000 }),
    attachment({ id: 'inline-1', name: 'signature.html', contentType: 'text/html', size: 900, isInline: true }),
  ]);
  assert.equal(diagnostics[0].disposition, 'processable');
  assert.equal(diagnostics[0].processingContentType, 'text/html');
  assert.equal(diagnostics[1].disposition, 'processable');
  assert.equal(diagnostics[1].processingContentType, 'text/html');
  // Above the parser's ceiling it is a business document Vyso could not read —
  // a finding, not something to drop silently.
  assert.equal(diagnostics[2].disposition, 'unsupported_too_large');
  assert.equal(diagnostics[2].actionable, true);
  assert.equal(diagnostics[3].disposition, 'ignored_inline');
  assert.deepEqual(
    selectMicrosoftGraphAttachments([
      attachment({ id: 'html-1', name: 'PO_RVB0044219.html', contentType: 'text/html', size: 26_000 }),
    ]).map((entry) => entry.id),
    ['html-1'],
  );
});

test('the Four Seasons shape: a link-only body plus an html PO makes the ATTACHMENT canonical', async () => {
  let htmlCalls = 0;
  let visionCalls = 0;
  let reconciledWith: string | null = null;
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Purchase Order RVB0044219 - Riverbend',
        hasAttachments: true,
        body: { contentType: 'html', content: PORTAL_NOTIFICATION_BODY },
        bodyPreview: 'Property: Riverbend Reference Buyer PO number: RVB0044219',
      }),
      listAttachments: async () => [
        attachment({ id: 'html-1', name: 'PO_RVB0044219.html', contentType: 'text/html', size: 26_000 }),
      ],
      downloadAttachment: async () => new TextEncoder().encode('<table><tr><th>#</th><th>Product Desc.</th><th>Qty</th></tr><tr><td>1</td><td>Melon Sweet</td><td>6.00</td></tr></table>'),
      ingestDocument: async () => {
        visionCalls += 1;
        return { ok: false, error: 'the vision lane must never see an html attachment' };
      },
      ingestHtmlAttachmentOrder: async ({ sourceAttachmentId, sourceContentType }) => {
        htmlCalls += 1;
        assert.equal(sourceAttachmentId, 'html-1');
        assert.equal(sourceContentType, 'text/html');
        return { ok: true, documentId: 'html-order-1', documentType: 'order' };
      },
      reconcileBodyWithOrderDocument: async ({ documentId }) => {
        reconciledWith = documentId;
        return { ok: true, documentId, documentType: 'order' };
      },
      ingestBodyOrder: async () => {
        assert.fail('a body-only order must not be created when the attachment carries the PO');
      },
    }),
  );
  assert.equal(htmlCalls, 1);
  assert.equal(visionCalls, 0);
  assert.equal(reconciledWith, 'html-order-1', 'the body reconciles INTO the attachment order');
  assert.equal(result.documentsCreated, 1, 'one order, not two');
  assert.ok(result.classification.evidence.includes('attachment:parsed-html-order'));
  assert.ok(result.classification.evidence.length <= 20, 'the evidence cap is respected');
  assert.equal(result.errors.length, 0);
  assert.equal(finalMicrosoftGraphIngestStatus(result), 'done');
});

test('the link-only body with NO attachment still files one reviewable document', async () => {
  const result = await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
    dependencies({
      fetchMessage: async () => message({
        subject: 'Purchase Order RVB0044219 - Riverbend',
        hasAttachments: false,
        body: { contentType: 'html', content: PORTAL_NOTIFICATION_BODY },
        bodyPreview: 'Property: Riverbend Reference Buyer PO number: RVB0044219',
      }),
      listAttachments: async () => [],
      // The zero-line assessment document: order intent, PO reference and the
      // link preserved, and no line items invented.
      ingestBodyOrder: async () => ({ ok: true, documentId: 'assessment-document-1', documentType: 'order' }),
    }),
  );
  assert.equal(result.classification.classification, 'customer_order');
  assert.equal(result.classification.orderingIntentDetected, true);
  assert.equal(result.documentsCreated, 1);
  // A document exists, so this ingest is DONE. It was reported as a parser
  // failure before, which is the one thing that had not happened.
  assert.equal(finalMicrosoftGraphIngestStatus(result), 'done');
});

test('no Graph call and no ingest path ever fetches a URL found in a message', () => {
  const core = readFileSync(new URL('../lib/platform/microsoft-graph-ingest-core.ts', import.meta.url), 'utf8');
  const normalizer = readFileSync(new URL('../lib/platform/docu/email-html-normalizer.ts', import.meta.url), 'utf8');
  const assessment = readFileSync(new URL('../lib/platform/docu/body-source-assessment.ts', import.meta.url), 'utf8');
  const order = readFileSync(new URL('../lib/platform/microsoft-message-order.ts', import.meta.url), 'utf8');
  for (const source of [core, normalizer, assessment, order]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/, 'no new code path performs a request');
    assert.doesNotMatch(source, /XMLHttpRequest|https?\.request|node-fetch|axios/);
  }
  // The href is stored and shown; it is never dereferenced.
  assert.match(assessment, /NEVER fetched|never dereferenced|Never resolved/);
  assert.match(normalizer, /^.*never fetched.*$/mi);
});

test('an html attachment is written as source_type html, with its real content type', () => {
  const source = readFileSync(new URL('../lib/platform/microsoft-message-order.ts', import.meta.url), 'utf8');
  assert.match(source, /sourceType: 'html'/);
  assert.match(source, /sourceContentType: input\.attachment\.contentType/);
  assert.match(source, /sourceAttachmentId: input\.attachment\.id/);
  assert.match(source, /deferCommit: true/);
  // The constraint that must be widened before an 'html' row can be written.
  const sql = readFileSync(new URL('../supabase/microsoft-graph-ingest.sql', import.meta.url), 'utf8');
  assert.match(sql, /'pdf', 'image', 'spreadsheet', 'email_body', 'html'/);
});
