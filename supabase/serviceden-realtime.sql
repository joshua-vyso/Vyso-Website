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
