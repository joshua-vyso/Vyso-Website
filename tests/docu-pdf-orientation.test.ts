import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { pdfOrientationCandidates } from '../lib/platform/docu/pdf-orientation.ts';

const fixture = new URL('./fixtures/purchase-requisition-rotated.pdf', import.meta.url);

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
