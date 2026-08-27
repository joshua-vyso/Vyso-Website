"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The rail that fills as you read ─────────────────────────────────────────
   Site repositioning Phase 3.5 (AMENDMENT 2). `/how-we-work` is four steps
   "always in this order", and Phase 3 drew them as four stacked text blocks
   with a hairline between — which says "four things" but not "in this order".

   This is the order, drawn: a 2px track down the left of the list with an
   orange→blue gradient filling it as the reader descends. It is the same two
   hues `--fn-grad` runs between and the same direction of travel as the
   reading, so the fill *is* the progress rather than a decoration next to it.

   Three things keep it honest:

   - **`scaleY` from a top origin, not a height.** A height tween relayouts the
     rule on every frame; a transform is composited. The gradient is painted at
     full height and then revealed, so the ramp does not slide during the fill.
   - **It measures its own box.** `useScroll` targets the rail element, which
     spans the list by `inset-y-0`, so the component works wherever it is
     dropped and needs no ref threaded down from the page.
   - **Reduced motion gets the *finished* rail, not a frozen empty one.**
     `scaleY: 1`, same element, same style, different range — the contract
     `motion-preference.tsx` sets out. An unfilled track under reduced motion
     would be a graphic that is permanently wrong.

   `aria-hidden`: the ordered list underneath is already an ordered list, and a
   progress bar for prose is not information a screen reader wants.            */

export function ScrollRail({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const still = useStaticMotion();
  /* `start 70%` → the fill begins when the list's top is 70% down the
     viewport, i.e. as the first step comes into reading position; `end 80%`
     → it completes as the last one does, rather than only once the list has
     left the screen entirely. */
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 80%"] });
  const scaleY = useTransform(scrollYProgress, [0, 1], still ? [1, 1] : [0, 1]);

  return (
    <div aria-hidden className={"pointer-events-none absolute inset-y-0 w-[2px] " + className} ref={ref}>
      <span className="absolute inset-0 rounded-[2px] bg-fn-line" />
      <motion.span
        className="absolute inset-0 origin-top rounded-[2px]"
        style={{
          scaleY,
          background: "linear-gradient(180deg, var(--fn-orange), var(--fn-blue))",
        }}
      />
    </div>
  );
}

export default ScrollRail;
