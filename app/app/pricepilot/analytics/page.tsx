import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { AnalyticsView, type DimensionData } from '@/components/platform/pricepilot/AnalyticsView';
import type { VarianceWindowKey } from '@/components/platform/pricepilot/VariancePanel';
import {
  finalizeAggs,
  attributeVariance,
  DEFAULT_TARGET_MARGIN,
  type SalesAgg,
  type PlTargets,
  type VarianceAttribution,
  type VarianceItem,
} from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; qty: number; unit_price: number };
type WindowKey = '30d' | '90d' | 'all';
type WasteRow = { event_date: string; cost: number | null };

const DAY = 86_400_000;

export default async function PricePilotAnalyticsPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: orderItems }, { data: items }, { data: customers }, { data: targetsRow }, wasteRes] =
    await Promise.all([
      db.from('of_orders').select('id, created_at, customer_id').eq('org_id', orgId).in('status', ['invoiced', 'paid']),
      db.from('of_order_items').select('order_id, stock_item_id, qty, unit_price').eq('org_id', orgId),
      db.from('pp_stock_items').select('id, name, category, avg_unit_price').eq('org_id', orgId).limit(5000),
      db.from('of_customers').select('id, name').eq('org_id', orgId),
      db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
      // Cross-module read: WasteWatch's log is the food cost that never reaches an
      // invoice line. Absent/unreadable (module not set up) degrades to "no waste data".
      db.from('ww_waste_events').select('event_date, cost').eq('org_id', orgId).limit(20000),
    ]);

  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;

  const costByItem = new Map<string, number | null>();
  const catByItem = new Map<string, string>();
  const nameByItem = new Map<string, string>();
  for (const it of (items ?? []) as { id: string; name: string; category: string | null; avg_unit_price: number | null }[]) {
    costByItem.set(it.id, it.avg_unit_price != null ? Number(it.avg_unit_price) : null);
    catByItem.set(it.id, it.category || 'Uncategorised');
    nameByItem.set(it.id, it.name);
  }
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const orderInfo = new Map(
    ((orders ?? []) as Pick<OfOrder, 'id' | 'created_at' | 'customer_id'>[]).map((o) => [
      o.id,
      { ts: new Date(o.created_at).getTime(), customerId: o.customer_id },
    ]),
  );

  const now = Date.now();
  const starts: Record<WindowKey, number> = { '30d': now - 30 * 86_400_000, '90d': now - 90 * 86_400_000, all: 0 };
  const mk = () => ({ customer: new Map<string, SalesAgg>(), category: new Map<string, SalesAgg>(), product: new Map<string, SalesAgg>() });
  const buckets: Record<WindowKey, ReturnType<typeof mk>> = { '30d': mk(), '90d': mk(), all: mk() };

  const add = (map: Map<string, SalesAgg>, key: string, label: string, rev: number, costableRev: number, cost: number, units: number) => {
    const a = map.get(key) ?? { key, label, revenue: 0, costableRev: 0, cost: 0, units: 0 };
    a.revenue += rev;
    a.costableRev += costableRev;
    a.cost += cost;
    a.units += units;
    map.set(key, a);
  };

  for (const it of (orderItems ?? []) as ItemRow[]) {
    const info = orderInfo.get(it.order_id);
    if (!info) continue; // only invoiced/paid orders
    const qty = Number(it.qty) || 0;
    const rev = qty * (Number(it.unit_price) || 0);
    const unitCost = it.stock_item_id ? costByItem.get(it.stock_item_id) ?? null : null;
    const costable = unitCost != null;
    const costableRev = costable ? rev : 0;
    const cost = costable ? qty * (unitCost as number) : 0;

    const custKey = info.customerId ?? '∅';
    const custLabel = (info.customerId && custName.get(info.customerId)) || 'No customer';
    const cat = it.stock_item_id ? catByItem.get(it.stock_item_id) ?? 'Uncategorised' : 'Uncategorised';
    const prodKey = it.stock_item_id ?? '∅';
    const prodLabel = (it.stock_item_id && nameByItem.get(it.stock_item_id)) || 'Unknown product';

    (['30d', '90d', 'all'] as WindowKey[]).forEach((w) => {
      if (info.ts < starts[w]) return;
      const b = buckets[w];
      add(b.customer, custKey, custLabel, rev, costableRev, cost, qty);
      add(b.category, cat, cat, rev, costableRev, cost, qty);
      add(b.product, prodKey, prodLabel, rev, costableRev, cost, qty);
    });
  }

  const build = (w: WindowKey): DimensionData => {
    const c = finalizeAggs([...buckets[w].customer.values()]);
    const cat = finalizeAggs([...buckets[w].category.values()]);
    const p = finalizeAggs([...buckets[w].product.values()]);
    return { customer: c.rows, category: cat.rows, product: p.rows, totals: c.totals };
  };

  const windows = { '30d': build('30d'), '90d': build('90d'), all: build('all') };

  // -------------------------------------------------------------------------
  // Variance attribution — each window compared against the equal-length window
  // immediately before it, on COSTED lines only so the two margins are like for
  // like. Waste comes from WasteWatch and is reported alongside, not folded in.
  // -------------------------------------------------------------------------
  const vRanges: Record<VarianceWindowKey, { curStart: number; baseStart: number }> = {
    '30d': { curStart: now - 30 * DAY, baseStart: now - 60 * DAY },
    '90d': { curStart: now - 90 * DAY, baseStart: now - 180 * DAY },
  };
  const V_WINDOWS: VarianceWindowKey[] = ['30d', '90d'];
  const vAcc: Record<VarianceWindowKey, { cur: Map<string, VarianceItem>; base: Map<string, VarianceItem> }> = {
    '30d': { cur: new Map(), base: new Map() },
    '90d': { cur: new Map(), base: new Map() },
  };
  const addV = (m: Map<string, VarianceItem>, key: string, label: string, units: number, revenue: number, cost: number) => {
    const a = m.get(key) ?? { key, label, units: 0, revenue: 0, cost: 0 };
    a.units += units;
    a.revenue += revenue;
    a.cost += cost;
    m.set(key, a);
  };

  for (const it of (orderItems ?? []) as ItemRow[]) {
    const info = orderInfo.get(it.order_id);
    if (!info || !it.stock_item_id) continue;
    const unitCost = costByItem.get(it.stock_item_id) ?? null;
    if (unitCost == null) continue; // uncosted lines can't carry a margin
    const qty = Number(it.qty) || 0;
    if (qty <= 0) continue;
    const rev = qty * (Number(it.unit_price) || 0);
    const cost = qty * unitCost;
    const label = nameByItem.get(it.stock_item_id) ?? 'Unknown product';
    for (const w of V_WINDOWS) {
      const r = vRanges[w];
      if (info.ts >= r.curStart) addV(vAcc[w].cur, it.stock_item_id, label, qty, rev, cost);
      else if (info.ts >= r.baseStart) addV(vAcc[w].base, it.stock_item_id, label, qty, rev, cost);
    }
  }

  const wasteRows = (wasteRes.data ?? []) as WasteRow[];
  const hasWasteData = !wasteRes.error && wasteRows.length > 0;
  const dayTs = (s: string) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d).getTime() : NaN;
  };
  const wasteBetween = (start: number, end: number) =>
    wasteRows.reduce((s, r) => {
      const ts = dayTs(r.event_date);
      return Number.isFinite(ts) && ts >= start && ts < end ? s + (Number(r.cost) || 0) : s;
    }, 0);

  const varianceWindows = {} as Record<VarianceWindowKey, VarianceAttribution>;
  for (const w of V_WINDOWS) {
    const r = vRanges[w];
    varianceWindows[w] = attributeVariance(
      [...vAcc[w].base.values()],
      [...vAcc[w].cur.values()],
      { baseCost: wasteBetween(r.baseStart, r.curStart), currentCost: wasteBetween(r.curStart, now + DAY) },
    );
  }

  return <AnalyticsView windows={windows} target={target} variance={{ windows: varianceWindows, hasWasteData }} />;
}
