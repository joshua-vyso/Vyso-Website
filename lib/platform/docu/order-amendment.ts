import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DocumentSourceType,
  ExtractedData,
  OrderAmendment,
  OrderAmendmentType,
  OrderBusinessEvent,
} from '../types.ts';

/**
 * IS THIS MESSAGE A NEW ORDER, OR A CHANGE TO ONE THAT ALREADY EXISTS?
 *
 * THE FAILURE THIS CLOSES. Keshisha Ramsewak emailed about PO 144583 to move a
 * delivery from today to Wednesday. Every signal the pipeline reads said
 * "order": the subject carried a PO number, the classifier scored
 * `customer_order`, the order lane read it. So it filed a SECOND order document
 * — zero lines, customer_name "Keshisha Ramsewak" (the person, not the
 * property) — sitting beside the real PO document, which already carried
 * purchase_order_number "144583" and a requested_delivery_date of 31 Aug.
 * Both rows held the linkage evidence. Nothing read it. The dedupe key on
 * `of_orders` is `source_document_id`, so a second email about one PO is a
 * second order, and the shared invoice-number counter drifts by one for it.
 *
 * WHY THE DETECTION IS DETERMINISTIC AND OVERRIDES THE MODEL. The prompt now
 * TELLS the reader that a change to an existing PO is not a new order, and that
 * instruction is worth having — but an instruction is a tendency, and this
 * decision gates whether an operational write runs at all. A regex that fires on
 * "not today" is auditable, testable against the exact sentence that caused the
 * incident, and cannot have a bad afternoon. So the model's `business_event`, if
 * it ever emits one, does not decide: this does.
 *
 * WHY IT IS NOT A SUPPRESSION TAG. `microsoft-graph-ingest-core.ts` already has
 * a family of these — HISTORIC_ORDER_RE, COMPLAINT_RE, PRICE_ENQUIRY_RE — and
 * every one of them exists to say "this is NOT an order, file nothing". An
 * amendment is different in kind: it is genuinely about an order, it genuinely
 * deserves a document and a review card, and the only thing it must not do is
 * CREATE a second one. Those tags stay exactly as they are, doing their own job
 * for enquiries and complaints; this decides what happens to the messages that
 * get past them.
 *
 * PURE. No I/O, no React, no Supabase in the detection half — `.ts`-suffixed
 * relative imports because `node --test` resolves neither extensionless ESM
 * specifiers nor the `@/` alias, and this module is loaded directly by
 * tests/docu-order-amendment.test.ts. The one async function at the bottom
 * takes an already-authenticated client and reads; it writes nothing, and
 * `SupabaseClient` is a TYPE-ONLY import so the tests can still load this file.
 */

// ---------------------------------------------------------------------------
// The cues
// ---------------------------------------------------------------------------

/**
 * "deliver Wednesday not today", "please change the delivery date", "move the
 * delivery to Friday", "push it out to the 3rd".
 *
 * The `not (today|<day>)` half is what makes the PO 144583 sentence
 * unmistakable — a NEW order never tells you what day it is not being delivered
 * on — but it is one alternative of several, because most date changes are
 * phrased as a plain instruction with no contrast at all.
 */
const DELIVERY_DATE_CHANGE_RE =
  /\b(?:please\s+)?(?:change|amend|update|move|shift|push|bring)\s+(?:the\s+|our\s+|this\s+)?(?:delivery|deliver(?:y)?\s+date|order)\b[^.!?\n]{0,60}\b(?:date|day|forward|earlier|later|to\s+(?:mon|tue|wed|thu|fri|sat|sun|next|\d))|\bdeliver(?:y)?\b[^.!?\n]{0,60}\bnot\s+(?:today|tomorrow|mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:delivery|deliver)\s+date\s+(?:change|changed|amendment)\b|\breschedule\s+(?:the\s+)?deliver/i;

/** "cancel this PO", "please cancel the order", "cancel PO 144583". */
const CANCELLATION_RE =
  /\b(?:please\s+)?cancel(?:led|lation)?\s+(?:this|the|our|my)?\s*\b(?:p\.?o\.?|purchase\s+order|order|requisition|delivery)\b|\b(?:p\.?o\.?|order)\b[^.!?\n]{0,40}\b(?:is|has\s+been|to\s+be)\s+cancell?ed\b/i;

/**
 * RIGHTS AND CONDITIONAL LANGUAGE — the window guard, and the second reason PO
 * JBG0118352 was stamped `order_cancellation`.
 *
 * That document is a genuine four-line purchase order. Printed under it, in the
 * Conditions of Purchase footer every formal PO carries, is the sentence "The
 * Purchaser reserves the absolute right to cancel this Order" — which
 * `CANCELLATION_RE` reads as a request to cancel, because as a string it IS
 * one. The difference is not in the verb, it is in what stands in front of it:
 * a clause about what somebody MAY do is not an instruction to do it.
 *
 * So a cue match is discarded when the ~120 characters BEFORE it carry one of
 * these markers. Before, not after, because that is where the modality lives —
 * "reserves the right to", "in the event of", "shall be cancelled if" all
 * qualify the verb that follows them.
 *
 * This is a heuristic and it is allowed to be: a discarded cue costs an
 * amendment stamp on a document that still files, still reviews and still
 * carries every field it read. A kept one cost a real purchase order its lines.
 */
const BOILERPLATE_WINDOW_RE =
  /\b(reserves?\s+(?:the\s+)?(?:absolute\s+)?right|right\s+to|may\s+(?:be\s+)?cancel|shall\s+(?:be\s+)?cancel|in\s+the\s+event\s+of|entitled\s+to|option\s+to|failure\s+(?:on|of|to)|if\s+the\s+(?:vendor|supplier|purchaser))\b/i;

/** How far back the guard looks. Long enough to hold "The Purchaser reserves
 *  the absolute right to", short enough that a previous sentence's "right to"
 *  cannot reach forward into an unrelated instruction. */
const BOILERPLATE_WINDOW_CHARS = 120;

/**
 * A CANCELLATION SOMEBODY ACTUALLY PERFORMED OR ASKED FOR, as opposed to one a
 * contract merely contemplates.
 *
 * These are the positive half of the same argument: each names a STATE the
 * order is in ("Status: Cancelled", "PO 144583 has been cancelled") or an
 * INSTRUCTION addressed to the reader ("please cancel", "do not deliver").
 * None of them is a thing a Conditions-of-Purchase footer says, and all of them
 * are things a real cancellation says.
 *
 * They are what a formal document is allowed to declare about ITSELF (see
 * `sourceKind`), and what overrides the line-item gate below: a purchase order
 * printed with "Status: Cancelled" across it is cancelled whether or not its
 * lines are still legible.
 */
const TRANSACTIONAL_CANCELLATION_RES: readonly RegExp[] = [
  /status\s*[:\-]?\s*cancell?ed/i,
  /\bhas\s+been\s+cancell?ed\b/i,
  /\bplease\s+cancel\b/i,
  /\bdo\s+not\s+deliver\b/i,
];

/**
 * The mirror image: a document declaring itself LIVE.
 *
 * PO JBG0118352 prints "Status: Accepted" in its header. That is the document
 * saying, in its own words, that it is an order to be filled — and beside four
 * priced lines and a requested delivery date it is as strong a "this is a new
 * order" as a formal document ever gives. It STRENGTHENS the new_order verdict;
 * it never creates an amendment, so nothing here can misfire in that direction.
 */
const ACCEPTED_STATUS_RE =
  /status\s*[:\-]?\s*(?:accepted|approved|confirmed|open|active)\b|\b(?:order|p\.?o\.?)\s+(?:has\s+been\s+)?accepted\b/i;

/**
 * WHERE THE LEGAL BOILERPLATE STARTS, for cue detection only.
 *
 * `normalizeEmailHtml` emits one flat text stream: an HTML purchase order's
 * twelve tables, its line grid and its Conditions-of-Purchase footer arrive as
 * a single 18,000-character string with no section boundary anywhere in it.
 * This puts one boundary back — the first heading-ish legal marker — and hands
 * the detector the text above it.
 *
 * HEURISTIC AND FAIL-OPEN, both deliberately. No marker means the full text,
 * unchanged, which is exactly today's behaviour; a marker in the very first
 * line would leave nothing to read, so the original is returned instead of an
 * empty string. It NEVER touches stored text, the reader's source, or
 * `order_notes` — the document keeps every word it was filed with. It only
 * decides which words a regex is allowed to draw a routing conclusion from.
 */
const BOILERPLATE_SECTION_RE =
  /\b(terms\s+(?:and|&)\s+conditions|conditions\s+of\s+purchase|general\s+conditions|indemnit|warrant(?:y|ies)|governing\s+law)\b/i;

export function stripBoilerplateSections(text: string | null | undefined): string {
  const source = text ?? '';
  if (!source) return '';
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    // Heading-ish: the marker sits on a short line of its own (optionally
    // numbered), not buried mid-paragraph. "Subject to our standard terms and
    // conditions" inside a sentence is not a section heading, and truncating
    // there would throw away the rest of a message over one aside.
    const line = lines[i].replace(/^[\s\d.)(:_-]+/, '').trim();
    if (line.length > 80 || !BOILERPLATE_SECTION_RE.test(line)) continue;
    const above = lines.slice(0, i).join('\n');
    return above.trim() ? above : source;
  }
  return source;
}

/** "put it on hold", "hold the order", "please hold delivery until Monday". */
const HOLD_RE =
  /\b(?:please\s+)?(?:hold|pause|suspend|freeze)\s+(?:the\s+|this\s+|our\s+|off\s+(?:on\s+)?(?:the\s+)?)?(?:p\.?o\.?|purchase\s+order|order|delivery|shipment)\b|\b(?:p\.?o\.?|order|delivery)\b[^.!?\n]{0,40}\bon\s+hold\b/i;

/** "change the delivery address", "deliver to the Rosebank branch instead". */
const ADDRESS_CHANGE_RE =
  /\b(?:change|amend|update|correct)\s+(?:the\s+|our\s+)?(?:delivery\s+)?address\b|\bdeliver\s+to\b[^.!?\n]{0,60}\binstead\b|\b(?:new|different|updated)\s+delivery\s+address\b|\bship\s+to\b[^.!?\n]{0,40}\binstead\b/i;

/**
 * "add 4 boxes to PO 144583", "increase the tomatoes to 20", "reduce the order
 * by 2 crates", "make that 20".
 *
 * ADDITIVE LANGUAGE ONLY. This must not fire on an ordinary order that happens
 * to say "20 boxes tomatoes" — it needs a verb that acts on something that
 * already exists ("add … to the order", "change … to", "make that"), which a
 * first order has no reason to use.
 */
const QUANTITY_CHANGE_RE =
  /\b(?:add|increase|reduce|decrease|amend|change|update)\b[^.!?\n]{0,60}\bto\s+(?:the\s+)?(?:p\.?o\.?|purchase\s+order|order|requisition)\b|\b(?:add|increase|reduce|decrease)\s+\d+[^.!?\n]{0,40}\bto\s+(?:p\.?o\.?|the\s+order|our\s+order)\b|\bmake\s+(?:that|it)\s+\d+\b|\b(?:change|amend|update)\s+(?:the\s+)?(?:qty|quantity|quantities)\b/i;

/**
 * "please note we now need it before 10am", "revised instructions", "ignore the
 * note about pallets".
 *
 * THE WEAKEST CUE AND THE LAST ONE ASKED. It matches an instruction ABOUT an
 * order rather than a change to any specific field, so on its own it would be
 * far too broad — which is why nothing reaches it without a referenced PO and a
 * zero-line read (see `detectOrderAmendment`'s gate).
 */
const INSTRUCTION_UPDATE_RE =
  /\b(?:revised|updated|amended|additional|new)\s+(?:delivery\s+)?instructions?\b|\b(?:please\s+)?(?:note|be\s+advised)\b[^.!?\n]{0,60}\b(?:p\.?o\.?|order|delivery)\b|\bignore\s+(?:the\s+|my\s+)?(?:previous|earlier|last)\b|\bamendment\s+to\s+(?:p\.?o\.?|order)\b/i;

/**
 * The PO reference, and it is the SAME family as
 * `classification-policy.ts`'s `PO_NUMBER_PATTERN` — deliberately quoted rather
 * than imported, because that one is tuned to widen a pool of documents that
 * get a second READ (loose is free there), and this one gates whether an
 * operational write runs (loose is not free here). The capture group is what
 * makes the difference: this has to hand back the digits themselves so the
 * linkage query has something to match on, and a pattern that only answers
 * yes/no cannot.
 *
 * Ordered alternatives: the labelled forms first ("purchase order 144583", "PO
 * No: 144583", "order #144583"), then bare "PO144583". Requires at least three
 * digits — a two-digit "PO 12" is far more likely to be a line reference than a
 * purchase order, and a wrong link is worse than no link.
 */
const REFERENCED_PO_RE =
  /\b(?:purchase\s+order|p\.?\s?o\.?|requisition|order)\s*(?:no\.?|number|nr\.?|#|ref(?:erence)?\.?)?\s*[:#-]?\s*([0-9][0-9/_-]{2,})\b|\bp\.?o\.?[-\s#]?([0-9]{3,}[0-9/_-]*)\b/i;

/** The referenced PO, verbatim and trimmed of trailing punctuation, or null. */
export function referencedPurchaseOrder(text: string | null | undefined): string | null {
  const match = REFERENCED_PO_RE.exec((text ?? '').slice(0, 20_000));
  const value = (match?.[1] ?? match?.[2] ?? '').replace(/[.,;:]+$/, '').trim();
  return value || null;
}

/**
 * The cue ladder, MOST SPECIFIC FIRST.
 *
 * Order matters and the reason is the PO 144583 sentence itself: "please cancel
 * today's delivery and deliver Wednesday instead" contains both a cancellation
 * verb and a date change, and it is a date change — the delivery is happening,
 * just not today. So cancellation is asked only after the date-change cue has
 * declined, and `instruction` is asked last because it is the catch-all.
 *
 * ADDRESS GOES ABOVE DATE for the same kind of reason, one rung up: "please
 * change the delivery address, we have moved to the new stores entrance" is a
 * sentence about a PLACE that happens to contain a change verb, a delivery and
 * a "to". The address cue is the stricter of the two — it demands the literal
 * word "address", or "deliver to … instead" — so asking it first costs the date
 * cue nothing ("change the delivery date to Wednesday" contains no address) and
 * stops a move of premises being filed as a move of dates.
 */
const CUE_LADDER: [RegExp, OrderAmendmentType][] = [
  [ADDRESS_CHANGE_RE, 'address_change'],
  [DELIVERY_DATE_CHANGE_RE, 'delivery_date_change'],
  [QUANTITY_CHANGE_RE, 'quantity_change'],
  [HOLD_RE, 'hold'],
  [CANCELLATION_RE, 'cancellation'],
  [INSTRUCTION_UPDATE_RE, 'instruction'],
];

/** The business event each amendment kind maps to. Only three of the six get
 *  their own event; the rest are ordinary amendments, because a hold and a
 *  cancellation are the two whose consequences differ enough to name. */
const EVENT_BY_AMENDMENT: Record<OrderAmendmentType, OrderBusinessEvent> = {
  delivery_date_change: 'order_amendment',
  quantity_change: 'order_amendment',
  address_change: 'order_amendment',
  cancellation: 'order_cancellation',
  hold: 'order_hold',
  instruction: 'order_instruction_update',
};

/** The whole amendment family — every event that is NOT a new order. A gate
 *  that asks `=== 'new_order'` instead would call every legacy row (which has
 *  no `business_event` at all) an amendment on the day this shipped. */
const AMENDMENT_EVENTS: readonly OrderBusinessEvent[] = [
  'order_amendment',
  'order_cancellation',
  'order_hold',
  'order_instruction_update',
];

/** Does this event mean "change something that already exists", i.e. run NO
 *  order side effects? Absent and 'new_order' both answer no. */
export function isAmendmentEvent(event: OrderBusinessEvent | null | undefined): boolean {
  return !!event && AMENDMENT_EVENTS.includes(event);
}

/** The same question of a whole document, for the callers that hold a row
 *  rather than an event. Reads only `extracted_data`, so it answers correctly
 *  for a legacy order (no key → not an amendment). */
export function isOrderAmendmentDocument(doc: {
  document_type?: string | null;
  // `Partial<ExtractedData>` rather than a `Pick` of the one key it reads: every
  // caller holds a whole row, and a narrower parameter would make them build a
  // second object to satisfy this signature — which is how a caller ends up
  // passing a stale copy of the key that decides whether an order is created.
  extracted_data?: Partial<ExtractedData> | null;
}): boolean {
  return doc.document_type === 'order' && isAmendmentEvent(doc.extracted_data?.business_event);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * WHAT KIND OF THING IS UNDER DETECTION — the category error PO JBG0118352
 * exposed, named so it cannot be made silently again.
 *
 * 'message' is what this detector was built for: an email ABOUT an order.
 * Everything it says is the sender talking, so all of it is evidence.
 *
 * 'formal_document' is the attachment lane — a PDF, an image, or an HTML
 * purchase order. There the document under detection IS the order, and its own
 * prose is not somebody asking for a change; it is contract text that a formal
 * PO is GUARANTEED to contain ("…reserves the absolute right to cancel this
 * Order"). So its prose is not evidence of intent at all: only the covering
 * message speaks, and the document itself is allowed exactly one thing — to
 * declare its own STATUS through `documentText`.
 */
export type AmendmentSourceKind = 'message' | 'formal_document';

/**
 * Which lane a stored `source_type` puts a document in.
 *
 * A pdf, an image or an HTML attachment is a FORMAL DOCUMENT — somebody's
 * printed purchase order, arriving beside a covering email. An email body is a
 * MESSAGE, and so is an upload with no source type at all: on that path there
 * is no covering message to separate the document from, the inputs are exactly
 * what they have always been, and layers 2 and 3 are what stand between an
 * uploaded PO's footer and a false cancellation.
 *
 * A spreadsheet is left on the message lane deliberately. Nothing in this
 * task's evidence says how one arrives or what its `order_notes` absorb, and
 * moving a lane nobody has looked at is a change made on no evidence.
 */
export function formalDocumentSourceKind(
  sourceType: DocumentSourceType | null | undefined,
): AmendmentSourceKind {
  return sourceType === 'pdf' || sourceType === 'image' || sourceType === 'html'
    ? 'formal_document'
    : 'message';
}

export interface AmendmentDetectionInput {
  /** The subject line, when the source is an email. */
  subject?: string | null;
  /**
   * THE MESSAGE-CONTEXT TEXT — the covering email's body, and on the formal
   * document lane never the document's own words. Bounded by the caller.
   */
  text?: string | null;
  /**
   * The formal document's OWN text, read for explicit status evidence and
   * nothing else. Ignored entirely on the 'message' lane, where `text` already
   * is the message. Never feeds the cue ladder.
   */
  documentText?: string | null;
  /** Which lane this is. Absent means 'message' — today's behaviour, so every
   *  existing caller and every existing test keeps its exact inputs. */
  sourceKind?: AmendmentSourceKind | null;
  /** The delivery date the reader picked up. A date to deliver ON is a thing a
   *  live order has and a cancelled one does not. */
  requestedDeliveryDate?: string | null;
  /** What the order reader put in `order_notes` — often the only place the
   *  change survives, because it is the one free-text field the prompt fills. */
  orderNotes?: string | null;
  /** The PO the reader picked up, if any. Preferred over one dug out of text. */
  extractedPurchaseOrderNumber?: string | null;
  /** How many line items the read produced. Zero is the strongest single signal
   *  that this message is about an order rather than being one. */
  lineCount: number;
}

export interface AmendmentDetection {
  event: OrderBusinessEvent;
  amendment: OrderAmendment | null;
}

/** The sentence a cue matched, quoted and bounded — evidence, never a summary. */
function quotedSentence(haystack: string, index: number): string | null {
  const start = haystack.lastIndexOf('.', index) + 1;
  const endMark = haystack.slice(index).search(/[.!?\n]/);
  const end = endMark === -1 ? haystack.length : index + endMark;
  return haystack.slice(start, end).trim().slice(0, 300) || null;
}

/**
 * The first occurrence of `pattern` whose preceding window is NOT rights or
 * conditional language — or null when every occurrence is.
 *
 * ALL OCCURRENCES, not just the first, because both can be on one page. A
 * purchase order that says "please cancel PO 144583" in its covering note and
 * carries the standard "reserves the right to cancel this Order" footer must
 * still be read as a cancellation: the guard removes the boilerplate one and
 * keeps looking rather than giving up on the first sight of legal prose.
 */
function firstUnqualifiedMatch(haystack: string, pattern: RegExp): number | null {
  const scanner = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  for (let match = scanner.exec(haystack); match; match = scanner.exec(haystack)) {
    const window = haystack.slice(Math.max(0, match.index - BOILERPLATE_WINDOW_CHARS), match.index);
    if (!BOILERPLATE_WINDOW_RE.test(window)) return match.index;
    // A zero-width match would spin here forever; every cue consumes at least
    // one character, but the guard costs one line and removes the question.
    if (scanner.lastIndex === match.index) scanner.lastIndex += 1;
  }
  return null;
}

/**
 * Where this text SAYS the order was cancelled — as opposed to saying it could
 * be. Null when it only ever says the second thing, which is what a Conditions
 * of Purchase footer says and all it says.
 */
function transactionalCancellationIndex(haystack: string): number | null {
  let earliest: number | null = null;
  for (const re of TRANSACTIONAL_CANCELLATION_RES) {
    const at = firstUnqualifiedMatch(haystack, re);
    if (at !== null && (earliest === null || at < earliest)) earliest = at;
  }
  return earliest;
}

/**
 * Decide what an order-classified message is actually asking for.
 *
 * THE GATE, in the plan's words and in this order: an amendment cue, AND a
 * referenced PO, AND (zero extracted lines OR explicit change language).
 *
 * ALL THREE, because each one alone is a false positive waiting to happen. A
 * cue alone catches "please cancel my subscription". A PO alone is on every
 * ordinary purchase order ever printed. Zero lines alone is the Four Seasons
 * portal notification, which is a real order living somewhere else. Together
 * they describe one thing: a message that names an order that already exists
 * and asks for something to be done to it.
 *
 * "EXPLICIT CHANGE LANGUAGE" is the disjunct that lets a message carrying lines
 * still be an amendment — "add 4 boxes tomatoes to PO 144583" has a line in it
 * and is emphatically not a new order. It is deliberately narrower than the cue
 * ladder: only the cues that name a change to an EXISTING thing qualify, so a
 * perfectly ordinary order with a delivery date on it cannot trip it.
 *
 * Returns `new_order` — the ordinary answer — whenever the gate does not close,
 * and that asymmetry is the same one `businessEffectForType` makes: the value
 * that REMOVES work is asserted only from explicit signal.
 *
 * THE SECOND FAILURE THIS CLOSES. PO JBG0118352 arrived as an HTML purchase
 * order attached to an email: four correct lines (Chillies Red 2KG, Peppers
 * Mixed 5KG, Tomatoes 10KG, Potatoes New 10KG), a total, a requested delivery
 * date, a named contact — and it was stamped `order_cancellation` off one
 * sentence in its own Conditions of Purchase footer. The gate did not
 * misjudge the evidence; it was handed the wrong evidence and then asked the
 * wrong question of it. All three of those are fixed here and none of them
 * alone would have been enough:
 *
 *   1. INPUT SCOPE (`sourceKind`) — a formal document's own prose is not
 *      somebody asking for a change, so it never reaches the cue ladder.
 *   2. THE WINDOW GUARD — "reserves the right to cancel" is not "cancel".
 *   3. THE LINES LEG — a cancellation cue on a document that priced four line
 *      items must show that a cancellation actually happened.
 */
export function detectOrderAmendment(input: AmendmentDetectionInput): AmendmentDetection {
  const formalDocument = input.sourceKind === 'formal_document';
  // LAYER 1 — INPUT SCOPE. On the formal-document lane the only voice in the
  // cue haystack is the covering message's: no `order_notes` (the reader
  // absorbs the document's own prose into it, T&C included) and no document
  // text. On the message lane the inputs are byte-for-byte what they were.
  const haystack = stripBoilerplateSections(
    formalDocument
      ? [input.subject ?? '', input.text ?? ''].join('\n').slice(0, 20_000)
      : [input.subject ?? '', input.orderNotes ?? '', input.text ?? ''].join('\n').slice(0, 20_000),
  );
  // The one thing a formal document is allowed to say about itself: its status.
  // Read for the positive patterns only — never for the cue ladder.
  const statusHaystack = formalDocument
    ? `${haystack}\n${stripBoilerplateSections((input.documentText ?? '').slice(0, 20_000))}`
    : haystack;
  if (!haystack.trim() && !statusHaystack.trim()) return { event: 'new_order', amendment: null };

  const statusCancellationIndex = transactionalCancellationIndex(statusHaystack);
  const transactionalCancellation = statusCancellationIndex !== null;

  // LAYER 2 — the cue must survive the rights/conditional window guard.
  const laddered = CUE_LADDER.map(
    ([pattern, amendmentType]) => [firstUnqualifiedMatch(haystack, pattern), amendmentType] as const,
  ).find(([index]) => index !== null);

  // THE ONE THING A FORMAL DOCUMENT MAY SAY ABOUT ITSELF. Its prose is barred
  // from the cue ladder above, so a purchase order printed "Status: Cancelled"
  // would otherwise have no way to say so at all — which would trade one
  // wrong answer for another. An explicit status line is not contract text: it
  // is the document stating its own state, and it is admitted on that lane
  // ALONE. The message lane's inputs and verdicts are untouched by this.
  let cueIndex: number;
  let amendmentType: OrderAmendmentType;
  let quoteSource: string;
  if (laddered) {
    [cueIndex, amendmentType] = laddered as [number, OrderAmendmentType];
    quoteSource = haystack;
  } else if (formalDocument && statusCancellationIndex !== null) {
    cueIndex = statusCancellationIndex;
    amendmentType = 'cancellation';
    quoteSource = statusHaystack;
  } else {
    return { event: 'new_order', amendment: null };
  }

  const referencedPo =
    (input.extractedPurchaseOrderNumber ?? '').trim() ||
    referencedPurchaseOrder(input.subject) ||
    referencedPurchaseOrder(haystack);
  // NO PO, NO AMENDMENT. Without a reference there is nothing to amend and
  // nothing to link to, and "cancel the order" with no order named is a
  // sentence for a human to read, not a routing decision. The document still
  // files, still reviews, and still behaves exactly as it did before.
  if (!referencedPo) return { event: 'new_order', amendment: null };

  // The change-language disjunct. `instruction` is excluded from it on purpose:
  // it is the catch-all cue, and letting it license an amendment on a message
  // that DID produce lines would reclassify ordinary orders whose notes say
  // "please note delivery before 10am".
  const explicitChangeLanguage = amendmentType !== 'instruction';
  if (input.lineCount > 0 && !explicitChangeLanguage) {
    return { event: 'new_order', amendment: null };
  }

  // LAYER 3 — GATE REPAIR, and the leg PO JBG0118352 walked straight through.
  //
  // `explicitChangeLanguage` used to be satisfied by the cue merely EXISTING,
  // so a document carrying four priced lines, a delivery date and a boilerplate
  // cancellation clause passed all three legs by construction — the cue was the
  // cue, the PO was its own PO, and the lines leg was bypassed. Now the two cues
  // whose consequence is "this order is off" have to earn it: with lines on the
  // page, a cancellation or a hold needs evidence that somebody actually
  // cancelled or asked to ("Status: Cancelled", "please cancel", "do not
  // deliver"), not evidence that a contract permits it.
  //
  // The transactional marker OVERRIDES REGARDLESS OF LINES: a purchase order
  // stamped "Status: Cancelled" is cancelled with all four lines still on it.
  if ((amendmentType === 'cancellation' || amendmentType === 'hold') && input.lineCount > 0 && !transactionalCancellation) {
    return { event: 'new_order', amendment: null };
  }
  // The positive strengthener, stated separately because it is a different
  // claim: a document that declares itself accepted, prices lines and names a
  // day to deliver them is a live order in its own words. PO JBG0118352 is all
  // three at once.
  if (
    input.lineCount > 0 &&
    (input.requestedDeliveryDate ?? '').trim() &&
    !transactionalCancellation &&
    ACCEPTED_STATUS_RE.test(statusHaystack)
  ) {
    return { event: 'new_order', amendment: null };
  }

  return {
    event: EVENT_BY_AMENDMENT[amendmentType],
    amendment: {
      amendment_type: amendmentType,
      referenced_po: referencedPo,
      note: quotedSentence(quoteSource, cueIndex),
      // 'unresolved' UNTIL THE LOOKUP SAYS OTHERWISE. Detection is pure and has
      // no database; `resolveAmendmentLink` is what upgrades this, and a
      // caller that never runs it leaves an honest "we did not find the order"
      // rather than an unbacked claim that we did.
      link_status: 'unresolved',
    },
  };
}

// ---------------------------------------------------------------------------
// Linkage — READ ONLY
// ---------------------------------------------------------------------------

export interface AmendmentLinkCandidate {
  documentId: string;
  purchaseOrderNumber: string | null;
}

/**
 * Turn the candidate order documents into a link decision. PURE, so the
 * one-vs-none-vs-many rule is testable without a database.
 *
 * EXACTLY ONE MATCH LINKS. None is 'unresolved'. More than one is 'ambiguous',
 * and 'ambiguous' does NOT pick the newest, the highest-confidence or the one
 * whose customer matches — the same rule the customer matcher follows for the
 * same reason. Two live order documents carrying PO 144583 is a data question,
 * and a link this code invented would be indistinguishable from one it found.
 */
export function decideAmendmentLink(
  amendment: OrderAmendment,
  candidates: readonly AmendmentLinkCandidate[],
): OrderAmendment {
  if (candidates.length === 1) {
    return { ...amendment, link_status: 'linked', linked_order_document_id: candidates[0].documentId };
  }
  if (candidates.length > 1) return { ...amendment, link_status: 'ambiguous' };
  return { ...amendment, link_status: 'unresolved' };
}

/**
 * Find the live order document this amendment refers to, and say so.
 *
 * READ-ONLY, AND THAT IS THE WHOLE CONTRACT. There is no update, no insert, no
 * upsert and no rpc in this function, and there must never be one: the order
 * this returns is an order somebody has already reviewed, and the amendment
 * asking to change it has been reviewed by nobody. Every operational
 * consequence of an amendment — moving a date, cutting a quantity, cancelling —
 * is a human's click on a screen that does not exist yet.
 *
 * SUPERSEDED DOCUMENTS ARE EXCLUDED. A superseded row is the honest record of a
 * previous reading, not a live order, and linking an amendment to one would
 * point a reviewer at a document the product itself refuses to act on.
 *
 * Matches on `extracted_data->>purchase_order_number` — the key the extractor
 * has been storing all along and that nothing has ever looked up. On PO 144583
 * both documents carry "144583" in exactly that place.
 */
export async function resolveAmendmentLink(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    amendment: OrderAmendment;
    /** The amendment's own document, excluded so it cannot link to itself. */
    excludeDocumentId?: string | null;
  },
): Promise<OrderAmendment> {
  const po = (params.amendment.referenced_po ?? '').trim();
  if (!params.orgId.trim() || !po) return { ...params.amendment, link_status: 'unresolved' };

  const { data, error } = await supabase
    .from('documents')
    .select('id, org_id')
    .eq('org_id', params.orgId)
    .eq('document_type', 'order')
    .eq('extracted_data->>purchase_order_number', po)
    .is('superseded_at', null);
  // A FAILED READ IS 'unresolved', NEVER A LINK. Degrading to "we could not
  // find it" restores exactly the behaviour that shipped before this existed;
  // degrading to a guess would not.
  if (error) return { ...params.amendment, link_status: 'unresolved' };

  const candidates: AmendmentLinkCandidate[] = ((data ?? []) as Array<Record<string, unknown>>)
    // Re-filtered on the org even though the query was scoped: this can run
    // under a service-role client on the email lane, and every other read in
    // that lane re-checks the same way.
    .filter((row) => row.org_id === params.orgId && String(row.id) !== (params.excludeDocumentId ?? ''))
    .map((row) => ({ documentId: String(row.id), purchaseOrderNumber: po }));

  return decideAmendmentLink(params.amendment, candidates);
}
