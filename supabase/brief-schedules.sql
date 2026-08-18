-- ============================================================================
-- Brief notification schedules — when each person wants their brief emailed.
-- ----------------------------------------------------------------------------
-- Until now there was ONE brief email: the Monday digest
-- (app/api/agents/digest/route.ts), sent to whatever addresses the operator put
-- in PRICE_WATCH_DIGEST_TO. That is an operator's setting, not a user's, and it
-- answers neither of the two questions Josh actually asked on 2026-08-18: "one
-- to view overnight changes in the morning, and one after work to view how the
-- day went". Those are per-PERSON, per-TIME-OF-DAY, and they are what these two
-- tables hold.
--
--   brief_schedules   -- one slot. "07:00 Mon–Sat" is a row.
--   brief_deliveries  -- one email actually sent, so a slot fires once a day.
--
-- FIVE decisions are baked into the DDL below; each is here because the
-- alternative was worse.
--
-- 1. OWNER-SCOPED, NOT JUST ORG-SCOPED — the same policy shape as
--    supabase/finch-chats.sql, and for the same reason. When Marco wants his
--    brief at 06:30 that is Marco's preference, not the business's, and an
--    admin colleague has no more business rewriting it than reading his chats.
--    Both policies therefore carry `and user_id = auth.uid()` alongside the org
--    check. `org_id` is still on the row (and still filtered by hand in
--    lib/platform/brief-schedules.ts) so the cron's service-role client — which
--    has no session for RLS to key off — has the tenant key it needs without a
--    join through profiles.
--
-- 2. THE TIME IS A WALL CLOCK, NOT AN INSTANT. `local_time` is `time` and
--    `timezone` is text, defaulted to 'Africa/Johannesburg'. Storing a
--    timestamptz would be storing the WRONG thing: "07:00" means seven in the
--    morning where the owner is, every day, and a stored instant would drift the
--    day South Africa ever adopts daylight saving or the day Vyso sells to a
--    business in another timezone. v1 only ever writes the default and the
--    settings card says so in words; the column exists so that later change is a
--    UI change rather than a migration plus a backfill.
--
-- 3. `days` IS int[] OF ISO WEEKDAYS (1 = Monday … 7 = Sunday), not seven
--    booleans and not a bitmask. ISO because that is what `Intl` and
--    lib/platform/brief-schedules-shared.ts already speak, an array because the
--    question the cron asks is "is today in this list?", and a mask because
--    nobody can read `62` in a psql session at 04:00 and say which days it is.
--
-- 4. THE DELIVERY ROW IS THE IDEMPOTENCY KEY, AND IT IS THE WHOLE MECHANISM.
--    `unique (schedule_id, local_date)` is what makes /api/agents/brief-notify
--    safe to run every 15 minutes, safe to run twice, and safe to run 40 minutes
--    late: the route looks back over a window (not at an exact tick), and the
--    row is what stops the second, third and fourth look from sending the same
--    email again. There is deliberately NO "last run" cursor table — the thing
--    that must not happen twice is a SEND, so the record of a send is the right
--    place for that guarantee to live.
--
-- 5. `finding_ids` RECORDS WHAT WAS IN THE EMAIL. `agent_findings` has no
--    `updated_at` and no `resolved_at` column (supabase/agents-price-watch.sql),
--    so "what closed since your last brief" cannot be derived from the findings
--    themselves — the row simply does not carry the moment its status changed.
--    What CAN be proved is "these four were in your last email, and three of
--    them are closed now", and that is exactly what this column makes provable.
--    Without it the evening brief's "how the day went" block would have to
--    either invent a timestamp or say nothing at all.
--
-- MAX FOUR SLOTS PER USER IS NOT A CONSTRAINT HERE, ON PURPOSE. Enforcing "at
-- most 4 rows per user" in Postgres needs a statement trigger (a check
-- constraint cannot see other rows), and a trigger is a moving part that fires
-- on the demo seed and on any future backfill as well as on the settings card.
-- The cap is a product decision about how many emails a day is reasonable, not
-- an integrity rule — a fifth row would be untidy, not corrupt — so it is
-- enforced once, in lib/platform/brief-schedules-shared.ts (`MAX_SLOTS`), on the
-- single path that writes these rows.
--
-- PREREQUISITE: organisations, profiles (core schema) must already exist.
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.
-- ============================================================================

do $$
begin
  if to_regclass('public.organisations') is null
     or to_regclass('public.profiles') is null then
    raise exception using
      message = 'Core schema is missing.',
      hint = 'Run supabase/core-data.sql (organisations, profiles) first, then re-run this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- One slot. "Email me at 07:00, Monday to Saturday" is one row.
--
-- `kind` is 'morning' | 'evening' | 'custom' and is DISPLAY ONLY — it picks the
-- word in the subject line ("your morning brief") and the label on the settings
-- card. It is deliberately not derived from `local_time`: the person who works
-- nights and wants their "morning" brief at 16:00 is telling us what the email
-- is FOR, and a rule that read the clock instead would argue with them. The
-- check constraint is here (unlike the four-slot cap above) because it is a
-- genuine integrity rule — an unknown kind has no word to print.
-- ---------------------------------------------------------------------------
create table if not exists brief_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null default 'custom' check (kind in ('morning', 'evening', 'custom')),
  local_time time not null,                    -- wall clock in `timezone` (decision 2)
  timezone text not null default 'Africa/Johannesburg',
  days int[] not null default '{1,2,3,4,5}',   -- ISO weekday 1=Mon … 7=Sun (decision 3)
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- One email that was actually sent.
--
-- `user_id` is NOT a foreign key to profiles here, unlike on brief_schedules.
-- A delivery is a record of something that happened, and it should survive the
-- person leaving the business — the org still wants to be able to answer "what
-- did Vyso send, to whom, last month". The schedule reference DOES cascade,
-- because a slot's delivery history is meaningless once the slot is gone, and
-- because the unique constraint below needs a non-null schedule_id to work at
-- all. lib/platform/brief-schedules.ts preserves row ids across a Save for that
-- reason: editing 07:00 to 07:15 must not throw away the history that the
-- "since your last brief" block reads.
--
-- `local_date` is the SAST calendar day the email was FOR, not the UTC date it
-- went out on. A 00:30 SAST slot sends at 22:30 UTC the day before, and keying
-- the dedupe on the UTC date would let it fire twice on one of those nights.
-- ---------------------------------------------------------------------------
create table if not exists brief_deliveries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references brief_schedules(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null,
  local_date date not null,                    -- SAST calendar day, not the UTC one
  sent_at timestamptz not null default now(),
  finding_ids uuid[] not null default '{}',    -- what was in the email (decision 5)
  unique (schedule_id, local_date)             -- the whole idempotency mechanism (decision 4)
);

-- The cron's read, exactly: every enabled slot for an allowlisted org. Partial
-- on `enabled` because a disabled slot is one the cron must never even look at,
-- and indexing the rows it will always skip is pure write cost.
create index if not exists idx_brief_schedules_due
  on brief_schedules (org_id)
  where enabled;

-- The settings card's read: this person's slots, in the order the card draws
-- them (earliest first, so "07:00" sits above "17:30" without a client sort).
create index if not exists idx_brief_schedules_user
  on brief_schedules (user_id, local_time);

-- "When did this person last get a brief?" — the one query behind the
-- "since your last brief" block. Keyed on the USER rather than the schedule
-- because the block is about the person's last email, whichever slot sent it:
-- a 17:30 evening brief should report on what changed since the 07:00 one, not
-- since yesterday evening.
create index if not exists idx_brief_deliveries_user
  on brief_deliveries (user_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- Row level security — org AND owner scoped (decision 1). The cron writes with
-- the service role and bypasses all of this, which is why every query in
-- lib/platform/brief-notify.ts filters `org_id` by hand.
-- ---------------------------------------------------------------------------
alter table brief_schedules  enable row level security;
alter table brief_deliveries enable row level security;

drop policy if exists brief_schedules_all on brief_schedules;
create policy brief_schedules_all on brief_schedules for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and user_id = auth.uid()
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and user_id = auth.uid()
  );

-- READ ONLY for the user themselves, and nothing else: every write to this
-- table is a record of an email the SERVER sent, so there is no `for all` here.
-- A client that could insert a delivery row could silence its own brief.
drop policy if exists brief_deliveries_select on brief_deliveries;
create policy brief_deliveries_select on brief_deliveries for select
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and user_id = auth.uid()
  );
