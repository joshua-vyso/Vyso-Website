"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

import { useBudgetEntry } from "./motion-budget";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The glow ────────────────────────────────────────────────────────────────
   §3.4, and the cheapest device by an order of magnitude: one radial gradient,
   240–320px, drifting on a 12s ease-in-out loop. This is what Linear and Attio
   spend their entire hero motion budget on (§1.1), which is the point — the
   homepage hero gets this and nothing else.

   No `filter: blur`. A radial gradient with a soft alpha ramp *is* a blur, done
   by the compositor for free; `blur()` on a 320px box costs a real filter pass
   every frame and, on the paper ground, would put a blurred surface behind
   content, which the standing guardrails rule out outright.

   Never combined with a grid, wave or facet plane in the same band (§3.4).      */

export type GlowProps = {
  tone?: "orange" | "blue";
  /** Diameter in px. §3.4: 240–320. */
  size?: number;
  /** How far it wanders, in px. Kept small — this is a light source shifting,
      not a shape moving. */
  travel?: number;
  className?: string;
};

const TONE = {
  /* 18% orange / 14% blue, per §3.4. Written as a two-stop radial so the
     falloff is smooth to fully transparent — a single-stop gradient leaves a
     visible disc edge on the ink ground. */
  orange: "radial-gradient(circle, rgba(255,119,39,0.18) 0%, rgba(255,119,39,0.07) 45%, rgba(255,119,39,0) 70%)",
  blue:   "radial-gradient(circle, rgba(75,150,221,0.14) 0%, rgba(75,150,221,0.06) 45%, rgba(75,150,221,0) 70%)",
} as const;

export function Glow({ tone = "orange", size = 300, travel = 26, className = "" }: GlowProps) {
  const reduceMotion = useStaticMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const onScreen = useInView(ref, { amount: 0.1 });
  const drifting = !reduceMotion && onScreen;
  useBudgetEntry("Glow", drifting);

  return (
    <div ref={ref} className={"pointer-events-none absolute " + (className || "inset-0")}>
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2"
        style={{
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          background: TONE[tone],
        }}
        /* A three-key loop rather than two: a two-key drift retraces its own
           path and reads as a pendulum. Three keys with different x/y phases
           trace a slow lissajous, which reads as light moving. */
        animate={drifting ? { x: [0, travel, -travel * 0.6, 0], y: [0, -travel * 0.7, travel * 0.5, 0] } : undefined}
        transition={drifting ? { duration: 12, repeat: Infinity, ease: "easeInOut" } : undefined}
      />
    </div>
  );
}

export default Glow;
