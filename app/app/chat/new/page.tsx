import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { firstName, timeOfDayGreeting } from '@/components/platform/brief/brief-display';
import { NewChatView } from '@/components/platform/chat/NewChatView';

/**
 * A blank conversation (`.ai/plan_brief_chat_v2.md` §1.2, W2).
 *
 * NOTHING IS CREATED HERE. There is no `finch_chats` row until the owner
 * actually sends something — `FinchChatProvider.send()` POSTs `/api/finch/chats`
 * on the first message and then moves to `/app/chat/<id>`. Creating a row on
 * arrival would fill the rail with empty "New chat" entries every time someone
 * clicked the button and thought better of it.
 *
 * The greeting is computed HERE, on the server, in SAST — the same
 * `timeOfDayGreeting`/`firstName` the Brief uses, so "Morning, Josh" says the
 * same thing on both screens and can't drift across a midnight boundary
 * between them.
 *
 * The composer is the shell's: `GlobalChatDock` renders on every /app/* route
 * and draws composer-only here (see its docblock). This page is the room, not
 * the microphone.
 */
export default async function NewChatPage() {
  const session = await getPlatformSession();
  // The layout guards both already; repeating them narrows the types and keeps
  // the page correct if it is ever rendered outside that layout.
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');

  const name = firstName(session.profile?.full_name);
  const greeting = `${timeOfDayGreeting(new Date())}${name ? `, ${name}` : ''}.`;

  return (
    <div className="flex min-h-full">
      <NewChatView greeting={greeting} />
    </div>
  );
}
