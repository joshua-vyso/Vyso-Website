"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll } from "motion/react";

/* ── The timeline hairline ────────────────────────────────────────────────────
   `/about`'s one signature visual: a vertical line that draws downward as the
   section scrolls through view, with milestones revealing beside it. Nothing
   here is decorative-only: the draw is tied to `scrollYProgress` on this
   section (motion principle §1.2 — scroll-linked storytelling only where the
   section IS the story), and every milestone is a fact this repo can back up.

   Dates: only one milestone carries a date ("August 2026", month-precision —
   the homepage/pricing rebuild this very phase-1 work landed, dated from git
   history and this repo's own `sitemap.ts` `lastModified` entries). The rest
   are real but undated, per `.ai/vyso_v2.md` §2.3 ("milestones — ONLY dated
   if the date is real … otherwise undated"). No invented founding date, no
   invented revenue or client-count figures.

   Reduced motion → the line renders already drawn (scaleY locked to 1, no
   scroll-linked animation) and each milestone renders in its final state —
   the "reduced motion → drawn timeline" rule from the phase-3 plan. */

type Milestone = { label: string; date?: string; body: string };

const MILESTONES: Milestone[] = [
  {
    label: "Vyso starts as an operations partner for South African food businesses",
    body: "Operations audits and hands-on automation for restaurants, wholesalers, farms and food producers running on WhatsApp and spreadsheets.",
  },
  {
    label: "Turn 'n Slice becomes Vyso's first founding customer",
    body: "A Johannesburg food business. OrderFlow is already replacing QuickBooks as its invoicing system — price lists, customer accounts, quotes, orders and payments in one place.",
  },
  {
    label: "The homepage and pricing move to Finch",
    date: "August 2026",
    body: "One offer — R6,000 per location per month, everything included — and the Operations Audit as the front door. Finch becomes the name for what the agents do.",
  },
  {
    label: "Founding client terms open",
    body: "Setup waived, first month free, rate locked — for the operators who come on while the cohort is still small.",
  },
];

export function AboutTimeline() {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.55"],
  });

  return (
    <div ref={ref} className="relative pl-[26px] lg:pl-[34px]">
      {/* The hairline's track — always visible, so the drawn line has
          something to draw onto rather than appearing from nothing. */}
      <div aria-hidden className="absolute left-0 top-[6px] bottom-[6px] w-px bg-fn-line-2" />
      <motion.div
        aria-hidden
        className="absolute left-0 top-[6px] bottom-[6px] w-px origin-top bg-fn-orange-cta"
        style={{ scaleY: reduce ? 1 : scrollYProgress }}
      />

      <div className="flex flex-col gap-[36px] lg:gap-[44px]">
        {MILESTONES.map((milestone, i) => (
          <motion.div
            key={milestone.label}
            className="relative"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.38, ease: "easeOut", delay: reduce ? 0 : i * 0.06 }}
          >
            <span
              aria-hidden
              className="absolute -left-[30px] top-[5px] h-[9px] w-[9px] rounded-full bg-fn-orange-cta lg:-left-[38px]"
            />
            {milestone.date ? (
              <div className="mb-[6px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-muted">
                {milestone.date.toUpperCase()}
              </div>
            ) : null}
            <div className="mb-[6px] font-fn-serif text-[18px] font-medium leading-[1.3] tracking-[-0.01em] text-fn-ink lg:text-[19.5px]">
              {milestone.label}
            </div>
            <p className="m-0 max-w-[520px] text-[14.5px] leading-[1.65] text-fn-ink-3">
              {milestone.body}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default AboutTimeline;
