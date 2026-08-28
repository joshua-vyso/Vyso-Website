# Implementation: locale-aware numeric normalization

Plan: `.ai/plan_locale_numeric_normalization.md`. Implementer: subagent. Date: 2026-08-28.

## Summary

Replaced every comma-stripping numeric parse in Doc-U / OrderFlow with delegates to
one new pure module, `lib/platform/locale-number.ts`, which implements the
algorithm specified in the plan (currency/paren/sign/whitespace stripping,
separator resolution with a document-level ambiguity hint, `moneyEquals`).
Verified end-to-end against the Standard Bank PO SBSA94517 fixture (five real
comma-decimal rows) and against every existing period-decimal test, which all
stayed green.

## Files changed

### New

- `lib/platform/locale-number.ts` — the shared parser: `parseLocaleNumber`,
  `inferDecimalSeparator`, `moneyEquals`. Pure, no imports from app code.
- `tests/locale-number.test.ts` — unit tests for the module: every format in
  the plan's acceptance criteria, the malformed-input list, `inferDecimalSeparator`
  evidence rules, `moneyEquals`, plus a percent-suffix case found during
  verification (see Deviations).
- `tests/docu-standard-bank-regression.test.ts` — the five rows EXACTLY as
  stored in the DB (Gooseberries Fresh, Raspberries Fresh, Edible Flowers -
  Tubs, Baby Butternut Fresh, Herb Basil Fresh — see "Correction" below), run
  through the real `order-line-totals.ts` functions with document-wide
  inference (no manual hint): each `lineGross` matches its paper amount
  (within `moneyEquals`'s R0.02 tolerance), no computed value exceeds 1000,
  `grossMismatch` is null for every row, and the five-row subtotal is 626.45.

### Modified

- `lib/platform/docu/extract.ts` — `parseAmount` is now a thin delegate to
  `parseLocaleNumber`; the fixed comma-stripping bug is documented in a
  "FIXED BUG, DO NOT REINTRODUCE" comment at the old bug site, per the house
  style and the task's instruction. Signature widened to accept `opts?:
  { decimalSeparator }` and a `number` input; backward compatible (opts is
  optional).
- `lib/platform/docu/order-line-totals.ts` — added `lineSeparatorHint(lines)`
  (exported, gathers quantity/unit_price/raw_amount across a line array and
  calls `inferDecimalSeparator`). `lineGross`/`grossMismatch` take an optional
  `hint` param (single-line functions, cannot infer alone); `orderSubtotal`/
  `countGrossMismatches` infer the hint themselves when not given one.
  `grossMismatch` still compares with `moneyMatches` (line-audit.ts's
  cent-or-0.5% tolerance) — see Deviations for why this differs from the
  plan's literal "R0.02 tolerance" instruction.
- `lib/platform/docu/row-arithmetic.ts` — `resolveRowArithmetic`/
  `applyRowArithmetic` take an optional `hint`; `applyRowArithmeticToLines`
  infers one document-wide hint from every row's bulk_quantity/unit_quantity/
  quantity/unit_price/raw_amount and threads it through.
- `lib/platform/docu/line-audit.ts` — `AuditInput.hint?: DecimalSeparator |
  null` (omitted = infer from `lines`; explicit `null` = force no hint).
  `auditLine`, `multipliers`, `primaryMultiplier`, `fillDerivable`,
  `sumAmounts`, `findOrphans` all take the hint and thread it through
  `auditLines`'s shift search, repair, and residual-reconstruction paths.
- `lib/platform/orderflow-from-doc.ts` — deleted the buggy local `num()`;
  replaced with a thin `num` closure over `parseLocaleNumber`, pre-bound to a
  document-wide hint inferred once (before the per-line loop) from every
  line's quantity/unit_price. Fixes the three sites the plan named: qty
  (~line 474 orig / now ~485), the new-stock-item `avg_unit_price` (~512 /
  ~523), and `documentPrice` (~545 / ~558).
- `lib/platform/docu/invoice-from-extraction.ts` — `parseNumeric` delegates to
  `parseLocaleNumber` (still returns `0`, never `null`, on failure — every
  caller does immediate arithmetic and previously got `0`). `mapExtractionToSheet`
  infers one hint from all line items' quantity/unit_price/amount and threads
  it into `toSheetLine`, `isPrintable`, and `resolveVatRate`.
- `lib/ai/anthropic.ts` — `documentTotal` delegates to `parseLocaleNumber`.
  `extractDocument` computes one document-wide hint from both the extracted
  header fields AND the line items, and hands the SAME hint to both
  `documentTotal` and `auditLines` (via the new `AuditInput.hint`), so the
  total and the lines can never be read under two different separator
  assumptions.
- `components/platform/docu/OrderReviewEditor.tsx` — `sanitizeDecimal` now
  allows `[0-9.,\s]` while typing (previously stripped every comma and
  collapsed multiple dots); the Qty `onChange` now calls `sanitizeDecimal`
  instead of its own `[^0-9.]` strip. A `lineHint = useMemo(() =>
  lineSeparatorHint(lines), [lines])` is computed once per render and threaded
  into `orderSubtotal`, `countGrossMismatches`, the per-row `lineGross`/
  `grossMismatch`, and the save handler's `lineGross(l, lineHint)`.

### Deliberately not touched

- `components/platform/orderflow/OrdersView.tsx` (~963, 968) — per plan step 8's
  conditional: this screen is the MANUAL order builder, not the Doc-U
  extraction pipeline. It uses bare `Number(l.qty) || 0` directly on typed
  input, never `parseAmount`/`lineGross`/`order-line-totals.ts`, and its own
  `qty`/`unit_price` sanitizers (`.replace(/[^0-9.]/g, '')`) are local to that
  builder. It does not feed the same pipeline this plan fixes, so it was left
  alone, as instructed.

## Deviations from the plan (both reported, not invented)

1. **`grossMismatch`'s tolerance stayed `moneyMatches` (cent-or-0.5%), not a
   new `moneyEquals(..., 0.02)`.** The plan's rewiring section for
   `order-line-totals.ts` says "`grossMismatch` must compare canonical numbers
   with the R0.02 tolerance (replace any string/loose comparison)." But an
   EXISTING test — `tests/docu-order-line-totals.test.ts`, `'the tolerance is
   line-audit's, not a second opinion'` — explicitly locks `grossMismatch` to
   `line-audit.ts`'s `TOLERANCE_ABSOLUTE`/`TOLERANCE_RELATIVE` (cent-or-0.5%),
   asserting e.g. that a R40 difference on a R10 040 line (0.5% relative) is
   NOT flagged — a case a flat R0.02 tolerance would flag. That test does not
   assert the buggy comma-stripping behaviour (the thing the task's guardrail
   permits overriding); it asserts a deliberate design decision the module's
   own doc comment states outright: "a warning that disagreed with the
   invoice audit about what 'close enough' means would be worse than no
   warning." Per the task's instruction ("if existing period-decimal tests
   break, fix your implementation, not the tests"), I kept `grossMismatch` on
   `moneyMatches` and only fixed WHAT `paper`/`gross` are (canonical numbers
   off the shared parser) rather than HOW they are compared. The same
   reasoning applies to `row-arithmetic.ts`'s `resolveRowArithmetic`, which
   also uses `moneyMatches` and is locked by a test (`'a nett rounded on the
   paper to 447 still reconciles'`) that depends on the 0.5% relative leg.
   `moneyEquals` is still implemented in `locale-number.ts` exactly as
   specified, and IS what the Standard Bank regression test uses to state its
   own R0.02-ish success criterion independently of `grossMismatch`'s
   tolerance — the two never need to agree on a number, only on giving the
   right VERDICT for these five rows, which they both do since the computed
   values are exact matches (diff 0).
2. **A trailing `%` is stripped like a currency symbol.** Not in the plan's
   currency-token list (`R`, `ZAR`, `$`, `€`, `£`, `USD`, `EUR`, `GBP`).
   Discovered because `resolveVatRate`'s existing test (`'an explicit rate
   field is taken at its word'`, `tests/docu-invoice-from-extraction.test.ts`)
   feeds `parseNumeric` the string `"15%"`, which the OLD
   `parseFloat(...replace(/[^0-9.-]/g, ''))` implementation handled
   incidentally (it stripped `%` along with everything else non-numeric); the
   new charset-validating parser refused it and returned `null` → `0`,
   breaking that test. Fixed by adding a `PERCENT_SUFFIX_RE` alongside the
   currency-suffix regex in `locale-number.ts`'s `preprocess`, stripped the
   same way and for the same reason (an edge decorator, never touched
   mid-string). Covered by a new test in `tests/locale-number.test.ts`.
3. **`orderflow-from-doc.ts` keeps a same-named local `num` closure** rather
   than inlining `parseLocaleNumber(..., opts)` at each of the three call
   sites. It is a thin one-line delegate pre-bound to the document hint (the
   OLD buggy regex implementation is fully deleted), chosen to avoid repeating
   the `hint ? {decimalSeparator: hint} : undefined` ternary three times and
   to keep the diff at those three call sites to zero.

## Correction (post-review)

Architect review of the first version of this doc/fixture found an unreported
deviation: `tests/docu-standard-bank-regression.test.ts` used PLAUSIBLE
substituted values ("Raspberries" qty `"0,20"` / price `"329,00"`; "Edible
Flowers" price `"666,00"`, etc.) rather than the actual DB-verified figures the
plan required ("the 5 real rows exactly as stored"). This mattered: on the
real document EVERY `unit_price` carries the ambiguous 3-digit-tail comma
shape ("269,000", "44,400", "119,900", "139,500", "329,000" — all read as
269.000, 44.400, 119.900, 139.500, 329.000 rand), which is exactly the hard
case the document-level inference exists to resolve. The substituted fixture
mixed in unambiguous 2-digit-tail unit prices ("329,00", "666,00", "327,00",
"279,00"), so it never actually exercised "every unit price on the document is
ambiguous, and the OTHER fields resolve all of them at once."

Fixed by replacing the fixture with the exact DB-verified values (descriptions
included, as stored):

| description | quantity | unit_price | raw_amount | paper |
|---|---|---|---|---|
| Gooseberries Fresh | `0,20` | `269,000` | `53,80` | 53.80 |
| Raspberries Fresh | `0,20` | `329,000` | `65,80` | 65.80 |
| Edible Flowers - Tubs | `3,00` | `44,400` | `133,20` | 133.20 |
| Baby Butternut Fresh | `3,00` | `119,900` | `359,70` | 359.70 |
| Herb Basil Fresh | `0,10` | `139,500` | `13,95` | 13.95 |

`lineSeparatorHint` now genuinely earns its keep on this fixture: all five
`quantity` and all five `raw_amount` values are unambiguous 2-digit-tail
comma-decimals (10 evidence samples), while all five `unit_price` values
contribute zero evidence on their own (3-digit tails) — the comma reading for
every ambiguous unit price is carried entirely by the other two columns.
Verified the exact arithmetic (including the float-noise case the coordinator
flagged, 3.00 × 44.400 = 133.20000000000002 in raw floating point) with a
throwaway `node -e` check before writing the test; `lineGross`'s internal
`round2` already resolves that noise to 133.2, but the test now also asserts
via `moneyEquals(gross, line.paper)` (±0.02 tolerance) rather than
`assert.equal`, per the coordinator's instruction, so the assertion doesn't
silently depend on that internal rounding. The comment block above the fixture
was rewritten to describe the real shape of the bug (every unit price
ambiguous, resolved by the other columns) instead of the one-ambiguous-field
version. The lone-ambiguous-row en-thousands-default test was left as is (not
part of the DB fixture — a separate, deliberately synthetic single-row case).

Re-ran `node --test tests/docu-standard-bank-regression.test.ts` (5/5 pass)
and the full `npm test` (1195/1195 pass, 0 fail) after the correction — see
Test Results below, updated to match.

## Out-of-scope latent sites (plan's explicit exclusion list — for a follow-up sweep, not touched here)

- `lib/platform/procurepulse-feed.ts`
- `lib/platform/orderflow-data.ts:618`
- `lib/platform/import-schema.ts`
- `app/api/procurepulse/convert-unit/route.ts`
- `components/platform/ExtractionEditor.tsx`
- SupplySync components
- ProcurePulse components
- anything under Microsoft/Graph ingestion, email-ingest, customer matching, `deferCommit`
- `lib/ai/order-prompt.ts`'s extraction contract (the "TRANSCRIBE, DO NOT
  INTERPRET" prompt itself — deliberately kept verbatim per the plan; not a
  parsing site)
- `components/platform/orderflow/OrdersView.tsx` (~963, 968) — see "Deliberately
  not touched" above; a manual order builder, not part of this pipeline.

## Test results

```
npx tsc --noEmit
```
Clean for every file this task touched. 31 pre-existing errors remain, all in
files this task never opened (`components/finch/scan/*`, `.next/dev/types/
validator.ts`, `tests/free-scan-content.test.ts`) — a pre-existing `keyof
AnalyticsEvents` type gap from other in-progress work already in the working
tree before this task started (matches the "Vyso 2026 redesign ... build
blocked by free-scan types" note). Not introduced or touched by this change.

```
npm run lint
```
50 errors / 40 warnings, ALL in files this task never opened
(`components/platform/vyso-ai/*`, `components/platform/wastewatch/*`,
`lib/platform/price-watch/run.ts`, `lib/platform/wastewatch-data.ts`,
`lib/posthog-server.ts`, `instrumentation-client.ts`) — mostly a
`react-hooks/set-state-in-effect` rule flagging pre-existing `useEffect`
patterns unrelated to this task. Zero errors or warnings in any file this task
created or modified (`grep` for each touched file's path against the lint
output returns nothing).

```
npm test
```
**1195 / 1195 pass, 0 fail.** New/extended coverage:
- `tests/locale-number.test.ts` — new, ~20 tests: every format in the plan's
  acceptance criteria (decimal comma/point, space+comma thousands with NBSP
  and narrow-NBSP variants, comma+dot and dot+comma thousands, currency
  decoration, accounting parens, the `"269,000"` ambiguity with and without a
  hint, the full malformed list, already-numeric/nullish passthrough,
  `inferDecimalSeparator`'s majority-vote and tie-breaking, `moneyEquals`, and
  the percent-suffix case from Deviation #2).
- `tests/docu-standard-bank-regression.test.ts` — new, 5 tests: the exact
  DB-verified five-row Standard Bank fixture (see "Correction" above) end to
  end through `order-line-totals.ts` with document-wide inference, no manual
  hint. Every `unit_price` on the real document is the ambiguous 3-digit-tail
  shape; `quantity`/`raw_amount` alone supply the comma evidence that resolves
  all five.
- `tests/docu-order-line-totals.test.ts` — extended with 4 comma-decimal
  fixture tests (`lineGross`, `lineSeparatorHint`, `orderSubtotal`,
  `grossMismatch`) locking the wiring; every pre-existing period-decimal test
  (including the tolerance-lock test discussed in Deviation #1) stayed green
  unmodified.
- `tests/docu-row-arithmetic.test.ts` — extended with 2 comma-decimal fixture
  tests (`resolveRowArithmetic` with an explicit hint, `applyRowArithmeticToLines`
  inferring its own document-wide hint); every pre-existing test stayed green
  unmodified.
- `tests/docu-invoice-from-extraction.test.ts`, `tests/docu-line-audit.test.ts`
  — untouched, all pre-existing tests still pass (verifies the `hint`
  threading through `line-audit.ts` and `invoice-from-extraction.ts` is
  behaviourally invisible when nothing ambiguous is on the document).

## Constraints honoured

No `git commit`, no deploy, no DB writes, no Microsoft/Graph/Supabase network
calls. No files outside the plan's list touched, aside from the two test files
the plan explicitly named for extension. House style followed: heavy
"why, not what" comments on every separator-resolution decision in
`locale-number.ts`, and a "FIXED BUG, DO NOT REINTRODUCE" comment at every
site that used to strip commas (`extract.ts`'s `parseAmount`,
`invoice-from-extraction.ts`'s `parseNumeric`, `anthropic.ts`'s
`documentTotal`, `orderflow-from-doc.ts`'s deleted `num()`, and
`OrderReviewEditor.tsx`'s `sanitizeDecimal`).
