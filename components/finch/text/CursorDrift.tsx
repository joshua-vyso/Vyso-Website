"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";

import { useCoarsePointer } from "@/components/finch/ground/use-media-query";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── Cursor parallax ─────────────────────────────────────────────────────────
   The second half of §4.5: "on paper heroes the card and the glow drift 2–4px
   opposite the pointer". The magnetic button is the half that reacts to being
   *approached*; this is the half that gives the hero two planes.

   It is a sibling-friendly primitive rather than a hero-shaped one, because the
   two things that drift live in different grid cells: the glow sits behind the
   left column and the card is in the right one. A single wrapper around both
   would have to be the whole hero, which would drag the headline and the body
   copy into the client for a 3px transform. Two independent instances, each
   reading the same pointer from the window, cost two listeners and keep the
   hero a server component.

   `direction: -1` is what makes them a pair. The card leans toward the pointer
   and the glow away from it, so moving the mouse across the hero opens and
   closes the gap between the two planes — which is the depth cue. Both moving
   the same way would just be the page sliding.

   Off on coarse pointers and under reduced motion, and the listener is only
   attached while the element is actually on screen: a hero four screens up
   should not be doing arithmetic on every mouse move.

   Not counted in the motion budget on purpose. §3 counts things that *loop*;
   this only moves while the reader is moving the pointer, exactly like the
   scroll-linked `Parallax` next to it.                                        */

export type CursorDriftProps = {
  children: React.ReactNode;
  /** Peak displacement in px. §4.5: 2–4. */
  distance?: number;
  /** −1 to lean away from the pointer instead of toward it. */
  direction?: 1 | -1;
  className?: string;
};

export function CursorDrift({
  children,
  distance = 3,
  direction = 1,
  className = "",
}: CursorDriftProps) {
  const reduceMotion = useStaticMotion();
  const coarse = useCoarsePointer();
  const ref = useRef<HTMLDivElement | null>(null);
  const onScreen = useInView(ref, { amount: 0.1 });
  const drifting = !reduceMotion && !coarse && onScreen;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  /* Heavily damped and slow: this is a plane settling, not a thing being
     flicked. The spring is what stops a fast mouse from making the card jitter. */
  const x = useSpring(mx, { stiffness: 90, damping: 26, mass: 0.6 });
  const y = useSpring(my, { stiffness: 90, damping: 26, mass: 0.6 });

  useEffect(() => {
    if (!drifting) {
      mx.set(0);
      my.set(0);
      return;
    }
    const onMove = (event: PointerEvent) => {
      /* Normalised against the viewport, not the element: the pointer's
         position *on the page* is the shared input both drifting planes read,
         so they stay in a fixed relationship to each other however differently
         sized their own boxes are. */
      const nx = (event.clientX / window.innerWidth) * 2 - 1;
      const ny = (event.clientY / window.innerHeight) * 2 - 1;
      mx.set(nx * distance * direction);
      my.set(ny * distance * direction);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [drifting, distance, direction, mx, my]);

  /* `style` is always passed, and the springs rest at 0, so the server and a
     reduced-motion client render the same element with the same transform —
     the rule `motion-preference.tsx` sets out. */
  return (
    <motion.div ref={ref} style={{ x, y }} className={className}>
      {children}
    </motion.div>
  );
}

export default CursorDrift;
