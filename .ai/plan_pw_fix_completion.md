# Plan: Price Watch fix — completion seam (resume of the 2026-08-14 remediation)

Status: approved (continuation of the remediation Josh approved 2026-08-14; the
assembly agent was killed mid-`run.ts` twice). Architect: Fable.

## Context

The validated fix spec (see `.ai/implementation.md` "Backfill diagnosis") is ~95%
implemented in the uncommitted working tree. `normalize.ts`, `detect.ts`,
`match.ts`, `observe.ts`, `lib/ai/anthropic.ts`, `lib/ai/price-watch-model.ts`
are done. `run.ts` was mid-rewrite when the agent died:

- `run.ts:51` imports `normalizeLine` (new API, returns `{value, rejection}`),
  but `run.ts:950` still calls the old name `normalizeLineUnitPrice` → tsc error
  TS2304 and 3 failing tests in `tests/price-watch-run.test.ts` (96–98), all
  `normalizeLineUnitPrice is not defined`. 142/145 tests otherwise pass.
- `linesSkippedUnnormalisable` counter is declared (`run.ts:573`, init :621) but
  never incremented.
- Point drafts (`run.ts:~1016`) and `samplePricePoints` do NOT carry
  `basis`/`packsPerBox`, which `detect.ts` expects on its point inputs
  (`detect.ts:44-51`) for the series-consistency gate (`comparisonBasisOf`,
  :157-184).

## Remaining steps (ordered)

1. Swap the `run.ts:950` call site to `normalizeLine(...)`:
   - `result.value === null && result.rejection === 'no_price'` →
     `summary.linesSkippedNoPrice += 1; continue;`
   - `result.rejection === 'sub_pack_unresolvable'` →
     `summary.linesSkippedUnnormalisable += 1; continue;`
   - otherwise use `result.value` as `normalized`.
2. Thread `basis: normalized.basis` and `packsPerBox: normalized.packsPerBox`
   into (a) the draft objects passed onward to detection, and (b)
   `samplePricePoints` entries, matching the optional fields `detect.ts`
   declares. Do NOT add columns to the DB insert payload — `pw_price_points`
   has no such columns by design (`detect.ts:153` comment); basis lives only on
   the in-memory objects fed to detection. Verify how drafts flow into the
   detect call and thread accordingly.
3. Audit the tree against the remaining fix-spec items; implement any that are
   genuinely missing (check first — most exist):
   - content-level dedupe before detection on
     `(org, pw_item_id, line_supplier, invoice_date, unit_price, quantity_base)`
     with the `run.ts:577` counter incremented;
   - loud warning when a run completes with 0 successful model calls while
     model-eligible work existed.
4. If summary printing references the new counters, ensure output is truthful.
5. Gates: `npx tsc --noEmit` (pre-existing `whatsapp-ingest` errors exempt),
   `npm run lint` (pre-existing vyso-ai/wastewatch/module-ui exempt),
   `npm run test` → 145/145 (plus any tests you add for the seam; add one for
   the `sub_pack_unresolvable` → counter path if none exists).
6. Update `.ai/implementation.md` (append to the Price Watch section: seam
   completed, gate results, any deviations).
7. Commit ONLY these paths (explicit `git add` of each; never `git add -A`):
   `lib/platform/price-watch/`, `lib/ai/anthropic.ts`,
   `lib/ai/price-watch-model.ts`, `tests/price-watch-*.test.ts`,
   `.ai/implementation.md`, `.ai/plan_pw_fix_completion.md`.
   Message: `pw(5): normalization basis seam + fix completion`.
   `vercel.json` stays UNCOMMITTED (carries unrelated WhatsApp WIP — Josh
   commits it himself). If the git index is locked (another agent committing),
   wait 10s and retry.

## Constraints

- Do not touch: `vercel.json` content, `app/api/whatsapp/**`,
  `lib/platform/whatsapp-*`, `supabase/*`, `components/**`, `app/globals.css`
  (a parallel agent owns the shell work), anything outside this repo.
- No DB access, no network calls, no live model calls (tests use canned/injected
  fakes only).
- FILESYSTEM BOUNDARY (hard): every command runs inside
  `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website`. Never read, list,
  search, or stat anything outside it. No `~/Library`, no containers, caches,
  Application Support, no `mdfind`/Spotlight, no `osascript`, no `open`, no
  `defaults`. Batch verification into as few process spawns as possible.

## After this lands (Josh runbook, not the agent's job)

SQL wipe of `pw_price_points` + the 7 `agent_findings` (keep `pw_items` + 112
confirmed `pw_item_matches`) → backfill dry-run → live re-run. Expected ~263
points, 1–2 findings, first model-authored observations.
