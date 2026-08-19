# Plan: Orbit — WhatsApp operations for tradespeople (dark-mode subsite under vyso.co.za/orbit)

Status: **approved by Josh 2026-08-19** (verbatim brief: Orbit is "mainly for tradespeople to use WhatsApp to manage
their operations. They WhatsApp 'fixed tiling at job on 1st avenue. charged 3800.' Orbit automatically captures it,
sends a reply 'tracking that now' and runs it through Vyso's backend. Same style of website design as Finch but dark
backgrounds; the blues and burnt oranges stay. Subpage of Vyso. Start now so SEO has time before a product is built.
Images of what it could look like on WhatsApp with a phone overlay, identical to WhatsApp on a phone. Include that we
use the tested and proven Vyso operations software. All a user has to do is join the waitlist. Pricing R99/month.
Pricing page, FAQ, any other pages vital for SEO/AEO/GEO. CTAs all 'Join Waitlist'. Scroll-triggered sequences. Meta
descriptions. Absolutely maximise engine optimisation. SVG logo attached"). Architect: Fable. Implementer: one Opus
agent (may split into two sequential commits: data+pages, then polish).

Logo: `public/orbit/orbit-primary.svg` (mark = blue `#0369FD`, wordmark ink `#0F1829`; the mark replaces the O).
Make `public/orbit/orbit-primary-dark.svg` (wordmark → paper `#F4F1EA`-ish) for dark backgrounds; a mark-only
`orbit-mark.svg` for favicon/nav. Keep the viewBox; do not redraw.

## Design (read `.ai/vyso_v3_design.md`, `components/finch/*`, `app/globals.css` `--fn-*` tokens, `lib/marketing/*.ts`)
- Same system as Finch inverted: **ink grounds** (`#0B1020`→`#0F1829` bands), paper text, the same blue `#0369FD`/
  Finch blue tokens and **burnt orange** accent (`--fn-*` orange), living canvases (OscillatingGrid/WaveField/Glow
  primitives exist — reuse, tune alpha for dark), Lenis (already site-wide, gated off /app), wave-riding statements,
  magnetic CTAs, `RouteFade`, `ScrollSequence`/`SequenceIntro` (the scroll-driven Finch showcase — reuse the
  mechanism for the WhatsApp conversation). Tokens: add an `orbit` theme scope (`.orbit-site` class on the subsite
  shell) that remaps the paper/ink roles; do not fork the primitives.
- **WhatsApp phone** (`components/orbit/WhatsAppPhone.tsx`): a pixel-faithful WhatsApp iOS chat screen built in
  HTML/CSS (status bar, header with avatar "Orbit" + "online", the doodle wallpaper as a subtle CSS pattern,
  outgoing green bubbles with ticks, incoming white bubbles, timestamps, input bar with + / sticker / camera / mic),
  inside a phone frame (notch/dynamic island, rounded bezel). Render-time deterministic; no screenshots of real
  WhatsApp (trademark-safe: "WhatsApp is a trademark of Meta Platforms" footnote). Also an `OgWhatsApp` static
  variant for `lib/og` OG images.
- **Scroll-triggered sequence** (`components/orbit/OrbitSequence.tsx`): as the user scrolls the hero/showcase, the
  conversation plays: tradesman types "fixed tiling at job on 1st avenue. charged 3800." → delivered ticks → Orbit
  replies "Tracking that now ✅ — Job: 1st Avenue tiling · R3,800 · marked done" → next message "invoice it" → "Invoice
  #0042 drafted — tap to send" → a second panel shows the same job landing in the Vyso dashboard (reuse a compact
  `FindingCard`/`InvoiceCard` style). Direction-aware like Finch's PlatformShowcase; reduced-motion = static final.
- Dark-mode OG images per page via `lib/og` (Orbit wordmark, one-line promise, phone snippet).

## Pages (all under `app/orbit/`, own shell `components/orbit/{OrbitNav,OrbitFooter,OrbitShell}.tsx`; nav: Orbit
logo, How it works, Pricing, FAQ, For trades ▾, **Join Waitlist** pill; footer: Orbit links, "Built on Vyso" → `/`,
legal links, WhatsApp trademark note). Root `FinchNav` gets one link "Orbit" (and the mega-menu if it has one).
1. `/orbit` — hero (H1 "Run your trade from WhatsApp."; sub: "Text Orbit what you did and what you charged. It tracks
   the job, drafts the invoice and keeps your books — on the tested Vyso operations platform."), the scroll sequence,
   "What Orbit does" (capture jobs · invoices · payments owed · materials · daily summary), "How it works" 3 steps,
   trades strip, "Built on Vyso" band (proven platform, SA-built, Turn 'n Slice mention only as "used by food
   businesses" without numbers unless public), pricing teaser R99, FAQ teaser, final CTA. JSON-LD: SoftwareApplication
   (+ Offer R99 ZAR/month, availability PreOrder), Organization sameAs Vyso, BreadcrumbList, FAQPage (teaser Qs).
2. `/orbit/how-it-works` — long-form: the WhatsApp flow, what Orbit understands (jobs, amounts, materials, "owed",
   photos), what it sends back, where data lives (Vyso), privacy; 3 phone sequences (job, invoice, end-of-day summary).
   HowTo JSON-LD.
3. `/orbit/pricing` — one plan **R99/month per tradesperson** (what's included; waitlist founders: first month free?
   NO — don't invent; only "join the waitlist, founding pricing locked"), comparison vs "notebook + WhatsApp + bank
   statement", FAQ on billing. Product + Offer JSON-LD, Breadcrumb.
4. `/orbit/faq` — 18–24 Q&As written as direct answers (AEO): what is Orbit, which trades, do I need an app (no —
   WhatsApp), does it work on Android/iPhone, what if I make a mistake, VAT, invoices, quotes, multiple staff, data
   ownership, South Africa only?, languages (English + Afrikaans/isiZulu on roadmap — mark roadmap honestly), security,
   price, when it launches (waitlist), relation to Vyso. FAQPage JSON-LD (full).
5. `/orbit/for/[trade]` — plumbers, electricians, tilers, painters, builders, handymen, carpenters, roofers, solar
   installers, landscapers (10; data in `lib/orbit/trades.ts`): trade-specific H1, pains, a phone sequence with a
   trade-specific message, FAQs ×4, CTA. Static params; each unique copy (no templated thin pages — ≥350 words each).
6. `/orbit/compare/orbit-vs-job-management-apps`, `/orbit/compare/orbit-vs-spreadsheets` — honest tables (GEO loves
   tables), CTA.
7. `/orbit/waitlist` — the form: name, trade (select), WhatsApp number, email (optional), city; posts to the existing
   `/api/contact` with `product:'orbit'` (read that route; add the field if needed without changing Finch's behaviour;
   email subject "Orbit waitlist"). Success state "You're on the list — we WhatsApp you when Orbit opens." No DB.
8. `/orbit/learn/*` — 3 launch articles (SEO long-tail): "How to track jobs on WhatsApp (SA tradesperson's guide)",
   "Invoice from WhatsApp: what the law needs on a South African invoice", "Why tradespeople lose money between the
   job and the bank" — 700–1000 words each, Article JSON-LD, internal links.
All pages: `metadata` with unique title ≤ 60 chars, **meta description** ≤ 155 chars, canonical, OG/Twitter, robots
index; `app/sitemap.ts` includes every Orbit route with lastmod; `/llms.txt` + `/llms-full.txt` (`lib/marketing/llms.ts`)
gain an Orbit section from the same data; `robots.ts` unchanged (AI crawlers allowed). H1 once per page, semantic
sections, alt text on every phone render ("WhatsApp chat where a tiler texts Orbit…"). Lighthouse SEO 100 / a11y ≥ 95
on `/orbit` and `/orbit/pricing` (run `npx lighthouse` or the in-app browser audit if available; report numbers).

## Content rules
Every claim true today or marked roadmap/waitlist; no invented customers/testimonials; "tested and proven Vyso
operations software" framed as: the same backend (Doc-U, OrderFlow, Price Watch, Finch) already running for South
African food businesses; Turn 'n Slice only if `/case-studies/turn-n-slice` is public (it is) and without numbers not
on that page. Drafts-only stays true ("Orbit drafts, you send"). Price R99/month incl. VAT? — state "R99/month" and
"VAT-inclusive pricing confirmed at launch" (honest). CTAs all "Join Waitlist". South Africa focus (rands, WhatsApp
ubiquity, load-shedding-proof phrasing is fine).

## Files
`lib/orbit/{site,trades,faq,pricing,compare,articles,sequences}.ts` (data), `components/orbit/*`, `app/orbit/**`,
`public/orbit/*`, `app/sitemap.ts`, `lib/marketing/llms.ts`, `components/finch/FinchNav.tsx` (+1 link), `lib/og/*`
(orbit template), `app/api/contact/route.ts` (product field only if needed). Do not touch `/app/*`, agents, platform.

## Verification
`npx tsc --noEmit`, `npm test`, `npm run build` (all routes listed), lint ≤ 50; dev server + in-app browser:
screenshots of every page at 1440 and 390 into `.ai/verification/orbit/`; check the scroll sequence plays (front the
tab first — screenshots are black otherwise), reduced-motion static; crawl all Orbit links (200s); validate JSON-LD
with a quick script (parse every `application/ld+json` block); confirm sitemap + llms.txt contain Orbit. Commit in 2–3
commits (`orbit: data + shell + home`, `orbit: pages (how-it-works, pricing, faq, trades, compare, waitlist, learn)`,
`orbit: seo (sitemap, llms, og), verification`).
