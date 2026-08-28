/**
 * A printable TAX INVOICE assembled from what Doc-U read off a scan.
 *
 * WHY. "Print" on a Doc-U document opened the photograph — a phone snap of a
 * creased A4, at whatever angle it was taken. For an OUTGOING invoice (one the
 * org itself issued and later scanned back in) that is the one thing nobody
 * wants: the org has the numbers, so it can print its own clean, bordered SA
 * tax invoice instead. For an incoming supplier invoice the same sheet is a
 * legible copy of an unreadable original.
 *
 * WHAT THIS MODULE IS. The pure half: `extracted_data` in, the props
 * `InvoiceSheetClassic` already takes out. It owns no styling and no seller
 * identity — the component picks the parties (see `mapExtractionToSheet`'s
 * `issuerName`/`billToName`, which say what the PAPER said, not who is who) —
 * and no arithmetic beyond the per-line rate/amount reconciliation below:
 * subtotal, VAT and total are `docTotals`, exactly as OrderFlow computes them.
 *
 * THE AMOUNT COLUMN IS THE AUTHORITY. Where a line's quantity × unit price
 * disagrees with its printed amount, the amount wins and the rate is derived
 * from it, so the reprint totals what the original totalled. (A line whose
 * numbers disagree is already surfaced by the arithmetic audit — this is a
 * print path, not the place to silently "fix" a reading.)
 *
 * `.ts`-suffixed relative imports: `node --test` resolves neither
 * extensionless ESM specifiers nor the `@/` alias, and this module is loaded
 * directly by tests/docu-invoice-from-extraction.test.ts.
 */
import type { ExtractedField, ExtractedLineItem } from '../types.ts';
import type { DocumentDirectionRecord } from './document-direction.ts';
import { parseLocaleNumber, inferDecimalSeparator, type DecimalSeparator } from '../locale-number.ts';

/** One row of the printed items table (matches `ClassicInvoiceLine`). */
export interface SheetLine {
  id: string;
  name: string;
  qty: number;
  unit: string | null;
  unit_price: number;
}

/** The invoice header block (matches `ClassicInvoiceMeta`). */
export interface SheetMeta {
  number: string;
  issueDate: string;
  dueDate: string | null;
  customerPo: string | null;
  termsText: string | null;
  note: string | null;
}

export interface ExtractionSheet {
  lines: SheetLine[];
  invoice: SheetMeta;
  /** Percentage. Recovered from the document when it printed its VAT. */
  vatRate: number;
  vatRateSource: 'document' | 'default';
  /** Lines that carry money. Zero means there is no invoice to print. */
  pricedLineCount: number;
  /** The party billed, exactly as the paper reads it. Unverified text. */
  billToName: string | null;
  /** The issuing party as the paper reads it. Unverified text. */
  issuerName: string | null;
  /** A VAT registration number printed against the issuer, if one was read. */
  issuerVat: string | null;
  /** Header facts the document did not give up — shown as a nudge, never a block. */
  missing: MissingHeaderField[];
}

export type MissingHeaderField = 'number' | 'date';

/** Widest plausible VAT percentage. Anything above is a misread, not a rate. */
const MAX_VAT_RATE = 30;

/**
 * A money/quantity string as a number, using the SAME shared parser every
 * other Doc-U/OrderFlow numeric site delegates to (`lib/platform/locale-number.ts`),
 * so this print sheet and the review editor's running total can never disagree
 * about what a line is worth.
 *
 * Was `parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''))` — the same
 * comma-deleting bug `parseAmount` had (see extract.ts's doc comment); a
 * comma-decimal invoice would have reprinted at 1000× its real amounts.
 *
 * Returns 0 (never null) for empty/unparseable input — every caller here does
 * arithmetic immediately (`qty * unitPrice`, a running subtotal) and a null
 * would just become a NaN a few lines down; 0 is the same "nothing here" this
 * function has always reported.
 */
export function parseNumeric(
  value: string | null | undefined,
  opts?: { decimalSeparator?: DecimalSeparator },
): number {
  return parseLocaleNumber(value, opts) ?? 0;
}

function fieldValue(fields: ExtractedField[], match: (label: string) => boolean): string | null {
  for (const f of fields) {
    if (!f || typeof f.label !== 'string') continue;
    if (!match(f.label)) continue;
    const v = (f.value ?? '').trim();
    if (v) return v;
  }
  return null;
}

const hasRef = (l: string) => /\b(no|nr|num|number|ref|reference)\b|#/i.test(l);

/** "Invoice No", "Tax Invoice #", "Document Number" — but never a date field. */
function isNumberLabel(label: string): boolean {
  const l = label.trim();
  if (/date/i.test(l)) return false;
  if (/^(tax\s*)?invoice$/i.test(l)) return true;
  return /\b(invoice|inv|document|doc)\b/i.test(l) && hasRef(l);
}

function isIssueDateLabel(label: string): boolean {
  const l = label.trim();
  if (!/date/i.test(l)) return false;
  if (/\b(due|delivery|delivered|order|statement|period)\b/i.test(l)) return false;
  return true;
}

const isDueDateLabel = (l: string) => /\bdue\b/i.test(l) && /date|payment/i.test(l);

/** The customer's own order reference — "P.O. No", "Your Ref", "Order Number". */
function isPoLabel(label: string): boolean {
  const l = label.trim();
  if (/^p\.?\s*o\.?\b/i.test(l) || /purchase\s*order/i.test(l)) return true;
  if (/your\s*(ref|reference|order)/i.test(l)) return true;
  return /\border\b/i.test(l) && hasRef(l);
}

/** A VAT/tax AMOUNT ("VAT", "Tax Total") — not a registration number or a rate. */
function isVatAmountLabel(label: string): boolean {
  const l = label.trim();
  if (!/\b(vat|tax)\b/i.test(l)) return false;
  if (hasRef(l) || /\breg(istration)?\b/i.test(l)) return false;
  if (/rate|%|percent/i.test(l)) return false;
  if (/incl(usive)?|excl(usive)?/i.test(l)) return false;
  return true;
}

const isVatRateLabel = (l: string) => /\bvat\b/i.test(l) && /rate|%|percent/i.test(l);

/** A VAT registration number printed against the issuing party. */
const isVatNumberLabel = (l: string) => /\bvat\b/i.test(l) && (hasRef(l) || /\breg(istration)?\b/i.test(l));

/**
 * A line as it will print. `qty` never lands on zero — a line with no quantity
 * is one of whatever it is — and the rate is back-derived whenever the amount
 * column says something different from quantity × unit price.
 */
function toSheetLine(l: ExtractedLineItem, index: number, hint?: DecimalSeparator | null): SheetLine {
  const opts = hint ? { decimalSeparator: hint } : undefined;
  const name = (l.description ?? '').trim() || (l.reference ?? '').trim() || 'Item';
  let qty = parseNumeric(l.quantity, opts);
  if (!(qty > 0)) qty = 1;

  let unitPrice = parseNumeric(l.unit_price, opts);
  const amount = parseNumeric(l.amount, opts);
  if (amount !== 0 && Math.abs(qty * unitPrice - amount) > 0.005) unitPrice = amount / qty;

  return { id: `x${index}`, name, qty, unit: (l.unit ?? '').trim() || null, unit_price: unitPrice };
}

/** A line carrying neither a name nor money is padding, not an invoice line. */
function isPrintable(l: ExtractedLineItem, hint?: DecimalSeparator | null): boolean {
  const opts = hint ? { decimalSeparator: hint } : undefined;
  const named = (l.description ?? '').trim() !== '' || (l.reference ?? '').trim() !== '';
  return named || parseNumeric(l.unit_price, opts) !== 0 || parseNumeric(l.amount, opts) !== 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The VAT percentage to print with.
 *
 * Recovered from the document itself wherever it can be — an explicit rate, or
 * the printed VAT amount over the line subtotal — so a reprint of a zero-rated
 * fresh-produce invoice stays zero-rated even when the org's default is 15%.
 * A recovered rate within 0.6 of the default snaps to it, because 14.97% is a
 * rounding artefact, not a rate anyone charges.
 */
export function resolveVatRate(
  fields: ExtractedField[],
  lines: SheetLine[],
  defaultRate: number,
  hint?: DecimalSeparator | null,
): { rate: number; source: 'document' | 'default' } {
  const opts = hint ? { decimalSeparator: hint } : undefined;
  const fallback = { rate: Number(defaultRate) || 0, source: 'default' as const };

  const explicit = fieldValue(fields, isVatRateLabel);
  if (explicit !== null) {
    const r = parseNumeric(explicit, opts);
    if (r >= 0 && r <= MAX_VAT_RATE) return { rate: snap(r, fallback.rate), source: 'document' };
  }

  const printed = fieldValue(fields, isVatAmountLabel);
  if (printed === null) return fallback;
  const vat = parseNumeric(printed, opts);
  if (vat === 0) return { rate: 0, source: 'document' };

  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unit_price, 0));
  if (subtotal <= 0) return fallback;
  const derived = round2((vat / subtotal) * 100);
  if (derived < 0 || derived > MAX_VAT_RATE) return fallback;
  return { rate: snap(derived, fallback.rate), source: 'document' };
}

function snap(rate: number, defaultRate: number): number {
  return defaultRate > 0 && Math.abs(rate - defaultRate) <= 0.6 ? defaultRate : rate;
}

/**
 * `extracted_data` → the props `InvoiceSheetClassic` renders.
 *
 * Reads nothing about the org: `issuerName` / `billToName` are what the PAPER
 * said, and deciding which of them is the seller is the caller's job (it turns
 * on `direction`, which the caller already has).
 */
export function mapExtractionToSheet(input: {
  fields?: ExtractedField[] | null;
  lineItems?: ExtractedLineItem[] | null;
  /** `extracted_data.direction` — present only on documents the org issued. */
  direction?: DocumentDirectionRecord | null;
  /** `extracted_data.bill_to` — the billed party as read. */
  billTo?: string | null;
  /** `extracted_data.supplier`, or the linked supplier row's name. */
  supplierName?: string | null;
  /** `of_settings.default_vat_rate`, used only when the document is silent. */
  defaultVatRate?: number;
  /** Printed under the totals — the org's invoice footer, typically. */
  note?: string | null;
  /** Payment terms text, when the org has one configured. */
  termsText?: string | null;
}): ExtractionSheet {
  const fields = (input.fields ?? []).filter(Boolean);
  const rawLines = (input.lineItems ?? []).filter(Boolean);
  // ONE reading of this document's numeric format — from every line's own
  // figures, since that's what's in scope here — applied to every line and to
  // the header's VAT fields below, rather than each line item guessing alone
  // off its own quantity/price/amount.
  const hint = inferDecimalSeparator(rawLines.flatMap((l) => [l.quantity, l.unit_price, l.amount]));
  const lines = rawLines.filter((l) => isPrintable(l, hint)).map((l, i) => toSheetLine(l, i, hint));

  const { rate, source } = resolveVatRate(fields, lines, input.defaultVatRate ?? 0, hint);

  const number = fieldValue(fields, isNumberLabel) ?? '';
  const issueDate = fieldValue(fields, isIssueDateLabel) ?? '';
  const missing: MissingHeaderField[] = [];
  if (!number) missing.push('number');
  if (!issueDate) missing.push('date');

  const dir = input.direction ?? null;

  return {
    lines,
    invoice: {
      number,
      issueDate,
      dueDate: fieldValue(fields, isDueDateLabel),
      customerPo: fieldValue(fields, isPoLabel),
      termsText: (input.termsText ?? '').trim() || null,
      note: (input.note ?? '').trim() || null,
    },
    vatRate: rate,
    vatRateSource: source,
    pricedLineCount: lines.filter((l) => l.unit_price > 0).length,
    billToName:
      dir?.customer_name ??
      dir?.counterparty_as_read ??
      ((input.billTo ?? '').trim() || null),
    issuerName: dir?.issuer_as_read ?? ((input.supplierName ?? '').trim() || null),
    issuerVat: fieldValue(fields, isVatNumberLabel),
    missing,
  };
}

/**
 * Is there an invoice here worth printing? Invoice-shaped document type, and at
 * least one line that carries a price — a delivery note of unpriced quantities
 * is not a tax invoice, and offering to print one as if it were is worse than
 * offering nothing.
 */
export function canPrintTaxInvoice(
  documentType: string | null | undefined,
  sheet: Pick<ExtractionSheet, 'pricedLineCount'>,
): boolean {
  return documentType === 'invoice' && sheet.pricedLineCount > 0;
}
