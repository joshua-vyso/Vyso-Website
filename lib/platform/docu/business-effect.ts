/**
 * WHAT A DOCUMENT DOES TO THE BUSINESS — the one question every routing gate is
 * really asking, asked once, in one place.
 *
 * WHY THIS EXISTS. Doc-U had exactly one dimension, `document_type`, and every
 * downstream module keyed its allow-list on it: ProcurePulse feeds
 * invoice/statement/delivery_note, SupplySync denies 'order', Price Watch and
 * Hubdoc name their own lists. That works right up until a document arrives
 * that is SHAPED like an invoice and means nothing operationally. A Country
 * Club lunch slip is exactly that document: it has a merchant, a date, a VAT
 * line, priced rows and a total, so every shape-keyed list said yes — and the
 * restaurant became a suppliers row, the meal lines became stock, and R643.10
 * of lunch became a supplier's spend history.
 *
 * The fix is not another type in seven allow-lists. It is a SECOND dimension:
 * `document_type` says what the paper is, `business_effect` says what it moves.
 * Every gate that used to mean "is this operational?" can now ask that question
 * literally instead of inferring it from shape.
 *
 * THE STORED KEY IS A CONVENIENCE, NOT THE TRUTH. `extracted_data.business_effect`
 * is stamped at ingest, but it is jsonb — data a reader wrote — and it is absent
 * on every row filed before this module existed. So this function DERIVES the
 * effect from `document_type` whenever the stored key is missing or is not one
 * of the four known values, which is what makes a backfill unnecessary: a 2025
 * invoice with no stamp derives `operational_financial`, exactly as it has
 * always behaved.
 *
 * READ IT ONLY THROUGH HERE. A gate that reaches into the jsonb itself is a gate
 * that trusts the document about its own routing, and would also miss every
 * legacy row. There is one reader, and it is this file.
 *
 * PURE. No I/O, no React, no Supabase. `.ts`-suffixed relative imports because
 * `node --test` resolves neither extensionless ESM specifiers nor the `@/`
 * alias, and this module is loaded directly by tests/docu-business-effect.test.ts.
 */
import type {
  DocumentBusinessEffect,
  DocumentFinancialEffect,
  DocumentType,
  ExtractedData,
} from '../types.ts';

/** The four values the stored key is allowed to hold. Anything else in the
 *  jsonb is treated as absent and re-derived — a typo'd or hand-edited key must
 *  not be able to grant a document an effect the type system never issued. */
const KNOWN_EFFECTS = new Set<DocumentBusinessEffect>([
  'operational_financial',
  'financial_only',
  'operational_only',
  'informational',
]);

/**
 * The effect a document type carries, before anything is looked up.
 *
 * `Record<DocumentType, …>` ON PURPOSE, exactly as `routing.ts` does it: adding
 * another document type is then a COMPILE ERROR here until somebody has said,
 * in writing, whether the new type is allowed to move stock — which is how the
 * three credit types below got an answer rather than a default. A default arm
 * would have let `expense_receipt` inherit "operational" silently, which is the
 * failure this whole module exists to close.
 */
const EFFECT_BY_TYPE: Record<DocumentType, DocumentBusinessEffect> = {
  invoice: 'operational_financial',
  statement: 'operational_financial',
  delivery_note: 'operational_financial',
  order: 'operational_financial',
  // A price list bills nothing — it is a negotiation, not a purchase.
  price_list: 'operational_only',
  // The whole point of the type. Money moved; no stock, no order, no supplier.
  expense_receipt: 'financial_only',
  // ── THE THREE CREDITS ────────────────────────────────────────────────────
  //
  // `operational_financial`, and the choice is deliberate enough to need saying,
  // because `financial_only` looks like the obvious answer and is the wrong one.
  //
  // `financial_only` means "money moved, nothing operational did", and it is
  // read by exactly one gate: `isFinancialOnly`, which switches off the ENTIRE
  // downstream half of `runDocumentSideEffects` — including the SupplySync feed
  // that puts a document on a supplier's timeline. A supplier credit note
  // BELONGS on that timeline: it is the counterparty relationship doing
  // something, and CRN0012368 going missing from Eat Your Greens' history is
  // half of what went wrong with it.
  //
  // The exclusions these documents actually need are narrower and already
  // exist as allow-lists that name their members: FEED_TYPES (stock),
  // SPEND_DOC_TYPES (spend rollups), PRICED_DOC_TYPES ×2 (price observation),
  // WATCHED_DOC_TYPES (Doc Watch), HUBDOC_DOCUMENT_TYPES, and the sync-all
  // route's copy. None of them lists a credit type, so all six exclude these
  // three by construction on the day they ship — and tests/docu-credit-routing
  // asserts each one, because "excluded by default" is a property that has to
  // be re-checked every time somebody widens a list.
  //
  // So: the honest answer to "does this move stock/orders AND money" is that it
  // moves money and belongs to the operational relationship, and the places
  // that must not see it refuse it by name rather than by dimension.
  supplier_credit_note: 'operational_financial',
  customer_credit_request: 'operational_financial',
  customer_credit_note: 'operational_financial',
  // ── PROOF OF PAYMENT ─────────────────────────────────────────────────────
  //
  // `financial_only`, and the choice was between this and `informational`.
  //
  // THE CASE FOR `informational`: this document creates no financial event of
  // its own. The payment it evidences is already recorded in `of_payments` with
  // its amount, method, date and reference; the file is the paperwork behind a
  // figure that is already on the books. "Neither operational nor financial" is
  // an honest description of what it adds.
  //
  // WHY `financial_only` WINS ANYWAY: `isFinancialOnly` is the LOAD-BEARING
  // gate — the first thing `runDocumentSideEffects` asks, before the order
  // branch and before any feature lookup — and its documented contract is
  // exactly what a payment proof needs: "NO orders, NO invoices, NO stock
  // movements, NO supplier rows and NO SupplySync history, while remaining a
  // perfectly ordinary document to file, review and report on".
  // `informational` buys none of that; it would leave this type relying
  // entirely on downstream allow-lists, which is the shape of the failure this
  // whole module exists to close.
  //
  // AND IT COSTS NOTHING SEMANTICALLY, because of a fact worth checking before
  // reusing this value again: EVERY reader of `isFinancialOnly` today uses it
  // to REFUSE work — the side-effect gate, the SupplySync feed, the price
  // observer, the flags engine, the supplier-resolution skip. Not one of them
  // reads it as "therefore an expense exists". Sharing the value with
  // `expense_receipt` therefore shares only the refusals, which both types
  // want, and none of the meaning, which they do not.
  //
  // THE TWO ARE KEPT APART BY `document_type`, everywhere it matters: their own
  // label, their own tile and folder, their own empty routing rule, and the
  // `expense_receipt`-only gate on ReceiptReviewCard — so a bank pop never
  // draws the card that asks a reviewer to categorise a meal. See the
  // DocumentType comment for why a R643.10 EFT confirmation and a R643.10
  // restaurant slip must never be the same row.
  payment_proof: 'financial_only',
};

/**
 * WHICH WAY A CREDIT POINTS — a pure function of the settled document type, and
 * of nothing else.
 *
 * The direction of a credit is the one fact a language model must never supply,
 * because reversing it moves money the wrong way in both sets of books at once.
 * The classification lane decides WHAT the paper is (with the same
 * direction evidence that already separates an incoming invoice from an
 * outgoing one — see document-direction.ts); this converts that settled answer
 * into the financial statement, deterministically, with no second opinion
 * available to disagree with it.
 *
 * NULL FOR EVERY NON-CREDIT TYPE. An invoice has a financial effect too, of
 * course — but it is the ordinary one every module already assumes, and
 * stamping a value here for it would invite a gate to switch on this key
 * instead of on the allow-list it should be using.
 *
 * NOTHING IS POSTED FROM THIS. It is a label the review card reads out and the
 * key a future AR/AP integration would key on. No AR, no AP, no stock, no
 * average cost, no Xero write happens because of it today.
 */
export function financialEffectForType(
  type: DocumentType | null | undefined,
): DocumentFinancialEffect | null {
  switch (type) {
    case 'supplier_credit_note':
      return 'reduces_payable';
    case 'customer_credit_request':
      return 'pending_credit_request';
    case 'customer_credit_note':
      return 'reduces_receivable';
    default:
      return null;
  }
}

/** The three credit paper kinds, as one list, so no caller has to spell them
 *  out again and get two of the three right. */
export const CREDIT_DOCUMENT_TYPES = [
  'supplier_credit_note',
  'customer_credit_request',
  'customer_credit_note',
] as const satisfies readonly DocumentType[];

/** Is this one of the three credit papers? */
export function isCreditDocumentType(type: DocumentType | null | undefined): boolean {
  return !!type && (CREDIT_DOCUMENT_TYPES as readonly string[]).includes(type);
}

/**
 * Is this credit one the ORG issued or is being asked for — i.e. customer-side?
 *
 * The distinction decides which resolver may run at ingest. A customer-side
 * credit must never go through supplier resolution: `resolveSupplierProfile`
 * CREATES a suppliers row, and running it on a Montecasino credit request would
 * make the org's own customer into one of its vendors. Kept as a named
 * predicate rather than a comparison at the call site because it is asked in
 * two lanes and a `!== 'supplier_credit_note'` in either of them reads as an
 * accident.
 */
export function isCustomerSideCredit(type: DocumentType | null | undefined): boolean {
  return type === 'customer_credit_request' || type === 'customer_credit_note';
}

/**
 * The effect for a type alone — used to STAMP a freshly classified document, and
 * as the fallback when a stored stamp is missing.
 *
 * A NULL OR UNRECOGNISED TYPE IS `operational_financial`, and that asymmetry is
 * deliberate. `financial_only` is the only value that REMOVES work: it switches
 * off order sync, stock, supplier creation and SupplySync in one move. An
 * unclassified document — a failed read, a row inserted before the type was
 * decided — is precisely the document we know least about, and answering "no
 * operational effect" for it would silently drop side effects that have always
 * run. We assert the quiet answer only from an explicit signal; absence of
 * information gets the loud one.
 */
export function businessEffectForType(type: DocumentType | null | undefined): DocumentBusinessEffect {
  if (!type) return 'operational_financial';
  return EFFECT_BY_TYPE[type] ?? 'operational_financial';
}

/**
 * What this document moves. THE gate — every routing exclusion in the financial
 * lane is `documentBusinessEffect(doc) === 'financial_only'`.
 *
 * Takes the narrow shape rather than a full `Document` so the pure gates, the
 * ingest pipeline and the review UI can all ask it of whatever row they happen
 * to be holding (a claim row, a feed row, a `DocumentWithSupplier`) without any
 * of them constructing a document they do not have.
 *
 * The stored stamp wins when it is present AND valid; otherwise the type
 * decides. Both paths land in the same answer for every document filed since
 * the stamp existed — the stamp is a record of a decision, not a second opinion
 * about it.
 */
export function documentBusinessEffect(doc: {
  document_type: DocumentType | null;
  extracted_data: ExtractedData | null;
}): DocumentBusinessEffect {
  const stored = doc.extracted_data?.business_effect;
  if (stored && KNOWN_EFFECTS.has(stored)) return stored;
  return businessEffectForType(doc.document_type);
}

/**
 * Is this document barred from every operational write?
 *
 * Named separately from the comparison it performs because it is read at four
 * call sites that have nothing else in common (the side-effect choke point, the
 * SupplySync feed, the price observer, the flags engine), and a bare `===
 * 'financial_only'` at each of them is four places to forget what the string
 * means. It also states the rule in the positive: this returns true for
 * documents that must produce NO orders, NO invoices, NO stock movements, NO
 * supplier rows and NO SupplySync history — while remaining perfectly ordinary
 * documents to file, review, reconcile and report on.
 */
export function isFinancialOnly(doc: {
  document_type: DocumentType | null;
  extracted_data: ExtractedData | null;
}): boolean {
  return documentBusinessEffect(doc) === 'financial_only';
}
