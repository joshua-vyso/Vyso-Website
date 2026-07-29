-- ============================================================================
-- SupplySync — supplier credit & dispute tracker
-- ----------------------------------------------------------------------------
-- Short-ships, substitutions, quality rejects and price errors are today chased
-- by phone and forgotten; nobody can say what a supplier still owes. This table
-- is the register: one row per claim, moving
--
--     claimed → acknowledged → credited | written_off
--
-- "Unresolved" = claimed + acknowledged, and its rand total is rolled up on the
-- SupplySync Overview. `amount` is what was claimed; `amount_credited` is what
-- the supplier actually gave back (they differ often — that gap is the whole
-- point of tracking it).
--
-- Org-scoped RLS, mirroring ss_supplier_risks / pp_reorder_requests. Idempotent
-- — safe to re-run. Paste into the Supabase SQL editor.
--
-- PREREQUISITE: the SupplySync base tables must exist. They are created by
-- supabase/demo-fresh-valley/4-supplysync-schema.sql (idempotent, org-scoped by
-- RLS — running it on a production database creates empty tables and seeds
-- nothing). The guard below fails loudly with that instruction.
-- ============================================================================

do $$
begin
  if to_regclass('public.ss_suppliers') is null then
    raise exception using
      message = 'SupplySync base schema is missing.',
      hint = 'Run supabase/demo-fresh-valley/4-supplysync-schema.sql first, then re-run this migration.';
  end if;
end $$;

create table if not exists ss_supplier_credits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- set null (not cascade): a settled claim is a financial record and must
  -- survive the supplier profile being removed.
  supplier_id uuid references ss_suppliers(id) on delete set null,
  supplier_name text,                            -- snapshot label, kept if the profile goes
  -- The Doc-U document the claim was raised against (invoice / delivery note).
  document_id uuid references documents(id) on delete set null,
  issue_type text not null default 'short_ship', -- short_ship | substitution | quality | damaged | price_error | not_delivered | other
  reference text,                                -- supplier invoice / delivery-note number
  item text,                                     -- the line the claim is about
  description text not null default '',
  amount numeric not null default 0,             -- ZAR claimed
  amount_credited numeric,                       -- ZAR actually credited (null until settled)
  status text not null default 'claimed',        -- claimed | acknowledged | credited | written_off
  claimed_on date not null default current_date,
  acknowledged_on date,
  resolved_on date,                              -- credited or written off on
  owner text,                                    -- who is chasing it
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ss_supplier_credits_org
  on ss_supplier_credits (org_id, status, claimed_on desc);
create index if not exists idx_ss_supplier_credits_supplier
  on ss_supplier_credits (supplier_id, claimed_on desc);

alter table ss_supplier_credits enable row level security;

drop policy if exists ss_supplier_credits_all on ss_supplier_credits;
create policy ss_supplier_credits_all on ss_supplier_credits for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- Live updates on the Credits & Rebates tab. RLS is enforced by Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ss_supplier_credits'
  ) then
    execute 'alter publication supabase_realtime add table public.ss_supplier_credits';
  end if;
end $$;
