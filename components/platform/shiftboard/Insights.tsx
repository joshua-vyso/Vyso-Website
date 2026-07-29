'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Kpi, SectionCard, DataTable } from '@/components/platform/module-ui';
import { AreaChart, Sparkline } from '@/components/platform/procurepulse/ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { zar } from '@/lib/platform/orderflow';
import { useIsAdmin, LockedTile } from '@/components/platform/RoleGate';
import {
  LABOUR_COST_TREND,
  OVERTIME_TREND,
  ATTENDANCE_TREND,
  LABOUR_INSIGHTS,
  DAYS,
  dailyLabour,
  departmentSnapshots,
  fmtHours,
  labourPctTone,
  rosterShiftCosts,
  type DayLabour,
} from '@/lib/platform/shiftboard';
import { DeptBadge, EmptyState } from './shared';
import { useShiftBoard } from './context';

const PCT_COLOR = { positive: '#0F6E56', warning: '#854F0B', critical: '#A32D2D' } as const;

export function LabourInsights() {
  const sb = useShiftBoard();
  const isAdmin = useIsAdmin();
  const totalOvertime = OVERTIME_TREND.reduce((s, n) => s + n, 0);
  const coverage = departmentSnapshots(sb.employees, sb.departments);

  const week = useMemo(() => dailyLabour(sb.roster, sb.employees, sb.sales), [sb.roster, sb.employees, sb.sales]);
  const shifts = useMemo(() => rosterShiftCosts(sb.roster, sb.employees), [sb.roster, sb.employees]);

  const weekCost = week.reduce((s, d) => s + d.cost, 0);
  const weekHours = week.reduce((s, d) => s + d.hours, 0);
  const weekSales = week.reduce((s, d) => s + (d.sales ?? 0), 0);
  const weekPct = weekSales > 0 && weekCost > 0 ? (weekCost / weekSales) * 100 : null;
  const dearest = [...week].sort((a, b) => b.cost - a.cost)[0];
  const hasCosting = weekCost > 0;
  const hasSales = weekSales > 0;

  // Cost per person per week — where the labour bill is actually concentrated.
  const byEmployee = useMemo(() => {
    const map = new Map<string, { name: string; department: string; hours: number; cost: number; shifts: number }>();
    for (const s of shifts) {
      const key = s.employeeId || s.name;
      const cur = map.get(key) ?? { name: s.name, department: s.department, hours: 0, cost: 0, shifts: 0 };
      cur.hours += s.hours;
      cur.cost += s.cost;
      cur.shifts += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [shifts]);

  const header = (
    <div>
      <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Insights</h1>
      <p className="mt-1.5 text-[14px] text-[#8A8E86]">Labour cost, labour %, overtime, coverage and cross-module signals</p>
    </div>
  );

  if (sb.isEmpty) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState
          title="No insights yet"
          hint="Labour-cost, labour-% and coverage trends appear here once your people are on the roster."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {/* Labour cost KPIs — real rate × rostered hours, not an estimate */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isAdmin ? <Kpi label="Labour cost this week" value={hasCosting ? zar(weekCost) : '—'} sub={hasCosting ? 'rate × rostered hours' : 'no costed shifts'} /> : <LockedTile label="Labour cost this week" />}
        <Kpi label="Rostered hours" value={hasCosting ? fmtHours(weekHours) : '—'} sub={`${shifts.length} shifts`} />
        {isAdmin ? (
          <Kpi
            label="Labour % of sales"
            value={weekPct != null ? `${weekPct.toFixed(1)}%` : '—'}
            accent={weekPct != null ? PCT_COLOR[labourPctTone(weekPct)] : undefined}
            sub={hasSales ? 'vs same-week OrderFlow sales' : 'no sales recorded'}
          />
        ) : (
          <LockedTile label="Labour % of sales" />
        )}
        <Kpi label="Dearest day" value={dearest && dearest.cost > 0 ? dearest.day : '—'} sub={dearest && dearest.cost > 0 ? zar(dearest.cost) : 'nothing costed'} />
        <Kpi label="Overtime hours" value={String(totalOvertime)} accent="#5B53C0" sub="this week" />
      </div>

      {/* Labour cost per day + labour % vs same-day sales */}
      <SectionCard
        title="Labour cost per day"
        right={
          <span className="text-[12px] text-[#A0A49C]">
            {hasSales ? 'cost vs same-day sales' : 'same-day sales appear once OrderFlow has invoiced orders'}
          </span>
        }
      >
        {hasCosting ? (
          <DayLabourTable week={week} hasSales={hasSales} isAdmin={isAdmin} />
        ) : (
          <EmptyState
            title="No costed shifts this week"
            hint="Add times and hourly rates to the roster and each day's labour cost — and its share of sales — is calculated here."
          />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard
          title="Labour cost trend"
          right={<span className="text-[12px] text-[#A0A49C]">{hasCosting ? 'this week, from the roster' : 'illustrative'}</span>}
        >
          <AreaChart data={hasCosting ? week.map((d) => d.cost) : LABOUR_COST_TREND} color="#3E7BC4" fill="#EAF2FC" height={120} />
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.06em] text-[#A0A49C]">
            {DAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[#A0A49C]">
            {hasCosting ? 'Daily labour cost derived from each rostered shift × the employee’s hourly rate.' : 'Illustrative — daily labour cost appears once shifts carry times and rates.'}
          </p>
        </SectionCard>

        <SectionCard title="Overtime trend" right={<span className="text-[12px] text-[#A0A49C]"><span className="of-num">{totalOvertime}h</span> this week</span>}>
          <AreaChart data={OVERTIME_TREND} color="#5B53C0" fill="#EAE7FB" height={120} />
          <p className="mt-2.5 text-[12px] text-[#A0A49C]">Overtime hours per day — concentrated later in the week. Illustrative.</p>
        </SectionCard>
      </div>

      {/* Cost per person */}
      {hasCosting && isAdmin ? (
        <SectionCard title="Cost per person this week" right={<span className="text-[12px] text-[#A0A49C]">rostered hours × rate</span>}>
          <DataTable
            columns={[{ label: 'Employee' }, { label: 'Department' }, { label: 'Shifts', align: 'right' }, { label: 'Hours', align: 'right' }, { label: 'Cost', align: 'right' }]}
            rows={byEmployee.slice(0, 12).map((e) => [
              <span key="n" className="font-semibold text-[#171A17]">{e.name}</span>,
              <DeptBadge key="d" department={e.department} />,
              String(e.shifts),
              fmtHours(e.hours),
              zar(e.cost),
            ])}
            empty="No costed shifts yet."
          />
        </SectionCard>
      ) : null}

      <SectionCard title="Department coverage" right={<span className="text-[12px] text-[#A0A49C]">staffed vs required right now</span>}>
        <div className="flex flex-col gap-3">
          {coverage.map((d) => {
            const pct = d.required ? Math.min(100, (d.working / d.required) * 100) : 100;
            const short = d.working < d.required;
            return (
              <div key={d.name} className="flex items-center gap-3">
                <span className="flex w-32 shrink-0 items-center gap-2 text-[13px] text-[#171A17]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: short ? '#A32D2D' : '#0F6E56', transition: 'width 0.6s ease' }} />
                </div>
                <span className="of-num w-20 text-right text-[12px] text-[#6B6F68]">{d.working} / {d.required}</span>
                <span className="w-20 text-right text-[12px]" style={{ color: short ? '#A32D2D' : '#A0A49C' }}>{short ? `short ${d.required - d.working}` : 'covered'}</span>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="Attendance trends" right={<span className="text-[12px] text-[#A0A49C]">last 7 days</span>}>
          <div className="space-y-3">
            <TrendRow label="Late arrivals" data={ATTENDANCE_TREND.lateArrivals} color="#854F0B" />
            <TrendRow label="Absences" data={ATTENDANCE_TREND.absences} color="#A32D2D" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.06em] text-[#A0A49C]">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
        </SectionCard>

        <SectionCard title="Cross-module insights" right={<span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F5FA8]">✦ auto-generated soon</span>}>
          <div className="flex flex-col gap-2.5">
            {LABOUR_INSIGHTS.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-2.5 text-[13px]">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />
                <span className="min-w-0 flex-1 text-[#171A17]">{i.text}</span>
                {i.module ? (
                  <Link href={MODULE_META[i.module].route} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MODULE_META[i.module].accent.bg, color: MODULE_META[i.module].accent.fg }}>{MODULE_META[i.module].name} →</Link>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/** Cost, hours and — where OrderFlow has same-day revenue — labour % per day. */
function DayLabourTable({ week, hasSales, isAdmin }: { week: DayLabour[]; hasSales: boolean; isAdmin: boolean }) {
  const maxCost = Math.max(...week.map((d) => d.cost), 1);
  return (
    <div className="flex flex-col gap-2">
      {week.map((d) => {
        const pctTone = d.labourPct != null ? labourPctTone(d.labourPct) : null;
        return (
          <div key={d.day} className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-[13px] font-medium text-[#171A17]">{d.day}</span>
            <span className="of-num w-14 shrink-0 text-right text-[12px] text-[#A0A49C]">{d.shifts ? fmtHours(d.hours) : '—'}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#EEF1F5]">
              <div className="h-full rounded-full" style={{ width: `${(d.cost / maxCost) * 100}%`, backgroundColor: '#3E7BC4', transition: 'width 0.6s ease' }} />
            </div>
            <span className="of-num w-24 shrink-0 text-right text-[13px] font-semibold text-[#171A17]">{isAdmin ? (d.cost > 0 ? zar(d.cost) : '—') : '••••'}</span>
            {hasSales ? (
              <>
                <span className="of-num w-24 shrink-0 text-right text-[12px] text-[#6B6F68]">{isAdmin && d.sales ? zar(d.sales) : d.sales ? '••••' : '—'}</span>
                <span
                  className="of-num w-16 shrink-0 text-right text-[13px] font-semibold"
                  style={{ color: pctTone ? PCT_COLOR[pctTone] : '#A0A49C' }}
                  title={d.labourPct != null ? 'Labour cost as a share of same-day sales' : 'No same-day sales'}
                >
                  {d.labourPct != null ? `${d.labourPct.toFixed(1)}%` : '—'}
                </span>
              </>
            ) : null}
          </div>
        );
      })}
      <p className="mt-1 text-[12px] text-[#A0A49C]">
        {hasSales
          ? 'Labour % = the day’s rostered cost ÷ that day’s invoiced OrderFlow sales. Green under 25%, amber to 32%, red above.'
          : 'Labour % appears here per day once OrderFlow has invoiced or paid orders in the same week.'}
      </p>
    </div>
  );
}

function TrendRow({ label, data, color }: { label: string; data: number[]; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[13px] text-[#6B6F68]">{label}</span>
      <Sparkline data={data} color={color} width={180} height={28} />
      <span className="of-num ml-auto text-[13px] font-semibold text-[#171A17]">{data.reduce((s, n) => s + n, 0)}</span>
    </div>
  );
}
