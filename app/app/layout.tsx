import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { PlatformProvider } from '@/lib/platform/session';
import { canSeeBrief, canSeeMoney } from '@/lib/platform/access';
import { fetchFindings } from '@/lib/platform/agent-findings';
import { pluginRailRows } from '@/lib/platform/plugins-data';
import { chatTimeLabel, listChats } from '@/lib/platform/finch-chats';
import { loadReviewQueue, reviewChatContext } from '@/lib/platform/review-queue';
import { suggestionsForOrg } from '@/lib/platform/finch-suggestions-data';
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
  // /app/* route. Both reads need `session.org.id`, which only exists once
  // `getPlatformSession()` has resolved — hence the await above them and the
  // Promise.all below. The Brief page repeats the findings read for its feed;
  // the layout's copy is the counts only, and both are cheap (a few dozen
  // rows, one round-trip).
  //
  // Staleness: layouts do not re-render on client-side navigation (Next 16 —
  // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md),
  // so these numbers refresh on a hard load and on `router.refresh()` — which
  // is exactly what FindingCard already calls after a dismiss. Accepted by the
  // plan (§4.1, §12 D4).
  //
  // W2 adds the second read: this user's own conversations for the rail.
  // `listChats` is RLS-scoped AND
  // filtered on org + user — chats are private to their author, unlike
  // findings, which the whole org shares — and it degrades to an empty flagged
  // list before the finch-chats migration is applied, exactly as
  // `fetchFindings` does for `agent_findings`.
  //
  // Plugins X1 adds a third read: the connection status behind the rail's
  // Plugins rows. ONE read for both surfaces (desktop rail and mobile drawer),
  // for the same reason the findings read serves both the badges and the chat
  // prelude — two queries that could disagree about whether Xero is connected
  // is one query too many. It is SKIPPED ENTIRELY for a member: plugins are
  // finance-grade (`canSeeMoney`), the section is not rendered for them, and a
  // read whose result is thrown away is a read not worth making. The predicate
  // is called here as well as below because it is pure and free, and inlining
  // it keeps this third read inside the same Promise.all rather than costing a
  // second round-trip after the access block.
  // The Review wave adds a fourth read: what is waiting on a human decision.
  // In the SAME Promise.all for the reason the others are — the rail's pinned
  // "Review" row, the red dot's count and the review chat's own prelude are one
  // fact, and two reads of it could disagree about whether the queue is empty.
  // It is one small indexed query per enabled module (documents, quote
  // requests) and NONE at all for an org with neither, and it is deliberately
  // NOT behind `canSeeMoney`: filing an invoice and answering an enquiry are
  // operational work, so the gate is module access, which `loadReviewQueue`
  // applies from `features`/`lockedModules` itself (lib/platform/review-queue.ts).
  // Same staleness contract as the badges: it refreshes on a hard load and on
  // `router.refresh()`, which the chat provider now fires after every turn taken
  // on the review route so the opening card cannot outlive its own queue.
  const [feed, chatList, pluginRows, reviewQueue] = await Promise.all([
    fetchFindings(session.org.id),
    listChats(session.org.id, session.userId),
    canSeeMoney(session.profile?.role) ? pluginRailRows(session.org.id) : Promise.resolve([]),
    loadReviewQueue(session.org.id, {
      features: session.features,
      lockedModules: session.lockedModules,
    }),
  ]);

  // ONE clock for the rail, resolved on the server. See RailChats: a client
  // component recomputing "4m" during hydration can disagree with the HTML it
  // is hydrating, so the label crosses the boundary as finished text.
  const railNow = new Date();
  const railChats = chatList.recent.map((c) => ({
    id: c.id,
    title: c.title,
    module: c.module,
    when: chatTimeLabel(c.updated_at, railNow),
  }));

  /* ── Access (v2b) ──────────────────────────────────────────────────────────
   * ONE predicate, two names, one implementation — lib/platform/access.ts says
   * why they are kept apart. `canSeeMoney` was computed inline here before this
   * wave and is now imported, so the rail's rule and `/api/ai/agent`'s rule
   * cannot drift into disagreeing about who an admin is.
   *
   * WHAT THIS FLAG DOES AND DOES NOT DO HERE. It decides what the SHELL offers:
   * the rail's two Brief rows, the findings prelude the chat sends, and whether
   * the chip row may mention findings. It does NOT gate the routes — the
   * redirects live in app/app/page.tsx and app/app/finding/[id]/page.tsx,
   * because a Next 16 layout does not re-render on a client-side navigation
   * (Partial Rendering), so an auth check placed in one is not re-run on a route
   * change and is the wrong place to enforce anything
   * (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts
   * and auth checks"). RLS is untouched by any of it: `agent_findings` remains
   * readable org-wide at the database level exactly as before, and this is UI
   * and route gating on top of the money gate that already existed. */
  const briefAccess = canSeeBrief(session.profile?.role);
  const moneyAccess = canSeeMoney(session.profile?.role);

  // The chips an empty conversation offers (plan §1.4). Built from the feed we
  // already have plus two small reads, behind the same owner/admin money gate
  // `/api/ai/agent` enforces — a member must not be offered a chip that can
  // only ever come back "restricted". Never throws: see
  // finch-suggestions-data.ts, rule 1.
  //
  // v2b: a user without brief access is handed NO findings, so their chips are
  // the generic openers and the debtor/document ones. Passing `feed.open` here
  // would put a finding's own words into a chip on a screen we have just
  // decided they may not read — the chip's label IS the finding.
  const suggestions = await suggestionsForOrg({
    orgId: session.org.id,
    findings: briefAccess ? feed.open : [],
    canSeeMoney: moneyAccess,
  });

  // The prelude the chat sends to Finch on its first turn (plan §4.1: "do not
  // duplicate the findings read — one fetch feeds badges AND prelude"). It is
  // derived from `feed` above, not from a second query, and it is serialised
  // HERE — on the server, from rows read through the caller's RLS-scoped
  // client — so the chat can never see a finding this org couldn't. Same
  // staleness contract as the badges: it refreshes on a hard load and on
  // router.refresh().
  //
  // v2b: empty for a user without brief access. The prelude is the Brief in
  // words — supplier names, rand figures, who is late — so shipping it to
  // someone the Brief is closed to would hand them through the chat exactly
  // what the redirect just refused them at the door.
  const chatContext = briefAccess ? briefChatContext(feed.open, feed.evidence) : '';

  // The same trick, for the Review chat: the queue as a prelude on that route's
  // first turn, so "what's in the flagged invoice?" is a question about
  // something the model has been named rather than something it has to go
  // hunting for. Built from `reviewQueue` above — no second read — and NOT
  // gated on `briefAccess`, for the reason the queue itself isn't. Empty string
  // when there is nothing to review, which is also when the route says so.
  const reviewContext = reviewChatContext(reviewQueue);

  return (
    <PlatformProvider value={session}>
      {/* The conversation lives ABOVE the whole shell, not inside <main>: it
          has to survive every client-side navigation (layouts don't re-render
          on one), and both sign-out call sites — UserChipMenu in the rail and
          MobileDrawer under the mobile header — must be able to reach its
          reset() (plan §8 E7). Wrapping here is what puts them inside it. */}
      <FinchChatProvider
        context={chatContext}
        reviewContext={reviewContext}
        orgName={session.org.name}
        suggestions={suggestions}
      >
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
            chats={railChats}
            canSeeBrief={briefAccess}
            modules={railModules(session.features)}
            plugins={pluginRows}
            reviewCount={reviewQueue.total}
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
              chats={railChats}
              canSeeBrief={briefAccess}
              modules={railModules(session.features)}
              plugins={pluginRows}
              reviewCount={reviewQueue.total}
            />

            {/* The cool wash every module sits on. It lives here rather than in each
                module layout so the nine of them can't drift apart.

                `data-lenis-prevent`: THIS is the scroll container for the whole
                platform, and the root layout mounts Lenis (components/finch/
                SmoothScroll.tsx) above both surfaces. Lenis drives the DOCUMENT
                scroll and, with `allowNestedScroll` at its default `false`, does
                not discover a nested scroller on its own — it calls
                preventDefault() on the wheel event and applies the delta to a
                document that `overflow-hidden` above has made unscrollable, so
                wheel/trackpad scrolling died everywhere under `/app/*`
                (2026-08-17). SmoothScroll now refuses to instantiate on these
                routes at all, which is the actual fix; this attribute is the
                second lock — it makes the wheel event bypass any Lenis that IS
                running (the tail of a marketing→platform client navigation
                before that effect tears down) and reach this element natively.
                Lenis checks it on the composed path from the event target up to
                <html> (node_modules/lenis/dist/lenis.mjs:606-611), and <main>
                is on that path for every scrollable thing the platform draws. */}
            <main
              className="min-h-0 min-w-0 flex-1 overflow-y-auto"
              style={{ background: 'var(--pf-wash)' }}
              data-lenis-prevent
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
