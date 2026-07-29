# Plan — Module flesh-out + web performance overhaul (2026-07-29)

Architect: Fable 5 (plans/approves only). Implementers: Opus 5 subagents via Ultracode workflows.
User directive (verbatim scope): flesh out every desktop module EXCEPT Doc-U, OrderFlow, ProcurePulse;
research food-business ERP pain points via Firecrawl; map solutions into the most relevant module;
unmatched pains → `Software/New_Modules.md`; flag (never delete) redundant code → `Software/redundant_29_07.md`;
web-platform render speed is priority #1; measure speed with browser tooling.

## Goal & acceptance criteria
1. **Performance (P0):** Post-click page rendering in `/app/*` is drastically faster.
   - Acceptance: `npm run build` succeeds; heavy marketing-only deps (three, gsap, cobe, swiper) are
     verifiably excluded from `/app/*` route bundles; route-level loading states exist; Lighthouse/
     timing measurements captured before and after and reported.
2. **Module flesh-out (P1):** MarginView, PricePilot, ReportGen, ServiceDen, ShiftBoard, Suppliers,
   WasteLog each have a functional, design-consistent UI addressing researched pain points.
   - Acceptance: each module page renders real UI (no 5-line stubs), follows existing platform
     conventions (`components/platform/*`, module layouts, SubNav, ModuleLockGuard), typechecks, lints.
3. **Research (P1):** ≥25 distinct, sourced pain points across food-vertical segments
   (restaurants/hospitality, food manufacturing, distribution/wholesale) with source URLs.
4. **Deliverables:** `Software/New_Modules.md` (pains with no matching module),
   `Software/redundant_29_07.md` (flagged redundancy, file:line, reason, risk of removal — NO deletions).

## Files to create or modify
- Modify: `app/app/{marginview,reportgen,serviceden,shiftboard,suppliers,wastelog}/page.tsx` (+ new subpages),
  `app/app/pricepilot/*` (flesh out further, do not regress existing features).
- Create: module components under `components/platform/<module>/`.
- Modify (perf): `app/layout.tsx`, `app/app/layout.tsx`, `next.config.ts`, marketing components importing
  three/gsap/cobe/swiper (dynamic import / code-split), add `loading.tsx` per app route group.
- Create: `Software/New_Modules.md`, `Software/redundant_29_07.md`, `.ai/implementation.md`.

## Constraints / do-not-touch
- Do NOT modify `app/app/docu/*`, `app/app/orderflow/*`, `app/app/procurepulse/*` feature logic
  (perf-neutral shared-shell changes affecting them are allowed).
- Do NOT delete any code anywhere (redundancy is flag-only). Do NOT drop/alter Supabase schema.
- Do NOT break auth/onboarding flow in `app/app/layout.tsx`. Keep changes scoped per module folder.
- Next 16.2.7: consult `node_modules/next/dist/docs/` before writing Next-specific code (AGENTS.md rule).
- New module pages may ship with mock/demo data wired to clear TODOs where no schema exists yet;
  where Supabase tables exist (e.g. serviceden.sql, pl-*.sql), read real data via existing patterns.

## Data / API / interface changes
- No schema migrations in this task. Read-only use of existing tables. New UI states are client-side.

## Ordered steps
1. **WF1 (parallel):** (a) 6 Firecrawl research agents by segment/lens; (b) codebase state map of the
   7 target modules + platform conventions; (c) performance root-cause audit; (d) redundancy scan.
2. Fable synthesizes: pain → module mapping, per-module feature spec, New_Modules.md, redundant_29_07.md.
3. **WF2:** performance implementation + verification (build, bundle check, timing before/after).
4. **WF3:** per-module implementation (one agent per module, disjoint folders; shared components only
   under `components/platform/<module>/` to avoid conflicts).
5. Final verification + `.ai/implementation.md`.

## Edge cases
- Firecrawl blocked on Reddit → use firecrawl_search result snippets / old.reddit / alternate sources.
- Modules gated by ModuleLockGuard/org-locked-modules → keep gating intact.
- PricePilot already functional → additive only.
- `dev` uses webpack flag; production build is the perf source of truth.

## Verification commands
- `npm run build` && `npm run lint` && `npm run test` (in `Vyso Website/`)
- Bundle inspection of `.next` output for three/gsap presence in app-route chunks.
- Timed navigation measurements against `next start` (headless Chrome / lighthouse if available).
