# Plan: Unlock every module for every user (remove pay-gating)

**Date:** 2026-08-24
**Context:** Focus is shifting from OrderFlow to ProcurePulse. Modules are no longer pay-gated — every org, existing and future, gets every module.

## Current state (verified by recon, 2026-08-24)

There is **no payment integration anywhere** (no Stripe/Paystack/etc.). The "pay-gate" is entirely:

1. **`organisations.locked_modules text[]`** (added by `supabase/org-locked-modules.sql`) — the ONLY live per-org gate. Read server-side in `lib/platform/supabase-server.ts:159-163` into `session.lockedModules`, enforced by:
   - `components/platform/ModuleLockGuard.tsx` (client-side full-screen lock, mounted in `app/app/layout.tsx:280-282`)
   - Sidebar/drawer locked rows: `components/platform/shell/UnderTheHood.tsx:29-107`, `MobileDrawer.tsx`, `shell-data.ts:33-69`
   - Server-side helpers: `lib/platform/review-actions.ts:77-122` (`moduleOpen`), `review-queue.ts:202-206`, `document-ingest.ts:107-136`, `supplysync-feed.ts:161-172`, `lib/ai/finch/tools.ts:474-487`
2. **Onboarding SQL** (`supabase/onboarding.sql`):
   - `onboarding_create_org()` (~line 110) seeds new orgs with `locked_modules` = everything-except-docu.
   - `onboarding_choose_modules(p_modules text[])` (lines 151-209) unlocks docu + exactly 3 chosen modules, locks the other 5.
3. **`org_features`** is already a no-op: every seed writes `enabled=true`, and `supabase-server.ts:148-157` has a TEMPORARY loop forcing all keys `true`. RLS `org_has_feature()` gates (docu/procurepulse tables only) are therefore already open. **No change needed.**
4. Module registry: website copy `lib/platform/modules.ts` already has all 9 modules `status:'active'`. The canonical `Vyso Platform/shared/modules.ts` and mobile mirror still have 7 modules `status:'soon'` — that is **readiness**, not payment, and mobile has no screens for those modules. **Out of scope** (see Constraints).

Migrations are loose SQL files pasted by hand into the Supabase dashboard (CLI unlinked) — the DB step is a file Josh runs manually.

## Goal & acceptance criteria

- Every existing org has `locked_modules = '{}'`.
- Every future org is created with `locked_modules = '{}'` and onboarding can no longer lock modules.
- Onboarding UI no longer forces a "choose 3" plan-limit step (module selection becomes unlimited/informational or is skipped — see Step 3).
- No module ever renders the ModuleLockGuard / locked-sidebar state.
- `npx tsc --noEmit`, `npm run lint`, `npm test` all pass.

## Files to create or modify

| File | Change |
|---|---|
| `supabase/unlock-all-modules.sql` (NEW) | One-shot migration, idempotent, safe to re-paste. See Step 1. |
| `supabase/onboarding.sql` | Update the canonical definitions of `onboarding_create_org` / `onboarding_choose_modules` in place so the file stays the source of truth (same edits as the migration's `create or replace`). |
| Onboarding module-picker UI (implementer to locate under `app/` — the screen that calls `onboarding_choose_modules`, "pick 3" step) | Remove the 3-module cap: allow selecting any number, or restyle as "all modules included" confirmation. Keep the RPC call (it now never locks). |
| `.ai/implementation.md` | Append outcome + deviations. |

## Constraints / do NOT touch

- **Do not** remove `locked_modules` column, `ModuleLockGuard`, sidebar lock UI, or the server-side `moduleOpen` checks — they become dormant kill-switch plumbing (useful for abuse/offboarding). Data-driven: empty data = nothing locked.
- **Do not** touch `TrialGate` / trial columns — trial expiry is a separate gate, not module pay-gating. Flag to Josh if he wants it removed too.
- **Do not** touch `org_features` seeding, the TEMPORARY features loop, or any RLS policy — already effectively open; changing them risks regressions for zero benefit.
- **Do not** flip `status:'soon'` modules to `'active'` in `Vyso Platform/shared/modules.ts` or the mobile mirror — mobile lacks screens for them; that's a readiness decision, not gating.
- **Do not** touch demo-org SQL files (`demo-all-in-one.sql`, `morco-users-roles.sql`, `tns-users-roles.sql`, `org-locked-modules.sql`) — historical migrations already applied; the new migration supersedes their `locked_modules` values.

## Step 1 — DB migration (`supabase/unlock-all-modules.sql`)

```sql
-- Unlock every module for every org (2026-08-24).
-- Pay-gating removed: locked_modules stays as dormant kill-switch plumbing,
-- but no org may be locked by default and onboarding must never lock.
update public.organisations set locked_modules = '{}';
```

Then `create or replace` both onboarding functions, copied verbatim from the current `onboarding.sql` definitions with only these diffs:
- `onboarding_create_org`: seed `locked_modules => '{}'` instead of all-except-docu.
- `onboarding_choose_modules`: keep signature and validation of `p_modules` keys, but always set `locked_modules = '{}'` (the chosen list may still be recorded/ignored — no schema change). Keep advancing `onboarding_stage` exactly as today.

End with a verification query (commented) : `select id, name, locked_modules from public.organisations;` — expect all `{}`.

## Step 2 — sync `onboarding.sql`

Apply the same two function-body edits to `supabase/onboarding.sql` so a fresh environment bootstrapped from that file matches production. No other lines change.

## Step 3 — onboarding UI

Locate the module-picker step (grep `onboarding_choose_modules` / "choose" under `app/` and `components/`). Minimal change: remove the "exactly 3" constraint (validation + copy), allow all modules pre-selected, submit proceeds as today. If the step is trivially removable without breaking the stage machine, prefer keeping the screen but with all modules shown as included ("All modules are included in Vyso") — smallest blast radius on `onboarding_stage` transitions.

## Edge cases

- Orgs mid-onboarding at migration time: `update organisations` clears their locks; if they later hit `onboarding_choose_modules`, the new function body keeps them unlocked. No stuck state.
- Direct API calls to review/document-ingest/supplysync paths: their `locked_modules` checks now always pass — same behaviour as an unlocked org today.
- Finch `unlockedModules` tool: computes full set minus `locked_modules` → now reports all 9. Correct by construction.
- New org created between code deploy and SQL paste (or vice versa): either order is safe — UI change doesn't depend on SQL, SQL doesn't depend on UI. Paste SQL first.

## Verification

```bash
npx tsc --noEmit
npm run lint
npm test
```
- Manual: run the onboarding flow against a test org (or demo org `01000000-7e5d-4c1a-9b3f-000000000001`) — confirm no lock screen on any module route under `/app/*`, sidebar shows all active modules as links (no locked buttons).
- SQL editor: `select count(*) from organisations where locked_modules <> '{}';` → 0.

## Delegation

- Implementation (Steps 1–3): **Sonnet** subagent — mechanical, fully specified, single repo (`Software/Vyso Website`). One agent, one pass.
- No Opus needed; no research remaining.
