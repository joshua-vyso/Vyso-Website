/**
 * ShiftBoard data access — fetches the org's people data from Supabase
 * (sb_departments, sb_employees, sb_roster_shifts, sb_attendance,
 * sb_leave_requests, sb_shift_swaps) and maps the rows to the TS shapes the
 * views render. Org-scoped by RLS; an org with no rows returns empty
 * collections so unseeded accounts render clean empty states.
 *
 * It also pulls this week's realized OrderFlow revenue (of_orders +
 * of_order_items, the invoiced/paid convention used across PricePilot) so the
 * Insights tab can put labour cost next to the sales it bought.
 */

import { createServerSupabase } from './supabase-server';
import {
  DAYS,
  SKILL_NAMES,
  type ShiftBoardData,
  type Employee,
  type DepartmentInfo,
  type EmployeeStatus,
  type RosterRow,
  type RosterWeek,
  type Shift,
  type OpenShift,
  type OpenShiftReason,
  type AttendanceRecord,
  type AttendanceStatus,
  type LeaveRequest,
  type LeaveType,
  type LeaveStatus,
  type ShiftSwap,
  type SwapKind,
  type SwapStatus,
  type DailySales,
} from './shiftboard';

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function strArr(v: any): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}
/**
 * A roster row is always 7 cells. Seeds and hand-written rows can be short or
 * carry nulls; padding here means every consumer (grid, costing, overtime) can
 * index a day without guarding.
 */
function normaliseDays(v: any): Shift[] {
  const raw = Array.isArray(v) ? v : [];
  return Array.from({ length: 7 }, (_, i) => {
    const c = raw[i];
    if (!c || typeof c !== 'object') return { time: '', status: 'off' } as Shift;
    return {
      time: String(c.time ?? ''),
      department: c.department ?? undefined,
      status: (c.status as Shift['status']) ?? 'off',
      conflict: c.conflict ?? undefined,
    };
  });
}
/** sb_employees.skills jsonb { "Receiving": 0..5, ... } → number[] in SKILL_NAMES order. */
function skillsArray(obj: any): number[] {
  if (!obj || typeof obj !== 'object') return SKILL_NAMES.map(() => 0);
  return SKILL_NAMES.map((s) => num((obj as Record<string, unknown>)[s]));
}

/** Monday 00:00 of the week containing `now`, in local time. */
function weekStart(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Sun=0 → Mon-based index
  return d;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * This week's realized revenue per weekday, aligned to the roster's Mon–Sun
 * columns. Uses the invoiced/paid convention shared with PricePilot so labour %
 * is measured against the same "sales" number the rest of Vyso reports.
 * Any failure (module not enabled, no orders) degrades to an empty series and
 * the UI simply omits the labour-% column.
 */
async function getWeekSales(sb: Awaited<ReturnType<typeof createServerSupabase>>, orgId: string): Promise<DailySales[]> {
  const start = weekStart();
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const { data: orders, error } = await sb
    .from('of_orders')
    .select('id, created_at, status')
    .eq('org_id', orgId)
    .in('status', ['invoiced', 'paid'])
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  if (error || !orders || orders.length === 0) return [];

  const dayByOrder = new Map<string, number>();
  for (const o of orders as any[]) {
    const d = new Date(o.created_at);
    dayByOrder.set(o.id, (d.getDay() + 6) % 7);
  }

  const { data: items } = await sb
    .from('of_order_items')
    .select('order_id, qty, unit_price')
    .eq('org_id', orgId)
    .in('order_id', [...dayByOrder.keys()]);

  const revenue = new Array(7).fill(0) as number[];
  for (const it of ((items as any[]) ?? [])) {
    const idx = dayByOrder.get(it.order_id);
    if (idx == null) continue;
    revenue[idx] += num(it.qty) * num(it.unit_price);
  }
  if (revenue.every((r) => r === 0)) return [];

  return DAYS.map((day, dayIndex) => {
    const date = new Date(start);
    date.setDate(date.getDate() + dayIndex);
    return { day, dayIndex, date: isoDate(date), revenue: revenue[dayIndex] };
  });
}

export async function getShiftBoardData(orgId: string): Promise<ShiftBoardData> {
  const sb = await createServerSupabase();
  const [dep, emp, ros, att, lev, swp, sales] = await Promise.all([
    sb.from('sb_departments').select('*').eq('org_id', orgId).order('name'),
    sb.from('sb_employees').select('*').eq('org_id', orgId).order('name'),
    sb.from('sb_roster_shifts').select('*').eq('org_id', orgId).order('name'),
    sb.from('sb_attendance').select('*').eq('org_id', orgId).order('department'),
    sb.from('sb_leave_requests').select('*').eq('org_id', orgId).order('start_date'),
    // Additive table (supabase/demo-fresh-valley/1-shiftboard-swaps.sql). An org
    // whose DB has not had it applied yet just gets an error here — the swap UI
    // then shows its empty state instead of the page failing.
    sb.from('sb_shift_swaps').select('*').eq('org_id', orgId).order('created_at', { ascending: false }),
    getWeekSales(sb, orgId),
  ]);

  const departments: DepartmentInfo[] = ((dep.data as any[]) ?? []).map((r) => ({ name: r.name, required: num(r.required), color: r.color ?? '#6B6F68' }));

  const employees: Employee[] = ((emp.data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role ?? '',
    department: r.department ?? '',
    status: (r.status as EmployeeStatus) ?? 'Scheduled',
    nextShift: r.next_shift ?? '',
    shiftTime: r.shift_time ?? '',
    hoursThisWeek: num(r.hours_this_week),
    contractedHours: num(r.contracted_hours),
    rate: num(r.rate),
    attendanceScore: num(r.attendance_score),
    leaveBalance: num(r.leave_balance),
    skills: skillsArray(r.skills),
    availableDays: strArr(r.available_days),
    unavailableDays: strArr(r.unavailable_days),
    preferredShifts: r.preferred_shifts ?? '',
    devices: strArr(r.devices),
    currentDepartment: r.current_department ?? undefined,
    currentTask: r.current_task ?? undefined,
    currentRecipe: r.current_recipe ?? undefined,
    assignedDevice: r.assigned_device ?? undefined,
  }));

  const rosterRaw = ((ros.data as any[]) ?? []);
  const rosterRows: RosterRow[] = rosterRaw.map((r) => ({
    // The roster row id is what a write targets, so keep it alongside the
    // employee it belongs to (rows exist for staff with no sb_employees link).
    rowId: r.id,
    employeeId: r.employee_id ?? '',
    name: r.name,
    role: r.role ?? '',
    department: r.department ?? '',
    days: normaliseDays(r.days),
  }));

  // `label` and `open_shifts` are week-level facts stored redundantly on every
  // roster row. Reading them off row [0] made the whole week's heading and its
  // open shifts depend on whichever employee happened to sort first — one row
  // written with a blank label (or a stale open_shifts array) silently emptied
  // the Roster tab. Take the first non-empty label instead, and union the open
  // shifts across every row, de-duplicated by identity.
  const label = String(rosterRaw.find((r) => (r.label ?? '').trim() !== '')?.label ?? '');
  const seenOpen = new Set<string>();
  const openShifts: OpenShift[] = [];
  for (const r of rosterRaw) {
    for (const raw of (Array.isArray(r.open_shifts) ? r.open_shifts : []) as any[]) {
      if (!raw || typeof raw !== 'object') continue;
      const o: OpenShift = {
        id: raw.id ? String(raw.id) : undefined,
        day: String(raw.day ?? ''),
        department: String(raw.department ?? ''),
        time: String(raw.time ?? ''),
        reason: (raw.reason as OpenShiftReason) ?? 'unfilled',
        fromEmployeeId: raw.fromEmployeeId ?? undefined,
        fromName: raw.fromName ?? undefined,
        note: raw.note ?? undefined,
        createdAt: raw.createdAt ?? undefined,
      };
      const key = o.id ?? `${o.day}|${o.department}|${o.time}`;
      if (seenOpen.has(key)) continue;
      seenOpen.add(key);
      openShifts.push(o);
    }
  }
  const roster: RosterWeek = { label, rows: rosterRows, openShifts };

  const attendance: AttendanceRecord[] = ((att.data as any[]) ?? []).map((r) => ({
    id: r.id,
    employeeId: r.employee_id ?? '',
    name: r.name,
    department: r.department ?? '',
    scheduled: r.scheduled ?? '',
    clockIn: r.clock_in ?? null,
    clockOut: r.clock_out ?? null,
    hoursWorked: num(r.hours_worked),
    status: (r.status as AttendanceStatus) ?? 'On time',
    overtime: num(r.overtime),
  }));

  const leave: LeaveRequest[] = ((lev.data as any[]) ?? []).map((r) => ({
    id: r.id,
    employeeId: r.employee_id ?? '',
    name: r.name,
    department: r.department ?? '',
    type: (r.type as LeaveType) ?? 'Annual leave',
    start: r.start_label ?? '',
    end: r.end_label ?? '',
    days: num(r.days),
    coverageImpact: r.coverage_impact ?? '',
    coverageRisk: (r.coverage_risk as LeaveRequest['coverageRisk']) ?? 'none',
    status: (r.status as LeaveStatus) ?? 'Pending',
  }));

  const swaps: ShiftSwap[] = ((swp.data as any[]) ?? []).map((r) => ({
    id: r.id,
    kind: (r.kind as SwapKind) ?? 'swap',
    status: (r.status as SwapStatus) ?? 'proposed',
    weekLabel: r.week_label ?? '',
    day: r.day ?? '',
    fromEmployeeId: r.from_employee_id ?? '',
    fromName: r.from_name ?? '',
    fromTime: r.from_time ?? '',
    fromDepartment: r.from_department ?? '',
    toEmployeeId: r.to_employee_id ?? null,
    toName: r.to_name ?? null,
    toDay: r.to_day ?? null,
    toTime: r.to_time ?? null,
    toDepartment: r.to_department ?? null,
    reason: r.reason ?? null,
    note: r.note ?? null,
    decidedNote: r.decided_note ?? null,
    proposedAt: r.proposed_at ?? r.created_at ?? null,
    acceptedAt: r.accepted_at ?? null,
    approvedAt: r.approved_at ?? null,
  }));

  return { employees, departments, roster, attendance, leave, swaps, sales, todayIndex: (new Date().getDay() + 6) % 7 };
}
