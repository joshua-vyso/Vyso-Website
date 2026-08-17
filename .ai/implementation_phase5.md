# Implementation: Phase 5 — deletions

Plan: `.ai/plan_phase5_deletions.md`. Executed 2026-08-16. **Nothing committed,
no git commands run beyond `git status`/`git diff` (read-only).** Method used
throughout: `grep -rn "<name>" app components lib --include="*.ts"
--include="*.tsx"` (plus `--include="*.css"` where relevant) for every
candidate, delete only on zero importers outside the file(s) being deleted
together in the same cluster. Every grep below was re-run against the
post-deletion tree as a final sweep (see "Final sweep" at the bottom) — zero
dangling references anywhere in `app/`, `components/`, `lib/`.

`app/finch/` and `app/roi-calculator/` were already gone before this phase
started (Phase 1b / earlier session work) — nothing to do for those two
candidates.

## A. Deleted routes

| Path | Proof grep | Result |
|---|---|---|
| `app/apps/page.tsx` | `grep -rn "app/apps/page.tsx" app components lib` | 0 importers; `next.config.ts` already 308s `/apps` → `/platform/vyso-for-smes` → `/` |
| `app/services/page.tsx` | same pattern | 0; `/services` → `/pricing` 308 exists |
| `app/pricing-faq/page.tsx` | same pattern | 0; `/pricing-faq` → `/faq#pricing` 308 exists |
| `app/platform/page.tsx` | same pattern | 0; `/platform` → `/` 308 exists |
| `app/platform/finch/page.tsx` | same pattern | 0; `/platform/finch` → `/` 308 exists |
| `app/platform/vyso-for-smes/page.tsx` | same pattern | 0; `/platform/vyso-for-smes` → `/` 308 exists |
| `app/faq/faq.module.css` | `grep -rn "faq.module.css" app components lib` | 0 (flagged unused since Phase 1) |
| `app/platform/modules/modules.module.css` | `grep -rn "modules.module.css" app components lib` | 0 (flagged unused since Phase 2) |

`app/apps`, `app/services`, `app/pricing-faq`, `app/platform/finch`,
`app/platform/vyso-for-smes` each contained exactly one file, so the whole
directory went with it. `app/platform/` itself was **not** removed —
`app/platform/modules/**` stays.

## B. Deleted components (old design)

All confirmed via `grep -rl "@/<module-path>" app components lib --include="*.ts" --include="*.tsx"` excluding self and excluding files in the same deletion cluster. Cluster notes where one candidate's only importer was itself deleted in this pass.

| File | Proof grep result | Note |
|---|---|---|
| `components/Navbar.tsx` | 0 real importers (`SiteFooter`/`BounceDot`/`slotMorphToNav`/`morphToNav` only *mention* it in comments — verified with `grep -n "Navbar"` on each, all comment lines) | |
| `components/sections/SiteFooter.tsx` | 0 | |
| `components/sections/PricingSection.tsx` | 0 (`ContactSection`'s hit was a comment: `// Liquid-glass recipe shared with SystemsShowcase + PricingSection`) | |
| `components/sections/ContactSection.tsx` | 0 | |
| `components/sections/TrustStrip.tsx` | 0 | only user of `cobe` |
| `components/sections/AppsShowcase.tsx` | 0 | only importer of `components/ui/AppIcons.tsx` — deleted together |
| `components/sections/HowItWorks.tsx` | 0 | |
| `components/sections/SystemsShowcase.tsx` | 0 | |
| `components/sections/ProblemStrip.tsx` | 0 | only importer of `components/ui/gradient-text.tsx` — deleted together; only user of `--color-1..5` |
| `components/sections/` (dir) | empty after the 8 files above | rmdir'd |
| `components/HeroSection.tsx` | 0 | |
| `components/BounceDot.tsx` | 0 (`wordCycle.ts`'s hit was a comment) | |
| `components/WebGLShaderBackground.tsx` | 1 real importer, `components/marketing/LazyShaderBackground.tsx`, which itself has 0 importers → closed dead cluster, both deleted | only user of `three` |
| `components/GlobalPixelTrail.tsx` | 0 (already unmounted from `app/layout.tsx` in the homepage-Finch pass) | |
| `components/AuroraBackground.tsx` | 0 | not named in the plan's list; caught by the "any other file under components/ with zero importers" clause |
| `components/BlendTextMobile.tsx` | 0 | same clause |
| `components/ButtonLink.tsx` | 0 | same clause; only remaining importer of `components/ui/button.tsx` |
| `components/ChaosScene.tsx` | 0 | same clause; used `gsap` |
| `components/FullpageScroller.tsx` | 0 | same clause |
| `components/MeshBackground.tsx` | 0 | same clause |
| `components/PixelTrail.tsx` | 0 | same clause; only importer of `components/hooks/use-debounced-dimensions.ts` — deleted together |
| `components/SmokyBackground.tsx` | 0 | same clause |
| `components/WarpTransitionOverlay.tsx` | 0 | same clause |
| `components/animations/bounce.ts` | 0 | |
| `components/animations/constants.ts` | 0 | |
| `components/animations/morphToNav.ts` | 0 | |
| `components/animations/portal.ts` | 0 | |
| `components/animations/scrollGate.ts` | 0 | |
| `components/animations/slotMorphToNav.ts` | 0 | |
| `components/animations/wordCycle.ts` | 0 | |
| `components/animations/` (dir) | empty | rmdir'd |
| `components/hooks/use-debounced-dimensions.ts` | 1 importer, `components/PixelTrail.tsx` (deleted same pass) | |
| `components/hooks/` (dir) | empty | rmdir'd |
| `components/marketing/IntegrationsMarquee.tsx` + `.module.css` | 0 | |
| `components/marketing/LazyShaderBackground.tsx` | 0 (only importer of `WebGLShaderBackground`, see above) | |
| `components/marketing/PublicMarketing.tsx` + `public-marketing.module.css` | 0 — every old-design page that used `PublicPageShell`/`MarketingCta` has been rebuilt through Phases 1–4 | |
| `components/marketing/ScreenshotFrame.tsx` + `.module.css` | 0 — modules tree uses `components/finch/modules/ModuleScreenshotFrame.tsx` (verified: that file is untouched, still has importers) | |
| `components/ui/AppIcons.tsx` | 1 importer, `AppsShowcase.tsx` (deleted same pass) | |
| `components/ui/CustomCursor.tsx` | 0 | |
| `components/ui/badge.tsx` | 0 repo-wide, incl. `app/app/**` and `components/platform/**` (explicitly re-grepped per the plan's warning) | |
| `components/ui/button.tsx` | 2 importers before this pass, both in the deletion set (`ButtonLink.tsx`, `components/ui/sheet.tsx`) — 0 outside it | |
| `components/ui/card.tsx` | 0 repo-wide | |
| `components/ui/dropdown-menu.tsx` | 0 outside `Navbar.tsx` (deleted) | only user of `@radix-ui/react-dropdown-menu`, `@radix-ui/react-icons`, and `tw-animate-css`'s `animate-in`/`animate-out` classes (shared with `navigation-menu.tsx`) |
| `components/ui/gooey-text-morphing.tsx` | 0 | |
| `components/ui/gradient-text.tsx` | 1 importer, `ProblemStrip.tsx` (deleted same pass) | |
| `components/ui/input.tsx` | 0 repo-wide | |
| `components/ui/label.tsx` | 0 repo-wide | |
| `components/ui/liquid-button.tsx` | 1 importer, `app/layout.tsx` (`LiquidGlassFilter`) — import + `<LiquidGlassFilter />` mount removed from `app/layout.tsx` first, then 0 | only user of `class-variance-authority` among the ui/ set alongside `button.tsx`/`navigation-menu.tsx`/`badge.tsx`/`ButtonLink.tsx` |
| `components/ui/navigation-menu.tsx` | 0 repo-wide | second user of `tw-animate-css` |
| `components/ui/sheet.tsx` | 0 repo-wide | used `@base-ui/react`, `lucide-react` |
| `components/ui/textarea.tsx` | 0 repo-wide | |
| `components/ui/` (dir) | empty | rmdir'd |

`components/ui/{badge,button,card,input,label,textarea,dropdown-menu,
navigation-menu,sheet}.tsx` — explicitly re-checked per the plan's warning
with `grep -rln "from [\"']@/components/ui/<name>"` against `app/app/**` and
`components/platform/**` specifically: **zero hits in both.** The product
platform has its own `components/platform/ui.tsx` / `module-ui.tsx` and
imports nothing from `components/ui/`. Confirmed via
`grep -rln "from [\"']@/components/ui/" app/app components/platform` → empty.

## C. Styles / assets

| Item | Proof | Result |
|---|---|---|
| `public/og.png` | `grep -rn "og.png" app components lib` → 2 hits, both false positives (`app-wastelog.png`, `wastewatch-log.png` substring matches, not `/og.png`) | deleted |
| `public/serviceden-logo-concept.svg` | untracked user work per the plan | **left untouched** |
| `app/globals.css` — "universal reactive text blend" system (`.blend-surface`, `.blend-exempt`, the `[style*="backdrop-filter"]` selector, all four numbered rule blocks + the header comment, lines ~643–785) | `grep -rln "blend-surface\|blend-exempt" app components` → 0 after `Navbar.tsx` + `PublicMarketing.tsx` (its only two users) were deleted | removed |
| `app/globals.css` — `--color-1..5` gradient-blob vars | `grep -rn "color-1\|color-2\|color-3\|color-4\|color-5"` → only user was `components/ui/gradient-text.tsx` (deleted) | removed |
| `app/globals.css` — `@import "swiper/swiper-bundle.css";` | swiper uninstalled (see below) | removed |
| `app/globals.css` — `@import "tw-animate-css";` | tw-animate-css uninstalled (see below) | removed |
| `--pf-*` platform block, `--fn-*` Finch block | out of scope per the plan | **untouched** |

Everything else in `globals.css` tied to now-dead components (mesh
background, custom cursor, problem-strip connector, apps carousel, pricing
card border, trust-strip pulse, systems-showcase bento, pixel-trail dot
colour, aurora background) is **not** in the plan's explicit `globals.css`
list (which names only the blend system, the backdrop-filter selector, and
`--color-1..5`), so it was left in place rather than swept — flagged below
for a follow-up pass rather than deleted outside the plan's stated scope.

## D. `app/layout.tsx`

Removed the `LiquidGlassFilter` import (`from "@/components/ui/liquid-button"`)
and the `<LiquidGlassFilter />` mount + its comment. Nothing else in the file
touched.

**Fonts — kept, not removed.** Ran the plan's exact grep:
```
grep -rn "font-sans\|--font-sans\|font-body\|--font-body\|barlow\|dm_sans" \
  app components lib --include=*.tsx --include=*.ts --include=*.css
```
`app/login/page.tsx` uses `fontFamily: 'var(--font-sans)'` directly (twice),
and `components/platform/MarketingAuth.tsx` uses
`fontFamily: 'var(--font-body, var(--font-sans))'` (three times) — both files
are on the plan's do-not-touch list (`app/login`, `components/platform/**`).
Per the plan's own exception clause, `Barlow_Condensed` (`--font-sans`) and
`DM_Sans` (`--font-body`) **stay** in `app/layout.tsx`.

## E. Dependencies removed

`npm uninstall three gsap @gsap/react cobe swiper tw-animate-css
class-variance-authority @radix-ui/react-dropdown-menu @radix-ui/react-icons
@radix-ui/react-slot @base-ui/react lucide-react` + `npm uninstall --save-dev
@types/three` (not in the plan's literal list, but the type package for
`three`, orphaned by the same deletion — no code references it once `three`
is gone).

| Dependency | Proof (importer sweep, post-component-deletion) |
|---|---|
| `three` | only `WebGLShaderBackground.tsx` (deleted) |
| `gsap` | only `ChaosScene.tsx`, `BounceDot.tsx`, `components/animations/*` (all deleted) |
| `@gsap/react` | 0 importers found anywhere, before or after — already dead |
| `cobe` | only `TrustStrip.tsx` (deleted) |
| `swiper` | 0 `.ts`/`.tsx` importers; only reference was the `app/globals.css` `@import` line (removed) |
| `tw-animate-css` | `animate-in`/`animate-out` classes only used by `dropdown-menu.tsx`/`navigation-menu.tsx` (both deleted); only other reference was the `@import` line (removed) |
| `class-variance-authority` | only `button.tsx`, `navigation-menu.tsx`, `liquid-button.tsx`, `badge.tsx`, `ButtonLink.tsx` (all deleted) |
| `@radix-ui/react-dropdown-menu` | only `dropdown-menu.tsx` (deleted) |
| `@radix-ui/react-icons` | only `dropdown-menu.tsx` (deleted) |
| `@radix-ui/react-slot` | 0 importers found anywhere — already dead |
| `@base-ui/react` | only `sheet.tsx`, `button.tsx`, `input.tsx`, `navigation-menu.tsx`, `badge.tsx` (all deleted) |
| `lucide-react` | only `SystemsShowcase.tsx`, `sheet.tsx`, `Navbar.tsx`, `ContactSection.tsx`, `navigation-menu.tsx`, `ScreenshotFrame.tsx` (all deleted) |
| `react-icons` | **not a real dependency** — never in `package.json`; the plan's candidate list named it but the only grep hit was a substring match inside `@radix-ui/react-icons`. Nothing to uninstall, nothing to report as kept. |

**Kept** (checked, real importers remain): `motion`, `clsx`,
`tailwind-merge`, `@anthropic-ai/sdk`, `@supabase/ssr`, `@supabase/supabase-js`,
`@vercel/analytics`, `@vercel/speed-insights`, `resend`, `server-only`, `next`,
`react`, `react-dom`, plus all devDependencies except `@types/three`
(`@tailwindcss/postcss`, `@types/node`, `@types/react`, `@types/react-dom`,
`eslint`, `eslint-config-next`, `shadcn`, `tailwindcss`, `typescript`).

**`next.config.ts` follow-on fix (not in the plan's file list, but a direct
consequence of the dep removal):** `experimental.optimizePackageImports` named
`lucide-react` and `@radix-ui/react-icons`, both now uninstalled. Trimmed the
array to `['motion']` (the only remaining direct dep it applies to) with an
updated comment. Verified this was inert either way — Next never errored on
the stale entries since nothing imported them — but leaving a config array
naming two uninstalled packages is exactly the kind of dead reference the
redundancy rule targets, and it's a one-line fix directly downstream of a
deletion in this phase, not a separate change of scope.

## F. Everything kept, and why

| Item | Why kept |
|---|---|
| `components/marketing/OperationsAudit.tsx` | 1 real importer: `components/finch/audit/AuditTools.tsx` (the live `/operations-audit` page) |
| `components/marketing/RoiCalculator.tsx` | 1 real importer: `components/finch/audit/AuditTools.tsx` (the ROI calculator embedded in the audit page, Phase 1b) |
| `components/ContactForm.tsx` | 5 importers: `/contact`, `/resources/[slug]`, `components/finch/audit/AuditHero.tsx`, `components/finch/academy/AcademyInterest.tsx` — actively used |
| `Barlow_Condensed` / `DM_Sans` fonts in `app/layout.tsx` | used by `app/login/page.tsx` and `components/platform/MarketingAuth.tsx` (both out of scope) |
| `components/ui/{badge,button,card,input,label,textarea,dropdown-menu,navigation-menu,sheet}.tsx` | **not** kept — see Section B; all nine had zero importers repo-wide once the marketing chain was removed, including in `app/app/**`/`components/platform/**`, so all nine were deleted. Listed here only to record that the "product may use them" check was run and came back negative. |
| `public/serviceden-logo-concept.svg` | untracked user work, explicitly out of scope |
| `--pf-*` / `--fn-*` CSS blocks | explicitly out of scope |
| `app/app/**`, `app/login`, `app/onboarding`, `app/api/**`, `lib/**`, `supabase/**`, `components/platform/**` | untouched, per the hard rule |
| `components.json` (shadcn CLI config) | not code — references `components/ui` and `lucide` as CLI defaults for future `npx shadcn add` runs; doesn't import anything, doesn't affect build/tsc/lint. Left as-is; out of the plan's scope. |

## G. Discovered but out of the plan's explicit scope (flagged, not touched)

- **`hooks/useCountUp.ts`, `hooks/useInView.ts`, `hooks/useShaderHueShift.ts`**
  (top-level `hooks/`, not `components/hooks/`) — all three have zero
  importers repo-wide (`grep -rl "@/hooks/<name>" app components lib` → empty
  for all three). The plan's candidate list only names `components/hooks/*`;
  this is a sibling directory it doesn't mention. Not deleted, flagged for a
  follow-up pass.
- **CSS in `app/globals.css` tied to now-deleted components** (mesh
  background animations, custom-cursor rule, problem-strip connector, apps
  carousel scrollbar-hide, pricing-card animated border, trust-strip pulse
  dots, systems-showcase bento breakpoints, pixel-trail dot colour, aurora
  background keyframes — roughly a dozen small rule blocks under the
  "General mobile section padding" area and above). These are now dead CSS
  (their only consumers were deleted in Section B) but the plan's `globals.css`
  bullet names exactly three things to remove (blend system, backdrop-filter
  selector, `--color-1..5`) and no more — left in place rather than
  broadening the edit past what was approved.

## H. Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Exactly the 3 known pre-existing errors, before and after this phase. No new
errors anywhere.

```
$ npm run lint
before: 94 problems (55 errors, 39 warnings)
after:  90 problems (53 errors, 37 warnings)
```
Reduced (some lint findings lived in the deleted files) — within the ≤
baseline gate.

**Sitemap.** All 70 URLs in `/sitemap.xml` return 200 against the dev server
(scripted check, `/tmp/phase5/check_sitemap.sh`).

**Retired URLs**, all 308:
```
/apps                          -> 308 -> /platform/vyso-for-smes -> 308 -> / (200)
/services                      -> 308 -> /pricing
/pricing-faq                   -> 308 -> /faq#pricing
/platform                      -> 308 -> /
/platform/finch                -> 308 -> /
/platform/vyso-for-smes        -> 308 -> /
/roi-calculator                -> 308 -> /operations-audit#calculator
/finch                         -> 308 -> /
/compare/vyso-vs-erp-systems   -> 308 -> /compare/finch-vs-erp
/compare/vyso-vs-spreadsheets  -> 308 -> /compare/finch-vs-spreadsheets
```
`/apps` is a pre-existing two-hop chain (documented in
`.ai/implementation_phase1.md`'s Workstream D, deviation 4) — both hops are
real redirects, the chain resolves to 200, and no redirect was missing, so
per the plan ("verify, don't edit unless a redirect is missing") it was left
as-is.

**`/app`** → 307 → `/login` (unauthenticated), unaffected by this phase.

**Console**, checked live in-browser (dev server, own tab):
- `/` — no errors, no warnings beyond expected dev-mode noise (React DevTools
  notice, HMR, Vercel Analytics/Speed Insights debug logs).
- `/pricing` — same, clean.
- `/platform/modules/orderflow` — same, clean.

**`npm run build`:**
```
Error: Turbopack build failed with 1 errors:
./lib/platform/whatsapp-ingest.ts:4:1
Export extractOrderFromText doesn't exist in target module
Import trace:
  App Route:
    ./lib/platform/whatsapp-ingest.ts
    ./app/api/whatsapp/process/route.ts
```
Confirmed this is the **only** build error — the same untracked, out-of-scope
WhatsApp import that has blocked every prior phase's build. Nothing this
phase touched appears anywhere in the build output.

**Final sweep** — every deleted file/module path re-grepped against the
post-deletion tree, zero hits:
```
$ grep -rln "components/Navbar\|sections/SiteFooter\|sections/PricingSection\|
  sections/ContactSection\|sections/TrustStrip\|sections/AppsShowcase\|
  sections/HowItWorks\|sections/SystemsShowcase\|sections/ProblemStrip\|
  components/HeroSection\|components/BounceDot\|components/WebGLShaderBackground\|
  components/GlobalPixelTrail\|marketing/PublicMarketing\|marketing/IntegrationsMarquee\|
  marketing/LazyShaderBackground\|marketing/ScreenshotFrame\|ui/liquid-button\|
  ui/gooey-text-morphing\|ui/gradient-text\|ui/CustomCursor\|ui/badge\|ui/button\|
  ui/card\|ui/dropdown-menu\|ui/input\|ui/label\|ui/navigation-menu\|ui/sheet\|
  ui/textarea\|ui/AppIcons\|animations/morphToNav\|animations/slotMorphToNav\|
  animations/wordCycle\|animations/bounce\|animations/constants\|animations/portal\|
  animations/scrollGate\|hooks/use-debounced-dimensions" app components lib
(no output)
```

## I. Sizes and lines removed

```
$ du -sh node_modules
before: 693M
after:  569M   (−124M, 51 packages removed by npm + 1 devDependency)
```

**Lines removed.** All deleted files were previously tracked and unmodified
by any earlier phase, so `git diff --numstat` against the pre-phase tree for
exactly the deleted paths gives a clean count:

```
$ git diff --numstat -- <every deleted route/component/css/asset path>
total: 11,192 lines removed
```

Plus this phase's own edits (not separable from earlier phases' still-
uncommitted diffs on the same files via `git diff`, so stated directly from
the edits made): `app/layout.tsx` −3 lines (import + comment + mount),
`app/globals.css` ≈ −154 lines (the blend system block, the `--color-1..5`
block, two `@import` lines), `next.config.ts` a same-size comment/array edit,
`package.json` −13 lines (12 runtime deps + 1 devDependency).

**Route/component/CSS/asset files deleted:** 60 (8 routes/CSS, 51 component/
CSS/animation/hook files across `components/`, 1 asset — `public/og.png`).
**Now-empty directories removed:** `components/sections/`,
`components/animations/`, `components/hooks/`, `components/ui/`.
**Dependencies uninstalled:** 13 (12 runtime + `@types/three`).

## J. Final report to the user

- 60 files deleted (8 old routes/CSS modules, 51 old-design component/
  animation/hook/CSS files, 1 stale OG asset), 4 now-empty component
  directories removed, 13 npm packages uninstalled (three, gsap, @gsap/react,
  cobe, swiper, tw-animate-css, class-variance-authority,
  @radix-ui/react-dropdown-menu, @radix-ui/react-icons, @radix-ui/react-slot,
  @base-ui/react, lucide-react, @types/three).
- `node_modules` 693M → 569M (−124M). ~11,350 lines removed total.
- `tsc` still exactly the 3 known pre-existing WhatsApp errors; lint 94→90
  problems; every sitemap URL 200; every retired URL 308 (one pre-existing
  two-hop chain, `/apps`, left as-is per the plan); `/app` still 307→login;
  console clean on `/`, `/pricing`, `/platform/modules/orderflow`; `npm run
  build` fails on exactly the one known, out-of-scope WhatsApp import.
- **Kept, and the plan expected it might go but it didn't turn out
  removable:** `Barlow_Condensed`/`DM_Sans` fonts — kept because `/login` and
  `components/platform/MarketingAuth.tsx` (both out of scope) read
  `--font-sans`/`--font-body` directly. Nothing else the plan listed survived
  that I'd have expected to go.
- **Risk / worth a look:** two things were discovered but left untouched
  because they're outside the plan's literal scope (Section G) — three
  orphaned top-level `hooks/*.ts` files with zero importers, and a dozen
  small dead CSS rule-blocks in `globals.css` tied to now-deleted components.
  Neither breaks anything; both are candidates for a follow-up cleanup pass
  if the user wants the CSS file fully swept.
