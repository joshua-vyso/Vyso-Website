/**
 * Development-only, read-only Microsoft Graph + Exchange Application RBAC check.
 *
 * Usage:
 *   npm run verify:microsoft-graph
 *
 * Reads the existing Microsoft variables from process.env first, then .env.local.
 * It acquires one app token, reads up to five Inbox messages from the configured
 * orders mailbox, and confirms that joshua@turnnslice.com returns HTTP 403.
 * It never prints tokens, secrets, message subjects, sender names, or sender local
 * parts. It performs GET requests only and cannot mutate a mailbox.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MicrosoftGraphHttpError,
  acquireMicrosoftGraphAppToken,
  fetchRecentMicrosoftGraphInboxMessages,
  type MicrosoftGraphMessageMetadata,
} from '../lib/platform/microsoft-graph-core.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, '..', '.env.local');
const BLOCKED_MAILBOX = 'joshua@turnnslice.com';
const MESSAGE_LIMIT = 5;

function loadEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
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

function value(name: string, fileEnv: Record<string, string>): string {
  return (process.env[name] || fileEnv[name] || '').trim();
}

function senderDomain(message: MicrosoftGraphMessageMetadata): string {
  const address = message.from?.address ?? '';
  const separator = address.lastIndexOf('@');
  return separator >= 0 ? address.slice(separator + 1).toLowerCase() : 'unknown';
}

function logSafeMessages(messages: MicrosoftGraphMessageMetadata[]): void {
  for (const [index, message] of messages.entries()) {
    console.log(
      `  message ${index + 1}: received=${message.receivedDateTime ?? 'unknown'} ` +
        `attachments=${message.hasAttachments ? 'yes' : 'no'} ` +
        `senderDomain=${senderDomain(message)} ` +
        `subjectCharacters=${message.subject?.length ?? 0} idPresent=${Boolean(message.id)}`,
    );
  }
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
  for (const protectedValue of protectedValues) {
    if (protectedValue) message = message.replaceAll(protectedValue, '[redacted]');
  }
  return message;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run the Microsoft Graph development verifier in NODE_ENV=production.');
    process.exitCode = 1;
    return;
  }

  const fileEnv = loadEnvFile(ENV_PATH);
  const credentials = {
    clientId: value('ENTRA_APP_ID_TNS', fileEnv),
    tenantId: value('ENTRA_DIRECTORY_ID_TNS', fileEnv),
    clientSecret: value('MICROSOFT_CLIENT_SECRET', fileEnv),
  };
  const mailbox = value('MICROSOFT_MAILBOX', fileEnv);
  const protectedValues = [credentials.clientSecret, credentials.clientId, credentials.tenantId];

  const missing = [
    ['ENTRA_APP_ID_TNS', credentials.clientId],
    ['ENTRA_DIRECTORY_ID_TNS', credentials.tenantId],
    ['MICROSOFT_CLIENT_SECRET', credentials.clientSecret],
    ['MICROSOFT_MAILBOX', mailbox],
  ].filter(([, configured]) => !configured);
  if (missing.length > 0) {
    console.error(`Configuration: FAILED (missing ${missing.map(([name]) => name).join(', ')})`);
    process.exitCode = 1;
    return;
  }
  if (mailbox.toLowerCase() === BLOCKED_MAILBOX) {
    console.error('Configuration: FAILED (the allowed and blocked test mailboxes are identical)');
    process.exitCode = 1;
    return;
  }

  console.log('Microsoft Graph verification: READ-ONLY');
  console.log(`Allowed mailbox: ${mailbox}`);
  console.log(`Negative-control mailbox: ${BLOCKED_MAILBOX}`);

  let token;
  try {
    token = await acquireMicrosoftGraphAppToken(credentials);
    console.log(
      `Token acquisition: SUCCESS (HTTP ${token.httpStatus}, type=${token.tokenType}, ` +
        `expiresInSeconds=${token.expiresInSeconds})`,
    );
  } catch (error) {
    console.error(`Token acquisition: FAILED (${safeError(error, protectedValues)})`);
    process.exitCode = 1;
    return;
  }

  const secrets = [...protectedValues, token.accessToken];
  let allowedSucceeded = false;
  try {
    const page = await fetchRecentMicrosoftGraphInboxMessages({
      accessToken: token.accessToken,
      mailbox,
      top: MESSAGE_LIMIT,
    });
    allowedSucceeded = true;
    console.log(
      `${mailbox}: HTTP ${page.httpStatus} SUCCESS (${page.messages.length} message metadata record(s))`,
    );
    logSafeMessages(page.messages);
  } catch (error) {
    console.error(`${mailbox}: FAILED (${safeError(error, secrets)})`);
  }

  let blockedAsExpected = false;
  try {
    const page = await fetchRecentMicrosoftGraphInboxMessages({
      accessToken: token.accessToken,
      mailbox: BLOCKED_MAILBOX,
      top: MESSAGE_LIMIT,
    });
    console.error(
      `${BLOCKED_MAILBOX}: HTTP ${page.httpStatus} UNEXPECTED SUCCESS ` +
        '(Exchange Application RBAC did not block this mailbox)',
    );
  } catch (error) {
    if (error instanceof MicrosoftGraphHttpError && error.httpStatus === 403) {
      blockedAsExpected = true;
      console.log(`${BLOCKED_MAILBOX}: HTTP 403 BLOCKED AS EXPECTED`);
      console.log(`  RBAC response: ${safeError(error, secrets)}`);
    } else {
      console.error(`${BLOCKED_MAILBOX}: FAILED, expected HTTP 403 (${safeError(error, secrets)})`);
    }
  }

  if (!allowedSucceeded || !blockedAsExpected) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Microsoft Graph verification failed: ${safeError(error, [])}`);
  process.exitCode = 1;
});
