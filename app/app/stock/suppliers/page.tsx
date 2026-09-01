import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { getSupplySyncData, type Supplier } from '@/lib/platform/supplysync-data';
import { CREDIT_ISSUE_LABEL, CREDIT_STATUS_LABEL } from '@/lib/platform/supplysync-credits';
import { fetchPrices, fetchStock } from '@/lib/platform/procurepulse-queries';
import { SupplierDirectory, type SupplierDirectoryRow } from '@/components/platform/stock/SupplierDirectory';
import type {
  SupplierProfileCreditDoc,
  SupplierProfileData,
  SupplierProfilePrice,
} from '@/components/platform/stock/SupplierProfilePanel';

/**
 * Stock & Suppliers → Suppliers (`.ai/plan_stock_suppliers_page.md`).
 *
 * ── TWO SUPPLIER TABLES, ONE LIST ───────────────────────────────────────────
 * The platform really does have two: `suppliers` (core — what a filed document
 * points at, created by the ingest pipeline) and `ss_suppliers` (the SupplySync
 * profile — scores, contacts, category). `supabase/supplysync-link.sql` bridged
 * them with `ss_suppliers.supplier_id`, and `lib/platform/supplysync-data.ts`
 * reads through that bridge to hang documents off a profile. This page merges
 * the same way, and then adds the case that fetcher has no reason to care
 * about: a CORE supplier with no profile yet still gets a row, marked as such,
 * because "who do we buy from" must not depend on whether the feed has got
 * round to inventing a profile for them.
 *
 * ── WHERE A SUPPLIER'S PRICES COME FROM ─────────────────────────────────────
 * Both signals, labelled. `ss_supplier_pricing` (the tracked price list, which
 * only the demo seeds write) is shown where an org has one; everything else
 * comes from `pp_item_suppliers` — the latest price per item per supplier that
 * the document feed maintains, which is the source with real coverage on a live
 * org. Same reasoning as the Market sheet, which documents the choice in full.
 *
 * Fully read-only. Nothing here writes.
 */

/** Per supplier, in the panel. A produce supplier can have hundreds of priced
 *  lines; the panel is a profile, not a price book — the Market sheet is where
 *  the whole matrix lives. */
const PRICE_ROWS_PER_SUPPLIER = 40;

const norm = (s: string) => s.trim().toLowerCase();

export default async function StockSuppliersPage() {
  const session = await getPlatformSession();
  const orgId = session?.org?.id ?? null;

  if (!orgId) return <SupplierDirectory rows={[]} profiles={{}} />;

  const db = await createServerSupabase();

  // `getSupplySyncData` is the existing aggregate fetcher and does the heavy
  // lifting (contacts, pricing, linked documents, credits). It does NOT expose
  // `ss_suppliers.supplier_id`, so the bridge itself is read alongside it —
  // three columns, one query — rather than widening a type the whole SupplySync
  // module depends on while another agent is working in the same tree.
  //
  // Every read degrades to empty rather than throwing: `getSupplySyncData`
  // swallows its own errors with `?? []`, and the two below do the same, so an
  // org whose database predates the ss_* migrations renders an empty directory
  // instead of a 500 (see lib/platform/db-errors.ts for the codes).
  const [data, bridgeRes, coreRes, items, prices] = await Promise.all([
    getSupplySyncData(orgId),
    db.from('ss_suppliers').select('id, supplier_id').eq('org_id', orgId),
    db.from('suppliers').select('id, name, location, contact_email').eq('org_id', orgId).order('name'),
    fetchStock(db, orgId),
    fetchPrices(db, orgId),
  ]);

  const coreIdByProfile = new Map<string, string>();
  for (const r of (bridgeRes.data ?? []) as { id: string; supplier_id: string | null }[]) {
    if (r.supplier_id) coreIdByProfile.set(r.id, r.supplier_id);
  }

  const coreRows = (coreRes.data ?? []) as {
    id: string;
    name: string;
    location: string | null;
    contact_email: string | null;
  }[];
  const coreById = new Map(coreRows.map((r) => [r.id, r]));

  // --- prices the documents feed knows about, by supplier name -------------
  // `pp_item_suppliers` keys its supplier by NAME (it is written off whatever
  // the document said), so the join back to a supplier row is by normalised
  // name — the same trim+lowercase the feed uses when it adopts a profile.
  const itemById = new Map(items.map((i) => [i.id, i]));
  const fedPricesByName = new Map<string, SupplierProfilePrice[]>();
  for (const p of prices) {
    const name = (p.supplier_name ?? '').trim();
    const price = Number(p.price);
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    const item = itemById.get(p.stock_item_id);
    if (!item) continue; // a price for an item that no longer exists says nothing
    const arr = fedPricesByName.get(norm(name)) ?? [];
    arr.push({
      id: `fed-${p.id}`,
      item: item.name,
      unit: item.unit,
      currentPrice: price,
      previousPrice: null,
      changePct: null,
      lastUpdated: p.created_at ? String(p.created_at).slice(0, 10) : null,
      source: 'documents',
    });
    fedPricesByName.set(norm(name), arr);
  }

  // --- credits, grouped by profile ----------------------------------------
  const creditsByProfile = new Map<string, typeof data.credits>();
  for (const c of data.credits) {
    if (!c.supplierId) continue;
    const arr = creditsByProfile.get(c.supplierId) ?? [];
    arr.push(c);
    creditsByProfile.set(c.supplierId, arr);
  }

  const rows: SupplierDirectoryRow[] = [];
  const profiles: Record<string, SupplierProfileData> = {};
  const claimedCoreIds = new Set<string>();
  const claimedNames = new Set<string>();

  for (const s of data.suppliers) {
    const coreId = coreIdByProfile.get(s.id) ?? null;
    if (coreId) claimedCoreIds.add(coreId);
    claimedNames.add(norm(s.name));

    const core = coreId ? coreById.get(coreId) ?? null : null;
    const credits = creditsByProfile.get(s.id) ?? [];
    const unresolved = credits.filter((c) => c.isUnresolved);

    // Credit-note paperwork with no claim logged against it. `linkedDocs` is
    // already the org's documents filed against this supplier (via the bridge),
    // so this is a filter, not a fifth query.
    const creditedDocIds = new Set(credits.map((c) => c.documentId).filter(Boolean) as string[]);
    const creditDocs: SupplierProfileCreditDoc[] = s.linkedDocs
      .filter((d) => d.docType === 'supplier_credit_note' && !creditedDocIds.has(d.id))
      .map((d) => ({ id: d.id, filename: d.filename, date: d.date, status: d.status }));

    rows.push({
      key: s.id,
      name: s.name,
      category: s.category,
      status: s.status,
      rating: s.rating,
      lastOrder: s.lastOrder,
      spendMtd: s.spendMtd,
      openCredits: unresolved.length,
      hasProfile: true,
    });

    profiles[s.id] = {
      key: s.id,
      name: s.name,
      category: s.category,
      status: s.status,
      risk: s.risk,
      rating: s.rating,
      location: core?.location ?? null,
      contactName: s.contactName,
      contactEmail: s.contactEmail ?? core?.contact_email ?? null,
      contactPhone: s.contactPhone,
      lastOrder: s.lastOrder,
      spendMtd: s.spendMtd,
      leadTimeDays: s.leadTimeDays,
      hasProfile: true,
      contacts: s.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        email: c.email,
        phone: c.phone,
        preferredMethod: c.preferredMethod,
        isPrimary: c.isPrimary,
      })),
      pricing: mergePricing(s, fedPricesByName.get(norm(s.name)) ?? []),
      credits: credits.map((c) => ({
        id: c.id,
        reference: c.reference,
        item: c.item,
        description: c.description,
        issueLabel: CREDIT_ISSUE_LABEL[c.issueType] ?? c.issueType,
        statusLabel: CREDIT_STATUS_LABEL[c.status] ?? c.status,
        amount: c.amount,
        amountCredited: c.amountCredited,
        claimedOn: c.claimedOn,
        ageDays: c.ageDays,
        unresolved: c.isUnresolved,
        documentId: c.documentId,
      })),
      creditDocs,
      unresolvedCreditTotal: unresolved.reduce((t, c) => t + c.amount, 0),
      unresolvedCreditCount: unresolved.length,
    };
  }

  // Core suppliers the profile table has never heard of. Matched out by id AND
  // by name: an unbridged profile with the same name is the same supplier, and
  // listing it twice would be worse than not listing it at all.
  for (const c of coreRows) {
    if (claimedCoreIds.has(c.id) || claimedNames.has(norm(c.name))) continue;
    const key = `core:${c.id}`;
    const fed = fedPricesByName.get(norm(c.name)) ?? [];
    rows.push({
      key,
      name: c.name,
      category: '',
      status: 'active',
      rating: 0,
      lastOrder: null,
      spendMtd: 0,
      openCredits: 0,
      hasProfile: false,
    });
    profiles[key] = {
      key,
      name: c.name,
      category: '',
      status: 'active',
      risk: 'low',
      rating: 0,
      location: c.location,
      contactName: null,
      contactEmail: c.contact_email,
      contactPhone: null,
      lastOrder: null,
      spendMtd: 0,
      leadTimeDays: null,
      hasProfile: false,
      contacts: [],
      pricing: fed.slice(0, PRICE_ROWS_PER_SUPPLIER),
      credits: [],
      creditDocs: [],
      unresolvedCreditTotal: 0,
      unresolvedCreditCount: 0,
    };
  }

  // Money first: the suppliers the business actually spends with lead the list,
  // then the ones with open credits, then everyone else alphabetically.
  rows.sort((a, b) => b.spendMtd - a.spendMtd || b.openCredits - a.openCredits || a.name.localeCompare(b.name));

  return <SupplierDirectory rows={rows} profiles={profiles} />;
}

/**
 * A supplier's tracked price list first (it carries a previous price, so it can
 * show a move), then anything the documents feed knows about that the list does
 * not already cover — matched on the item name so the same line does not appear
 * twice under two sources.
 */
function mergePricing(supplier: Supplier, fed: SupplierProfilePrice[]): SupplierProfilePrice[] {
  const tracked: SupplierProfilePrice[] = supplier.pricing.map((p) => ({
    id: p.id,
    item: p.item,
    unit: p.unit,
    currentPrice: p.currentPrice,
    previousPrice: p.previousPrice || null,
    changePct: p.previousPrice > 0 ? p.changePct : null,
    lastUpdated: p.lastUpdated,
    source: 'price_list',
  }));
  const seen = new Set(tracked.map((p) => norm(p.item)));
  for (const p of fed) {
    if (seen.has(norm(p.item))) continue;
    seen.add(norm(p.item));
    tracked.push(p);
  }
  return tracked.slice(0, PRICE_ROWS_PER_SUPPLIER);
}
