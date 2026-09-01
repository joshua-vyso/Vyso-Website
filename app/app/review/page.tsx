import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { loadReviewQueue } from '@/lib/platform/review-queue';
import { ReviewChain } from '@/components/platform/review/ReviewChain';

/**
 * Review — the decisions waiting on a human (`.ai/plan_review_chat.md`; v2 in
 * `.ai/plan_review_v2.md`; rehomed here by `.ai/plan_phase0_teardown_shell.md`
 * Task C).
 *
 * WHAT MOVED, AND WHAT DID NOT. This page is `app/app/chat/review/page.tsx`
 * with the chat frame taken off. The CHAIN is unchanged, component for
 * component: it is still regenerated from the live queue on every visit, from a
 * deterministic template, with zero model calls, and every Approve on it is
 * still a call into the module's own function (`lib/platform/review-actions.ts`).
 * Finch still cannot approve anything.
 *
 * WHAT CAME OFF. The `finch_chats` row (`getOrCreateReviewChat`), the
 * transcript under the chain (`ChatView`) and the drop zone around it. Phase 0
 * disconnects every chat SURFACE while keeping the code — so a page whose
 * lower half was a conversation would be the one place a composer survived,
 * with no dock to send from. `ReviewChain` still takes `children` (it is the
 * slot that used to hold the transcript) and is handed `null` here rather than
 * being changed: the plan is explicit that the chain is not to be refactored,
 * and a slot with nothing in it renders nothing.
 *
 * THE QUEUE IS STILL READ HERE, after the layout already read it for the rail's
 * count. A layout does not re-render on a client-side navigation (Next 16
 * layouts persist — node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/layout.md), so its copy can be minutes old by the time
 * someone walks back from Doc-U, and a chain listing a document they have just
 * approved is the one thing this screen must never do.
 *
 * THE EMPTY STATE IS A REAL SCREEN, not a redirect. The rail's row is gone by
 * the time the queue empties, so the only ways to arrive here with nothing
 * waiting are a bookmark, a second tab, or approving the last item and pressing
 * Back — and in every one of those the owner deserves to be told "all clear"
 * rather than bounced somewhere they did not ask for.
 *
 * `/app/chat/review` now redirects here (that file), and `REVIEW_CHAT_ROUTE`
 * (lib/platform/review-queue-shared.ts) points at this path, so the rail row,
 * the active-state check and the provider's prelude switch all followed the
 * move from one constant.
 */
export default async function ReviewPage({
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
        <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-6 pb-16 pt-12 sm:px-10">
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
    //
    // `pb-16` rather than the old `pb-[168px]`: that reservation existed to keep
    // the last row clear of the chat dock, and the dock is gone.
    <div className="flex min-h-full">
      <div className="flex w-full flex-1 flex-col px-6 pb-16 pt-12 sm:px-10">
        <ReviewChain
          items={queue.items}
          total={queue.total}
          truncated={queue.truncated}
          initialItemKey={initialItemKey}
        >
          {/* The transcript slot, deliberately empty — see the docblock. */}
          {null}
        </ReviewChain>
      </div>
    </div>
  );
}
