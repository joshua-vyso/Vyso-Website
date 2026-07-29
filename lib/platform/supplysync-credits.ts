/**
 * SupplySync credits, disputes and supplier rebates.
 *
 * Credits (`ss_supplier_credits`) are the short-ships, substitutions, quality
 * rejects and price errors a business claims back. They move
 * claimed → acknowledged → credited | written_off; anything still claimed or
 * acknowledged is UNRESOLVED and is money the supplier is sitting on, which is
 * why its total is rolled up on the Overview.
 *
 * Rebates (`ss_supplier_rebates` + `ss_supplier_rebate_receipts`) are the buy-side
 * mirror of the customer rebates in supabase/rebates.sql: an agreed % or flat
 * amount per period, against which receipts are recorded. Received is always the
 * sum of receipts — never a stored counter — so expected vs received can't drift.
 *
 * Row mapping and the rollups live here so the data layer stays a fetcher and
 * the views stay renderers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export type CreditStatus = 'claimed' | 'acknowledged' | 'credited' | 'written_off';
export type CreditIssueType =
  | 'short_ship'
  | 'substitution'
  | 'quality'
  | 'damaged'
  | 'price_error'
  | 'not_delivered'
  | 'other';

export const CREDIT_ISSUE_TYPES: CreditIssueType[] = [
  'short_ship',
  'substitution',
  'quality',
  'damaged',
  'price_error',
  'not_delivered',
  'other',
];

export const CREDIT_ISSUE_LABEL: Record<CreditIssueType, string> = {
  short_ship: 'Short-shipped',
  substitution: 'Substitution',
  quality: 'Quality',
  damaged: 'Damaged on arrival',
  price_error: 'Price error',
  not_delivered: 'Not delivered',
  other: 'Other',
};

export const CREDIT_STATUS_LABEL: Record<CreditStatus, string> = {
  claimed: 'Claimed',
  acknowledged: 'Acknowledged',
  credited: 'Credited',
  written_off: 'Written off',
};

/** Claimed and acknowledged are money still owed; the other two are settled. */
export const UNRESOLVED_CREDIT_STATUSES: CreditStatus[] = ['claimed', 'acknowledged'];

export interface SupplierCredit {
  id: string;
  supplierId: string | null;
  supplierName: string;
  documentId: string | null;
  issueType: CreditIssueType;
  reference: string | null;
  item: string | null;
  description: string;
  /** ZAR claimed. */
  amount: number;
  /** ZAR actually credited back (null until settled). */
  amountCredited: number | null;
  status: CreditStatus;
  claimedOn: string;
  acknowledgedOn: string | null;
  resolvedOn: string | null;
  owner: string | null;
  note: string | null;
  /** Days since the claim was raised — how long the supplier has held the money. */
  ageDays: number;
  isUnresolved: boolean;
}

export interface CreditRollup {
  unresolvedTotal: number;
  unresolvedCount: number;
  claimedTotal: number;
  creditedTotal: number;
  writtenOffTotal: number;
  /** Credited ÷ settled, %, 0 when nothing has settled yet. */
  recoveryRate: number;
  oldestUnresolvedDays: number;
  /** Supplier with the largest unresolved balance, if any. */
  worstSupplier: { supplierId: string | null; supplierName: string; total: number } | null;
}

export const EMPTY_CREDIT_ROLLUP: CreditRollup = {
  unresolvedTotal: 0,
  unresolvedCount: 0,
  claimedTotal: 0,
  creditedTotal: 0,
  writtenOffTotal: 0,
  recoveryRate: 0,
  oldestUnresolvedDays: 0,
  worstSupplier: null,
};

function num(v: any, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** Whole days between a yyyy-mm-dd date and today (never negative). */
export function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  if (!Number.isFinite(then)) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((today - then) / 86_400_000));
}

export function mapCreditRow(r: any, supplierName: string): SupplierCredit {
  const status = (r.status as CreditStatus) ?? 'claimed';
  const claimedOn = r.claimed_on ?? '';
  return {
    id: r.id,
    supplierId: r.supplier_id ?? null,
    supplierName: supplierName || r.supplier_name || 'Supplier',
    documentId: r.document_id ?? null,
    issueType: (r.issue_type as CreditIssueType) ?? 'other',
    reference: r.reference ?? null,
    item: r.item ?? null,
    description: r.description ?? '',
    amount: num(r.amount),
    amountCredited: r.amount_credited == null ? null : num(r.amount_credited),
    status,
    claimedOn,
    acknowledgedOn: r.acknowledged_on ?? null,
    resolvedOn: r.resolved_on ?? null,
    owner: r.owner ?? null,
    note: r.note ?? null,
    ageDays: daysSince(claimedOn),
    isUnresolved: UNRESOLVED_CREDIT_STATUSES.includes(status),
  };
}

export function rollupCredits(credits: SupplierCredit[]): CreditRollup {
  if (credits.length === 0) return EMPTY_CREDIT_ROLLUP;

  let unresolvedTotal = 0;
  let unresolvedCount = 0;
  let claimedTotal = 0;
  let creditedTotal = 0;
  let writtenOffTotal = 0;
  let oldestUnresolvedDays = 0;
  const bySupplier = new Map<string, { supplierId: string | null; supplierName: string; total: number }>();

  for (const c of credits) {
    claimedTotal += c.amount;
    if (c.status === 'credited') creditedTotal += c.amountCredited ?? c.amount;
    if (c.status === 'written_off') writtenOffTotal += c.amount - (c.amountCredited ?? 0);
    if (c.isUnresolved) {
      unresolvedTotal += c.amount;
      unresolvedCount += 1;
      if (c.ageDays > oldestUnresolvedDays) oldestUnresolvedDays = c.ageDays;
      const key = c.supplierId ?? c.supplierName;
      const entry = bySupplier.get(key) ?? { supplierId: c.supplierId, supplierName: c.supplierName, total: 0 };
      entry.total += c.amount;
      bySupplier.set(key, entry);
    }
  }

  const settled = creditedTotal + writtenOffTotal;
  const worstSupplier = [...bySupplier.values()].sort((a, b) => b.total - a.total)[0] ?? null;

  return {
    unresolvedTotal: Math.round(unresolvedTotal),
    unresolvedCount,
    claimedTotal: Math.round(claimedTotal),
    creditedTotal: Math.round(creditedTotal),
    writtenOffTotal: Math.round(writtenOffTotal),
    recoveryRate: settled > 0 ? Math.round((creditedTotal / settled) * 100) : 0,
    oldestUnresolvedDays,
    worstSupplier,
  };
}

// ---------------------------------------------------------------------------
// Rebates
// ---------------------------------------------------------------------------

export type RebateBasis = 'percent' | 'flat';
export type RebatePeriod = 'monthly' | 'quarterly' | 'annual';
export type RebateStatus = 'agreed' | 'accruing' | 'claimed' | 'received' | 'missed';

export const REBATE_PERIODS: RebatePeriod[] = ['monthly', 'quarterly', 'annual'];
export const REBATE_PERIOD_MONTHS: Record<RebatePeriod, number> = { monthly: 1, quarterly: 3, annual: 12 };
export const REBATE_STATUS_LABEL: Record<RebateStatus, string> = {
  agreed: 'Agreed',
  accruing: 'Accruing',
  claimed: 'Claimed',
  received: 'Received',
  missed: 'Missed',
};

export interface RebateReceipt {
  id: string;
  rebateId: string;
  amount: number;
  receivedOn: string;
  method: string | null;
  reference: string | null;
}

export interface SupplierRebate {
  id: string;
  supplierId: string | null;
  supplierName: string;
  name: string;
  basis: RebateBasis;
  ratePct: number | null;
  flatAmount: number | null;
  thresholdSpend: number | null;
  period: RebatePeriod;
  periodStart: string | null;
  periodEnd: string | null;
  /** Agreed value for the period — explicit, or estimated from the rate. */
  expectedAmount: number;
  /** True when nobody entered a figure and the rate + spend were used instead. */
  expectedIsEstimated: boolean;
  receipts: RebateReceipt[];
  receivedTotal: number;
  /** expected − received, floored at 0. */
  outstanding: number;
  /** Received ÷ expected, %, capped at 100. */
  progressPct: number;
  status: RebateStatus;
  note: string | null;
  /** The period closed and it is still short — chase it. */
  isOverdue: boolean;
}

export interface RebateRollup {
  expectedTotal: number;
  receivedTotal: number;
  outstandingTotal: number;
  overdueCount: number;
  agreementCount: number;
}

export const EMPTY_REBATE_ROLLUP: RebateRollup = {
  expectedTotal: 0,
  receivedTotal: 0,
  outstandingTotal: 0,
  overdueCount: 0,
  agreementCount: 0,
};

function todayISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
}

/**
 * Map an agreement row + its receipts. `avgMonthlySpend` is the supplier's
 * average monthly spend, used ONLY to estimate the expected value when the
 * agreement carries no explicit amount (the views label that as an estimate).
 */
export function mapRebateRow(r: any, supplierName: string, receipts: RebateReceipt[], avgMonthlySpend: number): SupplierRebate {
  const basis = (r.basis as RebateBasis) ?? 'percent';
  const period = (r.period as RebatePeriod) ?? 'quarterly';
  const ratePct = r.rate_pct == null ? null : num(r.rate_pct);
  const flatAmount = r.flat_amount == null ? null : num(r.flat_amount);

  const explicit = r.expected_amount == null ? null : num(r.expected_amount);
  let expectedAmount = explicit ?? 0;
  let expectedIsEstimated = false;
  if (explicit == null) {
    expectedIsEstimated = true;
    expectedAmount =
      basis === 'flat'
        ? flatAmount ?? 0
        : Math.round(((ratePct ?? 0) / 100) * avgMonthlySpend * REBATE_PERIOD_MONTHS[period]);
  }

  const receivedTotal = receipts.reduce((s, x) => s + x.amount, 0);
  const outstanding = Math.max(0, Math.round(expectedAmount - receivedTotal));
  const progressPct = expectedAmount > 0 ? Math.min(100, Math.round((receivedTotal / expectedAmount) * 100)) : 0;

  const periodEnd = r.period_end ?? null;
  const closed = !!periodEnd && periodEnd < todayISO();
  const stored = (r.status as RebateStatus) ?? 'agreed';
  // Receipts and the calendar beat the stored status: fully received is
  // received, and a closed period still short is missed, whatever the row says.
  let status: RebateStatus = stored;
  if (expectedAmount > 0 && receivedTotal >= expectedAmount) status = 'received';
  else if (closed && outstanding > 0) status = 'missed';
  else if (receivedTotal > 0) status = 'claimed';
  else if (stored === 'agreed' && !closed && periodEnd) status = 'accruing';

  return {
    id: r.id,
    supplierId: r.supplier_id ?? null,
    supplierName: supplierName || r.supplier_name || 'Supplier',
    name: r.name ?? 'Rebate agreement',
    basis,
    ratePct,
    flatAmount,
    thresholdSpend: r.threshold_spend == null ? null : num(r.threshold_spend),
    period,
    periodStart: r.period_start ?? null,
    periodEnd,
    expectedAmount: Math.round(expectedAmount),
    expectedIsEstimated,
    receipts,
    receivedTotal: Math.round(receivedTotal),
    outstanding,
    progressPct,
    status,
    note: r.note ?? null,
    isOverdue: closed && outstanding > 0,
  };
}

export function mapReceiptRow(r: any): RebateReceipt {
  return {
    id: r.id,
    rebateId: r.rebate_id,
    amount: num(r.amount),
    receivedOn: r.received_on ?? '',
    method: r.method ?? null,
    reference: r.reference ?? null,
  };
}

export function rollupRebates(rebates: SupplierRebate[]): RebateRollup {
  if (rebates.length === 0) return EMPTY_REBATE_ROLLUP;
  let expectedTotal = 0;
  let receivedTotal = 0;
  let outstandingTotal = 0;
  let overdueCount = 0;
  for (const r of rebates) {
    expectedTotal += r.expectedAmount;
    receivedTotal += r.receivedTotal;
    outstandingTotal += r.outstanding;
    if (r.isOverdue) overdueCount += 1;
  }
  return {
    expectedTotal: Math.round(expectedTotal),
    receivedTotal: Math.round(receivedTotal),
    outstandingTotal: Math.round(outstandingTotal),
    overdueCount,
    agreementCount: rebates.length,
  };
}
