import Link from 'next/link';
import {
  REVIEW_GROUPS,
  REVIEW_OVERFLOW_HREF,
  reviewHeading,
  type ReviewQueue,
} from '@/lib/platform/review-queue-shared';

/**
 * The Review chat's opening card (`.ai/plan_review_chat.md`, "The Review chat").
 *
 * ZERO MODEL CALLS, AND THAT IS THE DESIGN, not a cost saving. This card is the
 * first thing on screen every time the owner opens the queue, and it is a LIST
 * OF THINGS THAT EXIST: five documents and a quote request, each with a link
 * that opens the screen where the decision is made. A model asked to write that
 * sentence would sometimes write it beautifully and sometimes drop the sixth
 * item, and there is no version of "sometimes drops an item" that belongs in
 * front of an owner's outstanding invoices. So it is a template over rows the
 * server just read, it is regenerated on every visit, and it cannot say
 * anything the queue does not.
 *
 * A SERVER COMPONENT with no interactivity of its own: every affordance on it
 * is a plain <Link> to Doc-U or OrderFlow. The conversation underneath is where
 * the client lives.
 *
 * NOT A MESSAGE. It is drawn ABOVE the transcript rather than stored as a first
 * assistant turn, because the queue changes and a stored turn would not — a
 * chat that opened with "3 items" forever, two of them long since approved, is
 * the exact failure this whole feature is built to avoid.
 */
export function ReviewOpening({ queue }: { queue: ReviewQueue }) {
  return (
    <section
      aria-label="Review queue"
      className="mb-8 rounded-2xl border border-[var(--pf-border)] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(20,24,20,0.04)]"
    >
      <h1 className="of-display text-[17px] font-semibold leading-tight tracking-[-0.015em] text-[var(--pf-text)]">
        {reviewHeading(queue.total)}
      </h1>
      <p className="mt-1.5 text-[13.5px] text-[var(--pf-text-secondary)]">
        Each of these is waiting on you. Nothing here changes your stock, orders or invoices until you
        approve it.
      </p>

      {REVIEW_GROUPS.map((group) => {
        const items = queue.items.filter((i) => i.kind === group.kind);
        if (items.length === 0) return null;

        return (
          <div key={group.kind} className="mt-5">
            <div className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
              {group.label}
              {/* The per-kind count is the FULL one, not the number of rows drawn
                  below it — the cap is announced once, at the bottom, rather than
                  silently shortening every group heading. */}
              <span className="of-num ml-2 font-normal tracking-normal">{queue.counts[group.kind]}</span>
            </div>

            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <li
                  key={`${item.kind}:${item.id}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-[10px] border border-[var(--pf-border-warm)] px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-[13.5px] font-medium text-[var(--pf-text)]">
                    {item.title}
                    <span className="ml-2 font-normal text-[var(--pf-text-secondary)]">{item.detail}</span>
                  </span>
                  {item.actions.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="shrink-0 text-[12.5px] font-medium text-[#1F5FA8] transition-colors hover:underline"
                      style={{ transitionDuration: 'var(--dur-hover)' }}
                    >
                      {action.label} →
                    </Link>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {queue.truncated ? (
        <p className="mt-4 text-[12.5px] text-[var(--pf-text-secondary)]">
          <Link href={REVIEW_OVERFLOW_HREF} className="font-medium text-[#1F5FA8] hover:underline">
            and {queue.total - queue.items.length} more →
          </Link>
        </p>
      ) : null}

      {/* The promise, said out loud. A row that appears and disappears on its own
          is only reassuring if the owner has been told that is what it does. */}
      <p className="mt-4 border-t border-[var(--pf-border-warm)] pt-3 text-[12.5px] text-[var(--pf-text-faint)]">
        When these are done this chat closes itself.
      </p>
    </section>
  );
}
