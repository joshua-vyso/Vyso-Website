import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BATCH_FILES,
  isReadableDocument,
  selectBatch,
  type UploadCandidate,
} from '../lib/platform/docu/upload-client.ts';

// The pure half of the Doc-U batch uploader: what gets staged, what is quietly
// left out of a dropped folder, and what the owner is told about the difference.
//
// This is where a batch goes wrong. The React around it renders whatever comes
// back from `selectBatch` — so a cap that forgets the files already in the tray,
// or a folder walk that stages 200 rows of `.DS_Store`, is a bug that lives
// here and nowhere else.

const MB = 1024 * 1024;

function file(overrides: Partial<UploadCandidate> = {}): UploadCandidate {
  return { name: 'invoice.pdf', type: 'application/pdf', size: 2 * MB, ...overrides };
}

function many(n: number, overrides: Partial<UploadCandidate> = {}): UploadCandidate[] {
  return Array.from({ length: n }, (_, i) => file({ name: `scan-${i}.pdf`, ...overrides }));
}

/* ── isReadableDocument ───────────────────────────────────────────────────── */

test('PDFs and images are readable; the rest of a folder is not', () => {
  assert.equal(isReadableDocument(file()), true);
  assert.equal(isReadableDocument(file({ name: 'scan.jpg', type: 'image/jpeg' })), true);
  // Finder drops report no MIME type — the extension has to carry it.
  assert.equal(isReadableDocument(file({ name: 'statement.PDF', type: '' })), true);
  assert.equal(isReadableDocument(file({ name: '.DS_Store', type: '' })), false);
  assert.equal(isReadableDocument(file({ name: 'notes.txt', type: 'text/plain' })), false);
});

/* ── selectBatch: the ordinary case ───────────────────────────────────────── */

test('a handful of documents all stage, with no notice', () => {
  const { staged, notice } = selectBatch(many(5));
  assert.equal(staged.length, 5);
  assert.equal(notice, null);
  assert.ok(staged.every((s) => s.problem === null));
});

test('an invalid file is STAGED with its reason, not dropped', () => {
  // The owner picked it by hand; it has to be visible so they can see why and
  // remove it. Silently losing one of twelve is how a document goes missing.
  const { staged } = selectBatch([file(), file({ name: 'huge.pdf', size: 22.4 * MB })]);
  assert.equal(staged.length, 2);
  assert.equal(staged[0].problem, null);
  assert.ok(staged[1].problem);
  assert.match(staged[1].problem!, /22\.4 MB/);
});

/* ── selectBatch: the cap ─────────────────────────────────────────────────── */

test('more than the cap keeps the first 20 and says so', () => {
  const { staged, notice } = selectBatch(many(34));
  assert.equal(staged.length, MAX_BATCH_FILES);
  assert.equal(staged[0].file.name, 'scan-0.pdf');
  assert.equal(staged[19].file.name, 'scan-19.pdf');
  assert.ok(notice);
  assert.match(notice!, /first 20 of 34/);
  assert.match(notice!, /skipped/i);
});

test('the cap counts what is already in the tray', () => {
  // Fifteen staged, ten more dropped: five fit, five do not.
  const existing = many(15);
  const { staged, notice } = selectBatch(many(10, { name: 'second.pdf' }).map((f, i) => ({ ...f, name: `b-${i}.pdf` })), {
    existing,
  });
  assert.equal(staged.length, 5);
  assert.ok(notice);
  assert.match(notice!, /first 20 of 25/);
});

test('a full tray takes nothing more', () => {
  const { staged, notice } = selectBatch(many(3, { name: 'x.pdf' }), { existing: many(MAX_BATCH_FILES) });
  assert.equal(staged.length, 0);
  assert.ok(notice);
});

/* ── selectBatch: folders ─────────────────────────────────────────────────── */

test('folder mode drops non-documents quietly and counts them', () => {
  const folder = [
    file({ name: 'inv-1.pdf' }),
    file({ name: '.DS_Store', type: '', size: 6148 }),
    file({ name: 'notes.txt', type: 'text/plain' }),
    file({ name: 'scan.jpg', type: 'image/jpeg' }),
  ];
  const { staged, notice } = selectBatch(folder, { dropUnreadable: true });
  assert.deepEqual(
    staged.map((s) => s.file.name),
    ['inv-1.pdf', 'scan.jpg'],
  );
  assert.ok(notice);
  assert.match(notice!, /Skipped 2 files/);
});

test('without folder mode the same junk is staged with a reason', () => {
  const { staged } = selectBatch([file({ name: 'notes.txt', type: 'text/plain' })]);
  assert.equal(staged.length, 1);
  assert.match(staged[0].problem!, /PDF or an image/);
});

test('an oversized file in a folder still stages — it is a document, just too big', () => {
  // `dropUnreadable` is about TYPE, not size: a 30 MB scan is the file the owner
  // wanted, and they need to be told it is too large rather than left wondering
  // why 19 of 20 arrived.
  const { staged } = selectBatch([file({ name: 'big.pdf', size: 30 * MB })], { dropUnreadable: true });
  assert.equal(staged.length, 1);
  assert.match(staged[0].problem!, /15 MB/);
});

/* ── selectBatch: de-duplication ──────────────────────────────────────────── */

test('the same folder dropped twice does not double the tray', () => {
  const folder = many(4);
  const first = selectBatch(folder, { dropUnreadable: true });
  const second = selectBatch(folder, { existing: first.staged.map((s) => s.file), dropUnreadable: true });
  assert.equal(second.staged.length, 0);
  assert.ok(second.notice);
  assert.match(second.notice!, /already in the list/);
});

test('same name, different size is a different document', () => {
  // Two suppliers both send "invoice.pdf"; only byte-identical size AND name is
  // treated as the same pick.
  const { staged } = selectBatch([file({ size: 1 * MB }), file({ size: 2 * MB })]);
  assert.equal(staged.length, 2);
});

test('duplicates inside one selection collapse', () => {
  const { staged } = selectBatch([file(), file(), file()]);
  assert.equal(staged.length, 1);
});

/* ── selectBatch: the notices combine ─────────────────────────────────────── */

test('a folder that is too big AND full of junk explains both', () => {
  const folder = [...many(25), file({ name: 'notes.txt', type: 'text/plain' })];
  const { staged, notice } = selectBatch(folder, { dropUnreadable: true });
  assert.equal(staged.length, MAX_BATCH_FILES);
  assert.match(notice!, /first 20 of 25/);
  assert.match(notice!, /Skipped 1 file that/);
});

test('nothing selected is not an error', () => {
  const { staged, notice } = selectBatch([]);
  assert.equal(staged.length, 0);
  assert.equal(notice, null);
});
