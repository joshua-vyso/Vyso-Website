'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, DataTable, Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import { downloadCsv } from '@/lib/platform/csv';
import { usePlatform } from '@/lib/platform/session';
import { createClient } from '@/lib/platform/supabase-browser';
import type { GenReport, ReportDataset } from '@/lib/platform/insightgen-data';
import { useInsightGen } from './context';
import {
  AMBER,
  Chip,
  EmptyState,
  GREEN,
  GhostButton,
  STATUS_LABEL,
  STATUS_TONE,
  dateLabel,
  moduleName,
  reportModules,
} from './shared';

/** Ranges the builder can scope a run to. `null` = the full aggregation window. */
const RANGES: { label: string; days: number | null }[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Full window', days: null },
];

/** Rows shown in the on-screen preview before export. */
const PREVIEW_ROWS = 8;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Datasets whose first column is a date can be range-scoped; the rest cannot. */
function isDated(ds: ReportDataset): boolean {
  return ds.columns[0] === 'Date';
}

function scopeRows(ds: ReportDataset, days: number | null): ReportDataset['rows'] {
  if (days == null || !isDated(ds)) return ds.rows;
  const from = isoDaysAgo(days);
  return ds.rows.filter((r) => String(r[0]) >= from);
}

export function InsightGenReports() {
  const { reports, datasets, isEmpty, windowDays, openCreate } = useInsightGen();
  const { org } = usePlatform();
  const router = useRouter();

  const available = useMemo(() => datasets.filter((d) => d.rows.length > 0), [datasets]);
  const [selected, setSelected] = useState<string[]>(() => available.map((d) => d.key));
  const [rangeDays, setRangeDays] = useState<number | null>(30);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const chosen = datasets.filter((d) => selected.includes(d.key));
  const scoped = chosen.map((d) => ({ ds: d, rows: scopeRows(d, rangeDays) }));
  const totalRows = scoped.reduce((s, x) => s + x.rows.length, 0);
  const preview = scoped.find((x) => x.rows.length > 0);

  if (isEmpty && reports.length === 0) {
    return (
      <EmptyState
        title="No reports and no data to report on"
        hint="Save a report definition to describe what you want, and InsightGen will run it against your orders, waste, labour, stock and supplier records as soon as those modules have rows."
        action={
          <Chip active={false} onClick={openCreate}>
            Create a report
          </Chip>
        }
      />
    );
  }

  function toggle(key: string) {
    setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  }

  /** One CSV file per selected dataset — raw rows, straight out. */
  function exportSelection(prefix = 'insightgen') {
    const stamp = new Date().toISOString().slice(0, 10);
    let count = 0;
    for (const { ds, rows } of scoped) {
      if (rows.length === 0) continue;
      downloadCsv(`${prefix}-${ds.key}-${stamp}`, ds.columns, rows);
      count += rows.length;
    }
    setNote(count > 0 ? `Exported ${count} row${count === 1 ? '' : 's'} across ${scoped.filter((x) => x.rows.length > 0).length} file(s).` : 'Nothing to export for this selection.');
  }

  function exportOne(ds: ReportDataset) {
    const rows = scopeRows(ds, rangeDays);
    downloadCsv(`insightgen-${ds.key}-${new Date().toISOString().slice(0, 10)}`, ds.columns, rows);
    setNote(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'} from ${ds.label}.`);
  }

  /** Run a SAVED report: pick its modules' datasets, export them, record the run. */
  async function runReport(r: GenReport) {
    const wanted = r.modules.includes('all') || r.modules.length === 0 ? datasets : datasets.filter((d) => r.modules.includes(d.module));
    const parts = wanted.map((d) => ({ ds: d, rows: scopeRows(d, rangeDays) })).filter((x) => x.rows.length > 0);
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
    let rowCount = 0;
    for (const { ds, rows } of parts) {
      downloadCsv(`${slug}-${ds.key}-${stamp}`, ds.columns, rows);
      rowCount += rows.length;
    }

    setBusyId(r.id);
    const supabase = createClient();
    if (supabase && org) {
      const runAt = new Date().toISOString();
      await supabase.from('ig_report_runs').insert({
        org_id: org.id,
        report_id: r.id,
        datasets: parts.map((p) => p.ds.key),
        row_count: rowCount,
        output: 'csv',
        run_by: 'You',
      });
      await supabase.from('ig_reports').update({ last_run: runAt }).eq('id', r.id).eq('org_id', org.id);
      router.refresh();
    }
    setBusyId(null);
    setNote(
      rowCount > 0
        ? `Ran “${r.name}” — ${rowCount} row${rowCount === 1 ? '' : 's'} exported across ${parts.length} file(s).`
        : `Ran “${r.name}” — no rows matched its modules for this range.`,
    );
  }

  const reportRows: ReactNode[][] = reports.map((r) => [
    r.name,
    r.scope ?? '—',
    reportModules(r.modules),
    r.schedule.charAt(0).toUpperCase() + r.schedule.slice(1),
    <span key="lr" className="of-num">
      {dateLabel(r.lastRun)}
      {r.lastRunRows != null ? <span className="ml-1 text-[12px] text-[#A0A49C]">· {r.lastRunRows} rows</span> : null}
    </span>,
    r.owner ?? '—',
    <span key="s" className="inline-flex items-center justify-end gap-2">
      <Badge label={STATUS_LABEL[r.status]} tone={STATUS_TONE[r.status]} />
      <GhostButton onClick={() => runReport(r)} disabled={busyId === r.id}>
        {busyId === r.id ? 'Running…' : 'Run & export'}
      </GhostButton>
    </span>,
  ]);

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Saved reports" value={String(reports.length)} />
        <Kpi label="Datasets available" value={`${available.length}/${datasets.length}`} accent={available.length > 0 ? GREEN : undefined} />
        <Kpi label="Rows in selection" value={String(totalRows)} accent={totalRows === 0 ? AMBER : undefined} />
        <Kpi label="Scope" value={RANGES.find((x) => x.days === rangeDays)?.label ?? 'Full window'} sub={`max ${windowDays} days`} />
        <Kpi label="Export format" value="CSV" sub="raw rows, no rounding" />
      </KpiStrip>

      {/* Report builder — scope + dataset picker over real queried rows */}
      <SectionCard
        title="Report builder"
        right={
          <GhostButton onClick={() => exportSelection()} disabled={totalRows === 0}>
            Export selection
          </GhostButton>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <Chip key={r.label} active={rangeDays === r.days} onClick={() => setRangeDays(r.days)}>
              {r.label}
            </Chip>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {datasets.map((d) => {
            const on = selected.includes(d.key);
            const count = scopeRows(d, rangeDays).length;
            const usable = d.rows.length > 0;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => toggle(d.key)}
                className={`rounded-[14px] border p-4 text-left transition-all ${
                  on ? 'border-[#C9DEF7] bg-[#F5F9FE]' : 'border-[#EEF1F5] bg-white hover:border-[#C9DEF7]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="of-display text-[15px] font-semibold text-[#171A17]">{d.label}</div>
                  <Badge label={moduleName(d.module)} tone="info" />
                </div>
                <p className="mt-1.5 text-[13px] leading-snug text-[#6B6F68]">{d.description}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="of-num text-[13px] font-semibold" style={{ color: usable ? '#171A17' : '#A0A49C' }}>
                    {count} row{count === 1 ? '' : 's'}
                  </span>
                  <span className="text-[12px] text-[#8A8E86]">{isDated(d) ? 'date-scoped' : 'current state'}</span>
                </div>
              </button>
            );
          })}
        </div>

        {preview ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="of-display text-[14px] font-semibold text-[#171A17]">
                Preview — {preview.ds.label} <span className="font-normal text-[#8A8E86]">(first {Math.min(PREVIEW_ROWS, preview.rows.length)} of {preview.rows.length})</span>
              </h3>
              <GhostButton onClick={() => exportOne(preview.ds)}>Export {preview.ds.label}</GhostButton>
            </div>
            <DataTable
              columns={preview.ds.columns.map((c, i) => ({ label: c, align: i > 2 && typeof preview.rows[0]?.[i] === 'number' ? 'right' : 'left' }))}
              rows={preview.rows.slice(0, PREVIEW_ROWS).map((r) => r.map((cell) => String(cell)))}
              empty="No rows in range."
            />
          </div>
        ) : (
          <p className="mt-5 rounded-[14px] border border-dashed border-[#D8DFE8] bg-[#FBFCFE] px-4 py-8 text-center text-[13px] text-[#6B6F68]">
            No rows for the selected datasets in this range. Widen the range or pick another dataset.
          </p>
        )}

        {note ? <p className="mt-3 text-[12px] font-medium text-[#0F6E56]">{note}</p> : null}
        <p className="mt-3 text-[12px] text-[#A0A49C]">
          Every row above came from an org-scoped query against the source module’s own table this request — the CSV is the raw data, not a
          rendered summary.
        </p>
      </SectionCard>

      {/* Saved report definitions */}
      <SectionCard title="Saved reports" right={<Badge label={`${reports.length} saved`} tone="neutral" />}>
        <DataTable
          columns={[
            { label: 'Report name' },
            { label: 'Scope' },
            { label: 'Modules' },
            { label: 'Schedule' },
            { label: 'Last run' },
            { label: 'Owner' },
            { label: 'Status', align: 'right' },
          ]}
          rows={reportRows}
          empty="No saved reports yet — use “+ Create report” to save a definition you can run and export."
        />
      </SectionCard>
    </div>
  );
}
