import { NextResponse, after } from 'next/server';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { docWatchForDocument } from '@/lib/platform/doc-watch/run';
import { extractDocument, extractOrderDocument, aiConfigured } from '@/lib/ai/anthropic';
import { feedDocumentToProcurePulse, orgHasProcurePulse } from '@/lib/platform/procurepulse-feed';
import { feedDocumentToSupplySync, orgHasSupplySync } from '@/lib/platform/supplysync-feed';
import { syncOrderFromDocument } from '@/lib/platform/orderflow-from-doc';
// Shared with the chat + inbound-email ingest so supplier resolution behaves
// identically everywhere: alias ruling → suppliers row (race-safe) → SupplySync
// profile, with the org's own name never becoming a supplier.
import { resolveSupplierProfile } from '@/lib/platform/document-ingest';
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

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const mediaType = file.type || (doc.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

  // ORDER documents (uploaded customer orders — WhatsApp/email/handwritten) use a
  // different reader and build an OrderFlow order instead of feeding stock.
  if (doc.document_type === 'order') {
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

  let result;
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

  const documentType = doc.document_type ?? result.document_type;

  // Resolve (or create) the extracted supplier into a suppliers row and link the
  // document, so the inbox, supplier intel and the ProcurePulse feed all see a
  // real counterparty. Best-effort — never block extraction on this.
  let supplierId = doc.supplier_id;
  if (result.supplier) {
    try {
      supplierId = (await resolveSupplierProfile(supabase, doc.org_id, result.supplier)) ?? doc.supplier_id;
    } catch {
      /* keep the existing supplier_id */
    }
  }

  const { error: updateErr } = await supabase
    .from('documents')
    .update({
      status: 'extracted',
      confidence: result.overall_confidence,
      extracted_data: {
        fields: result.fields,
        line_items: result.line_items,
        summary: result.summary,
        supplier: result.supplier,
      },
      document_type: documentType,
      ...(supplierId && supplierId !== doc.supplier_id ? { supplier_id: supplierId } : {}),
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
        extracted_data: {
          fields: result.fields,
          line_items: result.line_items,
          supplier: result.supplier,
        },
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
        extracted_data: { fields: result.fields, line_items: result.line_items, supplier: result.supplier },
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

  return NextResponse.json({ ok: true, result, feed }, { headers: AI_CORS_HEADERS });
}
