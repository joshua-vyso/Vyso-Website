'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfidenceText } from '@/components/platform/ui';
import type { DocuExtractedData } from '@/lib/platform/docu/types';
import type { OrderAmendmentType } from '@/lib/platform/types';

/**
 * The order-amendment review screen — shown instead of the order editor when a
 * message asks for a change to an order that already exists.
 *
 * WHY THE ORDER EDITOR IS THE WRONG SCREEN FOR THIS. `OrderReviewEditor` draws
 * an Items panel with a live "+ Add item" button and a Confirm that builds an
 * OrderFlow order. Put the PO 144583 email in front of it and every one of
 * those is an invitation to do the wrong thing: the email carries no goods
 * (they are on the original PO), and confirming it is precisely what produced a
 * second, empty order beside the real one with "Keshisha Ramsewak" as the
 * customer. So there is NO Items panel here and NO "+ Add item" — not disabled,
 * absent. A control that refuses is an invitation to wonder why.
 *
 * WHAT IT DOES INSTEAD is state the change in one line, in the sender's own
 * words, and offer the order it refers to. The reviewer's job on this screen is
 * to read what was asked and go and do it; Vyso does not apply the change,
 * because applying it means moving a date or a quantity on an order somebody
 * already approved, on the strength of an email nobody has.
 */
export function AmendmentReviewCard({
  documentId,
  extractedData,
  confidence,
  customerName,
}: {
  documentId: string;
  extractedData: DocuExtractedData | null;
  confidence: number | null;
  /** The RESOLVED customer, when the matcher landed one. Falls back to whatever
   *  the reader put in `customer_name` — extraction values are never
   *  overwritten by resolution, so both can be shown honestly. */
  customerName: string | null;
}) {
  const router = useRouter();
  const amendment = extractedData?.order_amendment ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const cancelled = extractedData?.business_event === 'order_cancellation';
  const contact = extractedData?.contact_person ?? null;

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

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      <div className="border-b border-[#EEF1F5] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="of-display truncate text-[16px] font-semibold text-[#171A17]">
              {cancelled ? 'Order cancellation' : 'Order update'}
              {amendment?.referenced_po ? ` — PO ${amendment.referenced_po}` : ''}
            </h2>
            <p className="mt-0.5 text-[12px] text-[#A0A49C]">
              {amendment ? AMENDMENT_LABEL[amendment.amendment_type] : 'Change requested'}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#FBEEDA] px-2.5 py-1 text-[11px] font-medium text-[#854F0B]">
            {cancelled ? 'Cancellation' : 'Amendment'}
          </span>
        </div>
        <p className="mt-2 text-[12px] text-[#6B6F68]">
          <ConfidenceText value={confidence} /> confidence
        </p>
      </div>

      <div className="px-6 py-5">
        <dl className="divide-y divide-[#EEF1F5]">
          {/* CUSTOMER AND CONTACT, SIDE BY SIDE, because keeping them apart is
              the other half of this feature. The row that started it read
              "Customer: Keshisha Ramsewak" — a person in the business slot,
              with no slot for the property she buys for. */}
          <Row label="Customer" value={customerName} />
          <Row label="Contact" value={contact} />
          {amendment?.previous_value ? <Row label="Was" value={amendment.previous_value} /> : null}
          {amendment?.requested_value ? <Row label="Requested" value={amendment.requested_value} /> : null}
        </dl>

        {/* THE SENDER'S OWN SENTENCE, quoted rather than paraphrased. It is the
            only thing on this screen a human can act on, and a summary of it
            would be Vyso deciding what the customer meant. */}
        {amendment?.note ? (
          <blockquote className="mt-4 rounded-[14px] border-l-2 border-[#C9DEF7] bg-[#F5F9FE] px-3.5 py-2.5 text-[13px] leading-[1.55] text-[#3E4A57]">
            “{amendment.note}”
          </blockquote>
        ) : null}

        {/* WHICH ORDER THIS IS ABOUT — one, none, or several, and never a guess.
            'ambiguous' does not pick the newest for the same reason the customer
            matcher does not pick the nearest: a link Vyso invented would look
            exactly like one it found. */}
        <div className="mt-4 border-t border-[#EEF1F5] pt-3">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
            The order this refers to
          </p>
          {amendment?.link_status === 'linked' && amendment.linked_order_document_id ? (
            <Link
              href={`/app/docu/${amendment.linked_order_document_id}`}
              className="inline-flex h-8 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3 text-[12px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
            >
              Open PO {amendment.referenced_po}
            </Link>
          ) : amendment?.link_status === 'ambiguous' ? (
            <p className="text-[12.5px] text-[#854F0B]">
              More than one order carries PO {amendment.referenced_po}. Vyso has not picked one — open the
              documents list and check which is current.
            </p>
          ) : (
            <p className="text-[12.5px] text-[#6B6F68]">
              {amendment?.referenced_po
                ? `No filed order carries PO ${amendment.referenced_po}. It may not have been sent to Vyso.`
                : 'This message names no order reference.'}
            </p>
          )}
        </div>

        <p className="mt-4 rounded-[14px] bg-[#F5F9FE] px-3.5 py-2.5 text-[12.5px] text-[#3E4A57]">
          {cancelled
            ? 'Operational impact: None · No order was created, and the existing order has not been cancelled'
            : 'Operational impact: None · No order was created, and the existing order has not been changed'}
        </p>
        <p className="mt-1.5 text-[12px] text-[#6B6F68]">
          Confirming files this message against the order. {cancelled ? 'Cancel' : 'Apply the change to'} the
          order yourself in OrderFlow — Vyso will not do it for you.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-[#EEF1F5] bg-white px-6 py-4">
        {error ? <span className="mr-auto text-[12.5px] text-[#A32D2D]">{error}</span> : null}
        {saved ? (
          <span className="mr-auto flex items-center gap-2 text-[13px] font-medium text-[#0F6E56]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" />
            Filed
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

const AMENDMENT_LABEL: Record<OrderAmendmentType, string> = {
  delivery_date_change: 'Delivery date change',
  quantity_change: 'Quantity change',
  address_change: 'Delivery address change',
  cancellation: 'Cancellation requested',
  hold: 'Put on hold',
  instruction: 'Instruction update',
};

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <dt className="text-[#6B6F68]">{label}</dt>
      <dd className="min-w-0 truncate text-[#171A17]">{value}</dd>
    </div>
  );
}
