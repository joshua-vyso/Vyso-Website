import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getOrCreateReviewChat } from '@/lib/platform/finch-chats';
import { loadReviewQueue } from '@/lib/platform/review-queue';
import type { ChatTurn } from '@/components/platform/shell/FinchChatProvider';
import { ChatDropZone } from '@/components/platform/chat/ChatDropZone';
import { ChatView } from '@/components/platform/chat/ChatView';
import { ReviewChain } from '@/components/platform/review/ReviewChain';

/**
 * Review — the chat that opens itself when something needs a decision
 * (`.ai/plan_review_chat.md`; v2 in `.ai/plan_review_v2.md`).
 *
 * A SYSTEM CONVERSATION, not a normal one. Two halves, with different lifetimes
 * and different rules:
 *
 *   1. THE CHAIN is regenerated from the live queue on EVERY visit, from a
 *      deterministic template, with zero model calls. It is not stored and it is
 *      not a message — see ReviewChain.tsx.
 *   2. THE CHAT BELOW IT is a real `finch_chats` row (`module='review'`), so
 *      "is the Umgeni invoice actually for what I ordered?" survives a reload
 *      and a walk to another screen, exactly like every other conversation in
 *      the platform.
 *
 * A STATIC SEGMENT BESIDE `[id]`, deliberately. `/app/chat/review` resolves
 * here rather than to the dynamic route because Next matches static segments
 * first (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * dynamic-routes.md); the review chat's own uuid still opens at
 * `/app/chat/<uuid>` and draws the ordinary transcript, without this chain.
 *
 * THE EMPTY STATE IS A REAL SCREEN, not a redirect. The rail's row is gone by
 * the time the queue empties, so the only ways to arrive here with nothing
 * waiting are a bookmark, a second tab, or approving the last item and pressing
 * Back — and in every one of those the owner deserves to be told "all clear"
 * rather than bounced somewhere they did not ask for.
 *
 * WHAT V2 CHANGED, AND WHAT IT DID NOT. The chain can now APPROVE, in batches,
 * and every one of those approvals is a call into the module's own function —
 * `commitDocument` for a document, OrderFlow's own patch for an enquiry (see
 * `lib/platform/review-actions.ts`). There is still no approval semantics of
 * this screen's own, and FINCH STILL CANNOT APPROVE ANYTHING: the buttons are
 * the owner's, the conversation underneath is for asking about them, and
 * `lib/ai/finch/knowledge.ts` says so to the model.
 *
 * THE PAGE READS THE QUEUE AGAIN, after the layout already did for the rail's
 * count. A layout does not re-render on a client-side navigation (Next 16
 * layouts persist), so its copy can be minutes old by the time someone walks
 * back here from Doc-U, and a chain listing a document they have just approved
 * is the one thing this screen must never do. Two small indexed queries is the
 * honest price of a list that is right.
 */
export default async function ReviewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getPlatformSession();
  // The layout guards both already; repeating them narrows the types and keeps
  // the page correct if it is ever rendered outside that layout.
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');

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
  // yet — the chain below still renders, and the shell's composer still works
  // (it starts an ordinary chat), which is the degrade W1 promised.
  const found = await getOrCreateReviewChat(session.org.id, session.userId);

  const initial: ChatTurn[] = (found?.messages ?? []).map((m) => ({
    role: m.role,
    content: m.content.text,
    ...(m.content.tools?.length ? { tools: m.content.tools } : {}),
    ...(m.content.attachments?.length ? { attachments: m.content.attachments } : {}),
  }));

  // `?item=` read on the SERVER and handed down, rather than with
  // `useSearchParams` in the chain. This page is already dynamic (it reads the
  // cookie session), so there is no prerender to bail out of — but the chain
  // toggles the parameter locally with `history.replaceState` afterwards, and a
  // hook that re-subscribed to every one of those toggles would re-render the
  // list on each expand for a value only the first render uses.
  const itemParam = (await searchParams).item;
  const initialItemKey = typeof itemParam === 'string' ? itemParam : null;

  return (
    // No `mx-auto max-w-[720px]` here any more: the chain centres ITSELF inside
    // `.review-split`, and it is that centring — re-balanced as the pane's track
    // grows — which carries it left when an item is expanded. A fixed centred
    // wrapper would pin it in the middle and leave the pane nowhere to go.
    <div className="flex min-h-full">
      <div className="flex w-full flex-1 flex-col px-6 pb-[168px] pt-12 sm:px-10">
        {/* Same drop target as every other chat screen: an invoice dragged in
            here is filed by Doc-U and, if it needs a decision, is in this chain
            the moment the turn lands and the page refreshes (W5 synergy). */}
        <ChatDropZone className="flex flex-1 flex-col">
          <ReviewChain
            items={queue.items}
            total={queue.total}
            truncated={queue.truncated}
            initialItemKey={initialItemKey}
          >
            {found ? (
              <div className="mt-8">
                <ChatView chatId={found.chat.id} initial={initial} />
              </div>
            ) : null}
          </ReviewChain>
        </ChatDropZone>
      </div>
    </div>
  );
}
