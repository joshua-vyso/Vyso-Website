/**
 * Read-only Doc-U data access for Finch's tools. Every query runs through the
 * caller's RLS-scoped Supabase client, and the derivations reuse the same
 * helpers the Doc-U UI itself uses (docTotal, deriveFlags) so the agent's
 * numbers and flags never drift from what the user sees on the document.
 * Never returns raw file content or a storage_path — a document id is the only
 * handle the model gets back.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeLike } from '@/lib/platform/supplysync-feed';
import { docTotal } from '@/lib/platform/docu/extract';
import { deriveFlags } from '@/lib/platform/docu/flags';
import { zar2 } from '@/lib/platform/orderflow';
import type { Document, DocumentType, DocumentStatus, DocumentWithSupplier } from '@/lib/platform/types';
import type { AiSummary } from '@/lib/platform/docu/types';

/**
 * Unwrap a Supabase result, throwing (with the table label) on a query error so
 * the tool surfaces WHY it failed instead of silently returning an empty list.
 */
function must<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`Could not read ${label}: ${res.error.message}`);
  return (res.data ?? ([] as unknown as T)) as T;
}

const DOC_TYPES: readonly DocumentType[] = ['invoice', 'statement', 'delivery_note', 'price_list', 'order'];
const DOC_STATUSES: readonly DocumentStatus[] = [
  'pending',
  'extracted',
  'reviewed',
  'error',
  'approved',
  'rejected',
  'archived',
];

// ---------------------------------------------------------------------------
// find_documents
// ---------------------------------------------------------------------------

export interface FindDocumentsFilters {
  supplier?: string;
  documentType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

type FindDocRow = Pick<Document, 'id' | 'filename' | 'document_type' | 'status' | 'confidence' | 'created_at' | 'extracted_data'> & {
  supplier: { id: string; name: string } | null;
};

const FIND_COLS = 'id, filename, document_type, status, confidence, created_at, extracted_data, supplier:suppliers(id,name)';

/** ISO date bound: a bare YYYY-MM-DD gets the day's start/end appended so a
 *  date-only filter is inclusive of the whole day. */
function dayBound(raw: string, end: boolean): string {
  return raw.length === 10 ? `${raw}T${end ? '23:59:59.999' : '00:00:00'}` : raw;
}

/**
 * Find documents by supplier name (resolved against the suppliers table),
 * document type, status and/or upload date range. Returns a compact row set —
 * never the extracted payload or storage path.
 */
export async function findDocuments(
  supabase: SupabaseClient,
  orgId: string,
  filters: FindDocumentsFilters,
  limit: number,
): Promise<Array<Record<string, string | number>>> {
  let query = supabase.from('documents').select(FIND_COLS).eq('org_id', orgId);

  const supplierQuery = (filters.supplier ?? '').trim();
  if (supplierQuery) {
    const suppliers = must<Array<{ id: string }>>(
      await supabase
        .from('suppliers')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', `%${escapeLike(supplierQuery)}%`),
      'suppliers',
    );
    // No supplier matches that name — nothing can match, so skip the documents
    // query entirely rather than running an unfiltered one.
    if (suppliers.length === 0) return [];
    query = query.in('supplier_id', suppliers.map((s) => s.id));
  }

  const documentType = (filters.documentType ?? '').trim();
  if (documentType && (DOC_TYPES as readonly string[]).includes(documentType)) {
    query = query.eq('document_type', documentType);
  }
  const status = (filters.status ?? '').trim();
  if (status && (DOC_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status);
  }
  const dateFrom = (filters.dateFrom ?? '').trim();
  if (dateFrom) query = query.gte('created_at', dayBound(dateFrom, false));
  const dateTo = (filters.dateTo ?? '').trim();
  if (dateTo) query = query.lte('created_at', dayBound(dateTo, true));

  // The embedded `supplier:suppliers(...)` relation makes Supabase infer an
  // array (it can't statically see it's to-one from the select string alone),
  // so this one goes through the same widened cast the Doc-U pages use rather
  // than the strict must<T> helper — see app/app/docu/page.tsx's DOC_HUB_COLS.
  const res = await query.order('created_at', { ascending: false }).limit(limit);
  if (res.error) throw new Error(`Could not read documents: ${res.error.message}`);
  const docs = (res.data ?? []) as unknown as FindDocRow[];

  return docs.map((d) => {
    const total = docTotal(d);
    return {
      id: d.id,
      filename: d.filename,
      type: d.document_type ?? 'unknown',
      supplier: d.supplier?.name ?? 'Unmatched',
      date: (d.created_at ?? '').slice(0, 10),
      confidence: d.confidence ?? '—',
      status: d.status,
      ...(total != null ? { total: zar2(total) } : {}),
    };
  });
}

// ---------------------------------------------------------------------------
// document_summary
// ---------------------------------------------------------------------------

const SUMMARY_COLS =
  'id, filename, document_type, status, confidence, created_at, extracted_data, ai_summary, supplier_id, supplier:suppliers(id,name,initials)';

interface Peer {
  id: string;
  supplier_id: string | null;
  extracted_data: Document['extracted_data'];
}

/**
 * One document's extracted fields, line-item count, flags and AI summary (if
 * any) — looked up by id (usually taken from a find_documents result). Never
 * returns extracted_data.line_items in full, raw file bytes or storage_path.
 */
export async function documentSummary(
  supabase: SupabaseClient,
  orgId: string,
  id: string,
): Promise<Record<string, unknown>> {
  const docId = (id ?? '').trim();
  if (!docId) return { found: false, message: 'Give me a document id — usually from a find_documents result.' };

  const { data, error } = await supabase
    .from('documents')
    .select(SUMMARY_COLS)
    .eq('org_id', orgId)
    .eq('id', docId)
    .maybeSingle();
  if (error) throw new Error(`Could not read document: ${error.message}`);
  if (!data) return { found: false, message: `No document found with id "${docId}".` };
  const doc = data as unknown as DocumentWithSupplier;

  // Cheap duplicate-invoice check: only this document's own supplier's other
  // documents (bounded), not a full-org scan like the detail page does.
  let peers: DocumentWithSupplier[] = [];
  if (doc.supplier_id) {
    const peerRows = must<Peer[]>(
      await supabase
        .from('documents')
        .select('id, supplier_id, extracted_data')
        .eq('org_id', orgId)
        .eq('supplier_id', doc.supplier_id)
        .neq('id', doc.id)
        .limit(30),
      'related documents',
    );
    peers = peerRows as unknown as DocumentWithSupplier[];
  }
  const flags = deriveFlags(doc, peers);

  const fields = (doc.extracted_data?.fields ?? []).map((f) => ({
    label: f.label,
    value: f.value,
    confidence: f.confidence,
  }));
  const lineItemCount = doc.extracted_data?.line_items?.length ?? 0;
  const total = docTotal(doc);
  const summary = doc.ai_summary as AiSummary | null;

  return {
    found: true,
    id: doc.id,
    filename: doc.filename,
    type: doc.document_type ?? 'unknown',
    supplier: doc.supplier?.name ?? 'Unmatched',
    status: doc.status,
    date: (doc.created_at ?? '').slice(0, 10),
    confidence: doc.confidence,
    ...(total != null ? { total: zar2(total) } : {}),
    line_item_count: lineItemCount,
    fields,
    flags: flags.map((f) => ({ kind: f.kind, severity: f.severity, label: f.label, detail: f.detail })),
    ...(summary?.text ? { ai_summary: summary.text } : {}),
  };
}
