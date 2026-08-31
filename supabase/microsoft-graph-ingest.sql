-- ==========================================================================
-- Microsoft Graph -> existing Vyso email/document ingestion pipeline.
--
-- MICROSOFT 365 IS READ-ONLY. This migration stores all workflow state in Vyso;
-- Outlook messages and attachments are never used as processing state.
-- Idempotent: safe to run again in the Supabase SQL editor.
-- ==========================================================================

-- Reuse email_ingests as the durable provider-neutral queue/audit row. Existing
-- rows are Resend rows; Graph notifications arrive before message metadata is
-- fetched, so provider-specific and sender fields must permit NULL initially.
alter table email_ingests add column if not exists source text not null default 'resend';
alter table email_ingests alter column resend_email_id drop not null;
alter table email_ingests alter column from_email drop not null;

alter table email_ingests add column if not exists mailbox text;
alter table email_ingests add column if not exists graph_message_id text;
alter table email_ingests add column if not exists graph_conversation_id text;
alter table email_ingests add column if not exists sender_name text;
alter table email_ingests add column if not exists received_at timestamptz;
alter table email_ingests add column if not exists has_attachments boolean;
alter table email_ingests add column if not exists classification text;
alter table email_ingests add column if not exists classification_confidence int;
alter table email_ingests add column if not exists classification_reason text;
alter table email_ingests add column if not exists ordering_intent_detected boolean;
alter table email_ingests add column if not exists classification_primary_source text;
alter table email_ingests add column if not exists classification_evidence jsonb not null default '[]'::jsonb;
alter table email_ingests add column if not exists attachment_diagnostics jsonb not null default '[]'::jsonb;
-- Private Vyso-side copy of a message body when the body itself contributes
-- order evidence. The raw body is never used as mailbox workflow state.
alter table email_ingests add column if not exists body_source_storage_path text;
alter table email_ingests add column if not exists body_source_content_type text;
-- Existing/live notifications use the default REST id. Future immutable-id
-- subscriptions opt in explicitly and stamp new rows with the other value.
alter table email_ingests add column if not exists graph_id_type text not null default 'rest_id';
alter table email_ingests add column if not exists updated_at timestamptz not null default now();

-- A duplicated Graph notification or worker retry can never create a second
-- ingestion row for the same message in the same organisation.
create unique index if not exists email_ingests_graph_message_uidx
  on email_ingests (org_id, graph_message_id)
  where source = 'microsoft_graph' and graph_message_id is not null;
create index if not exists email_ingests_source_status_idx
  on email_ingests (source, status, created_at);

-- Keep confidence compatible with documents.confidence and reject taxonomy drift.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_ingests_classification_confidence_check'
  ) then
    alter table email_ingests add constraint email_ingests_classification_confidence_check
      check (classification_confidence is null or classification_confidence between 0 and 100);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'email_ingests_classification_check'
  ) then
    alter table email_ingests add constraint email_ingests_classification_check
      check (
        classification is null or classification in (
          'customer_order', 'supplier_invoice', 'supplier_statement', 'quote',
          'delivery_note', 'credit_note', 'general_correspondence', 'unknown'
        )
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'email_ingests_classification_source_check'
  ) then
    alter table email_ingests add constraint email_ingests_classification_source_check
      check (
        classification_primary_source is null or classification_primary_source in (
          'attachment', 'email_body', 'combined', 'none'
        )
      );
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'email_ingests_graph_id_type_check'
  ) then
    alter table email_ingests add constraint email_ingests_graph_id_type_check
      check (graph_id_type in ('rest_id', 'rest_immutable_entry_id'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'email_ingests_classification_evidence_array_check'
  ) then
    alter table email_ingests add constraint email_ingests_classification_evidence_array_check
      check (jsonb_typeof(classification_evidence) = 'array');
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'email_ingests_attachment_diagnostics_array_check'
  ) then
    alter table email_ingests add constraint email_ingests_attachment_diagnostics_array_check
      check (jsonb_typeof(attachment_diagnostics) = 'array');
  end if;
end $$;

create or replace function set_email_ingests_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists email_ingests_updated_at_trigger on email_ingests;
create trigger email_ingests_updated_at_trigger
  before update on email_ingests
  for each row execute function set_email_ingests_updated_at();

-- A document keeps its original filename in documents.filename and its MIME type
-- both here and on the private Storage object. Message/sender/received provenance is
-- reached through documents.email_ingest_id -> email_ingests.
alter table documents add column if not exists source_attachment_id text;
alter table documents add column if not exists source_content_type text;
alter table documents add column if not exists source_type text;
create unique index if not exists documents_ingest_attachment_uidx
  on documents (email_ingest_id, source_attachment_id)
  where email_ingest_id is not null and source_attachment_id is not null;

-- ==========================================================================
-- Re-resolution + controlled supersede.
--
-- BUSINESS IDENTITY IS NOT THE PROVIDER LOCATOR. A REST id encodes the folder a
-- message is in, so an external actor moving processed mail to Deleted Items
-- kills it — which is what happened to every historical ingest. graph_message_id
-- is therefore FROZEN (it stays the idempotency key and the record of the id the
-- notification carried), graph_message_id_resolved carries the current locator,
-- and internet_message_id carries the RFC identity that survives a folder move.
-- ==========================================================================
alter table email_ingests add column if not exists internet_message_id text;
alter table email_ingests add column if not exists graph_message_id_resolved text;
-- Append-only audit of every controlled reprocess. Capped at 50 entries by the
-- writer; never contains a body, a subject in clear, a token or a secret.
alter table email_ingests add column if not exists reprocess_log jsonb not null default '[]'::jsonb;
-- The single in-flight reprocess intent. Cleared when the worker consumes it.
alter table email_ingests add column if not exists pending_reprocess jsonb;

-- The four — and only four — columns a reprocess may write on an OLD document.
-- Nothing is ever deleted or rewritten: a superseded document remains the honest
-- record of what Vyso read at the time, reachable by direct id.
alter table documents add column if not exists superseded_at timestamptz;
alter table documents add column if not exists superseded_by_document_id uuid references documents(id);
alter table documents add column if not exists supersedes_document_id uuid references documents(id);
alter table documents add column if not exists supersede_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'email_ingests_reprocess_log_array_check'
  ) then
    alter table email_ingests add constraint email_ingests_reprocess_log_array_check
      check (jsonb_typeof(reprocess_log) = 'array');
  end if;
end $$;

-- THE INDEX THAT MAKES THE SWAP ORDER MANDATORY.
--
-- Adding `superseded_at is null` narrows one-document-per-source to one ACTIVE
-- document per source. That is what lets a replacement exist at all — and it is
-- also why document-ingest.ts must mark the old row superseded IMMEDIATELY
-- BEFORE inserting the new one (and un-mark it if that insert fails): the two
-- rows can never both occupy the active slot, not even for an instant.
--
-- AN EXISTING DATABASE MUST BE MIGRATED BY HAND. `create unique index if not
-- exists` will NOT replace the older index of the same name, so the drop below
-- is what actually widens it. This block is run once, by hand, before deploy —
-- it is reproduced verbatim in the completion report.
drop index if exists documents_ingest_attachment_uidx;
create unique index if not exists documents_ingest_attachment_uidx
  on documents (email_ingest_id, source_attachment_id)
  where email_ingest_id is not null and source_attachment_id is not null and superseded_at is null;

-- The audit surfaces read a document's successor by id; this keeps the reverse
-- lookup ("what did this document replace") cheap on a table that is otherwise
-- only ever queried by ingest.
create index if not exists documents_supersedes_idx
  on documents (supersedes_document_id)
  where supersedes_document_id is not null;

-- 'html' is a first-class source: a procurement portal emails the purchase order
-- as a text/html file attachment (the Four Seasons PO — twelve tables, a full
-- line grid — arrives exactly this way), and Vyso now parses it locally instead
-- of discarding it. NULL stays reserved for historical/unknown sources.
--
-- AN EXISTING DATABASE IS NOT WIDENED BY THIS BLOCK — it is guarded on the
-- constraint's absence, so where the old four-value check already exists it is
-- left alone and an 'html' insert fails with 23514. The drop-and-recreate is
-- run by hand before deploy; it is in the completion report and in
-- .ai/plan_email_source_usability.md (D6).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_source_type_check'
  ) then
    alter table documents add constraint documents_source_type_check
      check (source_type is null or source_type in ('pdf', 'image', 'spreadsheet', 'email_body', 'html'));
  end if;
end $$;
