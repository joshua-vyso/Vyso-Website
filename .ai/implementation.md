# Price Watch Agent — implementation log

## Step 0 — Gate check (run 2026-08-13, read-only, service key)

Org: Turn 'n Slice `a24f858b-b40b-4824-bc29-8818f034d44b`.
Sample: 20 most recent invoice/statement documents → 439 line items (invoice sample),
plus a statement-only deep pass → 491 statement lines.

### Structured-field quality (all sampled lines)

| Field | Coverage | Note |
|---|---|---|
| description | 100% | clean produce names ("Tomatoes Saladette", "Onions Brown") |
| unit_price | 100% parseable, >0 | |
| quantity | ~99.8% parseable, >0 | |
| amount | ~99.8% | 1 zero/negative line |
| weight (pack kg) | 99.6% of statement lines | enables per-kg normalisation: unit_price ÷ weight |
| unit string | 7.3% overall / 5.1% of statement lines | absent on legacy statements — NOT a blocker, `weight` covers it |

### The blocker: the 2026-06-25 legacy statement backlog

16 of 17 statements (~430 lines — the bulk of all history) were bulk-uploaded
2026-06-25 09:38–09:48 and have:
- **no `supplier_id`**, no per-line `supplier`, no document-level supplier field →
  lines cannot be attributed to a vendor;
- **no extracted statement-period/date field** → the only date is the shared upload
  timestamp, so all their prices collapse onto one day;
- no `unit`, no `total_kg` — consistent with an older extraction prompt version.

By contrast, everything extracted since (5 Country Mushrooms invoices Jul 14–20 and
the JHB Fresh Produce Market statement of Jul 05) is fully structured: supplier linked,
per-line market agents ("Botha Roodt", "C L De Villiers", …), weight, unit, dates.

### Verdict

**Conditional fail, exactly the case the plan gates on.** Current Doc-U extraction is
good enough for Price Watch going forward, but acceptance criterion 4 (backfill ALL
history) cannot be met from stored JSON: the legacy statements are supplier-less and
date-less. Proceeding on attributed docs only would leave ~2 items × ~5 price points —
too thin for the ≥3-point / 60-day-median rules to ever fire.

**Recommended pre-task (bounded, not a full extraction upgrade):** re-run the CURRENT
Doc-U extractor over the 16 legacy statements (all status `extracted`, none reviewed,
originals in `storage_path` — no human work is destroyed), confirm supplier + statement
date + weight land, then backfill per plan. Requires Josh's approval; also confirm the
extractor emits a statement date (none of the sampled statements had a date field —
verify on the Jul 05 one too, which only showed created_at).

Decisions D1–D4 resolved by Josh 2026-08-13 (see plan). Re-extraction pre-task approved.

## Pre-task — legacy statement re-extraction

### Phase 1: pilot (doc 2e21f9c7, run 2026-08-13) — PASS

- Reused the app's own path: `extractDocument()` (`claude-haiku-4-5`, matches prod) +
  `resolveSupplierProfile()`; storage bucket `documents`. No repo changes; scripts in
  scratchpad; full 16-doc backup at
  `scratchpad/backup-legacy-statements.json` (rollback source).
- Recovered: per-line supplier 28/28 (was 0), unit 28/28, total_kg 28/28;
  `supplier_id` linked to existing "Johannesburg Fresh Produce Market" row;
  confidence 92→94.
- Bonus fix: old extraction contained 14 exact-duplicate lines (sum R214,860 vs the
  statement's own R150,700). New extraction reconciles to the cent. Legacy extractions
  over-count purchases — relevant beyond Price Watch.
- **Premise correction**: statement dates were never missing — `summary.statement_date`
  exists on 15/16 legacy docs (only edda8e8f is null). Backfill uses
  `summary.statement_date` for statements, extracted invoice-date field for invoices,
  `created_at` as last resort.
- Note: `ensureSupplySyncProfile` no-ops in prod (ss_supplier_profiles table absent) —
  SupplySync tables are not deployed for TnS. Irrelevant to Price Watch (D4 coexist).

### New issues surfaced

1. **Truncated per-line names** (~15–19 chars: "Botha Roodt & Ki", "R S A Market Ag",
   some descriptions). Extraction prompt already asks for de-truncation; the model
   doesn't comply. Handling: Price Watch normalisation will alias names
   deterministically by prefix-merge (≥12-char prefix match) — no Doc-U prompt change
   in this plan's scope. Architect decision, testable, logged here.
2. **Two legacy docs are status `reviewed`** (edda8e8f, b1186349) — human-signed-off.
   Excluded from the batch; separate decision from Josh required (their old data
   carries the duplicate-line over-count).
3. **Market-agent granularity**: per-line supplier (market agent) pricing differs per
   agent; keying price series only on the document supplier (JHB market) mixes agents
   and could cause false moves. Decision put to Josh: nullable `line_supplier` column
   on pw_price_points vs document-supplier-only v1.

### Phase 2: batch of 13 `extracted`-status docs — running (same procedure,
per-doc reconciliation check, auto-restore from backup on regression).

# UI Brief reskin — implementation log (branch feat/ui-brief-reskin)

- W0 `5505f4b`: design bundle imported to `.ai/design/vyso-brief/` + plans committed.
- W1 `e9979f4`: `--pf-*`/`--tone-*` token layer added to globals.css; /app shell
  wash + text de-hardcoded. `lib/platform/tokens.ts` already matched tokens
  value-for-value (design system was extracted from this codebase) — no sync needed.
  Flag: `VYSO` export in tokens.ts has zero consumers (dead export, untouched).
- W2 `a32cc60`: primitives tokenized (module-ui.tsx, ui.tsx). Visual deltas:
  DataTable hairline #F5F9FE→#EEF1F5 (spec correction), ModuleWidgetCard gains card
  shadow + 20px padding, SecondaryAction border snapped to --pf-border-strong,
  donut/ring tracks unified on --pf-border-soft. W2 agent was killed mid-run by a
  usage limit and resumed from transcript — partial edits reconciled, no loss.
- W3 descoped to login-only after hex inventory (see plan). Mass hex→var conversion
  skipped: values already on-palette; churn without visual change.
- Known pre-existing failures (NOT ours): tsc errors in lib/platform/whatsapp-ingest.ts
  (untracked WIP), lint errors in vyso-ai/*, wastewatch/*, module-ui.tsx:289.
- W3 `9d57e54`: login restyled to platform blue (the reskin's biggest visible
  change). Panel kept edge-to-edge (no card radius — architect-accepted deviation).
- W4 verification: node tests 0 fail; tsc/lint clean for all touched files
  (pre-existing failures unchanged); login visually verified in browser —
  Log in button computes to rgb(31,95,168) = --pf-accent-strong; marketing home
  provably unaffected (globals.css had zero --pf-/--tone- vars pre-W1 and no
  marketing component references them; shader hero renders normally).
  NOT visually verified: /app/* module screens (behind auth — Josh should eyeball
  a Doc-U + OrderFlow screen after login; changes there are token-value swaps
  plus three deliberate deltas: DataTable hairline, ModuleWidgetCard shadow/padding,
  SecondaryAction border).

# The Brief landing page (branch feat/ui-brief-reskin)

- `7957c8f` plan; `da882ef` Wave A: /app renders the Brief (was a redirect) —
  rail, greeting, finding cards off agent_findings (RLS reads), dismiss/restore,
  truthful evidence nouns, empty + table-missing states, POST_LOGIN_ROUTE → /app.
  Migration file committed. isMissingRelation added to db-errors (42P01 + PGRST205).
- `d194727` Wave B: chat pill wired to Finch ('brief' module via the documented
  extension point; findings serialised server-side, bounded prelude on first user
  turn; tap-a-finding prefill; inert when FINCH_ENABLED off). Live-tested signed-in:
  three streamed answers, 200s. NOT yet exercised with real finding rows (table
  empty until Price Watch runs) — tap flow verified at unit level.
- Deviations from mock (deliberate): top bar retained (rail lives inside the page);
  per-finding action buttons (draft email, trends) deferred; chat is text-only v1.
- Discovery: agent_findings table already existed in prod → Josh applied the
  migration. Remaining manual step for data: the three phase2 re-extraction slices,
  then backfill → detection → crons.

## Price Watch build (branch feat/ui-brief-reskin)

- pw(1) `7ef9beb`: normalize + detect, 34 tests. pw(2): match + observe, 36 tests
  (5.x models get no temperature param). pw(3): run.ts orchestrator + cron route +
  digest route + backfill CLI + 28 tests — 141/141 total.
- Key behaviours: matcher called once per (supplier, raw_description) ever (review
  rows are cached decisions); in-run proposed items cannot auto-link (no stacked
  guesses); dry-run writes nothing and skips the observe model; digest sends
  nothing on zero findings and has no default recipient; dedupe key carries the
  market agent and is parsed back for open-finding suppression; statement guard
  skips statements covered by invoices within 31 days.
- Env needed in Vercel: PRICE_WATCH_ORG_IDS (TnS org id), PRICE_WATCH_DIGEST_TO
  (Josh + Roberto), CRON_SECRET (exists), RESEND_API_KEY (exists).
- vercel.json: price-watch 45 3 * * *, digest 0 4 * * 1 — LEFT UNCOMMITTED
  (file carries unrelated whatsapp-cron WIP; Josh commits both together).
- BLOCKERS for first findings: (1) Josh re-runs the phase2 slices — DB confirmed
  the earlier attempt never landed; (2) re-paste supabase/agents-price-watch.sql —
  live DB has the pre-amendment schema, pw_price_points.line_supplier is MISSING
  and every point write fails until then (deliberately no degraded path: mixing
  agents would manufacture false findings); (3) backfill dry-run → live → Josh
  clears the item-match review queue; (4) env vars above.

## Backfill diagnosis (2026-08-14) — 6 of 7 findings are artifacts

- Root causes: (1) sub-pack lines — extraction stores per-BOX price against per-PUNNET
  weight (contract in anthropic.ts says "do NOT multiply by units_per_box" — right for
  loose boxes, wrong for punnet boxes); (2) units_per_box polysemy — pack multiplier on
  punnet lines, fruit COUNT CODE on cartons (apples 18.5kg/135ct); (3) 54/381 points
  (14%) are duplicates: same purchase on two same-day statements + one double-uploaded
  invoice; (4) statements are DAILY, not monthly — STATEMENT_PERIOD_DAYS=31 guard ~30x
  too wide. Verdicts: Musk Melons PLAUSIBLE; Saladette = different SKU compared to
  loose (R857/kg printed, R42.86 real); Baby Sweet Corn Wenpro is SIGN-INVERTED (real
  move was -20%); Peppers + Lemons findings vanish entirely on dedupe.
- Experimentally proven: blind units_per_box correction is WORSE than none (new R1.8m
  broccoli artifact) — mis-scaled-but-CONSISTENT series keep honest percentages
  (scale cancels in deltaPct and randImpact); inconsistent series are what explode.
  Hence the series-consistency gate is load-bearing in the fix.
- SECOND root cause: neither Claude call (match/observe) has EVER succeeded — both use
  `await import('@/lib/ai/anthropic')` which fails under node and tsx CLIs ('@/' alias
  + server-only). Silently absorbed by the designed fallbacks (review queue / template
  observations). Writer proven fine via one real validated call. Fix: dependency-inject
  model calls from callers; loud warning on zero successful calls.
- Remediation in flight: full fix spec to the assembly agent; then wipe pw_price_points
  + the 7 agent_findings (KEEP pw_items + 112 confirmed matches — sound and free to
  reuse) and re-run. Expected: ~263 points, 1-2 findings. MIN_ANNUALISE_SPAN_DAYS 7→14
  (architect decision: honesty floor without muting v1 entirely).

## pw(5) — normalization basis seam + fix completion (2026-08-14, resumed)

Completed the seam the assembly agent died mid-write on twice
(`.ai/plan_pw_fix_completion.md`).

- `run.ts:964` (was `:950`) now calls `normalizeLine(...)` instead of the removed
  `normalizeLineUnitPrice` — the tsc TS2304 error and the 3 failing tests
  (`runPriceWatch dry run: …`, tests 96–98) are fixed. `result.rejection ===
  'sub_pack_unresolvable'` → `linesSkippedUnnormalisable += 1`; every other null
  value → `linesSkippedNoPrice += 1`, matching the plan exactly.
- **Found and fixed a gap the plan didn't call out**: `PriceWatchLine` (the
  `documents.extracted_data.line_items` shape run.ts reads) never carried
  `units_per_box`, and the `normalizeLine(...)` call never passed it through —
  so `NormalizationBasis 'sub_pack'` could never fire from real data no matter
  what else was fixed (boxKg is only computed when `units_per_box` is present).
  Added the field to `PriceWatchLine` and threaded `line.units_per_box` into the
  call (`run.ts:82-92`, `:964-976`).
- `basis`/`packsPerBox` now threaded from `normalizeLine`'s result into:
  `PricePointDraft` (write payload — used only in-memory, NOT sent to the DB
  insert, per the plan), the `PwPricePoint` objects built from `drafts` for
  detection input, and `SamplePricePoint` (the backfill's printout). Points read
  back from `pw_price_points` still have no `basis` column by design — they
  collapse to `detect.ts`'s `'unknown'` bucket, unchanged from pre-fix behaviour.
- **Found and fixed a second gap**: `detectPriceFindings(...)` was called
  without its optional third `stats` argument, so `summary.detect` — the
  mixed-basis-suppression counts that are the entire diagnostic value of this
  fix — was always all-zero in the returned summary, silently. Now passed as
  `detectPriceFindings(dedupedPoints, openFindings, summary.detect)`.
- Audited the two remaining fix-spec items (plan step 3) — neither existed yet,
  both implemented:
  - **Content-level dedupe before detection**: keyed on `(pw_item_id,
    line_supplier, invoice_date, unit_price, quantity_base)` — org is implicit
    (one org per run), document/line_index deliberately excluded (that's
    exactly what's duplicated). Runs over the merged stored+draft point map,
    first occurrence wins (stored history before this run's own points), and
    only affects what `detectPriceFindings` sees — NOT what gets written to
    `pw_price_points` (every line still gets its own row; two documents
    describing one purchase is a detection-input problem, not a write
    problem). `summary.pointsDeduped` counts the collapsed points.
  - **Zero-successful-model-calls warning**: `summary.modelOutage` is true
    when `matchModelCalls + observeModelCalls > 0` and every one of them
    failed (`matchModelFailures` + `observeModelFailures` — added the actual
    increments too; both fields existed in the interface but were never
    written). Pushes a specific warning naming the 2026-08-14 root cause.
    Deliberately **not** gated on `dryRun`: the matcher is called for real
    even on a dry run (only the DB write of its result and the separate
    observe call are skipped), and the 2026-08-14 outage was first hidden
    behind exactly a dry run — a `!dryRun` guard would have re-hidden it.
- Gates: `npx tsc --noEmit` clean except the pre-existing exempt
  `lib/platform/whatsapp-ingest.ts` errors (3, unchanged). `npm run lint`: 85
  pre-existing problems (53 errors/32 warnings), all in exempt files
  (vyso-ai/*, wastewatch/*, module-ui.tsx, plus unrelated whatsapp/component
  files already failing before this change) — zero in any price-watch or
  `lib/ai/anthropic.ts`/`price-watch-model.ts` file. `npm run test`: 148/148
  (145 pre-existing + 3 added for the seam: `sub_pack_unresolvable` → counter,
  content dedupe → `seriesBelowPointFloor`, total match-outage → warning).
- No deviations from the plan's ordered steps; the two "found and fixed" items
  above are additions the plan's own wording anticipated ("Verify how drafts
  flow into the detect call and thread accordingly"; "ensure output is
  truthful") rather than departures from it.

## Chat-first shell (W1–W5, branch feat/ui-brief-reskin)

Plan: `.ai/plan_chat_first_shell.md`. Replaces TopBar/ModulesOverlay as the
`/app/*` navigation with a persistent rail (desktop) / header+drawer (mobile)
and a chat dock whose conversation survives client-side navigation.

- W1 `f962932`: motion tokens (`--dur-*`, `--ease-*`, `vyso-pulse`) ported into
  `app/globals.css`; all `components/platform/shell/*` built except
  `GlobalChatDock`/`FinchChatProvider`, rendered nowhere yet — zero visual
  change, tsc/lint green.
- W2 `16206df`: `app/app/layout.tsx` rewritten flex-row with `AppRail` as a
  full-height sibling column outside `TrialGate`/`ModuleLockGuard` (same
  sign-out-stays-reachable guarantee TopBar gave from above `<main>`, now
  given from beside it — plan §8 E1). `BriefRail.tsx` deleted, its usage
  dropped from `app/app/page.tsx`. TopBar still rendered `<lg` only during
  this transitional wave so mobile never broke mid-migration.
- W3 `383e77a`: `MobileTopBar` + `MobileDrawer` replace TopBar below `lg`;
  TopBar unmounted everywhere (file still present, deleted in W5).
- W3.1 `8205e37`: architect-accepted deviation — drawer locked module rows
  now open `ModuleLockNotice` instead of navigating, matching `AppRail`'s
  desktop behaviour (plan §8 E2 conformance gap found during W3 verification).
- W4 `9756e58`: `FinchChatProvider` lifts chat state (`turns`/`streaming`/
  `error`, the SSE reader, and the `onBriefAsk` pub/sub subscription) above
  the whole shell in `app/app/layout.tsx` so it survives navigation;
  `GlobalChatDock` renders it as a bottom-docked pill — full variant on
  `/app` (+ `?view=history`), compact elsewhere, expanding on focus/first
  turn. `page.tsx` stops mounting `BriefChatPill` directly. Architect-accepted
  deviations from the plan's literal geometry sketch, both load-bearing for
  correctness, documented in the components' own docblocks:
  - **Dock-as-sibling geometry**: the dock is a sibling of `<main>` (inside
    the shell's flex column, `position: relative` container), not a child of
    `<main>`. `<main>` is the scroll container; an absolutely-positioned
    child of a scroller lays out against the scrolled padding box, which
    would park the dock at the bottom of the full scrollable document instead
    of pinning it to the viewport-visible bottom edge. Sibling placement
    keeps the plan's intended visual geometry (§4.3) while fixing this.
  - **`DisabledPill` retirement**: the old pill's separate "disabled" render
    branch (shown when `finchEnabled === false`) was retired — `GlobalChatDock`
    now renders nothing at all in that case (plan §8 E6's stated behaviour),
    rather than carrying forward a distinct disabled-but-visible state that
    the plan never asked for.
  - **Transcript Hide control**: the transcript overlay panel gained an
    explicit "Hide" affordance beyond the plan's spec, since it now persists
    across navigation (§8 E8) and can otherwise be stuck open across route
    changes with no way to dismiss it short of a hard reload.
  - **Brief-only bottom padding**: `/app/page.tsx`'s feed column keeps bottom
    padding reserved for the pill (a pre-existing Brief-specific treatment);
    this was NOT extended to other modules per plan §8 E5 ("do NOT add global
    bottom padding to modules — no module edits").
- W5 (this commit): deleted `components/platform/TopBar.tsx`,
  `ModulesOverlay.tsx`, `Sidebar.tsx` — confirmed zero non-comment imports of
  any of the three before deletion (`Sidebar.tsx` had zero references of any
  kind; `TopBar.tsx`/`ModulesOverlay.tsx` had only the comment/docblock
  attribution mentions swept below, plus `TopBar.tsx`'s own now-deleted
  `import { ModulesOverlay } from './ModulesOverlay'`). Kept
  `FeedbackModal.tsx` and `ModuleLockNotice.tsx` — both still mounted by the
  new shell (`UserChipMenu`, `AppRail`/`UnderTheHood`, `MobileDrawer`).
  Comment sweep (behavior-only-safe edits, no logic changes):
  - `app/app/docu/[id]/page.tsx` — the "flex child under the 66px TopBar"
    sizing comment rewritten to describe the current shell (`<main>` is a
    flex-1 child of the layout's column; full height beside `AppRail` on
    desktop, 100dvh minus the 56px `MobileTopBar` below `lg`).
  - `components/platform/TrialGate.tsx` — "TopBar renders above this... so
    sign-out stays reachable" rewritten to name `AppRail` (desktop) and
    `MobileTopBar`+`MobileDrawer` (mobile) as the components now giving that
    guarantee.
  - `components/platform/onboarding/OnboardingSignOut.tsx` — "Mirrors the
    TopBar sign-out idiom" rewritten to "Mirrors the shell's sign-out idiom
    (UserChipMenu / MobileDrawer)".
  - `app/app/layout.tsx` — a W3-era comment noting TopBar.tsx was merely
    unmounted (not yet deleted) updated to state both TopBar.tsx and
    ModulesOverlay.tsx are now deleted.
  - Left untouched (correct as historical attribution, not describing
    currently-live architecture): docblocks in `UserChipMenu.tsx`,
    `AppRail.tsx`, `shell-data.ts`, `MobileDrawer.tsx`, `MobileTopBar.tsx`,
    `RailNav.tsx`, `UnderTheHood.tsx`, `brief-display.ts` that say things
    like "ported from TopBar.tsx verbatim" or "mirrors ModulesOverlay's
    locked-tile branch" — these correctly describe where today's logic came
    from, not a claim that TopBar/ModulesOverlay still exist. Also left
    untouched: `--pf-topbar-h` comments in `app/globals.css` and
    `AppRail.tsx` (already correctly past-tense — "BriefRail.tsx's old
    calc(...) consumer was deleted with the file in W2"), and `--pf-nav-h`
    (plan §7: leave untouched, no consumer changes).
  - Gates: `npx tsc --noEmit` clean except the exempt
    `lib/platform/whatsapp-ingest.ts` (3 pre-existing errors, unchanged).
    `npm run lint`: 84 problems (53 errors/31 warnings), all pre-existing in
    already-exempt files (vyso-ai/*, wastewatch/*, module-ui.tsx, unrelated
    whatsapp/component files) — zero new problems, zero in any file this
    wave touched. `npm run test`: 148/148.

## W6 verification (branch feat/ui-brief-reskin)

### Gates (re-run 2026-08-15, full chained pass)

`npx tsc --noEmit; npm run lint; npm run test`

- `tsc --noEmit`: 3 errors, all in `lib/platform/whatsapp-ingest.ts`
  (pre-existing/exempt WIP: `extractOrderFromText` missing export, an
  implicit-`any` param, an `IngestDocumentInput` shape mismatch). Zero
  errors anywhere else.
- `lint`: 84 problems (53 errors, 31 warnings) — matches the W5 baseline
  exactly. Spread across `vyso-ai/*`, `wastewatch/*`, `module-ui.tsx`,
  `.ai/design/vyso-brief/**` bundle files, and a wide pre-existing set of
  `react-hooks/set-state-in-effect` / `react-hooks/purity` /
  `react-hooks/immutability` findings in orderflow/planwise/procurepulse/
  serviceden/shiftboard/supplysync/docu/finch components — none of it new,
  none of it touched by this task. Confirmed **zero** problems in
  `components/platform/shell/**`, `components/platform/brief/**`,
  `app/app/layout.tsx`, or `app/app/page.tsx` (grepped the lint output for
  those paths directly).
- `test`: 148/148 passing, 0 failed.

All three gates match the expected baseline. Nothing fixed, nothing
unexpected.

### Screenshot inventory (`.ai/verification/shell-w6/`, 10 files)

**Important caveat, found while mapping these to plan §11**: only
`login-1440.png` / `login-390.png` are screenshots of the real, unmodified
`/login` route. The other 8 were captured against a **synthetic harness
page**, not the real authenticated `/app/*` routes — every one of them
carries visible on-page copy reading "W6 harness placeholder — this stands
in for `app/app/page.tsx`'s Brief feed column (finding cards)/a module
screen's own ModuleHeader/SubNav/table chrome, which needs a real
org/session to render." The harness appears to mount the real shell
components (rail, nav, under-the-hood, user-chip menu, mobile drawer,
global chat dock/pill, transcript overlay) around fabricated data (3
"Placeholder finding" cards, a canned "What moved this week?" Q&A instead
of a live Finch SSE stream, a "SupplySync — Suppliers" screen with 3
"Placeholder row" entries standing in for any real module route). No
harness source file exists anywhere in the current working tree
(`grep -r "harness placeholder"` across the whole repo, tracked and
untracked, returns nothing) — it was built and used outside the tracked
codebase, so there's nothing left to clean up, but it also means **no
`/app/*` screenshot here is evidence about the real authenticated app.**
It only confirms the shell components themselves render their intended
layout/active/motion states in isolation.

| Plan §11 item | Screenshot | Real or harness |
|---|---|---|
| `/app` rail active, under-the-hood collapsed (1440) | `brief-rail-active-collapsed-1440.png` | harness |
| `/app` rail active, under-the-hood expanded (1440) | `brief-rail-active-expanded-1440.png` | harness |
| `/app` pill / transcript open (1440) | `brief-transcript-open-1440.png` | harness — canned Q&A, not a real SSE stream |
| `/app` at 390px | `brief-mobile-390.png` | harness |
| `/app?view=history` | — not captured | — |
| `/app/docu` | — not captured | — |
| `/app/orderflow` (compact pill + `FinchLauncher` coexistence) | — not captured; no `FinchLauncher` visible in any screenshot | — |
| `/app/suppliers` (active module row) | `module-compact-pill-active-row-1440.png` (labeled "SupplySync — Suppliers") stands in | harness |
| module screen at 390px | `module-mobile-390.png` (same placeholder screen) | harness |
| `/app/settings` | — not captured | — |
| user-chip menu open (1440) | `user-chip-menu-open-1440.png` | harness |
| mobile drawer open (390) | `mobile-drawer-open-390.png` | harness |
| chat mid-stream on a module screen, navigate, transcript persists | — not captured (needs real cross-route navigation; no single screenshot can show it) | — |
| `/login` (1440, 390) | `login-1440.png`, `login-390.png` | **real** |
| `/onboarding` | — not captured | — |
| marketing home unchanged | — not captured | — |
| reduced-motion spot check | — not performed | — |

### Explicitly UNVERIFIED

- **Marketing home** — no screenshot exists; not visually re-checked this
  wave (W4 already argued it's provably unaffected by construction — see
  above — but that's not a substitute for an eyeball check).
- **Reduced-motion emulation** — not performed.
- **Everything under `/app/*`** — only exercised via the synthetic harness
  described above. No screenshot here comes from a real authenticated
  session, real module chrome, or a real Finch response.
- `/app?view=history`, `/app/settings`, `/onboarding`, `/app/orderflow`,
  `/app/docu` — no screenshot evidence in either direction.

### REMAINING FOR JOSH

- Authenticated at 1280px+: all 13 route groups rendering inside the new
  shell
- Real Finch SSE chat on `/app` and on a module route
- Tap-a-finding on a real `FindingCard`
- Sign-out mid-stream (desktop + mobile)
- Trial-expired org (dock hidden, sign-out reachable)
- E5 dock-vs-sticky-footer on ShiftBoard/OrderFlow
- Reduced motion
- Marketing home unchanged
