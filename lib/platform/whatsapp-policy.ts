/**
 * WhatsApp ordering POLICY — the rules that decide whether an inbound WhatsApp
 * message is allowed to become an order, who it is from, and what it says.
 *
 * Deliberately pure and IO-free (no Supabase, no fetch, no `server-only`) so the
 * security-critical decisions here can be exercised directly in tests. The plumbing
 * that acts on these decisions lives in ./whatsapp-ingest.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Meta app secret — the key the Cloud API signs webhooks with (X-Hub-Signature-256).
 * Without it we cannot tell a real delivery from anyone on the internet POSTing to
 * our public URL, so the route refuses to run at all when it is unset.
 */
export const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET ?? '';

/** The token Meta echoes back during webhook setup (GET hub.verify_token). */
export const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? '';

/** System-user access token used to fetch media and send replies. */
export const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? '';

/** Graph API version. Pinned via env so a Meta deprecation is a config change. */
export const WHATSAPP_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';

/**
 * Country code assumed for numbers stored without one. `of_customers.phone` is typed
 * by hand and in South Africa is almost always national format ('082 123 4567').
 */
export const DEFAULT_COUNTRY_CODE = (process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '27').replace(/\D/g, '');

/** True when inbound WhatsApp can actually run. */
export const whatsappConfigured = Boolean(
  WHATSAPP_APP_SECRET && WHATSAPP_VERIFY_TOKEN && WHATSAPP_ACCESS_TOKEN,
);

/** Media we can actually read. Matches the email lane and Anthropic's vision support. */
const ALLOWED_MEDIA_TYPES = /^(application\/pdf|image\/(png|jpe?g|webp|gif))$/i;

/** ~13MB decoded — matches the chat and email ingest ceilings. */
export const MAX_MEDIA_BYTES = 13 * 1024 * 1024;

/** Bound what we hand the model. A WhatsApp text message caps at 4096 chars anyway. */
export const MAX_BODY_CHARS = 4000;

export type SenderStatus = 'approved' | 'pending' | 'blocked' | 'unknown';

// ---------------------------------------------------------------------------
// Phone numbers
// ---------------------------------------------------------------------------

/**
 * Normalise a phone number to bare E.164 digits (no '+'), the form Meta uses for
 * `wa_id`. Returns null when the input can't be a phone number.
 *
 * This is the identity function for the whole feature: an inbound wa_id is matched
 * against `of_customers.phone` by comparing the output of this on both sides. The
 * stored side is free text a human typed, so it arrives as '082 123 4567',
 * '+27 82 123 4567', '0027821234567' or '27-82-123-4567' — all the same number.
 *
 * The rules, in the order they're applied:
 *   - A leading '+' or '00' means the country code is already there. Trust it.
 *   - A leading trunk '0' means national format: drop the 0, prepend the country code.
 *   - 9 digits or fewer means national format with the trunk 0 omitted (people write
 *     '82 123 4567'). Prepend the country code.
 *   - Anything longer already carries a country code.
 *
 * Deliberately conservative about ADDING a country code, because a wrong prefix
 * doesn't fail — it silently matches the wrong customer, or nobody.
 */
export function normaliseMsisdn(raw: string | null | undefined, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // '00' is the international access prefix — strip it and treat the rest as E.164.
  let international = hadPlus;
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  if (!international) {
    if (digits.startsWith('0')) {
      // National format with the trunk prefix: 082… → 27 82…
      digits = countryCode + digits.replace(/^0+/, '');
    } else if (digits.length <= 9) {
      // National format with the trunk 0 left off: 82… → 27 82…
      digits = countryCode + digits;
    }
    // Otherwise it's long enough to already carry a country code — leave it alone.
  }

  // E.164 allows at most 15 digits; anything under 8 is not a reachable number.
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/**
 * Does this stored customer phone refer to the same number as this wa_id?
 *
 * Compares normalised forms, then falls back to a national-significant-number
 * comparison (the last 9 digits) so a customer stored under one country-code
 * convention still matches. The fallback requires BOTH numbers to be long enough
 * that 9 digits is genuinely the subscriber part — otherwise short numbers would
 * collide with each other.
 */
export function phoneMatchesWaId(customerPhone: string | null | undefined, waId: string): boolean {
  const a = normaliseMsisdn(customerPhone);
  const b = normaliseMsisdn(waId);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 11 && b.length >= 11) return a.slice(-9) === b.slice(-9);
  return false;
}

// ---------------------------------------------------------------------------
// Webhook signature
// ---------------------------------------------------------------------------

/**
 * Verify Meta's X-Hub-Signature-256 over the RAW request body.
 *
 * This is the only thing standing between the public webhook URL and anyone able to
 * inject orders into a customer's OrderFlow, so:
 *   - It must run against the raw bytes, NOT a re-serialised JSON object. Round-tripping
 *     through JSON.parse/stringify changes key order and whitespace and the HMAC no
 *     longer matches — the classic way this check gets silently disabled.
 *   - The comparison is timing-safe. A byte-by-byte early return leaks the expected
 *     digest to an attacker who can measure it.
 *
 * Fails CLOSED: no header, no secret, wrong length — no trust.
 */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const match = /^sha256=([a-f0-9]{64})$/i.exec(header.trim());
  if (!match) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest();
  const provided = Buffer.from(match[1].toLowerCase(), 'hex');
  // Equal by construction (both 32 bytes from a 64-hex-char match), but timingSafeEqual
  // throws on a length mismatch, so guard rather than let a malformed header 500.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

/**
 * The GET handshake Meta performs when you save the webhook URL. Returns the challenge
 * to echo back, or null to reject.
 *
 * The token comparison is timing-safe for the same reason as the signature above: this
 * endpoint is public and the verify token is a shared secret.
 */
export function verifyHandshake(
  params: URLSearchParams,
  verifyToken: string,
): string | null {
  if (!verifyToken) return null;
  if (params.get('hub.mode') !== 'subscribe') return null;
  const provided = params.get('hub.verify_token') ?? '';
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(verifyToken, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return params.get('hub.challenge');
}

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

export type MessageKind = 'text' | 'image' | 'document' | 'audio' | 'other';

export interface InboundMessage {
  /** Routing key — the business number the message arrived AT. */
  phoneNumberId: string;
  wabaId: string | null;
  displayNumber: string | null;
  /** Meta's message id (wamid.*). The dedup key. */
  waMessageId: string;
  /** Sender, as bare E.164 digits. */
  fromWaId: string;
  /** The sender's own WhatsApp display name — a claim, never an identity. */
  profileName: string | null;
  kind: MessageKind;
  /** Message text, or a media caption. Empty when there is none. */
  text: string;
  /** Media id to fetch from the Graph API, for image/document. */
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaFilename: string | null;
  /** The raw message object, kept for support and replay. Untrusted content. */
  raw: Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Flatten a Cloud API webhook into the messages it actually carries.
 *
 * One POST can hold several entries, each with several changes, each with several
 * messages — Meta batches. It also delivers STATUS callbacks (sent/delivered/read)
 * through the same webhook and the same shape; those have no `messages` array and
 * must not be mistaken for customer input.
 *
 * Everything here is attacker-shaped data: the whole payload is only trustworthy
 * because the caller verified the signature first. This function assumes nothing
 * about the shape and drops anything it can't read.
 */
export function parseInboundMessages(payload: unknown): InboundMessage[] {
  const root = asRecord(payload);
  if (!root) return [];
  // Meta sends other product webhooks through the same subscription surface.
  if (str(root.object) !== 'whatsapp_business_account') return [];

  const out: InboundMessage[] = [];

  for (const entryRaw of asArray(root.entry)) {
    const entry = asRecord(entryRaw);
    if (!entry) continue;
    const wabaId = str(entry.id) || null;

    for (const changeRaw of asArray(entry.changes)) {
      const change = asRecord(changeRaw);
      if (!change) continue;
      if (str(change.field) !== 'messages') continue;

      const value = asRecord(change.value);
      if (!value) continue;

      const metadata = asRecord(value.metadata);
      const phoneNumberId = str(metadata?.phone_number_id);
      // No routing key, no org. Nothing in the message body may stand in for it.
      if (!phoneNumberId) continue;
      const displayNumber = str(metadata?.display_phone_number) || null;

      // wa_id → profile name, for the approval screen.
      const names = new Map<string, string>();
      for (const contactRaw of asArray(value.contacts)) {
        const contact = asRecord(contactRaw);
        const waId = str(contact?.wa_id);
        const name = str(asRecord(contact?.profile)?.name);
        if (waId && name) names.set(waId, name);
      }

      for (const messageRaw of asArray(value.messages)) {
        const message = asRecord(messageRaw);
        if (!message) continue;
        const waMessageId = str(message.id);
        const fromWaId = normaliseMsisdn(str(message.from));
        if (!waMessageId || !fromWaId) continue;

        const type = str(message.type);
        let kind: MessageKind = 'other';
        let text = '';
        let mediaId: string | null = null;
        let mediaMimeType: string | null = null;
        let mediaFilename: string | null = null;

        if (type === 'text') {
          kind = 'text';
          text = str(asRecord(message.text)?.body);
        } else if (type === 'image' || type === 'document') {
          kind = type;
          const media = asRecord(message[type]);
          mediaId = str(media?.id) || null;
          mediaMimeType = str(media?.mime_type) || null;
          mediaFilename = str(media?.filename) || null;
          // A caption is the customer talking about the file — keep it as the note.
          text = str(media?.caption);
        } else if (type === 'audio' || type === 'voice') {
          // Voice notes are common for produce orders but need transcription, which
          // this lane doesn't do yet. Recognised so we can answer helpfully rather
          // than ignore the customer.
          kind = 'audio';
        } else if (type === 'button') {
          // A template quick-reply. The title is the customer's choice, so it reads
          // exactly like a short text reply ("YES").
          kind = 'text';
          text = str(asRecord(message.button)?.text);
        } else if (type === 'interactive') {
          kind = 'text';
          const interactive = asRecord(message.interactive);
          text =
            str(asRecord(interactive?.button_reply)?.title) ||
            str(asRecord(interactive?.list_reply)?.title);
        }

        out.push({
          phoneNumberId,
          wabaId,
          displayNumber,
          waMessageId,
          fromWaId,
          profileName: names.get(str(message.from)) ?? names.get(fromWaId) ?? null,
          kind,
          text: text.slice(0, MAX_BODY_CHARS),
          mediaId,
          mediaMimeType,
          mediaFilename,
          raw: message,
        });
      }
    }
  }

  return out;
}

/** Can we actually read this media type? */
export function mediaTypeSupported(mimeType: string | null): boolean {
  return ALLOWED_MEDIA_TYPES.test((mimeType ?? '').split(';')[0].trim());
}

// ---------------------------------------------------------------------------
// The confirm loop
// ---------------------------------------------------------------------------

export type ReplyIntent = 'confirm' | 'cancel';

/**
 * Strip a short reply down to comparable words: lowercase, no punctuation, no
 * emoji variation selectors, single-spaced.
 */
function normaliseReply(text: string): string {
  return text
    .toLowerCase()
    .replace(/[️‍]/g, '')
    .replace(/[^\p{L}\p{N}\p{Emoji_Presentation}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exact phrases that mean "place the order". */
const CONFIRM_PHRASES = new Set([
  'y', 'yes', 'yes please', 'yes thanks', 'yes thank you', 'yep', 'yeah', 'yebo',
  'ja', 'ja dankie', 'ok', 'okay', 'ok thanks', 'confirm', 'confirmed', 'correct',
  'thats right', 'that is right', 'correct thanks', 'sharp', 'perfect', 'please',
  'go ahead', 'send it', 'order it', '👍', '👍🏻', '👍🏼', '👍🏽', '👍🏾', '👍🏿', '✅', '☑',
]);

/** Exact phrases that mean "don't place it". */
const CANCEL_PHRASES = new Set([
  'n', 'no', 'no thanks', 'no thank you', 'nope', 'nee', 'cancel', 'cancel it',
  'stop', 'wrong', 'thats wrong', 'that is wrong', 'incorrect', 'ignore', 'ignore it',
  'never mind', 'nevermind', '❌', '✖', '🚫',
]);

/**
 * Is this short reply answering the confirm card, and how?
 *
 * ONLY whole-phrase matches count. "No tomatoes today, make it 5 onions" starts with
 * "no" and is an order CORRECTION, not a cancellation — treating it as one would
 * discard the customer's actual instruction and tell them nothing.
 *
 * Anything unrecognised returns null and is parsed as a new order instead. That is the
 * safe direction: an unmatched "yes" produces an empty parse the customer is told
 * about and the draft stays open, whereas a loose match on a real order message would
 * quietly place the wrong one.
 */
export function classifyReply(text: string): ReplyIntent | null {
  const normalised = normaliseReply(text);
  if (!normalised || normalised.length > 24) return null;
  if (CONFIRM_PHRASES.has(normalised)) return 'confirm';
  if (CANCEL_PHRASES.has(normalised)) return 'cancel';
  return null;
}

export interface ConfirmLine {
  description: string;
  quantity: string;
  unit: string;
}

/**
 * The confirm card — what we read back before anything becomes an order.
 *
 * This message IS the control. Everything upstream (a model reading messy text, a
 * phone number matched to a customer) is a best guess, and this is the point at which
 * the person who actually placed the order gets to say whether the guess is right.
 * So it restates the parse in full rather than summarising it.
 */
export function formatOrderConfirmation(params: {
  customerName: string | null;
  lines: ConfirmLine[];
}): string {
  const greeting = params.customerName ? `Thanks ${params.customerName}!` : 'Thanks!';
  const items = params.lines
    .map((line, i) => {
      const qty = [line.quantity, line.unit].filter(Boolean).join(' ').trim();
      return `${i + 1}. ${line.description}${qty ? ` — ${qty}` : ''}`;
    })
    .join('\n');
  return [
    `${greeting} Here's the order I've got:`,
    '',
    items,
    '',
    'Reply *YES* to place it, or *NO* to cancel.',
    "If something's not right, just send the corrected order and I'll redo it.",
  ].join('\n');
}
