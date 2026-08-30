import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceConfidence,
  finalizeExtractionConfidence,
} from '../lib/platform/docu/extraction-quality.ts';
import { decideClassificationRouting } from '../lib/platform/docu/classification-policy.ts';

// ---------------------------------------------------------------------------
// The two 0% Montecasino orders.
//
// Two documents sit in `documents` with `confidence` 0.0 and every single line
// item at 100. Nothing about those reads was bad; the header key was omitted or
// came back as the STRING the prompt asks for ("Output all numbers as plain
// strings"), and both lanes coerced it with `typeof v === 'number' ? v : 0`.
//
// A fabricated 0 is worse than no answer at all, because it is indistinguishable
// from a real one: no cap path can produce it (the ceilings are 65 and 75), the
// UI has always rendered it as an alarming "0% confident", and there is no way
// after the fact to tell an unread header from a genuinely hopeless read.
//
// `documents.confidence` was nullable the whole time and `ConfidenceText` has
// always drawn null as "—". The honest answer was representable; we were writing
// a number instead. This suite is that fix.
// ---------------------------------------------------------------------------

test('a stated number comes through, clamped and rounded', () => {
  assert.equal(coerceConfidence(97), 97);
  assert.equal(coerceConfidence(12.6), 13);
  assert.equal(coerceConfidence(900), 100, 'a runaway number is clamped, not rejected');
  assert.equal(coerceConfidence(-40), 0, 'and so is a negative one');
});

test('a stated STRING comes through — the prompt asks for strings', () => {
  assert.equal(coerceConfidence('97'), 97);
  assert.equal(coerceConfidence(' 97 '), 97, 'whitespace is not a refusal to answer');
  assert.equal(coerceConfidence('88%'), 88, 'a trailing percent sign is punctuation, not data');
  assert.equal(coerceConfidence('88 %'), 88);
});

test('MISSING IS NULL, NOT ZERO — the whole point', () => {
  assert.equal(coerceConfidence(undefined), null);
  assert.equal(coerceConfidence(null), null);
  assert.equal(coerceConfidence(''), null, 'an empty string is a missing answer, not a zero');
  assert.equal(coerceConfidence('   '), null);
  assert.equal(coerceConfidence('very sure'), null, 'unreadable is unknown, never zero');
  assert.equal(coerceConfidence(NaN), null);
  assert.equal(coerceConfidence(Infinity), null);
  assert.equal(coerceConfidence({}), null);
  assert.equal(coerceConfidence([]), null);
  assert.equal(coerceConfidence(true), null, 'a boolean is not a confidence');
});

test('an EXPLICIT zero stays zero', () => {
  // The mirror image, and just as important. A model saying "0" is telling us
  // something real; turning that into "we do not know" would hide a genuine
  // refusal behind the same dash that means an unread header.
  assert.equal(coerceConfidence(0), 0);
  assert.equal(coerceConfidence('0'), 0);
});

test('a 0–1-scale answer is read as one, at the exclusive ends', () => {
  assert.equal(coerceConfidence(0.92), 92);
  assert.equal(coerceConfidence('0.92'), 92);
  assert.equal(coerceConfidence(0.5), 50);
  // The boundaries are NOT rescaled: 0 and 1 are both perfectly ordinary
  // percentage answers, and reinterpreting "1" as 100% would turn the least
  // confident read on the page into the most confident one.
  assert.equal(coerceConfidence(1), 1);
  assert.equal(coerceConfidence(0), 0);
});

// --- the caps ---------------------------------------------------------------

test('finalizeExtractionConfidence passes null straight through, uncapped', () => {
  // A cap is a CEILING on a stated number. With nothing stated there is nothing
  // to lower, and writing 65 or 75 into the column would invent exactly the
  // confident-looking figure the null exists to avoid.
  assert.equal(finalizeExtractionConfidence(null, { adoptedRotation: false, auditStatus: 'ok' }), null);
  assert.equal(finalizeExtractionConfidence(null, { adoptedRotation: true, auditStatus: 'needs_review' }), null);
});

test('the caps themselves are unchanged for a stated confidence', () => {
  assert.equal(finalizeExtractionConfidence(95, { adoptedRotation: true, auditStatus: 'ok' }), 75);
  assert.equal(finalizeExtractionConfidence(95, { adoptedRotation: false, auditStatus: 'needs_review' }), 65);
  assert.equal(finalizeExtractionConfidence(95, { adoptedRotation: true, auditStatus: 'needs_review' }), 65);
  assert.equal(finalizeExtractionConfidence(0, { adoptedRotation: true, auditStatus: 'ok' }), 0, 'a real 0 is not raised');
});

// --- what null must NOT buy -------------------------------------------------

test('a null confidence is treated as the WORST one where it gates a second read', () => {
  // Escalation is cheap (one extra model call, and document-ingest.ts still
  // makes the second read earn adoption on its own structural score); trusting
  // a read that would not even say how sure it was is the Phase 0 failure
  // classification-policy.ts exists to catch. The asymmetry is entirely ours.
  assert.equal(
    decideClassificationRouting({
      document_type: 'statement',
      overall_confidence: null,
      structure_audit: { status: 'ok' },
    }),
    'escalate_order',
  );
  // …but an order is still never escalated into the lane it is already in.
  assert.equal(
    decideClassificationRouting({
      document_type: 'order',
      overall_confidence: null,
      structure_audit: { status: 'ok' },
    }),
    'accept',
  );
});
