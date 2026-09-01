/**
 * Doc Watch — the run layer. Two entry points, one detector.
 *
 * 1. `docWatchForDocument` — IMMEDIATE. Called from Next's `after()` in
 *    app/api/ai/extract/route.ts the moment an extraction succeeds, so the card
 *    already exists by the time the user looks at the Brief. It runs after the
 *    response has been sent, so it can never slow an upload down, and it is
 *    best-effort in the strongest sense: a failure here is logged and nothing
 *    else. Extraction has already succeeded; a receipt that did not get written
 *    must never turn that into an error the user sees.
 *
 * 2. `runDocWatchSweep` — NIGHTLY. Catches everything the immediate path could
 *    not: documents ingested by the inbound-email route, an extraction whose
 *    `after()` was cut short by a cold serverless instance being reclaimed, a
 *    deploy mid-upload. It looks 26 hours back — an hour of
 *    overlap on a daily cron, because a sweep that starts a minute late must not
 *    leave a gap.
 *
 * Both write through the same `writeFinding` below, and both are idempotent on
 * `doc_watch:<document_id>` against unique(org_id, dedupe_key): the sweep
 * re-reading a document the immediate path already handled writes nothing, and
 * so does a user hitting "retry extraction" on the same file.
 *
 * ORG SCOPING. The immediate path receives the caller's RLS-scoped client; the
 * sweep receives the cron's service-role one. Every query filters
 * `.eq('org_id', orgId)` explicitly either way, because only one of those two
 * has RLS behind it and the code cannot tell which it is holding.
 *
 * NO MODEL CALLS anywhere in this file. See detect.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingRelation, isUniqueViolation } from '../db-errors.ts';
import {
  AGENT_NAME,
  WATCHED_DOC_TYPES,
  detectDocWatchFinding,
  isWatchedDocType,
  parseAmount,
  type DocWatchExtracted,
  type DocWatchFinding,
  type DocWatchInput,
} from './detect.ts';

export { AGENT_NAME };

/** The nightly sweep's look-back. 26h, not 24h, so an hour of cron drift can
 *  never open a gap that silently loses a day of paper. */
export const SWEEP_WINDOW_HOURS = 26;

/** A sweep is a catch-up, not a backfill. An org that has just been switched on
 *  should not have 4,000 "read overnight" cards written into its Brief. */
const SWEEP_LIMIT = 200;

interface DocumentRow {
  id: string;
  document_type: string | null;
  supplier_id: string | null;
  extracted_data: DocWatchExtracted | null;
  created_at: string;
}

const DOCUMENT_COLS = 'id, document_type, supplier_id, extracted_data, created_at';

export interface DocWatchWriteResult {
  /** True when a row was actually inserted. */
  written: boolean;
  /** True when unique(org_id, dedupe_key) bounced it — already on the Brief. */
  duplicate: boolean;
  /** True when `agent_findings` isn't in this database yet. */
  tableMissing: boolean;
  error?: string;
}

/**
 * Insert one finding. Every outcome is a value, not an exception: the callers
 * are an `after()` hook that must not surface anything and a cron that wants a
 * countable summary.
 */
async function writeFinding(
  supabase: SupabaseClient,
  orgId: string,
  finding: DocWatchFinding,
): Promise<DocWatchWriteResult> {
  const { error } = await supabase.from('agent_findings').insert({
    org_id: orgId,
    agent: AGENT_NAME,
    observation: finding.observation,
    evidence_refs: finding.evidenceRefs,
    // Both null, always. A Doc Watch card is a receipt, not a problem: it
    // carries no money figure and recommends nothing, and the Brief reads that
    // pair as "do not count this toward 'N things need your attention'".
    rand_impact: null,
    recommended_action: null,
    status: 'new',
    dedupe_key: finding.dedupeKey,
  });

  if (!error) return { written: true, duplicate: false, tableMissing: false };
  if (isMissingRelation(error)) return { written: false, duplicate: false, tableMissing: true };
  if (isUniqueViolation(error)) return { written: false, duplicate: true, tableMissing: false };
  return { written: false, duplicate: false, tableMissing: false, error: error.message };
}

/** Supplier names for a set of ids, in one read. A supplier that cannot be read
 *  simply isn't named — the templates drop the clause rather than print
 *  "Unknown". */
async function supplierNames(
  supabase: SupabaseClient,
  orgId: string,
  supplierIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(supplierIds)];
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('org_id', orgId)
    .in('id', ids)
    .returns<{ id: string; name: string | null }[]>();
  return new Map((data ?? []).flatMap((s) => (s.name ? [[s.id, s.name] as const] : [])));
}

async function orgName(supabase: SupabaseClient, orgId: string): Promise<string | null> {
  const { data } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', orgId)
    .maybeSingle<{ name: string | null }>();
  return data?.name ?? null;
}

/**
 * How many priced lines on a price list differ from the SAME supplier's previous
 * one.
 *
 * Returns null — not 0 — when there is no previous list to compare against, and
 * the template then drops the clause entirely. "0 changed" and "there is nothing
 * to compare this to" are different statements, and only one of them is true for
 * a supplier's first list.
 *
 * Matched on the line description, lower-cased and whitespace-collapsed. That is
 * the same identity Doc-U's own feed uses before Price Watch's canonical item
 * matching gets involved, and deliberately so: this is a "what changed on this
 * piece of paper" count, not a catalogue reconciliation.
 */
async function priceListChangeCount(
  supabase: SupabaseClient,
  orgId: string,
  doc: DocumentRow,
): Promise<number | null> {
  if (!doc.supplier_id) return null;

  const { data, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLS)
    .eq('org_id', orgId)
    .eq('supplier_id', doc.supplier_id)
    .eq('document_type', 'price_list')
    .lt('created_at', doc.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<DocumentRow[]>();

  if (error || !data || data.length === 0) return null;

  const key = (d: string) => d.trim().toLowerCase().replace(/\s+/g, ' ');
  const previous = new Map<string, number>();
  for (const line of data[0].extracted_data?.line_items ?? []) {
    const description = (line?.description ?? '').trim();
    const price = parseAmount(line?.unit_price);
    if (description && price != null) previous.set(key(description), price);
  }
  if (previous.size === 0) return null;

  let changed = 0;
  for (const line of doc.extracted_data?.line_items ?? []) {
    const description = (line?.description ?? '').trim();
    const price = parseAmount(line?.unit_price);
    if (!description || price == null) continue;
    const before = previous.get(key(description));
    // A line that is NEW on this list is not a "change" — it has no previous
    // price to have moved from, and counting it would inflate the number.
    if (before == null) continue;
    // Half a cent of tolerance: extraction reads display text, and a re-read of
    // an unchanged list must not report every line as moved.
    if (Math.abs(before - price) > 0.005) changed += 1;
  }
  return changed;
}

/** Build the detector's input for one already-loaded document row. */
async function inputFor(
  supabase: SupabaseClient,
  orgId: string,
  doc: DocumentRow,
  supplierName: string | null,
  org: string | null,
  now: Date,
): Promise<DocWatchInput> {
  return {
    documentId: doc.id,
    documentType: doc.document_type,
    supplierName,
    orgName: org,
    extracted: doc.extracted_data,
    createdAt: doc.created_at,
    now,
    priceListChanges:
      doc.document_type === 'price_list' ? await priceListChangeCount(supabase, orgId, doc) : null,
  };
}

export interface DocWatchDocumentResult extends DocWatchWriteResult {
  /** True when the detector had nothing truthful to say about this document. */
  skipped: boolean;
  observation?: string;
}

/**
 * The IMMEDIATE path — one document, right after it was read.
 *
 * `supabase` is the extract route's own caller-scoped client, so this can only
 * ever see a document the user could see anyway. It still filters org_id: the
 * same call shape is used by the sweep with a service-role client, and a
 * function whose safety depends on which client it was handed is a function
 * waiting to be called with the other one.
 */
export async function docWatchForDocument(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string,
  opts: { now?: Date } = {},
): Promise<DocWatchDocumentResult> {
  const now = opts.now ?? new Date();

  const { data: doc, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLS)
    .eq('org_id', orgId)
    .eq('id', documentId)
    .maybeSingle<DocumentRow>();

  if (error || !doc) {
    return {
      written: false,
      duplicate: false,
      tableMissing: false,
      skipped: true,
      error: error?.message,
    };
  }
  if (!isWatchedDocType(doc.document_type)) {
    return { written: false, duplicate: false, tableMissing: false, skipped: true };
  }

  const [names, org] = await Promise.all([
    supplierNames(supabase, orgId, doc.supplier_id ? [doc.supplier_id] : []),
    orgName(supabase, orgId),
  ]);

  const finding = detectDocWatchFinding(
    await inputFor(supabase, orgId, doc, doc.supplier_id ? (names.get(doc.supplier_id) ?? null) : null, org, now),
  );
  if (!finding) return { written: false, duplicate: false, tableMissing: false, skipped: true };

  const result = await writeFinding(supabase, orgId, finding);
  return { ...result, skipped: false, observation: finding.observation };
}

// ---------------------------------------------------------------------------
// The nightly sweep
// ---------------------------------------------------------------------------

export interface RunDocWatchSweepOptions {
  dryRun?: boolean;
  /** Pin the clock, for tests and hand runs. */
  now?: Date;
  log?: (message: string) => void;
}

export interface DocWatchSummary {
  orgId: string;
  dryRun: boolean;
  tablesMissing: boolean;
  windowHours: number;
  documentsSeen: number;
  findingsDetected: number;
  findingsWritten: number;
  findingsSkippedDuplicate: number;
  /** Documents the detector had nothing truthful to say about. */
  documentsSkipped: number;
  findingErrors: number;
  sampleObservations: string[];
  warnings: string[];
}

const SAMPLE_LIMIT = 5;

export async function runDocWatchSweep(
  supabase: SupabaseClient,
  orgId: string,
  opts: RunDocWatchSweepOptions = {},
): Promise<DocWatchSummary> {
  const dryRun = opts.dryRun === true;
  const now = opts.now ?? new Date();
  const log = opts.log ?? (() => {});

  const summary: DocWatchSummary = {
    orgId,
    dryRun,
    tablesMissing: false,
    windowHours: SWEEP_WINDOW_HOURS,
    documentsSeen: 0,
    findingsDetected: 0,
    findingsWritten: 0,
    findingsSkippedDuplicate: 0,
    documentsSkipped: 0,
    findingErrors: 0,
    sampleObservations: [],
    warnings: [],
  };

  const since = new Date(now.getTime() - SWEEP_WINDOW_HOURS * 3_600_000).toISOString();
  const { data: docs, error } = await supabase
    .from('documents')
    .select(DOCUMENT_COLS)
    .eq('org_id', orgId)
    .in('document_type', WATCHED_DOC_TYPES as readonly string[])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(SWEEP_LIMIT)
    .returns<DocumentRow[]>();

  if (error) {
    throw new Error(`Could not read documents: ${error.message}`);
  }

  const documents = docs ?? [];
  summary.documentsSeen = documents.length;
  if (documents.length === 0) {
    log(`doc-watch: ${orgId} — nothing new in the last ${SWEEP_WINDOW_HOURS}h.`);
    return summary;
  }

  const [names, org] = await Promise.all([
    supplierNames(
      supabase,
      orgId,
      documents.map((d) => d.supplier_id).filter((id): id is string => !!id),
    ),
    orgName(supabase, orgId),
  ]);

  for (const doc of documents) {
    const finding = detectDocWatchFinding(
      await inputFor(supabase, orgId, doc, doc.supplier_id ? (names.get(doc.supplier_id) ?? null) : null, org, now),
    );
    if (!finding) {
      summary.documentsSkipped += 1;
      continue;
    }
    summary.findingsDetected += 1;
    if (summary.sampleObservations.length < SAMPLE_LIMIT) {
      summary.sampleObservations.push(finding.observation);
    }

    if (dryRun) {
      summary.findingsWritten += 1;
      continue;
    }

    const result = await writeFinding(supabase, orgId, finding);
    if (result.written) {
      summary.findingsWritten += 1;
    } else if (result.tableMissing) {
      summary.tablesMissing = true;
      summary.warnings.push('agent_findings does not exist in this database — nothing was written.');
      break;
    } else if (result.duplicate) {
      // The immediate `after()` path already wrote this one. That is the sweep
      // working as designed, not a failure.
      summary.findingsSkippedDuplicate += 1;
    } else {
      summary.findingErrors += 1;
      summary.warnings.push(`agent_findings insert failed: ${result.error ?? 'unknown error'}`);
    }
  }

  log(
    `doc-watch: ${orgId} — ${documents.length} documents in ${SWEEP_WINDOW_HOURS}h, ` +
      `${summary.findingsWritten} written, ${summary.findingsSkippedDuplicate} already there.`,
  );
  return summary;
}
