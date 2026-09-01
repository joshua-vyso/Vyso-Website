import { redirect } from 'next/navigation';

/**
 * The old home of the Review queue (`.ai/plan_phase0_teardown_shell.md` Task C).
 *
 * Review is no longer a conversation, so it is no longer under `/app/chat`:
 * the chain lives at `/app/review` and this segment exists only to carry the
 * bookmarks, the pasted links and the two docs pages that still name the old
 * path. A redirect rather than a deletion for exactly that reason — the queue
 * is the screen an owner is most likely to have pinned in a tab.
 *
 * `redirect()` in a Server Component throws NEXT_REDIRECT and serves a 307,
 * replacing the entry in history rather than pushing one
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md),
 * so Back from `/app/review` goes where the owner actually came from instead of
 * bouncing through here again.
 *
 * NOT `permanentRedirect`: this is a product move mid-restructure, and a 308
 * cached in every browser that ever hit it is not a thing to hand out while the
 * IA is still settling.
 *
 * The `?item=` deep link is dropped by this hop. It is the pane's own
 * `history.replaceState` parameter, meaningful only within one visit to the
 * chain, so carrying it across a redirect from a route nothing links to any
 * more would be plumbing for a case that does not exist.
 */
export default function ReviewChatRedirect() {
  redirect('/app/review');
}
