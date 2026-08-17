/**
 * ONE definition of "who owes us what, and how late".
 *
 * This logic used to live inside lib/ai/finch/orderflow-data.ts, where it was
 * private to Finch's chat tools. Phase C's Debtors Watch agent needs exactly the
 * same answer, and the one thing that must never happen is the Brief telling the
 * owner "Northern Suburbs Supply is 40 days past terms on R190,900" while the
 * chat, asked the same question thirty seconds later, says something else. So the
 * derivation moved HERE and both callers import it; orderflow-data.ts keeps its
 * tool-shaped wrappers and re-exports nothing of its own.
 *
 * WHAT IS AND IS NOT DERIVED HERE. The money maths is not re-implemented: totals,
 * payments, credit notes and effective status all come from lib/platform/orderflow.ts
 * (`docTotals` / `paymentsTotal` / `balanceDue` / `effectiveInvoiceStatus`), which
 * is the same module the OrderFlow Dashboard renders from. That is deliberate —
 * a customer with a partial payment or a credit note must read identically on the
 * Dashboard, in the chat and on the Brief, and the only way to guarantee that is
 * for none of the three to own its own opinion about it.
 *
 * ORG SCOPING. `loadInvoiceRows` is called with BOTH kinds of client: Finch's
 * RLS-scoped one (a signed-in user) and the agents' service-role one (a cron,
 * where RLS is bypassed entirely and org_id is the only thing separating
 * tenants). Every query below therefore filters `.eq('org_id', orgId)`
 * explicitly, including the child reads that are already narrowed by an id list
 * — belt and braces, per supabase-service.ts's contract.
 *
 * No `server-only` import: the module is only ever reached from a route handler
 * or a cron, and the pure helpers at the bottom are unit-tested with bare
 * `node --test`, which cannot resolve the `@/` alias (the 2026-08-14 outage).
 * Hence the relative, `.ts`-suffixed imports below.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  docTotals,
  paymentsTotal,
  balanceDue,
  effectiveInvoiceStatus,
  type OfInvoice,
  type OfInvoiceItem,
  type OfPayment,
  type OfCreditNote,
  type OfCreditNoteItem,
  type InvoiceStatus,
} from './orderflow.ts';

/** One invoice with everything derived off it, exactly as the Dashboard shows. */
export interface InvoiceRow {
  inv: OfInvoice;
  total: number;
  paid: number;
  status: InvoiceStatus;
  balance: number;
}

/**
 * Unwrap a Supabase result, throwing (with the table label) on a query error so
 * the caller surfaces WHY it failed instead of silently returning an empty list.
 * A debtors agent that reported "nobody owes you anything" because a read failed
 * would be worse than one that crashed.
 */
export function must<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`Could not read ${label}: ${res.error.message}`);
  return (res.data ?? ([] as unknown as T)) as T;
}

export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [r.id, r]));
}

export function group<T, K>(rows: T[], key: (r: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k) ?? [];
    arr.push(r);
    m.set(k, arr);
  }
  return m;
}

/**
 * Load every invoice for the org (optionally only for certain customers) with
 * its derived total / paid / effective status / balance — the same figures the
 * Dashboard computes.
 */
export async function loadInvoiceRows(
  supabase: SupabaseClient,
  orgId: string,
  opts: { customerIds?: string[] } = {},
): Promise<InvoiceRow[]> {
  let invQuery = supabase.from('of_invoices').select('*').eq('org_id', orgId);
  if (opts.customerIds) {
    if (opts.customerIds.length === 0) return [];
    invQuery = invQuery.in('customer_id', opts.customerIds);
  }
  const invoices = must<OfInvoice[]>(await invQuery, 'invoices');
  if (invoices.length === 0) return [];
  const invIds = invoices.map((i) => i.id);

  const [itemsRes, paysRes, cnRes, settingsRes] = await Promise.all([
    supabase.from('of_invoice_items').select('*').eq('org_id', orgId).in('invoice_id', invIds),
    supabase.from('of_payments').select('*').eq('org_id', orgId).in('invoice_id', invIds),
    supabase.from('of_credit_notes').select('*').eq('org_id', orgId),
    // Settings is optional — a missing/duplicate row falls back to 15% VAT.
    supabase.from('of_settings').select('default_vat_rate').eq('org_id', orgId).maybeSingle(),
  ]);
  const items = must<OfInvoiceItem[]>(itemsRes, 'invoice items');
  const payments = must<OfPayment[]>(paysRes, 'payments');
  const creditNotes = must<OfCreditNote[]>(cnRes, 'credit notes').filter(
    (c) => c.invoice_id && invIds.includes(c.invoice_id),
  );
  const vatRate = Number((settingsRes.data as { default_vat_rate?: number } | null)?.default_vat_rate ?? 15);

  // Credit-note totals per invoice.
  const creditedByInvoice = new Map<string, number>();
  if (creditNotes.length) {
    const cnIds = creditNotes.map((c) => c.id);
    const cnItemsByNote = group(
      must<OfCreditNoteItem[]>(
        await supabase.from('of_credit_note_items').select('*').eq('org_id', orgId).in('credit_note_id', cnIds),
        'credit note items',
      ),
      (ci) => ci.credit_note_id,
    );
    for (const cn of creditNotes) {
      const cnTotal = docTotals(cnItemsByNote.get(cn.id) ?? [], cn.vat_rate).total;
      creditedByInvoice.set(cn.invoice_id!, (creditedByInvoice.get(cn.invoice_id!) ?? 0) + cnTotal);
    }
  }

  const itemsByInvoice = group(items, (it) => it.invoice_id);
  const paymentsByInvoice = group(payments, (p) => p.invoice_id);

  return invoices.map((inv) => {
    const total = docTotals(
      itemsByInvoice.get(inv.id) ?? [],
      Number(inv.vat_rate ?? vatRate),
      Number(inv.discount ?? 0),
      Number(inv.rebate_pct ?? 0),
    ).total;
    const paid = paymentsTotal(paymentsByInvoice.get(inv.id) ?? []);
    const credited = creditedByInvoice.get(inv.id) ?? 0;
    const status = effectiveInvoiceStatus(inv, paid, total);
    const balance = status === 'cancelled' || status === 'credited' ? 0 : balanceDue(total, paid, credited);
    return { inv, total, paid, status, balance };
  });
}

/** Today as yyyy-mm-dd. UTC day boundary, matching the Dashboard exactly, so
 *  "today" and any month prefix line up regardless of the server's timezone. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Same "open" (unpaid, not draft/cancelled/credited) definition
 *  businessSnapshot uses to accumulate `outstanding`. */
export function isOpenInvoice(status: InvoiceStatus): boolean {
  return status !== 'draft' && status !== 'paid' && status !== 'cancelled' && status !== 'credited';
}

/** Days between an ISO date (yyyy-mm-dd) and today (UTC), floored at 0. */
export function daysSince(isoDate: string, todayMs: number): number {
  return Math.max(0, Math.floor((todayMs - new Date(`${isoDate}T00:00:00Z`).getTime()) / 86_400_000));
}
