/**
 * Hubdoc cross-upload — the pure half. No I/O, no Supabase, no Resend, no clock:
 * strings and rows in, decisions and strings out. `hubdoc.ts` does the reading,
 * the sending and the logging; everything that decides WHETHER a document may be
 * sent and WHAT the email says is here, where a test can pin it without a
 * network stack.
 *
 * WHY THIS SPLIT EXISTS AT ALL. Every send is an irreversible outbound act on a
 * customer's behalf — a supplier invoice landing in their bookkeeper's inbox.
 * The two questions that decide whether it should happen ("is this the kind of
 * paper Hubdoc wants?" and "does this address look like a Hubdoc inbox?") are
 * therefore the two most worth testing, and neither of them needs a database to
 * answer. Same shape as `xero-sync-shared.ts` beside `xero-sync.ts`.
 *
 * WHAT HUBDOC IS, for anyone reading this cold. Hubdoc has no public write API.
 * Its supported intake is EMAIL: each Hubdoc organisation gets an "upload by
 * email" address (Hubdoc → org settings → "Upload by email"), and a document
 * attached to a message sent there is filed for coding into Xero. So Vyso's
 * "cross-upload" is exactly one thing: an email with the original file attached.
 * There is no callback, no receipt and no id from Hubdoc to reconcile against —
 * which is precisely why `hubdoc_forwards` records what VYSO did, and the copy
 * in the UI never claims more than "sent".
 *
 * Framework-free and dependency-free so the routes (server), the cards (client)
 * and `node --test` can all import it.
 */

// ---------------------------------------------------------------------------
// The intake address
// ---------------------------------------------------------------------------

/** Where Hubdoc's own upload addresses live. Used to recognise one, never to
 *  build one: the local part is per-organisation and only Hubdoc knows it. */
export const HUBDOC_INTAKE_DOMAIN = 'upload.hubdoc.com';

/** Where an owner finds theirs. Quoted verbatim in the UI so the answer to "what
 *  do I put in this box?" is on the box. */
export const HUBDOC_INTAKE_HINT = 'Hubdoc → your organisation’s settings → “Upload by email”.';

export type HubdocEmailCheck =
  | { ok: true; email: string; warning: string | null }
  | { ok: false; error: string };

/**
 * Validate (and normalise) a Hubdoc intake address.
 *
 * WARN, DO NOT REFUSE, on a non-Hubdoc domain. The plan allows "any email with a
 * warning" and that is the right call twice over: Hubdoc has changed its intake
 * domain before and a hard allowlist would strand a customer whose address is
 * perfectly valid, and some businesses deliberately point this at their own
 * bookkeeper's mailbox instead. What Vyso must NOT do is let that choice be made
 * silently — hence a warning the owner has to read past, stored alongside
 * nothing, shown every time the card renders.
 *
 * Lower-cased and trimmed on the way in. Two rows differing only in the case of
 * a domain would be two answers to "where does this org's paper go".
 */
export function validateHubdocIntakeEmail(raw: string | null | undefined): HubdocEmailCheck {
  const email = (raw ?? '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Enter your Hubdoc upload address.' };
  if (email.length > 254) return { ok: false, error: 'That address is too long to be an email address.' };
  // The same shape the rest of the platform validates with (see
  // app/api/serviceden/drafts/[id]/route.ts). Deliberately loose: the only
  // authority on whether an address exists is the mail server, and a stricter
  // regex here would reject valid addresses to catch typos it cannot catch.
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { ok: false, error: 'That does not look like an email address.' };
  }
  const domain = email.slice(email.lastIndexOf('@') + 1);
  const warning =
    domain === HUBDOC_INTAKE_DOMAIN
      ? null
      : `This is not a ${HUBDOC_INTAKE_DOMAIN} address. Vyso will still send your documents there — check it is the inbox you meant.`;
  return { ok: true, email, warning };
}

// ---------------------------------------------------------------------------
// What may be sent
// ---------------------------------------------------------------------------

/**
 * The document types Hubdoc is for. Supplier invoices and supplier statements —
 * the paper a bookkeeper codes into the ledger.
 *
 * DELIVERY NOTES, PRICE LISTS AND ORDERS ARE NOT ON THIS LIST, and that is the
 * point of having a list. A delivery note is a logistics record, a price list is
 * a negotiation, and an `order` in Vyso is a CUSTOMER's order — outbound, the
 * business's own sale. Posting any of them into a bookkeeping inbox creates work
 * for somebody and, in the last case, files the org's own revenue as if it were
 * a supplier's bill.
 */
export const HUBDOC_DOCUMENT_TYPES: readonly string[] = ['invoice', 'statement'];

/**
 * The Doc-U statuses that mean "Vyso has actually read this document". The same
 * three the Xero Watch agent reconciles against, quoted here rather than
 * imported so the two lists can diverge if they ever should.
 *
 * `pending` is excluded because nothing has been extracted from it yet: the
 * email would have no supplier and no number in its subject, which is the one
 * thing that makes a forwarded attachment findable in Hubdoc later.
 * `rejected` and `archived` are documents somebody has already decided about.
 */
export const HUBDOC_DOCUMENT_STATUSES: readonly string[] = ['extracted', 'reviewed', 'approved'];

/**
 * The ceiling on what Vyso will attach. Fifteen megabytes, matching the extract
 * route's own `MAX_EXTRACT_BYTES` — a document too big for Vyso to read is not a
 * document Vyso should be posting into somebody's accounting inbox either.
 *
 * Resend's own limit is 40 MB per message; this is deliberately lower. The
 * buffer is base64'd in memory, which inflates it by a third, and a serverless
 * function that dies mid-send would leave an unrecorded forward — the one
 * failure mode the log cannot describe.
 */
export const HUBDOC_MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** The facts a send decision is made on. A projection of `documents`, so the
 *  caller can pass a row it already has rather than re-reading one. */
export interface HubdocDocumentFacts {
  documentType: string | null;
  status: string | null;
  /** The resolved `suppliers` row. Its presence is what makes a document
   *  supplier-side; see `hubdocEligibility`. */
  supplierId: string | null;
  storagePath: string | null;
}

export type HubdocEligibility = { ok: true } | { ok: false; reason: string };

/**
 * May this document be sent to Hubdoc?
 *
 * FOUR TESTS, AND EACH ONE PREVENTS A DIFFERENT WRONG EMAIL:
 *
 * 1. A FILE MUST EXIST. A `documents` row with no `storage_path` is a record of
 *    something Vyso never received. An email with no attachment is worse than no
 *    email: it looks like a filing to whoever opens it.
 *
 * 2. THE TYPE MUST BE ONE HUBDOC WANTS (see `HUBDOC_DOCUMENT_TYPES`).
 *
 * 3. IT MUST BE SUPPLIER-SIDE, and `supplier_id` is how Vyso knows. The plan
 *    says "not customer-side"; this is the cheapest honest reading of it. A
 *    document that has been through extraction has had its supplier resolved
 *    into a `suppliers` row (`resolveSupplierProfile`, which deliberately never
 *    lets the ORG'S OWN NAME become a supplier), so a row with no supplier is
 *    either the business's own outgoing paper or a scan nobody could read a
 *    counterparty off. Neither belongs in a bookkeeper's supplier inbox, and the
 *    subject line would have nothing to name it with either.
 *
 * 4. IT MUST HAVE BEEN READ. See `HUBDOC_DOCUMENT_STATUSES`.
 *
 * Every `reason` below is written to be SHOWN. These strings end up under a
 * disabled button and in the send route's 422, so "Not eligible" would be a
 * shrug where an owner needs a sentence.
 */
export function hubdocEligibility(doc: HubdocDocumentFacts): HubdocEligibility {
  if (!doc.storagePath) {
    return { ok: false, reason: 'This document has no file attached, so there is nothing to send.' };
  }
  if (!doc.documentType || !HUBDOC_DOCUMENT_TYPES.includes(doc.documentType)) {
    return {
      ok: false,
      reason: 'Hubdoc takes supplier invoices and statements. This document is neither.',
    };
  }
  if (!doc.supplierId) {
    return {
      ok: false,
      reason: 'Vyso has not matched a supplier to this document, so it cannot send it as a supplier invoice.',
    };
  }
  if (!doc.status || !HUBDOC_DOCUMENT_STATUSES.includes(doc.status)) {
    return { ok: false, reason: 'Vyso has not read this document yet. It can go to Hubdoc once it has.' };
  }
  return { ok: true };
}

/** The attachment is too big — as a sentence, with both figures, because "too
 *  large" without a number tells an owner nothing about what to do next. */
export function hubdocTooLargeReason(bytes: number): string {
  const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `This file is ${mb(bytes)}. Vyso will not email attachments over ${mb(HUBDOC_MAX_ATTACHMENT_BYTES)} — upload it to Hubdoc directly.`;
}

// ---------------------------------------------------------------------------
// What the email says
// ---------------------------------------------------------------------------

/** What the subject builder is given. All optional because extraction is
 *  best-effort and a missing field must degrade the subject, never block it. */
export interface HubdocSubjectInput {
  supplierName?: string | null;
  invoiceNumber?: string | null;
  filename?: string | null;
  documentType?: string | null;
}

/**
 * The subject line — the ONE thing a person will use to find this document in
 * Hubdoc a month from now.
 *
 * SUPPLIER FIRST, THEN THE NUMBER, because that is the order a bookkeeper
 * searches in: they know who, and then they are looking for which one. Falls
 * back through the filename to a bare label; each clause is dropped rather than
 * printed empty, the Brief's standing rule about saying nothing over claiming
 * nothing.
 *
 * NO "VYSO" IN THE SUBJECT. It is prefixed to the FROM name instead, because a
 * Hubdoc inbox is searched by supplier and a constant word at the front of every
 * subject makes every subject start the same way.
 */
export function hubdocSubject(input: HubdocSubjectInput): string {
  const kind = input.documentType === 'statement' ? 'Statement' : 'Invoice';
  const supplier = (input.supplierName ?? '').trim();
  const number = (input.invoiceNumber ?? '').trim();
  const filename = (input.filename ?? '').trim();

  if (supplier && number) return `${supplier} — ${kind.toLowerCase()} ${number}`;
  if (supplier) return `${supplier} — ${kind.toLowerCase()}`;
  if (number) return `${kind} ${number}`;
  if (filename) return `${kind} — ${filename}`;
  return kind;
}

/**
 * The body. Deliberately three lines of plain text.
 *
 * A HUBDOC INBOX IS READ BY A MACHINE AND, WHEN SOMETHING GOES WRONG, BY A
 * BOOKKEEPER. So the body says what the attachment is, that Vyso sent it, and
 * which organisation it belongs to — and nothing else. No branding, no
 * unsubscribe, no tracking pixel, no HTML: anything richer is either ignored or,
 * on a bad day, the reason a filing rule stops matching.
 */
export function hubdocBody(input: HubdocSubjectInput & { orgName?: string | null }): string {
  const lines = [
    `${hubdocSubject(input)}.`,
    input.orgName ? `Forwarded by Vyso on behalf of ${input.orgName.trim()}.` : 'Forwarded by Vyso.',
    'The original document is attached.',
  ];
  return lines.join('\n');
}

/** The sender. The platform's own address, shared with the Brief's emails
 *  (lib/platform/brief-notify.ts) rather than a second verified domain to keep
 *  alive — one DNS record's worth of deliverability, not two. */
export const HUBDOC_FROM = 'Vyso <noreply@vyso.co.za>';

/** Exactly the payload Resend is handed. Typed here, in the module with no
 *  dependencies, so a test can assert on it without importing the SDK. */
export interface HubdocEmail {
  from: string;
  to: string[];
  subject: string;
  text: string;
  /** Resend's attachment shape: a filename and the file's bytes as a BASE64
   *  STRING. Not a Buffer — the SDK accepts either, and a base64 string is what
   *  survives being logged, compared in a test, and read by a person debugging a
   *  send at two in the morning. */
  attachments: { filename: string; content: string }[];
}

/**
 * Build the whole message. Pure — the bytes arrive already base64'd.
 *
 * ONE RECIPIENT, ALWAYS. No cc, no bcc, no reply-to. A Hubdoc intake address is
 * a filing endpoint, and every extra header is either ignored or a way for a
 * reply to end up somewhere nobody reads. The plan says "reply-to none"; this is
 * that, enforced by the type rather than by remembering.
 */
export function buildHubdocEmail(input: {
  intakeEmail: string;
  supplierName?: string | null;
  invoiceNumber?: string | null;
  filename?: string | null;
  documentType?: string | null;
  orgName?: string | null;
  /** The document's bytes, base64-encoded. */
  contentBase64: string;
}): HubdocEmail {
  return {
    from: HUBDOC_FROM,
    to: [input.intakeEmail],
    subject: hubdocSubject(input),
    text: hubdocBody(input),
    attachments: [
      {
        filename: hubdocAttachmentFilename(input.filename),
        content: input.contentBase64,
      },
    ],
  };
}

/**
 * The attachment's filename.
 *
 * SANITISED, because this string is written into a MIME header and then onto
 * somebody's disk. Quotes, semicolons, newlines and path separators are the
 * three ways that goes wrong (a broken header, a header injection, a file
 * written outside the folder it was meant for), and a document's filename in
 * Vyso is whatever the person who uploaded it called it.
 *
 * THE EXTENSION IS PRESERVED WHERE THERE IS ONE. Hubdoc decides how to read an
 * attachment by its type, and a PDF that arrives as `invoice` is a PDF nobody
 * can open.
 */
export function hubdocAttachmentFilename(filename: string | null | undefined): string {
  const raw = (filename ?? '').trim();
  // Take the last path segment first: a name like `../../etc/passwd` must not
  // survive as a path at all.
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // Control characters (CR and LF among them — the header-injection vector)
    // and the three characters that can end a quoted MIME parameter early.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/["';]/g, '')
    .trim();
  if (!cleaned) return 'document.pdf';
  return cleaned.slice(0, 120);
}

// ---------------------------------------------------------------------------
// The log, as the card draws it
// ---------------------------------------------------------------------------

/** One row of the forwards log, as the UI needs it. Deliberately a projection
 *  and not the table row: the card has no business with `org_id`. */
export interface HubdocForwardEntry {
  id: string;
  documentId: string;
  /** The document's filename at render time, or null when it has been deleted. */
  filename: string | null;
  subject: string | null;
  sentAt: string;
  status: 'sent' | 'failed';
  error: string | null;
  triggeredBy: 'user' | 'auto';
  resend: boolean;
}

/**
 * "Sent automatically", "Sent by hand", "Sent again", "Failed" — what the log's
 * status column says.
 *
 * THE TRIGGER IS PART OF THE STATUS, not a separate column, because the question
 * an owner brings to this log is "did I do that, or did Vyso?". Splitting the
 * answer across two columns makes them read both to get it.
 */
export function hubdocForwardLabel(entry: Pick<HubdocForwardEntry, 'status' | 'triggeredBy' | 'resend'>): string {
  if (entry.status === 'failed') return 'Failed';
  if (entry.resend) return 'Sent again';
  return entry.triggeredBy === 'auto' ? 'Sent automatically' : 'Sent';
}

// ---------------------------------------------------------------------------
// The chat hand-off (Plugins X2 — chat hand-off)
// ---------------------------------------------------------------------------

/**
 * "Push it to Hubdoc", asked in the chat.
 *
 * WHAT CHANGED AND WHAT DID NOT. Finch can now PREPARE a Hubdoc hand-off —
 * resolve which documents were meant, check each against `hubdocEligibility`
 * above, and hand the list to a card. It still cannot SEND: the card's button
 * posts to `/api/integrations/hubdoc/send`, the same route the document page's
 * button posts to, with the same gates, the same log and the same caps. The
 * model chooses nothing about whether an email leaves; a person still presses.
 *
 * Everything in this section is pure so `tests/hubdoc.test.ts` can pin the two
 * decisions that matter — which documents are offered, and what the refusals
 * say — without a Supabase client or a model in the room.
 */

/**
 * Why the chat CANNOT prepare a hand-off. Four sentences, each naming the fix,
 * because the model is instructed to say exactly one of them and nothing else:
 * a refusal that does not say where to go is how "Finch said it can't" became a
 * support ticket in the first place.
 */
export const HUBDOC_CHAT_REFUSALS = {
  /** Not an owner or admin. Same line the send route's 403 uses. */
  notAdmin: 'Only an owner or admin can send documents to Hubdoc.',
  notConnected:
    'Xero is not connected for this business, so there is no Hubdoc hand-off yet. Connect it under Plugins → Xero.',
  noIntakeEmail:
    'No Hubdoc upload address is saved for this business. Add it under Plugins → Xero → Hubdoc.',
  tablesMissing:
    'The Hubdoc tables are not in this database yet — paste supabase/hubdoc.sql into the SQL editor.',
  noDocuments:
    'Tell me which document to send — attach it to this chat, or name the supplier invoice or statement you mean.',
} as const;

/** A document Vyso has already put into Hubdoc. Not a failure, and the sentence
 *  says what to do if a second copy really is wanted. */
export const HUBDOC_ALREADY_SENT_REASON =
  'Vyso has already sent this one to Hubdoc. Ask me to send it again if you want a second copy filed.';

/**
 * The intake address, masked for the chat.
 *
 * SHOWN, NEVER QUOTED IN FULL. The card has to prove the owner is about to send
 * to the inbox they configured, and the local part of a Hubdoc upload address is
 * effectively a bearer secret — anyone holding it can file paperwork into that
 * organisation's books. Enough of it survives to be recognised (the first two
 * characters and the whole domain, which is what a person actually checks) and
 * no more. A model turn never sees the unmasked address at all: this is what
 * `hubdoc_prepare_send` returns.
 */
export function maskHubdocIntakeEmail(email: string | null | undefined): string {
  const raw = (email ?? '').trim();
  const at = raw.lastIndexOf('@');
  if (at <= 0) return raw ? '•••' : '';
  const local = raw.slice(0, at);
  const domain = raw.slice(at);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}•••${domain}`;
}

/** One document as the prepare tool resolved it, before the verdict. */
export interface HubdocCandidate {
  id: string;
  filename: string;
  /** The resolved supplier's name, or null when none was matched. */
  supplier: string | null;
  /** The invoice/statement number extraction found, or null. */
  number: string | null;
  facts: HubdocDocumentFacts;
  /** Vyso has already sent this document successfully. */
  alreadySent: boolean;
}

/** One row of the confirm card. `reason` is present only when `eligible` is
 *  false, and is always a sentence written to be shown. */
export interface HubdocPreparedDocument {
  id: string;
  filename: string;
  supplier: string | null;
  number: string | null;
  eligible: boolean;
  reason?: string;
}

/**
 * The card's list: every document the owner named, with a tick or a reason.
 *
 * INELIGIBLE DOCUMENTS ARE KEPT, NOT DROPPED. If the owner said "send these
 * three" and one is a delivery note, a card showing two is a card that quietly
 * disagreed with them. Showing all three, one greyed with "Hubdoc takes supplier
 * invoices and statements", answers the question they will otherwise ask.
 *
 * ALREADY-SENT IS THE LAST TEST, deliberately after `hubdocEligibility`: a
 * document that could never have gone should say why it cannot, not that it
 * already did. `resend` skips it — the same override the document page's "Send
 * again" carries, spoken instead of clicked.
 */
export function hubdocPrepareDocuments(
  candidates: readonly HubdocCandidate[],
  opts: { resend?: boolean } = {},
): HubdocPreparedDocument[] {
  return candidates.map((candidate) => {
    const base = {
      id: candidate.id,
      filename: candidate.filename,
      supplier: candidate.supplier,
      number: candidate.number,
    };
    const eligibility = hubdocEligibility(candidate.facts);
    if (!eligibility.ok) return { ...base, eligible: false, reason: eligibility.reason };
    if (candidate.alreadySent && opts.resend !== true) {
      return { ...base, eligible: false, reason: HUBDOC_ALREADY_SENT_REASON };
    }
    return { ...base, eligible: true };
  });
}

/** The ids the card's button will actually post. Nothing else may be sent — the
 *  route re-checks every one of them, but the card must not offer a document it
 *  has just drawn a reason against. */
export function hubdocEligibleIds(documents: readonly HubdocPreparedDocument[]): string[] {
  return documents.filter((d) => d.eligible).map((d) => d.id);
}

/**
 * The line the transcript keeps after a send: "Sent Umgeni-Oct.pdf to Hubdoc."
 *
 * NAMED, NOT COUNTED, up to two files — "Sent 3 to Hubdoc" read back next week
 * says nothing about which three, and this line is the only record of the
 * hand-off inside the conversation (the full receipt is the plugin page's log).
 * Written by the CLIENT, not by a model: it is a fact about what a button did.
 */
export function hubdocSentMessage(filenames: readonly string[]): string {
  const names = filenames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return 'Nothing was sent to Hubdoc.';
  if (names.length === 1) return `Sent ${names[0]} to Hubdoc.`;
  if (names.length === 2) return `Sent ${names[0]} and ${names[1]} to Hubdoc.`;
  return `Sent ${names[0]}, ${names[1]} and ${names.length - 2} more to Hubdoc.`;
}
