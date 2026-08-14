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
