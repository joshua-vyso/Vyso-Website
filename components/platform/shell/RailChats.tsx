'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AI_GRADIENT_CHROME } from '@/components/platform/brief/brief-display';
import { REVIEW_CHAT_ROUTE } from '@/lib/platform/review-queue-shared';
import { RailReview } from './RailReview';

/**
 * The conversations, in the rail — directly under "Today's brief" (design 1b,
 * where the active chat sits as the second nav row).
 *
 * ONE ROW PER CHAT, TWO FACTS ON IT: what it was about, and how long ago. The
 * design shows only a title; the time is here because a persistent list needs
 * to answer "is that this morning's or last Tuesday's" without being opened,
 * and 216px has room for four characters at the end of a row.
 *
 * TIME IS A STRING, NOT A TIMESTAMP. `chatTimeLabel` runs on the SERVER (in
 * app/app/layout.tsx) and this component is handed finished text. A client
 * component recomputing "4m" during hydration can disagree with the HTML it is
 * hydrating, and a rail row that flickers on every load reads as a bug — the
 * same reason `foundLabel` is server-computed for the finding cards.
 *
 * ACTIVE STATE FROM `usePathname()`, not from a prop: this lives inside
 * AppRail, in the platform LAYOUT, which does not re-render on client-side
 * navigation (Next 16 layouts persist). A server-computed "which one is open"
 * would be right once and then wrong for the rest of the session. No
 * `useSearchParams` here, so — unlike RailNav — this needs no Suspense
 * boundary of its own.
 *
 * Reused verbatim inside MobileDrawer, exactly as RailNav is.
 *
 * THE REVIEW ROW IS PINNED ABOVE "New chat" (`.ai/plan_review_chat.md`). It
 * belongs to this block rather than to RailNav because the plan puts it
 * directly under "Today's brief" — which is RailNav's last row before this
 * component — and because putting it here gives desktop and mobile the same
 * row from one mount point, exactly as the chat list already is. It draws
 * nothing when `reviewCount` is 0, so the rail is unchanged on a clear morning.
 * The review conversation itself is filtered out of `chats` upstream
 * (`splitChats`), so it can never appear twice.
 */

export interface RailChat {
  id: string;
  /** Already resolved — `chatTitle()` has applied the "New chat" fallback. */
  title: string;
  module: string | null;
  /** "4m" · "3h" · "09 Aug". '' when the timestamp wouldn't parse. */
  when: string;
}

const ITEM = 'flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[13.5px] transition-colors';
const ITEM_ACTIVE =
  'border border-[var(--pf-border)] bg-white font-semibold text-[var(--pf-text)] shadow-[0_1px_2px_rgba(20,24,20,0.04)]';
const ITEM_IDLE = 'text-[var(--pf-text-secondary)] hover:bg-[#F5F3EF] hover:text-[var(--pf-text)]';

/**
 * A rail, not an archive.
 *
 * `listChats` already splits at 14 days, so everything here is recent — but a
 * fortnight of a busy owner's questions is still more rows than a sidebar
 * should carry, and the older ones are the ones they are least likely to want.
 * The overflow is not lost: those chats keep working, they are just not
 * one click away. (History's "Older chats" section is the 14-day+ list; a
 * proper all-chats screen is a later plan's job.)
 */
const RAIL_LIMIT = 10;

export function RailChats({ chats, reviewCount = 0 }: { chats: RailChat[]; reviewCount?: number }) {
  const pathname = usePathname() ?? '';
  const isNew = pathname === '/app/chat/new';

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <RailReview count={reviewCount} active={pathname === REVIEW_CHAT_ROUTE} />

      <Link href="/app/chat/new" className={`${ITEM} ${isNew ? ITEM_ACTIVE : ITEM_IDLE}`}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New chat
      </Link>

      {chats.slice(0, RAIL_LIMIT).map((chat) => {
        const active = pathname === `/app/chat/${chat.id}`;
        return (
          <Link
            key={chat.id}
            href={`/app/chat/${chat.id}`}
            aria-current={active ? 'page' : undefined}
            className={`${ITEM} ${active ? ITEM_ACTIVE : ITEM_IDLE}`}
            title={chat.title}
          >
            <ChatDot module={chat.module} />
            <span className="min-w-0 flex-1 truncate">{chat.title}</span>
            {chat.when ? (
              <span className="of-num shrink-0 text-[11px] text-[var(--pf-text-faint)]">{chat.when}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Which part of the platform the conversation started in.
 *
 * The rail already speaks in two dot shapes: a gradient CIRCLE for the agents'
 * own voice (the live dot on "Today's brief") and a flat grey SQUARE for the
 * modules under the hood. A chat inherits whichever it came from, so the list
 * reads at a glance as "things Vyso raised" versus "things I asked while I was
 * in OrderFlow" — without adding a third vocabulary.
 */
function ChatDot({ module }: { module: string | null }) {
  if (module === null || module === 'brief') {
    return (
      <span
        className="h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: AI_GRADIENT_CHROME }}
        aria-hidden
      />
    );
  }
  return <span className="h-[5px] w-[5px] shrink-0 rounded-[2px] bg-[#C9CCC4]" aria-hidden />;
}
