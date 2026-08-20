import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canPrintTaxInvoice,
  mapExtractionToSheet,
  parseNumeric,
  resolveVatRate,
} from '../lib/platform/docu/invoice-from-extraction.ts';
import { docTotals } from '../lib/platform/orderflow.ts';
import type { ExtractedField, ExtractedLineItem } from '../lib/platform/types.ts';
import type { DocumentDirectionRecord } from '../lib/platform/docu/document-direction.ts';

const field = (label: string, value: string, confidence = 96): ExtractedField => ({ label, value, confidence });
const line = (l: Partial<ExtractedLineItem>): ExtractedLineItem => ({ description: '', confidence: 90, ...l });

/** The Turn 'n Slice invoice that started all this: TnS letterhead, billed to Investec. */
const TNS_DIRECTION: DocumentDirectionRecord = {
  direction: 'outgoing',
  matched_on: 'legal_name',
  issuer_as_read: 'Turn n Slice HQ (Pty) Ltd',
  counterparty_as_read: 'Investec Bank Limited',
  customer_id: null,
  customer_name: null,
  miss_reason: 'below_threshold',
  note: 'Outgoing invoice — customer not recognised',
};

// ---------------------------------------------------------------------------
// Money parsing — the same rule the extraction editor's running total uses, so
// the sheet and the editor cannot disagree about what a line is worth.
// ---------------------------------------------------------------------------
test('money strings parse the way the editor parses them', () => {
  assert.equal(parseNumeric('R 1,530.00'), 1530);
  assert.equal(parseNumeric('102.00'), 102);
  assert.equal(parseNumeric(''), 0);
  assert.equal(parseNumeric(null), 0);
  assert.equal(parseNumeric('n/a'), 0);
});

// ---------------------------------------------------------------------------
// Lines — the amount column is the authority
// ---------------------------------------------------------------------------
test('a missing rate is derived from the amount', () => {
  const [l] = mapExtractionToSheet({
    lineItems: [line({ description: 'Croissants', quantity: '12', amount: '102.00' })],
  }).lines;
  assert.equal(l.qty, 12);
  assert.equal(l.unit_price, 8.5);
});

test('when qty × rate disagrees with the printed amount, the amount wins', () => {
  const [l] = mapExtractionToSheet({
    lineItems: [line({ description: 'Danish', quantity: '10', unit_price: '5.00', amount: '60.00' })],
  }).lines;
  assert.equal(l.qty, 10);
  assert.equal(l.unit_price, 6, 'the reprint must total what the original totalled');
  assert.equal(l.qty * l.unit_price, 60);
});

test('a line that already agrees is left exactly alone', () => {
  const [l] = mapExtractionToSheet({
    lineItems: [line({ description: 'Rolls', quantity: '3', unit_price: '4.00', amount: '12.00' })],
  }).lines;
  assert.equal(l.unit_price, 4);
});

test('a line with no quantity prints as one of whatever it is', () => {
  const [l] = mapExtractionToSheet({
    lineItems: [line({ description: 'Delivery', amount: '75.00' })],
  }).lines;
  assert.equal(l.qty, 1);
  assert.equal(l.unit_price, 75);
});

test('the unit comes through, or is null rather than empty', () => {
  const { lines } = mapExtractionToSheet({
    lineItems: [
      line({ description: 'Tomatoes', quantity: '4', unit: 'box', unit_price: '90' }),
      line({ description: 'Loose leaves', quantity: '2', unit: '  ', unit_price: '10' }),
    ],
  });
  assert.equal(lines[0].unit, 'box');
  assert.equal(lines[1].unit, null);
});

test('blank padding rows are dropped, priced ones are kept', () => {
  const sheet = mapExtractionToSheet({
    lineItems: [
      line({ description: 'Croissants', quantity: '12', unit_price: '8.50' }),
      line({ description: '   ' }),
      line({ description: '', amount: '20.00' }),
    ],
  });
  assert.equal(sheet.lines.length, 2);
  assert.equal(sheet.pricedLineCount, 2);
});

test('unpriced lines count as unpriced — a delivery note is not a tax invoice', () => {
  const sheet = mapExtractionToSheet({
    lineItems: [line({ description: 'Crates returned', quantity: '6' })],
  });
  assert.equal(sheet.lines.length, 1);
  assert.equal(sheet.pricedLineCount, 0);
  assert.equal(canPrintTaxInvoice('invoice', sheet), false, 'nothing priced ⇒ no button');
  assert.equal(canPrintTaxInvoice('delivery_note', { pricedLineCount: 4 }), false);
  assert.equal(canPrintTaxInvoice('invoice', { pricedLineCount: 4 }), true);
  assert.equal(canPrintTaxInvoice(null, { pricedLineCount: 4 }), false);
});

// ---------------------------------------------------------------------------
// VAT — recovered from the document, not assumed from the org's default
// ---------------------------------------------------------------------------
const RATED_LINES = [{ id: 'x0', name: 'Croissants', qty: 1200, unit: null, unit_price: 8.5 }]; // 10 200.00

test('a printed VAT amount recovers the rate the document actually charged', () => {
  const r = resolveVatRate([field('VAT', 'R 1,530.00')], RATED_LINES, 15);
  assert.deepEqual(r, { rate: 15, source: 'document' });
});

test('a rounding-noise rate snaps to the org default rather than printing 14.97%', () => {
  const r = resolveVatRate([field('VAT', '1528.00')], RATED_LINES, 15);
  assert.equal(r.rate, 15);
  assert.equal(r.source, 'document');
});

test('a zero-rated invoice stays zero-rated even when the org default is 15', () => {
  const r = resolveVatRate([field('VAT', 'R 0.00')], RATED_LINES, 15);
  assert.deepEqual(r, { rate: 0, source: 'document' });
});

test('an explicit rate field is taken at its word', () => {
  assert.deepEqual(resolveVatRate([field('VAT Rate', '15%')], RATED_LINES, 0), { rate: 15, source: 'document' });
});

test('a silent document falls back to the org default, and says so', () => {
  assert.deepEqual(resolveVatRate([], RATED_LINES, 15), { rate: 15, source: 'default' });
});

test('a VAT REGISTRATION number is never mistaken for a VAT amount', () => {
  const r = resolveVatRate([field('VAT Number', '4123456789')], RATED_LINES, 15);
  assert.deepEqual(r, { rate: 15, source: 'default' });
});

test('an implausible derived rate is refused in favour of the default', () => {
  const r = resolveVatRate([field('Tax', '9000.00')], RATED_LINES, 15);
  assert.deepEqual(r, { rate: 15, source: 'default' });
});

// ---------------------------------------------------------------------------
// Header fields — label discrimination, and honest gaps
// ---------------------------------------------------------------------------
test('"Invoice No" is the number and "Invoice Date" is the date — never each other', () => {
  const { invoice, missing } = mapExtractionToSheet({
    fields: [
      field('Invoice Date', '2026-08-14'),
      field('Invoice No', 'INV-10428'),
      field('Due Date', '2026-09-13'),
      field('P.O. No.', 'PO-7781'),
    ],
  });
  assert.equal(invoice.number, 'INV-10428');
  assert.equal(invoice.issueDate, '2026-08-14');
  assert.equal(invoice.dueDate, '2026-09-13');
  assert.equal(invoice.customerPo, 'PO-7781');
  assert.deepEqual(missing, []);
});

test('a products-only extraction reports its gaps rather than inventing a number', () => {
  const { invoice, missing } = mapExtractionToSheet({
    lineItems: [line({ description: 'Croissants', quantity: '12', unit_price: '8.50' })],
  });
  assert.equal(invoice.number, '');
  assert.equal(invoice.issueDate, '');
  assert.deepEqual(missing, ['number', 'date']);
});

test('a blank field value counts as absent', () => {
  const { missing } = mapExtractionToSheet({ fields: [field('Invoice Number', '   ')] });
  assert.deepEqual(missing, ['number', 'date']);
});

// ---------------------------------------------------------------------------
// Parties — what the PAPER said. Which one is the seller is the caller's call.
// ---------------------------------------------------------------------------
test('an outgoing document reports its issuer and the party it billed', () => {
  const sheet = mapExtractionToSheet({ direction: TNS_DIRECTION, lineItems: [] });
  assert.equal(sheet.issuerName, 'Turn n Slice HQ (Pty) Ltd');
  assert.equal(sheet.billToName, 'Investec Bank Limited');
});

test('a MATCHED customer name outranks the unverified name on the paper', () => {
  const sheet = mapExtractionToSheet({
    direction: { ...TNS_DIRECTION, customer_id: 'c1', customer_name: 'Investec Bank Ltd' },
  });
  assert.equal(sheet.billToName, 'Investec Bank Ltd');
});

test('an incoming document reports the supplier as issuer and its bill_to as billed', () => {
  const sheet = mapExtractionToSheet({ supplierName: 'Bacca Valley (Pty) Ltd', billTo: "Turn 'n Slice" });
  assert.equal(sheet.issuerName, 'Bacca Valley (Pty) Ltd');
  assert.equal(sheet.billToName, "Turn 'n Slice");
});

test("the issuer's VAT registration is picked up when the document printed one", () => {
  const sheet = mapExtractionToSheet({ fields: [field('VAT Reg No', '4123456789')] });
  assert.equal(sheet.issuerVat, '4123456789');
});

// ---------------------------------------------------------------------------
// End to end: the mapped lines must total, through docTotals, what the
// document itself printed. This is the whole point of the amount-first rule.
// ---------------------------------------------------------------------------
test('docTotals over the mapped lines reproduces the document total', () => {
  const sheet = mapExtractionToSheet({
    fields: [field('Invoice No', 'INV-10428'), field('Invoice Date', '2026-08-14'), field('VAT', '1530.00')],
    lineItems: [
      line({ description: 'Croissants', quantity: '600', unit_price: '8.50', amount: '5100.00' }),
      // Deliberately inconsistent: 600 × 8.49 = 5094, but the paper says 5100.
      line({ description: 'Pain au chocolat', quantity: '600', unit_price: '8.49', amount: '5100.00' }),
    ],
    direction: TNS_DIRECTION,
    defaultVatRate: 15,
  });

  const totals = docTotals(sheet.lines, sheet.vatRate);
  assert.equal(totals.subtotal, 10200);
  assert.equal(totals.vat, 1530);
  assert.equal(totals.total, 11730);
  assert.equal(sheet.vatRateSource, 'document');
});
