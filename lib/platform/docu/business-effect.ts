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
import type { DocumentBusinessEffect, DocumentType, ExtractedData } from '../types.ts';

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
 * a sixth document type is then a COMPILE ERROR here until somebody has said,
 * in writing, whether the new type is allowed to move stock. A default arm
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
};

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
