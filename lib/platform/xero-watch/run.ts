/**
 * Xero Watch — the run loop. Reads one org's Xero mirror, the supplier invoices
 * Doc-U has filed, and what Debtors Watch is already saying; asks detect.ts what
 * is worth a card this morning; writes what comes back to `agent_findings`.
 *
 * It observes and recommends. It never writes to Xero, never sends a statement,
 * never pays a bill, never forwards a document. The sync that fills the mirror is
 * GET-only and this loop does not call Xero at all.
 *
 * THE SAME FOUR RULES the Phase C agents' run loops follow (see
 * debtors-watch/run.ts, which this is modelled on):
 *
 * 1. THE ORG ID IS THE ONLY FENCE. The caller is the cron's service-role client,
 *    which bypasses RLS entirely, so every query filters `.eq('org_id', orgId)`
 *    by hand.
 *
 * 2. RE-RUNS MUST BE FREE OF SIDE EFFECTS. Idempotency is the dedupe key against
 *    unique(org_id, dedupe_key) — week-keyed for the standing facts (connection
 *    health, missing bills, this week's payables), row-keyed for the specific
 *    ones (a debtor's oldest invoice, a duplicated number). See
 *    agents/dedupe-keys.ts for why each is which.
 *
 * 3. AN ORDINARY DATA PROBLEM IS A WARNING, NOT AN EXCEPTION. A mirror table that
 *    has not been created yet, a document whose supplier cannot be resolved, a
 *    single failed insert — all collected into the summary the route returns.
 *
 * 4. NO AUTO-CLOSE. Nothing here resolves or retracts a finding. A card stays
 *    until the owner dismisses it, and the key then stops it coming back for the
 *    same week or the same invoice.
 *
 * AND ONE OF ITS OWN: THE MIRROR MAY BE STALE, AND THAT IS THE POINT. This agent
 * deliberately does NOT trigger a sync. It reads whatever the 03:20 run left and
 * says so — rule 1 exists precisely to notice when that is old. An agent that
 * synced first would hide the failure it is supposed to report.
 *
 * NO MODEL CALLS. Every sentence is a template over rows the business already
 * has.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation, isUniqueViolation } from '../db-errors.ts';
import { todayIso } from '../orderflow-debtors.ts';
import { isoWeekOf } from '../price-watch/run.ts';
import { parseDebtorsDedupeKey, DEBTORS_WATCH_AGENT } from '../agents/dedupe-keys.ts';
import { documentNumber, statedTotal, type DocWatchExtracted } from '../doc-watch/detect.ts';
import { summariseXeroMirror } from '../xero-sync-shared.ts';
import {
  AGENT_NAME,
  DOCU_LOOKBACK_DAYS,
  detectXeroWatchFindings,
  type DocuSupplierInvoice,
  type XeroWatchFinding,
  type XeroWatchInvoice,
} from './detect.ts';

export { AGENT_NAME };

export interface RunXeroWatchOptions {
  /** Compute and report everything; write NOTHING. */
  dryRun?: boolean;
  /** Pin "today" (yyyy-mm-dd). Defaults to the UTC day, like every other agent. */
  today?: string;
  /** Progress logging. Silent by default: the cron's output is its JSON body. */
  log?: (message: string) => void;
}

export interface XeroWatchSampleFinding {
  rule: string;
  dedupeKey: string;
  observation: string;
  randImpact: number | null;
  evidenceCount: number;
}

export interface XeroWatchSummary {
  orgId: string;
  dryRun: boolean;
  /** True when `agent_findings` or the Xero mirror isn't in this database yet. */
  tablesMissing: boolean;
  today: string;
  isoWeek: string;
  /** Null when this org has no Xero connection — the run did nothing at all. */
  connectionStatus: string | null;
  invoicesSeen: number;
  /** Mirror rows left out because they are in a currency other than the
   *  dominant one. Vyso does no FX; see detect.ts. */
  invoicesSkippedCurrency: number;
  docuInvoicesSeen: number;
  findingsDetected: number;
  findingsWritten: number;
  findingsSkippedDuplicate: number;
  findingErrors: number;
  sampleFindings: XeroWatchSampleFinding[];
  warnings: string[];
}

const SAMPLE_LIMIT = 5;

/** Ceilings, for the same reason Stock Cover's exist: an unbounded select inside
 *  a 300s cron is how a nightly job becomes an outage. */
const INVOICE_LIMIT = 5_000;
const DOCUMENT_LIMIT = 500;

/** Doc-U statuses that mean "Vyso has actually read this bill". `pending` has not
 *  been extracted yet (there is no number to look for), and `rejected`/`archived`
 *  are documents somebody has already decided about. */
const DOCU_STATUSES = ['extracted', 'reviewed', 'approved'] as const;

interface MirrorRow {
  id: string;
  type: string;
  status: string | null;
  contact_id: string | null;
  contact_name: string | null;
  invoice_number: string | null;
  due_date: string | null;
  amount_due: number | string | null;
  total: number | string | null;
  currency: string | null;
}

interface DocumentRow {
  id: string;
  supplier_id: string | null;
  extracted_data: DocWatchExtracted | null;
  created_at: string;
}

/** PostgREST returns numerics as number|string depending on driver/precision. */
function num(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function emptySummary(orgId: string, dryRun: boolean, today: string): XeroWatchSummary {
  return {
    orgId,
    dryRun,
    tablesMissing: false,
    today,
    isoWeek: isoWeekOf(today),
    connectionStatus: null,
    invoicesSeen: 0,
    invoicesSkippedCurrency: 0,
    docuInvoicesSeen: 0,
    findingsDetected: 0,
    findingsWritten: 0,
    findingsSkippedDuplicate: 0,
    findingErrors: 0,
    sampleFindings: [],
    warnings: [],
  };
}

export async function runXeroWatch(
  supabase: SupabaseClient,
  orgId: string,
  opts: RunXeroWatchOptions = {},
): Promise<XeroWatchSummary> {
  const dryRun = opts.dryRun === true;
  const today = opts.today ?? todayIso();
  const log = opts.log ?? (() => {});
  const summary = emptySummary(orgId, dryRun, today);

  // ---- 1. Is there a connection at all? -----------------------------------
  // An org that has never connected Xero is not a problem and gets no cards.
  const { data: connectionRow, error: connectionError } = await supabase
    .from('xero_connections')
    .select('status, last_synced_at')
    .eq('org_id', orgId)
    .maybeSingle<{ status: string | null; last_synced_at: string | null }>();

  if (connectionError && !isMissingRelation(connectionError)) {
    summary.warnings.push(`Could not read the Xero connection: ${connectionError.message}`);
    return summary;
  }
  if (!connectionRow) {
    log(`xero-watch: ${orgId} has no Xero connection — nothing to read.`);
    return summary;
  }
  summary.connectionStatus = connectionRow.status;

  // ---- 2. The mirror ------------------------------------------------------
  const { data: mirrorRows, error: mirrorError } = await supabase
    .from('xero_invoices')
    .select('id, type, status, contact_id, contact_name, invoice_number, due_date, amount_due, total, currency')
    .eq('org_id', orgId)
    .limit(INVOICE_LIMIT)
    .returns<MirrorRow[]>();

  if (mirrorError) {
    if (isMissingRelation(mirrorError)) {
      // The mirror migration has not been applied. Rule 1 would still be worth
      // saying, but a "nothing has synced" card raised because the TABLE is
      // missing would send the owner to reconnect a connection that is fine.
      // Say nothing; the plugin page says the real thing.
      summary.tablesMissing = true;
      summary.warnings.push('xero_invoices does not exist in this database — the mirror has never been created.');
      return summary;
    }
    summary.warnings.push(`Could not read the Xero mirror: ${mirrorError.message}`);
    return summary;
  }

  const allRows = mirrorRows ?? [];
  // ONE currency. `summariseXeroMirror` already decides which one dominates and
  // is the single definition of that rule — reusing it here is what stops the
  // page and the agent disagreeing about which ledger they are describing.
  const dominant = summariseXeroMirror(
    allRows.map((r) => ({
      type: r.type,
      status: r.status,
      due_date: r.due_date,
      amount_due: num(r.amount_due),
      currency: r.currency,
      contact_id: r.contact_id,
      contact_name: r.contact_name,
    })),
    today,
  ).currency;

  const inScope = allRows.filter((r) => {
    const code = (r.currency ?? '').trim().toUpperCase();
    return !code || code === dominant;
  });
  summary.invoicesSeen = inScope.length;
  summary.invoicesSkippedCurrency = allRows.length - inScope.length;
  if (summary.invoicesSkippedCurrency > 0) {
    summary.warnings.push(
      `${summary.invoicesSkippedCurrency} invoice(s) in another currency were left out — Vyso does not convert currencies.`,
    );
  }

  const invoices: XeroWatchInvoice[] = inScope.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    contactId: r.contact_id,
    contactName: r.contact_name,
    invoiceNumber: r.invoice_number,
    dueDate: r.due_date ? r.due_date.slice(0, 10) : null,
    amountDue: num(r.amount_due),
    total: num(r.total),
  }));

  // ---- 3. What Doc-U has read ---------------------------------------------
  const docuInvoices = await loadDocuSupplierInvoices(supabase, orgId, today, summary.warnings);
  summary.docuInvoicesSeen = docuInvoices.length;

  // ---- 4. What Debtors Watch is already saying ----------------------------
  const openDebtorNames = await loadOpenDebtorNames(supabase, orgId, summary);

  // ---- 5. Detect -----------------------------------------------------------
  const findings = detectXeroWatchFindings(
    {
      orgId,
      today,
      isoWeek: summary.isoWeek,
      connection: { status: connectionRow.status, lastSyncedAt: connectionRow.last_synced_at },
      invoices,
      docuInvoices,
      openDebtorNames,
      currency: dominant,
    },
    // Rule 1 measures HOURS since a sync, so it gets the real clock rather than
    // midnight of `today` — a sync that landed at 23:00 last night is not 48
    // hours old at 03:30 this morning, and midnight arithmetic would say it was.
    Date.now(),
  );
  summary.findingsDetected = findings.length;
  log(
    `xero-watch: ${orgId} — ${invoices.length} mirrored invoices, ${docuInvoices.length} Doc-U bills, ${findings.length} finding(s).`,
  );

  // ---- 6. Write ------------------------------------------------------------
  for (const f of findings) {
    if (summary.sampleFindings.length < SAMPLE_LIMIT) {
      summary.sampleFindings.push({
        rule: f.rule,
        dedupeKey: f.dedupeKey,
        observation: f.observation,
        randImpact: f.randImpact,
        evidenceCount: f.evidenceRefs.length,
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
      // Mirror-row ids for four of the five rules, `documents.id` for the
      // "missing" one. The Brief's evidence resolver branches on the dedupe key
      // to tell them apart (lib/platform/agent-findings.ts).
      evidence_refs: f.evidenceRefs,
      rand_impact: f.randImpact,
      recommended_action: f.recommendedAction,
      status: 'new',
      dedupe_key: f.dedupeKey,
    });

    if (!error) {
      summary.findingsWritten += 1;
    } else if (isMissingRelation(error)) {
      summary.tablesMissing = true;
      summary.warnings.push('agent_findings does not exist in this database — nothing was written.');
      break;
    } else if (isUniqueViolation(error)) {
      // unique(org_id, dedupe_key) did its job — already on the Brief.
      summary.findingsSkippedDuplicate += 1;
    } else {
      summary.findingErrors += 1;
      summary.warnings.push(`agent_findings insert failed: ${error.message}`);
    }
  }

  return summary;
}

/**
 * The supplier invoices Doc-U has read in the last `DOCU_LOOKBACK_DAYS`, with
 * their supplier name, invoice number and stated total.
 *
 * THE DATE IS `created_at`, NOT THE INVOICE'S OWN DATE, and that is a real
 * choice. The invoice date lives in `extracted_data.fields` as free text in
 * whatever format the supplier prints, and a window built on it would silently
 * shift with every mis-parsed date. `created_at` is when the paper reached Vyso,
 * which is also the honest thing this rule is about: "we read this recently and
 * it never reached Xero".
 *
 * A DOCUMENT WITHOUT BOTH A SUPPLIER AND A NUMBER IS SKIPPED. Rule 2's match
 * needs both, and a card that said "1 supplier invoice isn't in Xero" about a
 * scan Vyso could not even read a number off would be unactionable.
 *
 * EXPORTED SINCE X2, and it takes a `string[]` rather than the run summary for
 * exactly that reason. The plugin page's "Not in Xero yet" list has to ask the
 * same question of the same rows as rule 2 — a second loader with its own idea
 * of which documents count would let the Brief and the page disagree about which
 * bills are missing, which is the one thing a reconciliation screen may not do.
 * The agent passes `summary.warnings`; the page passes an array it drops.
 */
export async function loadDocuSupplierInvoices(
  supabase: SupabaseClient,
  orgId: string,
  today: string,
  warnings: string[],
): Promise<DocuSupplierInvoice[]> {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - DOCU_LOOKBACK_DAYS * 86_400_000)
    .toISOString();

  const { data, error } = await supabase
    .from('documents')
    .select('id, supplier_id, extracted_data, created_at')
    .eq('org_id', orgId)
    .eq('document_type', 'invoice')
    .in('status', DOCU_STATUSES as readonly string[])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(DOCUMENT_LIMIT)
    .returns<DocumentRow[]>();

  if (error) {
    // Soft: without Doc-U rows rule 2 simply says nothing, and the other four
    // rules are unaffected.
    if (!isMissingRelation(error)) {
      warnings.push(`Could not read Doc-U invoices: ${error.message}`);
    }
    return [];
  }

  const rows = data ?? [];
  const supplierIds = [...new Set(rows.map((r) => r.supplier_id).filter((s): s is string => !!s))];
  const nameById = new Map<string, string>();
  if (supplierIds.length > 0) {
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('org_id', orgId)
      .in('id', supplierIds)
      .returns<{ id: string; name: string | null }[]>();
    for (const s of suppliers ?? []) if (s.name) nameById.set(s.id, s.name);
  }

  const out: DocuSupplierInvoice[] = [];
  let unusable = 0;
  for (const row of rows) {
    const supplierName = row.supplier_id ? (nameById.get(row.supplier_id) ?? '') : '';
    const fields = row.extracted_data?.fields ?? [];
    const number = documentNumber(fields) ?? '';
    if (!supplierName || !number) {
      unusable += 1;
      continue;
    }
    out.push({
      documentId: row.id,
      supplierName,
      invoiceNumber: number,
      total: statedTotal(fields),
      day: row.created_at.slice(0, 10),
    });
  }
  if (unusable > 0) {
    warnings.push(
      `${unusable} Doc-U invoice(s) skipped: no supplier or no invoice number could be read, so they cannot be looked for in Xero.`,
    );
  }
  return out;
}

/**
 * Customer names behind OPEN Debtors Watch findings — what rule 3 suppresses
 * itself against, so one late customer never gets two cards.
 *
 * The customer id comes from the dedupe key
 * (`debtors_watch:<customer_id>:<oldest_invoice_id>`), which is free; only the
 * name needs a lookup. A key this build cannot parse is skipped rather than
 * guessed — the consequence is at worst a duplicate card, which is the same
 * outcome as not having this suppression at all.
 */
async function loadOpenDebtorNames(
  supabase: SupabaseClient,
  orgId: string,
  summary: XeroWatchSummary,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('agent_findings')
    .select('dedupe_key')
    .eq('org_id', orgId)
    .eq('agent', DEBTORS_WATCH_AGENT)
    .in('status', ['new', 'in_progress'])
    .returns<{ dedupe_key: string | null }[]>();

  if (error || !data) {
    if (error && !isMissingRelation(error)) {
      summary.warnings.push(`Could not read open debtor findings: ${error.message}`);
    }
    return [];
  }

  const customerIds = [
    ...new Set(
      data
        .map((r) => parseDebtorsDedupeKey(r.dedupe_key ?? '')?.customerId)
        .filter((id): id is string => !!id),
    ),
  ];
  if (customerIds.length === 0) return [];

  const { data: customers } = await supabase
    .from('of_customers')
    .select('name')
    .eq('org_id', orgId)
    .in('id', customerIds)
    .returns<{ name: string | null }[]>();

  return (customers ?? []).map((c) => c.name).filter((n): n is string => !!n);
}

/** Re-exported so the route can type its own accumulator without importing the
 *  detector. */
export type { XeroWatchFinding };
