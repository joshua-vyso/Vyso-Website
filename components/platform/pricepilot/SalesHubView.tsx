'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { zar, zar2 } from '@/lib/platform/pricepilot';

/** A sale as the hub needs it — enough to group by month and drill by customer. */
export interface HubOrder {
  id: string;
  invoice: string;
  customerId: string | null;
  customer: string;
  date: string;
  revenue: number;
  costableRev: number;
  cost: number;
  profit: number;
  margin: number | null;
}

/** A rolled-up dimension row (a customer, a product, or a month). */
export interface HubEntity {
  key: string;
  label: string;
  units: number;
  orders: number;
  revenue: number;
  costableRev: number;
  cost: number;
  profit: number;
  margin: number | null;
}

export interface SalesHubViewProps {
  orders: HubOrder[];
  customers: HubEntity[];
  products: HubEntity[];
  /** Top products per customer (customer key → rows), for the customer drill. */
  productsByCustomer: Record<string, HubEntity[]>;
  /** Top customers per product (product key → rows), for the product drill. */
  customersByProduct: Record<string, HubEntity[]>;
  target: number;
}

type Tab = 'months' | 'customers' | 'products';

const TABS: { key: Tab; label: string }[] = [
  { key: 'months', label: 'By month' },
  { key: 'customers', label: 'By customer' },
  { key: 'products', label: 'By product' },
];

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(key: string): string {
  if (key === 'unknown') return 'Undated';
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Sales hub — the same realized sales seen three ways: rolled up by month, by
 * customer, and by product. Customer and product rows open a drill panel that
 * answers the follow-up question ("what does this customer actually buy", "who
 * buys this product") without leaving the tab.
 */
export function SalesHubView({ orders, customers, products, productsByCustomer, customersByProduct, target }: SalesHubViewProps) {
  const [tab, setTab] = useState<Tab>('months');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const months = useMemo(() => {
    const byKey = new Map<string, { key: string; orders: HubOrder[]; revenue: number; costableRev: number; cost: number }>();
    for (const o of orders) {
      const k = monthKey(o.date);
      const g = byKey.get(k) ?? { key: k, orders: [], revenue: 0, costableRev: 0, cost: 0 };
      g.orders.push(o);
      g.revenue += o.revenue;
      g.costableRev += o.costableRev;
      g.cost += o.cost;
      byKey.set(k, g);
    }
    return [...byKey.values()]
      .map((g) => ({ ...g, profit: g.costableRev - g.cost, margin: g.costableRev > 0 ? ((g.costableRev - g.cost) / g.costableRev) * 100 : null }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [orders]);

  const filtered = useMemo(() => {
    const list = tab === 'customers' ? customers : tab === 'products' ? products : [];
    const needle = q.trim().toLowerCase();
    return needle ? list.filter((r) => r.label.toLowerCase().includes(needle)) : list;
  }, [tab, customers, products, q]);

  const totals = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + o.revenue, 0);
    const costableRev = orders.reduce((s, o) => s + o.costableRev, 0);
    const cost = orders.reduce((s, o) => s + o.cost, 0);
    const profit = costableRev - cost;
    return { revenue, profit, margin: costableRev > 0 ? (profit / costableRev) * 100 : null };
  }, [orders]);

  const ordersByCustomer = useMemo(() => {
    const m = new Map<string, HubOrder[]>();
    for (const o of orders) {
      const k = o.customerId ?? '∅';
      const arr = m.get(k) ?? [];
      arr.push(o);
      m.set(k, arr);
    }
    return m;
  }, [orders]);

  const isEmpty = orders.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold tracking-[-0.015em] text-[#171A17]">Sales hub</h1>
          <p className="mt-1 text-[14px] text-[#8A8E86]">Your realized sales by month, customer and product — with the margin on each</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[#EAEDF2] bg-white px-8 py-14 text-center">
          <h2 className="of-display text-[18px] font-semibold text-[#171A17]">No sales yet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[14px] text-[#8A8E86]">
            Invoiced orders from OrderFlow roll up here by month, by customer and by product, each with its gross profit
            and margin.
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
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Sales" value={String(orders.length)} />
            <Stat label="Revenue" value={zar(totals.revenue)} />
            <Stat label="Gross profit" value={zar(totals.profit)} color="#0F6E56" />
            <Stat
              label="Avg margin"
              value={totals.margin != null ? `${Math.round(totals.margin)}%` : '—'}
              color={totals.margin == null ? undefined : totals.margin >= target ? '#0F6E56' : '#854F0B'}
              sub={`Target ${Math.round(target)}%`}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setOpenKey(null);
                    setQ('');
                  }}
                  className={`h-8 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                    tab === t.key ? 'border-[#3E7BC4] bg-[#1F5FA8] text-white' : 'border-[#E2E6EC] bg-white text-[#6B6F68] hover:border-[#3E7BC4]/40'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab !== 'months' ? (
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tab === 'customers' ? 'Search customers' : 'Search products'}
                className="ml-auto h-8 w-[220px] rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[13px] text-[#171A17] outline-none transition-colors placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
              />
            ) : null}
          </div>

          {tab === 'months' ? (
            <div className="mt-3 space-y-4">
              {months.map((g) => (
                <div key={g.key} className="overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EEF1F5] bg-[#FBFCFE] px-5 py-3">
                    <span className="of-display text-[16px] font-semibold text-[#171A17]">{monthLabel(g.key)}</span>
                    <span className="text-[13px] text-[#8A8E86]">
                      <span className="of-num">{g.orders.length}</span> sale{g.orders.length === 1 ? '' : 's'} ·{' '}
                      <span className="of-num font-semibold text-[#171A17]">{zar(g.revenue)}</span> ·{' '}
                      <span className="of-num font-semibold text-[#0F6E56]">{zar(g.profit)}</span> GP ·{' '}
                      <span className="of-num font-semibold" style={{ color: g.margin == null ? '#8A8E86' : g.margin >= target ? '#0F6E56' : '#854F0B' }}>
                        {g.margin != null ? `${Math.round(g.margin)}%` : '—'}
                      </span>
                    </span>
                  </div>
                  {g.orders.map((o) => (
                    <Link
                      key={o.id}
                      href={`/app/orderflow/orders/${o.id}`}
                      className="flex items-center gap-3 border-t border-[#F4F5F7] px-5 py-3 text-[14px] text-[#171A17] transition-colors first:border-t-0 hover:bg-[#F5F9FE]"
                    >
                      <span className="of-num w-[120px] shrink-0 font-semibold">{o.invoice}</span>
                      <span className="min-w-0 flex-1 truncate text-[#2C333B]">{o.customer}</span>
                      <span className="of-num w-[70px] shrink-0 text-right text-[12px] text-[#A0A49C]">{fmtDate(o.date)}</span>
                      <span className="of-num w-[110px] shrink-0 text-right font-semibold">{zar2(o.revenue)}</span>
                      <span
                        className="of-num w-[70px] shrink-0 text-right font-semibold"
                        style={{ color: o.margin == null ? '#8A8E86' : o.margin >= target ? '#0F6E56' : '#854F0B' }}
                      >
                        {o.margin != null ? `${Math.round(o.margin)}%` : '—'}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
              <div className="grid grid-cols-[1.8fr_0.7fr_1fr_1fr_0.7fr_auto] gap-2 border-b border-[#EEF1F5] bg-[#FBFCFE] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                <span>{tab === 'customers' ? 'Customer' : 'Product'}</span>
                <span className="text-right">{tab === 'customers' ? 'Orders' : 'Units'}</span>
                <span className="text-right">Revenue</span>
                <span className="text-right">Gross profit</span>
                <span className="text-right">Margin</span>
                <span className="w-6" />
              </div>
              {filtered.length === 0 ? (
                <p className="px-5 py-12 text-center text-[13px] text-[#8A8E86]">Nothing matches that search.</p>
              ) : (
                filtered.map((r) => {
                  const open = openKey === r.key;
                  return (
                    <div key={r.key} className="border-t border-[#F4F5F7] first:border-t-0">
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : r.key)}
                        aria-expanded={open}
                        className={`grid w-full grid-cols-[1.8fr_0.7fr_1fr_1fr_0.7fr_auto] items-center gap-2 px-5 py-3 text-left text-[14px] transition-colors ${
                          open ? 'bg-[#F5F9FE]' : 'hover:bg-[#F5F9FE]'
                        }`}
                      >
                        <span className="min-w-0 truncate font-semibold text-[#171A17]">{r.label}</span>
                        <span className="of-num text-right text-[#6B6F68]">{Math.round(tab === 'customers' ? r.orders : r.units)}</span>
                        <span className="of-num text-right text-[#6B6F68]">{zar(r.revenue)}</span>
                        <span className="of-num text-right font-semibold" style={{ color: r.profit >= 0 ? '#0F6E56' : '#A32D2D' }}>
                          {zar(r.profit)}
                        </span>
                        <span
                          className="of-num text-right font-semibold"
                          style={{ color: r.margin == null ? '#8A8E86' : r.margin >= target ? '#0F6E56' : '#854F0B' }}
                        >
                          {r.margin != null ? `${Math.round(r.margin)}%` : '—'}
                        </span>
                        <span className={`w-6 text-center text-[#C7C9C5] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden>
                          ⌄
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-[#F4F5F7] bg-[#FBFCFE] px-5 py-4">
                          {tab === 'customers' ? (
                            <CustomerDrill
                              products={productsByCustomer[r.key] ?? []}
                              orders={(ordersByCustomer.get(r.key) ?? []).slice(0, 8)}
                              target={target}
                            />
                          ) : (
                            <ProductDrill customers={customersByProduct[r.key] ?? []} target={target} />
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}

          <p className="mt-2 text-[12px] text-[#A0A49C]">
            Gross profit and margin use each product&rsquo;s latest recorded cost; lines with no cost yet are excluded
            from the profit figures but still counted in revenue.
          </p>
        </>
      )}
    </div>
  );
}

function CustomerDrill({ products, orders, target }: { products: HubEntity[]; orders: HubOrder[]; target: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div>
        <h3 className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">What they buy</h3>
        {products.length === 0 ? (
          <p className="mt-2 text-[13px] text-[#8A8E86]">No costed product lines on these orders yet.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {products.map((p) => (
              <div key={p.key} className="flex items-center justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-[#171A17]">{p.label}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="of-num text-[#A0A49C]">{Math.round(p.units)} u</span>
                  <span className="of-num w-20 text-right text-[#6B6F68]">{zar(p.revenue)}</span>
                  <span
                    className="of-num w-10 text-right font-semibold"
                    style={{ color: p.margin == null ? '#8A8E86' : p.margin >= target ? '#0F6E56' : '#854F0B' }}
                  >
                    {p.margin != null ? `${Math.round(p.margin)}%` : '—'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Recent orders</h3>
        <div className="mt-2 flex flex-col gap-2">
          {orders.map((o) => (
            <Link key={o.id} href={`/app/orderflow/orders/${o.id}`} className="flex items-center justify-between gap-3 text-[13px] hover:text-[#174C87]">
              <span className="of-num min-w-0 truncate font-semibold text-[#171A17]">{o.invoice}</span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="of-num text-[#A0A49C]">{fmtDate(o.date)}</span>
                <span className="of-num w-20 text-right text-[#6B6F68]">{zar2(o.revenue)}</span>
                <span
                  className="of-num w-10 text-right font-semibold"
                  style={{ color: o.margin == null ? '#8A8E86' : o.margin >= target ? '#0F6E56' : '#854F0B' }}
                >
                  {o.margin != null ? `${Math.round(o.margin)}%` : '—'}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductDrill({ customers, target }: { customers: HubEntity[]; target: number }) {
  if (customers.length === 0) {
    return <p className="text-[13px] text-[#8A8E86]">No customer breakdown available for this product yet.</p>;
  }
  return (
    <div>
      <h3 className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Who buys it</h3>
      <div className="mt-2 flex flex-col gap-2">
        {customers.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-[#171A17]">{c.label}</span>
            <span className="flex shrink-0 items-center gap-3">
              <span className="of-num text-[#A0A49C]">{Math.round(c.units)} u</span>
              <span className="of-num w-24 text-right text-[#6B6F68]">{zar(c.revenue)}</span>
              <span className="of-num w-20 text-right font-semibold" style={{ color: c.profit >= 0 ? '#0F6E56' : '#A32D2D' }}>
                {zar(c.profit)}
              </span>
              <span
                className="of-num w-10 text-right font-semibold"
                style={{ color: c.margin == null ? '#8A8E86' : c.margin >= target ? '#0F6E56' : '#854F0B' }}
              >
                {c.margin != null ? `${Math.round(c.margin)}%` : '—'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
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
