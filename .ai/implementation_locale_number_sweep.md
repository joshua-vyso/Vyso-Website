# Implementation: sweep remaining comma-stripping numeric parses onto locale-number

Implements `.ai/plan_locale_number_sweep.md` (follow-up to `.ai/plan_locale_numeric_normalization.md`).

## Summary

Every remaining `replace(/[^0-9...]/g, '')`-style parse/sanitizer listed in the plan's
site list (sections A, B, C) now delegates to `lib/platform/locale-number.ts`
(`parseLocaleNumber` / `inferDecimalSeparator`). Public signatures and
null/0/default fallback semantics are unchanged at every site. Section D
(integer-only / non-numeric fields) is untouched, as instructed.

## A — server/lib sites (document- or import-derived values)

1. **`lib/platform/procurepulse-feed.ts`** — `parseNum`/`parsePrice` now delegate
   to `parseLocaleNumber`/take an optional `DecimalSeparator` hint. Both are
   now `export`ed (harmless, no other change) so they're testable if the
   `server-only` blocker below is ever lifted.
   - `feedDocumentToProcurePulse`: computes ONE hint via `inferDecimalSeparator`
     over the whole document's `quantity`/`unit_price`/`weight`/`total_kg`
     strings before the per-line loop, threads it into `parsePrice`,
     `parseNum` (qty) and `buildPack` (which gained an optional `hint` param —
     module-private, not part of the plan's named-signature list, so free to
     extend).
   - `computeKgPerUnit`: computes a hint PER FEEDING DOCUMENT (`hintByDoc`,
     from `linesByDoc`) since this function blends several documents into one
     weighted average and two documents are never assumed to share a
     convention.
   - Fallback semantics unchanged: `parseNum` null-on-malformed;
     `parsePrice` null-on-non-positive.

2. **`lib/platform/orderflow-data.ts`** — `statementUnitPrice` delegates to
   `parseLocaleNumber`, keeps its `> 0` guard and `unknown` signature. The
   caller (`getPriceListsData`) infers ONE hint per statement document from
   that document's `unit_price` strings (the only price field read here — no
   quantity field is read at this site, so nothing else to fold into the
   hint) and threads it through. Docstring updated per house style: its own
   `"R 78,50"` example was the exact string the old code corrupted to 7850;
   verified `parseLocaleNumber('R 78,50') === 78.5`.

3. **`app/api/procurepulse/convert-unit/route.ts`** — private `parseNum`
   delegates, takes an optional hint. ONE hint is inferred from the UNION of
   every feeding document's `quantity`/`weight` strings before the
   doc-then-line loop (the route already aggregates `totalQty`/`totalKg`
   across all of the item's feeding documents into a single weighted average,
   so one reading for that whole aggregate is the right granularity — matches
   procurepulse-feed's per-item, not per-document, question).

4. **`lib/platform/import-schema.ts`** — `coerceField`'s `'number'` case now
   returns `parseLocaleNumber(v)` directly (still null on empty/malformed —
   unchanged). `'vat_rate'` keeps its `z`/`e`/`s` prefix short-circuits and
   falls back to `parseLocaleNumber(v) ?? 0` (was `Number(...) || 0` — `?? 0`
   is the exact equivalent once the parser never returns `NaN`). No per-cell
   hint is available (each spreadsheet cell is read alone, per plan), so an
   ambiguous `"1,234"` keeps the en-thousands default (1234), unchanged from
   before. `%` suffixes are stripped by the shared parser itself, same
   outcome as the old regex.
   - Import note: had to add `.ts`-suffixing to its `./locale-number` import
     so `tests/import-schema-coerce.test.ts` can load the module directly
     under `node --test` (matches the convention already used by
     `lib/platform/docu/order-line-totals.ts` for the same reason — an
     extension-full relative import resolves fine under both Next's bundler
     and Node's native ESM loader).

## B — components parsing stored/extracted values

5. **`components/platform/ExtractionEditor.tsx`** — `lineTotal`'s reduce now
   infers one hint from all lines' `amount` strings (`inferDecimalSeparator`,
   mirroring `OrderReviewEditor.tsx`'s `lineSeparatorHint`) and sums
   `parseLocaleNumber(l.amount, hint) ?? 0` per line, replacing
   `parseFloat((l.amount ?? '').replace(/[^0-9.-]/g, ''))`.

6. **`components/platform/supplysync/Credits.tsx`** and **`CreditModals.tsx`**
   — both independent `toNumber(v: string): number` helpers now return
   `parseLocaleNumber(v) ?? 0` (was `Number(v.replace(/[^0-9.\-]/g, '')) `,
   fallback 0 unchanged). Their input fields were already free-text (no
   keystroke sanitizer existed), so no sanitizer change was needed — only the
   parse.

## C — UI keystroke sanitizers on decimal fields

All rewritten to the `OrderReviewEditor.tsx` `sanitizeDecimal` pattern —
strip only characters that can never be part of a locale-formatted number
(`[^0-9.,]`, or `[^0-9.,\s]` where a thousands space is plausible), leave
`.`/`,` alone while typing, and read the actual value via `parseLocaleNumber`
only at the point of use. Each site's existing null/0/default fallback is
preserved.

- **`OrdersView.tsx`** (qty/unit_price, lines 963/968 pre-edit) — added a
  `sanitizeDecimal` helper (none existed before; the field was previously
  hard-parsed at every keystroke via bare `Number()`). Verified where the
  state is consumed: `builderTotal`, `canSave`, and `saveOrder`'s
  `builderLines` map all called bare `Number(l.qty)`/`Number(l.unit_price)` —
  NOT an already-migrated parse path — so those four call sites were also
  switched to `parseLocaleNumber(...) ?? 0`. (The OTHER qty/price state in
  this file, `blines`/`BuilderLine` inside the separate `NewOrderBuilder`
  component, is typed as `number` already and belongs to `./builder`'s
  `LineItemsEditor`, not the two inputs the plan names — left untouched.)
- **ProcurePulse**: `ProductThresholds.tsx` (`low_threshold`, `par_level`,
  `freshness_value` — `lead_time_days` left, integer, see D),
  `RecipeEditor.tsx` (`sanitizeDecimal`, shared by `output_qty` and
  `qty_per_batch`; all three `Number(r.qty_per_batch) || 0` /
  `Number(row.qty_per_batch) || 0` sites switched to
  `parseLocaleNumber(...) ?? 0`), `AddStockButton.tsx` (qty field: sanitizer
  + `addCustom`'s parse), `ProductUnits.tsx` (`conversion_factor`: sanitizer +
  `exampleOf`/`badFactor`), `ProductsManager.tsx` (`low_threshold`,
  `avg_unit_price` — see note below), `ReorderView.tsx` (qty: sanitizer +
  the `qty: Number(qty) || 0` builder line), `BatchLogger.tsx`
  (`sanitizeDecimal`, shared by `output_qty` and `qty_used`; `canConfirm`,
  the `qty_used` map, and the `output.qty` submit all switched).
- **PricePilot**: `RecommendationsView.tsx` (`marginFor` — no separate
  sanitizer existed, field was already free-text; parse switched directly),
  `PriceListDetail.tsx` (`defaultMargin`'s sanitizer + `def`; per-row
  `setMargin`'s inline parse), `PriceListsView.tsx` (`margin`'s sanitizer +
  `create()`'s `default_margin_pct`).

### `ProductsManager.tsx` — note on why this one needed more than a one-line swap

Its `Row.low_threshold`/`avg_unit_price` were typed as `number` (unlike every
sibling ProcurePulse editor, which keeps the editable field as a raw
`string`). With a `number`-typed field, the input's `value={String(r.x)}`
necessarily **reformats on every keystroke** — typing `,` immediately
re-renders as whatever the last successfully-parsed number was, so a
comma-decimal like `"0,20"` can never actually be typed character-by-character
even with a widened sanitizer (each intermediate keystroke collapses the
comma before the next character arrives). That directly conflicts with the
plan's explicit "do NOT reformat in-progress input" instruction. Fixed by
bringing this file in line with its siblings: `Row.low_threshold` and
`avg_unit_price` are now raw strings (`avg_unit_price`'s empty string means
null, matching `ProductThresholds.tsx`'s `numStr` convention, added here
too), resolved to numbers only in `save()`'s update/insert payloads via
`parseLocaleNumber`. `rowChanged`'s dirty-check now compares strings instead
of numbers — behaviourally equivalent since both `baseline` and `working`
rows are built by the same `toRow`/edit path.

## D — left untouched (integer-only / non-numeric), as instructed

- `RecipeEditor.tsx` `sanitizeInt` (plan-qty-count field), `BatchLogger.tsx`
  `sanitizeInt` (batch count) — integer strips, unchanged.
- `ProductThresholds.tsx` `lead_time_days` — integer days, unchanged
  (`[^0-9.]` sanitizer left as-is).
- `PaymentTermsDb.tsx:61` — `draft.days.replace(/[^0-9-]/g, '')`, integer
  days field, unchanged (still shows up in the acceptance-criterion grep, as
  expected — it's an allow-listed integer-only site).
- `OrderFlowSettingsView.tsx` VAT `parseFloat` — controlled dot-only input,
  no comma-stripping pattern present at all, nothing to change.
- Everything the prior plan (`plan_locale_numeric_normalization.md`) already
  migrated, and everything it put out of scope (Microsoft ingestion, customer
  matching, `deferCommit`, `order-prompt.ts`) — untouched, not revisited.

## Latent follow-up sites noticed but NOT touched (not in the plan's site list)

Several ProcurePulse/PricePilot API routes receive these now-unstripped
strings and parse them server-side with a **bare `Number(v)`** (not the
banned `replace(/[^0-9...]/g,'')` pattern, so none of these trip the
acceptance-criterion grep — they were never flagged as bugs by the sweep this
plan targets):

- `app/api/procurepulse/thresholds/route.ts` (`num()`) — receives
  `low_threshold`/`par_level`/`freshness_value` from `ProductThresholds.tsx`.
- `app/api/procurepulse/product-units/route.ts` (`posNum()`) — receives
  `conversion_factor` from `ProductUnits.tsx`.
- `app/api/procurepulse/recipe/route.ts` (`num()`) — receives `output_qty`
  from `RecipeEditor.tsx`.
- `app/api/procurepulse/batch/route.ts` (`num()`) — receives `output.qty`
  from `BatchLogger.tsx`.

Before this sweep, a comma-decimal value typed into these fields was
corrupted client-side (magnitude-wrong) before it ever reached the server.
After this sweep, the client no longer corrupts it — but these four routes'
bare `Number()` will read a literal `"0,20"` as `NaN` → `null`, so the value
now fails safe to **not saved** rather than **saved wrong**. That is strictly
better (matches this whole effort's "null over silently wrong" principle) but
is not a full fix — these routes were not in the plan's site list (Section A
enumerated exactly `procurepulse-feed.ts`, `orderflow-data.ts`,
`convert-unit/route.ts`, `import-schema.ts`), so they were left alone rather
than invented into scope. Recommended as the next follow-up sweep.

`lib/platform/orderflow-data.ts`'s `statementUnitPrice` could not be given a
dedicated unit test: the module imports `./supabase-server`, which imports
`next/headers` — that throws under plain `node --test` outside the Next.js
runtime, so the file cannot be loaded directly. Coverage relies on
`tests/locale-number.test.ts` (the algorithm itself) plus the manual
verification recorded below (`parseLocaleNumber('R 78,50') === 78.5`).
`lib/platform/procurepulse-feed.ts` has the same problem one layer worse: it
unconditionally `import`s the `server-only` package, which throws
unconditionally (not just under `typeof window !== 'undefined'`) — so even
though `parseNum`/`parsePrice` were exported, a dedicated test file for them
was written, run, found to fail on the `server-only` throw, and removed
rather than kept in a broken state. Same reliance on
`tests/locale-number.test.ts` for algorithm coverage.

## Tests

- **New** `tests/import-schema-coerce.test.ts` — 6 cases: `'number'` with
  `"1 234,56"` → 1234.56, `"1,234.56"` (existing en import, unchanged) →
  1234.56, `"0,20"` → 0.2, malformed (`"abc"`, `"12,34,5"`) → null, blank
  (`""`, `null`) → null; `'vat_rate'` with `"15%"` → 15, `"15,00"` → 15,
  zero/exempt/standard letter codes, malformed → 0.
- Extended nothing under `tests/finch-procurepulse-data.test.ts` (that file
  tests an unrelated module, `lib/ai/finch/procurepulse-data.ts` — "extend"
  did not fit; see the `server-only` note above for why a new dedicated file
  wasn't kept either).
- `statementUnitPrice` — not directly tested; see note above.
- No component render tests added, per plan (`tsc` + lint + the existing
  1201-test suite cover the `.tsx` changes; all pass).

## Acceptance criterion 1 — final grep

```
grep -rnE "replace\(/\[\^0-9" lib app components
```

Every remaining hit is one of: (a) an explanatory comment naming the old bug
pattern (in `locale-number.ts`, `import-schema.ts`, `procurepulse-feed.ts`,
`orderflow-data.ts`, `docu/extract.ts`, `docu/invoice-from-extraction.ts`,
`lib/ai/anthropic.ts`, `convert-unit/route.ts`, and every site touched in
this sweep — all from this plan or the prior one), (b) an allow-listed
keystroke sanitizer now correctly permitting `,`/`.`
(`OrderReviewEditor.tsx`, `OrdersView.tsx`, `AddStockButton.tsx`,
`ProductUnits.tsx`, `ProductThresholds.tsx` ×3, `ReorderView.tsx`,
`RecipeEditor.tsx`, `ProductsManager.tsx` ×2, `BatchLogger.tsx`,
`PriceListDetail.tsx`, `PriceListsView.tsx`), or (c) a genuinely
integer-only field left per Section D (`PaymentTermsDb.tsx:61`,
`ProductThresholds.tsx`'s `lead_time_days`, `RecipeEditor.tsx`/
`BatchLogger.tsx`'s `sanitizeInt`). No corruption-class hit remains.

## Verification

- `npx tsc --noEmit` — 31 pre-existing errors (all `free_scan_*` analytics
  event typing under `components/finch/scan/**` and two stale
  `.next/dev/types/validator.ts` entries — unrelated to this sweep, present
  before any of these changes, none in a file this sweep touched). Zero new
  errors.
- `npm run lint` — 90 pre-existing problems (50 errors / 40 warnings, all in
  `components/platform/wastewatch/**`, `lib/platform/price-watch/run.ts`,
  `lib/platform/wastewatch-data.ts`, `lib/posthog-server.ts`,
  `instrumentation-client.ts` — unrelated). The only touched file that
  appears in the lint output is `OrdersView.tsx`, at two pre-existing lines
  (`Date.now()` in render, a `tempRef.n++` mutation) that this sweep did not
  touch — they only shifted line number because of the new `sanitizeDecimal`
  function inserted above them. Zero new lint issues.
- `npm test` — 1201/1201 passing (was already 1201 including the 6 new
  `import-schema-coerce` cases; full suite green, no regressions).

## Deviations from the plan

None material. The `ProductsManager.tsx` string-vs-number architecture note
above is the one place implementation required more than the literal
per-site instruction, and it stayed within the plan's own stated pattern
("do not reformat in-progress input") rather than inventing new behaviour.

## Route micro-sweep

Implements `.ai/plan_locale_number_routes.md`, the follow-up covering the
four "latent follow-up sites" flagged (not fixed) above. Each private
`num()`/`posNum()` helper in the four ProcurePulse save routes now delegates
to `parseLocaleNumber` instead of a bare `Number(v)`, so a comma-decimal
value the UI legitimately sends (post the sweep above) is read correctly
instead of silently discarded as `null`.

### Sites changed

1. **`app/api/procurepulse/thresholds/route.ts`** — `num()` (fields:
   `low_threshold`, `par_level`, `lead_time_days`, `freshness_value`).
2. **`app/api/procurepulse/product-units/route.ts`** — `posNum()` (field:
   `conversion_factor`), positive guard kept on top of the same delegate.
3. **`app/api/procurepulse/recipe/route.ts`** — `num()` (fields:
   `output_qty`, `qty_per_batch`).
4. **`app/api/procurepulse/batch/route.ts`** — `num()` (fields: `output.qty`,
   `qty_used`); the two `Number()` reads over DB-numeric `on_hand` values
   (lines 75 and 265, not user input) were left untouched, per plan.

Each site got a one-line why-comment (house style) noting the field now
legitimately receives comma decimals and that malformed input still fails to
`null`, never a guess — same trade-off as `coerceField`. No hint is threaded
at any of the four sites (single user-typed values, no document context), so
an ambiguous `"1,234"` still keeps the en-thousands default, unchanged.

No route's request/response shape changed; no other lines in these files
were touched. No new test files were added — these helpers are private to
`server-only` route files (same import constraint as the prior sweep) and
the algorithm itself is already covered by `tests/locale-number.test.ts`.

### Verification

- `npx tsc --noEmit` — 29 pre-existing errors, all `free_scan_*` analytics
  event typing under `components/finch/scan/**` and
  `tests/free-scan-content.test.ts` (unrelated to this change, present
  before it, none in a touched file). Zero new errors.
- `npm run lint` — 90 pre-existing problems (50 errors / 40 warnings), all in
  `components/platform/wastewatch/**`, `lib/platform/price-watch/run.ts`,
  `lib/platform/wastewatch-data.ts`, `lib/posthog-server.ts`,
  `instrumentation-client.ts` — none of the four touched route files appear
  in the output. Zero new lint issues.
- `npm test` — 1201/1201 passing, 0 failures. Full suite green, no
  regressions.

### Deviations from the plan

None. Exactly the four helpers were edited (bodies + the one new import
line + one why-comment each); nothing else in these files changed.
