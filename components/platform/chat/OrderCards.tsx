'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { stashParsedOrder, type ParsedOrder } from '@/lib/ai/finch/order-handoff';
import type { DockCard } from '@/components/platform/shell/FinchChatProvider';
import { HubdocConfirmCard } from './HubdocConfirmCard';
import type { OrderIngestResult } from '@/lib/platform/docu/order-ingest-client';

/**
 * The two things Finch hands back that are not sentences (W4).
 *
 * MOVED, NOT REWRITTEN. Both cards are FinchModal's, markup and copy intact —
 * `ParsedOrderCard` (renamed `OrderDraftCard`, because "parsed" described where
 * it used to come from rather than what it is) and `IngestResultCard`. They
 * keep their own blue palette rather than adopting the `--pf-*` shell tokens:
 * this is the same card the owner has been reading since Phase D, and W4's job
 * was to move the surface it sits on, not to redecorate it.
 *
 * WHY THEY ARE RENDERED BY THE BUBBLE AND NOWHERE ELSE. Both can only ever
 * arrive on OrderFlow — one from the `orderflow_prepare_order` tool, which is
 * offered on the workflow tier of the `orderflow` module alone, the other from
 * a document dropped on an OrderFlow screen. The Brief's dock and the chat
 * pages cannot produce either, so drawing them there would be dead markup.
 *
 * WHY THE CARDS ARE NOT MESSAGES. They are live UI with buttons, and they are
 * NOT persisted to `finch_messages` — reopening the chat tomorrow shows the
 * conversation, not a stale "Open in a new order" button pointing at a draft
 * that was never saved (nothing server-side holds it: see the route's
 * `buildOrderDraft`, which is display data only). The answer text beside them
 * says what was prepared, and that is what survives.
 */
export function DockCards({
  cards,
  onDismiss,
  /** Ran before a card navigates away — the bubble collapses itself, the way
   *  the modal used to close. */
  onNavigate,
}: {
  cards: readonly DockCard[];
  onDismiss: (id: string) => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();

  if (cards.length === 0) return null;

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card) =>
        card.kind === 'hubdoc_confirm' ? (
          // Plugins X2 — chat hand-off. Unlike the two below it has nowhere to
          // navigate to: the decision it carries is made here.
          <HubdocConfirmCard key={card.id} card={card} onDismiss={() => onDismiss(card.id)} />
        ) : card.kind === 'draft' ? (
          <OrderDraftCard
            key={card.id}
            order={card.order}
            onOpen={() => {
              stashParsedOrder(card.order);
              go('/app/orderflow/orders/new');
            }}
            onDismiss={() => onDismiss(card.id)}
          />
        ) : (
          <IngestResultCard
            key={card.id}
            result={card.result}
            filename={card.filename}
            onOpenOrder={(orderId) => go(`/app/orderflow/orders/${orderId}`)}
            onOpenDoc={(docId) => go(`/app/docu/${docId}`)}
            onDismiss={() => onDismiss(card.id)}
          />
        ),
      )}
    </div>
  );
}

/** Copy an order to the clipboard as plain text — the fallback for an owner who
 *  wants it in an email rather than in the builder. */
async function copyOrder(order: ParsedOrder) {
  const lines = order.items.map(
    (it) => `${it.name} — qty ${it.qty}${it.unit_price ? ` @ R ${it.unit_price.toFixed(2)}` : ''}`,
  );
  const text = [order.customerName ? `Order for ${order.customerName}` : 'Order', ...lines].join('\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard blocked — non-fatal */
  }
}

/** An order Finch prepared, with actions to open it in the New Order builder or
 *  copy it. The builder reads it back through `order-handoff.ts` → the
 *  `FinchOrderPrefill` panel on that page. */
function OrderDraftCard({
  order,
  onOpen,
  onDismiss,
}: {
  order: ParsedOrder;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const lowConfidence = typeof order.customerConfidence === 'number' && order.customerConfidence < 60;
  const count = order.items.length;

  return (
    <div className="rounded-2xl border border-[#BBD9F5] bg-[#F2F8FE] p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#12324F]">
        <span className="finch-gradient flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3l1.6 4.6L18 9.2l-4.4 1.6L12 15l-1.6-4.2L6 9.2l4.4-1.6L12 3z" fill="#fff" />
          </svg>
        </span>
        <span className="of-display">Order draft</span>
        {order.filename ? (
          <span className="min-w-0 truncate text-[11px] font-normal text-[#5F80A0]">· {order.filename}</span>
        ) : null}
      </div>

      {order.customerName ? (
        <div className="mt-1.5 text-[12px] text-[#12324F]">
          Customer: <span className="font-medium">{order.customerName}</span>
          {lowConfidence ? <span className="text-[#9A6A00]"> · please confirm</span> : null}
        </div>
      ) : (
        <div className="mt-1.5 text-[12px] text-[#9A6A00]">No customer detected — you can pick one in the order.</div>
      )}

      {count ? (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-[#D5E6F7] bg-white">
          {order.items.map((it, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 border-b border-[#EEF4FB] px-3 py-1.5 text-[12px] last:border-0"
            >
              <span className="truncate text-[#171A17]">{it.name}</span>
              <span className="of-num shrink-0 text-[#6B6F68]">
                {it.qty}
                {it.unit_price ? ` × R ${it.unit_price.toFixed(2)}` : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[12px] text-[#6B6F68]">No line items detected.</div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="finch-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white"
        >
          Open in a new order
        </button>
        <button
          type="button"
          onClick={() => {
            void copyOrder(order);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-lg border border-[#E2E6EC] bg-white px-3 py-1.5 text-[12px] font-medium text-[#171A17] transition-colors hover:bg-[#F7FAFD] motion-reduce:transition-none"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#E4EFFA] motion-reduce:transition-none"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

const DOC_TYPE_LABEL: Record<string, string> = {
  order: 'customer order',
  invoice: 'supplier invoice',
  statement: 'market statement',
  delivery_note: 'delivery note',
  price_list: 'price list',
};

/** Result of filing a dropped doc into Doc-U (and, for orders, invoicing it). */
function IngestResultCard({
  result,
  filename,
  onOpenOrder,
  onOpenDoc,
  onDismiss,
}: {
  result: OrderIngestResult;
  filename: string;
  onOpenOrder: (orderId: string) => void;
  onOpenDoc: (docId: string) => void;
  onDismiss: () => void;
}) {
  const typeLabel = DOC_TYPE_LABEL[result.documentType] ?? 'document';
  const isOrder = result.documentType === 'order';
  const orderBuilt = isOrder && !!result.orderId; // an of_orders row exists
  const invoiced = orderBuilt && !!result.invoiceNumber && !result.needsReview;
  const draftHeld = orderBuilt && !invoiced; // order exists but not invoiced yet
  const orderNotBuilt = isOrder && !orderBuilt; // sync failed / not yet an order

  return (
    <div className="rounded-2xl border border-[#BBD9F5] bg-[#F2F8FE] p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#12324F]">
        <span className="finch-gradient flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5l4 4 10-11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="of-display">Filed in Doc-U</span>
        <span className="min-w-0 truncate text-[11px] font-normal text-[#5F80A0]">· {filename}</span>
      </div>

      <div className="mt-1.5 text-[12px] text-[#12324F]">
        Read as a <span className="font-medium">{typeLabel}</span>
        {result.customerName ? (
          <>
            {' '}
            for <span className="font-medium">{result.customerName}</span>
          </>
        ) : null}
        {result.supplier ? (
          <>
            {' '}
            from <span className="font-medium">{result.supplier}</span>
          </>
        ) : null}
        {typeof result.itemCount === 'number' && result.itemCount > 0
          ? ` · ${result.itemCount} line${result.itemCount === 1 ? '' : 's'}`
          : ''}
        .
      </div>

      {invoiced ? (
        <div className="mt-1.5 text-[12px] font-medium text-[#1F5FA8]">
          Invoice <span className="of-num font-semibold">{result.invoiceNumber}</span> created.
        </div>
      ) : draftHeld ? (
        <div className="mt-1.5 text-[12px] text-[#9A6A00]">
          Saved as a draft order — confirm the customer to invoice it.
        </div>
      ) : orderNotBuilt ? (
        <div className="mt-1.5 text-[12px] text-[#9A6A00]">Filed in Doc-U — open it to finish building the order.</div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {invoiced && result.orderId ? (
          <>
            <button
              type="button"
              onClick={() => onOpenOrder(result.orderId!)}
              className="finch-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white"
            >
              View order &amp; invoice
            </button>
            <button
              type="button"
              onClick={() => onOpenDoc(result.documentId)}
              className="rounded-lg border border-[#E2E6EC] bg-white px-3 py-1.5 text-[12px] font-medium text-[#171A17] transition-colors hover:bg-[#F7FAFD] motion-reduce:transition-none"
            >
              Open in Doc-U
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onOpenDoc(result.documentId)}
            className="finch-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white"
          >
            {draftHeld ? 'Review order' : 'Open in Doc-U'}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#E4EFFA] motion-reduce:transition-none"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
