import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPlatformSession, createServerSupabase } from '@/lib/platform/supabase-server';
import { DocumentDetailPanel } from '@/components/platform/docu/DocumentDetailPanel';
import { allUnits } from '@/lib/platform/procurepulse/units';
import { canSeeMoney } from '@/lib/platform/access';
import { xeroConnectionStatus } from '@/lib/platform/plugins-data';
import { xeroStatusTone } from '@/lib/platform/plugins';
import { hubdocSentDocumentIds, loadHubdocSettings } from '@/lib/platform/hubdoc';
import { hubdocEligibility } from '@/lib/platform/hubdoc-shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HubdocDocumentState } from '@/components/platform/docu/SendToHubdoc';
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
  const hubdoc = await hubdocForDocument(supabase, doc.org_id, doc.id, {
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
        customers={customers}
        linkedOrder={linkedOrder}
        originalUrl={originalUrl}
        isImage={isImage}
        hubdoc={hubdoc}
      />
    </div>
  );
}

/**
 * Resolve the Hubdoc control's state for one document, or null to draw nothing.
 *
 * THREE GATES BEFORE ANY READ HAPPENS, cheapest first: the caller's role, then
 * the org's Xero connection, then its Hubdoc address. Each one short-circuits,
 * so a member opening a document page pays for nothing and an org that has never
 * heard of Hubdoc pays for one small select.
 *
 * A DEGRADED XERO CONNECTION STILL COUNTS AS CONNECTED HERE, deliberately.
 * `xeroStatusTone` folds `error`/`reauth_required` into "needs attention" — the
 * ledger cannot be read, but Hubdoc is a different system on a different
 * transport, and hiding the way to file a bill because a token expired would
 * punish the owner for the outage rather than help them through it. Only "not
 * connected at all" removes the control, because Hubdoc without Xero is a
 * cross-upload to nowhere the plugin can see.
 *
 * SOFT ON EVERYTHING. Every read below already degrades to "not set up", and
 * this whole feature is one button on a page whose job is reviewing a document.
 */
async function hubdocForDocument(
  supabase: SupabaseClient,
  orgId: string,
  documentId: string,
  facts: {
    documentType: string | null;
    status: string | null;
    supplierId: string | null;
    storagePath: string | null;
    canSend: boolean;
  },
): Promise<HubdocDocumentState | null> {
  if (!facts.canSend) return null;

  const tone = xeroStatusTone(await xeroConnectionStatus(orgId));
  if (tone === 'idle') return null;

  const settings = await loadHubdocSettings(supabase, orgId);
  if (!settings.intakeEmail) return null;

  const eligibility = hubdocEligibility({
    documentType: facts.documentType,
    status: facts.status,
    supplierId: facts.supplierId,
    storagePath: facts.storagePath,
  });
  if (!eligibility.ok) return { alreadySent: false, reason: eligibility.reason };

  const sent = await hubdocSentDocumentIds(supabase, orgId, [documentId]);
  return { alreadySent: sent.has(documentId), reason: null };
}
