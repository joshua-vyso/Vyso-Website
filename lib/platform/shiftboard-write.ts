/**
 * ShiftBoard write path — every mutation the roster, cover and swap screens
 * make, in one place.
 *
 * Two shapes of write live here:
 *  - roster cells (`sb_roster_shifts.days`, a 7-cell jsonb array per employee)
 *    and the week's open shifts (`open_shifts`, stored redundantly on every row
 *    so a single read yields the week — writes therefore fan out to all rows);
 *  - swap/cover requests (`sb_shift_swaps`), which only rewrite the roster once
 *    a manager approves them. That is the whole point of the workflow: the app
 *    is the schedule of record, so nothing changes on a verbal promise.
 *
 * Every function returns `{ error }` rather than throwing — the callers are
 * optimistic UIs that need to revert cleanly on failure.
 */

import type { createClient } from './supabase-browser';
import {
  DAYS,
  OFF_SHIFT,
  openShiftKey,
  type OpenShift,
  type RosterRow,
  type RosterWeek,
  type Shift,
  type ShiftSwap,
  type SwapStatus,
} from './shiftboard';

/** The browser Supabase client, once the caller has null-checked it. */
export type Db = NonNullable<ReturnType<typeof createClient>>;

export interface WriteResult {
  error: string | null;
}

const OK: WriteResult = { error: null };

function fail(error: { message: string } | null): WriteResult {
  return { error: error?.message ?? null };
}

// ---------------------------------------------------------------------------
// Roster cells
// ---------------------------------------------------------------------------

/**
 * Make sure the employee has a roster row for this week and return its id.
 * Staff can exist in sb_employees without ever having been rostered; assigning
 * them their first shift should just work rather than silently no-op.
 */
export async function ensureRosterRow(
  db: Db,
  orgId: string,
  employee: { id: string; name: string; role: string; department: string },
  weekLabel: string,
  openShifts: OpenShift[] = [],
): Promise<{ rowId: string | null; error: string | null }> {
  const { data, error } = await db
    .from('sb_roster_shifts')
    .insert({
      org_id: orgId,
      employee_id: employee.id || null,
      name: employee.name,
      role: employee.role ?? '',
      department: employee.department ?? '',
      label: weekLabel,
      days: Array.from({ length: 7 }, () => ({ ...OFF_SHIFT })),
      open_shifts: openShifts,
    })
    .select('id')
    .single();
  if (error) return { rowId: null, error: error.message };
  return { rowId: (data as { id: string }).id, error: null };
}

/** Persist a whole 7-cell week for one roster row. */
export async function saveRosterDays(db: Db, row: Pick<RosterRow, 'rowId' | 'name'>, days: Shift[]): Promise<WriteResult> {
  if (!row.rowId) return { error: 'This person has no roster row yet.' };
  const { error } = await db.from('sb_roster_shifts').update({ days }).eq('id', row.rowId);
  return fail(error);
}

/** Create / edit / clear a single cell. `next` of null clears the day to Off. */
export async function saveRosterCell(db: Db, row: RosterRow, dayIdx: number, next: Shift | null): Promise<WriteResult> {
  if (dayIdx < 0 || dayIdx > 6) return { error: 'Unknown day.' };
  const days = Array.from({ length: 7 }, (_, i) => row.days[i] ?? { ...OFF_SHIFT });
  days[dayIdx] = next ?? { ...OFF_SHIFT };
  return saveRosterDays(db, row, days);
}

// ---------------------------------------------------------------------------
// Open shifts (the week's cover offers)
// ---------------------------------------------------------------------------

/**
 * Replace the week's open shifts. They are denormalised onto every roster row,
 * so one org-scoped update keeps all copies consistent — which is exactly why
 * the reader now unions them instead of trusting a single row.
 */
export async function saveOpenShifts(db: Db, orgId: string, openShifts: OpenShift[]): Promise<WriteResult> {
  const { error } = await db.from('sb_roster_shifts').update({ open_shifts: openShifts }).eq('org_id', orgId);
  return fail(error);
}

export function addOpenShift(existing: OpenShift[], next: OpenShift): OpenShift[] {
  const key = openShiftKey(next);
  return [...existing.filter((o) => openShiftKey(o) !== key), next];
}

export function removeOpenShift(existing: OpenShift[], target: OpenShift): OpenShift[] {
  const key = openShiftKey(target);
  return existing.filter((o) => openShiftKey(o) !== key);
}

/** Client-side id for a new open shift (crypto.randomUUID is not everywhere). */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `os_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Call-out: the rostered person is out, so their cell is released and the shift
 * becomes an open offer the team can be matched against. One write per side —
 * the cell and the offer — because a half-applied call-out is worse than none.
 */
export async function markCallOut(
  db: Db,
  orgId: string,
  roster: RosterWeek,
  row: RosterRow,
  dayIdx: number,
  note: string,
): Promise<{ error: string | null; openShift: OpenShift | null }> {
  const cell = row.days[dayIdx];
  if (!cell || cell.status !== 'scheduled') return { error: 'That day is not a scheduled shift.', openShift: null };

  const offer: OpenShift = {
    id: newId(),
    day: DAYS[dayIdx] ?? '',
    department: cell.department ?? row.department,
    time: cell.time,
    reason: 'call-out',
    fromEmployeeId: row.employeeId || undefined,
    fromName: row.name,
    note: note || undefined,
    createdAt: new Date().toISOString(),
  };

  // The cell keeps its time while it is open, so assigning cover (or undoing
  // the call-out) starts from the shift that actually needs filling.
  const cleared = await saveRosterCell(db, row, dayIdx, { time: cell.time, status: 'open', department: offer.department });
  if (cleared.error) return { error: cleared.error, openShift: null };

  const saved = await saveOpenShifts(db, orgId, addOpenShift(roster.openShifts, offer));
  if (saved.error) return { error: saved.error, openShift: null };
  return { error: null, openShift: offer };
}

/** Fill an open shift by writing it into the chosen employee's roster row. */
export async function assignOpenShift(
  db: Db,
  orgId: string,
  roster: RosterWeek,
  target: RosterRow,
  open: OpenShift,
  conflict?: Shift['conflict'],
): Promise<WriteResult> {
  const dayIdx = DAYS.indexOf(open.day);
  if (dayIdx < 0) return { error: `Unknown day "${open.day}".` };

  const assigned = await saveRosterCell(db, target, dayIdx, {
    time: open.time,
    department: open.department,
    status: 'scheduled',
    ...(conflict ? { conflict } : {}),
  });
  if (assigned.error) return assigned;
  return saveOpenShifts(db, orgId, removeOpenShift(roster.openShifts, open));
}

// ---------------------------------------------------------------------------
// Swap & cover requests
// ---------------------------------------------------------------------------

export interface ProposeSwapInput {
  kind: ShiftSwap['kind'];
  weekLabel: string;
  day: string;
  fromEmployeeId: string;
  fromName: string;
  fromTime: string;
  fromDepartment: string;
  /** For a straight swap, the shift offered back. */
  toEmployeeId?: string | null;
  toName?: string | null;
  toDay?: string | null;
  toTime?: string | null;
  toDepartment?: string | null;
  reason?: string | null;
  note?: string | null;
}

export async function proposeSwap(db: Db, orgId: string, userId: string | null, input: ProposeSwapInput): Promise<WriteResult> {
  const { error } = await db.from('sb_shift_swaps').insert({
    org_id: orgId,
    kind: input.kind,
    status: input.toEmployeeId ? 'accepted' : 'proposed',
    week_label: input.weekLabel,
    day: input.day,
    from_employee_id: input.fromEmployeeId || null,
    from_name: input.fromName,
    from_time: input.fromTime,
    from_department: input.fromDepartment,
    to_employee_id: input.toEmployeeId || null,
    to_name: input.toName ?? null,
    to_day: input.toDay ?? null,
    to_time: input.toTime ?? null,
    to_department: input.toDepartment ?? null,
    reason: input.reason ?? null,
    note: input.note ?? null,
    proposed_by: userId,
    proposed_at: new Date().toISOString(),
    accepted_at: input.toEmployeeId ? new Date().toISOString() : null,
  });
  return fail(error);
}

/** Someone puts their hand up — still needs a manager before the roster moves. */
export async function acceptSwap(
  db: Db,
  swapId: string,
  taker: { id: string; name: string; day?: string | null; time?: string | null; department?: string | null },
): Promise<WriteResult> {
  const { error } = await db
    .from('sb_shift_swaps')
    .update({
      status: 'accepted',
      to_employee_id: taker.id || null,
      to_name: taker.name,
      to_day: taker.day ?? null,
      to_time: taker.time ?? null,
      to_department: taker.department ?? null,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', swapId);
  return fail(error);
}

export async function setSwapStatus(db: Db, swapId: string, status: SwapStatus, decidedNote?: string): Promise<WriteResult> {
  const { error } = await db
    .from('sb_shift_swaps')
    .update({
      status,
      decided_note: decidedNote ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', swapId);
  return fail(error);
}

/**
 * Manager approval — the only path that rewrites the roster.
 *  - `cover`: the shift moves from the requester to the taker.
 *  - `swap`:  the two cells exchange, each keeping its own time/department.
 * The swap row is only marked approved once the roster writes succeed, so a
 * failed write leaves it visibly still awaiting approval.
 */
export async function approveSwap(db: Db, orgId: string, swap: ShiftSwap, roster: RosterWeek): Promise<WriteResult> {
  if (!swap.toEmployeeId) return { error: 'Nobody has accepted this request yet.' };

  const rowFor = (employeeId: string, name: string | null) =>
    roster.rows.find((r) => r.employeeId === employeeId) ?? (name ? roster.rows.find((r) => r.name === name) : undefined);

  const fromRow = rowFor(swap.fromEmployeeId, swap.fromName);
  const toRow = rowFor(swap.toEmployeeId, swap.toName);
  if (!fromRow || !toRow) return { error: 'Could not find both roster rows for this request.' };

  const fromIdx = DAYS.indexOf(swap.day);
  if (fromIdx < 0) return { error: `Unknown day "${swap.day}".` };

  const givenUp: Shift = {
    time: swap.fromTime,
    department: swap.fromDepartment || fromRow.department,
    status: 'scheduled',
  };

  // Build both weeks in memory first, then write each row exactly once — two
  // sequential single-cell writes on the same row would read stale `days`.
  const fromDays = week(fromRow.days);
  const toDays = week(toRow.days);
  fromDays[fromIdx] = { ...OFF_SHIFT };
  toDays[fromIdx] = givenUp;

  if (swap.kind === 'swap' && swap.toTime) {
    const toIdx = DAYS.indexOf(swap.toDay ?? swap.day);
    if (toIdx < 0) return { error: `Unknown day "${swap.toDay}".` };
    const returned: Shift = { time: swap.toTime, department: swap.toDepartment || toRow.department, status: 'scheduled' };
    fromDays[toIdx] = returned;
    // A same-day trade already put the given-up shift on the taker's cell.
    if (toIdx !== fromIdx) toDays[toIdx] = { ...OFF_SHIFT };
  }

  const a = await saveRosterDays(db, fromRow, fromDays);
  if (a.error) return a;
  const b = await saveRosterDays(db, toRow, toDays);
  if (b.error) return b;

  // A cover that started life as a call-out has an open offer to retire.
  const offer = roster.openShifts.find((o) => o.day === swap.day && o.time === swap.fromTime && (o.fromEmployeeId ?? '') === swap.fromEmployeeId);
  if (offer) {
    const cleared = await saveOpenShifts(db, orgId, removeOpenShift(roster.openShifts, offer));
    if (cleared.error) return cleared;
  }

  const { error } = await db
    .from('sb_shift_swaps')
    .update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', swap.id);
  return error ? fail(error) : OK;
}

/** A defensive 7-cell copy — rows from older seeds can be short. */
function week(days: Shift[]): Shift[] {
  return Array.from({ length: 7 }, (_, i) => days[i] ?? { ...OFF_SHIFT });
}
