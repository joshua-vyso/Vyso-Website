import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getOrCreateReviewChat } from '@/lib/platform/finch-chats';
import { loadReviewQueue } from '@/lib/platform/review-queue';
import type { ChatTurn } from '@/components/platform/shell/FinchChatProvider';
import { ChatDropZone } from '@/components/platform/chat/ChatDropZone';
import { ChatView } from '@/components/platform/chat/ChatView';
import { ReviewOpening } from '@/components/platform/chat/ReviewOpening';

/**
 * Review — the chat that opens itself when something needs a decision
 * (`.ai/plan_review_chat.md`).
 *
 * A SYSTEM CONVERSATION, not a normal one. Two halves, with different lifetimes
 * and different rules:
 *
 *   1. THE OPENING CARD is regenerated from the live queue on EVERY visit,
 *      from a deterministic template, with zero model calls. It is not stored
 *      and it is not a message — see ReviewOpening.tsx.
 *   2. THE CHAT BELOW IT is a real `finch_chats` row (`module='review'`), so
 *      "is the Umgeni invoice actually for what I ordered?" survives a reload
 *      and a walk to another screen, exactly like every other conversation in
 *      the platform.
 *
 * A STATIC SEGMENT BESIDE `[id]`, deliberately. `/app/chat/review` resolves
 * here rather than to the dynamic route because Next matches static segments
 * first (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * dynamic-routes.md); the review chat's own uuid still opens at
 * `/app/chat/<uuid>` and draws the ordinary transcript, without this card.
 *
 * THE EMPTY STATE IS A REAL SCREEN, not a redirect. The rail's row is gone by
 * the time the queue empties, so the only ways to arrive here with nothing
 * waiting are a bookmark, a second tab, or approving the last item and pressing
 * Back — and in every one of those the owner deserves to be told "all clear"
 * rather than bounced somewhere they did not ask for.
 *
 * NO WRITE PATH HERE AND NONE IN FINCH. Approving happens on `/app/docu/[id]`
 * and quoting on `/app/orderflow/quotes/new` — screens with the real gates on
 * them. This page links; it never acts. The knowledge doc says the same thing
 * to the model (lib/ai/finch/knowledge.ts, "Review").
 */
export default async function ReviewChatPage() {
  const session = await getPlatformSession();
  // The layout guards both already; repeating them narrows the types and keeps
  // the page correct if it is ever rendered outside that layout.
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');

  // The layout read this too, for the rail's count — and this page reads it
  // AGAIN on purpose. A layout does not re-render on a client-side navigation
  // (Next 16 layouts persist), so its copy can be minutes old by the time
  // someone walks back here from Doc-U, and a card listing a document they have
  // just approved is the one thing this screen must never do. Two small indexed
  // queries is the honest price of a card that is right.
  const queue = await loadReviewQueue(session.org.id, {
    features: session.features,
    lockedModules: session.lockedModules,
  });

  if (queue.total === 0) {
    return (
      <div className="flex min-h-full">
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-6 pb-[168px] pt-12 sm:px-10">
          <div className="rounded-2xl border border-[var(--pf-border)] bg-white px-8 py-10 text-center shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <h1 className="of-display text-[18px] font-semibold text-[var(--pf-text)]">
              Nothing to review — all clear
            </h1>
            <p className="mt-2 text-[14px] text-[var(--pf-text-secondary)]">
              Review comes back on its own the next time a document or an enquiry needs a decision.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-block text-[13px] font-medium text-[#1F5FA8] transition-colors hover:underline"
              style={{ transitionDuration: 'var(--dur-hover)' }}
            >
              Back to today&apos;s brief →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Only once there IS something to review: a visit to an empty queue must not
  // leave a chat row behind it. Null when `finch_chats` isn't in this database
  // yet — the card below still renders, and the shell's composer still works
  // (it starts an ordinary chat), which is the degrade W1 promised.
  const found = await getOrCreateReviewChat(session.org.id, session.userId);

  const initial: ChatTurn[] = (found?.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content.text,
    ...(m.content.tools?.length ? { tools: m.content.tools } : {}),
    ...(m.content.attachments?.length ? { attachments: m.content.attachments } : {}),
  }));

  return (
    <div className="flex min-h-full">
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-6 pb-[168px] pt-12 sm:px-10">
        {/* Same drop target as every other chat screen: an invoice dragged in
            here is filed by Doc-U and, if it needs a decision, is in this card
            the moment the turn lands and the page refreshes (W5 synergy). */}
        <ChatDropZone className="flex flex-1 flex-col">
          <ReviewOpening queue={queue} />
          {found ? <ChatView chatId={found.chat.id} initial={initial} /> : null}
        </ChatDropZone>
      </div>
    </div>
  );
}
