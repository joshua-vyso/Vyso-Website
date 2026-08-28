/**
 * Should a non-order classification read get a second opinion from the order
 * lane?
 *
 * THE FAILURE THIS CLOSES. Phase 0 observed Haiku fabricate a plausible-looking
 * classification read at EVERY rotation of a document that was actually a
 * purchase requisition — the orientation retry in `extraction-quality.ts`
 * never even fired, because each fabricated read scored well enough on its own
 * structural audit to look like a completed job. A confident wrong answer is
 * not something "does this read look internally consistent" can catch; it
 * needs a genuinely different read — a different prompt, a different model
 * tier — to disagree with it. That is what the order lane's Sonnet read is,
 * relative to the classification lane's Haiku read.
 *
 * ESCALATION IS CHEAP, ADOPTION IS EARNED. Every signal below only requests a
 * SECOND read; `document-ingest.ts` is the one that decides whether that
 * second read's `auditExtractionStructure` score actually beats the first
 * one's before adopting it (never on the escalation's own say-so). The second
 * read is bounded to at most one extra order-lane pass by always being called
 * with `orientationChecked: true` — see `lib/ai/order-reader.ts`.
 *
 * PURE. No model calls, no I/O — just a decision over an already-completed
 * classification read.
 */

/** The subset of a classification read this decision needs — deliberately
 *  narrow (not `ExtractionResult`) so this module stays decoupled from the AI
 *  layer and trivial to unit test without constructing a full extraction. */
export interface ClassificationSignal {
  document_type: string | null;
  overall_confidence: number;
  supplier?: string | null;
  bill_to?: string | null;
  fields?: Array<{ label?: string | null; value?: string | null }> | null;
  structure_audit?: { status: 'ok' | 'needs_review' } | null;
}

export type ClassificationRouting = 'accept' | 'escalate_order';

// Case-insensitive: the literal phrases a purchase requisition/order prints on
// itself, wherever a strayed word ends up (supplier line, a stray field, the
// bill-to block on a misread layout).
const ORDER_CUE_PHRASE = /purchase\s+requisition|purchase\s+order|requisition/i;
// "PO 4471", "P.O.#4471", "PO-4471" — loose on purpose: this only widens the
// pool of documents that get a SECOND read, never one that gets adopted
// without beating the classification read's own score.
const PO_NUMBER_PATTERN = /\bp\.?\s?o\.?[-\s#]?\d{2,}\b/i;

function hasOrderCue(input: ClassificationSignal): boolean {
  const haystack = [
    input.supplier ?? '',
    input.bill_to ?? '',
    ...(input.fields ?? []).flatMap((f) => [f.label ?? '', f.value ?? '']),
  ];
  return haystack.some((text) => ORDER_CUE_PHRASE.test(text) || PO_NUMBER_PATTERN.test(text));
}

/**
 * Decide whether a classification read deserves a second, order-lane read.
 *
 * Already-typed 'order' documents are never escalated — they already go down
 * the order lane and a second read of the same lane buys nothing. Otherwise,
 * escalate when the read's own structural audit flagged it, when its stated
 * confidence is low, or when the document's own text is shaped like a
 * purchase order/requisition — any one signal is enough, because the whole
 * point is to catch the case where the OTHER two signals stayed quiet.
 */
export function decideClassificationRouting(input: ClassificationSignal): ClassificationRouting {
  if (input.document_type === 'order') return 'accept';
  const needsReview = input.structure_audit?.status === 'needs_review';
  const lowConfidence = input.overall_confidence < 60;
  if (needsReview || lowConfidence || hasOrderCue(input)) return 'escalate_order';
  return 'accept';
}
