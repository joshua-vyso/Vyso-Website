# Plan: Document-type routing escalation + extraction plausibility gate

Author: Fable (architect). Implementer: subagent. Date: 2026-08-28.
Related audit: rotated Purchase Requisition `3a9dc12f...c9a9.pdf` (documents.id `6077655d-55a8-4935-8f3c-a232f973dea4`, Turn 'n Slice org). NOT related to the locale-number bug (`.ai/plan_locale_numeric_normalization.md`) — that stays untouched.

## Established facts (do not re-derive)

- The PDF: 1 page, image-only scan (RICOH scan-to-email), sideways raster + `/Rotate 270` page flag. Ground truth columns: Material Number | Quantity | Material Detail | UOM | Unit Price | Total | Compliance Status | Primary Vendor/Price. Quantity IS printed; UOM is KG on every row; 18 rows; Nett Total 6 458.22; PO 115232. Sample rows: 52275/2/Herbs Rocket Kg/KG/79/158.00; 61568/10/Spinach Deveined Kg/KG/25,9/259.00; 52181/40/Pineapple Kg/KG/10,76/430.40; 52083/20/Apple Granny Smith Kg/KG/17.4/348.00.
- Pipeline: `extractDocument()` (`lib/ai/anthropic.ts:184`, model `claude-haiku-4-5`, statement-oriented `EXTRACT_INSTRUCTION`) runs first and its `document_type` decides routing; only `document_type === 'order'` reaches the Sonnet order path (`extractOrderDocument`, `ORDER_EXTRACT_INSTRUCTION`, `document-ingest.ts:798-905`).
- Failure: Haiku said `statement`, confidence 32, and fabricated 18 alphabetical produce rows (unit "boxes" per its own prompt fallback `anthropic.ts:175`; supplier = its own prompt's worked example). The order path never ran. Doc-U displayed stored data faithfully; the 80-confidence review gate did hold the doc for review.
- No orientation handling exists anywhere; no rasterization deps exist; PDFs go to Anthropic as native document blocks.
- `line-audit` is a no-op when all numeric fields are blank.
- Raw model text is not persisted — only post-coercion JSON.

## Phase 0 — Empirical repro (USER-APPROVED, max 3 paid API calls)

Purpose: determine whether the Sonnet order path reads this rotated scan correctly, i.e. whether routing alone fixes the failure or orientation normalization (Phase 2) is genuinely needed.

- Script location: scratchpad (NOT the repo). Load `ANTHROPIC_API_KEY` from the repo's `.env.local`.
- Call 1: reproduce the current Haiku pass — exact model, system/prompt, params, and native-PDF document block as `extractDocument()` builds them. Record full raw response.
- Call 2: the Sonnet order path — exact model/prompt/params as `extractOrderDocument()` uses, same native-PDF block. Record full raw response.
- Call 3 (ONLY if call 2 is degraded): rasterize the PDF upright locally (`pdftoppm` exists on this machine via Homebrew; honor /Rotate so the image is upright, ~150-200 DPI) and repeat the order-path call with an image block instead of the PDF. This isolates orientation as the variable.
- Prefer importing the real functions from the repo; if `server-only`/Next imports block plain node execution, replicate the request by copying model/prompt/params verbatim from the code and state that in the report.
- Score each response against the ground-truth sample rows: descriptions (full names vs fabricated), UOM (KG preserved?), unit prices, totals, quantities, document_type/classification.
- No DB writes, no repo edits, nothing beyond these ≤3 API calls.

## Phase 0 results (2026-08-28, 2 of 3 approved API calls used)

- Haiku pass reproduced fabrication on the native PDF: `statement`/42, supplier = the prompt's own worked example, 20 identical "Apricots" rows, unit "boxes".
- Sonnet order path on the SAME native PDF (no rotation preprocessing): 20 rows, real distinct descriptions, `kg` throughout, 18/20 rows exact on unit_price+amount including all 4 ground-truth samples; the 2 misses are ordinary digit/adjacent-row misreads (Banana, Gooseberry) that exactly account for the 15.00 subtotal gap; both are internally consistent so row-arithmetic cannot catch them. Confidence 72 → correctly lands in review. PO number landed in order_notes, not purchase_order_number.
- Corrected ground truth: 20 line items (not 18), summing exactly to Nett Total 6 458.22.
- CONCLUSION: routing alone is sufficient; orientation normalization is NOT needed for this failure. Anthropic's PDF pipeline honors /Rotate when the right model+prompt receives the file.
- Raw responses + upright render saved in the session scratchpad.

## Reconciliation with concurrent working-tree changes (2026-08-28 evening)

A PARALLEL work stream (not authored in this session; files dated 18:15–18:24) already added, uncommitted: `lib/platform/docu/pdf-orientation.ts` (metadata-level /Rotate candidates via new pdf-lib dep), `lib/platform/docu/extraction-quality.ts` (structural audit: suspicious 1–2-letter descriptions, unsupported "boxes", repeated descriptions, missing money columns; score + needs_review + confidence cap 65), orientation-retry loops wired into BOTH `extractDocument` and `extractOrderDocument`, removal of the "boxes" prompt fallback, `structure_audit`/`orientation_normalization` persisted in extracted_data, and related tests. That stream ALREADY COVERS this plan's original Phase 1 items 2 (plausibility gate), 3 (prompt hardening), 4 (extraction meta), and Phase 2 (orientation) — do NOT duplicate any of it.

What it does NOT cover — the keystone Phase 0 proved: `document-ingest.ts:722` still routes on the Haiku `document_type` alone. On this PDF the concurrent machinery burns up to 4 Haiku calls across rotations, caps confidence, flags needs_review — but the Sonnet order path still never runs.

## Phase 1 (NARROWED) — Routing escalation only, composed with the concurrent work

AWAITING USER APPROVAL — and confirmation of who owns the parallel stream before editing shared files.

1. **Policy function** (new `lib/platform/docu/classification-policy.ts`, pure, tested): given the Haiku `ExtractionResult` (including its `structure_audit` from the concurrent code), return `'accept' | 'escalate_order'`. Escalate when the classified type is NOT `order` AND ANY of: (a) `structure_audit.status === 'needs_review'`, (b) overall_confidence < 60, (c) order-shaped cues in the extracted fields (case-insensitive: "purchase requisition"/"purchase order"/"requisition", or a PO/vendor-number pattern in notes/supplier fields). Never escalate a confident, structurally-ok statement/invoice.
2. **Wiring** (`document-ingest.ts` around line 722): on `escalate_order`, run `extractOrderDocument` on the prepared input (reusing `preparedDocumentInput` so the orientation-selected bytes carry over) and prefer its result when its structure_audit score beats the classification read's (reuse `betterExtraction`/`auditExtractionStructure` — do not fork scoring). Record `escalated: true` + both scores in extracted_data. If the order read is also poor, keep the original (already needs_review-flagged) result.
3. **Cost bound**: escalation adds at most ONE Sonnet call per document, and only on suspect non-order classifications. Consider (report, don't decide unilaterally) short-circuiting the concurrent Haiku rotation-retry loop when escalation will run anyway — flag as a follow-up if it needs touching the parallel stream's code.
4. **Tests** (`npm test`, no API): policy unit tests — the real stored fabricated extraction (Maize/Mace/Madeira fixture) → escalate; the Phase-0 all-"Apricots" fixture → escalate; confident clean statement → accept; already-order → accept. Wiring test if mockable like existing document-ingest tests. The PDF goes to `tests/fixtures/` powering an OPT-IN manual eval script (requires API key, excluded from npm test).
5. **PO-number miss** (Phase 0 finding: PO landed in order_notes): smallest fix ONLY if it is a one-line prompt nudge in ORDER_EXTRACT_INSTRUCTION's field list; otherwise defer and note.

Out of scope / untouched: everything the parallel stream owns (pdf-orientation.ts, extraction-quality.ts, prompt "boxes" removal, orientation retry loops) except the single read-only reuse points named above; locale-number and all its call sites; Microsoft ingestion; customer matching; deferCommit; quantity-derivation provenance (this document prints quantities — revisit only if a real quantity-less document appears).

## Acceptance criteria (end state)

- Re-ingesting this PDF routes it to the order path (or honestly flags it unreadable) — never a fabricated statement.
- Full material descriptions, KG preserved, unit prices and totals extracted (if the model can read the scan — Phase 0 tells us), quantities from the printed column.
- No "boxes" unless printed. No invented rows presented as data — suspect extractions are visibly flagged.
- Locale-number tests all still pass; `npx tsc --noEmit` / `npm run lint` / `npm test` zero new issues.
- No deploy, no DB writes outside normal ingest paths, no mailbox calls.
