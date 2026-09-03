import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Document, ExtractedLineItem } from './types';
import { isOutgoingDocument } from './docu/document-direction';
import type { DocuExtractedData } from './docu/types';
import { parseLocaleNumber, inferDecimalSeparator, type DecimalSeparator } from './locale-number';
import { dedupeByReference } from './docu/market-line';

/**
 * Doc-U → ProcurePulse feed.
 *
 * Turns a document's extracted product lines into live ProcurePulse stock:
 * for each line it matches-or-creates a stock item by name, records a received
 * movement, and updates the on-hand level, latest price and cheapest supplier.
 *
 * It is IDEMPOTENT per document: every movement carries `source_document_id`,
 * so re-feeding the same document first removes that document's prior
 * contribution and re-applies the current line items — correcting an extraction
 * and re-syncing never double-counts stock.
 *
 * All writes go through the caller's RLS-scoped client, so they only succeed
 * for the caller's own org with the `procurepulse` feature enabled.
 */

/** Document types whose lines represent stock received into inventory. */
const FEED_TYPES = new Set(['invoice', 'statement', 'delivery_note']);

export interface FeedResult {
  fed: boolean;
  reason?: string;
  itemsAffected: number;
  movementsWritten: number;
  /** Set with reason 'duplicate-statement': the document that already fed this statement. */
  duplicateOf?: string;
}

/**
 * Parse a loose numeric string ("1 240.50", "R78", "12") to a number, or null.
 * Delegates to the shared locale-aware parser (lib/platform/locale-number.ts)
 * instead of `String(s).replace(/[^0-9.\-]/g, '')` — that old pattern DELETED
 * commas rather than reading them, so an SA-formatted "0,20" became "020" → 20,
 * a change of magnitude rather than a rounding error (see that module's header
 * for the full incident). `hint` is a document-level separator reading from
 * `inferDecimalSeparator` over the same line set this string came from — pass
 * it whenever the whole set is in scope; omit it for a single string read in
 * isolation, which is still read correctly for every unambiguous format.
 */
export function parseNum(s: string | undefined | null, hint?: DecimalSeparator | null): number | null {
  return parseLocaleNumber(s, hint ? { decimalSeparator: hint } : undefined);
}

/** Positive price, or null — never let a negative/zero price reach pricing. */
export function parsePrice(s: string | undefined | null, hint?: DecimalSeparator | null): number | null {
  const n = parseNum(s, hint);
  return n != null && n > 0 ? n : null;
}

/** Escape LIKE wildcards so a product name is matched literally (case-insensitively). */
function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Build a "300g · 12/box"-style pack label from extracted weight (kg) + units. */
function buildPack(weight: string | undefined, unitsPerBox: string | undefined, hint?: DecimalSeparator | null): string | null {
  const w = parseNum(weight, hint);
  const weightLabel = w != null && w > 0 ? (w < 1 ? `${Math.round(w * 1000)}g` : `${w}kg`) : null;
  const upb = (unitsPerBox ?? '').trim();
  if (weightLabel && upb) return `${weightLabel} · ${upb}/box`;
  if (weightLabel) return weightLabel;
  if (upb) return `${upb}/box`;
  return null;
}

/**
 * Recompute the weighted-average kilograms-per-unit for a set of stock items from
 * ALL of their CURRENT feeding documents (read after movements have been applied/
 * reversed, so it reflects the live source set — fixing stale kg after a doc is
 * removed or a later weightless doc arrives). Batched: two reads total regardless
 * of item count. Returns id → kg/unit (or null when no usable weight data remains).
 */
export async function computeKgPerUnit(
  supabase: SupabaseClient,
  items: { id: string; name: string }[],
): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  if (items.length === 0) return result;
  const ids = items.map((i) => i.id);

  const { data: moves } = await supabase
    .from('pp_movements')
    .select('stock_item_id, source_document_id')
    .in('stock_item_id', ids);

  const docIdsByItem = new Map<string, Set<string>>();
  const allDocIds = new Set<string>();
  for (const m of (moves ?? []) as { stock_item_id: string; source_document_id: string | null }[]) {
    if (!m.source_document_id) continue;
    let set = docIdsByItem.get(m.stock_item_id);
    if (!set) {
      set = new Set();
      docIdsByItem.set(m.stock_item_id, set);
    }
    set.add(m.source_document_id);
    allDocIds.add(m.source_document_id);
  }

  const linesByDoc = new Map<string, ExtractedLineItem[]>();
  if (allDocIds.size > 0) {
    const { data: docs } = await supabase
      .from('documents')
      .select('id, extracted_data')
      .in('id', [...allDocIds]);
    for (const d of (docs ?? []) as {
      id: string;
      extracted_data: { line_items?: ExtractedLineItem[] } | null;
    }[]) {
      linesByDoc.set(d.id, d.extracted_data?.line_items ?? []);
    }
  }

  // Read each feeding document's own decimal separator ONCE from its own line
  // set (quantity/weight/total_kg) — a document's numbers are read together
  // (see lib/platform/locale-number.ts), and this average blends lines from
  // several documents, so two documents are never assumed to share one
  // convention just because they feed the same product.
  const hintByDoc = new Map<string, DecimalSeparator | null>();
  for (const [docId, docLines] of linesByDoc) {
    hintByDoc.set(docId, inferDecimalSeparator(docLines.flatMap((l) => [l.quantity, l.weight, l.total_kg])));
  }

  for (const it of items) {
    const docSet = docIdsByItem.get(it.id);
    const target = it.name.trim().toLowerCase();
    let totalQty = 0;
    let totalKg = 0;
    if (docSet) {
      for (const docId of docSet) {
        const hint = hintByDoc.get(docId);
        for (const li of linesByDoc.get(docId) ?? []) {
          if ((li.description ?? '').trim().toLowerCase() !== target) continue;
          const q = parseNum(li.quantity, hint);
          if (q == null || q <= 0) continue;
          const w = parseNum(li.weight, hint);
          const tkg = parseNum(li.total_kg, hint);
          // Prefer the canonical per-pack weight (× qty); fall back to total_kg.
          const kg = w != null && w > 0 ? q * w : tkg != null && tkg > 0 ? tkg : null;
          if (kg != null && kg > 0) {
            totalQty += q;
            totalKg += kg;
          }
        }
      }
    }
    result.set(it.id, totalQty > 0 ? totalKg / totalQty : null);
  }
  return result;
}

/**
 * Update a stock item, tolerating the kg_per_unit column not existing yet (the
 * add-kg-per-unit.sql migration may not be applied). If — and only if — the write
 * fails specifically because of that column, retry without it so the core
 * on_hand/price write still lands and self-heals once the migration is applied.
 */
async function applyStockPatch(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('pp_stock_items').update(patch).eq('id', id);
  if (error && 'kg_per_unit' in patch && /kg_per_unit/i.test(error.message ?? '')) {
    const { kg_per_unit: _omit, ...rest } = patch;
    void _omit;
    await supabase.from('pp_stock_items').update(rest).eq('id', id);
  }
}

/** Is the ProcurePulse feature enabled for this org? (cheap pre-check) */
export async function orgHasProcurePulse(supabase: SupabaseClient, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from('org_features')
    .select('enabled')
    .eq('org_id', orgId)
    .eq('feature_key', 'procurepulse')
    .maybeSingle();
  return Boolean((data as { enabled?: boolean } | null)?.enabled);
}

/**
 * The id of an OLDER, still-active statement for the same date, market and
 * total purchases that has already written stock movements — or null.
 *
 * "Already written movements" is the tie-breaker that makes this safe to call
 * from every feed path: the first copy to feed wins whichever order they were
 * uploaded in, a copy that failed extraction never blocks its sibling, and the
 * older copy is never told it duplicates the newer one. Compared on the
 * document's own summary block (what the paper says), not on filenames or
 * bytes, because re-prints differ in both.
 */
async function findFedDuplicateStatement(
  supabase: SupabaseClient,
  doc: FedDoc,
  supplierName: string | null,
): Promise<string | null> {
  const summary = (doc.extracted_data as DocuExtractedData | null)?.summary;
  const date = (summary?.statement_date ?? '').trim();
  const total = summary?.total_purchases;
  if (!date || total == null) return null;

  const { data: self } = await supabase.from('documents').select('created_at').eq('id', doc.id).maybeSingle();
  const selfCreated = (self as { created_at?: string } | null)?.created_at ?? null;

  const { data: rows } = await supabase
    .from('documents')
    .select('id, created_at, extracted_data')
    .eq('org_id', doc.org_id)
    .eq('document_type', 'statement')
    .is('superseded_at', null)
    .neq('id', doc.id)
    .filter('extracted_data->summary->>statement_date', 'eq', date);
  const wantSupplier = (supplierName ?? '').trim().toLowerCase();
  const candidates = ((rows ?? []) as { id: string; created_at: string; extracted_data: DocuExtractedData | null }[])
    .filter((r) => {
      const s = r.extracted_data?.summary;
      if (!s || s.total_purchases == null || Math.abs(Number(s.total_purchases) - Number(total)) > 0.005) return false;
      const theirSupplier = (r.extracted_data?.supplier ?? '').trim().toLowerCase();
      if (wantSupplier && theirSupplier && theirSupplier !== wantSupplier) return false;
      return !selfCreated || r.created_at < selfCreated;
    })
    .map((r) => r.id);
  if (candidates.length === 0) return null;

  const { data: fed } = await supabase
    .from('pp_movements')
    .select('source_document_id')
    .in('source_document_id', candidates)
    .limit(1);
  const first = (fed as { source_document_id: string }[] | null)?.[0];
  return first?.source_document_id ?? null;
}

/**
 * Reverse a document's contribution to ProcurePulse — used when the document is
 * deleted. Removes its stock movements and subtracts their net effect from the
 * affected items' on-hand (clamped at 0). Supplier prices have no per-document
 * link, so they are left as-is. Safe to call for docs that never fed stock.
 */
export async function unfeedDocumentFromProcurePulse(
  supabase: SupabaseClient,
  documentId: string,
): Promise<{ itemsReversed: number }> {
  const { data: moves } = await supabase
    .from('pp_movements')
    .select('stock_item_id, change')
    .eq('source_document_id', documentId);
  if (!moves || moves.length === 0) return { itemsReversed: 0 };

  const byItem = new Map<string, number>();
  for (const m of moves as { stock_item_id: string; change: number }[]) {
    byItem.set(m.stock_item_id, (byItem.get(m.stock_item_id) ?? 0) + Number(m.change));
  }
  const itemIds = [...byItem.keys()];

  // Drop this document's movements first…
  await supabase.from('pp_movements').delete().eq('source_document_id', documentId);

  // …then, in ONE query, find which touched items still have movements from
  // other documents. Items absent from that set are now orphaned. (Replaces the
  // old per-item "any movements left?" probe — 1 round-trip instead of M.)
  const { data: survivorRows } = await supabase
    .from('pp_movements')
    .select('stock_item_id')
    .in('stock_item_id', itemIds);
  const survivors = new Set((survivorRows ?? []).map((r) => (r as { stock_item_id: string }).stock_item_id));

  // Orphaned items have no source anymore — remove them in one bulk delete
  // (cascades their supplier prices) so the last feeding document leaves no
  // zombie zero-stock item behind.
  const orphanIds = itemIds.filter((id) => !survivors.has(id));
  if (orphanIds.length > 0) {
    await supabase.from('pp_stock_items').delete().in('id', orphanIds);
  }

  // Survivors are still fed by other documents — reverse their on_hand and
  // recompute kg/unit from their REMAINING feeding docs (this doc's movements are
  // already gone, so a stale kg from the removed doc gets corrected/cleared).
  const survivorIds = itemIds.filter((id) => survivors.has(id));
  if (survivorIds.length > 0) {
    const { data: cur } = await supabase
      .from('pp_stock_items')
      .select('id, name, on_hand')
      .in('id', survivorIds);
    const rows = (cur ?? []) as { id: string; name: string; on_hand: number }[];
    const kgById = await computeKgPerUnit(
      supabase,
      rows.map((r) => ({ id: r.id, name: r.name })),
    );
    await Promise.all(
      rows.map((row) => {
        const next = Math.max(0, Number(row.on_hand) - (byItem.get(row.id) ?? 0));
        return applyStockPatch(supabase, row.id, { on_hand: next, kg_per_unit: kgById.get(row.id) ?? null });
      }),
    );
  }

  return { itemsReversed: byItem.size };
}

type FedDoc = Pick<
  Document,
  'id' | 'org_id' | 'filename' | 'document_type' | 'supplier_id' | 'extracted_data'
>;

export async function feedDocumentToProcurePulse(
  supabase: SupabaseClient,
  doc: FedDoc,
): Promise<FeedResult> {
  const base: FeedResult = { fed: false, itemsAffected: 0, movementsWritten: 0 };

  if (!doc.document_type || !FEED_TYPES.has(doc.document_type)) {
    return { ...base, reason: 'type-not-routed-to-stock' };
  }
  // A document the ORG issued lists goods that LEFT the business. Feeding its
  // lines here would book the org's own sales in as stock received and its own
  // selling prices in as what it pays — the same inversion that made Turn 'n
  // Slice its own supplier. Checked here rather than at each call site so every
  // path (extract route, chat/email ingest, and the review-queue Save, which
  // re-reads the stored row) is covered by the one guard.
  if (isOutgoingDocument(doc.extracted_data as DocuExtractedData | null)) {
    return { ...base, reason: 'outgoing-document' };
  }
  // De-duplicated BY REFERENCE here as well as in the reader: documents
  // extracted before the reader learned to (and any reviewer edit that pastes a
  // row twice) still pass through this one choke point on Re-sync, review save
  // and sync-all. See lib/platform/docu/market-line.ts for the rule.
  const lineItems: ExtractedLineItem[] = dedupeByReference(doc.extracted_data?.line_items ?? []).lines;
  if (lineItems.length === 0) {
    return { ...base, reason: 'no-line-items' };
  }

  // One separator reading for the whole document (see lib/platform/locale-number.ts)
  // — a line-by-line guess would let one row's "269,000" and a sibling row's
  // "0,20" on the SAME invoice disagree about what a lone comma means.
  const hint = inferDecimalSeparator(
    lineItems.flatMap((li) => [li.quantity, li.unit_price, li.weight, li.total_kg]),
  );

  // Document-level supplier (for price provenance + movement label). The supplier
  // extracted in Doc-U review is authoritative; fall back to a linked suppliers row.
  let supplierName: string | null = (doc.extracted_data?.supplier ?? '').trim() || null;
  if (!supplierName && doc.supplier_id) {
    const { data: sup } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', doc.supplier_id)
      .maybeSingle();
    supplierName = (sup as { name?: string } | null)?.name ?? null;
  }

  // A RE-PRINT OF A STATEMENT ALREADY IN STOCK MOVES NOTHING. Idempotency below
  // is per `documents.id`, and nothing upstream hashes file bytes — and it could
  // not help anyway: the market re-prints the same day's statement with a new
  // "Printed on" time, so the two files never match byte-for-byte. Three of the
  // 47 April/May 2026 statements were exactly such pairs. Identity here is what
  // the paper itself says: same statement date, same market, same total
  // purchases, and an OLDER active document that has already moved stock.
  if (doc.document_type === 'statement') {
    const duplicateOf = await findFedDuplicateStatement(supabase, doc, supplierName);
    if (duplicateOf) {
      await supabase
        .from('pp_notifications')
        .insert({
          org_id: doc.org_id,
          kind: 'duplicate_statement',
          title: `${doc.filename} is a re-print of a statement already in stock`,
          body: 'Same statement date, market and total purchases as an earlier document — no stock was moved. Delete one copy if it was uploaded by mistake.',
          document_id: doc.id,
          read: false,
        })
        .then(undefined, () => undefined);
      return { ...base, reason: 'duplicate-statement', duplicateOf };
    }
  }

  // 1. This document's PRIOR contribution (from a previous feed), to undo it.
  const { data: priorMoves } = await supabase
    .from('pp_movements')
    .select('stock_item_id, change')
    .eq('source_document_id', doc.id);
  const priorByItem = new Map<string, number>();
  for (const m of (priorMoves ?? []) as { stock_item_id: string; change: number }[]) {
    priorByItem.set(m.stock_item_id, (priorByItem.get(m.stock_item_id) ?? 0) + Number(m.change));
  }
  if (priorMoves && priorMoves.length > 0) {
    await supabase.from('pp_movements').delete().eq('source_document_id', doc.id);
  }

  // Confirmed product-name aliases — a human has linked these raw descriptions to
  // a canonical stock item, so route them straight there (no ilike, no duplicate).
  // Tolerant of the pp_name_aliases table not existing yet (null → empty map).
  const aliasMap = new Map<string, string>();
  {
    const { data: aliasRows } = await supabase
      .from('pp_name_aliases')
      .select('raw_name, stock_item_id')
      .eq('org_id', doc.org_id)
      .eq('status', 'confirmed');
    for (const a of (aliasRows ?? []) as { raw_name: string; stock_item_id: string | null }[]) {
      if (a.stock_item_id) aliasMap.set(a.raw_name.trim().toLowerCase(), a.stock_item_id);
    }
    // Drop aliases whose target item was since deleted, so a line never routes to
    // a dead id (which would FK-fail the movement insert). One bulk check.
    const targetIds = [...new Set(aliasMap.values())];
    if (targetIds.length > 0) {
      const { data: alive } = await supabase.from('pp_stock_items').select('id').in('id', targetIds);
      const aliveSet = new Set(((alive ?? []) as { id: string }[]).map((r) => r.id));
      for (const [k, v] of aliasMap) if (!aliveSet.has(v)) aliasMap.delete(k);
    }
  }

  // 2. Apply the current line items.
  const newByItem = new Map<string, number>();
  const priceByItem = new Map<string, number>();
  const unitByItem = new Map<string, string>();
  // Effective seller per item: a per-line AGENT (market statement) wins over the
  // document-level supplier, so each product's price is attributed to who sold it.
  const supplierByItem = new Map<string, string>();
  let itemsAffected = 0;
  let movementsWritten = 0;

  for (const li of lineItems) {
    const name = (li.description ?? '').trim();
    if (!name) continue;

    const price = parsePrice(li.unit_price, hint);
    const qty = parseNum(li.quantity, hint) ?? 0;
    // A NEGATIVE QUANTITY IS A REVERSAL, NOT NOISE. Market statements print a
    // cancelled purchase as a second row with a negative QTY and a negative
    // TOTAL ("-10 KIWIFRUIT ... - 6,500.00"). This loop used to skip anything
    // ≤ 0, so the original +10 counted and the -10 never did: twelve such rows
    // across two months of one customer's statements left 517 boxes on hand
    // that were never delivered. The reversal now writes a negative movement;
    // it never creates an item, sets a price, a unit or a supplier — a row
    // that only takes stock away is not evidence of what the product costs.
    const reversal = qty < 0;
    // Counting unit as captured/corrected in Doc-U review (boxes / punnets / …).
    const lineUnit = (li.unit ?? '').trim();
    // Per-line seller (a market statement's AGENT) — else the document supplier.
    const lineSupplier = (li.supplier ?? '').trim() || supplierName;

    // A confirmed alias wins; otherwise match an existing item by name
    // (case-insensitive, literal — likeEscape stops "%"/"_" acting as wildcards),
    // else create.
    let itemId = aliasMap.get(name.toLowerCase()) ?? null;
    if (!itemId) {
      const { data: existing } = await supabase
        .from('pp_stock_items')
        .select('id')
        .eq('org_id', doc.org_id)
        .ilike('name', likeEscape(name))
        .maybeSingle();
      itemId = (existing as { id?: string } | null)?.id ?? null;
    }
    // Nothing on hand to reverse — the original row was never fed (or was
    // named differently). Skipping is the honest answer; inventing an item at
    // zero so it can go negative-then-clamp-to-zero would record nothing true.
    if (!itemId && reversal) continue;
    if (!itemId) {
      const { data: created, error: createErr } = await supabase
        .from('pp_stock_items')
        .insert({
          org_id: doc.org_id,
          name,
          pack: buildPack(li.weight, li.units_per_box, hint),
          unit: lineUnit || 'boxes',
          on_hand: 0,
          low_threshold: 0,
          avg_unit_price: price,
          currency: 'ZAR',
          source_document_id: doc.id,
        })
        .select('id')
        .single();
      if (createErr || !created) continue; // RLS/feature-gate or bad row — skip
      itemId = (created as { id: string }).id;
    }

    // The document is the authority on the counting unit it was received in.
    if (lineUnit && !reversal) unitByItem.set(itemId, lineUnit);
    if (lineSupplier && !reversal) supplierByItem.set(itemId, lineSupplier);

    if (qty !== 0) {
      const { error: moveErr } = await supabase.from('pp_movements').insert({
        org_id: doc.org_id,
        stock_item_id: itemId,
        change: qty,
        reason: reversal ? 'reversed' : 'received',
        source_label: lineSupplier ?? doc.filename,
        source_document_id: doc.id,
      });
      if (!moveErr) {
        newByItem.set(itemId, (newByItem.get(itemId) ?? 0) + qty);
        movementsWritten += 1;
      }
    }

    if (price != null && !reversal) priceByItem.set(itemId, price);
    itemsAffected += 1;
  }

  // 3. Reconcile each touched item: on_hand += (new − prior), price, unit, kg, supplier.
  const touched = new Set<string>([
    ...priorByItem.keys(),
    ...newByItem.keys(),
    ...priceByItem.keys(),
    ...unitByItem.keys(),
  ]);
  const touchedIds = [...touched];

  // Batch-read the touched items' current level + name in one query (replaces the
  // old per-item on_hand probe), then recompute kg/unit across ALL their feeding
  // docs — movements now reflect this feed, so the average is current, not stale.
  const { data: touchedRows } = touchedIds.length
    ? await supabase.from('pp_stock_items').select('id, name, on_hand').in('id', touchedIds)
    : { data: [] };
  const rowById = new Map(
    ((touchedRows ?? []) as { id: string; name: string; on_hand: number }[]).map((r) => [r.id, r]),
  );
  const kgById = await computeKgPerUnit(
    supabase,
    [...rowById.values()].map((r) => ({ id: r.id, name: r.name })),
  );

  for (const id of touched) {
    const delta = (newByItem.get(id) ?? 0) - (priorByItem.get(id) ?? 0);
    const row = rowById.get(id);

    const patch: Record<string, unknown> = { source_document_id: doc.id };
    // Clamp to >= 0 — stock should never read negative even if data drifts.
    if (row) patch.on_hand = Math.max(0, Number(row.on_hand) + delta);
    if (priceByItem.has(id)) patch.avg_unit_price = priceByItem.get(id);
    // The doc's counting unit (e.g. punnets) corrects a previously-defaulted unit.
    if (unitByItem.has(id)) patch.unit = unitByItem.get(id);
    // kg/unit recomputed from all current feeding docs (value, or null when no
    // weight data remains — which correctly clears a stale figure).
    if (kgById.has(id)) patch.kg_per_unit = kgById.get(id);

    await applyStockPatch(supabase, id, patch);

    // Supplier price: upsert THIS item's seller's latest price (per-line agent if
    // present, else the document supplier), then recompute the cheapest supplier.
    const itemSupplier = supplierByItem.get(id) ?? supplierName;
    if (itemSupplier && priceByItem.has(id)) {
      const price = priceByItem.get(id)!;
      const { data: existingSup } = await supabase
        .from('pp_item_suppliers')
        .select('id')
        .eq('stock_item_id', id)
        .eq('supplier_name', itemSupplier)
        .maybeSingle();
      if (existingSup) {
        await supabase.from('pp_item_suppliers').update({ price }).eq('id', (existingSup as { id: string }).id);
      } else {
        await supabase
          .from('pp_item_suppliers')
          .insert({ org_id: doc.org_id, stock_item_id: id, supplier_name: itemSupplier, price });
      }
      const { data: cheapest } = await supabase
        .from('pp_item_suppliers')
        .select('supplier_name')
        .eq('stock_item_id', id)
        .order('price', { ascending: true })
        .limit(1);
      const top = (cheapest as { supplier_name: string }[] | null)?.[0];
      if (top) await supabase.from('pp_stock_items').update({ cheapest_supplier: top.supplier_name }).eq('id', id);
    }
  }

  // 4. Notify ProcurePulse that a document was synced, and log a stock-activity
  //    event for the dashboard feed (best-effort — tolerant of either table).
  if (itemsAffected > 0) {
    const kind = doc.document_type === 'statement' ? 'new_market_statement' : 'new_direct_doc';
    const title = `${itemsAffected} item${itemsAffected === 1 ? '' : 's'} updated from ${doc.filename}`;
    const body = supplierName ? `Synced from ${supplierName} via Doc-U` : 'Synced from Doc-U';
    await supabase.from('pp_notifications').insert({
      org_id: doc.org_id,
      kind,
      title,
      body,
      document_id: doc.id,
      read: false,
    });
    await supabase
      .from('procurepulse_activity_events')
      .insert({ org_id: doc.org_id, type: 'document_sync', title, body, ref_id: doc.id })
      .then(undefined, () => undefined);
  }

  return { fed: true, itemsAffected, movementsWritten };
}
