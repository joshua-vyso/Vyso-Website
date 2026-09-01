import { redirect } from 'next/navigation';

/**
 * One stored conversation, disconnected (`.ai/plan_phase0_teardown_shell.md`
 * Task D).
 *
 * THE CHATS THEMSELVES ARE UNTOUCHED. `finch_chats`/`finch_messages` keep every
 * row, `getChat` still reads them, `ChatView` still renders them — Phase 0
 * disconnects the UI and deletes no chat code and no chat data. This wrapper is
 * the one part that had to move: a transcript with no composer under it and no
 * rail row pointing at it is a dead end, so the route now returns the reader to
 * the brief.
 *
 * NO READ, NO 404, NO GUARD. The old page fetched the chat and `notFound()`-ed
 * anything that was not this user's, which mattered when the answer was a
 * transcript: a distinct 403 would have confirmed to someone guessing ids that
 * one of them was real. Every id — real, stolen or invented — now gets the same
 * redirect, which leaks strictly less than the page it replaces and costs one
 * fewer query. `params` is not awaited because nothing here needs the id.
 *
 * `redirect()` throws NEXT_REDIRECT and serves a 307, replacing rather than
 * pushing the history entry
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md).
 */
export default function ChatRedirect() {
  redirect('/app');
}
