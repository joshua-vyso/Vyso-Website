import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { SalesHubView, type HubEntity, type HubOrder } from '@/components/platform/pricepilot/SalesHubView';
import { DEFAULT_TARGET_MARGIN, type PlTargets, type PriceItemLite } from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; qty: number; unit_price: number };

/** Running totals for one dimension key, finalized into a HubEntity below. */
interface Acc {
  key: string;
  label: string;
  units: number;
  orders: Set<string>;
  revenue: number;
  costableRev: number;
  cost: number;
}

const NO_CUSTOMER = '∅';
/** Rows kept per drill panel — enough to answer the question, small enough to ship. */
const DRILL_LIMIT = 8;

function acc(map: Map<string, Acc>, key: string, label: string): Acc {
  const a = map.get(key) ?? { key, label, units: 0, orders: new Set<string>(), revenue: 0, costableRev: 0, cost: 0 };
  map.set(key, a);
  return a;
}

function finalize(list: Iterable<Acc>): HubEntity[] {
  return [...list]
    .map((a) => {
      const profit = a.costableRev - a.cost;
      return {
        key: a.key,
        label: a.label,
        units: a.units,
        orders: a.orders.size,
        revenue: a.revenue,
        costableRev: a.costableRev,
        cost: a.cost,
        profit,
        margin: a.costableRev > 0 ? (profit / a.costableRev) * 100 : null,
      };
    })
    .sort((x, y) => y.revenue - x.revenue);
}

export default async function PricePilotSalesHubPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }, { data: stockItems }, { data: targetsRow }] =
    await Promise.all([
      db.from('of_orders').select('*').eq('org_id', orgId).in('status', ['invoiced', 'paid']).order('created_at', { ascending: false }),
      db.from('of_order_items').select('order_id, stock_item_id, qty, unit_price').eq('org_id', orgId),
      db.from('of_customers').select('id, name').eq('org_id', orgId),
      db.from('pp_stock_items').select('id, name, category, avg_unit_price').eq('org_id', orgId).limit(5000),
      db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;

  const stock = (stockItems ?? []) as PriceItemLite[];
  const costByItem = new Map(stock.map((it) => [it.id, it.avg_unit_price != null ? Number(it.avg_unit_price) : null]));
  const nameByItem = new Map(stock.map((it) => [it.id, it.name]));
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const sales = (orders ?? []) as OfOrder[];
  const orderCustomer = new Map(sales.map((o) => [o.id, o.customer_id]));

  const byOrder = new Map<string, { rev: number; costableRev: number; cost: number }>();
  const byCustomer = new Map<string, Acc>();
  const byProduct = new Map<string, Acc>();
  // Cross tabs, keyed "<customer>|<product>", feed both drill panels from one pass.
  const cross = new Map<string, Acc & { customerKey: string; productKey: string }>();

  for (const it of (items ?? []) as ItemRow[]) {
    if (!orderCustomer.has(it.order_id)) continue; // only invoiced/paid orders
    const qty = Number(it.qty) || 0;
    const revenue = qty * (Number(it.unit_price) || 0);
    const unitCost = it.stock_item_id ? costByItem.get(it.stock_item_id) ?? null : null;
    const costableRev = unitCost != null ? revenue : 0;
    const cost = unitCost != null ? qty * unitCost : 0;

    const o = byOrder.get(it.order_id) ?? { rev: 0, costableRev: 0, cost: 0 };
    o.rev += revenue;
    o.costableRev += costableRev;
    o.cost += cost;
    byOrder.set(it.order_id, o);

    const cid = orderCustomer.get(it.order_id) ?? null;
    const cKey = cid ?? NO_CUSTOMER;
    const cLabel = (cid && custName.get(cid)) || 'No customer';
    const pKey = it.stock_item_id ?? NO_CUSTOMER;
    const pLabel = (it.stock_item_id && nameByItem.get(it.stock_item_id)) || 'Unknown product';

    for (const [map, key, label] of [
      [byCustomer, cKey, cLabel],
      [byProduct, pKey, pLabel],
    ] as [Map<string, Acc>, string, string][]) {
      const a = acc(map, key, label);
      a.units += qty;
      a.orders.add(it.order_id);
      a.revenue += revenue;
      a.costableRev += costableRev;
      a.cost += cost;
    }

    const xKey = `${cKey}|${pKey}`;
    const x = cross.get(xKey) ?? {
      key: xKey,
      label: pLabel,
      units: 0,
      orders: new Set<string>(),
      revenue: 0,
      costableRev: 0,
      cost: 0,
      customerKey: cKey,
      productKey: pKey,
    };
    x.units += qty;
    x.orders.add(it.order_id);
    x.revenue += revenue;
    x.costableRev += costableRev;
    x.cost += cost;
    cross.set(xKey, x);
  }

  const hubOrders: HubOrder[] = sales
    .filter((o) => byOrder.has(o.id))
    .map((o) => {
      const a = byOrder.get(o.id)!;
      const profit = a.costableRev - a.cost;
      return {
        id: o.id,
        invoice: o.invoice_number ?? 'Invoice',
        customerId: o.customer_id,
        customer: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
        date: o.created_at,
        revenue: a.rev,
        costableRev: a.costableRev,
        cost: a.cost,
        profit,
        margin: a.costableRev > 0 ? (profit / a.costableRev) * 100 : null,
      };
    });

  // Split the cross tab both ways, keeping only the top rows per drill panel.
  const perCustomer = new Map<string, (Acc & { customerKey: string; productKey: string })[]>();
  const perProduct = new Map<string, (Acc & { customerKey: string; productKey: string })[]>();
  for (const x of cross.values()) {
    const c = perCustomer.get(x.customerKey) ?? [];
    c.push(x);
    perCustomer.set(x.customerKey, c);
    const p = perProduct.get(x.productKey) ?? [];
    p.push(x);
    perProduct.set(x.productKey, p);
  }

  const productsByCustomer: Record<string, HubEntity[]> = {};
  for (const [k, rows] of perCustomer) productsByCustomer[k] = finalize(rows).slice(0, DRILL_LIMIT);

  const customersByProduct: Record<string, HubEntity[]> = {};
  for (const [k, rows] of perProduct) {
    customersByProduct[k] = finalize(
      rows.map((r) => ({ ...r, label: (r.customerKey !== NO_CUSTOMER && custName.get(r.customerKey)) || 'No customer' })),
    ).slice(0, DRILL_LIMIT);
  }

  return (
    <SalesHubView
      orders={hubOrders}
      customers={finalize(byCustomer.values())}
      products={finalize(byProduct.values())}
      productsByCustomer={productsByCustomer}
      customersByProduct={customersByProduct}
      target={target}
    />
  );
}
