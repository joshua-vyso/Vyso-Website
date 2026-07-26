-- ============================================================================
-- Vyso Xero integration
--
-- Paste this entire file into the Supabase SQL editor. It is idempotent.
--
-- Security model:
--   * Authenticated organisation members may read non-secret connection status.
--   * Authorisations, OAuth tokens, OAuth state, mappings, cursors, and sync
--     events are available only to server routes using the service-role client.
--   * Tokens are encrypted by the application before they reach Postgres.
-- ============================================================================


-- Tokens belong to a Xero user + app authorisation, not to an individual tenant.
-- One authorisation may therefore back multiple Xero organisation connections.
create table if not exists xero_authorisations (
  id uuid primary key default gen_random_uuid(),
  connected_by_user_id uuid references auth.users(id) on delete set null,
  xero_user_id uuid not null unique,
  scopes text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'error', 'reauth_required', 'revoked')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- One Xero organisation connection per Vyso organisation.
create table if not exists xero_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references organisations(id) on delete cascade,
  authorisation_id uuid not null references xero_authorisations(id) on delete cascade,
  connected_by_user_id uuid references auth.users(id) on delete set null,
  xero_tenant_id uuid not null unique,
  xero_connection_id uuid not null unique,
  tenant_name text not null,
  tenant_type text not null default 'ORGANISATION'
    check (tenant_type in ('ORGANISATION')),
  status text not null default 'connected'
    check (status in ('connected', 'syncing', 'error', 'reauth_required', 'disconnected')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);

create index if not exists idx_xero_connections_org_status
  on xero_connections (org_id, status);


-- Secret material is split from browser-visible connection metadata.
-- encrypted_* values must be AES-GCM ciphertext produced by the server.
create table if not exists xero_credentials (
  authorisation_id uuid primary key references xero_authorisations(id) on delete cascade,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  token_version bigint not null default 1 check (token_version > 0),
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_xero_credentials_refresh_expiry
  on xero_credentials (refresh_token_expires_at);


-- Short-lived, single-use CSRF state for the OAuth callback.
-- Store only a SHA-256 hash of the state value sent to Xero.
create table if not exists xero_oauth_states (
  state_hash text primary key,
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_path text not null default '/app',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_xero_oauth_states_expiry
  on xero_oauth_states (expires_at)
  where consumed_at is null;


-- Stable local-to-Xero identifiers prevent duplicate contacts, invoices, and
-- payments. entity_type remains text so additional Xero resources can be added
-- without a schema migration.
create table if not exists xero_entity_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  connection_id uuid not null,
  entity_type text not null check (char_length(entity_type) between 1 and 64),
  local_entity_id uuid not null,
  xero_entity_id uuid not null,
  local_version_hash text,
  xero_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, org_id)
    references xero_connections(id, org_id) on delete cascade,
  unique (connection_id, entity_type, local_entity_id),
  unique (connection_id, entity_type, xero_entity_id)
);

create index if not exists idx_xero_entity_mappings_local
  on xero_entity_mappings (org_id, entity_type, local_entity_id);

create index if not exists idx_xero_entity_mappings_xero
  on xero_entity_mappings (org_id, entity_type, xero_entity_id);


-- A separate incremental cursor per resource prevents an invoice sync from
-- advancing the contacts or payments cursor.
create table if not exists xero_sync_cursors (
  org_id uuid not null,
  connection_id uuid not null,
  entity_type text not null check (char_length(entity_type) between 1 and 64),
  modified_since timestamptz,
  last_success_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (connection_id, entity_type),
  foreign key (connection_id, org_id)
    references xero_connections(id, org_id) on delete cascade
);


-- Queue/audit records. idempotency_key prevents a retried export or replayed
-- webhook from applying the same change twice.
create table if not exists xero_sync_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  connection_id uuid not null,
  idempotency_key text not null,
  source text not null
    check (source in ('initial', 'manual', 'scheduled', 'webhook', 'export')),
  direction text not null
    check (direction in ('inbound', 'outbound')),
  entity_type text check (entity_type is null or char_length(entity_type) between 1 and 64),
  local_entity_id uuid,
  xero_entity_id uuid,
  action text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed', 'skipped')),
  attempt_count int not null default 0 check (attempt_count >= 0),
  metadata jsonb not null default '{}',
  error_message text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, org_id)
    references xero_connections(id, org_id) on delete cascade,
  unique (connection_id, idempotency_key)
);

create index if not exists idx_xero_sync_events_queue
  on xero_sync_events (status, queued_at)
  where status in ('queued', 'failed');

create index if not exists idx_xero_sync_events_org_created
  on xero_sync_events (org_id, created_at desc);


-- Maintain updated_at consistently when server routes update integration rows.
create or replace function xero_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists xero_connections_touch_updated_at on xero_connections;
create trigger xero_connections_touch_updated_at
  before update on xero_connections
  for each row execute function xero_touch_updated_at();

drop trigger if exists xero_authorisations_touch_updated_at on xero_authorisations;
create trigger xero_authorisations_touch_updated_at
  before update on xero_authorisations
  for each row execute function xero_touch_updated_at();

drop trigger if exists xero_credentials_touch_updated_at on xero_credentials;
create trigger xero_credentials_touch_updated_at
  before update on xero_credentials
  for each row execute function xero_touch_updated_at();

drop trigger if exists xero_entity_mappings_touch_updated_at on xero_entity_mappings;
create trigger xero_entity_mappings_touch_updated_at
  before update on xero_entity_mappings
  for each row execute function xero_touch_updated_at();

drop trigger if exists xero_sync_cursors_touch_updated_at on xero_sync_cursors;
create trigger xero_sync_cursors_touch_updated_at
  before update on xero_sync_cursors
  for each row execute function xero_touch_updated_at();

drop trigger if exists xero_sync_events_touch_updated_at on xero_sync_events;
create trigger xero_sync_events_touch_updated_at
  before update on xero_sync_events
  for each row execute function xero_touch_updated_at();


alter table xero_authorisations    enable row level security;
alter table xero_connections     enable row level security;
alter table xero_credentials     enable row level security;
alter table xero_oauth_states    enable row level security;
alter table xero_entity_mappings enable row level security;
alter table xero_sync_cursors    enable row level security;
alter table xero_sync_events     enable row level security;


-- Organisation members may display connection name/status in the product.
-- All mutations still pass through authenticated server routes.
drop policy if exists xero_connections_member_select on xero_connections;
create policy xero_connections_member_select
  on xero_connections for select
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
  );


-- Explicit grants ensure secrets and operational integration state never become
-- accessible through a browser Supabase client if project defaults change.
revoke all on table xero_connections from anon, authenticated;
grant select on table xero_connections to authenticated;

revoke all on table xero_authorisations from anon, authenticated;
revoke all on table xero_credentials from anon, authenticated;
revoke all on table xero_oauth_states from anon, authenticated;
revoke all on table xero_entity_mappings from anon, authenticated;
revoke all on table xero_sync_cursors from anon, authenticated;
revoke all on table xero_sync_events from anon, authenticated;

grant all on table xero_authorisations to service_role;
grant all on table xero_connections to service_role;
grant all on table xero_credentials to service_role;
grant all on table xero_oauth_states to service_role;
grant all on table xero_entity_mappings to service_role;
grant all on table xero_sync_cursors to service_role;
grant all on table xero_sync_events to service_role;
