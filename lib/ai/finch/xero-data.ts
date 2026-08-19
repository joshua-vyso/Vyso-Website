import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadXeroSnapshot } from '@/lib/platform/xero-mirror';
import { todayIso } from '@/lib/platform/orderflow-debtors';

/**
 * Finch's window onto the Xero mirror (plan `.ai/plan_plugins_xero.md`, X1
 * "Finch").
 *
 * ONE TOOL, ON PURPOSE. The chat could have had five — receivables, payables,
 * a debtor lookup, a connection check — and every one of them would be a thing
 * the model has to decide between before it can answer "how are we doing on
 * cash?". One cheap call that returns the whole position lets it answer in a
 * turn, and the tool's description tells it what the fields mean so it never has
 * to guess.
 *
 * CHEAP BY CONSTRUCTION. One indexed select over one table, capped, summed by a
 * pure function the plugin page already calls. No second query, no join, no
 * model call inside the tool.
 *
 * MONEY, SO GATED. Every figure here is the company's cash position, so a caller
 * without `canSeeMoney` gets a NOTE rather than redacted rows — the shape every
 * other finance tool in this registry uses (`outstandingByCustomer`,
 * `marginExposure`). A note the model can read aloud is better than an empty
 * result it will try to explain.
 *
 * IT REPORTS THE MIRROR, AND SAYS SO. `synced` carries whether the local copy is
 * there at all, so the model can say "Vyso has not read Xero yet" instead of
 * "you have no invoices" — which would be a claim about the customer's
 * accounting system rather than about Vyso's copy of it. That distinction is the
 * whole reason this tool returns a status field at all.
 */

export interface XeroSnapshotResult {
  restricted?: string;
  note?: string;
  synced: boolean;
  currency: string | null;
  receivables?: { outstanding: number; overdue: number; overdue_invoice_count: number };
  payables?: {
    outstanding: number;
    due_within_7_days: number;
    due_within_7_days_count: number;
    overdue: number;
    overdue_invoice_count: number;
  };
  overdue_by_contact?: {
    contact: string;
    amount: number;
    invoice_count: number;
    oldest_days_overdue: number;
  }[];
  excluded_currencies?: { currency: string; invoice_count: number }[];
  invoices_mirrored?: number;
}

/** How many debtors the tool names. Enough for the model to answer "who owes us
 *  the most?" with a list; short enough that a chat turn stays a chat turn. */
const TOP_DEBTORS = 8;

export async function xeroSnapshot(
  supabase: SupabaseClient,
  orgId: string,
  canSeeMoney: boolean,
): Promise<XeroSnapshotResult> {
  if (!canSeeMoney) {
    return {
      restricted:
        'Xero figures are hidden for this user. Tell them their account cannot see money figures and suggest asking an owner or admin.',
      synced: false,
      currency: null,
    };
  }

  const { snapshot, tableMissing, empty } = await loadXeroSnapshot(supabase, orgId, todayIso());

  if (tableMissing || empty) {
    return {
      note: tableMissing
        ? 'Vyso has never read this business’s Xero ledger — the mirror has not been set up. Say that Xero has not been read yet; do NOT say the business has no invoices.'
        : 'Vyso’s copy of this business’s Xero ledger is empty — either Xero is not connected, or the nightly sync has not run yet. Say that Xero has not been read yet; do NOT say the business has no invoices.',
      synced: false,
      currency: null,
    };
  }

  return {
    synced: true,
    currency: snapshot.currency,
    receivables: {
      outstanding: round(snapshot.receivablesOutstanding),
      overdue: round(snapshot.receivablesOverdue),
      overdue_invoice_count: snapshot.receivablesOverdueCount,
    },
    payables: {
      outstanding: round(snapshot.payablesOutstanding),
      due_within_7_days: round(snapshot.payablesDueSoon),
      due_within_7_days_count: snapshot.payablesDueSoonCount,
      overdue: round(snapshot.payablesOverdue),
      overdue_invoice_count: snapshot.payablesOverdueCount,
    },
    overdue_by_contact: snapshot.topDebtors.slice(0, TOP_DEBTORS).map((d) => ({
      contact: d.contactName,
      amount: round(d.amount),
      invoice_count: d.invoiceCount,
      oldest_days_overdue: d.oldestDaysOverdue,
    })),
    // Only when there ARE any. An empty array in a tool result is one more thing
    // for the model to describe; its absence says the same thing and says it
    // shorter.
    ...(snapshot.excludedCurrencies.length > 0
      ? {
          excluded_currencies: snapshot.excludedCurrencies.map((c) => ({
            currency: c.currency,
            invoice_count: c.invoiceCount,
          })),
        }
      : {}),
    invoices_mirrored: snapshot.invoicesMirrored,
  };
}

/** Whole units. The model quotes these back in a sentence, and two decimals of
 *  a rand figure in a chat answer is noise the owner did not ask for. */
function round(n: number): number {
  return Math.round(n);
}
