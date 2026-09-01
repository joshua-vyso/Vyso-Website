'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AI_GRADIENT_CHROME } from '@/components/platform/brief/brief-display';
import { NAV_ITEMS, isNavActive } from './nav-config';
import { RailReview } from './RailReview';

/**
 * The rail's rows — the whole nav, from `nav-config.ts`
 * (`.ai/plan_phase0_teardown_shell.md` Task E).
 *
 * WHAT THIS USED TO BE. Two Brief rows (Today's brief / History), then the
 * chat block (RailChats: the pinned Review row, "New chat" and this user's
 * conversations), and — mounted separately by AppRail — the nine modules behind
 * an "Under the hood" toggle. Phase 0 replaced all of it with one flat list:
 * the chat surfaces are disconnected (Task D), the module launcher is gone
 * (Task E), and what is left is ten fixed destinations that are the same for
 * every org.
 *
 * ACTIVE STATE FROM `usePathname()`, not from a server prop. This component
 * lives inside AppRail, in the platform LAYOUT, which does NOT re-render on a
 * client-side navigation between /app/* routes (Next 16 layouts persist —
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * layout.md). A server-computed "which row is open" would be right once and
 * wrong for the rest of the session. `openCount`/`reviewCount` are still server
 * props and still go stale between hard loads and `router.refresh()` calls,
 * which the plan accepts (§12 D4).
 *
 * NO `useSearchParams` ANY MORE, and therefore no Suspense boundary around this
 * component in AppRail. The only reader of the query string was the History
 * row's `?view=history` check, and History is not a row in the new IA — see
 * `isNavActive` for why `?view=` still counts as Overview.
 *
 * WHO SEES OVERVIEW (v2b, kept). The row is hidden for anyone without brief
 * access (`canSeeBrief`, resolved server-side in app/app/layout.tsx) because
 * `/app` REDIRECTS a member to their first open module — offering a row that
 * bounces is worse than offering none. Hiding it is presentation, not
 * enforcement: the route does the refusing (app/app/page.tsx), because a rail
 * is a suggestion and a bookmark is not.
 *
 * Reused as-is inside MobileDrawer.tsx — the drawer's nav is the same rows in a
 * sheet, from one mount point, so the two surfaces cannot drift.
 */

const ITEM = 'flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[13.5px] transition-colors';
const ITEM_ACTIVE =
  'border border-[var(--pf-border)] bg-white font-semibold text-[var(--pf-text)] shadow-[0_1px_2px_rgba(20,24,20,0.04)]';
const ITEM_IDLE = 'text-[var(--pf-text-secondary)] hover:bg-[#F5F3EF] hover:text-[var(--pf-text)]';

export function RailNav({
  openCount,
  canSeeBrief,
  reviewCount = 0,
}: {
  /** Open findings, drawn as Overview's badge — the one number the Brief's row
   *  has always carried. */
  openCount: number;
  /** Owner/admin. False drops the Overview row and leaves the other nine
   *  (v2b — see the docblock above). */
  canSeeBrief: boolean;
  /** How many things are waiting on a decision. Handed to RailReview, which
   *  draws NOTHING at 0 — so the Review row appears when the system picks
   *  something up and goes away when the last item is done, exactly as it did
   *  in the rail's chat block. NOT gated on `canSeeBrief`: documents and quote
   *  requests are operational work, not money figures
   *  (lib/platform/review-queue.ts). */
  reviewCount?: number;
}) {
  const pathname = usePathname() ?? '';

  return (
    <div className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isNavActive(pathname, item.href);

        // The two rows that are not a link-with-an-icon. Review brings its own
        // component (icon, red dot, ebbing border, and the disappearing act at
        // zero); Overview is handled below because it is otherwise an ordinary
        // row — it just wears the gradient mark instead of a stroke icon.
        if (item.key === 'review') {
          return <RailReview key={item.key} count={reviewCount} active={active} />;
        }
        if (item.key === 'overview' && !canSeeBrief) return null;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`${ITEM} ${active ? ITEM_ACTIVE : ITEM_IDLE}`}
          >
            {item.key === 'overview' ? (
              // The live dot is one of the sanctioned gradient marks — it reads
              // as "the agent is watching". `.vyso-pulse` is the shell's
              // token-driven promotion of the mock's inline vysoPulse keyframe.
              <span
                className="h-2 w-2 shrink-0 rounded-full vyso-pulse"
                style={{ background: AI_GRADIENT_CHROME }}
                aria-hidden
              />
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
                aria-hidden
              >
                <path d={item.icon ?? ''} />
              </svg>
            )}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.key === 'overview' && openCount > 0 ? (
              <span className="of-num shrink-0 text-[11px] font-semibold text-[#BE5D23]">{openCount}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
