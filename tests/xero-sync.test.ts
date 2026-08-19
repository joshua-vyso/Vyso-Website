import test from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetweenDays,
  ifModifiedSinceHeader,
  invoiceNumberKeys,
  invoiceNumbersMatch,
  mapXeroContact,
  mapXeroContactPage,
  mapXeroInvoice,
  mapXeroInvoicePage,
  MAX_RETRY_WAIT_MS,
  normaliseInvoiceNumber,
  parseXeroAmount,
  parseXeroDay,
  parseXeroTimestamp,
  retryAfterMs,
  summariseXeroMirror,
  xeroInvoiceUrl,
  xeroMoney,
  type XeroInvoicePayload,
  type XeroSnapshotInput,
} from '../lib/platform/xero-sync-shared.ts';

/**
 * The Xero sync's pure half, pinned against FIXTURES.
 *
 * NOTHING HERE HAS EVER TALKED TO XERO, by instruction and by design: no test in
 * this repo makes a network call, and the sync itself has not been run against a
 * live tenant by the wave that wrote it. The payloads below are hand-built to
 * Xero's published response shapes for
 * `GET /api.xro/2.0/Invoices` and `GET /api.xro/2.0/Contacts`, and the fields
 * they exercise are exactly the ones `xero-sync-shared.ts` documents itself as
 * relying on. If Xero's shape differs from this, THESE FIXTURES are the thing to
 * correct first — they are the specification this code was written against.
 *
 * THE .NET DATE IS THE HEADLINE. Xero answers `Accept: application/json` with
 * `/Date(1518685950940+0000)/`, not ISO-8601. A parser that quietly returned
 * null for those would produce a mirror with no dates at all, which every rule
 * downstream reads as "nothing is overdue" — a silent, total failure that looks
 * exactly like a well-behaved business. Hence the first block below.
 *
 * Relative, `.ts`-suffixed import: `node --test` cannot resolve the `@/` alias.
 */

const ORG = '00000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------------------
// Dates — Xero's .NET serialisation, and the ISO it also sometimes sends
// ---------------------------------------------------------------------------

test('a .NET date parses to the instant its millisecond count names', () => {
  // 1518685950940 ms = 2018-02-15T09:12:30.940Z
  assert.equal(parseXeroTimestamp('/Date(1518685950940+0000)/'), '2018-02-15T09:12:30.940Z');
});

test('the trailing offset is a rendering of the same instant, not a shift to apply', () => {
  // Xero renders the SAME millisecond count with a local offset on some
  // endpoints. Applying it would move every South African invoice two hours.
  assert.equal(
    parseXeroTimestamp('/Date(1518685950940+0200)/'),
    parseXeroTimestamp('/Date(1518685950940+0000)/'),
  );
});

test('a bare .NET date with no offset parses too', () => {
  assert.equal(parseXeroTimestamp('/Date(1518685950940)/'), '2018-02-15T09:12:30.940Z');
});

test('the ISO companions Xero sends (DateString, DueDateString) parse as well', () => {
  assert.equal(parseXeroTimestamp('2018-02-15T00:00:00Z'), '2018-02-15T00:00:00.000Z');
});

test('anything unreadable is null, never a guess', () => {
  for (const bad of [null, undefined, '', 'tomorrow', '/Date(banana)/', {}, []]) {
    assert.equal(parseXeroTimestamp(bad), null, `${JSON.stringify(bad)} must not parse`);
  }
});

test('parseXeroDay reduces to the calendar day, which is what every rule compares', () => {
  assert.equal(parseXeroDay('/Date(1518685950940+0000)/'), '2018-02-15');
  assert.equal(parseXeroDay(null), null);
});

test('an absent amount is null, not zero — "unknown" and "nothing" are different claims', () => {
  assert.equal(parseXeroAmount(null), null);
  assert.equal(parseXeroAmount(undefined), null);
  assert.equal(parseXeroAmount(''), null);
  assert.equal(parseXeroAmount('not a number'), null);
  assert.equal(parseXeroAmount(0), 0);
  assert.equal(parseXeroAmount(1234.56), 1234.56);
  assert.equal(parseXeroAmount('1234.56'), 1234.56);
});

// ---------------------------------------------------------------------------
// Invoice numbers — the prefix problem
// ---------------------------------------------------------------------------

test('normalising keeps letters and digits and drops everything else', () => {
  assert.equal(normaliseInvoiceNumber('INV-9268'), 'INV9268');
  assert.equal(normaliseInvoiceNumber('inv 9268'), 'INV9268');
  assert.equal(normaliseInvoiceNumber('  INV/9268  '), 'INV9268');
  assert.equal(normaliseInvoiceNumber(null), '');
});

test('"INV-9268" and "9268" are the same bill — the whole point of the second key', () => {
  // The supplier's paper carries the prefix; the same bill keyed into Xero by
  // hand often does not. Without this, every such pair reads as "not in Xero yet"
  // forever.
  assert.equal(invoiceNumbersMatch('INV-9268', '9268'), true);
  assert.equal(invoiceNumbersMatch('9268', 'INV-9268'), true, 'the match must be symmetric');
});

test('a short numeric tail does NOT create a second key — a false match is the expensive direction', () => {
  // "INV-12" → only "INV12". Two-digit tails collide with everything.
  assert.deepEqual(invoiceNumberKeys('INV-12'), ['INV12']);
  assert.equal(invoiceNumbersMatch('INV-12', '12'), false);
});

test('a purely numeric number yields exactly one key, not a duplicate of itself', () => {
  assert.deepEqual(invoiceNumberKeys('9268'), ['9268']);
});

test('the strict key is always first, so a caller can insist on it', () => {
  assert.equal(invoiceNumberKeys('INV-9268')[0], 'INV9268');
});

test('genuinely different numbers do not match', () => {
  assert.equal(invoiceNumbersMatch('INV-9268', 'INV-9269'), false);
  assert.equal(invoiceNumbersMatch('', 'INV-9268'), false);
  assert.equal(invoiceNumbersMatch(null, null), false);
});

// ---------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------

test('each ledger links into its own Xero screen', () => {
  assert.equal(
    xeroInvoiceUrl('ACCREC', 'abc-123'),
    'https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=abc-123',
  );
  assert.equal(
    xeroInvoiceUrl('ACCPAY', 'abc-123'),
    'https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=abc-123',
  );
});

test('a type this build does not mirror gets NO link rather than the wrong ledger', () => {
  assert.equal(xeroInvoiceUrl('ACCPAYCREDIT', 'abc-123'), null);
  assert.equal(xeroInvoiceUrl(null, 'abc-123'), null);
  assert.equal(xeroInvoiceUrl('ACCREC', ''), null);
});

// ---------------------------------------------------------------------------
// Mapping a page of Xero's Invoices response
// ---------------------------------------------------------------------------

/** One entry of Xero's `Invoices` array, as the API documents it. */
function invoicePayload(overrides: Partial<XeroInvoicePayload> = {}): XeroInvoicePayload {
  return {
    InvoiceID: '2a1b3c4d-0000-4000-8000-000000000001',
    Type: 'ACCREC',
    InvoiceNumber: 'INV-0042',
    Reference: 'PO 1188',
    Contact: { ContactID: 'c0000000-0000-4000-8000-000000000009', Name: 'Northern Suburbs Deli' },
    Date: '/Date(1755561600000+0000)/', // 2025-08-19
    DueDate: '/Date(1758153600000+0000)/', // 2025-09-18
    Status: 'AUTHORISED',
    Total: 11500,
    AmountDue: 11500,
    AmountPaid: 0,
    CurrencyCode: 'ZAR',
    UpdatedDateUTC: '/Date(1755561600000+0000)/',
    ...overrides,
  };
}

test('a well-formed invoice maps to a complete mirror row', () => {
  const row = mapXeroInvoice(invoicePayload(), ORG);
  assert.ok(row);
  assert.equal(row.org_id, ORG);
  assert.equal(row.xero_invoice_id, '2a1b3c4d-0000-4000-8000-000000000001');
  assert.equal(row.type, 'ACCREC');
  assert.equal(row.contact_id, 'c0000000-0000-4000-8000-000000000009');
  assert.equal(row.contact_name, 'Northern Suburbs Deli');
  assert.equal(row.invoice_number, 'INV-0042');
  assert.equal(row.reference, 'PO 1188');
  assert.equal(row.date, '2025-08-19');
  assert.equal(row.due_date, '2025-09-18');
  assert.equal(row.currency, 'ZAR');
  assert.equal(row.total, 11500);
  assert.equal(row.amount_due, 11500);
  assert.equal(row.amount_paid, 0);
  assert.equal(row.status, 'AUTHORISED');
  assert.equal(row.xero_url, 'https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=2a1b3c4d-0000-4000-8000-000000000001');
});

const REJECTED: Array<{ why: string; payload: XeroInvoicePayload | null }> = [
  { why: 'no id — there is nothing to key the mirror row on', payload: invoicePayload({ InvoiceID: '' }) },
  {
    why: 'a VOIDED bill is not a bill, and keeping it would let it duplicate its replacement',
    payload: invoicePayload({ Status: 'VOIDED' }),
  },
  { why: 'DELETED, likewise', payload: invoicePayload({ Status: 'DELETED' }) },
  {
    why: 'a credit note is not one of the two ledgers X1 mirrors',
    payload: invoicePayload({ Type: 'ACCPAYCREDIT' }),
  },
  { why: 'not an object at all', payload: null },
];

for (const c of REJECTED) {
  test(`an invoice is dropped when: ${c.why}`, () => {
    assert.equal(mapXeroInvoice(c.payload, ORG), null);
  });
}

test('type and status are read case-insensitively but STORED uppercase', () => {
  const row = mapXeroInvoice(invoicePayload({ Type: 'accpay', Status: 'authorised' }), ORG);
  assert.ok(row);
  assert.equal(row.type, 'ACCPAY');
  assert.equal(row.status, 'AUTHORISED');
});

test('blank strings become null, so a mirror row never carries an empty name', () => {
  const row = mapXeroInvoice(
    invoicePayload({ InvoiceNumber: '   ', Reference: '', Contact: { ContactID: '', Name: '' } }),
    ORG,
  );
  assert.ok(row);
  assert.equal(row.invoice_number, null);
  assert.equal(row.reference, null);
  assert.equal(row.contact_id, null);
  assert.equal(row.contact_name, null);
});

test('a page maps every mirrorable row and silently drops the rest', () => {
  const rows = mapXeroInvoicePage(
    {
      Invoices: [
        invoicePayload({ InvoiceID: 'a' }),
        invoicePayload({ InvoiceID: 'b', Status: 'VOIDED' }),
        invoicePayload({ InvoiceID: 'c', Type: 'ACCPAY' }),
      ],
    },
    ORG,
  );
  assert.deepEqual(rows.map((r) => r.xero_invoice_id), ['a', 'c']);
});

test('a response with no Invoices array is an empty page, not a crash', () => {
  assert.deepEqual(mapXeroInvoicePage({}, ORG), []);
  assert.deepEqual(mapXeroInvoicePage(null, ORG), []);
  assert.deepEqual(mapXeroInvoicePage({ Invoices: null }, ORG), []);
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

test('a contact maps, and the two flags are coerced rather than trusted', () => {
  const row = mapXeroContact(
    {
      ContactID: 'c-1',
      Name: 'Umgeni Fresh Produce',
      EmailAddress: 'accounts@example.test',
      IsSupplier: true,
      // Xero omits IsCustomer on some responses. `undefined` is not "yes".
      UpdatedDateUTC: '/Date(1755561600000+0000)/',
    },
    ORG,
  );
  assert.ok(row);
  assert.equal(row.xero_contact_id, 'c-1');
  assert.equal(row.name, 'Umgeni Fresh Produce');
  assert.equal(row.email, 'accounts@example.test');
  assert.equal(row.is_supplier, true);
  assert.equal(row.is_customer, false);
  assert.equal(row.updated_date_utc, '2025-08-19T00:00:00.000Z');
});

test('a truthy-but-not-true flag does not become true', () => {
  // Guarding against a response that sends "true" as a string.
  const row = mapXeroContact({ ContactID: 'c-2', IsSupplier: 'true' }, ORG);
  assert.ok(row);
  assert.equal(row.is_supplier, false);
});

test('a contact with no id is dropped', () => {
  assert.equal(mapXeroContact({ Name: 'Nobody' }, ORG), null);
  assert.equal(mapXeroContact(null, ORG), null);
  assert.deepEqual(mapXeroContactPage({ Contacts: [{ Name: 'Nobody' }] }, ORG), []);
});

// ---------------------------------------------------------------------------
// Talking to the API politely
// ---------------------------------------------------------------------------

test('If-Modified-Since is Xero’s format: UTC, no zone suffix, no milliseconds', () => {
  // NOT RFC-1123. Xero answers a full resync for anything it cannot parse, which
  // is expensive rather than wrong — exactly the bug that hides for months.
  assert.equal(ifModifiedSinceHeader('2026-08-19T03:20:00.000Z'), '2026-08-19T03:20:00');
});

test('no cursor, or an unreadable one, sends no header at all', () => {
  assert.equal(ifModifiedSinceHeader(null), null);
  assert.equal(ifModifiedSinceHeader(''), null);
  assert.equal(ifModifiedSinceHeader('whenever'), null);
});

test('Retry-After is honoured when Xero gives a sane one', () => {
  assert.equal(retryAfterMs('5', 0), 5_000);
  assert.equal(retryAfterMs(' 12 ', 2), 12_000);
});

test('an absurd Retry-After is capped — a cron must not sleep through its budget', () => {
  // Xero can quote a daily-limit retry in the tens of thousands of seconds.
  assert.equal(retryAfterMs('86400', 0), MAX_RETRY_WAIT_MS);
});

test('a missing or unreadable Retry-After backs off exponentially, also capped', () => {
  assert.equal(retryAfterMs(null, 0), 1_000);
  assert.equal(retryAfterMs(undefined, 1), 2_000);
  assert.equal(retryAfterMs('soon', 2), 4_000);
  assert.equal(retryAfterMs(null, 20), MAX_RETRY_WAIT_MS);
});

test('a zero or negative Retry-After falls through to the back-off', () => {
  assert.equal(retryAfterMs('0', 0), 1_000);
  assert.equal(retryAfterMs('-5', 0), 1_000);
});

// ---------------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------------

const TODAY = '2026-08-19';

function mirrorRow(overrides: Partial<XeroSnapshotInput> = {}): XeroSnapshotInput {
  return {
    type: 'ACCREC',
    status: 'AUTHORISED',
    due_date: '2026-08-01',
    amount_due: 10_000,
    currency: 'ZAR',
    contact_id: 'c-1',
    contact_name: 'Acme Trading',
    ...overrides,
  };
}

test('an empty mirror is all zeroes and no currency — never a fabricated figure', () => {
  const s = summariseXeroMirror([], TODAY);
  assert.equal(s.currency, null);
  assert.equal(s.receivablesOutstanding, 0);
  assert.equal(s.payablesOutstanding, 0);
  assert.deepEqual(s.topDebtors, []);
  assert.equal(s.invoicesMirrored, 0);
});

test('only AUTHORISED invoices carry money anyone is owed', () => {
  const s = summariseXeroMirror(
    [
      mirrorRow({ status: 'DRAFT' }),
      mirrorRow({ status: 'SUBMITTED' }),
      mirrorRow({ status: 'PAID', amount_due: 0 }),
      mirrorRow({ status: 'AUTHORISED' }),
    ],
    TODAY,
  );
  assert.equal(s.receivablesOutstanding, 10_000);
  assert.equal(s.receivablesOverdueCount, 1);
});

test('a sub-cent balance is a VAT rounding artefact, not money', () => {
  const s = summariseXeroMirror([mirrorRow({ amount_due: 0.001 })], TODAY);
  assert.equal(s.receivablesOutstanding, 0);
});

test('an invoice with no due date is outstanding but never overdue', () => {
  const s = summariseXeroMirror([mirrorRow({ due_date: null })], TODAY);
  assert.equal(s.receivablesOutstanding, 10_000);
  assert.equal(s.receivablesOverdue, 0);
  assert.equal(s.receivablesOverdueCount, 0);
});

test('due TODAY is not yet late', () => {
  const s = summariseXeroMirror([mirrorRow({ due_date: TODAY })], TODAY);
  assert.equal(s.receivablesOverdueCount, 0);
});

test('payables split into overdue and due-within-seven-days, and never both', () => {
  const s = summariseXeroMirror(
    [
      mirrorRow({ type: 'ACCPAY', due_date: '2026-08-10', amount_due: 4_000 }), // 9 days late
      mirrorRow({ type: 'ACCPAY', due_date: '2026-08-22', amount_due: 3_000 }), // in 3 days
      mirrorRow({ type: 'ACCPAY', due_date: '2026-08-26', amount_due: 2_000 }), // in 7 days
      mirrorRow({ type: 'ACCPAY', due_date: '2026-09-30', amount_due: 9_000 }), // far out
    ],
    TODAY,
  );
  assert.equal(s.payablesOutstanding, 18_000);
  assert.equal(s.payablesOverdue, 4_000);
  assert.equal(s.payablesOverdueCount, 1);
  assert.equal(s.payablesDueSoon, 5_000, 'the 3-day and the 7-day bills, and nothing else');
  assert.equal(s.payablesDueSoonCount, 2);
});

test('debtors are grouped by contact, worst first, with the oldest lateness kept', () => {
  const s = summariseXeroMirror(
    [
      mirrorRow({ contact_id: 'c-1', contact_name: 'Acme', due_date: '2026-08-01', amount_due: 5_000 }),
      mirrorRow({ contact_id: 'c-1', contact_name: 'Acme', due_date: '2026-07-01', amount_due: 3_000 }),
      mirrorRow({ contact_id: 'c-2', contact_name: 'Bravo', due_date: '2026-08-15', amount_due: 20_000 }),
    ],
    TODAY,
  );
  assert.equal(s.topDebtors.length, 2);
  assert.equal(s.topDebtors[0].contactName, 'Bravo');
  assert.equal(s.topDebtors[0].amount, 20_000);
  assert.equal(s.topDebtors[1].contactName, 'Acme');
  assert.equal(s.topDebtors[1].amount, 8_000);
  assert.equal(s.topDebtors[1].invoiceCount, 2);
  assert.equal(s.topDebtors[1].oldestDaysOverdue, daysBetweenDays('2026-07-01', TODAY));
});

test('contactless invoices are grouped by NAME, not lumped under one blank heading', () => {
  const s = summariseXeroMirror(
    [
      mirrorRow({ contact_id: null, contact_name: 'Cash sale A' }),
      mirrorRow({ contact_id: null, contact_name: 'Cash sale B' }),
    ],
    TODAY,
  );
  assert.equal(s.topDebtors.length, 2);
});

test('a mixed-currency mirror totals ONE currency and names what it left out', () => {
  // Vyso holds no exchange rates. Adding USD to ZAR would produce a figure that
  // exists nowhere, and being wrong by an invisible amount is the worst answer.
  const s = summariseXeroMirror(
    [
      mirrorRow({ currency: 'ZAR', amount_due: 1_000 }),
      mirrorRow({ currency: 'ZAR', amount_due: 2_000 }),
      mirrorRow({ currency: 'USD', amount_due: 500_000 }),
    ],
    TODAY,
  );
  assert.equal(s.currency, 'ZAR');
  assert.equal(s.receivablesOutstanding, 3_000);
  assert.deepEqual(s.excludedCurrencies, [{ currency: 'USD', invoiceCount: 1 }]);
  assert.equal(s.invoicesMirrored, 2);
});

test('rows with no currency at all ride with the dominant one — Xero omits it on single-currency orgs', () => {
  const s = summariseXeroMirror(
    [mirrorRow({ currency: 'ZAR', amount_due: 1_000 }), mirrorRow({ currency: null, amount_due: 2_000 })],
    TODAY,
  );
  assert.equal(s.currency, 'ZAR');
  assert.equal(s.receivablesOutstanding, 3_000);
  assert.deepEqual(s.excludedCurrencies, []);
});

test('ZAR is formatted exactly as every other rand figure in the product', () => {
  assert.equal(xeroMoney(190_900, 'ZAR'), xeroMoney(190_900, null));
  assert.match(xeroMoney(190_900, 'ZAR'), /^R\s/);
});

test('a foreign currency is named rather than given a symbol this product would get wrong', () => {
  // en-ZA groups thousands with a NON-BREAKING space (U+00A0), not a comma —
  // spelled out here so the expectation is readable rather than hiding an
  // invisible codepoint inside a string literal (the same note
  // tests/debtors-watch-detect.test.ts carries).
  const NB = '\u00A0';
  assert.equal(xeroMoney(12_400, 'USD'), `USD 12${NB}400`);
});

test('a null figure is an em dash, not R0', () => {
  assert.equal(xeroMoney(null, 'ZAR'), '—');
});
