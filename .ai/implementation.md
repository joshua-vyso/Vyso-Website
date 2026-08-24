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

# Review chat — an auto-opening system chat for items needing a decision (2026-08-19, branch `main`)

Implements `.ai/plan_review_chat.md` in full.

Josh's ask, verbatim (2026-08-18): "a new chat open beneath today's brief if any
items need attention. e.g. if the system picks up a new quote request, a new chat
automatically opens called 'Review', where user can take immediate action. if any
documents are uploaded, review opens with direct link to check and approve that
doc. once all review items are done, the review chat goes away. it'll come back
when new items are ready for review. have the button itself subtly emit light
ebbing borders, as well as a small red dot similar to how notifications are
universally".

The queue is **computed** — no new table, no migration, no cron. Nothing in
`lib/platform/price-watch/*`, `lib/platform/debtors-watch/*`,
`lib/platform/stock-cover/*`, `components/finch/*`, the agents, the plugins
(X1/X2) files or the marketing site was touched.

## Files

Created:
`lib/platform/review-queue-shared.ts` (pure),
`lib/platform/review-queue.ts`,
`tests/review-queue.test.ts` (32 tests),
`app/app/chat/review/page.tsx`,
`components/platform/chat/ReviewOpening.tsx`,
`components/platform/shell/RailReview.tsx`.

Modified:
`app/app/layout.tsx` (fourth read in the same `Promise.all`; `reviewCount` to
both rail surfaces; `reviewContext` to the provider),
`components/platform/shell/{AppRail,MobileTopBar,MobileDrawer,RailNav,RailChats}.tsx`
(`reviewCount` threaded; RailChats pins the row),
`components/platform/shell/FinchChatProvider.tsx` (review prelude + per-turn
refresh on the review route),
`lib/platform/finch-chats.ts` (`getOrCreateReviewChat`),
`lib/platform/finch-chats-shared.ts` (`PRELUDE_END` exported;
`REVIEW_CHAT_MODULE`/`REVIEW_CHAT_TITLE`; `splitChats` keeps the review chat out
of the rail's recent list),
`lib/ai/finch/knowledge.ts` (a "Review" section in `BRIEF_KNOWLEDGE`),
`app/globals.css` (`@keyframes vyso-ebb` + `.vyso-ebb`, one commented block).

## The exact predicates for "needs review"

**1. Documents** — one query, `documents`, org-scoped:

```
.eq('org_id', orgId)
.in('status', ['extracted', 'pending', 'error'])
.order('created_at', { ascending: false }).limit(200)
```

then, in memory: keep a row iff `status === 'error'` **or**
`isClaimableDocument(approved_at, Date.now() - COMMIT_STALE_MS)` — i.e.
`approved_at is null`, or older than the 5-minute commit-claim window.

That is `/app/docu/awaiting`'s predicate (`status in ('extracted','pending')`)
∪ `/app/docu/flagged`'s (`status = 'error'`), with `/app/docu/review`'s **claim
guard** (`reviewClaimableOr`) carried across. Three deliberate calls:

- **`email_ingest_id is not null` is dropped.** That column is what keeps
  chat/manual uploads off `/app/docu/review` (they commit inline), but they do
  legitimately sit at `extracted`/`pending` when the commit has not happened,
  `/app/docu/awaiting` does list them, and a document dropped into Finch that
  ends up needing a decision is exactly the case the plan asks this queue to
  catch (W5 synergy). So: the broader screen's predicate.
- **The claim guard is kept.** A document someone is mid-Save on is not awaiting
  a decision; it is having one made. Applied in memory rather than as `.or()` on
  the select because the select asks for three statuses and the guard applies to
  only two — an `.or()` over the whole query would have quietly dropped any
  flagged row that happened to carry a stamp.
- **"Low confidence" is NOT a fourth predicate.** `/app/docu/confidence` *sorts*
  by confidence; it does not filter, so there is no queue there to reuse. A
  low-confidence document that needs a decision is already in by status, and its
  confidence is said in the item's detail line (`< DOC_LOW_CONFIDENCE_THRESHOLD`,
  80) instead.

One query, so a document that is both uploaded-by-chat and awaiting review
appears exactly once.

**2. Quote requests** — `of_quote_requests`, org-scoped:

```
.eq('org_id', orgId).eq('status', 'new').eq('flagged_spam', false)
.order('received_at', { ascending: false }).limit(200)
```

That is the **OrderFlow dashboard's** predicate ("real leads awaiting a quote",
`orderflow-data.ts`), not the Quotes page's, which also lists the AI-flagged
likely-spam. The Review queue's whole promise is that it empties: a bounce
message nobody will ever quote from would sit in it forever, wearing out the red
dot. Those rows are not hidden — they are still on `/app/orderflow/quotes`, which
is where a human confirms them.

**3. Price Watch is deliberately absent.** `pw_item_matches` has a
`status='review'` of its own, but there is no screen on which a human can make
that decision (a known gap). A queue row whose "Open" link goes nowhere is worse
than no row.

**Who sees it:** module access, not `canSeeMoney`. Filing an invoice and
answering an enquiry are operational work. A source is read only when
`features[key] && !lockedModules.includes(key)`; an org with neither module
makes no query at all.

## Decisions the plan left open

1. **The agent, and its tools.** The plan asks for "`brief` set + `docu` set".
   `TOOLS_BY_MODULE.brief` **already is** `DOCU_TOOLS + DEBTORS + PRICE_WATCH +
   PROCUREPULSE + MARGIN + XERO`, so `/app/chat/review` talks to the ordinary
   `'brief'` agent (`agentModuleForPathname` already returns it for every
   `/app/chat/*` route) and gets exactly what the plan asked for with **no route
   change, no new `AgentModule`, and no new tool**. There is no OrderFlow
   quote-lookup read tool, so none is wired; no write tools were added.
2. **`module='review'` is a `finch_chats` label, not an `AgentModule`.** It lives
   in `finch-chats-shared.ts` (which `review-queue-shared.ts` imports, not the
   other way round — that would be a cycle). It does two things: labels the row,
   and is what `splitChats` filters on.
3. **The row is created server-side, by the page.** `/api/finch/chats` stores an
   unknown `module` as `null` by design, so a review chat created through it
   would come back unlabelled and reappear in the rail's recent list.
   `getOrCreateReviewChat` calls `createChat` directly.
4. **Reuse window = `RECENT_WINDOW_DAYS` (14).** The plan asked for "reuse if
   active in the last 14 d, else create a new one" and for it to be recorded:
   `shouldReuseReviewChat` is that rule, taking the window as a parameter so the
   rail's constant is the single source. An unparseable `updated_at` is *reused* —
   a second row every visit is the worse failure.
5. **The row is titled `Review` at creation**, not left to the agent route's
   auto-titler (which names a chat after its first question — a fine title for a
   chat and a poor name for a standing queue). `setChatTitle` is a no-op on a row
   that already has one, so it sticks, and History shows "Review". The plan's
   "(closed)" suffix was **not** implemented: nothing else in History is
   suffixed, and a stored title cannot know whether the queue is empty right now.
6. **The review chat is in neither rail list while it is current.** It has its
   own pinned row; listing it again among the recent chats would be two rows for
   one conversation, and the second would survive the morning the first correctly
   disappears. Once past 14 days it is an ordinary old conversation and *does*
   appear in History.
7. **One prelude per screen, never both.** `reviewContext` replaces (not
   supplements) the Brief's findings on `/app/chat/review` — the owner is asking
   about the list in front of them, and shipping both would spend the turn's
   whole character budget on preamble. Capped at 4,000 chars, framed as data,
   and it ends with the **same** marker the Brief's prelude does, which is now
   exported as `PRELUDE_END` — so `stripBriefPrelude` strips it back off before
   the message is stored, with no change to `/api/ai/agent`.
8. **The page re-reads the queue** even though the layout just did. Layouts do
   not re-render on client-side navigation, so the layout's copy can be minutes
   old by the time someone walks back from Doc-U — and a card listing a document
   they have just approved is the one thing this screen must never do.
9. **`router.refresh()` on EVERY turn taken on the review route** (elsewhere it
   still fires once per chat). The opening card is the live queue; without this
   it would keep offering an item dealt with in another tab.
10. **The opening card is drawn above the transcript, not stored as a first
    assistant turn.** A stored turn would say "3 items" forever.
11. **Red dot count lives in `aria-label`, not on screen.** A numeral in a 216px
    row beside the Brief's open count and History's would read as a third badge
    of the same kind; this one is not the same kind.
12. **Cap 25**, overflow link to `/app/docu/review`. Counts are taken *before*
    the cap — a dot stuck on "25" is a dot the owner learns to ignore.

## The ebbing border

`@keyframes vyso-ebb` in `app/globals.css`: `border-color` between
`rgba(62,143,224,0.35)` and `0.85`, plus a `box-shadow` spread from `0` to `3px`
at `0.10` alpha. **Border + box-shadow only — no gradient fill.**
`.finch-gradient` is rationed to the surfaces that *are* Finch; a rail row
painted in it would be claiming to be the agent rather than a list of the
owner's own outstanding decisions. 2.4s, matching `.vyso-pulse` so the rail's two
continuous loops breathe together. Under `prefers-reduced-motion: reduce` the
animation is off and `.vyso-ebb`'s static `1px solid rgba(62,143,224,0.55)`
border remains, as does the red dot — the information survives, only the motion
goes.

## Edge cases (plan §"Edge cases")

- Queue changes while open → the card is server-rendered per visit, and the
  provider refreshes after every turn on this route.
- Approve on Doc-U and come back → the count drops; at zero the rail row is gone
  and the route draws "Nothing to review — all clear" (a screen, not a redirect:
  the only ways to arrive are a bookmark, a second tab, or Back).
- Two users → one review chat each (`user_id` filter, as everywhere else in
  `finch_chats`).
- A doc both uploaded-by-chat and awaiting review → one query, so once.
- Queue > 25 → "and N more →" to `/app/docu/review`.
- No Doc-U / no OrderFlow (or locked) → that source is skipped entirely.
- `finch_chats` migration missing → `getOrCreateReviewChat` returns null, the
  opening card still renders and the shell's composer still works (starting an
  ordinary chat), exactly the W1 degrade.
- Every source failure is independent: a broken `of_quote_requests` costs the
  documents half of nothing.

## Gates

- `npx tsc --noEmit` — clean. (Two transient errors appeared mid-run from the
  concurrent Hubdoc X2 work in `app/app/docu/[id]/page.tsx` and
  `app/app/plugins/xero/page.tsx`; retried after 30 s and the tree was clean.
  Neither was in a Review file.)
- `npm test` — **633 pass, 0 fail** (601 before, 32 new in
  `tests/review-queue.test.ts`).
- `npm run build` — succeeds; the route manifest lists `ƒ /app/chat/review`.
- `npm run lint` — 50 errors / 40 warnings, at the ≤50 ceiling. **None** of them
  are in a file this wave created or modified.

## Not verified, and flagged rather than hidden

**Nothing has been run against a live database.** `loadReviewQueue` and
`getOrCreateReviewChat` are I/O and are not unit tested by design; every decision
they make is, in `review-queue-shared.ts`. The W6 click list below has not been
walked on a real org.

**The `supplier:suppliers(name)` embed** on the documents select follows the same
shape the three Doc-U pages already use (`supplier:suppliers(id,name,initials)`).
If PostgREST returns it as an array on some deployment, `reviewDocumentTitle`
falls through to the filename rather than throwing — the failure mode is a
duller title, not a broken card.

---

# Plugins X2 — Hubdoc cross-upload (settings, send-to-Hubdoc, auto-forward, log) (2026-08-19, branch `main`)

Implements **wave X2 only** of `.ai/plan_plugins_xero.md`, on top of X1. The
placeholder card X1 left on `/app/plugins/xero` is now the feature.

Josh's ask, verbatim (2026-08-18), of which this is the middle third: "a separate
section for integrations that has all integrations in one place (call the section
Plugins, just above the under the hood section) that highlights findings, **cross
uploads invoices to HubDoc**, and has an agent flag any issues".

## What it does

Hubdoc has no public write API. Its supported intake is **email** — every Hubdoc
organisation has an "upload by email" address (Hubdoc → the org's settings →
"Upload by email"), and a document attached to a message sent there is filed for
coding into Xero. So the cross-upload is exactly one thing: an email through
Resend with the original file attached, `attachments: [{ filename, content }]`
with `content` a base64 string (verified against `node_modules/resend`'s
`Attachment` interface, which types it `string | Buffer`).

Three ways a document gets there, and **all three are a person or a switch a
person set**:
1. **A button on the document's own page** (`/app/docu/[id]`, top-right action
   row) — one press, admin only.
2. **"Send to Hubdoc" / "Send all N" on the plugin page's "Not in Xero yet"
   list** — the same bills Xero Watch's rule 2 names, now actionable.
3. **The org-level auto-forward toggle**, DEFAULT OFF, which fires from
   `app/api/ai/extract/route.ts`'s `after()` the moment Doc-U finishes reading a
   supplier invoice.

Every attempt — sent or failed, by hand or automatic — writes a row to
`hubdoc_forwards` and is listed under the toggle that authorised it.

## Files

Created:
`supabase/hubdoc.sql`,
`lib/platform/hubdoc-shared.ts` (pure),
`lib/platform/hubdoc.ts`,
`app/api/integrations/hubdoc/{settings,send}/route.ts`,
`components/platform/plugins/{HubdocCard,XeroMissingBills}.tsx`,
`components/platform/docu/SendToHubdoc.tsx`,
`tests/hubdoc.test.ts`.

Modified: `app/app/plugins/xero/page.tsx` (placeholder → two sections, four more
reads), `app/app/docu/[id]/page.tsx` (the control's gates), `components/platform/
docu/DocumentDetailPanel.tsx` (one prop, one control in the action row),
`app/api/ai/extract/route.ts` (one `after()`), `lib/platform/xero-mirror.ts`
(`loadNotInXeroBills`), `lib/platform/xero-watch/run.ts` (one `export`, one
parameter type), `docs/demo-runbook.md` (new §3.5).

Nothing in `components/platform/shell/*`, `app/app/layout.tsx`, `app/app/chat/
review/*`, `lib/platform/review-queue*.ts`, `lib/platform/finch-chats.ts`,
`lib/ai/finch/knowledge.ts` or `app/globals.css` was touched — the Review chat
wave was landing concurrently and owns those.

## Decisions the plan left open

**The `unique (document_id)` constraint became a PARTIAL unique index.** The plan
asked for `unique (document_id)` *and* for "Send again" to insert a second row.
Both cannot be true. The constraint is therefore narrowed to what the rule
actually means — `unique (document_id) where resend = false and status = 'sent'`
— which makes the two things Vyso must never do impossible at the database level
(an auto-forward racing a button cannot double-post a bill; a doubled cron cannot
either) while still allowing the two it must do: retry a send that FAILED, and
honour an owner who explicitly asks again. `forwardDocumentToHubdoc` checks the
same fact before sending, so a duplicate is never discovered *after* delivery.

**"Not customer-side" is read as "has a resolved `supplier_id`".** The plan says
supplier invoices and statements, "not customer-side", without saying how a row
is known to be one. `document_type in ('invoice','statement')` covers the type;
`supplier_id` covers the side. A document that has been through extraction has
had its supplier resolved by `resolveSupplierProfile`, which deliberately never
lets the org's own name become a supplier — so a row with no supplier is either
the business's own outgoing paper or a scan nobody could read a counterparty off.
Neither belongs in a bookkeeper's supplier inbox, and the subject line would have
nothing to name it with.

**A non-Hubdoc intake domain WARNS rather than refuses.** The plan allows it; the
reasons are that Hubdoc has changed its intake domain before and that some
businesses deliberately point this at their own bookkeeper. The warning is
recomputed on every render rather than stored — a warning frozen into a row would
outlive the reason for it.

**Clearing the address turns auto-forward off, in the same write**, and the
toggle is disabled until an address exists. A standing instruction with nowhere
to send does nothing but write a failed row on every upload.

**The service role is used on BOTH send paths, including the signed-in one.** The
auto path runs inside `after()` on an extraction request any MEMBER may have
made, so gating the log write on the caller's role would mean a member's upload
quietly failing to honour an instruction their owner gave. The org id comes from
the session (or, for the cron-less auto path, from the document's own row as the
route already resolved it) and every statement pins `.eq('org_id', orgId)` by
hand. Same argument `app/api/integrations/xero/sync/route.ts` makes.

**One send route for one document and for many.** The per-document button, the
per-row button and "Send all N" are the same act repeated, so they post the same
`documentIds` array to one endpoint — a separate bulk route would be a second
place four gates have to be right. Serial, not parallel: parallel sends would
race the already-sent check. Capped at 25 per request and 60 per org per hour.

**Partial success is reported as partial success** (200, with `sent`, `skipped`
and per-document results). Reporting a batch where three of four went as a
failure invites a retry that re-sends the three — they would be caught, but a UI
that teaches people to retry a completed action will eventually double-post
something.

**The document-page control renders only when it would work** — admin, Xero
connected, intake address set. A disabled button on a document detail page
invites the click that proves it does nothing, and Plugins → Xero is the screen
whose job is explaining the setup. The one exception is a document that cannot go
for its OWN reasons (wrong type, no supplier, not read, no file): there the
sentence replaces the button, because that is information the owner did not have.

**A DEGRADED Xero connection still shows the control.** `error` and
`reauth_required` mean the ledger cannot be read; Hubdoc is a different system on
a different transport, and hiding the way to file a bill because a token expired
would punish the owner for the outage. Only "not connected at all" removes it.

**"Send again" lives on the document page, never on the bulk list.** A second
copy of a bill in a bookkeeper's inbox costs somebody real time, so the person
choosing it should be looking at the document while they choose.

**No Finch tool, as the plan decided** — and no knowledge paragraph either. The
plan's X2 section registers no tool ("**No** — outbound; keep it a button") and
asks for no knowledge; adding one would have meant touching
`lib/ai/finch/knowledge.ts`, which the concurrent Review wave owns. An outbound
send is not something a chat model gets to decide, which is the same drafts-only
line the outreach module already holds.

**The subject is "{Supplier} — invoice {number}", with no "Vyso" in it.** That is
the order a bookkeeper searches in, and a constant word at the front of every
subject makes every subject start the same way. "Vyso" is in the From name
instead. The body is three lines of plain text: no HTML, no branding, no tracking
pixel — a filing inbox is read by a machine and, when something goes wrong, by a
person.

**The attachment filename is sanitised** (last path segment, control characters
and `" ' ;` stripped, truncated to 120) because it is written into a MIME header
and then onto somebody's disk, and a Vyso filename is whatever the uploader
called it. The extension is preserved: a PDF that arrives as `invoice` is a PDF
nobody can open.

**15 MB ceiling on the attachment**, matching the extract route's own
`MAX_EXTRACT_BYTES` rather than Resend's 40 MB. A document too big for Vyso to
read is not one it should be posting into somebody's accounting inbox, and the
buffer is base64'd in memory (a third bigger again) inside a serverless function.
Over the limit is a logged failure with both figures in the sentence.

**"Not in Xero yet" shows nothing at all before the first sync.** Every Doc-U
invoice would technically be unmatched against an empty mirror, and a page
offering to post a business's entire filing cabinet into their bookkeeper's inbox
is the single worst thing this feature could do. `tableMissing` and "mirror
empty" both render as "Vyso has not read your Xero ledger yet".

**The Hubdoc card sits BELOW the missing-bills list**, not above it. That is the
order an owner arrives in — "Xero Watch told me four bills are missing" — and the
list's empty state points down at the card when no address is set.

## Deviations from the plan, and why

**`lib/platform/hubdoc-shared.ts` is not in the plan's file list.** The plan names
`lib/platform/hubdoc.ts` alone. Every decision that makes a send WRONG (should
this document have gone; where did it go; what does the message say) is pure, and
`node --test` cannot import `hubdoc.ts` at all — it pulls in `server-only`,
`resend` and a Supabase client. The split is the same one `xero-sync-shared.ts`
has beside `xero-sync.ts`, and it is what makes the plan's "tests: pure
eligibility + subject builder" possible rather than aspirational.

**`buildHubdocEmail` is in the pure module too**, so the exact payload Resend is
handed — the base64 attachment shape, the single recipient, the ABSENCE of
reply-to/cc/bcc — is pinned by a test rather than by reading the send function.
The plan's "Resend call mocked" is honoured more strongly than asked: **no test
imports `resend` at all**, and the send itself is behind `sendThroughResend`,
reachable only from `forwardDocumentToHubdoc`, reachable only from a route. No
email was sent by any test or shell command in this wave.

**`loadNotInXeroBills` was added to `lib/platform/xero-mirror.ts`, and
`loadDocuSupplierInvoices` was exported from `lib/platform/xero-watch/run.ts`.**
The plan asks for a "Not in Xero yet" list on the plugin page without saying
where it comes from. It has to be the SAME answer rule 2 gives — same loader,
same matcher, same 45-day window — because a reconciliation screen that disagrees
with the agent that sent you to it is worse than no screen. The loader's fourth
parameter changed from the run summary to a bare `string[]` so the page can pass
an array it drops; no behaviour, no other caller and no signature beyond that
changed.

**`components/platform/docu/DocumentDetailPanel.tsx` gained one optional prop.**
The plan says "a 'Send to Hubdoc' button on `/app/docu/[id]`" without saying
where. The header action row (beside "Push to…", the type and folder pickers) is
where every other action on that page lives; rendering it above the panel instead
would have been a second action area on a screen that already has one. It sits
FIRST in the row because it is the only action there that leaves Vyso.

**`HubdocDocumentState` is declared in `SendToHubdoc.tsx`, not in the page.** A
Next route file may only export the names the framework knows about; a stray
`export interface` in `page.tsx` is a build error, not a shared type.

## SQL Josh must paste

`supabase/hubdoc.sql` — idempotent, safe to re-run. Requires
`supabase/xero-integration.sql` and `supabase/xero-sync.sql` (both already
applied). Nothing works until it is run and nothing breaks before it is: the
Hubdoc card says the tables are missing, every send refuses with the same
sentence, and the auto-forward path reads "not configured" and does nothing.

Two tables: `org_integrations_hubdoc` (org_id pk, intake_email, auto_forward
default **false**, updated_by, updated_at) and `hubdoc_forwards` (the receipts).
Both are OWNER/ADMIN select, service-role write — the same model
`supabase/xero-sync.sql` uses, for the same reason.

## Gates

`npx tsc --noEmit` clean · `npm test` **663 pass / 0 fail** (633 before this wave
— 601 at X1 plus 32 from the concurrent Review wave — and **30 new** in
`tests/hubdoc.test.ts`) · `npm run build` clean, the route manifest listing
`ƒ /api/integrations/hubdoc/send` and `ƒ /api/integrations/hubdoc/settings` ·
`npx eslint .` **50 errors, 40 warnings** — byte-identical to the pre-wave
baseline; **none** of them are in a file this wave created or modified.

## Not verified, and flagged rather than hidden

**No email has been sent.** Not by a test, not by a shell command, not to a real
Hubdoc inbox. The Resend call shape is verified against the installed package's
types and pinned by a test on `buildHubdocEmail`; whether Hubdoc *accepts* a
message in this shape has not been observed and cannot be until Josh points a
real intake address at it. The first live send is the thing to watch.

**Nothing has been run against a live database.** `lib/platform/hubdoc.ts` is I/O
and is not unit tested by design; every decision it makes is tested in
`hubdoc-shared.ts`. In particular the partial unique index
(`hubdoc_forwards_one_per_document`) has not been exercised — its behaviour under
a genuine race is reasoned about, not observed.

**The auto-forward path has never fired.** It is one `after()` callback gated on
a flag that no org has set. The gate is the first statement in
`autoForwardDocumentToHubdoc` and returns before touching the document, so an org
that has not opted in pays one small select and nothing else — but "an org that
HAS opted in gets exactly one email per invoice" is an assertion about a code
path nobody has walked.

**Storage downloads of large or unusual files.** The 15 MB check reads
`file.size` from the Storage blob; a Storage backend that returned a zero size
would let an oversized file through to Resend, which would reject it, which would
be logged as a failure. Acceptable, but untested.

## The click-through to walk first

1. Paste `supabase/hubdoc.sql`.
2. Plugins → Xero → Hubdoc → paste the intake address (Hubdoc → org settings →
   "Upload by email") → Save. Expect no warning if it ends `@upload.hubdoc.com`.
3. Open a Doc-U supplier invoice that has been read and has a supplier matched.
   Expect **Send to Hubdoc** top-right. Press it.
4. Expect: a row in the Hubdoc card's log marked **Sent**, and the email in the
   Hubdoc inbox with the original file attached and the subject
   "{Supplier} — invoice {number}".
5. Press again on the same document: expect "Sent to Hubdoc" and a "Send again"
   link, and a second log row marked **Sent again** only if you press it.
6. Leave the auto-forward toggle OFF until step 4 has been seen to work.

---

# Agents: all orgs — every organisation by default, plus a time-budget guard (2026-08-19, branch `main`)

Josh's rule: **all agents need to be available on each org id.** Until now every
`/api/agents/*` route read an OPT-IN allowlist (`AGENTS_ORG_IDS`, falling back to
`PRICE_WATCH_ORG_IDS`), and an unset var meant `{ran: 0}`. That was right when
Price Watch was one agent pointed at one org; it is wrong now that the agents ARE
the product, because it makes a paying customer's empty Brief look identical to a
healthy system.

## What changed

**`lib/platform/agents/org-allowlist.ts`** — the source of truth is now the
`organisations` table, ordered by `created_at` (oldest first, so the time budget
drops a predictable tail rather than a random org). `agentOrgIds(supabase, env?)`
is async and takes the service-role client. Three vars can only ever NARROW it:

- `AGENTS_ORG_EXCLUDE` — uuids to skip. The escape hatch, and the only one
  production is ever expected to set.
- `AGENTS_ORG_IDS` / `PRICE_WATCH_ORG_IDS` — an OPTIONAL restriction for a
  developer or a staging deploy. **Production leaves both unset.**

The restriction is INTERSECTED with the table rather than used verbatim, so an id
that names no organisation is reported as `orgs.notFound` instead of being handed
to an agent — which is what a typo in Vercel used to look like: `ran: 1` having
done nothing. A missing `organisations` relation is empty and FLAGGED
(`tableMissing`), never a throw, exactly like `agent-findings.ts` and
`brief-schedules.ts`. `NO_ORGS_MESSAGE` is replaced by `noOrgsMessage(orgs)`,
which names the thing an operator would have to change in each of the five cases.

The decisions are pure (`selectAgentOrgs`) and separated from the read.

**`lib/platform/agents/time-budget.ts`** (new) — `startTimeBudget(maxDuration)`
with an injectable clock. A route stops STARTING orgs once elapsed crosses
`maxDuration − 30s` and reports the rest as `orgsSkippedForTime`. It is a "may I
start another?" question and NEVER a cancellation: cutting an org off halfway is
how half a Brief gets written. The failure it prevents is not corruption — every
run is idempotent — it is a killed invocation that returns no JSON at all, which
is indistinguishable from a broken cron.

**All seven routes** (`price-watch`, `debtors-watch`, `stock-cover`, `doc-watch`,
`xero-watch`, `digest`, `brief-notify`) take the new signature, keep their
per-org try/catch, and now also carry the budget guard and return
`orgsSkippedForTime`, `elapsedMs` and the `orgs` selection in their JSON. The
digest's loop gained an OUTER try/catch it never had — it was the one route where
an unexpected throw in a single org killed the rest of the week's digests.

`/api/integrations/xero/sync` is untouched: it has no allowlist by design and
still runs for every org that has connected Xero.

## Decisions

**Price Watch's per-org work is unchanged.** It is the slow one — Claude matches
for every unseen line description — and the temptation was to parallelise. Serial
is still what the rate limit wants at this org count, so the budget guard is the
whole change. The route now carries a comment saying that per-org fan-out (one
invocation per org, dispatched) is the next step, and that
`orgsSkippedForTime` going routinely non-empty is the signal to do it.

**Doc Watch's skip is the expensive one, and is flagged in the route.** Its sweep
window is 26 hours, so an org skipped for a full day has a gap tomorrow's run
cannot see. Most documents are unaffected (the primary trigger writes their card
at extraction time inside `after()`), but one ingested by email or WhatsApp on a
skipped day would get no receipt.

**The digest is where "all orgs" actually leaves the platform, and that is
flagged in the route rather than quietly shipped.** Its semantics are otherwise
unchanged — still nothing sent unless `PRICE_WATCH_DIGEST_TO` is set, still only
for orgs with no per-user schedules, still max five non-informational findings —
but a new org with findings now mails ITS supplier prices to Vyso's own inbox.
That was already true of every allowlisted org; it is the first thing that must
change when this route stops being a fallback.

**Brief-notify's semantics are untouched.** It still sends only where somebody
created a schedule and a slot is due; an org that has never opened the settings
card costs one indexed read. Widening the org source is precisely what makes a
NEW org's first schedule work without an env var edit.

## Files

- `lib/platform/agents/org-allowlist.ts` — rewritten
- `lib/platform/agents/time-budget.ts` — new
- `app/api/agents/{price-watch,debtors-watch,stock-cover,doc-watch,xero-watch,digest,brief-notify}/route.ts`
- `tests/agents-org-allowlist.test.ts` — rewritten (21 tests)
- `tests/agents-time-budget.test.ts` — new (7 tests)
- `.env.example`, `docs/demo-runbook.md`

## What Josh must do in Vercel

**Delete `AGENTS_ORG_IDS` and `PRICE_WATCH_ORG_IDS`.** While either is set, the
agents still run for only the org it names — the code is live but the old var
keeps the old behaviour. Nothing needs to be added; `AGENTS_ORG_EXCLUDE` stays
unset.

## Gates

`npx tsc --noEmit` clean · `npm test` **684 pass / 0 fail** (663 before; the 7
old allowlist tests were replaced by 21, and 7 are new in
`tests/agents-time-budget.test.ts`) · `npm run build` clean · `npx eslint .` **50
errors, 40 warnings** — byte-identical to the pre-change baseline, none in a file
this change touched.

## Not verified, and flagged rather than hidden

**Nothing has been run against a live database.** `agentOrgIds`'s read is I/O and
is not unit tested by design; every decision it makes is tested in
`selectAgentOrgs`. In particular, how many organisations are actually in
production — and therefore whether any route comes near its time budget — has not
been observed. The first live run's `ran` and `elapsedMs` are the numbers to look
at.

**The time budget has never fired in production.** Its boundary is pinned by
tests against an injected clock; a real invocation being killed at `maxDuration`
despite the 30s reserve (one org that takes longer than the reserve) remains
possible and would look exactly like today's failure mode, for one org instead of
the whole run.


# Review v2 — grouped chain, split-view detail, batch + master approvals (2026-08-19, branch `main`)

Implements `.ai/plan_review_v2.md` in full.

Josh's ask, verbatim (2026-08-19): "review chain needs automatic approvals.
grouped by module, then subgrouped by task (quotes separated from new orders).
batch approve button for each task, on each module and a master 'approve all' at
the top. clicking an item expands that block in place (not a new page) showing
the original document and key items (total, date, confidence…; for quotes:
message body, email, 'add new customer' which adds them to OrderFlow). 'view in
{module}' for line-by-line. review chain centred on open, moves left and the
expanded view appears on the right; close returns it to centre in a fluid
animation".

Still no `review_items` table, still no migration, still no cron: the queue is
computed exactly as v1 computed it. What is new is that the chain can now WRITE —
and every one of those writes is a call into the module that owns it.

## Every approval, and the function it delegates to

| Item | Action | Calls |
| --- | --- | --- |
| document | Approve | `commitDocument` — `lib/platform/document-ingest.ts` |
| document | Reject | `discardDocument` — same file (factored out of `/api/docu/review`) |
| quote request | Dismiss | `status:'dismissed'` — the Quotes screen's own patch |
| quote request | Add as new customer | the `of_customers` insert + `logActivity` the Customers screen runs |

`discardDocument` did not exist before this wave: the UPDATE was inline in
`app/api/docu/review/route.ts`. It was lifted out **unchanged** — same patch,
same three predicates (`org_id`, `status in ('extracted','pending')`, the
`reviewClaimableOr` claim guard), same 404 sentence — and that route now calls
it. One write path, not two opinions about what "discard" means.

`hubdocForDocument` moved the same way, from a private helper in
`app/app/docu/[id]/page.tsx` to `hubdocStateForDocument` in
`lib/platform/hubdoc.ts`, so the pane's "Send to Hubdoc" renders on exactly X2's
gates. A route file cannot export a helper, so the alternative was a second copy
of the three gates — which is how a control ends up appearing on one screen and
not the other for the same document.

## Files

Created:
`lib/platform/review-actions-shared.ts` (pure),
`lib/platform/review-actions.ts` (the writes + the pane's payload),
`tests/review-actions.test.ts` (40 tests),
`app/api/review/{approve,customer,item}/route.ts`,
`components/platform/review/{ReviewChain,ReviewGroup,ReviewItemRow,ReviewPane,
DocumentReviewPane,QuoteReviewPane,ApproveAllButton}.tsx`,
`components/platform/docu/DocumentPreview.tsx`.

Modified:
`lib/platform/review-queue-shared.ts` (module/task grouping; `module`/`task` on
every item; `withReviewFocus`), `lib/platform/document-ingest.ts`
(`discardDocument`), `lib/platform/hubdoc.ts` (`hubdocStateForDocument`),
`app/api/docu/review/route.ts` (discard → the shared function),
`app/app/docu/[id]/page.tsx` (helper removed, import added),
`components/platform/docu/DocumentDetailPanel.tsx` (preview → the shared
component), `app/app/chat/review/page.tsx` (chain + pane, `searchParams`),
`components/platform/shell/FinchChatProvider.tsx` (`setReviewFocus` +
`withReviewFocus` in the prelude), `app/globals.css` (one commented `.review-*`
block), `lib/ai/finch/knowledge.ts` (the Review section says batch approve
exists and still says Finch cannot approve), `tests/review-queue.test.ts`.

Deleted: `components/platform/chat/ReviewOpening.tsx` (replaced by
`ReviewChain`; nothing imported it).

Untouched, as the plan required: agents, price-watch, marketing, and Plugins
X1/X2 beyond reusing the Hubdoc button.

## Decisions the plan left open

**"New orders" is omitted, not invented.** The plan allowed the sub-group "only
if the existing data model has an unconfirmed-order concept". `of_orders.status`
has a `'draft'`, but nothing treats it as a decision queue — no screen lists
drafts awaiting confirmation, and `REVIEW_SOURCES` has no order source — so the
group would have required inventing the queue behind it.

**Low confidence is NOT folded into "Flagged".** The plan's third Doc-U task was
"Flagged / low confidence"; it ships as **"Flagged — Vyso could not read
these"**, on status alone. The two are different kinds of thing: a flagged
document is `status='error'` and `commitDocument` will not claim it, whereas a
low-confidence one is an ordinary extracted document Doc-U is perfectly willing
to approve. Folding them together would have removed the Approve button from the
documents that most deserve a quick yes. A low-confidence row stays in its type's
task and says its confidence on the row and again in the pane.

**Two tasks are therefore NOT approvable, and no batch includes them.**
`docu:flagged` (no commit path exists) and `orderflow:quotes` (OrderFlow's
actions on a lead are "draft a quote" and "dismiss" — neither is an approval, and
a batched Dismiss would bin real enquiries on one click). This is what makes the
master button's label conditional: `approveAllLabel` says "Approve all you can
(N)" whenever N is short of the queue total, which is the plan's own §3 wording
for the mixed-permission case, applied to every reason a batch can be short.

**"Mark handled" is labelled Dismiss.** `of_quote_requests.status` is
`new | quoted | dismissed`; `'quoted'` is set by the quote builder, so the only
"done" a person sets directly is `'dismissed'` — exactly what the Quotes screen's
Dismiss writes. Giving one write a second name on a second screen is the second
approval semantics the plan forbids in the sentence above it, so the module's
word wins. It confirms first, as the Quotes screen does.

**The detail payload is LAZY**, via `GET /api/review/item?kind&id`. Inline would
have meant a signed storage URL, a Doc Watch lookup and the three-read Hubdoc
gate multiplied by up to 25 rows, on a screen whose promise is that it appears
the instant something needs attention — to draw a pane the owner opens once.

**`?item=` is mirrored with `history.replaceState`, not `router.replace`.** The
INITIAL value is read on the server (`searchParams`) so a deep link and a reload
both work; the toggling afterwards is local, because pushing it through the
router would re-run the page's two Supabase reads on every expand and collapse to
change a string the server only reads once.

**The animation moves the PANE'S TRACK, not the chain.** `.review-split` is a
`justify-content:center` flex row; the pane's track transitions its `flex-basis`
from 0, and re-centring the row is what carries the chain left. No measured
width, no resize listener, no transform on the chain — and closing is the same
rule backwards. `flex-basis` is the plan's own nominated property (§1.2); the
pane itself fades and slides on opacity/transform. Reduced motion keeps every end
state and drops only the interpolation, because the arrangement IS the
information.

**A document's cross-document flags are NOT re-derived in the pane.**
`deriveFlags` needs every other document in the org — the Doc-U detail page
already loads them, a pane opened from a chat should not. The pane shows the
status reason, the confidence, and Doc Watch's own sentence when it has one, and
"View in Doc-U →" is one click away for the rest.

**A flagged document sent to `/api/review/approve` by a hand-built request gets
Doc-U's own refusal**, not a special one. The UI never offers it, and inventing a
friendlier sentence here would be a second account of what `commitDocument` did.

## Gates

`npx tsc --noEmit` clean · `npm test` **724 pass / 0 fail** (684 before; 40 new
across `tests/review-actions.test.ts` and `tests/review-queue.test.ts`) ·
`npm run build` clean, listing `/api/review/approve`, `/api/review/customer` and
`/api/review/item` · `npx eslint .` **50 errors, 40 warnings** — byte-identical
to the pre-change baseline.

## Not verified, and flagged rather than hidden

**Nothing has been run against a live database.** No approval in this wave has
been observed committing a real document: `commitDocument` and `discardDocument`
are unchanged and were already exercised by `/api/docu/review`, but the BATCH
path — twenty of them in one request, serially, with a partial failure among them
— has only been reasoned about and unit-tested at the selection/merge layer.

**The split-view motion has not been watched in a browser.** The CSS is
deterministic and the layout is described above, but "fluid" is a judgement about
a moving thing, and the only honest report is that it has not been seen moving.

# Review v2.1 — the pane owns its scroll, the page never scrolls sideways, approve returns at once (2026-08-19, branch `main`)

Five faults, reported by Josh from a client's Windows PC on a 1366px Dell at
125% OS scaling — so a viewport of roughly **1093 CSS px**, which is the number
that explains four of them. Verbatim: the chain "collapsed to one word per
line"; the header was "overlapped by the confirm banner"; "with the cursor over
the pane, the chain scrolls, not the pane"; Reconciliation "forces a horizontal
scroll of the page, squished"; and Approve "takes more than five seconds".

No new table, no migration, no queue, no agent. Every fix is in the four places
the fault actually was.

## Root causes

| # | Symptom | Cause | Where |
| --- | --- | --- | --- |
| a/e | chain one word per line; banner over the heading | the armed master button returned an ~430px `inline-flex` sibling into a wrap row whose title column was `min-w-0 flex-1` — flexbox shrank the title to min-content | `ReviewChain.tsx` header row · `ApproveAllButton.tsx` armed branch |
| b | wheel over the pane scrolls the chain; Approve unreachable | the pane card asked for `max-h-full`, which resolves to **`none`** against a parent whose own height is `auto` (the track had `max-height` only). Measured: a 726px card inside a 486px track, with `overflow:hidden` on the track silently eating 240px. The card's `overflow-y-auto` body never engaged, so the wheel found the page | `ReviewPane.tsx` · `.review-pane-track` in `globals.css` |
| c | Doc-U → Reconciliation scrolls the whole page sideways | **`<main>` has been a horizontal scroll container all along**: `overflow-y:auto` with `overflow-x` left `visible` computes the visible axis to `auto`. W0's `html, body { overflow-x: clip }` could never catch it — the scroll was inside `<main>`, not on the document | `app/app/layout.tsx` |
| c | Reconciliation "squished", last column unreachable | `min-w-[1080px]` against tracks needing 1078 + 40px of `px-5` = **1118**. The fixed tracks overflowed their own grid box by 38px, so "Closing" and "Check" drew on top of each other *and* outside the scroll container's reach (scrollWidth 1098). Seven right-aligned money columns with no gutter did the rest | `ReconciliationView.tsx` |
| d | Approve takes > 5s | the response waited for `runDocumentSideEffects` — OrderFlow order, invoice, ProcurePulse stock, SupplySync rollups — per item, serially | `/api/review/approve` → `commitDocument` |

## What changed

**Split layout.** `.review-split` is still a centred flex row, but the chain now
has a floor: `flex: 1 1 480px; min-width: 360px; max-width: 720px`, and the
pane's track opens to `flex: 0 0 clamp(380px, 42vw, 560px)`. Below **1100px** the
split stops being a split — the pane becomes a **right-hand overlay drawer** with
the shell's scrim and the same 320ms slide, and the chain gets the whole column
back. 1100 is measured, not chosen: chain 360 + gap 24 + pane 380 = 764, which
does not fit the 688px that Tailwind's `lg` (1024) leaves beside a 216px rail.
The number lives twice — `REVIEW_SPLIT_MIN` in `ReviewChain.tsx` decides which
pane is *mounted*, the media query in `globals.css` decides where it *sits* — and
the two must stay equal. The header is a plain wrapping row: the title column
carries `basis-[260px] min-w-[240px]` and the confirm banner is `w-full`, so it
takes a line of its own under the title. Nothing is absolutely positioned.

**This retires v2's bottom sheet.** The sheet was capped at 85vh and applied from
1023px down, so a 1000px laptop got a phone control. One drawer now covers every
width the split cannot fit.

**Scroll ownership.** `.review-pane` is now the flex column that OWNS the height
(`max-height: calc(100dvh - 8rem)`), and the card inside is an ordinary
shrinkable item (`min-h-0`, no `max-h-full`). The scroll then belongs to the
card's existing `min-h-0 flex-1 overflow-y-auto` body, which is what a wheel over
the pane finds first — verified by hit-testing the pane's centre and walking to
the nearest scrollable ancestor. `<main>` remains the page scroller; the chain
column still scrolls with it, and `data-lenis-prevent` is untouched (Lenis
already refuses to instantiate under `/app`).

**Horizontal overflow, platform-wide.** `<main>` is now
`overflow-y-auto overflow-x-clip` — `clip` rather than `hidden` so it adds no
scrollport and `position:sticky` inside it (the pane's track, every table header)
keeps working. Anything genuinely wider than the column must now bring its own
`overflow-x-auto`, which is the correct place for it: **the table scrolls, never
the page.** Audited every `<table>` and every `grid-cols-[…]` in
`components/platform` and `app/app`: all eight wide tables (ServiceDen outreach
/bounces/invoices, OrderFlow dashboard/builder/credit-note/invoices-v2,
ShiftBoard roster) were already inside `overflow-x-auto`; every ProcurePulse
grid and `FullBriefing`'s `BRIEFING_ROW_COLS` use `minmax(0,1fr)` and cannot
overflow. The two that needed work were Reconciliation (`min-w-max` + `gap-x-3`,
so the width is computed by the browser and adding a column cannot reintroduce
the bug) and `DocuNav` (its own `overflow-x-auto overflow-y-clip`, the clip
because each tab's `-mb-px` leaves 1px of vertical overflow that would otherwise
grow a stray scrollbar).

**Background approve.** `commitDocument` is split at the seams it already had:
`claimDocumentForCommit` → side effects → `finalizeDocumentCommit`. Doc-U's path
is **unchanged** — same order, same claim release on failure, because that
screen's Save is a person watching one document. The Review chat's route calls
`commitDocumentFast` (claim + finalize, two indexed UPDATEs, nothing else) and
hands the remainder to `runReviewFollowUps` inside Next's **`after()`**.
`approveReviewItems` returns `{ results, followUps }`; follow-ups still run
serially, because two commits for one supplier race on that supplier's price
history. The UI removes the rows on click, before the request is sent, and says
"Approving N in the background" — reconciled against a snapshot, so a refusal
puts the row back with its error.

### The trade-off, stated rather than hidden

`commitDocumentFast` **inverts the order of the two writes** relative to
`commitDocument`. A follow-up that fails therefore leaves a document at
`'approved'` with no order behind it, where Doc-U's path would have released the
claim and returned it to the queue. That is Josh's explicit call ("background
approve, but don't commit to agents watching for them or updating modules"): the
failure is a `console.error` and **nothing retries it, nothing observes it**.
`runDocumentSideEffects` is idempotent per `source_document_id`, so a manual
re-save in Doc-U heals it. Follow-up work may also land seconds after the row has
left the queue — a module screen opened immediately after a batch can show the
document approved before its order exists.

`maxDuration` stays 120s: `after()` runs inside the same invocation budget.

## Files

Modified: `app/globals.css` (the `.review-*` block, rewritten with the v2.1
reasoning kept beside v2's), `components/platform/review/{ReviewChain,ReviewPane,
ApproveAllButton}.tsx`, `app/app/layout.tsx` (`overflow-x-clip` on `<main>`),
`components/platform/docu/{ReconciliationView,DocuNav}.tsx`,
`lib/platform/document-ingest.ts` (claim/finalize/release factored out;
`commitDocumentFast` + `commitDocumentFollowUp` added; `commitDocument`
behaviourally unchanged), `lib/platform/review-actions.ts`
(`approveReviewItems` returns follow-ups; `runReviewFollowUps` added),
`app/api/review/approve/route.ts` (`after()`).

Untouched: `/api/docu/review`, `discardDocument`, the queue, the grouping, every
agent, and `lib/ai/finch/knowledge.ts` — Finch still cannot approve anything.

## Verified, and how

In a **throwaway harness** (`app/dev-review-harness/`, deleted before commit)
that reproduced the shell's exact geometry — 216px rail, `min-w-0 flex-1`
column, the real `<main>` — with 24 synthetic queue items and six synthetic
statements. Screenshots before and after in `.ai/verification/review-v2-1/`.

- **1280×720** — armed master button: heading intact, banner on its own line
  (before: "Each / of / these / is / waiting", banner over "Review · 24 items").
- **1280×720** — pane open: chain 407px, pane 538px, `trackScrollH === trackH`
  (nothing clipped), pane body `scrollHeight 633 > clientHeight 529` and the hit
  test at the pane's centre resolves to that body. Before: card 726px in a 486px
  track, body overflow zero.
- **1366×768** and **1093×614** (the client's effective viewport) — same, split
  intact, no page-level horizontal scroll.
- **1024×700** — the drawer: full height, scrim, Approve/Reject/View reachable.
- **Reconciliation, 1280×720** — `main.scrollWidth === main.clientWidth` (no page
  h-scroll); the table's own container scrolls 243px and the "Check" header is
  fully visible at the end of it. Before: grid box 1080 against content ending
  at 1118, unreachable.
- **Optimistic approve** — with the route stubbed to 2500ms, 24 rows became 9
  within one paint (262ms) and the notice read "Approving 15 in the background".

## Not verified

**Nothing has been run against a live database.** `commitDocumentFast` and
`commitDocumentFollowUp` are reasoned about and typechecked, not observed
committing a real document; the ~2s ceiling for a batch of 20 is a claim about
two indexed UPDATEs per item, not a measurement against production latency. The
`after()` callback has not been watched running after a real response.

**The motion still has not been watched moving.** The end states are
screenshotted at four widths; "fluid" remains a judgement about a moving thing.

## Gates

`npx tsc --noEmit` clean · `npm test` **724 pass / 0 fail** (no new tests: every
change is layout, orchestration, or a route's response timing — the pure layer
`tests/review-actions.test.ts` covers is untouched) · `npm run build` clean,
still listing `/api/review/{approve,customer,item}` · `npx eslint .` **50 errors,
40 warnings** — byte-identical to the pre-change baseline.

# Plugins X2 — chat hand-off ("push it to Hubdoc", with a confirm card) (2026-08-19, branch `main`)

Josh, signed in as an admin on Turn 'n Slice with the Hubdoc intake address
already saved under Plugins → Xero → Hubdoc, dropped a statement into a chat and
asked Finch to push it to Hubdoc. Finch said it couldn't. It was telling the
truth — X2 deliberately gave the send NO Finch tool ("an outbound send is not
something a chat model gets to decide", `lib/platform/hubdoc.ts`) — and it was
useless, because the product could do the thing, in two clicks, on another
screen.

## The line this wave draws

**The model prepares; a person presses.** `hubdoc_prepare_send` resolves which
documents were meant, checks each against the *same* `hubdocEligibility` the
buttons use, and returns a list plus a MASKED intake address. It sends nothing
and cannot: the send is still `forwardDocumentToHubdoc`, still reachable only
from `POST /api/integrations/hubdoc/send`, and the confirm card's button posts
there — same role gate, same rate limit, same 25-per-request cap, same
`hubdoc_forwards` log, same per-document re-check. There is no chat-specific
send path, on purpose.

So the drafts-only rule survives intact. What changed is that the press now
happens in the conversation the owner was already having, instead of after being
sent to a screen.

## Files

Created: `lib/ai/finch/hubdoc-data.ts` (the tool's reads + gates),
`components/platform/chat/HubdocConfirmCard.tsx` (the card, and `HubdocCards`,
the context-reading wrapper the two non-bubble surfaces use).

Modified: `lib/platform/hubdoc-shared.ts` (the pure half of the hand-off —
`maskHubdocIntakeEmail`, `hubdocPrepareDocuments`, `hubdocEligibleIds`,
`hubdocSentMessage`, `HUBDOC_CHAT_REFUSALS`, `HUBDOC_ALREADY_SENT_REASON`),
`lib/ai/finch/tools.ts` (`HUBDOC_TOOLS`, registered on `docu` and `brief`),
`lib/ai/finch/knowledge.ts` (`HUBDOC_KNOWLEDGE` into DOCU and BRIEF, two
amendments to `ATTACHMENT_KNOWLEDGE`, the Brief's "you write, the owner sends"
carve-out, and one clause on the system prompt's `actionLine`),
`app/api/ai/agent/route.ts` (`TOOL_ACTIVITY` label, `buildHubdocCard`, the
`{card}` SSE event), `components/platform/shell/FinchChatProvider.tsx`
(`HubdocConfirmDockCard` on the `DockCard` union, `parseCardEvent`, the `card`
event branch, `appendAssistantLine`), `components/platform/chat/OrderCards.tsx`
(one case), `components/platform/chat/ChatView.tsx` and
`components/platform/shell/GlobalChatDock.tsx` (`<HubdocCards />`),
`tests/hubdoc.test.ts` (+12).

## Decisions worth the words

**The refusals are constants, and each names its fix.** A tool that answers
"no" without saying where to go is the failure this wave exists to fix, one
level down. There are exactly five, in `HUBDOC_CHAT_REFUSALS`:

| when | what the owner is told |
| --- | --- |
| not owner/admin (`canSeeMoney`) | "Only an owner or admin can send documents to Hubdoc." |
| Xero not connected | "Xero is not connected for this business, so there is no Hubdoc hand-off yet. Connect it under Plugins → Xero." |
| no intake address | "No Hubdoc upload address is saved for this business. Add it under Plugins → Xero → Hubdoc." |
| `supabase/hubdoc.sql` not applied | "The Hubdoc tables are not in this database yet — paste supabase/hubdoc.sql into the SQL editor." |
| nothing resolved | "Tell me which document to send — attach it to this chat, or name the supplier invoice or statement you mean." |

The knowledge doc instructs the model to repeat the `reason` word for word and
not to retry, which is why they are written as sentences and not codes.

**`hubdocStateForDocument` is composed from, not called.** It answers the same
three questions for the document page's button — but with `null`, which is right
for "draw a control or don't" and wrong here, where the owner asked out loud and
deserves to know *which* of the three is missing. The tool therefore reuses its
parts (`loadHubdocSettings`, `xeroStatusTone`, `hubdocEligibility`,
`hubdocSentDocumentIds`) rather than its verdict. A degraded Xero connection
still counts as connected, for the reason that function already gives.

**The Xero check reads through the CALLER's client**, not through
`xeroConnectionStatus`, which builds a cookie-scoped client of its own — the
agent route also serves bearer-token callers, for whom that read comes back
empty and a perfectly connected org would be refused.

**The intake address is masked (`tu•••@upload.hubdoc.com`).** The local part of a
Hubdoc upload address is effectively a bearer secret: anyone holding it can file
paperwork into that organisation's books. A model turn never sees the unmasked
value — `hubdoc_prepare_send` returns only the mask, so it cannot end up in a
transcript, a title, or a log line.

**Ineligible documents stay on the card, greyed, with their reason.** Dropping
them would be quietly disagreeing with the person who named them. Already-sent is
tested LAST, after eligibility, so a document that could never have gone says why
rather than claiming it already went. `resend: true` overrides that one check and
nothing else.

**The "Sent …" line is written by the client, not by a model.** It is a fact
about what a button did, so paying a turn for it would be slower, dearer and able
to get it wrong. It is NOT persisted to `finch_messages`: the only writer of that
table is the agent route's `after()`, and opening a second door — an endpoint
that appends arbitrary assistant text to a chat — is not worth one sentence. The
durable receipt is the Hubdoc log on Plugins → Xero, which the send route writes
exactly as it always did. The card is provider state and is not persisted either,
for the same reason the order card is not.

**Three surfaces draw the card, not one.** `DockCards` (the module bubble) gained
a case; the Brief's dock panel and `/app/chat/[id]` gained `<HubdocCards />`,
which filters the provider's cards to this one kind. The order/ingest cards stay
bubble-only because they can only arise on an OrderFlow screen — a Hubdoc
hand-off is asked for wherever the owner is standing, and `/app/chat/*` is the
Brief agent's own screen.

**One clause had to go into the system prompt itself**, not only the module
reference: the Q&A `actionLine` says "You cannot TAKE ACTIONS … If asked to do
something, explain how to do it themselves", and a model reading that first will
apologise before it reaches the reference. On `brief` and `docu` it now carries
the Hubdoc exception. Promising it there costs nothing when it is unavailable —
the tool refuses with a sentence naming the fix.

## Not verified

**Nothing has been run against a live database, and no email was sent by any of
this.** The tool's reads, the SSE `card` event and the card's POST are
typechecked and reasoned about, not observed end to end. The pure half is pinned
by tests; the wiring is not.

**No tool-registration test exists to extend.** `lib/ai/finch/tools.ts` is
`server-only` and reaches Supabase, so `node --test` cannot import it; the
registry's shape is covered by `tsc` and by the route, not by a test.

## Gates

`npx tsc --noEmit` clean · `npm test` **736 pass / 0 fail** (724 + 12) ·
`npm run build` clean · `npx eslint .` **50 errors, 40 warnings** — byte-identical
to the pre-change baseline; none of the touched files contribute.

# Orbit subsite — WhatsApp operations for tradespeople, at `/orbit` (2026-08-19, branch `main`)

Plan: `.ai/plan_orbit_site.md` (approved by Josh 2026-08-19). Built in full: 24
indexable routes, a hand-built WhatsApp chat component, a scroll-driven
sequence, a dark theme scope over the existing Finch design system, and the SEO
surface (metadata, JSON-LD, sitemap, `/llms.txt`) that the plan asks for.

## Routes

Nine standing pages plus three generated sets:

`/orbit` · `/orbit/how-it-works` · `/orbit/pricing` · `/orbit/faq` ·
`/orbit/waitlist` · `/orbit/for` · `/orbit/for/[trade]` (×10) ·
`/orbit/compare/[slug]` (×2) · `/orbit/learn` · `/orbit/learn/[slug]` (×3).

All 24 prerender at build time; `generateStaticParams` on each dynamic segment
returns a closed list, so the build output *is* the route list.

## Decisions the plan left open

**Two routes the plan did not name.** `/orbit/for` and `/orbit/learn` exist as
hubs. The plan lists `/orbit/for/[trade]` and a "For trades ▾" nav item but no
parent, and lists three articles under `/orbit/learn/*` but no index — a nav
item whose parent path 404s is a hole, and ten (or three) leaf pages with no
shared parent are orphans in the internal link graph. Both hubs are one screen,
carry `CollectionPage` + `ItemList`, and are in the sitemap.

**`.orbit-site` remaps the paper roles only, and `--fn-ink` is deliberately not
one of them.** `--fn-ink` looks like "the text colour" and on the Finch surface
it is — but it is also the *fill* of every `ground="ink"` band (`Band.tsx`'s
`SURFACE.ink` is `bg-fn-ink`). Remapping it to warm-white would have turned
every dark band on the subsite into a paper one. So the ink and blue ground
ramps are used exactly as the Finch system defines them, and only `--fn-bg`,
`--fn-surface(-2)`, `--fn-line*`, `--fn-muted*`, `--fn-faint` and `--fn-ink-2/-3`
move. The `--ob-*` palette itself sits on `:root`, not on the scope, because
the canvas devices resolve their stroke colour against `document.documentElement`
(`ground/canvas-stage.ts`) and would never see a scoped value.

**No `underNav` on any Orbit hero.** `Band`'s `underNav` pulls a dark hero up by
`FinchNav`'s measured height (76/92px). `OrbitNav` is 62/78px tall, so that pull
clipped 14px off the top of the hero. It is not needed: `.orbit-site` paints
`--ob-bg` on the shell, so the nav already stands on the hero band's own colour.

**`OrbitNav` is labelled `aria-label="Orbit"`, not `"Primary"`.** `globals.css`
inverts `nav[aria-label="Primary"]` over dark bands, including
`filter: invert(1)` on any `<img>` inside it — a rule written because the Vyso
wordmark is dark artwork. Orbit's wordmark is *already* the light variant, so
that filter would have inverted it back to near-black. Labelling the landmark
`Orbit` opts the whole nav out of a paper-first rule and states its colours once.

**"Adjacent bands never share a ground" is honoured by fill, not by name.**
The design system has two dark grounds and Orbit has no paper one, so
consecutive `ground="ink"` bands alternate between `--ob-bg` and `--ob-bg-2`.
`ground` stays accurate for `NavGround`'s sake even where `className` sets the
fill.

**The hairline is once per page, at the close.** §2 rules the orange→blue
`SeamHairline` to one per page; it lives in `WaitlistBand`, which every page
ends on, and nowhere else.

**Pricing: no offer was invented.** The plan asked whether waitlist members get
a first month free. Absent a decision, the site says the true thing — joining
the waitlist locks founding pricing — and `/orbit/pricing` states explicitly
that there is no free month, discount or trial *because none has been decided*.
VAT is quoted as `ORBIT.price.vatNote`: "VAT-inclusive pricing confirmed at
launch."

**The email field is optional; WhatsApp is required.** The plan asks for an
optional email, and `/api/contact` required one. Rather than add a second
mail-sending endpoint, that handler gained an `isOrbit` branch: name +
`whatsapp` are the required set, `email` is validated only when present, the
auto-reply is skipped when there is no address, and Orbit gets its own short
auto-reply instead of the standing "book a 15-minute call" one — which is the
wrong thing to send someone who joined a waitlist for an unreleased product.
Two new capped/escaped fields, `trade` and `city`. Finch's three variants are
byte-for-byte unchanged in their required set, subject lines and reply.

**The OG lockup is drawn, not loaded.** `public/orbit/orbit-primary-dark.svg` is
a 4.5KB vector trace; getting it into satori means either reading `public/` at
render time or pasting thousands of path coordinates into a source file.
`lib/og/orbit.tsx` rebuilds the mark from an arc and a dot and sets "rbit" in
STIX beside it — which is what the logo does, the mark replacing the O. It is a
reconstruction of the lockup, not a copy of the artwork.

**Two extra files beyond the plan's list.** `lib/analytics.ts` gains
`orbit_waitlist_submit` (carrying the trade **slug** only — never a typed
field). `components/finch/FinchFooter.tsx` gains one "Orbit" link beside the nav
link the plan asks for, so the subsite is reachable from the bottom of every
marketing page as well as the top.

## The WhatsApp phone

`components/orbit/WhatsAppPhone.tsx`, hand-built in HTML/CSS: status bar,
header with avatar and "online", an abstract doodle wallpaper as a CSS
background tile (ours — not a trace of Meta's artwork), outgoing green bubbles
with read ticks, incoming white bubbles with structured label/value rows,
in-bubble timestamps, an inert compose bar and a home indicator, inside a frame
with a dynamic island. No screenshots of any real client anywhere on the
subsite; `ORBIT.trademark` is rendered in the footer of every page.

The module carries **no `"use client"` directive** on purpose: `OrbitSequence`
(a client component) and eight server pages import the same `Bubble`,
`ChatHeader` and `PhoneFrame`, so the two renders cannot drift. The frame is
`role="img"` with each script's own `alt` — a screen reader gets one sentence
describing the conversation rather than a stream of bubbles and tick glyphs,
while the text stays in the DOM for crawlers.

Every conversation comes from `lib/orbit/sequences.ts` or a trade's own `chat`;
no chat copy is written inline anywhere. Times are strings, never `new Date()`.

## The sequence

`components/orbit/OrbitSequence.tsx`: a 320vh wrapper with a sticky stage, the
phone on the left playing the flagship exchange as `scrollYProgress` advances,
and the job record + draft invoice assembling on the right. Same mechanism as
`ScrollSequence` (`useScroll` + `useTransform`), with three differences, all
documented in the file: it is shorter, it is direction-agnostic (a conversation
reads one way), and the stage is a flex layout rather than a fixed 1160×710
canvas scaled to fit — the chat text *is* the content and must not render at
0.7×.

**The first message and the record column's heading are not beats.** The first
version revealed all four messages, which meant the pinned stage opened on an
empty phone next to an empty column. The tradesperson's message is the premise;
Orbit's answers are what is worth revealing.

Storyboard fallback on the server render, below `lg`, under reduced motion, and
on viewports under 760px tall (where a sticky 100vh stage would clip the phone).

## Verification

`.ai/verification/orbit/` — 57 screenshots plus two text reports. Captured by
driving headless Chrome over CDP with Node 22's built-in `WebSocket` (no new
dependency): every one of the 22 crawlable routes at 1440×900 and 390×844, four
scrubbed frames of the sequence (t=0.25/0.50/0.75/1.0), the reduced-motion
storyboard at both widths, and seven OG images at 1200×630. Desktop shots are
downscaled to 1152 and everything is JPEG, to keep the folder at 5.2MB.

`crawl-and-jsonld.txt` — 32 URLs reached by following every internal link out of
the nine Orbit seeds, **all 200**; a head-tag table (every title ≤ 59 characters
rendered, every description ≤ 155, exactly one `<h1>`, canonical + OG + Twitter
on all 22, `robots: index, follow` everywhere); every `application/ld+json`
block parsed; and a check that **every Orbit offer node is `PreOrder`** — the
site-wide Finch/audit offers stay `InStock`, correctly, since those are things
you can buy today. 22 Orbit URLs in the sitemap, all resolving; `## Orbit`
sections present in both `/llms.txt` and `/llms-full.txt`.

The crawl is what caught four trade titles over the 60-character budget once the
root layout's " | Vyso" suffix was added; `Trade.metaTitle` now documents the
53-character ceiling.

**The waitlist form was not submitted.** `/api/contact` sends real mail through
Resend, so only client-side validation was exercised: the empty form is invalid,
`name`/`trade`/`whatsapp` are the required set, an empty email is valid and a
malformed one is not, every input has a matching `<label for>`, and clicking
submit on an incomplete form fires **no** network request (verified by wrapping
`window.fetch` and observing zero calls).

`lighthouse.txt` — against `npm run start` on a local production build.

## Not verified

**No email has been sent and nothing has been posted to `/api/contact`.** The
`isOrbit` branch in that route is typechecked and reasoned about, not observed:
no test covers it (the handler reaches Resend and the rate limiter, so
`node --test` cannot import it) and submitting the form would have mailed a real
person.

**The mobile Lighthouse score is 79, against §9's ≥ 90 target.** The Finch
homepage measures 78 on the same server, and the FCP (1.2s), LCP (5.6s) and CLS
(0) are identical across `/`, `/orbit` and `/orbit/pricing` — so this is the
shared font/JS payload and the absence of a CDN in front of localhost, not
something Orbit added. It is not a regression, and it is not a pass either;
the target is a production-environment measurement that has not been taken.

**The OG images were rendered and looked at, never fetched by a real crawler.**
`lib/og/fonts.ts` fetches from Google on first render and falls back silently;
that fallback path was not exercised.

## Gates

`npx tsc --noEmit` clean · `npm test` **736 pass / 0 fail** (unchanged — no test
covers marketing pages) · `npm run build` clean, all 24 Orbit routes prerendered
· `npm run lint` **50 errors, 40 warnings**, byte-identical to the pre-change
baseline; `npx eslint app/orbit components/orbit lib/orbit lib/og/orbit.tsx`
reports **zero** problems.

# Orbit v2 — a real phone, one company lockup, soft seams, faster scroll (2026-08-19, branch `main`)

Josh's review of the live Orbit pages, four notes, all four fixed. The phone and
the lockup are component changes; the seams are a stylesheet block; the scroll is
one number in the sequence plus a second Lenis mode.

## 1. "You've made a half phone"

`components/orbit/WhatsAppPhone.tsx` sized its screen by its contents, so
`HERO_GLIMPSE` (two messages) drew a 320×350 slab. A phone is 19.5:9.

The screen is now a fixed box — `PHONE_SCREEN_W` 300 × `PHONE_SCREEN_H` 649,
which is 390×844 logical points to the pixel of rounding — inside a 10px bezel on
**all four** sides, so the frame is 320×669. Inside it is a flex column: status
bar, chat header, the conversation, compose bar, home indicator.

- **The conversation is the only thing that flexes** (`flex-1 min-h-0
  justify-end overflow-hidden`). Wallpaper runs header-to-compose-bar whatever
  the script is; a short script sits on the bottom edge with wallpaper above it,
  which is what a real thread looks like; a long one scrolls off the top.
  `Bubble` and `DayChip` gained `shrink-0` so they clip rather than squash.
- **The home indicator moved out of the compose bar** into its own strip at the
  bottom of the screen, where iOS draws it.
- **Side buttons**, three hairlines on the rails. Cheap, and the last tell.
- **`PhoneFrame` takes a `scale`.** The wrapper takes the scaled box in flow, so
  a scaled phone still sizes its column. Only the pinned sequence uses it.

Every render is the one component: hero, `/orbit/how-it-works` ×4, every trade
page, `/orbit/waitlist`, `/orbit/compare/[slug]`, and both storyboard and pinned
paths of `OrbitSequence`. The OG images never drew a phone. Nothing clips it —
the sticky stage's `overflow-hidden` is handled by the scale below, and the
busiest script (`MATERIALS`, four messages with two row tables) measures ~430px
into a 489px chat area, verified in `.ai/verification/orbit/v2/`.

## 2. Vyso | Orbit, and Vyso | Finch

New `components/finch/BrandLockup.tsx`: company wordmark · 1px rule · product,
one link, one accessible name. Both sites import it, so there is now exactly one
answer to "whose site is this?".

- **Orbit** was a bare Orbit logo. It is now the Vyso wordmark in paper +
  divider + the Orbit mark, `aria-label="Vyso — Orbit"`.
- **Finch's nav** already composed it; it now composes it *from the same file*
  and carries `aria-label="Vyso — Finch"` (previously three separate
  announcements: "Vyso", the divider, "Finch").
- **Finch's footer** said only "Vyso". It now matches the nav.
- **Both mobile sheets** match their navs.

`public/orbit/vyso-wordmark-paper.svg` is the Finch wordmark's paths at
`--ob-text`, not a filter: `globals.css` inverts nav `<img>`s to `#FFFFFF` over
dark bands, and `OrbitNav` is labelled `Orbit` specifically to opt out of that
block. The Finch divider keeps its `bg-fn-line-3` class because the same block
keys the divider's inversion on exactly that selector — verified on `/pricing`'s
dark hero.

## 3. The bands did not blend

On paper, a hard edge between two grounds is §2 working: two materials meeting.
Orbit has one material — every band is ink, and the alternation is `--ob-bg`
against `--ob-bg-2`, a four-percent step in lightness. That does not read as two
surfaces; it reads as an unfinished seam.

New block at the end of `app/globals.css`. `.orbit-site` already paints
`--ob-bg` on the shell, so the fix is one-sided: bands that differ from the page
ground paint a gradient that *starts and ends* at it. A band rises out of the
ground over 180px and settles back over the same distance, so any join is 360px
of ramp. Nothing needs to know its neighbour, which is why this is a stylesheet
block rather than a `seam` prop threaded through thirty `<Band>`s on nine pages.

Two things had to follow, and the first attempt missed both:

- **The devices paint over the fill.** `FacetPlane` covers a blue band edge to
  edge, so the ink→blue join was exactly as hard after the fill ramp as before
  it. `[data-band-device]` now carries the ramp as an alpha mask.
- **So does the grain.** `.fn-ground-grain::before` is 7% noise over the whole
  band — and since the hero's fill is the same `--ob-bg` as the shell, that 7%
  *was* the line under the nav that Josh described. Same mask.

Both textures use a fixed `--ob-fade`; only the fill's per-edge `--ob-fade-t/-b`
are ever zeroed, which happens where two same-fill bands touch and at the last
band in `<main>` (every page ends on `WaitlistBand`, and the footer is the same
fill — fading out and back in would invent a dip). `OrbitFooter` lost its
`border-t` for the same reason: a hairline over a gradient is the hard edge
again. `SeamHairline` is untouched — a rule a band *asks* for is not what any of
this is about.

**Measured**, on full-page captures of all ten Orbit routes, as the worst
row-to-row RGB step in a row-mean across the left gutter (a row-mean because a
canvas dot is local and a seam is not):

| | worst step |
|---|---|
| before, hero→sequence | **10 units over 2px** (`.ai/verification/orbit/orbit-1440.jpg` y=521) |
| before, ink→blue | **~90 units in 1px** (`#0B1020` → `#163F7A`, by construction) |
| after, every seam on every page | **≤ 5.4 units**, and the four worst are device lines crossing the sample, not joins |

## 4. Scrolling felt slow

Diagnosed in the browser at 1440×900, all four hypotheses:

**(a) Lenis config — a contributing cause.** `SNAPPY` (`lerp 0.25`,
`wheelMultiplier 1.1`) is right for Finch, where paper and ink bands alternate
and a hard edge is always arriving to tell the reader the page is moving. Orbit
is ten bands of near-identical ink — more so now that the seams are soft — so
there is nothing in frame to calibrate against and the same easing reads as lag.
`SmoothScroll` gains an `ORBIT` mode (`lerp 0.32`, `wheelMultiplier 1.2`),
selected by an `isOrbit` boolean in the effect's dep array exactly as
`isPlatform` is, so navigating *within* the subsite never rebuilds the instance.
`data-lenis-mode` on `<html>` names it. Settle-to-half-a-pixel, derived from
Lenis's own damping law (`ln(2d)/(60·lerp)`) and cross-checked against this
file's earlier stopwatch numbers to within 2%: one notch 360→**285ms**, three
433→**343ms**, a 1200px fling 525→**415ms**.

**(b) The pinned sequence — the main cause.** `OrbitSequence`'s wrapper was
`320vh`. The pin is `WRAP_VH − 100`, so the reader pushed **2.2 viewports
(1,980px)** of wheel to advance three chat bubbles — ~660px per message, on a
page only 9.47 viewports long end to end. A third of the subsite's entire scroll
was spent in a section that does not move. `WRAP_VH` is now **220**: the pin is
**1.2 viewports (1,080px)**, inside the ≤1.5× the review asked for, and because
`BEATS` are fractions of the range each message now arrives in ~173px of wheel
instead of ~317px. Page total: **8,523px → 7,861px (9.47 → 8.74 viewports)**,
despite the phone growing 320px taller.

**(c) `scroll-behavior: smooth` — refuted, not the cause.** It is set on `<html>`
(`globals.css:124`) and the `.lenis.lenis-smooth` guard below it is effectively
dead, because Lenis only carries that class transiently while
`isScrolling === "smooth"`. It does not matter: Lenis's `setScroll` passes
`behavior: "instant"` explicitly (`lenis.mjs:532-541`), and Next wraps route
scrolls in `disableSmoothScrollDuringRouteTransition`
(`client/components/layout-router.js:163`). The only thing still animated by it
is an in-page hash jump, which is wanted. Left alone; the stale comment in
`SmoothScroll` about anchors relying on "the browser's instant jump" is the one
inaccuracy, and it is a comment.

**(d) `will-change` / canvas jank — not a factor.** `grep` finds no
`will-change` on any Orbit route; the canvas devices are `IntersectionObserver`
-gated and DPR-capped in `canvas-stage.ts`; and `/orbit`'s first viewport mounts
zero canvases. Frame timing could not be sampled directly — the agent's browser
pane keeps the document `hidden`, which pauses `requestAnimationFrame` outright —
so this one is argued from the code and the device inventory rather than a trace.

**Also fixed while in there:** the pinned stage now measures the viewport and
*scales* the phone into it (`STAGE_CHROME` 132, floor 0.85) rather than letting a
669px frame shear against a short `h-screen` box, and `MIN_STAGE_H` drops
760 → 720 because a scaled phone fits where a fixed one did not.

## Verified

`.ai/verification/orbit/v2/` — 36 captures against `next start` on a production
build, via headless Chrome over CDP (viewport-exact, no dev overlay): every
Orbit route at **1440×900 and 390×844**, full-page seam audits of `/orbit` at
both widths and of `/orbit/how-it-works`, the pinned sequence at t = 0.25 / 0.50
/ 0.75 / 1.00, the short-viewport scale (1440×760) and the storyboard fallback
(1440×700), both mobile sheets open, both footers, and the Finch side of the
lockup change including `/pricing`'s dark hero where the wordmark inverts.

## Gates

`npx tsc --noEmit` clean · `npm test` **736 pass / 0 fail** · `npm run build`
clean · `npx eslint .` **50 errors, 40 warnings** — unchanged from the baseline;
none of the touched files contributes one.

---

# Doc-U — row-shifted line extraction: detect, repair, flag

*2026-08-20*

## What went wrong in the real world

Turn 'n Slice photographed a supplier invoice — skewed, 11 product lines — and
the extraction paired every product with the **neighbouring row's** numbers. Not
one bad line: the whole price side of the table slid. Read off the review screen
against the paper:

| Row | Product | Paper | Extracted |
|---|---|---|---|
| 1 | Carrots-Grated | 25.50 / 127.50 | *(no price, no amount)* |
| 2 | Onion-Sliced | 29.90 / 119.60 | 25.50 *(Carrots' rate)* / — |
| 3 | Onion-Red Sliced | 32.50 / 97.50 | 29.90 *(row 2's rate)* / 127.50 *(row 1's amount)* |
| … | | | |
| 11 | Broccoli-Florets | 75.50 / 377.50 | 89.90 / 60.85 |

The exact shape, once the four known rows are lined up: **unit price one row
late, amount two rows late**. A human caught it in review — "All fields
confirmed" was reached only after manual correction.

The important part is that this is **machine-detectable without the paper**:
`5 × 89.90 ≠ 60.85`, and the same is true on nearly every line. A correctly-read
table multiplies out; a slid one does not. That asymmetry is the whole detector.

## What was built

**1. `lib/platform/docu/line-audit.ts` — a pure validator.** No I/O, no model.
Per line it checks `quantity × unit_price ≈ amount` (within a cent *or* 0.5%,
whichever is kinder), trying `total_kg` and per-pack `weight` as the multiplier
for weight-priced rows before calling a line wrong. Document-level it returns a
diagnosis:

- **`row_shift`** — ≥ 60% of checkable lines fail, *but* sliding the price and
  amount columns makes ≥ 80% of all lines pass. Columns are searched
  **independently** by up to ±2 rows, because the real failure did not move them
  together; gentler and symmetric shifts win ties. The audit returns the
  **repaired lines**: descriptions and quantities exactly as extracted, price and
  amount reassigned. Holes the slide leaves are closed only where arithmetic
  forces the answer (a line with a quantity and one of price/amount implies the
  other), and one still-missing amount is reconstructed as the residual against
  the document total. Pairs the slide consumed from nowhere come back as
  `orphans`.
- **`line_math`** — the numbers are wrong and no slide explains it. Nothing is
  changed. A single odd line among good ones lands here too, by design: one bad
  row is not a reason to move the whole table.
- **`clean` / `not_enough_data`** — nothing to say.

Plus a VAT-aware cross-check of `sum(amounts)` against the extracted total
(`match`, `match_incl_vat`, `mismatch`).

**On this invoice** the audit diagnoses `row_shift { unit_price: +1, amount: +2 }`
and repairs all 11 lines back to the paper values — the last row's price and
amount, which were never in the model's output at all, are recovered as the
residual against the R 2 373.35 total (377.50 ÷ 5 = 75.50). Without a total it
still recovers rows 1–10 and reports row 11 as unresolved rather than inventing
it. `tests/docu-line-audit.test.ts` holds the fixture and both outcomes.

**2. Wired into `extractDocument`** (`lib/ai/anthropic.ts`), not into one route —
the ingest path (`lib/platform/document-ingest.ts`, forwarded email) and
`/api/ai/extract` both call it, and an audit that only ran on one of them would be
a bug waiting. A repair replaces `line_items` before anything is written, so
ProcurePulse stock, SupplySync spend and Doc Watch's "biggest lines" all see the
corrected numbers. Confidence is capped at **75** for a repair and **70** for an
unexplained failure — both under `DOC_LOW_CONFIDENCE_THRESHOLD` (80), so an
audited document cannot auto-approve anywhere. The compact verdict is stored as
`extracted_data.line_audit` (typed on the web-only `DocuExtractedData`, so the
mirrored canonical `types.ts` is untouched).

**3. Prompt hardening** — two bullets, no bloat: amount must equal
quantity × unit price (or total_kg × unit price), skewed photographs invite
reading a rate off the row above or below so re-walk the table before answering,
and *never borrow from an adjacent row* — return `""` for a field you cannot read.

**4. Review UI** — `LineAuditNotice` draws the verdict where the reviewer already
is: above the extraction editor on the document page (not buried in the collapsed
"Additional information" tile), and on each review-queue card *before* the Save
button. A repair reads "Columns re-aligned — worth an eye"; a `line_math` failure
names the rows ("Check rows 1, 3, 4, 5") and highlights them in the queue's line
table. Both also surface as Doc-U flags (`line_realigned` warning,
`line_math` critical).

**5. Doc Watch — verified, unchanged.** `lib/platform/doc-watch/detect.ts`
reads `extracted_data.line_items[].amount` via `pricedLines()`, and
`run.ts` selects `extracted_data` straight off the document row. Repaired lines
flow through with no edit.

## Gates

`npx tsc --noEmit` clean · `npm test` **758 pass / 0 fail** (736 + 22 new) ·
`npm run build` clean · `npx eslint .` **50 errors, 40 warnings** — the baseline,
unchanged; none of the touched files contributes one.

---

# Add a line in Doc-U review · printable tax invoice (Josh, TnS supplier invoice)

Two asks off a Turn 'n Slice supplier invoice: **(1)** an "Add item" control when
reviewing/correcting extracted data, and **(2)** printing an invoice as a PDF that
also reaches a nearby printer. The survey changed the shape of the second one.

## What was already there

**The extraction editor** is `components/platform/ExtractionEditor.tsx`, drawn by
`components/platform/docu/DocumentDetailPanel.tsx` on `/app/docu/[id]` — the same
screen for a fresh review and for re-editing an already-saved document (the button
reads "Save & confirm" or "Save changes" off `status`). `/app/docu/review` is the
queue: read-only rows with an expandable summary table and an "Open full document →"
link into `[id]`. So there is exactly ONE place lines are edited, and the add
button belongs there.

Order-type documents take a different editor — `docu/OrderReviewEditor.tsx` — and
that one has had **"+ Add item"** all along. The gap was invoices/statements/
delivery notes/price lists, i.e. precisely the document Josh was reviewing.

**OrderFlow invoices** are line-editable only while `draft`, via
`/app/orderflow/invoices/new?edit=<id>` → `InvoiceBuilder` → the shared
`LineItemsEditor` (`orderflow/builder.tsx`), which already adds lines through a
product picker plus a "+ Add <typed name>" quick-create. A sent invoice is
deliberately immutable — the affordances there are Credit note / Cancel / Duplicate,
which is the correct accounting behaviour. **No add-row work was done here, by
design.**

**Print already existed, and works.** `InvoiceSheetClassic.tsx` renders the classic
SA **Tax Invoice** (seller block + VAT/reg, bank details, bordered
Qty | Item | Rate | VAT | Amount table, VAT-total block, SIGNED / PRINT NAME footer)
inside the invoice detail; `DocSheet.tsx` does the same job for quotes, credit notes
and delivery notes. Both carry a `@media print` block that hides `body *` and reveals
`#of-doc-print` at `top/left` only (never `inset: 0`, which would pin the height and
truncate a long document), and `PrintButton` fires `window.print()`. The list view
deep-links `?print=1`, which auto-opens the dialog once. There is no PDF library in
`package.json` and none was added.

## Decision: no `invoices/[id]/print` route

The plan called for a dedicated print route rendering a second A4 sheet. Building it
would have forked the tax-invoice document: two renderers that must agree forever on
discount → rebate → VAT → total (all of which come from the shared `docTotals`), on
the VAT code, and on which seller fields may be invented (none). The existing sheet
is already chrome-free in print and already paginates. So the print work became
*polish on the real one* rather than a second copy:

- `@page { size: A4; margin: … }` in both sheets — the margins were exact, the paper
  size was whatever the dialog defaulted to.
- `PrintButton`'s default label "Download PDF" → **"Print / PDF"**, with a title
  attribute saying the dialog offers a printer *or* Save as PDF. The old label named
  only the file, which is why the printer half was undiscoverable — Josh's actual
  complaint. `DeliveryNoteDetail`'s explicit "Download PDF" and the invoice list's
  row action were brought onto the same wording.
- A small caption under the button on the invoice detail: **"Print or save as PDF"**.

*If a true file-download PDF is ever wanted* (emailing a PDF without a human at a
dialog), the options are: `@react-pdf/renderer` or `pdfkit` in a route handler
re-implementing the sheet server-side (~a day, plus the fork risk above), or
headless-Chrome `page.pdf()` against this very print view (reuses the sheet, needs a
browser in the deploy target). Neither is worth a dependency for "print this".

## Built

**`components/platform/ExtractionEditor.tsx`** — `+ Add line` beside the running
total. It appends a blank `ExtractedLineItem` (`confidence: 100` — a human typed it,
so it must never read back as a low-confidence guess), the row uses the same inputs
and the same `✕` delete as every other row, and it saves through the untouched path
(`extracted_data.line_items` merged over the existing `extracted_data`, so the
statement summary, custom type and supplier all survive). The running total is
derived from `lines` state, so a new row counts the moment an amount is typed.
The line-items section is now drawn **unconditionally** — previously it rendered only
when `lines.length > 0`, so a document the extraction read no lines from had nowhere
to add one, which is the case where the button matters most; the empty state points
at it. Keyboard: it is a real `<button>` in tab order, and adding focuses the new
row's description input, so tab → Enter → type works without touching the mouse.

**`components/platform/docu/DocumentDetailPanel.tsx`** — a small **Print** control in
the "Original document" header. It opens the signed file in a new tab rather than
printing the embedded frame: the browser's native PDF/image viewer prints the real
supplier document at full fidelity, whereas printing the iframe prints the app around
it. ⌘P in that tab is the same dialog, hence the same nearby/AirPrint printers and
the same Save-as-PDF. Hidden when there is no `storage_path` (no URL to open).

## Not verified by clicking

The W6 walkthrough (add a line → save → reopen; invoice → Print → A4 sheet in the
dialog) needs a signed-in org, and signing in means entering a password, which this
agent does not do. Static verification instead: the save path writes
`extracted_data.line_items` from the same `lines` state the new row lands in, and
`DocumentDetailPanel` reads `doc.extracted_data.line_items` back into the editor's
initial state — so a saved row reappears. The print dialog's content is whatever
`#of-doc-print` contains, which is the unchanged `InvoiceSheetClassic`.

---

# Outgoing-invoice direction detection (Doc-U)

## The failure

A photographed A4 on **Turn 'n Slice letterhead** — TnS logo, TnS banking details,
`Invoice To: Investec Bank Limited` — was filed as a **supplier invoice**, and
`Turn n Slice HQ (Pty) Ltd` was created as a row in `suppliers`. The org became its
own vendor: its selling prices entered supplier price history, its own sales counted
as spend, and the customer it had actually invoiced appeared nowhere on the document.

## Why the org-name guard missed

`resolveSupplierProfile` (`lib/platform/document-ingest.ts`) already refuses to make a
supplier out of the org itself — but only on **exact normalised equality**:

```ts
const orgNorm  = normalizeSupplierName(org.name);   // "turn n slice"
const nameNorm = normalizeSupplierName(trimmed);    // "turn n slice hq"
if (orgNorm && nameNorm && orgNorm === nameNorm) return null;
```

The org is registered as `Turn 'n Slice`; the letterhead reads `Turn n Slice HQ (Pty)
Ltd`. `normalizeSupplierName` strips the apostrophe and `(Pty) Ltd` but not `HQ`, so
the two strings sit **one token apart** and the guard stayed silent. The exactness is
not a bug — its own comment records why containment was removed (org `Fresh Valley
Produce` was swallowing supplier `Valley Produce`, filing real invoices permanently
unlinked). Exact equality is the right rule for *"is this string literally us"* and
the wrong rule for *"is this letterhead ours"*. Both call sites
(`app/api/ai/extract/route.ts` and the chat/email ingest path) share that one guard,
so both were wrong the same way — this was never a one-path problem.

A second, quieter half: even had the guard fired, the outcome was only
`supplier_id = null`. Nothing read the counterparty, so the document would still have
looked like an unattributed *purchase*.

## Built

**`lib/platform/docu/document-direction.ts`** — pure, no I/O, tested. Identity comes
in as values, a verdict comes out.

- `normaliseParty` mirrors `normalizeSupplierName` (written locally, not imported,
  because that module uses the `@/` alias the `node --test` runner cannot resolve —
  the header says so and says to change both).
- `matchesOrgIdentity` — exact VAT match first (two businesses cannot share one), then
  token-set Dice ≥ **0.85** against `organisations.name` and
  `cd_company_profile.company_name`. 0.85 is *one extra token on a three-token name*
  (`turn n slice` vs `turn n slice hq` = 0.857) and deliberately does not reach the
  regression the old comment warns about (`Fresh Valley Produce` vs `Valley Produce` =
  0.80 → still a supplier; there is a test).
- `resolveDocumentDirection` → `'incoming' | 'outgoing' | 'unknown'`. Ordered so the
  common path is cheap and every uncertainty lands on `'unknown'`, which means
  "behave exactly as before": no identity on file → unknown; issuer ≠ org → incoming;
  no issuer read → unknown; **both** sides look like the org → unknown; issuer = org →
  outgoing.
- `matchCounterparty` — strict. Exact normalised name, or a single Dice ≥ **0.75**
  winner that beats the runner-up by more than 0.01; anything else is a miss with a
  reason (`no_name` / `no_customers` / `below_threshold` / `ambiguous`). Explicitly
  **not** `matchCustomer` from `orderflow-from-doc.ts`: that one is allowed to be
  generous because its failure branch *creates the customer*. Here a miss must stay a
  blank.
- `buildDirectionRecord` → what is persisted at `extracted_data.direction` (jsonb, no
  migration — same place `line_audit`, `summary` and `custom_type` already live). Only
  outgoing documents carry a record, so an **absent** `direction` still means exactly
  what it always meant.

**`lib/ai/anthropic.ts`** — two fields added to the extraction contract (after the
row-shift agent's prompt edit landed, `28c1da2`): `bill_to` (the "Invoice To" / "Bill
To" / "Sold To" party, described as the mirror image of `supplier`) and `supplier_vat`
(the VAT number printed against the **issuer**, with an explicit instruction not to
return the recipient's and to prefer `null` over a guess).

**`lib/platform/document-ingest.ts`** — `loadOrgIdentity` (org name + Core Data
company profile; *not* `of_settings`, which carries numbering and VAT **rates**, not
identity) and `classifyDocumentParties`, which runs the pure decision and, only for an
outgoing document, loads `of_customers`. The ordinary supplier-invoice path pays for
one identity read and nothing else.

**Wiring** — both extraction paths, direction check **before** supplier resolution
(that ordering is the fix). Outgoing ⇒ `supplier_id = null` (cleared, so a
re-extraction cannot inherit a stale wrong link), `extracted_data.supplier = null`
(the detail panel and the flags engine both fall back to that string when there is no
supplier row), `customer_id` written **even when null**, and the record stored.

## What an outgoing document looks like in review

| Surface | Before | Now |
|---|---|---|
| Review queue title | `Turn n Slice HQ (Pty) Ltd — Invoice` | `Investec Bank Limited — Invoice`, or `Outgoing invoice — Invoice` when unmatched |
| Review queue detail | `Extracted, waiting for your approval.` | `Outgoing invoice — customer not recognised. Waiting for your approval.` |
| Doc-U flag | `Unknown supplier · warning` | `Outgoing invoice · info` — it **replaces** the unknown-supplier flag, which is otherwise the exact prompt that invites someone to type the org back in |
| Detail panel supplier | `Turn n Slice HQ (Pty) Ltd` | nothing (no row, no extracted string) |
| Doc Watch card | `Invoice INV-… from Turn n Slice HQ read this morning` | `Invoice INV-… you issued to {customer}, read this morning` — or `…you issued, read this morning — R X. The customer was not recognised.` |

No component files were edited. Every one of those lines comes from a pure module the
components already call (`review-queue-shared.ts`, `docu/flags.ts`,
`doc-watch/detect.ts`), so the Doc-U and OrderFlow components stayed untouched.

Doc Watch prints the customer **only when it was matched to an `of_customers` row**.
The alternative is the unverified string on the paper, and a Brief card is not the
place to assert one of those.

## Downstream exclusion

- **Price Watch** — excluded, twice over. `run.ts` selects
  `.in('document_type', PRICED_DOC_TYPES)` and then skips any document with no
  supplier: *"pw_price_points.supplier_id is NOT NULL: a line we cannot attribute to a
  vendor cannot join a price series, and inventing an attribution is the one thing
  this agent must never do."* An outgoing document has `supplier_id = null`, so it is
  counted as `documentsSkipped.no_supplier` and never reaches `pw_price_points`. No
  change was needed there, and none was made.
- **ProcurePulse** — this one *did* need a guard. `feedDocumentToProcurePulse` never
  required a supplier, so an outgoing invoice's lines would have been booked in as
  **stock received**. One early return on `extracted_data.direction`, placed in the
  feed rather than at the call sites so all three paths are covered — including the
  review-queue Save, which re-reads the stored row.
- **SupplySync** — already gated on `supplierId &&`, so a null supplier skips it.
- **Debtors Watch** reads `of_invoices`, not `documents`; an outgoing Doc-U scan
  creates no invoice, so it is untouched. *Follow-up, not done here:* an outgoing scan
  that matches a customer is arguably an `of_invoices` row waiting to be created —
  that is a Doc-U → OrderFlow feature, not a bug fix, and it must not be automatic.

## Backfill triage — SQL for Josh (read-only, changes nothing)

Finds documents already filed with the org's own identity as the supplier. Match rule
is deliberately looser than the code's (token-prefix either way, no Dice in SQL), so it
over-reports slightly — this is a list to eyeball, not a script to run.

```sql
-- Turn 'n Slice: a24f858b-b40b-4824-bc29-8818f034d44b
-- Drop the org_id filter to sweep every org.
with doc as (
  select d.id, d.org_id, d.filename, d.document_type, d.status,
         d.supplier_id, d.customer_id, d.created_at,
         coalesce(d.extracted_data->>'supplier', s.name) as supplier_as_read
  from documents d
  left join suppliers s on s.id = d.supplier_id
  where d.org_id = 'a24f858b-b40b-4824-bc29-8818f034d44b'
    and d.document_type in ('invoice', 'statement', 'delivery_note')
    and d.extracted_data->'direction' is null          -- not already re-classified
    and coalesce(d.extracted_data->>'supplier', s.name) is not null
),
org_names as (
  select o.id as org_id, n.name
  from organisations o
  left join cd_company_profile p on p.org_id = o.id
  cross join lateral (values (o.name), (p.company_name)) as n(name)
  where n.name is not null
),
squashed as (
  select doc.*, org_names.name as org_name,
         btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           lower(doc.supplier_as_read),
           '\(.*?\)', ' ', 'g'), '[^a-z0-9 ]', ' ', 'g'),
           '\y(pty|ltd|limited|proprietary|cc|inc|bpk|edms|npc)\y', ' ', 'g'),
           ' +', ' ', 'g')) as doc_norm,
         btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           lower(org_names.name),
           '\(.*?\)', ' ', 'g'), '[^a-z0-9 ]', ' ', 'g'),
           '\y(pty|ltd|limited|proprietary|cc|inc|bpk|edms|npc)\y', ' ', 'g'),
           ' +', ' ', 'g')) as org_norm
  from doc
  join org_names on org_names.org_id = doc.org_id
)
select distinct on (id)
       id, created_at, filename, document_type, status,
       supplier_as_read, org_name, supplier_id, customer_id
from squashed
where length(org_norm) >= 3
  and (doc_norm = org_norm
       or doc_norm like org_norm || ' %'
       or org_norm like doc_norm || ' %')
order by id, created_at desc;
```

Then, per document, either re-run extraction from the Doc-U inbox (which now
classifies it correctly) or fix it by hand. **Nothing here writes.** The suppliers rows
those documents created (`Turn n Slice HQ (Pty) Ltd` and friends) also want deleting,
but only after their documents are re-pointed — `documents.supplier_id` is
`on delete set null`, so deleting first silently unlinks anything genuinely attached.

## Not verified by clicking

The end-to-end walkthrough (upload the TnS photo → review screen reads "Outgoing
invoice — customer not recognised") needs a signed-in org, and signing in means
entering a password, which this agent does not do. Verified instead by the pure tests
(`tests/docu-document-direction.test.ts` reproduces the TnS strings verbatim) plus
`tests/doc-watch-detect.test.ts` for the card, and by reading the flag/review/feed
consumers back to the jsonb key they read.

---

# Doc-U batch upload — 20 files or a folder, with a staging tray (2026-08-20, branch `main`)

Josh, on desktop: Doc-U "takes the one image and immediately starts extraction".
He wants to add up to twenty documents at once, or point it at a folder, with a
step in between where he can look at what he picked.

## The survey — what each surface actually did

**`app/app/docu/upload/page.tsx` was genuinely single-file.** `handleFile` read
`e.target.files?.[0]`, uploaded that one, fired extraction and navigated away.
The input had no `multiple`, so selecting five files uploaded one and discarded
four without a word. This is the file Josh was describing.

**`components/platform/docu/UploadBubble.tsx` was NOT single-file** — worth
stating plainly, because the brief allowed for either. Its input already carried
`multiple`, it walked the whole `FileList`, and it uploaded each file in turn,
counting completions ("Uploading… (3)"). What it lacked was the same thing the
page lacked: the *pause*. `handleFiles` ran straight off the change/drop event,
so choosing was committing. It also carried a **fork of `validateUploadFile`** —
its own extension regex and its own `MAX_MB = 20` — and that 20 was wrong: the
extract route refuses anything over 15 MB, so a 17 MB scan uploaded, failed
extraction, and sat on `pending` forever. The W5 note in `upload-client.ts`
recorded that divergence rather than fixing it; this wave closed it.

**`lib/platform/docu/upload-client.ts` (W5) was already the right shape** —
`validateUploadFile` / `uploadDocument` / `startExtraction`, no runtime imports,
tested from `node --test`. Nothing about it needed rewriting; the batch logic was
added alongside it.

**The chat's `ChatDropZone`** does no uploading at all — it is a drag-detector
that hands the files to `FinchChatProvider.attach()`, which loops sequentially and
**awaits** each extraction so it can say "Reading invoice.pdf…" and then talk
about what was read. Deliberately different from Doc-U's fire-and-forget, and
left exactly as it was.

**`desktop/` is an Electron shell, and a thin one.** `desktop/main.js` opens one
`BrowserWindow` at `https://vyso.co.za/app` with `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`, plus `setWindowOpenHandler` /
`will-navigate` guards that push non-`vyso.co.za` URLs to the system browser.
There is **no preload script, no IPC channel and no `fs` access** — the "desktop
app" is the website in a frame. So "Vyso desktop" cannot today reach the file
system any way the web build cannot, and everything below works identically in
both.

## Built

**`lib/platform/docu/upload-client.ts`** — `MAX_BATCH_FILES = 20`;
`isReadableDocument()` split out of `validateUploadFile` (same rule, needed on its
own for folders); and `selectBatch()`, the pure decision-maker: it stages
candidates, attaches each one's validation sentence, counts what it left out and
returns one notice about it. The cap counts **the whole tray**, not the current
selection, so ten files dropped twice is twenty and a third drop is refused.
De-duplication is by name + size, which is what stops the same folder dragged
twice from doubling the list.

**`lib/platform/docu/folder-drop.ts`** (new) — `filesFromDrop()` walks a dropped
directory via `webkitGetAsEntry()`. Two traps are handled and commented, because
both produce a feature that demos fine and fails in use: `dataTransfer.items` is
emptied the moment the handler awaits (so every `webkitGetAsEntry()` call happens
synchronously first), and `readEntries` returns ~100 entries at a time and must be
called until it answers empty (so a folder of 300 invoices is not silently 100).
Dot-files are dropped by name — `._invoice.pdf` passes an extension check.
Scanning stops at 500 files / 8 levels, and the whole thing falls back to the flat
`dataTransfer.files` where the entry API is missing.

**`components/platform/docu/UploadStagingTray.tsx`** (new) — `useUploadBatch()`
holds the tray and runs the batch; `UploadStagingTray` draws the rows (name, size,
type, inline validation reason, ✕ remove) with **Upload N documents** / **Clear**.
Per-file states while it runs: **Waiting → Uploading… → Queued for reading**, or
**Failed** with the reason inline; the loop continues past a failure, so one bad
file never costs the other nineteen. Uploads are sequential, not `Promise.all` —
twenty parallel PUTs from a shop's wifi is twenty timeouts, and a serial loop is
what lets the tray say which file it is on.

**`app/app/docu/upload/page.tsx`** — rewritten around the tray: **Choose files**
(`multiple`), **Upload a folder** (`webkitdirectory`), and a drop zone that takes
files, folders, or both.

**`components/platform/docu/UploadBubble.tsx`** — same tray at `dense`, same two
buttons, same drop handling; its 20 MB fork and its private regex are gone.

## "Queued for reading", not "Reading" — and where the batch lands

The wording follows the mechanism rather than dressing it up. `startExtraction`
fires with `keepalive` and nobody awaits it, so at the moment the tray says a file
is done, what is true is that it is *stored and queued*. Awaiting twenty
extractions would hold the owner on the upload screen for minutes to tell them
something the inbox tells them anyway.

**The destination changed, and this is the one behavioural change beyond the
feature.** The old page pushed to `/app/docu` — which is the folder **hub**
(`FolderGridView`): folder tiles and KPI cards, **no document rows**, and neither
a realtime subscription nor a pending-poll. Twenty documents uploaded to a screen
that shows none of them, and would not update if it did, is not a destination. The
page now pushes to **`/app/docu/recent`**, which renders `InboxView` — and that
component both calls `useRealtimeRefresh('documents')` **and** polls
`router.refresh()` every 6 s (capped at ~20 polls) while any row is `pending`. So
the batch appears as pending rows that fill in by themselves. **No manual refresh
affordance is needed on that route.** (Had it stayed on `/app/docu`, one would
have been.) The bubble does not navigate: it lives inside `InboxView` /
`FolderGridView`, so it calls `router.refresh()` and closes.

## Three caps, deliberately unequal

Documented at `MAX_BATCH_FILES` in `upload-client.ts`, because the temptation to
"unify" them is the bug:

- **20** — Doc-U batch. Bounded by patience and Storage; nothing reads all twenty
  at once.
- **10** — `MAX_ATTACHMENTS`, `app/api/ai/agent/route.ts`. A **model context**
  limit: those documents are cited into a Haiku turn. It stays 10. (Note the chat
  has no *client* cap; the server slices the citation list.)
- **8** — `MAX_ORDER_FILES`, `lib/platform/docu/order-ingest-client.ts`. Each of
  those files creates customers, orders and invoices — a write-amplification
  limit.

The Doc-U inbox itself has no limit; the cap is on one batch, not on the account.

## Follow-up, NOT built: a folder Doc-U keeps watching

`webkitdirectory` and the drop traversal read a folder **once**, at the moment it
is chosen. A folder that stays connected — new scans appear, Doc-U ingests them —
is a different feature and needs one of two things:

1. **File System Access API** — `showDirectoryPicker()` plus a persisted
   `FileSystemDirectoryHandle` in IndexedDB and `queryPermission`/
   `requestPermission` on each visit. Chromium only (no Firefox, no Safari), and
   the browser still requires a user gesture to re-grant after a restart, so
   "watching" means "re-scans when the tab is open and the owner clicks once" —
   it cannot ingest while the browser is closed. Polling `getFile()` mtimes is
   the only change detection available.
2. **The Electron shell** — the honest one, and the reason the desktop survey
   matters. It would need a **preload script and an IPC channel**, neither of
   which `desktop/main.js` has today (`sandbox: true`, no `preload`), plus
   `chokidar` or `fs.watch` in the main process, a stored folder path, and an
   upload path that talks to Supabase from the main process or hands bytes to the
   renderer. That is a real piece of work — call it two to three days including
   the auth question (the shell currently holds no session of its own; it just
   loads the web app) — and it changes `desktop/` from "the website in a frame"
   into an application with its own privileges. Not this wave, and not to be
   started without deciding whether the desktop shell is a product or a shortcut.

## Not verified by clicking

No W6 walkthrough: it needs a signed-in org, and signing in means entering a
password, which this agent does not do. What Josh should click:
`/app/docu/upload` → **Choose files**, select 3–4 PDFs → tray lists them with
sizes → ✕ one → **Upload N documents** → rows go Waiting → Uploading… → Queued
for reading → lands on **Recent** with pending rows that fill in without a
refresh. Then **Upload a folder** on a folder containing a `.txt` and a
`.DS_Store` → only the PDFs/images stage, with "Skipped N files that aren't PDFs
or images." Then drag that same folder onto the drop zone (the traversal path,
which the folder *picker* does not exercise) → same result. Then the inbox's
upload bubble → same tray in the popover. A >15 MB file should now be refused **in
the tray** on both surfaces rather than uploading and stranding on `pending`.

Static verification instead: `selectBatch` is covered by 14 tests
(`tests/docu-upload-batch.test.ts`) over the cap, the tray-aware cap, folder
filtering, de-duplication and the combined notices; the upload path itself is the
unchanged W5 `uploadDocument`/`startExtraction`, called in a loop.

## Gates

`npx tsc --noEmit` — **clean**. (It was not, mid-wave: three errors from another
agent's concurrent, uncommitted work — `app/app/docu/[id]/page.tsx` missing
`products`/`printContext` on `DocumentDetailPanel`, and two literal-type errors in
its new `tests/docu-invoice-from-extraction.test.ts`. Those files were not touched
here, per the brief; they were clean by the time this landed.)
`npm test` — **823 pass / 0 fail** (14 new). `npm run build` — clean.
`npx eslint .` — **50 errors, 40 warnings**, exactly the baseline; the new tray
initially added a 51st (React Compiler refusing to memoize `run` because
`org?.id` in the dep list infers as a dependency on `org`), fixed by hoisting
`orgId` to a primitive.

# Doc-U: product typeahead in the line editor; Print rebuilds the org's tax invoice (2026-08-20, branch `main`)

Two asks from Josh, both from Turn 'n Slice reviewing supplier **and** outgoing
invoices in Doc-U.

## 1. Product typeahead — the survey, and which source won

| Source | What it is | Verdict |
|---|---|---|
| **`pp_stock_items`** | THE product master. `core-data.sql` maps "Products & services → pp_stock_items"; OrderFlow's builder calls the same rows `CdProduct` and points people at *Doc-U → Databases → Products* to edit them. | **Chosen** — name, unit, category |
| **`pp_name_aliases`** (`status = 'confirmed'`) | Per-org rulings: raw name a human has already resolved → the product it means. | **Chosen** — folded in as alternate names to MATCH on |
| `pw_items` | Price Watch's derived buy-side catalogue, built *from these same document lines*. | **Rejected** — it is downstream of the mess this feature exists to prevent, so it would offer the misspellings back, and duplicate every `pp_stock_items` name while doing it |
| "PricePilot products" | There is no such table. PricePilot is `pl_price_lists` / `pl_overrides` — price lists **over** `pp_stock_items`. | **N/A** — the outgoing case is already served by the master |

So there is one catalogue for both directions, which is the answer to "and for
OUTGOING invoices arguably PricePilot products": buying and selling already
share it.

### Reuse: what fitted, what did not

- **`orderflow/builder.tsx`'s `LineItemsEditor` picker** — a *separate search box
  that appends whole rows*, welded to `CdProduct`, `resolvePrice`, price lists and
  `BuilderLine`. Not an in-cell typeahead, and no keyboard navigation. Its
  keyboard-Enter-takes-first-match idea was worth copying; its component was not.
- **`docu/OrderReviewEditor.tsx`'s customer combobox** — the right *shape*
  (input + absolute list + `onMouseDown`-to-pick), also no ↓/↑ and bound to
  customers. Its markup is what `ProductSuggestInput` is modelled on.
- **`procurepulse/matching.ts`** — reused outright. `normalizeName` +
  `diceCoefficient` are what make "tomatos roma" find "Tomatoes, Roma"; writing a
  second fuzzy matcher next to the one ProcurePulse already matches names with
  would have been the actual duplication.

### Built

**`lib/platform/docu/product-suggest.ts`** (pure). `scoreProductName` is
**tiered**: exact 1 → normalised-equal 0.98 → prefix 0.95 → word-prefix 0.90 →
substring 0.85 → fuzzy `dice × 0.8` above a 0.34 floor. The `× 0.8` is the point
— it keeps the entire fuzzy band strictly beneath every literal one, so someone
who typed `app` never gets a Dice-similar surprise above `Apples`.
`scoreOption` takes the best of a product's canonical name and its aliases;
`suggestProducts` dedupes by name (merging the loser's aliases so collapsing a
duplicate row never costs a way of finding it) and caps at 8.

**`components/platform/docu/ProductSuggestInput.tsx`** — combobox roles, ↓↑ Enter
Esc, `onMouseDown` + `preventDefault` so a click beats the input's own blur, and
an outside-mousedown close. **No debounce**: the whole list is fetched once per
mount and filtered locally, so there is no request to debounce and a keystroke
never waits.

**`ExtractionEditor`** — one component, so every instance gets it. Picking fills
the description and, *only when the line has no unit of its own*, the unit: a
unit read off the paper outranks the catalogue's, because the paper knows what
was actually delivered. Free text stays legal — nothing validates, rewrites or
rejects a typed value on blur.

Aliases are matched against but **never inserted**. Typing what a supplier prints
is exactly how you find the tidy name the org books it under; writing the mess
back would defeat the alias.

## 2. Print — the org's own Tax Invoice, not the photograph

### The sheet was NOT forked, and did not need splitting

`InvoiceSheetClassic` turned out to be already presentational — `companyProfile`,
`orgName`, `customer`, `invoice`, `lines`, `vatTreatment`, `vatRate`. Not one
`of_invoices` field in its props. The single change it needed was widening
`customer: OfCustomer` to a new **`ClassicInvoiceParty`** (name, trading name,
VAT, billing address, account code) — a structural subset, so `InvoiceDetailV2`
passes its row unchanged and OrderFlow's call site is byte-identical apart from
the import.

### Who is the seller depends on which way the document points

Getting this backwards would be a forgery in either direction:

| | Seller (letterhead, bank, logo) | Invoice To |
|---|---|---|
| **Outgoing** (`extracted_data.direction.direction === 'outgoing'`) | the org — `cd_company_profile` + org name | the matched `of_customers` row, or the name read off the page when nothing matched |
| **Incoming** (a supplier's invoice) | the **supplier**: a minimal profile carrying their name and, if the scan printed one, their VAT reg — **no bank block, no org logo** | the org |

An incoming reprint carrying the org's banking details would invite payment into
the org's own account on somebody else's invoice. `EMPTY_COMPANY_PROFILE` spread
with two fields is what guarantees it cannot: every other field stays null, so
the bank block and the logo simply do not render.

Identity comes from **`cd_company_profile`**, not `of_settings` — `of_settings`
carries numbering and VAT *rates*, not identity (the same distinction
`loadOrgIdentity` makes). `of_settings.default_vat_rate` is read, but only as the
fallback below.

### The mapping (`lib/platform/docu/invoice-from-extraction.ts`, pure)

- **The amount column is the authority.** Where a line's qty × unit price
  disagrees with its printed amount, the amount wins and the rate is back-derived
  (`unit_price = amount / qty`), so the reprint totals what the original
  totalled. A line with no quantity prints as one of whatever it is. Money parses
  with *exactly* the editor's rule (`replace(/[^0-9.-]/g, '')`), so the sheet and
  the editor's running total cannot disagree.
- **VAT is recovered from the document, not assumed.** An explicit rate field, or
  the printed VAT amount over the line subtotal. A zero-rated fresh-produce
  invoice therefore stays zero-rated even when the org default is 15%. A derived
  rate within 0.6 of the default snaps to it (14.97% is a rounding artefact, not
  a rate anyone charges); an implausible one (>30%, or a "VAT Number" mistaken
  for an amount) falls back to the default and the preview *says* it did.
- **No arithmetic was forked.** Subtotal / VAT / Total are `docTotals`, the same
  function OrderFlow's sheet, `balanceDue` and payment tracking all use.
- **Header labels are discriminated, not pattern-guessed**: "Invoice Date" never
  becomes the number, "VAT Reg No" never becomes an amount. What is genuinely
  absent is reported as absent — a Tax Invoice with an invented number is worse
  than one with a blank.

### Placement and guards

`components/platform/docu/PrintTaxInvoice.tsx` — primary "Print invoice" in the
detail header, **both directions** (a legible copy of an unreadable supplier
invoice is the same win). The existing action is now the secondary "Print
original", still opening the signed file in a new tab.

- **Hidden entirely** unless `document_type === 'invoice'` **and** at least one
  line carries a price. A delivery note of unpriced quantities is not a tax
  invoice and must not offer to print as one.
- **Missing `cd_company_profile` never blocks.** The sheet renders with whatever
  exists and the preview adds a quiet line pointing at
  `/app/docu/databases/company`.
- **Preview before print, always** — this sheet is a *reconstruction*, not a
  scan, so the reviewer sees exactly what will come out before the dialog opens.
  `window.print()` then prints the sheet alone via the existing `#of-doc-print` +
  `@media print` scoping.
- **Portalled to `<body>`.** The detail page scrolls inside its own
  `overflow-y-auto` container, and an absolutely-positioned print sheet nested in
  a scroll container clips to one viewport height when it paginates. The overlay
  also un-fixes itself for print (`position: static`) and hides its own chrome.

### Data

All four new reads join the page's existing `Promise.all`, RLS-scoped, no new API
route: `pp_stock_items` (600), confirmed `pp_name_aliases` (600),
`cd_company_profile`, `of_settings.default_vat_rate`. The matched customer row is
fetched **only** when `extracted_data.direction.customer_id` is set — an
unmatched outgoing document prints the name read off the page instead.

## Not verified by clicking

Same wall as the previous two waves: the Doc-U detail page is behind the platform
shell, and reaching it means signing in, which means entering a password — which
this agent does not do. `/app/docu` on the dev server redirected to `/login`, and
that is where it stopped.

Verified instead by 39 pure tests over the two new modules — including the one
that matters most, `docTotals` over the mapped lines reproducing a document total
whose own line arithmetic was deliberately inconsistent — plus `npx tsc --noEmit`
and a clean production build over every changed component.

## Gates

`npx tsc --noEmit` — clean. `npm test` — **825 pass / 0 fail** (39 new: 16 for the
typeahead filter, 23 for the extracted→sheet mapping). `npm run build` — clean.
`npx eslint .` — **50 errors, 40 warnings**, exactly the baseline; **zero** in any
file touched here. One was briefly added and removed: the usual `mounted`/
`useEffect(() => setMounted(true))` portal guard trips
`react-hooks/set-state-in-effect`, and it was unnecessary anyway — `open` starts
false and can only be flipped by a click, so the portal is never reached during
SSR or hydration.

# Chat attachments — the silent-failure hunt (2026-08-20)

## The report, and what the evidence says

"Dropping a document into the Finch chat (or the paperclip) does nothing — no
overlay, no progress, no card, no message", against `ad4b49c`, last known good
`72bc07c`.

**No regression was reproduced, and the commit range contains no candidate for
one.** `git log 72bc07c..ad4b49c` over the whole chat attachment chain —
`ChatDropZone`, `ChatComposer`, `FinchChatProvider`, `ChatView`,
`AttachmentCard`, `ChatTranscript`, `lib/ai/finch/attachments.ts` — returns
**one** file: `lib/platform/docu/upload-client.ts`, and only from `72d2961`
(the batch wave). That commit's edit to it is additive for every chat consumer:
`MAX_BATCH_FILES` and `selectBatch` are new and unreferenced by the chat, and
`validateUploadFile`'s predicate is byte-identical — the readability test was
lifted out into `isReadableDocument` and called, nothing more. `UPLOAD_ACCEPT`,
`attachmentMessage` and `uploadDocument` are untouched.

(The brief expected `ChatComposer.tsx` in `72d2961`'s diffstat. It is not in it;
that commit touches the two **Doc-U** upload surfaces, `folder-drop.ts`,
`UploadStagingTray.tsx` and `upload-client.ts`.)

## Reproduced instead: the path working

A throwaway harness (`app/dev-chat-harness/page.tsx`, since deleted) mounted the
real `ChatDropZone` + `ChatComposer` + `FinchChatProvider` under a stub
`PlatformProvider`, with `window.fetch` intercepted so Storage, the `documents`
insert, `/api/ai/extract` and `/api/ai/agent` answered without auth and without
touching a real project. Driven with a synthetic `DragEvent` carrying a
`DataTransfer` holding `buyer_statement (28).pdf`:

- `dragenter` → the dashed overlay renders (`border-[#3E8FE0]` present in the DOM)
- `drop` → `attach()` runs to completion → `turnCount: 2`, `attachError: null`

`canAttach` was true and the paperclip's file input was present throughout. The
client path is intact at `ad4b49c`.

## What was actually wrong: `attach()` could end in silence

The hunt did find the shape of failure the report describes, as a latent hole
rather than a new one. `attach()` narrates every step — a rejected file names
its reason, a failed upload names the file, a failed extraction downgrades the
card, a queue that times out behind a running turn says so — **except the last
one**. `sendRef.current(...)` is a `send()` that returns without a word when it
believes a turn is in flight, and it reads that from the `streaming` STATE while
`waitUntilIdle` polls the `streamingRef` — a ref the stream's `finally` lowers in
the same task that schedules the re-render. A poll landing inside that window
calls a `sendRef` whose closure still says `streaming: true`, and the whole flow
ends having uploaded, filed and extracted a document while the conversation shows
nothing at all. Indistinguishable, on screen, from a drop target that never
fired — which is precisely why a silent bug anywhere in this flow survives a
user report.

So `attach()` now checks that its send took, and says so when it did not.
`send()` raises `streamingRef` synchronously, before its first await, so the flag
is a reliable receipt at the call site: still down means still unsent. The
sentence is `attachmentStrandedNote`, next to `attachmentMessage` in
`upload-client.ts` and pure for the same reason — it names the files, says they
ARE in Doc-U (the half of the outcome a silent failure throws away) and says what
to do next.

Verified both directions in the harness: the happy path is unchanged and shows no
spurious error, and with the `sendRef` call neutralised the previously-blank
outcome renders `buyer_statement (28).pdf is in Doc-U, but it couldn't be added to
this conversation — ask about it in a new message.`

## Left alone, deliberately

The stale-`streaming` race in `send()` itself is now loud but not closed —
switching its guard to `streamingRef.current` would fix it at the root, and it is
a one-word change, but with no reproduction in hand it is a behaviour change to
the send path made on a hunch. Flagged rather than made.

Two other dead drop zones found while looking, neither a regression and neither
touched: on `/app` with nothing said yet `GlobalChatDock` renders no
`ChatDropZone` at all (`showPanel` is false), so a drop there really does nothing
— the paperclip still works, because `attaching` opens the panel; and on the
bubble routes the drop zone is inside a collapsed `FinchBubble`.

## Gates

`npx tsc --noEmit` — clean. `npm test` — **829 pass / 0 fail** (4 new, over
`attachmentStrandedNote`). `npm run build` — clean. `npx eslint .` — 50 errors,
40 warnings, exactly the baseline; zero in either file touched here.

The first of those two dead drop zones is now closed: `GlobalChatDock` listens
on `window` for a files-only drag while `/app` has no active conversation, and
shows a full-viewport "Drop to send to Finch" overlay that calls the same
`attach()` the paperclip does.

# Order line matching — honesty over coverage (2026-08-20, branch `main`)

A three-page NebulaPOS **Purchase Order** from **Bakubung Bush Lodge** to Turn 'n
Slice produced an order that invoiced at **R25,958.95** against a paper total of
**R13,457.60**. Josh's read of it was exactly right and worth repeating, because
it is what pointed at the real bug: *every wrong line is internally consistent*.
Qty × price = amount on all of them. Nothing was misread.

## Two different problems, wearing one costume

The report reads as one failure — "the numbers are wrong" — and it is two, which
is why it looked unfixable.

**The prices are not a bug.** `syncOrderFromDocument` re-prices every line from
the org's own price list when the customer's `invoice_price_basis` is
`'price_list'`, ignoring whatever figure the customer's PO carries. That is
correct and must stay: a supplier bills at its own prices, not at the price a
customer typed into their own purchase order. "1 box @ 569.90 → 1 box @ 23.80" is
Turn 'n Slice's list price for the product the line was matched to, arrived at
honestly. The arithmetic is consistent because it is *computed downstream from
the product*, not because anything fabricated it.

**The products are the bug.** Every figure Josh flagged is the right price for the
*wrong product*:

| Paper said | Matched to | Why |
| --- | --- | --- |
| `FF - GRAPES WHITE BOX` | **Avocado** (a second Avocado line) | nothing; the reader guessed |
| `VEG - MIX VEGETABLES 2 PKT` | **Cabbage** | nothing |
| `VEG - PATTY PAN YELLOW` | **Tomato-Yellow Cocktail** (a second one) | shared colour word |
| `VEG - SWEET CORN` | **Baby Sweet Corn** | token overlap 0.8 — R46.40 vs R375 |

So the report separates into: *pricing provenance is by design but was invisible*,
and *product matching was dishonest*. Both are fixed, differently.

## The prompt did not leak

`28c1da2`'s arithmetic-consistency hardening and `d0899f0`'s additions were
checked line by line against the order path. **Neither touched it.** Both edit
`EXTRACTION_PROMPT` — the invoice/statement reader — and `ORDER_PROMPT` is a
separate constant they never mention; `auditLines`/`summariseAudit` are wired into
`extractDocument` alone and never run over an order. The consistent-looking
numbers were never the model's doing: they are computed after the fact from
`qty × list price`, which is arithmetic that cannot help being consistent.

The prompt was hardened anyway, because the *rule* is right even where the leak
wasn't: **"NEVER COMPUTE OR INFER A VALUE… A blank we can ask about is worth more
than a number that is merely consistent."**

## What actually let it through

`matchStockItem` in `orderflow-from-doc.ts` was a three-stage ladder ending in
token overlap at **`score >= 0.5`** — a half-overlap. Two-token produce names
share one token constantly, so that floor accepted "Sweet Corn" → "Baby Sweet
Corn" and made the three peppers on this very document candidates for one
another. Worse, it ran **per line**: nothing in the system could see that the
Avocado product had just been handed out twice.

`lib/platform/docu/order-line-match.ts` (new, pure, no I/O) replaces it with four
rules:

1. **Match the raw paper text, never the reader's rewrite.** A rewrite is a
   suggestion; it is not evidence. `raw_description` is now extracted separately,
   typed on `ExtractedLineItem`, and survives the review editor's save.
2. **Auto-assign only at effective identity** — `AUTO_MATCH_FLOOR = 0.9`. Every
   failure on this document sat in the 0.5–0.8 band the old ladder accepted.
3. **A disagreed qualifier means a different product**, whatever the string
   similarity says — colour, size, cut, variety. White grapes are not black
   grapes and baby corn is not corn. Scores those pairs to 0 outright.
4. **Two paper lines may never land on one product.** A document-wide second
   pass; when they collide **both** go to review, because we cannot know which
   row was the real one and keeping the first silently loses a line the customer
   ordered.

Everything refused keeps the paper's own words, gets **no price at all**, and
carries what it nearly matched as a one-click `suggestion`. An unmatched line
also blocks auto-invoicing outright — `ai_allow_unpriced` is a decision about
*prices* and deliberately does not extend to unidentified *products*.

## Saying so on screen

`documents.extracted_data.order_lines` (jsonb, no migration, beside `line_audit`
and `direction`) now carries one `OrderLineRecord` per line: the paper's words,
what it was matched to, the reason it wasn't, and where the price came from.
`OrderReviewEditor` renders it — `Paper said "FF - GRAPES WHITE BOX" → Grapes
White`, the refusal reason with a clickable closest match, and
`Priced from your price list (Lodge Rates) · paper shows R569.90`. The
price-provenance line is the fix for the half of the report that was never a bug:
pricing from our list is right, but it is only *honest* when the screen names the
origin and shows the customer's figure beside it.

## Model

Order extraction moves to **`claude-sonnet-4-6`** via `ANTHROPIC_ORDER_EXTRACT_MODEL`
(documented in `.env.example`). Scoped deliberately: an order is read *against the
catalogue*, so on top of transcribing a dense multi-page PO the model decides per
line which product each row **is** versus merely resembles. Haiku read well and
decided badly. Invoices and statements — one supplier, no catalogue reasoning —
stay on `ANTHROPIC_EXTRACT_MODEL`'s Haiku tier, and chat is untouched.

`suggestProductMatches` (match-from-shortlist) was examined and **left on Haiku**:
its output is suggestions a human confirms, it never auto-links, and it is not in
the path that invoiced this order.

Cost: orders are a low-volume lane — dozens a day, not thousands — so the tier
change is small in absolute rands, against an error that costs a wrong customer
invoice. The deterministic gate in `order-line-match.ts` is what makes the
failures *visible*; Sonnet is what stops most of them being made. The gate is the
guarantee, not the model.

## Gates

`npx tsc --noEmit` — clean. `npm test` — **847 pass / 0 fail** (829 + 18 new, the
whole Bakubung document run through the pure matcher as a fixture). `npm run
build` — clean. `npx eslint .` — 50 errors / 40 warnings, exactly the baseline,
**zero in any file touched here**.

# The order editor learns to check its own arithmetic (2026-08-21, branch `main`)

The same three-page Bakubung Bush Lodge purchase order, re-uploaded after
`129456b`. The honesty pass held: 22 items, every raw description preserved, not
one forced match. What came back instead were two **character-level** misreads,
which no amount of matching honesty could have caught because neither is a
matching decision:

| The paper prints | What came back |
| --- | --- |
| `569.90` | `560.90` |
| `FF - GRAPES BLACK` / `GRAPES WHITE` | `Graphis Black` / `Graphis White` |

One transposed digit and one word replaced by a word that does not exist. Both
sailed through review, and the reason is worth stating plainly: **a price column
on its own cannot be checked.** R560.90 is a perfectly plausible price for a box
of apples. Nothing on the screen disagreed with it.

## First: which model read it?

`129456b` moved order extraction to Sonnet via `ANTHROPIC_ORDER_EXTRACT_MODEL`
and was pushed minutes before the re-upload, so "did this run on the old deploy"
was a live question — and it turned out to be **unanswerable from the
artefacts**, which is the more interesting finding. Nothing on the document, in
the response or in the row recorded which model had read it. The evidence had to
be inferred from the shape of the mistakes.

What the evidence does say: Josh saw raw descriptions preserved and no forced
matches, and **both of those are `129456b` server code** — `order_lines`
provenance, the `AUTO_MATCH_FLOOR = 0.9` gate and the document-wide duplicate
pass. An extraction served by the previous deploy would have written no
`order_lines` at all, so the review screen would have shown neither the paper's
words nor an unmatched highlight. So the *sync* certainly ran new code, and on
the same deploy the extraction did too: **Sonnet**.

One residual doubt, and it is a real one. If the upload landed mid-build (old
code, Haiku, `raw_description` absent) and a later re-sync on new code wrote the
provenance, `raw_description` would have fallen back to `description` — the
model's own rewrite, wearing the paper's clothes. There is a discriminator Josh
can apply to the existing document without re-uploading anything:

> **Look at what follows "Paper said".** `129456b`'s prompt demands the category
> code — `FF - GRAPES BLACK`. If the raw text carries the `FF - ` prefix, it is a
> genuine verbatim transcription and the read was Sonnet. If it reads exactly
> like the tidied product name with no prefix, it is the fallback, the read was
> Haiku, and the misreads are the old tier's.

And so that this is never again a matter of inference: **`extracted_data.extraction_model`**
now records the model id at extraction time (both write sites — the API route and
`document-ingest`), and the review editor prints `Read by claude-sonnet-4-6`
under the customer field. One string. Not having it cost an afternoon.

## The cross-check that was always available

The purchase order prints its own amount column. Every failure of this kind is
therefore arithmetic, and always was:

    1 × 560.90 = 560.90, and the paper says 569.90.

So `ORDER_EXTRACT_INSTRUCTION` now captures `raw_amount` per line — the row's
own printed total, copied digit for digit, **never computed** — beside
`raw_description`, and for the same reason: it is the only independent witness
to the figures on that row. It rides on `ExtractedLineItem` and survives the
review editor's re-save exactly as `raw_description` does, because a re-save that
dropped it would silently disarm the check on every later open.

The prompt also gained a `TRANSCRIBE, DO NOT INTERPRET` clause above the rules —
same letters, same digits, no normalising, no spell-correcting, and specifically
**never replace a word on the page with the word you expected to see there**,
which is precisely what `GRAPES → Graphis` is. Where a character is genuinely
unclear the model is told to settle it against the amount column rather than pick
the likelier glyph, and to report a disagreement it cannot settle rather than
tidy it away. No second model pass: one reader, better instructed, checking
itself against the document's own arithmetic.

## Saying it on the row

`lib/platform/docu/order-line-totals.ts` (new, pure) holds the maths, and holds
none of its own: the tolerance is `moneyMatches` from `line-audit.ts` — a cent,
or half a percent, whichever is kinder — because a warning that disagreed with
the invoice audit about "close enough" would be worse than no warning.

The editor grows an **Amount** column, computed live from quantity × unit price
and deliberately not editable: it is a read-out of the two figures beside it, and
an input here would only invite a third number that disagrees with both. Where
`raw_amount` exists and the row does not reconcile, the row turns red and says:

> Doesn't add up — paper shows **R 569.90** for this line, this row comes to
> **R 560.90**. Check the qty, the price or the amount against the document.

Both figures, no correction. We cannot know which of the three was misread, and
picking for the reviewer is how a wrong number becomes a confident one.

**What it stays quiet about matters as much.** An order line with a blank price
is the NORMAL state before `syncOrderFromDocument` prices it from the org's list;
warning "R 0.00 ≠ R 569.90" on all 22 rows would put a red mark on a good order
and teach the reviewer to ignore the colour. So the check returns nothing unless
a quantity, a unit price *and* a paper amount are all present. A read `0`
quantity against a printed amount, though, is a genuine question and does fire.

The reviewed gross is captured onto the document at save (`line_items[].amount`).
The push path needed no threading: `of_order_items` carries qty and unit_price and
every total downstream is `docTotals` over those two factors, so the gross is the
same number by construction — which is why it can never drift from the screen.
One knock-on was real and is fixed: `docTotal` sums line amounts, so without a
gate every order over R12k would have raised `unusual_spend`, a flag whose text
reads "above the usual range for this supplier" on a document that has no
supplier at all. Orders are excluded from that heuristic.

## Print before you commit to anything

An order is a working document long before it is an invoice, and until now the
only way to get a sheet out of one was to invoice it first — which is exactly the
decision the sheet was meant to help make. **Print / PDF** now sits beside
"Confirm & invoice" and prints the rows **as they stand on screen, unsaved edits
and all**: a reviewer who has just corrected 560.90 to 569.90 must not be handed
the mistake back on paper.

It is the `ad4b49c` path unchanged — `mapExtractionToSheet` → `InvoiceSheetClassic`
→ `window.print()` — fed from the live editor state rather than from
`extracted_data`. The preview shell that `PrintTaxInvoice` owned is now
`PrintSheetOverlay`, shared by both, because two print paths that drifted apart
on the print CSS would paginate differently for no reason a reader could ever
discover. An order that has not been invoiced prints **without an invoice
number** — it does not have one, and inventing a plausible-looking one is how a
document becomes a lie — and the preview chrome says so.

## Gates

`npx tsc --noEmit` — clean. `npm test` — **862 pass / 0 fail** (847 + 15, over
the gross computation, the mismatch predicate and the live-rows print mapper).
`npm run build` — clean. `npx eslint .` — 50 errors / 40 warnings, exactly the
baseline, **zero in any file touched here**. Not verified in a browser: the
screen is behind auth on a specific document, and the Bakubung order is Turn 'n
Slice data.

# A second reader, a second matcher, and a row that checks its own maths (2026-08-21, branch `main`)

The same three-page Bakubung purchase order, a third time. `129456b` made the
matching honest and `12ff849` made the digits checkable, and the run after both
still came back like this:

| The paper prints | What came back |
| --- | --- |
| AVOCADO — bulk 4 / unit qty 48 / unit cost 15.75 / **nett 756** | `Avocado 4.00 boxes @ 15.75 = R63` |
| `GRAPES WHITE 2 @ 659 = 1,318` | `Avocado Box 2 @ 959` |
| PINEAPPLE — 18 each @ 24.83 = 447 | `Pineapple 3 @ 24.83 = 74.49` |
| `MIX VEGETABLES 66.90` | `Beetroot 2 @ 66.50` |
| `BRINJALS` | `Cabbage 1 @ 118.50` |
| CUCUMBER — 60 each @ 22.90 = 1,374 | `Celery Box 4 @ 52.90` |
| `MUSHROOM GABLE 445.50` | `Mushroom Garlic Box 443` |

Read down that column and there are **two different failures wearing one coat**,
and the previous waves had been treating them as one.

The avocado and the pineapple are not misreadings at all. Every digit is
correct. `4`, `48`, `15.75` and `756` are all on the paper; the model simply
multiplied the wrong two. That is a *semantic* error about which column is a
cost **per**, and no amount of "transcribe, do not interpret" fixes it, because
nothing was mis-transcribed.

Everything else is a produce word replaced by a produce word — GABLE→Garlic,
BRINJALS→Cabbage, MIX VEGETABLES→Beetroot, GRAPES WHITE→Avocado. Also not
random. **A reader holding a catalogue in mind starts seeing catalogue words on
the page.** We had been handing one call three dense pages *and* four hundred
product names and asking it to transcribe and identify at the same time, and
the transcription is what gave way.

So: the reader now only reads, the matching is its own call, and the arithmetic
is decided by the document rather than by either of them.

## The row already knew

`lib/platform/docu/row-arithmetic.ts` (new, pure). The purchase order prints
four numbers per row and only three are independent, because it also prints the
nett. So we stop asking a model which columns pair and ask the row:

    48 × 15.75 = 756.00  ← the paper says 756.00. This one.
     4 × 15.75 =  63.00
 4 × 48 × 15.75 = 3024.00

Four hypotheses — `quantity × price` (the ordinary row, tried first because the
overwhelming majority of order lines are that), `unit_qty × cost`,
`bulk_qty × cost`, `bulk_qty × unit_qty × cost` — against the printed total, at
`moneyMatches` tolerance from `line-audit.ts` rather than a second opinion about
what "close enough" means. The set that reproduces the total wins and populates
qty / unit / unit price, and stamps `arithmetic_basis` so the decision is
inspectable rather than a silent rewrite.

**When nothing reconciles, nothing is touched.** The row stands exactly as
extracted and `12ff849`'s red ring asks the human. That restraint is the whole
guarantee: a row quietly rewritten into agreement with its own total is
precisely how R13,457.60 became R25,958.95.

Fixture verdicts: Avocado → `unit_quantity`, qty 48 @ 15.75 = 756. Pineapple →
`unit_quantity`, 18 @ 24.83 = 446.94 (and a paper that rounds it to 447 still
reconciles, on the relative tolerance). Cucumber → 60 @ 22.90 = 1,374.
`GRAPES WHITE 2 @ 659 = 1318` → `quantity`, untouched. It needed the reader to
capture `bulk_quantity` / `bulk_unit` / `unit_quantity`, which the prompt now
demands with the column semantics spelled out — *the unit cost is the price of
one unit quantity, never of a bulk pack.*

## Luna reads, and Luna matches — but they are two calls

`ORDER_EXTRACT_PROVIDER` (default **openai**) + `OPENAI_ORDER_MODEL` (default
`gpt-5.6-luna`). Raw `fetch`, no new npm dependency: the whole of what we need is
one POST carrying a base64 image. Verified live against the API —
`gpt-5.6-luna` is accepted and returns the transcription; `temperature` is
rejected outright ("Only the default (1) value is supported") and `max_tokens`
is rejected in favour of `max_completion_tokens`, so neither is ever sent.

The Anthropic path is **not** decommissioned. It is the fallback for every
failure and it serves every PDF order outright, because the chat-completions
image part takes images and reaching for a second endpoint shape for one file
type is not worth it. When the fallback runs, the document says so:
`extraction_model` now records provider **and** model, and `extraction_warning`
carries the API's own error text onto the review screen beside it. A silent
fallback is a document read by a model nobody chose, and that already cost an
afternoon once.

The matching agent (`lib/platform/docu/order-match-agent.ts`, pure, +
`lib/ai/order-match-call.ts`, transport) is a second independent call per
document over a **relaxed** shortlist — floor 0.2 rather than `SUGGEST_FLOOR`'s
0.5, because a shortlist is not a recommendation, it is what the agent is
permitted to consider, and "MUSHROOM GABLE" against "Mushrooms Portabellini"
scores far below 0.5 and is exactly the sort of pairing only a reader settles.
Lines the deterministic gate settled at `AUTO_MATCH_FLOOR` (0.9) **bypass it
entirely**.

**Every invariant is re-enforced in code on the way back out, not left to the
prompt.** An id must be on that line's own shortlist; the qualifier guard, the
pack guard and the document-wide duplicate pass all re-run over the agent's
answer; `none` produces an unmatched row with the paper's words, no price and no
auto-invoice; and a failed call returns no decisions, which leaves every
deterministic verdict exactly where it was. The agent can improve on the gate or
be absent. It cannot loosen it.

Live, against the fixture catalogue, Luna returned:

> GRAPES WHITE → **none** ("white grapes do not match the only candidate, which
> is black grapes") · PATTY PAN YELLOW → **none** · MUSHROOM GABLE → **none** ·
> MIX VEGETABLES 2 PKT → **Mixed Vegetables** (98%)

Four of the seven failures above, refused or fixed, by a model whose only job on
that call was to choose.

## Two holes the fixtures found, both on the DETERMINISTIC path

Neither is about the agent, and both are worse than the thing the agent was
added for.

**`Avocado (box)` and `Avocado (kg)` both scored 1.0.** `normalizeName` throws
packaging words away — correct for spotting that "Apples-Golden (kg)" and
"Apples Golden" are one product, catastrophic for pricing an order line. Against
a paper reading `FF - AVOCADO BOX` the matcher scored both catalogue rows at
perfect identity, took whichever it iterated first, and `AUTO_MATCH_FLOOR` waved
it through **at 100% confidence**. Whichever way that coin landed, half of those
invoices bill a box at a kilogram's price. The paper's own unit column settles
it and nothing else can, so pack compatibility is now checked **before**
similarity is consulted, on the deterministic path and the agent's alike.

**"PATTY PAN YELLOW" and "Tomato-Yellow Cocktail" share exactly one token:
`yellow`.** `qualifiersConflict` cannot catch that, because the two names
*agree* about yellow — which is the whole problem. A colour is an attribute;
every yellow thing in the catalogue has it. So `sharesOnlyQualifiers` refuses
any pair whose entire overlap is a qualifier. Sharing *nothing* is not caught
and does not need to be: a candidate with no overlap scores 0 and never reaches
a shortlist at all.

## The keyboard

`ad4b49c` mounted `ProductSuggestInput` in the invoice editor and stopped there
— so the ORDER screen, the one where a description decides which product a line
is matched to and priced from, still had plain inputs. Fixed.

And `hooks/useGridNavigation.ts`, shared by both editors because a keyboard
learned on an invoice should not have to be learned again on an order. ↑/↓
always move a row; ←/→ move only when the caret is already at the edge of its
text, so the thing meant to make checking easier does not make correcting
"560.90" harder; Enter moves down; **Tab is left entirely alone** — it is the
platform's own answer to "next field" and a reimplementation would only be a
worse copy. The active cell takes the burnt-orange accent (`#BE5D23`) over
150ms, `scrollIntoView({block:'nearest'})` smooth, and none of the motion under
`prefers-reduced-motion`.

Selects **move rather than spin**: ↑/↓ would natively change the value, so
arrowing down a column of units would silently rewrite every unit it passed
through. Changing a billed unit stays an explicit act.

Coexistence with the suggestion dropdown is one boolean: the grid ignores any
event that is already `defaultPrevented`, so whatever the typeahead has taken it
keeps, and Esc closing the list is all it takes for the next arrow to move a
row. No registry, no coordination. `inGrid` covers the two things that boolean
cannot — ↓ on a closed list must not open it, and the list must not open on
ARRIVAL, without which arrowing into the product column opens a dropdown nobody
asked for and traps the next keystroke inside it.

**This one WAS verified in a browser**, unlike the last two waves: a throwaway
harness route, real trusted key presses, every rule above, and the orange ring
visibly following focus. The route was deleted before committing.

## Gates

`npx tsc --noEmit` — clean. `npm test` — **899 pass / 0 fail** (862 + 37: the
arithmetic resolver's verdicts on the fixture rows and its refusals, and the
matching agent's shortlisting, parsing and five invariants). `npm run build` —
clean. `npx eslint .` — 50 errors / 40 warnings, exactly the baseline.

`OPENAI_API_KEY` must be added to **Vercel** as well as `.env.local`, or the
deployed order lane falls back to Anthropic on every upload and stamps a warning
on every document saying so.

---

# The bench that said we were wrong

Turn 'n Slice reported the order reader had been "near perfect on any document,
handwritten or printed" before 2026-08-20, and since then garbles names and
digits **differently on every run** — yesterday "Graphis"/560.90, today "Oranges
White Box"/50.90/a duplicate Apple row/"Mushroom Garlic 461" — on
`claude-sonnet-4-6` and on `gpt-5.6-luna` alike.

The obvious suspect was the prompt hardening. "TRANSCRIBE, DO NOT INTERPRET —
never substitute an expected word" reads exactly like an instruction that would
strip a model of the error-correction priors that make it good at a blurred
photo, and it landed in the same day as the regression. **It is not the bug.**
`scripts/extraction-bench.mjs` was built to test that theory and refuted it.

## The forensic diff, 28c1da2^ → HEAD

Three things moved in the order lane that day, not one:

| # | what | where | commit |
|---|------|-------|--------|
| 1 | order reads left `EXTRACT_MODEL` (**haiku-4-5**) for a new `ORDER_EXTRACT_MODEL` (**sonnet-4-6**) | `lib/ai/anthropic.ts:40` | `129456b` |
| 2 | the default provider became **openai / gpt-5.6-luna**; Anthropic demoted to fallback | `lib/ai/order-reader.ts:39` | `02a25ef` |
| 3a | schema `+raw_description`; "ONE ENTRY PER ROW"; "NEVER COMPUTE OR INFER A VALUE"; catalogue clause hardened | `ORDER_EXTRACT_INSTRUCTION` | `129456b` |
| 3b | schema `+raw_amount`; the TRANSCRIBE clause; the amount-column cross-check | same | `12ff849` |
| 3c | prompt extracted to `lib/ai/order-prompt.ts`; schema `+bulk_quantity/bulk_unit/unit_quantity`; two-column clause; catalogue clause **shortened** to "leave it alone"; printed-PO added to the doc types and to the `customer_name` cues | `lib/ai/order-prompt.ts` | `02a25ef` |
| 4 | order `max_tokens` 4000 → 8000 (invoices are 16000) | `lib/ai/anthropic.ts` | `129456b` |

**The image pipeline did not change.** `app/api/ai/extract/route.ts:67` is
`Buffer.from(await file.arrayBuffer()).toString('base64')` today and was before
28c1da2 — no resize, no re-encode, no quality change, no EXIF handling either
way. Multi-page is unchanged too: a PDF goes as one `document` block carrying
**all** pages on the Anthropic path, and there has never been an N-image call —
a multi-image order is N `documents` rows read separately. One thing that *did*
change: `02a25ef` made a PDF order **throw** on the OpenAI path
(`order-reader.ts:92`) and bounce to Anthropic, so with Luna in front every PDF
order silently switched provider mid-flight.

## The bench

`scripts/extraction-bench.mjs`. Ground truth is the 22-line Bakubung purchase
order reassembled from the three suites that already hold pieces of it
(`docu-order-line-match`, `docu-row-arithmetic`, `docu-order-line-totals`),
rendered as a NebulaPOS-style page with headless Chrome and then **degraded** —
lens blur, lost contrast, ~2° rotation, uneven light, downscale, JPEG crush — at
`light | heavy | brutal`. It takes `~/Desktop/bakubung/*.jpg` instead when those
exist. The pre-yesterday prompt is not transcribed into the harness; it is
recovered at run time from `git show 28c1da2^:lib/ai/anthropic.ts`, and the
current one is imported from `order-prompt.ts` itself.

**`light` measured nothing.** Every variant but the pre-yesterday one scored
100% / 100%; a crisp render of an HTML table is a document every model reads
perfectly. The reading below is at `heavy`.

| variant | rows | names | qty | cost | nett | digits | self-agreement |
|---|---|---|---|---|---|---|---|
| **HEAD prompt · sonnet-4-6** (n=4) | 22.0 | **100%** | 73% | 55% | 61% | **63%** | 58% |
| PRIORS prompt · sonnet-4-6 (n=4) | 22.0 | **100%** | 50% | 31% | 31% | 37% | 50% |
| HEAD prompt · haiku-4-5 | 23.0 | 73% | 31% | 6% | 6% | 14% | **0%** |
| PRIORS prompt · haiku-4-5 | 22.5 | 77% | 21% | 0% | 3% | 8% | 4% |
| HEAD prompt · gpt-5.6-luna | 21.5 | 68% | 3% | 3% | 50% | 4% | 64% |
| PRIORS prompt · gpt-5.6-luna | 22.0 | 82% | 0% | 0% | — | 0% | 64% |
| PRE prompt · haiku-4-5 (28c1da2^) | 20.0 | 75% | 19% | 0% | — | 10% | 43% |

**Winner: the prompt we already have, on the model the fallback already uses.**

## What the numbers say

**The hardening is load-bearing, not harmful.** HEAD beats the priors-allowed
rewrite by 26 points of digit accuracy on the same model with no cost to names,
and the four-run ranges do not overlap (63% spread 55–71 vs 37% spread 32–45).
The `uncertain: true` flag the priors variant buys its honesty with fires on
21.5 of 22 rows — a flag on everything is a flag on nothing.

**The pre-yesterday prompt is worse on both axes**, and worse in ways nobody
would take back: it drops the entire unit-cost column on a printed PO ("orders
usually have no prices"), it names **Turn 'n Slice** as the customer because it
has no printed-purchase-order cue, and it still resolves SWEET CORN to Baby
Sweet Corn — the R46.40-vs-R375 bug `129456b` exists to prevent.

**Haiku was never the good reader.** `129456b` recorded a belief that Haiku "did
the reading well and the deciding badly" and moved the lane to Sonnet on the
deciding. The reading half was never measured, and it is false: Haiku invents a
23rd row, drops rows it read the run before, returns "AVOCADO WHITE" for GRAPES
WHITE and "BUTTERFLY WHOLE" for BUTTERNUT WHOLE, and agrees with itself **0%**
of the time across two runs of one image. Zero self-agreement *is* the symptom
Josh described.

**Luna is the regression.** It does not misread the document so much as decline
it: nearly every unit price and amount comes back blank (3% and 4%), and the
names it does return carry inventions — "Bananas Bunch", "Strawberries Pun",
"Baby Marrows 2" for MIX VEGETABLES — that no downstream gate can catch, because
a plausible product name is not a detectable error. It has been the production
default since `02a25ef`, shipped ahead of any measurement.

## What changed

- **`ORDER_EXTRACT_PROVIDER` defaults to `anthropic`** again
  (`lib/ai/order-prompt.ts`). An unrecognised value now stays on the default
  instead of switching, so a typo cannot move the lane onto the losing model.
- **The prompt is untouched.** The bench says leave it, and a note above
  `ORDER_EXTRACT_INSTRUCTION` says why, with the numbers, so the next person to
  suspect that clause reads the result before deleting it.
- **The fallback ladder runs both ways.** It only knew how to fall from OpenAI
  to Anthropic, purely because of which provider was in front the day it was
  written; an Anthropic outage had no second chance at all.
- **Order `max_tokens` 8000 → 16_000**, the invoice ceiling. The 22-line page
  peaks at ~2.6k output tokens, which leaves 8000 looking safe right up until a
  60-line document arrives — and a truncated read comes back as **valid JSON
  with rows missing**, the one failure mode nothing downstream detects.
- Everything prompt-independent is **kept exactly as it is**: total-first row
  arithmetic, the matching honesty gate, the gross cross-check, provenance
  display, `raw_amount` capture. `raw_amount` is not a cost — the variant that
  captures it reads 100% of names; the one that does not reads 75%.
- **`tests/docu-order-prompt.test.ts`** exists at last. `order-prompt.ts` has
  claimed that file by name since `02a25ef` without one, which is how every
  clause below could have been softened by anyone without a single thing going
  red. 17 tests pinning the contract — the TRANSCRIBE rule, the never-infer
  rule, the four fields post-processing depends on, the note fencing, the
  coercion's refusals, and the provider default.

## Gates

`npx tsc --noEmit` — clean. `npm test` — **916 pass / 0 fail** (899 + 17).
`npm run build` — clean. `npm run lint` — 50 errors / 40 warnings, exactly the
baseline; not one is in a file this wave touched.

`.bench/` is gitignored: it holds renders and raw model responses.

## Doc-U order lane — the reader was never the problem (routing wave)

Turn 'n Slice re-uploaded the Bakubung purchase order and got 13 of 22 rows
right: five invented product names (Carrots White, Spinach Box, Microgreens
Garlic, Tomato Flavourst Yellow, Cabbage Green), five digit slips (560.90,
459.00, 66.50, 92.00, 32.50), no customer name, no "Read by …" stamp, and the
two rows `row-arithmetic.ts` exists to rescue — Avocado shown as 4 @ 15.75 =
R63 against a printed 756.00, Pineapple 3 @ 24.83 = R74.49 against 447.00 — not
rescued.

**Every one of those is the same bug, and it is not a reading bug.**

### The root cause: `/api/ai/extract` picked the wrong reader

The order branch was gated on `doc.document_type === 'order'`. Only two
surfaces pre-type the row — the OrderFlow drop (`/api/ai/agent/ingest-document`,
which classifies first) and a manual TypePicker change. **The chat/Doc-U drop
and the upload page file rows UNTYPED**: `uploadDocument` inserts no
`document_type` at all, because everywhere else the classifier decides it.

So a customer order dropped into the chat fell straight past the order branch
into `extractDocument` — the INVOICE reader. That reader has no order prompt, no
TRANSCRIBE clause, no two-column rule, and no `raw_amount`/`unit_quantity`
fields. It therefore:

- never runs `applyRowArithmetic` → the avocado row is never rescued;
- never writes `extraction_model` → "Read by …" has nothing to render and
  silently vanishes, which is exactly why Josh could not find it;
- never writes `customer_name` → "No customer name was read" about a page with
  **Purchaser: Bakubung Bush Lodge** printed on it.

Three symptoms, one line of code. The invented names are what a generic invoice
reader does with a produce order — note that **carrots, spinach and microgreens
do not appear anywhere on the paper**.

**Fix**: when the row arrives untyped, classify first and route on the answer —
the same thing `ingestDocument` has always done. A pre-typed row costs nothing
extra; an untyped non-order reuses the classification rather than re-reading.
Only an untyped order costs two calls, which is the right price for using the
right reader.

### The reader itself is perfect on this document

`scripts/extraction-bench.mjs` grew a `--resolution` axis and was pointed at the
real photo (`~/Desktop/bakubung/IMG_3960.JPG`, 5712×4284, 3.8 MB). Two runs per
cell, HEAD prompt:

| resolution | uploaded | Claude sees (std tier) | sonnet-4-6 | sonnet-5 |
|---|---|---|---|---|
| native | 5712×4284, 3.81 MB | 1257×942 (1530 tok) | **100% / 100%** | 95% / 100% |
| px3200 q90 | 3200×2400, 1.75 MB | 1264×948 (1564 tok) | **100% / 100%** | 91% / 100% |
| px2000 q80 | 2000×1500, 0.55 MB | 1270×952 (1564 tok) | **100% / 100%** | 95% / 100% |
| px1500 q70 | 1500×1125, 0.27 MB | 1267×951 (1564 tok) | **100% / 100%** | 93% / 100% |

(names / digits; customer read correctly in every cell.)

**Resolution does not matter, and the vision docs say why.** Claude resizes every
image to the model's own budget first: standard tier (which `claude-sonnet-4-6`
is) gets 1568px long edge AND 1568 visual tokens at one 28×28 patch each, so a
4:3 page lands near 1270×950 whether you upload 5712px or 1500px. The 2000px
downscale everyone suspected was never the constraint — the column headed
"Claude sees" is identical across all four rows.
(https://platform.claude.com/docs/en/build-with-claude/vision)

Sonnet 4.6 reads all 22 rows and every digit correctly at every size. Sonnet 5
(high-res tier, 2576px / 4784 tokens) is no better and marginally worse on
names — its only real miss is transcribing "BUCKET" as "BUCCKET". **There is no
model or resolution change worth making here.** The prod failures were never
this reader's output.

### The bench's answer key was wrong, and the bench said so

The first real-photo run scored every variant at exactly 55% names / 57% digits
— eight runs, two models, four image sizes, zero spread. That is a constant, not
a measurement, and the constant was the distance between `GROUND_TRUTH` and the
paper: it had been *reconstructed* from three test suites before any photo
existed, and carried NAARTJIES, BANANAS, BUTTERNUT and TOMATOES ROUND, while the
real order has BRINJALS, BROCCOLI, GINGER CRUSHED, GARLIC CRUSHED, LETTUCE MIXED
and MUSHROOM GABLE. The readers were right; the answer key was wrong.

`GROUND_TRUTH` is now transcribed off the photograph (PO #16537, 22 lines, two
pages) and **audits itself at import**: every row's `each × cost` must reproduce
its printed nett, and the 22 netts must sum to the paper's own Total of
13,457.60. They do. A wrong answer key does not announce itself — it produces a
plausible table in which nothing is better than anything else.

### What changed

- **`app/api/ai/extract/route.ts`** — classify untyped rows before choosing the
  reader; stamp `image_pixels`. The root-cause fix.
- **`lib/platform/docu/order-review-lines.ts`** (new) — the editor's opening
  rows extracted from a `useState` initialiser into a pure module, so "does this
  screen open on post-arithmetic numbers?" is answerable without React. That
  seam did not exist, which is why nothing went red for a fortnight.
- **`OrderReviewEditor.tsx`** — uses it; **"Read by …" moved to the Items
  header** as a pill, and **absence is now rendered** ("Reader not recorded")
  rather than skipped. A missing stamp used to look identical to a feature that
  was never built, and post-fix an unstamped order means the invoice reader read
  it — the one document a reviewer should distrust.
- **`lib/ai/order-prompt.ts`** — the buyer cue now names the labels a printed PO
  actually uses ("Purchaser", "Ordered By", "Bill To", "Invoice To", "Customer",
  "Account Name") and names the trap explicitly: "Deliver To"/"Ship To" is the
  business receiving the order and is never the customer.
- **`lib/platform/docu/image-size.ts`** (new) — JPEG/PNG header reader (no
  decoder, no dependency; steps over the EXIF thumbnail by segment length) plus
  a `low_resolution` flag when the long edge is under 1568px — the point below
  which *we*, not the model, are the binding constraint. Stamped by both write
  sites, so "was the photo too small?" stops being unanswerable after the fact.
- **`order-ingest-client.ts`** — OrderFlow drop 2000px/q0.82 → 2600px/q0.85.
  2600px is the smallest cap that feeds the high-res tier fully; q0.85 not q0.9
  because this path posts base64-in-JSON under Vercel's 4.5 MB edge limit.
- **Vyso Mobile `lib/documents.js`** — 2000px/q0.8 → 2600px/q0.9 (`b2c2a03`,
  pushed). Not a fix for these misreads — it removes a silent ceiling on any
  future high-res-tier read, and q0.9 cuts second-pass JPEG artifacts on small
  tabular figures. JS-only, so OTA-able once build 3 ships.

### Gates

`npx tsc --noEmit` — clean. `npm test` — **937 pass / 0 fail** (916 + 21 new:
`docu-order-review-lines` ×7, `docu-image-size` ×9, `docu-order-prompt` +5).
`npm run build` — clean. `npm run lint` — 50 errors / 40 warnings, exactly the
baseline; not one is in a file this wave touched. Mobile: `npx expo export
--platform ios` — clean.

---

## Doc-U order lane — the review screen learns (customer-scoped product links)

Every wave before this one made the matcher *better at refusing*. That was the
right direction and it is why the Bakubung order can no longer be invoiced at
twice its value — but a matcher that only refuses hands the same question to a
human forever. Turn 'n Slice's reviewer answered "VEG - SWEET CORN PKT Each is
Sweet Corn" on Monday, and on Thursday the same customer's order asked again,
because the answer lived exactly as long as the page did.

It now lives in `cd_customer_item_aliases` — the table `orderflow-from-doc.ts`
has always consulted *before* the matcher, and which until now only ever
contained rows somebody typed into a settings screen in advance. Almost nobody
does that in advance. The place the knowledge appears is the review screen, at
the moment somebody looks at the amber bubble and picks the product.

### Scoped to one counterparty, and that is the claim rather than a limitation

"Strawberries → Strawberry Punnets 250g" learned for Indaba is a fact about how
Indaba writes their orders. It says nothing whatever about Sandton Sun, and a
system that generalised it would be manufacturing a guess and then printing
"Learned from your confirmation" beside it — strictly worse than the fuzzy match
it replaced, because the reviewer now has every reason to trust it and no way to
see that nobody ever confirmed it for *them*. Every lookup is keyed by
`customer_id`; there is no org-wide variant and there should not be one. (The
org-wide table is `pp_name_aliases`, scoped that way for the opposite reason: it
maps what a *supplier* prints onto our catalogue, where there is one truth.)

### Precedence, unchanged in shape

A learned link is a pin, and pins already sat at the top of the ladder:

1. **Customer-scoped alias** — exact key match → auto-link, confidence 100,
   bypasses scoring entirely. Excluded from the matching agent's shortlist too
   (`buildAgentRequests` skips anything already matched at ≥ the auto floor), so
   Luna is never asked to second-guess a human.
2. Deterministic gate (`AUTO_MATCH_FLOOR` 0.9, qualifier + pack guards).
3. The matching agent, on what the gate could not settle.
4. `refuseDuplicateProducts` over the lot — **including the pins**. A learned
   link buys no exemption from one-product-one-line: two paper rows landing on
   one product is a lost line whoever decided the mapping.

### The key is deliberately blunt

`aliasKey` is lowercase + collapsed whitespace + trim, and explicitly **not**
`normalizeName` — which throws packaging words away and would therefore fold
"SWEET CORN PKT" and "SWEET CORN BOX" onto one key. That is right for spotting
duplicate products and catastrophic here: a learned link decides which SKU gets
billed, and the pack decides the price.

### The pack guard, demoted on a line a human ruled on

Everywhere else a pack disagreement is fatal. On a pinned line it is a note:
"The paper counts this line in pkt, and you linked it to a product sold by the
kg." The human's ruling stands — overruling it would mean a confirmation made in
August silently stops working the week the customer's POS changes its wording.

**A dormant guard found while doing this, deliberately left dormant.**
`bestCatalogueCandidate`'s pack guard has never run in the order path: nothing
has ever passed `unit` into `resolveOrderLines` from `orderflow-from-doc.ts`, so
`lineUnit` is always null there. This wave passes the unit **for pinned lines
only** (that is what feeds the note above). Arming it for unpinned lines changes
*which lines match* on every order in the system — safe in direction (it refuses
rather than mis-bills) but not a side effect to smuggle in under a UI feature.
Its own wave, with the bench run against it.

### UX states

| State | Colour | Sentence |
|---|---|---|
| matcher refused, nothing confirmed | amber | "…not matched · closest: Sweet Corn (kg) (80%)" (unchanged) |
| confirmed, customer known, saving | amber | "Saving Sweet Corn (kg)…" |
| confirmed, customer known, stored | **green** | "Saved. We'll remember this link for next time — Sweet Corn (kg)." |
| confirmed, **customer unknown** | amber | "Linked for this order. Pick the customer and we'll remember it next time — Sweet Corn (kg)." |
| confirmed, save failed | amber | "Linked for this order, but not remembered — {the actual error}" |
| pinned by a learned link on a later sync | green chip | "Learned from your confirmation on 14 Aug 2026" |
| pinned by a settings-screen mapping | green chip | "From this customer's order mappings" |

The last two are two sentences on purpose. One is a decision somebody made
looking at a real document; the other is a row typed into a settings page.
Printing "Learned from your confirmation" over the second is a small,
load-bearing lie — it is the sentence that tells a reviewer *where to go* when
the link turns out to be wrong. A row written before the `source` column existed
gets the second sentence, because we genuinely do not know which it was.

Both doors into the decision now teach: the "closest: …" button *and* the
product typeahead. Only one of them used to.

### Customer unknown — held, then offered

A reviewer who confirms products before naming the customer has made good
decisions about this order and no decision at all about a counterparty. Those
links are **held, not written**, and the moment a customer is named a one-click
banner appears: "Remember 3 links for Bakubung Bush Lodge? Their next order will
match these lines on its own." Offered rather than auto-saved, and the choice is
recorded here: confirming a product is a statement about *this order*; storing a
permanent fact about a named business is a larger one, and it only ended up
implicit because the customer field was still empty. One click, with the name in
the sentence, is what makes the scope visible at the moment it is stored. A
typed name that *is* an existing customer counts as named — creating a customer
is not a side effect anybody asked for when they clicked a product.

### Supplier invoices — follow-up, not built

`ExtractionEditor.tsx` has the product typeahead but **no match provenance at
all**: no `OrderLineRecord`, no not-matched bubble, no suggestion to confirm. So
there is no equivalent confirm affordance to mirror, and the honest move is not
to invent one here. `pp_name_aliases` already has `status='confirmed'` and is
already written by `/api/procurepulse/product-alias` from the ProcurePulse
reconciliation screen; wiring supplier-scoped learning into the invoice editor
needs that editor to grow line-level match records first. Logged as follow-up.

### What changed

- **`supabase/customer-item-alias-learning.sql`** (new) — `source`,
  `document_id`, `created_by`, `updated_at` on `cd_customer_item_aliases`. The
  existing `unique (org_id, customer_id, raw_name)` already enforces the scope
  and is the upsert's conflict target; RLS unchanged (the org policy covers the
  new columns). Migration-tolerant: the write retries without the provenance
  columns if they are missing, keeping the **link** and losing only the date —
  and the screen then honestly renders it as a mapping, not a confirmation.
- **`lib/platform/docu/customer-item-alias.ts`** (new, pure) — `aliasKey`,
  `indexAliasesForCustomer` (drops other customers' rows even though the query
  already filtered them: a filter that exists only in a query string is a filter
  no test can point at), `lookupAlias`, `aliasProvenanceLabel`, and the bubble
  state machine.
- **`order-line-match.ts`** — `OrderLineResolution.packNote`; `OrderLineRecord`
  gains `alias_source` / `alias_confirmed_at` / `pack_note`. `lineUnit` moved
  above the pin branch so the pin can be sanity-checked against it.
- **`orderflow-from-doc.ts`** — uses the shared key/index/lookup; carries the
  alias provenance into the record; passes the paper's unit for pinned lines.
- **`OrderReviewEditor.tsx`** — confirming a product (either door) upserts the
  link from the browser, RLS-scoped, like every other write on this screen; the
  bubble; the pending banner; the unmatched banner no longer counts a line the
  reviewer has since answered (a banner that keeps counting answered questions
  teaches people to ignore it, which is the only way it can fail).
- **`product-suggest.ts` + `app/app/docu/[id]/page.tsx`** — `ProductOption.kind`.
  The list mixes catalogue rows with alias-only rows, and the picked id is now
  written into a column with a foreign key onto `pp_stock_items`. Only
  `kind: 'product'` is offered a learned link.
- **`orderflow-activity.ts`** — `customer_item_link_learned`. A learned link
  silently re-prices every future order carrying that wording; who made it and
  when should not be something only the database knows.

### Gates

`npx tsc --noEmit` — clean. `npm test` — **958 pass / 0 fail** (937 + 21 new in
`docu-customer-item-alias`: the key, the no-leak case, precedence, the duplicate
invariant over pins, the pack note, provenance wording, the state machine).
`npm run build` — clean. `npm run lint` — 50 errors / 40 warnings, exactly the
baseline; none in a file this wave touched.

---

## Doc-U order lane — the annotations were never written (a budget, not a gate)

The Bakubung purchase order re-uploaded through the chat after the routing fix
read almost perfectly — "Read by anthropic/claude-sonnet-4-6", "Bakubung Bush
Lodge · 97% sure", Avocado 48 × 15.75 = 756, Mix Vegetables 20 × 66.9 = 1,338 —
and arrived on the review screen with **every per-row annotation gone**: no
amber "Paper said … → not matched · closest: …", no green learned-link chip, no
"Priced from your price list" / "Price read off the document" line under a
single row.

### What produces them, and what did not run

Every annotation on that screen is drawn from one field:
`documents.extracted_data.order_lines` — an `OrderLineRecord[]` written by
`syncOrderFromDocument` in `orderflow-from-doc.ts` after the document-wide
matching pass in `order-line-match.ts`. `order-review-lines.ts` pairs those
records onto the editor's rows **by the paper's own words**, and
`OrderReviewEditor` gates the whole annotation strip on `l.record`. No record,
no strip — and, crucially, **a row with no record renders identically to a row
that matched perfectly**.

Two hypotheses were wrong and are worth writing down as wrong.

**The routing fix did not skip the matching pass.** `98d0750` left
`syncOrderFromDocument` exactly where it was, awaited inline in the order branch
of `/api/ai/extract`. The pre-typed OrderFlow drop and the newly-routed untyped
upload run the *same* call on the same line.

**`cc5f005` did not gate the annotations behind a new null field.** Its editor
diff is additive — the alias chip and the pack note are new *inside* a strip
whose gate (`r || bubble.kind !== 'none'`) predates it.

### The actual cause: three sequential model calls inside a 60-second route

The database settles it. Two uploads of the same purchase order that morning:

| Document | Uploaded | `order_lines` | `of_orders` |
|---|---|---|---|
| `c2d7f60f` | 07:25:17 | **22 records** | created 07:26:14 — **57s later** |
| `745ac9ca` | 08:01:39 | **absent** | none |

Fifty-seven seconds against `export const maxDuration = 60`. The second upload
went over and the invocation was killed. Everything *before* the kill had
already committed — `status: 'extracted'`, 22 line items, the customer, the
reader stamp — which is why the screen looked healthy. The write *after* it
never happened, and that write is the entire provenance layer.

The order lane costs three sequential model calls now, and the routing fix is
what added the third:

1. `extractDocument` — the classify read, paid by every **untyped** upload
   (chat, Doc-U drop, upload page). This is `98d0750` and it is correct.
2. `extractOrderDocument` — the order reader.
3. `runOrderMatchAgent`, inside the sync — **whose own `timeoutMs` was 90_000**.

A sub-call budgeted for ninety seconds inside a sixty-second invocation is not a
slow agent; it is a guarantee that the work after it never runs. It was equally
wrong inside `/api/orderflow/order-from-document` (`maxDuration` 60), which has
carried the same latent failure since the agent landed.

### The fix

- **`app/api/ai/extract/route.ts`** — `maxDuration` 60 → **300**, matching the
  `/api/agents/*` routes. The sync stays **awaited inline**, not moved into
  `after()`: `PublishOrderButton` navigates on `orderSync.orderId` from the
  response body, and an `after()` callback cannot put it there. The chat's own
  60s watch is unaffected — it already says "Still reading — it'll appear in
  Doc-U when done" and walks away, which is now true rather than a euphemism for
  a half-written document.
- **`lib/ai/order-match-call.ts`** — `ORDER_MATCH_AGENT_TIMEOUT_MS = 30_000`,
  exported and named. Generous for a JSON reply about a handful of unsettled
  lines, and it leaves room in *every* route budget for the writes that follow.
  A timeout here was never an error: the agent returns `[]` and the
  deterministic verdicts stand.
- **The sync's failure is no longer silent.** It stays best-effort — a document
  that read correctly must not be marked errored because the matcher could not
  run — but `{ ok: false, reason }` and a thrown error are both logged now.
  "The annotations are missing" was diagnosable only by reading the database.

### The editor degrades honestly, and offers the one-click repair

`noMatchPass` — no row carries a record — now renders above the unmatched
banner, because it is the stronger statement: that one says "3 of these lines
are questions", this one says **"none of them were ever asked"**.

> **Products aren't matched yet.** No line below has been checked against your
> catalogue or priced from it, so this screen can't tell you which ones it is
> unsure of. Matching runs when you confirm — or run it now to see the answers
> first. **[Run matching]**

**Why a button and not a page-open trigger.** Running the pass on open would
mean *looking* at a document creates customers, creates products, and — when the
customer is known and every line matches and prices — issues an invoice. None of
that may be a side effect of navigation. Behind a button it is a chosen action,
and the outcome is the one the killed invocation owed the reviewer anyway: the
same endpoint the Confirm button already uses, with `finalize: false`, so
`syncOrderFromDocument` makes exactly the decision it would have made at 08:01.
The invoice number appears on screen the moment it does.

The rows are **re-paired, not rebuilt** (`attachRecords`, lifted out of
`buildReviewLines`): anything the reviewer has typed stays, and `raw` — the
paper's own words, which no edit touches — is the join key. A row that matches
nothing keeps the record it had, so a partial write can only ever add
annotations, never strip them.

### The test, and the seam it needed

`docu-order-review-lines.test.ts` walks a real model response to the editor's
opening rows and stops there, which is exactly why it stayed green through this:
it never asks whether anything *wrote* the provenance those rows are supposed to
carry. `tests/docu-order-annotations.test.ts` continues that walk **through the
sync** — the same `syncOrderFromDocument` the route calls, on the same persisted
`extracted_data` — against a fake PostgREST client. The matcher, the pricer, the
record builder and the pairing are all real.

The seam did not exist and two small changes made it:

- **`syncOrderFromDocument` takes an optional `matchAgent`.** Lazily imported by
  default, because `@/lib/ai/order-match-call` pulls in `server-only` and the
  OpenAI transport, and `node --test` resolves neither the `@/` alias nor those
  modules. Injected in the test, so the audit trail is proven not to depend on a
  network call.
- **`orderflow-from-doc.ts` and `coredata.ts` now use `.ts`-suffixed relative
  imports** (the house style for every module `node --test` loads directly).
  `allowImportingTsExtensions` was already on.

The load-bearing assertion is the third one: the records must pair onto **every**
row. `strip_order_prefixes` defaults on for a known customer and this document
creates one, so a sync that ever stored the *stripped* name would silently
un-annotate every prefixed line — which is every line on a Turn 'n Slice order.

The learned-link flow is untouched (the editor diff removes exactly one import
line and adds the rest); `docu-customer-item-alias`'s 21 tests over the amber →
"Saving…" → green "Saved. We'll remember this link" state machine still pass.

### Josh's current document

`745ac9ca` does **not** need a re-upload. It has no `order_lines` and no
OrderFlow order, so it opens on the new banner; **Run matching** builds both and
the annotations appear in place. A re-upload would work too and costs a second
read of the same photograph for nothing.

### Gates

`npx tsc --noEmit` — clean. `npm test` — **963 pass / 0 fail** (958 + 5 new in
`docu-order-annotations`). `npm run build` — clean. `npm run lint` — 50 errors /
40 warnings, exactly the baseline.

# Unlock every module for every org — pay-gating removed (2026-08-24, branch `main`)

Per `.ai/plan_unlock_all_modules.md`: focus shifted from OrderFlow to
ProcurePulse, and modules are no longer pay-gated. Every org — existing and
future — now gets every module. There was no payment integration anywhere;
the "pay-gate" was entirely `organisations.locked_modules` plus the two
onboarding RPCs that populated it.

### What changed

- **`supabase/unlock-all-modules.sql` (new).** One-shot, idempotent migration
  Josh pastes into the Supabase dashboard SQL editor: `update organisations
  set locked_modules = '{}'` for every existing row, then `create or replace`
  of `onboarding_create_org` and `onboarding_choose_modules` copied verbatim
  from `supabase/onboarding.sql`, with only the locking logic changed (see
  below). Ends with a commented verification query.
- **`supabase/onboarding.sql`** — the canonical file — updated in place with
  the same two function-body edits, so a fresh environment bootstrapped from
  it matches production:
  - `onboarding_create_org`: seeds `locked_modules = '{}'` instead of
    "everything except Doc-U".
  - `onboarding_choose_modules(p_modules text[])`: signature and validation
    (exactly 3 distinct valid non-docu keys, none `= 'docu'`) are unchanged
    on purpose — the RPC call from the client stays a drop-in. Only the
    locking logic changed: it now always sets `locked_modules = '{}'`
    instead of computing "the 5 keys the caller didn't pick." Still advances
    `onboarding_stage` to `'data'` exactly as before.
  - `locked_modules` itself is **not** dropped — it stays as dormant
    kill-switch plumbing (useful later for abuse/offboarding); it's
    data-driven, so empty data means nothing is locked. Comments in both SQL
    files call this out explicitly.
- **`components/platform/onboarding/StageModules.tsx`** — the "pick 3
  modules" onboarding step. Removed the 3-of-N selection cap entirely: every
  module (Doc-U + the rest) now renders as a static "Included" row instead of
  a togglable button, and the copy changed from "Choose your modules" /
  "Your 14-day trial includes Doc-U plus any 3 modules" to "All modules are
  included" / "nothing to pick, nothing locked." The RPC call is kept exactly
  as the server still expects it: since `onboarding_choose_modules` still
  validates "exactly 3 distinct valid non-docu keys" server-side (left alone
  per the plan), the component still sends 3 keys (the first 3 non-docu
  modules, arbitrarily — which 3 no longer matters, since the RPC discards
  them and always unlocks). `onDone(...)`, which feeds `StageData.tsx`'s
  "what your data unlocks" list, now receives **every** module key instead of
  just the chosen 3, so that downstream copy reflects what's actually true
  without needing any change to `StageData.tsx` itself.
- **`components/platform/onboarding/OnboardingFlow.tsx`** — updated the
  Finch intro copy for the `modules` stage to match ("Your full toolkit" /
  "every module... nothing to pick and nothing locked") instead of the old
  "pick your toolkit" / "choose the three" copy.

### Constraints honored (per plan, not touched)

`locked_modules` column, `ModuleLockGuard`, sidebar lock UI, `moduleOpen`
server checks, `TrialGate`, `org_features` seeding, the TEMPORARY features
loop in `supabase-server.ts`, RLS policies, `Vyso Platform/shared/modules.ts`
and its mobile mirror, and all demo-org SQL files
(`demo-all-in-one.sql`, `morco-users-roles.sql`, `tns-users-roles.sql`,
`org-locked-modules.sql`).

### Deviations from the plan

- The plan's Step 1 sketch only mentions the `update` statement and the two
  `create or replace` bodies, ending with a commented verification query. The
  actual `unlock-all-modules.sql` also repeats the `grant execute on
  function ... to authenticated` statements after each function (present in
  `onboarding.sql` immediately after each definition). This is not one of
  the plan's listed diffs, but `grant` is idempotent/harmless to re-run and
  keeps the one-shot migration self-sufficient if pasted into a project
  where the grants somehow lapsed. No functional effect either way — the
  grants already exist.
- Step 3 said "smallest blast radius on `onboarding_stage` transitions" and
  left the exact UI shape ("keep the screen... or restyle") to the
  implementer. Chose to keep the screen, keep the RPC call and its
  server-side "exactly 3" validation completely untouched (no SQL beyond
  what Step 1/2 already specify), and only change what the client sends/
  displays. This also touched `OnboardingFlow.tsx`'s stage-intro copy (one
  string), which the plan's file list didn't call out by name but is part
  of the same module-picker screen's presented copy.

### Gates

`npx tsc --noEmit` — clean. `npm run lint` — 50 errors / 40 warnings, the
same pre-existing baseline (none in the files touched by this change; the
repo already had unrelated uncommitted changes in `VysoAIModal.tsx`,
`WasteLog.tsx`, `categories.tsx`, wastewatch `shared.tsx`, and others before
this task started). `npm test` — **963 pass / 0 fail**, no change in count.

## ProcurePulse categorisation fix — Turn 'n Slice (2026-08-24)

Plan: `.ai/plan_procurepulse_manufacturing.md`, Phase A only. Josh's complaint
was "no products categorised" — all 963 Turn 'n Slice `pp_stock_items` rows sat
at `category IS NULL`, so the dashboard donut showed 100% Uncategorised.

### What was actually wrong

`categoriseProducts()` in `lib/ai/anthropic.ts` already carried a
fresh-produce taxonomy (Fruit / Vegetables / Herbs / Salad & Leafy Greens /
Mushrooms / Other) — it was never the Meridian FMCG set (Field Produce /
Prepared Lines / Dairy & Chilled / …) the plan's recon flagged as a
possibility. The categorisation *feature* (route + button) was already
wired up in `app/api/procurepulse/categorise/route.ts` and
`LiveStockView.tsx`; it had simply never been run for Turn 'n Slice. The
taxonomy was missing two buckets a produce wholesaler's real catalogue needs
— dried/frozen/tinned goods and packaging/container line items were both
being forced into "Other" — so it was widened to match the plan's target
eight-category list rather than left as-is.

### Changes

- `lib/ai/anthropic.ts` — `PRODUCE_CATEGORIES` and `CATEGORISE_SYSTEM` now
  list eight categories instead of six: added `Dried & Processed` (dried
  fruit, nuts, seeds, frozen produce, tinned goods, juices, sauces) and
  `Packaging` (punnets, boxes, crates, bags, pallets, cartons). Endpoint
  batching/auth in `categorise/route.ts` untouched, as scoped.
- `lib/platform/procurepulse.ts` — added a `'Dried & Processed': '#7A5AA8'`
  entry to `CATEGORY_COLORS` (a colour distinct from every existing slice).
  `Packaging` already had a colour from the Meridian taxonomy sharing the
  same object, so no new entry was needed there.
- `scripts/categorise-tns.ts` (new) — one-off runner. Finds the Turn 'n
  Slice org the same tolerant way `supabase/tns-users-roles.sql` does
  (`organisations.name ilike '%turn%slice%'`, oldest match) rather than a
  hardcoded id, since the org id must never be guessed. Reads
  `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` from `.env.local` by
  hand (same pattern as `scripts/backfill-price-watch.ts`, for the same
  reason: `lib/ai/anthropic.ts` is `server-only` and cannot be imported from
  a plain node/tsx process). Duplicates the `categoriseProducts()` transport
  at the byte level rather than importing it, fetches only rows with a
  NULL/blank `category` for that org, runs them through Claude Haiku in the
  same 120-per-batch chunks as the route, writes `category` back, and prints
  a per-category distribution. Only ever touches NULL rows, so re-running it
  is a safe no-op once the catalogue is filled in.

### Ran it

Both keys were present in `.env.local`. `npx tsx scripts/categorise-tns.ts`:

```
Turn 'n Slice org: Turn 'n Slice (a24f858b-b40b-4824-bc29-8818f034d44b)
963 stock items total, 963 uncategorised.
Running 9 categorisation batch(es) of up to 120...
Updated 963/963 item(s).

-- category distribution --
  Vegetables               384
  Fruit                    209
  Dried & Processed        139
  Salad & Leafy Greens     97
  Herbs                    59
  Other                    41
  Mushrooms                32
  Packaging                2
  TOTAL                    963
```

0 NULL remaining — every row got a category on the first pass, none needed a
retry.

### Deviations from the plan

- The plan's step 1 was conditional ("if its prompt taxonomy is the Meridian
  FMCG set…"); it wasn't, so that branch didn't apply. The taxonomy was
  still widened from six to the plan's full eight-category list, since that
  part of the instruction wasn't conditional.
- Did not touch anything in Phases B/C's reserved list (`supabase/pp-batches.sql`,
  `app/api/procurepulse/batch`, batches UI, `lib/ai/finch/*`,
  `app/api/ai/agent/route.ts`, `app/app/procurepulse/layout.tsx`, recipes
  pages, `app/app/procurepulse/page.tsx`).

### Gates

`npx tsc --noEmit` — clean. `npx eslint lib/ai/anthropic.ts
lib/platform/procurepulse.ts scripts/categorise-tns.ts` — clean, no new
issues. `npm run lint` (full repo) — same pre-existing 50 errors / 40
warnings baseline as the entry above, none in the three files this task
touched (all pre-existing failures are in `wastewatch/*`,
`instrumentation-client.ts`, `price-watch/run.ts`, `posthog-server.ts`).

## ProcurePulse Manufacturing — Batches (Phase B) (2026-08-24)

Implements `.ai/plan_procurepulse_manufacturing.md` Phase B only: the
Recipes tab becomes Manufacturing (Recipes + Batches sub-nav), and logging a
batch — pick a recipe, adjust the weights actually used, confirm — now
writes real stock movements (ingredients down, output up) instead of just
planning against live stock the way the existing Recipes page already did.
Phase A (categorisation) landed separately above; Phase C (chat-driven
logging on Finch) is not part of this pass.

### B1 — migration `supabase/pp-batches.sql`

- `pp_recipes.output_stock_item_id` (nullable, `on delete set null`): links
  a recipe's free-text `output_product` to a real `pp_stock_items` row so a
  batch has something to increment. Learned the first time a batch resolves
  or creates one (see B2) — no backfill needed, existing recipes just start
  unlinked.
- `pp_batches` (header) + `pp_batch_ingredients` (lines), same
  header/ingredient-lines shape as `pp_recipes`/`pp_recipe_ingredients`.
  `pp_batches.recipe_id` is `on delete set null` (not cascade) with
  `recipe_name` denormalised onto the row: a batch is a historical stock
  movement record, so deleting or renaming the recipe it came from must
  never erase or relabel that the stock actually moved. `source` is
  `'manual' | 'chat'` (checked) even though only `'manual'` exists yet, so
  Phase C needs no further migration.
- Indexes: `(org_id, created_at desc)` on `pp_batches`, `(batch_id)` on
  `pp_batch_ingredients`. RLS: both tables get the verbatim
  `pp_recipes_all`-shaped org-scoped policy.
- The plan's `pp_movements.reason` CHECK-constraint step turned out to be
  moot: grepped the base schema (`Vyso Platform/supabase/schema.sql:298-308`)
  and every `supabase/pp-*.sql` migration in this repo — `reason` is plain
  `text` everywhere, no CHECK exists to extend. Documented that finding in
  the migration file instead of adding a guarded `alter`. The route still
  degrades to a looser reason on insert failure (see B2), so it keeps
  working unattended if a CHECK is ever added later.
- `'batch_produced'` added to `MOVEMENT_LABEL` in
  `app/app/procurepulse/page.tsx` ("Produced from batch") — the one edit the
  plan explicitly pre-cleared against Phase A's file list.

### B2 — API `app/api/procurepulse/batch/route.ts`

Pure logic (output-resolution precedence, per-ingredient movement deltas,
floor-at-zero decrement) lives in `lib/platform/procurepulse/batch-logic.ts`
so it's testable without a database; the route is fetch-inputs-then-call.

Auth: `resolveUser(req)` (like `categorise/route.ts`), then a `profiles`
lookup for `org_id` (the `app/api/ai/agent/route.ts` pattern —
`resolveUser` only authenticates, it doesn't scope by org). Every insert is
explicitly `org_id`-stamped on top of RLS, matching the rest of
`/api/procurepulse/*`.

**`POST` contract** (Phase C should code against this):

Request:
```jsonc
{
  "recipe_id": "uuid",                    // required
  "ingredients": [                        // optional, defaults to []
    { "stock_item_id": "uuid|null", "product_name": "string", "qty_used": 0.6, "unit": "kg|null" }
  ],
  "output": {                             // optional — all fields optional
    "stock_item_id": "uuid",              // explicit output pick (highest precedence)
    "qty": 12,                            // falls back to the recipe's output_qty
    "unit": "kg"                          // falls back to the recipe's output_unit
  },
  "notes": "string",                      // optional
  "source": "manual" | "chat"             // optional, defaults to "manual"
}
```

Success response (200):
```jsonc
{
  "ok": true,
  "batch_id": "uuid",
  "output": { "stock_item_id": "uuid", "name": "Mixed Veg", "new_on_hand": 12 },
  "movements": 3   // count of pp_movements rows actually written (ingredients + output)
}
```
Errors: `401` (no session / no org), `400` (`recipe_id` missing), `404`
(recipe not found or not this org's), `500` with `{ "error": "…" }` —
`friendly()` names `supabase/pp-batches.sql` when the tables/column are
missing (mirrors `recipe/route.ts`'s `friendly()`).

Behaviour:
1. Load the recipe (404 if missing/foreign).
2. Resolve the output product via `resolveOutputProduct()`:
   `output.stock_item_id` → `recipe.output_stock_item_id` → a fuzzy match
   against the org's catalogue using `scoreProductName` (accept floor 0.85,
   `docu/product-suggest.ts`'s substring tier — anything looser risks
   silently posting onto the wrong product, worse than a duplicate a human
   can merge) → else **create** a new `pp_stock_items` row
   (`on_hand: 0`). If the recipe had no `output_stock_item_id`, the
   resolved/created id is written back onto it (learned link).
3. Insert the `pp_batches` header + `pp_batch_ingredients` lines (every
   named ingredient is recorded, even ones with no `stock_item_id` — audit
   trail of what was actually used).
4. Ingredient lines WITH a `stock_item_id` and positive `qty_used` each get a
   `pp_movements` row (`change: -qty_used`, `reason: 'recipe_consumed'`,
   `source_label: 'Batch: <recipe name>'`) and `on_hand` decrements, floored
   at 0. Unresolved lines move no stock (recorded, not zeroed).
5. The output gets one positive movement (`reason: 'batch_produced'`) and
   `on_hand` increments. Both movement inserts retry with a looser reason
   (`'used'` / `'received'`) on failure — dead code today (B1 found no CHECK
   constraint to reject anything) but keeps the route working if one is
   added later, same shape as `order-stock/route.ts`'s `adjustOnHand`
   degradation.
6. `GET` returns `{ ok: true, batches: [...] }` — the org's 50 most recent
   batches, newest first, feeding the Batches page's recent list.

### B3 — UI

- `components/platform/procurepulse/ui.tsx`: the top-level tab renamed
  `Recipes` → `Manufacturing` (same `href`, `/app/procurepulse/recipes` — no
  URL changes).
- New `app/app/procurepulse/recipes/layout.tsx` (scoped to this section
  only — Dashboard/Products/etc. are untouched) renders
  `components/platform/procurepulse/ManufacturingSubnav.tsx`, a small
  two-link nav (Recipes / Batches) using the same `usePathname`-active-tab
  idiom as `PpSubnav`.
- New `app/app/procurepulse/recipes/batches/page.tsx` (server component,
  same shape as `recipes/page.tsx`) + `components/platform/procurepulse/BatchLogger.tsx`
  (client): typeahead recipe picker → ingredient rows prefilled from
  `qty_per_batch` (editable) → output qty prefilled from the recipe
  (editable) → Confirm posts to `/api/procurepulse/batch` → success message
  + refreshed recent-batches list. Styled to match `AddStockButton.tsx` /
  `RecipeEditor.tsx` (same input/card classes, same typeahead-dropdown
  pattern).
- `recipes/page.tsx` gained a "Log batch" button in the `PageHead` header,
  linking to the Batches page.
- `lib/platform/types.ts` (website copy only — see Deviations): added
  `Recipe.output_stock_item_id`, plus new `Batch` / `BatchIngredient`
  interfaces for `pp_batches` / `pp_batch_ingredients`.

### B4 — tests `tests/pp-batches.test.ts`

15 pure-logic tests against `batch-logic.ts`, `node:test` + `.ts`-suffixed
relative imports (no `@/` alias, matches `docu-product-suggest.test.ts`'s
`.ts` import style):
- `resolveOutputProduct`: explicit beats linked beats fuzzy beats create,
  each tier only firing when the one before it produced nothing; a
  below-floor name creates rather than guesses; an empty catalogue always
  creates.
- `ingredientMovements`: one negative delta per resolved positive-qty
  ingredient; unresolved (`stockItemId: null`) and non-positive/non-finite
  lines are dropped, not zeroed; custom reason honoured.
- `outputMovement`: positive qty passes through; negative/NaN floors to 0.
- `floorOnHand`: the actual never-negative-stock guarantee, plus a
  non-numeric current value treated as 0.

### Deviations from the plan

- **No `pp_movements.reason` CHECK-constraint ALTER.** Per B1 above, none
  exists to guard against; documented the finding in the migration comment
  instead of writing a speculative `alter ... drop constraint / add
  constraint` against a constraint name that doesn't exist. The route's
  degradation logic is written as if one might exist, so nothing regresses
  if a future migration adds one.
- **`lib/platform/types.ts` only updated in this repo.** Its header states
  it's mirrored byte-identical from `Vyso Platform/shared/types.ts` into
  `mobile/lib/types.ts` and here. Phase B's scope is the Vyso Website repo;
  I did not touch the other two copies. Follow-up: port
  `output_stock_item_id` / `Batch` / `BatchIngredient` into
  `Vyso Platform/shared/types.ts` (and re-copy to mobile) if/when mobile or
  another surface needs them — they're additive, so the copies just being
  behind isn't currently breaking anything.
- Did not touch `lib/ai/anthropic.ts`, `scripts/`, or the `CATEGORY_COLORS`
  block of `lib/platform/procurepulse.ts` (Phase A's territory, per
  instruction). Phase C's files (`lib/ai/finch/*`, `app/api/ai/agent/route.ts`,
  chat tool/card work) are untouched — out of scope for B.

### Gates

`npx tsc --noEmit` — clean. `npm run lint` (full repo) — 90 problems (50
errors / 40 warnings), same pre-existing baseline the Phase A entry above
already reported (51/41 before this task's own two lint fixes — see below —
netted it down by one error and one warning); zero errors or warnings in
any file this task touched (`supabase/pp-batches.sql`,
`lib/platform/procurepulse/batch-logic.ts`,
`app/api/procurepulse/batch/route.ts`,
`components/platform/procurepulse/{ManufacturingSubnav,BatchLogger}.tsx`,
`app/app/procurepulse/recipes/{layout,batches/page}.tsx`,
`app/app/procurepulse/recipes/page.tsx`, `app/app/procurepulse/page.tsx`,
`components/platform/procurepulse/ui.tsx`, `lib/platform/types.ts`,
`tests/pp-batches.test.ts`). Two lint issues were fixed along the way, both
in code this task wrote: an `eslint-disable-next-line no-console` in
`batch/route.ts` that ESLint flagged as unused (the repo's config doesn't
gate `no-console` there — removed), and `BatchLogger.tsx`'s mount-time
`useEffect` calling a named async helper that (eventually) sets state —
`react-hooks/set-state-in-effect` flags that even when the helper's first
statement is an `await`, not just a synchronous `setState()`; inlined the
fetch as an IIFE instead, the same shape `AddStockButton.tsx`'s mount effect
already uses. `npm test` — **978 pass / 0 fail** (963 from Phase A's baseline
+ 15 new `pp-batches.test.ts` cases, all passing).
`npm test` — **963 pass / 0 fail**, no change in count.

## ProcurePulse Manufacturing — chat-driven batch logging (Phase C) (2026-08-24)

Implements `.ai/plan_procurepulse_manufacturing.md` Phase C: Finch's workflow
tier moves to `gpt-5.6-luna` (C1) and gains `pp_prepare_batch_log`, a
read-only tool that turns "used butternut 0.6 kg and broc 1.0 kg, create a
product entry using recipe mixed veg" into a confirm card whose button posts
to Phase B's `POST /api/procurepulse/batch` with `source: 'chat'` (C2).
Phases A and B are above; this pass codes against B's route contract and
changes none of it.

### C1 — the workflow tier's provider switch

- `lib/ai/finch/config.ts`: `workflowProvider()` reads
  `FINCH_WORKFLOW_PROVIDER` and answers `'openai'` unless it is literally
  `anthropic`; `workflowModel()` answers `FINCH_WORKFLOW_MODEL ||
  'gpt-5.6-luna'` on the OpenAI path and the unchanged `WORKFLOW_MODEL`
  (`ANTHROPIC_WORKFLOW_MODEL || 'claude-sonnet-4-6'`) on the Anthropic one.
  `WORKFLOW_MAX_TOKENS = 4096` is new and larger than the Q&A cap because on
  gpt-5.x reasoning tokens bill against `max_completion_tokens`, and a turn
  that exhausts it comes back empty with no error. `AGENT_MODEL` (Haiku) and
  the chat titler are untouched — the Q&A tier did not move.
- `lib/ai/openai.ts`: ONE new export, `openaiChatStream(body, {signal})`.
  Nothing existing was changed, so the Doc-U/OrderFlow extraction lane
  (`openaiJson` → `order-reader.ts`, `order-match-call.ts`) is byte-identical.
  It shares the key handling and the verbatim-error rule and returns the raw
  streaming `Response`; the frames are the caller's to parse.
- `lib/ai/finch/openai-loop.ts` (new): the whole OpenAI agentic loop —
  streaming chat-completions, per-`index` accumulation of streamed tool-call
  deltas, the assistant/`tool` message pair, tools withheld on the final
  allowed turn. It emits nothing itself: every visible effect goes through
  callbacks the route wires to the SSE frames it already sends
  (`{text,turn}`, `{interim}`, `{tool}`, `{card}`, `{orderDraft}`), so the
  client reader needed no change to consume a different provider.
  `reasoning_effort: 'none'` is sent on every request — mandatory with
  function tools on chat-completions, else the API 400s — and `tool_choice`
  is deliberately NOT sent ('auto' is already the default).
- `app/api/ai/agent/route.ts`: one branch, `useOpenAiWorkflow`. The Anthropic
  loop is intact below it (its `max_tokens` now reads the shared `maxTokens`,
  which is `AGENT_MAX_TOKENS` on every path it previously took). The two
  per-tool `if` blocks that emitted `orderDraft`/`card` were factored into
  `sideEffectFrame(name, content)` so both loops draw the same cards from the
  same table — that is what makes the env flip a true revert.
- `OPENAI_API_KEY` is present in `.env.local` (checked by presence, not
  printed).

### C2 — `pp_prepare_batch_log` + the confirm card

- `lib/ai/finch/batch-draft.ts` (new): the resolution rules as pure functions
  (`resolveByName`, `resolveIngredient`, `resolveRecipe`) plus
  `prepareBatchLog`, which reads and drafts and **never writes**. No
  `server-only`, relative `.ts` imports — the procurepulse-data.ts convention,
  so `node --test` can load it. Three outcomes, not two: matched, `ambiguous`
  (candidates handed back for the MODEL to ask about), `unresolved`.
  `pp_name_aliases` is consulted FIRST and is not scored — a confirmed alias
  is a human who already ruled on that name. `NAME_ACCEPT = 0.85` is
  `scoreProductName`'s substring tier (every dice/fuzzy guess scores strictly
  below 0.8), the same floor `batch-logic.ts` uses for a batch's output;
  `TIE_MARGIN = 0.04` is the tie-breaker that turns two equally-good matches
  into a question. Output resolution re-uses B2's `resolveOutputProduct`
  verbatim so the card can say `action: 'existing' | 'create'` — the route
  re-runs it for real at confirm time and its answer is the one that counts.
  Calling the tool with only a recipe name prefills that recipe's own
  `qty_per_batch` lines, matching the Batches screen.
- `lib/ai/finch/tools.ts`: `pp_prepare_batch_log` added to
  `PROCUREPULSE_TOOLS` with `workflow: true` (so ProcurePulse's bubble and the
  Brief both reach it, via the existing `TOOLS_BY_MODULE` spreads) plus a
  `toSpokenIngredients` coercer. The registry header now says "three
  exceptions".
- `lib/ai/finch/order-intent.ts`: new `LOG_BATCH_RE` / `looksLikeBatchRequest`
  beside the order one — same file, same reason (one copy, two readers).
  Josh's own sentence never says "batch", so it is caught by `recipe`
  appearing alongside a used/made/create verb; "log a batch" and "made a batch
  of" are the short forms. Verified against 7 positives and 5 negatives
  (stock, price-history, order-building and debtors questions all stay on the
  Q&A tier).
- `app/api/ai/agent/route.ts`: `wantsBatchWorkflow` escalates a ProcurePulse
  or Brief turn on that regex — server-side only, so the client needed no new
  flag (there is no sticky arm to keep: a batch is one sentence, not a
  negotiation). `buildBatchCard` mirrors `buildHubdocCard` (only an `ok:true`
  prepare becomes a card) and a `pp_prepare_batch_log` activity line was added.
- `lib/ai/finch/knowledge.ts`: `MANUFACTURING_KNOWLEDGE` spliced into the
  ProcurePulse and Brief docs, plus a `batchSection` in the system prompt
  gated on the workflow tier. Most of both is about what NOT to say: never
  claim a batch has been logged, always ask about `ambiguous`, always name
  `unresolved` as recorded-but-not-stock-moving, always say whether the output
  creates a new product. The ProcurePulse screen list now says "Manufacturing
  (Recipes … and Batches)".
- `components/platform/chat/BatchConfirmCard.tsx` (new): renders
  "broc → Broccoli Florets · 1 kg · 8 on hand" per line (the owner's word is
  shown only when it differs from the catalogue's), the ambiguous and
  unresolved notes, and the output with `new product, created on confirm`
  where that applies. Confirm POSTs the draft to `/api/procurepulse/batch`
  with `source: 'chat'`, unresolved lines riding along by NAME so they reach
  the audit trail while moving no stock, and no `output.stock_item_id` when
  the draft says a product will be created (the route owns that decision).
  Success replaces the button and writes one local transcript line via
  `appendAssistantLine` — a fact, not a model turn, exactly as
  `HubdocConfirmCard` does. Exports `BatchCards` for the chat-page surface.
- `components/platform/shell/FinchChatProvider.tsx`: `BatchConfirmDockCard`
  added to `DockCard`; `parseCardEvent` became a two-`kind` switch with
  `parseBatchCard` defaulting every list to empty and every number to 0.
  `components/platform/chat/OrderCards.tsx` draws it in the bubble;
  `GlobalChatDock.tsx` draws `<BatchCards />` beside `<HubdocCards />`.
- `tests/finch-batch-tool.test.ts` (new, 19 cases): "broc" → the broccoli
  product; an exact name beating a longer prefix match; two broccoli lines
  returning candidates rather than a pick; the `CANDIDATE_LIMIT` cap; unknown
  and blank names landing in `unresolved`; confirmed aliases winning over an
  ambiguous score; dismissed and dangling aliases being ignored; the same
  rules on recipes; and the two thresholds themselves.

### Deviations from the plan

- **Chat-completions, not the Responses API.** The plan allowed either and
  said to follow the repo's existing luna convention — which is raw-`fetch`
  chat-completions (`lib/ai/openai.ts`). Taken, with the `reasoning_effort:
  'none'` requirement the plan flagged. Smoke-tested live against the real
  API with the exact body this loop sends: HTTP 200, the tool call streamed
  back correctly parsed (`{"recipe_name":"mixed veg","ingredients":[{"name":
  "broccoli","qty":1,"unit":"kg"}]}`), so the model id, the parameter set and
  the delta accumulation are all confirmed rather than assumed.
- **`lib/ai/finch/runtime.ts` untouched.** The plan named it alongside the
  route as a place the OpenAI loop might live. It is the Anthropic client
  module and the OpenAI path needs nothing from it, so the loop went into its
  own file instead; `sanitizeMessages` is still the one entry point for
  validating a conversation.
- **The route's two card `if` blocks were factored into one helper.** Not in
  the plan, but writing the third one inline would have meant the OpenAI loop
  either duplicating the table or drifting from it — the exact failure the
  order-intent regex's own file header describes.
- **The tool also accepts a recipe name alone.** The plan's schema has
  `ingredients` as a field; making it optional (prefilling the recipe's
  per-batch quantities) costs one query and makes "log a batch of mixed veg"
  work the way the Batches screen does.
- **`confirm_token` is returned and carried on the card but not verified by
  the route** — identical to `hubdoc_prepare_send`, and for the same reason:
  the confirm route re-authenticates the caller and re-resolves the recipe
  against their own org, so the token identifies a prepared batch rather than
  authorising one.

### Gates

`npx tsc --noEmit` — clean. `npm run lint` (full repo) — 90 problems (50
errors / 40 warnings), exactly the baseline Phase B recorded above;
`npx eslint` over the thirteen files this pass touched reports **zero new
issues** (the single error it lists in `app/api/ai/agent/route.ts` —
`@next/next/no-assign-module-variable` on the `module` local — is
pre-existing and was confirmed identical on a stashed tree). `npm test` —
**997 pass / 0 fail** (978 from Phase B + 19 new `finch-batch-tool.test.ts`
cases).

## ProcurePulse Manufacturing — the picker was dead, units were free text (2026-08-24)

Josh's production report on Batches (Phase B, above): "batches do nothing",
"no typeahead for created recipes", and ingredient/output units are "just a
typable field" instead of the units the org actually measures in. Bug fix +
UX pass, `BatchLogger.tsx` and `RecipeEditor.tsx` only — the batch route's
contract, the chat/Finch path, and the migration are all untouched.

### Root cause of the dead picker

`BatchLogger.tsx`'s recipe-match `useMemo` short-circuited to `[]` whenever
`query` was empty:

```ts
const matches = useMemo(() => {
  const q = query.trim().toLowerCase();
  if (!q || recipeId) return [];
  return recipes.filter((r) => r.name.toLowerCase().includes(q)).slice(0, 8);
}, [recipes, query, recipeId]);
```

Focusing the input fires `onFocus={() => setOpenPicker(true)}`, but with
`query` still `''` at that point `matches` stayed empty, so the dropdown
never rendered (`openPicker && matches.length > 0`) until the user typed a
substring that matched a name. With the org's one recipe ("New recipe"),
that reads exactly as "no typeahead for created recipes" — there was nothing
wrong with the org's data, the picker just never showed anything to click
without the user first guessing the right characters to type. This was the
actual cause of "batches do nothing" too: the Confirm button, ingredient
rows and output fields only render once a recipe is picked (`{!recipe ? ...
: (...)}`), so a picker that never surfaces a recipe means the rest of the
form is unreachable — nothing downstream needed fixing on its own.

Fix: extracted the filter into a pure `filterRecipes(recipes, query, max)`
(`lib/platform/procurepulse/batch-logic.ts`) that returns every recipe for
an empty query and a case-insensitive substring match otherwise; the
component now calls it unconditionally on focus. Confirmed no second bug in
the confirm→POST path: `BatchLogger`'s payload
(`recipe_id`, `ingredients[].{stock_item_id, product_name, qty_used, unit}`,
`output.{qty, unit}`, `notes`, `source}`) matches
`app/api/procurepulse/batch/route.ts`'s parsed body field-for-field — the
route's `str()`/`num()` coercions accept exactly what the client sends,
including `unit: null` for an unset value. The Confirm button is now also
gated on `canConfirm` (recipe selected AND output qty parses to a number
`> 0`) so a blank/zero output can't be submitted, per the "quantities valid"
requirement — it was previously gated only on `busy`.

### Unit dropdowns

Both components already show ingredient rows and an output line; the unit
field was always a bare `<input>`/text span with no relationship to what the
linked stock item was actually counted in. New rule, applied identically in
both:

- **Linked to a stock item** (`row.stock_item_id` set, or the recipe's
  `output_stock_item_id` resolves to a catalogue row): the unit is shown
  read-only as that item's OWN live unit (looked up via `itemById`, not
  whatever was last saved on the recipe/ingredient row) — a batch decrements
  that item's `on_hand`, so the unit the math uses has to be the item's, not
  a stale copy that can drift.
- **Unlinked / free text**: a new `UnitPicker` (`<select>` + "Other…" → a
  small text input) replaces the free-text `<input>`. Populated from
  `distinctItemUnits()` (new, `lib/platform/procurepulse/units.ts`) — the
  org's own `pp_stock_items.unit` values, deduped case-insensitively and
  sorted, NOT the existing `allUnits()`/`BUILT_IN_UNITS` list (that one is a
  fixed conversion-engine vocabulary plus the opt-in `pp_settings.custom_units`
  used by Products/Doc-U/OrderFlow — a different concept from "what's this
  org's stock actually denominated in today", and this org's real data
  (`pkt`, `250gr pkt`, `bx`, `bushels`, …) is exactly the messy case a fixed
  list would fight). The field's own current value is folded into the option
  list before rendering, so a `<select>` can always represent what's already
  saved even if no other stock item uses that unit — "Other…" is only for
  typing a genuinely new one.
- `unitOptions: string[]` is built server-side — `distinctItemUnits(items.map(i
  => i.unit))` — in both `app/app/procurepulse/recipes/batches/page.tsx` and
  `app/app/procurepulse/recipes/[id]/page.tsx` (both already run `fetchStock`)
  and passed down as a plain prop. No new API route, per the task's
  constraint.
- `RecipeLite` (`BatchLogger.tsx`) gained `output_stock_item_id` so the
  Batches page can apply the same lock rule to the output line that
  `RecipeEditor` already could via `Recipe.output_stock_item_id` — the
  Batches server page now maps that field through from `fetchRecipes()`.
- `RecipeEditor.save()` and `BatchLogger.confirm()` both resolve the unit
  they actually POST from the live linked item when one exists, not the
  free-text field, closing the drift window between "recipe says kg" and "the
  stock item is actually counted in boxes" that motivated this rule.

`UnitPicker` is duplicated (not shared) between the two files, matching the
existing house convention of duplicating small pure helpers like
`sanitizeDecimal` per component rather than a premature shared UI import;
`distinctItemUnits()` itself is the one place the dedupe/sort logic lives.

### Tests — `tests/pp-batches.test.ts` (+12 cases)

- `filterRecipes`: empty/whitespace query returns every recipe (the
  focus-with-no-input case that was broken); a single-recipe org still
  surfaces on focus; case-insensitive substring filtering; no match → `[]`;
  the `max` cap.
- `distinctItemUnits`: case-insensitive dedupe keeping first-seen casing;
  alphabetical case-insensitive sort; blank/null/undefined entries dropped;
  the org's actual messy unit list (`boxes`/`pockets`/`punnets`/…/`pkt`)
  survives with no collisions; folding in an odd current value makes it
  selectable; folding in a value already present doesn't duplicate it.

### Verification

Login-gated: `.env.local` points at the production database and no test
credentials were available in this session, so browser verification of the
picker/dropdowns against the live org (1 recipe, "New recipe" — Butternut/kg,
Broccoli/head) was not possible; per the task's fallback instruction this
pass relied on component-level reasoning plus the gates below instead. The
Confirm button was never exercised (per instruction — it would move real
customer stock).

### Gates

`npx tsc --noEmit` — clean. `npm run lint` (full repo) — 90 problems (50
errors / 40 warnings), same pre-existing baseline as Phase B/C above;
`npx eslint` over the seven files this pass touched
(`components/platform/procurepulse/{BatchLogger,RecipeEditor}.tsx`,
`lib/platform/procurepulse/{batch-logic,units}.ts`,
`app/app/procurepulse/recipes/{batches/page,[id]/page}.tsx`,
`tests/pp-batches.test.ts`) reports **zero issues**. `npm test` — **1009
pass / 0 fail** (997 from Phase C + 12 new cases). `npm run build` —
succeeds, exit 0, no errors or warnings; both touched routes
(`/app/procurepulse/recipes/[id]`, `/app/procurepulse/recipes/batches`)
compiled as dynamic routes as before.

## ProcurePulse Manufacturing — recipe name mirrors its output, batches get a count (2026-08-24)

Josh's feedback, verbatim: "new recipe should become the name of the recipe
(produces {{product name}}). also, i should be able to set amount of batches
created instead of it incrementally going up by one each time and having to
retype recipe name, and rinsing and repeating." Two independent UX fixes,
`RecipeEditor.tsx` and `BatchLogger.tsx` only — no API contract, migration,
or Finch-path change.

### 1. Recipe name mirrors "Produces"

`RecipeEditor.tsx` had its own `name` state, editable in the header input and
independent of `outputProduct` — so a recipe created via `RecipesView`'s "+
New recipe" button (which POSTs `{ name: 'New recipe' }` with no output yet)
stayed literally named "New recipe" forever unless someone remembered to
retype the header too. That's exactly Josh's live recipe.

Fix: the header is no longer an input. It's a `displayName` derived value —
`outputProduct.trim() || 'Untitled recipe'` — so it updates live as the user
types in "Produces", with no second field to keep in sync:

```ts
const displayName = outputProduct.trim() || 'Untitled recipe';
```

`save()` now PATCHes `name: displayName` instead of a separately-typed `name`
state. `app/api/procurepulse/recipe/route.ts` PATCH already accepted `name`
and only ever used it as-is (`str(body.name) ?? 'Untitled recipe'`) — no
server change needed, confirmed by reading the route before touching the
client.

**Existing-data fix, confirmed by the code path, no SQL:** Josh's live recipe
already has some `output_product` value (it's in production use) but a
`name` stuck at "New recipe" from creation. With `save()` now sending
`displayName` (= the trimmed `output_product`) as `name` on every save, the
next time he opens that recipe and clicks "Save recipe" — even with no other
change — the PATCH body carries the correct name and the row is fixed. No
migration or backfill needed. (A brand-new recipe still starts as "New
recipe" until its first save with a "Produces" value filled in, per the
unchanged POST default in `RecipesView.tsx` — expected, since it has no
output yet to mirror.)

This also means recipe lists, the Batches picker (`filterRecipes` matches on
`name`), and Finch's fuzzy recipe matching all converge on the same string
going forward — one source of truth instead of two fields that could drift.

### 2. Batches count multiplier + no-reset confirm loop

`BatchLogger.tsx` previously prefilled ingredient/output quantities at
exactly 1× the recipe's per-batch amounts, and `confirm()` called
`clearRecipe()` on success — so logging N batches of the same recipe meant
picking the recipe again and retyping every quantity, N times. This is the
"incrementally going up by one... having to retype recipe name, rinse and
repeat" Josh described.

**Count input + scaling.** A new "Batches" field sits next to the recipe
picker (`batchCount` state, digits-only via `sanitizeInt`, defaulting to
`'1'`). Picking a recipe or changing the count both funnel through one
function, `applyCount(r, count)`, which calls the new pure helper
`scaleRecipePrefill` (added to `lib/platform/procurepulse/batch-logic.ts` so
it's covered by `tests/pp-batches.test.ts` without a DOM):

```ts
export function scaleRecipePrefill(recipe: RecipePrefillInput, count: number): ScaledRecipePrefill {
  const n = Number.isFinite(count) && count > 0 ? count : 1;
  return {
    rows: recipe.ingredients.map((ing) => ({
      stock_item_id: ing.stock_item_id,
      product_name: ing.product_name,
      qty_used: ing.qty_per_batch ? String(roundQty(ing.qty_per_batch * n)) : '',
      unit: ing.unit,
    })),
    outputQty: recipe.output_qty != null ? String(roundQty(recipe.output_qty * n)) : '',
    outputUnit: recipe.output_unit,
  };
}
```

An invalid/non-positive count falls back to 1 rather than zeroing every
field. `roundQty` (`Math.round(n * 1e6) / 1e6`) exists only to strip
floating-point noise (`0.1 * 3 === 0.30000000000000004`) — a stock qty never
needs more than a few decimals of precision.

Per the plan's documented simplest-acceptable behaviour, a count change
recomputes **every** row from the recipe's own per-batch numbers — it does
not try to detect or preserve a hand-edit made before the count was changed.
Hand-edits made after choosing the count (weighing on the floor rarely hits
the recipe exactly) are untouched, since nothing re-runs `applyCount` on
those keystrokes.

**Persistence is unchanged.** One `pp_batches` row per confirm, carrying the
already-multiplied quantities — no schema change, exactly as the plan
required. The only trace of the multiplier is in the notes, via a second new
pure helper:

```ts
export function appendBatchCountNote(notes: string, count: number): string {
  const trimmed = notes.trim();
  if (!Number.isFinite(count) || count <= 1) return trimmed;
  const marker = `× ${count} batches`;
  return trimmed ? `${trimmed} (${marker})` : marker;
}
```

A count of 1 leaves notes exactly as typed (no marker noise on the common
case); a blank note at a multi-batch count yields just the marker, not a
note with stray empty parens.

**No-reset confirm loop.** `confirm()` no longer calls `clearRecipe()` on
success. Instead it calls `applyCount(recipe, count)` again (re-deriving
fresh prefills at the same count) and resets only `notes` — the recipe stays
selected, the picker stays open to the same choice, and the quantities are
immediately ready for another identical run. The existing "Cancel" button is
renamed **"Clear"** (same `clearRecipe()` handler, which now also resets
`batchCount` back to `'1'`) — this is the explicit "affordance to deselect
the recipe" the plan asked for, reusing the button that already did the job
rather than adding a redundant second control.

### Tests — `tests/pp-batches.test.ts` (+9 cases)

`scaleRecipePrefill`: count of 1 reproduces the plain per-batch numbers;
multiplies every ingredient qty and the output by the count; a zero/unset
per-batch qty stays blank (not `"0"`) at any count; non-positive/invalid
counts (`0`, `-2`, `NaN`, `Infinity`) fall back to 1; floating-point noise
(`0.1 × 3`) rounds to `"0.3"`, not a long decimal; `stock_item_id`/`unit`
pass through unchanged. `appendBatchCountNote`: count ≤ 1 leaves notes
untouched (including a non-trivial trim case); count > 1 appends the `"×
N batches"` marker; blank notes at a multi-batch count produce just the
marker with no stray parens.

### Gates

`npx tsc --noEmit` — clean. `npx eslint` over the four touched files
(`components/platform/procurepulse/{RecipeEditor,BatchLogger}.tsx`,
`lib/platform/procurepulse/batch-logic.ts`, `tests/pp-batches.test.ts`) —
zero issues. `npm test` — **1018 pass / 0 fail** (1009 prior + 9 new cases).
`npm run build` — succeeds, exit 0, no errors anywhere in the output; both
touched routes (`/app/procurepulse/recipes/[id]`,
`/app/procurepulse/recipes/batches`) compiled as before.
