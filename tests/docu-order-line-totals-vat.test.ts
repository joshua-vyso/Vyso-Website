import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countGrossMismatches,
  grossMismatch,
  lineSeparatorHint,
  lineTax,
  lineTotal,
  reconcileDocumentTotals,
} from '../lib/platform/docu/order-line-totals.ts';
import { coerceOrderExtraction } from '../lib/ai/order-prompt.ts';
import type { ExtractedData } from '../lib/platform/types.ts';

// ---------------------------------------------------------------------------
// The Montecasino order, and the false red it produced.
//
// That document prints THREE money columns on every row — Nett 338.00, VAT
// 50.70, Total 388.70 — and the order prompt used to ask for "the row's own
// amount/nett/value column", which on that page names three different numbers.
// A reader that put the inclusive 388.70 in `raw_amount` (a defensible reading
// of the old wording) turned a perfectly correct line into a red one: 1 × 338.00
// is not 388.70, and the screen said so in the same voice it uses for a
// genuinely transposed digit.
//
// That is worse than no check at all. The reviewer's whole job on this screen is
// to look where we point, and pointing at correct rows is how they stop looking
// — the exact way the Bakubung 560.90/569.90 misread got through in the first
// place.
//
// The fix is not a tolerance. It is asking the row TWO questions instead of one,
// off three named columns, and saying WHICH one failed. See order-line-totals.ts.
// ---------------------------------------------------------------------------

/** The Montecasino line, correctly read: 1 @ 338.00 net, 15% VAT, 388.70 incl. */
const vatLine = {
  quantity: '1',
  unit_price: '338.00',
  raw_amount: '338.00',
  raw_tax_amount: '50.70',
  raw_total_amount: '388.70',
};

/** A zero-rated row from the same document: 10 × 12.50, no VAT column at all. */
const zeroTaxLine = { quantity: '10', unit_price: '12.50', raw_amount: '125.00' };

// --- the row's two questions -----------------------------------------------

test('a correctly read VAT row raises nothing — the false red is gone', () => {
  assert.equal(grossMismatch(vatLine), null);
});

test('a row with no VAT column at all is checked exactly as it always was', () => {
  // The legacy single-amount line. Most orders are entirely this shape, and
  // nothing about them may change.
  assert.equal(grossMismatch(zeroTaxLine), null);
  assert.equal(grossMismatch({ quantity: '2', unit_price: '335.00', raw_amount: '670.00' }), null);
  // …and it still fires when it should.
  const off = grossMismatch({ quantity: '1', unit_price: '560.90', raw_amount: '569.90' });
  assert.ok(off);
  assert.equal(off.reason, 'line_math');
});

test('a row printing an explicit zero VAT reconciles on both questions', () => {
  // "0.00" is a READ zero, not an absent column — and net + 0 must still reach
  // the printed total or the row has a real problem.
  assert.equal(
    grossMismatch({ ...zeroTaxLine, raw_tax_amount: '0.00', raw_total_amount: '125.00' }),
    null,
  );
});

test('a wrong NET is line_math, and quotes the two figures that disagree', () => {
  // The net is where quantity × unit price has to land. 1 × 338.00 against a
  // printed net of 340.00 is a misread digit somewhere in the row.
  const off = grossMismatch({ ...vatLine, raw_amount: '340.00' });
  assert.ok(off, 'a wrong net must not pass because the VAT happens to be printed');
  assert.equal(off.reason, 'line_math');
  assert.equal(off.paper, 340, 'the paper figure quoted is the NET, never the inclusive total');
  assert.equal(off.gross, 338);
  assert.equal(off.difference, -2);
});

test('a wrong TOTAL is vat_total — a different failure, in a different column', () => {
  // The row's own arithmetic is fine (1 × 338.00 = the printed net); what does
  // not add up is 338.00 + 50.70 against a printed total of 380.00. Sending the
  // reviewer to the qty/price columns for this would be sending them to the
  // wrong half of the row.
  const off = grossMismatch({ ...vatLine, raw_total_amount: '380.00' });
  assert.ok(off);
  assert.equal(off.reason, 'vat_total');
  assert.equal(off.paper, 380, 'the paper figure quoted is the printed TOTAL');
  assert.equal(off.gross, 388.7, 'against what net + VAT actually comes to');
  assert.equal(off.difference, 8.7);
  assert.equal(off.tax, 50.7, 'the row VAT rides along so the screen need not re-parse it');
});

test('a wrong VAT is also vat_total — the sum is what broke, not the line', () => {
  const off = grossMismatch({ ...vatLine, raw_tax_amount: '5.07' });
  assert.ok(off);
  assert.equal(off.reason, 'vat_total');
  assert.equal(off.gross, 343.07);
  assert.equal(off.paper, 388.7);
});

test('the LINE question is asked first — a wrong net is the cause, not the symptom', () => {
  // Both checks fail on this row. Reporting `vat_total` would send the reviewer
  // to correct the VAT column on a row whose quantity or price is the actual
  // problem, and a digit "fixed" in the wrong column is a wrong invoice that
  // now reconciles.
  const off = grossMismatch({ ...vatLine, raw_amount: '340.00', raw_total_amount: '999.00' });
  assert.ok(off);
  assert.equal(off.reason, 'line_math');
});

test('a row printing a total and a VAT but no net is checked against total − VAT', () => {
  // The net is then forced by the paper rather than chosen by us: 388.70 − 50.70.
  assert.equal(
    grossMismatch({ quantity: '1', unit_price: '338.00', raw_tax_amount: '50.70', raw_total_amount: '388.70' }),
    null,
  );
  const off = grossMismatch({
    quantity: '1',
    unit_price: '330.00',
    raw_tax_amount: '50.70',
    raw_total_amount: '388.70',
  });
  assert.ok(off);
  assert.equal(off.reason, 'line_math');
  assert.equal(off.paper, 338, 'total − VAT is the implied net');
});

test('a lone total with no VAT beside it is treated as the legacy single column', () => {
  // Defensive: the prompt puts a single money column in raw_amount, so this is
  // a reader filling the wrong field — which must not silently disable the check.
  assert.equal(grossMismatch({ quantity: '2', unit_price: '10.00', raw_total_amount: '20.00' }), null);
  const off = grossMismatch({ quantity: '2', unit_price: '10.00', raw_total_amount: '25.00' });
  assert.ok(off);
  assert.equal(off.reason, 'line_math');
});

test('an unpriced or unread row stays silent even with VAT columns printed', () => {
  // An order priced from our own list arrives with every unit_price blank. This
  // restraint is why the warning is worth reading when it does fire.
  assert.equal(grossMismatch({ ...vatLine, unit_price: '' }), null);
  assert.equal(grossMismatch({ ...vatLine, quantity: '' }), null);
  // And a row with quantity and price but nothing printed to check against.
  assert.equal(grossMismatch({ quantity: '1', unit_price: '338.00' }), null);
});

test('a mixed document flags only the row that is wrong', () => {
  // Zero-tax rows and taxed rows on one page, each judged on its own evidence.
  // One bad row must not paint its neighbours, and a taxed neighbour must not
  // excuse it.
  const lines = [
    zeroTaxLine,
    vatLine,
    { ...vatLine, raw_amount: '340.00' }, // out — line_math
    { quantity: '2', unit_price: '335.00', raw_amount: '670.00' }, // legacy, fine
  ];
  assert.equal(countGrossMismatches(lines), 1);
  assert.equal(grossMismatch(lines[0], lineSeparatorHint(lines)), null);
  assert.equal(grossMismatch(lines[1], lineSeparatorHint(lines)), null);
  assert.equal(grossMismatch(lines[3], lineSeparatorHint(lines)), null);
});

// --- locale ----------------------------------------------------------------

test('a comma-decimal VAT is read as 50.70, not as fifty thousand seven hundred', () => {
  // The whole reason the VAT and total columns join `lineSeparatorHint`'s
  // sample list: they are money strings off the same page, and a VAT column is
  // unusually good evidence — two decimal places, every row.
  const commaLine = {
    quantity: '1',
    unit_price: '338,00',
    raw_amount: '338,00',
    raw_tax_amount: '50,70',
    raw_total_amount: '388,70',
  };
  const hint = lineSeparatorHint([commaLine]);
  assert.equal(hint, ',');
  assert.equal(lineTax(commaLine, hint), 50.7);
  assert.equal(lineTotal(commaLine, hint), 388.7);
  assert.equal(grossMismatch(commaLine, hint), null);
});

test('the VAT and total columns are part of the document-wide separator vote', () => {
  // Without them in the sample list, the one figure most likely to be ambiguous
  // would have no say in how it gets read.
  assert.equal(
    lineSeparatorHint([{ quantity: '1', raw_tax_amount: '50,70', raw_total_amount: '388,70' }]),
    ',',
  );
});

// --- the footer ------------------------------------------------------------
//
// A second, whole-page witness. The per-row check catches one transposed digit;
// only the footer catches a row we never read at all.

const footerLines = [
  { quantity: '1', unit_price: '338.00', raw_amount: '338.00', raw_tax_amount: '50.70', raw_total_amount: '388.70' },
  { quantity: '10', unit_price: '12.50', raw_amount: '125.00' },
];

test('a document whose footer agrees with its rows reports both checks ok', () => {
  const out = reconcileDocumentTotals(footerLines, {
    subtotal: '463.00',
    tax_total: '50.70',
    grand_total: '513.70',
  });
  assert.ok(out);
  assert.equal(out.checks.length, 2);
  assert.ok(out.checks.every((c) => c.ok));
  assert.equal(out.checks[0].label, 'Subtotal');
  assert.equal(out.checks[0].expected, 463);
  assert.equal(out.checks[1].label, 'Grand total');
  assert.equal(out.checks[1].expected, 513.7);
});

test('a row that was never read shows up as a subtotal that does not reconcile', () => {
  const out = reconcileDocumentTotals([footerLines[0]], {
    subtotal: '463.00',
    tax_total: '50.70',
    grand_total: '513.70',
  });
  assert.ok(out);
  const subtotal = out.checks.find((c) => c.label === 'Subtotal')!;
  assert.equal(subtotal.ok, false);
  assert.equal(subtotal.expected, 338, 'only the row we read');
  assert.equal(subtotal.actual, 463, 'against what the paper printed');
  // The grand-total check is built from the FOOTER's own components, so it
  // still reconciles — the two checks are asking different questions and a
  // missing row is only visible in the first.
  assert.equal(out.checks.find((c) => c.label === 'Grand total')!.ok, true);
});

test('freight and discount are included when printed', () => {
  const out = reconcileDocumentTotals(footerLines, {
    subtotal: '463.00',
    tax_total: '50.70',
    freight: '85.00',
    discount: '13.70',
    grand_total: '585.00',
  });
  assert.ok(out);
  assert.equal(out.checks.find((c) => c.label === 'Grand total')!.expected, 585);
  assert.ok(out.checks.every((c) => c.ok));
});

test('A MISSING COMPONENT IS OMITTED FROM THE SUM, NEVER ZEROED', () => {
  // The single most important negative in this function. A page that prints a
  // subtotal, a VAT line and a grand total but no freight line is not a page
  // whose freight is R 0.00 — it is a page that said nothing about freight. If
  // the missing legs were zeroed the sum would still be 513.70 here, so the
  // distinction is only visible on a document whose omitted component is
  // real: 463.00 + 50.70 reaches 513.70, and the page's own grand total of
  // 598.70 says there is a carriage line we did not read.
  const out = reconcileDocumentTotals(footerLines, {
    subtotal: '463.00',
    tax_total: '50.70',
    grand_total: '598.70',
  });
  assert.ok(out);
  const grand = out.checks.find((c) => c.label === 'Grand total')!;
  assert.equal(grand.ok, false, 'an unexplained 85.00 is a question, not a silently absorbed zero');
  assert.equal(grand.expected, 513.7);
});

test('partial footers ask only the questions they can', () => {
  // Subtotal alone: no grand total, so no second check.
  const subtotalOnly = reconcileDocumentTotals(footerLines, { subtotal: '463.00' });
  assert.ok(subtotalOnly);
  assert.equal(subtotalOnly.checks.length, 1);
  assert.equal(subtotalOnly.checks[0].label, 'Subtotal');

  // Grand total alone: nothing to build it from, so no check at all — and no
  // panel, rather than a panel comparing a number against itself.
  assert.equal(reconcileDocumentTotals(footerLines, { grand_total: '513.70' }), null);

  // Grand total plus one component: buildable, and it disagrees, which is the
  // honest answer for a page that printed only half its footer.
  const partial = reconcileDocumentTotals(footerLines, { tax_total: '50.70', grand_total: '513.70' });
  assert.ok(partial);
  assert.equal(partial.checks.length, 1);
  assert.equal(partial.checks[0].label, 'Grand total');
  assert.equal(partial.checks[0].expected, 50.7);
  assert.equal(partial.checks[0].ok, false);
});

test('no footer, no line nets, no unreadable figures — no panel', () => {
  assert.equal(reconcileDocumentTotals(footerLines, null), null);
  assert.equal(reconcileDocumentTotals(footerLines, undefined), null);
  assert.equal(reconcileDocumentTotals(footerLines, {}), null);
  // A WhatsApp order: no amounts on any row, so the subtotal check cannot be
  // asked. "R 0.00 ≠ R 463.00" on such a document is a false alarm on every
  // row at once.
  assert.equal(
    reconcileDocumentTotals([{ quantity: '5', unit_price: '' }], { subtotal: '463.00' }),
    null,
  );
});

// --- the round trip --------------------------------------------------------
//
// The footer check is only worth anything if what the reader returns actually
// reaches `extracted_data`. Both write sites (lib/platform/document-ingest.ts
// and app/api/ai/extract/route.ts) build that object from an EXPLICIT field
// list, so a new key that nobody adds to both lists is a feature that works
// perfectly in isolation and never once in production — which is exactly what
// this file's reconciliation was for a while.
//
// Those two writers are `server-only` and Supabase-bound, so they cannot be
// called here without mocking a pipeline. What CAN be pinned, with no mocking
// at all, is the shape they carry: reader output → the stored jsonb → the
// reconciliation that reads it back. If the field name or the `?? null`
// convention drifts on either side, this goes red.

test('the reader’s totals survive into the stored shape and reconcile from there', () => {
  const order = coerceOrderExtraction(JSON.stringify({
    line_items: [
      {
        description: 'Chicken Breast Fillet',
        quantity: '1',
        unit_price: '338.00',
        raw_amount: '338.00',
        raw_tax_amount: '50.70',
        raw_total_amount: '388.70',
        confidence: 97,
      },
      { description: 'Zero rated thing', quantity: '10', unit_price: '12.50', raw_amount: '125.00', confidence: 97 },
    ],
    totals: { subtotal: '463.00', tax_total: '50.70', grand_total: '513.70' },
    overall_confidence: 97,
  }));

  // The same two keys both write sites set, written the same way they write
  // them — `?? null` for a document that printed no footer.
  const stored: ExtractedData = {
    fields: [],
    line_items: order.line_items,
    totals: order.totals ?? null,
  };

  assert.deepEqual(stored.totals, { subtotal: '463.00', tax_total: '50.70', grand_total: '513.70' });

  const out = reconcileDocumentTotals(stored.line_items ?? [], stored.totals);
  assert.ok(out, 'the stored footer must be readable by the check that exists to read it');
  assert.equal(out.checks.length, 2);
  assert.ok(out.checks.every((c) => c.ok));
});

test('an order with no printed footer stores null and draws no panel', () => {
  const order = coerceOrderExtraction(JSON.stringify({
    line_items: [{ description: 'Strawberries', quantity: '5', confidence: 90 }],
  }));
  const stored: ExtractedData = { fields: [], line_items: order.line_items, totals: order.totals ?? null };
  // NULL, not an object of empty strings — the absence is what lets the
  // reconciliation skip rather than fail, and what keeps the review editor
  // from drawing four lines of furniture on every informal order.
  assert.equal(stored.totals, null);
  assert.equal(reconcileDocumentTotals(stored.line_items ?? [], stored.totals), null);
});

test('the footer is read through the document’s own separator, like everything else', () => {
  const commaLines = [
    { quantity: '1', unit_price: '338,00', raw_amount: '338,00', raw_tax_amount: '50,70', raw_total_amount: '388,70' },
    { quantity: '10', unit_price: '12,50', raw_amount: '125,00' },
  ];
  const out = reconcileDocumentTotals(commaLines, {
    subtotal: '463,00',
    tax_total: '50,70',
    grand_total: '513,70',
  });
  assert.ok(out);
  assert.ok(out.checks.every((c) => c.ok), 'a comma document must reconcile exactly as its period twin does');
});
