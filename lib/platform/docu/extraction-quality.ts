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
  /** The row's own printed number (a market statement's per-row invoice id). */
  reference?: string | null;
  unit?: string | null;
  unit_price?: string | null;
  amount?: string | null;
  raw_amount?: string | null;
  confidence?: number | null;
}

export interface StructuralExtraction {
  line_items?: StructuralLine[] | null;
  overall_confidence?: number | null;
  /**
   * Rows the reader ALREADY DROPPED as exact re-listings of an earlier
   * reference (lib/platform/docu/market-line.ts). They are gone from
   * `line_items`, so the audit cannot count them itself — but a read that
   * listed a section twice is still a read a human must look at, which is why
   * the count travels here instead of vanishing with the rows.
   */
  duplicate_reference_rows?: number | null;
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
  /**
   * Rows whose printed reference repeats another row's — the reader's
   * duplicated-section failure (2026-09-03: one read in seven of a
   * Johannesburg market statement re-emitted a whole "PURCHASES ON CARD ID"
   * block, 12 phantom rows, and `repeated_description_rows` alone scored it
   * "ok" because the same produce legitimately recurs across agents). A
   * repeated REFERENCE is never legitimate; even one sends the document to
   * review. Includes rows already dropped by the reader.
   */
  repeated_reference_rows: number;
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

  const refCounts = new Map<string, number>();
  for (const line of lines) {
    const ref = (line.reference ?? '').trim().replace(/\s+/g, '');
    if (ref) refCounts.set(ref, (refCounts.get(ref) ?? 0) + 1);
  }
  const repeatedReferences =
    [...refCounts.values()].reduce((total, occurrences) => total + Math.max(0, occurrences - 1), 0) +
    Math.max(0, input.duplicate_reference_rows ?? 0);

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
    // Bounded so a duplicated section flags the read WITHOUT dragging the score
    // under the orientation-retry line (`shouldRetryPdfOrientation`, < 70): the
    // page is not rotated, it was read twice, and a rotation search would just
    // read it twice again at three more angles.
    structural -= Math.min(10, (repeatedReferences / count) * 25);
  }

  const score = Math.max(0, Math.min(100, Math.round(structural * 0.65 + confidence * 0.35)));
  // No separate "severe column loss" disjunct here (there used to be one). The
  // guard above only skips the missing-price/amount penalty when confidence
  // >= 70, so whenever confidence < 70 AND both columns are mostly missing,
  // that penalty is still applied in full above and alone pulls `structural`
  // (and therefore `score`) under 70 — `score < 70` already catches every case
  // the old disjunct existed for.
  const status =
    score < 70 || suspicious > 0 || repeatedReferences > 0 || (count >= 3 && repeated / count >= 0.5)
      ? 'needs_review'
      : 'ok';

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
    repeated_reference_rows: repeatedReferences,
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
 * Read a model's stated confidence into a 0–100 number, or NULL when it did not
 * state one.
 *
 * WHY THIS EXISTS. Both lanes used to do `typeof v === 'number' ? v : 0`, and
 * both lanes ALSO instruct the model to "output all numbers as plain strings".
 * A reader that obeyed its own prompt therefore scored zero, and so did a
 * reader that simply omitted the key — two Montecasino orders sit in the
 * database at a stored `confidence` of 0.0 with every line item at 100, which
 * is not a document anybody read badly, it is a document nobody read the header
 * of. Nothing downstream could tell that fabricated 0 from a genuine one, and
 * "0% confident" is the single most alarming thing this product can say about a
 * document that was in fact read perfectly.
 *
 * SO: MISSING IS NULL, NOT ZERO. `documents.confidence` has always been
 * nullable and `ConfidenceText` has always rendered null as "—"; the honest
 * answer was representable the whole time and we were writing a number instead.
 * An EXPLICIT 0 still comes through as 0 — a model that says it is not
 * confident is telling us something, and flattening that to "unknown" would be
 * the same crime in the other direction.
 *
 * The rest is arithmetic on what a model plausibly returns:
 *   - a string is trimmed, a trailing "%" dropped, then read as a number
 *     ("97" → 97, "88%" → 88); anything non-numeric is null, never 0.
 *   - a value strictly between 0 and 1 is read as a 0–1-scale probability and
 *     scaled (0.92 → 92). The boundaries are excluded on purpose: 0 and 1 are
 *     both perfectly ordinary percentage answers and neither is worth
 *     reinterpreting.
 *   - the result is clamped to 0–100 and rounded, so 900 → 100 and -40 → 0.
 */
export function coerceConfidence(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    const s = v.trim().replace(/%$/, '').trim();
    if (!s) return null;
    n = Number(s);
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  // 0–1 scale, exclusive of both ends — see the docblock.
  if (n > 0 && n < 1) n = n * 100;
  return Math.max(0, Math.min(100, Math.round(n)));
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
 *
 * NULL PASSES STRAIGHT THROUGH, UNCAPPED AND UNFABRICATED. A cap is a CEILING
 * on a number the model gave us; with no number there is nothing to lower, and
 * writing 65 or 75 in place of "we don't know" would invent precisely the kind
 * of confident-looking figure `coerceConfidence` above exists to stop
 * inventing. The document still lands in review — a null confidence raises the
 * `low_confidence` flag on its own (lib/platform/docu/flags.ts) and
 * `decideClassificationRouting` reads it as worst-case — so nothing is let
 * through by the pass-through; only a fake number is avoided.
 */
export function finalizeExtractionConfidence(
  confidence: number | null,
  opts: { adoptedRotation: boolean; auditStatus: 'ok' | 'needs_review' },
): number | null {
  if (confidence == null) return null;
  let result = confidence;
  if (opts.auditStatus === 'needs_review') result = Math.min(result, 65);
  if (opts.adoptedRotation) result = Math.min(result, 75);
  return result;
}
