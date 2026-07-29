import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { MODULES } from '@/lib/platform/modules';

/**
 * Redirect to the first module the org actually has enabled.
 *
 * `getPlatformSession` is the collapsed helper (auth → one nested profile/org/
 * features read) and is React-`cache()`d, so this page reuses the very same
 * execution the /app layout already awaited — it adds zero queries of its own.
 * Sign-in skips this hop entirely (see `POST_LOGIN_ROUTE` in app/login/page.tsx);
 * this route stays the canonical per-org resolver for direct hits on /app.
 */
export default async function AppIndex() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const first =
    MODULES.find((m) => m.status === 'active' && session.features[m.key]) ?? MODULES[0];
  redirect(first.screens.desktop);
}
