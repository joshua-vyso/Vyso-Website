'use client';

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The preview-then-print shell around a regenerated A4 sheet.
 *
 * PREVIEW BEFORE PRINT, ALWAYS. Everything drawn inside this overlay is a
 * RECONSTRUCTION — assembled from extracted data or from a form the reviewer is
 * still editing, never a copy of the scan. So the sheet goes on screen first,
 * exactly as it will come out, and `window.print()` is a second, deliberate
 * click. `ad4b49c` established that rule for Doc-U's regenerated tax invoice;
 * this is that same shell, lifted out so the order review editor prints through
 * it rather than through a second copy of the print CSS. Two print paths that
 * drifted apart on the CSS would paginate differently for no reason a reader
 * could ever discover.
 *
 * WHY A PORTAL. The document detail page scrolls inside its own
 * `overflow-y-auto` container, and an absolutely-positioned print sheet nested
 * in a scroll container gets clipped to one viewport height when it paginates.
 * As a direct child of <body> it has no such ancestor. (It is also how every
 * other modal in the app is drawn.)
 */
export function PrintSheetOverlay({
  open,
  onClose,
  title,
  subtitle,
  notes,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Heading of the chrome bar above the sheet. */
  title: string;
  /** One line under it — what this sheet is, and what it is not. */
  subtitle: string;
  /** Optional nudges (missing fields, applied defaults). Never a block. */
  notes?: ReactNode;
  /** The sheet itself — `InvoiceSheetClassic`, carrying its own print scoping. */
  children: ReactNode;
}) {
  // Esc closes the preview — the print dialog is the only modal that should
  // need a deliberate dismissal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // No `mounted` guard: callers start closed and can only open on a click, so
  // this is never reached during server rendering or hydration.
  if (!open) return null;

  return createPortal(
    <div
      id="docu-print-shell"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#171A17]/45 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Print CSS: the sheet's own rules hide everything but #of-doc-print,
          which positions against its nearest positioned ancestor — this overlay.
          Left fixed, that anchors the sheet to the viewport and breaks
          pagination, so for print the overlay becomes an ordinary block at the
          top of the page and its own chrome disappears. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print {
  #docu-print-shell { position: static !important; overflow: visible !important; background: none !important; padding: 0 !important; z-index: auto !important; }
  #docu-print-shell .docu-print-chrome { display: none !important; }
}`,
        }}
      />

      <div className="mx-auto max-w-[860px]">
        <div className="docu-print-chrome mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-5 py-4 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.35)]">
          <div className="min-w-0">
            <h2 className="of-display text-[15px] font-semibold text-[#171A17]">{title}</h2>
            <p className="mt-0.5 text-[12px] text-[#6B6F68]">{subtitle}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-lg border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              title="Opens your print dialog — choose a printer, or Save as PDF"
              className="inline-flex h-9 items-center rounded-lg bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]"
            >
              Print / PDF
            </button>
          </div>
        </div>

        {/* Nudges, never blocks: the sheet renders with whatever exists. */}
        {notes ? (
          <div className="docu-print-chrome mb-4 space-y-1 rounded-2xl bg-white px-5 py-4 text-[12px] text-[#6B6F68] shadow-[0_18px_50px_-8px_rgba(26,28,30,0.35)]">
            {notes}
          </div>
        ) : null}

        {children}
      </div>
    </div>,
    document.body,
  );
}
