import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';

export interface XeroAccessTokenClaims {
  xeroUserId: string;
  authenticationEventId: string;
  scopes: string[];
}

export function parseXeroScopes(value: string): string[] {
  return [...new Set(value.split(/\s+/).map((scope) => scope.trim()).filter(Boolean))];
}

export function hashXeroState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export function buildXeroAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const url = new URL(XERO_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('scope', input.scopes.join(' '));
  url.searchParams.set('state', input.state);
  return url.toString();
}

function decodeBase64UrlJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
  } catch {
    return null;
  }
}

export function decodeXeroAccessTokenClaims(token: string): XeroAccessTokenClaims | null {
  const payloadPart = token.split('.')[1];
  if (!payloadPart) return null;
  const payload = decodeBase64UrlJson(payloadPart);
  if (!payload || typeof payload !== 'object') return null;

  const claims = payload as Record<string, unknown>;
  const xeroUserId = claims.xero_userid;
  const authenticationEventId = claims.authentication_event_id;
  const rawScopes = claims.scope;
  const scopes = Array.isArray(rawScopes)
    ? rawScopes.filter((scope): scope is string => typeof scope === 'string')
    : typeof rawScopes === 'string'
      ? parseXeroScopes(rawScopes)
      : [];

  if (typeof xeroUserId !== 'string' || typeof authenticationEventId !== 'string') return null;
  return { xeroUserId, authenticationEventId, scopes };
}

export function parseXeroEncryptionKey(value: string): Buffer {
  const key = Buffer.from(value.trim(), 'base64');
  if (key.length !== 32) {
    throw new Error('XERO_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

export function encryptXeroSecret(value: string, key: Buffer, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptXeroSecret(value: string, key: Buffer, aad: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = value.split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted Xero credential.');
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error('Could not decrypt the Xero credential.');
  }
}
