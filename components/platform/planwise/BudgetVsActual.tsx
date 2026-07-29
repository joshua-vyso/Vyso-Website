'use client';

import { zar } from '@/lib/platform/orderflow';
import { SectionCard, Badge } from '@/components/platform/module-ui';
import { ACTUAL_SOURCE_LABEL, paceStatus, type CategoryActual } from '@/lib/platform/planwise-actuals';
import { usePlanWise } from './context';

/**
 * Budget vs ACTUAL, month-to-date.
 *
 * A whole-month budget compared against a part-month actual always flatters you
 * — on the 8th, every line looks "under". So each row here compares the actual
 * so far against the budget *pro-rated to today*, and projects the run rate to
 * month end. That turns "we'll find out on the 31st" into "we are R x over, now".
 */

function SourceChip({ a }: { a: CategoryActual }) {
  const measured = a.source !== 'plan';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={measured ? { backgroundColor: '#E1F5EE', color: '#0F6E56' } : { backgroundColor: '#EEF1F5', color: '#6B6F68' }}
    >
      {measured ? '●' : '○'} {ACTUAL_SOURCE_LABEL[a.source]}
    </span>
  );
}

function Row({ a }: { a: CategoryActual }) {
  const st = paceStatus(a);
  const good = a.higherIsBetter ? a.varianceVsPace <= 0 : a.varianceVsPace >= 0;
  const color = good ? '#0F6E56' : '#A32D2D';
  const pacePct = a.pacedBudget > 0 ? Math.min(160, (a.mtdActual / a.pacedBudget) * 100) : 0;
  const barColor = st.tone === 'critical' ? '#A32D2D' : st.tone === 'warning' ? '#854F0B' : '#0F6E56';

  return (
    <div className="border-t border-[#F4F5F7] px-4 py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-[#171A17]">{a.cat}</span>
          <Badge label={st.label} tone={st.tone} />
          <SourceChip a={a} />
        </div>
        <span className="of-num shrink-0 text-[13px] font-semibold" style={{ color }}>
          {a.varianceVsPace >= 0 ? '+' : '−'}
          {zar(Math.abs(a.varianceVsPace))} <span className="font-normal text-[#A0A49C]">vs today&rsquo;s pace</span>
        </span>
      </div>

      <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#EEF1F5]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, pacePct)}%`, backgroundColor: barColor, transition: 'width 0.7s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-[#8A8E86] sm:grid-cols-4">
        <span>
          Actual so far <span className="of-num font-medium text-[#171A17]">{zar(a.mtdActual)}</span>
        </span>
        <span>
          Budget to date <span className="of-num font-medium text-[#171A17]">{zar(a.pacedBudget)}</span>
        </span>
        <span>
          Tracking to <span className="of-num font-medium text-[#171A17]">{zar(a.projected)}</span>
        </span>
        <span>
          Full-month plan <span className="of-num font-medium text-[#171A17]">{zar(a.budgeted)}</span>
        </span>
      </div>
    </div>
  );
}

export function BudgetVsActual() {
  const { actuals } = usePlanWise();
  const { categories, pace } = actuals;

  if (categories.length === 0) {
    return (
      <SectionCard title="Budget vs actual · month to date">
        <div className="rounded-[14px] border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-10 text-center">
          <p className="of-display text-[16px] font-semibold text-[#171A17]">Nothing to compare yet</p>
          <p className="mx-auto mt-2 max-w-md text-[13px] text-[#6B6F68]">
            Add budget categories and PlanWise will measure them against live sales, order costs and logged waste as the
            month runs.
          </p>
        </div>
      </SectionCard>
    );
  }

  const measuredCount = categories.filter((c) => c.source !== 'plan').length;
  const overPace = categories.filter((c) => !c.higherIsBetter && c.varianceVsPace < 0);
  const totalOver = overPace.reduce((s, c) => s + Math.abs(c.varianceVsPace), 0);

  return (
    <SectionCard
      title="Budget vs actual · month to date"
      right={
        <span className="text-[12px] text-[#8A8E86]">
          Day <span className="of-num font-semibold text-[#171A17]">{pace.day}</span> of{' '}
          <span className="of-num">{pace.days}</span> · <span className="of-num">{Math.round(pace.elapsed * 100)}%</span> of{' '}
          {pace.monthLabel}
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-[#EEF1F5] bg-[#F5F9FE] px-4 py-3 text-[13px]">
        {totalOver > 0 ? (
          <span className="text-[#171A17]">
            <span className="of-num font-semibold text-[#A32D2D]">{zar(totalOver)}</span> over pace across{' '}
            <span className="of-num font-semibold">{overPace.length}</span>{' '}
            {overPace.length === 1 ? 'category' : 'categories'} — same-day, not month-end.
          </span>
        ) : (
          <span className="text-[#171A17]">Every cost line is inside its pace for day {pace.day}.</span>
        )}
        <span className="ml-auto text-[12px] text-[#8A8E86]">
          <span className="of-num font-medium">{measuredCount}</span> of <span className="of-num">{categories.length}</span>{' '}
          measured from live data
        </span>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-[#EEF1F5]">
        {categories.map((a) => (
          <Row key={a.cat} a={a} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-[#A0A49C]">
        Measured lines come from OrderFlow sales, order cost (PricePilot average unit cost) and WasteWatch events.
        Lines marked &ldquo;From plan&rdquo; have no live feed yet, so their stored month figure is pro-rated to today
        for a like-for-like comparison.
      </p>
    </SectionCard>
  );
}

/** Compact strip for the Overview — the three worst same-day variances. */
export function BudgetPaceStrip() {
  const { actuals } = usePlanWise();
  const worst = actuals.categories
    .filter((c) => !c.higherIsBetter && c.varianceVsPace < 0)
    .sort((a, b) => a.varianceVsPace - b.varianceVsPace)
    .slice(0, 3);

  if (worst.length === 0) return null;

  return (
    <SectionCard
      title="Over pace today"
      right={<span className="text-[12px] text-[#8A8E86]">day {actuals.pace.day} of {actuals.pace.days}</span>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {worst.map((c) => (
          <div key={c.cat} className="rounded-[14px] border border-[#EEF1F5] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{c.cat}</span>
              <SourceChip a={c} />
            </div>
            <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#A32D2D]">
              −{zar(Math.abs(c.varianceVsPace))}
            </div>
            <div className="mt-1.5 text-[12px] text-[#A0A49C]">
              tracking to <span className="of-num">{zar(c.projected)}</span> vs <span className="of-num">{zar(c.budgeted)}</span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
