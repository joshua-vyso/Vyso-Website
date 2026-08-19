import { NextResponse } from 'next/server';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { canSeeMoney } from '@/lib/platform/access';
import { rateLimitAllowed } from '@/lib/platform/rate-limit';
import { forwardDocumentToHubdoc, type HubdocForwardResult } from '@/lib/platform/hubdoc';

export const runtime = 'nodejs';
// A "Send all" over a dozen bills is a dozen Storage downloads and a dozen
// messages, run one at a time. Well inside this, and nowhere near the default.
export const maxDuration = 120;

/**
 * "Send to Hubdoc" — the button, and only the button (plan
 * `.ai/plan_plugins_xero.md`, X2 "Surfaces").
 *
 * THIS IS THE PRODUCT'S ONLY USER-TRIGGERED OUTBOUND SEND OF A CUSTOMER'S
 * DOCUMENT, so read the gates rather than skim them:
 *   - Signed in, with an org.
 *   - `canSeeMoney` — owner or admin. Posting a supplier invoice into the
 *     company's bookkeeping is finance, not chrome, and a member never sees the
 *     button that would post here.
 *   - The org id is the SESSION's. The body carries document ids and nothing
 *     else; `forwardDocumentToHubdoc` filters `documents` on the org id this
 *     route hands it, so a document id belonging to another tenant simply is not
 *     found.
 *   - Rate limited. A stuck browser tab or a hand on a "Send all" button must
 *     not be able to spend a tenant's Resend budget or fill a bookkeeper's inbox.
 *
 * ONE ROUTE FOR ONE DOCUMENT AND FOR MANY. The plan asks for a per-document
 * button, a per-row button in the "not in Xero yet" list, and "Send all N". They
 * are the same act repeated, so they are one endpoint taking `documentIds` — a
 * separate bulk route would be a second place the gates above have to be right.
 *
 * SERIAL, NOT PARALLEL. Each send downloads a file and posts a message; running
 * them at once would race the "already sent" check that keeps a bill from being
 * filed twice, and would arrive at Resend as a burst. A dozen bills is a couple
 * of seconds.
 *
 * PARTIAL SUCCESS IS REPORTED AS PARTIAL SUCCESS. A batch where three sent and
 * one failed answers 200 with all four results — reporting the whole thing as a
 * failure would invite the owner to press it again and re-send the three that
 * worked (they would be caught by the already-sent check, but a UI that teaches
 * people to retry a completed action is a UI that will eventually double-post
 * something).
 */

/** Sixty documents an hour per org. A month of ordinary supplier paper in one
 *  sitting is fine; a loop is not. */
const SEND_LIMIT = 60;
const SEND_WINDOW_SECONDS = 3_600;

/** The ceiling on one request. "Send all N" over a list this long is a bulk
 *  import, not a click, and should be several presses so the owner sees what is
 *  happening between them. */
const MAX_PER_REQUEST = 25;

export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session?.org) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canSeeMoney(session.profile?.role)) {
    return NextResponse.json(
      { error: 'Only an owner or admin can send documents to Hubdoc.' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    documentId?: string;
    documentIds?: string[];
    resend?: boolean;
  };

  // One id or many, de-duplicated: a list that named the same document twice
  // would otherwise send it, then find it already sent, and report both.
  const ids = [
    ...new Set(
      (body.documentIds ?? (body.documentId ? [body.documentId] : []))
        .filter((id): id is string => typeof id === 'string' && id.trim() !== '')
        .map((id) => id.trim()),
    ),
  ];
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No document was named.' }, { status: 400 });
  }
  if (ids.length > MAX_PER_REQUEST) {
    return NextResponse.json(
      { error: `Send up to ${MAX_PER_REQUEST} documents at a time.` },
      { status: 400 },
    );
  }

  const orgId = session.org.id;
  const allowed = await rateLimitAllowed(`hubdoc-send:${orgId}`, SEND_LIMIT, SEND_WINDOW_SECONDS);
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Vyso has sent ${SEND_LIMIT} documents to Hubdoc in the last hour. Try again shortly.`,
      },
      { status: 429 },
    );
  }

  const results: (HubdocForwardResult & { documentId: string })[] = [];
  for (const documentId of ids) {
    try {
      const result = await forwardDocumentToHubdoc({
        orgId,
        documentId,
        triggeredBy: 'user',
        userId: session.userId,
        // Only ever honoured for a user click, and only when the caller asked —
        // this is the "Send again" override, not a default.
        resend: body.resend === true,
      });
      results.push({ ...result, documentId });
    } catch (error) {
      // `forwardDocumentToHubdoc` turns ordinary problems into `{ok:false}`, so
      // reaching here means something genuinely unexpected broke. One document's
      // surprise must not cancel the rest of the batch.
      const message = error instanceof Error ? error.message : 'The send failed.';
      console.error('hubdoc: send failed', documentId, message);
      results.push({ ok: false, error: message, documentId });
    }
  }

  const sent = results.filter((r) => r.ok && !r.alreadySent).length;
  const skipped = results.filter((r) => r.alreadySent).length;
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: failed.length === 0,
    sent,
    skipped,
    // The first failure's sentence is what the button shows. The full list is
    // there for a caller that wants to mark individual rows.
    error: failed[0]?.error ?? null,
    results,
  });
}
