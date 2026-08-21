import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOW_RESOLUTION_LONG_EDGE,
  imagePixelSize,
  lowResolutionNote,
} from '../lib/platform/docu/image-size.ts';

// ---------------------------------------------------------------------------
// "Was the photo too small to read?"
//
// A question nobody could answer about the Bakubung purchase order, because
// nothing recorded how many pixels the reader was handed. The bytes below are
// built here rather than loaded from a fixture so the test says out loud what
// it is testing — a header, not an image.
// ---------------------------------------------------------------------------

/** An 8-byte PNG signature followed by an IHDR carrying width and height. */
function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(b.buffer);
  view.setUint32(8, 13);           // IHDR length
  b.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  return b;
}

/** A JPEG segment: 0xFF, marker, big-endian length (inclusive), payload. */
function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, (length >> 8) & 0xff, length & 0xff, ...payload];
}

/** SOF0's payload: precision, height, width, component count. */
function sofPayload(width: number, height: number): number[] {
  return [0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 0x03];
}

function jpeg(width: number, height: number, extra: number[] = []): Uint8Array {
  return new Uint8Array([0xff, 0xd8, ...extra, ...segment(0xc0, sofPayload(width, height))]);
}

test('reads the dimensions out of a PNG header', () => {
  assert.deepEqual(imagePixelSize(png(1920, 1080)), { width: 1920, height: 1080 });
});

test('reads the dimensions out of a JPEG start-of-frame', () => {
  assert.deepEqual(imagePixelSize(jpeg(5712, 4284)), { width: 5712, height: 4284 });
});

test('steps over an EXIF thumbnail instead of reporting its size', () => {
  // THE TRAP. An APP1 segment holds a whole second JPEG — the camera's own
  // thumbnail, with its own SOF0 — and a scan for the first SOF marker reports
  // a 24-megapixel photo as 160x120. Skipping each segment by its declared
  // length steps past it; scanning for marker bytes does not, because 0xFFC0
  // occurs inside compressed data all the time.
  const thumbnail = [...jpeg(160, 120)];
  const size = imagePixelSize(jpeg(4032, 3024, segment(0xe1, thumbnail)));
  assert.deepEqual(size, { width: 4032, height: 3024 });
});

test('declines anything that is not a JPEG or a PNG', () => {
  // A PDF has no single pixel size, and guessing one would put a confident
  // wrong number on the review screen.
  assert.equal(imagePixelSize(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), null);
  assert.equal(imagePixelSize(new Uint8Array([])), null);
  assert.equal(imagePixelSize(new Uint8Array([0xff, 0xd8])), null, 'a truncated JPEG is not a size');
});

test('a JPEG that reaches its scan data without a frame header is not a size', () => {
  const truncated = new Uint8Array([0xff, 0xd8, ...segment(0xda, [0x00, 0x00])]);
  assert.equal(imagePixelSize(truncated), null);
});

// --- the warning -----------------------------------------------------------

test('a photo below the threshold gets a note that says what to do about it', () => {
  const note = lowResolutionNote({ width: 900, height: 1200 });
  assert.ok(note, 'a 900x1200 photo is flagged');
  assert.match(note, /900×1200/);
  assert.match(note, new RegExp(String(LOW_RESOLUTION_LONG_EDGE)));
  // The action, not just the diagnosis: a reviewer told "low resolution" and
  // nothing else doubts the product instead of retaking the picture.
  assert.match(note, /re-photograph/i);
});

test('the long edge is what counts, not the short one', () => {
  // A tall phone photo of a page is narrow and perfectly legible.
  assert.equal(lowResolutionNote({ width: 1200, height: 2400 }), null);
  assert.equal(lowResolutionNote({ width: 2400, height: 1200 }), null);
});

test('a photo at or above the threshold is not flagged', () => {
  // At the threshold the model's own downscale is the binding constraint, so
  // the upload is not what limited the read and saying it was would be a lie.
  assert.equal(lowResolutionNote({ width: LOW_RESOLUTION_LONG_EDGE, height: 1000 }), null);
  assert.equal(lowResolutionNote({ width: 5712, height: 4284 }), null);
  assert.ok(lowResolutionNote({ width: LOW_RESOLUTION_LONG_EDGE - 1, height: 1000 }));
});

test('an unknown size is not a complaint', () => {
  // PDFs come through here. "We could not measure it" must never render as
  // "your photo is too small".
  assert.equal(lowResolutionNote(null), null);
});
