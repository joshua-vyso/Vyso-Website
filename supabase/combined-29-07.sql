-- ============================================================================
-- COMBINED apply script — all 11 new SQL files from the 29 July 2026 work.
-- Paste into the Supabase SQL editor and run once. Idempotent where possible.
-- Order: (1) new tables  (2) realtime publication  (3) Fresh Valley demo seeds.
-- If you are NOT running this on the project that has the demo-fresh-valley
-- base schemas (pw_/ww_/sb_/ig_ tables), stop after section 1's first two files
-- and skip section 3.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/ss-supplier-credits.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/ss-supplier-rebates.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/demo-fresh-valley/1-shiftboard-swaps.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- ShiftBoard — shift swaps & cover requests (additive sibling to
-- 1-shiftboard-schema.sql; that file is never altered by this one).
-- ----------------------------------------------------------------------------
-- The pain: swaps happen outside the system. Someone texts a colleague, the
-- colleague agrees, the manager finds out on the day. This table makes the app
-- the schedule of record:
--
--     propose  →  accept  →  manager approve  →  roster is rewritten
--
-- Only the approval step writes sb_roster_shifts.days (done client-side in
-- lib/platform/shiftboard-write.ts), so a verbal arrangement never silently
-- changes who is on shift.
--
-- `kind` distinguishes the two real-world shapes:
--   cover — one person gives a shift away (this is also what a call-out cover
--           offer becomes once someone puts their hand up);
--   swap  — two people trade, so the request also carries the shift given back.
--
-- Org-scoped RLS, mirroring the sb_*/of_*/pp_* pattern. Idempotent — safe to
-- paste into the Supabase SQL editor more than once.
-- ============================================================================

create table if not exists sb_shift_swaps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,

  kind text not null default 'swap',            -- swap | cover
  status text not null default 'proposed',      -- proposed|accepted|approved|declined|cancelled
  week_label text not null default '',          -- e.g. 'Week of 30 Jun' (matches sb_roster_shifts.label)

  -- The shift being given up.
  day text not null,                            -- 'Mon'..'Sun', the roster's day columns
  from_employee_id uuid references sb_employees(id) on delete set null,
  from_name text not null,
  from_time text not null default '',           -- '07–15'
  from_department text,

  -- The counterparty. Null until somebody accepts; for a swap this is also the
  -- shift handed back (which may fall on a different day).
  to_employee_id uuid references sb_employees(id) on delete set null,
  to_name text,
  to_day text,
  to_time text,
  to_department text,

  reason text,                                  -- 'Called out', 'Family responsibility', ...
  note text,                                    -- free text shown to the team
  decided_note text,                            -- manager's note on decline/approve

  proposed_by uuid,                             -- profiles.id of whoever logged it
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The swap centre reads "open requests, newest first" on every load.
create index if not exists idx_sb_shift_swaps_org
  on sb_shift_swaps (org_id, status, created_at desc);
create index if not exists idx_sb_shift_swaps_from
  on sb_shift_swaps (from_employee_id);
create index if not exists idx_sb_shift_swaps_to
  on sb_shift_swaps (to_employee_id);

-- ---------------------------------------------------------------------------
-- Row level security: each org only sees its own rows (same shape as sb_*).
-- ---------------------------------------------------------------------------
alter table sb_shift_swaps enable row level security;

drop policy if exists sb_shift_swaps_all on sb_shift_swaps;
create policy sb_shift_swaps_all on sb_shift_swaps for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime — LiveOps, Attendance and the roster all subscribe to these tables
-- so a clock-in, a call-out or an approved swap lands on every open screen.
-- Realtime ENFORCES RLS, so this stays strictly org-scoped (it fails closed).
-- Guarded per table because `add table` errors if it is already published.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'sb_shift_swaps',     -- swap & cover requests
    'sb_roster_shifts',   -- roster cells + the week's open shifts
    'sb_attendance',      -- clock-ins during service
    'sb_employees',       -- live status / device assignment
    'sb_leave_requests'   -- approvals that change coverage
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/demo-fresh-valley/10-planwise-decisions-schema.sql
-- ─────────────────────────────────────────────────────────────────────────
-- PlanWise decisions: the cross-module recommendations the org is actually
-- TRACKING, as opposed to the suggestions PlanWise derives on every request from
-- measured data (overspend vs pace, unpaid invoices, logged waste, margin gap).
--
-- The distinction matters: a suggestion vanishes the moment the number behind it
-- moves, which is right for a signal and wrong for a commitment. Adopting a
-- suggestion writes it here, at which point it gains a status that survives the
-- number changing — the difference between "the dashboard mentioned it" and
-- "we decided to do it".
--
-- Additive sibling of 3-planwise-schema.sql; nothing existing is altered.
-- Org-scoped RLS, mirroring pw_budget_lines / pw_goals / pw_forecast.
-- Idempotent. Paste into the Supabase SQL editor and run once.

create table if not exists pw_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- Stable key. Matches the derived suggestion it came from (e.g.
  -- 'recover-outstanding', 'overspend-packaging') so adopting the same
  -- suggestion twice is a no-op rather than a duplicate task.
  decision_key text not null,
  module text not null,                     -- VysoModuleKey that can act on it ("Review →")
  action text not null,                     -- the decision itself
  impact text not null default '',          -- display string, e.g. '+R 11 200 / mo'
  impact_value numeric not null default 0,  -- signed rand impact, for sorting + the roll-up
  priority text not null default 'medium',  -- 'high' | 'medium' | 'low'
  status text not null default 'open',      -- 'open' | 'in_progress' | 'done'
  because text,                             -- measured evidence captured when it was raised
  note text,                                -- free-text follow-up from the owner
  owner text,                               -- who picked it up (display name)
  due_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pw_decisions_org on pw_decisions (org_id, sort_order);
-- One tracked row per suggestion per org: makes "adopt" idempotent at the DB
-- level, not just in the app.
create unique index if not exists idx_pw_decisions_org_key on pw_decisions (org_id, decision_key);

-- Row level security: each org only sees its own rows (same shape as pw_*).
alter table pw_decisions enable row level security;

drop policy if exists pw_decisions_all on pw_decisions;

create policy pw_decisions_all on pw_decisions for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/demo-fresh-valley/5b-insightgen-runs-acks.sql
-- ─────────────────────────────────────────────────────────────────────────
-- InsightGen — additive sibling to 5-insightgen-schema.sql.
--
-- ig_report_runs   = one row every time a saved report is actually run/exported,
--                    so "last run" on the Reports tab is a recorded fact rather
--                    than a seeded column value.
-- ig_anomaly_acks  = acknowledgements for the rule-based anomalies InsightGen
--                    derives at read time. Anomalies are computed, not stored,
--                    so the ack keys off the anomaly's stable rule key
--                    (e.g. 'waste-spike', 'supplier-price:<uuid>').
--
-- Org-scoped RLS, mirroring ig_insights / ig_reports. Idempotent — nothing here
-- alters or drops an existing table. Paste into the Supabase SQL editor.

create table if not exists ig_report_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  report_id uuid references ig_reports(id) on delete cascade,
  -- dataset keys included in this run, e.g. ["sales","waste"]
  datasets jsonb not null default '[]'::jsonb,
  -- rows produced across every included dataset
  row_count int not null default 0,
  -- csv | view  (how the run was consumed)
  output text not null default 'csv',
  run_by text,
  run_at timestamptz not null default now()
);
create index if not exists idx_ig_report_runs_org on ig_report_runs (org_id, run_at desc);
create index if not exists idx_ig_report_runs_report on ig_report_runs (report_id, run_at desc);

create table if not exists ig_anomaly_acks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- stable key of the derived anomaly (Anomaly.key in lib/platform/insightgen-data.ts)
  anomaly_key text not null,
  -- acknowledged | resolved | ignored
  state text not null default 'acknowledged',
  note text,
  acked_by text,
  created_at timestamptz not null default now(),
  unique (org_id, anomaly_key)
);
create index if not exists idx_ig_anomaly_acks_org on ig_anomaly_acks (org_id, created_at desc);

-- Row level security: each org only sees its own rows (same shape as ig_*).
alter table ig_report_runs  enable row level security;
alter table ig_anomaly_acks enable row level security;

drop policy if exists ig_report_runs_all  on ig_report_runs;
drop policy if exists ig_anomaly_acks_all on ig_anomaly_acks;

create policy ig_report_runs_all on ig_report_runs for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ig_anomaly_acks_all on ig_anomaly_acks for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/planwise-realtime.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Enable Supabase Realtime for PlanWise.
--
-- PlanWise renders on the server and derives every number from source on each
-- request, so keeping it live is purely a matter of re-running the layout when
-- the underlying plan changes. `useRealtimeRefresh` in
-- components/platform/planwise/Chrome.tsx subscribes to the tables below; each
-- has to be in the `supabase_realtime` publication for those events to arrive.
--
-- Why these tables: the plan is written from more than one place — the budget
-- modal and goals form in PlanWise, the forecast editor, the decisions panel,
-- and PricePilot's own reads/writes of pl_targets — so an edit made in one tab
-- (or by a colleague) must not sit stale in another.
--
-- Realtime ENFORCES RLS: the browser only receives change events for rows the
-- signed-in user could SELECT, so this stays strictly org-scoped (it fails
-- closed — a missing SELECT policy means no events, never cross-tenant
-- leakage). Every table below already has an org-scoped policy, defined in
-- demo-fresh-valley/3-planwise-schema.sql, 10-planwise-decisions-schema.sql and
-- the pl_targets setup SQL.
--
-- Additive: this does NOT modify supabase/realtime.sql, it only adds PlanWise's
-- tables to the same publication. Idempotent — `add table` errors if the table
-- is already published, so each is guarded. Safe to run more than once.
-- Skips any table that does not exist yet (pw_decisions on an older workspace).
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'pw_budget_lines',  -- budget categories: the "+ Add category" modal writes here
    'pw_goals',         -- strategic goals: the Goals tab writes here
    'pw_forecast',      -- forecast lines: the forecast editor writes here
    'pw_decisions',     -- tracked decisions: adopt / status change / stop tracking
    'pl_targets'        -- shared targets, also written by PricePilot
  ]
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      raise notice 'skipping %, table does not exist yet', t;
      continue;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/pricepilot-realtime.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- PricePilot Realtime — add the pricing tables to the `supabase_realtime`
-- publication so every PricePilot screen refreshes itself when a price list or
-- a margin override changes (see components/platform/pricepilot/Live.tsx, which
-- subscribes to pl_price_lists / pl_overrides / of_orders).
--
-- ADDITIVE ONLY: nothing here alters or drops an existing table. `of_orders` is
-- already added by supabase/realtime.sql; it is repeated here only so this file
-- stands alone, and the guard makes that a no-op.
--
-- Realtime ENFORCES RLS: the browser only receives change events for rows the
-- signed-in user could SELECT. Both tables below carry the org-scoped policies
-- created in supabase/pricepilot-schema.sql, so this stays strictly org-scoped
-- and fails closed (a missing SELECT policy means no events, never leakage).
--
-- Idempotent: `add table` errors if the table is already in the publication, so
-- each is guarded. Safe to run more than once. Paste into the SQL editor.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'pl_price_lists',  -- default margins + customer contract validity windows
    'pl_overrides',    -- per-product margin overrides (what Recommendations publishes)
    'of_orders'        -- realized sales behind revenue / GP / margin (already published)
  ]
  loop
    -- Only publish tables that actually exist in this database.
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t)
       and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/serviceden-realtime.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- ServiceDen realtime. Additive: adds the three inbox-shaped ServiceDen tables
-- to the `supabase_realtime` publication so the Leads pipeline updates live
-- (a synced Gmail message, a new/updated lead, a logged activity) without a
-- manual refresh. Paste into the Supabase SQL editor.
--
-- Realtime ENFORCES RLS: the browser only receives change events for rows the
-- signed-in user could SELECT. All three tables already carry org-scoped,
-- sd_access_grants-gated policies (supabase/serviceden.sql), so this stays
-- strictly private to the ServiceDen account and fails closed — a user without
-- a grant simply receives nothing, never another org's rows.
--
-- Idempotent: `add table` errors if the table is already in the publication, so
-- each is guarded. Safe to run more than once. Alters nothing else.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'sd_leads',           -- the Leads pipeline board (stage/review changes)
    'sd_mail_messages',   -- synced Gmail messages on a lead's threads
    'sd_lead_activities'  -- the per-lead activity timeline
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/wastewatch-realtime.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- Enable Supabase Realtime for WasteWatch.
--
-- Waste is logged from the floor — a paired scale or a phone in the prep area —
-- while a manager has the module open, and every WasteWatch aggregate (category
-- totals, the weekly report, waste as a % of food cost) is recomputed from
-- ww_waste_events server-side. So a new row has to re-run the route to be
-- reflected; useRealtimeRefresh(['ww_waste_events','ww_devices']) does exactly
-- that. ww_devices is included so a scale dropping offline or hitting a low
-- battery surfaces on the Devices tab without a manual refresh.
--
-- Realtime ENFORCES RLS: the browser only receives change events for rows the
-- signed-in user could SELECT, so this stays strictly org-scoped (it fails
-- closed — a missing SELECT policy means no events, never cross-tenant leakage).
-- Both tables already carry an org-scoped policy from
-- supabase/demo-fresh-valley/2-wastewatch-schema.sql.
--
-- Additive and idempotent: `add table` errors if the table is already in the
-- publication, so each is guarded. Safe to run more than once, and safe to run
-- alongside supabase/realtime.sql (neither touches the other's tables).
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'ww_waste_events',  -- the waste log + every aggregate derived from it
    'ww_devices'        -- scale/sensor status on the Devices tab
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/demo-fresh-valley/10-planwise-decisions-seed.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Seed a few TRACKED PlanWise decisions for Fresh Valley Produce, so the demo
-- org shows the panel in its steady state (some in progress, one done) rather
-- than as a wall of fresh suggestions.
--
-- Deliberately partial: PlanWise derives the rest from measured data at read
-- time, and the panel offers those as "Suggested by PlanWise" until someone
-- tracks them. Keeping the seed thin is what makes that distinction visible.
--
-- Requires 10-planwise-decisions-schema.sql. Re-runnable: the org's rows are
-- cleared before re-inserting. HOW TO APPLY: paste into the Supabase SQL editor.
-- All money in ZAR.

delete from pw_decisions where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

insert into pw_decisions (org_id, decision_key, module, action, impact, impact_value, priority, status, because, sort_order)
select o.id, v.decision_key, v.module, v.action, v.impact, v.impact_value, v.priority, v.status, v.because, v.sort_order
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('recover-outstanding', 'orderflow',    'Recover outstanding invoices',   '+R 18 000',       18000, 'high',   'in_progress', 'R 6 400 of it is already past due.',                     0),
  ('overspend-cogs-produce','procurepulse','Pull COGS (Produce) back to plan','+R 11 200 / mo', 11200, 'high',   'open',        'Tracking to R 5 772 000 against a R 5 460 000 plan.',    1),
  ('close-margin-gap',    'pricepilot',   'Reprice below-target products',  '+R 6 400 / mo',    6400, 'high',   'open',        'Realised margin is 22.0% against a 24% target.',         2),
  ('cut-waste',           'wastewatch',   'Cut logged waste',               '+R 2 400 / mo',    2400, 'medium', 'open',        'R 6 000 logged this month — 4.4% of food cost.',         3),
  ('missing-expense-docs','docu',         'Add 3 missing expense documents','Cleaner forecast',    0, 'low',    'done',        'Three supplier invoices were unreconciled last month.',  4)
) as v(decision_key, module, action, impact, impact_value, priority, status, because, sort_order)
;


-- ─────────────────────────────────────────────────────────────────────────
-- SOURCE: supabase/demo-fresh-valley/4b-supplysync-credits-rebates-seed.sql
-- ─────────────────────────────────────────────────────────────────────────
-- SupplySync credits & rebates demo seed for Fresh Valley Produce.
-- Additive sibling to 4-supplysync-seed.sql: the credit/dispute register and the
-- supplier rebate agreements + receipts. Dates are relative to `current_date`
-- so claim ages and period windows stay realistic whenever the seed is run.
-- Re-runnable: deletes this org's rows first, then re-inserts.
--
-- PREREQUISITES (in order):
--   supabase/demo-fresh-valley/4-supplysync-seed.sql  (the suppliers this joins to)
--   supabase/ss-supplier-credits.sql
--   supabase/ss-supplier-rebates.sql
-- Paste into the Supabase SQL editor and run.

delete from ss_supplier_rebate_receipts where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_rebates         where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
delete from ss_supplier_credits         where org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);

-- ---------------------------------------------------------------------------
-- Credit & dispute register — 10 claims across every state.
-- ---------------------------------------------------------------------------
insert into ss_supplier_credits (
  org_id, supplier_id, supplier_name, issue_type, reference, item, description,
  amount, amount_credited, status, claimed_on, acknowledged_on, resolved_on, owner
)
select o.id, s.id, s.name, v.issue_type, v.reference, v.item, v.description,
       v.amount, v.amount_credited,
       v.status,
       current_date - v.claimed_days_ago,
       case when v.ack_days_ago is null then null else current_date - v.ack_days_ago end,
       case when v.resolved_days_ago is null then null else current_date - v.resolved_days_ago end,
       v.owner
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Cape Town Market',    'short_ship',    'INV-CTM-40218', 'Tomatoes (jam)',      '18 crates short against the delivery note; driver signed the discrepancy.', 4860,  null, 'claimed',      3,  null, null, 'Pieter Steyn'),
  ('Two Oceans Produce',  'quality',       'INV-TOP-11907', 'Green peppers',       'Two pallets soft on arrival, rejected at goods-in and photographed.',        7240,  null, 'claimed',      9,  null, null, 'Chris Adams'),
  ('Klein Karoo Veg',     'short_ship',    'DN-KKV-3381',   'Potatoes (large)',    '1.5t short on the Thursday load; back-order never arrived.',                12500, null, 'acknowledged', 21, 14,   null, 'Aisha Patel'),
  ('Tygerberg Tomatoes',  'quality',       'INV-TYG-8842',  'Plum tomatoes',       'Grade slipped two loads running — credit agreed in principle on the call.',  5390,  null, 'acknowledged', 34, 25,   null, 'Chris Adams'),
  ('Hex River Grapes',    'not_delivered', 'PO-HRG-2209',   'Red globe grapes',    'Order confirmed then never dispatched; had to spot-buy at the market.',      9150,  null, 'claimed',      47, null, null, 'Bheki Ngcobo'),
  ('Cape Town Market',    'price_error',   'INV-CTM-39980', 'Butternut',           'Invoiced at R14.20/kg against the R11.90 agreed on the floor.',              3120,  3120, 'credited',     52, 45,   38,   'Pieter Steyn'),
  ('Two Oceans Produce',  'substitution',  'INV-TOP-11740', 'Cucumber (English)', 'Substituted for standard cucumber without approval; sold at a lower price.',  2480,  1600, 'credited',     61, 55,   44,   'Kabelo Nkosi'),
  ('Philippi Fresh Co-op','damaged',       'DN-PFC-7712',   'Baby spinach',        'Cold-chain break on the morning run; three crates unsellable.',              1890,  1890, 'credited',     40, 33,   27,   'Zinhle Khoza'),
  ('Stellenbosch Farms',  'short_ship',    'DN-SF-5540',    'Carrots (washed)',    'Half a pallet short; supplier disputes the count and we have no photo.',      2150,  0,    'written_off',  74, 66,   52,   'Aisha Patel'),
  ('Sandveld Potatoes',   'quality',       'INV-SVP-6621',  'Potatoes (medium)',   'Greening on two bags — supplier replaced stock instead of crediting.',        980,   980,  'credited',     29, 24,   19,   'Wandile Zwane')
) as v(supplier_name, issue_type, reference, item, description, amount, amount_credited, status, claimed_days_ago, ack_days_ago, resolved_days_ago, owner)
join ss_suppliers s
  on s.name = v.supplier_name
 and s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1)
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

-- ---------------------------------------------------------------------------
-- Rebate agreements — volume/growth deals with the four biggest suppliers.
-- ---------------------------------------------------------------------------
insert into ss_supplier_rebates (
  org_id, supplier_id, supplier_name, name, basis, rate_pct, flat_amount,
  threshold_spend, period, period_start, period_end, expected_amount, status, note
)
select o.id, s.id, s.name, v.name, v.basis, v.rate_pct, v.flat_amount,
       v.threshold_spend, v.period,
       current_date - v.start_days_ago,
       current_date + v.end_days_ahead,
       v.expected_amount, v.status, v.note
from (select id from organisations where name = 'Fresh Valley Produce' limit 1) o
cross join (values
  ('Ceres Fruit Growers',  'Q3 apple volume rebate',      'percent', 2.5,  null,   2000000, 'quarterly', 45,  45,  55000,  'accruing', 'Paid as a credit note in the month after quarter end.'),
  ('Philippi Fresh Co-op', 'Leafy greens growth rebate',  'percent', 1.8,  null,   1200000, 'quarterly', 45,  45,  null,   'accruing', 'Expected value estimated from average spend until the co-op confirms.'),
  ('Boland Citrus',        'Winter citrus season rebate', 'flat',    null, 42000,  null,    'annual',    150, 30,  42000,  'claimed',  'Claimed on the season close; part payment received.'),
  ('Cape Town Market',     'Market floor volume rebate',  'percent', 1.2,  null,   2500000, 'quarterly', 135, -45, 32000,  'agreed',   'Last quarter closed short — chase the agent.')
) as v(supplier_name, name, basis, rate_pct, flat_amount, threshold_spend, period, start_days_ago, end_days_ahead, expected_amount, status, note)
join ss_suppliers s
  on s.name = v.supplier_name
 and s.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1)
where exists (select 1 from organisations org2 where org2.name = 'Fresh Valley Produce');

-- ---------------------------------------------------------------------------
-- Receipts — money that actually arrived against those agreements.
-- ---------------------------------------------------------------------------
insert into ss_supplier_rebate_receipts (org_id, rebate_id, amount, received_on, method, reference, note)
select r.org_id, r.id, v.amount, current_date - v.days_ago, v.method, v.reference, v.note
from ss_supplier_rebates r
join (values
  ('Q3 apple volume rebate',      18000, 20, 'credit_note',      'CN-CFG-2261', 'First tranche against the quarter.'),
  ('Winter citrus season rebate', 25000, 12, 'eft',              'EFT-BC-88120', 'Part payment; balance promised end of month.'),
  ('Market floor volume rebate',   9500, 60, 'invoice_discount', 'CTM-DISC-4471', 'Applied as a discount on the March statement.')
) as v(rebate_name, amount, days_ago, method, reference, note)
  on v.rebate_name = r.name
where r.org_id = (select id from organisations where name = 'Fresh Valley Produce' limit 1);
