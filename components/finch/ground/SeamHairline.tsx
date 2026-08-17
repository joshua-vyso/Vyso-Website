"use client";

import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The orange→blue hairline ────────────────────────────────────────────────
   §2's seam accent and §4.4's band-enter choreography, which are the same
   graphic seen twice: a 3px rule in `--fn-grad` that **draws** left-to-right
   over the same 500ms the Statement's words are rising. It is the one piece of
   the orange→blue gradient allowed outside the homepage's single ribbon, and
   §2 rules it to **once per page**.

   Two implementation notes worth the ink:

   - **`scaleX` from a left origin, not a width animation.** A width tween
     relayouts the rule 30 times a second; a transform is composited. The
     gradient is painted at full width and then revealed, so the colour ramp
     does not slide during the draw — the line grows into a finished gradient
     rather than stretching a two-stop one.
   - **The initial state is `scaleX: 0`, which is safe to serialise.** Unlike
     `opacity: 0` on a headline (see `Statement.tsx`), a hairline that never
     animates because JS never ran is a hairline nobody misses. It is
     decoration; the words are not.                                            */

export type SeamHairlineProps = {
  /** Rule width. `full` for a band-top seam, a Tailwind width for a short
      accent under a Statement. */
  className?: string;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export function SeamHairline({ className = "w-[120px]" }: SeamHairlineProps) {
  const reduceMotion = useStaticMotion();

  return (
    <motion.div
      aria-hidden
      className={"h-[3px] origin-left rounded-[2px] " + className}
      style={{ background: "var(--fn-grad)" }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE }}
    />
  );
}

export default SeamHairline;
