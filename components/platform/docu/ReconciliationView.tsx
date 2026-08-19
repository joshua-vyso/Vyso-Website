'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocuChrome } from './Chrome';
import {
  buildReconciliationCsv,
  fmtZar,
  monthKeyOf,
  monthLabelOf,
  parseStatementDate,
  toReconRow,
  type ReconRow,
} from '@/lib/platform/docu/reconciliation';
import type { DocumentWithSupplier } from '@/lib/platform/types';

/**
 * The reconciliation grid's tracks, and the width they actually need.
 *
 * `min-w-[1080px]` WAS 38px SHORT and that is the whole "squished" bug (Josh,
 * 2026-08-19). The tracks sum to 1078 (100 + 150 + 7×108 + 72) and the row adds
 * `px-5`, so the real requirement is 1078 + 40 = 1118 — but `min-width` is on the
 * border box, so the grid settled at 1080, its fixed tracks overflowed their own
 * container by 38px, and the last two columns ("Closing", "Check") rendered on
 * top of each other AND outside the scroll container's reach: measured
 * scrollWidth 1098 against content ending at 1118, so no amount of scrolling
 * revealed them.
 *
 * `min-w-max` rather than a second hard-coded number, so adding a column can
 * never reintroduce this: max-content of a grid with fixed tracks IS the sum of
 * the tracks plus the padding, computed by the browser instead of by hand.
 *
 * `gap-x-3` is the other half of "squished": seven right-aligned money columns
 * with no gutter between the tracks put "PURCHASES" and "PALLET REFUNDS" flush
 * against each other, which reads as one run-on heading. The gutter costs 96px
 * of width the container now scrolls for anyway.
 */
const COLS = 'min-w-max gap-x-3 grid-cols-[100px_150px_repeat(7,108px)_72px]';

type Row = ReconRow & { monthKey: string };

function rowTime(r: Row): number {
  const d = parseStatementDate(r.date);
  return d ? d.getTime() : 0;
}

/**
 * Reconciliation as collapsible month tiles, grouped by the date PARSED from
 * each statement (not the upload date). Each month has its own CSV export.
 * Polls + refreshes on focus so newly added/parsed statements appear live.
 */
export function ReconciliationView({ statements }: { statements: DocumentWithSupplier[] }) {
  const router = useRouter();

  // The server already rendered fresh data, so there's no mount-time refresh.
  // We refresh when the user returns to the tab (so a statement uploaded/parsed
  // elsewhere shows up), and ONLY poll on an interval while something is still
  // extracting — an idle reconciliation tab makes zero background server hits.
  const hasPending = statements.some((s) => s.status === 'pending');
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') router.refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const iv = hasPending ? setInterval(refresh, 5000) : undefined;
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      if (iv) clearInterval(iv);
    };
  }, [router, hasPending]);

  const groups = useMemo(() => {
    const rows: Row[] = statements
      .map(toReconRow)
      .filter((r): r is ReconRow => r != null)
      .map((r) => {
        const d = parseStatementDate(r.date);
        return { ...r, monthKey: d ? monthKeyOf(d) : 'undated' };
      });
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      if (!map.has(r.monthKey)) map.set(r.monthKey, []);
      map.get(r.monthKey)!.push(r);
    }
    return [...map.entries()]
      .map(([key, rs]) => ({ key, label: monthLabelOf(key), rows: rs.sort((a, b) => rowTime(a) - rowTime(b)) }))
      .sort((a, b) => (a.key === 'undated' ? 1 : b.key === 'undated' ? -1 : a.key < b.key ? 1 : -1));
  }, [statements]);

  const parsedCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const missing = statements.length - parsedCount;

  const defaultOpen = groups.find((g) => g.key !== 'undated')?.key ?? groups[0]?.key;
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = (k: string) => overrides[k] ?? k === defaultOpen;
  const toggle = (k: string) => setOverrides((prev) => ({ ...prev, [k]: !isOpen(k) }));

  function downloadMonth(label: string, rows: Row[]) {
    const csv = buildReconciliationCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases-summary-${label.replace(/\s+/g, '-').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-8 py-7">
      <DocuChrome />

      <div className="mt-6">
        <h2 className="of-display text-[20px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Reconciliation</h2>
        <p className="mt-1.5 text-[14px] text-[#8A8E86]">
          Statement totals by month — grouped by the date on each statement. Export any month as CSV.
        </p>
      </div>

      {missing > 0 ? (
        <p className="mt-4 rounded-[14px] bg-[#FBEEDA] px-3.5 py-2.5 text-[13px] text-[#854F0B]">
          <span className="of-num font-semibold">{missing}</span> statement{missing === 1 ? '' : 's'} {missing === 1 ? 'has' : 'have'} no parsed totals yet — newly
          uploaded statements are parsed automatically.
        </p>
      ) : null}

      {parsedCount === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-8 py-14 text-center">
          <h2 className="of-display text-[18px] font-semibold text-[#171A17]">No statement totals yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[14px] text-[#6B6F68]">
            Upload supplier statements and Doc-U parses their transaction summaries here, ready to
            export.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {groups.map((g) => {
            const open = isOpen(g.key);
            return (
              <div key={g.key} className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <button
                    type="button"
                    onClick={() => toggle(g.key)}
                    className="flex items-center gap-2 text-left"
                    aria-expanded={open}
                  >
                    <span className={`text-[#8A8E86] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
                      ▾
                    </span>
                    <span className="of-display text-[16px] font-semibold text-[#171A17]">{g.label}</span>
                    <span className="text-[12px] text-[#A0A49C]">
                      <span className="of-num">{g.rows.length}</span> statement{g.rows.length === 1 ? '' : 's'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadMonth(g.label, g.rows)}
                    className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-[11px] bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Export CSV
                  </button>
                </div>

                {open ? (
                  <div className="overflow-x-auto border-t border-[#EAEDF2]">
                    <div className={`grid ${COLS} items-center border-b border-[#EEF1F5] bg-[#FBFCFE] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]`}>
                      <span>Date</span>
                      <span>Supplier</span>
                      <span className="text-right">Opening</span>
                      <span className="text-right">Payments</span>
                      <span className="text-right">Purchases</span>
                      <span className="text-right">Pallet refunds</span>
                      <span className="text-right">Pallet usage</span>
                      <span className="text-right">VAT</span>
                      <span className="text-right">Closing</span>
                      <span className="text-right">Check</span>
                    </div>
                    {g.rows.map((r) => {
                      const balanced = r.check != null && Math.abs(r.check) < 0.01;
                      return (
                        <div
                          key={r.id}
                          className={`grid ${COLS} items-center border-b border-[#F4F5F7] px-5 py-3 text-[14px] last:border-b-0 hover:bg-[#F5F9FE]`}
                        >
                          <span className="of-num text-[#171A17]">{r.date}</span>
                          <span className="truncate text-[#6B6F68]">{r.supplier}</span>
                          <span className="of-num text-right text-[#171A17]">{fmtZar(r.opening)}</span>
                          <span className="of-num text-right text-[#171A17]">{fmtZar(r.payments)}</span>
                          <span className="of-num text-right text-[#171A17]">{fmtZar(r.purchases)}</span>
                          <span className="of-num text-right text-[#6B6F68]">{fmtZar(r.palletRefunds)}</span>
                          <span className="of-num text-right text-[#6B6F68]">{fmtZar(r.palletUsage)}</span>
                          <span className="of-num text-right text-[#6B6F68]">{fmtZar(r.vat)}</span>
                          <span className="of-num text-right font-semibold text-[#171A17]">{fmtZar(r.closing)}</span>
                          <span className={`of-num text-right font-semibold ${r.check == null ? 'text-[#A0A49C]' : balanced ? 'text-[#0F6E56]' : 'text-[#A32D2D]'}`}>
                            {r.check == null ? '—' : balanced ? '✓' : r.check.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
