/**
 * Read-only OrderFlow data access for Finch's tools. Every query runs through
 * the caller's RLS-scoped Supabase client (so the agent can only ever read the
 * caller's own org), and the money maths mirrors the OrderFlow Dashboard exactly
 * (docTotals / paymentsTotal / balanceDue / effectiveInvoiceStatus) so the
 * agent's numbers match what the user sees on screen.
 *
 * The invoice-loading and debtor derivations that used to be private to this
 * file now live in lib/platform/orderflow-debtors.ts and are imported below.
 * Phase C's Debtors Watch agent raises findings off the SAME definitions, and
 * the Brief and the chat contradicting each other about who is late — because
 * one of them kept its own copy — is the exact failure that move prevents.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { matchByName } from './name-match';
import {
  docTotals,
  zar,
  zar2,
  type OfCustomer,
  type OfInvoice,
  type OfInvoiceItem,
  type OfOrder,
  type OfOrderItem,
} from '@/lib/platform/orderflow';
import {
  byId,
  daysSince,
  group,
  isOpenInvoice,
  loadInvoiceRows,
  must,
  todayIso,
} from '@/lib/platform/orderflow-debtors';

// ---------------------------------------------------------------------------
// Public read helpers (one per tool)
// ---------------------------------------------------------------------------

/**
 * Headline OrderFlow numbers, mirroring the Dashboard. When `includeMoney` is
 * false (member role), the revenue/outstanding figures are withheld.
 */
export async function businessSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  includeMoney: boolean,
): Promise<Record<string, string | number>> {
  const rows = await loadInvoiceRows(supabase, orgId);
  const today = todayIso();
  const monthPrefix = today.slice(0, 7);

  let revenueMonth = 0;
  let revenueToday = 0;
  let outstanding = 0;
  let overdue = 0;
  let unpaid = 0;
  for (const r of rows) {
    const issue = (r.inv.issue_date ?? '').slice(0, 10);
    const counts = r.status !== 'draft' && r.status !== 'cancelled';
    if (counts && issue) {
      if (issue.startsWith(monthPrefix)) revenueMonth += r.total;
      if (issue === today) revenueToday += r.total;
    }
    const open = r.status !== 'paid' && r.status !== 'cancelled' && r.status !== 'credited';
    if (open && r.status !== 'draft') {
      unpaid += 1;
      outstanding += r.balance;
    }
    if (r.status === 'overdue') overdue += 1;
  }

  const [{ count: customerCount }, { count: orderCount }] = await Promise.all([
    supabase.from('of_customers').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
    supabase.from('of_orders').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
  ]);

  const base: Record<string, string | number> = {
    invoices_total: rows.length,
    unpaid_invoices: unpaid,
    overdue_invoices: overdue,
    customers: customerCount ?? 0,
    orders: orderCount ?? 0,
  };
  if (includeMoney) {
    base.revenue_this_month = zar(revenueMonth);
    base.revenue_today = zar(revenueToday);
    base.outstanding = zar(outstanding);
  } else {
    base.money_figures = 'restricted — only admins can see revenue and outstanding balances';
  }
  return base;
}

/** The most recent invoices, newest first. Money columns are withheld for
 *  members (mirrors the Dashboard finance blur). */
export async function recentInvoices(
  supabase: SupabaseClient,
  orgId: string,
  limit: number,
  includeMoney: boolean,
): Promise<Array<Record<string, string>>> {
  const rows = await loadInvoiceRows(supabase, orgId);
  const customers = byId(
    must<Pick<OfCustomer, 'id' | 'name'>[]>(
      await supabase.from('of_customers').select('id, name').eq('org_id', orgId),
      'customers',
    ),
  );

  return rows
    .sort((a, b) => (b.inv.issue_date ?? '').localeCompare(a.inv.issue_date ?? ''))
    .slice(0, limit)
    .map((r) => ({
      invoice: r.inv.invoice_number,
      customer: (r.inv.customer_id && customers.get(r.inv.customer_id)?.name) || 'Unknown',
      date: (r.inv.issue_date ?? '').slice(0, 10),
      status: r.status,
      ...(includeMoney ? { total: zar2(r.total), balance: zar2(r.balance) } : {}),
    }));
}

/** The most recent orders, newest first. */
export async function recentOrders(
  supabase: SupabaseClient,
  orgId: string,
  limit: number,
  includeMoney: boolean,
): Promise<Array<Record<string, string | boolean>>> {
  const orders = must<OfOrder[]>(
    await supabase.from('of_orders').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(limit),
    'orders',
  );
  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);
  const [itemsRes, custRes] = await Promise.all([
    supabase.from('of_order_items').select('*').in('order_id', orderIds),
    supabase.from('of_customers').select('id, name').eq('org_id', orgId),
  ]);
  const itemsByOrder = group(must<OfOrderItem[]>(itemsRes, 'order items'), (it) => it.order_id);
  const customers = byId(must<Pick<OfCustomer, 'id' | 'name'>[]>(custRes, 'customers'));

  return orders.map((o) => {
    const subtotal = (itemsByOrder.get(o.id) ?? []).reduce(
      (s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
      0,
    );
    return {
      order: o.order_number || o.invoice_number || o.id.slice(0, 8),
      customer: (o.customer_id && customers.get(o.customer_id)?.name) || 'Unknown',
      status: o.status,
      // Money is gated to the same capability as every other tool: a member must not
      // receive order values through the AI that the UI redacts for them.
      ...(includeMoney ? { subtotal_ex_vat: zar2(subtotal) } : {}),
      invoiced: !!o.invoice_id,
      date: (o.created_at ?? '').slice(0, 10),
    };
  });
}

/** Find customers by (partial, case-insensitive) name, with their outstanding balance. */
export async function findCustomers(
  supabase: SupabaseClient,
  orgId: string,
  query: string,
  includeMoney: boolean,
  limit = 5,
): Promise<Array<Record<string, string | number>>> {
  const q = query.trim();
  if (!q) return [];
  // Escape PostgREST filter meta-characters so a name can't break the OR filter.
  const safe = q.replace(/[,()%*\\]/g, ' ').trim();
  if (!safe) return [];
  const customers = must<OfCustomer[]>(
    await supabase
      .from('of_customers')
      .select('*')
      .eq('org_id', orgId)
      .or(`name.ilike.%${safe}%,trading_name.ilike.%${safe}%`)
      .limit(limit),
    'customers',
  );
  if (customers.length === 0) return [];

  // Outstanding per matched customer (only if the caller may see money).
  const outstandingByCustomer = new Map<string, number>();
  const openByCustomer = new Map<string, number>();
  if (includeMoney) {
    const rows = await loadInvoiceRows(supabase, orgId, { customerIds: customers.map((c) => c.id) });
    for (const r of rows) {
      const cid = r.inv.customer_id;
      if (!cid) continue;
      const open = r.status !== 'paid' && r.status !== 'cancelled' && r.status !== 'credited' && r.status !== 'draft';
      if (open) {
        outstandingByCustomer.set(cid, (outstandingByCustomer.get(cid) ?? 0) + r.balance);
        openByCustomer.set(cid, (openByCustomer.get(cid) ?? 0) + 1);
      }
    }
  }

  return customers.map((c) => {
    const row: Record<string, string | number> = {
      name: c.name,
      trading_name: c.trading_name ?? '',
      account_status: c.account_status ?? 'active',
      rebate_pct: Number(c.rebate_pct) > 0 ? `${Number(c.rebate_pct)}%` : 'none',
      payment_terms_days: c.payment_terms_days ?? '—',
    };
    if (includeMoney) {
      row.outstanding = zar2(outstandingByCustomer.get(c.id) ?? 0);
      row.open_invoices = openByCustomer.get(c.id) ?? 0;
    }
    return row;
  });
}

/** Resolve one customer's display name (or 'Unknown'). */
async function customerNameOf(supabase: SupabaseClient, orgId: string, customerId: string | null): Promise<string> {
  if (!customerId) return 'Unknown';
  const { data } = await supabase
    .from('of_customers')
    .select('name')
    .eq('org_id', orgId)
    .eq('id', customerId)
    .maybeSingle<{ name: string }>();
  return data?.name ?? 'Unknown';
}

/**
 * The exact line items on a specific invoice or order, looked up by its number
 * (e.g. "INV-0008"). Tries invoices first (they carry the authoritative priced
 * lines + totals), then orders. Money columns are withheld for members.
 */
export async function orderDocumentLines(
  supabase: SupabaseClient,
  orgId: string,
  reference: string,
  includeMoney: boolean,
): Promise<Record<string, unknown>> {
  const ref = reference.trim();
  if (!ref) return { found: false, message: 'Give me an invoice or order number, e.g. INV-0008.' };
  // Escape PostgREST wildcards/meta so an exact number matches literally.
  const safe = ref.replace(/[,()%*\\_]/g, ' ').trim();
  if (!safe) return { found: false, message: `No document matches "${ref}".` };

  // 1. Invoice by number.
  const invoices = must<OfInvoice[]>(
    await supabase.from('of_invoices').select('*').eq('org_id', orgId).ilike('invoice_number', safe).limit(1),
    'invoices',
  );
  if (invoices.length) {
    const inv = invoices[0];
    const items = must<OfInvoiceItem[]>(
      await supabase.from('of_invoice_items').select('*').eq('invoice_id', inv.id).order('sort_order', { ascending: true }),
      'invoice items',
    );
    const t = docTotals(items, Number(inv.vat_rate ?? 15), Number(inv.discount ?? 0), Number(inv.rebate_pct ?? 0));
    return {
      found: true,
      type: 'invoice',
      reference: inv.invoice_number,
      customer: await customerNameOf(supabase, orgId, inv.customer_id),
      status: inv.status,
      date: (inv.issue_date ?? '').slice(0, 10),
      items: items.map((it) => ({
        item: it.name,
        qty: Number(it.qty),
        ...(it.unit ? { unit: it.unit } : {}),
        ...(includeMoney ? { unit_price: zar2(it.unit_price), line_total: zar2(Number(it.qty) * Number(it.unit_price)) } : {}),
      })),
      ...(includeMoney
        ? {
            subtotal: zar2(t.subtotal),
            ...(t.discount ? { discount: zar2(t.discount) } : {}),
            ...(t.rebate ? { rebate: zar2(t.rebate) } : {}),
            vat: zar2(t.vat),
            total: zar2(t.total),
          }
        : {}),
    };
  }

  // 2. Order by order number (or its invoice number).
  const orders = must<OfOrder[]>(
    await supabase
      .from('of_orders')
      .select('*')
      .eq('org_id', orgId)
      .or(`order_number.ilike.${safe},invoice_number.ilike.${safe}`)
      .limit(1),
    'orders',
  );
  if (orders.length) {
    const ord = orders[0];
    const items = must<OfOrderItem[]>(
      await supabase.from('of_order_items').select('*').eq('order_id', ord.id),
      'order items',
    );
    const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
    return {
      found: true,
      type: 'order',
      reference: ord.order_number || ord.invoice_number || ord.id.slice(0, 8),
      customer: await customerNameOf(supabase, orgId, ord.customer_id),
      status: ord.status,
      date: (ord.created_at ?? '').slice(0, 10),
      items: items.map((it) => ({
        item: it.name,
        qty: Number(it.qty),
        ...(it.unit ? { unit: it.unit } : {}),
        ...(includeMoney ? { unit_price: zar2(it.unit_price), line_total: zar2(Number(it.qty) * Number(it.unit_price)) } : {}),
      })),
      ...(includeMoney ? { subtotal_ex_vat: zar2(subtotal) } : {}),
    };
  }

  return { found: false, message: `No invoice or order found matching "${ref}".` };
}

// ---------------------------------------------------------------------------
// Workflow (Sonnet) — prepare an order draft for the New Order builder
// ---------------------------------------------------------------------------

export interface DraftItemInput {
  name: string;
  qty: number;
  unit?: string | null;
}

/**
 * Resolve a requested customer + item list against THIS org's real customers and
 * catalogue, so Finch can hand a draft to the New Order builder. This is
 * strictly READ-ONLY name resolution — it writes nothing. Matching mirrors the
 * builder's own rules (exact, else exactly one unambiguous ≥4-char substring) so
 * what the user is told matches what the builder will do. The builder still does
 * the authoritative pricing off the customer's price list.
 */
export async function prepareOrderDraft(
  supabase: SupabaseClient,
  orgId: string,
  customerQuery: string,
  items: DraftItemInput[],
): Promise<Record<string, unknown>> {
  const cq = (customerQuery ?? '').trim();

  // Resolve the customer (exact name/trading name → else exactly one match).
  let customerName: string | null = null;
  let customerMatched = false;
  let candidates: string[] = [];
  if (cq) {
    const safe = cq.replace(/[,()%*\\]/g, ' ').trim();
    const found = safe
      ? must<Array<Pick<OfCustomer, 'id' | 'name' | 'trading_name'>>>(
          await supabase
            .from('of_customers')
            .select('id, name, trading_name')
            .eq('org_id', orgId)
            .or(`name.ilike.%${safe}%,trading_name.ilike.%${safe}%`)
            .limit(10),
          'customers',
        )
      : [];
    const lc = cq.toLowerCase();
    const exact = found.find(
      (c) => c.name.trim().toLowerCase() === lc || (c.trading_name ?? '').trim().toLowerCase() === lc,
    );
    if (exact) {
      customerName = exact.name;
      customerMatched = true;
    } else if (found.length === 1) {
      customerName = found[0].name;
      customerMatched = true;
    } else if (found.length > 1) {
      candidates = found.map((c) => c.name);
    }
  }

  // Match each requested item to the catalogue.
  const products = must<Array<{ id: string; name: string; unit: string | null }>>(
    await supabase.from('pp_stock_items').select('id, name, unit').eq('org_id', orgId).order('name'),
    'products',
  );
  const resolvedItems = (items ?? [])
    .filter((it) => (it?.name ?? '').trim())
    .map((it) => {
      const requested = it.name.trim();
      const qty = Number(it.qty) > 0 ? Number(it.qty) : 1;
      const product = matchByName(products, requested, (p) => p.name);
      return {
        requested,
        qty,
        matched: !!product,
        name: product ? product.name : requested,
        unit: product?.unit ?? it.unit ?? null,
      };
    });

  const unmatched = resolvedItems.filter((i) => !i.matched).map((i) => i.requested);
  return {
    customer: {
      query: cq,
      matched: customerMatched,
      name: customerName,
      ...(candidates.length ? { ambiguous: true, candidates } : {}),
    },
    items: resolvedItems,
    matched_items: resolvedItems.length - unmatched.length,
    unmatched,
    note: 'Draft only — nothing was saved. The user reviews and confirms it on the order page.',
  };
}

// ---------------------------------------------------------------------------
// Debtors — who owes money and for how long. `loadInvoiceRows`, `isOpenInvoice`
// and `daysSince` come from lib/platform/orderflow-debtors.ts, so the
// "open"/overdue definitions and the balance maths are exactly the ones the
// Dashboard already computes (effectiveInvoiceStatus / balanceDue) AND exactly
// the ones the Debtors Watch agent raises findings from — nothing here
// re-derives payment semantics.
// ---------------------------------------------------------------------------

/** A whole-tool restriction note — these two tools ARE money figures, so a
 *  restricted caller gets one message instead of a redacted row shape (there's
 *  no non-money version of "who owes what"). */
export interface MoneyRestricted {
  restricted: string;
}

/**
 * Per-customer outstanding balance: total owed, open invoice count, oldest
 * unpaid invoice date, and days past terms (measured off the oldest open
 * invoice's due date). Sorted worst (most overdue) first.
 */
export async function outstandingByCustomer(
  supabase: SupabaseClient,
  orgId: string,
  canSeeMoney: boolean,
  limit: number,
): Promise<Array<Record<string, string | number>> | MoneyRestricted> {
  if (!canSeeMoney) return { restricted: 'Outstanding balances are only visible to admins.' };

  const rows = await loadInvoiceRows(supabase, orgId);
  const customers = byId(
    must<Pick<OfCustomer, 'id' | 'name'>[]>(
      await supabase.from('of_customers').select('id, name').eq('org_id', orgId),
      'customers',
    ),
  );

  interface Acc {
    outstanding: number;
    count: number;
    oldestIssue: string | null;
    oldestDue: string | null;
  }
  const byCustomer = new Map<string, Acc>();
  for (const r of rows) {
    const cid = r.inv.customer_id;
    if (!cid || !isOpenInvoice(r.status)) continue;
    const acc = byCustomer.get(cid) ?? { outstanding: 0, count: 0, oldestIssue: null, oldestDue: null };
    acc.outstanding += r.balance;
    acc.count += 1;
    const issue = (r.inv.issue_date ?? '').slice(0, 10);
    if (issue && (!acc.oldestIssue || issue < acc.oldestIssue)) acc.oldestIssue = issue;
    if (r.inv.due_date && (!acc.oldestDue || r.inv.due_date < acc.oldestDue)) acc.oldestDue = r.inv.due_date;
    byCustomer.set(cid, acc);
  }

  const todayMs = new Date(`${todayIso()}T00:00:00Z`).getTime();
  return Array.from(byCustomer.entries())
    .map(([cid, acc]) => ({
      customer: customers.get(cid)?.name ?? 'Unknown',
      outstanding: acc.outstanding,
      open_invoices: acc.count,
      oldest_unpaid_date: acc.oldestIssue ?? '—',
      days_past_terms: acc.oldestDue ? daysSince(acc.oldestDue, todayMs) : 0,
    }))
    .sort((a, b) => b.days_past_terms - a.days_past_terms || b.outstanding - a.outstanding)
    .slice(0, limit)
    .map((c) => ({ ...c, outstanding: zar2(c.outstanding) }));
}

/**
 * Overdue invoices (status derived exactly like the Dashboard: sent/viewed
 * past its due date), oldest overdue first.
 */
export async function overdueInvoices(
  supabase: SupabaseClient,
  orgId: string,
  canSeeMoney: boolean,
  limit: number,
): Promise<Array<Record<string, string | number>> | MoneyRestricted> {
  if (!canSeeMoney) return { restricted: 'Overdue invoices are only visible to admins.' };

  const rows = await loadInvoiceRows(supabase, orgId);
  const customers = byId(
    must<Pick<OfCustomer, 'id' | 'name'>[]>(
      await supabase.from('of_customers').select('id, name').eq('org_id', orgId),
      'customers',
    ),
  );
  const todayMs = new Date(`${todayIso()}T00:00:00Z`).getTime();

  return rows
    .filter((r) => r.status === 'overdue')
    .map((r) => ({
      invoice: r.inv.invoice_number,
      customer: (r.inv.customer_id && customers.get(r.inv.customer_id)?.name) || 'Unknown',
      due_date: r.inv.due_date ? r.inv.due_date.slice(0, 10) : '—',
      balance: r.balance,
      daysOverdue: r.inv.due_date ? daysSince(r.inv.due_date, todayMs) : 0,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, limit)
    .map(({ daysOverdue, balance, ...rest }) => ({ ...rest, days_overdue: daysOverdue, balance: zar2(balance) }));
}
