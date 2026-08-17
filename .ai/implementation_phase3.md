# Implementation: Phase 3 — company · verticals · legal · learn/glossary/resources

Plan: `.ai/plan_phase3_company_verticals_content.md`. Each workstream appends
its own section below under its own heading. Do not edit another
workstream's section.

## B — founding / case studies / south-africa

Workstream B of `.ai/plan_phase3_company_verticals_content.md`:
`/founding-client`, `/case-studies`, `/case-studies/turn-n-slice`,
`/south-africa`. **Nothing committed, no git commands run.** No file outside
this workstream's list was touched (verified: `/industries/*`, `/about`,
`app/globals.css`, `FinchFooter.tsx` all left alone; their concurrent edits
from other workstreams — the footer's Legal column now carrying Terms/POPIA,
`/about` resolving 200 — were observed during browser verification but not
made by this workstream).

### Files created

| File | What |
|---|---|
| `lib/marketing/founding.ts` | `/founding-client`'s data: `FOUNDING_TERMS` (re-exported, not retyped — imported from `components/finch/pricing/pricing-data.ts` so the founding terms can never say something different on the two pages that state them), `FOUNDING_GETS` (5 steps), `FOUNDING_ASKS` (3), `COHORT` (8 seats, only 1 non-null), `FOUNDING_FAQS` (5 items looked up by id from `lib/marketing/faq.ts`'s `pricing` group — throws at import time if an id goes missing, so the page and its schema can never drift from `/faq`). Title/description sized and verified by script (54 / 143 chars). |
| `components/finch/company/CompanyBits.tsx` | Shared `Breadcrumb`/`Eyebrow`, same shape as `components/finch/compare/CompareBits.tsx`, kept as this workstream's own copy per the plan's "shared small bits allowed within this workstream only" rule. |
| `components/finch/company/TermsStrip.tsx` | Signature-adjacent bit for `/founding-client`: the three founding terms revealing left→right (opacity+x, staggered 120ms per cell), once on enter. Reduced motion → all three render at rest immediately. |
| `components/finch/company/CohortRow.tsx` | **The `/founding-client` signature visual.** 8 circles; fills only what's true (`COHORT` data — Turn 'n Slice is the one filled seat, linked to the case study), the rest hollow with a mono `OPEN` chip. Scale+fade in, staggered 60ms left to right, once. Colour discipline: a filled seat is neither agent activity nor evidence, so it's plain ink, not orange or blue — only the one real link's hover state uses orange. |
| `components/finch/company/PriceListDemo.tsx` | **The `/case-studies/turn-n-slice` signature visual.** The "price list in seconds" micro-demo: a mono item name types in (40ms/char, the `SymptomChecklist.tsx` DOM-write idiom — no React state, so no `react-hooks/set-state-in-effect`), then a priced row appears behind a blue highlight sweep (the `InvoiceCard.tsx` "evidence, just read" motif). Plays once on enter (`useInView`, `once: true`), total ≤1.5s (720ms typing + a 250–370ms reveal). Reduced motion → the finished row renders immediately, no typing, no sweep. Captioned `ILLUSTRATIVE DEMO` — it's a worked example, not a screenshot of Turn 'n Slice's real price list. |
| `components/finch/company/SouthAfricaMap.tsx` | **The `/south-africa` signature visual.** A hand-drawn-simplified straight-segment SA outline (no map library) with one expanding-ring pulse at Johannesburg that fades to nothing once, on enter, leaving a static dot. Reduced motion → the ring never draws; only the static dot and its `JOHANNESBURG` label are ever rendered. |
| `components/finch/company/company-jsonld.ts` | Four schema builders (`buildFoundingSchema`, `buildCaseStudiesHubSchema`, `buildTurnNSliceSchema`, `buildSouthAfricaSchema`), same pattern as `pricing-jsonld.ts`/`compare-jsonld.ts`: page-scoped nodes only, `Organization`/`WebSite`/`SoftwareApplication` stay in `app/layout.tsx`'s graph and are referenced by `#organization`. `buildTurnNSliceSchema` emits `Article` (never `Review`, no `aggregateRating`) with `about` naming Turn 'n Slice as its own `Organization`, `author`/`publisher` both the Vyso `Organization`. FAQPage entities are read straight off the same arrays the pages render. |

### Files rebuilt

- `app/founding-client/page.tsx` — full rebuild from `PublicPageShell`/glass
  into the Finch language. `<h1>` "Founding client terms." → `TermsStrip` →
  "What a founding client gets" (5 numbered steps) → "What we ask in return"
  (3) → `CohortRow` + a page-specific `FindingCard` (Turn 'n Slice, `state=
  "resolved"`, linking the case study) → the 5 imported FAQs as a `<dl>` →
  `AuditBand` → `FinchFooter`. `FinchNav` with no `active` (founding-client
  isn't one of the four top-level nav sections).
- `app/case-studies/page.tsx` — reskin. One honest entry (Turn 'n Slice),
  "More stories, as they become real." kept, plus a new page-specific
  `FindingCard` (`agent="CASE STUDIES"`, `state="in-progress"`) stating the
  hub's own honest count rather than an invented example.
- `app/case-studies/turn-n-slice/page.tsx` — reskin. Every quote and fact
  verified byte-identical (see below) — new additions are the `PriceListDemo`
  signature visual, a closing page-specific `FindingCard`, and links updated
  for the new IA (`/platform` → `/`, since the homepage is now the product
  page; `Explore the platform` → `Explore Finch`).
- `app/south-africa/page.tsx` — rebuild. Local capabilities re-grounded
  against `lib/platform/**` (grep citations in the file's own header
  comment), FAQs imported from `lib/marketing/faq.ts` rather than restated,
  `SouthAfricaMap` signature visual, one new illustrative page-specific
  `FindingCard`.

### Grounding — what was kept, what was dropped, what was verified

Grepped `lib/platform/**` before writing any South Africa capability claim
(cited per-line in `app/south-africa/page.tsx`'s own header comment):

- **ZAR pricing** — `components/finch/pricing/pricing-data.ts` (`PRICE.currency
  === "ZAR"`). Kept.
- **VAT treatment** — `lib/platform/orderflow-from-doc.ts` (`vat_treatment`,
  `vat_rate`, default 15%), `lib/platform/import-schema.ts` (`vat_treatment`,
  `vat_number`, `vat_rate` fields). Kept.
- **EFT/cash/card payments** — `lib/platform/orderflow.ts`: `PaymentMethod =
  'eft' | 'cash' | 'card' | 'other'`, `PAYMENT_METHODS`. Kept.
- **Rebates, credit limits, customer PO, delivery addresses, payment terms** —
  `lib/platform/orderflow.ts` (`rebate_pct`, `credit_limit`, `customer_po`,
  `delivery_address_id`), `lib/platform/orderflow-data.ts`
  (`cd_payment_terms`, `cd_delivery_addresses`). Kept.
- **WhatsApp/email/PDF/photo intake** — `lib/platform/whatsapp-ingest.ts` +
  Doc-U; reused via the imported FAQ answer rather than re-derived.
- **POPIA compliance boundary, VAT-aware invoices, accounting-replacement
  boundary** — no new claims written. All three FAQ answers are imported
  verbatim from `lib/marketing/faq.ts` (`does-finch-make-us-popia-compliant`,
  `vat-aware-invoices`, `does-finch-replace-accounting-software`), which
  already carry their hedged, previously-verified wording. This was a
  deliberate choice beyond the plan's literal instruction (which only names
  founding-client's FAQs as "imported") — importing rather than
  re-deriving keeps a South African POPIA/VAT claim from ever reading
  differently on `/faq` and `/south-africa`.

**Two claims dropped, not carried forward** from the pre-rebuild
`/south-africa`:
1. **"Load-shedding-tolerant."** Never actually appeared as a stated claim on
   the live page (checked against the Read of the file before editing) but
   is named in `.ai/vyso_v2.md` §2.2's disposition table as something to
   verify "only if true." Grep for the term across `lib/platform/**` returns
   zero hits — nothing in the product makes or supports this claim — so it
   was never added.
2. **`LocalBusiness` schema / street address.** `lib/marketing/site.ts`
   states explicitly there is no public address to publish; `areaServed: ZA`
   is used instead, consistent with the sitewide graph in `app/layout.tsx`.

### Byte-identical quotes and facts — verified by extracting rendered text

Per the constraint ("copy refresh only — every quote and fact must remain
byte-identical"), the following were kept as exact strings (not
paraphrased) and confirmed present, unchanged, in the built HTML via a
Python substring check against the rendered `/case-studies` and
`/case-studies/turn-n-slice` pages:

- Roberto's blockquote: "Vyso is automating our entire invoicing
  operation. We can build price lists in seconds and manage every customer
  account from one central operational brain." — **present, verbatim**
  (still says "Vyso," not "Finch" — a real person's quote is never reframed).
- Byline: "Roberto · Turn 'n Slice · Johannesburg, South Africa" — **present,
  verbatim**.
- Caption: "Founding-customer statement about the current OrderFlow
  implementation." — **present, verbatim**.
- The hero `compactLead` fact ("Turn 'n Slice is a Johannesburg food
  business and Vyso's first founding customer. OrderFlow is already
  replacing QuickBooks…") — **present, verbatim**, entity-for-entity
  (`&apos;` kept, not swapped for the Finch redesign's usual `&rsquo;`,
  specifically for this sentence).
- The hub's equivalent paragraph ("A Johannesburg FMCG food business, and
  Vyso's first founding customer. OrderFlow is already replacing
  QuickBooks…") — **present, verbatim**, same entity-preservation rule.
- All four capability cards (title + copy: "Price lists in seconds,"
  "Central customer accounts," "Connected invoicing," "Repeat work
  automated") — **present, verbatim**.
- All four stat-grid facts (`Johannesburg`/`South African operation`,
  `FMCG food`/`Sector`, `Founding`/`Customer relationship`,
  `OrderFlow`/`Invoicing platform`) — **present, verbatim**.
- All four "What the work reinforces" bullets — **present, verbatim**.

Everything *around* these strings (headings, eyebrows, section framing, CTA
labels, the sr-only h2 text) was freely rewritten for the Finch reskin and
the new signature visual/FindingCard — the plan's own examples of what must
stay byte-identical name specifically Roberto's quotes, "OrderFlow replacing
QuickBooks," and the four capabilities, not the page's furniture.

### Deviations from the plan

1. **South Africa's FAQs are imported from `lib/marketing/faq.ts`, not
   freshly written**, even though the plan only explicitly calls this out
   for founding-client. Reasoning above (single source of truth for a
   sensitive claim like POPIA compliance).
2. **The Johannesburg pulse dot is orange (`var(--fn-orange)`), not a
   neutral colour.** Colour discipline reserves orange for "agent activity +
   CTA + finding impact." Treated as a considered exception: the dot reads
   as "we are live/active here" (same semantic family as the `FindingCard`
   header's orange pulse dot for a `NEW` finding), not as an unrelated
   decorative accent — the ring pulses once and fades to a small static dot,
   never a loop.
3. **`TermsStrip`'s "FOUNDING TERM N" label uses `fn-orange-deep`,** matching
   the exact precedent already shipped on `/pricing`
   (`PricingHero.tsx`'s "FOUNDING TERMS" label uses the same class) — not a
   new colour-discipline exception, a continuation of an existing one.
4. **`/case-studies/turn-n-slice`'s "Explore the platform" CTA became
   "Explore Finch" → `/`,** not a straight reskin of the label. `/platform`
   is retired in the v2 IA (the homepage is now the product page per
   `.ai/vyso_v2.md` §2.2), so keeping the old href would have linked a
   redirect chain rather than the real destination.
5. **`lib/marketing/founding.ts` holds only `/founding-client`'s data.**
   `/case-studies`, `/case-studies/turn-n-slice` and `/south-africa` keep
   their body copy inline in their own page files (matching the pre-rebuild
   pages' own pattern for `/south-africa`, and deliberately for the two
   case-study pages: moving byte-identical-constrained copy through an
   extra data-file layer adds a place a character could silently drift
   without a direct before/after diff catching it).

### Verification

```
$ npx tsc --noEmit
```
Only pre-existing errors outside this workstream: the 3 known
`lib/platform/whatsapp-ingest.ts` errors (owned by another branch of work
per `.ai/vyso_v2.md` Phase 0) and errors in `app/learn/[slug]/page.tsx` /
`lib/marketing/glossary.ts` (Workstream D's files, concurrently mid-flight —
confirmed by re-running `grep` against this workstream's own file list:
zero matches).

```
$ npx eslint app/founding-client app/case-studies app/south-africa \
    components/finch/company lib/marketing/founding.ts
```
Clean, no output. (One `react-hooks/set-state-in-effect` error surfaced
during development in `PriceListDemo.tsx` — fixed by rewriting the
reveal step as direct `element.style` writes through refs, the same
idiom `FindingCard.tsx`'s `useTilt` uses, instead of a `setState` call
inside the typing effect. One `import/no-anonymous-default-export`
warning in `founding.ts` — fixed by naming the object before exporting it.)

```
$ curl -s -o /dev/null -w '%{http_code}' localhost:3000/<path>
/founding-client                200
/case-studies                   200
/case-studies/turn-n-slice      200
/south-africa                   200
```
One `<h1>` on each (script-counted against the fetched HTML, not eyeballed).

**JSON-LD.** Fetched all four pages' HTML, extracted every
`<script type="application/ld+json">` block, parsed with Python's
`json.loads` — 2 blocks per page (the root layout's sitewide graph +
the page's own), all 8 parse. Page-own graph types: founding-client
`BreadcrumbList · Service · FAQPage`; case-studies hub `BreadcrumbList ·
ItemList`; turn-n-slice `BreadcrumbList · Article`; south-africa
`BreadcrumbList · Service · FAQPage`.

**Byte-identical quote/fact check.** Extracted rendered text (tags
stripped, whitespace collapsed) from the built HTML and substring-matched
all twelve quote/fact strings listed above against it — all twelve found,
verbatim. (Full method and results in the section above.)

**Internal link check.** Extracted every unique `href` (26, `#`-stripped)
from the four pages' rendered HTML, curled each against the dev server:
all 200, including `/industries/food-suppliers`, `/industries/farms`,
`/industries/restaurants`, `/platform/modules/orderflow`,
`/operations-audit`, `/pricing`, `/faq`, `/about` (currently live, not a
redirect — Workstream C's concurrent work, not this workstream's doing).

**Grep gates** over `app/founding-client app/case-studies app/south-africa
components/finch/company lib/marketing/founding.ts`:
```
R10,000|R30,000|R50,000|setup fee|Start, Create|Vyso AI|Join Waitlist|backdrop- → 0
```
No `blur(`, no `glassmorphism`, anywhere in this workstream's files.

**Colour discipline, checked by grep then read in context.** Every
non-hover `fn-orange*` use in this workstream's files: the Johannesburg
pulse dot (deviation 2), the "FOUNDING TERM N" label (deviation 3 —
existing precedent). Every `fn-blue*` use: `PriceListDemo`'s highlight
sweep (the established "evidence, just read" motif). Nothing else uses
either colour outside the standard link/CTA hover convention every other
Finch page already uses.

**Browser, own tab (`tab-2`, fronted before every screenshot per the
concurrency rule — the shared pane repeatedly went `visibilityState:
hidden` between calls, same throttling other Phase 2 workstreams
reported; re-fronting and re-screenshotting recovered every time).**

*1440×900.* All four pages walked top to bottom. Founding-client: terms
strip, 5 "gets" steps, 3 "asks," `CohortRow` (1 filled/labelled circle + 7
hollow `OPEN` circles), the page-specific `FindingCard`, 5 imported FAQs,
`AuditBand`, footer. Turn-n-slice: hero, stat grid, `PriceListDemo` —
watched it play live: "Butternut" mid-type → completed "Butternut 10kg
bag" with the blue sweep and "R 620.00 / bag" priced row both visible —
capability cards, Roberto's quote (still says "Vyso," confirmed), closing
`FindingCard`. Case-studies hub: hero, the one entry card, the honest
"More stories" list, the meta `FindingCard`. South-africa: hero with the
SA outline + Johannesburg dot (pulse ring already resolved to its static
end state by the time of screenshot, consistent with "plays once"), 6
local-capability cards, the operating-boundary split with SARS/POPIA
source links, the illustrative `FindingCard` (cooking oil / Johannesburg,
captioned `ILLUSTRATIVE EXAMPLE`, distinct content from the homepage's
FreshCo/butternut card), 3 migration steps, 5 imported FAQs, 3 sector
cards, `AuditBand`.

*375×812.* `document.documentElement.scrollWidth === window.innerWidth ===
375` on all four pages (script-checked, not eyeballed) — zero horizontal
overflow anywhere. Founding-client mobile: terms strip stacks
(`divide-y`), the 5 "gets" steps and cohort row (`flex-wrap`, 4 circles per
row) both readable and unclipped.

**Console.** `read_console_messages({onlyErrors: true})` on all four pages:
no errors.

### Not verifiable in this environment

- **A real `prefers-reduced-motion: reduce` OS profile.** All four reduced-
  motion branches (`TermsStrip`, `CohortRow`, `PriceListDemo`,
  `SouthAfricaMap`) were verified by code reading — each explicitly checks
  `useReducedMotion()` and renders the finished state with no transition —
  not by toggling an actual OS setting in this tooling. Same category of gap
  every earlier phase's report notes.
- **The cohort row's and terms strip's staggered reveal, sampled mid-
  animation.** Confirmed by reading the `delay`/`duration` values and by the
  finished-state screenshots; not sampled frame-by-frame.

### Orphaned files

None. This workstream created new files and rebuilt exactly the four page
files in its list; nothing it touched was previously the sole importer of
anything now-unused.

---

## D — learn / glossary / resources

Workstream D of `.ai/plan_phase3_company_verticals_content.md`: `/learn` + the
8 articles rebuilt in the Finch language, `/learn/glossary` + 12 term pages
added, `/resources` + 3 detail pages rebuilt. **Nothing committed.** No file
outside D's list was touched (`FinchFooter.tsx` deliberately not touched — it
is C's).

### Files created

| File | What |
|---|---|
| `lib/marketing/glossary.ts` | The 12 terms, each with a 60–120-word definition (measured: 83–98 words), a "why it matters for an SA food business" block, one illustrative `FindingCard` example, related terms/articles/pages, and hand-written `metaTitle`/`metaDescription`. Plus `GLOSSARY_ALPHABETICAL`, `GLOSSARY_SLUGS`, `getGlossaryTerm()`, `firstSentence()` and `GLOSSARY_HUB`. Server-safe by construction. |
| `components/finch/learn/learn-jsonld.ts` | Six builders — learn hub (`BreadcrumbList` + `ItemList`), article (`BreadcrumbList` + `Article`), glossary hub (`BreadcrumbList` + `DefinedTermSet` with 12 nested `DefinedTerm`s), term (`BreadcrumbList` + `DefinedTerm`), resources hub (`BreadcrumbList` + `ItemList`), resource (`BreadcrumbList` + `CreativeWork`). Each reads the objects the page renders. References the root layout's `#organization` and `#josh` `@id`s rather than minting second nodes for the same entities. |
| `components/finch/learn/LearnBits.tsx` | Server. `CategoryFilter`, `ArticleCard`, `FeaturedArticle`, `AuthorBox`, `SourcesBlock`, `ArticleAgents`, `TermChips`, `IllustrativeFinding`, plus `SECTION`/`H2`/`LEAD`/`READING_COLUMN`, `formatDate()` and `headingId()`. |
| `components/finch/learn/ReadingProgress.tsx` | `"use client"`. **The signature visual**: a 1px ink hairline fixed to the top of the viewport, `scaleX` driven by `useScroll().scrollYProgress` through a spring. Appears on `/learn/[slug]` and nowhere else on the site. |
| `components/finch/learn/ArticleToc.tsx` | `"use client"`. Sticky from `lg`, current-heading highlight via `IntersectionObserver` over a band across the top third of the viewport. |
| `components/finch/learn/ResourceCard.tsx` | `"use client"`. **The page-flip hover** — `rotateX: 6°` about the card's bottom edge with `transformPerspective: 1000`, 200ms ease-out. `/resources` only. |
| `app/learn/glossary/page.tsx`, `app/learn/glossary/[term]/page.tsx` | New routes. |

### Files rebuilt / modified

- `app/learn/page.tsx` — `FinchNav active="learn"` → breadcrumb → eyebrow
  `LEARN` → `<h1>` "Operations knowledge, not sales copy." → featured article →
  category filter + grid → glossary/resources cards → `AuditBand` → footer.
  `PublicPageShell`, `AbstractFlowBackdrop`, `MarketingCta` and
  `marketingStyles` are gone. The filter is link-driven and server-side, so the
  hub ships no JavaScript of its own and every filtered view has its own URL.
- `app/learn/[slug]/page.tsx` — the reading layout: 720px column,
  `lg:sticky` TOC, `AuthorBox`, `SourcesBlock` (conditional), the closing
  `FindingCard` + related agents + glossary chips, related solutions/industries,
  related articles, `AuditBand`. `META_TITLES` (one override) and
  `META_DESCRIPTIONS` (all eight) live in the route file, same pattern as
  Workstream A's modules page and for the same reason (see deviation 3).
- `app/resources/page.tsx`, `app/resources/[slug]/page.tsx` — rebuilt in the
  Finch language; the preview content is byte-for-byte what it was. The detail
  page's request section is headed "Send me the &lt;resource&gt;." and uses
  `ContactForm variant="general"` — **no new variant was created**.
- `lib/marketing/learn-articles.ts` — see below.
- `lib/marketing/resources.ts` — titles rewritten (they carried their own
  "| Free Resource | Vyso", which the root layout's `%s | Vyso` template turns
  into a doubled suffix), descriptions trimmed to ≤ 155, and **one dead Learn
  link fixed** (`/learn/12-operational-kpis-every-ceo-should-track` → the real
  `/learn/how-much-time-can-workflow-automation-save`). Preview sections,
  bullets and `whoItsFor` untouched.
- `app/sitemap.ts` — one insertion: `/learn/glossary` plus
  `...GLOSSARY_SLUGS.map(...)`, generated from the data file so a thirteenth
  term cannot ship unlisted. Re-read immediately before editing (C also edits
  this file; C's `/terms`, `/popia`, `/about`, `/academy` entries were already
  in place and were left alone).

### `learn-articles.ts` — what changed and what deliberately did not

**Claims are untouched.** Every figure, range and sentence of analysis is what
it was, with one exception: the old tiered-pricing paragraph in
`how-much-time-can-workflow-automation-save`, which described an entry-level
package with a five-automation cap. It is rewritten to the single offer
(agents watch the tools you already run; the audit ranks the work; one price
per location per month, everything included) and split into two paragraphs.
`grep -rn "Start tier" lib/marketing` → **0 matches**, including comments (the
first draft of the file header quoted the phrase and was reworded so the gate
passes on substance, not on a hyphen).

**Vyso → Finch** in four places where the sentence is about the product doing
the watching: three "How Vyso helps" bodies and all eight of those section
headings, now "How Finch helps". `grep -n '"[^"]*Vyso' lib/marketing/learn-articles.ts`
→ 0 (no rendered string names Vyso as the thing reading invoices).

**Author.** `author` is now `SITE.founder.name` (Josh Moreira) instead of
"Vyso Team", and the `Article` schema's `author` points at the root layout's
`#josh` Person node. Reasoning in the file header: Vyso is a one-person company
at this stage per `.ai/vyso_v2.md` §2.3, so the named byline is the more honest
of the two and §7.4 wants a person for E-E-A-T. **Flagging this as a content
judgement the user may want to overrule.**

**Dates — how they were derived.**

```
$ git log --follow --format=%aI -- lib/marketing/learn-articles.ts
2026-08-03T15:52:11+02:00
```

One commit, so there is no per-article modification history to read and the
plan's stated fallback applies. `publishedDate` was renamed `datePublished`
and keeps its existing per-article value (2026-07-06 … 2026-07-27 — data the
file already carried, not something derived or invented here). `dateModified`
is a new exported constant `LEARN_LAST_MODIFIED = "2026-08-03"`, the file's
single commit date, used for all eight. It is deliberately **not** today's
date: this phase's edits are uncommitted, and a `dateModified` running ahead of
the repository is a claim git cannot support. A `TODO(user)` on the constant
says to bump it when the file is next committed.

**Sources.** No article on the site cites an external study. Four of them state
their own basis in the body ("In our conversations with South African
operators…", "Across the operators we speak to…"), and those four get a
`sources` entry naming that basis and saying plainly that it is first-party and
not a measured statistic. The other four get nothing — the block simply does
not render. No citation was invented to fill it.

**New presentation fields** (`about`, `agents`, `endFinding`, `keyTerms`): the
agent labels and status chips are copied verbatim from
`components/finch/agents/agents-data.ts`, so no article can present a roadmap
agent as shipped. Every `endFinding` renders under `ILLUSTRATIVE EXAMPLE`.

### The signature visuals

- **Reading-progress hairline** (`/learn/[slug]` only). Ink, not orange —
  orange is reserved for agent activity and CTAs, and a reading indicator is
  neither. A spring rather than the raw motion value, because at 1px the
  trackpad's sub-pixel jitter is visible as a shimmer. **Reduced motion →
  nothing rendered at all**, which is stricter than the usual static-end-state
  rule and deliberate: the end state of a progress bar is a full-width line
  that means nothing, and the scrollbar already carries the information.
  SSR-safe: it renders at `scaleX: 0`, a zero-width fixed line, so server and
  first client paint agree.
- **Page-flip hover** (`/resources` only). `rotateX(6deg)` about
  `transform-origin: bottom center` with `transformPerspective: 1000` — hinged
  at the far edge like a page, not through the middle like a flipping card —
  and the card shadow deepens on the same 200ms so the lifted edge has
  somewhere to lift away from. Reduced motion → no rotation; border and shadow
  still respond.

### Deviations from the plan

1. **26 pages, not 25.** learn hub (1) + articles (8) + glossary hub (1) +
   terms (12) + resources hub (1) + resource details (3) = 26. The plan's
   count is one short of its own list; nothing was added or dropped.
2. **No VAT rate is printed anywhere.** `vat-inclusive-pricing` explains the
   mechanic ("divide by one plus the VAT rate") and carries a `ONE CAVEAT`
   block pointing at SARS, rather than quoting a percentage. A rate in a
   glossary is a fact with an expiry date and nothing in this repo checks it;
   this is the honesty rule applied to a number that would be right today and
   silently wrong later.
3. **`META_TITLES` / `META_DESCRIPTIONS` maps in `app/learn/[slug]/page.tsx`**
   rather than new fields on `LearnArticle`. The data file's `description` is
   the card copy on `/learn` and runs 180+ characters; trimming it there would
   make the cards worse to serve the `<head>`. One title override only (the AI
   article is 54 chars + " | Vyso" = 61).
4. **The featured article renders above the filter on filtered views too.** It
   is labelled `START HERE` and sits outside the filtered grid, so it reads as
   an editorial recommendation rather than a filter leak.
5. **`Breadcrumb`, `Eyebrow`, `StatusChip` and `ArrowLink` are imported from
   `components/finch/solutions/SolutionBits`**, not copied into
   `components/finch/learn/`. They are the generic Finch chrome every rebuilt
   page uses; a second copy would be a second thing to keep in step. Read-only
   import — that file was not modified.
6. **`CreativeWork`, not `Product`/`Offer`, on resource pages.** The resource
   is a free document sent by a person; there is no price, no `availability`
   and deliberately no download URL to claim.
7. **`firstSentence()` uses `[\s\S]` instead of the `s` regex flag** — this
   repo's tsconfig targets ES2017, where `s` is a compile error (caught by
   `tsc`, fixed, noted here because it is a repo-wide constraint).

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10)   TS2724
lib/platform/whatsapp-ingest.ts(408,36) TS7006
lib/platform/whatsapp-ingest.ts(589,5)  TS2353
```
Exactly the three known pre-existing WhatsApp errors, nothing else.

```
$ npx eslint app/learn app/resources components/finch/learn \
    lib/marketing/learn-articles.ts lib/marketing/glossary.ts \
    lib/marketing/resources.ts app/sitemap.ts
```
Clean, no output.

**Routes.** All 26 return 200 with exactly one `<h1>`:
`/learn`, the 8 articles, `/learn/glossary`, the 12 terms, `/resources`, the 3
resource details.

**`<title>` / meta description budgets** (measured on the rendered HTML,
including the ` | Vyso` the root template appends): titles 42–59 chars,
descriptions 139–155. Zero over budget. Six glossary titles and seven
descriptions were shortened after the first measurement showed them over.

**Internal links.** Every internal `href` rendered by the 26 pages — 60 unique
paths — was curled: **all 200, zero 308s, zero broken**. That includes all four
`/solutions` pages, all six industry slugs, `/compare/finch-vs-hiring-a-coo`,
`/operations-audit`, `/platform/modules`, `/privacy`, `/pricing`, `/faq`,
`/south-africa`, `/#agents`, all 13 glossary URLs and all 3 resources. Note
`/about` now returns 200 (Workstream C removed the redirect) where Phase 2
recorded it as a 308.

**JSON-LD.** Both `<script type="application/ld+json">` blocks on every one of
the 26 pages parse as JSON (root layout's sitewide graph + the page's own).
Node types per tree: articles `BreadcrumbList` + `Article`; glossary hub
`BreadcrumbList` + `DefinedTermSet` (12 `hasDefinedTerm`); terms
`BreadcrumbList` + `DefinedTerm`; resources `BreadcrumbList` + `CreativeWork`.

**Grep gates** over `app/learn app/resources components/finch/learn
lib/marketing/{learn-articles,glossary,resources}.ts app/sitemap.ts`:

```
Start tier                                          → 0
backdrop-|glassCard|blur(|PublicPageShell|marketingStyles → 0
lucide                                              → 0
fn-grad|gradient                                    → 0 (zero gradients in this tree)
R30,000|R50,000|R3,000 per|setup fee|Start, Create|Vyso AI|Join Waitlist → 0
R10,000                                             → 1, documented below
```

The single `R10,000` hit is a **false positive**: it is inside an existing,
untouched article claim — "For a business turning over R500,000 a month, that
is R10,000 to R40,000 disappearing every month" — a leakage range, not the old
`R10,000` Start-tier price. The gate exists to catch the retired tier prices;
`R30,000` and `R50,000` are both absent. Flagging rather than editing, because
the instruction was to leave existing claims alone.

**Word counts** of the 12 definitions: 83, 85, 86, 88, 90, 92, 92, 93, 93, 94,
98 and 83 words — all inside the 60–120 band.

### Browser (own tab `tab-4`, fronted before every measurement, dev server :3000 shared with three other workstreams)

**Reading-progress hairline, 1440×900**, measured on
`/learn/hidden-cost-of-manual-procurement`: `position: fixed`, `height: 1px`,
`background: rgb(20,18,14)` (`--fn-ink`), `transform-origin: 0px 0.5px` (left).
`scaleX` sampled at three scroll positions: **0.437 → 0.500 → 0.998**. The TOC's
`aria-current` moved from "The problem in plain terms" at the top to "How Finch
helps" at the bottom.

*Worth recording:* the first two attempts read `scaleX: 0` at every scroll
position and the TOC never moved — because the pane was not fronted (three
other workstreams were re-fronting it mid-session) and Chrome throttles
rAF/IntersectionObserver in background tabs. Both work correctly once fronted.
This is the concurrency hazard the plan warns about, confirmed empirically.

**Page-flip hover**, measured on `/resources` by dispatching
`pointerenter`/`pointerleave`: the card's computed transform goes from identity
to `matrix3d(1,0,0,0, 0,0.994522,0.104528,-0.000104528, 0,-0.104528,0.994522,…)`
— cos/sin of exactly 6° with the 1/1000 perspective term — and returns to
identity on leave. `transform-origin` measured at x = card centre, y = card
height (bottom edge).

**Geometry.** `documentElement.scrollWidth === clientWidth` at 1440 (1425 =
1425) and at 375 (375 = 375). A sweep of every element inside `<main>` for
`right > viewport` or `left < 0` returned **0 overflowing elements** on
`/resources`, `/learn/glossary/vat-inclusive-pricing` and
`/learn/why-businesses-lose-money-without-realising-it` at 375×812. The TOC's
container computes `display: none` at 375 (`hidden lg:block`), as intended.

**Colour discipline**, computed-style sweep of `<main>` on an article page:
orange (`#FF7727`/`#E05A12`/`#C94F0E`) appears on exactly six element classes —
the finding card's state bar, its agent dot, its `NEW` chip, its impact line,
the related-agent row dots, and the `AuditBand` CTA. Blue (`#2F6FAE`/`#EDF4FB`)
appears on exactly one: the finding card's evidence chip. No gradients anywhere
in this tree.

**Form.** `/resources/supplier-scorecard` renders `ContactForm` with the four
general fields (`name`, `business`, `email`, `challenge`), submit label "Send",
hero CTA "Send me the supplier scorecard", section heading "Send me the
supplier scorecard." — i.e. the general variant, framed, with no new variant
added.

**Category filter.** All six `?category=` URLs return 200 and render the right
subset (Operations 2, Automation 1, Procurement 2, Reporting 1, Inventory 1,
AI in Business 1).

**Sitemap.** `curl /sitemap.xml | grep -c learn/glossary` → **13** (hub + 12
terms).

**Console.** No errors or warnings originating from this workstream's routes.
The only errors in the shared dev-server console are a parse failure in
`components/finch/industries/FindingDeck.tsx` — Workstream A's file, mid-edit —
which never appears on a `/learn`, `/learn/glossary` or `/resources` page.

### Not verifiable in this environment

- **A real `prefers-reduced-motion: reduce` profile.** Both gates are branches
  on `useReducedMotion()` (`return null` for the hairline, `whileHover:
  undefined` for the card) and were read rather than run — the same gap every
  Phase 1 and 2 report records.
- **Screenshots at the end of the session.** Three other workstreams
  repeatedly re-fronted and resized the browser pane; the last several
  screenshot attempts came back blank or at the wrong viewport. Everything
  above is therefore measured with `getBoundingClientRect` /
  `getComputedStyle` / DOM queries rather than read off an image. The
  screenshots that did land (learn hub at 1440, article hero at 1440) are
  consistent with the measurements.

### Orphaned by this workstream (for Phase 5's redundancy list, not deleted)

- `components/marketing/PublicMarketing.tsx` (`PublicPageShell`,
  `AbstractFlowBackdrop`, `MarketingCta`, `Breadcrumbs`, `JsonLd`,
  `marketingStyles`) loses four more importers here. Still imported by whatever
  old-design routes remain after Phases 3.
- `lucide-react` loses one importer (`app/resources/page.tsx`'s
  `Award`/`ClipboardCheck`/`FileText`).
- Nothing else. The old page implementations were inline JSX in the route
  files, so no separate component file became dead.

## C — about / academy / legal

Workstream C of `.ai/plan_phase3_company_verticals_content.md`: `/about`
(rebuild), `/academy` (new), `/privacy` (reskin), `/terms` (new), `/popia`
(new), the `ContactForm` academy variant + `app/api/contact/route.ts`
support for it, the `FinchFooter` Legal column, the `/about` redirect
removal, and the four sitemap entries. **Nothing committed, no git commands
run.**

### Files created

| File | What |
|---|---|
| `components/finch/about/AboutTimeline.tsx` | `"use client"`. The signature visual: a vertical hairline that draws via `useScroll`'s `scrollYProgress` mapped straight to `scaleY` (origin-top), four milestones revealing beside it with the standard reveal-on-enter (`whileInView`, staggered 60ms). Reduced motion locks `scaleY` to `1` (already drawn) instead of tracking scroll. |
| `components/finch/about/about-jsonld.ts` | `buildAboutSchema()` — `Person` (reusing the root layout's `#josh` `@id` so the two merge, enriched with `worksFor`, `address`, `sameAs` from `SITE.sameAs` when non-empty) + `BreadcrumbList`. `Organization`/`WebSite` are left to the sitewide graph. |
| `components/finch/academy/SeatGrid.tsx` | `"use client"`. 12 circles, presentational — takes `filled: number` as a prop so SSR (which always passes `0`) renders every seat hollow. A filled seat gets a small scale-stamp (`[1, 1.18, 1]`, 320ms, skipped under reduced motion). |
| `components/finch/academy/AcademyInterest.tsx` | `"use client"`. Owns the one piece of state `SeatGrid` and `ContactForm` share (`filled`, `useState(0)`); passes `onSuccess` to `ContactForm` to increment it. |
| `components/finch/academy/academy-jsonld.ts` | `buildAcademySchema()` — `BreadcrumbList` only. Explicitly **no** `Course`/`Offer` schema, per the plan ("NO Course schema until real") — Academy has no curriculum or dates yet. |
| `components/finch/legal/LegalReading.tsx` | Server. The shared reading layout for `/privacy`, `/terms`, `/popia`: `LegalShell` (nav/footer + max-w 720 column), `LegalHeader`, `LegalSection` (STIX headings, 17px/1.75 body, optional `id` for deep-link targets), `DraftChip` (`DRAFT · UNDER LEGAL REVIEW`), `LegalCrossLinks` (the three pages link to each other). |
| `components/finch/legal/legal-jsonld.ts` | `buildLegalSchema({path, name, description})` — `WebPage` + `BreadcrumbList`, shared by all three legal pages. |
| `app/academy/page.tsx` | New. `<h1>` "Vyso Academy — the DIY option.", `COMING SOON` chip, R500/seat, four modules each marked `PLANNED`, then `AcademyInterest` (seat grid + interest form), `AuditBand`. |
| `app/terms/page.tsx` | New. `<h1>` "Terms of Service", `DraftChip`, `robots: {index:false, follow:true}`, a `TODO(user)` header comment. Nine sections built only from facts already on the site (imports `PRICE`/`FOUNDING_TERMS` from `pricing-data.ts` rather than re-typing the numbers). |
| `app/popia/page.tsx` | New. `<h1>` "POPIA & PAIA", same draft chip/noindex/TODO pattern. Information Officer (Josh Moreira), the POPIA statement (pointing at `/privacy` rather than repeating it), how to exercise rights, PAIA manual "available on request", Information Regulator complaint route. |

### Files modified

- `app/about/page.tsx` — full rebuild. `<h1>` "Vyso, the company." Sections:
  hero → founder (Josh Moreira/Johannesburg from `SITE`, an honest "JM"
  initials placeholder — not a stand-in photo — with two `TODO(user)`
  comments for the real photo and a two-line bio) → why Finch → the honest
  stage (founding cohort, Turn 'n Slice as first founding customer, linked to
  `/case-studies/turn-n-slice` and `/founding-client`) → beyond Finch
  (Operations Audit R2,000 credited, Academy R500/seat — both from
  `PRICE` in `pricing-data.ts`) → four principles (evidence first · rand not
  vibes · your tools not ours · we tell you if you don't need us, each with
  one grounded elaboration line) → `AboutTimeline` → `AuditBand`. `Person` +
  `BreadcrumbList` JSON-LD via `about-jsonld.ts`.
- `app/privacy/page.tsx` — reskinned into `LegalShell`/`LegalSection`. The
  WebGL background, the glass panel (`backdropFilter: blur`) and the old
  inline-style typography are gone; **every sentence of the policy is
  unchanged** — curly quotes/dashes moved from raw Unicode characters to
  HTML entities (`&ldquo;`/`&rsquo;`/`&mdash;`), which render to the same
  glyphs, so the visible text is identical. Verified programmatically (see
  Verification). Added `id="10-your-rights-and-choices"` on section 10 so
  `/popia` can deep-link into it. Title switched to `{ absolute: TITLE }`
  (see deviation 1).
- `components/ContactForm.tsx` — added `variant: "academy"` (`ContactFormVariant`
  now `"audit" | "general" | "academy"`) and an optional `onSuccess?: () =>
  void` prop (see deviation 2). Academy fields: name, business type (`<select>`
  from the site's six primary verticals + "Other" — nothing invented, drawn
  from `.ai/vyso_v2.md` §2.2), email — no business name, no challenge
  textarea. Button "Register interest"; helper line "No payment now — just
  interest. We'll write when the first cohort opens." Success state is a
  `FindingCardFrame` composed the same way the audit variant's is: agent
  `ACADEMY`, observation "Interest noted.", impact "We'll write when the
  first cohort opens." — the exact strings the plan specifies.
- `app/api/contact/route.ts` — accepts `businessType` (capped 60 chars,
  escaped like every other field) and `variant: "academy"`. Required-field
  check changed from `!name || !business || !email || !challenge` to
  `!name || !email || (!isAcademy && (!business || !challenge))` — academy
  sends neither `business` nor `challenge`, so both become conditional in the
  internal notification email (`businessLine`, `challengeBlock`) rather than
  always rendering an empty value. Subject line and `<h2>` now read "New
  Academy interest from …" for that variant. Auto-reply to the submitter is
  unchanged (same Calendly-link template every variant has always gotten).
- `components/finch/FinchFooter.tsx` — **Legal column only**: added `["Terms",
  "/terms"]` and `["POPIA", "/popia"]` after the existing `["Privacy",
  "/privacy"]`. Did not touch the Finch/Vyso/Learn columns (see deviation 3
  for the stale Academy link this leaves behind, which is out of this
  workstream's file boundary).
- `next.config.ts` — removed the `/about → /platform` redirect (single
  block, one comment left explaining the removal). No other redirect
  touched.
- `app/sitemap.ts` — added `/about`, `/academy`, `/terms`, `/popia` in one
  block after the existing `/privacy` entry, all with `lastModified:
  2026-08-15`. `/terms`/`/popia` carry the lowest priority on the site
  (`0.2`, matching `/privacy`'s `changeFrequency: "yearly"`) with a comment
  noting they're `noindex` on-page but still listed per the plan's explicit
  instruction to add them.

### Deviations from the plan (and why)

1. **`/privacy`, `/terms`, `/popia` all set `title: { absolute: TITLE }`**
   instead of a plain string. Each page's own `TITLE` constant already ends
   in `"| Vyso"` (`"Privacy Policy | Vyso"` etc.); the root layout's `%s |
   Vyso` template would otherwise double the suffix to `"… | Vyso | Vyso"`.
   Caught by curling the rendered `<title>` during verification and fixed —
   same pattern Phase 1's `/pricing`/`/finch` used for the same reason.
2. **`ContactForm` gained an `onSuccess?: () => void` prop**, not named in
   the plan's "ONLY to add `variant="academy"`" file scope. The seat grid's
   fill has to be tied to a real successful submit (not to opening the form
   or typing into it), and `ContactForm` owns its own submit state — an
   optional, no-op-by-default callback was the smallest change that makes
   the described interaction possible without lifting the whole form's state
   out of the component. Every existing call site is unaffected (prop is
   optional, only `/academy` passes it).
3. **`components/finch/academy/AcademyInterest.tsx` and
   `components/finch/about/AboutTimeline.tsx`** (plus their `-jsonld.ts`
   files) are new `components/finch/` subdirectories the plan's literal file
   list doesn't name — it only calls out `components/finch/legal/*`
   explicitly. Both are client components the scroll-drawn timeline and the
   session-only seat count need, and every other rebuilt page in this repo
   (`components/finch/audit/`, `components/finch/compare/`, …) follows the
   same one-subdirectory-per-page convention. Same precedent Phase 1's
   Workstream C used for `app/faq/FaqInteractive.tsx`.
4. **`FinchFooter.tsx`'s Vyso column still links Academy → `/pricing#academy`**,
   not the new `/academy` page. The plan restricts this workstream to the
   Legal column only ("Workstream D must not touch it" — i.e. the reverse
   constraint also applies to this workstream touching the Vyso column), so
   the stale link was left as-is rather than crossing that boundary. Flagged
   as a spawn-task suggestion for whoever owns that column next.
5. **`AboutTimeline`'s four milestones include two undated, general ones**
   ("Vyso starts as an operations partner…" and "Founding client terms
   open") alongside the plan's two explicitly-named ones (Turn 'n Slice as
   founding customer; the homepage/pricing rebuild, dated "August 2026" —
   month precision only, since the work is still uncommitted per every
   phase-1/2/3 report). A two-item timeline read as thin for a "vertical
   timeline hairline" visual; the two extra items assert nothing beyond what
   the rest of the site already says (Vyso's vertical, the founding terms
   strip) and carry no date, honouring "ONLY dated if the date is real …
   otherwise undated."

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
The three known pre-existing WhatsApp errors, nothing else in any file this
workstream touched.

```
$ npx eslint app/about app/academy app/privacy app/terms app/popia \
    components/finch/legal components/finch/about components/finch/academy \
    components/finch/FinchFooter.tsx components/ContactForm.tsx \
    app/api/contact next.config.ts app/sitemap.ts
```
Clean, no output.

```
$ curl -sI localhost:3000/about   → 200 (no redirect — the `/platform` 308 is gone)
$ curl -sI localhost:3000/academy → 200
$ curl -sI localhost:3000/privacy → 200
$ curl -sI localhost:3000/terms   → 200
$ curl -sI localhost:3000/popia   → 200
```

Grep gates on every file this workstream touched:
```
$ grep -rnE "R10,000|R30,000|R50,000|setup fee|Start, Create|Vyso AI|Join Waitlist" …
$ grep -rnE "backdrop-blur|backdrop-filter|LiquidGlass" …
```
0 matches on both.

**HTML/metadata**, all five pages: exactly one `<h1>`; canonical set; titles
21–51 chars (own string, before the template's `" | Vyso"`), descriptions
114–150 chars (all ≤155); `/privacy` carries `robots: index, follow`;
`/terms` and `/popia` carry `robots: noindex, follow` plus the visible
`DRAFT · UNDER LEGAL REVIEW` chip and a `TODO(user)` comment in the page
source. Two `<script type="application/ld+json">` blocks per page (sitewide
graph + page graph), all ten parse (`JSON.parse`, `node -e`):
`about` → `Person, BreadcrumbList`; `academy` → `BreadcrumbList` only (no
`Course`); `privacy`/`terms`/`popia` → `WebPage, BreadcrumbList` each.

**`/privacy` verbatim check.** Diffed the rendered page's `document.body
.innerText` (fetched + `DOMParser`'d in a live tab, so entities are decoded
exactly as a browser would) against the pre-edit source text for the
hardest sections (the `“Vyso”`/`“POPIA”` quotes in §1, the em-dashed §3
sentence, the four curly-apostrophe possessives in §6, §13) — all four
matched exactly, normalised for whitespace only.

**Sitemap.** `app/sitemap.ts` contains `/about`, `/academy`, `/terms`,
`/popia` (confirmed by re-reading the file after Workstream D's own
concurrent edit landed alongside it — both sets of additions are present,
no clobber).

**Browser (dev server on :3000, shared with other workstreams; tab fronted
via `tabs_select` before every interaction).**

- 1440×900 and 375×812 on `/about`: one `<h1>`, `scrollWidth` 1425≤1440 and
  375=375 (no horizontal scroll either width), the timeline renders all four
  milestones with "AUGUST 2026" as the one dated (mono, uppercase) label.
- `/academy` **end-to-end submit, stubbed fetch** (a real `RESEND_API_KEY`
  is present in `.env.local` — confirmed no live send: `window.fetch` was
  monkey-patched before the interaction and `read_network_requests` showed
  zero requests to `/api/contact` for the whole session). Filled name/email/
  business-type via native-setter + `input`/`change` events (the accessibility
  snapshot tool intermittently failed to see below-the-fold form fields in
  this session — a tooling quirk, not a page defect; confirmed the fields
  exist and are controlled via direct DOM queries throughout), clicked
  submit: POST body was exactly `{name, email, businessType, variant:
  "academy"}` — no `business`/`challenge` keys, matching the route's
  academy-specific required-field logic. Success rendered the `ACADEMY`
  FindingCard ("Interest noted." / "We'll write when the first cohort
  opens.") and `SeatGrid` went from "12 SEATS · NONE FILLED YET" (all 12
  `border-color: var(--fn-line-3)`, confirmed against the raw SSR HTML before
  any interaction) to "1 SEAT FILLED THIS SESSION" with one circle filled
  orange — screenshot-confirmed after the submit.
- `/terms`, `/popia`: draft chip visible, `LegalCrossLinks` present on all
  three legal pages and pointing at the other two (verified the hrefs
  directly); the `/popia → /privacy#10-your-rights-and-choices` anchor
  resolves to a real `id` in `/privacy`'s rendered HTML.
- Footer Legal column on `/about`: three links present, `Privacy → /privacy`,
  `Terms → /terms`, `POPIA → /popia`.
- Console: no errors on any of the five pages across both widths.

**Not verifiable in this environment.** The scroll-linked draw of
`AboutTimeline`'s hairline mid-scroll (screenshots were flaky throughout —
several came back solid black until re-`tabs_select`ing the tab, and once
the accessibility-tree snapshot stopped finding fields that direct DOM
queries confirmed were present and interactive) — same category of gap
every phase-1/2/3 report in this repo records for scroll-linked motion.
Confirmed by code review instead: `scaleY` is `reduce ? 1 :
scrollYProgress`, `scrollYProgress` maps `["start 0.8", "end 0.55"]` on the
section, so the line is undrawn at rest, drawn once the section is mostly
through view, and locked fully-drawn under `prefers-reduced-motion`. Worth
one look in a real browser with a visible pane.

### TODO(user) items left in the code (for the user, not for a future
workstream)

- `app/about/page.tsx` — founder photo (currently an honest "JM" initials
  placeholder, not a stand-in image) and a two-line bio, both explicitly
  marked, both left blank rather than invented.
- `app/terms/page.tsx`, `app/popia/page.tsx` — both are first drafts built
  only from facts already published elsewhere on the site (pricing, the
  founding terms, the POPIA statement from `/privacy`). Neither covers
  liability, IP, indemnity, dispute resolution, or anything else a real
  services agreement needs. Both carry `DRAFT · UNDER LEGAL REVIEW` +
  `robots: noindex` until Josh or counsel reviews and approves removing
  them.

### For the architect / next workstream

- **`FinchFooter.tsx`'s Vyso-column Academy link** (`/pricing#academy`)
  should move to `/academy` now that the page exists — out of this
  workstream's Legal-column-only boundary (deviation 4).

---

## A — industries

Workstream A of `.ai/plan_phase3_company_verticals_content.md`: the inline
`INDUSTRIES` object moved out of the route into `lib/marketing/industries.ts`
and reframed Vyso→Finch, `/industries` rebuilt as a hub with an "Also watching"
row, eight vertical pages built around the **finding deck**. **Nothing
committed.** No file outside A's list was touched; the single `app/sitemap.ts`
edit was re-read immediately before writing and left C's entries intact.

### Files created

| File | What |
|---|---|
| `lib/marketing/industries.ts` | The `INDUSTRIES` data, moved out of `app/industries/[slug]/page.tsx`. Adds `deck` (3 example findings per vertical), `agents`, `modules`, `learn`, `solutions`, `siblings`, `audit`, `cardFinding`, `singular`, `tier`, `experimentalNote`; drops `outcomes`. Also `PRIMARY_INDUSTRY_ORDER`, `EXPERIMENTAL_INDUSTRY_ORDER`, `INDUSTRY_ORDER`, `INDUSTRY_LIST`, `getIndustry()` and `HUB`. Server-safe by construction — nothing here imports a `"use client"` module, because `industries-jsonld.ts` reads it from a server component. |
| `components/finch/industries/industries-jsonld.ts` | `buildIndustriesHubSchema()` (`BreadcrumbList` + `ItemList` of all eight) and `buildIndustrySchema()` (`BreadcrumbList` + `Service` + `FAQPage`). Both read the objects the pages render, so the schema cannot claim something the page doesn't say. |
| `components/finch/industries/IndustryBits.tsx` | Server. `Breadcrumb`, `Eyebrow`, `StatusChip`, `AgentChipRow`, `ArrowLink`, `Section`. |
| `components/finch/industries/IndustryCards.tsx` | Server. `IndustryCards` (the six primary hub cards) and `ExperimentalCards` (the quieter "Also watching" pair). |
| `components/finch/industries/FindingDeck.tsx` | `"use client"`. The signature visual — the only client component in this workstream. |
| `components/finch/industries/IndustrySections.tsx` | Server. `IndustryHero`, `ExperimentalNote`, `IndustryGaps`, `WhatFinchWatchesHere`, `IndustryModules`, `IndustryAudit`, `IndustryRelated`, `IndustryFaqs`. |

### Files rebuilt / modified

- `app/industries/page.tsx` — `FinchNav active="industries"` → breadcrumb →
  eyebrow `WHO FINCH WORKS FOR` → `<h1>` "Built for operations-heavy South
  African food businesses." → the six primary cards → the "Also watching" row →
  `AuditBand` → `FinchFooter`. One JSON-LD block. `PublicPageShell`,
  `AbstractFlowBackdrop`, `MarketingCta`, `marketingStyles` and lucide are gone.
- `app/industries/[slug]/page.tsx` — now only routing, metadata, schema and
  section composition. `generateStaticParams` reads `INDUSTRY_ORDER` (8).
- `app/sitemap.ts` — two entries added (`security-companies`,
  `insurance-brokers`, priority 0.5). The other six industry URLs and the index
  were already there. Nothing else in the file was touched.

### The signature visual — the finding deck

Three vertical-specific `FindingCard`s. They enter **fanned** (rotate −4° / 0 /
+4°, spread ±14px on x, +10px on y) and straighten into a cascade over 600ms
with the §1 default 60ms stagger, once. At `lg` the cards are absolutely
positioned 116px apart vertically and 18px horizontally; below `lg` they stack
in normal flow, because an overlapping deck is unreadable at 375px.

- **116px is measured, not chosen**: 22px card padding + a 31px agent header +
  two 24.6px lines of observation. At the 96px I first shipped, the cards
  underneath showed a *clipped* sentence, which reads as a bug rather than as a
  deck. Verified: every observation on all eight verticals wraps to exactly two
  lines at the deck's 440px.
- **Transform only, never opacity.** `motion` serialises `initial` into the
  server HTML; an `opacity: 0` initial state shipped three invisible cards until
  hydration (confirmed in the SSR HTML before it was removed). `AgentsOnShift`
  refused the same trade for the same reason. The static form is now
  fanned-and-readable.
- **Hover brings one forward, in CSS, not `whileHover`.** Once the enter
  animation finishes `motion` leaves `style="transform: none"` inline, and an
  inline transform beats any utility class on the same element — so `whileHover:
  { y: -6 }` was replaced by `motion-safe:lg:group-hover:-translate-y-[6px]` on
  a child element, plus `lg:hover:z-30` on the motion element itself. Both rules
  were confirmed present in the compiled stylesheet. It now works whether or not
  the gesture layer has hydrated, and does nothing under reduced motion.
- Composed from `FindingCard`'s pieces rather than the whole card so the actions
  can be `interactive={false}`: three stacked cards' worth of hover-styled
  buttons would read as a live inbox, and these are worked examples. The deck is
  captioned `ILLUSTRATIVE EXAMPLES`.
- Reduced motion → `initial={false}`: the settled deck, nothing moves at all.
- The container carries an explicit `lg:h-[516px]` (232px of cascade + the
  tallest third card) so nothing below it moves while the cards animate, and
  `max-lg:overflow-x-clip` so the fan's transient 8px corner bleed at 375px
  cannot produce a horizontal scrollbar. `clip`, not `hidden`, so the page keeps
  its own scrolling behaviour.

### Content decisions

1. **Every internal link is a typed slug, not an href string.** `ModuleSlug`,
   `LearnSlug` and `SolutionSlug` are literal unions of the real routes, and the
   components resolve both the URL and the **label** from the registries
   (`MARKETING_MODULE_BY_SLUG`, `getLearnArticle`, `SOLUTIONS`). This is the
   direct answer to the plan's "known bug": Phase 2 found nine dead Learn links
   in `lib/marketing/solutions.ts` that had been live on the published site. A
   hand-written href can rot silently; a wrong slug here is a compile error, and
   anchor text cannot drift from the title of the page it points at.
2. **The old industries data's dead links, found and fixed.** The pre-rebuild
   pages linked `/platform/vyso-for-smes` twice per vertical (breadcrumb +
   "Explore every Vyso module") and `/platform` once (the CTA's secondary) —
   3 links × 6 pages = **18 links into URLs that 308 to `/`**, plus a breadcrumb
   whose middle crumb pointed at a page that no longer exists. All are gone;
   module links now point at `/platform/modules/<slug>`, which is where the
   module pages actually live. The old data carried **no** Learn links at all,
   so unlike `/solutions` there were no 404s here — the failure mode was
   redirects and a wrong breadcrumb, not dead ends.
3. **`outcomes` dropped.** The four "what better looks like" bullets per
   vertical restated the gaps in the positive and said nothing the agent rows
   don't say more concretely. The `gaps` themselves are kept, near-verbatim,
   because they are grounded and specific.
4. **Three distinct findings per vertical, none reused across pages.** The deck
   content is written in each vertical's own vocabulary (crates to Kloof Spar ·
   diesel at two depots · fresh cream running out Thursday lunch · a 180-cover
   wedding 14% over quote · unsigned drops on the Soweto route · beverage margin
   down 2.1 points · 744 rostered hours billed as 720 · four May policies
   missing from June's statement), and none of it duplicates the four
   `exampleFinding`s already used on `/solutions/*`.
5. **Agent statuses are the §4 chips verbatim** — Doc-U `LIVE`, Price Watch
   `ROLLING OUT`, everything else `FROM YOUR AUDIT ROADMAP` — and every vertical
   page closes its agent list with `AGENT_HONESTY`, imported from
   `agents-data.ts` rather than retyped, so the homepage and these eight pages
   make the same claim in the same words.
6. **The experimental pair's honesty is structural, not a footnote.** Their
   eyebrow ends `· EXPERIMENTAL`; an `EXPERIMENTAL VERTICAL / Read this first.`
   band sits directly under the hero — before any rand figure — and says plainly
   that Finch was built for food and produce operations and that no audit has
   been run in a guarding business or a brokerage. FAQ 1 on both pages is "Has
   Finch been implemented in a…?" answered "No", and both refuse the adjacent
   compliance claim outright (PSIRA; FAIS/advice records). No case study, no
   client, no measured result.
7. **A fourth FAQ per vertical.** The old pages had three; the fourth is the
   single-offer pricing answer (R6,000 per location per month, R2,000 audit
   credited) on the six primary verticals, and "how would we find out whether it
   fits" on the two experimental ones.

### Deviations from the plan

1. **The two experimental verticals do not link each other.** The plan says the
   hub is "the only place they're linked besides the sitemap". My first pass
   gave each the other as a `sibling` (§7.5 wants ≥3 sideways links); that made
   a second entry point, so both now link only *up* into primary verticals. Each
   still has three siblings plus "All industries".
2. **`IndustryBits.tsx` and `IndustryCards.tsx` are extra files** beyond "new
   `components/finch/industries/*`" — within the stated directory, split because
   the cards and the breadcrumb/chips are used by both the hub and the detail
   pages.
3. **The breadcrumb/eyebrow/arrow-link idiom is a local copy**, not an import
   from `components/finch/solutions/SolutionBits.tsx`, following the precedent
   `components/finch/compare/CompareBits.tsx` set in Phase 2: those take
   `/solutions`' own data types. The shared contract is the visual one, not a
   shared module.
4. **A "Where it goes wrong" section survives** that the plan's section list
   doesn't name. The four `gaps` per vertical are grounded, specific, and were
   most of what gave these pages their depth; dropping them would have cut each
   page by roughly a third for no honesty gain.
5. **The hover lift is CSS rather than `motion`'s `whileHover`** — see the deck
   notes above. Still `motion`-only in the sense that matters (no new deps, no
   second animation library); the enter animation is `motion`.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10)   TS2724
lib/platform/whatsapp-ingest.ts(408,36) TS7006
lib/platform/whatsapp-ingest.ts(589,5)  TS2353
```
The three known pre-existing WhatsApp errors. Zero errors mention `industries`.
(Errors in `app/learn/*` and `lib/marketing/glossary.ts` came and went during
the session — workstream D mid-flight; none are in A's files.)

```
$ npx eslint app/industries components/finch/industries lib/marketing/industries.ts app/sitemap.ts
```
Clean, no output. (One `@next/next/no-assign-module-variable` error on a `const
module = …` was fixed to `marketingModule`.)

```
$ curl -s -o /dev/null -w '%{http_code}' …
/industries                          200   h1=1  h2=3
/industries/food-suppliers           200   h1=1  h2=7
/industries/farms                    200   h1=1  h2=7
/industries/restaurants              200   h1=1  h2=7
/industries/catering-companies       200   h1=1  h2=7
/industries/wholesale                200   h1=1  h2=7
/industries/hospitality              200   h1=1  h2=7
/industries/security-companies       200   h1=1  h2=8
/industries/insurance-brokers        200   h1=1  h2=8
```
The experimental pair's extra `<h2>` is the "Read this first." band. No skipped
heading levels anywhere.

**Metadata.** Titles 45–55 chars *including* the ` | Vyso` the root template
appends; descriptions 148–155, every one naming South Africa and a rand figure;
canonicals set; `robots: index, follow` on all nine. Every `lead` is ≤ 45 words
(32–42), per the AEO rule.

**JSON-LD.** Both `ld+json` blocks parse on all nine pages: the layout's
`Organization / WebSite / SoftwareApplication / Service`, plus the page's
`BreadcrumbList + ItemList` (hub, all eight verticals listed) or
`BreadcrumbList + Service + FAQPage` (verticals, mirroring the visible `<dl>`
exactly — no hidden Q&As).

**Link check.** Every internal `href` the nine pages render (52 unique) resolves
200 — all eight Learn articles, all four solutions, nine module pages,
`/platform/modules`, `/#agents`, `/faq`, `/operations-audit`, and the footer's
`/about`, `/terms`, `/popia` (which C landed during this session; `/about` was
308 earlier in the run and is 200 now). Zero 404s, zero redirects.

**Sitemap.** All nine industries URLs present, including the two new ones.

**Grep gates** over `app/industries components/finch/industries
lib/marketing/industries.ts`:
```
R10,000|R30,000|R50,000|R3,000 per|setup fee|Start, Create|Vyso AI|Join Waitlist  → 0
backdrop-|glass|blur(                                                            → 0
lucide-react|PublicMarketing|marketingStyles                                     → 0
```
"Vyso" appears in `lib/marketing/industries.ts` only in the header comment
explaining the Vyso→Finch reframe and in the `title` budget note; no rendered
copy says Vyso does the watching.

**`data-vertical`.** Two per vertical page (the hero CTA and the audit-section
CTA), carrying the page's own slug. `AuditBand` was left untouched — it is a
shared component outside this workstream's list.

**Experimental containment.** `security-companies` / `insurance-brokers` appear
in `app/**` and `components/**` only in `app/sitemap.ts` and a comment in
`app/industries/[slug]/page.tsx`. Rendered: `/`, `/pricing`, `/solutions`,
`/learn`, `/operations-audit` and `/faq` link them zero times; `/industries`
links them; neither experimental page links the other.

### Browser (own tab, dev server on :3000, shared with three other workstreams)

**1440×900.** Hub: breadcrumb, `<h1>`, six cards 3-across each with its example
finding on a blue evidence rule and its agent chips, then the hairline-separated
"Also watching" row — two smaller cards, `EXPERIMENTAL` chips, 2-across in a
720px column. Eight industry links, two `EXPERIMENTAL` chips, one `<h1>`,
`scrollWidth === clientWidth` (no horizontal scroll).

Vertical pages: hero left / deck right, the deck reading as three findings with
each card's agent label and full two-line observation visible above the next.
Measured after settling: card tops 147 / 263 / 379, heights 276 / 274 / 255,
container 516 — 29px of slack, no clipping. Then the gaps 2×2, the agent rows
with statuses aligned right, module chips resolving their names from the
registry, the three-sentence audit strip with its CTA, related solutions/learn/
siblings, the FAQ `<dl>` 2-across, `AuditBand`.

**The deck plays.** Sampled through a client-side navigation (so the JS context
survived the remount) with the tab fronted: card 1's rotation went −4.00° at
t=4ms → −1.03° at 150ms → −0.11° at 329ms → 0° at 510ms — the ease-out curve
`[0.22, 1, 0.36, 1]` over 600ms, exactly as specified. After settling all three
read `transform: none`.

**375×812.** `scrollWidth === clientWidth === 375` with zero overflow at every
point of the animation; the deck's three cards are `position: relative` in
normal flow, one under the next, 335px wide; one `<h1>`; the agent rows,
gaps, modules, audit and FAQ grids all collapse to a single column.

**Console.** Clean on a fresh tab: React DevTools info and `[HMR] connected`,
nothing else.

### Not verifiable in this environment

- **A real `prefers-reduced-motion: reduce` profile.** Both code paths were read
  rather than run: `initial={false}` on the deck, and the `motion-safe:` gate on
  the hover lift, whose compiled rule was confirmed to sit inside
  `@media (prefers-reduced-motion: no-preference)`. Same gap as every Phase 1/2
  report.
- **A real pointer hover.** The automation pane's `hover` action did not produce
  a persistent `:hover` across a screenshot, and a synthetic `pointerenter` does
  not drive `motion`'s gesture layer. Both hover rules (`lg:hover:z-30`,
  `motion-safe:lg:group-hover:-translate-y-[6px]`) were instead verified present
  and correctly media-scoped in the served stylesheet — which is the whole
  mechanism, now that neither depends on JS. Josh should still eyeball it.
- Three other workstreams repeatedly fronted the shared browser pane; a
  backgrounded tab stalls `whileInView` and throttles timers to 1s, which cost
  several sampling attempts. Geometry was therefore measured with
  `getBoundingClientRect` rather than trusted from screenshots, and the
  animation sample above is from a run where `document.visibilityState` was
  asserted `visible` for its whole duration.

### Orphaned by this workstream (for Phase 5's redundancy list, not deleted)

- `components/marketing/PublicMarketing.tsx` (`PublicPageShell`,
  `AbstractFlowBackdrop`, `MarketingCta`, `Breadcrumbs`, `JsonLd`,
  `marketingStyles`) loses two more importers here.
- `lucide-react` loses two importers (`app/industries/*`).
- `app/industries/[slug]/page.tsx` no longer holds the `INDUSTRIES` object.
  Nothing in `app/`, `components/` or `lib/` imported it — verified by grep
  before and after.

### For the architect

- The old `/industries/*` pages linked `/platform/vyso-for-smes` and
  `/platform`, both of which 308 to `/`. Worth a sweep of the remaining
  old-design routes for the same two hrefs before Phase 5.
- `ServiceDen` (`serviceden`) is in `ModuleSlug` for completeness but no
  vertical references it — it is gated to a single internal Vyso account, so no
  industry page should claim it.

## Architect review — Phase 3 (Fable, 2026-08-15) — APPROVED (structural)

25 Phase-3 routes 200 with one <h1>; `/about` 200 (redirect removed); sitemap 70
URLs incl. 8 verticals, about, academy, terms, popia, glossary hub + 12 terms;
`/terms` + `/popia` noindex drafts; grep gates 0; tsc 3 known; full internal
crawl from the sitemap: 74 unique hrefs, all 200, zero via redirect. Fixed
post-review: footer Academy → `/academy`. Byline changed to Josh Moreira on
Learn (D's call — revert if unwanted). Owed to a real browser: finding-deck
hover, timeline draw, SA pulse, price-list micro-demo, reading hairline (all
measured by the builders in fronted tabs; the pane was hidden for me).
TODO(user): founder photo/bio on /about; legal review of /terms + /popia; bump
LEARN_LAST_MODIFIED on commit; sameAs URLs in lib/marketing/site.ts.
