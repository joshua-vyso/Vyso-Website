# Implementation log: Phase 2d — industries, integrations, case studies

Plan: `.ai/plan_vyso_redesign_2026.md` §7.5, §7.6, brief §37. Branch:
`redesign/operations-2026`. Nothing pushed, merged or deployed. Ran in parallel
with 2a/2b/2c on the same working tree; touched only the paths this phase was
scoped to.

---

## Scope delivered

1. **Industries** (`lib/marketing/industries.ts`, `app/industries/**`,
   `components/vyso/industries/**`): trimmed the registry from eight verticals
   to three, on the existing live slugs (`food-suppliers`, `wholesale`,
   `hospitality`). Rebuilt both routes on `components/vyso/*` primitives.
2. **Integrations** (`lib/marketing/integrations.ts`, `app/integrations/**`,
   `components/vyso/integrations/**`): rewrote the per-tool content honestly
   and rebuilt the page as one long index with anchor sections, no child
   routes. Added `excel` and `google-sheets` to the roster.
3. **Case studies** (`app/case-studies/**`, `components/vyso/case/**`): built
   a reusable template (`CaseTemplate.tsx` + a `CaseStudyData` shape) and used
   it for the one real case study, Turn 'n Slice, preserving every fact and
   both `[TNS_NUMBER]` placeholders from the pre-redesign page.

## Files created

| Path | What it is |
|---|---|
| `components/vyso/industries/IndustryCard.tsx` | Hub grid card |
| `components/vyso/industries/IndustryDeck.tsx` | Three `FindingCard`s from an `Industry.deck` |
| `components/vyso/industries/IndustryBody.tsx` | The `[slug]` page body: hero, gaps, deck, audit, solution links, FAQs, close |
| `components/vyso/integrations/IntegrationSection.tsx` | One `<dl>` per tool, with the logo-or-monogram fallback |
| `components/vyso/case/CaseTemplate.tsx` | The reusable Company/Industry/Situation/Problem/Before/Built/HowItWorks/Outcomes/Results/CTA template |
| `components/vyso/case/CaseCard.tsx` | Hub preview card, generic over `CaseStudyData` |
| `components/vyso/case/PriceListPeek.tsx` | Turn 'n Slice's "how it works" demo, a fresh `ChromeFrame` mock (not a port of `components/finch/company/PriceListDemo.tsx`, which is out of scope) |
| `components/vyso/case/turn-n-slice-data.ts` | The one case study's data, as `CaseStudyData` |

## Files rewritten in place

`lib/marketing/industries.ts`, `lib/marketing/integrations.ts`,
`app/industries/page.tsx`, `app/industries/[slug]/page.tsx`,
`app/industries/opengraph-image.tsx`, `app/industries/[slug]/opengraph-image.tsx`,
`app/integrations/page.tsx`, `app/integrations/opengraph-image.tsx`,
`app/case-studies/page.tsx`, `app/case-studies/opengraph-image.tsx`,
`app/case-studies/turn-n-slice/page.tsx`,
`app/case-studies/turn-n-slice/opengraph-image.tsx`.

Nothing outside this list was touched. In particular: `components/finch/**`,
`app/sitemap.ts`, `lib/marketing/solutions.ts`, `lib/marketing/faq.ts`,
`lib/marketing/site.ts` and `app/layout.tsx` were read only.

---

## `lib/marketing/industries.ts`: registry consumers found, and what happened to each

Grepped before touching anything, per the task's instruction:

- **`app/industries/page.tsx`, `app/industries/[slug]/page.tsx`** — mine.
  Rewritten to import the registry directly and render through
  `components/vyso/industries/*` instead of the old Finch components.
- **`app/industries/[slug]/opengraph-image.tsx`** — mine. Rewritten on
  `lib/og/vyso.tsx`, feeding it the vertical's own `deck`.
- **`components/finch/industries/{FindingDeck,IndustryCards,IndustrySections}.tsx`,
  `components/finch/industries/industries-jsonld.ts`** — NOT touched
  (`components/finch/**` is out of this phase's scope). Once this phase's page
  rewrite ships, nothing imports them any more: they read the registry
  generically (`.map()` over whatever `INDUSTRY_ORDER`/`INDUSTRIES` contains,
  no hardcoded slug list), so trimming the registry to three entries did not
  break their types. Verified: `npx tsc --noEmit` is unchanged (still exactly
  the 29 pre-existing free-scan errors, zero new ones). They are dead code
  after this phase, not deleted — that's Phase 4's job, with the
  Orbit-import-grep rule the plan lays out. Flagging explicitly here per the
  plan's "when in doubt, leave the file and note it in the report."
- **`components/finch/FindingStack.tsx`, `lib/marketing/findings.ts`** — only
  reference `lib/marketing/industries.ts` in a comment (verticals match this
  file's slugs), not an import. Unaffected.
- **`app/sitemap.ts`** — does **not** iterate the registry. It hardcodes the
  five removed industry URLs as literal strings
  (`/industries/restaurants`, `/industries/farms`, `/industries/catering-companies`,
  `/industries/security-companies`, `/industries/insurance-brokers`), so
  trimming the registry does **not** by itself remove them from the sitemap —
  contrary to the plan §7.5 assumption ("if sitemap.ts iterates the registry
  it will simply emit fewer URLs"). Per plan §10/§6, Phase 4 is already adding
  301s for exactly these five URLs (to `hospitality`, `food-suppliers` and the
  `/industries` hub respectively), so once those land the sitemap will point
  at redirecting URLs rather than 404s, but Phase 3/4 still needs to delete
  these five literal entries from `app/sitemap.ts` and add the three kept
  slugs' entries have not moved (still literal, still correct: `food-suppliers`,
  `wholesale`, `hospitality` are all still present and still resolve). **Not
  fixed here** — `app/sitemap.ts` is explicitly off limits for this phase.
- **`lib/marketing/llms.ts`** — imports `INDUSTRY_LIST` and `HUB.title` only
  (`.title`, nothing else off `HUB`), and generates its industries section
  with `INDUSTRY_LIST.map(...)`. Regenerates correctly with three entries
  automatically; no edit needed or made.

## `lib/marketing/integrations.ts`: consumers found

`components/finch/integrations-page/{ReadingTable,IntegrationSections,
integrations-jsonld,IntegrationsFaqs,DontSeeYourTool}.tsx` all import from
this file (`INTEGRATION_DETAILS`, `IntegrationStatus`, `INTEGRATIONS_FAQS`,
`DONT_SEE_YOUR_TOOL`). They are the pre-redesign `/integrations` page's
components, orphaned once `app/integrations/page.tsx` was rewritten to use
`components/vyso/integrations/IntegrationSection.tsx` instead. Kept the
`IntegrationStatus` union's exact original literal
(`"CONNECTED IN ONBOARDING"`, not shortened) specifically because
`IntegrationSections.tsx` keys a local `Record<IntegrationStatus, string>`
off it — a shortened literal would have failed that orphaned file's
type-check. Same `IntegrationDetail` shape kept throughout for the same
reason. Verified clean in the same `tsc` run above.

---

## Content decisions worth flagging

1. **Module codenames removed from the type, not just the copy.** The old
   `Industry.modules` field's `ModuleSlug` union was the literal Finch module
   codenames (`orderflow`, `doc-u`, `pricepilot`, …). `ModuleSlug` is local to
   `lib/marketing/industries.ts` (checked: not imported anywhere else), so it
   was renamed to capability-shaped slugs (`order-capture`,
   `price-monitoring`, `invoice-matching`, `supplier-records`,
   `reporting-alerts`) that carry no banned word, rather than leaving the old
   codenames sitting inert in a file this phase edited. `agents`, `deck`,
   `watchIntro`, `cardFinding`, `cardAgents`, `moduleNote` stayed on the
   `Industry` type (for `components/finch/industries/*`'s sake, see above) but
   were rewritten in full, Finch to Vyso, for the three kept verticals.
   `deck` is not decorative: it is the same data `components/vyso/industries/
   IndustryDeck.tsx` renders as the page's `FindingCard` demo.
2. **`components/finch/integrations.ts`'s `prompt` field says "Finch."**
   That file is out of scope (feeds the old orbit widget on other pages), so
   rather than duplicate all eleven prompts, `IntegrationSection.tsx` renders
   `integration.prompt.replace(/Finch/g, "Vyso")`. Caught by an actual sweep
   of the rendered page text (see Verification), not by inspection — worth
   flagging because it is the one place a banned name could have shipped
   silently through a file this phase didn't author.
3. **Two integrations were added outside the existing roster.** `excel` and
   `google-sheets` are not in `components/finch/integrations.ts` (out of
   scope to edit, and it also feeds the old orbit widget, which is a
   different decision than this page needs to make). Added as two plain
   `IntegrationDetail` objects directly in `lib/marketing/integrations.ts`,
   both honestly `ROADMAP` (the CSV/XLSX importer supports uploaded
   spreadsheets today; nothing reads a live file or a live Google Sheet).
   They have no SVG in `public/finch/integrations/`, so
   `IntegrationSection.tsx` falls back to a mono monogram badge rather than a
   broken `<img>`.
4. **Turn 'n Slice: two things changed, no fact did.** "OrderFlow" (the
   module codename the invoicing workflow was built on) is gone from every
   string, replaced by describing what it does. "Founding client"/"founding
   customer" is gone, replaced with "our first client" (the same phrase
   Phase 1's `HomeCase` already uses for this company). The four
   capabilities, the Roberto quote and byline, the Johannesburg/FMCG facts,
   and both `[TNS_NUMBER]` placeholders (copied verbatim from
   `components/vyso/home/HomeCase.tsx` so the homepage teaser and the full
   page ask for the same two figures) are unchanged. See
   `components/vyso/case/turn-n-slice-data.ts`'s own header for the full
   reasoning.
5. **Footer/solution links.** `IndustryBody.tsx` links to
   `/solutions/<slug>` using the plan §5 slugs (`whatsapp-order-automation`,
   `invoice-automation`, etc.). Several of these don't exist in
   `lib/marketing/solutions.ts` yet at any given moment depending on Phase
   2c's own progress (built in parallel) — same "reviewable now, 404 until
   its sibling phase lands" pattern Phase 0's `Footer.tsx` already
   established. Not a bug in this phase.
6. **HUB (`/industries` index) copy was freely restructured.** The only
   external reader of `HUB` besides my own rewritten `app/industries/page.tsx`
   is `llms.ts`, which reads `HUB.title` only. Dropped the old
   primary/experimental split fields (`primaryEyebrow`, `alsoHeading`, etc.)
   since there are no experimental verticals left to split from.

## Deviations

1. **Dev server: shared, not isolated on 3104.** Another agent already had
   `next dev` running against this same working tree (no git worktrees are in
   use across the four parallel Phase 2 agents — one shared directory, four
   sets of disjoint files). Next.js 16's dev server refuses a second instance
   against the same project directory regardless of port: `next dev -p 3104`
   printed "Ready" then immediately logged `⨯ Another next dev server is
   already running` and exited. Verified via `ps`/`lsof` that the existing
   server (port 3000) has the same `cwd` as this repo, so it serves the exact
   file state this phase produced (dev mode recompiles on request). All
   browser and `curl` verification below ran against `localhost:3000`
   instead of 3104. The server was **not** killed on completion, since it is
   not mine and other agents depend on it.
2. **The shared Browser pane is contended by the other parallel agents** (four
   tabs on `localhost:3000` were live at once: `seed`, `tab-1`, `tab-2`,
   `tab-3`). Several screenshot/scroll calls on my own tab (`tab-3`) timed out
   with "Browser pane is currently hidden" while another agent's tab held the
   foreground. Where a screenshot could not be captured reliably,
   `get_page_text` and `document.documentElement.scrollWidth` (both of which
   don't need the pane to be frontmost/compositing) stood in for the same
   check. Every route got at least one successful screenshot AND a full
   `get_page_text` pass; see Verification.
3. **Found and fixed two em dashes I introduced myself**, caught only by
   inspecting the rendered `<title>`/`<meta>` text rather than by re-reading
   my own source (`HUB.title` and one `alt` string used `—`; five page
   `TITLE` constants also did). All six fixed to a colon or comma before
   final verification. Listed so the pattern is visible: the plan's own
   dash-sweep command greps *source* files; it would have caught the comment
   dashes (false positives, not customer-facing) rather than these real ones
   sitting in a string constant. Re-swept the *rendered* text of every page
   this phase built after the fix; zero hits.

## Verification

- **`npx eslint` on every touched path** — clean, zero output (fixed one
  `react/no-unescaped-entities` on an apostrophe along the way).
- **`npx tsc --noEmit`** — 29 errors, all in the pre-existing untracked
  free-scan files (`components/finch/scan/**`, `tests/free-scan-content.test.ts`),
  identical list to Phase 0/1's own reports. Re-ran after every edit in this
  phase; the count never moved from 29. Zero errors in any file this phase
  touched or created.
- **Dev server** (shared, see Deviations) — every route: `200`.
  `/industries/farms` (and by extension the other four removed verticals):
  `404`, correctly — Phase 4 adds the 301 for it.
- **Structural checks on the raw HTML of all seven pages this phase built**
  (`/industries`, all three `/industries/[slug]`, `/integrations`,
  `/case-studies`, `/case-studies/turn-n-slice`): exactly one `<h1>` and
  exactly one `data-vy-ground="dark"` section on every page; each page's own
  `BreadcrumbList` JSON-LD parses and sits alongside the root layout's
  Organization/WebSite/ProfessionalService/Service graph (two separate
  `<script type="application/ld+json">` tags, not merged); every OG image
  route (`renderVysoOgImage`-based, all seven) returns `200 image/png`.
- **Copy sweep, run against the RENDERED text of all seven pages** (tags
  stripped, script/style excluded, so flight-payload prefetch noise from
  still-unmigrated sibling routes like `/faq`, `/about`, `/learn` — which
  legitimately still say "Finch" until Phase 2b/3 land — couldn't produce a
  false pass): zero hits for `[—–]`, zero for "finch" (case-insensitive), zero
  for every module codename, "founding client", "academy", "fractional coo",
  and the brief §6 banned-phrase list. This is the sweep that caught both the
  `HUB.title` em dash and the `integration.prompt` "Finch" leak documented
  above, both fixed before this report was written.
- **Rand figures**: every one on the three industry pages and the case study
  is operational (a supplier price, an order value, a shortage cost), never a
  Vyso fee. Confirmed by listing every `R\d` match on the rendered pages and
  reading each one in context.
- **Mobile 375px**: `document.documentElement.scrollWidth === 375` on
  `/industries`, `/industries/wholesale`, `/industries/hospitality`,
  `/integrations`, `/case-studies` — no horizontal overflow on any of them.
  `/industries/food-suppliers` and `/case-studies/turn-n-slice` additionally
  got full-page screenshot scrolls (desktop and mobile) confirming the
  `FindingCard` deck, gaps grid, audit steps, solution links, FAQ, price-list
  demo, stats strip and quote all lay out correctly at both widths.
- **Console**: no application errors on any route beyond the known PostHog
  `/ingest` 404s (Josh's untracked `instrumentation-client.ts`, out of scope,
  already flagged by Phase 0/1).
- Did not kill the shared dev server (see Deviations §1).

## What Phase 3/4 need to know

- **`app/sitemap.ts` still lists five URLs this phase removed the content
  for**: `/industries/restaurants`, `/industries/farms`,
  `/industries/catering-companies`, `/industries/security-companies`,
  `/industries/insurance-brokers`. They currently 404 (the `[slug]` page's
  `getIndustry()` returns `undefined` and it calls `notFound()`). Phase 4's
  redirect table (plan §6) already maps all five to a correct destination;
  once those 301s land the URLs will redirect rather than 404, but the
  sitemap should still stop listing them directly (list the redirect
  destinations instead) — that edit needs to happen in the same phase as the
  redirects, per plan §12's edge case about compare/modules pages, which
  applies here too.
- **`components/finch/industries/*`, `components/finch/integrations-page/*`,
  `components/finch/company/*`** (the last of these was read for pattern
  reference only, never imported by anything this phase wrote) are
  candidates for Phase 4's Orbit-grep-then-delete pass. None of them are
  imported by any route after this phase.
