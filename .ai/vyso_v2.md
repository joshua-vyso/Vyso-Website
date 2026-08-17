# vyso_v2.md — the rest of the rebrand, page by page, plus the plan to own SA search

Status: PLAN ONLY (written 2026-08-15, Fable/architect). Nothing in here is
implemented. Execute in the phase order at the bottom; each phase gets its own
`.ai/plan_<phase>.md` derived from this document before any agent touches code.
Repo: `Vyso/Software/Vyso Website` (Next 16 app router, Tailwind v4, `motion`).
Done so far: `/` and `/pricing` in the Finch design language (`components/finch/*`,
tokens `--fn-*`, FindingCard, ScrollSequence, PlatformShowcase, IntegrationsOrbit,
FinchNav/FinchFooter, pricing/*). Design sources on disk: `.ai/design/*.dc.html`,
`.ai/design/vyso-brief/*`, brief `.ai/design/uploads/claude_design_brief_finch_site.md`.
Parent plan: `.ai/plan_site_rebrand.md`. Reports: `.ai/implementation_homepage_finch.md`.

Standing rules for every phase: **no widget is reused across pages** (each page earns its own signature visual — the orbit lives on `/` only, the phone/brief on `/` only, the day strip on the COO comparison only, etc.); `motion` only (no new deps except where §7 says
so explicitly and the user approves), zero glassmorphism, orange only for agent
activity + primary CTA, blue only for evidence/data, one orange→blue gradient per
page max, `prefers-reduced-motion` gates everything, no fabricated stats /
testimonials / client counts (Roberto is the only quoted client), Doc-U is the
only agent presented as live, Price Watch "rolling out", others "activated from
your audit roadmap". Nothing deleted without the user approving §3's cut list.

---

## 0. Where we are vs where we're going

**Positioning (settled):** Vyso is the company (audits, Academy, the name on the
invoice). Finch is the product — your company's own COO at a tenth of the cost:
AI agents that watch invoices, stock, suppliers, debtors and margins, and brief
you on WhatsApp. R6,000 / location / month, everything included; the one-week
Operations Audit (R2,000, credited) is the front door; founding terms public;
expanded mandates priced on scope. Primary vertical: SA food & produce SMEs.
Experimental verticals: security companies, insurance brokers (quiet pages).

**Site today (from the 2026-08-15 audit):** ~31 marketing routes still on the
old design (three visual systems: "GLASS" PublicPageShell pages, three heavier
WebGL/shader pages `/contact` `/faq` `/privacy`, and three dead SHADCN pages
`/about` `/apps` `/services` that are already 308-redirected but still built).
Old tiers (Start/Create/Scale, R10k/R30k/R50k, "R3,000 per extra module", "setup
fee") survive verbatim on `/faq`, `/pricing-faq`, `/platform/vyso-for-smes`,
`/services`, `/apps` and one Learn article. No analytics of any kind. Single
static `/og.png` ("Operations, connected."). No `llms.txt`. JSON-LD limited to
Organization + WebSite. Old Navbar/SiteFooter still say "Join Waitlist" and use
glass. `npm run build` currently blocked by an unrelated untracked WhatsApp
import (`extractOrderFromText`) that the owner of that branch work must fix.

**Goal of v2:** one visual system sitewide (Finch), a page tree that reflects the
positioning, every claim true, and the technical + content foundation to be the
first result — in Google, Bing, and inside ChatGPT/Claude/Perplexity/Gemini
answers — for South African queries about operations software, AI operations
assistants / AI COO, business automation for SMEs, and SME analytics, within 12
months.

---

## 1. Design & motion system (shared by every rebuilt page)

Everything below already exists for `/` and `/pricing`; the job is to reuse, not
reinvent.

- **Inspiration (explicit, per the brief and the user):** the craft bar is
  **Attio** (scroll-linked product storytelling, sticky stages, restraint),
  **Stripe** (typography, hairline structure, dense-but-airy layouts, precise
  hover states), **Firecrawl** (mono labels, infrastructure feel, quiet dev-tool
  confidence) and **Folk.com** (the radial integrations widget, warm-white
  palette, playful-but-calm micro-interactions, chat-style status lines). When an
  agent is unsure how something should feel, the answer is "what would Attio /
  Stripe / Firecrawl / Folk do here" — and if a section could pass as a generic
  SaaS template with the logo swapped, reject and redo it. Reference material is
  in `.ai/research/integrations-orbit.md` (folk's compiled mechanics) and the
  brief. Never copy assets or copy; take mechanics and standards.
- **Shell:** `.finch-site` wrapper, `FinchNav` (desktop = inline links, no
  hamburger; **hamburger only below `lg`** — see §2.1), `FinchFooter` (expand to
  a 4-column footer — §2.1), tokens `--fn-*`, fonts STIX Two Text / Instrument
  Sans / IBM Plex Mono.
- **Atoms:** `FindingCard` (the atomic visual — every page that explains value
  shows one, recoloured with vertical-specific content), mono eyebrows, hairline
  section dividers, the dark `AuditBand` CTA, `IntegrationsOrbit`, the phone /
  `BriefPanel`, `InvoiceCard`, `PriceChart`.
- **Section rhythm:** max-w 1160, 110px vertical gaps desktop / 64 mobile,
  eyebrow → H2 (STIX 500 34–38px) → 15.5px `#6B6659` body.
- **Motion principles (intentional, never decorative):**
  1. *Reveal on enter*: opacity 0→1 + y 8→0, 380ms ease-out, once, staggered
     60ms within a group. That's the default and the only "free" animation.
  2. *Scroll-linked storytelling* only where the section IS the story
     (homepage sequence; `/finch` day-strip; audit page). Reserve layout,
     sticky stages, `useScroll` + `useTransform`.
  3. *Agent activity* = orange pulse dot / bar; *evidence* = blue draw-in
     (chart path `pathLength`, highlight `scaleX`); *human action* = the cursor
     demo pattern from PlatformShowcase (real buttons + optional autoplay).
  4. *Numbers*: rand values "stamp" (scale 1.3→1 + fade, 220ms) — never
     count-up tickers, except in the calculators where the number IS the
     interaction (there, tween the value 400ms ease-out).
  5. *Micro*: 150–250ms ease-out hovers; cards lift 2px + sharpen shadow; links
     to `#C94F0E`; details chevrons rotate 150ms; focus rings `#C9DEF7`.
  6. Reduced motion → static end-states, no autoplay, no tilt. Everything
     server-renders its static form first (no CLS, no flash).
- **Copy voice:** calm, specific, operator-to-operator, ZAR everywhere, SA
  food-trade examples (butternut, tomatoes, cooking oil, City Deep, FreshCo…).

---

## 2. Page-by-page disposition

Legend: **KEEP+REBUILD** (same URL, new design/copy) · **MERGE** (content folds
into another URL, 301) · **CUT** (301, no content survives) · **ADD** (new).
Every KEEP page also gets: metadata rewrite for the COO positioning, canonical,
per-page OG image (§7.2), JSON-LD from the graph in §7.3, breadcrumbs, one
`<h1>`, an AuditBand CTA, internal links per the hub map in §7.5.

### 2.1 Shared surfaces (Phase 1, before any other page)

| Surface | Change |
|---|---|
| `FinchNav` | Replace old `Navbar` sitewide. Desktop (≥ lg): inline links only, **no hamburger** — Vyso ‖ Finch · **Finch** (`/finch`) · **Industries** · **Pricing** · **Learn** · Log in · **Book your audit** (→ `/operations-audit`, see §2.3). Mobile (< lg) only: wordmark + CTA + a hamburger that opens a full-height sheet (no blur; solid `#FAF9F6`), items stagger in 40ms, close on route change, focus-trapped, `Escape` closes. `active` prop already exists. |
| `FinchFooter` | 4 columns: *Finch* (Finch, What Finch watches → `/finch#agents`, Under the hood → `/platform/modules`, Integrations, Pricing, Compare) · *Vyso* (About, Operations Audit, Founding client, Academy, Case studies, Contact) · *Learn* (Articles, Resources, Glossary, FAQ, South Africa) · *Legal* (Privacy, Terms, POPIA). Bottom row: wordmark, "Built by Vyso in Johannesburg.", `hello@vyso.co.za`, LinkedIn. |
| `ContactForm` | Becomes the **audit booking form** (name, business, email, WhatsApp number, locations count, "where does it leak?"). Sends the same Resend emails + auto-reply with the Calendly link. Success state shows a FindingCard: *"Finding: your audit request landed. Impact: a week from now you'll know where the money goes."* |
| `not-found.tsx` | ADD in Finch style: a FindingCard "PAGE WATCH · This page doesn't exist · ≈ R0 impact · actions: Go home · See Finch · Book your audit". Bird SVG hops once (translateY -6, 300ms) then rests. |
| `app/layout.tsx` | Sitewide metadata rewrite (§7.1), JSON-LD graph (§7.3), remove `LiquidGlassFilter` once no page uses `LiquidButton`, delete old fonts once no page uses them (Barlow, DM Sans — check `/app/**` first; leave Inter/Instrument/Grotesk which the product uses). |
| Old components | After all pages are rebuilt, propose deletion list (BounceDot, HeroSection, SystemsShowcase, HowItWorks, AppsShowcase, TrustStrip, ContactSection, IntegrationsMarquee, WebGLShaderBackground, GlobalPixelTrail, PricingSection, Navbar, SiteFooter, PublicMarketing, LazyShaderBackground, liquid-button, gooey-text, gradient-text, `three`, `gsap`, `cobe`, `swiper` deps). **User approves before anything is deleted.** |

### 2.2 The product cluster

| Route | Disposition | What it becomes | Signature animation |
|---|---|---|---|
| ~~`/finch`~~ | **NOT BUILT** (user decision 2026-08-15 after seeing it: no dedicated product page — the homepage IS the product page; and no widget is reused across pages) | Built in Phase 1, then removed in Phase 1b. What survives: the **"A COO's day" timeline scroll section** (kept as a parameterisable component in `components/finch/day/`, to be used ONCE on `/compare/finch-vs-hiring-a-coo` as "a COO's day vs Finch's day"), and the six-card **"Custom agents on shift"** with evidence micro-visuals, which replaced the homepage's plain five cards (`/#agents`). Redirects: `/platform*` and `/finch` → `/`. | — |
| ~~`/finch/agents/[slug]`~~ | **NOT BUILT** (user decision 2026-08-15) | Agents are custom per business and industry, so there is no fixed set to give pages to. The SEO intents these would have targeted ("supplier price tracking software", "invoice reconciliation software South Africa", "debtors follow-up automation", "stock control software SA", "weekly operations report automation") move to **`/solutions/*`** (problem-led) and **`/industries/*`** (vertical-led), each of which shows the agents relevant to *that* problem/vertical as examples. | — |
| `/platform/modules` + `/platform/modules/[slug]` (10) | **KEEP+REBUILD** (URLs keep their equity; nav label becomes "Under the hood") | Module library reframed as *the machinery Finch runs on*. Index: quiet 10-card grid grouped Documents (Doc-U) · Orders & money (OrderFlow, PricePilot) · Suppliers & stock (ProcurePulse, SupplySync, WasteWatch, PlanWise) · People (ShiftBoard, ServiceDen) · Insight (InsightGen). Detail pages: keep the real screenshots and grounded feature copy (already honest), reskin, add "which agent uses this" chips, replace pricing mentions with the single-offer line. | Screenshot frames get the **PlatformShowcase treatment lite**: a `ScreenshotFrame` with a soft slide-in and a cursor that points to one control per module (no autoplay loop; play once). |
| `/integrations` | **KEEP+REBUILD** | "Senses, not integrations": full-size `IntegrationsOrbit` hero, then per-tool rows (what Finch reads from it, what it can push back, status live/roadmap), setup honesty ("we connect it during onboarding"), 4 FAQs. Later phase: `/integrations/xero`, `/integrations/sage`, `/integrations/whatsapp-business`, `/integrations/yoco` as their own pages (high-intent local queries: "Xero integration for food suppliers"). | Orbit reused; per-tool row hover reveals a one-line prompt in the "you ask Finch" voice. |
| `/compare` + 2 sub-pages | **KEEP+REBUILD** (recommend keeping separate URLs for SEO rather than the parent plan's single page — user to confirm) → `/compare` hub, `/compare/finch-vs-hiring-a-coo` (ADD), `/compare/finch-vs-erp` (301 from `-vs-erp-systems`), `/compare/finch-vs-spreadsheets` (301 from `vyso-vs-spreadsheets`) | Fair, table-led comparisons. "vs hiring a COO" needs sourced salary ranges (cite PayScale/Robert Walters SA, with dates) — no invented numbers. | **The cost bar**: on `/compare/finch-vs-hiring-a-coo`, two horizontal bars grow on enter — "Fractional/full-time COO: R45,000–R120,000+/month (source)" vs "Finch: R6,000/location/month" — with the rand values stamping. Comparison tables highlight the row under the pointer; sticky first column on mobile. |
| `/solutions` + 4 slugs | **KEEP+REBUILD as "What Finch fixes"** (deviation from parent plan Step 2, which replaced them; recommend keeping the URLs — they're the deepest SEO pages on the site, 1,400–1,600 words each) | Reframe each around agents: `reduce-money-leakage` (hub: all agents), `procurement-automation` → Price Watch + Recon, `reporting-automation` → The Brief + InsightGen, `operations-dashboard` → The Brief (the brief IS the dashboard). Add `debtor-follow-up` and `stock-and-waste-control` later. Move `SOLUTIONS` data out of the page file into `lib/marketing/solutions.ts`. | Symptom-matcher on the hub becomes a **checklist that produces a FindingCard**: tick symptoms → the card's observation/impact text updates live (typed-in, 40ms/char, once per change) → CTA "Book your audit". |
| `/roi-calculator` | **MERGED into `/operations-audit#calculator`** (Phase 1b; 301) — the calculator sits beside the self-assessment on the audit page. Row kept for the spec of the widget: "What is manual work costing you?" | Inputs: monthly purchases, supplier count, invoices/month, debtors book. Output: leakage range using conservative published benchmarks (cite) and hours saved; ends in a FindingCard summarising the user's own numbers + audit CTA. | Output values **tween** (400ms ease-out) and the summary FindingCard restamps its impact when inputs change; a thin evidence chip shows the assumptions used. |
| `/operations-audit` | **DONE Phase 1/1b** — the front door: header + booking form at the top, need/get lists, how the week runs, self-assessment + calculator side by side, FAQs. Spec kept for reference: **KEEP+REBUILD** as **the front door** — nav CTA and every "Book your audit" points here (`/contact` stays for general enquiries) | Hero: "One week. Where the money leaks. In rand." What we need from you (a week of invoices, statements, stock sheets); what you get (leak report with evidence, priority roadmap, credited R2,000); the interactive score widget stays (reskinned) as a warm-up above the booking form; FAQs (HowTo + FAQPage schema). | **Score gauge draws** as answers come in; when the score lands, a FindingCard is generated: "AUDIT · Your reporting is 3 days late on average · ≈ Rx/yr at risk (based on your inputs) · Book the audit". Booking form success = the FindingCard state from §2.1. |
| `/case-studies` + `/case-studies/turn-n-slice` | **KEEP, copy refresh only** (constraint) | Reskin; keep every claim exactly as is (OrderFlow replacing QuickBooks; Roberto's quotes). Case study gets `Article`/`Review`-safe schema (no ratings). | A **"price list in seconds" micro-demo**: type an item name, the priced row appears (once on enter, 1.5s). |
| `/founding-client` | **KEEP+REBUILD** | Rewritten to the founding terms (setup waived · first month free · rate locked), what a founding client commits to (feedback, a monthly call, a quotable outcome), the cohort size honestly stated, link to Roberto. | Terms strip cells reveal left→right; the "cohort" shown as 8 quiet circles, filled ones = actual founding clients (only fill what's true). |
| `/industries` + 6 slugs | **KEEP+REBUILD** | Index: food & produce first (Food suppliers, Farms, Restaurants, Catering, Wholesale, Hospitality) + a quiet "Also watching" row for the experimental verticals. Each slug: hero FindingCard with vertical content (e.g. Farms: "Diesel up 9% at your two depots since May"), what Finch watches in this business, modules used, 4 FAQs, related Learn articles. Move `INDUSTRIES` data to `lib/marketing/industries.ts`. | **The finding deck**: three vertical-specific FindingCards fanned (rotate −4°/0/4°) that straighten and stack on enter; hover brings one forward. |
| `/industries/security-companies`, `/industries/insurance-brokers` | **ADD** (experimental; indexed; linked ONLY from the industries index + sitemap; not in nav or homepage) | Same mechanics in their vocabulary (guard rostering vs contract hours, client-site profitability, incident intake via Doc-U; renewals, commission-statement reconciliation, follow-up cadence). Honest framing, no fake case studies. Shared analytics event `vertical_page_view {vertical}` + `book_audit_click {vertical}`. | Finding deck reused with vertical content. |
| `/south-africa` | **KEEP+REBUILD** (local SEO anchor) | "Built for how South African operations actually run": ZAR, VAT-aware documents, load-shedding-tolerant (only if true — verify against product), POPIA, SARS references, cities served (Johannesburg HQ; remote nationally), local schema (`areaServed`, `LocalBusiness` for the Johannesburg office if there's an address). | A quiet SA map outline with a pulse at Johannesburg (SVG, one pulse, then static). |

### 2.3 The company cluster

| Route | Disposition | What it becomes | Signature animation |
|---|---|---|---|
| **`/about`** | **KEEP URL, REBUILD** (remove the `/about → /platform` redirect) | "Vyso, the company." Founder (Josh Moreira, Johannesburg), why Finch, honest stage (founding cohort, first customer Turn 'n Slice), what Vyso does beyond Finch (audits, Academy), principles (evidence first, rand not vibes, your tools not ours). E-E-A-T page: author entity, sameAs links, photo. `Person` + `Organization` schema. | A vertical **timeline hairline draws** as you scroll with 4–5 real milestones (dated only if the dates are real). |
| **`/academy`** | **ADD** | Vyso Academy — the DIY option: what it will be (workshops, templates, the weekly-brief discipline), R500 / seat, "coming soon", interest capture (email + business type). Later: curriculum outline. `Course` schema only once real. | Seat grid: 12 quiet circles; each interest signup (client-side, this session only) fills one — a small honest gesture, not fake social proof. |
| `/contact` | **KEEP+REBUILD** (drop WebGL) | General contact: email, WhatsApp number, Johannesburg, the form (general variant), and a clear pointer "Want the audit? Go here." | None beyond reveals. |
| `/faq` | **KEEP+REBUILD** (drop WebGL; rewrite the pricing group to the single offer; absorb `/pricing-faq` questions) | Groups: Finch · Pricing & terms · The audit & onboarding · Data, POPIA & security · Integrations · Comparison. FAQPage schema (all Qs), anchor IDs, search-in-page filter. | Deep-link (`#question`) opens that item and flashes the row background `#F5F2EA` for 600ms; chevrons rotate. |
| `/pricing-faq` | **MERGE → `/faq#pricing`** (301) | — | — |
| `/privacy` | **KEEP+REBUILD light** (drop WebGL, Finch typography) + **ADD `/terms`** and **`/popia`** (or a POPIA section + PAIA manual link on privacy — legal to confirm) | Legal pages in the reading layout used by Learn articles. | None. |
| `/learn` + 8 articles | **KEEP+REBUILD** as the content engine (§7.6) | Reskin index (category filter, featured), article layout with TOC, author box (Josh), "cited sources" block, related agent/industry links, `Article` schema with `author`, `datePublished/Modified`. Fix `how-much-time-can-workflow-automation-save` (Start-tier paragraph). | Reading-progress hairline (ink, 1px, top); TOC current-heading highlight; pull-quote FindingCards where an article makes a claim about a finding. |
| `/learn/glossary` + `/learn/glossary/[term]` | **ADD** (AEO/GEO asset) | 40–60 short definitional pages in SA context: fractional COO, operations audit, money leakage, gross margin vs markup, creditors/debtors ageing, delivery-note reconciliation, price creep, stock cover days, VAT-inclusive pricing, POPIA, load-shedding contingency, etc. Each: 60–120-word direct definition first, then "why it matters for an SA food business", one FindingCard example, related terms. `DefinedTerm` + `DefinedTermSet` schema. | None — speed and clarity are the feature. |
| `/resources` + 3 | **KEEP+REBUILD** | Lead magnets in the new voice; gate lightly (email only); add "Supplier price-creep tracker (Sheets)" and "Weekly brief template (WhatsApp)" later. | Resource preview cards get a page-flip on hover (rotateX 6°, 200ms). |
| `/apps`, `/services` | **CUT** (already redirected; delete the files after approval) | — | — |
| `/login` | **KEEP** untouched (constraint). | | |

### 2.4 The final tree (v2)

```
/                       /pricing
/platform/modules  /platform/modules/{10}
/integrations  (/integrations/{xero,sage,whatsapp-business,yoco} later)
/compare  /compare/{finch-vs-hiring-a-coo,finch-vs-erp,finch-vs-spreadsheets}
/solutions  /solutions/{reduce-money-leakage,procurement-automation,reporting-automation,operations-dashboard,(debtor-follow-up),(stock-and-waste-control)}
/industries  /industries/{food-suppliers,farms,restaurants,catering-companies,wholesale,hospitality,security-companies,insurance-brokers}
/operations-audit  /roi-calculator  /founding-client  /case-studies  /case-studies/turn-n-slice
/about  /academy  /contact  /faq  /south-africa
/learn  /learn/{articles…}  /learn/glossary  /learn/glossary/{terms…}  /resources  /resources/{3}
/privacy  /terms  /popia (or section)  /login  /404
```

---

## 3. Cut / merge list + 301 map (USER MUST APPROVE BEFORE ANY DELETION)

| From | To | Type |
|---|---|---|
| `/platform` | `/finch` | 301 |
| `/platform/finch` | `/finch` | 301 |
| `/platform/vyso-for-smes` | `/finch` | 301 |
| `/platform/vyso-ai` | `/finch` | 301 (replaces the current → `/platform/finch`) |
| `/pricing-faq` | `/faq#pricing` | 301 |
| `/compare/vyso-vs-erp-systems` | `/compare/finch-vs-erp` | 301 |
| `/compare/vyso-vs-spreadsheets` | `/compare/finch-vs-spreadsheets` | 301 |
| `/apps` | `/finch#under-the-hood` | 301 (file deleted) |
| `/services` | `/pricing` | 301 (file deleted) |
| `/about` | *(remove redirect — page returns)* | — |
| `www.` → apex | unchanged | 308 |

Not cut (recommend keeping, contrary to the parent plan's Step 2, for SEO
equity): `/solutions/*` (reframed), the compare sub-pages (renamed). Flag for
the user's decision.

**Redundancy rule (user instruction 2026-08-15):** the tree in §2.4 is
authoritative. Any route, component, data file, asset or dependency that is not
part of the new design — including anything discovered mid-phase that this
document missed — is to be listed as redundant in that phase's
`implementation.md`, given a 301 target here if it's a URL, and removed in
Phase 5 once the user approves the consolidated list. Nothing redundant is left
"just in case": no orphan pages, no dead components, no unused fonts/deps.

Verification for this step: link-check the OLD sitemap URLs against the new
build → every one 200 or 301→200; zero 404s.

---

## 4. Copy rules for the rebuild (so agents don't drift)

- H1s state the promise in one line; the first paragraph under any H1/H2 answers
  the page's question directly in ≤ 45 words (AEO).
- Every page has exactly one FindingCard with page-specific content.
- Status honesty chips: `LIVE` (Doc-U, OrderFlow, modules with screenshots),
  `ROLLING OUT` (Price Watch), `FROM YOUR AUDIT ROADMAP` (Recon, Debtors, Stock
  Sense, The Brief), `COMING SOON` (Academy).
- Numbers: ZAR with thousands separators, units always ("per location per
  month"), sources cited inline for any external stat (name + year, link).
- No superlatives without evidence; no client counts; no logos-for-credibility.

---

## 5. Sequencing (phases), model assignment, verification

Rules of engagement per `Claude_Rules.md`: Fable plans/approves; Sonnet for
mechanical/reskin work and research; Opus for animation-heavy or design-critical
pages; one page per agent unless pages share a data file.

**Phase 0 — unblock (Sonnet, 1 agent):** fix or stash the WhatsApp build break
(owner's call), get `npm run build` green, add `npm run type-check`, commit the
homepage + pricing work on the branch (user decides commit/PR).

**Phase 1 — shell + front door (Opus ×1 for nav/footer/404/contact/audit; Sonnet
×1 for FAQ rewrite):** FinchNav mobile menu, FinchFooter, ContactForm→audit
booking, `not-found`, `/operations-audit`, `/contact`, `/faq` (+ absorb
pricing-faq), layout metadata + JSON-LD graph, redirects table (§3, non-deleting
part). Verify: build, link check, Lighthouse ≥ 90 mobile on `/`, `/pricing`,
`/operations-audit`.

**Phase 2 — product cluster (Opus for compare (day strip) + solutions checklist; Sonnet for
modules reskin, integrations, compare, solutions data move):** `/finch`,
`/platform/modules*`, `/integrations`, `/compare*`,
`/solutions*`. Verify: schema validity (Rich Results test on
built HTML), no orange leaks, reduced-motion pass.

**Phase 3 — company + verticals (Sonnet mostly; Opus for the industries finding
deck component once, reused):** `/industries*` incl. the two experimental,
`/founding-client`, `/case-studies*`, `/south-africa`, `/about`, `/academy`,
`/privacy` + `/terms`, `/learn*` reskin + glossary scaffold, `/resources*`.

**Phase 4 — search & AI visibility infrastructure (Sonnet ×2, parallel):** §7.1–7.4
in full (OG images, llms.txt, robots for AI crawlers, schema graph, analytics +
events, GSC/Bing/IndexNow, sitemap with real lastModified from data files).

**Phase 5 — deletion + cleanup (Sonnet, after user approves §3 and the old
component list):** delete files/deps, re-run build/link check/Lighthouse.

**Phase 6 — content engine (ongoing, §7.6):** glossary fill, articles cadence,
integration pages, comparison expansions, quarterly data report.

Definition of done for every phase: `npx tsc --noEmit && npm run lint && npm run
build` clean; `linkinator` zero broken; Lighthouse mobile ≥ 90 perf / 100 SEO /
≥ 95 a11y on the phase's pages; grep gates (`backdrop-`, `R10,000|R30,000|R50,000|
setup fee|Join Waitlist|Start, Create|Vyso AI` → 0); one `<h1>` per page;
JSON-LD parses; browser review at 1440/375 by the architect.

---

## 6. Risks & guardrails

- **Honesty vs ambition:** the example agents on `/finch`, `/solutions/*` and
  `/industries/*` describe capabilities that are partly roadmap. Every example
  carries its status chip and the page says agents are set per business in the
  audit. No screenshots of things that don't run.
- **URL churn:** keep equity — only rename where the old name is wrong
  (`vyso-vs-*`, `/platform*`). All 301s permanent, sitemap only lists finals.
- **Performance:** the site currently ships three.js/gsap/swiper/cobe; removing
  them (Phase 5) is the single biggest CWV win. Until then, ensure no rebuilt
  page imports them.
- **Concurrency:** agents must not share files; browser pane tabs must be
  fronted before animation testing (background tabs throttle timers).
- **Legal:** POPIA/terms copy needs the user's (or counsel's) sign-off before
  publish; keep the current privacy text until then.

---

## 7. Search & AI visibility: how Vyso becomes the answer in South Africa

Target intent clusters (all "South Africa"/"SA"/city-qualified variants):
**operations software for SMEs · operations management software · AI COO /
fractional COO / AI operations assistant · business automation for small
business · AI for small business · invoice automation / invoice reconciliation ·
supplier price tracking / price creep · stock control / inventory software ·
debtors management / follow-up automation · WhatsApp business automation ·
weekly operations report / business dashboard for SMEs · food distribution /
produce wholesaler / restaurant back-office software · Xero / Sage / Yoco
integration · SME analytics / business intelligence for small business ·
operations audit · money leakage.** Plus brand: Vyso, Finch by Vyso.

### 7.1 Technical SEO (Phase 1 & 4)
- Metadata: title template `%s | Vyso` with page-specific titles ≤ 60 chars that
  lead with the query ("Operations software for South African SMEs — Finch by
  Vyso"); descriptions ≤ 155 with the number and the place; canonical on every
  page; `lang="en-ZA"`, `hreflang en-ZA` + `x-default` (single locale — still
  declare it); `metadataBase` correct; `robots` index/follow; noindex only
  `/app`, `/login`, `/onboarding`, `/api`.
- Sitemap: generated from data files with true `lastModified` per entry
  (article/module dates), split by section if > 200 URLs; `robots.txt` lists it.
  Submit to Google Search Console + Bing Webmaster; enable **IndexNow** (Bing,
  Yandex, and increasingly used by others) via an API route on publish.
- Core Web Vitals: LCP < 2.0s (hero text + one SVG; fonts `display: swap`,
  preload the two heading fonts), CLS < 0.05 (every animated section reserves
  layout), INP < 200ms (no long tasks — the scroll sequences use motion values,
  not React state). Lighthouse gates in §5.
- Images: SVG where possible; `next/image` with explicit sizes; descriptive
  alt text that names the entity ("Finch finding card: butternut up 12% at
  FreshCo").
- Crawl hygiene: breadcrumbs (UI + schema) on every non-home page; internal
  links per §7.5; no orphan pages; 404 returns 404 status; trailing-slash
  consistency; `X-Robots-Tag` not set on marketing routes.

### 7.2 Per-page OG images (Phase 4)
`app/opengraph-image.tsx` (+ per-route generators for solutions/industries/learn)
rendering the Finch card style: warm-white background, STIX headline, one
FindingCard with the page's example, wordmark. Regenerates the stale
"Operations, connected." image everywhere. Twitter/X `summary_large_image`.

### 7.3 Structured data graph (Phase 1 base + per page)
Single `@graph` on every page: `Organization` (name Vyso, url, logo, `sameAs`
[LinkedIn, X, GitHub if public, Crunchbase, YouTube], `founder` → `Person` Josh
Moreira with `sameAs`, `address` Johannesburg, `contactPoint`, `areaServed` ZA)
· `WebSite` (with `potentialAction: SearchAction` once `/search` or `/faq?q=`
exists) · `SoftwareApplication`/`Product` "Finch" (`applicationCategory:
BusinessApplication`, `operatingSystem: Web`, offers as on `/pricing`) ·
`Service` "Operations Audit" (R2,000) · per page: `BreadcrumbList`, `FAQPage`
where FAQs exist, `Article` (author Person, dates, `about`), `HowTo` on the
audit and onboarding steps, `DefinedTerm`/`DefinedTermSet` on the glossary,
`Course` on Academy only once real, `Review`-free case study (`Article` +
`mentions` Turn 'n Slice as `Organization`). No `aggregateRating` ever unless
real reviews exist. Validate with the Rich Results test on built HTML per phase.

### 7.4 AI-engine visibility (AEO + GEO) (Phase 4 + ongoing)
- **Let the bots in:** `robots.ts` explicitly allows `GPTBot`, `OAI-SearchBot`,
  `ChatGPT-User`, `ClaudeBot`, `anthropic-ai`, `PerplexityBot`, `Google-Extended`,
  `Bingbot`, `Applebot-Extended`, `CCBot` on marketing routes (disallow on
  `/app`, `/api`). Decide consciously; the goal is to be cited.
- **`/llms.txt` + `/llms-full.txt`:** curated, plain-language index of what
  Vyso/Finch is, pricing, the audit, agents, integrations, industries, with
  canonical URLs and the one-line entity statement repeated verbatim: *"Vyso is
  a Johannesburg-based company whose product, Finch, is an AI operations
  assistant — a company's own COO — for South African food and produce SMEs, at
  R6,000 per location per month."* Regenerate on build from the data files.
- **Answer-first content:** every H2 that maps to a question is phrased as the
  question; the first sentence answers it completely; numbers with units;
  tables for comparisons; short definitions on glossary pages; FAQ schema
  mirrors on-page text exactly (never hidden Q&As).
- **Consistency = entity confidence:** the same 1-line description on the site
  footer, `/about`, LinkedIn, Google Business Profile, Crunchbase, X, GitHub org,
  and in every article's author box. Same NAP (name/address/phone).
- **Citation-worthy assets:** (a) a quarterly **"SA produce price watch"** —
  anonymised, aggregated price-change stats from Price Watch once there is
  enough data (never a single client's data), published as an article + PDF +
  press release — this is the flywheel for both backlinks and LLM citations;
  (b) the glossary; (c) the comparison pages with sourced numbers; (d) the
  operations-audit checklist as a public resource; (e) an annual "State of SME
  operations in South Africa" survey (only once real respondents exist).
- **Where LLMs learn:** Reddit (r/southafrica, r/smallbusiness — helpful, non-
  promotional answers), LinkedIn articles by Josh, guest posts and quotes in SA
  business/food-trade press (Bizcommunity, SME South Africa, Ventureburn,
  Disrupt Africa, Food & Beverage Reporter, Farmer's Weekly, Eat Out/Restaurant
  trade titles), podcasts, YouTube demos with transcripts. Track "Vyso" and
  "Finch by Vyso" mentions monthly in ChatGPT/Perplexity/Gemini/Claude with the
  same 15 prompts (e.g. "best operations software for a food supplier in South
  Africa", "what is an AI COO", "how do I stop supplier price creep") and log
  citations.
- **Local:** Google Business Profile (Johannesburg, category "Software company"
  / "Business management consultant"), Bing Places, SA directories (Brabys,
  Yellow Pages SA, Cylex, SME South Africa directory), Clutch/GoodFirms/G2
  listings once eligible; `LocalBusiness` schema if there is a public address.

### 7.5 Information architecture for topical authority
Hub-and-spoke: `/finch` ↔ solutions ↔ industries ↔ glossary ↔ learn.
Rules: every spoke links up to its hub and sideways to ≥ 3 siblings; every
article links to ≥ 1 solution page and ≥ 1 glossary term; every industry page
links to ≥ 2 solutions and its Learn cluster; the footer carries the hubs.
Breadcrumbs everywhere. Anchor text uses the target's query ("supplier price
tracking with Price Watch"), never "click here".

### 7.6 Content engine (12-month plan)
- Month 1–2: glossary 40 terms; `/finch`; solutions reframed; comparisons; fix/expand the 8
  articles; 4 new pillar articles (AI COO for SMEs; how an operations audit
  works; supplier price creep in SA produce; WhatsApp as the ops interface).
- Month 3–6: 2 articles/week alternating problem-led (query-driven) and
  industry-led; 4 integration pages; the first produce price report; 3 new
  resources.
- Month 6–12: quarterly reports; expand experimental verticals only if their
  analytics show traction; refresh top-20 pages quarterly (`dateModified` real);
  build 30–50 quality backlinks via press/data; pursue "best X South Africa"
  list inclusions.
- Editorial standards: named author with bio + credentials; sources cited; SA
  examples; each piece ends with a FindingCard and the audit CTA; no AI-slop
  tells (generic intros, "in today's fast-paced world").

### 7.7 Analytics & measurement (Phase 4)
- Add **Vercel Analytics + Speed Insights** (zero-config, no cookie banner) — or
  Plausible if the user prefers self-serve dashboards; either needs the user's
  approval as a new dependency. Event taxonomy: `book_audit_click {page,
  vertical}`, `audit_form_submit`, `demo_forward/reverse_played`, `orbit_hover`,
  `finding_card_action_click`, `faq_open {id}`, `resource_download {slug}`,
  `academy_interest`, `outbound_click`. UTM discipline for outreach (per the
  n8n lead engine).
- Google Search Console + Bing Webmaster verified via `metadata.verification`;
  weekly query/coverage review; rank tracking for the §7 clusters (a free-tier
  tool is fine initially); monthly LLM-citation log (§7.4); quarterly CWV
  audit; a one-page dashboard in the repo docs listing the KPIs: impressions,
  top-10 rankings in cluster, audit bookings, LLM citations, backlinks.

---

## 8. Open decisions for the user (answer these before Phase 1)

1. Keep `/solutions/*` and the compare sub-pages (recommended) or consolidate per
   the parent plan?
2. Primary CTA target: `/operations-audit` (recommended) or `/contact`?
3. Analytics: Vercel Analytics (recommended, no banner) or Plausible?
4. Academy: still "coming soon", or sellable now (R500/seat)?
5. Approve the 301/cut list in §3 and the old-component/dependency deletion
   list in §2.1.
6. Public address for LocalBusiness schema / Google Business Profile: yes/no?
7. Who fixes the WhatsApp build break (Phase 0)?
