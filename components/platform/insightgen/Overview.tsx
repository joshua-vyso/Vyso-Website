'use client';

import Link from 'next/link';
import { Badge, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import { useInsightGen } from './context';
import {
  ACCENT,
  AMBER,
  BriefRow,
  Chip,
  EmptyState,
  GREEN,
  MUTE,
  RED,
  SeverityDot,
  Sparkline,
  dayLabel,
  moduleName,
  pct,
  signedPct,
  timeLabel,
  zar,
} from './shared';

/** Days of the daily series the overview trend cards render. */
const TREND_DAYS = 14;

export function InsightGenOverview() {
  const {
    isEmpty,
    insights,
    derived,
    anomalies,
    reports,
    sources,
    brief,
    salesSeries,
    wasteSeries,
    generatedAt,
    windowDays,
    openCreate,
  } = useInsightGen();

  if (isEmpty) {
    return (
      <EmptyState
        title="Nothing to report on yet"
        hint="InsightGen reads the other modules directly — orders, waste events, shifts, stock and suppliers. As soon as one of them has data for this org, your Daily Ops Brief, insights and anomalies appear here."
        action={
          <Link href="/app" className="text-[13px] font-semibold text-[#1F5FA8] transition-colors hover:text-[#174C87] hover:underline">
            Open the module overview →
          </Link>
        }
      />
    );
  }

  const openAnomalies = anomalies.filter((a) => !a.acknowledged);
  const criticalCount = openAnomalies.filter((a) => a.severity === 'critical').length;
  const connected = sources.filter((s) => s.connected);
  const salesDelta = brief.salesPrevDay > 0 ? ((brief.salesYesterday - brief.salesPrevDay) / brief.salesPrevDay) * 100 : null;

  const salesTail = salesSeries.slice(-TREND_DAYS);
  const wasteTail = wasteSeries.slice(-TREND_DAYS);
  const salesTailTotal = salesTail.reduce((s, d) => s + d.value, 0);
  const wasteTailTotal = wasteTail.reduce((s, d) => s + d.value, 0);

  const topInsights = insights.slice(0, 6);

  return (
    <div className="space-y-5">
      {/* 1) Real KPIs — every value is computed from this org's rows */}
      <KpiStrip>
        <Kpi
          label="Insights surfaced"
          value={String(insights.length)}
          accent={insights.length > 0 ? GREEN : undefined}
          sub={`${derived.length} derived now`}
        />
        <Kpi
          label="Open anomalies"
          value={String(openAnomalies.length)}
          accent={criticalCount > 0 ? RED : openAnomalies.length > 0 ? AMBER : undefined}
          sub={criticalCount > 0 ? `${criticalCount} critical` : 'rule-based'}
        />
        <Kpi label="Saved reports" value={String(reports.length)} sub="definitions you can run" />
        <Kpi
          label="Modules feeding data"
          value={`${connected.length}/${sources.length}`}
          sub={connected.length > 0 ? connected.map((s) => s.label).join(', ') : 'none yet'}
        />
        <Kpi label="Computed at" value={timeLabel(generatedAt)} sub={`${windowDays}-day window`} />
      </KpiStrip>

      {/* 2) Daily Ops Brief — the morning snapshot */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <SectionCard
          title="Daily Ops Brief"
          right={<Badge label={dayLabel(brief.today)} tone="info" />}
        >
          <p className="text-[14px] leading-relaxed text-[#171A17]">
            {brief.salesYesterday > 0 ? (
              <>
                Yesterday ({dayLabel(brief.yesterday)}) took{' '}
                <span className="of-num font-semibold">{zar(brief.salesYesterday)}</span> across{' '}
                <span className="of-num font-semibold">{brief.ordersYesterday}</span> order{brief.ordersYesterday === 1 ? '' : 's'}
                {salesDelta != null ? (
                  <>
                    , <span className="font-semibold" style={{ color: salesDelta >= 0 ? GREEN : AMBER }}>{signedPct(salesDelta)}</span> on the day before
                  </>
                ) : null}
                .{' '}
              </>
            ) : (
              <>No sales were recorded yesterday ({dayLabel(brief.yesterday)}). </>
            )}
            {brief.wasteYesterday > 0 ? (
              <>
                <span className="of-num font-semibold">{zar(brief.wasteYesterday)}</span> of waste was logged across{' '}
                <span className="of-num">{brief.wasteEventsYesterday}</span> event{brief.wasteEventsYesterday === 1 ? '' : 's'}.{' '}
              </>
            ) : (
              <>No waste was logged yesterday. </>
            )}
            {brief.staffOnShiftToday > 0 ? (
              <>
                <span className="of-num font-semibold">{brief.staffOnShiftToday}</span> of {brief.staffTotal} staff are on shift today
                {brief.labourPctOfSales != null ? (
                  <>
                    {' '}at <span className="of-num font-semibold">{zar(brief.labourCostToday)}</span> ({pct(brief.labourPctOfSales)} of sales)
                  </>
                ) : null}
                .
              </>
            ) : (
              <>Nobody is marked on shift today.</>
            )}
          </p>

          <div className="mt-4 rounded-[14px] border border-[#EEF1F5] bg-[#FBFCFE] px-4 py-1">
            <BriefRow
              label="Sales yesterday"
              sub={`${brief.ordersYesterday} order${brief.ordersYesterday === 1 ? '' : 's'} · ${dayLabel(brief.yesterday)}`}
              value={zar(brief.salesYesterday)}
              color={brief.salesYesterday > 0 ? GREEN : MUTE}
            />
            <BriefRow
              label="Waste logged yesterday"
              sub={
                brief.wasteYesterday > 0
                  ? `${zar(brief.wastePreventableYesterday)} of it marked preventable`
                  : 'nothing logged'
              }
              value={zar(brief.wasteYesterday)}
              color={brief.wasteYesterday > 0 ? AMBER : MUTE}
            />
            <BriefRow
              label="Staff on shift today"
              sub={brief.labourCostToday > 0 ? `${zar(brief.labourCostToday)} of labour at recorded hours` : 'no hours recorded yet'}
              value={`${brief.staffOnShiftToday}/${brief.staffTotal}`}
              color={brief.staffOnShiftToday > 0 ? ACCENT : MUTE}
            />
            <BriefRow
              label="Stock alerts"
              sub={brief.stockAlerts.length > 0 ? brief.stockAlerts.slice(0, 3).map((s) => s.name).join(', ') : 'everything above threshold'}
              value={String(brief.stockAlerts.length)}
              color={brief.stockAlerts.length > 0 ? AMBER : GREEN}
            />
            <BriefRow
              label="Open supplier risks"
              sub={
                brief.docsExpiring > 0
                  ? `${brief.docsExpiring} compliance document${brief.docsExpiring === 1 ? '' : 's'} to action`
                  : 'no documents outstanding'
              }
              value={String(brief.supplierRisks.length)}
              color={brief.supplierRisks.length > 0 ? RED : GREEN}
            />
          </div>
          <p className="mt-3 text-[12px] text-[#A0A49C]">
            Derived live from of_orders, ww_waste_events, sb_attendance, pp_stock_items and ss_* — no stored snapshot.
          </p>
        </SectionCard>

        {/* 3) What needs attention */}
        <SectionCard
          title="Needs attention"
          right={<Badge label={`${openAnomalies.length} open`} tone={openAnomalies.length > 0 ? 'warning' : 'positive'} />}
        >
          {openAnomalies.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#6B6F68]">
              No rule fired against this org’s data — margin, supplier pricing, labour, waste and stock are all inside their thresholds.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {openAnomalies.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 text-[13px]">
                  <SeverityDot severity={a.severity} />
                  <span className="text-[#6B6F68]">
                    <span className="font-medium text-[#171A17]">{moduleName(a.module)}:</span> {a.title}
                  </span>
                </div>
              ))}
              <Link
                href="/app/reportgen/anomalies"
                className="mt-1 text-[13px] font-semibold text-[#1F5FA8] transition-colors hover:text-[#174C87] hover:underline"
              >
                Review anomalies →
              </Link>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 4) Trend cards — real daily series */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SectionCard title={`Sales — last ${TREND_DAYS} days`} right={<span className="of-num text-[13px] font-semibold text-[#171A17]">{zar(salesTailTotal)}</span>}>
          <Sparkline data={salesTail.map((d) => d.value)} color={ACCENT} height={56} />
          <p className="mt-2 text-[12px] text-[#8A8E86]">
            Rebuilt from of_order_items on non-draft orders — the same derivation PricePilot uses for realized sales.
          </p>
        </SectionCard>
        <SectionCard title={`Waste — last ${TREND_DAYS} days`} right={<span className="of-num text-[13px] font-semibold text-[#171A17]">{zar(wasteTailTotal)}</span>}>
          <Sparkline data={wasteTail.map((d) => d.value)} color={AMBER} height={56} />
          <p className="mt-2 text-[12px] text-[#8A8E86]">Cost of every ww_waste_events row logged on that day.</p>
        </SectionCard>
      </div>

      {/* 5) Insight preview */}
      <SectionCard
        title="Latest insights"
        right={
          <Link href="/app/reportgen/insights" className="text-[13px] font-medium text-[#1F5FA8] transition-colors hover:text-[#174C87] hover:underline">
            See all
          </Link>
        }
      >
        {topInsights.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[13px] text-[#6B6F68]">Nothing surfaced yet for this window.</p>
            <div className="mt-3 flex justify-center">
              <Chip active={false} onClick={openCreate}>
                Create a report instead
              </Chip>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {topInsights.map((ins, i) => (
              <div key={ins.id} className={`flex items-start gap-3 py-3 ${i > 0 ? 'border-t border-[#F4F5F7]' : ''}`}>
                <SeverityDot severity={ins.severity} />
                <span className="min-w-0 flex-1 text-[14px] text-[#171A17]">{ins.text}</span>
                <span className="shrink-0">
                  <Badge label={moduleName(ins.sourceModule)} tone="info" />
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
