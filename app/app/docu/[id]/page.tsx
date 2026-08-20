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

export default async function DocumentReviewPage({
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
      <div className="flex min-h-[60vh] items-center justify-center px-8 py-7">
        <div className="max-w-sm rounded-2xl border border-[#EAEDF2] bg-white px-8 py-10 text-center shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <h1 className="of-display text-[18px] font-semibold text-[#171A17]">Document not found</h1>
          <p className="mt-2 text-[14px] text-[#6B6F68]">
            This document may have been removed or you don&apos;t have access to it.
          </p>
          <Link
            href="/app/docu"
            className="mt-5 inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87]"
          >
            Back to Documents
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

  // Everything the detail page needs, fetched in PARALLEL (they have no
  // dependency on each other): sibling org documents power the cross-document
  // intelligence (duplicate detection, supplier history, relationships); folders
  // power the folder picker; pp_movements gives the ProcurePulse fed-item count
  // (RLS returns nothing for orgs without the feature); the signed URL is the
  // preview source. Previously these last two ran sequentially after the batch.
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
    // built from this document. Tolerant of the source_document_id column missing.
    supabase.from('of_customers').select('id, name').eq('org_id', doc.org_id).order('name', { ascending: true }),
    supabase.from('of_orders').select('id, status, invoice_number, customer_id').eq('source_document_id', id).maybeSingle(),
    // The org's catalogue for the line-description typeahead. Fetched whole,
    // once, because the filtering is local (see docu/product-suggest.ts) — a
    // few hundred rows is cheaper than a request per keystroke would be.
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
    // The customer an OUTGOING invoice was matched to, with the fields the
    // sheet's "Invoice To" box prints. Only fetched when there is one — an
    // unmatched document prints the name read off the page instead.
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
  // names to match against (never to insert — see product-suggest.ts). An
  // alias that points at no product still earns a row of its own: it is a name
  // the org has ruled on, so it is a name worth offering.
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

  const originalUrl =
    (signedRes as { data: { signedUrl?: string } | null }).data?.signedUrl ?? null;

  // ---- "Send to Hubdoc" (Plugins X2) --------------------------------------
  //
  // The control appears ONLY when it would work: an owner or admin (`canSeeMoney`
  // — pushing a supplier invoice into the company's bookkeeping is finance, not
  // chrome), a live Xero connection, and an intake address set. Anything less and
  // this page says nothing at all about Hubdoc: Plugins → Xero is the screen
  // whose job is explaining how to set it up, and a disabled button here would
  // just be a worse version of that explanation.
  //
  // AFTER the batch above rather than inside it, because two of the three reads
  // are conditional on the first — a member's document page must not pay for
  // three queries about a feature they cannot use.
  //
  // The resolver itself now lives in `lib/platform/hubdoc.ts`: Review v2's
  // document pane offers the same button and must decide it on the same gates,
  // and a route file cannot export a helper for it to import.
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
    // Own scroll container: html/body have overflow-x:hidden (which forces
    // overflow-y:auto on them and breaks position:sticky relative to the
    // viewport). Scrolling here instead keeps one clean page scroll AND lets
    // the preview stick.
    // h-full, not h-screen: <main> is a flex-1 child of the shell's column
    // (app/app/layout.tsx) — full height beside AppRail on desktop, or
    // 100dvh minus the 56px MobileTopBar below `lg`. Hardcoding the viewport
    // height here would overflow that flex box and give the page a second
    // scrollbar.
    <div className="h-full overflow-y-auto px-8 py-7">
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
  );
}
