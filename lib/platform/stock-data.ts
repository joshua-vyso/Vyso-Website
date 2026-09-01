/**
 * Stock & Suppliers data access — the NARROW server fetchers the merged module
 * needs and the old module libs don't already provide
 * (`.ai/plan_stock_suppliers_page.md`). Follows the `<module>-data.ts`
 * convention: pages server-fetch and pass props, org scope comes from RLS, and
 * a missing table degrades to empty rather than throwing.
 *
 * WHY A NEW FILE AND NOT MORE OF `supplysync-data.ts`. The only supplier fetcher
 * that exists there is `getSupplySyncData`, which runs TEN queries and builds
 * every scorecard, risk, contact and history event for every supplier — the
 * right shape for the old five-tab module, wildly too much for a dashboard tile
 * that prints one number. These are the counts-and-latest-N reads the new
 * screens actually make.
 *
 * `procurepulse-queries.ts` keeps owning the pp_* catalogue reads (fetchStock,
 * fetchRecipes, fetchThresholds …) — those fit as-is and are reused unchanged.
 * Only the batch tables get fetchers here, because ProcurePulse read its batches
 * through `GET /api/procurepulse/batch` from the client and a server page can't.
 */

import { createServerSupabase } from './supabase-server';
import { stockStatus } from './procurepulse';
import type {
  Batch,
  BatchIngredient,
  Document,
  DocumentType,
  ItemSupplierPrice,
  StockItem,
  StockStatus,
  StockThreshold,
} from './types';

type DB = Awaited<ReturnType<typeof createServerSupabase>>;

/* eslint-disable @typescript-eslint/no-explicit-any */
function rows<T>(res: { data: unknown }): T[] {
  return ((res.data as any[]) ?? []) as T[];
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// ---------------------------------------------------------------------------
// Stock rows — the one shape the Stock tab and the dashboard's low-stock card
// both render. Pure: no DB access, so a server page can build it and hand a
// plain, serialisable array to the client table.
// ---------------------------------------------------------------------------

/** A catalogue line with its threshold, price and status already resolved. */
export interface StockRow {
  id: string;
  name: string;
  category: string | null;
  pack: string | null;
  unit: string;
  onHand: number;
  /** The threshold that WINS (see `effectiveLowThreshold`). */
  threshold: number;
  /** True when `threshold` came from pp_stock_thresholds rather than the item. */
  thresholdOverridden: boolean;
  status: StockStatus;
  avgPrice: number | null;
  cheapestSupplier: string | null;
  cheapestPrice: number | null;
  /**
   * The rest of this product's pp_stock_thresholds row, carried so the inline
   * threshold editor can POST it back UNCHANGED. `/api/procurepulse/thresholds`
   * upserts whole rows and nulls whatever the body omits, so a save that sent
   * only low_threshold would silently wipe the par level, lead time and
   * freshness settings somebody configured on the old Products screen.
   */
  thresholdRow: {
    par_level: number | null;
    lead_time_days: number | null;
    freshness_value: number | null;
    freshness_unit: string | null;
    alerts_enabled: boolean;
    notes: string | null;
  };
}

/**
 * WHICH THRESHOLD WINS: `pp_stock_thresholds.low_threshold` over the catalogue
 * row's own `low_threshold`. Same precedence as `lib/platform/stock-cover/run.ts`
 * and the Finch data layer — the thresholds table is the deliberate per-product
 * override, the catalogue column is the default the feed writes.
 */
export function effectiveLowThreshold(
  item: Pick<StockItem, 'low_threshold'>,
  threshold: StockThreshold | undefined,
): { value: number; overridden: boolean } {
  if (threshold?.low_threshold != null) return { value: Number(threshold.low_threshold), overridden: true };
  return { value: Number(item.low_threshold) || 0, overridden: false };
}

/** Join catalogue + thresholds + supplier prices into render-ready rows. */
export function buildStockRows(
  items: StockItem[],
  thresholds: StockThreshold[],
  prices: ItemSupplierPrice[],
): StockRow[] {
  const thresholdBy = new Map(thresholds.map((t) => [t.stock_item_id, t]));

  // Cheapest live quote per product. `pp_item_suppliers` is the current price
  // per item×supplier, so a plain min is the cheapest source today.
  const cheapestBy = new Map<string, ItemSupplierPrice>();
  for (const p of prices) {
    const best = cheapestBy.get(p.stock_item_id);
    if (!best || p.price < best.price) cheapestBy.set(p.stock_item_id, p);
  }

  return items.map((it) => {
    const t = thresholdBy.get(it.id);
    const { value, overridden } = effectiveLowThreshold(it, t);
    const cheapest = cheapestBy.get(it.id);
    return {
      id: it.id,
      name: it.name,
      category: it.category,
      pack: it.pack,
      unit: it.unit,
      onHand: Number(it.on_hand) || 0,
      threshold: value,
      thresholdOverridden: overridden,
      status: stockStatus({ on_hand: Number(it.on_hand) || 0, low_threshold: value }),
      avgPrice: it.avg_unit_price,
      // The catalogue's own cheapest_supplier is the fallback: an org whose
      // price rows haven't been fed yet still gets the name the feed stamped.
      cheapestSupplier: cheapest?.supplier_name ?? it.cheapest_supplier ?? null,
      cheapestPrice: cheapest?.price ?? null,
      thresholdRow: {
        par_level: t?.par_level ?? null,
        lead_time_days: t?.lead_time_days ?? null,
        freshness_value: t?.freshness_value ?? null,
        freshness_unit: t?.freshness_unit ?? 'days',
        alerts_enabled: t?.alerts_enabled ?? true,
        notes: t?.notes ?? null,
      },
    };
  });
}

/** Worst-off rows first: out of stock, then furthest below threshold. */
export function lowStockFirst(rows: StockRow[]): StockRow[] {
  const rank = (s: StockStatus) => (s === 'out' ? 0 : s === 'low' ? 1 : 2);
  return rows
    .filter((r) => r.status !== 'in_stock')
    .sort((a, b) => {
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      return a.onHand - a.threshold - (b.onHand - b.threshold);
    });
}

// ---------------------------------------------------------------------------
// Suppliers — counts only (the dashboard's tiles, not the Suppliers tab)
// ---------------------------------------------------------------------------

export interface StockSupplierSummary {
  /** Supplier profiles that aren't archived/inactive. */
  active: number;
  /** Σ ss_suppliers.spend_mtd — null when the column carries nothing anywhere,
   *  so the tile can print "—" instead of a confident R 0. */
  spendMtd: number | null;
}

/**
 * Active suppliers + month-to-date spend.
 *
 * Reads `ss_suppliers` (the profile table SupplySync writes) and falls back to
 * the CORE `suppliers` table when the SupplySync schema isn't in this database
 * — a young org has supplier rows created by document ingest long before anyone
 * opens a supplier profile, and a dashboard that says "0 suppliers" to an org
 * with forty of them is worse than one that says 40 with no spend figure.
 */
export async function fetchSupplierSummary(db: DB, orgId: string): Promise<StockSupplierSummary> {
  const ss = await db.from('ss_suppliers').select('status, spend_mtd').eq('org_id', orgId);
  const profiles = rows<{ status: string | null; spend_mtd: number | null }>(ss);

  if (profiles.length > 0) {
    // 'preferred' | 'active' | 'review' are all live relationships; anything
    // else (an org that has started writing 'inactive'/'archived') is not.
    const live = profiles.filter((p) => {
      const s = (p.status ?? 'active').toLowerCase();
      return s !== 'inactive' && s !== 'archived';
    });
    const anySpend = profiles.some((p) => p.spend_mtd != null);
    return {
      active: live.length,
      spendMtd: anySpend ? live.reduce((s, p) => s + num(p.spend_mtd), 0) : null,
    };
  }

  const core = await db.from('suppliers').select('id').eq('org_id', orgId);
  return { active: rows<{ id: string }>(core).length, spendMtd: null };
}

// ---------------------------------------------------------------------------
// Supplier credits — open claims (dashboard tile)
// ---------------------------------------------------------------------------

export interface OpenCreditsSummary {
  count: number;
  amount: number;
}

/**
 * Claims raised against suppliers that haven't been settled. 'credited' and
 * 'written_off' are the two terminal states in `supabase/ss-supplier-credits.sql`,
 * so open = everything else — matching on the terminal pair rather than the open
 * pair means a status this codebase hasn't seen yet still counts as outstanding,
 * which is the safe direction for money somebody is owed.
 */
export async function fetchOpenSupplierCredits(db: DB, orgId: string): Promise<OpenCreditsSummary> {
  const res = await db
    .from('ss_supplier_credits')
    .select('amount, status')
    .eq('org_id', orgId)
    .not('status', 'in', '(credited,written_off)');
  const open = rows<{ amount: number | null; status: string | null }>(res);
  return { count: open.length, amount: open.reduce((s, c) => s + num(c.amount), 0) };
}

// ---------------------------------------------------------------------------
// Price changes (dashboard card)
// ---------------------------------------------------------------------------

export interface StockPriceChange {
  id: string;
  item: string;
  supplierName: string;
  unit: string;
  currentPrice: number;
  previousPrice: number | null;
  changePct: number | null;
  lastUpdated: string | null;
}

/**
 * The latest supplier price moves.
 *
 * SOURCE CHOICE: `ss_supplier_pricing`, not `pp_item_suppliers`. The plan left
 * this to whichever source served a delta most directly, and only one of them
 * can: `pp_item_suppliers` is UPSERTED IN PLACE by the Doc-U feed
 * (procurepulse-feed.ts updates the existing row's `price`), so it holds one
 * current price per item×supplier and no history at all — a "change" cannot be
 * derived from it without a movements-style ledger that doesn't exist.
 * `ss_supplier_pricing` stores `previous_price` alongside `current_price`, which
 * is exactly the delta this card prints.
 */
export async function fetchRecentPriceChanges(
  db: DB,
  orgId: string,
  limit = 6,
): Promise<StockPriceChange[]> {
  const [pricing, suppliers] = await Promise.all([
    db
      .from('ss_supplier_pricing')
      .select('id, supplier_id, item, unit, current_price, previous_price, last_updated')
      .eq('org_id', orgId)
      .not('previous_price', 'is', null)
      .order('last_updated', { ascending: false, nullsFirst: false })
      .limit(limit),
    db.from('ss_suppliers').select('id, name').eq('org_id', orgId),
  ]);

  const nameById = new Map(
    rows<{ id: string; name: string | null }>(suppliers).map((s) => [s.id, s.name ?? '']),
  );

  return rows<{
    id: string;
    supplier_id: string | null;
    item: string | null;
    unit: string | null;
    current_price: number | null;
    previous_price: number | null;
    last_updated: string | null;
  }>(pricing).map((p) => {
    const current = num(p.current_price);
    const previous = p.previous_price == null ? null : num(p.previous_price);
    return {
      id: p.id,
      item: p.item ?? '—',
      supplierName: (p.supplier_id ? nameById.get(p.supplier_id) : '') || 'Supplier',
      unit: p.unit ?? 'kg',
      currentPrice: current,
      previousPrice: previous,
      changePct: previous && previous !== 0 ? ((current - previous) / previous) * 100 : null,
      lastUpdated: p.last_updated,
    };
  });
}

// ---------------------------------------------------------------------------
// Stock documents (dashboard card → /app/stock/uploads/[id])
// ---------------------------------------------------------------------------

/** The document types the dashboard's card lists — the four kinds of paperwork
 *  that actually move stock or prices. Supplier credit notes are deliberately
 *  NOT here: they are money-back claims, and the plan gives them their own
 *  section on the Suppliers tab rather than mixing them into this feed. */
export const STOCK_DOCUMENT_TYPES: readonly DocumentType[] = [
  'invoice',
  'delivery_note',
  'price_list',
  'statement',
];

export type StockDocument = Pick<
  Document,
  'id' | 'filename' | 'document_type' | 'status' | 'confidence' | 'created_at'
>;

/** Newest stock paperwork, for the dashboard's "Recent documents" card. */
export async function fetchRecentStockDocuments(
  db: DB,
  orgId: string,
  limit = 6,
): Promise<StockDocument[]> {
  const res = await db
    .from('documents')
    .select('id, filename, document_type, status, confidence, created_at')
    .eq('org_id', orgId)
    .in('document_type', STOCK_DOCUMENT_TYPES as unknown as string[])
    // Rejected/archived rows are noise on a landing card — the same exclusion
    // getSupplySyncData applies to its linked-document read.
    .not('status', 'in', '(rejected,archived,error)')
    .order('created_at', { ascending: false })
    .limit(limit);
  return rows<StockDocument>(res);
}

/**
 * The Uploads tab's table: the org's newest paperwork of EVERY type, not just
 * the four that move stock.
 *
 * WHY NOT `fetchRecentStockDocuments` WITH A BIGGER LIMIT. That one is the
 * dashboard's card and filters to `STOCK_DOCUMENT_TYPES` on purpose. This table
 * is the receipt for "did my upload land?", and a receipt that hides the expense
 * receipt somebody just dropped — because it isn't a stock document — reads as a
 * lost file. Types are shown as a column instead, and an unread `pending` row
 * has no type at all yet.
 *
 * `extracted_data` IS DELIBERATELY NOT SELECTED, so the type column prints the
 * built-in label rather than a user's `custom_type`. Fifty documents' worth of
 * line items is a large RSC payload to ship for one string per row, and the
 * detail page — one click away — shows the custom type correctly.
 */
export async function fetchUploadedDocuments(
  db: DB,
  orgId: string,
  limit = 50,
): Promise<StockDocument[]> {
  const res = await db
    .from('documents')
    .select('id, filename, document_type, status, confidence, created_at')
    .eq('org_id', orgId)
    // A replaced document is not a second document to act on — the same
    // exclusion every live Doc-U list makes (see app/app/docu/recent/page.tsx).
    .is('superseded_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  return rows<StockDocument>(res);
}

// ---------------------------------------------------------------------------
// Manufacturing — batches
// ---------------------------------------------------------------------------

/** Logged production runs, newest first. Capped: the view renders the rows and
 *  never publishes a total derived from the array. */
export async function fetchBatches(db: DB, orgId: string, limit = 50): Promise<Batch[]> {
  const res = await db
    .from('pp_batches')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return rows<Batch>(res);
}

/** Ingredient lines for the batches on screen. Scoped by the batch ids we just
 *  read rather than the whole org — the org-wide read grows without bound and
 *  nothing on the page uses a line whose batch isn't listed. */
export async function fetchBatchIngredients(
  db: DB,
  orgId: string,
  batchIds: string[],
): Promise<BatchIngredient[]> {
  if (batchIds.length === 0) return [];
  const res = await db
    .from('pp_batch_ingredients')
    .select('*')
    .eq('org_id', orgId)
    .in('batch_id', batchIds);
  return rows<BatchIngredient>(res);
}
