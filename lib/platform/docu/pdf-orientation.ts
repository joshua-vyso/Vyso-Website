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
