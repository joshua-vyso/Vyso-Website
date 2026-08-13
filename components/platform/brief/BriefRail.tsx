import Link from 'next/link';
import { VysoMark } from '@/components/platform/VysoMark';
import { AI_GRADIENT_CHROME } from './brief-display';

/**
 * The Brief's own 216px rail: today / history, then the modules, deliberately
 * demoted to "under the hood".
 *
 * It is part of the PAGE, not the platform chrome — app/app/layout.tsx keeps
 * its TopBar and every other screen keeps its full width. The design mock has
 * no top bar at all; reproducing that would mean restructuring the shell all
 * nine modules hang off, so the rail lives inside the page instead (see
 * .ai/plan_brief_home.md § Architecture ruling).
 *
 * A server component: the brief/history switch is a URL (`?view=history`), not
 * client state, so the rail is two `Link`s and the page re-renders with real
 * data on either side of the toggle.
 */

export interface RailModule {
  label: string;
  href: string;
}

const ITEM = 'flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[13.5px] transition-colors';
const ITEM_ACTIVE =
  'border border-[var(--pf-border)] bg-white font-semibold text-[var(--pf-text)] shadow-[0_1px_2px_rgba(20,24,20,0.04)]';
const ITEM_IDLE = 'text-[var(--pf-text-secondary)] hover:bg-[#F5F3EF] hover:text-[var(--pf-text)]';

export function BriefRail({
  view,
  openCount,
  historyCount,
  modules,
  userInitials,
  userLabel,
}: {
  view: 'brief' | 'history';
  openCount: number;
  historyCount: number;
  modules: RailModule[];
  userInitials: string;
  /** "Josh · Meadow Fresh" — first name and org, already joined by the page. */
  userLabel: string;
}) {
  return (
    <nav
      aria-label="Brief"
      // Sticky, not fixed: the scroll container is the layout's <main>, so the
      // rail holds its own full height there while a long feed scrolls past it.
      // Hidden below lg — the mock is a 1440px desktop screen and a 216px rail
      // would eat a phone; the modules stay reachable through the TopBar.
      className="sticky top-0 hidden h-[calc(100dvh-var(--pf-topbar-h))] w-[216px] shrink-0 flex-col gap-2 self-start overflow-y-auto border-r border-[#EFEDE8] px-5 pb-6 pt-7 lg:flex"
    >
      <div className="px-2 pb-[22px]">
        <VysoMark width={64} color="#171A17" />
      </div>

      <Link href="/app" className={`${ITEM} ${view === 'brief' ? ITEM_ACTIVE : ITEM_IDLE}`}>
        {/* The live dot is one of the four sanctioned gradient marks — it reads
            as "the agent is watching", which is exactly what it means. */}
        <span
          className="h-2 w-2 rounded-full motion-safe:animate-pulse"
          style={{ background: AI_GRADIENT_CHROME }}
          aria-hidden
        />
        Today&apos;s brief
        {openCount > 0 ? (
          <span className="of-num ml-auto text-[11px] font-semibold text-[#BE5D23]">{openCount}</span>
        ) : null}
      </Link>

      <Link href="/app?view=history" className={`${ITEM} ${view === 'history' ? ITEM_ACTIVE : ITEM_IDLE}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        History
        {historyCount > 0 ? (
          <span className="of-num ml-auto text-[11px] text-[var(--pf-text-faint)]">{historyCount}</span>
        ) : null}
      </Link>

      <div className="mt-auto flex flex-col gap-0.5">
        <div className="px-2.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
          Under the hood
        </div>
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-[var(--pf-text-muted)] transition-colors hover:bg-[#F5F3EF] hover:text-[var(--pf-text-control)]"
          >
            <span className="h-[5px] w-[5px] rounded-[2px] bg-[#C9CCC4]" aria-hidden />
            {m.label}
          </Link>
        ))}

        <div className="mt-3.5 flex items-center gap-2.5 border-t border-[#EFEDE8] px-2.5 pt-2.5">
          <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[var(--pf-accent-weak)] text-[11px] font-semibold text-[var(--pf-accent-strong)]">
            {userInitials}
          </span>
          <span className="truncate text-[12.5px] text-[var(--pf-text-secondary)]">{userLabel}</span>
        </div>
      </div>
    </nav>
  );
}
