import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { PlatformProvider } from '@/lib/platform/session';
import { canSeeBrief, canSeeMoney } from '@/lib/platform/access';
import { fetchFindings } from '@/lib/platform/agent-findings';
import { pluginRailRows } from '@/lib/platform/plugins-data';
import { loadReviewQueue } from '@/lib/platform/review-queue';
import { TrialGate } from '@/components/platform/TrialGate';
import { AppRail } from '@/components/platform/shell/AppRail';
import { FinchChatProvider } from '@/components/platform/shell/FinchChatProvider';
import { MobileTopBar } from '@/components/platform/shell/MobileTopBar';

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

  // The rail's badge count, off ONE read. Same read app/app/page.tsx does — one ordered
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
  // W2's SECOND READ IS GONE (Phase 0, Task D). `listChats` fed the rail's chat
  // list and nothing else; with the chat surfaces disconnected there is no list
  // to draw, so the query is not made rather than made and discarded. The
  // function, and every route that uses it, is untouched.
  //
  // Plugins X1 adds a second read: the connection status behind the rail's
  // Plugins rows. ONE read for both surfaces (desktop rail and mobile drawer) —
  // two queries that could disagree about whether Xero is connected is one
  // query too many. It is SKIPPED ENTIRELY for a member: plugins are
  // finance-grade (`canSeeMoney`), the section is not rendered for them, and a
  // read whose result is thrown away is a read not worth making. The predicate
  // is called here as well as below because it is pure and free, and inlining
  // it keeps this second read inside the same Promise.all rather than costing a
  // second round-trip after the access block.
  // The Review wave adds a third read: what is waiting on a human decision.
  // In the SAME Promise.all for the reason the others are — the rail's Review
  // row and its red dot are one fact, and two reads of it could disagree about
  // whether the queue is empty.
  // It is one small indexed query per enabled module (documents, quote
  // requests) and NONE at all for an org with neither, and it is deliberately
  // NOT behind `canSeeMoney`: filing an invoice and answering an enquiry are
  // operational work, so the gate is module access, which `loadReviewQueue`
  // applies from `features`/`lockedModules` itself (lib/platform/review-queue.ts).
  // Same staleness contract as the badges: it refreshes on a hard load and on
  // `router.refresh()`. `/app/review` re-reads the queue for itself for the same
  // reason it always did — this copy is the rail's count, not the chain's list.
  const [feed, pluginRows, reviewQueue] = await Promise.all([
    fetchFindings(session.org.id),
    canSeeMoney(session.profile?.role) ? pluginRailRows(session.org.id) : Promise.resolve([]),
    loadReviewQueue(session.org.id, {
      features: session.features,
      lockedModules: session.lockedModules,
    }),
  ]);

  /* ── Access (v2b) ──────────────────────────────────────────────────────────
   * ONE predicate, two names, one implementation — lib/platform/access.ts says
   * why they are kept apart. `canSeeMoney` was computed inline here before this
   * wave and is now imported, so the rail's rule and `/api/ai/agent`'s rule
   * cannot drift into disagreeing about who an admin is.
   *
   * WHAT THIS FLAG DOES AND DOES NOT DO HERE. It decides what the SHELL offers:
   * the rail's Overview row. (It used to decide two more things — the findings
   * prelude the chat sent and whether the suggestion chips could mention a
   * finding — and both went with the chat surfaces in Phase 0, Task D.) It does
   * NOT gate the routes — the
   * redirects live in app/app/page.tsx and app/app/finding/[id]/page.tsx,
   * because a Next 16 layout does not re-render on a client-side navigation
   * (Partial Rendering), so an auth check placed in one is not re-run on a route
   * change and is the wrong place to enforce anything
   * (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts
   * and auth checks"). RLS is untouched by any of it: `agent_findings` remains
   * readable org-wide at the database level exactly as before, and this is UI
   * and route gating on top of the money gate that already existed. */
  const briefAccess = canSeeBrief(session.profile?.role);

  return (
    <PlatformProvider value={session}>
      {/* ── The chat provider STAYS MOUNTED (Phase 0, Task D) ─────────────────
          The dock, the rail's chat list and the chat pages are all gone; this
          is not one of them. It is a CONTEXT PROVIDER, and two surfaces that
          survive Phase 0 read from it: `ReviewChain` on /app/review calls
          `setReviewFocus`, and `MobileDrawer`/`UserChipMenu` call `reset()` on
          sign-out. `useFinchChat()` throws outside the provider, so unmounting
          it would take the Review queue down with the chat.

          It also has to sit ABOVE the whole shell rather than inside <main>:
          layouts don't re-render on a client-side navigation, and both sign-out
          call sites must be inside it (plan §8 E7).

          THE PROPS ARE EMPTY, DELIBERATELY. Every one of them fed a model turn,
          and nothing in this build can start one — there is no composer left to
          call `send()` from. So:
            - `context` — the Brief's findings prelude (`briefChatContext`) —
              is ''. Serialising a page of supplier names and rand figures into
              a client component that cannot send them is a data-exposure risk
              paid for nothing.
            - `reviewContext` is left at its default '' for the same reason.
              /app/review consumes the QUEUE, not its prelude: the chain reads
              `queue.items` server-side and `reviewChatContext` only ever fed
              `send()`'s first turn (lib/platform/review-queue-shared.ts). It is
              still exported and still tested, ready for the day a composer
              comes back.
            - `suggestions` is `[]`: `suggestionsForOrg` cost two reads per
              /app/* load to build chips for a screen that no longer exists.
          `orgName` stays because it is already in hand and costs nothing.

          When chat returns, this is where its data comes back — one prop each,
          from reads that were deleted from this file, not from the library. */}
      <FinchChatProvider context="" orgName={session.org.name} suggestions={[]}>
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
          {/* OUTSIDE TrialGate on purpose (plan §8 E1): when the trial
              hard-locks and the gate replaces `children` with its expiry
              screen, the rail — and with it the user chip's Sign out — is still
              on screen. That is the guarantee TopBar used to give from above
              <main>; the rail gives it from beside <main>. ≥lg only (its own
              `hidden lg:flex`).

              THREE PROPS LEFT PHASE 0 (Task D/E): `chats` (the rail's chat
              list), `historyCount` (the Brief's History row, not in the new IA)
              and `modules` (the "Under the hood" launcher, now gone). The rail
              takes the counts it still draws and nothing else. */}
          <AppRail
            openCount={feed.summary.openCount}
            canSeeBrief={briefAccess}
            plugins={pluginRows}
            reviewCount={reviewQueue.total}
          />

          {/* `relative` STAYS. It was the containing block the chat dock pinned
              its bottom edge to, and the dock is gone — but it is also what any
              future overlay in this column (Phase 1's upload tray) will pin
              against, and it costs nothing: a positioned ancestor with no
              positioned children changes no layout. */}
          <div className="relative flex min-w-0 flex-1 flex-col">
            {/* W3: MobileTopBar + its MobileDrawer replace the old TopBar
                below `lg`, same as AppRail does above it — mounted OUTSIDE
                TrialGate so the drawer's Sign out row stays reachable during a
                hard trial lock (plan §8 E1). TopBar.tsx and ModulesOverlay.tsx
                were deleted in W5 — this shell has no remaining reference to
                either. */}
            <MobileTopBar
              openCount={feed.summary.openCount}
              canSeeBrief={briefAccess}
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
            {/* `overflow-x-clip` (v2.1) — the missing half of W0. `overflow-y:
                auto` with `overflow-x` left at `visible` does NOT stay visible:
                CSS computes the visible axis to `auto` whenever the other one
                scrolls, so <main> has silently been a HORIZONTAL scroll
                container this whole time. `html, body { overflow-x: clip }`
                below could never catch that — the sideways scroll was happening
                inside <main>, not on the document — which is why one wide table
                dragged Doc-U's whole page, header and all, off to the left
                (Josh, 2026-08-19). `clip` rather than `hidden` for the same
                reason the rule below uses it: it guarantees "never scroll
                sideways" without adding a scrollport, so `position: sticky`
                inside <main> (the review pane's track, every table header) keeps
                working. Anything genuinely wider than the column now has to
                bring its own `overflow-x-auto`, which is the correct place for
                it — the TABLE scrolls, not the page. */}
            <main
              className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-clip"
              style={{ background: 'var(--pf-wash)' }}
              data-lenis-prevent
            >
              {/* ModuleLockGuard IS GONE (Phase 0, Task E). It rendered a
                  "this module is locked" screen in place of any page owned by a
                  MODULES entry in `lockedModules` — chrome for a module
                  launcher that no longer exists, on routes the new rail no
                  longer offers. The per-org `lockedModules` READ stays on the
                  session (inert until Phase 6) and `loadReviewQueue` still
                  honours it, so a locked module contributes nothing to the
                  Review queue exactly as before.

                  TrialGate stays: expiry is a fact about the account, not about
                  the IA, and it gates every route the same way it always did. */}
              <TrialGate>{children}</TrialGate>
            </main>
          </div>
        </div>
      </FinchChatProvider>
    </PlatformProvider>
  );
}
