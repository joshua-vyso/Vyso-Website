'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ORDER_STATUS_STYLE, type OrderStatus } from '@/lib/platform/orderflow';
import { zar, zar2 } from '@/lib/platform/pricepilot';

/** One realized sale with its costed-margin maths already done server-side. */
export interface SaleRow {
  id: string;
  invoice: string;
  customerId: string | null;
  customer: string;
  status: OrderStatus;
  date: string;
  /** Full invoice revenue. */
  revenue: number;
  /** Revenue of the lines that have a recorded cost (margin denominator). */
  costableRev: number;
  cost: number;
  profit: number;
  margin: number | null;
  /** True when some lines have no recorded cost, so margin covers part of the order. */
  uncosted: boolean;
  lines: number;
}

export interface RecentSalesViewProps {
  sales: SaleRow[];
  customers: { id: string; name: string }[];
  target: number;
  /** Server render time (ms). Passed in so the relative windows are stable across
   *  re-renders rather than drifting with every keystroke in the filters. */
  now: number;
}

type WindowKey = '30d' | '90d' | 'all';
type MarginFilter = 'all' | 'below' | 'above' | 'uncosted';
type SortKey = 'date' | 'revenue' | 'margin' | 'profit';

const WINDOWS: { key: WindowKey; label: string; days: number | null }[] = [
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

const MARGIN_FILTERS: { key: MarginFilter; label: string }[] = [
  { key: 'all', label: 'All margins' },
  { key: 'below', label: 'Below target' },
  { key: 'above', label: 'At or above target' },
  { key: 'uncosted', label: 'Missing costs' },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Newest' },
  { key: 'revenue', label: 'Biggest' },
  { key: 'profit', label: 'Most profit' },
  { key: 'margin', label: 'Worst margin' },
];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Recent sales — every realized sale with the margin PricePilot actually earned
 * on it, filterable by period, customer, status and margin health. The point of
 * the tab is finding the orders that quietly lost money, so "worst margin" is a
 * first-class sort and below-target rows are tinted.
 */
export function RecentSalesView({ sales, customers, target, now }: RecentSalesViewProps) {
  const [win, setWin] = useState<WindowKey>('90d');
  const [q, setQ] = useState('');
  const [customerId, setCustomerId] = useState('all');
  const [status, setStatus] = useState<'all' | OrderStatus>('all');
  const [marginFilter, setMarginFilter] = useState<MarginFilter>('all');
  const [sort, setSort] = useState<SortKey>('date');

  const rows = useMemo(() => {
    const days = WINDOWS.find((w) => w.key === win)!.days;
    const since = days == null ? 0 : now - days * 86_400_000;
    const needle = q.trim().toLowerCase();

    const filtered = sales.filter((s) => {
      const ts = new Date(s.date).getTime();
      if (Number.isFinite(ts) && ts < since) return false;
      if (customerId !== 'all' && (s.customerId ?? '∅') !== customerId) return false;
      if (status !== 'all' && s.status !== status) return false;
      if (marginFilter === 'below' && !(s.margin != null && s.margin < target)) return false;
      if (marginFilter === 'above' && !(s.margin != null && s.margin >= target)) return false;
      if (marginFilter === 'uncosted' && !s.uncosted && s.margin != null) return false;
      if (needle && !`${s.invoice} ${s.customer}`.toLowerCase().includes(needle)) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === 'revenue') return b.revenue - a.revenue;
      if (sort === 'profit') return b.profit - a.profit;
      if (sort === 'margin') return (a.margin ?? 9999) - (b.margin ?? 9999);
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [sales, win, q, customerId, status, marginFilter, sort, target, now]);

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const costableRev = rows.reduce((s, r) => s + r.costableRev, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const profit = costableRev - cost;
    return { revenue, profit, margin: costableRev > 0 ? (profit / costableRev) * 100 : null, count: rows.length };
  }, [rows]);

  const statuses = useMemo(() => [...new Set(sales.map((s) => s.status))], [sales]);
  const belowCount = rows.filter((r) => r.margin != null && r.margin < target).length;
  const filtersActive = win !== '90d' || q !== '' || customerId !== 'all' || status !== 'all' || marginFilter !== 'all';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Recent sales</h1>
          <p className="mt-1 text-[14px] text-[#8A8E86]">Every realized sale with the margin you actually earned on it</p>
        </div>
        <div className="inline-flex rounded-[10px] border border-[#EEF1F5] bg-[#F6F8FB] p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              onClick={() => setWin(w.key)}
              className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                win === w.key ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'text-[#8A8E86] hover:text-[#174C87]'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {sales.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#EAEDF2] bg-white px-8 py-14 text-center">
          <h2 className="of-display text-[18px] font-semibold text-[#171A17]">No sales yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[14px] text-[#8A8E86]">
            Invoice an order in OrderFlow and it&rsquo;ll appear here with its cost, profit and margin worked out.
          </p>
          <Link
            href="/app/orderflow/orders"
            className="mt-5 inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
          >
            Open OrderFlow →
          </Link>
        </div>
      ) : (
        <>
          {/* Summary of what's on screen right now */}
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Sales shown" value={String(totals.count)} />
            <Stat label="Revenue" value={zar(totals.revenue)} />
            <Stat label="Gross profit" value={zar(totals.profit)} color="#0F6E56" />
            <Stat
              label="Avg margin"
              value={totals.margin != null ? `${Math.round(totals.margin)}%` : '—'}
              color={totals.margin == null ? undefined : totals.margin >= target ? '#0F6E56' : '#854F0B'}
              sub={belowCount > 0 ? `${belowCount} below your ${Math.round(target)}% target` : `Target ${Math.round(target)}%`}
            />
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoice or customer"
              className="h-9 w-[240px] rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[13px] text-[#171A17] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
            />
            <Select value={customerId} onChange={setCustomerId}>
              <option value="all">All customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="∅">No customer</option>
            </Select>
            <Select value={status} onChange={(v) => setStatus(v as 'all' | OrderStatus)}>
              <option value="all">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_STYLE[s]?.label ?? s}
                </option>
              ))}
            </Select>
            <Select value={marginFilter} onChange={(v) => setMarginFilter(v as MarginFilter)}>
              {MARGIN_FILTERS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Select value={sort} onChange={(v) => setSort(v as SortKey)}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setWin('90d');
                  setQ('');
                  setCustomerId('all');
                  setStatus('all');
                  setMarginFilter('all');
                }}
                className="h-9 rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[12px] font-medium text-[#6B6F68] transition-colors hover:border-[#3E7BC4] hover:text-[#174C87]"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#EEF1F5] bg-[#FBFCFE] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                    <th className="px-5 py-2.5 text-left font-medium">Invoice</th>
                    <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                    <th className="px-3 py-2.5 text-left font-medium">Status</th>
                    <th className="px-3 py-2.5 text-right font-medium">Revenue</th>
                    <th className="px-3 py-2.5 text-right font-medium">Cost</th>
                    <th className="px-3 py-2.5 text-right font-medium">Profit</th>
                    <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                    <th className="px-5 py-2.5 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-[13px] text-[#8A8E86]">
                        No sales match these filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((s) => {
                      const st = ORDER_STATUS_STYLE[s.status] ?? ORDER_STATUS_STYLE.invoiced;
                      const below = s.margin != null && s.margin < target;
                      return (
                        <tr key={s.id} className="border-b border-[#F4F5F7] last:border-0 hover:bg-[#F5F9FE]">
                          <td className="px-5 py-3">
                            <Link href={`/app/orderflow/orders/${s.id}`} className="of-num font-semibold text-[#171A17] hover:text-[#174C87]">
                              {s.invoice}
                            </Link>
                            <span className="of-num ml-1.5 text-[11px] text-[#A0A49C]">{s.lines} line{s.lines === 1 ? '' : 's'}</span>
                          </td>
                          <td className="px-3 py-3 text-[#2C333B]">{s.customer}</td>
                          <td className="px-3 py-3">
                            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: st.bg, color: st.fg }}>
                              {st.label}
                            </span>
                          </td>
                          <td className="of-num px-3 py-3 text-right font-semibold text-[#171A17]">{zar2(s.revenue)}</td>
                          <td className="of-num px-3 py-3 text-right text-[#6B6F68]">
                            {s.costableRev > 0 ? zar2(s.cost) : '—'}
                            {s.uncosted ? (
                              <span className="block text-[11px] text-[#A0A49C]" title={`Costed on ${zar2(s.costableRev)} of ${zar2(s.revenue)}`}>
                                part costed
                              </span>
                            ) : null}
                          </td>
                          <td
                            className="of-num px-3 py-3 text-right font-semibold"
                            style={{ color: s.costableRev <= 0 ? '#8A8E86' : s.profit >= 0 ? '#0F6E56' : '#A32D2D' }}
                          >
                            {s.costableRev > 0 ? zar2(s.profit) : '—'}
                          </td>
                          <td className="of-num px-3 py-3 text-right font-semibold" style={{ color: s.margin == null ? '#8A8E86' : below ? '#854F0B' : '#0F6E56' }}>
                            {s.margin != null ? `${Math.round(s.margin)}%` : '—'}
                          </td>
                          <td className="of-num px-5 py-3 text-right text-[#A0A49C]">{fmtDate(s.date)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-[#A0A49C]">
            Cost, profit and margin use each product&rsquo;s latest recorded cost. Lines with no cost yet are excluded
            from the margin, so a part-costed order shows the margin on the costed portion only.
          </p>
        </>
      )}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-[10px] border border-[#E2E6EC] bg-white px-2.5 text-[13px] text-[#171A17] outline-none transition-colors focus:border-[#3E7BC4]"
    >
      {children}
    </select>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{label}</div>
      <div className="of-num mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em]" style={{ color: color ?? '#171A17' }}>
        {value}
      </div>
      {sub ? <div className="of-num mt-1.5 text-[12px] text-[#A0A49C]">{sub}</div> : null}
    </div>
  );
}
