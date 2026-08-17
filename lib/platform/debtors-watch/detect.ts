/**
 * Debtors Watch — the pure detector. No I/O, no clock of its own, no Supabase:
 * a list of invoices and a date in, a list of findings out. run.ts does the
 * reading and writing; everything that decides WHETHER a customer is worth the
 * owner's morning is here, where a test can pin it.
 *
 * WHAT THIS AGENT IS FOR. OrderFlow already shows an overdue list. Nobody reads
 * it: it is a screen you have to go to, sorted by date, with no opinion. The
 * Brief's job is the opinion — "these three are the ones that matter this
 * morning" — so the thresholds below exist to keep the card list short and
 * honest, not to detect overdue-ness (that is `effectiveInvoiceStatus`'s job,
 * and it happens upstream in lib/platform/orderflow-debtors.ts).
 *
 * THE TWO WAYS IN. A customer earns a card when EITHER
 *   (a) their worst invoice is ≥ 30 days past terms AND they owe ≥ R5,000, or
 *   (b) they have ≥ 3 overdue invoices, at any age and any amount.
 * (a) is the money case: 30 days is a full extra cycle on the 30-day terms most
 * of this customer base trades on, and R5,000 is the floor below which chasing
 * costs more than the cash. (b) is the pattern case: three open, late invoices
 * is a paying habit going wrong, and it is worth saying even when each one is
 * small — that is precisely the finding a Dashboard sorted by amount hides.
 *
 * WHAT IT DOES NOT SAY. The plan's observation template offers a trailing "their
 * longest ever" clause "if derivable from history". It is NOT derivable from
 * what this agent reads: `loadInvoiceRows` gives a paid TOTAL per invoice, never
 * the date a payment landed, so "the longest they have ever taken" cannot be
 * computed without a second read of of_payments and a definition of "settled"
 * that nothing else in the product has. The clause is therefore omitted rather
 * than approximated — the Brief only says what it can prove (see
 * .ai/implementation.md, "Phase C agents").
 *
 * DRAFTS ONLY. `recommendedAction` is a sentence. Nothing here sends a
 * statement, puts an account on hold, or touches an invoice.
 */

import { rand } from '../procurepulse.ts';
import { daysSince } from '../orderflow-debtors.ts';
import {
  DEBTORS_WATCH_AGENT,
  buildDebtorsDedupeKey,
  parseDebtorsDedupeKey,
} from '../agents/dedupe-keys.ts';

/** The agent slug written to `agent_findings.agent`. */
export const AGENT_NAME = DEBTORS_WATCH_AGENT;

/** Re-exported so callers working on this agent import its key helpers from it,
 *  even though the format itself is defined once in agents/dedupe-keys.ts (the
 *  Brief's evidence resolver reads keys from there too, and must not have to
 *  pull a detector onto the render path to do it). */
export { buildDebtorsDedupeKey, parseDebtorsDedupeKey };

/** Rule (a): a full extra cycle past terms. */
export const DAYS_OVERDUE_FLOOR = 30;
/** Rule (a): below this, chasing costs more than the cash. */
export const OUTSTANDING_FLOOR = 5_000;
/** Rule (b): three late invoices is a pattern, whatever they add up to. */
export const OVERDUE_COUNT_FLOOR = 3;

/**
 * A balance this small is a rounding artefact of VAT/rebate arithmetic, not
 * money anyone is owed. Mirrors the half-cent tolerance `effectiveInvoiceStatus`
 * itself uses when deciding an invoice is paid.
 */
const BALANCE_EPSILON = 0.005;

/** One invoice, flattened to exactly what the detector needs. Built by run.ts
 *  from `loadInvoiceRows`, so `balance` and `open` are the Dashboard's own
 *  figures rather than anything re-derived here. */
export interface DebtorInvoice {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  /** yyyy-mm-dd. Null when the invoice carries no due date at all. */
  dueDate: string | null;
  /** Outstanding balance in Rand (`balanceDue`, net of payments and credits). */
  balance: number;
  /** True when the EFFECTIVE status is still unpaid — `isOpenInvoice`. */
  open: boolean;
}

/** One customer worth the owner's attention, ready to be written to
 *  `agent_findings` verbatim. */
export interface DebtorFinding {
  customerId: string;
  customerName: string;
  /** Days past terms of the WORST invoice — the number the card leads with. */
  maxDaysOverdue: number;
  overdueCount: number;
  /** Rand still outstanding across the overdue invoices only. */
  outstanding: number;
  /** The oldest overdue invoice — the dedupe key's second half, so the finding
   *  re-fires only once that specific invoice is settled or a new, older one
   *  appears. */
  oldestInvoiceId: string;
  /** `of_invoices` ids: the evidence the card links to. */
  evidenceInvoiceIds: string[];
  observation: string;
  recommendedAction: string;
  /** = outstanding. Real money, already owed — not an annualised estimate like
   *  Price Watch's, which is why the card can state it flatly. */
  randImpact: number;
  dedupeKey: string;
}

/** "2 invoices" / "1 invoice". */
function invoiceCount(n: number): string {
  return `${n} ${n === 1 ? 'invoice' : 'invoices'}`;
}

/**
 * Findings for every customer over the line, worst first (most days past terms,
 * then most money).
 *
 * `today` is passed in as yyyy-mm-dd rather than read from the clock so the
 * whole agent — the run, the tests, a hand dry-run against the demo seed — can
 * be pinned to one date and produce one deterministic answer.
 */
export function detectDebtorFindings(
  invoices: readonly DebtorInvoice[],
  today: string,
): DebtorFinding[] {
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();
  if (!Number.isFinite(todayMs)) return [];

  interface Overdue extends DebtorInvoice {
    dueDate: string;
    daysOverdue: number;
  }

  // 1. Keep only invoices that are genuinely late money: still open, carrying a
  //    real balance, with a due date that has actually passed. An invoice with
  //    no due date is not late — it has no terms to be past.
  const overdue: Overdue[] = [];
  for (const inv of invoices) {
    if (!inv.open) continue;
    if (!inv.dueDate) continue;
    if (!(inv.balance > BALANCE_EPSILON)) continue;
    const daysOverdue = daysSince(inv.dueDate, todayMs);
    if (daysOverdue <= 0) continue; // due today is not yet late
    overdue.push({ ...inv, dueDate: inv.dueDate, daysOverdue });
  }

  // 2. Group by customer.
  const byCustomer = new Map<string, Overdue[]>();
  for (const inv of overdue) {
    const arr = byCustomer.get(inv.customerId) ?? [];
    arr.push(inv);
    byCustomer.set(inv.customerId, arr);
  }

  const findings: DebtorFinding[] = [];
  for (const [customerId, rows] of byCustomer) {
    const outstanding = rows.reduce((sum, r) => sum + r.balance, 0);
    const maxDaysOverdue = Math.max(...rows.map((r) => r.daysOverdue));
    const overdueCount = rows.length;

    const moneyCase = maxDaysOverdue >= DAYS_OVERDUE_FLOOR && outstanding >= OUTSTANDING_FLOOR;
    const patternCase = overdueCount >= OVERDUE_COUNT_FLOOR;
    if (!moneyCase && !patternCase) continue;

    // Oldest = longest past terms. Ties broken by invoice id so the key is
    // stable across runs no matter what order Postgres handed the rows back in.
    const oldest = [...rows].sort(
      (a, b) => b.daysOverdue - a.daysOverdue || a.invoiceId.localeCompare(b.invoiceId),
    )[0];

    // Evidence in the same worst-first order the owner would read them.
    const evidenceInvoiceIds = [...rows]
      .sort((a, b) => b.daysOverdue - a.daysOverdue || a.invoiceId.localeCompare(b.invoiceId))
      .map((r) => r.invoiceId);

    findings.push({
      customerId,
      customerName: rows[0].customerName,
      maxDaysOverdue,
      overdueCount,
      outstanding,
      oldestInvoiceId: oldest.invoiceId,
      evidenceInvoiceIds,
      observation:
        `${rows[0].customerName} is ${maxDaysOverdue} days past terms on ` +
        `${invoiceCount(overdueCount)} — ${rand(outstanding)} outstanding.`,
      // A suggestion in words. Vyso does not send statements and does not put
      // accounts on hold; the owner does, and the card says so plainly.
      recommendedAction: 'Send a statement and hold new orders until paid',
      randImpact: outstanding,
      dedupeKey: buildDebtorsDedupeKey(customerId, oldest.invoiceId),
    });
  }

  return findings.sort(
    (a, b) =>
      b.maxDaysOverdue - a.maxDaysOverdue ||
      b.outstanding - a.outstanding ||
      a.customerId.localeCompare(b.customerId),
  );
}
