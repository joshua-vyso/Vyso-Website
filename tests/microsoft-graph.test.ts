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
  microsoftGraphInboxSubscriptionResource,
  renewMicrosoftGraphSubscription,
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
  assert.equal(
    new Headers(requestedInit?.headers).get('prefer'),
    'outlook.body-content-type="text"',
  );
  assert.equal(message.conversationId, 'conversation-1');
  assert.equal(message.body?.content, 'Invoice attached.');
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
    },
    fetchMock,
  );
  assert.equal(requestedInit?.method, 'GET');
  assert.equal(requestedInit?.body, undefined);
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
  assert.equal(subscription.httpStatus, 201);
  assert.equal(
    microsoftGraphInboxSubscriptionResource('orders@turnnslice.com'),
    "users/orders@turnnslice.com/mailFolders('Inbox')/messages",
  );
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
