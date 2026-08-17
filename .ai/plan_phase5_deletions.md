# Plan — Phase 5: deletions (APPROVED by Josh 2026-08-16)

Goal: remove every route, component, stylesheet, asset and dependency that is
not part of the Finch design (`.ai/vyso_v2.md` §2.4 tree is authoritative), so
Phase 6 builds on a clean base. Method: **prove zero importers before every
deletion**; redirects for retired URLs stay in `next.config.ts`; the product
app under `app/app/**`, `app/login`, `app/onboarding`, `app/api/**`, `lib/**`,
`supabase/**` and the untracked WhatsApp files are OUT OF SCOPE — never touch
them. No git commands. Report every deletion in `.ai/implementation_phase5.md`
with the grep proof line for each.

## A. Candidate list (verify each; delete only if zero importers outside the
candidate set itself)

Routes (files; their 301s already exist in `next.config.ts` — verify each):
- `app/apps/page.tsx`, `app/services/page.tsx`, `app/pricing-faq/page.tsx`
- `app/platform/page.tsx`, `app/platform/finch/page.tsx`, `app/platform/vyso-for-smes/page.tsx`
  (leave `app/platform/modules/**`)
- `app/faq/faq.module.css`, `app/platform/modules/modules.module.css`
- `app/roi-calculator/` if the dir still exists (page was deleted in 1b)
- `app/finch/` if anything remains

Components (old design):
- `components/Navbar.tsx`, `components/sections/SiteFooter.tsx`,
  `components/sections/PricingSection.tsx`, `components/sections/ContactSection.tsx`,
  `components/sections/TrustStrip.tsx`, `components/sections/AppsShowcase.tsx`,
  `components/sections/HowItWorks.tsx`, `components/sections/SystemsShowcase.tsx`,
  `components/sections/ProblemStrip.tsx` (check), the whole `components/sections/`
  dir if empty afterwards
- `components/HeroSection.tsx`, `components/BounceDot.tsx`,
  `components/WebGLShaderBackground.tsx`, `components/GlobalPixelTrail.tsx`
- `components/marketing/PublicMarketing.tsx` + `public-marketing.module.css`
  (only if no page still imports `PublicPageShell`/`MarketingCta` — grep;
  if any Phase-3 page still uses it, port that page's usage first (minimal) and
  then delete), `components/marketing/IntegrationsMarquee.tsx` +
  `.module.css`, `components/marketing/LazyShaderBackground.tsx`,
  `components/marketing/ScreenshotFrame.tsx` + `.module.css` (modules now use
  `components/finch/modules/ModuleScreenshotFrame.tsx` — verify)
- `components/ui/liquid-button.tsx` (+ remove `<LiquidGlassFilter />` from
  `app/layout.tsx`), `components/ui/gooey-text-morphing.tsx`,
  `components/ui/gradient-text.tsx`, `components/ui/CustomCursor.tsx` (check),
  `components/animations/*` (morphToNav, slotMorphToNav — check each)
- `components/hooks/*` entries with zero importers (check each)
- Any other file under `components/` (NOT `components/finch/**`, NOT
  `components/platform/**`, NOT `components/ui/{badge,button,card,input,label,
  textarea,dropdown-menu,navigation-menu,sheet}.tsx` if the product uses them —
  grep `app/app` and `components/platform` before touching any `ui/` primitive)
  with zero importers repo-wide.

Styles/assets:
- `public/og.png` (grep → 0 after Phase 4), `public/serviceden-logo-concept.svg`
  is UNTRACKED user work — leave it.
- In `app/globals.css`: the "universal reactive text blend" system
  (`.blend-surface`, `.blend-exempt`, `mix-blend-mode`/`invert` rules) — remove
  ONLY if `grep -rn "blend-surface\|blend-exempt" app components` → 0 after the
  component deletions; the `[style*="backdrop-filter"]` glass selector; any
  `--color-1..5` gradient-blob variables with zero users. Do NOT touch the
  `--pf-*` platform block or the `--fn-*` Finch block.
- Fonts in `app/layout.tsx`: `Barlow_Condensed` (`--font-sans`) and `DM_Sans`
  (`--font-body`) — remove ONLY if `grep -rn "font-sans\|--font-sans\|font-body\|--font-body\|barlow\|dm_sans" app components lib --include=*.tsx --include=*.ts --include=*.css` shows no remaining users outside the deleted files (the product under `app/app` and `components/platform` may use them — if so, keep).

Dependencies (`package.json`, then `npm uninstall` exactly the confirmed set):
- `three`, `gsap`, `@gsap/react`, `cobe`, `swiper` — remove if zero importers
  repo-wide (grep `from "three"`, `from "gsap"`, `@gsap/react`, `from "cobe"`,
  `from "swiper"`, `swiper/` in `app components lib`; also `globals.css` imports
  `swiper/swiper-bundle.css` — remove that line if swiper goes).
- `tw-animate-css`, `class-variance-authority`, `@radix-ui/*`, `@base-ui/react`,
  `lucide-react`, `react-icons` — check importers; the product likely uses
  several — keep any with importers; remove only zero-importer ones and say so.

## B. Order of work

1. Snapshot: `git status --short > /tmp/…/phase5-before.txt` (read-only git),
   `npx tsc --noEmit` baseline (3 known errors), `npm run lint` baseline count.
2. For each candidate: `grep -rn "<name>" app components lib --include=*.ts --include=*.tsx --include=*.css` → record; delete only on 0 (excluding self and other candidates being deleted together).
3. Layout edits: remove `LiquidGlassFilter` import/mount; fonts per rule.
4. `globals.css` cleanup per rule.
5. Deps: `npm uninstall <confirmed list>`; check `package-lock.json` updated.
6. Verify: `npx tsc --noEmit` (still exactly the 3 known errors — no new),
   `npm run lint` (count ≤ baseline), dev server: every sitemap URL 200 (script
   from Phase 3/4), the retired URLs 308 (`/apps /services /pricing-faq
   /platform /platform/finch /platform/vyso-for-smes /roi-calculator /finch
   /compare/vyso-vs-*`), `/app` still 307→login, console clean on `/`,
   `/pricing`, `/platform/modules/orderflow`. Also try `npm run build` — it will
   still fail on the untracked WhatsApp import; confirm that is the ONLY error
   and paste it.
7. Report: table of every deleted file/dep with its proof grep; anything kept
   and why; `du -sh node_modules` before/after; lines removed count.
