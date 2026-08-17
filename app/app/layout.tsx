import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { PlatformProvider } from '@/lib/platform/session';
import { fetchFindings } from '@/lib/platform/agent-findings';
import { ModuleLockGuard } from '@/components/platform/ModuleLockGuard';
import { TrialGate } from '@/components/platform/TrialGate';
import { AppRail } from '@/components/platform/shell/AppRail';
import { FinchChatProvider } from '@/components/platform/shell/FinchChatProvider';
import { GlobalChatDock } from '@/components/platform/shell/GlobalChatDock';
import { MobileTopBar } from '@/components/platform/shell/MobileTopBar';
import { railModules } from '@/components/platform/shell/shell-data';
import { briefChatContext } from '@/components/platform/brief/brief-chat';

export const metadata: Metadata = {
  title: 'Vyso — Platform',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

/** Auth guard for the desktop platform. Redirects to /login when unauthenticated. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  // D3 — a signed-in user who hasn't finished onboarding is sent to the guided
  // /onboarding flow: no org yet (brand-new signup), or an org whose onboarding
  // isn't complete. `=== null` (not a falsy check) is deliberate — existing orgs
  // predating the onboarding migration have NO onboarding_completed_at column, so
  // the field is `undefined` there and they are never redirected. Orgs created by
  // the onboarding RPC have the column present-but-null until they finish.
  if (!session.org || session.org.onboarding_completed_at === null) redirect('/onboarding');

  // The rail's two badge counts AND the chat dock's findings prelude, off ONE
  // read. Same read app/app/page.tsx does — one ordered
  // select over `agent_findings` through the caller's RLS-scoped client — and
  // the same tolerance for a table that doesn't exist yet: `fetchFindings`
  // turns a missing-relation error into an empty feed (`tableMissing`), so a
  // pre-migration org gets a rail with no badges rather than a 500 on every
  // /app/* route. Nothing else is parallelisable here: the read needs
  // `session.org.id`, which only exists once `getPlatformSession()` has
  // resolved, so there is no second promise to `Promise.all` it with. The
  // Brief page repeats the read for its feed; the layout's copy is the counts
  // only, and both are cheap (a few dozen rows, one round-trip).
  //
  // Staleness: layouts do not re-render on client-side navigation (Next 16 —
  // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md),
  // so these numbers refresh on a hard load and on `router.refresh()` — which
  // is exactly what FindingCard already calls after a dismiss. Accepted by the
  // plan (§4.1, §12 D4).
  const feed = await fetchFindings(session.org.id);

  // The prelude the chat sends to Finch on its first turn (plan §4.1: "do not
  // duplicate the findings read — one fetch feeds badges AND prelude"). It is
  // derived from `feed` above, not from a second query, and it is serialised
  // HERE — on the server, from rows read through the caller's RLS-scoped
  // client — so the chat can never see a finding this org couldn't. Same
  // staleness contract as the badges: it refreshes on a hard load and on
  // router.refresh().
  const chatContext = briefChatContext(feed.open, feed.evidence);

  return (
    <PlatformProvider value={session}>
      {/* The conversation lives ABOVE the whole shell, not inside <main>: it
          has to survive every client-side navigation (layouts don't re-render
          on one), and both sign-out call sites — UserChipMenu in the rail and
          MobileDrawer under the mobile header — must be able to reach its
          reset() (plan §8 E7). Wrapping here is what puts them inside it. */}
      <FinchChatProvider context={chatContext} orgName={session.org.name}>
        <div
          // Globals set --radius: 0 (sharp shadcn default), which zeroes the
          // rounded-sm/md/lg/xl scale and leaves buttons/inputs square. Give the
          // platform subtree a real radius so all corners round consistently.
          style={{ fontFamily: 'var(--font-instrument)', ['--radius' as string]: '0.625rem' } as React.CSSProperties}
          // flex-ROW now: the rail is a full-height column beside the scroller,
          // not a bar above it (.ai/plan_chat_first_shell.md §4.1).
          className="flex h-screen flex-row overflow-hidden bg-white text-[var(--pf-text)] antialiased"
          // Marks the platform shell root so globals.css can scope the
          // marketing-only `html, body { overflow-x: hidden }` override
          // (see the `:has([data-platform-shell])` block there) to `/app/*`
          // without touching the marketing site's selector
          // (.ai/plan_brief_chat_v2.md §2.7/W0).
          data-platform-shell
        >
          {/* OUTSIDE TrialGate/ModuleLockGuard on purpose (plan §8 E1): when the
              trial hard-locks and the gate replaces `children` with its expiry
              screen, the rail — and with it the user chip's Sign out — is still
              on screen. That is the guarantee TopBar used to give from above
              <main>; the rail gives it from beside <main>. ≥lg only (its own
              `hidden lg:flex`). */}
          <AppRail
            openCount={feed.summary.openCount}
            historyCount={feed.history.length}
            modules={railModules(session.features)}
          />

          {/* `relative` for the dock below: it is the containing block the chat
              dock pins its bottom edge to. Deliberately NOT <main> — <main> is
              the scroll container, and an absolutely-positioned child of a
              scroller is laid out against the scrolled padding box, which would
              park the dock at the bottom of the DOCUMENT and scroll it out of
              sight. This column's bottom edge is <main>'s bottom edge, so the
              geometry the plan asked for (§4.3) is unchanged. */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* W3: MobileTopBar + its MobileDrawer replace the old TopBar
                below `lg`, same as AppRail does above it — mounted OUTSIDE
                TrialGate / ModuleLockGuard so the drawer's Sign out row stays
                reachable during a hard trial lock (plan §8 E1). TopBar.tsx
                and ModulesOverlay.tsx were deleted in W5 — this shell has no
                remaining reference to either. */}
            <MobileTopBar
              openCount={feed.summary.openCount}
              historyCount={feed.history.length}
              modules={railModules(session.features)}
            />

            {/* The cool wash every module sits on. It lives here rather than in each
                module layout so the nine of them can't drift apart. */}
            <main
              className="min-h-0 min-w-0 flex-1 overflow-y-auto"
              style={{ background: 'var(--pf-wash)' }}
            >
              <TrialGate>
                <ModuleLockGuard>{children}</ModuleLockGuard>
              </TrialGate>
            </main>

            {/* Chat everywhere (plan §4.3, W4). OUTSIDE the gates by position but
                never a way around them: the dock hides itself when the trial has
                expired (§8 E6), and it is a sibling of <main> rather than a child
                for the containing-block reason spelled out above and in
                GlobalChatDock's docblock. z-20, below module chrome and modals. */}
            <GlobalChatDock />
          </div>
        </div>
      </FinchChatProvider>
    </PlatformProvider>
  );
}
