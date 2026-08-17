import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDebtorFindings,
  buildDebtorsDedupeKey,
  parseDebtorsDedupeKey,
  DAYS_OVERDUE_FLOOR,
  OUTSTANDING_FLOOR,
  OVERDUE_COUNT_FLOOR,
  type DebtorInvoice,
} from '../lib/platform/debtors-watch/detect.ts';

// "Today" for every case below. 2026-08-17 is the date supabase/demo-refresh-2026-08.sql
// carries the Meridian workspace forward to, so the MERIDIAN fixture at the
// bottom of this file produces exactly the days-late figures that file's header
// documents (40 / 32 / 37 / 31 / 33) rather than a set this test invented.
const TODAY = '2026-08-17';

/**
 * en-ZA groups thousands with a NON-BREAKING space (U+00A0), not a comma, and
 * `rand()` (lib/platform/procurepulse.ts) formats every rand figure in this
 * product through `toLocaleString('en-ZA')`. The detector reuses it rather than
 * inventing a second money format, so its observations carry that character.
 * It is spelled out here so these expectations are readable instead of hiding an
 * invisible codepoint inside a string literal.
 */
const NB = '\u00A0';
/** "R 190 900", exactly as `rand()` renders it. */
function zar(whole: number): string {
  // Grouped by hand from the digits, so the expectation does not simply re-run
  // the formatter it is checking.
  return `R ${String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NB)}`;
}

function daysBefore(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

let seq = 0;
function invoice(overrides: Partial<DebtorInvoice> = {}): DebtorInvoice {
  seq += 1;
  return {
    invoiceId: `inv-${String(seq).padStart(4, '0')}`,
    invoiceNumber: `INV-${1000 + seq}`,
    customerId: 'cust-1',
    customerName: 'Acme Trading',
    dueDate: daysBefore(TODAY, 40),
    balance: 10_000,
    open: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The two thresholds, one row per branch
// ---------------------------------------------------------------------------

const THRESHOLD_CASES: Array<{
  name: string;
  invoices: DebtorInvoice[];
  fires: boolean;
}> = [
  {
    name: `${DAYS_OVERDUE_FLOOR} days + R${OUTSTANDING_FLOOR} fires (rule a, exactly on the line)`,
    invoices: [invoice({ dueDate: daysBefore(TODAY, DAYS_OVERDUE_FLOOR), balance: OUTSTANDING_FLOOR })],
    fires: true,
  },
  {
    name: 'one day under the days floor does not fire',
    invoices: [invoice({ dueDate: daysBefore(TODAY, DAYS_OVERDUE_FLOOR - 1), balance: 100_000 })],
    fires: false,
  },
  {
    name: 'one rand under the money floor does not fire',
    invoices: [invoice({ dueDate: daysBefore(TODAY, 90), balance: OUTSTANDING_FLOOR - 1 })],
    fires: false,
  },
  {
    name: `${OVERDUE_COUNT_FLOOR} small, barely-late invoices fire on their own (rule b)`,
    invoices: [
      invoice({ dueDate: daysBefore(TODAY, 3), balance: 400 }),
      invoice({ dueDate: daysBefore(TODAY, 2), balance: 300 }),
      invoice({ dueDate: daysBefore(TODAY, 1), balance: 200 }),
    ],
    fires: true,
  },
  {
    name: 'two small, barely-late invoices do not',
    invoices: [
      invoice({ dueDate: daysBefore(TODAY, 3), balance: 400 }),
      invoice({ dueDate: daysBefore(TODAY, 2), balance: 300 }),
    ],
    fires: false,
  },
  {
    name: 'an invoice due TODAY is not late',
    invoices: [invoice({ dueDate: TODAY, balance: 500_000 })],
    fires: false,
  },
  {
    name: 'an invoice with no due date has no terms to be past',
    invoices: [invoice({ dueDate: null, balance: 500_000 })],
    fires: false,
  },
  {
    name: 'a settled invoice (open: false) is not chased, however old',
    invoices: [invoice({ dueDate: daysBefore(TODAY, 400), balance: 500_000, open: false })],
    fires: false,
  },
  {
    name: 'a zero balance is not money owed (credit note / full payment)',
    invoices: [invoice({ dueDate: daysBefore(TODAY, 400), balance: 0 })],
    fires: false,
  },
  {
    name: 'a half-cent rounding remainder is not money owed either',
    invoices: [invoice({ dueDate: daysBefore(TODAY, 400), balance: 0.004 })],
    fires: false,
  },
];

for (const c of THRESHOLD_CASES) {
  test(`detectDebtorFindings: ${c.name}`, () => {
    const found = detectDebtorFindings(c.invoices, TODAY);
    assert.equal(found.length, c.fires ? 1 : 0);
  });
}

// ---------------------------------------------------------------------------
// Aggregation, wording and the dedupe key
// ---------------------------------------------------------------------------

test('detectDebtorFindings: sums only the OVERDUE invoices, not the whole account', () => {
  const [f] = detectDebtorFindings(
    [
      invoice({ dueDate: daysBefore(TODAY, 40), balance: 101_200 }),
      invoice({ dueDate: daysBefore(TODAY, 32), balance: 89_700 }),
      // Not yet due — real money on the account, but not late money.
      invoice({ dueDate: daysBefore(TODAY, -7), balance: 250_000 }),
    ],
    TODAY,
  );
  assert.equal(f.outstanding, 190_900);
  assert.equal(f.overdueCount, 2);
  assert.equal(f.maxDaysOverdue, 40);
});

test('detectDebtorFindings: the observation states the customer, the days, the count and the rand', () => {
  const [f] = detectDebtorFindings(
    [
      invoice({
        customerName: 'Northern Suburbs Supply',
        dueDate: daysBefore(TODAY, 40),
        balance: 101_200,
      }),
      invoice({
        customerName: 'Northern Suburbs Supply',
        dueDate: daysBefore(TODAY, 32),
        balance: 89_700,
      }),
    ],
    TODAY,
  );
  assert.equal(
    f.observation,
    `Northern Suburbs Supply is 40 days past terms on 2 invoices — ${zar(190_900)} outstanding.`,
  );
  // Drafts only: a sentence, never an action.
  assert.equal(f.recommendedAction, 'Send a statement and hold new orders until paid');
  assert.equal(f.randImpact, 190_900);
});

test('detectDebtorFindings: singular invoice reads "1 invoice"', () => {
  const [f] = detectDebtorFindings(
    [invoice({ customerName: 'Rooiberg Function Services', dueDate: daysBefore(TODAY, 33), balance: 48_300 })],
    TODAY,
  );
  assert.equal(
    f.observation,
    `Rooiberg Function Services is 33 days past terms on 1 invoice — ${zar(48_300)} outstanding.`,
  );
});

test('detectDebtorFindings: the dedupe key names the customer and their OLDEST overdue invoice', () => {
  const older = invoice({ invoiceId: 'inv-oldest', dueDate: daysBefore(TODAY, 40), balance: 101_200 });
  const newer = invoice({ invoiceId: 'inv-newer', dueDate: daysBefore(TODAY, 32), balance: 89_700 });
  // Row order must not change the key — Postgres makes no promise about it.
  const a = detectDebtorFindings([older, newer], TODAY)[0];
  const b = detectDebtorFindings([newer, older], TODAY)[0];
  assert.equal(a.dedupeKey, b.dedupeKey);
  assert.equal(a.dedupeKey, buildDebtorsDedupeKey('cust-1', 'inv-oldest'));
  assert.deepEqual(parseDebtorsDedupeKey(a.dedupeKey), {
    customerId: 'cust-1',
    oldestInvoiceId: 'inv-oldest',
  });
  // Evidence is every overdue invoice, worst first.
  assert.deepEqual(a.evidenceInvoiceIds, ['inv-oldest', 'inv-newer']);
});

const BAD_KEYS = [
  '',
  'debtors_watch',
  'debtors_watch:cust-1',
  'debtors_watch:cust-1:inv-1:extra',
  'price_watch:cust-1:inv-1',
  'debtors_watch::inv-1',
];
for (const key of BAD_KEYS) {
  test(`parseDebtorsDedupeKey: refuses to half-read ${JSON.stringify(key)}`, () => {
    assert.equal(parseDebtorsDedupeKey(key), null);
  });
}

test('detectDebtorFindings: one finding per customer, worst first', () => {
  const found = detectDebtorFindings(
    [
      invoice({ customerId: 'c-rooiberg', customerName: 'Rooiberg', dueDate: daysBefore(TODAY, 33), balance: 48_300 }),
      invoice({ customerId: 'c-northern', customerName: 'Northern', dueDate: daysBefore(TODAY, 40), balance: 101_200 }),
      invoice({ customerId: 'c-northern', customerName: 'Northern', dueDate: daysBefore(TODAY, 32), balance: 89_700 }),
      invoice({ customerId: 'c-swartland', customerName: 'Swartland', dueDate: daysBefore(TODAY, 37), balance: 64_400 }),
    ],
    TODAY,
  );
  assert.deepEqual(
    found.map((f) => [f.customerName, f.maxDaysOverdue]),
    [
      ['Northern', 40],
      ['Swartland', 37],
      ['Rooiberg', 33],
    ],
  );
});

test('detectDebtorFindings: nothing in, nothing out (an empty book is not a finding)', () => {
  assert.deepEqual(detectDebtorFindings([], TODAY), []);
});

// ---------------------------------------------------------------------------
// MERIDIAN — the five late payers written by supabase/demo-refresh-2026-08.sql
// §2.6, at the totals and due dates its header table states. This is the fixture
// the final report quotes: what the owner actually sees on 2026-08-17.
// ---------------------------------------------------------------------------

const MERIDIAN: DebtorInvoice[] = [
  { invoiceId: 'inv-13187', invoiceNumber: 'INV-13187', customerId: 'cust-08', customerName: 'Northern Suburbs Supply',   dueDate: '2026-07-08', balance: 101_200, open: true },
  { invoiceId: 'inv-13188', invoiceNumber: 'INV-13188', customerId: 'cust-08', customerName: 'Northern Suburbs Supply',   dueDate: '2026-07-16', balance:  89_700, open: true },
  { invoiceId: 'inv-13189', invoiceNumber: 'INV-13189', customerId: 'cust-12', customerName: 'Swartland Trade Co.',       dueDate: '2026-07-11', balance:  64_400, open: true },
  { invoiceId: 'inv-13190', invoiceNumber: 'INV-13190', customerId: 'cust-12', customerName: 'Swartland Trade Co.',       dueDate: '2026-07-17', balance:  56_350, open: true },
  { invoiceId: 'inv-13191', invoiceNumber: 'INV-13191', customerId: 'cust-14', customerName: 'Rooiberg Function Services', dueDate: '2026-07-15', balance:  48_300, open: true },
];

test('detectDebtorFindings: Meridian on 2026-08-17 reads exactly as the seed documents it', () => {
  const found = detectDebtorFindings(MERIDIAN, TODAY);
  assert.deepEqual(
    found.map((f) => f.observation),
    [
      `Northern Suburbs Supply is 40 days past terms on 2 invoices — ${zar(190_900)} outstanding.`,
      `Swartland Trade Co. is 37 days past terms on 2 invoices — ${zar(120_750)} outstanding.`,
      `Rooiberg Function Services is 33 days past terms on 1 invoice — ${zar(48_300)} outstanding.`,
    ],
  );
  assert.deepEqual(
    found.map((f) => f.dedupeKey),
    [
      'debtors_watch:cust-08:inv-13187',
      'debtors_watch:cust-12:inv-13189',
      'debtors_watch:cust-14:inv-13191',
    ],
  );
  assert.deepEqual(found.map((f) => f.randImpact), [190_900, 120_750, 48_300]);
});
