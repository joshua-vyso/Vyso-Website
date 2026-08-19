'use client';

import type { ReviewItemDetail } from '@/lib/platform/review-actions';
import { DocumentReviewPane } from './DocumentReviewPane';
import { QuoteReviewPane } from './QuoteReviewPane';

/** What the pane is doing right now. `done` is the brief state after an approval
 *  lands, before the pane closes itself — see ReviewChain for the 600ms. */
export type PaneState =
  | { phase: 'loading' }
  | { phase: 'ready'; detail: ReviewItemDetail }
  | { phase: 'gone' }
  | { phase: 'done' }
  | { phase: 'error'; message: string };

/**
 * The detail pane's chrome (`.ai/plan_review_v2.md` §1.3–1.4).
 *
 * PURE PRESENTATION. It does not fetch, does not write and does not know which
 * container it is in — ReviewChain owns all three, so the desktop split and the
 * mobile bottom sheet draw the same component with the same state and cannot
 * drift apart. It is also why the loading and "already handled" states live here
 * rather than in each of the two panes: they are states of the PANE, identical
 * for a document and an enquiry.
 *
 * THE TITLE IS THE ROW'S TITLE, passed in rather than read off the detail. The
 * pane must be able to name what it is loading before the load returns —
 * a heading that appears a beat after the panel it heads is a panel that flickers.
 *
 * ESCAPE AND THE × DO THE SAME THING, and the × is first in the DOM inside the
 * header so a keyboard user tabbing into the pane reaches "close" before they
 * reach "Approve".
 */
export function ReviewPane({
  title,
  state,
  busy,
  onClose,
  onApprove,
  onReject,
  onAddCustomer,
  onDismiss,
}: {
  title: string;
  state: PaneState;
  busy: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onAddCustomer: () => void;
  onDismiss: () => void;
}) {
  return (
    /* `min-h-0`, NOT `max-h-full` (v2.1). This card is a flex item of
       `.review-pane` — the drawer, or the split's track — and both of those own a
       definite maximum height. `max-height:100%` resolved to `none` against them
       (a percentage against an auto-height parent), so the card grew past the
       track and `overflow:hidden` above swallowed its Approve button. As a
       shrinkable item with a zero minimum it is bounded by the column instead,
       which is what hands the scroll to the body below. */
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--pf-border)] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.04)]">
      <div className="flex shrink-0 items-start gap-3 border-b border-[var(--pf-border-warm)] px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="order-2 -mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[16px] text-[var(--pf-text-faint)] transition-colors hover:bg-black/[0.04] hover:text-[var(--pf-text)]"
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          ×
        </button>
        <h2 className="of-display order-1 min-w-0 flex-1 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[var(--pf-text)]">
          {title}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {state.phase === 'loading' ? (
          <p className="py-8 text-center text-[13px] text-[var(--pf-text-faint)]">Reading it…</p>
        ) : null}

        {state.phase === 'gone' ? (
          <p className="py-8 text-center text-[13px] text-[var(--pf-text-secondary)]">
            Already handled — it has left the queue.
          </p>
        ) : null}

        {state.phase === 'done' ? (
          <p className="py-8 text-center text-[13px] font-medium text-[#27733B]">Done.</p>
        ) : null}

        {state.phase === 'error' ? (
          <p role="alert" className="py-8 text-center text-[13px] text-[#A32D2D]">
            {state.message}
          </p>
        ) : null}

        {state.phase === 'ready' && state.detail.kind === 'document' ? (
          <DocumentReviewPane
            detail={state.detail}
            busy={busy}
            onApprove={onApprove}
            onReject={onReject}
          />
        ) : null}

        {state.phase === 'ready' && state.detail.kind === 'quote_request' ? (
          <QuoteReviewPane
            detail={state.detail}
            busy={busy}
            onAddCustomer={onAddCustomer}
            onDismiss={onDismiss}
          />
        ) : null}
      </div>
    </div>
  );
}
