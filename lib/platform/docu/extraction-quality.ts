/**
 * Structural honesty checks for a document read.
 *
 * This is deliberately independent of document type and customer/supplier names:
 * orientation recovery must choose the read that preserved the page, not the one
 * that happened to produce a preferred classification.  It also gives Doc-U an
 * explicit review state for the unmistakable failure shape we have seen from
 * sideways scans: repeated/one-letter descriptions, a whole money table missing,
 * and an unsupported blanket unit.
 *
 * PURE. No model calls, no I/O and no numeric parsing.
 */

export interface StructuralLine {
  description?: string | null;
  raw_description?: string | null;
  unit?: string | null;
  unit_price?: string | null;
  amount?: string | null;
  raw_amount?: string | null;
  confidence?: number | null;
}

export interface StructuralExtraction {
  line_items?: StructuralLine[] | null;
  overall_confidence?: number | null;
}

export interface ExtractionStructureAudit {
  status: 'ok' | 'needs_review';
  score: number;
  line_count: number;
  suspicious_description_rows: number;
  missing_unit_rows: number;
  missing_unit_price_rows: number;
  missing_amount_rows: number;
  unsupported_box_default_rows: number;
  repeated_description_rows: number;
}

const present = (value: string | null | undefined): boolean => Boolean(value?.trim());
const text = (line: StructuralLine): string =>
  (line.raw_description?.trim() || line.description?.trim() || '').trim();

/** A one/two-letter alphabetic fragment is not a credible product description. */
export function suspiciousDescription(value: string | null | undefined): boolean {
  const letters = (value ?? '').replace(/[^\p{L}]/gu, '');
  return letters.length > 0 && letters.length <= 2;
}

function looksLikeBoxEvidence(value: string): boolean {
  return /\b(box|boxes|carton|cartons|case|cases|crate|crates)\b/i.test(value);
}

/**
 * Score a read by evidence preservation. A low model confidence alone is not a
 * reason to rotate a page, and a missing price column alone is valid on many
 * informal orders. The retry boundary is crossed by combinations of losses.
 */
export function auditExtractionStructure(input: StructuralExtraction): ExtractionStructureAudit {
  const lines = input.line_items ?? [];
  const count = lines.length;
  const suspicious = lines.filter((line) => suspiciousDescription(text(line))).length;
  const missingUnit = lines.filter((line) => !present(line.unit)).length;
  const missingPrice = lines.filter((line) => !present(line.unit_price)).length;
  const missingAmount = lines.filter((line) => !present(line.raw_amount) && !present(line.amount)).length;
  // The box-default penalty needs RAW printed text to judge against. The
  // classification lane's Haiku schema strips packaging words out of
  // `description` entirely — "box" evidence only ever survives on
  // `raw_description`, which only the order lane's schema populates. Without
  // this guard every box-priced statement/invoice line was penalized for
  // evidence the SCHEMA had already discarded, not evidence the READ lost.
  const unsupportedBoxes = lines.filter((line) => {
    if (!present(line.raw_description)) return false;
    const unit = line.unit?.trim().toLowerCase();
    return (unit === 'box' || unit === 'boxes') && !looksLikeBoxEvidence(line.raw_description!.trim());
  }).length;

  const counts = new Map<string, number>();
  for (const line of lines) {
    const key = text(line).toLocaleLowerCase().replace(/\s+/g, ' ');
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const repeated = [...counts.values()].reduce((total, occurrences) => total + Math.max(0, occurrences - 1), 0);

  const confidence = Math.max(0, Math.min(100, input.overall_confidence ?? 0));
  // Many genuine informal orders print no money columns at all. That is a
  // DOCUMENT SHAPE, not evidence loss, and penalizing it would rotate pages
  // in search of prices that were never printed. Gated on confidence >= 70
  // rather than applied unconditionally: a read this unsure of itself still
  // needs the review the penalty produces, missing prices or not.
  const skipPriceColumnPenalty =
    count >= 3 && missingPrice / count >= 0.8 && missingAmount / count >= 0.8 && confidence >= 70;

  let structural = count > 0 ? 100 : 20;
  if (count > 0) {
    structural -= (suspicious / count) * 55;
    structural -= (missingUnit / count) * 10;
    if (!skipPriceColumnPenalty) {
      structural -= (missingPrice / count) * 20;
      structural -= (missingAmount / count) * 20;
    }
    structural -= (unsupportedBoxes / count) * 15;
    structural -= (repeated / count) * 25;
  }

  const score = Math.max(0, Math.min(100, Math.round(structural * 0.65 + confidence * 0.35)));
  // No separate "severe column loss" disjunct here (there used to be one). The
  // guard above only skips the missing-price/amount penalty when confidence
  // >= 70, so whenever confidence < 70 AND both columns are mostly missing,
  // that penalty is still applied in full above and alone pulls `structural`
  // (and therefore `score`) under 70 — `score < 70` already catches every case
  // the old disjunct existed for.
  const status =
    score < 70 || suspicious > 0 || (count >= 3 && repeated / count >= 0.5) ? 'needs_review' : 'ok';

  return {
    status,
    score,
    line_count: count,
    suspicious_description_rows: suspicious,
    missing_unit_rows: missingUnit,
    missing_unit_price_rows: missingPrice,
    missing_amount_rows: missingAmount,
    unsupported_box_default_rows: unsupportedBoxes,
    repeated_description_rows: repeated,
  };
}

export function betterExtraction<T extends StructuralExtraction>(current: T, candidate: T): T {
  return auditExtractionStructure(candidate).score > auditExtractionStructure(current).score
    ? candidate
    : current;
}

export function shouldRetryPdfOrientation(input: StructuralExtraction): boolean {
  return auditExtractionStructure(input).score < 70;
}

/**
 * The one place both extraction wrappers (`lib/ai/anthropic.ts` extractDocument,
 * `lib/ai/order-reader.ts` extractOrderDocument) cap `overall_confidence` after
 * a read. Extracted so the cap rules sit under direct unit test, with no model
 * call or mock in the way.
 *
 * TWO INDEPENDENT CAPS, THE LOWER ONE WINS. `needs_review` (65) is the
 * pre-existing structural-loss cap — the audit itself says the table came back
 * damaged. `adoptedRotation` (75) is separate and additive: a read that only
 * succeeded after rotating a degraded scan is never auto-trustworthy on its
 * own, even when the audit likes the shape it produced, because a model can
 * fabricate a STRUCTURALLY CLEAN table at the wrong rotation just as easily as
 * a messy one — Haiku doing exactly that at every rotation of a sideways
 * requisition is the failure `classification-policy.ts`'s escalation exists to
 * catch. Both caps sit under DOC_LOW_CONFIDENCE_THRESHOLD (80,
 * lib/platform/tokens.ts), so either one alone is enough to route the document
 * into human review rather than any auto-approval path.
 */
export function finalizeExtractionConfidence(
  confidence: number,
  opts: { adoptedRotation: boolean; auditStatus: 'ok' | 'needs_review' },
): number {
  let result = confidence;
  if (opts.auditStatus === 'needs_review') result = Math.min(result, 65);
  if (opts.adoptedRotation) result = Math.min(result, 75);
  return result;
}
