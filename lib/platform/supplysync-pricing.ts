/**
 * SupplySync price-change detection + cross-supplier comparison.
 *
 * Two independent price signals exist for a supplier line:
 *
 *   1. the tracked price list (`ss_supplier_pricing`: current vs previous), and
 *   2. what the business ACTUALLY paid — the unit prices Doc-U extracts off
 *      invoices/price lists filed against the supplier (the Doc-U bridge).
 *
 * (2) beats (1) whenever both exist: an invoice is the price that hit the bank
 * account, and it carries a quantity, so the annualised impact of the move is
 * measured rather than estimated. Everything in here is pure — the data layer
 * does the fetching and hands rows in — so the maths stays testable and the
 * views never recompute it per render.
 */

// `.ts`-suffixed relative specifiers, not the `@/` alias, because `node --test`
// resolves neither extensionless ESM specifiers nor the alias — and the docblock
// above claims this module is pure and testable, which was true of the maths and
// not of the loading. Same convention as order-line-totals.ts and line-audit.ts.
// Specifiers only: no symbol, signature or line of logic moved.
import { parseAmount } from './docu/extract.ts';
import type { ExtractedData } from './types.ts';
import type { SupplierPricingRecord } from './supplysync-data.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where a detected move was observed. */
export type PriceChangeSource = 'invoice' | 'price_list';
/** Whether the annualised impact rests on measured volume or an estimate. */
export type ImpactBasis = 'measured' | 'estimated';
export type PriceChangeSeverity = 'high' | 'medium' | 'low';

export interface PriceChangeAlert {
  id: string;
  supplierId: string | null;
  supplierName: string;
  item: string;
  category: string;
  unit: string;
  oldPrice: number;
  newPrice: number;
  /** newPrice − oldPrice, per unit. */
  changeAmount: number;
  changePct: number;
  /** Rand impact over a year at the annual volume below (signed: + = costs more). */
  annualImpact: number;
  annualUnits: number;
  impactBasis: ImpactBasis;
  source: PriceChangeSource;
  observedOn: string | null;
  severity: PriceChangeSeverity;
}

/** One supplier's price for an equivalent item, in the comparison table. */
export interface SupplierOffer {
  supplierId: string | null;
  supplierName: string;
  price: number;
  unit: string;
  source: PriceChangeSource;
  observedOn: string | null;
}

export interface CrossSupplierItem {
  key: string;
  label: string;
  category: string;
  unit: string;
  offers: SupplierOffer[];
  cheapest: SupplierOffer;
  dearest: SupplierOffer;
  /** Dearest vs cheapest, %. */
  spreadPct: number;
  /** Annual rand saved by moving measured volume to the cheapest supplier —
   *  null when no invoice volume has been observed for the dearer supplier(s). */
  potentialAnnualSaving: number | null;
}

/** A unit price read off one Doc-U line item. */
export interface PriceObservation {
  /** SupplySync profile id (already bridged from the core supplier). */
  supplierId: string;
  item: string;
  /** Comparison key for the item name. */
  key: string;
  unitPrice: number;
  qty: number;
  unit: string;
  /** yyyy-mm-dd. */
  date: string;
  documentId: string;
}

/** Minimal document shape the observations reader needs. */
export interface PricedDocument {
  id: string;
  supplier_id: string | null;
  document_type: string | null;
  created_at: string | null;
  extracted_data: ExtractedData | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Document types whose line items carry a real per-unit price. */
const PRICED_DOC_TYPES = new Set(['invoice', 'price_list', 'statement']);

/** Moves smaller than this are noise (rounding, a cent of VAT drift). */
const MIN_MOVE_PCT = 0.5;

/**
 * Comparison key for an item name: lowercased, bracketed notes and pack sizes
 * dropped, plurals folded — "Oranges (10kg box)" and "orange" both key to
 * "orange", so the same produce line from two suppliers lines up.
 */
export function itemKey(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(\.\d+)?\s?(kg|g|ml|l|box|boxes|punnet|punnets|bag|bags|crate|crates|unit|units|ea)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
    .trim();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function pctChange(next: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((next - prev) / prev) * 1000) / 10;
}
function severityOf(changePct: number, annualImpact: number): PriceChangeSeverity {
  const mag = Math.abs(changePct);
  if (mag >= 8 || annualImpact >= 10_000) return 'high';
  if (mag >= 3 || annualImpact >= 2_500) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// 1. Invoice-derived observations (the Doc-U bridge)
// ---------------------------------------------------------------------------

/**
 * Read every priced line item off the org's filed documents.
 *
 * `bridge` maps a CORE supplier id (what `documents.supplier_id` holds) to the
 * SupplySync profile id — documents filed against a supplier with no profile
 * are skipped rather than guessed at.
 */
export function readPriceObservations(
  docs: PricedDocument[],
  bridge: Map<string, string>,
): PriceObservation[] {
  const out: PriceObservation[] = [];
  for (const d of docs) {
    if (!d.supplier_id) continue;
    // A DOCUMENT THAT DOES NOT SAY WHAT IT IS DOES NOT GET TO SET A PRICE. The
    // guard used to read `if (d.document_type && !PRICED_DOC_TYPES.has(...))`,
    // which is an allow-list with a hole in it: a null type failed the first
    // condition and sailed through, so an unclassified document's line prices
    // became observed supplier prices — and an expense receipt, once it lost its
    // type for any reason, would put a R47.60 Coke Zero into a supplier's price
    // history as the price of "coke zero". The allow-list is the whole point of
    // having one; a missing type must fail it, not skip it.
    //
    // `expense_receipt` needs no clause of its own here — it is simply not on
    // the list, which is how a properly-closed allow-list is supposed to work.
    if (!d.document_type || !PRICED_DOC_TYPES.has(d.document_type)) continue;
    const ssId = bridge.get(d.supplier_id);
    if (!ssId) continue;
    const date = (d.created_at ?? '').slice(0, 10);
    if (!date) continue;
    for (const line of d.extracted_data?.line_items ?? []) {
      const desc = (line.description ?? '').trim();
      if (!desc) continue;
      const price = parseAmount(line.unit_price ?? null);
      if (price == null || price <= 0) continue;
      const key = itemKey(desc);
      if (!key) continue;
      out.push({
        supplierId: ssId,
        item: desc,
        key,
        unitPrice: price,
        qty: Math.max(0, parseAmount(line.quantity ?? null) ?? 0),
        unit: (line.unit ?? '').trim() || 'unit',
        date,
        documentId: d.id,
      });
    }
  }
  return out;
}

/** Observations grouped by `${supplierId}::${itemKey}`, oldest first. */
export function groupObservations(observations: PriceObservation[]): Map<string, PriceObservation[]> {
  const map = new Map<string, PriceObservation[]>();
  for (const o of observations) {
    const k = `${o.supplierId}::${o.key}`;
    const arr = map.get(k) ?? [];
    arr.push(o);
    map.set(k, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}

/**
 * Annual units for a line, measured from observed quantities: total quantity
 * over the observed window, extrapolated to a year. Null when nothing was
 * quantified (a price list carries prices but no volume) or the window is a
 * single day — extrapolating one delivery to a year would be a fiction.
 */
export function measuredAnnualUnits(group: PriceObservation[]): number | null {
  if (group.length < 2) return null;
  const totalQty = group.reduce((s, o) => s + o.qty, 0);
  if (totalQty <= 0) return null;
  const first = new Date(`${group[0].date}T00:00:00`).getTime();
  const last = new Date(`${group[group.length - 1].date}T00:00:00`).getTime();
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  const spanDays = Math.max(1, Math.round((last - first) / 86_400_000));
  if (spanDays < 7) return null; // too short a window to annualise honestly
  return Math.round((totalQty * 365) / spanDays);
}

// ---------------------------------------------------------------------------
// 2. Price-change alerts
// ---------------------------------------------------------------------------

/** What the builder needs to know about the supplier behind a line. */
export interface PricingSupplierMeta {
  name: string;
  /** Used to estimate annual volume when no invoice quantities exist. */
  avgMonthlySpend: number;
  /** How many tracked price lines that supplier has (spend is split across them). */
  pricingLines: number;
}

/**
 * Estimated annual units for a line with no measured volume: the supplier's
 * average annual spend, split evenly across its tracked lines, divided by the
 * new unit price. Rough by construction — every surface that shows it labels
 * the number "estimated".
 */
function estimatedAnnualUnits(meta: PricingSupplierMeta | undefined, unitPrice: number): number {
  if (!meta || unitPrice <= 0) return 0;
  const annualSpend = meta.avgMonthlySpend * 12;
  if (annualSpend <= 0) return 0;
  return Math.round(annualSpend / Math.max(1, meta.pricingLines) / unitPrice);
}

/**
 * Every material price move across both signals, strongest rand impact first.
 * An invoice-derived move for a supplier+item SUPPRESSES the price-list move for
 * the same line: they are the same event seen twice, and the invoice is the one
 * that was actually paid.
 */
export function buildPriceChanges(
  pricing: SupplierPricingRecord[],
  grouped: Map<string, PriceObservation[]>,
  meta: Map<string, PricingSupplierMeta>,
): PriceChangeAlert[] {
  const out: PriceChangeAlert[] = [];
  const invoiceCovered = new Set<string>();
  // An invoice line knows its item but not its category — borrow it from the
  // tracked price list when the same item is on it.
  const categoryByKey = new Map<string, string>();
  for (const p of pricing) {
    const k = itemKey(p.item);
    if (k && p.category && !categoryByKey.has(k)) categoryByKey.set(k, p.category);
  }

  // --- (a) measured moves, off the documents ------------------------------
  for (const [groupKey, group] of grouped) {
    if (group.length < 2) continue;
    const latest = group[group.length - 1];
    // Walk back to the most recent materially different price.
    let prior: PriceObservation | null = null;
    for (let i = group.length - 2; i >= 0; i -= 1) {
      if (Math.abs(pctChange(latest.unitPrice, group[i].unitPrice)) >= MIN_MOVE_PCT) {
        prior = group[i];
        break;
      }
    }
    if (!prior) continue;

    const supplierMeta = meta.get(latest.supplierId);
    const changeAmount = round2(latest.unitPrice - prior.unitPrice);
    const changePct = pctChange(latest.unitPrice, prior.unitPrice);
    const measured = measuredAnnualUnits(group);
    const annualUnits = measured ?? estimatedAnnualUnits(supplierMeta, latest.unitPrice);
    const annualImpact = Math.round(changeAmount * annualUnits);

    invoiceCovered.add(groupKey);
    out.push({
      id: `pc-inv-${latest.documentId}-${latest.key.replace(/\s+/g, '-')}`,
      supplierId: latest.supplierId,
      supplierName: supplierMeta?.name ?? '',
      item: latest.item,
      category: categoryByKey.get(latest.key) ?? '',
      unit: latest.unit,
      oldPrice: prior.unitPrice,
      newPrice: latest.unitPrice,
      changeAmount,
      changePct,
      annualImpact,
      annualUnits,
      impactBasis: measured != null ? 'measured' : 'estimated',
      source: 'invoice',
      observedOn: latest.date,
      severity: severityOf(changePct, Math.abs(annualImpact)),
    });
  }

  // --- (b) tracked price-list moves not already seen on an invoice --------
  for (const p of pricing) {
    if (!p.supplierId) continue;
    if (p.previousPrice <= 0 || p.currentPrice <= 0) continue;
    if (Math.abs(p.changePct) < MIN_MOVE_PCT) continue;
    if (invoiceCovered.has(`${p.supplierId}::${itemKey(p.item)}`)) continue;

    const supplierMeta = meta.get(p.supplierId);
    const changeAmount = round2(p.currentPrice - p.previousPrice);
    const annualUnits = estimatedAnnualUnits(supplierMeta, p.currentPrice);
    const annualImpact = Math.round(changeAmount * annualUnits);
    out.push({
      id: `pc-list-${p.id}`,
      supplierId: p.supplierId,
      supplierName: p.supplierName || supplierMeta?.name || '',
      item: p.item,
      category: p.category,
      unit: p.unit,
      oldPrice: p.previousPrice,
      newPrice: p.currentPrice,
      changeAmount,
      changePct: p.changePct,
      annualImpact,
      annualUnits,
      impactBasis: 'estimated',
      source: 'price_list',
      observedOn: p.lastUpdated,
      severity: severityOf(p.changePct, Math.abs(annualImpact)),
    });
  }

  return out.sort((a, b) => {
    const byImpact = Math.abs(b.annualImpact) - Math.abs(a.annualImpact);
    if (byImpact !== 0) return byImpact;
    return Math.abs(b.changePct) - Math.abs(a.changePct);
  });
}

// ---------------------------------------------------------------------------
// 3. Cross-supplier comparison for equivalent items
// ---------------------------------------------------------------------------

/**
 * Equivalent items priced by more than one supplier, widest spread first.
 * Tracked price-list rows are the primary offer; a supplier with no tracked row
 * for the item contributes its latest invoice price instead, so lines that only
 * ever arrive on paper still take part in the comparison.
 */
export function buildCrossSupplierItems(
  pricing: SupplierPricingRecord[],
  grouped: Map<string, PriceObservation[]>,
  meta: Map<string, PricingSupplierMeta>,
): CrossSupplierItem[] {
  interface Bucket {
    label: string;
    category: string;
    unit: string;
    offers: Map<string, SupplierOffer>;
    units: Map<string, number | null>;
  }
  const buckets = new Map<string, Bucket>();

  const bucketFor = (key: string, label: string, category: string, unit: string): Bucket => {
    const existing = buckets.get(key);
    if (existing) {
      if (!existing.category && category) existing.category = category;
      return existing;
    }
    const fresh: Bucket = { label, category, unit, offers: new Map(), units: new Map() };
    buckets.set(key, fresh);
    return fresh;
  };

  for (const p of pricing) {
    if (!p.supplierId || p.currentPrice <= 0) continue;
    const key = itemKey(p.item);
    if (!key) continue;
    const b = bucketFor(key, p.item, p.category, p.unit);
    b.offers.set(p.supplierId, {
      supplierId: p.supplierId,
      supplierName: p.supplierName || meta.get(p.supplierId)?.name || '',
      price: p.currentPrice,
      unit: p.unit,
      source: 'price_list',
      observedOn: p.lastUpdated,
    });
  }

  for (const [groupKey, group] of grouped) {
    const latest = group[group.length - 1];
    if (!latest) continue;
    const [supplierId, key] = groupKey.split('::');
    const b = bucketFor(key, latest.item, '', latest.unit);
    b.units.set(supplierId, measuredAnnualUnits(group));
    if (!b.offers.has(supplierId)) {
      b.offers.set(supplierId, {
        supplierId,
        supplierName: meta.get(supplierId)?.name ?? '',
        price: latest.unitPrice,
        unit: latest.unit,
        source: 'invoice',
        observedOn: latest.date,
      });
    }
  }

  const out: CrossSupplierItem[] = [];
  for (const [key, b] of buckets) {
    const offers = [...b.offers.values()].sort((a, c) => a.price - c.price);
    if (offers.length < 2) continue;
    const cheapest = offers[0];
    const dearest = offers[offers.length - 1];
    const spreadPct = pctChange(dearest.price, cheapest.price);
    if (spreadPct <= 0) continue;

    // Saving is only claimed where volume was actually observed.
    let saving: number | null = null;
    for (const o of offers) {
      if (!o.supplierId || o.supplierId === cheapest.supplierId) continue;
      const units = b.units.get(o.supplierId);
      if (units == null) continue;
      saving = (saving ?? 0) + Math.round((o.price - cheapest.price) * units);
    }

    out.push({
      key,
      label: b.label,
      category: b.category,
      unit: b.unit,
      offers,
      cheapest,
      dearest,
      spreadPct,
      potentialAnnualSaving: saving,
    });
  }

  return out.sort((a, b) => {
    const bySaving = (b.potentialAnnualSaving ?? 0) - (a.potentialAnnualSaving ?? 0);
    if (bySaving !== 0) return bySaving;
    return b.spreadPct - a.spreadPct;
  });
}
