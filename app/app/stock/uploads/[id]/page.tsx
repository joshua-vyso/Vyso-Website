import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { DocumentDetailPanel } from '@/components/platform/docu/DocumentDetailPanel';
import { allUnits } from '@/lib/platform/procurepulse/units';
import { canSeeMoney } from '@/lib/platform/access';
import { hubdocStateForDocument } from '@/lib/platform/hubdoc';
import type { TaxInvoicePrintContext } from '@/components/platform/docu/PrintTaxInvoice';
import type { ClassicInvoiceParty } from '@/components/platform/orderflow/InvoiceSheetClassic';
import type { CdCompanyProfile } from '@/lib/platform/coredata';
import type { ProductOption } from '@/lib/platform/docu/product-suggest';
import type { DocuExtractedData } from '@/lib/platform/docu/types';
import type { DocumentFolder, DocumentWithSupplier } from '@/lib/platform/types';

/**
 * Review one document, from inside Stock & Suppliers
 * (`.ai/plan_stock_suppliers_page.md`, "Uploads").
 *
 * IT IS `app/app/docu/[id]/page.tsx`, REHOMED — deliberately, and almost
 * line-for-line. `DocumentDetailPanel` is the component that dispatches to the
 * five review arms (order / receipt / credit / amendment / generic extraction
 * editor); the twelve parallel reads below are its props, and every one of them
 * is load-bearing for one of those arms. A "simpler" version of this page is a
 * version where one arm silently loses its typeahead, its units or its linked
 * order, so the fetch fan-out is copied intact rather than trimmed by guesswork.
 *
 * THE PANEL IS RENDERED UNCHANGED. Its internal links still point into
 * `/app/docu/*`, and that is correct: Doc-U is not one of the modules this
 * restructure replaced — it still exists at its own routes, and those links go
 * to screens that are still there. Only the two links this FILE owns (the
 * not-found escape hatch) point back into the stock module.
 *
 * WHY NOT A SHARED HELPER BETWEEN THE TWO PAGES. The duplication is real and it
 * is temporary: the plan's later ingestion-spine task collapses the two upload
 * doors into `/api/ingest`, and factoring this fan-out into a lib function now
 * would be refactoring a thing that is about to move. Both copies read the same
 * tables in the same order, so a schema change breaks them together and loudly.
 */
export default async function StockDocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('documents')
    .select('*, supplier:suppliers(id,name,initials)')
    .eq('id', id)
    .maybeSingle();

  const doc = data as DocumentWithSupplier | null;

  if (!doc) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="max-w-sm rounded-2xl border border-[var(--pf-border)] bg-white px-8 py-10 text-center shadow-[var(--pf-shadow-card)]">
          <h1 className="of-display text-[18px] font-semibold text-[var(--pf-text)]">
            Document not found
          </h1>
          <p className="mt-2 text-[14px] text-[var(--pf-text-secondary)]">
            This document may have been removed or you don&apos;t have access to it.
          </p>
          <Link
            href="/app/stock/uploads"
            className="mt-5 inline-flex h-[42px] items-center rounded-[var(--pf-radius-control)] bg-[var(--pf-accent-strong)] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[var(--pf-accent-deep)]"
          >
            Back to Uploads
          </Link>
        </div>
      </div>
    );
  }

  // `extracted_data` as the Doc-U view over it — the direction record (written
  // only on documents the org issued) decides whether there is a matched
  // customer to fetch below.
  const extracted = (doc.extracted_data as DocuExtractedData | null) ?? null;
  const billedCustomerId = extracted?.direction?.customer_id ?? null;

  // Everything the detail panel needs, fetched in PARALLEL (they have no
  // dependency on each other): sibling org documents power the cross-document
  // intelligence (duplicate detection, supplier history, relationships); folders
  // power the folder picker; pp_movements gives the fed-item count (RLS returns
  // nothing for orgs without the feature); the signed URL is the preview source.
  const [
    { data: siblingData },
    { data: folderData },
    { data: fedMoves },
    { data: settingsData },
    { data: customerData },
    { data: orderData },
    { data: productData },
    { data: aliasData },
    { data: profileData },
    { data: ofSettingsData },
    { data: billedCustomer },
    signedRes,
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('*, supplier:suppliers(id,name,initials)')
      .eq('org_id', doc.org_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('document_folders')
      .select('*')
      .eq('org_id', doc.org_id)
      .order('name', { ascending: true }),
    supabase.from('pp_movements').select('stock_item_id').eq('source_document_id', doc.id),
    // The org's measurement units (workspace-managed) feed the unit dropdown.
    // Tolerant of pp_settings not existing → built-in units only.
    supabase.from('pp_settings').select('custom_units').eq('org_id', doc.org_id).maybeSingle(),
    // OrderFlow customers (for the order-review typeahead) + any order already
    // built from this document.
    supabase.from('of_customers').select('id, name').eq('org_id', doc.org_id).order('name', { ascending: true }),
    supabase.from('of_orders').select('id, status, invoice_number, customer_id').eq('source_document_id', id).maybeSingle(),
    // The org's catalogue for the line-description typeahead. Fetched whole,
    // once, because the filtering is local (see docu/product-suggest.ts).
    supabase
      .from('pp_stock_items')
      .select('id, name, unit, category')
      .eq('org_id', doc.org_id)
      .order('name', { ascending: true })
      .limit(600),
    // Confirmed name rulings, so typing what a SUPPLIER prints finds the
    // product the org books it under. 'dismissed' rulings are excluded.
    supabase
      .from('pp_name_aliases')
      .select('id, raw_name, custom_name, stock_item_id')
      .eq('org_id', doc.org_id)
      .eq('status', 'confirmed')
      .limit(600),
    // Seller identity for the regenerated tax invoice. cd_company_profile, NOT
    // of_settings — the latter carries numbering and VAT rates, not identity.
    supabase.from('cd_company_profile').select('*').eq('org_id', doc.org_id).maybeSingle(),
    supabase.from('of_settings').select('default_vat_rate').eq('org_id', doc.org_id).maybeSingle(),
    // The customer an OUTGOING invoice was matched to. Only fetched when there
    // is one — an unmatched document prints the name read off the page instead.
    billedCustomerId
      ? supabase
          .from('of_customers')
          .select('name, trading_name, vat_number, billing_address, account_code')
          .eq('id', billedCustomerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    doc.storage_path
      ? supabase.storage.from('documents').createSignedUrl(doc.storage_path, 600)
      : Promise.resolve({ data: null }),
  ]);
  const orgDocs = (siblingData as DocumentWithSupplier[] | null) ?? [];
  const folders = (folderData as DocumentFolder[] | null) ?? [];
  const orgUnits = allUnits((settingsData as { custom_units?: string[] | null } | null)?.custom_units);
  const customers = (customerData as { id: string; name: string }[] | null) ?? [];
  const linkedOrder =
    (orderData as { id: string; status: string; invoice_number: string | null; customer_id: string | null } | null) ??
    null;

  // ---- Typeahead catalogue ------------------------------------------------
  //
  // One option per PRODUCT, with its confirmed aliases folded in as alternate
  // names to match against (never to insert — see product-suggest.ts). An alias
  // that points at no product still earns a row of its own: it is a name the
  // org has ruled on, so it is a name worth offering.
  const stockItems = (productData as { id: string; name: string; unit: string | null; category: string | null }[] | null) ?? [];
  const aliases = (aliasData as { id: string; raw_name: string; custom_name: string | null; stock_item_id: string | null }[] | null) ?? [];

  const akaByItem = new Map<string, string[]>();
  for (const a of aliases) {
    if (!a.stock_item_id || !a.raw_name?.trim()) continue;
    const list = akaByItem.get(a.stock_item_id) ?? [];
    list.push(a.raw_name.trim());
    akaByItem.set(a.stock_item_id, list);
  }

  const products: ProductOption[] = [
    ...stockItems.map((s) => {
      const aka = akaByItem.get(s.id) ?? [];
      return {
        id: s.id,
        name: s.name,
        unit: s.unit ?? null,
        hint: [s.category, aka.length > 0 ? `also “${aka[0]}”` : null].filter(Boolean).join(' · ') || null,
        aka,
        // A real catalogue row — the only kind whose id may be stored as a
        // learned link's stock_item_id. See ProductOption.kind.
        kind: 'product' as const,
      };
    }),
    ...aliases
      .filter((a) => !a.stock_item_id && (a.custom_name?.trim() || a.raw_name?.trim()))
      .map((a) => ({
        id: a.id,
        name: (a.custom_name?.trim() || a.raw_name.trim()) as string,
        unit: null,
        hint: 'known name',
        aka: [a.raw_name.trim()],
        // `id` is a pp_name_aliases row, NOT a product. Offerable to type
        // against; never storable as a link's stock_item_id.
        kind: 'alias' as const,
      })),
  ];

  // ---- Regenerated tax invoice -------------------------------------------
  const printContext: TaxInvoicePrintContext = {
    companyProfile: (profileData as CdCompanyProfile | null) ?? null,
    orgName: session.org?.name ?? null,
    defaultVatRate: Number((ofSettingsData as { default_vat_rate?: number | null } | null)?.default_vat_rate ?? 0),
    customer: (billedCustomer as ClassicInvoiceParty | null) ?? null,
  };

  const fedItemCount = new Set(
    (fedMoves as { stock_item_id: string }[] | null)?.map((m) => m.stock_item_id) ?? [],
  ).size;

  const originalUrl = (signedRes as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null;

  // "Send to Hubdoc" appears ONLY when it would work: an owner or admin, a live
  // Xero connection, and an intake address set. The resolver is shared with
  // Doc-U's page and Review v2 (lib/platform/hubdoc.ts). AFTER the batch above
  // because two of its three reads are conditional on the first.
  const hubdoc = await hubdocStateForDocument(supabase, doc.org_id, doc.id, {
    documentType: doc.document_type,
    status: doc.status,
    supplierId: doc.supplier_id,
    storagePath: doc.storage_path,
    canSend: canSeeMoney(session.profile?.role),
  });

  // Detect image vs PDF by filename extension (the row carries no mime type).
  const ext = (doc.filename || doc.storage_path || '')
    .toLowerCase()
    .split('?')[0]
    .split('.')
    .pop();
  const isImage = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif', 'bmp'].includes(ext ?? '');

  return (
    // NO `h-full overflow-y-auto` wrapper here, unlike the Doc-U copy. That page
    // is the whole route; this one renders INSIDE the stock layout's header and
    // tab row, so its own scroll container would strand the tabs above a second
    // scrollbar. The page scroll is the shell's.
    <div>
      <Link
        href="/app/stock/uploads"
        className="text-[13px] font-medium text-[var(--pf-text-muted)] transition-colors hover:text-[var(--pf-accent-strong)]"
      >
        ← Uploads
      </Link>
      <div className="mt-3">
        <DocumentDetailPanel
          doc={doc}
          orgDocs={orgDocs}
          folders={folders}
          features={session.features}
          fedItemCount={fedItemCount ?? 0}
          orgUnits={orgUnits}
          products={products}
          customers={customers}
          linkedOrder={linkedOrder}
          originalUrl={originalUrl}
          isImage={isImage}
          hubdoc={hubdoc}
          printContext={printContext}
        />
      </div>
    </div>
  );
}
