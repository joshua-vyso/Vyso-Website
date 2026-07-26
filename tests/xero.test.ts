import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildXeroAuthorizationUrl,
  decodeXeroAccessTokenClaims,
  decryptXeroSecret,
  encryptXeroSecret,
  hashXeroState,
  parseXeroEncryptionKey,
  parseXeroScopes,
} from '../lib/platform/xero-core.ts';

test('parseXeroScopes normalises whitespace and removes duplicates', () => {
  assert.deepEqual(
    parseXeroScopes(
      ' offline_access  accounting.invoices\naccounting.contacts accounting.invoices ',
    ),
    ['offline_access', 'accounting.invoices', 'accounting.contacts'],
  );
});

test('buildXeroAuthorizationUrl includes the exact callback, scopes and CSRF state', () => {
  const result = new URL(
    buildXeroAuthorizationUrl({
      clientId: 'client-123',
      redirectUri: 'https://vyso.co.za/api/integrations/xero/callback',
      scopes: ['offline_access', 'accounting.invoices'],
      state: 'state-123',
    }),
  );
  assert.equal(result.origin, 'https://login.xero.com');
  assert.equal(result.pathname, '/identity/connect/authorize');
  assert.equal(result.searchParams.get('response_type'), 'code');
  assert.equal(result.searchParams.get('client_id'), 'client-123');
  assert.equal(
    result.searchParams.get('redirect_uri'),
    'https://vyso.co.za/api/integrations/xero/callback',
  );
  assert.equal(result.searchParams.get('scope'), 'offline_access accounting.invoices');
  assert.equal(result.searchParams.get('state'), 'state-123');
});

test('decodeXeroAccessTokenClaims reads the Xero user and current auth event', () => {
  const payload = Buffer.from(
    JSON.stringify({
      xero_userid: '1945393b-6eb7-4143-b083-7ab26cd7690b',
      authentication_event_id: 'd0ddcf81-f942-4f4d-b3c7-f98045204db4',
      scope: ['offline_access', 'accounting.invoices'],
    }),
  ).toString('base64url');
  const claims = decodeXeroAccessTokenClaims(`header.${payload}.signature`);
  assert.deepEqual(claims, {
    xeroUserId: '1945393b-6eb7-4143-b083-7ab26cd7690b',
    authenticationEventId: 'd0ddcf81-f942-4f4d-b3c7-f98045204db4',
    scopes: ['offline_access', 'accounting.invoices'],
  });
  assert.equal(decodeXeroAccessTokenClaims('not-a-jwt'), null);
});

test('Xero secrets round-trip with AES-GCM and are bound to their authorization', () => {
  const key = parseXeroEncryptionKey(Buffer.alloc(32, 7).toString('base64'));
  const encrypted = encryptXeroSecret('refresh-token', key, 'xero:auth-1:user-1:refresh');
  assert.notEqual(encrypted, 'refresh-token');
  assert.equal(
    decryptXeroSecret(encrypted, key, 'xero:auth-1:user-1:refresh'),
    'refresh-token',
  );
  assert.throws(
    () => decryptXeroSecret(encrypted, key, 'xero:auth-2:user-1:refresh'),
    /Could not decrypt/,
  );
  assert.throws(() => parseXeroEncryptionKey('too-short'), /32-byte key/);
});

test('hashXeroState is stable without storing the raw OAuth state', () => {
  assert.equal(hashXeroState('secret-state'), hashXeroState('secret-state'));
  assert.notEqual(hashXeroState('secret-state'), hashXeroState('other-state'));
  assert.match(hashXeroState('secret-state'), /^[0-9a-f]{64}$/);
});
