/**
 * Document-type metadata driving the Doc-U Hub tiles, type-filter tabs/chips,
 * and KPI computations. Tints sampled from the Figma "Doc-U Mobile / Hub" screen.
 * Mirrored into each app's lib folder.
 */
import type { Document, DocumentType } from './types';

export interface DocTypeMeta {
  /** null = the "All" pseudo-type. */
  key: DocumentType | null;
  /** Plural label for tiles/tabs. */
  label: string;
  /** Tinted tile background. */
  tint: string;
  /** Icon chip background. */
  iconBg: string;
}

export const DOC_TYPES: readonly DocTypeMeta[] = [
  { key: null, label: 'All', tint: '#E7EEF8', iconBg: '#3E7BC4' },
  { key: 'invoice', label: 'Invoices', tint: '#E6F1FB', iconBg: '#0C447C' },
  { key: 'statement', label: 'Statements', tint: '#E1F5EE', iconBg: '#0F6E56' },
  { key: 'delivery_note', label: 'Delivery notes', tint: '#FBEEDA', iconBg: '#854F0B' },
  { key: 'price_list', label: 'Price lists', tint: '#ECEAFB', iconBg: '#5B4FD6' },
  { key: 'order', label: 'Orders', tint: '#FBE7EC', iconBg: '#C0345A' },
  // Expense receipts get a tile, a folder and a filter chip like every other
  // type — they are excluded from operational ROUTING, not from Doc-U. A
  // financial document nobody can find is a financial document nobody files.
  { key: 'expense_receipt', label: 'Expense receipts', tint: '#EDF0E9', iconBg: '#4A6136' },
  // THE THREE CREDITS GET TILES, FOLDERS AND FILTER CHIPS, and that is the point
  // of listing them here at all. This constant is NOT compile-forced — it is a
  // plain array, so a new document type slips past it in silence — and the
  // silence is what it costs: a credit note with no tile is a credit note that
  // exists in the database, is excluded from every operational query exactly as
  // intended, and cannot be found by the person looking for it. Eat Your Greens
  // CRN0012368 was mis-typed AND unfindable; only one of those is a routing bug.
  //
  // Three tiles rather than one "Credit notes" tile because the three are
  // different documents with different counterparties: a supplier credit sits
  // against a supplier, a customer credit request is a claim somebody has made
  // against us, and mixing them in one folder puts money owed and money claimed
  // in the same pile.
  { key: 'supplier_credit_note', label: 'Supplier credit notes', tint: '#E9F2F0', iconBg: '#1F6B63' },
  { key: 'customer_credit_request', label: 'Customer credit requests', tint: '#FBF0E7', iconBg: '#9A5B24' },
  { key: 'customer_credit_note', label: 'Customer credit notes', tint: '#F3EAF6', iconBg: '#6B3F87' },
  // ITS OWN TILE AND ITS OWN FOLDER, sitting apart from "Expense receipts" on
  // purpose. Both piles are full of things that look like slips; one is money
  // the business spent and the other is money it was paid, and a bookkeeper
  // hunting for proof of a customer's EFT must not have to read forty lunch
  // receipts to find it.
  { key: 'payment_proof', label: 'Payment proofs', tint: '#E7F0FA', iconBg: '#2A5C93' },
];

/**
 * Vyso's built-in "default" folders — the document categories every account
 * gets, mirroring the document types. Custom folders are anything a user creates
 * whose name isn't one of these. (Folders are matched by name.)
 */
export const DEFAULT_FOLDERS: readonly { name: string; color: string }[] = DOC_TYPES.filter(
  (t) => t.key !== null,
).map((t) => ({ name: t.label, color: t.iconBg }));

export const DEFAULT_FOLDER_NAMES: readonly string[] = DEFAULT_FOLDERS.map((f) => f.name);

/** Is this folder name one of the built-in default categories? */
export function isDefaultFolderName(name: string): boolean {
  return DEFAULT_FOLDER_NAMES.includes(name);
}

/** Singular, human-readable label for a document type (table "Type" column). */
export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  invoice: 'Invoice',
  statement: 'Statement',
  delivery_note: 'Delivery note',
  price_list: 'Price list',
  order: 'Order',
  expense_receipt: 'Expense receipt',
  supplier_credit_note: 'Supplier credit note',
  customer_credit_request: 'Customer credit request',
  customer_credit_note: 'Customer credit note',
  payment_proof: 'Payment proof',
};

/**
 * Display label for a document's type, preferring a user-set custom type
 * (extracted_data.custom_type) over the built-in category. Falls back to the
 * raw value title-cased, then "—".
 */
export function documentTypeLabel(doc: Pick<Document, 'document_type' | 'extracted_data'>): string {
  const custom = (doc.extracted_data as { custom_type?: string } | null)?.custom_type?.trim();
  if (custom) return custom;
  const t = doc.document_type;
  if (!t) return '—';
  return (DOC_TYPE_LABEL as Record<string, string>)[t] ?? t.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** KPI roll-ups computed from a document set — shared by web + mobile. */
export interface DocKpis {
  total: number;
  awaiting: number;
  flagged: number;
  avgConfidence: number | null;
}

export function computeKpis(docs: Pick<Document, 'status' | 'confidence'>[]): DocKpis {
  const withConfidence = docs.filter(
    (d): d is typeof d & { confidence: number } => typeof d.confidence === 'number',
  );
  const avg =
    withConfidence.length > 0
      ? Math.round(
          withConfidence.reduce((sum, d) => sum + d.confidence, 0) / withConfidence.length,
        )
      : null;
  return {
    total: docs.length,
    // "Awaiting review" = extracted + pending (per the Figma KPI sublabel).
    awaiting: docs.filter((d) => d.status === 'extracted' || d.status === 'pending').length,
    // "Flagged" = error status (needs attention).
    flagged: docs.filter((d) => d.status === 'error').length,
    avgConfidence: avg,
  };
}

/** Count documents per type, including the `null` ("All") bucket. */
export function countByType(
  docs: Pick<Document, 'document_type'>[],
  type: DocumentType | null,
): number {
  if (type === null) return docs.length;
  return docs.filter((d) => d.document_type === type).length;
}
