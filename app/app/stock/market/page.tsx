import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { canSeeMoney } from '@/lib/platform/access';
import { fetchPrices, fetchStock } from '@/lib/platform/procurepulse-queries';
import { MarketSheet, type MarketRow } from '@/components/platform/stock/MarketSheet';
import {
  MarketSupplierCategories,
  type MarketCategorySupplier,
} from '@/components/platform/stock/MarketSupplierCategories';

/**
 * Stock & Suppliers → Market sheet (`.ai/plan_stock_suppliers_page.md`).
 *
 * ── WHICH PRICE SOURCE, AND WHY ─────────────────────────────────────────────
 * The plan left the choice to the implementer between two tables that both hold
 * "a supplier's price for an item". They are not equally real:
 *
 *   • `ss_supplier_pricing` (read by lib/platform/supplysync-data.ts and the
 *     maths in supplysync-pricing.ts) has NO production write path. Grep the
 *     repo: the only statements that insert into it live in
 *     `supabase/demo-all-in-one.sql` and `supabase/demo-fresh-valley/*`. On a
 *     live org it is empty, and a market sheet built on it would render a
 *     perfect, blank table.
 *
 *   • `pp_item_suppliers` is written by the document feed on every scan
 *     (lib/platform/procurepulse-feed.ts upserts the seller's latest price per
 *     item and then recomputes `pp_stock_items.cheapest_supplier`). It is one
 *     row per (item, supplier) holding the LATEST price — exactly the shape
 *     this sheet needs — and it is populated for any org that has been
 *     uploading invoices, which is what "real coverage" means here.
 *
 * So: `pp_item_suppliers` × `pp_stock_items`, via the existing
 * `fetchPrices`/`fetchStock` fetchers. The SupplySync pricing layer is not
 * dropped — it is what the Suppliers tab still shows as a supplier's tracked
 * price list, where a seeded org has one.
 *
 * ── WHY THE ROLL-UP HAPPENS HERE ────────────────────────────────────────────
 * Server component: the join, the best-price pick and the column choice are all
 * done once per request instead of on every keystroke in the client's search
 * box, and the client stays a renderer (house rule — pages server-fetch and
 * pass props; no layout data provider).
 */

/** How many suppliers get their own price column. More than this and the table
 *  stops being readable on a laptop; the rest are still reachable through the
 *  best-price column and the supplier's own profile. */
const SUPPLIER_COLUMNS = 4;

/** Match `pp_item_suppliers.supplier_name` (free text, off a document) to an
 *  `ss_suppliers.name` (typed by a person or by the feed). Same normalisation
 *  the feed uses to adopt a profile by name: trim + lowercase. */
const norm = (s: string) => s.trim().toLowerCase();

export default async function StockMarketPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? null;
  const canEdit = canSeeMoney(session?.profile?.role);

  if (!orgId) {
    return (
      <div className="space-y-6">
        <MarketSheet rows={[]} supplierColumns={[]} sourceNote={SOURCE_NOTE} />
        <MarketSupplierCategories suppliers={[]} canEdit={false} />
      </div>
    );
  }

  const db = await createServerSupabase();

  // ss_suppliers is read directly rather than through `getSupplySyncData` on
  // purpose: that fetcher fires ten queries to build contacts, risks, history,
  // credits and rebates, and this section needs three columns. The Suppliers
  // tab, which needs the whole aggregate, uses it.
  //
  // A database without the SupplySync schema answers with an error and no data;
  // `?? []` turns that into an empty section rather than a 500 (the degrade-to-
  // empty rule — see lib/platform/db-errors.ts for the codes involved).
  const [items, prices, ssRes] = await Promise.all([
    fetchStock(db, orgId),
    fetchPrices(db, orgId),
    db.from('ss_suppliers').select('id, name, category, supplier_id').eq('org_id', orgId).order('name'),
  ]);

  // --- prices, grouped by item -------------------------------------------
  const pricesByItem = new Map<string, { supplier: string; price: number }[]>();
  const linesBySupplier = new Map<string, number>();
  for (const p of prices) {
    const supplier = (p.supplier_name ?? '').trim();
    const price = Number(p.price);
    if (!supplier || !Number.isFinite(price) || price <= 0) continue;
    const arr = pricesByItem.get(p.stock_item_id) ?? [];
    arr.push({ supplier, price });
    pricesByItem.set(p.stock_item_id, arr);
    linesBySupplier.set(supplier, (linesBySupplier.get(supplier) ?? 0) + 1);
  }

  // The suppliers that earn a column: widest coverage first, ties by name so the
  // column order is stable between requests.
  const supplierColumns = [...linesBySupplier.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, SUPPLIER_COLUMNS)
    .map(([name]) => name);

  const rows: MarketRow[] = items.map((it) => {
    const offers = pricesByItem.get(it.id) ?? [];
    // Cheapest wins; `pp_stock_items.cheapest_supplier` is the feed's own cached
    // answer to the same question and is used only as the fallback for an item
    // whose price rows have not landed yet.
    const sorted = [...offers].sort((a, b) => a.price - b.price);
    const best = sorted[0] ?? null;
    const dearest = sorted[sorted.length - 1] ?? null;
    const priceMap: Record<string, number> = {};
    for (const o of offers) {
      // Two rows for the same supplier shouldn't exist (the feed upserts), but
      // if they do, the cheaper one is the honest cell.
      if (priceMap[o.supplier] == null || o.price < priceMap[o.supplier]) priceMap[o.supplier] = o.price;
    }
    return {
      id: it.id,
      item: it.name,
      category: it.category ?? '',
      unit: it.unit,
      bestPrice: best ? best.price : it.avg_unit_price,
      bestSupplier: best ? best.supplier : it.cheapest_supplier,
      supplierCount: Object.keys(priceMap).length,
      spreadPct:
        best && dearest && best.price > 0 && dearest.price > best.price
          ? Math.round(((dearest.price - best.price) / best.price) * 10) / 10
          : null,
      trendPct: it.trend_pct,
      prices: priceMap,
    };
  });

  // Items nobody has priced sink to the bottom — the sheet is about comparison,
  // so the comparable rows lead.
  rows.sort((a, b) => b.supplierCount - a.supplierCount || a.item.localeCompare(b.item));

  // --- supplier categories ------------------------------------------------
  const ssRows = (ssRes.data ?? []) as { id: string; name: string; category: string | null; supplier_id: string | null }[];
  const categorySuppliers: MarketCategorySupplier[] = ssRows.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category ?? '',
    lines: linesBySupplier.get(s.name.trim()) ?? matchLines(linesBySupplier, s.name),
    active: !!s.supplier_id,
  }));

  return (
    <div className="space-y-6">
      <MarketSheet rows={rows} supplierColumns={supplierColumns} sourceNote={SOURCE_NOTE} />
      <MarketSupplierCategories suppliers={categorySuppliers} canEdit={canEdit} />
    </div>
  );
}

const SOURCE_NOTE =
  'Latest price each supplier charged, read off the invoices and price lists you have uploaded. Green is the cheapest on file; red is 10% or more above it.';

/** Case-insensitive fallback for the exact-name lookup above — the document
 *  feed writes the supplier name as it was extracted, which is not always the
 *  casing the profile carries. */
function matchLines(lines: Map<string, number>, name: string): number {
  const target = norm(name);
  for (const [supplier, count] of lines) if (norm(supplier) === target) return count;
  return 0;
}
