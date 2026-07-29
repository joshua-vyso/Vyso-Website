-- ############################################################################
-- ##
-- ##  MERIDIAN FOOD CO.  —  complete demo workspace for demo@vyso.co.za
-- ##  Stellenbosch, Western Cape  ·  ~R5.5M revenue / month  ·  45 staff
-- ##
-- ############################################################################
--
-- WHAT THIS IS
--   ONE self-contained SQL script that builds a full, cross-consistent demo
--   workspace for the login demo@vyso.co.za: organisation, 32 stock lines,
--   14 suppliers, 28 customers, 45 employees over 8 departments, 490 orders
--   (458 realised), 458 invoices, 336 waste events, a PlanWise plan, a
--   PricePilot catalogue, a SupplySync scorecard set and an InsightGen feed.
--
--   Meridian Food Co. is deliberately AMBIGUOUS: it reads equally as a
--   restaurant group, a wholesaler, a catering business or a farm/producer.
--   It grows and produces, supplies trade customers, runs events/catering and
--   operates a counter. Product, customer, supplier and department names are
--   segment-neutral on purpose — never "restaurant", "farm" or "shop".
--
-- PREREQUISITE (do this yourself — this script cannot create auth accounts):
--   Supabase dashboard -> Authentication -> Users -> Add user
--     email: demo@vyso.co.za   password: 1234   (tick "Auto Confirm User")
--   On the live Vyso project this user ALREADY EXISTS — nothing to do.
--
-- IMPORTANT — WHAT THIS CHANGES ABOUT THE EXISTING DEMO
--   demo@vyso.co.za currently lands in the older "produce distributor" demo
--   organisation, "Fresh Valley Produce". Section 0 RE-POINTS that profile's
--   org_id at Meridian Food Co. via the same `on conflict (id) do update`
--   idiom used by the previous bootstrap, and section 0.9 then DELETES Fresh
--   Valley Produce outright — every row it owns across 101 org-scoped tables,
--   then the organisation row itself. This is DESTRUCTIVE and deliberate: the
--   old demo org has no login left after 0.3, so leaving it behind would only
--   orphan its data. To get it back, re-run supabase/demo-fresh-valley/*.sql
--   from 0-bootstrap.sql onwards. (Read section 0.9's own header before you
--   run this on anything other than the demo project.)
--
--   Fresh Valley is resolved BY NAME, never by UUID — its bootstrap creates it
--   with gen_random_uuid(), so its id differs on every database.
--
-- HOW TO APPLY
--   Paste the whole file into the Supabase SQL editor and run it once.
--   It is IDEMPOTENT and RE-RUNNABLE: every schema statement is
--   `create table if not exists` / `add column if not exists`, and every seed
--   block opens with a delete preamble scoped to the literal Meridian org
--   UUID '01000000-7e5d-4c1a-9b3f-000000000001' — children before parents.
--   Section 0.9 is re-runnable too: once Fresh Valley is gone it is a no-op.
--   No `drop table`, no `truncate`, no `alter table ... drop column`.
--   The single permitted mutation of an existing object is the org_features
--   check-constraint rewrite in section 0 (copied from the previous bootstrap).
--   Section 0.9 is the ONLY part of this file that deletes anything belonging
--   to an organisation other than Meridian, and it touches exactly one.
--
-- CONVENTIONS
--   * All money in ZAR. No other currency appears anywhere.
--   * Every row carries an explicit, deterministic UUID of the form
--       GG000000-7e5d-4c1a-9b3f-NNNNNNNNNNNN
--     where GG is a two-hex group code (02 = stock items, 04 = suppliers,
--     05 = customers, 06 = employees, 0a = orders, ...) and N is a 12-digit
--     zero-padded counter. No gen_random_uuid() for any shared entity, so
--     re-runs are stable and every cross-module FK resolves by construction.
--   * Anchor date is Wed 2026-07-29 (SAST). Absolute date literals are used
--     wherever a total depends on them; `current_date - N` only where a row is
--     deliberately age-relative (credit ages, rebate windows, doc expiries).
--
-- FILE LAYOUT
--   0.  Bootstrap ........... organisation, profile re-point, org_features
--   0.9 Purge ............... delete the previous demo org "Fresh Valley
--                             Produce" and every row it owns (99 org-scoped
--                             tables + org_features + the organisations row),
--                             resolved by name, guarded, re-runnable
--   1.  Schemas ............. 12 module schema files, inlined verbatim
--                             (1.12 = docu-review-columns.sql, the Doc-U
--                              review-queue columns on `documents`)
--   2.  Seeds ............... six domain fragments in FK dependency order:
--         2a  ProcurePulse part A ... suppliers, stock items, thresholds,
--                                     units, item-suppliers, settings
--         2b  OrderFlow + Core ...... customers, contacts, addresses, terms,
--                                     orders, invoices, payments, credit &
--                                     delivery notes, quotes, activity
--         2c  PricePilot ........... targets, price lists, overrides,
--                                     versions, complaints
--         2d  ProcurePulse part B ... recipes, movements, stock orders,
--                                     reorder requests, aliases, activity,
--                                     Doc-U folders + documents, notifications
--         2e  SupplySync ........... profiles, contacts, documents, pricing,
--                                     risks, history, aliases, credits,
--                                     rebates + receipts; InsightGen insights,
--                                     reports, runs, anomaly acks
--         2f  ShiftBoard .......... departments, employees, roster,
--                                     attendance, leave, shift swaps
--         2g  WasteWatch + PlanWise  categories, devices, waste events;
--                                     budget lines, goals, forecast,
--                                     scenarios, decisions
--   3.  Verification ........ read-only queries + the computed totals
--
-- OUT OF SCOPE
--   ServiceDen (sd_*) is intentionally NOT seeded: it is email-gated to Vyso's
--   internal account and never renders for a demo organisation.
-- ############################################################################


-- ##########################################################################
-- ##  SECTION 0 — BOOTSTRAP
-- ##  organisation + profile re-point + org_features
-- ##########################################################################

-- ---------------------------------------------------------------------------
-- 0.1  The organisation. Idempotent by id (the fixed blueprint UUID) so that a
--      re-run updates in place instead of creating a second Meridian.
--      `tier 'scale'` is the top OrgTier — matches what the platform expects
--      for a fully-featured workspace.
-- ---------------------------------------------------------------------------
insert into organisations (id, name, slug, location, tier)
values ('01000000-7e5d-4c1a-9b3f-000000000001', 'Meridian Food Co.',
        'meridian-food-co', 'Stellenbosch, Western Cape', 'scale')
on conflict (id) do update
  set name     = excluded.name,
      slug     = excluded.slug,
      location = excluded.location,
      tier     = excluded.tier;

-- NOTE: nothing here reconciles a slug collision. If some OTHER organisation
-- already holds the slug 'meridian-food-co', this insert fails loudly instead
-- of quietly renaming a row that does not belong to this demo. That is
-- deliberate: no statement in this file may modify another organisation.

-- ---------------------------------------------------------------------------
-- 0.2  Onboarding / trial columns. GUARDED, because these columns arrive with
--      additive migrations (onboarding.sql, org-locked-modules.sql) that an
--      older database may not have applied yet.
--
--      WHY THESE EXACT VALUES (verified in app code — do not "improve" them):
--        * app/app/layout.tsx redirects to /onboarding when
--          org.onboarding_completed_at is null. It MUST be a real timestamp or
--          the demo login lands in the setup wizard instead of the platform.
--        * computeTrial() in lib/platform/supabase-server.ts returns null when
--          either trial_started_at or trial_ends_at is falsy. TrialGate only
--          blocks on trial.expired and TopBar only renders the countdown pill
--          when trial is non-null — so leaving BOTH null is the only state that
--          guarantees no gate and no permanent "N days left" pill.
--        * locked_modules '{}' keeps every module openable.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'organisations'
               and column_name = 'onboarding_completed_at') then
    update organisations set
      industry                = 'Food production & distribution',
      employee_count          = '21-50',
      onboarding_stage        = 'done',
      onboarding_completed_at = now() - interval '120 days',
      trial_started_at        = null,
      trial_ends_at           = null
    where id = '01000000-7e5d-4c1a-9b3f-000000000001';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'organisations'
               and column_name = 'locked_modules') then
    update organisations set locked_modules = '{}'
    where id = '01000000-7e5d-4c1a-9b3f-000000000001';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 0.3  Re-point the demo login's profile at Meridian.
--
--      This is the ONLY statement in the whole file that touches anything
--      outside the Meridian org, and it touches exactly one row: the profile
--      of demo@vyso.co.za. It moves which organisation that login opens into.
--      The organisation it previously pointed at, and every row belonging to
--      it, are left untouched — no delete in this file is unscoped, and none
--      of them reference any organisation other than Meridian.
--
--      Works whether or not a profile row was auto-created on signup, and is a
--      no-op if the auth user does not exist yet (see PREREQUISITE above).
-- ---------------------------------------------------------------------------
insert into profiles (id, org_id, full_name, role)
select u.id, '01000000-7e5d-4c1a-9b3f-000000000001'::uuid, 'Demo Owner', 'owner'
from auth.users u
where u.email = 'demo@vyso.co.za'
on conflict (id) do update set org_id = excluded.org_id;

-- ---------------------------------------------------------------------------
-- 0.4  Enable every module for the org, so the workspace works even after the
--      temporary force-all-features flag is removed from getPlatformSession().
--
--      The check constraint is dropped and re-added first because older
--      databases carry a narrower version that rejects some of the nine keys.
--      This is the one schema mutation of a pre-existing object this file is
--      permitted to make, and it is byte-for-byte the idiom already used by
--      the previous demo bootstrap. The nine keys are exactly FEATURE_KEYS in
--      lib/platform/types.ts — all nine, all enabled.
-- ---------------------------------------------------------------------------
alter table org_features drop constraint if exists org_features_feature_key_check;
alter table org_features add constraint org_features_feature_key_check
  check (feature_key in ('docu','procurepulse','pricepilot','marginview','wastelog',
                         'shiftboard','suppliers','orderflow','reportgen'));

insert into org_features (org_id, feature_key, enabled)
select '01000000-7e5d-4c1a-9b3f-000000000001'::uuid, f.k, true
from (values ('docu'),('procurepulse'),('pricepilot'),('marginview'),('wastelog'),
             ('shiftboard'),('suppliers'),('orderflow'),('reportgen')) as f(k)
where not exists (
  select 1 from org_features e
  where e.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
    and e.feature_key = f.k);

-- Any module row that already existed but was switched off gets switched on.
update org_features set enabled = true
where org_id = '01000000-7e5d-4c1a-9b3f-000000000001' and enabled is distinct from true;

-- ##########################################################################
-- ##  SECTION 0.9 — PURGE "FRESH VALLEY PRODUCE"
-- ##  Remove the previous demo organisation and every row that belongs to it.
-- ##########################################################################
--
-- WHY THIS EXISTS
--   Sections 0.1-0.4 above create Meridian Food Co. and re-point the
--   demo@vyso.co.za profile at it. That leaves the OLD demo organisation,
--   "Fresh Valley Produce" (supabase/demo-fresh-valley/*.sql), sitting in the
--   database as orphaned data: it no longer has a login, but its suppliers,
--   documents, invoices and stock lines still show up in cross-org admin
--   views, still consume unique slugs/codes, and still muddy any global
--   count. This section deletes it outright.
--
-- HOW THE ORG IS RESOLVED — NEVER BY UUID
--   demo-fresh-valley/0-bootstrap.sql creates the org with
--   `insert into organisations (name, slug, ...) select 'Fresh Valley Produce'
--   ... where not exists (select 1 from organisations where name = ...)` —
--   i.e. with a gen_random_uuid() primary key. Its id therefore DIFFERS on
--   every database it was ever applied to. Hard-coding a UUID here would
--   silently purge nothing on most deployments, or — far worse — purge some
--   unrelated organisation on one. So the id is resolved dynamically, by
--   name, exactly the way that bootstrap resolves it, and the resolved value
--   is the ONLY thing any delete below is keyed on.
--
-- IDEMPOTENT / SAFE TO RE-RUN
--   The whole section is a single DO block whose body is a
--   `for v_fv in select id from organisations where name = 'Fresh Valley
--   Produce'` loop. On a database where Fresh Valley never existed, or where
--   a previous run already removed it, the loop body never executes and the
--   section is a clean no-op that emits one notice.
--
-- WHY EVERY DELETE IS GUARDED
--   This section runs BEFORE section 1, which is where sb_*, ww_*, pw_*,
--   ss_*, ig_* and supplier_aliases are created. On a database that has not
--   had those migrations applied yet, those tables do not exist at the moment
--   this section runs. The same is true of the modules this deployment may
--   never have installed at all (sd_*, xero_*, email_ingest_*). An unguarded
--   `delete from sb_departments` would therefore abort the entire script with
--   42P01 before a single schema statement had run. Each table is checked
--   with to_regclass + an org_id-column lookup first, and the delete itself
--   additionally sits in a sub-block that traps undefined_table /
--   undefined_column, so nothing in this section can ever abort the file.
--
-- ORDERING
--   v_purge is ordered child -> parent within each module, and modules are
--   ordered so that a table is always emptied before anything it is the
--   parent of. Almost every org-scoped FK in this schema is
--   `on delete cascade` to organisations and every inter-table FK is CASCADE
--   or SET NULL (verified against supabase/*.sql +
--   supabase/demo-fresh-valley/*.sql), so ordering is belt-and-braces rather
--   than strictly required — but it means the explicit deletes never depend
--   on cascade behaviour that a drifted live schema might not have.
--
-- WHAT IS DELETED WITHOUT BEING NAMED
--   sd_gmail_credentials has no org_id of its own; it is
--   `on delete cascade` from sd_gmail_connections and goes with it.
--   api_rate_limits is not org-scoped and is deliberately left alone.
--
-- RLS
--   Every table here has row level security ENABLED with an org-scoped policy,
--   but no table in this repo uses FORCE ROW LEVEL SECURITY — so the table
--   owner (the `postgres` role the Supabase SQL editor runs as) bypasses the
--   policies and these deletes see every row. Run this section as the SQL
--   editor / service role, never as an end-user JWT, or it will quietly
--   delete nothing.
-- ---------------------------------------------------------------------------
do $$
declare
  v_fv        uuid;
  v_tbl       text;
  v_rows      bigint;
  v_total     bigint := 0;
  v_hit       int    := 0;   -- tables that actually gave up rows
  v_absent    int    := 0;   -- tables not present / not org-scoped here
  v_detail    text;
  v_con       text;
  v_found     boolean := false;

  -- Every org-scoped table in the platform, child -> parent.
  v_purge constant text[] := array[
    -- OrderFlow: line items, then documents, then the customers they hang off
    'of_credit_note_items', 'of_credit_notes',
    'of_delivery_note_items', 'of_delivery_notes',
    'of_payments',
    'of_invoice_items', 'of_invoices',
    'of_quote_requests', 'of_quote_items', 'of_quotes',
    'of_order_items', 'of_orders',
    'of_activity', 'of_settings', 'of_customers',
    -- Core data
    'cd_customer_item_aliases', 'cd_contacts', 'cd_delivery_addresses',
    'cd_doc_templates', 'cd_payment_terms', 'cd_vat_rates',
    'cd_company_profile',
    -- PricePilot
    'pl_overrides', 'pl_complaints', 'pl_price_list_versions',
    'pl_price_lists', 'pl_targets',
    -- ProcurePulse: everything that points at pp_stock_items, then the items
    'pp_recipe_ingredients', 'pp_recipes',
    'pp_stock_order_items', 'pp_stock_orders',
    'pp_reorder_requests', 'pp_name_aliases', 'pp_product_units',
    'pp_stock_thresholds', 'procurepulse_activity_events',
    'pp_movements', 'pp_item_suppliers', 'pp_notifications', 'pp_settings',
    'pp_stock_items',
    -- Doc-U
    'documents', 'document_folders',
    -- SupplySync + the shared supplier tables it links to
    'ss_supplier_rebate_receipts', 'ss_supplier_rebates',
    'ss_supplier_credits', 'ss_supplier_contacts', 'ss_supplier_documents',
    'ss_supplier_history', 'ss_supplier_pricing', 'ss_supplier_risks',
    'ss_suppliers', 'supplier_aliases', 'suppliers',
    -- InsightGen
    'ig_anomaly_acks', 'ig_report_runs', 'ig_reports', 'ig_insights',
    -- ShiftBoard
    'sb_shift_swaps', 'sb_attendance', 'sb_leave_requests',
    'sb_roster_shifts', 'sb_employees', 'sb_departments',
    -- WasteWatch
    'ww_waste_events', 'ww_devices', 'ww_waste_categories',
    -- PlanWise
    'pw_decisions', 'pw_scenarios', 'pw_forecast', 'pw_goals',
    'pw_budget_lines',
    -- Email ingest
    'email_ingest_senders', 'email_ingest_addresses', 'email_ingests',
    -- Xero integration
    'xero_sync_events', 'xero_sync_cursors', 'xero_entity_mappings',
    'xero_oauth_states', 'xero_connections',
    'xero_credentials', 'xero_authorisations',
    -- ServiceDen (never seeded for a demo org, but purged if it has rows)
    'sd_email_drafts', 'sd_email_template_examples', 'sd_email_templates',
    'sd_lead_activities', 'sd_leads', 'sd_lead_company_research',
    'sd_mail_messages', 'sd_mail_threads',
    'sd_invoice_items', 'sd_invoices', 'sd_customers', 'sd_services',
    'sd_access_grants', 'sd_gmail_oauth_states', 'sd_gmail_connections',
    'sd_settings',
    -- Cross-cutting
    'feedback'
  ];
begin
  for v_fv in
    select id from organisations where name = 'Fresh Valley Produce'
  loop
    v_found := true;
    raise notice '0.9  purging previous demo organisation % ...', v_fv;

    foreach v_tbl in array v_purge
    loop
      -- Table missing entirely (section 1 has not run yet / module never
      -- installed), or present but not org-scoped on this deployment.
      if to_regclass('public.' || v_tbl) is null
         or not exists (select 1
                          from pg_attribute
                         where attrelid = to_regclass('public.' || v_tbl)
                           and attname  = 'org_id'
                           and attnum   > 0
                           and not attisdropped)
      then
        v_absent := v_absent + 1;
      else
        begin
          execute format('delete from public.%I where org_id = $1', v_tbl)
            using v_fv;
          get diagnostics v_rows = row_count;
          if v_rows > 0 then
            v_total := v_total + v_rows;
            v_hit   := v_hit + 1;
            raise notice '0.9    % % row(s)', rpad(v_tbl, 32), v_rows;
          end if;
        exception
          -- Belt-and-braces: the checks above already skip a missing table,
          -- this catches a table dropped between the check and the delete.
          when undefined_table or undefined_column then
            v_absent := v_absent + 1;
            raise notice '0.9    skipped % — %', v_tbl, sqlerrm;
        end;
      end if;
    end loop;

    -- Detach any profile still pointing at the old org. demo@vyso.co.za was
    -- already moved to Meridian in 0.3; this catches other test logins that
    -- were parked on Fresh Valley, and is what makes the organisations delete
    -- below possible at all.
    begin
      update profiles set org_id = null where org_id = v_fv;
      get diagnostics v_rows = row_count;
      if v_rows > 0 then
        raise notice '0.9    % profile(s) detached from the old org', v_rows;
      end if;
    exception
      when not_null_violation then
        raise notice '0.9    profiles.org_id is NOT NULL on this database — '
                     'profile(s) still on the old org must be re-pointed by '
                     'hand; skipping.';
    end;

    delete from org_features where org_id = v_fv;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      raise notice '0.9    % org_features row(s)', v_rows;
    end if;

    -- Finally the organisation row. If some table this section does not know
    -- about still references it, say which one instead of aborting the file:
    -- every other trace of the old org is gone by now, and the whole point of
    -- this script is the Meridian workspace built below.
    begin
      delete from organisations where id = v_fv;
      raise notice '0.9  done — organisation removed; % row(s) across % table(s); '
                   '% table(s) absent or not org-scoped here.',
                   v_total, v_hit, v_absent;
    exception
      when foreign_key_violation then
        get stacked diagnostics v_detail = pg_exception_detail,
                                v_con    = constraint_name;
        raise notice '0.9  organisation row KEPT — still referenced. %  '
                     '(constraint %). All % of its own row(s) across % table(s) '
                     'were deleted; add the blocking table to v_purge.',
                     coalesce(v_detail, '<no detail>'), coalesce(v_con, '?'),
                     v_total, v_hit;
    end;
  end loop;

  if not v_found then
    raise notice '0.9  no organisation named ''Fresh Valley Produce'' — '
                 'nothing to purge (clean no-op).';
  end if;
end $$;


-- ##########################################################################
-- ##  SECTION 1 — MODULE SCHEMAS (inlined verbatim)
-- ##  Every file below is `create table if not exists` / `add column if not
-- ##  exists` and is safe on a database that already has these objects.
-- ##
-- ##  INDEX
-- ##    1.1  demo-fresh-valley/1-shiftboard-schema.sql      sb_*
-- ##    1.2  demo-fresh-valley/2-wastewatch-schema.sql      ww_*
-- ##    1.3  demo-fresh-valley/3-planwise-schema.sql        pw_*
-- ##    1.4  demo-fresh-valley/4-supplysync-schema.sql      ss_*
-- ##    1.5  demo-fresh-valley/5-insightgen-schema.sql      ig_*
-- ##    1.6  supplysync-link.sql                            suppliers link
-- ##    1.7  ss-supplier-credits.sql                        ss_supplier_credits
-- ##    1.8  ss-supplier-rebates.sql                        ss_supplier_rebates
-- ##    1.9  demo-fresh-valley/1-shiftboard-swaps.sql       sb_shift_swaps
-- ##    1.10 demo-fresh-valley/10-planwise-decisions-schema.sql  pw_decisions
-- ##    1.11 demo-fresh-valley/5b-insightgen-runs-acks.sql  ig_report_runs/acks
-- ##    1.12 docu-review-columns.sql                        documents.*
-- ##
-- ##  1.12 is the odd one out: it is `alter table documents add column if not
-- ##  exists`, not a create. It fixes the live Review-queue failure
-- ##  "column documents.approved_at does not exist" (42703) — the review /
-- ##  star / AI-summary / archive code shipped without its migration. Still
-- ##  idempotent, still safe to re-run.
-- ##
-- ##  Tables assumed ALREADY PRESENT and therefore NOT created here:
-- ##  organisations, profiles, org_features, suppliers, documents,
-- ##  document_folders, pp_stock_items, pp_movements, pp_item_suppliers,
-- ##  pp_notifications, pp_settings, and everything created by core-data.sql,
-- ##  orderflow-schema.sql, pricepilot-schema.sql, pl-targets.sql,
-- ##  pl-validity.sql, pp-*.sql, rebates.sql, onboarding.sql,
-- ##  org-locked-modules.sql, quote-requests.sql, customer-ai-invoicing.sql.
-- ##########################################################################


-- ===========================================================================
-- 1.1  supabase/demo-fresh-valley/1-shiftboard-schema.sql
--      sb_departments / sb_employees / sb_roster_shifts / sb_attendance / sb_leave_requests
-- ===========================================================================

-- ShiftBoard data model: people-operations command centre for Vyso.
-- Mirrors lib/platform/shiftboard.ts: Department, Employee, RosterRow/Shift,
-- AttendanceRecord, LeaveRequest. Org-scoped RLS, mirroring the existing
-- of_*/pp_* tables. Idempotent. Paste into the Supabase SQL editor.
--
-- Device/recipe/task columns on sb_employees are the WasteWatch foundation:
-- a scale needs to know who is using it, in which department, on which recipe.

-- ---------------------------------------------------------------------------
-- Departments — the 7 from SPEC.departments, with target headcount + hex colour.
-- ---------------------------------------------------------------------------
create table if not exists sb_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  required int not null default 0,   -- target headcount "right now"
  color text not null,               -- hex, e.g. #0C447C
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_departments_org on sb_departments (org_id, name);

-- ---------------------------------------------------------------------------
-- Employees — mirrors the Employee interface. skills jsonb is keyed by the 7
-- SKILL_NAMES (rating 0–5). available_days / unavailable_days / devices are
-- jsonb arrays. Live-ops device columns populated only when Working.
-- ---------------------------------------------------------------------------
create table if not exists sb_employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  role text not null,
  department text not null,                    -- FK-by-name to sb_departments.name
  status text not null default 'Scheduled',    -- Working|On break|Scheduled|Off|On leave|Absent
  next_shift text,
  shift_time text,                             -- current/next window e.g. '08:00–16:00'
  hours_this_week numeric not null default 0,
  contracted_hours numeric not null default 0,
  rate numeric not null default 0,             -- ZAR / hour
  attendance_score int not null default 0,     -- 0–100 (seeded 70–99)
  leave_balance numeric not null default 0,    -- days
  skills jsonb not null default '{}'::jsonb,    -- { "Receiving": 0..5, ... } for the 7 SKILL_NAMES
  available_days jsonb not null default '[]'::jsonb,
  unavailable_days jsonb not null default '[]'::jsonb,
  preferred_shifts text,
  devices jsonb not null default '[]'::jsonb,   -- recent assigned device names (drawer)
  -- Live-ops / WasteWatch device foundation (populated when Working on a device):
  current_department text,
  current_task text,
  current_recipe text,
  assigned_device text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_employees_org on sb_employees (org_id, name);

-- ---------------------------------------------------------------------------
-- Roster — one row per employee, a 7-day weekly pattern as a jsonb `days` array
-- of cells { time, department, status, conflict? }. open_shifts holds the
-- week's unfilled shifts (jsonb array), repeated per row so a single fetch of
-- one row yields the RosterWeek. label is the week heading.
-- ---------------------------------------------------------------------------
create table if not exists sb_roster_shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  employee_id uuid references sb_employees(id) on delete cascade,
  name text not null,
  role text not null,
  department text not null,
  label text not null default '',              -- e.g. 'Week of 30 Jun'
  days jsonb not null default '[]'::jsonb,      -- 7 cells: {time,department,status,conflict?}
  open_shifts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_roster_shifts_org on sb_roster_shifts (org_id, name);

-- ---------------------------------------------------------------------------
-- Attendance — one row per employee rostered today (clock in/out, hours, status,
-- overtime). Mirrors AttendanceRecord.
-- ---------------------------------------------------------------------------
create table if not exists sb_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  employee_id uuid references sb_employees(id) on delete cascade,
  name text not null,
  department text not null,
  scheduled text not null,                     -- '08:00–16:00'
  clock_in text,                               -- null = not clocked in
  clock_out text,                              -- null = still on shift
  hours_worked numeric not null default 0,
  status text not null default 'On time',      -- On time|Late|Absent|Early leave|Overtime|Manual review
  overtime numeric not null default 0,         -- hours
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_attendance_org on sb_attendance (org_id, department);

-- ---------------------------------------------------------------------------
-- Leave requests — mirrors LeaveRequest with coverage_impact + coverage_risk.
-- ---------------------------------------------------------------------------
create table if not exists sb_leave_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  employee_id uuid references sb_employees(id) on delete cascade,
  name text not null,
  department text not null,
  type text not null,                          -- Annual leave|Sick leave|Family responsibility|Unpaid
  start_label text not null,                   -- '3 Jul', 'Fri 4 Jul'
  end_label text not null,
  start_date date,                             -- natural sort key
  days numeric not null default 0,
  coverage_impact text,
  coverage_risk text not null default 'none',  -- none|low|high
  status text not null default 'Pending',      -- Pending|Approved|Declined
  created_at timestamptz not null default now()
);
create index if not exists idx_sb_leave_requests_org on sb_leave_requests (org_id, start_date);

-- ---------------------------------------------------------------------------
-- Row level security: each org only sees its own rows (same shape as of_*/pp_*).
-- ---------------------------------------------------------------------------
alter table sb_departments    enable row level security;
alter table sb_employees      enable row level security;
alter table sb_roster_shifts  enable row level security;
alter table sb_attendance     enable row level security;
alter table sb_leave_requests enable row level security;

drop policy if exists sb_departments_all    on sb_departments;
drop policy if exists sb_employees_all       on sb_employees;
drop policy if exists sb_roster_shifts_all   on sb_roster_shifts;
drop policy if exists sb_attendance_all       on sb_attendance;
drop policy if exists sb_leave_requests_all   on sb_leave_requests;

create policy sb_departments_all on sb_departments for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_employees_all on sb_employees for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_roster_shifts_all on sb_roster_shifts for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_attendance_all on sb_attendance for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy sb_leave_requests_all on sb_leave_requests for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ===========================================================================
-- 1.2  supabase/demo-fresh-valley/2-wastewatch-schema.sql
--      ww_waste_categories / ww_devices / ww_waste_events
-- ===========================================================================

-- WasteWatch data model: waste categories, measuring devices, and waste events.
-- Org-scoped RLS, mirroring the existing of_*/pp_* tables. Columns mirror the
-- TS shapes in lib/platform/wastewatch.ts so the module can fetch 1:1.
-- Idempotent. Paste into the Supabase SQL editor.

-- Configurable waste categories (one row per category, each with a hex colour).
-- Mirrors WasteCategory + CategoryStat (cost / pct / trend) in the TS module.
create table if not exists ww_waste_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  -- hex colour used for charts/legends, e.g. '#0F6E56'
  color text not null,
  cost numeric not null default 0,
  pct numeric not null default 0,
  -- 7-point sparkline of recent cost contribution
  trend jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ww_waste_categories_org on ww_waste_categories (org_id, sort_order);

-- Measuring devices. Nested/array fields are jsonb (current_operator, current_recipe,
-- measurements, history) mirroring the Device interface.
create table if not exists ww_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  -- Bluetooth Scale | Bench Scale | Floor Scale | Kitchen Scale | IoT Sensor | Barcode Station | Camera Station | Custom Device
  type text not null,
  location text not null,
  -- online | offline | calibrating | attention
  status text not null default 'online',
  -- null for mains-powered devices (e.g. camera stations)
  battery int,
  last_sync text,
  firmware text,
  calibration text,
  events_today int not null default 0,
  -- DeviceAssignment { name, role, startedAt, shift } or null
  current_operator jsonb,
  -- DeviceRecipe { name, expected[], currentWaste? } or null
  current_recipe jsonb,
  -- DeviceMeasurement[] { time, item, qty, unit }
  measurements jsonb not null default '[]'::jsonb,
  -- DeviceHistoryEvent[] { kind, label, time }
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_ww_devices_org on ww_devices (org_id, name);

-- Waste events. Mirrors WasteEvent: item/category/qty/unit/cost/reason plus
-- the employee/device/location context and ProcurePulse linkage placeholders.
create table if not exists ww_waste_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  event_date date not null,
  event_time text,
  item text not null,
  -- references ww_waste_categories.name (kept denormalised for 1:1 fetch)
  category text not null,
  qty numeric not null default 0,
  -- kg | units | crates | L
  unit text not null,
  cost numeric not null default 0,
  -- Spoiled | Expired | Wilted | Day-old | Over-portioned | Damaged | Trim | Prep error | Other
  reason text not null,
  recipe text,
  employee text not null,
  device text not null,
  location text not null,
  preventable boolean not null default false,
  notes text,
  -- ProcurePulse-integration placeholders
  ingredient text,
  supplier text,
  batch text,
  expected_qty numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_ww_waste_events_org on ww_waste_events (org_id, event_date desc);

-- Row level security: each org only sees its own rows (same shape as of_*/pp_*).
alter table ww_waste_categories enable row level security;
alter table ww_devices          enable row level security;
alter table ww_waste_events      enable row level security;

drop policy if exists ww_waste_categories_all on ww_waste_categories;
drop policy if exists ww_devices_all          on ww_devices;
drop policy if exists ww_waste_events_all      on ww_waste_events;

create policy ww_waste_categories_all on ww_waste_categories for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ww_devices_all on ww_devices for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ww_waste_events_all on ww_waste_events for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ===========================================================================
-- 1.3  supabase/demo-fresh-valley/3-planwise-schema.sql
--      pw_budget_lines / pw_goals / pw_forecast / pw_scenarios
-- ===========================================================================

-- PlanWise data model: the strategic planning layer ("business GPS") for
-- budget lines, goals, the 12-month revenue forecast, and what-if scenarios.
-- Columns mirror the TS shapes in lib/platform/planwise.ts (BudgetRow,
-- GoalSummary, ForecastLine, Scenario) so the module can fetch them 1:1.
-- Org-scoped RLS, mirroring the existing of_*/pp_*/pl_* tables. Idempotent.
-- Paste into the Supabase SQL editor and run once.

-- Budget lines: one row per spend/revenue category (BudgetRow).
create table if not exists pw_budget_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  cat text not null,                       -- category label (Revenue, COGS, Labour, …)
  budgeted numeric not null default 0,     -- planned amount (ZAR / month)
  actual numeric not null default 0,       -- actual amount (ZAR / month)
  profit_impact numeric not null default 0,-- signed rand impact vs plan (under = +, over = −)
  suggested_action text,                   -- human-readable next step
  module text,                             -- VysoModuleKey that can act on this line ("Review →")
  color text,                              -- hex swatch for the UI
  sort_order int not null default 0,       -- display order
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_budget_lines_org on pw_budget_lines (org_id, sort_order);

-- Goals: target vs current for each strategic KPI (GoalSummary).
create table if not exists pw_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  goal_key text not null,                  -- stable id ('rev','margin','waste','labour',…)
  label text not null,
  target numeric not null,
  current numeric not null,
  unit text not null default 'R',          -- 'R' | '%'
  higher_is_better boolean not null default true,
  module text,                             -- VysoModuleKey responsible for closing the gap
  trend jsonb not null default '[]'::jsonb,-- number[] recent values for the sparkline
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_goals_org on pw_goals (org_id, sort_order);

-- Forecast: the headline forecast lines + the 12-month revenue series.
-- `series` holds the SPEC.revenueSeriesMillions split into actual + projected
-- as jsonb: [{ month, value, kind:'actual'|'projected' }].
create table if not exists pw_forecast (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  forecast_key text not null,              -- stable id ('rev','exp','profit','cash')
  label text not null,
  value numeric not null,                  -- point forecast (ZAR)
  target numeric not null,
  range_low numeric not null,
  range_high numeric not null,
  confidence int not null default 0,       -- 0–100
  trend text not null default 'flat',      -- 'up' | 'down' | 'flat'
  tone text not null default 'neutral',    -- 'positive' | 'warning' | 'critical' | 'neutral'
  data jsonb not null default '[]'::jsonb, -- number[] short trailing sparkline
  series jsonb not null default '[]'::jsonb,-- 12-month [{month,value,kind}] (revenue line only)
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_forecast_org on pw_forecast (org_id, sort_order);

-- Scenarios: saved what-if builders (Scenario). `sliders` is the SliderValues
-- input set; `projected` is the cached ScenarioResult outcome.
create table if not exists pw_scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  scenario_key text not null,              -- stable id ('A','B','C')
  title text not null,
  description text not null,
  assumption text not null,
  sliders jsonb not null default '{}'::jsonb,  -- { revenueGrowth, expenseReduction, marginImprovement, wasteReduction, invoiceRecovery }
  projected jsonb not null default '{}'::jsonb,-- { revenue, expenses, profit, cash, runwayMonths, diffVsCurrent }
  risk text not null default 'Medium',     -- 'Low' | 'Medium' | 'High'
  probability int not null default 50,     -- 0–100
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_pw_scenarios_org on pw_scenarios (org_id, sort_order);

-- Row level security: each org only sees its own rows (same shape as of_*/pl_*).
alter table pw_budget_lines enable row level security;
alter table pw_goals        enable row level security;
alter table pw_forecast     enable row level security;
alter table pw_scenarios    enable row level security;

drop policy if exists pw_budget_lines_all on pw_budget_lines;
drop policy if exists pw_goals_all        on pw_goals;
drop policy if exists pw_forecast_all     on pw_forecast;
drop policy if exists pw_scenarios_all    on pw_scenarios;

create policy pw_budget_lines_all on pw_budget_lines for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pw_goals_all on pw_goals for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pw_forecast_all on pw_forecast for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy pw_scenarios_all on pw_scenarios for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ===========================================================================
-- 1.4  supabase/demo-fresh-valley/4-supplysync-schema.sql
--      ss_suppliers (+ intelligence columns) / _contacts / _documents / _pricing / _risks / _history
-- ===========================================================================

-- SupplySync data model: supplier INTELLIGENCE (not inventory) for a Cape Town
-- fresh-produce wholesaler. Org-scoped RLS, mirroring the existing of_*/pl_*
-- tables. Idempotent — safe to re-run. Paste into the Supabase SQL editor.
--
--   ss_suppliers            -- the supply base: scorecard, risk, status, spend, trends
--   ss_supplier_contacts    -- multiple contacts per supplier (sales/accounts/dispatch/…)
--   ss_supplier_documents   -- compliance docs per supplier (contract / coa / bee / …)
--   ss_supplier_pricing     -- pricing history visibility per item/category
--   ss_supplier_risks       -- risk register (missing docs, late delivery, volatility, …)
--   ss_supplier_history     -- relationship timeline + communication log + follow-ups

-- ---------------------------------------------------------------------------
-- Suppliers (base table already exists; this block also ADDs the intelligence
-- columns for anyone whose ss_suppliers predates the overhaul).
-- ---------------------------------------------------------------------------
create table if not exists ss_suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  category text not null,
  contact_name text,
  contact_phone text,
  contact_email text,
  status text not null default 'active',        -- preferred | active | review
  risk text not null default 'low',             -- low | medium | high
  rating numeric not null default 3,            -- 1-5 stars
  reliability int not null default 80,          -- component scores, 0-100
  quality int not null default 80,
  delivery_pct int not null default 85,
  on_time_pct int not null default 90,
  price_trend text not null default 'stable',   -- stable | rising | volatile
  lead_time_days int not null default 2,
  last_issue text,
  last_order date,
  spend_mtd numeric not null default 0,
  currency text not null default 'ZAR',
  notes jsonb not null default '[]'::jsonb,      -- [{ body, date, author }]
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_suppliers_org on ss_suppliers (org_id, name);

-- Intelligence columns (additive; no-op if already present).
alter table ss_suppliers add column if not exists overall_score int;                       -- 0-100 (null → derived)
alter table ss_suppliers add column if not exists price_stability int not null default 80;  -- 0-100
alter table ss_suppliers add column if not exists delivery_consistency int not null default 85;
alter table ss_suppliers add column if not exists responsiveness int not null default 85;
alter table ss_suppliers add column if not exists compliance_score int not null default 90;
alter table ss_suppliers add column if not exists avg_monthly_spend numeric not null default 0;
alter table ss_suppliers add column if not exists categories text[] not null default '{}';  -- produce lines supplied
alter table ss_suppliers add column if not exists market_position text not null default 'at'; -- below | at | above
alter table ss_suppliers add column if not exists late_deliveries int not null default 0;
alter table ss_suppliers add column if not exists quality_issues int not null default 0;
alter table ss_suppliers add column if not exists complaints int not null default 0;
alter table ss_suppliers add column if not exists response_hours numeric not null default 6;
alter table ss_suppliers add column if not exists reliability_trend jsonb not null default '[]'::jsonb; -- number[]
alter table ss_suppliers add column if not exists delivery_trend jsonb not null default '[]'::jsonb;    -- number[]
alter table ss_suppliers add column if not exists score_trend jsonb not null default '[]'::jsonb;       -- number[]
alter table ss_suppliers add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Contacts — multiple people per supplier.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references ss_suppliers(id) on delete cascade,
  name text not null,
  role text not null default 'Sales',           -- Sales | Accounts | Dispatch | Owner/Manager | After-hours
  email text,
  phone text,
  preferred_method text not null default 'Call',-- Call | WhatsApp | Email
  is_primary boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_contacts_supplier on ss_supplier_contacts (supplier_id, sort_order);
create index if not exists idx_ss_supplier_contacts_org on ss_supplier_contacts (org_id);

-- ---------------------------------------------------------------------------
-- Documents — compliance checklist per supplier.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references ss_suppliers(id) on delete cascade,
  doc_type text not null,                        -- contract | coa | bee-certificate | insurance | tax-clearance | food-safety | bank-confirmation | price-list
  label text not null,
  status text not null default 'valid',          -- valid | expiring | expired | missing
  expiry date,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_documents_org on ss_supplier_documents (org_id, expiry);
create index if not exists idx_ss_supplier_documents_supplier on ss_supplier_documents (supplier_id);

-- ---------------------------------------------------------------------------
-- Pricing — pricing-history visibility per item/category (SupplySync surfaces
-- pricing intelligence; actual purchasing stays in ProcurePulse).
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_pricing (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid not null references ss_suppliers(id) on delete cascade,
  item text not null,                            -- e.g. Oranges, Golden apples
  category text not null,                        -- e.g. Citrus, Pome Fruit
  unit text not null default 'kg',
  current_price numeric not null default 0,
  previous_price numeric not null default 0,
  market_avg numeric not null default 0,
  last_updated date,
  trend jsonb not null default '[]'::jsonb,       -- number[] mini-series
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_pricing_supplier on ss_supplier_pricing (supplier_id, sort_order);
create index if not exists idx_ss_supplier_pricing_org on ss_supplier_pricing (org_id, category);

-- ---------------------------------------------------------------------------
-- Risk register — one row per open risk; statuses are user-editable.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_risks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid references ss_suppliers(id) on delete cascade,
  risk_type text not null,                       -- Missing Document | Expiring Document | Late Delivery | Quality Issue | Price Volatility | Low Responsiveness | No Recent Update | Compliance Issue
  severity text not null default 'medium',       -- low | medium | high | critical
  description text not null default '',
  suggested_action text,
  owner text,
  status text not null default 'open',           -- open | in_progress | resolved | ignored
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_risks_org on ss_supplier_risks (org_id, status);
create index if not exists idx_ss_supplier_risks_supplier on ss_supplier_risks (supplier_id);

-- ---------------------------------------------------------------------------
-- Relationship history — timeline + communication log + follow-ups.
-- ---------------------------------------------------------------------------
create table if not exists ss_supplier_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  supplier_id uuid references ss_suppliers(id) on delete cascade,
  event_type text not null,                      -- document_uploaded | price_list_received | late_delivery | compliance_issue | marked_preferred | note_added | order_linked | call | whatsapp | email | meeting | price_update | document_request | complaint | delivery_issue
  channel text,                                  -- Call | WhatsApp | Email | Meeting | Price Update | Document Request | Complaint | Delivery Issue
  summary text not null default '',
  contact_name text,
  follow_up text,                                -- next action, if any
  follow_up_date date,
  follow_up_done boolean not null default false,
  owner text,
  event_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_ss_supplier_history_org on ss_supplier_history (org_id, event_date desc);
create index if not exists idx_ss_supplier_history_supplier on ss_supplier_history (supplier_id, event_date desc);

-- ---------------------------------------------------------------------------
-- Row level security: each org only sees its own rows (same shape as of_*/pl_*).
-- ---------------------------------------------------------------------------
alter table ss_suppliers          enable row level security;
alter table ss_supplier_contacts  enable row level security;
alter table ss_supplier_documents enable row level security;
alter table ss_supplier_pricing   enable row level security;
alter table ss_supplier_risks     enable row level security;
alter table ss_supplier_history   enable row level security;

drop policy if exists ss_suppliers_all          on ss_suppliers;
drop policy if exists ss_supplier_contacts_all   on ss_supplier_contacts;
drop policy if exists ss_supplier_documents_all  on ss_supplier_documents;
drop policy if exists ss_supplier_pricing_all     on ss_supplier_pricing;
drop policy if exists ss_supplier_risks_all       on ss_supplier_risks;
drop policy if exists ss_supplier_history_all      on ss_supplier_history;

create policy ss_suppliers_all on ss_suppliers for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_contacts_all on ss_supplier_contacts for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_documents_all on ss_supplier_documents for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_pricing_all on ss_supplier_pricing for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_risks_all on ss_supplier_risks for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ss_supplier_history_all on ss_supplier_history for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ===========================================================================
-- 1.5  supabase/demo-fresh-valley/5-insightgen-schema.sql
--      ig_insights / ig_reports
-- ===========================================================================

-- InsightGen data model: the cross-module AI insight / reporting brain.
-- ig_insights  = AI-generated findings drawn from every other module
-- ig_reports   = saved report definitions (which modules, schedule, last run)
-- Org-scoped RLS, mirroring the existing of_* / pp_* tables. Idempotent.
-- Paste into the Supabase SQL editor.

create table if not exists ig_insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- source module: docu | procurepulse | pricepilot | planwise | wastewatch |
  -- shiftboard | supplysync | orderflow
  source_module text not null,
  -- info | warning | critical | positive  (maps to the UI Tone)
  severity text not null default 'info',
  text text not null,
  -- headline metric for this insight, e.g. 'Waste cost' / '+12% wk/wk'
  metric_label text,
  metric_value text,
  -- true once the insight has been surfaced as an anomaly card
  is_anomaly boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_ig_insights_org on ig_insights (org_id, created_at desc);

create table if not exists ig_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  scope text,
  -- modules covered, e.g. ["pricepilot","orderflow"] or ["all"]
  modules jsonb not null default '[]'::jsonb,
  -- daily | weekly | monthly | manual
  schedule text not null default 'weekly',
  -- draft | ready | scheduled
  status text not null default 'ready',
  owner text,
  last_run timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ig_reports_org on ig_reports (org_id, last_run desc);

-- Row level security: each org only sees its own rows (same shape as of_* / pp_*).
alter table ig_insights enable row level security;
alter table ig_reports  enable row level security;

drop policy if exists ig_insights_all on ig_insights;
drop policy if exists ig_reports_all  on ig_reports;

create policy ig_insights_all on ig_insights for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

create policy ig_reports_all on ig_reports for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));


-- ===========================================================================
-- 1.6  supabase/supplysync-link.sql
--      ss_suppliers.supplier_id, supplier_aliases, ss_supplier_history.document_id
--      NOTE: this file ends with a back-fill (`insert into suppliers ... from
--      ss_suppliers` + `update ss_suppliers set supplier_id`) that is NOT
--      org-scoped. It is kept verbatim because it is the migration itself,
--      it is idempotent, and it is org-PRESERVING: it copies each row's own
--      org_id and only fills supplier_ids that are still null. It cannot
--      alter data belonging to another organisation, only complete a link
--      that organisation's own migration would have made anyway. At this
--      point Meridian has no ss_suppliers rows yet, so it is a no-op here.
-- ===========================================================================

-- ============================================================================
-- SupplySync ↔ Doc-U linking (docs/plans/docu-supplysync-invoice-linking.md).
--
-- Doc-U files documents against the core `suppliers` table, but SupplySync
-- reads its own `ss_suppliers` — two unrelated tables, so a scanned invoice
-- never reached the supplier's SupplySync profile. This migration:
--
--   1. bridges the identities  (ss_suppliers.supplier_id → suppliers.id)
--   2. adds `supplier_aliases` (org-scoped, human-confirmed name → supplier
--      rulings, mirroring the pp_name_aliases pattern)
--   3. makes the SupplySync history feed idempotent per document
--      (ss_supplier_history.document_id + unique index)
--   4. backfills: creates missing core suppliers for seeded ss_suppliers rows,
--      then links both directions by normalised name
--   5. adds the ss_* tables the app now writes to the Realtime publication
--   6. perf index for the per-supplier document queries
--
-- Idempotent — safe to re-run. Paste into the Supabase SQL editor.
-- Run AFTER the demo seeds if you use them (the backfill links seeded rows).
--
-- PREREQUISITE: the SupplySync base tables (ss_suppliers, ss_supplier_history)
-- must already exist. They are created by
-- supabase/demo-fresh-valley/4-supplysync-schema.sql, which is idempotent and
-- org-scoped by RLS — running it on a production database only creates the
-- empty tables, it seeds nothing. The guard below fails LOUDLY with this
-- instruction instead of a cryptic "relation does not exist" if it is skipped.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Prerequisite guard: the ss_* base schema must exist first.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.ss_suppliers') is null
     or to_regclass('public.ss_supplier_history') is null then
    raise exception using
      message = 'SupplySync base schema is missing.',
      hint = 'Run supabase/demo-fresh-valley/4-supplysync-schema.sql first (idempotent, org-scoped, seeds nothing), then re-run this migration.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Identity bridge: a SupplySync profile is an extension of a core supplier.
-- ---------------------------------------------------------------------------
alter table ss_suppliers
  add column if not exists supplier_id uuid references suppliers(id) on delete set null;

-- One profile per core supplier per org (nulls exempt: unbridged seed rows are fine).
create unique index if not exists idx_ss_suppliers_supplier_unique
  on ss_suppliers (org_id, supplier_id) where supplier_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Supplier-name aliases: durable, human-confirmed links between the messy
--    names extracted off documents and the canonical supplier. Confirming a
--    match in review records a row; future scans resolve instantly. Mirrors
--    pp_name_aliases.
-- ---------------------------------------------------------------------------
create table if not exists supplier_aliases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  raw_name text not null,                       -- the name as extracted
  normalized_name text not null,                -- lookup key (lowercased, cleaned)
  supplier_id uuid references suppliers(id) on delete cascade,
  -- confirmed → auto-link to supplier_id; dismissed → never auto-link this name
  status text not null default 'confirmed',     -- confirmed | dismissed
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, normalized_name)              -- one ruling per name per org
);

create index if not exists idx_supplier_aliases_org on supplier_aliases (org_id, status);

alter table supplier_aliases enable row level security;
drop policy if exists supplier_aliases_all on supplier_aliases;
create policy supplier_aliases_all on supplier_aliases for all
  using (org_id = (select p.org_id from profiles p where p.id = auth.uid()))
  with check (org_id = (select p.org_id from profiles p where p.id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Idempotent history feed: each document may add ONE timeline event of a
--    given type. Non-partial unique index — NULL document_id rows (seeds,
--    manual log entries) stay unconstrained because Postgres treats NULLs as
--    distinct. `on delete set null` keeps the timeline if a document is purged.
-- ---------------------------------------------------------------------------
alter table ss_supplier_history
  add column if not exists document_id uuid references documents(id) on delete set null;

create unique index if not exists idx_ss_supplier_history_doc_event
  on ss_supplier_history (document_id, event_type);

-- ---------------------------------------------------------------------------
-- 4. Backfill. Names match on lower(trim()); `suppliers` already carries a
--    per-org unique index on the lowered name, so matches are unambiguous.
-- ---------------------------------------------------------------------------

-- 4a. Seeded SupplySync profiles whose supplier doesn't exist yet in core →
--     create the core row (initials = first letters of the first two words).
--     distinct on (org_id, lower(trim(name))) so two profiles sharing a
--     normalised name insert ONE core supplier, not a pair that trips the
--     (org_id, lower(name)) unique index and aborts the whole migration.
insert into suppliers (org_id, name, initials)
select distinct on (ss.org_id, lower(trim(ss.name)))
       ss.org_id, trim(ss.name),
       upper(left(split_part(trim(ss.name), ' ', 1), 1) ||
             left(split_part(trim(ss.name), ' ', 2), 1))
from ss_suppliers ss
where ss.supplier_id is null
  and trim(ss.name) <> ''
  and not exists (
    select 1 from suppliers s
    where s.org_id = ss.org_id and lower(trim(s.name)) = lower(trim(ss.name))
  )
order by ss.org_id, lower(trim(ss.name)), ss.created_at;

-- 4b. Link every unbridged profile to its name-matched core supplier. Bridge
--     at most ONE profile per (org_id, supplier_id): the `pick` CTE keeps the
--     oldest unbridged profile per normalised name, so duplicate-named profiles
--     don't both claim one supplier and trip the partial unique index. It also
--     excludes suppliers already claimed by a bridged profile.
with pick as (
  select distinct on (ss.org_id, lower(trim(ss.name)))
         ss.id as ss_id, s.id as supplier_id
  from ss_suppliers ss
  join suppliers s
    on s.org_id = ss.org_id
   and lower(trim(s.name)) = lower(trim(ss.name))
  where ss.supplier_id is null
    and not exists (
      select 1 from ss_suppliers other
      where other.org_id = ss.org_id and other.supplier_id = s.id
    )
  order by ss.org_id, lower(trim(ss.name)), ss.created_at
)
update ss_suppliers ss
set supplier_id = pick.supplier_id
from pick
where ss.id = pick.ss_id;

-- ---------------------------------------------------------------------------
-- 5. Realtime on the tables the ingest pipeline now writes, so SupplySync
--    pages update live. RLS is enforced by Realtime (fails closed).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'ss_suppliers',         -- rollups (spend, last order) after a commit
    'ss_supplier_history'   -- the relationship timeline event per document
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

-- ---------------------------------------------------------------------------
-- 6. Per-supplier document queries (profile "From Doc-U" list + spend rollups).
-- ---------------------------------------------------------------------------
create index if not exists idx_documents_org_supplier
  on documents (org_id, supplier_id, created_at desc);


-- ===========================================================================
-- 1.7  supabase/ss-supplier-credits.sql
--      ss_supplier_credits (29-07)
-- ===========================================================================

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


-- ===========================================================================
-- 1.8  supabase/ss-supplier-rebates.sql
--      ss_supplier_rebates / ss_supplier_rebate_receipts (29-07)
-- ===========================================================================

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


-- ===========================================================================
-- 1.9  supabase/demo-fresh-valley/1-shiftboard-swaps.sql
--      sb_shift_swaps + realtime publication (29-07)
-- ===========================================================================

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


-- ===========================================================================
-- 1.10  supabase/demo-fresh-valley/10-planwise-decisions-schema.sql
--      pw_decisions (29-07)
-- ===========================================================================

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


-- ===========================================================================
-- 1.11  supabase/demo-fresh-valley/5b-insightgen-runs-acks.sql
--      ig_report_runs / ig_anomaly_acks (29-07)
-- ===========================================================================

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


-- ===========================================================================
-- 1.12  supabase/docu-review-columns.sql
--       documents.approved_at / approved_by / reviewed_* / archived_at /
--       ai_summary / starred — the Doc-U review-queue columns
-- ===========================================================================

-- Doc-U review-queue + document-lifecycle columns.
--
-- The review-queue feature (email documents that wait for a human Save/Discard) and
-- the star / AI-summary / archive actions all shipped as CODE that reads and writes
-- these columns, but the migration adding them to `documents` was never written. The
-- result was schema drift: the review query filters on `approved_at`, which did not
-- exist, so every load errored with 42703 and the page silently rendered
-- "Nothing to review" — while Save, Discard, and AI-summary writes failed the same way.
--
-- All idempotent (`add column if not exists`), so this is safe to run on any deployment,
-- and safe to re-run.

-- The review-queue claim/lock: a Save stamps approved_at (while still 'extracted') to
-- claim the row, then flips status to 'approved'. approved_by records who did it.
alter table documents
  add column if not exists approved_by uuid references profiles(id) on delete set null;
alter table documents
  add column if not exists approved_at timestamptz;

-- Discard: status → 'rejected', stamped with who/when.
alter table documents
  add column if not exists reviewed_by uuid references profiles(id) on delete set null;
alter table documents
  add column if not exists reviewed_at timestamptz;

-- Archive action (soft-hide from the active lists).
alter table documents
  add column if not exists archived_at timestamptz;

-- Cached AI operational summary (Doc-U "summary" feature).
alter table documents
  add column if not exists ai_summary jsonb;

-- Star toggle in the inbox.
alter table documents
  add column if not exists starred boolean not null default false;


-- ##########################################################################
-- ##  SECTION 2 — SEEDS
-- ##  Six domain fragments in strict FK dependency order. Each opens with a
-- ##  delete preamble scoped to the literal Meridian org UUID, children first,
-- ##  so the whole section is re-runnable. Nothing here is unscoped and nothing
-- ##  here references any other organisation.
-- ##########################################################################



-- ##########################################################################
-- ##  SECTION 2A
-- ##  ProcurePulse part A — suppliers, stock items, thresholds, units, item-suppliers, settings
-- ##  (apply order 1-2: everything the rest of the file's FKs resolve against)
-- ##########################################################################

-- ===========================================================================
-- DOMAIN (b) — ProcurePulse (stock intelligence) + Doc-U (documents)
-- Meridian Food Co. (Stellenbosch, Western Cape) demo seed fragment.
--
-- Covers, in the assembler's dependency order (supabase/demo-all-in-one.sql §13.4):
--   step 1 : suppliers            (core supplier register, group 04)
--   step 2 : pp_stock_items, pp_stock_thresholds, pp_product_units,
--            pp_item_suppliers, pp_settings
--   step 8 : pp_recipes(+ingredients), pp_movements, pp_stock_orders(+items),
--            pp_reorder_requests, pp_name_aliases, procurepulse_activity_events
--   step 9 : document_folders, documents, pp_notifications
--
-- The fragment is split into PART A (steps 1-2) and PART B (steps 8-9) so the
-- assembler can slot it around writers (a) and (c). EVERY delete lives in the
-- single preamble at the top of PART A, children before parents, so one re-run
-- clears the whole domain before anything is re-inserted.
--
-- All money in ZAR. Anchor date Wed 2026-07-29 (SAST). Nothing here references
-- any other organisation; every delete is scoped to the literal Meridian org UUID.
--
-- IDs: the blueprint's `GG000000-7e5d-4c1a-9b3f-<12-digit counter>` scheme,
-- built with `('GG000000-7e5d-4c1a-9b3f-' || lpad(n::text,12,'0'))::uuid` from an
-- explicit counter carried in each VALUES row. Never gen_random_uuid().
--
-- NO schema DDL — the assembler inlines the shared schema files ahead of this.
-- HOW TO APPLY: this is a fragment; run supabase/demo-all-in-one.sql instead.
-- ===========================================================================


-- ###########################################################################
-- PART A — assembly steps 1-2
-- ###########################################################################

-- ---------------------------------------------------------------------------
-- 0. Delete preamble — the WHOLE (b) domain, children first, scoped to the
--    Meridian org UUID only. `documents` goes before `document_folders` and
--    `suppliers` (it FKs both); every pp_* child goes before pp_stock_items.
-- ---------------------------------------------------------------------------
delete from pp_notifications              where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from procurepulse_activity_events  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from documents                     where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from document_folders              where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_name_aliases               where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_reorder_requests           where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_stock_order_items          where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_stock_orders               where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_recipe_ingredients         where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_recipes                    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_movements                  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_item_suppliers             where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_product_units              where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_stock_thresholds           where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_stock_items                where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pp_settings                   where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from suppliers                     where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 1. Core supplier register (`suppliers`, group 04) — 14 rows.
--    This is the table Doc-U files documents against (documents.supplier_id) and
--    the one SupplySync bridges to via ss_suppliers.supplier_id, so writer (f)
--    MUST reuse these exact ids for the same index. Names/categories are the
--    blueprint §4 roster; segment-neutral, all Western Cape.
--    `initials` is what the document list avatar renders.
-- ---------------------------------------------------------------------------
insert into suppliers (id, org_id, name, initials, location, contact_email)
select ('04000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.name, v.initials, v.location, v.contact_email
from (values
  ( 1, 'Bergriver Growers',                 'BG', 'Wellington, Western Cape',    'accounts@bergrivergrowers.co.za'),
  ( 2, 'Klipheuwel Farms',                  'KF', 'Klipheuwel, Western Cape',    'orders@klipheuwelfarms.co.za'),
  ( 3, 'Cape Cold Chain Supply',            'CC', 'Epping, Cape Town',           'sales@capecoldchain.co.za'),
  ( 4, 'Winelands Protein Co.',             'WP', 'Paarl, Western Cape',         'accounts@winelandsprotein.co.za'),
  ( 5, 'Boland Dry Goods',                  'BD', 'Worcester, Western Cape',     'invoices@bolanddrygoods.co.za'),
  ( 6, 'Swartland Grain & Mill',            'SG', 'Malmesbury, Western Cape',    'orders@swartlandgrain.co.za'),
  ( 7, 'Riebeek Oils & Fats',               'RO', 'Riebeek Kasteel, W. Cape',    'accounts@riebeekoils.co.za'),
  ( 8, 'Overberg Dairy Supply',             'OD', 'Caledon, Western Cape',       'sales@overbergdairy.co.za'),
  ( 9, 'Helderberg Packaging',              'HP', 'Somerset West, W. Cape',      'orders@helderbergpack.co.za'),
  (10, 'Cape Label & Print',                'CL', 'Bellville, Cape Town',        'studio@capelabelprint.co.za'),
  (11, 'Stellenbosch Seedling & Input Co.', 'SS', 'Stellenbosch, Western Cape',  'hello@stellenboschseedling.co.za'),
  (12, 'Peninsula Beverage Supply',         'PB', 'Ottery, Cape Town',           'orders@peninsulabev.co.za'),
  (13, 'Malmesbury Cold Store Services',    'MC', 'Malmesbury, Western Cape',    'bookings@malmesburycold.co.za'),
  (14, 'Drakenstein Logistics & Freight',   'DL', 'Paarl, Western Cape',         'dispatch@drakensteinlogistics.co.za')
) as v(n, name, initials, location, contact_email);


-- ---------------------------------------------------------------------------
-- 2. Stock catalogue (`pp_stock_items`, group 02) — 32 lines, blueprint §3.
--    `avg_unit_price` is the unit COST; OrderFlow sells at the §3 `sell` price.
--    fetchStock() does select('*') ordered by category,name, so every column the
--    UI touches lives here: on_hand / low_threshold drive stockStatus(),
--    trend_pct the sparkline colour, cheapest_supplier the Alerts + draft-PO
--    supplier, kg_per_unit the "stock on hand (kg)" derivation.
--
--    price_history is the cost-spike series read by detectCostSpikes()
--    (pricepilot.ts:588). HARD RULE: the LAST point equals avg_unit_price
--    exactly, otherwise the function appends the live cost and the step % moves.
--    Thresholds: COST_SPIKE_STEP_PCT = 10 (last vs previous),
--    COST_CREEP_PCT = 8 (last vs first, only when the step is under 10).
--      STEP  spikes (3): #21 Cooking Oil 13.07%, #16 Line Fish 10.53%,
--                        #25 Cheese Block 10.40%
--      CREEP spikes (4): #13 Chicken 10.71%, #20 Cake Flour 9.09%,
--                        #24 Butter 9.07%, #18 Rice 8.82%
--    The other 25 series are flat, gently rising (<8% end-to-end) or falling, so
--    they must NOT fire. 7 points each, oldest first.
--
--    Stock levels (blueprint §3.2) — the four lines InsightGen turns into
--    `stock-low:` anomalies: #16 Line Fish Fillet 0/20 (out → critical),
--    #2 Baby Spinach 6/12, #30 Bread Rolls 14/30, #23 Fresh Milk 18/24.
--    Everything else carries 3-8 days' cover, comfortably above threshold.
-- ---------------------------------------------------------------------------
insert into pp_stock_items (
  id, org_id, name, category, pack, unit, on_hand, low_threshold,
  avg_unit_price, kg_per_unit, currency, trend_pct, cheapest_supplier,
  active, kind, stock_history, price_history
)
select ('02000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.name, v.category, nullif(v.pack, ''), v.unit, v.on_hand, v.low_threshold,
       v.avg_unit_price, v.kg_per_unit, 'ZAR', v.trend_pct, v.cheapest_supplier,
       true, 'product',
       -- jsonb columns: bare array[...] would error, so convert explicitly.
       to_jsonb(v.stock_history), to_jsonb(v.price_history)
from (values
  -- n, name, category, pack, unit, on_hand, low, cost, kg/unit, trend, cheapest supplier, stock_history, price_history
  ( 1, 'Mixed Salad Leaf (crate)',       'Field Produce',   '5kg/crate',    'crate',   64,  18, 148.00,  5.0,    4, 'Bergriver Growers',
       array[52,58,55,61,59,67,64]::numeric[],          array[142,143,144,145,146,147,148]::numeric[]),
  ( 2, 'Baby Spinach (crate)',           'Field Produce',   '4kg/crate',    'crate',    6,  12, 132.00,  4.0,   -6, 'Bergriver Growers',
       array[34,28,24,18,14,10,6],                      array[128,129,130,130,131,132,132]),
  ( 3, 'Tomatoes (kg)',                  'Field Produce',   '',             'kg',     420, 120,  23.50,  1.0,    9, 'Klipheuwel Farms',
       array[340,368,352,392,380,436,420],              array[22.6,22.8,23.0,23.1,23.3,23.4,23.5]),
  ( 4, 'Onions (10kg bag)',              'Field Produce',   '10kg/bag',     'bag',    138,  40,  92.00, 10.0,    3, 'Klipheuwel Farms',
       array[112,122,118,128,124,144,138],              array[89,89.5,90,90.5,91,91.5,92]),
  ( 5, 'Potatoes (10kg bag)',            'Field Produce',   '10kg/bag',     'bag',    164,  48, 108.00, 10.0,    6, 'Klipheuwel Farms',
       array[134,146,140,152,148,172,164],              array[104,105,106,106,107,108,108]),
  ( 6, 'Carrots (10kg bag)',             'Field Produce',   '10kg/bag',     'bag',    112,  32,  86.00, 10.0,    2, 'Klipheuwel Farms',
       array[90,98,94,104,100,118,112],                 array[83,83.5,84,84.5,85,85.5,86]),
  ( 7, 'Butternut (kg)',                 'Field Produce',   '',             'kg',     380, 110,  14.80,  1.0,    1, 'Bergriver Growers',
       array[320,344,332,356,348,392,380],              array[14.3,14.4,14.5,14.6,14.6,14.7,14.8]),
  ( 8, 'Mixed Peppers (5kg box)',        'Field Produce',   '5kg/box',      'box',     72,  22, 168.00,  5.0,    7, 'Bergriver Growers',
       array[58,64,61,67,65,75,72],                     array[163,164,165,166,166,167,168]),
  ( 9, 'Cucumbers (box)',                'Field Produce',   '10/box',       'box',     96,  28,  96.00,  4.0,   -2, 'Bergriver Growers',
       array[108,104,101,99,97,98,96],                  array[98,97.5,97,96.5,96,96,96]),
  (10, 'Seasonal Citrus (15kg box)',     'Field Produce',   '15kg/box',     'box',    148,  40, 172.00, 15.0,   -3, 'Bergriver Growers',
       array[172,166,162,158,154,151,148],              array[166,167,168,169,170,171,172]),
  (11, 'Seasonal Apples (12.5kg box)',   'Field Produce',   '12.5kg/box',   'box',    104,  30, 258.00, 12.5,    5, 'Bergriver Growers',
       array[84,90,88,95,97,102,104],                   array[250,251,253,254,256,257,258]),
  (12, 'Mixed Herbs (bunch)',            'Field Produce',   '',             'bunch',  240,  70,  11.50,  0.12,  11, 'Stellenbosch Seedling & Input Co.',
       array[190,206,198,214,220,232,240],              array[11.1,11.2,11.2,11.3,11.4,11.4,11.5]),
  -- #13 CREEP: 560 -> 620 end-to-end = 10.71%, last step only 1.64%.
  (13, 'Chicken Portions (10kg box)',    'Proteins',        '10kg/box',     'box',     86,  24, 620.00, 10.0,    8, 'Winelands Protein Co.',
       array[66,72,70,76,78,83,86],                     array[560,572,584,592,601,610,620]),
  (14, 'Beef Mince (kg)',                'Proteins',        '',             'kg',     210,  60, 118.00,  1.0,    5, 'Winelands Protein Co.',
       array[170,182,176,190,194,204,210],              array[114,114.5,115,116,116.5,117,118]),
  (15, 'Lamb Cuts (kg)',                 'Proteins',        '',             'kg',      74,  22, 195.00,  1.0,    2, 'Winelands Protein Co.',
       array[64,68,66,70,71,73,74],                     array[189,190,191,192,193,194,195]),
  -- #16 STEP: 152 -> 168 = 10.53%. Also the OUT-of-stock line (on_hand 0).
  (16, 'Line Fish Fillet (kg)',          'Proteins',        '',             'kg',       0,  20, 168.00,  1.0,   13, 'Winelands Protein Co.',
       array[42,36,28,20,12,5,0],                       array[141,143,145,148,150,152,168]),
  (17, 'Sausage / Boerewors (kg)',       'Proteins',        '',             'kg',     118,  34,  96.00,  1.0,    4, 'Winelands Protein Co.',
       array[98,104,101,108,110,115,118],               array[93,93.5,94,94.5,95,95.5,96]),
  -- #18 CREEP: 136 -> 148 = 8.82%, last step 1.37%.
  (18, 'Rice (10kg bag)',                'Dry Goods',       '10kg/bag',     'bag',    152,  44, 148.00, 10.0,    6, 'Boland Dry Goods',
       array[122,132,128,138,142,148,152],              array[136,138,140,142,144,146,148]),
  (19, 'Maize Meal (12.5kg bag)',        'Dry Goods',       '12.5kg/bag',   'bag',    128,  36, 118.00, 12.5,    3, 'Swartland Grain & Mill',
       array[108,114,111,118,121,125,128],              array[114,115,115,116,117,117,118]),
  -- #20 CREEP: 121 -> 132 = 9.09%, last step 0.76%.
  (20, 'Cake Flour (12.5kg bag)',        'Dry Goods',       '12.5kg/bag',   'bag',    116,  34, 132.00, 12.5,    5, 'Swartland Grain & Mill',
       array[94,101,98,105,108,113,116],                array[121,123,125,127,129,131,132]),
  -- #21 STEP: 566 -> 640 = 13.07%. The biggest-money spike on the catalogue.
  (21, 'Cooking Oil (4×5L case)',        'Dry Goods',       '4×5L/case',    'case',    58,  16, 640.00, 18.4,   12, 'Riebeek Oils & Fats',
       array[40,44,46,49,52,55,58],                     array[548,552,558,560,562,566,640]),
  (22, 'Sugar (12.5kg bag)',             'Dry Goods',       '12.5kg/bag',   'bag',     94,  26, 168.00, 12.5,    2, 'Boland Dry Goods',
       array[80,84,82,87,89,92,94],                     array[162,163,164,165,166,167,168]),
  (23, 'Fresh Milk (12×1L case)',        'Dairy & Chilled', '12×1L/case',   'case',    18,  24, 168.00, 12.4,    7, 'Overberg Dairy Supply',
       array[46,40,36,30,26,22,18],                     array[162,163,164,165,166,167,168]),
  -- #24 CREEP: 408 -> 445 = 9.07%, last step 1.14%.
  (24, 'Butter Blocks (case)',           'Dairy & Chilled', '10×500g/case', 'case',    44,  12, 445.00,  5.0,    6, 'Overberg Dairy Supply',
       array[34,37,36,39,41,43,44],                     array[408,414,420,428,434,440,445]),
  -- #25 STEP: 125 -> 138 = 10.40%.
  (25, 'Cheese Block (kg)',              'Dairy & Chilled', '',             'kg',      96,  28, 138.00,  1.0,    9, 'Overberg Dairy Supply',
       array[76,82,80,86,89,93,96],                     array[118,120,121,122,124,125,138]),
  (26, 'Prepared Salad Mix (2kg tub)',   'Prepared Lines',  '2kg/tub',      'tub',    132,  38,  78.00,  2.0,    4, 'Bergriver Growers',
       array[108,116,112,120,124,128,132],              array[75.5,76,76.5,77,77,77.5,78]),
  (27, 'Prepared Veg Mix (2.5kg tub)',   'Prepared Lines',  '2.5kg/tub',    'tub',    118,  34,  82.00,  2.5,    3, 'Klipheuwel Farms',
       array[98,104,101,108,111,115,118],               array[79.5,80,80.5,81,81,81.5,82]),
  (28, 'Ready Meal Trays (12/case)',     'Prepared Lines',  '12/case',      'case',    62,  18, 288.00,  4.8,    8, 'Cape Cold Chain Supply',
       array[46,51,49,54,57,60,62],                     array[279,280,282,284,285,286,288]),
  (29, 'Stock & Sauce Base (6×2L case)', 'Prepared Lines',  '6×2L/case',    'case',    54,  15, 196.00, 12.0,    1, 'Boland Dry Goods',
       array[48,50,49,51,52,53,54],                     array[190,191,192,193,194,195,196]),
  (30, 'Bread Rolls (24/bag)',           'Prepared Lines',  '24/bag',       'bag',     14,  30,  42.00,  1.7,   -4, 'Swartland Grain & Mill',
       array[44,38,34,28,24,19,14],                     array[40.8,41,41.2,41.4,41.6,41.8,42]),
  (31, 'Punnets & Trays (sleeve)',       'Packaging',       '500/sleeve',   'sleeve',  86,  24, 168.00, null,    0, 'Helderberg Packaging',
       array[72,76,74,79,81,84,86],                     array[163,164,165,166,166,167,168]),
  (32, 'Cartons — Standard (bundle)',    'Packaging',       '25/bundle',    'bundle', 124,  35, 118.00, null,    2, 'Helderberg Packaging',
       array[104,110,107,114,117,121,124],              array[114,115,115,116,117,117,118])
) as v(n, name, category, pack, unit, on_hand, low_threshold, avg_unit_price, kg_per_unit,
       trend_pct, cheapest_supplier, stock_history, price_history);


-- ---------------------------------------------------------------------------
-- 3. Per-product thresholds (`pp_stock_thresholds`, group 1d, id = product index).
--    `low_threshold` mirrors the catalogue value — InsightGen prefers this table
--    when a row exists (insightgen-data.ts stock-low rule), so the two MUST agree
--    or the four seeded low/out lines would drift. par_level is the reorder-to
--    target (~3x low), lead_time_days the supplier lead time, freshness_* what
--    the Alerts page ages stock against.
-- ---------------------------------------------------------------------------
insert into pp_stock_thresholds (
  id, org_id, stock_item_id, low_threshold, par_level, lead_time_days,
  freshness_value, freshness_unit, alerts_enabled, notes
)
select ('1d000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('02000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       v.low_threshold, v.par_level, v.lead_time_days,
       v.freshness_value, v.freshness_unit, true, nullif(v.notes, '')
from (values
  ( 1,  18,  56, 1,  3, 'days', 'Cut leaf — hold under 4 degrees'),
  ( 2,  12,  36, 1,  2, 'days', ''),
  ( 3, 120, 360, 1,  5, 'days', ''),
  ( 4,  40, 120, 2, 21, 'days', ''),
  ( 5,  48, 150, 2, 21, 'days', ''),
  ( 6,  32, 100, 2, 14, 'days', ''),
  ( 7, 110, 340, 2, 14, 'days', ''),
  ( 8,  22,  66, 1,  6, 'days', ''),
  ( 9,  28,  84, 1,  7, 'days', ''),
  (10,  40, 120, 2, 12, 'days', ''),
  (11,  30,  95, 2, 21, 'days', ''),
  (12,  70, 210, 1,  2, 'days', 'Fastest-perishing line on the field roster'),
  (13,  24,  80, 2,  4, 'days', 'Chilled — never accept above 4 degrees'),
  (14,  60, 190, 2,  3, 'days', ''),
  (15,  22,  70, 2,  4, 'days', ''),
  (16,  20,  60, 2,  2, 'days', 'Day-boat landing; order Monday and Thursday'),
  (17,  34, 105, 2,  5, 'days', ''),
  (18,  44, 140, 4, 12, 'months', ''),
  (19,  36, 115, 4,  9, 'months', ''),
  (20,  34, 105, 4,  9, 'months', ''),
  (21,  16,  50, 5, 12, 'months', 'Cost volatile — review the price series weekly'),
  (22,  26,  80, 4, 18, 'months', ''),
  (23,  24,  76, 2,  7, 'days', ''),
  (24,  12,  40, 2, 60, 'days', ''),
  (25,  28,  88, 2, 45, 'days', ''),
  (26,  38, 115, 1,  3, 'days', ''),
  (27,  34, 105, 1,  3, 'days', ''),
  (28,  18,  56, 1,  4, 'days', ''),
  (29,  15,  48, 2, 30, 'days', ''),
  (30,  30,  95, 1,  2, 'days', 'Baked daily — day-old goes to the counter'),
  (31,  24,  76, 5, null, 'days', ''),
  (32,  35, 110, 5, null, 'days', '')
) as v(n, low_threshold, par_level, lead_time_days, freshness_value, freshness_unit, notes);


-- ---------------------------------------------------------------------------
-- 4. Unit setup (`pp_product_units`, group 1e, id = product index) — how each
--    line is bought, counted and consumed. `conversion_factor` turns ONE purchase
--    unit into stock units, so it is 1 wherever the two units are the same and >1
--    where the buying pack breaks down (a 8kg tomato crate counted in kg, etc.).
-- ---------------------------------------------------------------------------
insert into pp_product_units (
  id, org_id, stock_item_id, purchase_unit, stock_unit, recipe_unit, conversion_factor
)
select ('1e000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('02000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       v.purchase_unit, v.stock_unit, v.recipe_unit, v.conversion_factor
from (values
  ( 1, 'crate',  'crate',  'kg',     1),
  ( 2, 'crate',  'crate',  'kg',     1),
  ( 3, 'crate',  'kg',     'kg',     8),
  ( 4, 'bag',    'bag',    'kg',     1),
  ( 5, 'bag',    'bag',    'kg',     1),
  ( 6, 'bag',    'bag',    'kg',     1),
  ( 7, 'bin',    'kg',     'kg',    20),
  ( 8, 'box',    'box',    'kg',     1),
  ( 9, 'box',    'box',    'ea',     1),
  (10, 'box',    'box',    'kg',     1),
  (11, 'box',    'box',    'kg',     1),
  (12, 'box',    'bunch',  'bunch', 12),
  (13, 'box',    'box',    'kg',     1),
  (14, 'box',    'kg',     'kg',    10),
  (15, 'box',    'kg',     'kg',    10),
  (16, 'box',    'kg',     'kg',     8),
  (17, 'box',    'kg',     'kg',    10),
  (18, 'bag',    'bag',    'kg',     1),
  (19, 'bag',    'bag',    'kg',     1),
  (20, 'bag',    'bag',    'kg',     1),
  (21, 'case',   'case',   'L',      1),
  (22, 'bag',    'bag',    'kg',     1),
  (23, 'case',   'case',   'L',      1),
  (24, 'case',   'case',   'kg',     1),
  (25, 'case',   'kg',     'kg',    10),
  (26, 'tub',    'tub',    'kg',     1),
  (27, 'tub',    'tub',    'kg',     1),
  (28, 'case',   'case',   'ea',     1),
  (29, 'case',   'case',   'L',      1),
  (30, 'bag',    'bag',    'ea',     1),
  (31, 'sleeve', 'sleeve', 'ea',     1),
  (32, 'bundle', 'bundle', 'ea',     1)
) as v(n, purchase_unit, stock_unit, recipe_unit, conversion_factor);


-- ---------------------------------------------------------------------------
-- 5. Per-supplier quotes (`pp_item_suppliers`, group 18, id = product*10 + offer).
--    Powers the Procurement Intelligence price matrix, the Alerts "cheapest
--    supplier" chip and buildDraftOrder() (which buys every low/out line from its
--    cheapest quote). Offer 1 is always the cheapest and MUST equal the
--    catalogue's avg_unit_price + cheapest_supplier, otherwise the matrix and the
--    item card disagree. Alternates sit 4-12% above. 66 rows over 32 lines.
-- ---------------------------------------------------------------------------
insert into pp_item_suppliers (id, org_id, stock_item_id, supplier_name, price)
select ('18000000-7e5d-4c1a-9b3f-' || lpad((v.n * 10 + v.offer)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('02000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       v.supplier_name, v.price
from (values
  ( 1, 1, 'Bergriver Growers',                 148.00), ( 1, 2, 'Klipheuwel Farms',                156.00), ( 1, 3, 'Cape Cold Chain Supply',  163.00),
  ( 2, 1, 'Bergriver Growers',                 132.00), ( 2, 2, 'Klipheuwel Farms',                139.00),
  ( 3, 1, 'Klipheuwel Farms',                   23.50), ( 3, 2, 'Bergriver Growers',                24.80),
  ( 4, 1, 'Klipheuwel Farms',                   92.00), ( 4, 2, 'Bergriver Growers',                97.00),
  ( 5, 1, 'Klipheuwel Farms',                  108.00), ( 5, 2, 'Bergriver Growers',               114.00), ( 5, 3, 'Boland Dry Goods',        119.00),
  ( 6, 1, 'Klipheuwel Farms',                   86.00), ( 6, 2, 'Bergriver Growers',                91.00),
  ( 7, 1, 'Bergriver Growers',                  14.80), ( 7, 2, 'Klipheuwel Farms',                 15.60),
  ( 8, 1, 'Bergriver Growers',                 168.00), ( 8, 2, 'Klipheuwel Farms',                177.00),
  ( 9, 1, 'Bergriver Growers',                  96.00), ( 9, 2, 'Klipheuwel Farms',                101.00),
  (10, 1, 'Bergriver Growers',                 172.00), (10, 2, 'Klipheuwel Farms',                181.00),
  (11, 1, 'Bergriver Growers',                 258.00), (11, 2, 'Klipheuwel Farms',                272.00),
  (12, 1, 'Stellenbosch Seedling & Input Co.',  11.50), (12, 2, 'Bergriver Growers',                12.40),
  (13, 1, 'Winelands Protein Co.',             620.00), (13, 2, 'Cape Cold Chain Supply',          648.00),
  (14, 1, 'Winelands Protein Co.',             118.00), (14, 2, 'Cape Cold Chain Supply',          124.00),
  (15, 1, 'Winelands Protein Co.',             195.00), (15, 2, 'Cape Cold Chain Supply',          206.00),
  (16, 1, 'Winelands Protein Co.',             168.00), (16, 2, 'Cape Cold Chain Supply',          179.00),
  (17, 1, 'Winelands Protein Co.',              96.00), (17, 2, 'Cape Cold Chain Supply',          102.00),
  (18, 1, 'Boland Dry Goods',                  148.00), (18, 2, 'Swartland Grain & Mill',          155.00),
  (19, 1, 'Swartland Grain & Mill',            118.00), (19, 2, 'Boland Dry Goods',                123.00),
  (20, 1, 'Swartland Grain & Mill',            132.00), (20, 2, 'Boland Dry Goods',                138.00),
  (21, 1, 'Riebeek Oils & Fats',               640.00), (21, 2, 'Boland Dry Goods',                672.00),
  (22, 1, 'Boland Dry Goods',                  168.00), (22, 2, 'Swartland Grain & Mill',          176.00),
  (23, 1, 'Overberg Dairy Supply',             168.00), (23, 2, 'Cape Cold Chain Supply',          177.00),
  (24, 1, 'Overberg Dairy Supply',             445.00), (24, 2, 'Cape Cold Chain Supply',          468.00),
  (25, 1, 'Overberg Dairy Supply',             138.00), (25, 2, 'Cape Cold Chain Supply',          146.00),
  (26, 1, 'Bergriver Growers',                  78.00), (26, 2, 'Cape Cold Chain Supply',           83.00),
  (27, 1, 'Klipheuwel Farms',                   82.00), (27, 2, 'Bergriver Growers',                87.00),
  (28, 1, 'Cape Cold Chain Supply',            288.00), (28, 2, 'Winelands Protein Co.',           303.00),
  (29, 1, 'Boland Dry Goods',                  196.00), (29, 2, 'Riebeek Oils & Fats',             206.00),
  (30, 1, 'Swartland Grain & Mill',             42.00), (30, 2, 'Boland Dry Goods',                 44.50),
  (31, 1, 'Helderberg Packaging',              168.00), (31, 2, 'Cape Label & Print',              177.00),
  (32, 1, 'Helderberg Packaging',              118.00), (32, 2, 'Cape Label & Print',              124.00)
) as v(n, offer, supplier_name, price);


-- ---------------------------------------------------------------------------
-- 6. ProcurePulse settings (`pp_settings`, keyed on org_id — no separate id).
--    Only the columns the app itself writes are set; everything else keeps its
--    column default. custom_units feeds the typeable unit dropdown on Products,
--    the Doc-U line editor and the OrderFlow line-item unit picker.
-- ---------------------------------------------------------------------------
insert into pp_settings (
  org_id, notify_low_stock, notify_direct_docs, notify_market_statements,
  notify_price_spikes, weekly_summary, default_supplier, custom_units
)
values (
  '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
  true, true, true, true, true, 'Bergriver Growers',
  array['crate','sleeve','bundle','tub','punnet','cover','batch','tray','drum','load','pallet-month','reel']
);


-- ##########################################################################
-- ##  SECTION 2B
-- ##  OrderFlow + Core Data — customers, contacts, addresses, terms, VAT, templates,
-- ##  orders, order items, invoices, payments, credit notes, delivery notes,
-- ##  quotes, quote requests, activity  (apply order 3, 5, 6)
-- ##########################################################################

-- ============================================================================
-- DOMAIN (a) — OrderFlow + Core Data  ·  Meridian Food Co. (Stellenbosch)
-- ----------------------------------------------------------------------------
-- Seeds the customer/order/invoice backbone the whole demo is measured against:
--   of_customers (28)  cd_contacts / cd_delivery_addresses / cd_payment_terms /
--   cd_vat_rates / cd_doc_templates / cd_company_profile / of_settings /
--   cd_customer_item_aliases
--   of_orders (490) + of_order_items      ← THE revenue rows
--   of_invoices (458) + of_invoice_items + of_payments
--   of_credit_notes(+items) · of_delivery_notes(+items) · of_quotes(+items)
--   of_quote_requests (6) · of_activity (60)
--
-- WHY THESE NUMBERS.  PlanWise (planwise-data.ts:106), ShiftBoard
-- (shiftboard-data.ts:97), PricePilot and InsightGen all read revenue as
-- `sum(of_order_items.qty * unit_price)` over `of_orders.status in
-- ('invoiced','paid')`. So every rand of the blueprint's §8.1 model lives on an
-- invoiced/paid order here, and nowhere else:
--
--   Apr 2026   5 150 000   (110 orders)
--   May 2026   5 480 000   (116 orders)
--   Jun 2026   5 860 000   (123 orders)
--   Jul 1–29   5 155 000   (109 orders, month-to-date)
--   ---------------------------------------------------
--   realised  21 645 000   (458 orders)  → 4-month mean R5.5M/month
--
-- plus 32 July pipeline orders (18 draft, 14 confirmed) worth R1 560 000 that
-- are DELIBERATELY excluded from every total — they are the funnel, not sales.
--
-- Line prices are the blueprint §3 `sell` values, never anything else: that is
-- what makes PricePilot's catalogue margin, PlanWise's COGS and InsightGen's
-- realized margin agree on 61.8% COGS / 38.2% gross margin.
--
-- HOW TO APPLY: this is a fragment of supabase/demo-all-in-one.sql. It assumes
-- the bootstrap block (org + profile + org_features) and every schema file the
-- assembler inlines have already run, and that writer (b) has already seeded
-- `pp_stock_items` (group 02) — of_order_items.stock_item_id points straight at
-- those UUIDs. It contains NO DDL and touches no other domain's tables.
-- Re-runnable: every table is cleared for the Meridian org first, and every id
-- is an explicit blueprint UUID.  All money in ZAR.
--
-- NOTE ON `suppliers` (core): the blueprint assigns the core `suppliers` rows
-- (group 04) to writer (b) — they belong with Doc-U/ProcurePulse and are the
-- bridge SupplySync's `ss_suppliers.supplier_id` resolves to. NOT seeded here.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0. Delete preamble — scoped to the Meridian org UUID only, children first.
--    No statement in this file names or touches any other organisation's data.
-- ---------------------------------------------------------------------------
delete from of_credit_note_items    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_credit_notes         where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_delivery_note_items  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_delivery_notes       where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_payments             where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_invoice_items        where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_quote_requests       where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_quote_items          where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_quotes               where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_activity             where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_order_items          where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_invoices             where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_orders               where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from cd_customer_item_aliases where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from cd_contacts             where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from cd_delivery_addresses   where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_customers            where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from cd_payment_terms        where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from cd_vat_rates            where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from cd_doc_templates        where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from cd_company_profile      where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from of_settings             where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 1. Org-level Core Data — company profile, numbering, terms, VAT, templates.
--    `of_settings` is read by every OrderFlow fetcher (orderflow-data.ts:63);
--    the *_next counters sit just past the highest number seeded below, so the
--    first document a demo user creates continues the sequence instead of
--    colliding with it:  orders ORD-4610…5099 → next 5100,
--    invoices INV-4142…4599 → next 4600, quotes QTE-0202…0219 → next 220.
-- ---------------------------------------------------------------------------
insert into of_settings (
  org_id, invoice_prefix, invoice_next, quote_prefix, quote_next,
  order_prefix, order_next, credit_prefix, credit_next, dn_prefix, dn_next,
  number_pad, default_payment_terms_days, default_vat_rate, updated_at)
values (
  '01000000-7e5d-4c1a-9b3f-000000000001', 'INV-', 4600, 'QTE-', 220,
  'ORD-', 5100, 'CN-', 7, 'DN-', 41,
  4, 30, 15, timestamptz '2026-07-29 07:00+02');

insert into cd_company_profile (
  org_id, company_name, vat_number, registration_number, address, email, phone,
  bank_name, account_name, account_number, branch_code, swift,
  invoice_footer, terms, updated_at)
values (
  '01000000-7e5d-4c1a-9b3f-000000000001',
  'Meridian Food Co.',
  '4720318844',
  '2016/318844/07',
  'Unit 4, Meridian Park, 18 Adam Tas Road, Stellenbosch, Western Cape, 7600',
  'accounts@meridianfood.co.za',
  '021 883 5500',
  'First National Bank', 'Meridian Food Co. (Pty) Ltd', '62731094482', '250655', 'FIRNZAJJ',
  'Meridian Food Co. (Pty) Ltd · VAT 4720318844 · 021 883 5500 · accounts@meridianfood.co.za',
  'Payment strictly on the agreed terms. Ownership of goods passes on full payment. '
  'Claims for shortages or quality must be lodged within 24 hours of delivery.',
  timestamptz '2026-07-29 07:00+02');

insert into cd_payment_terms (id, org_id, name, days, description, is_default, created_at)
values
  ('3c000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', '7 days',       7,  'Short terms — small accounts and market stands.', false, timestamptz '2025-09-01 08:00+02'),
  ('3c000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', '14 days',      14, 'Fortnightly settlement.',                          false, timestamptz '2025-09-01 08:00+02'),
  ('3c000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', '30 days net',  30, 'Standard trade terms.',                            true,  timestamptz '2025-09-01 08:00+02'),
  ('3c000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', '45 days net',  45, 'Negotiated terms for the largest accounts.',       false, timestamptz '2025-09-01 08:00+02');

insert into cd_vat_rates (id, org_id, name, rate, description, active, created_at)
values
  ('3d000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', 'Standard rate', 15, 'SA standard-rated supplies.', true, timestamptz '2025-09-01 08:00+02'),
  ('3d000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', 'Zero-rated',     0, 'Zero-rated basic foodstuffs.', true, timestamptz '2025-09-01 08:00+02');

insert into cd_doc_templates (id, org_id, template_type, name, logo_placement, footer_text, terms, is_default, created_at)
values
  ('3e000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', 'invoice',       'Meridian standard invoice',      'left',   'Thank you for your order.',            'Payment strictly on the agreed terms.',              true,  timestamptz '2025-09-01 08:00+02'),
  ('3e000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', 'quote',         'Meridian quotation',             'left',   'Prices valid 21 days from issue.',     'Subject to availability and confirmation of volume.', false, timestamptz '2025-09-01 08:00+02'),
  ('3e000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', 'delivery_note', 'Meridian delivery note',         'center', 'Please check and sign on receipt.',    'Shortages must be noted on this document at delivery.', false, timestamptz '2025-09-01 08:00+02');


-- ---------------------------------------------------------------------------
-- 2. Customers — 28 accounts (blueprint §5, group 05, index = counter).
--    Four buying shapes, all deliberately segment-neutral:
--      1–12  trade / wholesale accounts   (drives ~58% of revenue)
--      13–19 events & catering            (~20%)
--      20–24 own counters + market stands (~13%)
--      25–28 farm-gate & direct           (~9%)
--    `default_price_list_id` is deliberately left NULL: writer (c) creates
--    pl_price_lists AFTER this block, so setting it here would break the FK.
--    `rebate_pct` is set on 2 / 5 / 10 so the OrderFlow rebate surface has data.
--
--    `customer_type` MUST be one of CUSTOMER_TYPES (orderflow.ts:521) —
--    retail | wholesale | hospitality | restaurant | hotel | other. Anything
--    else renders as '—' in CustomersDb, falls back to 'Other' on the customer
--    profile and makes the type filter match nothing, so `v.ctype` (the
--    segment-neutral internal label) is MAPPED onto the real constant here.
--    The internal label survives on `tags`, which is free text.
-- ---------------------------------------------------------------------------
insert into of_customers (
  id, org_id, name, email, phone, pricing_status, notes, created_at,
  trading_name, vat_number, registration_number, account_status, customer_type,
  payment_terms_days, credit_limit, billing_address, delivery_address, tags,
  account_code, vat_treatment, invoice_price_basis, invoice_quantity_basis,
  strip_order_prefixes, ai_auto_invoice_confidence, ai_allow_unpriced,
  invoice_terms_text, rebate_pct, currency, updated_at)
select
  ('05000000-7e5d-4c1a-9b3f-' || lpad(v.i::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  v.name, v.email, v.phone, v.pricing, v.notes,
  timestamptz '2025-06-01 09:00+02' + (v.i * interval '11 days'),
  v.name, v.vat_number, v.reg_number, 'active',
  case v.ctype                       -- → CUSTOMER_TYPES (orderflow.ts:521)
    when 'trade'     then 'wholesale'
    when 'events'    then 'hospitality'
    when 'counter'   then 'retail'
    else                  'other'    -- farm_gate: no closer constant exists
  end,
  v.terms, v.credit_limit,
  (v.i * 7 + 4)::text || ' ' || a.street || ', ' || a.suburb || ', ' || a.town || ', ' || a.postal,
  (v.i * 7 + 4)::text || ' ' || a.street || ', ' || a.suburb || ', ' || a.town || ', ' || a.postal,
  array[v.ctype, v.pricing]::text[],
  v.account_code, 'standard', 'price_list', 'auto',
  true, 80, false,
  case when v.terms = 0 then 'On collection' else v.terms::text || ' days' end,
  v.rebate, 'ZAR',
  timestamptz '2026-07-29 07:00+02'
from (values
  ( 1, 'Boland Trading Co.',              'trade',     'weekly',   30, null::numeric,  850000::numeric, 'orders@bolandtrading.co.za',              '021 872 4410', '4130271884', '2011/271884/07', 'BOL001', 'Standing Tue/Fri trade delivery. Consolidated weekly price list.'),
  ( 2, 'Cape Provisions Group',           'trade',     'monthly',  30, 1.5,           1200000,          'buying@capeprovisions.co.za',             '021 555 3120', '4260318877', '2009/318877/07', 'CAP002', 'Group account on monthly contract pricing. Volume rebate applies.'),
  ( 3, 'Winelands Wholesale',             'trade',     'weekly',   30, null,           900000,          'orders@winelandswholesale.co.za',         '021 886 7740', '4190442301', '2013/442301/07', 'WIN003', 'Weekly list. Splits deliveries across two depots.'),
  ( 4, 'Helderberg Supply Partners',      'trade',     'weekly',   30, null,           640000,          'supply@helderbergpartners.co.za',         '021 851 6620', '4470119265', '2015/119265/07', 'HEL004', 'Somerset West depot. Prefers early-morning drops.'),
  ( 5, 'Table Bay Distributors',          'trade',     'monthly',  45, 2.0,           1500000,          'procurement@tablebaydist.co.za',          '021 511 8890', '4380226714', '2007/226714/07', 'TAB005', 'Largest trade account. 45-day terms and a monthly rebate.'),
  ( 6, 'Overberg Trading House',          'trade',     'weekly',   30, null,           580000,          'orders@overbergtrading.co.za',            '028 424 1180', '4550337192', '2014/337192/07', 'OVE006', 'Inland route. Cold-chain sign-off required on arrival.'),
  ( 7, 'Paarl Provision Co.',             'trade',     'standard', 30, null,           520000,          'buyer@paarlprovision.co.za',              '021 872 9905', '4610448023', '2016/448023/07', 'PAA007', 'Ad-hoc ordering, priced off the standard trade list.'),
  ( 8, 'Northern Suburbs Supply',         'trade',     'weekly',   30, null,           700000,          'orders@nssupply.co.za',                   '021 981 4470', '4290556138', '2012/556138/07', 'NOR008', 'Bellville depot. Order file arrives Sunday night.'),
  ( 9, 'Somerset Trade Supply',           'trade',     'standard', 14, null,           380000,          'admin@somersettrade.co.za',               '021 852 3311', '4720667451', '2018/667451/07', 'SOM009', 'Short terms by agreement. Reliable payer.'),
  (10, 'Drakenstein Distributors',        'trade',     'monthly',  45, 1.25,          1100000,          'orders@drakensteindist.co.za',            '021 863 2240', '4840778266', '2010/778266/07', 'DRA010', 'Regional distributor. Monthly pricing plus a volume rebate.'),
  (11, 'Peninsula Provisions',            'trade',     'weekly',   30, null,           760000,          'supply@peninsulaprovisions.co.za',        '021 447 9012', '4950889374', '2013/889374/07', 'PEN011', 'City route. Two drops per delivery day.'),
  (12, 'Swartland Trade Co.',             'trade',     'standard', 30, null,           460000,          'orders@swartlandtrade.co.za',             '022 482 5560', '4060991482', '2017/991482/07', 'SWA012', 'Seasonal volumes, heavier on the dry-goods lines.'),
  (13, 'Stellenbosch Events Collective',  'events',    'monthly',  30, null,           420000,          'bookings@stellenboschevents.co.za',       '021 883 1140', '4171102593', '2015/102593/07', 'STE013', 'Function calendar shared monthly. Peaks around harvest.'),
  (14, 'Rooiberg Function Services',      'events',    'standard', 14, null,           260000,          'orders@rooibergfunctions.co.za',          '023 626 3390', '4281213604', '2019/213604/07', 'ROO014', 'Weekend functions. Confirms final counts 48 hours out.'),
  (15, 'Cape Conference Catering',        'events',    'monthly',  30, null,           540000,          'procurement@capeconference.co.za',        '021 424 7710', '4391324715', '2012/324715/07', 'CAP015', 'Conference-centre account. Delivery before 07:00.'),
  (16, 'Devon Valley Functions',          'events',    'standard', 14, null,           240000,          'events@devonvalleyfunctions.co.za',       '021 865 2280', '4401435826', '2018/435826/07', 'DEV016', 'Estate functions. Access via the service gate.'),
  (17, 'Corporate Dining Partners',       'events',    'monthly',  30, null,           680000,          'supply@corporatedining.co.za',            '021 555 6640', '4511546937', '2011/546937/07', 'COR017', 'Multi-site dining contract. Consolidated monthly billing.'),
  (18, 'Harvest Table Events',            'events',    'standard',  7, null,           180000,          'hello@harvesttableevents.co.za',          '021 876 4420', '4621657048', '2020/657048/07', 'HAR018', 'Small operator, settles on 7-day terms.'),
  (19, 'Riverside Hospitality Group',     'events',    'monthly',  30, null,           720000,          'orders@riversidehospitality.co.za',        '021 809 3350', '4731768159', '2009/768159/07', 'RIV019', 'Group account across four venues. Monthly reconciliation.'),
  (20, 'Meridian Counter — Dorp Street',  'counter',   'standard',  0, null,           null,             'counter.dorp@meridianfood.co.za',         '021 883 5500', null,         null,             'MC-DRP', 'Own counter — one consolidated till batch per trading day.'),
  (21, 'Meridian Counter — Techno Park',  'counter',   'standard',  0, null,           null,             'counter.techno@meridianfood.co.za',       '021 883 5501', null,         null,             'MC-TCH', 'Own counter — one consolidated till batch per trading day.'),
  (22, 'Meridian Counter — Bird Street',  'counter',   'standard',  0, null,           null,             'counter.bird@meridianfood.co.za',         '021 883 5502', null,         null,             'MC-BRD', 'Own counter — one consolidated till batch per trading day.'),
  (23, 'Klapmuts Farm Stall',             'counter',   'weekly',    7, null,            90000,           'stall@klapmutsfarmstall.co.za',           '021 875 1120', '4842879260', '2019/879260/07', 'KLA023', 'Roadside stall. Weekly list, settles on Fridays.'),
  (24, 'Eikestad Market Stand',           'counter',   'weekly',    7, null,            80000,           'market@eikestadstand.co.za',              '021 887 3340', '4953980371', '2021/980371/07', 'EIK024', 'Saturday market stand plus a midweek top-up.'),
  (25, 'Meridian Farm Gate — Weekly Box', 'farm_gate', 'weekly',    0, null,           null,             'farmgate@meridianfood.co.za',             '021 883 5503', null,         null,             'MF-BOX', 'Own farm-gate box scheme — pre-paid weekly collections.'),
  (26, 'Devon Valley Smallholders',       'farm_gate', 'standard',  7, null,           120000,           'buyers@devonvalleysmallholders.co.za',    '021 865 4460', '4064091482', '2020/091482/07', 'DVS026', 'Neighbouring growers buying in at gate prices.'),
  (27, 'Jonkershoek Direct Buyers',       'farm_gate', 'standard',  7, null,           110000,           'orders@jonkershoekdirect.co.za',          '021 887 6690', '4175102593', '2021/102593/07', 'JON027', 'Direct collections, Wednesday and Saturday.'),
  (28, 'Banhoek Produce Collective',      'farm_gate', 'weekly',   14, null,           160000,           'collective@banhoekproduce.co.za',         '021 885 2210', '4286213604', '2018/213604/07', 'BAN028', 'Collective buying group on 14-day terms by agreement.')
) as v(i, name, ctype, pricing, terms, rebate, credit_limit, email, phone, vat_number, reg_number, account_code, notes)
cross join lateral (
  select
    (array['Bird Street','Dorp Street','Adam Tas Road','Devon Valley Road','Techno Avenue',
           'Blaauwklippen Road','Helshoogte Road','Jonkershoek Road','Banhoek Road','Klapmuts Road',
           'Merriman Avenue','Plankenbrug Street','Distillery Road','Vredenburg Road'])[((v.i * 5) % 14) + 1] as street,
    (array['Stellenbosch Central','Techno Park','Plankenbrug','Cloetesville','Die Boord',
           'Idas Valley','Devon Valley','Jamestown','Koelenhof','Klapmuts',
           'Kayamandi','Paradyskloof','Brandwacht','Welgevonden'])[((v.i * 3) % 14) + 1] as suburb,
    (array['Stellenbosch','Stellenbosch','Somerset West','Paarl','Cape Town',
           'Klapmuts','Franschhoek','Stellenbosch','Malmesbury','Wellington',
           'Cape Town','Somerset West','Stellenbosch','Paarl'])[((v.i * 3) % 14) + 1] as town,
    (array['7600','7600','7130','7646','8001','7625','7690','7600','7300','7655',
           '7405','7130','7600','7646'])[((v.i * 3) % 14) + 1] as postal
) a;


-- ---------------------------------------------------------------------------
-- 3. Customer contacts (group 3a, counter = customer*10 + n) and one default
--    delivery address each (group 3b, counter = customer*10 + 1).
--    getCustomerProfile (orderflow-data.ts:192) reads both; of_orders.
--    delivery_address_id below points at the 3b row for the same customer.
-- ---------------------------------------------------------------------------
insert into cd_contacts (id, org_id, customer_id, name, role, email, phone, whatsapp, is_primary, created_at)
select
  ('3a000000-7e5d-4c1a-9b3f-' || lpad((s.i * 10 + s.n)::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  ('05000000-7e5d-4c1a-9b3f-' || lpad(s.i::text, 12, '0'))::uuid,
  p.full_name,
  case when s.n = 1
       then (array['Owner','Procurement Manager','Head Buyer','Operations Manager','Site Manager'])[((s.i * 2) % 5) + 1]
       else (array['Accounts','Receiving','Function Coordinator','Duty Manager'])[((s.i * 3) % 4) + 1] end,
  lower(replace(p.full_name, ' ', '.')) || '@' || split_part(c.email, '@', 2),
  c.phone,
  case when s.n = 1 then '+2782' || lpad(((s.i * 137 + 4211) % 10000000)::text, 7, '0') else null end,
  (s.n = 1),
  c.created_at
from (
  select i, n
  from generate_series(1, 28) as i
  cross join generate_series(1, 2) as n
  where n = 1 or i <= 14                       -- 2 contacts on the 14 biggest accounts, 1 elsewhere
) s
join of_customers c on c.id = ('05000000-7e5d-4c1a-9b3f-' || lpad(s.i::text, 12, '0'))::uuid
cross join lateral (
  select (array['Adrian','Bronwyn','Cebo','Danika','Elmarie','Faizel','Gideon','Hannelie','Ilse','Jerome',
                'Kagiso','Lerato','Michelle','Neels','Odette','Percy','Refilwe','Shaun','Tania','Wian'])[((s.i * 3 + s.n) % 20) + 1]
      || ' ' ||
         (array['Abrahams','Bekker','Cloete','Dlomo','Engelbrecht','Fisher','Gouws','Hendricks','Ismail','Joubert',
                'Kotze','Loubser','Mabaso','Naidoo','Oosthuizen','Pretorius','Roberts','Steenkamp','Tshabalala','Viljoen'])[((s.i * 7 + s.n) % 20) + 1]
      as full_name
) p;

insert into cd_delivery_addresses (
  id, org_id, customer_id, nickname, street, suburb, city, province, postal_code,
  instructions, is_default, created_at)
select
  ('3b000000-7e5d-4c1a-9b3f-' || lpad((i * 10 + 1)::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  ('05000000-7e5d-4c1a-9b3f-' || lpad(i::text, 12, '0'))::uuid,
  'Main delivery point',
  (i * 7 + 4)::text || ' ' ||
    (array['Bird Street','Dorp Street','Adam Tas Road','Devon Valley Road','Techno Avenue',
           'Blaauwklippen Road','Helshoogte Road','Jonkershoek Road','Banhoek Road','Klapmuts Road',
           'Merriman Avenue','Plankenbrug Street','Distillery Road','Vredenburg Road'])[((i * 5) % 14) + 1],
  (array['Stellenbosch Central','Techno Park','Plankenbrug','Cloetesville','Die Boord',
         'Idas Valley','Devon Valley','Jamestown','Koelenhof','Klapmuts',
         'Kayamandi','Paradyskloof','Brandwacht','Welgevonden'])[((i * 3) % 14) + 1],
  (array['Stellenbosch','Stellenbosch','Somerset West','Paarl','Cape Town',
         'Klapmuts','Franschhoek','Stellenbosch','Malmesbury','Wellington',
         'Cape Town','Somerset West','Stellenbosch','Paarl'])[((i * 3) % 14) + 1],
  'Western Cape',
  (array['7600','7600','7130','7646','8001','7625','7690','7600','7300','7655',
         '7405','7130','7600','7646'])[((i * 3) % 14) + 1],
  (array['Deliver before 09:00.','Receiving bay at the rear — ring the bell.',
         'Call the receiver 20 minutes out.','Leave with the duty manager.',
         'Signature required on the delivery note.','Cold chain checked on arrival.'])[((i * 5) % 6) + 1],
  true,
  timestamptz '2025-06-01 09:00+02' + (i * interval '11 days')
from generate_series(1, 28) as i;

-- Order-name → catalogue mappings for the three accounts that send coded order
-- files (read by getCustomerProfile → cd_customer_item_aliases). Group `42` is
-- the first counter beyond the blueprint's allocation table (41 = of_quote_requests).
insert into cd_customer_item_aliases (id, org_id, customer_id, raw_name, stock_item_id, invoice_name, unit, quantity_basis, created_at)
select
  ('42000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  ('05000000-7e5d-4c1a-9b3f-' || lpad(v.cust::text, 12, '0'))::uuid,
  v.raw_name,
  ('02000000-7e5d-4c1a-9b3f-' || lpad(v.pidx::text, 12, '0'))::uuid,
  v.invoice_name, v.unit, 'auto',
  timestamptz '2026-05-14 10:20+02'
from (values
  (1, 5,  'FF - SALAD LEAF MIXED',  1,  'Mixed Salad Leaf',      'crate'),
  (2, 5,  'FF - SPINACH BABY',      2,  'Baby Spinach',          'crate'),
  (3, 5,  'VEG - TOM RND',          3,  'Tomatoes',              'kg'),
  (4, 5,  'DRY - RICE 10',          18, 'Rice',                  'bag'),
  (5, 2,  'PSAL 2KG TUB',           26, 'Prepared Salad Mix',    'tub'),
  (6, 2,  'PVEG 2.5KG TUB',         27, 'Prepared Veg Mix',      'tub'),
  (7, 17, 'RM TRAY CASE 12',        28, 'Ready Meal Trays',      'case'),
  (8, 17, 'STOCK BASE 6X2L',        29, 'Stock & Sauce Base',    'case')
) as v(n, cust, raw_name, pidx, invoice_name, unit);


-- ---------------------------------------------------------------------------
-- 4. ORDERS — 490 rows (group 0a, counter = order index 1–490, blueprint §8.3).
--
--    HOW AN ORDER GETS ITS VALUE.  Each month × segment group has a planned
--    total (§8.1) and an order count (§8.2). Every order in a group is given a
--    deterministic weight from the golden-ratio sequence frac(k · 0.618…),
--    scaled into the segment's plausible value band, then NORMALISED across the
--    group: amount(k) = round(total · w(k) / Σw), with the group's last order
--    taking the remainder. That makes each month × segment sum EXACTLY the
--    planned figure while every individual order still looks hand-made.
--
--    DATES.  Trading days are Mon–Sat (Apr 26, May 26, Jun 26, Jul 1–29 = 25).
--    Counter orders are one consolidated till batch on the k-th trading day.
--    Everything else spreads evenly across the month's trading days, with the
--    last order of every group landing on the last trading day — so Wed
--    2026-07-29 (today) carries one order in each of the four segments and
--    InsightGen's "sales today" / ShiftBoard's day-7 column are never empty.
--
--    STATUS.  HARD RULE 3: only `invoiced`/`paid` count as revenue.
--      Apr 110 paid · May 116 paid · Jun 115 paid + 8 invoiced ·
--      Jul 77 paid + 32 invoiced  = 418 paid / 40 open, 458 revenue orders.
--    The 8 open June orders are the EARLIEST June orders on ≥14-day terms, so
--    their invoices are genuinely past due; the 32 open July orders are the
--    most RECENT July orders on ≥14-day terms, so their invoices are not.
--    Cash-on-collection accounts (counter and farm-gate box, terms 0–7) are
--    never left open — a till batch does not sit on the debtors book.
--    Indices 459–490 are July pipeline: 18 `draft` + 14 `confirmed`, worth
--    R1 560 000 that is deliberately absent from every revenue total.
-- ---------------------------------------------------------------------------
insert into of_orders (
  id, org_id, customer_id, status, invoice_number, order_number, notes,
  customer_po, delivery_address, delivery_address_id, delivery_instructions,
  delivery_date, created_at, updated_at)
with grp(gkey, kind, seg, ym, first_idx, n, total, wlo, wamp, cust_lo) as (values
  -- gkey        kind         segment       month      first  n   planned total   band-lo  band-amp  first customer
  ('apr-w',   'revenue',   'wholesale', '2026-04',   1::int, 58::int, 3010000::numeric, 0.42::numeric, 1.16::numeric,  1::int),
  ('apr-c',   'revenue',   'catering',  '2026-04',  59,      14,      1010000,          0.40,          1.20,          13),
  ('apr-k',   'revenue',   'counter',   '2026-04',  73,      26,       660000,          0.62,          0.76,          20),
  ('apr-f',   'revenue',   'farmgate',  '2026-04',  99,      12,       470000,          0.58,          0.84,          25),
  ('may-w',   'revenue',   'wholesale', '2026-05', 111,      62,      3190000,          0.42,          1.16,           1),
  ('may-c',   'revenue',   'catering',  '2026-05', 173,      15,      1090000,          0.40,          1.20,          13),
  ('may-k',   'revenue',   'counter',   '2026-05', 188,      26,       700000,          0.62,          0.76,          20),
  ('may-f',   'revenue',   'farmgate',  '2026-05', 214,      13,       500000,          0.58,          0.84,          25),
  ('jun-w',   'revenue',   'wholesale', '2026-06', 227,      66,      3400000,          0.42,          1.16,           1),
  ('jun-c',   'revenue',   'catering',  '2026-06', 293,      17,      1200000,          0.40,          1.20,          13),
  ('jun-k',   'revenue',   'counter',   '2026-06', 310,      26,       730000,          0.62,          0.76,          20),
  ('jun-f',   'revenue',   'farmgate',  '2026-06', 336,      14,       530000,          0.58,          0.84,          25),
  ('jul-w',   'revenue',   'wholesale', '2026-07', 350,      58,      2995000,          0.42,          1.16,           1),
  ('jul-c',   'revenue',   'catering',  '2026-07', 408,      14,      1030000,          0.40,          1.20,          13),
  ('jul-k',   'revenue',   'counter',   '2026-07', 422,      25,       665000,          0.62,          0.76,          20),
  ('jul-f',   'revenue',   'farmgate',  '2026-07', 447,      12,       465000,          0.58,          0.84,          25),
  -- July pipeline — NOT revenue.
  ('pipe-d1', 'draft',     'wholesale', '2026-07', 459,      12,       560000,          0.42,          1.16,           1),
  ('pipe-d2', 'draft',     'catering',  '2026-07', 471,       6,       380000,          0.50,          1.00,          13),
  ('pipe-c1', 'confirmed', 'wholesale', '2026-07', 477,       8,       400000,          0.42,          1.16,           1),
  ('pipe-c2', 'confirmed', 'farmgate',  '2026-07', 485,       6,       220000,          0.58,          0.84,          25)
),
plan as (
  select g.gkey, g.kind, g.seg, g.ym, g.n, g.total, g.wlo, g.wamp, g.cust_lo,
         k::int as k, (g.first_idx + k - 1)::int as idx
  from grp g, generate_series(1, g.n) as k
),
weighted as (
  select p.*, (p.wlo + p.wamp * (p.k * 0.6180339887 - floor(p.k * 0.6180339887))) as w
  from plan p
),
shared as (
  select x.*, round(x.total * x.w / sum(x.w) over (partition by x.gkey)) as a0
  from weighted x
),
amt as (
  -- the group's last order absorbs the rounding remainder → group sum is exact
  select s.*,
         case when s.k = s.n
              then s.total - (sum(s.a0) over (partition by s.gkey) - s.a0)
              else s.a0 end as amount
  from shared s
),
td as (
  select d::date as d,
         to_char(d, 'YYYY-MM') as ym,
         row_number() over (partition by to_char(d, 'YYYY-MM') order by d)::int as t,
         count(*)     over (partition by to_char(d, 'YYYY-MM'))::int as tmax
  from generate_series(timestamp '2026-04-01', timestamp '2026-07-29', interval '1 day') as d
  where extract(dow from d) <> 0                            -- Mon–Sat are trading days
),
tmaxes as (select ym, max(t) as tmax from td group by ym),
slotted as (
  select a.*, tm.tmax,
         case
           when a.kind <> 'revenue' then tm.tmax - ((a.k - 1) % 6)   -- pipeline sits in the last 6 trading days
           when a.seg = 'counter'   then a.k                         -- one till batch per trading day
           when a.n <= 1            then 1
           else 1 + floor((a.k - 1)::numeric * (tm.tmax - 1) / (a.n - 1))::int
         end as t
  from amt a join tmaxes tm on tm.ym = a.ym
),
placed as (
  select s.*, td.d as order_date,
         ((td.d + time '06:30' + (((s.idx * 37) % 43) * interval '15 minutes'))::timestamp
            at time zone 'Africa/Johannesburg') as created_at
  from slotted s join td on td.ym = s.ym and td.t = s.t
),
assigned as (
  select p.*,
         p.cust_lo +
         case p.seg
           when 'wholesale' then (array[0,1,2,0,3,4,1,5,0,6,2,7,1,8,3,9,0,10,4,11])[((p.k - 1) % 20) + 1]
           when 'catering'  then (array[0,1,2,0,3,1,4,0,5,2,6,1,0,3,4,2,5,0,1,6])[((p.k - 1) % 20) + 1]
           when 'counter'   then ((p.k - 1) % 5)
           else (array[0,1,2,3,0,1,0,2,3,1,2,0])[((p.k - 1) % 12) + 1]
         end as cust_idx
  from placed p
),
ranked as (
  select a.*, c.id as customer_id, c.billing_address, c.payment_terms_days,
         row_number() over (
           partition by a.ym, (a.kind = 'revenue')
           order by (case when coalesce(c.payment_terms_days, 0) >= 14 then 0 else 1 end),
                    a.created_at asc, a.idx asc) as rn_stale,
         row_number() over (
           partition by a.ym, (a.kind = 'revenue')
           order by (case when coalesce(c.payment_terms_days, 0) >= 14 then 0 else 1 end),
                    a.created_at desc, a.idx desc) as rn_open
  from assigned a
  join of_customers c on c.id = ('05000000-7e5d-4c1a-9b3f-' || lpad(a.cust_idx::text, 12, '0'))::uuid
)
select
  ('0a000000-7e5d-4c1a-9b3f-' || lpad(r.idx::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  r.customer_id,
  case
    when r.kind <> 'revenue'                          then r.kind
    when r.ym = '2026-06' and r.rn_stale <= 8         then 'invoiced'
    when r.ym = '2026-07' and r.rn_open  <= 32        then 'invoiced'
    else 'paid'
  end,
  case when r.kind = 'revenue' then 'INV-' || lpad((4141 + r.idx)::text, 4, '0') end,
  'ORD-' || lpad((4609 + r.idx)::text, 4, '0'),
  case when r.seg = 'counter'
       then 'Consolidated counter batch for ' || to_char(r.order_date, 'DD Mon')
       else (array['Standing delivery — confirmed by phone',
                   'Split across two vehicles',
                   'Cold chain checked on dispatch',
                   'Collected at the depot',
                   'Priority account — dispatch first',
                   'Back-order line filled from the morning pick',
                   'Repeat of the previous week''s order',
                   'Pallet returns collected on delivery'])[((r.idx * 3) % 8) + 1] end,
  case when r.seg in ('wholesale', 'catering')
       then 'PO-' || to_char(r.order_date, 'YYMM') || '-' || lpad((r.idx % 1000)::text, 3, '0') end,
  r.billing_address,
  ('3b000000-7e5d-4c1a-9b3f-' || lpad((r.cust_idx * 10 + 1)::text, 12, '0'))::uuid,
  (array['Deliver before 09:00',
         'Receiving bay at the rear — ring the bell',
         'Call the receiver 20 minutes out',
         'Leave with the duty manager',
         'Signature required on the delivery note',
         'Cold chain checked on arrival'])[((r.idx * 5) % 6) + 1],
  case when r.seg in ('counter', 'farmgate') then r.order_date else r.order_date + 1 end,
  r.created_at,
  r.created_at
from ranked r;


-- ---------------------------------------------------------------------------
-- 5. ORDER LINES (group 0b, counter = order_index * 10 + line_no).
--
--    Every order's value is split across a fixed basket (blueprint §8.4). The
--    product set is chosen from the order index, so the same customer buys a
--    plausible rotation rather than the identical basket every week:
--      wholesale → W[idx mod 7] · catering → C[idx mod 4]
--      counter   → K[idx mod 4] · farm-gate → F[idx mod 3]
--    Line revenue = amount × weight, qty = that ÷ the product's SELL price, and
--    `unit_price` IS the sell price — never a discounted or invented number.
--    That is HARD RULE 1: it is what makes PricePilot's catalogue margin,
--    PlanWise's COGS and InsightGen's realized margin agree (COGS 61.8%).
--    The LAST line of each order is the balancing line: it takes whatever the
--    rounded driver lines left over, so the order sums to its planned amount.
-- ---------------------------------------------------------------------------
insert into of_order_items (id, org_id, order_id, stock_item_id, name, qty, unit, unit_price, created_at)
with grp(gkey, kind, seg, ym, first_idx, n, total, wlo, wamp, cust_lo) as (values
  ('apr-w',   'revenue',   'wholesale', '2026-04',   1::int, 58::int, 3010000::numeric, 0.42::numeric, 1.16::numeric,  1::int),
  ('apr-c',   'revenue',   'catering',  '2026-04',  59,      14,      1010000,          0.40,          1.20,          13),
  ('apr-k',   'revenue',   'counter',   '2026-04',  73,      26,       660000,          0.62,          0.76,          20),
  ('apr-f',   'revenue',   'farmgate',  '2026-04',  99,      12,       470000,          0.58,          0.84,          25),
  ('may-w',   'revenue',   'wholesale', '2026-05', 111,      62,      3190000,          0.42,          1.16,           1),
  ('may-c',   'revenue',   'catering',  '2026-05', 173,      15,      1090000,          0.40,          1.20,          13),
  ('may-k',   'revenue',   'counter',   '2026-05', 188,      26,       700000,          0.62,          0.76,          20),
  ('may-f',   'revenue',   'farmgate',  '2026-05', 214,      13,       500000,          0.58,          0.84,          25),
  ('jun-w',   'revenue',   'wholesale', '2026-06', 227,      66,      3400000,          0.42,          1.16,           1),
  ('jun-c',   'revenue',   'catering',  '2026-06', 293,      17,      1200000,          0.40,          1.20,          13),
  ('jun-k',   'revenue',   'counter',   '2026-06', 310,      26,       730000,          0.62,          0.76,          20),
  ('jun-f',   'revenue',   'farmgate',  '2026-06', 336,      14,       530000,          0.58,          0.84,          25),
  ('jul-w',   'revenue',   'wholesale', '2026-07', 350,      58,      2995000,          0.42,          1.16,           1),
  ('jul-c',   'revenue',   'catering',  '2026-07', 408,      14,      1030000,          0.40,          1.20,          13),
  ('jul-k',   'revenue',   'counter',   '2026-07', 422,      25,       665000,          0.62,          0.76,          20),
  ('jul-f',   'revenue',   'farmgate',  '2026-07', 447,      12,       465000,          0.58,          0.84,          25),
  ('pipe-d1', 'draft',     'wholesale', '2026-07', 459,      12,       560000,          0.42,          1.16,           1),
  ('pipe-d2', 'draft',     'catering',  '2026-07', 471,       6,       380000,          0.50,          1.00,          13),
  ('pipe-c1', 'confirmed', 'wholesale', '2026-07', 477,       8,       400000,          0.42,          1.16,           1),
  ('pipe-c2', 'confirmed', 'farmgate',  '2026-07', 485,       6,       220000,          0.58,          0.84,          25)
),
plan as (
  select g.gkey, g.n, k::int as k, (g.first_idx + k - 1)::int as idx, g.total, g.wlo, g.wamp
  from grp g, generate_series(1, g.n) as k
),
weighted as (
  select p.*, (p.wlo + p.wamp * (p.k * 0.6180339887 - floor(p.k * 0.6180339887))) as w from plan p
),
shared as (
  select x.*, round(x.total * x.w / sum(x.w) over (partition by x.gkey)) as a0 from weighted x
),
amt as (
  select s.idx, s.gkey,
         case when s.k = s.n
              then s.total - (sum(s.a0) over (partition by s.gkey) - s.a0)
              else s.a0 end as amount
  from shared s
),
-- The 32 catalogue lines (blueprint §3). `sell` is what an order line charges;
-- pp_stock_items.avg_unit_price carries the matching COST.
prod(pidx, pname, punit, sell) as (values
  ( 1::int, 'Mixed Salad Leaf (crate)',        'crate',  245.68::numeric),
  ( 2, 'Baby Spinach (crate)',                 'crate',  219.12),
  ( 3, 'Tomatoes (kg)',                        'kg',      39.01),
  ( 4, 'Onions (10kg bag)',                    'bag',    152.72),
  ( 5, 'Potatoes (10kg bag)',                  'bag',    179.28),
  ( 6, 'Carrots (10kg bag)',                   'bag',    142.76),
  ( 7, 'Butternut (kg)',                       'kg',      24.57),
  ( 8, 'Mixed Peppers (5kg box)',              'box',    278.88),
  ( 9, 'Cucumbers (box)',                      'box',    159.36),
  (10, 'Seasonal Citrus (15kg box)',           'box',    285.52),
  (11, 'Seasonal Apples (12.5kg box)',         'box',    428.28),
  (12, 'Mixed Herbs (bunch)',                  'bunch',   19.09),
  (13, 'Chicken Portions (10kg box)',          'box',    830.80),
  (14, 'Beef Mince (kg)',                      'kg',     153.40),
  (15, 'Lamb Cuts (kg)',                       'kg',     269.10),
  (16, 'Line Fish Fillet (kg)',                'kg',     228.48),
  (17, 'Sausage / Boerewors (kg)',             'kg',     138.24),
  (18, 'Rice (10kg bag)',                      'bag',    254.56),
  (19, 'Maize Meal (12.5kg bag)',              'bag',    200.60),
  (20, 'Cake Flour (12.5kg bag)',              'bag',    224.40),
  (21, 'Cooking Oil (4×5L case)',              'case',   972.80),
  (22, 'Sugar (12.5kg bag)',                   'bag',    272.16),
  (23, 'Fresh Milk (12×1L case)',              'case',   235.20),
  (24, 'Butter Blocks (case)',                 'case',   649.70),
  (25, 'Cheese Block (kg)',                    'kg',     204.24),
  (26, 'Prepared Salad Mix (2kg tub)',         'tub',    152.88),
  (27, 'Prepared Veg Mix (2.5kg tub)',         'tub',    159.08),
  (28, 'Ready Meal Trays (12/case)',           'case',   552.96),
  (29, 'Stock & Sauce Base (6×2L case)',       'case',   372.40),
  (30, 'Bread Rolls (24/bag)',                 'bag',     86.10),
  (31, 'Punnets & Trays (sleeve)',             'sleeve', 299.04),
  (32, 'Cartons — Standard (bundle)',          'bundle', 207.68)
),
-- 18 baskets (blueprint §8.4). The weights are revenue shares, and they are what
-- produce the per-segment cost/sell ratios: wholesale 0.62037 · catering 0.63254
-- · counter 0.59547 · farm-gate 0.60241 → blended 0.61800.
basket(bk, line_no, pidx, weight) as (values
  ('W0', 1::int,  5::int, 0.34::numeric), ('W0', 2,  4, 0.26), ('W0', 3,  6, 0.18), ('W0', 4,  3, 0.13), ('W0', 5,  7, 0.09),
  ('W1', 1,  1, 0.34), ('W1', 2,  2, 0.26), ('W1', 3,  9, 0.18), ('W1', 4,  8, 0.13), ('W1', 5, 12, 0.09),
  ('W2', 1, 13, 0.34), ('W2', 2, 14, 0.26), ('W2', 3, 17, 0.18), ('W2', 4, 16, 0.13), ('W2', 5, 15, 0.09),
  ('W3', 1, 18, 0.34), ('W3', 2, 19, 0.26), ('W3', 3, 20, 0.18), ('W3', 4, 21, 0.13), ('W3', 5, 22, 0.09),
  ('W4', 1, 10, 0.34), ('W4', 2, 11, 0.26), ('W4', 3,  3, 0.18), ('W4', 4,  7, 0.13), ('W4', 5, 12, 0.09),
  ('W5', 1, 23, 0.34), ('W5', 2, 25, 0.26), ('W5', 3, 24, 0.18), ('W5', 4, 26, 0.13), ('W5', 5, 30, 0.09),
  ('W6', 1, 31, 0.34), ('W6', 2, 32, 0.26), ('W6', 3, 29, 0.18), ('W6', 4, 26, 0.13), ('W6', 5, 27, 0.09),
  ('C0', 1, 28, 0.30), ('C0', 2, 27, 0.24), ('C0', 3, 26, 0.20), ('C0', 4, 29, 0.15), ('C0', 5, 30, 0.11),
  ('C1', 1, 13, 0.30), ('C1', 2, 15, 0.24), ('C1', 3, 16, 0.20), ('C1', 4, 14, 0.15), ('C1', 5, 17, 0.11),
  ('C2', 1,  1, 0.30), ('C2', 2,  8, 0.24), ('C2', 3,  9, 0.20), ('C2', 4,  3, 0.15), ('C2', 5, 12, 0.11),
  ('C3', 1, 25, 0.30), ('C3', 2, 24, 0.24), ('C3', 3, 23, 0.20), ('C3', 4, 21, 0.15), ('C3', 5, 22, 0.11),
  ('K0', 1, 26, 0.42), ('K0', 2, 30, 0.31), ('K0', 3, 28, 0.27),
  ('K1', 1, 11, 0.42), ('K1', 2, 10, 0.31), ('K1', 3,  3, 0.27),
  ('K2', 1, 23, 0.42), ('K2', 2, 25, 0.31), ('K2', 3, 24, 0.27),
  ('K3', 1,  1, 0.42), ('K3', 2, 12, 0.31), ('K3', 3, 27, 0.27),
  ('F0', 1,  5, 0.46), ('F0', 2,  4, 0.33), ('F0', 3,  6, 0.21),
  ('F1', 1, 10, 0.46), ('F1', 2, 11, 0.33), ('F1', 3,  7, 0.21),
  ('F2', 1,  2, 0.46), ('F2', 2,  1, 0.33), ('F2', 3, 12, 0.21)
),
-- Segment is read back off the order's customer (1–12 trade, 13–19 events,
-- 20–24 counter, 25–28 farm-gate) so orders and lines can never disagree.
ordbase as (
  select o.id as order_id, o.created_at, a.idx, a.amount,
         (substr(o.customer_id::text, 25))::int as cust_idx
  from amt a
  join of_orders o on o.id = ('0a000000-7e5d-4c1a-9b3f-' || lpad(a.idx::text, 12, '0'))::uuid
  where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
),
keyed as (
  select b.*,
         case
           when b.cust_idx <= 12 then 'W' || (b.idx % 7)::text
           when b.cust_idx <= 19 then 'C' || (b.idx % 4)::text
           when b.cust_idx <= 24 then 'K' || (b.idx % 4)::text
           else                       'F' || (b.idx % 3)::text
         end as bk
  from ordbase b
),
lines as (
  select k.order_id, k.created_at, k.idx, k.amount,
         bs.line_no, bs.weight, p.pidx, p.pname, p.punit, p.sell,
         max(bs.line_no) over (partition by k.idx) as last_line
  from keyed k
  join basket bs on bs.bk = k.bk
  join prod   p  on p.pidx = bs.pidx
),
driver as (
  select l.*, round(l.amount * l.weight / l.sell, 1) as qdrv from lines l
),
balanced as (
  select d.*,
         case when d.line_no = d.last_line
              then round((d.amount - coalesce(
                     sum(d.qdrv * d.sell) filter (where d.line_no < d.last_line)
                       over (partition by d.idx), 0)) / d.sell, 2)
              else d.qdrv
         end as qty
  from driver d
)
select
  ('0b000000-7e5d-4c1a-9b3f-' || lpad((b.idx * 10 + b.line_no)::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  b.order_id,
  ('02000000-7e5d-4c1a-9b3f-' || lpad(b.pidx::text, 12, '0'))::uuid,
  b.pname, b.qty, b.punit, b.sell, b.created_at
from balanced b;


-- ---------------------------------------------------------------------------
-- 6. RECONCILIATION — force each month × segment to its planned total.
--    Every line above is rounded (1 dp on the driver lines, 2 dp on the
--    balancing line), so a group of 60-odd orders can drift by a few rand. This
--    rewrites exactly ONE line per group — the balancing line of the group's
--    highest-indexed order — so `sum(qty * unit_price)` over invoiced+paid
--    orders equals blueprint §8.1 to the cent. 16 rows touched.
--    Idempotent: on a re-run the drift is already zero and the qty is rewritten
--    to the same value.
-- ---------------------------------------------------------------------------
with tgt(ym, seg, total) as (values
  ('2026-04', 'wholesale', 3010000::numeric), ('2026-04', 'catering', 1010000), ('2026-04', 'counter',  660000), ('2026-04', 'farmgate', 470000),
  ('2026-05', 'wholesale', 3190000),          ('2026-05', 'catering', 1090000), ('2026-05', 'counter',  700000), ('2026-05', 'farmgate', 500000),
  ('2026-06', 'wholesale', 3400000),          ('2026-06', 'catering', 1200000), ('2026-06', 'counter',  730000), ('2026-06', 'farmgate', 530000),
  ('2026-07', 'wholesale', 2995000),          ('2026-07', 'catering', 1030000), ('2026-07', 'counter',  665000), ('2026-07', 'farmgate', 465000)
),
ln as (
  select i.id, i.qty, i.unit_price,
         to_char(o.created_at at time zone 'Africa/Johannesburg', 'YYYY-MM') as ym,
         case
           when (substr(o.customer_id::text, 25))::int <= 12 then 'wholesale'
           when (substr(o.customer_id::text, 25))::int <= 19 then 'catering'
           when (substr(o.customer_id::text, 25))::int <= 24 then 'counter'
           else 'farmgate'
         end as seg
  from of_order_items i
  join of_orders o on o.id = i.order_id
  where i.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
    and o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
    and o.status in ('invoiced', 'paid')
),
agg as (
  -- ids are '0b…' + a zero-padded counter, so the highest id in a group IS the
  -- balancing line of its highest-indexed order. Picked by id, never by casting
  -- a uuid to a number — other orgs' rows must never reach a numeric cast.
  select l.ym, l.seg,
         sum(l.qty * l.unit_price) as actual,
         (array_agg(l.id order by l.id desc))[1] as fix_id
  from ln l group by l.ym, l.seg
),
fix as (
  select a.fix_id, t.total - a.actual as delta
  from agg a join tgt t on t.ym = a.ym and t.seg = a.seg
)
update of_order_items t
   set qty = round(t.qty + fix.delta / t.unit_price, 6)
  from fix
 where t.id = fix.fix_id;


-- ---------------------------------------------------------------------------
-- 7. INVOICES — one per revenue order (group 0c, same index as its order).
--    INV-4142 … INV-4599. `issue_date` is the order date, `due_date` is
--    issue + the customer's terms.
--      paid            418   settled in full below
--      overdue           8   the stale June orders — due date already past
--      sent             14   July, newest, due dates still in the future
--      viewed           10   July
--      partially_paid    8   July, 35–60% received
--    OPEN_INVOICE_STATUSES in planwise-data.ts:81 is exactly
--    ('sent','viewed','partially_paid','overdue'), so those 40 invoices are the
--    receivables book: ≈ R1.9M outstanding, ≈ R0.44M of it overdue.
-- ---------------------------------------------------------------------------
insert into of_invoices (
  id, org_id, customer_id, order_id, invoice_number, status, issue_date, due_date,
  vat_rate, rebate_pct, discount, customer_po, billing_address, delivery_address,
  delivery_instructions, notes, terms, sent_at, created_at, updated_at)
with base as (
  select o.id as order_id, o.customer_id, o.status as order_status, o.created_at,
         o.customer_po, o.delivery_address, o.delivery_instructions,
         (substr(o.id::text, 25))::int as idx,
         (o.created_at at time zone 'Africa/Johannesburg')::date as issue_date,
         to_char(o.created_at at time zone 'Africa/Johannesburg', 'YYYY-MM') as ym,
         coalesce(c.payment_terms_days, 0) as terms,
         coalesce(c.rebate_pct, 0) as rebate_pct,
         c.billing_address
  from of_orders o
  join of_customers c on c.id = o.customer_id
  where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
    and o.status in ('invoiced', 'paid')
),
open_july as (
  select b.order_id, row_number() over (order by b.created_at desc, b.idx desc) as rn
  from base b where b.order_status = 'invoiced' and b.ym = '2026-07'
)
select
  ('0c000000-7e5d-4c1a-9b3f-' || lpad(b.idx::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  b.customer_id,
  b.order_id,
  'INV-' || lpad((4141 + b.idx)::text, 4, '0'),
  case
    when b.order_status = 'paid' then 'paid'
    when b.ym = '2026-06'        then 'overdue'
    when j.rn <= 14              then 'sent'
    when j.rn <= 24              then 'viewed'
    else                              'partially_paid'
  end,
  b.issue_date,
  b.issue_date + b.terms,
  15,
  b.rebate_pct,
  0,
  b.customer_po,
  b.billing_address,
  b.delivery_address,
  b.delivery_instructions,
  case when b.rebate_pct > 0
       then 'Contract rebate of ' || b.rebate_pct::text || '% applied to this invoice.' end,
  case when b.terms = 0 then 'Payable on collection.' else b.terms::text || ' days from invoice date.' end,
  b.created_at + interval '2 hours',
  b.created_at,
  b.created_at
from base b
left join open_july j on j.order_id = b.order_id;

-- Back-link the order to its invoice. getOrderDetail (orderflow-data.ts:388)
-- loads the invoice, its lines and its payments off `of_orders.invoice_id` —
-- leave it null and every order detail page reads as un-invoiced.
update of_orders o
   set invoice_id = i.id
  from of_invoices i
 where i.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and i.order_id = o.id;


-- ---------------------------------------------------------------------------
-- 8. INVOICE LINES — a straight projection of the order lines (group 0d, same
--    counter as the of_order_items row it came from; sort_order = the line no).
--    The Dashboard, Invoices, Payments and Credit-note views all total money
--    from of_invoice_items, so this projection is what makes the money tiles
--    agree with the order book.
-- ---------------------------------------------------------------------------
insert into of_invoice_items (id, org_id, invoice_id, stock_item_id, name, qty, unit, unit_price, sort_order, created_at)
select ('0d000000-7e5d-4c1a-9b3f-' || substr(oi.id::text, 25))::uuid,
       oi.org_id, inv.id, oi.stock_item_id, oi.name, oi.qty, oi.unit, oi.unit_price,
       (substr(oi.id::text, 34)::int % 10),
       oi.created_at
from of_order_items oi
join of_orders   o   on o.id  = oi.order_id
join of_invoices inv on inv.order_id = o.id
where oi.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 9. PAYMENTS (group 0e — settling payment = order index; a partial payment on
--    a partially_paid invoice = 500000 + order index).
--    The amount is recomputed from the invoice's own lines with exactly the
--    arithmetic docTotals() uses (subtotal → rebate → net → 15% VAT → total), so
--    `effectiveInvoiceStatus` agrees with the stored status instead of quietly
--    downgrading a "paid" invoice to part-paid over a rounding cent.
--    paid_on is 1–26 days after issue, never later than today (2026-07-29).
-- ---------------------------------------------------------------------------
insert into of_payments (id, org_id, invoice_id, customer_id, amount, method, paid_on, reference, notes, created_at)
with sums as (
  select invoice_id, round(sum(qty * unit_price), 2) as sub
  from of_invoice_items
  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  group by invoice_id
),
tot as (
  select i.id, i.customer_id, i.status, i.issue_date,
         (substr(i.id::text, 25))::int as idx,
         (substr(i.customer_id::text, 25))::int as cust_idx,
         round(s.sub - round(s.sub * coalesce(i.rebate_pct, 0) / 100, 2), 2) as net
  from of_invoices i
  join sums s on s.invoice_id = i.id
  where i.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
),
inv as (
  select t.*, round(t.net + round(t.net * 0.15, 2), 2) as total,
         least(t.issue_date + (case when t.issue_date >= date '2026-07-05'
                                    then 1 + (t.idx % 8) else 2 + (t.idx % 25) end),
               date '2026-07-29') as paid_on
  from tot t
)
select
  ('0e000000-7e5d-4c1a-9b3f-' || lpad(inv.idx::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
  inv.id, inv.customer_id,
  inv.total,
  case when inv.cust_idx between 20 and 25
       then (array['cash','card','card'])[(inv.idx % 3) + 1] else 'eft' end,
  inv.paid_on,
  'PMT-' || lpad(inv.idx::text, 5, '0'),
  null::text,
  (inv.paid_on + time '11:20')::timestamp at time zone 'Africa/Johannesburg'
from inv
where inv.status = 'paid'
union all
select
  ('0e000000-7e5d-4c1a-9b3f-' || lpad((500000 + inv.idx)::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
  inv.id, inv.customer_id,
  round(inv.total * (array[0.35,0.40,0.45,0.50,0.55,0.60])[(inv.idx % 6) + 1], 2),
  'eft',
  inv.paid_on,
  'PMT-' || lpad(inv.idx::text, 5, '0') || '-A',
  'Part payment received — balance promised with the next run.',
  (inv.paid_on + time '11:20')::timestamp at time zone 'Africa/Johannesburg'
from inv
where inv.status = 'partially_paid';


-- ---------------------------------------------------------------------------
-- 10. CREDIT NOTES — 6 (group 11) with one credited line each (group 12).
--     Dates are derived from the linked invoice so a credit note can never
--     pre-date the invoice it credits, and never lands after today.
-- ---------------------------------------------------------------------------
insert into of_credit_notes (id, org_id, invoice_id, customer_id, credit_number, status, reason, notes, issue_date, vat_rate, created_at)
select
  ('11000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  i.id, i.customer_id,
  'CN-' || lpad(v.n::text, 4, '0'),
  v.status, v.reason, v.notes,
  least(i.issue_date + v.lag, date '2026-07-29'),
  15,
  ((least(i.issue_date + v.lag, date '2026-07-29') + time '10:40')::timestamp at time zone 'Africa/Johannesburg')
from (values
  (1::int, 231::int, 6::int, 'issued', 'Short delivery',        'Two crates short on the morning load — credited in full.'),
  (2,      298,      9,      'issued', 'Quality claim',         'Product below the agreed spec on arrival; photographs on file.'),
  (3,      356,      4,      'issued', 'Pricing correction',    'Line billed off the standard list instead of the contract rate.'),
  (4,      402,      3,      'issued', 'Damaged in transit',    'Pallet shifted on the route; damage noted on the delivery note.'),
  (5,      452,      5,      'issued', 'Returned goods',        'Box count short at the gate — returned and credited.'),
  (6,      415,      2,      'draft',  'Admin correction',      'Duplicate line billed. Held in draft pending sign-off.')
) as v(n, inv_idx, lag, status, reason, notes)
join of_invoices i on i.id = ('0c000000-7e5d-4c1a-9b3f-' || lpad(v.inv_idx::text, 12, '0'))::uuid
where i.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

insert into of_credit_note_items (id, org_id, credit_note_id, invoice_item_id, name, qty, unit, unit_price, created_at)
select
  ('12000000-7e5d-4c1a-9b3f-' || lpad((v.n * 10 + 1)::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  cn.id, ii.id, ii.name,
  round(ii.qty * v.frac, 2), ii.unit, ii.unit_price,
  cn.created_at
from (values
  (1::int, 231::int, 0.12::numeric),
  (2,      298,      0.20),
  (3,      356,      0.08),
  (4,      402,      0.14),
  (5,      452,      0.25),
  (6,      415,      0.10)
) as v(n, inv_idx, frac)
join of_credit_notes cn on cn.id = ('11000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid
join lateral (
  select x.* from of_invoice_items x
  where x.invoice_id = ('0c000000-7e5d-4c1a-9b3f-' || lpad(v.inv_idx::text, 12, '0'))::uuid
  order by x.sort_order limit 1
) ii on true;


-- ---------------------------------------------------------------------------
-- 11. DELIVERY NOTES — 40 July notes (group 13) with their first three lines
--     (group 14). 22 delivered · 12 out for delivery · 6 draft against the
--     confirmed pipeline orders that have not shipped yet.
-- ---------------------------------------------------------------------------
insert into of_delivery_notes (
  id, org_id, order_id, invoice_id, customer_id, dn_number, status,
  delivery_address, instructions, driver_name, vehicle, delivered_at, signed_by, notes, created_at)
with spec as (
  select n,
         case when n <= 22 then 349 + n                 -- 350–371  wholesale, earlier in July
              when n <= 34 then 396 + (n - 23)          -- 396–407  the last week of July
              else              477 + (n - 35) end as ord_idx,  -- 477–482 confirmed pipeline
         case when n <= 22 then 'delivered'
              when n <= 34 then 'out_for_delivery'
              else              'draft' end as status
  from generate_series(1, 40) as n
)
select
  ('13000000-7e5d-4c1a-9b3f-' || lpad(s.n::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  o.id,
  case when s.ord_idx <= 458
       then ('0c000000-7e5d-4c1a-9b3f-' || lpad(s.ord_idx::text, 12, '0'))::uuid end,
  o.customer_id,
  'DN-' || lpad(s.n::text, 4, '0'),
  s.status,
  o.delivery_address,
  o.delivery_instructions,
  (array['Imraan Davids','Thabo Maseko','Marius Fourie','Vusi Zwane','Riaan Botha'])[(s.n % 5) + 1],
  (array['CA 418-772','CA 511-390','CA 627-118','CJ 204-885','CA 733-041'])[(s.n % 5) + 1],
  case when s.status = 'delivered'
       then o.created_at + interval '1 day 4 hours' end,
  case when s.status = 'delivered'
       then (array['B. Cloete','N. Naidoo','P. Roberts','L. Mabaso','D. Engelbrecht'])[(s.n % 5) + 1] end,
  case when s.status = 'draft' then 'Awaiting the pick list — not yet loaded.' end,
  o.created_at + interval '30 minutes'
from spec s
join of_orders o on o.id = ('0a000000-7e5d-4c1a-9b3f-' || lpad(s.ord_idx::text, 12, '0'))::uuid
where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

insert into of_delivery_note_items (id, org_id, delivery_note_id, name, qty, unit, created_at)
select
  ('14000000-7e5d-4c1a-9b3f-' ||
     lpad(((substr(dn.id::text, 25))::int * 10 + ((substr(oi.id::text, 25))::bigint % 10))::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  dn.id, oi.name, oi.qty, oi.unit, dn.created_at
from of_delivery_notes dn
join of_order_items oi on oi.order_id = dn.order_id
where dn.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  -- line no is the last digit of the id's counter. Compared as a CHARACTER, not
  -- cast to a number: a scan-level qual can be evaluated against rows from other
  -- orgs, whose random uuids would blow up a ::bigint cast.
  and right(oi.id::text, 1) in ('1', '2', '3');


-- ---------------------------------------------------------------------------
-- 12. QUOTES — 18 (group 0f) with their lines (group 10). Catering-heavy:
--     8 sent · 4 accepted (2 already converted to an order) · 3 draft ·
--     2 rejected · 1 expired.
--     Every quote takes its customer AND its lines from a real order, scaled,
--     so the priced lines are always at the catalogue sell price and the quote
--     always belongs to a customer who actually buys those products.
--     valid_until on the live quotes is deliberately in the future —
--     effectiveQuoteStatus() re-reads a lapsed `sent` quote as expired.
-- ---------------------------------------------------------------------------
insert into of_quotes (
  id, org_id, customer_id, quote_number, status, issue_date, valid_until, vat_rate,
  customer_po, delivery_address, notes, converted_order_id, created_at, updated_at)
select
  ('0f000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  o.customer_id,
  'QTE-' || lpad((201 + v.n)::text, 4, '0'),
  v.status,
  v.issue_date,
  v.issue_date + 21,
  15,
  case when v.status in ('accepted','sent') then 'ENQ-' || lpad(v.n::text, 4, '0') end,
  o.delivery_address,
  v.notes,
  case when v.converted then o.id end,
  ((v.issue_date + time '09:35')::timestamp at time zone 'Africa/Johannesburg'),
  ((v.issue_date + time '09:35')::timestamp at time zone 'Africa/Johannesburg')
from (values
  ( 1::int, 'sent',     date '2026-07-28', 408::int, false, 'Spring function programme — priced for weekly delivery.'),
  ( 2,      'sent',     date '2026-07-27', 409,      false, 'Conference season volumes, three-month indicative pricing.'),
  ( 3,      'sent',     date '2026-07-24', 410,      false, 'Expanded prepared-lines range for the new site.'),
  ( 4,      'sent',     date '2026-07-22', 411,      false, 'Trial order ahead of a standing weekly slot.'),
  ( 5,      'sent',     date '2026-07-20', 412,      false, 'Weekend function pack — final counts to be confirmed.'),
  ( 6,      'sent',     date '2026-07-17', 360,      false, 'Additional depot added to the existing trade agreement.'),
  ( 7,      'sent',     date '2026-07-15', 355,      false, 'Quarterly volume review — held pricing on the core lines.'),
  ( 8,      'sent',     date '2026-07-13', 413,      false, 'Off-site catering brief, priced per cover.'),
  ( 9,      'accepted', date '2026-07-10', 419,      true,  'Accepted by e-mail; converted straight to an order.'),
  (10,      'accepted', date '2026-07-06', 420,      true,  'Accepted on the call; converted and delivered.'),
  (11,      'accepted', date '2026-06-29', 370,      false, 'Accepted — first delivery scheduled for August.'),
  (12,      'accepted', date '2026-06-22', 450,      false, 'Collective buy-in accepted; collections from the gate.'),
  (13,      'draft',    date '2026-07-28', 416,      false, 'Draft — waiting on the final headcount.'),
  (14,      'draft',    date '2026-07-27', 417,      false, 'Draft — pending a costing check on the prepared lines.'),
  (15,      'draft',    date '2026-07-24', 366,      false, 'Draft — depends on the outcome of the packaging tender.'),
  (16,      'rejected', date '2026-07-06', 418,      false, 'Lost on price against an incumbent supplier.'),
  (17,      'rejected', date '2026-06-30', 372,      false, 'Volumes withdrawn — the site did not open on time.'),
  (18,      'expired',  date '2026-06-01', 421,      false, 'No response inside the validity window.')
) as v(n, status, issue_date, src_order_idx, converted, notes)
join of_orders o on o.id = ('0a000000-7e5d-4c1a-9b3f-' || lpad(v.src_order_idx::text, 12, '0'))::uuid
where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

insert into of_quote_items (id, org_id, quote_id, stock_item_id, name, qty, unit, unit_price, sort_order, created_at)
select
  ('10000000-7e5d-4c1a-9b3f-' ||
     lpad((v.n * 10 + ((substr(oi.id::text, 25))::bigint % 10))::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  q.id, oi.stock_item_id, oi.name,
  round(oi.qty * v.scale, 1), oi.unit, oi.unit_price,
  ((substr(oi.id::text, 25))::bigint % 10)::int,
  q.created_at
from (values
  ( 1::int, 408::int, 1.10::numeric), ( 2, 409, 0.92), ( 3, 410, 1.35), ( 4, 411, 0.78),
  ( 5, 412, 1.05), ( 6, 360, 0.88), ( 7, 355, 1.22), ( 8, 413, 0.95),
  ( 9, 419, 1.00), (10, 420, 1.00), (11, 370, 1.15), (12, 450, 0.90),
  (13, 416, 1.00), (14, 417, 1.40), (15, 366, 0.85), (16, 418, 1.25),
  (17, 372, 0.95), (18, 421, 1.30)
) as v(n, src_order_idx, scale)
join of_quotes q on q.id = ('0f000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid
join of_order_items oi on oi.order_id = ('0a000000-7e5d-4c1a-9b3f-' || lpad(v.src_order_idx::text, 12, '0'))::uuid
where q.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

-- Close the loop: the two converted quotes are also linked from their order.
update of_orders o
   set quote_id = q.id
  from of_quotes q
 where q.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
   and q.converted_order_id = o.id;


-- ---------------------------------------------------------------------------
-- 13. QUOTE REQUESTS — 6 website enquiries (group 41).
--     getOrderFlowSnapshot counts exactly `status='new' AND flagged_spam=false`
--     for the OrderFlow badge, so all six are clean, un-actioned leads and the
--     badge reads 6. customer_id / quote_id stay NULL: a request records only
--     what a stranger CLAIMED until a human links it.
-- ---------------------------------------------------------------------------
insert into of_quote_requests (
  id, org_id, source, from_email, contact_name, contact_email, contact_phone,
  business_name, message, requested_items, status, flagged_spam,
  received_at, created_at, updated_at)
select
  ('41000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  'email', 'forms@meridianfood.co.za',
  v.contact_name, v.contact_email, v.contact_phone, v.business_name, v.message,
  v.items::jsonb, 'new', false,
  v.received_at, v.received_at, v.received_at
from (values
  (1::int, 'Nadia Petersen',  'nadia@vergelegenkitchen.co.za',   '021 847 1220', 'Vergelegen Kitchen',
   'We are opening a second site in September and need a weekly produce and prepared-lines quote. Roughly 120 covers a day.',
   '[{"description":"Mixed salad leaf","quantity":8,"unit":"crate"},{"description":"Prepared veg mix","quantity":20,"unit":"tub"},{"description":"Bread rolls","quantity":40,"unit":"bag"}]',
   timestamptz '2026-07-28 16:42+02'),
  (2, 'Sipho Ngcobo',    'sipho@kayamandifoods.co.za',      '021 886 3390', 'Kayamandi Foods',
   'Looking for a monthly dry-goods price list — rice, maize meal, oil and sugar. Can collect if that is cheaper.',
   '[{"description":"Rice 10kg","quantity":60,"unit":"bag"},{"description":"Maize meal 12.5kg","quantity":40,"unit":"bag"},{"description":"Cooking oil","quantity":12,"unit":"case"}]',
   timestamptz '2026-07-28 09:15+02'),
  (3, 'Marlene du Toit', 'marlene@boschendalfunctions.co.za', '021 870 4488', 'Boschendal Function Co.',
   'Quote for a 400-guest harvest lunch on 12 September. Platters and grazing boards, delivered on the morning.',
   '[{"description":"Cheese block","quantity":18,"unit":"kg"},{"description":"Ready meal trays","quantity":30,"unit":"case"},{"description":"Prepared salad mix","quantity":45,"unit":"tub"}]',
   timestamptz '2026-07-27 11:08+02'),
  (4, 'Ruan Steenkamp',  'ruan@westcoastprovisions.co.za',  '022 713 5510', 'West Coast Provisions',
   'We distribute along the R27 and would like trade pricing on proteins and chilled lines. Weekly volumes attached.',
   '[{"description":"Chicken portions","quantity":25,"unit":"box"},{"description":"Beef mince","quantity":180,"unit":"kg"},{"description":"Fresh milk","quantity":30,"unit":"case"}]',
   timestamptz '2026-07-25 14:30+02'),
  (5, 'Thandi Mokoena',  'thandi@paarlmarketstall.co.za',   '021 872 6612', 'Paarl Market Stall',
   'Small stall, Saturdays only. What would a weekly farm-gate box work out at for about 40 boxes?',
   '[{"description":"Seasonal citrus","quantity":10,"unit":"box"},{"description":"Seasonal apples","quantity":8,"unit":"box"},{"description":"Butternut","quantity":60,"unit":"kg"}]',
   timestamptz '2026-07-24 08:52+02'),
  (6, 'Werner Fourie',   'werner@helderbergstaffdining.co.za','021 851 9970', 'Helderberg Staff Dining',
   'Staff dining for 300. Interested in ready meal trays and stock bases on a standing weekly order.',
   '[{"description":"Ready meal trays","quantity":24,"unit":"case"},{"description":"Stock and sauce base","quantity":10,"unit":"case"},{"description":"Prepared veg mix","quantity":32,"unit":"tub"}]',
   timestamptz '2026-07-23 15:26+02')
) as v(n, contact_name, contact_email, contact_phone, business_name, message, items, received_at);


-- ---------------------------------------------------------------------------
-- 14. ACTIVITY FEED — 60 rows (group 3f), built FROM the real rows above so
--     every entity_id resolves and every timestamp is consistent with the
--     record it describes. The dashboard reads the newest 40; a customer
--     profile reads the newest 60 for that customer.
--     (`entity_id` / `customer_id` on of_activity are plain uuids, no FK — the
--     price-list row points at writer (c)'s base list by blueprint id.)
-- ---------------------------------------------------------------------------
insert into of_activity (id, org_id, actor_email, entity_type, entity_id, customer_id, event, description, created_at)
with feed as (
  select i.created_at, 'invoice'::text as etype, i.id as eid, i.customer_id as cid,
         'invoice_created'::text as event,
         ('Invoice ' || i.invoice_number || ' raised from the order')::text as descr,
         'demo@vyso.co.za'::text as actor
  from (select * from of_invoices where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
        order by created_at desc limit 20) i
  union all
  select p.created_at, 'payment', p.id, p.customer_id, 'payment_recorded',
         'Payment of R' || to_char(p.amount, 'FM999G999G990D00') || ' recorded (' || p.method || ')',
         'accounts@meridianfood.co.za'
  from (select * from of_payments where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
        order by paid_on desc, created_at desc limit 15) p
  union all
  select o.created_at, 'order', o.id, o.customer_id, 'order_created',
         'Order ' || coalesce(o.order_number, '') || ' captured (' || o.status || ')',
         'demo@vyso.co.za'
  from (select * from of_orders where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
        order by created_at desc limit 10) o
  union all
  select q.created_at, 'quote', q.id, q.customer_id, 'quote_' || q.status,
         'Quote ' || q.quote_number || ' — ' || q.status,
         'demo@vyso.co.za'
  from (select * from of_quotes where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
        order by created_at desc limit 5) q
  union all
  select d.created_at, 'delivery_note', d.id, d.customer_id, 'delivery_note_' || d.status,
         'Delivery note ' || d.dn_number || ' — ' || replace(d.status, '_', ' '),
         'dispatch@meridianfood.co.za'
  from (select * from of_delivery_notes where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
        order by created_at desc limit 4) d
  union all
  select cn.created_at, 'credit_note', cn.id, cn.customer_id, 'credit_note_issued',
         'Credit note ' || cn.credit_number || ' — ' || cn.reason,
         'accounts@meridianfood.co.za'
  from (select * from of_credit_notes where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
        order by created_at desc limit 3) cn
  union all
  select c.updated_at, 'customer', c.id, c.id, 'customer_updated',
         'Account details reviewed for ' || c.name,
         'demo@vyso.co.za'
  from (select * from of_customers where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
        order by name limit 2) c
  union all
  select timestamptz '2026-07-21 08:05+02', 'price_list',
         '15000000-7e5d-4c1a-9b3f-000000000001'::uuid, null::uuid, 'price_list_updated',
         'Standard trade list re-published after the cooking-oil cost rise',
         'demo@vyso.co.za'
  union all
  select timestamptz '2026-07-16 15:40+02', 'product',
         '02000000-7e5d-4c1a-9b3f-000000000021'::uuid, null::uuid, 'product_price_changed',
         'Cooking Oil (4×5L case) cost stepped 13.1% — sell price under review',
         'demo@vyso.co.za'
),
numbered as (
  select f.*, row_number() over (order by f.created_at desc, f.eid) as n from feed f
)
select
  ('3f000000-7e5d-4c1a-9b3f-' || lpad(numbered.n::text, 12, '0'))::uuid,
  '01000000-7e5d-4c1a-9b3f-000000000001',
  numbered.actor, numbered.etype, numbered.eid, numbered.cid,
  numbered.event, numbered.descr, numbered.created_at
from numbered
where numbered.n <= 60;


-- ---------------------------------------------------------------------------
-- 15. Self-check (safe to leave in — SELECTs only). Expected results:
--       2026-04 | 5150000 | 110      2026-06 | 5860000 | 123
--       2026-05 | 5480000 | 116      2026-07 | 5155000 | 109
-- ---------------------------------------------------------------------------
select to_char(o.created_at at time zone 'Africa/Johannesburg', 'YYYY-MM') as month,
       round(sum(i.qty * i.unit_price)) as revenue,
       count(distinct o.id) as orders
from of_orders o
join of_order_items i on i.order_id = o.id
where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and o.status in ('invoiced', 'paid')
group by 1 order by 1;


-- ##########################################################################
-- ##  SECTION 2C
-- ##  PricePilot — targets, price lists, overrides, versions, complaints
-- ##  (apply order 4 and 7: needs customers + stock items + July orders)
-- ##########################################################################

-- ===========================================================================
-- DEMO SEED (c) — PricePilot for 'Meridian Food Co.'
-- ---------------------------------------------------------------------------
-- PricePilot owns very little data of its own: almost every number on the module
-- is DERIVED from OrderFlow (of_orders + of_order_items, statuses invoiced|paid)
-- and ProcurePulse (pp_stock_items.avg_unit_price + price_history). This file
-- seeds only the four PricePilot-owned surfaces the data layer reads directly:
--
--   * pl_targets             — org margin / revenue / GP / opex goals.
--                              Read by pricepilot pages, planwise-data.ts:113,
--                              wastewatch-data.ts:461 and insightgen-data.ts:384.
--   * pl_price_lists         — ONE base list (customer_id IS NULL, cadence
--                              'standard', EARLIEST created_at → pickBaseList,
--                              pricepilot.ts:91) plus 6 customer contract lists
--                              with validity windows (pl-validity.sql columns).
--   * pl_overrides           — per-product margin overrides. The override on the
--                              BASE list IS the product's catalogue margin
--                              (productMargins, pricepilot.ts:105); contract-list
--                              overrides only surface on the customer pages.
--   * pl_complaints          — customer quality/pricing complaints, each hung off
--                              a real customer + a real July order.
--   * pl_price_list_versions — published margin snapshots (pl-versions.sql), so
--                              the version-history / compare panel has something
--                              to diff. GUARDED: that table ships in a migration
--                              that may not be applied yet.
--
-- WHY THE NUMBERS ARE WHAT THEY ARE
-- ---------------------------------
-- target_margin_pct = 41. PricePilot reads it as a MARK-UP target: 27 of the 32
-- catalogue products sit at or above it and 5 sit below (proteins + fresh milk),
-- which is exactly the re-price-alert set. InsightGen reads the same number as a
-- GROSS-MARGIN target: realised GM across the seeded sales is 38.2%, i.e. −2.8
-- points, past MARGIN_WARN_PP (2) but inside MARGIN_CRITICAL_PP (5), so the
-- food-cost-variance anomaly fires at 'warning' rather than 'critical'.
--
--   pricingHealth = 30 (setup) + 30 (avg margin 64% >> 41% target, capped)
--                 + 25 x (27/32 at-or-above) + 15 (sales this month) = 96/100.
--
-- The 5 below-target products (#13 Chicken Portions 34%, #14 Beef Mince 30%,
-- #15 Lamb Cuts 38%, #16 Line Fish Fillet 36%, #23 Fresh Milk 40%) all appear in
-- OrderFlow baskets W2 / W5 / C1 / C3 / K2, which are used by July orders inside
-- computeRepriceAlerts' rolling 30-day window — so units > 0 and all five become
-- alerts (quota is >= 3). See blueprint §3 / §8.4.
--
-- Contract expiry: 2 lists already expired and 2 inside EXPIRY_SOON_DAYS (14),
-- giving 4 contract notifications. Together with 5 re-price alerts, 7 cost
-- spikes (ProcurePulse price_history) and 1 below-target roll-up that is the
-- 17-item PricePilot notification feed.
--
-- All money is ZAR. Re-runnable: the delete preamble is scoped to the Meridian
-- org UUID literally, children before parents, and every insert carries an
-- explicit blueprint id.
--
-- HOW TO APPLY: this is a fragment of supabase/demo-all-in-one.sql — it is run in
-- place, after the ProcurePulse stock seed (pp_stock_items) and the OrderFlow
-- customer seed (of_customers); pl_complaints additionally wants of_orders.
--
-- ASSEMBLER NOTE — this fragment has ONE split point, matching blueprint §13.4:
--   sections 0..5  → seed step 4  (after of_customers / pp_stock_items)
--   section 6      → seed step 7  (after of_orders + of_order_items)
-- The split marker is the line `-- >>> SPLIT: pl_complaints (seed step 7) <<<`.
-- Everything above it is safe to run without any of_orders rows; section 6 uses
-- a LEFT JOIN so it still inserts (with a fallback customer) if run early.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 0) Delete preamble — Meridian only, children before parents.
--    pl_price_lists cascades to pl_overrides / pl_price_list_versions, but we
--    delete them explicitly first so the intent is readable and so a partially
--    applied earlier run leaves nothing behind.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.pl_price_list_versions') is not null then
    delete from pl_price_list_versions where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
  end if;
end $$;

delete from pl_overrides   where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pl_price_lists where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pl_complaints  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pl_targets     where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 1) pl_targets — one row, PK org_id.
--
--      Revenue target      R5 600 000 / month   (four-month mean actual 5 500 000)
--      Gross-profit target R2 140 000 / month   (= 38.2% of the July plan, rounded up)
--      Monthly opex        R1 829 500           (labour 1 335 000 + waste 81 700
--                                                + overheads 412 800 — the PlanWise
--                                                budget lines 4..14)
--      Target margin       41%
--
--    Net profit as PricePilot renders it = gross profit − monthly_opex, so the
--    July plan lands at 2 105 000 − 1 829 500 = R275 500 (5.0% net). These four
--    numbers must not drift: PlanWise, WasteWatch and InsightGen all read them.
-- ---------------------------------------------------------------------------
insert into pl_targets (org_id, target_margin_pct, monthly_revenue_target, monthly_gross_profit_target, monthly_opex, updated_at)
values ('01000000-7e5d-4c1a-9b3f-000000000001', 41, 5600000, 2140000, 1829500, timestamptz '2026-07-01 07:30+02')
on conflict (org_id) do update
  set target_margin_pct           = excluded.target_margin_pct,
      monthly_revenue_target      = excluded.monthly_revenue_target,
      monthly_gross_profit_target = excluded.monthly_gross_profit_target,
      monthly_opex                = excluded.monthly_opex,
      updated_at                  = excluded.updated_at;


-- ---------------------------------------------------------------------------
-- 2) pl_price_lists — group `15`, counter 1..7.
--
--    Row 1 is THE base list: customer_id null, cadence 'standard', and the
--    earliest created_at in the org (2025-09-01). pickBaseList() sorts ascending
--    by created_at and takes the first customer-less 'standard' list, so every
--    catalogue margin in the module resolves against this row. Its
--    default_margin_pct = 66 is the Field Produce mark-up; products 1..12 inherit
--    it with no override (see §3 of the blueprint).
--
--    Rows 2..7 are customer contracts. valid_from / valid_until are deliberately
--    current_date-relative so the demo never goes stale:
--      2 Boland Trading      until -12d  → expired
--      3 Table Bay           until  -3d  → expired
--      4 Cape Provisions     until  +6d  → expiring soon (<= EXPIRY_SOON_DAYS 14)
--      5 Corporate Dining    until +13d  → expiring soon
--      6 Winelands Wholesale until +96d  → active
--      7 Riverside Hosp.     until +210d → active
--    → 2 'contract_expired' (high) + 2 'contract_expiring' (medium) notifications.
--
--    Contract default margins sit 3–6 points under the base list: negotiated
--    trade pricing, still comfortably above the 41% target on produce lines.
--
--    created_at is an ABSOLUTE literal on every row (never now() - interval), so
--    the base list stays the earliest row no matter when the file is re-run —
--    pickBaseList would otherwise be at the mercy of the clock.
-- ---------------------------------------------------------------------------
insert into pl_price_lists (id, org_id, name, customer_id, default_margin_pct, cadence, valid_from, valid_until, created_at)
values
  -- id                                      org                                     name                                  customer (05-group)                     margin cadence     valid_from          valid_until          created_at
  ('15000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', 'Standard trade list',                 null,                                     66, 'standard', null,               null,                timestamptz '2025-09-01 08:00+02'),
  ('15000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', 'Boland Trading — contract pricing',   '05000000-7e5d-4c1a-9b3f-000000000001', 62, 'weekly',   current_date - 300, current_date - 12,   timestamptz '2025-10-01 09:20+02'),
  ('15000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', 'Table Bay Distributors — contract',   '05000000-7e5d-4c1a-9b3f-000000000005', 61, 'monthly',  current_date - 340, current_date - 3,    timestamptz '2025-09-05 09:20+02'),
  ('15000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', 'Cape Provisions Group — contract',    '05000000-7e5d-4c1a-9b3f-000000000002', 60, 'monthly',  current_date - 180, current_date + 6,    timestamptz '2026-01-28 09:20+02'),
  ('15000000-7e5d-4c1a-9b3f-000000000005', '01000000-7e5d-4c1a-9b3f-000000000001', 'Corporate Dining Partners — contract','05000000-7e5d-4c1a-9b3f-000000000017', 63, 'monthly',  current_date - 150, current_date + 13,   timestamptz '2026-02-27 09:20+02'),
  ('15000000-7e5d-4c1a-9b3f-000000000006', '01000000-7e5d-4c1a-9b3f-000000000001', 'Winelands Wholesale — contract',      '05000000-7e5d-4c1a-9b3f-000000000003', 61, 'weekly',   current_date - 120, current_date + 96,   timestamptz '2026-03-29 09:20+02'),
  ('15000000-7e5d-4c1a-9b3f-000000000007', '01000000-7e5d-4c1a-9b3f-000000000001', 'Riverside Hospitality — contract',    '05000000-7e5d-4c1a-9b3f-000000000019', 63, 'monthly',  current_date - 60,  current_date + 210,  timestamptz '2026-05-28 09:20+02');


-- ---------------------------------------------------------------------------
-- 3) pl_overrides on the BASE list — group `16`, counter = 1*100 + product_index.
--
--    These 20 rows ARE the catalogue margins for products 13..32; products 1..12
--    have no override and inherit the list default of 66%. Each margin here is
--    the blueprint §3 "markup %" for that product, and it is what makes
--        sellPrice(avg_unit_price, margin) == the `sell` price OrderFlow charges
--    on every of_order_items / of_invoice_items line. Do not change one without
--    the other — PricePilot's catalogue margin, PlanWise's COGS and InsightGen's
--    realised margin all hang off that identity.
--
--    The five rows marked BELOW TARGET (< 41) are the re-price-alert set:
--    proteins and fresh milk, where absorbed cost rises were not passed on.
-- ---------------------------------------------------------------------------
insert into pl_overrides (id, org_id, price_list_id, stock_item_id, margin_pct, created_at)
select ('16000000-7e5d-4c1a-9b3f-' || lpad((100 + v.p)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001',
       '15000000-7e5d-4c1a-9b3f-000000000001',
       ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid,
       v.margin_pct,
       timestamptz '2025-09-01 08:05+02'
from (values
  -- product, margin  -- §3 name / category
  (13,  34),          -- Chicken Portions (10kg box)   Proteins        BELOW TARGET
  (14,  30),          -- Beef Mince (kg)               Proteins        BELOW TARGET
  (15,  38),          -- Lamb Cuts (kg)                Proteins        BELOW TARGET
  (16,  36),          -- Line Fish Fillet (kg)         Proteins        BELOW TARGET
  (17,  44),          -- Sausage / Boerewors (kg)      Proteins
  (18,  72),          -- Rice (10kg bag)               Dry Goods
  (19,  70),          -- Maize Meal (12.5kg bag)       Dry Goods
  (20,  70),          -- Cake Flour (12.5kg bag)       Dry Goods
  (21,  52),          -- Cooking Oil (4x5L case)       Dry Goods
  (22,  62),          -- Sugar (12.5kg bag)            Dry Goods
  (23,  40),          -- Fresh Milk (12x1L case)       Dairy & Chilled BELOW TARGET
  (24,  46),          -- Butter Blocks (case)          Dairy & Chilled
  (25,  48),          -- Cheese Block (kg)             Dairy & Chilled
  (26,  96),          -- Prepared Salad Mix (2kg tub)  Prepared Lines
  (27,  94),          -- Prepared Veg Mix (2.5kg tub)  Prepared Lines
  (28,  92),          -- Ready Meal Trays (12/case)    Prepared Lines
  (29,  90),          -- Stock & Sauce Base (case)     Prepared Lines
  (30, 105),          -- Bread Rolls (24/bag)          Prepared Lines
  (31,  78),          -- Punnets & Trays (sleeve)      Packaging
  (32,  76)           -- Cartons — Standard (bundle)   Packaging
) as v(p, margin_pct);


-- ---------------------------------------------------------------------------
-- 4) pl_overrides on the CONTRACT lists — group `16`, counter = list*100 + product.
--
--    Each contract carries 5–6 negotiated lines, 3–9 points under that product's
--    base-list margin, on the categories that customer actually buys. These never
--    touch the catalogue margin (productMargins only reads the base list) — they
--    drive the PricePilot Customers page and the OrderFlow customer profile.
-- ---------------------------------------------------------------------------
insert into pl_overrides (id, org_id, price_list_id, stock_item_id, margin_pct, created_at)
select ('16000000-7e5d-4c1a-9b3f-' || lpad((v.l * 100 + v.p)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001',
       pl.id,
       ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid,
       v.margin_pct,
       pl.created_at + interval '1 hour'   -- signed with the contract itself
from (values
  -- list, product, margin        base margin → negotiated
  -- 2 · Boland Trading Co. — high-volume field produce
  (2,  1, 60), (2,  3, 58), (2,  4, 59), (2,  5, 60), (2,  6, 61), (2,  7, 62),
  -- 3 · Table Bay Distributors — dry goods programme
  (3, 18, 66), (3, 19, 64), (3, 20, 63), (3, 21, 46), (3, 22, 56),
  -- 4 · Cape Provisions Group — protein + dairy programme
  (4, 13, 28), (4, 14, 25), (4, 16, 30), (4, 23, 35), (4, 25, 42),
  -- 5 · Corporate Dining Partners — prepared lines for events
  (5, 26, 89), (5, 27, 87), (5, 28, 85), (5, 29, 83), (5, 30, 97),
  -- 6 · Winelands Wholesale — leaf, salad and packaging
  (6,  1, 60), (6,  2, 61), (6,  8, 59), (6,  9, 62), (6, 12, 60), (6, 31, 71),
  -- 7 · Riverside Hospitality Group — protein, dairy and ready meals
  (7, 13, 29), (7, 15, 32), (7, 16, 31), (7, 24, 40), (7, 25, 42), (7, 28, 86)
) as v(l, p, margin_pct)
join pl_price_lists pl
  on pl.id = ('15000000-7e5d-4c1a-9b3f-' || lpad(v.l::text, 12, '0'))::uuid
 and pl.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 5) pl_price_list_versions — published margin snapshots (pl-versions.sql).
--
--    Ids stay inside the `15` group but in a reserved 9000000000xx counter band
--    (900000000000 + list_index*10 + version_no) — these are leaf rows owned by
--    this file, nothing else references them.
--
--    Base list gets two versions so the compare panel has a real diff:
--      v1 (Sep 2025) — opening-season markups, proteins/dairy/oils higher.
--      v2 (Jul 2026) — the CURRENT live state, rebuilt from pl_overrides above,
--                      so VersionHistory reports "no unpublished changes".
--    Contracts 2 and 6 get a single in-sync v1 each.
--
--    Guarded: pl-versions.sql may not be applied on an older database.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.pl_price_list_versions') is null then
    raise notice 'pl_price_list_versions absent (pl-versions.sql not applied) — skipping PricePilot version history.';
    return;
  end if;

  -- 5a) base list v1 — the pre-review markup set. Proteins, dairy and oils sat
  --     higher before the April–July cost rises were absorbed rather than passed
  --     on to trade customers; everything else is unchanged from v2.
  insert into pl_price_list_versions (id, org_id, price_list_id, version_no, default_margin_pct, overrides, note, created_by, created_at)
  select '15000000-7e5d-4c1a-9b3f-900000000011'::uuid,
         '01000000-7e5d-4c1a-9b3f-000000000001',
         '15000000-7e5d-4c1a-9b3f-000000000001',
         1,
         66,
         (select jsonb_agg(jsonb_build_object(
                   'stock_item_id', ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0')),
                   'margin_pct',    v.m) order by v.p)
          from (values
            (13, 40), (14, 36), (15, 42), (16, 42), (17, 44),
            (18, 76), (19, 70), (20, 74), (21, 58), (22, 62),
            (23, 45), (24, 50), (25, 54), (26, 96), (27, 94),
            (28, 92), (29, 90), (30,105), (31, 78), (32, 76)
          ) as v(p, m)),
         'Opening-season markups. Superseded once the April–July cost rises on proteins, dairy and cooking oil were absorbed to hold trade prices.',
         (select p.id from profiles p where p.org_id = '01000000-7e5d-4c1a-9b3f-000000000001' order by p.id limit 1),
         timestamptz '2025-09-01 08:10+02';

  -- 5b) base list v2 — a snapshot of the live overrides, so live == latest.
  insert into pl_price_list_versions (id, org_id, price_list_id, version_no, default_margin_pct, overrides, note, created_by, created_at)
  select '15000000-7e5d-4c1a-9b3f-900000000012'::uuid,
         pl.org_id, pl.id, 2, pl.default_margin_pct,
         coalesce((select jsonb_agg(jsonb_build_object('stock_item_id', ov.stock_item_id, 'margin_pct', ov.margin_pct)
                                    order by ov.id)
                   from pl_overrides ov where ov.price_list_id = pl.id), '[]'::jsonb),
         'Mid-year review. Five protein and dairy lines now sit below the 41% target — flagged for re-pricing rather than silently corrected.',
         (select p.id from profiles p where p.org_id = '01000000-7e5d-4c1a-9b3f-000000000001' order by p.id limit 1),
         timestamptz '2026-07-06 10:15+02'
  from pl_price_lists pl
  where pl.id = '15000000-7e5d-4c1a-9b3f-000000000001';

  -- 5c) contract lists 2 and 6 — one published version each, in sync with live.
  insert into pl_price_list_versions (id, org_id, price_list_id, version_no, default_margin_pct, overrides, note, created_by, created_at)
  select ('15000000-7e5d-4c1a-9b3f-' || lpad((900000000000 + v.l * 10 + 1)::text, 12, '0'))::uuid,
         pl.org_id, pl.id, 1, pl.default_margin_pct,
         coalesce((select jsonb_agg(jsonb_build_object('stock_item_id', ov.stock_item_id, 'margin_pct', ov.margin_pct)
                                    order by ov.id)
                   from pl_overrides ov where ov.price_list_id = pl.id), '[]'::jsonb),
         v.note,
         (select p.id from profiles p where p.org_id = '01000000-7e5d-4c1a-9b3f-000000000001' order by p.id limit 1),
         v.created_at
  from (values
    (2, 'Signed contract pricing — weekly field-produce programme.',        timestamptz '2025-10-02 11:00+02'),
    (6, 'Signed contract pricing — leaf, salad and packaging programme.',   timestamptz '2026-03-31 11:00+02')
  ) as v(l, note, created_at)
  join pl_price_lists pl
    on pl.id = ('15000000-7e5d-4c1a-9b3f-' || lpad(v.l::text, 12, '0'))::uuid;
end $$;


-- >>> SPLIT: pl_complaints (seed step 7) <<<
-- Everything below this line depends on of_orders and belongs at seed step 7.
-- Its DELETE already ran in the preamble above (section 0), so the split stays
-- re-runnable in either arrangement.

-- ---------------------------------------------------------------------------
-- 6) pl_complaints — group `17`, 9 rows: 3 open, 3 investigating, 3 resolved.
--
--    The complaints page (app/app/pricepilot/complaints/page.tsx) resolves the
--    customer name from customer_id and the invoice label from order_id
--    INDEPENDENTLY, so the two must genuinely agree. Rather than hard-coding a
--    customer that assumes an order→customer allocation this file does not own,
--    each row takes its customer straight off the referenced order and falls back
--    to the blueprint customer id if that order is missing (left join, so the
--    complaint always exists).
--
--    Orders referenced are July 2026 (index 350–458), i.e. inside the window the
--    complaints list and the OrderFlow order picker both show.
-- ---------------------------------------------------------------------------
insert into pl_complaints (id, org_id, customer_id, order_id, title, body, image_url, status, created_at)
select v.id::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001',
       coalesce(o.customer_id, v.fallback_customer::uuid),
       o.id,
       v.title,
       v.body,
       null,
       v.status,
       v.created_at
from (values
  ('17000000-7e5d-4c1a-9b3f-000000000001', '0a000000-7e5d-4c1a-9b3f-000000000352', '05000000-7e5d-4c1a-9b3f-000000000003',
   'Short-dated milk on the Tuesday drop',
   'Two cases of the 12x1L fresh milk arrived with three days of shelf life left. Customer wants the cold-chain handover reviewed before the next weekly drop.',
   'open',          timestamptz '2026-07-27 08:40+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000002', '0a000000-7e5d-4c1a-9b3f-000000000361', '05000000-7e5d-4c1a-9b3f-000000000001',
   'Wilted leaf in two crates',
   'Mixed salad leaf in crates 3 and 5 was wilted on arrival. Loaded at 06:10, delivered 09:55 — asking whether the vehicle chiller held temperature.',
   'open',          timestamptz '2026-07-24 15:05+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000003', '0a000000-7e5d-4c1a-9b3f-000000000412', '05000000-7e5d-4c1a-9b3f-000000000015',
   'Invoice price differs from the contract list',
   'Ready meal trays were billed at the standard trade rate rather than the negotiated rate. Checking whether the contract list on this account is still inside its validity window.',
   'open',          timestamptz '2026-07-22 11:20+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000004', '0a000000-7e5d-4c1a-9b3f-000000000377', '05000000-7e5d-4c1a-9b3f-000000000008',
   'Line fish fillet under weight',
   'Customer weighed the box at 9.4kg against 10kg ordered. Pack-house scale check requested; the supplier price on this line moved 10.5% this month so any credit needs to be exact.',
   'investigating', timestamptz '2026-07-21 07:55+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000005', '0a000000-7e5d-4c1a-9b3f-000000000428', '05000000-7e5d-4c1a-9b3f-000000000021',
   'Bread rolls stale on the counter run',
   'Two bags from the morning bake were dry by midday. Checking whether the bake batch went out ahead of the cooling window.',
   'investigating', timestamptz '2026-07-18 13:30+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000006', '0a000000-7e5d-4c1a-9b3f-000000000415', '05000000-7e5d-4c1a-9b3f-000000000017',
   'Ready meal trays short by four',
   'Case count on the event order came in four trays short. Dispatch note and picking slip disagree — reconciling before crediting.',
   'investigating', timestamptz '2026-07-15 16:45+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000007', '0a000000-7e5d-4c1a-9b3f-000000000356', '05000000-7e5d-4c1a-9b3f-000000000006',
   'Cheese block increase not flagged in advance',
   'Cheese moved up 10.4% without notice on the account. Resolved: the increase was passed through at cost, and the account now gets a week''s notice on any dairy move.',
   'resolved',      timestamptz '2026-07-10 09:15+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000008', '0a000000-7e5d-4c1a-9b3f-000000000450', '05000000-7e5d-4c1a-9b3f-000000000026',
   'Weekly box missing the herb bunch',
   'Herbs left off two consecutive weekly boxes. Resolved: pick list corrected and the two bunches credited on the following order.',
   'resolved',      timestamptz '2026-07-08 12:00+02'),
  ('17000000-7e5d-4c1a-9b3f-000000000009', '0a000000-7e5d-4c1a-9b3f-000000000405', '05000000-7e5d-4c1a-9b3f-000000000011',
   'Damaged cartons on pallet three',
   'Six standard cartons crushed in transit. Resolved: replaced on the next run and the packaging supplier notified of the stacking height.',
   'resolved',      timestamptz '2026-07-03 14:25+02')
) as v(id, order_id, fallback_customer, title, body, status, created_at)
left join of_orders o
  on o.id = v.order_id::uuid
 and o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ===========================================================================
-- Done — PricePilot for Meridian Food Co.
--   pl_targets              1   (41% target · R5 600 000 rev · R2 140 000 GP · R1 829 500 opex)
--   pl_price_lists          7   (1 base + 6 contracts: 2 expired, 2 expiring, 2 active)
--   pl_overrides           53   (20 on the base list = the catalogue margins, 33 on contracts)
--   pl_price_list_versions  4   (base v1 + v2, contracts 2 and 6 v1) — guarded
--   pl_complaints           9   (3 open · 3 investigating · 3 resolved)
-- Catalogue: 27 of 32 products at or above the 41% target, 5 below → 5 re-price
-- alerts once July sales land. Pricing health ≈ 96/100.
-- ===========================================================================


-- ##########################################################################
-- ##  SECTION 2D
-- ##  ProcurePulse part B + Doc-U — recipes, ingredients, movements, stock
-- ##  orders, reorder requests, name aliases, activity events, document
-- ##  folders, documents, notifications  (apply order 8-9)
-- ##########################################################################

-- ###########################################################################
-- PART B — assembly steps 8-9 (runs AFTER writer (a)'s orders/invoices, so the
-- Doc-U entity links in §14 resolve to real of_orders / of_invoices rows).
-- All deletes for these tables already ran in PART A §0.
-- ###########################################################################

-- ---------------------------------------------------------------------------
-- 7. Recipes (`pp_recipes`, group 08) — the 18 prepared lines of blueprint §7.
--    fetchRecipes() + maxRecipeBatches() plan batches off live ingredient stock,
--    so an out-of-stock ingredient (#16 Line Fish Fillet) correctly caps a plan.
--    Recipes 1, 2, 9, 10, 11, 12, 17 and 18 are the ones WasteWatch's
--    over-portioning events name, so these names are load-bearing across writers.
-- ---------------------------------------------------------------------------
insert into pp_recipes (id, org_id, name, output_product, output_qty, output_unit, notes)
select ('08000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.name, v.output_product, v.output_qty, v.output_unit, nullif(v.notes, '')
from (values
  ( 1, 'Prepared Salad Mix',            'Prepared Salad Mix (2kg tub)',   12, 'tub',    'Cut, washed and tubbed the morning of dispatch.'),
  ( 2, 'Prepared Veg Mix',              'Prepared Veg Mix (2.5kg tub)',   10, 'tub',    ''),
  ( 3, 'Roast Vegetable Tray',          'Roast vegetable tray',            8, 'tray',   ''),
  ( 4, 'Stock Base — Vegetable',        'Stock & Sauce Base (6×2L case)',  3, 'case',   ''),
  ( 5, 'Stock Base — Meat',             'Stock & Sauce Base (6×2L case)',  3, 'case',   ''),
  ( 6, 'Sauce Base — Tomato',           'Stock & Sauce Base (6×2L case)',  2, 'case',   'Runs on the surplus tomato grade.'),
  ( 7, 'Coleslaw',                      'Coleslaw tub',                   14, 'tub',    ''),
  ( 8, 'Potato Salad',                  'Potato salad tub',               12, 'tub',    ''),
  ( 9, 'Ready Meal — Chicken & Rice',   'Ready Meal Trays (12/case)',      4, 'case',   ''),
  (10, 'Ready Meal — Beef & Veg',       'Ready Meal Trays (12/case)',      4, 'case',   ''),
  (11, 'Ready Meal — Vegetable Bake',   'Ready Meal Trays (12/case)',      4, 'case',   ''),
  (12, 'Soup — Butternut',              'Soup (10L)',                      2, 'batch',  ''),
  (13, 'Soup — Seasonal Vegetable',     'Soup (10L)',                      2, 'batch',  ''),
  (14, 'Bread Rolls',                   'Bread Rolls (24/bag)',            4, 'bag',    'Baked twice daily.'),
  (15, 'Fruit Cup Prep',                'Fruit cup',                      24, 'punnet', ''),
  (16, 'Marinated Protein Portions',    'Marinated portions',             10, 'kg',     ''),
  (17, 'Event Platter Base',            'Event platter',                  20, 'cover',  'Built to the standing events spec.'),
  (18, 'Grazing Board Prep',            'Grazing board',                  15, 'cover',  '')
) as v(n, name, output_product, output_qty, output_unit, notes);


-- ---------------------------------------------------------------------------
-- 8. Recipe ingredients (`pp_recipe_ingredients`, group 09, id = recipe*100+line).
--    `product_name` is read BACK OFF the catalogue row rather than retyped, so it
--    is byte-identical to pp_stock_items.name (the Recipes page falls back to the
--    text when a line is unlinked, and any drift would show as two products).
--    75 lines over 18 recipes, 3-5 each.
-- ---------------------------------------------------------------------------
insert into pp_recipe_ingredients (
  id, org_id, recipe_id, stock_item_id, product_name, qty_per_batch, unit
)
select ('09000000-7e5d-4c1a-9b3f-' || lpad((v.r * 100 + v.line)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('08000000-7e5d-4c1a-9b3f-' || lpad(v.r::text, 12, '0'))::uuid,
       s.id, s.name, v.qty, v.unit
from (values
  ( 1,1, 1, 3.0,   'crate'), ( 1,2, 2, 1.5,  'crate'), ( 1,3, 9, 0.8,  'box'),   ( 1,4, 8, 0.5,  'box'),
  ( 2,1, 6, 4.0,   'bag'),   ( 2,2, 7, 8.0,  'kg'),    ( 2,3, 4, 1.2,  'bag'),   ( 2,4, 8, 2.5,  'box'),
  ( 3,1, 7, 12.0,  'kg'),    ( 3,2, 5, 1.5,  'bag'),   ( 3,3, 4, 0.8,  'bag'),   ( 3,4, 6, 1.0,  'bag'),   ( 3,5, 12, 4.0, 'bunch'),
  ( 4,1, 6, 1.5,   'bag'),   ( 4,2, 4, 1.8,  'bag'),   ( 4,3, 12, 6.0, 'bunch'), ( 4,4, 7, 10.0, 'kg'),
  ( 5,1, 13, 1.2,  'box'),   ( 5,2, 4, 1.5,  'bag'),   ( 5,3, 6, 1.0,  'bag'),   ( 5,4, 12, 5.0, 'bunch'),
  ( 6,1, 3, 42.0,  'kg'),    ( 6,2, 4, 1.2,  'bag'),   ( 6,3, 12, 4.0, 'bunch'), ( 6,4, 21, 0.15,'case'),
  ( 7,1, 6, 2.5,   'bag'),   ( 7,2, 4, 0.6,  'bag'),   ( 7,3, 1, 1.0,  'crate'),
  ( 8,1, 5, 3.2,   'bag'),   ( 8,2, 4, 0.5,  'bag'),   ( 8,3, 12, 3.0, 'bunch'),
  ( 9,1, 13, 2.0,  'box'),   ( 9,2, 18, 1.5, 'bag'),   ( 9,3, 8, 0.6,  'box'),   ( 9,4, 4, 0.5,  'bag'),   ( 9,5, 29, 0.3, 'case'),
  (10,1, 14, 12.0, 'kg'),    (10,2, 6, 1.0,  'bag'),   (10,3, 5, 1.2,  'bag'),   (10,4, 4, 0.6,  'bag'),   (10,5, 29, 0.3, 'case'),
  (11,1, 7, 18.0,  'kg'),    (11,2, 5, 1.4,  'bag'),   (11,3, 25, 2.5, 'kg'),    (11,4, 23, 0.5, 'case'),  (11,5, 12, 3.0, 'bunch'),
  (12,1, 7, 22.0,  'kg'),    (12,2, 4, 0.4,  'bag'),   (12,3, 23, 0.3, 'case'),  (12,4, 29, 0.25,'case'),
  (13,1, 6, 0.8,   'bag'),   (13,2, 5, 0.6,  'bag'),   (13,3, 4, 0.4,  'bag'),   (13,4, 29, 0.25,'case'),  (13,5, 12, 3.0, 'bunch'),
  (14,1, 20, 0.6,  'bag'),   (14,2, 21, 0.05,'case'),  (14,3, 22, 0.08,'bag'),
  (15,1, 10, 0.5,  'box'),   (15,2, 11, 0.4, 'box'),   (15,3, 31, 0.05,'sleeve'),
  (16,1, 13, 0.8,  'box'),   (16,2, 21, 0.06,'case'),  (16,3, 12, 4.0, 'bunch'), (16,4, 29, 0.2, 'case'),
  (17,1, 25, 6.0,  'kg'),    (17,2, 26, 5.0, 'tub'),   (17,3, 10, 0.3, 'box'),   (17,4, 30, 3.0, 'bag'),   (17,5, 31, 0.1, 'sleeve'),
  (18,1, 17, 4.0,  'kg'),    (18,2, 25, 4.0, 'kg'),    (18,3, 11, 0.3, 'box'),   (18,4, 30, 2.5, 'bag'),   (18,5, 12, 2.0, 'bunch')
) as v(r, line, p, qty, unit)
join pp_stock_items s
  on s.id = ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid
 and s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 9. Stock ledger (`pp_movements`, group 19) — 256 rows, 8 per catalogue line.
--    The append-only history behind the dashboard activity strip
--    (fetchRecentMovements, newest 8) and each item's detail chart
--    (fetchMovements, capped at 200 for ONE item, so 8 always render in full).
--
--    Generated rather than hand-written because 256 hand rows would be
--    unreviewable: the counter is (item_index - 1) * 8 + slot + 1, which lands
--    inside the blueprint's 1-260 allocation for group 19, and the item index is
--    read straight off the last block of the item's own UUID so the two can never
--    drift. Slot 0 is the most recent movement, slot 7 the oldest (~23 days back).
--    Reasons walk the typed MovementReason vocabulary (types.ts:279): receipts,
--    prep consumption, inter-site transfers, a Doc-U sync and a cycle count.
--    Magnitudes scale off the line's own low_threshold so a 20-unit line does not
--    receive 600 boxes.
-- ---------------------------------------------------------------------------
insert into pp_movements (id, org_id, stock_item_id, change, reason, source_label, occurred_at)
select ('19000000-7e5d-4c1a-9b3f-' || lpad(((i.idx - 1) * 8 + g.slot + 1)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       i.id,
       case g.slot
         when 0 then  round(i.base * 2)
         when 1 then -round(i.base * 0.55)
         when 2 then -round(i.base * 0.70)
         when 3 then  round(i.base * 1.40)
         when 4 then  round(i.base * 2)
         when 5 then -round(i.base * 0.60)
         when 6 then -round(i.base * 0.80)
         else case when i.idx % 2 = 0 then -3 else 2 end
       end,
       case g.slot
         when 0 then 'order_received'
         when 1 then 'recipe_consumed'
         when 2 then 'transfer'
         when 3 then 'document_sync'
         when 4 then 'order_received'
         when 5 then 'recipe_consumed'
         when 6 then 'transfer'
         else 'count_adjustment'
       end,
       case g.slot
         when 0 then i.cheapest_supplier
         when 4 then i.cheapest_supplier
         when 1 then 'Prep batch — ' || coalesce(i.category, 'Production')
         when 5 then 'Prep batch — ' || coalesce(i.category, 'Production')
         when 3 then 'Doc-U feed — supplier invoice'
         when 7 then case i.idx % 3 when 0 then 'Stock count — Cold Store'
                                    when 1 then 'Stock count — Production'
                                    else 'Stock count — Dispatch' end
         else case i.idx % 4 when 0 then 'Dispatch — trade route'
                             when 1 then 'Dispatch — events kitchen'
                             when 2 then 'Dispatch — counter sites'
                             else 'Dispatch — farm gate' end
       end,
       timestamptz '2026-07-29 17:30+02'
         - ((g.slot * 3 + (i.idx % 3)) * 24 + (i.idx % 7)) * interval '1 hour'
from (
  select s.id, s.category, s.cheapest_supplier,
         substr(s.id::text, 25)::int as idx,
         greatest(round(s.low_threshold * 0.9), 2) as base
  from pp_stock_items s
  where s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
) i
cross join generate_series(0, 7) as g(slot);


-- ---------------------------------------------------------------------------
-- 10. Stock purchase orders (`pp_stock_orders`, group 1a + `pp_stock_order_items`,
--     group 1b, id = order*100 + line) — 14 orders, 40 lines.
--
--     These are NOT decoration. WasteWatch's food-cost denominator prefers
--     `pp_stock_orders.total` for every non-cancelled order in the last 30 days
--     (wastewatch-data.ts:427) and only falls back to sales x cost-of-goods when
--     that sum is zero. The twelve in-window, non-cancelled orders below total
--     R3 271 020 = R109 034/day, which lines up with the blueprint's July COGS
--     run-rate (R3 185 600 over 29 days = R109 848/day) and puts waste at ~2.4%
--     of food cost — exactly the §9.2 figure. Change these totals and the
--     WasteWatch headline moves.
--
--     One order is `cancelled` (excluded from the denominator by the reader) and
--     one is dated 18 June (outside the 30-day window) so both paths are visible.
--     Unit prices are the catalogue costs, so the orders reconcile with the Doc-U
--     invoices in §14 line for line.
-- ---------------------------------------------------------------------------
insert into pp_stock_orders (id, org_id, supplier, status, total, item_count, created_at, updated_at)
select ('1a000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.supplier, v.status, 0, 0, v.created_at::timestamptz, v.created_at::timestamptz
from (values
  ( 1, 'Bergriver Growers',                 'completed', '2026-07-02T06:40:00+02'),
  ( 2, 'Winelands Protein Co.',             'completed', '2026-07-03T07:15:00+02'),
  ( 3, 'Boland Dry Goods',                  'completed', '2026-07-06T08:05:00+02'),
  ( 4, 'Klipheuwel Farms',                  'completed', '2026-07-08T06:25:00+02'),
  ( 5, 'Overberg Dairy Supply',             'completed', '2026-07-10T09:10:00+02'),
  ( 6, 'Swartland Grain & Mill',            'completed', '2026-07-13T07:45:00+02'),
  ( 7, 'Riebeek Oils & Fats',               'sent',      '2026-07-15T10:20:00+02'),
  ( 8, 'Cape Cold Chain Supply',            'sent',      '2026-07-17T08:35:00+02'),
  ( 9, 'Helderberg Packaging',              'sent',      '2026-07-20T11:05:00+02'),
  (10, 'Drakenstein Logistics & Freight',   'sent',      '2026-07-22T14:30:00+02'),
  (11, 'Stellenbosch Seedling & Input Co.', 'sent',      '2026-07-24T09:50:00+02'),
  (12, 'Malmesbury Cold Store Services',    'draft',     '2026-07-27T15:40:00+02'),
  -- cancelled: skipped by the WasteWatch food-cost denominator.
  (13, 'Peninsula Beverage Supply',         'cancelled', '2026-07-26T12:15:00+02'),
  -- outside the 30-day window: history only.
  (14, 'Cape Label & Print',                'completed', '2026-06-18T10:00:00+02')
) as v(n, supplier, status, created_at);

-- Lines. `p` is the catalogue index, or NULL for a genuinely off-catalogue buy
-- (freight, cold-store space, seedling trays) — pp_stock_order_items.stock_item_id
-- is nullable exactly for this. product_name comes off the catalogue where linked.
insert into pp_stock_order_items (
  id, org_id, order_id, stock_item_id, product_name, qty, unit, unit_price, line_total
)
select ('1b000000-7e5d-4c1a-9b3f-' || lpad((v.o * 100 + v.line)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('1a000000-7e5d-4c1a-9b3f-' || lpad(v.o::text, 12, '0'))::uuid,
       s.id,
       coalesce(s.name, v.fallback_name),
       v.qty, v.unit, v.unit_price, round(v.qty * v.unit_price, 2)
from (values
  -- Bergriver Growers — R418 000
  ( 1,1,  1,  420,  'crate',  148.00, ''), ( 1,2,  2,  340, 'crate', 132.00, ''),
  ( 1,3,  8,  300,  'box',    168.00, ''), ( 1,4,  9,  385, 'box',    96.00, ''),
  ( 1,5, 10,  520,  'box',    172.00, ''), ( 1,6, 11,  520, 'box',   258.00, ''),
  -- Winelands Protein Co. — R594 540
  ( 2,1, 13,  480,  'box',    620.00, ''), ( 2,2, 14,  900, 'kg',    118.00, ''),
  ( 2,3, 15,  380,  'kg',     195.00, ''), ( 2,4, 16,  420, 'kg',    168.00, ''),
  ( 2,5, 17,  480,  'kg',      96.00, ''),
  -- Boland Dry Goods — R370 320
  ( 3,1, 18,  640,  'bag',    148.00, ''), ( 3,2, 22,  420, 'bag',   168.00, ''),
  ( 3,3, 29,  380,  'case',   196.00, ''), ( 3,4, 19,  480, 'bag',   118.00, ''),
  ( 3,5, 20,  560,  'bag',    132.00, ''),
  -- Klipheuwel Farms — R337 540
  ( 4,1,  3, 3800,  'kg',      23.50, ''), ( 4,2,  4,  460, 'bag',    92.00, ''),
  ( 4,3,  5,  620,  'bag',    108.00, ''), ( 4,4,  6,  480, 'bag',    86.00, ''),
  ( 4,5,  7, 6600,  'kg',      14.80, ''),
  -- Overberg Dairy Supply — R342 340
  ( 5,1, 23,  880,  'case',   168.00, ''), ( 5,2, 24,  220, 'case',  445.00, ''),
  ( 5,3, 25,  700,  'kg',     138.00, ''),
  -- Swartland Grain & Mill — R298 320
  ( 6,1, 20,  720,  'bag',    132.00, ''), ( 6,2, 19,  840, 'bag',   118.00, ''),
  ( 6,3, 30, 2480,  'bag',     42.00, ''),
  -- Riebeek Oils & Fats — R216 440 (post-spike cost on the oil line)
  ( 7,1, 21,  280,  'case',   640.00, ''), ( 7,2, 29,  190, 'case',  196.00, ''),
  -- Cape Cold Chain Supply — R197 400
  ( 8,1, 28,  380,  'case',   288.00, ''), ( 8,2, 26,  560, 'tub',    78.00, ''),
  ( 8,3, 27,  540,  'tub',     82.00, ''),
  -- Helderberg Packaging — R158 520
  ( 9,1, 31,  480,  'sleeve', 168.00, ''), ( 9,2, 32,  660, 'bundle',118.00, ''),
  -- Off-catalogue service buys.
  (10,1, null,  30, 'load',  4400.00, 'Outbound freight — July week 3'),
  (11,1, 12,  4800,  'bunch',  11.50, ''),
  (11,2, null, 800, 'tray',    78.00, 'Seedling trays — mixed leaf'),
  (12,1, null,  80, 'pallet-month', 1100.00, 'Cold-store pallet space — July'),
  (13,1, null, 500, 'case',   188.00, 'Bottled water & mixers — events'),
  (14,1, null, 100, 'reel',   620.00, 'Label reels — printed')
) as v(o, line, p, qty, unit, unit_price, fallback_name)
left join pp_stock_items s
  on v.p is not null
 and s.id = ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid
 and s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

-- Header roll-ups derived from the lines, so the order card can never disagree
-- with what it lists (and so the WasteWatch denominator stays arithmetic, not a
-- typed-in number).
update pp_stock_orders o
set total = coalesce(t.total, 0),
    item_count = coalesce(t.n, 0)
from (
  select order_id, sum(line_total) as total, count(*) as n
  from pp_stock_order_items
  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  group by order_id
) t
where t.order_id = o.id
  and o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 11. Manual reorder requests (`pp_reorder_requests`, group 1c) — 9 rows.
--     fetchReorderRequests() filters by status and defaults to 'open', so the
--     Reordering page shows the five open requests alongside the auto-suggested
--     draft PO; the ordered/fulfilled/cancelled rows populate the other tabs.
--     The first four track the blueprint's low/out lines, so the manual list and
--     the automatic alerts tell the same story. Row 9 is deliberately
--     off-catalogue (stock_item_id null) — the column is nullable for exactly
--     that case and the page must render it from product_name alone.
-- ---------------------------------------------------------------------------
insert into pp_reorder_requests (
  id, org_id, stock_item_id, product_name, qty, unit, supplier, note, status, created_at, updated_at
)
select ('1c000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       s.id, coalesce(s.name, nullif(v.fallback_name, '')), v.qty, v.unit, v.supplier,
       nullif(v.note, ''), v.status, v.created_at::timestamptz, v.created_at::timestamptz
from (values
  (1, 16,   40, 'kg',     'Winelands Protein Co.',             'Out of stock — Friday events order needs it landed Thursday', 'open',      '2026-07-29T06:55:00+02', ''),
  (2,  2,   24, 'crate',  'Bergriver Growers',                 'Below threshold since Monday',                                'open',      '2026-07-28T07:20:00+02', ''),
  (3, 30,   60, 'bag',    'Swartland Grain & Mill',            'Counter and events both short',                               'open',      '2026-07-28T15:10:00+02', ''),
  (4, 23,   48, 'case',   'Overberg Dairy Supply',             'Standing Tuesday drop was half-filled',                       'open',      '2026-07-27T08:05:00+02', ''),
  (5, 31,   40, 'sleeve', 'Helderberg Packaging',              'Counter packaging running down ahead of the long weekend',    'open',      '2026-07-26T11:40:00+02', ''),
  (6, 21,   60, 'case',   'Riebeek Oils & Fats',               'Buying ahead of the next price move',                         'ordered',   '2026-07-23T09:15:00+02', ''),
  (7, 13,   80, 'box',    'Winelands Protein Co.',             'Extra cover for the August function block',                    'ordered',   '2026-07-22T13:25:00+02', ''),
  (8, 25,  120, 'kg',     'Overberg Dairy Supply',             'Platter programme top-up',                                    'fulfilled', '2026-07-16T10:00:00+02', ''),
  (9, null,  6, 'case',   'Peninsula Beverage Supply',         'Cancelled — sourced from existing stock',                      'cancelled', '2026-07-14T16:45:00+02', 'Chafing fuel gel')
) as v(n, p, qty, unit, supplier, note, status, created_at, fallback_name)
left join pp_stock_items s
  on v.p is not null
 and s.id = ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid
 and s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 12. Product-name aliases (`pp_name_aliases`, group 1f) — 16 rows.
--     Two readers depend on these: the ProcurePulse Products page (all statuses)
--     and OrderFlow's statement-price surface, which loads ONLY
--     status = 'confirmed' rows (orderflow-data.ts:633) and overlays them on the
--     product-name matcher. The eleven confirmed raw names below are exactly the
--     descriptions used on the supplier statements seeded in §14, so a statement
--     line resolves to a catalogue product instead of reading as an unknown item.
--     Three `pending` rows are AI suggestions awaiting a human ruling (Phase 2
--     columns method/confidence/ai_rationale); two `dismissed` rows are the
--     non-product statement lines that must never be matched to stock.
-- ---------------------------------------------------------------------------
insert into pp_name_aliases (
  id, org_id, raw_name, normalized_name, suggested_name, custom_name,
  stock_item_id, status, method, confidence, ai_rationale, created_at, updated_at
)
select ('1f000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.raw_name, lower(v.raw_name), s.name,
       case when v.status = 'confirmed' then s.name end,
       s.id, v.status, v.method, v.confidence, nullif(v.rationale, ''),
       v.created_at::timestamptz, v.created_at::timestamptz
from (values
  ( 1, 'SALAD LEAF MIX 5KG CRT',    1, 'confirmed', 'manual', null::numeric, '',                                                        '2026-05-12T09:00:00+02'),
  ( 2, 'SPINACH BABY 4KG',          2, 'confirmed', 'exact',  null, '',                                                        '2026-05-12T09:02:00+02'),
  ( 3, 'TOM LOOSE KG',              3, 'confirmed', 'manual', null, '',                                                        '2026-05-14T07:30:00+02'),
  ( 4, 'ONION BROWN 10KG PKT',      4, 'confirmed', 'manual', null, '',                                                        '2026-05-14T07:31:00+02'),
  ( 5, 'POTATO WASHED 10KG',        5, 'confirmed', 'exact',  null, '',                                                        '2026-05-14T07:33:00+02'),
  ( 6, 'CHICK PORT 10KG CTN',      13, 'confirmed', 'manual', null, '',                                                        '2026-05-27T11:15:00+02'),
  ( 7, 'FISH FILLET LINE KG',      16, 'confirmed', 'manual', null, '',                                                        '2026-05-27T11:18:00+02'),
  ( 8, 'OIL VEG 4X5L',             21, 'confirmed', 'manual', null, '',                                                        '2026-06-03T08:45:00+02'),
  ( 9, 'MILK FULL CREAM 12X1L',    23, 'confirmed', 'exact',  null, '',                                                        '2026-06-03T08:47:00+02'),
  (10, 'CHEESE GOUDA BLOCK KG',    25, 'confirmed', 'manual', null, '',                                                        '2026-06-11T14:05:00+02'),
  (11, 'ROLLS WHITE 24S',          30, 'confirmed', 'manual', null, '',                                                        '2026-06-11T14:07:00+02'),
  (12, 'BUTTERNUT WHOLE PER KG',    7, 'pending',   'ai',       88, 'Same commodity and counting unit as the catalogue line.',  '2026-07-24T06:20:00+02'),
  (13, 'MEALIE MEAL SPECIAL 12.5',  19, 'pending',  'ai',       76, 'Pack size matches; wording differs from the catalogue.',   '2026-07-26T06:22:00+02'),
  (14, 'PUNNET 500 SLV',           31, 'pending',   'ai',       69, 'Sleeve count matches, but the description is ambiguous.',  '2026-07-28T06:24:00+02'),
  (15, 'PALLET DEPOSIT',         null, 'dismissed', 'manual', null, '',                                                        '2026-06-30T16:40:00+02'),
  (16, 'DELIVERY SURCHARGE',     null, 'dismissed', 'manual', null, '',                                                        '2026-06-30T16:41:00+02')
) as v(n, raw_name, p, status, method, confidence, rationale, created_at)
left join pp_stock_items s
  on v.p is not null
 and s.id = ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid
 and s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ---------------------------------------------------------------------------
-- 13. Stock activity feed (`procurepulse_activity_events`, group 40) — 30 rows.
--     fetchActivityEvents() takes the newest 8 for the dashboard strip, so the
--     top of this list is what a demo actually sees: the cooking-oil price move,
--     the fish line running out and the Doc-U syncs behind them. `type` walks the
--     documented vocabulary (document_sync | manual_adjustment | count_adjustment
--     | order_received | recipe_reserved | recipe_consumed | transfer |
--     price_update). NO wastage events live here — that is WasteWatch's table.
--     `ref_id` points at the Doc-U document (group 20) or stock order (group 1a)
--     that caused the event; it carries no FK, so it is safe either side of §14.
-- ---------------------------------------------------------------------------
insert into procurepulse_activity_events (
  id, org_id, type, title, body, stock_item_id, ref_id, occurred_at
)
select ('40000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.type, v.title, nullif(v.body, ''),
       case when v.p is not null
            then ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid end,
       case when v.ref_group is not null
            then (v.ref_group || '000000-7e5d-4c1a-9b3f-' || lpad(v.ref_n::text, 12, '0'))::uuid end,
       v.occurred_at::timestamptz
from (values
  ( 1, 'price_update',      'Cooking Oil cost stepped 13.1%',              'Riebeek Oils & Fats moved the 4x5L case from R566 to R640 on invoice INV-RO-4471.', 21,   '20',  6, '2026-07-29T08:12:00+02'),
  ( 2, 'manual_adjustment', 'Line Fish Fillet written down to zero',       'Thursday landing did not arrive; the line is out until Monday.',                     16,   null, null, '2026-07-29T07:40:00+02'),
  ( 3, 'document_sync',     'Overberg Dairy Supply invoice synced',        'Two priced lines matched to the catalogue; cheese and butter costs refreshed.',      25,   '20',  9, '2026-07-28T16:05:00+02'),
  ( 4, 'recipe_consumed',   'Prepared Salad Mix — 6 batches produced',     'Consumed 18 crates of leaf and 9 crates of spinach.',                                1,   '08',  1, '2026-07-28T09:30:00+02'),
  ( 5, 'order_received',    'Bergriver Growers delivery booked in',        'Six lines received against the 2 July purchase order.',                             10,   '1a',  1, '2026-07-28T06:50:00+02'),
  ( 6, 'count_adjustment',  'Cold Store cycle count closed',               'Nine lines counted; two variances inside tolerance.',                               24,   null, null, '2026-07-27T17:20:00+02'),
  ( 7, 'recipe_reserved',   'Event Platter Base — 40 covers reserved',     'Cheese and prepared salad ring-fenced for Saturday.',                               25,   '08', 17, '2026-07-27T11:10:00+02'),
  ( 8, 'transfer',          'Stock moved to the events kitchen',           'Prepared lines transferred ahead of the weekend function block.',                    26,   null, null, '2026-07-27T08:15:00+02'),
  ( 9, 'document_sync',     'Cape Cold Chain Supply invoice synced',       'Three prepared lines matched; costs unchanged.',                                    28,   '20', 14, '2026-07-26T15:45:00+02'),
  (10, 'price_update',      'Cheese Block cost stepped 10.4%',             'Overberg Dairy Supply moved the kilogram rate from R125 to R138.',                   25,   '20',  9, '2026-07-26T10:05:00+02'),
  (11, 'order_received',    'Helderberg Packaging delivery booked in',     'Punnets and cartons received in full.',                                             31,   '1a',  9, '2026-07-25T13:30:00+02'),
  (12, 'manual_adjustment', 'Bread Rolls corrected after the counter run', 'Counter over-drew the morning bake by six bags.',                                    30,   null, null, '2026-07-25T09:55:00+02'),
  (13, 'document_sync',     'Stellenbosch Seedling invoice failed to read','Confidence 54% — the document is flagged for a manual pass.',                        12,   '20', 16, '2026-07-25T08:20:00+02'),
  (14, 'recipe_consumed',   'Ready Meal — Chicken & Rice, 5 batches',      'Ten boxes of chicken portions and 7.5 bags of rice consumed.',                       13,   '08',  9, '2026-07-24T14:40:00+02'),
  (15, 'order_received',    'Stellenbosch Seedling delivery booked in',    'Herb bunches and seedling trays received.',                                         12,   '1a', 11, '2026-07-24T10:15:00+02'),
  (16, 'transfer',          'Chilled stock moved to Malmesbury cold store','Overflow pallets held off-site through the peak week.',                              23,   null, null, '2026-07-23T16:00:00+02'),
  (17, 'count_adjustment',  'Production cycle count closed',               'Twelve lines counted; prepared tubs adjusted down by three.',                        26,   null, null, '2026-07-23T17:35:00+02'),
  (18, 'document_sync',     'Drakenstein delivery note synced',            'Proof of delivery filed against the trade order.',                                 null,  '20', 24, '2026-07-23T12:05:00+02'),
  (19, 'recipe_consumed',   'Soup — Butternut, 4 batches',                 'Eighty-eight kilograms of butternut consumed.',                                       7,   '08', 12, '2026-07-22T13:10:00+02'),
  (20, 'order_received',    'Riebeek Oils & Fats order acknowledged',      'Two lines confirmed at the new cost.',                                              21,   '1a',  7, '2026-07-22T09:25:00+02'),
  (21, 'price_update',      'Chicken Portions cost crept 10.7%',           'Six consecutive rises from R560 to R620 since the start of the season.',             13,   '20',  3, '2026-07-21T15:50:00+02'),
  (22, 'transfer',          'Counter replenishment run',                   'Prepared lines and bread rolls moved to the three counter sites.',                   30,   null, null, '2026-07-21T07:05:00+02'),
  (23, 'document_sync',     'Winelands Protein Co. invoice synced',        'Fish and chicken lines matched; both costs moved up.',                              16,   '20',  3, '2026-07-20T16:30:00+02'),
  (24, 'recipe_reserved',   'Grazing Board Prep — 30 covers reserved',     'Boerewors and cheese ring-fenced for the Friday booking.',                           17,   '08', 18, '2026-07-20T11:45:00+02'),
  (25, 'order_received',    'Cape Cold Chain Supply delivery booked in',   'Three prepared lines received in full.',                                             28,   '1a',  8, '2026-07-19T14:20:00+02'),
  (26, 'manual_adjustment', 'Fresh Milk shortfall recorded',               'Standing Tuesday drop arrived half-filled.',                                         23,   null, null, '2026-07-18T08:40:00+02'),
  (27, 'count_adjustment',  'Dispatch cycle count closed',                 'Packaging lines counted; cartons up by four bundles.',                               32,   null, null, '2026-07-17T17:10:00+02'),
  (28, 'recipe_consumed',   'Prepared Veg Mix, 8 batches',                 'Thirty-two bags of carrots and 64kg of butternut consumed.',                          6,   '08',  2, '2026-07-16T10:35:00+02'),
  (29, 'document_sync',     'Boland Dry Goods invoice synced',             'Three dry-goods lines matched; costs unchanged.',                                    18,   '20', 12, '2026-07-15T15:15:00+02'),
  (30, 'order_received',    'Swartland Grain & Mill delivery booked in',   'Flour, maize meal and bread rolls received.',                                        19,   '1a',  6, '2026-07-14T09:00:00+02')
) as v(n, type, title, body, p, ref_group, ref_n, occurred_at);


-- ---------------------------------------------------------------------------
-- 14. Doc-U filing folders (`document_folders`, group 21) — 6 rows.
--     Deliberately NOT the built-in default category names (Invoices /
--     Statements / Delivery notes / Price lists / Orders): isDefaultFolderName()
--     hides default-named folders behind the type tiles, so custom names are what
--     make the folder grid render as its own row of tiles.
--     "Compliance & certificates" is intentionally empty — the certificates
--     themselves live on the supplier profiles (ss_supplier_documents, writer f);
--     the folder is the filing slot the team keeps for scanned originals.
-- ---------------------------------------------------------------------------
insert into document_folders (id, org_id, name, color, starred, created_by)
select ('21000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.name, v.color, v.starred, null
from (values
  (1, 'Supplier invoices — July',    '#0C447C', true),
  (2, 'Delivery notes — July',       '#854F0B', false),
  (3, 'Supplier statements',         '#0F6E56', true),
  (4, 'Price lists — Q3',            '#5B4FD6', false),
  (5, 'Compliance & certificates',   '#0E7490', false),
  (6, 'Customer orders (WhatsApp)',  '#C0345A', false)
) as v(n, name, color, starred);


-- ---------------------------------------------------------------------------
-- 15. Documents (`documents`, group 20) — 34 rows: 16 invoices, 8 delivery notes,
--     4 statements, 3 price lists, 3 customer orders.
--
--     Unlike the earlier demo seed, `supplier_id` IS set (to the core
--     `suppliers` row of §1) on all 31 supplier-facing documents. Two readers
--     require it: supplysync-data.ts:325 lists a profile's Doc-U feed with
--     `.not('supplier_id','is',null)` and excludes rejected/archived/error, and
--     supplysync-pricing.ts:156 derives price observations by bridging
--     documents.supplier_id -> ss_suppliers.supplier_id. The three CUSTOMER
--     orders keep supplier_id null (they have no supplier) and carry customer_id
--     instead — filing them against a supplier would put a customer order on a
--     supplier profile.
--
--     Nine of the invoices are the price-observation set: three each from
--     suppliers 4, 7 and 8, spaced 22 days apart across June-July so the span
--     clears measuredAnnualUnits()'s 7-day minimum, carrying the §4.2 item names
--     with unit_price stepping previous -> current. They are what makes
--     SupplySync's "price changes" tab agree with ss_supplier_pricing.
--
--     Statuses: 18 extracted, 8 reviewed, 4 approved, 2 pending, 2 error.
--     NEVER seed rejected/archived — supplysync-data.ts:329 filters them out.
--     The two `error` rows are the Doc-U "Flagged" KPI; the two `pending` rows
--     plus the 18 `extracted` are "Awaiting review" (documents.ts computeKpis).
--
--     extracted_data follows the documented shape
--     { fields:[{label,value,confidence}], line_items:[...], supplier } and is
--     kept to 2-4 line items so the list payload stays small.
-- ---------------------------------------------------------------------------

-- 15a. Supplier invoices (16). Docs 1-9 are the price-observation set.
insert into documents (
  id, org_id, supplier_id, customer_id, folder_id, filename, document_type, status,
  confidence, extracted_data, storage_path, uploaded_by, entity_type, entity_id, created_at
)
select ('20000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       case when v.sup    is not null then ('04000000-7e5d-4c1a-9b3f-' || lpad(v.sup::text,    12, '0'))::uuid end,
       case when v.cust   is not null then ('05000000-7e5d-4c1a-9b3f-' || lpad(v.cust::text,   12, '0'))::uuid end,
       case when v.folder is not null then ('21000000-7e5d-4c1a-9b3f-' || lpad(v.folder::text, 12, '0'))::uuid end,
       v.filename, v.doc_type, v.status, v.confidence, v.extracted_data::jsonb,
       'demo/docu/' || v.filename, null,
       nullif(v.entity_type, ''),
       case when v.entity_n is not null
            then (v.entity_group || '000000-7e5d-4c1a-9b3f-' || lpad(v.entity_n::text, 12, '0'))::uuid end,
       v.created_at::timestamptz
from (values
  ( 1, 4, null, null, 'winelands-protein-INV-8814.pdf', 'invoice', 'reviewed', 94,
    '{"supplier":"Winelands Protein Co.","fields":[{"label":"Supplier","value":"Winelands Protein Co.","confidence":96},{"label":"Invoice number","value":"INV-8814","confidence":95},{"label":"Invoice date","value":"2026-06-05","confidence":95},{"label":"Total (incl. VAT)","value":"R 338 054.00","confidence":94},{"label":"VAT","value":"R 44 094.00","confidence":93}],"line_items":[{"description":"Line fish fillet","quantity":"380","unit":"kg","unit_price":"148.00","amount":"56240.00","confidence":95},{"description":"Chicken portions","quantity":"420","unit":"box","unit_price":"566.00","amount":"237720.00","confidence":94}]}',
    '', null, null, '2026-06-05T07:35:00+02'),
  ( 2, 4, null, null, 'winelands-protein-INV-8967.pdf', 'invoice', 'extracted', 93,
    '{"supplier":"Winelands Protein Co.","fields":[{"label":"Supplier","value":"Winelands Protein Co.","confidence":95},{"label":"Invoice number","value":"INV-8967","confidence":94},{"label":"Invoice date","value":"2026-06-27","confidence":94},{"label":"Total (incl. VAT)","value":"R 362 388.00","confidence":93},{"label":"VAT","value":"R 47 268.00","confidence":92}],"line_items":[{"description":"Line fish fillet","quantity":"400","unit":"kg","unit_price":"152.00","amount":"60800.00","confidence":94},{"description":"Chicken portions","quantity":"440","unit":"box","unit_price":"578.00","amount":"254320.00","confidence":93}]}',
    '', null, null, '2026-06-27T07:50:00+02'),
  ( 3, 4, null, 1, 'winelands-protein-INV-9120.pdf', 'invoice', 'approved', 96,
    '{"supplier":"Winelands Protein Co.","fields":[{"label":"Supplier","value":"Winelands Protein Co.","confidence":97},{"label":"Invoice number","value":"INV-9120","confidence":97},{"label":"Invoice date","value":"2026-07-19","confidence":96},{"label":"Total (incl. VAT)","value":"R 423 384.00","confidence":96},{"label":"VAT","value":"R 55 224.00","confidence":95}],"line_items":[{"description":"Line fish fillet","quantity":"420","unit":"kg","unit_price":"168.00","amount":"70560.00","confidence":96},{"description":"Chicken portions","quantity":"480","unit":"box","unit_price":"620.00","amount":"297600.00","confidence":96}]}',
    '', null, null, '2026-07-19T08:05:00+02'),
  ( 4, 7, null, null, 'riebeek-oils-INV-4302.pdf', 'invoice', 'reviewed', 92,
    '{"supplier":"Riebeek Oils & Fats","fields":[{"label":"Supplier","value":"Riebeek Oils & Fats","confidence":94},{"label":"Invoice number","value":"INV-4302","confidence":93},{"label":"Invoice date","value":"2026-06-08","confidence":93},{"label":"Total (incl. VAT)","value":"R 206 908.00","confidence":92},{"label":"VAT","value":"R 26 988.00","confidence":91}],"line_items":[{"description":"Cooking oil (5L)","quantity":"240","unit":"case","unit_price":"558.00","amount":"133920.00","confidence":93},{"description":"Frying medium (20L)","quantity":"40","unit":"drum","unit_price":"1150.00","amount":"46000.00","confidence":92}]}',
    '', null, null, '2026-06-08T09:15:00+02'),
  ( 5, 7, null, null, 'riebeek-oils-INV-4388.pdf', 'invoice', 'extracted', 91,
    '{"supplier":"Riebeek Oils & Fats","fields":[{"label":"Supplier","value":"Riebeek Oils & Fats","confidence":93},{"label":"Invoice number","value":"INV-4388","confidence":92},{"label":"Invoice date","value":"2026-06-30","confidence":92},{"label":"Total (incl. VAT)","value":"R 228 942.00","confidence":91},{"label":"VAT","value":"R 29 862.00","confidence":90}],"line_items":[{"description":"Cooking oil (5L)","quantity":"260","unit":"case","unit_price":"566.00","amount":"147160.00","confidence":92},{"description":"Frying medium (20L)","quantity":"44","unit":"drum","unit_price":"1180.00","amount":"51920.00","confidence":91}]}',
    '', null, null, '2026-06-30T09:40:00+02'),
  ( 6, 7, null, 1, 'riebeek-oils-INV-4471.pdf', 'invoice', 'extracted', 95,
    '{"supplier":"Riebeek Oils & Fats","fields":[{"label":"Supplier","value":"Riebeek Oils & Fats","confidence":96},{"label":"Invoice number","value":"INV-4471","confidence":96},{"label":"Invoice date","value":"2026-07-22","confidence":95},{"label":"Total (incl. VAT)","value":"R 274 955.80","confidence":95},{"label":"VAT","value":"R 35 863.80","confidence":94}],"line_items":[{"description":"Cooking oil (5L)","quantity":"280","unit":"case","unit_price":"640.00","amount":"179200.00","confidence":96},{"description":"Frying medium (20L)","quantity":"46","unit":"drum","unit_price":"1302.00","amount":"59892.00","confidence":95}]}',
    '', null, null, '2026-07-22T09:05:00+02'),
  ( 7, 8, null, null, 'overberg-dairy-INV-2255.pdf', 'invoice', 'reviewed', 93,
    '{"supplier":"Overberg Dairy Supply","fields":[{"label":"Supplier","value":"Overberg Dairy Supply","confidence":95},{"label":"Invoice number","value":"INV-2255","confidence":94},{"label":"Invoice date","value":"2026-06-10","confidence":94},{"label":"Total (incl. VAT)","value":"R 183 632.00","confidence":93},{"label":"VAT","value":"R 23 952.00","confidence":92}],"line_items":[{"description":"Cheese block","quantity":"640","unit":"kg","unit_price":"122.00","amount":"78080.00","confidence":94},{"description":"Butter blocks","quantity":"200","unit":"case","unit_price":"408.00","amount":"81600.00","confidence":93}]}',
    '', null, null, '2026-06-10T10:25:00+02'),
  ( 8, 8, null, 1, 'overberg-dairy-INV-2341.pdf', 'invoice', 'extracted', 94,
    '{"supplier":"Overberg Dairy Supply","fields":[{"label":"Supplier","value":"Overberg Dairy Supply","confidence":95},{"label":"Invoice number","value":"INV-2341","confidence":95},{"label":"Invoice date","value":"2026-07-02","confidence":94},{"label":"Total (incl. VAT)","value":"R 198 938.50","confidence":94},{"label":"VAT","value":"R 25 948.50","confidence":93}],"line_items":[{"description":"Cheese block","quantity":"680","unit":"kg","unit_price":"125.00","amount":"85000.00","confidence":95},{"description":"Butter blocks","quantity":"210","unit":"case","unit_price":"419.00","amount":"87990.00","confidence":94}]}',
    '', null, null, '2026-07-02T10:10:00+02'),
  ( 9, 8, null, 1, 'overberg-dairy-INV-2428.pdf', 'invoice', 'approved', 96,
    '{"supplier":"Overberg Dairy Supply","fields":[{"label":"Supplier","value":"Overberg Dairy Supply","confidence":97},{"label":"Invoice number","value":"INV-2428","confidence":97},{"label":"Invoice date","value":"2026-07-24","confidence":96},{"label":"Total (incl. VAT)","value":"R 223 675.00","confidence":96},{"label":"VAT","value":"R 29 175.00","confidence":95}],"line_items":[{"description":"Cheese block","quantity":"700","unit":"kg","unit_price":"138.00","amount":"96600.00","confidence":97},{"description":"Butter blocks","quantity":"220","unit":"case","unit_price":"445.00","amount":"97900.00","confidence":96}]}',
    '', null, null, '2026-07-24T10:30:00+02'),
  (10, 1, null, 1, 'bergriver-growers-INV-6612.pdf', 'invoice', 'approved', 95,
    '{"supplier":"Bergriver Growers","fields":[{"label":"Supplier","value":"Bergriver Growers","confidence":97},{"label":"Invoice number","value":"INV-6612","confidence":96},{"label":"Invoice date","value":"2026-07-06","confidence":96},{"label":"Total (incl. VAT)","value":"R 283 912.00","confidence":95},{"label":"VAT","value":"R 37 032.00","confidence":94}],"line_items":[{"description":"Mixed Salad Leaf (crate)","quantity":"420","unit":"crate","unit_price":"148.00","amount":"62160.00","confidence":96},{"description":"Baby Spinach (crate)","quantity":"340","unit":"crate","unit_price":"132.00","amount":"44880.00","confidence":95},{"description":"Mixed Peppers (5kg box)","quantity":"300","unit":"box","unit_price":"168.00","amount":"50400.00","confidence":95},{"description":"Seasonal Citrus (15kg box)","quantity":"520","unit":"box","unit_price":"172.00","amount":"89440.00","confidence":94}]}',
    '', null, null, '2026-07-06T07:20:00+02'),
  (11, 2, null, 1, 'klipheuwel-farms-INV-3390.pdf', 'invoice', 'extracted', 92,
    '{"supplier":"Klipheuwel Farms","fields":[{"label":"Supplier","value":"Klipheuwel Farms","confidence":94},{"label":"Invoice number","value":"INV-3390","confidence":93},{"label":"Invoice date","value":"2026-07-09","confidence":93},{"label":"Total (incl. VAT)","value":"R 275 839.00","confidence":92},{"label":"VAT","value":"R 35 979.00","confidence":91}],"line_items":[{"description":"Tomatoes (kg)","quantity":"3800","unit":"kg","unit_price":"23.50","amount":"89300.00","confidence":93},{"description":"Onions (10kg bag)","quantity":"460","unit":"bag","unit_price":"92.00","amount":"42320.00","confidence":93},{"description":"Potatoes (10kg bag)","quantity":"620","unit":"bag","unit_price":"108.00","amount":"66960.00","confidence":92},{"description":"Carrots (10kg bag)","quantity":"480","unit":"bag","unit_price":"86.00","amount":"41280.00","confidence":91}]}',
    '', null, null, '2026-07-09T06:45:00+02'),
  (12, 5, null, 1, 'boland-dry-goods-INV-7714.pdf', 'invoice', 'reviewed', 94,
    '{"supplier":"Boland Dry Goods","fields":[{"label":"Supplier","value":"Boland Dry Goods","confidence":96},{"label":"Invoice number","value":"INV-7714","confidence":95},{"label":"Invoice date","value":"2026-07-07","confidence":95},{"label":"Total (incl. VAT)","value":"R 275 724.00","confidence":94},{"label":"VAT","value":"R 35 964.00","confidence":93}],"line_items":[{"description":"Rice (10kg bag)","quantity":"640","unit":"bag","unit_price":"148.00","amount":"94720.00","confidence":95},{"description":"Sugar (12.5kg bag)","quantity":"420","unit":"bag","unit_price":"168.00","amount":"70560.00","confidence":94},{"description":"Stock & Sauce Base (6x2L case)","quantity":"380","unit":"case","unit_price":"196.00","amount":"74480.00","confidence":93}]}',
    '', null, null, '2026-07-07T11:30:00+02'),
  (13, 6, null, 1, 'swartland-grain-INV-5108.pdf', 'invoice', 'reviewed', 93,
    '{"supplier":"Swartland Grain & Mill","fields":[{"label":"Supplier","value":"Swartland Grain & Mill","confidence":95},{"label":"Invoice number","value":"INV-5108","confidence":94},{"label":"Invoice date","value":"2026-07-14","confidence":94},{"label":"Total (incl. VAT)","value":"R 343 068.00","confidence":93},{"label":"VAT","value":"R 44 748.00","confidence":92}],"line_items":[{"description":"Cake Flour (12.5kg bag)","quantity":"720","unit":"bag","unit_price":"132.00","amount":"95040.00","confidence":94},{"description":"Maize Meal (12.5kg bag)","quantity":"840","unit":"bag","unit_price":"118.00","amount":"99120.00","confidence":93},{"description":"Bread Rolls (24/bag)","quantity":"2480","unit":"bag","unit_price":"42.00","amount":"104160.00","confidence":92}]}',
    '', null, null, '2026-07-14T08:55:00+02'),
  (14, 3, null, 1, 'cape-cold-chain-INV-1187.pdf', 'invoice', 'extracted', 89,
    '{"supplier":"Cape Cold Chain Supply","fields":[{"label":"Supplier","value":"Cape Cold Chain Supply","confidence":92},{"label":"Invoice number","value":"INV-1187","confidence":90},{"label":"Invoice date","value":"2026-07-18","confidence":90},{"label":"Total (incl. VAT)","value":"R 227 010.00","confidence":89},{"label":"VAT","value":"R 29 610.00","confidence":87}],"line_items":[{"description":"Ready Meal Trays (12/case)","quantity":"380","unit":"case","unit_price":"288.00","amount":"109440.00","confidence":90},{"description":"Prepared Salad Mix (2kg tub)","quantity":"560","unit":"tub","unit_price":"78.00","amount":"43680.00","confidence":89},{"description":"Prepared Veg Mix (2.5kg tub)","quantity":"540","unit":"tub","unit_price":"82.00","amount":"44280.00","confidence":88}]}',
    '', null, null, '2026-07-18T13:20:00+02'),
  (15, 9, null, 1, 'helderberg-packaging-INV-9042.pdf', 'invoice', 'extracted', 91,
    '{"supplier":"Helderberg Packaging","fields":[{"label":"Supplier","value":"Helderberg Packaging","confidence":93},{"label":"Invoice number","value":"INV-9042","confidence":92},{"label":"Invoice date","value":"2026-07-21","confidence":92},{"label":"Total (incl. VAT)","value":"R 182 298.00","confidence":91},{"label":"VAT","value":"R 23 778.00","confidence":90}],"line_items":[{"description":"Punnets & Trays (sleeve)","quantity":"480","unit":"sleeve","unit_price":"168.00","amount":"80640.00","confidence":92},{"description":"Cartons - Standard (bundle)","quantity":"660","unit":"bundle","unit_price":"118.00","amount":"77880.00","confidence":91}]}',
    '', null, null, '2026-07-21T14:10:00+02'),
  (16, 11, null, 1, 'stellenbosch-seedling-INV-2216.pdf', 'invoice', 'error', 54,
    '{"supplier":"Stellenbosch Seedling & Input Co.","fields":[{"label":"Supplier","value":"Stellenbosch Seedling & Input Co.","confidence":58},{"label":"Invoice number","value":"INV-2216","confidence":52},{"label":"Invoice date","value":"2026-07-25","confidence":49},{"label":"Total (incl. VAT)","value":"R 135 240.00","confidence":46}],"line_items":[{"description":"Mixed Herbs (bunch)","quantity":"4800","unit":"bunch","unit_price":"11.50","amount":"55200.00","confidence":55},{"description":"Seedling trays - mixed leaf","quantity":"800","unit":"tray","unit_price":"78.00","amount":"62400.00","confidence":51}]}',
    '', null, null, '2026-07-25T08:15:00+02')
) as v(n, sup, cust, folder, filename, doc_type, status, confidence, extracted_data,
       entity_type, entity_group, entity_n, created_at);

-- 15b. Delivery notes (8) and supplier statements (4).
--      Delivery notes carry quantities but NO unit_price, so readPriceObservations
--      skips them — correct, a DN is not a price source. The Drakenstein POD is
--      linked to a July customer invoice through entity_type/entity_id, which is
--      what OrderFlow's invoice page reads back (orderflow-data.ts:478).
--      Statements carry the `summary` block the statement-totals card and the
--      reconciliation view read, plus line items written in the SUPPLIER's raw
--      wording — the confirmed pp_name_aliases of §12 are what resolve them back
--      to catalogue products on OrderFlow's statement-price surface.
insert into documents (
  id, org_id, supplier_id, customer_id, folder_id, filename, document_type, status,
  confidence, extracted_data, storage_path, uploaded_by, entity_type, entity_id, created_at
)
select ('20000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       case when v.sup    is not null then ('04000000-7e5d-4c1a-9b3f-' || lpad(v.sup::text,    12, '0'))::uuid end,
       case when v.cust   is not null then ('05000000-7e5d-4c1a-9b3f-' || lpad(v.cust::text,   12, '0'))::uuid end,
       case when v.folder is not null then ('21000000-7e5d-4c1a-9b3f-' || lpad(v.folder::text, 12, '0'))::uuid end,
       v.filename, v.doc_type, v.status, v.confidence, v.extracted_data::jsonb,
       'demo/docu/' || v.filename, null,
       nullif(v.entity_type, ''),
       case when v.entity_n is not null
            then (v.entity_group || '000000-7e5d-4c1a-9b3f-' || lpad(v.entity_n::text, 12, '0'))::uuid end,
       v.created_at::timestamptz
from (values
  (17, 1, null, 2, 'bergriver-growers-DN-6612.pdf', 'delivery_note', 'extracted', 93,
    '{"supplier":"Bergriver Growers","fields":[{"label":"Supplier","value":"Bergriver Growers","confidence":95},{"label":"Delivery note","value":"DN-6612","confidence":94},{"label":"Delivery date","value":"2026-07-06","confidence":94},{"label":"Linked invoice","value":"INV-6612","confidence":92}],"line_items":[{"description":"Mixed Salad Leaf (crate)","quantity":"420","unit":"crate","confidence":94},{"description":"Baby Spinach (crate)","quantity":"340","unit":"crate","confidence":93},{"description":"Seasonal Citrus (15kg box)","quantity":"520","unit":"box","confidence":92}]}',
    '', null, null::int, '2026-07-06T07:32:00+02'),
  (18, 2, null, 2, 'klipheuwel-farms-DN-3390.pdf', 'delivery_note', 'extracted', 90,
    '{"supplier":"Klipheuwel Farms","fields":[{"label":"Supplier","value":"Klipheuwel Farms","confidence":93},{"label":"Delivery note","value":"DN-3390","confidence":91},{"label":"Delivery date","value":"2026-07-09","confidence":91}],"line_items":[{"description":"Tomatoes (kg)","quantity":"3800","unit":"kg","confidence":92},{"description":"Potatoes (10kg bag)","quantity":"620","unit":"bag","confidence":90},{"description":"Carrots (10kg bag)","quantity":"480","unit":"bag","confidence":89}]}',
    '', null, null, '2026-07-09T06:58:00+02'),
  (19, 4, null, 2, 'winelands-protein-DN-9120.pdf', 'delivery_note', 'extracted', 92,
    '{"supplier":"Winelands Protein Co.","fields":[{"label":"Supplier","value":"Winelands Protein Co.","confidence":94},{"label":"Delivery note","value":"DN-9120","confidence":93},{"label":"Delivery date","value":"2026-07-19","confidence":93},{"label":"Cold chain check","value":"2.8 degrees on arrival","confidence":90}],"line_items":[{"description":"Chicken portions","quantity":"480","unit":"box","confidence":93},{"description":"Line fish fillet","quantity":"420","unit":"kg","confidence":92}]}',
    '', null, null, '2026-07-19T08:18:00+02'),
  (20, 5, null, 2, 'boland-dry-goods-DN-7714.pdf', 'delivery_note', 'extracted', 91,
    '{"supplier":"Boland Dry Goods","fields":[{"label":"Supplier","value":"Boland Dry Goods","confidence":93},{"label":"Delivery note","value":"DN-7714","confidence":92},{"label":"Delivery date","value":"2026-07-07","confidence":92}],"line_items":[{"description":"Rice (10kg bag)","quantity":"640","unit":"bag","confidence":92},{"description":"Sugar (12.5kg bag)","quantity":"420","unit":"bag","confidence":91}]}',
    '', null, null, '2026-07-07T11:42:00+02'),
  (21, 6, null, 2, 'swartland-grain-DN-5108.pdf', 'delivery_note', 'reviewed', 94,
    '{"supplier":"Swartland Grain & Mill","fields":[{"label":"Supplier","value":"Swartland Grain & Mill","confidence":96},{"label":"Delivery note","value":"DN-5108","confidence":95},{"label":"Delivery date","value":"2026-07-14","confidence":95}],"line_items":[{"description":"Cake Flour (12.5kg bag)","quantity":"720","unit":"bag","confidence":95},{"description":"Maize Meal (12.5kg bag)","quantity":"840","unit":"bag","confidence":94},{"description":"Bread Rolls (24/bag)","quantity":"2480","unit":"bag","confidence":93}]}',
    '', null, null, '2026-07-14T09:06:00+02'),
  (22, 8, null, 2, 'overberg-dairy-DN-2428.pdf', 'delivery_note', 'extracted', 92,
    '{"supplier":"Overberg Dairy Supply","fields":[{"label":"Supplier","value":"Overberg Dairy Supply","confidence":94},{"label":"Delivery note","value":"DN-2428","confidence":93},{"label":"Delivery date","value":"2026-07-24","confidence":93},{"label":"Cold chain check","value":"3.4 degrees on arrival","confidence":91}],"line_items":[{"description":"Cheese block","quantity":"700","unit":"kg","confidence":93},{"description":"Butter blocks","quantity":"220","unit":"case","confidence":92}]}',
    '', null, null, '2026-07-24T10:38:00+02'),
  (23, 9, null, 2, 'helderberg-packaging-DN-9042.pdf', 'delivery_note', 'pending', null,
    '{"supplier":"Helderberg Packaging","fields":[]}',
    '', null, null, '2026-07-21T14:22:00+02'),
  (24, 14, null, 2, 'drakenstein-logistics-DN-4471.pdf', 'delivery_note', 'extracted', 88,
    '{"supplier":"Drakenstein Logistics & Freight","fields":[{"label":"Supplier","value":"Drakenstein Logistics & Freight","confidence":91},{"label":"Delivery note","value":"POD-4471","confidence":89},{"label":"Delivery date","value":"2026-07-23","confidence":89},{"label":"Signed by","value":"Receiving — trade route","confidence":85}],"line_items":[{"description":"Outbound freight - July week 3","quantity":"30","unit":"load","confidence":88}]}',
    'invoice', '0c', 356, '2026-07-23T12:00:00+02'),
  (25, 1, null, 3, 'bergriver-growers-STMT-2026-06.pdf', 'statement', 'extracted', 94,
    '{"supplier":"Bergriver Growers","fields":[{"label":"Supplier","value":"Bergriver Growers","confidence":96},{"label":"Statement period","value":"June 2026","confidence":95},{"label":"Closing balance","value":"R 406 100.00","confidence":94}],"summary":{"statement_date":"30/JUN/2026","opening_balance":386400.00,"payments":-395000.00,"total_purchases":412000.00,"total_pallet_refunds":-2800.00,"total_pallet_usage":3600.00,"vat":53739.13,"total_charges":1900.00,"closing_balance":406100.00,"net_financial_transactions":19700.00,"audit_error":0.00},"line_items":[{"description":"SALAD LEAF MIX 5KG CRT","quantity":"1180","unit":"crate","unit_price":"147.00","amount":"173460.00","confidence":93},{"description":"SPINACH BABY 4KG","quantity":"940","unit":"crate","unit_price":"131.00","amount":"123140.00","confidence":92},{"description":"PALLET DEPOSIT","quantity":"40","unit":"pallet","unit_price":"70.00","amount":"2800.00","confidence":88}]}',
    '', null, null, '2026-06-30T16:05:00+02'),
  (26, 4, null, 3, 'winelands-protein-STMT-2026-06.pdf', 'statement', 'reviewed', 95,
    '{"supplier":"Winelands Protein Co.","fields":[{"label":"Supplier","value":"Winelands Protein Co.","confidence":97},{"label":"Statement period","value":"June 2026","confidence":96},{"label":"Closing balance","value":"R 580 300.00","confidence":95}],"summary":{"statement_date":"30/JUN/2026","opening_balance":552300.00,"payments":-560000.00,"total_purchases":588000.00,"total_pallet_refunds":0.00,"total_pallet_usage":0.00,"vat":76695.65,"total_charges":0.00,"closing_balance":580300.00,"net_financial_transactions":28000.00,"audit_error":0.00},"line_items":[{"description":"CHICK PORT 10KG CTN","quantity":"920","unit":"box","unit_price":"620.00","amount":"570400.00","confidence":95},{"description":"FISH FILLET LINE KG","quantity":"800","unit":"kg","unit_price":"168.00","amount":"134400.00","confidence":94},{"description":"DELIVERY SURCHARGE","quantity":"12","unit":"trip","unit_price":"850.00","amount":"10200.00","confidence":90}]}',
    '', null, null, '2026-06-30T16:12:00+02'),
  (27, 5, null, 3, 'boland-dry-goods-STMT-2026-06.pdf', 'statement', 'extracted', 93,
    '{"supplier":"Boland Dry Goods","fields":[{"label":"Supplier","value":"Boland Dry Goods","confidence":95},{"label":"Statement period","value":"June 2026","confidence":94},{"label":"Closing balance","value":"R 366 600.00","confidence":93}],"summary":{"statement_date":"30/JUN/2026","opening_balance":358900.00,"payments":-368000.00,"total_purchases":374000.00,"total_pallet_refunds":-1600.00,"total_pallet_usage":2100.00,"vat":48782.61,"total_charges":1200.00,"closing_balance":366600.00,"net_financial_transactions":7700.00,"audit_error":0.00},"line_items":[{"description":"Rice (10kg bag)","quantity":"640","unit":"bag","unit_price":"148.00","amount":"94720.00","confidence":94},{"description":"MEALIE MEAL SPECIAL 12.5","quantity":"480","unit":"bag","unit_price":"118.00","amount":"56640.00","confidence":90}]}',
    '', null, null, '2026-06-30T16:20:00+02'),
  (28, 8, null, 3, 'overberg-dairy-STMT-2026-06.pdf', 'statement', 'approved', 96,
    '{"supplier":"Overberg Dairy Supply","fields":[{"label":"Supplier","value":"Overberg Dairy Supply","confidence":97},{"label":"Statement period","value":"June 2026","confidence":97},{"label":"Closing balance","value":"R 338 400.00","confidence":96}],"summary":{"statement_date":"30/JUN/2026","opening_balance":331500.00,"payments":-336000.00,"total_purchases":342000.00,"total_pallet_refunds":0.00,"total_pallet_usage":0.00,"vat":44608.70,"total_charges":900.00,"closing_balance":338400.00,"net_financial_transactions":6900.00,"audit_error":0.00},"line_items":[{"description":"CHEESE GOUDA BLOCK KG","quantity":"1380","unit":"kg","unit_price":"138.00","amount":"190440.00","confidence":96},{"description":"MILK FULL CREAM 12X1L","quantity":"1760","unit":"case","unit_price":"168.00","amount":"295680.00","confidence":95}]}',
    '', null, null, '2026-06-30T16:28:00+02')
) as v(n, sup, cust, folder, filename, doc_type, status, confidence, extracted_data,
       entity_type, entity_group, entity_n, created_at);

-- 15c. Price lists (3) and uploaded customer orders (3).
--      The customer orders are the WhatsApp/e-mail intake path: supplier_id is
--      NULL (there is no supplier on a customer order) and customer_id + the
--      entity link to the July of_orders row carry the relationship instead.
--      extracted_data therefore uses `customer_name` / `customer_confidence`,
--      which is what orderflow-from-doc.ts reads.
insert into documents (
  id, org_id, supplier_id, customer_id, folder_id, filename, document_type, status,
  confidence, extracted_data, storage_path, uploaded_by, entity_type, entity_id, created_at
)
select ('20000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       case when v.sup    is not null then ('04000000-7e5d-4c1a-9b3f-' || lpad(v.sup::text,    12, '0'))::uuid end,
       case when v.cust   is not null then ('05000000-7e5d-4c1a-9b3f-' || lpad(v.cust::text,   12, '0'))::uuid end,
       case when v.folder is not null then ('21000000-7e5d-4c1a-9b3f-' || lpad(v.folder::text, 12, '0'))::uuid end,
       v.filename, v.doc_type, v.status, v.confidence, v.extracted_data::jsonb,
       'demo/docu/' || v.filename, null,
       nullif(v.entity_type, ''),
       case when v.entity_n is not null
            then (v.entity_group || '000000-7e5d-4c1a-9b3f-' || lpad(v.entity_n::text, 12, '0'))::uuid end,
       v.created_at::timestamptz
from (values
  (29, 1, null::int, 4, 'bergriver-growers-pricelist-2026-Q3.pdf', 'price_list', 'pending', null::int,
    '{"supplier":"Bergriver Growers","fields":[]}',
    '', null, null::int, '2026-07-01T06:30:00+02'),
  (30, 5, null, 4, 'boland-dry-goods-pricelist-2026-Q3.pdf', 'price_list', 'reviewed', 93,
    '{"supplier":"Boland Dry Goods","fields":[{"label":"Supplier","value":"Boland Dry Goods","confidence":95},{"label":"Effective date","value":"2026-07-01","confidence":94},{"label":"Valid until","value":"2026-09-30","confidence":93}],"line_items":[{"description":"Rice (10kg bag)","unit":"bag","unit_price":"148.00","confidence":94},{"description":"Sugar (12.5kg bag)","unit":"bag","unit_price":"168.00","confidence":93},{"description":"Stock & Sauce Base (6x2L case)","unit":"case","unit_price":"196.00","confidence":92}]}',
    '', null, null, '2026-07-01T08:40:00+02'),
  (31, 9, null, 4, 'helderberg-packaging-pricelist-2026-Q3.pdf', 'price_list', 'extracted', 90,
    '{"supplier":"Helderberg Packaging","fields":[{"label":"Supplier","value":"Helderberg Packaging","confidence":92},{"label":"Effective date","value":"2026-07-02","confidence":91},{"label":"Valid until","value":"2026-09-30","confidence":90}],"line_items":[{"description":"Punnets & Trays (sleeve)","unit":"sleeve","unit_price":"168.00","confidence":91},{"description":"Cartons - Standard (bundle)","unit":"bundle","unit_price":"118.00","confidence":90}]}',
    '', null, null, '2026-07-02T09:15:00+02'),
  (32, null, 3, 6, 'winelands-wholesale-order-whatsapp-2026-07-27.jpg', 'order', 'extracted', 88,
    '{"customer_name":"Winelands Wholesale","customer_confidence":91,"fields":[{"label":"Customer","value":"Winelands Wholesale","confidence":91},{"label":"Order date","value":"2026-07-27","confidence":89},{"label":"Requested delivery","value":"2026-07-29","confidence":87}],"line_items":[{"description":"Potatoes (10kg bag)","quantity":"60","unit":"bag","confidence":89},{"description":"Onions (10kg bag)","quantity":"45","unit":"bag","confidence":88},{"description":"Carrots (10kg bag)","quantity":"40","unit":"bag","confidence":87},{"description":"Tomatoes (kg)","quantity":"320","unit":"kg","confidence":86}]}',
    'order', '0a', 352, '2026-07-27T15:20:00+02'),
  (33, null, 13, 6, 'stellenbosch-events-order-2026-07-28.pdf', 'order', 'extracted', 86,
    '{"customer_name":"Stellenbosch Events Collective","customer_confidence":89,"fields":[{"label":"Customer","value":"Stellenbosch Events Collective","confidence":89},{"label":"Order date","value":"2026-07-28","confidence":87},{"label":"Function date","value":"2026-08-01","confidence":85}],"line_items":[{"description":"Ready Meal Trays (12/case)","quantity":"36","unit":"case","confidence":88},{"description":"Prepared Salad Mix (2kg tub)","quantity":"48","unit":"tub","confidence":86},{"description":"Cheese Block (kg)","quantity":"28","unit":"kg","confidence":85}]}',
    'order', '0a', 411, '2026-07-28T09:45:00+02'),
  (34, null, 23, 6, 'klapmuts-farm-stall-order-2026-07-28.jpg', 'order', 'error', 52,
    '{"customer_name":"Klapmuts Farm Stall","customer_confidence":58,"fields":[{"label":"Customer","value":"Klapmuts Farm Stall","confidence":58},{"label":"Order date","value":"2026-07-28","confidence":49}],"line_items":[{"description":"Bread Rolls (24/bag)","quantity":"12","unit":"bag","confidence":54},{"description":"Seasonal Apples (12.5kg box)","quantity":"6","unit":"box","confidence":47}]}',
    'order', '0a', 422, '2026-07-28T16:35:00+02')
) as v(n, sup, cust, folder, filename, doc_type, status, confidence, extracted_data,
       entity_type, entity_group, entity_n, created_at);


-- 15d. Star six documents. `documents.starred` arrives via the additive migration
--      supabase/docu-review-columns.sql, which the assembler does NOT inline, so
--      the write is guarded exactly like the org onboarding columns in §1.2 of the
--      blueprint: on a database without the column the seed simply skips it
--      instead of failing the whole script.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'documents'
               and column_name = 'starred') then
    update documents set starred = true
    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
      and id in (
        '20000000-7e5d-4c1a-9b3f-000000000010'::uuid,  -- Bergriver invoice
        '20000000-7e5d-4c1a-9b3f-000000000016'::uuid,  -- flagged seedling invoice
        '20000000-7e5d-4c1a-9b3f-000000000025'::uuid,  -- Bergriver statement
        '20000000-7e5d-4c1a-9b3f-000000000027'::uuid,  -- Boland statement
        '20000000-7e5d-4c1a-9b3f-000000000031'::uuid,  -- Helderberg price list
        '20000000-7e5d-4c1a-9b3f-000000000032'::uuid   -- WhatsApp customer order
      );
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 16. ProcurePulse notifications (`pp_notifications`) — 12 rows.
--     Required by the ProcurePulse read-path contract (procurepulse-queries.ts
--     fetchNotifications): the dashboard renders the newest 5 and the
--     Notifications page buckets them Today / Yesterday / Earlier.
--
--     NOTE — the blueprint's §2 id table stops at group `41` and allocates no
--     group for pp_notifications. Three seeds needed a post-`41` code, so the
--     assembler split them: `42` cd_customer_item_aliases, `43` pp_notifications
--     (here), `44` supplier_aliases. One table per group, as §2 requires.
--
--     Kinds come from PpNotificationKind (types.ts:185): low_stock |
--     new_direct_doc | new_market_statement | price_change | reorder. They mirror
--     facts that are true elsewhere in the seed — the four low/out lines, the
--     three step cost spikes, the flagged document — so nothing here is a claim
--     the rest of the data cannot back up.
-- ---------------------------------------------------------------------------
insert into pp_notifications (
  id, org_id, kind, title, body, stock_item_id, document_id, read, created_at
)
select ('43000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.kind, v.title, nullif(v.body, ''),
       case when v.p is not null then ('02000000-7e5d-4c1a-9b3f-' || lpad(v.p::text, 12, '0'))::uuid end,
       case when v.d is not null then ('20000000-7e5d-4c1a-9b3f-' || lpad(v.d::text, 12, '0'))::uuid end,
       v.read, v.created_at::timestamptz
from (values
  ( 1, 'low_stock',            'Line Fish Fillet (kg) is out of stock',        'Zero on hand against a threshold of 20 kg. Reorder request already open with Winelands Protein Co.', 16, null::int, false, '2026-07-29T07:45:00+02'),
  ( 2, 'price_change',         'Cooking Oil cost up 13.1%',                    'Riebeek Oils & Fats moved the 4x5L case from R566 to R640 — the biggest single step on the catalogue.', 21,    6, false, '2026-07-29T08:15:00+02'),
  ( 3, 'low_stock',            'Fresh Milk (12x1L case) is below threshold',   '18 cases on hand against a threshold of 24.',                                                          23, null, false, '2026-07-29T06:20:00+02'),
  ( 4, 'new_direct_doc',       'Overberg Dairy Supply invoice received',       'INV-2428, R223 675.00 incl. VAT. Two lines matched to the catalogue.',                                 25,    9, false, '2026-07-24T10:32:00+02'),
  ( 5, 'low_stock',            'Bread Rolls (24/bag) is below threshold',      '14 bags on hand against a threshold of 30.',                                                           30, null, true,  '2026-07-28T06:10:00+02'),
  ( 6, 'price_change',         'Cheese Block cost up 10.4%',                   'Overberg Dairy Supply moved the kilogram rate from R125 to R138.',                                     25,    9, true,  '2026-07-26T10:10:00+02'),
  ( 7, 'reorder',              'Five reorder requests are open',               'Line fish, baby spinach, bread rolls, fresh milk and punnets are all waiting on a purchase order.',   null, null, false, '2026-07-28T15:15:00+02'),
  ( 8, 'new_direct_doc',       'Stellenbosch Seedling invoice could not be read','Extraction confidence 54% — the document is flagged for a manual pass.',                              12,   16, false, '2026-07-25T08:22:00+02'),
  ( 9, 'low_stock',            'Baby Spinach (crate) is below threshold',      '6 crates on hand against a threshold of 12.',                                                           2, null, true,  '2026-07-27T06:05:00+02'),
  (10, 'price_change',         'Line Fish Fillet cost up 10.5%',               'Winelands Protein Co. moved the kilogram rate from R152 to R168.',                                     16,    3, true,  '2026-07-19T08:20:00+02'),
  (11, 'new_market_statement', 'Four June supplier statements filed',          'Bergriver, Winelands, Boland and Overberg statements are in and ready to reconcile.',                  null,   25, true,  '2026-06-30T16:35:00+02'),
  (12, 'price_change',         'Chicken Portions cost crept 10.7%',            'Six consecutive rises from R560 to R620 since the start of the season.',                               13,    3, true,  '2026-07-21T15:55:00+02')
) as v(n, kind, title, body, p, d, read, created_at);


-- ===========================================================================
-- Verification for this fragment (the assembler folds these into §13.5).
-- Expected counts, all scoped to the Meridian org:
--   suppliers 14 · pp_stock_items 32 · pp_stock_thresholds 32 · pp_product_units 32
--   pp_item_suppliers 66 · pp_settings 1 · pp_recipes 18 · pp_recipe_ingredients 75
--   pp_movements 256 · pp_stock_orders 14 · pp_stock_order_items 40
--   pp_reorder_requests 9 · pp_name_aliases 16 · procurepulse_activity_events 30
--   document_folders 6 · documents 34 · pp_notifications 12
--
-- -- 7 cost spikes: 3 step (>=10%) + 4 creep (>=8%)
-- select name,
--        round(100.0 * ((price_history->>6)::numeric - (price_history->>5)::numeric)
--              / (price_history->>5)::numeric, 2) as step_pct,
--        round(100.0 * ((price_history->>6)::numeric - (price_history->>0)::numeric)
--              / (price_history->>0)::numeric, 2) as creep_pct
-- from pp_stock_items
-- where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--   and (  ((price_history->>6)::numeric - (price_history->>5)::numeric) / (price_history->>5)::numeric >= 0.10
--       or ((price_history->>6)::numeric - (price_history->>0)::numeric) / (price_history->>0)::numeric >= 0.08 )
-- order by 2 desc;                                                        -- 7 rows
--
-- -- HARD RULE 2: the last price_history point must equal avg_unit_price
-- select count(*) from pp_stock_items
-- where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--   and (price_history->>6)::numeric <> avg_unit_price;                    -- 0
--
-- -- 4 low/out lines feeding InsightGen stock-low anomalies
-- select count(*) from pp_stock_items
-- where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--   and on_hand <= low_threshold;                                          -- 4
--
-- -- WasteWatch food-cost denominator: non-cancelled stock orders in the last 30d
-- select round(sum(total)) from pp_stock_orders
-- where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--   and status <> 'cancelled'
--   and created_at >= now() - interval '30 days';                          -- 3 271 020
--
-- -- Doc-U status mix (18 extracted / 8 reviewed / 4 approved / 2 pending / 2 error)
-- select status, count(*) from documents
-- where org_id = '01000000-7e5d-4c1a-9b3f-000000000001' group by 1 order by 1;
--
-- -- SupplySync must see 31 supplier-filed documents (the 3 customer orders are
-- -- correctly excluded: no supplier_id)
-- select count(*) from documents
-- where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--   and supplier_id is not null
--   and status not in ('rejected','archived','error');                     -- 30
-- ===========================================================================


-- ##########################################################################
-- ##  SECTION 2E
-- ##  SupplySync + InsightGen — supplier profiles, contacts, documents,
-- ##  pricing, risks, history, aliases, credits, rebates, receipts;
-- ##  insights, reports, report runs, anomaly acks  (apply order 10-11, 15)
-- ##########################################################################

-- ===========================================================================
-- DOMAIN (f) — SupplySync (+ credits & rebates) + InsightGen (+ runs & acks)
-- Meridian Food Co. (Stellenbosch, Western Cape) — demo seed fragment.
-- ---------------------------------------------------------------------------
-- All money in ZAR. Anchor date: Wed 2026-07-29.
--
-- WHAT THE MODULES READ (verified against the data layer, not just the DDL):
--
--   supplysync-data.ts:316-338  selects * from ss_suppliers / _contacts /
--     _documents / _pricing / _risks / _history, plus ss_supplier_credits,
--     ss_supplier_rebates, ss_supplier_rebate_receipts. Every intelligence
--     column is read by the scorecards, so all of them are filled here.
--   supplysync-data.ts:515      linkedDocs are keyed off ss_suppliers.supplier_id
--     → the CORE suppliers row (blueprint group `04`). That bridge is set
--     explicitly below; Doc-U documents (writer (b)) carry the same core id.
--   supplysync-pricing.ts:156   readPriceObservations() bridges
--     documents.supplier_id → ss profile id via the SAME column.
--   supplysync-credits.ts:63    UNRESOLVED_CREDIT_STATUSES = claimed|acknowledged.
--   supplysync-credits.ts:275   mapRebateRow() RE-DERIVES status and recomputes
--     outstanding = expected − Σ receipts. Receipts are the source of truth.
--   supplysync-insights.ts:83   measureEvents() only counts ss_supplier_history
--     rows inside a 90-day window → every event below is dated May–Jul 2026.
--   insightgen-data.ts:357-384  ig_insights / ig_reports / ig_report_runs /
--     ig_anomaly_acks, plus ss_suppliers/_risks/_documents/_pricing for the
--     rule-based anomalies (:781 price jumps, :833 supplier risks, :566 doc
--     expiries).
--
-- ID SCHEME (blueprint §2) — GG000000-7e5d-4c1a-9b3f-<12-digit counter>:
--   03 ss_suppliers (1-14)              04 suppliers (core, same index, writer (b))
--   22 ss_supplier_contacts (idx*10+n)  23 ss_supplier_documents (idx*10+n)
--   24 ss_supplier_pricing (idx*100+n)  25 ss_supplier_risks (1-8)
--   26 ss_supplier_history (1-36)       27 ss_supplier_credits (1-12)
--   28 ss_supplier_rebates (1-4)        29 ss_supplier_rebate_receipts (reb*10+n)
--   36 ig_insights (1-12)               37 ig_reports (1-5)
--   38 ig_report_runs (1-6)             39 ig_anomaly_acks (1-2)
--   44 supplier_aliases (1-9)           -- NEW group. `41` was the last one the
--                                       -- blueprint allocated; 42 went to
--                                       -- cd_customer_item_aliases and 43 to
--                                       -- pp_notifications, so 44 is the first free.
--
-- PREREQUISITES (inlined by the assembler, §13.3): 4-supplysync-schema.sql,
-- 5-insightgen-schema.sql, supplysync-link.sql (adds ss_suppliers.supplier_id
-- and supplier_aliases), ss-supplier-credits.sql, ss-supplier-rebates.sql,
-- 5b-insightgen-runs-acks.sql. Core `suppliers` rows (group 04) are seeded by
-- writer (b) at apply-order 1 — the FKs below resolve against them.
--
-- Re-runnable: every delete is scoped to the Meridian org UUID and nothing else.
-- No DDL here. No other organisation is referenced anywhere in this file.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Delete preamble — Meridian only, children before parents.
-- ---------------------------------------------------------------------------
delete from ig_anomaly_acks             where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ig_report_runs              where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ig_reports                  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ig_insights                 where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

delete from ss_supplier_rebate_receipts where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_supplier_rebates         where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_supplier_credits         where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_supplier_history         where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_supplier_risks           where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_supplier_pricing         where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_supplier_contacts        where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_supplier_documents       where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ss_suppliers                where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from supplier_aliases            where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ===========================================================================
-- 1. THE SUPPLY BASE — 14 suppliers (blueprint §4)
-- ---------------------------------------------------------------------------
-- Deliberately segment-neutral: field produce, proteins, dry goods, dairy,
-- packaging, field inputs, beverages, cold storage and freight read the same
-- whether Meridian is read as a producer, a wholesaler, a caterer or a counter
-- operation. `supplier_id` bridges each profile to its CORE suppliers row
-- (group 04, same index) so Doc-U invoices land on the SupplySync profile.
-- avg_monthly_spend sums to R3 410 000/month ≈ 62% of R5.5M revenue = COGS.
-- ===========================================================================
insert into ss_suppliers (
  id, org_id, supplier_id, name, category, contact_name, contact_phone, contact_email,
  status, risk, rating, reliability, quality, delivery_pct, on_time_pct,
  price_trend, lead_time_days, last_issue, last_order, spend_mtd, currency, notes
)
select ('03000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('04000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       v.name, v.category, v.contact_name, v.contact_phone, v.contact_email,
       v.status, v.risk, v.rating, v.reliability, v.quality, v.delivery_pct, v.on_time_pct,
       v.price_trend, v.lead_time_days, nullif(v.last_issue, ''), v.last_order::date,
       v.spend_mtd, 'ZAR', v.notes::jsonb
from (values
  (1,  'Bergriver Growers',                 'Field Produce',      'Hendrik Bezuidenhout', '022 913 4400', 'orders@bergrivergrowers.co.za',   'preferred', 'low',    5, 94, 93, 95, 96, 'stable',   1, '',                                    '2026-07-28', 386000, '[{"body":"Anchor for salad leaf, spinach and tomatoes — 5% below market and never short.","date":"2026-07-14","author":"Fatima Isaacs"},{"body":"Season-close grower rebate of R36 000 still unpaid on the closed quarter.","date":"2026-07-02","author":"Ursula Petersen"}]'),
  (2,  'Klipheuwel Farms',                  'Field Produce',      'Nolwazi Mabaso',       '021 972 3310', 'sales@klipheuwelfarms.co.za',     'active',    'low',    4, 89, 88, 90, 91, 'stable',   2, '',                                    '2026-07-27', 312000, '[{"body":"Root veg twice a week — potatoes, onions, carrots, butternut. Steady grade.","date":"2026-07-21","author":"Chris Adams"},{"body":"R14 300 short-ship acknowledged; credit note promised for month end.","date":"2026-07-06","author":"Ursula Petersen"}]'),
  (3,  'Cape Cold Chain Supply',            'Chilled Logistics',  'Deon Arendse',         '021 552 8840', 'bookings@capecoldchain.co.za',    'active',    'medium', 3, 78, 82, 76, 79, 'stable',   1, 'Two late chilled runs this month',    '2026-07-28', 184000, '[{"body":"Two late transfer runs this month — the 06:00 window is now written into the booking.","date":"2026-07-17","author":"Marius Fourie"},{"body":"B-BBEE certificate lapses shortly; renewal requested.","date":"2026-07-20","author":"Ursula Petersen"}]'),
  (4,  'Winelands Protein Co.',             'Proteins',           'Marius Coetzee',       '021 887 6620', 'orders@winelandsprotein.co.za',   'active',    'high',   3, 72, 76, 74, 75, 'rising',   2, 'Food-safety certificate expired',     '2026-07-27', 552000, '[{"body":"Largest single line of spend and the least compliant — food-safety audit certificate has lapsed.","date":"2026-07-05","author":"Ursula Petersen"},{"body":"Line fish +10.5% and chicken +7.3% inside one month. Quote alternatives.","date":"2026-07-02","author":"Gerhard Nel"}]'),
  (5,  'Boland Dry Goods',                  'Dry Goods',          'Shireen Kamaldien',    '021 863 4470', 'sales@bolanddrygoods.co.za',      'preferred', 'low',    5, 92, 91, 93, 94, 'stable',   2, '',                                    '2026-07-28', 348000, '[{"body":"Q3 list is 3-5% under market on rice, sugar and oil. Preferred for dry goods.","date":"2026-07-13","author":"Gerhard Nel"},{"body":"Winter volume rebate accruing at 2.4% against an R1.8M threshold.","date":"2026-06-30","author":"Fatima Isaacs"}]'),
  (6,  'Swartland Grain & Mill',            'Dry Goods',          'Johan Kritzinger',     '022 482 1190', 'orders@swartlandgrain.co.za',     'active',    'low',    4, 85, 86, 84, 87, 'rising',   3, '',                                    '2026-07-24', 274000, '[{"body":"Milling costs creeping ~2.5% on maize meal and cake flour. Watch into Q4.","date":"2026-07-11","author":"Gerhard Nel"},{"body":"Growth rebate short: R8 500 received of R32 500 expected.","date":"2026-07-10","author":"Ursula Petersen"}]'),
  (7,  'Riebeek Oils & Fats',               'Dry Goods',          'Andries Malan',        '022 448 2200', 'sales@riebeekoils.co.za',         'review',    'high',   2, 68, 74, 70, 71, 'rising',   3, 'Cooking oil up 13% in one month',     '2026-07-22', 196000, '[{"body":"Cooking oil R566 to R640 a case and frying medium R1 180 to R1 302 in one month.","date":"2026-07-08","author":"Gerhard Nel"},{"body":"Tax clearance expired — moved to review, no new orders until it lands.","date":"2026-07-19","author":"Ursula Petersen"}]'),
  (8,  'Overberg Dairy Supply',             'Dairy & Chilled',    'Tania Swanepoel',      '028 424 7710', 'orders@overbergdairy.co.za',      'active',    'medium', 4, 81, 83, 82, 84, 'rising',   1, 'Cheese block grade dip on two loads', '2026-07-28', 318000, '[{"body":"Cheese +10.4% and butter +6.2% on the July list; milk and cream held.","date":"2026-07-07","author":"Gerhard Nel"},{"body":"Substitution credit of R4 780 acknowledged, not yet settled.","date":"2026-06-22","author":"Chris Adams"}]'),
  (9,  'Helderberg Packaging',              'Packaging',          'Ridwaan Salie',        '021 851 3390', 'sales@helderbergpack.co.za',      'preferred', 'low',    5, 91, 90, 92, 93, 'stable',   3, '',                                    '2026-07-23', 144000, '[{"body":"4-5% below market on punnets and cartons with nothing logged against them.","date":"2026-06-18","author":"Fatima Isaacs"}]'),
  (10, 'Cape Label & Print',                'Packaging',          'Lauren Meyer',         '021 447 9920', 'studio@capelabelprint.co.za',     'active',    'low',    4, 86, 87, 85, 88, 'stable',   4, '',                                    '2026-07-16', 56000,  '[{"body":"Labels and printed sleeves for the prepared lines. Four-day lead time.","date":"2026-07-16","author":"Yolanda Fortuin"}]'),
  (11, 'Stellenbosch Seedling & Input Co.', 'Field Inputs',       'Elmarie Roux',         '021 883 5540', 'orders@stellseedling.co.za',      'active',    'low',    3, 79, 80, 78, 80, 'volatile', 5, 'Slow to respond on seedling orders',  '2026-07-14', 102000, '[{"body":"Two days to answer on the spring seedling schedule — confirm the right channel.","date":"2026-07-03","author":"Imraan Davids"},{"body":"R1 780 damaged-tray claim written off; no condition photo on arrival.","date":"2026-06-04","author":"Ursula Petersen"}]'),
  (12, 'Peninsula Beverage Supply',         'Beverages',          'Sipho Ndaba',          '021 510 6680', 'sales@peninsulabev.co.za',        'active',    'low',    4, 84, 85, 83, 86, 'stable',   2, '',                                    '2026-07-21', 87000,  '[{"body":"August list came in flat — no increases across water, juice, coffee or tea.","date":"2026-07-25","author":"Gerhard Nel"}]'),
  (13, 'Malmesbury Cold Store Services',    'Cold Storage',       'Frikkie van Zyl',      '022 482 6650', 'bookings@malmesburycold.co.za',   'active',    'medium', 3, 78, 80, 77, 80, 'stable',   2, 'One late collection',                 '2026-07-27', 82000,  '[{"body":"Missed the 14:00 collection slot once; frozen pallets held over a day.","date":"2026-06-11","author":"Marius Fourie"},{"body":"R3 100 handling dispute written off — no paperwork either side.","date":"2026-06-26","author":"Ursula Petersen"}]'),
  (14, 'Drakenstein Logistics & Freight',   'Freight',            'Portia Sithole',       '021 862 7730', 'dispatch@drakensteinfreight.co.za','active',   'low',    4, 88, 87, 89, 90, 'stable',   1, '',                                    '2026-07-28', 123000, '[{"body":"Regional runs held at R1 180 — 4.8% under market at the rate review.","date":"2026-07-06","author":"Gerhard Nel"}]')
) as v(n, name, category, contact_name, contact_phone, contact_email, status, risk, rating,
       reliability, quality, delivery_pct, on_time_pct, price_trend, lead_time_days,
       last_issue, last_order, spend_mtd, notes);

-- ---------------------------------------------------------------------------
-- 1.1 Intelligence columns — the scorecards, trends and spend read by
--     supplysync-data.ts:464-523. `market_position` here is only a fallback:
--     aggregatePosition() overrides it from the real pricing rows in §3.
-- ---------------------------------------------------------------------------
update ss_suppliers s set
  overall_score        = v.overall_score,
  price_stability      = v.price_stability,
  delivery_consistency = v.delivery_consistency,
  responsiveness       = v.responsiveness,
  compliance_score     = v.compliance_score,
  avg_monthly_spend    = v.avg_monthly_spend,
  categories           = v.categories,
  market_position      = v.market_position,
  late_deliveries      = v.late_deliveries,
  quality_issues       = v.quality_issues,
  complaints           = v.complaints,
  response_hours       = v.response_hours,
  reliability_trend    = v.reliability_trend::jsonb,
  delivery_trend       = v.delivery_trend::jsonb,
  score_trend          = v.score_trend::jsonb,
  updated_at           = now()
from (values
  (1,  94, 92, 95, 94, 98,  412000, array['Mixed Salad Leaf','Baby Spinach','Tomatoes','Mixed Herbs'],                       'below', 0, 0, 0, 2.5,  '[92,93,93,94,94,94]', '[94,94,95,95,95,95]', '[92,93,93,94,94,94]'),
  (2,  89, 88, 90, 88, 95,  336000, array['Potatoes','Onions','Carrots','Butternut'],                                        'at',    0, 1, 0, 4.0,  '[88,88,89,89,89,89]', '[89,89,90,90,90,90]', '[88,88,89,89,89,89]'),
  (3,  79, 84, 76, 80, 78,  198000, array['Chilled distribution','Blast chilling','Cold-chain monitoring'],                  'at',    3, 1, 1, 7.5,  '[83,82,80,79,78,78]', '[82,80,78,77,76,76]', '[83,82,81,80,79,79]'),
  (4,  71, 58, 74, 72, 62,  588000, array['Chicken Portions','Beef Mince','Lamb Cuts','Line Fish Fillet','Sausage'],         'above', 2, 3, 2, 11.0, '[78,77,75,74,73,72]', '[80,79,77,76,75,74]', '[79,77,75,74,72,71]'),
  (5,  92, 90, 93, 92, 97,  374000, array['Rice','Sugar','Cooking Oil','Maize Meal','Cake Flour'],                           'below', 0, 0, 0, 3.0,  '[90,91,91,92,92,92]', '[92,92,93,93,93,93]', '[90,91,91,92,92,92]'),
  (6,  85, 78, 84, 84, 92,  296000, array['Maize Meal','Cake Flour','Rice','Bread Flour'],                                   'at',    1, 0, 1, 5.5,  '[86,86,85,85,85,85]', '[85,85,84,84,84,84]', '[86,86,85,85,85,85]'),
  (7,  66, 48, 70, 66, 58,  214000, array['Cooking Oil','Frying Medium','Fats & Shortening'],                                'above', 2, 1, 3, 16.0, '[74,73,71,70,69,68]', '[76,75,73,72,71,70]', '[74,72,70,69,67,66]'),
  (8,  80, 66, 82, 80, 84,  342000, array['Cheese Block','Butter Blocks','Fresh Milk','Cream'],                              'above', 1, 2, 1, 6.5,  '[84,84,83,82,81,81]', '[85,84,83,83,82,82]', '[84,83,82,81,80,80]'),
  (9,  91, 91, 92, 90, 96,  156000, array['Punnets & Trays','Cartons','Vacuum Bags','Stretch Wrap'],                         'below', 0, 0, 0, 3.5,  '[90,90,91,91,91,91]', '[91,91,92,92,92,92]', '[90,90,91,91,91,91]'),
  (10, 86, 87, 85, 86, 90,  62000,  array['Cartons','Product Labels','Printed Sleeves'],                                     'at',    0, 0, 0, 5.0,  '[85,85,86,86,86,86]', '[84,85,85,85,85,85]', '[85,85,86,86,86,86]'),
  (11, 77, 62, 78, 70, 86,  118000, array['Seedlings','Compost','Irrigation','Crop Nutrition'],                              'at',    1, 1, 0, 14.0, '[81,80,80,79,79,79]', '[80,79,79,78,78,78]', '[80,79,78,78,77,77]'),
  (12, 84, 85, 83, 84, 88,  94000,  array['Bottled Water','Juice Concentrate','Coffee','Tea'],                               'at',    0, 0, 0, 5.5,  '[83,83,84,84,84,84]', '[82,83,83,83,83,83]', '[83,83,84,84,84,84]'),
  (13, 78, 82, 77, 76, 74,  88000,  array['Frozen Storage','Chilled Storage','Blast Freezing'],                              'at',    1, 1, 1, 8.0,  '[80,79,79,78,78,78]', '[79,78,78,77,77,77]', '[80,79,79,78,78,78]'),
  (14, 88, 86, 89, 88, 92,  132000, array['Regional Delivery','Metro Delivery','Long-haul Freight'],                         'below', 1, 0, 0, 4.0,  '[87,87,88,88,88,88]', '[88,88,89,89,89,89]', '[87,87,88,88,88,88]')
) as v(n, overall_score, price_stability, delivery_consistency, responsiveness, compliance_score,
       avg_monthly_spend, categories, market_position, late_deliveries, quality_issues,
       complaints, response_hours, reliability_trend, delivery_trend, score_trend)
where s.id = ('03000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid
  and s.org_id = '01000000-7e5d-4c1a-9b3f-000000000001';


-- ===========================================================================
-- 2. CONTACTS — 28 rows (group 22, counter = supplier_index*10 + n)
-- ===========================================================================
insert into ss_supplier_contacts (
  id, org_id, supplier_id, name, role, email, phone, preferred_method, is_primary, sort_order
)
select ('22000000-7e5d-4c1a-9b3f-' || lpad((v.s * 10 + v.n)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('03000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.name, v.role, nullif(v.email, ''), nullif(v.phone, ''), v.method, v.is_primary, v.n - 1
from (values
  (1,  1, 'Hendrik Bezuidenhout', 'Sales',         'orders@bergrivergrowers.co.za',    '022 913 4400', 'Call',     true),
  (1,  2, 'Marlene Steenkamp',    'Accounts',      'accounts@bergrivergrowers.co.za',  '022 913 4406', 'Email',    false),
  (1,  3, 'Tebogo Mokoena',       'Dispatch',      '',                                 '082 441 7710', 'WhatsApp', false),
  (2,  1, 'Nolwazi Mabaso',       'Sales',         'sales@klipheuwelfarms.co.za',      '021 972 3310', 'WhatsApp', true),
  (2,  2, 'Andre Lombard',        'Owner/Manager', 'andre@klipheuwelfarms.co.za',      '083 227 4418', 'Call',     false),
  (3,  1, 'Deon Arendse',         'Sales',         'bookings@capecoldchain.co.za',     '021 552 8840', 'Call',     true),
  (3,  2, 'Charmaine Jacobs',     'After-hours',   '',                                 '072 884 2201', 'WhatsApp', false),
  (4,  1, 'Marius Coetzee',       'Sales',         'orders@winelandsprotein.co.za',    '021 887 6620', 'Call',     true),
  (4,  2, 'Rushana Abrahams',     'Accounts',      'accounts@winelandsprotein.co.za',  '021 887 6624', 'Email',    false),
  (4,  3, 'Lwazi Ntuli',          'Dispatch',      '',                                 '084 336 9910', 'WhatsApp', false),
  (5,  1, 'Shireen Kamaldien',    'Sales',         'sales@bolanddrygoods.co.za',       '021 863 4470', 'Email',    true),
  (5,  2, 'Werner Pretorius',     'Accounts',      'accounts@bolanddrygoods.co.za',    '021 863 4475', 'Email',    false),
  (5,  3, 'Basetsana Moloi',      'Dispatch',      '',                                 '082 990 3316', 'WhatsApp', false),
  (6,  1, 'Johan Kritzinger',     'Sales',         'orders@swartlandgrain.co.za',      '022 482 1190', 'Email',    true),
  (6,  2, 'Ilse Grobler',         'Accounts',      'accounts@swartlandgrain.co.za',    '022 482 1194', 'Email',    false),
  (7,  1, 'Andries Malan',        'Sales',         'sales@riebeekoils.co.za',          '022 448 2200', 'Call',     true),
  (7,  2, 'Nadia Solomons',       'Accounts',      'accounts@riebeekoils.co.za',       '022 448 2205', 'Email',    false),
  (8,  1, 'Tania Swanepoel',      'Sales',         'orders@overbergdairy.co.za',       '028 424 7710', 'Call',     true),
  (8,  2, 'Mandla Zulu',          'Dispatch',      '',                                 '083 551 6642', 'WhatsApp', false),
  (9,  1, 'Ridwaan Salie',        'Sales',         'sales@helderbergpack.co.za',       '021 851 3390', 'Email',    true),
  (9,  2, 'Petro van Niekerk',    'Accounts',      'accounts@helderbergpack.co.za',    '021 851 3394', 'Email',    false),
  (10, 1, 'Lauren Meyer',         'Owner/Manager', 'studio@capelabelprint.co.za',      '021 447 9920', 'Email',    true),
  (11, 1, 'Elmarie Roux',         'Sales',         'orders@stellseedling.co.za',       '021 883 5540', 'Email',    true),
  (11, 2, 'Sizwe Khumalo',        'Dispatch',      '',                                 '072 118 4470', 'WhatsApp', false),
  (12, 1, 'Sipho Ndaba',          'Sales',         'sales@peninsulabev.co.za',         '021 510 6680', 'WhatsApp', true),
  (13, 1, 'Frikkie van Zyl',      'Owner/Manager', 'bookings@malmesburycold.co.za',    '022 482 6650', 'Call',     true),
  (14, 1, 'Portia Sithole',       'Sales',         'dispatch@drakensteinfreight.co.za','021 862 7730', 'Call',     true),
  (14, 2, 'Ruan Marais',          'After-hours',   '',                                 '083 447 2290', 'WhatsApp', false)
) as v(s, n, name, role, email, phone, method, is_primary);


-- ===========================================================================
-- 3. COMPLIANCE DOCUMENTS — 38 rows (group 23, counter = supplier_index*10 + n)
-- ---------------------------------------------------------------------------
-- Expiries are current_date-relative (blueprint §0.8 sanctions this for document
-- expiries) so the demo's 2 expired + 2 expiring never go stale.
--   buildDocExpiries (supplysync-insights.ts:182) puts anything inside 45 days
--   on the worklist — every "valid" doc below is ≥ 125 days out, so the worklist
--   is EXACTLY the four rows flagged here.
--   insightgen-data.ts:566 counts expiring|expired|missing → brief.docsExpiring = 4.
-- ===========================================================================
insert into ss_supplier_documents (id, org_id, supplier_id, doc_type, label, status, expiry)
select ('23000000-7e5d-4c1a-9b3f-' || lpad((v.s * 10 + v.n)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('03000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.doc_type, v.label, v.status, current_date + v.days
from (values
  -- The four that need a human ------------------------------------------------
  (4,  1, 'food-safety',       'Food safety audit certificate', 'expired',  -26),
  (7,  1, 'tax-clearance',     'SARS tax clearance',            'expired',  -11),
  (3,  1, 'bee-certificate',   'B-BBEE certificate',            'expiring',   9),
  (8,  1, 'insurance',         'Public liability cover',        'expiring',  21),
  -- Everything else, comfortably valid ---------------------------------------
  (1,  1, 'contract',          'Supply agreement 2026/27',      'valid',    480),
  (1,  2, 'bank-confirmation', 'Bank confirmation letter',      'valid',    540),
  (1,  3, 'price-list',        'Q3 field-produce price list',   'valid',    150),
  (2,  1, 'contract',          'Supply agreement 2026/27',      'valid',    420),
  (2,  2, 'coa',               'Certificate of Analysis',       'valid',    300),
  (2,  3, 'price-list',        'Q3 root-veg price list',        'valid',    140),
  (3,  2, 'contract',          'Chilled distribution agreement','valid',    390),
  (3,  3, 'coa',               'Cold-chain conformance report', 'valid',    260),
  (4,  2, 'contract',          'Protein supply agreement',      'valid',    330),
  (4,  3, 'bank-confirmation', 'Bank confirmation letter',      'valid',    480),
  (5,  1, 'contract',          'Dry-goods supply agreement',    'valid',    500),
  (5,  2, 'price-list',        'Q3 dry-goods price list',       'valid',    160),
  (5,  3, 'bank-confirmation', 'Bank confirmation letter',      'valid',    520),
  (6,  1, 'contract',          'Milling supply agreement',      'valid',    360),
  (6,  2, 'coa',               'Certificate of Analysis',       'valid',    280),
  (6,  3, 'price-list',        'Q3 milling price list',         'valid',    135),
  (7,  2, 'contract',          'Oils & fats supply agreement',  'valid',    240),
  (7,  3, 'price-list',        'July oils price list',          'valid',    125),
  (8,  2, 'contract',          'Dairy supply agreement',        'valid',    410),
  (8,  3, 'coa',               'Certificate of Analysis',       'valid',    290),
  (9,  1, 'contract',          'Packaging supply agreement',    'valid',    460),
  (9,  2, 'bank-confirmation', 'Bank confirmation letter',      'valid',    530),
  (9,  3, 'price-list',        'Q3 packaging price list',       'valid',    170),
  (10, 1, 'contract',          'Print & label agreement',       'valid',    350),
  (10, 2, 'price-list',        'Q3 print price list',           'valid',    145),
  (11, 1, 'contract',          'Field inputs supply agreement', 'valid',    310),
  (11, 2, 'coa',               'Certificate of Analysis',       'valid',    250),
  (12, 1, 'contract',          'Beverage supply agreement',     'valid',    370),
  (12, 2, 'price-list',        'August beverage price list',    'valid',    155),
  (13, 1, 'contract',          'Cold storage service agreement','valid',    400),
  (13, 2, 'insurance',         'Storage insurance certificate', 'valid',    320),
  (14, 1, 'contract',          'Transport service agreement',   'valid',    440),
  (14, 2, 'insurance',         'Goods-in-transit cover',        'valid',    345),
  (14, 3, 'bank-confirmation', 'Bank confirmation letter',      'valid',    510)
) as v(s, n, doc_type, label, status, days);


-- ===========================================================================
-- 4. PRICING HISTORY — 58 rows (group 24, counter = supplier_index*100 + n)
-- ---------------------------------------------------------------------------
-- Two things read this table and they must BOTH land:
--
--  a) insightgen-data.ts:777-792 raises `supplier-price:<row id>` when
--     current_price is >= 5% above previous_price (critical at >= 10%). Exactly
--     SIX rows here clear 5% — 401/402 (Winelands), 701/702 (Riebeek),
--     801/802 (Overberg). Every other row moves < 3.6%, so nothing else fires.
--  b) supplysync-pricing.ts buildCrossSupplierItems() lines up equivalent items
--     across suppliers by itemKey() (brackets and pack sizes stripped). The
--     deliberate overlaps are: cooking oil (5 vs 7), rice / maize meal / cake
--     flour (5 vs 6) and cartons (9 vs 10) — so the comparison table is never
--     empty even before any Doc-U invoice is scanned.
--
-- market_avg also drives deriveOpportunities() (supplysync-data.ts:592):
-- >= 4% under market on a >= 80-scored supplier = buy_now (rows 101, 501, 901,
-- 902, 1401, 1402); >= 8% over market = review/negotiate (rows 701, 702).
-- ===========================================================================
insert into ss_supplier_pricing (
  id, org_id, supplier_id, item, category, unit,
  current_price, previous_price, market_avg, last_updated, trend, sort_order
)
select ('24000000-7e5d-4c1a-9b3f-' || lpad((v.s * 100 + v.n)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('03000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.item, v.category, v.unit,
       v.current_price, v.previous_price, v.market_avg,
       v.last_updated::date, v.trend::jsonb, v.n - 1
from (values
  -- 1 Bergriver Growers ------------------------------------------------------
  (1,  1, 'Mixed salad leaf (5kg crate)',   'Field Produce',     'crate',  148.00,  146.50,  155.50, '2026-07-24', '[144.0,145.0,145.8,146.2,146.5,148.0]'),
  (1,  2, 'Baby spinach (4kg crate)',       'Field Produce',     'crate',  132.00,  130.00,  137.00, '2026-07-24', '[127.5,128.4,129.0,129.6,130.0,132.0]'),
  (1,  3, 'Tomatoes',                       'Field Produce',     'kg',      23.50,   23.10,   24.40, '2026-07-22', '[22.4,22.6,22.8,23.0,23.1,23.5]'),
  (1,  4, 'Mixed herbs (bunch)',            'Field Produce',     'bunch',   11.50,   11.40,   11.90, '2026-07-20', '[11.1,11.2,11.3,11.35,11.4,11.5]'),
  -- 2 Klipheuwel Farms -------------------------------------------------------
  (2,  1, 'Potatoes (10kg bag)',            'Field Produce',     'bag',    108.00,  106.50,  110.00, '2026-07-23', '[103.0,104.2,105.0,105.8,106.5,108.0]'),
  (2,  2, 'Onions (10kg bag)',              'Field Produce',     'bag',     92.00,   91.00,   94.50, '2026-07-23', '[88.5,89.4,90.0,90.6,91.0,92.0]'),
  (2,  3, 'Carrots (10kg bag)',             'Field Produce',     'bag',     86.00,   85.00,   88.00, '2026-07-21', '[82.5,83.4,84.0,84.6,85.0,86.0]'),
  (2,  4, 'Butternut',                      'Field Produce',     'kg',      14.80,   14.60,   15.40, '2026-07-21', '[14.1,14.25,14.4,14.5,14.6,14.8]'),
  -- 3 Cape Cold Chain Supply -------------------------------------------------
  (3,  1, 'Chilled transfer run',           'Chilled Logistics', 'trip',  1480.00, 1450.00, 1520.00, '2026-07-18', '[1408.0,1420.0,1432.0,1442.0,1450.0,1480.0]'),
  (3,  2, 'Blast chill service',            'Chilled Logistics', 'pallet',  386.00,  380.00,  392.00, '2026-07-18', '[368.0,372.0,375.0,378.0,380.0,386.0]'),
  (3,  3, 'Cold-chain monitoring',          'Chilled Logistics', 'month',  2450.00, 2400.00, 2500.00, '2026-07-14', '[2320.0,2345.0,2370.0,2388.0,2400.0,2450.0]'),
  (3,  4, 'Reefer standby hour',            'Chilled Logistics', 'hour',    264.00,  258.00,  258.00, '2026-07-14', '[248.0,251.0,254.0,256.0,258.0,264.0]'),
  -- 4 Winelands Protein Co.  (401 critical, 402 warning) ---------------------
  (4,  1, 'Line fish fillet',               'Proteins',          'kg',      168.00,  152.00,  162.00, '2026-07-15', '[144.0,146.0,148.0,150.0,152.0,168.0]'),
  (4,  2, 'Chicken portions (10kg box)',    'Proteins',          'box',     620.00,  578.00,  606.00, '2026-07-15', '[548.0,556.0,564.0,571.0,578.0,620.0]'),
  (4,  3, 'Beef mince',                     'Proteins',          'kg',      118.00,  114.00,  116.00, '2026-07-12', '[108.0,110.0,111.5,113.0,114.0,118.0]'),
  (4,  4, 'Lamb cuts',                      'Proteins',          'kg',      195.00,  189.00,  192.00, '2026-07-12', '[180.0,183.0,185.0,187.0,189.0,195.0]'),
  (4,  5, 'Sausage / boerewors',            'Proteins',          'kg',       96.00,   94.00,   97.50, '2026-07-10', '[90.0,91.5,92.5,93.5,94.0,96.0]'),
  -- 5 Boland Dry Goods -------------------------------------------------------
  (5,  1, 'Rice (10kg bag)',                'Dry Goods',         'bag',     148.00,  146.00,  155.00, '2026-07-25', '[141.0,142.8,144.0,145.2,146.0,148.0]'),
  (5,  2, 'Sugar (12.5kg bag)',             'Dry Goods',         'bag',     168.00,  166.00,  174.00, '2026-07-25', '[160.0,162.0,164.0,165.2,166.0,168.0]'),
  (5,  3, 'Cooking oil (5L)',               'Dry Goods',         'case',    596.00,  590.00,  618.00, '2026-07-25', '[572.0,578.0,583.0,587.0,590.0,596.0]'),
  (5,  4, 'Maize meal (12.5kg bag)',        'Dry Goods',         'bag',     118.00,  117.00,  121.00, '2026-07-19', '[113.0,114.5,115.5,116.5,117.0,118.0]'),
  (5,  5, 'Cake flour (12.5kg bag)',        'Dry Goods',         'bag',     132.00,  131.00,  135.00, '2026-07-19', '[126.0,128.0,129.5,130.5,131.0,132.0]'),
  -- 6 Swartland Grain & Mill -------------------------------------------------
  (6,  1, 'Maize meal (12.5kg bag)',        'Dry Goods',         'bag',     121.00,  118.00,  121.00, '2026-07-17', '[112.0,114.0,115.5,117.0,118.0,121.0]'),
  (6,  2, 'Cake flour (12.5kg bag)',        'Dry Goods',         'bag',     134.00,  131.00,  135.00, '2026-07-17', '[125.0,127.0,129.0,130.0,131.0,134.0]'),
  (6,  3, 'Rice (10kg bag)',                'Dry Goods',         'bag',     152.00,  149.00,  155.00, '2026-07-16', '[143.0,145.0,146.5,148.0,149.0,152.0]'),
  (6,  4, 'Bread flour (12.5kg bag)',       'Dry Goods',         'bag',     142.00,  139.00,  144.00, '2026-07-16', '[133.0,135.0,136.5,138.0,139.0,142.0]'),
  -- 7 Riebeek Oils & Fats  (701, 702 both critical) --------------------------
  (7,  1, 'Cooking oil (5L)',               'Dry Goods',         'case',    640.00,  566.00,  592.00, '2026-07-09', '[548.0,552.0,558.0,560.0,566.0,640.0]'),
  (7,  2, 'Frying medium (20L)',            'Dry Goods',         'drum',   1302.00, 1180.00, 1190.00, '2026-07-09', '[1128.0,1142.0,1158.0,1170.0,1180.0,1302.0]'),
  (7,  3, 'Sunflower oil (2L)',             'Dry Goods',         'case',    268.00,  262.00,  262.00, '2026-07-11', '[252.0,255.0,258.0,260.0,262.0,268.0]'),
  (7,  4, 'Fat / shortening (10kg)',        'Dry Goods',         'box',     396.00,  388.00,  386.00, '2026-07-11', '[374.0,378.0,382.0,385.0,388.0,396.0]'),
  -- 8 Overberg Dairy Supply  (801 critical, 802 warning) ---------------------
  (8,  1, 'Cheese block',                   'Dairy & Chilled',   'kg',      138.00,  125.00,  132.00, '2026-07-08', '[118.0,120.0,121.0,123.0,125.0,138.0]'),
  (8,  2, 'Butter blocks (10x500g case)',   'Dairy & Chilled',   'case',    445.00,  419.00,  432.00, '2026-07-08', '[404.0,408.0,412.0,416.0,419.0,445.0]'),
  (8,  3, 'Fresh milk (12x1L case)',        'Dairy & Chilled',   'case',    168.00,  164.00,  170.00, '2026-07-23', '[157.0,159.0,161.0,163.0,164.0,168.0]'),
  (8,  4, 'Cream (6x1L case)',              'Dairy & Chilled',   'case',    296.00,  290.00,  300.00, '2026-07-23', '[279.0,283.0,286.0,288.0,290.0,296.0]'),
  -- 9 Helderberg Packaging ---------------------------------------------------
  (9,  1, 'Punnets & trays (sleeve)',       'Packaging',         'sleeve',  168.00,  166.00,  176.00, '2026-07-13', '[160.0,162.0,164.0,165.0,166.0,168.0]'),
  (9,  2, 'Cartons - standard (bundle)',    'Packaging',         'bundle',  118.00,  117.00,  123.00, '2026-07-13', '[113.0,114.5,115.5,116.5,117.0,118.0]'),
  (9,  3, 'Vacuum bags (box)',              'Packaging',         'box',     284.00,  281.00,  292.00, '2026-07-13', '[272.0,275.0,278.0,280.0,281.0,284.0]'),
  (9,  4, 'Stretch wrap (roll)',            'Packaging',         'roll',     96.00,   95.00,   98.00, '2026-07-13', '[92.0,93.0,94.0,94.5,95.0,96.0]'),
  -- 10 Cape Label & Print ----------------------------------------------------
  (10, 1, 'Cartons - standard (bundle)',    'Packaging',         'bundle',  124.00,  122.00,  123.00, '2026-07-16', '[117.0,119.0,120.5,121.5,122.0,124.0]'),
  (10, 2, 'Product labels (roll)',          'Packaging',         'roll',    218.00,  215.00,  222.00, '2026-07-16', '[208.0,211.0,213.0,214.0,215.0,218.0]'),
  (10, 3, 'Date-code ribbon',               'Packaging',         'each',    148.00,  146.00,  150.00, '2026-07-16', '[141.0,143.0,144.5,145.5,146.0,148.0]'),
  (10, 4, 'Printed sleeves (bundle)',       'Packaging',         'bundle',  196.00,  194.00,  199.00, '2026-07-16', '[187.0,190.0,192.0,193.0,194.0,196.0]'),
  -- 11 Stellenbosch Seedling & Input Co. (volatile, all under the 5% trigger) -
  (11, 1, 'Seedling trays',                 'Field Inputs',      'tray',     92.00,   89.00,   91.00, '2026-07-12', '[84.0,86.0,87.5,88.5,89.0,92.0]'),
  (11, 2, 'Compost (bulk)',                 'Field Inputs',      'm3',      486.00,  470.00,  478.00, '2026-07-12', '[448.0,456.0,462.0,467.0,470.0,486.0]'),
  (11, 3, 'Irrigation fittings (pack)',     'Field Inputs',      'pack',    268.00,  262.00,  266.00, '2026-07-10', '[250.0,254.0,258.0,260.0,262.0,268.0]'),
  (11, 4, 'Crop nutrition (25kg)',          'Field Inputs',      'bag',     742.00,  718.00,  730.00, '2026-07-10', '[688.0,698.0,708.0,714.0,718.0,742.0]'),
  -- 12 Peninsula Beverage Supply --------------------------------------------
  (12, 1, 'Bottled water (12x750ml)',       'Beverages',         'case',     96.00,   95.00,   99.00, '2026-07-25', '[92.0,93.0,94.0,94.5,95.0,96.0]'),
  (12, 2, 'Juice concentrate (5L)',         'Beverages',         'box',     268.00,  264.00,  274.00, '2026-07-25', '[256.0,259.0,261.0,263.0,264.0,268.0]'),
  (12, 3, 'Coffee beans (1kg)',             'Beverages',         'bag',     318.00,  314.00,  324.00, '2026-07-25', '[304.0,308.0,311.0,313.0,314.0,318.0]'),
  (12, 4, 'Tea (500 bags)',                 'Beverages',         'box',     186.00,  184.00,  189.00, '2026-07-25', '[178.0,180.0,182.0,183.0,184.0,186.0]'),
  -- 13 Malmesbury Cold Store Services ---------------------------------------
  (13, 1, 'Frozen pallet storage',          'Cold Storage',      'pallet',  268.00,  262.00,  272.00, '2026-07-20', '[250.0,254.0,258.0,260.0,262.0,268.0]'),
  (13, 2, 'Chilled pallet storage',         'Cold Storage',      'pallet',  214.00,  210.00,  218.00, '2026-07-20', '[200.0,204.0,207.0,209.0,210.0,214.0]'),
  (13, 3, 'Blast freeze cycle',             'Cold Storage',      'cycle',   486.00,  476.00,  492.00, '2026-07-20', '[456.0,463.0,469.0,473.0,476.0,486.0]'),
  (13, 4, 'Handling in / out',              'Cold Storage',      'pallet',   78.00,   76.00,   79.00, '2026-07-20', '[72.0,73.5,74.5,75.5,76.0,78.0]'),
  -- 14 Drakenstein Logistics & Freight --------------------------------------
  (14, 1, 'Regional delivery run',          'Freight',           'trip',   1180.00, 1165.00, 1240.00, '2026-07-27', '[1128.0,1142.0,1152.0,1160.0,1165.0,1180.0]'),
  (14, 2, 'Metro delivery run',             'Freight',           'trip',    620.00,  612.00,  648.00, '2026-07-27', '[592.0,600.0,606.0,610.0,612.0,620.0]'),
  (14, 3, 'Long-haul freight',              'Freight',           'trip',   3480.00, 3420.00, 3560.00, '2026-07-27', '[3280.0,3330.0,3372.0,3400.0,3420.0,3480.0]'),
  (14, 4, 'Pallet line-haul',               'Freight',           'pallet',  246.00,  242.00,  252.00, '2026-07-27', '[232.0,236.0,239.0,241.0,242.0,246.0]')
) as v(s, n, item, category, unit, current_price, previous_price, market_avg, last_updated, trend);


-- ===========================================================================
-- 5. RISK REGISTER — 8 rows (group 25)
-- ---------------------------------------------------------------------------
-- insightgen-data.ts:833 raises `supplier-risk:<id>` for open/in_progress rows
-- at high or critical severity (first 5). Exactly THREE qualify: risks 1, 2, 3.
-- Open + in-progress rows total six, which is what the Daily Ops Brief counts.
-- ===========================================================================
insert into ss_supplier_risks (
  id, org_id, supplier_id, risk_type, severity, description, suggested_action,
  owner, status, due_date
)
select ('25000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('03000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.risk_type, v.severity, v.description, v.suggested_action,
       v.owner, v.status,
       case when v.due_days is null then null else current_date + v.due_days end
from (values
  (1, 4,  'Expiring Document',  'critical', 'Food safety audit certificate lapsed 26 days ago on the single largest line of spend (R588k/month).', 'Hold new protein orders until the renewed certificate is on file.', 'Ursula Petersen', 'open',        5),
  (2, 7,  'Price Volatility',   'high',     'Cooking oil moved 13.1% and frying medium 10.3% inside one month, well ahead of the market.',        'Quote both lines from Boland Dry Goods and split the volume.',      'Gerhard Nel',     'open',        7),
  (3, 7,  'Compliance Issue',   'high',     'SARS tax clearance expired 11 days ago; supplier moved to review.',                                  'Request a renewed tax clearance before releasing any order.',       'Ursula Petersen', 'in_progress', 3),
  (4, 3,  'Late Delivery',      'medium',   'Two chilled transfer runs arrived outside the agreed window this month.',                            'Confirm the fixed 06:00 slot and review the standby unit.',         'Marius Fourie',   'open',        11),
  (5, 8,  'Quality Issue',      'medium',   'Cheese block grade dipped on two consecutive loads; a substitution credit is open.',                  'Inspect and grade the next cheese delivery on arrival.',             'Chris Adams',     'in_progress', 9),
  (6, 11, 'Low Responsiveness', 'low',      'Average response time of 14 hours against 2.5-4 hours from the preferred suppliers.',                 'Confirm the best contact channel and trading hours.',                'Imraan Davids',   'open',        18),
  (7, 2,  'No Recent Update',   'low',      'No price list had been received for two cycles; resolved when the Q3 list landed.',                   'Closed - Q3 root-veg list received and loaded.',                     'Gerhard Nel',     'resolved',    null),
  (8, 13, 'Missing Document',   'medium',   'Storage insurance certificate was not on file; received and filed on 26 June.',                       'Closed - certificate filed against the supplier profile.',           'Ursula Petersen', 'resolved',    null)
) as v(n, s, risk_type, severity, description, suggested_action, owner, status, due_days);


-- ===========================================================================
-- 6. RELATIONSHIP TIMELINE — 36 rows (group 26)
-- ---------------------------------------------------------------------------
-- measureEvents() (supplysync-insights.ts:83) only counts events inside a
-- 90-day window, so every row is dated between 2026-05-01 and 2026-07-28.
-- The channel labels matter as much as the event types: "Delivery Issue" and
-- "Complaint" are counted even when the event_type is generic.
-- ===========================================================================
insert into ss_supplier_history (
  id, org_id, supplier_id, event_type, channel, summary, contact_name,
  follow_up, follow_up_date, follow_up_done, owner, event_date
)
select ('26000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('03000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.event_type, nullif(v.channel, ''), v.summary, nullif(v.contact_name, ''),
       nullif(v.follow_up, ''), nullif(v.follow_up_date, '')::date, v.follow_up_done,
       v.owner, v.event_date::date
from (values
  (1,  1,  'price_update',        'Price Update',     'Held field-produce pricing for July - salad leaf at R148 a crate.',                      'Hendrik Bezuidenhout', '',                                                '',           false, 'Fatima Isaacs',   '2026-07-14'),
  (2,  1,  'call',                'Call',             'Confirmed weekly salad-leaf and spinach volumes into August.',                            'Hendrik Bezuidenhout', '',                                                '',           false, 'Chris Adams',     '2026-07-24'),
  (3,  2,  'whatsapp',            'WhatsApp',         'Confirmed the Tuesday and Friday root-veg drops.',                                        'Nolwazi Mabaso',       '',                                                '',           false, 'Chris Adams',     '2026-07-21'),
  (4,  2,  'order_linked',        '',                 'ProcurePulse order linked - 2.1t of potatoes and onions.',                                '',                     '',                                                '',           false, 'Gerhard Nel',     '2026-07-27'),
  (5,  2,  'note_added',          '',                 'Short-ship claim of R14 300 acknowledged; credit note promised for month end.',            'Nolwazi Mabaso',       'Chase the credit note',                           '2026-08-07', false, 'Ursula Petersen', '2026-07-06'),
  (6,  3,  'delivery_issue',      'Delivery Issue',   'Chilled transfer run arrived three hours late; two pallets out of spec on arrival.',       'Deon Arendse',         'Review the route and the standby unit',           '2026-08-05', false, 'Marius Fourie',   '2026-07-17'),
  (7,  3,  'document_request',    'Document Request', 'Requested the renewed B-BBEE certificate before it lapses.',                              'Deon Arendse',         'Chase the B-BBEE certificate',                    '2026-08-04', false, 'Ursula Petersen', '2026-07-20'),
  (8,  3,  'call',                'Call',             'Agreed a fixed 06:00 window for the chilled run.',                                        'Deon Arendse',         '',                                                '',           false, 'Marius Fourie',   '2026-07-26'),
  (9,  4,  'compliance_issue',    '',                 'Food-safety audit certificate lapsed - protein intake on hold pending renewal.',           '',                     'Hold new protein orders until the certificate lands', '2026-08-03', false, 'Ursula Petersen', '2026-07-05'),
  (10, 4,  'complaint',           'Complaint',        'Line fish grade slipped on two loads and the price moved 10.5% in the same week.',         'Marius Coetzee',       'Inspect the next fish delivery on arrival',       '2026-08-06', false, 'Chris Adams',     '2026-07-15'),
  (11, 4,  'price_update',        'Price Update',     'Notified of a 10.5% line-fish and 7.3% chicken increase from 1 July.',                     'Marius Coetzee',       '',                                                '',           false, 'Gerhard Nel',     '2026-07-02'),
  (12, 4,  'meeting',             'Meeting',          'Annual review - the R56 000 volume rebate was claimed and settled in full.',               'Marius Coetzee',       '',                                                '',           true,  'Fatima Isaacs',   '2026-06-24'),
  (13, 5,  'price_list_received', 'Price Update',     'Received the Q3 dry-goods list - rice and sugar 3-5% below market.',                       'Shireen Kamaldien',    'Shift dry-goods volume to Boland this quarter',   '2026-08-10', false, 'Gerhard Nel',     '2026-07-13'),
  (14, 5,  'marked_preferred',    '',                 'Marked preferred for dry goods on price and compliance.',                                 '',                     '',                                                '',           false, 'Fatima Isaacs',   '2026-06-30'),
  (15, 6,  'price_update',        'Price Update',     'Milling costs up around 2.5% on maize meal and cake flour.',                              'Johan Kritzinger',     '',                                                '',           false, 'Gerhard Nel',     '2026-07-11'),
  (16, 6,  'email',               'Email',            'Growth rebate reconciliation sent - R8 500 received of R32 500 expected.',                 'Johan Kritzinger',     'Reconcile the rebate balance at period end',      '2026-08-14', false, 'Ursula Petersen', '2026-07-10'),
  (17, 7,  'price_update',        'Price Update',     'Cooking oil jumped to R640 a case and frying medium to R1 302 a drum.',                    'Andries Malan',        'Quote the same lines from Boland Dry Goods',      '2026-08-04', false, 'Gerhard Nel',     '2026-07-08'),
  (18, 7,  'complaint',           'Complaint',        'Raised the 13% oil increase as unsupported by the market move.',                           'Andries Malan',        'Escalate to the account manager if it holds',     '2026-08-08', false, 'Riaan Botha',     '2026-07-12'),
  (19, 7,  'document_request',    'Document Request', 'Requested a renewed SARS tax clearance - the one on file has lapsed.',                     'Andries Malan',        'Hold new orders until the tax clearance lands',   '2026-08-02', false, 'Ursula Petersen', '2026-07-18'),
  (20, 7,  'compliance_issue',    '',                 'Compliance gap opened: tax clearance expired and the supplier moved to review.',           '',                     '',                                                '',           false, 'Ursula Petersen', '2026-07-19'),
  (21, 8,  'complaint',           'Complaint',        'Cheese block grade dipped on two loads; a substitution credit of R4 780 was raised.',       'Tania Swanepoel',      'Inspect the next cheese delivery',                '2026-08-05', false, 'Chris Adams',     '2026-06-22'),
  (22, 8,  'price_update',        'Price Update',     'Cheese up 10.4% and butter up 6.2% on the July list.',                                     'Tania Swanepoel',      '',                                                '',           false, 'Gerhard Nel',     '2026-07-07'),
  (23, 8,  'call',                'Call',             'Agreed to hold milk and cream pricing through August.',                                   'Tania Swanepoel',      '',                                                '',           false, 'Gerhard Nel',     '2026-07-23'),
  (24, 9,  'marked_preferred',    '',                 'Marked preferred for packaging - 4-5% below market with nothing logged against them.',     '',                     '',                                                '',           false, 'Fatima Isaacs',   '2026-06-18'),
  (25, 9,  'price_list_received', 'Price Update',     'Q3 packaging list received; punnets and cartons both held.',                               'Ridwaan Salie',        '',                                                '',           false, 'Gerhard Nel',     '2026-07-09'),
  (26, 10, 'email',               'Email',            'Artwork approved for the new prepared-lines label run.',                                   'Lauren Meyer',         '',                                                '',           true,  'Yolanda Fortuin', '2026-07-16'),
  (27, 10, 'order_linked',        '',                 'ProcurePulse order linked - 40 bundles of printed sleeves.',                               '',                     '',                                                '',           false, 'Yolanda Fortuin', '2026-07-16'),
  (28, 11, 'call',                'Call',             'Chased the spring seedling schedule - two days to get a reply.',                          'Elmarie Roux',         'Confirm the best contact channel and hours',      '2026-08-12', false, 'Imraan Davids',   '2026-07-03'),
  (29, 11, 'note_added',          '',                 'Damaged-tray claim of R1 780 written off - no proof of condition on arrival.',             '',                     '',                                                '',           false, 'Ursula Petersen', '2026-06-04'),
  (30, 12, 'whatsapp',            'WhatsApp',         'Confirmed the weekly beverage drop for the counter sites.',                                'Sipho Ndaba',          '',                                                '',           false, 'Zanele Dlamini',  '2026-07-22'),
  (31, 12, 'price_list_received', 'Price Update',     'August beverage list received - no increases.',                                            'Sipho Ndaba',          '',                                                '',           false, 'Gerhard Nel',     '2026-07-25'),
  (32, 13, 'delivery_issue',      'Delivery Issue',   'Collection missed the 14:00 slot; frozen pallets held over to the next day.',              'Frikkie van Zyl',      '',                                                '',           true,  'Marius Fourie',   '2026-06-11'),
  (33, 13, 'document_uploaded',   'Document Request', 'Received the outstanding storage insurance certificate.',                                  'Frikkie van Zyl',      '',                                                '',           true,  'Ursula Petersen', '2026-06-26'),
  (34, 14, 'late_delivery',       'Delivery Issue',   'One regional run landed 90 minutes late into the Thursday window.',                        'Portia Sithole',       '',                                                '',           true,  'Marius Fourie',   '2026-06-16'),
  (35, 14, 'call',                'Call',             'Confirmed August routing and the extra Saturday metro run.',                               'Portia Sithole',       '',                                                '',           false, 'Marius Fourie',   '2026-07-27'),
  (36, 14, 'meeting',             'Meeting',          'Rate review - regional runs held at R1 180, 4.8% below market.',                           'Portia Sithole',       '',                                                '',           false, 'Gerhard Nel',     '2026-07-06')
) as v(n, s, event_type, channel, summary, contact_name, follow_up, follow_up_date, follow_up_done, owner, event_date);


-- ===========================================================================
-- 7. SUPPLIER NAME ALIASES — 9 rows (group 44)
-- ---------------------------------------------------------------------------
-- supabase/supplysync-link.sql: durable, human-confirmed rulings between the
-- messy names Doc-U extracts off a document and the CANONICAL core supplier
-- (group 04). These are what make a scanned "RIEBEEK OILS & FATS (PTY) LTD"
-- invoice land on the Riebeek SupplySync profile without a second review.
-- One `dismissed` ruling so the negative case is demonstrable.
-- unique (org_id, normalized_name) — every normalized_name below is distinct.
-- ===========================================================================
insert into supplier_aliases (id, org_id, raw_name, normalized_name, supplier_id, status)
select ('44000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.raw_name, v.normalized_name,
       ('04000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.status
from (values
  (1, 1,  'BERGRIVER GROWERS (PTY) LTD',       'bergriver growers pty ltd',       'confirmed'),
  (2, 4,  'WINELANDS PROTEIN CO (PTY) LTD',    'winelands protein co pty ltd',    'confirmed'),
  (3, 4,  'Winelands Protein',                 'winelands protein',               'confirmed'),
  (4, 5,  'BOLAND DRY GOODS CC',               'boland dry goods cc',             'confirmed'),
  (5, 6,  'SWARTLAND GRAIN AND MILL',          'swartland grain and mill',        'confirmed'),
  (6, 7,  'RIEBEEK OILS & FATS (PTY) LTD',     'riebeek oils fats pty ltd',       'confirmed'),
  (7, 8,  'OVERBERG DAIRY SUPPLY (PTY) LTD',   'overberg dairy supply pty ltd',   'confirmed'),
  (8, 9,  'HELDERBERG PACKAGING SOLUTIONS',    'helderberg packaging solutions',  'confirmed'),
  (9, 14, 'DRAKENSTEIN LOGISTICS',             'drakenstein logistics',           'dismissed')
) as v(n, s, raw_name, normalized_name, status);


-- ===========================================================================
-- 8. CREDIT & DISPUTE REGISTER — 12 claims (group 27, blueprint §4.3)
-- ---------------------------------------------------------------------------
-- UNRESOLVED_CREDIT_STATUSES = claimed | acknowledged (supplysync-credits.ts:63).
-- SIX are unresolved (4 claimed + 2 acknowledged) totalling R48 380 — the figure
-- rolled up on the SupplySync Overview. Claim ages are current_date-relative so
-- "38 days old" stays true whenever the demo is loaded.
--
--   claimed total    R84 540
--   unresolved       R48 380 across 6 claims, oldest 38 days
--   credited         R29 140  (claim 9 settled short: R7 200 of R9 340)
--   written off      R4 880
--   recovery rate    86%  (29 140 / 34 020 settled)
-- ===========================================================================
insert into ss_supplier_credits (
  id, org_id, supplier_id, supplier_name, issue_type, reference, item, description,
  amount, amount_credited, status, claimed_on, acknowledged_on, resolved_on, owner, note
)
select ('27000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('03000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.supplier_name, v.issue_type, v.reference, v.item, v.description,
       v.amount, v.amount_credited, v.status,
       current_date - v.claimed_days,
       case when v.ack_days is null then null else current_date - v.ack_days end,
       case when v.res_days is null then null else current_date - v.res_days end,
       v.owner, nullif(v.note, '')
from (values
  (1,  1,  'Bergriver Growers',                 'short_ship',    'INV-BRG-88410', 'Mixed salad leaf (5kg crate)',  '14 crates short against the delivery note; the driver signed the discrepancy.',         5240.00,  null,     'claimed',      4,  null, null, 'Gerhard Nel',     'Photographed at goods-in.'),
  (2,  4,  'Winelands Protein Co.',             'quality',       'INV-WPC-20117', 'Line fish fillet',              'Two boxes off-spec on arrival, rejected at goods-in and photographed.',                 11680.00, null,     'claimed',      9,  null, null, 'Chris Adams',     ''),
  (3,  7,  'Riebeek Oils & Fats',               'price_error',   'INV-ROF-40882', 'Cooking oil (5L)',              'Invoiced at R640 a case against the R566 confirmed on the order.',                      8420.00,  null,     'claimed',      16, null, null, 'Ursula Petersen', 'Order confirmation attached to the claim.'),
  (4,  3,  'Cape Cold Chain Supply',            'damaged',       'DN-CCC-11290',  'Chilled transfer run',          'Temperature excursion on the late run; two pallets condemned on arrival.',              3960.00,  null,     'claimed',      27, null, null, 'Marius Fourie',   ''),
  (5,  2,  'Klipheuwel Farms',                  'short_ship',    'DN-KHF-6612',   'Potatoes (10kg bag)',           '130 bags short on the Thursday load; the back-order never arrived.',                    14300.00, null,     'acknowledged', 23, 15,   null, 'Gerhard Nel',     'Credit note promised for month end.'),
  (6,  8,  'Overberg Dairy Supply',             'substitution',  'INV-ODS-33108', 'Cheese block',                  'Substituted grade without approval on two loads; sold at a lower price.',               4780.00,  null,     'acknowledged', 38, 29,   null, 'Chris Adams',     'Agreed in principle on the call.'),
  (7,  5,  'Boland Dry Goods',                  'price_error',   'INV-BDG-71204', 'Sugar (12.5kg bag)',            'Old list price applied to the July order; corrected and credited in full.',             6150.00,  6150.00,  'credited',     46, 40,   33,   'Ursula Petersen', ''),
  (8,  1,  'Bergriver Growers',                 'quality',       'INV-BRG-87990', 'Baby spinach (4kg crate)',      'Cold-chain break on the morning run; three crates unsellable.',                         2890.00,  2890.00,  'credited',     52, 47,   41,   'Chris Adams',     ''),
  (9,  6,  'Swartland Grain & Mill',            'short_ship',    'DN-SGM-4471',   'Maize meal (12.5kg bag)',       'Half a pallet short; supplier credited the count they could evidence, not ours.',       9340.00,  7200.00,  'credited',     58, 51,   44,   'Ursula Petersen', 'Settled R2 140 short of the claim.'),
  (10, 4,  'Winelands Protein Co.',             'not_delivered', 'PO-WPC-19844',  'Chicken portions (10kg box)',   'Order confirmed then never dispatched; covered at short notice from stock.',            12900.00, 12900.00, 'credited',     64, 57,   49,   'Gerhard Nel',     ''),
  (11, 11, 'Stellenbosch Seedling & Input Co.', 'damaged',       'DN-SSI-2208',   'Seedling trays',                'Trays crushed in transit; no condition photo taken at goods-in so the claim failed.',   1780.00,  0.00,     'written_off',  71, 63,   55,   'Imraan Davids',   'Written off - no evidence on arrival.'),
  (12, 13, 'Malmesbury Cold Store Services',    'other',         'INV-MCS-9013',  'Handling in / out',             'Disputed handling charge on the held-over pallets; neither side kept the paperwork.',    3100.00,  0.00,     'written_off',  83, 74,   61,   'Ursula Petersen', 'Written off - no paperwork either side.')
) as v(n, s, supplier_name, issue_type, reference, item, description, amount, amount_credited,
       status, claimed_days, ack_days, res_days, owner, note);


-- ===========================================================================
-- 9. REBATE AGREEMENTS — 4 (group 28) + 5 receipts (group 29)
-- ---------------------------------------------------------------------------
-- mapRebateRow (supplysync-credits.ts:275) RE-DERIVES the status from the
-- receipts and the calendar, so the stored `status` is only a starting point:
--   #1 Boland      expected 48 000, received 21 000 → outstanding 27 000, open  → claimed
--   #2 Swartland   expected 32 500, received  8 500 → outstanding 24 000, open  → claimed
--   #3 Winelands   expected 56 000, received 56 000 → outstanding      0        → received
--   #4 Bergriver   expected 36 000, received      0 → outstanding 36 000, CLOSED→ missed (overdue)
-- Two clean expected-vs-received gaps (#1, #2) plus one fully-received and one
-- missed agreement, so all three demonstrable states are on screen.
-- Windows are current_date-relative so "closed" and "accruing" stay true.
-- ===========================================================================
insert into ss_supplier_rebates (
  id, org_id, supplier_id, supplier_name, name, basis, rate_pct, flat_amount,
  threshold_spend, period, period_start, period_end, expected_amount, status, note
)
select ('28000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('03000000-7e5d-4c1a-9b3f-' || lpad(v.s::text, 12, '0'))::uuid,
       v.supplier_name, v.name, v.basis, v.rate_pct, v.flat_amount,
       v.threshold_spend, v.period,
       current_date + v.start_days, current_date + v.end_days,
       v.expected_amount, v.status, v.note
from (values
  (1, 5, 'Boland Dry Goods',      'Winter dry-goods volume rebate', 'percent', 2.4,  null,     1800000, 'quarterly', -52,  38,  48000.00, 'accruing', 'Paid as a credit note in the month after quarter end.'),
  (2, 6, 'Swartland Grain & Mill','Milling growth rebate',          'percent', 1.9,  null,     1100000, 'quarterly', -52,  38,  32500.00, 'accruing', 'Only the first tranche has landed - reconcile at period end.'),
  (3, 4, 'Winelands Protein Co.', 'Protein annual volume rebate',   'flat',    null, 56000.00, null,    'annual',    -190, -24, 56000.00, 'claimed',  'Claimed at the annual close and settled in two payments.'),
  (4, 1, 'Bergriver Growers',     'Season-close grower rebate',     'percent', 1.5,  null,     2400000, 'quarterly', -148, -58, 36000.00, 'agreed',   'Period closed with nothing received - chase the grower.')
) as v(n, s, supplier_name, name, basis, rate_pct, flat_amount, threshold_spend, period,
       start_days, end_days, expected_amount, status, note);

insert into ss_supplier_rebate_receipts (
  id, org_id, rebate_id, amount, received_on, method, reference, note
)
select ('29000000-7e5d-4c1a-9b3f-' || lpad((v.r * 10 + v.n)::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('28000000-7e5d-4c1a-9b3f-' || lpad(v.r::text, 12, '0'))::uuid,
       v.amount, current_date - v.days_ago, v.method, v.reference, v.note
from (values
  (1, 1, 15000.00, 24, 'credit_note',      'CN-BDG-3318',  'First tranche against the quarter.'),
  (1, 2,  6000.00,  9, 'invoice_discount', 'BDG-DISC-1140','Applied against the July statement.'),
  (2, 1,  8500.00, 19, 'credit_note',      'CN-SGM-2074',  'First tranche only - R24 000 still outstanding.'),
  (3, 1, 30000.00, 40, 'eft',              'EFT-WPC-66210','Part payment on the annual close.'),
  (3, 2, 26000.00, 12, 'eft',              'EFT-WPC-66744','Balance settled - agreement fully received.')
) as v(r, n, amount, days_ago, method, reference, note);


-- ===========================================================================
-- 10. INSIGHTGEN — stored insights (group 36), 12 rows
-- ---------------------------------------------------------------------------
-- These are the SEEDED feed (insightgen-data.ts:924 `mapInsights`). The brain
-- also DERIVES a feed from the live rows in the same request and shows derived
-- first, so these read as the standing narrative rather than duplicating it.
-- Every figure below is one the other fragments actually produce.
-- ===========================================================================
insert into ig_insights (
  id, org_id, source_module, severity, text, metric_label, metric_value, is_anomaly, created_at
)
select ('36000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.source_module, v.severity, v.text, v.metric_label, v.metric_value, v.is_anomaly,
       now() - (v.age_hours || ' hours')::interval
from (values
  (1,  'supplysync',   'critical', 'Riebeek Oils & Fats raised cooking oil 13.1% and frying medium 10.3% inside one month — R74 a case on the largest dry-goods line. Boland Dry Goods quotes the same 5L case at R596.', 'Cooking oil',        '+13.1%',    true,  4),
  (2,  'procurepulse', 'critical', 'Line Fish Fillet is out of stock and three more lines sit at or below their low threshold: Baby Spinach, Bread Rolls and Fresh Milk.',                                                'Below threshold',    '4 lines',   true,  7),
  (3,  'wastewatch',   'warning',  'Waste cost is up 39.7% week-on-week, concentrated in Dairy & Chilled and Prepared Lines after two chiller failures on 24 and 26 July.',                                               'Weekly waste',       '+39.7%',    true,  9),
  (4,  'pricepilot',   'warning',  'Five product lines are selling below the 41% target margin — the four protein lines and Fresh Milk — worth roughly R63,000 a month at current volumes.',                              'Below-target lines', '5 products',false, 13),
  (5,  'supplysync',   'warning',  'Winelands Protein Co.''s food-safety audit certificate expired 26 days ago on R588,000 a month of spend, and Riebeek''s tax clearance lapsed 11 days ago.',                           'Expired documents',  '2 suppliers',false, 16),
  (6,  'supplysync',   'warning',  'R48,380 of supplier credits is still unresolved across six claims, the oldest 38 days old. Winelands Protein Co. holds R11,680 of it.',                                               'Unresolved credits', 'R48,380',   false, 20),
  (7,  'planwise',     'warning',  'COGS is tracking at 61.8% of revenue against a 60.5% plan — a 1.3 point gap, most of it the July protein and oil increases flowing through unrepriced.',                              'COGS vs plan',       '+1.3 pts',  false, 26),
  (8,  'shiftboard',   'warning',  'Five staff are already over their contracted hours this week with three more inside the two-hour overtime margin. Production and Dispatch carry all five.',                           'Overtime risk',      '5 people',  false, 30),
  (9,  'orderflow',    'positive', 'July is pacing to R5.51M against the R5.5M plan with two trading days left — trade and events are both ahead, counter is flat.',                                                      'Revenue pace',       'R5.51M',    false, 5),
  (10, 'supplysync',   'positive', 'R87,000 of agreed supplier rebates is still outstanding, R36,000 of it on a Bergriver period that has already closed — recoverable if it is claimed this week.',                      'Rebate outstanding', 'R87,000',   false, 34),
  (11, 'supplysync',   'positive', 'Bergriver Growers, Boland Dry Goods and Helderberg Packaging are all 4–5% under market on their main lines while scoring 91 or better.',                                              'Below market',       '3 suppliers',false, 40),
  (12, 'orderflow',    'info',     'Trade and wholesale is 58% of realised revenue across the last four months, events 20%, counter 13% and farm-gate 9% — the mix has barely moved since April.',                        'Trade share',        '58%',       false, 48)
) as v(n, source_module, severity, text, metric_label, metric_value, is_anomaly, age_hours);


-- ===========================================================================
-- 11. INSIGHTGEN — saved reports (group 37), 5 rows
-- ---------------------------------------------------------------------------
-- `modules` must contain the dataset module keys the brain builds
-- (insightgen-data.ts:864-905: orderflow, wastewatch, shiftboard, procurepulse,
-- supplysync) or ["all"] — Reports.tsx:105 filters the datasets by exactly this
-- array, so a key that isn't a dataset module would run and export nothing.
-- `last_run` is a fallback: mapReports() prefers the newest ig_report_runs row.
-- ===========================================================================
insert into ig_reports (
  id, org_id, name, scope, modules, schedule, status, owner, last_run
)
select ('37000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.name, v.scope, v.modules::jsonb, v.schedule, v.status, v.owner,
       case when v.age_days is null then null else now() - (v.age_days || ' days')::interval end
from (values
  (1, 'Weekly trading pack',         'Company',     '["all"]',                             'weekly',  'ready',     'Ursula Petersen', 2),
  (2, 'Supplier spend & compliance', 'Procurement', '["supplysync","procurepulse"]',       'monthly', 'scheduled', 'Gerhard Nel',     5),
  (3, 'Waste & preventable loss',    'Operations',  '["wastewatch"]',                      'weekly',  'ready',     'Nomsa Khumalo',   3),
  (4, 'Margin by product line',      'Finance',     '["orderflow","procurepulse"]',        'monthly', 'ready',     'Ursula Petersen', 11),
  (5, 'Labour vs sales',             'Operations',  '["shiftboard","orderflow"]',          'daily',   'draft',     'Fatima Isaacs',   null)
) as v(n, name, scope, modules, schedule, status, owner, age_days);


-- ===========================================================================
-- 12. INSIGHTGEN — recorded report runs (group 38), 6 rows
-- ---------------------------------------------------------------------------
-- Quota: >= 2. Six runs across four reports (report 1 x3, reports 2/3/4 x1),
-- all inside the last 21 days. `datasets` holds dataset KEYS, exactly what
-- Reports.tsx:121 writes (`parts.map(p => p.ds.key)`); `output` is 'csv' for a
-- download and 'view' for a run consumed on screen — the two values the schema
-- documents. row_count is the rows that run actually exported.
-- ===========================================================================
insert into ig_report_runs (
  id, org_id, report_id, datasets, row_count, output, run_by, run_at
)
select ('38000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       ('37000000-7e5d-4c1a-9b3f-' || lpad(v.r::text, 12, '0'))::uuid,
       v.datasets::jsonb, v.row_count, v.output, v.run_by,
       now() - (v.age_days || ' days')::interval
from (values
  (1, 1, '["sales","waste","labour","stock","suppliers"]', 2380, 'csv',  'Ursula Petersen', 2),
  (2, 1, '["sales","waste","labour","stock","suppliers"]', 2210, 'csv',  'Ursula Petersen', 9),
  (3, 1, '["sales","waste","labour","stock","suppliers"]', 2064, 'csv',  'Fatima Isaacs',   16),
  (4, 2, '["suppliers","stock"]',                           486, 'csv',  'Gerhard Nel',     5),
  (5, 3, '["waste"]',                                       336, 'csv',  'Nomsa Khumalo',   3),
  (6, 4, '["sales","stock"]',                              1840, 'view', 'Ursula Petersen', 11)
) as v(n, r, datasets, row_count, output, run_by, age_days);


-- ===========================================================================
-- 13. INSIGHTGEN — acknowledged anomalies (group 39), 2 rows
-- ---------------------------------------------------------------------------
-- Anomalies are DERIVED at read time, so an ack keys off the anomaly's stable
-- rule key (insightgen-data.ts:760-844). Both keys below are ones this seed
-- actually generates:
--   'waste-spike'                       — ww_waste_events, +39.7% wk/wk (§9.3)
--   'supplier-price:24000000-…-000701'  — the Riebeek cooking-oil pricing row
--                                          seeded in §4 above (+13.1%).
-- Acknowledging them drops them out of the derived insight feed (line 850) and
-- sorts them to the bottom of the anomaly list, leaving the OTHER 9 live:
-- food-cost-variance, 5 more supplier-price, 4 stock-low, 3 supplier-risk.
-- unique (org_id, anomaly_key) — the delete preamble above makes this re-runnable.
-- ===========================================================================
insert into ig_anomaly_acks (id, org_id, anomaly_key, state, note, acked_by, created_at)
select ('39000000-7e5d-4c1a-9b3f-' || lpad(v.n::text, 12, '0'))::uuid,
       '01000000-7e5d-4c1a-9b3f-000000000001'::uuid,
       v.anomaly_key, v.state, v.note, v.acked_by,
       now() - (v.age_hours || ' hours')::interval
from (values
  (1, 'waste-spike',                                          'acknowledged', 'Investigated: two chiller failures on 24 and 26 July.',                                 'Ursula Petersen', 18),
  (2, 'supplier-price:24000000-7e5d-4c1a-9b3f-000000000701',  'acknowledged', 'Known — Riebeek increase raised with the account manager; Boland quoted as the alternative.', 'Gerhard Nel',     30)
) as v(n, anomaly_key, state, note, acked_by, age_hours);

-- ===========================================================================
-- END DOMAIN (f)
-- ===========================================================================


-- ##########################################################################
-- ##  SECTION 2F
-- ##  ShiftBoard — departments, employees, roster, attendance, leave,
-- ##  shift swaps  (apply order 12)
-- ##########################################################################

-- ===========================================================================
-- ShiftBoard — Meridian Food Co. (people, roster, attendance, leave, swaps)
-- ---------------------------------------------------------------------------
-- Domain (d) fragment of supabase/demo-all-in-one.sql. Seeds sb_departments,
-- sb_employees, sb_roster_shifts, sb_attendance, sb_leave_requests and
-- sb_shift_swaps for org 01000000-7e5d-4c1a-9b3f-000000000001 only. Contains
-- NO schema DDL — the assembler inlines 1-shiftboard-schema.sql and
-- 1-shiftboard-swaps.sql ahead of this file — and writes to no other module's
-- tables. All money in ZAR.
--
-- HOW TO APPLY: this fragment is concatenated into supabase/demo-all-in-one.sql;
-- that file is what you paste into the Supabase dashboard SQL editor. Running
-- this fragment on its own is safe too, provided the two schema files above
-- have already been applied.
--
-- WHAT THE MODULE READS (lib/platform/shiftboard-data.ts:129-263)
--   sb_departments        -> DepartmentInfo{name, required, color}; the coverage tiles
--   sb_employees          -> Employee; skills jsonb keyed by the SEVEN SKILL_NAMES
--                            exactly (shiftboard.ts:18), read positionally
--   sb_roster_shifts      -> one row per employee; `days` is SEVEN cells
--                            {time, department, status, conflict?}; `label` and
--                            `open_shifts` are week-level facts stored on every
--                            row (the reader unions open_shifts and de-dupes by id)
--   sb_attendance         -> today's clock record; InsightGen also multiplies
--                            hours_worked x sb_employees.rate for labour-cost-today
--   sb_leave_requests     -> ordered by start_date, so start_date must be set
--   sb_shift_swaps        -> newest first; four live statuses are seeded
--   getWeekSales()        -> of_orders(invoiced|paid) inside Mon 27 Jul - Sun 2 Aug
--                            2026, owned by writer (a). Nothing here writes it.
--
-- WHY THE NUMBERS ARE WHAT THEY ARE (blueprint sections 6, 6.1, 6.2, 6.3, 10)
--   45 people over 8 departments. Contracted hours: 45h x 31 + 40h x 8 + 25h x 6
--   = 1 865 h/week. Sum(headcount x department mean rate) = 3 658, / 45 = R81.3/h,
--   which is the rate the PlanWise labour line is built on.
--
--   Rostered hours are 1 825.5 h/week (leave and two released call-out cells sit
--   under the 1 865 h contract base) costing R149 123/week -> R646 150/month
--   against the R680 000 PlanWise 'Labour - rostered wages' plan line: a genuine
--   favourable variance, not a rounding artefact.
--
--   Exactly FIVE employees have hours_this_week > contracted_hours, so
--   overviewStats().overtimeRisk (shiftboard.ts:664) reports 5 (quota is >= 3).
--   Three more sit at 43.5-44.5h, inside OT_NEAR_MARGIN of the 45h ceiling, so the
--   shift editor warns before the breach rather than after it.
--
--   Today is Wed 29 Jul 2026. Attendance is 38 rows and
--   sum(hours_worked x rate) = R26 100.00 exactly - about 12% of a trading day's
--   sales, comfortably under LABOUR_WARN_PCT (30) so InsightGen's labour anomaly
--   stays quiet while the number is still real. The Wednesday column of the
--   roster costs R26 337, so the plan and the clock agree to within 1%.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Delete preamble — scoped to the Meridian org UUID and nothing else. Children
-- before parents, so the sb_employees FKs (on delete cascade / set null) never
-- get a chance to fire. Re-runnable is a hard requirement.
-- ---------------------------------------------------------------------------
delete from sb_shift_swaps where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from sb_attendance where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from sb_leave_requests where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from sb_roster_shifts where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from sb_employees where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from sb_departments where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

-- ===========================================================================
-- 1. Departments (8). `required` is the target headcount on shift RIGHT NOW,
--    not the payroll headcount — coverageStatus() compares it against the
--    people whose current_department matches and who are Working/On break.
--    Names stay segment-neutral: they read the same for a producer, a
--    wholesaler, a caterer or a counter operation.
-- ===========================================================================
insert into sb_departments (id, org_id, name, required, color) values
  ('07000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', 'Production', 8, '#0C447C'),
  ('07000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', 'Field', 6, '#0F6E56'),
  ('07000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', 'Dispatch', 5, '#854F0B'),
  ('07000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', 'Events', 5, '#5B4FD6'),
  ('07000000-7e5d-4c1a-9b3f-000000000005', '01000000-7e5d-4c1a-9b3f-000000000001', 'Counter', 4, '#C0345A'),
  ('07000000-7e5d-4c1a-9b3f-000000000006', '01000000-7e5d-4c1a-9b3f-000000000001', 'Cold Store', 3, '#0E7490'),
  ('07000000-7e5d-4c1a-9b3f-000000000007', '01000000-7e5d-4c1a-9b3f-000000000001', 'Admin', 3, '#6B6F68'),
  ('07000000-7e5d-4c1a-9b3f-000000000008', '01000000-7e5d-4c1a-9b3f-000000000001', 'Maintenance', 2, '#A3560F')
on conflict (id) do update set
  name = excluded.name, required = excluded.required, color = excluded.color;

-- ===========================================================================
-- 2. Employees (45). `skills` is keyed by the seven SKILL_NAMES verbatim —
--    skillsArray() (shiftboard-data.ts:64) maps them positionally, so a typo in
--    a key silently reads as a 0 rating and the cover shortlist stops working.
--
--    Live-ops columns (current_department / current_task / current_recipe /
--    assigned_device) are populated only for people who are Working or On break:
--    presentInDepartment() keys the coverage tiles off current_department, and
--    liveDeviceAssignments() is the WasteWatch device->user->recipe bridge.
--    assigned_device values match the eight ww_devices names in blueprint 9.5 and
--    current_recipe the pp_recipes names in blueprint 7, byte-for-byte.
--
--    Rate bands per department (ZAR/hour) and their means:
--      Production 62-112 (78) | Field 50-74 (59) | Dispatch 62-96 (75)
--      Events 70-152 (95)     | Counter 55-88 (68) | Cold Store 60-92 (74)
--      Admin 115-190 (150)    | Maintenance 78-135 (100)
--    Weighted mean R81.3/h — the figure PlanWise's labour lines are built on.
--
--    hours_this_week equals that person's rostered hours in section 3 below, so
--    the overtime tile and the roster costing can never disagree. The five
--    over-contract people are Chris Adams (51.5), Qiniso Mabaso (49.5),
--    Karabo Sithole (48.0), Xolani Mahlangu (47.0) and Gugu Mthembu (46.5).
-- ===========================================================================
insert into sb_employees (
  id, org_id, name, role, department, status, next_shift, shift_time,
  hours_this_week, contracted_hours, rate, attendance_score, leave_balance,
  skills, available_days, unavailable_days, preferred_shifts, devices,
  current_department, current_task, current_recipe, assigned_device
) values
  ('06000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', 'Anele Mtshali', 'Production manager', 'Production', 'Working',
   'Tomorrow 06:00', '06–15', 45, 45, 112, 97, 12,
   '{"Receiving": 2, "Dispatch": 2, "Prep Kitchen": 5, "Driving": 1, "Customer Service": 1, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Production', 'Production planning & yields', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', 'Bianca de Waal', 'Production supervisor', 'Production', 'Working',
   'Tomorrow 07:00', '07–16', 45, 45, 96, 95, 10,
   '{"Receiving": 2, "Dispatch": 2, "Prep Kitchen": 5, "Driving": 0, "Customer Service": 1, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Production', 'Prep line supervision', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', 'Chris Adams', 'Prep lead', 'Production', 'Working',
   'Tomorrow 06:00', '06–15', 51.5, 45, 88, 92, 6,
   '{"Receiving": 2, "Dispatch": 2, "Prep Kitchen": 5, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '["Bench Scale — Production 1"]'::jsonb,
   'Production', 'Prep line — salad', 'Prepared Salad Mix', 'Bench Scale — Production 1'),
  ('06000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', 'Dineo Molefe', 'Field supervisor', 'Field', 'Working',
   'Tomorrow 06:00', '06–15', 45, 45, 74, 94, 9,
   '{"Receiving": 4, "Dispatch": 2, "Prep Kitchen": 1, "Driving": 2, "Customer Service": 1, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '["Bluetooth Scale — Field Pack"]'::jsonb,
   'Field', 'Goods-in check — field intake', null, 'Bluetooth Scale — Field Pack'),
  ('06000000-7e5d-4c1a-9b3f-000000000005', '01000000-7e5d-4c1a-9b3f-000000000001', 'Eben Louw', 'Dispatch manager', 'Dispatch', 'Working',
   'Tomorrow 06:30', '06:30–15:30', 45, 45, 96, 96, 11,
   '{"Receiving": 3, "Dispatch": 5, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 3, "Stock Handling": 4, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '["Barcode Station — Dispatch"]'::jsonb,
   'Dispatch', 'Load planning & dispatch control', null, 'Barcode Station — Dispatch'),
  ('06000000-7e5d-4c1a-9b3f-000000000006', '01000000-7e5d-4c1a-9b3f-000000000001', 'Fatima Isaacs', 'Line operator', 'Production', 'Working',
   'Tomorrow 06:00', '06–15', 44.5, 45, 78, 90, 8,
   '{"Receiving": 1, "Dispatch": 2, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Production', 'Prep line — vegetable', 'Prepared Veg Mix', null),
  ('06000000-7e5d-4c1a-9b3f-000000000007', '01000000-7e5d-4c1a-9b3f-000000000001', 'Gerhard Nel', 'Field team lead', 'Field', 'Working',
   'Tomorrow 06:00', '06–15', 45, 45, 66, 91, 7,
   '{"Receiving": 4, "Dispatch": 2, "Prep Kitchen": 0, "Driving": 2, "Customer Service": 1, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Field', 'Field pack & grading', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000008', '01000000-7e5d-4c1a-9b3f-000000000001', 'Hlengiwe Dube', 'Events lead', 'Events', 'Working',
   'Tomorrow 08:00', '08–16', 40, 40, 152, 98, 14,
   '{"Receiving": 1, "Dispatch": 1, "Prep Kitchen": 4, "Driving": 1, "Customer Service": 5, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '["Bluetooth Scale — Events"]'::jsonb,
   'Events', 'Event build — platters', 'Event Platter Base', 'Bluetooth Scale — Events'),
  ('06000000-7e5d-4c1a-9b3f-000000000009', '01000000-7e5d-4c1a-9b3f-000000000001', 'Imraan Davids', 'Line operator', 'Production', 'Off',
   'Tomorrow 06:00', '06–15', 45, 45, 74, 88, 5,
   '{"Receiving": 1, "Dispatch": 2, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000010', '01000000-7e5d-4c1a-9b3f-000000000001', 'Jaco Barnard', 'Dispatch coordinator', 'Dispatch', 'Working',
   'Tomorrow 07:00', '07–16', 45, 45, 84, 93, 8,
   '{"Receiving": 3, "Dispatch": 5, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 3, "Stock Handling": 4, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Dispatch', 'Route sequencing', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000011', '01000000-7e5d-4c1a-9b3f-000000000001', 'Karabo Sithole', 'Batch operator', 'Production', 'Working',
   'Tomorrow 06:00', '06–15', 48, 45, 72, 89, 4,
   '{"Receiving": 1, "Dispatch": 2, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '["Bench Scale — Production 2"]'::jsonb,
   'Production', 'Batch cook — ready meals', 'Ready Meal — Chicken & Rice', 'Bench Scale — Production 2'),
  ('06000000-7e5d-4c1a-9b3f-000000000012', '01000000-7e5d-4c1a-9b3f-000000000001', 'Lindiwe Ndlovu', 'Field operator', 'Field', 'Working',
   'Tomorrow 06:00', '06–15', 45, 45, 62, 82, 6,
   '{"Receiving": 4, "Dispatch": 2, "Prep Kitchen": 0, "Driving": 2, "Customer Service": 0, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Field', 'Field pack — crates', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000013', '01000000-7e5d-4c1a-9b3f-000000000001', 'Marius Fourie', 'Counter supervisor', 'Counter', 'Working',
   'Tomorrow 07:30', '07:30–15:30', 40, 40, 88, 94, 10,
   '{"Receiving": 1, "Dispatch": 1, "Prep Kitchen": 2, "Driving": 0, "Customer Service": 5, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '["Kitchen Scale — Counter"]'::jsonb,
   'Counter', 'Counter service & till', null, 'Kitchen Scale — Counter'),
  ('06000000-7e5d-4c1a-9b3f-000000000014', '01000000-7e5d-4c1a-9b3f-000000000001', 'Nomsa Khumalo', 'Line operator', 'Production', 'Working',
   'Tomorrow 06:00', '06–15', 45, 45, 68, 91, 7,
   '{"Receiving": 1, "Dispatch": 2, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Production', 'Prep line — soup batch', 'Soup — Butternut', null),
  ('06000000-7e5d-4c1a-9b3f-000000000015', '01000000-7e5d-4c1a-9b3f-000000000001', 'Ockert Steyn', 'Events supervisor', 'Events', 'Working',
   'Tomorrow 08:00', '08–16', 40, 40, 110, 95, 11,
   '{"Receiving": 0, "Dispatch": 1, "Prep Kitchen": 4, "Driving": 1, "Customer Service": 5, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Events', 'Event build — grazing', 'Grazing Board Prep', null),
  ('06000000-7e5d-4c1a-9b3f-000000000016', '01000000-7e5d-4c1a-9b3f-000000000001', 'Pieter van Wyk', 'Cold store lead', 'Cold Store', 'Working',
   'Fri 06:30', '06:30–15:30', 45, 45, 92, 96, 9,
   '{"Receiving": 4, "Dispatch": 3, "Prep Kitchen": 0, "Driving": 1, "Customer Service": 1, "Stock Handling": 5, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '["Floor Scale — Cold Store"]'::jsonb,
   'Cold Store', 'Cold room rotation & weigh-in', null, 'Floor Scale — Cold Store'),
  ('06000000-7e5d-4c1a-9b3f-000000000017', '01000000-7e5d-4c1a-9b3f-000000000001', 'Qiniso Mabaso', 'Load planner', 'Dispatch', 'Working',
   'Tomorrow 07:00', '07–16', 49.5, 45, 76, 87, 3,
   '{"Receiving": 3, "Dispatch": 5, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 3, "Stock Handling": 4, "Device Operation": 1}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Dispatch', 'Outbound load planning', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000018', '01000000-7e5d-4c1a-9b3f-000000000001', 'Riaan Botha', 'Field operator', 'Field', 'Working',
   'Tomorrow 06:00', '06–15', 45, 45, 58, 90, 8,
   '{"Receiving": 3, "Dispatch": 1, "Prep Kitchen": 0, "Driving": 2, "Customer Service": 0, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Field', 'Field intake — crate wash', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000019', '01000000-7e5d-4c1a-9b3f-000000000001', 'Sibongile Ncube', 'Counter assistant', 'Counter', 'Working',
   'Tomorrow 08:00', '08–16', 40, 40, 72, 93, 9,
   '{"Receiving": 1, "Dispatch": 1, "Prep Kitchen": 2, "Driving": 0, "Customer Service": 5, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Counter', 'Counter service', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000020', '01000000-7e5d-4c1a-9b3f-000000000001', 'Thabo Maseko', 'Line operator', 'Production', 'On break',
   'Tomorrow 07:00', '07–16', 45, 45, 66, 86, 6,
   '{"Receiving": 1, "Dispatch": 2, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Production', 'Prep line — trays', 'Roast Vegetable Tray', null),
  ('06000000-7e5d-4c1a-9b3f-000000000021', '01000000-7e5d-4c1a-9b3f-000000000001', 'Ursula Petersen', 'Events assistant', 'Events', 'Working',
   'Tomorrow 10:00', '10–16', 25, 25, 88, 92, 5,
   '{"Receiving": 0, "Dispatch": 0, "Prep Kitchen": 4, "Driving": 1, "Customer Service": 5, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Mon", "Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Events', 'Event prep — cold section', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000022', '01000000-7e5d-4c1a-9b3f-000000000001', 'Vusi Zwane', 'Order picker', 'Dispatch', 'On break',
   'Tomorrow 07:00', '07–16', 44, 45, 68, 81, 4,
   '{"Receiving": 2, "Dispatch": 4, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 3, "Stock Handling": 4, "Device Operation": 1}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Dispatch', 'Order picking', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000023', '01000000-7e5d-4c1a-9b3f-000000000001', 'Wanda Jacobs', 'Counter assistant', 'Counter', 'Working',
   'Tomorrow 08:00', '08–16', 40, 40, 64, 90, 7,
   '{"Receiving": 0, "Dispatch": 1, "Prep Kitchen": 2, "Driving": 0, "Customer Service": 5, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Production', 'Prep line cover — trays', 'Prepared Veg Mix', null),
  ('06000000-7e5d-4c1a-9b3f-000000000024', '01000000-7e5d-4c1a-9b3f-000000000001', 'Xolani Mahlangu', 'Field operator', 'Field', 'Working',
   'Tomorrow 06:00', '06–15', 47, 45, 56, 88, 5,
   '{"Receiving": 3, "Dispatch": 1, "Prep Kitchen": 0, "Driving": 2, "Customer Service": 0, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Field', 'Field pack — bagging', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000025', '01000000-7e5d-4c1a-9b3f-000000000001', 'Yolanda Fortuin', 'Stock controller', 'Cold Store', 'Working',
   'Tomorrow 06:30', '06:30–15:30', 45, 45, 78, 94, 10,
   '{"Receiving": 4, "Dispatch": 3, "Prep Kitchen": 0, "Driving": 1, "Customer Service": 1, "Stock Handling": 5, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Cold Store', 'Stock count & rotation', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000026', '01000000-7e5d-4c1a-9b3f-000000000001', 'Zanele Dlamini', 'Line operator', 'Production', 'Working',
   'Tomorrow 06:00', '06–15', 45, 45, 64, 89, 6,
   '{"Receiving": 1, "Dispatch": 2, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Production', 'Prep line — bakery', 'Bread Rolls', null),
  ('06000000-7e5d-4c1a-9b3f-000000000027', '01000000-7e5d-4c1a-9b3f-000000000001', 'Adri Bezuidenhout', 'Events assistant', 'Events', 'Working',
   'Tomorrow 11:00', '11–16', 25, 25, 78, 91, 4,
   '{"Receiving": 0, "Dispatch": 0, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 4, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Mon", "Tue", "Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Events', 'Event prep — fruit', 'Fruit Cup Prep', null),
  ('06000000-7e5d-4c1a-9b3f-000000000028', '01000000-7e5d-4c1a-9b3f-000000000001', 'Bongani Mkhize', 'Field operator', 'Field', 'On break',
   'Tomorrow 06:00', '06–15', 45, 45, 54, 79, 3,
   '{"Receiving": 3, "Dispatch": 1, "Prep Kitchen": 0, "Driving": 2, "Customer Service": 0, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Field', 'Field pack — grading', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000029', '01000000-7e5d-4c1a-9b3f-000000000001', 'Charmaine Adonis', 'Operations director', 'Admin', 'Working',
   'Tomorrow 08:00', '08–16', 40, 40, 190, 99, 16,
   '{"Receiving": 2, "Dispatch": 2, "Prep Kitchen": 0, "Driving": 1, "Customer Service": 4, "Stock Handling": 1, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Admin', 'Operations review & approvals', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000030', '01000000-7e5d-4c1a-9b3f-000000000001', 'Dumisani Nkosi', 'Order picker', 'Dispatch', 'Absent',
   'Tomorrow 07:00', '07–16', 36, 45, 64, 74, 2,
   '{"Receiving": 2, "Dispatch": 4, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 3, "Stock Handling": 4, "Device Operation": 1}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000031', '01000000-7e5d-4c1a-9b3f-000000000001', 'Elmarie Coetzee', 'Counter assistant', 'Counter', 'On break',
   'Tomorrow 11:00', '11–16', 25, 25, 61, 83, 4,
   '{"Receiving": 0, "Dispatch": 0, "Prep Kitchen": 2, "Driving": 0, "Customer Service": 4, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Sat"]'::jsonb, '["Fri", "Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Counter', 'Counter restock', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000032', '01000000-7e5d-4c1a-9b3f-000000000001', 'Faheem Salie', 'Events assistant', 'Events', 'On break',
   'Tomorrow 12:00', '12–17', 25, 25, 72, 85, 3,
   '{"Receiving": 0, "Dispatch": 0, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 4, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Tue", "Sun"]'::jsonb, 'Late', '[]'::jsonb,
   'Events', 'Event prep — hot section', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000033', '01000000-7e5d-4c1a-9b3f-000000000001', 'Gugu Mthembu', 'Cold store operator', 'Cold Store', 'Working',
   'Tomorrow 06:30', '06:30–15:30', 46.5, 45, 66, 90, 6,
   '{"Receiving": 4, "Dispatch": 3, "Prep Kitchen": 0, "Driving": 0, "Customer Service": 1, "Stock Handling": 5, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   'Cold Store', 'Cold room putaway', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000034', '01000000-7e5d-4c1a-9b3f-000000000001', 'Hendrik Pretorius', 'Field operator', 'Field', 'Off',
   'Tomorrow 06:00', '06–15', 45, 45, 52, 87, 7,
   '{"Receiving": 3, "Dispatch": 1, "Prep Kitchen": 0, "Driving": 2, "Customer Service": 0, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000035', '01000000-7e5d-4c1a-9b3f-000000000001', 'Ilse van Niekerk', 'Finance & admin manager', 'Admin', 'Working',
   'Tomorrow 08:00', '08–16', 40, 40, 145, 97, 13,
   '{"Receiving": 2, "Dispatch": 2, "Prep Kitchen": 0, "Driving": 1, "Customer Service": 4, "Stock Handling": 1, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Admin', 'Invoice capture & supplier credits', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000036', '01000000-7e5d-4c1a-9b3f-000000000001', 'Jabulani Radebe', 'Counter assistant', 'Counter', 'On leave',
   'Fri 11:00', '11–16', 10, 25, 55, 88, 1,
   '{"Receiving": 0, "Dispatch": 0, "Prep Kitchen": 2, "Driving": 0, "Customer Service": 4, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Fri", "Sat"]'::jsonb, '["Tue", "Wed", "Thu", "Sun"]'::jsonb, 'Late', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000037', '01000000-7e5d-4c1a-9b3f-000000000001', 'Kobus Marais', 'Maintenance manager', 'Maintenance', 'Working',
   'Tomorrow 07:00', '07–16', 45, 45, 135, 95, 12,
   '{"Receiving": 2, "Dispatch": 1, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 1, "Stock Handling": 2, "Device Operation": 5}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Maintenance', 'Planned maintenance — chiller 3', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000038', '01000000-7e5d-4c1a-9b3f-000000000001', 'Lerato Mokoena', 'Line operator', 'Production', 'On leave',
   'Tomorrow 06:00', '06–14', 24, 45, 62, 91, 2,
   '{"Receiving": 1, "Dispatch": 2, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 0, "Stock Handling": 3, "Device Operation": 4}'::jsonb,
   '["Thu", "Fri", "Sat"]'::jsonb, '["Mon", "Tue", "Wed", "Sun"]'::jsonb, 'Early', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000039', '01000000-7e5d-4c1a-9b3f-000000000001', 'Mandla Sibeko', 'Cold store operator', 'Cold Store', 'Off',
   'Tomorrow 06:30', '06:30–15:30', 45, 45, 60, 86, 8,
   '{"Receiving": 4, "Dispatch": 3, "Prep Kitchen": 0, "Driving": 0, "Customer Service": 0, "Stock Handling": 4, "Device Operation": 4}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000040', '01000000-7e5d-4c1a-9b3f-000000000001', 'Nadia Abrahams', 'Field operator', 'Field', 'Scheduled',
   'Tomorrow 06:00', '06–15', 43.5, 45, 50, 89, 9,
   '{"Receiving": 3, "Dispatch": 1, "Prep Kitchen": 0, "Driving": 2, "Customer Service": 0, "Stock Handling": 4, "Device Operation": 3}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Early', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000041', '01000000-7e5d-4c1a-9b3f-000000000001', 'Oscar Plaatjies', 'Maintenance technician', 'Maintenance', 'Working',
   'Fri 07:00', '07–16', 36, 45, 87, 78, 5,
   '{"Receiving": 2, "Dispatch": 1, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 1, "Stock Handling": 2, "Device Operation": 5}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Maintenance', 'Reactive maintenance — dispatch door', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000042', '01000000-7e5d-4c1a-9b3f-000000000001', 'Phumla Gwala', 'Order picker', 'Dispatch', 'Off',
   'Tomorrow 07:00', '07–16', 45, 45, 62, 92, 8,
   '{"Receiving": 2, "Dispatch": 4, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 3, "Stock Handling": 4, "Device Operation": 1}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000043', '01000000-7e5d-4c1a-9b3f-000000000001', 'Quinton Meyer', 'Admin coordinator', 'Admin', 'Working',
   'Tomorrow 08:00', '08–16', 40, 40, 115, 93, 11,
   '{"Receiving": 2, "Dispatch": 2, "Prep Kitchen": 0, "Driving": 0, "Customer Service": 4, "Stock Handling": 1, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   'Admin', 'Late order capture & statements', null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000044', '01000000-7e5d-4c1a-9b3f-000000000001', 'Refilwe Tau', 'Events assistant', 'Events', 'Off',
   'Tomorrow 10:00', '10–16', 25, 25, 70, 90, 4,
   '{"Receiving": 0, "Dispatch": 0, "Prep Kitchen": 4, "Driving": 0, "Customer Service": 4, "Stock Handling": 2, "Device Operation": 2}'::jsonb,
   '["Mon", "Tue", "Thu", "Fri", "Sat"]'::jsonb, '["Wed", "Sun"]'::jsonb, 'Days', '[]'::jsonb,
   null, null, null, null),
  ('06000000-7e5d-4c1a-9b3f-000000000045', '01000000-7e5d-4c1a-9b3f-000000000001', 'Sizwe Ngcobo', 'Maintenance assistant', 'Maintenance', 'Absent',
   'Tomorrow 07:00', '07–16', 45, 45, 78, 76, 3,
   '{"Receiving": 2, "Dispatch": 0, "Prep Kitchen": 0, "Driving": 3, "Customer Service": 1, "Stock Handling": 2, "Device Operation": 5}'::jsonb,
   '["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]'::jsonb, '["Sun"]'::jsonb, 'Days', '[]'::jsonb,
   null, null, null, null)
on conflict (id) do update set
  name = excluded.name, role = excluded.role, department = excluded.department,
  status = excluded.status, hours_this_week = excluded.hours_this_week,
  contracted_hours = excluded.contracted_hours, rate = excluded.rate,
  skills = excluded.skills;

-- ===========================================================================
-- 3. Roster — Mon 27 Jul to Sun 2 Aug 2026, one row per employee, `days` a
--    seven-cell jsonb array {time, department, status, conflict?}. Statuses are
--    scheduled | open | off | leave; conflicts are the ShiftConflict union
--    (shiftboard.ts:113).
--
--    `label` and `open_shifts` are week-level facts denormalised onto every row.
--    The reader takes the first NON-EMPTY label and unions open_shifts across
--    all rows, de-duplicating on id — so every row carries the identical array
--    and a blank label on one row can no longer empty the Roster tab.
--
--    Six open shifts, two of them call-outs with fromEmployeeId/fromName set:
--      Wed Dispatch 07-16   Dumisani Nkosi called out at 06:10 (he is Absent in
--                           section 4 and his Wed cell below is status 'open')
--      Thu Maintenance 07-16 Oscar Plaatjies called out (this is also swap #8)
--    plus four 'unfilled' gaps. operationalAlerts() raises the call-outs first,
--    which is the whole point: they are what falls out of the system otherwise.
--
--    Approved swaps are ALREADY reflected here (Eben/Pieter traded Mon and Thu;
--    Wanda covers Imraan's Wednesday prep line). Proposed and accepted rows are
--    NOT — nothing moves on the roster until a manager approves it.
-- ===========================================================================
insert into sb_roster_shifts (id, org_id, employee_id, name, role, department, label, days, open_shifts) values
  ('2a000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000001', 'Anele Mtshali', 'Production manager', 'Production', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000002', 'Bianca de Waal', 'Production supervisor', 'Production', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000003', 'Chris Adams', 'Prep lead', 'Production', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "06–12:30", "department": "Production", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000004', 'Dineo Molefe', 'Field supervisor', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000005', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000005', 'Eben Louw', 'Dispatch manager', 'Dispatch', 'Week of 27 Jul',
   '[{"time": "", "status": "off"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000006', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000006', 'Fatima Isaacs', 'Line operator', 'Production', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–14:30", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000007', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000007', 'Gerhard Nel', 'Field team lead', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000008', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000008', 'Hlengiwe Dube', 'Events lead', 'Events', 'Week of 27 Jul',
   '[{"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000009', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000009', 'Imraan Davids', 'Line operator', 'Production', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000010', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000010', 'Jaco Barnard', 'Dispatch coordinator', 'Dispatch', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000011', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000011', 'Karabo Sithole', 'Batch operator', 'Production', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "08–11", "department": "Production", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000012', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000012', 'Lindiwe Ndlovu', 'Field operator', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000013', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000013', 'Marius Fourie', 'Counter supervisor', 'Counter', 'Week of 27 Jul',
   '[{"time": "07:30–15:30", "department": "Counter", "status": "scheduled"}, {"time": "07:30–15:30", "department": "Counter", "status": "scheduled"}, {"time": "07:30–15:30", "department": "Counter", "status": "scheduled"}, {"time": "07:30–15:30", "department": "Counter", "status": "scheduled"}, {"time": "07:30–15:30", "department": "Counter", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000014', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000014', 'Nomsa Khumalo', 'Line operator', 'Production', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000015', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000015', 'Ockert Steyn', 'Events supervisor', 'Events', 'Week of 27 Jul',
   '[{"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "08–16", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000016', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000016', 'Pieter van Wyk', 'Cold store lead', 'Cold Store', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000017', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000017', 'Qiniso Mabaso', 'Load planner', 'Dispatch', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "07–11:30", "department": "Dispatch", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000018', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000018', 'Riaan Botha', 'Field operator', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000019', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000019', 'Sibongile Ncube', 'Counter assistant', 'Counter', 'Week of 27 Jul',
   '[{"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000020', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000020', 'Thabo Maseko', 'Line operator', 'Production', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "07–16", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000021', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000021', 'Ursula Petersen', 'Events assistant', 'Events', 'Week of 27 Jul',
   '[{"time": "", "status": "off"}, {"time": "10–16", "department": "Events", "status": "scheduled"}, {"time": "10–16", "department": "Events", "status": "scheduled"}, {"time": "10–16", "department": "Events", "status": "scheduled"}, {"time": "10–17", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000022', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000022', 'Vusi Zwane', 'Order picker', 'Dispatch', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–15", "department": "Dispatch", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000023', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000023', 'Wanda Jacobs', 'Counter assistant', 'Counter', 'Week of 27 Jul',
   '[{"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "06–14", "department": "Production", "status": "scheduled"}, {"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "08–16", "department": "Counter", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000024', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000024', 'Xolani Mahlangu', 'Field operator', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "06–08", "department": "Field", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000025', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000025', 'Yolanda Fortuin', 'Stock controller', 'Cold Store', 'Week of 27 Jul',
   '[{"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000026', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000026', 'Zanele Dlamini', 'Line operator', 'Production', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "06–15", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000027', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000027', 'Adri Bezuidenhout', 'Events assistant', 'Events', 'Week of 27 Jul',
   '[{"time": "", "status": "off"}, {"time": "", "status": "off"}, {"time": "11–16", "department": "Events", "status": "scheduled"}, {"time": "11–16", "department": "Events", "status": "scheduled"}, {"time": "11–17", "department": "Events", "status": "scheduled"}, {"time": "10–19", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000028', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000028', 'Bongani Mkhize', 'Field operator', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000029', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000029', 'Charmaine Adonis', 'Operations director', 'Admin', 'Week of 27 Jul',
   '[{"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000030', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000030', 'Dumisani Nkosi', 'Order picker', 'Dispatch', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "open"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000031', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000031', 'Elmarie Coetzee', 'Counter assistant', 'Counter', 'Week of 27 Jul',
   '[{"time": "11–16", "department": "Counter", "status": "scheduled"}, {"time": "11–16", "department": "Counter", "status": "scheduled"}, {"time": "11–16", "department": "Counter", "status": "scheduled"}, {"time": "11–16", "department": "Counter", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "09–14", "department": "Counter", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000032', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000032', 'Faheem Salie', 'Events assistant', 'Events', 'Week of 27 Jul',
   '[{"time": "12–17", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "12–17", "department": "Events", "status": "scheduled"}, {"time": "12–17", "department": "Events", "status": "scheduled"}, {"time": "12–17", "department": "Events", "status": "scheduled"}, {"time": "12–17", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000033', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000033', 'Gugu Mthembu', 'Cold store operator', 'Cold Store', 'Week of 27 Jul',
   '[{"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "07–08:30", "department": "Cold Store", "status": "scheduled", "conflict": "Overtime risk"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000034', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000034', 'Hendrik Pretorius', 'Field operator', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000035', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000035', 'Ilse van Niekerk', 'Finance & admin manager', 'Admin', 'Week of 27 Jul',
   '[{"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000036', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000036', 'Jabulani Radebe', 'Counter assistant', 'Counter', 'Week of 27 Jul',
   '[{"time": "11–16", "department": "Counter", "status": "scheduled"}, {"time": "", "status": "leave"}, {"time": "", "status": "leave"}, {"time": "", "status": "leave"}, {"time": "11–16", "department": "Counter", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000037', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000037', 'Kobus Marais', 'Maintenance manager', 'Maintenance', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000038', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000038', 'Lerato Mokoena', 'Line operator', 'Production', 'Week of 27 Jul',
   '[{"time": "", "status": "leave"}, {"time": "", "status": "leave"}, {"time": "", "status": "leave"}, {"time": "06–14", "department": "Production", "status": "scheduled"}, {"time": "06–14", "department": "Production", "status": "scheduled"}, {"time": "06–14", "department": "Production", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000039', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000039', 'Mandla Sibeko', 'Cold store operator', 'Cold Store', 'Week of 27 Jul',
   '[{"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "06:30–15:30", "department": "Cold Store", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000040', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000040', 'Nadia Abrahams', 'Field operator', 'Field', 'Week of 27 Jul',
   '[{"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "14–22", "department": "Field", "status": "scheduled"}, {"time": "06–15", "department": "Field", "status": "scheduled"}, {"time": "06–14:30", "department": "Field", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000041', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000041', 'Oscar Plaatjies', 'Maintenance technician', 'Maintenance', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "open"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000042', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000042', 'Phumla Gwala', 'Order picker', 'Dispatch', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "07–16", "department": "Dispatch", "status": "scheduled"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000043', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000043', 'Quinton Meyer', 'Admin coordinator', 'Admin', 'Week of 27 Jul',
   '[{"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "13–21", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "08–16", "department": "Admin", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000044', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000044', 'Refilwe Tau', 'Events assistant', 'Events', 'Week of 27 Jul',
   '[{"time": "10–16", "department": "Events", "status": "scheduled"}, {"time": "10–16", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "10–16", "department": "Events", "status": "scheduled"}, {"time": "10–17", "department": "Events", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb),
  ('2a000000-7e5d-4c1a-9b3f-000000000045', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000045', 'Sizwe Ngcobo', 'Maintenance assistant', 'Maintenance', 'Week of 27 Jul',
   '[{"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "07–16", "department": "Maintenance", "status": "scheduled"}, {"time": "", "status": "off"}, {"time": "", "status": "off"}]'::jsonb,
   '[{"id": "os-2707-01", "day": "Wed", "department": "Dispatch", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000030", "fromName": "Dumisani Nkosi", "note": "Called out at 06:10 — the 07:00 outbound load is one picker short.", "createdAt": "2026-07-29T06:12:00+02:00"}, {"id": "os-2707-02", "day": "Thu", "department": "Maintenance", "time": "07–16", "reason": "call-out", "fromEmployeeId": "06000000-7e5d-4c1a-9b3f-000000000041", "fromName": "Oscar Plaatjies", "note": "Family responsibility — chiller service visit still needs a second pair of hands.", "createdAt": "2026-07-29T13:40:00+02:00"}, {"id": "os-2707-03", "day": "Thu", "department": "Production", "time": "06–15", "reason": "unfilled", "note": "Extra prep line for the Friday events build."}, {"id": "os-2707-04", "day": "Fri", "department": "Cold Store", "time": "06:30–15:30", "reason": "unfilled", "note": "Fourth cold-store hand for the Friday dispatch peak."}, {"id": "os-2707-05", "day": "Sat", "department": "Counter", "time": "08–14", "reason": "unfilled", "note": "Saturday counter cover — market weekend."}, {"id": "os-2707-06", "day": "Fri", "department": "Dispatch", "time": "13–21", "reason": "unfilled", "note": "Recurring late-dispatch gap — open every Friday this month."}]'::jsonb)
on conflict (id) do update set
  days = excluded.days, label = excluded.label, open_shifts = excluded.open_shifts;

-- ===========================================================================
-- 4. Attendance — today, Wed 29 Jul 2026. One row per person rostered today:
--    45 employees less the five rostered off (Imraan, Hendrik, Mandla, Phumla,
--    Refilwe) and the two on leave (Jabulani, Lerato) = 38 rows.
--
--    Status mix: 26 On time, 5 Late, 3 Overtime, 2 Early leave, 2 Absent, so
--    overviewStats().attendanceIssues (Late + Absent) is 7.
--
--    sum(hours_worked x sb_employees.rate) = R26 100.00. That is the number
--    InsightGen calls labourCostToday (insightgen-data.ts:491-509) and it is
--    deliberately ~12% of a trading day's sales — under LABOUR_WARN_PCT (30) —
--    so the labour-pct-spike anomaly does NOT fire and the surface stays honest.
--
--    `scheduled` mirrors each person's Wednesday roster cell; Wanda Jacobs shows
--    Production because she is covering Imraan's prep line (cover swap #7).
-- ===========================================================================
insert into sb_attendance (id, org_id, employee_id, name, department, scheduled, clock_in, clock_out, hours_worked, status, overtime) values
  ('2b000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000001', 'Anele Mtshali', 'Production', '06:00–15:00', '05:54', '15:24', 9.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000002', 'Bianca de Waal', 'Production', '07:00–16:00', '06:54', '15:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000003', 'Chris Adams', 'Production', '06:00–15:00', '05:54', '15:54', 10, 'Overtime', 1.5),
  ('2b000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000004', 'Dineo Molefe', 'Field', '06:00–15:00', '05:54', '14:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000005', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000005', 'Eben Louw', 'Dispatch', '07:00–16:00', '06:54', '16:24', 9.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000006', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000006', 'Fatima Isaacs', 'Production', '06:00–15:00', '05:54', '14:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000007', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000007', 'Gerhard Nel', 'Field', '06:00–15:00', '05:54', '14:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000008', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000008', 'Hlengiwe Dube', 'Events', '08:00–16:00', '07:54', '17:24', 9.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000009', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000010', 'Jaco Barnard', 'Dispatch', '07:00–16:00', '06:54', '15:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000010', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000011', 'Karabo Sithole', 'Production', '06:00–15:00', '05:54', '14:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000011', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000012', 'Lindiwe Ndlovu', 'Field', '06:00–15:00', '06:34', '14:04', 7.5, 'Late', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000012', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000013', 'Marius Fourie', 'Counter', '07:30–15:30', '07:24', '16:54', 9.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000013', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000014', 'Nomsa Khumalo', 'Production', '06:00–15:00', '05:54', '14:24', 8.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000014', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000015', 'Ockert Steyn', 'Events', '08:00–16:00', '07:54', '16:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000015', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000016', 'Pieter van Wyk', 'Cold Store', '06:30–15:30', '06:24', '15:54', 9.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000016', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000017', 'Qiniso Mabaso', 'Dispatch', '07:00–16:00', '06:54', '16:54', 10, 'Overtime', 1.5),
  ('2b000000-7e5d-4c1a-9b3f-000000000017', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000018', 'Riaan Botha', 'Field', '06:00–15:00', '05:54', '14:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000018', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000019', 'Sibongile Ncube', 'Counter', '08:00–16:00', '07:54', '16:24', 8.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000019', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000020', 'Thabo Maseko', 'Production', '07:00–16:00', '06:54', '12:24', 5.5, 'Early leave', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000020', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000021', 'Ursula Petersen', 'Events', '10:00–16:00', '09:54', '18:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000021', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000022', 'Vusi Zwane', 'Dispatch', '07:00–16:00', '07:22', '15:22', 8, 'Late', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000022', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000023', 'Wanda Jacobs', 'Production', '06:00–14:00', '05:54', '14:24', 8.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000023', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000024', 'Xolani Mahlangu', 'Field', '06:00–15:00', '05:54', '14:00', 8.1, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000024', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000025', 'Yolanda Fortuin', 'Cold Store', '06:30–15:30', '06:24', '15:24', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000025', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000026', 'Zanele Dlamini', 'Production', '06:00–15:00', '05:54', '15:24', 9.5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000026', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000027', 'Adri Bezuidenhout', 'Events', '11:00–16:00', '10:54', '15:54', 5, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000027', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000028', 'Bongani Mkhize', 'Field', '06:00–15:00', '06:41', '14:17', 7.6, 'Late', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000028', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000029', 'Charmaine Adonis', 'Admin', '08:00–16:00', '07:54', '16:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000029', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000030', 'Dumisani Nkosi', 'Dispatch', '07:00–16:00', null, null, 0, 'Absent', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000030', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000031', 'Elmarie Coetzee', 'Counter', '11:00–16:00', '11:27', '15:57', 4.5, 'Late', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000031', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000032', 'Faheem Salie', 'Events', '12:00–17:00', '11:54', '15:24', 3.5, 'Early leave', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000032', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000033', 'Gugu Mthembu', 'Cold Store', '06:30–15:30', '06:24', '15:54', 9.5, 'Overtime', 1),
  ('2b000000-7e5d-4c1a-9b3f-000000000033', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000035', 'Ilse van Niekerk', 'Admin', '08:00–16:00', '07:54', '16:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000034', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000037', 'Kobus Marais', 'Maintenance', '07:00–16:00', '06:54', '15:54', 9, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000035', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000040', 'Nadia Abrahams', 'Field', '14:00–22:00', null, null, 0, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000036', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000041', 'Oscar Plaatjies', 'Maintenance', '07:00–16:00', '07:18', '15:18', 8, 'Late', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000037', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000043', 'Quinton Meyer', 'Admin', '13:00–21:00', '12:54', '22:00', 9.1, 'On time', 0),
  ('2b000000-7e5d-4c1a-9b3f-000000000038', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000045', 'Sizwe Ngcobo', 'Maintenance', '07:00–16:00', null, null, 0, 'Absent', 0)
on conflict (id) do update set
  hours_worked = excluded.hours_worked, status = excluded.status,
  clock_in = excluded.clock_in, clock_out = excluded.clock_out;

-- ===========================================================================
-- 5. Leave requests (11) — 5 Pending, 4 Approved, 2 Declined, across all four
--    LeaveType values. `start_date` is the sort key the query orders on, so it
--    is never null. Two carry coverage_risk 'high': both are a single point of
--    failure leaving on the week's heaviest days, which is the decision the
--    module exists to make visible before it is approved by reflex.
--
--    Rows 1 and 2 are live this week and match the 'leave' cells in section 3.
-- ===========================================================================
insert into sb_leave_requests (id, org_id, employee_id, name, department, type, start_label, end_label, start_date, days, coverage_impact, coverage_risk, status) values
  ('2c000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000038', 'Lerato Mokoena', 'Production',
   'Annual leave', 'Mon 27 Jul', 'Wed 29 Jul', date '2026-07-27', 3,
   'Production runs 9 of 10 to Wednesday — the prep line absorbs it, Zanele picks up the batch runs.', 'low', 'Approved'),
  ('2c000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000036', 'Jabulani Radebe', 'Counter',
   'Family responsibility', 'Tue 28 Jul', 'Thu 30 Jul', date '2026-07-28', 3,
   'Counter drops to 4 of 5 for three days — Elmarie covers the 11:00 window.', 'low', 'Approved'),
  ('2c000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000012', 'Lindiwe Ndlovu', 'Field',
   'Sick leave', '3 Aug', '4 Aug', date '2026-08-03', 2,
   'Field stays covered at 7 — Xolani is already on Saturday overtime, so no extra cost.', 'low', 'Approved'),
  ('2c000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000025', 'Yolanda Fortuin', 'Cold Store',
   'Annual leave', '24 Aug', '28 Aug', date '2026-08-24', 5,
   'Cold Store runs 3 of 4 for the week; Floor Scale — Cold Store moves to Gugu.', 'low', 'Approved'),
  ('2c000000-7e5d-4c1a-9b3f-000000000005', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000003', 'Chris Adams', 'Production',
   'Annual leave', '10 Aug', '14 Aug', date '2026-08-10', 5,
   'Prep lead out for a full week while he is already the org''s highest overtime (51.5h). Nobody else holds Prep Kitchen 5/5.', 'high', 'Pending'),
  ('2c000000-7e5d-4c1a-9b3f-000000000006', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000017', 'Qiniso Mabaso', 'Dispatch',
   'Annual leave', '17 Aug', '21 Aug', date '2026-08-17', 5,
   'Load planner out on the two heaviest wholesale days — Dispatch is already 4 of 5 on shift and carrying a call-out.', 'high', 'Pending'),
  ('2c000000-7e5d-4c1a-9b3f-000000000007', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000021', 'Ursula Petersen', 'Events',
   'Family responsibility', '6 Aug', '6 Aug', date '2026-08-06', 1,
   'Single events shift — Faheem can take the 10:00–16:00 build.', 'none', 'Pending'),
  ('2c000000-7e5d-4c1a-9b3f-000000000008', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000008', 'Hlengiwe Dube', 'Events',
   'Annual leave', '31 Aug', '4 Sep', date '2026-08-31', 5,
   'Events lead out for the week; Ockert steps up and the two assistants extend to 30h.', 'low', 'Pending'),
  ('2c000000-7e5d-4c1a-9b3f-000000000009', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000031', 'Elmarie Coetzee', 'Counter',
   'Annual leave', '14 Sep', '18 Sep', date '2026-09-14', 5,
   'Quiet trading week — counter cover is available from the Saturday pool.', 'none', 'Pending'),
  ('2c000000-7e5d-4c1a-9b3f-000000000010', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000041', 'Oscar Plaatjies', 'Maintenance',
   'Unpaid', '7 Sep', '11 Sep', date '2026-09-07', 5,
   'Declined: planned chiller and cold-room service window falls in the same week.', 'none', 'Declined'),
  ('2c000000-7e5d-4c1a-9b3f-000000000011', '01000000-7e5d-4c1a-9b3f-000000000001', '06000000-7e5d-4c1a-9b3f-000000000045', 'Sizwe Ngcobo', 'Maintenance',
   'Sick leave', '4 Aug', '5 Aug', date '2026-08-04', 2,
   'Declined pending a medical certificate — third short-notice absence this quarter.', 'low', 'Declined')
on conflict (id) do update set
  status = excluded.status, coverage_risk = excluded.coverage_risk,
  coverage_impact = excluded.coverage_impact, start_date = excluded.start_date;

-- ===========================================================================
-- 6. Shift swaps & cover (9) — the propose -> accept -> approve workflow.
--    week_label must equal sb_roster_shifts.label ('Week of 27 Jul') and `day`
--    must be one of the roster's Mon..Sun column headings, or the approval write
--    (shiftboard-write.ts) cannot find the cell it is meant to rewrite.
--
--    Statuses: 4 proposed, 2 accepted, 2 approved, 1 declined. That makes
--    overviewStats().swapsAwaiting 6 and swapsToApprove 2, and operationalAlerts()
--    surfaces '2 shift swaps are waiting on your approval'.
--
--    Two rows are kind='cover' — a call-out someone has (or has not yet) put
--    their hand up for. #7 is approved, so the roster in section 3 already shows
--    Wanda on the Wednesday prep line; #8 is still open and is the same event as
--    the Thursday Maintenance call-out in open_shifts.
--
--    accepted_at / approved_at / decided_note are set consistently with status:
--    a proposed row has neither timestamp, an accepted row has accepted_at only,
--    an approved row has both, and the declined row carries the manager's reason.
-- ===========================================================================
insert into sb_shift_swaps (
  id, org_id, kind, status, week_label, day,
  from_employee_id, from_name, from_time, from_department,
  to_employee_id, to_name, to_day, to_time, to_department,
  reason, note, decided_note, proposed_at, accepted_at, approved_at
) values
  ('2d000000-7e5d-4c1a-9b3f-000000000001', '01000000-7e5d-4c1a-9b3f-000000000001', 'swap', 'proposed', 'Week of 27 Jul', 'Thu',
   '06000000-7e5d-4c1a-9b3f-000000000012', 'Lindiwe Ndlovu', '06–15', 'Field',
   '06000000-7e5d-4c1a-9b3f-000000000019', 'Sibongile Ncube', 'Fri', '08–16', 'Counter',
   'Study', 'Block week at college — happy to take Sibongile''s Friday counter shift in return.', null,
   timestamptz '2026-07-28 17:20+02', null, null),
  ('2d000000-7e5d-4c1a-9b3f-000000000002', '01000000-7e5d-4c1a-9b3f-000000000001', 'swap', 'proposed', 'Week of 27 Jul', 'Sat',
   '06000000-7e5d-4c1a-9b3f-000000000027', 'Adri Bezuidenhout', '10–19', 'Events',
   '06000000-7e5d-4c1a-9b3f-000000000031', 'Elmarie Coetzee', 'Thu', '11–16', 'Counter',
   'Personal', 'Saturday function clashes with a family event — offering Thursday back.', null,
   timestamptz '2026-07-28 19:05+02', null, null),
  ('2d000000-7e5d-4c1a-9b3f-000000000003', '01000000-7e5d-4c1a-9b3f-000000000001', 'swap', 'proposed', 'Week of 27 Jul', 'Fri',
   '06000000-7e5d-4c1a-9b3f-000000000008', 'Hlengiwe Dube', '08–16', 'Events',
   null, null, null, null, null,
   'Transport', 'No lift on Friday — open to anyone who can take the 08:00 events build.', null,
   timestamptz '2026-07-29 07:41+02', null, null),
  ('2d000000-7e5d-4c1a-9b3f-000000000004', '01000000-7e5d-4c1a-9b3f-000000000001', 'swap', 'accepted', 'Week of 27 Jul', 'Tue',
   '06000000-7e5d-4c1a-9b3f-000000000021', 'Ursula Petersen', '10–16', 'Events',
   '06000000-7e5d-4c1a-9b3f-000000000014', 'Nomsa Khumalo', 'Thu', '06–15', 'Production',
   'Family responsibility', 'Nomsa has taken the Tuesday events shift; Ursula covers her Thursday prep line.', null,
   timestamptz '2026-07-27 16:12+02', timestamptz '2026-07-28 08:03+02', null),
  ('2d000000-7e5d-4c1a-9b3f-000000000005', '01000000-7e5d-4c1a-9b3f-000000000001', 'swap', 'accepted', 'Week of 27 Jul', 'Wed',
   '06000000-7e5d-4c1a-9b3f-000000000035', 'Ilse van Niekerk', '08–16', 'Admin',
   '06000000-7e5d-4c1a-9b3f-000000000029', 'Charmaine Adonis', 'Fri', '08–16', 'Admin',
   'Personal', 'Charmaine picks up Wednesday admin, Ilse takes Friday — needs sign-off before the roster moves.', null,
   timestamptz '2026-07-27 11:48+02', timestamptz '2026-07-27 15:30+02', null),
  ('2d000000-7e5d-4c1a-9b3f-000000000006', '01000000-7e5d-4c1a-9b3f-000000000001', 'swap', 'approved', 'Week of 27 Jul', 'Mon',
   '06000000-7e5d-4c1a-9b3f-000000000005', 'Eben Louw', '07–16', 'Dispatch',
   '06000000-7e5d-4c1a-9b3f-000000000016', 'Pieter van Wyk', 'Thu', '06:30–15:30', 'Cold Store',
   'Illness', 'Pieter ran Monday dispatch, Eben took Thursday cold store.', 'Approved — roster rewritten Monday morning. Both hold the department skill at 4/5 or better.',
   timestamptz '2026-07-26 18:30+02', timestamptz '2026-07-26 20:15+02', timestamptz '2026-07-27 06:05+02'),
  ('2d000000-7e5d-4c1a-9b3f-000000000007', '01000000-7e5d-4c1a-9b3f-000000000001', 'cover', 'approved', 'Week of 27 Jul', 'Wed',
   '06000000-7e5d-4c1a-9b3f-000000000009', 'Imraan Davids', '06–14', 'Production',
   '06000000-7e5d-4c1a-9b3f-000000000023', 'Wanda Jacobs', null, null, 'Counter',
   'Called out', 'Imraan called out of the Wednesday prep line; Wanda offered to cover off the counter.', 'Approved — Wanda stays inside her 40h contract and Imraan picks Saturday up instead.',
   timestamptz '2026-07-29 05:38+02', timestamptz '2026-07-29 06:02+02', timestamptz '2026-07-29 06:20+02'),
  ('2d000000-7e5d-4c1a-9b3f-000000000008', '01000000-7e5d-4c1a-9b3f-000000000001', 'cover', 'proposed', 'Week of 27 Jul', 'Thu',
   '06000000-7e5d-4c1a-9b3f-000000000041', 'Oscar Plaatjies', '07–16', 'Maintenance',
   null, null, null, null, null,
   'Called out', 'Family emergency — Thursday maintenance shift is open to the team.', null,
   timestamptz '2026-07-29 13:40+02', null, null),
  ('2d000000-7e5d-4c1a-9b3f-000000000009', '01000000-7e5d-4c1a-9b3f-000000000001', 'swap', 'declined', 'Week of 27 Jul', 'Sun',
   '06000000-7e5d-4c1a-9b3f-000000000030', 'Dumisani Nkosi', '07–16', 'Dispatch',
   '06000000-7e5d-4c1a-9b3f-000000000007', 'Gerhard Nel', null, null, 'Field',
   'Personal', 'Asked to move a Sunday standby onto Gerhard.', 'Declined — Sunday is not a trading day on this roster, so there is no shift to hand over. Log it as leave instead.',
   timestamptz '2026-07-27 09:14+02', null, null)
on conflict (id) do update set
  status = excluded.status, to_employee_id = excluded.to_employee_id,
  to_name = excluded.to_name, accepted_at = excluded.accepted_at,
  approved_at = excluded.approved_at, decided_note = excluded.decided_note;

-- --- end of ShiftBoard fragment --------------------------------------------


-- ##########################################################################
-- ##  SECTION 2G
-- ##  WasteWatch + PlanWise — waste categories, devices, events; budget
-- ##  lines, goals, forecast, scenarios, decisions  (apply order 13-14)
-- ##########################################################################

-- ===========================================================================
-- DOMAIN (e) — WasteWatch + PlanWise  ·  Meridian Food Co.
-- ---------------------------------------------------------------------------
-- Tables written here, and nothing else:
--   ww_waste_categories · ww_devices · ww_waste_events
--   pw_budget_lines · pw_goals · pw_forecast · pw_scenarios · pw_decisions
--
-- `pl_targets` is domain (c)'s row and is NOT written here, even though both
-- modules read it (WasteWatch divides by 100 − target_margin_pct to express
-- waste as a % of food cost; PlanWise reads monthly_opex + monthly_revenue_target).
--
-- WHAT THE MODULES ACTUALLY READ (verified against the data layer, not the DDL):
--
--   wastewatch-data.ts:159  selects ww_waste_categories / ww_waste_events /
--     ww_devices and then RECOMPUTES every aggregate from the events —
--     category cost/pct/trend, the cost timeline, the service heatmap, the
--     weekly report, over-portioning and the coaching list. The stored
--     cost/pct/trend columns on ww_waste_categories survive only for a category
--     with no events at all, so they are seeded as an honest mirror of the log
--     rather than as independent numbers.
--   wastewatch-data.ts:214  anchors EVERY window to the most recent logged
--     event, not to "today". The newest row below is therefore dated
--     2026-07-29 — the blueprint anchor day — so the week/heatmap/timeline all
--     land on the demo's "today".
--   wastewatch-data.ts:602  deriveOverPortion needs expected_qty > 0 AND
--     qty > expected_qty, keyed on `recipe` (falling back to `item`). Exactly
--     12 rows below satisfy that; every other row leaves expected_qty null so
--     the over-portion table stays the 12 deliberate cases.
--   planwise-data.ts:93-114 reads the five pw_* tables, and measures reality
--     from of_orders(invoiced,paid) + of_order_items + pp_stock_items.avg_unit_price
--     + ww_waste_events (this month) + open of_invoices + pl_targets.
--   planwise-actuals.ts:70  classifyBudgetCategory maps EVERY line whose name
--     contains revenue/sales/income → revenue, cogs/cost of goods/produce/
--     stock purchase → cogs, waste/spoilage/shrink → waste, onto the SAME
--     measured total. Duplicates double-count, so exactly one line below
--     classifies as each: "Revenue", "COGS — Stock purchases", "Waste & spoilage".
--     The other eleven names are deliberately clear of those keywords.
--
-- MODULE KEYS: pw_budget_lines.module / pw_goals.module / pw_decisions.module
-- are rendered through MODULE_META[key] (planwise/ui.tsx:114, GoalsView.tsx:293,
-- DecisionsPanel.tsx:188), which is keyed on VysoModuleKey — NOT on the
-- org_features FeatureKey. So `wastewatch` (not 'wastelog') and `supplysync`
-- (not 'suppliers') are used; a FeatureKey there would be an undefined lookup
-- and crash the panel.
--
-- Re-runnable: every row carries an explicit blueprint id and the org's rows are
-- deleted first, scoped to the literal Meridian org UUID. All money in ZAR.
-- No other organisation's rows are read, referenced or deleted.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Delete preamble — scoped to Meridian only. No name sub-selects, no table-wide clears.
-- ---------------------------------------------------------------------------
delete from ww_waste_events     where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ww_devices          where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from ww_waste_categories where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

delete from pw_decisions    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pw_scenarios    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pw_forecast     where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pw_goals        where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';
delete from pw_budget_lines where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';

-- ===========================================================================
-- 1. WasteWatch
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1.1 Waste categories (6) — names match ww_waste_events.category exactly, and
-- the six ProcurePulse product categories, so the donut and the stock catalogue
-- speak the same language.
--
-- cost / pct / trend are a FALLBACK: recomputeCategories (wastewatch-data.ts:250)
-- overwrites all three from the events whenever a category has any. They are
-- seeded to the measured values anyway (cost = the category's share of the
-- R 284 500 logged Apr–Jul; trend = its cost on each of the 7 days ending
-- 2026-07-29) so a stale fallback can never contradict the log.
-- ---------------------------------------------------------------------------
insert into ww_waste_categories (id, org_id, name, color, cost, pct, trend, sort_order) values
  ('2e000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001','Field Produce',     '#0F6E56', 81932, 28.8, '[1544,832,305,657,836,0,2492]'::jsonb, 1),
  ('2e000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001','Proteins',          '#A32D2D', 70976, 24.9, '[1708,3186,0,0,1813,0,816]'::jsonb,    2),
  ('2e000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001','Prepared Lines',    '#854F0B', 64586, 22.7, '[0,1189,1339,0,1243,1510,928]'::jsonb, 3),
  ('2e000000-7e5d-4c1a-9b3f-000000000004','01000000-7e5d-4c1a-9b3f-000000000001','Dairy & Chilled',   '#0C447C', 43319, 15.2, '[0,0,1846,0,0,1216,0]'::jsonb,         4),
  ('2e000000-7e5d-4c1a-9b3f-000000000005','01000000-7e5d-4c1a-9b3f-000000000001','Dry Goods',         '#C77B0A', 17124,  6.0, '[0,0,0,562,0,0,0]'::jsonb,             5),
  ('2e000000-7e5d-4c1a-9b3f-000000000006','01000000-7e5d-4c1a-9b3f-000000000001','Packaging & Other', '#6B6F68',  6563,  2.3, '[0,487,0,0,0,0,491]'::jsonb,           6);

-- ---------------------------------------------------------------------------
-- 1.2 Devices (8) — `type` is drawn from DEVICE_TYPES and `status` from
-- DeviceStatus (wastewatch.ts:16,170); anything else renders unstyled.
-- 6 online, 1 `attention` (the Field Pack scale is at 14% and overdue for
-- calibration), 1 offline. Every `name` here is used verbatim by the
-- ww_waste_events.device column below, and every `current_operator` is a real
-- blueprint §6 employee working in that device's location.
--
-- `events_today` is weigh-ins on the device today, not waste events — a scale
-- weighs far more than it condemns.
-- ---------------------------------------------------------------------------
insert into ww_devices (id, org_id, name, type, location, status, battery, last_sync, firmware, calibration, events_today, current_operator, current_recipe, measurements, history) values
  ('2f000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001',
   'Bench Scale — Production 1','Bench Scale','Production','online',86,'2m ago','v2.6.1','OK · 6 days ago',18,
   '{"name":"Anele Mtshali","role":"Production lead","startedAt":"06:00","shift":"Morning"}'::jsonb,
   '{"name":"Prepared Salad Mix","expected":["Mixed Salad Leaf (crate)","Baby Spinach (crate)","Cucumbers (box)","Mixed Herbs (bunch)"],"currentWaste":{"item":"Mixed Salad Leaf (crate)","qty":"0.8 crate"}}'::jsonb,
   '[{"time":"09:38","item":"Mixed Salad Leaf (crate)","qty":4.2,"unit":"crate"},{"time":"09:05","item":"Baby Spinach (crate)","qty":2.6,"unit":"crate"},{"time":"08:22","item":"Cucumbers (box)","qty":3.1,"unit":"box"}]'::jsonb,
   '[{"kind":"recipe","label":"Recipe changed to Prepared Salad Mix","time":"06:00"},{"kind":"assigned","label":"Assigned to Anele Mtshali","time":"06:00"},{"kind":"connected","label":"Connected","time":"05:48"}]'::jsonb),

  ('2f000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001',
   'Bench Scale — Production 2','Bench Scale','Production','online',71,'4m ago','v2.6.1','OK · 3 days ago',14,
   '{"name":"Bianca de Waal","role":"Production operator","startedAt":"06:15","shift":"Morning"}'::jsonb,
   '{"name":"Ready Meal — Chicken & Rice","expected":["Chicken Portions (10kg box)","Rice (10kg bag)","Mixed Peppers (5kg box)","Stock & Sauce Base (6×2L case)"],"currentWaste":{"item":"Rice (10kg bag)","qty":"0.4 bag"}}'::jsonb,
   '[{"time":"10:12","item":"Chicken Portions (10kg box)","qty":2.6,"unit":"box"},{"time":"09:44","item":"Rice (10kg bag)","qty":2.1,"unit":"bag"}]'::jsonb,
   '[{"kind":"recipe","label":"Recipe changed to Ready Meal — Chicken & Rice","time":"06:20"},{"kind":"assigned","label":"Assigned to Bianca de Waal","time":"06:15"},{"kind":"connected","label":"Connected","time":"06:02"}]'::jsonb),

  ('2f000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001',
   'Floor Scale — Cold Store','Floor Scale','Cold Store','online',63,'7m ago','v2.6.0','OK · 11 days ago',11,
   '{"name":"Thabo Maseko","role":"Cold store lead","startedAt":"05:45","shift":"Early"}'::jsonb,
   null,
   '[{"time":"08:14","item":"Butter Blocks (case)","qty":1.4,"unit":"case"},{"time":"07:36","item":"Fresh Milk (12×1L case)","qty":3.2,"unit":"case"},{"time":"06:58","item":"Cheese Block (kg)","qty":6.5,"unit":"kg"}]'::jsonb,
   '[{"kind":"assigned","label":"Assigned to Thabo Maseko","time":"05:45"},{"kind":"connected","label":"Connected","time":"05:36"}]'::jsonb),

  ('2f000000-7e5d-4c1a-9b3f-000000000004','01000000-7e5d-4c1a-9b3f-000000000001',
   'Bluetooth Scale — Field Pack','Bluetooth Scale','Field Pack','attention',14,'46m ago','v2.5.4','Due · 21 days ago',9,
   null,
   null,
   '[{"time":"07:52","item":"Carrots (10kg bag)","qty":8.0,"unit":"bag"},{"time":"07:11","item":"Potatoes (10kg bag)","qty":6.5,"unit":"bag"}]'::jsonb,
   '[{"kind":"calibration","label":"Calibration overdue","time":"Today"},{"kind":"connected","label":"Battery low — 14%","time":"07:58"},{"kind":"connected","label":"Connected","time":"06:10"}]'::jsonb),

  ('2f000000-7e5d-4c1a-9b3f-000000000005','01000000-7e5d-4c1a-9b3f-000000000001',
   'Bluetooth Scale — Events','Bluetooth Scale','Events Kitchen','online',68,'3m ago','v2.5.4','OK · 5 days ago',7,
   '{"name":"Nomsa Khumalo","role":"Events prep lead","startedAt":"07:00","shift":"Day"}'::jsonb,
   '{"name":"Event Platter Base","expected":["Cheese Block (kg)","Prepared Salad Mix (2kg tub)","Sausage / Boerewors (kg)","Bread Rolls (24/bag)"],"currentWaste":{"item":"Cheese Block (kg)","qty":"1.8 kg"}}'::jsonb,
   '[{"time":"11:26","item":"Cheese Block (kg)","qty":7.8,"unit":"kg"},{"time":"10:40","item":"Prepared Salad Mix (2kg tub)","qty":6.5,"unit":"tub"}]'::jsonb,
   '[{"kind":"recipe","label":"Recipe changed to Event Platter Base","time":"07:05"},{"kind":"assigned","label":"Assigned to Nomsa Khumalo","time":"07:00"},{"kind":"connected","label":"Connected","time":"06:48"}]'::jsonb),

  ('2f000000-7e5d-4c1a-9b3f-000000000006','01000000-7e5d-4c1a-9b3f-000000000001',
   'Kitchen Scale — Counter','Kitchen Scale','Counter','online',54,'1m ago','v1.9.2','OK · 9 days ago',12,
   '{"name":"Qiniso Mabaso","role":"Counter supervisor","startedAt":"07:30","shift":"Day"}'::jsonb,
   null,
   '[{"time":"12:04","item":"Bread Rolls (24/bag)","qty":11.0,"unit":"bag"},{"time":"11:18","item":"Prepared Veg Mix (2.5kg tub)","qty":5.0,"unit":"tub"}]'::jsonb,
   '[{"kind":"assigned","label":"Assigned to Qiniso Mabaso","time":"07:30"},{"kind":"connected","label":"Connected","time":"07:22"}]'::jsonb),

  ('2f000000-7e5d-4c1a-9b3f-000000000007','01000000-7e5d-4c1a-9b3f-000000000001',
   'Barcode Station — Dispatch','Barcode Station','Dispatch','online',77,'Just now','v3.1.0','N/A',5,
   '{"name":"Jaco Barnard","role":"Dispatch lead","startedAt":"06:00","shift":"Morning"}'::jsonb,
   null,
   '[{"time":"13:02","item":"Cartons — Standard (bundle)","qty":3.0,"unit":"bundle"},{"time":"11:47","item":"Punnets & Trays (sleeve)","qty":2.0,"unit":"sleeve"}]'::jsonb,
   '[{"kind":"assigned","label":"Assigned to Jaco Barnard","time":"06:00"},{"kind":"connected","label":"Connected","time":"05:52"}]'::jsonb),

  ('2f000000-7e5d-4c1a-9b3f-000000000008','01000000-7e5d-4c1a-9b3f-000000000001',
   'IoT Sensor — Chiller 3','IoT Sensor','Cold Store','offline',null,'2h 14m ago','v1.4.0','Due · 4 days ago',0,
   null,
   null,
   '[]'::jsonb,
   '[{"kind":"connected","label":"Lost connection","time":"09:41"},{"kind":"calibration","label":"Calibration due","time":"25 Jul"},{"kind":"connected","label":"Connected","time":"05:30"}]'::jsonb);

-- ---------------------------------------------------------------------------
-- 1.3 Waste events — 336 rows, R 284 500 across Apr–Jul 2026.
--
-- WHY THESE NUMBERS. Waste is pinned to 1.5–2.5% of the COGS the OrderFlow
-- lines produce (blueprint §9.1/§9.2), so WasteWatch's "waste as % of food cost"
-- and PlanWise's wastePctOfCogs agree with the sales ledger rather than floating
-- free:
--     Apr  R 63 700 = 2.00% of R 3 182 300     76 events
--     May  R 61 000 = 1.80% of R 3 386 500     72 events
--     Jun  R 83 300 = 2.30% of R 3 622 300     98 events
--     Jul  R 76 500 = 2.40% of R 3 185 600     90 events  (1–29 Jul)
-- July is split three ways on purpose. insightgen-data.ts:807 raises the
-- `waste-spike` anomaly when the last 7 days beat the previous 7 by more than
-- WASTE_SPIKE_WARN_PCT (25), critical past 50:
--     1–15 Jul   40 events  R 33 600
--     16–22 Jul  22 events  R 17 900   ← prior 7
--     23–29 Jul  28 events  R 25 000   ← last 7  = +39.7%  → `warning`
--
-- Reason codes come from WASTE_REASONS (wastewatch.ts:45) exactly. PREVENTABLE_
-- REASONS (Over-portioned, Prep error, Damaged) carry 43.9% of the cost — inside
-- the band that keeps InsightGen's preventable insight reading `positive`, while
-- still giving the coaching list something to work with.
--
-- `item` / `ingredient` are blueprint §3 product names, `category` the six rows
-- above, `employee` blueprint §6 staff working in that location, `device` one of
-- the eight above, `recipe` a blueprint §7 recipe name (byte-for-byte — the
-- over-portion table joins on the string). `cost` is the authoritative integer;
-- `qty` is derived from it at the product's unit COST, so qty × cost ≈ the §3
-- avg_unit_price throughout.
-- ---------------------------------------------------------------------------
-- April 2026 — 76 events, R 63 700 · 2.00% of April COGS (R 3 182 300).
insert into ww_waste_events (id, org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty) values
  ('30000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-01','08:12','Prepared Veg Mix (2.5kg tub)','Prepared Lines',14.24,'tub',1168,'Prep error','Prepared Veg Mix','Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,'Cut to the wrong spec, could not be re-used','Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-01','08:37','Chicken Portions (10kg box)','Proteins',0.65,'box',400,'Damaged',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Chicken Portions (10kg box)','Winelands Protein Co.','WP-4559',null),
  ('30000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-01','10:24','Butternut (kg)','Field Produce',44.8,'kg',663,'Day-old',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',false,'Not sold on the day, no second-day outlet','Butternut (kg)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000004','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-01','10:41','Prepared Salad Mix (2kg tub)','Prepared Lines',5.44,'tub',424,'Day-old',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Yesterday’s prep, moved to staff meal','Prepared Salad Mix (2kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000005','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-01','13:16','Butter Blocks (case)','Dairy & Chilled',1.45,'case',645,'Spoiled',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,null,'Butter Blocks (case)','Cape Cold Chain Supply','CC-4525',null),
  ('30000000-7e5d-4c1a-9b3f-000000000006','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-01','13:16','Punnets & Trays (sleeve)','Packaging & Other',3.7,'sleeve',622,'Damaged',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',true,'Dropped during transfer','Punnets & Trays (sleeve)','Helderberg Packaging',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000007','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-01','16:16','Prepared Salad Mix (2kg tub)','Prepared Lines',17.44,'tub',1360,'Damaged','Event Platter Base','Eben Louw','Bench Scale — Production 1','Production',true,'Dropped during transfer','Prepared Salad Mix (2kg tub)','Bergriver Growers','BG-3214',null),
  ('30000000-7e5d-4c1a-9b3f-000000000008','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-02','07:02','Cake Flour (12.5kg bag)','Dry Goods',5.14,'bag',679,'Damaged',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,null,'Cake Flour (12.5kg bag)','Riebeek Oils & Fats','RO-5267',null),
  ('30000000-7e5d-4c1a-9b3f-000000000009','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-02','14:54','Sausage / Boerewors (kg)','Proteins',9.43,'kg',905,'Expired',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Past its use-by on the pull sheet','Sausage / Boerewors (kg)','Winelands Protein Co.','WP-9611',null),
  ('30000000-7e5d-4c1a-9b3f-000000000010','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-02','15:12','Line Fish Fillet (kg)','Proteins',5,'kg',840,'Spoiled',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Held past its rotation window','Line Fish Fillet (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000011','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-03','11:05','Cucumbers (box)','Field Produce',6.24,'box',599,'Damaged',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',true,'Split packaging on the inbound load','Cucumbers (box)','Bergriver Growers','BG-2248',null),
  ('30000000-7e5d-4c1a-9b3f-000000000012','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-04','08:08','Carrots (10kg bag)','Field Produce',6.95,'bag',598,'Damaged',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',true,null,'Carrots (10kg bag)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000013','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-04','08:58','Prepared Veg Mix (2.5kg tub)','Prepared Lines',6.37,'tub',522,'Spoiled',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',false,'Held past its rotation window','Prepared Veg Mix (2.5kg tub)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000014','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-06','06:54','Prepared Veg Mix (2.5kg tub)','Prepared Lines',13.15,'tub',1078,'Prep error','Roast Vegetable Tray','Chris Adams','Bench Scale — Production 2','Production',true,null,'Prepared Veg Mix (2.5kg tub)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000015','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-06','12:05','Mixed Herbs (bunch)','Field Produce',69.65,'bunch',801,'Spoiled',null,'Eben Louw','Bench Scale — Production 2','Production',false,'Mould found in the lower layer','Mixed Herbs (bunch)','Klipheuwel Farms','KF-3657',null),
  ('30000000-7e5d-4c1a-9b3f-000000000016','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-07','11:05','Cucumbers (box)','Field Produce',6.47,'box',621,'Prep error',null,'Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',true,'Wrong pack size run, reworked','Cucumbers (box)','Bergriver Growers','BG-8380',null),
  ('30000000-7e5d-4c1a-9b3f-000000000017','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-07','13:16','Cartons — Standard (bundle)','Packaging & Other',2.31,'bundle',273,'Damaged',null,'Dineo Molefe','Bench Scale — Production 2','Production',true,'Crushed under a badly stacked pallet','Cartons — Standard (bundle)','Cape Label & Print',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000018','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-07','16:12','Bread Rolls (24/bag)','Prepared Lines',30,'bag',1260,'Spoiled','Bread Rolls','Pieter van Wyk','Kitchen Scale — Counter','Counter',false,null,'Bread Rolls (24/bag)','Bergriver Growers','BG-8300',null),
  ('30000000-7e5d-4c1a-9b3f-000000000019','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-08','09:05','Cake Flour (12.5kg bag)','Dry Goods',4.17,'bag',550,'Damaged',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',true,null,'Cake Flour (12.5kg bag)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000020','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-08','12:37','Butter Blocks (case)','Dairy & Chilled',1.9,'case',845,'Damaged',null,'Chris Adams','Bench Scale — Production 1','Production',true,'Split packaging on the inbound load','Butter Blocks (case)','Overberg Dairy Supply','OD-8058',null),
  ('30000000-7e5d-4c1a-9b3f-000000000021','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-10','08:16','Prepared Veg Mix (2.5kg tub)','Prepared Lines',13.49,'tub',1106,'Damaged',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',true,'Dropped during transfer','Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000022','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-10','08:28','Mixed Peppers (5kg box)','Field Produce',4.77,'box',801,'Spoiled','Soup — Seasonal Vegetable','Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Soft and off-smell on inspection','Mixed Peppers (5kg box)','Klipheuwel Farms','KF-3322',null),
  ('30000000-7e5d-4c1a-9b3f-000000000023','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-11','07:58','Seasonal Apples (12.5kg box)','Field Produce',3.81,'box',983,'Trim','Fruit Cup Prep','Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,null,'Seasonal Apples (12.5kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000024','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-11','15:37','Bread Rolls (24/bag)','Prepared Lines',27.6,'bag',1159,'Spoiled',null,'Qiniso Mabaso','Kitchen Scale — Counter','Counter',false,'Soft and off-smell on inspection','Bread Rolls (24/bag)','Bergriver Growers','BG-3664',null),
  ('30000000-7e5d-4c1a-9b3f-000000000025','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-12','09:12','Seasonal Apples (12.5kg box)','Field Produce',4.32,'box',1114,'Trim',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Stalk and outer-leaf trim','Seasonal Apples (12.5kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000026','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-12','12:41','Prepared Salad Mix (2kg tub)','Prepared Lines',11.72,'tub',914,'Trim','Prepared Salad Mix','Qiniso Mabaso','Kitchen Scale — Counter','Counter',false,'Stalk and outer-leaf trim','Prepared Salad Mix (2kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000027','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-13','09:20','Baby Spinach (crate)','Field Produce',4.68,'crate',618,'Day-old',null,'Anele Mtshali','Bench Scale — Production 1','Production',false,'Not sold on the day, no second-day outlet','Baby Spinach (crate)','Klipheuwel Farms','KF-1349',null),
  ('30000000-7e5d-4c1a-9b3f-000000000028','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-13','09:24','Mixed Peppers (5kg box)','Field Produce',2.83,'box',476,'Wilted','Soup — Seasonal Vegetable','Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Bay ran warm overnight','Mixed Peppers (5kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000029','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-13','10:41','Ready Meal Trays (12/case)','Prepared Lines',4.2,'case',1209,'Prep error','Ready Meal — Chicken & Rice','Riaan Botha','Kitchen Scale — Counter','Counter',true,'Cut to the wrong spec, could not be re-used','Ready Meal Trays (12/case)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000030','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-14','07:24','Prepared Veg Mix (2.5kg tub)','Prepared Lines',15.46,'tub',1268,'Prep error','Roast Vegetable Tray','Qiniso Mabaso','Kitchen Scale — Counter','Counter',true,'Cut to the wrong spec, could not be re-used','Prepared Veg Mix (2.5kg tub)','Overberg Dairy Supply','OD-2216',null),
  ('30000000-7e5d-4c1a-9b3f-000000000031','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-14','07:58','Butter Blocks (case)','Dairy & Chilled',3.36,'case',1494,'Expired',null,'Bianca de Waal','Bench Scale — Production 1','Production',false,null,'Butter Blocks (case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000032','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-15','06:46','Mixed Salad Leaf (crate)','Field Produce',3.9,'crate',577,'Over-portioned','Prepared Salad Mix','Bianca de Waal','Bench Scale — Production 2','Production',true,null,'Mixed Salad Leaf (crate)','Klipheuwel Farms',null,3),
  ('30000000-7e5d-4c1a-9b3f-000000000033','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-15','07:24','Cucumbers (box)','Field Produce',4.41,'box',423,'Wilted',null,'Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,null,'Cucumbers (box)','Bergriver Growers','BG-5617',null),
  ('30000000-7e5d-4c1a-9b3f-000000000034','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-15','07:37','Seasonal Citrus (15kg box)','Field Produce',5.2,'box',895,'Damaged',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',true,'Split packaging on the inbound load','Seasonal Citrus (15kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000035','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-15','09:16','Chicken Portions (10kg box)','Proteins',2.17,'box',1347,'Trim','Marinated Protein Portions','Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',false,null,'Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000036','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-15','18:02','Beef Mince (kg)','Proteins',10.92,'kg',1289,'Trim',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,'Stalk and outer-leaf trim','Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000037','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-16','11:37','Prepared Veg Mix (2.5kg tub)','Prepared Lines',8.82,'tub',723,'Day-old',null,'Chris Adams','Bench Scale — Production 2','Production',false,null,'Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000038','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-16','12:08','Rice (10kg bag)','Dry Goods',6.59,'bag',976,'Damaged','Ready Meal — Chicken & Rice','Jaco Barnard','Barcode Station — Dispatch','Dispatch',true,'Dropped during transfer','Rice (10kg bag)','Riebeek Oils & Fats','RO-8222',null),
  ('30000000-7e5d-4c1a-9b3f-000000000039','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-17','08:50','Tomatoes (kg)','Field Produce',25.83,'kg',607,'Damaged',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Crushed under a badly stacked pallet','Tomatoes (kg)','Klipheuwel Farms','KF-8385',null),
  ('30000000-7e5d-4c1a-9b3f-000000000040','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-17','09:33','Sausage / Boerewors (kg)','Proteins',11.79,'kg',1132,'Spoiled',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,'Soft and off-smell on inspection','Sausage / Boerewors (kg)','Winelands Protein Co.','WP-1668',null),
  ('30000000-7e5d-4c1a-9b3f-000000000041','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-17','10:37','Lamb Cuts (kg)','Proteins',2.34,'kg',456,'Trim',null,'Chris Adams','Bench Scale — Production 2','Production',false,'Stalk and outer-leaf trim','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000042','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-17','11:02','Butternut (kg)','Field Produce',23,'kg',340,'Over-portioned','Ready Meal — Vegetable Bake','Eben Louw','Bench Scale — Production 1','Production',true,null,'Butternut (kg)','Bergriver Growers',null,18),
  ('30000000-7e5d-4c1a-9b3f-000000000043','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-17','14:33','Cake Flour (12.5kg bag)','Dry Goods',2.58,'bag',340,'Other',null,'Bianca de Waal','Bench Scale — Production 2','Production',false,'Logged at stock count, cause not established','Cake Flour (12.5kg bag)','Riebeek Oils & Fats','RO-4264',null),
  ('30000000-7e5d-4c1a-9b3f-000000000044','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-17','15:08','Butter Blocks (case)','Dairy & Chilled',2.64,'case',1177,'Prep error',null,'Dineo Molefe','Bench Scale — Production 1','Production',true,'Cut to the wrong spec, could not be re-used','Butter Blocks (case)','Cape Cold Chain Supply','CC-5895',null),
  ('30000000-7e5d-4c1a-9b3f-000000000045','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-18','12:58','Cheese Block (kg)','Dairy & Chilled',7.19,'kg',992,'Expired',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Past its use-by on the pull sheet','Cheese Block (kg)','Overberg Dairy Supply','OD-9324',null),
  ('30000000-7e5d-4c1a-9b3f-000000000046','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-18','18:41','Lamb Cuts (kg)','Proteins',4.04,'kg',788,'Prep error','Marinated Protein Portions','Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Wrong pack size run, reworked','Lamb Cuts (kg)','Winelands Protein Co.','WP-6995',null),
  ('30000000-7e5d-4c1a-9b3f-000000000047','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-19','10:50','Seasonal Apples (12.5kg box)','Field Produce',4.03,'box',1041,'Prep error','Fruit Cup Prep','Karabo Sithole','Barcode Station — Dispatch','Dispatch',true,'Cut to the wrong spec, could not be re-used','Seasonal Apples (12.5kg box)','Klipheuwel Farms','KF-9315',null),
  ('30000000-7e5d-4c1a-9b3f-000000000048','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-19','10:58','Sausage / Boerewors (kg)','Proteins',8.73,'kg',838,'Damaged','Grazing Board Prep','Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Split packaging on the inbound load','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000049','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-21','06:12','Fresh Milk (12×1L case)','Dairy & Chilled',8.83,'case',1484,'Expired',null,'Bianca de Waal','Bench Scale — Production 1','Production',false,null,'Fresh Milk (12×1L case)','Overberg Dairy Supply','OD-1842',null),
  ('30000000-7e5d-4c1a-9b3f-000000000050','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-21','06:12','Potatoes (10kg bag)','Field Produce',4.47,'bag',483,'Expired','Potato Salad','Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Past its use-by on the pull sheet','Potatoes (10kg bag)','Bergriver Growers','BG-4299',null),
  ('30000000-7e5d-4c1a-9b3f-000000000051','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-21','08:08','Seasonal Citrus (15kg box)','Field Produce',7.04,'box',1211,'Damaged',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',true,null,'Seasonal Citrus (15kg box)','Klipheuwel Farms','KF-4932',null),
  ('30000000-7e5d-4c1a-9b3f-000000000052','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-21','09:16','Potatoes (10kg bag)','Field Produce',5.62,'bag',607,'Spoiled',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,null,'Potatoes (10kg bag)','Klipheuwel Farms','KF-8854',null),
  ('30000000-7e5d-4c1a-9b3f-000000000053','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-21','13:05','Sausage / Boerewors (kg)','Proteins',9.31,'kg',894,'Prep error','Grazing Board Prep','Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',true,'Wrong pack size run, reworked','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000054','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-23','09:50','Potatoes (10kg bag)','Field Produce',5.8,'bag',626,'Damaged',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',true,'Split packaging on the inbound load','Potatoes (10kg bag)','Klipheuwel Farms','KF-6194',null),
  ('30000000-7e5d-4c1a-9b3f-000000000055','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','07:33','Cheese Block (kg)','Dairy & Chilled',10.17,'kg',1403,'Prep error','Event Platter Base','Pieter van Wyk','Kitchen Scale — Counter','Counter',true,'Wrong pack size run, reworked','Cheese Block (kg)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000056','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','08:54','Cheese Block (kg)','Dairy & Chilled',5.18,'kg',715,'Damaged',null,'Dineo Molefe','Bench Scale — Production 1','Production',true,'Dropped during transfer','Cheese Block (kg)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000057','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','09:24','Sugar (12.5kg bag)','Dry Goods',2.93,'bag',493,'Damaged',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',true,null,'Sugar (12.5kg bag)','Swartland Grain & Mill','SG-9806',null),
  ('30000000-7e5d-4c1a-9b3f-000000000058','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','09:28','Maize Meal (12.5kg bag)','Dry Goods',4.72,'bag',557,'Spoiled',null,'Bianca de Waal','Bench Scale — Production 2','Production',false,null,'Maize Meal (12.5kg bag)','Riebeek Oils & Fats','RO-5192',null),
  ('30000000-7e5d-4c1a-9b3f-000000000059','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','12:05','Lamb Cuts (kg)','Proteins',6.3,'kg',1229,'Spoiled',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,'Held past its rotation window','Lamb Cuts (kg)','Winelands Protein Co.','WP-9454',null),
  ('30000000-7e5d-4c1a-9b3f-000000000060','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','14:41','Onions (10kg bag)','Field Produce',11.63,'bag',1070,'Spoiled',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Mould found in the lower layer','Onions (10kg bag)','Bergriver Growers','BG-7707',null),
  ('30000000-7e5d-4c1a-9b3f-000000000061','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','16:20','Sugar (12.5kg bag)','Dry Goods',5.74,'bag',964,'Damaged',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',true,'Split packaging on the inbound load','Sugar (12.5kg bag)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000062','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-24','19:37','Bread Rolls (24/bag)','Prepared Lines',28.57,'bag',1200,'Prep error','Bread Rolls','Pieter van Wyk','Kitchen Scale — Counter','Counter',true,'Wrong pack size run, reworked','Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000063','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-25','09:58','Seasonal Apples (12.5kg box)','Field Produce',3.16,'box',816,'Trim',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Stalk and outer-leaf trim','Seasonal Apples (12.5kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000064','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-27','12:12','Sausage / Boerewors (kg)','Proteins',7.62,'kg',732,'Trim','Grazing Board Prep','Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Normal peel and trim loss','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000065','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-28','07:20','Maize Meal (12.5kg bag)','Dry Goods',4.39,'bag',518,'Damaged',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Maize Meal (12.5kg bag)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000066','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-28','09:50','Sausage / Boerewors (kg)','Proteins',8.76,'kg',841,'Damaged','Grazing Board Prep','Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,'Crushed under a badly stacked pallet','Sausage / Boerewors (kg)','Winelands Protein Co.','WP-2827',null),
  ('30000000-7e5d-4c1a-9b3f-000000000067','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-28','09:58','Mixed Herbs (bunch)','Field Produce',35.74,'bunch',411,'Trim',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,null,'Mixed Herbs (bunch)','Bergriver Growers','BG-6775',null),
  ('30000000-7e5d-4c1a-9b3f-000000000068','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-28','11:24','Tomatoes (kg)','Field Produce',70.64,'kg',1660,'Wilted',null,'Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',false,'Bay ran warm overnight','Tomatoes (kg)','Klipheuwel Farms','KF-2509',null),
  ('30000000-7e5d-4c1a-9b3f-000000000069','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-28','11:46','Ready Meal Trays (12/case)','Prepared Lines',2.28,'case',657,'Day-old',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,null,'Ready Meal Trays (12/case)','Bergriver Growers','BG-8190',null),
  ('30000000-7e5d-4c1a-9b3f-000000000070','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-29','10:24','Chicken Portions (10kg box)','Proteins',0.7,'box',434,'Other',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',false,'Logged at stock count, cause not established','Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000071','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-30','06:28','Butter Blocks (case)','Dairy & Chilled',2.21,'case',982,'Other',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Logged at stock count, cause not established','Butter Blocks (case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000072','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-30','09:37','Butter Blocks (case)','Dairy & Chilled',2.87,'case',1279,'Expired',null,'Riaan Botha','Kitchen Scale — Counter','Counter',false,null,'Butter Blocks (case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000073','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-30','10:50','Baby Spinach (crate)','Field Produce',1.89,'crate',250,'Spoiled','Prepared Salad Mix','Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,null,'Baby Spinach (crate)','Klipheuwel Farms','KF-5108',null),
  ('30000000-7e5d-4c1a-9b3f-000000000074','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-30','11:24','Mixed Peppers (5kg box)','Field Produce',7.04,'box',1182,'Damaged',null,'Chris Adams','Bench Scale — Production 2','Production',true,'Crushed under a badly stacked pallet','Mixed Peppers (5kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000075','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-30','14:05','Line Fish Fillet (kg)','Proteins',3.59,'kg',603,'Damaged',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,'Split packaging on the inbound load','Line Fish Fillet (kg)','Winelands Protein Co.','WP-8733',null),
  ('30000000-7e5d-4c1a-9b3f-000000000076','01000000-7e5d-4c1a-9b3f-000000000001','2026-04-30','17:41','Beef Mince (kg)','Proteins',3.92,'kg',463,'Prep error','Marinated Protein Portions','Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',true,'Batch over-seasoned and pulled','Beef Mince (kg)','Winelands Protein Co.',null,null);

-- May 2026 — 72 events, R 61 000 · 1.80% of May COGS (R 3 386 500).
insert into ww_waste_events (id, org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty) values
  ('30000000-7e5d-4c1a-9b3f-000000000077','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-02','12:08','Butter Blocks (case)','Dairy & Chilled',2.76,'case',1229,'Expired',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,'Found behind newer stock at stock count','Butter Blocks (case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000078','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-02','15:28','Prepared Veg Mix (2.5kg tub)','Prepared Lines',11.54,'tub',946,'Trim',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',false,'Normal peel and trim loss','Prepared Veg Mix (2.5kg tub)','Bergriver Growers','BG-3521',null),
  ('30000000-7e5d-4c1a-9b3f-000000000079','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-02','17:58','Fresh Milk (12×1L case)','Dairy & Chilled',1.97,'case',331,'Spoiled',null,'Eben Louw','Bench Scale — Production 1','Production',false,null,'Fresh Milk (12×1L case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000080','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-03','09:37','Fresh Milk (12×1L case)','Dairy & Chilled',7.29,'case',1225,'Damaged',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Fresh Milk (12×1L case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000081','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-04','06:20','Bread Rolls (24/bag)','Prepared Lines',20.21,'bag',849,'Prep error','Bread Rolls','Riaan Botha','Kitchen Scale — Counter','Counter',true,'Wrong pack size run, reworked','Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000082','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-04','11:54','Lamb Cuts (kg)','Proteins',5.67,'kg',1105,'Trim',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,'Normal peel and trim loss','Lamb Cuts (kg)','Winelands Protein Co.','WP-9870',null),
  ('30000000-7e5d-4c1a-9b3f-000000000083','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-05','07:05','Butternut (kg)','Field Produce',66.42,'kg',983,'Wilted',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Bay ran warm overnight','Butternut (kg)','Klipheuwel Farms','KF-6744',null),
  ('30000000-7e5d-4c1a-9b3f-000000000084','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-05','10:20','Fresh Milk (12×1L case)','Dairy & Chilled',8.29,'case',1393,'Damaged',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',true,null,'Fresh Milk (12×1L case)','Cape Cold Chain Supply','CC-9098',null),
  ('30000000-7e5d-4c1a-9b3f-000000000085','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-06','06:20','Sausage / Boerewors (kg)','Proteins',5.89,'kg',565,'Day-old',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,'Yesterday’s prep, moved to staff meal','Sausage / Boerewors (kg)','Winelands Protein Co.','WP-4230',null),
  ('30000000-7e5d-4c1a-9b3f-000000000086','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-06','08:33','Bread Rolls (24/bag)','Prepared Lines',23.02,'bag',967,'Prep error','Bread Rolls','Pieter van Wyk','Kitchen Scale — Counter','Counter',true,'Batch over-seasoned and pulled','Bread Rolls (24/bag)','Bergriver Growers','BG-8654',null),
  ('30000000-7e5d-4c1a-9b3f-000000000087','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-07','06:02','Stock & Sauce Base (6×2L case)','Prepared Lines',2.04,'case',400,'Day-old',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',false,'Yesterday’s prep, moved to staff meal','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000088','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-07','08:02','Potatoes (10kg bag)','Field Produce',5.34,'bag',577,'Trim',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Normal peel and trim loss','Potatoes (10kg bag)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000089','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-07','09:46','Cheese Block (kg)','Dairy & Chilled',8.61,'kg',1188,'Day-old','Grazing Board Prep','Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,'Yesterday’s prep, moved to staff meal','Cheese Block (kg)','Overberg Dairy Supply','OD-7260',null),
  ('30000000-7e5d-4c1a-9b3f-000000000090','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-07','13:37','Butternut (kg)','Field Produce',53.78,'kg',796,'Prep error','Roast Vegetable Tray','Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',true,'Cut to the wrong spec, could not be re-used','Butternut (kg)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000091','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-08','08:46','Fresh Milk (12×1L case)','Dairy & Chilled',4.93,'case',829,'Day-old',null,'Bianca de Waal','Bench Scale — Production 1','Production',false,'Yesterday’s prep, moved to staff meal','Fresh Milk (12×1L case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000092','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-08','11:54','Lamb Cuts (kg)','Proteins',6.42,'kg',1252,'Damaged',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000093','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-08','15:24','Tomatoes (kg)','Field Produce',46.68,'kg',1097,'Wilted',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Bay ran warm overnight','Tomatoes (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000094','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-08','18:05','Carrots (10kg bag)','Field Produce',6.02,'bag',518,'Damaged','Soup — Seasonal Vegetable','Anele Mtshali','Bench Scale — Production 1','Production',true,'Crushed under a badly stacked pallet','Carrots (10kg bag)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000095','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-09','06:20','Beef Mince (kg)','Proteins',10.05,'kg',1186,'Spoiled',null,'Eben Louw','Bench Scale — Production 2','Production',false,'Soft and off-smell on inspection','Beef Mince (kg)','Winelands Protein Co.','WP-1214',null),
  ('30000000-7e5d-4c1a-9b3f-000000000096','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-09','06:46','Butter Blocks (case)','Dairy & Chilled',2.71,'case',1204,'Prep error',null,'Riaan Botha','Kitchen Scale — Counter','Counter',true,'Wrong pack size run, reworked','Butter Blocks (case)','Overberg Dairy Supply','OD-1420',null),
  ('30000000-7e5d-4c1a-9b3f-000000000097','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-09','10:02','Cooking Oil (4×5L case)','Dry Goods',1.15,'case',737,'Damaged',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Cooking Oil (4×5L case)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000098','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-09','10:54','Cartons — Standard (bundle)','Packaging & Other',4.12,'bundle',486,'Other',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Logged at stock count, cause not established','Cartons — Standard (bundle)','Cape Label & Print',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000099','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-11','13:02','Ready Meal Trays (12/case)','Prepared Lines',3.55,'case',1023,'Expired',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,null,'Ready Meal Trays (12/case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000100','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-11','13:08','Beef Mince (kg)','Proteins',7.31,'kg',862,'Prep error','Ready Meal — Beef & Veg','Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',true,'Cut to the wrong spec, could not be re-used','Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000101','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-11','19:50','Chicken Portions (10kg box)','Proteins',0.92,'box',571,'Damaged',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',true,'Crushed under a badly stacked pallet','Chicken Portions (10kg box)','Winelands Protein Co.','WP-1864',null),
  ('30000000-7e5d-4c1a-9b3f-000000000102','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-12','08:33','Bread Rolls (24/bag)','Prepared Lines',21,'bag',882,'Damaged','Bread Rolls','Eben Louw','Bench Scale — Production 1','Production',true,null,'Bread Rolls (24/bag)','Overberg Dairy Supply','OD-1242',null),
  ('30000000-7e5d-4c1a-9b3f-000000000103','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-12','11:37','Cucumbers (box)','Field Produce',6.56,'box',630,'Damaged',null,'Eben Louw','Bench Scale — Production 1','Production',true,'Crushed under a badly stacked pallet','Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000104','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-13','06:08','Sausage / Boerewors (kg)','Proteins',8.56,'kg',822,'Trim','Grazing Board Prep','Anele Mtshali','Bench Scale — Production 2','Production',false,null,'Sausage / Boerewors (kg)','Winelands Protein Co.','WP-5568',null),
  ('30000000-7e5d-4c1a-9b3f-000000000105','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-13','06:24','Line Fish Fillet (kg)','Proteins',6.6,'kg',1109,'Prep error',null,'Eben Louw','Bench Scale — Production 2','Production',true,null,'Line Fish Fillet (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000106','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-13','10:02','Mixed Herbs (bunch)','Field Produce',48.7,'bunch',560,'Prep error',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Cut to the wrong spec, could not be re-used','Mixed Herbs (bunch)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000107','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-13','11:28','Line Fish Fillet (kg)','Proteins',3.14,'kg',527,'Other',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,null,'Line Fish Fillet (kg)','Winelands Protein Co.','WP-2115',null),
  ('30000000-7e5d-4c1a-9b3f-000000000108','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-14','14:20','Stock & Sauce Base (6×2L case)','Prepared Lines',6.7,'case',1314,'Spoiled','Sauce Base — Tomato','Pieter van Wyk','Kitchen Scale — Counter','Counter',false,'Mould found in the lower layer','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000109','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-15','06:46','Punnets & Trays (sleeve)','Packaging & Other',2.22,'sleeve',373,'Damaged',null,'Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',true,'Crushed under a badly stacked pallet','Punnets & Trays (sleeve)','Helderberg Packaging',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000110','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-15','07:37','Cucumbers (box)','Field Produce',5.68,'box',545,'Spoiled',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,'Soft and off-smell on inspection','Cucumbers (box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000111','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-16','09:05','Beef Mince (kg)','Proteins',12.12,'kg',1430,'Damaged',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',true,'Crushed under a badly stacked pallet','Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000112','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-17','07:33','Stock & Sauce Base (6×2L case)','Prepared Lines',3.5,'case',686,'Damaged',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,'Split packaging on the inbound load','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000113','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-18','10:33','Sugar (12.5kg bag)','Dry Goods',2.96,'bag',497,'Prep error',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',true,'Cut to the wrong spec, could not be re-used','Sugar (12.5kg bag)','Boland Dry Goods','BD-1794',null),
  ('30000000-7e5d-4c1a-9b3f-000000000114','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-19','06:24','Tomatoes (kg)','Field Produce',49.91,'kg',1173,'Spoiled',null,'Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,null,'Tomatoes (kg)','Klipheuwel Farms','KF-9795',null),
  ('30000000-7e5d-4c1a-9b3f-000000000115','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-19','07:37','Cartons — Standard (bundle)','Packaging & Other',4.64,'bundle',547,'Other',null,'Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',false,null,'Cartons — Standard (bundle)','Helderberg Packaging','HP-6547',null),
  ('30000000-7e5d-4c1a-9b3f-000000000116','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-20','06:12','Butter Blocks (case)','Dairy & Chilled',2.08,'case',924,'Expired',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Past its use-by on the pull sheet','Butter Blocks (case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000117','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-20','06:54','Sausage / Boerewors (kg)','Proteins',5.2,'kg',499,'Over-portioned','Grazing Board Prep','Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',true,null,'Sausage / Boerewors (kg)','Winelands Protein Co.',null,4),
  ('30000000-7e5d-4c1a-9b3f-000000000118','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-20','07:05','Butter Blocks (case)','Dairy & Chilled',2.97,'case',1323,'Spoiled',null,'Chris Adams','Bench Scale — Production 1','Production',false,'Soft and off-smell on inspection','Butter Blocks (case)','Cape Cold Chain Supply','CC-8918',null),
  ('30000000-7e5d-4c1a-9b3f-000000000119','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-20','09:08','Sausage / Boerewors (kg)','Proteins',12.93,'kg',1241,'Damaged',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000120','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-20','09:37','Butternut (kg)','Field Produce',73.38,'kg',1086,'Day-old','Roast Vegetable Tray','Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',false,'Not sold on the day, no second-day outlet','Butternut (kg)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000121','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-20','10:16','Fresh Milk (12×1L case)','Dairy & Chilled',7.83,'case',1316,'Damaged',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',true,'Crushed under a badly stacked pallet','Fresh Milk (12×1L case)','Overberg Dairy Supply','OD-4306',null),
  ('30000000-7e5d-4c1a-9b3f-000000000122','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-21','12:12','Maize Meal (12.5kg bag)','Dry Goods',4.89,'bag',577,'Prep error',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Batch over-seasoned and pulled','Maize Meal (12.5kg bag)','Riebeek Oils & Fats','RO-3166',null),
  ('30000000-7e5d-4c1a-9b3f-000000000123','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-22','07:28','Mixed Salad Leaf (crate)','Field Produce',6.28,'crate',929,'Prep error','Prepared Salad Mix','Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',true,'Wrong pack size run, reworked','Mixed Salad Leaf (crate)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000124','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-22','11:37','Prepared Veg Mix (2.5kg tub)','Prepared Lines',16.61,'tub',1362,'Expired',null,'Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',false,null,'Prepared Veg Mix (2.5kg tub)','Bergriver Growers','BG-8753',null),
  ('30000000-7e5d-4c1a-9b3f-000000000125','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-23','08:05','Onions (10kg bag)','Field Produce',7.76,'bag',714,'Wilted',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,null,'Onions (10kg bag)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000126','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-23','14:02','Carrots (10kg bag)','Field Produce',5.4,'bag',464,'Over-portioned','Prepared Veg Mix','Bianca de Waal','Bench Scale — Production 1','Production',true,null,'Carrots (10kg bag)','Klipheuwel Farms','KF-5664',4),
  ('30000000-7e5d-4c1a-9b3f-000000000127','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-23','16:46','Cucumbers (box)','Field Produce',6.42,'box',616,'Wilted',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Bay ran warm overnight','Cucumbers (box)','Bergriver Growers','BG-8476',null),
  ('30000000-7e5d-4c1a-9b3f-000000000128','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-23','18:33','Sausage / Boerewors (kg)','Proteins',7.59,'kg',729,'Spoiled',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,'Soft and off-smell on inspection','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000129','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-25','07:20','Sausage / Boerewors (kg)','Proteins',5.17,'kg',496,'Damaged',null,'Eben Louw','Bench Scale — Production 2','Production',true,'Crushed under a badly stacked pallet','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000130','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-25','07:41','Mixed Peppers (5kg box)','Field Produce',3.64,'box',611,'Wilted',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',false,null,'Mixed Peppers (5kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000131','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-25','07:58','Tomatoes (kg)','Field Produce',20.81,'kg',489,'Other',null,'Imraan Davids','Bluetooth Scale — Field Pack','Field Pack',false,'Logged at stock count, cause not established','Tomatoes (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000132','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-25','10:02','Cucumbers (box)','Field Produce',6.2,'box',595,'Wilted',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,null,'Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000133','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-25','12:16','Seasonal Citrus (15kg box)','Field Produce',2.27,'box',391,'Day-old',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,'Yesterday’s prep, moved to staff meal','Seasonal Citrus (15kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000134','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-25','14:12','Prepared Salad Mix (2kg tub)','Prepared Lines',16.72,'tub',1304,'Expired',null,'Riaan Botha','Kitchen Scale — Counter','Counter',false,'Found behind newer stock at stock count','Prepared Salad Mix (2kg tub)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000135','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-26','06:28','Mixed Peppers (5kg box)','Field Produce',3.89,'box',653,'Day-old',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,null,'Mixed Peppers (5kg box)','Bergriver Growers','BG-9155',null),
  ('30000000-7e5d-4c1a-9b3f-000000000136','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-26','08:54','Stock & Sauce Base (6×2L case)','Prepared Lines',6.74,'case',1321,'Day-old',null,'Dineo Molefe','Bench Scale — Production 1','Production',false,'Yesterday’s prep, moved to staff meal','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000137','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-27','16:33','Mixed Salad Leaf (crate)','Field Produce',5.14,'crate',761,'Expired','Prepared Salad Mix','Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Past its use-by on the pull sheet','Mixed Salad Leaf (crate)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000138','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-28','07:33','Maize Meal (12.5kg bag)','Dry Goods',6.88,'bag',812,'Damaged',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',true,null,'Maize Meal (12.5kg bag)','Riebeek Oils & Fats',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000139','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-28','07:41','Stock & Sauce Base (6×2L case)','Prepared Lines',4.82,'case',945,'Day-old',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,'Yesterday’s prep, moved to staff meal','Stock & Sauce Base (6×2L case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000140','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-28','09:46','Seasonal Citrus (15kg box)','Field Produce',4.33,'box',744,'Damaged','Fruit Cup Prep','Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Dropped during transfer','Seasonal Citrus (15kg box)','Klipheuwel Farms','KF-6193',null),
  ('30000000-7e5d-4c1a-9b3f-000000000141','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-28','16:02','Sugar (12.5kg bag)','Dry Goods',1.55,'bag',261,'Damaged',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',true,'Dropped during transfer','Sugar (12.5kg bag)','Riebeek Oils & Fats','RO-7220',null),
  ('30000000-7e5d-4c1a-9b3f-000000000142','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-28','17:54','Stock & Sauce Base (6×2L case)','Prepared Lines',6.89,'case',1351,'Spoiled','Stock Base — Meat','Anele Mtshali','Bench Scale — Production 2','Production',false,'Mould found in the lower layer','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000143','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-29','07:41','Line Fish Fillet (kg)','Proteins',2.31,'kg',388,'Expired',null,'Dineo Molefe','Bench Scale — Production 1','Production',false,'Found behind newer stock at stock count','Line Fish Fillet (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000144','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-29','07:46','Fresh Milk (12×1L case)','Dairy & Chilled',6.76,'case',1135,'Spoiled',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,'Mould found in the lower layer','Fresh Milk (12×1L case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000145','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-30','07:33','Seasonal Apples (12.5kg box)','Field Produce',4.1,'box',1058,'Wilted',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,null,'Seasonal Apples (12.5kg box)','Klipheuwel Farms','KF-4607',null),
  ('30000000-7e5d-4c1a-9b3f-000000000146','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-30','08:37','Fresh Milk (12×1L case)','Dairy & Chilled',6.76,'case',1135,'Damaged',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',true,'Crushed under a badly stacked pallet','Fresh Milk (12×1L case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000147','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-30','09:20','Carrots (10kg bag)','Field Produce',6.83,'bag',587,'Damaged',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Carrots (10kg bag)','Bergriver Growers','BG-1355',null),
  ('30000000-7e5d-4c1a-9b3f-000000000148','01000000-7e5d-4c1a-9b3f-000000000001','2026-05-31','13:37','Butternut (kg)','Field Produce',51.96,'kg',769,'Damaged',null,'Anele Mtshali','Bench Scale — Production 1','Production',true,'Crushed under a badly stacked pallet','Butternut (kg)','Bergriver Growers',null,null);

-- June 2026 — 98 events, R 83 300 · 2.30% of June COGS (R 3 622 300).
insert into ww_waste_events (id, org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty) values
  ('30000000-7e5d-4c1a-9b3f-000000000149','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-01','06:28','Lamb Cuts (kg)','Proteins',2.59,'kg',506,'Day-old','Marinated Protein Portions','Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,null,'Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000150','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-01','07:33','Tomatoes (kg)','Field Produce',21.74,'kg',511,'Spoiled',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',false,'Held past its rotation window','Tomatoes (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000151','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-01','10:12','Fresh Milk (12×1L case)','Dairy & Chilled',2.22,'case',373,'Spoiled',null,'Qiniso Mabaso','Kitchen Scale — Counter','Counter',false,null,'Fresh Milk (12×1L case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000152','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-01','10:37','Cooking Oil (4×5L case)','Dry Goods',2.21,'case',1413,'Spoiled',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',false,'Held past its rotation window','Cooking Oil (4×5L case)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000153','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-02','08:58','Line Fish Fillet (kg)','Proteins',9.83,'kg',1652,'Spoiled',null,'Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',false,null,'Line Fish Fillet (kg)','Winelands Protein Co.','WP-8807',null),
  ('30000000-7e5d-4c1a-9b3f-000000000154','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-02','10:24','Stock & Sauce Base (6×2L case)','Prepared Lines',2.37,'case',465,'Prep error','Sauce Base — Tomato','Anele Mtshali','Bench Scale — Production 2','Production',true,'Cut to the wrong spec, could not be re-used','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000155','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-02','13:50','Butternut (kg)','Field Produce',43.99,'kg',651,'Prep error','Roast Vegetable Tray','Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Wrong pack size run, reworked','Butternut (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000156','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-02','18:50','Sugar (12.5kg bag)','Dry Goods',5.6,'bag',940,'Damaged',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,null,'Sugar (12.5kg bag)','Riebeek Oils & Fats','RO-4375',null),
  ('30000000-7e5d-4c1a-9b3f-000000000157','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-03','08:02','Fresh Milk (12×1L case)','Dairy & Chilled',3.62,'case',608,'Prep error',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,null,'Fresh Milk (12×1L case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000158','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-03','08:33','Ready Meal Trays (12/case)','Prepared Lines',3.03,'case',874,'Day-old',null,'Qiniso Mabaso','Kitchen Scale — Counter','Counter',false,'Not sold on the day, no second-day outlet','Ready Meal Trays (12/case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000159','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-03','16:20','Tomatoes (kg)','Field Produce',17.62,'kg',414,'Spoiled',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,null,'Tomatoes (kg)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000160','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-04','06:50','Beef Mince (kg)','Proteins',12.9,'kg',1522,'Damaged','Ready Meal — Beef & Veg','Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,'Crushed under a badly stacked pallet','Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000161','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-04','08:05','Butternut (kg)','Field Produce',72.77,'kg',1077,'Wilted','Roast Vegetable Tray','Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,null,'Butternut (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000162','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-04','19:33','Mixed Herbs (bunch)','Field Produce',74.35,'bunch',855,'Prep error',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Cut to the wrong spec, could not be re-used','Mixed Herbs (bunch)','Klipheuwel Farms','KF-1418',null),
  ('30000000-7e5d-4c1a-9b3f-000000000163','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-05','08:33','Onions (10kg bag)','Field Produce',8.55,'bag',787,'Wilted',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,null,'Onions (10kg bag)','Bergriver Growers','BG-4022',null),
  ('30000000-7e5d-4c1a-9b3f-000000000164','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-05','15:50','Onions (10kg bag)','Field Produce',7.13,'bag',656,'Spoiled',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Soft and off-smell on inspection','Onions (10kg bag)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000165','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-05','18:58','Cartons — Standard (bundle)','Packaging & Other',2.28,'bundle',269,'Other',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Logged at stock count, cause not established','Cartons — Standard (bundle)','Helderberg Packaging','HP-3828',null),
  ('30000000-7e5d-4c1a-9b3f-000000000166','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-06','08:02','Prepared Veg Mix (2.5kg tub)','Prepared Lines',19.21,'tub',1575,'Trim','Roast Vegetable Tray','Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,null,'Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000167','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-06','08:28','Butter Blocks (case)','Dairy & Chilled',1.36,'case',606,'Day-old',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,'Not sold on the day, no second-day outlet','Butter Blocks (case)','Cape Cold Chain Supply','CC-3470',null),
  ('30000000-7e5d-4c1a-9b3f-000000000168','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-06','12:02','Sausage / Boerewors (kg)','Proteins',5.66,'kg',543,'Damaged',null,'Bianca de Waal','Bench Scale — Production 1','Production',true,'Split packaging on the inbound load','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000169','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-06','14:50','Sausage / Boerewors (kg)','Proteins',14.79,'kg',1420,'Prep error','Grazing Board Prep','Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,null,'Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000170','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-06','14:50','Seasonal Apples (12.5kg box)','Field Produce',1.3,'box',335,'Prep error','Fruit Cup Prep','Jaco Barnard','Barcode Station — Dispatch','Dispatch',true,'Batch over-seasoned and pulled','Seasonal Apples (12.5kg box)','Bergriver Growers','BG-9025',null),
  ('30000000-7e5d-4c1a-9b3f-000000000171','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-06','15:05','Chicken Portions (10kg box)','Proteins',2.02,'box',1254,'Prep error','Ready Meal — Chicken & Rice','Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Cut to the wrong spec, could not be re-used','Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000172','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-07','13:08','Mixed Peppers (5kg box)','Field Produce',3.4,'box',571,'Over-portioned','Prepared Veg Mix','Bianca de Waal','Bench Scale — Production 1','Production',true,null,'Mixed Peppers (5kg box)','Bergriver Growers','BG-9125',2.5),
  ('30000000-7e5d-4c1a-9b3f-000000000173','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-08','06:02','Seasonal Apples (12.5kg box)','Field Produce',5,'box',1289,'Trim',null,'Eben Louw','Bench Scale — Production 1','Production',false,'Normal peel and trim loss','Seasonal Apples (12.5kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000174','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-08','07:16','Bread Rolls (24/bag)','Prepared Lines',26.05,'bag',1094,'Day-old','Bread Rolls','Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,null,'Bread Rolls (24/bag)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000175','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-08','07:46','Punnets & Trays (sleeve)','Packaging & Other',4.73,'sleeve',794,'Other',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Logged at stock count, cause not established','Punnets & Trays (sleeve)','Cape Label & Print','CL-6532',null),
  ('30000000-7e5d-4c1a-9b3f-000000000176','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-08','08:41','Baby Spinach (crate)','Field Produce',1.61,'crate',213,'Wilted',null,'Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',false,'Left out of cold chain during the pack run','Baby Spinach (crate)','Bergriver Growers','BG-4853',null),
  ('30000000-7e5d-4c1a-9b3f-000000000177','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-08','11:16','Mixed Peppers (5kg box)','Field Produce',2.07,'box',348,'Wilted','Soup — Seasonal Vegetable','Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,null,'Mixed Peppers (5kg box)','Bergriver Growers','BG-9319',null),
  ('30000000-7e5d-4c1a-9b3f-000000000178','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-09','07:20','Seasonal Apples (12.5kg box)','Field Produce',2.86,'box',737,'Prep error','Fruit Cup Prep','Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',true,'Wrong pack size run, reworked','Seasonal Apples (12.5kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000179','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-09','08:08','Fresh Milk (12×1L case)','Dairy & Chilled',5.24,'case',881,'Expired',null,'Eben Louw','Bench Scale — Production 1','Production',false,null,'Fresh Milk (12×1L case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000180','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-09','11:05','Onions (10kg bag)','Field Produce',6.92,'bag',637,'Trim',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',false,null,'Onions (10kg bag)','Klipheuwel Farms','KF-9003',null),
  ('30000000-7e5d-4c1a-9b3f-000000000181','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-09','12:16','Stock & Sauce Base (6×2L case)','Prepared Lines',7.4,'case',1451,'Day-old',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,null,'Stock & Sauce Base (6×2L case)','Overberg Dairy Supply','OD-4216',null),
  ('30000000-7e5d-4c1a-9b3f-000000000182','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-09','12:54','Onions (10kg bag)','Field Produce',3.04,'bag',280,'Wilted',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Bay ran warm overnight','Onions (10kg bag)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000183','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-10','06:08','Seasonal Apples (12.5kg box)','Field Produce',3.6,'box',930,'Damaged',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Seasonal Apples (12.5kg box)','Bergriver Growers','BG-5218',null),
  ('30000000-7e5d-4c1a-9b3f-000000000184','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-10','14:24','Lamb Cuts (kg)','Proteins',8.27,'kg',1612,'Day-old',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',false,null,'Lamb Cuts (kg)','Winelands Protein Co.','WP-7886',null),
  ('30000000-7e5d-4c1a-9b3f-000000000185','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-11','09:46','Butter Blocks (case)','Dairy & Chilled',2.61,'case',1162,'Expired',null,'Eben Louw','Bench Scale — Production 1','Production',false,null,'Butter Blocks (case)','Cape Cold Chain Supply','CC-5489',null),
  ('30000000-7e5d-4c1a-9b3f-000000000186','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-11','12:16','Bread Rolls (24/bag)','Prepared Lines',11.36,'bag',477,'Spoiled',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Soft and off-smell on inspection','Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000187','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-12','07:20','Line Fish Fillet (kg)','Proteins',2.74,'kg',461,'Spoiled',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,'Held past its rotation window','Line Fish Fillet (kg)','Winelands Protein Co.','WP-7635',null),
  ('30000000-7e5d-4c1a-9b3f-000000000188','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-12','10:37','Ready Meal Trays (12/case)','Prepared Lines',1.27,'case',366,'Damaged',null,'Chris Adams','Bench Scale — Production 2','Production',true,null,'Ready Meal Trays (12/case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000189','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-13','12:46','Mixed Peppers (5kg box)','Field Produce',3.62,'box',609,'Wilted',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Bay ran warm overnight','Mixed Peppers (5kg box)','Bergriver Growers','BG-2221',null),
  ('30000000-7e5d-4c1a-9b3f-000000000190','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-13','15:02','Potatoes (10kg bag)','Field Produce',3.15,'bag',340,'Damaged',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Potatoes (10kg bag)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000191','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-13','18:08','Butter Blocks (case)','Dairy & Chilled',2.65,'case',1181,'Expired',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',false,'Found behind newer stock at stock count','Butter Blocks (case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000192','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-14','08:54','Prepared Salad Mix (2kg tub)','Prepared Lines',22.4,'tub',1747,'Trim',null,'Pieter van Wyk','Kitchen Scale — Counter','Counter',false,null,'Prepared Salad Mix (2kg tub)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000193','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-14','12:41','Butter Blocks (case)','Dairy & Chilled',3,'case',1334,'Prep error',null,'Qiniso Mabaso','Kitchen Scale — Counter','Counter',true,'Batch over-seasoned and pulled','Butter Blocks (case)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000194','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-15','16:33','Carrots (10kg bag)','Field Produce',4.45,'bag',383,'Other',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Logged at stock count, cause not established','Carrots (10kg bag)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000195','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','06:08','Prepared Veg Mix (2.5kg tub)','Prepared Lines',12.27,'tub',1006,'Prep error','Roast Vegetable Tray','Riaan Botha','Kitchen Scale — Counter','Counter',true,'Cut to the wrong spec, could not be re-used','Prepared Veg Mix (2.5kg tub)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000196','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','06:58','Sugar (12.5kg bag)','Dry Goods',5.38,'bag',903,'Damaged',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Sugar (12.5kg bag)','Riebeek Oils & Fats','RO-9053',null),
  ('30000000-7e5d-4c1a-9b3f-000000000197','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','08:08','Prepared Salad Mix (2kg tub)','Prepared Lines',12.92,'tub',1008,'Spoiled','Prepared Salad Mix','Pieter van Wyk','Kitchen Scale — Counter','Counter',false,'Mould found in the lower layer','Prepared Salad Mix (2kg tub)','Overberg Dairy Supply','OD-3071',null),
  ('30000000-7e5d-4c1a-9b3f-000000000198','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','12:24','Onions (10kg bag)','Field Produce',2.15,'bag',198,'Spoiled',null,'Bianca de Waal','Bench Scale — Production 2','Production',false,'Held past its rotation window','Onions (10kg bag)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000199','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','13:08','Sausage / Boerewors (kg)','Proteins',4.27,'kg',410,'Spoiled',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',false,'Mould found in the lower layer','Sausage / Boerewors (kg)','Winelands Protein Co.','WP-5546',null),
  ('30000000-7e5d-4c1a-9b3f-000000000200','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','14:28','Potatoes (10kg bag)','Field Produce',10.95,'bag',1183,'Spoiled',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Mould found in the lower layer','Potatoes (10kg bag)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000201','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','14:54','Lamb Cuts (kg)','Proteins',8.25,'kg',1608,'Prep error','Marinated Protein Portions','Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,'Wrong pack size run, reworked','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000202','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-16','16:54','Seasonal Apples (12.5kg box)','Field Produce',1.44,'box',371,'Damaged',null,'Chris Adams','Bench Scale — Production 1','Production',true,'Split packaging on the inbound load','Seasonal Apples (12.5kg box)','Klipheuwel Farms','KF-4200',null),
  ('30000000-7e5d-4c1a-9b3f-000000000203','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-17','07:16','Chicken Portions (10kg box)','Proteins',0.72,'box',447,'Prep error','Marinated Protein Portions','Thabo Maseko','Floor Scale — Cold Store','Cold Store',true,'Batch over-seasoned and pulled','Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000204','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-17','09:33','Chicken Portions (10kg box)','Proteins',1.25,'box',772,'Damaged',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',true,'Split packaging on the inbound load','Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000205','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-17','13:12','Seasonal Apples (12.5kg box)','Field Produce',3.6,'box',930,'Wilted',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Left out of cold chain during the pack run','Seasonal Apples (12.5kg box)','Bergriver Growers','BG-6919',null),
  ('30000000-7e5d-4c1a-9b3f-000000000206','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-17','19:46','Mixed Salad Leaf (crate)','Field Produce',3.12,'crate',462,'Spoiled','Prepared Salad Mix','Jaco Barnard','Barcode Station — Dispatch','Dispatch',false,'Held past its rotation window','Mixed Salad Leaf (crate)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000207','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-18','06:12','Cooking Oil (4×5L case)','Dry Goods',1.1,'case',702,'Prep error',null,'Anele Mtshali','Bench Scale — Production 2','Production',true,'Cut to the wrong spec, could not be re-used','Cooking Oil (4×5L case)','Boland Dry Goods','BD-7296',null),
  ('30000000-7e5d-4c1a-9b3f-000000000208','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-18','07:41','Lamb Cuts (kg)','Proteins',9.16,'kg',1787,'Other',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Logged at stock count, cause not established','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000209','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-18','07:50','Cooking Oil (4×5L case)','Dry Goods',1.88,'case',1206,'Spoiled',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',false,'Soft and off-smell on inspection','Cooking Oil (4×5L case)','Boland Dry Goods','BD-8187',null),
  ('30000000-7e5d-4c1a-9b3f-000000000210','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-18','09:02','Carrots (10kg bag)','Field Produce',4.19,'bag',360,'Wilted',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Bay ran warm overnight','Carrots (10kg bag)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000211','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-18','17:54','Onions (10kg bag)','Field Produce',6.39,'bag',588,'Day-old',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Yesterday’s prep, moved to staff meal','Onions (10kg bag)','Bergriver Growers','BG-4509',null),
  ('30000000-7e5d-4c1a-9b3f-000000000212','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-18','18:08','Mixed Peppers (5kg box)','Field Produce',3.99,'box',670,'Prep error','Soup — Seasonal Vegetable','Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Wrong pack size run, reworked','Mixed Peppers (5kg box)','Klipheuwel Farms','KF-7615',null),
  ('30000000-7e5d-4c1a-9b3f-000000000213','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-19','07:54','Mixed Herbs (bunch)','Field Produce',108.26,'bunch',1245,'Spoiled',null,'Bianca de Waal','Bench Scale — Production 2','Production',false,'Held past its rotation window','Mixed Herbs (bunch)','Bergriver Growers','BG-5704',null),
  ('30000000-7e5d-4c1a-9b3f-000000000214','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-19','08:05','Line Fish Fillet (kg)','Proteins',5.75,'kg',966,'Damaged',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Split packaging on the inbound load','Line Fish Fillet (kg)','Winelands Protein Co.','WP-6465',null),
  ('30000000-7e5d-4c1a-9b3f-000000000215','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-19','14:41','Beef Mince (kg)','Proteins',6.74,'kg',795,'Trim',null,'Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',false,null,'Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000216','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-19','15:37','Lamb Cuts (kg)','Proteins',4.05,'kg',789,'Day-old',null,'Chris Adams','Bench Scale — Production 1','Production',false,null,'Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000217','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-19','17:46','Chicken Portions (10kg box)','Proteins',2.89,'box',1790,'Other',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,null,'Chicken Portions (10kg box)','Winelands Protein Co.','WP-8869',null),
  ('30000000-7e5d-4c1a-9b3f-000000000218','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-20','06:54','Cucumbers (box)','Field Produce',10.48,'box',1006,'Day-old',null,'Dineo Molefe','Bench Scale — Production 1','Production',false,null,'Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000219','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-20','13:02','Stock & Sauce Base (6×2L case)','Prepared Lines',2.45,'case',480,'Prep error','Stock Base — Vegetable','Bianca de Waal','Bench Scale — Production 2','Production',true,null,'Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000220','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-20','16:05','Rice (10kg bag)','Dry Goods',2.1,'bag',311,'Over-portioned','Ready Meal — Chicken & Rice','Chris Adams','Bench Scale — Production 2','Production',true,null,'Rice (10kg bag)','Swartland Grain & Mill','SG-9647',1.5),
  ('30000000-7e5d-4c1a-9b3f-000000000221','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-21','11:33','Prepared Salad Mix (2kg tub)','Prepared Lines',16.74,'tub',1306,'Day-old','Prepared Salad Mix','Anele Mtshali','Bench Scale — Production 1','Production',false,'Yesterday’s prep, moved to staff meal','Prepared Salad Mix (2kg tub)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000222','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-22','07:02','Mixed Peppers (5kg box)','Field Produce',1.58,'box',265,'Spoiled',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,null,'Mixed Peppers (5kg box)','Bergriver Growers','BG-1651',null),
  ('30000000-7e5d-4c1a-9b3f-000000000223','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-22','07:46','Chicken Portions (10kg box)','Proteins',2.42,'box',1499,'Damaged',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',true,null,'Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000224','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-22','11:33','Lamb Cuts (kg)','Proteins',5.88,'kg',1147,'Trim',null,'Eben Louw','Bench Scale — Production 2','Production',false,'Normal peel and trim loss','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000225','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-22','15:37','Mixed Herbs (bunch)','Field Produce',71.57,'bunch',823,'Day-old',null,'Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,'Yesterday’s prep, moved to staff meal','Mixed Herbs (bunch)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000226','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-23','14:50','Line Fish Fillet (kg)','Proteins',5.55,'kg',933,'Spoiled',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Mould found in the lower layer','Line Fish Fillet (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000227','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-23','15:02','Punnets & Trays (sleeve)','Packaging & Other',1.13,'sleeve',190,'Damaged',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',true,'Split packaging on the inbound load','Punnets & Trays (sleeve)','Helderberg Packaging','HP-5647',null),
  ('30000000-7e5d-4c1a-9b3f-000000000228','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-24','07:16','Cheese Block (kg)','Dairy & Chilled',8.49,'kg',1171,'Expired','Grazing Board Prep','Chris Adams','Bench Scale — Production 2','Production',false,null,'Cheese Block (kg)','Cape Cold Chain Supply','CC-9208',null),
  ('30000000-7e5d-4c1a-9b3f-000000000229','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-24','13:12','Seasonal Apples (12.5kg box)','Field Produce',1.57,'box',404,'Trim','Fruit Cup Prep','Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Stalk and outer-leaf trim','Seasonal Apples (12.5kg box)','Bergriver Growers','BG-7068',null),
  ('30000000-7e5d-4c1a-9b3f-000000000230','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-25','10:58','Bread Rolls (24/bag)','Prepared Lines',13.12,'bag',551,'Prep error','Bread Rolls','Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',true,null,'Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000231','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-25','11:41','Prepared Veg Mix (2.5kg tub)','Prepared Lines',11.24,'tub',922,'Prep error','Roast Vegetable Tray','Chris Adams','Bench Scale — Production 2','Production',true,'Cut to the wrong spec, could not be re-used','Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000232','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-25','11:46','Mixed Herbs (bunch)','Field Produce',97.48,'bunch',1121,'Trim',null,'Bianca de Waal','Bench Scale — Production 1','Production',false,'Normal peel and trim loss','Mixed Herbs (bunch)','Bergriver Growers','BG-9585',null),
  ('30000000-7e5d-4c1a-9b3f-000000000233','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-26','08:58','Sausage / Boerewors (kg)','Proteins',9.78,'kg',939,'Trim',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',false,'Stalk and outer-leaf trim','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000234','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-26','09:24','Cartons — Standard (bundle)','Packaging & Other',4.22,'bundle',498,'Other',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Logged at stock count, cause not established','Cartons — Standard (bundle)','Cape Label & Print',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000235','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-26','15:46','Ready Meal Trays (12/case)','Prepared Lines',1.8,'case',519,'Spoiled',null,'Chris Adams','Bench Scale — Production 2','Production',false,'Mould found in the lower layer','Ready Meal Trays (12/case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000236','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-27','14:28','Prepared Veg Mix (2.5kg tub)','Prepared Lines',17.61,'tub',1444,'Trim',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,'Normal peel and trim loss','Prepared Veg Mix (2.5kg tub)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000237','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-28','17:12','Potatoes (10kg bag)','Field Produce',8.97,'bag',969,'Spoiled',null,'Dineo Molefe','Bench Scale — Production 1','Production',false,null,'Potatoes (10kg bag)','Klipheuwel Farms','KF-3032',null),
  ('30000000-7e5d-4c1a-9b3f-000000000238','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-29','07:16','Fresh Milk (12×1L case)','Dairy & Chilled',5.86,'case',985,'Damaged',null,'Chris Adams','Bench Scale — Production 1','Production',true,'Dropped during transfer','Fresh Milk (12×1L case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000239','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-29','08:33','Cucumbers (box)','Field Produce',4.88,'box',468,'Trim',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Stalk and outer-leaf trim','Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000240','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-29','10:12','Cucumbers (box)','Field Produce',10.29,'box',988,'Expired',null,'Chris Adams','Bench Scale — Production 1','Production',false,null,'Cucumbers (box)','Klipheuwel Farms','KF-7744',null),
  ('30000000-7e5d-4c1a-9b3f-000000000241','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-29','10:46','Cheese Block (kg)','Dairy & Chilled',9.68,'kg',1336,'Other',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,'Logged at stock count, cause not established','Cheese Block (kg)','Overberg Dairy Supply','OD-4567',null),
  ('30000000-7e5d-4c1a-9b3f-000000000242','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-29','15:28','Bread Rolls (24/bag)','Prepared Lines',19.31,'bag',811,'Other',null,'Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',false,'Logged at stock count, cause not established','Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000243','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-29','19:05','Chicken Portions (10kg box)','Proteins',1.58,'box',982,'Expired',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',false,null,'Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000244','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-30','07:28','Baby Spinach (crate)','Field Produce',5.96,'crate',787,'Day-old',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Not sold on the day, no second-day outlet','Baby Spinach (crate)','Bergriver Growers','BG-5597',null),
  ('30000000-7e5d-4c1a-9b3f-000000000245','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-30','08:12','Lamb Cuts (kg)','Proteins',8.29,'kg',1617,'Spoiled',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,'Soft and off-smell on inspection','Lamb Cuts (kg)','Winelands Protein Co.','WP-1669',null),
  ('30000000-7e5d-4c1a-9b3f-000000000246','01000000-7e5d-4c1a-9b3f-000000000001','2026-06-30','13:50','Butternut (kg)','Field Produce',29,'kg',429,'Over-portioned','Soup — Butternut','Chris Adams','Bench Scale — Production 2','Production',true,null,'Butternut (kg)','Klipheuwel Farms',null,22);

-- July 2026, 1–15 Jul — 40 events, R 33 600 · the quiet first half of the month.
insert into ww_waste_events (id, org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty) values
  ('30000000-7e5d-4c1a-9b3f-000000000247','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-01','08:08','Onions (10kg bag)','Field Produce',8.77,'bag',807,'Day-old',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,null,'Onions (10kg bag)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000248','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-01','09:08','Baby Spinach (crate)','Field Produce',3.3,'crate',436,'Damaged',null,'Imraan Davids','Bluetooth Scale — Field Pack','Field Pack',true,'Split packaging on the inbound load','Baby Spinach (crate)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000249','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-01','16:08','Butter Blocks (case)','Dairy & Chilled',2.84,'case',1266,'Expired',null,'Chris Adams','Bench Scale — Production 1','Production',false,'Found behind newer stock at stock count','Butter Blocks (case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000250','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-03','06:37','Cheese Block (kg)','Dairy & Chilled',7.07,'kg',975,'Damaged',null,'Dineo Molefe','Bench Scale — Production 2','Production',true,null,'Cheese Block (kg)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000251','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-03','10:16','Tomatoes (kg)','Field Produce',30.3,'kg',712,'Spoiled',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,'Soft and off-smell on inspection','Tomatoes (kg)','Bergriver Growers','BG-2075',null),
  ('30000000-7e5d-4c1a-9b3f-000000000252','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-04','07:54','Line Fish Fillet (kg)','Proteins',4.01,'kg',674,'Damaged',null,'Bianca de Waal','Bench Scale — Production 1','Production',true,'Split packaging on the inbound load','Line Fish Fillet (kg)','Winelands Protein Co.','WP-5714',null),
  ('30000000-7e5d-4c1a-9b3f-000000000253','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-04','09:02','Ready Meal Trays (12/case)','Prepared Lines',1.18,'case',339,'Prep error','Ready Meal — Vegetable Bake','Anele Mtshali','Bench Scale — Production 1','Production',true,'Batch over-seasoned and pulled','Ready Meal Trays (12/case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000254','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-04','10:58','Cooking Oil (4×5L case)','Dry Goods',1.57,'case',1002,'Prep error',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,'Cut to the wrong spec, could not be re-used','Cooking Oil (4×5L case)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000255','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-04','14:54','Stock & Sauce Base (6×2L case)','Prepared Lines',6.63,'case',1300,'Day-old',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,'Yesterday’s prep, moved to staff meal','Stock & Sauce Base (6×2L case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000256','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-05','13:54','Prepared Veg Mix (2.5kg tub)','Prepared Lines',11.01,'tub',903,'Prep error','Prepared Veg Mix','Bianca de Waal','Bench Scale — Production 1','Production',true,'Wrong pack size run, reworked','Prepared Veg Mix (2.5kg tub)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000257','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-06','08:41','Prepared Salad Mix (2kg tub)','Prepared Lines',6.5,'tub',507,'Over-portioned','Event Platter Base','Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',true,null,'Prepared Salad Mix (2kg tub)','Overberg Dairy Supply','OD-7190',5),
  ('30000000-7e5d-4c1a-9b3f-000000000258','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-06','10:28','Seasonal Apples (12.5kg box)','Field Produce',4.1,'box',1057,'Day-old',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Not sold on the day, no second-day outlet','Seasonal Apples (12.5kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000259','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-06','16:02','Stock & Sauce Base (6×2L case)','Prepared Lines',6.21,'case',1218,'Damaged',null,'Riaan Botha','Kitchen Scale — Counter','Counter',true,'Split packaging on the inbound load','Stock & Sauce Base (6×2L case)','Overberg Dairy Supply','OD-2572',null),
  ('30000000-7e5d-4c1a-9b3f-000000000260','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-07','07:05','Mixed Herbs (bunch)','Field Produce',92.61,'bunch',1065,'Expired',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,null,'Mixed Herbs (bunch)','Klipheuwel Farms','KF-6719',null),
  ('30000000-7e5d-4c1a-9b3f-000000000261','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-07','07:28','Lamb Cuts (kg)','Proteins',4.75,'kg',926,'Trim',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Normal peel and trim loss','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000262','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-07','10:05','Fresh Milk (12×1L case)','Dairy & Chilled',6.7,'case',1125,'Prep error',null,'Riaan Botha','Kitchen Scale — Counter','Counter',true,null,'Fresh Milk (12×1L case)','Cape Cold Chain Supply','CC-8761',null),
  ('30000000-7e5d-4c1a-9b3f-000000000263','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-08','06:58','Sugar (12.5kg bag)','Dry Goods',1.91,'bag',321,'Prep error',null,'Bianca de Waal','Bench Scale — Production 1','Production',true,'Wrong pack size run, reworked','Sugar (12.5kg bag)','Riebeek Oils & Fats',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000264','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-08','08:28','Baby Spinach (crate)','Field Produce',3.45,'crate',456,'Trim',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,'Stalk and outer-leaf trim','Baby Spinach (crate)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000265','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-08','09:58','Punnets & Trays (sleeve)','Packaging & Other',3.48,'sleeve',585,'Other',null,'Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,null,'Punnets & Trays (sleeve)','Helderberg Packaging',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000266','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-08','11:46','Punnets & Trays (sleeve)','Packaging & Other',3.56,'sleeve',598,'Other',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,null,'Punnets & Trays (sleeve)','Helderberg Packaging',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000267','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-08','11:58','Bread Rolls (24/bag)','Prepared Lines',9.6,'bag',403,'Prep error','Bread Rolls','Qiniso Mabaso','Kitchen Scale — Counter','Counter',true,'Wrong pack size run, reworked','Bread Rolls (24/bag)','Overberg Dairy Supply','OD-5133',null),
  ('30000000-7e5d-4c1a-9b3f-000000000268','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-09','08:46','Fresh Milk (12×1L case)','Dairy & Chilled',5.51,'case',925,'Expired',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Past its use-by on the pull sheet','Fresh Milk (12×1L case)','Cape Cold Chain Supply','CC-9224',null),
  ('30000000-7e5d-4c1a-9b3f-000000000269','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-09','10:08','Bread Rolls (24/bag)','Prepared Lines',11.69,'bag',491,'Spoiled',null,'Eben Louw','Bench Scale — Production 1','Production',false,'Held past its rotation window','Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000270','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-09','10:58','Beef Mince (kg)','Proteins',15.6,'kg',1841,'Over-portioned','Ready Meal — Beef & Veg','Bianca de Waal','Bench Scale — Production 2','Production',true,null,'Beef Mince (kg)','Winelands Protein Co.',null,12),
  ('30000000-7e5d-4c1a-9b3f-000000000271','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-09','11:28','Tomatoes (kg)','Field Produce',24.51,'kg',576,'Day-old',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Yesterday’s prep, moved to staff meal','Tomatoes (kg)','Klipheuwel Farms','KF-6108',null),
  ('30000000-7e5d-4c1a-9b3f-000000000272','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-09','15:08','Baby Spinach (crate)','Field Produce',4.68,'crate',618,'Damaged',null,'Dineo Molefe','Bench Scale — Production 2','Production',true,'Split packaging on the inbound load','Baby Spinach (crate)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000273','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-09','17:33','Mixed Herbs (bunch)','Field Produce',94.87,'bunch',1091,'Wilted',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',false,'Left out of cold chain during the pack run','Mixed Herbs (bunch)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000274','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-09','19:46','Bread Rolls (24/bag)','Prepared Lines',35.55,'bag',1493,'Prep error','Bread Rolls','Chris Adams','Bench Scale — Production 2','Production',true,'Batch over-seasoned and pulled','Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000275','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-11','07:02','Bread Rolls (24/bag)','Prepared Lines',34.36,'bag',1443,'Damaged','Bread Rolls','Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',true,'Split packaging on the inbound load','Bread Rolls (24/bag)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000276','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-11','09:33','Chicken Portions (10kg box)','Proteins',2.58,'box',1598,'Prep error','Ready Meal — Chicken & Rice','Eben Louw','Bench Scale — Production 1','Production',true,'Cut to the wrong spec, could not be re-used','Chicken Portions (10kg box)','Winelands Protein Co.','WP-2595',null),
  ('30000000-7e5d-4c1a-9b3f-000000000277','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-13','06:50','Stock & Sauce Base (6×2L case)','Prepared Lines',2.47,'case',485,'Trim',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,null,'Stock & Sauce Base (6×2L case)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000278','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-13','07:37','Mixed Peppers (5kg box)','Field Produce',3.93,'box',660,'Day-old','Soup — Seasonal Vegetable','Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Not sold on the day, no second-day outlet','Mixed Peppers (5kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000279','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-13','09:50','Mixed Peppers (5kg box)','Field Produce',2.6,'box',437,'Day-old',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',false,'Not sold on the day, no second-day outlet','Mixed Peppers (5kg box)','Klipheuwel Farms','KF-2984',null),
  ('30000000-7e5d-4c1a-9b3f-000000000280','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-13','15:54','Ready Meal Trays (12/case)','Prepared Lines',4.16,'case',1197,'Damaged',null,'Riaan Botha','Kitchen Scale — Counter','Counter',true,null,'Ready Meal Trays (12/case)','Bergriver Growers','BG-9297',null),
  ('30000000-7e5d-4c1a-9b3f-000000000281','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-14','08:28','Beef Mince (kg)','Proteins',12.86,'kg',1518,'Damaged',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',true,null,'Beef Mince (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000282','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-14','09:41','Seasonal Citrus (15kg box)','Field Produce',1.81,'box',312,'Expired',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',false,'Found behind newer stock at stock count','Seasonal Citrus (15kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000283','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-14','12:02','Stock & Sauce Base (6×2L case)','Prepared Lines',2.9,'case',569,'Damaged',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',true,'Dropped during transfer','Stock & Sauce Base (6×2L case)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000284','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-14','15:50','Cucumbers (box)','Field Produce',6.86,'box',659,'Damaged',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Crushed under a badly stacked pallet','Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000285','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-15','07:05','Lamb Cuts (kg)','Proteins',1.83,'kg',356,'Damaged','Marinated Protein Portions','Anele Mtshali','Bench Scale — Production 2','Production',true,null,'Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000286','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-15','13:41','Sugar (12.5kg bag)','Dry Goods',3.9,'bag',656,'Prep error',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',true,'Cut to the wrong spec, could not be re-used','Sugar (12.5kg bag)','Boland Dry Goods',null,null);

-- July 2026, 16–22 Jul — 22 events, R 17 900 · the "previous 7 days" InsightGen compares against.
insert into ww_waste_events (id, org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty) values
  ('30000000-7e5d-4c1a-9b3f-000000000287','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-16','06:50','Prepared Veg Mix (2.5kg tub)','Prepared Lines',11.59,'tub',950,'Prep error','Roast Vegetable Tray','Bianca de Waal','Bench Scale — Production 2','Production',true,'Wrong pack size run, reworked','Prepared Veg Mix (2.5kg tub)','Overberg Dairy Supply','OD-7614',null),
  ('30000000-7e5d-4c1a-9b3f-000000000288','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-16','10:37','Stock & Sauce Base (6×2L case)','Prepared Lines',4.22,'case',828,'Trim',null,'Bianca de Waal','Bench Scale — Production 2','Production',false,'Stalk and outer-leaf trim','Stock & Sauce Base (6×2L case)','Overberg Dairy Supply','OD-4192',null),
  ('30000000-7e5d-4c1a-9b3f-000000000289','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-16','13:50','Potatoes (10kg bag)','Field Produce',7.4,'bag',799,'Trim',null,'Imraan Davids','Bluetooth Scale — Field Pack','Field Pack',false,'Stalk and outer-leaf trim','Potatoes (10kg bag)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000290','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-16','16:41','Beef Mince (kg)','Proteins',3.16,'kg',373,'Spoiled','Ready Meal — Beef & Veg','Bianca de Waal','Bench Scale — Production 1','Production',false,'Held past its rotation window','Beef Mince (kg)','Winelands Protein Co.','WP-1856',null),
  ('30000000-7e5d-4c1a-9b3f-000000000291','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-17','07:02','Cake Flour (12.5kg bag)','Dry Goods',4.88,'bag',644,'Spoiled',null,'Thabo Maseko','Floor Scale — Cold Store','Cold Store',false,'Soft and off-smell on inspection','Cake Flour (12.5kg bag)','Riebeek Oils & Fats',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000292','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-17','10:24','Cucumbers (box)','Field Produce',7.46,'box',716,'Damaged',null,'Imraan Davids','Bluetooth Scale — Field Pack','Field Pack',true,'Crushed under a badly stacked pallet','Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000293','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-18','06:28','Tomatoes (kg)','Field Produce',45.23,'kg',1063,'Damaged',null,'Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',true,'Crushed under a badly stacked pallet','Tomatoes (kg)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000294','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-19','13:08','Bread Rolls (24/bag)','Prepared Lines',26.98,'bag',1133,'Prep error','Bread Rolls','Qiniso Mabaso','Kitchen Scale — Counter','Counter',true,null,'Bread Rolls (24/bag)','Overberg Dairy Supply','OD-6297',null),
  ('30000000-7e5d-4c1a-9b3f-000000000295','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-20','07:41','Cheese Block (kg)','Dairy & Chilled',7.8,'kg',1076,'Over-portioned','Event Platter Base','Nomsa Khumalo','Bluetooth Scale — Events','Events Kitchen',true,null,'Cheese Block (kg)','Overberg Dairy Supply','OD-2398',6),
  ('30000000-7e5d-4c1a-9b3f-000000000296','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-20','09:50','Lamb Cuts (kg)','Proteins',4.64,'kg',904,'Day-old',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',false,'Not sold on the day, no second-day outlet','Lamb Cuts (kg)','Winelands Protein Co.','WP-9891',null),
  ('30000000-7e5d-4c1a-9b3f-000000000297','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-20','11:02','Cucumbers (box)','Field Produce',4.09,'box',393,'Wilted',null,'Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',false,null,'Cucumbers (box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000298','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-20','16:02','Mixed Peppers (5kg box)','Field Produce',2.54,'box',427,'Spoiled','Roast Vegetable Tray','Ursula Petersen','IoT Sensor — Chiller 3','Cold Store',false,'Soft and off-smell on inspection','Mixed Peppers (5kg box)','Klipheuwel Farms','KF-3202',null),
  ('30000000-7e5d-4c1a-9b3f-000000000299','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-20','18:58','Chicken Portions (10kg box)','Proteins',2.55,'box',1579,'Damaged',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,null,'Chicken Portions (10kg box)','Winelands Protein Co.','WP-2014',null),
  ('30000000-7e5d-4c1a-9b3f-000000000300','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-21','07:37','Butter Blocks (case)','Dairy & Chilled',2.26,'case',1005,'Day-old',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,null,'Butter Blocks (case)','Cape Cold Chain Supply','CC-1594',null),
  ('30000000-7e5d-4c1a-9b3f-000000000301','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-21','09:46','Cake Flour (12.5kg bag)','Dry Goods',3.81,'bag',503,'Damaged',null,'Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Dropped during transfer','Cake Flour (12.5kg bag)','Swartland Grain & Mill','SG-6131',null),
  ('30000000-7e5d-4c1a-9b3f-000000000302','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-21','14:20','Tomatoes (kg)','Field Produce',15.49,'kg',364,'Prep error',null,'Jaco Barnard','Barcode Station — Dispatch','Dispatch',true,'Wrong pack size run, reworked','Tomatoes (kg)','Bergriver Growers','BG-5342',null),
  ('30000000-7e5d-4c1a-9b3f-000000000303','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-21','15:33','Lamb Cuts (kg)','Proteins',7.5,'kg',1463,'Trim',null,'Eben Louw','Bench Scale — Production 1','Production',false,'Stalk and outer-leaf trim','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000304','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-22','07:02','Tomatoes (kg)','Field Produce',38.68,'kg',909,'Day-old',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Yesterday’s prep, moved to staff meal','Tomatoes (kg)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000305','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-22','07:05','Sausage / Boerewors (kg)','Proteins',8.3,'kg',797,'Damaged',null,'Thabo Maseko','IoT Sensor — Chiller 3','Cold Store',true,'Dropped during transfer','Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000306','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-22','08:24','Prepared Veg Mix (2.5kg tub)','Prepared Lines',6.07,'tub',498,'Prep error','Prepared Veg Mix','Riaan Botha','Kitchen Scale — Counter','Counter',true,'Batch over-seasoned and pulled','Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000307','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-22','09:37','Punnets & Trays (sleeve)','Packaging & Other',2.08,'sleeve',350,'Other',null,'Hlengiwe Dube','Bluetooth Scale — Field Pack','Field Pack',false,null,'Punnets & Trays (sleeve)','Helderberg Packaging',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000308','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-22','12:02','Prepared Salad Mix (2kg tub)','Prepared Lines',14.44,'tub',1126,'Day-old',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,null,'Prepared Salad Mix (2kg tub)','Bergriver Growers',null,null);

-- July 2026, 23–29 Jul — 28 events, R 25 000 · the "last 7 days": +39.7% on the week before → `waste-spike` warning.
insert into ww_waste_events (id, org_id, event_date, event_time, item, category, qty, unit, cost, reason, recipe, employee, device, location, preventable, notes, ingredient, supplier, batch, expected_qty) values
  ('30000000-7e5d-4c1a-9b3f-000000000309','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-23','06:37','Seasonal Citrus (15kg box)','Field Produce',1.58,'box',272,'Spoiled',null,'Chris Adams','Bench Scale — Production 2','Production',false,'Soft and off-smell on inspection','Seasonal Citrus (15kg box)','Bergriver Growers','BG-2565',null),
  ('30000000-7e5d-4c1a-9b3f-000000000310','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-23','10:24','Seasonal Apples (12.5kg box)','Field Produce',2.16,'box',556,'Damaged','Fruit Cup Prep','Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,'Dropped during transfer','Seasonal Apples (12.5kg box)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000311','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-23','10:54','Potatoes (10kg bag)','Field Produce',6.63,'bag',716,'Trim','Potato Salad','Fatima Isaacs','Bluetooth Scale — Field Pack','Field Pack',false,'Stalk and outer-leaf trim','Potatoes (10kg bag)','Klipheuwel Farms','KF-7277',null),
  ('30000000-7e5d-4c1a-9b3f-000000000312','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-23','13:02','Chicken Portions (10kg box)','Proteins',1.18,'box',730,'Damaged',null,'Chris Adams','Bench Scale — Production 2','Production',true,'Dropped during transfer','Chicken Portions (10kg box)','Winelands Protein Co.','WP-4757',null),
  ('30000000-7e5d-4c1a-9b3f-000000000313','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-23','18:20','Sausage / Boerewors (kg)','Proteins',10.19,'kg',978,'Prep error','Marinated Protein Portions','Eben Louw','Bench Scale — Production 1','Production',true,null,'Sausage / Boerewors (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000314','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-24','06:37','Mixed Salad Leaf (crate)','Field Produce',5.62,'crate',832,'Wilted',null,'Gerhard Nel','Bluetooth Scale — Field Pack','Field Pack',false,'Left out of cold chain during the pack run','Mixed Salad Leaf (crate)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000315','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-24','06:58','Chicken Portions (10kg box)','Proteins',2.6,'box',1612,'Over-portioned','Ready Meal — Chicken & Rice','Dineo Molefe','Bench Scale — Production 1','Production',true,null,'Chicken Portions (10kg box)','Winelands Protein Co.',null,2),
  ('30000000-7e5d-4c1a-9b3f-000000000316','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-24','07:28','Ready Meal Trays (12/case)','Prepared Lines',4.13,'case',1189,'Damaged',null,'Eben Louw','Bench Scale — Production 1','Production',true,'Dropped during transfer','Ready Meal Trays (12/case)','Overberg Dairy Supply','OD-5813',null),
  ('30000000-7e5d-4c1a-9b3f-000000000317','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-24','08:41','Cartons — Standard (bundle)','Packaging & Other',4.13,'bundle',487,'Other',null,'Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Logged at stock count, cause not established','Cartons — Standard (bundle)','Cape Label & Print',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000318','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-24','09:16','Lamb Cuts (kg)','Proteins',8.07,'kg',1574,'Day-old',null,'Marius Fourie','Bluetooth Scale — Events','Events Kitchen',false,'Not sold on the day, no second-day outlet','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000319','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-25','09:16','Cheese Block (kg)','Dairy & Chilled',10.44,'kg',1441,'Damaged','Event Platter Base','Pieter van Wyk','Kitchen Scale — Counter','Counter',true,null,'Cheese Block (kg)','Cape Cold Chain Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000320','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-25','09:50','Butternut (kg)','Field Produce',20.61,'kg',305,'Trim','Soup — Butternut','Anele Mtshali','Bench Scale — Production 2','Production',false,'Normal peel and trim loss','Butternut (kg)','Klipheuwel Farms','KF-9169',null),
  ('30000000-7e5d-4c1a-9b3f-000000000321','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-25','12:20','Fresh Milk (12×1L case)','Dairy & Chilled',2.41,'case',405,'Day-old',null,'Anele Mtshali','Bench Scale — Production 2','Production',false,'Not sold on the day, no second-day outlet','Fresh Milk (12×1L case)','Overberg Dairy Supply','OD-8624',null),
  ('30000000-7e5d-4c1a-9b3f-000000000322','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-25','15:05','Bread Rolls (24/bag)','Prepared Lines',31.88,'bag',1339,'Prep error','Bread Rolls','Pieter van Wyk','Kitchen Scale — Counter','Counter',true,'Cut to the wrong spec, could not be re-used','Bread Rolls (24/bag)','Bergriver Growers','BG-3296',null),
  ('30000000-7e5d-4c1a-9b3f-000000000323','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-26','10:41','Baby Spinach (crate)','Field Produce',4.98,'crate',657,'Prep error','Prepared Salad Mix','Ursula Petersen','Floor Scale — Cold Store','Cold Store',true,'Wrong pack size run, reworked','Baby Spinach (crate)','Bergriver Growers','BG-2582',null),
  ('30000000-7e5d-4c1a-9b3f-000000000324','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-26','12:41','Sugar (12.5kg bag)','Dry Goods',3.35,'bag',562,'Damaged',null,'Anele Mtshali','Bench Scale — Production 1','Production',true,'Split packaging on the inbound load','Sugar (12.5kg bag)','Boland Dry Goods',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000325','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-27','07:16','Prepared Salad Mix (2kg tub)','Prepared Lines',15.94,'tub',1243,'Other',null,'Dineo Molefe','Bench Scale — Production 2','Production',false,'Logged at stock count, cause not established','Prepared Salad Mix (2kg tub)','Overberg Dairy Supply','OD-4512',null),
  ('30000000-7e5d-4c1a-9b3f-000000000326','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-27','08:46','Lamb Cuts (kg)','Proteins',4.76,'kg',928,'Prep error','Marinated Protein Portions','Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',true,'Batch over-seasoned and pulled','Lamb Cuts (kg)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000327','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-27','13:20','Mixed Peppers (5kg box)','Field Produce',4.98,'box',836,'Damaged',null,'Sibongile Ncube','Floor Scale — Cold Store','Cold Store',true,'Crushed under a badly stacked pallet','Mixed Peppers (5kg box)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000328','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-27','18:58','Chicken Portions (10kg box)','Proteins',1.43,'box',885,'Damaged',null,'Ockert Steyn','Bluetooth Scale — Events','Events Kitchen',true,'Dropped during transfer','Chicken Portions (10kg box)','Winelands Protein Co.',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000329','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-28','07:16','Stock & Sauce Base (6×2L case)','Prepared Lines',7.7,'case',1510,'Day-old',null,'Chris Adams','Bench Scale — Production 1','Production',false,'Yesterday’s prep, moved to staff meal','Stock & Sauce Base (6×2L case)',null,null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000330','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-28','07:54','Cheese Block (kg)','Dairy & Chilled',8.81,'kg',1216,'Damaged',null,'Chris Adams','Bench Scale — Production 1','Production',true,'Split packaging on the inbound load','Cheese Block (kg)','Overberg Dairy Supply',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000331','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-29','07:08','Cartons — Standard (bundle)','Packaging & Other',4.16,'bundle',491,'Other',null,'Karabo Sithole','Barcode Station — Dispatch','Dispatch',false,'Logged at stock count, cause not established','Cartons — Standard (bundle)','Cape Label & Print',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000332','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-29','10:37','Mixed Salad Leaf (crate)','Field Produce',4.2,'crate',622,'Over-portioned','Prepared Salad Mix','Bianca de Waal','Bench Scale — Production 1','Production',true,null,'Mixed Salad Leaf (crate)','Klipheuwel Farms','KF-1726',3),
  ('30000000-7e5d-4c1a-9b3f-000000000333','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-29','12:05','Tomatoes (kg)','Field Produce',39.91,'kg',938,'Expired',null,'Imraan Davids','Bluetooth Scale — Field Pack','Field Pack',false,'Past its use-by on the pull sheet','Tomatoes (kg)','Klipheuwel Farms',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000334','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-29','14:50','Carrots (10kg bag)','Field Produce',10.84,'bag',932,'Wilted','Soup — Seasonal Vegetable','Lindiwe Ndlovu','Barcode Station — Dispatch','Dispatch',false,'Left out of cold chain during the pack run','Carrots (10kg bag)','Bergriver Growers','BG-3397',null),
  ('30000000-7e5d-4c1a-9b3f-000000000335','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-29','16:46','Prepared Veg Mix (2.5kg tub)','Prepared Lines',11.32,'tub',928,'Spoiled','Prepared Veg Mix','Dineo Molefe','Bench Scale — Production 1','Production',false,null,'Prepared Veg Mix (2.5kg tub)','Bergriver Growers',null,null),
  ('30000000-7e5d-4c1a-9b3f-000000000336','01000000-7e5d-4c1a-9b3f-000000000001','2026-07-29','17:54','Chicken Portions (10kg box)','Proteins',1.32,'box',816,'Expired',null,'Sibongile Ncube','IoT Sensor — Chiller 3','Cold Store',false,'Found behind newer stock at stock count','Chicken Portions (10kg box)','Winelands Protein Co.','WP-3747',null);
-- ===========================================================================
-- 2. PlanWise
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 2.1 Budget lines (14)
--
-- `budgeted` is the JULY FULL-MONTH plan, `actual` is the JUNE close — the same
-- convention as the rest of the blueprint, and the reason the two columns can be
-- read side by side. PlanWise then paces `budgeted` to the elapsed fraction of
-- the live month and compares it to what OrderFlow / ProcurePulse / WasteWatch
-- actually measured, so the stored `actual` is only used for the lines nothing
-- can measure (categoryActual, planwise-actuals.ts:116).
--
-- CLASSIFICATION IS BY KEYWORD, so exactly one line may match each family:
--   'Revenue'                → revenue  (measured: of_orders invoiced+paid)
--   'COGS — Stock purchases' → cogs     (measured: qty × pp_stock_items.avg_unit_price)
--   'Waste & spoilage'       → waste    (measured: ww_waste_events this month)
-- The other eleven names deliberately avoid revenue/sales/income/cogs/cost of
-- goods/produce/stock purchase/waste/spoilage/shrink. "Cold chain & utilities"
-- rather than "Cold storage", "Packaging & consumables" rather than "Packaging
-- stock purchases", and the labour split is two lines because neither contains a
-- classified keyword.
--
-- THE ARITHMETIC (July plan):
--   Revenue                          5 510 000
--   − COGS            3 405 000        61.8% of revenue
--   − Labour (4+5)    1 335 000        24.2% of revenue
--   − Waste              81 700         2.4% of COGS
--   − Overheads 6..14   412 800
--   = Net profit        275 500         5.0%
--   Gross profit = 2 105 000 (38.2%) · monthly_opex = 1 829 500 → pl_targets
--
-- profit_impact is the signed rand position against plan: under budget on a cost
-- is +, over is −; on revenue, beating plan is +.
-- ---------------------------------------------------------------------------
insert into pw_budget_lines (id, org_id, cat, budgeted, actual, profit_impact, suggested_action, module, color, sort_order) values
  ('31000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001','Revenue',                              5510000, 5860000,  350000, 'June closed 6.4% ahead of the July plan — hold the trade volume, not the discounting', 'orderflow',    '#1E5E54',  0),
  ('31000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001','COGS — Stock purchases',               3405000, 3622300, -217300, 'Cooking oil and line fish drove June — re-source both in ProcurePulse',                'procurepulse', '#D9730D',  1),
  ('31000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001','Waste & spoilage',                       81700,   83300,   -1600, 'Preventable waste is 44% of the log — start with over-portioning on prepared lines',   'wastewatch',   '#9A6314',  2),
  ('31000000-7e5d-4c1a-9b3f-000000000004','01000000-7e5d-4c1a-9b3f-000000000001','Labour — rostered wages',               680000,  672000,    8000, 'Five people ran over contracted hours this week — rebalance before Saturday',          'shiftboard',   '#0C447C',  3),
  ('31000000-7e5d-4c1a-9b3f-000000000005','01000000-7e5d-4c1a-9b3f-000000000001','Labour — seasonal, contract & on-costs', 655000,  653000,    2000, 'Events cover is holding — keep the casual pool at its current size',                   'shiftboard',   '#2C5E8A',  4),
  ('31000000-7e5d-4c1a-9b3f-000000000006','01000000-7e5d-4c1a-9b3f-000000000001','Delivery & fleet',                      102000,  106400,   -4400, 'Consolidate the Tuesday and Thursday Peninsula runs',                                  'orderflow',    '#854F0B',  5),
  ('31000000-7e5d-4c1a-9b3f-000000000007','01000000-7e5d-4c1a-9b3f-000000000001','Cold chain & utilities',                 82000,   84900,   -2900, 'Chiller 3 has been offline and reconnecting — book the service call',                  'procurepulse', '#0E7490',  6),
  ('31000000-7e5d-4c1a-9b3f-000000000008','01000000-7e5d-4c1a-9b3f-000000000001','Packaging & consumables',                53000,   55100,   -2100, 'Bulk the punnet sleeves and carton bundles into one order',                            'procurepulse', '#5B53C0',  7),
  ('31000000-7e5d-4c1a-9b3f-000000000009','01000000-7e5d-4c1a-9b3f-000000000001','Rent & facilities',                      74000,   74000,       0, 'On plan — fixed lease to March 2028',                                                  null,           '#2E7D67',  8),
  ('31000000-7e5d-4c1a-9b3f-000000000010','01000000-7e5d-4c1a-9b3f-000000000001','Insurance & compliance',                 23500,   23500,       0, 'Two supplier certificates have lapsed — close them before the renewal quote',          'supplysync',   '#B0466A',  9),
  ('31000000-7e5d-4c1a-9b3f-000000000011','01000000-7e5d-4c1a-9b3f-000000000001','Software & subscriptions',               16000,   16000,       0, 'On plan',                                                                              null,           '#3A4DB0', 10),
  ('31000000-7e5d-4c1a-9b3f-000000000012','01000000-7e5d-4c1a-9b3f-000000000001','Marketing & trade activation',           25500,   21800,    3700, 'Underspent — put it behind the events pipeline while quotes are open',                 null,           '#7C5BC0', 11),
  ('31000000-7e5d-4c1a-9b3f-000000000013','01000000-7e5d-4c1a-9b3f-000000000001','Repairs & maintenance',                  20500,   26200,   -5700, 'Two scale calibrations are overdue — batch them with the chiller call-out',            null,           '#A3560F', 12),
  ('31000000-7e5d-4c1a-9b3f-000000000014','01000000-7e5d-4c1a-9b3f-000000000001','Professional fees & admin',              16300,   16300,       0, 'On plan — reconcile the loose invoices in Doc-U',                                      'docu',         '#6B6F68', 13);

-- ---------------------------------------------------------------------------
-- 2.2 Goals (5)
--
-- planwise-data.ts:335 OVERWRITES `current` from live data for goal_key in
-- (revenue, margin, growth, cash, outstanding). So:
--   'margin'      → recomputed as realised gross margin (≈38.2% vs the 41 target)
--   'outstanding' → recomputed from open of_invoices (≈R 1.90M vs the 1.40M cap)
-- and the seeded values below are what those two should land on, so the page
-- reads the same before and after the live read resolves.
--   'rev', 'waste' and 'labour' are NOT in that map and stay as seeded — they are
-- the plan's own targets (July plan 5 510 000 against a 5 600 000 target;
-- waste 2.4% of food cost against a 2.0% ceiling; labour 24.2% of revenue
-- against 23.0%).
-- ---------------------------------------------------------------------------
insert into pw_goals (id, org_id, goal_key, label, target, current, unit, higher_is_better, module, trend, sort_order) values
  ('32000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001','rev',         'Monthly revenue target',   5600000, 5510000, 'R', true,  'orderflow',  '[4980000,5060000,5150000,5480000,5860000,5510000]'::jsonb, 0),
  ('32000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001','margin',      'Gross margin %',                41,    38.2, '%', true,  'pricepilot', '[36.4,37.1,37.4,37.6,38.0,38.2]'::jsonb,                   1),
  ('32000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001','waste',       'Waste % of food cost',           2,     2.4, '%', false, 'wastewatch', '[2.9,2.7,2.0,1.8,2.3,2.4]'::jsonb,                         2),
  ('32000000-7e5d-4c1a-9b3f-000000000004','01000000-7e5d-4c1a-9b3f-000000000001','labour',      'Labour % of revenue',           23,    24.2, '%', false, 'shiftboard', '[25.4,25.0,24.0,23.4,22.6,24.2]'::jsonb,                   3),
  ('32000000-7e5d-4c1a-9b3f-000000000005','01000000-7e5d-4c1a-9b3f-000000000001','outstanding', 'Outstanding receivables',  1400000, 1900000, 'R', false, 'orderflow',  '[1620000,1710000,1780000,1840000,1880000,1900000]'::jsonb, 4);

-- ---------------------------------------------------------------------------
-- 2.3 Forecast (4)
--
-- The `rev` row carries the 12-month series (Aug 2025 → Jul 2026). Its last four
-- points ARE the blueprint §8.1 months, so the chart and the order ledger cannot
-- disagree: Apr 5.15M, May 5.48M, Jun 5.86M actual, Jul 5.51M forecast (the
-- 1–29 Jul run rate of R 5 155 000 ÷ 0.9355 elapsed).
-- `data` is the short trailing sparkline the other three lines use.
-- Expense forecast = COGS 3 405 000 + opex 1 829 500 = 5 234 500.
-- ---------------------------------------------------------------------------
insert into pw_forecast (id, org_id, forecast_key, label, value, target, range_low, range_high, confidence, trend, tone, data, series, sort_order) values
  ('33000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001','rev','Revenue forecast', 5510000, 5600000, 5380000, 5640000, 84, 'up', 'warning',
   '[5060000,5150000,5480000,5860000,5510000]'::jsonb,
   '[{"month":"Aug 2025","value":4720000,"kind":"actual"},{"month":"Sep 2025","value":4860000,"kind":"actual"},{"month":"Oct 2025","value":5040000,"kind":"actual"},{"month":"Nov 2025","value":5320000,"kind":"actual"},{"month":"Dec 2025","value":5610000,"kind":"actual"},{"month":"Jan 2026","value":4690000,"kind":"actual"},{"month":"Feb 2026","value":4980000,"kind":"actual"},{"month":"Mar 2026","value":5060000,"kind":"actual"},{"month":"Apr 2026","value":5150000,"kind":"actual"},{"month":"May 2026","value":5480000,"kind":"actual"},{"month":"Jun 2026","value":5860000,"kind":"actual"},{"month":"Jul 2026","value":5510000,"kind":"forecast"}]'::jsonb,
   0),
  ('33000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001','exp','Expense forecast', 5234500, 5200000, 5140000, 5330000, 86, 'up', 'warning',
   '[4790000,4870000,5010000,5290000,5234500]'::jsonb, '[]'::jsonb, 1),
  ('33000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001','profit','Profit forecast', 275500, 320000, 190000, 350000, 74, 'flat', 'warning',
   '[270000,280000,470000,570000,275500]'::jsonb, '[]'::jsonb, 2),
  ('33000000-7e5d-4c1a-9b3f-000000000004','01000000-7e5d-4c1a-9b3f-000000000001','cash','Cash position', 1860000, 2200000, 1700000, 2020000, 79, 'up', 'neutral',
   '[1490000,1580000,1670000,1790000,1860000]'::jsonb, '[]'::jsonb, 3);

-- ---------------------------------------------------------------------------
-- 2.4 Scenarios (3) — the what-if builder's saved starting points.
-- planwise-data.ts:163 reads sliders/risk/probability and recomputes the outcome
-- live against the measured base, so `projected` is a cached display blob; it is
-- filled consistently with the July plan (revenue 5 510 000 / expenses 5 234 500
-- / profit 275 500 / cash 1 860 000) so a stale cache still tells the truth.
-- ---------------------------------------------------------------------------
insert into pw_scenarios (id, org_id, scenario_key, title, description, assumption, sliders, projected, risk, probability, sort_order) values
  ('34000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001','A','Scenario A','Win two mid-size trade accounts (+6% revenue)',
   'Both open quotes convert in August; volume up, basket mix and margin held',
   '{"revenueGrowth":6,"expenseReduction":0,"marginImprovement":0,"wasteReduction":0,"invoiceRecovery":0}'::jsonb,
   '{"revenue":5840600,"expenses":5438800,"profit":401800,"cash":1986300,"runwayMonths":1.1,"diffVsCurrent":126300}'::jsonb,
   'Medium', 55, 0),
  ('34000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001','B','Scenario B','Cut preventable waste and trim overheads (−6% opex, −35% waste)',
   'WasteWatch closes the over-portioning gap on prepared lines while the delivery runs are consolidated',
   '{"revenueGrowth":0,"expenseReduction":6,"marginImprovement":0,"wasteReduction":35,"invoiceRecovery":0}'::jsonb,
   '{"revenue":5510000,"expenses":5097900,"profit":412100,"cash":1996600,"runwayMonths":1.2,"diffVsCurrent":136600}'::jsonb,
   'Low', 70, 1),
  ('34000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001','C','Scenario C','Close the margin gap and collect the ledger (+2.8 pts, 60% recovery)',
   'PricePilot lifts the five below-target lines to the 41% target and 60% of the open invoice book is collected',
   '{"revenueGrowth":2,"expenseReduction":0,"marginImprovement":2.8,"wasteReduction":0,"invoiceRecovery":60}'::jsonb,
   '{"revenue":5620200,"expenses":5145400,"profit":474800,"cash":2860000,"runwayMonths":1.6,"diffVsCurrent":199300}'::jsonb,
   'Medium', 60, 2);

-- ---------------------------------------------------------------------------
-- 2.5 Decisions (8) — the cross-module recommendations Meridian is TRACKING.
--
-- PlanWise derives fresh suggestions on every request and merges them with these
-- (planwise-data.ts:392-437); a tracked row wins on `decision_key`, which is why
-- the keys below match the derived ones exactly ('recover-outstanding',
-- 'close-margin-gap') where they overlap. The unique index on
-- (org_id, decision_key) makes "adopt" idempotent at the DB level.
--
-- `module` is a VysoModuleKey — MODULE_META[module] is dereferenced without a
-- guard in DecisionsPanel.tsx:188, so 'wastewatch'/'supplysync' rather than the
-- FeatureKeys 'wastelog'/'suppliers'.
--
-- `because` quotes a fact that is actually seeded elsewhere in this file or in
-- the sibling domains, so every claim on screen is checkable:
--   1  R 1.90M open receivables / R 0.42M overdue   → OrderFlow invoices
--   2  38.2% realised margin vs the 41% target      → pl_targets + order lines
--   3  cooking oil R 566.00 → R 640.00 (+13.1%)     → ss_supplier_pricing 701
--   4  12 over-portion events, R 76 500 July waste  → ww_waste_events above
--   5  R 48 380 across 6 open claims                → ss_supplier_credits
--   6  R 33 000 + R 24 000 rebate shortfall         → ss_supplier_rebates
--   7  5 people over contracted hours               → sb_employees
--   8  4 unmatched supplier documents               → documents
-- States: 3 open, 3 in_progress, 2 done.
-- ---------------------------------------------------------------------------
insert into pw_decisions (id, org_id, decision_key, module, action, impact, impact_value, priority, status, because, note, owner, due_date, sort_order) values
  ('35000000-7e5d-4c1a-9b3f-000000000001','01000000-7e5d-4c1a-9b3f-000000000001','recover-outstanding','orderflow',
   'Recover outstanding invoices', '+R 420 000', 420000, 'high', 'in_progress',
   'R 1 900 000 sits in open invoices and R 420 000 of it is already past due.',
   'Statements went out to the eight June accounts on Monday; two have promised payment this week.',
   'Wanda Jacobs', '2026-08-07', 0),

  ('35000000-7e5d-4c1a-9b3f-000000000002','01000000-7e5d-4c1a-9b3f-000000000001','close-margin-gap','pricepilot',
   'Reprice the five below-target lines', '+R 68 400 / mo', 68400, 'high', 'open',
   'Realised gross margin is 38.2% against the 41% target — chicken, beef, lamb, line fish and fresh milk all sell below it.',
   null,
   'Zanele Dlamini', '2026-08-14', 1),

  ('35000000-7e5d-4c1a-9b3f-000000000003','01000000-7e5d-4c1a-9b3f-000000000001','absorb-oil-spike','procurepulse',
   'Re-source cooking oil after the 13% rise', '+R 31 200 / mo', 31200, 'high', 'in_progress',
   'Riebeek Oils & Fats moved cooking oil from R 566.00 to R 640.00 a case — +13.1% in one step.',
   'Two alternative quotes in; Boland Dry Goods can hold R 588.00 on a three-month commitment.',
   'Xolani Mahlangu', '2026-08-10', 2),

  ('35000000-7e5d-4c1a-9b3f-000000000004','01000000-7e5d-4c1a-9b3f-000000000001','cut-over-portioning','wastewatch',
   'Cut over-portioning on prepared lines', '+R 18 600 / mo', 18600, 'medium', 'open',
   'R 76 500 of waste logged in July — 2.4% of food cost — and twelve logged events ran over their recipe quantity.',
   null,
   'Nomsa Khumalo', '2026-08-21', 3),

  ('35000000-7e5d-4c1a-9b3f-000000000005','01000000-7e5d-4c1a-9b3f-000000000001','claim-open-credits','supplysync',
   'Chase the R 48 380 of open supplier credits', '+R 48 380', 48380, 'high', 'in_progress',
   'Six supplier claims are still sitting at claimed or acknowledged — R 48 380 in total, the oldest 38 days out.',
   'Winelands and Riebeek acknowledged verbally; waiting on credit notes.',
   'Yolanda Fortuin', '2026-08-05', 4),

  ('35000000-7e5d-4c1a-9b3f-000000000006','01000000-7e5d-4c1a-9b3f-000000000001','close-rebate-gap','supplysync',
   'Collect the R 57 000 rebate shortfall', '+R 57 000', 57000, 'medium', 'open',
   'Two rebate agreements are short of their expected accrual: R 33 000 on Boland Dry Goods and R 24 000 on Swartland Grain & Mill.',
   null,
   'Wanda Jacobs', '2026-08-28', 5),

  ('35000000-7e5d-4c1a-9b3f-000000000007','01000000-7e5d-4c1a-9b3f-000000000001','trim-overtime','shiftboard',
   'Rebalance the roster off overtime', '+R 14 200 / mo', 14200, 'medium', 'done',
   'Five people ran over their contracted hours in the week of 27 Jul, three more inside the near-overtime margin.',
   'Saturday cover moved to the casual pool from 3 August; two open shifts still to fill.',
   'Vusi Zwane', '2026-08-03', 6),

  ('35000000-7e5d-4c1a-9b3f-000000000008','01000000-7e5d-4c1a-9b3f-000000000001','file-missing-docs','docu',
   'File the four unmatched supplier documents', 'Cleaner forecast', 0, 'low', 'done',
   'Four Doc-U documents were still unmatched to a supplier at the June close.',
   'All four filed against Winelands, Riebeek and Overberg; the price observations now feed SupplySync.',
   'Zanele Dlamini', '2026-08-12', 7);

-- ===========================================================================
-- Domain (e) reconciliation — what these rows produce
-- ---------------------------------------------------------------------------
--   ww_waste_categories      6 rows      R 284 500 (fallback columns)
--   ww_devices               8 rows      6 online · 1 attention · 1 offline
--   ww_waste_events        336 rows      R 284 500 total
--       2026-04  76 rows  R 63 700    2026-05  72 rows  R 61 000
--       2026-06  98 rows  R 83 300    2026-07  90 rows  R 76 500
--       23–29 Jul R 25 000 vs 16–22 Jul R 17 900 = +39.7% (waste-spike warning)
--       preventable by cost R 124 863 = 43.9%
--       over-portion rows (expected_qty > 0 and qty > expected_qty) = 12
--   pw_budget_lines         14 rows     July plan  revenue 5 510 000 · costs 5 234 500 → net  275 500
--                                       June close revenue 5 860 000 · costs 5 454 800 → net  405 200
--   pw_goals                 5 rows
--   pw_forecast              4 rows     rev 5 510 000 · exp 5 234 500 ·
--                                       profit 275 500 · cash 1 860 000
--   pw_scenarios             3 rows
--   pw_decisions             8 rows     Σ impact_value R 657 780
-- ===========================================================================


-- ##########################################################################
-- ##  SECTION 3 — VERIFICATION
-- ##  Everything below is a COMMENT plus one final read-only SELECT. Nothing
-- ##  here writes. The figures were computed from this file's own INSERT
-- ##  values by re-implementing its arithmetic (see the note at the end).
-- ##########################################################################

-- ===========================================================================
-- VERIFICATION
-- ---------------------------------------------------------------------------
-- REVENUE BY MONTH — sum(of_order_items.qty * unit_price) over of_orders
-- with status in ('invoiced','paid'). This is the number PlanWise
-- (planwise-data.ts), ShiftBoard (shiftboard-data.ts), PricePilot and
-- InsightGen all independently recompute, so it has to be right.
--
--     month      revenue        orders    COGS           COGS %
--     ---------  ------------   ------    -----------    ------
--     2026-04     5,150,000      110      3,184,309    61.83%
--     2026-05     5,480,000      116      3,379,081    61.66%
--     2026-06     5,860,000      123      3,630,428    61.95%
--     2026-07     5,155,000      109      3,186,249    61.81%
--     ---------  ------------   ------    -----------    ------
--     TOTAL        21,645,000      458     13,380,067    61.82%
--
--   April, May and June are complete months and average R5,496,666 — the
--   R5.5M/month target. July is MONTH-TO-DATE (29 of 31 days, 25 of 26
--   trading days), which is why it reads lower; it paces to ~R5.51M.
--   Every month sits inside the required R5.1M-R5.9M band, and blended
--   COGS is 61.82% — inside the 60-64% the economics model calls for.
--
--   A further R1,560,000 of July pipeline (18 draft + 14 confirmed orders)
--   is DELIBERATELY excluded from every total above: it is the funnel,
--   not sales, and no module counts it as revenue.
--
-- ---------------------------------------------------------------------------
-- ROW COUNTS (Meridian-scoped rows this file inserts)
-- ---------------------------------------------------------------------------
--   cd_company_profile                  1   cd_contacts                        42
--   cd_customer_item_aliases            8   cd_delivery_addresses              28
--   cd_doc_templates                    3   cd_payment_terms                    4
--   cd_vat_rates                        2   document_folders                    6
--   documents                          34   ig_anomaly_acks                     2
--   ig_insights                        12   ig_report_runs                      6
--   ig_reports                          5   of_activity                        60
--   of_credit_note_items                6   of_credit_notes                     6
--   of_customers                       28   of_delivery_note_items            120
--   of_delivery_notes                  40   of_invoice_items                 1982
--   of_invoices                       458   of_order_items                   2130
--   of_orders                         490   of_payments                       426
--   of_quote_items                     18   of_quote_requests                   6
--   of_quotes                          18   of_settings                         1
--   pl_complaints                       9   pl_overrides                       53
--   pl_price_lists                      7   pl_targets                          1
--   pp_item_suppliers                  66   pp_movements                      256
--   pp_name_aliases                    16   pp_notifications                   12
--   pp_product_units                   32   pp_recipe_ingredients              75
--   pp_recipes                         18   pp_reorder_requests                 9
--   pp_settings                         1   pp_stock_items                     32
--   pp_stock_order_items               40   pp_stock_orders                    14
--   pp_stock_thresholds                32   procurepulse_activity_events       30
--   pw_budget_lines                    14   pw_decisions                        8
--   pw_forecast                         4   pw_goals                            5
--   pw_scenarios                        3   sb_attendance                      38
--   sb_departments                      8   sb_employees                       45
--   sb_leave_requests                  11   sb_roster_shifts                   45
--   sb_shift_swaps                      9   ss_supplier_contacts               28
--   ss_supplier_credits                12   ss_supplier_documents              38
--   ss_supplier_history                36   ss_supplier_pricing                58
--   ss_supplier_rebate_receipts         5   ss_supplier_rebates                 4
--   ss_supplier_risks                   8   ss_suppliers                       14
--   supplier_aliases                    9   suppliers                          14
--   ww_devices                          8   ww_waste_categories                 6
--   ww_waste_events                   336
--   TOTAL                            7411
--
--   plus 1 organisations row, 9 org_features rows and the single profiles
--   row for demo@vyso.co.za that this file re-points.
--
-- ---------------------------------------------------------------------------
-- FEATURE-TRIGGER QUOTAS (every one verified against this file's values)
-- ---------------------------------------------------------------------------
--   ss_supplier_credits unresolved (claimed|acknowledged)          6  (want 6)
--   ss_supplier_credits total                                     12  (want 12)
--   sb_shift_swaps                                                 9  (want 9)
--   sb_shift_swaps kind='cover'                                    2  (want >=2)
--   pw_decisions                                                   8  (want 8)
--   ig_report_runs                                                 6  (want 6)
--   ig_anomaly_acks                                                2  (want 2)
--   ig_insights                                                   12  (want 12)
--   ig_insights is_anomaly                                         3  (want >=3)
--   ww_waste_events over-portioned (expected_qty>0 and qty>expected)    12  (want 12)
--   ww_waste_events total                                        336  (want 336)
--   sb_employees hours_this_week > contracted_hours (OT risk)      5  (want 5)
--   ss_supplier_risks open/in_progress at high|critical            3  (want >=3)
--   ss_supplier_documents expiring|expired                         4  (want >=3)
--   pl_complaints open                                             3  (want 3)
--   pl_complaints investigating                                    3  (want 3)
--   pl_complaints resolved                                         3  (want 3)
--
-- ---------------------------------------------------------------------------
-- WASTE AS A % OF COGS (must land 1.5-2.5 for the economics to read true)
-- ---------------------------------------------------------------------------
--   2026-04   waste     63,700   cogs   3,184,309   2.00%
--   2026-05   waste     61,000   cogs   3,379,081   1.81%
--   2026-06   waste     83,300   cogs   3,630,428   2.29%
--   2026-07   waste     76,500   cogs   3,186,249   2.40%
--   total waste R284,500 over the four months
--
-- ---------------------------------------------------------------------------
-- HOW THESE NUMBERS WERE PRODUCED, AND HOW TO RE-CHECK THEM YOURSELF
-- ---------------------------------------------------------------------------
-- The order book is generated SQL, not a hand-typed VALUES list: each month
-- x segment has a planned total, each order takes a golden-ratio weight
-- inside a plausible band, and the group's last order absorbs the rounding
-- remainder. A final UPDATE rewrites ONE line per month x segment so the
-- realised sum equals the plan to the cent. The figures above were computed
-- by re-implementing that arithmetic exactly and evaluating it against this
-- file's own VALUES lists; the whole file also parses clean under the real
-- PostgreSQL grammar. Run the queries below after applying to confirm.
--
--   -- blended COGS %, must be 61.5-62.1
--   select round(100.0 * sum(i.qty * s.avg_unit_price) / sum(i.qty * i.unit_price), 2)
--   from of_orders o
--   join of_order_items i on i.order_id = o.id
--   join pp_stock_items s on s.id = i.stock_item_id
--   where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001' and o.status in ('invoiced','paid');
--
--   -- waste by month, must be 1.5-2.5% of the COGS above
--   select to_char(event_date, 'YYYY-MM'), round(sum(cost)) from ww_waste_events
--   where org_id = '01000000-7e5d-4c1a-9b3f-000000000001' group by 1 order by 1;
--
--   -- quotas
--   select count(*) from ss_supplier_credits where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--     and status in ('claimed','acknowledged');                              -- 6
--   select count(*) from sb_shift_swaps  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';  -- 9
--   select count(*) from pw_decisions    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';  -- 8
--   select count(*) from ig_report_runs  where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';  -- 6
--   select count(*) from ig_anomaly_acks where org_id = '01000000-7e5d-4c1a-9b3f-000000000001';  -- 2
--   select count(*) from ww_waste_events where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--     and expected_qty is not null and qty > expected_qty;                   -- 12
--   select count(*) from sb_employees    where org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
--     and hours_this_week > contracted_hours;                                -- 5
--
-- ---------------------------------------------------------------------------
-- ID-CONVENTION NOTE
-- ---------------------------------------------------------------------------
-- Every id is GG000000-7e5d-4c1a-9b3f-<12-digit counter>. The blueprint's
-- group table stops at 41; three tables needed a code beyond it and were
-- given one each: 42 cd_customer_item_aliases, 43 pp_notifications,
-- 44 supplier_aliases. pl_price_list_versions has no group of its own and
-- reuses group 15 in a reserved 9000000000xx band (900000000000 + list*10 +
-- version), which is disjoint from the 1..7 price-list counters.
--
-- CUSTOMER_TYPE NOTE: of_customers.customer_type is mapped onto the app's
-- CUSTOMER_TYPES constant (wholesale / hospitality / retail / other). The
-- segment-neutral internal labels (trade / events / counter / farm_gate)
-- live on `tags`, which is free text — putting them in customer_type would
-- render every customer as an em dash in Core Data and break the type filter.
-- ===========================================================================

-- Final, read-only: this is what the SQL editor will show when the script
-- finishes. Four rows, matching the table at the top of this section.
select to_char(o.created_at at time zone 'Africa/Johannesburg', 'YYYY-MM') as month,
       round(sum(i.qty * i.unit_price))                                as revenue,
       count(distinct o.id)                                            as orders
from of_orders o
join of_order_items i on i.order_id = o.id
where o.org_id = '01000000-7e5d-4c1a-9b3f-000000000001'
  and o.status in ('invoiced','paid')
group by 1 order by 1;
