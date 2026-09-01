# Plan: Vyso website redesign — "Automation that knows what happens next"

Status: APPROVED by Josh 2026-08-27 (defaults in §14 accepted). Implementation in progress on branch `redesign/operations-2026`.
Date: 2026-08-27
Architect: Fable (plans only; subagents implement)
Supersedes: `plan_home_only.md`, `plan_minimal_agency_site.md`, `plan_site_repositioning.md` for all marketing routes. Product plans (`plan_free_scan.md`, procurepulse, agents, etc.) are unaffected.

---

## 0. Context

- Local `main` is 4 commits ahead of `origin/main` (the 2026-08-27 agency-pivot homepage). The LIVE site is still the pre-pivot Finch site (98 sitemap URLs, "COO at a tenth of the cost", R6,000 pricing). Deploy = push to `main` (Vercel git integration, no CI gate).
- This redesign forks a branch off local `main` and is reviewed on localhost only. Nothing is pushed to `main` or `origin` by any agent, ever.
- Josh's untracked work in the tree (free-scan feature, PostHog init, `.ai` plan files) must never be staged, edited, or deleted. Stashes must never be popped or dropped.
- Full brief: Josh's redesign prompt of 2026-08-27 (sections referenced below as "brief §N"). Research inputs: repo audit (this session) and `scratchpad/research_design_and_live_site.md` (Polar/Attio/Kinso analysis + live URL inventory).

## 1. Goal

Reposition vyso.co.za as ONE brand — Vyso, an AI-powered operations company for South African SMEs — around the idea "Automation that knows what happens next." Premium, calm, Polar/Attio/Kinso-grade design. Conversion target: the free Operations Audit. Preserve SEO equity via a complete 301 map. Runs locally on a redesign branch; production untouched.

### Acceptance criteria

1. New homepage, `/how-it-works`, `/operations-audit`, solutions (index + 8), industries (index + 3), `/integrations`, case studies, `/about`, `/faq`, `/contact`, `/south-africa`, learn/resources copy pass — all built in the new visual system and new positioning.
2. Zero public references to Finch, module codenames (OrderFlow, Doc-U, ProcurePulse, PricePilot, PlanWise, WasteWatch, ShiftBoard, SupplySync, InsightGen, ServiceDen, Vyso Core), Academy, founding client, "COO", "per location", or any price. Orbit removed from main-site nav/footer but its subsite untouched.
3. Every removed live URL 301s to the mapped destination (table in §6). No redirect chains. `/orbit/**`, `/login`, `/app/**`, `/api/**` unaffected.
4. Sitemap, robots, llms.txt, JSON-LD, OG images all regenerate correctly from the new content layer. `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run test` all pass.
5. Forms cannot send real email/Supabase/Anthropic traffic from `npm run dev` (dev gate, §9).
6. Mobile (375px) and desktop verified; reduced-motion respected; no console errors; internal link crawl returns all 200/301-to-200.
7. Copy rules (§3) hold on every touched page.

## 2. Positioning (source of truth for all copy)

- H1 / primary line: **Automation that knows what happens next.**
- Support: Vyso builds tailored operational systems that automate repetitive work, connect your business data and proactively tell you when something needs your attention.
- Model: automate → understand → act. The automation is not the product; the outcome is (time back, fewer errors, earlier warnings, protected margins, less admin).
- Differentiator sentence: Most automation stops when the task is complete. Vyso looks at what happened next.
- Vyso is NOT: a SaaS platform, a Zapier agency, a fractional COO. It IS an AI-powered operations company building bespoke systems around how each client already works.
- Food distribution / wholesale is the strongest proof vertical (Turn 'n Slice), not the whole identity.
- Emotional layer (used once, homepage founder section + about): hard work should give something back; founder started in his father's wholesale business. Warmth is brand, NOT the technical differentiation.
- Finch: gone from public site. If the intelligence layer is ever referenced, say "Vyso noticed / Vyso recommends". Prefer no name at all.
- Orbit: separate vertical product; keep live, remove from main nav/footer, do not redesign.

## 3. Copy rules (hard, apply to every touched file)

1. NO prices or rand amounts for Vyso's fees anywhere. The audit is free. Pricing is explained as philosophy (scoped per problem), never tiers. Illustrative operational numbers inside demos (R91/kg, R18,420 order) are fine and encouraged.
2. NO em or en dashes in customer-facing copy (Josh's standing rule). Rewrite with commas, full stops, or colons. The brief's copy contains them; convert on use.
3. South African spelling. Sentence case for headings. "R" not "ZAR" in prose.
4. No invented metrics, clients, testimonials, or logos. Turn 'n Slice `[TNS_NUMBER]` placeholders stay as placeholders until Josh supplies figures.
5. Banned phrases (brief §6): transform your business, unlock the power of AI, revolutionary, cutting-edge, future-proof, next-generation, harness/leverage AI, streamline everything, seamless(ly), digital transformation, ecosystem, synergy.
6. No false integration claims: use "we design systems around tools like…" framing. Never "native integration" unless it exists (Xero does; check `lib/marketing/integrations.ts` per-tool truthfulness).
7. Every page answers at least one of: what problem, what outcome, how, why credible, how to start (brief §53).
8. Honest-limitation line is on-brand and should appear once (operations-audit or faq): "Sometimes the right answer is a better spreadsheet. If that's the case, we'll tell you."

## 4. Design system

New token set `--vy-*` scoped to `.vyso-site`, added to `app/globals.css` alongside (not replacing) `--fn-*`, because Orbit and the platform still consume `--fn-*`/`--pf-*`. New marketing pages use `.vyso-site`; `.finch-site` remains only under `/orbit/**` and any not-yet-migrated legacy until deletion.

### Palette (monochrome base + one restrained accent, brief §9)

- `--vy-bg`: #FAFAF7 (warm off-white; near the current paper, intentional continuity)
- `--vy-surface`: #FFFFFF; `--vy-surface-2`: #F3F3EF (soft grey cards)
- Ink ramp: `--vy-ink`: #101010; `--vy-ink-2`: #3D3D3A; `--vy-ink-3`: #6E6E68; `--vy-ink-4`: #9C9C95
- Hairlines: `--vy-line`: #E7E7E2; `--vy-line-2`: #D9D9D3
- Accent (single): `--vy-accent`: #E05E1F (the existing burnt orange, darkened toward AA on light ground). Usage rule: accent appears ONLY inside product demos (alerts, "Vyso noticed" moments, status dots) and micro-highlights. It is NOT the CTA colour.
- CTA / buttons: solid near-black `--vy-ink` fill, white text (Attio/Kinso pattern; "neutral shell, colourful product").
- One dark closing band allowed per page (`--vy-dark-bg`: #101010 with light text ramp) for final CTAs. No grain, no gradients, no blue band, no WaveField/FacetPlane devices on new pages.

### Typography (fonts already loaded in `app/layout.tsx`, zero new dependencies)

- Display + headings: **Instrument Sans** (`--font-instrument`), variable weight; tight tracking (−0.02em to −0.03em) ONLY on short display lines.
- Body + UI: **Inter** (`--font-inter`).
- Data / metadata / timestamps in demos: **IBM Plex Mono** (`--font-plex-mono`), uppercase 11–12px labels.
- Barlow Condensed, DM Sans, STIX stay loaded (platform + Orbit + legacy use them) — do not remove fonts in this project.
- Fluid scale (clamp): Display `clamp(2.6rem, 6.5vw, 5rem)/1.05`; H1 `clamp(2.2rem, 4.5vw, 3.4rem)/1.1`; H2 `clamp(1.7rem, 3vw, 2.4rem)/1.15`; H3 1.25rem/1.3; Body-lg 1.125rem/1.6; Body 1rem/1.65; Small 0.875rem; Label/mono 0.75rem uppercase +0.08em.
- Headline construction: Polar's two-tier pattern — strong clause in `--vy-ink`, continuation clause in `--vy-ink-3` (used on hero and section headers).

### Shape, borders, motion

- Radius family: 10px for cards/buttons/inputs (enterprise register); 999px pills ONLY for eyebrow labels and status chips. No other radii.
- Cards: 1px `--vy-line` border, no shadow by default; a single soft ambient shadow permitted on the hero demo and window-chrome mockups only.
- Product mockups get real chrome (window bar or WhatsApp-style header) so demos read as a real system.
- Motion: keep `motion` package, `SmoothScroll` (Lenis), `motion-preference.tsx`. Rules: motion is diegetic (events arriving in a timeline, numbers settling, a finding sliding in), fade/translate ≤16px, stagger ≤80ms, everything gated on reduced-motion. No parallax, no cursor-drift, no magnetic CTAs, no canvas backgrounds on new pages.
- Section rhythm: max-width 1120px content column, generous vertical padding (96–140px desktop, 64–80px mobile), hairline dividers between sections, one idea per section.

### New component tree `components/vyso/`

- `Nav.tsx` + `MobileMenu.tsx`, `Footer.tsx`, `Shell.tsx` (nav + main + footer wrapper applying `.vyso-site`)
- `Section.tsx` (eyebrow/heading/two-tier-subhead scaffolding), `Button.tsx` (primary ink / secondary outline), `Card.tsx`, `Reveal.tsx` (port of `components/finch/site/Reveal` behaviour, calmer defaults)
- `demo/EventTimeline.tsx` — THE recurring visual grammar (brief §54): a vertical feed of timestamped operational events (mono timestamps, event cards, arrow connectors, an accent "Vyso noticed/recommends" card). Config-driven via a typed `TimelineScript` so every page can feed it its own scenario.
- `demo/ChromeFrame.tsx` (window/phone chrome wrapper), `demo/FindingCard.tsx` (adapted from `components/finch/FindingCard.tsx` restyled to `--vy-*`)
- Existing infra reused as-is (imported, not moved): `SkipLink`, `SmoothScroll`, `TrackedLink`, `NavGround` NOT used (no band inversion in new system), `motion-preference.tsx`.

## 5. Information architecture

### Nav (brief §11)

Vyso wordmark (existing black asset) → How it works (`/how-it-works`), Solutions (`/solutions`), Case studies (`/case-studies`), About (`/about`), Insights (`/learn`) · quiet "Log in" (`/login`) · CTA button "Free Operations Audit" (`/operations-audit`). Nothing else. No Finch, Orbit, Industries, Academy in nav (Industries reachable via footer + internal links).

### Footer (brief §44)

- Company: About, Contact, Case studies
- Solutions: WhatsApp order automation, Invoice automation, Inventory automation, Procurement automation
- Resources: Insights (`/learn`), Resources (`/resources`), FAQ
- Legal: Privacy, Terms, POPIA
- CTA row: Free Operations Audit. Bottom: Vyso wordmark, "Johannesburg, South Africa", copyright, `mailto:joshua@vyso.co.za`. No Orbit link, no Finch links, no module links.

### URL decisions (SEO-equity over brief-literal slugs)

- Insights = nav LABEL only; URLs stay `/learn/**` (8 articles + 12 glossary terms keep equity). Add `/insights` → 301 → `/learn`.
- Industries keep existing slugs: `/industries/food-suppliers` (content retitled "Food distributors and fresh produce"), `/industries/wholesale`, `/industries/hospitality`. The brief's `food-distributors`/`wholesalers` slugs are NOT created (unnecessary migration).
- Solutions: keep `reduce-money-leakage`, `procurement-automation`, `reporting-automation` (live equity, rewrite content); add `whatsapp-order-automation`, `invoice-automation`, `spreadsheet-automation`, `inventory-automation`, `document-processing`. 301 `operations-dashboard` → `reporting-automation`.
- `/operations-audit/calculator` and `/score` stay live (restyled Phase 5); `/roi-calculator` redirect kept.
- Integrations child pages (`/integrations/whatsapp` etc.): NOT built now. `/integrations` index gets per-tool anchor sections. Child pages are a future-content TODO, only when genuinely supported.

## 6. Redirect map (all 308/permanent, in `next.config.ts`; no chains — every source points at its final destination)

| Source | Destination |
|---|---|
| `/finch` | `/how-it-works` |
| `/platform`, `/platform/finch`, `/platform/vyso-for-smes`, `/platform/vyso-ai`, `/apps` | `/how-it-works` |
| `/platform/modules` | `/how-it-works` |
| `/platform/modules/orderflow` | `/solutions/whatsapp-order-automation` |
| `/platform/modules/doc-u` | `/solutions/document-processing` |
| `/platform/modules/procurepulse` | `/solutions/procurement-automation` |
| `/platform/modules/pricepilot` | `/solutions/reduce-money-leakage` |
| `/platform/modules/wastewatch` | `/solutions/reduce-money-leakage` |
| `/platform/modules/supplysync` | `/solutions/inventory-automation` |
| `/platform/modules/planwise` | `/solutions/reporting-automation` |
| `/platform/modules/insightgen` | `/solutions/reporting-automation` |
| `/platform/modules/shiftboard` | `/how-it-works` |
| `/platform/modules/serviceden` | `/how-it-works` |
| `/pricing` | `/how-it-works` (pricing philosophy lives there) |
| `/pricing-faq` | `/faq#pricing` (kept; faq.ts must keep a `pricing` group id) |
| `/services` | `/operations-audit` (kept) |
| `/founding-client` | `/operations-audit` |
| `/academy` | `/learn` |
| `/compare`, `/compare/finch-vs-hiring-a-coo`, `/compare/finch-vs-spreadsheets`, `/compare/finch-vs-erp`, `/compare/vyso-vs-erp-systems`, `/compare/vyso-vs-spreadsheets` | `/how-it-works` |
| `/solutions/operations-dashboard` | `/solutions/reporting-automation` |
| `/industries/restaurants`, `/industries/catering-companies` | `/industries/hospitality` |
| `/industries/farms` | `/industries/food-suppliers` |
| `/industries/security-companies`, `/industries/insurance-brokers` | `/industries` |
| `/insights` | `/learn` |
| `/roi-calculator` | `/operations-audit/calculator` (kept) |
| www host redirect | kept as-is |

## 7. Page specs

### 7.1 Homepage `/` (brief §§12–21, copy largely provided by the brief; convert its dashes per §3)

Sections in order, each a `components/vyso/home/*` component:
1. **Hero** — H1 "Automation that knows what happens next." + support line; primary CTA "Get your free operations audit" → `/operations-audit`; secondary text-link CTA "See how Vyso works" → `/how-it-works`. Right/below: **HeroDemo**.
2. **HeroDemo** — `EventTimeline` running the brief §13 script (09:41 WhatsApp order → captured → invoice → inventory 31/40 → shortage 9 boxes → accent recommendation card "Supplier A has stock at R91/kg"). Auto-advances on scroll-into-view, ~600ms per event, replay affordance, fully rendered as static list under reduced motion. All copy crawlable (real text, not canvas).
3. **Differentiation** — eyebrow "AUTOMATION IS ONLY THE BEGINNING"; headline "Most automation stops when the task is complete." / continuation "Vyso looks at what happened next." Then 01 Automate / 02 Understand / 03 Act, three numbered blocks (brief §14 copy).
4. **Examples** — "Small problems become expensive when nobody notices them." 4 cards using `FindingCard`/mini-timelines: Orders shortage, Margin 8.4% vs 17.8%, Supplier invoice R4.20/kg over agreed, Meeting prep (brief §15 copy verbatim minus dashes).
5. **Tools** — "Keep the tools your team already understands." Copy per brief §16 with "we design systems around tools like…" honesty. Reuse the 11 logo assets in `public/finch/integrations/` as a single quiet marquee or static grid (no orbit wheel). Links to `/integrations`.
6. **Bespoke** — "Your business isn't a template. Your systems shouldn't be either." Inputs → Vyso operational layer → outputs diagram, built as accessible HTML/SVG (crawlable text), not canvas.
7. **Process** — "Start where the return is highest." 5 steps Audit/Diagnose/Prioritise/Build/Improve + CTA (brief §18).
8. **Founder** — "Your business should give you a life. Not consume one." Brief §19 story, short, one restrained photo-free layout; "365 hours" line only if it reads non-salesy in situ, otherwise cut.
9. **Case preview** — "Built in the real world." Turn 'n Slice card: industry, problem, what was built, outcomes with `[TNS_NUMBER]` placeholders; link `/case-studies/turn-n-slice`. No invented metrics.
10. **Final CTA** — dark band: "What's costing your business time?" + audit CTA + quiet "Talk to Vyso" → `/contact`.

### 7.2 `/how-it-works` (new route, brief §39)

What Vyso is / is not (explicit NOT list), how automation works, how proactive outcomes work (reuses `EventTimeline` with a second scenario, e.g. the supplier-invoice one), working with existing systems, the audit→diagnose→build→monitor loop, **pricing philosophy** (brief §40: scoped per problem, salon vs distributor contrast, "Before we quote anything, we understand the problem", never "contact us for a quote" alone), FAQs subset, CTA. This page also absorbs compare-page intent: short direct-answer blocks "How Vyso differs from an ERP / from Zapier or Make / from hiring another admin" (AEO).

### 7.3 `/operations-audit` (rewrite, brief §38)

Free Operations Audit, 5 steps, potential outcomes, "diagnosis first, no software obligation", the better-spreadsheet honesty line, concise form (existing `ContactForm` variant `audit`; keep ≤6 fields), links to example findings. Keep `/score` + `/calculator` linked from here.

### 7.4 Solutions (index + 8 pages, brief §28)

Rewrite `lib/marketing/solutions.ts` to the 8 slugs in §5. Each page: problem answer (first 2 sentences AEO-quotable), Vyso's approach, an `EventTimeline` or finding demo believable for that workflow, proactive outcomes list, integrations honesty, 3–5 page-specific FAQs (FAQPage JSON-LD only where genuinely useful), links to case study + related learn article, audit CTA. No generic SEO fluff; every scenario grounded in the wholesale/distribution domain knowledge already in `findings.ts`.

### 7.5 Industries (index + 3, brief §29)

`lib/marketing/industries.ts` trimmed to food-suppliers (retitled food distributors and fresh produce, deepest page: WhatsApp orders, customer-specific pricing, shortages, supplier price changes, wastage, margin visibility), wholesale, hospitality. Delete the other 5 entries (redirects in §6).

### 7.6 Other pages

- `/integrations`: honest rewrite; per-tool sections with anchors; "native where native" truthfulness sweep.
- `/case-studies` + `/turn-n-slice`: reusable template per brief §37 (Company/Industry/Situation/Problem/Before/What Vyso built/How it works/Proactive outcomes/Results/CTA); placeholders for unavailable metrics; single case presented honestly ("our first client" transparency).
- `/about`: founder story expanded, one-cohesive-company framing, South African identity, trust section (POPIA awareness, data handling in plain language, human approval of actions).
- `/faq`: rewrite `lib/marketing/faq.ts` to the brief §41 question set (keep `pricing` group id for the anchor redirect). Concise factual answers; includes ERP/Zapier/admin-hire differentiation, security, autonomy ("humans approve actions"), SA base.
- `/contact`: simple; three intents (start an audit, ask a question, talk about an operational problem); `ContactForm` general variant.
- `/south-africa`: rewrite to new positioning; WhatsApp/Excel/Sage/Xero/ZAR/VAT/EFT/POPIA local context; genuinely useful, no exaggeration.
- `/learn/**`: label "Insights" in nav/footer; copy pass on 8 articles + glossary for dead positioning (notably `fractional-coo` glossary term gets a definition-only neutral rewrite, and any Finch/COO/price mentions across articles are corrected). DO NOT rename any slug (sitemap `learnDate()` throws on drift).
- `/resources`: keep 3 resources, copy pass, ensure each landing page is crawlable-useful (brief §36).
- `/privacy`, `/terms`, `/popia`: chrome swap to `Shell` only; legal text untouched.
- `/design`: keep, noindex, update to preview `--vy-*` primitives (low priority).

## 8. Content-layer, SEO and structured-data changes

- `lib/marketing/site.ts`: SITE description → new positioning; JSON-LD graph: keep Organization + founder Person + WebSite; REMOVE Finch `SoftwareApplication`; add `ProfessionalService` (AI operations company, areaServed ZA); keep free-audit Service (price 0 is the one permitted "price").
- `lib/marketing/llms.ts`: regenerates from updated data files; remove modules/founding/compare sections; verify output by reading `/llms.txt` locally.
- `app/sitemap.ts`: remove deleted routes (modules, founding, academy, compare, finch), add new solution slugs + `/how-it-works`; keep Orbit generation untouched; `CONTENT_LAST_MODIFIED` bumped.
- OG images: delete `opengraph-image.tsx` files with their deleted routes; new OG for `/`, `/how-it-works`, new solutions via existing `lib/og/render.tsx` (rebrand template: wordmark + positioning line, `--vy-*` palette).
- Metadata: every touched page gets new title (≤60 chars, question/outcome-oriented) + meta description; one H1 per page; breadcrumbs (BreadcrumbList) on solutions/industries/case studies/learn as currently patterned.
- AEO: each key page opens with a 1–2 sentence direct answer to its core question (brief §32 list distributed across faq/how-it-works/solutions/south-africa). All demo copy is real DOM text.
- robots/IndexNow/analytics plumbing: unchanged.

## 9. Forms safety (Phase 0, before any dev-server QA)

`app/api/contact/route.ts`: at the top of the handler, after validation, if `process.env.NODE_ENV !== "production" && process.env.ALLOW_REAL_SENDS !== "1"` → `console.log` a redacted summary and return the same success JSON WITHOUT calling Resend or the Supabase rate-limit RPC. Production behaviour byte-identical. Comment explains why (live keys in `.env.local`). Free-scan routes are NOT touched (untracked, and QA will not exercise `/free-scan`).

## 10. Constraints — files and actions that are OFF LIMITS

- Never touch: `app/app/**`, `app/login/**`, `app/onboarding/**`, all `app/api/**` except the contact-route dev gate, `supabase/**`, `lib/platform/**` (except zero files — none needed), `vercel.json`, `.env*`.
- Never touch Josh's untracked work: `app/free-scan/**`, `app/api/free-scan/**`, `components/finch/scan/**`, `lib/platform/free-scan/**`, `lib/posthog-server.ts`, `instrumentation-client.ts`, `supabase/free-scan.sql`, `tests/free-scan-*`, `public/serviceden-logo-concept.svg`, untracked `.ai/*.md`.
- Never `git add -A` / `git add .` — stage explicit paths only. Never pop/drop stashes. Never push. Never merge to `main`. Never run Vercel CLI.
- `/orbit/**` and `lib/orbit/**` untouched. Before deleting ANY `components/finch/*` file, grep for imports from `components/orbit/**` and `app/orbit/**` (Orbit uses `ground/Band`, `FacetPlane`, `Glow`, `OscillatingGrid`, and shared site primitives). When in doubt, leave the file and note it in the report.
- Do not remove fonts from `app/layout.tsx` (platform/Orbit dependencies).
- Do not edit `lib/marketing/learn-articles.ts` slugs or delete articles (sitemap fail-loud); copy edits inside entries are fine.
- Orbit's own pages keep whatever copy they have (including `/orbit/pricing`) — out of scope.

## 11. Execution phases (each = one subagent task with its own report appended to `.ai/implementation_redesign_2026.md`)

Branch first, once, by the Phase 0 agent: `git checkout -b redesign/operations-2026` from local `main`.

- **Phase 0 — Foundation** (Opus, medium): branch; contact-route dev gate; `--vy-*` tokens + type scale in `globals.css`; `components/vyso/` primitives (Shell, Nav, MobileMenu, Footer, Section, Button, Card, Reveal, demo/ChromeFrame, demo/EventTimeline with typed script, demo/FindingCard). Verify: lint, tsc, dev server renders a scratch route with all primitives, 375px + reduced-motion checks.
- **Phase 1 — Homepage** (Opus, high effort, one shot): §7.1 complete, new OG image, metadata, JSON-LD updates in `site.ts`. Verify: build, browser pass desktop+mobile, no console errors.
- **Phase 2 — Core pages** (parallel where independent):
  - 2a `/how-it-works` + `/operations-audit` (Opus)
  - 2b `/about`, `/faq`, `/contact`, `/south-africa` (Sonnet)
  - 2c solutions data + index + 8 pages (Sonnet, using Phase 0/1 components; Opus escalation only if quality misses)
  - 2d industries trim + 3 rewrites, `/integrations`, case-study template + turn-n-slice (Sonnet)
- **Phase 3 — Plumbing** (Sonnet): llms.ts, sitemap.ts, OG sweep, nav-label Insights, learn/resources copy pass, `/design` refresh.
- **Phase 4 — Deletions + redirects** (Sonnet): delete `app/finch`, `app/platform/**`, `app/founding-client`, `app/academy`, `app/compare/**` + their OG files + now-orphaned `components/finch/*` (Orbit-grep rule) + `lib/marketing/{modules.ts,module-data/**,compare.ts,founding.ts}`; full §6 redirect table into `next.config.ts`. Verify: build + curl every source URL → correct Location, no chains.
- **Phase 5 — QA** (Sonnet + my review): full internal link crawl (all 200), forms dev-gate proof, Lighthouse (perf/a11y/SEO; targets: SEO ≥ 100 parity, a11y ≥ 96, perf ≥ 90 desktop), 375/768/1440 screenshots of every page, reduced-motion pass, copy-rule grep sweep (banned words, em/en dash regex `[—–]` over touched marketing files, price regex `R[0-9]` outside demo-marked content), `npm run test`.

I (Fable) review each phase report before the next phase launches, and present the finished localhost site to Josh.

## 12. Edge cases

- `faq.ts` must keep group id `pricing` (anchor target of a live redirect).
- Deleting compare/modules pages must also delete their `opengraph-image.tsx` and any `*-jsonld.ts`, and remove their entries from `llms.ts`/`sitemap.ts` in the SAME phase, or build breaks/ships stale URLs.
- `FinchNav`/`FinchFooter` remain in the repo until Phase 4 (Orbit does not use them, but legacy pages do until rewritten); final state: no route imports them except none — after Phase 4, grep must show zero usages outside `components/finch/scan/**` (untracked free-scan uses them; leave those imports alone even though the components stay in-repo for that reason — do NOT delete FinchNav/FinchFooter files, note this explicitly).
- `learnDate()` throws at build if learn slugs drift — the copy pass must not rename slugs.
- Redirect table entries for previously-redirected sources (`/platform/*`, `/apps`, `/compare/vyso-vs-*`) REPLACE the old entries; check for accidental duplicates (Next.js allows first-match only).
- Homepage demo timestamps are static strings (no `Date.now()` hydration mismatch).
- The brief's example copy contains em dashes and "Turn n Slice"; house style is "Turn 'n Slice" and no dashes.
- Local `main` being ahead of origin is Josh's to push; agents never touch it.

## 13. Exact verification commands

```
cd "/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website"
npm run lint
npx tsc --noEmit
npm run build
npm run test
npm run dev   # then browser QA at http://localhost:3000
# redirect spot-checks (dev server running):
curl -sI http://localhost:3000/finch | grep -i location
curl -sI http://localhost:3000/platform/modules/orderflow | grep -i location
curl -sI http://localhost:3000/pricing | grep -i location
# copy-rule sweeps over touched marketing surfaces:
grep -rnE "[—–]" lib/marketing components/vyso app/page.tsx app/how-it-works
grep -rniE "orderflow|pricepilot|procurepulse|doc-u|supplysync|serviceden|insightgen|wastewatch|shiftboard|planwise|founding client|academy|fractional coo" components/vyso lib/marketing app/page.tsx || true  # expect no customer-facing hits
```

## 14. Open decisions for Josh (defaults chosen; flag disagreement at approval)

1. **Accent**: burnt orange kept but demoted to demo/alert moments; CTAs are solid ink. (Alternative: a cooler accent, or orange CTAs.)
2. **Industries/solutions slugs**: existing live URLs kept over the brief's literal slugs (SEO equity). `/learn` kept as the Insights URL.
3. **/finch destination**: 301 to `/how-it-works` (its content is superseded there). The elaborate ScrollSequence/PlatformShowcase components are retired from public pages, not deleted.
4. **Founder "365 hours" line**: builder decides in situ; cut if salesy.
5. **`[TNS_NUMBER]`**: remains placeholder; site ships review-ready without real figures.

## 15. Deliverables at completion

Local run command (`npm run dev`), localhost URL, summary of changes, changed/added routes, deleted/redirected routes with the §6 table, remaining TODOs (integration child pages, TNS figures, PostHog `/ingest` rewrite is Josh's untracked scope), SEO migration notes, deployment checklist (push branch, PR, Vercel preview, verify redirects on preview domain, merge, submit IndexNow, watch GSC). NO deployment by agents.
