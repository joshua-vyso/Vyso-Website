"use client";

import { Fragment } from "react";
import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

import { AUDIT_STEPS } from "./audit-content";

/* ── The audit, as a rail ────────────────────────────────────────────────────
   Dots on a hairline with the step labels anchored to them, stamping in
   sequence 80ms apart as the band enters. It replaces the four-across text
   strip this section used to be, and it is the only thing that moves on the
   blue band besides the grid behind it — the step *prose* is plain server text
   below, untouched.

   `.ai/plan_home_only.md`, change 4: the rail used to draw seven days, Mon→Sun,
   with the four steps anchored to the working days, because the audit was a
   paid week. The audit is a free hour now, so there is no week to draw: the
   rail carries the four steps themselves, evenly spaced, and the component
   reads one list instead of two.

   Three decisions worth the ink, unchanged from the seven-day form:

   - **Only the dots and the anchored labels stamp; the prose does not.** A
     reveal that hides sentences is a reveal that hides the page from anyone
     whose JS never runs. The dots are decoration, so `opacity: 0` is safe on
     them and nowhere else here (same trade `Statement.tsx` makes).
   - **The rail is inset 4% at each end.** A dot at 0% sits on the content edge
     and its label hangs off it. The inset costs nothing.
   - **The anchored labels are left-aligned from their dot, not centred on it.**
     Centring fails for "03 FIND", which at the left end would start off-screen.
     Reading left-to-right from the dot is also what a timeline does. The last
     one is the exception and reads *back* to its dot: at 96% a left-aligned
     "04 ROADMAP" measures ~36px past the 1160 rail, which the 40px gutter only
     just absorbs and would not at 1024.

   Reduced motion → the same elements at zero duration, never a different tree:
   see `motion-preference.tsx` on why a branch must change values, not shape. */

/** Where step `i` sits, as a percentage of the rail's width. */
const stepX = (i: number) => 4 + (i * 92) / (AUDIT_STEPS.length - 1);

/** §6's stat-stamp: scale 1.3 → 1, never a count-up. 80ms apart per the plan. */
const STAMP = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };
const STEP_MS = 0.08;

export function WeekRail() {
  const reduceMotion = useStaticMotion();
  const stamp = (i: number) =>
    reduceMotion ? { duration: 0 } : { ...STAMP, delay: i * STEP_MS };

  return (
    <div>
      {/* ── The rail ──────────────────────────────────────────────────────
          Fixed heights rather than flow: every element on it is absolutely
          positioned against a percentage, so the band's height is known before
          the dots arrive and nothing shifts when they do (CLS 0).

          Two heights: the desktop rail reserves 100px above the hairline for
          the anchored step labels, and the mobile one has none to reserve. */}
      <div className="relative h-[40px] lg:h-[144px]">
        {/* The hairline the dots sit on. */}
        <div
          aria-hidden
          className="absolute left-[4%] right-[4%] top-[16px] h-px bg-fn-blue-300 lg:top-[104px]"
        />

        {AUDIT_STEPS.map((step, i) => (
          /* A Fragment, not a wrapper: every child below is positioned
             against the rail's own box, and an intervening element (even a
             `display: contents` one) is one more thing to reason about. */
          <Fragment key={step.n}>
            {/* The anchored step label — desktop only. Below `lg` four labelled
                columns are too narrow for "04 ROADMAP"; the mobile form carries
                the label on the step block below instead. */}
            <motion.div
              className={
                "absolute top-0 hidden lg:block " +
                (i === AUDIT_STEPS.length - 1 ? "-translate-x-full" : "")
              }
              style={{ left: `${stepX(i)}%` }}
              initial={{ opacity: 0, y: 6 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={stamp(i)}
            >
              <div className="flex items-baseline gap-[8px] whitespace-nowrap font-fn-mono text-[11px] tracking-[0.12em]">
                <span className="text-fn-blue-mono">{step.n}</span>
                <span className="text-fn-blue-text">{step.label}</span>
              </div>
              {/* The connector down to its dot. 1px, drawn from the label to
                  the rail so the anchoring is stated, not implied. On the
                  right-aligned last label it hangs off the label's right edge,
                  which is where its dot is. */}
              <div
                aria-hidden
                className={
                  "mt-[8px] h-[74px] w-px bg-fn-blue-300 opacity-70 " +
                  (i === AUDIT_STEPS.length - 1 ? "ml-auto" : "")
                }
              />
            </motion.div>

            <motion.span
              aria-hidden
              className="absolute top-[16px] block h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fn-blue-text lg:top-[104px]"
              style={{ left: `${stepX(i)}%` }}
              initial={{ opacity: 0, scale: 1.3 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={stamp(i)}
            >
              <span className="sr-only">{step.label}</span>
            </motion.span>
          </Fragment>
        ))}
      </div>

      {/* ── The steps themselves ──────────────────────────────────────────
          Plain server-rendered text in the band. The ids are the `url` targets
          of the HowTo schema (`audit-jsonld.ts`), so they have to exist in the
          DOM exactly once — which is why the rail above carries no ids. */}
      <ol className="m-0 mt-[10px] grid list-none grid-cols-1 gap-[26px] p-0 sm:grid-cols-2 lg:mt-[26px] lg:grid-cols-4 lg:gap-[36px]">
        {AUDIT_STEPS.map((step) => (
          <li
            key={step.n}
            id={`step-${step.n}`}
            className="scroll-mt-[24px] border-t border-fn-blue-300/40 pt-[14px]"
          >
            <div className="mb-[10px] flex items-baseline gap-[8px] font-fn-mono text-[11px] tracking-[0.1em]">
              <span className="text-fn-blue-mono">{step.n}</span>
              <span className="text-fn-blue-text">{step.label}</span>
            </div>
            <p className="m-0 text-[13.5px] leading-[1.6] text-fn-blue-text-2 text-pretty lg:text-[14px]">
              {step.text}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default WeekRail;
