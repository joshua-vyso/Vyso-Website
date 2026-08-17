# Implementation: Phase 2 — product cluster (modules · integrations · compare · solutions)

Plan: `.ai/plan_phase2_product_cluster.md`. Each workstream appends its own
section below under its own heading. Do not edit another workstream's section.

## B — integrations

Plan: Workstream B of `.ai/plan_phase2_product_cluster.md`.

### Files created

| File | What |
|---|---|
| `lib/marketing/integrations.ts` | Extends `components/finch/integrations.ts` (read-only — slugs, logo paths, names, `prompt`/`short` strings all untouched) with per-tool `status`, `fields` (reading-table labels), `reads`, `canDo` and `setup` copy for all 11 roster tools, plus `INTEGRATIONS_FAQS` (4 Q&As) and `DONT_SEE_YOUR_TOOL`. `INTEGRATION_DETAILS` merges the two by slug and throws at import time if a slug is missing detail copy, so the roster and the copy can never drift apart silently. |
| `components/finch/integrations-page/ReadingTable.tsx` | The signature visual — a two-column ledger (`role="table"`), one row per tool. On enter (staggered `(index % 6) * 0.06s`, `whileInView`, once), the right-hand column's field list fades/slides in, followed by a small tick/circle mark. Colour discipline decides the row's honesty for free: a tool that is genuinely read today (`CONNECTED IN ONBOARDING` / `LIMITED ROLLOUT`) gets blue mono text + an ink tick; a `ROADMAP` tool gets plain ink/muted text + a hollow circle — nothing roadmap is ever rendered in the evidence colour. Reduced motion: rows start (and stay) at the finished `play` state, exact idiom as `AgentsOnShift.tsx`. |
| `components/finch/integrations-page/IntegrationSections.tsx` | The 11 per-tool `<dl>` sections: logo, name, status chip, "What Finch reads" / "What Finch can do with it" / "Setup", and the "you ask Finch" prompt (the exact string from `integrations.ts`, rendered as static text — not the `IntegrationPrompt` widget, which stays `Senses.tsx`'s only). Server component, no client JS. |
| `components/finch/integrations-page/DontSeeYourTool.tsx` | The "Don't see your tool?" card: the "expanded mandates, priced on scope" line (same fact as `pricing-data.ts` / `faq.ts`), Book your audit CTA, and a direct-email fallback. |
| `components/finch/integrations-page/IntegrationsFaqs.tsx` | 4-question FAQ accordion, native `<details>`/`<summary>` (same pattern as `/pricing`'s `WhatsIncluded`), reading `INTEGRATIONS_FAQS` — the same array the JSON-LD mirrors, so the schema can't drift from the visible text. |
| `components/finch/integrations-page/integrations-jsonld.ts` | `buildIntegrationsSchema()` — one `@graph`: `BreadcrumbList` + `FAQPage`, same shape/pattern as `pricing-jsonld.ts` and `audit-jsonld.ts`. |

### Files modified

- `app/integrations/page.tsx` — full rebuild in the Finch design language,
  replacing the old `PublicPageShell`/glass version entirely. `<h1>` "Connect
  what you already run. Finch starts watching.", eyebrow `SENSES, NOT
  INTEGRATIONS` (same eyebrow text the homepage's `Senses.tsx` uses — a
  repeated label, not a repeated widget), sub-line stating nothing to
  migrate / connected during onboarding / data stays yours. Section order:
  hero → `ReadingTable` → "Every tool, honestly." (`IntegrationSections`) →
  `DontSeeYourTool` → `IntegrationsFaqs` → a one-line pointer to `/faq#integrations`
  → `AuditBand` → `FinchFooter`. `FinchNav` with no `active` (Integrations
  isn't one of the four top-level nav links — it lives in the footer's Finch
  column only, so there is no nav item to highlight). Metadata: title
  `"Integrations — Xero, Sage, WhatsApp, Yoco, Loyverse & more"` (58 chars,
  becomes `"… | Vyso"` via the root template), description `"Xero and
  WhatsApp connect today for South African SMEs; Sage, Yoco, Loyverse,
  QuickBooks and 4 more are roadmap, scoped in your audit."` (134 chars),
  canonical `/integrations`, OG/Twitter via `/og.png`.

### Grounding the honesty claims — what the repo actually integrates today

Grepped `lib/**` and `app/api/integrations/**` (plus a broader `lib/**` +
`app/api/**` sweep per-term) before writing any status copy:

- **Xero** — real, live OAuth: `app/api/integrations/xero/{connect,callback,
  status,disconnect}/route.ts` + `lib/platform/xero.ts` / `xero-core.ts`.
  `CONNECTED IN ONBOARDING`.
- **WhatsApp Business** — real, live: `app/api/whatsapp/{inbound,process}/
  route.ts` + `lib/platform/whatsapp-send.ts` / `whatsapp-ingest.ts` /
  `whatsapp-policy.ts` (signed Meta webhook → OrderFlow order → automatic
  confirmation reply). `CONNECTED IN ONBOARDING`.
- **Gmail** — real, live, but scoped: `app/api/serviceden/gmail/{connect,
  callback,sync,cron}/route.ts` + `lib/platform/serviceden-gmail.ts`, gated
  to a single internal account (`SERVICEDEN_ACCOUNT_EMAIL`) inside ServiceDen,
  which the module's own marketing data (`lib/marketing/module-data/
  serviceden.ts`) already describes as "run internally at Vyso and rolled
  out with selected service businesses ahead of a wider release." Given
  `LIMITED ROLLOUT` — a deliberate third status beyond the plan's two-value
  example (`CONNECTED IN ONBOARDING` / `ROADMAP`), chosen because it's
  already the site's own vocabulary for exactly this situation
  (`MODULE_CHIPS.serviceden` in `components/finch/pricing/pricing-data.ts`)
  — reusing it says the same true thing rather than forcing a binary that
  either overclaims or underclaims a feature that is both built and gated.
  Flagging this as a considered deviation from the plan's literal two-value
  instruction, in the direction of more honesty, not less.
- **QuickBooks** — no live connection. `lib/platform/csv.ts` and
  `app/api/import/{assist,parse-xlsx}/route.ts` support QuickBooks-*shaped*
  spreadsheet exports as an import/mapping format only. `ROADMAP`, with the
  CSV-import nuance stated in its copy rather than folded into a live-read
  claim.
- **Notion / n8n** — the only code hits are Vyso's own internal sales-
  outreach engine (`lib/platform/notion-outreach.ts`: "Notion is the system
  of record for the n8n outreach engine… n8n owns it") — Vyso's tooling, not
  a customer-facing Finch connection. `ROADMAP` for both, with `canDo` copy
  saying so explicitly rather than silently treating internal tooling as a
  product feature.
- **Sage, Yoco, Loyverse, Outlook, SimplePay** — zero references in `lib/**`
  or `app/api/**` beyond `lib/marketing/faq.ts`'s marketing copy (Outlook:
  only as a generic email-domain string in an allowlist, not an integration).
  All `ROADMAP`.

### Deviations from the plan

1. **Third status value `LIMITED ROLLOUT`** for Gmail (see above) — the plan
   named `CONNECTED IN ONBOARDING` / `ROADMAP` as its status example; a third,
   already-established site value was more honest than either.
2. **`FinchNav` rendered with no `active` prop.** The plan's standing rule says
   `active` "where it applies" — `/integrations` isn't one of `FinchNav`'s
   four top-level links (Finch/Industries/Pricing/Learn), so there is no
   correct value to pass; `FinchFooter`'s Finch column already links here.
3. **Reading table implemented as `role="table"`/`role="row"`/`role="cell"`
   divs, not a native `<table>`.** Matches the rest of the Finch component set
   (no native `<table>` found anywhere in `components/finch/`), keeps the
   card-style row borders/radii consistent with the rest of the page, and
   keeps full ARIA table semantics for screen readers.
4. **`/faq#integrations` link added** at the foot of the FAQ section, pointing
   at the FAQ's existing "Integrations & your tools" group (`id: "integrations"`
   in `lib/marketing/faq.ts`) for POPIA/data-handling detail this page doesn't
   repeat. Not in the plan's explicit list, but the plan's own "internal links
   per §7.5" standing rule expects it, and the target `id` already exists.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
Exactly the 3 known pre-existing WhatsApp errors (owned by another branch of
work per the phase-0 note in `.ai/vyso_v2.md`). Zero elsewhere.

```
$ npx eslint app/integrations components/finch/integrations-page lib/marketing/integrations.ts
```
Clean, no output.

```
$ for slug in xero whatsapp gmail yoco sage loyverse quickbooks outlook notion n8n simplepay; do
    curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/finch/integrations/${slug}.svg"; done
```
All eleven return 200 (304 on repeat/cached loads in the browser network
panel — confirmed no 404s across a full page load).

```
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/integrations
```
200.

Grep gate on every file this workstream touched:
```
$ grep -rnE "R10,000|R30,000|R50,000|setup fee|Start, Create|Vyso AI|Join Waitlist|backdrop-" \
    app/integrations components/finch/integrations-page lib/marketing/integrations.ts
```
0 matches.

`<h1>` count on the rendered page: 1.

JSON-LD: fetched the rendered HTML, extracted both `<script type="application/
ld+json">` blocks (the root layout's sitewide graph + this page's), parsed
both with `json.loads` — both valid; the page's own graph has 2 `@graph`
nodes (`BreadcrumbList`, `FAQPage`) matching `INTEGRATIONS_FAQS`'s 4 entries.

Browser review at 1440×1000 and 375×812 (own tab, fronted before every
screenshot per the concurrency rule): reading table renders with blue+tick
rows for Xero/WhatsApp, muted+hollow-circle rows for the eight roadmap tools
and Gmail's `LIMITED ROLLOUT` chip distinct from the two `CONNECTED IN
ONBOARDING` chips; all 11 per-tool `<dl>` sections render; "Don't see your
tool?", the 4-question FAQ accordion (first item open by default) and
`AuditBand` all render; footer's Finch column "Integrations" link points
here. Console: no errors, no warnings. Colour discipline grep on the new
files: `fn-orange-cta`/`fn-orange-deep` appear only on the CTA button and
standard link-hover states (the same hover convention every other Finch page
uses); `fn-blue-deep` appears only in `ReadingTable`, and only for rows whose
status isn't `ROADMAP`. No `--fn-grad` used (zero gradients on this page, so
the "one per page max" rule is trivially satisfied). No `backdrop-` anywhere.

Mobile pass: reading table's tool-name column narrowed to 108px and the
field-list column changed from `truncate` to wrapping text after the first
screenshot showed most rows' fields cut off with an ellipsis at 375px —
fixed so every row's full field list is legible at phone width without
needing the per-tool section below.

### Orphaned files

- `app/integrations/page.tsx`'s previous content (the `PublicPageShell` /
  category-card version, generic Lucide icons, no brand logos) is fully
  replaced — the old implementation exists only in git history now, not on
  disk as a separate file (Phase 5 note: nothing to list here since there was
  no separate old component file, only inline JSX in the page itself).
- No other files were orphaned by this workstream. `components/finch/
  integrations.ts` (the roster) and `components/finch/IntegrationPrompt.tsx`
  / `IntegrationsOrbit.tsx` / `Senses.tsx` remain in active use by the
  homepage — none of them became dead code here.

---

## D — solutions

Workstream D of `.ai/plan_phase2_product_cluster.md`: `SOLUTIONS` moved out of
the route file, `/solutions` rebuilt around the symptom checklist, the four
detail pages rebuilt in the Finch language. **Nothing committed.** No file
outside D's list was touched.

### Files created

| File | What |
|---|---|
| `lib/marketing/solutions.ts` | The `SOLUTIONS` data, moved out of `app/solutions/[slug]/page.tsx` (the hub used to import a route module to read it). Adds `agents`, `exampleFinding`, `problemNoun`, `related`, `costShapes`; drops `costStats`. Also `SOLUTION_ORDER`, `SOLUTION_LIST`, `getSolution()`, `HUB` (the hub's copy), `SYMPTOMS` (10), `CHECKLIST_COPY` and `checklistObservation()`. Server-safe by construction — nothing here imports a `"use client"` module, because `solutions-jsonld.ts` reads it from a server component (see `.ai/implementation_phase1.md` §B deviation 1). |
| `components/finch/solutions/solutions-jsonld.ts` | `buildSolutionsHubSchema()` (`BreadcrumbList` + `ItemList`) and `buildSolutionSchema()` (`BreadcrumbList` + `Service` + `FAQPage`). Both read the same objects the pages render, so the schema cannot claim something the page doesn't say. |
| `components/finch/solutions/SolutionBits.tsx` | Server. `Breadcrumb`, `Eyebrow`, `StatusChip`, `AgentChipRow`, `AgentList` (the `/#agents`-linking rows), `ArrowLink`. |
| `components/finch/solutions/SolutionCards.tsx` | Server. The four solution cards; used on the hub and again on each detail page as its "related problems" row (§7.5's sideways links). |
| `components/finch/solutions/SymptomChecklist.tsx` | `"use client"`. The hub's signature visual — the only client component in this workstream. |
| `components/finch/solutions/SolutionSections.tsx` | Server. `SolutionHero`, `SolutionProblem`, `SolutionStruggles`, `SolutionCost`, `HowFinchFixesIt`, `SolutionWorkflow`, `SolutionRelated`, `SolutionFaqs`. |

### Files rebuilt

- `app/solutions/page.tsx` — `FinchNav` (no `active`; solutions is not a nav
  section) → breadcrumb → eyebrow `WHAT FINCH FIXES` → `<h1>` "Fix the problem,
  not the symptom." → the checklist → "What Finch fixes" (the four cards) →
  `AuditBand` → `FinchFooter`. One JSON-LD block. `PublicPageShell`,
  `AbstractFlowBackdrop`, `MarketingCta`, `marketingStyles` and lucide are gone.
- `app/solutions/[slug]/page.tsx` — now only routing, metadata, schema and
  section composition; all content comes from `lib/marketing/solutions.ts`.
  `generateStaticParams` reads `SOLUTION_ORDER`.

### The signature visual — the symptom checklist that writes a finding card

Ten symptom checkboxes (left) and a `FindingCard` (right, `lg:sticky`). Ticking
one:

- **types the observation** at 40ms/char, once per change. The typing is a DOM
  write, not React state: the span's React children are frozen at mount
  (`useState(text)`), so React never touches the text node again and cannot
  fight the interval for it, and a ten-word sentence costs zero re-renders.
  Nothing in the effect calls `setState` (the repo's ESLint errors on
  `react-hooks/set-state-in-effect`).
- **stamps the impact line** — `Worth quantifying — that's the audit.` — with
  a 1.12→1 scale + fade over 220ms, the first time anything is ticked.
- **counts the evidence chip**: `N symptom(s) ticked`, with the matched pages
  as the mono meta line.
- **offers the matched pages** as real `<Link>`s plus `Book your audit`.
  Matching ranks solutions by how many ticked symptoms point at them (2 points
  for a symptom's primary page, 1 for a secondary), top two.

Honesty: no rand figure is produced anywhere — ten checkboxes cannot yield one.
A mono caption under the card says so verbatim: `NO FIGURE IS ESTIMATED FROM A
CHECKLIST`.

Accessibility: real `<input type="checkbox">`s, visually hidden and re-drawn
(keyboard, focus ring and semantics come free; the ticked box is
`--fn-blue-deep`, because a ticked symptom is evidence and that is the blue the
card's evidence chip already uses). The typed span is `aria-hidden`; a
`sr-only role="status"` sibling carries the finished string, so a screen reader
gets one announcement per tick rather than a character-by-character crawl.

SSR/reduced motion: the server renders the empty-state card in full (no CLS,
nothing pops in on hydration), and `useReducedMotion()` swaps the typewriter for
an instant `textContent` write and drops the stamp.

### Content decisions

1. **`costStats` dropped, `costShapes` added.** Each solution carried four
   figures ("R8k–R25k typical monthly stock and pricing variance", "3–5% of
   revenue", "R15k+ monthly value of admin hours"…) framed as patterns "we
   typically see". None carried a source, and with one client that is not a
   pattern we can publish. The plan's instruction was "drop or source"; sourcing
   SA-SME leakage benchmarks credibly was not achievable inside this workstream,
   so all sixteen figures are gone. In their place each page has four *shapes*
   the cost takes (no numbers) and a closing line saying the audit is what
   produces the rand figure, from the reader's own documents. Everything else
   grounded — problem, struggles, workflow, FAQs — was kept and reframed, not
   rewritten.
2. **Nine of the sixteen `learnArticles` hrefs were 404s.** The old data pointed
   at `12-operational-kpis-every-ceo-should-track`,
   `how-real-time-dashboards-improve-decision-making`,
   `excel-vs-ai-reporting-software`, `how-poor-procurement-creates-cost-leakage`,
   `how-stock-variance-impacts-profit`,
   `how-manual-reporting-hides-operational-problems`,
   `how-to-reduce-supplier-mistakes`,
   `procurement-approval-process-best-practices` and
   `supplier-scorecards-what-to-track` (the real slug ends `-and-why`). None of
   these exist in `lib/marketing/learn-articles.ts`, which has eight articles.
   All sixteen links now point at real ones. **This was a live bug on the
   published site, not something the rebuild introduced** — worth checking
   whether `/industries/*` has the same problem.
3. **One `FindingCard` per page, captioned.** Each solution's `exampleFinding` is
   distinct (The Brief's three-leak week / Price Watch on cooking oil / margin at
   Fourways / tomatoes running out Thursday) and every one renders under
   `ILLUSTRATIVE EXAMPLE`, the homepage hero's caption, because the rand figures
   in them are worked examples.
4. **Agent statuses are the §4 chips verbatim**: Doc-U `LIVE`, Price Watch
   `ROLLING OUT`, everything else `FROM YOUR AUDIT ROADMAP`, plus a line under
   every agent grid saying the roster is set in the audit.
5. **`reduce-money-leakage` is the hub-of-hubs**: its related section is headed
   "The three places to start looking" and frames leakage as the symptom whose
   causes are the other three pages. The other three carry the neutral "Often
   the same operation."
6. **`problemNoun` added to the data** because `name.toLowerCase()` produced
   "the recurring patterns behind reduce money leakage" — a verb phrase in a
   noun slot.

### Deviations from the plan

1. **The checklist card's actions are two rows, not one.** At 460px the matched
   pages plus the CTA never fit on one line, and wrapping put a separator "·" at
   the start of the second line. Solutions on row one, `Book your audit →` on
   its own row — it is the primary action anyway.
2. **The impact stamp is scale 1.12→1, not §1's 1.3→1.** That figure is
   specified for rand values; at 21px a full sentence scaling from 1.3 briefly
   overflows the card.
3. **`SolutionBits.tsx` and `SolutionCards.tsx` are extra files** beyond "new
   `components/finch/solutions/*`" — within the stated directory, split because
   the cards and the breadcrumb/chips are used by both the hub and the detail
   pages.
4. **The hub's checklist section has a `sr-only` `<h2>`** ("Match the symptom").
   The visual has its own mono legend and does not want a display heading, but a
   `<section aria-labelledby>` needs something to point at.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10)   TS2724
lib/platform/whatsapp-ingest.ts(408,36) TS7006
lib/platform/whatsapp-ingest.ts(589,5)  TS2353
```
The three known pre-existing WhatsApp errors and nothing else from this
workstream. (Errors in `components/finch/agents/*`, `components/finch/day/*` and
`app/finch/page.tsx` came and went during the session — other workstreams
mid-flight; none are in D's files.)

```
$ npx eslint app/solutions components/finch/solutions lib/marketing/solutions.ts
```
Clean, no output.

```
$ curl -s -o /dev/null -w '%{http_code}' …
/solutions                            200
/solutions/reduce-money-leakage       200
/solutions/procurement-automation     200
/solutions/reporting-automation       200
/solutions/operations-dashboard       200
```
One `<h1>` on each; hub 3 `<h2>`, detail pages 8 `<h2>` each, no skipped levels.
Titles 44–56 chars including the ` | Vyso` the root template appends;
descriptions 147–155 chars, each naming South Africa and/or a rand figure;
canonicals set. Both `ld+json` blocks parse on all five pages (layout's
`Organization/WebSite/SoftwareApplication/Service` + the page's own
`BreadcrumbList/ItemList` or `BreadcrumbList/Service/FAQPage`).

Grep gates over `app/solutions components/finch/solutions
lib/marketing/solutions.ts`:
```
R10,000|R30,000|R50,000|R3,000 per|setup fee|Start, Create|Vyso AI|Join Waitlist  → 0
backdrop-|glass|blur(                                                            → 0
```
"Vyso" appears in `lib/marketing/solutions.ts` only in the header comment
explaining the Vyso→Finch reframe; no rendered copy says Vyso does the watching.

**Link check.** Every internal `href` rendered by the five pages (38 unique)
resolves 200, including all sixteen learn articles, all six industry slugs,
`/platform/modules`, `/faq`, `/operations-audit` and `/#agents` (the homepage
now carries `id="agents"`). The one non-200 is `/about` → 308 → `/platform`,
which is Phase 1 workstream A's known, accepted state and not a D link choice
(it comes from `FinchFooter`).

### Browser (own tab, dev server on :3000, shared with three other workstreams)

**1440×900.** Hub: breadcrumb, `<h1>`, checklist left / card right, four cards
2×2, audit band. Ticking a symptom updates the card; the observation types, the
impact stamps orange, the chip counts, the two matched pages appear as links.
Sampled mid-typing: 5 characters per 200ms — exactly the 40ms/char the plan
asks for. Detail pages: hero + captioned finding card, problem, struggles 2×2,
cost shapes 4-across, agent cards 2×2 with status chips, module chips, workflow
4-across, related cards, industry/learn columns, FAQ `<dl>` 2-across.

`document.scrollWidth === clientWidth` (1425 = 1425) — no horizontal scroll;
zero elements in `<main>` extend past the viewport. Colour sweep of `<main>` on
a detail page: orange appears only on the hero CTA, the audit-band CTA, and the
finding card's state bar / agent dot / NEW chip / impact line, plus the agent
dots. Console: no errors (only Fast Refresh logs from other workstreams' edits).

**375×812.** `scrollWidth === clientWidth === 375`; `<h1>` 34px; finding card
335px; checklist full-width and tickable; agent/struggle/cost/workflow grids all
single column. No overflow anywhere in `<main>`.

### Not verifiable in this environment

- **A real `prefers-reduced-motion: reduce` profile.** The code path is a
  branch on `useReducedMotion()` (instant `textContent`, `initial={false}` on
  the stamp) and was read rather than run; same gap as every Phase 1 report.
- **Sustained 40ms typing over a long string.** Verified exactly at 40ms/char
  while the pane was actively painting; when the pane went unattended Chrome
  throttled the interval to ~200ms/char. That is timer throttling in the
  automation pane, not the code — the first sample is the honest one.
- Two other workstreams repeatedly re-fronted the browser pane and resized the
  viewport mid-session; geometry was therefore measured with
  `getBoundingClientRect` rather than trusted from screenshots.

### Orphaned by this workstream (for Phase 5's redundancy list, not deleted)

- Nothing new is orphaned outright. `components/marketing/PublicMarketing.tsx`
  (`PublicPageShell`, `AbstractFlowBackdrop`, `MarketingCta`, `Breadcrumbs`,
  `JsonLd`, `marketingStyles`) loses two more importers here but is still used by
  the old-design routes awaiting Phase 3.
- `lucide-react` loses two importers (`app/solutions/*`); still imported widely
  elsewhere.
- `app/solutions/[slug]/page.tsx` no longer exports `SOLUTIONS` (it exported both
  a route and its data). Nothing else in `app/`, `components/` or `lib/` imported
  it — verified by grep before and after.

---

## A — modules

Workstream A of `.ai/plan_phase2_product_cluster.md`: `/platform/modules` +
`/platform/modules/[slug]` (×10) rebuilt in the Finch design language, the
wiring-diagram signature visual, "used by" agent chips + status chips,
FAQPage + BreadcrumbList JSON-LD. **Nothing committed.** No file outside A's
list was touched.

### Files created

| File | What |
|---|---|
| `components/finch/modules/WiringDiagram.tsx` | The signature visual. `"use client"`. Desktop/tablet (`sm:` and up): one `<svg>` (lines, tile chrome and mono labels together, so nothing can drift at different widths) — the Finch mark (`/finch/finch-bird.svg`, the same asset `BirdHop.tsx` uses) at the centre of a 1160×460 canvas, ten module tiles on a ring, hairline connectors that draw with `pathLength` on `whileInView` (once), blue for read paths, ink for write paths, one plain hairline to ServiceDen (genuinely unconnected — see below). Below `sm`: `WiringList`, a plain mono list carrying the same facts at a size a phone can read (see deviation 1). Reduced motion: `initial="play" animate="play"` on both variants — the finished drawing, not an empty box, matching `AgentsOnShift.tsx`'s idiom exactly. |
| `components/finch/modules/ModuleScreenshotFrame.tsx` | The Finch-style screenshot frame the plan asks for: soft `border-fn-line`, `radius-12`, no browser chrome, no glow, no glass — replaces `components/marketing/ScreenshotFrame.tsx` (traffic-dot bar, faux URL pill, frosted glow) for this page tree only. Keeps the demo-account-chip mask (privacy, not chrome) as a plain opaque tile instead of a frosted blur. App path renders as a quiet mono caption under the frame instead of inside a fake browser bar. |
| `components/finch/modules/StatusChip.tsx` | The module-availability pill (`LIVE` / `LIMITED ROLLOUT`), styled after `FindingCard`'s `IN PROGRESS`/`RESOLVED` chips — neutral ink on a hairline border, deliberately not orange or blue (colour discipline: a module's own availability is neither agent activity nor evidence). |
| `components/finch/modules/AgentChips.tsx` | The "used by" chips: mono label + the small orange dot `WhatFinchWatches.tsx`/`AgentsOnShift.tsx` use for "this is an agent, at work." Every chip links to `/#agents` per the plan (validated live against the homepage, which now carries `id="agents"` — confirmed by Workstream D's own verification section above). Returns `null` for an empty `agents` array (ServiceDen) rather than rendering an empty row. |
| `components/finch/modules/ModuleCard.tsx` | The index grid card: white, `border-fn-line`, `radius-10`, name (STIX 20), one-line capability, "used by" chips, status chip, arrow — verbatim per the plan. No screenshot thumbnail (see deviation 2). |
| `components/finch/modules/ModuleFeatureSection.tsx` | Renders one "Inside `<Module>`" row in three shapes, matched to what the data actually has: a real screenshot (alternating side at `lg`, single column + `max-w-full` below it), ServiceDen's `placeholderTags` (a quiet dashed panel, "NOT PUBLICLY SCREENSHOTTED" + the real tag list — no gradient, no glass), or — where a section has neither (Doc-U's "intake"/"commit-gate", WasteWatch's "overview"/"coaching", PricePilot's "customers", PlanWise's "decisions", ShiftBoard's "cover", InsightGen's "sources") — a full-width copy block instead of a lopsided empty column. Server component; no client JS. |

### Files modified

- `app/platform/modules/page.tsx` — full rebuild. Eyebrow `UNDER THE HOOD`,
  `<h1>` "The machinery Finch runs on.", the exact sub-line the plan gives.
  `WiringDiagram` → five grouped sections (`MODULE_GROUPS`, H2 mono labels:
  Documents · Orders & money · Suppliers & stock · People · Insight) of
  `ModuleCard`s → a one-line pointer to `/solutions` → `AuditBand` →
  `FinchFooter`. `FinchNav` with no `active` (no `"modules"` value exists on
  `FinchNavSection` — that's the nav workstream's file, not touched here).
  Stopped importing `modules.module.css` and the old `PublicPageShell`/
  `ScreenshotFrame`/`marketingStyles` entirely. BreadcrumbList + ItemList
  JSON-LD (no FAQPage here — the index has no FAQs of its own; each detail
  page carries its own).
- `app/platform/modules/[slug]/page.tsx` — full rebuild. Breadcrumb → hero
  (role eyebrow, `<h1>` module name STIX 44/36, status chip, description,
  "used by" chips, hero screenshot) → feature sections → "How Finch uses it"
  (`module_.howFinchUsesIt`, new field, see below) → workflow (5-across at
  `lg`) → works with (sibling module cards) → industry fit (chips →
  `/industries/*`) → FAQs (native `<details>`, same pattern as `/faq`/
  `/pricing`) → related solutions → prev/next → `AuditBand`. BreadcrumbList +
  `SoftwareApplication` + FAQPage JSON-LD, all read straight off
  `module_.faqs`/`.capabilities` so the schema can't say something the page
  doesn't. Per-module `<title>` (hand-trimmed ≤60 chars, `META_TITLES`) and
  `<meta description>` (hand-written ≤155 chars incl. "South Africa",
  `META_DESCRIPTIONS`) — see deviation 3 for why these aren't derived from
  `module_.description`. Stopped importing `modules.module.css` and the old
  glass `ScreenshotFrame`.
- `lib/marketing/module-types.ts` — added `ModuleGroup`, `ModuleAvailability`
  and four new `MarketingModule` fields: `group`, `status`, `agents:
  readonly string[]`, `howFinchUsesIt: string`. Nothing removed; every
  existing field and every grounded feature/FAQ/bullet string is untouched.
- `lib/marketing/modules.ts` — added `MODULE_GROUPS` (the plan's five groups,
  verbatim, as a slug table independent of `MARKETING_MODULES`' own unrelated
  array order) and `AGENT_STATUS` (Doc-U `LIVE`, Price Watch `ROLLING OUT`,
  everything else `FROM YOUR AUDIT ROADMAP` — `.ai/vyso_v2.md` §4's copy rule,
  verbatim, kept local rather than imported from `components/finch/product/
  finch-data.ts` or `components/finch/agents/agents-data.ts` because both back
  pages this data set shouldn't depend on — `/finch` is marked "NOT BUILT" /
  pending removal in `.ai/vyso_v2.md` §2.2, and the homepage roster is one
  marketing section's own copy, not a canonical source). Re-exports the two
  new types.
- `lib/marketing/module-data/*.ts` (all 10) — added `group`, `status`,
  `agents`, `howFinchUsesIt` to every module object. **No existing field was
  removed or rewritten** — every capability, feature section, bullet, FAQ,
  workflow step, `worksWith`/`industryFit` entry is byte-for-byte what it was.
  `status` is `LIVE` for the nine modules with real screenshots, `LIMITED
  ROLLOUT` for ServiceDen (gated to a single internal Vyso account per its own
  file's header comment) — the exact chip text the plan specifies for it.

### Pricing/tier language found and changed

None. Grepped `lib/marketing/module-data/*.ts`, `modules.ts`, `module-types.ts`
and `app/platform/modules/**` for `R10,000|R30,000|R50,000|R3,000|setup
fee|tier|add-on|add on|Starter|Growth plan|Scale plan` before touching
anything: zero hits in the data (it was already the single-offer language the
plan expects — this data set predates the tiered-pricing copy entirely). The
only pricing-adjacent language anywhere in the page tree was the old
`app/platform/modules/page.tsx`'s "Vyso for SMEs" CTA button linking to
`/platform/vyso-for-smes` (a 308-redirected route, per Phase 1's redirect
table) — removed by the rebuild, not because it named a price, but because
its destination no longer resolves to a real page and the rebuilt hero has
one CTA (`Book your audit`), not two.

### "How Finch uses it" — which agents map to which module, and why

Grounded per module, not invented, in each module's own `worksWith`/feature
copy (cited in each file's `howFinchUsesIt` string). Read vs write in the
wiring diagram uses the same grounding: **write** where a module's own data
is populated automatically rather than typed in (ProcurePulse's stock "built
automatically from scanned supplier invoices," PricePilot's sell prices
"built from live product cost plus your margin rules," PlanWise's actuals
"measured … rather than typed in" — its own words); **read** everywhere else
an agent genuinely draws on a module's own numbers; and a plain,
uncoloured hairline for ServiceDen, whose own data says it is "a standalone
front office rather than a data feed into the rest of the platform" — the
honest picture, not an omission.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10):   error TS2724 …
lib/platform/whatsapp-ingest.ts(408,36): error TS7006 …
lib/platform/whatsapp-ingest.ts(589,5):  error TS2353 …
```
The three known pre-existing WhatsApp errors, nothing else.

```
$ npx eslint app/platform/modules components/finch/modules lib/marketing
```
Clean, no output (one `no-unused-vars` warning on an unused `title` local
during development, fixed by deleting the dead variable — not present in the
final files).

```
$ for slug in doc-u orderflow pricepilot procurepulse planwise wastewatch \
    shiftboard supplysync insightgen serviceden; do
    curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/platform/modules/$slug"; done
```
All ten return 200; `/platform/modules` itself 200. One `<h1>` on all eleven
pages (script-verified, not eyeballed).

JSON-LD: fetched each of the eleven pages, extracted every `<script
type="application/ld+json">` block, parsed with `JSON.parse` — 2 blocks per
detail page (the root layout's sitewide graph + the page's own
`BreadcrumbList`/`SoftwareApplication`/`FAQPage`), 2 on the index
(`Organization/WebSite/SoftwareApplication/Service` + this page's own
`BreadcrumbList`/`ItemList`) — all parse.

Grep gate on every file this workstream touched:
```
$ grep -rnE "R10,000|R30,000|R50,000|R3,000 per|setup fee|Start, Create|Vyso AI|Join Waitlist|backdrop-" \
    app/platform/modules components/finch/modules lib/marketing/modules.ts \
    lib/marketing/module-types.ts lib/marketing/module-data
```
0 matches, except `app/platform/modules/modules.module.css` (`backdrop-filter`
×2) — expected and accepted per the plan ("stop importing; leave file for
Phase 5"): confirmed neither rebuilt page imports it or any old
`marketing/ScreenshotFrame`/`PublicMarketing` component (`grep -rn
"modules.module.css\|marketing/PublicMarketing\|ScreenshotFrame\""` on both
page files → only `ModuleScreenshotFrame` from this workstream's own tree).

**Browser (dev server on :3000, shared with three other workstreams; own tab,
fronted before every screenshot).**

**1440×900.** Hero, wiring diagram (Finch mark centred, ten tiles on the ring,
lines drawn blue/ink/neutral with mono data labels, legend below), five
grouped sections of cards, `AuditBand`, footer — all render. `ProcurePulse`
detail page scrolled start to finish: hero + screenshot, six alternating
feature rows (screenshot side flips correctly on odd indices, verified against
the rendered DOM order), "How Finch uses it," five workflow steps, four
"works with" cards, three industry chips, five FAQs (native `<details>`
toggle verified programmatically — `summary.click()` → `details.open ===
true`, same mechanism as `/faq`), related-solutions links, prev/next
(Doc-U ← → PricePilot, correct registry-order neighbours), `AuditBand`.
`document.documentElement.scrollWidth === window.innerWidth` (1425 = 1440,
scrollbar) — no horizontal scroll. Console: no errors, no warnings (checked in
a fresh tab — see deviation 4 for a stale-HMR false alarm during development).

**375×812.** `scrollWidth === innerWidth === 375` on both the index and a
detail page. Index: `WiringList` (the mobile fallback, see deviation 1)
renders all ten rows legibly with the same read/write/none colour coding and
data labels as the desktop ring, plus the legend. Detail page: single-column
hero, screenshot `max-w-full`, agent chips wrap, no overflow anywhere.

ServiceDen spot-checked directly: `LIMITED ROLLOUT` chip, **no** "used by"
row (`agents: []` → `AgentChips` renders nothing — confirmed zero `/#agents`
hrefs from this component in the rendered HTML, versus one from the sitewide
footer's unrelated "What Finch watches" link), all five feature sections
render as dashed placeholder panels with their real `placeholderTags`, no
hero screenshot (none exist — no broken image, no invented placeholder box).

### Deviations from the plan

1. **`WiringDiagram` renders a plain mobile list (`WiringList`) below `sm`,
   not the radial SVG.** Measured in-browser: the 1160×460 canvas scaled to a
   375px-wide screen puts the 10.5px mono tile labels at ~3.4px and the 1px
   hairline connectors at ~0.32px — both effectively invisible (confirmed via
   screenshot: the section rendered as a blank gap). Rather than ship an
   illegible "signature visual" on the one width the plan explicitly requires
   ("Mobile: single column"), `WiringList` carries the identical facts (module
   name, read/write/none, data label) as a plain mono list at a size a phone
   can read, using the same always-mounted `hidden sm:block` / `sm:hidden`
   dual-render trick `PlatformShowcase.tsx` already uses for its own
   desktop/mobile split — no client measurement, no hydration mismatch, same
   `NODES` data table driving both. The ring itself (`sm` and up) is
   untouched from the plan's description.
2. **`ModuleCard` has no screenshot thumbnail on the index grid,** despite
   the old design's cards each carrying one. The plan's own card spec ("white,
   border, radius 10, name, one-line capability, chips, status chip, arrow")
   doesn't call for one, and a ten-up grid of screenshots directly below the
   page's real signature visual would compete with it rather than support it
   — kept the grid quiet, per the plan's own adjective for the page.
3. **Detail-page `<title>`/`<meta description>` are hand-written
   (`META_TITLES`/`META_DESCRIPTIONS`), not derived from `module_.name`/
   `.role`/`.description`.** `${name} — ${role}` alone runs to 65 chars for
   ServiceDen's four-part role name, and `module_.description` (the on-page
   hero paragraph) runs 132–220 chars across the ten modules — both over the
   plan's ≤60/≤155 budgets. Ten short, hand-trimmed strings (verified by
   script: all titles 32–47 chars, all descriptions ≤149 chars, all naming
   "South Africa" or "South African") were more honest than truncating a
   sentence mid-word or silently dropping the character budget for the
   longer modules.
4. **A hydration error surfaced once during development and is not a defect
   in the shipped code.** `ModuleCard` originally wrapped the entire card
   (including the nested `AgentChips` links) in one outer `Link` — an anchor
   containing anchors, which React flags as invalid HTML. Fixed by making the
   outer element a plain `<div className="group">` with two separate `Link`s
   (the module name, and the footer "Explore →" row) instead of one
   card-sized anchor; `AgentChips`' links sit as siblings, never nested.
   Verified via `curl` against the server HTML (no nested `<a>` in the
   response) and a **fresh** browser tab (an already-open tab kept replaying
   the old error from its in-memory HMR state even after the fix landed and a
   forced reload — a tooling artifact of this environment, not a real
   persisting bug; a new tab against the same dev server showed zero console
   errors).

### Not verifiable in this environment

- **A real `prefers-reduced-motion: reduce` OS profile.** `WiringDiagram`'s
  reduced-motion branch (`initial="play" animate="play"`, matching
  `AgentsOnShift.tsx`'s established idiom exactly) was verified by code
  reading, not by toggling an actual reduced-motion setting in this tool —
  same category of gap noted throughout `.ai/implementation_homepage_finch.md`
  and `.ai/implementation_phase1.md`.
- **The wiring diagram's draw-in sampled mid-animation.** The end state (all
  ten tiles, lines and the mark fully drawn, ≤1.2s total per the plan's
  budget — measured from the code's own transition timings: `0.15 + 9×0.05 +
  0.5 ≈ 1.1s` for the last connector) was confirmed by static screenshot and
  by reading the `delay`/`duration` values, not by sampling a frame partway
  through the draw.

### For Phase 5's redundancy list (not deleted, flagged only)

- `app/platform/modules/modules.module.css` — no longer imported by either
  page in this tree (per the plan's explicit instruction to stop importing it
  but leave the file for Phase 5).
- Nothing else. `components/marketing/ScreenshotFrame.tsx` and
  `components/marketing/PublicMarketing.tsx`'s exports (`PublicPageShell`,
  `AbstractFlowBackdrop`, `Breadcrumbs`, `JsonLd`, `MarketingCta`,
  `marketingStyles`) lose their importers in this page tree but remain in
  active use by old-design routes awaiting later phases — not flagging them
  as orphaned from this workstream alone.

## C — compare

Workstream C of `.ai/plan_phase2_product_cluster.md`: the `/compare` hub, the new
`/compare/finch-vs-hiring-a-coo` (the flagship, and the site's one home for the
day strip), and the two ported comparisons. **Nothing committed.**

### Files created

| File | What it is |
|---|---|
| `lib/marketing/compare.ts` | Every word the cluster renders: `HUB`, `SALARY`, `COO`, `ERP`, `SPREADSHEETS`, plus the shared types. The JSON-LD reads the same objects, so schema cannot drift from the page. |
| `components/finch/compare/CompareBits.tsx` | `Breadcrumb`, `Eyebrow`, `Section`, `ArrowLink`, `RuleList`, `PointGrid`, `StepRow`, `FitSplit`, `HonestyNote`, `SideLinks`. All server components. |
| `components/finch/compare/CompareHero.tsx` | The hero all four pages open with: breadcrumb, gradient rule, eyebrow, `<h1>`, the ≤ 45-word direct answer, two CTAs, and the page's one FindingCard on the right (omitted on the hub). |
| `components/finch/compare/CompareTable.tsx` | The comparison table. Pointer-row highlight and sticky-first-column are both CSS, so it ships no JavaScript. |
| `components/finch/compare/CostBars.tsx` | The COO page's signature visual. The only client component this workstream wrote. |
| `components/finch/compare/CompareFaqs.tsx` | The four-question `<dl>`, ids on each `<dt>` for deep links. |
| `components/finch/compare/compare-jsonld.ts` | `BreadcrumbList` + `FAQPage` (sub-pages) / `BreadcrumbList` + `ItemList` (hub). Page-scoped only — `Organization`/`WebSite`/`SoftwareApplication` stay in `app/layout.tsx`'s graph. |
| `components/finch/compare/PortedComparison.tsx` | The whole page body the two ported comparisons share (see deviation 1). |
| `app/compare/finch-vs-hiring-a-coo/page.tsx` | New. |
| `app/compare/finch-vs-erp/page.tsx` · `app/compare/finch-vs-spreadsheets/page.tsx` | Metadata + a data object each. |

### Files deleted

- `app/compare/vyso-vs-erp-systems/page.tsx`
- `app/compare/vyso-vs-spreadsheets/page.tsx`

Both content-complete before deletion: the strengths lists, the four breakdowns,
the eight/nine table rows, the four-step process and the four FAQs all survive in
`lib/marketing/compare.ts`, reframed.

### Files modified

- `app/compare/page.tsx` — rebuilt from `PublicPageShell`/glass into the Finch
  language. Three cards, each with a `HonestyNote` under it.
- `next.config.ts` — two 301s appended at the end of the redirects array, after
  a re-read immediately before the edit. Nothing else in the file touched.
- `app/sitemap.ts` — the two `vyso-vs-*` URLs swapped for their new names, the
  COO page added at priority 0.8 (it carries the §7 "AI COO / fractional COO"
  intent cluster), and `lastModified` set on all four.

### The salary figure, and why it is Indeed and not Robert Walters

The plan named Robert Walters SA, PayScale SA and Michael Page SA. Fetched with
the `firecrawl` skill on 2026-08-15:

- **Robert Walters Africa** publishes exactly three per-role SA pages — CEO, CTO,
  CFO. No COO, no operations manager. (Its CEO page gives "South Africa: R2.7m -
  R3m+"; extrapolating a COO from a CEO would have been inventing a number.)
- **Michael Page** has one publicly fetchable SA guide (2022). Parsed in full:
  no Operations Manager row, no COO row, and the tables never state their units.
- **PayScale SA** does carry both roles, but publishes **annual** base salary
  (Operations Manager R397,818, n=1,626; COO R997,515, n=200 — both 2026).
  These bars are per month, and dividing PayScale's annual figure by twelve
  would be our arithmetic presented as their number.
- **Indeed South Africa** states a monthly range directly, unambiguously, with a
  sample size and an as-of date: **R26,381 average, typically R13,251–R52,519 per
  month, updated 5 August 2026, 252 reported salaries** —
  `https://za.indeed.com/career/operations-manager/salaries`.

So the bars draw Indeed's monthly range, labelled "Operations manager in South
Africa, per month", with both PayScale pages linked underneath as corroboration
and the workings line stating plainly that it is average **base salary, not cost
to company** and that a full COO sits well above an operations manager. The
`SalarySource` type keeps the `monthlyLow`/`monthlyHigh` `null` path the plan
asked for — `CostBars` then draws the bar unlabelled with "market salary — see
sources" and drops the proportional claim — but it is not the path taken.

Glassdoor SA prints its monthly figures and then restates the identical numbers
as annual in the FAQ block on the same page; Indeed's own COO page reports
R117,277 *per year* for a COO on n=25, which is not credible. Neither is cited.

### Deviations from the plan (and why)

1. **The two ported comparisons render through one component.** They were the
   same page twice on the old site — identical seven sections in identical order,
   different subject — so `PortedComparison.tsx` holds the shape and the two
   routes are metadata plus a data object. Porting them as two page files would
   have ported the duplication. The COO page is deliberately *not* this shape: it
   has the day strip, the cost bars and the "hire instead" section, and forcing
   it through would have meant six optional props and a component rendering three
   different pages.
2. **`/faq#comparison` does not exist; the hub links `/faq#fit`.** The plan asks
   for a link to `/faq#comparison`. `lib/marketing/faq.ts` has no such group —
   the comparison group's id is `fit` (eyebrow "Comparison & fit"). Linking the
   plan's anchor would have been a link to nothing, so all four pages point at
   `/faq#fit`, which is the group the plan meant.
3. **The day strip runs its default beats.** The plan's two-track framing is in
   the eyebrow, the H2, the sub and a two-column `THE COO` / `FINCH` block under
   the strip — not in a second set of beats. The section's argument is that a
   COO's day and Finch's day are *the same day read twice*; a different set of
   beats would have broken the equivalence it is making. `day-beats.ts` is
   untouched, as instructed.
4. **The hub has no `<h2>` above its card grid.** The three cards are the `<h2>`s.
   A "Pick a comparison" heading over three cards that are already labelled is
   furniture; headings still descend h1 → h2 → h3 with nothing skipped.
5. **The Finch column of every table has no tint.** The old pages washed it
   `rgb(190 93 35 / 6%)`. On this site orange means an agent found something that
   costs money; a tinted "ours" column is a colour making an argument. The column
   carries ink and weight instead. Same reasoning puts the `HonestyNote` frame on
   `state="resolved"` (grey bar), since it is the case *against* the page it
   sits on.
6. **The cost bars are drawn to the top of the range, not the average.** The
   salary bar spans the full track (R52,519) and Finch's is 11.42% of it
   (6,000 ÷ 52,519 = 87px of 760px, measured). The average and the sample size
   sit under the bar as a mono line rather than as a second geometry.

### Verification

```
$ npx tsc --noEmit
lib/platform/whatsapp-ingest.ts(4,10)   TS2724 …
lib/platform/whatsapp-ingest.ts(408,36) TS7006 …
lib/platform/whatsapp-ingest.ts(589,5)  TS2353 …
```
The three known pre-existing errors, nothing else.

```
$ npx eslint app/compare components/finch/compare lib/marketing/compare.ts \
    next.config.ts app/sitemap.ts        # clean, no output
```

```
$ curl -sI localhost:3000/<path>
/compare/vyso-vs-erp-systems    308 → /compare/finch-vs-erp
/compare/vyso-vs-spreadsheets   308 → /compare/finch-vs-spreadsheets
$ curl -s -o /dev/null -w '%{http_code}' localhost:3000/<path>
/compare 200 · /compare/finch-vs-hiring-a-coo 200 · /compare/finch-vs-erp 200
/compare/finch-vs-spreadsheets 200          # one <h1> each
$ curl -s localhost:3000/sitemap.xml | grep -o 'compare[^<]*'
compare · compare/finch-vs-hiring-a-coo · compare/finch-vs-spreadsheets · compare/finch-vs-erp
$ grep -rn "finch/day" app components lib | grep -v '^components/finch/day/'
app/compare/finch-vs-hiring-a-coo/page.tsx:6   # the strip's only importer
```

**JSON-LD** parses on all four (two blocks each — the sitewide graph plus the
page's): hub `BreadcrumbList · ItemList`; the three sub-pages
`BreadcrumbList · FAQPage`.

**Grep gates** over `app/compare components/finch/compare lib/marketing/compare.ts`:
`R10,000|R30,000|R50,000|setup fee|Join Waitlist|Start, Create|Vyso AI|backdrop-|glassCard|PublicPageShell` → 0; `tier|per extra module` → 0.

**Colour discipline, measured in-page** (`getComputedStyle(...).color === rgb(201,79,14)`):
COO page → `NEW`, the four finding impacts, and `R6,000` (the Finch bar's stamp).
ERP page → `NEW`, `≈ R11,400/yr…`. Spreadsheets → `NEW`, `≈ R3,960 overstated…`.
Nothing else on any page is orange.

**The day strip plays, on this route.** Desktop stage measures exactly 1160×700
inside one 300vh wrapper with one sticky child. Walked the wrapper in twelve
steps: the clock ran 06:00 → 18:00, cards 1–3 reached opacity 1 in order, the
fourth dimmed to 0.38 (the designed dim as the three headlines leave for the
phone), the phone reached opacity 1, and the active caption ended on
`17:55 THE BRIEF`. At 375 the 300vh stage is absent and the beats stack.

**The cost bars grow and stamp.** With rAF pumped (the pane is shared and
throttled — see below), the salary fill reaches 760px of a 760px track and the
Finch fill 87px = 11.42%, both `transform: none` at rest, and both rand values
reach opacity 1 — the range in ink, `R6,000` in `#C94F0E`. Fill colours
`rgb(216,211,198)` and `rgb(20,18,14)`.

**Table behaviour.** `.hover\:\[--row-bg\:\#F5F2EA\]:hover` is present in the
compiled CSS inside Tailwind's `(hover: hover)` guard, so the row highlight is
pointer-only. The first column computes `position: sticky; left: 0`; scrolling
the region 250px at 375 left the row header at x=21 both before and after.
Table `min-width: 720px` inside an `overflow-x: auto` region that is
`tabIndex=0` + `role="region"` so a keyboard can reach it.

**1440**: `document.scrollWidth` 1425 vs `innerWidth` 1440 (scrollbar) on all
four; hub cards 344×415 ×3, uniform. **375**: `scrollWidth === innerWidth === 375`
on all four; hero, fit split and step row all one column at 335px; the finding
card is 335px with no internal overflow; the only elements past the viewport are
inside the table's own scroll region. H1 34px.

**Console**: no errors at 1440 or 375 on any of the four.

### Not verifiable in this environment

The Browser pane is shared with the other three workstreams and reports
`document.visibilityState === "hidden"`; screenshots after the first few come
back solid `#131313` and rAF is throttled to ~10fps. Everything above is DOM
measurement and sampled computed style, with the frame loop pumped where an
animation needed real frames. Still owed by eye: the cost bars mid-growth and
the day strip's intermediate beats, both of which were confirmed by their
end-states and by sampled intermediate values rather than by looking at them.

### Orphaned / for the architect

1. **`components/sections/SiteFooter.tsx`** still links `/compare/vyso-vs-spreadsheets`
   and `/compare/vyso-vs-erp-systems`. Nothing imports the file (`grep -rl SiteFooter
   app components` → itself only), and both links 301 correctly, so this is dead
   code for Phase 5's list rather than a broken link. `components/Navbar.tsx`
   links `/compare`, which is fine and also dead.
2. **Nothing else was orphaned.** The two deleted page files imported only from
   `components/marketing/PublicMarketing` and `lucide-react`, both of which many
   un-rebuilt pages still use.
3. **`/compare` is not in `FinchNav`.** `FinchNavSection` is
   `industries | pricing | learn | none`, so all four pages render `<FinchNav />`
   with no active item. The footer's Finch column already carries `Compare`.

## Architect review — Phase 2 (Fable, 2026-08-15) — APPROVED (structural); visual eyeball owed

Verified: `/compare/vyso-vs-*` 308 → new slugs; `/roi-calculator`, `/finch`,
`/platform` 308; modules index + 10 slugs, `/integrations`, `/compare` + 3,
`/solutions` + 4, `/operations-audit` all 200 with one <h1>; JSON-LD parses on
every page (Breadcrumb + FAQPage/ItemList/SoftwareApplication as appropriate);
each signature widget imported by exactly one route (orbit `/`, brief phone `/`,
showcase `/`, sequence `/`, day strip `/compare/finch-vs-hiring-a-coo`, symptom
checklist `/solutions`, wiring diagram `/platform/modules`, reading table
`/integrations`, cost bars COO page); grep gates 0 (only the dead
`modules.module.css` — Phase 5); no old glass shell/waitlist/roi/old-compare
links in the new pages; COO salary figure cited (Indeed SA, Aug 2026) with
PayScale corroboration; tsc 3 known errors; sitemap 51.
Not done by me: pixel review at 1440/375 — the Browser pane reported
`visibilityState: hidden` for the whole review, so screenshots were black. The
implementers each verified their pages in a visible tab; Josh should scroll
`/compare/finch-vs-hiring-a-coo`, `/solutions`, `/integrations`,
`/platform/modules` once on localhost.
Carry-forwards: Phase 3 must fix the dead learn-article links on `/industries/*`
(D found 9 dead ones in solutions data); `components/sections/SiteFooter.tsx` and
`Navbar.tsx` still reference retired URLs (orphaned, Phase 5); `costStats` in
solutions dropped as unsourced (re-add only with sources).
