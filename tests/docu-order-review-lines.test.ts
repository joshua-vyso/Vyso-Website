import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceOrderExtraction } from '../lib/ai/order-prompt.ts';
import { applyRowArithmeticToLines } from '../lib/platform/docu/row-arithmetic.ts';
import { buildReviewLines } from '../lib/platform/docu/order-review-lines.ts';
import type { DocuExtractedData } from '../lib/platform/docu/types.ts';
import type { ExtractedLineItem } from '../lib/platform/types.ts';

// ---------------------------------------------------------------------------
// THE AVOCADO ROW, END TO END, THROUGH THE EDITOR'S OWN CODE PATH.
//
// `row-arithmetic.ts` has had a thorough unit test since 0912790 and every case
// in it passed while production kept showing a reviewer "Avocado 4 @ 15.75 =
// R63" against a printed nett of 756.00. The resolver was never the problem —
// it was never CALLED, because `app/api/ai/extract/route.ts` gated the order
// reader on `doc.document_type === 'order'` and the chat/Doc-U drop files rows
// untyped, so the document went to the invoice reader instead.
//
// A unit test of the resolver could not have caught that, and neither could one
// of the route. What was missing was a test that walks a REAL model response all
// the way to the rows a human actually sees. That is this file: the same
// coercion the reader uses, the same arithmetic pass it applies, and the same
// `buildReviewLines` the review screen opens with — no React, no network, no
// database, and no re-implementation of any step.
//
// The response below is a verbatim excerpt of what `claude-sonnet-4-6` returned
// for the Bakubung purchase order on the bench (.bench/head-sonnet.run1.json),
// not a hand-written fixture. A fixture that agreed with our assumptions is
// exactly what let this ship.
// ---------------------------------------------------------------------------

/** Verbatim from the bench — the reader's own output, fences and all. */
const SONNET_RESPONSE = JSON.stringify({
  customer_name: 'Bakubung Bush Lodge',
  customer_confidence: 92,
  line_items: [
    {
      raw_description: 'FF - APPLES TOP RED BOX',
      description: 'Apples Top Red',
      quantity: '1', unit: 'Box', bulk_quantity: '1', bulk_unit: 'Box',
      unit_quantity: '', unit_price: '569.90', raw_amount: '569.90', confidence: 88,
    },
    {
      // The row this whole exercise is about: FOUR boxes, FORTY-EIGHT avocados,
      // and a unit cost that is per EACH. Pairing 4 with 15.75 gives R63.
      raw_description: 'FF - AVOCADO BOX',
      description: 'Avocado',
      quantity: '4', unit: 'Box', bulk_quantity: '4', bulk_unit: 'Box',
      unit_quantity: '48', unit_price: '15.75', raw_amount: '756.00', confidence: 85,
    },
    {
      // The SAME layout, but the reader misread the nett: the paper prints
      // 446.94 (18 x 24.83) and it returned 448.94. It still resolves — see the
      // tolerance test below.
      raw_description: 'FF - PINEAPPLE BOX',
      description: 'Pineapple',
      quantity: '3', unit: 'Box', bulk_quantity: '3', bulk_unit: 'Box',
      unit_quantity: '18', unit_price: '24.83', raw_amount: '448.94', confidence: 78,
    },
    {
      // Two columns again, but here the reader dropped a digit in the COST
      // (the paper prints 22.90) and no pairing comes near 1374.00:
      // 60 x 20.90 = 1254.00, 4 x 20.90 = 83.60, 240 x 20.90 = 5016.00.
      raw_description: 'VEG - CUCUMBER BOX',
      description: 'Cucumber',
      quantity: '4', unit: 'Box', bulk_quantity: '4', bulk_unit: 'Box',
      unit_quantity: '60', unit_price: '20.90', raw_amount: '1374.00', confidence: 64,
    },
  ],
  overall_confidence: 84,
});

/**
 * Everything between the model's reply and the review screen's opening rows.
 *
 * `coerceOrderExtraction` + `applyRowArithmeticToLines` is exactly what
 * `lib/ai/order-reader.ts` does (its `withArithmetic` wraps every provider), and
 * the result is what `/api/ai/extract` persists to
 * `extracted_data.line_items` — which is what `buildReviewLines` reads.
 */
function throughTheReader(raw: string): DocuExtractedData {
  const extraction = coerceOrderExtraction(raw);
  return {
    fields: [],
    line_items: applyRowArithmeticToLines(extraction.line_items),
    customer_name: extraction.customer_name,
    customer_confidence: extraction.customer_confidence,
    extraction_model: 'anthropic/claude-sonnet-4-6',
  };
}

let n = 0;
const key = () => `k${++n}`;

test('the editor opens on the POST-arithmetic avocado row, not 4 @ 15.75', () => {
  const lines = buildReviewLines(throughTheReader(SONNET_RESPONSE), key);
  const avocado = lines.find((l) => l.raw === 'FF - AVOCADO BOX');
  assert.ok(avocado, 'the avocado row reached the editor');

  // The paper says 756.00 and only one pairing of this row's own numbers
  // reproduces it: 48 x 15.75. That is what the reviewer must see.
  assert.equal(avocado.quantity, '48');
  assert.equal(avocado.unit_price, '15.75');
  assert.equal(Number(avocado.quantity) * Number(avocado.unit_price), 756);

  // And the paper's own witness is carried through untouched, so the editor's
  // cross-check has something to check against.
  assert.equal(avocado.raw_amount, '756.00');

  // The regression this file exists to prevent, stated as the number a human
  // would have read off the screen.
  assert.notEqual(Number(avocado.quantity) * Number(avocado.unit_price), 63);
});

test('each row opens carrying the EXTRACTION’s own confidence, not a flat 100', () => {
  // The save handler used to stamp every line `confidence: 100` on its way out,
  // which is not a correction but an erasure: after one Confirm, a page whose
  // rows came back at 85 and 88 was indistinguishable from a page read
  // perfectly, and "was this document hard to read?" stopped being answerable
  // the moment a human touched it — precisely when somebody starts asking.
  // Preserving it on the way OUT starts with carrying it on the way IN.
  const lines = buildReviewLines(throughTheReader(SONNET_RESPONSE), key);
  assert.equal(lines.find((l) => l.raw === 'FF - APPLES TOP RED BOX')!.confidence, 88);
  assert.equal(lines.find((l) => l.raw === 'FF - AVOCADO BOX')!.confidence, 85);
  // Two rows read differently well must not open looking the same.
  assert.notEqual(
    lines.find((l) => l.raw === 'FF - APPLES TOP RED BOX')!.confidence,
    lines.find((l) => l.raw === 'FF - AVOCADO BOX')!.confidence,
  );
});

test('an explicit zero line confidence opens as zero; an absent one opens as null', () => {
  // The same rule the header confidence follows (see
  // tests/docu-extraction-confidence.test.ts): a model saying "0" is telling us
  // something, and a historical row that carries no confidence at all is
  // unknown — never a low-confidence read, and never a perfect one.
  const lines = buildReviewLines(
    {
      fields: [],
      line_items: [
        { description: 'Read badly', confidence: 0 },
        // A row from before line confidences were stored. `confidence` is
        // required on the type and absent in the jsonb, which is exactly the
        // shape this branch exists for — hence the cast.
        { description: 'Read long ago' } as unknown as ExtractedLineItem,
      ],
    },
    key,
  );
  assert.equal(lines[0].confidence, 0);
  assert.equal(lines[1].confidence, null);
});

test('the row’s VAT evidence reaches the editor verbatim, blanks included', () => {
  const lines = buildReviewLines(
    {
      fields: [],
      line_items: [
        {
          description: 'Chicken Breast Fillet',
          quantity: '1',
          unit_price: '338.00',
          raw_amount: '338.00',
          raw_tax_amount: '50.70',
          tax_rate: '15%',
          tax_code: 'A',
          raw_total_amount: '388.70',
          confidence: 97,
        },
        { description: 'Zero rated thing', quantity: '10', unit_price: '12.50', raw_amount: '125.00', confidence: 97 },
      ],
    },
    key,
  );
  assert.equal(lines[0].raw_tax_amount, '50.70');
  assert.equal(lines[0].tax_rate, '15%');
  assert.equal(lines[0].tax_code, 'A');
  assert.equal(lines[0].raw_total_amount, '388.70');
  // A row with no VAT column is not a row with zero VAT — the cross-check
  // treats the two differently, so the editor must not flatten them together.
  assert.equal(lines[1].raw_tax_amount, '');
  assert.equal(lines[1].raw_total_amount, '');
});

test("the tolerance still resolves a row whose nett was misread by half a percent", () => {
  const lines = buildReviewLines(throughTheReader(SONNET_RESPONSE), key);
  const pineapple = lines.find((l) => l.raw === 'FF - PINEAPPLE BOX');
  assert.ok(pineapple);

  // 18 x 24.83 = 446.94 against a transcribed 448.94 — two rand out, and
  // `moneyMatches` allows a cent OR half a percent, which is R2.24 here. So the
  // row RESOLVES, to the quantity the paper actually prints.
  //
  // This is worth pinning because it cuts both ways and the tolerance is
  // shared with the invoice audit on purpose (two checks that disagreed about
  // "close enough" would be worse than one). It means the second row Josh
  // flagged in production — "Pineapple 3 @ 24.83 = R74.49" — would ALSO have
  // been rescued had the order reader been the one that read the document.
  assert.equal(pineapple.quantity, '18');
  assert.equal(pineapple.unit_price, '24.83');
  // Never touched: the paper's own witness is the record, not a work value.
  assert.equal(pineapple.raw_amount, '448.94');
});

test('a row that nothing reproduces is left exactly as it was read', () => {
  const lines = buildReviewLines(throughTheReader(SONNET_RESPONSE), key);
  const cucumber = lines.find((l) => l.raw === 'VEG - CUCUMBER BOX');
  assert.ok(cucumber);

  // The nearest hypothesis is 60 x 20.90 = 1254.00 against a printed 1374.00 —
  // R120 out, nowhere near the tolerance. So nothing is rewritten and
  // `grossMismatch` puts the red ring on it for a human. Quietly forcing a row
  // into agreement is how R13,457.60 was invoiced as R25,958.95.
  assert.equal(cucumber.quantity, '4');
  assert.equal(cucumber.unit_price, '20.90');
  assert.equal(cucumber.raw_amount, '1374.00');
});

test('an ordinary single-column row is not disturbed by the two-column rule', () => {
  const lines = buildReviewLines(throughTheReader(SONNET_RESPONSE), key);
  const apples = lines.find((l) => l.raw === 'FF - APPLES TOP RED BOX');
  assert.ok(apples);
  assert.equal(apples.quantity, '1');
  // '569.9', not '569.90': the row resolved on the `quantity` basis and
  // `formatNumber` re-renders the winning figures as plain numbers. Pinned
  // rather than fixed because tests/docu-row-arithmetic.test.ts already pins
  // the same behaviour ('659.00' -> '659'), and the Amount column below is
  // computed from these, not from the string.
  assert.equal(apples.unit_price, '569.9');
  // The paper's own figure keeps every character it was printed with.
  assert.equal(apples.raw_amount, '569.90');
});

test('the customer name the reader found survives to the editor', () => {
  // The other half of the same routing bug: the invoice reader writes no
  // customer_name at all, so the screen said "No customer name was read" about
  // a page with "Purchaser: Bakubung Bush Lodge" printed on it.
  const data = throughTheReader(SONNET_RESPONSE);
  assert.equal(data.customer_name, 'Bakubung Bush Lodge');
  assert.ok((data.customer_confidence ?? 0) > 80);
});

test('provenance records are paired to lines by the paper words, not by position', () => {
  const data = throughTheReader(SONNET_RESPONSE);
  // `syncOrderFromDocument` skips lines with empty raw text, so its array can be
  // SHORTER than line_items — a positional pairing would hang the pineapple's
  // record on the avocado.
  const withRecords: DocuExtractedData = {
    ...data,
    order_lines: [
      {
        raw_description: 'FF - PINEAPPLE BOX', name: 'Pineapple', stock_item_id: null,
        matched: false, match_confidence: 41, match_reason: 'low_confidence', suggestion: null,
        unit_price: null, price_source: 'none', price_list_name: null, document_price: 24.83,
      },
    ],
  };
  const lines = buildReviewLines(withRecords, key);
  assert.equal(lines.find((l) => l.raw === 'FF - AVOCADO BOX')?.record, null);
  assert.equal(lines.find((l) => l.raw === 'FF - PINEAPPLE BOX')?.record?.matched, false);
});

test('no extracted data at all is an empty grid, not a crash', () => {
  assert.deepEqual(buildReviewLines(null, key), []);
  assert.deepEqual(buildReviewLines({ fields: [] }, key), []);
});

// ---------------------------------------------------------------------------
// ADDENDUM 4b (plan_customer_uom_rules.md, 2026-08-28): the review screen's
// unit dropdown OPENS on the INTERPRETED unit for a line a customer UOM rule
// already resolved (no conflict), not the printed one. `displayUnitForLine`
// (customer-uom-rules.ts) is tested in isolation in
// docu-customer-uom-rules.test.ts; this is the WIRING check — that
// `buildReviewLines` actually calls it once records are paired.
// ---------------------------------------------------------------------------

function withOneLine(unit: string, orderLines?: DocuExtractedData['order_lines']): DocuExtractedData {
  return {
    fields: [],
    customer_name: 'Capital',
    line_items: [
      { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit, unit_price: '25.00', confidence: 100 },
    ],
    order_lines: orderLines,
  };
}

test('ADDENDUM 4b: a line an applied UOM rule resolved opens on the INTERPRETED unit', () => {
  const data = withOneLine('KG', [
    {
      raw_description: 'Grapes Black Punnet', name: 'Grapes Black Punnet', stock_item_id: null,
      matched: false, match_confidence: 0, match_reason: 'no_candidate', suggestion: null,
      uom_rule_id: 'rule-punnet', uom_rule_count: 1, uom_source_unit: 'KG', uom_target_unit: 'punnet',
      unit_price: null, price_source: 'none', price_list_name: null, document_price: 25,
    },
  ]);
  const [line] = buildReviewLines(data, key);
  assert.equal(line.unit, 'punnet', 'the dropdown opens on what will actually be billed');
});

test('ADDENDUM 4b: a conflict line opens on the PRINTED unit — no rule applied', () => {
  const data = withOneLine('KG', [
    {
      raw_description: 'Grapes Black Punnet', name: 'Grapes Black Punnet', stock_item_id: null,
      matched: false, match_confidence: 0, match_reason: 'no_candidate', suggestion: null,
      uom_conflict_rule_ids: ['rule-a', 'rule-b'],
      unit_price: null, price_source: 'none', price_list_name: null, document_price: 25,
    },
  ]);
  const [line] = buildReviewLines(data, key);
  assert.equal(line.unit, 'KG', 'a conflict is explicitly "no rule applied" — the printed value stands');
});

test('ADDENDUM 4b: a line no rule ever touched opens on the printed unit, exactly as before', () => {
  const data = withOneLine('KG', [
    {
      raw_description: 'Grapes Black Punnet', name: 'Grapes Black Punnet', stock_item_id: null,
      matched: true, match_confidence: 92, match_reason: 'matched', suggestion: null,
      unit_price: 25, price_source: 'document', price_list_name: null, document_price: 25,
    },
  ]);
  const [line] = buildReviewLines(data, key);
  assert.equal(line.unit, 'KG');
});

test('ADDENDUM 4b: a line with no order_lines record at all opens on the printed unit', () => {
  const [line] = buildReviewLines(withOneLine('KG'), key);
  assert.equal(line.unit, 'KG');
});

test('ADDENDUM 4b: source preservation — the record\'s own uom_source_unit is never touched by opening the row', () => {
  const data = withOneLine('KG', [
    {
      raw_description: 'Grapes Black Punnet', name: 'Grapes Black Punnet', stock_item_id: null,
      matched: false, match_confidence: 0, match_reason: 'no_candidate', suggestion: null,
      uom_rule_id: 'rule-punnet', uom_rule_count: 1, uom_source_unit: 'KG', uom_target_unit: 'punnet',
      unit_price: null, price_source: 'none', price_list_name: null, document_price: 25,
    },
  ]);
  const [line] = buildReviewLines(data, key);
  // The dropdown shows the interpreted value, but the record underneath —
  // what the UI reads to render "Source UOM: KG · …" — still says KG,
  // verbatim, exactly as the sync wrote it. Nothing in `buildReviewLines`
  // rewrites the record to agree with the dropdown.
  assert.equal(line.record?.uom_source_unit, 'KG');
  assert.equal(line.record?.uom_target_unit, 'punnet');
  // And the extraction's own line_items entry — the actual source-of-truth
  // the paper printed — is a plain input to this function, never mutated by
  // it either.
  assert.equal(data.line_items?.[0]?.unit, 'KG');
});

test('Wave B: read-only customer interpretation preview opens on interpreted values and preserves source truth', () => {
  const data: DocuExtractedData = {
    ...withOneLine('KG'),
    customer_interpretation_preview: {
      customer_id: 'customer-capital',
      read_only: true,
      lines: [{
        line_index: 0,
        source_description: 'Grapes Black Punnet',
        source_uom: 'KG',
        interpreted_stock_item_id: 'stock-grapes-black',
        interpreted_description: 'Black Grapes Punnet',
        product_alias_id: 'alias-grapes-black',
        product_alias_source: 'review_confirm',
        interpreted_uom: 'punnet',
        uom_rule_id: 'rule-punnet',
        uom_rule_count: 1,
        uom_conflict_rule_ids: [],
      }],
    },
  };
  const [line] = buildReviewLines(data, key);
  assert.equal(line.description, 'Black Grapes Punnet');
  assert.equal(line.unit, 'punnet');
  assert.equal(line.interpretation?.source_description, 'Grapes Black Punnet');
  assert.equal(line.interpretation?.source_uom, 'KG');
  assert.equal(data.line_items?.[0]?.description, 'Grapes Black Punnet');
  assert.equal(data.line_items?.[0]?.unit, 'KG');
});

test('Wave B: conflicting read-only UOM rules leave the source UOM in the editor', () => {
  const data: DocuExtractedData = {
    ...withOneLine('KG'),
    customer_interpretation_preview: {
      customer_id: 'customer-capital',
      read_only: true,
      lines: [{
        line_index: 0,
        source_description: 'Grapes Black Punnet',
        source_uom: 'KG',
        interpreted_stock_item_id: null,
        interpreted_description: null,
        product_alias_id: null,
        product_alias_source: null,
        interpreted_uom: 'KG',
        uom_rule_id: null,
        uom_rule_count: null,
        uom_conflict_rule_ids: ['rule-a', 'rule-b'],
      }],
    },
  };
  const [line] = buildReviewLines(data, key);
  assert.equal(line.unit, 'KG');
  assert.deepEqual(line.interpretation?.uom_conflict_rule_ids, ['rule-a', 'rule-b']);
});
