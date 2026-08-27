# Implementation log: Phase 3 — Plumbing

Plan: `.ai/plan_vyso_redesign_2026.md` §7.6, §8, §11 (Phase 3). Branch
`redesign/operations-2026` (verified via `git branch --show-current` before
starting; not created here). Ran solo, after Phase 0/1/2a-d had landed on the
shared working tree. Nothing pushed, merged or deployed. Reused the dev
server already running on port 3000 (healthy on arrival); did not kill it on
completion, since Phase 4 or Josh's own review may still be using it.

---

## Scope delivered

1. **`app/layout.tsx` fallback metadata** — default title, OG title and
   Twitter title (`title.default`, `openGraph.title`, `twitter.title`) changed
   from "Vyso, AI automation agency in South Africa" to "Vyso, AI operations
   company in South Africa", matching the JSON-LD Organization's
   `alternateName` (already correct from Phase 1) and the plan §2 positioning.
   `description` was already `SITE.description` (the plan §2 support line,
   dash-free) — no change needed there. Fonts, providers and JSON-LD untouched.
2. **`app/sitemap.ts`** — removed the five hardcoded deleted-industry URLs
   (`/industries/restaurants`, `/industries/farms`,
   `/industries/catering-companies`, `/industries/security-companies`,
   `/industries/insurance-brokers`) and the stale `/solutions/operations-dashboard`
   entry; added `/how-it-works`; made both the Solutions block and the
   Industries block registry-driven (`SOLUTION_LIST` from
   `lib/marketing/solutions.ts`, `INDUSTRY_LIST` from
   `lib/marketing/industries.ts`) instead of hand-typed, so all 8 current
   solution slugs and all 3 current industry slugs are emitted with no
   separate list to drift; bumped `CONTENT_LAST_MODIFIED` to 2026-08-27.
   `finch`, `platform/modules`, `founding-client`, `academy`, `compare/*` and
   Orbit's own generation block are all untouched, per plan §12's rule that a
   sitemap entry and its redirect land in the same phase (Phase 4).
   `learnDate()`'s fail-loud mechanism is untouched and no learn slug was
   renamed.
3. **`lib/marketing/llms.ts`** — fixed a real, pre-existing crash: this file's
   `FINCH_GROUP = FAQ_GROUPS.find((g) => g.id === "finch")` lookup started
   throwing the moment an earlier phase rewrote `faq.ts` without a "finch"
   group, which 500'd both `/llms.txt` and `/llms-full.txt` (confirmed by
   curl before the fix). Replaced with lookups against `faq.ts`'s current
   "vyso" and "pricing" groups (`WHAT_IS_VYSO`, `HOW_MUCH_DOES_VYSO_COST`,
   `ONGOING_SUPPORT`), keeping the same fail-loud contract. Rewrote the
   `/llms.txt` title, "Product" section and "Facts" section to the new
   positioning: no more "Vyso — Finch, your company's own COO" title, no more
   quoted Vyso price ("R6,000 per location"), no more "Founding-client terms"
   bullet. `/how-it-works` added to the page index; the Home label rewritten;
   several `— ` page labels converted to `: `. `/solutions` and `/industries`
   sections already read `SOLUTION_LIST`/`INDUSTRY_LIST` from an earlier
   phase and needed no change to pick up the new 8/3 slugs. The
   Modules/Compare/Founding sections further down (still Finch-branded, still
   naming module codenames and a comparison salary figure) were left exactly
   as they were, per the plan's explicit instruction to leave those for
   Phase 4 to strip together with their routes.
   - **Collateral fix, `lib/marketing/founding.ts`**: tracing the `/llms.txt`
     crash led to a second, deeper one. `founding.ts`'s `FOUNDING_FAQ_IDS`
     named five FAQ ids from the old Finch-era "pricing" group
     (`how-much-does-finch-cost`, `is-there-a-setup-cost`, `founding-terms`,
     `several-locations-custom-integrations`, `can-we-cancel`) — none of
     which exist in the current `faq.ts` any more, so every one of them threw
     at module load. This crashed `/founding-client` itself (confirmed 500
     before the fix, 200 after) in addition to both llms routes (which import
     `FOUNDING_TITLE`/`FOUNDING_DESCRIPTION` from this file). Patched
     `FOUNDING_FAQ_IDS` to the four ids that actually exist in the current
     "pricing" group. This is a minimal compatibility fix, not a content
     rewrite of `/founding-client` — that page's fuller rewrite (or deletion)
     is Phase 4's job.
4. **Learn + glossary + resources copy pass** — see the per-entry table below.
   No slug was renamed or deleted anywhere in this pass.
5. **Chrome swap** — `app/learn/**`, `app/resources/**`, `app/privacy`,
   `app/terms`, `app/popia` now render the vyso `Shell` (`active="insights"`
   for learn/resources, `active="none"` for the three legal pages) instead of
   `FinchNav`/`FinchFooter`. `components/finch/legal/LegalReading.tsx`
   (shared by all three legal pages, no other consumer) was repainted from
   `--fn-*` to `--vy-*` in place. `components/finch/learn/LearnBits.tsx` and
   `ResourceCard.tsx` (both exclusive to `/learn`+`/resources`, confirmed by
   grep before editing) were repainted the same way; `LearnBits.tsx` now
   carries its own small `Breadcrumb`/`Eyebrow`/`StatusChip`/`ArrowLink`
   instead of importing them from `components/finch/solutions/SolutionBits`
   (still live for `/compare`, untouched). `IllustrativeFinding` now renders
   through `components/vyso/demo/FindingCard` instead of
   `components/finch/FindingCard`. `AuditBand` (shared with several
   Phase-4-scoped pages) was dropped rather than ported; the vyso `Footer`
   already carries its own audit CTA row, so every page keeps a closing CTA.
   Legal page *text* is untouched, per the task's explicit instruction — see
   "Deviations / flagged gaps" for the one place this leaves a real
   copy-rule violation live.
6. **OG image sweep** — `app/learn/[slug]/opengraph-image.tsx` and
   `app/learn/glossary/[term]/opengraph-image.tsx` were rebuilt on
   `renderVysoOgImage` (`lib/og/vyso.tsx`, import only), replacing the old
   Finch-template `renderOgImage` (`lib/og/render.tsx`). Each article/term's
   `endFinding`/`example` is mapped into the template's two-row feed shape
   (observation, then impact as a `VYSO NOTICED` accent row). The other four
   OG routes in this tree (`/learn`, `/learn/glossary`, `/resources`,
   `/resources/[slug]`) already re-export the site-wide `app/opengraph-image.tsx`,
   which Phase 1 already rebuilt on `lib/og/vyso.tsx` — so they were already
   vyso-branded and needed no change; left as re-exports rather than given
   bespoke content, which is a lower-effort choice noted in Deviations.
   All seven OG routes in this tree verified `200 image/png` by curl.
7. **Nav label check** — `components/vyso/Nav.tsx` and `Footer.tsx` already
   said "Insights" from Phase 0; confirmed by grep that no in-page "Learn"
   label survives anywhere in `components/vyso/**` or the pages this phase
   touched. URLs are unchanged (`/learn/**`).

---

## Learn / glossary / resources: what changed, one line each

### Learn articles (`lib/marketing/learn-articles.ts`) — all 8

| Slug | What changed |
|---|---|
| `why-businesses-lose-money-without-realising-it` | "How Finch helps" → "How Vyso helps", de-Finched (InsightGen/ProcurePulse named capabilities instead); em/en dashes fixed; `relatedIndustryHrefs` restaurants → hospitality |
| `15-signs-your-business-has-operational-chaos` | "How Finch helps" de-Finched (dropped ShiftBoard/ProcurePulse/InsightGen names, fixed the wrong "one-week Operations Audit" duration claim to "free"); dashes fixed; `relatedSolutionHrefs` operations-dashboard → reporting-automation; `relatedIndustryHrefs` catering-companies → wholesale |
| `how-much-time-can-workflow-automation-save` | "How Finch helps" rewritten to drop the literal module-codename sentence ("moves into a dedicated module like OrderFlow or Doc-U"); dashes fixed |
| `hidden-cost-of-manual-procurement` | "How Finch helps" de-Finched (ProcurePulse/Doc-U named capabilities); dashes fixed; `relatedIndustryHrefs` farms → wholesale |
| `supplier-scorecards-what-to-track-and-why` | "How Finch helps" de-Finched (SupplySync/ProcurePulse); dashes fixed (including six term-definition list items); `relatedSolutionHrefs` operations-dashboard → reporting-automation; `relatedIndustryHrefs` farms → food-suppliers |
| `why-weekly-reports-are-usually-too-late` | "How Finch helps" de-Finched (InsightGen); dashes fixed incl. an escaped `—` in an agent role string; `relatedSolutionHrefs` operations-dashboard → spreadsheet-automation; `relatedIndustryHrefs` restaurants → wholesale |
| `the-real-cost-of-poor-stock-control` | "How Finch helps" de-Finched (WasteWatch/ProcurePulse/InsightGen); "our restaurant industry page" → "our hospitality industry page"; dashes fixed; `relatedSolutionHrefs` operations-dashboard → inventory-automation; `relatedIndustryHrefs` restaurants/catering-companies → hospitality/food-suppliers |
| `ai-for-small-and-medium-businesses-practical-use-cases` | "How Finch helps" de-Finched (Doc-U/InsightGen), endFinding observation "Doc-U read both" → "Vyso read both"; dashes fixed (incl. five term-definition list items); `relatedSolutionHrefs` operations-dashboard → document-processing |

Also fixed: three `MAY–AUG`/`JUN–AUG`/`JUL–AUG`-style en-dash date ranges in
`meta` fields (→ hyphen), and the file's own header docblock (previously
described a "Vyso → Finch" convention that no longer applies).

### Glossary (`lib/marketing/glossary.ts`) — all 12 terms touched for dashes; 5 content-level

| Term | What changed |
|---|---|
| `fractional-coo` | **The required rewrite.** Definition kept (already neutral, dash fixed). `whyItMatters`'s second paragraph, which said "it is the one Finch is priced as… the comparison page sets them side by side", replaced with a plain "Vyso is not a fractional COO" note: what a fractional COO does, what Vyso does instead, no sales pitch. `relatedPages` dropped the `/compare/finch-vs-hiring-a-coo` link, replaced with "The free operations audit" + "How Vyso works" |
| `money-leakage` | `relatedPages`'s "What Finch watches" → `/#agents` (a dead anchor on the redesigned homepage) replaced with "Start your operations audit" → `/operations-audit` |
| `debtors-ageing` | `relatedPages` "Operations dashboard" → `/solutions/operations-dashboard` (404 today) replaced with "Reporting automation" → `/solutions/reporting-automation` |
| `gross-margin-vs-markup`, `stock-cover-days` | `relatedPages` "Restaurants" → `/industries/restaurants` (404 today) replaced with "Hospitality" → `/industries/hospitality` on both |
| `weekly-brief` | "which is why Finch sends it on WhatsApp" → "Vyso sends it" |
| `invoice-line-item`, `popia` | Agent label/meta "DOC-U" (a banned module codename) renamed to "DOC CHECK" on both; `invoice-line-item`'s `relatedPages` "Under the hood: the modules" → `/platform/modules` replaced with "How Vyso works" → `/how-it-works` |

The other 5 terms (`operations-audit`, `delivery-note-reconciliation`,
`price-creep`, `vat-inclusive-pricing`) plus all 12 collectively: em/en dashes
in every real field (`definition`, `whyItMatters`, `metaDescription`,
`example.observation`/`.meta`, `GLOSSARY_HUB.lead`/`.description`) converted
to commas, colons, full stops or parentheses. No term was renamed, deleted or
had its slug touched.

### Resources (`lib/marketing/resources.ts`) — all 3, dashes only

`operations-audit-checklist`, `weekly-operations-report-template`,
`supplier-scorecard`: no Finch/module/price content was present (an earlier
phase had already fixed that), so this pass was a pure em/en-dash sweep
across `summary`, `whoItsFor`, and every `preview` section's list items —
about a dozen instances converted to commas/colons/parentheses. One
substantive edit: `operations-audit-checklist`'s `whoItsFor` listed
"restaurants" as a named example alongside "hospitality operations" — dropped
the redundant, now-delisted "restaurants" mention (hospitality already covers
it post-redesign).

### Learn/resources page templates (chrome + copy fixed together)

- `app/learn/page.tsx`, `app/learn/[slug]/page.tsx`,
  `app/learn/glossary/page.tsx`, `app/learn/glossary/[term]/page.tsx`,
  `app/resources/page.tsx`, `app/resources/[slug]/page.tsx`: Shell swap (see
  above) plus in-page copy fixes found while rewriting: "See what Finch
  fixes" → "See what Vyso builds"; "WHAT FINCH FIXES" eyebrow → "WHAT VYSO
  BUILDS"; "What it looks like when Finch catches it" → "…when Vyso catches
  it"; "the same operational problems Finch watches for" → "…Vyso watches
  for"; "how Finch approaches {solution}" → "how Vyso approaches"; "the
  one-week Operations Audit" (wrong duration, a Finch-era claim) → "the free
  Operations Audit" (twice); `SOLUTION_LABELS`/`INDUSTRY_LABELS` lookup maps
  in `app/learn/[slug]/page.tsx` rebuilt from the old 4-solution/6-industry
  set to the current 8-solution/3-industry set; the CTA button in
  `app/resources/[slug]/page.tsx` moved from a hand-rolled orange `<Link>` to
  `components/vyso/Button` (solid ink, per plan §4 — no orange CTA).

---

## Verification

- **`npx tsc --noEmit`**: 29 errors throughout, byte-identical to every prior
  phase's documented baseline (all in `components/finch/scan/**` and
  `tests/free-scan-content.test.ts`, Josh's untracked free-scan work). Zero
  errors in any file this phase touched. Re-ran after every batch of edits.
- **`npx eslint`** on every touched path (`app/layout.tsx`, `app/sitemap.ts`,
  `app/learn`, `app/resources`, `app/privacy`, `app/terms`, `app/popia`,
  `lib/marketing/{glossary,learn-articles,resources,llms,founding}.ts`,
  `components/finch/learn`, `components/finch/legal`): clean, zero output.
- **`npm run test`**: 1118 tests, 0 failures.
- **`/sitemap.xml`**: 94 URLs. Zero occurrences of `/industries/restaurants`,
  `/industries/farms`, `/industries/catering-companies`,
  `/industries/security-companies`, `/industries/insurance-brokers`, or
  `/solutions/operations-dashboard`. `/how-it-works` present once (a second
  hit is Orbit's own, unrelated `/orbit/how-it-works`). All 8 current solution
  slugs present, all 3 current industry slugs present, nothing else. Orbit's
  22 URLs untouched.
- **`/llms.txt` and `/llms-full.txt`**: both **500'd before this phase's fix**
  (confirmed by curl) — see "Facts" and the `founding.ts` fix above. Both now
  **200**. Read the full output of both: Product/Facts/Pages sections read
  coherently against the new positioning, no Vyso price, no "founding
  client", `/how-it-works` and all 8 solutions/3 industries listed. The
  Modules/Compare/Founding sections further down are still Finch-branded on
  purpose (Phase 4 scope, documented above and in the file's own header).
- **Redirect/route spot-checks** (dev server on :3000): `/learn`,
  `/learn/[8 slugs]`, `/learn/glossary`, `/learn/glossary/[12 slugs]` (spot
  checked `fractional-coo`), `/resources`, `/resources/[3 slugs]`,
  `/privacy`, `/terms`, `/popia`, `/how-it-works`, `/compare`, `/industries`,
  `/industries/food-suppliers`, `/solutions`, `/orbit`, `/academy`,
  `/design`, `/founding-client` — all `200`.
- **OG images**: all 7 routes in this tree (`/learn`, `/learn/[slug]`,
  `/learn/glossary`, `/learn/glossary/[term]`, `/resources`,
  `/resources/[slug]`, plus the root) return `200 image/png`. Visually
  checked `/learn/why-businesses-lose-money-without-realising-it/opengraph-image`
  in the browser: correct wordmark, eyebrow, title, and a "VYSO NOTICED"
  accent card built from the article's `endFinding`.
- **Copy-rule sweeps** (rendered/real fields only, code comments excluded —
  same convention Phase 2c/2d established): zero em/en dashes; zero
  case-insensitive hits for "finch", "doc-u", "orderflow", "pricepilot",
  "procurepulse", "supplysync", "serviceden", "insightgen", "wastewatch",
  "shiftboard", "planwise", "founding client", "academy" across
  `lib/marketing/{glossary,learn-articles,resources}.ts` and every page this
  phase touched. "Fractional COO" hits in `glossary.ts` are the term itself
  being defined, the intended exception.
- **Browser QA**: `/learn`, an article
  (`why-businesses-lose-money-without-realising-it`, full scroll — hero,
  finding card, "How Vyso helps", related-solutions/industries pills,
  related-articles grid), `/learn/glossary/fractional-coo`, `/resources`,
  `/privacy` — all one `<h1>`, correct chrome, correct copy, at desktop.
  Mobile (375px): `document.documentElement.scrollWidth === 375` on
  `/learn`, `/learn/glossary`, `/resources/operations-audit-checklist` — no
  horizontal overflow.
- **Console**: no application errors on any route beyond the documented
  PostHog `/ingest` 404s (Josh's untracked `instrumentation-client.ts`, flagged
  by every prior phase).
- Dev server left running (shared with Josh's own review / a possible
  Phase 4 agent).

---

## Deviations / flagged gaps

1. **`/terms` still has a live "Founding client terms" section** (heading
   "4. Founding client terms", body "founding clients receive:
   {FOUNDING_TERMS...}"). This is a real, rendered violation of plan §1's
   acceptance criterion #2 ("zero public references to… founding client…").
   Not fixed here: the task's explicit instruction for this phase was "Legal
   page text untouched," and `/terms` carries its own header comment saying
   its text "stay[s] until Josh (or counsel) signs off — do not remove either
   without" sign-off, plus a `DRAFT · UNDER LEGAL REVIEW` chip and
   `noindex`. Flagging rather than silently leaving it: whoever owns the
   final legal-content pass (Josh, or Phase 4 if it's judged in scope there)
   needs to know this line exists.
2. **Four of the six OG routes in this tree are re-exports, not bespoke
   images.** `/learn`, `/learn/glossary`, `/resources` and
   `/resources/[slug]` all just re-export `app/opengraph-image.tsx` (the
   site-wide image, already on the vyso template since Phase 1) rather than
   getting their own page-specific `renderVysoOgImage` call the way
   `/learn/[slug]` and `/learn/glossary/[term]` now do. They are correctly
   branded (no Finch content, 200 image/png, accurate), just generic rather
   than page-specific. Judged acceptable given the task said "rebrand to
   lib/og/vyso.tsx" (satisfied by inheritance) rather than "give every route
   bespoke content" — flagging so a future pass can decide whether it's worth
   four more custom generators.
3. **`components/finch/legal/LegalReading.tsx`, `components/finch/learn/LearnBits.tsx`
   and `ResourceCard.tsx` were edited in place** rather than left alone and
   duplicated into `components/vyso/*`. Each was confirmed by grep to have
   no consumer outside the exact page tree this phase's task named (three
   legal pages; six learn/resources pages respectively), so editing in place
   carries no risk to any other route — but they remain physically inside
   `components/finch/` and `SolutionBits.tsx`'s three exports
   (`Breadcrumb`/`Eyebrow`/`ArrowLink`) are now duplicated (once in
   `SolutionBits.tsx` for `/compare`, once in `LearnBits.tsx` for
   learn/resources). Worth collapsing into `components/vyso/*` properly once
   `/compare` is deleted in Phase 4 and `SolutionBits.tsx` has no remaining
   reason to exist.
4. **`components/finch/pricing/pricing-data.ts` still contains a live Vyso
   price** (`DIRECT_ANSWER`, `STRAIGHT_ANSWERS` — "R6,000 per location per
   month") and is the underlying data for `/pricing`'s old content and
   several `STRAIGHT_ANSWERS` still referenced by Compare/founding-adjacent
   code. Not edited: it wasn't in this phase's scope and Phase 4 deletes the
   routes that read it. `lib/marketing/llms.ts` no longer imports it (the
   `DIRECT_ANSWER`/`FOUNDING_TERMS`/`STRAIGHT_ANSWERS` imports were removed
   as part of the crash fix), so it no longer leaks into `/llms.txt`.
5. **`components/finch/industries/IndustrySections.tsx`'s dead
   `SOLUTIONS["operations-dashboard"]` compatibility alias** (flagged by
   Phase 2c as safe to delete once Phase 2d/4 land) was not touched — still
   out of this phase's declared scope, still harmless (not in
   `SOLUTION_ORDER`, not statically generated, not linked anywhere new).

## What Phase 4 needs to know

- The redirect table (plan §6) must cover exactly the five removed industry
  URLs and `/solutions/operations-dashboard` this phase stopped listing in
  the sitemap — they now 404 until those redirects land, same transitional
  state Phase 2c/2d's own reports already flagged.
- Deleting `/compare/**`, `/platform/modules/**`, `/founding-client` and
  `/academy` should also strip their sections from `lib/marketing/llms.ts`
  (`buildCompareSection`, `buildModulesSection`, the `FOUNDING_*` imports and
  the "## Founding client" block in `buildLlmsFullTxt`) in the same phase,
  per plan §12's same-phase rule — this phase deliberately left them, per its
  own instructions.
- `lib/marketing/founding.ts` and `components/finch/pricing/pricing-data.ts`
  are both slated for deletion with `/founding-client`/`/pricing`; the
  `FOUNDING_FAQ_IDS` patch in this phase is a stopgap to stop the crash, not
  a reason to keep the file longer than planned.
- The `/terms` "Founding client terms" section (see Deviations §1) needs a
  decision: rewrite, delete with the rest of the founding-client content, or
  leave for legal sign-off as its header comment already says.
