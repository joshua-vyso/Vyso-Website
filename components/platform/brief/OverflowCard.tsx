import Link from 'next/link';
import { AI_GRADIENT_TEXT } from './brief-display';

/**
 * The fifth card — "You have 23 other items that need your attention."
 *
 * WHY IT EXISTS. `splitForToday` caps the brief at five cards, and a cap with
 * nothing to show for it is just data going missing: the greeting would say "27
 * things need your attention" over four cards, and the owner would be left to
 * work out whether Vyso had lost the other twenty-three or lied about the
 * number. This card is the honest half of the cap. It is why the heading is
 * allowed to keep the TRUE total (lib/platform/brief-feed.ts).
 *
 * NOT A FINDING, AND IT DOES NOT PRETEND TO BE ONE. No agent chip, no "found"
 * timestamp, no rand figure, no accent bar, and — the plan is explicit — no
 * Dismiss. There is nothing here to dismiss: it is a count of other cards, and a
 * dismissed count would simply lie the next time the page rendered. It also
 * carries no evidence link, because it cites nothing; the way in to what it is
 * about is the one link it has.
 *
 * A SERVER COMPONENT. It renders a number and an anchor and holds no state. The
 * number is computed on the server (from the same feed the greeting counts), so
 * there is no hydration boundary for it to disagree across.
 *
 * The gradient ✦ is sanctioned here for the reason it is sanctioned on a finding
 * card's recommendation block: this sentence is Vyso talking about its own work,
 * which is exactly what the mark means (see brief-display.ts, THE GRADIENT RULE).
 */
export function OverflowCard({ count }: { count: number }) {
  // Defensive rather than decorative: with the shipped cap this is never less
  // than 2 (six open findings is the first case that overflows, leaving two),
  // but `splitForToday` takes cap/show as parameters and "1 other items" is the
  // kind of wrong that survives for a year.
  const items = count === 1 ? '1 other item that needs' : `${count} other items that need`;

  return (
    <article className="rounded-[var(--pf-radius-card)] border border-dashed border-[var(--pf-border-strong)] bg-[var(--pf-surface-tint-faint)] px-[22px] py-5">
      <p className="flex items-start gap-2 text-[15px] leading-[1.5] text-[var(--pf-text-body)]">
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: AI_GRADIENT_TEXT }}
          aria-hidden
        >
          ✦
        </span>
        <span>You have {items} your attention.</span>
      </p>

      <Link
        href="/app?view=all"
        className="mt-3 inline-flex items-center gap-1.5 rounded-[9px] text-[13px] font-semibold text-[var(--pf-accent-strong)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--pf-accent-ring)]"
      >
        View the full briefing →
      </Link>
    </article>
  );
}
