"use client";

import { motion, useReducedMotion } from "motion/react";

/* ── The South Africa map ────────────────────────────────────────────────────
   `/south-africa`'s signature visual: a quiet, hand-drawn-simplified outline
   of the country (straight-segment polygon, not a real projection or a map
   library — the plan explicitly allows this) with one pulse at Johannesburg.
   The pulse is a single expanding ring that fades out once on enter, leaving
   a plain static dot behind — not a loop, and not the site's continuous
   "agent activity" pulse (`fn-pulse` in `FindingCard.tsx`), which is reserved
   for a live finding. Reduced motion → the ring never draws; the dot is
   there from the first paint. */
export function SouthAfricaMap() {
  const reduceMotion = useReducedMotion() ?? false;

  // Johannesburg, positioned inside the outline below — interior, north-east
  // of centre, matching its real place relative to the coastline.
  const jhb = { x: 232, y: 142 };

  return (
    <svg
      viewBox="0 0 400 380"
      role="img"
      aria-label="Simplified outline of South Africa with a marker at Johannesburg"
      className="h-auto w-full max-w-[360px]"
    >
      <path
        d="M 70 40 L 160 30 L 230 35 L 300 60 L 340 110 L 355 170 L 345 230 L 300 300 L 240 345 L 160 355 L 90 330 L 55 270 L 40 190 L 45 120 Z"
        fill="none"
        stroke="var(--fn-line-3)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* The static dot — present from first paint, reduced motion or not. */}
      <circle cx={jhb.x} cy={jhb.y} r="4" fill="var(--fn-orange)" />

      {/* The one pulse. `initial="off"` under reduced motion so it never
          draws at all — not "plays instantly," genuinely absent. */}
      {!reduceMotion ? (
        <motion.circle
          cx={jhb.x}
          cy={jhb.y}
          r="4"
          fill="none"
          stroke="var(--fn-orange)"
          strokeWidth="1.5"
          initial={{ scale: 1, opacity: 0.7 }}
          whileInView={{ scale: 4.5, opacity: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
          style={{ transformOrigin: `${jhb.x}px ${jhb.y}px` }}
        />
      ) : null}

      <text
        x={jhb.x + 12}
        y={jhb.y + 4}
        fontFamily="var(--font-fn-mono), 'IBM Plex Mono', ui-monospace, monospace"
        fontSize="10.5"
        letterSpacing="0.08em"
        fill="var(--fn-ink-2)"
      >
        JOHANNESBURG
      </text>
    </svg>
  );
}

export default SouthAfricaMap;
