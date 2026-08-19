import { NextResponse } from 'next/server';
import { after } from 'next/server';
import {
  approveReviewItems,
  rejectReviewDocument,
  resolveReviewActor,
  runReviewFollowUps,
} from '@/lib/platform/review-actions';
import { REVIEW_APPROVE_CAP, type ReviewItemRef } from '@/lib/platform/review-actions-shared';

/**
 * Approve (or reject) items from the Review chat
 * (`.ai/plan_review_v2.md` §1.5).
 *
 * ── v2.1: THE RESPONSE DOES NOT WAIT FOR THE SIDE EFFECTS ──────────────────
 * Josh, on a client's machine (2026-08-19): approving took over five seconds and
 * he wants the click to come back at once — "background approve, but don't
 * commit to agents watching for them or updating modules".
 *
 * So the request now does the AUTHORITATIVE work only — claim the row, mark it
 * approved, two indexed UPDATEs per document — and hands the slow remainder (the
 * OrderFlow order, the invoice, ProcurePulse stock, the SupplySync rollups) to
 * Next's `after()`, which runs it once the response has been flushed
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md).
 * Twenty status writes is a handful of round-trips, so a full batch answers in
 * well under two seconds.
 *
 * WHAT THAT COSTS, SAID PLAINLY. The follow-up may land seconds after the row
 * has left the queue, and if it fails it is logged and NOT retried — no watcher,
 * no queue table, nothing observes it, which is what Josh asked for. The
 * document stays approved; `runDocumentSideEffects` is idempotent, so a manual
 * re-save in Doc-U heals it. `/api/docu/review` is untouched and still waits for
 * everything, because that screen's Save is a person watching one document.
 *
 * `maxDuration` is unchanged at 120s: `after()` runs inside the same invocation
 * budget, so the detached work still has the ceiling it had before, and
 * `REVIEW_APPROVE_CAP` is still the ceiling on the work inside it.
 *
 * A PARTIAL SUCCESS IS A 200. The response is a list of per-item results, and
 * "three approved, one was already being saved by someone else" is a normal
 * outcome of this button, not an error condition. Returning 500 because one row
 * of twenty failed would throw away the nineteen the caller needs to know about.
 * The only non-200s are the ones about the REQUEST: not signed in, no org, a
 * body that is not a list of items.
 *
 * Body:
 *   { items: [{ kind, id }, …] }                → approve, serially
 *   { action: 'reject', item: { kind, id } }    → Doc-U's Discard, one document
 *
 * Every gate — module access, and owner/admin for anything that moves money —
 * is applied PER ITEM inside `approveReviewItems`, against the cookie session's
 * own role. Nothing in the body influences who the caller is.
 */
export const maxDuration = 120;

/** Narrow one entry of the body into a ref, or null. Deliberately strict: a kind
 *  this build does not know is dropped rather than passed on to a switch that
 *  would have to guess. */
function parseRef(raw: unknown): ReviewItemRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const { kind, id } = raw as { kind?: unknown; id?: unknown };
  if (typeof id !== 'string' || !id.trim()) return null;
  if (kind !== 'document' && kind !== 'quote_request') return null;
  return { kind, id: id.trim() };
}

export async function POST(req: Request) {
  const resolved = await resolveReviewActor();
  if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, actor } = resolved;

  const body = (await req.json().catch(() => ({}))) as {
    items?: unknown;
    action?: unknown;
    item?: unknown;
  };

  // ── Reject: one document, Doc-U's own Discard ────────────────────────────
  if (body.action === 'reject') {
    const ref = parseRef(body.item);
    if (!ref) return NextResponse.json({ error: 'An item is required.' }, { status: 400 });
    if (ref.kind !== 'document') {
      return NextResponse.json(
        { error: 'Only a document can be rejected. An enquiry is dismissed instead.' },
        { status: 400 },
      );
    }
    const result = await rejectReviewDocument(supabase, actor, ref.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, results: [{ ...ref, ok: true }] });
  }

  // ── Approve: one or many ─────────────────────────────────────────────────
  const raw = Array.isArray(body.items) ? body.items : [];
  const items = raw.map(parseRef).filter((r): r is ReviewItemRef => r !== null);
  if (items.length === 0) {
    return NextResponse.json({ error: 'No items to approve.' }, { status: 400 });
  }
  if (raw.length > REVIEW_APPROVE_CAP) {
    return NextResponse.json(
      { error: `That is more than ${REVIEW_APPROVE_CAP} items — approve them in smaller batches.` },
      { status: 400 },
    );
  }

  const { results, followUps } = await approveReviewItems(supabase, actor, items);

  // The client already holds its RLS-scoped tokens, so nothing here re-reads the
  // cookie jar after the response has gone.
  if (followUps.length > 0) {
    after(() => runReviewFollowUps(supabase, followUps));
  }

  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
