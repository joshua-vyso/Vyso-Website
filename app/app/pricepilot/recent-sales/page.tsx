import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { RecentSalesView, type SaleRow } from '@/components/platform/pricepilot/RecentSalesView';
import { DEFAULT_TARGET_MARGIN, type PlTargets, type PriceItemLite } from '@/lib/platform/pricepilot';
import type { OfOrder } from '@/lib/platform/orderflow';

type ItemRow = { order_id: string; stock_item_id: string | null; qty: number; unit_price: number };

export default async function PricePilotRecentSalesPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? '';
  const db = await createServerSupabase();

  const [{ data: orders }, { data: items }, { data: customers }, { data: stockItems }, { data: targetsRow }] =
    await Promise.all([
      db.from('of_orders').select('*').eq('org_id', orgId).in('status', ['invoiced', 'paid']).order('created_at', { ascending: false }).limit(500),
      db.from('of_order_items').select('order_id, stock_item_id, qty, unit_price').eq('org_id', orgId),
      db.from('of_customers').select('id, name').eq('org_id', orgId),
      db.from('pp_stock_items').select('id, name, category, avg_unit_price').eq('org_id', orgId).limit(5000),
      db.from('pl_targets').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

  const targets = (targetsRow ?? null) as PlTargets | null;
  const target = targets?.target_margin_pct != null ? Number(targets.target_margin_pct) : DEFAULT_TARGET_MARGIN;

  const costByItem = new Map(
    ((stockItems ?? []) as PriceItemLite[]).map((it) => [it.id, it.avg_unit_price != null ? Number(it.avg_unit_price) : null]),
  );
  const custName = new Map(((customers ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const sales = (orders ?? []) as OfOrder[];
  const known = new Set(sales.map((o) => o.id));

  // Per-order revenue / costed revenue / cost, so each row carries a real margin.
  const agg = new Map<string, { rev: number; costableRev: number; cost: number; lines: number }>();
  for (const it of (items ?? []) as ItemRow[]) {
    if (!known.has(it.order_id)) continue;
    const qty = Number(it.qty) || 0;
    const revenue = qty * (Number(it.unit_price) || 0);
    const unitCost = it.stock_item_id ? costByItem.get(it.stock_item_id) ?? null : null;
    const a = agg.get(it.order_id) ?? { rev: 0, costableRev: 0, cost: 0, lines: 0 };
    a.rev += revenue;
    a.lines += 1;
    if (unitCost != null) {
      a.costableRev += revenue;
      a.cost += qty * unitCost;
    }
    agg.set(it.order_id, a);
  }

  const rows: SaleRow[] = sales.map((o) => {
    const a = agg.get(o.id) ?? { rev: 0, costableRev: 0, cost: 0, lines: 0 };
    const profit = a.costableRev - a.cost;
    return {
      id: o.id,
      invoice: o.invoice_number ?? 'Invoice',
      customerId: o.customer_id,
      customer: (o.customer_id && custName.get(o.customer_id)) || 'No customer',
      status: o.status,
      date: o.created_at,
      revenue: a.rev,
      costableRev: a.costableRev,
      cost: a.cost,
      profit,
      margin: a.costableRev > 0 ? (profit / a.costableRev) * 100 : null,
      uncosted: a.rev - a.costableRev > 0.005,
      lines: a.lines,
    };
  });

  // Only offer customers who actually appear in the list — a filter that can
  // return nothing is noise.
  const used = new Set(rows.map((r) => r.customerId).filter((id): id is string => !!id));
  const customerOptions = ((customers ?? []) as { id: string; name: string }[])
    .filter((c) => used.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Render time, resolved once on the server so the client's relative windows
  // ("last 30 days") stay stable while the user types in the filters.
  const now = new Date().getTime();

  return <RecentSalesView sales={rows} customers={customerOptions} target={target} now={now} />;
}
