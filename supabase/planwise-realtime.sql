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
