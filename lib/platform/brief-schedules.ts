/**
 * brief_schedules — the read/write path behind "when do you want your brief?"
 * (supabase/brief-schedules.sql, `.ai/plan_brief_schedules.md` §3).
 *
 * Three rules, the first two lifted straight from `finch-chats.ts` because they
 * are house rules, not table-specific ones.
 *
 * 1. EVERY QUERY RUNS AS THE CALLER. No `createServiceSupabase()` anywhere in
 *    this file — that client belongs to the cron, which has no session for RLS
 *    to key off, and a settings route has no such excuse. `org_id` AND
 *    `user_id` are filtered explicitly on top of RLS, so a policy regression
 *    cannot widen a read to another org's rows or a colleague's preferences.
 *
 * 2. THE MIGRATION MAY NOT BE APPLIED YET. `supabase/*.sql` is pasted into the
 *    SQL editor by hand, so a deployed build legitimately runs ahead of the
 *    schema. `/app/settings` must render regardless, so a missing relation
 *    becomes an empty, FLAGGED result and the card explains itself instead of
 *    500-ing the whole settings page. Every other error still surfaces.
 *
 * 3. A SAVE PRESERVES ROW IDENTITY. The API's contract is replace-all — the PUT
 *    body is the complete list of the user's slots — but this module does NOT
 *    implement that as delete-everything-then-insert, and the difference
 *    matters: `brief_deliveries.schedule_id` cascades, so wiping the schedules
 *    on every Save would silently destroy the delivery history that the "since
 *    your last brief" block reads and that stops a slot re-sending. So rows the
 *    body still names by id are UPDATED in place, rows it does not are deleted,
 *    and only genuinely new slots are inserted. Editing 07:00 to 07:15 keeps
 *    its history; deleting the slot outright is the only thing that discards it,
 *    which is what deleting it should mean.
 *
 * The decisions — what a valid slot is, when one is due, what the defaults are —
 * are pure and live next door in `brief-schedules-shared.ts`, where
 * `node --test` can reach them without loading `next/headers`. They are
 * re-exported below, so callers have one import site.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerSupabase } from './supabase-server';
import { isMissingRelation } from './db-errors';
import {
  BRIEF_TIMEZONE,
  formatLocalTime,
  parseLocalTime,
  type BriefSlot,
  type BriefSlotKind,
} from './brief-schedules-shared';

export * from './brief-schedules-shared';

/** Any RLS-scoped client: the cookie session, or a route's bearer-token one. */
type SchedulesClient = SupabaseClient;

/** Explicit column list rather than `*` — these rows cross into a client
 *  component, so they should carry exactly what it draws. */
const SLOT_COLS = 'id, kind, local_time, days, enabled, created_at';

/** The row as PostgREST returns it. `local_time` arrives as 'HH:MM:SS'. */
interface SlotRow {
  id: string;
  kind: string;
  local_time: string;
  days: number[] | null;
  enabled: boolean;
  created_at: string;
}

export interface SlotList {
  slots: BriefSlot[];
  /** True when brief_schedules isn't in this database yet — the settings card
   *  says so rather than showing an empty list that silently discards a Save. */
  tableMissing: boolean;
}

const EMPTY_LIST: SlotList = { slots: [], tableMissing: true };

async function client(supplied?: SchedulesClient): Promise<SchedulesClient> {
  return supplied ?? ((await createServerSupabase()) as unknown as SchedulesClient);
}

/**
 * A stored row, normalised to the shape everything above the database uses.
 *
 * The two things it fixes are both invisible until they bite: '07:00:00' from a
 * `time` column will not round-trip through an `<input type="time">`, and a
 * `kind` outside the three known values (the check constraint makes that
 * impossible today, but the column is text and a future migration could relax
 * it) degrades to 'custom' rather than printing an invented adjective into a
 * subject line.
 */
function normalise(row: SlotRow): BriefSlot {
  const minutes = parseLocalTime(row.local_time);
  const kind: BriefSlotKind =
    row.kind === 'morning' || row.kind === 'evening' ? row.kind : 'custom';
  return {
    id: row.id,
    kind,
    local_time: minutes === null ? '00:00' : formatLocalTime(minutes),
    days: [...new Set(row.days ?? [])].sort((a, b) => a - b),
    enabled: row.enabled,
    created_at: row.created_at,
  };
}

/**
 * This person's own brief times, earliest first.
 *
 * Ordered by the database rather than in memory so the card's list matches the
 * index it reads (`idx_brief_schedules_user`), and so two slots at the same
 * time have a stable order between them instead of shuffling on every render.
 */
export async function listSchedules(
  orgId: string,
  userId: string,
  supplied?: SchedulesClient,
): Promise<SlotList> {
  const supabase = await client(supplied);

  const { data, error } = await supabase
    .from('brief_schedules')
    .select(SLOT_COLS)
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .order('local_time', { ascending: true })
    .returns<SlotRow[]>();

  if (error) {
    if (isMissingRelation(error)) return EMPTY_LIST;
    throw error;
  }

  return { slots: (data ?? []).map(normalise), tableMissing: false };
}

/** What a Save answers with. `error` is a sentence the card can show verbatim;
 *  `null` means it worked. */
export interface SaveResult {
  slots: BriefSlot[];
  error: string | null;
}

/**
 * Write this person's complete set of brief times (rule 3 — identity is
 * preserved, not replaced).
 *
 * `slots` must already have been through `normaliseSlots`; this function
 * validates nothing beyond ownership, which the queries do themselves. Every
 * statement carries BOTH `.eq('org_id')` and `.eq('user_id')`, so an id from
 * another user's row updates nothing and deletes nothing rather than being
 * checked in application code and trusted afterwards.
 *
 * NOT A TRANSACTION, and that is a deliberate limit rather than an oversight:
 * PostgREST has no multi-statement transaction, and wrapping four statements in
 * an RPC would put this logic in SQL where it cannot be tested. The worst case
 * is a partial save — some slots updated, one insert failed — which the user
 * sees immediately on the card they are looking at and fixes by pressing Save
 * again. Nothing here writes money or sends anything.
 */
export async function saveSchedules(
  orgId: string,
  userId: string,
  slots: readonly BriefSlot[],
  supplied?: SchedulesClient,
): Promise<SaveResult> {
  const supabase = await client(supplied);

  const existing = await listSchedules(orgId, userId, supabase);
  if (existing.tableMissing) {
    return { slots: [], error: "Brief notifications aren't set up on this database yet." };
  }

  const existingIds = new Set(existing.slots.map((s) => s.id).filter((id): id is string => !!id));
  const keptIds = new Set<string>();
  const now = new Date().toISOString();

  for (const slot of slots) {
    const payload = {
      kind: slot.kind,
      local_time: slot.local_time,
      timezone: BRIEF_TIMEZONE,
      days: slot.days,
      enabled: slot.enabled,
      updated_at: now,
    };

    if (slot.id && existingIds.has(slot.id)) {
      keptIds.add(slot.id);
      const { error } = await supabase
        .from('brief_schedules')
        .update(payload)
        .eq('id', slot.id)
        .eq('org_id', orgId)
        .eq('user_id', userId);
      if (error) return { slots: [], error: error.message };
      continue;
    }

    const { error } = await supabase
      .from('brief_schedules')
      .insert({ ...payload, org_id: orgId, user_id: userId });
    if (error) return { slots: [], error: error.message };
  }

  const removed = [...existingIds].filter((id) => !keptIds.has(id));
  if (removed.length > 0) {
    const { error } = await supabase
      .from('brief_schedules')
      .delete()
      .in('id', removed)
      .eq('org_id', orgId)
      .eq('user_id', userId);
    if (error) return { slots: [], error: error.message };
  }

  // Re-read rather than reconstruct: the card needs the ids and `created_at`
  // the database just assigned, and a client holding invented ones would send
  // them back on the next Save and insert duplicates.
  const after = await listSchedules(orgId, userId, supabase);
  return { slots: after.slots, error: null };
}
