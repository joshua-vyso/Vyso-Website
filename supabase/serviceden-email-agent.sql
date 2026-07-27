-- ServiceDen email agent — company research, writing templates and approved,
-- human-sent lead emails. Idempotent; paste into the Supabase SQL editor.
--
-- Same shape as supabase/serviceden.sql: org-scoped rows, an sd_access_grants
-- check on every policy, and owner_user_id ownership wherever the row belongs to
-- one person. Sending is deliberately NOT reachable from the browser: the send
-- lifecycle columns on sd_email_drafts are revoked from `authenticated`, so only
-- the service-role client inside the ServiceDen API routes can approve or send.

-- 3.1 Lead website ----------------------------------------------------------
alter table sd_leads add column if not exists website_url text;

-- 3.2 Company research (one active row per lead; history is not required) ----
create table if not exists sd_lead_company_research (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  lead_id uuid not null references sd_leads(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','running','complete','no_website','needs_confirmation','error')),
  website_url text,                                 -- normalised URL actually researched
  domain text,                                      -- normalised registrable host, e.g. "acme.co.za"
  candidates jsonb not null default '[]',           -- [{url, title, reason}] when needs_confirmation
  company_name text,
  industry text,
  location text,
  products_services text,
  customer_type text,
  operational_signals jsonb not null default '[]',  -- [{claim, sourceId, kind: 'fact'|'hypothesis'}]
  summary text,
  sources jsonb not null default '[]',              -- [{id, url, title, scrapedAt}]
  confidence text not null default 'low' check (confidence in ('low','medium','high')),
  content_hash text,                                -- sha256 of the structured brief; the "research revision"
  excluded_source_ids text[] not null default '{}', -- user-excluded facts (by sourceId)
  last_error text,
  researched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id)
);
create index if not exists idx_sd_lead_company_research_org
  on sd_lead_company_research (org_id, lead_id);

-- 3.3 Templates (stage playbooks) + examples ---------------------------------
create table if not exists sd_email_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  stages text[] not null default '{}',              -- values from the sd_leads stage check-list
  purpose text,
  tone_notes text,
  preferred_cta text,
  industry_tags text[] not null default '{}',
  visibility text not null default 'personal' check (visibility in ('personal','org')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sd_email_templates_org
  on sd_email_templates (org_id, active);

create table if not exists sd_email_template_examples (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  template_id uuid not null references sd_email_templates(id) on delete cascade,
  subject_example text not null default '',
  body_example text not null,
  active boolean not null default true,
  source text not null default 'manual' check (source in ('manual','sent_email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sd_email_template_examples_template
  on sd_email_template_examples (template_id, active);

-- 3.4 Drafts ----------------------------------------------------------------
create table if not exists sd_email_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references sd_leads(id) on delete cascade,
  gmail_connection_id uuid references sd_gmail_connections(id) on delete set null,
  recipient_email text not null,
  subject text not null default '',
  body text not null default '',
  pipeline_stage_snapshot text not null,
  template_ids uuid[] not null default '{}',
  example_ids uuid[] not null default '{}',
  research_id uuid references sd_lead_company_research(id) on delete set null,
  research_revision text,                           -- content_hash used at generation time
  used_source_ids text[] not null default '{}',
  reasoning_summary text,
  suggested_follow_up_days int,
  source_thread_id uuid references sd_mail_threads(id) on delete set null, -- null = new email
  status text not null default 'draft'
    check (status in ('draft','approved','sending','sent','failed','cancelled')),
  stale_research boolean not null default false,
  model text,
  generated_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  approved_content_hash text,                       -- sha256(recipient \n subject \n body) at approval
  sent_at timestamptz,
  gmail_message_id text,
  gmail_thread_id text,
  idempotency_key uuid not null default gen_random_uuid(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sd_email_drafts_lead
  on sd_email_drafts (org_id, lead_id, created_at desc);
create unique index if not exists idx_sd_email_drafts_idempotency
  on sd_email_drafts (idempotency_key);

-- Row level security ---------------------------------------------------------
alter table sd_lead_company_research   enable row level security;
alter table sd_email_templates         enable row level security;
alter table sd_email_template_examples enable row level security;
alter table sd_email_drafts            enable row level security;

drop policy if exists sd_lead_company_research_private   on sd_lead_company_research;
drop policy if exists sd_email_templates_private         on sd_email_templates;
drop policy if exists sd_email_template_examples_private on sd_email_template_examples;
drop policy if exists sd_email_drafts_private            on sd_email_drafts;

-- Research belongs to the lead: same access grant, and the parent lead must be
-- this user's lead in the same org (mirrors sd_lead_activities_private).
create policy sd_lead_company_research_private on sd_lead_company_research for all
  using (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_lead_company_research.org_id and g.enabled)
    and exists (
      select 1 from sd_leads l
      where l.id = sd_lead_company_research.lead_id
        and l.org_id = sd_lead_company_research.org_id
        and l.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_lead_company_research.org_id and g.enabled)
    and exists (
      select 1 from sd_leads l
      where l.id = sd_lead_company_research.lead_id
        and l.org_id = sd_lead_company_research.org_id
        and l.owner_user_id = auth.uid()
    )
  );

-- Templates are CRUDed straight from the browser under RLS, like leads. A
-- template is visible to its owner, or to the whole org when shared.
create policy sd_email_templates_private on sd_email_templates for all
  using (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_email_templates.org_id and g.enabled)
    and (owner_user_id = auth.uid() or visibility = 'org')
  )
  with check (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_email_templates.org_id and g.enabled)
    and owner_user_id = auth.uid()
  );

-- Examples check their parent template the way sd_mail_messages checks its thread.
create policy sd_email_template_examples_private on sd_email_template_examples for all
  using (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_email_template_examples.org_id and g.enabled)
    and exists (
      select 1 from sd_email_templates t
      where t.id = sd_email_template_examples.template_id
        and t.org_id = sd_email_template_examples.org_id
        and (t.owner_user_id = auth.uid() or t.visibility = 'org')
    )
  )
  with check (
    exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_email_template_examples.org_id and g.enabled)
    and exists (
      select 1 from sd_email_templates t
      where t.id = sd_email_template_examples.template_id
        and t.org_id = sd_email_template_examples.org_id
        and t.owner_user_id = auth.uid()
    )
  );

create policy sd_email_drafts_private on sd_email_drafts for all
  using (
    owner_user_id = auth.uid()
    and exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_email_drafts.org_id and g.enabled)
    and exists (
      select 1 from sd_leads l
      where l.id = sd_email_drafts.lead_id
        and l.org_id = sd_email_drafts.org_id
        and l.owner_user_id = auth.uid()
    )
  )
  with check (
    owner_user_id = auth.uid()
    and exists (select 1 from sd_access_grants g where g.user_id = auth.uid() and g.org_id = sd_email_drafts.org_id and g.enabled)
    and exists (
      select 1 from sd_leads l
      where l.id = sd_email_drafts.lead_id
        and l.org_id = sd_email_drafts.org_id
        and l.owner_user_id = auth.uid()
    )
  );

-- "No send without approval" is a server-only invariant, not a UI convention:
-- the browser can read a draft but can never write the approval/send lifecycle.
-- The service-role client used by the API routes bypasses these grants.
--
-- A bare column-level REVOKE would be a no-op here, because Supabase grants
-- `authenticated` table-level UPDATE (which implies every column). The
-- table-level privilege is therefore withdrawn first and re-granted column by
-- column, leaving status/approval/send columns unreachable from the browser.
revoke update on table sd_email_drafts from authenticated;
grant update (
  org_id,
  owner_user_id,
  lead_id,
  gmail_connection_id,
  recipient_email,
  subject,
  body,
  pipeline_stage_snapshot,
  template_ids,
  example_ids,
  research_id,
  research_revision,
  used_source_ids,
  reasoning_summary,
  suggested_follow_up_days,
  source_thread_id,
  stale_research,
  model,
  generated_by,
  last_error,
  updated_at
) on table sd_email_drafts to authenticated;
grant all on table sd_email_drafts to service_role;
grant all on table sd_lead_company_research to service_role;
