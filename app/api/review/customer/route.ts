import { NextResponse } from 'next/server';
import {
  addCustomerFromQuoteRequest,
  dismissQuoteRequest,
  resolveReviewActor,
} from '@/lib/platform/review-actions';

/**
 * The two decisions a website enquiry offers from the Review chat
 * (`.ai/plan_review_v2.md` §1.4).
 *
 * Body:
 *   { requestId }                       → add the sender as an OrderFlow customer
 *   { requestId, action: 'dismiss' }    → the Quotes screen's Dismiss
 *
 * BOTH LIVE ON ONE ROUTE because they are one screen's two buttons over one row,
 * and both are `of_quote_requests` writes behind the same OrderFlow gate. The
 * plan named this route for the customer half; the dismiss rides with it rather
 * than becoming a third file whose only difference is one word in a patch.
 *
 * NEITHER IS AN APPROVAL, and that is why neither is on `/api/review/approve`.
 * Adding a customer creates a record; dismissing an enquiry closes a lead. The
 * batch endpoint is for writes the modules call approvals, and OrderFlow calls
 * neither of these one.
 *
 * Every value that reaches the database here was typed by an anonymous stranger
 * into a public contact form. It is trimmed and stored as text; it is never
 * matched on, interpolated, or used to route anything
 * (`customerFromQuoteRequest` is where that is enforced).
 */
export async function POST(req: Request) {
  const resolved = await resolveReviewActor();
  if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, actor } = resolved;

  const body = (await req.json().catch(() => ({}))) as { requestId?: unknown; action?: unknown };
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
  if (!requestId) return NextResponse.json({ error: 'A requestId is required.' }, { status: 400 });

  if (body.action === 'dismiss') {
    const dismissed = await dismissQuoteRequest(supabase, actor, requestId);
    if (!dismissed.ok) {
      return NextResponse.json({ error: dismissed.error }, { status: dismissed.status });
    }
    return NextResponse.json({ ok: true });
  }

  const added = await addCustomerFromQuoteRequest(supabase, actor, requestId);
  if (!added.ok) return NextResponse.json({ error: added.error }, { status: added.status });
  return NextResponse.json({ ok: true, customer: added.result });
}
