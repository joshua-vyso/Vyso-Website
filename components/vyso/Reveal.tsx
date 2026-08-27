"use client";

import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The one scroll reveal on the Vyso surface ───────────────────────────────
   Ported from `components/finch/site/Reveal.tsx` with calmer numbers, so a card
   grid entering on the homepage enters the same way on every other page.

   **Transform only by default, and that is not a stylistic preference.**
   `motion` serialises `initial` into the server HTML, so an `opacity: 0`
   initial ships a section that is INVISIBLE until JavaScript arrives. These
   wrappers carry the actual content of the pages, not decoration on them, and a
   block that starts 12px low and never rises is still a readable block. `fade`
   opts a wrapper into the opacity ramp for the handful of places where the
   thing being revealed is genuinely decorative (a caption, a rule, a frame) and
   its absence costs a reader nothing.

   The design system's motion budget (plan §4): translate ≤16px, stagger ≤80ms,
   no parallax, everything gated on reduced motion. 12px is the default here
   because the ceiling is a ceiling, not a target.

   Reduced motion keeps the same `initial` and zeroes the DURATION rather than
   dropping the prop — dropping it would leave the server's `translateY(12px)`
   on the element with nothing left to animate it away. `useStaticMotion` reads
   both the OS setting and the `/design` emulation toggle through a
   `useSyncExternalStore`, so there is no hydration mismatch; its docblock has
   the long version. */

const EASE = [0.22, 1, 0.36, 1] as const;

/* `as` exists for one reason: a reveal wrapped around an `<li>` inside a `<ul>`
   would put a `<div>` between them, which is invalid HTML and drops the list
   semantics a screen reader announces. A revealed list item *is* the list
   item. */
const TAGS = { div: motion.div, li: motion.li, figure: motion.figure } as const;

export function Reveal({
  children,
  delay = 0,
  y = 12,
  fade = false,
  as = "div",
  id,
  className = "",
}: {
  children: React.ReactNode;
  /** Stagger, in seconds. Use `stagger(i)` rather than doing the sum by hand. */
  delay?: number;
  /** Travel, in px. The system's ceiling is 16; anything more is a different
      design system. */
  y?: number;
  /** Add the opacity ramp. Decorative content only — see the header. */
  fade?: boolean;
  as?: keyof typeof TAGS;
  /** For a revealed element that is also an anchor target. */
  id?: string;
  className?: string;
}) {
  const still = useStaticMotion();
  const Tag = TAGS[as];
  const initial = fade ? { opacity: 0, y } : { y };
  const target = fade ? { opacity: 1, y: 0 } : { y: 0 };

  return (
    <Tag
      id={id}
      className={className}
      initial={initial}
      whileInView={target}
      viewport={{ once: true, amount: 0.15 }}
      transition={still ? { duration: 0 } : { duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/** The stagger a grid of tiles uses. Re-exported, not declared: it lives in
    `./stagger`, a module with no `"use client"` directive, because a **server**
    component importing it from here would receive a client reference rather
    than the function. Client components may import it from either place. */
export { stagger } from "./stagger";

export default Reveal;
