import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_UPLOAD_BYTES,
  attachmentMessage,
  attachmentStrandedNote,
  validateUploadFile,
  type UploadCandidate,
} from '../lib/platform/docu/upload-client.ts';

// The two pure halves of the drop path (.ai/plan_brief_chat_v2.md §2.6, W5).
//
// `validateUploadFile` is the only thing standing between the owner and a
// wasted 40-second upload of a file the extract route will refuse — and its
// return value is shown to them verbatim, so the wording is part of the
// contract, not decoration. `attachmentMessage` becomes a message bubble that
// is stored forever, which is a strange place for an off-by-one.

const MB = 1024 * 1024;

function file(overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  return { name: 'invoice.pdf', type: 'application/pdf', size: 2 * MB, ...overrides };
}

/* ── validateUploadFile ───────────────────────────────────────────────────── */

test('a normal PDF passes', () => {
  assert.equal(validateUploadFile(file()), null);
});

test('images pass on their MIME type', () => {
  assert.equal(validateUploadFile(file({ name: 'scan.jpg', type: 'image/jpeg' })), null);
  assert.equal(validateUploadFile(file({ name: 'photo.heic', type: 'image/heic' })), null);
});

test('a typeless file passes on its extension', () => {
  // Dragging out of Finder, and some Android pickers, report an empty type —
  // refusing those would break the commonest way a photo of an invoice arrives.
  assert.equal(validateUploadFile(file({ name: 'statement.PDF', type: '' })), null);
  assert.equal(validateUploadFile(file({ name: 'till-slip.jpeg', type: '' })), null);
});

test('a spreadsheet is refused by name, with a reason', () => {
  const problem = validateUploadFile(
    file({ name: 'customers.xlsx', type: 'application/vnd.ms-excel', size: 1 * MB }),
  );
  assert.ok(problem);
  assert.ok(problem.includes('customers.xlsx'), 'names the file it refused');
  assert.match(problem, /PDF or an image/);
});

test('an oversized file is refused, and the message says how big it is', () => {
  const problem = validateUploadFile(file({ size: 22.4 * MB }));
  assert.ok(problem);
  assert.match(problem, /22\.4 MB/);
  assert.match(problem, /15 MB/);
});

test('the ceiling matches the extract route, and is inclusive', () => {
  // MAX_EXTRACT_BYTES in app/api/ai/extract/route.ts. A client cap ABOVE the
  // server's would upload files that can only ever fail extraction.
  assert.equal(MAX_UPLOAD_BYTES, 15 * MB);
  assert.equal(validateUploadFile(file({ size: MAX_UPLOAD_BYTES })), null);
  assert.ok(validateUploadFile(file({ size: MAX_UPLOAD_BYTES + 1 })));
});

test('an empty file is refused before anything else', () => {
  // A 0-byte drop is usually a folder or a failed copy; uploading it would
  // create a document row that can never extract.
  const problem = validateUploadFile(file({ size: 0 }));
  assert.ok(problem);
  assert.match(problem, /empty/);
});

test('type is checked before size', () => {
  // A 30 MB spreadsheet is the wrong KIND of file; telling the owner to shrink
  // it would send them off to do something pointless.
  const problem = validateUploadFile(file({ name: 'ledger.csv', type: 'text/csv', size: 30 * MB }));
  assert.ok(problem);
  assert.match(problem, /PDF or an image/);
});

/* ── attachmentMessage ────────────────────────────────────────────────────── */

test('one file is named', () => {
  assert.equal(attachmentMessage(['invoice.pdf']), 'I’ve uploaded invoice.pdf.');
});

test('two files are joined with "and"', () => {
  assert.equal(attachmentMessage(['a.pdf', 'b.pdf']), 'I’ve uploaded a.pdf and b.pdf.');
});

test('three or more are counted, then listed', () => {
  assert.equal(
    attachmentMessage(['a.pdf', 'b.pdf', 'c.jpg']),
    'I’ve uploaded 3 documents: a.pdf, b.pdf, c.jpg.',
  );
});

test('blank names are dropped rather than producing a gap', () => {
  assert.equal(attachmentMessage(['  ', 'real.pdf']), 'I’ve uploaded real.pdf.');
});

test('no names at all still produces a sendable sentence', () => {
  // `send()` refuses empty text, so an empty list must not become an empty
  // message — that would swallow the upload silently.
  assert.equal(attachmentMessage([]), 'I’ve uploaded a document.');
});

/* ── attachmentStrandedNote ─────────────────────────────────────── */

// The sentence that exists so the drop path can never end in silence. Every
// branch must (a) name the files, (b) say they ARE in Doc-U, and (c) say what to
// do next — an owner who is told only "that didn't work" drops the file again.

test('a stranded upload names the file and says where it is', () => {
  const note = attachmentStrandedNote(['buyer_statement (28).pdf']);
  assert.match(note, /buyer_statement \(28\)\.pdf/);
  assert.match(note, /Doc-U/);
  assert.match(note, /new message/);
});

test('several stranded uploads are all named, in plural', () => {
  const note = attachmentStrandedNote(['a.pdf', 'b.pdf']);
  assert.match(note, /a\.pdf, b\.pdf are in Doc-U/);
  assert.match(note, /ask about them/);
});

test('blank names are dropped, as they are in the message itself', () => {
  assert.equal(attachmentStrandedNote(['  ', 'real.pdf']), attachmentStrandedNote(['real.pdf']));
});

test('no names at all still produces a sentence, never an empty error', () => {
  // An empty string here would render an empty red box — visually identical to
  // the silence this whole note exists to replace.
  const note = attachmentStrandedNote([]);
  assert.ok(note.trim().length > 0);
  assert.match(note, /Doc-U/);
});
