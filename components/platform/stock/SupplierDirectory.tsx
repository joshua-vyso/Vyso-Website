'use client';

import { useMemo, useState } from 'react';
import { Badge, DataTable, type Column, type Tone } from '@/components/platform/module-ui';
import { SupplierProfilePanel, type SupplierProfileData } from './SupplierProfilePanel';

/**
 * The supplier list, and the profile panel it drives.
 *
 * Selection is the only state here — the profiles arrive fully built from the
 * server, so clicking a row is a lookup, not a fetch. That is what makes an
 * inline panel better than the old drawer's per-open round trip, and it is
 * affordable because a produce business has tens of suppliers, not thousands.
 */

export interface SupplierDirectoryRow {
  /** Stable key shared with the profile map — the ss profile id where there is
   *  one, otherwise `core:<suppliers.id>`. */
  key: string;
  name: string;
  category: string;
  status: string;
  rating: number;
  lastOrder: string | null;
  spendMtd: number;
  openCredits: number;
  /** False when the row is a core `suppliers` row with no SupplySync profile. */
  hasProfile: boolean;
}

const zar0 = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });

const STATUS_TONE: Record<string, Tone> = {
  preferred: 'positive',
  active: 'info',
  review: 'warning',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

const COLUMNS: Column[] = [
  { label: 'Supplier' },
  { label: 'Category' },
  { label: 'Status' },
  { label: 'Rating', align: 'right' },
  { label: 'Last order' },
  { label: 'Spend MTD', align: 'right' },
  { label: 'Open credits', align: 'right' },
];

export function SupplierDirectory({
  rows,
  profiles,
}: {
  rows: SupplierDirectoryRow[];
  /** Keyed by `SupplierDirectoryRow.key`. */
  profiles: Record<string, SupplierProfileData>;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<string | null>(rows[0]?.key ?? null);

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    });
  }, [rows, search, category]);

  const body = filtered.map((r) => [
    <button
      key="name"
      type="button"
      onClick={() => setSelected(r.key)}
      className={`text-left text-[14px] font-semibold hover:underline ${
        selected === r.key ? 'text-[var(--pf-accent-strong)]' : 'text-[var(--pf-text)]'
      }`}
    >
      {r.name}
    </button>,
    <span key="cat" className="text-[13px]">{r.category || 'Uncategorised'}</span>,
    r.hasProfile ? (
      <Badge key="status" label={r.status} tone={STATUS_TONE[r.status] ?? 'neutral'} />
    ) : (
      <Badge key="status" label="No profile" tone="neutral" />
    ),
    <span key="rating">{r.hasProfile ? r.rating.toFixed(1) : '—'}</span>,
    <span key="last" className="text-[13px]">{fmtDate(r.lastOrder)}</span>,
    <span key="spend">{r.spendMtd > 0 ? zar0.format(r.spendMtd) : '—'}</span>,
    r.openCredits > 0 ? (
      <Badge key="credits" label={String(r.openCredits)} tone="warning" />
    ) : (
      <span key="credits" className="text-[var(--pf-text-faint)]">—</span>
    ),
  ]);

  const control =
    'h-10 rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-3 text-[14px] text-[var(--pf-text-control)] outline-none placeholder:text-[var(--pf-text-faint)] focus:border-[var(--pf-accent)]';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[var(--pf-text-secondary)]">
            Everyone you buy from — supplier profiles merged with the suppliers your documents are filed against.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers"
              className={`${control} w-[200px]`}
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={control}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <DataTable
            columns={COLUMNS}
            rows={body}
            empty="No suppliers yet. They appear as soon as a document is filed against one."
          />
        </div>

        <p className="mt-3 text-[13px] text-[var(--pf-text-muted)]">
          {filtered.length.toLocaleString('en-ZA')} supplier{filtered.length === 1 ? '' : 's'}
          {filtered.length !== rows.length ? ` of ${rows.length.toLocaleString('en-ZA')}` : ''}
        </p>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <SupplierProfilePanel supplier={selected ? profiles[selected] ?? null : null} />
      </div>
    </div>
  );
}
