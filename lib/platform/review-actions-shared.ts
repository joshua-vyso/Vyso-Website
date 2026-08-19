/**
 * Review v2's decisions, with no database and no framework attached
 * (`.ai/plan_review_v2.md` §2).
 *
 * Same split, for the same reason, as `review-queue-shared.ts` next door:
 * `review-actions.ts` opens Supabase and imports Doc-U's commit path, so
 * `node --test` cannot load it. What is worth pinning is not the writes — those
 * belong to the modules and are tested where they live — but the ARITHMETIC
 * AROUND them, and every one of these functions decides something that would be
 * expensive to get wrong in front of an owner's unapproved invoices:
 *
 *   - which items a "Approve all" actually sends (never a quote request, never a
 *     flagged document — see `REVIEW_TASKS`),
 *   - what that button is allowed to claim it will do,
 *   - how a partial result folds back into the list so the rows that failed stay
 *     and the rows that succeeded go,
 *   - and what an `of_customers` row built from a stranger's contact form may
 *     contain.
 *
 * `.ts`-suffixed relative imports: `node --test` strips types but does NOT
 * resolve extensionless ESM specifiers, and this module is one the runner loads
 * directly (the 2026-08-14 Price Watch outage in person).
 */

import type {
  ReviewItem,
  ReviewKind,
  ReviewModuleGroup,
  ReviewModuleKey,
  ReviewTaskId,
} from './review-queue-shared.ts';

/**
 * The most items one approve request may carry.
 *
 * Approvals are SERIAL and each one runs Doc-U's side effects (an OrderFlow
 * order, an invoice, ProcurePulse stock and supplier prices), so a hundred of
 * them is already a long request. The queue itself caps its card at
 * `REVIEW_CAP` (25), so this ceiling is only reachable by a caller building its
 * own body — which is exactly the caller it exists to bound.
 */
export const REVIEW_APPROVE_CAP = 100;

/** One thing to act on, as it crosses the wire. */
export interface ReviewItemRef {
  kind: ReviewKind;
  id: string;
}

/* ── Item keys ──────────────────────────────────────────────────────────────
 *
 * `"document:9f0c…"`. One string per item, because three separate things need to
 * name an item and none of them can carry an object: a React `key`, the `?item=`
 * deep link, and the map of per-row results. A colon is safe as the separator —
 * `kind` is a closed union with no colon in it, and everything after the FIRST
 * colon is the id, so a uuid (which has none either) survives a round trip
 * whatever it contains.
 */
export function reviewItemKey(ref: ReviewItemRef): string {
  return `${ref.kind}:${ref.id}`;
}

/** The inverse. Null for anything that is not a kind this build knows followed
 *  by a non-empty id — a deep link from a future version must land on the
 *  centred chain, not on a pane fetching `undefined`. */
export function parseReviewItemKey(raw: string | null | undefined): ReviewItemRef | null {
  if (typeof raw !== 'string') return null;
  const at = raw.indexOf(':');
  if (at <= 0) return null;
  const kind = raw.slice(0, at);
  const id = raw.slice(at + 1).trim();
  if (!id) return null;
  if (kind !== 'document' && kind !== 'quote_request') return null;
  return { kind, id };
}

/* ── Selection ──────────────────────────────────────────────────────────── */

/** What a batch button is asking for. */
export type ReviewScope =
  | { scope: 'all' }
  | { scope: 'module'; module: ReviewModuleKey }
  | { scope: 'task'; task: ReviewTaskId };

/**
 * The items a batch button will actually send.
 *
 * NON-APPROVABLE TASKS ARE FILTERED OUT HERE, once, rather than at each of the
 * three call sites. That is deliberate: "Approve all" at the top of the page,
 * "Approve all in Doc-U" and a task's own button all run through this function,
 * so there is exactly one place where a quote request could accidentally be
 * swept into a batch — and it is a place with a test on it. Batching Dismiss
 * across a lead inbox is the specific accident being prevented; the other is
 * offering to approve a document Doc-U would refuse.
 *
 * Capped at `REVIEW_APPROVE_CAP` from the FRONT of the list, so the oldest thing
 * on screen is never the one silently dropped.
 */
export function selectApprovable(
  groups: readonly ReviewModuleGroup[],
  target: ReviewScope,
): ReviewItemRef[] {
  const picked: ReviewItemRef[] = [];

  for (const group of groups) {
    if (target.scope === 'module' && group.key !== target.module) continue;
    for (const task of group.tasks) {
      if (!task.task.approvable) continue;
      if (target.scope === 'task' && task.task.id !== target.task) continue;
      for (const item of task.items) picked.push({ kind: item.kind, id: item.id });
    }
  }

  return picked.slice(0, REVIEW_APPROVE_CAP);
}

/**
 * What the master button says.
 *
 * IT MUST NOT PROMISE THE WHOLE QUEUE WHEN IT WILL ONLY SEND PART OF IT. A
 * button reading "Approve all (14)" that leaves four quote requests sitting
 * there is a button the owner stops trusting the first time they count. So the
 * count is always the number that will be SENT, and the wording changes the
 * moment those two numbers part company — the plan's own phrasing for the
 * mixed-permission case (§3), applied to every reason a batch can be short.
 *
 * Zero is a real answer: the caller hides the button rather than drawing a
 * disabled one, so this returns the honest label anyway and never a lie.
 */
export function approveAllLabel(approvable: number, total: number): string {
  if (approvable <= 0) return 'Nothing here can be approved in bulk';
  return approvable < total ? `Approve all you can (${approvable})` : `Approve all (${approvable})`;
}

/** The confirm step's sentence. Says the number, says it is a real write, and
 *  says the one thing that makes it survivable — the modules still own these. */
export function approveConfirmMessage(count: number): string {
  return `Approve ${count} ${count === 1 ? 'item' : 'items'} — this can't be undone here; you can still edit them in their modules.`;
}

/* ── Results ────────────────────────────────────────────────────────────── */

/** What the approve route says about one item. `ok` with a `note` is the
 *  idempotent case: it was already approved, which is the caller's intent met. */
export interface ReviewApprovalResult {
  kind: ReviewKind;
  id: string;
  ok: boolean;
  error?: string;
  note?: string;
}

/**
 * Fold a batch's results back into the list on screen.
 *
 * THE SUCCEEDED ROWS GO, THE FAILED ROWS STAY, and the failures carry their own
 * message. This is the whole of the plan's §3 edge case — "an approval that
 * fails → the row stays with an inline error, others proceed" — and it is
 * arithmetic rather than a re-fetch because the re-fetch (`router.refresh()`)
 * lands a moment later and must agree with what the owner already saw. If this
 * dropped a failed row optimistically, the refresh would put it back, and a row
 * that vanishes and returns reads as a bug in the approval, not in the list.
 *
 * Returns the remaining items and the errors keyed by item, both derived — no
 * mutation, so a re-render with the same inputs is the same output.
 */
export function mergeApprovalResults(
  items: readonly ReviewItem[],
  results: readonly ReviewApprovalResult[],
): { items: ReviewItem[]; errors: Record<string, string> } {
  const done = new Set<string>();
  const errors: Record<string, string> = {};

  for (const r of results) {
    const key = reviewItemKey(r);
    if (r.ok) done.add(key);
    else errors[key] = r.error?.trim() || 'Could not approve this one.';
  }

  return { items: items.filter((i) => !done.has(reviewItemKey(i))), errors };
}

/* ── "Add as new customer" ──────────────────────────────────────────────── */

/**
 * Normalise a name for the duplicate check.
 *
 * The SAME rule `matchCustomer`/`orderflow-from-doc.ts` uses on the upload path,
 * restated here rather than imported because that module reaches OrderFlow's
 * whole type graph and this one must stay loadable by `node --test`. If the two
 * ever disagree, the upload path is right and this one is the bug: it is the
 * older rule and it is the one that has been creating customers in production.
 */
export function normaliseCustomerName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The fields of an enquiry that an `of_customers` row may be built from. */
export interface QuoteCustomerSource {
  contact_name: string | null;
  business_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface QuoteCustomerPayload {
  name: string;
  email: string | null;
  phone: string | null;
}

/**
 * Build the customer an enquiry would become, or null when it would not become
 * a usable one.
 *
 * WHICH FIELD BECOMES THE NAME. `business_name` first, then `contact_name`, then
 * `contact_email` — the opposite of `reviewQuoteWho`'s order, and deliberately.
 * That function answers "who wrote to us?", which is a person; this one answers
 * "who would we invoice?", which is a company. `of_customers.name` is the legal
 * name on the invoice (`trading_name` is the separate column for the other one),
 * so a row named after the buyer's receptionist is a row someone has to rename
 * before they can bill it.
 *
 * `from_email` IS NEVER USED. The schema is explicit that it is the website's
 * mailer and not the person who filled the form in, so a customer created from
 * it would be named `forms@` and emailed at a robot.
 *
 * THE ONLY HARD REQUIREMENT IS A NAME, because that is the only NOT NULL column
 * on `of_customers` besides `org_id` (supabase/orderflow-schema.sql). So the
 * plan's edge case — "quote sender with no email" — resolves to: created with
 * phone only, and with neither if that is all there is. The guard is on the
 * NORMALISED name being at least two characters, the same rule the upload path
 * uses, so punctuation-only junk ("()", "--") cannot create a customer.
 *
 * Every value here is attacker-controlled free text from a public form. It is
 * trimmed and stored; it is never matched on, executed, or used to route
 * anything.
 */
export function customerFromQuoteRequest(row: QuoteCustomerSource): QuoteCustomerPayload | null {
  const name =
    row.business_name?.trim() || row.contact_name?.trim() || row.contact_email?.trim() || '';
  if (normaliseCustomerName(name).length < 2) return null;

  return {
    name,
    email: row.contact_email?.trim() || null,
    phone: row.contact_phone?.trim() || null,
  };
}

/** Does this org already have this customer? Used to disable the button with
 *  "already a customer" rather than to block the write — the write's own unique
 *  violation is the real guard, and this is the courtesy in front of it. */
export function findExistingCustomer(
  payload: QuoteCustomerPayload,
  customers: readonly { id: string; name: string; email?: string | null }[],
): { id: string; name: string } | null {
  const email = payload.email?.toLowerCase() ?? null;
  if (email) {
    const byEmail = customers.find((c) => c.email?.trim().toLowerCase() === email);
    if (byEmail) return { id: byEmail.id, name: byEmail.name };
  }
  const key = normaliseCustomerName(payload.name);
  const byName = customers.find((c) => normaliseCustomerName(c.name) === key);
  return byName ? { id: byName.id, name: byName.name } : null;
}
