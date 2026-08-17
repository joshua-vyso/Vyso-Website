-- ============================================================================
-- Finch chats — persistent conversations for the platform's assistant.
-- ----------------------------------------------------------------------------
-- Until now Finch's transcript lived in ONE piece of React state
-- (components/platform/shell/FinchChatProvider.tsx) and died with the tab. This
-- migration gives a conversation a row, so it survives a reload, can be
-- re-opened from the rail, and can be started from a finding.
--
--   finch_chats     -- one conversation. Private to the user who started it.
--   finch_messages  -- its turns, oldest first, one row per user/assistant turn.
--
-- FOUR decisions are baked into the DDL below; each is here because the
-- alternative was worse.
--
-- 1. OWNER-SCOPED, NOT JUST ORG-SCOPED. Every other table in this database is
--    RLS'd on org alone (`org_id = (select p.org_id from profiles p where
--    p.id = auth.uid())`) because operational data belongs to the business. A
--    chat does not: it is what one person asked, in their own words, including
--    the half-formed questions they would not put in front of a colleague.
--    Both policies below therefore carry `and user_id = auth.uid()`. `org_id`
--    is still on the row (and still filtered) so a future org-admin export, a
--    retention job or a service-role sweep has the tenant key it needs without
--    a join.
--
-- 2. MESSAGE CONTENT IS jsonb, NOT text. A turn is not only its words: a user
--    turn can cite uploaded documents, and an assistant turn can record which
--    tools it ran and which follow-ups it offered. Those are display data that
--    grows wave by wave (attachments in W5, suggestions after that), and a
--    column per shape would mean a migration per wave. One `content` object
--    with a documented shape absorbs them:
--      { text: string,
--        attachments?: [{ document_id: uuid, filename: text }],
--        tools?: [text],          -- tool names the assistant used for this turn
--        suggestions?: [text] }
--    `text` is the only required key; everything else is absent when it does
--    not apply, so a reader can never mistake "none" for "unknown".
--
-- 3. ARCHIVING IS A READ-TIME RULE, NOT A COLUMN. A chat is "recent" iff
--    `updated_at >= now() - interval '14 days'`, otherwise it lists under
--    History. That is computed in lib/platform/finch-chats-shared.ts
--    (`splitChats`) on rows the rail already fetched — no cron, no status
--    column to drift, and changing the window is a constant, not a migration.
--    `archived_at` exists for a LATER explicit "archive this chat" action; v1
--    never writes it, and nothing reads it. It is here rather than in a second
--    migration because adding a nullable column to a table that already has
--    rows is the one thing `create table if not exists` cannot do for you.
--
-- 4. NO `finch_messages.user_id`. A message's owner is its chat's owner, and
--    duplicating it would create a second source of truth that RLS would have
--    to keep honest. The message policy reaches through to `finch_chats`
--    instead — one exists() per statement, on an indexed primary key.
--
-- Writes come from the SIGNED-IN user's own RLS-scoped client (the API routes
-- under app/api/finch/chats and the persistence tail of app/api/ai/agent), not
-- from a service-role client. That is the opposite of agents-price-watch.sql,
-- where the cron has no session and org scoping is manual: here RLS is the
-- primary control, and the explicit `.eq('org_id', …)` in the data module is
-- the belt-and-braces on top of it.
--
-- PREREQUISITE: organisations, profiles (core schema) and agent_findings
-- (supabase/agents-price-watch.sql) must already exist.
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
  if to_regclass('public.agent_findings') is null then
    raise exception using
      message = 'agent_findings is missing.',
      hint = 'Run supabase/agents-price-watch.sql first — finch_chats.finding_id references it, so a chat can be opened from a finding.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- One conversation.
--
-- `title` is null until the first complete assistant reply, at which point the
-- agent route generates a ≤6-word summary on the Haiku tier inside `after()`
-- (app/api/ai/agent/route.ts). Null is meaningful, not missing: the UI shows
-- "New chat" for it, and the route uses it as the "does this chat still need a
-- title?" flag, so a title is generated exactly once per chat.
--
-- `module` records the surface the chat STARTED on ('brief' from The Brief's
-- dock, otherwise the module key). It is context, not a constraint — it picks
-- the agent's tool set for the first turn and labels the chat in the rail. Left
-- as free text rather than an enum for the same reason agent_findings.agent is:
-- a new module must not need a migration to be able to talk.
--
-- `finding_id` is `on delete set null`, NOT cascade: if the finding a chat grew
-- out of is deleted, the conversation about it is still the user's and still
-- readable — it just loses its back-link.
-- ---------------------------------------------------------------------------
create table if not exists finch_chats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,                                  -- null until the first assistant reply
  module text,                                 -- 'brief' | module key; the context the chat started in
  finding_id uuid references agent_findings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz                      -- reserved for an explicit archive action; v1 archives by age at read time
);

-- Upgrades a database that ran an earlier draft of this file — `create table
-- if not exists` does not add columns to an existing table (same pattern as
-- supabase/docu-review-columns.sql and pw_price_points.line_supplier).
alter table finch_chats
  add column if not exists archived_at timestamptz;

-- ---------------------------------------------------------------------------
-- Its turns. Written in one batch per completed exchange (user turn +
-- assistant turn together), so a half-streamed answer never lands: the agent
-- route persists the user's message always and the assistant's only when the
-- stream ran to completion.
--
-- `org_id` is denormalised onto the message so a tenant-wide read (export,
-- retention, deletion request) never has to join through finch_chats. The
-- policy below still proves ownership through the parent chat, so the two can
-- never disagree about who may read the row.
-- ---------------------------------------------------------------------------
create table if not exists finch_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references finch_chats(id) on delete cascade,
  org_id uuid not null references organisations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,                      -- { text, attachments?, tools?, suggestions? } — see note 2 above
  created_at timestamptz not null default now()
);

-- The rail's query, exactly: this user's chats in this org, newest activity
-- first. `updated_at desc` is in the index so the list is an index-only walk
-- rather than a sort over every chat the user has ever had.
create index if not exists idx_finch_chats_user
  on finch_chats (org_id, user_id, updated_at desc);

-- Finding → its chats, for the "you already asked about this" affordance on a
-- finding detail page. Partial: the vast majority of chats carry no finding,
-- and indexing their nulls would be pure write cost.
create index if not exists idx_finch_chats_finding
  on finch_chats (finding_id)
  where finding_id is not null;

-- A transcript is always read whole, oldest first — this is that read.
create index if not exists idx_finch_messages_chat
  on finch_messages (chat_id, created_at);

-- ---------------------------------------------------------------------------
-- Row level security — org AND owner scoped (note 1 above). A chat is private
-- to the person who started it; not even an owner/admin of the same org can
-- read it through the API.
-- ---------------------------------------------------------------------------
alter table finch_chats    enable row level security;
alter table finch_messages enable row level security;

drop policy if exists finch_chats_all on finch_chats;
create policy finch_chats_all on finch_chats for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and user_id = auth.uid()
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and user_id = auth.uid()
  );

-- Reaches through to the parent chat rather than trusting finch_messages.org_id
-- on its own: the denormalised column is a convenience for tenant-wide jobs, and
-- a row whose org_id disagreed with its chat's must not become readable because
-- of it. The org check is kept alongside the ownership check so a message can
-- never be written into another tenant's namespace.
drop policy if exists finch_messages_all on finch_messages;
create policy finch_messages_all on finch_messages for all
  using (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and exists (
      select 1 from finch_chats c
      where c.id = finch_messages.chat_id
        and c.user_id = auth.uid()
        and c.org_id = finch_messages.org_id
    )
  )
  with check (
    org_id = (select p.org_id from profiles p where p.id = auth.uid())
    and exists (
      select 1 from finch_chats c
      where c.id = finch_messages.chat_id
        and c.user_id = auth.uid()
        and c.org_id = finch_messages.org_id
    )
  );
