'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { InvoiceSheetClassic, type ClassicInvoiceParty } from '@/components/platform/orderflow/InvoiceSheetClassic';
import { EMPTY_COMPANY_PROFILE, type CdCompanyProfile } from '@/lib/platform/coredata';
import { canPrintTaxInvoice, mapExtractionToSheet } from '@/lib/platform/docu/invoice-from-extraction';
import { isOutgoingDocument } from '@/lib/platform/docu/document-direction';
import type { DocuExtractedData } from '@/lib/platform/docu/types';
import type { DocumentType } from '@/lib/platform/types';

/** Everything the sheet needs that does NOT come off the scan. */
export interface TaxInvoicePrintContext {
  /** `cd_company_profile` — the org's identity, banking and logo. */
  companyProfile: CdCompanyProfile | null;
  orgName: string | null;
  /** `of_settings.default_vat_rate`, used only when the scan printed no VAT. */
  defaultVatRate: number;
  /** The `of_customers` row this outgoing invoice was matched to, if any. */
  customer: ClassicInvoiceParty | null;
}

/**
 * "Print invoice" — the org's OWN tax invoice, regenerated from the extracted
 * data, instead of the photograph of the paper.
 *
 * WHY NOT THE ORIGINAL. Doc-U's existing print opens the signed file: a phone
 * snap of a creased A4, shot at an angle. For an invoice the org ISSUED and
 * later scanned back in, that is the worst copy of a document it already holds
 * the numbers for. So this renders `InvoiceSheetClassic` — the same A4 sheet
 * OrderFlow prints, not a fork of it — from `extracted_data`, and prints that.
 * "Print original" stays, one button along, for when the paper itself is the
 * point.
 *
 * WHO IS THE SELLER depends on which way the document points, and getting it
 * wrong would be a forgery either way round:
 *   - OUTGOING (the org issued it): seller = the org, billed = the matched
 *     customer, or the name read off the page when nothing matched.
 *   - INCOMING (a supplier issued it): seller = the SUPPLIER — with no bank
 *     details and no org logo, because a clean copy of somebody else's invoice
 *     must never invite payment into the org's account — and billed = the org.
 *
 * PREVIEW BEFORE PRINT, always. This sheet is a RECONSTRUCTION, not a scan, so
 * the reviewer sees exactly what will come out before the dialog opens.
 * `window.print()` then prints the sheet alone: `InvoiceSheetClassic` carries
 * the `#of-doc-print` scoping, and the overlay below un-fixes itself for print
 * so the sheet paginates from the top of the page.
 */
export function PrintTaxInvoice({
  documentType,
  extracted,
  supplierName,
  context,
}: {
  documentType: DocumentType | null;
  extracted: DocuExtractedData | null;
  /** The linked supplier row's name, or the string the extractor read. */
  supplierName: string | null;
  context: TaxInvoicePrintContext;
}) {
  // No `mounted` guard: `open` starts false and can only be flipped by a click,
  // so the portal below is never reached during server rendering or hydration.
  const [open, setOpen] = useState(false);

  // Esc closes the preview — the print dialog is the only modal that should
  // need a deliberate dismissal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const outgoing = isOutgoingDocument(extracted);
  const { companyProfile, orgName, defaultVatRate, customer } = context;

  const sheet = useMemo(
    () =>
      mapExtractionToSheet({
        fields: extracted?.fields,
        lineItems: extracted?.line_items,
        direction: extracted?.direction,
        billTo: extracted?.bill_to,
        supplierName,
        defaultVatRate,
        // The org's own footer and terms belong on the org's own invoice only.
        note: outgoing ? companyProfile?.invoice_footer : null,
        termsText: outgoing ? companyProfile?.terms : null,
      }),
    [extracted, supplierName, defaultVatRate, outgoing, companyProfile],
  );

  if (!canPrintTaxInvoice(documentType, sheet)) return null;

  const sellerName = sheet.issuerName ?? supplierName ?? 'Supplier';
  // Incoming: a minimal profile for the supplier — their name and, if the scan
  // printed one, their VAT registration. Every other field stays empty, so no
  // bank block and no logo can appear on somebody else's invoice.
  const seller: CdCompanyProfile | null = outgoing
    ? companyProfile
    : { ...EMPTY_COMPANY_PROFILE, company_name: sellerName, vat_number: sheet.issuerVat };

  const orgAsParty: ClassicInvoiceParty = {
    name: companyProfile?.company_name || orgName || 'Your business',
    vat_number: companyProfile?.vat_number ?? null,
    billing_address: companyProfile?.address ?? null,
  };
  const billed: ClassicInvoiceParty | null = outgoing
    ? customer ?? (sheet.billToName ? { name: sheet.billToName } : null)
    : orgAsParty;

  const sellerMissing = outgoing && !companyProfile?.company_name;
  const gaps = [
    sheet.missing.includes('number') ? 'invoice number' : null,
    sheet.missing.includes('date') ? 'invoice date' : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Builds a clean tax invoice from the extracted data — then print it or save it as PDF"
        className="inline-flex h-[38px] shrink-0 items-center rounded-full bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]"
      >
        Print invoice
      </button>

      {/* Portalled to <body>: the detail page scrolls inside its own
          `overflow-y-auto` container, and an absolutely-positioned print sheet
          nested inside a scroll container gets clipped to one viewport height
          when it paginates. As a direct child of <body> it has no such
          ancestor. (It is also how every other modal in the app is drawn.) */}
      {open
        ? createPortal(
            <div
              id="docu-print-shell"
              className="fixed inset-0 z-50 overflow-y-auto bg-[#171A17]/45 px-4 py-8"
              role="dialog"
              aria-modal="true"
              aria-label="Tax invoice preview"
            >
              {/* Print CSS: the sheet's own rules hide everything but
                  #of-doc-print, which positions against its nearest positioned
                  ancestor — this overlay. Left fixed, that anchors the sheet to
                  the viewport and breaks pagination, so for print the overlay
                  becomes an ordinary block at the top of the page and its own
                  chrome disappears. */}
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
                    <h2 className="of-display text-[15px] font-semibold text-[#171A17]">
                      {outgoing ? 'Your tax invoice' : 'Clean copy of this invoice'}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-[#6B6F68]">
                      Rebuilt from the extracted data — not a copy of the scan. Check it before printing.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
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
                {sellerMissing || gaps.length > 0 || sheet.vatRateSource === 'default' ? (
                  <div className="docu-print-chrome mb-4 space-y-1 rounded-2xl bg-white px-5 py-4 text-[12px] text-[#6B6F68] shadow-[0_18px_50px_-8px_rgba(26,28,30,0.35)]">
                    {sellerMissing ? (
                      <p>
                        Your company name, VAT number and banking details are blank —{' '}
                        <Link href="/app/docu/databases/company" className="font-medium text-[#1F5FA8] hover:underline">
                          add them in your company profile
                        </Link>{' '}
                        and they will appear on every invoice you print.
                      </p>
                    ) : null}
                    {gaps.length > 0 ? (
                      <p>
                        No {gaps.join(' or ')} was read from this document — fill it in beside the lines and save,
                        rather than writing it on by hand.
                      </p>
                    ) : null}
                    {sheet.vatRateSource === 'default' ? (
                      <p>
                        No VAT was read from this document, so your default rate of{' '}
                        <span className="of-num">{sheet.vatRate}%</span> was applied.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <InvoiceSheetClassic
                  companyProfile={seller}
                  orgName={outgoing ? orgName : sellerName}
                  customer={billed}
                  invoice={sheet.invoice}
                  lines={sheet.lines}
                  vatTreatment={sheet.vatRate > 0 ? 'standard' : 'zero_rated'}
                  vatRate={sheet.vatRate}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
