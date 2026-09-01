'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/platform/module-ui';
import { ConfidenceText, StatusPill } from '@/components/platform/ui';
import { DOC_TYPE_LABEL } from '@/lib/platform/documents';
import type { StockDocument } from '@/lib/platform/stock-data';

/**
 * The Uploads tab's document list — the latest fifty, of every type
 * (`.ai/plan_stock_suppliers_page.md`, "Uploads").
 *
 * ITS JOB IS "WHERE DID MY FILE GO". Everything else about a document — what
 * was read off it, which supplier it was matched to, whether the totals add up
 * — belongs to the review page one click away, so this table carries only the
 * four facts that answer that question: name, kind, how the reading went, and
 * when. `StatusPill` and `ConfidenceText` are Doc-U's, unchanged, because a
 * document's status must not mean one thing on one screen and another here.
 *
 * A CLIENT COMPONENT FOR THE SEARCH BOX ONLY. Fifty rows are already in the RSC
 * payload; filtering them in the browser costs nothing and a server search would
 * re-fetch on every keystroke (the same reasoning as `StockLevelsTable`).
 *
 * REFRESH IS A BUTTON, NOT A SUBSCRIPTION. Extraction is fired and abandoned
 * (`startExtraction`), so a row uploaded seconds ago is `pending` until the
 * server finishes. Doc-U's inbox subscribes to `documents` and polls for this;
 * duplicating that here would put a second realtime channel on a screen whose
 * main event — an upload — already refreshes the page itself. The button is for
 * the minute after that, and it says what it does.
 */

const COLUMNS: Column[] = [
  { label: 'Document' },
  { label: 'Type' },
  { label: 'Status' },
  { label: 'Confidence', align: 'right' },
  { label: 'Uploaded', align: 'right' },
];

function typeLabel(t: StockDocument['document_type']): string {
  if (!t) return 'Not read yet';
  return DOC_TYPE_LABEL[t] ?? t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function UploadDocumentsTable({ docs }: { docs: StockDocument[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.filename.toLowerCase().includes(q) ||
        typeLabel(d.document_type).toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q),
    );
  }, [docs, search]);

  const rows = filtered.map((d) => [
    <Link
      key="f"
      href={`/app/stock/uploads/${d.id}`}
      className="block truncate text-[var(--pf-text)] transition-colors hover:text-[var(--pf-accent-strong)] hover:underline"
      title={d.filename}
    >
      {d.filename}
    </Link>,
    typeLabel(d.document_type),
    <StatusPill key="s" status={d.status} />,
    <ConfidenceText key="c" value={d.confidence} />,
    fmtDate(d.created_at),
  ]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="h-[38px] min-w-[240px] flex-1 rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-3 text-[14px] text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-text-faint)] focus:border-[var(--pf-accent)]"
        />
        <span className="text-[13px] text-[var(--pf-text-muted)]">
          {filtered.length} of {docs.length}
        </span>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="ml-auto h-[38px] rounded-[var(--pf-radius-control)] border border-[var(--pf-border-strong)] bg-white px-4 text-[13px] font-medium text-[var(--pf-text-control)] transition-colors hover:border-[var(--pf-accent-ring)]"
        >
          Refresh
        </button>
      </div>

      <DataTable
        columns={COLUMNS}
        rows={rows}
        empty={
          docs.length === 0
            ? 'Nothing uploaded yet — drop your first supplier paperwork above.'
            : 'Nothing matches that search.'
        }
      />
    </div>
  );
}
