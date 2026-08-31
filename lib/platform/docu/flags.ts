/**
 * Smart flagging engine (feature 4). REAL flags derive from real document data;
 * a few illustrative heuristics are marked `source: 'mock'`.
 */
import { DOC_LOW_CONFIDENCE_THRESHOLD } from '@/lib/platform/tokens';
import type { DocumentWithSupplier } from '@/lib/platform/types';
import type { DocuExtractedData, DocumentFlag, FlagKind, FlagSeverity } from './types';
import { docTotal, findFieldValue } from './extract';
import { isFinancialOnly } from './business-effect';
import { lowResolutionNote } from './image-size';

export const FLAG_META: Record<FlagKind, { label: string; severity: FlagSeverity }> = {
  outgoing_invoice: { label: 'Outgoing invoice', severity: 'info' },
  line_realigned: { label: 'Columns re-aligned', severity: 'warning' },
  line_math: { label: 'Line totals do not add up', severity: 'critical' },
  duplicate_invoice: { label: 'Duplicate invoice', severity: 'critical' },
  price_spike: { label: 'Price spike', severity: 'warning' },
  missing_delivery_note: { label: 'Missing delivery note', severity: 'warning' },
  credit_note: { label: 'Credit note detected', severity: 'info' },
  unusual_spend: { label: 'Unusual spend', severity: 'warning' },
  unknown_supplier: { label: 'Unknown supplier', severity: 'warning' },
  low_confidence: { label: 'Low extraction confidence', severity: 'warning' },
  low_resolution: { label: 'Photo may be too small to read', severity: 'warning' },
};

export const FLAG_SEVERITY_COLOR: Record<FlagSeverity, { bg: string; fg: string }> = {
  critical: { bg: '#FCEBEB', fg: '#A32D2D' },
  warning: { bg: '#FBEEDA', fg: '#854F0B' },
  info: { bg: '#E6F1FB', fg: '#0C447C' },
};

const INVOICE_LABELS = ['invoice #', 'invoice no', 'invoice number', 'document #', 'reference'];

/** Compute flags for `doc` against the rest of the org's documents. */
export function deriveFlags(
  doc: DocumentWithSupplier,
  orgDocs: DocumentWithSupplier[] = [],
): DocumentFlag[] {
  const flags: DocumentFlag[] = [];
  const add = (kind: FlagKind, detail: string, source: 'derived' | 'mock') =>
    flags.push({ kind, severity: FLAG_META[kind].severity, label: FLAG_META[kind].label, detail, source });

  // REAL — low extraction confidence
  if (typeof doc.confidence === 'number' && doc.confidence < DOC_LOW_CONFIDENCE_THRESHOLD) {
    add('low_confidence', `Overall confidence ${Math.round(doc.confidence)}% — manual review recommended.`, 'derived');
  } else if (doc.confidence == null && doc.extracted_data != null) {
    // A READ THAT RECORDED NO CONFIDENCE IS NOT A CONFIDENT READ. Since
    // `coerceConfidence` stopped fabricating a 0 for a missing or string-typed
    // answer, "unknown" is a state this column can genuinely hold — and the
    // wrong thing to do with it is nothing, because a document with no
    // confidence flag looks exactly like a document that scored 100.
    //
    // No number is invented in the message either: saying "0%" or "65%" here
    // would put back the very figure the null exists to avoid. Gated on
    // `extracted_data` being present so this fires only on documents somebody
    // actually READ — every freshly uploaded row sits at confidence null with
    // nothing extracted yet, and flagging those would bury the real ones.
    add('low_confidence', 'The reader recorded no confidence for this document — worth a look.', 'derived');
  }

  // REAL — the photo, not the reader, was the limit.
  //
  // BEFORE the confidence and arithmetic flags in spirit, even though it is
  // listed after them: when this fires it is very often the CAUSE of those, and
  // a reviewer told "these figures may be wrong" without being told "because
  // the photo is 900px wide" is left doubting the product instead of retaking
  // the picture. See lib/platform/docu/image-size.ts for what the threshold is
  // and why it is that number.
  const pixels = (doc.extracted_data as DocuExtractedData | null)?.image_pixels ?? null;
  const lowRes = lowResolutionNote(pixels);
  if (lowRes) add('low_resolution', lowRes, 'derived');

  // REAL — the extraction-time arithmetic audit (lib/platform/docu/line-audit.ts).
  // `line_realigned` means we moved the price/amount columns back onto their own
  // rows and the document now adds up — a genuine repair, but one a human should
  // glance at. `line_math` means the numbers are wrong and we did NOT guess.
  const audit = (doc.extracted_data as DocuExtractedData | null)?.line_audit ?? null;
  if (audit?.note) {
    add(audit.diagnosis === 'row_shift' ? 'line_realigned' : 'line_math', audit.note, 'derived');
  }

  // REAL — the org issued this one (lib/platform/docu/document-direction.ts).
  // It REPLACES the "unknown supplier" flag rather than joining it: an outgoing
  // invoice has no supplier by definition, and telling the owner one is missing
  // is how a document like this ended up with the org as its own vendor. The
  // note already says whether the customer was recognised.
  const direction = (doc.extracted_data as DocuExtractedData | null)?.direction ?? null;
  if (direction?.direction === 'outgoing') {
    add('outgoing_invoice', `${direction.note}.`, 'derived');
  } else if (!doc.supplier_id && !doc.supplier) {
    // REAL — unknown supplier
    add('unknown_supplier', 'No supplier is matched to this document yet.', 'derived');
  }

  // REAL — duplicate invoice (same supplier + same invoice number across the org)
  const invNo = findFieldValue(doc, ...INVOICE_LABELS);
  if (invNo) {
    const dup = orgDocs.some(
      (o) =>
        o.id !== doc.id &&
        o.supplier_id === doc.supplier_id &&
        findFieldValue(o, ...INVOICE_LABELS) === invNo,
    );
    if (dup) add('duplicate_invoice', `Invoice ${invNo} also appears on another document.`, 'derived');
  }

  // REAL-ish — credit note keyword
  const hay = (
    doc.filename +
    ' ' +
    (doc.extracted_data?.fields ?? []).map((f) => f.value).join(' ') +
    ' ' +
    (doc.extracted_data?.line_items ?? []).map((l) => l.description).join(' ')
  ).toLowerCase();
  if (/\bcredit\b/.test(hay)) {
    add('credit_note', 'Document references a credit — confirm it offsets a prior invoice.', 'derived');
  }

  // HEURISTIC / illustrative
  // Orders are excluded: `docTotal` sums line amounts, and an order's lines now
  // carry the reviewed gross, so without this gate every order over R12k would
  // raise a spend flag reading "above the usual range for this supplier" — on a
  // document that has no supplier at all, only a customer.
  //
  // Financial-only documents are excluded for exactly the same reason, one step
  // further along: an expense receipt HAS no supplier and never will, so
  // "above the usual range for this supplier" is a sentence about a relationship
  // that does not exist — and there is no spend history to have a usual range
  // in, because the SupplySync feed refuses these documents by design. A big
  // hotel bill is a real thing to notice; this flag is simply not the mechanism
  // that can notice it honestly.
  const total =
    doc.document_type === 'order' || isFinancialOnly(doc) ? null : docTotal(doc);
  if (total != null && total > 12000) {
    add('unusual_spend', `Total of R ${Math.round(total).toLocaleString('en-ZA')} is above the usual range for this supplier.`, 'mock');
  }
  if (doc.document_type === 'statement') {
    add('missing_delivery_note', '2 line items have no matching delivery note on file.', 'mock');
  }
  if (doc.document_type === 'invoice' && /butternut|tomato|onion|banana/.test(hay)) {
    add('price_spike', 'A unit price is up ~14% versus last month.', 'mock');
  }

  return flags;
}
