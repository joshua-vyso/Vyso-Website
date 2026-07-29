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
