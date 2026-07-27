import { createHash } from 'node:crypto';
import type { SdCompanyResearch, SdEmailTemplate, SdEmailTemplateExample, SdLeadStage, SdMailThread } from './serviceden';

// URL / domain --------------------------------------------------------------

export function normalizeWebsiteUrl(input: string): { url: string; domain: string } | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && u.port !== '80' && u.port !== '443')) {
    return null;
  }
  u.hash = '';
  u.search = '';
  u.hostname = u.hostname.toLowerCase();
  const domain = u.hostname.replace(/^www\./, '');
  return { url: u.toString().replace(/\/$/, ''), domain };
}

function ipv4(host: string): number[] | null {
  const parts = host.split('.').map(Number);
  return parts.length === 4 && parts.every(Number.isInteger) && parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

export function isSafePublicHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !h ||
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.home.arpa')
  ) {
    return false;
  }
  const a = ipv4(h);
  if (a) {
    // Reject RFC 1918 private, loopback, link-local and CGNAT ranges.
    return !(
      a[0] === 10 || // 10.0.0.0/8
      a[0] === 127 || // 127.0.0.0/8 loopback
      (a[0] === 169 && a[1] === 254) || // 169.254.0.0/16 link-local
      (a[0] === 192 && a[1] === 168) || // 192.168.0.0/16
      (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || // 172.16.0.0/12
      (a[0] === 100 && a[1] >= 64 && a[1] <= 127) // 100.64.0.0/10 CGNAT
    );
  }
  if (h.includes(':')) {
    // IPv6 literal: reject loopback (::1), unique-local (fc00::/7) and link-local (fe80::/10).
    return !(
      h === '::1' ||
      h.startsWith('fc') ||
      h.startsWith('fd') ||
      h.startsWith('fe8') ||
      h.startsWith('fe9') ||
      h.startsWith('fea') ||
      h.startsWith('feb')
    );
  }
  return true;
}

export function isSafeResearchUrl(raw: string): boolean {
  const n = normalizeWebsiteUrl(raw);
  return !!n && isSafePublicHost(new URL(n.url).hostname);
}

export const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'aol.com',
  'gmx.com',
  'mail.com',
  'yandex.com',
  'webmail.com',
]);

export function domainFromLeadEmail(email: string): string | null {
  const d = email.trim().toLowerCase().split('@')[1] || '';
  return d && !GENERIC_EMAIL_DOMAINS.has(d) && isSafePublicHost(d) ? d : null;
}

// Template selection ---------------------------------------------------------

export function selectExamplesForStage(
  templates: SdEmailTemplate[],
  stage: SdLeadStage,
  max = 3,
): { template: SdEmailTemplate; example: SdEmailTemplateExample }[] {
  if (stage === 'lost') return [];
  return templates
    .filter((t) => t.active && t.stages.includes(stage))
    .flatMap((t) => t.examples.filter((e) => e.active).map((e) => ({ template: t, example: e })))
    .sort(
      (a, b) =>
        a.template.stages.length - b.template.stages.length ||
        b.template.updatedAt.localeCompare(a.template.updatedAt),
    )
    .slice(0, max);
}

// Draft integrity ------------------------------------------------------------

function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val)
          .sort()
          .reduce((o, x) => ((o[x] = (val as Record<string, unknown>)[x]), o), {} as Record<string, unknown>)
      : val,
  );
}

export function draftContentHash(recipient: string, subject: string, body: string): string {
  return createHash('sha256').update(`${recipient.trim().toLowerCase()}\n${subject}\n${body}`).digest('hex');
}

export function researchContentHash(brief: object): string {
  return createHash('sha256').update(stable(brief)).digest('hex');
}

// MIME construction ----------------------------------------------------------

export interface OutgoingEmail {
  from: string;
  to: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string | null;
  references?: string[] | null;
}

/** A header value can never carry CR/LF or other control characters: a newline
 *  in a subject would close the header and let untrusted text inject its own
 *  (Bcc:, or a blank line ending the header block entirely). */
export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/[\x00-\x1f\x7f]/g, '').trim();
}

/** Only well-formed message-ids may be echoed into In-Reply-To/References. */
function messageIds(values: (string | null | undefined)[]): string[] {
  return values.map((v) => sanitizeHeaderValue(String(v ?? ''))).filter((v) => /^<[^<>\s]+>$/.test(v));
}

function header(name: string, value: string): string {
  const v = sanitizeHeaderValue(value);
  // RFC 2047 encoded-word for any non-ASCII header value.
  return /[^\x00-\x7f]/.test(v) ? `${name}: =?UTF-8?B?${Buffer.from(v).toString('base64')}?=` : `${name}: ${v}`;
}

export function buildMimeMessage(e: OutgoingEmail): string {
  const headers = [
    header('From', e.from),
    header('To', e.to),
    header('Subject', e.subject),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  const replyTo = messageIds([e.inReplyTo]);
  const refs = messageIds(e.references ?? []);
  if (replyTo.length) headers.push(`In-Reply-To: ${replyTo[0]}`);
  if (refs.length) headers.push(`References: ${refs.join(' ')}`);
  // Base64 body wrapped at 76 chars per line (RFC 2045); CRLF between headers and body.
  const body = Buffer.from(e.bodyText, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
  return headers.join('\r\n') + '\r\n\r\n' + body;
}

export function encodeMimeForGmail(mime: string): string {
  return Buffer.from(mime).toString('base64url');
}

export function replySubject(original: string | null): string {
  const s = (original || '').trim();
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

export function threadingHeaders(thread: SdMailThread | null): { inReplyTo: string | null; references: string[] } {
  const msgs = thread?.messages || [];
  const ids = msgs.map((m) => m.internetMessageId).filter((x): x is string => !!x);
  return { inReplyTo: ids.at(-1) || null, references: [...new Set(ids)] };
}

// OpenAI structured-output validation ---------------------------------------

export interface GeneratedDraft {
  subject: string;
  body: string;
  usedSourceIds: string[];
  reasoningSummary: string;
  suggestedFollowUpDays: number;
}

export function parseGeneratedDraft(raw: unknown): GeneratedDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.subject !== 'string' ||
    typeof r.body !== 'string' ||
    typeof r.reasoningSummary !== 'string' ||
    !Array.isArray(r.usedSourceIds) ||
    typeof r.suggestedFollowUpDays !== 'number'
  ) {
    return null;
  }
  return {
    subject: sanitizeHeaderValue(r.subject).slice(0, 300),
    body: r.body.trim().slice(0, 20000),
    reasoningSummary: r.reasoningSummary.trim(),
    usedSourceIds: r.usedSourceIds.filter((x) => typeof x === 'string'),
    suggestedFollowUpDays: Math.min(30, Math.max(1, Math.round(r.suggestedFollowUpDays))),
  };
}

// Context priority -----------------------------------------------------------

export interface ComposeInput {
  lead: {
    name: string;
    company: string | null;
    email: string;
    stage: SdLeadStage;
    summary: string | null;
    primaryPain: string | null;
    notes: string | null;
  };
  isReply: boolean;
  thread: SdMailThread | null;
  research: SdCompanyResearch | null;
  examples: { template: SdEmailTemplate; example: SdEmailTemplateExample }[];
  callToAction: string | null;
  sender: { name: string; email: string; businessName: string | null };
}

export function buildContextSections(i: ComposeInput): { title: string; content: string; priority: number }[] {
  const out: { title: string; content: string; priority: number }[] = [];
  if (i.thread) {
    out.push({
      title: 'Latest Gmail thread',
      content: i.thread.messages
        .slice(-8)
        .map((m) => `${m.fromAddress}: ${m.bodyText || m.snippet || ''}`)
        .join('\n'),
      priority: 1,
    });
  }
  out.push({
    title: 'User notes and lead facts',
    content: [i.lead.name, i.lead.company, i.lead.email, i.lead.summary, i.lead.primaryPain, i.lead.notes]
      .filter(Boolean)
      .join('\n'),
    priority: 2,
  });
  if (i.research) {
    out.push({
      title: 'Website research',
      content: [
        i.research.summary,
        ...i.research.operationalSignals
          .filter((s) => !i.research!.excludedSourceIds.includes(s.sourceId))
          .sort((a, b) => Number(b.kind === 'fact') - Number(a.kind === 'fact'))
          .map((s) => `${s.claim} [source:${s.sourceId}]`),
      ]
        .filter(Boolean)
        .join('\n'),
      priority: 3,
    });
  }
  out.push({
    title: 'Templates and examples',
    content: i.examples.map((x) => `${x.template.name}: ${x.example.subjectExample}\n${x.example.bodyExample}`).join('\n'),
    priority: 4,
  });
  out.push({ title: 'Generic fallback', content: 'Write a concise, relevant professional email.', priority: 5 });
  return out;
}

export function shouldRevokeApproval(
  before: { recipientEmail: string; subject: string; body: string },
  patch: { recipientEmail?: string; subject?: string; body?: string },
): boolean {
  return (
    (patch.recipientEmail !== undefined && patch.recipientEmail !== before.recipientEmail) ||
    (patch.subject !== undefined && patch.subject !== before.subject) ||
    (patch.body !== undefined && patch.body !== before.body)
  );
}
