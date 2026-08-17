import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { getChat } from '@/lib/platform/finch-chats';

export const runtime = 'nodejs';

/**
 * One conversation and its transcript — `{ chat, messages }`.
 *
 * The provider uses this to re-open a chat without a full navigation (and,
 * from W2, to restore the active conversation after a reload). Route handler
 * rather than a server read because the caller is a client component that has
 * only an id.
 *
 * 404 covers "no such chat", "someone else's chat" and "the migration hasn't
 * been applied" alike — `getChat` filters on `org_id` AND `user_id` on top of
 * RLS and returns null for all three. That is deliberate: a distinct 403 would
 * confirm to a stranger that an id they guessed is real.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null }>();
  if (!profile?.org_id) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });

  const found = await getChat(profile.org_id, auth.userId, id, auth.supabase);
  if (!found) return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });

  return NextResponse.json(found);
}
