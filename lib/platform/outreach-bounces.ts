import { getGmailAccessToken } from '@/lib/platform/serviceden-gmail';
import { activeGmailConnection, addressOf } from '@/lib/platform/outreach-drafts';
import type { OutreachLead } from '@/lib/platform/notion-outreach';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Delivery reports, wherever they come from. Postfix, Exchange and Google all
 * word this differently, so the query is deliberately broad and the matching
 * below does the real filtering.
 */
const BOUNCE_QUERY = [
  'from:mailer-daemon',
  'from:postmaster',
  'subject:"Delivery Status Notification"',
  'subject:"Undelivered Mail Returned to Sender"',
  'subject:"Undeliverable"',
  'subject:"Delivery has failed"',
  'subject:"Address not found"',
].join(' OR ');

export type BounceKind = 'hard' | 'soft';

export type OutreachBounce = {
  messageId: string;
  /** The address the report says failed. */
  email: string;
  /** 5.x.x is permanent, 4.x.x is a retryable delay. */
  kind: BounceKind;
  status: string;
  reason: string;
  failedAt: string;
  leadId: string | null;
  company: string | null;
  campaign: string | null;
  stage: string | null;
  phone: string | null;
  website: string | null;
};

type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: { name?: string; value?: string }[];
};
type GmailMessage = { id?: string; internalDate?: string; payload?: GmailPart };

async function gmail<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gmail ${response.status}: ${detail.slice(0, 200) || response.statusText}`);
  }
  return (await response.json()) as T;
}

function decode(data: string | undefined): string {
  if (!data) return '';
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/** Flatten every text-ish part; the delivery-status part is where the truth is,
 *  but the human-readable part often carries the clearer reason string. */
function textOf(part: GmailPart | undefined, out: string[] = []): string[] {
  if (!part) return out;
  const mime = (part.mimeType ?? '').toLowerCase();
  if (mime.startsWith('text/') || mime === 'message/delivery-status' || mime === 'message/rfc822') {
    const body = decode(part.body?.data);
    if (body) out.push(body);
  }
  for (const child of part.parts ?? []) textOf(child, out);
  return out;
}

/**
 * Pull the failed recipient and status out of a delivery report.
 *
 * Prefers the RFC 3464 `Final-Recipient` / `Status` fields, which are machine
 * written. Falls back to any known lead address appearing in the text, because
 * plenty of servers still send prose-only rejections.
 */
function parseBounce(text: string, leadEmails: Set<string>): { email: string; status: string; reason: string } | null {
  const final = text.match(/Final-Recipient:\s*(?:rfc822;)?\s*([^\s<>]+@[^\s<>]+)/i);
  const original = text.match(/Original-Recipient:\s*(?:rfc822;)?\s*([^\s<>]+@[^\s<>]+)/i);
  const status = text.match(/Status:\s*([245]\.\d+\.\d+)/i)?.[1] ?? '';

  let email = addressOf(final?.[1] ?? original?.[1] ?? '');
  if (!email || !leadEmails.has(email)) {
    // Prose-only report: the only address in it that we recognise is the one
    // that failed. Anything else would be our own sender or the postmaster.
    const candidates = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/g) ?? [])
      .map((a) => a.toLowerCase())
      .filter((a) => leadEmails.has(a));
    email = candidates[0] ?? '';
  }
  if (!email) return null;

  const reason =
    text.match(/(?:Diagnostic-Code:\s*(?:smtp;)?\s*)([^\n\r]{0,160})/i)?.[1]?.trim() ||
    text.match(/\b(5\.\d+\.\d+[^\n\r]{0,120})/)?.[1]?.trim() ||
    text.match(/\b(55\d[^\n\r]{0,120})/)?.[1]?.trim() ||
    'No diagnostic returned.';

  return { email, status: status || (/\b5\d\d\b/.test(reason) ? '5.0.0' : ''), reason };
}

/**
 * Every delivery failure in the mailbox that maps to a lead.
 *
 * Reads Gmail directly rather than recording sends: a bounce arrives whether or
 * not we wrote anything down, and deriving the list from the mailbox means it is
 * correct for sends made before this existed, and cannot drift out of sync.
 */
export async function listOutreachBounces(
  ctx: Parameters<typeof getGmailAccessToken>[0],
  leads: OutreachLead[],
  { days = 30, max = 120 }: { days?: number; max?: number } = {},
): Promise<{ bounces: OutreachBounce[]; error: null } | { bounces: null; error: string }> {
  try {
    const connection = await activeGmailConnection(ctx);
    if (!connection) return { bounces: null, error: 'Connect Gmail to track bounces.' };
    if (connection.status !== 'connected') return { bounces: null, error: 'Reconnect Gmail to track bounces.' };

    const { accessToken } = await getGmailAccessToken(ctx, String(connection.id));

    const leadByEmail = new Map<string, OutreachLead>();
    for (const lead of leads) {
      const key = lead.email.trim().toLowerCase();
      if (key) leadByEmail.set(key, lead);
    }
    const leadEmails = new Set(leadByEmail.keys());

    const query = encodeURIComponent(`(${BOUNCE_QUERY}) newer_than:${days}d`);
    const list = await gmail<{ messages?: { id?: string }[] }>(
      accessToken,
      `/messages?q=${query}&maxResults=${max}`,
    );

    const seen = new Set<string>();
    const bounces: OutreachBounce[] = [];
    for (const stub of list.messages ?? []) {
      if (!stub.id) continue;
      const message = await gmail<GmailMessage>(accessToken, `/messages/${stub.id}?format=full`);
      const parsed = parseBounce(textOf(message.payload).join('\n'), leadEmails);
      if (!parsed) continue;

      // One address can bounce repeatedly across a sequence; the newest report
      // is the one worth showing.
      if (seen.has(parsed.email)) continue;
      seen.add(parsed.email);

      const lead = leadByEmail.get(parsed.email) ?? null;
      bounces.push({
        messageId: stub.id,
        email: parsed.email,
        kind: parsed.status.startsWith('4') ? 'soft' : 'hard',
        status: parsed.status || '—',
        reason: parsed.reason,
        failedAt: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : new Date().toISOString(),
        leadId: lead?.id ?? null,
        company: lead?.company ?? null,
        campaign: lead?.campaign ?? null,
        stage: lead?.outreachStage ?? null,
        phone: lead?.phone ?? null,
        website: lead?.website ?? null,
      });
    }

    bounces.sort((a, b) => b.failedAt.localeCompare(a.failedAt));
    return { bounces, error: null };
  } catch (error) {
    return { bounces: null, error: error instanceof Error ? error.message : 'Could not read bounces.' };
  }
}
