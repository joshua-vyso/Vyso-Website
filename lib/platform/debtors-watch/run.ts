/**
 * Debtors Watch — the run loop. Reads one org's invoice book, asks detect.ts
 * who is worth a card this morning, and writes what comes back to
 * `agent_findings`. It observes and recommends; it never sends a statement,
 * never puts an account on hold, never touches an invoice.
 *
 * FOUR RULES, INHERITED FROM PRICE WATCH'S run.ts.
 *
 * 1. THE ORG ID IS THE ONLY FENCE. The caller is the cron's service-role client,
 *    which bypasses RLS entirely, so every query here filters `.eq('org_id',
 *    orgId)` by hand — including the ones inside `loadInvoiceRows`.
 *
 * 2. RE-RUNS MUST BE FREE OF SIDE EFFECTS. Idempotency is the dedupe key:
 *    `debtors_watch:<customer_id>:<oldest_overdue_invoice_id>` against
 *    unique(org_id, dedupe_key). While the same invoice remains a customer's
 *    oldest unpaid one the nightly run writes the same key, the insert bounces,
 *    and the Brief keeps ONE card instead of growing a new one each night.
 *
 * 3. AN ORDINARY DATA PROBLEM IS A WARNING, NOT AN EXCEPTION. A missing table, a
 *    customer whose name cannot be resolved, a single failed insert — all are
 *    collected into the summary the route returns. Only something genuinely
 *    unexpected throws.
 *
 * 4. NO AUTO-CLOSE IN v1. Nothing here resolves or retracts a finding. A card
 *    stays until the owner dismisses it, and once dismissed the dedupe key stops
 *    it coming back for the same invoice — which is the behaviour a human who
 *    has just decided "I know about Northern Suburbs, leave me alone" expects.
 *    The alternative (auto-resolving when the invoice is paid) needs a payment
 *    watcher this phase does not have; see .ai/implementation.md.
 *
 * NO MODEL CALLS. The observation is a template over numbers the business
 * already has. There is nothing here a language model would make truer, and a
 * nightly agent that costs nothing to run is one nobody has to justify.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation, isUniqueViolation } from '../db-errors.ts';
import { loadInvoiceRows, isOpenInvoice, todayIso, must } from '../orderflow-debtors.ts';
import { AGENT_NAME, detectDebtorFindings, type DebtorInvoice } from './detect.ts';

export { AGENT_NAME };

export interface RunDebtorsWatchOptions {
  /** Compute and report everything; write NOTHING. */
  dryRun?: boolean;
  /** Pin "today" (yyyy-mm-dd). Defaults to the UTC day, matching the
   *  OrderFlow Dashboard's own day boundary. */
  today?: string;
  /** Progress logging. Silent by default: the cron's output is its JSON body. */
  log?: (message: string) => void;
}

export interface DebtorsSampleFinding {
  dedupeKey: string;
  observation: string;
  randImpact: number;
  evidenceCount: number;
}

export interface DebtorsWatchSummary {
  orgId: string;
  dryRun: boolean;
  /** True when `agent_findings` isn't in this database yet. */
  tablesMissing: boolean;
  today: string;
  invoicesSeen: number;
  customersOverdue: number;
  findingsDetected: number;
  findingsWritten: number;
  findingsSkippedDuplicate: number;
  findingErrors: number;
  sampleFindings: DebtorsSampleFinding[];
  warnings: string[];
}

/** Enough to see what the run did in the cron's JSON body without printing an
 *  org's whole debtors book into a log aggregator. */
const SAMPLE_LIMIT = 5;

function emptySummary(orgId: string, dryRun: boolean, today: string): DebtorsWatchSummary {
  return {
    orgId,
    dryRun,
    tablesMissing: false,
    today,
    invoicesSeen: 0,
    customersOverdue: 0,
    findingsDetected: 0,
    findingsWritten: 0,
    findingsSkippedDuplicate: 0,
    findingErrors: 0,
    sampleFindings: [],
    warnings: [],
  };
}

export async function runDebtorsWatch(
  supabase: SupabaseClient,
  orgId: string,
  opts: RunDebtorsWatchOptions = {},
): Promise<DebtorsWatchSummary> {
  const dryRun = opts.dryRun === true;
  const today = opts.today ?? todayIso();
  const log = opts.log ?? (() => {});
  const summary = emptySummary(orgId, dryRun, today);

  // ---- 1. The invoice book, with the Dashboard's own money maths ----------
  const rows = await loadInvoiceRows(supabase, orgId);
  summary.invoicesSeen = rows.length;
  if (rows.length === 0) {
    log(`debtors-watch: ${orgId} has no invoices — nothing to read.`);
    return summary;
  }

  // ---- 2. Customer names --------------------------------------------------
  // Resolved in one read rather than per invoice. A customer whose row cannot
  // be read is SKIPPED, not named "Unknown": a card that says "Unknown is 40
  // days past terms on R190,900" is unactionable and reads as a bug.
  const customers = must<{ id: string; name: string }[]>(
    await supabase.from('of_customers').select('id, name').eq('org_id', orgId),
    'customers',
  );
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  const invoices: DebtorInvoice[] = [];
  let unnamed = 0;
  for (const r of rows) {
    const customerId = r.inv.customer_id;
    if (!customerId) continue; // a cash/counter invoice has nobody to chase
    const customerName = nameById.get(customerId);
    if (!customerName) {
      unnamed += 1;
      continue;
    }
    invoices.push({
      invoiceId: r.inv.id,
      invoiceNumber: r.inv.invoice_number,
      customerId,
      customerName,
      dueDate: r.inv.due_date ? r.inv.due_date.slice(0, 10) : null,
      balance: r.balance,
      open: isOpenInvoice(r.status),
    });
  }
  if (unnamed > 0) {
    summary.warnings.push(`${unnamed} invoice(s) skipped: their customer row could not be read.`);
  }

  // ---- 3. Detect ----------------------------------------------------------
  const findings = detectDebtorFindings(invoices, today);
  summary.findingsDetected = findings.length;
  summary.customersOverdue = findings.length;
  log(`debtors-watch: ${orgId} — ${invoices.length} invoices read, ${findings.length} customers over the line.`);

  // ---- 4. Write -----------------------------------------------------------
  for (const f of findings) {
    if (summary.sampleFindings.length < SAMPLE_LIMIT) {
      summary.sampleFindings.push({
        dedupeKey: f.dedupeKey,
        observation: f.observation,
        randImpact: f.randImpact,
        evidenceCount: f.evidenceInvoiceIds.length,
      });
    }

    if (dryRun) {
      summary.findingsWritten += 1;
      continue;
    }

    const { error } = await supabase.from('agent_findings').insert({
      org_id: orgId,
      agent: AGENT_NAME,
      observation: f.observation,
      // of_invoices ids, NOT documents ids. The Brief's evidence resolver
      // branches on `agent` to know that (lib/platform/agent-findings.ts).
      evidence_refs: f.evidenceInvoiceIds,
      rand_impact: f.randImpact,
      recommended_action: f.recommendedAction,
      status: 'new',
      dedupe_key: f.dedupeKey,
    });

    if (!error) {
      summary.findingsWritten += 1;
    } else if (isMissingRelation(error)) {
      // The pw_/agent_findings migration hasn't been applied here. Say so once
      // and stop: every remaining insert would fail the same way.
      summary.tablesMissing = true;
      summary.warnings.push('agent_findings does not exist in this database — nothing was written.');
      break;
    } else if (isUniqueViolation(error)) {
      // unique(org_id, dedupe_key) did its job: this customer's oldest overdue
      // invoice is already on the Brief. Idempotency, not a failure.
      summary.findingsSkippedDuplicate += 1;
    } else {
      summary.findingErrors += 1;
      summary.warnings.push(`agent_findings insert failed: ${error.message}`);
    }
  }

  return summary;
}
