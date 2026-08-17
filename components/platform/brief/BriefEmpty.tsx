import { AI_GRADIENT_TEXT } from './brief-display';

/**
 * The nothing-to-report card.
 *
 * Used for all three flavours of empty — the agent has found nothing, the
 * `agent_findings` migration hasn't been pasted into this database yet, and an
 * empty History. None of them is an error, and none of them renders as one: a
 * brief with nothing in it is good news about the business, and the copy
 * teaches what will fill it (the house rule for empty states).
 */
export function BriefEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--pf-radius-card)] border border-[var(--pf-border)] bg-white px-[22px] py-7 text-center shadow-[var(--pf-shadow-card)]">
      <span
        className="bg-clip-text text-[18px] text-transparent"
        style={{ backgroundImage: AI_GRADIENT_TEXT }}
        aria-hidden
      >
        ✦
      </span>
      <h2 className="of-display mt-2 text-[16px] font-semibold text-[var(--pf-text)]">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-[420px] text-[13.5px] leading-[1.55] text-[var(--pf-text-secondary)]">
        {body}
      </p>
    </div>
  );
}
