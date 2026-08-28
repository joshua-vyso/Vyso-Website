# Plan: Locale-aware numeric normalization for Doc-U / order pipeline

Author: Fable (architect). Implementer: subagent. Date: 2026-08-28.

## Goal

Fix the systematic money corruption in the Doc-U order review flow (Standard Bank PO SBSA94517 shows "R 5 380 000.00" for a R 53.80 line) by replacing every comma-stripping numeric parse with ONE shared, locale-aware, deterministic normalizer. No arbitrary scaling, no per-customer special cases, no prompt-only fix, no changes to Microsoft ingestion / customer matching / deferCommit.

## Root cause (established by trace — do not re-derive)

Stored extraction JSON is CORRECT (verified in DB): e.g. Gooseberries `quantity "0,20"`, `unit_price "269,000"`, `raw_amount "53,80"` — internally consistent SA comma-decimal (0.20 × 269.00 = 53.80).

The corruption is `parseAmount()` in `lib/platform/docu/extract.ts:30-36`:
```ts
const cleaned = String(s).replace(/[^0-9.\-]/g, '');
```
It DELETES commas instead of interpreting them: `"0,20"` → 20 (×100), `"269,000"` → 269000 (×1000), `"53,80"` → 5380. The same broken pattern is duplicated in:
- `lib/platform/orderflow-from-doc.ts:126-132` (local `num()`; used at lines ~474 qty, ~512 avg_unit_price on new pp_stock_items, ~545 documentPrice — would corrupt REAL order items on Run matching/Confirm)
- `lib/platform/docu/invoice-from-extraction.ts:78-81` (`parseNumeric()`, print sheet)
- `lib/ai/anthropic.ts:275` (inline in `documentTotal()`, invoice/statement arithmetic audit)
- UI edit paths that would re-corrupt manual fixes: `components/platform/docu/OrderReviewEditor.tsx:90-94` (`sanitizeDecimal`) and the Qty `onChange` (~line 853, `.replace(/[^0-9.]/g,'')`)

`parseAmount` is also consumed by `lib/platform/docu/row-arithmetic.ts` (~47, 138-145), `lib/platform/docu/line-audit.ts` (~47, 163-164), `lib/platform/docu/order-line-totals.ts` (~33, 56-60 `lineGross`, ~94-103 `grossMismatch`, subtotal). `zar2`/`zar` in `lib/platform/orderflow.ts:238-247` are display-only formatters — leave them alone.

The AI contract in `lib/ai/order-prompt.ts` deliberately transcribes numbers as verbatim strings ("TRANSCRIBE, DO NOT INTERPRET"). KEEP that contract — verbatim strings preserve paper fidelity for human review and for the paper-amount comparison. Canonicalization is the deterministic layer's job.

## Acceptance criteria

1. `"0,20"` → 0.2; `"269,00"` → 269; `"1 395,00"` → 1395; `"1,395.00"` → 1395; `"1.395,00"` → 1395; `"R 1 395,00"` → 1395; `"R1,395.00"` → 1395; NBSP variants likewise.
2. The exact Standard Bank rows compute correctly END TO END through `lineGross`/`grossMismatch`/subtotal with a document-level separator hint: Gooseberries 0.20×269.00=53.80 matches paper 53.80; Raspberries 65.80; Edible Flowers 133.20; Baby Butternut 359.70; Herb Basil 13.95. No million-rand values anywhere; subtotal for those 5 rows = 626.45.
3. `"269,000"` alone (no context) parses as 269000 (en thousands default), but with comma-decimal hint parses as 269.0 — proving no "every comma is decimal" assumption and no arbitrary scaling.
4. Unambiguous en values still work: `"1,234,567"` → 1234567; `"5,380.00"` → 5380; `"12.5"` → 12.5.
5. Malformed tokens (`"12,34,5"`, `"1.2.3,4"`, `"abc"`, `""`, `"-"`, `"12a34"`) → null (flag for human review, never a silently wrong number).
6. Row validation compares canonical qty × canonical unit price against canonical paper amount with currency tolerance ≤ R0.02 (+ tiny float epsilon). Subtotal sums canonical numbers, never formatted strings.
7. Typing `"269,00"` into a Doc-U qty/price input is not silently stripped to `"26900"`.
8. All existing tests still pass; new regression tests cover every format above plus the 5 Standard Bank rows.
9. `npx tsc --noEmit`, `npm run lint`, `npm test` all clean.

## Design

### New module: `lib/platform/locale-number.ts` (pure, no imports from app code)

```ts
export type DecimalSeparator = ',' | '.';

/** Parse a human/locale-formatted numeric string to a canonical JS number.
 *  Returns null for empty/malformed input — never guesses on garbage. */
export function parseLocaleNumber(
  raw: string | number | null | undefined,
  opts?: { decimalSeparator?: DecimalSeparator }
): number | null;

/** Scan a document's numeric strings for unambiguous separator evidence and
 *  return the inferred decimal separator, or null if no/conflicting-tie evidence. */
export function inferDecimalSeparator(
  samples: Array<string | number | null | undefined>
): DecimalSeparator | null;
```

`parseLocaleNumber` algorithm (implement exactly):
1. If input is already a finite number, return it. If null/undefined → null.
2. Trim. Strip a leading/trailing currency token: optional sign may precede/follow it. Currency token = one of `R`, `ZAR`, `$`, `€`, `£`, `USD`, `EUR`, `GBP` (case-insensitive, letters must be a whole token — i.e. only at the string edges, optionally followed/preceded by whitespace). Also handle `(...)` wrapping as negative (accounting style) — optional, but if implemented, do it before currency stripping.
3. Record and remove a single leading `-` (or `+`). A `-` anywhere else → malformed → null.
4. Remove ALL whitespace characters including ` ` (NBSP), ` ` (narrow NBSP), ` ` (thin space) — spaces are always grouping. Use a regex like `/[\s   ]/g` (note `\s` already covers `  ` in JS Unicode mode — verify; include them explicitly anyway for clarity).
5. After steps 2–4 the token must match `/^[0-9.,]+$/` and contain at least one digit; otherwise → null.
6. Separator resolution on the token:
   - Both `.` and `,` present: the LAST-occurring separator type is the decimal separator; the other is grouping. The decimal separator must occur exactly ONCE and must occur after every occurrence of the grouping separator; otherwise → null. Remove grouping chars, replace decimal char with `.`.
   - Only `.` present: multiple dots → all grouping (validate groups: first 1–3 digits, rest exactly 3; invalid → null) → remove them. Single dot → decimal by default; BUT if `opts.decimalSeparator === ','` AND the dot is followed by exactly 3 digits AND the integer part is 1–3 digits (valid grouping shape) → treat as grouping.
   - Only `,` present: multiple commas → all grouping (same group validation; invalid → null). Single comma:
     * followed by ≠3 digits (1, 2, or ≥4) → decimal (cannot be valid grouping).
     * followed by exactly 3 digits: if `opts.decimalSeparator === ','` → decimal; if `opts.decimalSeparator === '.'` → grouping; no hint → grouping IF the integer part is 1–3 digits (valid en shape), else decimal.
   - No separators: plain integer.
7. `Number()` the canonical string; return it if finite, else null. Re-apply sign.

`inferDecimalSeparator` algorithm:
- For each sample, normalize per steps 1–5 above (skip on failure). Evidence:
  * both separators present → the last-occurring one is decimal (strong evidence, count it).
  * single comma with ≠3 trailing digits → comma evidence.
  * single dot with ≠3 trailing digits → dot evidence.
  * everything else (ambiguous / integer / null) → no evidence.
- Majority of evidence wins; zero evidence or exact tie → null.

Money helpers (put here or reuse existing):
- `moneyEquals(a, b, toleranceRand = 0.02)` → `Math.abs(a - b) <= toleranceRand + 1e-9`.
- All display formatting stays in existing `zar`/`zar2` — formatting happens ONLY after arithmetic.

### Rewiring (each site becomes a thin delegate — do not fork the algorithm)

1. `lib/platform/docu/extract.ts` — `parseAmount(s, opts?)` delegates to `parseLocaleNumber`. Keep the exported name/signature backward-compatible (opts optional) so untouched callers still compile. Add the optional `{ decimalSeparator }` pass-through.
2. `lib/platform/docu/order-line-totals.ts` — add/compute a document-level hint ONCE per call: gather every numeric string on the lines (quantity, unit_price, raw_amount/amount, and the document total if available) → `inferDecimalSeparator` → pass hint into every `parseAmount` call in `lineGross`, `grossMismatch`, subtotal. Export a helper (e.g. `lineSeparatorHint(lines)`) so the UI and other modules reuse the same inference instead of re-implementing it. `grossMismatch` must compare canonical numbers with the R0.02 tolerance (replace any string/loose comparison).
3. `lib/platform/docu/row-arithmetic.ts` and `lib/platform/docu/line-audit.ts` — same: infer hint from the full line set they operate on, thread it into their `parseAmount` calls. `moneyMatches` (or equivalent) must use the tolerance on canonical numbers.
4. `lib/platform/orderflow-from-doc.ts` — delete local `num()`; use `parseLocaleNumber` with a hint inferred from ALL the document's line numeric strings (compute once near where lines are read, before the per-line loop). This protects qty (~474), avg_unit_price (~512), documentPrice (~545).
5. `lib/platform/docu/invoice-from-extraction.ts` — `parseNumeric()` delegates to `parseLocaleNumber` with the same document-level hint (it has the lines in scope in `mapExtractionToSheet`).
6. `lib/ai/anthropic.ts` (~275, `documentTotal()`) — replace the inline regex with `parseLocaleNumber`, hint inferred from the fields it inspects.
7. `components/platform/docu/OrderReviewEditor.tsx`:
   - `sanitizeDecimal` (~90-94) and the Qty `onChange` (~853): allow `[0-9.,\s]` while typing (strip only letters/symbols); DO NOT strip or reinterpret commas on keystroke. Computation paths already go through `lineGross`/`orderSubtotal`, which now parse correctly.
   - Wherever the component parses input strings for math, use `parseAmount` with the shared hint from `lineSeparatorHint(lines)`.
   - Do NOT reformat the user's in-progress input; display formatting of computed amounts continues to use `zar2` on canonical numbers.
8. `components/platform/orderflow/OrdersView.tsx` (~963, 968) — same input-sanitizer fix as (7) IF those sites feed the same pipeline; otherwise leave and note in implementation.md.

OUT OF SCOPE (do not touch): `lib/platform/procurepulse-feed.ts`, `lib/platform/orderflow-data.ts:618`, `lib/platform/import-schema.ts`, `app/api/procurepulse/convert-unit/route.ts`, `components/platform/ExtractionEditor.tsx`, SupplySync components, ProcurePulse components, anything under Microsoft/Graph ingestion, email-ingest, customer matching, deferCommit, order-prompt.ts extraction contract. List them in implementation.md as known latent sites for a follow-up sweep.

## Tests (node --test, tests/*.test.ts)

New `tests/locale-number.test.ts` covering, at minimum:
- decimal comma: "0,20"→0.2, "269,00"→269, "13,95"→13.95
- decimal point: "0.20", "269.00", "12.5"
- space thousands + comma decimal: "1 395,00"→1395; NBSP variant "1 395,00"→1395; narrow NBSP
- comma thousands + dot decimal: "1,395.00"→1395; "1,234,567"→1234567
- dot thousands + comma decimal: "1.395,00"→1395; "1.234.567,89"→1234567.89
- currency: "R 1 395,00"→1395, "R1,395.00"→1395, "ZAR 269,00"→269, negative "-R 12,50"→-12.5
- ambiguity: "269,000" no hint → 269000; with {decimalSeparator:','} → 269; "1.395" with {decimalSeparator:','} → 1395
- malformed → null: "12,34,5", "1.2,3.4", "abc", "", "-", "12a34", "1,2345.00"
- inferDecimalSeparator: ["0,20","269,000","53,80"] → ','; ["5,380.00"] → '.'; ["269,000"] → null; [] → null

New `tests/docu-standard-bank-regression.test.ts` — fixture of the 5 real rows exactly as stored (`quantity "0,20"` / `unit_price "269,000"` / `raw_amount "53,80"`, etc.) run through the REAL `order-line-totals` functions (with inference, no manual hint):
- each lineGross equals the paper amount within R0.02 (53.80, 65.80, 133.20, 359.70, 13.95)
- no computed value exceeds 1000 (kills the million-rand class of bug)
- grossMismatch is false for every row
- subtotal = 626.45 ± 0.02×5

Extend `tests/docu-order-line-totals.test.ts` / `tests/docu-row-arithmetic.test.ts` with at least one comma-decimal fixture each to lock the wiring, and keep every existing period-decimal test green (proves no en regression).

## Ordered steps

1. Create `lib/platform/locale-number.ts` + `tests/locale-number.test.ts`; make the unit tests pass in isolation.
2. Rewire `extract.ts`'s `parseAmount`; run existing docu tests (must stay green — default no-hint behavior must keep "569.90"-style fixtures working).
3. Add hint inference + threading in `order-line-totals.ts`, `row-arithmetic.ts`, `line-audit.ts`; add comma-decimal fixtures; add the Standard Bank regression test.
4. Rewire `orderflow-from-doc.ts`, `invoice-from-extraction.ts`, `anthropic.ts:documentTotal`.
5. Fix the two UI sanitizers in `OrderReviewEditor.tsx` (+ `OrdersView.tsx` if applicable).
6. Full verification.

## Verification commands (run from `Vyso Website/`)

```
npx tsc --noEmit
npm run lint
npm test
```

All must pass. Write outcomes + any deviations to `.ai/implementation_locale_numeric_normalization.md`.

## Hard constraints

- Match the house style: "why, not what" comments on every decision; note the fixed bug at `parseAmount` so it is never reintroduced.
- No `git commit`, no deploy, no DB writes, no mailbox calls.
- If a material decision is missing from this plan, STOP and report instead of inventing architecture.
