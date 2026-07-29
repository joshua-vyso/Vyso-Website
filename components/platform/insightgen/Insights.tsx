'use client';

import { useMemo, useState } from 'react';
import { Badge, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import { downloadCsv } from '@/lib/platform/csv';
import type { InsightSeverity } from '@/lib/platform/insightgen-data';
import { useInsightGen } from './context';
import { AMBER, Chip, EmptyState, GREEN, GhostButton, INFO, RED, SEV_LABEL, SeverityDot, moduleName } from './shared';

type SevFilter = InsightSeverity | 'all';
type OriginFilter = 'all' | 'derived' | 'seed';

const SEVERITIES: InsightSeverity[] = ['critical', 'warning', 'info', 'positive'];

export function InsightGenInsights() {
  const { insights, derived, seeded, isEmpty, windowDays, openCreate } = useInsightGen();
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [sevFilter, setSevFilter] = useState<SevFilter>('all');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');

  const filterModules = useMemo(
    () => Array.from(new Set(insights.map((i) => i.sourceModule))).filter(Boolean).sort(),
    [insights],
  );

  const shown = insights.filter(
    (i) =>
      (moduleFilter === 'all' || i.sourceModule === moduleFilter) &&
      (sevFilter === 'all' || i.severity === sevFilter) &&
      (originFilter === 'all' || (i.origin ?? 'seed') === originFilter),
  );

  const sevCount = (s: InsightSeverity) => insights.filter((i) => i.severity === s).length;

  if (isEmpty || insights.length === 0) {
    return (
      <EmptyState
        title="No insights for this window"
        hint={`InsightGen derives insights from the last ${windowDays} days of orders, waste, shifts, stock and supplier records. Once those modules have rows for this org, findings appear here automatically.`}
        action={
          <Chip active={false} onClick={openCreate}>
            Create a report
          </Chip>
        }
      />
    );
  }

  function exportFeed() {
    downloadCsv(
      `insightgen-insights-${new Date().toISOString().slice(0, 10)}`,
      ['Severity', 'Module', 'Origin', 'Insight', 'Metric', 'Value'],
      shown.map((i) => [
        SEV_LABEL[i.severity],
        moduleName(i.sourceModule),
        i.origin === 'derived' ? 'Derived now' : 'Stored',
        i.text,
        i.metricLabel ?? '',
        i.metricValue ?? '',
      ]),
    );
  }

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Total insights" value={String(insights.length)} />
        <Kpi label="Derived this request" value={String(derived.length)} accent={derived.length > 0 ? GREEN : undefined} sub="computed from live rows" />
        <Kpi label="Stored (ig_insights)" value={String(seeded.length)} sub="seeded records" />
        <Kpi label="Critical" value={String(sevCount('critical'))} accent={sevCount('critical') > 0 ? RED : undefined} />
        <Kpi label="To watch" value={String(sevCount('warning'))} accent={sevCount('warning') > 0 ? AMBER : undefined} />
      </KpiStrip>

      <SectionCard
        title="Insight feed"
        right={
          <>
            <Badge label={`${shown.length} shown`} tone="neutral" />
            <GhostButton onClick={exportFeed} disabled={shown.length === 0}>
              Export CSV
            </GhostButton>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={moduleFilter === 'all'} onClick={() => setModuleFilter('all')}>
            All modules
          </Chip>
          {filterModules.map((m) => (
            <Chip key={m} active={moduleFilter === m} onClick={() => setModuleFilter(m)}>
              {moduleName(m)}
            </Chip>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip active={sevFilter === 'all'} onClick={() => setSevFilter('all')}>
            Any severity
          </Chip>
          {SEVERITIES.map((s) => (
            <Chip key={s} active={sevFilter === s} onClick={() => setSevFilter(s)}>
              {SEV_LABEL[s]}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px bg-[#EAEDF2]" />
          <Chip active={originFilter === 'all'} onClick={() => setOriginFilter('all')}>
            All sources
          </Chip>
          <Chip active={originFilter === 'derived'} onClick={() => setOriginFilter('derived')}>
            Derived now
          </Chip>
          <Chip active={originFilter === 'seed'} onClick={() => setOriginFilter('seed')}>
            Stored
          </Chip>
        </div>

        <div className="mt-4 overflow-hidden rounded-[14px] border border-[#EAEDF2]">
          {shown.length === 0 ? (
            <p className="px-5 py-12 text-center text-[14px] text-[#8A8E86]">No insights match these filters.</p>
          ) : (
            shown.map((ins, i) => (
              <div
                key={ins.id}
                className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-[#F5F9FE] ${i > 0 ? 'border-t border-[#F4F5F7]' : ''}`}
              >
                <SeverityDot severity={ins.severity} />
                <span className="min-w-0 flex-1 text-[14px] leading-snug text-[#171A17]">
                  {ins.text}
                  {ins.metricValue ? (
                    <span className="ml-1.5 text-[12px] text-[#A0A49C]">
                      · {ins.metricLabel ? `${ins.metricLabel} ` : ''}
                      <span className="of-num">{ins.metricValue}</span>
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {ins.isAnomaly ? <Badge label="Anomaly" tone="critical" /> : null}
                  {ins.origin === 'derived' ? (
                    <span className="text-[11px] font-medium" style={{ color: INFO }}>
                      derived
                    </span>
                  ) : null}
                  <Badge label={moduleName(ins.sourceModule)} tone="info" />
                </span>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-[12px] text-[#A0A49C]">
          “Derived” insights are computed from this org’s rows on every page load over a {windowDays}-day window; “stored” insights come
          from the ig_insights table.
        </p>
      </SectionCard>
    </div>
  );
}
