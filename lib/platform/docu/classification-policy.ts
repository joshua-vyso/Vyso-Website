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
  /** 0–100, or null when the read stated no confidence at all. */
  overall_confidence: number | null;
  supplier?: string | null;
  bill_to?: string | null;
  fields?: Array<{ label?: string | null; value?: string | null }> | null;
  structure_audit?: {
    status: 'ok' | 'needs_review';
    score?: number;
    line_count?: number;
    suspicious_description_rows?: number;
    repeated_description_rows?: number;
    repeated_reference_rows?: number;
  } | null;
}

/**
 * Did the audit fail for a reason that says "this may not be the document type
 * the reader thinks it is"? A repeated ROW REFERENCE does not: it is the
 * reader's duplicated-section failure on a document it read correctly
 * otherwise (the rows are already dropped, the read is held for review). Paying
 * for a second, order-lane read of a market statement because one section was
 * listed twice would be a wasted Sonnet call at best and a mis-filed order at
 * worst. So the escalation trigger is the audit's OTHER verdicts — the ones
 * the orientation/fabrication incidents were caught by — reconstructed here
 * from the fields the audit exposes, with the bare `status` as the fallback
 * for callers that pass nothing more.
 */
function auditSuggestsMisread(audit: ClassificationSignal['structure_audit']): boolean {
  if (!audit || audit.status !== 'needs_review') return false;
  if ((audit.repeated_reference_rows ?? 0) === 0) return true;
  if (audit.score == null) return true;
  const count = audit.line_count ?? 0;
  const suspicious = audit.suspicious_description_rows ?? 0;
  const repeated = audit.repeated_description_rows ?? 0;
  return audit.score < 70 || suspicious > 0 || (count >= 3 && repeated / count >= 0.5);
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
 *
 * AN EXPENSE RECEIPT IS ACCEPTED ON TWO OF THE THREE SIGNALS' SILENCE, and it is
 * the one exception to the rule above. The two cheap signals — a failed
 * structure audit, a low or missing confidence — are things a till slip trips
 * routinely and innocently: it is a photograph of thermal paper with four rows
 * on it, so a reader that is honestly unsure about it is being honest, not
 * wrong about what it is. Escalating on that alone would hand the slip to the
 * ORDER lane, and the order lane's job is to find an order in what it is
 * given — an order which, if adopted, creates an OrderFlow order and stock
 * movements for a lunch. The asymmetry that makes escalation cheap everywhere
 * else ("it only buys a second read") does not hold here, because the second
 * read's whole tendency is towards the one outcome this document type exists to
 * prevent.
 *
 * So the receipt escalates on EVIDENCE ONLY: the document's own text has to say
 * "purchase order" or carry a PO number before we will ask the order lane about
 * it. That leaves the genuine confusion case — a purchase order misclassified
 * as a receipt — caught by the cue that would identify it either way, and
 * everything else accepted as read. Every other path through this function is
 * untouched.
 */
export function decideClassificationRouting(input: ClassificationSignal): ClassificationRouting {
  if (input.document_type === 'order') return 'accept';
  // A CREDIT IS NEVER ESCALATED TO THE ORDER LANE, on any signal, and this is
  // the one arm with no cue-based escape hatch at all.
  //
  // The expense-receipt arm below still escalates on EVIDENCE — a till slip
  // that says "purchase order" on it might really be one. A credit document
  // cannot be, and the cue that would trigger it is guaranteed to be present:
  // Credit Request 6275 prints "PO 144426" on its face, because naming the
  // purchase order behind the original invoice is WHAT A CREDIT REQUEST IS FOR.
  // So `hasOrderCue` fires on essentially every well-formed credit.
  //
  // And the order lane's job is to find an order in whatever it is handed. If
  // its read scored better, `document-ingest.ts` would adopt it, retype the
  // document 'order', and build an OrderFlow order — with an invoice number
  // drawn from the shared counter — out of a document asking for money back.
  // That is CRN0012368's failure with an extra step: not merely a credit filed
  // as spend, but a credit filed as a sale.
  //
  // The asymmetry that makes escalation cheap everywhere else ("it only buys a
  // second read") does not hold here for the same reason it does not hold for a
  // receipt: the second read's whole tendency is towards the one outcome this
  // type exists to prevent.
  if (
    input.document_type === 'supplier_credit_note' ||
    input.document_type === 'customer_credit_request' ||
    input.document_type === 'customer_credit_note'
  ) {
    return 'accept';
  }
  if (input.document_type === 'expense_receipt') {
    return hasOrderCue(input) ? 'escalate_order' : 'accept';
  }
  const needsReview = auditSuggestsMisread(input.structure_audit);
  // A MISSING confidence counts as the worst one. This gate only ever buys a
  // second read — cheap, and `document-ingest.ts` still makes that read earn
  // adoption on its own structural score — so the asymmetry is entirely in our
  // favour: reading a fine document twice costs one model call, while trusting
  // a read that would not even say how sure it was is the Phase 0 failure this
  // whole module exists to catch.
  const lowConfidence = (input.overall_confidence ?? 0) < 60;
  if (needsReview || lowConfidence || hasOrderCue(input)) return 'escalate_order';
  return 'accept';
}
