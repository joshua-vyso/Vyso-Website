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
create unique index if not exists documents_ingest_attachment_uidx
  on documents (email_ingest_id, source_attachment_id)
  where email_ingest_id is not null and source_attachment_id is not null;
