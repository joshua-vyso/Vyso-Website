import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MICROSOFT_GRAPH_WEBHOOK_MAX_BYTES,
  handleMicrosoftGraphWebhook,
  type MicrosoftGraphWebhookConfig,
  type MicrosoftGraphWebhookLog,
} from '../lib/platform/microsoft-graph-webhook.ts';

const SUBSCRIPTION_ID = 'c6126aa3-0ed8-412f-a988-71e6cee627c4';
const TENANT_ID = '84bd8158-6d4d-4958-8b9f-9d6445542f95';
const MAILBOX_ID = '622eaaff-0683-4862-9de4-f2ec83c2bd98';
const CLIENT_STATE = 'test-client-state-that-must-never-be-logged';

const CONFIG: MicrosoftGraphWebhookConfig = {
  clientState: CLIENT_STATE,
  expectedSubscriptionId: SUBSCRIPTION_ID,
  tenantId: TENANT_ID,
  mailbox: 'orders@turnnslice.com',
};

function notification(overrides: Record<string, unknown> = {}) {
  return {
    subscriptionId: SUBSCRIPTION_ID,
    subscriptionExpirationDateTime: '2026-09-03T08:00:00.000Z',
    clientState: CLIENT_STATE,
    changeType: 'created',
    resource: `Users/${MAILBOX_ID}/Messages/AAMk-message-id`,
    tenantId: TENANT_ID,
    resourceData: {
      '@odata.type': '#Microsoft.Graph.Message',
      '@odata.id': `Users/${MAILBOX_ID}/Messages/AAMk-message-id`,
      id: 'AAMk-message-id',
    },
    ...overrides,
  };
}

function webhookRequest(body: unknown, headers: HeadersInit = {}): Request {
  return new Request('https://vyso.co.za/api/integrations/microsoft/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('validationToken returns exact decoded plain text and invokes no normal processing', async () => {
  const token = 'opaque+token/value=123';
  const url = new URL('https://vyso.co.za/api/integrations/microsoft/webhook');
  url.searchParams.set('validationToken', token);
  let rateLimitCalled = false;
  let logCalled = false;
  let notificationProcessingCalled = false;

  const response = await handleMicrosoftGraphWebhook(
    new Request(url, { method: 'POST', body: 'must-not-be-read' }),
    { clientState: '', expectedSubscriptionId: '', tenantId: '', mailbox: '' },
    {
      rateLimitAllowed: async () => {
        rateLimitCalled = true;
        return false;
      },
      log: () => {
        logCalled = true;
      },
      onNotifications: async () => {
        notificationProcessingCalled = true;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/plain');
  assert.equal(await response.text(), token);
  assert.equal(rateLimitCalled, false);
  assert.equal(logCalled, false);
  assert.equal(notificationProcessingCalled, false);
});

test('valid created notification is accepted quickly with an empty 202', async () => {
  const logs: MicrosoftGraphWebhookLog[] = [];
  let messageIds: string[] = [];
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({ value: [notification()] }),
    CONFIG,
    {
      rateLimitAllowed: async () => true,
      onNotifications: async (notifications) => {
        messageIds = notifications.map((entry) => entry.messageId);
      },
      log: (event) => logs.push(event),
    },
  );

  assert.equal(response.status, 202);
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(logs.length, 1);
  assert.equal(logs[0].outcome, 'accepted');
  assert.equal(logs[0].category, 'notification');
  assert.equal(logs[0].notificationCount, 1);
  assert.equal(logs[0].changeType, 'created');
  assert.equal(logs[0].resourceMatches, true);
  assert.equal(logs[0].resourceDataIdPresent, true);
  assert.deepEqual(messageIds, ['AAMk-message-id']);
});

test('duplicate notifications enqueue one message id', async () => {
  let messageIds: string[] = [];
  const row = notification();
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({ value: [row, row] }),
    CONFIG,
    {
      onNotifications: async (notifications) => {
        messageIds = notifications.map((entry) => entry.messageId);
      },
    },
  );
  assert.equal(response.status, 202);
  assert.deepEqual(messageIds, ['AAMk-message-id']);
});

test('persistence failure returns 503 so Microsoft can retry', async () => {
  const logs: MicrosoftGraphWebhookLog[] = [];
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({ value: [notification()] }),
    CONFIG,
    {
      onNotifications: async () => {
        throw new Error('database unavailable with private payload');
      },
      log: (entry) => logs.push(entry),
    },
  );
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Microsoft Graph notification could not be persisted.',
  });
  assert.equal(logs.at(-1)?.category, 'ingest-persistence');
  assert.doesNotMatch(JSON.stringify(logs), /database unavailable|private payload/);
});

test('wrong clientState is rejected', async () => {
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({ value: [notification({ clientState: 'wrong-secret' })] }),
    CONFIG,
  );
  assert.equal(response.status, 401);
});

test('missing clientState is rejected', async () => {
  const row = notification();
  delete (row as { clientState?: string }).clientState;
  const response = await handleMicrosoftGraphWebhook(webhookRequest({ value: [row] }), CONFIG);
  assert.equal(response.status, 400);
});

test('unknown subscription is rejected when subscription verification is configured', async () => {
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({
      value: [
        notification({ subscriptionId: '76619225-ff6b-4489-96ca-4ef547e78b22' }),
      ],
    }),
    CONFIG,
  );
  assert.equal(response.status, 403);
});

test('normal notification fails closed until the created subscription id is configured', async () => {
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({ value: [notification()] }),
    { ...CONFIG, expectedSubscriptionId: '' },
  );
  assert.equal(response.status, 503);
});

test('resource explicitly naming another mailbox is rejected', async () => {
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({
      value: [notification({ resource: 'Users/other@example.com/Messages/AAMk-message-id' })],
    }),
    CONFIG,
  );
  assert.equal(response.status, 400);
});

test('resource explicitly naming another folder is rejected', async () => {
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({
      value: [
        notification({
          resource:
            "Users('orders@turnnslice.com')/mailFolders('Archive')/messages('AAMk-message-id')",
        }),
      ],
    }),
    CONFIG,
  );
  assert.equal(response.status, 400);
});

test('updated or deleted change types are rejected', async () => {
  for (const changeType of ['updated', 'deleted']) {
    const response = await handleMicrosoftGraphWebhook(
      webhookRequest({ value: [notification({ changeType })] }),
      CONFIG,
    );
    assert.equal(response.status, 400);
  }
});

test('wrong tenant and wrong resource type are rejected', async () => {
  const wrongTenant = await handleMicrosoftGraphWebhook(
    webhookRequest({
      value: [notification({ tenantId: '9f4ebab6-520d-49c0-85cc-7b25c78d4a93' })],
    }),
    CONFIG,
  );
  assert.equal(wrongTenant.status, 403);

  const wrongType = await handleMicrosoftGraphWebhook(
    webhookRequest({
      value: [
        notification({
          resourceData: {
            '@odata.type': '#Microsoft.Graph.Event',
            id: 'AAMk-message-id',
          },
        }),
      ],
    }),
    CONFIG,
  );
  assert.equal(wrongType.status, 400);
});

test('malformed JSON is rejected safely', async () => {
  const response = await handleMicrosoftGraphWebhook(webhookRequest('{not-json'), CONFIG);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid Microsoft Graph notification.' });
});

test('content-length and streaming checks reject oversized payloads', async () => {
  const headerRejected = await handleMicrosoftGraphWebhook(
    webhookRequest('{}', { 'content-length': String(MICROSOFT_GRAPH_WEBHOOK_MAX_BYTES + 1) }),
    CONFIG,
  );
  assert.equal(headerRejected.status, 413);

  const streamedRejected = await handleMicrosoftGraphWebhook(
    webhookRequest('x'.repeat(MICROSOFT_GRAPH_WEBHOOK_MAX_BYTES + 1)),
    CONFIG,
  );
  assert.equal(streamedRejected.status, 413);
});

test('logs contain no secrets, subject, body, sender, or raw request payload', async () => {
  const logs: MicrosoftGraphWebhookLog[] = [];
  const subject = 'CONFIDENTIAL CUSTOMER ORDER SUBJECT';
  const body = 'CONFIDENTIAL EMAIL BODY';
  const sender = 'private.person@example.com';
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({
      value: [notification({ subject, body, from: sender })],
    }),
    CONFIG,
    { log: (event) => logs.push(event) },
  );
  assert.equal(response.status, 202);

  const rendered = JSON.stringify(logs);
  for (const forbidden of [CLIENT_STATE, subject, body, sender, SUBSCRIPTION_ID]) {
    assert.equal(rendered.includes(forbidden), false);
  }
  assert.match(rendered, /subscriptionRef/);
});

test('authenticated notification bursts use the existing limiter and return Retry-After', async () => {
  let bucket = '';
  const response = await handleMicrosoftGraphWebhook(
    webhookRequest({ value: [notification()] }),
    CONFIG,
    {
      rateLimitAllowed: async (receivedBucket) => {
        bucket = receivedBucket;
        return false;
      },
    },
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.match(bucket, /^microsoft-webhook:[0-9a-f]{12}$/);
  assert.equal(bucket.includes(SUBSCRIPTION_ID), false);
});
