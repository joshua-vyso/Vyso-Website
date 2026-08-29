import 'server-only';

import {
  acquireMicrosoftGraphAppToken,
  createMicrosoftGraphInboxSubscription,
  fetchRecentMicrosoftGraphInboxMessages,
  getMicrosoftGraphSubscription,
  microsoftGraphIdTypeFromConfig,
  renewMicrosoftGraphSubscription,
  runMicrosoftGraphSubscriptionRenewal,
  type MicrosoftGraphAppToken,
  type MicrosoftGraphMessagePage,
  type MicrosoftGraphIdType,
  type MicrosoftGraphRenewalResult,
} from './microsoft-graph-core';

interface MicrosoftGraphServerConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  mailbox: string;
  clientState: string;
  webhookUrl: string;
  subscriptionId: string;
  idType: MicrosoftGraphIdType;
}

function configuredValue(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export const microsoftGraphConfigured = Boolean(
  configuredValue('ENTRA_APP_ID_TNS') &&
    configuredValue('ENTRA_DIRECTORY_ID_TNS') &&
    configuredValue('MICROSOFT_CLIENT_SECRET') &&
    configuredValue('MICROSOFT_MAILBOX'),
);

// Separate from microsoftGraphConfigured: the app registration can be fully
// configured while the one-time subscription id (created by the manual
// `npm run microsoft:subscription:create` step) is still missing. Callers that
// only need the subscription lifecycle — like the renewal cron — check this
// directly instead of relying on requireMicrosoftGraphConfig() to throw, so a
// missing id is a normal 503 guard rather than a caught exception.
export const microsoftGraphSubscriptionConfigured = Boolean(
  configuredValue('MICROSOFT_GRAPH_SUBSCRIPTION_ID'),
);

function requireMicrosoftGraphConfig(): MicrosoftGraphServerConfig {
  const config = {
    clientId: configuredValue('ENTRA_APP_ID_TNS'),
    tenantId: configuredValue('ENTRA_DIRECTORY_ID_TNS'),
    clientSecret: configuredValue('MICROSOFT_CLIENT_SECRET'),
    mailbox: configuredValue('MICROSOFT_MAILBOX'),
    clientState: configuredValue('MICROSOFT_GRAPH_CLIENT_STATE'),
    webhookUrl: configuredValue('MICROSOFT_GRAPH_WEBHOOK_URL'),
    subscriptionId: configuredValue('MICROSOFT_GRAPH_SUBSCRIPTION_ID'),
    idType: microsoftGraphIdTypeFromConfig(configuredValue('MICROSOFT_GRAPH_ID_TYPE')),
  };
  if (!config.clientId || !config.tenantId || !config.clientSecret || !config.mailbox) {
    throw new Error('Microsoft Graph order ingestion is not configured on the server.');
  }
  return config;
}

/** Acquire a short-lived app-only Graph token. Callers must never log the result. */
export async function getMicrosoftGraphAppToken(): Promise<MicrosoftGraphAppToken> {
  const config = requireMicrosoftGraphConfig();
  return acquireMicrosoftGraphAppToken(config);
}

/** Read recent metadata from the one mailbox configured for order ingestion. */
export async function readMicrosoftOrderInbox(
  accessToken: string,
  top = 5,
): Promise<MicrosoftGraphMessagePage> {
  const { mailbox, idType } = requireMicrosoftGraphConfig();
  return fetchRecentMicrosoftGraphInboxMessages({ accessToken, mailbox, top, idType });
}

export async function createMicrosoftOrderInboxSubscription(accessToken: string) {
  const config = requireMicrosoftGraphConfig();
  if (!config.clientState || !config.webhookUrl) {
    throw new Error('Microsoft Graph webhook configuration is incomplete.');
  }
  return createMicrosoftGraphInboxSubscription({
    accessToken,
    mailbox: config.mailbox,
    notificationUrl: config.webhookUrl,
    clientState: config.clientState,
    idType: config.idType,
  });
}

export async function inspectMicrosoftOrderInboxSubscription(accessToken: string) {
  const { subscriptionId } = requireMicrosoftGraphConfig();
  if (!subscriptionId) throw new Error('Microsoft Graph subscription id is not configured.');
  return getMicrosoftGraphSubscription({ accessToken, subscriptionId });
}

export async function renewMicrosoftOrderInboxSubscription(accessToken: string) {
  const { subscriptionId } = requireMicrosoftGraphConfig();
  if (!subscriptionId) throw new Error('Microsoft Graph subscription id is not configured.');
  return renewMicrosoftGraphSubscription({ accessToken, subscriptionId });
}

/** One renewal tick for the configured order-inbox subscription; see core for the decision logic. */
export async function runMicrosoftOrderInboxSubscriptionRenewal(
  accessToken: string,
): Promise<MicrosoftGraphRenewalResult> {
  const { subscriptionId } = requireMicrosoftGraphConfig();
  if (!subscriptionId) throw new Error('Microsoft Graph subscription id is not configured.');
  return runMicrosoftGraphSubscriptionRenewal({ accessToken, subscriptionId });
}
