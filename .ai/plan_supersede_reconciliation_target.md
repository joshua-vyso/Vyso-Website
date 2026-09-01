# Plan: Supersede through reconciled canonical documents

Date: 2026-08-31. Architect: Fable. Worktree `.claude/worktrees/supersede-reconciliation-target`, branch `feature/supersede-reconciliation-target`, base a2f282a. Small, surgical fix. Authorized through deploy + Four Seasons-only live verification.

## Root cause (proven live)
`supersede_source` targeting 'email-body' on the Four Seasons ingest (9a22091f…) ran attachment-first: the html attachment became a new canonical order doc (1823e3fd…), then the body pass entered Wave B's RECONCILE branch (`reconcileBodyWithOrderDocument`) which absorbed the body evidence into that attachment doc (`message_order_evidence.primary_source: 'combined'`) — so no body-specific successor document was ever created. The supersede completion logic found no replacement, correctly failed safe (`reprocess_log` outcome `no_replacement`), and left the old zero-line body doc (2feea9da…) ACTIVE alongside the attachment doc. Two active docs; expected one.

## Fix
In the supersede completion path (lib/platform/microsoft-graph-ingest.ts — where `no_replacement` is currently recorded): before declaring no_replacement, attempt RECONCILIATION-TARGET resolution. The old target document may be superseded by a document of a DIFFERENT source when and only when ALL hold:
1. Action was explicit `supersede_source` with an exact `target_source` (already guaranteed by the path).
2. The replacement candidate is on the SAME email_ingest (same business message), status extracted/approved, `superseded_at is null`, and is not the old document itself.
3. The candidate's `extracted_data.message_order_evidence` EXPLICITLY records the targeted source as contributing evidence — for target 'email-body': `primary_source === 'combined'` (body absorbed) or `body_source_part_id`/body-sourced fields present per the evidence contract; for an attachment target: the attachment id in `attachment_source_ids`. Read the actual MessageOrderEvidence shape (lib/platform/types.ts) and use the strongest explicit marker — do not infer from timing.
4. EXACTLY ONE such candidate exists. Zero → keep current `no_replacement` fail-safe. More than one → fail closed with a distinct outcome (`ambiguous_replacement`), old doc stays active.
5. This run's replacement extraction/reconciliation succeeded (the candidate was updated in THIS run — pass the reconciliation result's documentId through from the core rather than re-querying blindly; if the core reports the reconciliation target id for the targeted source, use precisely that and verify conditions 2-3 against the row).
Then: mark old doc `{superseded_at, superseded_by_document_id: candidate.id, supersede_reason}` and set `candidate.supersedes_document_id = old.id` — same two-write pattern and compensation conventions as the existing direct-successor path. Log `reprocess_log` outcome 'superseded_via_reconciliation' with both ids. NEVER create a third document. Idempotency: a repeat request on the now-single-active state is refused by the existing active-copy/409 logic (verify + test).

Preferred implementation: the cleanest signal is the core's own knowledge — `reconcileBodyWithOrderDocument` returns/knows the canonical documentId it updated. Thread that id back to the supersede completion (e.g. in the run result) so condition 5 is exact, and use conditions 2-4 as verification, not discovery. Only if threading is disproportionate, fall back to the query-based discovery with the same fail-closed rules. Keep the change narrow: do NOT touch the resolver, the retry action, processed_attachment_ids semantics, or the direct-successor path (Belair) beyond shared helpers.

## Tests (extend tests/email-reprocess.test.ts / microsoft-graph-ingest.test.ts)
- direct successor path unchanged (Belair-shaped — regression).
- targeted source reconciles into another-source canonical doc → that doc becomes supersede target; old superseded; links bidirectional; NO third document.
- replacement must explicitly carry targeted-source provenance (candidate without it → no_replacement).
- two plausible candidates → ambiguous_replacement, old stays active.
- cross-ingest candidate rejected.
- failed replacement/reconciliation → old stays active (existing behavior).
- repeated supersede request after success → 409/no-op.
Full battery: focused, Wave B, HTML usability, stale-ID suite, npm test (baseline 1412), tsc, lint (no new), build, diff --check.

## Authorization
If green: commit "Support supersede through reconciled canonical documents", fast-forward push, Vercel, smoke, then re-run ONLY the Four Seasons supersede live and verify: 1 active (html attachment doc 1823e3fd…, 2 lines, PO JBG0118300) + 1 superseded (2feea9da…), no third doc, no external fetch, no operational writes. Do NOT touch Doppio/Scooters/Belair/Sandton.
