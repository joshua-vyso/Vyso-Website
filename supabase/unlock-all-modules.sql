-- ============================================================================
-- Unlock every module for every org (2026-08-24)
-- ----------------------------------------------------------------------------
-- Focus shifted from OrderFlow to ProcurePulse; modules are no longer
-- pay-gated. Every org — existing and future — gets every module.
--
-- `locked_modules` is NOT removed: it stays as dormant kill-switch plumbing
-- (useful for abuse/offboarding later — data-driven, so empty data means
-- nothing is locked). This migration just makes sure nothing is ever
-- populated into it by default again: existing rows are cleared, and the
-- two onboarding RPCs that used to compute a locked set now always write
-- `'{}'`.
--
-- HOW TO APPLY: paste into the Supabase dashboard SQL editor and run once, in
-- the SAME project the app points at (NEXT_PUBLIC_SUPABASE_URL). Idempotent —
-- safe to re-paste; every statement below is a plain UPDATE or CREATE OR
-- REPLACE.
-- ============================================================================

-- ── Clear every existing org's locks ────────────────────────────────────────
-- One-shot fix for orgs that already exist (including ones mid-onboarding —
-- if they later hit onboarding_choose_modules below, the new body keeps them
-- unlocked, so there's no stuck state either way).
update public.organisations set locked_modules = '{}';

-- ── RPC 1: create the org for the signing-up user (onboarding stage 1) ──────
-- Same as supabase/onboarding.sql, except the org is now seeded fully
-- unlocked instead of "everything except Doc-U" — there is no stage-2 module
-- choice left to gate on.
create or replace function onboarding_create_org(
  p_org_name text,
  p_industry text,
  p_employee_count text,
  p_full_name text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_existing_org uuid;
  v_org_id       uuid;
  v_base_slug    text;
  v_slug         text;
  v_suffix       int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Idempotent: caller already belongs to an org → return it, change nothing.
  select org_id into v_existing_org from profiles where id = v_uid;
  if v_existing_org is not null then
    return v_existing_org;
  end if;

  -- Unique slug derived from the company name (fallback 'org').
  v_base_slug := nullif(
    trim(both '-' from regexp_replace(lower(coalesce(p_org_name, '')), '[^a-z0-9]+', '-', 'g')),
    ''
  );
  if v_base_slug is null then
    v_base_slug := 'org';
  end if;
  v_slug := v_base_slug;
  while exists (select 1 from organisations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into organisations (
    name, slug, tier, locked_modules,
    industry, employee_count,
    trial_started_at, trial_ends_at, onboarding_stage
  ) values (
    coalesce(nullif(trim(p_org_name), ''), 'My company'),
    v_slug,
    'start',
    -- No pay-gating: nothing is locked, ever. locked_modules stays as
    -- dormant kill-switch plumbing rather than being dropped, in case it's
    -- needed later for abuse/offboarding.
    '{}',
    nullif(trim(coalesce(p_industry, '')), ''),
    nullif(trim(coalesce(p_employee_count, '')), ''),
    now(),
    now() + interval '14 days',
    'modules'
  )
  returning id into v_org_id;

  -- The caller becomes owner of the new org.
  insert into profiles (id, org_id, full_name, role)
  values (v_uid, v_org_id, nullif(trim(coalesce(p_full_name, '')), ''), 'owner')
  on conflict (id) do update
    set org_id    = excluded.org_id,
        full_name = coalesce(excluded.full_name, profiles.full_name),
        role      = 'owner';

  -- Seed every module feature row enabled (future-proof; gating is via
  -- locked_modules today). where-not-exists rather than on-conflict so it does
  -- not depend on a (org_id, feature_key) unique constraint existing.
  insert into org_features (org_id, feature_key, enabled)
  select v_org_id, f.k, true
  from unnest(array[
    'docu','procurepulse','pricepilot','marginview','wastelog',
    'shiftboard','suppliers','reportgen','orderflow'
  ]) as f(k)
  where not exists (
    select 1 from org_features e where e.org_id = v_org_id and e.feature_key = f.k
  );

  return v_org_id;
end;
$$;

grant execute on function onboarding_create_org(text, text, text, text) to authenticated;

-- ── RPC 2: record the module choice (onboarding stage 2) ────────────────────
-- Signature and p_modules validation (exactly 3 distinct valid non-docu keys)
-- are unchanged on purpose — the onboarding UI still calls this RPC the same
-- way, so this stays a drop-in replace with no client-side contract change.
-- The only behavioural difference: locked_modules is now always '{}' instead
-- of "the 5 keys the caller didn't pick". The chosen list itself is simply
-- discarded (no schema change needed to keep recording it).
create or replace function onboarding_choose_modules(p_modules text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_org_id    uuid;
  v_role      text;
  v_completed timestamptz;
  v_valid     text[] := array[
    'procurepulse','pricepilot','marginview','wastelog',
    'shiftboard','suppliers','reportgen','orderflow'
  ];
  m text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.org_id, p.role into v_org_id, v_role from profiles p where p.id = v_uid;
  if v_org_id is null then
    raise exception 'caller has no organisation';
  end if;
  if v_role is distinct from 'owner' then
    raise exception 'only the owner can choose modules';
  end if;

  select onboarding_completed_at into v_completed from organisations where id = v_org_id;
  if v_completed is not null then
    raise exception 'onboarding already completed';
  end if;

  -- Exactly 3, distinct, valid, none = 'docu'.
  if array_length(p_modules, 1) is distinct from 3 then
    raise exception 'exactly 3 modules must be chosen';
  end if;
  if (select count(distinct x) from unnest(p_modules) x) <> 3 then
    raise exception 'chosen modules must be distinct';
  end if;
  foreach m in array p_modules loop
    if m = 'docu' or not (m = any(v_valid)) then
      raise exception 'invalid module key: %', m;
    end if;
  end loop;

  -- No pay-gating: nothing is ever locked, regardless of what was chosen.
  -- locked_modules stays as dormant kill-switch plumbing rather than being
  -- dropped, in case it's needed later for abuse/offboarding.
  update organisations
     set locked_modules   = '{}',
         onboarding_stage = 'data'
   where id = v_org_id;
end;
$$;

grant execute on function onboarding_choose_modules(text[]) to authenticated;

-- ── Verify ───────────────────────────────────────────────────────────────
-- select id, name, locked_modules from public.organisations;
-- expect locked_modules = '{}' for every row.
