/**
 * The Review queue — what is waiting on a human decision, right now
 * (`.ai/plan_review_chat.md`).
 *
 * FOUR RULES, three of them lifted straight from `finch-chats.ts` because they
 * are house rules, not table-specific ones.
 *
 * 1. EVERY QUERY RUNS AS THE CALLER. No `createServiceSupabase()` anywhere in
 *    this file, and `.eq('org_id', orgId)` on every select on top of RLS — belt
 *    and braces, so a policy regression cannot widen the queue to another org's
 *    documents or another business's website enquiries.
 *
 * 2. THE MIGRATION MAY NOT BE APPLIED YET, and neither may the MODULE. This
 *    read sits in the platform LAYOUT, so it runs on every `/app/*` route: a
 *    missing relation (or an org without Doc-U / OrderFlow) becomes an empty
 *    source, never a 500. Every source is independently skippable and
 *    independently failable — a broken quote-requests table must not cost the
 *    owner the documents half of their queue.
 *
 * 3. NOTHING IS STORED. There is no `review_items` table and there is not going
 *    to be one. The queue is COMPUTED from the rows Doc-U and OrderFlow already
 *    keep, using THEIR predicates, so it cannot drift out of agreement with the
 *    screens it sends the owner to — approving a document on `/app/docu/[id]`
 *    empties this queue by construction, with nothing to keep in step.
 *
 * 4. THE DECISIONS LIVE NEXT DOOR. Sorting, capping, counting, the prelude and
 *    the claim predicate are pure functions in `review-queue-shared.ts` so
 *    `node --test` can reach them without loading `next/headers`. They are
 *    re-exported below, so callers import from here.
 *
 * ZERO MODEL CALLS. Nothing in this file, and nothing that renders from it,
 * talks to Anthropic. The opening card is a deterministic template over these
 * rows; the conversation BELOW it is where the model lives.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';
import { isMissingRelation } from './db-errors';
import { COMMIT_STALE_MS } from './document-ingest';
import {
  EMPTY_REVIEW_QUEUE,
  isClaimableDocument,
  reviewItemForDocument,
  reviewItemForQuoteRequest,
  shapeReviewQueue,
  type ReviewDocumentRow,
  type ReviewItem,
  type ReviewQuoteRequestRow,
  type ReviewQueue,
} from './review-queue-shared';
import type { FeatureKey } from './types';

export * from './review-queue-shared';

/** Any RLS-scoped client. The layout hands over the cookie session's. */
type ReviewClient = SupabaseClient;

/**
 * How many rows each source will read before the shaping caps the card.
 *
 * Generous on purpose: the COUNT is what the rail's dot draws, and a source
 * that stopped counting at 25 would leave a business with sixty un-actioned
 * invoices looking at a dot that says 25 forever. Doc-U's own review queue
 * reads 200; this matches it.
 */
const SOURCE_LIMIT = 200;

/** Which module a source belongs to, so the layout's `features`/`lockedModules`
 *  can skip it. A locked module is skipped as firmly as an absent one: sending
 *  the owner to a screen that answers "this module is locked" is worse than not
 *  listing the item. */
interface ReviewSource {
  kind: string;
  feature: FeatureKey;
  load: (supabase: ReviewClient, orgId: string) => Promise<ReviewItem[]>;
}

/* ── Source 1: documents awaiting a decision ────────────────────────────────
 *
 * DOC-U'S OWN PREDICATES, and here is exactly which:
 *
 *   `/app/docu/awaiting`  →  status in ('extracted','pending')
 *   `/app/docu/review`    →  the above, plus `email_ingest_id is not null`,
 *                            plus the claim guard `reviewClaimableOr()`
 *   `/app/docu/flagged`   →  status = 'error'
 *
 * This source is AWAITING ∪ FLAGGED, with the review queue's CLAIM GUARD
 * carried across. Three deliberate choices in that sentence:
 *
 *   - The `email_ingest_id` narrowing is dropped. That column is what keeps
 *     chat/manual uploads off `/app/docu/review` (they commit inline), but they
 *     genuinely do sit at 'extracted'/'pending' when their commit hasn't
 *     happened, `/app/docu/awaiting` genuinely lists them, and a document
 *     dropped into Finch that ends up needing a decision is precisely the case
 *     the plan asks this queue to catch (W5 synergy). So: the broader screen's
 *     predicate.
 *   - The claim guard is KEPT. A document someone is mid-Save on is not
 *     awaiting a decision, it is having one made. Applied in memory rather than
 *     as an `.or()` on the select — see `isClaimableDocument` for why.
 *   - "Low confidence" is NOT a fourth predicate. `/app/docu/confidence`
 *     SORTS by confidence; it does not filter, so there is no such queue to
 *     reuse. A low-confidence document that needs a decision is already here by
 *     status, and its confidence is said in the item's detail line instead.
 *
 * One query, so a document that is both awaiting and flagged (it cannot be —
 * `status` is one column — and a document both uploaded-by-chat and awaiting
 * review, which it can be) appears exactly once.
 */
const DOCUMENT_COLS =
  'id, filename, document_type, extracted_data, status, confidence, approved_at, created_at, supplier:suppliers(name)';

async function loadDocuments(supabase: ReviewClient, orgId: string): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLS)
    .eq('org_id', orgId)
    .in('status', ['extracted', 'pending', 'error'])
    .order('created_at', { ascending: false })
    .limit(SOURCE_LIMIT)
    .returns<ReviewDocumentRow[]>();

  // Rule 2 — every `/app/*` route renders through this.
  if (error) {
    if (!isMissingRelation(error)) console.error('[review-queue] documents source failed', error);
    return [];
  }

  const staleBefore = Date.now() - COMMIT_STALE_MS;
  return (data ?? [])
    .filter((row) => row.status === 'error' || isClaimableDocument(row.approved_at, staleBefore))
    .map(reviewItemForDocument);
}

/* ── Source 2: website enquiries awaiting a quote ───────────────────────────
 *
 * ORDERFLOW'S OWN PREDICATE, and here is which one. `/app/orderflow/quotes`
 * lists `status='new'` (including the AI-flagged likely-spam, because a human
 * confirms those); the OrderFlow DASHBOARD's headline count is
 * `status='new' AND flagged_spam=false`, described in `orderflow-data.ts` as
 * "real leads awaiting a quote".
 *
 * The Review queue uses the DASHBOARD's. Its whole promise is that it empties —
 * a bounce message that nobody will ever draft a quote from would sit in it
 * forever, wearing out the red dot that is the point of the feature. The
 * flagged rows are not hidden: they are still on the Quotes screen, which is
 * where they get confirmed.
 */
const QUOTE_REQUEST_COLS =
  'id, contact_name, business_name, contact_email, from_email, message, requested_items, received_at';

async function loadQuoteRequests(supabase: ReviewClient, orgId: string): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from('of_quote_requests')
    .select(QUOTE_REQUEST_COLS)
    .eq('org_id', orgId)
    .eq('status', 'new')
    .eq('flagged_spam', false)
    .order('received_at', { ascending: false })
    .limit(SOURCE_LIMIT)
    .returns<ReviewQuoteRequestRow[]>();

  if (error) {
    if (!isMissingRelation(error)) console.error('[review-queue] quote requests source failed', error);
    return [];
  }
  return (data ?? []).map(reviewItemForQuoteRequest);
}

/**
 * The registry. A new kind of decision is a new entry here plus a group label
 * in `REVIEW_GROUPS` — nothing else in the rail, the page or the prelude
 * changes.
 *
 * PRICE WATCH IS DELIBERATELY ABSENT. `pw_item_matches` has a `status='review'`
 * of its own, but there is no screen in the platform on which a human can make
 * that decision (a known gap, flagged in `.ai/implementation.md`). A queue row
 * whose "Open" link goes nowhere is worse than no row: the promise this feature
 * makes is that everything in it can be finished.
 */
const REVIEW_SOURCES: readonly ReviewSource[] = [
  { kind: 'document', feature: 'docu', load: loadDocuments },
  { kind: 'quote_request', feature: 'orderflow', load: loadQuoteRequests },
];

/**
 * Everything waiting on a human, newest first.
 *
 * WHO SEES IT (plan §"Members vs admins"). Documents and quote requests are
 * OPERATIONAL — filing an invoice and answering an enquiry are the work, not
 * the books — so the queue is not behind `canSeeMoney`. Its gate is module
 * access: a source is read only when the org has that module and has not had it
 * locked. If a money-only kind ever joins, it gets the money gate; none does in
 * v1.
 *
 * One query per enabled source, in parallel, both cheap and both indexed
 * (`documents` on org+status, `of_quote_requests` on org+status+received_at).
 * Never throws: an org with no modules gets `EMPTY_REVIEW_QUEUE` without
 * touching the database.
 */
export async function loadReviewQueue(
  orgId: string,
  access: { features: Record<FeatureKey, boolean>; lockedModules: readonly FeatureKey[] },
  supplied?: ReviewClient,
): Promise<ReviewQueue> {
  const sources = REVIEW_SOURCES.filter(
    (s) => access.features[s.feature] && !access.lockedModules.includes(s.feature),
  );
  if (sources.length === 0) return EMPTY_REVIEW_QUEUE;

  const supabase = supplied ?? ((await createServerSupabase()) as unknown as ReviewClient);
  const loaded = await Promise.all(sources.map((s) => s.load(supabase, orgId)));
  return shapeReviewQueue(loaded.flat());
}
