# plan_agency_redesign_2026.md — Vyso marketing-site overhaul (premium AI automation agency)

**Date:** 2026-09-01 · **Branch:** `redesign/agency-2026` (off origin/main) · **Scope:** marketing site only. `app/app/*` platform, API routes, Supabase, ServiceDen untouched.

## Goal
Reposition vyso.co.za as a premium AI automation agency. One conversion goal: **Join the waitlist** (`/join`). Finch demoted to "an example of what a Vyso automation looks like". Retain exact deployed palette (from `--fn-*` tokens): ink `#14120E`, paper `#FAF9F6`, signal orange `#FF7727` (cta `#BD4A0E`, deep `#A8410C`, tint `#F3D9C6`, on-dark `#FFB27A`), system blue `#4B96DD` (deep `#2F6FAE`, tint `#EDF4FB`, strokes `#3E7BC4`, focus-dark `#C9DEF7`).

## Acceptance criteria
Per the brief's §25 definition of done: agency positioning readable in 5s; single waitlist CTA; lean sitemap; four ThreeUI components integrated from verified source (AnimatedTopDock nav, Halftone Flow hero, Plasma CTA, Flow Field reviews); dark hero → off-white scroll transition; illustrative operations-brief demo; 6 labelled placeholder testimonials; functional /join; Turn n Slice removed + redirected; SEO/AEO structured data; WCAG 2.2 AA effort; production build green; reduced-motion + no-WebGL usable.

## New sitemap
`/` · `/automations` · `/industries` (consolidated single page w/ food-hospitality, construction, insurance sections unless content supports splits) · `/integrations` · `/about` · `/join` · `/privacy` · `/terms` · `/popia` · `/login` (kept — live product login). Everything else in `app/*` marketing removed with redirects (map in `.ai/redirect_map_agency_2026.md`).

## Files
- Create: `app/(marketing route files above)`, `components/site/*` (new design system), `src/shaders/**` (ThreeUI verified sources, unmodified), wrapper/adapters in `components/site/three/*`, `.ai/research/agency_redesign_references.md`, `.ai/inventory_marketing_2026.md`, token layer in `app/globals.css`.
- Delete: legacy marketing routes + `components/finch/*` marketing sections no longer referenced (after redirects land). Keep anything the platform imports.
- Do not touch: `app/app/**`, `app/api/**` (except a new waitlist endpoint if needed), `lib/platform/**`, `supabase/**`, `proxy.ts`, platform tokens `--pf-*`.

## Constraints
- ThreeUI: exact-source, SHA-256 verified, no edits to registered files; app logic in wrappers. r128/r134 isolation documented.
- Never commit demo password. No fabricated metrics. Testimonials labelled "Illustrative client voice".
- Fable hands-on for: design system, all Three.js/wrapper code, hero, scroll transition, animations, brief demo. Subagents: research scraping, content inventory/audit, link checking, admin QA sweeps.

## Ordered steps
1. Audit (agent) + reference research (agents) → docs in `.ai/`.
2. Fetch + verify 4 ThreeUI bundles; record hashes + runtime arrangement.
3. Tokens + layout + typography system.
4. Nav (AnimatedTopDock adapter), hero (Halftone Flow) + Plasma CTA, dark→paper transition.
5. Homepage sections (problem, capabilities, brief demo, process, integrations, industries, testimonials + Flow Field, FAQ, final CTA, footer).
6. /automations, /industries, /integrations, /about, /join (form + backend), legal pages kept.
7. Redirects, sitemap, robots, JSON-LD, metadata, llms.txt refresh.
8. Perf/lifecycle wrappers, accessibility pass, cross-viewport QA in browser.
9. `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`.
10. Before/after screenshots + handoff doc.

## Verification commands
`npx tsc --noEmit` · `npm run lint` · `node --test tests/*.test.ts` · `npm run build` · browser inspection of every route at 360/390/768/1366/1920 + reduced-motion + WebGL-off.
