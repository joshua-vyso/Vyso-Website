import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getChat } from '@/lib/platform/finch-chats';
import type { ChatTurn } from '@/components/platform/shell/FinchChatProvider';
import { ChatDropZone } from '@/components/platform/chat/ChatDropZone';
import { ChatView } from '@/components/platform/chat/ChatView';

/**
 * One conversation (`.ai/plan_brief_chat_v2.md` §1.2, design 1b).
 *
 * SERVER-READ, CLIENT-CONTINUED. The transcript is rendered from
 * `finch_messages` on the server — so a chat opened from the rail, or a link
 * pasted between two of the owner's own devices, paints its whole history with
 * no spinner and no client fetch. `ChatView` then decides whether those rows or
 * the provider's live turns are the ones to draw; its docblock explains the
 * rule, which is the load-bearing part of this route.
 *
 * 404 FOR EVERYTHING THAT ISN'T THIS USER'S CHAT. `getChat` filters on org AND
 * user on top of RLS and returns null for "no such chat", "a colleague's chat"
 * and "the migration hasn't been applied" alike; all three become `notFound()`.
 * A distinct 403 would confirm to someone guessing ids that one of them is
 * real, and chats are private to their author — not shared across the org the
 * way findings are.
 *
 * The composer is the shell's (`GlobalChatDock`, composer-only on this route),
 * so this page is the transcript and nothing else. `pb-[168px]` leaves it room:
 * the dock is an overlay pinned to the bottom of <main>, not an element in this
 * column's flow, so without the reservation the last answer would sit under the
 * pill — the same allowance app/app/page.tsx makes for the finding cards.
 */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');

  const { id } = await params;
  const found = await getChat(session.org.id, session.userId, id);
  if (!found) notFound();

  // The stored shape carries more than a transcript needs (row ids,
  // timestamps); flatten it to the turns the client renders, so only what is on
  // screen crosses the RSC boundary. `attachments` DOES cross from W5 — the
  // cards are how a reopened chat still shows which documents a question was
  // about, and they are the row's own record, not client state.
  const initial: ChatTurn[] = found.messages.map((m) => ({
    role: m.role,
    content: m.content.text,
    ...(m.content.tools?.length ? { tools: m.content.tools } : {}),
    ...(m.content.attachments?.length ? { attachments: m.content.attachments } : {}),
  }));

  return (
    <div className="flex min-h-full">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-6 pb-[168px] pt-12 sm:px-10">
        <div className="mb-8 flex items-baseline gap-3">
          <Link
            href="/app"
            className="text-[13px] text-[var(--pf-text-secondary)] transition-colors hover:text-[#BE5D23]"
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            ‹ Back to today&apos;s brief
          </Link>
          {found.chat.title ? (
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--pf-text-faint)]">
              {found.chat.title}
            </span>
          ) : null}
        </div>

        {/* The whole conversation is the drop target (plan §1.3) — an owner
            dragging an invoice out of their email aims at the chat, not at a
            small rectangle inside it. */}
        <ChatDropZone className="flex flex-1 flex-col">
          <ChatView chatId={id} initial={initial} />
        </ChatDropZone>
      </div>
    </div>
  );
}
