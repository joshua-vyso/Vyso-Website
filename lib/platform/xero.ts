import 'server-only';

import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceSupabase } from './supabase-service';
import { getPlatformSession } from './supabase-server';
import {
  buildXeroAuthorizationUrl,
  decodeXeroAccessTokenClaims,
  decryptXeroSecret,
  encryptXeroSecret,
  hashXeroState,
  parseXeroEncryptionKey,
  parseXeroScopes,
} from './xero-core';

const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_REVOCATION_URL = 'https://identity.xero.com/connect/revocation';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';
const REQUIRED_SCOPES = [
  'offline_access',
  'accounting.invoices',
  'accounting.contacts',
  'accounting.settings.read',
  'accounting.payments.read',
] as const;
const OAUTH_STATE_TTL_MS = 10 * 60_000;
const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60_000;
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

export interface XeroServerContext {
  service: SupabaseClient;
  orgId: string;
  userId: string;
}

interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  encryptionKey: Buffer;
}

interface XeroTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface XeroConnectionResponse {
  id: string;
  authEventId: string;
  tenantId: string;
  tenantType: string;
  tenantName: string | null;
  createdDateUtc: string;
  updatedDateUtc: string;
}

interface StoredConnection {
  id: string;
  org_id: string;
  authorisation_id: string;
  xero_tenant_id: string;
  xero_connection_id: string;
  tenant_name: string;
  status: string;
}

interface StoredAuthorisation {
  id: string;
  xero_user_id: string;
  status: string;
}

interface StoredCredential {
  authorisation_id: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  token_version: number;
}

function configuredValue(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export const xeroOAuthConfigured = Boolean(
  configuredValue('XERO_CLIENT_ID') &&
    configuredValue('XERO_CLIENT_SECRET') &&
    configuredValue('XERO_REDIRECT_URI') &&
    configuredValue('XERO_SCOPES') &&
    configuredValue('XERO_TOKEN_ENCRYPTION_KEY'),
);

function requireXeroConfig(): XeroConfig {
  const clientId = configuredValue('XERO_CLIENT_ID');
  const clientSecret = configuredValue('XERO_CLIENT_SECRET');
  const redirectUri = configuredValue('XERO_REDIRECT_URI');
  const scopes = parseXeroScopes(configuredValue('XERO_SCOPES'));
  const encryptionKeyRaw = configuredValue('XERO_TOKEN_ENCRYPTION_KEY');
  if (!clientId || !clientSecret || !redirectUri || scopes.length === 0 || !encryptionKeyRaw) {
    throw new Error('Xero is not configured on the server.');
  }

  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
  } catch {
    throw new Error('XERO_REDIRECT_URI must be an absolute URL.');
  }
  if (
    parsedRedirect.protocol !== 'https:' &&
    !(parsedRedirect.protocol === 'http:' && parsedRedirect.hostname === 'localhost')
  ) {
    throw new Error('XERO_REDIRECT_URI must use HTTPS, except on localhost.');
  }

  const missingScope = REQUIRED_SCOPES.find((scope) => !scopes.includes(scope));
  if (missingScope) throw new Error(`XERO_SCOPES is missing ${missingScope}.`);

  return {
    clientId,
    clientSecret,
    redirectUri: parsedRedirect.toString(),
    scopes,
    encryptionKey: parseXeroEncryptionKey(encryptionKeyRaw),
  };
}

function basicAuthorization(config: XeroConfig): string {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64')}`;
}

function tokenAad(
  authorisationId: string,
  xeroUserId: string,
  tokenType: 'access' | 'refresh',
): string {
  return `xero:${authorisationId}:${xeroUserId}:${tokenType}`;
}

function expiryFromNow(milliseconds: number): string {
  return new Date(Date.now() + milliseconds).toISOString();
}

async function xeroTokenRequest(
  params: URLSearchParams,
  config: XeroConfig,
): Promise<XeroTokenResponse> {
  const response = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: basicAuthorization(config),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: params,
    cache: 'no-store',
  });
  const result = (await response.json().catch(() => ({}))) as XeroTokenResponse;
  if (!response.ok || !result.access_token) {
    const reason =
      result.error_description || result.error || `Xero OAuth returned ${response.status}.`;
    throw new Error(reason);
  }
  return result;
}

async function exchangeAuthorizationCode(
  code: string,
  config: XeroConfig,
): Promise<XeroTokenResponse> {
  const result = await xeroTokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
    config,
  );
  if (!result.refresh_token) {
    throw new Error('Xero did not return a refresh token. Check that offline_access is requested.');
  }
  return result;
}

async function fetchNewConnections(
  accessToken: string,
  authenticationEventId: string,
): Promise<XeroConnectionResponse[]> {
  const url = new URL(XERO_CONNECTIONS_URL);
  url.searchParams.set('authEventId', authenticationEventId);
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  const result = (await response.json().catch(() => null)) as XeroConnectionResponse[] | null;
  if (!response.ok || !Array.isArray(result)) {
    throw new Error(`Xero connections returned ${response.status}.`);
  }
  return result;
}

async function consumeOAuthState(ctx: XeroServerContext, state: string): Promise<void> {
  const stateHash = hashXeroState(state);
  const now = new Date().toISOString();
  const { data, error } = await ctx.service
    .from('xero_oauth_states')
    .update({ consumed_at: now })
    .eq('state_hash', stateHash)
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .is('consumed_at', null)
    .gt('expires_at', now)
    .select('state_hash')
    .maybeSingle();
  if (error || !data) {
    throw new Error('This Xero connection request expired or was already used.');
  }
}

async function saveAuthorization(
  ctx: XeroServerContext,
  token: XeroTokenResponse,
  xeroUserId: string,
  scopes: string[],
): Promise<StoredAuthorisation> {
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await ctx.service
    .from('xero_authorisations')
    .select('id, xero_user_id, status')
    .eq('xero_user_id', xeroUserId)
    .maybeSingle<StoredAuthorisation>();
  if (existingError) throw new Error(`Could not read Xero authorization: ${existingError.message}`);

  let authorisation: StoredAuthorisation;
  if (existing) {
    const { data, error } = await ctx.service
      .from('xero_authorisations')
      .update({
        connected_by_user_id: ctx.userId,
        scopes,
        status: 'active',
        last_error: null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('id, xero_user_id, status')
      .single<StoredAuthorisation>();
    if (error || !data) throw new Error(`Could not update Xero authorization: ${error?.message}`);
    authorisation = data;
  } else {
    const { data, error } = await ctx.service
      .from('xero_authorisations')
      .insert({
        connected_by_user_id: ctx.userId,
        xero_user_id: xeroUserId,
        scopes,
        status: 'active',
      })
      .select('id, xero_user_id, status')
      .single<StoredAuthorisation>();
    if (error || !data) throw new Error(`Could not store Xero authorization: ${error?.message}`);
    authorisation = data;
  }

  const { data: currentCredential, error: credentialReadError } = await ctx.service
    .from('xero_credentials')
    .select('token_version')
    .eq('authorisation_id', authorisation.id)
    .maybeSingle<{ token_version: number }>();
  if (credentialReadError) {
    throw new Error(`Could not read Xero credentials: ${credentialReadError.message}`);
  }

  const accessToken = String(token.access_token);
  const refreshToken = String(token.refresh_token);
  const expiresInSeconds =
    typeof token.expires_in === 'number' && token.expires_in > 0 ? token.expires_in : 1_800;
  const tokenVersion = (currentCredential?.token_version ?? 0) + 1;
  const { error: credentialError } = await ctx.service.from('xero_credentials').upsert(
    {
      authorisation_id: authorisation.id,
      encrypted_access_token: encryptXeroSecret(
        accessToken,
        requireXeroConfig().encryptionKey,
        tokenAad(authorisation.id, xeroUserId, 'access'),
      ),
      encrypted_refresh_token: encryptXeroSecret(
        refreshToken,
        requireXeroConfig().encryptionKey,
        tokenAad(authorisation.id, xeroUserId, 'refresh'),
      ),
      access_token_expires_at: expiryFromNow(expiresInSeconds * 1_000),
      refresh_token_expires_at: expiryFromNow(REFRESH_TOKEN_TTL_MS),
      token_version: tokenVersion,
      refreshed_at: now,
      updated_at: now,
    },
    { onConflict: 'authorisation_id' },
  );
  if (credentialError) throw new Error(`Could not store Xero credentials: ${credentialError.message}`);
  return authorisation;
}

async function saveTenantConnection(
  ctx: XeroServerContext,
  authorisationId: string,
  xeroConnection: XeroConnectionResponse,
): Promise<StoredConnection> {
  const { data: tenantOwner, error: ownerError } = await ctx.service
    .from('xero_connections')
    .select('id, org_id')
    .eq('xero_tenant_id', xeroConnection.tenantId)
    .maybeSingle<{ id: string; org_id: string }>();
  if (ownerError) throw new Error(`Could not check the Xero tenant: ${ownerError.message}`);
  if (tenantOwner && tenantOwner.org_id !== ctx.orgId) {
    throw new Error('That Xero organisation is already connected to another Vyso organisation.');
  }

  const { data: existing, error: existingError } = await ctx.service
    .from('xero_connections')
    .select('id, org_id, authorisation_id, xero_tenant_id, xero_connection_id, tenant_name, status')
    .eq('org_id', ctx.orgId)
    .maybeSingle<StoredConnection>();
  if (existingError) throw new Error(`Could not read the Xero connection: ${existingError.message}`);
  if (
    existing &&
    existing.status !== 'disconnected' &&
    existing.xero_tenant_id !== xeroConnection.tenantId
  ) {
    throw new Error('Disconnect the current Xero organisation before connecting a different one.');
  }

  const values = {
    org_id: ctx.orgId,
    authorisation_id: authorisationId,
    connected_by_user_id: ctx.userId,
    xero_tenant_id: xeroConnection.tenantId,
    xero_connection_id: xeroConnection.id,
    tenant_name: xeroConnection.tenantName || 'Xero organisation',
    tenant_type: 'ORGANISATION',
    status: 'connected',
    last_error: null,
    updated_at: new Date().toISOString(),
  };
  const query = existing
    ? ctx.service.from('xero_connections').update(values).eq('id', existing.id)
    : ctx.service.from('xero_connections').insert(values);
  const { data, error } = await query
    .select('id, org_id, authorisation_id, xero_tenant_id, xero_connection_id, tenant_name, status')
    .single<StoredConnection>();
  if (error || !data) throw new Error(`Could not store the Xero connection: ${error?.message}`);
  return data;
}

export async function requireXeroServerContext(): Promise<XeroServerContext | null> {
  const session = await getPlatformSession();
  if (
    !session?.org ||
    !session.profile ||
    (session.profile.role !== 'owner' && session.profile.role !== 'admin')
  ) {
    return null;
  }
  const service = createServiceSupabase();
  if (!service) return null;
  return { service, orgId: session.org.id, userId: session.userId };
}

export async function createXeroAuthorizationUrl(ctx: XeroServerContext): Promise<string> {
  const config = requireXeroConfig();
  const state = randomBytes(32).toString('base64url');
  const now = new Date().toISOString();
  await ctx.service
    .from('xero_oauth_states')
    .delete()
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .lt('expires_at', now);

  const { error } = await ctx.service.from('xero_oauth_states').insert({
    state_hash: hashXeroState(state),
    org_id: ctx.orgId,
    user_id: ctx.userId,
    return_path: '/app/settings',
    expires_at: expiryFromNow(OAUTH_STATE_TTL_MS),
  });
  if (error) throw new Error(`Could not begin the Xero connection: ${error.message}`);

  return buildXeroAuthorizationUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    state,
  });
}

export async function finishXeroAuthorization(
  ctx: XeroServerContext,
  input: { code: string; state: string },
): Promise<{ tenantName: string }> {
  const config = requireXeroConfig();
  await consumeOAuthState(ctx, input.state);
  const token = await exchangeAuthorizationCode(input.code, config);
  const claims = decodeXeroAccessTokenClaims(String(token.access_token));
  if (!claims) throw new Error('Xero returned an invalid access token.');

  const newlyAuthorized = (await fetchNewConnections(
    String(token.access_token),
    claims.authenticationEventId,
  )).filter((connection) => connection.tenantType === 'ORGANISATION');
  if (newlyAuthorized.length === 0) {
    throw new Error('Xero did not return an authorised organisation.');
  }
  if (newlyAuthorized.length > 1) {
    throw new Error('Please connect one Xero organisation at a time.');
  }

  const grantedScopes =
    claims.scopes.length > 0 ? claims.scopes : parseXeroScopes(token.scope ?? '');
  const authorisation = await saveAuthorization(ctx, token, claims.xeroUserId, grantedScopes);
  const connection = await saveTenantConnection(ctx, authorisation.id, newlyAuthorized[0]);
  return { tenantName: connection.tenant_name };
}

async function readConnectionAndCredential(
  ctx: XeroServerContext,
): Promise<{
  connection: StoredConnection;
  authorisation: StoredAuthorisation;
  credential: StoredCredential;
}> {
  const { data: connection, error: connectionError } = await ctx.service
    .from('xero_connections')
    .select('id, org_id, authorisation_id, xero_tenant_id, xero_connection_id, tenant_name, status')
    .eq('org_id', ctx.orgId)
    .maybeSingle<StoredConnection>();
  if (connectionError || !connection) {
    throw new Error(connectionError?.message || 'Xero connection not found.');
  }

  const [{ data: authorisation, error: authError }, { data: credential, error: credentialError }] =
    await Promise.all([
      ctx.service
        .from('xero_authorisations')
        .select('id, xero_user_id, status')
        .eq('id', connection.authorisation_id)
        .maybeSingle<StoredAuthorisation>(),
      ctx.service
        .from('xero_credentials')
        .select(
          'authorisation_id, encrypted_access_token, encrypted_refresh_token, access_token_expires_at, refresh_token_expires_at, token_version',
        )
        .eq('authorisation_id', connection.authorisation_id)
        .maybeSingle<StoredCredential>(),
    ]);
  if (authError || !authorisation) throw new Error(authError?.message || 'Xero authorization not found.');
  if (credentialError || !credential) {
    throw new Error(credentialError?.message || 'Xero needs to be reconnected.');
  }
  return { connection, authorisation, credential };
}

async function markAuthorisationForReconnect(
  ctx: XeroServerContext,
  authorisationId: string,
  message: string,
): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all([
    ctx.service
      .from('xero_authorisations')
      .update({ status: 'reauth_required', last_error: message.slice(0, 1_000), updated_at: now })
      .eq('id', authorisationId),
    ctx.service
      .from('xero_connections')
      .update({ status: 'reauth_required', last_error: message.slice(0, 1_000), updated_at: now })
      .eq('authorisation_id', authorisationId)
      .neq('status', 'disconnected'),
  ]);
}

async function getXeroAccessToken(
  ctx: XeroServerContext,
  stored?: Awaited<ReturnType<typeof readConnectionAndCredential>>,
): Promise<{ accessToken: string; connection: StoredConnection; authorisation: StoredAuthorisation }> {
  const config = requireXeroConfig();
  const current = stored ?? (await readConnectionAndCredential(ctx));
  const { connection, authorisation, credential } = current;
  const accessAad = tokenAad(authorisation.id, authorisation.xero_user_id, 'access');
  const refreshAad = tokenAad(authorisation.id, authorisation.xero_user_id, 'refresh');
  if (
    new Date(credential.access_token_expires_at).getTime() >
    Date.now() + ACCESS_TOKEN_REFRESH_SKEW_MS
  ) {
    return {
      accessToken: decryptXeroSecret(
        credential.encrypted_access_token,
        config.encryptionKey,
        accessAad,
      ),
      connection,
      authorisation,
    };
  }

  const refreshToken = decryptXeroSecret(
    credential.encrypted_refresh_token,
    config.encryptionKey,
    refreshAad,
  );
  let refreshed: XeroTokenResponse;
  try {
    refreshed = await xeroTokenRequest(
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      config,
    );
    if (!refreshed.refresh_token) throw new Error('Xero did not rotate the refresh token.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Xero token refresh failed.';
    if (/invalid_grant|expired|revoked/i.test(message)) {
      await markAuthorisationForReconnect(ctx, authorisation.id, message);
    }
    throw error;
  }

  const now = new Date().toISOString();
  const expiresInSeconds =
    typeof refreshed.expires_in === 'number' && refreshed.expires_in > 0
      ? refreshed.expires_in
      : 1_800;
  const { data: wonRefresh, error: updateError } = await ctx.service
    .from('xero_credentials')
    .update({
      encrypted_access_token: encryptXeroSecret(
        String(refreshed.access_token),
        config.encryptionKey,
        accessAad,
      ),
      encrypted_refresh_token: encryptXeroSecret(
        String(refreshed.refresh_token),
        config.encryptionKey,
        refreshAad,
      ),
      access_token_expires_at: expiryFromNow(expiresInSeconds * 1_000),
      refresh_token_expires_at: expiryFromNow(REFRESH_TOKEN_TTL_MS),
      token_version: credential.token_version + 1,
      refreshed_at: now,
      updated_at: now,
    })
    .eq('authorisation_id', authorisation.id)
    .eq('token_version', credential.token_version)
    .select('authorisation_id')
    .maybeSingle();
  if (updateError) throw new Error(`Could not rotate Xero credentials: ${updateError.message}`);
  if (!wonRefresh) {
    const latest = await readConnectionAndCredential(ctx);
    return {
      accessToken: decryptXeroSecret(
        latest.credential.encrypted_access_token,
        config.encryptionKey,
        accessAad,
      ),
      connection: latest.connection,
      authorisation: latest.authorisation,
    };
  }
  return { accessToken: String(refreshed.access_token), connection, authorisation };
}

async function appConnectionsAccessToken(config: XeroConfig): Promise<string> {
  const token = await xeroTokenRequest(
    new URLSearchParams({ grant_type: 'client_credentials', scope: 'app.connections' }),
    config,
  );
  return String(token.access_token);
}

async function deleteXeroConnection(
  connectionId: string,
  accessToken: string,
): Promise<Response> {
  return fetch(`${XERO_CONNECTIONS_URL}/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
}

export async function disconnectXero(
  ctx: XeroServerContext,
): Promise<{ warning: string | null }> {
  const config = requireXeroConfig();
  const stored = await readConnectionAndCredential(ctx);
  let accessToken = '';
  let warning: string | null = null;
  try {
    accessToken = (await getXeroAccessToken(ctx, stored)).accessToken;
  } catch {
    try {
      accessToken = await appConnectionsAccessToken(config);
    } catch {
      warning =
        'Vyso stopped syncing, but could not reach Xero to remove the remote connection. Remove it from Xero Connected Apps if needed.';
    }
  }

  const now = new Date().toISOString();
  const { error: localError } = await ctx.service
    .from('xero_connections')
    .update({ status: 'disconnected', last_error: null, updated_at: now })
    .eq('id', stored.connection.id)
    .eq('org_id', ctx.orgId);
  if (localError) throw new Error(`Could not disconnect Xero locally: ${localError.message}`);

  if (accessToken) {
    try {
      const response = await deleteXeroConnection(stored.connection.xero_connection_id, accessToken);
      if (!response.ok && response.status !== 404) {
        warning = `Vyso stopped syncing, but Xero returned ${response.status} while removing the remote connection.`;
      }
    } catch {
      warning =
        'Vyso stopped syncing, but Xero could not be reached. Remove Vyso from Xero Connected Apps if needed.';
    }
  }

  const { count, error: countError } = await ctx.service
    .from('xero_connections')
    .select('id', { count: 'exact', head: true })
    .eq('authorisation_id', stored.authorisation.id)
    .neq('status', 'disconnected');
  if (!countError && (count ?? 0) === 0) {
    if (accessToken) {
      try {
        const refreshToken = decryptXeroSecret(
          stored.credential.encrypted_refresh_token,
          config.encryptionKey,
          tokenAad(stored.authorisation.id, stored.authorisation.xero_user_id, 'refresh'),
        );
        await fetch(XERO_REVOCATION_URL, {
          method: 'POST',
          headers: {
            authorization: basicAuthorization(config),
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ token: refreshToken }),
          cache: 'no-store',
        });
      } catch {
        // The tenant connection is already disabled locally; remote cleanup is best effort.
      }
    }
    await Promise.all([
      ctx.service
        .from('xero_credentials')
        .delete()
        .eq('authorisation_id', stored.authorisation.id),
      ctx.service
        .from('xero_authorisations')
        .update({ status: 'revoked', last_error: null, updated_at: now })
        .eq('id', stored.authorisation.id),
    ]);
  }
  return { warning };
}
