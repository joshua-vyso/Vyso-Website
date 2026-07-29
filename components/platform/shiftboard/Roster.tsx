'use client';

import { useMemo, useState } from 'react';
import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard } from '@/components/platform/module-ui';
import { zar } from '@/lib/platform/orderflow';
import {
  DAYS,
  dailyLabour,
  fmtHours,
  openShiftKey,
  overtimeThreshold,
  rowHours,
  type OpenShift,
  type RosterRow,
  type Shift,
} from '@/lib/platform/shiftboard';
import { BTN_PRIMARY, BTN_SECONDARY, ConflictBadge, EmptyState, FIELD_CLASS, FieldLabel, ModalShell } from './shared';
import { SwapsPanel } from './Swaps';
import { useShiftBoard } from './context';

export function Roster() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const [view, setView] = useState<'week' | 'day'>('week');
  const [day, setDay] = useState(DAYS[0]);
  const [dept, setDept] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  /** Roster rows can predate the sb_employees link, so fall back to the name. */
  const employeeIdFor = useMemo(() => {
    const byName = new Map(sb.employees.map((e) => [e.name, e.id]));
    return (r: RosterRow) => r.employeeId || byName.get(r.name) || '';
  }, [sb.employees]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sb.roster.rows.filter((r) => (dept === 'all' || r.department === dept) && (!q || `${r.name} ${r.role}`.toLowerCase().includes(q)));
  }, [sb.roster, dept, search]);

  const week = useMemo(() => dailyLabour(sb.roster, sb.employees, sb.sales), [sb.roster, sb.employees, sb.sales]);
  const weekCost = week.reduce((s, d) => s + d.cost, 0);

  const sel = 'h-11 rounded-[12px] border border-[#E4E9F0] bg-white px-3.5 text-[14px] text-[#3E4A57] outline-none focus:border-[#3E7BC4]';
  const dayIdx = DAYS.indexOf(day);

  function edit(row: RosterRow, idx: number) {
    const id = employeeIdFor(row);
    if (!id) {
      show(`${row.name} is not linked to a staff record yet.`);
      return;
    }
    sb.openEditor(id, idx);
  }

  const openShifts = sb.roster.openShifts;
  const callOuts = openShifts.filter((o) => o.reason === 'call-out').length;

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="of-display text-[20px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Roster</h2>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Plan shifts, spot conflicts and fill open slots</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={sb.openSwaps} className={BTN_SECONDARY}>
            Swap centre
            {sb.swaps.filter((s) => s.status === 'accepted').length ? (
              <span className="of-num ml-2 rounded-full bg-[#FBEEDA] px-1.5 py-0.5 text-[11px] font-semibold text-[#854F0B]">
                {sb.swaps.filter((s) => s.status === 'accepted').length}
              </span>
            ) : null}
          </button>
          <button type="button" onClick={() => setAiOpen(true)} className={BTN_SECONDARY}>
            ✦ Generate best roster
          </button>
          <button type="button" onClick={() => setCreateOpen(true)} className={BTN_PRIMARY} disabled={sb.employees.length === 0}>
            + Create shift
          </button>
        </div>
      </div>

      {sb.isEmpty ? (
        <EmptyState
          title="No people set up yet"
          hint="Add employees and departments and the weekly grid, open shifts and swap requests all appear here."
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-11 items-center gap-1 rounded-[12px] border border-[#E4E9F0] bg-white px-1.5">
              <button type="button" onClick={() => show('Previous week (demo)')} className="rounded-[8px] px-2 py-1 text-[14px] text-[#A0A49C] transition-colors hover:text-[#174C87]">‹</button>
              <span className="of-num px-1.5 text-[14px] font-medium text-[#171A17]">{sb.roster.label || 'This week'}</span>
              <button type="button" onClick={() => show('Next week (demo)')} className="rounded-[8px] px-2 py-1 text-[14px] text-[#A0A49C] transition-colors hover:text-[#174C87]">›</button>
            </div>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={sel}>
              <option value="all">All departments</option>
              {sb.departments.map((d) => (
                <option key={d.name} value={d.name}>{d.name}</option>
              ))}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff…" className="h-11 min-w-[180px] flex-1 rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]" />
            {view === 'day' ? (
              <select value={day} onChange={(e) => setDay(e.target.value)} className={sel}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : null}
            <div className="inline-flex h-11 items-center rounded-[12px] bg-[#F2F2EF] p-1">
              {(['week', 'day'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium capitalize transition-colors ${view === v ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'text-[#8A8E86] hover:text-[#171A17]'}`}>{v}</button>
              ))}
            </div>
          </div>

          {/* Roster grid */}
          <SectionCard
            title={view === 'week' ? 'Weekly schedule' : `${day} schedule`}
            right={
              <span className="text-[12px] text-[#A0A49C]">
                week labour <span className="of-num font-semibold text-[#171A17]">{zar(weekCost)}</span>
              </span>
            }
          >
            {view === 'week' ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-[12px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                      <th className="px-2 py-2 text-left font-medium">Staff</th>
                      {DAYS.map((d, i) => (
                        <th key={d} className={`px-2 py-2 text-center font-medium ${i === sb.todayIndex ? 'text-[#1F5FA8]' : ''}`}>
                          {d}
                          {i === sb.todayIndex ? <span className="ml-1 normal-case tracking-normal text-[9px]">today</span> : null}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-medium">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-[14px] text-[#8A8E86]">No staff match your filters.</td>
                      </tr>
                    ) : (
                      rows.map((r) => {
                        const employee = sb.employeeById(employeeIdFor(r));
                        const hours = rowHours(r.days);
                        const threshold = overtimeThreshold(employee);
                        const over = hours > threshold;
                        return (
                          <tr key={r.rowId ?? r.name} className="border-t border-[#EEF1F5] align-top">
                            <td className="px-2 py-2">
                              <div className="text-[13px] font-semibold text-[#171A17]">{r.name}</div>
                              <div className="flex items-center gap-1.5 text-[11px] text-[#A0A49C]">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sb.deptColor(r.department) }} />
                                {r.department}
                              </div>
                            </td>
                            {r.days.map((sh, i) => (
                              <td key={i} className="px-1 py-1.5">
                                <ShiftCell s={sh} onClick={() => edit(r, i)} />
                              </td>
                            ))}
                            <td className="px-2 py-2 text-right">
                              <span className="of-num text-[12px] font-semibold" style={{ color: over ? '#854F0B' : '#6B6F68' }} title={`Contracted ${fmtHours(threshold)}`}>
                                {fmtHours(hours)}
                              </span>
                              <div className="of-num text-[10px] text-[#A0A49C]">of {fmtHours(threshold)}</div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {rows.length ? (
                    <tfoot>
                      <tr className="border-t border-[#EEF1F5] text-[11px] text-[#A0A49C]">
                        <td className="px-2 py-2 font-medium uppercase tracking-[0.06em]">Labour cost</td>
                        {week.map((d) => (
                          <td key={d.day} className="of-num px-1 py-2 text-center text-[#6B6F68]">{d.cost > 0 ? zar(d.cost) : '—'}</td>
                        ))}
                        <td className="of-num px-2 py-2 text-right font-semibold text-[#171A17]">{zar(weekCost)}</td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            ) : (
              (() => {
                const dayRows = rows.filter((r) => r.days[dayIdx]?.status === 'scheduled');
                if (dayRows.length === 0) return <p className="py-8 text-center text-[14px] text-[#8A8E86]">No one scheduled for {day} in this view.</p>;
                return (
                  <div className="flex flex-col gap-2">
                    {dayRows.map((r) => {
                      const sh = r.days[dayIdx];
                      return (
                        <button
                          key={r.rowId ?? r.name}
                          type="button"
                          onClick={() => edit(r, dayIdx)}
                          className="flex w-full items-center justify-between rounded-[14px] border border-[#EEF1F5] bg-white px-3.5 py-2.5 text-left transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE]"
                        >
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(r.department) }} />
                            <span className="text-[14px] font-semibold text-[#171A17]">{r.name}</span>
                            <span className="text-[12px] text-[#A0A49C]">{r.department}</span>
                          </span>
                          <span className="flex items-center gap-3">
                            {sh.conflict ? <ConflictBadge conflict={sh.conflict} /> : null}
                            <span className="of-num text-[13px] font-semibold text-[#171A17]">{sh.time}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </SectionCard>

          {/* Open shifts + cover offers */}
          <SectionCard
            title="Open shifts"
            right={
              <span className="text-[12px] text-[#A0A49C]">
                <span className="of-num">{openShifts.length}</span> unfilled
                {callOuts ? <span className="ml-2 rounded-full bg-[#FCEBEB] px-2 py-0.5 text-[11px] font-medium text-[#A32D2D]"><span className="of-num">{callOuts}</span> call-out</span> : null}
              </span>
            }
          >
            {openShifts.length === 0 ? (
              <EmptyState
                title="Every shift is covered"
                hint="Mark a shift as a call-out from the roster grid and it appears here as an open offer with a matched shortlist."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {openShifts.map((o) => (
                  <OpenShiftCard key={openShiftKey(o)} o={o} onFindCover={() => sb.openCover(openShiftKey(o))} />
                ))}
              </div>
            )}
          </SectionCard>

          <SwapsPanel />
        </>
      )}

      <CreateShiftModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <AiRosterModal open={aiOpen} onClose={() => setAiOpen(false)} onGenerate={() => { setAiOpen(false); show('Draft roster generated (demo)'); }} />
    </div>
  );
}

const AI_INPUTS = ['Availability', 'Skills', 'Labour cost', 'Leave', 'Departments', 'Overtime', 'Expected workload'];

function AiRosterModal({ open, onClose, onGenerate }: { open: boolean; onClose: () => void; onGenerate: () => void }) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="✦ Generate best roster"
      subtitle="AI scheduling will build a draft week for you to review."
      width={440}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
          <button type="button" onClick={onGenerate} className={BTN_PRIMARY}>Generate draft</button>
        </>
      }
    >
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">It will balance</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {AI_INPUTS.map((i) => (
          <span key={i} className="rounded-full border border-[#EEF1F5] bg-[#F5F9FE] px-2.5 py-1 text-[12px] text-[#6B6F68]">{i}</span>
        ))}
      </div>
      <p className="mt-4 rounded-[12px] bg-[#F5F9FE] px-3.5 py-2.5 text-[12px] text-[#6B6F68]">
        Coming soon. It will draft a conflict-free roster that minimises labour cost and overtime while keeping every department covered — then you approve or tweak it.
      </p>
    </ModalShell>
  );
}

function ShiftCell({ s, onClick }: { s: Shift; onClick: () => void }) {
  if (s.status === 'leave') {
    return (
      <button type="button" onClick={onClick} className="flex w-full justify-center rounded-[8px] bg-[#FBEEDA] py-1.5 text-[11px] font-medium text-[#854F0B] transition-colors hover:brightness-95">
        Leave
      </button>
    );
  }
  if (s.status === 'open') {
    return (
      <button type="button" onClick={onClick} className="flex w-full justify-center rounded-[8px] border border-dashed border-[#E4A6A6] bg-[#FCF1F1] py-1.5 text-[11px] font-medium text-[#A32D2D] transition-colors hover:border-[#A32D2D]">
        Open
      </button>
    );
  }
  if (s.status === 'off') {
    return (
      <button type="button" onClick={onClick} className="group flex w-full justify-center rounded-[8px] bg-[#EEF1F5] py-1.5 text-[11px] font-medium text-[#8A8E86] transition-colors hover:bg-[#EAF2FC] hover:text-[#1F5FA8]">
        <span className="group-hover:hidden">Off</span>
        <span className="hidden group-hover:inline">+ Add</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-[8px] border px-1.5 py-1 text-left transition-colors ${s.conflict ? 'border-[#F3C7C7] bg-[#FCF1F1]' : 'border-[#DCE8F7] bg-[#F5F9FE] hover:border-[#3E7BC4]'}`} title={s.department}>
      <div className="of-num text-[11px] font-semibold text-[#171A17]">{s.time}</div>
      {s.conflict ? <div className="mt-0.5"><ConflictBadge conflict={s.conflict} /></div> : <div className="mt-0.5 text-[10px] text-[#A0A49C]">{s.department}</div>}
    </button>
  );
}

function OpenShiftCard({ o, onFindCover }: { o: OpenShift; onFindCover: () => void }) {
  const sb = useShiftBoard();
  const isCallOut = o.reason === 'call-out';
  return (
    <div className={`rounded-[14px] border border-dashed p-3.5 ${isCallOut ? 'border-[#E4A6A6] bg-[#FDF6F6]' : 'border-[#E2E6EC] bg-[#FBFCFE]'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#171A17]">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(o.department) }} />
          {o.department}
        </div>
        {isCallOut ? <span className="rounded-full bg-[#FCEBEB] px-2 py-0.5 text-[10px] font-medium text-[#A32D2D]">Call-out</span> : null}
      </div>
      <div className="mt-1 text-[12px] text-[#A0A49C]">
        {o.day} · <span className="of-num">{o.time}</span>
      </div>
      {isCallOut && o.fromName ? (
        <div className="mt-1 text-[12px] text-[#6B6F68]">
          {o.fromName} is out{o.note ? ` — ${o.note}` : ''}
        </div>
      ) : null}
      <button type="button" onClick={onFindCover} className="mt-2.5 inline-flex h-[34px] w-full items-center justify-center rounded-[10px] bg-[#1F5FA8] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]">
        Find cover
      </button>
    </div>
  );
}

/** Pick who and when, then hand off to the shift editor for the detail. */
function CreateShiftModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sb = useShiftBoard();
  const [employeeId, setEmployeeId] = useState('');
  const [day, setDay] = useState(DAYS[0]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Create a shift"
      subtitle="Pick who and which day — times, department and overtime come next."
      width={440}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!employeeId}
            onClick={() => {
              const idx = DAYS.indexOf(day);
              onClose();
              sb.openEditor(employeeId, idx < 0 ? 0 : idx);
            }}
          >
            Continue
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <FieldLabel>Employee</FieldLabel>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={FIELD_CLASS}>
            <option value="">Select someone…</option>
            {sb.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.department}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Day</FieldLabel>
          <select value={day} onChange={(e) => setDay(e.target.value)} className={FIELD_CLASS}>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
    </ModalShell>
  );
}
