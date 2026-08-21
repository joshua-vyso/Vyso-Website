/**
 * How many pixels of document did the reader actually get?
 *
 * WHY THIS EXISTS. A Bakubung purchase order came back with "560.90" where the
 * paper prints "569.90", and the first suspicion was that we had thrown the
 * pixels away ourselves — the mobile Capture path downscales every photo to
 * 2000px at JPEG q0.8, and the OrderFlow web drop does the same in a canvas.
 * Nobody could confirm or refute that after the fact, because nothing recorded
 * how big the image was by the time a model saw it. This records it.
 *
 * WHAT "TOO SMALL" MEANS, AND IT IS NOT A ROUND NUMBER WE LIKED. Anthropic's
 * vision pipeline resizes every image down to the model's own budget before
 * reading it: a STANDARD-tier model (which `claude-sonnet-4-6`, the current
 * order reader, is) gets 1568px on the long edge AND 1568 visual tokens, one
 * token per 28x28 patch — so ceil(w/28) * ceil(h/28) <= 1568, which for an
 * ordinary page shape lands near 1260x950.
 * (https://platform.claude.com/docs/en/build-with-claude/vision)
 *
 * So the threshold below is the point at which WE are the binding constraint
 * rather than the model: above it the API is going to downscale anyway and the
 * upload made no difference; below it the reader genuinely had fewer pixels of
 * paper than it could have used, and a misread digit has an innocent
 * explanation that a human on the review screen deserves to be told.
 *
 * NO DECODER, NO DEPENDENCY. Both formats put their dimensions in a header, and
 * this reads that header. Decoding a 4-megapixel JPEG to learn two integers
 * would be absurd, and adding an image library to a repo that has deliberately
 * kept image tooling out of it (see scripts/demo-invoice-pdfs.mjs) more so.
 *
 * PURE. No I/O — it is handed bytes. `.ts`-suffixed relative-free imports so
 * `node --test` can load it directly.
 */

/** The pixel dimensions of an image, when they could be read off its header. */
export interface ImagePixelSize {
  width: number;
  height: number;
}

/**
 * The long edge below which the upload, not the model, is the limit.
 *
 * 1568px is the standard tier's own long-edge ceiling. An image at or above it
 * gives the reader everything it can use; one below it does not.
 */
export const LOW_RESOLUTION_LONG_EDGE = 1568;

/**
 * Read width/height out of a JPEG or PNG header. Null for anything else — a
 * PDF has no single pixel size, and a format we do not recognise is a question
 * we decline rather than answer wrongly.
 */
export function imagePixelSize(bytes: Uint8Array): ImagePixelSize | null {
  return pngSize(bytes) ?? jpegSize(bytes);
}

/** PNG: an 8-byte signature, then IHDR with width and height as big-endian u32. */
function pngSize(b: Uint8Array): ImagePixelSize | null {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24) return null;
  for (let i = 0; i < SIG.length; i += 1) if (b[i] !== SIG[i]) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * JPEG: walk the marker segments to the Start Of Frame, which carries the real
 * dimensions.
 *
 * The EXIF thumbnail is the trap — it is a whole second JPEG embedded in APP1,
 * and a naive scan for the first SOF finds ITS dimensions and reports a
 * 24-megapixel photo as 160x120. Skipping each segment by its own declared
 * length (rather than scanning for marker bytes, which appear inside compressed
 * data all the time) steps over it.
 */
function jpegSize(b: Uint8Array): ImagePixelSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) {
      i += 1; // fill byte or desync — step forward rather than give up
      continue;
    }
    const marker = b[i + 1];
    // Standalone markers: no length, no payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // Start of scan — compressed data from here; no SOF was found.
    if (marker === 0xda || marker === 0xd9) return null;
    const length = (b[i + 2] << 8) | b[i + 3];
    if (length < 2) return null;
    // SOF0..SOF15, excluding the four that are not frame headers (DHT 0xc4,
    // JPG 0xc8, DAC 0xcc).
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 9 >= b.length) return null;
      const height = (b[i + 5] << 8) | b[i + 6];
      const width = (b[i + 7] << 8) | b[i + 8];
      return width && height ? { width, height } : null;
    }
    i += 2 + length;
  }
  return null;
}

/**
 * The sentence to put in front of a reviewer when the photo was the limit, or
 * null when it was not.
 *
 * It says what was uploaded and what the reader needs, because "low resolution"
 * on its own is a label a person cannot act on — and the action here is
 * specific: photograph the page again, closer, rather than doubt the product.
 */
export function lowResolutionNote(size: ImagePixelSize | null): string | null {
  if (!size) return null;
  const longest = Math.max(size.width, size.height);
  if (longest >= LOW_RESOLUTION_LONG_EDGE) return null;
  return `This photo is ${size.width}×${size.height} — its long edge is under ${LOW_RESOLUTION_LONG_EDGE}px, which is less detail than the reader can use. Small or blurred figures may have been misread; check the amounts against the paper, and re-photograph the page closer if they look wrong.`;
}
