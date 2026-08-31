import { degrees, PDFDocument } from 'pdf-lib';

/** Rotation metadata recorded with an extraction; no document bytes are stored. */
export interface PdfOrientationNormalization {
  applied: boolean;
  original_rotation: number;
  selected_rotation: number;
  attempted_rotations: number[];
}

export interface PdfOrientationCandidate {
  base64: string;
  rotation: number;
}

const normalise = (value: number): number => ((Math.round(value) % 360) + 360) % 360;

/**
 * DOES THIS PDF'S OWN METADATA SAY IT IS SIDEWAYS?
 *
 * THE FAILURE THIS CLOSES, and it is the reason this file's `/Rotate` read
 * stopped being merely descriptive. One landscape F&B requisition page, no text
 * layer, `/Rotate 270`, scanned twice:
 *
 *   - Scan A (document 9e63be71) read badly enough to fail its own structure
 *     audit, tripped the score<70 retry, came back through rotation recovery and
 *     produced sixteen correct kilogram lines.
 *   - Scan B (document 467ae9d0) reached extraction with
 *     `orientation_normalization` NULL — the retry never fired — was classified
 *     `supplier_statement` at confidence 95, and the extractor WHOLESALE
 *     FABRICATED a forty-line Johannesburg market statement: products that are
 *     not on the page, and 37 of the 40 lines carrying a unit_price of "52.88",
 *     which is a sideways misread of a 52xxx material code. Its structure audit
 *     scored 81 and said "ok".
 *
 * SO THE POST-HOC SCORE GATE CANNOT BE THE TRIGGER FOR THIS CASE. `score < 70`
 * asks "does this read look internally consistent", and a confidently
 * hallucinated table is internally consistent — that is what makes it a
 * hallucination rather than a misread. Forty plausible rows with prices and
 * amounts score well BECAUSE they are complete. The only signal that was
 * available before the model ever spoke is the one the file itself carries:
 * this page says it is rotated 270°.
 *
 * SO: A DETERMINISTIC, PRE-READ TRIGGER. When a single-page PDF's own `/Rotate`
 * is non-zero, the rotation candidates are ALWAYS compared, whatever the first
 * read scored. The score<70 trigger stays exactly as it is for pages whose
 * metadata claims to be upright — those are the ones where a bad read is the
 * only evidence available.
 *
 * SINGLE PAGE ONLY, same as `pdfOrientationCandidates` and for the same reason:
 * one rotation cannot repair a mixed-orientation packet, and a multi-page
 * rotated PDF stays an unrecovered, reviewable document. That limitation is
 * unchanged by this and is restated here so nobody reads the new trigger as
 * having fixed it.
 *
 * Returns false for anything it cannot read — an encrypted or malformed PDF
 * degrades to the behaviour that shipped before this existed, which is the
 * score gate alone.
 */
export async function pdfRotationSuspect(base64: string): Promise<boolean> {
  try {
    const probe = await PDFDocument.load(Uint8Array.from(Buffer.from(base64, 'base64')), {
      updateMetadata: false,
    });
    if (probe.getPageCount() !== 1) return false;
    return normalise(probe.getPage(0).getRotation().angle) !== 0;
  } catch {
    return false;
  }
}

/**
 * Produce non-destructive, in-memory alternatives for a single-page PDF.
 *
 * The first model read remains the authority for an upright document. These
 * candidates are only used after that read fails structural checks. Restricting
 * recovery to one page avoids pretending a single rotation can repair a mixed-
 * orientation packet; those stay reviewable until page-wise rendering exists.
 */
export async function pdfOrientationCandidates(base64: string): Promise<{
  originalRotation: number;
  candidates: PdfOrientationCandidate[];
}> {
  const source = Uint8Array.from(Buffer.from(base64, 'base64'));
  const probe = await PDFDocument.load(source, { updateMetadata: false });
  if (probe.getPageCount() !== 1) {
    return { originalRotation: normalise(probe.getPages()[0]?.getRotation().angle ?? 0), candidates: [] };
  }

  const originalRotation = normalise(probe.getPage(0).getRotation().angle);
  // RELATIVE offsets, added to whatever the page's own rotation metadata
  // already says (originalRotation) — these are not absolute page angles.
  // Only the three non-identity quarter turns are tried: +0 is skipped
  // because that IS the original read, already produced as the caller's
  // `initial` before this function is ever invoked. +270 (90° counter-
  // clockwise) goes first because it is the common scanner-misfeed
  // correction; +90 and +180 follow.
  const relativeRotations = [270, 90, 180];
  const candidates: PdfOrientationCandidate[] = [];
  for (const relative of relativeRotations) {
    const pdf = await PDFDocument.load(source, { updateMetadata: false });
    const rotation = normalise(originalRotation + relative);
    pdf.getPage(0).setRotation(degrees(rotation));
    const bytes = await pdf.save({ addDefaultPage: false, updateFieldAppearances: false });
    candidates.push({ base64: Buffer.from(bytes).toString('base64'), rotation });
  }
  return { originalRotation, candidates };
}
