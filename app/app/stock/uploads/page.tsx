import { redirect } from 'next/navigation';
import { createServerSupabase, getPlatformSession } from '@/lib/platform/supabase-server';
import { computeKpis } from '@/lib/platform/documents';
import { fetchUploadedDocuments } from '@/lib/platform/stock-data';
import { Kpi, KpiStrip, SectionCard } from '@/components/platform/module-ui';
import { UploadDocumentsTable } from '@/components/platform/stock/UploadDocumentsTable';
import { UploadDropZone } from '@/components/platform/stock/UploadDropZone';

/**
 * Uploads — how paperwork gets into Stock & Suppliers, and what has arrived
 * (`.ai/plan_stock_suppliers_page.md`, "Uploads").
 *
 * THE OTHER FIVE TABS ARE DOWNSTREAM OF THIS ONE. Products, prices, suppliers
 * and batches are all built by extraction, so this is the tab that makes the
 * rest of the module true, and it is the destination the shell's global Upload
 * button now points at.
 *
 * NEW SHELL, EXISTING PIPE. The drop zone and the table are new; the upload path
 * underneath them is `lib/platform/docu/upload-client.ts` and the existing
 * `/api/ai/extract`, untouched (the `/api/ingest` unification is a later task).
 * The row's detail page hosts Doc-U's own `DocumentDetailPanel`, so a document
 * uploaded here is reviewed with exactly the same five arms as one uploaded on
 * the Doc-U screen.
 *
 * NO FEATURE GATE. The Stock layout gates on the session alone, deliberately —
 * this module is the merge of two old ones and gating it on `docu` (whose
 * extraction it uses) or `procurepulse` would turn one tab of a live module
 * into a dead end. The queries below are RLS-scoped and degrade to empty.
 */
export default async function StockUploadsPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  const orgId = session.org?.id ?? '';

  const db = await createServerSupabase();
  const docs = await fetchUploadedDocuments(db, orgId, 50);

  // `computeKpis` is Doc-U's own roll-up — reused rather than recounted, so
  // "needs attention" cannot come to mean two different things on two screens.
  //
  // ITS `awaiting` IS SPLIT IN TWO HERE. Doc-U counts extracted + pending as one
  // "awaiting review" number; this tab is asked "is my upload still being read?"
  // more than anything else, and pending and extracted are opposite answers to
  // it — one is the machine's turn, the other is yours. Split rather than
  // added-alongside, so no document is counted in two tiles.
  //
  // Every tile counts the FIFTY ON SCREEN, not the archive, which is what the
  // "of the last 50" sublabel says out loud.
  const kpis = computeKpis(docs);
  const beingRead = docs.filter((d) => d.status === 'pending').length;
  const awaitingReview = kpis.awaiting - beingRead;

  return (
    <div className="space-y-5">
      <KpiStrip>
        <Kpi label="Recent documents" value={String(kpis.total)} sub="The latest 50 uploads" />
        <Kpi
          label="Being read"
          value={String(beingRead)}
          accent={beingRead > 0 ? 'var(--pf-accent-strong)' : undefined}
          sub={beingRead > 0 ? 'Extraction in progress' : 'Nothing in the queue'}
        />
        <Kpi
          label="Awaiting review"
          value={String(awaitingReview)}
          accent={awaitingReview > 0 ? 'var(--tone-warning-fg)' : undefined}
          sub="Read, not yet confirmed"
        />
        <Kpi
          label="Needs attention"
          value={String(kpis.flagged)}
          accent={kpis.flagged > 0 ? 'var(--tone-critical-fg)' : undefined}
          sub={kpis.flagged > 0 ? 'Extraction failed' : 'Nothing failed'}
        />
        <Kpi
          label="Average confidence"
          value={kpis.avgConfidence == null ? '—' : `${kpis.avgConfidence}%`}
          sub={kpis.avgConfidence == null ? 'Nothing scored yet' : 'Across these documents'}
        />
      </KpiStrip>

      <SectionCard title="Add documents">
        <UploadDropZone />
      </SectionCard>

      <UploadDocumentsTable docs={docs} />
    </div>
  );
}
