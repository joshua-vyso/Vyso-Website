'use client';

import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard } from '@/components/platform/module-ui';
import { departmentSnapshots, eligibleForOpenShift, openShiftKey } from '@/lib/platform/shiftboard';
import { DeptBadge, StatusBadge, CoverageBadge, EmptyState } from './shared';
import { activeSwaps } from './Swaps';
import { useShiftBoard } from './context';

const QUICK_ACTIONS = ['Assign staff', 'Reassign department', 'Mark on break', 'Mark absent', 'Add replacement'];

export function LiveOps() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const snapshots = departmentSnapshots(sb.employees, sb.departments);
  const active = sb.employees.filter((e) => e.status === 'Working' || e.status === 'On break');
  const openShifts = sb.roster.openShifts;
  const swapsWaiting = activeSwaps(sb.swaps).filter((s) => s.status === 'accepted').length;

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display flex items-center gap-2.5 text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">
            Live operations
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F5EE] px-2.5 py-1 text-[11px] font-medium text-[#0F6E56]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0F6E56]" />Live</span>
          </h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Who&rsquo;s working right now, where they are, and what they&rsquo;re doing</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((a) => (
          <button key={a} type="button" onClick={() => show(`${a} (demo)`)} className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">{a}</button>
        ))}
      </div>

      {/* Cover needed — call-outs and unfilled shifts, with a matched shortlist */}
      <SectionCard
        title="Cover needed"
        right={
          <span className="flex items-center gap-2 text-[12px] text-[#A0A49C]">
            <span><span className="of-num">{openShifts.length}</span> open</span>
            {swapsWaiting ? (
              <button type="button" onClick={sb.openSwaps} className="rounded-full bg-[#FBEEDA] px-2 py-0.5 text-[11px] font-medium text-[#854F0B] hover:brightness-95">
                <span className="of-num">{swapsWaiting}</span> swap{swapsWaiting === 1 ? '' : 's'} to approve
              </button>
            ) : null}
          </span>
        }
      >
        {openShifts.length === 0 ? (
          <EmptyState
            title="Nothing needs covering"
            hint="If someone calls out, release their shift from the Roster tab — it lands here with a ranked list of who can actually work it."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openShifts.map((o) => {
              const shortlist = eligibleForOpenShift(o, { employees: sb.employees, roster: sb.roster }).filter((c) => c.available);
              const top = shortlist.slice(0, 2);
              const isCallOut = o.reason === 'call-out';
              return (
                <div key={openShiftKey(o)} className={`rounded-[14px] border border-dashed p-3.5 ${isCallOut ? 'border-[#E4A6A6] bg-[#FDF6F6]' : 'border-[#E2E6EC] bg-[#FBFCFE]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[#171A17]">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(o.department) }} />
                      {o.department}
                    </span>
                    {isCallOut ? <span className="rounded-full bg-[#FCEBEB] px-2 py-0.5 text-[10px] font-medium text-[#A32D2D]">Call-out</span> : null}
                  </div>
                  <div className="mt-1 text-[12px] text-[#A0A49C]">{o.day} · <span className="of-num">{o.time}</span></div>
                  {isCallOut && o.fromName ? <div className="mt-1 text-[12px] text-[#6B6F68]">{o.fromName} is out{o.note ? ` — ${o.note}` : ''}</div> : null}
                  <div className="mt-2 text-[12px] text-[#6B6F68]">
                    {top.length === 0 ? (
                      <span className="text-[#A32D2D]">No eligible staff free</span>
                    ) : (
                      <>
                        <span className="text-[#A0A49C]">Best match{top.length > 1 ? 'es' : ''}: </span>
                        {top.map((c) => c.employee.name).join(', ')}
                        {shortlist.length > top.length ? <span className="text-[#A0A49C]"> +{shortlist.length - top.length} more</span> : null}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => sb.openCover(openShiftKey(o))}
                    className="mt-2.5 inline-flex h-[34px] w-full items-center justify-center rounded-[10px] bg-[#1F5FA8] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]"
                  >
                    Find cover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Live department map */}
      <div>
        <h2 className="of-display mb-2.5 text-[16px] font-semibold text-[#171A17]">Live department map</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {snapshots.map((d) => (
            <div key={d.name} className="rounded-2xl border border-[#EAEDF2] bg-white p-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
              <div className="flex items-start justify-between gap-2">
                <span className="of-display flex items-center gap-2 text-[15px] font-semibold text-[#171A17]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />{d.name}</span>
                <CoverageBadge status={d.status} />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="of-num text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{d.working}</span>
                <span className="text-[13px] text-[#8A8E86]">/ <span className="of-num">{d.required}</span> staffed</span>
                {d.status === 'short' ? <span className="ml-1 text-[12px] font-medium text-[#A32D2D]">Short by <span className="of-num">{d.required - d.working}</span></span> : null}
                {d.status === 'overstaffed' ? <span className="of-num ml-1 text-[12px] font-medium text-[#0C447C]">+{d.working - d.required}</span> : null}
              </div>
              <div className="mt-3 flex flex-col gap-1.5 border-t border-[#EEF1F5] pt-3">
                {d.staff.length === 0 ? (
                  <span className="text-[12px] text-[#A0A49C]">No one currently in this department.</span>
                ) : (
                  d.staff.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate text-[#171A17]">{e.name}</span>
                      <span className="shrink-0 text-[12px] text-[#8A8E86]">{e.currentTask}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active staff feed */}
      <SectionCard title="Active staff feed" right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{active.length}</span> on shift now</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                {['Employee', 'Department', 'Current task', 'Shift', 'Status', 'Device'].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((e) => (
                <tr key={e.id} className="border-b border-[#F5F9FE] last:border-0">
                  <td className="px-2 py-2.5 font-semibold text-[#171A17]">{e.name}</td>
                  <td className="px-2 py-2.5"><DeptBadge department={e.currentDepartment ?? e.department} /></td>
                  <td className="px-2 py-2.5 text-[#6B6F68]">{e.currentTask ?? '—'}{e.currentRecipe ? <span className="ml-1 text-[12px] text-[#A0A49C]">· {e.currentRecipe}</span> : null}</td>
                  <td className="of-num px-2 py-2.5 text-[#6B6F68]">{e.shiftTime}</td>
                  <td className="px-2 py-2.5"><StatusBadge status={e.status} /></td>
                  <td className="px-2 py-2.5">
                    {e.assignedDevice ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1FB] px-2.5 py-1 text-[11px] font-medium text-[#0C447C]">{e.assignedDevice}</span>
                    ) : (
                      <span className="text-[12px] text-[#A0A49C]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2.5 text-[12px] text-[#A0A49C]">Device column links each person to the WasteWatch scale/station they&rsquo;re using — the foundation for automatic waste capture per operator.</p>
      </SectionCard>
    </div>
  );
}
