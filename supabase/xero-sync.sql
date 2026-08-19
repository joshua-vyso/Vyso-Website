-- ============================================================================
-- Vyso Xero mirror (Plugins X1)
--
-- Paste this entire file into the Supabase SQL editor. It is idempotent and can
-- be re-run safely. Requires supabase/xero-integration.sql to have been applied
-- first — the cursor table and the connection it hangs off live there.
--
-- WHAT THIS IS. A read-only local copy of the invoices and contacts Vyso has
-- read out of Xero. Nothing here is authoritative: Xero owns these rows, the
-- nightly sync overwrites them, and no part of Vyso writes back to Xero. The
-- mirror exists so the plugin page, Finch and the Xero Watch agent can ask
-- questions of an accounting ledger without three of them each holding an API
-- token and a rate limit.
--
-- SECURITY MODEL, which differs from every other module table here:
--   * These rows ARE the company's money — every receivable, every supplier
--     bill. So the select policy is OWNER/ADMIN ONLY, not org-member. It is the
--     database-level twin of `canSeeMoney` (lib/platform/access.ts), which the
--     routes and pages enforce on top.
--   * All writes are service-role. The sync has no session for RLS to key off,
--     so it filters `org_id` by hand on every statement; nothing else writes
--     here at all.
-- ============================================================================


-- One row per Xero invoice, per Vyso organisation.
--
-- `xero_invoice_id` is Xero's own guid, kept as TEXT rather than UUID: it is an
-- identifier from another system, and the day Xero returns something that is not
-- a uuid a type error inside a cron is a worse outcome than a wide column.
create table if not exists xero_invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  xero_invoice_id text not null,
  -- The two ledgers Vyso mirrors: money owed TO the business, money it owes.
  type text not null check (type in ('ACCREC', 'ACCPAY')),
  contact_id text,
  contact_name text,
  invoice_number text,
  reference text,
  date date,
  due_date date,
  currency text,
  total numeric,
  amount_due numeric,
  amount_paid numeric,
  -- Free text, deliberately: Xero's status vocabulary is Xero's to change, and a
  -- check constraint here would fail a nightly sync rather than store a row the
  -- product can simply ignore. The sync only ever writes DRAFT/SUBMITTED/
  -- AUTHORISED/PAID (lib/platform/xero-sync-shared.ts).
  status text,
  updated_date_utc timestamptz,
  xero_url text,
  synced_at timestamptz not null default now(),
  -- ONE row per invoice per org. This is what makes the sync idempotent: every
  -- page upserts on it, so a re-run, a doubled cron or a manual "Sync now" in
  -- the middle of the nightly one all converge instead of duplicating.
  unique (org_id, xero_invoice_id)
);

-- The agent's four money rules all read (org, type, status) and then a date.
create index if not exists idx_xero_invoices_org_type_status
  on xero_invoices (org_id, type, status);

create index if not exists idx_xero_invoices_org_due
  on xero_invoices (org_id, due_date);

-- "Is this Doc-U invoice already in Xero?" is a lookup by number within one org.
create index if not exists idx_xero_invoices_org_number
  on xero_invoices (org_id, invoice_number);


-- One row per Xero contact, per Vyso organisation. Suppliers and customers share
-- the table because Xero does: a contact carries both flags and plenty carry
-- both at once.
create table if not exists xero_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  xero_contact_id text not null,
  name text,
  email text,
  is_supplier boolean not null default false,
  is_customer boolean not null default false,
  updated_date_utc timestamptz,
  synced_at timestamptz not null default now(),
  unique (org_id, xero_contact_id)
);

create index if not exists idx_xero_contacts_org_name
  on xero_contacts (org_id, name);


-- Maintain synced_at on every upsert without the application having to remember.
-- Reuses xero_touch_updated_at()'s sibling rather than that function itself,
-- because these tables carry `synced_at` (when Vyso last READ the row from Xero)
-- and not `updated_at` (when a Vyso user last changed it) — they are different
-- facts and only one of them is true here.
create or replace function xero_touch_synced_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.synced_at = now();
  return new;
end;
$$;

drop trigger if exists xero_invoices_touch_synced_at on xero_invoices;
create trigger xero_invoices_touch_synced_at
  before update on xero_invoices
  for each row execute function xero_touch_synced_at();

drop trigger if exists xero_contacts_touch_synced_at on xero_contacts;
create trigger xero_contacts_touch_synced_at
  before update on xero_contacts
  for each row execute function xero_touch_synced_at();


alter table xero_invoices enable row level security;
alter table xero_contacts enable row level security;


-- OWNERS AND ADMINS ONLY — see the security note at the top of this file. Note
-- this is STRICTER than xero_connections' member-select policy, and deliberately
-- so: a member may see that Xero is connected (it is chrome), never what is in
-- it (it is money).
drop policy if exists xero_invoices_admin_select on xero_invoices;
create policy xero_invoices_admin_select
  on xero_invoices for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = xero_invoices.org_id
        and p.role in ('owner', 'admin')
    )
  );

drop policy if exists xero_contacts_admin_select on xero_contacts;
create policy xero_contacts_admin_select
  on xero_contacts for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = xero_contacts.org_id
        and p.role in ('owner', 'admin')
    )
  );


-- Explicit grants, so these rows stay unreachable from a browser client even if
-- project defaults change. SELECT only for authenticated (the policy above then
-- narrows it to owners/admins); everything else is the service role's.
revoke all on table xero_invoices from anon, authenticated;
revoke all on table xero_contacts from anon, authenticated;

grant select on table xero_invoices to authenticated;
grant select on table xero_contacts to authenticated;

grant all on table xero_invoices to service_role;
grant all on table xero_contacts to service_role;
