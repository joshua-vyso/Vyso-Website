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
