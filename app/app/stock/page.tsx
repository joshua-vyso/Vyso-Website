import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { fetchPrices, fetchStock, fetchThresholds } from '@/lib/platform/procurepulse-queries';
import {
  buildStockRows,
  fetchOpenSupplierCredits,
  fetchRecentPriceChanges,
  fetchRecentStockDocuments,
  fetchSupplierSummary,
  lowStockFirst,
} from '@/lib/platform/stock-data';
import { rand } from '@/lib/platform/procurepulse';
import { Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import {
  LowStockCard,
  PriceChangesCard,
  RecentDocumentsCard,
} from '@/components/platform/stock/DashboardCards';

/**
 * Stock & Suppliers — the landing view (`.ai/plan_stock_suppliers_page.md`).
 *
 * Replaces the Phase 0 PhaseStub. That stub's job was to name what was coming
 * and point at the two old modules that half-did it; this page IS the thing, so
 * every link here goes to a `/app/stock/*` tab and none to `/app/procurepulse`
 * or `/app/suppliers` (plan acceptance criterion 3).
 *
 * ONE FETCH FAN-OUT, NO LAYOUT PROVIDER. Everything is read here and passed as
 * props, per the house rule in `lib/platform/orderflow-data.ts`.
 *
 * MISSING TABLES DEGRADE TO EMPTY. Every fetcher below returns `[]`/zero when
 * its table isn't in this database (the `?? []` pattern the pp_* and ss_*
 * fetchers already use), so an org that has ProcurePulse but not the SupplySync
 * migrations gets a dashboard with real stock numbers and quiet supplier tiles
 * rather than a 500.
 */
export default async function StockDashboard() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const [items, thresholds, prices, suppliers, credits, priceChanges, docs] = await Promise.all([
    fetchStock(db, orgId),
    fetchThresholds(db, orgId),
    fetchPrices(db, orgId),
    fetchSupplierSummary(db, orgId),
    fetchOpenSupplierCredits(db, orgId),
    fetchRecentPriceChanges(db, orgId, 6),
    fetchRecentStockDocuments(db, orgId, 6),
  ]);

  const rows = buildStockRows(items, thresholds, prices);
  const low = lowStockFirst(rows);
  const outCount = low.filter((r) => r.status === 'out').length;

  // Stock value is the one number here the org can check against its own books,
  // so it uses the catalogue's avg_unit_price straight — no estimate, no
  // "illustrative" multiplier (the old dashboard's spendWeek tile was one, and
  // a made-up figure next to real ones teaches people to distrust both).
  const stockValue = rows.reduce((s, r) => s + r.onHand * (r.avgPrice ?? 0), 0);

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Products" value={String(items.length)} sub={`${rand(stockValue, { compact: true })} on hand`} />
        <Kpi
          label="Low stock"
          value={String(low.length)}
          accent={low.length > 0 ? 'var(--tone-warning-fg)' : undefined}
          sub={outCount > 0 ? `${outCount} out of stock` : 'None out of stock'}
        />
        <Kpi label="Suppliers" value={String(suppliers.active)} sub="Active relationships" />
        <Kpi
          label="Open credits"
          value={String(credits.count)}
          accent={credits.count > 0 ? 'var(--tone-warning-fg)' : undefined}
          sub={credits.count > 0 ? `${rand(credits.amount)} claimed` : 'Nothing outstanding'}
        />
        <Kpi
          label="Spend MTD"
          value={suppliers.spendMtd == null ? '—' : rand(suppliers.spendMtd, { compact: true })}
          sub={suppliers.spendMtd == null ? 'Not tracked yet' : 'Across all suppliers'}
        />
      </KpiStrip>

      {items.length === 0 ? (
        // The honest empty state: this module is FED by documents, so the one
        // useful action for an org with no catalogue is to upload some.
        <SectionCard title="Nothing in stock yet">
          <p className="max-w-xl text-[14px] text-[var(--pf-text-muted)]">
            Your stock builds itself from the paperwork you upload — supplier invoices, delivery
            notes, price lists and market statements. Drop the first ones in and the products,
            prices and suppliers below fill in on their own.
          </p>
          <Link
            href="/app/stock/uploads"
            className="mt-4 inline-flex h-[42px] items-center rounded-[var(--pf-radius-control)] bg-[var(--pf-accent-strong)] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[var(--pf-accent-deep)]"
          >
            Upload documents
          </Link>
        </SectionCard>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LowStockCard rows={low.slice(0, 6)} />
        <PriceChangesCard changes={priceChanges} />
        <RecentDocumentsCard docs={docs} />
      </div>
    </div>
  );
}
