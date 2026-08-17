"use client";

import { motion, useReducedMotion } from "motion/react";

/* ── The score gauge ─────────────────────────────────────────────────────────
   A half-circle arc that draws to the score in 600ms ease-out, with the number
   stamping (scale 1.3 → 1) as it lands. The arc is blue, not orange: on this
   surface orange means agent activity or a primary CTA, and a score is
   evidence — the same reason the finding card's evidence chip is blue.

   Reduced motion gets the end state with no draw and no stamp: `initial={false}`
   tells motion to skip straight to `animate`, which is the static gauge the
   standing rules ask for. The whole thing is one inline SVG, so there is no
   layout shift between the static and animated forms.                        */

/** Half circle, centre (110, 112), radius 92 — 180° on the left to 0° on the right. */
const ARC = "M 18 112 A 92 92 0 0 1 202 112";

export function ScoreGauge({
  score,
  riskLabel,
  riskTone,
}: {
  /** 0–100, already rounded by the scoring logic. */
  score: number;
  riskLabel: string;
  /** "alert" borrows the finding card's NEW chip colours; "quiet" is muted ink. */
  riskTone: "alert" | "quiet";
}) {
  const reduceMotion = useReducedMotion();
  const fraction = Math.max(0, Math.min(1, score / 100));

  return (
    <div className="flex flex-col items-center gap-[18px] sm:flex-row sm:items-end sm:gap-[28px]">
      <div className="relative w-[220px] shrink-0">
        <svg viewBox="0 0 220 132" className="block w-full" role="img" aria-label={`Operations score ${score} out of 100`}>
          <path d={ARC} fill="none" stroke="var(--fn-line)" strokeWidth={10} strokeLinecap="round" />
          <motion.path
            d={ARC}
            fill="none"
            stroke="var(--fn-blue)"
            strokeWidth={10}
            strokeLinecap="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: fraction }}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
          />
          <text x="18" y="128" className="font-fn-mono" fontSize="10" fill="var(--fn-faint)">
            0
          </text>
          <text x="202" y="128" textAnchor="end" className="font-fn-mono" fontSize="10" fill="var(--fn-faint)">
            100
          </text>
        </svg>

        {/* Absolutely placed rather than an SVG <text>: the number is typeset in
            the page's serif, and matching font metrics inside the SVG viewBox
            is more fragile than sitting a div on top of it. */}
        <motion.div
          className="pointer-events-none absolute inset-x-0 bottom-[16px] text-center"
          initial={reduceMotion ? false : { opacity: 0, scale: 1.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
        >
          <span className="font-fn-serif text-[46px] font-medium leading-none tracking-[-0.03em] text-fn-ink">
            {score}
          </span>
          <span className="font-fn-mono text-[12px] text-fn-faint"> / 100</span>
        </motion.div>
      </div>

      <div className="pb-[6px] text-center sm:text-left">
        <div className="mb-[10px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
          YOUR OPERATIONS SCORE
        </div>
        <span
          className="inline-block rounded-[99px] border px-[11px] py-[4px] font-fn-mono text-[10.5px] tracking-[0.1em]"
          style={
            riskTone === "alert"
              ? { color: "var(--fn-orange-deep)", borderColor: "var(--fn-orange-tint)" }
              : { color: "var(--fn-ink-3)", borderColor: "var(--fn-line)" }
          }
        >
          {riskLabel.toUpperCase()} RISK
        </span>
      </div>
    </div>
  );
}

export default ScoreGauge;
