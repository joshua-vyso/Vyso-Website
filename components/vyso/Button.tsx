import Link from "next/link";

import type { AnalyticsEvent, AnalyticsEvents } from "@/lib/analytics";
import { TrackedLink } from "@/components/finch/TrackedLink";

/* ── The button ──────────────────────────────────────────────────────────────
   ONE filled style on the whole site, repeated verbatim: solid `--vy-ink`, white
   text, 10px radius. That is the Attio/Kinso pattern the research settled on
   (rule 1: "one primary action, repeated verbatim") and it is why the burnt
   orange accent can stay rationed to what happens inside a demo — the CTA never
   competes with it, because the CTA has no hue at all.

   Secondary is the SAME geometry with the fill removed, so the difference
   between "start the audit" and "read how it works" is weight, not shape.
   `quiet` is the plain text link with an arrow, for the third-tier action that
   sits beside a primary CTA rather than under it.

   ── Server component, and it stays one ──────────────────────────────────────
   Most CTAs live in server-rendered sections, and `track()` needs an `onClick`,
   which needs the client. Passing `event`/`eventProps` swaps the `<Link>` for
   `TrackedLink` — a client component a server component may render — so the
   surrounding page is never dragged across the boundary just to count a click.
   Without those props nothing client-side is emitted at all. */

export type ButtonVariant = "primary" | "secondary" | "quiet";
/** `sm` is the nav's size and only the nav's: a header button that matches a
    hero CTA crowds a 375px row out of its own wordmark. Page CTAs are `md`, and
    a section's single closing action is `lg`. */
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-[8px] font-medium " +
  "transition-colors duration-150 " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vy-focus)]";

/* Radius is `--vy-radius` on every variant. The system has two radii and a
   button is never the pill (plan §4: pills are eyebrows and status chips). */
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "rounded-[var(--vy-radius)] bg-[color:var(--vy-ink)] text-[color:var(--vy-bg)] hover:bg-[color:var(--vy-ink-2)]",
  secondary:
    "rounded-[var(--vy-radius)] border border-[color:var(--vy-line-2)] bg-transparent " +
    "text-[color:var(--vy-ink)] hover:border-[color:var(--vy-ink-3)] hover:bg-[color:var(--vy-surface)]",
  quiet:
    "rounded-[var(--vy-radius)] text-[color:var(--vy-ink-2)] hover:text-[color:var(--vy-ink)]",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-[13px] py-[8px] text-[13px]",
  md: "px-[18px] py-[10px] text-[14px]",
  lg: "px-[24px] py-[14px] text-[15px]",
};

/* `quiet` carries no fill and no border, so the horizontal padding a filled
   button needs would push it visibly out of line with the text beside it. */
const QUIET_SIZE: Record<ButtonSize, string> = {
  sm: "px-0 py-[8px] text-[13px]",
  md: "px-0 py-[10px] text-[14px]",
  lg: "px-0 py-[14px] text-[15px]",
};

type ButtonProps<E extends AnalyticsEvent> = {
  href: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Fire a typed analytics event on click. Supplying it swaps in the client
      `TrackedLink`; omitting it keeps the link pure server markup. */
  event?: E;
  eventProps?: AnalyticsEvents[E];
  /** Trailing glyph. `quiet` defaults to an arrow because a text link with no
      affordance at all reads as body copy. */
  arrow?: boolean;
  className?: string;
};

export function Button<E extends AnalyticsEvent>({
  href,
  children,
  variant = "primary",
  size = "md",
  event,
  eventProps,
  arrow,
  className = "",
}: ButtonProps<E>) {
  const showArrow = arrow ?? variant === "quiet";
  const classes = [
    BASE,
    VARIANT[variant],
    variant === "quiet" ? QUIET_SIZE[size] : SIZE[size],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const body = (
    <>
      {children}
      {showArrow ? (
        <span aria-hidden="true" className="translate-y-[0.5px]">
          →
        </span>
      ) : null}
    </>
  );

  if (event && eventProps) {
    return (
      <TrackedLink href={href} event={event} eventProps={eventProps} className={classes}>
        {body}
      </TrackedLink>
    );
  }

  return (
    <Link href={href} className={classes}>
      {body}
    </Link>
  );
}

export default Button;
