# Implementation — Phase 0: Teardown & Shell

**Plan:** `.ai/plan_phase0_teardown_shell.md` (parent: `PLAN.md`, approved 2026-08-31; chat-preservation amendment 2026-09-01).
**Worktree:** `.claude/worktrees/phase0-teardown-shell`, branch `feature/phase0-teardown-shell`, base `origin/main @ 16eb8c7`.
**Status:** Tasks A–E complete, everything staged, **nothing committed**.

All four verification commands pass (details at the end).

---

## Task A — Dead-code deletions

Deleted, all confirmed importer-free before removal:

- `components/platform/vyso-ai/` — `VysoAIModal`, `VysoAIOrderPrefill`, `VysoAIButton`, `VysoAILauncher`, `BouncingDots`
- `lib/ai/vyso-agent/` — `config`, `knowledge`, `name-match`, `order-handoff`, `orderflow-data`, `runtime`, `tools`
- `components/platform/ComingSoon.tsx`, `ModuleSkeleton.tsx`, `DocumentsTable.tsx`, `MarketingAuth.tsx`,
  `orderflow/CustomersManager.tsx`, `orderflow/InvoicingView.tsx`, `procurepulse/ProductsManager.tsx`,
  `brief/BriefChatPill.tsx`
- `hooks/useCountUp.ts`, `hooks/useInView.ts`, `hooks/useShaderHueShift.ts` (`useGridNavigation.ts` kept)
- `lib/utils.ts`; `clsx` and `tailwind-merge` removed from `package.json` dependencies, lockfile refreshed
  (`shadcn` devDep and `components.json` untouched)
- `app/api/ai/message/route.ts`, `app/api/integrations/xero/status/route.ts`
- Root stray images: `automate.png`, `build asset.png`, `diagnose asset.png`, `image.png`, `image 2.png`

Edited:

- `components/platform/RouteSkeleton.tsx` — dropped the "not to be confused with ModuleSkeleton" note
- `lib/platform/doc-watch/run.ts`, `app/api/agents/doc-watch/route.ts` — stale WhatsApp claims removed; email lane only

`/api/ai/agent/customers` and `/api/ai/agent/parse-order` were **kept** as the plan requires (chat-adjacent), even though
`VysoAIModal` was the only caller of the former.

## Task B — Canonical DDL reference

`supabase/canonical-documents.sql` (822 lines, untracked→staged). Header carries the required
"REFERENCE ONLY — … do not paste" wording. `CREATE TABLE IF NOT EXISTS` + RLS policies for the 11 tables named by
`supabase/verify-rls-state.sql`, with `documents` reconstructed as the union of the base schema and every
`alter table documents add column` across `supabase/*.sql`, including the current `documents_document_type_check`
(10 types + null) and `documents_status_check` value lists. 15 columns whose exact type could not be established from
source are flagged `-- VERIFY` rather than guessed silently.

---

## Task C — Review queue rehomed to `/app/review`

**Created** `app/app/review/page.tsx` — the old `app/app/chat/review/page.tsx`, minus the chat frame. Same server-side
queue read (`loadReviewQueue`), same `?item=` deep link read on the server, same empty state, same `ReviewChain`.
Dropped: `getOrCreateReviewChat`, `ChatView`, `ChatDropZone`. `ReviewChain`'s required `children` slot (which held the
transcript) is passed `null` — the chain itself is **not refactored**, per the plan.

**Redirect** `app/app/chat/review/page.tsx` → `redirect('/app/review')` (307/replace, not `permanentRedirect`: a 308
cached in every browser is not something to hand out while the IA is still moving). `?item=` is deliberately not
carried across — it is the pane's own within-visit `history.replaceState` parameter.

**Constant** `REVIEW_CHAT_ROUTE` → `'/app/review'` in `lib/platform/review-queue-shared.ts`. **Name kept**: the plan
allows the rename to `REVIEW_ROUTE` only if every reference moves with it, and one reference lives in
`FinchChatProvider.tsx`, which this phase keeps byte-identical. `tests/review-queue.test.ts:518` updated with the reason
in a comment.

**Rail** `RailReview` is now mounted from `RailNav` (it was inside `RailChats`, which is unmounted by Task D).
`RailChats` lost its `reviewCount` prop and its `RailReview`/`REVIEW_CHAT_ROUTE` imports; the file stays on disk.

## Task D — Chat UI disconnected (no chat code deleted)

- `app/app/layout.tsx` — `GlobalChatDock` unmounted; the `listChats` + `chatTimeLabel` read, the `suggestionsForOrg`
  read, `briefChatContext` and `reviewChatContext` all removed. **`FinchChatProvider` stays mounted.**
- `RailNav.tsx` — `RailChats` mount removed (rewritten wholesale in Task E).
- `app/app/chat/new/page.tsx` and `app/app/chat/[id]/page.tsx` → `redirect('/app')`. The `[id]` page no longer reads the
  chat at all, which leaks strictly less than the `notFound()` it replaces.
- `app/app/page.tsx` — `<OlderChats>` and its `listChats` read removed. Nothing else on the Brief changed (the
  `pb-[168px]` dock reservation is deliberately left as-is per the plan's "unchanged apart from OlderChats").
- `components/platform/brief/FindingDetail.tsx` — the three chat buttons removed ("Send to chat" ×2, "Draft a supplier
  email"), together with the machinery only they used: `useFinchChat`, `startChat`, the adopt-then-send effect,
  `askBrief`/`draftEmailPrompt`/`findingPrompt` imports, `usePlatform`/`useRouter`, `canChat`, and the three now-unused
  button class constants + the `AiMark` helper. Status writes, chart, recommendation and evidence untouched.
- `MobileDrawer`/`UserChipMenu` sign-out `useFinchChat().reset()` calls **kept**, as instructed.
- `FINCH_ENABLED`, `finchEnabled`, onboarding `StageData`, `FinchOrderPrefill` and every `/api/finch|ai/agent` route
  untouched. Everything under `components/platform/chat/`, `lib/ai/finch/`, `lib/platform/finch-*`, `app/api/finch/`,
  `app/api/ai/agent/` is byte-identical.

### FinchChatProvider prop decision

Props are now `context=""`, `orgName={session.org.name}`, `suggestions={[]}`, and `reviewContext` **omitted** (it
defaults to `''`).

Reasoning, after reading `lib/platform/review-queue.ts` and `review-queue-shared.ts`: `reviewChatContext(queue)` builds a
prelude string that is consumed in exactly one place — `FinchChatProvider.send()`, on the first user turn when
`pathname === REVIEW_CHAT_ROUTE`. `ReviewChain` consumes the **queue** (`queue.items`, read server-side by the page),
never the prelude; its only provider dependency is `setReviewFocus`, which is a plain state setter and works with empty
props. With no composer anywhere in the build, `send()` cannot be called at all, so every one of these props would be
serialised into a client component that can never use them — `context` in particular would ship a page of supplier names
and rand figures across the RSC boundary for nothing. `reviewChatContext` remains exported and tested, ready to be
re-passed the day a composer returns.

## Task E — New nav, stubs, upload button, gating removal

**New** `components/platform/shell/nav-config.ts` — `NAV_ITEMS` (Overview `/app` · Stock & Suppliers `/app/stock` ·
Sales & Customers `/app/sales` · Fleet `/app/fleet` · Services & Expenses `/app/expenses` · Staff `/app/staff` ·
Compliance `/app/compliance` · Documents `/app/documents` · Review `/app/review` · Settings `/app/settings`) plus
`isNavActive()`. No hooks, no `'use client'` — a server rail and two client components import it. Icons are SVG path
data; Overview and Review carry `icon: null` because they draw their own mark.

**Rewired**

- `RailNav.tsx` — rewritten around `NAV_ITEMS`. Overview keeps the gradient live dot and the `openCount` badge; Review
  renders `RailReview`. No `useSearchParams` any more.
- `AppRail.tsx` — `UnderTheHood` and the `Suspense` boundary removed (nothing reads the query string now); `chats`,
  `historyCount` and `modules` props dropped; `UploadButton` added to the logo row.
- `MobileTopBar.tsx` — same prop trim; `UploadButton` added between the trial pill and the menu button.
- `MobileDrawer.tsx` — module list, `lockedModules`, `lockedLabel` state and the `ModuleLockNotice` mount removed;
  `RailNav` and the Plugins section kept.
- `app/app/layout.tsx` — `<ModuleLockGuard>` wrapper removed, `TrialGate` kept.

**Deleted** (zero importers afterwards): `components/platform/ModuleLockGuard.tsx`,
`components/platform/ModuleLockNotice.tsx`, `components/platform/shell/UnderTheHood.tsx`.
`components/finch/UnderTheHood.tsx` — a **different**, marketing-homepage component — is untouched.

**Stub pages** (7, all server components): `app/app/{stock,sales,fleet,expenses,staff,compliance,documents}/page.tsx`,
each rendering the new `components/platform/PhaseStub.tsx` (`ModuleHeader` + `SectionCard` titled "Coming in Phase N",
a lede, and "Working today" links). Phase numbers come from `PLAN.md`: stock 1, documents 2, sales 3, expenses 4,
staff/fleet/compliance 5. Links: stock → `/app/procurepulse/stock`, `/app/suppliers`; sales → `/app/orderflow/orders`,
`/invoices`, `/customers`; documents → `/app/docu`, `/app/docu/upload`; staff → `/app/shiftboard`; expenses, fleet and
compliance have **no** links, because nothing in the platform holds that data yet.

**Settings** `app/app/settings/page.tsx` gains pointer rows to `/app/plugins` (behind the same `canSeeMoney` gate the
plugin routes use) and `/app/docu/databases`. The `/app/organisation` row already existed.

**Upload** new `components/platform/shell/UploadButton.tsx` → `/app/docu/upload`, styled on `PrimaryAction`'s tokens
(`--pf-accent-strong` / `--pf-accent-deep` / `--pf-radius-control`) at 36px instead of 42px. Mounted top-right in
`AppRail` and in `MobileTopBar`.

Old module routes (`/app/orderflow`, `/app/procurepulse`, `/app/docu`, …) are all still reachable and un-navigated. No
SQL applied. `/app` is still the Brief, with no redirect.

---

## Deviations from the plan, and why

1. **`REVIEW_CHAT_ROUTE` keeps its name.** The plan offered the `REVIEW_ROUTE` rename "if all references are updated";
   one of them is in `FinchChatProvider.tsx`, which the scope amendment freezes. Value moved, name stayed.
2. **`reviewContext` is not passed to the provider.** Plan D1 said "keep `reviewChatContext` if `/app/review` still
   consumes it" — verified that it does not (see the prop decision above).
3. **`components/platform/PhaseStub.tsx` was introduced.** The plan says "each a server component using ModuleHeader +
   SectionCard"; seven copies of the same twenty lines is seven places to fix one spacing bug, so the shape lives in one
   presentational component and each page is content only. No new pattern — it is the module layouts' page frame.
4. **`historyCount` and `modules` props were removed from the rail chain, not just left unused.** With History and the
   module launcher gone, passing them would have been dead plumbing and would have kept `railModules()` in the layout
   for no consumer. The server-side `lockedModules`/`features` **reads** on the session are untouched, as the plan
   requires (`loadReviewQueue` and the four redirect call sites still use them).
5. **The `Suspense` boundary around `RailNav` was removed** (not named in the plan). It existed solely because RailNav
   called `useSearchParams()`; no row reads the query string now.
6. **Stale comments were corrected** in `shell-data.ts`, `UserChipMenu.tsx`, `app/app/page.tsx` and `RailChats.tsx`
   where they referred to deleted files (`ModuleLockGuard`, `ModuleLockNotice`, `UnderTheHood`) or to reads that no
   longer happen. No behaviour change.
7. **`FindingCard`'s "✦ Discuss" button was removed** (`components/platform/brief/FindingCard.tsx`) — approved as a
   follow-up after it was first flagged below, on the grounds that it is chat UI and falls under Task D's spirit. Only
   the render went, plus the three bindings nothing else used (`canDiscuss`, the `discuss` handler, and the
   `email`/`finchEnabled` destructure that fed the gate — `usePlatform` is still imported for `useStatusWrite`'s own
   `org` read). `askBrief`/`findingPrompt` in `brief-chat.ts` are untouched and `FinchChatProvider` still subscribes to
   that channel, so restoring the affordance is restoring one `<button>`. Dismiss keeps its `ml-auto` and now sits
   alone in the action row.

## Open items handed back to Josh

1. ~~**`FindingCard`'s "Discuss" button is still on the Brief.**~~ **RESOLVED** — approved as a follow-up and removed;
   see Deviation 7. Nothing on the Brief now points at a composer that does not exist.
2. **The Review row disappears when the queue is empty.** `RailReview` renders `null` at `count === 0` by design
   ("it only exists when there is something to do"), and the plan asked for the badge "via existing RailReview", so
   that behaviour was preserved verbatim. The consequence in the new IA is that one of ten nav rows is intermittent, and
   `/app/review`'s "all clear" screen is then only reachable by URL. Worth a decision.
3. **`ReviewChain` still says "When these are done this chat closes itself."** (`ReviewChain.tsx:576`) — copy left over
   from the chat era, on a page with no chat. The plan says not to refactor the chain, so it stands.
4. **`docs/demo-loom-script.md:281` and `docs/demo-runbook.md:144` still name `/app/chat/review`.** They redirect
   correctly, so nothing is broken; the paths are simply out of date.
5. **The worktree has no `.env.local`**, so `npm run build` fails at page-data collection with
   `Missing API key. Pass it to the constructor new Resend(...)`. The build below was run with the main checkout's
   `.env.local` symlinked in temporarily; the symlink was removed afterwards.

## Verification (run in the worktree)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | clean, no output |
| `npm run lint` | **82 problems (44 errors, 38 warnings)** — identical to the pre-existing baseline. Every file listed is one this phase did not touch (wastewatch, price-watch, pricepilot, orderflow, docu, coredata, supplysync, shiftboard, planwise, serviceden, `module-ui.tsx`, plus two `.ai/design` bundles). **No new errors.** |
| `npm test` | `node --test tests/*.test.ts` — **1514 pass, 0 fail** (up from 1490 in the plan's note; the review-queue route assertion is the one this phase changed) |
| `npm run build` | succeeds. Route manifest lists `ƒ /app/review`, `ƒ /app/stock`, `/app/sales`, `/app/fleet`, `/app/expenses`, `/app/staff`, `/app/compliance`, `/app/documents`, and the three redirecting chat routes. |

Manual dev-server checks from the plan's verification section were **not** run (they need a signed-in session).
