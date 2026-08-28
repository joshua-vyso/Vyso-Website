/**
 * Microsoft Graph's framework-free transport layer.
 *
 * This file deliberately has no `server-only` import so the development verifier
 * and node:test suite can use the exact same HTTP implementation as the server.
 * Runtime env access stays in microsoft-graph.ts beside it; credentials are always
 * passed in and are never included in an error message.
 */

export const MICROSOFT_GRAPH_SCOPE = 'https://graph.microsoft.com/.default';
export const MICROSOFT_GRAPH_API = 'https://graph.microsoft.com/v1.0';
export const MICROSOFT_GRAPH_MESSAGE_FIELDS = [
  'id',
  'subject',
  'from',
  'receivedDateTime',
  'hasAttachments',
] as const;

const MICROSOFT_LOGIN = 'https://login.microsoftonline.com';
const DEFAULT_MESSAGE_LIMIT = 5;
const MAX_MESSAGE_LIMIT = 10;
const SUBSCRIPTION_LIFETIME_MS = 6 * 24 * 60 * 60_000;

export interface MicrosoftGraphCredentials {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface MicrosoftGraphAppToken {
  accessToken: string;
  expiresInSeconds: number;
  tokenType: string;
  httpStatus: number;
}

export interface MicrosoftGraphEmailAddress {
  name: string | null;
  address: string | null;
}

export interface MicrosoftGraphMessageMetadata {
  id: string;
  subject: string | null;
  from: MicrosoftGraphEmailAddress | null;
  receivedDateTime: string | null;
  hasAttachments: boolean;
}

export interface MicrosoftGraphMessagePage {
  httpStatus: number;
  requestId: string | null;
  messages: MicrosoftGraphMessageMetadata[];
}

export interface MicrosoftGraphSubscription {
  id: string;
  resource: string;
  changeType: string;
  expirationDateTime: string;
  notificationUrl: string;
  httpStatus: number;
  requestId: string | null;
}

interface OAuthTokenPayload {
  access_token?: unknown;
  expires_in?: unknown;
  token_type?: unknown;
  error?: unknown;
  error_description?: unknown;
  correlation_id?: unknown;
  trace_id?: unknown;
}

interface GraphErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
    innerError?: {
      'request-id'?: unknown;
      requestId?: unknown;
    };
  };
}

interface GraphMessagePayload {
  id?: unknown;
  subject?: unknown;
  from?: {
    emailAddress?: {
      name?: unknown;
      address?: unknown;
    };
  } | null;
  receivedDateTime?: unknown;
  hasAttachments?: unknown;
}

interface GraphMessageListPayload {
  value?: unknown;
}

export class MicrosoftGraphHttpError extends Error {
  readonly operation:
    | 'token'
    | 'messages'
    | 'subscription-create'
    | 'subscription-read'
    | 'subscription-renew';
  readonly httpStatus: number;
  readonly graphCode: string | null;
  readonly requestId: string | null;

  constructor(input: {
    operation: MicrosoftGraphHttpError['operation'];
    httpStatus: number;
    graphCode?: string | null;
    requestId?: string | null;
    detail?: string | null;
  }) {
    const code = input.graphCode ? `, ${input.graphCode}` : '';
    const detail = input.detail ? `: ${input.detail}` : '';
    super(`Microsoft ${input.operation} request failed (HTTP ${input.httpStatus}${code})${detail}`);
    this.name = 'MicrosoftGraphHttpError';
    this.operation = input.operation;
    this.httpStatus = input.httpStatus;
    this.graphCode = input.graphCode ?? null;
    this.requestId = input.requestId ?? null;
  }
}

export function microsoftGraphInboxSubscriptionResource(mailbox: string): string {
  return `users/${required(mailbox, 'Microsoft mailbox')}/mailFolders('Inbox')/messages`;
}

/** Six days stays safely inside Outlook's seven-day basic-notification ceiling. */
export function microsoftGraphSubscriptionExpiration(now: Date = new Date()): string {
  return new Date(now.getTime() + SUBSCRIPTION_LIFETIME_MS).toISOString();
}

function required(value: string, name: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${name} is required.`);
  return result;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function redact(value: string | null, protectedValues: readonly string[]): string | null {
  if (!value) return value;
  let safe = value;
  for (const protectedValue of protectedValues) {
    if (protectedValue) safe = safe.replaceAll(protectedValue, '[redacted]');
  }
  return safe.slice(0, 500);
}

async function jsonObject(response: Response): Promise<Record<string, unknown>> {
  const value = (await response.json().catch(() => null)) as unknown;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Exchange app-only token acquisition. No token is cached or persisted here. */
export async function acquireMicrosoftGraphAppToken(
  credentials: MicrosoftGraphCredentials,
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphAppToken> {
  const tenantId = required(credentials.tenantId, 'Microsoft tenant id');
  const clientId = required(credentials.clientId, 'Microsoft client id');
  const clientSecret = required(credentials.clientSecret, 'Microsoft client secret');
  const endpoint = `${MICROSOFT_LOGIN}/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: MICROSOFT_GRAPH_SCOPE,
      grant_type: 'client_credentials',
    }),
    cache: 'no-store',
  });
  const payload = (await jsonObject(response)) as OAuthTokenPayload;
  const accessToken = stringOrNull(payload.access_token);

  if (!response.ok || !accessToken) {
    const code = stringOrNull(payload.error);
    const detail = redact(stringOrNull(payload.error_description), [clientSecret, clientId, tenantId]);
    const requestId = stringOrNull(payload.correlation_id) ?? stringOrNull(payload.trace_id);
    throw new MicrosoftGraphHttpError({
      operation: 'token',
      httpStatus: response.status,
      graphCode: code,
      requestId,
      detail,
    });
  }

  const expiresIn = Number(payload.expires_in);
  return {
    accessToken,
    expiresInSeconds: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 0,
    tokenType: stringOrNull(payload.token_type) ?? 'Bearer',
    httpStatus: response.status,
  };
}

function messageLimit(top: number): number {
  if (!Number.isInteger(top) || top < 1 || top > MAX_MESSAGE_LIMIT) {
    throw new Error(`Microsoft Graph message limit must be an integer from 1 to ${MAX_MESSAGE_LIMIT}.`);
  }
  return top;
}

function mapMessage(value: unknown): MicrosoftGraphMessageMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as GraphMessagePayload;
  const id = stringOrNull(raw.id);
  if (!id) return null;

  const email = raw.from?.emailAddress;
  const from = email
    ? {
        name: stringOrNull(email.name),
        address: stringOrNull(email.address),
      }
    : null;

  return {
    id,
    subject: stringOrNull(raw.subject),
    from,
    receivedDateTime: stringOrNull(raw.receivedDateTime),
    hasAttachments: raw.hasAttachments === true,
  };
}

/**
 * Read only the newest Inbox message metadata needed by the first milestone.
 * There is intentionally no generic Graph request helper here: exposing arbitrary
 * methods/paths would make a supposedly observational integration capable of writes.
 */
export async function fetchRecentMicrosoftGraphInboxMessages(
  input: {
    accessToken: string;
    mailbox: string;
    top?: number;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphMessagePage> {
  const accessToken = required(input.accessToken, 'Microsoft access token');
  const mailbox = required(input.mailbox, 'Microsoft mailbox');
  const top = messageLimit(input.top ?? DEFAULT_MESSAGE_LIMIT);
  const url = new URL(
    `${MICROSOFT_GRAPH_API}/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages`,
  );
  url.searchParams.set('$select', MICROSOFT_GRAPH_MESSAGE_FIELDS.join(','));
  url.searchParams.set('$top', String(top));
  url.searchParams.set('$orderby', 'receivedDateTime desc');

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });
  const payload = (await jsonObject(response)) as GraphMessageListPayload & GraphErrorPayload;
  const graphError = payload.error;
  const headerRequestId = response.headers.get('request-id');
  const innerRequestId =
    stringOrNull(graphError?.innerError?.['request-id']) ??
    stringOrNull(graphError?.innerError?.requestId);
  const requestId = headerRequestId || innerRequestId;

  if (!response.ok) {
    throw new MicrosoftGraphHttpError({
      operation: 'messages',
      httpStatus: response.status,
      graphCode: stringOrNull(graphError?.code),
      requestId,
      detail: redact(stringOrNull(graphError?.message), [accessToken]),
    });
  }

  if (!Array.isArray(payload.value)) {
    throw new MicrosoftGraphHttpError({
      operation: 'messages',
      httpStatus: response.status,
      graphCode: 'InvalidResponse',
      requestId,
      detail: 'Microsoft Graph returned no message list.',
    });
  }

  return {
    httpStatus: response.status,
    requestId,
    messages: payload.value.map(mapMessage).filter((message) => message !== null),
  };
}

function requireHttpsWebhook(value: string): string {
  let url: URL;
  try {
    url = new URL(required(value, 'Microsoft Graph webhook URL'));
  } catch {
    throw new Error('Microsoft Graph webhook URL must be an absolute HTTPS URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('Microsoft Graph webhook URL must use HTTPS.');
  }
  url.hash = '';
  return url.toString();
}

function parseSubscription(
  payload: Record<string, unknown>,
  response: Response,
  operation: 'subscription-create' | 'subscription-read' | 'subscription-renew',
): MicrosoftGraphSubscription {
  const id = stringOrNull(payload.id);
  const resource = stringOrNull(payload.resource);
  const changeType = stringOrNull(payload.changeType);
  const expirationDateTime = stringOrNull(payload.expirationDateTime);
  const notificationUrl = stringOrNull(payload.notificationUrl);
  const requestId = response.headers.get('request-id');
  if (!id || !resource || !changeType || !expirationDateTime || !notificationUrl) {
    throw new MicrosoftGraphHttpError({
      operation,
      httpStatus: response.status,
      graphCode: 'InvalidResponse',
      requestId,
      detail: 'Microsoft Graph returned an incomplete subscription.',
    });
  }
  return {
    id,
    resource,
    changeType,
    expirationDateTime,
    notificationUrl,
    httpStatus: response.status,
    requestId,
  };
}

async function subscriptionRequest(
  input: {
    operation: 'subscription-create' | 'subscription-read' | 'subscription-renew';
    accessToken: string;
    url: string;
    method: 'GET' | 'POST' | 'PATCH';
    body?: Record<string, string>;
    protectedValues?: readonly string[];
  },
  fetchImpl: typeof fetch,
): Promise<MicrosoftGraphSubscription> {
  const accessToken = required(input.accessToken, 'Microsoft access token');
  const response = await fetchImpl(input.url, {
    method: input.method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...(input.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    cache: 'no-store',
  });
  const payload = (await jsonObject(response)) as GraphErrorPayload & Record<string, unknown>;
  const graphError = payload.error;
  const requestId =
    response.headers.get('request-id') ||
    stringOrNull(graphError?.innerError?.['request-id']) ||
    stringOrNull(graphError?.innerError?.requestId);
  if (!response.ok) {
    throw new MicrosoftGraphHttpError({
      operation: input.operation,
      httpStatus: response.status,
      graphCode: stringOrNull(graphError?.code),
      requestId,
      detail: redact(stringOrNull(graphError?.message), [
        accessToken,
        ...(input.protectedValues ?? []),
      ]),
    });
  }
  return parseSubscription(payload, response, input.operation);
}

/** Create a basic notification subscription. No rich/resource data is requested. */
export async function createMicrosoftGraphInboxSubscription(
  input: {
    accessToken: string;
    mailbox: string;
    notificationUrl: string;
    clientState: string;
    expirationDateTime?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphSubscription> {
  const clientState = required(input.clientState, 'Microsoft Graph client state');
  const notificationUrl = requireHttpsWebhook(input.notificationUrl);
  const expirationDateTime = input.expirationDateTime ?? microsoftGraphSubscriptionExpiration();
  const resource = microsoftGraphInboxSubscriptionResource(input.mailbox);
  return subscriptionRequest(
    {
      operation: 'subscription-create',
      accessToken: input.accessToken,
      url: `${MICROSOFT_GRAPH_API}/subscriptions`,
      method: 'POST',
      body: {
        changeType: 'created',
        notificationUrl,
        resource,
        expirationDateTime,
        clientState,
      },
      protectedValues: [clientState],
    },
    fetchImpl,
  );
}

/** Read safe subscription status from Graph; the caller decides what to print. */
export async function getMicrosoftGraphSubscription(
  input: { accessToken: string; subscriptionId: string },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphSubscription> {
  const subscriptionId = required(input.subscriptionId, 'Microsoft Graph subscription id');
  return subscriptionRequest(
    {
      operation: 'subscription-read',
      accessToken: input.accessToken,
      url: `${MICROSOFT_GRAPH_API}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      method: 'GET',
    },
    fetchImpl,
  );
}

/** Renewal changes expirationDateTime only; resource and permissions remain untouched. */
export async function renewMicrosoftGraphSubscription(
  input: {
    accessToken: string;
    subscriptionId: string;
    expirationDateTime?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphSubscription> {
  const subscriptionId = required(input.subscriptionId, 'Microsoft Graph subscription id');
  return subscriptionRequest(
    {
      operation: 'subscription-renew',
      accessToken: input.accessToken,
      url: `${MICROSOFT_GRAPH_API}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      method: 'PATCH',
      body: {
        expirationDateTime:
          input.expirationDateTime ?? microsoftGraphSubscriptionExpiration(),
      },
    },
    fetchImpl,
  );
}
