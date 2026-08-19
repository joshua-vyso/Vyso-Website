import 'server-only';
import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceSupabase } from './supabase-service';
import { isMissingRelation, isUniqueViolation } from './db-errors';
import { documentNumber, type DocWatchExtracted } from './doc-watch/detect';
import {
  buildHubdocEmail,
  hubdocEligibility,
  hubdocSubject,
  hubdocTooLargeReason,
  HUBDOC_MAX_ATTACHMENT_BYTES,
  type HubdocEmail,
  type HubdocForwardEntry,
} from './hubdoc-shared';

/**
 * Hubdoc cross-upload — the half that touches the world. Reads the org's intake
 * settings, downloads the document, sends the email, writes the receipt.
 *
 * THE ONE RULE THIS FILE EXISTS TO KEEP: NOTHING LEAVES VYSO WITHOUT EITHER A
 * CLICK OR A STANDING INSTRUCTION, AND EVERY THING THAT LEAVES IS LOGGED.
 * `forwardDocumentToHubdoc` is the only function in the product that sends a
 * customer's document to a third party, and it has exactly two callers: the
 * `/api/integrations/hubdoc/send` route (a signed-in owner or admin pressed a
 * button) and `autoForwardDocumentToHubdoc` (the org's `auto_forward` toggle,
 * which defaults to false and records who turned it on). There is no third door
 * and, deliberately, no Finch tool — an outbound send is not something a chat
 * model gets to decide, which is the same drafts-only line the outreach module
 * already holds.
 *
 * IT WRITES A ROW WHETHER IT SUCCEEDS OR FAILS. A send that threw and left no
 * trace is the worst possible outcome: the owner believes the bill was filed. So
 * the log row is the LAST thing attempted and the only thing that is allowed to
 * be silently missing is the row for a send that provably never happened.
 *
 * THE SERVICE ROLE, ON BOTH PATHS, and it is worth reading twice — the same
 * argument `app/api/integrations/xero/sync/route.ts` makes. `hubdoc_forwards`
 * and `org_integrations_hubdoc` are service-role-write only (supabase/hubdoc.sql)
 * because the AUTO path runs inside `after()` on an extraction request that any
 * MEMBER may have made: gating the write on the caller's role would mean a
 * member's upload quietly failing to honour an instruction their owner gave.
 * So the caller establishes the right to act on an org — signed in, and for the
 * settings routes an owner or admin — and passes that org id, and only that org
 * id, in. It never comes from a request body. Every statement below filters
 * `.eq('org_id', orgId)` by hand.
 *
 * IT NEVER THROWS FOR AN ORDINARY PROBLEM. A missing table, a document that does
 * not qualify, an oversized file, a Resend outage — all come back as
 * `{ ok: false, error }` with a sentence written to be shown to an owner. The
 * button renders it; the auto path logs it and moves on. An exception here would
 * take an extraction request down with it.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface HubdocSettings {
  intakeEmail: string | null;
  autoForward: boolean;
  updatedAt: string | null;
  /** supabase/hubdoc.sql has not been pasted into this database yet. */
  tableMissing: boolean;
}

const NO_SETTINGS: HubdocSettings = {
  intakeEmail: null,
  autoForward: false,
  updatedAt: null,
  tableMissing: false,
};

/**
 * The org's Hubdoc settings.
 *
 * TAKES A CLIENT rather than making one, like `xero-mirror.ts` and for the same
 * reason: the plugin page arrives with the caller's RLS-scoped client (the
 * owner/admin select policy is the database-level twin of the page's own gate),
 * while the send paths arrive with the service role. A module that built its own
 * would be wrong for one of them.
 *
 * SOFT ON EVERYTHING. No settings row, no table, a failed read — all read as
 * "Hubdoc is not set up", which is the truth as far as the product can establish
 * it and is what every send path already refuses on.
 */
export async function loadHubdocSettings(
  supabase: SupabaseClient,
  orgId: string,
): Promise<HubdocSettings> {
  const { data, error } = await supabase
    .from('org_integrations_hubdoc')
    .select('intake_email, auto_forward, updated_at')
    .eq('org_id', orgId)
    .maybeSingle<{ intake_email: string | null; auto_forward: boolean | null; updated_at: string | null }>();

  if (error) return { ...NO_SETTINGS, tableMissing: isMissingRelation(error) };
  if (!data) return NO_SETTINGS;
  return {
    intakeEmail: data.intake_email?.trim() || null,
    // Fails to OFF on a null. This flag is the only thing in the product that can
    // send without a click; an unreadable value must never be read as consent.
    autoForward: data.auto_forward === true,
    updatedAt: data.updated_at ?? null,
    tableMissing: false,
  };
}

/**
 * Write the org's Hubdoc settings. Service role only (see the header).
 *
 * UPSERT ON `org_id`, which is the primary key: an organisation has one Hubdoc
 * inbox, and a second row would be a second answer to where its paperwork goes.
 * `updated_by` is recorded on every write because turning auto-forward on is a
 * standing instruction about the company's money, and "somebody turned it on" is
 * not an acceptable audit answer.
 */
export async function saveHubdocSettings(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
  patch: { intakeEmail: string | null; autoForward: boolean },
): Promise<{ ok: true } | { ok: false; error: string; tableMissing: boolean }> {
  const { error } = await supabase.from('org_integrations_hubdoc').upsert(
    {
      org_id: orgId,
      intake_email: patch.intakeEmail,
      auto_forward: patch.autoForward,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id' },
  );
  if (error) {
    return {
      ok: false,
      tableMissing: isMissingRelation(error),
      error: isMissingRelation(error)
        ? 'The Hubdoc tables are not in this database yet — paste supabase/hubdoc.sql into the SQL editor.'
        : error.message,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The log
// ---------------------------------------------------------------------------

/** How many forwards the plugin page's log shows. The plan's number. Enough to
 *  cover a month of ordinary use; short enough that it is a list and not a
 *  report. */
export const HUBDOC_LOG_LIMIT = 50;

interface ForwardRow {
  id: string;
  document_id: string;
  subject: string | null;
  sent_at: string;
  status: string;
  error: string | null;
  triggered_by: string;
  resend: boolean | null;
  document: { filename: string | null } | { filename: string | null }[] | null;
}

/**
 * The org's last `limit` forwards, newest first, with each document's current
 * filename joined on so the log reads as a list of documents rather than a list
 * of uuids.
 *
 * THE JOIN IS NULLABLE ON PURPOSE. `hubdoc_forwards.document_id` cascades on
 * delete, so a row here always has its document — but the RLS-scoped caller may
 * legitimately not see it, and a log that 500s because one join came back empty
 * would hide forty-nine rows that are fine.
 */
export async function loadHubdocForwards(
  supabase: SupabaseClient,
  orgId: string,
  limit: number = HUBDOC_LOG_LIMIT,
): Promise<{ entries: HubdocForwardEntry[]; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from('hubdoc_forwards')
    .select('id, document_id, subject, sent_at, status, error, triggered_by, resend, document:documents(filename)')
    .eq('org_id', orgId)
    .order('sent_at', { ascending: false })
    .limit(limit)
    .returns<ForwardRow[]>();

  if (error) return { entries: [], tableMissing: isMissingRelation(error) };

  const entries = (data ?? []).map((row): HubdocForwardEntry => {
    const doc = Array.isArray(row.document) ? (row.document[0] ?? null) : row.document;
    return {
      id: row.id,
      documentId: row.document_id,
      filename: doc?.filename ?? null,
      subject: row.subject,
      sentAt: row.sent_at,
      // Anything that is not literally 'sent' reads as a failure. A status this
      // build does not recognise must not be drawn as a delivered document.
      status: row.status === 'sent' ? 'sent' : 'failed',
      error: row.error,
      triggeredBy: row.triggered_by === 'auto' ? 'auto' : 'user',
      resend: row.resend === true,
    };
  });
  return { entries, tableMissing: false };
}

/**
 * Which of these documents Vyso has already put into Hubdoc.
 *
 * What the "not in Xero yet" list uses to draw "Sent" beside a row instead of a
 * button, and what "Send all" skips over. SUCCESSFUL SENDS ONLY — a document
 * whose only forward failed has not reached Hubdoc and must still be offered.
 */
export async function hubdocSentDocumentIds(
  supabase: SupabaseClient,
  orgId: string,
  documentIds: string[],
): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('hubdoc_forwards')
    .select('document_id')
    .eq('org_id', orgId)
    .eq('status', 'sent')
    .in('document_id', documentIds)
    .returns<{ document_id: string }[]>();
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.document_id));
}

// ---------------------------------------------------------------------------
// The send
// ---------------------------------------------------------------------------

/** True when Resend is configured. Without it there is no send path at all, and
 *  the card says so rather than offering a button that always fails. */
export const hubdocSendConfigured = Boolean(process.env.RESEND_API_KEY);

export type HubdocTrigger = 'user' | 'auto';

export interface HubdocForwardResult {
  ok: boolean;
  /** Written to be SHOWN. Every failure path below produces a sentence an owner
   *  can act on, not a code. */
  error?: string;
  /** True when this document had already been sent and no second email went out.
   *  Not an error — the desired outcome of a double-click. */
  alreadySent?: boolean;
  subject?: string;
  messageId?: string | null;
}

/** The seam every send goes through. Real implementation below; the parameter
 *  exists so nothing but a deliberate caller can put a message on the wire. */
export type HubdocSender = (email: HubdocEmail) => Promise<{ id: string | null }>;

async function sendThroughResend(email: HubdocEmail): Promise<{ id: string | null }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured.');
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: email.from,
    to: email.to,
    subject: email.subject,
    text: email.text,
    // Resend's own shape: `{ filename, content }` with the bytes base64-encoded.
    attachments: email.attachments,
  });
  if (error) throw new Error(error.message);
  return { id: data?.id ?? null };
}

interface DocumentRow {
  id: string;
  org_id: string;
  filename: string;
  document_type: string | null;
  status: string;
  supplier_id: string | null;
  storage_path: string | null;
  extracted_data: DocWatchExtracted | null;
}

/**
 * Put ONE document into Hubdoc.
 *
 * THE ORDER OF THE CHECKS IS THE POINT. Each one is cheaper than the next and
 * each one refuses for a different reason, so the expensive things (a Storage
 * download, an SMTP round-trip) only happen for a document that has already
 * passed every question about whether it should be sent at all:
 *
 *   1. Is Hubdoc set up for this org?          (one small read)
 *   2. Does the document exist, in THIS org?   (one read, org pinned by hand)
 *   3. Is it the kind of paper Hubdoc takes?   (pure — hubdoc-shared.ts)
 *   4. Has it already been sent?               (one indexed read)
 *   5. Download, size-check, send, log.
 *
 * STEP 4 IS BELT TO THE DATABASE'S BRACES. The partial unique index in
 * supabase/hubdoc.sql makes a second successful non-resend forward impossible;
 * this check makes it impossible to have SENT THE EMAIL and then discovered
 * that. A duplicate the index caught after delivery would be a bill filed twice.
 *
 * `resend: true` is the explicit override — a person choosing to send a document
 * Vyso has already sent. It skips step 4, logs its own row, and shows in the log
 * as "Sent again". The auto path can never set it.
 */
export async function forwardDocumentToHubdoc(options: {
  orgId: string;
  documentId: string;
  triggeredBy: HubdocTrigger;
  /** The signed-in user, for the audit column. Null on the auto path. */
  userId?: string | null;
  /** Deliberate second send. Only ever true from a user click. */
  resend?: boolean;
  /** Test seam. Production callers leave it alone. */
  sender?: HubdocSender;
}): Promise<HubdocForwardResult> {
  const { orgId, documentId, triggeredBy } = options;
  const resend = options.resend === true && triggeredBy === 'user';
  const send = options.sender ?? sendThroughResend;

  const supabase = createServiceSupabase();
  if (!supabase) {
    return { ok: false, error: 'The Supabase service role is not configured on the server.' };
  }

  // ---- 1. Is Hubdoc set up? ------------------------------------------------
  const settings = await loadHubdocSettings(supabase, orgId);
  if (settings.tableMissing) {
    return {
      ok: false,
      error: 'The Hubdoc tables are not in this database yet — paste supabase/hubdoc.sql into the SQL editor.',
    };
  }
  if (!settings.intakeEmail) {
    return { ok: false, error: 'Set your Hubdoc upload address in Plugins → Xero before sending.' };
  }
  if (!hubdocSendConfigured) {
    return { ok: false, error: 'Email sending is not configured on the server.' };
  }

  // ---- 2. The document, in THIS org ---------------------------------------
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .select('id, org_id, filename, document_type, status, supplier_id, storage_path, extracted_data')
    .eq('id', documentId)
    // The service role bypasses RLS, so this is the ONLY thing standing between
    // one tenant's paperwork and another's. It is not optional.
    .eq('org_id', orgId)
    .maybeSingle<DocumentRow>();
  if (docError || !doc) {
    return { ok: false, error: 'That document could not be found.' };
  }

  // ---- 3. May it be sent? --------------------------------------------------
  const eligibility = hubdocEligibility({
    documentType: doc.document_type,
    status: doc.status,
    supplierId: doc.supplier_id,
    storagePath: doc.storage_path,
  });
  if (!eligibility.ok) return { ok: false, error: eligibility.reason };

  // ---- 4. Has it already gone? --------------------------------------------
  if (!resend) {
    const alreadySent = await hubdocSentDocumentIds(supabase, orgId, [documentId]);
    if (alreadySent.has(documentId)) {
      return { ok: true, alreadySent: true };
    }
  }

  // Everything the subject line needs. Both reads are best-effort: a supplier row
  // that has vanished or an org name that cannot be read degrades the subject
  // (see `hubdocSubject`), it does not stop the send — the attachment is the
  // thing Hubdoc actually files.
  const [{ data: supplier }, { data: org }] = await Promise.all([
    supabase.from('suppliers').select('name').eq('org_id', orgId).eq('id', doc.supplier_id).maybeSingle<{ name: string | null }>(),
    supabase.from('organisations').select('name').eq('id', orgId).maybeSingle<{ name: string | null }>(),
  ]);
  const invoiceNumber = documentNumber(doc.extracted_data?.fields ?? []);
  const subject = hubdocSubject({
    supplierName: supplier?.name ?? null,
    invoiceNumber,
    filename: doc.filename,
    documentType: doc.document_type,
  });

  // ---- 5. Download, size-check, send, log ---------------------------------
  const logFailure = (message: string) =>
    writeForwardRow(supabase, {
      orgId,
      documentId,
      intakeEmail: settings.intakeEmail,
      subject,
      status: 'failed',
      error: message,
      triggeredBy,
      resend,
      userId: options.userId ?? null,
      messageId: null,
    });

  const { data: file, error: downloadError } = await supabase.storage
    .from('documents')
    .download(doc.storage_path as string);
  if (downloadError || !file) {
    const message = 'Vyso could not read the stored file for this document.';
    await logFailure(message);
    return { ok: false, error: message };
  }
  if (file.size > HUBDOC_MAX_ATTACHMENT_BYTES) {
    const message = hubdocTooLargeReason(file.size);
    await logFailure(message);
    return { ok: false, error: message };
  }

  const email = buildHubdocEmail({
    intakeEmail: settings.intakeEmail,
    supplierName: supplier?.name ?? null,
    invoiceNumber,
    filename: doc.filename,
    documentType: doc.document_type,
    orgName: org?.name ?? null,
    contentBase64: Buffer.from(await file.arrayBuffer()).toString('base64'),
  });

  let messageId: string | null = null;
  try {
    messageId = (await send(email)).id;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The email could not be sent.';
    await logFailure(message);
    return { ok: false, error: `Hubdoc did not get this document: ${message}` };
  }

  const logged = await writeForwardRow(supabase, {
    orgId,
    documentId,
    intakeEmail: settings.intakeEmail,
    subject,
    status: 'sent',
    error: null,
    triggeredBy,
    resend,
    userId: options.userId ?? null,
    messageId,
  });
  if (!logged.ok && logged.duplicate) {
    // The index caught a race: two paths sent the same document at once. The
    // email HAS gone, so this is reported honestly rather than as a success with
    // no receipt — an owner seeing two identical bills in Hubdoc deserves to
    // know Vyso knows.
    console.error('hubdoc: a concurrent forward of the same document was recorded', documentId);
  }
  return { ok: true, subject, messageId };
}

/** One insert, in one place, so the success and failure paths cannot drift apart
 *  on which columns a receipt carries. */
async function writeForwardRow(
  supabase: SupabaseClient,
  row: {
    orgId: string;
    documentId: string;
    intakeEmail: string | null;
    subject: string;
    status: 'sent' | 'failed';
    error: string | null;
    triggeredBy: HubdocTrigger;
    resend: boolean;
    userId: string | null;
    messageId: string | null;
  },
): Promise<{ ok: boolean; duplicate: boolean }> {
  const { error } = await supabase.from('hubdoc_forwards').insert({
    org_id: row.orgId,
    document_id: row.documentId,
    intake_email: row.intakeEmail,
    subject: row.subject,
    status: row.status,
    // Truncated: a provider error can be a paragraph, and this column is read in
    // a table cell.
    error: row.error ? row.error.slice(0, 500) : null,
    triggered_by: row.triggeredBy,
    resend: row.resend,
    created_by: row.userId,
    resend_message_id: row.messageId,
  });
  if (!error) return { ok: true, duplicate: false };
  // A failed RECEIPT must never fail the caller: the email either went or it did
  // not, and that fact is already decided by the time this runs.
  console.error('hubdoc: could not write the forward log row', row.documentId, error.message);
  return { ok: false, duplicate: isUniqueViolation(error) };
}

/**
 * The standing instruction, fired from `app/api/ai/extract/route.ts`'s `after()`
 * the moment Doc-U finishes reading a document.
 *
 * IT CHECKS THE TOGGLE ITSELF rather than trusting the caller to. The extract
 * route runs for every document every org uploads, so the one line it carries
 * has to be safe to call unconditionally — and the decision about whether an org
 * has given Vyso standing permission to send its paperwork belongs in the module
 * that sends it, not in a route that is mostly about Claude.
 *
 * IT NEVER SENDS A RESEND and never carries a user id: nobody clicked. A
 * document that has already gone is a no-op (step 4 of the forward above), which
 * is what makes a re-extraction free.
 *
 * RETURNS, NEVER THROWS. The caller is a best-effort `after()` callback whose
 * request has already succeeded.
 */
export async function autoForwardDocumentToHubdoc(
  orgId: string,
  documentId: string,
): Promise<HubdocForwardResult & { skipped?: boolean }> {
  const supabase = createServiceSupabase();
  if (!supabase) return { ok: false, skipped: true };

  const settings = await loadHubdocSettings(supabase, orgId);
  // The default, and the answer for every org that has not opted in: do nothing
  // at all. No read of the document, no log row, no trace.
  if (!settings.autoForward || !settings.intakeEmail) return { ok: true, skipped: true };

  return forwardDocumentToHubdoc({ orgId, documentId, triggeredBy: 'auto' });
}
