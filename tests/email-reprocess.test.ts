import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ingestMicrosoftGraphMessage,
  type MicrosoftGraphIngestDependencies,
} from '../lib/platform/microsoft-graph-ingest-core.ts';
import type {
  MicrosoftGraphAttachmentMetadata,
  MicrosoftGraphMessageContent,
} from '../lib/platform/microsoft-graph-core.ts';
import {
  carriesTargetedSourceProvenance,
  selectReconciliationSupersedeTarget,
  type SupersedeCandidateRow,
} from '../lib/platform/supersede-reconciliation-target.ts';
import type { MessageOrderEvidence } from '../lib/platform/types.ts';

/**
 * CONTROLLED SUPERSEDE / REPROCESS.
 *
 * Everything here is synthetic: two invented messages, an invented attachment,
 * and the source of the modules themselves. No live candidate is processed, no
 * Graph call is made, and no Supabase client exists in this file. The parts that
 * cannot be imported under node:test (the route, document-ingest.ts and the
 * server adapter all import '@/…' or 'server-only') are held to their invariants
 * by reading their source — the same convention the existing Graph suite uses
 * for the storage-path and defer-commit guarantees.
 */

const MESSAGE_ID = 'AAMkAG-original-notification-id';
const RESOLVED_ID = 'AAMkAG-re-resolved-locator';

const ROUTE = readFileSync(new URL('../app/api/email/reprocess/route.ts', import.meta.url), 'utf8');
const DOCUMENT_INGEST = readFileSync(new URL('../lib/platform/document-ingest.ts', import.meta.url), 'utf8');
const ADAPTER = readFileSync(new URL('../lib/platform/microsoft-graph-ingest.ts', import.meta.url), 'utf8');
const CORE = readFileSync(new URL('../lib/platform/microsoft-graph-ingest-core.ts', import.meta.url), 'utf8');
const MESSAGE_ORDER = readFileSync(new URL('../lib/platform/microsoft-message-order.ts', import.meta.url), 'utf8');
const WORKER = readFileSync(new URL('../lib/platform/email-ingest.ts', import.meta.url), 'utf8');
const SQL = readFileSync(new URL('../supabase/microsoft-graph-ingest.sql', import.meta.url), 'utf8');
const TYPES = readFileSync(new URL('../lib/platform/types.ts', import.meta.url), 'utf8');
const DETAIL_PANEL = readFileSync(
  new URL('../components/platform/docu/DocumentDetailPanel.tsx', import.meta.url),
  'utf8',
);

function message(overrides: Partial<MicrosoftGraphMessageContent> = {}): MicrosoftGraphMessageContent {
  return {
    id: MESSAGE_ID,
    subject: 'Purchase Order PO4471',
    from: { name: 'Buyer', address: 'buyer@example.co.za' },
    receivedDateTime: '2026-08-11T06:03:44Z',
    hasAttachments: true,
    conversationId: 'conversation-1',
    internetMessageId: '<po4471@example.co.za>',
    body: { contentType: 'html', content: '<p>Please see attached.</p>' },
    bodyPreview: 'Please see attached.',
    ...overrides,
  };
}

function attachment(overrides: Partial<MicrosoftGraphAttachmentMetadata> = {}): MicrosoftGraphAttachmentMetadata {
  return {
    id: 'html-1',
    name: 'PO4471.html',
    contentType: 'text/html',
    size: 26_000,
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
    downloadAttachment: async () => new TextEncoder().encode('<table><tr><td>Melon</td><td>6</td></tr></table>'),
    ingestDocument: async () => ({ ok: true, documentId: 'pdf-document-1', documentType: 'invoice' }),
    ingestHtmlAttachmentOrder: async () => ({ ok: true, documentId: 'html-order-2', documentType: 'order' }),
    ingestBodyOrder: async () => ({ ok: true, documentId: 'body-document-2', documentType: 'order' }),
    reconcileBodyWithOrderDocument: async ({ documentId }) => ({ ok: true, documentId, documentType: 'order' }),
    recordMessage: async () => {},
    recordAttachmentTotal: async () => {},
    recordAttachmentProcessed: async () => {},
    ...overrides,
  };
}

/* ── 14–20: supersede semantics and the compensation ordering ─────────────── */

test('14. the supersede swap is ordered mark-then-insert, because the index demands it', () => {
  const markIndex = DOCUMENT_INGEST.indexOf('Could not mark the previous document superseded');
  const insertIndex = DOCUMENT_INGEST.indexOf("const insertResult = recoveringDocumentId");
  const linkIndex = DOCUMENT_INGEST.indexOf('Could not link the superseded document to its replacement');
  assert.ok(markIndex > 0 && insertIndex > 0 && linkIndex > 0, 'all three steps exist');
  assert.ok(markIndex < insertIndex, 'the old row is marked superseded BEFORE the insert');
  assert.ok(insertIndex < linkIndex, 'the successor link is written only once the successor exists');
  // The predicate the ordering exists for.
  assert.match(SQL, /where email_ingest_id is not null and source_attachment_id is not null and superseded_at is null/);
});

test('15. a failed insert un-supersedes the old document rather than leaving it archived', () => {
  assert.match(DOCUMENT_INGEST, /const unsupersede = async \(\): Promise<void> => \{/);
  assert.match(
    DOCUMENT_INGEST,
    /\.update\(\{ superseded_at: null, superseded_by_document_id: null, supersede_reason: null \}\)/,
  );
  // Both post-mark failure paths compensate: the lost-race branch and the
  // generic insert failure.
  const compensations = DOCUMENT_INGEST.split('await unsupersede();').length - 1;
  assert.ok(compensations >= 2, `every insert failure path compensates (found ${compensations})`);
  assert.match(DOCUMENT_INGEST, /COMPENSATION\. The replacement was never filed/);
});

test('16. extraction completes before a single supersede column is written', () => {
  // Both reprocess lanes read the source FIRST and hand a finished extraction to
  // ingestDocument, so a read failure returns before anything is marked.
  const bodyRead = MESSAGE_ORDER.indexOf('const { order, assessment, prepared } = await readBodyOrder');
  const bodyFile = MESSAGE_ORDER.indexOf('sourceAttachmentId: EMAIL_BODY_SOURCE_PART_ID');
  assert.ok(bodyRead > 0 && bodyRead < bodyFile, 'the body is read before it is filed');
  const htmlRead = MESSAGE_ORDER.indexOf('const order = await extractOrderText({');
  const htmlFile = MESSAGE_ORDER.indexOf('sourceAttachmentId: input.attachment.id');
  assert.ok(htmlRead > 0 && htmlRead < htmlFile, 'the html attachment is read before it is filed');
  assert.match(MESSAGE_ORDER, /EXTRACTION FIRST, ALWAYS/);
  // And in the vision lane the classification happens inside ingestDocument,
  // above the swap.
  const classify = DOCUMENT_INGEST.indexOf('cls = await extractDocument(');
  const mark = DOCUMENT_INGEST.indexOf('Could not mark the previous document superseded');
  assert.ok(classify > 0 && classify < mark);
});

test('17. a crash between the two writes is repaired on reclaim, before anything else runs', () => {
  assert.match(ADAPTER, /async function reclaimInterruptedSupersede/);
  // The test is "does a usable successor exist", not "is the link column set".
  assert.match(
    ADAPTER,
    /const sameSourceSuccessor = rows\.find\(\(entry\) => entry\.supersedes_document_id === row\.id\)/,
  );
  assert.match(ADAPTER, /successor\.status === 'extracted' \|\| successor\.status === 'approved'/);
  // Park the unusable replacement first — that is what frees the index slot.
  const park = ADAPTER.indexOf('Could not park the abandoned replacement');
  const restore = ADAPTER.indexOf('Could not restore the superseded document');
  assert.ok(park > 0 && park < restore, 'the replacement is parked before the original is restored');
  // And it runs before the document rows are read for the run itself.
  const reclaim = ADAPTER.indexOf('Repair an interrupted swap BEFORE anything reads the document rows');
  const read = ADAPTER.indexOf('Heal the narrow crash window after a document row was filed');
  assert.ok(reclaim > 0 && reclaim < read);
});

test('18. a failed reprocess restores the prior status and never downgrades a filed email', () => {
  // The adapter catches its own run and compensates.
  assert.match(ADAPTER, /A SUPERSEDE THAT THROWS MUST NOT DOWNGRADE A FILED EMAIL/);
  assert.match(ADAPTER, /if \(!priorStatus\) throw error;/);
  assert.match(ADAPTER, /const status = supersedeTarget\s*\n?\s*\? \(priorStatus \?\? 'done'\)/);
  // The worker's own failure closure honours the same promise.
  assert.match(WORKER, /const priorStatus = ingest\.pending_reprocess\?\.prior_status \?\? null;/);
  assert.match(WORKER, /status: priorStatus \?\? status,/);
});

test('19. old documents are never deleted, and never edited beyond the four supersede columns', () => {
  // No delete of a document row anywhere on the new paths.
  for (const source of [ADAPTER, DOCUMENT_INGEST, ROUTE, MESSAGE_ORDER]) {
    assert.doesNotMatch(source, /from\('documents'\)\s*\n?\s*\.delete\(/);
  }
  assert.doesNotMatch(ROUTE, /\.delete\(|\.remove\(/);
  // Every write either module makes to an OLD document row names only the four
  // supersede columns — no status, no extracted_data, no storage_path.
  /** Every `.from('documents').update({…})` payload, brace-balanced. */
  const updatePayloads = (source: string): string[] => {
    const payloads: string[] = [];
    const marker = /\.from\('documents'\)\s*\n?\s*\.update\(\{/g;
    for (let hit = marker.exec(source); hit; hit = marker.exec(source)) {
      let depth = 1;
      let index = hit.index + hit[0].length;
      const start = index;
      while (depth > 0 && index < source.length) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        index += 1;
      }
      payloads.push(source.slice(start, index - 1));
    }
    return payloads;
  };
  const documentWrites = [...updatePayloads(ADAPTER), ...updatePayloads(DOCUMENT_INGEST)]
    .map((body) => body.replace(/\/\/[^\n]*/g, ''))
    .filter((body) => /superseded_at|supersede_reason|superseded_by_document_id/.test(body));
  // And the body-reconciliation path cannot UPDATE the document being replaced:
  // it is withheld from the canonical-order list for the duration of the run.
  assert.match(ADAPTER, /row\.source_attachment_id !== supersedeTarget,/);
  assert.match(ADAPTER, /THE DOCUMENT ABOUT TO BE REPLACED IS NOT A CANONICAL ORDER FOR THIS RUN/);
  assert.ok(documentWrites.length >= 4, `every supersede write was found (${documentWrites.length})`);
  for (const body of documentWrites) {
    for (const key of body.matchAll(/(\w+):/g)) {
      assert.ok(
        ['superseded_at', 'superseded_by_document_id', 'supersedes_document_id', 'supersede_reason'].includes(key[1]),
        `only supersede columns are written on an old document (saw ${key[1]})`,
      );
    }
  }
});

test('20. the replacement gets a versioned Storage part id, so old bytes are never overwritten', () => {
  assert.match(MESSAGE_ORDER, /export function supersedeSourcePartId\(sourcePartId: string, oldDocumentId: string\): string \{/);
  assert.ok(MESSAGE_ORDER.includes('return `${sourcePartId}:supersede:${oldDocumentId}`;'));
  // The path builder takes the versioned id; the upload stays upsert:false.
  assert.match(DOCUMENT_INGEST, /emailSourceStoragePath\(orgId, emailIngestId, storagePartId \?\? sourceAttachmentId\)/);
  assert.match(DOCUMENT_INGEST, /upsert: false/);
  // Both reprocess lanes and the vision lane pass it.
  assert.match(MESSAGE_ORDER, /storagePartId: supersedeSourcePartId\(EMAIL_BODY_SOURCE_PART_ID, input\.supersede\.documentId\)/);
  assert.match(MESSAGE_ORDER, /storagePartId: supersedeSourcePartId\(input\.attachment\.id, input\.supersede\.documentId\)/);
  assert.match(ADAPTER, /storagePartId: supersedeSourcePartId\(sourceAttachmentId, supersede\.documentId\)/);
});

/* ── 21–24: the TARGETED source bypass ────────────────────────────────────── */

test('21. only the named source re-runs; every other processed source stays protected', async () => {
  const ingested: string[] = [];
  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      processedAttachmentIds: ['html-1', 'pdf-2'],
      documentsCreated: 2,
      reprocessSources: ['html-1'],
    },
    dependencies({
      listAttachments: async () => [
        attachment(),
        attachment({ id: 'pdf-2', name: 'Invoice.pdf', contentType: 'application/pdf' }),
      ],
      downloadAttachment: async (entry) => {
        ingested.push(entry.id);
        return entry.id === 'pdf-2'
          ? new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
          : new TextEncoder().encode('<table><tr><td>Melon</td><td>6</td></tr></table>');
      },
    }),
  );
  assert.deepEqual(ingested, ['html-1'], 'the untargeted attachment is never even downloaded');
  // The skip list still names BOTH sources afterwards — it is added to, never cleared.
  assert.deepEqual([...result.processedAttachmentIds].sort(), ['html-1', 'pdf-2']);
});

test('22. with no reprocess source, every processed source stays skipped (the ordinary retry)', async () => {
  let downloads = 0;
  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      processedAttachmentIds: ['html-1'],
      documentsCreated: 1,
    },
    dependencies({
      downloadAttachment: async () => {
        downloads += 1;
        return new TextEncoder().encode('<table></table>');
      },
    }),
  );
  assert.equal(downloads, 0);
  assert.deepEqual(result.processedAttachmentIds, ['html-1']);
});

test('23. the body source is bypassed the same way, and only when it is named', async () => {
  const bodyMessage = message({
    hasAttachments: false,
    subject: 'Order for Tuesday',
    body: { contentType: 'text', content: 'Please deliver 6 kg carrots and 2 boxes tomatoes. PO 4471' },
    bodyPreview: 'Please deliver 6 kg carrots',
  });
  let bodyRuns = 0;
  const deps = () =>
    dependencies({
      fetchMessage: async () => bodyMessage,
      listAttachments: async () => [],
      ingestBodyOrder: async () => {
        bodyRuns += 1;
        return { ok: true, documentId: 'body-document-2', documentType: 'order' };
      },
    });

  await ingestMicrosoftGraphMessage(
    { expectedMessageId: MESSAGE_ID, processedAttachmentIds: ['email-body'], documentsCreated: 1 },
    deps(),
  );
  assert.equal(bodyRuns, 0, 'an ordinary retry leaves a filed body alone');

  const superseded = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      processedAttachmentIds: ['email-body'],
      documentsCreated: 1,
      reprocessSources: ['email-body'],
    },
    deps(),
  );
  assert.equal(bodyRuns, 1, 'the named body source runs again');
  // A replacement is not an additional document.
  assert.equal(superseded.documentsCreated, 1);
  assert.deepEqual(superseded.processedAttachmentIds, ['email-body']);
});

test('24. the bypass is a set-membership check, never a cleared list', () => {
  assert.match(CORE, /if \(alreadyDone\.has\(attachment\.id\) && !reprocessSources\.has\(attachment\.id\)\) continue;/);
  assert.match(CORE, /if \(bodyOrderEvidence && \(!alreadyDone\.has\('email-body'\) \|\| reprocessSources\.has\('email-body'\)\)\)/);
  assert.match(CORE, /A SET-MEMBERSHIP CHECK, NOT A CLEARED LIST/);
  // Nothing anywhere writes an empty skip list.
  for (const source of [CORE, ADAPTER, ROUTE, WORKER]) {
    assert.doesNotMatch(source, /processed_attachment_ids:\s*(\[\]|null)/);
  }
  // And the adapter passes at most the one named id.
  assert.match(ADAPTER, /\.\.\.\(supersedeTarget \? \{ reprocessSources: \[supersedeTarget\] \} : \{\}\)/);
});

/* ── 25–27: idempotency ───────────────────────────────────────────────────── */

test('25. a repeated supersede for the same source and reason is a recorded no-op', () => {
  assert.match(ROUTE, /entry\.kind === 'supersede' &&\s*\n\s*entry\.outcome === 'superseded' &&/);
  assert.match(ROUTE, /entry\.target_source === targetSource &&\s*\n\s*entry\.reason === reason,/);
  assert.match(ROUTE, /if \(\(active\?\.supersedes_document_id && alreadyDone\) \|\| \(!active && alreadyReconciled\)\) \{/);
  assert.match(ROUTE, /That source has already been superseded for this reason; nothing was changed\./);
  assert.match(ROUTE, /status: 409/);
});

test('26. the intent is consumed exactly once, so a cron re-drive cannot replay it', () => {
  assert.match(ADAPTER, /\.\.\.\(pending \? \{ pending_reprocess: null \} : \{\}\)/);
  assert.match(ADAPTER, /Leaving it set would let a routine\s*\n\s*\/\/ cron re-drive replay a supersede nobody asked for a second time/);
  assert.match(WORKER, /\.\.\.\(priorStatus \? \{ pending_reprocess: null \} : \{\}\)/);
});

test('27. a document already replaced cannot be superseded twice by a racing worker', () => {
  // The mark only matches an ACTIVE row, and a miss is a refusal.
  assert.match(DOCUMENT_INGEST, /\.is\('superseded_at', null\)\s*\n\s*\.select\('id'\)\s*\n\s*\.maybeSingle\(\);/);
  assert.match(DOCUMENT_INGEST, /The targeted document is no longer the active copy for this source\./);
  // And a target that moved between the request and the run is refused too.
  assert.match(DOCUMENT_INGEST, /The active document for this source is no longer the one the reprocess targeted\./);
});

/* ── 28–33: safety — auth, validation, writes, secrets ────────────────────── */

test('28. the route accepts an owner/admin session OR the cron secret, and nothing else', () => {
  assert.match(ROUTE, /const cronAuthorized = Boolean\(cronSecret\) && authorization === `Bearer \$\{cronSecret\}`;/);
  assert.match(ROUTE, /const auth = await resolveUser\(req\);/);
  assert.match(ROUTE, /if \(!auth\) return NextResponse\.json\(\{ error: 'Unauthorized' \}, \{ status: 401 \}\);/);
  assert.match(ROUTE, /profile\.role !== 'owner' && profile\.role !== 'admin'/);
  assert.match(ROUTE, /status: 403/);
  // An empty CRON_SECRET can never authorise: Boolean(cronSecret) guards it.
  assert.match(ROUTE, /const cronSecret = process\.env\.CRON_SECRET \?\? '';/);
  // The secret is never echoed back or logged.
  assert.doesNotMatch(ROUTE, /console\.(log|error|warn)/);
  assert.doesNotMatch(ROUTE, /cronSecret[^;)]*NextResponse/);
});

test('29. the route refuses vague input: no id, no action, no reason, no target', () => {
  assert.match(ROUTE, /const UUID_RE = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i;/);
  assert.match(ROUTE, /if \(!UUID_RE\.test\(emailIngestId\)\)/);
  assert.match(ROUTE, /action === 'retry_failed' \|\| body\.action === 'supersede_source'/);
  assert.match(ROUTE, /THE REASON IS MANDATORY/);
  assert.match(ROUTE, /if \(!reason\) \{/);
  assert.match(ROUTE, /targetSource is required for supersede_source/);
  // Status gates, per action.
  assert.match(ROUTE, /retry_failed: \['queued', 'failed', 'ignored'\]/);
  assert.match(ROUTE, /supersede_source: \['done'\]/);
  assert.match(ROUTE, /if \(!ALLOWED_STATUSES\[action\]\.includes\(ingest\.status\)\)/);
  // Unknown ids and other orgs.
  assert.match(ROUTE, /if \(sessionOrgId\) query = query\.eq\('org_id', sessionOrgId\);/);
  assert.match(ROUTE, /That email is not in your organisation\./);
});

test('30. an unresolvable message changes nothing at all', () => {
  const refusal = ROUTE.indexOf("if (resolution.status === 'unresolved')");
  const firstWrite = ROUTE.indexOf(".from('email_ingests')\n    .update(");
  assert.ok(refusal > 0 && firstWrite > 0 && refusal < firstWrite, 'the refusal precedes every write');
  assert.match(ROUTE, /could not be identified in the mailbox with certainty; nothing was changed/);
  // A transient Graph fault is a 502, not a resolution failure.
  assert.match(ROUTE, /status: 502/);
});

test('31. ONE email is ONE ingest: no path on this feature inserts an email_ingests row', () => {
  assert.doesNotMatch(ROUTE, /from\('email_ingests'\)[\s\S]{0,80}\.insert\(/);
  assert.match(ROUTE, /ONE ROW, ALWAYS/);
  // The only insert in the adapter is the pre-existing notification enqueue.
  const inserts = [...ADAPTER.matchAll(/\.from\('email_ingests'\)\s*\n?\s*\.insert\(/g)];
  assert.equal(inserts.length, 1, 'only enqueueMicrosoftGraphNotifications inserts');
  assert.ok(ADAPTER.indexOf('.insert({') < ADAPTER.indexOf('export async function processMicrosoftGraphEmailIngest'));
});

test('32. every reprocess sink is deferred, and writes nothing operational', () => {
  // The three sinks the adapter supplies all defer.
  const sinkBlock = ADAPTER.slice(ADAPTER.indexOf('ingestDocument: async ({ bytes'), ADAPTER.indexOf('recordMessage: async'));
  assert.equal(sinkBlock.split('deferCommit: true').length - 1, 1, 'the vision sink defers');
  assert.match(sinkBlock, /EVERY reprocess sink is an unattended sink/);
  assert.equal(MESSAGE_ORDER.split('deferCommit: true').length - 1, 2, 'both message-order sinks defer');
  // And nothing on these paths reaches an operational table.
  for (const source of [ADAPTER, MESSAGE_ORDER, ROUTE]) {
    assert.doesNotMatch(source, /from\('of_orders'\)|from\('of_invoices'\)|from\('pp_movements'\)|from\('pp_prices'\)/);
    assert.doesNotMatch(source, /runDocumentSideEffects|syncOrderFromDocument/);
  }
});

test('33. the audit log is bounded, and never records a body, a subject or a secret', () => {
  assert.match(ADAPTER, /const MAX_REPROCESS_LOG_ENTRIES = 50;/);
  assert.match(ADAPTER, /kind: 'log_truncated'/);
  assert.match(ROUTE, /\.slice\(-50\)/);
  // The subject reaches the log only as a hash, produced by the resolver.
  const resolver = readFileSync(new URL('../lib/platform/microsoft-graph-resolve.ts', import.meta.url), 'utf8');
  assert.match(resolver, /subject_sha256: subjectFingerprint\(row\.subject\)/);
  assert.doesNotMatch(ADAPTER, /message\.body|bodyPreview/);
  assert.doesNotMatch(ROUTE, /body_source|accessToken:.*console/);
  // Errors that do land in the log are bounded.
  assert.match(ADAPTER, /error: why\.slice\(0, 300\)/);
});

/* ── 34–45: regressions — the untouched paths ─────────────────────────────── */

test('34. the live notification path is byte-compatible: no resolved id, strict on its own', async () => {
  await assert.rejects(
    () =>
      ingestMicrosoftGraphMessage(
        { expectedMessageId: MESSAGE_ID, processedAttachmentIds: [], documentsCreated: 0 },
        dependencies({ fetchMessage: async () => message({ id: 'AAMkAG-someone-elses-message' }) }),
      ),
    /returned a different message id/,
  );
});

test('35. a verified resolved id re-points the assertion instead of relaxing it', async () => {
  // With the resolved id supplied, the RESOLVED id is what must come back…
  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      resolvedMessageId: RESOLVED_ID,
      processedAttachmentIds: [],
      documentsCreated: 0,
    },
    dependencies({ fetchMessage: async () => message({ id: RESOLVED_ID }) }),
  );
  assert.equal(result.message.id, RESOLVED_ID);

  // …and the old, dead id is now a mismatch, not a free pass.
  await assert.rejects(
    () =>
      ingestMicrosoftGraphMessage(
        {
          expectedMessageId: MESSAGE_ID,
          resolvedMessageId: RESOLVED_ID,
          processedAttachmentIds: [],
          documentsCreated: 0,
        },
        dependencies({ fetchMessage: async () => message({ id: MESSAGE_ID }) }),
      ),
    /returned a different message id/,
  );
});

test('36. the adapter reads `resolved ?? original` and never rewrites the original', () => {
  assert.match(ADAPTER, /const messageId = resolvedMessageId \|\| originalMessageId;/);
  assert.match(ADAPTER, /THE FETCH LAYER USES `resolved \?\? original`/);
  // The original id is written exactly once — when the notification creates the
  // row — and never again. The processing half of the adapter never names it on
  // the left of an update, and neither does the route.
  const processing = ADAPTER.slice(ADAPTER.indexOf('export async function processMicrosoftGraphEmailIngest'));
  assert.doesNotMatch(processing, /graph_message_id:/);
  assert.equal(ADAPTER.split('graph_message_id: notification.messageId').length - 1, 1);
  const routeUpdate = ROUTE.slice(
    ROUTE.indexOf(".from('email_ingests')\n    .update({"),
    ROUTE.indexOf(".eq('id', ingest.id)"),
  );
  assert.ok(routeUpdate.length > 100, 'the route update payload was found');
  assert.doesNotMatch(routeUpdate, /[^_]graph_message_id:/);
  assert.match(routeUpdate, /pending_reprocess: pendingReprocess/);
  assert.match(ROUTE, /identityPatch\.graph_message_id_resolved = resolution\.messageId;/);
});

test('37. business identity is recorded on every ingest, while the locator still works', () => {
  assert.match(ADAPTER, /internet_message_id: message\.internetMessageId,/);
  assert.match(SQL, /alter table email_ingests add column if not exists internet_message_id text;/);
  // And backfilled the first time a historical row resolves.
  assert.match(ROUTE, /if \(resolution\.internetMessageId && !ingest\.internet_message_id\)/);
});

test('38. superseded documents leave every active review surface, but stay reachable by id', () => {
  const surfaces = [
    '../lib/platform/review-queue.ts',
    '../app/app/docu/page.tsx',
    '../app/app/docu/awaiting/page.tsx',
    '../app/app/docu/review/page.tsx',
    '../app/app/docu/flagged/page.tsx',
    '../app/app/docu/confidence/page.tsx',
    '../app/app/docu/recent/page.tsx',
    '../app/app/docu/reconciliation/page.tsx',
    '../app/app/docu/folder/[key]/page.tsx',
  ];
  for (const surface of surfaces) {
    const source = readFileSync(new URL(surface, import.meta.url), 'utf8');
    assert.match(source, /\.is\('superseded_at', null\)/, `${surface} excludes superseded documents`);
  }
  // The detail page is deliberately NOT filtered — audit needs it reachable.
  const detailPage = readFileSync(new URL('../app/app/docu/[id]/page.tsx', import.meta.url), 'utf8');
  const detailQuery = detailPage.slice(detailPage.indexOf(".from('documents')"), detailPage.indexOf('.maybeSingle()'));
  assert.doesNotMatch(detailQuery, /superseded_at/);
});

test('39. a superseded document is read-only and offers its successor', () => {
  assert.match(DETAIL_PANEL, /if \(doc\.superseded_at\) \{/);
  assert.match(DETAIL_PANEL, /Superseded — reprocessed from an updated source interpretation/);
  assert.match(DETAIL_PANEL, /href=\{`\/app\/docu\/\$\{doc\.superseded_by_document_id\}`\}/);
  // The confirm actions are withheld, not disabled.
  const supersededView = DETAIL_PANEL.slice(
    DETAIL_PANEL.indexOf('if (doc.superseded_at) {'),
    DETAIL_PANEL.indexOf('  return (\n    <div>\n      {/* Header */}'),
  );
  for (const control of ['ApprovalActions', 'PushToButton', 'SendToHubdoc', 'TypePicker', 'FolderPicker', 'ExtractionEditor', 'OrderReviewEditor']) {
    assert.ok(!supersededView.includes(`<${control}`), `${control} is not offered on a superseded document`);
  }
});

test('40. /api/email/retry is untouched and still refuses a done email', () => {
  const retry = readFileSync(new URL('../app/api/email/retry/route.ts', import.meta.url), 'utf8');
  assert.match(retry, /\['queued', 'failed', 'quarantined', 'ignored'\]/);
  assert.doesNotMatch(retry, /supersede|pending_reprocess|reprocess_log/);
});

test('41. no subscription, no ImmutableId cutover, no XLSX work rode along', () => {
  const resolver = readFileSync(new URL('../lib/platform/microsoft-graph-resolve.ts', import.meta.url), 'utf8');
  for (const source of [ROUTE, ADAPTER, MESSAGE_ORDER, CORE, resolver]) {
    assert.doesNotMatch(source, /createMicrosoftGraphInboxSubscription|renewMicrosoftGraphSubscription/);
    assert.doesNotMatch(source, /MICROSOFT_GRAPH_ID_TYPE/);
  }
  // No XLSX support was added: the reprocess path names no spreadsheet type at
  // all, and triage's own extension list is exactly what it was.
  for (const source of [ROUTE, ADAPTER, resolver]) {
    assert.doesNotMatch(source, /xlsx|spreadsheetml/i);
  }
  assert.ok(CORE.includes("new Set(['pdf', 'xls', 'xlsx', 'csv', 'doc', 'docx', 'txt', 'rtf', 'eml', 'html', 'htm'])"));
  const graphCore = readFileSync(new URL('../lib/platform/microsoft-graph-core.ts', import.meta.url), 'utf8');
  // The default is still the mutable REST id; nothing opted the tenant in.
  assert.match(graphCore, /if \(!configured \|\| configured === 'rest_id' \|\| configured === 'mutable'\) return 'rest_id';/);
});

test('42. the migration is additive and idempotent in the file\'s existing guarded style', () => {
  assert.match(SQL, /alter table email_ingests add column if not exists graph_message_id_resolved text;/);
  assert.match(SQL, /alter table email_ingests add column if not exists reprocess_log jsonb not null default '\[\]'::jsonb;/);
  assert.match(SQL, /alter table email_ingests add column if not exists pending_reprocess jsonb;/);
  assert.match(SQL, /alter table documents add column if not exists superseded_at timestamptz;/);
  assert.match(SQL, /alter table documents add column if not exists superseded_by_document_id uuid references documents\(id\);/);
  assert.match(SQL, /alter table documents add column if not exists supersedes_document_id uuid references documents\(id\);/);
  assert.match(SQL, /alter table documents add column if not exists supersede_reason text;/);
  assert.match(SQL, /if not exists \(\s*\n\s*select 1 from pg_constraint where conname = 'email_ingests_reprocess_log_array_check'/);
  // The index recreate is explicit, because `if not exists` alone would not widen it.
  assert.match(SQL, /drop index if exists documents_ingest_attachment_uidx;/);
  // The original idempotency key is untouched.
  assert.match(SQL, /on email_ingests \(org_id, graph_message_id\)/);
});

test('43. the existing-copy queries agree with the index on what "the existing copy" means', () => {
  const activeChecks = DOCUMENT_INGEST.split(".is('superseded_at', null)").length - 1;
  assert.equal(activeChecks, 3, 'the pre-flight check, the race winner and the supersede mark');
  assert.match(ADAPTER, /A SUPERSEDED DOCUMENT IS NOT A CURRENT COPY/);
  assert.match(ADAPTER, /\.is\('superseded_at', null\)/);
});

test('44. the worker still selects everything the Graph adapter needs, and claims the same way', () => {
  assert.match(WORKER, /graph_message_id, graph_message_id_resolved, graph_id_type, pending_reprocess, status/);
  // The CAS claim is unchanged.
  assert.match(WORKER, /\.or\(`status\.eq\.queued,and\(status\.eq\.processing,claimed_at\.lt\.\$\{staleBefore\}\)`\)/);
  assert.match(WORKER, /if \(ingest\.status !== 'queued' && ingest\.status !== 'processing'\) return;/);
  // The route re-queues with exactly the retry route's semantics.
  assert.match(ROUTE, /status: 'queued',\s*\n\s*error: null,\s*\n\s*attempts: 0,/);
  assert.match(ROUTE, /await processEmailIngest\(client, ingest\.id\)/);
});

test('45. nothing on the reprocess path fetches a URL, and no Graph write exists', () => {
  const resolver = readFileSync(new URL('../lib/platform/microsoft-graph-resolve.ts', import.meta.url), 'utf8');
  for (const source of [resolver, CORE, MESSAGE_ORDER]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /XMLHttpRequest|https?\.request|node-fetch|axios/);
  }
  // The route's only outbound calls are the injected GET-only Graph readers.
  assert.doesNotMatch(ROUTE, /\bfetch\s*\(/);
  assert.match(ROUTE, /fetchMicrosoftGraphMessage/);
  assert.match(ROUTE, /findMicrosoftGraphMessagesByInternetMessageId/);
  assert.match(ROUTE, /findMicrosoftGraphMessagesByConversationId/);
});

/* ── 46–56: supersede through a RECONCILED canonical document ─────────────── */

/**
 * THE FOUR SEASONS CASE. A supersede targeting 'email-body' on a message whose
 * order lives in an html attachment: Wave B reconciles the body INTO the
 * attachment's canonical order, so the body never files a document of its own
 * and the old body document has no same-source successor to be replaced by.
 */
const FOUR_SEASONS_INGEST = '9a22091f-0000-4000-8000-000000000001';
const OLD_BODY_DOCUMENT = '2feea9da-0000-4000-8000-000000000002';
const HTML_ORDER_DOCUMENT = '1823e3fd-0000-4000-8000-000000000003';

const RECONCILIATION_TARGET = readFileSync(
  new URL('../lib/platform/supersede-reconciliation-target.ts', import.meta.url),
  'utf8',
);

function orderEvidence(overrides: Partial<MessageOrderEvidence> = {}): MessageOrderEvidence {
  return {
    primary_source: 'attachment',
    body_source_part_id: 'email-body',
    attachment_source_ids: ['html-1'],
    fields: {},
    lines: [],
    conflicts: [],
    requires_review: false,
    multiple_order_sources: false,
    ...overrides,
  };
}

/** The html attachment's canonical order, AFTER the body reconciled into it. */
function reconciledCandidate(overrides: Partial<SupersedeCandidateRow> = {}): SupersedeCandidateRow {
  return {
    id: HTML_ORDER_DOCUMENT,
    email_ingest_id: FOUR_SEASONS_INGEST,
    source_attachment_id: 'html-1',
    status: 'extracted',
    superseded_at: null,
    supersedes_document_id: null,
    extracted_data: { message_order_evidence: orderEvidence({ primary_source: 'combined' }) },
    ...overrides,
  };
}

function decide(
  overrides: Partial<Parameters<typeof selectReconciliationSupersedeTarget>[0]> = {},
) {
  return selectReconciliationSupersedeTarget({
    targetSource: 'email-body',
    emailIngestId: FOUR_SEASONS_INGEST,
    oldDocumentId: OLD_BODY_DOCUMENT,
    reconciledDocumentId: HTML_ORDER_DOCUMENT,
    candidates: [reconciledCandidate()],
    ...overrides,
  });
}

/** A message whose body carries the order AND which has an html attachment. */
const reconcilingMessage = message({
  hasAttachments: true,
  subject: 'Order for Tuesday',
  body: { contentType: 'text', content: 'Please deliver 6 kg carrots and 2 boxes tomatoes. PO 4471' },
  bodyPreview: 'Please deliver 6 kg carrots',
});

test('46. the body reconciles into the attachment order, and the core reports which document', async () => {
  let bodyDocuments = 0;
  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      // Both sources are already filed — this is a controlled reprocess of one.
      processedAttachmentIds: ['html-1', 'email-body'],
      documentsCreated: 2,
      existingOrderDocuments: [{ documentId: HTML_ORDER_DOCUMENT, attachmentId: 'html-1' }],
      reprocessSources: ['email-body'],
    },
    dependencies({
      fetchMessage: async () => reconcilingMessage,
      ingestBodyOrder: async () => {
        bodyDocuments += 1;
        return { ok: true, documentId: 'body-document-2', documentType: 'order' };
      },
    }),
  );
  assert.equal(bodyDocuments, 0, 'the body files no document of its own');
  assert.deepEqual(result.reconciledSourceDocumentIds, { 'email-body': HTML_ORDER_DOCUMENT });
  // NO THIRD DOCUMENT: the count is exactly what it was.
  assert.equal(result.documentsCreated, 2);
  assert.deepEqual([...result.processedAttachmentIds].sort(), ['email-body', 'html-1']);
});

test('47. a body that files its OWN document reports no reconciliation at all', async () => {
  const result = await ingestMicrosoftGraphMessage(
    {
      expectedMessageId: MESSAGE_ID,
      processedAttachmentIds: ['email-body'],
      documentsCreated: 1,
      reprocessSources: ['email-body'],
    },
    dependencies({
      fetchMessage: async () => message({
        hasAttachments: false,
        subject: 'Order for Tuesday',
        body: { contentType: 'text', content: 'Please deliver 6 kg carrots and 2 boxes tomatoes. PO 4471' },
        bodyPreview: 'Please deliver 6 kg carrots',
      }),
      listAttachments: async () => [],
    }),
  );
  // The direct-successor lane is the one that ran; nothing was absorbed.
  assert.deepEqual(result.reconciledSourceDocumentIds, {});
});

test('48. the reconciled document becomes the supersede target under all five conditions', () => {
  assert.deepEqual(decide(), { outcome: 'reconciled', documentId: HTML_ORDER_DOCUMENT });
});

test('49. the replacement must EXPLICITLY carry the targeted source, or there is none', () => {
  // An attachment-only reading is not evidence that the body was absorbed.
  assert.deepEqual(
    decide({ candidates: [reconciledCandidate({ extracted_data: { message_order_evidence: orderEvidence() } })] }),
    {
      outcome: 'no_replacement',
      why: 'No active document on this email records the targeted source as contributing evidence.',
    },
  );
  // Neither is a missing evidence object, or a missing extraction entirely.
  for (const extracted of [{ message_order_evidence: null }, null]) {
    assert.equal(decide({ candidates: [reconciledCandidate({ extracted_data: extracted })] }).outcome, 'no_replacement');
  }
  // `body_source_part_id` is the constant 'email-body' on EVERY evidence object
  // ever written, so it can never be the marker.
  assert.equal(carriesTargetedSourceProvenance(orderEvidence(), 'email-body'), false);
  assert.equal(carriesTargetedSourceProvenance(orderEvidence({ primary_source: 'combined' }), 'email-body'), true);
  assert.equal(carriesTargetedSourceProvenance(orderEvidence({ primary_source: 'email_body' }), 'email-body'), false);
  // An attachment target is carried by the id list, not by primary_source.
  assert.equal(carriesTargetedSourceProvenance(orderEvidence({ primary_source: 'combined' }), 'html-1'), true);
  assert.equal(carriesTargetedSourceProvenance(orderEvidence(), 'html-9'), false);
  assert.equal(carriesTargetedSourceProvenance(null, 'email-body'), false);
});

test('50. two plausible candidates are a fail-closed refusal with its own outcome', () => {
  const second = reconciledCandidate({ id: 'doc-second-order', source_attachment_id: 'html-2' });
  const decision = decide({ candidates: [reconciledCandidate(), second] });
  assert.equal(decision.outcome, 'ambiguous_replacement');
  assert.deepEqual(
    decision.outcome === 'ambiguous_replacement' ? decision.candidateIds : [],
    [HTML_ORDER_DOCUMENT, 'doc-second-order'],
  );
  // And it is NOT the reconciled outcome, so the old document is never archived.
  assert.notEqual(decision.outcome, 'reconciled');
});

test('51. a candidate from another email ingest is rejected', () => {
  assert.equal(
    decide({ candidates: [reconciledCandidate({ email_ingest_id: 'some-other-ingest' })] }).outcome,
    'no_replacement',
  );
  // Including when the id is simply absent.
  assert.equal(
    decide({ candidates: [reconciledCandidate({ email_ingest_id: null })] }).outcome,
    'no_replacement',
  );
});

test('52. without THIS run\'s reconciliation, nothing is superseded — no blind discovery', () => {
  assert.deepEqual(decide({ reconciledDocumentId: null }), {
    outcome: 'no_replacement',
    why: 'The targeted source was not reconciled into another document in this run.',
  });
  // A perfect-looking candidate that is not the one the run reconciled into is
  // still refused: the conditions verify the core's answer, they do not search.
  assert.deepEqual(decide({ reconciledDocumentId: 'doc-some-other-order' }), {
    outcome: 'no_replacement',
    why: 'The document carrying the targeted source is not the one this run reconciled into.',
  });
});

test('53. the old document, an archived one, an unusable one and the direct successor are never chosen', () => {
  // The document being replaced can never replace itself.
  assert.equal(decide({ candidates: [reconciledCandidate({ id: OLD_BODY_DOCUMENT })] }).outcome, 'no_replacement');
  // An archived or not-yet-reviewable document is not a replacement.
  assert.equal(decide({ candidates: [reconciledCandidate({ superseded_at: '2026-08-30T00:00:00Z' })] }).outcome, 'no_replacement');
  for (const status of ['pending', 'error', 'ignored']) {
    assert.equal(decide({ candidates: [reconciledCandidate({ status })] }).outcome, 'no_replacement');
  }
  assert.equal(decide({ candidates: [reconciledCandidate({ status: 'approved' })] }).outcome, 'reconciled');
  // A document of the TARGETED source itself belongs to the direct-successor
  // path (Belair), which this fallback never reaches into.
  assert.equal(
    decide({ candidates: [reconciledCandidate({ source_attachment_id: 'email-body' })] }).outcome,
    'no_replacement',
  );
  // And a document that already records a predecessor keeps it.
  assert.deepEqual(decide({ candidates: [reconciledCandidate({ supersedes_document_id: 'doc-earlier' })] }), {
    outcome: 'no_replacement',
    why: 'The reconciled document already records a superseded predecessor.',
  });
});

test('54. the fallback runs only when the direct successor did not, and creates NO document', () => {
  // The direct-successor path is untouched: the fallback is gated behind it.
  assert.match(
    ADAPTER,
    /if \(supersedeTarget && !supersedeNewDocumentId && supersedeOldDocumentId\) \{/,
  );
  // The run's own answer is threaded through; there is no re-query for it.
  assert.match(ADAPTER, /reconciledDocumentId: result\.reconciledSourceDocumentIds\[supersedeTarget\] \?\? null,/);
  assert.match(CORE, /reconciledSourceDocumentIds\['email-body'\] = bodyResult\.documentId;/);
  // NEVER A THIRD DOCUMENT: the fallback only ever updates supersede columns.
  const fallback = ADAPTER.slice(
    ADAPTER.indexOf('async function supersedeThroughReconciledDocument'),
    ADAPTER.indexOf('Persist the provider event before acknowledging Graph'),
  );
  assert.ok(fallback.length > 500, 'the fallback was found');
  assert.doesNotMatch(fallback, /\.insert\(|ingestDocument|ingestBodyOrder|ingestHtmlAttachmentOrder/);
  assert.doesNotMatch(fallback, /\.delete\(/);
  // Both rows already exist; the whole operation is the two links between them.
  assert.match(fallback, /\.update\(\{ supersedes_document_id: input\.oldDocumentId \}\)/);
  assert.match(fallback, /superseded_by_document_id: decision\.documentId,/);
});

test('55. the two writes are ordered link-first, guarded, and compensated', () => {
  const fallback = ADAPTER.slice(
    ADAPTER.indexOf('async function supersedeThroughReconciledDocument'),
    ADAPTER.indexOf('Persist the provider event before acknowledging Graph'),
  );
  const link = fallback.indexOf('.update({ supersedes_document_id: input.oldDocumentId })');
  const archive = fallback.indexOf('superseded_by_document_id: decision.documentId,');
  const compensate = fallback.indexOf('.update({ supersedes_document_id: null })');
  assert.ok(link > 0 && archive > link, 'the successor link is written before the old row is archived');
  assert.ok(compensate > archive, 'and undone if the archive write does not land');
  // The candidate read and both writes are guarded on the ACTIVE row, so a
  // racing worker wins instead of being overwritten.
  assert.equal(fallback.split(".is('superseded_at', null)").length - 1, 3);
  assert.match(fallback, /\.is\('supersedes_document_id', null\)/);
  assert.match(fallback, /\.eq\('supersedes_document_id', input\.oldDocumentId\)/);
  // The compensation restores the state this feature protects: an ACTIVE old
  // document, never an archived one with no successor.
  assert.match(fallback, /COMPENSATION\. The old document was never archived/);
  // A completed cross-source supersede is then permanent — the reclaim
  // compensator recognises the replacement through the archived row's own link.
  assert.match(ADAPTER, /const successor = sameSourceSuccessor \?\? \(await reconciledSuccessor\(row\)\);/);
  assert.match(ADAPTER, /successor && successor\.supersedes_document_id === row\.id \? successor : null/);
  assert.match(ADAPTER, /A SUCCESSOR IS NOT ALWAYS A ROW OF THE SAME SOURCE/);
  // And only a same-source replacement is ever parked.
  assert.match(ADAPTER, /if \(sameSourceSuccessor && sameSourceSuccessor\.superseded_at === null\) \{/);
});

test('56. the audit records the new outcomes with both ids, and the repeat is refused', () => {
  assert.match(ADAPTER, /let supersedeOutcome: SupersedeOutcome = supersedeNewDocumentId \? 'superseded' : 'no_replacement';/);
  assert.match(ADAPTER, /new_document_id: supersedeReplacementId,/);
  assert.match(ADAPTER, /outcome: supersedeOutcome,/);
  assert.match(TYPES, /\| 'superseded_via_reconciliation'/);
  assert.match(TYPES, /\| 'ambiguous_replacement'/);
  // A supersede that succeeded through a reconciled document leaves the targeted
  // source with no active document of its own, so the repeat is refused on the
  // completed audit entry instead of on the active copy.
  assert.match(ROUTE, /entry\.outcome === 'superseded_via_reconciliation' &&/);
  assert.match(ROUTE, /\(!active && alreadyReconciled\)/);
  assert.match(ROUTE, /That source has already been superseded for this reason; nothing was changed\./);
  // The decision module itself reaches nothing: no client, no clock, no I/O.
  assert.doesNotMatch(RECONCILIATION_TARGET, /supabase|fetch\(|Date\.now|new Date\(/);
});
