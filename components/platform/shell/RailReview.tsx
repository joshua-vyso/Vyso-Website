'use client';

import Link from 'next/link';
import { REVIEW_CHAT_ROUTE, reviewDotLabel } from '@/lib/platform/review-queue-shared';

/**
 * The pinned "Review" row (`.ai/plan_review_chat.md`, "Rail behaviour").
 *
 * IT ONLY EXISTS WHEN THERE IS SOMETHING TO DO. `count === 0` renders nothing —
 * not a greyed row, not an empty state. That is the whole promise Josh asked
 * for: the row appears when the system picks something up, and goes away when
 * the last item is done. A permanent row with a "0" would be one more piece of
 * chrome to learn to ignore, which is exactly what the red dot must not become.
 *
 * TWO SIGNALS, DELIBERATELY DIFFERENT IN KIND. The red dot is the universal
 * notification vocabulary — small, top-right of the icon, and the only red in
 * this rail. The ebbing border is the *ambient* one: it is what catches the eye
 * of someone who is not looking at the rail. `.vyso-ebb` (app/globals.css) is
 * border-colour + box-shadow only, never a gradient fill, and it holds still
 * under `prefers-reduced-motion` while the border and the dot both stay — the
 * information survives, only the motion goes.
 *
 * COUNT IN THE ARIA LABEL, NOT ON SCREEN. The row says "Review"; the dot is
 * `role="status"`-free but carries `aria-label="3 items need your decision"`,
 * so a screen reader gets the number a sighted reader gets from the card one
 * click away. A numeral in a 216px row beside two other numerals (the Brief's
 * open count, History's) would read as a third badge of the same kind, and this
 * one is not the same kind.
 *
 * ACTIVE STATE FROM THE PATHNAME the parent already resolved: this sits inside
 * RailChats, which reads `usePathname()` once for its whole list, and the
 * layout that renders both does not re-render on a client-side navigation
 * (Next 16 layouts persist — see RailChats' own docblock).
 *
 * Reused verbatim on mobile: MobileDrawer → RailNav → RailChats → here.
 */
export function RailReview({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;

  return (
    <Link
      href={REVIEW_CHAT_ROUTE}
      aria-current={active ? 'page' : undefined}
      className={`vyso-ebb flex items-center gap-2.5 rounded-[10px] px-2.5 py-[9px] text-[13.5px] font-semibold transition-colors ${
        active ? 'bg-white text-[var(--pf-text)]' : 'text-[var(--pf-text)] hover:bg-[#F5F3EF]'
      }`}
      style={{ transitionDuration: 'var(--dur-hover)' }}
    >
      {/* Tick-in-circle: the icon for "there is a decision here", and the only
          one in the rail that implies an outcome rather than a place. `relative`
          so the dot can sit on its corner rather than beside the label. */}
      <span className="relative flex shrink-0 items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </svg>
        <span
          aria-label={reviewDotLabel(count)}
          role="img"
          className="absolute -right-[3px] -top-[3px] h-2 w-2 rounded-full bg-[#D64545] ring-2 ring-white"
        />
      </span>
      Review
    </Link>
  );
}
