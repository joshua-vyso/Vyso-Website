'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import { downloadCsv } from '@/lib/platform/csv';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
// Values from the client-safe layer; the shape stays a type-only import so the
// server module (and `next/headers` under it) never reaches the browser bundle.
import {
  LABOUR_WARN_PCT,
  MARGIN_WARN_PP,
  PRICE_JUMP_WARN_PCT,
  WASTE_SPIKE_WARN_PCT,
} from '@/lib/platform/insightgen';
import type { Anomaly } from '@/lib/platform/insightgen-data';
import { useInsightGen } from './context';
import {
  AMBER,
  Chip,
  EmptyState,
  GREEN,
  GhostButton,
  RED,
  SEV_COLOR,
  SEV_LABEL,
  SeverityBadge,
  moduleName,
} from './shared';

/** The rule book, stated plainly — InsightGen does not pretend to be a model. */
const RULE_BOOK = [
  `Food-cost variance — realized margin more than ${MARGIN_WARN_PP} points under the org target.`,
  `Supplier price jump — a supplier price ${PRICE_JUMP_WARN_PCT}% or more above its previous price.`,
  `Labour spike — labour cost above ${LABOUR_WARN_PCT}% of same-day sales.`,
  `Waste spike — 7-day waste cost more than ${WASTE_SPIKE_WARN_PCT}% above the previous 7 days.`,
  'Stock — an item at or below its low-stock threshold.',
  'Supplier risk — an open high or critical risk on the supplier register.',
];

export function InsightGenAnomalies() {
  const { anomalies, isEmpty, windowDays } = useInsightGen();
  const { org } = usePlatform();
  const router = useRouter();
  const [showAcked, setShowAcked] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const open = anomalies.filter((a) => !a.acknowledged);
  const acked = anomalies.filter((a) => a.acknowledged);
  const shown = showAcked ? anomalies : open;
  const criticalCount = open.filter((a) => a.severity === 'critical').length;

  async function setAck(a: Anomaly, ack: boolean) {
    const supabase = createClient();
    if (!supabase || !org) {
      setError('Not connected.');
      return;
    }
    setBusyKey(a.key);
    setError(null);
    const { error: err } = ack
      ? await supabase.from('ig_anomaly_acks').upsert(
          { org_id: org.id, anomaly_key: a.key, state: 'acknowledged', acked_by: 'You' },
          { onConflict: 'org_id,anomaly_key' },
        )
      : await supabase.from('ig_anomaly_acks').delete().eq('org_id', org.id).eq('anomaly_key', a.key);
    setBusyKey(null);
    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  function exportAnomalies() {
    downloadCsv(
      `insightgen-anomalies-${new Date().toISOString().slice(0, 10)}`,
      ['Severity', 'Module', 'Anomaly', 'Detail', 'Metric', 'Value', 'Rule', 'Acknowledged'],
      shown.map((a) => [
        SEV_LABEL[a.severity],
        moduleName(a.module),
        a.title,
        a.detail,
        a.metricLabel,
        a.metricValue,
        a.rule,
        a.acknowledged ? 'yes' : 'no',
      ]),
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        title="Nothing to check yet"
        hint={`Anomaly detection runs a fixed rule book over the last ${windowDays} days of your own data. Once orders, waste, shifts, stock or suppliers have rows, the rules run on every page load.`}
      />
    );
  }

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Open anomalies" value={String(open.length)} accent={open.length > 0 ? AMBER : GREEN} />
        <Kpi label="Critical" value={String(criticalCount)} accent={criticalCount > 0 ? RED : undefined} />
        <Kpi label="Acknowledged" value={String(acked.length)} sub="hidden by default" />
        <Kpi label="Rules evaluated" value={String(RULE_BOOK.length)} sub="rule-based, not modelled" />
        <Kpi label="Window" value={`${windowDays} days`} sub="of source-module history" />
      </KpiStrip>

      <SectionCard
        title="Detected anomalies"
        right={
          <>
            <Chip active={showAcked} onClick={() => setShowAcked((v) => !v)}>
              {showAcked ? 'Hiding nothing' : 'Show acknowledged'}
            </Chip>
            <GhostButton onClick={exportAnomalies} disabled={shown.length === 0}>
              Export CSV
            </GhostButton>
          </>
        }
      >
        {shown.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-[#6B6F68]">
            No rule fired. Margin, supplier pricing, labour, waste and stock are all inside their thresholds for this org.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {shown.map((a) => (
              <div
                key={a.id}
                className="rounded-[14px] border border-[#EEF1F5] bg-white p-4 transition-colors hover:border-[#C9DEF7] hover:bg-[#F5F9FE]"
                style={a.acknowledged ? { opacity: 0.62 } : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SEV_COLOR[a.severity] }} />
                    <div className="min-w-0">
                      <div className="of-display text-[15px] font-semibold text-[#171A17]">{a.title}</div>
                      <p className="mt-1 text-[13px] leading-snug text-[#6B6F68]">{a.detail}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <Badge label={moduleName(a.module)} tone="info" />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#F4F5F7] pt-3">
                  <div className="min-w-0 text-[12px] text-[#8A8E86]">
                    <span className="font-medium text-[#6B6F68]">{a.metricLabel}:</span>{' '}
                    <span className="of-num font-semibold text-[#171A17]">{a.metricValue}</span>
                    <span className="mx-2 text-[#D8DFE8]">|</span>
                    {a.rule}
                  </div>
                  <GhostButton onClick={() => setAck(a, !a.acknowledged)} disabled={busyKey === a.key}>
                    {busyKey === a.key ? 'Saving…' : a.acknowledged ? 'Reopen' : 'Acknowledge'}
                  </GhostButton>
                </div>
              </div>
            ))}
          </div>
        )}
        {error ? <p className="mt-3 text-[12px] text-[#A32D2D]">{error}</p> : null}
      </SectionCard>

      <SectionCard title="The rule book">
        <p className="text-[13px] text-[#6B6F68]">
          Every anomaly above is produced by one of these fixed rules run against your own rows. Nothing here is predicted or inferred — if
          a rule did not fire, no card is shown.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {RULE_BOOK.map((r) => (
            <li key={r} className="flex items-start gap-2.5 text-[13px] text-[#2C333B]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9DEF7]" />
              {r}
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
