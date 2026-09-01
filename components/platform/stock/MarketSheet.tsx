'use client';

import { useMemo, useState } from 'react';
import { Badge, DataTable, type Column } from '@/components/platform/module-ui';

/**
 * The market sheet table: one row per stock item, one column per big supplier,
 * each cell the latest price that supplier charged for that item.
 *
 * Pure renderer. Every number arrives already reduced by the page (server) —
 * this component never re-derives a best price or a trend, so what the user
 * reads and what the roll-ups above it say can't drift apart on a re-render.
 */

/** One supplier's latest price for the row's item. */
export interface MarketRow {
  id: string;
  item: string;
  category: string;
  unit: string;
  /** Cheapest latest price across every supplier that has priced this item. */
  bestPrice: number | null;
  bestSupplier: string | null;
  /** How many suppliers have a price on file for this item. */
  supplierCount: number;
  /** Dearest vs cheapest, %, null when only one supplier prices the item. */
  spreadPct: number | null;
  /** Week-on-week move on the item's average unit price, from the catalogue. */
  trendPct: number | null;
  /** supplier name → latest price. Sparse: most items have one or two. */
  prices: Record<string, number>;
}

const PAGE = 40;

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 });
const money = (n: number | null) => (n == null ? '—' : zar.format(n));

/** A price a supplier charges that is well above the cheapest is worth seeing
 *  at a glance; a small gap is noise and gets no colour. */
function priceTone(price: number, best: number | null): string {
  if (best == null || best <= 0) return 'var(--pf-text-body)';
  const over = ((price - best) / best) * 100;
  if (over <= 0.5) return 'var(--tone-positive-fg)';
  if (over >= 10) return 'var(--tone-critical-fg)';
  return 'var(--pf-text-body)';
}

export function MarketSheet({
  rows,
  supplierColumns,
  sourceNote,
}: {
  rows: MarketRow[];
  /** The suppliers that get their own column, widest coverage first. */
  supplierColumns: string[];
  /** Where the prices came from — shown so nobody mistakes the sheet for a quote. */
  sourceNote: string;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [multiOnly, setMultiOnly] = useState(false);
  const [page, setPage] = useState(0);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.category) set.add(r.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (multiOnly && r.supplierCount < 2) return false;
      if (!q) return true;
      return r.item.toLowerCase().includes(q) || (r.bestSupplier ?? '').toLowerCase().includes(q);
    });
  }, [rows, search, category, multiOnly]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE, safePage * PAGE + PAGE);

  const columns: Column[] = [
    { label: 'Item' },
    { label: 'Best price', align: 'right' },
    { label: 'Best supplier' },
    ...supplierColumns.map((s): Column => ({ label: s, align: 'right' })),
    { label: 'Spread', align: 'right' },
    { label: 'Trend', align: 'right' },
  ];

  const body = pageRows.map((r) => [
    <div key="item" className="min-w-[180px]">
      <div className="text-[14px] font-semibold text-[var(--pf-text)]">{r.item}</div>
      <div className="mt-0.5 text-[12px] text-[var(--pf-text-muted)]">
        {[r.category, r.unit].filter(Boolean).join(' · ') || '—'}
      </div>
    </div>,
    <span key="best" className="font-semibold text-[var(--pf-text)]">{money(r.bestPrice)}</span>,
    <span key="bestsup" className="text-[13px]">{r.bestSupplier ?? '—'}</span>,
    ...supplierColumns.map((s) => {
      const p = r.prices[s];
      if (p == null) return <span key={s} className="text-[var(--pf-text-faint)]">—</span>;
      return (
        <span key={s} style={{ color: priceTone(p, r.bestPrice) }}>
          {money(p)}
        </span>
      );
    }),
    r.spreadPct == null ? (
      <span key="spread" className="text-[var(--pf-text-faint)]">—</span>
    ) : (
      <Badge key="spread" label={`${r.spreadPct}%`} tone={r.spreadPct >= 10 ? 'critical' : r.spreadPct >= 4 ? 'warning' : 'neutral'} />
    ),
    r.trendPct == null ? (
      <span key="trend" className="text-[var(--pf-text-faint)]">—</span>
    ) : (
      <span key="trend" style={{ color: r.trendPct > 0 ? 'var(--tone-critical-fg)' : r.trendPct < 0 ? 'var(--tone-positive-fg)' : 'var(--pf-text-muted)' }}>
        {r.trendPct > 0 ? '+' : ''}
        {r.trendPct}%
      </span>
    ),
  ]);

  const control =
    'h-10 rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-3 text-[14px] text-[var(--pf-text-control)] outline-none placeholder:text-[var(--pf-text-faint)] focus:border-[var(--pf-accent)]';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-[var(--pf-text-secondary)]">{sourceNote}</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search items or suppliers"
            className={`${control} w-[220px]`}
          />
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(0);
            }}
            className={control}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[13px] text-[var(--pf-text-secondary)]">
            <input
              type="checkbox"
              checked={multiOnly}
              onChange={(e) => {
                setMultiOnly(e.target.checked);
                setPage(0);
              }}
            />
            Comparable only
          </label>
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={body}
          empty="No supplier prices on file yet. Upload an invoice or price list and the sheet fills itself."
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[13px] text-[var(--pf-text-muted)]">
        <span>
          {filtered.length.toLocaleString('en-ZA')} item{filtered.length === 1 ? '' : 's'}
          {filtered.length !== rows.length ? ` of ${rows.length.toLocaleString('en-ZA')}` : ''}
        </span>
        {pageCount > 1 ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              className="rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {safePage + 1} of {pageCount}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
              className="rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </span>
        ) : null}
      </div>
    </div>
  );
}
