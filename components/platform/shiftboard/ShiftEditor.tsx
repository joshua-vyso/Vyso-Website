'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/platform/orderflow/ui';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import {
  DAYS,
  assessOvertime,
  fmtHours,
  formatShiftWindow,
  parseShiftWindow,
  shiftHours,
  timeOptions,
  type Employee,
  type RosterRow,
  type Shift,
  type ShiftStatus,
} from '@/lib/platform/shiftboard';
import { ensureRosterRow, markCallOut, saveRosterCell } from '@/lib/platform/shiftboard-write';
import { zar } from '@/lib/platform/orderflow';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FIELD_CLASS, FieldLabel, ModalShell } from './shared';
import { useShiftBoard } from './context';

const TIMES = timeOptions(30);

/** Decimal hours → 'HH:MM' for the start/end pickers. */
function toLabel(h: number): string {
  const mins = Math.round(h * 60);
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const STATUS_CHOICES: { value: ShiftStatus; label: string; hint: string }[] = [
  { value: 'scheduled', label: 'Working', hint: 'A paid shift on the roster' },
  { value: 'off', label: 'Off', hint: 'Not scheduled that day' },
  { value: 'leave', label: 'Leave', hint: 'Approved time off' },
];

/**
 * Create / edit / assign one roster cell.
 *
 * The form is keyed on the cell being edited so opening a different day mounts
 * a fresh form seeded from that cell — no reset effect chasing prop changes.
 */
export function ShiftEditor() {
  const sb = useShiftBoard();
  const editing = sb.editing;
  const employee = sb.employeeById(editing?.employeeId);
  if (!editing || !employee) return null;
  return <ShiftEditorForm key={`${editing.employeeId}:${editing.dayIdx}`} employee={employee} dayIdx={editing.dayIdx} />;
}

function ShiftEditorForm({ employee, dayIdx }: { employee: Employee; dayIdx: number }) {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const router = useRouter();
  const { org } = usePlatform();

  const row = sb.rowFor(employee.id, employee.name);
  const day = DAYS[dayIdx] ?? '';
  const existing: Shift | undefined = row?.days[dayIdx];
  const initialWindow = parseShiftWindow(existing?.time);

  const [status, setStatus] = useState<ShiftStatus>(
    existing?.status === 'scheduled' || existing?.status === 'leave' ? existing.status : existing?.status === 'open' ? 'scheduled' : 'off',
  );
  const [department, setDepartment] = useState(existing?.department ?? employee.department ?? sb.departments[0]?.name ?? '');
  const [start, setStart] = useState(initialWindow ? toLabel(initialWindow.start) : '08:00');
  const [end, setEnd] = useState(initialWindow ? toLabel(initialWindow.end) : '16:00');
  const [saving, setSaving] = useState(false);
  const [callOutNote, setCallOutNote] = useState('');
  const [callOutMode, setCallOutMode] = useState(false);

  const time = formatShiftWindow(start, end);
  const hours = status === 'scheduled' ? shiftHours(time) : 0;

  const next: Shift | null =
    status === 'off' ? null : status === 'leave' ? { time: '', status: 'leave' } : { time, department, status: 'scheduled' };

  // Recomputed on every keystroke of the pickers, so the manager sees the
  // overtime an assignment creates before saving it — not on the payroll run.
  const ot = assessOvertime(row, employee, dayIdx, next);
  const cost = hours * employee.rate;

  async function save() {
    if (!org) return;
    if (status === 'scheduled' && hours <= 0) {
      show('End time must be after start time.');
      return;
    }
    const db = createClient();
    if (!db) return;
    setSaving(true);

    // Flag the cell when the assignment itself creates the overtime, so the
    // grid keeps showing why long after the editor has closed.
    const cell: Shift | null = next && next.status === 'scheduled' && ot.level === 'over' ? { ...next, conflict: 'Overtime risk' } : next;

    let target: RosterRow | undefined = row;
    if (!target?.rowId) {
      const created = await ensureRosterRow(db, org.id, employee, sb.roster.label, sb.roster.openShifts);
      if (created.error || !created.rowId) {
        setSaving(false);
        show(`Couldn't save: ${created.error ?? 'no roster row'}`);
        return;
      }
      target = {
        rowId: created.rowId,
        employeeId: employee.id,
        name: employee.name,
        role: employee.role,
        department: employee.department,
        days: Array.from({ length: 7 }, () => ({ time: '', status: 'off' as const })),
      };
    }

    const { error } = await saveRosterCell(db, target, dayIdx, cell);
    setSaving(false);
    if (error) {
      show(`Couldn't save: ${error}`);
      return;
    }
    show(status === 'off' ? `${employee.name} is off on ${day}` : `${day} shift saved for ${employee.name}`);
    sb.closeEditor();
    router.refresh();
  }

  async function callOut() {
    if (!org || !row?.rowId) return;
    const db = createClient();
    if (!db) return;
    setSaving(true);
    const { error } = await markCallOut(db, org.id, sb.roster, row, dayIdx, callOutNote.trim());
    setSaving(false);
    if (error) {
      show(`Couldn't save: ${error}`);
      return;
    }
    show(`${employee.name}'s ${day} shift is now an open cover offer`);
    sb.closeEditor();
    router.refresh();
  }

  const canCallOut = existing?.status === 'scheduled' && !!row?.rowId;

  return (
    <>
      {node}
      <ModalShell
        open
        onClose={sb.closeEditor}
        title={callOutMode ? `Call-out — ${employee.name}` : existing?.status === 'scheduled' ? `Edit ${day} shift` : `Add ${day} shift`}
        subtitle={`${employee.name} · ${employee.role || employee.department}`}
        width={520}
        footer={
          callOutMode ? (
            <>
              <button type="button" className={BTN_SECONDARY} onClick={() => setCallOutMode(false)} disabled={saving}>
                Back
              </button>
              <button type="button" className={BTN_DANGER} onClick={() => void callOut()} disabled={saving}>
                {saving ? 'Releasing…' : 'Release shift & open cover'}
              </button>
            </>
          ) : (
            <>
              {canCallOut ? (
                <div className="mr-auto flex flex-wrap gap-2">
                  <button type="button" className={BTN_SECONDARY} onClick={() => setCallOutMode(true)} disabled={saving}>
                    Mark call-out
                  </button>
                  <button
                    type="button"
                    className={BTN_SECONDARY}
                    disabled={saving}
                    onClick={() => {
                      sb.closeEditor();
                      sb.openSwapDraft(employee.id, dayIdx);
                    }}
                  >
                    Offer for swap
                  </button>
                </div>
              ) : null}
              <button type="button" className={BTN_SECONDARY} onClick={sb.closeEditor} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save shift'}
              </button>
            </>
          )
        }
      >
        {callOutMode ? (
          <div className="space-y-3">
            <div className="rounded-[12px] bg-[#FCEBEB] px-3.5 py-3 text-[13px] text-[#A32D2D]">
              {employee.name}&rsquo;s {day} <span className="of-num">{existing?.time}</span> shift will be released and offered to eligible staff. Their roster cell becomes an open shift until someone is assigned.
            </div>
            <div>
              <FieldLabel>Reason (optional — shown on the cover offer)</FieldLabel>
              <input
                value={callOutNote}
                onChange={(e) => setCallOutNote(e.target.value)}
                placeholder="Sick, transport, family emergency…"
                className={FIELD_CLASS}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status */}
            <div className="grid grid-cols-3 gap-2">
              {STATUS_CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setStatus(c.value)}
                  className={`rounded-[12px] border px-3 py-2.5 text-left transition-colors ${
                    status === c.value ? 'border-[#3E7BC4] bg-[#F5F9FE]' : 'border-[#E4E9F0] bg-white hover:border-[#C9DEF7]'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-[#171A17]">{c.label}</div>
                  <div className="mt-0.5 text-[11px] text-[#8A8E86]">{c.hint}</div>
                </button>
              ))}
            </div>

            {status === 'scheduled' ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <FieldLabel>Start</FieldLabel>
                    <select value={start} onChange={(e) => setStart(e.target.value)} className={FIELD_CLASS}>
                      {TIMES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>End</FieldLabel>
                    <select value={end} onChange={(e) => setEnd(e.target.value)} className={FIELD_CLASS}>
                      {TIMES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Department</FieldLabel>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)} className={FIELD_CLASS}>
                      {sb.departments.length === 0 ? <option value="">—</option> : null}
                      {sb.departments.map((d) => (
                        <option key={d.name} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cost of this one shift — labour cost stops being a month-end surprise. */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[12px] bg-[#F5F9FE] px-3.5 py-2.5 text-[13px]">
                  <span className="text-[#6B6F68]">
                    Length <span className="of-num font-semibold text-[#171A17]">{fmtHours(hours)}</span>
                  </span>
                  <span className="text-[#6B6F68]">
                    Rate <span className="of-num font-semibold text-[#171A17]">{zar(employee.rate)}</span>/h
                  </span>
                  <span className="text-[#6B6F68]">
                    Shift cost <span className="of-num font-semibold text-[#171A17]">{zar(cost)}</span>
                  </span>
                </div>
              </>
            ) : null}

            {/* Overtime risk at scheduling time */}
            <OvertimeNotice level={ot.level} message={ot.message} projected={ot.projected} threshold={ot.threshold} />
          </div>
        )}
      </ModalShell>
    </>
  );
}

function OvertimeNotice({ level, message, projected, threshold }: { level: 'ok' | 'near' | 'over'; message: string; projected: number; threshold: number }) {
  const tone =
    level === 'over'
      ? { bg: '#FCEBEB', fg: '#A32D2D', bar: '#A32D2D', icon: '▲' }
      : level === 'near'
        ? { bg: '#FBEEDA', fg: '#854F0B', bar: '#854F0B', icon: '▲' }
        : { bg: '#E1F5EE', fg: '#0F6E56', bar: '#0F6E56', icon: '✓' };
  const pct = threshold > 0 ? Math.min(100, (projected / threshold) * 100) : 0;
  return (
    <div className="rounded-[12px] px-3.5 py-3" style={{ backgroundColor: tone.bg }}>
      <div className="flex items-start gap-2 text-[13px]" style={{ color: tone.fg }}>
        <span className="mt-0.5 text-[10px]">{tone.icon}</span>
        <span className="min-w-0 flex-1">{message}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tone.bar, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}
