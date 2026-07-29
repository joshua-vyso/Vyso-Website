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
