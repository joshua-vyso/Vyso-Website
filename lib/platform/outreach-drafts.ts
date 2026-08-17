import { getGmailAccessToken } from '@/lib/platform/serviceden-gmail';
import { connectionHasSendScope } from '@/lib/platform/serviceden';
import type { OutreachLead } from '@/lib/platform/notion-outreach';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/** One batch is one click. Gmail's own cap is 500/day on consumer accounts and
 *  2000 on Workspace; stopping well short of it keeps a misfire recoverable. */
export const SEND_BATCH_LIMIT = 60;

export type HeldDraft = OutreachDraft & {
  /** Why ServiceDen refuses to send it. The draft stays in Gmail for Josh to judge. */
  reason: string;
};

export type OutreachDraft = {
  id: string;
  messageId: string;
  to: string;
  subject: string;
  /** The Notion lead this draft is addressed to. Null means we do not recognise
   *  the recipient, and the draft is never offered for sending. */
  leadId: string | null;
  company: string | null;
  campaign: string | null;
  stage: string | null;
};

export type DraftInbox = {
  /** Gmail account the drafts live in. Shown in the UI so a wrong-mailbox
   *  connection is obvious before anything is sent, not after. */
  account: string;
  canSend: boolean;
  sendable: OutreachDraft[];
  /** Drafts addressed to a lead we will NOT send: the lead has replied, been
   *  marked bounced, or the mailbox shows a reply since the draft was made.
   *  This is the last gate before a send, and it re-checks live rather than
   *  trusting whatever the morning run knew. */
  held: HeldDraft[];
  /** Drafts we will not touch because the recipient is not a lead. Surfaced as a
   *  count so an unrelated personal draft is visibly excluded rather than
   *  silently swept into a bulk send. */
  unrecognised: number;
};

type GmailHeader = { name?: string; value?: string };
type GmailDraft = {
  id?: string;
  message?: { id?: string; payload?: { headers?: GmailHeader[] } };
};

function header(headers: GmailHeader[] | undefined, name: string): string {
  const hit = (headers ?? []).find((h) => (h.name ?? '').toLowerCase() === name.toLowerCase());
  return (hit?.value ?? '').trim();
}

/** "Some Name <a@b.co.za>" and bare "a@b.co.za" both reduce to the address. */
export function addressOf(value: string): string {
  const match = value.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+/);
  return match ? match[0].toLowerCase() : '';
}

const FREE_MAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com',
  'mail.com', 'aol.com', 'protonmail.com', 'proton.me', 'mweb.co.za', 'telkomsa.net', 'vodamail.co.za', 'lantic.net',
  'webmail.co.za', 'iafrica.com', 'absamail.co.za', 'polka.co.za', 'mailbox.co.za',
]);
const SYSTEM_SENDER = /^(mailer-daemon|postmaster|no-?reply|noreply|donotreply|do-not-reply|bounce|bounces|notification|notifications|mail|admin|hostmaster|abuse)@/i;

/**
 * Sender addresses (and their domains) that have written to us in the last N
 * days. Used to catch a reply that landed after the morning run and before Send:
 * the n8n gate cannot see those, so this is the only place they can be caught.
 * Same rule as the automation's matcher — a reply from anyone at the lead's own
 * (non free-mail) domain counts.
 */
async function recentSenders(accessToken: string, days: number): Promise<{ addresses: Set<string>; domains: Set<string> }> {
  const addresses = new Set<string>();
  const domains = new Set<string>();
  const q = encodeURIComponent(`-in:sent -in:draft -in:chats newer_than:${days}d`);
  let pageToken = '';
  for (let page = 0; page < 5; page += 1) {
    const list = await gmail<{ messages?: { id?: string }[]; nextPageToken?: string }>(
      accessToken,
      `/messages?q=${q}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`,
    );
    for (const m of list.messages ?? []) {
      if (!m.id) continue;
      const msg = await gmail<{ payload?: { headers?: GmailHeader[] } }>(
        accessToken,
        `/messages/${m.id}?format=metadata&metadataHeaders=From`,
      );
      const from = addressOf(header(msg.payload?.headers, 'From'));
      if (!from || SYSTEM_SENDER.test(from)) continue;
      addresses.add(from);
      const domain = from.split('@')[1];
      if (domain && !FREE_MAIL.has(domain)) domains.add(domain);
    }
    if (!list.nextPageToken) break;
    pageToken = list.nextPageToken;
  }
  return { addresses, domains };
}

async function gmail<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gmail ${response.status}: ${detail.slice(0, 200) || response.statusText}`);
  }
  return (await response.json()) as T;
}

/**
 * Every draft in the mailbox, paired with the lead it is addressed to.
 *
 * The pairing is the safety mechanism, not a convenience: "send all drafts"
 * against a raw Gmail draft list would also send anything personal sitting in
 * there. Only drafts whose recipient matches a lead in Lead Hub are sendable.
 */
export async function listOutreachDrafts(
  ctx: Parameters<typeof getGmailAccessToken>[0],
  connectionId: string,
  connectionScopes: string[],
  leads: OutreachLead[],
): Promise<DraftInbox> {
  const { accessToken, connection } = await getGmailAccessToken(ctx, connectionId);

  const leadByEmail = new Map<string, OutreachLead>();
  for (const lead of leads) {
    const key = lead.email.trim().toLowerCase();
    if (key) leadByEmail.set(key, lead);
  }

  const ids: string[] = [];
  let pageToken = '';
  // Two pages covers a 40-lead run with room to spare; an unbounded loop here
  // would be a slow surprise on a mailbox with hundreds of stale drafts.
  for (let page = 0; page < 3; page += 1) {
    const list = await gmail<{ drafts?: { id?: string }[]; nextPageToken?: string }>(
      accessToken,
      `/drafts?maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`,
    );
    for (const d of list.drafts ?? []) if (d.id) ids.push(d.id);
    if (!list.nextPageToken) break;
    pageToken = list.nextPageToken;
  }

  // Cheap when the mailbox is quiet, and it is the only check that can see a
  // reply that arrived after the automation ran this morning.
  const recent = await recentSenders(accessToken, 7);

  const sendable: OutreachDraft[] = [];
  const held: HeldDraft[] = [];
  let unrecognised = 0;
  for (const id of ids) {
    const draft = await gmail<GmailDraft>(
      accessToken,
      `/drafts/${id}?format=metadata&metadataHeaders=To&metadataHeaders=Subject`,
    );
    const headers = draft.message?.payload?.headers;
    const to = addressOf(header(headers, 'To'));
    const lead = to ? leadByEmail.get(to) : undefined;
    if (!lead) {
      unrecognised += 1;
      continue;
    }
    const entry: OutreachDraft = {
      id,
      messageId: draft.message?.id ?? '',
      to,
      subject: header(headers, 'Subject') || '(no subject)',
      leadId: lead.id,
      company: lead.company,
      campaign: lead.campaign,
      stage: lead.outreachStage,
    };

    // The hard gates. Any one of these holds the draft; none of them delete it.
    const domain = to.split('@')[1] ?? '';
    let reason = '';
    if (lead.replied) reason = 'Lead has replied — marked in Notion.';
    else if (lead.emailStatus === 'Bounced' || lead.emailStatus === 'Do Not Contact') reason = `Email status is ${lead.emailStatus}.`;
    else if (lead.signed) reason = 'Lead is signed.';
    else if (recent.addresses.has(to)) reason = 'This address has emailed us in the last 7 days.';
    else if (domain && !FREE_MAIL.has(domain) && recent.domains.has(domain)) reason = `Someone at ${domain} has emailed us in the last 7 days.`;

    if (reason) held.push({ ...entry, reason });
    else sendable.push(entry);
  }

  sendable.sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''));
  held.sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''));
  return {
    account: String(connection.email_address ?? connection.email ?? 'unknown'),
    canSend: connectionHasSendScope(connectionScopes),
    sendable,
    held,
    unrecognised,
  };
}

/** Same shape `requireServiceDenServerContext` returns and `getGmailAccessToken` takes. */
type OutreachContext = Parameters<typeof getGmailAccessToken>[0];

/** The one Gmail connection ServiceDen sends through. */
export async function activeGmailConnection(ctx: OutreachContext): Promise<Record<string, unknown> | null> {
  const { data } = await ctx.service
    .from('sd_gmail_connections')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.userId)
    .neq('status', 'disconnected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

export type DraftInboxResult =
  | { inbox: DraftInbox; error: null; connectionId: string }
  | { inbox: null; error: string; connectionId: null };

/**
 * Resolve the connection and read the mailbox in one call, returning the failure
 * as a value rather than throwing. Both the page and the API route need exactly
 * this, and neither should fall over because Gmail is briefly unreachable.
 */
export async function draftInboxFor(ctx: OutreachContext, leads: OutreachLead[]): Promise<DraftInboxResult> {
  try {
    const connection = await activeGmailConnection(ctx);
    if (!connection) {
      return { inbox: null, error: 'Connect Gmail before reviewing drafts.', connectionId: null };
    }
    if (connection.status !== 'connected') {
      return { inbox: null, error: 'Reconnect Gmail — the connection needs re-authorising.', connectionId: null };
    }
    const connectionId = String(connection.id);
    const inbox = await listOutreachDrafts(ctx, connectionId, (connection.scopes as string[]) ?? [], leads);
    return { inbox, error: null, connectionId };
  } catch (error) {
    return {
      inbox: null,
      error: error instanceof Error ? error.message : 'Could not read Gmail drafts.',
      connectionId: null,
    };
  }
}

export type SendOutcome = { id: string; company: string | null; ok: boolean; error?: string };

/**
 * Sends the given drafts one at a time and reports each result.
 *
 * Deliberately not parallel and deliberately not retried: a failure here has
 * already put mail on the wire or not, and a retry risks a duplicate landing in
 * a prospect's inbox. Partial success is reported honestly rather than raised.
 */
export async function sendDrafts(
  ctx: Parameters<typeof getGmailAccessToken>[0],
  connectionId: string,
  drafts: { id: string; company: string | null }[],
): Promise<SendOutcome[]> {
  const { accessToken } = await getGmailAccessToken(ctx, connectionId);
  const results: SendOutcome[] = [];
  for (const draft of drafts) {
    try {
      await gmail(accessToken, '/drafts/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: draft.id }),
      });
      results.push({ id: draft.id, company: draft.company, ok: true });
    } catch (error) {
      results.push({
        id: draft.id,
        company: draft.company,
        ok: false,
        error: error instanceof Error ? error.message : 'Send failed',
      });
    }
  }
  return results;
}
