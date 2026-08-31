import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MICROSOFT_GRAPH_MESSAGE_FIELDS,
  MICROSOFT_GRAPH_SCOPE,
  MicrosoftGraphHttpError,
  acquireMicrosoftGraphAppToken,
  createMicrosoftGraphInboxSubscription,
  downloadMicrosoftGraphFileAttachment,
  fetchMicrosoftGraphAttachmentMetadata,
  fetchMicrosoftGraphMessage,
  fetchRecentMicrosoftGraphInboxMessages,
  getMicrosoftGraphSubscription,
  microsoftGraphIdTypeFromConfig,
  microsoftGraphInboxSubscriptionResource,
  microsoftGraphRenewalDecision,
  renewMicrosoftGraphSubscription,
  runMicrosoftGraphSubscriptionRenewal,
} from '../lib/platform/microsoft-graph-core.ts';

test('app token request uses client credentials and the Graph .default scope', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json({ access_token: 'test-access-token', expires_in: 3599, token_type: 'Bearer' });
  };

  const token = await acquireMicrosoftGraphAppToken(
    { tenantId: 'tenant-id', clientId: 'client-id', clientSecret: 'client-secret' },
    fetchMock,
  );

  assert.equal(requestedUrl, 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
  assert.equal(requestedInit?.method, 'POST');
  assert.equal(
    new Headers(requestedInit?.headers).get('content-type'),
    'application/x-www-form-urlencoded',
  );
  const body = new URLSearchParams(String(requestedInit?.body));
  assert.equal(body.get('client_id'), 'client-id');
  assert.equal(body.get('client_secret'), 'client-secret');
  assert.equal(body.get('scope'), MICROSOFT_GRAPH_SCOPE);
  assert.equal(body.get('grant_type'), 'client_credentials');
  assert.deepEqual(token, {
    accessToken: 'test-access-token',
    expiresInSeconds: 3599,
    tokenType: 'Bearer',
    httpStatus: 200,
  });
});

test('token errors expose status and code without exposing configured secrets', async () => {
  const secret = 'never-print-this-secret';
  const fetchMock: typeof fetch = async () =>
    Response.json(
      {
        error: 'invalid_client',
        error_description: `Credential ${secret} is invalid`,
        correlation_id: 'correlation-123',
      },
      { status: 401 },
    );

  await assert.rejects(
    acquireMicrosoftGraphAppToken(
      { tenantId: 'tenant-id', clientId: 'client-id', clientSecret: secret },
      fetchMock,
    ),
    (error: unknown) => {
      assert.ok(error instanceof MicrosoftGraphHttpError);
      assert.equal(error.httpStatus, 401);
      assert.equal(error.graphCode, 'invalid_client');
      assert.equal(error.requestId, 'correlation-123');
      assert.doesNotMatch(error.message, new RegExp(secret));
      return true;
    },
  );
});

test('message read targets Inbox and selects only the approved metadata fields', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json(
      {
        value: [
          {
            id: 'message-1',
            subject: 'Order 123',
            from: { emailAddress: { name: 'Customer', address: 'buyer@example.com' } },
            receivedDateTime: '2026-08-28T08:30:00Z',
            hasAttachments: true,
            bodyPreview: 'must be ignored',
          },
        ],
      },
      { headers: { 'request-id': 'request-123' } },
    );
  };

  const page = await fetchRecentMicrosoftGraphInboxMessages(
    { accessToken: 'test-token', mailbox: 'orders@turnnslice.com', top: 5 },
    fetchMock,
  );

  const url = new URL(requestedUrl);
  assert.equal(
    url.pathname,
    '/v1.0/users/orders%40turnnslice.com/mailFolders/inbox/messages',
  );
  assert.equal(url.searchParams.get('$select'), MICROSOFT_GRAPH_MESSAGE_FIELDS.join(','));
  assert.equal(url.searchParams.get('$top'), '5');
  assert.equal(url.searchParams.get('$orderby'), 'receivedDateTime desc');
  assert.equal(requestedInit?.method, 'GET');
  assert.equal(new Headers(requestedInit?.headers).get('authorization'), 'Bearer test-token');
  assert.deepEqual(page, {
    httpStatus: 200,
    requestId: 'request-123',
    messages: [
      {
        id: 'message-1',
        subject: 'Order 123',
        from: { name: 'Customer', address: 'buyer@example.com' },
        receivedDateTime: '2026-08-28T08:30:00Z',
        hasAttachments: true,
      },
    ],
  });
  assert.equal('bodyPreview' in page.messages[0], false);
});

test('Graph 403 preserves RBAC diagnostics without exposing the bearer token', async () => {
  const accessToken = 'never-print-this-token';
  const fetchMock: typeof fetch = async () =>
    Response.json(
      {
        error: {
          code: 'ErrorAccessDenied',
          message: `Access denied for ${accessToken}`,
          innerError: { 'request-id': 'rbac-request-123' },
        },
      },
      { status: 403 },
    );

  await assert.rejects(
    fetchRecentMicrosoftGraphInboxMessages(
      { accessToken, mailbox: 'blocked@example.com', top: 5 },
      fetchMock,
    ),
    (error: unknown) => {
      assert.ok(error instanceof MicrosoftGraphHttpError);
      assert.equal(error.httpStatus, 403);
      assert.equal(error.graphCode, 'ErrorAccessDenied');
      assert.equal(error.requestId, 'rbac-request-123');
      assert.doesNotMatch(error.message, new RegExp(accessToken));
      return true;
    },
  );
});

test('message read rejects a page size outside the deliberately small verification limit', async () => {
  let called = false;
  const fetchMock: typeof fetch = async () => {
    called = true;
    return Response.json({ value: [] });
  };

  await assert.rejects(
    fetchRecentMicrosoftGraphInboxMessages(
      { accessToken: 'token', mailbox: 'orders@example.com', top: 11 },
      fetchMock,
    ),
    /integer from 1 to 10/,
  );
  assert.equal(called, false);
});

test('one-message ingestion read is GET-only and selects body plus conversation metadata', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json({
      id: 'message-1',
      subject: 'Tax Invoice IOA76937',
      from: { emailAddress: { name: 'Supplier', address: 'supplier@example.com' } },
      receivedDateTime: '2026-08-28T08:38:57Z',
      hasAttachments: true,
      conversationId: 'conversation-1',
      body: { contentType: 'text', content: 'Invoice attached.' },
      bodyPreview: 'Invoice attached.',
    });
  };

  const message = await fetchMicrosoftGraphMessage(
    { accessToken: 'test-token', mailbox: 'orders@turnnslice.com', messageId: 'message-1' },
    fetchMock,
  );

  const url = new URL(requestedUrl);
  assert.equal(requestedInit?.method, 'GET');
  assert.equal(requestedInit?.body, undefined);
  assert.equal(
    url.pathname,
    '/v1.0/users/orders%40turnnslice.com/messages/message-1',
  );
  assert.equal(
    url.searchParams.get('$select'),
    'id,subject,from,receivedDateTime,body,bodyPreview,hasAttachments,conversationId',
  );
  // NO `outlook.body-content-type="text"`. Asking Exchange for text made
  // Exchange the parser, and it flattened a 100-row order table to one cell per
  // line before Vyso saw it. The body now arrives as the sender wrote it and is
  // read locally — see lib/platform/docu/email-html-normalizer.ts.
  assert.equal(new Headers(requestedInit?.headers).get('prefer'), null);
  assert.equal(message.conversationId, 'conversation-1');
  assert.equal(message.body?.content, 'Invoice attached.');
});

test('an html body is returned and recorded as html, not asked for as text', async () => {
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (_input, init) => {
    requestedInit = init;
    return Response.json({
      id: 'message-1',
      subject: 'Order form',
      from: { emailAddress: { name: 'Customer', address: 'buyer@example.com' } },
      receivedDateTime: '2026-08-30T08:00:00Z',
      hasAttachments: false,
      conversationId: 'conversation-1',
      body: { contentType: 'html', content: '<html><body><table><tr><td>Carrots</td><td>2</td></tr></table></body></html>' },
      bodyPreview: 'Carrots 2',
    });
  };
  const message = await fetchMicrosoftGraphMessage(
    { accessToken: 'test-token', mailbox: 'orders@turnnslice.com', messageId: 'message-1' },
    fetchMock,
  );
  assert.equal(requestedInit?.method, 'GET');
  assert.equal(new Headers(requestedInit?.headers).get('prefer'), null);
  assert.equal(message.body?.contentType, 'html');
  assert.match(message.body?.content ?? '', /<table>/);
});

test('immutable-id reads are an explicit opt-in and keep every mailbox operation GET-only', async () => {
  const requests: RequestInit[] = [];
  const messageFetch: typeof fetch = async (_input, init) => {
    requests.push(init ?? {});
    return Response.json({
      id: 'immutable-message-1',
      subject: 'Order',
      from: { emailAddress: { name: 'Customer', address: 'buyer@example.com' } },
      receivedDateTime: '2026-08-29T08:00:00Z',
      hasAttachments: false,
      conversationId: 'conversation-1',
      body: { contentType: 'text', content: 'Order body' },
      bodyPreview: 'Order body',
    });
  };
  await fetchMicrosoftGraphMessage({
    accessToken: 'test-token',
    mailbox: 'orders@turnnslice.com',
    messageId: 'immutable-message-1',
    idType: 'rest_immutable_entry_id',
  }, messageFetch);

  const attachmentFetch: typeof fetch = async (_input, init) => {
    requests.push(init ?? {});
    return Response.json({ value: [] });
  };
  await fetchMicrosoftGraphAttachmentMetadata({
    accessToken: 'test-token',
    mailbox: 'orders@turnnslice.com',
    messageId: 'immutable-message-1',
    idType: 'rest_immutable_entry_id',
  }, attachmentFetch);

  assert.deepEqual(requests.map((request) => request.method), ['GET', 'GET']);
  assert.equal(new Headers(requests[0]?.headers).get('prefer'), 'IdType="ImmutableId"');
  assert.equal(new Headers(requests[1]?.headers).get('prefer'), 'IdType="ImmutableId"');
});

test('attachment listing requests metadata only and never contentBytes', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json({
      value: [
        {
          '@odata.type': '#microsoft.graph.fileAttachment',
          id: 'attachment-1',
          name: 'invoice.pdf',
          contentType: 'application/pdf',
          size: 18197,
          isInline: false,
          contentBytes: 'must-not-be-used',
        },
      ],
    });
  };

  const page = await fetchMicrosoftGraphAttachmentMetadata(
    { accessToken: 'test-token', mailbox: 'orders@turnnslice.com', messageId: 'message-1' },
    fetchMock,
  );
  const url = new URL(requestedUrl);
  assert.equal(requestedInit?.method, 'GET');
  assert.equal(requestedInit?.body, undefined);
  assert.equal(url.searchParams.get('$select'), 'id,name,contentType,size,isInline');
  assert.equal(url.searchParams.get('$select')?.includes('contentBytes'), false);
  assert.equal(page.attachments[0].attachmentType, '#microsoft.graph.fileAttachment');
  assert.equal('contentBytes' in page.attachments[0], false);
});

test('attachment bytes are copied with one bounded GET to the attachment value endpoint', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(new Uint8Array([37, 80, 68, 70]), {
      headers: { 'content-type': 'application/pdf', 'content-length': '4' },
    });
  };

  const copy = await downloadMicrosoftGraphFileAttachment(
    {
      accessToken: 'test-token',
      mailbox: 'orders@turnnslice.com',
      messageId: 'message-1',
      attachmentId: 'attachment-1',
      maxBytes: 1024,
      idType: 'rest_immutable_entry_id',
    },
    fetchMock,
  );
  assert.equal(requestedInit?.method, 'GET');
  assert.equal(requestedInit?.body, undefined);
  assert.equal(new Headers(requestedInit?.headers).get('prefer'), 'IdType="ImmutableId"');
  assert.equal(
    new URL(requestedUrl).pathname,
    '/v1.0/users/orders%40turnnslice.com/messages/message-1/attachments/attachment-1/$value',
  );
  assert.deepEqual([...copy.bytes], [37, 80, 68, 70]);
});

test('subscription creation uses the exact Inbox resource and basic created notifications only', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json(
      {
        id: 'subscription-id',
        resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
        changeType: 'created',
        expirationDateTime: '2026-09-03T08:00:00.000Z',
        notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
      },
      { status: 201 },
    );
  };

  const subscription = await createMicrosoftGraphInboxSubscription(
    {
      accessToken: 'test-token',
      mailbox: 'orders@turnnslice.com',
      notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
      clientState: 'test-client-state',
      expirationDateTime: '2026-09-03T08:00:00.000Z',
    },
    fetchMock,
  );

  assert.equal(requestedUrl, 'https://graph.microsoft.com/v1.0/subscriptions');
  assert.equal(requestedInit?.method, 'POST');
  const body = JSON.parse(String(requestedInit?.body)) as Record<string, unknown>;
  assert.deepEqual(body, {
    changeType: 'created',
    notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
    expirationDateTime: '2026-09-03T08:00:00.000Z',
    clientState: 'test-client-state',
  });
  assert.equal('includeResourceData' in body, false);
  assert.equal('encryptionCertificate' in body, false);
  assert.equal('lifecycleNotificationUrl' in body, false);
  assert.equal(new Headers(requestedInit?.headers).get('prefer'), null);
  assert.equal(subscription.httpStatus, 201);
  assert.equal(
    microsoftGraphInboxSubscriptionResource('orders@turnnslice.com'),
    "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
  );
});

test('future immutable subscription creation adds only the explicit Prefer header', async () => {
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (_input, init) => {
    requestedInit = init;
    return Response.json({
      id: 'immutable-subscription-id',
      resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
      changeType: 'created',
      expirationDateTime: '2026-09-03T08:00:00.000Z',
      notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    }, { status: 201 });
  };

  await createMicrosoftGraphInboxSubscription({
    accessToken: 'test-token',
    mailbox: 'orders@turnnslice.com',
    notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    clientState: 'test-client-state',
    expirationDateTime: '2026-09-03T08:00:00.000Z',
    idType: 'rest_immutable_entry_id',
  }, fetchMock);

  assert.equal(requestedInit?.method, 'POST');
  assert.equal(new Headers(requestedInit?.headers).get('prefer'), 'IdType="ImmutableId"');
  const body = JSON.parse(String(requestedInit?.body)) as Record<string, unknown>;
  assert.equal('idType' in body, false);
  assert.equal('includeResourceData' in body, false);
});

test('Graph id type config defaults mutable and rejects unknown values', () => {
  assert.equal(microsoftGraphIdTypeFromConfig(undefined), 'rest_id');
  assert.equal(microsoftGraphIdTypeFromConfig('rest_id'), 'rest_id');
  assert.equal(microsoftGraphIdTypeFromConfig('immutable'), 'rest_immutable_entry_id');
  assert.throws(() => microsoftGraphIdTypeFromConfig('surprise'), /must be rest_id or rest_immutable_entry_id/);
});

test('subscription renewal PATCHes expirationDateTime only', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestedInit = init;
    return Response.json({
      id: 'subscription-id',
      resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
      changeType: 'created',
      expirationDateTime: '2026-09-03T08:00:00.000Z',
      notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    });
  };

  await renewMicrosoftGraphSubscription(
    {
      accessToken: 'test-token',
      subscriptionId: 'subscription-id',
      expirationDateTime: '2026-09-03T08:00:00.000Z',
    },
    fetchMock,
  );

  assert.equal(requestedUrl, 'https://graph.microsoft.com/v1.0/subscriptions/subscription-id');
  assert.equal(requestedInit?.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(requestedInit?.body)), {
    expirationDateTime: '2026-09-03T08:00:00.000Z',
  });
});

test('subscription inspection is a GET with no request body', async () => {
  let requestedInit: RequestInit | undefined;
  const fetchMock: typeof fetch = async (_input, init) => {
    requestedInit = init;
    return Response.json({
      id: 'subscription-id',
      resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
      changeType: 'created',
      expirationDateTime: '2026-09-03T08:00:00.000Z',
      notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    });
  };

  await getMicrosoftGraphSubscription(
    { accessToken: 'test-token', subscriptionId: 'subscription-id' },
    fetchMock,
  );
  assert.equal(requestedInit?.method, 'GET');
  assert.equal(requestedInit?.body, undefined);
});

const NOW = new Date('2026-08-29T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60_000;
const HOUR_MS = 60 * 60_000;

test('renewal decision: far from expiry skips', () => {
  const expirationDateTime = new Date(NOW.getTime() + 5 * DAY_MS).toISOString();
  assert.equal(microsoftGraphRenewalDecision({ expirationDateTime, now: NOW }), 'skip');
});

test('renewal decision: inside the 48h window renews', () => {
  const expirationDateTime = new Date(NOW.getTime() + 47 * HOUR_MS).toISOString();
  assert.equal(microsoftGraphRenewalDecision({ expirationDateTime, now: NOW }), 'renew');
});

test('renewal decision: threshold boundary is pinned (<=threshold renews, just above skips)', () => {
  const thresholdMs = 48 * HOUR_MS;
  const atThreshold = new Date(NOW.getTime() + thresholdMs).toISOString();
  const justAboveThreshold = new Date(NOW.getTime() + thresholdMs + 1).toISOString();
  assert.equal(
    microsoftGraphRenewalDecision({ expirationDateTime: atThreshold, now: NOW, thresholdMs }),
    'renew',
  );
  assert.equal(
    microsoftGraphRenewalDecision({ expirationDateTime: justAboveThreshold, now: NOW, thresholdMs }),
    'skip',
  );
});

test('renewal decision: past expiry is expired, never repaired here', () => {
  const expirationDateTime = new Date(NOW.getTime() - HOUR_MS).toISOString();
  assert.equal(microsoftGraphRenewalDecision({ expirationDateTime, now: NOW }), 'expired');
});

test('renewal decision: malformed or missing date is invalid', () => {
  assert.equal(
    microsoftGraphRenewalDecision({ expirationDateTime: 'not-a-date', now: NOW }),
    'invalid',
  );
  assert.equal(microsoftGraphRenewalDecision({ expirationDateTime: null, now: NOW }), 'invalid');
  assert.equal(
    microsoftGraphRenewalDecision({ expirationDateTime: undefined, now: NOW }),
    'invalid',
  );
});

interface RecordedRequest {
  url: string;
  method: string;
  body: string | undefined;
}

function subscriptionUrl(id: string): string {
  return `https://graph.microsoft.com/v1.0/subscriptions/${id}`;
}

/** Every request the orchestration issues must be GET/PATCH on /subscriptions/{id} — never a POST /subscriptions, /messages, or /mailFolders call. */
function assertOnlySubscriptionRequests(requests: RecordedRequest[], subscriptionId: string) {
  assert.ok(requests.length > 0);
  for (const request of requests) {
    assert.equal(request.url, subscriptionUrl(subscriptionId));
    assert.ok(request.method === 'GET' || request.method === 'PATCH', `unexpected method ${request.method}`);
  }
}

test('renewal orchestration: far from expiry skips and issues zero PATCH requests', async () => {
  const requests: RecordedRequest[] = [];
  const farExpiration = new Date(NOW.getTime() + 5 * DAY_MS).toISOString();
  const fetchMock: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined });
    return Response.json({
      id: 'subscription-id',
      resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
      changeType: 'created',
      expirationDateTime: farExpiration,
      notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    });
  };

  const result = await runMicrosoftGraphSubscriptionRenewal(
    { accessToken: 'test-token', subscriptionId: 'subscription-id', now: NOW },
    fetchMock,
  );

  assert.deepEqual(result, { action: 'skipped', expiresAt: farExpiration });
  assert.equal(requests.filter((r) => r.method === 'PATCH').length, 0);
  assertOnlySubscriptionRequests(requests, 'subscription-id');
});

test('renewal orchestration: near expiry issues exactly one PATCH with expirationDateTime only', async () => {
  const requests: RecordedRequest[] = [];
  const nearExpiration = new Date(NOW.getTime() + 40 * HOUR_MS).toISOString();
  const renewedExpiration = new Date(NOW.getTime() + 6 * DAY_MS).toISOString();
  const fetchMock: typeof fetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    requests.push({ url: String(input), method, body: init?.body as string | undefined });
    return Response.json({
      id: 'subscription-id',
      resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
      changeType: 'created',
      expirationDateTime: method === 'PATCH' ? renewedExpiration : nearExpiration,
      notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    });
  };

  const result = await runMicrosoftGraphSubscriptionRenewal(
    { accessToken: 'test-token', subscriptionId: 'subscription-id', now: NOW },
    fetchMock,
  );

  assert.deepEqual(result, { action: 'renewed', expiresAt: renewedExpiration });
  const patches = requests.filter((r) => r.method === 'PATCH');
  assert.equal(patches.length, 1);
  assert.equal(patches[0].url, subscriptionUrl('subscription-id'));
  const patchBody = JSON.parse(String(patches[0].body)) as { expirationDateTime?: unknown };
  assert.deepEqual(Object.keys(patchBody), ['expirationDateTime']);
  assert.equal(typeof patchBody.expirationDateTime, 'string');
  assert.ok(!Number.isNaN(new Date(patchBody.expirationDateTime as string).getTime()));
  assertOnlySubscriptionRequests(requests, 'subscription-id');
});

test('renewal orchestration: already-expired subscription throws and never PATCHes', async () => {
  const requests: RecordedRequest[] = [];
  const pastExpiration = new Date(NOW.getTime() - HOUR_MS).toISOString();
  const fetchMock: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined });
    return Response.json({
      id: 'subscription-id',
      resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
      changeType: 'created',
      expirationDateTime: pastExpiration,
      notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
    });
  };

  await assert.rejects(
    runMicrosoftGraphSubscriptionRenewal(
      { accessToken: 'test-token', subscriptionId: 'subscription-id', now: NOW },
      fetchMock,
    ),
  );
  assert.equal(requests.filter((r) => r.method === 'PATCH').length, 0);
  assertOnlySubscriptionRequests(requests, 'subscription-id');
});

test('renewal orchestration: missing subscription (404) throws MicrosoftGraphHttpError and never PATCHes', async () => {
  const requests: RecordedRequest[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined });
    return Response.json(
      { error: { code: 'ResourceNotFound', message: 'Subscription not found.' } },
      { status: 404 },
    );
  };

  await assert.rejects(
    runMicrosoftGraphSubscriptionRenewal(
      { accessToken: 'test-token', subscriptionId: 'subscription-id', now: NOW },
      fetchMock,
    ),
    (error: unknown) => {
      assert.ok(error instanceof MicrosoftGraphHttpError);
      assert.equal(error.httpStatus, 404);
      return true;
    },
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
});

test('renewal orchestration: Graph renewal failure (503) throws with a redacted message', async () => {
  const requests: RecordedRequest[] = [];
  const nearExpiration = new Date(NOW.getTime() + 1 * HOUR_MS).toISOString();
  const accessToken = 'never-print-this-access-token';
  const fetchMock: typeof fetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    requests.push({ url: String(input), method, body: init?.body as string | undefined });
    if (method === 'GET') {
      return Response.json({
        id: 'subscription-id',
        resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
        changeType: 'created',
        expirationDateTime: nearExpiration,
        notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
      });
    }
    return Response.json(
      { error: { code: 'ServiceUnavailable', message: `Graph is down for token ${accessToken}` } },
      { status: 503 },
    );
  };

  await assert.rejects(
    runMicrosoftGraphSubscriptionRenewal(
      { accessToken, subscriptionId: 'subscription-id', now: NOW },
      fetchMock,
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes(accessToken));
      return true;
    },
  );
  assertOnlySubscriptionRequests(requests, 'subscription-id');
});

test('renewal orchestration: malformed subscription response (no expirationDateTime) throws and never PATCHes', async () => {
  const requests: RecordedRequest[] = [];
  const fetchMock: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined });
    // parseSubscription already rejects a response missing required fields (400
    // InvalidResponse) before this helper's own 'invalid' branch would ever run —
    // this test pins that the malformed-payload path still never PATCHes.
    return Response.json(
      {
        id: 'subscription-id',
        resource: "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
        changeType: 'created',
        notificationUrl: 'https://vyso.co.za/api/integrations/microsoft/webhook',
      },
      { status: 200 },
    );
  };

  await assert.rejects(
    runMicrosoftGraphSubscriptionRenewal(
      { accessToken: 'test-token', subscriptionId: 'subscription-id', now: NOW },
      fetchMock,
    ),
  );
  assert.equal(requests.filter((r) => r.method === 'PATCH').length, 0);
  assertOnlySubscriptionRequests(requests, 'subscription-id');
});
