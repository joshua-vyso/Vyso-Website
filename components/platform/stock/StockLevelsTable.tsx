'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, DataTable, type Column, type Tone } from '@/components/platform/module-ui';
import { rand } from '@/lib/platform/procurepulse';
import { parseLocaleNumber } from '@/lib/platform/locale-number';
import type { StockRow } from '@/lib/platform/stock-data';

/**
 * The Stock tab's table — the org's catalogue with the threshold that governs
 * each line, editable in place.
 *
 * NEW COMPONENT, REUSED API. None of ProcurePulse's `LiveStockView` /
 * `ProductThresholds` markup is here; the save still goes to their
 * `POST /api/procurepulse/thresholds`, which is the part worth keeping.
 *
 * WHY THE WHOLE THRESHOLD ROW GOES BACK. That route upserts complete rows and
 * nulls any column the body omits, so sending only `low_threshold` would wipe a
 * product's par level, lead time and freshness settings. `StockRow.thresholdRow`
 * carries those values through the page purely so this form can hand them back
 * untouched.
 *
 * SEARCH AND FILTERING ARE CLIENT-SIDE. The catalogue is one org-scoped read
 * that the page already made (roughly a thousand rows at the top end); filtering
 * it in the browser is instant and costs no round-trip, where a server search
 * would re-fetch on every keystroke.
 */

const PAGE = 100;

const STATUS_TONE: Record<StockRow['status'], Tone> = {
  out: 'critical',
  low: 'warning',
  in_stock: 'positive',
};
const STATUS_LABEL: Record<StockRow['status'], string> = {
  out: 'Out',
  low: 'Low',
  in_stock: 'In stock',
};

const COLUMNS: Column[] = [
  { label: 'Product' },
  { label: 'Category' },
  { label: 'Pack / unit' },
  { label: 'On hand', align: 'right' },
  { label: 'Low at', align: 'right' },
  { label: 'Avg price', align: 'right' },
  { label: 'Cheapest supplier' },
];

function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function StockLevelsTable({ rows }: { rows: StockRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  /** Threshold edits by product id, held as raw strings until save. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (lowOnly && r.status === 'in_stock') return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q) ||
        (r.cheapestSupplier ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, lowOnly]);

  const visible = filtered.slice(0, shown);
  const dirtyIds = Object.keys(edits);

  async function save() {
    if (dirtyIds.length === 0 || busy) return;
    setBusy(true);
    setMsg(null);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const payload = dirtyIds
      .map((id) => {
        const row = byId.get(id);
        if (!row) return null;
        return {
          stock_item_id: id,
          // The route parses locale decimals itself; sending the raw string
          // keeps "12,5" meaning twelve-and-a-half rather than becoming NaN here.
          low_threshold: edits[id],
          ...row.thresholdRow,
        };
      })
      .filter(Boolean);

    try {
      const res = await fetch('/api/procurepulse/thresholds', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; saved?: number };
      if (!res.ok) {
        setMsg(json.error ?? 'Could not save.');
        return;
      }
      setEdits({});
      setMsg(`Saved ${json.saved ?? payload.length} product${(json.saved ?? 0) === 1 ? '' : 's'}.`);
      // The server page owns the numbers; refresh rather than patching local
      // state, so what's on screen is what's in the database.
      router.refresh();
    } catch {
      setMsg('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  const tableRows = visible.map((r) => {
    const edited = edits[r.id];
    // While a threshold is being typed, badge against the TYPED value: the
    // point of the edit is usually to see which products it would flag.
    const live = edited != null ? parseLocaleNumber(edited) ?? r.threshold : r.threshold;
    const status: StockRow['status'] = r.onHand <= 0 ? 'out' : r.onHand <= live ? 'low' : 'in_stock';
    return [
      <span key="n" className="flex items-center gap-2">
        <span className="truncate">{r.name}</span>
        {status === 'in_stock' ? null : <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />}
      </span>,
      r.category ?? '—',
      [r.pack, r.unit].filter(Boolean).join(' · ') || r.unit,
      `${fmtQty(r.onHand)} ${r.unit}`,
      <input
        key="t"
        type="text"
        inputMode="decimal"
        value={edited ?? String(r.threshold)}
        onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
        aria-label={`Low-stock threshold for ${r.name}`}
        className={`of-num h-8 w-[76px] rounded-[8px] border bg-white px-2 text-right text-[13px] text-[var(--pf-text)] outline-none focus:border-[var(--pf-accent)] ${
          edited != null ? 'border-[var(--pf-accent)]' : 'border-[var(--pf-border-strong)]'
        }`}
      />,
      r.avgPrice == null ? '—' : rand(r.avgPrice),
      r.cheapestSupplier ? (
        <span key="s" className="flex items-center gap-2">
          <span className="truncate">{r.cheapestSupplier}</span>
          {r.cheapestPrice != null ? (
            <span className="of-num shrink-0 text-[12px] text-[var(--pf-text-faint)]">{rand(r.cheapestPrice)}</span>
          ) : null}
        </span>
      ) : (
        '—'
      ),
    ];
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search products, categories, suppliers…"
          className="h-[38px] min-w-[260px] flex-1 rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-3 text-[14px] text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-text-faint)] focus:border-[var(--pf-accent)]"
        />
        <button
          type="button"
          onClick={() => {
            setLowOnly((v) => !v);
            setShown(PAGE);
          }}
          aria-pressed={lowOnly}
          className={`h-[38px] rounded-[var(--pf-radius-control)] border px-4 text-[13px] font-medium transition-colors ${
            lowOnly
              ? 'border-[var(--pf-accent-ring)] bg-[var(--pf-accent-weak)] text-[var(--pf-accent-deep)]'
              : 'border-[var(--pf-border-strong)] bg-white text-[var(--pf-text-control)] hover:border-[var(--pf-accent-ring)]'
          }`}
        >
          Needs attention
        </button>
        <span className="text-[13px] text-[var(--pf-text-muted)]">
          {filtered.length} of {rows.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {msg ? <span className="text-[13px] text-[var(--pf-text-muted)]">{msg}</span> : null}
          <button
            type="button"
            onClick={save}
            disabled={dirtyIds.length === 0 || busy}
            className="h-[38px] rounded-[var(--pf-radius-control)] bg-[var(--pf-accent-strong)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--pf-accent-deep)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : dirtyIds.length > 0 ? `Save ${dirtyIds.length} threshold${dirtyIds.length === 1 ? '' : 's'}` : 'Save thresholds'}
          </button>
        </div>
      </div>

      <DataTable columns={COLUMNS} rows={tableRows} empty={rows.length === 0 ? 'No products yet — upload supplier paperwork and the catalogue builds itself.' : 'Nothing matches that search.'} />

      {filtered.length > visible.length ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="h-[38px] rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-4 text-[13px] font-medium text-[var(--pf-text-control)] transition-colors hover:border-[var(--pf-accent-ring)]"
          >
            Show {Math.min(PAGE, filtered.length - visible.length)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
