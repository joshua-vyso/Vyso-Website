import { redirect } from 'next/navigation';

/**
 * The blank conversation, disconnected (`.ai/plan_phase0_teardown_shell.md`
 * Task D).
 *
 * THE CHAT CODE IS PRESERVED; ITS SURFACES ARE NOT. `NewChatView`,
 * `ChatDropZone`, the composer, the provider and every `/api/finch|ai/agent`
 * route are untouched and still compile — what changed is that nothing in the
 * platform navigates to them. This wrapper was three lines of session guard
 * and a view; it is now the redirect that catches the bookmarks and the stale
 * links the rail used to hand out.
 *
 * `/app` RATHER THAN A 404. Someone who lands here was reaching for "ask Vyso
 * something", and the honest answer to that during Phase 0 is today's brief —
 * not an error page for a screen that still exists in the repo.
 *
 * `redirect()` throws NEXT_REDIRECT and serves a 307, replacing rather than
 * pushing the history entry
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md).
 * No session guard first: /app runs the same `getPlatformSession()` check one
 * hop later, so an unauthenticated visitor still ends at /login, and this file
 * has no reason to open a Supabase client to send someone one route sideways.
 */
export default function NewChatRedirect() {
  redirect('/app');
}
