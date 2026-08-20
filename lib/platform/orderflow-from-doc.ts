/**
 * Turn an uploaded customer ORDER document (Doc-U, document_type='order') into a
 * real OrderFlow order: match the customer, price each line (document price first,
 * else the customer's price list), upsert one order per source document, and —
 * when the customer is known — finalise it to 'invoiced' (so PricePilot sees the
 * sale) and decrement stock. Idempotent: re-running re-prices + re-applies stock.
 *
 * ----------------------------------------------------------------------------
 * Per-customer parameters (customer-ai-invoicing.sql) steer the rectification.
 * They only apply when a customer is KNOWN (matched at/above their confidence
 * threshold); an unknown/partial customer behaves exactly as before.
 *   • cd_customer_item_aliases — an exact raw_name → catalogue mapping wins over
 *     fuzzy matching: it fixes the stock item, the printed invoice name and the
 *     billing unit for that customer's coded/misspelled order line.
 *   • strip_order_prefixes (default true) — strips a leading category code like
 *     "FF - " / "VEG - " / "PSAL - " from the order name before fuzzy matching.
 *   • invoice_price_basis — 'price_list' re-prices every line from OUR list
 *     (ignoring the document's own price); 'order_prices' keeps the doc price.
 *   • ai_auto_invoice_confidence (default 80) — the match confidence at/above
 *     which the order auto-invoices; ai_allow_unpriced lets it invoice even with
 *     unpriced lines. An explicit params.finalize still overrides both gates.
 *   • vat_treatment — sets the materialised invoice's vat_rate (0 for
 *     zero_rated/exempt, the org standard for standard); invoice_terms_days_override
 *     sets the due date.
 * ----------------------------------------------------------------------------
 * CREATE-ON-UPLOAD (populate Core Data). An upload no longer just leaves gaps:
 *   • Unmatched customer → a new of_customers row is created from the extracted
 *     name (guarded: ≥2 chars, deduped by normalised name against the loaded
 *     customers) and the order links to it as a KNOWN customer.
 *   • Unmatched order line → a new pp_stock_items row is created from the line
 *     name/unit (on_hand 0, price from the line when positive) and the line links
 *     to it; it then prices via the normal avg_unit_price path.
 *   Both are best-effort: a failed insert falls back to the prior behaviour
 *   (customer_id / stock_item_id null). Dedupe + re-matching keep this idempotent
 *   per source_document_id — the first sync creates the rows, later syncs match
 *   them instead of creating duplicates.
 * ----------------------------------------------------------------------------
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractedData } from './types';
import { invoiceNumber, vatRateForTreatment } from './orderflow';
import type { OfCustomer } from './orderflow';
import type { CdCustomerItemAlias, CdPriceList, CdPriceOverride } from './coredata';
import { customerPriceList, resolvePrice } from './coredata';
import {
  AUTO_MATCH_FLOOR,
  bestCatalogueCandidate,
  stripCategoryPrefix,
  resolveOrderLines,
  type OrderLineRecord,
  type OrderPriceSource,
} from './docu/order-line-match';

export interface CustomerLite {
  id: string;
  name: string;
}

/** Match confidence (0–100) at/above which we auto-link + auto-invoice. */
export const CUSTOMER_CONFIDENT = 80;

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Best-effort match of an extracted customer name to an existing customer. */
export function matchCustomer(
  name: string | null | undefined,
  customers: CustomerLite[],
): { customerId: string | null; confidence: number } {
  const n = normName((name ?? '').trim());
  if (!n) return { customerId: null, confidence: 0 };
  for (const c of customers) if (normName(c.name) === n) return { customerId: c.id, confidence: 100 };
  for (const c of customers) {
    const cn = normName(c.name);
    if (!cn || !(cn.includes(n) || n.includes(cn))) continue;
    // Only treat containment as confident when the names are close in length — so
    // "abc" doesn't auto-link "abc wholesale", but "abc wholesale" ≈ "abc wholesale ltd" does.
    const ratio = Math.min(n.length, cn.length) / Math.max(n.length, cn.length);
    if (ratio >= 0.6) return { customerId: c.id, confidence: 85 };
  }
  const tokens = new Set(n.split(' ').filter(Boolean));
  let best: { id: string; score: number } | null = null;
  for (const c of customers) {
    const ct = normName(c.name).split(' ').filter(Boolean);
    if (!ct.length) continue;
    const overlap = ct.filter((t) => tokens.has(t)).length;
    const score = overlap / Math.max(ct.length, 1);
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  if (best && best.score >= 0.5) return { customerId: best.id, confidence: Math.round(55 + best.score * 25) };
  return { customerId: null, confidence: 0 };
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const s = String(v).replace(/[^0-9.\-]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export interface StockLite {
  id: string;
  name: string;
  avg_unit_price: number | null;
  unit: string | null;
}

/**
 * Match a free-text order line ("Broc", "toms", "green apple") to a catalogue
 * product, or null when nothing in the catalogue IS that product.
 *
 * The rule lives in `lib/platform/docu/order-line-match.ts` — this is the
 * single-line convenience over it. It used to be a bespoke ladder (exact →
 * length-guarded containment → token overlap with prefix matching) whose token
 * stage accepted a half-overlap, which is how "Sweet Corn" reached "Baby Sweet
 * Corn" and how three different peppers became candidates for one another. The
 * shared rule refuses anything short of effective identity and refuses outright
 * a candidate that disagrees about colour, size, cut or variety.
 *
 * NOTE the document-wide decision — the one that catches two lines landing on
 * one product — is `resolveOrderLines`, not this. A per-line matcher cannot see
 * that it has just handed out the same product twice.
 */
export function matchStockItem(name: string, items: StockLite[]): StockLite | null {
  const best = bestCatalogueCandidate(name, items);
  return best && best.score >= AUTO_MATCH_FLOOR ? best.item : null;
}

export interface SyncResult {
  ok: boolean;
  orderId?: string;
  status?: string;
  invoice_number?: string | null;
  customerId?: string | null;
  matchConfidence?: number;
  /** True when the order was held (not invoiced) — uncertain customer or unpriced lines. */
  needsCustomerReview?: boolean;
  /** Lines with no document price and no resolvable price-list/base price. */
  unpricedLines?: number;
  /** Lines whose product could not be identified — held for review, never priced. */
  unmatchedLines?: number;
  itemCount?: number;
  reason?: string;
}

type DB = SupabaseClient;

async function adjustOnHand(db: DB, deltaByItem: Map<string, number>) {
  const ids = [...deltaByItem.keys()];
  if (!ids.length) return;
  const { data } = await db.from('pp_stock_items').select('id, on_hand').in('id', ids);
  for (const row of (data ?? []) as { id: string; on_hand: number }[]) {
    await db
      .from('pp_stock_items')
      .update({ on_hand: Math.max(0, Number(row.on_hand) + (deltaByItem.get(row.id) ?? 0)) })
      .eq('id', row.id);
  }
}

/** Reverse this order's prior stock movements, then apply fresh ones if invoiced. */
async function syncStock(db: DB, orgId: string, orderId: string, invoiced: boolean, invoice: string | null) {
  const { data: existing, error } = await db
    .from('pp_movements')
    .select('stock_item_id, change')
    .eq('org_id', orgId)
    .eq('order_id', orderId);
  if (!error && existing && existing.length) {
    const restore = new Map<string, number>();
    for (const m of existing as { stock_item_id: string; change: number }[]) {
      restore.set(m.stock_item_id, (restore.get(m.stock_item_id) ?? 0) - Number(m.change));
    }
    await adjustOnHand(db, restore);
    await db.from('pp_movements').delete().eq('org_id', orgId).eq('order_id', orderId);
  }
  if (!invoiced) return;

  const { data: itemRows } = await db.from('of_order_items').select('stock_item_id, qty').eq('order_id', orderId);
  const lines = ((itemRows ?? []) as { stock_item_id: string | null; qty: number }[]).filter(
    (l) => l.stock_item_id && Number(l.qty) > 0,
  );
  if (!lines.length) return;

  const label = invoice ? `Sold · ${invoice}` : 'Sold to customer';
  const now = new Date().toISOString();
  const base = (reason: string) =>
    lines.map((l) => ({
      org_id: orgId,
      stock_item_id: l.stock_item_id,
      change: -(Number(l.qty) || 0),
      reason,
      source_label: label,
      occurred_at: now,
    }));
  const withOrder = (reason: string) => base(reason).map((r) => ({ ...r, order_id: orderId }));
  const attempts = [withOrder('sale'), base('sale'), withOrder('used'), base('used')];
  let moveErr: { message?: string } | null = { message: 'init' };
  for (const rows of attempts) {
    ({ error: moveErr } = await db.from('pp_movements').insert(rows));
    if (!moveErr) break;
  }
  if (moveErr) return; // best-effort — the order still stands
  const dec = new Map<string, number>();
  for (const l of lines) dec.set(l.stock_item_id as string, (dec.get(l.stock_item_id as string) ?? 0) - (Number(l.qty) || 0));
  await adjustOnHand(db, dec);
}

export async function syncOrderFromDocument(
  db: DB,
  params: { documentId: string; orgId: string; customerId?: string | null; finalize?: boolean },
): Promise<SyncResult> {
  const { documentId, orgId } = params;

  const { data: docRow } = await db
    .from('documents')
    .select('id, extracted_data')
    .eq('id', documentId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!docRow) return { ok: false, reason: 'doc-not-found' };
  const ed = ((docRow as { extracted_data?: ExtractedData }).extracted_data ?? {}) as ExtractedData;
  const lines = ed.line_items ?? [];

  // We upsert exactly ONE order per source document, which needs the
  // of-order-source-doc migration (of_orders.source_document_id). Without it we
  // can't dedup — so creating customers/products/an order here would duplicate on
  // every re-extract. Probe FIRST and bail before touching Core Data.
  const { data: existingOrder, error: lookupErr } = await db
    .from('of_orders')
    .select('id, invoice_number')
    .eq('source_document_id', documentId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (lookupErr) return { ok: false, reason: 'migration-needed' };

  // Resolve customer — an explicit pick (from review) wins; else fuzzy-match.
  // select('*') so default_price_list_id (core-data.sql) + the AI-invoicing
  // params (customer-ai-invoicing.sql) ride along when present.
  const { data: custRows } = await db.from('of_customers').select('*').eq('org_id', orgId);
  const customers = (custRows ?? []) as (CustomerLite & Partial<OfCustomer>)[];
  let customerId = params.customerId ?? null;
  let matchConfidence = customerId ? 100 : 0;
  if (!customerId) {
    const m = matchCustomer(ed.customer_name, customers);
    customerId = m.customerId;
    matchConfidence = m.confidence;
  }

  // CREATE-ON-UPLOAD: no explicit pick and nothing fuzzy-matched, but the document
  // named a customer → create it so the order links to a real of_customers row.
  // Guards: name ≥2 chars after trim; a final exact normalised check against the
  // loaded customers (so we never duplicate one we merely failed to fuzzy-match).
  // Best-effort — a failed insert falls back to customer_id null (prior behaviour).
  // A freshly created customer counts as KNOWN (confidence 100) so the per-customer
  // auto-invoice gating downstream treats it exactly like a confident match.
  if (!customerId) {
    const cleanName = (ed.customer_name ?? '').trim();
    const key = normName(cleanName);
    // Guard on the NORMALISED name so punctuation-only junk ("()", "--", ". .")
    // — which normalises to "" — can't create (and re-create every sync) a customer.
    if (key.length >= 2) {
      const dupe = customers.find((c) => normName(c.name) === key);
      if (dupe) {
        customerId = dupe.id;
        matchConfidence = 100;
      } else {
        const { data: newCust } = await db
          .from('of_customers')
          .insert({ org_id: orgId, name: cleanName })
          .select('*')
          .single();
        if (newCust) {
          customers.push(newCust as CustomerLite & Partial<OfCustomer>);
          customerId = (newCust as { id: string }).id;
          matchConfidence = 100;
        }
      }
    }
  }

  const matchedCustomer = customerId ? customers.find((c) => c.id === customerId) ?? null : null;

  // Per-customer auto-invoice threshold (customer-ai-invoicing.sql), else the
  // module default. Only a KNOWN customer gets their params applied below.
  const confidenceThreshold = matchedCustomer?.ai_auto_invoice_confidence ?? CUSTOMER_CONFIDENT;
  const customerKnown = !!customerId && matchConfidence >= confidenceThreshold;

  // Load this customer's order-name mappings. Missing table (migration not run)
  // → [], so behaviour degrades to fuzzy-only matching, never crashes.
  let aliases: CdCustomerItemAlias[] = [];
  if (customerId) {
    const { data: aliasRows } = await db
      .from('cd_customer_item_aliases')
      .select('*')
      .eq('org_id', orgId)
      .eq('customer_id', customerId);
    aliases = (aliasRows ?? []) as CdCustomerItemAlias[];
  }
  // raw_name (lowercased, trimmed) → alias, for an exact-match lookup per line.
  const aliasByRaw = new Map<string, CdCustomerItemAlias>();
  for (const a of aliases) {
    const key = (a.raw_name ?? '').toLowerCase().trim();
    if (key) aliasByRaw.set(key, a);
  }
  // Aliases + all params only steer a KNOWN customer's order — an unknown/partial
  // customer behaves exactly as before (no alias, no prefix strip, doc price first).
  const applyParams = customerKnown ? matchedCustomer : null;
  if (!applyParams) aliasByRaw.clear();
  const stripPrefixes = !!applyParams && applyParams.strip_order_prefixes !== false; // default on when known
  const priceFromList = applyParams?.invoice_price_basis === 'price_list';

  // Pricing: document price first; otherwise the shared Core Data resolution —
  // customerPriceList picks the customer's explicit default list when valid, else
  // their newest valid own list, else the org standard list; resolvePrice then
  // applies custom-price/margin overrides exactly like the invoice builder.
  // select('*') keeps this safe pre-migration (never names a missing column).
  const { data: plRows } = await db.from('pl_price_lists').select('*').eq('org_id', orgId);
  const priceList = customerPriceList(
    matchedCustomer ? { id: matchedCustomer.id, default_price_list_id: matchedCustomer.default_price_list_id ?? null } : null,
    (plRows ?? []) as CdPriceList[],
  );
  let overrides: CdPriceOverride[] = [];
  if (priceList) {
    const { data: ov } = await db.from('pl_overrides').select('*').eq('price_list_id', priceList.id);
    overrides = (ov ?? []) as CdPriceOverride[];
  }

  // Catalogue (loaded once) for fuzzy product matching of each ordered line.
  const { data: stockRows } = await db
    .from('pp_stock_items')
    .select('id, name, avg_unit_price, unit')
    .eq('org_id', orgId);
  const stockItems = (stockRows ?? []) as StockLite[];

  const items: { stock_item_id: string | null; name: string; qty: number; unit: string | null; unit_price: number }[] = [];
  // The audit trail written back to the document — what the paper said, what we
  // matched it to, and where its price came from. See OrderLineRecord.
  const records: OrderLineRecord[] = [];
  let unpricedLines = 0;
  let unmatchedLines = 0;

  // ---------------------------------------------------------------------------
  // PRODUCT RESOLUTION — one document-wide pass, before anything is priced.
  //
  // It has to be document-wide. A per-line matcher assigned "FF - GRAPES WHITE
  // BOX" to the Avocado the document's own avocado line had already taken, and
  // could not know it, because nothing was looking at the document as a whole.
  // `resolveOrderLines` refuses anything short of effective identity, refuses a
  // candidate that disagrees about colour/size/cut/variety, and sends BOTH lines
  // to review when two of them land on one product. Everything it refuses keeps
  // the paper's own words and gets no price at all.
  // ---------------------------------------------------------------------------
  const rawNames = lines.map((li) => ((li.raw_description ?? '').trim() || (li.description ?? '').trim()).trim());
  // A customer's confirmed alias is a human ruling on this exact raw name, so it
  // pins the product outright — but still goes through the duplicate check.
  const pins = new Map<number, StockLite>();
  const aliasByIndex = new Map<number, CdCustomerItemAlias>();
  lines.forEach((li, i) => {
    const alias = aliasByRaw.get(rawNames[i].toLowerCase()) ?? aliasByRaw.get((li.description ?? '').trim().toLowerCase());
    if (!alias) return;
    aliasByIndex.set(i, alias);
    const pinned = alias.stock_item_id ? stockItems.find((it) => it.id === alias.stock_item_id) ?? null : null;
    if (pinned) pins.set(i, pinned);
  });
  const resolutions = resolveOrderLines(
    lines.map((li, i) => ({ raw_description: rawNames[i], description: li.description ?? '' })),
    stockItems,
    { pins, stripPrefix: stripPrefixes },
  );

  // CREATE-ON-UPLOAD dedupe: normalised line name → the pp_stock_items row we
  // created earlier IN THIS SAME RUN, so two identical unmatched lines link to one
  // new product instead of inserting it twice. Loaded catalogue dedupe is handled
  // by the resolution pass re-finding a row a prior sync already created.
  const createdStock = new Map<string, StockLite>();
  for (let i = 0; i < lines.length; i += 1) {
    const li = lines[i];
    const res = resolutions[i];
    const rawName = res.rawName;
    if (!rawName) continue;
    const qty = num(li.quantity) ?? 0;
    const docUnit = (li.unit ?? '').trim() || null;
    const alias = aliasByIndex.get(i) ?? null;

    let s: StockLite | null = res.item;
    // The billed name: the catalogue product when the gate matched it, otherwise
    // the paper's own words. A name we merely suspected never reaches an invoice.
    let name = res.name;
    let unit = docUnit;
    if (alias) {
      name = (alias.invoice_name ?? '').trim() || s?.name || rawName;
      if ((alias.unit ?? '').trim()) unit = (alias.unit as string).trim();
      else if (!unit) unit = s?.unit ?? null;
    } else if (!unit) {
      unit = s?.unit ?? null;
    }

    // CREATE-ON-UPLOAD: a line the catalogue has NOTHING for is a product the org
    // may genuinely not carry yet → create a pp_stock_items row so Core Data grows
    // with the upload. Deliberately NOT done for 'low_confidence',
    // 'variant_conflict' or 'duplicate': there, something close already exists and
    // a human has to say which — minting a near-duplicate product would bury the
    // question under a second catalogue row. Dedupe within this run by normalised
    // name; a prior sync's row is re-found by the resolution pass. Best-effort — a
    // failed insert leaves stock_item_id null.
    if (!alias && !s && res.reason === 'no_candidate') {
      // The name a NEW product is created under — the same text the next sync's
      // resolution pass will score, so a re-sync re-finds it (never duplicates).
      const createName = stripPrefixes ? stripCategoryPrefix(rawName) : rawName;
      // Key on the NORMALISED create-name: skips punctuation-only junk (normalises
      // to "" → no create/re-create), and dedups identical lines within this run.
      const key = normName(createName);
      const already = key ? createdStock.get(key) : undefined;
      if (already) {
        s = already;
        name = already.name;
        if (!unit) unit = already.unit;
      } else if (key) {
        const linePrice = num(li.unit_price);
        const { data: newItem } = await db
          .from('pp_stock_items')
          .insert({
            org_id: orgId,
            name: createName,
            unit: unit || 'each',
            on_hand: 0,
            low_threshold: 0,
            avg_unit_price: linePrice != null && linePrice > 0 ? linePrice : null,
            currency: 'ZAR',
          })
          .select('id, name, avg_unit_price, unit')
          .single();
        if (newItem) {
          s = newItem as StockLite;
          stockItems.push(s);
          createdStock.set(key, s);
          name = s.name; // line + catalogue agree on the clean created name
          if (!unit) unit = s.unit;
        }
      }
    }

    // PRICING. `invoice_price_basis: 'price_list'` re-prices every line from OUR
    // list and ignores the document's own figure — that is deliberate and correct
    // (a supplier bills at its own prices, not at whatever the customer's purchase
    // order happens to carry), and the review screen now SAYS so and shows the
    // paper's figure beside ours. Otherwise the doc price wins, then the list.
    //
    // An UNMATCHED line is never priced. We do not know what product it is, so any
    // number here would be a guess dressed as a price — which is exactly how a
    // R13,457.60 order was invoiced at R25,958.95.
    const documentPrice = num(li.unit_price);
    let unitPrice: number | null = priceFromList ? null : documentPrice;
    let priceSource: OrderPriceSource = unitPrice != null ? 'document' : 'none';
    let priceListName: string | null = null;
    if (unitPrice == null && s) {
      const resolved = resolvePrice(s, priceList, overrides);
      // A resolvable price is a price ABOVE ZERO. `resolvePrice` returns
      // list_margin(0) for a product with no cost on file whenever any list
      // exists, which used to count as "priced" and let a R0.00 line auto-invoice.
      if (resolved.source !== 'none' && resolved.price > 0) {
        unitPrice = resolved.price;
        priceSource = resolved.source === 'custom' ? 'custom' : resolved.source === 'base' ? 'base' : 'price_list';
        priceListName = resolved.listName;
      }
    }
    if (unitPrice == null) unpricedLines += 1;
    if (!res.matched && !s) unmatchedLines += 1;

    items.push({ stock_item_id: s?.id ?? null, name, qty, unit, unit_price: unitPrice ?? 0 });
    records.push({
      raw_description: rawName,
      name,
      stock_item_id: s?.id ?? null,
      matched: !!s,
      match_confidence: alias ? 100 : res.confidence,
      match_reason: s ? 'matched' : res.reason,
      suggestion: res.suggestion,
      unit_price: unitPrice,
      price_source: priceSource,
      price_list_name: priceListName,
      document_price: documentPrice,
    });
  }

  // Write the audit trail back onto the document (jsonb — no migration, same
  // place `line_audit` and `direction` live), so the review screen can show the
  // paper's words beside the product we matched and name the price's origin.
  // Best-effort: the order stands whether or not this lands.
  await db
    .from('documents')
    .update({ extracted_data: { ...ed, order_lines: records } })
    .eq('id', documentId)
    .eq('org_id', orgId);

  // Auto-invoice only when the customer is known, every line has a real price,
  // and every line is on a product we actually identified.
  //
  // `ai_allow_unpriced` lets a customer opt into invoicing with unpriced lines —
  // it is a decision about PRICES and does not extend to unidentified PRODUCTS.
  // An unmatched line means we do not know what is being sold, and no per-customer
  // setting should let that reach a customer's invoice unseen; it holds as a draft
  // and the review screen shows the paper's words and what they nearly matched.
  //
  // An explicit "Confirm & invoice" (params.finalize) still wins — that is a human
  // who has seen the lines on screen and can edit them.
  const finalize =
    params.finalize === true
      ? true
      : customerKnown &&
        unmatchedLines === 0 &&
        (unpricedLines === 0 || applyParams?.ai_allow_unpriced === true);

  // Upsert one order per source document. The existence probe + migration guard
  // ran at the TOP (before any Core Data was created), so `existingOrder` is ready.
  let orderId = (existingOrder as { id: string } | null)?.id ?? null;
  let inv = (existingOrder as { invoice_number: string | null } | null)?.invoice_number ?? null;
  const status = finalize ? 'invoiced' : 'draft';
  if (finalize && !inv) {
    // Shared numbering: allocate from the same of_next_number() counter the
    // invoice builder uses, so doc-driven invoices can't collide with
    // builder-created ones. Orders that already carry a number keep it (`!inv`
    // guard above) so re-syncs stay stable. Pre-migration (rpc missing) we fall
    // back to the legacy count-based scheme.
    const { data: alloc, error: allocErr } = await db.rpc('of_next_number', { p_kind: 'invoice' });
    if (!allocErr && typeof alloc === 'string' && alloc) {
      inv = alloc;
    } else {
      const { count } = await db
        .from('of_orders')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .not('invoice_number', 'is', null);
      inv = invoiceNumber((count ?? 0) + 1);
    }
  }

  if (orderId) {
    await db.from('of_orders').update({ customer_id: customerId, status, invoice_number: inv }).eq('id', orderId);
    await db.from('of_order_items').delete().eq('order_id', orderId);
  } else {
    const { data: created, error: insErr } = await db
      .from('of_orders')
      .insert({ org_id: orgId, customer_id: customerId, status, invoice_number: inv, source_document_id: documentId })
      .select('id')
      .single();
    if (insErr || !created) return { ok: false, reason: insErr?.message ?? 'order-insert-failed' };
    orderId = (created as { id: string }).id;
  }

  if (items.length > 0) {
    await db.from('of_order_items').insert(
      items.map((i) => ({
        org_id: orgId,
        order_id: orderId,
        stock_item_id: i.stock_item_id,
        name: i.name,
        qty: i.qty,
        unit: i.unit,
        unit_price: i.unit_price,
      })),
    );
  }

  // Materialise a REAL invoice (of_invoices + item snapshot) for auto-invoiced
  // orders so the v2 Invoices module sees the sale. Idempotent: one invoice per
  // order — when a row already exists for this order we only re-link it, and an
  // order that already carried an invoice number keeps it (no re-allocation) so
  // re-syncs stay stable. Tolerant of the core-data migration not being applied
  // yet: a missing table/column just skips this step and the order behaves
  // exactly as before.
  if (status === 'invoiced' && orderId && inv) {
    const { data: existInv, error: invLookErr } = await db
      .from('of_invoices')
      .select('id')
      .eq('org_id', orgId)
      .eq('order_id', orderId)
      .maybeSingle();
    if (!invLookErr) {
      let invoiceId = (existInv as { id: string } | null)?.id ?? null;
      if (!invoiceId) {
        const { data: setRow } = await db
          .from('of_settings')
          .select('default_vat_rate, default_payment_terms_days')
          .eq('org_id', orgId)
          .maybeSingle();
        const settings = setRow as { default_vat_rate?: number; default_payment_terms_days?: number } | null;
        const standardRate = Number(settings?.default_vat_rate ?? 15);
        // VAT rate follows the customer's treatment (zero_rated/exempt → 0,
        // standard → the org default). Unknown customer → the org default.
        const vatRate = applyParams ? vatRateForTreatment(applyParams.vat_treatment, standardRate) : standardRate;
        // Per-customer payment-terms override (null → the org default).
        const termsDays = Number(applyParams?.invoice_terms_days_override ?? settings?.default_payment_terms_days ?? 30);
        const issued = new Date();
        const due = new Date(issued.getTime() + termsDays * 86_400_000);
        // Snapshot the matched customer's standing rebate (rebates.sql) onto the
        // materialised invoice. Migration-safe: rebate_pct only exists once
        // rebates.sql is run — on a missing-column error, retry without that one
        // key so pre-migration auto-invoicing behaves exactly as before.
        const invoiceRow: Record<string, unknown> = {
          org_id: orgId,
          customer_id: customerId,
          order_id: orderId,
          invoice_number: inv,
          status: 'sent',
          issue_date: issued.toISOString().slice(0, 10),
          due_date: due.toISOString().slice(0, 10),
          vat_rate: vatRate,
          rebate_pct: Number(matchedCustomer?.rebate_pct) || 0,
          sent_at: issued.toISOString(),
        };
        let { data: createdInv, error: invInsErr } = await db
          .from('of_invoices')
          .insert(invoiceRow)
          .select('id')
          .single();
        if (invInsErr && /rebate_pct/i.test(invInsErr.message) && /column|schema cache|find/i.test(invInsErr.message)) {
          delete invoiceRow.rebate_pct;
          ({ data: createdInv, error: invInsErr } = await db.from('of_invoices').insert(invoiceRow).select('id').single());
        }
        if (!invInsErr && createdInv) {
          invoiceId = (createdInv as { id: string }).id;
          if (items.length > 0) {
            await db.from('of_invoice_items').insert(
              items.map((i, idx) => ({
                org_id: orgId,
                invoice_id: invoiceId,
                stock_item_id: i.stock_item_id,
                name: i.name,
                qty: i.qty,
                unit: i.unit,
                unit_price: i.unit_price,
                sort_order: idx,
              })),
            );
          }
        }
      }
      if (invoiceId) {
        // invoice_id column may predate the migration — a failed link is fine,
        // the invoice row itself still exists and lists under Invoices.
        await db.from('of_orders').update({ invoice_id: invoiceId }).eq('id', orderId);
      }
    }
  }

  await syncStock(db, orgId, orderId, status === 'invoiced', inv);

  return {
    ok: true,
    orderId,
    status,
    invoice_number: inv,
    customerId,
    matchConfidence,
    // Held (draft) for any reason — uncertain customer or an unpriced line — so the
    // caller routes the user into Doc-U review to confirm/price before invoicing.
    needsCustomerReview: !finalize,
    unpricedLines,
    unmatchedLines,
    itemCount: items.length,
  };
}
