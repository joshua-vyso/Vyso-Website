# Plan: Sweep remaining comma-stripping numeric parses onto locale-number

Author: Fable (architect). Implementer: subagent. Date: 2026-08-28.
Follow-up to `.ai/plan_locale_numeric_normalization.md` (read it first for the root cause and the shared module's contract).

## Goal

Eliminate every remaining copy of the comma-deleting parse pattern (`replace(/[^0-9.\-]/g,'')` → `Number()`/`parseFloat()`, and UI keystroke strips of `[^0-9.]`) by delegating to `lib/platform/locale-number.ts` (`parseLocaleNumber`, `inferDecimalSeparator`, `moneyEquals`). No behavior change for period-decimal/en input beyond the documented ambiguity rules; comma-decimal input stops being magnitude-corrupted.

## Acceptance criteria

1. No file outside `locale-number.ts` (and comments/tests referencing the old bug) contains a digit-strip numeric parse: `grep -rnE "replace\(/\[\^0-9" lib app components` returns only allow-listed keystroke sanitizers rewritten per this plan, integer-only fields, and historical comments.
2. `statementUnitPrice("R 78,50")` → 78.5 (its own docstring's example, previously 7850).
3. `coerceField("1 234,56", 'number')` → 1234.56; `coerceField("15%", 'vat_rate')` → 15; existing en imports ("1,234.56") unchanged.
4. Doc-U-derived weights/quantities/prices in procurepulse-feed and convert-unit parse comma decimals correctly.
5. UI decimal inputs (OrdersView qty/price, ProcurePulse and PricePilot decimal fields) no longer delete typed commas; the numeric value used downstream comes from `parseLocaleNumber`.
6. `npx tsc --noEmit` no new errors, `npm run lint` no new issues, `npm test` 100% pass.

## Sites and exact treatment

### A. Server/lib — document- or import-derived values (highest risk, silent corruption)

1. `lib/platform/procurepulse-feed.ts:39-51` — private `parseNum`/`parsePrice` parse Doc-U-extracted weight/price strings. Rewrite `parseNum` as a thin delegate to `parseLocaleNumber`. Hint: inspect call sites — where a whole document's/line-set's strings are in scope (e.g. the weighted-average kg recompute reading all feeding lines), compute `inferDecimalSeparator` once over that set and thread it; where only a single string is available, call with no hint. Keep `parsePrice`'s `> 0` guard and both functions' signatures.
2. `lib/platform/orderflow-data.ts:616-623` — `statementUnitPrice`. Delegate to `parseLocaleNumber`; keep the `> 0` guard and `unknown` signature. Hint: if the surrounding code iterates a statement document's lines, infer per document from those lines' price strings; otherwise no hint. Update the docstring — its own example "R 78,50" was corrupted by the old code; note that per house style.
3. `app/api/procurepulse/convert-unit/route.ts:13-19` — private `parseNum` over `ExtractedLineItem` quantities/weights. Delegate; infer the hint once from all numeric strings of the line set the route processes, thread it through.
4. `lib/platform/import-schema.ts:112,122` — `coerceField` 'number' and 'vat_rate' cases. Delegate to `parseLocaleNumber` (no hint available per-cell — document that ambiguous "1,234" keeps the en-thousands default; `%` suffix already handled by the parser). Preserve exact fallback semantics: 'number' malformed → null; 'vat_rate' malformed → 0; keep the z/e/s prefix rules untouched.

### B. Components — parse of stored/extracted values

5. `components/platform/ExtractionEditor.tsx:~82` — running-total parse of `l.amount`. Use `parseLocaleNumber` with a hint inferred once from all the lines' amount strings in scope (mirror how `OrderReviewEditor.tsx` now does it).
6. `components/platform/supplysync/Credits.tsx:44-47` and `CreditModals.tsx:~133` — `toNumber`. Delegate to `parseLocaleNumber`, keep the `?? 0`-style fallback (return 0 on null) and signature.

### C. UI keystroke sanitizers on DECIMAL fields

Pattern (copy the approach already shipped in `OrderReviewEditor.tsx` `sanitizeDecimal`, including its why-comment): while typing, strip only characters that can never be part of a number — allow `[0-9.,\s]` (or `[0-9.,]` where space is clearly never pasted) — and obtain the numeric value via `parseLocaleNumber` at the point of use. Do NOT reformat in-progress input.

- `components/platform/orderflow/OrdersView.tsx:963,968` (qty, unit_price — money-critical; if these strings later flow through already-migrated parse paths, the sanitizer fix alone suffices — verify where the state is consumed).
- ProcurePulse: `ProductThresholds.tsx:168-172` (low_threshold, par_level, freshness_value; `lead_time_days` is integer — see D), `RecipeEditor.tsx:38`, `AddStockButton.tsx:105,274`, `ProductUnits.tsx:169`, `ProductsManager.tsx:390,398`, `ReorderView.tsx:17`, `BatchLogger.tsx:51`.
- PricePilot: `RecommendationsView.tsx:43`, `PriceListDetail.tsx:57,170`, `PriceListsView.tsx:124`.

For each, find where the string becomes a number (usually an adjacent `Number(...)`/local helper) and route THAT through `parseLocaleNumber`. Preserve each site's existing null/0/default fallback semantics exactly.

### D. Leave untouched (integer-only or non-numeric)

- `RecipeEditor.tsx:43`, `BatchLogger.tsx:56` (`[^0-9]` integer strips), `ProductThresholds.tsx` lead_time_days if integer-only, `PaymentTermsDb.tsx:61` (days), `OrderFlowSettingsView.tsx` VAT `parseFloat` (controlled dot-only input). If in doubt about a field being integer-only, leave it and note it.
- Everything listed out-of-scope in the previous plan that is already migrated; Microsoft ingestion, customer matching, deferCommit, order-prompt contract.

## Tests

- New `tests/import-schema-coerce.test.ts` (or extend an existing import-schema test if one exists): 'number' with "1 234,56", "1,234.56", "0,20", malformed → null; 'vat_rate' with "15%", "15,00", "zero", "std".
- Extend `tests/finch-procurepulse-data.test.ts` or add a focused test IF `parseNum`/pack-label logic is exportable without refactor; otherwise rely on locale-number unit tests and note it.
- If `statementUnitPrice` is exported (or cheaply exportable), add comma-decimal cases; otherwise note.
- Do not add component render tests — tsc + lint + existing suite cover the .tsx changes.

## Ordered steps

1. A-sites (1–4) + their tests; run `npm test` after each file.
2. B-sites (5–6).
3. C-sites, one component at a time, checking each field's downstream numeric consumption.
4. Final grep from acceptance criterion 1; full `npx tsc --noEmit`, `npm run lint`, `npm test`.
5. Write `.ai/implementation_locale_number_sweep.md` (changes, per-site fallback semantics preserved, deviations, anything left in category D with reasons).

## Hard constraints

- House style: why-not-what comments; at each migrated site, one line noting the old comma-deleting bug class.
- Preserve every site's public signature and fallback value (null vs 0) exactly — callers depend on them.
- No git commits, no deploys, no DB writes, no network calls.
- Pre-existing tsc/lint issues elsewhere in the tree are not yours to fix; introduce zero new ones.
- If a material decision is missing here, STOP and report rather than invent.
