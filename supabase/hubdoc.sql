-- ============================================================================
-- Vyso → Hubdoc cross-upload (Plugins X2)
--
-- Paste this entire file into the Supabase SQL editor. It is idempotent and can
-- be re-run safely. Requires supabase/xero-integration.sql and
-- supabase/xero-sync.sql to have been applied first — the Hubdoc card lives on
-- the Xero plugin page and the "not in Xero yet" list it sends from is built
-- from the mirror those files create.
--
-- WHAT THIS IS. Hubdoc has no public write API. Its supported intake is EMAIL:
-- every Hubdoc organisation has an "upload by email" address, and anything
-- posted to it lands in that org's inbox for coding into Xero. So Vyso's
-- cross-upload is an email with the original document attached, sent through
-- Resend — and these two tables are the address it goes to and the receipt that
-- it went.
--
-- THE PRODUCT RULE THIS SCHEMA ENFORCES: NOTHING SENDS ITSELF BY DEFAULT.
--   * `auto_forward` DEFAULTS TO FALSE and is the only thing that can make Vyso
--     send without a person clicking. It is a standing instruction an owner
--     gives, so the row records WHO set it and WHEN.
--   * `hubdoc_forwards` is written on every attempt, sent or failed, with what
--     triggered it. A forward that is not in this table did not happen; a
--     forward that is cannot be quietly un-remembered by the code that made it.
--
-- SECURITY MODEL, the same one supabase/xero-sync.sql uses and for the same
-- reason: a supplier invoice being pushed into the company's bookkeeping is
-- finance, not chrome.
--   * SELECT is OWNER/ADMIN ONLY — the database-level twin of `canSeeMoney`
--     (lib/platform/access.ts), which the routes and pages enforce on top.
--   * All writes are service-role. The auto-forward path runs inside `after()`
--     on an extraction request that ANY member may have made, so the write
--     cannot be gated on the caller's role without a member's upload silently
--     failing to honour an instruction their owner gave. The org id is pinned by
--     hand on every statement instead (lib/platform/hubdoc.ts).
-- ============================================================================


-- One row per organisation: where its Hubdoc inbox is, and whether Vyso has
-- standing permission to post to it.
--
-- `org_id` IS THE PRIMARY KEY, not a foreign key beside a surrogate one. An
-- organisation has exactly one Hubdoc inbox — a second row would be a second
-- answer to "where does this org's paperwork go", and there is no version of
-- that which is not a bug.
create table if not exists org_integrations_hubdoc (
  org_id uuid primary key references organisations(id) on delete cascade,
  -- The Hubdoc "upload by email" address. Nullable: an owner may switch the
  -- toggle's card open, read it, and leave without setting one. Every send path
  -- treats a null here as "not configured" and refuses rather than guessing.
  intake_email text,
  -- THE ONLY AUTOMATIC SEND IN THE PRODUCT, and it is off until an owner turns
  -- it on. See the note at the top of this file.
  auto_forward boolean not null default false,
  -- Who last changed either of the two facts above. This is a standing
  -- instruction about the company's money, so "somebody turned it on" is not an
  -- acceptable audit answer.
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);


-- One row per attempt to put a document into Hubdoc.
--
-- ATTEMPTS, NOT SUCCESSES. A failed send is written here too, with its error, so
-- the log on the plugin page answers "did this reach Hubdoc?" rather than "did
-- Vyso feel like recording something?". A silent failure would be the worst
-- outcome of the whole feature: the owner would believe the bill was filed.
create table if not exists hubdoc_forwards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  -- Denormalised on purpose. The log has to keep reading correctly after the
  -- org's Hubdoc address changes, and "we sent it to the address you have set
  -- today" would be a lie about a send that happened last month.
  intake_email text,
  subject text,
  sent_at timestamptz not null default now(),
  resend_message_id text,
  status text not null check (status in ('sent', 'failed')),
  error text,
  -- 'user' = somebody pressed a button. 'auto' = the standing instruction fired.
  triggered_by text not null check (triggered_by in ('user', 'auto')),
  -- True when this is a deliberate second send of a document Vyso has already
  -- put into Hubdoc. See the partial unique index below.
  resend boolean not null default false,
  -- Null for the auto path (no person made the request) and for a row written by
  -- a session whose user could not be resolved.
  created_by uuid references auth.users(id) on delete set null
);

-- A DOCUMENT IS FORWARDED ONCE — enforced, not merely intended.
--
-- The plan asked for `unique (document_id)` and for "Send again" to be an
-- explicit override that logs a second row. Both, literally, cannot be true. So
-- the constraint is narrowed to what the rule actually means: at most one
-- SUCCESSFUL, NON-RESEND forward per document. That makes the two things Vyso
-- must never do impossible at the database level — an auto-forward racing a
-- button cannot double-post a bill, and a doubled cron cannot either — while
-- still allowing the two things it must be able to do: retry a send that FAILED,
-- and honour an owner who explicitly asks for it again (`resend = true`, logged
-- as its own row, visible in the log as a resend).
create unique index if not exists hubdoc_forwards_one_per_document
  on hubdoc_forwards (document_id)
  where resend = false and status = 'sent';

-- The plugin page's log: this org's last 50, newest first.
create index if not exists idx_hubdoc_forwards_org_sent
  on hubdoc_forwards (org_id, sent_at desc);

-- "Has this document already gone?" — asked before every send and once per row
-- when the "not in Xero yet" list renders.
create index if not exists idx_hubdoc_forwards_document
  on hubdoc_forwards (document_id);


-- Maintain updated_at on the settings row without the application remembering.
create or replace function hubdoc_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists org_integrations_hubdoc_touch_updated_at on org_integrations_hubdoc;
create trigger org_integrations_hubdoc_touch_updated_at
  before update on org_integrations_hubdoc
  for each row execute function hubdoc_touch_updated_at();


alter table org_integrations_hubdoc enable row level security;
alter table hubdoc_forwards enable row level security;


-- OWNERS AND ADMINS ONLY — see the security note at the top of this file.
drop policy if exists org_integrations_hubdoc_admin_select on org_integrations_hubdoc;
create policy org_integrations_hubdoc_admin_select
  on org_integrations_hubdoc for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = org_integrations_hubdoc.org_id
        and p.role in ('owner', 'admin')
    )
  );

drop policy if exists hubdoc_forwards_admin_select on hubdoc_forwards;
create policy hubdoc_forwards_admin_select
  on hubdoc_forwards for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.org_id = hubdoc_forwards.org_id
        and p.role in ('owner', 'admin')
    )
  );


-- Explicit grants, so these rows stay unreachable from a browser client even if
-- project defaults change. SELECT only for authenticated (the policies above
-- then narrow it to owners/admins); every write is the service role's.
revoke all on table org_integrations_hubdoc from anon, authenticated;
revoke all on table hubdoc_forwards from anon, authenticated;

grant select on table org_integrations_hubdoc to authenticated;
grant select on table hubdoc_forwards to authenticated;

grant all on table org_integrations_hubdoc to service_role;
grant all on table hubdoc_forwards to service_role;
