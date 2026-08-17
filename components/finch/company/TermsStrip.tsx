"use client";

import { motion, useReducedMotion } from "motion/react";

/* ── The terms strip ─────────────────────────────────────────────────────────
   `/founding-client`'s opening beat: the three founding terms, revealing
   left→right on enter. Each cell fades and slides in from 8px, staggered
   120ms apart across the row — the same reveal-on-enter idiom as the rest of
   the site (opacity 0→1, y 8→0, once), just walked left to right instead of
   the usual top-to-bottom stagger, because these three terms are read in
   that order ("setup waived, first month free, rate locked" is a sequence,
   not a set). Reduced motion → all three render at their finished state
   immediately, no motion at all.

   `FOUNDING_TERMS` is imported straight from `pricing-data.ts` by
   `lib/marketing/founding.ts` — the same three strings `/pricing`'s hero
   shows, so the founding terms can never say something different on the two
   pages that state them. */
export function TermsStrip({ terms }: { terms: readonly string[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col divide-y divide-fn-line-2 border-y border-fn-line lg:flex-row lg:divide-x lg:divide-y-0">
      {terms.map((term, i) => (
        <motion.div
          key={term}
          className="flex-1 px-[20px] py-[20px] lg:py-[26px]"
          initial={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.38, ease: "easeOut", delay: reduceMotion ? 0 : i * 0.12 }}
        >
          <div className="mb-[8px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-orange-deep">
            FOUNDING TERM {i + 1}
          </div>
          <div className="text-[16px] font-medium text-fn-ink">{term}</div>
        </motion.div>
      ))}
    </div>
  );
}

export default TermsStrip;
