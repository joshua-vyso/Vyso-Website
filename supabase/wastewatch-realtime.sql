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
