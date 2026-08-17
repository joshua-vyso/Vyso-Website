# Plan v4 — orbit refinements + Pricing page (Finch design language)

Builds on v1–v3 (`.ai/plan_homepage_finch*.md`, report
`.ai/implementation_homepage_finch.md`). Same standing constraints: `motion`
only, no new deps, no commits, don't touch shared Navbar/SiteFooter/api/lib/
supabase/untracked WhatsApp files, zero glassmorphism, SSR-safe, one `<h1>` per
page, house-style "why" comments, dev server on :3000 (don't start another).

---

## Part A — IntegrationsOrbit refinements (`components/finch/`)

Files: `integrations.ts`, `IntegrationsOrbit.tsx`, `Senses.tsx` (+ optionally
`IntegrationPrompt.tsx`). Nothing else.

1. **Roster**: delete `claude` and `gpt` (11 remain, order unchanged: Xero,
   WhatsApp Business, Yoco, Sage, Loyverse, QuickBooks, Gmail, Outlook, Notion,
   n8n, SimplePay). Leave the SVG files on disk.
2. **Remove the circular arc line** entirely (the 1px ring). Tiles still travel
   the same circular path — the geometry stays, only the drawn line goes.
3. **Visible queue = the next 4 only.** The docked tile + the 4 upcoming tiles
   (offsets +1…+4) are visible; every other offset renders at opacity 0
   (still transitions so a tile fades in as it enters +4 and out after it
   leaves the dock — the "previous" tile fades out on the far side as it moves
   away, ~450ms). Size/opacity table for +1…+4: 64px @ .95, 60 @ .8, 56 @ .6,
   52 @ .4 (keep grayscale on all non-docked). Re-space the visible arc so the
   4 sit comfortably above/right of the capsule (roughly 10 o'clock → 2 o'clock
   over the dock end), never overlapping the copy column at ≥ lg.
4. **Centre the capsule.** With no ring and 4 tiles, the capsule (Finch circle +
   docked tile) sits horizontally centred in the canvas at every width; on
   mobile the canvas is full-width so the pill is perfectly centred. Keep the
   `FINCH` mono label under the Finch circle. Recompute the canvas aspect so
   there's no dead space (likely ~560×360; measure).
5. **Status line → prompt line, moved.** Remove the pill chip from the canvas.
   Replace it with a "you talking to Finch" line whose text is a first-person
   request, cycling with the dock. Copy (verbatim, typographic quotes):
   - xero: “Finch, fetch our books from Xero.”
   - whatsapp: “Finch, send me this morning’s brief on WhatsApp.”
   - yoco: “Can you check today’s Yoco takings, Finch?”
   - sage: “Finch, pull the ledger from Sage.”
   - loyverse: “Can you check our latest orders in Loyverse, Finch?”
   - quickbooks: “Finch, reconcile QuickBooks against last week’s invoices.”
   - gmail: “Anything from suppliers in Gmail this morning, Finch?”
   - outlook: “Finch, watch the Outlook inbox for statements.”
   - notion: “Finch, put the ops notes in Notion.”
   - n8n: “Finch, kick off the n8n workflow when the order lands.”
   - simplepay: “Can you check this month’s payroll in SimplePay, Finch?”
   Placement: **desktop (≥ lg)** — in the LEFT copy column, directly under the
   paragraph "Nothing to migrate…", `margin-top: 28px`. **Mobile (< lg)** —
   directly under the widget, left-aligned with the copy. Style: a row —
   the active logo at 20px in a 32px white circle (border `#E7E3DA`) + the text
   at 17px/1.45 STIX Two Text (regular, not italic) `#14120E`; a mono eyebrow
   above it `YOU ASK · FINCH DOES` 10.5px .14em `#8A8474`. Text + logo
   crossfade on step (opacity, y 6→0, 180ms ease-out); reserve height for the
   longest line (2 lines at mobile) so nothing shifts. Reduced motion → static
   Xero line.
   Implementation: lift the active index into `Senses.tsx` (make it a client
   component, or add a thin client wrapper `SensesLive.tsx` that Senses
   renders) — `IntegrationsOrbit` takes `active` + `onStep(nextIndex)` (or owns
   the interval and calls `onActive(index)`); `IntegrationPrompt` is a pure
   presentational component rendered twice (`hidden lg:block` in the copy
   column, `lg:hidden` under the widget) — same source of truth, no duplicated
   timers. Hover-pause / in-view pause / visibility pause behaviour unchanged.
6. sr-only list stays (name — short role), minus the two removed tools.

Acceptance: at 1440 the widget shows Finch + docked tool + exactly 4 upcoming
tiles, no ring, capsule centred in its column, prompt line under the copy
cycling in sync; at 375 the capsule is centred on screen and the prompt sits
under the widget; `scrollWidth === innerWidth`; console clean; tsc/eslint clean.

---

## Part B — `/pricing` rebuilt in the Finch design language

Design source: `.ai/design/Pricing.dc.html` (read fully) + parent plan
`.ai/plan_site_rebrand.md` Step 4 pricing copy. Reuse `FinchNav`, `FinchFooter`,
tokens, and the section rhythm from the homepage. Replace `app/pricing/page.tsx`
wholesale (old tiers/PricingSection no longer rendered on this route; do NOT
delete `components/sections/PricingSection.tsx` — list it as unused).

### Page structure (in order)

1. **Nav** — `FinchNav` with the Pricing link in the active colour (`#14120E`
   vs `#4A463C`); add an optional `active` prop to FinchNav if it lacks one.
2. **Hero (from the design)** — max-w 860 centred; eyebrow `ONE OFFER · NO TIERS · NO MATRIX`;
   `<h1>` STIX 500 84px/1.02 -0.03em: `R6,000` + span (30px, `#8A8474`, 400)
   ` / location / month`; italic STIX 24px `#4A463C` `Everything included.`;
   then a one-sentence direct answer under it for AEO (16px `#6B6659`, max-w
   560): `Finch costs R6,000 per location per month, everything included: every
   module and agent, activated in priority order from your operations audit, a
   monthly ops review with your Vyso lead, and 30 days’ notice to cancel.`;
   founding-terms strip exactly as designed (three cells `FOUNDING TERMS` /
   Setup waived · First month free · Rate locked). Mobile: h1 52px, span 20px,
   strip stacks vertically with hairlines.
3. **What's included (accordion)** — `<section id="whats-included">` max-w 860,
   padding 96px 40px 0. H2 STIX 500 34px `What's included` + sub 15.5px
   `#6B6659` `One price. Here is exactly what it buys.` Below: an accordion of
   FIVE groups (each a `<details>`/`<summary>` for no-JS + a11y, styled: row
   padding 22px 0, border-bottom `#E7E3DA`, summary 18px/500 STIX + right chevron
   rotating 150ms; open panel: two-column list at ≥ md, 1 col mobile, items
   14.5px/1.55 `#4A463C` with a leading 5px dot `#B9B3A3`; first group open by
   default). Groups & content sources — pull real content from the repo, do not
   invent:
   - **The platform (modules)** — every marketing module from
     `lib/marketing/modules.ts` + `lib/marketing/module-data/*.ts` (Doc-U,
     OrderFlow, PricePilot, ProcurePulse, InsightGen, ServiceDen, ShiftBoard,
     SupplySync, WasteWatch, PlanWise …): name + one-line capability from the
     module data. Keep the module names as they are in the codebase.
   - **The agents** — Price Watch, Recon, Debtors, Stock Sense, The Brief
     (copy from `components/finch/WhatFinchWatches.tsx`), each with the status
     honesty rule from the parent plan: document intelligence (Doc-U) is live;
     Price Watch `Rolling out`; the others `Activated from your audit roadmap`.
     Render status as a small mono chip.
   - **Integrations** — the 11 from `components/finch/integrations.ts` (name +
     short role) + a line `More on request — expanded mandates priced on scope.`
   - **Support** — only claims that already exist in the repo copy (grep
     `app/faq/page.tsx`, `app/pricing-faq/page.tsx`, `app/founding-client/page.tsx`,
     `app/operations-audit/page.tsx` for support/onboarding commitments) plus the
     parent plan's `Monthly ops review with your Vyso lead` and `Cancel with 30
     days’ notice`. If nothing else is stated anywhere, keep it to those two +
     `WhatsApp and email support during business hours` ONLY if that phrase or
     equivalent exists in current copy; otherwise omit.
   - **Onboarding** — the sequence from the parent plan: one-week Operations
     Audit (R2,000, credited) → rand-quantified leak report with evidence →
     agents/modules activated in priority order from the audit roadmap → your
     current tools connected (nothing to migrate) → first monthly ops review.
   Under the accordion: `Full FAQ →` link (14.5px/500, `#4A463C`, hover
   `#C94F0E`) to `/faq`.
4. **Straight answers (AEO block)** — `<section>` max-w 860, padding 80px 40px 0,
   H2 STIX 500 28px `Straight answers`, four Q&As as `<dl>`/heading pairs
   (question 17px/500 STIX, answer 15px/1.6 `#6B6659`), each answer ≤ 45 words,
   first sentence a complete direct answer:
   - How much does Finch cost? → R6,000 per location per month, everything included. No setup fee for founding clients, first month free, rate locked for as long as you stay.
   - Is there a setup fee? → No. Setup is waived for founding clients. Every engagement starts with a one-week Operations Audit for R2,000, credited to your first month.
   - What if we have several branches or need custom integrations? → Multi-entity groups and custom integrations are expanded mandates, priced on scope. Book the audit and we'll quote it in the roadmap.
   - Can we cancel? → Yes — 30 days' notice, no lock-in.
   Then the `Full FAQ →` link is NOT repeated (it's above); fine.
5. **Vyso Academy (secondary)** — `<section id="academy">` max-w 860,
   padding 96px 40px 0: a single quiet card (white, border `#E7E3DA`, radius 12,
   padding 32px 36px, no shadow) laid out as: left — mono eyebrow `VYSO ACADEMY ·
   THE DIY OPTION` 10.5px .14em `#8A8474`; H2 STIX 500 26px `Rather run the
   playbook yourself?`; p 15px/1.6 `#6B6659` `Vyso Academy teaches your team the
   same operating method Finch runs — workshops, templates and the weekly-brief
   discipline — without the agents doing it for you.`; right — price STIX 500
   34px `R500` + `/ seat` (16px `#8A8474`), mono chip `COMING SOON` (10px .12em
   `#8A8474`, border `#E7E3DA`), and a secondary button `Register interest`
   (white, border `#D8D3C6`, 13.5px/600 `#14120E`, hover border `#C9C3B4`) →
   `/contact?topic=academy` (the contact form must not break with the query;
   ignore it if unused). Mobile stacks. This block must read as clearly
   secondary to Finch (smaller type, no orange).
6. **Audit CTA (from the design)** — `<section id="audit">` max-w 700 centred:
   H2 STIX 500 34px `It starts with a one-week Operations Audit.`, p (design
   copy verbatim), orange button `Book your audit` → `/contact`, mono
   `EXPANDED MANDATES PRICED ON SCOPE` 48px below.
7. **Footer** — `FinchFooter` (design footer padding 140px top on this page).

### SEO / AEO / GEO

- `export const metadata`: title `Finch pricing — R6,000 per location per month, everything included | Vyso`;
  description (≤ 155 chars) `Finch by Vyso costs R6,000 per location per month, everything included. Founding clients: setup waived, first month free, rate locked. Starts with a R2,000 operations audit.`;
  `alternates.canonical: https://vyso.co.za/pricing`; OpenGraph + Twitter
  (title/description/`/og.png` as the site already uses); `robots: index, follow`.
- JSON-LD (one `<script type="application/ld+json">` in the page, server-
  rendered):
  - `Product` (`name: "Finch"`, `brand: Vyso`, `description`, `url`,
    `offers`: `Offer` with `price: "6000"`, `priceCurrency: "ZAR"`,
    `priceSpecification: UnitPriceSpecification { price 6000, priceCurrency
    ZAR, unitCode "MON", referenceQuantity {value 1, unitText "location"} }`,
    `availability: InStock`, `url: https://vyso.co.za/pricing`, `eligibleRegion:
    ZA`), plus a second `Offer` for the Operations Audit (`price 2000`) and a
    third for Academy (`price 500`, `availability: PreOrder`, unitText "seat").
  - `FAQPage` with the four Straight-answers Q&As (question/acceptedAnswer text
    identical to the on-page copy).
  - `BreadcrumbList` Home → Pricing.
  Validate shape mentally against schema.org; keep it plain JSON, no fabricated
  ratings/reviews/aggregateRating.
- Headings: exactly one `<h1>` (the price), H2s per section, no skipped levels.
  Every section has descriptive text (GEO likes complete sentences and explicit
  numbers with units: "R6,000 per location per month").
- `app/sitemap.ts`: confirm `/pricing` is present with a recent `lastModified`
  (update the date if it's static). Don't touch other entries.
- Grep the repo for the old pricing metadata description on `app/pricing/page.tsx`
  mentioning R10,000/R8,000 — it goes with the rewrite (that was the only
  in-page metadata; the sitewide grep sweep for tiers is a later pass).

### Files

MODIFY `app/pricing/page.tsx` (rewrite), `components/finch/FinchNav.tsx`
(optional `active` prop), `app/sitemap.ts` (lastModified only, if needed).
CREATE `components/finch/pricing/*` (e.g. `PricingHero.tsx`, `WhatsIncluded.tsx`,
`StraightAnswers.tsx`, `AcademyCard.tsx`, `AuditCta.tsx`, `pricing-data.ts`,
`pricing-jsonld.ts`). Report section "v4 (pricing)" in the implementation md,
including the exact "What's included" content and its sources.

Acceptance: `/pricing` renders per design at 1440 + 375, accordion works
without JS (details/summary) and looks right with JS, JSON-LD parses (`JSON.parse`
of the script content in the browser), `curl -s localhost:3000/pricing | grep -c
"application/ld+json"` = 1, one `<h1>`, no orange except the CTA buttons and
`FOUNDING TERMS` eyebrows (as designed), console clean, tsc/eslint clean.
