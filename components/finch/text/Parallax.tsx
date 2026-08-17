"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── Depth parallax ──────────────────────────────────────────────────────────
   §4.2: across a viewport pass the background layer moves at 1.10×, the
   headline at 0.94× and the card at 1.00×, so the three planes separate by
   roughly 20px. That separation is the whole effect — it is a depth cue, not a
   slide, and anything bigger reads as the page coming apart.

   `SPREAD = 200` is what turns a speed into pixels: displacement is
   `(speed − 1) × 200`, so 1.10 travels ±20px and 0.94 travels ∓12px across the
   element's full pass through the viewport. §4.2's "~20px" is therefore the
   literal number this produces, not an approximation of it.

   Scroll progress is measured against **this element's own** pass through the
   viewport rather than the band's, which means a `Parallax` works wherever it
   is dropped and never needs a ref threaded down from its section. */

export type ParallaxProps = {
  children: React.ReactNode;
  /** §4.2's three planes. Anything between 0.85 and 1.15 behaves sensibly. */
  speed?: 0.94 | 1.0 | 1.1 | number;
  className?: string;
};

const SPREAD = 200;

export function Parallax({ children, speed = 1, className = "" }: ParallaxProps) {
  const reduceMotion = useStaticMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });

  /* Faster-than-scroll layers start low and end high — the same direction the
     scroll is already going, only more of it. A 1.00 plane and a reduced-motion
     plane are the same thing: a range of zero. Deliberately not an early return
     of a plain `<div>` — swapping the element type between the server render
     and the client's reduced-motion render is a hydration mismatch, and it
     would strand whatever transform the server serialised. */
  const distance = reduceMotion ? 0 : (speed - 1) * SPREAD;
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

export default Parallax;
