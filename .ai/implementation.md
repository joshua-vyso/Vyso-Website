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
