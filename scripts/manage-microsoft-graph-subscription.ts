/**
 * Development/admin-only Microsoft Graph subscription lifecycle command.
 *
 * Commands (normally invoked through package.json):
 *   init     Generate MICROSOFT_GRAPH_CLIENT_STATE into ignored .env.local.
 *   create   Create the Inbox `created` subscription after the webhook is live.
 *   inspect  Read the configured subscription's safe metadata.
 *   renew    PATCH expirationDateTime only, six days from now.
 *
 * No command reads a message or mutates mailbox state. Secrets and bearer tokens
 * are never printed. Automated renewal belongs in a later milestone.
 */

import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MicrosoftGraphHttpError,
  acquireMicrosoftGraphAppToken,
  createMicrosoftGraphInboxSubscription,
  getMicrosoftGraphSubscription,
  renewMicrosoftGraphSubscription,
  type MicrosoftGraphSubscription,
} from '../lib/platform/microsoft-graph-core.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, '..', '.env.local');
const CLIENT_STATE_KEY = 'MICROSOFT_GRAPH_CLIENT_STATE';
const WEBHOOK_URL_KEY = 'MICROSOFT_GRAPH_WEBHOOK_URL';
const SUBSCRIPTION_ID_KEY = 'MICROSOFT_GRAPH_SUBSCRIPTION_ID';
const PRODUCTION_WEBHOOK_URL = 'https://vyso.co.za/api/integrations/microsoft/webhook';
const MODES = ['init', 'create', 'inspect', 'renew'] as const;
type Mode = (typeof MODES)[number];

function loadEnvText(): string {
  try {
    return readFileSync(ENV_PATH, 'utf8');
  } catch {
    return '';
  }
}

function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals <= 0) continue;
    const key = line.slice(0, equals).replace(/^export\s+/, '').trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

function configured(name: string, fileEnv: Record<string, string>): string {
  return (process.env[name] || fileEnv[name] || '').trim();
}

function initClientState(): void {
  const currentText = loadEnvText();
  const currentEnv = parseEnv(currentText);
  const current = currentEnv[CLIENT_STATE_KEY]?.trim();
  const webhookUrl = currentEnv[WEBHOOK_URL_KEY]?.trim();
  const hasSubscriptionLine = new RegExp(`^${SUBSCRIPTION_ID_KEY}=`, 'm').test(currentText);
  if (current && webhookUrl && hasSubscriptionLine) {
    console.log('Microsoft Graph webhook env: already initialized; no change made.');
    return;
  }

  const secret = current || randomBytes(32).toString('base64url');
  const linePattern = new RegExp(`^${CLIENT_STATE_KEY}=.*$`, 'm');
  const base = currentText && !currentText.endsWith('\n') ? `${currentText}\n` : currentText;
  let next = linePattern.test(base)
    ? base.replace(linePattern, `${CLIENT_STATE_KEY}=${secret}`)
    : `${base}${base ? '\n' : ''}# Microsoft Graph webhook authentication (generated locally; never commit)\n${CLIENT_STATE_KEY}=${secret}\n`;
  if (!webhookUrl) next += `${WEBHOOK_URL_KEY}=${PRODUCTION_WEBHOOK_URL}\n`;
  if (!hasSubscriptionLine) next += `${SUBSCRIPTION_ID_KEY}=\n`;
  writeFileSync(ENV_PATH, next, { encoding: 'utf8', mode: 0o600 });
  chmodSync(ENV_PATH, 0o600);
  console.log(
    `${CLIENT_STATE_KEY}: ${current ? 'preserved' : 'generated'} in ignored .env.local (value not printed).`,
  );
  console.log(`${WEBHOOK_URL_KEY}: configured for vyso.co.za.`);
  console.log(`${SUBSCRIPTION_ID_KEY}: present and intentionally empty until creation.`);
}

function required(
  names: readonly string[],
  fileEnv: Record<string, string>,
): Record<string, string> {
  const values = Object.fromEntries(names.map((name) => [name, configured(name, fileEnv)]));
  const missing = names.filter((name) => !values[name]);
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}.`);
  return values;
}

function safeError(error: unknown, protectedValues: readonly string[]): string {
  let message: string;
  if (error instanceof MicrosoftGraphHttpError) {
    const code = error.graphCode ? ` code=${error.graphCode}` : '';
    const requestId = error.requestId ? ` requestId=${error.requestId}` : '';
    message = `HTTP ${error.httpStatus}${code}${requestId}; ${error.message}`;
  } else {
    message = error instanceof Error ? error.message : String(error);
  }
  for (const value of protectedValues) {
    if (value) message = message.replaceAll(value, '[redacted]');
  }
  return message;
}

function printSubscription(label: string, subscription: MicrosoftGraphSubscription): void {
  const notificationUrl = new URL(subscription.notificationUrl);
  const expiresAt = Date.parse(subscription.expirationDateTime);
  const status = Number.isFinite(expiresAt) && expiresAt > Date.now() ? 'active' : 'expired';
  console.log(`${label}: HTTP ${subscription.httpStatus}`);
  console.log(`subscriptionId: ${subscription.id}`);
  console.log(`resource: ${subscription.resource}`);
  console.log(`changeType: ${subscription.changeType}`);
  console.log(`expirationDateTime: ${subscription.expirationDateTime}`);
  console.log(`notificationUrl: ${notificationUrl.host}${notificationUrl.pathname}`);
  console.log(`status: ${status}`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the Microsoft Graph admin command in NODE_ENV=production.');
  }
  const rawMode = process.argv[2];
  if (!MODES.includes(rawMode as Mode)) {
    throw new Error(`Usage: node scripts/manage-microsoft-graph-subscription.ts ${MODES.join('|')}`);
  }
  const mode = rawMode as Mode;
  if (mode === 'init') {
    initClientState();
    return;
  }

  const fileEnv = parseEnv(loadEnvText());
  const base = required(
    ['ENTRA_APP_ID_TNS', 'ENTRA_DIRECTORY_ID_TNS', 'MICROSOFT_CLIENT_SECRET'],
    fileEnv,
  );
  const credentials = {
    clientId: base.ENTRA_APP_ID_TNS,
    tenantId: base.ENTRA_DIRECTORY_ID_TNS,
    clientSecret: base.MICROSOFT_CLIENT_SECRET,
  };
  const protectedValues = [credentials.clientSecret, credentials.clientId, credentials.tenantId];

  let accessToken = '';
  try {
    const token = await acquireMicrosoftGraphAppToken(credentials);
    accessToken = token.accessToken;
    console.log(`Token acquisition: HTTP ${token.httpStatus} SUCCESS`);

    if (mode === 'create') {
      const createConfig = required(
        ['MICROSOFT_MAILBOX', 'MICROSOFT_GRAPH_CLIENT_STATE', 'MICROSOFT_GRAPH_WEBHOOK_URL'],
        fileEnv,
      );
      const subscription = await createMicrosoftGraphInboxSubscription({
        accessToken,
        mailbox: createConfig.MICROSOFT_MAILBOX,
        notificationUrl: createConfig.MICROSOFT_GRAPH_WEBHOOK_URL,
        clientState: createConfig.MICROSOFT_GRAPH_CLIENT_STATE,
      });
      printSubscription('Subscription creation', subscription);
      console.log(
        'Next: store subscriptionId as MICROSOFT_GRAPH_SUBSCRIPTION_ID in local and Vercel env, then redeploy before accepting notifications.',
      );
      return;
    }

    const { MICROSOFT_GRAPH_SUBSCRIPTION_ID: subscriptionId } = required(
      ['MICROSOFT_GRAPH_SUBSCRIPTION_ID'],
      fileEnv,
    );
    const subscription =
      mode === 'inspect'
        ? await getMicrosoftGraphSubscription({ accessToken, subscriptionId })
        : await renewMicrosoftGraphSubscription({ accessToken, subscriptionId });
    printSubscription(mode === 'inspect' ? 'Subscription inspection' : 'Subscription renewal', subscription);
  } catch (error) {
    throw new Error(safeError(error, [...protectedValues, accessToken]));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Microsoft Graph subscription command failed.');
  process.exitCode = 1;
});
