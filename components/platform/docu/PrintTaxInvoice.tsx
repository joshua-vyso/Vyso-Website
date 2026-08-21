'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { InvoiceSheetClassic, type ClassicInvoiceParty } from '@/components/platform/orderflow/InvoiceSheetClassic';
import { PrintSheetOverlay } from './PrintSheetOverlay';
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
 * PREVIEW BEFORE PRINT, always — see `PrintSheetOverlay`, which owns that shell
 * and its print CSS and is shared with the order review editor's Print button.
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
  const [open, setOpen] = useState(false);

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

      <PrintSheetOverlay
        open={open}
        onClose={() => setOpen(false)}
        title={outgoing ? 'Your tax invoice' : 'Clean copy of this invoice'}
        subtitle="Rebuilt from the extracted data — not a copy of the scan. Check it before printing."
        notes={
          sellerMissing || gaps.length > 0 || sheet.vatRateSource === 'default' ? (
            <>
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
                  No {gaps.join(' or ')} was read from this document — fill it in beside the lines and save, rather
                  than writing it on by hand.
                </p>
              ) : null}
              {sheet.vatRateSource === 'default' ? (
                <p>
                  No VAT was read from this document, so your default rate of{' '}
                  <span className="of-num">{sheet.vatRate}%</span> was applied.
                </p>
              ) : null}
            </>
          ) : null
        }
      >
        <InvoiceSheetClassic
          companyProfile={seller}
          orgName={outgoing ? orgName : sellerName}
          customer={billed}
          invoice={sheet.invoice}
          lines={sheet.lines}
          vatTreatment={sheet.vatRate > 0 ? 'standard' : 'zero_rated'}
          vatRate={sheet.vatRate}
        />
      </PrintSheetOverlay>
    </>
  );
}
