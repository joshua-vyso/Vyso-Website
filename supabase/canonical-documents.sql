-- ============================================================================
-- REFERENCE ONLY — these tables already exist in production (created via
-- dashboard); do not paste. Reconstructed 2026-09-01 from Vyso Platform/
-- supabase/schema.sql + the ALTER statements across this directory.
-- ----------------------------------------------------------------------------
-- WHY THIS FILE EXISTS
--   `supabase/verify-rls-state.sql` names 11 tenant-carrying tables that have no
--   DDL in this repo — they were created by hand in the Supabase dashboard, and
--   everything since has arrived as loose `alter table … add column if not
--   exists` in whichever migration file needed it. The result is that no single
--   place in source control says what these tables ARE. This file is that place.
--
--   It is documentation, not a migration. Running it against production would at
--   best be a no-op (`if not exists` everywhere) and at worst would re-create a
--   policy or constraint whose live form differs from what is reconstructed
--   here. Every statement is written idempotently anyway, because a reference
--   that could not survive being run is a reference nobody trusts — but the rule
--   stands: DO NOT PASTE THIS. To change the live schema, write a new, narrow
--   migration file next to the others and paste that.
--
-- THE 11 TABLES
--   profiles · organisations · org_features · documents · document_folders ·
--   suppliers · pp_stock_items · pp_movements · pp_item_suppliers ·
--   pp_notifications · pp_settings
--
-- SOURCES RECONCILED (2026-09-01)
--   ../../Vyso Platform/supabase/schema.sql   base CREATE TABLE, RLS, functions,
--                                             triggers, storage bucket policies
--   docu-review-columns.sql                   documents review/lifecycle columns
--   microsoft-graph-ingest.sql                documents source_* + supersede columns
--   email-ingest.sql                          documents.email_ingest_id
--   docu-credit-document-types.sql            documents_document_type_check (10 + null)
--   core-data.sql                             documents entity/customer link;
--                                             pp_stock_items Core Data columns
--   of-order-source-doc.sql                   of_orders → documents FK (inbound only)
--   demo-all-in-one.sql §1.12/§1.12b          documents review columns (copy) +
--                                             documents_status_check rebuild
--   org-locked-modules.sql, morco-users-roles.sql   organisations.locked_modules
--   onboarding.sql                            organisations onboarding/trial columns
--   vyso-bootstrap.sql, enable-orderflow-pricepilot.sql, demo-fresh-valley/
--     0-bootstrap.sql                         org_features_feature_key_check
--   dedup-unique-indexes.sql                  case-insensitive name unique indexes
--   performance-indexes.sql                   query-shape indexes
--   add-kg-per-unit.sql, import-fields.sql    pp_stock_items numeric columns
--   pp-movement-order-id.sql                  pp_movements.order_id
--   add-custom-units.sql                      pp_settings.custom_units
--   realtime.sql                              publication membership (noted inline)
--   lib/platform/types.ts                     DocumentType / DocumentStatus /
--                                             FeatureKey value lists
--
-- TWO RLS IDIOMS LIVE IN THIS CODEBASE, AND THIS FILE SHOWS THE OLDER ONE.
--   `schema.sql` (the Vyso Platform project) routes every tenant check through
--   the SECURITY DEFINER helpers `public.current_org_id()` and
--   `public.org_has_feature(text)`. The policies below reproduce what schema.sql
--   declares, because that is the only source-controlled statement of these
--   tables' RLS.
--
--   The Website side does NOT use those helpers — not once, in any of the ~65
--   .sql files here. Its convention, in 37 files, is the inline subquery:
--
--       org_id = (select p.org_id from profiles p where p.id = auth.uid())
--
--   THAT INLINE FORM IS THE CONVENTION FOR NEW TABLES. Match it in new
--   migrations rather than the helper form below: a policy that calls a function
--   which may not exist in this project's database fails closed at query time,
--   and "fails closed" on a SELECT policy means an empty page nobody can debug
--   from the error text. See `email-ingest.sql` or `role-enforcement.sql` for the
--   house form, including the owner/admin role gate.
--
-- HOW TO CHECK ANY `-- VERIFY` BELOW
--   Run `supabase/verify-rls-state.sql` (read-only) for RLS + policy state, and
--   for column/constraint detail:
--       select column_name, data_type, is_nullable, column_default
--         from information_schema.columns
--        where table_schema = 'public' and table_name = 'documents'
--        order by ordinal_position;
--       select conname, pg_get_constraintdef(oid)
--         from pg_constraint where conrelid = 'public.documents'::regclass;
-- ============================================================================

create extension if not exists "pgcrypto";


-- ############################################################################
-- ## 0 — Helper functions and triggers referenced by the policies below
-- ############################################################################

-- The calling user's org_id. SECURITY DEFINER so it bypasses RLS internally and
-- never recurses through the profiles SELECT policy — a plain function here
-- would make `profiles_select` depend on reading `profiles`.
--
-- VERIFY: whether this function exists at all in the database the Website points
-- at (NEXT_PUBLIC_SUPABASE_URL). It is declared only in the Vyso Platform
-- project's schema.sql; no Website migration creates or calls it. If it is
-- absent, the policies in this file are NOT what is live.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid()
$$;

-- Does the caller's org have a given feature enabled?
-- VERIFY: same as above — existence unconfirmed on the Website's database. Also
-- note that modules are no longer pay-gated (see unlock-all-modules.sql), so a
-- feature conjunct in a live policy may since have been dropped.
create or replace function public.org_has_feature(feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.org_features f
    where f.org_id = public.current_org_id()
      and f.feature_key = feature
      and f.enabled = true
  )
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tenant-isolation guard for profiles. The self-update policy lets a user edit
-- their OWN row, but RLS alone cannot stop them setting org_id to another org or
-- escalating role — both are plain column writes on a row they legitimately own.
-- This pins org_id + role to their previous values for authenticated (end-user)
-- writes; service-role writes (onboarding/admin) pass through untouched.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    new.org_id := old.org_id;
    new.role := old.role;
  end if;
  return new;
end;
$$;


-- ############################################################################
-- ## 1 — organisations
-- ############################################################################

create table if not exists public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  location    text,
  tier        text default 'start'
                constraint organisations_tier_check check (tier in ('start', 'build', 'scale')),
  created_at  timestamptz default now(),

  -- ── org-locked-modules.sql / morco-users-roles.sql ────────────────────────
  -- Dormant kill-switch plumbing. Data-driven, so empty = nothing locked, which
  -- is the state every org is in since unlock-all-modules.sql cleared it and
  -- changed the onboarding RPCs to always write '{}'. Kept for abuse/offboarding.
  locked_modules text[] not null default '{}',

  -- ── onboarding.sql: signup + trial columns ────────────────────────────────
  industry                 text,
  -- Band: '1-5' | '6-20' | '21-50' | '51-200' | '200+'.
  -- VERIFY: no CHECK constraint is declared for this in any source file; the
  -- band list lives only in a comment and in the signup UI. Confirm whether the
  -- live column is genuinely unconstrained before relying on the values.
  employee_count           text,
  trial_started_at         timestamptz,
  trial_ends_at            timestamptz,
  -- 'profile' | 'modules' | 'data' | 'done'. Pre-existing orgs backfilled to
  -- 'done' by onboarding.sql. VERIFY: likewise unconstrained as far as the
  -- sources show.
  onboarding_stage         text not null default 'profile',
  onboarding_completed_at  timestamptz
);

alter table public.organisations enable row level security;

-- Members can read their own org.
drop policy if exists org_select on public.organisations;
create policy org_select on public.organisations
  for select using (id = public.current_org_id());


-- ############################################################################
-- ## 2 — org_features
-- ############################################################################

create table if not exists public.org_features (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.organisations(id) on delete cascade,
  feature_key  text not null,
  enabled      boolean default true,
  created_at   timestamptz default now(),
  unique (org_id, feature_key)
);

-- The nine keys are exactly FEATURE_KEYS in lib/platform/types.ts. Four separate
-- files (onboarding.sql, vyso-bootstrap.sql, enable-orderflow-pricepilot.sql,
-- demo-fresh-valley/0-bootstrap.sql, demo-all-in-one.sql §0) each drop and re-add
-- this constraint over the same nine values, because older databases carry a
-- narrower version that rejects some of them and a seed that trips it fails 23514.
-- The sets agree across all five sources; only the literal ordering differs.
alter table public.org_features drop constraint if exists org_features_feature_key_check;
alter table public.org_features add constraint org_features_feature_key_check
  check (feature_key in (
    'docu', 'procurepulse', 'pricepilot', 'marginview', 'wastelog',
    'shiftboard', 'orderflow', 'reportgen', 'suppliers'
  ));

create index if not exists org_features_org_idx        on public.org_features (org_id);
create index if not exists idx_org_features_org_feature on public.org_features (org_id, feature_key);

alter table public.org_features enable row level security;

-- Members can read their own org's entitlements.
drop policy if exists org_features_select on public.org_features;
create policy org_features_select on public.org_features
  for select using (org_id = public.current_org_id());


-- ############################################################################
-- ## 3 — profiles
-- ############################################################################

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references public.organisations(id),
  full_name   text,
  role        text default 'member'
                constraint profiles_role_check check (role in ('owner', 'admin', 'member')),
  avatar_url  text,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;

-- Readable by members of the same org; a user may upsert their own row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (org_id = public.current_org_id());

drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- The trigger, not the policy, is what stops org_id/role self-escalation. See §0.
drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();


-- ############################################################################
-- ## 4 — suppliers
-- ############################################################################

create table if not exists public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid references public.organisations(id) on delete cascade,
  name           text not null,
  initials       text,
  location       text,
  contact_email  text,
  created_at     timestamptz default now()
);

create index if not exists suppliers_org_idx on public.suppliers (org_id);

-- dedup-unique-indexes.sql PHASE 3. App-level dedup (select-by-name then insert)
-- loses the race between two concurrent uploads; this makes the invariant hold in
-- the database. Case-insensitive because the app looks names up with ilike, and
-- partial on non-blank names so a junk row cannot block creation.
create unique index if not exists suppliers_org_lower_name_uidx
  on public.suppliers (org_id, lower(name))
  where name is not null and btrim(name) <> '';

alter table public.suppliers enable row level security;

drop policy if exists suppliers_all on public.suppliers;
create policy suppliers_all on public.suppliers
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ############################################################################
-- ## 5 — documents
-- ##
-- ## The union of the schema.sql base table and every `alter table documents`
-- ## across this directory. Grouped by the migration that introduced each block,
-- ## because the columns are only intelligible next to the feature that added
-- ## them.
-- ############################################################################

create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  -- VERIFY: nullable in schema.sql, whereas every pp_* table below declares
  -- `org_id ... not null`. On a tenant-carrying table a NULL org_id is a row no
  -- org-scoped policy matches — invisible, undeletable through the app. Confirm
  -- the live nullability; if it is nullable, it is worth tightening.
  org_id          uuid references public.organisations(id) on delete cascade,
  supplier_id     uuid references public.suppliers(id) on delete set null,
  filename        text not null,
  document_type   text,   -- constraint below (rebuilt dynamically; see §5a)
  status          text default 'pending',   -- constraint below (see §5b)
  starred         boolean not null default false,
  -- VERIFY: precision (5,2) comes from schema.sql only. The Website never
  -- declared this column, and confidence is written as a 0–100 integer-ish score.
  confidence      numeric(5,2),
  extracted_data  jsonb,
  storage_path    text,
  uploaded_by     uuid references public.profiles(id) on delete set null,

  -- ── docu-review-columns.sql (also copied into demo-all-in-one.sql §1.12) ──
  -- The review-queue claim/lock: a Save stamps approved_at while the row is still
  -- 'extracted' to claim it, then flips status to 'approved'. These shipped as
  -- CODE with no migration, which is what made every review load fail 42703 and
  -- render "Nothing to review" instead of an error.
  approved_by     uuid references public.profiles(id) on delete set null,
  approved_at     timestamptz,
  -- Discard: status → 'rejected', stamped with who/when.
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  -- Archive action (soft-hide from the active lists).
  archived_at     timestamptz,
  -- Cached AI operational summary (typed as AiSummary in lib/platform/docu/types).
  ai_summary      jsonb,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── schema.sql: documents → folder ──────────────────────────────────────────
-- Declared as an ALTER rather than inline because document_folders (§6) must
-- exist first. Reproduced in the same shape here.
alter table public.documents
  add column if not exists folder_id uuid references public.document_folders(id) on delete set null;

-- ── email-ingest.sql: trace a filed document back to the email it arrived on ─
-- FK target `email_ingests` is NOT one of the 11 tables — it is created by
-- email-ingest.sql, which must therefore have run first.
alter table public.documents
  add column if not exists email_ingest_id uuid references public.email_ingests(id) on delete set null;

-- ── microsoft-graph-ingest.sql: provider provenance ─────────────────────────
-- A document keeps its original filename in documents.filename and its MIME type
-- both here and on the private Storage object. Message/sender/received provenance
-- is reached through email_ingest_id → email_ingests.
alter table public.documents add column if not exists source_attachment_id text;
alter table public.documents add column if not exists source_content_type  text;
alter table public.documents add column if not exists source_type          text;

-- ── microsoft-graph-ingest.sql: controlled supersede ────────────────────────
-- The four — and only four — columns a reprocess may write on an OLD document.
-- Nothing is deleted or rewritten: a superseded document remains the honest
-- record of what Vyso read at the time, reachable by direct id.
alter table public.documents add column if not exists superseded_at             timestamptz;
alter table public.documents add column if not exists superseded_by_document_id uuid references public.documents(id);
alter table public.documents add column if not exists supersedes_document_id    uuid references public.documents(id);
alter table public.documents add column if not exists supersede_reason          text;

-- ── core-data.sql §18: attach documents to OrderFlow entities and customers ─
alter table public.documents add column if not exists entity_type text;
alter table public.documents add column if not exists entity_id   uuid;
-- FK target `of_customers` is NOT one of the 11 tables (created by core-data.sql).
alter table public.documents
  add column if not exists customer_id uuid references public.of_customers(id) on delete set null;
-- VERIFY: entity_type carries no CHECK in any source file, so the set of legal
-- entity kinds exists only in the calling code.


-- ── §5a  documents_document_type_check — 10 types, NULL allowed ─────────────
-- Authority: lib/platform/types.ts `DocumentType` (10 members) +
-- docu-credit-document-types.sql, which widened the live constraint from the six
-- values a production probe accepted to these ten. schema.sql's base table lists
-- only FIVE ('invoice','statement','delivery_note','price_list','order') — that
-- is the older Vyso Platform project and is SUPERSEDED here.
--
-- Why NULL is allowed: a freshly inserted document has no type until the
-- classifier has run, so forbidding NULL breaks the upload path itself. Three
-- live rows hold NULL.
--
-- Why the live migration builds the list dynamically rather than writing it out:
-- the database also holds non-demo orgs whose rows may carry a document_type this
-- repo cannot predict, and a plain ADD CONSTRAINT would fail 23514 on rows nobody
-- asked to touch. It therefore adds `union (distinct document_type already in the
-- table)`. The literal form below is the KNOWN ten; the live list may be a
-- superset.
--
-- VERIFY: the live constraint NAME. docu-credit-document-types.sql drops "every
-- CHECK on documents whose definition mentions document_type and has enum shape"
-- precisely because the original dashboard-created name is not knowable from this
-- repo. It may not be `documents_document_type_check`.
alter table public.documents drop constraint if exists documents_document_type_check;
alter table public.documents add constraint documents_document_type_check
  check (document_type is null or document_type in (
    'invoice',
    'statement',
    'delivery_note',
    'price_list',
    'order',
    -- A till slip: consumption the business PAID FOR, as opposed to stock it
    -- bought to sell on. Filed as 'invoice' it became a supplier bill — the
    -- restaurant became a suppliers row and its meal lines became stock.
    'expense_receipt',
    -- The three credit papers. One word printed on three documents that point in
    -- different directions: a supplier crediting us, a customer ASKING for a
    -- credit (a claim, not an obligation), and a credit we have issued. None
    -- posts anything; filed as 'invoice' a credit joins spend rollups as a
    -- POSITIVE number and inflates the figure it exists to reduce.
    'supplier_credit_note',
    'customer_credit_request',
    'customer_credit_note',
    -- Proof that a payment ALREADY RECORDED happened (EFT confirmation, bank pop,
    -- remittance). NOT an expense_receipt: that one RECOGNISES an expense by
    -- existing, this one is paperwork behind a figure already on the books.
    'payment_proof'
  ));


-- ── §5b  documents_status_check — the 7 DocumentStatus values ───────────────
-- Authority: lib/platform/types.ts `DocumentStatus` + demo-all-in-one.sql §1.12b,
-- which widened the live constraint after the review columns shipped without it.
-- The stale live list rejected 'approved'/'rejected'/'archived', which broke
-- Doc-U's own Save, Discard and Archive buttons — not just seeded demo rows.
--
-- Same two caveats as §5a: the live migration UNIONs in any status already
-- present in the table (so the live list may be a superset), and it drops the
-- prior constraint by SHAPE because its name is unknown.
--
-- Note the live rebuild emits `check (status in (...))` with no `is null or`
-- guard. A CHECK is satisfied by NULL (unknown, not false), and the column is
-- nullable with a default of 'pending' — so NULL status is permitted in practice.
alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents add constraint documents_status_check
  check (status in (
    'pending', 'extracted', 'reviewed', 'error', 'approved', 'rejected', 'archived'
  ));


-- ── §5c  documents_source_type_check ────────────────────────────────────────
-- 'html' is a first-class source: a procurement portal emails the purchase order
-- as a text/html attachment, and Vyso parses it locally instead of discarding it.
-- NULL stays reserved for historical/unknown sources.
--
-- VERIFY: microsoft-graph-ingest.sql adds this ONLY if no constraint of the name
-- exists, so a database carrying the older four-value version is NOT widened by
-- it and an 'html' insert there fails 23514. The drop-and-recreate is a manual
-- pre-deploy step. Confirm which of the two forms is live.
alter table public.documents drop constraint if exists documents_source_type_check;
alter table public.documents add constraint documents_source_type_check
  check (source_type is null or source_type in
    ('pdf', 'image', 'spreadsheet', 'email_body', 'html'));


-- ── §5d  documents indexes ──────────────────────────────────────────────────
-- schema.sql
create index if not exists documents_org_idx      on public.documents (org_id);
create index if not exists documents_supplier_idx on public.documents (supplier_id);
create index if not exists documents_folder_idx   on public.documents (folder_id);
-- email-ingest.sql / core-data.sql
create index if not exists documents_email_ingest_idx on public.documents (email_ingest_id);
create index if not exists idx_documents_entity       on public.documents (entity_type, entity_id);
create index if not exists idx_documents_customer     on public.documents (customer_id);
-- performance-indexes.sql — the two list query shapes (inbox, review queue).
create index if not exists idx_documents_org_created        on public.documents (org_id, created_at desc);
create index if not exists idx_documents_org_status_created on public.documents (org_id, status, created_at desc);
-- NOTE: performance-indexes.sql also creates idx_documents_supplier_id and
-- idx_documents_folder_id, which duplicate documents_supplier_idx and
-- documents_folder_idx above under different names. Both pairs are presumed live;
-- they are redundant write cost, not a correctness problem. Listed for fidelity:
create index if not exists idx_documents_supplier_id on public.documents (supplier_id);
create index if not exists idx_documents_folder_id   on public.documents (folder_id);

-- THE INDEX THAT MAKES THE SUPERSEDE SWAP ORDER MANDATORY.
-- `superseded_at is null` narrows one-document-per-source to one ACTIVE document
-- per source. That is what lets a replacement exist at all — and why
-- document-ingest.ts must mark the old row superseded IMMEDIATELY BEFORE
-- inserting the new one (and un-mark it if that insert fails): the two rows can
-- never both occupy the active slot, not even for an instant.
--
-- VERIFY: `create unique index if not exists` will NOT replace an older index of
-- the same name, so a database created before the supersede work may still carry
-- the two-column form without the `superseded_at is null` predicate. The drop is
-- a manual pre-deploy step.
drop index if exists documents_ingest_attachment_uidx;
create unique index if not exists documents_ingest_attachment_uidx
  on public.documents (email_ingest_id, source_attachment_id)
  where email_ingest_id is not null
    and source_attachment_id is not null
    and superseded_at is null;

-- Reverse lookup ("what did this document replace") on a table otherwise only
-- queried by ingest.
create index if not exists documents_supersedes_idx
  on public.documents (supersedes_document_id)
  where supersedes_document_id is not null;


-- ── §5e  documents trigger + RLS ────────────────────────────────────────────
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

-- Full CRUD scoped to the caller's org AND requires the docu feature.
--
-- VERIFY: the feature conjunct. Modules are no longer pay-gated
-- (unlock-all-modules.sql, 2026-08-24) and every org now has all nine
-- org_features rows enabled, so this conjunct is presumed inert — but if the live
-- policy still carries it AND an org is missing its 'docu' row, that org sees an
-- empty Doc-U rather than an error. Confirm against verify-rls-state.sql output.
drop policy if exists documents_all on public.documents;
create policy documents_all on public.documents
  for all using (
    org_id = public.current_org_id() and public.org_has_feature('docu')
  ) with check (
    org_id = public.current_org_id() and public.org_has_feature('docu')
  );

-- realtime.sql adds `documents` to the `supabase_realtime` publication (the Doc-U
-- list and the review queue subscribe to it). Realtime ENFORCES RLS, so the
-- browser only receives change events for rows the signed-in user could SELECT —
-- it fails closed: a missing SELECT policy means no events, never a cross-tenant
-- leak. Publication membership is not DDL on the table and is not reproduced here.


-- ############################################################################
-- ## 6 — document_folders
-- ############################################################################

create table if not exists public.document_folders (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organisations(id) on delete cascade,
  name        text not null,
  starred     boolean not null default false,
  color       text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now()
);

-- dedup-unique-indexes.sql PHASE 3. Folders are flat and only documents.folder_id
-- references them, so PHASE 2 could auto-merge the duplicates (including the ones
-- the old PublishOrderButton .maybeSingle() bug left behind) before this landed.
create unique index if not exists document_folders_org_lower_name_uidx
  on public.document_folders (org_id, lower(name))
  where name is not null and btrim(name) <> '';

alter table public.document_folders enable row level security;

drop policy if exists document_folders_all on public.document_folders;
create policy document_folders_all on public.document_folders
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());


-- ############################################################################
-- ## 7 — pp_stock_items
-- ############################################################################

create table if not exists public.pp_stock_items (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id) on delete cascade,
  name                text not null,
  category            text,
  pack                text,
  unit                text not null default 'boxes',
  on_hand             numeric not null default 0,
  low_threshold       numeric not null default 0,
  avg_unit_price      numeric,
  currency            text not null default 'ZAR',
  trend_pct           numeric,
  cheapest_supplier   text,
  source_document_id  uuid references public.documents(id) on delete set null,
  stock_history       jsonb,
  price_history       jsonb,
  updated_at          timestamptz default now(),
  created_at          timestamptz default now(),
  -- Case-SENSITIVE. Coexists with the case-insensitive partial index below; they
  -- are different constraints and both are presumed live.
  unique (org_id, name)
);

-- ── core-data.sql §4: Core Data product fields ──────────────────────────────
alter table public.pp_stock_items add column if not exists subcategory text;
alter table public.pp_stock_items add column if not exists sku         text;
-- null = org default VAT rate applies
alter table public.pp_stock_items add column if not exists vat_rate    numeric;
alter table public.pp_stock_items add column if not exists active      boolean not null default true;
-- product | service. VERIFY: no CHECK in any source file.
alter table public.pp_stock_items add column if not exists kind        text not null default 'product';
alter table public.pp_stock_items add column if not exists notes       text;

-- ── import-fields.sql: purchase cost (QuickBooks "Price" maps to avg_unit_price)
alter table public.pp_stock_items add column if not exists cost numeric;

-- ── add-kg-per-unit.sql ─────────────────────────────────────────────────────
-- Weighted average kilograms per counting unit, derived by the Doc-U feed as
-- Σ(qty·weight) / Σ(qty). "Stock on hand (kg)" is DERIVED on read as
-- on_hand × kg_per_unit, never stored, so it cannot drift as units sell down.
alter table public.pp_stock_items add column if not exists kg_per_unit numeric;

create index if not exists pp_stock_items_org_idx on public.pp_stock_items (org_id);
-- performance-indexes.sql duplicates the above under another name; listed for fidelity.
create index if not exists idx_pp_stock_items_org_id on public.pp_stock_items (org_id);
-- dedup-unique-indexes.sql PHASE 3. Global across statuses on purpose: an
-- archived product (active = false) still reserves its name, so re-adding it
-- restores the existing row rather than minting a second one.
create unique index if not exists pp_stock_items_org_lower_name_uidx
  on public.pp_stock_items (org_id, lower(name))
  where name is not null and btrim(name) <> '';

drop trigger if exists pp_stock_items_set_updated_at on public.pp_stock_items;
create trigger pp_stock_items_set_updated_at
  before update on public.pp_stock_items
  for each row execute function public.set_updated_at();

alter table public.pp_stock_items enable row level security;

drop policy if exists pp_stock_items_all on public.pp_stock_items;
create policy pp_stock_items_all on public.pp_stock_items
  for all using (org_id = public.current_org_id() and public.org_has_feature('procurepulse'))
  with check (org_id = public.current_org_id() and public.org_has_feature('procurepulse'));


-- ############################################################################
-- ## 8 — pp_item_suppliers
-- ############################################################################

create table if not exists public.pp_item_suppliers (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organisations(id) on delete cascade,
  stock_item_id  uuid not null references public.pp_stock_items(id) on delete cascade,
  -- A free-text supplier NAME, not a suppliers(id) FK. Reproduced as declared.
  supplier_name  text not null,
  price          numeric not null,
  created_at     timestamptz default now()
);

create index if not exists pp_item_suppliers_item_idx on public.pp_item_suppliers (stock_item_id);
create index if not exists pp_item_suppliers_org_idx  on public.pp_item_suppliers (org_id);
-- performance-indexes.sql duplicates the item index under another name.
create index if not exists idx_pp_item_suppliers_stock_item_id on public.pp_item_suppliers (stock_item_id);

alter table public.pp_item_suppliers enable row level security;

drop policy if exists pp_item_suppliers_all on public.pp_item_suppliers;
create policy pp_item_suppliers_all on public.pp_item_suppliers
  for all using (org_id = public.current_org_id() and public.org_has_feature('procurepulse'))
  with check (org_id = public.current_org_id() and public.org_has_feature('procurepulse'));


-- ############################################################################
-- ## 9 — pp_movements  (the append-only stock ledger)
-- ############################################################################

create table if not exists public.pp_movements (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id) on delete cascade,
  stock_item_id       uuid not null references public.pp_stock_items(id) on delete cascade,
  change              numeric not null,
  -- A MovementReason (lib/platform/types.ts) for new rows; legacy rows may carry
  -- 'received'/'adjustment'. VERIFY: no CHECK in any source file, deliberately —
  -- constraining it would reject the legacy vocabulary already in the table.
  reason              text,
  source_label        text,
  source_document_id  uuid references public.documents(id) on delete set null,
  occurred_at         timestamptz default now(),
  created_at          timestamptz default now()
);

-- ── pp-movement-order-id.sql ────────────────────────────────────────────────
-- The OrderFlow order that caused this movement (a sale). source_document_id
-- cannot be reused — it is FK'd to documents — hence a dedicated column. Enables
-- order-keyed idempotency and restocking when an order is deleted.
-- Intentionally NOT declared as a FK to of_orders in the source migration.
alter table public.pp_movements add column if not exists order_id uuid;

create index if not exists pp_movements_item_idx      on public.pp_movements (stock_item_id);
create index if not exists pp_movements_org_idx       on public.pp_movements (org_id);
create index if not exists idx_pp_movements_order_id  on public.pp_movements (order_id);
-- performance-indexes.sql
create index if not exists idx_pp_movements_source_document_id on public.pp_movements (source_document_id);
create index if not exists idx_pp_movements_stock_item_id      on public.pp_movements (stock_item_id);

alter table public.pp_movements enable row level security;

drop policy if exists pp_movements_all on public.pp_movements;
create policy pp_movements_all on public.pp_movements
  for all using (org_id = public.current_org_id() and public.org_has_feature('procurepulse'))
  with check (org_id = public.current_org_id() and public.org_has_feature('procurepulse'));


-- ############################################################################
-- ## 10 — pp_notifications
-- ############################################################################

create table if not exists public.pp_notifications (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organisations(id) on delete cascade,
  -- Matches PpNotificationKind in lib/platform/types.ts exactly.
  kind           text not null
                   constraint pp_notifications_kind_check check (kind in
                     ('low_stock', 'new_direct_doc', 'new_market_statement',
                      'price_change', 'reorder')),
  title          text not null,
  body           text,
  stock_item_id  uuid references public.pp_stock_items(id) on delete set null,
  document_id    uuid references public.documents(id) on delete set null,
  read           boolean not null default false,
  created_at     timestamptz default now()
);

create index if not exists pp_notifications_org_idx on public.pp_notifications (org_id);

alter table public.pp_notifications enable row level security;

drop policy if exists pp_notifications_all on public.pp_notifications;
create policy pp_notifications_all on public.pp_notifications
  for all using (org_id = public.current_org_id() and public.org_has_feature('procurepulse'))
  with check (org_id = public.current_org_id() and public.org_has_feature('procurepulse'));


-- ############################################################################
-- ## 11 — pp_settings  (one row per org; org_id IS the primary key)
-- ############################################################################

create table if not exists public.pp_settings (
  org_id                    uuid primary key references public.organisations(id) on delete cascade,
  notify_low_stock          boolean not null default true,
  notify_direct_docs        boolean not null default true,
  notify_market_statements  boolean not null default true,
  notify_price_spikes       boolean not null default true,
  weekly_summary            boolean not null default false,
  default_supplier          text,
  quiet_hours               text,
  updated_at                timestamptz default now()
);

-- ── add-custom-units.sql ────────────────────────────────────────────────────
-- Org-defined units of measurement on top of the built-ins. Backs the "Units of
-- measurement" section in ProcurePulse → Settings and the typeable unit dropdown.
-- Note this is `default '{}'` WITHOUT `not null` (unlike organisations.locked_modules),
-- so it is genuinely nullable — which is why PpSettings types it `string[] | null`.
alter table public.pp_settings add column if not exists custom_units text[] default '{}';

alter table public.pp_settings enable row level security;

drop policy if exists pp_settings_all on public.pp_settings;
create policy pp_settings_all on public.pp_settings
  for all using (org_id = public.current_org_id() and public.org_has_feature('procurepulse'))
  with check (org_id = public.current_org_id() and public.org_has_feature('procurepulse'));


-- ############################################################################
-- ## 12 — Storage: the private 'documents' bucket
-- ##
-- ## Objects are pathed {org_id}/{filename}, and the FIRST PATH SEGMENT is the
-- ## whole tenant boundary — there is no per-object owner column to fall back
-- ## on. A policy that omitted the foldername check would expose every org's
-- ## files to every signed-in user, so all four verbs carry it.
-- ############################################################################

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_storage_select on storage.objects;
create policy documents_storage_select on storage.objects
  for select using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects
  for update using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

-- VERIFY: these four storage policies are declared only in the Vyso Platform
-- project's schema.sql. No Website migration creates them, and they depend on
-- current_org_id() (see §0). Confirm what actually guards the bucket in the
-- database the Website points at:
--     select polname, pg_get_expr(polqual, polrelid)
--       from pg_policy where polrelid = 'storage.objects'::regclass;


-- ============================================================================
-- END. Reference only — see the header. New tenant tables should use the inline
-- RLS idiom (`org_id = (select p.org_id from profiles p where p.id = auth.uid())`),
-- not the current_org_id() helper reproduced above.
-- ============================================================================
