"use client";

import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The scroll reveal for the repositioned pages ─────────────────────────────
   Site repositioning Phase 3.5 (`.ai/plan_site_repositioning.md`, AMENDMENT 2).
   The one reveal `/`, `/industries`, `/industries/hotels`, `/how-we-work` and
   `/operations-audit` use, so a card grid entering on one page enters the same
   way on all five.

   **Transform only by default, and that is not a stylistic preference.**
   `motion` serialises `initial` into the server HTML, so an `opacity: 0`
   initial ships a section that is invisible until JavaScript arrives — the
   exact trade `Statement.tsx` and `FindingDeck` both refused, and these
   wrappers carry the leak cards, the router tiles and the four steps, which
   are the content of the pages rather than decoration on them. A block that
   starts 18px low and never rises is still a readable block.

   `fade` opts a wrapper into the opacity ramp as well, for the handful of
   places where the thing being revealed is genuinely decorative (a caption, a
   rule, an illustration frame) and its absence costs a reader nothing.

   Reduced motion keeps the same `initial` and zeroes the duration rather than
   dropping the prop — dropping it would leave the server's `translateY(18px)`
   on the element with nothing left to animate it away (`motion-preference.tsx`
   has the long version). */

const EASE = [0.22, 1, 0.36, 1] as const;

/* `as` exists for one reason: a reveal wrapped around an `<li>` inside a `<ul>`
   would put a `<div>` between them, which is invalid HTML and — more to the
   point here — drops the list semantics a screen reader announces. A revealed
   list item *is* the list item. */
const TAGS = { div: motion.div, li: motion.li, figure: motion.figure } as const;

export function Reveal({
  children,
  delay = 0,
  y = 18,
  fade = false,
  as = "div",
  id,
  className = "",
}: {
  children: React.ReactNode;
  /** Stagger, in seconds. Grids step by ~0.06 per item, no further than 5. */
  delay?: number;
  y?: number;
  /** Add the opacity ramp. Decorative content only — see the header. */
  fade?: boolean;
  as?: keyof typeof TAGS;
  /** For a revealed element that is also an anchor target — `AuditHour`'s
      `#step-01…04`, which `audit-jsonld.ts` points its `HowToStep` urls at. */
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
      transition={still ? { duration: 0 } : { duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/** The stagger a grid of tiles uses. Re-exported, not declared: it lives in
    `./reveal-stagger`, a module with no `"use client"` directive, because a
    **server** component importing it from here would receive a client
    reference rather than the function. That file has the full account. Client
    components may keep importing it from here; server components must not. */
export { stagger } from "./reveal-stagger";

export default Reveal;
