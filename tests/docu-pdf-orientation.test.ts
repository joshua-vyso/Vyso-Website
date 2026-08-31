import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { PDFDocument, degrees } from 'pdf-lib';
import { pdfOrientationCandidates, pdfRotationSuspect } from '../lib/platform/docu/pdf-orientation.ts';

const fixture = new URL('./fixtures/purchase-requisition-rotated.pdf', import.meta.url);
const src = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the exact scanned requisition exposes rotation candidates without changing the source bytes', async () => {
  const bytes = await readFile(fixture);
  const original = Buffer.from(bytes).toString('base64');
  const result = await pdfOrientationCandidates(original);

  assert.equal(result.originalRotation, 270);
  assert.deepEqual(result.candidates.map((candidate) => candidate.rotation), [180, 0, 90]);
  assert.equal(Buffer.from(original, 'base64').equals(bytes), true, 'the source copy remains byte-identical');

  for (const candidate of result.candidates) {
    const pdf = await PDFDocument.load(Buffer.from(candidate.base64, 'base64'));
    assert.equal(pdf.getPageCount(), 1);
    assert.equal(pdf.getPage(0).getRotation().angle, candidate.rotation);
  }
});

test('mixed/multi-page packets fail closed instead of applying one rotation to every page', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addPage();
  const result = await pdfOrientationCandidates(Buffer.from(await pdf.save()).toString('base64'));
  assert.deepEqual(result.candidates, []);
});

// ---------------------------------------------------------------------------
// THE SCAN B CASE (matrix 24–32).
//
// One landscape F&B requisition page, /Rotate 270, no text layer, scanned twice:
//
//   - Scan A read badly enough to FAIL its own structure audit, tripped the
//     score<70 retry, came back through rotation recovery and produced sixteen
//     correct kilogram lines.
//   - Scan B reached extraction with orientation_normalization NULL — the retry
//     never fired — was classified `supplier_statement` at confidence 95, and
//     the extractor WHOLESALE FABRICATED a forty-line market statement:
//     products not on the page, 37 of the 40 lines carrying a unit_price of
//     "52.88" (a sideways misread of a 52xxx material code). Its structure audit
//     scored 81 and said "ok".
//
// A confidently hallucinated table is internally consistent — that is what makes
// it a hallucination rather than a misread — so the post-hoc score gate provably
// cannot be the trigger for this case. The page's own metadata could.
// ---------------------------------------------------------------------------

test('24. THE DETERMINISTIC TRIGGER: a single page whose own /Rotate is non-zero is suspect', async () => {
  const bytes = await readFile(fixture);
  assert.equal(await pdfRotationSuspect(Buffer.from(bytes).toString('base64')), true);
});

test('25. an upright single page is NOT suspect — the score gate stays its only trigger', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  assert.equal(await pdfRotationSuspect(Buffer.from(await pdf.save()).toString('base64')), false);
});

test('26. every quarter turn counts, and 360 is upright', async () => {
  for (const angle of [90, 180, 270]) {
    const pdf = await PDFDocument.create();
    pdf.addPage().setRotation(degrees(angle));
    assert.equal(await pdfRotationSuspect(Buffer.from(await pdf.save()).toString('base64')), true, String(angle));
  }
  const full = await PDFDocument.create();
  full.addPage().setRotation(degrees(360));
  assert.equal(await pdfRotationSuspect(Buffer.from(await full.save()).toString('base64')), false);
});

test('27. multi-page packets are NOT suspect — one rotation cannot repair a mixed packet', async () => {
  // The limitation is unchanged, and restated rather than quietly fixed: a
  // multi-page rotated PDF stays an unrecovered, reviewable document.
  const pdf = await PDFDocument.create();
  pdf.addPage().setRotation(degrees(270));
  pdf.addPage();
  assert.equal(await pdfRotationSuspect(Buffer.from(await pdf.save()).toString('base64')), false);
});

test('28. an unreadable PDF degrades to the behaviour that shipped before this existed', async () => {
  assert.equal(await pdfRotationSuspect('bm90LWEtcGRm'), false);
  assert.equal(await pdfRotationSuspect(''), false);
});

test('29. BOTH LANES run the candidate comparison on a rotated page, whatever the first read scored', () => {
  // The classification lane — where Scan B actually failed. A sideways page can
  // no longer reach a `statement` verdict from a fabricated read without the
  // rotation candidates having been compared.
  assert.match(
    src('lib/ai/anthropic.ts'),
    /const rotationSuspect = isPdf \? await pdfRotationSuspect\(params\.base64\) : false;\s*\n\s*if \(isPdf && \(rotationSuspect \|\| shouldRetryPdfOrientation\(initial\)\)\) \{/,
  );
  // The order lane.
  assert.match(
    src('lib/ai/order-reader.ts'),
    /const rotationSuspect = isPdf && !params\.orientationChecked \? await pdfRotationSuspect\(params\.base64\) : false;\s*\n\s*if \(params\.orientationChecked \|\| !isPdf \|\| \(!rotationSuspect && !shouldRetryPdfOrientation\(initial\)\)\) \{/,
  );
});

test('30. the score<70 trigger is KEPT for unrotated pages, not replaced', () => {
  // Scan A is the reason: it had no usable metadata signal beyond a bad read,
  // and the score gate is what recovered its sixteen correct lines.
  assert.match(src('lib/platform/docu/extraction-quality.ts'), /export function shouldRetryPdfOrientation\(input: StructuralExtraction\): boolean \{\s*\n\s*return auditExtractionStructure\(input\)\.score < 70;/);
  for (const lane of ['lib/ai/anthropic.ts', 'lib/ai/order-reader.ts']) {
    assert.ok(src(lane).includes('shouldRetryPdfOrientation(initial)'), lane);
  }
});

test('31. the Scan B case is written down where the trigger lives', () => {
  const orientation = src('lib/platform/docu/pdf-orientation.ts');
  assert.match(orientation, /scored 81 and said "ok"/);
  assert.match(orientation, /orientation_normalization` NULL/);
  // And the surviving limitation is restated rather than implied.
  assert.match(orientation, /SINGLE PAGE ONLY/);
});

test('32. the trigger costs an ALREADY-CHECKED read nothing', async () => {
  // `orientationChecked: true` is set on every escalation read and whenever the
  // classification lane already adopted a rotation on these exact bytes. The
  // order lane must not pay for a second metadata probe there, let alone a
  // second rotation search — that is the whole reason the flag exists.
  assert.match(
    src('lib/ai/order-reader.ts'),
    /isPdf && !params\.orientationChecked \? await pdfRotationSuspect/,
  );
  // And a rotated page still exposes exactly the three non-identity candidates.
  const bytes = await readFile(fixture);
  const result = await pdfOrientationCandidates(Buffer.from(bytes).toString('base64'));
  assert.equal(result.candidates.length, 3);
});
