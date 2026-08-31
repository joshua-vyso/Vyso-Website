'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfidenceText } from '@/components/platform/ui';
import { DOC_TYPE_LABEL } from '@/lib/platform/documents';
import type { DocuExtractedData } from '@/lib/platform/docu/types';
import type { DocumentType } from '@/lib/platform/types';

/**
 * The credit-document review screen — the fourth arm of the detail panel,
 * beside the order editor, the receipt card and the generic extraction editor.
 *
 * WHY IT IS NOT THE GENERIC EDITOR. The generic arm is a table of extracted
 * fields and product lines, which is the right shape for a supplier invoice and
 * exactly the wrong one here: it has nowhere to say WHICH WAY THE MONEY GOES,
 * nowhere to put the two references that make a credit mean anything (the
 * invoice it reverses and the PO behind that), and nowhere to say that
 * confirming it posts nothing. Eat Your Greens CRN0012368 was filed as an
 * `invoice` with a positive R335.00 line, and every screen in the product
 * agreed with that reading, because none of them had a way to disagree.
 *
 * THREE VARIANTS, ONE CARD. A supplier credit note, a customer credit request
 * and a customer credit note are the same shape of paper pointing three
 * different ways, and the header line is what distinguishes them — including
 * the one that matters most, which is that a REQUEST has been agreed by nobody.
 *
 * EVERY FIGURE IS PRINTED EXACTLY AS THE PAPER PRINTED IT, sign included. No
 * formatting pass, no `Math.abs`, no derived total: the reason `credit_document`
 * exists at all is that Credit Request 6275 was stored as 154.42 — a figure
 * lifted from the EXPECTED column — while the paper said Nett CR −52.58. A card
 * that tidied a minus sign away would be that mistake in the render layer.
 */
export function CreditReviewCard({
  documentId,
  documentType,
  extractedData,
  confidence,
  counterpartyName,
}: {
  documentId: string;
  documentType: DocumentType;
  extractedData: DocuExtractedData | null;
  /** The document's own extraction confidence. Drawn through the shared
   *  `ConfidenceText`, which renders null as "—". */
  confidence: number | null;
  /** The supplier or customer as filed, for the header when the credit block
   *  names nobody. */
  counterpartyName: string | null;
}) {
  const router = useRouter();
  const credit = extractedData?.credit_document ?? null;
  const lines = extractedData?.line_items ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const supplierSide = documentType === 'supplier_credit_note';
  const isRequest = documentType === 'customer_credit_request';

  /**
   * WHAT CONFIRMING DOES, in one sentence per direction, because the sentence
   * IS the safeguard. A reviewer who has approved a hundred invoices has learnt
   * that approving moves stock and spend; nothing on a page that looks like an
   * invoice tells them this one does not.
   */
  const effectLine = supplierSide
    ? 'Financial effect: Reduces what you owe this supplier · Operational impact: None'
    : isRequest
      ? 'Financial effect: A request — nothing is credited until you agree it · Operational impact: None'
      : 'Financial effect: Reduces what this customer owes you · Operational impact: None';

  /** Confirm = the ordinary review commit, the SAME route every other document
   *  type uses. It files and routes; it posts no AP, no AR, no claim and no
   *  stock. The button is honest because `runDocumentSideEffects` is — this
   *  screen took no shortcut of its own. */
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/docu/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: documentId, action: 'save' }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const heading = DOC_TYPE_LABEL[documentType];
  const who = counterpartyName || 'Counterparty not matched';
  const cur = credit?.currency ? `${credit.currency} ` : '';
  const amount = credit?.total_amount || credit?.net_amount || '';

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="border-b border-[#EEF1F5] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="of-display truncate text-[16px] font-semibold text-[#171A17]">
              {heading} — {who}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#A0A49C]">
              {credit?.credit_reference || 'No credit reference read'}
              {credit?.reason ? ` · ${credit.reason}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#E9F2F0] px-2.5 py-1 text-[11px] font-medium text-[#1F6B63]">
            {heading}
          </span>
        </div>
        <p className="mt-2 text-[12px] text-[#6B6F68]">
          <ConfidenceText value={confidence} /> confidence
        </p>
      </div>

      <div className="px-6 py-5">
        {credit ? (
          <>
            {/* THE CREDIT ITSELF, and the two references that give it meaning.
                They are separate rows because they are three different numbers
                — the credit's own, the invoice it reverses, and the PO behind
                that — and the invoice schema that lost all three treated them
                as interchangeable header text. */}
            <dl className="divide-y divide-[#EEF1F5]">
              <Row label="Credit reference" value={credit.credit_reference} />
              <Row label="Against invoice" value={credit.original_invoice_reference} />
              <Row label="Purchase order" value={credit.po_reference} />
              {credit.net_amount ? (
                <Row label="Net" value={`${cur}${credit.net_amount}`} numeric />
              ) : null}
              {credit.tax_amount ? (
                <Row label="VAT" value={`${cur}${credit.tax_amount}`} numeric />
              ) : null}
              {amount ? (
                <div className="flex items-center justify-between py-2.5 text-[14px]">
                  <dt className="font-medium text-[#171A17]">
                    {isRequest ? 'Credit requested' : 'Credit amount'}
                  </dt>
                  {/* VERBATIM, SIGN AND ALL. "-52.58" stays "-52.58". */}
                  <dd className="of-num text-[16px] font-semibold text-[#171A17]">{`${cur}${amount}`}</dd>
                </div>
              ) : null}
            </dl>

            {lines.length > 0 ? (
              <div className="mt-4 border-t border-[#EEF1F5] pt-3">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
                  Goods being credited
                </p>
                {lines.map((it, i) => (
                  <div
                    key={`${it.description}-${i}`}
                    className="flex items-center justify-between gap-3 py-1 text-[13px]"
                  >
                    <span className="min-w-0 truncate text-[#6B6F68]">
                      {[it.quantity, it.description].filter(Boolean).join(' × ') || it.description || '—'}
                    </span>
                    <span className="of-num shrink-0 text-[#171A17]">{it.amount || '—'}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-[13px] text-[#6B6F68]">
            No credit figures were read from this document. It is filed as a {heading.toLowerCase()} and is
            excluded from spend, stock and price tracking; open the original to check it by eye.
          </p>
        )}

        <p className="mt-3 rounded-[14px] bg-[#F5F9FE] px-3.5 py-2.5 text-[12.5px] text-[#3E4A57]">
          {effectLine}
        </p>
        {/* SAID OUT LOUD, because the button above it says "Confirm" and every
            other Confirm in Doc-U does something. Vyso has no credit ledger to
            post to — `of_credit_notes` and `ss_supplier_credits` are manual
            claims systems — and a screen that let a reviewer believe otherwise
            would leave a credit everyone thinks was claimed. */}
        <p className="mt-1.5 text-[12px] text-[#6B6F68]">
          Confirming files this credit and links it to the {supplierSide ? 'supplier' : 'customer'}. It does
          not post a credit, adjust an invoice, or change what is owed — record the claim wherever you
          normally do.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-[#EEF1F5] bg-white px-6 py-4">
        {error ? <span className="mr-auto text-[12.5px] text-[#A32D2D]">{error}</span> : null}
        {saved ? (
          <span className="mr-auto flex items-center gap-2 text-[13px] font-medium text-[#0F6E56]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" />
            Credit filed
          </span>
        ) : null}
        <button
          type="button"
          onClick={confirm}
          disabled={busy || saved}
          className="inline-flex h-[38px] items-center rounded-[11px] bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
        >
          Confirm &amp; file
        </button>
      </div>
    </div>
  );
}

/** One reference or figure. Drawn only when the paper printed it — a blank row
 *  reading "—" invites the reader to wonder what was lost, when the honest
 *  answer is that nothing was there. */
function Row({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <dt className="text-[#6B6F68]">{label}</dt>
      <dd className={`shrink-0 text-[#171A17] ${numeric ? 'of-num' : ''}`}>{value}</dd>
    </div>
  );
}
