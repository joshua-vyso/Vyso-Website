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

export type MicrosoftGraphIdType = 'rest_id' | 'rest_immutable_entry_id';

/** Default-off preparation for a future, explicitly coordinated subscription cutover. */
export function microsoftGraphIdTypeFromConfig(value: string | null | undefined): MicrosoftGraphIdType {
  const configured = (value ?? '').trim().toLowerCase();
  if (!configured || configured === 'rest_id' || configured === 'mutable') return 'rest_id';
  if (configured === 'rest_immutable_entry_id' || configured === 'immutable') return 'rest_immutable_entry_id';
  throw new Error('MICROSOFT_GRAPH_ID_TYPE must be rest_id or rest_immutable_entry_id.');
}

function immutableIdPreference(idType: MicrosoftGraphIdType | undefined): string | null {
  return idType === 'rest_immutable_entry_id' ? 'IdType="ImmutableId"' : null;
}

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

export interface MicrosoftGraphMessageContent extends MicrosoftGraphMessageMetadata {
  conversationId: string | null;
  /**
   * RFC 5322 Message-ID — the message's BUSINESS identity, and the one thing
   * about it that survives the folder moves that kill REST ids. Selected on
   * every single-message read so a new ingest can record it at creation time,
   * which is what makes a future re-resolution (or an ImmutableId cutover)
   * a lookup instead of a search.
   */
  internetMessageId: string | null;
  body: {
    contentType: string | null;
    content: string | null;
  } | null;
  bodyPreview: string | null;
}

/**
 * One candidate returned by a FILTERED mailbox search. Deliberately not
 * `MicrosoftGraphMessageContent`: a search never selects a body, because the
 * resolver's job is to decide WHICH message this is, not to read it.
 */
export interface MicrosoftGraphMessageLocatorCandidate extends MicrosoftGraphMessageMetadata {
  conversationId: string | null;
  internetMessageId: string | null;
}

export interface MicrosoftGraphAttachmentMetadata {
  id: string;
  name: string | null;
  contentType: string | null;
  size: number;
  isInline: boolean;
  attachmentType: string | null;
}

export interface MicrosoftGraphAttachmentPage {
  httpStatus: number;
  requestId: string | null;
  attachments: MicrosoftGraphAttachmentMetadata[];
}

export interface MicrosoftGraphAttachmentBytes {
  httpStatus: number;
  requestId: string | null;
  bytes: Uint8Array;
  contentType: string | null;
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
  conversationId?: unknown;
  internetMessageId?: unknown;
  body?: {
    contentType?: unknown;
    content?: unknown;
  } | null;
  bodyPreview?: unknown;
}

interface GraphMessageListPayload {
  value?: unknown;
}

interface GraphAttachmentPayload {
  id?: unknown;
  name?: unknown;
  contentType?: unknown;
  size?: unknown;
  isInline?: unknown;
  '@odata.type'?: unknown;
}

export class MicrosoftGraphHttpError extends Error {
  readonly operation:
    | 'token'
    | 'messages'
    | 'message-read'
    // A FILTERED, read-only mailbox search used only by the controlled
    // re-resolution path. Kept a distinct operation so a search failure can
    // never be mistaken for a message read (and vice versa) in a log or a test.
    | 'message-search'
    | 'attachment-list'
    | 'attachment-download'
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

function graphRequestId(response: Response, payload?: GraphErrorPayload): string | null {
  return (
    response.headers.get('request-id') ||
    stringOrNull(payload?.error?.innerError?.['request-id']) ||
    stringOrNull(payload?.error?.innerError?.requestId)
  );
}

function graphReadError(
  operation: 'message-read' | 'message-search' | 'attachment-list' | 'attachment-download',
  response: Response,
  payload: GraphErrorPayload,
  accessToken: string,
): MicrosoftGraphHttpError {
  return new MicrosoftGraphHttpError({
    operation,
    httpStatus: response.status,
    graphCode: stringOrNull(payload.error?.code),
    requestId: graphRequestId(response, payload),
    detail: redact(stringOrNull(payload.error?.message), [accessToken]),
  });
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
    idType?: MicrosoftGraphIdType;
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
      ...(immutableIdPreference(input.idType) ? { prefer: immutableIdPreference(input.idType)! } : {}),
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

/** Read one message's metadata/body. This is deliberately GET-only. */
export async function fetchMicrosoftGraphMessage(
  input: { accessToken: string; mailbox: string; messageId: string; idType?: MicrosoftGraphIdType },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphMessageContent & { httpStatus: number; requestId: string | null }> {
  const accessToken = required(input.accessToken, 'Microsoft access token');
  const mailbox = required(input.mailbox, 'Microsoft mailbox');
  const messageId = required(input.messageId, 'Microsoft Graph message id');
  const url = new URL(
    `${MICROSOFT_GRAPH_API}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}`,
  );
  url.searchParams.set(
    '$select',
    // internetMessageId IS ADDITIVE AND LOAD-BEARING. Every new ingest records it
    // at creation, so the business identity of a message is captured while the
    // REST id still works — which is the difference between a future
    // re-resolution being a one-shot `$filter` lookup and being a mailbox-wide
    // heuristic search. Nothing else about this request changed.
    'id,subject,from,receivedDateTime,body,bodyPreview,hasAttachments,conversationId,internetMessageId',
  );
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      // NO `outlook.body-content-type="text"` HERE, AND THAT IS THE FIX.
      //
      // Asking Exchange for text made Exchange the parser: the Belair order
      // arrived as one Outlook `MsoNormalTable` of 100 rows × 4 columns, and the
      // server flattened it to one cell per line — no row delimiter, no column
      // delimiter — before Vyso ever saw a byte of it. Eight rows carried an
      // order quantity; what the reader got was a column-less list, and what the
      // customer got back was 97 lines, 92 of them with no quantity, and the
      // three gram quantities gone. The markup was never the problem; losing it
      // was. Graph now returns the body as the sender wrote it (html or text),
      // `contentType` is recorded faithfully, and
      // lib/platform/docu/email-html-normalizer.ts does the reading — locally,
      // with no script execution and no remote fetches of any kind.
      //
      // Still GET-only, still the same `$select`, still the same idType
      // handling; this header is the ONLY thing that changed.
      ...(immutableIdPreference(input.idType) ? { prefer: immutableIdPreference(input.idType)! } : {}),
    },
    cache: 'no-store',
  });
  const payload = (await jsonObject(response)) as GraphMessagePayload & GraphErrorPayload;
  if (!response.ok) throw graphReadError('message-read', response, payload, accessToken);

  const metadata = mapMessage(payload);
  if (!metadata || metadata.id !== messageId) {
    throw new MicrosoftGraphHttpError({
      operation: 'message-read',
      httpStatus: response.status,
      graphCode: 'InvalidResponse',
      requestId: graphRequestId(response),
      detail: 'Microsoft Graph returned an invalid message.',
    });
  }
  const body = payload.body && typeof payload.body === 'object'
    ? {
        contentType: stringOrNull(payload.body.contentType),
        content: stringOrNull(payload.body.content),
      }
    : null;
  return {
    ...metadata,
    conversationId: stringOrNull(payload.conversationId),
    internetMessageId: stringOrNull(payload.internetMessageId),
    body,
    bodyPreview: stringOrNull(payload.bodyPreview),
    httpStatus: response.status,
    requestId: graphRequestId(response),
  };
}

/**
 * "The message is not where its stored id says it is."
 *
 * This is the ONE error that may start a re-resolution. Every other Graph
 * failure — throttling, a token problem, a 5xx — propagates untouched, because
 * searching a mailbox in response to a transient fault would turn a retry into
 * a guess. Exchange answers a dead REST id with 404/ErrorItemNotFound; both are
 * accepted because the code is absent on some error shapes.
 */
export function isMicrosoftGraphItemNotFound(error: unknown): boolean {
  if (!(error instanceof MicrosoftGraphHttpError)) return false;
  if (error.graphCode === 'ErrorItemNotFound' || error.graphCode === 'ErrorInvalidIdMalformed') return true;
  return error.httpStatus === 404;
}

/**
 * The fields a locator search selects. No body, no bodyPreview: deciding WHICH
 * message this is must not pull message content into the resolver at all.
 */
const MICROSOFT_GRAPH_LOCATOR_FIELDS =
  'id,subject,from,receivedDateTime,hasAttachments,conversationId,internetMessageId';

/** Bounded: a resolver that reads an unbounded page is a mailbox enumerator. */
const MAX_LOCATOR_CANDIDATES = 50;

/**
 * OData escapes a single quote by DOUBLING it. Without this a subject or an id
 * containing an apostrophe would terminate the literal early and change the
 * meaning of the filter — the string-injection bug, in OData's clothing.
 */
function odataStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function mapLocatorCandidate(value: unknown): MicrosoftGraphMessageLocatorCandidate | null {
  const metadata = mapMessage(value);
  if (!metadata) return null;
  const raw = value as GraphMessagePayload;
  return {
    ...metadata,
    conversationId: stringOrNull(raw.conversationId),
    internetMessageId: stringOrNull(raw.internetMessageId),
  };
}

/**
 * A FILTERED, GET-only search of one mailbox. The only two callers are the
 * resolver's two lookups, and the filter string is always built here from a
 * single escaped value — there is deliberately no way to pass arbitrary OData
 * in, for the same reason there is no generic Graph request helper in this file.
 *
 * The search covers the WHOLE mailbox, Deleted Items included, which is the
 * entire point: the mail this runs against has already been moved out of the
 * Inbox by an external actor. No folder is ever enumerated; Exchange evaluates
 * the filter server-side, with no ConsistencyLevel or $count header required
 * (verified against the live tenant for both filters below).
 */
async function searchMicrosoftGraphMessages(
  input: { accessToken: string; mailbox: string; filter: string; top: number; idType?: MicrosoftGraphIdType },
  fetchImpl: typeof fetch,
): Promise<MicrosoftGraphMessageLocatorCandidate[]> {
  const accessToken = required(input.accessToken, 'Microsoft access token');
  const mailbox = required(input.mailbox, 'Microsoft mailbox');
  const url = new URL(`${MICROSOFT_GRAPH_API}/users/${encodeURIComponent(mailbox)}/messages`);
  // URLSearchParams percent-encodes the value — conversation ids carry '=' and
  // internetMessageIds carry '<', '>' and '@', all of which must survive intact.
  url.searchParams.set('$filter', input.filter);
  url.searchParams.set('$select', MICROSOFT_GRAPH_LOCATOR_FIELDS);
  url.searchParams.set('$top', String(Math.min(Math.max(input.top, 1), MAX_LOCATOR_CANDIDATES)));

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...(immutableIdPreference(input.idType) ? { prefer: immutableIdPreference(input.idType)! } : {}),
    },
    cache: 'no-store',
  });
  const payload = (await jsonObject(response)) as GraphMessageListPayload & GraphErrorPayload;
  if (!response.ok) throw graphReadError('message-search', response, payload, accessToken);
  if (!Array.isArray(payload.value)) {
    throw new MicrosoftGraphHttpError({
      operation: 'message-search',
      httpStatus: response.status,
      graphCode: 'InvalidResponse',
      requestId: graphRequestId(response),
      detail: 'Microsoft Graph returned no message list.',
    });
  }
  return payload.value.map(mapLocatorCandidate).filter((entry) => entry !== null);
}

/** Locate a message by its RFC business identity. Exactly one hit is expected. */
export async function findMicrosoftGraphMessagesByInternetMessageId(
  input: { accessToken: string; mailbox: string; internetMessageId: string; top?: number; idType?: MicrosoftGraphIdType },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphMessageLocatorCandidate[]> {
  const value = required(input.internetMessageId, 'Microsoft Graph internet message id');
  return searchMicrosoftGraphMessages(
    {
      accessToken: input.accessToken,
      mailbox: input.mailbox,
      filter: `internetMessageId eq ${odataStringLiteral(value)}`,
      top: input.top ?? 10,
      idType: input.idType,
    },
    fetchImpl,
  );
}

/** Locate a message's CONVERSATION. Never sufficient alone — see the resolver. */
export async function findMicrosoftGraphMessagesByConversationId(
  input: { accessToken: string; mailbox: string; conversationId: string; top?: number; idType?: MicrosoftGraphIdType },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphMessageLocatorCandidate[]> {
  const value = required(input.conversationId, 'Microsoft Graph conversation id');
  return searchMicrosoftGraphMessages(
    {
      accessToken: input.accessToken,
      mailbox: input.mailbox,
      filter: `conversationId eq ${odataStringLiteral(value)}`,
      top: input.top ?? MAX_LOCATOR_CANDIDATES,
      idType: input.idType,
    },
    fetchImpl,
  );
}

function mapAttachment(value: unknown): MicrosoftGraphAttachmentMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as GraphAttachmentPayload;
  const id = stringOrNull(raw.id);
  if (!id) return null;
  const size = Number(raw.size);
  return {
    id,
    name: stringOrNull(raw.name),
    contentType: stringOrNull(raw.contentType),
    size: Number.isFinite(size) && size >= 0 ? size : 0,
    isInline: raw.isInline === true,
    attachmentType: stringOrNull(raw['@odata.type']),
  };
}

/** List attachment metadata only. contentBytes is intentionally not selected. */
export async function fetchMicrosoftGraphAttachmentMetadata(
  input: { accessToken: string; mailbox: string; messageId: string; idType?: MicrosoftGraphIdType },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphAttachmentPage> {
  const accessToken = required(input.accessToken, 'Microsoft access token');
  const mailbox = required(input.mailbox, 'Microsoft mailbox');
  const messageId = required(input.messageId, 'Microsoft Graph message id');
  const url = new URL(
    `${MICROSOFT_GRAPH_API}/users/${encodeURIComponent(mailbox)}/messages/${encodeURIComponent(messageId)}/attachments`,
  );
  url.searchParams.set('$select', 'id,name,contentType,size,isInline');
  url.searchParams.set('$top', '10');
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...(immutableIdPreference(input.idType) ? { prefer: immutableIdPreference(input.idType)! } : {}),
    },
    cache: 'no-store',
  });
  const payload = (await jsonObject(response)) as GraphMessageListPayload & GraphErrorPayload;
  if (!response.ok) throw graphReadError('attachment-list', response, payload, accessToken);
  if (!Array.isArray(payload.value)) {
    throw new MicrosoftGraphHttpError({
      operation: 'attachment-list',
      httpStatus: response.status,
      graphCode: 'InvalidResponse',
      requestId: graphRequestId(response),
      detail: 'Microsoft Graph returned an invalid attachment list.',
    });
  }
  return {
    httpStatus: response.status,
    requestId: graphRequestId(response),
    attachments: payload.value.map(mapAttachment).filter((entry) => entry !== null),
  };
}

/** Copy one file attachment's bytes with a read-only GET to `$value`. */
export async function downloadMicrosoftGraphFileAttachment(
  input: {
    accessToken: string;
    mailbox: string;
    messageId: string;
    attachmentId: string;
    maxBytes: number;
    idType?: MicrosoftGraphIdType;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphAttachmentBytes> {
  const accessToken = required(input.accessToken, 'Microsoft access token');
  const mailbox = required(input.mailbox, 'Microsoft mailbox');
  const messageId = required(input.messageId, 'Microsoft Graph message id');
  const attachmentId = required(input.attachmentId, 'Microsoft Graph attachment id');
  if (!Number.isInteger(input.maxBytes) || input.maxBytes < 1) {
    throw new Error('Microsoft Graph attachment byte limit must be a positive integer.');
  }
  const url =
    `${MICROSOFT_GRAPH_API}/users/${encodeURIComponent(mailbox)}/messages/` +
    `${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`;
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      accept: 'application/octet-stream',
      authorization: `Bearer ${accessToken}`,
      ...(immutableIdPreference(input.idType) ? { prefer: immutableIdPreference(input.idType)! } : {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    const payload = (await jsonObject(response)) as GraphErrorPayload;
    throw graphReadError('attachment-download', response, payload, accessToken);
  }
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > input.maxBytes) {
    throw new MicrosoftGraphHttpError({
      operation: 'attachment-download',
      httpStatus: 413,
      graphCode: 'AttachmentTooLarge',
      requestId: graphRequestId(response),
      detail: 'Microsoft Graph attachment exceeds the Vyso processing limit.',
    });
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > input.maxBytes) {
    throw new MicrosoftGraphHttpError({
      operation: 'attachment-download',
      httpStatus: 413,
      graphCode: 'AttachmentTooLarge',
      requestId: graphRequestId(response),
      detail: 'Microsoft Graph attachment exceeds the Vyso processing limit.',
    });
  }
  return {
    httpStatus: response.status,
    requestId: graphRequestId(response),
    bytes,
    contentType: response.headers.get('content-type'),
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
    preferImmutableIds?: boolean;
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
      ...(input.preferImmutableIds ? { prefer: 'IdType="ImmutableId"' } : {}),
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
    idType?: MicrosoftGraphIdType;
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
      preferImmutableIds: input.idType === 'rest_immutable_entry_id',
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

export type MicrosoftGraphRenewalDecision = 'skip' | 'renew' | 'expired' | 'invalid';

/**
 * Pure decision: given the subscription's current expiration and "now", what
 * should a renewal tick do? No I/O — the caller supplies both dates so this
 * stays trivially unit-testable and reusable from a cron route or a CLI.
 *
 * Threshold defaults to 48h: a daily cron against a 6-day (SUBSCRIPTION_LIFETIME_MS)
 * lifetime renews roughly every 4 days, so a 48h trigger window still tolerates
 * two consecutive missed cron ticks before the subscription is at real risk of
 * lapsing.
 */
export function microsoftGraphRenewalDecision(input: {
  expirationDateTime: string | null | undefined;
  now: Date;
  thresholdMs?: number;
}): MicrosoftGraphRenewalDecision {
  const thresholdMs = input.thresholdMs ?? 48 * 60 * 60_000;
  if (!input.expirationDateTime) return 'invalid';
  const expiresAt = new Date(input.expirationDateTime);
  if (Number.isNaN(expiresAt.getTime())) return 'invalid';

  const remainingMs = expiresAt.getTime() - input.now.getTime();
  // A subscription Graph already considers expired cannot be renewed — Graph
  // rejects a PATCH against a dead subscription. Surfacing 'expired' (rather
  // than silently recreating it) keeps recreation a deliberate, documented
  // manual cutover instead of something a cron tick could trigger on its own.
  if (remainingMs <= 0) return 'expired';
  if (remainingMs <= thresholdMs) return 'renew';
  return 'skip';
}

export interface MicrosoftGraphRenewalResult {
  action: 'skipped' | 'renewed';
  expiresAt: string;
}

/**
 * One renewal tick, orchestrated over the read-only-except-PATCH subscription
 * surface. This function never issues any Graph request other than
 * GET/PATCH on /subscriptions/{id} — no POST /subscriptions (no recreation),
 * no /messages or /mailFolders calls, no ImmutableId changes.
 *
 * GET-first: Graph is the source of truth for the current expiration, so every
 * tick re-derives its decision from what Graph actually has rather than from
 * any locally assumed state. That is what makes repeated ticks idempotent —
 * running this an hour after a successful renewal just observes the new
 * expiration and skips, with no side effect either way.
 */
export async function runMicrosoftGraphSubscriptionRenewal(
  input: {
    accessToken: string;
    subscriptionId: string;
    now?: Date;
    thresholdMs?: number;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftGraphRenewalResult> {
  const now = input.now ?? new Date();
  const current = await getMicrosoftGraphSubscription(
    { accessToken: input.accessToken, subscriptionId: input.subscriptionId },
    fetchImpl,
  );

  const decision = microsoftGraphRenewalDecision({
    expirationDateTime: current.expirationDateTime,
    now,
    thresholdMs: input.thresholdMs,
  });

  if (decision === 'invalid') {
    throw new Error('Microsoft Graph returned a subscription with no usable expirationDateTime.');
  }
  if (decision === 'expired') {
    throw new Error(
      `Microsoft Graph subscription ${input.subscriptionId} has already expired; recreation is a manual cutover, not a cron action.`,
    );
  }
  if (decision === 'skip') {
    return { action: 'skipped', expiresAt: current.expirationDateTime };
  }

  const renewed = await renewMicrosoftGraphSubscription(
    { accessToken: input.accessToken, subscriptionId: input.subscriptionId },
    fetchImpl,
  );
  return { action: 'renewed', expiresAt: renewed.expirationDateTime };
}
