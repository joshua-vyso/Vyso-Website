# Plan: Phase 0 — Teardown & Shell (restructure kickoff)

**Parent plan:** `PLAN.md` (repo root), approved 2026-08-31. **Scope amendment from Josh (2026-09-01): chat code is PRESERVED — only its UI is disconnected.** No chat file deletions, no `finch_chats`/`finch_messages` drops.

**Worktree:** `.claude/worktrees/phase0-teardown-shell` (branch `feature/phase0-teardown-shell`, base = origin/main @ 16eb8c7). All edits happen there.

## Goal & acceptance criteria

1. Dead non-chat code removed; `tsc`, lint, tests, build all pass.
2. Reference DDL for the 11 dashboard-only tables exists at `supabase/canonical-documents.sql` (documentation, NOT to be pasted).
3. Review queue lives at `/app/review`; `/app/chat/review` redirects to it; approvals work unchanged.
4. No chat UI is reachable (no dock, no rail chats, no chat pages), but every chat component/lib/API file remains in the repo and compiles.
5. Rail shows the new IA: Overview (Brief, unchanged at `/app`) · 7 new pages (stub-level) · Review · Settings; module launcher and lock UI gone; global Upload button top-right on desktop rail and mobile top bar.
6. Old module routes remain reachable by direct URL (un-navigated). No Supabase SQL is applied in this phase.

## Constraints / files NOT to touch

- Anything under `components/platform/chat/`, `lib/ai/finch/`, `lib/platform/finch-*`, `app/api/finch/`, `app/api/ai/agent/` — **keep intact** (except the two thin chat *page* wrappers listed below, which become redirects; their view components stay).
- Marketing pages (`app/` top-level non-app routes, `app/orbit/`, `lib/marketing/`, `lib/orbit/`), `proxy.ts`, the docu extraction engine (`lib/platform/docu/`, `lib/ai/anthropic.ts`), email/Graph ingest, ServiceDen, plugins, onboarding flow (except noted), mobile app, `desktop/`, `tmp/`, `Assets/`, `.ai/`, all `supabase/*.sql` existing files.
- Do not remove `TrialGate` (Open Q2 pending) or the Brief (`app/app/page.tsx`, Open Q1 pending).
- Do not delete `/api/ai/agent/parse-order` or `/api/ai/agent/customers` (chat-adjacent — preserved with chat).

## Task A — Dead-code deletions (non-chat only)

Delete files (verify zero importers before each deletion; if an importer exists, stop and report instead of adapting):
- `components/platform/vyso-ai/` (entire dir: VysoAIModal, VysoAIOrderPrefill, VysoAIButton, VysoAILauncher, BouncingDots)
- `lib/ai/vyso-agent/` (entire dir)
- `components/platform/ComingSoon.tsx`, `components/platform/ModuleSkeleton.tsx` (remove the comment reference in `RouteSkeleton.tsx`), `components/platform/DocumentsTable.tsx`, `components/platform/MarketingAuth.tsx`, `components/platform/orderflow/CustomersManager.tsx`, `components/platform/orderflow/InvoicingView.tsx`, `components/platform/procurepulse/ProductsManager.tsx`, `components/platform/brief/BriefChatPill.tsx`
- `hooks/useCountUp.ts`, `hooks/useInView.ts`, `hooks/useShaderHueShift.ts` (keep `useGridNavigation.ts`)
- `lib/utils.ts`; remove `clsx` and `tailwind-merge` from `package.json` dependencies (run `npm install` after to refresh lockfile; keep `shadcn` devDep and `components.json` untouched)
- API route `app/api/ai/message/route.ts` and `app/api/integrations/xero/status/route.ts`
- Root stray images: `automate.png`, `build asset.png`, `diagnose asset.png`, `image.png`, `image 2.png`
- Fix stale WhatsApp comments in `lib/platform/doc-watch/run.ts:13` and `app/api/agents/doc-watch/route.ts:16,36` (remove the WhatsApp claim; email lane only)

Edge cases: `VysoAIModal` was the only caller of `/api/ai/agent/customers` — the route stays anyway (chat-preserved). If `tsc` reveals any other importer of a deleted file, restore the file and report.

## Task B — Canonical DDL reference

Create `supabase/canonical-documents.sql`, header comment: "REFERENCE ONLY — these tables already exist in production (created via dashboard); do not paste. Reconstructed 2026-09-01 from Vyso Platform/supabase/schema.sql + the ALTER statements across this directory."
Contents: `CREATE TABLE IF NOT EXISTS` + RLS policy statements for the 11 tables listed by `supabase/verify-rls-state.sql` (`profiles`, `organisations`, `org_features`, `documents`, `document_folders`, `suppliers`, `pp_stock_items`, `pp_movements`, `pp_item_suppliers`, `pp_notifications`, `pp_settings`), with `documents` as the union of the base schema plus every `alter table documents add column` found in `supabase/*.sql` (docu-review-columns, microsoft-graph-ingest, email-ingest, docu-credit-document-types, of-order-source-doc, demo-all-in-one status/type constraint repairs, etc.), including the current `documents_document_type_check` (10 types + null) and `documents_status_check` value lists. Mark any column whose exact type is uncertain with a `-- VERIFY` comment rather than guessing silently.

## Task C — Rehome the review queue to /app/review

1. Create `app/app/review/page.tsx` from the current `app/app/chat/review/page.tsx` content (server component hosting `components/platform/review/*`), minus any chat-frame coupling.
2. `app/app/chat/review/page.tsx` → `redirect('/app/review')`.
3. `lib/platform/review-queue-shared.ts`: `REVIEW_CHAT_ROUTE` → `'/app/review'` (rename to `REVIEW_ROUTE` only if all references are updated; otherwise keep the name). Update `tests/review-queue.test.ts` assertion (line ~518).
4. `components/platform/shell/RailReview.tsx` is currently mounted from `RailChats.tsx`: mount `RailReview` directly from `RailNav.tsx` instead.
5. `components/platform/review/ReviewChain.tsx` uses `useFinchChat().setReviewFocus` — FinchChatProvider stays mounted (Task D), so this keeps working unchanged. Do not refactor it.

## Task D — Chat UI disconnect (code preserved)

1. `app/app/layout.tsx`: stop rendering `<GlobalChatDock/>`; stop passing chat props; **keep `FinchChatProvider` mounted** (it is a context provider; the dock was the visible surface) so `ReviewChain`/`OrdersView` hooks keep working. Remove the `listChats` + `suggestionsForOrg` layout reads and the `chatContext` plumbing that only fed the dock; keep `reviewChatContext` if `/app/review` still consumes it.
2. `RailNav.tsx`: remove the `RailChats` mount (file itself stays).
3. `app/app/chat/new/page.tsx` and `app/app/chat/[id]/page.tsx` → `redirect('/app')`. View components under `components/platform/chat/` remain untouched.
4. `app/app/page.tsx` (Brief): remove the `<OlderChats>` render + its read; `components/platform/brief/FindingDetail.tsx`: remove the "Ask Finch"/"Send to chat" buttons (UI only; leave the rest).
5. `MobileDrawer.tsx`/`UserChipMenu.tsx`: keep the `useFinchChat().reset` sign-out calls (provider still mounted — they're harmless and preserve behaviour).
6. Do NOT touch `FINCH_ENABLED`, `finchEnabled`, onboarding `StageData`, `OrdersView`'s `FinchOrderPrefill`, or any `/api/finch|ai/agent` route.

## Task E — New nav, stubs, upload button, gating removal

1. New static nav config (replace module-driven rail): Overview `/app` · Stock & Suppliers `/app/stock` · Sales & Customers `/app/sales` · Fleet `/app/fleet` · Services & Expenses `/app/expenses` · Staff `/app/staff` · Compliance `/app/compliance` · Documents `/app/documents` · Review `/app/review` (badge via existing RailReview) · Settings `/app/settings`. Implement as a new `components/platform/shell/nav-config.ts`; rewire `AppRail`/`RailNav`/`MobileDrawer` to it. Remove `UnderTheHood` mount from `AppRail` and the module list from `MobileDrawer` (files stay on disk this phase only if still imported elsewhere; otherwise delete `UnderTheHood.tsx`).
2. Remove `ModuleLockGuard` wrapper from `app/app/layout.tsx` (keep `TrialGate`). Leave server-side `lockedModules`/`moduleOpen` reads as-is (inert; Phase 6 cleanup). `ModuleLockGuard.tsx`/`ModuleLockNotice.tsx` may be deleted if nothing else imports them after the rewire.
3. Stub pages for the 7 new routes: each a server component using `ModuleHeader` + `SectionCard` ("Coming in Phase N") with links to the current surfaces that will fold in (stock → `/app/procurepulse/stock`, `/app/suppliers`; sales → `/app/orderflow/orders`, `/app/orderflow/invoices`, `/app/orderflow/customers`; documents → `/app/docu`; expenses/staff/fleet/compliance → placeholder text). `/app/settings` page already exists — add links to `/app/plugins`, `/app/organisation`, `/app/docu/databases` on it.
4. Global Upload button: a top-right control in `AppRail` (desktop) and `MobileTopBar` (mobile) linking to `/app/docu/upload` (Phase 1 replaces this with the tray + `/api/ingest`). Style with `--pf-accent` tokens matching existing `PrimaryAction`.
5. `/app` stays the Brief (Open Q1); no redirect this phase.

## Interface changes

- `REVIEW_CHAT_ROUTE` value change ('/app/chat/review' → '/app/review').
- `app/app/layout.tsx` prop flow loses chat lists; `PlatformSession` unchanged.
- No DB/API contract changes. Two API routes deleted (`/api/ai/message`, `/api/integrations/xero/status`) — both caller-less.

## Ordered steps

1. Task A (deletions) + Task B (DDL) — independent.
2. Task C (review rehome) → Task D (chat UI disconnect) → Task E (nav/stubs/button/gating) — sequential, they touch the same shell files.
3. Verification; fix fallout; report deviations in `.ai/implementation_phase0_teardown_shell.md`.

## Verification commands (run in the worktree)

```
npx tsc --noEmit
npm run lint
npm test        # node --test tests/*.test.ts — expect 1490 passing (chat tests still pass; review-queue route assertion updated)
npm run build
```
Manual (dev server): `/app` renders Brief with new rail; `/app/review` lists queue and approve works; `/app/chat/review|new|<id>` redirect; `/app/stock` etc. render stubs; upload button reaches `/app/docu/upload`; no chat dock anywhere.
