# Plan: Wave B reconciliation, verification, and deployment

Architect: Fable 5 (plans/approves only — implementation by subagents)
Date: 2026-08-30
Status: **BLOCKED at Step 1 — VAT/confidence has not landed on origin/main**

## Goal
Move Codex's completed Wave B (email-body order ingestion + body/attachment
reconciliation + customer-interpretation preview) from uncommitted main-tree
work into an isolated worktree, rebase it onto the post-VAT/confidence
origin/main, semantically reconcile overlapping files, verify, migrate, and
deploy — without discarding either feature set.

## Acceptance criteria
- Combined invariants A–G of the task brief hold (email-body source,
  body+attachment single-order reconciliation, VAT line model intact,
  confidence semantics intact, customer rules SELECT-only, shared locale
  parser, GET-only Graph access).
- Focused + full test suite, tsc, changed-file lint, production build,
  `git diff --check` all pass on the reconciled branch.
- Additive migration applied to production BEFORE app deployment.
- Staged commit contains ONLY Wave B files.

## Current state (verified 2026-08-30)
- origin/main = `45da3a8` (Add automatic Microsoft Graph subscription
  renewal) — identical to the Wave B snapshot base. **No VAT/confidence
  commits exist on any branch.**
- VAT/confidence work is still **uncommitted** in worktree
  `.claude/worktrees/agent-aa1149055c4ec1f98`
  (branch `worktree-agent-aa1149055c4ec1f98`, base 45da3a8). It modifies:
  ExtractionEditor.tsx, DocumentReviewQueue.tsx, OrderReviewEditor.tsx,
  lib/ai/anthropic.ts, lib/ai/order-prompt.ts, classification-policy.ts,
  extraction-quality.ts, flags.ts, order-line-totals.ts,
  order-review-lines.ts, review-queue-shared.ts, lib/platform/types.ts,
  tests/docu-order-prompt.test.ts, tests/docu-order-review-lines.test.ts,
  + new tests docu-extraction-confidence.test.ts,
  docu-order-line-totals-vat.test.ts.
- Wave B lives as uncommitted work in the MAIN tree (branch
  `deploy/microsoft-webhook` @ 45da3a8): 16 tracked modifications
  (739 insertions / 72 deletions) + 6 new files.
- Preservation snapshot verified complete:
  `.ai/wave-b-snapshot-20260830-1058/` (tracked-wave-b.patch, 1358 lines,
  matches Codex's reported file list; untracked/ holds all 6 new files).
- Non-Wave-B untracked files in the main tree that MUST NOT be touched by
  cleanup: instrumentation-client.ts, lib/posthog-server.ts,
  supabase/free-scan.sql, public/serviceden-logo-concept.svg, tmp/,
  .ai/* plan/brief files.

## True overlap set (both streams modify)
1. lib/platform/types.ts
2. lib/ai/order-prompt.ts
3. lib/ai/anthropic.ts
4. components/platform/docu/DocumentReviewQueue.tsx
5. components/platform/docu/OrderReviewEditor.tsx
6. lib/platform/docu/order-review-lines.ts
7. tests/docu-order-prompt.test.ts
8. tests/docu-order-review-lines.test.ts
(lib/ai/order-reader.ts is Wave-B-only per current VAT worktree status, but
re-check after VAT lands — its final commit may differ.)

## Constraints / files not to touch
- No mailbox mutation of any kind; Graph access stays GET-only.
- No Entra/RBAC/subscription-scope/ImmutableId changes; rest_id stays.
- deferCommit:true preserved for unattended ingestion; no business writes
  before human approval.
- Do not modify VAT/confidence semantics: tax-aware line model, net/tax/
  gross validation, confidence normalization (null ≠ 0), current-review
  validation, stale-warning behavior are upstream-authoritative.
- Do not delete `.ai/wave-b-snapshot-20260830-1058/` until post-deploy.
- Do not touch the non-Wave-B untracked files listed above.

## Ordered steps
1. **GATE (blocked):** VAT/confidence must be committed and pushed to
   origin/main. Verify with `git fetch && git log origin/main` — expect a
   new SHA above 45da3a8 containing the VAT worktree's files. Record SHA.
2. Create branch `feature/wave-b-email-body` from the new origin/main;
   worktree at `.claude/worktrees/wave-b-email-body`. All Wave B work
   happens there.
3. Non-overlapping files: apply hunks from
   `.ai/wave-b-snapshot-20260830-1058/tracked-wave-b.patch` and copy the
   6 untracked/ files verbatim.
4. Overlap set: read the landed VAT/confidence version FIRST, then reapply
   Wave B intent hunk-by-hunk, preserving both feature sets. If canonical
   OrderExtractionResult gained VAT fields, the email-body reader emits
   them when present; never strip newer fields to fit the old patch.
   Log every dropped/redesigned Codex hunk with rationale.
5. Migration audit: inspect live Supabase schema for
   email_ingests.body_source_storage_path / body_source_content_type and
   documents.source_type; confirm supabase/microsoft-graph-ingest.sql is
   additive + idempotent against the post-VAT schema. Migration lands
   before app deploy.
6. Testing (in worktree): focused Wave B suite, VAT suite, confidence
   suite, Graph/Wave A suite, Doc-U UI suites; then full `npm test`,
   `tsc`, changed-file lint, production build, `git diff --check`.
7. Main-tree cleanup: revert ONLY the 16 tracked Wave B files
   (`git checkout 45da3a8 -- <list>` equivalent against the then-current
   base is WRONG post-rebase — instead `git restore` the 16 files and
   remove only the 6 Wave B untracked files). Snapshot stays.
8. Pre-deploy report per Step 8 of the brief; then commit
   ("Add email-body order ingestion and message reconciliation"), show
   staged list, show commits ahead, push only on clean fast-forward.
9. Post-deploy smoke per Step 10 (read-only). No backfill, no XLSX, no
   ImmutableId, no subscription recreation.

## Edge cases
- VAT/confidence may land with a different final shape than today's
  worktree status — re-derive the overlap set from the actual landed diff.
- documents.source_type may conflict with any VAT-stream schema change to
  the same migration file — reconcile in the SQL file, keep it re-runnable.
- Retry/idempotency: pending/failed body documents must recover into the
  SAME document/storage object ((email_ingest_id, source_attachment_id)
  uniqueness with source-part ID `email-body`).
- Amendment rule stays narrow: single-line explicit corrections only.

## Verification commands
- `git fetch origin && git rev-parse origin/main`
- `npm test` (full), focused: `npm test -- <wave-b/vat/confidence/graph files>`
- `npx tsc --noEmit`
- `npx next build`
- `git diff --check`
