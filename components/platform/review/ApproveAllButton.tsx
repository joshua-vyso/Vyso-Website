'use client';

import { useEffect, useState } from 'react';

/**
 * A batch approve — on a task, on a module, or on the whole queue
 * (`.ai/plan_review_v2.md` §1.1).
 *
 * THE CONFIRM STEP IS INLINE, NOT A MODAL, and only the master button asks for
 * it. That split is the plan's and it is the right one: "Approve all 3 invoices"
 * is a scoped action the owner is looking straight at, while "Approve all (14)"
 * reaches across modules to rows that may be scrolled off screen. A `confirm()`
 * dialog on every one of the three would teach the hand to dismiss the dialog,
 * which is precisely how the fourteen-item one stops working.
 *
 * It is inline rather than a modal because the count it is confirming is on the
 * screen behind it — a dialog that covers the list while asking about the list
 * makes the owner remember the number instead of reading it.
 *
 * THE ARMED STATE DISARMS ITSELF after eight seconds and on any outside click,
 * so a half-pressed master approve cannot sit waiting for a stray Enter.
 */
export function ApproveAllButton({
  label,
  count,
  confirmMessage,
  busy,
  onApprove,
  tone = 'quiet',
}: {
  label: string;
  /** How many items this will send. Zero renders nothing at all — a disabled
   *  batch button is an invitation to press it and learn it does nothing. */
  count: number;
  /** Present on the master button only; its presence IS what arms the two-step. */
  confirmMessage?: string;
  busy: boolean;
  onApprove: () => void;
  tone?: 'quiet' | 'loud';
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 8000);
    const disarm = () => setArmed(false);
    window.addEventListener('click', disarm);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('click', disarm);
    };
  }, [armed]);

  if (count <= 0) return null;

  const base =
    tone === 'loud'
      ? 'inline-flex h-[36px] items-center rounded-full bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40'
      : 'inline-flex h-[30px] items-center rounded-full border border-[#E2E6EC] bg-white px-3 text-[12.5px] font-medium text-[#3E4A57] transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40';

  if (confirmMessage && armed) {
    return (
      // `w-full` (v2.1): the armed banner is ~430px of text, and as an ordinary
      // `inline-flex` item in the header's wrapping row it stole the width from
      // the heading beside it — the title collapsed to one word per line and the
      // sentence rendered over the top of it (Josh, 2026-08-19). A full-basis
      // item wraps to a line of its own, under the title, which is where a
      // confirmation about the whole queue belongs anyway. Nothing is
      // positioned; the row does it.
      <span
        className="flex w-full flex-wrap items-center gap-2"
        // The arming listener is on `window`; without this the press that
        // confirms would also be the outside click that disarms.
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-[12.5px] text-[var(--pf-text-secondary)]">{confirmMessage}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setArmed(false);
            onApprove();
          }}
          className="inline-flex h-[32px] items-center rounded-full bg-[#1F5FA8] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
        >
          {busy ? 'Approving…' : 'Yes, approve'}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-[12.5px] font-medium text-[var(--pf-text-faint)] transition-colors hover:text-[var(--pf-text-secondary)]"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        if (confirmMessage) setArmed(true);
        else onApprove();
      }}
      className={base}
      style={{ transitionDuration: 'var(--dur-hover)' }}
    >
      {busy ? 'Approving…' : label}
    </button>
  );
}
