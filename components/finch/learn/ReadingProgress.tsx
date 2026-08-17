"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

/* ── The reading-progress hairline ───────────────────────────────────────────
   `/learn/[slug]`'s signature visual, and the only place on the site it
   appears. One pixel of ink across the top of the viewport, scaled from
   `useScroll`'s document progress.

   Why a hairline and not a bar: the Finch surface already draws structure with
   1px `--fn-line` rules, so progress reads as one more rule that happens to be
   growing. Ink, not orange — orange is reserved for agent activity and CTAs
   (`.ai/vyso_v2.md` §1), and a reading indicator is neither.

   Reduced motion → nothing rendered at all, per the plan. That is stricter
   than the usual "static end state" rule and deliberately so: the end state of
   a progress bar is a full-width line that means nothing, and the information
   it carries is already in the scrollbar.

   SSR-safe: the element renders at `scaleX: 0` — a zero-width, fixed-position
   line — so the server and the first client paint agree and nothing shifts.  */

export function ReadingProgress() {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  /* A spring, not the raw value: raw `scrollYProgress` tracks a trackpad's
     sub-pixel jitter and a 1px line makes that visible as a shimmer. */
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 40,
    restDelta: 0.001,
  });

  if (reduceMotion) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-px origin-left bg-fn-ink"
    />
  );
}

export default ReadingProgress;
