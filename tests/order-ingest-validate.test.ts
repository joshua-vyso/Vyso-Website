import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ORDER_BYTES,
  MAX_PDF_BYTES,
  validateOrderFile,
  type OrderFileCandidate,
} from '../lib/platform/docu/order-ingest-client.ts';

// The OrderFlow drop path's gate (.ai/plan_brief_chat_v2.md W4).
//
// Its caps are NOT Doc-U's 15 MB, and that asymmetry is the whole reason this
// function exists separately from `validateUploadFile`: this path posts the
// file as base64 inside a JSON body, and the platform edge rejects bodies over
// 4.5 MB before the handler can explain itself — so a 4 MB PDF has to be
// refused here, in a sentence, rather than as an opaque 413.

const MB = 1024 * 1024;

function file(overrides: Partial<OrderFileCandidate> = {}): OrderFileCandidate {
  return { name: 'order.pdf', type: 'application/pdf', size: 1 * MB, ...overrides };
}

test('a small PDF and a photo both pass', () => {
  assert.equal(validateOrderFile(file()), null);
  assert.equal(validateOrderFile(file({ name: 'order.jpg', type: 'image/jpeg', size: 8 * MB })), null);
});

test('anything that is not a PDF or an image is refused by name', () => {
  const problem = validateOrderFile(file({ name: 'orders.xlsx', type: 'application/vnd.ms-excel' }));
  assert.match(problem ?? '', /^orders\.xlsx: not a PDF or image\./);
});

test('the PDF cap is the edge body limit, not Doc-U’s', () => {
  assert.equal(MAX_PDF_BYTES, 3 * MB);
  const problem = validateOrderFile(file({ size: MAX_PDF_BYTES + 1 }));
  assert.match(problem ?? '', /too large \(max 3MB for PDFs\)/);
  // Exactly at the cap still goes.
  assert.equal(validateOrderFile(file({ size: MAX_PDF_BYTES })), null);
});

test('images get the larger cap because they are downscaled before sending', () => {
  assert.equal(MAX_ORDER_BYTES, 13 * MB);
  assert.equal(validateOrderFile(file({ name: 'p.png', type: 'image/png', size: MAX_ORDER_BYTES })), null);
  const problem = validateOrderFile(file({ name: 'p.png', type: 'image/png', size: MAX_ORDER_BYTES + 1 }));
  assert.match(problem ?? '', /too large \(max ~13MB\)/);
});

test('a nameless file still gets a readable sentence', () => {
  const problem = validateOrderFile(file({ name: '   ', type: 'text/plain' }));
  assert.match(problem ?? '', /^That file: not a PDF or image\./);
});
