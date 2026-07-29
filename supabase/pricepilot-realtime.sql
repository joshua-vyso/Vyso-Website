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
