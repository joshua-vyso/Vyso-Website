'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { FIELD_REVIEW_THRESHOLD } from '@/lib/platform/tokens';
import { ProductSuggestInput } from '@/components/platform/docu/ProductSuggestInput';
import type { ProductOption } from '@/lib/platform/docu/product-suggest';
import { GRID_CELL_FOCUS, gridCell, useGridNavigation } from '@/hooks/useGridNavigation';
import type { DocumentStatus, ExtractedField, ExtractedLineItem } from '@/lib/platform/types';
import type { DocuExtractedData } from '@/lib/platform/docu/types';

function ConfidenceChip({ confidence }: { confidence: number }) {
  const low = confidence < FIELD_REVIEW_THRESHOLD;
  return (
    <span
      className={`of-num inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        low ? 'bg-[#FBEEDA] text-[#854F0B]' : 'bg-[#E1F5EE] text-[#0F6E56]'
      }`}
    >
      {Math.round(confidence)}%{low ? ' · check' : ''}
    </span>
  );
}

const COLS = 'grid grid-cols-[1fr_64px_48px_70px_56px_76px_88px_24px] gap-2 items-center';

/** A legacy extracted field that represents the supplier — superseded by the
 *  dedicated Supplier field above, so it's folded in and hidden from the grid. */
const isSupplierLabel = (label: string): boolean =>
  /supplier|vendor/i.test(label) || label.trim().toLowerCase() === 'from';

export function ExtractionEditor({
  id,
  status,
  fields,
  lineItems,
  extractedData,
  orgUnits = [],
  products = [],
}: {
  id: string;
  status: DocumentStatus;
  fields: ExtractedField[];
  lineItems: ExtractedLineItem[];
  /** The doc's full extracted_data, so saving preserves summary / custom_type. */
  extractedData?: DocuExtractedData | null;
  /** The organisation's measurement units — the unit column is a dropdown of these
   *  (managed in Workspace settings), not free text. */
  orgUnits?: string[];
  /** The org's catalogue (pp_stock_items + confirmed aliases), fetched once by
   *  the page. Feeds the description typeahead; empty is fine — the cell is
   *  then a plain text input, because free text was always allowed here. */
  products?: ProductOption[];
}) {
  const router = useRouter();

  // Options for a line's unit dropdown: the org units, plus the line's current
  // value if it isn't one of them (so an already-extracted unit is never dropped).
  const unitOptions = (current?: string | null): string[] => {
    const cur = (current ?? '').trim();
    if (cur && !orgUnits.some((u) => u.toLowerCase() === cur.toLowerCase())) return [...orgUnits, cur];
    return orgUnits;
  };
  const [draft, setDraft] = useState<ExtractedField[]>(() => fields.map((f) => ({ ...f })));
  const [lines, setLines] = useState<ExtractedLineItem[]>(() => lineItems.map((l) => ({ ...l })));
  // The dedicated supplier field. Falls back to a legacy "Supplier"/"Vendor"/"From"
  // field for documents extracted before supplier capture existed.
  const [supplier, setSupplier] = useState<string>(
    () => extractedData?.supplier ?? fields.find((f) => isSupplierLabel(f.label))?.value ?? '',
  );
  const [busy, setBusy] = useState(false);
  const { gridRef, onKeyDown: onGridKeyDown } = useGridNavigation<HTMLDivElement>();

  const needsReview = useMemo(
    () => draft.filter((f) => f.confidence < FIELD_REVIEW_THRESHOLD).length,
    [draft],
  );
  const lineTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const n = parseFloat((l.amount ?? '').replace(/[^0-9.-]/g, ''));
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [lines],
  );

  const updateValue = (index: number, value: string) =>
    setDraft((prev) => prev.map((f, i) => (i === index ? { ...f, value } : f)));
  const updateLine = (index: number, key: keyof ExtractedLineItem, value: string) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)));
  const patchLine = (index: number, patch: Partial<ExtractedLineItem>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  /** Taking a suggestion fills the catalogue's name and — only when the line has
   *  no unit of its own — its unit. A unit read off the document is never
   *  overwritten: the paper knows what was delivered better than the catalogue. */
  const pickProduct = (index: number, option: ProductOption) => {
    const current = (lines[index]?.unit ?? '').trim();
    patchLine(index, {
      description: option.name,
      ...(option.unit && !current ? { unit: option.unit } : {}),
    });
  };
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));
  /** Append a blank row for a line the extraction missed (or the reviewer wants to add).
   *  confidence: 100 — a human typed it, so it must never read as a low-confidence guess. */
  const addLine = () => {
    const nextIndex = lines.length;
    setLines((prev) => [
      ...prev,
      { description: '', weight: '', quantity: '', unit: '', units_per_box: '', unit_price: '', amount: '', confidence: 100 },
    ]);
    // Land the caret in the new row's description, so adding a line by keyboard
    // (tab to the button, Enter) continues straight into typing it.
    requestAnimationFrame(() => document.getElementById(`line-desc-${nextIndex}`)?.focus());
  };

  const persist = async (nextStatus: Extract<DocumentStatus, 'reviewed' | 'error'>) => {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    if (supabase) {
      await supabase
        .from('documents')
        // Merge so the parsed statement summary + custom type survive a review.
        .update({
          status: nextStatus,
          extracted_data: {
            ...(extractedData ?? {}),
            // The dedicated supplier below is the single source of truth — strip any
            // legacy supplier-labeled field so it can't resurrect a cleared/corrected
            // value via inferSupplierFromDoc's fields[] fallback.
            fields: draft.filter((f) => !isSupplierLabel(f.label)),
            line_items: lines,
            supplier: supplier.trim() || null,
          },
        })
        .eq('id', id);
    }
    // Re-sync the corrected lines into ProcurePulse (idempotent, best-effort).
    // keepalive lets it outlive the navigation below.
    if (nextStatus === 'reviewed') {
      void fetch('/api/procurepulse/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
        keepalive: true,
      }).catch(() => {});
    }
    router.push('/app/docu');
    router.refresh();
  };

  // Same mechanism, same burnt-orange active cell as the order editor — a
  // reviewer who learns the keyboard on one document type should not have to
  // learn it again on the other. See hooks/useGridNavigation.ts.
  const cellCls =
    'h-9 w-full rounded-[10px] border border-[#E4E9F0] bg-white px-2.5 text-[13px] text-[#171A17] outline-none placeholder:text-[#A0A49C] ' +
    GRID_CELL_FOCUS;

  return (
    <div className="flex flex-col rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="border-b border-[#EEF1F5] px-6 py-5">
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Extracted data</h2>
        <p className="mt-1 text-[13px] text-[#6B6F68]">Confirm or correct each field, then save</p>
      </div>

      <div className="px-6 py-5">
        {/* Supplier — the selling party. Extracted from the document header; editable
            here so a missed or mis-read counterparty can be corrected before it feeds
            ProcurePulse's per-product supplier prices. */}
        <div className="mb-5">
          <label htmlFor="doc-supplier" className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">
            Supplier
          </label>
          <input
            id="doc-supplier"
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="e.g. Bacca Valley (Pty) Ltd — or the market agent"
            className="h-11 w-full max-w-md rounded-[12px] border border-[#E4E9F0] bg-white px-4 text-[14px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
          />
        </div>

        {/* Summary fields (legacy docs only — products-only extraction returns no fields).
            The supplier field is hidden here; it's edited via the dedicated input above. */}
        {draft.some((f) => !isSupplierLabel(f.label)) && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {draft.map((field, index) => {
              if (isSupplierLabel(field.label)) return null;
              const low = field.confidence < FIELD_REVIEW_THRESHOLD;
              return (
                <div key={`${field.label}-${index}`} className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor={`field-${index}`} className="truncate text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">
                      {field.label}
                    </label>
                    <ConfidenceChip confidence={field.confidence} />
                  </div>
                  <input
                    id={`field-${index}`}
                    type="text"
                    value={field.value}
                    onChange={(e) => updateValue(index, e.target.value)}
                    className={`h-11 w-full rounded-[12px] border px-4 text-[14px] text-[#171A17] outline-none ${
                      low
                        ? 'border-[#E7B97A] bg-[#FDF6EC] focus:border-[#D9730D]'
                        : 'border-[#E4E9F0] bg-white focus:border-[#3E7BC4]'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Line items. Always drawn — a document the extraction read no lines from
            still needs somewhere to add the ones it missed, which is exactly the
            case where "+ Add line" matters most. */}
        <div className="mt-7">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h3 className="of-display text-[16px] font-semibold text-[#171A17]">
              Line items (<span className="of-num">{lines.length}</span>)
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[#6B6F68]">
                Total{' '}
                <span className="of-num font-semibold text-[#171A17]">
                  {lineTotal.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </span>
              </span>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
              >
                + Add line
              </button>
            </div>
          </div>
          {lines.length > 0 ? (
            <>
              <div className={`${COLS} border-b border-[#EEF1F5] px-1 pb-2 text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]`}>
                <span>Description</span>
                <span>Weight (kg)</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Units/box</span>
                <span>Unit price</span>
                <span>Amount</span>
                <span />
              </div>
              <div className="mt-2 space-y-2" ref={gridRef} onKeyDown={onGridKeyDown}>
                {lines.map((l, i) => (
                  <div key={i} className={COLS}>
                    <ProductSuggestInput
                      id={`line-desc-${i}`}
                      ariaLabel="Description"
                      className={cellCls}
                      options={products}
                      placeholder={products.length > 0 ? 'Start typing a product…' : undefined}
                      value={l.description ?? ''}
                      onChange={(v) => updateLine(i, 'description', v)}
                      onPick={(option) => pickProduct(i, option)}
                      inGrid
                      gridCell={gridCell(i, 0)}
                    />
                    <input className={`${cellCls} of-num`} data-grid-cell={gridCell(i, 1)} value={l.weight ?? ''} onChange={(e) => updateLine(i, 'weight', e.target.value)} />
                    <input className={`${cellCls} of-num text-right`} data-grid-cell={gridCell(i, 2)} value={l.quantity ?? ''} onChange={(e) => updateLine(i, 'quantity', e.target.value)} />
                    <select
                      className={`${cellCls} cursor-pointer pr-1`}
                      value={l.unit ?? ''}
                      data-grid-cell={gridCell(i, 3)}
                      onChange={(e) => updateLine(i, 'unit', e.target.value)}
                      aria-label="Unit"
                    >
                      <option value="">unit</option>
                      {unitOptions(l.unit).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <input className={`${cellCls} of-num text-right`} data-grid-cell={gridCell(i, 4)} value={l.units_per_box ?? ''} onChange={(e) => updateLine(i, 'units_per_box', e.target.value)} />
                    <input className={`${cellCls} of-num text-right`} data-grid-cell={gridCell(i, 5)} value={l.unit_price ?? ''} onChange={(e) => updateLine(i, 'unit_price', e.target.value)} />
                    <input className={`${cellCls} of-num text-right`} data-grid-cell={gridCell(i, 6)} value={l.amount ?? ''} onChange={(e) => updateLine(i, 'amount', e.target.value)} />
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      aria-label="Remove line"
                      className="flex h-9 w-7 items-center justify-center rounded-[10px] text-[#A0A49C] transition-colors hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-[12px] border border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-4 py-6 text-center text-[13px] text-[#8A8E86]">
              No line items were read from this document — use “+ Add line” to enter them.
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 text-[13px]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: needsReview > 0 ? '#D9730D' : '#0F6E56' }}
            aria-hidden
          />
          <span style={{ color: needsReview > 0 ? '#854F0B' : '#0F6E56' }}>
            {needsReview > 0
              ? `${needsReview} ${needsReview === 1 ? 'field needs' : 'fields need'} review`
              : 'All fields confirmed'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-[#EEF1F5] bg-white px-6 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => persist('error')}
          className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#A32D2D]/40 hover:bg-[#FCEBEB] hover:text-[#A32D2D] disabled:opacity-60"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => persist('reviewed')}
          className="inline-flex h-[42px] items-center rounded-[11px] bg-[#1F5FA8] px-[18px] text-[14px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-60"
        >
          {busy ? 'Saving…' : status === 'reviewed' ? 'Save changes' : 'Save & confirm'}
        </button>
      </div>
    </div>
  );
}
