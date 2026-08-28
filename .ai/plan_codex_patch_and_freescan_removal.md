# Plan: Free-scan removal + hardening patch for the Codex orientation/quality changes

Author: Fable (architect). Implementer: subagent. Date: 2026-08-28. USER-APPROVED (including deploy; deploy itself is done by the architect after verification — the implementer does NOT commit or push).

Context docs: `.ai/plan_vision_extraction_routing.md` (Phase 0 + review findings), `.ai/plan_locale_numeric_normalization.md`. The working tree holds three uncommitted streams: A locale-number (done, tested), B Codex orientation/quality (works empirically — live-fired end-to-end on the fixture — but has verified defects), C customer-evidence matching (leave completely untouched).

## Part 1 — Remove the free-scan feature entirely

The user is discontinuing free-scan. Delete, with a full reference sweep:

- `app/free-scan/` (page, opengraph-image), `app/api/free-scan/` (all routes), `components/finch/scan/` (all), `lib/platform/free-scan/` (all), `tests/free-scan-content.test.ts` and any other free-scan test files.
- Sweep and remove every remaining reference: grep case-insensitively for `free-scan`, `free_scan`, `freeScan`, `ScanHero|ScanFlow|ScanUpload|ScanAuditGate|ScanTrust|ScanNoDocs|ScanResultPanel|ScanProcessing|ScanLeadForm|scan-jsonld|scan-content|select-scan-batch` across app/, components/, lib/, tests/, middleware, sitemap/robots/metadata, nav/footer/homepage links and CTAs on the finch site, analytics event definitions (the 29 pre-existing tsc errors are `free_scan_*` keys missing from `AnalyticsEvents` — removing the emitters must clear ALL of them; also delete any `free_scan_*` keys that DO exist in the events type).
- If a marketing page links to /free-scan, remove the link/CTA cleanly (adjust surrounding copy/layout minimally; do not redesign).
- Do NOT touch: Supabase tables/buckets/data (no DB changes), `vercel.json` (it has no free-scan cron — verified), anything under Doc-U/platform extraction, other `components/finch/**`.
- Report (do not act): any Vercel-dashboard-configured cron or external link that may still point at the deleted routes (e.g. /api/free-scan/cleanup), for the user to remove in the dashboard.

Acceptance: `npx tsc --noEmit` → ZERO errors repo-wide (all 29 were free_scan; if anything non-free-scan remains, STOP and report rather than fixing unrelated types). `grep -rniE "free.?scan" app components lib tests` → no hits (docs/.ai may keep history).

## Part 2 — Hardening patch on Stream B (keep what works, close the holes)

Empirical constraint: the live-fire proved the Haiku orientation retry + type-swing IS the fix for the fixture (270→180 made Haiku classify `order`; Sonnet then read 20/20 rows summing exactly to 6 458.22). Do NOT remove the retry or pin document_type. Patch exactly as follows:

1. **Rotation-adopted results always get human review** (fixes review finding 1 + neutralizes finding 2's risk): in BOTH wrappers (`lib/ai/anthropic.ts` extractDocument, `lib/ai/order-reader.ts` extractOrderDocument), when the adopted best input is a rotated candidate (`bestInput !== params`), cap final `overall_confidence` at **75** (below DOC_LOW_CONFIDENCE_THRESHOLD=80) IN ADDITION to the existing 65-cap when the audit says needs_review. House-style comment: a read that only succeeded after rotating a degraded scan is never auto-trustworthy; a rotated fabrication must not outrank the original's honest low confidence.
2. **Extract the finalize logic into a pure, tested helper**: add `finalizeExtractionConfidence(confidence: number, opts: { adoptedRotation: boolean; auditStatus: 'ok' | 'needs_review' })` (or equivalent) to `lib/platform/docu/extraction-quality.ts`; both wrappers delegate. This puts the cap rules under direct unit test without mocking the API.
3. **Make the unpriced-document guard real** (finding 3): in `auditExtractionStructure`, when `count >= 3 && missingPrice/count >= 0.8 && missingAmount/count >= 0.8 && confidence >= 70`, SKIP the missingPrice and missingAmount penalties entirely (a document that prints no money columns is a document shape, not evidence loss). Remove the now-dead `severeColumnLoss` disjunct from the status expression (when confidence < 70 the score<70 disjunct already fires — keep one comment explaining that). Rewrite the misleading comment block.
4. **Boxes penalty only with raw evidence** (finding 6): apply the `unsupportedBoxes` penalty only when `line.raw_description` is present (order lane); the Haiku schema strips packaging words from `description`, so box-priced statements were being falsely penalized.
5. **Bound the unattended cost** (finding 4): `extractOrderDocument` gains an `orientationChecked?: boolean` param; when true, skip its own orientation retry loop. `document-ingest.ts` passes `orientationChecked: true` whenever `preparedDocumentInput` returned a rotated copy — and ALWAYS on escalation reads (see 6). Worst case per unattended document becomes 4 Haiku + 2 order calls (incl. provider fallback), inside maxDuration 300.
6. **Routing escalation** (the safety net for Haiku fabricating at every rotation — the Phase-0-observed case): new pure `lib/platform/docu/classification-policy.ts`: given the classification `ExtractionResult` (with its structure_audit), return `'accept' | 'escalate_order'`. Escalate when type !== 'order' AND (structure_audit.status === 'needs_review' OR overall_confidence < 60 OR order cues present — case-insensitive "purchase requisition"/"purchase order"/"requisition" or a PO-number-like pattern in supplier/notes/fields). Wire in `document-ingest.ts` at the `isOrder` gate (~line 722): on escalate, run the order reader on the prepared input with `orientationChecked: true`; adopt the order result iff its `auditExtractionStructure` score EXCEEDS the classification read's; record `escalated: true` plus both scores in extracted_data. If not adopted, keep the original (already flagged) result. The adopted order result routes down the order lane.
7. **Reviewer visibility** (finding 9): one line in `StructureAuditNotice` (or the component rendering structure_audit) when `orientation_normalization.applied`: the lines were read after rotating the page; the stored preview shows the original scan.
8. **Tests**:
   - Replace the wrong-shape fixture in `tests/docu-extraction-quality.test.ts` (single letters — a shape the bug never produced) with the two REAL fabrication shapes: (i) 20 identical rows `description:"Apricots", unit:"boxes"`, prices present, confidence 42 → needs_review (repeats dominate); (ii) 18 DISTINCT names (Maize Canned, Mace, Madeira, ...), `unit:"boxes"`, all unit_price/amount empty, confidence 32 → needs_review.
   - New tests: `finalizeExtractionConfidence` (adoptedRotation caps at 75 even when audit ok; needs_review caps at 65; both false → passthrough); unpriced-document guard (desc+units complete, no money columns: confidence 80 → ok/no cap, confidence 60 → needs_review); boxes gating (boxes without raw_description → NOT penalized; boxes with non-box raw_description → penalized); classification-policy (both real fabrication fixtures → escalate; confident clean statement → accept; type order → accept; low-confidence + "purchase requisition" cue → escalate).
   - Keep every existing passing test green EXCEPT the replaced wrong-shape assertions and any free-scan tests (deleted in Part 1).
9. **Stale comments** (finding 10): `document-ingest.ts:714` ("One Haiku call decides" → no longer one), `pdf-orientation.ts:37-38` (clarify relative-vs-absolute rotation ordering). Free-scan comment sites die with Part 1.
10. Minor: hoist the duplicate `auditExtractionStructure(candidate)` call in each retry loop into a variable; drop the unused `betterExtraction` export OR use it in the escalation adoption (prefer using it); skip emitting `orientation_normalization` when `attempted_rotations` is empty.

DO NOT TOUCH: Stream A locale-number code or tests; Stream C customer-evidence code (`customer-match.ts`, customerEvidence plumbing, microsoft-graph-* customer fields) beyond mechanical adjacency; order-prompt extraction contract; Microsoft ingestion architecture; deferCommit.

## Verification (implementer runs all; architect re-runs before deploy)

```
npx tsc --noEmit        # ZERO errors expected after Part 1
npm run lint            # zero NEW issues (pre-existing wastewatch/price-watch/posthog remain)
npm test                # full suite green
npm run build           # must succeed — this is the deploy gate
```

Write `.ai/implementation_codex_patch_freescan.md` (Part 1 removal inventory incl. dashboard follow-ups; Part 2 per-item outcomes; deviations). NO git commits, NO push, NO deploy — the architect does those after verification.
