"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring } from "motion/react";

import { useCoarsePointer } from "@/components/finch/ground/use-media-query";
import { useStaticMotion } from "@/components/finch/motion-preference";
import { track, type AnalyticsEvent, type AnalyticsEvents } from "@/lib/analytics";

/* Created once at module scope. `motion.create()` inside the component would
   hand React a new component type on every render and remount the button —
   which, for a magnetic button, means dropping the spring mid-pull. */
const MotionLink = motion.create(Link);

/* ── Magnetic CTA ────────────────────────────────────────────────────────────
   §4.5: a primary button pulls at most 10px toward the pointer within a 120px
   radius and springs back on leave. The cheapest premium tell there is, and the
   only cursor-reactive thing on the site — §4's "never" list rules out text
   following the cursor, so this is where that budget goes.

   The pull is **capped and falls off with distance**: at the edge of the radius
   it is zero, at the centre it is `PULL`, and it never exceeds `PULL` however
   fast the pointer moves. A magnetic button that can be dragged anywhere stops
   reading as a button.

   `pointermove` on the element, not the window: outside a 120px radius there is
   nothing to compute, and the browser already knows which element the pointer
   is over. The listener area is the button plus its own padding — the radius
   check then decides how much of that turns into movement.

   Off on coarse pointers (a pull nobody can see still costs a listener and a
   spring) and off under reduced motion, where the button is a plain button.    */

/* ── Analytics ───────────────────────────────────────────────────────────────
   `TrackedLink` exists because a `track()` call needs an `onClick` and most
   Finch CTAs live in server components. This component is *already* a client
   component, so it carries the same pair itself rather than making every 6b
   page nest a magnetic button inside a tracked link — which would have put two
   anchors around one label.

   A union, not two optional fields: `event` and `eventProps` are meaningless
   apart, and this is what makes passing one without the other a compile error
   while leaving an untracked button (a form submit, an in-page scroll) with no
   analytics props to write at all. */
type Tracking<E extends AnalyticsEvent> =
  | { event: E; eventProps: AnalyticsEvents[E] }
  | { event?: undefined; eventProps?: undefined };

export type MagneticButtonProps<E extends AnalyticsEvent = AnalyticsEvent> = {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  /** For a CTA on a dark band — the secondary outline needs the light hairline.
      `ink` is the one ground where orange is the background, not the button —
      the gradient CTA tiles (round 3): orange-on-gradient risks
      orange-on-orange in the tile's warm half. */
  tone?: "paper" | "dark" | "ink";
  className?: string;
  type?: "button" | "submit";
  /** A form mid-POST. A disabled magnet is a control that moves and cannot be
      pressed, so this switches the pull off with the button. */
  disabled?: boolean;
  /** Peak pull in px. §4.5's number is 10 and that is the default; a
      **full-width** button wants less, because 10px on a control whose edges
      are flush with a card reads as misalignment rather than as magnetism. */
  pull?: number;
} & Tracking<E>;

const PULL = 10;
const RADIUS = 120;

const BASE =
  "relative inline-flex min-h-[44px] items-center justify-center rounded-[9px] px-[26px] py-[14px] " +
  "text-[15.5px] font-semibold transition-colors duration-150";

const VARIANT = {
  primary: {
    paper: "bg-fn-orange-cta text-[#FFF7F0] hover:bg-fn-orange-deep hover:text-white",
    dark:  "bg-fn-orange-cta text-[#FFF7F0] hover:bg-fn-orange-deep hover:text-white",
    /* `--fn-ink` fill, `--fn-ink-text` text, `--fn-ink-fill` (`#1B1915`, the
       same fill `FindingCard`'s `ink` variant already uses) on hover — a
       fourth CTA colour would have been a new decision; this reuses the ink
       ramp's own values instead. */
    ink:   "bg-fn-ink text-fn-ink-text hover:bg-fn-ink-fill",
  },
  secondary: {
    paper: "border border-fn-line-3 text-fn-ink hover:border-fn-line-hover",
    dark:  "border border-fn-ink-line text-fn-ink-text hover:border-fn-orange-on-ink",
    ink:   "border border-fn-ink-line text-fn-ink-text hover:border-fn-orange-on-ink",
  },
} as const;

export function MagneticButton<E extends AnalyticsEvent = AnalyticsEvent>({
  children,
  href,
  onClick,
  variant = "primary",
  tone = "paper",
  className = "",
  type = "button",
  disabled = false,
  pull = PULL,
  event,
  eventProps,
}: MagneticButtonProps<E>) {
  const reduceMotion = useStaticMotion();
  const coarse = useCoarsePointer();
  const magnetic = !reduceMotion && !coarse && !disabled;

  const ref = useRef<HTMLElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  /* Underdamped but not bouncy: it should feel like the button is being pulled
     through something, not like it is on a spring. */
  const x = useSpring(mx, { stiffness: 260, damping: 22, mass: 0.4 });
  const y = useSpring(my, { stiffness: 260, damping: 22, mass: 0.4 });

  const onPointerMove = useCallback(
    /* `pointer`, not `event`: `event` is now a prop on this component (the
       analytics one) and a shadowed name here would read as if the handler
       were doing something with it. */
    (pointer: React.PointerEvent<HTMLElement>) => {
      if (!magnetic) return;
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const dx = pointer.clientX - (box.left + box.width / 2);
      const dy = pointer.clientY - (box.top + box.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > RADIUS) {
        mx.set(0);
        my.set(0);
        return;
      }
      /* Linear falloff to zero at the radius, then normalised so the pull is
         directional but never longer than PULL. */
      const strength = (1 - dist / RADIUS) * pull;
      const norm = dist === 0 ? 0 : strength / dist;
      mx.set(dx * norm);
      my.set(dy * norm);
    },
    [magnetic, mx, my, pull],
  );

  const onPointerLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  /* Fired before navigation, exactly as `TrackedLink` does it — `track()`
     no-ops on the server and before hydration, so there is nothing to guard. */
  const handleClick = useCallback(() => {
    if (event !== undefined) track(event, eventProps as AnalyticsEvents[E]);
    onClick?.();
  }, [event, eventProps, onClick]);

  const classes = [BASE, VARIANT[variant][tone], className].filter(Boolean).join(" ");
  /* A route gets `next/link` (client navigation, so `RouteFade`'s 220ms
     crossfade plays instead of a white flash); a hash or an external URL gets a
     plain anchor, because neither is a route transition. 6b routes its tracked
     CTAs through here rather than `TrackedLink`, so `onClick` has to survive
     both branches — that is where the `track()` call lives. */
  const internal = href !== undefined && href.startsWith("/");
  /* Always passed, never conditional: the springs rest at 0, so a
     non-magnetic button renders identically, and the server and the client
     agree on the element's shape (see `motion-preference.tsx`). `magnetic`
     gates the pointer handler, which is where the cost actually is. */
  const style = { x, y };

  if (href && internal) {
    return (
      <MotionLink
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        onClick={handleClick}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={style}
        className={classes}
      >
        {children}
      </MotionLink>
    );
  }

  if (href) {
    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        onClick={handleClick}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={style}
        className={classes}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={style}
      className={classes}
    >
      {children}
    </motion.button>
  );
}

export default MagneticButton;
