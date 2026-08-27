# Implementation log: Phase 4 — Deletions + redirects

Plan: `.ai/plan_vyso_redesign_2026.md` §11 (Phase 4), full redirect table §6,
edge cases §12, constraints §10. Branch `redesign/operations-2026` (verified
via `git branch --show-current` before starting; not created here). Ran solo,
after Phase 0/1/2a-d/3 had all landed on the shared working tree. Reused the
dev server already running on port 3000 (healthy on arrival; confirmed via
`lsof` and a `curl` to `/`). Left it running on completion — Phase 5 or Josh's
own review may still need it. Nothing pushed, merged, staged with `git add -A`,
or touched in stashes/untracked files (verified `git status --short` before
and after: the only untracked entries throughout were Josh's own free-scan
work, `.ai/*.md` plan files, and `instrumentation-client.ts` — none staged,
none edited, none deleted).

---

## Scope delivered

1. **Deleted the five route trees** named in plan §11: `app/finch/**`,
   `app/platform/**` (the `modules` hub + `[slug]` + both `opengraph-image.tsx`
   files — that was the entirety of `app/platform`), `app/founding-client/**`,
   `app/academy/**`, `app/compare/**` (hub + all three `finch-vs-*` sub-routes,
   each with its own `opengraph-image.tsx`).
2. **Deleted the orphaned content files** the plan named, after grepping each
   for remaining consumers and fixing every one found:
   - `lib/marketing/modules.ts` + `lib/marketing/module-data/**` (10 files) +
     `lib/marketing/module-types.ts` (not named in the plan text, but its only
     importers were the 10 module-data files and the now-deleted
     `StatusChip.tsx` — fully orphaned by this phase's own deletions, deleted
     alongside them).
   - `lib/marketing/compare.ts`, `lib/marketing/founding.ts`.
   - No standalone "academy content file" exists in `lib/marketing/` — the
     Academy page's copy lived inline in `app/academy/page.tsx` plus
     `components/finch/academy/**` (deleted in the component sweep below).
   - Consumers fixed in the same commit: `app/sitemap.ts`, `lib/marketing/llms.ts`,
     `lib/marketing/solutions.ts`, `components/finch/pricing/pricing-data.ts` —
     see "Consumer fixes" below.
3. **Removed the `"operations-dashboard"` alias** from
   `lib/marketing/solutions.ts`'s `SOLUTIONS` map (Phase 2c's defensive bridge
   for `IndustrySections.tsx`, which this phase deleted with zero remaining
   importers — the alias is no longer needed, and the URL 301s now).
4. **Orphaned component sweep** across `components/finch/**` and
   `lib/og/**` — see the full deleted/kept tables below.
5. **Redirects** — `next.config.ts`'s `redirects()` rewritten to plan §6's
   table exactly: every stale entry (`/platform/*` → `/`, the `/apps` chain,
   `/pricing` → `/operations-audit`, `/compare/vyso-vs-*` → `/compare/finch-vs-*`)
   replaced with the new destinations, plus every new source the table adds
   (`/finch`, all 10 `/platform/modules/*` per-module mappings, `/academy`,
   `/founding-client`, `/insights`, `/solutions/operations-dashboard`, the 5
   industry redirects, `/compare` + all 5 variants). All 308 (`permanent: true`,
   matching the codebase's existing convention). Verified no duplicate
   `source` strings and no destination that is itself a redirect source (see
   Verification).
6. **Footer/Nav/app-wide link sweep** — grepped `components/vyso/Footer.tsx`,
   `components/vyso/Nav.tsx`, all of `app/**`, `components/**`, `lib/**` for
   `href="/(finch|platform|founding-client|academy|compare)...`. Zero real
   hits outside files this phase deleted, with one flagged exception — see
   Deviations §1.
7. **Sitemap + llms** — `app/sitemap.ts` no longer lists `/finch`,
   `/platform/modules` (+ the 10 module slugs), `/founding-client`, `/academy`,
   `/compare` (+ 3 sub-pages); `lib/marketing/llms.ts` drops the
   Modules/Compare/Founding sections and imports entirely (Phase 3 left them
   in deliberately for this phase, per its own header comment and report).

---

## Consumer fixes (files edited to survive the deletions)

| File | What broke | Fix |
|---|---|---|
| `app/sitemap.ts` | Imported `MARKETING_MODULE_SLUGS` from the deleted `lib/marketing/modules.ts`; hardcoded `/finch`, `/platform/modules(+slugs)`, `/founding-client`, `/academy`, `/compare(+3)` entries | Removed the import and all six URL blocks; updated three stale comments (one still said "`app/founding-client`" as a `CONTENT_LAST_MODIFIED` consumer, one called Orbit's sibling pages "the Finch ones"/"Finch money pages") |
| `lib/marketing/llms.ts` | Imported `HUB as COMPARE_HUB, COO, ERP, SPREADSHEETS, SALARY` from deleted `compare.ts`, `MARKETING_MODULES` from deleted `modules.ts`, and `FOUNDING_URL`/`FOUNDING_TITLE`/`FOUNDING_DESCRIPTION` from deleted `founding.ts`; `buildPageIndex()` referenced `/finch`, the compare hub/pages, `/platform/modules`(+ module list), `/academy`, and the founding page; `buildLlmsFullTxt()` called `buildModulesSection()`/`buildCompareSection()` and rendered a "## Founding client" block | Removed all three imports, the now-unused `rand()` helper (only used by the removed `buildCompareSection`), the five stale `buildPageIndex()` entries, both section-builder functions, and the "## Founding client" template block. Updated the file's own header comment (previously said Phase 4 would do this "further down" — now says it's done) |
| `lib/marketing/solutions.ts` | Carried Phase 2c's `"operations-dashboard": reportingAutomation` compatibility alias for `IndustrySections.tsx` | Removed the alias entry and rewrote the two comment blocks that explained it (file header + inline comment above `SOLUTIONS`) to say it's gone and why |
| `components/finch/pricing/pricing-data.ts` | Imported `MARKETING_MODULES` from deleted `lib/marketing/modules.ts` to build a `MODULES: IncludedItem[]` list feeding `INCLUDED_GROUPS`'s `"platform"` group | Removed the import; replaced the computed `MODULES` with an empty, correctly-typed `const MODULES: IncludedItem[] = []` and a comment explaining why (this file survives only because `/terms` imports its `FOUNDING_TERMS` constant — see Deviations §1 — and `INCLUDED_GROUPS`'s only consumer, `WhatsIncluded.tsx`, has had zero importers since `/pricing` itself was deleted in an earlier phase, so nothing renders the module list live) |

No other file needed a fix — every other real importer of a deleted path was
itself inside a deleted route or a deleted component folder (see the sweep
tables below), confirmed by grepping `^import` lines repo-wide before each
deletion, not just `grep -l <name>` (which produced several false positives
from doc-comment mentions of a file's own path — e.g. `pricing-data.ts`,
`llms.ts`, and `app/terms/page.tsx` all *mention* deleted paths in comments
without importing them).

---

## Orphaned component sweep: deleted (zero remaining importers, repo-wide)

All confirmed by `grep -rn "^import.*<name>"` across `app/**`, `components/**`,
`lib/**` (not a plain substring grep, which false-positives on doc comments —
see above) immediately before each deletion.

**Whole folders**, every file's only importer was inside the folder itself or
inside a route deleted this phase:
- `components/finch/compare/**` (`CompareBits`, `CompareFaqs`, `CompareHero`,
  `CompareTable`, `CooCta`, `CooHero`, `CostBars`, `PortedComparison`,
  `compare-jsonld.ts`) — only importer of each was `app/compare/**`.
- `components/finch/modules/**` (`AgentChips`, `ModuleCard`,
  `ModuleFeatureSection`, `ModuleScreenshotFrame`, `StatusChip`,
  `WiringDiagram`) — only importer of each was `app/platform/modules/**`.
- `components/finch/academy/**` (`AcademyInterest`, `SeatGrid`,
  `academy-jsonld.ts`) — only importer was `app/academy/page.tsx`
  (`SeatGrid` via `AcademyInterest`'s own relative import, not caught by a
  naive `@/components/finch/academy/SeatGrid` grep — found by reading
  `AcademyInterest.tsx` directly).
- `components/finch/company/**` (`CohortRow`, `CompanyBits`, `TermsStrip`,
  `company-jsonld.ts`, and two files that were **already** fully orphaned
  before this phase touched anything — `PriceListDemo.tsx`, `SouthAfricaMap.tsx`,
  zero importers repo-wide, confirmed pre-existing dead code Phase 2d's own
  report flagged as "read for reference only, never imported") — only live
  importer of the other four was `app/founding-client/page.tsx`.
- `components/finch/day/**` (`DayCard`, `DayStrip`, `DayBriefPhone`,
  `DaySection`, `day-beats.ts`) — a self-contained chain
  (`DaySection → DayStrip → DayCard`/`DayBriefPhone → day-beats`) whose only
  external importer was `app/compare/finch-vs-hiring-a-coo/page.tsx`.
- `components/finch/showcase/**` (`BriefHome`, `BriefMobile`, `Cursor`,
  `FindingDetail`, `data.ts`) — self-contained, only external importer was
  `components/finch/PlatformShowcase.tsx`.
- `components/finch/industries/**` — **four of five files deleted**
  (`IndustryBits.tsx`, `IndustryCards.tsx`, `IndustrySections.tsx`,
  `industries-jsonld.ts`); the fifth, `FindingDeck.tsx`, was restored — see
  "Kept despite orphaned" below, this was a real near-miss.

**Individual files**, each confirmed to have exactly one importer, itself
deleted this phase:
- `components/finch/FoundingQuote.tsx`, `HomeHero.tsx`, `PlatformShowcase.tsx`,
  `ScrollSequence.tsx`, `Senses.tsx`, `SequenceIntro.tsx`, `UnderTheHood.tsx`,
  `WhatFinchWatches.tsx` — each imported only by `app/finch/page.tsx`.
- `components/finch/IntegrationsOrbit.tsx`, `IntegrationPrompt.tsx` — imported
  only by the now-deleted `Senses.tsx` (both in turn import
  `components/finch/integrations.ts`, which **stays** — see Kept table).
- `components/finch/BriefPhone.tsx` — imported only by `ScrollSequence.tsx`
  (deleted) and `components/finch/day/DayStrip.tsx` (deleted).
- `components/finch/text/CursorDrift.tsx` — imported only by `HomeHero.tsx`
  (deleted). (`text/Statement.tsx`, `text/MagneticButton.tsx` — the file's
  siblings — both have live importers outside `app/finch` and stay; see Kept.)
- `components/finch/agents/AgentsOnShift.tsx` — imported only by
  `WhatFinchWatches.tsx` (deleted). Its siblings `AgentVisual.tsx` and
  `agents-data.ts` stay — both are imported by `components/finch/FindingCard.tsx`
  and `lib/marketing/findings.ts`, live.
- `lib/marketing/module-types.ts` — see "Consumer fixes" table; imported only
  by the 10 deleted `module-data/*.ts` files and the deleted `StatusChip.tsx`.
- `lib/og/comparison.ts` — imported only by the three deleted
  `app/compare/finch-vs-*/opengraph-image.tsx` files.

**63 files deleted in total** (5 route directories' worth of pages/OG images +
2 lib/marketing content files + 10 module-data files + `module-types.ts` +
`lib/og/comparison.ts` + 44 component files across 7 folders + 13 standalone
component files). Full list is the `git status --short` output at commit time
(all `D` entries).

---

## Kept despite being orphaned (or near-orphaned), with reasons

| File | Why it looked deletable | Why it stays |
|---|---|---|
| `components/finch/industries/FindingDeck.tsx` | Lives in the folder being deleted; not itself named by the plan | **Genuine near-miss.** `components/finch/FindingStack.tsx` imports it via a relative path (`./industries/FindingDeck`), which my first grep pass (anchored on the literal substring `finch/industries`) missed entirely — relative imports don't contain that string. `FindingStack.tsx` is imported by `app/design/DesignSink.tsx`, which plan §10 rule (d) explicitly keeps live (`/design` is Phase 5 scope). Deleting it broke `tsc` immediately (`Cannot find module './industries/FindingDeck'`) — caught by the verification pass, not by the sweep itself. Restored via `git restore --source=HEAD` before it was ever committed. `FindingDeck.tsx`'s own imports (`FindingCard.tsx`, `motion-preference.tsx`, the `ExampleFinding` type from `lib/marketing/industries.ts`) are all live, so it introduces no further orphan chain. |
| `components/finch/site/ProofSequence.tsx` and `components/finch/InvoiceCard.tsx` | `InvoiceCard.tsx` was also imported by the deleted `ScrollSequence.tsx`; with that gone its only remaining importer, `ProofSequence.tsx`, itself has **zero** importers repo-wide (pre-existing dead code, unrelated to this phase) | `tsconfig.json`'s `include` is `**/*.ts`/`**/*.tsx` — `tsc --noEmit` type-checks every file in the tree regardless of whether anything imports it. `ProofSequence.tsx` is present and would fail to compile if `InvoiceCard.tsx` were deleted, even though nothing currently renders `ProofSequence.tsx` itself. Rule (e) ("when in doubt, keep") applied: neither file is in this phase's explicit deletion list, deleting `ProofSequence.tsx` too would be cleaning up pre-existing dead code outside this phase's stated scope, and keeping both costs nothing. |
| `components/finch/pricing/pricing-data.ts` (whole file) | Feeds `WhatsIncluded.tsx`/`PricingHero.tsx`/`StraightAnswers.tsx`, all three already-orphaned (zero importers — `/pricing` itself was deleted in an earlier phase, before this one) | `app/terms/page.tsx` imports its `FOUNDING_TERMS` constant, live and rendered (see Deviations §1). Fixed its one broken dependency (`MARKETING_MODULES`) rather than deleting the file — see Consumer fixes. |
| `components/finch/pricing/{PricingHero,WhatsIncluded,StraightAnswers}.tsx` | Zero importers found repo-wide | Pre-existing dead code from an earlier phase's `/pricing` deletion, not orphaned *by this phase*. Out of this phase's declared scope; flagging for a future cleanup pass rather than acting unilaterally on code this phase didn't touch. |
| `components/finch/AuditBand.tsx`, `FinchNav.tsx`, `FinchFooter.tsx`, `MobileMenu.tsx` | Multiple deleted routes imported these | Rule (c): `FinchNav`/`FinchFooter`/`MobileMenu` explicitly stay even if orphaned in tracked code — confirmed by grepping `components/finch/scan/**` (Josh's untracked free-scan work), which imports `FinchFooter`/`FinchNav` directly (`app/free-scan/page.tsx`). `AuditBand.tsx` additionally has live tracked importers outside anything deleted this phase (e.g. `components/finch/pricing/AuditCta.tsx`'s sibling usage, `app/not-found.tsx`'s pattern) — not touched. |
| `components/finch/ground/{Band,FacetPlane,Glow,OscillatingGrid,WaveField,SeamHairline}.tsx`, `text/MagneticButton.tsx`, `ground/wave-clock.ts` | Several were also imported by now-deleted `FoundingQuote.tsx`/`HomeHero.tsx`/`PlatformShowcase.tsx`/`compare/CooHero.tsx` | Rule (b): all have live importers under `app/orbit/**`/`components/orbit/**` and/or `app/design/DesignSink.tsx` (Phase 5 scope, rule d). Confirmed by grep before touching anything — none were deleted. |
| `components/finch/CyclingFinding.tsx`, `FindingCard.tsx`, `FindingStack.tsx` | `HomeHero.tsx` (deleted) also imported `CyclingFinding`; `WhatFinchWatches.tsx`/`IndustrySections.tsx` (deleted) also imported `agents-data.ts` which `FindingCard.tsx` needs | All three have live importers: `app/design/DesignSink.tsx` (rule d) and/or `app/not-found.tsx` (a real, permanent route). Untouched. |
| `components/finch/agents/AgentVisual.tsx`, `agents-data.ts` | `AgentsOnShift.tsx` (deleted) and `IndustrySections.tsx` (deleted) both imported these | Both are also imported by `lib/marketing/findings.ts` and `components/finch/FindingCard.tsx`, both live and widely used. Untouched. |
| `components/finch/integrations.ts` | `IntegrationsOrbit.tsx`/`IntegrationPrompt.tsx` (deleted) imported it | `lib/marketing/integrations.ts` (live, feeds `/integrations`) imports `INTEGRATIONS` from it directly. Untouched. |
| `components/platform/finch/FinchMark.tsx` (and `FinchBirdMark.tsx`, which it wraps) | `FoundingQuote.tsx` (deleted) imported `FinchBirdMark` | `FinchMark.tsx` is imported by `app/onboarding/layout.tsx` and several `components/platform/**` files — `app/onboarding/**` and `app/app/**` are explicitly off-limits (plan §10). Untouched. |
| `lib/marketing/industries.ts`, `components/finch/site/SiteSection.tsx`, `components/finch/solutions/SolutionBits.tsx` | Each mentions `components/finch/industries/*` in a doc comment | Comment-only references, not imports (verified by reading the exact lines) — nothing to fix here. |

---

## Redirect table as implemented (`next.config.ts`)

All entries below are `permanent: true` (308), matching the file's existing
convention. No source appears twice; no destination is itself a redirect
source (verified — see Verification).

| Source | Destination |
|---|---|
| `/:path*` (host `www.vyso.co.za`) | `https://vyso.co.za/:path*` (unchanged, kept) |
| `/finch` | `/how-it-works` |
| `/platform` | `/how-it-works` |
| `/platform/finch` | `/how-it-works` |
| `/platform/vyso-for-smes` | `/how-it-works` |
| `/platform/vyso-ai` | `/how-it-works` |
| `/apps` | `/how-it-works` |
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
| `/pricing` | `/how-it-works` |
| `/services` | `/operations-audit` (unchanged, kept) |
| `/pricing-faq` | `/faq#pricing` (unchanged, kept) |
| `/roi-calculator` | `/operations-audit/calculator` (unchanged, kept) |
| `/founding-client` | `/operations-audit` |
| `/academy` | `/learn` |
| `/compare` | `/how-it-works` |
| `/compare/finch-vs-hiring-a-coo` | `/how-it-works` |
| `/compare/finch-vs-spreadsheets` | `/how-it-works` |
| `/compare/finch-vs-erp` | `/how-it-works` |
| `/compare/vyso-vs-erp-systems` | `/how-it-works` |
| `/compare/vyso-vs-spreadsheets` | `/how-it-works` |
| `/solutions/operations-dashboard` | `/solutions/reporting-automation` |
| `/industries/restaurants` | `/industries/hospitality` |
| `/industries/catering-companies` | `/industries/hospitality` |
| `/industries/farms` | `/industries/food-suppliers` |
| `/industries/security-companies` | `/industries` |
| `/industries/insurance-brokers` | `/industries` |
| `/insights` | `/learn` |

`/orbit/**`, `/login`, `/app/**`, `/api/**` carry no redirect and are
unaffected, per plan §11's acceptance criterion.

---

## Verification

- **`npx tsc --noEmit`**: 29 errors, byte-identical to every prior phase's
  documented baseline (all in `components/finch/scan/**` and
  `tests/free-scan-content.test.ts`, Josh's untracked free-scan work). Zero
  errors in any file this phase touched or deleted. One real regression was
  caught and fixed mid-session — see "Kept despite orphaned" §1
  (`FindingDeck.tsx`). A second false alarm (9 `Cannot find module
  '../../app/<deleted-route>/page.js'` errors from a stale
  `.next/types/validator.ts` build artifact) cleared on its own once the dev
  server recompiled after a couple of requests; confirmed not a real error by
  deleting the stale file and re-running `tsc`, which returned to exactly 29.
- **`npx eslint`** on every touched file (`next.config.ts`, `app/sitemap.ts`,
  `lib/marketing/{llms,solutions}.ts`, `components/finch/pricing/pricing-data.ts`):
  clean, zero output. Also ran `npx eslint app components lib` repo-wide as a
  belt-and-braces check: 46 errors / 13 warnings, **all** in `app/app/**`,
  `app/api/**`, `components/platform/**`, `lib/platform/**` and
  `lib/posthog-server.ts` — every one pre-existing and off-limits per plan §10
  (product code, API routes, Josh's untracked file). Zero in any path this
  phase touched.
- **`npm run test`**: 1118 tests, 0 failures.
- **`/sitemap.xml`**: 76 URLs (down from Phase 3's 94, minus the 5 stale
  industry entries and `/solutions/operations-dashboard` Phase 3 had already
  dropped from the *content* — wait, corrected: Phase 3 reported 94 with those
  6 already removed from the list; this phase's further drop to 76 comes from
  removing `/finch` (1), `/platform/modules` + 10 module slugs (11),
  `/founding-client` (1), `/academy` (1), `/compare` + 3 sub-pages (4) = 18
  fewer URLs, 94 − 18 = 76, matching exactly). Grepped every `<loc>` for
  `/finch`, `/platform`, `/founding-client`, `/academy`, `/compare`,
  the 5 removed industry slugs, and `/solutions/operations-dashboard`: the
  only two matches were `/orbit/compare/orbit-vs-job-management-apps` and
  `/orbit/compare/orbit-vs-spreadsheets` — Orbit's own, unrelated, untouched
  URLs. Zero deleted or redirect-source URLs remain.
- **`/llms.txt` and `/llms-full.txt`**: both `200`. Read both in full: the
  page index no longer lists `/finch`, the compare hub/pages, `/platform/modules`
  (or any module), `/academy`, or the founding page; the "## Modules",
  "## Compare" and "## Founding client" sections are gone from
  `/llms-full.txt`. The only remaining "Finch"/"Doc-U"/"OrderFlow"/"Price Watch"
  mentions are inside the `## Orbit` section, describing Orbit's own shared
  backend (`lib/orbit/*` data, out of this phase's scope, Orbit untouched) —
  not a violation.
- **Footer/Nav/app-wide link grep**: `components/vyso/Footer.tsx` builds its
  links from data, no hardcoded stale hrefs. Repo-wide grep for
  `href="/(finch|platform|founding-client|academy|compare)` across
  `app/**`/`components/**`/`lib/**` returns exactly one hit outside deleted
  files — `app/terms/page.tsx:88`, a literal `/founding-client` mention in
  legal copy. See Deviations §1.
- **Grep proof — deleted `lib/marketing` files**: zero remaining references
  to `lib/marketing/modules`, `lib/marketing/compare`, `lib/marketing/founding`,
  `module-data`, or `module-types` anywhere in `app/**`/`lib/**`/`components/**`.
  Zero remaining references to `lib/og/comparison`.
- **The 98-URL curl pass** (script and full results below): **100/100 pass**
  (the 97-URL research-file inventory, which already includes `/login`, plus
  the three explicitly-named extras `/finch`, `/how-it-works`, `/insights` —
  97 + 3 = 100). 72 direct `200`s, 28 redirects that land on `200` in exactly
  one hop, zero failures, zero chains. `/orbit/**` (18 URLs) all `200`.
  `/login` untouched, `200` (whatever it already was — not a redirect, not
  edited).

### Verification script

```bash
BASE="http://localhost:3000"
# live_urls.txt: the 97 URLs from `.ai/research/redesign_2026_inspiration.md`'s
# "Live vyso.co.za URLs" section (root through the last Orbit learn article,
# plus /login, which the doc lists separately as "not in sitemap.xml but
# reachable"), one path per line, extracted with:
#   awk '/^## Live homepage snapshot/{exit} /^- `\// {print}' \
#     .ai/research/redesign_2026_inspiration.md | sed -E "s/^- \`//;s/\`.*$//"
# plus /finch, /how-it-works, /insights appended (named explicitly by the task,
# not part of the original 98).

check_one() {
  local path="$1" url="${BASE}${path}"
  local resp1 code1 loc
  resp1=$(curl -s -o /dev/null -D - "$url")
  code1=$(echo "$resp1" | head -1 | awk '{print $2}')
  if [[ "$code1" =~ ^30[1278]$ ]]; then
    loc=$(echo "$resp1" | grep -i '^location:' | sed 's/^[Ll]ocation: //' | tr -d '\r')
    local url2="$loc"; [[ "$loc" == /* ]] && url2="${BASE}${loc}"
    local code2; code2=$(curl -s -o /dev/null -w "%{http_code}" "$url2")
    echo -e "${path}\t${code1}\t${loc}\t${code2}\t$([[ $code2 == 200 ]] && echo OK-REDIRECT || echo FAIL-CHAIN)"
  elif [[ "$code1" == "200" ]]; then
    echo -e "${path}\t${code1}\t-\t-\tOK-200"
  else
    echo -e "${path}\t${code1}\t-\t-\tFAIL-${code1}"
  fi
}
while IFS= read -r path; do [[ -n "$path" ]] && check_one "$path"; done < live_urls.txt
```

### Full result table (100 rows, 0 failures)

| URL | Status 1 | Location | Status 2 | Result |
|---|---|---|---|---|
| `/` | 200 | - | - | OK-200 |
| `/platform` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/platform/vyso-for-smes` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/platform/modules` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/platform/modules/orderflow` | 308 | `/solutions/whatsapp-order-automation` | 200 | OK-REDIRECT |
| `/platform/modules/doc-u` | 308 | `/solutions/document-processing` | 200 | OK-REDIRECT |
| `/platform/modules/procurepulse` | 308 | `/solutions/procurement-automation` | 200 | OK-REDIRECT |
| `/platform/modules/pricepilot` | 308 | `/solutions/reduce-money-leakage` | 200 | OK-REDIRECT |
| `/platform/modules/planwise` | 308 | `/solutions/reporting-automation` | 200 | OK-REDIRECT |
| `/platform/modules/wastewatch` | 308 | `/solutions/reduce-money-leakage` | 200 | OK-REDIRECT |
| `/platform/modules/shiftboard` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/platform/modules/supplysync` | 308 | `/solutions/inventory-automation` | 200 | OK-REDIRECT |
| `/platform/modules/insightgen` | 308 | `/solutions/reporting-automation` | 200 | OK-REDIRECT |
| `/platform/modules/serviceden` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/south-africa` | 200 | - | - | OK-200 |
| `/founding-client` | 308 | `/operations-audit` | 200 | OK-REDIRECT |
| `/pricing` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/contact` | 200 | - | - | OK-200 |
| `/operations-audit` | 200 | - | - | OK-200 |
| `/operations-audit/score` | 200 | - | - | OK-200 |
| `/operations-audit/calculator` | 200 | - | - | OK-200 |
| `/industries` | 200 | - | - | OK-200 |
| `/industries/restaurants` | 308 | `/industries/hospitality` | 200 | OK-REDIRECT |
| `/industries/food-suppliers` | 200 | - | - | OK-200 |
| `/industries/farms` | 308 | `/industries/food-suppliers` | 200 | OK-REDIRECT |
| `/industries/catering-companies` | 308 | `/industries/hospitality` | 200 | OK-REDIRECT |
| `/industries/wholesale` | 200 | - | - | OK-200 |
| `/industries/hospitality` | 200 | - | - | OK-200 |
| `/industries/security-companies` | 308 | `/industries` | 200 | OK-REDIRECT |
| `/industries/insurance-brokers` | 308 | `/industries` | 200 | OK-REDIRECT |
| `/case-studies` | 200 | - | - | OK-200 |
| `/case-studies/turn-n-slice` | 200 | - | - | OK-200 |
| `/about` | 200 | - | - | OK-200 |
| `/academy` | 308 | `/learn` | 200 | OK-REDIRECT |
| `/faq` | 200 | - | - | OK-200 |
| `/integrations` | 200 | - | - | OK-200 |
| `/solutions` | 200 | - | - | OK-200 |
| `/solutions/reduce-money-leakage` | 200 | - | - | OK-200 |
| `/solutions/procurement-automation` | 200 | - | - | OK-200 |
| `/solutions/reporting-automation` | 200 | - | - | OK-200 |
| `/solutions/operations-dashboard` | 308 | `/solutions/reporting-automation` | 200 | OK-REDIRECT |
| `/compare` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/compare/finch-vs-hiring-a-coo` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/compare/finch-vs-spreadsheets` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/compare/finch-vs-erp` | 308 | `/how-it-works` | 200 | OK-REDIRECT |
| `/learn` | 200 | - | - | OK-200 |
| `/learn/why-businesses-lose-money-without-realising-it` | 200 | - | - | OK-200 |
| `/learn/15-signs-your-business-has-operational-chaos` | 200 | - | - | OK-200 |
| `/learn/how-much-time-can-workflow-automation-save` | 200 | - | - | OK-200 |
| `/learn/hidden-cost-of-manual-procurement` | 200 | - | - | OK-200 |
| `/learn/supplier-scorecards-what-to-track-and-why` | 200 | - | - | OK-200 |
| `/learn/why-weekly-reports-are-usually-too-late` | 200 | - | - | OK-200 |
| `/learn/the-real-cost-of-poor-stock-control` | 200 | - | - | OK-200 |
| `/learn/ai-for-small-and-medium-businesses-practical-use-cases` | 200 | - | - | OK-200 |
| `/learn/glossary` | 200 | - | - | OK-200 |
| `/learn/glossary/fractional-coo` | 200 | - | - | OK-200 |
| `/learn/glossary/operations-audit` | 200 | - | - | OK-200 |
| `/learn/glossary/money-leakage` | 200 | - | - | OK-200 |
| `/learn/glossary/gross-margin-vs-markup` | 200 | - | - | OK-200 |
| `/learn/glossary/debtors-ageing` | 200 | - | - | OK-200 |
| `/learn/glossary/delivery-note-reconciliation` | 200 | - | - | OK-200 |
| `/learn/glossary/price-creep` | 200 | - | - | OK-200 |
| `/learn/glossary/stock-cover-days` | 200 | - | - | OK-200 |
| `/learn/glossary/vat-inclusive-pricing` | 200 | - | - | OK-200 |
| `/learn/glossary/popia` | 200 | - | - | OK-200 |
| `/learn/glossary/weekly-brief` | 200 | - | - | OK-200 |
| `/learn/glossary/invoice-line-item` | 200 | - | - | OK-200 |
| `/resources` | 200 | - | - | OK-200 |
| `/resources/operations-audit-checklist` | 200 | - | - | OK-200 |
| `/resources/weekly-operations-report-template` | 200 | - | - | OK-200 |
| `/resources/supplier-scorecard` | 200 | - | - | OK-200 |
| `/orbit` | 200 | - | - | OK-200 |
| `/orbit/how-it-works` | 200 | - | - | OK-200 |
| `/orbit/pricing` | 200 | - | - | OK-200 |
| `/orbit/faq` | 200 | - | - | OK-200 |
| `/orbit/waitlist` | 200 | - | - | OK-200 |
| `/orbit/for` | 200 | - | - | OK-200 |
| `/orbit/compare/orbit-vs-job-management-apps` | 200 | - | - | OK-200 |
| `/orbit/compare/orbit-vs-spreadsheets` | 200 | - | - | OK-200 |
| `/orbit/learn` | 200 | - | - | OK-200 |
| `/orbit/for/plumbers` | 200 | - | - | OK-200 |
| `/orbit/for/electricians` | 200 | - | - | OK-200 |
| `/orbit/for/tilers` | 200 | - | - | OK-200 |
| `/orbit/for/painters` | 200 | - | - | OK-200 |
| `/orbit/for/builders` | 200 | - | - | OK-200 |
| `/orbit/for/handymen` | 200 | - | - | OK-200 |
| `/orbit/for/carpenters` | 200 | - | - | OK-200 |
| `/orbit/for/roofers` | 200 | - | - | OK-200 |
| `/orbit/for/solar-installers` | 200 | - | - | OK-200 |
| `/orbit/for/landscapers` | 200 | - | - | OK-200 |
| `/orbit/learn/how-to-track-jobs-on-whatsapp` | 200 | - | - | OK-200 |
| `/orbit/learn/invoice-from-whatsapp-south-african-invoice-requirements` | 200 | - | - | OK-200 |
| `/orbit/learn/why-tradespeople-lose-money-between-the-job-and-the-bank` | 200 | - | - | OK-200 |
| `/privacy` | 200 | - | - | OK-200 |
| `/terms` | 200 | - | - | OK-200 |
| `/popia` | 200 | - | - | OK-200 |
| `/login` | 200 | - | - | OK-200 |
| `/how-it-works` | 200 | - | - | OK-200 |
| `/insights` | 308 | `/learn` | 200 | OK-REDIRECT |
| `/finch` | 308 | `/how-it-works` | 200 | OK-REDIRECT |

---

## Deviations

1. **`app/terms/page.tsx` still literally links `/founding-client`** ("on
   `/founding-client` at the time they signed up", section "4. Founding
   client terms"). This is the same violation Phase 3 flagged and explicitly
   left alone, per that page's own header comment: `robots: noindex`, a
   `DRAFT · UNDER LEGAL REVIEW` chip, and "do not remove either without
   [Josh's or counsel's] approval." This phase's task scope named
   Footer/Nav/`app/**` link repointing as in-scope, but did not name legal
   copy specifically, and the strong in-file directive plus the precedent set
   by every prior phase's own "legal text untouched" decision made touching
   rendered legal prose the higher-risk call. **Not fixed**: the link is not
   *broken* — `/founding-client` now 301s to `/operations-audit` in one hop
   (verified in the table above), so a reader who clicks it lands somewhere
   real, just not the page the sentence describes. This is a content
   accuracy issue, not a technical one, and still needs the legal
   sign-off decision Phase 3 already flagged. `components/finch/pricing/pricing-data.ts`'s
   `FOUNDING_TERMS` constant (which this same paragraph reads) was kept alive
   for exactly this reason — see Consumer fixes.
2. **`components/finch/pricing/{PricingHero,WhatsIncluded,StraightAnswers}.tsx`**
   remain in the tree, fully orphaned (zero importers), because they were
   orphaned by an earlier phase's `/pricing` deletion, not by this one. Left
   untouched per the "grep before every deletion, only delete what this
   phase's own changes orphaned" discipline — flagging for a future cleanup
   pass rather than acting unilaterally on code outside this phase's stated
   scope.
3. **`components/finch/site/ProofSequence.tsx`** is likewise pre-existing dead
   code (zero importers) that this phase did not create and is not deleting,
   but it does force `components/finch/InvoiceCard.tsx` to stay alive (see
   "Kept despite orphaned" table) since `tsconfig.json` type-checks every
   file in the tree regardless of reachability. Flagging the coupling in case
   a future pass wants to delete both together.
4. **Did not run `npm run build`.** The task's verify list names `npx eslint`
   and `npx tsc --noEmit` explicitly, plus the dev-server curl pass; a
   production build writes into the same `.next/` directory the shared dev
   server (reused per the task's own instruction) is actively serving from,
   and risks destabilizing it for whoever uses it next (Phase 5, or Josh).
   `tsc --noEmit` + `eslint` + the live 100-URL dev-server pass together give
   strong compile-time and runtime coverage of everything this phase touched;
   `npm run build`'s additional value (route-manifest/static-generation
   checks) is comparatively small measured against the shared-server risk.
5. **Dev server not restarted or killed.** Left running on port 3000 for
   Phase 5 or Josh's own review, matching the pattern every prior phase in
   this series used.

## What Phase 5 needs to know

- The `/terms` "Founding client terms" section (Deviations §1) still needs a
  decision from Josh/counsel: rewrite, delete along with the rest of the
  founding-client content, or leave until formal legal review. It is the one
  place `founding-client` survives as visible copy anywhere on the site.
- `components/finch/pricing/{PricingHero,WhatsIncluded,StraightAnswers}.tsx`
  and `components/finch/site/ProofSequence.tsx` (+ `InvoiceCard.tsx`, which it
  keeps alive) are confirmed dead code, safe to delete together in a future
  pass once someone wants to spend the diff on it — not blocking anything.
- Every other Finch-era component this phase found while sweeping — anything
  reachable from `app/operations-audit/{calculator,score}` or `app/design` —
  was deliberately left alone per plan §10 rule (d); Phase 5 restyles those
  and will do its own accounting of what's still `--fn-*`-themed underneath.
