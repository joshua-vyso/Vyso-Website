# Plan: VAT-aware order validation + review confidence fixes

Date: 2026-08-30. Architect: Fable. Base commit: 45da3a8 (== origin/main). Implementation happens in an ISOLATED GIT WORKTREE from 45da3a8 — the main working tree has unrelated in-flight uncommitted work (message-order-evidence feature, another session) that must NOT enter this commit.

## Goal

1. Order-line validation and display become VAT-aware: a correctly extracted VAT-bearing line (net 338, VAT 50.70, total 388.70) never flags red; true mismatches show a specific reason (qty×price≠net vs net+VAT≠total). Document footer totals reconcile when printed.
2. Confidence pipeline: missing/string-typed model confidence never becomes a stored 0; explicit 0 still renders 0%; 0–1-scale answers are normalized; reviewer corrections do not rewrite extraction confidence; stale invoice-lane line_audit warnings recompute on reviewer save.

## Audit findings (established facts — do not re-derive)

- `ExtractedLineItem` (lib/platform/types.ts:107-156) has NO tax fields. Neither extraction prompt asks for tax. No document-level totals exist for orders anywhere in extracted_data.
- The red mismatch is `grossMismatch` (lib/platform/docu/order-line-totals.ts:127-143), recomputed live on every render in OrderReviewEditor.tsx (:1035, banner :970-981, row :1152-1159). It compares round2(qty×unit_price) vs parsed `raw_amount` with `moneyMatches` (line-audit.ts:174-177, 1c abs / 0.5% rel), all through parseAmount→parseLocaleNumber with a document-level hint (`lineSeparatorHint`).
- The order prompt (lib/ai/order-prompt.ts:157) defines raw_amount as "the row's own amount/nett/value column" — ambiguous when a row prints Net, VAT AND Total columns; the extractor can legitimately put the VAT-inclusive Total there, producing a false red on a correct read. That is the false-mismatch mechanism. (The currently stored Montecasino rows happen to hold net values and reconcile — the fix removes the ambiguity going forward.)
- False 0% cause: order lane `clampPct` (lib/ai/order-prompt.ts:242-245) and classification lane coercion (lib/ai/anthropic.ts:326-327) turn a missing OR string-typed `overall_confidence` into 0 — while both prompts *instruct the model to output numbers as strings* ("Output all numbers as plain strings... all confidence values 0-100"). The two Montecasino 0% docs (e9ecc257…, 1bb98552…) store literal 0.0 in `documents.confidence` while every line stores confidence 100 → header key was omitted or string-typed; clampPct zeroed it. No cap path (finalizeExtractionConfidence 65/75 caps) can produce 0. DB column is nullable; ConfidenceText (components/platform/ui.tsx:20-28) already renders null as "—".
- Review save never touches documents.confidence (correct), but OrderReviewEditor.tsx:704 stamps every line `confidence: 100` (rewrites extraction history — remove) and :703 writes `amount = lineGross(...)` (net — keep, downstream SupplySync docTotal reads amount).
- Invoice lane: ExtractionEditor.persist does NOT recompute `line_audit` → stale red "Line totals do not add up" survives correction (LineAuditNotice + DocumentReviewQueue amber rows). Order lane recomputes live (fine).
- Downstream: operational prices come ONLY from `unit_price` at orderflow-from-doc.ts:641/:665 and procurepulse-feed.ts:350. `amount` is read as GROSS by SupplySync spend (extract.ts:73 docTotal, review-actions.ts:629) and as NET by invoice-from-extraction.ts:161. NEW FIELDS MUST NOT BE READ BY ANY OF THESE — additive raw_* names guarantee it. Do NOT add new fields to any decimal-hint sample list except `lineSeparatorHint` (order-line-totals.ts:61-67), where the money strings improve inference.

## Field mapping (task-model → implementation)

net_amount → existing `raw_amount` (verbatim net/goods column; semantics clarified in prompt)
tax_amount → NEW `raw_tax_amount?: string` (verbatim row VAT)
tax_rate → NEW `tax_rate?: string` (verbatim printed rate, e.g. "15%")
gross/total → NEW `raw_total_amount?: string` (verbatim VAT-inclusive row total)
tax_code → NEW `tax_code?: string` (verbatim, optional)
Document totals → NEW `ExtractedData.totals?: { subtotal?: string; tax_total?: string; freight?: string; discount?: string; grand_total?: string }` — all verbatim strings, absent/"" when not printed. Never invented, never computed.

## Files to change (worktree from 45da3a8)

1. `lib/platform/types.ts` — add the four optional line fields + `OrderDocumentTotals` + `ExtractedData.totals?`. Additive only.
2. `lib/ai/order-prompt.ts` —
   - JSON shape: add `"raw_tax_amount"`, `"tax_rate"`, `"tax_code"`, `"raw_total_amount"` per line; add top-level `"totals"` object.
   - Instructions (match existing voice): raw_amount = the row's NET/goods-value column ("Nett Value", "Net", "Amount excl"); when a row also prints VAT and a VAT-inclusive total, transcribe those into raw_tax_amount / raw_total_amount digit-for-digit; when the row prints only ONE amount column, it goes in raw_amount and the tax fields stay "" (legacy behavior). NEVER compute any of them. Footer totals: transcribe only what is printed; "" otherwise.
   - `coerceOrderExtraction`: carry new fields via `str()`; carry `totals`; replace `clampPct` per §Confidence below.
3. `lib/platform/docu/extraction-quality.ts` — add shared `coerceConfidence(v: unknown): number | null`: number → itself; string → trim, strip trailing `%`, Number(); non-finite/missing → null; `0 < n < 1` → n×100 (0–1-scale normalization); then clamp 0–100 and round. Explicit numeric 0 stays 0. Make `finalizeExtractionConfidence` accept/return `number | null` (null passes through untouched — caps only apply to numbers; never fabricate).
4. `lib/ai/anthropic.ts` — classification lane: `confidence = coerceConfidence(parsed.overall_confidence)` (typed number|null). Audit-cap application (:365) null-tolerant.
5. `lib/ai/order-reader.ts` — overall_confidence now number|null; null-tolerant threading through orientation retry comparisons (when comparing candidate reads, treat null as worst).
6. `lib/platform/docu/classification-policy.ts` + `lib/platform/docu/flags.ts` — null confidence must stay review-cautious: policy checks use `(confidence ?? 0)` where they gate escalation/second reads; flags: raise the low-confidence flag when confidence is null with message like "Confidence unavailable — worth a look" (do not fabricate a number).
7. `lib/platform/docu/order-line-totals.ts` — tax-aware reconciliation:
   - `lineSeparatorHint`: include raw_tax_amount + raw_total_amount in samples.
   - `lineTax(line, hint)`, `lineTotal(line, hint)` helpers (parseAmount).
   - `grossMismatch` → returns `null` (valid) or `{ reason: 'line_math' | 'vat_total'; paper: number; gross: number; difference: number; tax?: number | null; total?: number | null }`:
     - net := parse(raw_amount); tax := parse(raw_tax_amount); total := parse(raw_total_amount); computed := round2(qty×price).
     - If net present: fail `line_math` unless moneyMatches(computed, net).
     - Else if total present and tax present: fail `line_math` unless moneyMatches(computed, round2(total − tax)).
     - Else if total present: fail `line_math` unless moneyMatches(computed, total) (defensive legacy).
     - If net & total both present: fail `vat_total` unless moneyMatches(round2(net + (tax ?? 0)), total).
     - No tax/total/net parsed → current behavior (null when raw_amount unparseable).
   - `reconcileDocumentTotals(lines, totals, hint)` → `{ checks: Array<{ label: string; expected: number; actual: number; ok: boolean }> } | null`: (a) Σ line net ≈ printed subtotal (when subtotal present and ≥1 line net present); (b) subtotal + freight + tax_total − discount ≈ grand_total using ONLY fields present (skip check b unless grand_total and ≥1 component present; missing components are omitted from the sum, not zeroed). moneyMatches tolerance.
8. `components/platform/docu/OrderReviewEditor.tsx` —
   - Row: when parsed row tax > 0, render compact `Amount R338.00 · VAT R50.70 · Total R388.70` (zar2, current styling); zero/absent-tax rows unchanged.
   - Red sentence by reason: `line_math` → "Doesn't add up — qty × price comes to Rx, paper shows Ry for this line…"; `vat_total` → "Doesn't add up — net Rx + VAT Ry doesn't reach the printed total Rz…". Banner count unchanged.
   - Footer: when `extracted_data.totals` present, show printed subtotal/VAT/grand total with reconcileDocumentTotals result; a warning line naming the failing check when not ok. Compact; no change when totals absent.
   - Save (:704): PRESERVE each line's original extraction confidence instead of stamping 100 (thread original confidence through buildReviewLines in lib/platform/docu/order-review-lines.ts); keep `amount = lineGross(...)` net write (:703) exactly as-is; carry raw_tax_amount/tax_rate/tax_code/raw_total_amount through cleanLines verbatim.
9. `components/platform/ExtractionEditor.tsx` — on persist, recompute `auditLines(...)` over the edited lines (same inputs the extraction-time call uses; reuse documentTotal from stored fields where available) and write the fresh `line_audit` with the merged extracted_data, so stale red notices/queue flags clear after a valid correction. Keep the 100-stamp here or preserve original if trivially threadable (do not expand scope).
10. `components/platform/docu/DocumentReviewQueue.tsx` — `:125` null-guard confidence (`—` when null). NOTE: this file has unrelated uncommitted edits in the MAIN tree; in the worktree you edit the committed version — keep the change to that one line region.
11. `lib/platform/review-queue-shared.ts` — guard the "Read at N% confidence" sentence for null.
12. Tests (tests/*.test.ts, node --test): new `tests/docu-order-line-totals-vat.test.ts` + extend `tests/docu-order-prompt.test.ts` + a confidence coercion test file. Cover the 25 enumerated cases from the task, using Montecasino figures (1×338=338, +50.70=388.70; zero-VAT rows 10×12.5=125; comma-decimal variants "50,70"; mixed docs; footer totals; string "97" confidence; missing key → null; literal 0 → 0; 0.92 → 92; save preserves line confidence — unit-test the pure cleanLines/preserve logic if extractable, else the review-lines module).

## Not touched (hard constraints)

Microsoft Graph files, email-ingest, webhook/subscription code, customer matching, UOM rules, aliases, locale-number.ts, deferCommit, orderflow-from-doc.ts, procurepulse-feed.ts, supplysync-*, invoice-from-extraction.ts, line-audit.ts formulas (auditLine/checkTotal stay as-is; only ExtractionEditor recomputes it on save). No new writes of any operational kind. `amount` keeps its current meaning everywhere.

## DB migration

None. `documents.confidence` is already nullable numeric(5,2); new extracted_data keys are jsonb-additive. The two historical 0% docs keep stored 0 (indistinguishable from a true 0) — optional manual SQL for Josh, NOT run by us:
`update documents set confidence = null where id in ('e9ecc257-ae3d-4f95-a71d-6d2adb37cae8','1bb98552-3958-4880-94ca-8ffc3816cd04') and confidence = 0;`

## Verification (in worktree, in order)

1. `npx tsc --noEmit`
2. `npm run lint` (no NEW errors vs base)
3. `npm test` (full suite)
4. `npm run build` (copy .env.local from the main checkout first)
5. `git diff --stat` against 45da3a8 — ONLY the files listed above.

## Acceptance criteria

- VAT line (1, 338, net 338, VAT 50.70, total 388.70) → grossMismatch null.
- Same line with net 340 → reason 'line_math'; with total 380 → reason 'vat_total'.
- Legacy line ({qty 2, price 335, raw_amount "670.00"}) → unchanged null; mismatch still fires when wrong.
- coerceConfidence: "97"→97, missing→null, 0→0, 0.92→92, "88%"→88, 900→100, -40→0.
- Reviewer save leaves line confidence at extraction values; documents.confidence untouched.
- ExtractionEditor persist rewrites line_audit to match corrected lines.
- Full suite green, tsc clean, lint no new errors, build passes.

## Deployment (after approval gate in main session)

Fast-forward push of the single feature commit from the worktree branch onto origin/main, only after verifying origin/main is still 45da3a8 (or rebasing + retesting if moved). Commit message: "Add VAT-aware order validation and review confidence fixes".
