import { Suspense } from 'react';
import { VysoMark } from '@/components/platform/VysoMark';
import { RailNav } from './RailNav';
import type { RailChat } from './RailChats';
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
 * Mounted by app/app/layout.tsx from Wave 2 on.
 */
export function AppRail({
  openCount,
  historyCount,
  chats,
  canSeeBrief,
  modules,
}: {
  openCount: number;
  historyCount: number;
  /** This user's recent chats, resolved by the layout (W2). */
  chats: RailChat[];
  /** Owner/admin (v2b — lib/platform/access.ts). False hides "Today's brief"
   *  and "History" inside RailNav; everything else on this rail stays, because
   *  chats are this person's own and every money tool below is already gated. */
  canSeeBrief: boolean;
  modules: RailModule[];
}) {
  return (
    <nav
      aria-label="Vyso"
      // NO overflow on the <nav> itself (W2). It used to be `overflow-y-auto`,
      // which was invisible while the rail was unmounted and wrong the moment
      // it wasn't: `overflow-y: auto` forces `overflow-x` to compute to `auto`
      // too, so the account menu — 224px wide, anchored to a chip inside a
      // 216px rail — was clipped at the rail's right edge and put a horizontal
      // scrollbar across the user chip. The scroll region moved down to the
      // logo+nav block instead, which contains no popovers; the bottom cluster
      // now sits in a clip-free box and its menu can overhang the rail, which
      // is what the mock shows.
      className="hidden h-screen w-[var(--pf-sidebar-w)] shrink-0 flex-col gap-2 border-r border-[#EFEDE8] px-5 pb-6 pt-7 lg:flex"
    >
      {/* flex-1 + min-h-0: this block absorbs the leftover height (so the
          bottom cluster still sits at the bottom, exactly as `mt-auto` did)
          and is the one that scrolls if a short viewport can't fit the rail. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        <div className="px-2 pb-[22px]">
          <VysoMark width={64} color="#171A17" />
        </div>

        {/* SUSPENSE, deliberately (plan §8 E4). RailNav reads `?view=history`
          with useSearchParams(), and the Next docs' rule is: a PRERENDERED
          route bails out to client-side rendering up to the nearest Suspense
          boundary, and a production build of a static page that calls the hook
          without one fails outright ("Missing Suspense boundary with
          useSearchParams" —
          node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md).
          Every /app/* route is dynamic today (the layout awaits
          getPlatformSession() → cookies()), so the hook resolves during the
          server render and this fallback never actually paints — the boundary
          is here so the rail can't become the reason a build breaks if any
          route below it ever turns static. The fallback reserves the two rows'
          height so nothing would jump if it ever did. */}
        <Suspense fallback={<div className="h-[82px]" aria-hidden />}>
          <RailNav
            openCount={openCount}
            historyCount={historyCount}
            chats={chats}
            canSeeBrief={canSeeBrief}
          />
        </Suspense>
      </div>

      <div className="flex flex-col">
        <UnderTheHood modules={modules} />
        <UserChipMenu />
      </div>
    </nav>
  );
}
