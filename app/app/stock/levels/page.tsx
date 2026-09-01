import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { fetchPrices, fetchStock, fetchThresholds } from '@/lib/platform/procurepulse-queries';
import { buildStockRows, lowStockFirst } from '@/lib/platform/stock-data';
import { rand } from '@/lib/platform/procurepulse';
import { Kpi, KpiStrip } from '@/components/platform/module-ui';
import { StockLevelsTable } from '@/components/platform/stock/StockLevelsTable';

/**
 * Stock levels — what the org holds, against the threshold that governs it
 * (`.ai/plan_stock_suppliers_page.md`).
 *
 * READ + THRESHOLDS ONLY. Counts and manual adjustments are explicitly out of
 * scope for this task: the only write this screen makes is the threshold save,
 * which reuses `POST /api/procurepulse/thresholds` rather than adding a new
 * mutation surface.
 *
 * Three reads, one join. `fetchPrices` is the org's whole `pp_item_suppliers`
 * table — uncapped on purpose (see its header): it feeds the cheapest-supplier
 * column for every row, and a cap would silently mis-state which supplier is
 * cheapest for whatever fell off the end.
 */
export default async function StockLevelsPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, thresholds, prices] = await Promise.all([
    fetchStock(db, orgId),
    fetchThresholds(db, orgId),
    fetchPrices(db, orgId),
  ]);

  const rows = buildStockRows(items, thresholds, prices);
  const low = lowStockFirst(rows);
  const outCount = low.filter((r) => r.status === 'out').length;
  const stockValue = rows.reduce((s, r) => s + r.onHand * (r.avgPrice ?? 0), 0);
  const priced = rows.filter((r) => r.cheapestPrice != null).length;

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Products" value={String(rows.length)} sub="In the catalogue" />
        <Kpi
          label="Low stock"
          value={String(low.length - outCount)}
          accent={low.length - outCount > 0 ? 'var(--tone-warning-fg)' : undefined}
          sub="At or below threshold"
        />
        <Kpi
          label="Out of stock"
          value={String(outCount)}
          accent={outCount > 0 ? 'var(--tone-critical-fg)' : undefined}
          sub="Nothing on hand"
        />
        <Kpi label="Stock value" value={rand(stockValue, { compact: true })} sub="On hand × average price" />
        <Kpi label="With live prices" value={String(priced)} sub="Products quoted by a supplier" />
      </KpiStrip>

      <StockLevelsTable rows={rows} />
    </div>
  );
}
