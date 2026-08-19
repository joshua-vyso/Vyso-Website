'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ReviewQuoteDetail } from '@/lib/platform/review-actions';

/**
 * A website enquiry, in the pane (`.ai/plan_review_v2.md` §1.4).
 *
 * THERE IS NO APPROVE BUTTON HERE, and there is no batch anywhere above this
 * pane that includes an enquiry. OrderFlow's two decisions on a lead are "draft
 * a quote" — a person writing a priced document — and "dismiss". Neither is an
 * approval, so neither is offered under that word, and `selectApprovable` keeps
 * quote requests out of every "Approve all".
 *
 * THE BUTTON IS CALLED **DISMISS**, NOT "MARK HANDLED". The plan asked for the
 * latter, and `of_quote_requests.status` offers `new | quoted | dismissed`: the
 * only "done" a person can set without drafting a quote is 'dismissed', which is
 * exactly what the Quotes screen's own button writes. Giving that one write a
 * second name on a second screen is the "second approval semantics" the plan
 * forbids two paragraphs earlier, so the module's word wins. It confirms first,
 * as the Quotes screen does, because a dismissed lead is not shown again.
 *
 * THE MESSAGE IS RENDERED VERBATIM AND AS TEXT. Every field on this screen was
 * typed by an anonymous stranger into a public form. React escapes it; none of
 * it is HTML, none of it is a link, and the line at the bottom says so out loud
 * — the same warning the Quotes screen carries, because the owner is about to
 * make a decision partly on the strength of a company name anyone could claim.
 */
export function QuoteReviewPane({
  detail,
  busy,
  onAddCustomer,
  onDismiss,
}: {
  detail: ReviewQuoteDetail;
  busy: boolean;
  onAddCustomer: () => void;
  onDismiss: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  // Three states for one button, and the middle one is the point: "already a
  // customer" is not a failure and not a disabled button with no explanation —
  // it is the answer to the question the owner was about to ask.
  const customerLabel = detail.existingCustomer
    ? `Already a customer — ${detail.existingCustomer.name}`
    : 'Add as new customer';

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <Field label="Name" value={detail.contactName ?? '—'} />
        <Field label="Business" value={detail.businessName ?? '—'} />
        <Field label="Email" value={detail.email ?? '—'} />
        <Field label="Phone" value={detail.phone ?? '—'} />
        <Field label="Received" value={formatWhen(detail.receivedAt)} />
        <Field label="Via" value={detail.viaEmail ?? '—'} />
      </dl>

      {detail.message ? (
        <div>
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--pf-text-faint)]">
            What they wrote
          </h3>
          {/* `whitespace-pre-wrap` so their line breaks survive; `break-words` so
              a 400-character unbroken string cannot widen the pane. */}
          <p className="mt-1 whitespace-pre-wrap break-words rounded-[10px] bg-[#F7F8FA] px-3.5 py-2.5 text-[13px] leading-snug text-[var(--pf-text)]">
            {detail.message}
          </p>
        </div>
      ) : null}

      {detail.items.length > 0 ? (
        <div>
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--pf-text-faint)]">
            Items requested
          </h3>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {detail.items.map((item, i) => (
              <li
                key={`${detail.id}_${i}`}
                className="rounded-full bg-[#EEF1F5] px-2.5 py-0.5 text-[12.5px] text-[var(--pf-text)]"
              >
                {[item.quantity, item.unit, item.description].filter(Boolean).join(' ') || '—'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--pf-border-warm)] pt-4">
        <button
          type="button"
          disabled={busy || !detail.customer || detail.existingCustomer !== null}
          onClick={onAddCustomer}
          className="inline-flex h-[38px] items-center rounded-full bg-[#1F5FA8] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          {busy ? 'Working…' : customerLabel}
        </button>

        <Link
          href={detail.href}
          className="inline-flex h-[38px] items-center rounded-full border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          Draft a quote →
        </Link>

        <Link
          href={detail.listHref}
          className="text-[12.5px] font-medium text-[#1F5FA8] transition-colors hover:underline"
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          View in OrderFlow →
        </Link>

        <span className="ml-auto">
          {confirming ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-[12.5px] text-[var(--pf-text-secondary)]">
                It won&apos;t show here again.
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onDismiss();
                }}
                className="inline-flex h-[32px] items-center rounded-full bg-[#A32D2D] px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#8B2525] disabled:opacity-40"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[12.5px] font-medium text-[var(--pf-text-faint)] hover:text-[var(--pf-text-secondary)]"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="text-[12.5px] font-medium text-[var(--pf-text-faint)] transition-colors hover:text-[#A32D2D] disabled:opacity-40"
              style={{ transitionDuration: 'var(--dur-hover)' }}
            >
              Dismiss
            </button>
          )}
        </span>
      </div>

      {!detail.customer ? (
        <p className="text-[12px] text-[var(--pf-text-faint)]">
          There is no name or business on this enquiry to file a customer under.
        </p>
      ) : null}

      <p className="text-[11.5px] text-[var(--pf-text-faint)]">
        Typed into a public form — treat the name and company as unverified.
      </p>
    </div>
  );
}

/** "19 Aug, 10:04". Locale-formatted in the browser, which is where this
 *  component runs; a server-rendered stamp would be in the server's timezone. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--pf-text-faint)]">
        {label}
      </dt>
      <dd className="truncate text-[13.5px] text-[var(--pf-text)]">{value}</dd>
    </div>
  );
}
