/**
 * Xero Watch — the pure detector. No I/O, no Supabase, no clock of its own: a
 * mirror of the org's Xero ledger, the Doc-U invoices Vyso has read, a date, and
 * a list of findings out. run.ts does the reading and writing; everything that
 * decides WHETHER something is worth the owner's morning is here, where a test
 * can pin it.
 *
 * WHAT THIS AGENT IS FOR, and what it is not. Xero already shows an aged
 * receivables report. Nobody reads it: it is a screen you have to go to, and it
 * has no opinion. This agent's job is the opinion — and, crucially, the things
 * XERO CANNOT SEE, which is the only reason a second system gets to comment on a
 * business's books at all:
 *   - Xero cannot know its own connection is broken (rule 1).
 *   - Xero cannot know about a supplier invoice sitting in Doc-U that never
 *     reached it (rule 2). This is the finding the whole plugin exists for.
 *   - Xero can see rules 3, 4 and 5, but only if somebody opens it. The Brief is
 *     where the owner already looks.
 *
 * EVERY SENTENCE IS A TEMPLATE OVER ROWS THAT EXIST. No model calls. A finding
 * says only what the mirror proves, and where a figure cannot be established the
 * clause is dropped rather than estimated — the rule the whole Brief follows.
 *
 * IT NEVER TOUCHES XERO. Not one rule below implies a write, and the sync that
 * feeds it is GET-only. "Reconnect", "chase", "check before paying" are things
 * the owner does.
 *
 * MULTI-CURRENCY: the rules run on the mirror's DOMINANT currency only (run.ts
 * filters before calling in), because Vyso holds no exchange rates and a finding
 * that added dollars to rands would be wrong by an amount nobody can see. Rows in
 * other currencies are counted in the run summary and said nothing about — which
 * is honest, if incomplete, and better than a confident wrong number.
 *
 * Relative, `.ts`-suffixed imports: `node --test` cannot resolve the `@/` alias.
 */

import { rand } from '../procurepulse.ts';
import { diceCoefficient, normalizeName } from '../procurepulse/matching.ts';
import {
  XERO_WATCH_AGENT,
  buildXeroWatchDedupeKey,
  parseXeroWatchDedupeKey,
  type XeroWatchRule,
} from '../agents/dedupe-keys.ts';
import { daysBetweenDays, invoiceNumbersMatch } from '../xero-sync-shared.ts';

/** The agent slug written to `agent_findings.agent`. */
export const AGENT_NAME = XERO_WATCH_AGENT;

/** Re-exported so callers working on this agent import its key helpers from it,
 *  even though the format is defined once in agents/dedupe-keys.ts — the Brief's
 *  evidence resolver reads keys from there and must not have to pull a detector
 *  onto the render path to do it. */
export { buildXeroWatchDedupeKey, parseXeroWatchDedupeKey };

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** Rule 1: a connection that has not produced a sync in this long is broken,
 *  whatever its status column says. Two days, so one failed nightly run is a
 *  blip and two in a row is news. */
export const STALE_SYNC_HOURS = 48;

/** Rule 2: how far back Doc-U paper is worth reconciling. Beyond six weeks a
 *  missing bill is a bookkeeping decision somebody has already made, not an
 *  oversight to flag. */
export const DOCU_LOOKBACK_DAYS = 45;

/** Rule 2: how alike two supplier names must be before their invoice numbers are
 *  allowed to prove a match. Dice over normalised tokens
 *  (lib/platform/procurepulse/matching.ts), the same measure the product already
 *  uses to reconcile product names. Below this the pair is treated as NOT
 *  MATCHED — which deliberately risks a false "missing" over a false "it's in
 *  Xero", because the second one hides a bill nobody paid. */
export const SUPPLIER_NAME_FLOOR = 0.6;

/** Rule 2: how many invoices a single card names before it becomes a table. */
export const MISSING_SAMPLE = 5;

/** Rule 3: a full extra cycle past terms, matching Debtors Watch's own floor so
 *  the two agents cannot disagree about what "late" means. */
export const AR_DAYS_OVERDUE_FLOOR = 30;
/** Rule 3: below this, chasing costs more than the cash. Also Debtors Watch's. */
export const AR_OUTSTANDING_FLOOR = 5_000;

/** Rule 4: "this week". Seven days INCLUSIVE of today, which is how an owner
 *  reads "falls due by Friday" on a Monday. */
export const AP_WINDOW_DAYS = 7;

/** Balances below this are VAT rounding artefacts, not money. */
const AMOUNT_EPSILON = 0.005;

/** Only AUTHORISED invoices are commitments. A DRAFT is a keystroke, a PAID one
 *  is history, and SUBMITTED is still awaiting approval inside Xero. */
const OWING_STATUS = 'AUTHORISED';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** One mirrored Xero invoice, flattened to what the rules need. `id` is the
 *  MIRROR row's uuid — that is what goes into `evidence_refs`, because
 *  `agent_findings.evidence_refs` is a `uuid[]` and Xero's own ids are text. */
export interface XeroWatchInvoice {
  id: string;
  type: string;
  status: string | null;
  contactId: string | null;
  contactName: string | null;
  invoiceNumber: string | null;
  /** yyyy-mm-dd, or null. */
  dueDate: string | null;
  amountDue: number | null;
  total: number | null;
}

/** One supplier invoice Doc-U has read, as rule 2 sees it. */
export interface DocuSupplierInvoice {
  documentId: string;
  supplierName: string;
  invoiceNumber: string;
  /** The document's stated total, or null when extraction found none. */
  total: number | null;
  /** yyyy-mm-dd — when the paper landed in Doc-U. */
  day: string;
}

export interface XeroConnectionHealth {
  /** `xero_connections.status`. */
  status: string | null;
  /** ISO instant of the last clean sync, or null if there has never been one. */
  lastSyncedAt: string | null;
}

export interface XeroWatchInput {
  orgId: string;
  /** yyyy-mm-dd. Passed in, never read off the clock, so a run, a test and a
   *  hand dry-run against the demo seed all produce one deterministic answer. */
  today: string;
  /** 'YYYY-Www' — the week the standing findings are keyed on. */
  isoWeek: string;
  /** Null when this org has no Xero connection row at all, in which case the
   *  agent says nothing: an org that never connected Xero is not a problem. */
  connection: XeroConnectionHealth | null;
  invoices: readonly XeroWatchInvoice[];
  docuInvoices: readonly DocuSupplierInvoice[];
  /** Customer names with an OPEN `debtors_watch` finding. Rule 3 suppresses
   *  itself for these — see its docblock. */
  openDebtorNames: readonly string[];
  /** The currency every figure in `invoices` is in. Only used for wording; the
   *  filtering happened upstream. */
  currency: string | null;
}

/** One finding, ready to be written to `agent_findings` verbatim. */
export interface XeroWatchFinding {
  rule: XeroWatchRule;
  observation: string;
  recommendedAction: string | null;
  randImpact: number | null;
  /** Mirror-row uuids for rules 1/3/4/5; `documents.id` for rule 2. The Brief's
   *  evidence resolver tells them apart by the dedupe key's rule. */
  evidenceRefs: string[];
  dedupeKey: string;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** "21 August" — a day an owner can match against a calendar. Parsed as UTC
 *  because a 'YYYY-MM-DD' carries no time and formatting it in a timezone would
 *  shift it by a day for half the world. */
export function formatDay(day: string): string {
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ms)) return day;
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  }).format(new Date(ms));
}

/** A money figure in the mirror's currency. ZAR goes through `rand()` so a Xero
 *  card and a Debtors Watch card on the same Brief are formatted identically. */
function money(value: number, currency: string | null): string {
  if (!currency || currency === 'ZAR') return rand(value);
  return `${currency} ${Math.round(value).toLocaleString('en-ZA')}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Invoices that are real, unpaid commitments of one type. */
function owing(invoices: readonly XeroWatchInvoice[], type: string): XeroWatchInvoice[] {
  return invoices.filter(
    (i) =>
      i.type === type &&
      (i.status ?? '').toUpperCase() === OWING_STATUS &&
      i.amountDue != null &&
      i.amountDue > AMOUNT_EPSILON,
  );
}

// ---------------------------------------------------------------------------
// Rule 1 — the connection itself
// ---------------------------------------------------------------------------

/**
 * "Nothing has synced since…".
 *
 * THE ONE FINDING THAT IS ABOUT VYSO, NOT ABOUT THE BUSINESS — and the most
 * important of the five, because every other rule reads a mirror that a broken
 * connection quietly freezes. Without this card, a revoked Xero grant looks
 * exactly like a business with nothing to report: the payables card stops
 * appearing, the debtor cards stop updating, and the Brief gets calmer as the
 * data gets staler.
 *
 * TWO WAYS TO FAIL, ONE CARD. The status column says so (`error`,
 * `reauth_required`), or nothing has synced in `STALE_SYNC_HOURS` — which catches
 * the case the status column cannot: a cron that stopped being scheduled at all.
 * A connection that has NEVER synced counts as stale only if the connection is
 * not brand new; run.ts hands the row's status through and a fresh connection is
 * `connected` with a null `lastSyncedAt`, so the wording below covers it without
 * crying wolf at somebody who connected Xero five minutes ago… which is exactly
 * why `neverSyncedGraceHours` exists.
 */
export const NEVER_SYNCED_GRACE_HOURS = 24;

function detectHealth(input: XeroWatchInput, nowMs: number): XeroWatchFinding | null {
  const connection = input.connection;
  if (!connection) return null;

  const status = (connection.status ?? '').toLowerCase();
  // A disconnected org is not a broken one: the owner chose it.
  if (status === 'disconnected') return null;

  const degraded = status === 'error' || status === 'reauth_required';
  const lastMs = connection.lastSyncedAt ? Date.parse(connection.lastSyncedAt) : NaN;
  const hasSynced = Number.isFinite(lastMs);
  const hoursSince = hasSynced ? (nowMs - lastMs) / 3_600_000 : Infinity;
  const stale = hasSynced && hoursSince > STALE_SYNC_HOURS;

  if (!degraded && !stale) return null;

  const observation = hasSynced
    ? `Xero needs re-authorising — nothing has synced since ${formatDay(new Date(lastMs).toISOString().slice(0, 10))}.`
    : 'Xero is connected but nothing has synced yet.';

  return {
    rule: 'health',
    observation,
    recommendedAction: 'Reconnect in Plugins → Xero',
    // No figure. The cost of a broken connection is unknowable by definition —
    // it is precisely the invoices nobody has read.
    randImpact: null,
    evidenceRefs: [],
    dedupeKey: buildXeroWatchDedupeKey('health', input.orgId, input.isoWeek),
  };
}

// ---------------------------------------------------------------------------
// Rule 2 — Doc-U has it, Xero does not
// ---------------------------------------------------------------------------

/**
 * True when a Doc-U supplier invoice can be found in the Xero mirror.
 *
 * TWO SIGNALS, BOTH REQUIRED. The invoice numbers must match (allowing for the
 * prefix problem — see `invoiceNumbersMatch`), AND the supplier names must be at
 * least `SUPPLIER_NAME_FLOOR` alike. Numbers alone are not enough: "INV-1001" is
 * the thousandth invoice of half the suppliers in South Africa, and matching on
 * it alone would silently mark a genuinely missing bill as filed.
 *
 * A mirror row with NO contact name cannot clear the name test and therefore
 * never matches. That is the safe direction: it produces a "not in Xero yet"
 * card the owner can dismiss in one click, rather than hiding a bill.
 */
export function matchesXeroBill(
  doc: DocuSupplierInvoice,
  bill: XeroWatchInvoice,
): boolean {
  if (!invoiceNumbersMatch(doc.invoiceNumber, bill.invoiceNumber)) return false;
  const docName = normalizeName(doc.supplierName);
  const billName = normalizeName(bill.contactName ?? '');
  if (!docName || !billName) return false;
  return diceCoefficient(docName, billName) >= SUPPLIER_NAME_FLOOR;
}

function detectMissing(input: XeroWatchInput): XeroWatchFinding | null {
  const cutoff = input.docuInvoices.filter(
    (d) =>
      d.supplierName.trim() !== '' &&
      d.invoiceNumber.trim() !== '' &&
      daysBetweenDays(d.day, input.today) <= DOCU_LOOKBACK_DAYS &&
      daysBetweenDays(d.day, input.today) >= 0,
  );
  if (cutoff.length === 0) return null;

  // Every ACCPAY, whatever its status: a bill that is already PAID in Xero is
  // very much "in Xero". Only rules about MONEY OWED narrow to AUTHORISED.
  const bills = input.invoices.filter((i) => i.type === 'ACCPAY');

  const missing = cutoff.filter((doc) => !bills.some((bill) => matchesXeroBill(doc, bill)));
  if (missing.length === 0) return null;

  // Biggest first, so the five the card names are the five worth naming. A
  // document with no total sorts last rather than being dropped — it is still
  // missing, it just cannot be priced.
  const ordered = [...missing].sort(
    (a, b) => (b.total ?? -1) - (a.total ?? -1) || a.supplierName.localeCompare(b.supplierName),
  );

  const priced = ordered.filter((d) => d.total != null);
  const sum = priced.reduce((total, d) => total + (d.total ?? 0), 0);
  // The sum clause is dropped entirely when nothing could be priced, rather than
  // printed as R 0 — the Brief's standing rule about saying nothing over
  // claiming nothing.
  const sumClause = priced.length > 0 ? ` (${money(sum, input.currency)})` : '';

  const named = ordered
    .slice(0, MISSING_SAMPLE)
    .map((d) => {
      const amount = d.total != null ? ` ${money(d.total, input.currency)}` : '';
      return `${d.supplierName} ${d.invoiceNumber}${amount}`;
    })
    .join(', ');
  const rest = ordered.length > MISSING_SAMPLE ? `, and ${ordered.length - MISSING_SAMPLE} more` : '';

  return {
    rule: 'missing',
    observation:
      `${plural(ordered.length, 'supplier invoice', 'supplier invoices')} Doc-U has read ` +
      `aren't in Xero yet${sumClause} — ${named}${rest}.`,
    recommendedAction: 'Send them to Hubdoc from Plugins → Xero',
    // DELIBERATELY NULL. `rand_impact` means "what this is costing or what is at
    // stake" everywhere else on the Brief — it orders the feed and it is the
    // figure in the greeting. Unrecorded bills are not a loss; they are paperwork
    // out of place. The total is in the sentence, where it belongs.
    randImpact: null,
    // `documents.id`, not mirror ids. The resolver knows because the key says
    // `missing`.
    evidenceRefs: ordered.slice(0, MISSING_SAMPLE).map((d) => d.documentId),
    dedupeKey: buildXeroWatchDedupeKey('missing', input.orgId, input.isoWeek),
  };
}

// ---------------------------------------------------------------------------
// Rule 3 — who is late, per Xero
// ---------------------------------------------------------------------------

/**
 * Overdue receivables, one card per contact.
 *
 * SUPPRESSED WHEN DEBTORS WATCH IS ALREADY SAYING IT. Vyso's own OrderFlow
 * invoices and this org's Xero receivables are frequently the SAME DEBT recorded
 * twice — a business that invoices in Vyso and books it into Xero has one late
 * customer, not two — and two cards for one debtor is the fastest way to teach an
 * owner that the Brief double-counts. So a contact whose name matches an open
 * `debtors_watch` finding's customer is skipped here, and Debtors Watch keeps the
 * card. That direction, and not the reverse, because Debtors Watch reads the
 * ledger the business actually operates in and can quote a balance net of
 * payments and credit notes; the mirror only has what Xero last told us.
 *
 * The name comparison is the same dice measure rule 2 uses, at the same floor.
 */
function detectOverdueReceivables(input: XeroWatchInput): XeroWatchFinding[] {
  const suppressed = input.openDebtorNames
    .map((n) => normalizeName(n))
    .filter((n) => n.length > 0);

  const overdue = owing(input.invoices, 'ACCREC')
    .map((inv) => ({
      inv,
      daysOverdue: inv.dueDate ? daysBetweenDays(inv.dueDate, input.today) : 0,
    }))
    .filter((r) => r.daysOverdue > 0);

  const byContact = new Map<string, { inv: XeroWatchInvoice; daysOverdue: number }[]>();
  for (const row of overdue) {
    // Grouped by contact id where there is one, by name otherwise — so two
    // contactless invoices from different people do not merge into one card.
    const key = row.inv.contactId ?? `name:${row.inv.contactName ?? ''}`;
    const arr = byContact.get(key) ?? [];
    arr.push(row);
    byContact.set(key, arr);
  }

  const findings: XeroWatchFinding[] = [];
  for (const rows of byContact.values()) {
    const outstanding = rows.reduce((total, r) => total + (r.inv.amountDue ?? 0), 0);
    const maxDaysOverdue = Math.max(...rows.map((r) => r.daysOverdue));
    if (maxDaysOverdue < AR_DAYS_OVERDUE_FLOOR) continue;
    if (outstanding < AR_OUTSTANDING_FLOOR) continue;

    const name = rows[0].inv.contactName ?? 'An unnamed Xero contact';
    const normalised = normalizeName(name);
    if (
      normalised &&
      suppressed.some((s) => diceCoefficient(s, normalised) >= SUPPLIER_NAME_FLOOR)
    ) {
      continue;
    }

    // Worst first, and ties broken by the mirror id so the key is stable across
    // runs no matter what order Postgres handed the rows back in.
    const ordered = [...rows].sort(
      (a, b) => b.daysOverdue - a.daysOverdue || a.inv.id.localeCompare(b.inv.id),
    );
    const oldest = ordered[0];

    findings.push({
      rule: 'ar',
      observation:
        `${name} owes ${money(outstanding, input.currency)} on ` +
        `${plural(rows.length, 'Xero invoice', 'Xero invoices')}, oldest ${plural(maxDaysOverdue, 'day', 'days')} late.`,
      recommendedAction: 'Send a statement from Xero and hold new orders until paid',
      // Real money, already owed — not an annualised estimate — which is why the
      // card can state it flatly.
      randImpact: outstanding,
      evidenceRefs: ordered.map((r) => r.inv.id),
      dedupeKey: buildXeroWatchDedupeKey(
        'ar',
        rows[0].inv.contactId ?? `name-${normalised || 'unknown'}`,
        oldest.inv.id,
      ),
    });
  }

  return findings.sort(
    (a, b) => (b.randImpact ?? 0) - (a.randImpact ?? 0) || a.dedupeKey.localeCompare(b.dedupeKey),
  );
}

// ---------------------------------------------------------------------------
// Rule 4 — what falls due this week
// ---------------------------------------------------------------------------

/**
 * One card for the whole week's payables, never one per bill.
 *
 * This is a CASH-FLOW HEADS-UP, not a problem: the bills are not late, they are
 * simply arriving. Splitting it per supplier would put five cards on a Brief
 * whose whole promise is that it is short, and would make an ordinary week look
 * like a crisis. `rand_impact` is null for the same reason — money falling due on
 * terms you agreed is not money at stake, and putting it in the greeting's
 * headline figure would misdescribe an ordinary Tuesday as the biggest number of
 * the day.
 *
 * Bills ALREADY overdue are excluded: they are a different conversation, and one
 * the health of this ledger will raise on its own once somebody looks.
 */
function detectPayablesDue(input: XeroWatchInput): XeroWatchFinding | null {
  const soon = owing(input.invoices, 'ACCPAY')
    .map((inv) => ({ inv, days: inv.dueDate ? daysBetweenDays(inv.dueDate, input.today) : null }))
    // `daysBetweenDays(due, today)` is NEGATIVE for a future date, so the window
    // is a floor. `days === 0` is due today and counts as overdue, not "soon".
    .filter((r) => r.days != null && r.days < 0 && r.days >= -AP_WINDOW_DAYS);

  if (soon.length === 0) return null;

  const sum = soon.reduce((total, r) => total + (r.inv.amountDue ?? 0), 0);
  const biggest = [...soon].sort(
    (a, b) => (b.inv.amountDue ?? 0) - (a.inv.amountDue ?? 0) || a.inv.id.localeCompare(b.inv.id),
  )[0];
  // The far edge of the window, in the owner's words. Computed from the window
  // rather than from the latest bill so the sentence means the same thing every
  // week.
  const byDay = addDays(input.today, AP_WINDOW_DAYS);
  const biggestName = biggest.inv.contactName ?? 'an unnamed supplier';

  return {
    rule: 'ap',
    observation:
      `${money(sum, input.currency)} of supplier bills fall due by ${formatDay(byDay)} ` +
      `(${plural(soon.length, 'bill', 'bills')}; biggest ${biggestName} ${money(biggest.inv.amountDue ?? 0, input.currency)}).`,
    recommendedAction: `Make sure the cash is there by ${formatDay(byDay)}`,
    randImpact: null,
    // Soonest due first. `days` is NEGATIVE for a future date, so "soonest" is
    // the LARGEST value (closest to zero) and the comparator runs descending —
    // the one place in this file where the sign convention bites.
    evidenceRefs: [...soon]
      .sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || a.inv.id.localeCompare(b.inv.id))
      .map((r) => r.inv.id),
    dedupeKey: buildXeroWatchDedupeKey('ap', input.orgId, input.isoWeek),
  };
}

/** 'YYYY-MM-DD' plus n days, in UTC. */
export function addDays(day: string, n: number): string {
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ms)) return day;
  return new Date(ms + n * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Rule 5 — the same bill, twice
// ---------------------------------------------------------------------------

/**
 * Two ACCPAY bills from the same contact carrying the same invoice number.
 *
 * THE STRICT KEY ONLY, unlike rule 2. Rule 2 matches "INV-9268" against "9268"
 * because it is comparing two DIFFERENT systems' renderings of one bill, and a
 * missed match there just means a card the owner dismisses. Here both rows came
 * out of the same Xero ledger, so a loose match would pair "INV-12" with "12"
 * from the same supplier — which are usually two real, different bills — and the
 * card would accuse the owner's bookkeeper of a mistake they did not make.
 *
 * `randImpact` is the LARGER of the two amounts, not their sum: what is at stake
 * is paying one of them twice, and the sum would be the cost of paying both
 * twice.
 */
function detectDuplicates(input: XeroWatchInput): XeroWatchFinding[] {
  const bills = input.invoices.filter(
    (i) => i.type === 'ACCPAY' && (i.invoiceNumber ?? '').trim() !== '',
  );

  const groups = new Map<string, XeroWatchInvoice[]>();
  for (const bill of bills) {
    const contact = bill.contactId ?? `name:${normalizeName(bill.contactName ?? '')}`;
    if (contact === 'name:') continue; // a bill with no counterparty cannot duplicate one
    const number = (bill.invoiceNumber ?? '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
    if (!number) continue;
    const key = `${contact}::${number}`;
    const arr = groups.get(key) ?? [];
    arr.push(bill);
    groups.set(key, arr);
  }

  const findings: XeroWatchFinding[] = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    const [contact, number] = key.split('::');
    const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const amounts = ordered.map((r) => r.total ?? r.amountDue ?? 0);
    const largest = Math.max(...amounts);
    const supplier = ordered[0].contactName ?? 'an unnamed supplier';
    const displayNumber = ordered[0].invoiceNumber ?? number;
    // "R 4 200 twice" only when both rows carry the SAME figure — which is the
    // shape of a genuine double-entry. Two different amounts under one number is
    // still worth flagging, but calling it "twice" would be a claim the rows do
    // not support.
    const sameAmount = amounts.every((a) => Math.abs(a - amounts[0]) < 0.01);
    const amountClause = sameAmount
      ? `${money(amounts[0], input.currency)} twice`
      : `${ordered.length} bills, largest ${money(largest, input.currency)}`;

    findings.push({
      rule: 'dup',
      observation: `Possible duplicate bill ${displayNumber} from ${supplier} (${amountClause}).`,
      recommendedAction: 'Check it in Xero before it is paid twice',
      randImpact: largest,
      evidenceRefs: ordered.map((r) => r.id),
      dedupeKey: buildXeroWatchDedupeKey('dup', contact, number),
    });
  }

  return findings.sort(
    (a, b) => (b.randImpact ?? 0) - (a.randImpact ?? 0) || a.dedupeKey.localeCompare(b.dedupeKey),
  );
}

// ---------------------------------------------------------------------------
// All five
// ---------------------------------------------------------------------------

/**
 * Every finding this org has earned this morning, in the order the Brief will
 * want them.
 *
 * ORDER: the connection first (nothing below it is trustworthy if it fires),
 * then the missing bills (the thing only Vyso can see), then the money rules
 * biggest-first. The Brief re-sorts by `rand_impact` anyway; this order is for
 * the human reading the cron's JSON.
 *
 * `nowMs` is separate from `today` because rule 1 measures HOURS since a sync
 * while every other rule compares calendar days. Both are parameters rather than
 * clock reads for the same reason: one deterministic answer per input.
 */
export function detectXeroWatchFindings(
  input: XeroWatchInput,
  nowMs: number = Date.parse(`${input.today}T00:00:00Z`),
): XeroWatchFinding[] {
  const findings: XeroWatchFinding[] = [];

  const health = detectHealth(input, nowMs);
  if (health) findings.push(health);

  const missing = detectMissing(input);
  if (missing) findings.push(missing);

  findings.push(...detectOverdueReceivables(input));

  const payables = detectPayablesDue(input);
  if (payables) findings.push(payables);

  findings.push(...detectDuplicates(input));

  return findings;
}
