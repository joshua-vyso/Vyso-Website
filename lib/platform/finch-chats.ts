/**
 * finch_chats / finch_messages — the read/write path behind Finch's persistent
 * conversations (supabase/finch-chats.sql, `.ai/plan_brief_chat_v2.md` §2.2).
 *
 * Four rules, the first two lifted straight from `agent-findings.ts` because
 * they are house rules, not table-specific ones.
 *
 * 1. EVERY QUERY RUNS AS THE CALLER. No `createServiceSupabase()` anywhere in
 *    this file. `org_id` (and, for chats, `user_id`) is filtered explicitly on
 *    top of RLS — belt and braces, so a policy regression cannot widen a read
 *    to another org's or another colleague's conversations.
 *
 *    Each function takes an OPTIONAL client. The default is
 *    `createServerSupabase()` (the cookie session, which is what a Server
 *    Component or a platform route has). `/api/ai/agent` passes its own client
 *    instead, because that route also accepts an `Authorization: Bearer` token
 *    from the mobile app and its `resolveUser()` client is the only one scoped
 *    to that caller. Same RLS either way; the difference is only where the
 *    session came from.
 *
 * 2. THE MIGRATION MAY NOT BE APPLIED YET. `supabase/*.sql` is pasted into the
 *    SQL editor by hand, so a deployed build legitimately runs ahead of the
 *    schema. `/app` is the landing page and its rail wants a chat list, so a
 *    missing relation becomes an empty, FLAGGED result — never a 500. The write
 *    paths degrade the same way: they answer `null`/`false` and the chat simply
 *    doesn't persist, which is exactly the behaviour the platform had last
 *    week. Every OTHER error still throws (reads) or is logged and reported as
 *    a failure (writes).
 *
 * 3. PERSISTENCE NEVER BREAKS A CONVERSATION. The writes here are called from
 *    the tail of a streaming route, after the user already has their answer on
 *    screen. A failed write is logged and swallowed; it must not surface in the
 *    stream, and it must not turn a good answer into an error banner.
 *
 * 4. THE DECISIONS LIVE NEXT DOOR. The 14-day recent/archived split, the
 *    "New chat" fallback and the prelude strip are pure functions in
 *    `finch-chats-shared.ts` so `node --test` can reach them without loading
 *    `next/headers`. They are re-exported below, so callers import from here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';
import { isMissingRelation } from './db-errors';
import { splitChats, type ChatSummary, type ChatSummaryRow } from './finch-chats-shared';

export * from './finch-chats-shared';

/** Any RLS-scoped client: the cookie session, or an /api/ai route's
 *  bearer-token client. Both are plain supabase-js clients at runtime. */
type ChatsClient = SupabaseClient;

/** One row of `finch_chats`. Mirrors the DDL in supabase/finch-chats.sql. */
export interface ChatRecord {
  id: string;
  org_id: string;
  user_id: string;
  /** Null until the first complete assistant reply is summarised. */
  title: string | null;
  module: string | null;
  finding_id: string | null;
  created_at: string;
  updated_at: string;
}

/** The documented shape of `finch_messages.content` (jsonb). `text` is the only
 *  required key — anything absent is "does not apply", never "unknown". */
export interface ChatMessageContent {
  text: string;
  attachments?: { document_id: string; filename: string }[];
  /** Tool names the assistant actually ran for this turn, in call order. */
  tools?: string[];
  suggestions?: string[];
}

/** One row of `finch_messages`, as the transcript draws it. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: ChatMessageContent;
  created_at: string;
}

/** A turn on its way in — the row's id and timestamp are the database's. */
export interface NewChatMessage {
  role: 'user' | 'assistant';
  content: ChatMessageContent;
}

export interface ChatList {
  recent: ChatSummary[];
  archived: ChatSummary[];
  /** True when finch_chats isn't in this database yet — the rail shows only
   *  "New chat" rather than an error. */
  tableMissing: boolean;
}

/** Explicit column lists rather than `*`: these rows cross the RSC boundary,
 *  so they should carry exactly the columns something draws. */
const CHAT_COLS = 'id, org_id, user_id, title, module, finding_id, created_at, updated_at';
const SUMMARY_COLS = 'id, title, module, finding_id, updated_at';
const MESSAGE_COLS = 'id, role, content, created_at';

/** A rail, not an archive. A user with more chats than this has a search
 *  problem, which is a later screen's job. */
const CHAT_LIST_LIMIT = 200;

/** A transcript, not a corpus. `sanitizeMessages` only sends the model the last
 *  30 turns anyway, so reading more than this would be display-only weight. */
const MESSAGE_LIMIT = 500;

const EMPTY_LIST: ChatList = { recent: [], archived: [], tableMissing: true };

async function client(supplied?: ChatsClient): Promise<ChatsClient> {
  return supplied ?? ((await createServerSupabase()) as unknown as ChatsClient);
}

/** Rule 3 — one place that decides what a swallowed write failure looks like. */
function logFailure(what: string, error: unknown): void {
  console.error(`[finch-chats] ${what} failed`, error);
}

/**
 * Narrow whatever came back in `content` to the documented shape.
 *
 * jsonb is unconstrained, so this is the boundary where a hand-edited or
 * future-shaped row becomes something the transcript can render. A row with no
 * usable text is dropped by the caller rather than drawn as an empty bubble.
 */
function normaliseContent(raw: unknown): ChatMessageContent | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const text = typeof obj.text === 'string' ? obj.text : '';
  if (!text.trim()) return null;

  const out: ChatMessageContent = { text };

  if (Array.isArray(obj.attachments)) {
    const attachments = obj.attachments
      .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
      .map((a) => ({ document_id: String(a.document_id ?? ''), filename: String(a.filename ?? '') }))
      .filter((a) => a.document_id);
    if (attachments.length) out.attachments = attachments;
  }
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : [];

  const tools = strings(obj.tools);
  if (tools.length) out.tools = tools;
  const suggestions = strings(obj.suggestions);
  if (suggestions.length) out.suggestions = suggestions;

  return out;
}

/**
 * This user's chats, split into the rail list and History by age.
 *
 * ONE query, partitioned in memory — same shape as `fetchFindings`. A user's
 * whole chat list is at most a couple of hundred rows, and asking Postgres
 * twice to apply a constant date predicate buys nothing.
 */
export async function listChats(
  orgId: string,
  userId: string,
  supplied?: ChatsClient,
): Promise<ChatList> {
  const supabase = await client(supplied);

  const { data, error } = await supabase
    .from('finch_chats')
    .select(SUMMARY_COLS)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(CHAT_LIST_LIMIT)
    .returns<ChatSummaryRow[]>();

  if (error) {
    // Rule 2 — the landing page renders before the migration is applied.
    if (isMissingRelation(error)) return EMPTY_LIST;
    throw error;
  }

  return { ...splitChats(data ?? []), tableMissing: false };
}

/**
 * One chat and its transcript, or null.
 *
 * Null covers three different situations on purpose — no such chat, someone
 * else's chat, and "the table isn't there yet" — because all three must look
 * identical from outside. The routes turn it into a 404: a caller must not be
 * able to tell an id that doesn't exist from one that belongs to a colleague.
 */
export async function getChat(
  orgId: string,
  userId: string,
  chatId: string,
  supplied?: ChatsClient,
): Promise<{ chat: ChatRecord; messages: ChatMessage[] } | null> {
  const supabase = await client(supplied);

  const { data: chat, error } = await supabase
    .from('finch_chats')
    .select(CHAT_COLS)
    .eq('id', chatId)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle<ChatRecord>();

  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }
  if (!chat) return null;

  const { data: rows, error: msgError } = await supabase
    .from('finch_messages')
    .select(MESSAGE_COLS)
    .eq('chat_id', chatId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })
    .limit(MESSAGE_LIMIT)
    .returns<{ id: string; role: string; content: unknown; created_at: string }[]>();

  if (msgError) {
    if (isMissingRelation(msgError)) return { chat, messages: [] };
    throw msgError;
  }

  const messages: ChatMessage[] = [];
  for (const row of rows ?? []) {
    if (row.role !== 'user' && row.role !== 'assistant') continue;
    const content = normaliseContent(row.content);
    if (!content) continue;
    messages.push({ id: row.id, role: row.role, content, created_at: row.created_at });
  }
  return { chat, messages };
}

/**
 * Start a conversation. Returns its id, or null when it could not be created —
 * the caller then streams without a `chatId` and the turn simply isn't stored,
 * which is the platform's behaviour up to this wave (plan §5, first bullet).
 *
 * `user_id` comes from the caller's session, never from a request body: RLS's
 * `with check` would reject anything else, and passing it explicitly means the
 * row is right rather than merely permitted.
 */
export async function createChat(
  orgId: string,
  userId: string,
  input: { module: string | null; findingId?: string | null; title?: string | null },
  supplied?: ChatsClient,
): Promise<string | null> {
  const supabase = await client(supplied);

  const { data, error } = await supabase
    .from('finch_chats')
    .insert({
      org_id: orgId,
      user_id: userId,
      module: input.module,
      finding_id: input.findingId ?? null,
      title: input.title ?? null,
    })
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    if (!isMissingRelation(error)) logFailure('createChat', error);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Append turns to a chat and bump its `updated_at` (which is what orders the
 * rail, and what the 14-day archive rule reads).
 *
 * Messages first, then the bump: if the second write fails the transcript is
 * still complete and only the chat's position in the list is stale, which the
 * next turn corrects. The reverse order could leave a chat claiming activity it
 * has no record of.
 *
 * `org_id` is written onto each message from the caller's resolved org, not
 * copied from the chat row, so a message can only ever be filed under the org
 * the session is actually in.
 */
export async function appendMessages(
  chatId: string,
  orgId: string,
  messages: NewChatMessage[],
  supplied?: ChatsClient,
): Promise<boolean> {
  if (messages.length === 0) return true;
  const supabase = await client(supplied);

  const { error } = await supabase.from('finch_messages').insert(
    messages.map((m) => ({
      chat_id: chatId,
      org_id: orgId,
      role: m.role,
      content: m.content,
    })),
  );

  if (error) {
    if (!isMissingRelation(error)) logFailure('appendMessages', error);
    return false;
  }

  const { error: bumpError } = await supabase
    .from('finch_chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId)
    .eq('org_id', orgId);

  if (bumpError && !isMissingRelation(bumpError)) logFailure('appendMessages (updated_at bump)', bumpError);
  return true;
}

/**
 * Name a chat. Called once per chat, from the agent route's `after()` callback
 * on the first completed exchange.
 *
 * `is('title', null)` makes it a no-op if something else got there first —
 * two tabs answering into the same chat at once would otherwise race, and a
 * title that flickers between two summaries of the same conversation is worse
 * than the first one sticking.
 */
export async function setChatTitle(
  chatId: string,
  orgId: string,
  title: string,
  supplied?: ChatsClient,
): Promise<boolean> {
  const clean = title.trim();
  if (!clean) return false;
  const supabase = await client(supplied);

  const { error } = await supabase
    .from('finch_chats')
    .update({ title: clean })
    .eq('id', chatId)
    .eq('org_id', orgId)
    .is('title', null);

  if (error) {
    if (!isMissingRelation(error)) logFailure('setChatTitle', error);
    return false;
  }
  return true;
}

/**
 * Does this chat belong to the caller? The agent route's ownership check —
 * it needs the chat's `title` (to decide whether to generate one) but not its
 * transcript, so this is deliberately not `getChat`.
 *
 * The `tableMissing` flag is the reason this returns an object rather than
 * `ChatRecord | null`: the route must answer 404 for "not yours" and carry on
 * streaming (unpersisted) for "no such table", and it cannot tell those apart
 * from a bare null.
 */
export async function getChatForOwner(
  orgId: string,
  userId: string,
  chatId: string,
  supplied?: ChatsClient,
): Promise<{ chat: ChatRecord | null; tableMissing: boolean }> {
  const supabase = await client(supplied);

  const { data, error } = await supabase
    .from('finch_chats')
    .select(CHAT_COLS)
    .eq('id', chatId)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle<ChatRecord>();

  if (error) {
    if (isMissingRelation(error)) return { chat: null, tableMissing: true };
    logFailure('getChatForOwner', error);
    return { chat: null, tableMissing: false };
  }
  return { chat: data ?? null, tableMissing: false };
}
