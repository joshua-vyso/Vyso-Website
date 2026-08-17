/**
 * Price Watch — the orchestrator (plan step 8, `.ai/plan_price_watch_agent.md`).
 *
 * Everything else in this folder is a pure building block: normalize.ts turns a
 * raw Doc-U line into a base-unit price, match.ts decides which canonical item a
 * description is, detect.ts decides which price moves are worth a human's
 * attention, observe.ts writes the sentence. This file is the only one that
 * knows about Postgres, and its whole job is to run them in the right order over
 * one org's documents:
 *
 *   documents → eligible priced docs → per-line normalisation → item match
 *   (cached, else Claude) → pw_price_points → detect → observe → agent_findings
 *
 * Five rules run through the code below; each is enforced, not merely intended.
 *
 * 1. ORG SCOPING IS MANUAL. The caller hands in a SERVICE-ROLE client (the cron
 *    and the backfill script have no session, so RLS has nothing to key off).
 *    That makes `orgId` the only thing between one tenant's prices and
 *    another's, so every single query below carries `.eq('org_id', orgId)`.
 *
 * 2. NOTHING IS SILENTLY GUESSED (acceptance 2). A line only becomes a price
 *    point when its description is linked to a canonical item by an `auto` or
 *    `confirmed` match. Everything else lands in the pw_item_matches review
 *    queue and contributes nothing to any median.
 *
 * 3. THE CLAUDE BUDGET IS REAL. A backfill is thousands of lines. The matcher is
 *    called ONLY for a (supplier, description) pair that has no pw_item_matches
 *    row at all — a cached row of ANY status is a decision already made (or
 *    pending a human), and re-asking the model nightly would spend money to
 *    produce a result that cannot be acted on until that human looks anyway.
 *
 * 4. RE-RUNS MUST BE FREE OF SIDE EFFECTS. Price points upsert on
 *    (document_id, line_index); findings rely on unique(org_id, dedupe_key) and
 *    treat a unique violation as "already written", not as an error. Running the
 *    cron twice in a minute must leave the database identical.
 *
 * 5. DRY RUN WRITES NOTHING. `opts.dryRun` threads all the way down: the same
 *    computation happens, the same summary comes back, and every write is
 *    skipped rather than rolled back — the backfill script's `--dry-run` is how
 *    a human sees what the agent would do before it does it.
 *
 * Import style: relative, with explicit `.ts` extensions and no `@/` alias, so
 * `node --test tests/price-watch-run.test.ts` can load the pure seams exported
 * here (tests/*.test.ts run under node's type stripping, which has no tsconfig
 * "paths" resolution). Same reason match.ts/observe.ts import the Anthropic
 * client lazily.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isUniqueViolation, isMissingRelation } from '../db-errors.ts';
import { buildSupplierAliasMap, normalizeLine } from './normalize.ts';
import {
  matchLineItem,
  type MatchModelCall,
  type MatchOutcome,
  type PwItemCandidate,
} from './match.ts';
import {
  detectPriceFindings,
  emptyDetectStats,
  type DetectStats,
  type OpenFinding,
  type PwPricePoint,
} from './detect.ts';
import {
  buildFallbackObservation,
  generateObservation,
  type FindingFacts,
  type ObserveModelCall,
} from './observe.ts';

// ---------------------------------------------------------------------------
// Row shapes
//
// Declared locally rather than imported from '@/lib/platform/types': these are
// the exact columns this module SELECTs (a narrow projection, not the full
// Document), and the local shapes are what tests fabricate. Nothing here may
// depend on the alias — see the import note at the top of the file.
// ---------------------------------------------------------------------------

/** One entry of `documents.extracted_data.line_items`. */
export interface PriceWatchLine {
  description?: string | null;
  quantity?: string | null;
  unit?: string | null;
  unit_price?: string | null;
  weight?: string | null;
  total_kg?: string | null;
  amount?: string | null;
  /** Packs per box on a punnet/tray line, or a fruit count code on a carton
   *  line — normalizeLine (normalize.ts) decides which. Without this field
   *  reaching normalizeLine, a sub-pack line can never be recognised as one
   *  (see NormalizationBasis 'sub_pack'). */
  units_per_box?: string | null;
  /** Per-line market agent — statements only; empty on single-supplier invoices. */
  supplier?: string | null;
}

/** The `documents` projection Price Watch reads. */
export interface PriceWatchDocument {
  id: string;
  supplier_id: string | null;
  document_type: string | null;
  status: string | null;
  archived_at: string | null;
  created_at: string | null;
  filename: string | null;
  extracted_data: {
    fields?: { label?: string | null; value?: string | null }[] | null;
    line_items?: PriceWatchLine[] | null;
    /** Statement header block (lib/platform/docu/types.ts → StatementSummary). */
    summary?: { statement_date?: string | null } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Document types whose line items carry a real per-unit price. Same set as
 *  supplysync-pricing.ts's PRICED_DOC_TYPES (not exported there, and copying
 *  three strings beats widening that module's API for a second consumer). */
export const PRICED_DOC_TYPES = ['invoice', 'statement', 'price_list'] as const;

/** A rejected document was judged wrong by a human, and an archived one was
 *  filed away; neither is evidence of what the business pays (plan edge cases). */
const EXCLUDED_STATUSES = new Set(['rejected', 'archived']);

/** The agent slug written to `agent_findings.agent`. */
export const AGENT_NAME = 'price_watch';

/** Findings that still want attention — detect.ts suppresses a re-fire against
 *  these (acceptance 5). Mirrors OPEN_STATUSES in lib/platform/agent-findings.ts. */
const OPEN_FINDING_STATUSES = ['new', 'in_progress'];

/** Upper bound on documents pulled per run. A cron invocation has 300s and an
 *  org has hundreds of documents, not millions; the cap exists so a runaway
 *  org can't turn one run into an unbounded read. */
const DOCUMENT_LIMIT = 5000;

/** Rows per write batch. Keeps a single PostgREST request small enough to stay
 *  well inside the statement timeout on a first backfill. */
const WRITE_CHUNK = 200;

/** How many example rows the summary carries back for the backfill's printout.
 *  A summary is for a human reading a terminal, not a data export. */
const SAMPLE_LIMIT = 10;

/**
 * Bounds on how much of the past one statement is assumed to cover, for the
 * statement-vs-invoice double-count guard below.
 *
 * A statement prints one date and no period, so the period has to be inferred.
 * v1 assumed a month, which the 2026-08-14 diagnosis showed is ~30x too wide:
 * Turn 'n Slice's market statements are DAILY. A 31-day window meant a single
 * invoice anywhere in the month silently discarded four weeks of real daily
 * statement lines — the guard was deleting far more evidence than it protected.
 *
 * The period is now derived per supplier from the cadence actually observed
 * (statementPeriodDaysFor), clamped to these bounds. The MAX remains the
 * ceiling for a supplier whose cadence cannot be observed at all.
 */
export const STATEMENT_PERIOD_MIN_DAYS = 1;
export const STATEMENT_PERIOD_MAX_DAYS = 31;

/**
 * Infer a supplier's statement period from the dates of its own statements:
 * the MEDIAN gap between consecutive statement dates, clamped to
 * [MIN, MAX] days.
 *
 * Median, not mean, because one holiday gap or one missing upload should not
 * stretch the window that a hundred daily statements established. With fewer
 * than two dated statements there is no cadence to observe, and the honest
 * assumption is the NARROW one (a single day): a too-narrow guard costs at
 * worst one duplicated point, while a too-wide one throws away real history —
 * which is precisely the failure this replaces.
 */
export function statementPeriodDaysFor(statementDates: readonly string[]): number {
  const days = [...new Set(statementDates)]
    .map((d) => Date.parse(`${d}T00:00:00Z`))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (days.length < 2) return STATEMENT_PERIOD_MIN_DAYS;

  const gaps: number[] = [];
  for (let i = 1; i < days.length; i += 1) gaps.push((days[i] - days[i - 1]) / DAY_MS);
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 !== 0 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;

  return Math.min(
    STATEMENT_PERIOD_MAX_DAYS,
    Math.max(STATEMENT_PERIOD_MIN_DAYS, Math.round(median)),
  );
}

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Pure seam 1 — document eligibility
// ---------------------------------------------------------------------------

export type DocumentSkipReason =
  | 'wrong_type'
  | 'status_excluded'
  | 'archived'
  | 'credit_note'
  | 'no_supplier'
  | 'no_date'
  | 'no_lines';

/**
 * The `credit_note` derived flag, re-implemented rather than imported.
 *
 * `deriveFlags` (lib/platform/docu/flags.ts) computes this exact keyword test,
 * but reaching it costs a `DocumentWithSupplier` (a full row plus a joined
 * supplier projection), the whole org's documents for its duplicate-invoice
 * check, and a static import of '@/lib/platform/tokens' — an alias this module
 * cannot use without breaking `node --test`. The plan explicitly allows the
 * heuristic ("reuse flags.ts if cheap, else the /\bcredit\b/ heuristic"), so
 * this is the same regex over the same three haystacks (filename, field values,
 * line descriptions) and nothing else.
 */
export function hasCreditIndicator(doc: PriceWatchDocument): boolean {
  const hay = [
    doc.filename ?? '',
    (doc.extracted_data?.fields ?? []).map((f) => f?.value ?? '').join(' '),
    (doc.extracted_data?.line_items ?? []).map((l) => l?.description ?? '').join(' '),
  ]
    .join(' ')
    .toLowerCase();
  return /\bcredit\b/.test(hay);
}

/**
 * Why this document is not a price source, or null when it is one.
 *
 * Exported (and pure) because "which documents count" is the single decision
 * most likely to silently corrupt a price history: a credit note read as a
 * purchase drags a median down and manufactures an "increase" on the next
 * normal invoice.
 */
export function documentSkipReason(doc: PriceWatchDocument): DocumentSkipReason | null {
  const type = (doc.document_type ?? '').trim();
  if (!(PRICED_DOC_TYPES as readonly string[]).includes(type)) return 'wrong_type';
  if (EXCLUDED_STATUSES.has((doc.status ?? '').trim())) return 'status_excluded';
  if (doc.archived_at) return 'archived';
  if (hasCreditIndicator(doc)) return 'credit_note';
  return null;
}

// ---------------------------------------------------------------------------
// Pure seam 2 — dates
// ---------------------------------------------------------------------------

/** Three-letter month abbreviations as Doc-U prints them ("06/JUN/2026"). */
const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Full month names, accepted only in full — see parseDocumentDate's strictness note. */
const MONTH_FULL: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Parse a date as it actually appears on Turn 'n Slice's documents, to
 * 'YYYY-MM-DD'. Returns null for anything it is not certain about.
 *
 * Two formats, both observed in the gate check (`.ai/implementation.md`):
 *   - '2026-07-20'  — extracted invoice-date fields
 *   - '06/JUN/2026' — statement summaries (also accepts '-' or ' ' separators,
 *                     a single-digit day, and any case)
 *
 * STRICT ON PURPOSE. An all-numeric '06/06/2026' is REJECTED rather than
 * guessed: day-first and month-first are both plausible and this is a South
 * African business reading documents that may have been typed anywhere, so a
 * guess would silently place a price point up to eleven months from where it
 * belongs — and a price series is a function of its dates. A rejected date
 * falls back to the document's created_at (a date that is at least true about
 * something) rather than to an invention. The calendar is checked too, so
 * '31/FEB/2026' is rejected as the extraction error it is.
 */
export function parseDocumentDate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return isRealDate(year, month, day) ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
  }

  // dd/MON/yyyy, dd-MON-yyyy, dd MON yyyy. The month segment must be alphabetic:
  // that is exactly what makes the format unambiguous, so it is required.
  const named = /^(\d{1,2})[/\- ]([A-Za-z]+)[/\- ](\d{4})$/.exec(text);
  if (named) {
    const day = Number(named[1]);
    const word = named[2].toLowerCase();
    // Either an exact 3-letter abbreviation or an exact full name. A partial
    // like "Janu" is not a month spelling anyone prints; treating it as one
    // would be the guessing this parser exists to avoid.
    const month = word.length === 3 ? MONTH_ABBR[word] : MONTH_FULL[word];
    const year = Number(named[3]);
    if (month && isRealDate(year, month, day)) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
    return null;
  }

  return null;
}

/** Field labels that carry a document's own date. Substring match, lowercased —
 *  the same shape as findFieldValue in lib/platform/docu/extract.ts. */
const DATE_FIELD_LABELS = [
  'invoice date',
  'date of invoice',
  'tax invoice date',
  'statement date',
  'document date',
  'date',
];

export type DocumentDateSource = 'statement_summary' | 'field' | 'created_at';

export interface DocumentDate {
  /** 'YYYY-MM-DD'. */
  date: string;
  source: DocumentDateSource;
}

/**
 * The date every price point off this document is stamped with.
 *
 * Order per the plan's "Post-pilot amendments":
 *   statements → extracted_data.summary.statement_date
 *   invoices / price lists → the extracted date field
 *   anything unparseable or absent → created_at (last resort, and recorded as
 *   such so a caller can report how many points rest on an upload timestamp)
 *
 * Returns null only when even created_at is unusable — such a document cannot
 * be placed on a timeline at all and is skipped rather than dated "today",
 * which would stack unrelated history onto whichever day the cron happened to
 * run.
 */
export function resolveDocumentDate(doc: PriceWatchDocument): DocumentDate | null {
  const type = (doc.document_type ?? '').trim();

  if (type === 'statement') {
    const fromSummary = parseDocumentDate(doc.extracted_data?.summary?.statement_date ?? null);
    if (fromSummary) return { date: fromSummary, source: 'statement_summary' };
  }

  const fields = doc.extracted_data?.fields ?? [];
  for (const label of DATE_FIELD_LABELS) {
    for (const field of fields) {
      if (!(field?.label ?? '').toLowerCase().includes(label)) continue;
      const parsed = parseDocumentDate(field?.value ?? null);
      if (parsed) return { date: parsed, source: 'field' };
    }
  }

  // created_at is a timestamptz ISO string; its date half is all we need.
  const created = parseDocumentDate((doc.created_at ?? '').slice(0, 10));
  return created ? { date: created, source: 'created_at' } : null;
}

// ---------------------------------------------------------------------------
// Pure seam 3 — the statement-vs-invoice double-count guard
// ---------------------------------------------------------------------------

/**
 * True when this statement's lines must be SKIPPED because the same supplier's
 * invoices already cover the period (plan edge case: "statements vs invoices
 * covering the same purchases").
 *
 * A market statement re-prints purchases that also arrived as invoices. Ingest
 * both and the same tomato delivery becomes two price points: the median is
 * unaffected (same price twice) but the trailing VOLUME doubles, and volume is
 * the multiplier on every rand figure the digest reports. Halving the credibility
 * of a finding is worse than losing a duplicate observation, so invoices win —
 * they are the document the money actually moved against.
 *
 * Deliberately supplier-scoped, not org-wide: an invoice from supplier A says
 * nothing about whether supplier B's statement is a duplicate.
 */
export function statementCoveredByInvoices(
  statementDate: string,
  invoiceDatesForSupplier: readonly string[],
  /** Days this statement is assumed to cover. run.ts passes the supplier's
   *  observed cadence (statementPeriodDaysFor); the default is the ceiling. */
  periodDays: number = STATEMENT_PERIOD_MAX_DAYS,
): boolean {
  const end = Date.parse(`${statementDate}T00:00:00Z`);
  if (!Number.isFinite(end)) return false;
  const start = end - periodDays * DAY_MS;
  return invoiceDatesForSupplier.some((d) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    // Inclusive on both ends: an invoice dated exactly on the statement date is
    // the clearest possible case of the same purchase appearing twice.
    return Number.isFinite(t) && t >= start && t <= end;
  });
}

// ---------------------------------------------------------------------------
// Pure seam 4 — dedupe keys
// ---------------------------------------------------------------------------

/**
 * ISO-8601 week of a 'YYYY-MM-DD' date, as 'YYYY-Www' (e.g. '2026-W33').
 *
 * Weeks, not days, because that is the cadence the finding is about: the same
 * elevated price observed on Monday and again on Thursday is ONE piece of news.
 * ISO rules (weeks start Monday; week 1 is the one containing the first
 * Thursday) mean the year in the key is the ISO week-year, which can differ from
 * the calendar year around New Year — '2026-12-31' is in '2026-W53' or
 * '2027-W01' depending on the day it falls on, and that is correct.
 */
export function isoWeekOf(date: string): string {
  const parsed = parseDocumentDate(date);
  if (!parsed) return 'unknown';
  const [y, m, d] = parsed.split('-').map(Number);
  // Shift to the Thursday of this date's week: the ISO week-year is whatever
  // year that Thursday falls in.
  const target = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (target.getUTCDay() + 6) % 7; // Monday = 0
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${pad2(week)}`;
}

export interface DedupeKeyParts {
  supplierId: string;
  pwItemId: string;
  /** 'YYYY-Www' — the week of the LATEST price point behind the finding. */
  isoWeek: string;
  /** Canonical per-line market agent, when the series has one. */
  lineSupplier?: string | null;
}

/**
 * The plain-text idempotency key behind unique(org_id, dedupe_key)
 * (acceptance 8). Debuggable by design — a human can read one out of the table
 * and know exactly which supplier, item and week it belongs to.
 *
 * The documented core is 'price_watch:<supplier_id>:<pw_item_id>:<iso-week>'.
 * A market agent is APPENDED rather than inserted, so the prefix of a key is
 * identical whether or not a series has one, and the whole key stays split-able
 * on ':' with fixed positions. Colons inside an agent's name are folded to
 * spaces for that reason (no observed name contains one; this is a guard, not a
 * transformation).
 */
export function buildDedupeKey(parts: DedupeKeyParts): string {
  const core = `${AGENT_NAME}:${parts.supplierId}:${parts.pwItemId}:${parts.isoWeek}`;
  const agent = (parts.lineSupplier ?? '').trim().replace(/:/g, ' ');
  return agent ? `${core}:${agent}` : core;
}

/**
 * Inverse of buildDedupeKey.
 *
 * This is load-bearing, not a convenience: `agent_findings` stores no
 * supplier/item columns, so the OPEN findings that suppress a re-fire
 * (acceptance 5) can only be turned back into detect.ts's series identities
 * through their keys. A key this function cannot parse is ignored rather than
 * half-read — a wrong parse would suppress the wrong series, which is a finding
 * silently never reported.
 */
export function parseDedupeKey(key: string): DedupeKeyParts | null {
  const parts = key.split(':');
  if (parts.length < 4 || parts[0] !== AGENT_NAME) return null;
  const [, supplierId, pwItemId, isoWeek, ...rest] = parts;
  if (!supplierId || !pwItemId || !isoWeek) return null;
  const lineSupplier = rest.join(':').trim();
  return { supplierId, pwItemId, isoWeek, lineSupplier: lineSupplier || null };
}

// ---------------------------------------------------------------------------
// Pure seam 5 — env allowlists
// ---------------------------------------------------------------------------

/**
 * Split a comma-separated env var into a clean list.
 *
 * Shared by both cron routes so PRICE_WATCH_ORG_IDS and PRICE_WATCH_DIGEST_TO
 * are read the same way, and so an empty/whitespace/unset value is
 * unambiguously an EMPTY LIST rather than a list containing "". v1 is Turn 'n
 * Slice only (plan, "Out of scope"): an unset allowlist must make the agent do
 * nothing, never "all orgs".
 */
export function parseEnvList(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Run options + summary
// ---------------------------------------------------------------------------

export interface RunPriceWatchOptions {
  /** Compute and report everything; write NOTHING. */
  dryRun?: boolean;
  /** Injected matcher call (tests, and any caller that wants a canned model). */
  matchCall?: MatchModelCall;
  /** Injected observation call. Ignored on a dry run — see generateFindingText. */
  observeCall?: ObserveModelCall;
  /** Progress logging. Silent by default: the cron's output is its JSON body. */
  log?: (message: string) => void;
}

export interface SamplePricePoint {
  documentId: string;
  lineIndex: number;
  description: string;
  itemName: string;
  supplierName: string;
  lineSupplier: string | null;
  unitPrice: number;
  quantityBase: number;
  baseUnit: string;
  invoiceDate: string;
  /** How this point's price was derived — see PricePointDraft.basis. */
  basis: string;
  packsPerBox: number | null;
}

export interface SampleReviewItem {
  rawDescription: string;
  supplierName: string;
  reason: string;
  confidence: number;
  proposedItemName: string | null;
}

export interface SampleFinding {
  dedupeKey: string;
  observation: string;
  randImpact: number;
  evidenceCount: number;
}

export interface PriceWatchSummary {
  orgId: string;
  dryRun: boolean;
  /** True when the pw_* migration hasn't been applied to this database yet. */
  tablesMissing: boolean;
  documentsSeen: number;
  /** Eligible priced documents that actually contributed lines. */
  documentsUsed: number;
  documentsSkipped: Record<string, number>;
  /** Price points dated off an upload timestamp because no real date survived. */
  documentsDatedFromCreatedAt: number;
  linesSeen: number;
  linesSkippedNoDescription: number;
  linesSkippedNoPrice: number;
  /** Sub-kg pack lines with no trustworthy box grouping — parked rather than
   *  normalised into a fictional per-kg price. A data-quality number: high
   *  counts mean Doc-U is losing units_per_box on punnet lines. */
  linesSkippedUnnormalisable: number;
  linesAwaitingReview: number;
  pricePointsUpserted: number;
  pricePointErrors: number;
  /** Points collapsed as content duplicates before detection (same item, agent,
   *  date, price and quantity arriving on two documents). */
  pointsDeduped: number;
  /** Stored points this run's own re-reading of the same document superseded. */
  stalePointsIgnored: number;
  itemsCreated: number;
  reviewQueueAdds: number;
  matchModelCalls: number;
  /** Match calls that reached the model and failed (transport, key, 4xx). */
  matchModelFailures: number;
  observeModelCalls: number;
  /** Observations that produced no usable model text (transport or fidelity). */
  observeModelFailures: number;
  /** True when EVERY model call in this run failed — the outage that hid for
   *  two full runs behind the designed fallbacks. */
  modelOutage: boolean;
  matchCacheHits: number;
  /** Per-supplier statement period the double-count guard used, in days. */
  statementPeriodDays: Record<string, number>;
  detect: DetectStats;
  findingsDetected: number;
  findingsWritten: number;
  findingsSkippedDuplicate: number;
  findingErrors: number;
  /** Findings whose text fell back to the deterministic template. */
  observationFallbacks: number;
  samplePricePoints: SamplePricePoint[];
  sampleReviewItems: SampleReviewItem[];
  sampleFindings: SampleFinding[];
  warnings: string[];
}

function emptySummary(orgId: string, dryRun: boolean): PriceWatchSummary {
  return {
    orgId,
    dryRun,
    tablesMissing: false,
    documentsSeen: 0,
    documentsUsed: 0,
    documentsSkipped: {},
    documentsDatedFromCreatedAt: 0,
    linesSeen: 0,
    linesSkippedNoDescription: 0,
    linesSkippedNoPrice: 0,
    linesSkippedUnnormalisable: 0,
    linesAwaitingReview: 0,
    pricePointsUpserted: 0,
    pricePointErrors: 0,
    pointsDeduped: 0,
    stalePointsIgnored: 0,
    itemsCreated: 0,
    reviewQueueAdds: 0,
    matchModelCalls: 0,
    matchModelFailures: 0,
    observeModelCalls: 0,
    observeModelFailures: 0,
    modelOutage: false,
    matchCacheHits: 0,
    statementPeriodDays: {},
    detect: emptyDetectStats(),
    findingsDetected: 0,
    findingsWritten: 0,
    findingsSkippedDuplicate: 0,
    findingErrors: 0,
    observationFallbacks: 0,
    samplePricePoints: [],
    sampleReviewItems: [],
    sampleFindings: [],
    warnings: [],
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** PostgREST returns `numeric` as a number OR a string depending on precision. */
function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Cache key for a pw_item_matches row. supplier_id is nullable, and a null
 *  supplier is its own bucket (an unattributed document's descriptions are not
 *  the same population as a known supplier's). */
function matchCacheKey(supplierId: string | null, rawDescription: string): string {
  return `${supplierId ?? ''}::${rawDescription}`;
}

function chunk<T>(rows: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

interface PwItemMatchRow {
  raw_description: string;
  supplier_id: string | null;
  pw_item_id: string | null;
  confidence: number | string | null;
  status: string | null;
}

/** Query-builder methods that change data. Everything else is a read. */
const WRITE_METHODS = new Set(['insert', 'upsert', 'update', 'delete']);

/**
 * Wrap a Supabase client so that ANY write throws.
 *
 * `if (!dryRun)` gates around each write are a promise the code makes to
 * itself, and a promise like that is only as good as the next person who adds a
 * write below it. This makes the guarantee structural instead: on a dry run the
 * orchestrator physically holds a handle that cannot insert, upsert, update or
 * delete, so a forgotten gate fails loudly in testing rather than quietly
 * writing to a customer's database.
 *
 * Scope, stated honestly: it traps the write methods on the builder returned by
 * `.from()` and on `.rpc()` — the only shapes this module uses. Methods chained
 * after a read (`.select().eq()…`) return the underlying builder, and supabase
 * exposes no write method there, so there is nothing further to guard.
 */
export function readOnlyClient(supabase: SupabaseClient): SupabaseClient {
  const guarded = {
    from(table: string) {
      const builder = supabase.from(table) as unknown as Record<string | symbol, unknown>;
      return new Proxy(builder, {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && WRITE_METHODS.has(prop)) {
            return () => {
              throw new Error(
                `Price Watch dry run attempted to ${prop} into "${table}" — this is a bug: ` +
                  'a dry run must be completely free of side effects.',
              );
            };
          }
          const value = Reflect.get(target, prop, receiver);
          // Supabase builders are stateful and rely on `this`, so hand back a
          // bound function rather than a detached one.
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
    rpc() {
      throw new Error('Price Watch dry run attempted an rpc call — dry runs are read-only.');
    },
  };
  return guarded as unknown as SupabaseClient;
}

interface PricePointDraft {
  org_id: string;
  supplier_id: string;
  pw_item_id: string;
  line_supplier: string | null;
  document_id: string;
  line_index: number;
  unit_price: number;
  quantity_base: number;
  invoice_date: string;
  /** How this point's price was derived (normalize.ts's NormalizationBasis)
   *  and its pack multiplier when relevant. NOT written to pw_price_points
   *  (see the write loop below) — these live only on the in-memory objects
   *  fed to detectPriceFindings's series-consistency gate. */
  basis: string;
  packsPerBox: number | null;
}

/**
 * The exact `pw_price_points` columns a run writes, in DDL order
 * (`supabase/agents-price-watch.sql` — the create table plus the
 * `alter table … add column if not exists line_supplier` upgrade line).
 * `id` and `created_at` are omitted deliberately: both have defaults.
 */
const PRICE_POINT_COLUMNS = [
  'org_id',
  'supplier_id',
  'pw_item_id',
  'line_supplier',
  'document_id',
  'line_index',
  'unit_price',
  'quantity_base',
  'invoice_date',
] as const;

type PricePointRow = Record<(typeof PRICE_POINT_COLUMNS)[number], unknown>;

/**
 * Drafts → rows, with an EXPLICIT column list.
 *
 * The write boundary is spelled out rather than passing the draft straight
 * through, because a draft deliberately carries in-memory-only fields —
 * `basis` and `packsPerBox`, which detect.ts's series-consistency gate needs
 * and `pw_price_points` has no columns for (detect.ts:153). Handing the draft
 * to PostgREST verbatim sent those keys to the API and every batch came back
 * "Could not find the 'basis' column of 'pw_price_points' in the schema cache"
 * — 0 upserted, 49 errors on the 2026-08-17 Meridian run. Anything added to
 * PricePointDraft from here on is in-memory by default; it reaches the table
 * only by being added to PRICE_POINT_COLUMNS *and* the DDL.
 */
function toPricePointRow(d: PricePointDraft): PricePointRow {
  return {
    org_id: d.org_id,
    supplier_id: d.supplier_id,
    pw_item_id: d.pw_item_id,
    line_supplier: d.line_supplier,
    document_id: d.document_id,
    line_index: d.line_index,
    unit_price: d.unit_price,
    quantity_base: d.quantity_base,
    invoice_date: d.invoice_date,
  };
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * Run Price Watch end to end for ONE org.
 *
 * `supabase` MUST be a service-role client (lib/platform/supabase-service.ts):
 * both callers — the cron route and the backfill script — run without a user
 * session. Never throws for ordinary data problems (a document with no
 * supplier, a model timeout, a missing table): those become counters and
 * warnings in the returned summary, because a nightly job that dies on row 900
 * of 3000 leaves a half-built price history behind.
 */
export async function runPriceWatch(
  supabase: SupabaseClient,
  orgId: string,
  opts: RunPriceWatchOptions = {},
): Promise<PriceWatchSummary> {
  const dryRun = opts.dryRun === true;
  const log = opts.log ?? (() => {});
  const summary = emptySummary(orgId, dryRun);

  // From here on the ONLY handle to the database is `db`. On a dry run it is a
  // client that throws on any write, so "dry run writes nothing" is enforced by
  // the object in hand rather than by remembering to check a flag. Never use
  // `supabase` directly below this line.
  const db = dryRun ? readOnlyClient(supabase) : supabase;

  const countSkip = (reason: DocumentSkipReason) => {
    summary.documentsSkipped[reason] = (summary.documentsSkipped[reason] ?? 0) + 1;
  };

  // ---- 1. Catalogue ------------------------------------------------------
  // Read first, because a missing pw_items table means the migration hasn't
  // been applied and there is nothing sensible to do — better a clear,
  // early "tables missing" than a half-run that fails on the first insert.
  const { data: itemRows, error: itemsError } = await db
    .from('pw_items')
    .select('id, name, base_unit')
    .eq('org_id', orgId)
    .returns<{ id: string; name: string; base_unit: string }[]>();

  if (itemsError) {
    if (isMissingRelation(itemsError)) {
      summary.tablesMissing = true;
      summary.warnings.push('pw_items is not in this database yet — run supabase/agents-price-watch.sql.');
      return summary;
    }
    summary.warnings.push(`pw_items read failed: ${itemsError.message}`);
    return summary;
  }

  const catalogue: PwItemCandidate[] = (itemRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    base_unit: r.base_unit,
  }));
  const itemById = new Map(catalogue.map((c) => [c.id, c]));

  // ---- 2. Suppliers ------------------------------------------------------
  const { data: supplierRows, error: suppliersError } = await db
    .from('suppliers')
    .select('id, name')
    .eq('org_id', orgId)
    .returns<{ id: string; name: string | null }[]>();
  if (suppliersError) {
    summary.warnings.push(`suppliers read failed: ${suppliersError.message}`);
  }
  const supplierNameById = new Map(
    (supplierRows ?? []).map((s) => [s.id, s.name ?? 'Unknown supplier']),
  );

  // ---- 3. Documents ------------------------------------------------------
  const { data: docRows, error: docsError } = await db
    .from('documents')
    .select('id, supplier_id, document_type, status, archived_at, created_at, filename, extracted_data')
    .eq('org_id', orgId)
    .in('document_type', [...PRICED_DOC_TYPES])
    .order('created_at', { ascending: true })
    .limit(DOCUMENT_LIMIT)
    .returns<PriceWatchDocument[]>();

  if (docsError) {
    summary.warnings.push(`documents read failed: ${docsError.message}`);
    return summary;
  }

  const allDocs = docRows ?? [];
  summary.documentsSeen = allDocs.length;

  // Eligibility + dates in one pass. Both are pure functions above, so this
  // loop is the only place the two are combined and it stays trivially
  // reviewable.
  interface EligibleDoc {
    doc: PriceWatchDocument;
    supplierId: string;
    date: string;
  }
  const eligible: EligibleDoc[] = [];
  for (const doc of allDocs) {
    const skip = documentSkipReason(doc);
    if (skip) {
      countSkip(skip);
      continue;
    }
    // pw_price_points.supplier_id is NOT NULL: a line we cannot attribute to a
    // vendor cannot join a price series, and inventing an attribution is the
    // one thing this agent must never do.
    if (!doc.supplier_id) {
      countSkip('no_supplier');
      continue;
    }
    const resolved = resolveDocumentDate(doc);
    if (!resolved) {
      countSkip('no_date');
      continue;
    }
    if (resolved.source === 'created_at') summary.documentsDatedFromCreatedAt += 1;
    const lines = doc.extracted_data?.line_items ?? [];
    if (lines.length === 0) {
      countSkip('no_lines');
      continue;
    }
    eligible.push({ doc, supplierId: doc.supplier_id, date: resolved.date });
  }

  // ---- 4. Market-agent alias map (org-wide, BEFORE any per-line work) -----
  // Built from every per-line supplier string in the org at once, because
  // prefix-merging is only correct when it can see the LONGEST observed form of
  // a name: doing it per document would canonicalise "Botha Roodt & Ki" to
  // itself on a statement that never printed the full spelling, forking the
  // price series in two.
  const observedAgentNames: string[] = [];
  for (const e of eligible) {
    for (const line of e.doc.extracted_data?.line_items ?? []) {
      const raw = (line?.supplier ?? '').trim();
      if (raw) observedAgentNames.push(raw);
    }
  }
  const aliasMap = buildSupplierAliasMap(observedAgentNames);

  // ---- 5. Statement guard input -----------------------------------------
  // Invoice dates per supplier, from this run's own document set (which is the
  // org's whole priced-document history, so nothing is missed).
  const invoiceDatesBySupplier = new Map<string, string[]>();
  for (const e of eligible) {
    if ((e.doc.document_type ?? '') !== 'invoice') continue;
    const arr = invoiceDatesBySupplier.get(e.supplierId);
    if (arr) arr.push(e.date);
    else invoiceDatesBySupplier.set(e.supplierId, [e.date]);
  }

  // ---- 6. Existing matches (the Claude budget guard) ---------------------
  const { data: matchRows, error: matchesError } = await db
    .from('pw_item_matches')
    .select('raw_description, supplier_id, pw_item_id, confidence, status')
    .eq('org_id', orgId)
    .returns<PwItemMatchRow[]>();
  if (matchesError) {
    summary.warnings.push(`pw_item_matches read failed: ${matchesError.message}`);
    return summary;
  }
  const matchCache = new Map<string, PwItemMatchRow>();
  for (const row of matchRows ?? []) {
    matchCache.set(matchCacheKey(row.supplier_id, row.raw_description), row);
  }

  // ---- 7. Per-line work --------------------------------------------------
  const drafts: PricePointDraft[] = [];
  const newMatchRows: Record<string, unknown>[] = [];
  const newItemRows: { id: string; name: string; base_unit: string }[] = [];
  /** Items this run invented. They are visible to the matcher (so two spellings
   *  of one new product converge on a single row instead of creating two), but
   *  a match to one of them can never auto-link: the item itself is a model
   *  proposal no human has agreed to yet, and price points behind it would rest
   *  on two stacked guesses. They link once the review queue is cleared. */
  const pendingItemIds = new Set<string>();

  for (const e of eligible) {
    const doc = e.doc;
    const isStatement = (doc.document_type ?? '') === 'statement';

    if (
      isStatement &&
      statementCoveredByInvoices(e.date, invoiceDatesBySupplier.get(e.supplierId) ?? [])
    ) {
      // Counted under its own key rather than a DocumentSkipReason: this is not
      // a property of the document (it is perfectly good data), it is a
      // relationship between two documents, and a human reading the summary
      // needs to see those apart.
      summary.documentsSkipped.statement_covered_by_invoices =
        (summary.documentsSkipped.statement_covered_by_invoices ?? 0) + 1;
      continue;
    }

    const lines = doc.extracted_data?.line_items ?? [];
    let usedAnyLine = false;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex] ?? {};
      summary.linesSeen += 1;

      const rawDescription = (line.description ?? '').trim();
      if (!rawDescription) {
        summary.linesSkippedNoDescription += 1;
        continue;
      }

      // normalize.ts returns null (with a reason) for a line that isn't a
      // usable price observation: an unparseable/zero/negative price (a credit
      // reversal, a "no charge" promo line, extraction noise), or a sub-kg pack
      // with no trustworthy box grouping (see normalizeLine's own comments —
      // that second case must never fall through to a fabricated per-kg price).
      const normalizeResult = normalizeLine({
        description: rawDescription,
        quantity: line.quantity ?? undefined,
        unit: line.unit ?? undefined,
        unit_price: line.unit_price ?? undefined,
        weight: line.weight ?? undefined,
        total_kg: line.total_kg ?? undefined,
        units_per_box: line.units_per_box ?? undefined,
      });
      if (!normalizeResult.value) {
        if (normalizeResult.rejection === 'sub_pack_unresolvable') {
          summary.linesSkippedUnnormalisable += 1;
        } else {
          summary.linesSkippedNoPrice += 1;
        }
        continue;
      }
      const normalized = normalizeResult.value;

      const rawAgent = (line.supplier ?? '').trim();
      const lineSupplier = rawAgent ? aliasMap.get(rawAgent) ?? rawAgent : null;

      // -- item match: cache first, model only for genuinely new descriptions
      const cacheKey = matchCacheKey(doc.supplier_id, rawDescription);
      let cached = matchCache.get(cacheKey);

      if (!cached) {
        const outcome = await matchLineItem(
          {
            rawDescription,
            supplierName: supplierNameById.get(e.supplierId) ?? null,
            lineSupplier,
            rawUnit: line.unit ?? null,
            candidates: catalogue,
          },
          opts.matchCall,
        );
        // 'no_candidates' short-circuits inside matchLineItem without spending a
        // call, so it must not be counted as one — this number is how the Claude
        // budget is watched.
        if (outcome.reason !== 'no_candidates') {
          summary.matchModelCalls += 1;
          // 'model_error' is specifically the call() throwing (rate limit,
          // timeout, missing key — see match.ts). Every other reason means the
          // model was reached and answered, just not usefully.
          if (outcome.reason === 'model_error') summary.matchModelFailures += 1;
        }

        const created = applyMatchOutcome({
          orgId,
          supplierId: doc.supplier_id,
          rawDescription,
          outcome,
          baseUnit: normalized.baseUnit,
          dryRun,
          catalogue,
          itemById,
          newItemRows,
          newMatchRows,
          pendingItemIds,
          summary,
          supplierName: supplierNameById.get(e.supplierId) ?? 'Unknown supplier',
        });
        matchCache.set(cacheKey, created);
        cached = created;
      } else {
        summary.matchCacheHits += 1;
      }

      // Rule 2: only a settled link produces a price point. 'review' waits for a
      // human; 'rejected' is a human saying no.
      const status = (cached.status ?? '').trim();
      const linked = cached.pw_item_id;
      if (!linked || (status !== 'auto' && status !== 'confirmed')) {
        summary.linesAwaitingReview += 1;
        continue;
      }

      drafts.push({
        org_id: orgId,
        supplier_id: e.supplierId,
        pw_item_id: linked,
        line_supplier: lineSupplier,
        document_id: doc.id,
        line_index: lineIndex,
        unit_price: normalized.unitPriceBase,
        quantity_base: normalized.quantityBase,
        invoice_date: e.date,
        basis: normalized.basis,
        packsPerBox: normalized.packsPerBox,
      });
      usedAnyLine = true;

      if (summary.samplePricePoints.length < SAMPLE_LIMIT) {
        summary.samplePricePoints.push({
          documentId: doc.id,
          lineIndex,
          description: rawDescription,
          itemName: itemById.get(linked)?.name ?? '(unknown item)',
          supplierName: supplierNameById.get(e.supplierId) ?? '(unknown supplier)',
          lineSupplier,
          unitPrice: normalized.unitPriceBase,
          quantityBase: normalized.quantityBase,
          baseUnit: normalized.baseUnit,
          invoiceDate: e.date,
          basis: normalized.basis,
          packsPerBox: normalized.packsPerBox,
        });
      }
    }

    if (usedAnyLine) summary.documentsUsed += 1;
  }

  // The header has to describe what HAPPENED, not just what succeeded. An
  // earlier version printed "0 docs used, 0 price points" for a run that read 22
  // documents and 387 lines and parked every one of them in the review queue —
  // technically true and completely misleading, because "0 docs used" reads as
  // "found nothing" when the truth was "found everything, linked nothing yet".
  log(
    `price-watch ${orgId}: ${summary.documentsSeen} docs read, ${eligible.length} eligible, ` +
      `${summary.linesSeen} lines seen → ${drafts.length} price points, ` +
      `${summary.linesAwaitingReview} review-parked, ${summary.linesSkippedNoPrice} unpriced; ` +
      `${summary.matchModelCalls} model matches (${summary.matchCacheHits} cached), ` +
      `${summary.itemsCreated} items proposed`,
  );

  // ---- 8. Writes: new items, new match rows, price points ----------------
  if (!dryRun) {
    for (const batch of chunk(newItemRows, WRITE_CHUNK)) {
      const { error } = await db
        .from('pw_items')
        .insert(batch.map((r) => ({ id: r.id, org_id: orgId, name: r.name, base_unit: r.base_unit })));
      if (error) summary.warnings.push(`pw_items insert failed: ${error.message}`);
    }

    for (const batch of chunk(newMatchRows, WRITE_CHUNK)) {
      // Plain INSERT, not upsert: unique(org_id, supplier_id, raw_description)
      // treats NULL supplier_id as distinct in Postgres, so an ON CONFLICT
      // upsert would quietly insert a second row for every unattributed
      // description. We only ever insert rows the cache says do not exist, and
      // a unique violation (a concurrent run) means "already there" — not an
      // error, and explicitly NOT an update: overwriting would churn a human's
      // review decision back to the model's guess.
      const { error } = await db.from('pw_item_matches').insert(batch);
      if (error && !isUniqueViolation(error)) {
        summary.warnings.push(`pw_item_matches insert failed: ${error.message}`);
      }
    }

    for (const batch of chunk(drafts, WRITE_CHUNK)) {
      const { error } = await db
        .from('pw_price_points')
        .upsert(batch.map(toPricePointRow), { onConflict: 'document_id,line_index' });
      if (error) {
        summary.pricePointErrors += batch.length;
        summary.warnings.push(`pw_price_points upsert failed: ${error.message}`);
      } else {
        summary.pricePointsUpserted += batch.length;
      }
    }
  } else {
    summary.pricePointsUpserted = drafts.length;
  }

  // ---- 9. Detection input: stored history + this run's points ------------
  const { data: storedPoints, error: pointsError } = await db
    .from('pw_price_points')
    .select('supplier_id, line_supplier, pw_item_id, document_id, line_index, unit_price, quantity_base, invoice_date')
    .eq('org_id', orgId)
    .returns<
      {
        supplier_id: string;
        line_supplier: string | null;
        pw_item_id: string;
        document_id: string;
        line_index: number;
        unit_price: number | string;
        quantity_base: number | string;
        invoice_date: string;
      }[]
    >();
  if (pointsError) {
    summary.warnings.push(`pw_price_points read failed: ${pointsError.message}`);
    return summary;
  }

  // Merged by (document_id, line_index) — the row identity the unique
  // constraint uses — with THIS run's version winning. That makes the dry run
  // detect against exactly the history a real run would have produced, without
  // writing a byte.
  const pointByLine = new Map<string, PwPricePoint>();
  for (const row of storedPoints ?? []) {
    pointByLine.set(`${row.document_id}:${row.line_index}`, {
      supplierId: row.supplier_id,
      lineSupplier: row.line_supplier,
      pwItemId: row.pw_item_id,
      documentId: row.document_id,
      unitPrice: num(row.unit_price),
      quantityBase: num(row.quantity_base),
      invoiceDate: String(row.invoice_date).slice(0, 10),
    });
  }
  for (const d of drafts) {
    pointByLine.set(`${d.document_id}:${d.line_index}`, {
      supplierId: d.supplier_id,
      lineSupplier: d.line_supplier,
      pwItemId: d.pw_item_id,
      documentId: d.document_id,
      unitPrice: d.unit_price,
      quantityBase: d.quantity_base,
      invoiceDate: d.invoice_date,
      basis: d.basis,
      packsPerBox: d.packsPerBox,
    });
  }

  // ---- 9b. Content-level dedupe, before detection -------------------------
  // Row identity (document_id, line_index) is not the same thing as PURCHASE
  // identity: the 2026-08-14 diagnosis found 54/381 points (14%) were the same
  // delivery re-printed on two same-day market statements, or one invoice
  // uploaded twice. Each duplicate silently doubles both the median's sample
  // and — worse — the trailing volume that randImpact is built from. Content
  // identity is (item, market agent, invoice date, unit price, quantity base):
  // deliberately NOT document_id (that's exactly what's duplicated) and NOT
  // supplier_id (the same purchase re-billed under a different document is
  // still one purchase). Map iteration order is insertion order, so the first
  // occurrence — stored history before this run's own points, and within
  // those, ascending document read order — always wins; this is deterministic
  // across re-runs of the same data, which is what makes a duplicate-point
  // count meaningful to compare run over run.
  const seenContent = new Set<string>();
  const dedupedPoints: PwPricePoint[] = [];
  for (const point of pointByLine.values()) {
    const contentKey = [
      point.pwItemId,
      point.lineSupplier ?? '',
      point.invoiceDate,
      point.unitPrice,
      point.quantityBase,
    ].join('::');
    if (seenContent.has(contentKey)) {
      summary.pointsDeduped += 1;
      continue;
    }
    seenContent.add(contentKey);
    dedupedPoints.push(point);
  }

  // ---- 10. Open findings → suppression list ------------------------------
  const { data: openRows, error: openError } = await db
    .from('agent_findings')
    .select('dedupe_key')
    .eq('org_id', orgId)
    .eq('agent', AGENT_NAME)
    .in('status', OPEN_FINDING_STATUSES)
    .returns<{ dedupe_key: string }[]>();
  if (openError) {
    summary.warnings.push(`agent_findings read failed: ${openError.message}`);
    return summary;
  }

  const openFindings: OpenFinding[] = [];
  for (const row of openRows ?? []) {
    const parsed = parseDedupeKey(row.dedupe_key ?? '');
    if (!parsed) continue; // an unreadable key suppresses nothing, by design
    openFindings.push({
      supplierId: parsed.supplierId,
      pwItemId: parsed.pwItemId,
      lineSupplier: parsed.lineSupplier ?? null,
      direction: 'increase',
    });
  }

  // ---- 11. Detect + write findings ---------------------------------------
  // `summary.detect` is passed in (not left to detectPriceFindings's own
  // default) so the caller — the backfill script's printout, the cron's JSON
  // body — can actually see how many series the mixed-basis gate suppressed.
  // That count is the whole point of today's fix: without it, a human has no
  // way to tell "the gate is working" from "there was nothing to suppress".
  const candidates = detectPriceFindings(dedupedPoints, openFindings, summary.detect);
  summary.findingsDetected = candidates.length;

  for (const candidate of candidates) {
    const item = itemById.get(candidate.pwItemId);
    const facts: FindingFacts = {
      itemName: item?.name ?? 'Unknown item',
      supplierName: supplierNameById.get(candidate.supplierId) ?? 'Unknown supplier',
      lineSupplier: candidate.lineSupplier,
      baseUnit: item?.base_unit ?? 'unit',
      latestPrice: candidate.latestUnitPrice,
      medianPrice: candidate.medianUnitPrice,
      deltaPct: candidate.deltaPct,
      randImpact: candidate.randImpact,
      windowStart: candidate.windowStart,
      windowEnd: candidate.windowEnd,
      evidenceCount: candidate.evidenceDocumentIds.length,
    };

    const text = await generateFindingText(facts, dryRun, opts.observeCall);
    if (text.source === 'template') summary.observationFallbacks += 1;
    // A dry run deliberately never calls the writing model (generateFindingText
    // short-circuits to the template) — that's a designed skip, not a failure,
    // so only a real run's attempts count toward the outage check below.
    if (!dryRun) {
      summary.observeModelCalls += 1;
      if (text.source === 'template') summary.observeModelFailures += 1;
    }

    const dedupeKey = buildDedupeKey({
      supplierId: candidate.supplierId,
      pwItemId: candidate.pwItemId,
      lineSupplier: candidate.lineSupplier,
      isoWeek: isoWeekOf(candidate.windowEnd),
    });

    if (summary.sampleFindings.length < SAMPLE_LIMIT) {
      summary.sampleFindings.push({
        dedupeKey,
        observation: text.observation,
        randImpact: candidate.randImpact,
        evidenceCount: candidate.evidenceDocumentIds.length,
      });
    }

    if (dryRun) {
      summary.findingsWritten += 1;
      continue;
    }

    const { error } = await db.from('agent_findings').insert({
      org_id: orgId,
      agent: AGENT_NAME,
      observation: text.observation,
      evidence_refs: candidate.evidenceDocumentIds,
      rand_impact: candidate.randImpact,
      recommended_action: text.recommendedAction,
      status: 'new',
      dedupe_key: dedupeKey,
    });

    if (!error) {
      summary.findingsWritten += 1;
    } else if (isUniqueViolation(error)) {
      // unique(org_id, dedupe_key) did its job: this supplier/item/week is
      // already on the Brief. Idempotency, not a failure (acceptance 8).
      summary.findingsSkippedDuplicate += 1;
    } else {
      summary.findingErrors += 1;
      summary.warnings.push(`agent_findings insert failed: ${error.message}`);
    }
  }

  // The 2026-08-14 incident: neither Claude call ever succeeded for two full
  // runs because both were reached via an `@/` alias import that fails outside
  // Next's bundler, and the designed fallbacks (review queue / template
  // observations) absorbed every failure silently — including on the
  // BACKFILL SCRIPT'S DRY RUN, which is exactly where the outage first hid: a
  // dry run skips writing match results and skips the observe call entirely
  // (see generateFindingText), but it still calls the MATCHER for real, for
  // every genuinely new description. So this check is not dry-run-gated: it
  // fires whenever every model call actually attempted this run — match,
  // observe, or both — came back a failure.
  const modelCallsAttempted = summary.matchModelCalls + summary.observeModelCalls;
  const modelCallsFailed = summary.matchModelFailures + summary.observeModelFailures;
  summary.modelOutage = modelCallsAttempted > 0 && modelCallsFailed === modelCallsAttempted;
  if (summary.modelOutage) {
    summary.warnings.push(
      `Price Watch model outage: all ${modelCallsAttempted} match/observe model calls failed ` +
        `this run (0 succeeded) — every match landed in the review queue and every finding used ` +
        'the fallback template. Check the injected model call (lib/ai/price-watch-model.ts): the ' +
        '2026-08-14 incident was caused by an unresolvable "@/" import outside Next\'s bundler.',
    );
  }

  log(
    `price-watch ${orgId}: ${summary.findingsDetected} candidates → ` +
      `${summary.findingsWritten} written, ${summary.findingsSkippedDuplicate} already open`,
  );

  return summary;
}

/**
 * Observation text for one candidate.
 *
 * A dry run deliberately does NOT call the writing model. The whole point of
 * `--dry-run` is to inspect what would happen before spending anything, and the
 * deterministic template (observe.ts) states the identical numbers — the only
 * loss is phrasing. The real run generates the real sentence.
 */
async function generateFindingText(
  facts: FindingFacts,
  dryRun: boolean,
  observeCall: ObserveModelCall | undefined,
): Promise<{ observation: string; recommendedAction: string; source: string }> {
  if (dryRun) {
    const fallback = buildFallbackObservation(facts);
    return { ...fallback, source: 'template' };
  }
  const result = await generateObservation(facts, observeCall);
  return {
    observation: result.observation,
    recommendedAction: result.recommendedAction,
    source: result.source,
  };
}

/**
 * Turn one matcher outcome into the rows it implies, and return the
 * pw_item_matches row that now represents this (supplier, description) — the
 * value the in-memory cache is seeded with so the same description never costs
 * a second model call in this run.
 *
 * Mutates the pending-write arrays and the summary counters rather than
 * returning them: the caller is a tight per-line loop and this keeps the
 * outcome→rows mapping in one readable place.
 */
function applyMatchOutcome(args: {
  orgId: string;
  supplierId: string | null;
  supplierName: string;
  rawDescription: string;
  outcome: MatchOutcome;
  baseUnit: string;
  dryRun: boolean;
  catalogue: PwItemCandidate[];
  itemById: Map<string, PwItemCandidate>;
  newItemRows: { id: string; name: string; base_unit: string }[];
  newMatchRows: Record<string, unknown>[];
  pendingItemIds: Set<string>;
  summary: PriceWatchSummary;
}): PwItemMatchRow {
  const { outcome, summary } = args;

  // Auto-link: the model was ≥ 0.9 sure and picked a real candidate — real
  // meaning already in the catalogue before this run started. A high-confidence
  // match onto an item this same run invented is still only a model proposal, so
  // it falls through to the review path below.
  if (outcome.status === 'auto' && outcome.pwItemId && !args.pendingItemIds.has(outcome.pwItemId)) {
    const row: PwItemMatchRow = {
      raw_description: args.rawDescription,
      supplier_id: args.supplierId,
      pw_item_id: outcome.pwItemId,
      confidence: outcome.confidence,
      status: 'auto',
    };
    args.newMatchRows.push({ org_id: args.orgId, ...row });
    return row;
  }

  // "None of these fits" → create the canonical item AND a REVIEW row against
  // it (plan acceptance 2). The item exists so the next line with the same
  // description has something to match to and the catalogue stops growing
  // duplicates; the review status is what stops it producing price points
  // before a human has agreed the item is real.
  let proposedItemId: string | null = null;
  if (outcome.proposedName) {
    // A synthetic id on a dry run — nothing is written, and it still lets the
    // rest of this run behave exactly as the real one would.
    proposedItemId = args.dryRun
      ? `dry-run-item-${args.newItemRows.length + 1}`
      : randomUuid();
    const item = {
      id: proposedItemId,
      name: outcome.proposedName,
      base_unit: args.baseUnit,
    };
    args.newItemRows.push(item);
    // Visible to the matcher for the remainder of this run, so two suppliers'
    // spellings of the same new product converge instead of creating two items —
    // but flagged pending, so converging on it produces a second review row, not
    // a price point.
    args.catalogue.push(item);
    args.itemById.set(item.id, item);
    args.pendingItemIds.add(item.id);
    summary.itemsCreated += 1;
  }

  const reviewRow: PwItemMatchRow = {
    raw_description: args.rawDescription,
    supplier_id: args.supplierId,
    // Either the proposed new item, or the model's below-threshold suggestion —
    // both are a SUGGESTION only, because status is 'review'.
    pw_item_id: proposedItemId ?? outcome.pwItemId,
    confidence: outcome.confidence,
    status: 'review',
  };
  args.newMatchRows.push({ org_id: args.orgId, ...reviewRow });
  summary.reviewQueueAdds += 1;

  if (summary.sampleReviewItems.length < SAMPLE_LIMIT) {
    summary.sampleReviewItems.push({
      rawDescription: args.rawDescription,
      supplierName: args.supplierName,
      reason: outcome.reason,
      confidence: outcome.confidence,
      proposedItemName: outcome.proposedName,
    });
  }

  return reviewRow;
}

/** uuid v4 from the platform crypto. Ids are generated client-side (rather than
 *  letting the default gen_random_uuid() fire) so a newly proposed item can be
 *  referenced by the review row written in the SAME batch. */
function randomUuid(): string {
  return globalThis.crypto.randomUUID();
}
