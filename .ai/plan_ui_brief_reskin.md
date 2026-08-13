# Plan: Platform UI reskin to "Vyso — The Brief" design language

Status: approved in advance by Josh ("Implement", 2026-08-13) with the hard constraint:
**ARCHITECTURE STAYS THE SAME — look and feel only.** Branch: `feat/ui-brief-reskin`.
Commit after every completed wave chunk (Josh may run out of usage; progress must survive).

## Scope ruling (architect)

The imported Brief (`.ai/design/vyso-brief/`) depicts screens that do not exist in the
app (AI daily-brief feed, chat view, finding detail, a 216px left nav rail). Building
those would be new architecture — explicitly forbidden by Josh's constraint, and the
findings-feed UI is already deferred by the Price Watch plan. Therefore:

- IN scope: restyling the EXISTING platform surfaces (`/app/*` shell + all module
  screens, `/login`) to the Brief's design language via tokens and shared primitives.
- OUT of scope: the Brief's screens themselves, the left rail (current top-bar +
  hamburger nav stays), chat UI, any route/component-tree/data changes, the marketing
  site (its shader/blend-mode system is deliberately coupled to current colors —
  do not touch `globals.css` marketing sections, `components/ui`, `components/marketing`,
  `components/sections`).

## Design language to apply (from `.ai/design/vyso-brief/_ds/.../readme.md` + tokens)

- Cards: white, `1px #EAEDF2` border, 16px radius, shadow `0 1px 2px rgba(20,24,20,.03)`,
  hairline `#EEF1F5` header rule, 20px padding. Hover: border `#C9DEF7`, fill `#F5F9FE`/`#FBFCFE`.
- Page: `--pf-page:#F6F6F4` / blue-white wash gradient (`#F3F8FF → #FFFFFF 340px`).
- Type: Instrument Sans for UI text, Space Grotesk for numerals (tabular figures,
  KPI numbers 22px/600 with muted unit suffix), uppercase eyebrow labels tracked
  0.05–0.08em. Text ramp `--pf-text:#171A17` → `--pf-text-disabled:#9A9DA1`.
- Action color: BLUE — `--pf-accent:#3E7BC4`, strong `#1F5FA8`. **Never an orange
  primary button inside a module screen** (readme, verbatim rule). Orange stays
  marketing-only. The orange→blue gradient (`#BE5D23→#3E8FE0`) is reserved for
  AI-voice moments — apply only to existing Finch UI accents, nothing else.
- Tone pills: the five semantic bg/fg pairs from `tokens/colors.css`.
- Radii: `--pf-radius-sm:8px` → `--pf-radius-panel:20px`, pill for pills.
- Motion: sparse — durations/eases from `tokens/motion.css`; no new animations beyond
  hover transitions.

## Files to modify (verified paths)

1. `app/globals.css` — ADD platform (`--pf-*`) custom properties from
   `tokens/colors.css`/`radius.css`/`spacing.css`/`elevation.css` (scoped so marketing
   values are untouched; do NOT edit the marketing `:root` values, the shader section
   lines ~521-663, or `--primary/--accent/--ring`).
2. `app/app/layout.tsx` — replace hardcoded wash gradient + text hex with the new CSS
   vars; keep structure/nav identical.
3. `components/platform/module-ui.tsx` + `components/platform/ui.tsx` — restyle all
   primitives (SectionCard, ModuleHeader, Kpi*, Badge/StatusPill, DataTable,
   Primary/SecondaryAction, ProgressRing, charts) to the specs above. No API changes —
   props and exports stay identical.
4. `lib/platform/tokens.ts` — sync the runtime hex mirror (VYSO object, STATUS_COLORS)
   to the new values. MUST move in lockstep with (1) or JS-driven colors drift.
5. `app/login/**` — restyle to platform language (blue actions, Brief card style).
6. Module screens under `app/app/*` + `components/platform/*` (~221 files): sweep for
   hardcoded hexes/radii/shadows that fight the new primitives; align to vars. Grep-driven
   (search old hex values), NOT open-every-file. Batch per module, commit per module.

## Waves (each = delegated subagent; commit + report per wave)

- W1 Foundation: files 1, 2, 4 (+ verify fonts already wired — they are, via
  `next/font/google` in `app/layout.tsx`; no change expected). Commit.
- W2 Primitives: file 3, restyle against the Brief specs; keep exports/props identical;
  `npx tsc --noEmit` must pass. Commit.
- W3 Module sweep: file 6 in module batches (docu, orderflow, pricepilot, supplysync,
  serviceden, planwise, shiftboard, wastewatch, insightgen, coredata, outreach, misc)
  + file 5. Commit per batch.
- W4 Verification: `npx tsc --noEmit`, `npm run lint`, `npm run test`; dev-server
  screenshot pass over key screens (login, module hub, Doc-U inbox, OrderFlow, one
  data-heavy table); fix fallout; final commit.

## Constraints

- No dependency changes, no new files except this plan (+ `.ai` docs), no renames.
- Marketing pages must be pixel-identical after the change (spot-check home + pricing).
- `lib/platform/tokens.ts` consumers must be checked at each value change (grep usages).
- Commit messages: `reskin(<wave>): <what>` on `feat/ui-brief-reskin`; never commit
  the pre-existing unrelated WIP (`vercel.json`, `app/api/whatsapp/`, whatsapp libs,
  `docs/whatsapp-ordering.md`, `.ai/plan_demo-pricelist-fixes.md`).

## Verification commands

```bash
npx tsc --noEmit
npm run lint
npm run test
```
Plus browser screenshots of the five key screens listed in W4.
