-- ============================================================================
-- Free Operations Scan (/free-scan) — the anonymous lead-generation funnel.
-- ----------------------------------------------------------------------------
-- HOW TO APPLY: paste this whole file into the Supabase SQL editor and run it.
-- It is IDEMPOTENT — every statement is `if not exists` / `drop ... if exists`,
-- so re-running it is safe and changes nothing on a database that already has
-- the tables.
--
-- >>> RE-PASTE REQUIRED (2026-08-25, Addendum 1) <<<
--   This file has CHANGED since it was last applied. If you have already run an
--   earlier copy, PASTE AND RUN IT AGAIN — it adds `scan_documents.claimed_at`
--   (`alter table ... add column if not exists`, safe on a populated table) and
--   an index for the claim loop. Until that column exists, the resumable
--   process route cannot tell a document being read right now from one whose
--   reader died, and a scan can wedge on "Reading the document structure".
--   Nothing else in this file changed; re-running the rest is a no-op.
--
-- MANUAL STEP THAT IS NOT IN THIS FILE (Supabase has no SQL API for it):
--
--   Create a PRIVATE storage bucket named exactly  free-scan
--   (Dashboard → Storage → New bucket → name "free-scan", Public = OFF).
--
--   Leave it with NO storage policies. Every read and write goes through the
--   service-role client in app/api/free-scan/*, which bypasses RLS; the browser
--   only ever receives a short-lived SIGNED UPLOAD url created server-side, and
--   never a download url of any kind. A public bucket, or a bucket with an anon
--   policy, would put a stranger's supplier invoices on the open internet.
--
-- WHY ITS OWN TABLES AND ITS OWN BUCKET, rather than `documents`/`organizations`:
-- the scan is UNAUTHENTICATED. The tenant model keys every isolation guarantee
-- off a logged-in user's org, and there is no user here to key off. So the scan
-- is given its own two tables and its own bucket, joined to nothing in the
-- tenant schema, and the only credential that can reach them is the service
-- role — the same posture as the inbound-email webhook
-- (lib/platform/supabase-service.ts). A visitor's session is identified by an
-- opaque bearer token whose SHA-256 hash is all this database ever sees.
--
-- RETENTION: `expires_at` defaults to 14 days out, which is the promise the
-- page makes in writing. A daily cron (GET /api/free-scan/cleanup, scheduled in
-- vercel.json) deletes the storage objects and then the rows for anything
-- expired or soft-deleted. `deleted_at` is set by DELETE /api/free-scan/session
-- when a visitor deletes their own scan.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- scan_sessions — one anonymous free-scan lead + session.
-- ---------------------------------------------------------------------------
-- `token_hash` is sha256(raw token) as lowercase hex. The raw token is 32
-- random bytes, base64url, returned exactly once at session creation and kept
-- only in the visitor's browser. There is deliberately no way to recover a
-- session from this table: losing the token means starting over, which is the
-- correct failure mode for a lead form that holds someone's invoices.
--
-- `result` holds the SHAPED ScanResult (lib/platform/free-scan/types.ts) and
-- nothing else — never raw extraction, never document text. It is the exact
-- object the status route returns.
create table if not exists scan_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  name text not null,
  email text not null,
  business text not null,
  whatsapp text,
  industry text,
  consent_contact boolean not null default false,
  consent_estimate boolean not null default false,
  status text not null default 'created', -- created | uploading | processing | complete | failed
  progress_stage smallint not null default 0, -- 0..5, mirrors the UI stage list
  result jsonb,           -- shaped ScanResult only; never raw extraction
  finding_type text,      -- e.g. 'supplier_price_drift' | null
  finding_status text,    -- 'revealed' | 'no_finding' | null
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- scan_documents — one uploaded file per row.
-- ---------------------------------------------------------------------------
-- `extracted_data` is SERVER-ONLY. It is read by the process route to build the
-- finding and is never serialized into any HTTP response — the status route
-- uses a whitelist serializer (lib/platform/free-scan/session.ts →
-- serializeScanStatus) precisely so a future column cannot leak by being added.
-- `storage_path` is server-only for the same reason: it is the one string that
-- would let a signed url be minted for someone else's document.
--
-- `content_sha256` is the byte hash of the uploaded file, used to mark
-- identical re-uploads `skipped` so the same invoice cannot be counted twice.
create table if not exists scan_documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references scan_sessions(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  byte_size integer not null,
  mime_type text not null,
  content_sha256 text,
  status text not null default 'staged', -- staged | uploaded | extracting | extracted | skipped | error
  skip_reason text,
  document_type text,
  extracted_data jsonb,   -- server-only; never serialized to the browser
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- claimed_at — the extraction lock. ADDED 2026-08-25 (Addendum 1).
-- ---------------------------------------------------------------------------
-- Extraction no longer happens in one big pass inside /api/free-scan/process.
-- Each file is read at UPLOAD time, and `process` is a resumable catch-up loop
-- that may run several times over one scan. Two invocations must therefore never
-- read the same document at once, and a document must never be stranded because
-- the invocation reading it was killed.
--
-- Both are handled by one conditional update: `status 'uploaded' -> 'extracting'`
-- with `claimed_at = now()`, which exactly one caller can win. `claimed_at` is
-- what makes the claim RELEASABLE — a row still on 'extracting' more than two
-- minutes later (STALE_CLAIM_MS in lib/platform/free-scan/session.ts) is treated
-- as abandoned and may be claimed again. Without the column a dead reader wedges
-- the scan permanently.
--
-- Server-only, like every other column here: the status serializer whitelists
-- its output field by field, so this cannot reach a browser by being added.
alter table scan_documents add column if not exists claimed_at timestamptz;

-- ---------------------------------------------------------------------------
-- RLS: ENABLED WITH ZERO POLICIES.
-- ---------------------------------------------------------------------------
-- This is not an oversight — it is the access control. With RLS on and no
-- policy, the anon and authenticated roles can do NOTHING with these tables:
-- no select, no insert, no update, no delete. Only the service role (which
-- bypasses RLS by design) can touch them, and the service-role key exists only
-- in server route handlers. Adding a policy here would open the tables to any
-- browser holding the public anon key, which is every visitor to the site.
alter table scan_sessions enable row level security;
alter table scan_documents enable row level security;

create index if not exists scan_documents_session_idx on scan_documents(session_id);
create index if not exists scan_sessions_expires_idx on scan_sessions(expires_at);
-- The claim loop's read: "everything for this session, by status". One session's
-- documents is at most fifty rows, so this is a convenience rather than a
-- necessity — but the process route runs it on every pass of a resumable loop.
create index if not exists scan_documents_claim_idx on scan_documents(session_id, status);
