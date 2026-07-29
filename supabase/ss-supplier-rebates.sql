-- ============================================================================
-- SupplySync — supplier rebate tracker (agreements + receipts)
-- ----------------------------------------------------------------------------
-- supabase/rebates.sql already ships the CUSTOMER side of rebates: a standing
-- `of_customers.rebate_pct` snapshotted onto `of_invoices.rebate_pct` at
-- creation. This file is the mirror image on the BUY side — the volume//growth
-- rebates a supplier owes the business, which leak because nobody tracks what
-- was agreed versus what actually landed. Same semantics as the customer file
-- (a percentage or flat amount agreed for a period), same idempotent, org-scoped
-- RLS style as the ss_* siblings.
--
--   ss_supplier_rebates          -- the agreement, per supplier per period
--   ss_supplier_rebate_receipts  -- money actually received against it
--
-- Received is NEVER stored on the agreement: it is the sum of its receipts, so
-- "expected vs received" can't drift out of step with the credit notes on file.
--
-- PREREQUISITE: supabase/demo-fresh-valley/4-supplysync-schema.sql (creates the
-- ss_* base tables; idempotent, seeds nothing on a production database).
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.
-- ============================================================================

do $$
begin
  if to_regclass('public.ss_suppliers') is null then
    raise exception using
      message = 'SupplySync base schema is missing.',
      hint = 'Run supabase/demo-fresh-valley/4-supplysync-schema.sql first, then re-run this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The agreement.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_rebates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid references ss_suppliers(id) on delete set null,
  supplier_name text,                              -- snapshot label
  name text not null,                              -- e.g. "Q3 citrus volume rebate"
  basis text not null default 'percent',           -- percent | flat
  rate_pct numeric,                                -- when basis = percent (of qualifying spend)
  flat_amount numeric,                             -- when basis = flat
  threshold_spend numeric,                         -- spend needed to qualify (null = none)
  period text not null default 'quarterly',        -- monthly | quarterly | annual
  period_start date,
  period_end date,
  -- Agreed/forecast value for the period. Null → the app estimates it from the
  -- rate and the supplier's average monthly spend and LABELS it as an estimate.
  expected_amount numeric,
  status text not null default 'agreed',           -- agreed | accruing | claimed | received | missed
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ss_supplier_rebates_org
  on ss_supplier_rebates (org_id, status, period_end desc);
create index if not exists idx_ss_supplier_rebates_supplier
  on ss_supplier_rebates (supplier_id, period_end desc);

-- ---------------------------------------------------------------------------
-- Money actually received against an agreement (credit note, EFT, discount).
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_rebate_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- cascade: a receipt is meaningless without its agreement.
  rebate_id uuid not null references ss_supplier_rebates(id) on delete cascade,
  amount numeric not null default 0,
  received_on date not null default current_date,
  method text,                                     -- credit_note | eft | invoice_discount | other
  reference text,                                  -- credit-note / payment reference
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_ss_supplier_rebate_receipts_rebate
  on ss_supplier_rebate_receipts (rebate_id, received_on desc);
create index if not exists idx_ss_supplier_rebate_receipts_org
  on ss_supplier_rebate_receipts (org_id, received_on desc);

-- ---------------------------------------------------------------------------
-- Row level security — each org sees only its own rows.
-- ---------------------------------------------------------------------------
alter table ss_supplier_rebates         enable row level security;
alter table ss_supplier_rebate_receipts enable row level security;

drop policy if exists ss_supplier_rebates_all on ss_supplier_rebates;
create policy ss_supplier_rebates_all on ss_supplier_rebates for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

drop policy if exists ss_supplier_rebate_receipts_all on ss_supplier_rebate_receipts;
create policy ss_supplier_rebate_receipts_all on ss_supplier_rebate_receipts for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime, so recording a receipt updates the tab for everyone watching.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['ss_supplier_rebates', 'ss_supplier_rebate_receipts']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
