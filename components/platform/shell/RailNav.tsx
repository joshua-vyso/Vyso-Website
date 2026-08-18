'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { AI_GRADIENT_CHROME } from '@/components/platform/brief/brief-display';
import { RailChats, type RailChat } from './RailChats';

/**
 * The Brief's two primary nav rows — Today's brief / History. Byte-identical
 * markup to the two Links BriefRail.tsx rendered, split out as its own client
 * component because it now lives inside app/app/layout.tsx (AppRail.tsx),
 * which does NOT re-render on client-side navigation between /app/* routes
 * (Next 16 layouts persist — .ai/plan_chat_first_shell.md §2). Active state
 * therefore has to come from usePathname()/useSearchParams() rather than a
 * server-computed `view` prop; `openCount`/`historyCount` stay server props
 * and go stale between hard loads / router.refresh() calls, which the plan
 * accepts (§12 D4).
 *
 * Reused as-is inside MobileDrawer.tsx (plan §6) — the drawer's nav rows are
 * the same two Links, just inside a sheet instead of the desktop rail.
 *
 * WHO SEES THE TWO ROWS (v2b). Both are hidden for anyone without brief access
 * (`canSeeBrief`, resolved server-side in app/app/layout.tsx). "New chat" and
 * this user's conversations STAY: a chat is their own, it is useful to them on
 * the module screens they do have, and every money tool Finch could reach from
 * it is already behind the same role gate. Hiding the rows is presentation, not
 * enforcement — the routes themselves redirect (app/app/page.tsx,
 * app/app/finding/[id]/page.tsx), because a rail is a suggestion and a bookmark
 * is not.
 *
 * Mounted from Wave 2 on, inside AppRail (app/app/layout.tsx).
 */

const ITEM = 'flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[13.5px] transition-colors';
const ITEM_ACTIVE =
  'border border-[var(--pf-border)] bg-white font-semibold text-[var(--pf-text)] shadow-[0_1px_2px_rgba(20,24,20,0.04)]';
const ITEM_IDLE = 'text-[var(--pf-text-secondary)] hover:bg-[#F5F3EF] hover:text-[var(--pf-text)]';

export function RailNav({
  openCount,
  historyCount,
  chats,
  canSeeBrief,
}: {
  openCount: number;
  historyCount: number;
  /** This user's recent conversations, newest first, with their "when" already
   *  rendered server-side (see RailChats). Empty before the finch-chats
   *  migration is applied — the block then shows only "New chat", which still
   *  works: the row is a link to a screen, not to a database. */
  chats: RailChat[];
  /** Owner/admin. False drops the two Brief rows and leaves the chat block
   *  (v2b — see the docblock above). */
  canSeeBrief: boolean;
}) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const isHistory = pathname === '/app' && searchParams.get('view') === 'history';
  // `?view=all` (the full briefing) deliberately highlights "Today's brief":
  // it is that page's own overflow card that leads there, so the rail should
  // keep saying where the reader is — inside the brief, looking at more of it.
  const isBrief = pathname === '/app' && !isHistory;

  return (
    <div className="flex flex-col gap-2">
      {canSeeBrief ? (
        <Link href="/app" className={`${ITEM} ${isBrief ? ITEM_ACTIVE : ITEM_IDLE}`}>
          {/* The live dot is one of the sanctioned gradient marks — it reads as
              "the agent is watching". `.vyso-pulse` is the shell's token-driven
              promotion of the mock's inline vysoPulse keyframe (plan §5), used
              here in place of Tailwind's built-in animate-pulse. */}
          <span
            className="h-2 w-2 rounded-full vyso-pulse"
            style={{ background: AI_GRADIENT_CHROME }}
            aria-hidden
          />
          Today&apos;s brief
          {openCount > 0 ? (
            <span className="of-num ml-auto text-[11px] font-semibold text-[#BE5D23]">{openCount}</span>
          ) : null}
        </Link>
      ) : null}

      {/* Directly under Today's brief, per plan §1.2 — the conversations are
          the second thing this rail is for, and History (below) is the tail of
          the brief rather than a peer of it. Without brief access it becomes the
          FIRST thing in the rail, which is correct: the chat is then the only
          thing above "Under the hood" this person has. */}
      <RailChats chats={chats} />

      {canSeeBrief ? (
        <Link href="/app?view=history" className={`${ITEM} ${isHistory ? ITEM_ACTIVE : ITEM_IDLE}`}>
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
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
          History
          {historyCount > 0 ? (
            <span className="of-num ml-auto text-[11px] text-[var(--pf-text-faint)]">{historyCount}</span>
          ) : null}
        </Link>
      ) : null}
    </div>
  );
}
