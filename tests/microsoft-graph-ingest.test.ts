import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyMicrosoftEmail,
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
    attachmentNames: ['Tax Invoice IOA76937.PDF'],
  });
  assert.deepEqual(result, {
    classification: 'supplier_invoice',
    confidence: 97,
    reason: 'invoice-keyword',
  });
});

test('likely customer orders and unknown mail remain distinct', () => {
  assert.equal(
    classifyMicrosoftEmail({ subject: 'Purchase Order PO-1042' }).classification,
    'customer_order',
  );
  assert.deepEqual(classifyMicrosoftEmail({}), {
    classification: 'unknown',
    confidence: 0,
    reason: 'no-deterministic-signal',
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

test('attachment retries use one deterministic Storage path and partial failures cannot finish done', () => {
  const documentSource = readFileSync(new URL('../lib/platform/document-ingest.ts', import.meta.url), 'utf8');
  const adapterSource = readFileSync(new URL('../lib/platform/microsoft-graph-ingest.ts', import.meta.url), 'utf8');

  assert.match(documentSource, /createHash\('sha256'\)/);
  assert.ok(documentSource.includes(".update(`${emailIngestId}\\0${sourceAttachmentId}`, 'utf8')"));
  assert.match(documentSource, /email-ingests\/\$\{attachmentStorageKey\}/);
  assert.match(documentSource, /attachmentStorageKey && isUniqueViolation\(upErr\)/);
  assert.match(documentSource, /eq\('source_attachment_id', sourceAttachmentId\)/);
  assert.match(adapterSource, /const status = result\.errors\.length > 0 \? 'failed' : 'done'/);
});

test('database migration enforces Graph message and attachment idempotency', () => {
  const sql = readFileSync(new URL('../supabase/microsoft-graph-ingest.sql', import.meta.url), 'utf8');
  assert.match(sql, /unique index if not exists email_ingests_graph_message_uidx/i);
  assert.match(sql, /on email_ingests \(org_id, graph_message_id\)/i);
  assert.match(sql, /unique index if not exists documents_ingest_attachment_uidx/i);
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
});

test('email-linked orders cannot enter the unmatched-customer auto-create path', () => {
  const source = readFileSync(new URL('../lib/platform/orderflow-from-doc.ts', import.meta.url), 'utf8');
  assert.match(source, /if \(!customerId && !sourceDoc\.email_ingest_id\)/);
});
