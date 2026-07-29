'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, Kpi, SectionCard, DataTable } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { zar } from '@/lib/platform/orderflow';
import { DAYS, departmentSnapshots, overviewStats, operationalAlerts, openShiftKey, type RosterRow, type Shift } from '@/lib/platform/shiftboard';
import { DeptBadge, StatusBadge, CoverageBadge, EmptyState, MobileSnapshotCards } from './shared';
import { SwapsPanel } from './Swaps';
import { useShiftBoard } from './context';

const M = MODULE_META.shiftboard;

function cellTone(s: Shift) {
  if (s.status === 'off') return { bg: '#EEF1F5', fg: '#8A8E86' };
  if (s.status === 'leave') return { bg: '#FBEEDA', fg: '#854F0B' };
  if (s.status === 'open') return { bg: '#FCEBEB', fg: '#A32D2D' };
  return { bg: '#EAF2FC', fg: '#1F5FA8' };
}

export function ShiftBoardOverview() {
  const { node, show } = useToast();
  const sb = useShiftBoard();
  const router = useRouter();

  const header = <ModuleHeader icon={M.icon} title={M.name} description="Who's working, where, on what — and whether you're properly staffed today." actions={<PrimaryAction onClick={() => router.push('/app/shiftboard/roster')}>+ Create shift</PrimaryAction>} />;

  if (sb.isEmpty) {
    return (
      <div className="space-y-5">
        {node}
        {header}
        <EmptyState
          title="No people set up yet"
          hint="Add employees and departments to see who’s on shift, staffing coverage and labour cost here."
        />
      </div>
    );
  }

  const s = overviewStats(sb);
  const snapshots = departmentSnapshots(sb.employees, sb.departments);
  const alerts = operationalAlerts(sb);
  const openShifts = sb.roster.openShifts;

  /** Roster rows can predate the sb_employees link, so fall back to the name. */
  const idFor = (r: RosterRow) => r.employeeId || sb.employees.find((e) => e.name === r.name)?.id || '';

  return (
    <div className="space-y-5">
      {node}
      {header}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Staff on shift today" value={String(s.rostered)} sub="rostered" />
        <Kpi label="Currently working" value={String(s.working)} accent="#0F6E56" sub="clocked in" />
        <Kpi label="Open shifts" value={String(s.openShifts)} accent={s.openShifts > 0 ? '#854F0B' : undefined} sub={s.callOuts > 0 ? `${s.callOuts} from call-outs` : 'this week'} />
        <Kpi label="Labour cost today" value={zar(s.labourCost)} sub={s.labourPct != null ? `${s.labourPct.toFixed(1)}% of sales this week` : 'rate × rostered hours'} />
        <Kpi label="Overtime risk" value={String(s.overtimeRisk)} accent={s.overtimeRisk > 0 ? '#854F0B' : undefined} sub="over contracted" />
        <Kpi label="Attendance issues" value={String(s.attendanceIssues)} accent={s.attendanceIssues > 0 ? '#A32D2D' : undefined} sub="late or absent" />
      </div>

      {/* Weekly roster */}
      <SectionCard title="Weekly roster" right={<span className="of-num text-[12px] text-[#A0A49C]">{sb.roster.label}</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                <th className="px-2 py-2 text-left font-medium">Staff</th>
                {DAYS.map((d) => (<th key={d} className="px-2 py-2 text-center font-medium">{d}</th>))}
              </tr>
            </thead>
            <tbody>
              {sb.roster.rows.map((r) => (
                <tr key={r.employeeId} className="border-t border-[#EEF1F5]">
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-[#171A17]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sb.deptColor(r.department) }} />{r.name}</span>
                  </td>
                  {r.days.map((sh, i) => {
                    const t = cellTone(sh);
                    const id = idFor(r);
                    return (
                      <td key={i} className="px-1.5 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => (id ? sb.openEditor(id, i) : show(`${r.name} is not linked to a staff record yet.`))}
                          className="of-num inline-flex w-full justify-center rounded-[8px] px-1.5 py-1 text-[11px] font-medium transition-[filter] hover:brightness-95"
                          style={{ backgroundColor: t.bg, color: t.fg }}
                        >
                          {sh.status === 'off' ? 'Off' : sh.status === 'leave' ? 'Leave' : sh.status === 'open' ? 'Open' : sh.time}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Coverage gaps — the call-out queue, one click from a matched shortlist */}
      {openShifts.length ? (
        <SectionCard
          title="Open shifts & call-outs"
          right={
            <Link href="/app/shiftboard/roster" className="text-[12px] font-semibold text-[#1F5FA8] hover:underline">
              Roster →
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {openShifts.slice(0, 6).map((o) => (
              <button
                key={openShiftKey(o)}
                type="button"
                onClick={() => sb.openCover(openShiftKey(o))}
                className={`rounded-[14px] border border-dashed p-3.5 text-left transition-colors ${o.reason === 'call-out' ? 'border-[#E4A6A6] bg-[#FDF6F6] hover:border-[#A32D2D]' : 'border-[#E2E6EC] bg-[#FBFCFE] hover:border-[#3E7BC4]'}`}
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[#171A17]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sb.deptColor(o.department) }} />
                  {o.department}
                </span>
                <span className="mt-1 block text-[12px] text-[#A0A49C]">
                  {o.day} · <span className="of-num">{o.time}</span>
                </span>
                <span className="mt-1 block text-[12px] font-medium text-[#1F5FA8]">Find cover →</span>
              </button>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <SectionCard title="Staff">
          <DataTable
            columns={[{ label: 'Name' }, { label: 'Department' }, { label: 'Status' }, { label: 'Next shift' }, { label: 'Hours / wk', align: 'right' }]}
            rows={sb.employees.map((e) => [
              <span key="n" className="font-semibold text-[#171A17]">{e.name}<span className="ml-1.5 text-[12px] font-normal text-[#A0A49C]">{e.role}</span></span>,
              <DeptBadge key="d" department={e.department} />,
              <StatusBadge key="s" status={e.status} />,
              <span key="ns" className="of-num">{e.nextShift}</span>,
              String(e.hoursThisWeek),
            ])}
            empty="No staff yet."
          />
        </SectionCard>

        <div className="space-y-5">
          {/* Today's staffing snapshot */}
          <SectionCard title="Today's staffing snapshot">
            <div className="flex flex-col gap-2">
              {snapshots.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[13px] text-[#171A17]"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />{d.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="of-num text-[13px] text-[#6B6F68]">{d.working}/{d.required}</span>
                    <CoverageBadge status={d.status} />
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Operational alerts */}
          <SectionCard title="Operational alerts">
            <div className="flex flex-col gap-3">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: a.tone === 'critical' ? '#A32D2D' : a.tone === 'warning' ? '#854F0B' : '#0C447C' }} />
                  <span className="min-w-0 flex-1 text-[#171A17]">{a.text}</span>
                  {a.module ? (
                    <Link href={MODULE_META[a.module].route} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MODULE_META[a.module].accent.bg, color: MODULE_META[a.module].accent.fg }}>{MODULE_META[a.module].name} →</Link>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>

          <SwapsPanel />
        </div>
      </div>

      <MobileSnapshotCards onAction={(l) => show(`${l} (demo)`)} />
    </div>
  );
}
