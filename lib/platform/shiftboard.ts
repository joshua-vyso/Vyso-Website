/**
 * ShiftBoard — people operations command centre. Types, style maps, derived
 * helpers and illustrative constants. The org's people data (employees,
 * departments, roster, attendance, leave) is fetched per-org from Supabase in
 * `shiftboard-data.ts` and provided to the views; the helpers here operate on
 * that data. Departments are org-defined (from sb_departments), so DepartmentName
 * is a free string and colours come from the DB rows (with a fallback palette).
 */

import type { VysoModuleKey } from './module-meta';

/** Org-defined department label (from sb_departments). */
export type DepartmentName = string;
export type EmployeeStatus = 'Working' | 'On break' | 'Scheduled' | 'Off' | 'On leave' | 'Absent';
export type SkillName = 'Receiving' | 'Dispatch' | 'Prep Kitchen' | 'Driving' | 'Customer Service' | 'Stock Handling' | 'Device Operation';
export type CoverageStatus = 'covered' | 'short' | 'overstaffed';

export const SKILL_NAMES: SkillName[] = ['Receiving', 'Dispatch', 'Prep Kitchen', 'Driving', 'Customer Service', 'Stock Handling', 'Device Operation'];
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Fallback colours for departments not carrying their own colour. */
const FALLBACK_PALETTE = ['#0F6E56', '#0C447C', '#D9730D', '#5B53C0', '#2C7A8A', '#854F0B', '#6B6F68', '#A32D2D', '#2E7D67', '#3A4DB0'];

/** Resolve a department's colour: the DB row's colour, else a stable fallback. */
export function deptColor(name: string, departments?: DepartmentInfo[]): string {
  const d = departments?.find((x) => x.name === name);
  if (d?.color) return d.color;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}

export const EMPLOYEE_STATUS_STYLE: Record<EmployeeStatus, { bg: string; fg: string }> = {
  Working: { bg: '#E1F5EE', fg: '#0F6E56' },
  'On break': { bg: '#FBEFDD', fg: '#9A6314' },
  Scheduled: { bg: '#E6F1FB', fg: '#0C447C' },
  Off: { bg: '#EEF1F5', fg: '#8A8E86' },
  'On leave': { bg: '#FBEEDA', fg: '#854F0B' },
  Absent: { bg: '#FCEBEB', fg: '#A32D2D' },
};

export const COVERAGE_STYLE: Record<CoverageStatus, { bg: string; fg: string; label: string }> = {
  covered: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Covered' },
  short: { bg: '#FCEBEB', fg: '#A32D2D', label: 'Short' },
  overstaffed: { bg: '#E6F1FB', fg: '#0C447C', label: 'Overstaffed' },
};

export function coverageStatus(working: number, required: number): CoverageStatus {
  if (working < required) return 'short';
  if (working > required) return 'overstaffed';
  return 'covered';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillRating {
  skill: SkillName;
  rating: number; // 0–5
}

export interface EmployeeDeviceAssignment {
  device: string;
  department: DepartmentName;
  task?: string;
  recipe?: string;
  at: string;
}

export interface ActivityEvent {
  time: string;
  label: string;
  kind: 'clock' | 'assign' | 'recipe' | 'device' | 'break' | 'task';
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: DepartmentName;
  status: EmployeeStatus;
  nextShift: string;
  /** Current/next shift window. */
  shiftTime: string;
  hoursThisWeek: number;
  contractedHours: number;
  rate: number; // R / hour
  attendanceScore: number; // 0–100
  leaveBalance: number; // days
  /** 7 ratings (0–5) indexed by SKILL_NAMES. */
  skills: number[];
  availableDays: string[];
  unavailableDays: string[];
  preferredShifts: string;
  /** Recent WasteWatch device assignments (names) — drawer "Assigned devices". */
  devices: string[];
  // Live-ops / WasteWatch device foundation (populated when working):
  currentDepartment?: DepartmentName;
  currentTask?: string;
  currentRecipe?: string;
  assignedDevice?: string;
}

/** A department as defined for the org (sb_departments). */
export interface DepartmentInfo {
  name: DepartmentName;
  required: number;
  color: string;
}

export type ShiftStatus = 'scheduled' | 'open' | 'off' | 'leave';
export type ShiftConflict = 'Overtime risk' | 'Leave conflict' | 'Department short' | 'Double booked';

export interface Shift {
  time: string; // '08–16' or '' for off/leave
  department?: DepartmentName;
  status: ShiftStatus;
  conflict?: ShiftConflict;
}

export interface RosterRow {
  /** sb_roster_shifts.id — the write target for shift create/edit/assign. */
  rowId?: string;
  employeeId: string;
  name: string;
  role: string;
  department: DepartmentName;
  days: Shift[]; // 7
}

/** An empty (unscheduled) roster cell — the shape a new/cleared day takes. */
export const OFF_SHIFT: Shift = { time: '', status: 'off' };

/** Why a shift is unfilled — an ordinary gap, or someone calling out at short notice. */
export type OpenShiftReason = 'unfilled' | 'call-out';

export interface OpenShift {
  /** Stable key so a cover offer can be tracked/removed once filled. Older rows
   *  have none — {@link openShiftKey} falls back to the day/dept/time triple. */
  id?: string;
  day: string;
  department: DepartmentName;
  time: string;
  reason?: OpenShiftReason;
  /** Set when the offer came from a call-out (who dropped out). */
  fromEmployeeId?: string;
  fromName?: string;
  note?: string;
  createdAt?: string;
}

/** Identity for an open shift that survives rows without an `id`. */
export function openShiftKey(o: OpenShift): string {
  return o.id ?? `${o.day}|${o.department}|${o.time}`;
}

export interface RosterWeek {
  label: string;
  rows: RosterRow[];
  openShifts: OpenShift[];
}

export type AttendanceStatus = 'On time' | 'Late' | 'Absent' | 'Early leave' | 'Overtime' | 'Manual review';

export const ATTENDANCE_STYLE: Record<AttendanceStatus, { bg: string; fg: string }> = {
  'On time': { bg: '#E1F5EE', fg: '#0F6E56' },
  Late: { bg: '#FBEFDD', fg: '#9A6314' },
  Absent: { bg: '#FCEBEB', fg: '#A32D2D' },
  'Early leave': { bg: '#FBEEDA', fg: '#854F0B' },
  Overtime: { bg: '#EAE7FB', fg: '#5B53C0' },
  'Manual review': { bg: '#EEF1F5', fg: '#6B6F68' },
};

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  name: string;
  department: DepartmentName;
  scheduled: string;
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: number;
  status: AttendanceStatus;
  overtime: number; // hours
}

export type LeaveType = 'Annual leave' | 'Sick leave' | 'Family responsibility' | 'Unpaid';
export type LeaveStatus = 'Pending' | 'Approved' | 'Declined';

export const LEAVE_TYPE_TONE: Record<LeaveType, 'neutral' | 'positive' | 'warning' | 'critical' | 'info'> = {
  'Annual leave': 'info',
  'Sick leave': 'warning',
  'Family responsibility': 'neutral',
  Unpaid: 'neutral',
};

export interface LeaveRequest {
  id: string;
  employeeId: string;
  name: string;
  department: DepartmentName;
  type: LeaveType;
  start: string;
  end: string;
  days: number;
  coverageImpact: string;
  coverageRisk: 'none' | 'low' | 'high';
  status: LeaveStatus;
}

// ---------------------------------------------------------------------------
// Swap & cover workflow (sb_shift_swaps) — the schedule of record lives here,
// not in a WhatsApp thread. propose → accept → manager-approve, and only an
// approved request rewrites the roster.
// ---------------------------------------------------------------------------

/** `swap` trades two shifts; `cover` gives one away (incl. call-out cover offers). */
export type SwapKind = 'swap' | 'cover';
export type SwapStatus = 'proposed' | 'accepted' | 'approved' | 'declined' | 'cancelled';

export const SWAP_STATUS_META: Record<SwapStatus, { label: string; tone: 'neutral' | 'positive' | 'warning' | 'critical' | 'info'; hint: string }> = {
  proposed: { label: 'Awaiting a taker', tone: 'warning', hint: 'Offered to the team — nobody has accepted yet.' },
  accepted: { label: 'Needs approval', tone: 'info', hint: 'Someone accepted — a manager must approve before the roster changes.' },
  approved: { label: 'Approved', tone: 'positive', hint: 'Approved and written to the roster.' },
  declined: { label: 'Declined', tone: 'critical', hint: 'A manager declined this request.' },
  cancelled: { label: 'Cancelled', tone: 'neutral', hint: 'Withdrawn by the requester.' },
};

export const SWAP_REASONS = ['Personal', 'Family responsibility', 'Illness', 'Transport', 'Study', 'Called out', 'Other'] as const;

export interface ShiftSwap {
  id: string;
  kind: SwapKind;
  status: SwapStatus;
  weekLabel: string;
  /** The shift being given up. */
  day: string;
  fromEmployeeId: string;
  fromName: string;
  fromTime: string;
  fromDepartment: string;
  /** The counterparty — null until someone accepts. */
  toEmployeeId: string | null;
  toName: string | null;
  /** For `swap`, the shift traded back (may be a different day). */
  toDay: string | null;
  toTime: string | null;
  toDepartment: string | null;
  reason: string | null;
  note: string | null;
  decidedNote: string | null;
  proposedAt: string | null;
  acceptedAt: string | null;
  approvedAt: string | null;
}

/** Same-day sales (of_orders) used for the labour-% derivation on Insights. */
export interface DailySales {
  /** 'Mon'…'Sun' — aligned to the roster's day columns. */
  day: string;
  dayIndex: number;
  /** ISO date (yyyy-mm-dd) the revenue was taken from. */
  date: string;
  revenue: number;
}

/** The full per-org ShiftBoard payload (fetched in shiftboard-data.ts). */
export interface ShiftBoardData {
  employees: Employee[];
  departments: DepartmentInfo[];
  roster: RosterWeek;
  attendance: AttendanceRecord[];
  leave: LeaveRequest[];
  /** Swap/cover requests (empty when sb_shift_swaps has not been applied yet). */
  swaps: ShiftSwap[];
  /** Same-day OrderFlow revenue per weekday, for labour %. Empty when no sales. */
  sales: DailySales[];
  /**
   * Today's column in the Mon-first roster grid, resolved on the server.
   * Client components must not compute this from `new Date()` — the server and
   * the browser can disagree about the weekday across a timezone boundary and
   * hydration would mismatch.
   */
  todayIndex: number;
}

/** An org with nothing yet — used by the layout and as a safe fallback. */
export const EMPTY_SHIFTBOARD: ShiftBoardData = {
  employees: [],
  departments: [],
  roster: { label: '', rows: [], openShifts: [] },
  attendance: [],
  leave: [],
  swaps: [],
  sales: [],
  todayIndex: 0,
};

// ---------------------------------------------------------------------------
// Derived helpers (operate on fetched data)
// ---------------------------------------------------------------------------

/** People physically present in a department right now (working or on break). */
export function presentInDepartment(employees: Employee[], d: DepartmentName): Employee[] {
  return employees.filter((e) => e.currentDepartment === d && (e.status === 'Working' || e.status === 'On break'));
}

export interface DepartmentSnapshot {
  name: DepartmentName;
  color: string;
  required: number;
  working: number;
  status: CoverageStatus;
  staff: Employee[];
}

export function departmentSnapshots(employees: Employee[], departments: DepartmentInfo[]): DepartmentSnapshot[] {
  return departments.map((d) => {
    const staff = presentInDepartment(employees, d.name);
    return { name: d.name, color: d.color, required: d.required, working: staff.length, status: coverageStatus(staff.length, d.required), staff };
  });
}

/** Live device→user→department→recipe links — the WasteWatch foundation. */
export function liveDeviceAssignments(employees: Employee[]): (EmployeeDeviceAssignment & { employee: string })[] {
  return employees.filter((e) => e.assignedDevice).map((e) => ({ device: e.assignedDevice!, department: e.currentDepartment ?? e.department, task: e.currentTask, recipe: e.currentRecipe, at: e.shiftTime, employee: e.name }));
}

// ---------------------------------------------------------------------------
// Shift windows — the roster stores a cell time as a label ('07–15',
// '08:00–16:00'). Everything hour-based (cost, overtime, coverage) parses it
// here so there is exactly one interpretation of a shift's length.
// ---------------------------------------------------------------------------

/** En dash, em dash or hyphen — the seed and the UI both appear in the wild. */
const SHIFT_DASH = /[–—-]/;

export interface ShiftWindow {
  /** Decimal hours from midnight, e.g. 7.5 for 07:30. */
  start: number;
  /** Decimal hours; a shift crossing midnight ends past 24. */
  end: number;
}

export function parseShiftWindow(time: string | null | undefined): ShiftWindow | null {
  if (!time) return null;
  const parts = String(time).split(SHIFT_DASH).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;
  const toHours = (s: string): number | null => {
    const [h, m] = s.split(':');
    const hh = Number(h);
    if (!Number.isFinite(hh)) return null;
    const mm = Number(m ?? 0);
    return hh + (Number.isFinite(mm) ? mm : 0) / 60;
  };
  const start = toHours(parts[0]);
  const end = toHours(parts[1]);
  if (start == null || end == null) return null;
  // 22–06 is a night shift, not a negative one.
  return { start, end: end <= start ? end + 24 : end };
}

/** Paid length of a roster cell, in hours (0 for off/leave/unparseable). */
export function shiftHours(time: string | null | undefined): number {
  const w = parseShiftWindow(time);
  return w ? Math.max(0, w.end - w.start) : 0;
}

/** Build the canonical cell label from two `HH:MM` (or `HH`) endpoints. */
export function formatShiftWindow(start: string, end: string): string {
  const trim = (s: string) => (s.endsWith(':00') ? s.slice(0, -3) : s);
  return `${trim(start)}–${trim(end)}`;
}

/** `HH:MM` options at 30-minute steps — the shift editor's start/end pickers. */
export function timeOptions(stepMinutes = 30): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}

/** Scheduled hours across a roster row's 7 cells. */
export function rowHours(days: Shift[]): number {
  return days.reduce((s, d) => s + (d?.status === 'scheduled' ? shiftHours(d.time) : 0), 0);
}

// ---------------------------------------------------------------------------
// Overtime risk at scheduling time — the "OT surprise" pain. Warns while the
// manager is still in the editor, not on the payroll run.
// ---------------------------------------------------------------------------

/** BCEA ordinary hours — the ceiling used when an employee has no contract set. */
export const OT_WEEKLY_HOURS = 45;
/** Within this many hours of the threshold we warn before it is actually breached. */
export const OT_NEAR_MARGIN = 2;

export interface OvertimeAssessment {
  /** Projected scheduled hours for the week after the pending change. */
  projected: number;
  /** Hours before the change (so the editor can show the delta). */
  current: number;
  threshold: number;
  /** Hours past the threshold (0 when inside it). */
  over: number;
  level: 'ok' | 'near' | 'over';
  message: string;
}

/** Effective weekly ceiling: the contract when set, else the BCEA default. */
export function overtimeThreshold(employee: Pick<Employee, 'contractedHours'> | undefined): number {
  const c = employee?.contractedHours ?? 0;
  return c > 0 ? c : OT_WEEKLY_HOURS;
}

/**
 * What a pending roster edit does to an employee's week. `dayIdx` is the cell
 * being changed and `next` the shift it becomes (null = cleared), so the caller
 * gets the answer *before* saving.
 */
export function assessOvertime(
  row: { days: Shift[] } | undefined,
  employee: Pick<Employee, 'name' | 'contractedHours'> | undefined,
  dayIdx: number,
  next: Shift | null,
): OvertimeAssessment {
  const days = row?.days ?? [];
  const current = rowHours(days);
  const before = days[dayIdx]?.status === 'scheduled' ? shiftHours(days[dayIdx]?.time) : 0;
  const after = next?.status === 'scheduled' ? shiftHours(next.time) : 0;
  const projected = Math.max(0, current - before + after);
  const threshold = overtimeThreshold(employee);
  const over = Math.max(0, projected - threshold);
  const level: OvertimeAssessment['level'] = over > 0 ? 'over' : projected >= threshold - OT_NEAR_MARGIN ? 'near' : 'ok';
  const who = employee?.name ?? 'This employee';
  const message =
    level === 'over'
      ? `${who} would be on ${fmtHours(projected)} this week — ${fmtHours(over)} of overtime past their ${fmtHours(threshold)}.`
      : level === 'near'
        ? `${who} would be on ${fmtHours(projected)} of ${fmtHours(threshold)} — close to overtime.`
        : `${who} would be on ${fmtHours(projected)} of ${fmtHours(threshold)}.`;
  return { projected, current, threshold, over, level, message };
}

/** '7.5h' / '8h' — hours never render with a trailing '.0'. */
export function fmtHours(n: number): string {
  return `${Number(n.toFixed(2)).toString()}h`;
}

// ---------------------------------------------------------------------------
// Labour cost per shift / per day, and labour % of same-day sales.
// ---------------------------------------------------------------------------

export interface ShiftCost {
  employeeId: string;
  name: string;
  department: DepartmentName;
  dayIndex: number;
  day: string;
  time: string;
  hours: number;
  rate: number;
  cost: number;
}

/** Every scheduled cell in the week costed at the employee's hourly rate. */
export function rosterShiftCosts(roster: RosterWeek, employees: Employee[]): ShiftCost[] {
  const rateBy = new Map(employees.map((e) => [e.id, e.rate]));
  const rateByName = new Map(employees.map((e) => [e.name, e.rate]));
  const out: ShiftCost[] = [];
  for (const row of roster.rows) {
    const rate = rateBy.get(row.employeeId) ?? rateByName.get(row.name) ?? 0;
    row.days.forEach((cell, dayIndex) => {
      if (!cell || cell.status !== 'scheduled') return;
      const hours = shiftHours(cell.time);
      if (hours <= 0) return;
      out.push({
        employeeId: row.employeeId,
        name: row.name,
        department: cell.department ?? row.department,
        dayIndex,
        day: DAYS[dayIndex] ?? String(dayIndex),
        time: cell.time,
        hours,
        rate,
        cost: hours * rate,
      });
    });
  }
  return out;
}

export interface DayLabour {
  day: string;
  dayIndex: number;
  shifts: number;
  hours: number;
  cost: number;
  /** Same-day OrderFlow revenue, when there is any. */
  sales: number | null;
  /** cost / sales × 100 — null when there is no same-day revenue to divide by. */
  labourPct: number | null;
}

/** Per-day labour totals for the roster week, joined to same-day sales. */
export function dailyLabour(roster: RosterWeek, employees: Employee[], sales: DailySales[] = []): DayLabour[] {
  const costs = rosterShiftCosts(roster, employees);
  const salesBy = new Map(sales.map((s) => [s.dayIndex, s.revenue]));
  return DAYS.map((day, dayIndex) => {
    const forDay = costs.filter((c) => c.dayIndex === dayIndex);
    const cost = forDay.reduce((s, c) => s + c.cost, 0);
    const revenue = salesBy.get(dayIndex);
    const sale = revenue != null && revenue > 0 ? revenue : null;
    return {
      day,
      dayIndex,
      shifts: forDay.length,
      hours: forDay.reduce((s, c) => s + c.hours, 0),
      cost,
      sales: sale,
      labourPct: sale ? (cost / sale) * 100 : null,
    };
  });
}

/** Labour % bands — the number an owner actually manages against. */
export function labourPctTone(pct: number): 'positive' | 'warning' | 'critical' {
  if (pct <= 25) return 'positive';
  if (pct <= 32) return 'warning';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Call-out coverage — who can actually take this shift.
// ---------------------------------------------------------------------------

/** Best-effort department → skill mapping so "eligible" means more than "free". */
export function skillForDepartment(department: string): SkillName | null {
  const d = department.toLowerCase();
  if (d.includes('receiv') || d.includes('goods in') || d.includes('intake')) return 'Receiving';
  if (d.includes('dispatch') || d.includes('despatch') || d.includes('outbound')) return 'Dispatch';
  if (d.includes('prep') || d.includes('kitchen') || d.includes('production')) return 'Prep Kitchen';
  if (d.includes('driver') || d.includes('driving') || d.includes('deliver') || d.includes('fleet')) return 'Driving';
  if (d.includes('customer') || d.includes('sales') || d.includes('front') || d.includes('counter')) return 'Customer Service';
  if (d.includes('stock') || d.includes('store') || d.includes('cold') || d.includes('warehouse') || d.includes('pack')) return 'Stock Handling';
  if (d.includes('device') || d.includes('scale') || d.includes('machine') || d.includes('line')) return 'Device Operation';
  return null;
}

export interface CoverCandidate {
  employee: Employee;
  /** Higher is a better match — used only for ordering the shortlist. */
  score: number;
  /** Why they are a good fit (green chips). */
  reasons: string[];
  /** Why to think twice (amber chips) — never a hard block, managers decide. */
  warnings: string[];
  /** Weekly hours if they take this shift. */
  projected: number;
  overtime: OvertimeAssessment;
  /** Hard-unavailable people are still listed, greyed, so the manager sees why. */
  available: boolean;
  unavailableReason: string | null;
}

/**
 * Rank staff for an open shift on skill, availability, department fit and
 * overtime headroom. Everyone is returned (with a reason) rather than silently
 * filtered — "why can nobody cover Thursday?" is the question being answered.
 */
export function eligibleForOpenShift(open: OpenShift, data: Pick<ShiftBoardData, 'employees' | 'roster'>): CoverCandidate[] {
  const dayIdx = DAYS.indexOf(open.day);
  const skill = skillForDepartment(open.department);
  const skillIdx = skill ? SKILL_NAMES.indexOf(skill) : -1;
  const rowBy = new Map(data.roster.rows.map((r) => [r.employeeId || r.name, r]));

  const candidates = data.employees
    .filter((e) => e.id !== open.fromEmployeeId)
    .map<CoverCandidate>((e) => {
      const row = rowBy.get(e.id) ?? rowBy.get(e.name);
      const cell = dayIdx >= 0 ? row?.days[dayIdx] : undefined;
      const next: Shift = { time: open.time, department: open.department, status: 'scheduled' };
      const overtime = assessOvertime(row, e, dayIdx >= 0 ? dayIdx : 0, next);

      const reasons: string[] = [];
      const warnings: string[] = [];
      let score = 0;
      let available = true;
      let unavailableReason: string | null = null;

      // Hard blocks — already committed elsewhere that day.
      if (cell?.status === 'scheduled') {
        available = false;
        unavailableReason = `Already on ${cell.time} that day`;
      } else if (cell?.status === 'leave' || e.status === 'On leave') {
        available = false;
        unavailableReason = 'On approved leave';
      } else if (e.unavailableDays.includes(open.day)) {
        available = false;
        unavailableReason = `Marked unavailable on ${open.day}`;
      }

      // Skill fit.
      const rating = skillIdx >= 0 ? (e.skills[skillIdx] ?? 0) : 0;
      if (skill && rating >= 4) {
        score += 40;
        reasons.push(`${skill} ${rating}/5`);
      } else if (skill && rating >= 2) {
        score += 18;
        reasons.push(`${skill} ${rating}/5`);
      } else if (skill) {
        warnings.push(`No ${skill} rating`);
      }

      // Department familiarity.
      if (e.department === open.department) {
        score += 25;
        reasons.push('Same department');
      } else if (e.currentDepartment === open.department) {
        score += 12;
        reasons.push('Works this department');
      }

      // Stated availability.
      if (e.availableDays.includes(open.day)) {
        score += 20;
        reasons.push(`Available ${open.day}`);
      }
      if (cell?.status === 'off') {
        score += 8;
        reasons.push('Rostered off');
      }

      // Overtime headroom — cheap cover beats expensive cover.
      if (overtime.level === 'over') {
        score -= 30;
        warnings.push(`Pushes to ${fmtHours(overtime.projected)} — ${fmtHours(overtime.over)} overtime`);
      } else if (overtime.level === 'near') {
        score -= 8;
        warnings.push(`Would be on ${fmtHours(overtime.projected)} of ${fmtHours(overtime.threshold)}`);
      } else {
        score += 10;
        reasons.push(`${fmtHours(overtime.threshold - overtime.projected)} of headroom`);
      }

      // Reliability nudges the shortlist, it never decides it.
      score += Math.round(e.attendanceScore / 10);

      if (!available) score -= 500;
      return { employee: e, score, reasons, warnings, projected: overtime.projected, overtime, available, unavailableReason };
    });

  return candidates.sort((a, b) => b.score - a.score || a.employee.name.localeCompare(b.employee.name));
}

export const LABOUR_COST_TODAY = 8450;

export function overviewStats(data: ShiftBoardData) {
  const { employees, attendance, roster } = data;
  const working = employees.filter((e) => e.status === 'Working').length;
  const rostered = employees.filter((e) => e.status !== 'Off' && e.status !== 'On leave').length;
  const overtimeRisk = employees.filter((e) => e.hoursThisWeek > e.contractedHours).length;
  const attendanceIssues = attendance.filter((a) => a.status === 'Late' || a.status === 'Absent').length;
  const openShifts = roster.openShifts.length;
  const callOuts = roster.openShifts.filter((o) => o.reason === 'call-out').length;
  const swapsAwaiting = (data.swaps ?? []).filter((s) => s.status === 'proposed' || s.status === 'accepted').length;
  const swapsToApprove = (data.swaps ?? []).filter((s) => s.status === 'accepted').length;
  // Prefer the roster's own costing — rate × rostered hours — over the flat
  // 8h-per-head estimate, and only fall back to the narrative constant when the
  // week has no costable shifts at all.
  const week = dailyLabour(roster, employees, data.sales ?? []);
  const rosterCostToday = week[data.todayIndex ?? 0]?.cost ?? 0;
  const weekCost = week.reduce((s, d) => s + d.cost, 0);
  const labourCost =
    Math.round(rosterCostToday) ||
    Math.round(employees.filter((e) => e.status === 'Working' || e.status === 'On break').reduce((s, e) => s + e.rate * 8, 0)) ||
    LABOUR_COST_TODAY;
  const weekSales = (data.sales ?? []).reduce((s, d) => s + d.revenue, 0);
  const labourPct = weekSales > 0 && weekCost > 0 ? (weekCost / weekSales) * 100 : null;
  return { working, rostered, overtimeRisk, attendanceIssues, openShifts, callOuts, swapsAwaiting, swapsToApprove, labourCost, weekCost, weekSales, labourPct };
}

// ---------------------------------------------------------------------------
// Illustrative constants (module narrative — not per-org data yet)
// ---------------------------------------------------------------------------

export interface LabourInsight {
  id: string;
  text: string;
  module?: VysoModuleKey;
}

export const LABOUR_INSIGHTS: LabourInsight[] = [
  { id: 'li1', text: 'Breakfast prep waste is highest when only 2 prep staff are scheduled — keep 3 on early mornings.', module: 'wastewatch' },
  { id: 'li2', text: 'Large receiving day tomorrow (4 deliveries) — add one receiving clerk from 07:00.', module: 'procurepulse' },
  { id: 'li3', text: 'Delivery volume is 18% higher on Fridays — schedule another driver.', module: 'orderflow' },
  { id: 'li4', text: 'Labour cost is tracking 7% above plan this month.', module: 'insightgen' },
  { id: 'li5', text: 'Dispatch is consistently short on weekday afternoons — recurring open shift.' },
  { id: 'li6', text: 'Overtime is concentrated in prep & packing — rebalance the late shift.' },
];

export const LABOUR_COST_TREND = [7800, 8200, 7900, 8600, 8450, 8100, 7700];
export const OVERTIME_TREND = [4, 6, 5, 8, 7, 9, 6];
export const ATTENDANCE_TREND = { lateArrivals: [2, 1, 3, 1, 2, 1, 0], absences: [0, 1, 0, 1, 1, 0, 0] };

export interface OperationalAlert {
  id: string;
  text: string;
  tone: 'warning' | 'critical' | 'info';
  module?: VysoModuleKey;
}

/** Derive a few operational alerts from the live data (falls back to none). */
export function operationalAlerts(data: ShiftBoardData): OperationalAlert[] {
  const dynamic: OperationalAlert[] = [];
  // Call-outs and swaps waiting on a manager come first — they are the two
  // things that silently fall out of the system into a phone conversation.
  const callOuts = data.roster.openShifts.filter((o) => o.reason === 'call-out');
  if (callOuts.length) {
    const first = callOuts[0];
    dynamic.push({
      id: 'callout',
      text: `${callOuts.length === 1 ? `${first.fromName ?? 'Someone'} called out of ${first.day} ${first.time} (${first.department})` : `${callOuts.length} call-outs this week`} — cover offer is open.`,
      tone: 'critical',
    });
  }
  const toApprove = (data.swaps ?? []).filter((s) => s.status === 'accepted');
  if (toApprove.length) {
    dynamic.push({ id: 'swaps', text: `${toApprove.length} shift ${toApprove.length === 1 ? 'swap is' : 'swaps are'} waiting on your approval.`, tone: 'warning' });
  }
  const snaps = departmentSnapshots(data.employees, data.departments);
  for (const s of snaps.filter((x) => x.status === 'short')) {
    dynamic.push({ id: `short-${s.name}`, text: `${s.name} is understaffed — ${s.working} of ${s.required} on shift.`, tone: s.required - s.working > 1 ? 'critical' : 'warning' });
  }
  const ot = data.employees.filter((e) => e.hoursThisWeek > e.contractedHours);
  if (ot[0]) dynamic.push({ id: 'ot', text: `${ot[0].name} is approaching overtime (${ot[0].hoursThisWeek}h this week).`, tone: 'warning' });
  const away = data.employees.filter((e) => e.status === 'On leave' || e.status === 'Absent');
  if (away.length >= 2) dynamic.push({ id: 'away', text: `${away.length} staff unavailable today (${away.slice(0, 2).map((e) => e.name).join(', ')}${away.length > 2 ? '…' : ''}).`, tone: 'critical' });
  // Keep the cross-module chip guaranteed by appending it after capping the
  // dynamic alerts (otherwise many short departments would crowd it out).
  return [...dynamic.slice(0, 4), { id: 'a5', text: 'Delivery volume up 18% on Friday — consider another driver.', tone: 'info', module: 'orderflow' }];
}
