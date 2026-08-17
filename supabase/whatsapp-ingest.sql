-- ============================================================================
-- WhatsApp ordering — customers message the org's WhatsApp Business number the
-- way they always have, and Vyso turns it into an OrderFlow order.
-- ----------------------------------------------------------------------------
-- Message path: Meta Cloud API POSTs a signed webhook to /api/whatsapp/inbound.
-- The org is resolved from the WABA `phone_number_id` in the payload metadata —
-- the number the message ARRIVED AT, which the sender cannot choose. Nothing in
-- the message body ever selects an org.
--
-- Four moving parts:
--   whatsapp_connections — phone_number_id → org. The ONLY routing key.
--   whatsapp_senders     — wa_id → of_customers. Who is allowed to order, and
--                          as whom. Unknown numbers are quarantined for one-click
--                          approval rather than silently becoming orders.
--   whatsapp_ingests     — idempotency key + queue + confirm-loop state machine
--                          + audit log. Meta RETRIES webhooks, so the unique
--                          (org_id, wa_message_id) index is what stops a retry
--                          double-ordering.
--   documents.whatsapp_ingest_id — traces a filed order back to the message.
--
-- WhatsApp differs from email in one important way: Meta authenticates the
-- sender's number for us. A wa_id cannot be spoofed the way a From: header can,
-- so there is no SPF/DKIM equivalent to check here — the allowlist alone is a
-- real control. What we gain from that is IDENTITY: the sending number resolves
-- to an of_customers row, so orders are attributed by phone match rather than by
-- reading a name off the message.
--
-- Org-scoped RLS for reading in the app. The webhook has no logged-in user and
-- runs on the service-role key (bypassing RLS) — it always filters by the org
-- resolved from the connection.
-- Idempotent. Paste in the Supabase SQL editor.
-- ============================================================================


-- ── The org's WhatsApp number ───────────────────────────────────────────────
create table if not exists whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- Meta's id for the business number (payload: entry[].changes[].value.metadata
  -- .phone_number_id). This — not the display number — is the routing key.
  phone_number_id text not null,
  -- The WhatsApp Business Account the number belongs to. Recorded for support
  -- and token scoping; never used for routing.
  waba_id text,
  -- Human-readable, e.g. '+27 11 123 4567'. Display only.
  display_number text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- One org per business number, globally. A phone_number_id appearing twice would
-- make routing ambiguous, and "ambiguous" here means one tenant's orders can land
-- in another tenant's OrderFlow.
create unique index if not exists whatsapp_connections_phone_number_uidx
  on whatsapp_connections (phone_number_id);
create index if not exists whatsapp_connections_org_idx
  on whatsapp_connections (org_id) where active;


-- ── Who may order, and as whom ──────────────────────────────────────────────
create table if not exists whatsapp_senders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- Meta's sender id: digits, no '+', e.g. '27821234567'. Already normalised to
  -- E.164 by Meta, which is why this is the canonical form everywhere in the app.
  wa_id text not null,
  -- The customer this number orders for. NULL while pending — an unidentified
  -- number must never inherit a customer by guesswork.
  customer_id uuid references of_customers(id) on delete set null,
  -- The WhatsApp profile name, captured for the approval screen. It is the
  -- sender's own display name and therefore a CLAIM, not an identity.
  profile_name text,
  -- approved → orders are parsed | pending → quarantined, awaiting approval
  -- | blocked → dropped
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz
);
create unique index if not exists whatsapp_senders_org_wa_uidx
  on whatsapp_senders (org_id, wa_id);
create index if not exists whatsapp_senders_org_status_idx
  on whatsapp_senders (org_id, status);


-- ── Received messages: idempotency + queue + confirm state ──────────────────
create table if not exists whatsapp_ingests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  connection_id uuid references whatsapp_connections(id) on delete set null,
  -- Meta's message id (wamid.*). THE dedup key.
  wa_message_id text not null,
  from_wa_id text not null,
  profile_name text,
  -- text | image | document | audio | other
  kind text not null default 'text',
  body_text text,
  -- The raw webhook value, for support and replay. Contains customer PII — see
  -- the retention note at the bottom of this file.
  raw_payload jsonb,
  -- queued            → to process
  -- processing        → claimed by a worker
  -- awaiting_confirmation → parsed into a draft, customer asked to confirm
  -- done              → confirmed and committed to OrderFlow (or filed for review)
  -- cancelled         → the customer replied NO
  -- superseded        → a newer order message replaced this open draft
  -- expired           → the confirm card went unanswered (see /api/whatsapp/process)
  -- failed            → transient/unknown fault, retryable by the cron
  -- quarantined       → sender not approved
  -- ignored           → nothing orderable in the message (greeting, sticker, …)
  status text not null default 'queued',
  attempts int not null default 0,
  claimed_at timestamptz,
  -- The Doc-U document this message was filed as (the audit copy of the raw
  -- order text, or the photo the customer sent).
  document_id uuid references documents(id) on delete set null,
  -- The OrderFlow order created once the customer confirmed.
  order_id uuid references of_orders(id) on delete set null,
  -- The sender resolved to a customer at parse time. Held on the row so the
  -- eventual commit attributes the order to the same customer the confirm card
  -- was priced against, even if the mapping is edited in between.
  customer_id uuid references of_customers(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  confirmed_at timestamptz
);
-- THE idempotency guard: Meta retries webhooks (and redelivers on 5xx), so
-- without this a retry would parse and order the same message twice.
create unique index if not exists whatsapp_ingests_org_message_uidx
  on whatsapp_ingests (org_id, wa_message_id);
-- The worker drains by status.
create index if not exists whatsapp_ingests_status_idx
  on whatsapp_ingests (status, created_at);
-- AT MOST ONE open draft per sender, enforced by the database rather than by
-- application care. "YES" is only unambiguous if exactly one order is awaiting
-- confirmation: two open drafts and a one-word reply cannot say which it means.
-- The processor supersedes any existing open draft before opening a new one;
-- this index is what makes that a guarantee instead of a convention.
create unique index if not exists whatsapp_ingests_open_draft_uidx
  on whatsapp_ingests (org_id, from_wa_id) where status = 'awaiting_confirmation';
create index if not exists whatsapp_ingests_org_created_idx
  on whatsapp_ingests (org_id, created_at desc);


-- ── Trace each filed document back to the message it arrived on ─────────────
alter table documents
  add column if not exists whatsapp_ingest_id uuid references whatsapp_ingests(id) on delete set null;
create index if not exists documents_whatsapp_ingest_idx on documents (whatsapp_ingest_id);


-- ── Match an inbound number to a customer ───────────────────────────────────
-- of_customers.phone is free text entered by hand ('082 123 4567', '+27 82 …',
-- '0027 82 …'). The webhook normalises the stored value in application code and
-- compares digits, so this index is a plain lookup aid for the settings screens
-- rather than the matching mechanism itself.
create index if not exists of_customers_org_phone_idx on of_customers (org_id, phone);


-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table whatsapp_connections enable row level security;
alter table whatsapp_senders     enable row level security;
alter table whatsapp_ingests     enable row level security;

-- Everyone in the org can SEE their number / senders / received messages.
drop policy if exists whatsapp_connections_select on whatsapp_connections;
create policy whatsapp_connections_select on whatsapp_connections for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists whatsapp_senders_select on whatsapp_senders;
create policy whatsapp_senders_select on whatsapp_senders for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists whatsapp_ingests_select on whatsapp_ingests;
create policy whatsapp_ingests_select on whatsapp_ingests for select
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- Only owner/admin may connect a number or approve/block a sender — these are the
-- controls that decide whose messages become orders.
drop policy if exists whatsapp_connections_write on whatsapp_connections;
create policy whatsapp_connections_write on whatsapp_connections for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  );

drop policy if exists whatsapp_senders_write on whatsapp_senders;
create policy whatsapp_senders_write on whatsapp_senders for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and (select p.role from profiles p where p.id = auth.uid()) in ('owner', 'admin')
  );

-- NOTE: whatsapp_ingests has no user INSERT/UPDATE policy on purpose — only the
-- webhook/worker (service role) writes it.


-- ── Retention (POPIA) ───────────────────────────────────────────────────────
-- raw_payload holds customer message content and phone numbers. The org is the
-- responsible party and Vyso the operator, so raw payloads should not be kept
-- indefinitely. Run this periodically (or wire it to a cron) once the feature is
-- past its bedding-in period:
--
--   update whatsapp_ingests
--      set raw_payload = null
--    where created_at < now() - interval '90 days'
--      and raw_payload is not null;
--
-- The ingest row itself is kept: it is the idempotency guard, and dropping it
-- would let a very late Meta retry re-order an ancient message.
