/**
 * Review v2's writes — every one of them a call into the module that owns it
 * (`.ai/plan_review_v2.md` §1.5).
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE. Approving from the Review chat must
 * be the SAME EVENT as approving on the module's own screen — not an equivalent
 * one, not a faster one. So there is no UPDATE in this file that a module does
 * not already run:
 *
 *   document · approve  →  `commitDocument`   (lib/platform/document-ingest.ts)
 *   document · reject   →  `discardDocument`  (same file — the write behind
 *                          `/api/docu/review`'s `action:'discard'`)
 *   quote    · dismiss  →  the Quotes screen's own patch, `status:'dismissed'`
 *   quote    · customer →  the `of_customers` insert the Customers screen and
 *                          the upload path both use, plus its activity row
 *
 * That is the whole surface, and it is deliberately short. Doc-U has no way to
 * approve a document it could not read (`commitDocument` claims only
 * 'extracted'/'pending'), and the Quotes screen has no "approve" at all — so
 * neither is invented here. What is missing from this list is missing from the
 * UI too; see `REVIEW_TASKS` for where that is decided and why.
 *
 * EVERY QUERY RUNS AS THE CALLER, with `.eq('org_id', orgId)` on top of RLS —
 * the same belt-and-braces `review-queue.ts` reads under. `createServiceSupabase`
 * appears nowhere in this file: an approval is a person's decision, made with a
 * person's privileges.
 *
 * PERMISSION IS CHECKED PER ITEM, not per request. A batch is a list of
 * different kinds of thing, and the gate on a document (owner/admin, because
 * committing one moves stock and money) is not the gate on an enquiry (module
 * access, because answering one is the work). A single up-front check would have
 * to take the stricter of the two and would silently refuse a member the thing
 * they are allowed to do.
 *
 * ZERO MODEL CALLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { canSeeMoney } from './access';
import { buildDocWatchDedupeKey } from './agents/dedupe-keys';
import { isMissingRelation, isUniqueViolation } from './db-errors';
import {
  commitDocumentFast,
  commitDocumentFollowUp,
  discardDocument,
  type ClaimedDocumentRow,
} from './document-ingest';
import { documentTypeLabel } from './documents';
import { docTotal, findFieldValue, parseAmount } from './docu/extract';
import { hubdocStateForDocument } from './hubdoc';
import { logActivity } from './orderflow-activity';
import { createServerSupabase, getPlatformSession } from './supabase-server';
import {
  customerFromQuoteRequest,
  findExistingCustomer,
  reviewItemKey,
  REVIEW_APPROVE_CAP,
  type QuoteCustomerPayload,
  type ReviewApprovalResult,
  type ReviewItemRef,
} from './review-actions-shared';
import {
  reviewDocumentDetail,
  reviewDocumentTitle,
  reviewQuoteWho,
  type ReviewDocumentRow,
  type ReviewKind,
  type ReviewQuoteRequestRow,
} from './review-queue-shared';
import { DOC_LOW_CONFIDENCE_THRESHOLD } from './tokens';
import type { FeatureKey } from './types';
import type { HubdocDocumentState } from '@/components/platform/docu/SendToHubdoc';

/** Who is asking, and what they may reach. Assembled by the routes from
 *  `getPlatformSession()` so the gates below are the session's, never the
 *  request body's. */
export interface ReviewActor {
  orgId: string;
  userId: string;
  email: string | null;
  role: string | null;
  features: Record<FeatureKey, boolean>;
  lockedModules: readonly FeatureKey[];
}

/**
 * The caller, as the session says they are — never as the request body says.
 *
 * Every one of the three `/api/review/*` routes starts here, so the org id, the
 * user id and the role behind each gate come from the signed-in cookie session
 * and there is no parameter any of them could set to become someone else. It
 * returns the RLS-scoped client alongside, because an actor without the client
 * that matches it is an invitation to run a write as somebody else.
 */
export async function resolveReviewActor(): Promise<{
  supabase: SupabaseClient;
  actor: ReviewActor;
} | null> {
  const session = await getPlatformSession();
  if (!session?.org) return null;

  const supabase = (await createServerSupabase()) as unknown as SupabaseClient;
  return {
    supabase,
    actor: {
      orgId: session.org.id,
      userId: session.userId,
      email: session.email || null,
      role: session.profile?.role ?? null,
      features: session.features,
      lockedModules: session.lockedModules,
    },
  };
}

/** Is this module both switched on for the org and not locked? A locked module
 *  is refused as firmly as an absent one — `review-queue.ts` skips its source
 *  for the same reason, so an item from a locked module should never reach here
 *  at all, and this is the check that says so if one does. */
function moduleOpen(actor: ReviewActor, feature: FeatureKey): boolean {
  return actor.features[feature] === true && !actor.lockedModules.includes(feature);
}

/**
 * May this person take this action on this kind of item?
 *
 * DOCUMENTS ARE MONEY-GATED; ENQUIRIES ARE NOT. That is not a new opinion — it
 * is the two modules' existing ones, restated. `/api/docu/review` refuses
 * anyone who is not an owner or admin before it will save or discard, and
 * `canSeeMoney` is that same predicate (`lib/platform/access.ts`), so a
 * document approved from the Review chat passes exactly the gate it would have
 * passed on `/app/docu/[id]`. The Quotes screen has no role gate — every member
 * with OrderFlow can dismiss an enquiry or add a customer there — so neither
 * does this.
 *
 * Fails closed: an unknown role is not an admin.
 */
export function permitReviewAction(
  actor: ReviewActor,
  kind: ReviewKind,
): { ok: true } | { ok: false; status: number; error: string } {
  if (kind === 'document') {
    if (!moduleOpen(actor, 'docu')) {
      return { ok: false, status: 403, error: 'Doc-U is not open for this business.' };
    }
    if (!canSeeMoney(actor.role)) {
      return { ok: false, status: 403, error: 'Only an owner or admin can approve documents.' };
    }
    return { ok: true };
  }

  if (!moduleOpen(actor, 'orderflow')) {
    return { ok: false, status: 403, error: 'OrderFlow is not open for this business.' };
  }
  return { ok: true };
}

/* ── Approvals ──────────────────────────────────────────────────────────── */

/**
 * Approve a batch, one at a time, and say what happened to each.
 *
 * SERIAL, NOT PARALLEL, and that is a correctness choice rather than a courtesy
 * to the database. Each approval's follow-up runs the document's side effects —
 * an OrderFlow order, an invoice, ProcurePulse stock and supplier prices — and
 * two of those landing at once for the same supplier is exactly the interleaving
 * the per-document claim exists to prevent WITHIN a document and cannot prevent
 * ACROSS them. Twenty invoices from one supplier, committed in parallel, would
 * race on that supplier's price history. That is why `runReviewFollowUps` below
 * awaits them in order too, even though nothing is waiting on it.
 *
 * NEVER THROWS, AND NEVER STOPS EARLY. One item failing is a result, not an
 * exception: the plan's §3 says the failed row stays with its error and the rest
 * proceed, and a batch that abandoned the remaining nineteen because the third
 * was mid-Save would be a worse tool than approving them one by one.
 *
 * IDEMPOTENT, because the claim is: a document already at 'approved' returns
 * `ok: true` from the claim's own re-read, so a double-click, a retry after a
 * dropped connection, or a second admin pressing the same button all report
 * success rather than an error the owner has to interpret.
 *
 * DUPLICATES IN THE BODY ARE COLLAPSED before anything runs. A hand-built
 * request listing the same id twice must not attempt the same commit twice.
 *
 * ── v2.1: WHAT THIS RETURNS NOW, AND WHY ───────────────────────────────────
 * Only the STATUS WRITES happen here. `commitDocumentFast` claims the row and
 * marks it approved — two indexed UPDATEs — and hands back the row its side
 * effects still need. The caller (`/api/review/approve`) responds on that, then
 * passes `followUps` to `runReviewFollowUps` inside Next's `after()`.
 *
 * Josh's ask, verbatim (2026-08-19): "background approve, but don't commit to
 * agents watching for them or updating modules". So there is no queue, no table
 * and no watcher: a follow-up that fails is a `console.error` and the document
 * stays approved. See `commitDocumentFast`'s docblock for the trade-off in full.
 */
export async function approveReviewItems(
  supabase: SupabaseClient,
  actor: ReviewActor,
  items: readonly ReviewItemRef[],
): Promise<{ results: ReviewApprovalResult[]; followUps: ClaimedDocumentRow[] }> {
  const seen = new Set<string>();
  const unique: ReviewItemRef[] = [];
  for (const item of items) {
    const key = reviewItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= REVIEW_APPROVE_CAP) break;
  }

  const results: ReviewApprovalResult[] = [];
  const followUps: ClaimedDocumentRow[] = [];

  for (const item of unique) {
    const permitted = permitReviewAction(actor, item.kind);
    if (!permitted.ok) {
      results.push({ ...item, ok: false, error: permitted.error });
      continue;
    }

    if (item.kind !== 'document') {
      // Unreachable from the UI — `selectApprovable` never puts a quote request
      // in a batch — but this is a public route, and the honest refusal names
      // the two things OrderFlow actually offers instead.
      results.push({
        ...item,
        ok: false,
        error: 'An enquiry is answered by drafting a quote or dismissing it, not by approving it.',
      });
      continue;
    }

    // Doc-U's own claim and Doc-U's own guards. Its error strings are passed
    // through verbatim rather than rewritten: "That document is already being
    // saved" is the truth, and a friendlier sentence invented here would be a
    // second account of what happened.
    const committed = await commitDocumentFast(supabase, {
      documentId: item.id,
      orgId: actor.orgId,
      userId: actor.userId,
    });

    if (committed.ok && committed.followUp) followUps.push(committed.followUp);
    results.push(
      committed.ok ? { ...item, ok: true } : { ...item, ok: false, error: committed.error },
    );
  }

  return { results, followUps };
}

/**
 * The detached half of a batch: every approved document's side effects, in the
 * order they were approved.
 *
 * SERIAL FOR THE REASON THE BATCH IS — two commits for one supplier racing on
 * that supplier's price history. Nothing awaits this from the browser; the
 * route hands it to `after()` and answers immediately.
 *
 * NEVER THROWS. Each follow-up swallows and logs its own failure
 * (`commitDocumentFollowUp`), so one bad document cannot strand the nineteen
 * behind it.
 */
export async function runReviewFollowUps(
  supabase: SupabaseClient,
  followUps: readonly ClaimedDocumentRow[],
): Promise<void> {
  for (const row of followUps) {
    await commitDocumentFollowUp(supabase, row);
  }
}

/** Reject one document — Doc-U's "Discard", unchanged. Single-item only: there
 *  is no batch reject anywhere in the product, and a queue-wide one would be the
 *  most destructive button in it. */
export async function rejectReviewDocument(
  supabase: SupabaseClient,
  actor: ReviewActor,
  documentId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const permitted = permitReviewAction(actor, 'document');
  if (!permitted.ok) return permitted;

  const discarded = await discardDocument(supabase, {
    documentId,
    orgId: actor.orgId,
    userId: actor.userId,
  });
  return discarded.ok ? { ok: true } : { ok: false, status: discarded.status, error: discarded.error };
}

/* ── Quote requests ─────────────────────────────────────────────────────── */

/**
 * Mark an enquiry handled — the Quotes screen's Dismiss, to the letter.
 *
 * WHY "DISMISS" AND NOT "MARK HANDLED". `of_quote_requests.status` is
 * `new | quoted | dismissed`. 'quoted' is set by the quote builder when a priced
 * document is actually drafted, so the only "done" a person can set directly is
 * 'dismissed' — which is precisely what the Dismiss button on
 * `components/platform/orderflow/QuoteRequests.tsx` writes. The plan called the
 * control "Mark handled"; it is labelled **Dismiss** in the pane instead,
 * because giving one write two names across two screens is the "second approval
 * semantics" the plan forbids in the sentence above it.
 *
 * ALREADY HANDLED IS SUCCESS. The `.eq('status','new')` makes the write a no-op
 * on a row someone else has already dealt with; rather than report that as a
 * failure, the status is re-read and a row that has moved on to 'quoted' or
 * 'dismissed' answers `ok` — the caller's intent is met either way, and the
 * plan's §3 asks for no error toast in exactly this case.
 */
export async function dismissQuoteRequest(
  supabase: SupabaseClient,
  actor: ReviewActor,
  requestId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const permitted = permitReviewAction(actor, 'quote_request');
  if (!permitted.ok) return permitted;

  const { data: updated, error } = await supabase
    .from('of_quote_requests')
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('org_id', actor.orgId)
    .eq('status', 'new')
    .select('id')
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) {
      return { ok: false, status: 404, error: 'Quote requests are not set up for this business.' };
    }
    return { ok: false, status: 500, error: error.message };
  }
  if (updated) return { ok: true };

  const { data: current } = await supabase
    .from('of_quote_requests')
    .select('status')
    .eq('id', requestId)
    .eq('org_id', actor.orgId)
    .maybeSingle<{ status: string }>();

  if (!current) return { ok: false, status: 404, error: 'That enquiry is not in your organisation.' };
  return { ok: true };
}

export interface AddCustomerResult {
  customerId: string;
  name: string;
  /** True when the row already existed and was linked rather than created. The
   *  pane says "already a customer" instead of "added" — the outcome is the
   *  same, and claiming to have created a customer that was there yesterday is
   *  the kind of small lie that costs a tool its credibility. */
  existing: boolean;
}

/**
 * Turn an enquiry into an OrderFlow customer.
 *
 * THE SAME INSERT THE CUSTOMERS SCREEN RUNS — `of_customers` with
 * `{ org_id, name, email, phone }` and an `of_activity` row logged after it, so
 * a customer added from the Review chat appears in the profile's timeline
 * exactly like one typed in by hand. The extra columns that screen's form
 * collects (VAT number, terms, credit limit) are simply not known from a contact
 * form, and are left null rather than guessed.
 *
 * DEDUPE BEFORE INSERT, then again after. The pre-check (`findExistingCustomer`
 * on email, then on the normalised name) is what lets the button say "already a
 * customer" without a write; the unique-violation catch behind it is what makes
 * the operation safe when two people press it at once. Neither alone is enough:
 * the first races, and the second alone would mean the button always looked
 * available.
 *
 * THE ENQUIRY IS LINKED TO THE CUSTOMER on success (`customer_id`). The schema
 * says that column is "set BY A HUMAN" — this is a human, clicking a button on a
 * screen showing them the message. A failed link is not a failed operation: the
 * customer exists, which is what was asked for, so the link's error is swallowed
 * rather than rolled back into a confusing failure.
 */
export async function addCustomerFromQuoteRequest(
  supabase: SupabaseClient,
  actor: ReviewActor,
  requestId: string,
): Promise<{ ok: true; result: AddCustomerResult } | { ok: false; status: number; error: string }> {
  const permitted = permitReviewAction(actor, 'quote_request');
  if (!permitted.ok) return permitted;

  const { data: request, error: readErr } = await supabase
    .from('of_quote_requests')
    .select('id, contact_name, business_name, contact_email, contact_phone')
    .eq('id', requestId)
    .eq('org_id', actor.orgId)
    .maybeSingle<{
      id: string;
      contact_name: string | null;
      business_name: string | null;
      contact_email: string | null;
      contact_phone: string | null;
    }>();

  if (readErr && isMissingRelation(readErr)) {
    return { ok: false, status: 404, error: 'Quote requests are not set up for this business.' };
  }
  if (!request) return { ok: false, status: 404, error: 'That enquiry is not in your organisation.' };

  const payload = customerFromQuoteRequest(request);
  if (!payload) {
    return {
      ok: false,
      status: 400,
      error: 'This enquiry does not give a name to file a customer under.',
    };
  }

  const { data: existingRows } = await supabase
    .from('of_customers')
    .select('id, name, email')
    .eq('org_id', actor.orgId)
    .returns<{ id: string; name: string; email: string | null }[]>();
  const customers = existingRows ?? [];

  const already = findExistingCustomer(payload, customers);
  if (already) {
    await linkRequestToCustomer(supabase, actor.orgId, requestId, already.id);
    return { ok: true, result: { ...already, customerId: already.id, existing: true } };
  }

  const { data: created, error: insertErr } = await supabase
    .from('of_customers')
    .insert({ org_id: actor.orgId, name: payload.name, email: payload.email, phone: payload.phone })
    .select('id, name')
    .single();

  if (insertErr || !created) {
    if (isUniqueViolation(insertErr)) {
      // Someone else added them between the read and the write. Re-read rather
      // than fail: the customer the owner asked for now exists.
      const { data: raced } = await supabase
        .from('of_customers')
        .select('id, name, email')
        .eq('org_id', actor.orgId)
        .returns<{ id: string; name: string; email: string | null }[]>();
      const found = findExistingCustomer(payload, raced ?? []);
      if (found) {
        await linkRequestToCustomer(supabase, actor.orgId, requestId, found.id);
        return { ok: true, result: { ...found, customerId: found.id, existing: true } };
      }
    }
    return { ok: false, status: 500, error: insertErr?.message ?? 'Could not add the customer.' };
  }

  const row = created as { id: string; name: string };
  logActivity(supabase, {
    orgId: actor.orgId,
    actorEmail: actor.email,
    entityType: 'customer',
    entityId: row.id,
    customerId: row.id,
    event: 'customer_created',
    description: row.name,
  });
  await linkRequestToCustomer(supabase, actor.orgId, requestId, row.id);

  return { ok: true, result: { customerId: row.id, name: row.name, existing: false } };
}

/** Best-effort: point the enquiry at the customer it produced. Failure here
 *  leaves a customer that exists and an enquiry that does not know about it —
 *  untidy, never wrong — so it is swallowed. */
async function linkRequestToCustomer(
  supabase: SupabaseClient,
  orgId: string,
  requestId: string,
  customerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('of_quote_requests')
    .update({ customer_id: customerId, updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('org_id', orgId);
  if (error) console.warn('[review-actions] could not link enquiry to customer:', error.message);
}

/* ── The detail pane's payload ──────────────────────────────────────────── */

export interface ReviewDocumentDetail {
  kind: 'document';
  id: string;
  title: string;
  filename: string;
  documentType: string;
  status: string;
  supplier: string | null;
  /** The document's own number, when one was extracted. */
  number: string | null;
  date: string | null;
  /** Incl. VAT — `docTotal` prefers an extracted "Total"/"Amount due" field and
   *  falls back to summing the line amounts, which is the gross figure in both
   *  cases. Null when neither exists; the pane then says so. */
  total: number | null;
  vat: number | null;
  lineCount: number;
  confidence: number | null;
  lowConfidence: boolean;
  /** Why it is in the queue, in the queue's own words. */
  reason: string;
  uploadedAt: string;
  uploadedBy: string | null;
  /** Doc Watch's sentence about this document, when it has one. */
  docWatch: string | null;
  previewUrl: string | null;
  isImage: boolean;
  href: string;
  /** Doc-U can commit this one — false for a flagged document, which has
   *  nothing extracted to commit. */
  canApprove: boolean;
  hubdoc: HubdocDocumentState | null;
}

export interface ReviewQuoteDetail {
  kind: 'quote_request';
  id: string;
  who: string;
  businessName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  /** The website's mailer. Shown as provenance, never used as a contact. */
  viaEmail: string | null;
  /** Verbatim, as typed into a public form. Rendered as text; never HTML. */
  message: string | null;
  items: { description: string; quantity: string | null; unit: string | null }[];
  receivedAt: string;
  /** The customer this would create, or null when there is not enough to file
   *  one under. */
  customer: QuoteCustomerPayload | null;
  /** Set when this org already has them — the button says so instead. */
  existingCustomer: { id: string; name: string } | null;
  /** Where the quote builder opens, prefilled from the enquiry. */
  href: string;
  listHref: string;
}

export type ReviewItemDetail = ReviewDocumentDetail | ReviewQuoteDetail;

const DETAIL_DOCUMENT_COLS =
  'id, filename, document_type, extracted_data, status, confidence, approved_at, created_at, storage_path, supplier_id, uploaded_by, supplier:suppliers(name)';

/**
 * Everything the pane draws for one item, loaded when it is opened.
 *
 * LAZY, AND HERE IS THE DECISION THE PLAN ASKED TO BE RECORDED. The queue can
 * hold 25 items; this payload costs a signed storage URL, a Doc Watch lookup and
 * — for a document — the three-read Hubdoc gate. Inlining it into the page's own
 * read would multiply that by twenty-five to draw a pane the owner opens once,
 * on a screen whose entire promise is that it appears the moment something needs
 * attention. So: the chain is the light thing that loads with the page, and
 * `GET /api/review/item` is paid for per open. A reload with `?item=` pays it
 * once, which is the same cost the click would have been.
 *
 * SOFT ON EVERY OPTIONAL READ. The preview, the Doc Watch sentence and the
 * Hubdoc verdict each degrade to absent; only the item itself is required, and
 * its absence is a 404 the pane turns into "already handled".
 */
export async function loadReviewItemDetail(
  supabase: SupabaseClient,
  actor: ReviewActor,
  ref: ReviewItemRef,
): Promise<{ ok: true; detail: ReviewItemDetail } | { ok: false; status: number; error: string }> {
  const permitted = permitReviewAction(actor, ref.kind);
  if (!permitted.ok) return permitted;

  return ref.kind === 'document'
    ? loadDocumentDetail(supabase, actor, ref.id)
    : loadQuoteDetail(supabase, actor, ref.id);
}

async function loadDocumentDetail(
  supabase: SupabaseClient,
  actor: ReviewActor,
  id: string,
): Promise<{ ok: true; detail: ReviewDocumentDetail } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('documents')
    .select(DETAIL_DOCUMENT_COLS)
    .eq('id', id)
    .eq('org_id', actor.orgId)
    .maybeSingle();

  if (error && isMissingRelation(error)) {
    return { ok: false, status: 404, error: 'Documents are not set up for this business.' };
  }
  const row = data as
    | (ReviewDocumentRow & { storage_path: string | null; supplier_id: string | null; uploaded_by: string | null })
    | null;
  if (!row) return { ok: false, status: 404, error: 'That document is not in your organisation.' };

  const [preview, docWatch, uploadedBy, hubdoc] = await Promise.all([
    row.storage_path
      ? supabase.storage.from('documents').createSignedUrl(row.storage_path, 600)
      : Promise.resolve({ data: null }),
    docWatchSentence(supabase, actor.orgId, row.id),
    uploaderName(supabase, actor.orgId, row.uploaded_by),
    hubdocStateForDocument(supabase, actor.orgId, row.id, {
      documentType: row.document_type,
      status: row.status,
      supplierId: row.supplier_id,
      storagePath: row.storage_path,
      canSend: canSeeMoney(actor.role),
    }).catch(() => null),
  ]);

  const confidence = typeof row.confidence === 'number' ? row.confidence : null;
  const vatRaw = findFieldValue(row, 'vat', 'tax');

  return {
    ok: true,
    detail: {
      kind: 'document',
      id: row.id,
      title: reviewDocumentTitle(row),
      filename: row.filename,
      documentType: documentTypeLabel(row),
      status: row.status,
      supplier: row.supplier?.name?.trim() || null,
      number: findFieldValue(row, 'invoice number', 'document number', 'number', 'reference'),
      date: findFieldValue(row, 'date', 'issued'),
      total: docTotal(row),
      vat: parseAmount(vatRaw),
      lineCount: row.extracted_data?.line_items?.length ?? 0,
      confidence,
      lowConfidence: confidence != null && confidence < DOC_LOW_CONFIDENCE_THRESHOLD,
      reason: reviewDocumentDetail(row),
      uploadedAt: row.created_at,
      uploadedBy,
      docWatch,
      previewUrl: (preview as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null,
      isImage: isImageFilename(row.filename, row.storage_path),
      href: `/app/docu/${row.id}`,
      // The one fact the whole pane's action row turns on. A flagged document is
      // 'error', which `commitDocument` will not claim — so no Approve, and no
      // Reject either (`discardDocument` takes the same two statuses).
      canApprove: row.status === 'extracted' || row.status === 'pending',
      hubdoc,
    },
  };
}

/** Duplicated from `DocumentPreview`'s exported helper rather than imported: this
 *  module must not pull a React component (and its 'use client' neighbours) into
 *  a route's server bundle. The rule is one line and it is stated in both
 *  places — extension, lower-cased, from the filename or the storage path. */
function isImageFilename(filename: string | null, storagePath: string | null): boolean {
  const ext = (filename || storagePath || '').toLowerCase().split('?')[0].split('.').pop();
  return ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif', 'bmp'].includes(ext ?? '');
}

/** Doc Watch's card for this document, if it raised one. Keyed by the agent's
 *  own dedupe key (`doc_watch:<id>`), which is unique per document by design, so
 *  this is a single indexed read and not a scan of the findings table. */
async function docWatchSentence(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('agent_findings')
    .select('observation')
    .eq('org_id', orgId)
    .eq('dedupe_key', buildDocWatchDedupeKey(documentId))
    .maybeSingle<{ observation: string | null }>();
  if (error || !data) return null;
  return data.observation?.trim() || null;
}

/** Who put this document in. Null when nobody is recorded (email ingest) or the
 *  profile has no name — the pane then omits the line rather than printing a
 *  uuid at the owner. */
async function uploaderName(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .eq('org_id', orgId)
    .maybeSingle<{ full_name: string | null }>();
  return data?.full_name?.trim() || null;
}

async function loadQuoteDetail(
  supabase: SupabaseClient,
  actor: ReviewActor,
  id: string,
): Promise<{ ok: true; detail: ReviewQuoteDetail } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from('of_quote_requests')
    .select(
      'id, contact_name, business_name, contact_email, contact_phone, from_email, message, requested_items, received_at',
    )
    .eq('id', id)
    .eq('org_id', actor.orgId)
    .maybeSingle();

  if (error && isMissingRelation(error)) {
    return { ok: false, status: 404, error: 'Quote requests are not set up for this business.' };
  }
  const row = data as (ReviewQuoteRequestRow & { contact_phone: string | null }) | null;
  if (!row) return { ok: false, status: 404, error: 'That enquiry is not in your organisation.' };

  const payload = customerFromQuoteRequest(row);
  let existingCustomer: { id: string; name: string } | null = null;
  if (payload) {
    const { data: customers } = await supabase
      .from('of_customers')
      .select('id, name, email')
      .eq('org_id', actor.orgId)
      .returns<{ id: string; name: string; email: string | null }[]>();
    existingCustomer = findExistingCustomer(payload, customers ?? []);
  }

  const rawItems = Array.isArray(row.requested_items) ? row.requested_items : [];

  return {
    ok: true,
    detail: {
      kind: 'quote_request',
      id: row.id,
      who: reviewQuoteWho(row),
      businessName: row.business_name?.trim() || null,
      contactName: row.contact_name?.trim() || null,
      email: row.contact_email?.trim() || null,
      phone: row.contact_phone?.trim() || null,
      viaEmail: row.from_email?.trim() || null,
      message: row.message?.trim() || null,
      items: rawItems.map((raw) => {
        const it = (raw ?? {}) as { description?: unknown; quantity?: unknown; unit?: unknown };
        return {
          description: typeof it.description === 'string' ? it.description : '',
          quantity: it.quantity == null ? null : String(it.quantity),
          unit: typeof it.unit === 'string' ? it.unit : null,
        };
      }),
      receivedAt: row.received_at,
      customer: payload,
      existingCustomer,
      href: `/app/orderflow/quotes/new?request=${row.id}`,
      listHref: '/app/orderflow/quotes',
    },
  };
}
