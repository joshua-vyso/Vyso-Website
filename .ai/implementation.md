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

## Phase A (demo MVP) — unblock main, agent crons, env (2026-08-17, branch `main`)

Phase A of `.ai/plan_demo_mvp_finch.md`. Local only — **nothing is pushed**;
the two push commands are at the bottom of this section.

### What was done

1. **Serviceden WIP — nothing to preserve.** The three "modified" files
   (`app/api/serviceden/outreach/drafts/route.ts`,
   `components/platform/serviceden/TodayOutreach.tsx`,
   `lib/platform/outreach-drafts.ts`) diffed **empty** against `origin/main`:
   they were PR #25 (`fix/send-time-reply-gate`) content sitting in a working
   tree still on the older `feat/ui-brief-reskin`. Git still refused the branch
   switch (index vs worktree), so they were parked as `stash@{0}`
   ("serviceden-wip") and are now redundant — `main` already has that code.
   (`stash@{1}`, "pre-merge: serviceden local changes", pre-dates this session
   and was left alone.)
2. **WhatsApp WIP quarantined** on local branch `feat/whatsapp-ordering`
   (cut from `origin/main`), commit `a542a23`
   *"wip(whatsapp): ordering lane — does not build yet (extractOrderFromText
   missing)"* — 8 files, 2134 insertions: `app/api/whatsapp/{inbound,process}/route.ts`,
   `lib/platform/whatsapp-{ingest,policy,send}.ts`, `supabase/whatsapp-ingest.sql`,
   `tests/whatsapp.test.ts`, `docs/whatsapp-ordering.md`. Nothing deleted.
   `main`'s working tree is clean of them. `.ai/plan_demo-pricelist-fixes.md`
   and `public/serviceden-logo-concept.svg` deliberately left untracked.
3. **`vercel.json` — plan §2 blocker 2 was wrong.** `origin/main` *already*
   carried the price-watch (03:45 UTC) and digest (Mon 04:00 UTC) crons; they
   landed in `32973a2` (the Finch rebrand) and merged with PR #26. The
   uncommitted local change was the *addition* of a `/api/whatsapp/process`
   cron, part of the WhatsApp WIP. Removing it returned the file to exactly its
   committed state, so `vercel.json` has **no diff and is not in the commit**.
   The agent crons are therefore already deployed to prod as of PR #26 —
   pushing `main` does not "turn them on", it only ships the env docs + plan.
   Both cron targets exist on main: `app/api/agents/price-watch/route.ts`,
   `app/api/agents/digest/route.ts`.
4. **`.env.example`** — appended `PRICE_WATCH_ORG_IDS` (comma-separated org
   uuids; unset ⇒ agents no-op with HTTP 200 `ran: 0`) and
   `PRICE_WATCH_DIGEST_TO` (Monday digest recipients; unset ⇒ digest returns
   503 and sends nothing), in the file's existing comment style.

### Gates (on `main`, after the quarantine)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **clean** (exit 0) |
| `npm run lint` | exit 1 — **90 problems (53 errors, 37 warnings), all pre-existing**; no linted file differs from `origin/main`. Errors concentrate in `components/platform/{wastewatch,vyso-ai,finch,orderflow,docu,supplysync,procurepulse,planwise,shiftboard,serviceden,coredata}`, `components/platform/module-ui.tsx`, `app/app/pricepilot/*`, `app/api/ai/agent/route.ts`, and the vendored `.ai/design/**/support.js`. |
| `npm test` | **128/128 pass**, 0 fail (7 files). Note: the plan's "148/148" included `tests/whatsapp.test.ts` (~20 tests), now on the quarantine branch. |
| `npm run build` | **passes** (exit 0, "Compiled successfully") |

`tsc` initially failed on two stale `.next` route-type validators still naming
the removed WhatsApp routes. These are gitignored build artifacts, not source:
`.next/types/validator.ts` was regenerated by `npm run build` and
`.next/dev/types/validator.ts` (in tsconfig's `include`) by a ~20 s `next dev`
run. Nothing was deleted.

### Commits (local, unpushed)

- `feat/whatsapp-ordering` → `a542a23` (WhatsApp WIP)
- `main` → `972d639` *"agents: deploy price-watch + digest crons; demo MVP plan"*
  — `.env.example`, `.ai/plan_demo_mvp_finch.md`,
  `.ai/design/vyso-brief/Vyso - The Brief.dc.html` (a "Ask Vyso" → "Ask Finch"
  copy fix). The message keeps the wording specified in the Phase A brief even
  though `vercel.json` turned out to need no change — see item 3.

This file is intentionally left **uncommitted** for Josh's review.

### Josh runs (in this order)

```
git push -u origin feat/whatsapp-ordering   # parks the WIP, no deploy
git push origin main                        # deploys prod
```

Then, in Vercel (per plan A4), set `PRICE_WATCH_ORG_IDS` (Meridian:
`01000000-7e5d-4c1a-9b3f-000000000001`) and `PRICE_WATCH_DIGEST_TO`
(`joshua@vyso.co.za`), confirm `CRON_SECRET`, `RESEND_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` are present, redeploy, then trigger each agent once
(both routes are **GET**, bearer-authenticated with `CRON_SECRET`):

```
curl -s -H "Authorization: Bearer $CRON_SECRET" https://vyso.co.za/api/agents/price-watch
curl -s -H "Authorization: Bearer $CRON_SECRET" https://vyso.co.za/api/agents/digest
```

Expected: price-watch `{ok:true, ran:1, summaries:[…]}` (plan A5 predicts 3
Meridian findings; if 0, read the summary counters — do not lower thresholds).
Digest sends only if that org has open findings; no findings ⇒ `{ok:true,
sent:0}` and no email, by design.

## Brief chat v2 — W0 (scroll fix + cheap models)

Implements `.ai/plan_brief_chat_v2.md` §4 W0 only (pre-approved: Josh's direct
"I can't scroll" / "use a cheap model" asks). W1–W6 are untouched, still
awaiting approval.

### Changes

1. **`app/app/layout.tsx`** — the platform shell root `<div>` (the
   `flex h-screen flex-row overflow-hidden …` one, ~line 85) now carries
   `data-platform-shell`, purely as a CSS hook.
2. **`app/globals.css`** — extended the existing `html:has(.finch-site),
   body:has(.finch-site) { overflow-x: clip; overflow-y: visible; }` block
   (~915-924) with a matching `html:has([data-platform-shell]),
   body:has([data-platform-shell])` selector, same declarations. Root cause
   documented inline: the unscoped `html, body { overflow-x: hidden }` at
   ~292-297 (left untouched, per the plan — marketing depends on it) leaves
   `overflow-y` at its default `auto`, making the document a second scroll
   container stacked on `<main class="… overflow-y-auto">` under `/app/*`,
   so wheel/trackpad events could land on either container. `docu/[id]`'s
   pre-existing local scroll workaround is called out and left in place
   (out of scope for this wave).
3. **`lib/ai/anthropic.ts:11`** — `MODEL` default changed from
   `claude-opus-4-8` to `claude-sonnet-4-6`; comment updated to say Opus is
   reachable only via an explicit `ANTHROPIC_MODEL` override.
4. **`.env.example`** — appended a "Model tiers" block documenting
   `ANTHROPIC_AGENT_MODEL`, `ANTHROPIC_WORKFLOW_MODEL`, `ANTHROPIC_MODEL`,
   `ANTHROPIC_EXTRACT_MODEL`, `ANTHROPIC_SUMMARY_MODEL`,
   `ANTHROPIC_CATEGORISE_MODEL`, `ANTHROPIC_MATCH_MODEL`,
   `ANTHROPIC_OBSERVE_MODEL` — each verified against its actual call site
   (`lib/ai/anthropic.ts`, `lib/ai/finch/config.ts`,
   `lib/ai/price-watch-model.ts`) before writing, all unset (comment-only).

### Known gap — NOT fixed this wave (file out of the W0 edit list)

`lib/ai/price-watch-model.ts:36` has its **own** `MODEL` default —
`process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'` — separate from
`lib/ai/anthropic.ts` (see that file's own top-of-file comment on why: it
can't import `lib/ai/anthropic.ts`, which opens with `import 'server-only'`
and throws under the plain-node backfill CLI). §2.7's "no code path may
reference an Opus id as a default after this wave" is therefore **not yet
true everywhere** — Price Watch observation still defaults to Opus. The W0
task's file list didn't include this file, so it was left alone rather than
edited outside scope; flagging here for a follow-up (W1+ or a standalone
one-line fix) since it's the one real gap the closing grep sweep surfaces.
`price-watch-model.ts:68`'s `fable-5` hit is unrelated — it's a regex token
in `SAMPLING_REMOVED` matching model-name patterns that omit `temperature`,
not a default.

### Gates

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean (no output, exit 0) |
| `npm test` | 128/128 pass, 0 fail |
| `npm run build` | passes (exit 0, "Compiled successfully") |
| `npm run lint` | 90 problems (53 errors, 37 warnings) — **identical** to the pre-edit baseline recorded earlier in this file (same count, same file); no new errors introduced |

Static CSS check (no logged-in session available to verify scroll at
runtime): `grep -r "data-platform-shell" .next/static/chunks/*.css` after
`npm run build` finds the selector compiled into
`.next/static/chunks/3j-sf4542txwv.css` as
`html:has([data-platform-shell]),body:has([data-platform-shell]))`
followed by `{overflow:clip visible}`. **Runtime scroll unverified — needs
Josh's session** (`/app/*` requires login this agent doesn't have; no sign-in
was attempted, per instruction).

### Grep sweep — `claude-opus\|claude-fable\|fable-5` (excluding `vyso-agent`)

```
lib/ai/price-watch-model.ts:36:const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';
lib/ai/price-watch-model.ts:68:const SAMPLING_REMOVED = /(opus-4-[78]|opus-5|sonnet-5|fable-5|mythos-5)/;
```

Both in a file outside the W0 edit list (see "Known gap" above); no other
hits anywhere in `lib`, `app`, or `components`.

This section is intentionally left **uncommitted**, same as the rest of this
file, for Josh's review.

### Follow-up closed — `price-watch-model.ts` gap

`lib/ai/price-watch-model.ts:36`'s own `MODEL` default is now
`claude-sonnet-4-6` (commit `a201944`, 128/128 tests + clean `tsc` pass);
§2.7's "no Opus default" now holds everywhere.

### Follow-up closed — cron route + backfill CLI never injected the model transport

The 2026-08-14 remediation built `lib/ai/price-watch-model.ts` (the
alias-free, non-`server-only` transport) and had `match.ts`/`observe.ts` take
it as an injected `matchCall`/`observeCall` with a loud `missingModelCall`
default instead of a silent fallback — but never updated the two real callers
to actually pass it in. `app/api/agents/price-watch/route.ts` called
`runPriceWatch(supabase, orgId, { log })` with no `matchCall`/`observeCall`,
so every model-eligible line hit `missingModelCall`, threw, and landed in the
`pw_item_matches` review queue as `model_error` — in prod, nightly, since the
14th. `scripts/backfill-price-watch.ts` had the identical gap.

Fixed (commit `148a784`):

- `app/api/agents/price-watch/route.ts` and `scripts/backfill-price-watch.ts`
  now import `priceWatchMatchCall`/`priceWatchObservationCall` from
  `lib/ai/price-watch-model.ts` (relative + `.ts`-extension import in the
  script, `@/` alias in the route — each per that file's own existing import
  constraints) and pass them as `matchCall`/`observeCall`.
- `lib/platform/price-watch/match.ts`'s match-call `catch` was bare (`catch
  {}`, swallowing the error entirely) and `observe.ts`'s bound the error but
  never logged it (its `violations` array is never read by any caller) — both
  now `console.error('[price-watch] … model call failed', { …, message })`
  before returning the existing review/fallback outcome. No behaviour change,
  only visibility: Vercel Logs now show WHY a line went to review instead of
  just a `model_error` count.
- `tests/price-watch-run.test.ts` — added one guard test that calls
  `runPriceWatch` with **no** `matchCall`/`observeCall` at all (the exact bug
  shape) and asserts it reproduces the same `matchModelFailures` /
  `modelOutage` / warning as the existing explicit-throw outage test. The
  existing outage test only ever exercised an explicitly-injected throwing
  call, never the omitted-injection path, so it would not have caught this.

Gates: `npx tsc --noEmit` clean · `npm test` 129/129 pass (128 + 1 new) ·
`npm run build` passes. Not pushed — local commit only, per instruction.
§2.7's "no Opus default" now holds everywhere.

## pw(7) — pw_price_points write payload + prod observation-failure diagnosis (2026-08-17)

Triggered by the deployed cron run against the Meridian org:
`pricePointsUpserted: 0, pricePointErrors: 49`, warning `pw_price_points upsert
failed: Could not find the 'basis' column of 'pw_price_points' in the schema
cache`; and `observeModelCalls: 3, observeModelFailures: 3,
observationFallbacks: 3, modelOutage: true` (findings written with template
text). `matchModelCalls: 0` — all descriptions cached, so the match transport
was not exercised at all in that run.

### 1. `pw_price_points` upsert — FIXED

Root cause: `pw(5)` threaded `basis`/`packsPerBox` onto `PricePointDraft` for
detect.ts's series-consistency gate (correctly — `pw_price_points` has no such
columns by design, `detect.ts:153`), and the draft's own doc comment says so.
But the write loop passed the draft object **straight** to
`.from('pw_price_points').upsert(batch, …)`, so PostgREST received `basis` and
`packsPerBox` as if they were columns and rejected every batch. The comment was
right; nothing enforced it. All 49 points were lost on that run — findings were
still detected off the stored history, which is why the failure was a warning
rather than a crash.

Fix (`lib/platform/price-watch/run.ts`):

- Added `PRICE_POINT_COLUMNS` (the 9 insertable columns, derived by hand from
  `supabase/agents-price-watch.sql` — the `create table pw_price_points` block
  plus its `alter table … add column if not exists line_supplier` upgrade line;
  `id` and `created_at` omitted, both have defaults) and `toPricePointRow()`,
  an explicit draft→row mapper with a why-comment naming this incident.
- The write loop is now `.upsert(batch.map(toPricePointRow), …)`. Drafts keep
  `basis`/`packsPerBox` unchanged for detection; anything added to
  `PricePointDraft` from here on is in-memory by default and reaches the table
  only by being added to `PRICE_POINT_COLUMNS` *and* the DDL.
- No migration. The design intent (no `basis` column) is confirmed by
  `.ai/plan_pw_fix_completion.md` step 2, `detect.ts:153`, and pw(5) above.

- `tests/price-watch-run.test.ts` — new test
  `runPriceWatch: upserted pw_price_points rows carry EXACTLY the DDL columns`,
  with a `recordingStub` (accepts writes, captures each upsert payload) and a
  hand-derived expected column list commented back to the SQL file. Verified to
  FAIL against the pre-fix write loop (`+ 'basis'`) and pass after.

### 2. Observation-call failure — NOT a bug in `lib/ai/price-watch-model.ts`

`lib/ai/price-watch-model.ts` is correct and was left **unchanged**. Reproduced
locally against the real API with the module's real defaults:

- `priceWatchObservationCall` / `priceWatchMatchCall` with `'Say OK.'` — both
  succeed on the repo default `claude-sonnet-4-6` **and** on
  `claude-opus-4-8` (the value `ANTHROPIC_MODEL` actually carries locally, which
  `OBSERVE_MODEL` inherits). Model id is not rejected; `SAMPLING_REMOVED`
  correctly strips `temperature` for `opus-4-8`, so no sampling 400 either.
- The full `generateObservation(facts, priceWatchObservationCall)` path returns
  `source: 'model'`, `violations: []` on both model ids — real prompt, real
  number-fidelity validator, no fallback.

The actual cause is a **deploy-ordering artefact, already fixed**. The cron
fires at 03:45 UTC; the commit that injects the transport into the route
(`148a784`) landed at 17:30 local **the same day**. The commit deployed at cron
time was `2d0c160`, whose route still called
`runPriceWatch(supabase, orgId, { log })` with no `observeCall` — so
`generateObservation` fell through to `missingModelCall`, which throws by
design. That produces exactly the observed shape: 3 observe calls, 3 failures,
3 template fallbacks, `modelOutage: true`, findings written with template text —
and `matchModelCalls: 0` because every description was cached, which is the only
reason the match half of the same gap did not also show. Nothing further to fix;
the next cron run on `148a784` should produce model-authored observations.

Flagged for Josh, NOT changed: `OBSERVE_MODEL` falls back to `MODEL`, i.e. the
generic `ANTHROPIC_MODEL` env var. With `ANTHROPIC_MODEL=claude-opus-4-8` set
(as it is in `.env.local`, and presumably on Vercel), the observation tier runs
on **Opus** in production — which defeats the intent of `a201944` ("observation
tier defaults to Sonnet, not Opus") and the plan_brief_chat_v2 §2.7 no-Opus
rule. The code default is Sonnet; the env override silently promotes it. Fixing
that means giving `OBSERVE_MODEL` its own default rather than inheriting
`MODEL`, which is a behaviour change outside this scoped fix — Josh's call.

Gates: `npx tsc --noEmit` clean · `npm test` 130/130 (129 + 1 new) ·
`npm run build` passes. Not pushed — local commit only, per instruction.

---

## `/app` scroll dead under wheel/trackpad — Lenis was eating the event (2026-08-17)

**Cause: `SmoothScroll` (Lenis) is mounted by the ROOT layout, so it ran on
`/app/*` too, where the document is not the scroller.**

Evidence chain:

- `app/layout.tsx:258` mounts `<SmoothScroll />` in the root layout — above
  BOTH the marketing site and the platform. Nothing gated it by route.
- `components/finch/SmoothScroll.tsx:146` constructs `new Lenis(SNAPPY)` with no
  `wrapper`/`content`. Those default to `window` and `document.documentElement`
  (`node_modules/lenis/dist/lenis.mjs:434`), so Lenis drives the DOCUMENT
  scroll.
- `SNAPPY` sets `smoothWheel: true` (`SmoothScroll.tsx:72`). On every wheel
  event Lenis walks the composed path for an opt-out and, finding none, calls
  `event.preventDefault()` and re-applies the delta to the document
  (`lenis.mjs:606-628`).
- `allowNestedScroll` also defaults to **`false`** (`lenis.mjs:434`) — the
  library does not auto-detect a nested scroller; you must mark it.
- Under `/app/*` the shell root is `flex h-screen … overflow-hidden`
  (`app/app/layout.tsx:85`) and the real scroller is
  `<main class="min-h-0 min-w-0 flex-1 overflow-y-auto">` (`:127-130`). The
  document there has nothing to scroll, so Lenis swallowed the wheel event and
  animated a scroll of zero pixels — and because `preventDefault()` had already
  run, `<main>` never received the native scroll either.

That matches the report exactly, including the parts that still worked: this
kills wheel and trackpad only. Keyboard (PageDown/arrows), scrollbar drag and
touch are untouched — `syncTouch: false` (`SmoothScroll.tsx:74`) means Lenis
never intercepts touch at all, which is why it looked "desktop-only".

W0 (`2d0c160`) chased a different theory — html/body as a competing scroll
container — and did not fix it. Its `overflow-y: visible` override
(`app/globals.css:934-938`) is still correct on its own terms and is **kept**.

### Ruled out, with evidence

- **(a) `GlobalChatDock` overlay.** Root wrapper is
  `pointer-events-none absolute inset-x-0 bottom-0 z-20`
  (`components/platform/shell/GlobalChatDock.tsx:96`) — bottom-anchored, height
  is its content, no `fixed inset-0` anywhere in the file. The only
  `pointer-events-auto` children are the transcript panel (`:98`) and the pill
  (`:146`), both bounded. It never covers the viewport.
- **(b) The flex chain.** `<main>`'s height IS bounded:
  `flex h-screen … overflow-hidden` (`:85`) → `relative flex min-w-0 flex-1
  flex-col` (`:112`) → `<main class="min-h-0 min-w-0 flex-1 overflow-y-auto">`
  (`:127`). `min-h-0` is present, so the flex item can shrink below content
  height. No wrapper between `<main>` and the page content sets
  `h-full overflow-hidden`. Geometry was never the problem.
- **(c) A stuck scroll lock.** Every `document.body.style.overflow = 'hidden'`
  in the tree (`MobileDrawer.tsx:80`, `coredata/ui.tsx:93`,
  `orderflow/ui.tsx:94`, `vyso-ai/VysoAIModal.tsx:206`,
  `finch/FinchModal.tsx:212`, `finch/MobileMenu.tsx:83`) saves the previous
  value and restores it in the effect cleanup. None is unconditional, and body
  overflow is irrelevant anyway once the shell root is `overflow-hidden`.
- **(d) Hydration / un-hydrated app.** `npm run build` emits no warnings and no
  errors at all. Ruled out.

### The fix — two locks, deliberately

1. **`components/finch/SmoothScroll.tsx`** — the instance is no longer created
   under `/app/*`. `usePathname()` → `isPlatform = pathname === '/app' ||
   pathname.startsWith('/app/')` (not a bare `startsWith('/app')`, which would
   also catch a future `/apply`), and the effect early-returns on it. The dep
   array takes the **boolean**, not `pathname`, so marketing→marketing
   navigation does not destroy and rebuild the instance and drop momentum
   mid-scroll; only crossing the marketing/platform boundary re-runs it.
2. **`app/app/layout.tsx`** — `<main>` now carries `data-lenis-prevent`. This is
   the belt-and-braces: it makes the wheel event bypass any Lenis that IS
   running (the tail of a marketing→platform client navigation before the effect
   tears down, or a future mount from somewhere else) and reach the native
   scroller. Lenis checks the attribute on the composed path from the event
   target up to `<html>` (`lenis.mjs:606-611`), and `<main>` is on that path for
   everything the platform draws.

`app/layout.tsx`'s mount comment was also corrected — it still claimed Lenis was
"off by default, toggled on `/design`", which stopped being true on 2026-08-16.

### Verified at runtime — and what could not be

Dev server on :3000, headless browser, **no session** (so `/app` itself was
unreachable — it 307s to `/login`, confirmed by curl).

**Proven, on `/` with Lenis live (`document.documentElement.dataset.lenis ===
"on"`, `html.lenis` class present):** dispatching a cancelable `wheel` event
into a synthetic nested `overflow-y:auto` element gave
`defaultPrevented === true` — i.e. Lenis eats the wheel event for a nested
scroller, exactly the `/app` `<main>` situation. The identical element carrying
`data-lenis-prevent` gave `defaultPrevented === false`. That is direct runtime
proof of both the cause and that lock #2 works.

**Also proven:** client-side nav `/` → `/pricing` leaves `data-lenis="on"` and
Lenis still active — the boolean dep does not churn the instance. And `/login`
still runs Lenis over a genuinely scrollable document
(`scrollHeight > innerHeight`, no `[data-platform-shell]`), so the gate has not
over-reached into the auth/marketing routes.

**Could NOT verify at runtime:** the `isPlatform` gate firing on a real `/app/*`
page, and the teardown when navigating marketing→platform — both need a signed-in
session. Lock #2 is the one proven end-to-end, and it alone is sufficient to
restore scrolling even if the gate misbehaved.

### The 3 things Josh should try after deploy

1. **Wheel/trackpad over the Brief's finding cards on `/app`** — the feed list,
   not the page margin. This is the case where the dock overlay sits closest to
   the content, so it also re-tests candidate (a) for free.
2. **Wheel/trackpad over a long OrderFlow table on `/app/orderflow`** — scroll
   the page body, and then, if the table has its own inner scroller, scroll
   inside that too. Nested-inside-nested is the case `data-lenis-prevent` on
   `<main>` covers by being an ancestor of both.
3. **Navigate marketing → platform in ONE session without a reload**: load `/`,
   scroll it (confirm momentum still feels right), then click through to log in
   and land on `/app`, and scroll immediately. This is the only path that
   exercises the teardown, and the one case I could not reproduce locally.

Gates: `npx tsc --noEmit` clean · `npm test` 130/130 · `npm run build` passes
with zero warnings · `npx eslint` 91 problems (53 errors, 38 warnings) —
unchanged from baseline. Not pushed — local commit only, per instruction.

## Brief chat v2 — W1 (persistence)

Implements `.ai/plan_brief_chat_v2.md` §4 W1 in full: schema, data module,
routes, the agent route's persistence tail, and the provider's state. W2–W6
untouched. Nothing user-visible changes except that the Brief dock's
conversation now survives — no navigation, no rail, no dock restyling.

### Files

**Created**

- `supabase/finch-chats.sql` — `finch_chats` + `finch_messages`, idempotent,
  `do $$` prerequisite guards (core schema **and** `agent_findings`, which
  `finding_id` references), three indexes, RLS.
- `lib/platform/finch-chats-shared.ts` — the pure half: `splitChats`
  (14-day recent/archived), `chatTitle` / `CHAT_TITLE_FALLBACK`,
  `stripBriefPrelude`, `RECENT_WINDOW_DAYS`.
- `lib/platform/finch-chats.ts` — `listChats`, `getChat`, `createChat`,
  `appendMessages`, `setChatTitle`, `getChatForOwner`. Re-exports the shared
  module so callers have one import site.
- `lib/ai/finch/chat-title.ts` — `buildTitlePrompt` + `normaliseChatTitle`,
  both pure.
- `app/api/finch/chats/route.ts` (POST), `app/api/finch/chats/[id]/route.ts`
  (GET).
- `tests/finch-chats-archive.test.ts` (16), `tests/finch-chat-title.test.ts`
  (10).

**Modified**

- `app/api/ai/agent/route.ts` — optional `chatId` + `attachments`, ownership
  check, `after()` persistence tail, Haiku title generation.
- `components/platform/shell/FinchChatProvider.tsx` — `activeChatId`,
  `openChat`, `newChat`, `streamTools`; `{tool}` events kept on the turn.

Deliberately NOT touched (another agent is mid-flight on the scroll fix):
`app/layout.tsx`, `app/globals.css`, `app/app/layout.tsx`, the marketing Lenis
components. W1 needs none of them — the layout wiring (`listChats` into the
rail) is W2's job.

### Decisions

1. **RLS is org AND owner scoped.** Every other table here is org-scoped alone,
   because operational data belongs to the business. A chat does not: it is one
   person's half-formed questions. Both policies carry `and user_id =
   auth.uid()`; `org_id` stays on the row (and is still filtered in code) for
   retention/export jobs. `finch_messages` proves ownership by reaching through
   to its parent chat rather than trusting its own denormalised `org_id`.
2. **The prelude is stripped before storage.** `brief-chat.ts` prefixes the open
   findings to the first user turn because `/api/ai/agent` has no context field
   (that file's header explains why). Storing that verbatim would redraw the
   owner's first question with ~5 kB of machine text glued to the front of it on
   every reload. `stripBriefPrelude` splits on `briefChatContext`'s own closing
   marker. The marker is duplicated as a literal (not imported) to keep the pure
   module free of `@/components` imports; if it ever drifts, the failure is one
   stored prelude, not a crash. **This is the alternative to adding a `context`
   or `userText` field to the route body** — the wire contract is unchanged,
   which is what "streaming behaviour otherwise unchanged" is worth most.
3. **Pure logic lives in a second file.** `node --test` cannot load anything
   that reaches `next/headers` (verified: a probe test importing
   `agent-findings.ts` fails at import). So the testable decisions are in
   `finch-chats-shared.ts` and `chat-title.ts`, both import-free of the
   framework, and `finch-chats.ts` re-exports the former. Same split as
   `serviceden-email.ts` / `serviceden-email-data.ts`.
4. **Each data function takes an optional client.** Default is
   `createServerSupabase()` (cookie session). `/api/ai/agent` passes its own
   `resolveUser()` client because that route also accepts an `Authorization:
   Bearer` token from mobile, and only that client is scoped to that caller.
   Same RLS either way.
5. **`after()` is called in the request scope, not inside the stream.** Per
   `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`
   that is the documented place, it runs even when the response ended badly,
   and it is bounded by the route's existing `maxDuration = 60`. The callback
   picks the stream's results up through a promise the stream's `finally`
   resolves on every path — including abort.
6. **Partial turns: user message yes, assistant no.** `outcome.answer` is only
   set after the agentic loop ends on its own terms. An aborted or errored
   stream stores the question and nothing else. The provider still keeps a
   partial answer *on screen* (with its error line beside it) — the asymmetry is
   intentional and commented in both files: a visible fragment is visibly a
   fragment; a stored one reads a week later as the whole of what Finch said.
7. **Titles are rejected, not repaired.** `normaliseChatTitle` strips the
   wrappers the prompt asked against (quotes, trailing stop, `Title:` labels,
   anything after the first line) but returns `null` for anything over six words
   or 60 characters. Null means the chat stays "New chat" and is named on the
   next exchange, which beats putting the first six words of a refusal in the
   rail. `setChatTitle` uses `is('title', null)` so two tabs racing can't
   flicker between two summaries.
8. **Failure to create a chat is not an error the owner sees.** POST answers
   503 when the migration hasn't been applied; the provider leaves
   `activeChatId` null and streams without a `chatId`. The answer arrives, it
   just isn't stored — exactly the behaviour before this wave (plan §5).
9. **404 covers three cases in `getChat`** (no such chat / someone else's / no
   such table) because a distinct 403 would confirm to a stranger that a guessed
   id is real. The agent route is the one exception: it separates
   `tableMissing` so it can keep answering unpersisted instead of 404-ing.

### SQL Josh must paste into Supabase

**`supabase/finch-chats.sql`** — one file, idempotent, safe to re-run. It
raises with a hint if `organisations`/`profiles` or `agent_findings` are absent.
Until it is pasted, everything degrades quietly: the dock answers as it does
today and stores nothing.

### Gates

`npx tsc --noEmit` clean · `npm test` **156/156** (130 baseline + 26 new) ·
`npm run build` passes, `/api/finch/chats` and `/api/finch/chats/[id]` both
registered as dynamic · `npx eslint` **53 errors / 38 warnings — identical to
the pre-wave baseline** (the one error inside `app/api/ai/agent/route.ts`,
`no-assign-module-variable` on its pre-existing `const module`, predates this
wave).

Runtime verification against a live session is W6's job; W1 was verified by the
gates only. Not pushed — local commit only.

## Brief chat v2 — W2 (rail + chat pages + suggestions)

Implements `.ai/plan_brief_chat_v2.md` §4 W2: the rail's chat list, the two
chat routes, the suggestion chips, and the navigation that ties the Brief's
dock to them. W1's persistence becomes visible for the first time. W3–W6
untouched; nothing in `components/finch/*`, `app/layout.tsx`, `app/globals.css`
(no new tokens were needed), `lib/platform/price-watch/*` or `app/api/agents/*`
was edited.

### Files

**Created**

- `lib/platform/finch-suggestions.ts` — pure. `suggestionsFor(...)`,
  `findingTopic`, `findingRef`, `MAX_SUGGESTIONS`. No `@/…` and no framework
  import, so `node --test` can load it directly.
- `lib/platform/finch-suggestions-data.ts` — the reads (`server-only`):
  debtors via `outstandingByCustomer`, a `head:true` count of the last 7 days'
  `documents`, both wrapped so a failure degrades to "nothing to suggest".
- `components/platform/chat/` — `ChatTranscript`, `ChatComposer` (extracted
  from the dock), `MessageBubble` (`UserBubble` + `AssistantMessage`),
  `ToolStatusLine`(`s`), `SuggestionChips`, `ChatView`, `NewChatView`,
  `OlderChats`, `chat-display.ts` (tool phrasing + source links).
- `components/platform/shell/RailChats.tsx` — "New chat" + this user's recent
  conversations.
- `app/app/chat/new/page.tsx`, `app/app/chat/[id]/page.tsx`.
- `tests/finch-suggestions.test.ts` (17).

**Modified**

- `app/app/layout.tsx` — `listChats` alongside `fetchFindings` in one
  `Promise.all`; server-computed `when` labels; `suggestionsForOrg`; both
  passed down (rail + drawer + provider).
- `components/platform/shell/FinchChatProvider.tsx` — `suggestions`,
  `send(text?)`, `adoptChat`, the pending finding id, `router.push` to a new
  chat's screen and one `router.refresh()` per chat.
- `components/platform/shell/GlobalChatDock.tsx` — composer extracted;
  composer-only on `/app/chat/*`; chips above the pill on an empty Brief.
- `components/platform/shell/{RailNav,AppRail,MobileTopBar,MobileDrawer}.tsx`
  — `chats` threaded through; `RailNav` renders `RailChats` under "Today's
  brief" on both surfaces.
- `lib/platform/finch-chats-shared.ts` — `chatTimeLabel` (+ 4 tests in
  `tests/finch-chats-archive.test.ts`).
- `components/platform/brief/brief-chat.ts` — `askBrief(prompt, findingId?)`;
  the prelude now stamps `finding <ref>` on each line.
- `components/platform/brief/FindingCard.tsx` — passes `finding.id`.
- `app/app/page.tsx` — one delimited `W2 · "Older chats"` block (import,
  conditional read, one JSX line).
- `lib/ai/finch/knowledge.ts` — BRIEF gains "Drafting — you write, the owner
  sends" and "Chats, suggestions and attachments". Haiku tier unchanged.

### Decisions

1. **Tapping a finding does NOT create a chat.** The plan reads "tap a card →
   chat created with `finding_id`"; taken literally that means a row per
   curious click, and the rail fills with empty "New chat" entries every time
   someone reads a finding and thinks better of it. Instead the id is held in
   a ref (`pendingFindingRef`) and spent when the owner actually sends — which
   is what plan §2.5 describes anyway ("POST /api/finch/chats first (module +
   findingId **from context**)"). The composer still receives the half-sentence
   so the question stays the owner's.
2. **The chat page prefers provider state, and adopts rather than fetches.**
   `ChatView`'s rule is `activeChatId === chatId → provider turns win`. That is
   what makes "send from the Brief" survive the `router.push` that happens
   mid-stream: the server read legitimately returns an empty transcript at that
   moment (the agent route's `after()` hasn't run), and preferring it would
   blank the answer being watched. On a hard load the provider is empty, so the
   first paint is the server's rows and hydration matches. `adoptChat` hands
   the already-read rows over instead of re-requesting them, and refuses while
   a turn is in flight so navigating between chats can't splice one answer onto
   another's transcript.
3. **Navigation only from `/app` and `/app/chat/new`.** Sending from a module
   screen keeps the conversation in the dock beside the work. W4's bubble makes
   that a designed surface; yanking someone out of OrderFlow mid-task would not
   be.
4. **`router.refresh()` once per chat, not once per turn.** It fires only when
   THIS send created the row. Every later turn moves `updated_at` and nothing
   else, and a refresh re-runs the whole platform layout's server reads. Known
   race, accepted: the refresh can beat `after()`'s title generation, so a
   brand-new row can read "New chat" in the rail until the next load. The row
   appearing is the part that matters.
5. **Evidence pills point at screens, not documents.** Design 1b shows
   per-item pills ("Butternut price history ↗"); no tool emits structured
   references yet (plan §1 non-goals — that is P1.2). `sourceLinksFor` maps the
   tools a turn actually ran onto the modules holding that data, which is a
   smaller promise and a true one. Pills into a LOCKED module are dropped
   rather than drawn — Finch's tools ignore the module gate, so offering a link
   that lands on an upsell screen would be a small betrayal.
6. **Suggestion prompts name a finding by a short ref**, and the prelude was
   changed to stamp the same ref on every line it sends. `findingRef` is one
   function with two callers so the two formats cannot drift; a chip that named
   a finding the model couldn't identify would produce a confident answer about
   the wrong one. Eight hex characters, because the prompt is user-visible —
   it becomes the message bubble they read back.
7. **A fourth input, `canSeeMoney`.** The plan's signature is
   `{findings, overdue, recentDocCount}`; an empty `overdue` is ambiguous
   between "nobody is late" and "you weren't allowed to look", and the
   difference decides whether "Who owes me money?" belongs in the row. Optional,
   defaulting true, so the plan's three-field call still type-checks.
8. **Relative times are computed on the server.** `chatTimeLabel(iso, now)`
   takes its clock as a parameter and the layout resolves it once; `RailChats`
   receives finished strings. A client recomputing "4m" at hydration can
   disagree with the HTML it is hydrating.
9. **Suggestions are split across two modules** for the reason W1 split
   `finch-chats`: `node --test` cannot load anything reaching `next/headers`,
   and the ordering rules are exactly what rots untested.

### Known cost, flagged rather than fixed

`suggestionsForOrg` reaches `outstandingByCustomer`, which loads the org's
invoices, items, payments and credit notes to derive balances the OrderFlow way.
It runs once per SERVER render of the platform layout (hard load or
`router.refresh()`), never on a client navigation, and only for owner/admin.
The plan's instruction was to reuse the existing debtors fn, so it does — but a
dedicated `of_invoices`-only overdue query is the right shape here and should
land before anything else starts asking for these inputs.

### Deferred to later waves (deliberately not built)

Drag-and-drop (W5) — `/app/chat/new` says so in words rather than drawing a
target that would ignore a dropped file. Per-document evidence links and
model-generated follow-up chips (P1.2 tools). Module-aware chats (W4): the
provider still sends `module: 'brief'` everywhere, so every chat created this
wave carries the brief dot in the rail.

### Gates

`npx tsc --noEmit` clean · `npm test` **177/177** (156 baseline + 17
suggestions + 4 `chatTimeLabel`) · `npm run build` passes with `/app/chat/new`
and `/app/chat/[id]` both registered dynamic (ƒ) · `npx eslint` **53 errors /
38 warnings — identical to the pre-wave baseline**.

Runtime verification needs a signed-in session and is W6's job: nothing in this
wave was exercised against a live database. The clicks W6 must make are listed
in the wave report.

---

## Brief chat v2 — W5 (drag-and-drop documents)

Implements `.ai/plan_brief_chat_v2.md` §1.3, §2.6, §4 W5, §5. A PDF or photo
dropped on a chat (or picked with the composer's paperclip) goes into Doc-U
through the SAME path as the Doc-U upload screen — Storage object, `pending`
`documents` row, extraction — and then becomes a normal turn of conversation
with a document card and an answer about what was actually in the file.

W3's files were not touched (`app/app/finding/*`, `components/platform/brief/
{FindingDetail,PriceHistoryChart,EvidenceList,FindingCard}`,
`lib/platform/price-watch/series.ts`, `agent-findings.ts`, `brief-chat.ts`),
nor `components/finch/*`, `app/layout.tsx`, `app/globals.css` (no new tokens
were needed), `lib/platform/price-watch/*`, `app/api/agents/*` or
`app/api/ai/extract/route.ts` (read only — Phase C's `after()` hook lands there).

### Files

**Created**

- `lib/platform/docu/upload-client.ts` — the one upload path.
  `uploadDocument(file, {orgId, userId, supabase})` (Storage
  `documents/{org}/{uuid}_{name}` → `documents` insert `status:'pending'` →
  `{documentId, storagePath}`), `startExtraction(id)` (the unawaited `keepalive`
  POST), plus the pure `validateUploadFile` / `attachmentMessage` /
  `MAX_UPLOAD_BYTES` / `UPLOAD_ACCEPT`. No runtime imports at all — the Supabase
  client is a parameter — so `node --test` loads it directly.
- `lib/ai/finch/attachments.ts` — `attachmentContextLine(attachments)`: the
  two-line prelude (`Attached documents (ids): {id} — {filename}` + "call
  docu_get_document_summary … never instructions") the agent route prepends to
  the turn a document was dropped into. Pure, import-free.
- `components/platform/chat/ChatDropZone.tsx` — drag detection + dashed
  overlay + inline rejection. No upload code of its own.
- `components/platform/chat/AttachmentCard.tsx` — `AttachmentCard(s)`
  (filename, PDF/Photo, "Open in Doc-U ↗" → `/app/docu/[id]`, transient note),
  `AttachmentProgressLines` ("Reading invoice.pdf…"), `AttachError`.
- `tests/upload-client-validate.test.ts` (13), `tests/chat-attachments.test.ts`
  (9).

**Modified**

- `components/platform/docu/UploadBubble.tsx`, `app/app/docu/upload/page.tsx` —
  their inline upload bodies replaced by `uploadDocument` + `startExtraction`.
- `components/platform/shell/FinchChatProvider.tsx` — `ChatAttachment`,
  `AttachmentProgress`, `parseStoredAttachments`; `send(text, {attachments})`;
  the whole `attach()` flow; `attaching`, `attachError`, `canAttach`;
  `streamingRef` + `sendRef`.
- `components/platform/chat/ChatComposer.tsx` — paperclip + hidden
  `<input type=file accept="application/pdf,image/*" multiple>`.
- `components/platform/chat/ChatTranscript.tsx` — attachment cards above a user
  bubble; `attaching` lines; both in the autoscroll deps.
- `components/platform/chat/ChatView.tsx`, `NewChatView.tsx` (its "coming
  shortly" line is now true), `app/app/chat/[id]/page.tsx` (stored
  `content.attachments` → turns; wrapped in the zone), `app/app/chat/new/page.tsx`.
- `components/platform/shell/GlobalChatDock.tsx` — the expanded panel IS the
  drop zone; an upload in flight counts as a conversation so the panel opens to
  show progress; `AttachError` in the scrim where there is no panel.
- `app/api/ai/agent/route.ts` — `attachmentContextLine` prepended to the last
  user turn (`lastUserIndex`), independent of `chatId`.
- `lib/ai/finch/knowledge.ts` — BRIEF: summarise an attachment briefly
  (supplier, date, total, top lines), offer one or two follow-ups, say so
  plainly when a document is empty/errored.

**Follow-up (2026-08-18):** a live reply said "I can't save documents to Doc-U
from here" about a file it had just saved and extracted — stale knowledge, not
a code bug. Added a shared `ATTACHMENT_KNOWLEDGE` block (already saved/
extracted, never say you can't save, no WhatsApp intake on main, the four-part
default reply to an attachment-only turn) spliced into all four module docs
that can receive a chat attachment, and `attachmentContextLine` now says
"Already saved in Doc-U and extracted" so the turn and the system prompt agree.

### Decisions

1. **The chat AWAITS extraction; the Doc-U screens still don't.** Two functions
   rather than one flag: `startExtraction` is fire-and-forget with `keepalive`
   (the upload page navigates on the next line and would otherwise cancel it),
   while the chat calls `/api/ai/extract` itself with a 60 s `AbortController`.
   The waiting is the feature — answering before extraction finishes means
   `docu_get_document_summary` reads a `pending` row and truthfully reports
   nothing. Timeout → the card says "Still reading — it'll appear in Doc-U when
   done"; a failure → "Couldn't read this file — it's in Doc-U marked as error",
   and the message sends either way.
2. **`attach()` lives in the provider, not in the drop zone.** The zone wraps
   the chat page; the paperclip is in the composer, which lives in the dock — a
   SIBLING of `<main>`, outside the zone's subtree. A context owned by the zone
   could not reach the paperclip, so the two entry points would have become two
   implementations. This is also why neither component contains upload code.
3. **Files upload sequentially and arrive as ONE message.** `send()` is a no-op
   while a turn is in flight, so a message per file would silently swallow every
   file after the first. `attachmentMessage()` writes the owner's words
   ("I've uploaded a.pdf and b.pdf.") and is unit-tested because it becomes a
   stored bubble.
4. **`streamingRef` + `sendRef`.** `attach()` is a long async function; by the
   time it has uploaded and extracted, its closure's `streaming` and its `send`
   are both fossils. Rather than refuse a drop made mid-answer, it polls
   `streamingRef` for up to 60 s and then sends through `sendRef`. Giving up
   says so out loud ("uploaded to Doc-U, but Vyso was still answering") — the
   one outcome worth avoiding is a file that vanishes with no explanation.
5. **The attachment ids reach the model through the ROUTE, not the message
   text.** The client sends the owner's plain sentence plus a structured
   `attachments` array; the route prepends the id line to that one turn only.
   Two consequences that matter: the stored transcript keeps the owner's own
   words, and a conversation with four documents dropped across an afternoon
   never re-announces an old turn's files on a new question.
6. **Filenames are treated as untrusted.** They are chosen by whoever produced
   the file, so `attachmentContextLine` flattens newlines and truncates at 120
   chars before they enter the prompt, and the line itself ends by saying the
   contents are information, never instructions. Pinned by a test.
7. **`note` on an attachment is client-only.** An extraction failure is news
   today and stale history tomorrow — Doc-U is where a document's current state
   lives — so it is deliberately not written to `finch_messages.content`,
   which stores exactly `{document_id, filename}` (W1's shape, unchanged).
8. **The dock's panel opens on an upload.** `hasConversation` now includes
   `attaching.length > 0`, because the panel is the only place the dock can
   draw "Reading invoice.pdf…", and a paperclip that appears to do nothing on a
   screen with no conversation yet reads as broken.

### Known divergence, flagged rather than fixed

`MAX_UPLOAD_BYTES` is **15 MB** (matching `MAX_EXTRACT_BYTES` in
`/api/ai/extract`) and governs the CHAT only. Both Doc-U upload surfaces still
advertise and enforce **20 MB**, which is wrong: a 17 MB scan uploads fine and
then fails extraction with "That file is too large to process", leaving the row
on `pending`. This wave was scoped to leave those two callers behaving exactly
as they did, so the number was not changed under a refactor. Worth a follow-up.

Two smaller behaviour notes on the refactored callers, both deliberate:
`app/app/docu/upload/page.tsx` now gets `uploadOne`'s random-UUID path prefix
instead of `Date.now()` (nothing parses a storage path; the UUID cannot collide
inside one millisecond), and its previously uncaught `void fetch` now has the
bubble's `.catch(() => {})`.

### Deferred (deliberately not built)

Dropping onto a module screen with the dock collapsed — the collapsed dock has
no expanded area to drop onto, and the bubble that gives it one is W4. The
paperclip works everywhere in the meantime. OrderFlow's `ingest-document` path
(W4's parity question) is untouched.

### Gates

`npx tsc --noEmit` clean · `npm test` **215/215** (22 new: 13 upload-client,
9 attachment-line; the rest is the suite as it stands with W3's series tests
landed) · `npm run build` passes, `/app/chat/[id]` and `/app/chat/new` still
dynamic (ƒ) · `npx eslint` **53 errors / 38 warnings — identical to baseline**.

Nothing in this wave was exercised against a live database or a real file: the
drop path needs a signed-in session, and that is W6's job. The clicks it must
make are in the wave report.

---

## Brief chat v2 — W3 (finding detail)

Implements `.ai/plan_brief_chat_v2.md` §1 item 1, §3, §4 W3 and §5: the
`/app/finding/[id]` route, the real price history behind a Price Watch finding,
and the two chat buttons that turn a finding into a conversation. Nothing in
W5's files (`ChatDropZone`, `ChatComposer`, `UploadBubble`, `FinchChatProvider`,
`app/api/ai/agent/route.ts`, `docu/upload/page.tsx`), `components/finch/*`,
`app/layout.tsx`, `app/globals.css`, `lib/platform/price-watch/{normalize,match,
detect,observe,run}.ts` or `app/api/agents/*` was edited.

### Files

**Created**

- `lib/platform/price-watch/series.ts` — `seriesForFinding(db, orgId, finding,
  now?)` plus the pure `shapeSeries(rows, now)`. Relative `.ts` imports and a
  TYPE-only `SupabaseClient`, so `node --test` loads it directly.
- `app/app/finding/[id]/page.tsx` — the server route.
- `components/platform/brief/FindingDetail.tsx` — the page body (client: it
  writes rows and drives the chat).
- `components/platform/brief/PriceHistoryChart.tsx` — inline SVG, no chart
  dependency.
- `components/platform/brief/EvidenceList.tsx` — the cited documents.
- `tests/price-watch-series.test.ts` (16).

**Modified**

- `lib/platform/agent-findings.ts` — `getFinding(orgId, id)` (org pinned on top
  of RLS; missing relation → null) and `listFindingEvidence(orgId, finding)` →
  `{documents, label, missing}` in citation order.
- `components/platform/brief/FindingCard.tsx` — the observation is now a `Link`
  to `/app/finding/[id]` and the card-level click pushes the same href; the
  tap-to-discuss gesture is a named "✦ Discuss" button; `useStatusWrite` is
  exported so the detail page shares one dismiss path.
- `components/platform/brief/brief-chat.ts` — `draftEmailPrompt(finding,
  {supplier, item})`.
- `components/platform/brief/brief-display.ts` — `foundAtLabel` ("Found 06:14,
  Thu 13 Aug", SAST), `shortDate`, `unitPrice`, `AI_GRADIENT_RULE`; the gradient
  rule's docblock now names the detail page as the sixth sanctioned placement.

### Decisions

1. **The series is resolved from the DEDUPE KEY first, evidence documents
   second.** `agent_findings` stores no supplier and no item, so a finding has
   to be turned back into a series identity. `run.ts:473` builds the key as
   `price_watch:<supplier_id>:<pw_item_id>:<iso-week>[:<market agent>]` and
   documents the inverse (`parseDedupeKey`, `:489`) as load-bearing — the
   nightly run parses it back itself to suppress re-fires. So the fast path is
   zero queries, and `parseDedupeKey` is IMPORTED rather than re-implemented:
   two parsers for one format is how the Brief and the cron end up disagreeing
   about which series a finding belongs to. Only when the key will not parse
   does it fall back to `pw_price_points where document_id = any(evidence_refs)`,
   taking the (supplier, market agent, item) triple those documents have the
   most lines for.
2. **The series key is three columns, not two.** `(supplier_id, line_supplier,
   pw_item_id)` — the DDL comment above `pw_price_points` says so, because
   market agents on one statement charge different prices for the same produce.
   `line_supplier` is filtered in memory rather than in the WHERE clause: it is
   nullable and `null` vs `''` is not worth a second query shape, and the query
   is already narrowed by `(org_id, supplier_id, pw_item_id)`.
3. **The chart's x axis is TIME, not point index.** Even spacing — what an
   index-based x gives, and what most quick implementations do — flattens a
   sudden jump into a slope and turns a quiet quarter into a cliff, on a chart
   whose only job is to show whether a price moved and when. The month labels
   are positioned by the same scale, which is why they are absolutely-placed
   spans rather than the mock's evenly spaced flex row.
4. **Non-Price-Watch findings get no series at all**, by an explicit agent check
   rather than by returning empty. Another agent's evidence documents are still
   invoices and would still produce points — charting them would attach a
   butternut trend to a finding about overdue debtors.
5. **Nothing in the series module throws.** A missing relation, a permissions
   surprise, an unparseable key: all `null`, and the page renders without the
   chart. It decorates a page that already has an observation, a figure and a
   recommendation on it — the same softness `resolveEvidence` has had since the
   Brief shipped. Only `getFinding` can 404 the page.
6. **`deltaPct` and `monthlyVolume` are null, never 0.** "at your current ~0
   kg/month" is a claim about the business and a false one. The volume window is
   90 days over three rather than 30 over one, because produce buying is lumpy
   and one skipped week halves a 30-day figure.
7. **Both chat buttons pre-create the chat, and the DRAFT one waits a render
   before sending.** `send()` closes over the provider's `activeChatId`, so
   sending in the same tick as `adoptChat(id, [])` would still see `null` and
   create a SECOND chat — leaving an empty row in the rail with the finding
   attached to the wrong conversation. So the draft path hands the chat over,
   waits for `activeChatId` to become that id, then sends and navigates. The
   stream lives in the provider, so this component unmounting on the push cannot
   interrupt it, and `ChatView` already prefers live turns over the
   (legitimately empty) server read it lands on. `FinchChatProvider` was NOT
   edited — W5 owns it this wave — which is exactly why the sequencing had to be
   solved from the outside.
8. **Two degradations on those buttons.** No chat row (503 — the finch-chats
   migration isn't applied, plan §5) → W2's path: `askBrief` fills the composer,
   the finding id rides in the provider's ref, and the row is created when the
   owner sends. An answer already streaming → `adoptChat` correctly refuses to
   steal the transcript, so the draft button stops pre-sending and behaves like
   "Send to chat" rather than hanging on a promise that never resolves.
9. **A tap on a card now OPENS the finding; discussing it is a named button.**
   The obvious meaning of clicking a headline is "show me the rest"; "put this
   into a chat" is a specific intent that deserves to be asked for. The
   observation is a real `<Link>` (keyboard-reachable, middle-clickable,
   new-tab-able) and the card-level handler only widens the target to the
   whitespace — it no longer gates on `finchEnabled`, because the detail route
   does not need the chat.
10. **Dismiss/Mark resolved reuse `useStatusWrite` by import, not by copy** —
    two places that can dismiss a finding must not drift into dismissing it
    differently. The detail page takes `write`/`busy`/the toast but not `done`:
    nothing leaves the screen here, the status pill just changes after
    `router.refresh()`, so fading the page out would misdescribe what happened.
    A closed finding's page offers "Restore to the brief" instead.
11. **Every string is formatted on the server** (`foundAt`, evidence dates and
    prices) and handed to the client component finished — the rule `foundLabel`
    established: a client formatting a date at hydration can disagree with the
    HTML it is hydrating, and a flicker on the date of a money finding reads as
    a bug.
12. **The evidence card's date prefers the INVOICE date** from the price point
    over the document's `created_at` — a backfilled invoice is dated when it was
    issued, not when it was uploaded. A document with no point in this series
    shows no price rather than a guess.

### Known tension, flagged rather than fixed

"Send to chat" creates a `finch_chats` row before a word is typed, per plan §4
W3 ("both → create chat with `finding_id` … then navigate"). That is a
deliberate click, unlike W2's tap-a-card case (decision 1 there), so the row is
earned — but a chat abandoned at that point sits in the rail as "New chat"
forever, since titles are generated from the first assistant reply. If that
proves noisy, the fix is a rail filter for message-less chats, not a change
here.

The page opens three RLS clients per render (`getFinding`,
`listFindingEvidence`, and one it passes to `seriesForFinding`).
`createServerSupabase()` only reads the cookie store, so this is object churn
rather than round-trips, and it keeps `agent-findings.ts`'s "every function owns
its client" discipline intact.

### Edge cases covered (plan §5)

- Unknown id, another org's finding, `agent_findings` not migrated → `notFound()`.
- Evidence refs that resolve to zero documents → "The documents behind this
  finding are no longer available."; the chart is independent and still draws.
- Dismissed while the page is open → the browser write + `router.refresh()`
  re-renders the server page, so the status pill flips in place and the actions
  row switches to "Restore to the brief".
- Non-price agents → no chart, no volume sub-line, everything else renders.
- Fewer than two price points → the whole panel is omitted (one price is not a
  history).
- No `rand_impact` → the figure and its sub-line both disappear.
- No `recommended_action` → the block is omitted and the chart takes the full
  width.
- Finch off platform-wide, or no email on the session → the three chat buttons
  are not rendered; the page is still fully readable.

### Gates

`npx tsc --noEmit` clean · `npm test` **215/215** (199 pre-wave on this working
tree + 16 new `shapeSeries` tests; note the W2 report's "177" predates test
files added since) · `npm run build` passes and lists **`ƒ /app/finding/[id]`** ·
`npx eslint` **53 errors / 38 warnings — identical to the pre-wave baseline**.

Runtime verification needs a signed-in session and is W6's job: nothing in this
wave ran against a live database.

### W6 click list

1. `/app` → a finding card's body (and its observation text, and ⌘-click it) →
   lands on `/app/finding/<id>`; the ✦ Discuss button still fills the dock
   composer without navigating.
2. On the detail page: agent chip, status pill, "Found HH:MM, Day D Mon" and the
   headline all match the card.
3. A **Price Watch** finding shows the chart: line rises/falls the way the
   invoices do, month labels sit under the right part of the line, "{supplier}
   today" matches the newest invoice, "Change" matches the observation's %.
4. The volume sub-line ("at your current ~N {unit}/month") appears only where
   there is buying in the last 90 days, and the unit matches `pw_items.base_unit`.
5. Evidence strip: count matches the card's "3 invoices ↗", each card's filename
   and date are real, each price matches that invoice's line, each card opens
   `/app/docu/<id>`, and "Open in Doc-U ↗" opens the first.
6. "Send to chat" → new chat page, composer pre-filled with the half-sentence,
   rail gains the row; send → answer streams and persists.
7. "Draft email to {supplier}" → new chat page, the prompt is already sent, and
   the reply is a DRAFT with Finch saying the owner sends it (never "I've sent
   it").
8. "Mark resolved" then reload → pill reads Resolved, actions row offers
   "Restore to the brief"; "Dismiss" behaves the same and the finding leaves the
   open brief.
9. A finding whose evidence documents were deleted → "no longer available",
   page still renders.
10. `/app/finding/<a random uuid>` → 404, not a 500.

## W3b — the detail page's evidence strip after Phase C (follow-up)

W3 shipped when every agent cited Doc-U documents, so `listFindingEvidence`
resolved `evidence_refs` against `documents` full stop. Phase C's agents do not:
**Debtors Watch** cites `of_invoices` ids and **Stock Cover** cites nothing at
all (its subject is in the dedupe key). Both therefore resolved to zero rows and
the page told the owner *"The documents behind this finding are no longer
available"* — false, and false on the one screen whose whole job is to let them
check a claim about their money. The FEED already knew better
(`lib/platform/agents/finding-kinds.ts` → `evidenceKindOf`); only the detail
route did not.

Nothing in W4's files was touched: `components/platform/{shell,chat,finch}/*`,
`app/app/orderflow/layout.tsx`, `components/platform/docu/DocuNav.tsx`,
`app/api/ai/agent/route.ts`.

### Files

**Modified**

- `lib/platform/agents/finding-kinds.ts` — five new pure helpers:
  `evidenceSourceName` (Doc-U / OrderFlow / ProcurePulse), `evidenceHeadingWord`,
  `evidenceHeading`, `evidenceMissingCopy`, `daysPastTermsLabel`, `stockRuleLabel`.
- `lib/platform/agent-findings.ts` — `listFindingEvidence` branches on
  `evidenceKindOf(finding.agent)` and returns a **discriminated union**
  (`FindingEvidence` = documents | invoices | stock). New row shapes
  `EvidenceInvoice`, `EvidenceStockLine`. Signature widened to
  `Pick<AgentFinding, 'agent' | 'evidence_refs' | 'dedupe_key'>`.
- `components/platform/brief/EvidenceList.tsx` — generic: an item is now
  `{id, href, title, subtitle, detail}` and the heading / "Open in X ↗" / missing
  copy arrive as strings. New `EvidencePanel` type; a `CrateMark` glyph for the
  stock line, which is not a piece of paper.
- `components/platform/brief/FindingDetail.tsx` — three evidence props collapsed
  into one `evidence: EvidencePanel`, passed straight through. **Header, the
  chart, the volume sub-line, the recommendation block and every action button
  are byte-identical.**
- `app/app/finding/[id]/page.tsx` — `evidencePanel(evidence, series)` words each
  of the three strips server-side.
- `tests/agent-findings-evidence.test.ts` — +22.

### Decisions

1. **A discriminated union, not three optional arrays.** "documents is empty"
   must not be indistinguishable from "this finding does not cite documents at
   all" — that conflation *is* the bug. `missing` (cited but unreadable → say so
   in words) stays distinct from an empty strip (nothing cited → omit the
   section).
2. **Invoice balances come from `loadInvoiceRows`, not a SELECT.** The strip
   itemises the headline: "R190,900 outstanding across 2 invoices" has to be
   these rows adding up. An outstanding balance is not a column — it is
   `docTotals` − payments − credit notes with an effective status on top — and
   `lib/platform/orderflow-debtors.ts` is the one definition the Dashboard,
   Finch's chat tools and Debtors Watch itself already share. A cheaper query
   here would have been a fourth opinion about the same money. It costs ~6 reads
   on one customer's ledger, scoped by the customer id **read out of the dedupe
   key** (free); only an unparseable key pays for a lookup to find it.
   `loadInvoiceRows` throws on a read error, so the call is wrapped — a degraded
   strip, never a 500 on a page whose headline already rendered.
3. **Stock says "Subject · stock line", not "Evidence".** Stock Cover's
   `evidence_refs` is empty; the `pp_stock_items` row named by its key is not
   proof of the finding, it is the thing the finding is about. Calling it
   evidence would be a small lie about what the agent did. Its sub-line is the
   RULE (`Low cover` / `Count variance`), the only other thing the key records,
   and the difference between "you are about to run out" and "your count does not
   match your ledger".
4. **A key that will not parse omits the section; a key that parses to a row this
   org cannot read reports it missing.** "No longer available" is a claim about
   the catalogue, and it must not be made when the truth is that the finding
   never recorded which line it meant.
5. **No on-hand figure on the stock card.** It would need `qtyWithUnit`'s
   pluralisation, which is private to `stock-cover/detect.ts`; importing a
   detector onto the render path is what `agents/dedupe-keys.ts` exists to
   prevent, and re-implementing "14 boxes" would be a second definition of it.
   Say less rather than duplicate.
6. **The link targets are the ones the FEED already uses** —
   `/app/orderflow/invoices/<id>` and `/app/procurepulse/stock/<id>` — both
   verified to exist. The invoices LIST reads no search params, so a
   `?customer=` filter would silently do nothing (the same finding C1 recorded).
7. **The price-history chart is untouched and still Price-Watch-only**: it hangs
   off `series`, which is null for every other agent.

### Edge cases

- Debtors finding whose invoices were deleted, or whose ledger read fails → *"The
  invoices behind this finding are no longer available."*
- Stock finding whose line was removed → *"The stock line behind this finding is
  no longer available."*
- Invoice with no due date → no "due …" clause and no "N days past terms"; an
  invoice not actually late → no lateness clause (never "0 days past terms").
- Invoice whose customer row can't be read → figures still render, name dropped.
- An agent nobody has taught `evidenceKindOf` about still resolves against
  `documents`, exactly as before.

### Gates

`npx tsc --noEmit` clean · `npm test` **359/359** (337 pre-change + 22 new) ·
`npm run build` passes and still lists `ƒ /app/finding/[id]` · `npx eslint`
**53 errors — unchanged**; the six changed files lint clean on their own.

Runtime verification still needs a signed-in session with a Debtors Watch and a
Stock Cover finding in the org — nothing here ran against a live database.

## Brief chat v2 — W4 (module bubble + one Finch)

Implements `.ai/plan_brief_chat_v2.md` §1.5, §2.5, §3, §4 W4, §5.

There were two Finches. The dock (Brief-scoped, `module:'brief'` hardcoded at
`FinchChatProvider.tsx:179`) floated its 420px pill across the bottom of all
thirteen platform routes; a second one — `FinchLauncher` → `FinchButton` →
`FinchModal`, mounted in OrderFlow's sub-nav and DocuNav — was module-aware, had
tool status lines, order building and document ingest, and kept a transcript
that shared **nothing** with the dock's. An owner who asked the Brief about a
supplier and then opened the pill in OrderFlow met a blank stranger who had
never heard of it.

W4 collapses that into one. `GlobalChatDock` renders `FinchBubble` on every
route except `/app` and `/app/chat/*`: the same gradient pill, now pinned
bottom-right of the main column instead of drifting with each module's chrome,
expanding into a corner panel that draws the **same provider's** conversation
through the **same** transcript, drop zone and composer the other two surfaces
use. The provider sends the real module, so the panel on OrderFlow reaches
OrderFlow's tools without a second chat component existing to provide them —
which is what made the three legacy files deletable rather than restylable.

### Parity checklist — every FinchModal capability

Written before anything was deleted; the table is the argument that nothing was
lost by accident.

| FinchModal capability | Where it lives now |
|---|---|
| Gradient "Finch" pill (`FinchButton`) | `FinchBubble` collapsed state — same `finch-gradient` + `FinchMark` markup, moved from a module sub-nav to `right:24px; bottom:24px` of the main column on every route |
| Module-scoped agent (a `module` prop per mount site) | `agentModuleForPathname(pathname)` in the provider — no prop, no mount site, and therefore no way for a screen to be given the wrong one |
| Its own `messages` transcript | The provider's `turns` — one conversation across the whole shell, persisted since W1 |
| SSE reader, abort on unmount | The provider's, unchanged (it aborts on shell teardown and `reset()`, deliberately not on navigation) |
| Tool status lines (`streamStatus`) | `ChatTranscript` → `ToolStatusLine` (W2), and stored on the assistant turn so a reopened chat still shows them |
| `**bold**` rendering (`renderContent`) | `MessageBubble.AssistantMessage` (W2), which does more |
| Autoscroll to the newest message | `ChatTranscript`'s `scrollIntoView({block:'nearest'})` |
| Escape closes | `FinchBubble`'s keydown effect, bound only while open |
| Focus the composer on open | `FinchBubble`'s focus effect, through the provider's shared `inputRef` |
| Order-workflow arming (`orderMode`, sticky across the exchange) | `orderModeRef` in the provider + `lib/ai/finch/order-intent.ts` (one regex, read by the client AND `app/api/ai/agent/route.ts`) |
| `orderDraft` SSE → parsed-order card | `DockCard{kind:'draft'}` + `chat/OrderCards.tsx` → `OrderDraftCard` (moved) |
| "Open in a new order" → `stashParsedOrder` + `/app/orderflow/orders/new` | `DockCards` — `order-handoff.ts` and the builder's `FinchOrderPrefill` are untouched |
| Copy an order to the clipboard | `OrderCards.copyOrder` (moved) |
| Dismiss a card | `dismissCard` in the provider |
| Attach → base64 → `/api/ai/agent/ingest-document` | `attachAsOrders` in the provider + `lib/platform/docu/order-ingest-client.ts`, on OrderFlow routes only (see the ruling below) |
| Image downscale to ≤2000px JPEG; 13 MB image / 3 MB PDF caps; 8-file batch | moved verbatim into `order-ingest-client.ts`, with the validation loop extracted as the testable `validateOrderFile` |
| Sequential ingest (no duplicate customer/order/invoice race) | kept, and the reason is in the docblock |
| `IngestResultCard` — filed / invoiced / draft-held / not-built, "View order & invoice", "Open in Doc-U" | `chat/OrderCards.tsx` (moved, markup and copy intact) |
| Drag-over highlight on the panel | `ChatDropZone` (W5) |
| Empty-state paragraph | `FinchBubble`'s, minus the "/" sentence |
| **`/` customer picker** + `/api/ai/agent/customers` | **DROPPED** — plan §1 non-goal. Finch resolves customers by name with `orderflow_find_customer`, which also works from a sentence rather than only from a menu. The ROUTE survives: the dead `components/platform/vyso-ai/VysoAIModal.tsx` still calls it and the plan reserves that tree for a separate cleanup |
| **Pending attachment chips ("attach, type, send")** and the typed `note` that guided the order reader | **DROPPED** — the drop-zone model files immediately, so there is no moment between attaching and sending in which to type. Real, if small: a note like "this one's for Bakers" no longer helps the reader disambiguate a customer. The card now says what it read, and the owner can correct it in the order. Flagged rather than smuggled |
| Modal chrome: portal to `document.body`, `PORTAL_STYLE`, backdrop, click-outside close, `body { overflow: hidden }` | **DROPPED with the modal.** The panel is not modal — the whole point is that the owner can read the table underneath while Finch answers. It renders inside the shell subtree, which already carries the font and the `--radius` override the portal had to re-declare |
| "Finch can make mistakes — double-check anything important." | **DROPPED** — the platform chat W2 shipped (dock, `/app/chat/*`) has never carried one, and a disclaimer on one of three surfaces is worse than none. If it should exist it belongs on all three; noted for a product call, not decided here |

### Files

**Created**

- `lib/ai/finch/module-route.ts` — `agentModuleForPathname` (pathname → the
  agent's unit of knowledge) and `isBubbleRoute` (which screens get the bubble),
  shared by the provider and the dock so the two cannot disagree about where the
  bubble is.
- `lib/ai/finch/order-intent.ts` — `CREATE_ORDER_RE` / `looksLikeOrderRequest`,
  the escalation regex, now in one place.
- `lib/platform/docu/order-ingest-client.ts` — FinchModal's base64 conversion,
  canvas downscale, size caps and ingest call, moved; plus `validateOrderFile`.
- `components/platform/shell/FinchBubble.tsx` — the collapsed pill and the
  expanded panel.
- `components/platform/chat/OrderCards.tsx` — `DockCards` + the two moved cards.
- `tests/finch-module-route.test.ts`, `tests/order-intent.test.ts`,
  `tests/order-ingest-validate.test.ts` — 39 tests.

**Modified**

- `components/platform/shell/FinchChatProvider.tsx` — real `module`; the sticky
  workflow arm; `orderDraft` events kept instead of dropped; the OrderFlow
  branch of `attach`; the bubble's open/unread state.
- `components/platform/shell/GlobalChatDock.tsx` — renders `FinchBubble` on
  bubble routes; `/app` and `/app/chat/*` untouched.
- `app/api/ai/agent/route.ts` — imports the shared regex (its local copy is
  gone; behaviour identical).
- `app/app/orderflow/layout.tsx`, `components/platform/docu/DocuNav.tsx` —
  `FinchLauncher` mounts removed.
- `components/platform/finch/useFinchStream.ts`,
  `components/platform/brief/brief-chat.ts`, `app/api/ai/agent/route.ts` —
  comments that named the deleted files corrected.

**Deleted** — `components/platform/finch/{FinchLauncher,FinchButton,FinchModal}.tsx`.
`FinchMark`, `BouncingDots`, `FinchOrderPrefill` and `useFinchStream` stay: the
first two are used by the bubble, onboarding and the transcript, the third is
the New Order builder's half of the handoff, and the fourth is onboarding's
streamer.

### Decisions

**The OrderFlow drop path keeps `/api/ai/agent/ingest-document`; everything else
uses W5's Doc-U path.** The plan asked whether the two could be unified. They
cannot, and the reason is one branch: `syncOrderFromDocument` — the call that
turns a read customer order into an `of_orders` row and auto-invoices it — runs
in `app/api/ai/extract/route.ts` only when the `documents` row was **already
typed `'order'` before extraction** (`:69`, `:121`). `uploadDocument` files rows
untyped, because on every other surface the classifier decides the type, so a
customer order dropped through the W5 path is read, filed, and then stops: no
order, no invoice. `ingest-document` classifies FIRST and then runs the shared
pipeline (`lib/platform/document-ingest.ts`, also the inbound-email worker's).
So `attach()` branches on `agentModule === 'orderflow'`, which is the only
signal available at drop time and the right one — a document dropped on an
OrderFlow screen is being dropped *into* OrderFlow. It still lands in Doc-U
either way.

**The OrderFlow drop sends no chat message.** FinchModal's didn't either, and it
is the better behaviour: filing a document is not a question. The card says
"read as a customer order for Bakers · 6 lines · invoice INV-1042 created"
immediately, with no model turn, no latency and no tokens; the owner can then
ask about it in their own words. (It also sidesteps a real gap: the `orderflow`
module has no `docu_*` tools, so W5's "I've uploaded invoice.pdf" prelude would
point the model at a `docu_get_document_summary` it was never offered.)

**The workflow arm is sticky, not per-message.** The plan allowed "always let the
route's regex decide". That drops a real capability: the model's clarifying
question ("which customer?") gets a one-word answer that no order regex will ever
match, so the follow-up would fall back to Haiku with `orderflow_prepare_order`
withheld and the order would silently never be built. `orderModeRef` is armed by
the regex, disarmed when a draft arrives or the conversation is emptied — exactly
FinchModal's rule, minus the `/` picker that used to be its other trigger.

**Cards are provider state, not messages.** Nothing server-side holds what they
point at (the route streams `orderDraft` as display data and saves no order), so
persisting them would mean reopening a chat tomorrow to a live "Open in a new
order" button for a draft that never existed. The answer text beside them is what
survives.

**A chat started on the Brief and continued in the bubble keeps its original
`module`.** The row records where the conversation *started* — that is what the
owner recognises it by in the rail — while the tools follow where they are
standing now. A chat can therefore span tool sets, which is the point of one
Finch rather than four.

**The unread dot is route-aware.** It is set only when a complete answer lands
while the bubble is shut AND the owner is on a bubble route, read from refs at
completion time rather than from the closure — a turn started on OrderFlow can
finish after they have walked to Doc-U. On `/app` and the chat pages the answer
arrives in front of them, so a dot there would be pointing at something they are
looking at.

**The bubble's state lives in the provider**, not in the component: the dock
re-renders per route, so collapsed/expanded held locally would reset every time
the owner walked from Suppliers to Stock — and "the same conversation everywhere"
is the whole feature.

### Edge cases covered (plan §5)

- `/app/settings`, `/app/organisation`, `/app/notifications` — bubble shows,
  `'brief'` tools, header reads just "Finch" (they are not MODULES entries, so
  there is no honest label to add).
- `prefers-reduced-motion` — the pill's hover scale and the panel's open
  animation both drop out (`motion-reduce:` utilities + the existing
  `@media` block beside `vyso-pop-in-up` in globals.css).
- Mobile — full-width bottom sheet with a rounded top edge; the bubble is inside
  the column *below* the mobile top bar, and the 62vh cap keeps the panel clear
  of it.
- Trial expired / Finch disabled / no email — the bubble is behind
  `GlobalChatDock`'s existing gate, so it inherits all three (§8 E6).
- Rate limit, failed chat creation, aborted stream — unchanged from W1/W2; the
  bubble is a view onto the same `send()`.

### Gates

`npx tsc --noEmit` clean · `npm test` **376/376** (337 on this tree before the
wave — W3b's commit included — plus 39 new) · `npm run build` passes · `npx
eslint` **50 errors / 38 warnings**, down from the 53/38 baseline: deleting
FinchModal took three pre-existing errors with it, and none of the new or
changed files lint at all.

Runtime verification needs a signed-in session and is W6's job — nothing in this
wave ran against a live database or a browser.

### W6 click list

1. `/app/orderflow` (and `/app/docu`, `/app/procurepulse`, `/app/settings`) — the
   gradient **Finch** pill sits bottom-right, same spot on every one, above the
   page content and clear of the sub-nav. No pill in OrderFlow's sub-nav or on
   DocuNav any more.
2. Click it → panel opens bottom-right, 420px, header reads "Finch · OrderFlow".
   Escape collapses it; the ✕ collapses it; clicking the table behind it does
   **not** (it is not a modal).
3. Ask "how many invoices did I raise this week?" on `/app/orderflow` → ✦ tool
   status lines appear ("Reading recent invoices…") and the answer uses OrderFlow
   data. The same question on `/app` still answers as the Brief.
4. Collapse mid-answer → the dot appears on the pill when the reply lands;
   opening it clears the dot and the full answer is there.
5. Navigate OrderFlow → Doc-U → ProcurePulse with the panel open: it stays open,
   same transcript, header label changes with the screen.
6. Send from the bubble → the chat appears in the rail (module dot), and the
   page does **not** navigate to `/app/chat/<id>` (only the Brief does that).
   Reload → `/app/chat/<id>` replays it.
7. "Create an order for {a real customer}: 3 crates tomatoes, 2 boxes onions" in
   the OrderFlow bubble → workflow tier, "Putting the order together…", an
   **Order draft** card. Answer a clarifying question with a bare name and check
   it still builds (this is the sticky arm).
8. Card → "Open in a new order" → the bubble collapses and
   `/app/orderflow/orders/new` opens with the lines prefilled; "Copy" copies;
   "Dismiss" removes it.
9. Drop a customer-order PDF on the OrderFlow panel → "Reading & filing …" → a
   **Filed in Doc-U** card naming the customer, the line count and the invoice
   number; the order exists in OrderFlow and the document in Doc-U.
10. Drop the same PDF on the Doc-U or ProcurePulse panel → W5's path instead:
    attachment card, "Reading …", and Finch summarises it (no invoice — correct).
11. Drop a 4 MB PDF on OrderFlow → refused inline with "too large (max 3MB for
    PDFs)", nothing uploaded. Drop a `.xlsx` → "not a PDF or image."
12. `/app` and `/app/chat/*` are visibly unchanged: full pill + chips + floating
    panel on the Brief, composer-only on a chat page.
13. Mobile width — pill bottom-right above the safe area, panel opens as a
    full-width sheet, top bar still reachable.

---

# Phase C agents — Debtors Watch, Stock Cover, Doc Watch (branch feat/agents-phase-c)

Implements `.ai/plan_agents_phase_c.md` in full. Built in an isolated worktree
because the W1–W5 chat waves were on `main` at the same time; the only shared
files touched are the append-only spots the plan lists.

Gates at every step: `npx tsc --noEmit` clean, `npm test` green, `npm run build`
succeeds, and the lint count held at **53 errors / 38 warnings** from first
commit to last (identical to `main` at 7b2adde — nothing new was introduced and
nothing pre-existing was fixed). Tests grew 130 → 252.

`next build` could not run against a symlinked `node_modules` (Turbopack:
"Symlink [project]/node_modules is invalid, it points out of the filesystem
root"), so the worktree has its own `npm ci` install.

## Decisions the plan left open

**Where "shared" work landed in the commits.** The plan asked for one
`agents: shared allowlist + evidence resolver + digest copy` commit, but the
evidence resolver is a prerequisite for C1's cards rendering and the digest copy
depends on C3 existing. Split into `agents: shared allowlist` (first) and
`agents: digest copy + BRIEF knowledge` (last), with the resolver restructure
inside the C1 commit that needed it.

**`parseEnvList` is imported, not re-implemented.** `agents/org-allowlist.ts`
imports it from `price-watch/run.ts` — the digest route already did the same, so
"how a comma-separated env var is split" still has one definition. Importing is
not "touching `price-watch/*`".

**`AGENTS_ORG_IDS` falls back only when it is EMPTY.** An operator who clears the
new var has turned the agents off and must not be silently overridden by the
legacy one.

**Two new shared modules the plan did not name.**
- `lib/platform/agents/dedupe-keys.ts` — every Phase C key builder/parser. A
  Stock Cover finding's only record of WHICH stock line it concerns is its key
  (its `evidence_refs` is empty, per the plan), so the Brief's resolver has to
  parse one on the render path. A dependency-free leaf keeps a detector — and
  its transitive weight — out of the page bundle.
- `lib/platform/agents/finding-kinds.ts` — the pure decisions
  `agent-findings.ts` makes (receipt vs finding, which table the refs point at,
  the evidence nouns). `agent-findings.ts` imports `supabase-server` →
  `next/headers` and cannot be unit tested; these can, and they are what
  `tests/agent-findings-evidence.test.ts` pins.
- `lib/platform/sast.ts` — the SAST clock, lifted out of
  `components/platform/brief/brief-display.ts` and now shared with Doc Watch's
  detector, so a card's "Found this morning" label and the sentence inside it
  cannot disagree about the owner's hour. `brief-display` re-exports `SAST`.

**Relative, `.ts`-suffixed imports in every unit-tested module.** `node --test`
cannot resolve the `@/` alias — the 2026-08-14 Price Watch model outage in
person. Route handlers keep using `@/`.

**Extra test file.** `tests/agents-org-allowlist.test.ts` (a fifth, beyond the
four the plan lists) — the allowlist is the one thing standing between "ran for
Meridian" and "wrote into every customer's Brief", so its truth table is pinned.

### C1 — Debtors Watch

- **The "their longest ever" clause is OMITTED.** The plan offered it "if
  derivable from history". It is not: `loadInvoiceRows` yields a paid TOTAL per
  invoice, never a settlement date, so "the longest they have ever taken" cannot
  be computed without a second read of `of_payments` and a definition of
  "settled" nothing else in the product has. Say nothing rather than
  approximate.
- **The evidence link is the first cited INVOICE, not a filtered list.** The
  plan's `/app/orderflow/invoices?customer=…` would silently do nothing —
  `app/app/orderflow/invoices/page.tsx` reads no search params. The
  single-invoice route exists and is exact, and matches the shape the document
  branch already uses.
- **`loadInvoiceRows`'s child reads gained `.eq('org_id', orgId)`.** They were
  narrowed only by an invoice-id list before. Harmless for the RLS-scoped chat
  caller; load-bearing for the agent's service-role one.
- **No auto-close in v1** (as the plan says). A card stays until dismissed, and
  the dedupe key then stops it returning for the same invoice. Auto-resolving on
  payment needs a payment watcher this phase does not have.

### C2 — Stock Cover

- **`pp_stock_thresholds.low_threshold` wins over the catalogue's** when a row
  exists and carries a value — the precedence InsightGen's stock-low rule
  already uses.
- **"Reorder before {weekday}" only inside the coming week.** Beyond six days a
  weekday names an ambiguous date ("before Saturday", said twelve days out), so
  the copy becomes "Reorder before 29 August". A line already at zero gets
  "Reorder now — nothing is left on this line" instead of a "before".
- **Units are pluralised** ("14 boxes", not "14 box"); measurement
  abbreviations (kg, g, l, ml…) are left alone.
- **Consumption excludes count adjustments**, so a stock count can never
  masquerade as demand and shorten a line's days of cover.
- **The evidence link is the stock ITEM page** (`/app/procurepulse/stock/<id>`),
  verified against the catalogue first — the plan said the stock list; the item
  page is exact and the id is right there in the key.
- **`isoWeekOf` is imported from `price-watch/run.ts`** rather than duplicated.

### C3 — Doc Watch

- **Statement total is the LINES' own sum**, worded "N lines worth R x". The
  plan's "{N} lines, R{total}" next to a market sheet's stated closing balance
  would invite the reader to think the lines add up to it; a closing balance
  carries last month's opening figure, payments and pallet charges.
- **"read {this morning|overnight}" is a four-way phrase.** Afternoon, evening,
  yesterday, "3 days ago" and "on 30 June" each get an honest wording rather
  than being rounded into one of the plan's two.
- **`priceListChanges` counts only lines that EXISTED on the previous list.** A
  new line has no previous price to have moved from. No previous list at all
  yields `null`, not `0`, and the clause is dropped.
- **Informational rule is belt-and-braces**: slug in `INFORMATIONAL_AGENTS` AND
  `rand_impact == null` AND `recommended_action == null`. If Doc Watch ever
  learns to price something, that row starts counting without anyone editing a
  list.
- **48-hour ageing is computed at READ TIME**, no cron, no status write. An aged
  receipt is PRESENTED as `resolved` in History (its stored status is still
  `new`) so History's card does not label a row nobody dismissed as
  "Dismissed". Restore writes `new` and it ages out again on the next render —
  harmless, and the honest consequence of a rule with no state behind it.
- **The `after()` hook uses the CALLER'S RLS-scoped client**, not the service
  role: `/api/ai/extract` is a signed-in request with a session to scope.
  Failures are logged only; the nightly sweep is the backstop.
- **The Brief's empty-state copy** no longer credits Price Watch alone — four
  agents write there now.

## Cron schedule (vercel.json)

| Path | Schedule (UTC) | Why there |
|---|---|---|
| `/api/email/process` | `0 3 * * *` | unchanged |
| `/api/agents/doc-watch` | `40 3 * * *` | BEFORE Price Watch — the price agent reads the same paper, and "read overnight" appearing after the finding raised from it reads backwards |
| `/api/agents/price-watch` | `45 3 * * *` | unchanged |
| `/api/agents/debtors-watch` | `50 3 * * *` | |
| `/api/agents/stock-cover` | `55 3 * * *` | |
| `/api/agents/digest` | `0 4 * * 1` | unchanged |

Every agent route is idempotent, so the ordering is a courtesy to the reader of
the Brief, not a correctness requirement.

---

# Brief v2b — chips only in new chat, 4+1 card cap, admin-only Brief

Implements `.ai/plan_brief_v2b_focus_and_access.md` in full: the three asks Josh
made verbatim on 2026-08-18 — suggestions only in a new chat, five cards maximum
with a way through to everything, and a Brief only the people who run the
business can open.

Nothing in `lib/platform/*watch*/`, `lib/platform/stock-cover/*`,
`lib/platform/doc-watch/*`, `app/api/agents/*`, `components/finch/*`,
`app/globals.css` or any SQL/RLS was touched (plan §2).

## Files

**Created**

- `lib/platform/access.ts` — `canSeeMoney` / `canSeeBrief`, one implementation,
  two exported names. Framework-free, so the layout, the two Brief routes and
  `/api/ai/agent` all import the same predicate.
- `lib/platform/brief-feed.ts` — pure. `rankFindings`, `splitForToday(open,
  cap=5, show=4)` → `{cards, overflowCount}`, `groupByAgent`,
  `TODAY_CARD_CAP`/`TODAY_CARD_SHOW`, `FULL_BRIEFING_AGENT_ORDER`. Relative
  `.ts` imports and a structural row type, so `node --test` loads it directly.
- `components/platform/brief/OverflowCard.tsx` — the fifth card.
- `components/platform/brief/FullBriefing.tsx` — `?view=all`.
- `tests/brief-feed.test.ts` (21), `tests/access.test.ts` (4).

**Modified**

- `app/app/page.tsx` — the `canSeeBrief` redirect; a third view (`all`); the cap
  and the overflow card; the receipts band is today's-brief-only now that the
  full briefing draws its own.
- `app/app/finding/[id]/page.tsx` — the same redirect, above the reads.
- `app/app/layout.tsx` — `briefAccess` / `moneyAccess` from the shared
  predicate; the findings prelude and the findings-derived chips are withheld
  from anyone without brief access; `canSeeBrief` threaded to the rail and the
  mobile top bar.
- `components/platform/shell/{AppRail,MobileTopBar,MobileDrawer}.tsx` — one prop
  passed through to `RailNav`.
- `components/platform/shell/RailNav.tsx` — the two Brief rows are conditional;
  `RailChats` is not.
- `components/platform/shell/shell-data.ts` — `firstOpenableModuleHref`.
- `components/platform/shell/GlobalChatDock.tsx` — chips removed; one
  placeholder; "Asking Finch".
- `components/platform/chat/ChatComposer.tsx` — `COMPOSER_PLACEHOLDER`; the
  `placeholder` prop is gone.
- `components/platform/shell/FinchBubble.tsx`,
  `components/platform/chat/SuggestionChips.tsx`,
  `components/platform/brief/FindingCard.tsx` — placeholder prop dropped,
  docblock corrected, aria-label renamed.
- `app/api/ai/agent/route.ts` — its inline role check replaced by the imported
  `canSeeMoney`.

## Decisions

1. **The redirects live in the PAGES, never in the layout** — and this is the
   one thing in the wave that would have been wrong the easy way. `app/app/
   layout.tsx` is where the session, the role and the module list already are,
   so an auth check there is the obvious move; it is also documented as
   unreliable. Next 16 layouts do not re-render on a client-side navigation
   (Partial Rendering), so a check placed in one is not re-run on a route change
   — `node_modules/next/dist/docs/01-app/02-guides/authentication.md`, "Layouts
   and auth checks", which says in as many words to do the check "close to your
   data source or the component that'll be conditionally rendered". So the
   layout computes the flag and hides chrome with it; `app/app/page.tsx` and
   `app/app/finding/[id]/page.tsx` each carry three lines of their own that
   `redirect()`. The plan reached the same conclusion and forbade a route group;
   routes are unchanged and the build lists no new ones.
2. **Two exported names over one shared body.** `canSeeMoney` and `canSeeBrief`
   are the same predicate today, and collapsing them into one function was
   tempting and would have been a mistake: they answer different questions ("may
   this person read a figure?" / "may this person open the agents' feed?"), and
   the day a viewer role sees the brief without the rands, that should be one
   function body changed rather than an archaeology exercise across every call
   site that happened to mean the other thing. Both fail closed on a null,
   missing or unrecognised role — `profiles.role` is free text in Postgres, so
   "unknown" really occurs, and `tests/access.test.ts` pins the whole truth
   table including `'Owner'` and `' admin'`.
3. **UI and route gating, on top of the existing money gate. RLS is untouched.**
   `agent_findings` is still readable org-wide at the database level, exactly as
   before this wave. What changed is that the product no longer RENDERS the feed
   for a member and no longer puts it in Finch's prelude — the same layer
   `canSeeMoney` has always worked at (the finance tools return a `restricted`
   string; they do not fail the query). Said in `access.ts`'s docblock so the
   next person does not mistake this for row security.
4. **The prelude is emptied, not just the screen.** A member redirected off
   `/app` who then asks Finch a question must not receive the Brief in prose —
   supplier names, rand figures, who is late — glued to the front of their first
   turn. `briefChatContext` is only built when `briefAccess`, and
   `suggestionsForOrg` is handed `findings: []`, because a chip's LABEL is the
   finding. The generic and document openers still appear, so
   `/app/chat/new` is not a blank screen for them.
5. **`firstOpenableModuleHref` exists because `railModules` keeps LOCKED
   modules.** The plan says "redirect to their first unlocked module" and the
   obvious reading — `railModules(features)[0].href` — is subtly wrong:
   `railModules` deliberately includes modules the org has not bought, since the
   rail draws them as a row that opens ModuleLockNotice. Bouncing someone off
   the Brief onto "this module is locked, email Joshua" is two refusals in a
   row, which is worse than the 403 the redirect was avoiding. The helper
   filters `session.lockedModules` and falls back to `/app/settings`. It lives
   in `shell-data.ts` (which already owns `railModules`) so the two routes
   cannot drift. **No loop is possible**: `/app/settings` is gated by nothing but
   sign-in, and `ModuleLockGuard` RENDERS a locked screen rather than
   redirecting.
6. **`splitForToday` ranks its own input.** The cut and the order are one
   decision — a cap applied to an unranked list is a random four — so there is no
   way to ask this module for the cards without also getting the ordering that
   makes them the right ones. `rankFindings` returns a NEW array, because
   `feed.open` is shared with the greeting's count and the rail's badge and a
   sort in place is how the heading ends up describing a different list from the
   one below it.
7. **Money beats recency; nulls sort last, not as zero.** The agents all run
   inside one 20-minute window overnight, so "newest first" is a near-random
   tiebreak that would push a R48 000 supplier drift below a R900 one purely
   because Stock Cover ran five minutes later. And a finding with no
   `rand_impact` is one nobody could PRICE, not one worth nothing — sorting it as
   0 would be a claim, sorting it after everything priced is an admission. Same
   "say nothing rather than claim nothing" rule as the rest of the Brief.
   `'new'` outranks `'in_progress'` because in-progress means somebody has
   already looked.
8. **Crossing from 5 to 6 open findings REMOVES a card from the screen.** At
   exactly the cap all five show and no overflow card appears — spending the
   fifth slot on "you have 0 other items" would be absurd. At six, the fifth slot
   becomes the overflow card and four findings survive. It reads odd written
   down and is right on screen; it is also where most of `tests/brief-feed.test.ts`
   spends its time, including an invariant that `cards.length + overflowCount`
   equals the input at every size.
9. **The greeting keeps the TRUE total, which is precisely why the overflow card
   is not optional.** "27 things need your attention" over four cards is data
   going missing. The card is the honest half of the cap, and it is why
   `feed.summary.openCount` was left alone.
10. **The overflow card is not a finding and does not dress as one.** No agent
    chip, no timestamp, no rand figure, no accent bar, no evidence link — and no
    Dismiss, per the plan: it is a COUNT of other cards, and a dismissed count
    would simply lie on the next render. Dashed border and a tinted ground so it
    reads as chrome rather than as a fifth thing the agents found.
11. **The full briefing GROUPS rather than listing.** The two views answer
    different questions: today's brief is "what do I do first?", which is an
    ordering; `?view=all` is "what has Vyso got on me?", which is about coverage
    — and twenty-three cards in a flat column is exactly the wall the cap exists
    to prevent. Headings come from `agentChip`, the same function the cards' own
    chips use, so a group can never be titled something its cards disagree with;
    an agent nobody has listed in `FULL_BRIEFING_AGENT_ORDER` is APPENDED rather
    than dropped, because a new agent must never be the reason a finding vanishes
    off the one screen that promises everything. `FindingCard` is reused verbatim
    — the same finding must not offer different actions depending on which view
    it was read in.
12. **`?view=all` keeps the "Today's brief" rail highlight** (`isBrief` is
    `pathname === '/app' && !isHistory`, so this needed no change): the reader
    got there from the brief's own overflow card and is still inside the brief,
    looking at more of it. The "← Back to today's brief" link is the way out.
    An unknown `?view=` value falls through to today's brief.
13. **The rail keeps chats for a member; it loses only the two Brief rows.** A
    chat is that person's own, it is useful on the module screens they do have,
    and every money tool Finch could reach from it is already behind the same
    role gate. `RailChats` therefore becomes the first thing in their rail, which
    is correct. `MobileDrawer` takes the same prop through the same `RailNav`, so
    the two surfaces cannot drift.
14. **One composer placeholder, and the `placeholder` prop is gone rather than
    defaulted.** The plan's wording is "the composer placeholder everywhere
    reads 'Ask Finch anything about your operation…'". A prop with a default is
    still three mount sites' licence to disagree; removing it makes the rule
    structural. The casualty is the contextual "Reply to…" variant on a chat
    page, which is a real if small loss — flagged here rather than smuggled. The
    transcript sitting directly above the input already says what typing into it
    does.

## Deviations from the plan, and why

- **`FinchChatProvider` was NOT given a `canSeeBrief` prop** (plan §2 lists it
  among the components to modify). There is nothing for it to do with one: the
  two things the plan wanted withheld — the findings prelude and the
  findings-derived chips — are withheld AT SOURCE in the layout, which is
  strictly stronger than a flag the provider would have to remember to check,
  and an unused prop on the shell's largest client component is dead weight that
  rots. The file is untouched by this wave.
- **`tests/access.test.ts` is a second test file** beyond the one the plan names.
  The access rule is the only thing standing between "the owner's brief" and
  "everyone's brief", and its failure mode (a default that flipped open) is
  invisible on every screen an owner ever looks at. Same reasoning as Phase C's
  fifth test file.
- **`firstOpenableModuleHref` in `shell-data.ts`** — a file the plan's modify
  list does not name. See decision 5: the plan asked for "first unlocked
  module", and honouring that literally needs `lockedModules`, which
  `railModules` deliberately does not filter.

## Known, flagged rather than fixed

- **The layout still runs `fetchFindings` for a member**, whose rail then draws
  no badges with it. It is pre-existing cost, not a regression, and cutting it
  would restructure the `Promise.all` the plan asked to be left alone. If the
  member population ever grows, skip the read (and `resolveEvidence` with it)
  when `!briefAccess`.
- **`FinchChatProvider` still says "Vyso could not answer (…)"** on a failed
  turn, and the attach fallback still names Vyso, while the dock header now
  reads "Asking Finch". The plan's grep target was the `Ask Vyso` strings
  specifically, and those are gone; the assistant-voice error copy is a wider
  rename that deserves its own pass rather than being widened into this diff.
- **`components/finch/showcase/data.ts` still carries the old placeholder** —
  that is marketing, explicitly out of scope.

## Gates

`npx tsc --noEmit` clean · `npm test` **401/401** (376 baseline + 21 brief-feed
+ 4 access) · `npm run build` passes and lists **no new routes** — `view` is a
search param, `ƒ /app` and `ƒ /app/finding/[id]` unchanged · `npx eslint .`
**50 errors / 38 warnings — identical to the pre-wave baseline**, and every new
or changed file lints clean on its own · static grep for `Ask Vyso` under
`components/platform`, `app/app`, `lib/platform`, `lib/ai` returns **zero**.

Runtime: `/app` and `/app?view=all` were exercised against a dev server
unauthenticated — both 307 to `/login` with no server error, which proves the new
server modules evaluate. Everything role-dependent needs a signed-in session and
is W6's job; nothing here ran against a live database.

## W6 click list

**As an owner/admin (Josh's own login):**

1. `/app` with **fewer than five** open findings → every card shows, no overflow
   card. The greeting's count matches the number of cards.
2. Seed or wait for **six or more** open findings → exactly **four** cards plus
   a dashed card reading "You have {N−4} other items that need your attention."
   The greeting still says the TRUE total, and greeting − 4 = the card's number.
   Check the four are the four biggest `≈R/yr` figures with `New` before
   `In progress`, not the four most recent.
3. At **exactly five**, all five show and the overflow card is absent.
4. "View the full briefing →" → `/app?view=all`: headings **Price Watch /
   Debtors / Stock** in that order with per-group counts, every open finding
   present, "Read this morning" last. The rail still highlights **Today's
   brief**. "← Back to today's brief" returns to `/app`.
5. Dismiss a card on `/app` → it goes and the **next-ranked** finding slides in
   (the overflow count drops by one). Dismiss down past six and the layout
   switches from 4+overflow to five plain cards.
6. `/app?view=history` unchanged — closed findings, Older chats, no cap.
   `/app?view=nonsense` → today's brief.
7. `/app` shows **no suggestion chips** above the composer. `/app/chat/new`
   **does**, above the pill. `/app/chat/<id>` does not.
8. The composer reads **"Ask Finch anything about your operation…"** on `/app`,
   on `/app/chat/new`, on `/app/chat/<id>` and inside the module bubble on
   `/app/orderflow`. The dock's expanded panel header reads **"Asking Finch"**.
9. `/app/finding/<id>` still opens and behaves as it did in W3/W3b.

**As a member** (create one for Meridian with the `tns-users-roles.sql` pattern,
`role = 'member'`):

10. Sign in → landed on a MODULE (the first one enabled and not locked), not on
    `/app`, and not on a "this module is locked" screen.
11. The rail has **no "Today's brief" and no "History"** — "New chat", this
    user's chats, "Under the hood" and the account cluster are all still there.
    Open the mobile drawer at `<lg` and confirm the same.
12. Type `/app` → bounces to the module. Same for `/app?view=all`,
    `/app?view=history` and `/app/finding/<a real finding id>`. No 403 page, no
    redirect loop.
13. `/app/chat/new` → chips appear, and **none of them names a finding, a
    customer or a rand figure** (generic + document openers only).
14. Ask the bubble "who owes me money?" → the restricted answer, unchanged.
15. Ask it "what did you find overnight?" → it does **not** recite the brief;
    the prelude is empty for this user.

# Brief polish — full briefing as a report; the mark is the Finch bird

Two small asks from Josh on 2026-08-18, on `main` (from 89afc2a).

> "it'd be cool if when user clicked 'view the full briefing', it opened into
> like a dashboard / report style thing, so just a bit of a different styling to
> the cards."

> "the gradient ✦ mark should be the finch bird."

## Files

**Created**

- `components/platform/brief/BriefingRow.tsx` — one finding as a ROW: status
  dot, headline (→ `/app/finding/[id]`), ≈R/yr right-aligned, evidence noun,
  found-time, Dismiss. Client, because Dismiss is a write. Exports
  `BRIEFING_ROW_COLS`, the grid template, so the column header cannot drift from
  the rows it heads.

**Modified**

- `components/platform/brief/FullBriefing.tsx` — rewritten as a report:
  masthead (org, "Full briefing", generated-at in SAST, one-line totals strip),
  then one table per agent with a section subtotal, then the receipts band.
- `app/app/page.tsx` — the brief's masthead (eyebrow, greeting, ✦ line) is
  withheld on `?view=all`; `orgName` threaded into `FullBriefing`; docblock
  corrected on both counts.
- `components/platform/finch/FinchMark.tsx` — the platform mark is now the
  brand bird, painted through `components/finch/FinchBirdMark`'s mask.
- `components/platform/chat/MessageBubble.tsx` — the assistant's 30px gradient
  disc carries the bird instead of a ✦.
- `components/platform/shell/FinchBubble.tsx`,
  `app/onboarding/layout.tsx`,
  `components/platform/onboarding/{StageData,OnboardingFlow}.tsx` — every mount
  site stopped passing `chip` and grew its bird to ~70% of the disc it already
  draws (see decision 6).
- `app/globals.css` — one stale comment beside `.finch-mark-pop` ("the mark is a
  filled contour"). No rule changed.

Untouched: `lib/platform/brief-feed.ts` (the report uses `groupByAgent` exactly
as the grouped card view did), `FindingCard`, `ReadOvernightBand`, every agent,
every SQL file, and `components/finch/FinchBirdMark.tsx` — which is imported,
not edited.

## Decisions

1. **`?view=all` is a REPORT, so it loses the greeting.** Up to this pass it was
   the same five-card component under agent headings — a longer brief. The two
   views answer different questions (today: "what do I do first?", an ordering;
   all: "what has Vyso got on me?", coverage), and coverage is a document: a
   masthead, totals, dense tables. That is also why `app/app/page.tsx` now
   withholds its own eyebrow/greeting/✦ line on this view. A report stacked
   under "Morning Josh. 27 things need your attention" is two documents printed
   on one page, and the masthead the brief already carries duplicates the org
   and the date the report has to state for itself. History and today's brief
   still share the page header, unchanged.
2. **The table idiom is the design's own back office** (`.ai/design/vyso-brief/
   Vyso - The Brief.dc.html` §1d): white sheet, 12px radius, hairline row rules,
   uppercase 10.5px column heads on a tinted strip, tabular figures
   right-aligned, a hover tint. Nothing new was invented for it, which is the
   point — the product already has a register for "raw data behind the brief".
3. **Monochrome, with the agent chip colour as the only accent** (section dot +
   status dot). Specifically NO gradient: `brief-display.ts` rations it to five
   sanctioned placements and it means "Vyso said this". Thirty rows of it is
   wallpaper, and the rand column here is a fact from an invoice, not a claim
   Vyso is making about itself.
4. **Status is a SHAPE, not a colour** — filled dot = `new`, hollow ring =
   `in_progress`. A second colour would compete with the agent accent the dot is
   already drawn in, and disc-vs-ring survives a monochrome print and a
   colour-blind reader. The words are still there for a screen reader (`sr-only`
   inside the dot's own cell, so it does not become a stray grid child).
5. **Two lines for the observation, not one.** The first cut truncated at one
   line, and every real finding read "FreshCo Produce raised tomatoes from
   R8.41/kg to…" — the half that says nothing. `line-clamp-2` with the four
   fixed columns trimmed to what their widest content needs (104/96/92/62px,
   12px gaps) gives the sentence ~282px at the 820px column and shows nearly all
   of them whole. Checked in a browser against nine realistic rows.
6. **Every mount site draws its own disc, so `FinchMark` stops drawing one.**
   The bubble header, both onboarding headers and the onboarding panel each wrap
   the mark in a fixed-size `finch-gradient` circle AND passed `chip`, which
   drew a second gradient disc a pixel inside the first — two independently
   animating gradients stacked. All four now pass no `chip` and a bird sized to
   ~70% of the disc (24→17, 28→20, 56→38; the collapsed pill 15→17). The prop is
   kept, documented, for a caller with no disc of its own.
7. **~70% is not taste, it is the stroke.** The artwork's stroke is ~3.8% of its
   box, so a 13px bird is a half-pixel line. 15/17/19/21px birds were compared
   in a 24px disc in the browser at DPR 2: 17 is the largest that keeps a margin
   inside the disc and the smallest that holds its line. Below ~15px the mark
   should be a ✦, not a bird.
8. **The bird is IMPORTED, not re-traced.** `components/finch/FinchBirdMark.tsx`
   already paints `public/finch/finch-bird.svg` as a CSS mask, and its docblock
   says why (the logo's own orange→blue strokes drop to ~2:1 on a dark ground; a
   second copy of the path data drifts out of sync with the real logo). The
   platform wrapper adds white, the disc and the draw-in. The traced filled
   contour that FinchMark carried since c3d6533 is gone — it was a second,
   slightly different bird.
9. **Which sites get the bird, and which keep the ✦** — the rule is *identity vs
   voice*. A circular gradient disc that stands for the speaker is an AVATAR and
   gets the bird: the collapsed bubble pill, the dock/panel header, both
   onboarding headers, the onboarding panel, and the assistant's 30px disc in
   every transcript (`MessageBubble`). A ✦ set in a run of text means "Vyso is
   working / Vyso wrote this line" and keeps the glyph: `ToolStatusLine`, the
   brief's ✦ status line, `FindingCard`'s recommendation mark and its "Discuss"
   button, `FindingDetail`, `OverflowCard`, `ReadOvernightBand`, `BriefEmpty`,
   `ChatComposer`, `ChatDropZone`. Two sites were checked and deliberately left
   alone: `OrderCards`' 20px discs carry a sparkle and a tick that are STATE
   ("order draft", "filed in Doc-U"), not the Finch identity — and at 20px a
   bird would be a smudge; `RailNav`/`RailChats`' `AI_GRADIENT_CHROME` is an 8px
   live dot and a pill border, not a mark.
10. **The totals strip drops segments rather than printing zeros** — "0 debtors"
    next to three price findings is noise, and the whole Brief follows "say
    nothing rather than claim nothing". The rand total is a filtered SUM over
    findings that carry a figure; an unpriced finding contributes nothing and is
    not counted as R0 (the same reason `rankFindings` sorts nulls last rather
    than as zero). "read overnight" reuses `countSinceSastMidnight`, the same
    derivation the receipts band's own line quotes, so the two cannot disagree.
11. **The column heads are `aria-hidden`.** This is a grid of divs, not a
    `<table>` (the rows have to stack on a phone), so the heads cannot be
    associated with cells anyway and would be read out as a stray line of nouns.
    Each cell says what it is instead: the figure carries "≈…/yr", the evidence
    cell a noun, the time cell an `sr-only` "Found", the dot an `sr-only`
    status. The heads are also hidden below `sm`, where there are no columns.
12. **Dismiss is `useStatusWrite`, imported from `FindingCard`** — not
    reimplemented. Two places that can dismiss a finding must not be able to
    drift into dismissing it differently; W3's detail page set that precedent.
    "Discuss" is deliberately NOT on a row: a per-row chat button on
    twenty-three rows is noise, and the row opens the finding, which has one.
13. **Mobile stacks by wrapping, not by a second layout.** One markup: a
    wrapping flex line below `sm` (the headline takes `basis:calc(100% - 1.25rem)`
    beside the dot, so figure/evidence/time/Dismiss land on the line under it)
    that becomes the grid at `sm` (`basis` is ignored on a grid item). Verified
    at 375px.
14. **Printable, cheaply**: rows are `break-inside-avoid`, and Dismiss and the
    back link are `print:hidden` — a printed report should not offer buttons.

## Gates

`npx tsc --noEmit`, `npm test` **401/401**, `npm run build` (**no new routes** —
`view` is still a search param), `npx eslint .` **50 errors / 38 warnings,
identical to the pre-wave baseline**; every file touched here lints clean on its
own.

CAVEAT ON THE SHARED TREE: from ~09:56 a second session began editing
`lib/ai/finch/{config,knowledge,tools}.ts` and `lib/platform/{price-watch,
stock-cover}/detect.ts` in this same working copy (adding a `procurepulse`
agent module), and its half-finished state fails `tsc` on `knowledge.ts`. Those
files are NOT part of this commit and the failures are confined to them. The
gate numbers above were therefore taken twice: once in this tree before that
session started, and once after the commit in a clean `git worktree` at the
committed SHA, where nothing of theirs is present.

Runtime: `/app` and `/app?view=all` were exercised against a dev server
unauthenticated — both 307 to `/login` with no server error, which proves the
new server modules evaluate. The report's own layout was checked by rendering
its exact markup and Tailwind classes in the browser at 1180px and at 375px
(nine realistic rows across three agents); the bird was checked white-on-blue at
15/17/19/21px in a 24px disc, and at the dock, avatar and panel sizes. Anything
role- or data-dependent still needs a signed-in session.


## Finch read tools P1.2 — price history, stock position, margin exposure (2026-08-18, branch `main`)

Implements `.ai/plan_finch_read_tools_p12.md` in full. Four tools, two new data
modules, one new agent module, a rehearsal script.

### Tools

| tool | input | output | module(s) |
| --- | --- | --- | --- |
| `pw_find_items` | `{query}` | ≤6 catalogue items, each with the suppliers/market agents who have INVOICED it, point count and `last_seen` | brief, orderflow, procurepulse |
| `pw_get_price_history` | `{pw_item_id, supplier_id?, months?=6}` | ≤4 series (one per supplier × market agent), each ≤24 dated points, `first/last/delta_pct`, `median_60d`, `delta_vs_median_pct`, volume, ≤6 evidence document ids | brief, orderflow, procurepulse |
| `pp_get_stock_position` | `{query?, only_at_risk?=false}` | ≤12 lines: on hand, threshold, `consumption_30d`, `days_of_cover`, `ok/low/out`, `variance_30d` | brief, procurepulse |
| `pw_margin_exposure` | `{pw_item_id, supplier_id?}` | per-unit delta, annual cost delta, recipes the line feeds, `margin_effect: 'not_linked' \| {…}` | brief, orderflow |

Gating: price history and stock are **operational** — no `canSeeMoney` check, and
`pp_get_stock_position` deliberately returns no rand figure at all, which is what
keeps that honest (`avg_unit_price` is never read). `pw_margin_exposure` is
**admin-only**, refused before any query runs, same shape as the debtors tools.

### Decisions the plan left open

1. **`procurepulse` became a real `AgentModule`.** The plan asks for
   `TOOLS_BY_MODULE.procurepulse` and a `PROCUREPULSE_KNOWLEDGE` doc, and
   `AgentModule` is the agent's unit of knowledge (doc + tool set) — so
   ProcurePulse earned an entry by acquiring one. `AGENT_MODULE_ROUTES` gains
   `/app/procurepulse`, and `tests/finch-module-route.test.ts`'s assertion that
   that route falls to `brief` was updated (it was correct until this wave; the
   rule did not change, ProcurePulse did). PricePilot and the rest still fall to
   the cross-module agent.
2. **Median maths imported, not copied — which meant three `export` keywords in
   `lib/platform/price-watch/detect.ts`** (`MEDIAN_WINDOW_DAYS`, `medianOf`,
   `trailingAnnualUnits`). The plan lists that file under "do not touch" AND asks
   the tools to reuse its median; export-widening is the smallest way to satisfy
   both — zero behaviour change, `tests/price-watch-detect.test.ts` unchanged and
   green.
3. **The annual figure uses `trailingAnnualUnits`, not `shapeSeries.monthlyVolume`.**
   Two honest volume windows exist in the repo (a fixed trailing 12 weeks in
   detect.ts, the last 90 days in series.ts) and they disagree by ~40 % on the
   Meridian oil series. The Brief's card is built on the first, and the owner
   reads the card and the chat in the same minute, so the tool uses the same one:
   `annual_cost_delta` comes out at exactly the card's R360 937.
   `monthly_volume_estimate` (the plan's field name) is that annual figure ÷ 12,
   so the two cannot drift.
4. **`tallyMovements` extracted from `lib/platform/stock-cover/detect.ts`** (pure
   refactor, no behaviour change) so the tool's `consumption_30d` and
   `variance_30d` are the agent's own numbers rather than a second tally.
5. **Recipe linking is by NAME CORE, not `matchByName`.** `pw_items` is named by
   the Price Watch matcher off supplier descriptions ("Cooking oil (5L)");
   `pp_stock_items` is named by the owner ("Cooking Oil (4×5L case)"). A
   substring rule misses that pair in both directions. `itemNameCore` strips the
   pack-size parenthetical and all punctuation, then requires **exact equality of
   the resulting core, ≥4 characters, and exactly one candidate** — ambiguity is
   a non-match, because picking the first would attach a margin claim to the
   wrong product.
6. **`uses_per_month` and `sale_price` are always null.** Vyso stores no batch
   counts and no per-recipe sale price. The fields exist because the plan names
   them; they are null because that is the only true value, and the knowledge doc
   tells the model to say what it cannot work out rather than multiply its way to
   a margin percentage.
7. **The optional finch-suggestions chip was NOT built.** The plan marks it
   "only if trivial"; it is not — the chip row has per-source quotas, a 4-chip
   cap and label dedupe, all pinned by `tests/finch-suggestions.test.ts`. Left
   for a wave that wants it.
8. **The two data modules carry no `server-only` and no `@/` alias** (relative
   `.ts` imports, like `lib/platform/orderflow-debtors.ts`) so `node --test` can
   load them and pin the shaping. The `server-only` fence stays on
   `lib/ai/finch/tools.ts`, the only importer.

### Files

Created: `lib/ai/finch/price-watch-data.ts`, `lib/ai/finch/procurepulse-data.ts`,
`tests/finch-price-watch-data.test.ts`, `tests/finch-procurepulse-data.test.ts`,
`scripts/finch-rehearsal.md`.
Modified: `lib/ai/finch/{tools,knowledge,config,module-route}.ts`,
`app/api/ai/agent/route.ts` (`TOOL_ACTIVITY` only),
`lib/platform/price-watch/detect.ts` (exports only),
`lib/platform/stock-cover/detect.ts` (tally extraction),
`tests/finch-module-route.test.ts`.

### Gates

`npx tsc --noEmit` clean · `npm test` 433 pass / 0 fail (401 + 32 new) ·
`npm run build` clean · `npm run lint` 50 errors, 38 warnings — unchanged from
baseline, every touched file lints clean (the 50 are pre-existing, incl. the
`no-assign-module-variable` error on the route this wave edited).

Not verified: nothing here has been run against a live Meridian. That is what
`scripts/finch-rehearsal.md` is for — four questions with the expected facts
pulled from `supabase/demo-refresh-2026-08.sql`, including the reminder that
`pw_*` is written by the Price Watch RUN, not by the seed, so the price
questions answer "not switched on yet" until the agent has run once.

---

## Finch read tools — rehearsal fixes (P1.2b)

Josh ran `scripts/finch-rehearsal.md` against the live Meridian org as admin.
Three of the four questions failed, in three unrelated ways. This wave is those
three causes and nothing else.

### 1. "What will I run out of this week?" answered with the wrong twelve lines

**Cause.** The live org carries `pp_stock_items` rows outside the seed's 32: no
low threshold, nothing on hand, historic consumption in the ledger, no receipts.
`daysOfCover(0, usage)` is **0** for every one of them, and the ranking was
purely `days_of_cover asc` — so twelve dormant rows (Garlic-Whole,
Lettuce-Iceberg, Avocado, Brinjals, Danya, Mint…) took every slot under the
twelve-line cap and **all five** lines the demo is built on fell off the end.
Nothing was numerically wrong; the ordering was, and the cap turned a bad
ordering into a wrong answer.

**Fix** (`lib/ai/finch/procurepulse-data.ts`):

- `isNotStocked` — no threshold set **and** nothing on hand **and** no receipt in
  90 days. All three, because any one of them failing means it is a real line: a
  threshold is a human watching it, stock on hand means it exists, a receipt
  means it is being bought. Those lines are dropped from both lists and reported
  as a **count**, `not_stocked_hidden`, which the knowledge doc turns into one
  closing sentence ("16 other lines have no threshold set, so I've left them
  out"). Naming a line in `query` still answers about it — the filter is on the
  LIST, never on the catalogue.
- Ranking is now **configured before unconfigured** (threshold > 0 first), then
  how soon, then `out` before `low` before `ok`, then name. `urgency()` treats an
  `out` line as 0 whatever the ledger says — "you have none" is today's problem —
  while `days_of_cover` itself stays **null** on that line, so the model still
  says the cover is unknown. The two are different questions and were being
  answered with one number.
- The movement read widened 30 → **90 days** for `receiptedItemIds` only. The
  usage tally is untouched: `tallyMovements` windows itself to 30, and widening
  that would move every days-of-cover figure on the platform, including the
  Brief's cards.
- A row with a NULL threshold is no longer dropped from the read — it is
  threshold 0, "nobody has set one". `isNotStocked` needs to see those rows to
  be able to count them.

`shapeStockPosition` now returns `{ lines, not_stocked_hidden }` rather than an
array; the tests use a `linesOf(...)` wrapper where they only care about the
lines.

### 2. The margin answer said "your recipes don't reference cooking oil"

Two independent bugs, one sentence.

**Cause A — the first call failed outright.** `pw_margin_exposure`'s
`supplier_id` was sent as the supplier's **name** ("Riebeek Oils & Fats"),
mid-conversation, which the tool description invites. `.eq('supplier_id', <name>)`
reaches Postgres as a uuid comparison and raises **22P02**, so supabase-js
returned an **error, not an empty result**, and `readSeries` answered
`read_failed: "The price history could not be read."` The model reported that as
"it isn't finding the item" — about an item it had read four invoices for a
minute earlier. `tests/finch-price-watch-data.test.ts` reproduces exactly that
shape (a fake db that errors the moment a `supplier_id` filter reaches it).

**Fix.** `isUuid()` drops a filter that cannot possibly be an id **before** the
query, and a real-but-unmatched uuid falls back to the unfiltered read rather
than reporting "no lines for this item". Either way the result carries
`supplier_filter: 'ignored' | 'not_matched'`, and the knowledge doc tells the
model it is then looking at ALL suppliers and must not attribute the figure to
one. A supplier filter is a refinement of a question the wide read can answer;
it must never be able to lose the answer.

**Cause B — one stray catalogue row made the link "ambiguous".** `linkStockItem`
required **exactly one** name-core candidate, and the live org has a second
"cooking oil" row. Ambiguity fell through to `margin_effect: 'not_linked'`,
whose knowledge-doc wording is "your recipes don't reference this line yet" — a
confident **false statement** about a line feeding three recipes. Silence is not
a safe default when the fallback wording asserts something.

**Fix.** `stockNameCoreMatches` + `resolveStockLink` replace it. With more than
one candidate (and only then — the extra reads cost nothing on a healthy
catalogue) the tool reads `pp_stock_thresholds`, `pp_recipe_ingredients` and
positive `pp_movements` for those ids and prefers the line the business
demonstrably uses, then the one holding more stock (a null level is unknown and
never beats a known one). Only a genuine tie returns a third `margin_effect`
variant, `reason: 'ambiguous_stock_line'`, carrying the candidate NAMES — and
`ok` stays true with the full cost figure, because the R360 937 is priced off
invoices, not off the stock line. The knowledge doc maps it to "I couldn't tell
which stock line is the oil — you have two: X and Y."

> Deviation from the brief, on purpose: the ask was `{ok:false, reason}` for the
> ambiguous case. Refusing there would drop the annual cost figure — the actual
> answer to "how is the oil increase hitting my margin?", and the number the
> rehearsal checks against the Brief card. The reason string exists and is
> mapped; it rides inside `margin_effect` so the honest partial answer survives.

### 3. Narration was glued into the answer

**Cause.** The agentic loop accumulated every text delta of every turn into one
string. A turn that ends in `tool_use` can still emit text first, so the owner
read *"I'll look up the cooking oil price history and see who else supplies
it.Now let me get the price history over the past 12 months.Cooking Oil is up
19%…"* — three turns, no separator, the first two in the future tense about work
already finished.

**Fix.** `lib/ai/finch/narration.ts` — pure, no imports, shared by the route
(server) and the provider (client) so the transcript and the stored row cannot
disagree about what Finch said.

- The route keeps text **per turn** and marks a turn `interim` the moment its
  `stop_reason` proves it was on its way to a tool. Text deltas now carry
  `{ text, turn }`, and `{ interim: n }` retro-classifies turn n. `splitTurnText`
  gives the answer; **only that is persisted**.
- The provider keeps a turn-keyed map and re-derives `streamText` /
  `streamInterim` on every event. An older server (no `turn`) reads as turn 0,
  never interim — the wire stays backwards-compatible.
- `ChatTranscript` draws interim text as **muted italic lines under the ✦
  block**, live only. They are deliberately never stored: "let me get the price
  history" is not something Finch should still be saying next week.
- `dedupeConsecutive` collapses a repeated status line. The route stops sending
  the repeat; `ToolStatusLines` also dedupes on render, so a chat stored **before**
  this fix (the rehearsal's own doubled "Sizing the margin effect…") reads
  correctly on reopen. Consecutive only — the same tool after a different one is
  a real second look.
- Side bug found and fixed: the route streams `{tool}` as a human sentence while
  the SERVER stores raw tool names, and `toolLine()` title-cased whatever it got
  → "Sizing The Margin Effect……" live, "Pw Margin Exposure…" on reload. It now
  passes through anything that is not a bare snake_case identifier, and the four
  P1.2 tool names were added to `TOOL_LINES`.

### 4. Diagnostic SQL (not run)

`scripts/demo-stray-stock-lines.sql`. Part (A) is read-only: Meridian's
`pp_stock_items` outside the seed's 32 **literal** uuids (written out, not
prefix-matched — a LIKE would spare a 33rd row created in the same shape, which
is exactly what is being hunted), with on-hand, both thresholds, movement /
receipt / recipe / order / supplier counts and `created_at`; plus a
`hidden_by_finch` figure that must agree with the tool's `not_stocked_hidden`.
Part (B) is a **commented-out** transactional delete of those rows and their
`pp_movements` / `pp_stock_thresholds` / `pp_item_suppliers`, skipping anything
referenced by `pp_recipe_ingredients` or `pp_stock_order_items` — both FKs are
`on delete set null`, so a reference does not block the delete, it silently
orphans the link. Nothing in this file has been run against any database.

### Files

Created: `lib/ai/finch/narration.ts`, `tests/finch-narration.test.ts`,
`scripts/demo-stray-stock-lines.sql`.
Modified: `lib/ai/finch/{procurepulse-data,price-watch-data,tools,knowledge}.ts`,
`app/api/ai/agent/route.ts`,
`components/platform/chat/{ChatTranscript,ToolStatusLine,chat-display,ChatView}.tsx`,
`components/platform/shell/{FinchChatProvider,FinchBubble,GlobalChatDock}.tsx`,
`tests/finch-{price-watch,procurepulse}-data.test.ts`,
`scripts/finch-rehearsal.md`.

### Gates

`npx tsc --noEmit` clean · `npm test` **459 pass / 0 fail** (433 + 26 new) ·
`npm run build` clean · `npm run lint` 50 errors, 38 warnings — byte-identical to
the pre-wave baseline, every touched file clean bar the pre-existing
`no-assign-module-variable` on the agent route.

Not verified: none of this has been run against the live Meridian org.
`scripts/finch-rehearsal.md` now states the exact wording each fix should
produce — including what a PASS looks like when the org still has unconfigured
catalogue rows in it.

---

# Brief schedules — per-user morning/evening briefs by email (2026-08-18, branch `main`)

Implements `.ai/plan_brief_schedules.md` in full: Josh's ask on 2026-08-18 —
"a setting that lets users choose how often to receive brief notifications, what
time of day they want them at… one to view overnight changes in the morning, and
one after work to view how the day went".

Nothing in `lib/platform/*watch*/`, `lib/platform/stock-cover/*`,
`lib/platform/doc-watch/*`, the price-watch/doc-watch/debtors/stock-cover agent
routes, `components/finch/*`, the chat shell or marketing was touched (plan §4).
The only pre-existing agent route modified is `/api/agents/digest`, which the
plan asks for.

## Files

Created:
`supabase/brief-schedules.sql`,
`lib/platform/brief-schedules-shared.ts` (pure),
`lib/platform/brief-email-shared.ts` (pure),
`lib/platform/brief-schedules.ts` (RLS data module),
`lib/platform/brief-notify.ts` (service role I/O),
`app/api/agents/brief-notify/route.ts`,
`app/api/settings/brief-schedules/route.ts`,
`components/platform/settings/BriefNotifications.tsx`,
`tests/brief-schedules.test.ts`, `tests/brief-email.test.ts`.

Modified: `lib/platform/sast.ts` (two new readings of the same clock),
`app/app/settings/page.tsx` (mount, admin-only),
`app/api/agents/digest/route.ts` (stand down per org; helpers imported not
duplicated), `vercel.json` (`*/15 * * * *`), `docs/demo-runbook.md` (§3.3).

## Verified before designing the send path: where the recipient's address lives

The plan told the implementer to establish this rather than assume it, and the
answer changes the whole route.

**`profiles` has no email column.** `Profile` in `lib/platform/types.ts` is
`id, org_id, full_name, role, avatar_url, created_at`; `app/app/organisation/
page.tsx` — the members list, the one screen that would show an address if one
existed — selects `id, full_name, role, created_at` and renders initials off
`full_name`; there is no checked-in DDL for the table (AUDIT_FINDINGS.md) to
contradict either. `supabase/tns-users-roles.sql` settles it: it links people to
profiles by looking their email up in **`auth.users`**, and its prerequisite note
says auth users cannot be created from SQL at all.

**So the cron reads `auth.admin.getUserById`, which needs the service role** —
which this route needed anyway for `brief_schedules` (a cron has no session for
RLS to key off). Read at SEND time, never copied onto the schedule row: a stored
address is one more copy to go stale the day someone changes their login, and a
brief is not something to send to an address the user has stopped reading. The
settings card shows `session.email` instead — same value, from the session the
page already has, no admin call on a render path.

## Decisions the plan left open

**The lookback replaces the "last successful run per org" cursor.** Plan §5 asks
for a window measured "since the last successful run for this org, capped at 60
min". That needs a cursor table, and a cursor is a second thing that must not
lie. It is not needed: because `unique (schedule_id, local_date)` already makes a
send idempotent, the window can simply be a CONSTANT one-hour lookback
(`DUE_LOOKBACK_MINUTES`). A slot gets four chances (07:00, 07:15, 07:30, 07:45)
and the delivery row guarantees exactly one email. Widening the window can only
make the feature more reliable; it cannot make it send twice. Same behaviour the
plan asked for, one table fewer.

**Gate 4 — a slot saved after its own time today does not fire.** The lookback
cannot distinguish "we missed this" from "this did not exist yet", so a user who
saved a 07:00 slot at 07:20 would receive their "overnight brief" forty seconds
later. Comparing the row's own `created_at` against the slot time in SAST
separates them exactly. Not in the plan; pinned by a test, because it is the
first thing anyone setting this up will experience.

**A Save preserves row identity; it is not delete-then-insert.** The plan says
"replace-all semantics", which is the API's contract and is kept — but
implementing it literally would have been a data-loss bug:
`brief_deliveries.schedule_id` cascades, so wiping the schedules on every Save
would destroy the delivery history that "since your last brief" reads and that
stops a slot re-sending. Rows the body still names by id are UPDATEd, rows it
does not are deleted, new ones inserted. Editing 07:00 to 07:15 keeps its
history; deleting the slot discards it, which is what deleting should mean.

**"Resolved / dismissed since your last brief" is NOT reported, because it
cannot be proved.** `agent_findings` has no `updated_at` and no `resolved_at`
(`supabase/agents-price-watch.sql`): a row that is closed now carries no record
of WHEN it closed. The plan asked for "findings created / resolved / dismissed
since the previous delivery". Created is exact (`created_at` is real) and is
reported; resolved/dismissed is not derivable and would have had to be
approximated, which the Brief's one rule forbids. What IS provable is reported
instead, and is why `brief_deliveries.finding_ids` exists: *"3 of the 4 items in
it now closed"*. The copy never claims a time.

**The email is sent even when there is nothing to report — the opposite of the
Monday digest's rule, deliberately.** The digest sends nothing rather than train
its reader to archive it unread. This one arrives at a time the reader picked, so
silence is indistinguishable from a cron that has stopped, which is the failure
this feature can least afford. Zero open findings gets a real sentence
("nothing needs your attention this morning"), not "0 things need your
attention".

**The email does not resolve cited documents' TYPES.** The Brief's own
`resolveEvidence` reads the documents to say "2 statements" rather than "2
documents". That is one extra read per finding on a path that runs every fifteen
minutes, to sharpen a noun by one word. `documentEvidenceLabel` — the same
function — already produces the honest catch-all for an unknown set, so the email
can never invent a noun the Brief would not use. Stock and invoice nouns are
exact, because those need no read.

**`escapeHtml` and `formatRand` moved out of the digest route rather than being
copied.** The plan says "reuse its helpers rather than a second renderer". Two
emails legitimately need two templates — a weekly operator digest and a personal
brief are different documents — so what is shared is the helpers, now in
`brief-email-shared.ts` and imported by both. **The comment they arrived with was
wrong**: it claimed `formatRand` produces "R 12,480", and en-ZA groups thousands
with a SPACE. Behaviour unchanged (it is right for a South African reader), the
comment corrected, and `tests/brief-email.test.ts` now pins it — which means the
digest's own formatting is under test for the first time.

**The four-slot cap is enforced in TypeScript, not Postgres.** "At most 4 rows
per user" needs a statement trigger (a check constraint cannot see other rows),
and a trigger fires on the demo seed and on any future backfill as well as on the
settings card. The cap is a product decision about how many emails a day is
reasonable, not an integrity rule — a fifth row would be untidy, not corrupt.

**Two new readings of the SAST clock, in `sast.ts` rather than beside the
schedules.** `sastMinutesOfDay` (an hour alone would fire a 17:30 slot at 17:00)
and `sastWeekday` (derived from `sastDay`, so a schedule can never disagree with
the date line printed at the top of the same email). `sastHour` is untouched.
`sastMinutesOfDay` uses `hourCycle: 'h23'` + `formatToParts` rather than
`hour12: false`, which has historically rendered midnight as "24" in some ICU
builds — that would put 00:10 twenty-four hours from 00:00 and silently kill
every early-morning brief.

**`brief_deliveries` is SELECT-only under RLS.** Every write is a record of an
email the server sent; a client that could insert one could silence its own
brief. Its `user_id` is deliberately not an FK to `profiles`, so the record of
what was sent survives the person leaving.

**No `?now=` and no `?force=` on the cron route.** The plan argues itself out of
both in §6 and the conclusion is kept: a query parameter that changes which
emails go out will eventually be pasted into a browser by someone debugging at
07:05. Test sends go through the settings card, which is rate-limited (3/hour/
user), addressed to the caller alone, and writes no delivery row.

**The settings route uses `resolveUser`, not `getPlatformSession`.** Same reason
`app/api/finch/chats/route.ts` does: it is a route a client component posts to,
and the mobile app's bearer token has to work there too. `canSeeBrief` is
enforced in the route as well as at send time and at mount; hiding the card from
a member is the courtesy, the route is the control.

## Edge cases covered (plan §5)

| Case | Behaviour |
|---|---|
| User demoted to member | `canSeeBrief` re-checked at send time; slots skipped, counted in `skipped` |
| User removed | `brief_schedules.user_id` cascades from `profiles` |
| Two slots at the same time | ONE email (`groupDueSlots`); every slot in the group gets a delivery row |
| Partial delivery rows for a group | Rows backfilled, email NOT re-sent — a duplicate brief is the worse wrong |
| Cron 20 min late | Still sends (one-hour lookback) |
| Cron runs 4× in the hour | Sends once (delivery row) |
| A 23:50 slot missed until 00:05 | Skipped — the SAST day rolled over and the email's content is "today" |
| Org not in the allowlist | Nothing, 200, and the message names both env vars |
| Resend failure | No delivery row, logged, retried on the next tick inside the window |
| Test send | Ignores days and time, writes no delivery row, goes to the session's address only |
| Migration not applied | Card explains itself; tick answers `{"tableMissing":true}`; digest keeps working |
| Two due slots for one person on one tick | Second email measures "since" from the first (`loadSince(before)`) |

## Known cost, flagged rather than fixed

`brief-schedules-shared.ts` is imported by the client card (for `MAX_SLOTS`,
`WEEKDAY_LABELS`, `daysLabel`, `kindLabel`, `defaultSlots`) and therefore pulls
`agents/finding-kinds.ts` → `agents/dedupe-keys.ts` into the settings bundle, for
`sinceLastBrief`'s receipt test — which only the server calls. Both are
dependency-free leaves of a few hundred bytes. Splitting the file three ways to
save that would cost more in readability than it saves in bytes; duplicating
`isInformationalFinding` to avoid the import would be worse than either.

## SQL Josh must paste

`supabase/brief-schedules.sql` — idempotent, safe to re-run. Nothing works until
it is run, and nothing breaks before it is: the settings card says it is not set
up and the cron answers `{"tableMissing":true}`.

## Gates

`npx tsc --noEmit` clean · `npm test` **484 pass / 0 fail** (460 + 24 new) ·
`npm run build` clean, listing `/api/agents/brief-notify` and
`/api/settings/brief-schedules` · `npx eslint .` **50 errors, 40 warnings** —
byte-identical to the pre-wave baseline, nothing new introduced.

Not verified: nothing here has been run against a live database or sent a real
email. `runBriefNotify`, `sendTestBrief` and the data module are I/O and are not
unit tested by design; every decision they make is, in the two `-shared` modules.

---

# Plugins X1 — Xero (rail section, plugin pages, nightly sync + mirror, Xero Watch, Finch snapshot) (2026-08-19, branch `main`)

Implements **wave X1 only** of `.ai/plan_plugins_xero.md`. X2 (Hubdoc
cross-upload) is a placeholder card on the plugin page, as the plan asks.

Josh's ask, verbatim (2026-08-18): "a separate section for integrations that has
all integrations in one place (call the section Plugins, just above the under the
hood section) that highlights findings, cross uploads invoices to HubDoc, and has
an agent flag any issues. We'll do this just for Xero for now".

Nothing in `lib/platform/price-watch/*`, `lib/platform/debtors-watch/*`,
`lib/platform/stock-cover/*`, `components/finch/*`, `app/globals.css` or the
marketing site was touched. `lib/platform/xero-core.ts` is untouched (plan §
"Do not touch"). The only pre-existing agent file modified is
`lib/platform/doc-watch/detect.ts`, and only to add two `export` keywords — see
"Deviations" below.

## Files

Created:
`lib/platform/plugins.ts` (pure),
`lib/platform/plugins-data.ts`,
`lib/platform/xero-sync-shared.ts` (pure),
`lib/platform/xero-sync.ts`,
`lib/platform/xero-mirror.ts`,
`lib/platform/xero-watch/{detect,run}.ts`,
`lib/ai/finch/xero-data.ts`,
`app/app/plugins/page.tsx`, `app/app/plugins/xero/page.tsx`,
`app/api/integrations/xero/sync/route.ts`,
`app/api/agents/xero-watch/route.ts`,
`components/platform/shell/Plugins.tsx`,
`components/platform/plugins/{PluginCard,XeroConnection,XeroSnapshot,XeroFindings}.tsx`,
`supabase/xero-sync.sql`,
`tests/{plugins,xero-sync,xero-watch-detect}.test.ts`.

Modified: `components/platform/shell/{AppRail,MobileTopBar,MobileDrawer}.tsx`,
`app/app/layout.tsx` (one extra read, skipped for members),
`app/app/settings/page.tsx` (link instead of card),
`app/app/finding/[id]/page.tsx` (the Xero subject strip),
`lib/platform/agents/{dedupe-keys,finding-kinds}.ts`,
`lib/platform/agent-findings.ts` (Xero evidence, feed + detail),
`lib/platform/xero.ts` (one new export, one changed return path),
`lib/platform/doc-watch/detect.ts` (two `export` keywords),
`components/platform/brief/brief-display.ts` (the chip),
`lib/ai/finch/{tools,knowledge}.ts`,
`app/api/integrations/xero/{connect,callback}/route.ts` (return path),
`vercel.json` (2 crons), `.env.example` (the five Xero names — they were NOT
there), `docs/demo-runbook.md` (§1, §3, §3.2, new §3.4).

Deleted: `components/platform/settings/XeroIntegrationCard.tsx` — moved to
`components/platform/plugins/XeroConnection.tsx` (git records it as a rename).

## Decisions the plan left open

**The registry carries no per-plugin icon.** The plan's sketch had one; the row it
feeds already carries a status dot, which is the thing an owner scans the section
for, and a glyph beside a one-row list is decoration this brand does not spend.
A one-line addition when a second plugin needs telling apart.

**Three tones, not five statuses.** `xero_connections.status` has five values and
the rail has one dot. `syncing` draws as connected (a dot that flicked amber for
the length of a sync would teach the owner to distrust the colour); `error` and
`reauth_required` are one thing to a person; `disconnected` and "no row" are the
same fact. Unknown values fail to grey, never to green.

**`Plugins.tsx` copies `UnderTheHood.tsx` rather than sharing a `<RailSection>`.**
They differ in exactly the thing an abstraction would parameterise (status dots
here, a lock branch and a modal there), so the shared version's body would be two
`if`s on which caller it has. Extract on the third section.

**The OAuth round-trip was repointed at the plugin page.** Not in the plan's
modify list, but the plan moves the connect card off `/app/settings` and both
`/api/integrations/xero/{connect,callback}` hardcoded `/app/settings` as their
destination — an owner would have come back from Xero's consent screen to a page
that no longer mentions it, and the `?xero_connected` notice would have had
nothing to render on. `xero.ts`'s stored `return_path` default moved with them.

**The sync has NO org allowlist; the agent does.** `AGENTS_ORG_IDS` exists because
an agent writes opinions into a customer's Brief off data nobody reviewed. The
sync only copies rows the owner has already granted Vyso access to inside Xero's
own consent screen — the connection IS the opt-in, and gating it twice would mean
a customer who connects Xero and sees nothing happen. Recorded in both routes.

**The sync syncs `error` orgs, not `reauth_required` ones.** `error` means the
last read failed and tonight's run is exactly what heals it; a revoked grant needs
a human, and retrying it nightly would just rewrite the same failure.

**`recordSyncOutcome` never overwrites `reauth_required`.** That status is set by
the token path when Xero has actually revoked the grant and is the one state a
human must clear; a later run writing `error` over it would replace "reconnect
Xero" with "something went wrong".

**The cursor advances to the instant the run STARTED, not finished, and only on a
complete read.** An invoice edited while page 7 was in flight would otherwise fall
in the gap between the window asked for and the window recorded, and never be read
again. Re-reading a few rows is free; missing one is not.

**A cursor older than 14 days is ignored and the resource is read in full.** That
is what repairs a mirror which drifted while the connection was broken, and what
eventually retires rows voided in Xero months ago — nothing is ever deleted from
the mirror, because telling "deleted" from "unchanged" would need a full read
every night, which is what `If-Modified-Since` exists to avoid.

**`If-Modified-Since` is sent in Xero's format** (`2026-08-19T03:20:00`, UTC, no
zone, no milliseconds), not RFC-1123. Xero answers a full resync for anything it
cannot parse — expensive rather than wrong, i.e. exactly the bug that hides for
months. Pinned by a test.

**`Retry-After` is capped at 30s.** Xero can quote a daily-limit retry in the tens
of thousands of seconds; honouring that literally would burn the cron's whole
budget asleep instead of recording a partial sync and trying again tomorrow.

**Multi-currency: one currency, named; the rest excluded and counted.** Vyso holds
no exchange rates. `summariseXeroMirror` totals the DOMINANT currency (by row
count), reports every other as `excludedCurrencies`, and the page, the chat tool
and the agent all say so. Rows with no `CurrencyCode` ride with the dominant one,
because Xero omits it on single-currency organisations. Inventing an FX rate would
be wrong by an amount nobody can see, which is the worst kind of wrong.

**Invoice-number matching emits TWO keys** — the full alphanumeric one and the
trailing run of digits when there are ≥3 of them — so "INV-9268" on a supplier's
paper matches "9268" keyed into Xero by hand. Three digits is the floor: a
two-digit tail collides with everything, and a false "it's already in Xero" hides
a bill nobody paid. Rule 5 (duplicates) deliberately uses the STRICT key only,
because both of its rows came out of the same ledger and a loose match would
accuse the bookkeeper of a mistake they did not make.

**Rule 2's window is the document's `created_at`, not its extracted invoice date.**
The invoice date is free text in `extracted_data` in whatever format the supplier
prints; a window built on it would drift silently with every mis-parse.
`created_at` is also the honest subject: "we read this recently and it never
reached Xero".

**Rule 2 and rule 4 carry `rand_impact: null`.** `rand_impact` means "what is at
stake" everywhere else on the Brief — it orders the feed and it is the figure in
the greeting. Unrecorded paperwork is not a loss, and bills falling due on terms
you agreed are not money at risk; putting either number there would make an admin
chore or an ordinary Tuesday outrank a real problem. Both totals are in the
sentence, where they belong.

**Rule 3 suppresses itself against open `debtors_watch` findings.** Vyso's own
OrderFlow invoices and this org's Xero receivables are frequently the same debt
recorded twice. Debtors Watch keeps the card (it reads the ledger the business
operates in and can quote a balance net of payments and credit notes); Xero Watch
stands down. Matched on customer name at the same dice floor rule 2 uses.

**Rule 5's `rand_impact` is the LARGER of the two amounts, not their sum.** What is
at stake is paying one of them twice.

**`xero_invoices` gets an OWNER/ADMIN select policy, stricter than
`xero_connections`' member one.** A member may see that Xero is connected (chrome);
they may not see what is in it (money). It is the database-level twin of
`canSeeMoney`, which the routes and pages enforce on top.

**Xero is the first agent whose `evidence_refs` are not all one kind of row** —
four rules cite mirror uuids, rule 2 cites `documents.id`. The tie-breaker is the
dedupe key's rule (`xeroRefsAreDocuments`), because `evidence_refs` has no type
column and the agent slug is no longer enough. An unparseable key falls back to
the mirror, and the resolver verifies ids against the table before linking — so a
wrong guess costs a missing link, never a wrong one.

**The Xero evidence link LEAVES VYSO** (`go.xero.com`) — the only one in the
product that does, because that is where the row lives and where anything can be
done about it. The URL is recorded on the mirror row at SYNC time rather than
built at render time, so a card keeps the link that worked when it was written.
Rows without one fall back to `/app/plugins/xero`.

**The Xero strip is headed "Subject", not "Evidence"** (joining Stock Cover). "R
41 000 of bills fall due by Friday" does not have those bills as proof — it IS
them. The one rule that genuinely cites proof (rule 2, Doc-U documents) resolves as
`documents` and gets the honest "Evidence".

**The Brief chip is INFO tone, not warning.** Xero Watch mostly reports what
another system already knows and Vyso has merely noticed. Price Watch's warning
pair would put "bills fall due on Friday" at the same pitch as "your supplier put
you up 12%".

**Finch gets ONE tool, on `orderflow` and `brief`.** Five would be five decisions
the model has to make before it can answer "how are we on cash?". Most of the tool
description and the knowledge paragraph are about what NOT to say: an unsynced
mirror looks exactly like a business with no unpaid invoices, and the tool returns
`synced: false` plus a note so the model says "Vyso has not read Xero yet" rather
than making a false claim about the customer's accounting system. It is also told
never to add Xero receivables to OrderFlow invoices — frequently the same debt.

**Cron order: sync 03:20, Xero Watch 03:30**, before Doc Watch (03:40). The agent
does NOT trigger a sync: it reads whatever the 03:20 run left and rule 1 exists to
notice when that is stale. An agent that synced first would hide the failure it is
supposed to report. Both are idempotent, so the ordering is a courtesy.

## Deviations from the plan, and why

**A third test file, `tests/plugins.test.ts`.** The plan names two. The status dot
is the only thing the rail says about a connection and it says it in a colour, so
the status→tone mapping is pinned rather than trusted to a glance at a `?:` chain.

**`lib/platform/plugins-data.ts` and `lib/platform/xero-mirror.ts` are not in the
plan's file list.** The plan has the layout fetching `xero_connections.status`
"once" and the page reading the mirror, without saying where those live. Both are
I/O beside a pure, tested leaf — the same split `finding-kinds.ts` /
`agent-findings.ts` already has, and the reason is the same: `node --test` cannot
resolve `next/headers`. `xero-mirror.ts` takes a client rather than making one, so
the page (RLS), Finch (RLS) and the agent (service role) share one loader.

**`lib/platform/doc-watch/detect.ts` gained two `export` keywords.** The plan says
not to touch other agents. Rule 2 has to ask the same question of the same
`extracted_data` — "what number is on this invoice, and what is its stated
total?" — and re-implementing those label patterns beside it would mean two
definitions of how Vyso reads a document number, drifting the day extraction
learns a new label. No behaviour, no caller and no signature changed.

**`getXeroAccessTokenForOrg` was added to `lib/platform/xero.ts`.** The plan says
the sync gets its token "via `getXeroAccessToken`", which is private and takes a
context built from a signed-in session. The new export wraps it with
`userId: ''` — safe because that field is read only by the three OAuth paths
(start, consume state, record who connected), none of which is reachable from the
sync. Documented at the function.

**`/app/settings` lost its `searchParams`.** With the callback landing on the
plugin page, `?xero_connected` / `?xero_error` never arrive there again, so the
prop and the two reads it fed were removed rather than left as dead parameters.

## SQL Josh must paste

`supabase/xero-sync.sql` — idempotent, safe to re-run. Requires
`supabase/xero-integration.sql` (already applied). Nothing works until it is run
and nothing breaks before it is: the sync answers `{"tablesMissing":true}`, the
plugin page's Snapshot says the mirror is not set up, and the agent stands down
with a warning rather than raising a "nothing has synced" card that would send the
owner to reconnect a connection that is fine.

## Cron entries added to `vercel.json`

| Path | UTC | Why there |
|---|---|---|
| `/api/integrations/xero/sync` | `20 3 * * *` | before every agent — it is what fills the mirror they read |
| `/api/agents/xero-watch` | `30 3 * * *` | ten minutes after the sync, ten before Doc Watch |

## Gates

`npx tsc --noEmit` clean · `npm test` **600 pass / 0 fail** (484 + 116 new) ·
`npm run build` clean, listing `/app/plugins`, `/app/plugins/xero`,
`/api/integrations/xero/sync` and `/api/agents/xero-watch` · `npx eslint .`
**50 errors, 40 warnings** — byte-identical to the pre-wave baseline, nothing new
introduced and nothing pre-existing fixed.

## Not verified, and flagged rather than hidden

**Nothing in this wave has talked to Xero.** No test and no shell command made a
network call to `api.xero.com`, by instruction. Every payload the mappers are
tested against is a hand-built fixture written to Xero's published response shapes
for `GET /api.xro/2.0/Invoices` and `GET /api.xro/2.0/Contacts`, and the fields
relied on are listed in `xero-sync-shared.ts`'s docblock. **If the live API differs
from those fixtures, the fixtures are the first thing to correct** — they are the
specification this code was written against. The highest-risk assumption is the
.NET date serialisation (`/Date(1518685950940+0000)/`): a parser that silently
returned null there would produce a mirror with no dates, which every rule
downstream reads as "nothing is overdue" — a total failure that looks exactly like
a well-behaved business.

**Nothing has been run against a live database.** `syncXeroOrg`, `runXeroWatch`,
`xero-mirror.ts` and `plugins-data.ts` are I/O and are not unit tested by design;
every decision they make is, in `xero-sync-shared.ts`, `plugins.ts` and
`xero-watch/detect.ts`.

**The two `go.xero.com` deep-link paths are not confirmed against a live tenant.**
They are the long-standing `AccountsReceivable/View.aspx?InvoiceID=` and
`AccountsPayable/View.aspx?InvoiceID=` routes. They are stored per row at sync
time, so if Xero has moved them the fix is one function
(`xeroInvoiceUrl`) plus a resync, and old cards keep whatever was recorded.
