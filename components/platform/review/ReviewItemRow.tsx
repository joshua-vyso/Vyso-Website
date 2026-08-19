'use client';

import { reviewItemKey } from '@/lib/platform/review-actions-shared';
import type { ReviewItem } from '@/lib/platform/review-queue-shared';

/**
 * One thing waiting on a decision (`.ai/plan_review_v2.md` §1.2).
 *
 * A BUTTON, NOT A LINK, and that is the whole change from v1. The row used to
 * be an anchor to `/app/docu/[id]`; now clicking it expands the item where it
 * stands and opens the pane beside it, because Josh's ask was explicitly
 * "clicking an item expands that block in place (not a new page)". The link to
 * the module survives — it is one of the pane's buttons — so the old journey is
 * one extra click away rather than gone.
 *
 * THE EXPANDED ROW STAYS A ROW. It gains a rule down its left edge, a lighter
 * ground and its full detail sentence; it does not grow a copy of the pane. The
 * chain has to stay scannable while the pane is open — the owner's eye moves
 * between "which one am I on" and "what does it say", and duplicating the
 * second thing into the first is what turns a queue into two queues.
 *
 * KEYBOARD: the parent owns ↑/↓/Enter/Escape for the whole list (see
 * ReviewChain), because moving between rows is a property of the list, not of a
 * row. Each row carries `data-review-row` so the parent can find its siblings
 * without a ref array that has to be kept in step with a filtered list.
 */
export function ReviewItemRow({
  item,
  open,
  error,
  busy,
  onOpen,
}: {
  item: ReviewItem;
  open: boolean;
  /** Why this one failed to approve, from the last batch. Sits under the row
   *  and survives the refresh, because the row survived it too. */
  error?: string;
  busy: boolean;
  onOpen: () => void;
}) {
  const key = reviewItemKey(item);

  return (
    <li>
      <button
        type="button"
        data-review-row={key}
        aria-expanded={open}
        disabled={busy}
        onClick={onOpen}
        className={`flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors disabled:opacity-50 ${
          open
            ? 'border-[#C9DEF7] bg-[#F5F9FE] shadow-[inset_3px_0_0_0_#1F5FA8]'
            : 'border-[var(--pf-border-warm)] bg-white hover:border-[#C9DEF7] hover:bg-[#FAFBFD]'
        }`}
        style={{ transitionDuration: 'var(--dur-hover)' }}
      >
        <span className="min-w-0 flex-1 text-[13.5px] font-medium text-[var(--pf-text)]">
          {item.title}
          <span
            className={`ml-2 font-normal text-[var(--pf-text-secondary)] ${open ? '' : 'line-clamp-1'}`}
          >
            {item.detail}
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-[12.5px] font-medium ${
            open ? 'text-[#1F5FA8]' : 'text-[var(--pf-text-faint)]'
          }`}
        >
          {open ? '−' : '+'}
        </span>
      </button>

      {error ? (
        <p role="alert" className="mt-1 px-3.5 text-[12.5px] text-[#A32D2D]">
          {error}
        </p>
      ) : null}
    </li>
  );
}
