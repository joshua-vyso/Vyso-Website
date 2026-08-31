/**
 * Canonical TypeScript types for the Vyso platform.
 *
 * This file is the single source of truth for the data model and is mirrored
 * into each app (`website/lib/platform/types.ts`, `mobile/lib/types.ts`). Keep
 * the copies byte-identical — only edit this canonical version and re-copy.
 */

/** Every feature-gateable module. Matches `org_features.feature_key`. */
export type FeatureKey =
  | 'docu'
  | 'procurepulse'
  | 'pricepilot'
  | 'marginview'
  | 'wastelog'
  | 'shiftboard'
  | 'orderflow'
  | 'reportgen'
  | 'suppliers';

/** Whether a module is live or marketed as upcoming. */
export type ModuleStatus = 'active' | 'soon';

/** The AppIcon master assets exported from Figma (`/assets/icons/*.svg`). */
export type AppIconKey =
  | 'docu'
  | 'proc'
  | 'margin'
  | 'waste'
  | 'shift'
  | 'supplier'
  | 'dash';

export type OrgTier = 'start' | 'build' | 'scale';
export type UserRole = 'owner' | 'admin' | 'member';
export type DocumentStatus =
  | 'pending'
  | 'extracted'
  | 'reviewed'
  | 'error'
  | 'approved'
  | 'rejected'
  | 'archived';
export type DocumentType =
  | 'invoice'
  | 'statement'
  | 'delivery_note'
  | 'price_list'
  | 'order'
  /** A till slip: restaurant, fuel, hotel, parking — consumption the business
   *  PAID FOR, as opposed to stock it bought to sell on. The distinction is not
   *  cosmetic. Until this type existed a Country Club lunch classified as
   *  'invoice' and was therefore filed as a supplier bill: the restaurant became
   *  a suppliers row, its meal lines became ProcurePulse stock, and its total
   *  joined that "supplier's" spend history. "Not operationally relevant" is not
   *  the same as "financially irrelevant" — the expense is real and belongs in
   *  Doc-U; it simply has no order, no stock and no supplier behind it. See
   *  lib/platform/docu/business-effect.ts for the dimension that enforces that. */
  | 'expense_receipt';

/**
 * WHAT A DOCUMENT DOES TO THE BUSINESS, as opposed to what it looks like.
 *
 * `document_type` answers "what is this piece of paper"; this answers the
 * question every downstream module was actually asking when it switched on the
 * type — "does this move stock/orders/suppliers, does it move money, or
 * neither?" Those are two questions, and collapsing them into one is what let a
 * restaurant receipt walk into ProcurePulse: it is shaped like an invoice, so
 * every allow-list keyed on shape said yes.
 *
 *   - `operational_financial` — the ordinary case. Stock or orders move AND
 *     money moves: invoices, statements, delivery notes, customer orders.
 *   - `financial_only` — money moved, nothing operational did. Expense
 *     receipts. HARD-EXCLUDED from every operational write; still reviewed,
 *     still reconciled, still an expense.
 *   - `operational_only` — informs operations, bills nothing. A price list.
 *   - `informational` — neither. Reserved; nothing derives it today.
 *
 * Stored additively in `extracted_data.business_effect` and DERIVED from
 * `document_type` when that key is absent, so no historical row needs a
 * backfill. Read it ONLY through `documentBusinessEffect` — the raw key is
 * jsonb a reader wrote, and a gate that trusts it directly is a gate that
 * trusts the document about its own routing.
 */
export type DocumentBusinessEffect =
  | 'operational_financial'
  | 'financial_only'
  | 'operational_only'
  | 'informational';

/**
 * WHAT ACTUALLY HAPPENED TO CASH, and — far more importantly — what did not.
 *
 * A receipt dated today is not evidence of money leaving a bank account today.
 * The Country Club slip settles against a PRE-FUNDED member balance: the cash
 * left the bank on whatever day that balance was topped up, which the receipt
 * does not print and we therefore do not know. Recognising the expense on the
 * receipt date is correct; asserting a bank movement on that date is a
 * fabrication a bookkeeper would have to unpick.
 *
 * So there are exactly two values, and neither of them names a bank:
 *   - `prefund_drawdown` — the paper printed opening/settlement/closing figures
 *     AND they reconcile, so we can say the member balance went down. That is a
 *     statement about the balance, not about the bank.
 *   - `unknown` — everything else, INCLUDING a receipt that plainly says "Card".
 *     A card slip does not tell us when the acquirer settled either.
 *
 * There is deliberately no 'direct' member. The moment one exists somebody will
 * post it to a cash account on the receipt's date.
 */
export type CashEffect = 'prefund_drawdown' | 'unknown';

/**
 * An expense receipt's money, exactly as the till printed it.
 *
 * EVERY FIGURE IS A VERBATIM STRING and "" means the paper printed nothing —
 * the same contract as `OrderDocumentTotals` below, for the same reason: the
 * moment one of these becomes a number, somebody has decided what "1 234,56"
 * means, and that decision belongs to the shared locale-aware parser at the
 * point of use (steered by the document's own separator hint), never to the
 * reader and never twice.
 *
 * NOTHING HERE IS EVER COMPUTED — not by the model, not by us. A subtotal we
 * derived from the lines would agree with the lines by construction, and
 * `reconcileFinancialDocument` would then be checking our arithmetic against
 * itself instead of against the paper. The whole value of this block is that
 * every figure in it is an independent witness.
 *
 * See lib/platform/docu/financial-document.ts for what is asked of these
 * figures and — the longer list — what is deliberately not.
 */
export interface FinancialDocument {
  /** The trading name on the slip ("The Country Club Johannesburg"). */
  merchant: string;
  /** Bill/table/slip/invoice number as printed. */
  receipt_reference: string;
  /** Date and (when printed) time, exactly as shown — never normalised here. */
  receipt_datetime: string;
  /** Member/account/room/card-holder identifier the slip is charged against. */
  member_or_account: string;
  /** Goods/food subtotal BEFORE any gratuity, as printed. */
  subtotal: string;
  /** Service charge / tip, as printed. It is NOT tax and never enters the VAT
   *  figure — see the reconciliation module's docblock. */
  gratuity: string;
  /** VAT as printed, and on a South African till slip this is VAT ALREADY
   *  INCLUDED IN the total, not an amount to add to it. */
  tax_amount: string;
  /** The slip's own grand total. */
  total: string;
  /** Currency symbol/code as printed ("R", "ZAR"), or "". */
  currency: string;
  /** "Card", "Cash", "Member account", "Room charge" — as printed. */
  payment_method: string;
  /** The account the settlement was taken from, when the slip names one. */
  funding_account: string;
  /** Pre-fund/member balance BEFORE this settlement, when printed. */
  opening_balance: string;
  /** The amount settled, POSITIVE — never the signed movement in a balance
   *  column. See reconcileFinancialDocument for why the sign matters. */
  settlement_amount: string;
  /** Balance AFTER this settlement, when printed. */
  closing_balance: string;
  /** Anything else the reviewer would want quoted. */
  notes: string;
  /** One of EXPENSE_CATEGORIES, suggested by the reader and validated against
   *  that list (an unrecognised suggestion becomes null, never a new category).
   *  The reviewer can change it and nothing locks it — see expense-categories.ts. */
  expense_category?: string | null;
  /** Derived, never transcribed: `deriveCashEffect` in financial-document.ts. */
  cash_effect: CashEffect;
}

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  tier: OrgTier;
  created_at: string;
  /** Module feature-keys this org may NOT open (locked in the sidebar). Empty = all open. */
  locked_modules?: string[];
  /** Onboarding/trial columns (see supabase/onboarding.sql). All optional — the
   *  app tolerates them being absent on orgs created before that migration. */
  industry?: string | null;
  /** Employee-count band: '1-5'|'6-20'|'21-50'|'51-200'|'200+'. */
  employee_count?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  /** 'profile'|'modules'|'data'|'done'. Existing orgs backfilled to 'done'. */
  onboarding_stage?: string | null;
  onboarding_completed_at?: string | null;
}

export interface OrgFeature {
  id: string;
  org_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  org_id: string | null;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  initials: string | null;
  location: string | null;
  contact_email: string | null;
  created_at: string;
}

/** A single extracted key/value pair with an OCR/model confidence (0–100). */
export interface ExtractedField {
  label: string;
  value: string;
  confidence: number;
}

/** A single product line from a statement/invoice table. */
export interface ExtractedLineItem {
  reference?: string;
  description: string;
  /** For uploaded customer ORDERS: the product text EXACTLY as printed on the
   *  paper, before any catalogue resolution. Product matching runs on THIS, and
   *  review shows it beside whatever it was matched to — a rewritten name is a
   *  suggestion, never the only surviving record of what the customer wrote.
   *  See lib/platform/docu/order-line-match.ts. */
  raw_description?: string;
  /** For uploaded customer ORDERS: the LINE TOTAL exactly as printed in the
   *  row's own amount/nett column, before anything of ours touched it. The only
   *  independent witness to the figures on the row — the review editor checks
   *  quantity × unit price against it and warns when they disagree, which is
   *  what catches a transposed digit ("560.90" against a printed 569.90).
   *  Never computed; blank when the document prints no amount column.
   *  See lib/platform/docu/order-line-totals.ts. */
  raw_amount?: string;
  /** For uploaded customer ORDERS whose paper prints a TAX-BEARING row: that
   *  row's own VAT figure, its printed rate, its printed tax code, and the
   *  VAT-INCLUSIVE row total — each verbatim, each blank when the row prints no
   *  such column.
   *
   *  ADDITIVE, AND BESIDE `raw_amount` RATHER THAN INSTEAD OF IT. `raw_amount`
   *  stays exactly what it has always been, the NET/goods column, and `amount`
   *  keeps its current meaning everywhere downstream — nothing here is ever
   *  read by OrderFlow, ProcurePulse or SupplySync. What these close is an
   *  AMBIGUITY, not a gap: a row printing Net 338.00, VAT 50.70 and Total
   *  388.70 was readable three ways, and whichever figure the reader chose for
   *  `raw_amount` decided whether the review screen went red — 1 × 338.00
   *  against a printed 388.70 is a false alarm on a perfectly correct read, and
   *  a false alarm is how a real one stops being read. Three named columns mean
   *  the reader never has to choose. Never computed by us or by the model;
   *  blank is the honest answer, and the reconciliation depends on it being one.
   *  See lib/platform/docu/order-line-totals.ts. */
  raw_tax_amount?: string;
  /** The rate as PRINTED ("15%", "15,00", "Z") — text, not a multiplier. We
   *  never apply it: a rate we computed with would make the cross-check agree
   *  with itself. It is shown to the reviewer and nothing else. */
  tax_rate?: string;
  /** The row's tax/VAT code exactly as printed ("A", "S1", "ZR"), or blank. */
  tax_code?: string;
  /** The VAT-INCLUSIVE row total as printed. NEVER written into `amount` or
   *  `unit_price` — both of those are net everywhere they are read. */
  raw_total_amount?: string;
  /** Unit price exactly as printed, before locale-aware canonicalisation. */
  raw_unit_price?: string;
  /** For uploaded customer ORDERS whose paper prints TWO quantity columns: the
   *  outer/pack figure and the unit it counts ("4", "Box"). Blank on the many
   *  documents with a single quantity column. Captured separately because
   *  collapsing the two columns into one number is what produced "Avocado 4.00
   *  boxes @ 15.75 = R63" against a printed nett of 756.00 — the cost on that
   *  paper is per EACH, and which column it multiplies is not guessable from the
   *  cost alone. See lib/platform/docu/row-arithmetic.ts. */
  bulk_quantity?: string;
  bulk_unit?: string;
  /** The inner/each figure of the same two-column layout ("48"). */
  unit_quantity?: string;
  /** Which pairing of columns reproduced the row's own printed total, stamped by
   *  `applyRowArithmetic`. Absent when the row needed no resolving or when
   *  nothing reconciled — a decision left inspectable rather than silent. */
  arithmetic_basis?: string;
  /** Provenance for the headline quantity. Additive for historical rows. */
  quantity_source?: 'printed' | 'derived' | 'unresolved';
  weight?: string;
  quantity?: string;
  units_per_box?: string;
  /** Total kilograms for the line = weight × quantity (Doc-U computes it). */
  total_kg?: string;
  /** Counting unit the quantity is measured in: boxes / punnets / bags / kg … */
  unit?: string;
  /** Per-line seller/agent — set only on multi-vendor docs (e.g. a market
   *  statement's AGENT column); empty on single-supplier invoices. */
  supplier?: string;
  unit_price?: string;
  amount?: string;
  confidence: number;
}

/**
 * The FOOTER totals an order document prints on itself, verbatim.
 *
 * Every field is optional because every one of them is optional on the paper,
 * and an absent field is load-bearing: `reconcileDocumentTotals` SKIPS a check
 * it has no printed figure for rather than treating the gap as a zero. A
 * document that prints a grand total and no freight line is not a document
 * whose freight is R 0.00 — it is a document that told us nothing about
 * freight, and quietly adding zero to the sum is how a reconciliation starts
 * failing on correctly-read paper.
 *
 * STRINGS, not numbers, for the same reason every `raw_*` field is a string:
 * the moment this becomes a number somebody has decided what "1 234,56" means,
 * and that decision belongs to the one shared locale-aware parser
 * (lib/platform/locale-number.ts) at the point of use, steered by the whole
 * document's separator hint — never to the reader, and never twice.
 */
export interface OrderDocumentTotals {
  subtotal?: string;
  tax_total?: string;
  freight?: string;
  discount?: string;
  grand_total?: string;
}

/**
 * What KIND of thing the document arrived as.
 *
 * 'html' is a first-class source, not a fallback: the Four Seasons purchase
 * order arrives as a 26KB `text/html` file attachment carrying the complete PO
 * (twelve tables, a real line grid), and it was being discarded as
 * `ignored_non_document` while a link-only body was read for the order. NULL
 * stays reserved for historical and unknown sources — encoding "this is HTML" as
 * an absence would make a parsed PO indistinguishable from a row filed before
 * this column existed.
 *
 * The `documents_source_type_check` constraint must be widened before an 'html'
 * row can be written — see supabase/microsoft-graph-ingest.sql.
 */
export type DocumentSourceType = 'pdf' | 'image' | 'spreadsheet' | 'email_body' | 'html';
export type OrderEvidenceSource = 'attachment' | 'email_body' | 'both';

/**
 * THE THREE QUESTIONS ABOUT AN EMAIL SOURCE, kept apart on purpose.
 *
 * `body_content_kind` says what the message physically contained;
 * `body_parse_status` says how much of it Vyso could read; and
 * `canonical_order_status` says whether an order may be built from it. They were
 * one question until a link-only Four Seasons notification (no goods in it at
 * all) and a server-flattened Belair order form (a real 100-row table, shredded
 * in transit) both came out the same way: as an order with lines nobody sent.
 *
 * The verdicts are decided in lib/platform/docu/body-source-assessment.ts.
 */
export type BodyContentKind =
  | 'plain_text'
  | 'structured_html'
  | 'external_link'
  | 'malformed_structured_content'
  | 'informational'
  | 'unknown';

export type BodyParseStatus = 'complete' | 'partial' | 'unavailable' | 'unsafe_to_infer';

export type CanonicalOrderStatus = 'ready' | 'partial' | 'unavailable' | 'unsafe' | 'conflict';

/**
 * The system the order actually lives in, when the email only points at it.
 *
 * METADATA ONLY. Nothing in Vyso fetches `href`, follows a redirect, or reads
 * anything from `host` — it is stored so a REVIEWER can click it, and shown to
 * them with the sender's own displayed URL as the label rather than the tracking
 * wrapper the href usually is.
 */
export interface ExternalOrderSource {
  /** Deterministic from the hostname: 'birchstreet' | 'coupa' | 'sap_ariba' | null. */
  provider: string | null;
  host: string;
  href: string;
  link_text: string | null;
}

export interface BodySourceSignals {
  /** How many product-like values were visible in the source. */
  product_like_count: number;
  /** Share of extracted lines carrying a usable quantity, 0–1. */
  quantity_coverage: number;
}

export interface MessageOrderConflict {
  field: string;
  line_index?: number;
  attachment_value: string | null;
  email_body_value: string | null;
}

export interface MessageOrderFieldProvenance {
  source: OrderEvidenceSource;
  attachment_value?: string | null;
  email_body_value?: string | null;
  conflict?: boolean;
}

export interface MessageOrderLineProvenance {
  line_index: number;
  source: OrderEvidenceSource;
  raw_description: MessageOrderFieldProvenance;
  quantity: MessageOrderFieldProvenance;
  unit: MessageOrderFieldProvenance;
}

export interface MessageOrderEvidence {
  primary_source: 'attachment' | 'email_body' | 'combined';
  body_source_part_id: 'email-body';
  attachment_source_ids: string[];
  fields: Record<string, MessageOrderFieldProvenance>;
  lines: MessageOrderLineProvenance[];
  conflicts: MessageOrderConflict[];
  requires_review: boolean;
  multiple_order_sources: boolean;
  /** Original attachment extraction, retained so retries never merge a merge. */
  attachment_snapshot?: Record<string, unknown> | null;
  /**
   * WHAT THE SOURCE WAS AND WHETHER AN ORDER COULD HONESTLY BE BUILT FROM IT.
   *
   * All five keys are additive and absent on every row filed before them, which
   * is why nothing may read their absence as a verdict — an old body order has
   * no assessment, not an assessment of 'unknown'. Written by
   * lib/platform/docu/body-source-assessment.ts, which is the only module
   * allowed to decide them. They ride INSIDE this object rather than as new
   * top-level `extracted_data` keys precisely so they cross document-ingest's
   * named-key spread on the one key that is already named there.
   */
  body_content_kind?: BodyContentKind | null;
  body_parse_status?: BodyParseStatus | null;
  canonical_order_status?: CanonicalOrderStatus | null;
  /** The portal the order actually lives in. Recorded, NEVER fetched. */
  external_source?: ExternalOrderSource | null;
  detected_line_signals?: BodySourceSignals | null;
}

export interface CustomerInterpretationLinePreview {
  line_index: number;
  source_description: string;
  source_uom: string | null;
  interpreted_stock_item_id: string | null;
  interpreted_description: string | null;
  product_alias_id: string | null;
  product_alias_source: string | null;
  interpreted_uom: string | null;
  uom_rule_id: string | null;
  uom_rule_count: number | null;
  uom_conflict_rule_ids: string[];
}

export interface CustomerInterpretationPreview {
  customer_id: string;
  read_only: true;
  lines: CustomerInterpretationLinePreview[];
}

/** The shape stored in `documents.extracted_data` (jsonb). */
export interface ExtractedData {
  fields: ExtractedField[];
  line_items?: ExtractedLineItem[];
  /** The selling/issuing party extracted from the document header (the counterparty). */
  supplier?: string | null;
  /** For uploaded customer ORDERS (document_type='order'): the buying customer's
   *  name read from a WhatsApp contact header / email sender / handwritten note. */
  customer_name?: string | null;
  /** Confidence (0–100) that customer_name was read correctly. */
  customer_confidence?: number | null;
  /** Existing-customer link evidence. All fields are additive for old rows. */
  customer_id?: string | null;
  customer_match_confidence?: number | null;
  customer_match_method?: string | null;
  customer_match_reason?: string | null;
  customer_match_ambiguous?: boolean | null;
  customer_match_candidates?: Array<{
    customer_id: string;
    customer_name: string;
    score: number;
    reason: string;
  }> | null;
  customer_match_evidence?: {
    sender_email: string | null;
    sender_domain: string | null;
    sender_name: string | null;
    extracted_customer_name: string | null;
    purchase_order_number: string | null;
    delivery_location: string | null;
  } | null;
  purchase_order_number?: string | null;
  order_date?: string | null;
  requested_delivery_date?: string | null;
  delivery_location?: string | null;
  order_notes?: string | null;
  /** Message-level body/attachment reconciliation. Additive for old rows. */
  message_order_evidence?: MessageOrderEvidence | null;
  /** Existing customer mappings/rules evaluated without operational writes. */
  customer_interpretation_preview?: CustomerInterpretationPreview | null;
  /** For uploaded customer ORDERS: the document's own printed footer totals.
   *  Absent on every historical read and on the many orders that print no
   *  footer at all — which is why nothing may treat its absence as zero. See
   *  `OrderDocumentTotals` above and `reconcileDocumentTotals` in
   *  lib/platform/docu/order-line-totals.ts. */
  totals?: OrderDocumentTotals | null;
  /** For EXPENSE RECEIPTS: the slip's money, verbatim — see `FinancialDocument`.
   *  Absent on every other document type and on everything filed before this
   *  existed, which is why nothing may read its absence as "no expense". */
  financial_document?: FinancialDocument | null;
  /** What this document does to the business — stamped at ingest, DERIVED from
   *  `document_type` when absent so historical rows need no backfill. Never read
   *  this key directly: `documentBusinessEffect` (lib/platform/docu/business-effect.ts)
   *  is the only sanctioned reader, and every routing gate goes through it. */
  business_effect?: DocumentBusinessEffect | null;
  extraction_model?: string | null;
  extraction_warning?: string | null;
  /** Structural evidence-loss gate; additive for historical rows. */
  structure_audit?: {
    status: 'ok' | 'needs_review';
    score: number;
    line_count: number;
    suspicious_description_rows: number;
    missing_unit_rows: number;
    missing_unit_price_rows: number;
    missing_amount_rows: number;
    unsupported_box_default_rows: number;
    repeated_description_rows: number;
  } | null;
  /** Safe PDF orientation provenance. Contains angles only, never file data. */
  orientation_normalization?: {
    applied: boolean;
    original_rotation: number;
    selected_rotation: number;
    attempted_rotations: number[];
  } | null;
  image_pixels?: { width: number; height: number } | null;
  /** Set only when a non-order classification read triggered a second,
   *  order-lane read — lib/platform/docu/classification-policy.ts. True
   *  whether or not that second read WON: `escalation_order_score` and
   *  `escalation_classification_score` are always both present when this is
   *  set, so a reviewer can see how close the call was even when the
   *  classification read was the one kept. */
  escalated?: boolean | null;
  escalation_classification_score?: number | null;
  escalation_order_score?: number | null;
}

export interface Document {
  id: string;
  org_id: string;
  supplier_id: string | null;
  customer_id?: string | null;
  folder_id: string | null;
  filename: string;
  document_type: DocumentType | null;
  status: DocumentStatus;
  starred: boolean;
  confidence: number | null;
  extracted_data: ExtractedData | null;
  storage_path: string | null;
  /** Original provider attachment id for idempotent email-ingest retries. */
  source_attachment_id?: string | null;
  /** Original attachment MIME type; Storage keeps the same value as object metadata. */
  source_content_type?: string | null;
  /** Semantic source kind. Null on historical documents. */
  source_type?: DocumentSourceType | null;
  uploaded_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  /** Cached AI operational summary (typed as AiSummary in lib/platform/docu/types). */
  ai_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Document joined with a thin supplier projection — used by list/table views. */
export interface DocumentWithSupplier extends Document {
  supplier: Pick<Supplier, 'id' | 'name' | 'initials'> | null;
}

/** A user-created folder/category that documents are filed into. */
export interface DocumentFolder {
  id: string;
  org_id: string | null;
  name: string;
  starred: boolean;
  color: string | null;
  created_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// ProcurePulse — procurement intelligence (live stock derived from Doc-U)
// ---------------------------------------------------------------------------

/** Live stock status, derived from on-hand vs the low-stock threshold. */
export type StockStatus = 'in_stock' | 'low' | 'out';

export type PpNotificationKind =
  | 'low_stock'
  | 'new_direct_doc'
  | 'new_market_statement'
  | 'price_change'
  | 'reorder';

/** A tracked product and its live level (`pp_stock_items`). */
export interface StockItem {
  id: string;
  org_id: string;
  name: string;
  category: string | null;
  /** Pack / weight, e.g. "300g · 12/box". */
  pack: string | null;
  /** Counting unit — boxes / punnets / bunches / units. */
  unit: string;
  on_hand: number;
  low_threshold: number;
  avg_unit_price: number | null;
  /** Weighted avg kilograms per counting unit, derived by the Doc-U feed.
   *  Null when no weight data exists. kg on hand = on_hand × kg_per_unit. */
  kg_per_unit: number | null;
  currency: string;
  /** Signed % change vs last week. */
  trend_pct: number | null;
  cheapest_supplier: string | null;
  /** The Doc-U document that last fed this line. */
  source_document_id: string | null;
  /** Level chart series. */
  stock_history: number[] | null;
  /** Price chart series. */
  price_history: number[] | null;
  updated_at: string;
  created_at: string;
}

/** A manual reorder request the user adds on the Reordering page
 *  (`pp_reorder_requests`). Sits alongside the auto-suggested draft PO. */
export interface ReorderRequest {
  id: string;
  org_id: string;
  stock_item_id: string | null;
  product_name: string;
  qty: number;
  unit: string | null;
  supplier: string | null;
  note: string | null;
  /** open | ordered | fulfilled | cancelled */
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A confirmed/dismissed/pending product-name link (`pp_name_aliases`). */
export interface ProductAlias {
  id: string;
  org_id: string;
  raw_name: string;
  normalized_name: string | null;
  suggested_name: string | null;
  custom_name: string | null;
  /** The suggested / confirmed canonical target item. */
  stock_item_id: string | null;
  /** pending | confirmed | dismissed */
  status: string;
  /** exact | ai | manual (Phase 2). */
  method: string | null;
  /** AI confidence 0..100 (Phase 2). */
  confidence: number | null;
  ai_rationale: string | null;
  /** The discovered (fed) item a pending suggestion is FOR (Phase 2). */
  discovered_item_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A supplier's latest price for a stock item (`pp_item_suppliers`). */
export interface ItemSupplierPrice {
  id: string;
  org_id: string;
  stock_item_id: string;
  supplier_name: string;
  price: number;
  created_at: string;
}

/**
 * The append-only stock-movement vocabulary. Stock intelligence only — there is
 * NO wastage reason here (wastage is a separate Vyso module). Legacy rows may
 * still carry 'received'/'adjustment'; new writes use these typed reasons.
 */
export type MovementReason =
  | 'document_sync'
  | 'manual_adjustment'
  | 'count_adjustment'
  | 'order_received'
  | 'recipe_reserved'
  | 'recipe_consumed'
  | 'transfer';

/** A stock movement (`pp_movements`) — the append-only stock ledger. */
export interface StockMovement {
  id: string;
  org_id: string;
  stock_item_id: string;
  change: number;
  /** A MovementReason for new rows; legacy rows may carry other strings. */
  reason: string | null;
  source_label: string | null;
  source_document_id: string | null;
  occurred_at: string;
  created_at: string;
}

/** A ProcurePulse notification (`pp_notifications`). */
export interface PpNotification {
  id: string;
  org_id: string;
  kind: PpNotificationKind;
  title: string;
  body: string | null;
  stock_item_id: string | null;
  document_id: string | null;
  read: boolean;
  created_at: string;
}

/** Per-org ProcurePulse settings (`pp_settings`). */
export interface PpSettings {
  org_id: string;
  notify_low_stock: boolean;
  notify_direct_docs: boolean;
  notify_market_statements: boolean;
  notify_price_spikes: boolean;
  weekly_summary: boolean;
  default_supplier: string | null;
  quiet_hours: string | null;
  /** Org-defined units of measurement, on top of the built-ins (web-only column). */
  custom_units: string[] | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Stock-intelligence models (ProcurePulse rebuild). All org-scoped via RLS.
// ---------------------------------------------------------------------------

/** How a product is measured/converted across purchase, stock and recipe (`pp_product_units`). */
export interface ProductUnit {
  id: string;
  org_id: string;
  stock_item_id: string;
  purchase_unit: string | null;
  stock_unit: string | null;
  recipe_unit: string | null;
  /** Multiply a purchase unit by this to get stock units. */
  conversion_factor: number | null;
  updated_at: string;
}

/** A reusable unit conversion (`pp_unit_conversions`). */
export interface UnitConversion {
  id: string;
  org_id: string;
  from_unit: string;
  to_unit: string;
  factor: number;
}

/** Stock, freshness + reorder thresholds for a product (`pp_stock_thresholds`). */
export interface StockThreshold {
  id: string;
  org_id: string;
  stock_item_id: string;
  low_threshold: number | null;
  par_level: number | null;
  lead_time_days: number | null;
  freshness_value: number | null;
  /** 'hours' | 'days' */
  freshness_unit: string | null;
  alerts_enabled: boolean;
  notes: string | null;
  updated_at: string;
}

/** A stock replenishment order (`pp_stock_orders`). */
export interface StockOrder {
  id: string;
  org_id: string;
  supplier: string | null;
  /** draft | sent | completed | cancelled */
  status: string;
  total: number | null;
  item_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A line on a stock order (`pp_stock_order_items`). */
export interface StockOrderItem {
  id: string;
  org_id: string;
  order_id: string;
  stock_item_id: string | null;
  product_name: string;
  qty: number;
  unit: string | null;
  unit_price: number | null;
  line_total: number | null;
}

/** A production recipe (`pp_recipes`). */
export interface Recipe {
  id: string;
  org_id: string;
  name: string;
  output_product: string | null;
  output_qty: number | null;
  output_unit: string | null;
  /** Links the recipe's free-text output to a real product so batches have a
   *  row to increment. Null until a batch resolves/creates one (learned link
   *  — see app/api/procurepulse/batch/route.ts). Added by pp-batches.sql. */
  output_stock_item_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** A logged production run of a recipe (`pp_batches`). */
export interface Batch {
  id: string;
  org_id: string;
  recipe_id: string | null;
  recipe_name: string;
  output_stock_item_id: string | null;
  output_product: string;
  output_qty: number;
  output_unit: string | null;
  notes: string | null;
  source: 'manual' | 'chat';
  created_by: string | null;
  created_at: string;
}

/** One ingredient line actually used in a batch (`pp_batch_ingredients`). */
export interface BatchIngredient {
  id: string;
  org_id: string;
  batch_id: string;
  stock_item_id: string | null;
  product_name: string;
  qty_used: number;
  unit: string | null;
}

/** An ingredient line of a recipe (`pp_recipe_ingredients`). */
export interface RecipeIngredient {
  id: string;
  org_id: string;
  recipe_id: string;
  stock_item_id: string | null;
  product_name: string;
  qty_per_batch: number;
  unit: string | null;
}

/** A cycle/stock count (`pp_stock_counts`). */
export interface StockCount {
  id: string;
  org_id: string;
  /** open | completed */
  status: string;
  counted_by: string | null;
  counted_at: string | null;
  created_at: string;
}

/** A counted line within a stock count (`pp_stock_count_items`). */
export interface StockCountItem {
  id: string;
  org_id: string;
  count_id: string;
  stock_item_id: string | null;
  product_name: string;
  system_qty: number;
  counted_qty: number;
  variance: number;
}

/** A point-in-time supplier price observation (`pp_supplier_price_history`). */
export interface SupplierPriceHistory {
  id: string;
  org_id: string;
  stock_item_id: string;
  supplier_name: string;
  price: number;
  source_document_id: string | null;
  observed_at: string;
}

/** A ProcurePulse activity event for the dashboard feed (`procurepulse_activity_events`). */
export interface ProcurePulseActivityEvent {
  id: string;
  org_id: string;
  /** document_sync | manual_adjustment | count_adjustment | order_received | recipe_reserved | recipe_consumed | transfer | price_update */
  type: string;
  title: string;
  body: string | null;
  stock_item_id: string | null;
  ref_id: string | null;
  occurred_at: string;
  created_at: string;
}
