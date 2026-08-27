# Implementation log: Phase 2c — Solutions

Plan: `.ai/plan_vyso_redesign_2026.md` §5, §7.4. Branch `redesign/operations-2026`
(verified via `git branch --show-current` before starting; not created here).
Touched only: `lib/marketing/solutions.ts`, `app/solutions/**`,
`components/vyso/solutions/**`, plus two small necessary fixes to orphaned
Finch-era code (see "Collateral cleanup" below). Nothing pushed, nothing
merged, no other phase's files edited.

Ran in parallel with three other Phase 2 agents on the same working tree (not
git worktrees) — confirmed live during this session via other browser tabs
open on `/contact`, `/industries/*` and `/integrations`, and via an
in-progress, uncommitted rewrite of `lib/marketing/industries.ts` (1312 → ~550
lines) already on disk when this phase started.

---

## Scope delivered

Rewrote `lib/marketing/solutions.ts` from nothing (the old file was entirely
Finch-branded: "Finch fixes", agent roster, module status chips, four old
slugs including `operations-dashboard`). New typed registry:
`Solution`, `SolutionDemo` (`timeline` | `findings`, mirroring
`EventTimeline`'s and `FindingCard`'s prop shapes structurally rather than
importing them, so the file stays a plain data module like `findings.ts`),
`SOLUTION_ORDER`, `SOLUTIONS`, `SOLUTION_LIST`, `getSolution()`, `HUB`.

Built `app/solutions/page.tsx` (index) and `app/solutions/[slug]/page.tsx`
(8 static pages) entirely on `components/vyso/*` primitives (`Shell`,
`Section`, `Button`, `Card`, `Reveal`, `demo/ChromeFrame`, `demo/EventTimeline`,
`demo/FindingCard`) — no Finch component is imported by either route anymore.

### New files

| Path | What it is |
|---|---|
| `components/vyso/solutions/SolutionDemo.tsx` | Renders a solution's `demo` field as either an `EventTimeline` in `ChromeFrame`, or a grid of `FindingCard`s |
| `components/vyso/solutions/SolutionCard.tsx` | The hub's card |
| `components/vyso/solutions/SolutionFaqs.tsx` | The `<dl>` FAQ list |
| `components/vyso/solutions/SolutionRelated.tsx` | Related solutions (pills) + one learn article + case study link |
| `components/vyso/solutions/SolutionClose.tsx` | The page's one dark CTA band |
| `components/vyso/solutions/solutions-jsonld.ts` | `BreadcrumbList` + `ItemList` (hub) and `BreadcrumbList` + `Service` + `FAQPage` (slug), referencing `${SITE.url}/#organization` — the same `@id` `app/layout.tsx`'s graph declares |

### Rewritten files

- `lib/marketing/solutions.ts` — full rewrite (852 → ~1180 lines, all new content)
- `app/solutions/page.tsx` — full rewrite on `Shell`/`Section`/`SolutionCard`
- `app/solutions/[slug]/page.tsx` — full rewrite: hero (problem answer),
  approach (3 steps), demo, outcomes, integrations honesty, related, FAQs,
  close
- `app/solutions/[slug]/opengraph-image.tsx` — rewritten to call
  `renderVysoOgImage` from `lib/og/vyso.tsx` (import only, not modified) with
  each solution's own `og` field

### Unchanged (left as-is)

- `app/solutions/opengraph-image.tsx` — already re-exports the root
  `/opengraph-image`, which is the `--vy-*` template since Phase 1. No change
  needed.

---

## The 8 solutions: slug → title → learn article

Every learn-article link is unique (all 8 of `lib/marketing/learn-articles.ts`'s
articles are used exactly once), chosen for topical fit. Phase 3 needs this
table for the sitemap/llms regeneration (plan §8: "sitemap.ts: remove deleted
routes … add new solution slugs").

| # | Slug | Title (metadata) | Nav/card name | Learn article linked |
|---|---|---|---|---|
| 1 | `whatsapp-order-automation` | WhatsApp order automation for South African SMEs | WhatsApp order automation | `/learn/15-signs-your-business-has-operational-chaos` |
| 2 | `invoice-automation` | Invoice automation for South African SMEs | Invoice automation | `/learn/ai-for-small-and-medium-businesses-practical-use-cases` |
| 3 | `spreadsheet-automation` | Spreadsheet automation for South African SMEs | Spreadsheet automation | `/learn/how-much-time-can-workflow-automation-save` |
| 4 | `procurement-automation` | Procurement automation for South African SMEs | Procurement automation | `/learn/hidden-cost-of-manual-procurement` |
| 5 | `inventory-automation` | Inventory automation for South African SMEs | Inventory automation | `/learn/the-real-cost-of-poor-stock-control` |
| 6 | `reporting-automation` | Reporting automation for South African SMEs | Reporting automation | `/learn/why-weekly-reports-are-usually-too-late` |
| 7 | `document-processing` | Document processing for South African SMEs | Document processing | `/learn/supplier-scorecards-what-to-track-and-why` |
| 8 | `reduce-money-leakage` | Reduce money leakage in your business | Reduce money leakage | `/learn/why-businesses-lose-money-without-realising-it` |

`operations-dashboard` (old slug) is REMOVED from the public registry: it 404s
today (verified by curl) and is not in `SOLUTION_ORDER` or
`generateStaticParams`. Phase 4 adds the 301 to `/solutions/reporting-automation`
per plan §6.

All 8 pages link `/case-studies/turn-n-slice` (plan §7.4: "where relevant" —
judged relevant on every page, since Turn 'n Slice genuinely covers
procurement, stock, wastage, pricing, reporting, order flow and purchasing
insight, per the brief). All 8 link 2–3 sibling solutions via the `related`
field (no page links back to itself; every `related` slug resolves).

### Demo grammar per page (for QA / future edits)

- **Timeline** (`EventTimeline` in `ChromeFrame`): `whatsapp-order-automation`
  (WhatsApp chrome, a possible-duplicate-order scenario, NOT the homepage's
  shortage script), `procurement-automation` (window chrome, the FreshCo
  butternut scenario lifted near-verbatim from `findings.ts`'s `butternut-price`
  — the flagship finding), `reporting-automation` (window chrome, the
  `margin-slip` finding as the week's alert).
- **Findings** (`FindingCard` grid): `invoice-automation`, `spreadsheet-automation`,
  `inventory-automation` (uses `stock-frozen-writeoff` / `stock-holiday-overstock`
  / `stock-oil-cover` from `findings.ts` near-verbatim), `document-processing`
  (uses `recon-crates` / `recon-drums` / `recon-delivery-fee`), `reduce-money-leakage`
  (uses `debtors-thyme-basil` / `margin-slip` / `recon-drums`).

Two pages (`document-processing`, `reduce-money-leakage`) deliberately show two
`alert`-state cards rather than the system's "roughly one accented element per
section" default — same exception `components/vyso/home/HomeExamples.tsx`
already established for the homepage: on a page whose SUBJECT is "things worth
noticing", showing only one signal undersells the point. Noted per plan
convention rather than silently exceeded.

---

## Copy rules verified

- **Em/en dashes**: swept `lib/marketing/solutions.ts` and all touched
  components with a Unicode-aware grep for U+2014/U+2013/U+2212. Found and
  fixed five instances I introduced (a date range `"JUN–AUG"` twice, `"MON–FRI"`
  twice, a minus sign + en dash in a `findings.ts`-derived meta string, and one
  em dash in `HUB.title`). Final sweep of every data field (`meta`, `time`,
  `text`, `title`, `heading`, `summary`, `description`, `observation`, `impact`,
  `evidence`, `question`, `answer`, `label`, `copy`, `body`, `lead`) → zero
  hits. Remaining em dashes in the file are exclusively inside code-comment
  docblocks (developer documentation, not customer-facing copy — the same
  convention Phase 0/1's own files use).
- **Banned phrases / codenames / Finch / COO / per-location**: zero hits in
  customer-facing copy across `lib/marketing/solutions.ts`,
  `app/solutions/**`, `components/vyso/solutions/**`. The only "finch" string
  matches are inside code comments referencing file paths
  (`components/finch/industries/IndustrySections.tsx`).
- **No Vyso prices**: every rand figure checked (`R12,640`, `R58,000/yr`,
  `R23,400 outstanding`, etc.) is operational — a customer invoice, a supplier
  overcharge, an outstanding debtor balance, a stock write-off. None is a Vyso
  fee.
- **Integration honesty**: every `integrationsNote` was checked against
  `lib/marketing/integrations.ts` (read-only) before writing. Xero is
  described as read-only ("we don't post entries back into Xero yet"),
  WhatsApp Business as a real, connected channel (order capture + confirmation,
  and — for `document-processing` — photographed invoices/delivery notes,
  which really is what `integrations.ts`'s `whatsapp.reads` says). Everything
  else (Sage, Loyverse, Yoco, Excel/Sheets) is framed as "we design systems
  around" or "on our roadmap, scoped during your audit" — never claimed as a
  live connection. No occurrence of "native integration" anywhere in the file.

---

## Cross-file coupling found and handled

Two files outside the Phase 2c scope depend on the OLD `lib/marketing/solutions.ts`
shape. Both are documented in the new file's header.

1. **`lib/marketing/llms.ts`** (Phase 3's own file) imports `SOLUTION_LIST` and
   `HUB`, reading `.name` / `.slug` / `.summary` per solution and `HUB.title`.
   All four names are preserved on the new type specifically so Phase 3's pass
   has real, current data without needing this file touched again.

2. **`components/finch/industries/IndustrySections.tsx`** does
   `SOLUTIONS[slug].shortName`, where `slug` comes from
   `lib/marketing/industries.ts`'s OWN `SolutionSlug` union (industries.ts does
   not import this file's types). That union, mid-rewrite by Phase 2d on disk
   when this phase ran, already matched `SOLUTION_ORDER` exactly (both
   independently converged on the plan's 8 slugs) — so the retired
   `"operations-dashboard"` key is not actually needed by the current tree.
   As defensive margin against ordering, `SOLUTIONS` (the loose
   `Record<string, Solution>`, not `Record<SolutionSlug, Solution>`) still
   carries `"operations-dashboard": reportingAutomation` as a compatibility
   alias. It is NOT in `SOLUTION_ORDER`, not statically generated, and not
   linked from anywhere new — `getSolution()` returns `undefined` for it (the
   dynamic route correctly 404s), only the raw `SOLUTIONS` map still resolves
   it. **Phase 2d/4 can delete this alias** once `industries.ts` stops naming
   it and the next.config.ts redirect (plan §6) is live — it costs nothing to
   leave in the meantime.

## Collateral cleanup (files outside the 3 declared paths, with justification)

Rewriting `lib/marketing/solutions.ts`'s `Solution` type (dropping the old
`agents`/`modules`/`costIntro`/`problem`/`struggles`/`workflow`/`exampleFinding`/
`industries` fields the Finch-era shape had) orphaned code that would otherwise
fail `tsc`. Grepped for other importers before touching anything, per the same
rule plan §10 sets for `components/finch/*` deletions generally:

- **Deleted** (zero remaining importers, confirmed by repo-wide grep for
  `finch/solutions/`): `components/finch/solutions/SolutionCards.tsx`,
  `components/finch/solutions/SolutionSections.tsx`,
  `components/finch/solutions/SymptomChecklist.tsx`,
  `components/finch/solutions/solutions-jsonld.ts`. These existed only to
  render the two old `app/solutions/**` route files this phase replaced.
- **Left untouched**: `components/finch/solutions/SolutionBits.tsx` — it
  exports `Breadcrumb`/`Eyebrow`/`ArrowLink`/`StatusChip`, genuinely shared
  primitives imported by `app/learn/**`, `app/resources/**` and
  `components/finch/learn/LearnBits.tsx`. Only removed the two functions
  inside it that were dead (`AgentChipRow`, `AgentList`, typed against the now
  gone `SolutionAgent`) — confirmed via grep that
  `components/finch/industries/IndustryBits.tsx` defines its own,
  differently-shaped `AgentChipRow` locally and never imported this one.

No other `components/finch/*` or `app/**` file outside `app/solutions/**` was
touched.

---

## Verification

- **`npx eslint lib/marketing/solutions.ts app/solutions components/vyso/solutions
  components/finch/solutions`** — clean, zero output (one `no-html-link-for-pages`
  error was found and fixed mid-session: two `<a>` tags in
  `app/solutions/[slug]/page.tsx` converted to `next/link`'s `Link`).
- **`npx tsc --noEmit`** — exactly 29 errors, byte-identical to Phase 0/1's
  documented baseline, all in Josh's untracked free-scan work
  (`components/finch/scan/**`, `tests/free-scan-content.test.ts`). Verified
  before AND after the collateral cleanup above — the `SolutionBits.tsx` fix
  was required to hold this line (it introduced one new error before the fix:
  `TS2724: has no exported member named 'SolutionAgent'`).
- **Dev server**: could not start a second instance on port 3103 as
  instructed — this working tree already had another agent's `next dev`
  server live (confirmed via `lsof -i :3000`; three other browser tabs open
  on `/contact`, `/industries/*`, `/integrations` during this session,
  and an uncommitted, in-progress `lib/marketing/industries.ts` rewrite
  already on disk). Since this is a single shared working directory, not git
  worktrees, only one `next dev` instance is possible against the shared
  `.next/dev/logs` lock regardless of the port argument passed. QA proceeded
  against the existing live server (port 3000).
- **curl, all 9 solution routes**: `/solutions` and the 8 slugs → `200`, each
  with exactly one `<h1>` and the correct `<title>`. `/solutions/operations-dashboard`
  → `404` (clean, no crash — the redirect is Phase 4's job).
- **Browser QA** (front tab first, per instructions):
  - `/solutions` at 1440 and 375 — 3-column grid at desktop, 1-column at
    mobile, nav/CTA correct, dark close band correct, footer links resolve.
  - `/solutions/whatsapp-order-automation` (timeline, WhatsApp chrome) — full
    scroll-through at 1440 AND 375: hero, breadcrumb, approach steps, the
    WhatsApp demo (including the accent "NEEDS ATTENTION" / "VYSO RECOMMENDS"
    cards), outcomes, integrations honesty, related pills, FAQ `<dl>`, dark
    close. Zero horizontal overflow at 375 (`scrollWidth === 375`).
  - `/solutions/invoice-automation` (findings grid) — verified via
    `get_page_text` (screenshot capture was flaky under the shared,
    multi-agent browser session — several transient all-black frames that
    cleared on a fresh reload and were confirmed via JS DOM queries to NOT
    reflect real page state: exactly one `data-vy-ground="dark"` element,
    correctly positioned near the end of the page). All three finding states
    (watching/alert/resolved) render with correct copy.
  - `/solutions/procurement-automation` (timeline, window chrome, the
    `findings.ts` butternut scenario) and `/solutions/reduce-money-leakage`
    (findings grid, two intentional alerts) — verified via `get_page_text`,
    content and dash-fix confirmed correct in the live DOM.
  - Remaining 4 slugs verified via curl (200, correct h1/title) per the "curl
    the other 5" instruction — 3 were browser-verified beyond the required 3,
    so only `spreadsheet-automation`, `reporting-automation` and
    `document-processing` relied on curl alone.
  - Console: no application errors on any page. The only errors are PostHog
    `/ingest` 404s, the documented pre-existing noise from Josh's untracked
    `instrumentation-client.ts` (Phase 0/1 saw the same).
- **Dev server left running** (deviation from "kill server after" — see
  below).

## Deviations

1. **Dev server not killed.** It is shared with the three other Phase 2
   agents working the same tree concurrently (confirmed live: other tabs open
   on `/contact`, `/industries/*`, `/integrations` throughout this session).
   Killing it would have interrupted their in-progress QA. Left running;
   whichever agent finishes last, or Josh, should stop it.
2. **`SOLUTIONS["operations-dashboard"]` compatibility alias** added to
   `lib/marketing/solutions.ts`, not called for explicitly in plan §7.4 —
   defensive margin against `components/finch/industries/IndustrySections.tsx`
   crashing at runtime while Phase 2d's `industries.ts` rewrite was still
   uncommitted. Full reasoning in the file's own header and in "Cross-file
   coupling" above. Safe to delete once Phase 2d/4 land.
3. **Two functions removed from `components/finch/solutions/SolutionBits.tsx`**
   (`AgentChipRow`, `AgentList`) and **four files deleted** from
   `components/finch/solutions/` — outside the three declared paths, but
   directly orphaned by the mandated rewrite and confirmed (by repo-wide grep)
   to have zero other importers. Documented in detail above and inside
   `SolutionBits.tsx` itself.
4. **No symptom-checklist widget.** The old hub's `/solutions` had an
   interactive `SymptomChecklist` (tick symptoms, see which solutions match).
   Plan §7.4 doesn't ask for one on the redesigned hub ("overview grid of the
   8, problem-first framing, audit CTA" — no interactive widget named), so it
   was not rebuilt; its data (`SYMPTOMS`, `CHECKLIST_COPY`, `checklistObservation`)
   was dropped along with the component that was its only consumer.

## What Phase 3 needs (sitemap / llms / OG sweep)

- `app/sitemap.ts` currently hardcodes 4 stale `/solutions/*` URLs (lines
  ~163–187 as found): `reduce-money-leakage`, `procurement-automation`,
  `reporting-automation`, and the now-dead `operations-dashboard`. It needs
  all 8 new slugs from the table above and the `operations-dashboard` entry
  removed (its redirect, once Phase 4 adds it, covers the URL instead).
- `lib/marketing/llms.ts` needs no code change — it already reads
  `SOLUTION_LIST`/`HUB` generically and will pick up the new 8 slugs and
  summaries automatically once regenerated/re-read. Verify `/llms.txt` locally
  after Phase 3's other changes land, per plan §8.
- New solution OG images render via `lib/og/vyso.tsx` already (this phase);
  no OG sweep needed for `/solutions/**`.
