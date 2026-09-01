# Plan: Ingest re-resolution + controlled supersede/reprocess

Date: 2026-08-31. Architect: Fable. Worktree: `.claude/worktrees/ingest-reresolution-supersede`, branch `feature/ingest-reresolution-supersede`, base c6ee856. No commit/push/deploy — STOP for approval. Synthetic fixtures only; the five live candidates are NOT processed in this task.

## Why (established facts from prior audits — do not re-derive)

- All five historical candidates' stored `graph_message_id` values are dead (`ErrorItemNotFound`) — an external actor moves processed mail to Deleted Items, and REST ids are folder-dependent. This is systemic, not incidental.
- Fatal exact-ID assertions: `microsoft-graph-core.ts:449-455` (`metadata.id !== messageId` → InvalidResponse) and `microsoft-graph-ingest-core.ts:601-603` (`message.id !== input.expectedMessageId`).
- Retry entry points: `/api/email/retry` (admin session, `.in('status', ['queued','failed','quarantined','ignored'])` — NEVER 'done'), cron `/api/email/process` (CRON_SECRET bearer, claims 'queued' + stale 'processing', attempts<3), webhook (new rows only; duplicate `(org_id, graph_message_id)` insert is a swallowed no-op). `processEmailIngest` early-returns unless status is queued/processing (`email-ingest.ts:264`). CAS claim: `email-ingest.ts:278-301`, `STALE_PROCESSING_MS = 10min`.
- `email_ingests.processed_attachment_ids` is a write-once skip list (`microsoft-graph-ingest.ts:119-151`): seeded from the column, the loop only ever ADDS; `recoverableBodySource` (body doc in pending/error) merely declines to add. Nothing in the repo clears it. `alreadyDone.has('email-body')` gates the body block (`ingest-core:724`); attachments gated at `:628`.
- `existingOrderDocuments` excludes body-sourced docs (`microsoft-graph-ingest.ts:149`).
- `document-ingest.ts:731-773`: existing extracted/approved copy → silent ok no-op; recoveringDocumentId path is body-only pending/error and SKIPS the storage upload (`:866-870` — stale bytes stay).
- Storage: `emailSourceStoragePath` sha256(`${ingestId}\0${sourcePartId}`), all uploads `upsert:false` with tolerated unique-violation. Cannot duplicate, cannot replace.
- Idempotency keys: unique `(org_id, graph_message_id) where source='microsoft_graph'`; unique `documents (email_ingest_id, source_attachment_id) where both not null`.
- `email_ingests` has NO `internet_message_id` column; `graph_conversation_id` is stored but write-only. `classification_evidence`/`attachment_diagnostics` are ARRAY-constrained jsonb.
- deferCommit true on all unattended sinks; `/api/ai/extract` is NOT safe for email docs (inline operational sync; also errors on text/plain order docs).
- Auth conventions: `resolveUser` + role in (owner,admin) for admin routes; `CRON_SECRET` bearer for operational routes. CRON_SECRET is NOT in local .env.local (Vercel env only).

## Design

### D1. Identity model (additive; business identity ≠ provider locator — ImmutableId-ready)

Migration (hand-pasted by Josh; additive + one index recreate):
```sql
alter table email_ingests add column if not exists internet_message_id text;
alter table email_ingests add column if not exists graph_message_id_resolved text;
alter table email_ingests add column if not exists reprocess_log jsonb not null default '[]'::jsonb;
alter table email_ingests add column if not exists pending_reprocess jsonb;
alter table documents add column if not exists superseded_at timestamptz;
alter table documents add column if not exists superseded_by_document_id uuid references documents(id);
alter table documents add column if not exists supersedes_document_id uuid references documents(id);
alter table documents add column if not exists supersede_reason text;
drop index if exists documents_ingest_attachment_uidx;
create unique index if not exists documents_ingest_attachment_uidx
  on documents (email_ingest_id, source_attachment_id)
  where email_ingest_id is not null and source_attachment_id is not null and superseded_at is null;
```
- `graph_message_id` (original) is NEVER rewritten — it stays the idempotency key and historical provenance. `graph_message_id_resolved` is the current locator; the fetch layer uses `resolved ?? original`.
- `internet_message_id` = the RFC business identity. Going forward, add `internetMessageId` to the single-message `$select` (microsoft-graph-core.ts) and persist it on every NEW ingest at creation — this is the future resolver key and eases ImmutableId cutover. Historical rows get it backfilled the first time re-resolution succeeds.
- `reprocess_log` jsonb ARRAY of audit events (see D5). `pending_reprocess` jsonb: the single in-flight controlled-reprocess intent (see D4); cleared on completion.
- Guarded constraint blocks in the tracked supabase/microsoft-graph-ingest.sql updated to match (guard style as existing).

### D2. Deterministic resolver — NEW pure-ish module `lib/platform/microsoft-graph-resolve.ts`
`resolveStaleGraphMessageId(deps, ingest)` — GET-only, fail-closed:
1. GET stored (resolved ?? original) id; resolves → return `{status:'current'}` (no-op; test 1).
2. On ItemNotFound ONLY (other errors propagate):
   a. If `internet_message_id` present: `$filter=internetMessageId eq '<v>'` over /users/{mailbox}/messages; exactly 1 → resolved. 0 or >1 → fail closed.
   b. Else: `$filter=conversationId eq '<graph_conversation_id>'` (whole mailbox, $top bounded; URL-encode filter values — conversation ids contain '=', internetMessageIds contain '<>@'; both filters verified working server-side with no ConsistencyLevel headers); then CLIENT-SIDE exact-match filter: receivedDateTime equals stored received_at to the second (NORMALIZE timezone suffix first — Graph emits 'Z', the DB stores '+00:00'; forensics-proven requirement) AND from address equals stored from_email CASE-INSENSITIVELY (forensics-proven requirement: the pipeline stores from_email lowercased while Graph returns original header casing — 'Chefthabo@doppio.co.za' etc.; byte-exact from comparison fails closed on 3 of the 5 live candidates) AND subject equals stored subject byte-for-byte (Graph preserves trailing/multiple internal spaces verbatim — verified). Exactly 1 survivor → resolved (and capture its internetMessageId for backfill). 0 or >1 → fail closed with the survivor count in the error. No conversationId stored → fail closed.
3. On success: verify by GET of the resolved id (id echo assertion against the RESOLVED id), then persist `graph_message_id_resolved`, `internet_message_id`, and a `reprocess_log` event `{kind:'id_resolution', original, resolved, method:'internet_message_id'|'conversation_exact_match', evidence:{received_at, from, subject_sha256}, at, initiator}`. Never store subject text in the log if it could be sensitive — store a hash + the match fields already on the row.
- Subject-only or conversationId-only matches are NEVER sufficient (tests 7, 8). Mailbox is always the ingest's own mailbox (test 9). No folder enumeration — filtered queries only.
- Resolution runs ONLY from the controlled admin path (D4) — normal live webhook processing is untouched (no automatic mailbox-wide search on every retry).

### D3. Assertion changes (narrow, explicit)
`fetchMicrosoftGraphMessage` and the ingest core keep their id assertions, but the expected id becomes the id actually requested: thread an explicit `messageId` through (the caller passes `resolved ?? original`). `ingestMicrosoftGraphMessage` gains optional input `resolvedMessageId?: string` — when present (set only by the reprocess path after D2 verified), `expectedMessageId = resolvedMessageId` and the Graph fetch uses it. The webhook path never sets it — notification processing stays strict on the notification's own id. No global weakening.

### D4. Controlled reprocess entry point + supersede semantics
NEW route `app/api/email/reprocess/route.ts` (POST):
- AUTH (decision, tradeoff reported to Josh): accepts EITHER an owner/admin session (consistency with /api/email/retry) OR `Authorization: Bearer ${CRON_SECRET}` (operational tooling convention, matches /api/email/process; this is what makes controlled backfill drivable without a browser). Both fail closed; no unauthenticated access; rate-limited like siblings.
- INPUT (exact, no vague searches): `{ emailIngestId: uuid, action: 'retry_failed' | 'supersede_source', targetSource?: 'email-body' | string /* graph attachment id */, reason: string }`. Requires reason. Rejects unknown ingest ids and org mismatches.
- `retry_failed`: allowed for status failed/ignored/queued. Runs D2 resolution if the stored id is dead; writes `pending_reprocess = {action, initiator, reason, at}` + requeues (status='queued', error=null, attempts=0 — the exact semantics of the existing retry route) → normal pipeline picks it up (cron or the route's own after() call to processEmailIngest, mirroring /api/email/retry).
- `supersede_source`: allowed ONLY for status 'done'; requires `targetSource`. Writes `pending_reprocess = {action:'supersede_source', target_source, initiator, reason, at, prior_status:'done'}` and requeues. The processor (below) consumes it.
- Processor changes (`microsoft-graph-ingest.ts` / `-core.ts`): when the claimed ingest carries `pending_reprocess.action==='supersede_source'`:
  - Build `reprocessSources = new Set([target_source])`; pass through dependencies. The alreadyDone gates become `alreadyDone.has(id) && !reprocessSources.has(id)` — ONLY the targeted source bypasses its marker; every other processed id stays protected (tests 21-24). `processed_attachment_ids` is never cleared.
  - The body/attachment ingest for the targeted source runs in SUPERSEDE MODE: (1) full extraction completes FIRST (all AI work; any failure aborts with old document untouched and status restored to `prior_status` — test 18); (2) then atomically-ish: mark old active document for that source `{superseded_at, superseded_by_document_id: <new id placeholder — see order>, supersede_reason}` and insert the new document (`supersedes_document_id = old.id`). Ordering constraint: the partial unique index excludes superseded rows, so the old row is marked superseded immediately before the new insert; if the insert then fails, COMPENSATE by clearing the supersede marks and restoring prior status, logging the failure — the old document never stops being the active result on failure. (This is the honest implementation of "old marked superseded only after replacement succeeds": the AI/extraction success gates the swap; the two-row swap itself is compensated.)
  - New document's storage: original HTML stored at the standard `email-body-original` part id (first time for historical rows); the NEW derived text/source bytes stored at deterministic part id `email-body:supersede:<oldDocumentId>` (or `<attachmentId>:supersede:<oldDocumentId>`) so historical bytes are never overwritten and re-runs are idempotent. Old objects untouched.
  - Completion: `pending_reprocess` cleared, `reprocess_log` appended `{kind:'supersede', target_source, old_document_id, new_document_id, outcome, at, initiator, reason}`, ingest status → 'done'. Failure: log appended with outcome:'failed' + error, status restored to prior_status ('done'), old doc active.
  - Idempotency (tests 25-27): if the target source's active document already `supersedes_document_id != null` and was produced by a completed supersede for the same reason/target, a repeat request is a recorded no-op (409 with explanation), not another replacement. Crash between supersede-mark and insert: on reclaim, the compensator detects a superseded row with no successor and restores it before re-attempting.
- deferCommit: the reprocess path uses the same unattended ingest sinks — deferCommit:true everywhere; zero operational writes (tests 28-33).
- Four Seasons note: `supersede_source` targeting the historically-ignored HTML attachment simply lets the attachment run under the NEW triage (processable text/html) — creating the attachment-canonical order; the old 0-line body doc is superseded via targetSource 'email-body' only if separately requested, OR (cleaner) a single `targetSource:'email-body'` reprocess re-runs the body which now reconciles into… no: keep it explicit and simple — one request per source; the run's normal Wave B reconciliation handles body+attachment when both are live in the same run. The implementer follows the existing core flow; do not invent multi-source choreography beyond passing the set.
- Sandton Sun: resolution will succeed but XLSX stays unsupported — expected terminal state remains failed/reviewable. No XLSX work.

### D5. Audit trail
All in `reprocess_log` (jsonb array, capped at 50 entries, oldest dropped with a note): initiator ('admin:<user id>' | 'cron_secret'), timestamps, original/resolved ids, resolution method + evidence fields, target source, old/new document ids, reason, outcome, error (redacted). Never raw bodies/tokens/secrets. No new logging subsystem.

### D6. Status semantics
'done' meaning preserved: the temporary queued/processing during a controlled reprocess is recorded in `pending_reprocess` + `reprocess_log`; on any failure the prior status is restored (a done ingest never ends up failed because a reprocess attempt failed). `finalMicrosoftGraphIngestStatus` unchanged for normal runs; the supersede path computes its completion status explicitly.

### D7. UI (minimal)
- DocumentDetailPanel: when `superseded_at` is set, a compact banner "Superseded — reprocessed from an updated source interpretation" + link to the successor (`superseded_by_document_id`); document read-only in that state (no confirm actions).
- Review queue / documents list queries: exclude superseded docs from ACTIVE review surfaces (add `superseded_at is null` to the queue/list filters — enumerate: review-queue.ts, review-actions list, DocumentsTable/docu pages queries; keep them reachable by direct id for audit).
- No history UI beyond this.

### D8. ImmutableId compatibility
internet_message_id persisted on all new ingests (business identity); locator (`graph_message_id`/`_resolved`) kept separate; resolver prefers internetMessageId. No ImmutableId enablement, no subscription changes, MICROSOFT_GRAPH_ID_TYPE untouched.

## Files to change
NEW: lib/platform/microsoft-graph-resolve.ts, app/api/email/reprocess/route.ts, tests/microsoft-graph-resolve.test.ts, tests/email-reprocess.test.ts.
MODIFIED: lib/platform/microsoft-graph-core.ts ($select + explicit expected id), lib/platform/microsoft-graph-ingest-core.ts (reprocessSources gates + supersede-mode dependency threading), lib/platform/microsoft-graph-ingest.ts (pending_reprocess consumption, internet_message_id persistence, existing-docs query gains superseded filter), lib/platform/microsoft-message-order.ts (supersede-mode document creation + versioned storage part ids), lib/platform/document-ingest.ts (supersede-aware existing-copy check: superseded rows don't block; versioned part id passthrough), lib/platform/email-ingest.ts (claim path aware of pending_reprocess prior-status restore), lib/platform/types.ts (additive Document supersede fields; EmailIngest fields), supabase/microsoft-graph-ingest.sql (guarded blocks), review-surface queries + components/platform/docu/DocumentDetailPanel.tsx (superseded banner) + the queue/list query sites found for D7, tests extended (microsoft-graph-ingest.test.ts).

## Hard invariants
Graph GET-only (resolver included); no subscription changes; webhook path byte-compatible for normal notifications; one email = one email_ingest (no new rows ever); old documents never deleted/rewritten (only the four supersede columns added); processed_attachment_ids never cleared; deferCommit everywhere; no operational writes; no XLSX; no ImmutableId; no live candidate processed in this task; never log raw content.

## Tests: implement the task's 45-case matrix (stale-ID 1-10, mailbox safety 11-13, supersede 14-20, targeted source 21-24, idempotency 25-27, safety 28-33, regressions 34-45). Full suite baseline at c6ee856 is 1354.

## Verification
npm install; npx tsc --noEmit; focused new tests; npm test; npm run lint (baseline first); npm run build; git diff --check. NO commit/push. STOP for approval. Migration SQL goes in the final report for Josh to hand-run before deploy.
