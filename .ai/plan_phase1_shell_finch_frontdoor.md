# Plan — Phase 1: shell + `/finch` + front door + FAQ + metadata/redirects

Derived from `.ai/vyso_v2.md` (§1, §2.1, §2.2 `/finch`, §2.3 audit/contact/faq,
§3, §7.1, §7.3). Read that file first; this document only adds what agents need
to execute without inventing. Standing rules apply (motion only, no new deps,
zero glass, colour discipline, reduced motion, honesty chips, one `<h1>`, SSR-
safe, no git commands, dev server on :3000 — don't start another, front your
browser tab before testing animations).

**Decisions taken by the architect for this phase (user asked to proceed):**
keep `/solutions/*` + compare sub-pages (renames in Phase 2); primary CTA →
`/operations-audit`; Academy stays "coming soon"; no LocalBusiness/address
schema; analytics deferred to Phase 4 (needs a dep approval); the WhatsApp
`npm run build` break is not ours to touch — verify with tsc/eslint + dev
server; deletions deferred to Phase 5 (list redundancies in the report).

Four workstreams, disjoint files. Do NOT edit files owned by another
workstream. All four append their own section to
`.ai/implementation_phase1.md` (create if missing; write your section under a
heading with your workstream letter).

---

## Workstream A — shell: FinchNav mobile menu, FinchFooter, PublicPageShell swap, 404

Files: `components/finch/FinchNav.tsx`, `components/finch/FinchFooter.tsx`,
`components/finch/MobileMenu.tsx` (new), `components/marketing/PublicMarketing.tsx`
(swap `Navbar`/`SiteFooter` → `FinchNav`/`FinchFooter`; remove the `blend-surface`
wrapper if it exists there — that class inverts text over the old shader),
`app/not-found.tsx` (new), `app/privacy/page.tsx` ONLY to swap its nav/footer
imports (no other change), `app/pricing/page.tsx` ONLY if the FinchNav API
changes.

1. **FinchNav** — desktop (≥ lg): inline links, no hamburger. Order: brand
   (Vyso wordmark ‖ Finch) · left group none · right group **Finch** (`/finch`) ·
   **Industries** (`/industries`) · **Pricing** (`/pricing`) · **Learn** (`/learn`)
   · **Log in** (`/login`, quieter `#8A8474`) · CTA **Book your audit** →
   `/operations-audit`. Active link `#14120E`, others `#4A463C`, hover
   `#C94F0E`. `active` prop values: `finch | industries | pricing | learn |
   none`. Mobile (< lg): brand + CTA (as now) + a 40×40 hamburger button
   (two 18px hairlines, 6px apart, `#14120E`; morphs to an × over 200ms) that
   opens `MobileMenu`.
2. **MobileMenu** (`"use client"`): full-height sheet, solid `#FAF9F6`, no
   blur; top row mirrors the nav (brand + close); links STIX 28px stacked with
   24px gaps, stagger in 40ms (y 8→0, opacity), then Log in + CTA (full width)
   at the bottom; hairline dividers `#E7E3DA`. Focus-trapped, `Escape` closes,
   closes on route change (`usePathname`), body scroll locked while open,
   `aria-modal`, returns focus to the hamburger. Reduced motion: no stagger.
3. **FinchFooter** — 4 columns at ≥ md (1 col mobile with the column titles as
   mono eyebrows): *Finch*: Finch `/finch` · What Finch watches `/finch#agents`
   · Under the hood `/platform/modules` · Integrations `/integrations` · Pricing
   `/pricing` · Compare `/compare` — *Vyso*: About `/about` (link now; page
   comes in Phase 3 — until then it 308s to `/platform`→`/finch`, acceptable) ·
   Operations Audit `/operations-audit` · Founding client `/founding-client` ·
   Academy `/pricing#academy` (until `/academy` exists) · Case studies
   `/case-studies` · Contact `/contact` — *Learn*: Articles `/learn` · Resources
   `/resources` · FAQ `/faq` · South Africa `/south-africa` (Glossary omitted
   until it exists) — *Legal*: Privacy `/privacy` (Terms/POPIA omitted until they
   exist). Bottom row: wordmark (h 13, opacity .7) · "Built by Vyso in
   Johannesburg." · `joshua@vyso.co.za` (the address the contact route already
   uses; do not invent `hello@`) · © year. Column title mono 10.5px .14em
   `#8A8474`; links 13.5px `#6B6659` hover `#C94F0E`; padding 96px 40px 48px.
4. **`app/not-found.tsx`** — Finch style: nav + a centred FindingCard
   (`agent="PAGE WATCH"`, observation "This page doesn't exist — or it moved when
   we rebuilt around Finch.", impact "≈ R0 at stake", evidence "1 URL", actions:
   Go home `/` · See Finch `/finch` · Book your audit `/operations-audit` — real
   links, `interactive`), the bird SVG above it hopping once (translateY −6,
   300ms, once), footer. Returns 404 status (Next does this for `not-found`).
   `metadata: { robots: { index: false } }`.
5. **PublicPageShell swap** — every old-design page that still uses
   `PublicPageShell` immediately gets the new nav/footer. Check the shell's
   background/blend classes don't fight the new nav (nav must sit on `#FAF9F6`
   or transparent; if the shell paints a dark/inverted band under it, give the
   nav a solid `bg-fn-bg` there). Verify `/industries`, `/learn`, `/solutions`,
   `/compare`, `/case-studies` render with the new nav and no console errors.

Verify: tsc/eslint; browser 1440 + 375 on `/`, `/pricing`, `/industries`,
`/faq` (may be mid-rebuild by D — just nav), 404 page (`/definitely-not-a-page`
→ 404 status via `curl -sI`); mobile menu open/close/Escape/focus; no
horizontal scroll.

---

## Workstream B — `/finch` (product page)

Files: `app/finch/page.tsx` (new), `components/finch/product/*` (new). Nothing
else. Read `.ai/vyso_v2.md` §2.2 `/finch` row + §4 copy rules; reuse
`HomeHero`-style hero, `FindingCard`, `BriefPanel`/`BriefPhone`, `IntegrationsOrbit`
(import from `components/finch/IntegrationsOrbit` — do not modify it; if it
needs a `compact` prop, wrap it instead), `AuditBand`, `FinchNav active="finch"`,
`FinchFooter`. Design language identical to `/` (`.ai/design/Homepage.dc.html`).

Sections, in order (copy is a brief — write final copy in the site voice, ZAR,
SA food-trade examples; keep sentences short; no superlatives; every claim
true):
1. **Hero** — eyebrow `THE PRODUCT`; `<h1>` "Meet Finch. A COO's day, done by
   agents." ; sub: what Finch is in two sentences (agents watch invoices, stock,
   suppliers, debtors, margins; brief you on WhatsApp; built by Vyso for SA food
   businesses; R6,000 per location, everything included); CTA Book your audit →
   `/operations-audit` + secondary "See pricing" `/pricing`; right: FindingCard
   (default content) + `ILLUSTRATIVE EXAMPLE`.
2. **A COO's day** (`id="day"`) — sticky, scroll-linked strip (≥ lg, motion
   OK): wrapper 300vh, sticky 100vh stage 1160×~560 scaled like the homepage
   sequence. A horizontal hairline "clock" (`#E7E3DA`) with a moving ink tick
   and mono times 06:00 … 18:00; five compact FindingCards stamp in at their
   times as t advances (each: opacity 0→1, scale 1.06→1, 220ms): 06:14 PRICE
   WATCH (butternut card) · 07:40 DEBTORS (Thyme & Basil) · 09:05 RECON (Umgeni
   Oils 20 vs 18) · 11:30 STOCK SENSE ("Cooking oil cover 22 days — ≈ R9,800
   overstocked") · 17:55 THE BRIEF — the day's three headline cards slide into a
   `BriefPhone` on the right ("Evening. Three things from today — one's worth
   R4,200."). Captions row underneath like the homepage. Reduced motion / < lg:
   the five cards in a vertical list with their times (mobile) or a 5-col row
   (reduced motion desktop). Reserve layout. Content is illustrative — mono
   `ILLUSTRATIVE — DEMO DATA` under the stage.
3. **Custom agents on shift** (`id="agents"`) — H2 "Custom agents on shift, all
   day, every day."; sub: "Agents are built around your business in the audit —
   these are the kinds of things they watch." Grid of 6 example agent cards
   (Price Watch · Recon · Debtors · Stock Sense · The Brief · one vertical
   example e.g. "Delivery Watch — routes vs delivery notes for wholesalers"),
   each: dot + mono label + one-line description (from `WhatFinchWatches`) + a
   status chip: `ROLLING OUT` (Price Watch), `FROM YOUR AUDIT ROADMAP` (others);
   each card's small evidence micro-visual on hover/enter (Price Watch: 60px
   chart path draws; Recon: two mini columns with one row highlighted blue then
   stamped "2 short"; Debtors: an ageing bar fills; Stock Sense: a cover-days
   arc; The Brief: three dots → bubble; keep each ≤ 600ms, once). Below: a
   line "Document intelligence (Doc-U) is live today; agents are activated in
   priority order from your audit roadmap." (honesty).
4. **Your brief, on WhatsApp** — left copy (what the Monday brief is: three
   things ranked by rand impact, evidence attached, actions you can take from
   the chat), right `BriefPanel` (reuse; three findings + the user reply).
5. **We put your current tools into Finch** — reuse the Senses section
   component if it's importable without side effects (it's a client component
   holding the orbit state) — else render `IntegrationsOrbit` + the same copy.
6. **Under the hood** — the 4-col module strip from the homepage + a link
   "All modules →" `/platform/modules`.
7. **How it starts** — 4 quiet numbered steps (mono 01–04): One-week
   Operations Audit (R2,000, credited) → Rand-quantified leak report with
   evidence → Agents & modules activated in priority order → Monthly ops review
   with your Vyso lead. Each step reveals on enter (stagger).
8. Roberto quote (reuse `FoundingQuote`), `AuditBand`, footer.

Metadata: title "Finch — your company's own COO, at a tenth of the cost | Vyso";
description ≤ 155 chars with R6,000 and "South African food businesses";
canonical `/finch`; OG uses `/og.png` for now. JSON-LD on this page:
`SoftwareApplication` (name Finch, `applicationCategory: BusinessApplication`,
`operatingSystem: Web`, offers → R6,000 ZAR / month per location as on
`/pricing`, `provider` → Organization Vyso) + `BreadcrumbList` (Home › Finch).
No ratings. One `<h1>`.

Verify: tsc/eslint; 1440 + 375 + reduced-motion code path; day-strip beats
sampled in-page; no orange beyond agent accents/CTA/impact; console clean;
`curl` the HTML: one h1, JSON-LD parses.

---

## Workstream C — front door: `/operations-audit` rebuild, `ContactForm` → audit booking, `/contact` rebuild

Files: `app/operations-audit/page.tsx`, `components/marketing/OperationsAudit.tsx`
(rebuild in place, Finch style — keep its QUESTIONS/scoring logic verbatim; it's
grounded), `components/ContactForm.tsx`, `app/api/contact/route.ts` (ONLY to
accept the new optional fields; keep validation/rate-limit/escaping patterns
exactly — read the whole file first), `app/contact/page.tsx`,
`components/finch/audit/*` (new).

1. **`/operations-audit`** — `<h1>` "One week. Where the money leaks. In rand."
   Hero: eyebrow `THE OPERATIONS AUDIT · R2,000 · CREDITED TO YOUR FIRST MONTH`,
   sub (what happens in the week: we take a week of invoices, statements and
   stock sheets, and come back with where the money is leaking, in rand, with
   the evidence attached — whether you sign or not), CTA scrolls to `#book`.
   Then **"What we need / what you get"** two columns (need: last month's
   supplier invoices, bank/creditor statements, current stock sheet or POS
   export, 30 minutes with the owner; get: a leak report with rand impact per
   finding and evidence attached, a priority roadmap for agents/modules, the
   R2,000 credited if you go ahead). Then **the self-assessment** (rebuilt
   `OperationsAudit`: same questions/scoring; Finch styling — white cards,
   hairlines, mono progress `QUESTION 03 / 08`; the score gauge is an SVG arc
   that draws to the score (600ms ease-out), risk chip; below the score a
   FindingCard is generated from the top risk: agent `AUDIT`, observation from
   the top-risk question's label in plain words, impact "Quantified in your
   audit" (NO invented rand figures), evidence "your 8 answers", actions Book
   the audit `#book` · Start over). Then **`#book`** — the booking form (see 2)
   with a mono line above `ONE WEEK · R2,000 · CREDITED`. Then 4 FAQs (`<dl>`,
   FAQPage schema): what does it cost, what do you need from us, what if we
   don't sign, how soon can it start (honest: "usually within two weeks" only if
   true — otherwise "we confirm the start date when you book"). `HowTo` schema
   for the 4-step audit process. Metadata: title "Operations Audit — one week,
   R2,000, credited | Vyso", canonical, description ≤ 155.
2. **`ContactForm`** — add `variant: "audit" | "general"` (default general).
   Audit variant fields: name, business, email, WhatsApp number (optional),
   number of locations (select 1 / 2–3 / 4+), "Where do you think it leaks?"
   (textarea). Button "Book your audit". Success state renders a FindingCard:
   agent `AUDIT`, observation "Your audit request landed. We'll reply within one
   business day to confirm the week.", impact "A week from now you'll know
   where the money goes.", actions none. Route: send the same two Resend
   emails; include the new fields in the internal email; keep the auto-reply.
   General variant: current fields minus tier (already removed), button "Send".
3. **`/contact`** — Finch style: `<h1>` "Talk to Vyso." ; left: email
   `joshua@vyso.co.za`, "Johannesburg, South Africa", a pointer card "Want the
   audit? Book it here → `/operations-audit`"; right: `ContactForm
   variant="general"`. Metadata rewrite; canonical.

Verify: tsc/eslint; both forms submit to the API in dev without a real Resend
key? — check how the route behaves without `RESEND_API_KEY` (if it 500s, add a
dev-only graceful path ONLY if one already exists elsewhere in the repo;
otherwise just report); 1440/375; console clean; the gauge + FindingCard flow.

---

## Workstream D — `/faq` rewrite (+ absorb pricing-faq), redirects, sitemap, layout metadata + JSON-LD graph

Files: `lib/marketing/faq.ts` (new — move FAQ content out of the page),
`app/faq/page.tsx` (rebuild), `next.config.ts` (redirects only), `app/sitemap.ts`,
`app/layout.tsx` (metadata + JSON-LD only; do not touch fonts/children),
`lib/marketing/site.ts` (new: SITE constants — name, url, description, entity
statement, email, sameAs placeholder array with a `// TODO(user)` comment).

1. **FAQ** — merge `FAQ_GROUPS` (app/faq) + `PRICING_FAQS` (app/pricing-faq)
   into `lib/marketing/faq.ts` under groups: Finch · Pricing & terms · The audit
   & onboarding · Data, POPIA & security · Integrations & your tools ·
   Comparison & fit. REWRITE every answer that mentions tiers, setup fees,
   R10,000/R30,000/R50,000, "R3,000 per module", "Start/Create/Scale", "Vyso AI",
   "waitlist" to the single offer (R6,000 / location / month everything
   included; audit R2,000 credited; founding terms; 30 days' notice; expanded
   mandates priced on scope). Keep every grounded product answer (VAT, ZAR,
   OrderFlow, POPIA) but reframe "Vyso platform" → "Finch, by Vyso" where it
   reads naturally. Each answer ≤ 90 words, first sentence direct. Page: Finch
   style; `<h1>` "Straight answers."; sticky group nav on desktop; `<details>`
   accordions with anchor ids (`#pricing`, and per-question slug ids); deep-link
   opens the item and flashes `#F5F2EA` 600ms; a client-side filter input ("Search
   the FAQ") that hides non-matching items (progressive enhancement). FAQPage
   schema for ALL questions (text identical). Metadata rewrite; canonical.
2. **Redirects** (`next.config.ts`, add — don't remove existing):
   `/platform` → `/finch`, `/platform/finch` → `/finch`, `/platform/vyso-for-smes`
   → `/finch`, change `/platform/vyso-ai` → `/finch`, `/pricing-faq` →
   `/faq#pricing`. All `permanent: true`. Do NOT redirect `/platform/modules*`.
   Leave `/about`, `/apps`, `/services` as they are (Phase 3/5).
3. **Sitemap** — remove `/platform`, `/platform/finch`, `/platform/vyso-for-smes`,
   `/pricing-faq`; add `/finch` (lastModified today); keep the rest; give `/faq`
   and `/operations-audit` and `/contact` today's lastModified.
4. **Layout metadata** — `title: { default: "Vyso — Finch, your company's own COO
   at a tenth of the cost", template: "%s | Vyso" }` (check every rebuilt page's
   title still reads well with the template — `/pricing` sets its own full
   title; if the template doubles "| Vyso", set `title: { absolute }` there or
   trim), description = the entity statement (≤ 155): "Vyso is a Johannesburg
   company whose product, Finch, is an AI operations assistant — your company's
   own COO — for South African food and produce SMEs. R6,000 per location per
   month." (trim to fit), `alternates.canonical` per page unchanged,
   `alternates.languages: { "en-ZA": "/" , "x-default": "/" }` on the root only,
   OpenGraph `locale: "en_ZA"`, keep `/og.png` for now.
5. **JSON-LD graph** in the root layout replacing the current two-node graph:
   `Organization` (@id `#organization`, name Vyso, url, logo `/icon.svg`, email
   `joshua@vyso.co.za`, `founder` → `Person` @id `#josh` name "Josh Moreira",
   jobTitle "Founder", `sameAs: SITE.sameAs` (empty array until the user
   supplies URLs — omit the key if empty), `address` `{ addressLocality:
   Johannesburg, addressCountry: ZA }` (no street), `areaServed` ZA,
   `contactPoint` sales en-ZA), `WebSite` (name, url, inLanguage en-ZA,
   publisher → org), `SoftwareApplication` (@id `#finch`, name Finch, provider →
   org, applicationCategory BusinessApplication, operatingSystem Web, url
   `/finch`, offers → the R6,000 offer as on `/pricing`), `Service` (@id
   `#audit`, name "Operations Audit", provider → org, offers R2,000 ZAR,
   areaServed ZA). Pages that already emit their own graphs (`/pricing`,
   `/finch`) keep them; ensure no duplicate `@id`s conflict (they can reference
   `#organization`).

Verify: tsc/eslint; `curl -sI localhost:3000/platform` → 308 to `/finch`;
`/pricing-faq` → `/faq#pricing`; `/faq` renders, deep link works, filter works;
JSON-LD on `/`, `/faq` parses (`node -e`); grep gates on the touched files
(`R10,000|R30,000|R50,000|setup fee|Start, Create|Vyso AI|Join Waitlist` → 0).

---

## Phase-level verification (architect runs after all four report)

`npx tsc --noEmit` (only the 3 known WhatsApp errors), `npm run lint` (no new
problems vs baseline 94), browser review 1440/375 of `/`, `/finch`,
`/operations-audit`, `/contact`, `/faq`, 404, mobile menu; `curl -sI` on the
redirect table; sitemap contains `/finch`; grep gates repo-wide on
`components/finch app/finch app/faq app/contact app/operations-audit app/layout.tsx`.
