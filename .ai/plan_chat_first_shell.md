# Plan: Chat-first platform shell (`feat/ui-brief-reskin`)

Status: **AWAITING JOSH'S APPROVAL — do not implement.**
Architect: Fable. Implementers: subagents per `Claude_Rules.md`, one wave at a time, commit after every green wave.

---

## 1. Goal

The chat interface IS the platform. Concretely:

1. TopBar (and its hamburger `ModulesOverlay`) stops being the primary navigation on every `/app/*` route.
2. The Brief's 216px left rail is promoted from page-local (`app/app/page.tsx`) to shell-level (`app/app/layout.tsx`) so it persists across all platform screens. Its "UNDER THE HOOD" module section sits bottom-left, **collapsed by default**, expanding upward with token-driven motion. Modules are deliberately secondary.
3. Module screens keep their exact routes, chrome, and functionality — they render inside the new shell as secondary surfaces. No module rewrites.
4. The Finch chat pill (compact variant on module screens) persists across all `/app/*` routes; chat turns survive client-side navigation.

### Acceptance criteria

- No route under `/app/*` renders TopBar; every route renders the rail (≥`lg`) or the mobile header+drawer (<`lg`).
- Every function TopBar performed is reachable in the new shell (inventory in §3 — nothing dropped without sign-off).
- The Brief page looks per the mock (rail + feed + pill), now with the rail owned by the layout.
- Module screens (Doc-U, OrderFlow, PlanWise, PricePilot, ProcurePulse, InsightGen, ServiceDen, ShiftBoard, SupplySync, WasteWatch, Organisation, Settings, Notifications) render unchanged inside the shell; their own `ModuleHeader`/`SubNav` chrome is untouched.
- Under-the-hood expands/collapses with `tokens/motion.css` durations/eases, respects `prefers-reduced-motion`.
- Chat pill is present on every `/app/*` screen; conversation state survives navigation between routes.
- `/login`, `/onboarding`, marketing site: byte-for-byte behaviourally unchanged. TrialGate hard-lock still leaves sign-out reachable. ModuleLockGuard + ModuleLockNotice still work.
- `npm run test`, `npm run lint`, `npx tsc --noEmit` green per wave (pre-existing whatsapp-ingest / wastewatch / vyso-ai failures exempt).

---

## 2. Verified context (from repo research, 2026-08-14)

- `app/app/layout.tsx:45` is TopBar's **only** mount point in the repo. Layout is flexbox (`h-screen flex-col`; TopBar `shrink-0`; `<main>` `flex-1 overflow-y-auto` carrying `--pf-wash`). **No module pads for TopBar height** — the only `--pf-topbar-h` consumer is `BriefRail.tsx:53`'s sticky `calc()`.
- Guards: `PlatformProvider` wraps everything; `TrialGate > ModuleLockGuard > {children}` sit **inside** `<main>`, below TopBar, so sign-out stays reachable during a hard lock. The new shell must preserve that relationship (rail outside the gates).
- `BriefRail` is a **server component**, all data via props (`view`, `openCount`, `historyCount`, `modules`, `userInitials`, `userLabel`); nav is plain `<Link>`s. Hidden below `lg` today — the TopBar hamburger is the de facto mobile nav; there is **no mobile drawer component anywhere** to reuse.
- `BriefChatPill` is `'use client'`, state (`turns`) is page-local `useState` → **resets on navigation**. It needs only `usePlatform()` (already global). It talks SSE to `POST /api/ai/agent` with `{messages, module:'brief', orgName}`, findings-context prefixed onto turn 0 only. Tap-a-finding uses the single-subscriber pub/sub in `brief-chat.ts` (`askBrief`/`onBriefAsk`) — safe with exactly one mounted pill.
- Next 16.2.7 (read `node_modules/next/dist/docs/` before writing route/layout code — AGENTS.md): **layouts persist and do not re-render on client-side navigation** — the correct home for a persistent rail + chat state. Route awareness (active nav item) must come from a `'use client'` child using `usePathname()`/`useSearchParams()`. Never `template.tsx` (remounts every nav). `router.refresh()` re-fetches the whole tree including the layout (this is how the findings badge refreshes after dismiss — `FindingCard` already calls it).
- A second, older Finch surface exists: `FinchLauncher` (`FinchButton`+`FinchModal`, blue chrome) mounted in `app/app/orderflow/layout.tsx` (SubNav right slot) and `components/platform/docu/DocuNav.tsx`. It has module-specific tools (OrderFlow order creation + localStorage order-handoff). See decision D3.
- `components/platform/Sidebar.tsx` is confirmed dead code (zero imports; stale import path).
- Design source: `.ai/design/vyso-brief/Vyso - The Brief.dc.html` (verified byte-identical to the live claude.ai/design project on 2026-08-14) + `_ds/.../readme.md` + `tokens/*.css`. Design/token deviations catalogued in §7.

---

## 3. TopBar inventory → rehoming map

Every behaviour in `components/platform/TopBar.tsx`, and where it lives in the new shell:

| # | TopBar function (file:line) | New home |
|---|---|---|
| 1 | Hamburger → `ModulesOverlay` (95-106, 217) | **Replaced** by rail's UNDER THE HOOD section (desktop) and mobile drawer (<`lg`). Overlay deleted in cleanup wave W5. |
| 2 | Logo link → `/app/docu` (108-110) | Rail `VysoMark` → **`/app`** (the Brief is home now — deliberate change). |
| 3 | "You are here" module label (112-114) | **Dropped.** Module identity is carried by each module's own `ModuleHeader` chrome + the rail's active module row. (Decision D5 — confirm.) |
| 4 | Trial pill → `/app/settings` (116-123) | Compact trial chip in the rail bottom cluster, directly above the user chip; same `trialPillLabel()` logic, links to `/app/settings`. In mobile drawer's footer. |
| 5 | Feedback button → `FeedbackModal` (126-131) | Item in the user-chip menu ("Send feedback"). `FeedbackModal.tsx` reused as-is. |
| 6 | Notifications link (133-148) | Item in the user-chip menu + rail: small bell icon-button in the bottom cluster (next to trial chip), `aria-current` styling on `/app/notifications*`. |
| 7 | Account menu: org header, My Organisation, Settings, Sign out (151-212) | User chip (avatar + "Name · Org", already in the rail design) becomes the menu trigger; menu **opens upward** (`vyso-pop-in`, transform-origin bottom-left) with the same items. Outside-click + Escape close preserved. |
| 8 | Sign out (`clearParsedOrder()` → `supabase.auth.signOut()` → `/login`) (77-85) | Moved verbatim into the user-chip menu. |
| 9 | `ModuleLockNotice` for locked modules (57, 219) | Rail module rows check `usePlatform().lockedModules` (same longest-prefix logic as `ModuleLockGuard`); clicking a locked row opens `ModuleLockNotice` instead of navigating. Modal reused as-is. |

Nothing else exists in TopBar (no shortcuts, breadcrumbs, org switcher, or direct API calls — verified).

---

## 4. Target architecture

### 4.1 `app/app/layout.tsx` (server component — modify)

```
<PlatformProvider value={session}>
  <div class="flex h-screen flex-row overflow-hidden ...">      ← was flex-col
    <AppRail … />                                               ← ≥lg, replaces TopBar; OUTSIDE the gates
    <div class="flex min-w-0 flex-1 flex-col">
      <MobileTopBar … />                                        ← <lg only, slim
      <main class="min-h-0 flex-1 overflow-y-auto relative" style={--pf-wash}>
        <TrialGate><ModuleLockGuard>{children}</ModuleLockGuard></TrialGate>
        <GlobalChatDock … />                                    ← pill overlay, inside <main>, outside gates? see §8 E6
      </main>
    </div>
  </div>
</PlatformProvider>
```

Layout additionally fetches (server-side, `Promise.all`): `fetchFindings(session.org.id)` → `openCount`, `historyCount`, and the `briefChatContext()` prelude for the pill. `fetchFindings` already tolerates a missing table; layout must too. Modules list = `MODULES` filtered by `session.features` (same derivation `page.tsx:75-78` uses today — lift it into a small helper so page and layout share it).

Staleness note: layouts don't re-render on soft navigation, so badge/context refresh on hard load and on any `router.refresh()` (which `FindingCard` dismiss already triggers). Accepted.

### 4.2 New components — `components/platform/shell/`

| File | Type | Responsibility |
|---|---|---|
| `AppRail.tsx` | server | 216px column: VysoMark → nav (Today's brief + live dot + open badge, History + badge) → `mt-auto` bottom cluster: UnderTheHood, trial chip + bell, UserChipMenu. Receives all data as props. `hidden lg:flex h-screen` (own column; **no more `--pf-topbar-h` calc**). Visual spec = mock 1a rail verbatim (widths, paddings, active/inactive states — see §2 digest values; use `--pf-*` tokens where they match). |
| `RailNav.tsx` | client | The two primary nav rows. Active state via `usePathname()` + `useSearchParams()` (`/app` + `?view=history`). |
| `UnderTheHood.tsx` | client | Collapsed-by-default section. Header row = "UNDER THE HOOD" eyebrow + chevron, toggles expansion **upward**. Module rows per mock (5px square dot, 12.5px muted text; active row `#EDEDEA` bg / dark dot via pathname prefix match). Locked rows → `ModuleLockNotice`. Motion per §5. Collapse state is component-local (`useState`, collapsed on every mount — per spec; no persistence in v1). |
| `UserChipMenu.tsx` | client | User chip trigger + upward-opening account menu (My Organisation, Settings, Notifications, Send feedback, Sign out). Ports TopBar's outside-click/Escape/signOut logic verbatim. Mounts `FeedbackModal` + `ModuleLockNotice`. |
| `MobileTopBar.tsx` + `MobileDrawer.tsx` | client | `<lg` only. Spec in §6. |
| `GlobalChatDock.tsx` | client | Persistent pill (compact on non-Brief routes). Spec in §4.3. |
| `shell-data.ts` | shared | `railModules(session)` helper (MODULES × features), module-from-pathname resolver (reuse `ModuleLockGuard`'s longest-prefix approach). |

`BriefRail.tsx` is superseded and deleted (W2). `app/app/page.tsx` drops the rail and keeps its centered feed column; it stops rendering `BriefChatPill` once the dock lands (W4).

### 4.3 Chat everywhere — `GlobalChatDock`

- **State**: new `FinchChatProvider` (client, mounted inside layout, wrapping `<main>`'s subtree or as sibling context above the dock) owning `turns/streaming/error` — lifted out of `BriefChatPill` so navigation doesn't reset the conversation. The SSE reader + abort logic moves verbatim; the pill becomes a view over the provider. The pub/sub (`onBriefAsk`) subscription moves to the provider level — still exactly one subscriber, so `FindingCard` tap-to-discuss keeps working unchanged.
- **Payload**: unchanged — `{messages, module:'brief', orgName}` with the findings prelude prefixed to turn 0 (prelude now supplied by the layout). No API changes.
- **Placement**: bottom-docked overlay inside `<main>` (absolute, `bottom:0`, fade-to-white scrim per mock), so it floats over module content and the wash. Transcript renders as an overlay panel above the pill (max-w 680px, `--pf-shadow-menu`-tier elevation) instead of relying on page-column flow.
- **Variants**: full pill (max-w 680, "Ask Vyso anything about your operation…") on `/app` (+ `?view=history`); **compact** variant on all other routes — same gradient ring (`AI_GRADIENT_CHROME`, 1.5px ring, ✦ glyph), narrower (max-w ~420px), no caption line; expands to full width on focus/first turn (`--dur-control` + `--ease-out-soft`). This is recommendation for decision D1.
- Gradient rule: this is a sanctioned expansion of the AI-voice gradient (5th placement). Update the rule comment in `brief-display.ts:5-11` accordingly.
- `FinchLauncher` in OrderFlow/Doc-U: **untouched in this task** (decision D3).

---

## 5. Motion spec (tokens from `_ds/.../tokens/motion.css`)

First, port the motion tokens into `app/globals.css` platform block (they were never copied over — only colors/radius/spacing/elevation were): `--dur-hover:.16s`, `--dur-fade:.18s`, `--dur-pop:.2s`, `--dur-control:.22s`, `--ease-standard:cubic-bezier(0.4,0,0.2,1)`, `--ease-pop:cubic-bezier(0.2,0.8,0.3,1)`, `--ease-out-soft:cubic-bezier(0.22,1,0.36,1)`. Also promote the mock's inline `vysoPulse` keyframe (`0%,100%{opacity:1} 50%{opacity:.55}`) as `vyso-pulse` (used by the rail live dot at 2.4s). Existing `.vyso-fade-in`/`.vyso-pop-in` already match the token values — reuse, don't duplicate.

| Element | Motion |
|---|---|
| Under-the-hood expand/collapse | Container: CSS grid `grid-template-rows: 0fr → 1fr` transition, `--dur-control` (0.22s) `--ease-out-soft`; inner list `opacity 0→1` at `--dur-fade` with ~40ms delay on expand, none on collapse. Chevron rotates 180° at `--dur-hover`. Rows do NOT stagger (sparse, physical — no cascade, no bounce, no spring). |
| User-chip menu open | `.vyso-pop-in` (0.2s `--ease-pop`) mirrored: `translateY(6px) scale(.985)` from bottom origin. Close: `--dur-fade` fade. |
| Mobile drawer | Slide-in `translateX(-100%)→0` at `--dur-control` `--ease-standard`; scrim `--pf-scrim` fades at `--dur-fade`. |
| Compact pill → full pill | width/max-width at `--dur-control` `--ease-out-soft`; no scale. |
| Hover states everywhere | `--dur-hover` ease (existing convention). |
| Continuous loops | ONLY AI-voice: rail live dot `vyso-pulse 2.4s`, streaming caret `1.1s steps(2)`. Nothing else loops (readme rule). |
| Reduced motion | Every new animation inside `@media (prefers-reduced-motion: reduce)` → none/instant (house convention). |

---

## 6. Mobile spec (<`lg`)

Recommendation (decision D2): **slim mobile header + left drawer**, chat pill persists.

- `MobileTopBar` (<`lg` only, ~56px, white/90 + blur like old TopBar): VysoMark (→ `/app`) · trial pill (`<sm` hidden) · menu button (right).
- Menu opens `MobileDrawer`: left slide-in sheet (~300px, `h-dvh`), containing the full rail content — nav rows, UNDER THE HOOD (**expanded by default** in the drawer; no collapse ceremony on mobile), trial chip, bell, user chip + account items inline (no nested popover). Scrim tap / Escape / route-change closes it.
- Chat pill: bottom-docked at all widths (mock 1e shows the mobile pill); compact variant on module screens, same as desktop.
- The Brief feed column already stacks fine below `lg` (rail was hidden there today; nothing else changes).
- `ModulesOverlay` becomes unused after this and is deleted in W5.

---

## 7. Design/token deviations to resolve (implementer follows these rulings)

| Conflict | Ruling |
|---|---|
| Rail width: mock 216px vs `--pf-sidebar-w:248px` | **216px wins** (mock). Update `--pf-sidebar-w` to 216px, rail consumes the var. Mirror in `lib/platform/tokens.ts` if the value exists there (check consumers first — token currently has zero consumers). |
| Wash: mock `#FBF9F6→#FFF 420px` vs `--pf-wash` `#F3F8FF→#FFF 340px` | **Keep `--pf-wash` as-is** (changing it re-tints all 9 modules — out of scope). The Brief page may keep its current wash treatment unchanged. Flagged, not changed. |
| Chat-pill shadow `rgba(31,95,168,.25)` blue-tint vs `--pf-shadow-menu` | Keep the pill's bespoke blue shadow inline (it's an AI-voice moment), as `BriefChatPill` already does. |
| `--pf-topbar-h:66px`, `--pf-nav-h:64px` | TopBar gone: `--pf-topbar-h`'s only consumer (`BriefRail.tsx:53`) is deleted with it. Keep the vars defined (mobile header may reuse `--pf-topbar-h` at a new value ~56px) — implementer sets it to the mobile header height and consumes it there; delete `--pf-nav-h` reference nowhere → leave untouched. |
| Mock hover shadow vs `--pf-shadow-card-hover` | Not this task's surface (finding cards already shipped). No change. |

---

## 8. Edge cases

- **E1 TrialGate hard lock**: rail renders outside `TrialGate`, so sign-out (user chip) stays reachable when the trial lock screen replaces `children` — same guarantee TopBar gave. Mobile: `MobileTopBar`+drawer also outside the gates.
- **E2 Locked modules**: rail rows and drawer rows must use `lockedModules` prefix-matching; locked click → `ModuleLockNotice`, no navigation. `/app`, organisation, settings, notifications, serviceden never lock (not in `MODULES`) — unchanged.
- **E3 ServiceDen**: not in `MODULES`, email-gated. It does not appear in UNDER THE HOOD (same as today's rail). Its route still renders inside the shell; the rail simply shows no active module row there. (TopBar's label special-case dies with the label — D5.)
- **E4 History view**: active-state logic needs `useSearchParams()` (`?view=history`) — client-only; wrap in `<Suspense>` if Next 16 requires it for `useSearchParams` in a static shell (implementer: check the Next docs note on `useSearchParams` bailout).
- **E5 Pill vs module content overlap**: bottom-docked pill overlays module tables/footers. The scrim fade (mock 1a) mitigates; do NOT add global bottom padding to modules (no module edits). Compact pill minimizes footprint. If a specific module's sticky footer collides (ShiftBoard/OrderFlow drawers), the drawer/modal z-index must sit above the dock — set dock `z-20`, below `z-30+` chrome/modals.
- **E6 Pill during trial lock / module lock**: pill must NOT bypass gating. Mount `GlobalChatDock` gated by the same `trial?.expired` check (hidden when hard-locked); `finchEnabled === false` → dock renders nothing (existing pill behaviour preserved).
- **E7 Chat state vs sign-out**: sign-out clears parsed-order draft today; also abort any in-flight stream and clear the chat provider state on sign-out.
- **E8 Streaming across navigation**: with state in the provider, an in-flight SSE stream continues across route changes (component stays mounted in the layout). Abort-on-unmount logic moves to provider teardown only.
- **E9 `router.refresh()` from FindingCard**: re-renders layout server components → fresh badge counts; must not remount `FinchChatProvider` (client state survives refresh — it does, refresh preserves client component state; verify in W4 testing).
- **E10 Brief page duplicate guards**: `page.tsx` re-runs `getPlatformSession()` deliberately — leave as-is.
- **E11 `/login`, `/onboarding`, marketing**: outside `app/app/layout.tsx` — untouched by construction. Verify visually anyway (W6).
- **E12 Reduced motion / a11y**: drawer + menus need focus trap parity with today's overlay (`ModulesOverlay` had `role="dialog" aria-modal`); rail nav is `<nav>` with `aria-current`; under-the-hood toggle is a `<button aria-expanded>`.

---

## 9. Files

**Create**: `components/platform/shell/AppRail.tsx`, `RailNav.tsx`, `UnderTheHood.tsx`, `UserChipMenu.tsx`, `MobileTopBar.tsx`, `MobileDrawer.tsx`, `GlobalChatDock.tsx`, `FinchChatProvider.tsx`, `shell-data.ts`.

**Modify**: `app/app/layout.tsx` · `app/app/page.tsx` · `app/globals.css` (motion tokens + `--pf-sidebar-w`) · `components/platform/brief/BriefChatPill.tsx` (state → provider; or superseded by `GlobalChatDock` reusing its internals) · `components/platform/brief/brief-display.ts` (gradient rule comment) · `lib/platform/tokens.ts` (only if a mirrored value changes).

**Delete**: `components/platform/brief/BriefRail.tsx` (W2) · `components/platform/TopBar.tsx`, `components/platform/ModulesOverlay.tsx`, `components/platform/Sidebar.tsx` (dead) — all in W5 cleanup only, after the shell is verified.

**Keep/reuse untouched**: `FeedbackModal.tsx`, `ModuleLockNotice.tsx`, `TrialGate.tsx`, `ModuleLockGuard.tsx`, `VysoMark`, `FindingCard.tsx`, `brief-chat.ts`, all module layouts/chromes, `lib/ai/finch/*`, `app/api/ai/agent/route.ts`.

**Never touch**: `vercel.json`, `app/api/whatsapp/**`, `lib/platform/whatsapp-*`, `docs/whatsapp-ordering.md`, `supabase/whatsapp-ingest.sql`, `tests/whatsapp.test.ts`, `.ai/plan_demo-pricelist-fixes.md`, `public/serviceden-logo-concept.svg` (uncommitted WIP — never stage), marketing site (`components/marketing|sections|ui`, marketing `globals.css` sections), module data layers, routes (no renames).

**Data/API/interface changes**: none server-side. `POST /api/ai/agent` contract unchanged. New client context (`FinchChatProvider`) and new props flowing layout→rail are the only interface additions. `RailModule` interface moves from `BriefRail.tsx` to `shell-data.ts`.

---

## 10. Waves (each: implement → verify → commit `shell(wN): …`)

- **W0** — Commit this plan. (`shell(w0): plan chat-first shell`)
- **W1 — Motion + shell components (no wiring)**: port motion tokens into `globals.css`; build all `components/platform/shell/*` except `GlobalChatDock`/`FinchChatProvider`, rendered nowhere yet. tsc/lint green; zero visual change.
- **W2 — Desktop shell swap**: rewrite `app/app/layout.tsx` (flex-row, `AppRail`, gates preserved, layout data fetch); delete `BriefRail.tsx` + its usage from `page.tsx`; TopBar still renders **only** `<lg` (temporary `hidden lg:flex` / `lg:hidden` split so mobile never breaks mid-migration). Verify all 13 route groups desktop.
- **W3 — Mobile**: `MobileTopBar` + `MobileDrawer` replace TopBar `<lg`; TopBar unmounted everywhere (file still present). Verify 390px width.
- **W4 — Chat everywhere**: `FinchChatProvider` + `GlobalChatDock` (full/compact variants); `page.tsx` stops mounting `BriefChatPill`; tap-a-finding regression-checked; E5–E9 verified.
- **W5 — Cleanup**: delete `TopBar.tsx`, `ModulesOverlay.tsx`, `Sidebar.tsx`; sweep stale comments (`--pf-topbar-h` references, brief-display gradient rule); update `.ai/implementation.md`.
- **W6 — Full verification** (§11) + screenshots to Josh.

---

## 11. Verification (every wave; full pass in W6)

```
npm run test
npm run lint
npx tsc --noEmit        # pre-existing whatsapp-ingest/wastewatch/vyso-ai failures exempt
npm run dev             # port 3000
```

Visual (dev server, signed in): screenshots at **1440px** and **390px** of: `/app` (Brief: rail active, under-the-hood collapsed → expanded, pill), `/app?view=history`, `/app/docu`, `/app/orderflow` (compact pill + FinchLauncher coexistence), `/app/suppliers` (active module row), `/app/settings`, user-chip menu open, mobile drawer open, chat mid-stream on a module screen then navigate → transcript persists. Plus `/login`, `/onboarding`, and marketing home unchanged. Reduced-motion spot check (emulate via devtools).

---

## 12. Decisions for Josh (recommendations marked ✦ — nothing implemented until you rule)

- **D1 — Compact chat entry on module screens**: ✦ (a) compact centered pill (~420px, gradient ring, ✦ glyph, expands on focus). Alternatives: (b) full 680px pill everywhere; (c) floating ✦ button bottom-right that unfurls into the pill. The mock's module screen (1d) shows no pill, so this is net-new design either way.
- **D2 — Mobile navigation**: ✦ slim top strip + left slide-in drawer holding the full rail content (§6). Alternatives: bottom-sheet nav, or keep a hamburger→modal like today. (Bottom tab bar rejected — foreign to the design language.)
- **D3 — `FinchLauncher` (OrderFlow/Doc-U button+modal)**: ✦ leave untouched this task (module surfaces are out of scope; the global pill is `module:'brief'`, text-only, no tools). Follow-up task: make the dock module-aware (pass pathname-derived `module` so OrderFlow keeps its order tools) and retire `FinchLauncher`. Alternative: retire it now inside this task (touches module layouts — scope creep).
- **D4 — Finding-count badges on the rail**: ✦ yes — "Today's brief" keeps the orange open-count badge, "History" keeps its count (layout-fetched; stale between hard loads/`router.refresh()` — acceptable). Alternative: live dot only, no numbers.
- **D5 — TopBar's "you are here" module label**: ✦ drop it (module chrome + active rail row carry identity). Alternative: echo the module label at the top of `<main>` — but that adds chrome this redesign exists to remove.
- **D6 — Under-the-hood default on desktop after user expands**: spec says collapsed by default. ✦ collapsed on every mount, no persistence. Alternative: remember expansion per session (sessionStorage).

---

*Prepared 2026-08-14 by Fable (architect). Sources: repo research reports (TopBar/routes, Brief/Finch, design bundle, plans+Next docs) — see session log; design verified against claude.ai/design project `ccbf2dff` same day.*
