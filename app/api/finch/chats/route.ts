import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { isAgentModule } from '@/lib/ai/finch/config';
import { createChat } from '@/lib/platform/finch-chats';

export const runtime = 'nodejs';

/**
 * Start a Finch conversation — `{ module, findingId? }` → `{ id }`.
 *
 * Called by FinchChatProvider on the first message of a chat, BEFORE it opens
 * the SSE stream, because `/api/ai/agent` needs the id to persist the exchange
 * against. One extra round-trip on the first turn of a conversation only.
 *
 * `resolveUser` rather than `getPlatformSession` so the mobile app's
 * `Authorization: Bearer` token works here exactly as it does on the agent
 * route it pairs with — this endpoint is part of that route's contract, not a
 * page's data fetch. The org comes from the caller's own profile row: a body
 * that named an org would be a body that could name someone else's.
 *
 * 503, not 500, when the migration hasn't been applied: the chat cannot be
 * stored, but nothing is broken and the client's answer is to stream without a
 * chatId (plan §5), which is the platform's behaviour up to this wave.
 */
export async function POST(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null }>();
  if (!profile?.org_id) {
    return NextResponse.json({ error: 'No organisation on this account.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { module?: unknown; findingId?: unknown };
  // An unknown module is stored as null rather than rejected: `module` labels a
  // chat and picks the first turn's tools, and a chat with no label is far
  // better than a chat the owner could not start.
  const chatModule = isAgentModule(body.module) ? body.module : null;
  const findingId = typeof body.findingId === 'string' && body.findingId ? body.findingId : null;

  const id = await createChat(profile.org_id, auth.userId, { module: chatModule, findingId }, auth.supabase);
  if (!id) {
    return NextResponse.json({ error: "Chat history isn't set up yet." }, { status: 503 });
  }
  return NextResponse.json({ id });
}
