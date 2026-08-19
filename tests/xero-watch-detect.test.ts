import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_NAME,
  AP_WINDOW_DAYS,
  AR_DAYS_OVERDUE_FLOOR,
  AR_OUTSTANDING_FLOOR,
  DOCU_LOOKBACK_DAYS,
  MISSING_SAMPLE,
  STALE_SYNC_HOURS,
  addDays,
  detectXeroWatchFindings,
  formatDay,
  matchesXeroBill,
  type DocuSupplierInvoice,
  type XeroWatchFinding,
  type XeroWatchInput,
  type XeroWatchInvoice,
} from '../lib/platform/xero-watch/detect.ts';
import { parseXeroWatchDedupeKey } from '../lib/platform/agents/dedupe-keys.ts';

/**
 * Xero Watch's five rules, one block each.
 *
 * "Today" is 2026-08-19 throughout, and every fixture date is expressed relative
 * to it, so a case that reads "31 days late" really is 31 days late rather than
 * a hardcoded date somebody has to recompute when this file is next edited.
 *
 * en-ZA groups thousands with a NON-BREAKING space (U+00A0), not a comma, and
 * every rand figure in this product goes through `rand()`. It is spelled out
 * here so the observation expectations below are readable instead of hiding an
 * invisible codepoint — the same note tests/debtors-watch-detect.test.ts carries.
 */
const TODAY = '2026-08-19';
const ISO_WEEK = '2026-W34';
const ORG = 'org-1';
const NB = ' ';

/** "R 12 400", exactly as `rand()` renders it — grouped by hand so the
 *  expectation does not simply re-run the formatter it is checking. */
function zar(whole: number): string {
  return `R ${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NB)}`;
}

/** `n` days BEFORE today. */
function daysAgo(n: number): string {
  return addDays(TODAY, -n);
}
/** `n` days AFTER today. */
function inDays(n: number): string {
  return addDays(TODAY, n);
}

let seq = 0;
function invoice(overrides: Partial<XeroWatchInvoice> = {}): XeroWatchInvoice {
  seq += 1;
  return {
    id: `mirror-${String(seq).padStart(4, '0')}`,
    type: 'ACCREC',
    status: 'AUTHORISED',
    contactId: 'contact-1',
    contactName: 'Acme Trading',
    invoiceNumber: `INV-${1000 + seq}`,
    dueDate: daysAgo(40),
    amountDue: 10_000,
    total: 10_000,
    ...overrides,
  };
}

let docSeq = 0;
function docuInvoice(overrides: Partial<DocuSupplierInvoice> = {}): DocuSupplierInvoice {
  docSeq += 1;
  return {
    documentId: `doc-${String(docSeq).padStart(4, '0')}`,
    supplierName: 'Umgeni Fresh Produce',
    invoiceNumber: `INV-${9000 + docSeq}`,
    total: 4_000,
    day: daysAgo(3),
    ...overrides,
  };
}

function input(overrides: Partial<XeroWatchInput> = {}): XeroWatchInput {
  return {
    orgId: ORG,
    today: TODAY,
    isoWeek: ISO_WEEK,
    connection: { status: 'connected', lastSyncedAt: `${TODAY}T03:20:00.000Z` },
    invoices: [],
    docuInvoices: [],
    openDebtorNames: [],
    currency: 'ZAR',
    ...overrides,
  };
}

/** All findings of one rule. */
function byRule(findings: XeroWatchFinding[], rule: string): XeroWatchFinding[] {
  return findings.filter((f) => f.rule === rule);
}

/** The clock rule 1 measures against: 03:30 on the morning of TODAY, which is
 *  when the cron actually runs. */
const NOW_MS = Date.parse(`${TODAY}T03:30:00.000Z`);

test('the agent slug is the one the dedupe keys and the Brief chip agree on', () => {
  assert.equal(AGENT_NAME, 'xero_watch');
});

// ---------------------------------------------------------------------------
// Rule 1 — connection health
// ---------------------------------------------------------------------------

test('a healthy, freshly synced connection says nothing', () => {
  const findings = detectXeroWatchFindings(input(), NOW_MS);
  assert.deepEqual(byRule(findings, 'health'), []);
});

test('an org with no Xero connection at all says nothing — it is not a problem', () => {
  const findings = detectXeroWatchFindings(input({ connection: null }), NOW_MS);
  assert.equal(findings.length, 0);
});

test('a connection the owner disconnected says nothing — they chose it', () => {
  const findings = detectXeroWatchFindings(
    input({ connection: { status: 'disconnected', lastSyncedAt: `${daysAgo(90)}T03:20:00.000Z` } }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'health'), []);
});

for (const status of ['error', 'reauth_required']) {
  test(`status "${status}" raises the health card even when the last sync was recent`, () => {
    const findings = detectXeroWatchFindings(
      input({ connection: { status, lastSyncedAt: `${TODAY}T03:20:00.000Z` } }),
      NOW_MS,
    );
    const health = byRule(findings, 'health');
    assert.equal(health.length, 1);
    assert.equal(health[0].recommendedAction, 'Reconnect in Plugins → Xero');
    assert.equal(health[0].randImpact, null, 'the cost of a broken connection is unknowable');
    assert.deepEqual(health[0].evidenceRefs, [], 'this card is not about any one invoice');
  });
}

test('a stale sync raises the card even when the status column still says connected', () => {
  // The case the status column CANNOT catch: a cron that stopped being
  // scheduled. Nothing would ever write `error`, and the mirror would just quietly
  // age.
  const stale = new Date(NOW_MS - (STALE_SYNC_HOURS + 1) * 3_600_000).toISOString();
  const findings = detectXeroWatchFindings(
    input({ connection: { status: 'connected', lastSyncedAt: stale } }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'health').length, 1);
  assert.match(byRule(findings, 'health')[0].observation, /nothing has synced since/);
});

test('a sync just inside the window is not stale', () => {
  const fresh = new Date(NOW_MS - (STALE_SYNC_HOURS - 1) * 3_600_000).toISOString();
  const findings = detectXeroWatchFindings(
    input({ connection: { status: 'connected', lastSyncedAt: fresh } }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'health'), []);
});

test('a connection that has never synced gets its own wording, not a date it does not have', () => {
  const findings = detectXeroWatchFindings(
    input({ connection: { status: 'error', lastSyncedAt: null } }),
    NOW_MS,
  );
  assert.equal(
    byRule(findings, 'health')[0].observation,
    'Xero is connected but nothing has synced yet.',
  );
});

test('the health key is week-scoped, so a broken connection is said once a week', () => {
  const findings = detectXeroWatchFindings(
    input({ connection: { status: 'error', lastSyncedAt: null } }),
    NOW_MS,
  );
  const parsed = parseXeroWatchDedupeKey(byRule(findings, 'health')[0].dedupeKey);
  assert.deepEqual(parsed, { rule: 'health', subject: ORG, qualifier: ISO_WEEK });
});

// ---------------------------------------------------------------------------
// Rule 2 — Doc-U has it, Xero does not
// ---------------------------------------------------------------------------

test('a Doc-U bill with no matching ACCPAY in Xero is missing', () => {
  const findings = detectXeroWatchFindings(
    input({ docuInvoices: [docuInvoice({ supplierName: 'Umgeni Fresh', invoiceNumber: 'INV-5501', total: 4_000 })] }),
    NOW_MS,
  );
  const missing = byRule(findings, 'missing');
  assert.equal(missing.length, 1);
  assert.match(missing[0].observation, /^1 supplier invoice Doc-U has read aren't in Xero yet/);
  assert.match(missing[0].observation, new RegExp(`\\(${zar(4_000)}\\)`));
  assert.match(missing[0].observation, /Umgeni Fresh INV-5501/);
  assert.equal(missing[0].recommendedAction, 'Send them to Hubdoc from Plugins → Xero');
});

test('rand_impact is NULL on the missing card — unrecorded paperwork is not a loss', () => {
  // `rand_impact` orders the Brief and is the figure in the greeting. Bills that
  // exist and are simply filed in one place and not another are not money at
  // stake, and putting the total there would make an admin chore outrank a real
  // one. The sum is in the sentence, where it belongs.
  const findings = detectXeroWatchFindings(input({ docuInvoices: [docuInvoice()] }), NOW_MS);
  assert.equal(byRule(findings, 'missing')[0].randImpact, null);
});

test('a bill that IS in Xero produces no card — number and supplier name both match', () => {
  const findings = detectXeroWatchFindings(
    input({
      docuInvoices: [docuInvoice({ supplierName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-5501' })],
      invoices: [
        invoice({ type: 'ACCPAY', contactName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-5501' }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'missing'), []);
});

test('a PAID bill still counts as being in Xero', () => {
  // Only the rules about money OWED narrow to AUTHORISED. "Is it in Xero?" is
  // answered by any status at all.
  const findings = detectXeroWatchFindings(
    input({
      docuInvoices: [docuInvoice({ supplierName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-5501' })],
      invoices: [
        invoice({
          type: 'ACCPAY',
          status: 'PAID',
          amountDue: 0,
          contactName: 'Umgeni Fresh Produce',
          invoiceNumber: 'INV-5501',
        }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'missing'), []);
});

test('the prefix problem is solved — "INV-9268" on paper matches "9268" in Xero', () => {
  assert.equal(
    matchesXeroBill(
      docuInvoice({ supplierName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-9268' }),
      invoice({ type: 'ACCPAY', contactName: 'Umgeni Fresh Produce', invoiceNumber: '9268' }),
    ),
    true,
  );
});

test('the same number from a DIFFERENT supplier is not a match', () => {
  // "INV-1001" is the thousandth invoice of half the suppliers in the country.
  // Matching on the number alone would mark a genuinely missing bill as filed.
  assert.equal(
    matchesXeroBill(
      docuInvoice({ supplierName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-1001' }),
      invoice({ type: 'ACCPAY', contactName: 'Cape Cold Chain', invoiceNumber: 'INV-1001' }),
    ),
    false,
  );
});

test('a mirror row with no contact name can never match — the safe direction', () => {
  assert.equal(
    matchesXeroBill(
      docuInvoice({ supplierName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-1001' }),
      invoice({ type: 'ACCPAY', contactName: null, invoiceNumber: 'INV-1001' }),
    ),
    false,
  );
});

test('a near-miss supplier name still matches — the dice floor is doing its job', () => {
  assert.equal(
    matchesXeroBill(
      docuInvoice({ supplierName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-1001' }),
      invoice({ type: 'ACCPAY', contactName: 'Umgeni Fresh Produce (Pty) Ltd', invoiceNumber: 'INV-1001' }),
    ),
    true,
  );
});

test('an ACCREC with the same number is not a supplier bill and never matches', () => {
  const findings = detectXeroWatchFindings(
    input({
      docuInvoices: [docuInvoice({ supplierName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-5501' })],
      invoices: [
        invoice({ type: 'ACCREC', contactName: 'Umgeni Fresh Produce', invoiceNumber: 'INV-5501' }),
      ],
    }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'missing').length, 1);
});

test('paper older than the lookback window is left alone', () => {
  const findings = detectXeroWatchFindings(
    input({ docuInvoices: [docuInvoice({ day: daysAgo(DOCU_LOOKBACK_DAYS + 1) })] }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'missing'), []);
});

test('a document with no supplier or no number is skipped, not guessed at', () => {
  const findings = detectXeroWatchFindings(
    input({
      docuInvoices: [docuInvoice({ supplierName: '' }), docuInvoice({ invoiceNumber: '  ' })],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'missing'), []);
});

test('ONE card for the batch, naming at most five and counting the rest', () => {
  const docs = Array.from({ length: MISSING_SAMPLE + 3 }, (_, i) =>
    docuInvoice({ invoiceNumber: `INV-77${i}`, total: 1_000 * (i + 1) }),
  );
  const findings = detectXeroWatchFindings(input({ docuInvoices: docs }), NOW_MS);
  const missing = byRule(findings, 'missing');
  assert.equal(missing.length, 1, 'eight cards for eight bills would drown the Brief');
  assert.match(missing[0].observation, /^8 supplier invoices/);
  assert.match(missing[0].observation, /and 3 more\.$/);
  assert.equal(missing[0].evidenceRefs.length, MISSING_SAMPLE);
});

test('the biggest bills are the ones the card names', () => {
  const findings = detectXeroWatchFindings(
    input({
      docuInvoices: [
        docuInvoice({ invoiceNumber: 'INV-SMALL', total: 100 }),
        docuInvoice({ invoiceNumber: 'INV-BIG', total: 90_000 }),
      ],
    }),
    NOW_MS,
  );
  const observation = byRule(findings, 'missing')[0].observation;
  assert.ok(
    observation.indexOf('INV-BIG') < observation.indexOf('INV-SMALL'),
    'the largest unrecorded bill is the one worth reading first',
  );
});

test('a batch nothing could be priced drops the total rather than printing R 0', () => {
  const findings = detectXeroWatchFindings(
    input({ docuInvoices: [docuInvoice({ total: null }), docuInvoice({ total: null })] }),
    NOW_MS,
  );
  const observation = byRule(findings, 'missing')[0].observation;
  assert.doesNotMatch(observation, /R\s*0/);
  assert.match(observation, /^2 supplier invoices Doc-U has read aren't in Xero yet —/);
});

test('the missing key is week-scoped and cites documents, not mirror rows', () => {
  const findings = detectXeroWatchFindings(
    input({ docuInvoices: [docuInvoice({ documentId: 'doc-abc' })] }),
    NOW_MS,
  );
  const finding = byRule(findings, 'missing')[0];
  assert.deepEqual(parseXeroWatchDedupeKey(finding.dedupeKey), {
    rule: 'missing',
    subject: ORG,
    qualifier: ISO_WEEK,
  });
  assert.deepEqual(finding.evidenceRefs, ['doc-abc']);
});

// ---------------------------------------------------------------------------
// Rule 3 — overdue receivables
// ---------------------------------------------------------------------------

test('a contact well past terms and over the floor earns a card', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ contactName: 'Northern Suburbs Deli', dueDate: daysAgo(41), amountDue: 12_400 }),
      ],
    }),
    NOW_MS,
  );
  const ar = byRule(findings, 'ar');
  assert.equal(ar.length, 1);
  assert.equal(
    ar[0].observation,
    `Northern Suburbs Deli owes ${zar(12_400)} on 1 Xero invoice, oldest 41 days late.`,
  );
  assert.equal(ar[0].randImpact, 12_400, 'real money, already owed — the card states it flatly');
});

test('below either threshold, nothing is said', () => {
  const justUnderDays = detectXeroWatchFindings(
    input({ invoices: [invoice({ dueDate: daysAgo(AR_DAYS_OVERDUE_FLOOR - 1), amountDue: 50_000 })] }),
    NOW_MS,
  );
  assert.deepEqual(byRule(justUnderDays, 'ar'), []);

  const justUnderMoney = detectXeroWatchFindings(
    input({ invoices: [invoice({ dueDate: daysAgo(90), amountDue: AR_OUTSTANDING_FLOOR - 1 })] }),
    NOW_MS,
  );
  assert.deepEqual(byRule(justUnderMoney, 'ar'), []);
});

test('exactly on both thresholds DOES fire — the floors are inclusive', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [invoice({ dueDate: daysAgo(AR_DAYS_OVERDUE_FLOOR), amountDue: AR_OUTSTANDING_FLOOR })],
    }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'ar').length, 1);
});

test('only AUTHORISED receivables count — a draft is a keystroke', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ status: 'DRAFT', dueDate: daysAgo(90), amountDue: 50_000 }),
        invoice({ status: 'SUBMITTED', dueDate: daysAgo(90), amountDue: 50_000 }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'ar'), []);
});

test('a contact’s invoices are summed and the OLDEST leads the sentence', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ contactId: 'c-9', contactName: 'Bravo Foods', dueDate: daysAgo(35), amountDue: 4_000 }),
        invoice({ contactId: 'c-9', contactName: 'Bravo Foods', dueDate: daysAgo(80), amountDue: 6_000 }),
      ],
    }),
    NOW_MS,
  );
  assert.equal(
    byRule(findings, 'ar')[0].observation,
    `Bravo Foods owes ${zar(10_000)} on 2 Xero invoices, oldest 80 days late.`,
  );
});

test('the AR key is the contact plus their OLDEST invoice, so one debtor keeps one card', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ id: 'mirror-newer', contactId: 'c-9', dueDate: daysAgo(35), amountDue: 4_000 }),
        invoice({ id: 'mirror-oldest', contactId: 'c-9', dueDate: daysAgo(80), amountDue: 6_000 }),
      ],
    }),
    NOW_MS,
  );
  const finding = byRule(findings, 'ar')[0];
  assert.deepEqual(parseXeroWatchDedupeKey(finding.dedupeKey), {
    rule: 'ar',
    subject: 'c-9',
    qualifier: 'mirror-oldest',
  });
  assert.deepEqual(finding.evidenceRefs, ['mirror-oldest', 'mirror-newer'], 'worst first');
});

test('a debtor Debtors Watch is already reporting is SUPPRESSED — one debt, one card', () => {
  // Vyso's own OrderFlow invoices and this org's Xero receivables are frequently
  // the same debt recorded twice. Two cards for one late customer is the fastest
  // way to teach an owner that the Brief double-counts.
  const findings = detectXeroWatchFindings(
    input({
      invoices: [invoice({ contactName: 'Northern Suburbs Deli', dueDate: daysAgo(41), amountDue: 12_400 })],
      openDebtorNames: ['Northern Suburbs Deli'],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'ar'), []);
});

test('the suppression tolerates a name variant, at the same dice floor as rule 2', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ contactName: 'Northern Suburbs Deli (Pty) Ltd', dueDate: daysAgo(41), amountDue: 12_400 }),
      ],
      openDebtorNames: ['Northern Suburbs Deli'],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'ar'), []);
});

test('an unrelated open debtor does not suppress a genuine Xero one', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [invoice({ contactName: 'Cape Cold Chain', dueDate: daysAgo(41), amountDue: 12_400 })],
      openDebtorNames: ['Northern Suburbs Deli'],
    }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'ar').length, 1);
});

test('contactless invoices are grouped by name, not merged under one blank heading', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ contactId: null, contactName: 'Cash sale A', dueDate: daysAgo(40), amountDue: 6_000 }),
        invoice({ contactId: null, contactName: 'Cash sale B', dueDate: daysAgo(40), amountDue: 6_000 }),
      ],
    }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'ar').length, 2);
});

// ---------------------------------------------------------------------------
// Rule 4 — the week's payables
// ---------------------------------------------------------------------------

test('one card for the whole week’s bills, never one per bill', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ type: 'ACCPAY', contactName: 'Cape Cold Chain', dueDate: inDays(2), amountDue: 30_000 }),
        invoice({ type: 'ACCPAY', contactName: 'Umgeni Fresh', dueDate: inDays(5), amountDue: 11_000 }),
      ],
    }),
    NOW_MS,
  );
  const ap = byRule(findings, 'ap');
  assert.equal(ap.length, 1);
  assert.equal(
    ap[0].observation,
    `${zar(41_000)} of supplier bills fall due by ${formatDay(inDays(AP_WINDOW_DAYS))} (2 bills; biggest Cape Cold Chain ${zar(30_000)}).`,
  );
});

test('rand_impact is NULL — money falling due on agreed terms is not money at stake', () => {
  const findings = detectXeroWatchFindings(
    input({ invoices: [invoice({ type: 'ACCPAY', dueDate: inDays(2), amountDue: 30_000 })] }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'ap')[0].randImpact, null);
});

test('bills already overdue are excluded — a different conversation', () => {
  const findings = detectXeroWatchFindings(
    input({ invoices: [invoice({ type: 'ACCPAY', dueDate: daysAgo(3), amountDue: 30_000 })] }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'ap'), []);
});

test('a bill due today is overdue, not "due soon" — the window has no overlap', () => {
  const findings = detectXeroWatchFindings(
    input({ invoices: [invoice({ type: 'ACCPAY', dueDate: TODAY, amountDue: 30_000 })] }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'ap'), []);
});

test('a bill beyond the window is not this week’s problem', () => {
  const findings = detectXeroWatchFindings(
    input({ invoices: [invoice({ type: 'ACCPAY', dueDate: inDays(AP_WINDOW_DAYS + 1), amountDue: 30_000 })] }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'ap'), []);
});

test('the far edge of the window is included', () => {
  const findings = detectXeroWatchFindings(
    input({ invoices: [invoice({ type: 'ACCPAY', dueDate: inDays(AP_WINDOW_DAYS), amountDue: 30_000 })] }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'ap').length, 1);
});

test('the payables key is week-scoped and cites the bills soonest-due first', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ id: 'later', type: 'ACCPAY', dueDate: inDays(5), amountDue: 1_000 }),
        invoice({ id: 'sooner', type: 'ACCPAY', dueDate: inDays(1), amountDue: 1_000 }),
      ],
    }),
    NOW_MS,
  );
  const finding = byRule(findings, 'ap')[0];
  assert.deepEqual(parseXeroWatchDedupeKey(finding.dedupeKey), {
    rule: 'ap',
    subject: ORG,
    qualifier: ISO_WEEK,
  });
  assert.deepEqual(finding.evidenceRefs, ['sooner', 'later']);
});

// ---------------------------------------------------------------------------
// Rule 5 — duplicate bills
// ---------------------------------------------------------------------------

test('two ACCPAY bills, same contact, same number → a duplicate card', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ id: 'a', type: 'ACCPAY', contactId: 's-1', contactName: 'Cape Cold Chain', invoiceNumber: 'INV-4402', total: 4_200, amountDue: 4_200, dueDate: inDays(30) }),
        invoice({ id: 'b', type: 'ACCPAY', contactId: 's-1', contactName: 'Cape Cold Chain', invoiceNumber: 'INV-4402', total: 4_200, amountDue: 4_200, dueDate: inDays(30) }),
      ],
    }),
    NOW_MS,
  );
  const dup = byRule(findings, 'dup');
  assert.equal(dup.length, 1);
  assert.equal(
    dup[0].observation,
    `Possible duplicate bill INV-4402 from Cape Cold Chain (${zar(4_200)} twice).`,
  );
  assert.equal(dup[0].randImpact, 4_200, 'what is at stake is paying ONE of them twice');
  assert.deepEqual(dup[0].evidenceRefs, ['a', 'b']);
});

test('two bills with the same number but different amounts are worded honestly', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ id: 'a', type: 'ACCPAY', contactId: 's-1', contactName: 'Cape Cold Chain', invoiceNumber: 'INV-4402', total: 4_200, dueDate: inDays(30) }),
        invoice({ id: 'b', type: 'ACCPAY', contactId: 's-1', contactName: 'Cape Cold Chain', invoiceNumber: 'INV-4402', total: 9_100, dueDate: inDays(30) }),
      ],
    }),
    NOW_MS,
  );
  assert.equal(
    byRule(findings, 'dup')[0].observation,
    `Possible duplicate bill INV-4402 from Cape Cold Chain (2 bills, largest ${zar(9_100)}).`,
  );
});

test('the STRICT number only — "INV-12" and "12" from one supplier are two real bills', () => {
  // Rule 2 matches loosely because it compares two DIFFERENT systems. Both rows
  // here came out of the same Xero ledger, so a loose match would accuse the
  // owner's bookkeeper of a mistake they did not make.
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ type: 'ACCPAY', contactId: 's-1', invoiceNumber: 'INV-12', dueDate: inDays(30) }),
        invoice({ type: 'ACCPAY', contactId: 's-1', invoiceNumber: '12', dueDate: inDays(30) }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'dup'), []);
});

test('punctuation and case still collapse — "inv 4402" duplicates "INV-4402"', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ type: 'ACCPAY', contactId: 's-1', invoiceNumber: 'INV-4402', dueDate: inDays(30) }),
        invoice({ type: 'ACCPAY', contactId: 's-1', invoiceNumber: 'inv 4402', dueDate: inDays(30) }),
      ],
    }),
    NOW_MS,
  );
  assert.equal(byRule(findings, 'dup').length, 1);
});

test('the same number from two DIFFERENT suppliers is not a duplicate', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ type: 'ACCPAY', contactId: 's-1', invoiceNumber: 'INV-4402', dueDate: inDays(30) }),
        invoice({ type: 'ACCPAY', contactId: 's-2', invoiceNumber: 'INV-4402', dueDate: inDays(30) }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'dup'), []);
});

test('receivables are never checked for duplicates — this rule is about paying twice', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ type: 'ACCREC', contactId: 's-1', invoiceNumber: 'INV-4402', dueDate: inDays(30), amountDue: 1 }),
        invoice({ type: 'ACCREC', contactId: 's-1', invoiceNumber: 'INV-4402', dueDate: inDays(30), amountDue: 1 }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(byRule(findings, 'dup'), []);
});

test('the duplicate key is the contact plus the normalised number, so a pair keeps one card', () => {
  const findings = detectXeroWatchFindings(
    input({
      invoices: [
        invoice({ type: 'ACCPAY', contactId: 's-1', invoiceNumber: 'INV-4402', dueDate: inDays(30) }),
        invoice({ type: 'ACCPAY', contactId: 's-1', invoiceNumber: 'inv-4402', dueDate: inDays(30) }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(parseXeroWatchDedupeKey(byRule(findings, 'dup')[0].dedupeKey), {
    rule: 'dup',
    subject: 's-1',
    qualifier: 'INV4402',
  });
});

// ---------------------------------------------------------------------------
// Wording and shared helpers
// ---------------------------------------------------------------------------

test('a foreign-currency ledger is never drawn with a rand sign', () => {
  const findings = detectXeroWatchFindings(
    input({
      currency: 'USD',
      invoices: [invoice({ contactName: 'Overseas Ltd', dueDate: daysAgo(41), amountDue: 12_400 })],
    }),
    NOW_MS,
  );
  assert.match(byRule(findings, 'ar')[0].observation, /USD 12/);
  assert.doesNotMatch(byRule(findings, 'ar')[0].observation, /R\s?12/);
});

test('formatDay reads a calendar day without shifting it into a timezone', () => {
  assert.equal(formatDay('2026-08-26'), '26 August');
  assert.equal(formatDay('not a date'), 'not a date');
});

test('addDays walks the calendar in both directions', () => {
  assert.equal(addDays('2026-08-19', 7), '2026-08-26');
  assert.equal(addDays('2026-08-19', -19), '2026-07-31');
});

// ---------------------------------------------------------------------------
// All five together
// ---------------------------------------------------------------------------

test('a bad morning produces one card per rule, connection first', () => {
  const findings = detectXeroWatchFindings(
    input({
      connection: { status: 'error', lastSyncedAt: null },
      docuInvoices: [docuInvoice()],
      invoices: [
        invoice({ contactName: 'Northern Suburbs Deli', dueDate: daysAgo(41), amountDue: 12_400 }),
        invoice({ type: 'ACCPAY', contactName: 'Cape Cold Chain', dueDate: inDays(2), amountDue: 30_000 }),
        invoice({ id: 'd1', type: 'ACCPAY', contactId: 's-7', contactName: 'Dup Co', invoiceNumber: 'INV-777', total: 900, dueDate: inDays(30) }),
        invoice({ id: 'd2', type: 'ACCPAY', contactId: 's-7', contactName: 'Dup Co', invoiceNumber: 'INV-777', total: 900, dueDate: inDays(30) }),
      ],
    }),
    NOW_MS,
  );
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['health', 'missing', 'ar', 'ap', 'dup'],
  );
  // Every finding must carry a key this build can read back — the resolver on
  // /app depends on it to know which table the refs point at.
  for (const f of findings) {
    assert.ok(parseXeroWatchDedupeKey(f.dedupeKey), `unparseable key: ${f.dedupeKey}`);
  }
});

test('a quiet morning produces nothing at all', () => {
  assert.deepEqual(detectXeroWatchFindings(input(), NOW_MS), []);
});
