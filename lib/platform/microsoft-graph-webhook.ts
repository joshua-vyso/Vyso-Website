import { createHash, timingSafeEqual } from 'node:crypto';

export const MICROSOFT_GRAPH_WEBHOOK_MAX_BYTES = 128 * 1024;
export const MICROSOFT_GRAPH_WEBHOOK_RATE_MAX = 1_000;
export const MICROSOFT_GRAPH_WEBHOOK_RATE_WINDOW_SECONDS = 60;

const MESSAGE_ODATA_TYPE = '#Microsoft.Graph.Message';
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
} as const;

export interface MicrosoftGraphWebhookConfig {
  clientState: string;
  expectedSubscriptionId: string;
  tenantId: string;
  mailbox: string;
}

export interface MicrosoftGraphWebhookLog {
  timestamp: string;
  outcome: 'accepted' | 'rejected';
  category: string;
  notificationCount?: number;
  changeType?: string;
  resourceMatches?: boolean;
  subscriptionRef?: string;
  resourceDataIdPresent?: boolean;
}

export interface MicrosoftGraphWebhookDependencies {
  rateLimitAllowed?: (bucket: string, limit: number, windowSeconds: number) => Promise<boolean>;
  /** Persist provider ids before the 202. Heavy processing belongs in after()/the cron. */
  onNotifications?: (notifications: readonly ValidatedMicrosoftGraphNotification[]) => Promise<void>;
  log?: (event: MicrosoftGraphWebhookLog) => void;
  now?: () => Date;
}

export interface ValidatedMicrosoftGraphNotification {
  messageId: string;
}

interface ParsedNotification {
  subscriptionId: string;
  clientState: string;
  changeType: string;
  resource: string;
  resourceData: {
    id: string;
    odataType: string;
  };
  tenantId: string;
  subscriptionExpirationDateTime: string;
}

class BodyTooLargeError extends Error {}

function response(body: BodyInit | null, status: number, headers?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, ...headers },
  });
}

function jsonError(status: number, message: string, extraHeaders?: HeadersInit): Response {
  return response(JSON.stringify({ error: message }), status, {
    'content-type': 'application/json',
    ...extraHeaders,
  });
}

function hash(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function microsoftGraphSecretMatches(expected: string, received: string): boolean {
  if (!expected || !received) return false;
  return timingSafeEqual(hash(expected), hash(received));
}

export function microsoftGraphSubscriptionRef(subscriptionId: string): string {
  return createHash('sha256').update(subscriptionId, 'utf8').digest('hex').slice(0, 12);
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function parseNotification(value: unknown): ParsedNotification | null {
  const row = object(value);
  if (!row) return null;
  const resourceData = object(row.resourceData);
  if (!resourceData) return null;

  const subscriptionId = boundedString(row.subscriptionId, 100);
  const clientState = boundedString(row.clientState, 255);
  const changeType = boundedString(row.changeType, 30);
  const resource = boundedString(row.resource, 4_096);
  const resourceDataId = boundedString(resourceData.id, 4_096);
  const odataType = boundedString(resourceData['@odata.type'], 100);
  const tenantId = boundedString(row.tenantId, 100);
  const expiration = boundedString(row.subscriptionExpirationDateTime, 100);
  if (
    !subscriptionId ||
    !GUID_RE.test(subscriptionId) ||
    !clientState ||
    !changeType ||
    !resource ||
    !resourceDataId ||
    !odataType ||
    !tenantId ||
    !GUID_RE.test(tenantId) ||
    !expiration ||
    Number.isNaN(Date.parse(expiration))
  ) {
    return null;
  }

  return {
    subscriptionId,
    clientState,
    changeType,
    resource,
    resourceData: { id: resourceDataId, odataType },
    tenantId,
    subscriptionExpirationDateTime: expiration,
  };
}

function parsePayload(raw: string): ParsedNotification[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const root = object(parsed);
  if (!root || !Array.isArray(root.value) || root.value.length < 1 || root.value.length > 100) {
    return null;
  }
  const notifications = root.value.map(parseNotification);
  return notifications.every((entry) => entry !== null)
    ? (notifications as ParsedNotification[])
    : null;
}

function safelyDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Graph sends a changed MESSAGE instance here, not the collection resource used
 * to create the subscription. For Outlook it commonly substitutes the mailbox's
 * directory GUID and omits the folder. Subscription-id + tenant + clientState bind
 * that GUID form to the configured Inbox subscription; any explicit mailbox/folder
 * contradiction still fails closed.
 */
export function microsoftGraphMessageResourceMatches(resource: string, mailbox: string): boolean {
  const trimmed = resource.replace(/^\/+/, '');
  const paren = /^users\('([^']+)'\)\/(?:mailfolders\('([^']+)'\)\/)?messages\('([^']+)'\)$/i.exec(trimmed);
  const slash = /^users\/([^/]+)\/(?:mailfolders\('([^']+)'\)\/)?messages\/(.+)$/i.exec(trimmed);
  const match = paren ?? slash;
  if (!match) return false;

  const user = safelyDecode(match[1]).toLowerCase();
  const folder = match[2] ? safelyDecode(match[2]).toLowerCase() : null;
  const messageId = safelyDecode(match[3]);
  if (!messageId || (folder && folder !== 'inbox')) return false;

  const expectedMailbox = mailbox.trim().toLowerCase();
  if (user.includes('@')) {
    const directoryPair = /^([0-9a-f-]{36})@([0-9a-f-]{36})$/i.exec(user);
    if (!directoryPair && user !== expectedMailbox) return false;
  } else if (!GUID_RE.test(user)) {
    return false;
  }
  return true;
}

async function readBodyWithLimit(request: Request, maxBytes: number): Promise<string> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && /^\d+$/.test(lengthHeader) && Number(lengthHeader) > maxBytes) {
    throw new BodyTooLargeError();
  }
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(body);
}

export async function handleMicrosoftGraphWebhook(
  request: Request,
  config: MicrosoftGraphWebhookConfig,
  dependencies: MicrosoftGraphWebhookDependencies = {},
): Promise<Response> {
  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.has('validationToken')) {
    const validationToken = requestUrl.searchParams.get('validationToken') ?? '';
    return response(validationToken, 200, { 'content-type': 'text/plain' });
  }

  const now = dependencies.now ?? (() => new Date());
  const log = dependencies.log ?? (() => {});
  const reject = (
    status: number,
    category: string,
    details: Omit<MicrosoftGraphWebhookLog, 'timestamp' | 'outcome' | 'category'> = {},
  ) => {
    log({ timestamp: now().toISOString(), outcome: 'rejected', category, ...details });
    return jsonError(status, 'Invalid Microsoft Graph notification.');
  };

  if (!config.clientState || !config.tenantId || !config.mailbox) {
    return reject(503, 'configuration');
  }
  // The validation handshake must work before an id exists. Normal notifications
  // do not: once Graph returns the id it must be pinned in env and redeployed.
  if (!config.expectedSubscriptionId) {
    return reject(503, 'subscription-not-configured');
  }

  let raw: string;
  try {
    raw = await readBodyWithLimit(request, MICROSOFT_GRAPH_WEBHOOK_MAX_BYTES);
  } catch (error) {
    return error instanceof BodyTooLargeError
      ? reject(413, 'payload-too-large')
      : reject(400, 'payload-encoding');
  }

  const notifications = parsePayload(raw);
  if (!notifications) return reject(400, 'malformed-payload');

  for (const notification of notifications) {
    const subscriptionRef = microsoftGraphSubscriptionRef(notification.subscriptionId);
    if (!microsoftGraphSecretMatches(config.clientState, notification.clientState)) {
      return reject(401, 'client-state', { subscriptionRef });
    }
    if (notification.subscriptionId !== config.expectedSubscriptionId) {
      return reject(403, 'subscription', { subscriptionRef });
    }
    if (notification.tenantId.toLowerCase() !== config.tenantId.toLowerCase()) {
      return reject(403, 'tenant', { subscriptionRef });
    }
    if (notification.changeType !== 'created') {
      return reject(400, 'change-type', {
        changeType: notification.changeType,
        subscriptionRef,
      });
    }
    if (notification.resourceData.odataType !== MESSAGE_ODATA_TYPE) {
      return reject(400, 'resource-type', {
        resourceMatches: false,
        subscriptionRef,
        resourceDataIdPresent: true,
      });
    }
    if (!microsoftGraphMessageResourceMatches(notification.resource, config.mailbox)) {
      return reject(400, 'resource', {
        resourceMatches: false,
        subscriptionRef,
        resourceDataIdPresent: true,
      });
    }
  }

  const subscriptionRef = microsoftGraphSubscriptionRef(notifications[0].subscriptionId);
  if (dependencies.rateLimitAllowed) {
    const allowed = await dependencies.rateLimitAllowed(
      `microsoft-webhook:${subscriptionRef}`,
      MICROSOFT_GRAPH_WEBHOOK_RATE_MAX,
      MICROSOFT_GRAPH_WEBHOOK_RATE_WINDOW_SECONDS,
    );
    if (!allowed) {
      log({
        timestamp: now().toISOString(),
        outcome: 'rejected',
        category: 'rate-limit',
        notificationCount: notifications.length,
        subscriptionRef,
      });
      return jsonError(429, 'Too many notifications.', { 'retry-after': '60' });
    }
  }

  if (dependencies.onNotifications) {
    try {
      const messageIds = [...new Set(notifications.map((notification) => notification.resourceData.id))];
      await dependencies.onNotifications(
        messageIds.map((messageId) => ({ messageId })),
      );
    } catch {
      log({
        timestamp: now().toISOString(),
        outcome: 'rejected',
        category: 'ingest-persistence',
        notificationCount: notifications.length,
        subscriptionRef,
      });
      return jsonError(503, 'Microsoft Graph notification could not be persisted.');
    }
  }

  log({
    timestamp: now().toISOString(),
    outcome: 'accepted',
    category: 'notification',
    notificationCount: notifications.length,
    changeType: 'created',
    resourceMatches: true,
    subscriptionRef,
    resourceDataIdPresent: true,
  });
  return response(null, 202);
}
