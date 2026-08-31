import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  exactMessageMatches,
  resolveStaleGraphMessageId,
  sameFromAddress,
  sameReceivedInstant,
  sameSubjectExact,
  subjectFingerprint,
  type MicrosoftGraphResolveDependencies,
  type StaleGraphIngestRow,
} from '../lib/platform/microsoft-graph-resolve.ts';
import {
  MicrosoftGraphHttpError,
  findMicrosoftGraphMessagesByConversationId,
  findMicrosoftGraphMessagesByInternetMessageId,
  isMicrosoftGraphItemNotFound,
  type MicrosoftGraphMessageContent,
  type MicrosoftGraphMessageLocatorCandidate,
} from '../lib/platform/microsoft-graph-core.ts';

/**
 * RE-RESOLUTION OF A DEAD PROVIDER LOCATOR.
 *
 * Every fixture below is SYNTHETIC. The shapes are the ones the live forensics
 * established — a lowercased stored sender against Graph's original header
 * casing, a '+00:00' stored timestamp against Graph's 'Z', subjects that carry
 * meaningful trailing whitespace — but no address, subject or id here belongs to
 * a real message, nothing calls Microsoft, and nothing touches a database.
 */

const DEAD_ID = 'AAMkAG-dead-rest-id';
const LIVE_ID = 'AAMkAG-live-rest-id';
const CONVERSATION_ID = 'AAQkADAwATM3ZmYAZS0yMD/kJA=';
const INTERNET_ID = '<CY4PR01MB12345678@example.namprd01.prod.outlook.com>';

/** Vyso's stored copy: sender lowercased on the way in, timestamp with +00:00. */
function ingestRow(overrides: Partial<StaleGraphIngestRow> = {}): StaleGraphIngestRow {
  return {
    id: '0d3f7f0a-1111-4222-8333-444455556666',
    org_id: 'org-1',
    mailbox: 'orders@example.co.za',
    graph_message_id: DEAD_ID,
    graph_message_id_resolved: null,
    internet_message_id: null,
    graph_conversation_id: CONVERSATION_ID,
    received_at: '2026-08-11T06:03:44+00:00',
    from_email: 'chefthabo@example.co.za',
    subject: 'Order for Tuesday ',
    ...overrides,
  };
}

/** Graph's copy: original header casing, a 'Z' suffix, subject verbatim. */
function candidate(
  overrides: Partial<MicrosoftGraphMessageLocatorCandidate> = {},
): MicrosoftGraphMessageLocatorCandidate {
  return {
    id: LIVE_ID,
    subject: 'Order for Tuesday ',
    from: { name: 'Chef Thabo', address: 'ChefThabo@example.co.za' },
    receivedDateTime: '2026-08-11T06:03:44Z',
    hasAttachments: true,
    conversationId: CONVERSATION_ID,
    internetMessageId: INTERNET_ID,
    ...overrides,
  };
}

function content(
  overrides: Partial<MicrosoftGraphMessageContent> = {},
): MicrosoftGraphMessageContent {
  const base = candidate();
  return {
    ...base,
    internetMessageId: base.internetMessageId,
    body: { contentType: 'html', content: '<p>Order</p>' },
    bodyPreview: 'Order',
    ...overrides,
  };
}

function itemNotFound(): MicrosoftGraphHttpError {
  return new MicrosoftGraphHttpError({
    operation: 'message-read',
    httpStatus: 404,
    graphCode: 'ErrorItemNotFound',
    detail: 'The specified object was not found in the store.',
  });
}

function dependencies(
  overrides: Partial<MicrosoftGraphResolveDependencies> = {},
): MicrosoftGraphResolveDependencies {
  return {
    fetchMessage: async () => {
      throw itemNotFound();
    },
    findByInternetMessageId: async () => [],
    findByConversationId: async () => [],
    ...overrides,
  };
}

/* ── 1–10: the stale-id algorithm ─────────────────────────────────────────── */

test('1. a stored id that still resolves is a no-op, and searches nothing', async () => {
  let searches = 0;
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async (messageId) => {
        assert.equal(messageId, DEAD_ID);
        return content({ id: DEAD_ID });
      },
      findByInternetMessageId: async () => {
        searches += 1;
        return [];
      },
      findByConversationId: async () => {
        searches += 1;
        return [];
      },
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'current');
  assert.equal(searches, 0, 'a live id must never start a mailbox search');
});

test('2. an internet message id resolves the locator in one filtered lookup', async () => {
  let conversationSearches = 0;
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async (messageId) => {
        if (messageId === DEAD_ID) throw itemNotFound();
        return content({ id: messageId });
      },
      findByInternetMessageId: async (value) => {
        assert.equal(value, INTERNET_ID);
        return [candidate()];
      },
      findByConversationId: async () => {
        conversationSearches += 1;
        return [];
      },
    }),
    ingestRow({ internet_message_id: INTERNET_ID }),
  );
  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  assert.equal(result.method, 'internet_message_id');
  assert.equal(result.messageId, LIVE_ID);
  assert.equal(result.originalMessageId, DEAD_ID);
  assert.equal(conversationSearches, 0, 'the business identity short-circuits the thread search');
});

test('3. an internet message id with no hit fails closed', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({ findByInternetMessageId: async () => [] }),
    ingestRow({ internet_message_id: INTERNET_ID }),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'internet_message_id_not_found');
  assert.equal(result.candidateCount, 0);
});

test('4. two messages sharing one internet message id fail closed with the count', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      findByInternetMessageId: async () => [candidate(), candidate({ id: 'AAMkAG-duplicate' })],
    }),
    ingestRow({ internet_message_id: INTERNET_ID }),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'internet_message_id_ambiguous');
  assert.equal(result.candidateCount, 2);
});

test('5. a historical row resolves through the conversation + exact match, and backfills its identity', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async (messageId) => {
        if (messageId === DEAD_ID) throw itemNotFound();
        return content({ id: messageId });
      },
      findByConversationId: async (value) => {
        assert.equal(value, CONVERSATION_ID);
        return [candidate()];
      },
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  assert.equal(result.method, 'conversation_exact_match');
  assert.equal(result.messageId, LIVE_ID);
  assert.equal(result.internetMessageId, INTERNET_ID, 'the identity is captured for the next time');
});

test('6. one message is picked out of a real thread of replies and forwards', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async (messageId) => {
        if (messageId === DEAD_ID) throw itemNotFound();
        return content({ id: messageId });
      },
      findByConversationId: async () => [
        // The reply: same conversation, same subject, different instant.
        candidate({ id: 'AAMkAG-reply', receivedDateTime: '2026-08-11T07:41:02Z' }),
        // The original.
        candidate(),
        // A forward from someone else in the same thread.
        candidate({
          id: 'AAMkAG-forward',
          from: { name: 'Buyer', address: 'buyer@example.co.za' },
          receivedDateTime: '2026-08-11T06:03:44Z',
        }),
      ],
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  assert.equal(result.messageId, LIVE_ID);
});

test('7. a subject match alone is never sufficient', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      findByConversationId: async () => [
        // Same subject, same conversation, WRONG sender.
        candidate({ id: 'AAMkAG-other', from: { name: 'Someone', address: 'someone@example.co.za' } }),
      ],
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'conversation_no_exact_match');
});

test('8. a conversation match alone is never sufficient', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      findByConversationId: async () => [
        // Same conversation, same sender, WRONG instant and subject.
        candidate({ id: 'AAMkAG-later', subject: 'RE: Order for Tuesday', receivedDateTime: '2026-08-12T09:00:00Z' }),
      ],
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'conversation_no_exact_match');
});

test('9. two exact matches fail closed with the survivor count', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      findByConversationId: async () => [candidate(), candidate({ id: 'AAMkAG-duplicate-delivery' })],
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'conversation_ambiguous');
  assert.equal(result.candidateCount, 2);
});

test('10. a row with neither an internet id nor a conversation id fails closed', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies(),
    ingestRow({ graph_conversation_id: null }),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'no_conversation_id');
});

/* ── 11–13: mailbox and blast-radius safety ───────────────────────────────── */

test('11. a row with no mailbox is refused before any Graph call is made', async () => {
  let calls = 0;
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async () => {
        calls += 1;
        throw itemNotFound();
      },
    }),
    ingestRow({ mailbox: '   ' }),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'missing_mailbox');
  assert.equal(calls, 0);
});

test('12. a transient Graph fault propagates and never becomes a search', async () => {
  let searches = 0;
  await assert.rejects(
    () =>
      resolveStaleGraphMessageId(
        dependencies({
          fetchMessage: async () => {
            throw new MicrosoftGraphHttpError({
              operation: 'message-read',
              httpStatus: 429,
              graphCode: 'TooManyRequests',
            });
          },
          findByConversationId: async () => {
            searches += 1;
            return [];
          },
        }),
        ingestRow(),
      ),
    /HTTP 429/,
  );
  assert.equal(searches, 0, 'throttling is not evidence that a message moved');
});

test('13. the resolver reads one mailbox, GET-only, with no folder enumeration', () => {
  const resolver = readFileSync(new URL('../lib/platform/microsoft-graph-resolve.ts', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../lib/platform/microsoft-graph-core.ts', import.meta.url), 'utf8');
  // The resolver owns no transport at all: no fetch, no client, no URL.
  assert.doesNotMatch(resolver, /\bfetch\s*\(/);
  assert.doesNotMatch(resolver, /mailFolders/);
  assert.doesNotMatch(resolver, /SupabaseClient|\.from\(['"]/);
  // And the two searches it drives are GET, filtered, and bounded.
  assert.match(core, /operation: 'message-search'/);
  assert.match(core, /\$filter/);
  assert.match(core, /const MAX_LOCATOR_CANDIDATES = 50/);
  const searchBody = core.slice(
    core.indexOf('async function searchMicrosoftGraphMessages'),
    core.indexOf('/** Locate a message by its RFC business identity'),
  );
  assert.ok(searchBody.length > 200, 'the search helper was found');
  assert.match(searchBody, /method: 'GET'/);
  for (const method of [/method: 'POST'/, /method: 'PATCH'/, /method: 'DELETE'/]) {
    assert.doesNotMatch(searchBody, method);
  }
});

/* ── the two live-forensics amendments ────────────────────────────────────── */

test('46. a lowercased stored sender still matches Graph\'s original header casing', () => {
  // Three of the five real candidates would have failed closed without this: the
  // pipeline lowercases on the way in, Graph does not.
  assert.equal(sameFromAddress('chefthabo@example.co.za', 'ChefThabo@example.co.za'), true);
  assert.equal(sameFromAddress('gerard.vingerling@example.com', 'Gerard.Vingerling@example.com'), true);
  assert.equal(sameFromAddress('belair@example.co.za', ' Belair@example.co.za '), true);
  // It is still an address comparison, not a fuzzy one.
  assert.equal(sameFromAddress('chefthabo@example.co.za', 'chef.thabo@example.co.za'), false);
  assert.equal(sameFromAddress(null, 'someone@example.co.za'), false);
  assert.equal(sameFromAddress('someone@example.co.za', null), false);
});

test('47. a stored +00:00 timestamp still matches Graph\'s Z suffix', () => {
  assert.equal(sameReceivedInstant('2026-08-11T06:03:44+00:00', '2026-08-11T06:03:44Z'), true);
  // Same instant, written in another offset. Still the same message.
  assert.equal(sameReceivedInstant('2026-08-11T08:03:44+02:00', '2026-08-11T06:03:44Z'), true);
  // One second apart is a different message.
  assert.equal(sameReceivedInstant('2026-08-11T06:03:44+00:00', '2026-08-11T06:03:45Z'), false);
  assert.equal(sameReceivedInstant('not a date', '2026-08-11T06:03:44Z'), false);
  assert.equal(sameReceivedInstant(null, '2026-08-11T06:03:44Z'), false);
});

test('48. the subject is compared byte-for-byte, trailing space included', () => {
  assert.equal(sameSubjectExact('Order for Tuesday ', 'Order for Tuesday '), true);
  // The trailing space is real evidence; dropping it is a different subject.
  assert.equal(sameSubjectExact('Order for Tuesday ', 'Order for Tuesday'), false);
  // So are doubled internal spaces.
  assert.equal(sameSubjectExact('PO  4471', 'PO 4471'), false);
  // Case is not folded either.
  assert.equal(sameSubjectExact('Order', 'order'), false);
  // The store truncates at 500; the comparison reproduces that truncation
  // exactly rather than loosening the test.
  const long = 'x'.repeat(600);
  assert.equal(sameSubjectExact(long.slice(0, 500), long), true);
  assert.equal(sameSubjectExact(null, 'Order'), false);
});

test('49. the whole thread survives the amended match, but only the right message', () => {
  const row = ingestRow();
  const survivors = exactMessageMatches(row, [
    candidate(),
    candidate({ id: 'a', receivedDateTime: '2026-08-11T06:03:45Z' }),
    candidate({ id: 'b', subject: 'Order for Tuesday' }),
    candidate({ id: 'c', from: { name: 'X', address: 'x@example.co.za' } }),
  ]);
  assert.deepEqual(survivors.map((entry) => entry.id), [LIVE_ID]);
});

/* ── missing evidence, verification, and the audit shape ──────────────────── */

test('50. a row missing any one match field fails closed rather than matching on the rest', async () => {
  for (const [overrides, reason] of [
    [{ subject: null }, 'missing_stored_subject'],
    [{ received_at: null }, 'missing_stored_received_at'],
    [{ from_email: null }, 'missing_stored_from'],
  ] as const) {
    const result = await resolveStaleGraphMessageId(
      dependencies({ findByConversationId: async () => [candidate()] }),
      ingestRow(overrides),
    );
    assert.equal(result.status, 'unresolved');
    if (result.status !== 'unresolved') continue;
    assert.equal(result.reason, reason);
  }
});

test('51. a resolved id that does not fetch back as itself is not a resolution', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async (messageId) => {
        if (messageId === DEAD_ID) throw itemNotFound();
        // Exchange answered with a different message than the one requested.
        return content({ id: 'AAMkAG-something-else' });
      },
      findByConversationId: async () => [candidate()],
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'resolved_id_did_not_verify');
});

test('52. a verify GET that 404s is a refusal, not a crash', async () => {
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async () => {
        throw itemNotFound();
      },
      findByConversationId: async () => [candidate()],
    }),
    ingestRow(),
  );
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'resolved_id_did_not_verify');
});

test('53. the audit evidence carries a subject HASH, never the subject', async () => {
  const row = ingestRow();
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async (messageId) => {
        if (messageId === DEAD_ID) throw itemNotFound();
        return content({ id: messageId });
      },
      findByConversationId: async () => [candidate()],
    }),
    row,
  );
  assert.equal(result.status, 'resolved');
  if (result.status !== 'resolved') return;
  const serialised = JSON.stringify(result.evidence);
  assert.ok(!serialised.includes('Order for Tuesday'), 'no subject text in the audit evidence');
  assert.equal(result.evidence.subject_sha256, subjectFingerprint(row.subject));
  assert.match(result.evidence.subject_sha256 ?? '', /^[0-9a-f]{64}$/);
  assert.equal(result.evidence.from, 'chefthabo@example.co.za');
});

test('54. an already-resolved row retries its RESOLVED locator, never the dead original', async () => {
  const tried: string[] = [];
  const result = await resolveStaleGraphMessageId(
    dependencies({
      fetchMessage: async (messageId) => {
        tried.push(messageId);
        return content({ id: messageId });
      },
    }),
    ingestRow({ graph_message_id_resolved: LIVE_ID }),
  );
  assert.deepEqual(tried, [LIVE_ID]);
  assert.equal(result.status, 'current');
});

test('55. a row with no message id at all is refused', async () => {
  const result = await resolveStaleGraphMessageId(dependencies(), ingestRow({ graph_message_id: null }));
  assert.equal(result.status, 'unresolved');
  if (result.status !== 'unresolved') return;
  assert.equal(result.reason, 'missing_message_id');
});

/* ── the transport the resolver is given ──────────────────────────────────── */

test('56. ErrorItemNotFound is the ONLY error that may start a search', () => {
  assert.equal(isMicrosoftGraphItemNotFound(itemNotFound()), true);
  assert.equal(
    isMicrosoftGraphItemNotFound(
      new MicrosoftGraphHttpError({ operation: 'message-read', httpStatus: 404, graphCode: null }),
    ),
    true,
  );
  assert.equal(
    isMicrosoftGraphItemNotFound(
      new MicrosoftGraphHttpError({ operation: 'message-read', httpStatus: 429, graphCode: 'TooManyRequests' }),
    ),
    false,
  );
  assert.equal(
    isMicrosoftGraphItemNotFound(
      new MicrosoftGraphHttpError({ operation: 'message-read', httpStatus: 503, graphCode: 'ServiceUnavailable' }),
    ),
    false,
  );
  assert.equal(isMicrosoftGraphItemNotFound(new Error('boom')), false);
});

test('57. both filtered searches are GET, encode their value, and escape quotes', async () => {
  const seen: { url: string; method: string | undefined; headers: Record<string, string> }[] = [];
  const fakeFetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    seen.push({
      url: String(input),
      method: init?.method,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  await findMicrosoftGraphMessagesByInternetMessageId(
    { accessToken: 'token', mailbox: 'orders@example.co.za', internetMessageId: INTERNET_ID },
    fakeFetch,
  );
  await findMicrosoftGraphMessagesByConversationId(
    { accessToken: 'token', mailbox: 'orders@example.co.za', conversationId: CONVERSATION_ID },
    fakeFetch,
  );

  assert.equal(seen.length, 2);
  for (const call of seen) {
    assert.equal(call.method, 'GET');
    assert.match(call.url, /^https:\/\/graph\.microsoft\.com\/v1\.0\/users\/orders%40example\.co\.za\/messages\?/);
    assert.match(call.url, /%24select=/);
    assert.match(call.url, /%24top=/);
    // No ConsistencyLevel and no $count: the live tenant needs neither.
    assert.ok(!('consistencylevel' in call.headers), 'no ConsistencyLevel header is required');
    assert.ok(!call.url.includes('%24count'), 'no $count is requested');
  }
  // '<', '>' and '@' in the Message-ID, and '=' in the conversation id, all
  // survive percent-encoding rather than terminating the query string.
  const internetUrl = new URL(seen[0].url);
  assert.equal(internetUrl.searchParams.get('$filter'), `internetMessageId eq '${INTERNET_ID}'`);
  const conversationUrl = new URL(seen[1].url);
  assert.equal(conversationUrl.searchParams.get('$filter'), `conversationId eq '${CONVERSATION_ID}'`);

  // An apostrophe is DOUBLED, so it cannot terminate the OData literal early.
  await findMicrosoftGraphMessagesByConversationId(
    { accessToken: 'token', mailbox: 'orders@example.co.za', conversationId: "it's-a-thread" },
    fakeFetch,
  );
  assert.equal(new URL(seen[2].url).searchParams.get('$filter'), "conversationId eq 'it''s-a-thread'");
});

test('58. the single-message read selects internetMessageId and still asserts the id it asked for', () => {
  const core = readFileSync(new URL('../lib/platform/microsoft-graph-core.ts', import.meta.url), 'utf8');
  assert.match(core, /hasAttachments,conversationId,internetMessageId/);
  // The id-echo assertion is unchanged: the expected id is the id requested.
  assert.match(core, /if \(!metadata \|\| metadata\.id !== messageId\)/);
});
