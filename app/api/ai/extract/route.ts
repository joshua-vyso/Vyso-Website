import { NextResponse, after } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { docWatchForDocument } from '@/lib/platform/doc-watch/run';
import { extractDocument, aiConfigured } from '@/lib/ai/anthropic';
import { extractOrderDocument } from '@/lib/ai/order-reader';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import { feedDocumentToSupplySync, orgHasSupplySync } from '@/lib/platform/supplysync-feed';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';
// Shared with the chat + inbound-email ingest so supplier resolution behaves
// identically everywhere: alias ruling → suppliers row (race-safe) → SupplySync
// profile, with the org's own name never becoming a supplier.
import { classifyDocumentParties, resolveSupplierProfile } from '@/lib/platform/document-ingest';
import type { DocumentPartiesVerdict } from '@/lib/platform/document-ingest';
import { autoForwardDocumentToHubdoc } from '@/lib/platform/hubdoc';
import { imagePixelSize } from '@/lib/platform/docu/image-size';
import type { Document } from '@/lib/platform/types';

// Multi-page statements with many line items can take a while to parse.
export const maxDuration = 60;

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Parse an uploaded document with Claude and write the structured fields back.
 * Auth via cookie (web) or Bearer token (mobile); RLS scopes all access to the
 * caller's org. Body: { documentId: string }.
 */
export async function POST(req: Request) {
  if (!aiConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }

  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  const { supabase } = auth;

  const body = (await req.json().catch(() => ({}))) as { documentId?: string };
  if (!body.documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', body.documentId)
    .maybeSingle<Document>();
  if (!doc || !doc.storage_path) {
    return NextResponse.json({ error: 'Document not found or has no file' }, { status: 404, headers: AI_CORS_HEADERS });
  }

  const { data: file, error: dlErr } = await supabase.storage.from('documents').download(doc.storage_path);
  if (dlErr || !file) {
    return NextResponse.json({ error: 'Could not download the document' }, { status: 404, headers: AI_CORS_HEADERS });
  }

  // Server-enforced ceiling — the stored object could be larger than any client cap
  // (a direct Storage API PUT bypasses the browser entirely), and we're about to buffer
  // the whole thing into memory and base64 it for the model.
  const MAX_EXTRACT_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_EXTRACT_BYTES) {
    return NextResponse.json({ error: 'That file is too large to process.' }, { status: 413, headers: AI_CORS_HEADERS });
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const base64 = fileBytes.toString('base64');
  const mediaType = file.type || (doc.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  // How much paper the reader is actually getting, recorded before it gets it.
  // Null for PDFs and for anything whose header we cannot read — see
  // lib/platform/docu/image-size.ts for why this is worth knowing at all.
  const imagePixels = imagePixelSize(fileBytes);

  // WHICH READER? An ORDER is read by `extractOrderDocument` and NOTHING ELSE
  // in this file gives it what the review screen needs — the total-first row
  // arithmetic, the `extraction_model` stamp and `customer_name` all live in
  // that branch and only there.
  //
  // THE GATE USED TO BE `doc.document_type === 'order'` ALONE, AND THAT IS THE
  // BUG THIS EXISTS TO FIX. Only two surfaces pre-type the row: the OrderFlow
  // drop (`/api/ai/agent/ingest-document`, which classifies first) and a manual
  // TypePicker change. The chat/Doc-U drop and the upload page both file rows
  // UNTYPED — `uploadDocument` inserts no `document_type` at all, because on
  // every other surface the classifier is what decides it. So a customer order
  // dropped into the chat fell straight through to `extractDocument`, the
  // INVOICE reader, which:
  //
  //   • never runs `applyRowArithmetic`, so "Avocado 4 @ 15.75 = R63" was never
  //     rescued to the 48 × 15.75 = 756.00 the paper itself prints;
  //   • never writes `extraction_model`, so the review screen's "Read by …"
  //     line had nothing to render and silently vanished;
  //   • never writes `customer_name`, so the screen said "No customer name was
  //     read" about a page with "Purchaser: Bakubung Bush Lodge" printed on it.
  //
  // Three symptoms, one cause. So when the row arrives untyped we CLASSIFY
  // FIRST — exactly as `ingestDocument` has always done for the drop path — and
  // route on the answer. A pre-typed row skips this and costs nothing extra; an
  // untyped NON-order reuses the very same classification result below rather
  // than paying for a second read. Only an untyped ORDER costs two calls, which
  // is the correct price for reading it with the right reader.
  let generic: Awaited<ReturnType<typeof extractDocument>> | null = null;
  let documentType = doc.document_type;
  if (!documentType) {
    try {
      generic = await extractDocument({ base64, mediaType, filename: doc.filename });
    } catch (err) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Extraction failed' },
        { status: 500, headers: AI_CORS_HEADERS },
      );
    }
    documentType = generic.document_type;
  }

  // ORDER documents (uploaded customer orders — WhatsApp/email/handwritten) use a
  // different reader and build an OrderFlow order instead of feeding stock.
  if (documentType === 'order') {
    // Give the order reader the org's catalogue so it resolves abbreviations and
    // varieties ("broc" → "Broccoli", "green apple" → "Apples Granny Smith") to the
    // exact product name — which the pricing match then prices.
    const { data: catalogueRows } = await supabase
      .from('pp_stock_items')
      .select('name')
      .eq('org_id', doc.org_id)
      .order('name', { ascending: true });
    const products = ((catalogueRows ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean);

    let order;
    try {
      order = await extractOrderDocument({ base64, mediaType, filename: doc.filename, products });
    } catch (err) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Extraction failed' },
        { status: 500, headers: AI_CORS_HEADERS },
      );
    }

    // A model/JSON failure reads as empty — surface it (error + retry in the inbox)
    // rather than silently filing a blank order. Mirrors the non-order path.
    if (!order.customer_name && order.line_items.length === 0) {
      await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
      return NextResponse.json(
        { error: 'Could not read an order from this document.' },
        { status: 422, headers: AI_CORS_HEADERS },
      );
    }

    const { error: updErr } = await supabase
      .from('documents')
      .update({
        status: 'extracted',
        confidence: order.overall_confidence,
        document_type: 'order',
        extracted_data: {
          fields: [],
          line_items: order.line_items,
          customer_name: order.customer_name,
          customer_confidence: order.customer_confidence,
          // Which model read it. One string, written once, so this never again
          // has to be inferred from the shape of the mistakes it made — and with
          // two providers in play, which PROVIDER served it too.
          extraction_model: order.model,
          // Set only when the read did not go the way it was configured to (an
          // OpenAI failure that fell back to Claude). A fallback nobody is told
          // about is a document read by a model nobody chose.
          extraction_warning: order.warning ?? null,
          // The size of the photo this was read from — the innocent
          // explanation for a misread digit, and the `low_resolution` flag.
          image_pixels: imagePixels,
        },
      })
      .eq('id', doc.id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500, headers: AI_CORS_HEADERS });
    }

    // Build the OrderFlow order — auto-invoices when the customer is confidently
    // matched, else holds as a draft for review (best-effort; never fail extraction).
    let orderSync = null;
    try {
      orderSync = await syncOrderFromDocument(supabase, { documentId: doc.id, orgId: doc.org_id });
    } catch {
      /* swallow — extraction already succeeded */
    }
    return NextResponse.json({ ok: true, order, orderSync }, { headers: AI_CORS_HEADERS });
  }

  // Already read, if this row arrived untyped: the classification above IS the
  // extraction for everything that is not an order, and reading the same file
  // twice would double the bill to learn nothing.
  let result = generic;
  if (!result) {
    try {
      result = await extractDocument({ base64, mediaType, filename: doc.filename });
    } catch (err) {
      // Don't leave the document stuck on "pending" — mark it errored so the
      // inbox shows a failure the user can retry rather than an endless spinner.
      await supabase.from('documents').update({ status: 'error' }).eq('id', doc.id);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Extraction failed' },
        { status: 500, headers: AI_CORS_HEADERS },
      );
    }
  }

  documentType = documentType ?? result.document_type;

  // WHICH WAY DOES THIS DOCUMENT POINT? An invoice on the ORG'S OWN letterhead
  // is one the org ISSUED — "Invoice To: Investec Bank Limited" on Turn 'n Slice
  // paper — and it has no supplier at all. Deciding this BEFORE supplier
  // resolution is the point: it is what stops the org being created as its own
  // vendor. Best-effort; a failure leaves the direction unknown and everything
  // below behaves exactly as it did before. See lib/platform/docu/document-direction.ts.
  let parties: DocumentPartiesVerdict = {
    direction: 'unknown',
    supplierName: result.supplier,
    customerId: null,
    record: null,
  };
  try {
    parties = await classifyDocumentParties(supabase, doc.org_id, {
      supplier: result.supplier,
      supplierVat: result.supplier_vat,
      billTo: result.bill_to,
    });
  } catch {
    /* unknown direction — carry on exactly as before */
  }

  // Resolve (or create) the extracted supplier into a suppliers row and link the
  // document, so the inbox, supplier intel and the ProcurePulse feed all see a
  // real counterparty. Best-effort — never block extraction on this.
  let supplierId = doc.supplier_id;
  if (parties.supplierName) {
    try {
      supplierId = (await resolveSupplierProfile(supabase, doc.org_id, parties.supplierName)) ?? doc.supplier_id;
    } catch {
      /* keep the existing supplier_id */
    }
  } else if (parties.direction === 'outgoing') {
    // The org issued it: drop any supplier this document was previously (wrongly)
    // linked to. Leaving a stale link is how a re-extraction would keep the bug.
    supplierId = null;
  }

  const extractedData = {
    fields: result.fields,
    line_items: result.line_items,
    summary: result.summary,
    // NULL on an outgoing document — the issuer is the org, and the detail panel
    // falls back to this string whenever there is no linked supplier row.
    supplier: parties.supplierName,
    bill_to: result.bill_to,
    // Arithmetic audit of the lines (null when they add up). Drives the
    // review-queue warning and the Doc-U flags — see lib/platform/docu/line-audit.ts.
    line_audit: result.line_audit,
    // Only set when the org issued it — lib/platform/docu/document-direction.ts.
    direction: parties.record,
    // Written on every document, not just orders: an invoice photographed too
    // small misreads exactly the same way an order does.
    image_pixels: imagePixels,
  };

  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      status: 'extracted',
      confidence: result.overall_confidence,
      extracted_data: extractedData,
      document_type: documentType,
      ...(supplierId !== doc.supplier_id ? { supplier_id: supplierId } : {}),
      // Written even when null: an outgoing document whose customer we could not
      // recognise must CLEAR any stale linkage, not inherit one.
      ...(parties.direction === 'outgoing' ? { customer_id: parties.customerId } : {}),
    })
    .eq('id', doc.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500, headers: AI_CORS_HEADERS });
  }

  // Auto-feed the extracted lines into ProcurePulse (best-effort — a feed
  // failure must never fail extraction). Gated on the org having the feature.
  let feed = null;
  try {
    if (await orgHasProcurePulse(supabase, doc.org_id)) {
      feed = await feedDocumentToProcurePulse(supabase, {
        id: doc.id,
        org_id: doc.org_id,
        filename: doc.filename,
        document_type: documentType,
        supplier_id: supplierId,
        // `direction` rides along so the feed can refuse an outgoing document's
        // lines — they are goods that LEFT the business, not stock received.
        extracted_data: extractedData,
      });
    }
  } catch {
    /* swallow — extraction already succeeded */
  }

  // Feed SupplySync too (profile timeline + spend rollups), so a manually scanned
  // invoice reaches the supplier's SupplySync profile exactly like the chat/email
  // paths. Best-effort — intelligence must never fail extraction.
  try {
    if (supplierId && (await orgHasSupplySync(supabase, doc.org_id))) {
      await feedDocumentToSupplySync(supabase, {
        id: doc.id,
        org_id: doc.org_id,
        document_type: documentType,
        filename: doc.filename,
        supplier_id: supplierId,
        extracted_data: extractedData,
        created_at: doc.created_at,
      });
    }
  } catch {
    /* swallow — extraction already succeeded */
  }

  // Doc Watch's IMMEDIATE trigger (.ai/plan_agents_phase_c.md, C3): the moment
  // a document is read, a small informational card goes onto the Brief saying
  // what was in it — "Invoice INV-9268 from Winelands Protein Co. read this
  // morning — R 447 856. Biggest lines: …".
  //
  // Inside Next's `after()` (node_modules/next/dist/docs/01-app/03-api-reference/
  // 04-functions/after.md) rather than awaited inline, for two reasons. First,
  // extraction has ALREADY succeeded by this point: the document row is updated
  // and the response below is the user's answer, so nothing about writing a
  // receipt card should be allowed to delay it — and on Vercel the callback runs
  // under `waitUntil`, which keeps the invocation alive until it settles rather
  // than killing it mid-write. Second, `after` runs even when the response did
  // not complete successfully, which is exactly the tolerance a best-effort
  // side-effect wants.
  //
  // The write goes through the CALLER'S RLS-scoped client, not the service role:
  // this is a signed-in request with a session to scope, so it has no excuse to
  // reach for the cron's key. `docWatchForDocument` still filters org_id itself.
  //
  // Failure is logged and nothing else. It is idempotent on
  // `doc_watch:<document_id>`, and the nightly sweep (/api/agents/doc-watch)
  // picks up anything this misses — including the case where a cold instance is
  // reclaimed before the callback finishes. A user who scanned an invoice must
  // never see an error because a card did not get written.
  after(async () => {
    try {
      await docWatchForDocument(supabase, doc.org_id, doc.id);
    } catch (err) {
      console.error('doc-watch: immediate card failed', doc.id, err);
    }
  });

  // The Hubdoc standing instruction (plan `.ai/plan_plugins_xero.md`, X2 "Auto
  // mode"): if — and only if — this org's owner has switched auto-forward on,
  // the supplier invoice that was just read goes to their Hubdoc inbox.
  //
  // OFF FOR EVERY ORG UNTIL SOMEBODY TURNS IT ON. `autoForwardDocumentToHubdoc`
  // reads `org_integrations_hubdoc.auto_forward` (default false) as its FIRST
  // act and returns without touching the document, sending anything or writing a
  // log row when it is off. That is why this line is safe to run on every
  // extraction in the product: for almost every org it is one small select and
  // nothing else.
  //
  // A SEPARATE `after()` FROM DOC WATCH'S, on purpose. They are independent
  // best-effort side-effects and one must not be able to cancel the other: a
  // Hubdoc send that throws would otherwise take the Brief card with it, and the
  // Brief card is the thing the user can actually see.
  //
  // INSIDE `after()` FOR THE SAME REASONS DOC WATCH IS (node_modules/next/dist/
  // docs/01-app/03-api-reference/04-functions/after.md): extraction has already
  // succeeded, the response below is the user's answer, and a Storage download
  // plus an SMTP round-trip has no business delaying it. On Vercel the callback
  // runs under `waitUntil`.
  //
  // NOT the caller's RLS client. Any member may upload and extract a document,
  // and `hubdoc_forwards` is service-role-write — see the header of
  // lib/platform/hubdoc.ts for why gating a standing instruction on the
  // uploader's role would be wrong.
  after(async () => {
    try {
      const result = await autoForwardDocumentToHubdoc(doc.org_id, doc.id);
      // A refusal is normal (wrong document type, no supplier, already sent) and
      // is already recorded where it matters. Only a genuine failure is logged.
      if (!result.ok && !result.skipped) {
        console.error('hubdoc: auto-forward did not send', doc.id, result.error);
      }
    } catch (err) {
      console.error('hubdoc: auto-forward failed', doc.id, err);
    }
  });

  return NextResponse.json({ ok: true, result, feed }, { headers: AI_CORS_HEADERS });
}
