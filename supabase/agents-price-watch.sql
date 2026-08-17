-- ============================================================================
-- Price Watch — the foundation tables for Vyso's operational agents.
-- ----------------------------------------------------------------------------
-- Price Watch is the first of Vyso's autonomous agents: it reads supplier
-- invoice/statement line items already extracted by Doc-U, normalises them
-- against a canonical buy-side item catalogue, keeps per-supplier price
-- history, and flags material price increases. It observes and recommends;
-- humans act.
--
--   pw_items          -- canonical BUY-side item catalogue ("Tomatoes, Roma")
--   pw_item_matches    -- raw Doc-U line description → pw_item review queue.
--                         Low-confidence matches land here instead of being
--                         silently guessed.
--   pw_price_points    -- per-supplier, per-item price history, one row per
--                         Doc-U line item, normalised to the item's base unit.
--
-- agent_findings is deliberately NOT prefixed pw_: it is SHARED by every
-- future agent (Price Watch today, others later), so it lives here as the
-- common findings sink rather than inside any one agent's namespace.
--
-- There is no relational line-item table to hang a foreign key off: Doc-U
-- stores extraction as documents.extracted_data jsonb, with a line_items[]
-- array inside it (lib/ai/anthropic.ts → ExtractedLineItem). A price point's
-- real identity is therefore (document_id, line_index) — the position of the
-- line inside that jsonb array — and unique(document_id, line_index) on
-- pw_price_points is what stops a re-run of the ingest/backfill job from
-- double-inserting the same line as a second price observation. Statement
-- lines also carry line_supplier, the normalised per-line market agent name
-- (distinct from the document's supplier_id) — truncated agent names as
-- printed on the statement (e.g. "Botha Roodt & Ki") are expanded to their
-- full form by the application, via prefix-alias matching, before the row is
-- written, so this column is never a truncated fragment.
--
-- agent_findings.unique(org_id, dedupe_key) is the idempotency backstop for
-- the cron: dedupe_key is a plain debuggable string (e.g.
-- 'price_watch:<supplier_id>:<pw_item_id>:<iso-week>'), not a hash, so a
-- finding for the same supplier/item/week is written at most once no matter
-- how many times the job re-runs.
--
-- Writes to all four tables come from the cron's service-role client
-- (lib/platform/supabase-service.ts → createServiceSupabase()), which
-- bypasses RLS entirely. The RLS policies below exist for future
-- user-facing reads (a findings feed, a review-queue screen), not for the
-- agent itself — every service-role query MUST filter org_id explicitly;
-- RLS is not there to save it from cross-org leakage.
--
-- PREREQUISITE: organisations, profiles, suppliers, and documents must
-- already exist (core schema).
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.
-- ============================================================================

do $$
begin
  if to_regclass('public.organisations') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.suppliers') is null
     or to_regclass('public.documents') is null then
    raise exception using
      message = 'Core schema is missing.',
      hint = 'Run supabase/core-data.sql (organisations, profiles, suppliers, documents) first, then re-run this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Canonical BUY-side item catalogue. What Price Watch actually tracks prices
-- against — raw Doc-U line descriptions get matched onto these, not the
-- other way round.
-- ---------------------------------------------------------------------------
create table if not exists pw_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,                          -- "Tomatoes, Roma"
  base_unit text not null,                     -- 'kg' | 'unit' | 'l'
  category text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pw_items_org
  on pw_items (org_id);

-- ---------------------------------------------------------------------------
-- Review queue: raw Doc-U line description → canonical pw_item. High
-- confidence matches auto-link (status 'auto'); anything below the
-- threshold lands here as 'review' rather than being guessed.
-- ---------------------------------------------------------------------------
create table if not exists pw_item_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  raw_description text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  pw_item_id uuid references pw_items(id) on delete set null,
  confidence numeric not null,
  status text not null default 'auto',         -- auto | review | confirmed | rejected
  created_at timestamptz not null default now(),
  unique (org_id, supplier_id, raw_description)
);

create index if not exists idx_pw_item_matches_org_status
  on pw_item_matches (org_id, status);
create index if not exists idx_pw_item_matches_pw_item
  on pw_item_matches (pw_item_id);

-- ---------------------------------------------------------------------------
-- Per-supplier, per-item price history. One row per Doc-U line item, price
-- normalised to the item's base_unit so a pack-size change alone can never
-- register as a price move.
--
-- unique(document_id, line_index) is the dedupe key: line items live inside
-- documents.extracted_data->line_items (jsonb), there is no relational
-- line-item table to FK against, so "this exact line was already ingested"
-- is expressed as (document_id, line_index) rather than an invoice_line_id.
-- Market-statement lines carry their own per-line market agent (line_supplier)
-- distinct from the document's supplier_id — different agents on the same
-- statement charge different prices for the same produce, so the true price
-- series key is (supplier_id, line_supplier, pw_item_id), not supplier_id
-- alone. Truncated agent names on the statement (e.g. "Botha Roodt & Ki") are
-- normalised to their full form by the application (prefix-alias matching)
-- before a row lands here, so line_supplier is never a truncated fragment.
-- ---------------------------------------------------------------------------
create table if not exists pw_price_points (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  pw_item_id uuid not null references pw_items(id) on delete cascade,
  line_supplier text,                          -- normalised per-line market agent name off the
                                                -- statement line (empty/null on plain invoices) —
                                                -- market agents charge different prices for the
                                                -- same produce, so the price series key is
                                                -- (supplier_id, line_supplier, pw_item_id), not
                                                -- the document supplier alone
  document_id uuid not null references documents(id) on delete cascade,
  line_index int not null,                     -- position in extracted_data->line_items
  unit_price numeric not null,                 -- normalised to base_unit
  quantity_base numeric not null,              -- quantity in base_unit
  invoice_date date not null,                  -- extracted "Invoice date" field, else created_at
  created_at timestamptz not null default now(),
  unique (document_id, line_index)             -- dedupe against double ingest
);
-- Upgrades databases that already ran the earlier version of this file
-- (create table if not exists does not add columns to an existing table) —
-- same pattern as supabase/docu-review-columns.sql.
alter table pw_price_points
  add column if not exists line_supplier text;

drop index if exists idx_pw_price_points_lookup;
create index if not exists idx_pw_price_points_lookup2
  on pw_price_points (org_id, supplier_id, line_supplier, pw_item_id, invoice_date);
create index if not exists idx_pw_price_points_document
  on pw_price_points (document_id);

-- ---------------------------------------------------------------------------
-- Shared findings sink — every future agent writes here, not just Price
-- Watch (hence no pw_ prefix). evidence_refs points back at the documents
-- a finding was raised from; dedupe_key + unique(org_id, dedupe_key) is the
-- backstop that keeps a re-run of the cron from writing the same finding
-- twice while the underlying condition is still true.
-- ---------------------------------------------------------------------------
create table if not exists agent_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  agent text not null,                         -- 'price_watch'
  observation text not null,
  evidence_refs uuid[] not null,               -- document ids
  rand_impact numeric,
  recommended_action text,
  status text not null default 'new',          -- new | in_progress | resolved | dismissed
  verdict text,                                -- real | known | wrong | trivial
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (org_id, dedupe_key)                  -- idempotency backstop for re-runs
);

create index if not exists idx_agent_findings_feed
  on agent_findings (org_id, agent, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security — each org sees only its own rows. Writes in production
-- come from the cron's service-role client, which bypasses these policies
-- entirely; they exist for future user-facing reads.
-- ---------------------------------------------------------------------------
alter table pw_items         enable row level security;
alter table pw_item_matches  enable row level security;
alter table pw_price_points  enable row level security;
alter table agent_findings   enable row level security;

drop policy if exists pw_items_all on pw_items;
create policy pw_items_all on pw_items for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists pw_item_matches_all on pw_item_matches;
create policy pw_item_matches_all on pw_item_matches for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists pw_price_points_all on pw_price_points;
create policy pw_price_points_all on pw_price_points for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists agent_findings_all on agent_findings;
create policy agent_findings_all on agent_findings for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));
