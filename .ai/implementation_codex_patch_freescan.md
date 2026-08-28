# Implementation: free-scan removal + Codex orientation/quality hardening patch

Implementer: subagent. Plan: `.ai/plan_codex_patch_and_freescan_removal.md`. Date: 2026-08-28.

No git commits, no push, no deploy, no DB writes, no API calls to Anthropic were made. Streams A (locale-number) and C (customer-match.ts / customerEvidence plumbing) were not touched beyond mechanical adjacency (document-ingest.ts still calls `resolveExistingCustomerForOrg` exactly as before; its logic is untouched).

## Part 1 — free-scan removal

### Deleted (29 files)

- `app/free-scan/` — `opengraph-image.tsx`, `page.tsx`
- `app/api/free-scan/` — `cleanup/route.ts`, `document-uploaded/route.ts`, `process/route.ts`, `session/route.ts`, `status/route.ts`, `upload-url/route.ts`
- `components/finch/scan/` — `ScanAuditGate.tsx`, `ScanFlow.tsx`, `ScanHero.tsx`, `ScanHowItWorks.tsx`, `ScanLeadForm.tsx`, `ScanNoDocs.tsx`, `ScanProcessing.tsx`, `ScanResultPanel.tsx`, `ScanTrust.tsx`, `ScanUpload.tsx`, `ScanWhatToUpload.tsx`, `scan-content.ts`, `scan-jsonld.ts`, `select-scan-batch.ts`
- `lib/platform/free-scan/` — `analyze.ts`, `extract.ts`, `session.ts`, `types.ts`
- `tests/free-scan-analyze.test.ts`, `tests/free-scan-content.test.ts`, `tests/free-scan-session.test.ts`

### Reference sweep

- A full case-insensitive grep for `free.?scan` and every `Scan*`/`scan-*` component name across `app/`, `components/`, `lib/`, `tests/` returned zero hits after deletion.
- No `middleware.ts` exists at the repo root; `app/sitemap.ts` and `app/robots.ts` carry no free-scan references (checked directly).
- No marketing page (homepage, nav, footer) linked to `/free-scan`: the pre-deletion grep found every `free-scan`/`Scan*` reference confined to the four directories above plus the three test files — nothing in `app/`, `components/`, or `lib/` outside them referenced the feature, so no CTA/link cleanup was needed anywhere else.
- `lib/analytics.ts`'s `AnalyticsEvents` type never actually contained any `free_scan_*` keys — the 29 pre-existing `tsc` errors were all call sites (`scan-content.ts`, `ScanAuditGate.tsx`, `ScanFlow.tsx`, `ScanHero.tsx`, `ScanNoDocs.tsx`, `ScanResultPanel.tsx`, `ScanUpload.tsx`, `tests/free-scan-content.test.ts`) using event names the type never declared. Deleting the emitters cleared all 29 with no edit to `lib/analytics.ts` needed.
- `vercel.json` has no free-scan cron entry — confirmed by direct inspection; not touched, per plan.
- Supabase tables/buckets/data: not touched. `supabase/free-scan.sql` (the migration that created the `free-scan` bucket/tables) and `.ai/plan_free_scan.md` were deliberately left in place — the plan explicitly excludes DB changes and treats `.ai`/docs as history; a SQL migration file is the same kind of append-only historical record and editing it after the fact would misrepresent what actually ran against the database.

### Dashboard follow-up to report (do not act — user removes in the Vercel dashboard)

`app/api/free-scan/cleanup/route.ts` (now deleted) carried this comment before removal:

> "It runs daily at 04:10 UTC (see vercel.json)... Authenticated with CRON_SECRET as a bearer token, exactly as /api/agents/price-watch is: Vercel Cron sends it, nothing else can."

`vercel.json`'s `crons` array has no entry for `/api/free-scan/cleanup` (verified — only `/api/email/process`, `/api/integrations/xero/sync`, `/api/agents/xero-watch`, `/api/agents/doc-watch`, `/api/agents/price-watch`, `/api/agents/debtors-watch`, `/api/agents/stock-cover`, `/api/agents/digest`, `/api/agents/brief-notify` are declared). The only way the code's own claim of a 04:10 UTC daily run could have been true is a cron configured directly in the Vercel project dashboard, outside `vercel.json`. **That dashboard cron (if it exists) now points at a deleted route and should be removed by the user in the Vercel dashboard.** No other free-scan route carried cron-invocation language, so this is the only one flagged.

### Acceptance

- `npx tsc --noEmit` → 0 errors (was 29, all free_scan-typed).
- `grep -rniE "free.?scan" app components lib tests` → 0 hits.

## Part 2 — hardening patch (Stream B)

All 10 items implemented. Empirical constraint respected: the Haiku orientation retry and the order-type swing were NOT removed; `document_type` is never pinned.

| # | Item | Status | Where |
|---|------|--------|-------|
| 1 | Rotation-adopted results capped at 75 (both wrappers) | Done | `lib/ai/anthropic.ts` `extractDocument`, `lib/ai/order-reader.ts` `extractOrderDocument` |
| 2 | `finalizeExtractionConfidence` pure helper, both wrappers delegate | Done | `lib/platform/docu/extraction-quality.ts` |
| 3 | Unpriced-document guard made real; dead `severeColumnLoss` disjunct removed | Done | `lib/platform/docu/extraction-quality.ts` `auditExtractionStructure` |
| 4 | Boxes penalty only when `raw_description` is present | Done | same function |
| 5 | `orientationChecked` param on `extractOrderDocument`; wired in `document-ingest.ts` | Done | `lib/ai/order-reader.ts`, `lib/platform/document-ingest.ts` |
| 6 | Routing escalation (`classification-policy.ts`) wired at the `isOrder` gate | Done | `lib/platform/docu/classification-policy.ts` (new), `lib/platform/document-ingest.ts` |
| 7 | Reviewer visibility for rotation | Done | `components/platform/docu/StructureAuditNotice.tsx`, wired from `DocumentDetailPanel.tsx` |
| 8 | Tests: real fabrication fixtures + new coverage | Done | `tests/docu-extraction-quality.test.ts` |
| 9 | Stale comments fixed | Done | `lib/platform/document-ingest.ts:717-719`, `lib/platform/docu/pdf-orientation.ts:37-43` |
| 10 | Hoisted duplicate audit calls; `betterExtraction` used (not dropped); skip emitting empty `orientation_normalization` | Done | both wrappers + `document-ingest.ts` |

### Item-by-item notes

**1–2. Confidence caps + `finalizeExtractionConfidence`.** Both wrappers now call `finalizeExtractionConfidence(confidence, { adoptedRotation, auditStatus })`, which applies the pre-existing 65 cap on `needs_review` and a new 75 cap whenever the adopted read came from a rotated candidate (`bestInput !== params` in `anthropic.ts`; `best !== initial` in `order-reader.ts`) — both caps can apply at once, the lower one wins. Unit-tested directly (5 assertions covering each cap alone, both together, and neither).

**3. Unpriced-document guard.** `auditExtractionStructure` now skips the `missingPrice`/`missingAmount` score penalties only when `count >= 3 && missingPrice/count >= 0.8 && missingAmount/count >= 0.8 && confidence >= 70`. The reported `missing_unit_price_rows`/`missing_amount_rows` counts are unaffected (still accurate for the UI) — only the score penalty is skipped. The `severeColumnLoss` disjunct is gone from the `status` expression; a comment explains why it was always redundant with `score < 70` once the guard is confidence-gated (verified algebraically and by the new "unpriced-document guard" test: confidence 80 → `ok`/score ≥ 70; confidence 60 → `needs_review`/score < 70).

**4. Boxes penalty gating.** `unsupportedBoxes` is now computed only for lines where `present(line.raw_description)` is true, using `raw_description` (not the description-fallback `text()` helper) as the evidence to check. This is a genuine behavior change for the classification lane (which never populates `raw_description`) — box-priced statement/invoice lines are no longer penalized there at all. **This required rewriting the existing test `'an unsupported blanket boxes fallback...'`**, since its old fixtures used bare `description` (no `raw_description`) and would now assert 0 where they previously asserted 1. It was replaced with a three-way test (`no raw_description` / `raw_description without box evidence` / `raw_description with box evidence`) that covers exactly what item 8 asked for.

**5. `orientationChecked`.** Added to `OrderReadParams`. `document-ingest.ts` passes `orientationChecked: true` unconditionally on the escalation read (item 6), and `orientationChecked: Boolean(cls.orientation_normalization?.applied)` on the native order path (i.e. only when the classification read itself already rotated these exact bytes). Worst case per unattended document: 1 classification Haiku call + up to 3 rotation-retry Haiku calls, plus (on escalation) 1 order-lane Sonnet call with no further retries — 4 Haiku + 1–2 order calls (order lane itself can fall back OpenAI↔Anthropic once), matching the plan's bound.

**6. Routing escalation.** New pure module `lib/platform/docu/classification-policy.ts`, `decideClassificationRouting(input)`. Escalates on any of: `structure_audit.status === 'needs_review'`, `overall_confidence < 60`, or an order-shaped text cue (`/purchase\s+requisition|purchase\s+order|requisition/i` or a loose PO-number pattern `/\bp\.?\s?o\.?[-\s#]?\d{2,}\b/i`) found in `supplier`, `bill_to`, or any field's label/value. Wired in `document-ingest.ts` **before** the Storage upload / DB insert (moved up from the original ~line 722 spot), since `isOrder` must be final before the document row's `document_type`/folder assignment happens. Adoption uses `betterExtraction<StructuralExtraction>(cls, candidate) === candidate` — the order read only wins if it strictly outscores the classification read. `escalated: true` plus `escalation_classification_score`/`escalation_order_score` are recorded in `extracted_data` on whichever result ends up stored (the order-lane branch when adopted, the non-order branch when not) — new optional fields added to `ExtractedData` in `lib/platform/types.ts`.

**7. Reviewer visibility.** `StructureAuditNotice` now also accepts an `orientation` prop and renders a standalone amber notice ("Read after rotating the page... the stored preview below shows the original scan, not the rotated copy the model read") whenever `orientation_normalization.applied` is true — independent of `structure_audit.status`, since a rotation-adopted read can still have a structurally clean audit (that's exactly why item 1's confidence cap exists). Wired from `DocumentDetailPanel.tsx`, passing `extracted?.orientation_normalization`.

**8. Tests.** `tests/docu-extraction-quality.test.ts` rewritten:
  - Old single-letter-description fixture replaced with the two real Phase-0 fabrication shapes: 20× repeated `"Apricots"` (prices present, confidence 42, caught by the repeat signal) and 18 distinct invented names (all money columns blank, confidence 32, caught by missing-columns + low confidence).
  - New: `finalizeExtractionConfidence` (5 cases), unpriced-document guard (confidence 80 vs 60), boxes gating (3 cases), `decideClassificationRouting` (6 cases: both fabrication shapes escalate, confident clean statement accepts, already-`order` accepts without a second read, a low-confidence text cue escalates, and a high-confidence/clean-audit text cue escalates on its own).
  - All pre-existing tests in the file kept green except the two intentionally superseded by items 4/8 above (the wrong-shape fixture and the boxes-fallback fixture).

**9. Stale comments.** `document-ingest.ts`'s "One Haiku call decides the document type" is now "Usually one Haiku call decides the document type — no longer ALWAYS one: a non-order read that looks order-shaped earns a second, order-lane opinion below." `pdf-orientation.ts`'s rotation comment now states explicitly that `relativeRotations` are offsets ADDED to the page's existing rotation metadata (not absolute angles), and that `+0` is skipped because it's the caller's already-produced `initial` read.

**10. Hoisting + `betterExtraction` + empty-provenance guard.** In both wrappers' retry loops, `auditExtractionStructure(candidate)` is now called once per candidate (stored in `candidateAudit`) instead of twice (once for `.score`, again for `.status` in the break check). `betterExtraction` is used (not dropped) for the escalation adoption decision in `document-ingest.ts`, with an explicit `<StructuralExtraction>` type argument (TypeScript could not infer a common `T` from `ExtractionResult` and `OrderExtractionResult` on its own — they're structurally, not nominally, compatible). Both wrappers now only emit `orientation_normalization` when `attempted_rotations.length > 0` (previously `anthropic.ts` always set it once the retry branch was entered, even with an empty candidates array from a multi-page PDF; `order-reader.ts` already only set it inside the same branch, but this makes both wrappers' behavior identical and explicit).

### Deviations / notes for the architect

- `order-reader.ts`'s `orientation_normalization.applied` field changed from `selectedRotation !== variants.originalRotation` to `best !== initial` (`adoptedRotation`). These are provably equivalent here (the three relative offsets tried are 270/90/180, never 0, so a selected rotation only ever differs from the original when a candidate was actually adopted) — this is a readability/consistency change to match `anthropic.ts`'s `bestInput !== params` idiom, not a behavior change.
- The escalation path issues one extra `pp_stock_items` catalogue read before the document row exists (needed to build the order-lane prompt for the second opinion). This is a DB read, not a model call, and doesn't affect the plan's stated worst-case model-call bound.
- No new decision was required outside the plan — nothing was missing or ambiguous enough to warrant stopping.

## Verification (repo root)

- `npx tsc --noEmit` → **0 errors**.
- `npm run lint` → **50 errors / 40 warnings, all pre-existing** in `components/platform/vyso-ai/*`, `components/platform/wastewatch/*`, `lib/platform/price-watch/run.ts`, `lib/platform/wastewatch-data.ts`, `lib/posthog-server.ts`, `instrumentation-client.ts` — none in any file touched by this change. Zero new issues.
- `npm test` → **1119 pass, 0 fail, 0 cancelled** (`node --test tests/*.test.ts`).
- `npm run build` → **succeeds** (`next build`, Turbopack), no `/free-scan` or `/api/free-scan/*` routes in the output.
