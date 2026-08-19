import { NextResponse } from 'next/server';
import { loadReviewItemDetail, resolveReviewActor } from '@/lib/platform/review-actions';
import { type ReviewItemRef } from '@/lib/platform/review-actions-shared';

/**
 * One item's detail, for the pane that just opened
 * (`.ai/plan_review_v2.md` §2 — "loaded lazily … or inline if cheap; decide,
 * record"). It is not cheap: see `loadReviewItemDetail` for the arithmetic that
 * settled it.
 *
 * `GET /api/review/item?kind=document&id=<uuid>`
 *
 * NOT CACHED, and it must not be. The payload contains a SIGNED STORAGE URL with
 * a ten-minute life and the current approve/reject verdict for the row; a cached
 * copy would hand a later visitor a dead preview and, worse, a stale opinion
 * about whether a document still needs approving. Route Handlers are uncached by
 * default (node_modules/next/dist/docs/01-app/01-getting-started/
 * 15-route-handlers.md) and this one reads `request.url` and the cookie session,
 * both of which keep it at request time under Cache Components too.
 *
 * A MISSING ITEM IS A 404 WITH A SENTENCE, not an empty body: the pane turns it
 * into "already handled" and closes itself, which is the plan's §3 behaviour for
 * a deep link to something that has since left the queue.
 */
export async function GET(req: Request) {
  const resolved = await resolveReviewActor();
  if (!resolved) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { supabase, actor } = resolved;

  const params = new URL(req.url).searchParams;
  const kind = params.get('kind');
  const id = (params.get('id') ?? '').trim();

  if (!id || (kind !== 'document' && kind !== 'quote_request')) {
    return NextResponse.json({ error: 'A kind and an id are required.' }, { status: 400 });
  }

  const ref: ReviewItemRef = { kind, id };
  const detail = await loadReviewItemDetail(supabase, actor, ref);
  if (!detail.ok) return NextResponse.json({ error: detail.error }, { status: detail.status });

  return NextResponse.json({ ok: true, detail: detail.detail });
}
