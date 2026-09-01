import { VysoMark } from '@/components/platform/VysoMark';
import type { PluginRailRow } from '@/lib/platform/plugins';
import { Plugins } from './Plugins';
import { RailNav } from './RailNav';
import { UploadButton } from './UploadButton';
import { UserChipMenu } from './UserChipMenu';

/**
 * The persistent 216px left rail — the platform's primary chrome from Wave 2
 * onward, replacing TopBar (.ai/plan_chat_first_shell.md §4.1, §4.2). A server
 * component: it lives in app/app/layout.tsx and only needs the data that layout
 * resolves server-side per request. Everything a rail row needs to be
 * interactive — active pathname, org/trial from the session, outside-click
 * handling — is read client-side by its children (RailNav/UserChipMenu) via
 * usePathname()/usePlatform(), exactly as TopBar read them directly rather than
 * being handed them as props.
 *
 * ── WHAT PHASE 0 TOOK OFF IT (`.ai/plan_phase0_teardown_shell.md`) ───────────
 *   - `chats` / RailChats — the conversation list, with the rest of the chat
 *     surfaces (Task D). The components are all still in the repo.
 *   - `historyCount` — the Brief's History row is not in the new IA (Task E).
 *   - `modules` / `UnderTheHood` — the module launcher. Nav is a fixed list now
 *     (nav-config.ts), the old module routes still work by URL, and
 *     UnderTheHood.tsx was deleted with its last mount.
 *   - The `Suspense` boundary around RailNav. It existed because RailNav read
 *     `?view=history` with `useSearchParams()`, which forces a prerendered
 *     route to bail out to client rendering up to the nearest boundary and
 *     fails a production build without one
 *     (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 *     use-search-params.md). No row reads the query string any more, so the
 *     boundary guards nothing.
 * And what it added: the Upload button, top-right beside the mark — the shell's
 * one primary action (Task E4).
 *
 * Own column, not a sticky child of <main>: the layout (plan §4.1) makes this a
 * `flex-row` sibling of <main>, so plain `h-screen` is correct.
 */
export function AppRail({
  openCount,
  canSeeBrief,
  plugins,
  reviewCount,
}: {
  openCount: number;
  /** Owner/admin (v2b — lib/platform/access.ts). False hides the Overview row
   *  inside RailNav, because `/app` redirects a member away. */
  canSeeBrief: boolean;
  /** The Plugins section's rows, resolved by the layout. EMPTY for a member —
   *  plugins are finance-grade (`canSeeMoney`), so the layout withholds the rows
   *  rather than this component learning a second access rule (Plugins X1). */
  plugins: PluginRailRow[];
  /** How many items are waiting on a decision, resolved by the layout in the
   *  same Promise.all as the findings. 0 hides the Review row entirely. */
  reviewCount: number;
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
        {/* The mark and the shell's one primary action share a row: the rail is
            216px wide and Upload has to be reachable from every screen without
            costing a nav slot or pushing the ten rows down by 44px. `pl-2`
            rather than `px-2` so the mark keeps its old left alignment while
            the button sits flush with the rows' right edge. */}
        <div className="flex items-center justify-between gap-2 pb-[22px] pl-2">
          <VysoMark width={64} color="#171A17" />
          <UploadButton />
        </div>

        <RailNav openCount={openCount} canSeeBrief={canSeeBrief} reviewCount={reviewCount} />
      </div>

      <div className="flex flex-col">
        {/* Plugins is the only section left below the nav — "Under the hood"
            was the other one, and it went with the module launcher (Task E). */}
        <Plugins plugins={plugins} />
        <UserChipMenu />
      </div>
    </nav>
  );
}
