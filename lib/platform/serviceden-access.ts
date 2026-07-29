import 'server-only';

import { redirect } from 'next/navigation';
import { getPlatformSession, type PlatformSession } from './supabase-server';
import { SERVICEDEN_ACCOUNT_EMAIL } from './serviceden';

/**
 * The ServiceDen account gate, in one place.
 *
 * ServiceDen is Vyso's own private module: only one account may see it, and every
 * server entry point (layout + each server page) has to say so. That check used to
 * be copy-pasted per file, which is exactly the kind of duplication that drifts —
 * one copy trimming the email, another not; one requiring an org, another not.
 *
 * Note this is a UI gate only. The write paths keep their own, stronger check
 * (`requireServiceDenServerContext` in serviceden-server.ts, which additionally
 * verifies the sd_access_grants row) and RLS is the real boundary.
 */

/** Case/whitespace-insensitive match against the single permitted ServiceDen account. */
export function isServiceDenAccount(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === SERVICEDEN_ACCOUNT_EMAIL.trim().toLowerCase();
}

/**
 * Session for a ServiceDen server component. Unauthenticated → /login; any other
 * signed-in account → /app. `org` may still be null (the layout renders empty
 * chrome in that case rather than bouncing).
 */
export async function requireServiceDenSession(): Promise<PlatformSession> {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (!isServiceDenAccount(session.email)) redirect('/app');
  return session;
}

/** A ServiceDen session known to have an org, so org-scoped queries need no null check. */
export type ServiceDenOrgSession = PlatformSession & { org: NonNullable<PlatformSession['org']> };

/**
 * Same gate, for pages that immediately query org-scoped data: an account with no
 * org has nothing to show, so it is sent home rather than rendering an empty page.
 */
export async function requireServiceDenOrgSession(): Promise<ServiceDenOrgSession> {
  const session = await requireServiceDenSession();
  if (!session.org) redirect('/app');
  return session as ServiceDenOrgSession;
}
