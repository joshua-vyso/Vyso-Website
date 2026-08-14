import { VysoMark } from '@/components/platform/VysoMark';
import { RailNav } from './RailNav';
import { UnderTheHood } from './UnderTheHood';
import { UserChipMenu } from './UserChipMenu';
import type { RailModule } from './shell-data';

/**
 * The persistent 216px left rail — the platform's primary chrome from Wave 2
 * onward, replacing TopBar (.ai/plan_chat_first_shell.md §4.1, §4.2). A server
 * component: it lives in app/app/layout.tsx and only needs the data that
 * layout resolves server-side per request (findings counts, the modules list —
 * `railModules()` in shell-data.ts). Everything else a rail row needs to be
 * interactive — active pathname, org/trial/lockedModules from the session,
 * outside-click handling — is read client-side by its children
 * (RailNav/UnderTheHood/UserChipMenu) via usePathname()/usePlatform(), exactly
 * as TopBar read them directly rather than being handed them as props.
 *
 * Own column, not a sticky child of <main> — BriefRail.tsx's
 * `h-[calc(100dvh-var(--pf-topbar-h))]` calc doesn't apply here; the target
 * layout (plan §4.1) makes this a `flex-row` sibling of <main>, so plain
 * `h-screen` is correct and there is no more --pf-topbar-h consumer on the
 * desktop rail.
 *
 * Unmounted in Wave 1 — not imported by app/app/layout.tsx yet (Wave 2 swaps
 * TopBar out for this).
 */
export function AppRail({
  openCount,
  historyCount,
  modules,
}: {
  openCount: number;
  historyCount: number;
  modules: RailModule[];
}) {
  return (
    <nav
      aria-label="Vyso"
      className="hidden h-screen w-[var(--pf-sidebar-w)] shrink-0 flex-col gap-2 overflow-y-auto border-r border-[#EFEDE8] px-5 pb-6 pt-7 lg:flex"
    >
      <div className="px-2 pb-[22px]">
        <VysoMark width={64} color="#171A17" />
      </div>

      <RailNav openCount={openCount} historyCount={historyCount} />

      <div className="mt-auto flex flex-col">
        <UnderTheHood modules={modules} />
        <UserChipMenu />
      </div>
    </nav>
  );
}
