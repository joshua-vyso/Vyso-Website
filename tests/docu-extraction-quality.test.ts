import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditExtractionStructure,
  betterExtraction,
  finalizeExtractionConfidence,
  shouldRetryPdfOrientation,
  suspiciousDescription,
} from '../lib/platform/docu/extraction-quality.ts';
import { decideClassificationRouting } from '../lib/platform/docu/classification-policy.ts';

// Real fabrication shape 1 (Phase 0): Haiku locked onto ONE plausible product
// name and repeated it down the whole table, filling in prices too (just not
// distinct ones) — only the repeat signal catches this one. Replaces the old
// single-letter-description fixture, which was a shape the bug never actually
// produced.
const repeatedNameFailure = {
  document_type: 'statement',
  overall_confidence: 42,
  line_items: Array.from({ length: 20 }, () => ({
    description: 'Apricots',
    unit: 'boxes',
    unit_price: '45,00',
    amount: '900,00',
    confidence: 40,
  })),
};

// Real fabrication shape 2 (Phase 0): eighteen DISTINCT invented names — a
// hallucinated but plausible-looking catalogue, not a stuck repeat — with
// every money column blank. No repeat signal at all here; this shape is
// caught only by the missing-columns + low-confidence combination.
const inventedNamesFailure = {
  document_type: 'statement',
  overall_confidence: 32,
  line_items: [
    'Maize Canned', 'Mace', 'Madeira', 'Mango Chutney', 'Mackerel Tin', 'Malt Extract',
    'Marmalade', 'Margarine', 'Marrow Bone', 'Mayonnaise', 'Meatballs', 'Melon Seeds',
    'Milk Powder', 'Mince Beef', 'Mint Sauce', 'Molasses', 'Muesli', 'Mustard Powder',
  ].map((description) => ({
    description,
    unit: 'boxes',
    unit_price: '',
    amount: '',
    confidence: 30,
  })),
};

const uprightRead = {
  document_type: 'order',
  overall_confidence: 93,
  line_items: [
    { description: 'Baby Marrow', unit: 'kg', unit_price: '22,50', amount: '225,00', confidence: 96 },
    { description: 'Brinjals', unit: 'kg', unit_price: '21,75', amount: '217,50', confidence: 96 },
    { description: 'Cucumber English', unit: 'kg', unit_price: '18,90', amount: '189,00', confidence: 95 },
  ],
};

test('a repeated-name fabrication is review-only and triggers orientation recovery', () => {
  const audit = auditExtractionStructure(repeatedNameFailure);
  assert.equal(audit.status, 'needs_review');
  assert.ok(audit.score < 70);
  assert.equal(audit.suspicious_description_rows, 0);
  assert.equal(audit.missing_unit_price_rows, 0);
  assert.equal(audit.missing_amount_rows, 0);
  assert.equal(audit.repeated_description_rows, 19);
  assert.equal(shouldRetryPdfOrientation(repeatedNameFailure), true);
});

test('an invented-names fabrication is review-only and triggers orientation recovery', () => {
  const audit = auditExtractionStructure(inventedNamesFailure);
  assert.equal(audit.status, 'needs_review');
  assert.ok(audit.score < 70);
  assert.equal(audit.suspicious_description_rows, 0);
  assert.equal(audit.missing_unit_price_rows, 18);
  assert.equal(audit.missing_amount_rows, 18);
  assert.equal(audit.repeated_description_rows, 0);
  assert.equal(shouldRetryPdfOrientation(inventedNamesFailure), true);
});

test('the upright requisition preserves full descriptions, KG and both money columns', () => {
  const audit = auditExtractionStructure(uprightRead);
  assert.equal(audit.status, 'ok');
  assert.ok(audit.score >= 85);
  assert.equal(audit.suspicious_description_rows, 0);
  assert.equal(audit.missing_unit_price_rows, 0);
  assert.equal(audit.missing_amount_rows, 0);
  assert.equal(audit.unsupported_box_default_rows, 0);
});

test('candidate selection is structural, not a preferred classification label', () => {
  assert.equal(betterExtraction(repeatedNameFailure, uprightRead), uprightRead);
  assert.equal(suspiciousDescription('M'), true);
  assert.equal(suspiciousDescription('C / F'), true);
  assert.equal(suspiciousDescription('Mint'), false);
});

test('the box-default penalty needs raw evidence, not just a box unit', () => {
  // The classification lane's schema has no raw_description at all — the
  // Haiku prompt strips packaging words out of `description` before this
  // ever sees it, so there is no evidence left to judge and no penalty.
  const noRawDescription = auditExtractionStructure({
    overall_confidence: 90,
    line_items: [{ description: 'Tomatoes', unit: 'boxes', unit_price: '10', amount: '20' }],
  });
  // The order lane's raw_description is present and says nothing about a box.
  const rawWithoutBoxEvidence = auditExtractionStructure({
    overall_confidence: 90,
    line_items: [
      { description: 'Tomatoes', raw_description: 'Tomatoes', unit: 'boxes', unit_price: '10', amount: '20' },
    ],
  });
  // The order lane's raw_description backs up the box unit.
  const rawWithBoxEvidence = auditExtractionStructure({
    overall_confidence: 90,
    line_items: [
      {
        description: 'Tomatoes',
        raw_description: 'Tomatoes 5kg Box',
        unit: 'boxes',
        unit_price: '10',
        amount: '20',
      },
    ],
  });
  assert.equal(noRawDescription.unsupported_box_default_rows, 0);
  assert.equal(rawWithoutBoxEvidence.unsupported_box_default_rows, 1);
  assert.equal(rawWithBoxEvidence.unsupported_box_default_rows, 0);
});

test('a confident unpriced order is not rotated in search of columns it never printed', () => {
  const unpricedOrder = {
    overall_confidence: 92,
    line_items: [
      { description: 'Tomatoes', quantity: '5', unit: 'kg', unit_price: '', amount: '' },
      { description: 'Baby Marrow', quantity: '2', unit: 'kg', unit_price: '', amount: '' },
      { description: 'Brinjals', quantity: '4', unit: 'kg', unit_price: '', amount: '' },
    ],
  };
  assert.equal(auditExtractionStructure(unpricedOrder).status, 'ok');
  assert.equal(shouldRetryPdfOrientation(unpricedOrder), false);
});

test('the unpriced-document guard needs both blank columns AND a confident read', () => {
  const unpricedLines = (overall_confidence: number) => ({
    overall_confidence,
    line_items: [
      { description: 'Tomatoes', unit: 'kg', unit_price: '', amount: '' },
      { description: 'Baby Marrow', unit: 'kg', unit_price: '', amount: '' },
      { description: 'Brinjals', unit: 'kg', unit_price: '', amount: '' },
    ],
  });
  // Confident: the guard fires, the missing-columns penalty is skipped, no cap.
  const confident = auditExtractionStructure(unpricedLines(80));
  assert.equal(confident.status, 'ok');
  assert.ok(confident.score >= 70);
  // Unsure: the guard needs confidence >= 70 too, so the same blank columns
  // are NOT excused — the full penalty applies and this stays needs_review.
  const unsure = auditExtractionStructure(unpricedLines(60));
  assert.equal(unsure.status, 'needs_review');
  assert.ok(unsure.score < 70);
});

test('finalizeExtractionConfidence caps rotation-adopted reads even when the audit is clean', () => {
  assert.equal(finalizeExtractionConfidence(95, { adoptedRotation: true, auditStatus: 'ok' }), 75);
  assert.equal(finalizeExtractionConfidence(95, { adoptedRotation: false, auditStatus: 'needs_review' }), 65);
  // Both caps apply at once — the lower one wins.
  assert.equal(finalizeExtractionConfidence(95, { adoptedRotation: true, auditStatus: 'needs_review' }), 65);
  // Neither cap applies — confidence passes through unchanged.
  assert.equal(finalizeExtractionConfidence(95, { adoptedRotation: false, auditStatus: 'ok' }), 95);
  // A cap can only LOWER confidence, never raise it past what was reported.
  assert.equal(finalizeExtractionConfidence(50, { adoptedRotation: true, auditStatus: 'ok' }), 50);
});

test('classification routing escalates both real fabrication shapes', () => {
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: repeatedNameFailure.overall_confidence,
      structure_audit: auditExtractionStructure(repeatedNameFailure),
    }),
    'escalate_order',
  );
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: inventedNamesFailure.overall_confidence,
      structure_audit: auditExtractionStructure(inventedNamesFailure),
    }),
    'escalate_order',
  );
});

test('classification routing accepts a confident clean statement', () => {
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: uprightRead.overall_confidence,
      structure_audit: auditExtractionStructure(uprightRead),
    }),
    'accept',
  );
});

test('classification routing accepts anything already typed order — no second read needed', () => {
  assert.equal(
    decideClassificationRouting({
      document_type: 'order',
      overall_confidence: 20,
      structure_audit: { status: 'needs_review' },
    }),
    'accept',
  );
});

test('classification routing escalates on a low-confidence purchase-requisition cue even with a clean audit', () => {
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: 55,
      supplier: 'Fresh Valley Produce',
      bill_to: null,
      fields: [{ label: 'Notes', value: 'Purchase Requisition #4471' }],
      structure_audit: { status: 'ok' },
    }),
    'escalate_order',
  );
});

test('an order-shaped cue escalates on its own, even at high confidence with a clean audit', () => {
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: 91,
      supplier: 'Fresh Valley Produce',
      bill_to: 'PO-4471',
      structure_audit: { status: 'ok' },
    }),
    'escalate_order',
  );
});

// 2026-09-03: a Johannesburg market statement whose second "PURCHASES ON CARD ID"
// section was emitted twice. 12 of 39 rows repeated — under the 50% repeated-
// description line, so the old audit scored it "ok" at 90 and 553 phantom boxes
// went into stock. The rows carry the market's per-row invoice number, and a
// repeated one is never legitimate.
test('a repeated row reference sends the read to review without triggering rotation retry', () => {
  const row = (reference: string, description: string) => ({
    reference,
    description,
    unit: 'boxes',
    unit_price: '200.00',
    amount: '26400.00',
    confidence: 95,
  });
  const clean = { overall_confidence: 91, line_items: [row('162652334', 'Red Peppers 5kg'), row('162652345', 'Cabbage Sugar 30kg')] };
  assert.equal(auditExtractionStructure(clean).status, 'ok');
  assert.equal(auditExtractionStructure(clean).repeated_reference_rows, 0);

  const duplicated = { ...clean, line_items: [...clean.line_items, row('162652334', 'Red Peppers 5kg')] };
  const audit = auditExtractionStructure(duplicated);
  assert.equal(audit.status, 'needs_review');
  assert.equal(audit.repeated_reference_rows, 1);
  assert.ok(audit.score >= 70, 'a duplicated section is not a rotated page');
  assert.equal(shouldRetryPdfOrientation(duplicated), false);

  // Rows the reader already dropped still count: the doubt outlives the rows.
  const dropped = { ...clean, duplicate_reference_rows: 12 };
  assert.equal(auditExtractionStructure(dropped).status, 'needs_review');
  assert.equal(auditExtractionStructure(dropped).repeated_reference_rows, 12);
});

test('a repeated-reference-only review verdict does not escalate a statement to the order lane', () => {
  const audit = {
    status: 'needs_review' as const,
    score: 88,
    line_count: 39,
    suspicious_description_rows: 0,
    repeated_description_rows: 5,
    repeated_reference_rows: 12,
  };
  assert.equal(
    decideClassificationRouting({ document_type: 'statement', overall_confidence: 65, supplier: 'Johannesburg Fresh Produce Market', structure_audit: audit }),
    'accept',
  );
  // The other review verdicts still escalate exactly as before.
  assert.equal(
    decideClassificationRouting({ document_type: 'statement', overall_confidence: 65, structure_audit: { ...audit, score: 40 } }),
    'escalate_order',
  );
  assert.equal(
    decideClassificationRouting({ document_type: 'statement', overall_confidence: 65, structure_audit: { status: 'needs_review' } }),
    'escalate_order',
  );
});
