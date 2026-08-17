"use client";

import { Fragment } from "react";
import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

import { AUDIT_WEEK, AUDIT_STEPS } from "./audit-content";

/* ── The week, as a rail ─────────────────────────────────────────────────────
   `.ai/plan_phase6b_money_pages.md`: seven dots on a hairline, Mon→Sun, the
   four step labels anchored to their days, stamping in sequence 80ms apart as
   the band enters. It replaces the four-across text strip this section used to
   be, and it is the only thing that moves on the blue band besides the grid
   behind it — the step *prose* is plain server text below, untouched.

   Three decisions worth the ink:

   - **Only the dots and the anchored labels stamp; the prose does not.** A
     reveal that hides sentences is a reveal that hides the page from anyone
     whose JS never runs. The dots are decoration, so `opacity: 0` is safe on
     them and nowhere else here (same trade `Statement.tsx` makes).
   - **The rail is inset 4% at each end.** Dots at 0% and 100% sit on the
     content edge, and a centred `MON` under a dot at 0% hangs off it. The
     inset costs nothing and keeps every label inside the rail.
   - **The anchored labels are left-aligned from their dot, not centred on it.**
     Centring works for a three-letter day and fails for "03 QUANTIFY", which at
     the Monday end would start off-screen. Reading left-to-right from the dot
     is also what a timeline does.

   Reduced motion → the same elements at zero duration, never a different tree:
   see `motion-preference.tsx` on why a branch must change values, not shape. */

/** Where day `i` sits, as a percentage of the rail's width. */
const dayX = (i: number) => 4 + (i * 92) / (AUDIT_WEEK.length - 1);

/** §6's stat-stamp: scale 1.3 → 1, never a count-up. 80ms apart per the plan. */
const STAMP = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };
const STEP_MS = 0.08;

const STEPS_BY_DAY = new Map(AUDIT_STEPS.map((step) => [step.n, step]));

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
          the anchored step labels, and the mobile one has none to reserve —
          keeping the desktop height at 375 left a 56px hole between the sub
          and the dots. */}
      <div className="relative h-[64px] lg:h-[168px]">
        {/* The hairline the dots sit on. */}
        <div
          aria-hidden
          className="absolute left-[4%] right-[4%] top-[16px] h-px bg-fn-blue-300 lg:top-[104px]"
        />

        {AUDIT_WEEK.map((day, i) => {
          const step = day.step ? STEPS_BY_DAY.get(day.step) : undefined;
          return (
            /* A Fragment, not a wrapper: every child below is positioned
               against the rail's own box, and an intervening element (even a
               `display: contents` one) is one more thing to reason about. */
            <Fragment key={day.label}>
              {/* The anchored step label — desktop only. Below `lg` seven
                  labelled columns is 165px each and "03 QUANTIFY" does not
                  fit; the mobile form carries the day on the step block. */}
              {step ? (
                <motion.div
                  className="absolute top-0 hidden lg:block"
                  style={{ left: `${dayX(i)}%` }}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={stamp(i)}
                >
                  <div className="flex items-baseline gap-[8px] whitespace-nowrap font-fn-mono text-[11px] tracking-[0.12em]">
                    <span className="text-fn-blue-mono">{step.n}</span>
                    <span className="text-fn-blue-text">{step.label}</span>
                  </div>
                  {/* The connector down to its dot. 1px, drawn from the label
                      to the rail so the anchoring is stated, not implied. */}
                  <div
                    aria-hidden
                    className="mt-[8px] h-[74px] w-px bg-fn-blue-300 opacity-70"
                  />
                </motion.div>
              ) : null}

              {/* The dot. Step days are solid and larger; the two weekend days
                  and Wednesday are smaller and dimmer — the week has a shape. */}
              <motion.span
                aria-hidden
                className={
                  "absolute top-[16px] block -translate-x-1/2 -translate-y-1/2 rounded-full lg:top-[104px] " +
                  (step
                    ? "h-[10px] w-[10px] bg-fn-blue-text"
                    : "h-[6px] w-[6px] bg-fn-blue-300")
                }
                style={{ left: `${dayX(i)}%` }}
                initial={{ opacity: 0, scale: 1.3 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={stamp(i)}
              >
                <span className="sr-only">{day.label}</span>
              </motion.span>

              <div
                className="absolute top-[30px] -translate-x-1/2 font-fn-mono text-[10px] tracking-[0.12em] text-fn-blue-mono lg:top-[120px] lg:text-[10.5px]"
                style={{ left: `${dayX(i)}%` }}
              >
                <span className="lg:hidden">{day.short}</span>
                <span className="hidden lg:inline">{day.label}</span>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* ── The steps themselves ──────────────────────────────────────────
          Plain server-rendered text in the band. The ids are the `url` targets
          of the HowTo schema (`audit-jsonld.ts`), so they have to exist in the
          DOM exactly once — which is why the rail above carries no ids. */}
      <ol className="m-0 mt-[10px] grid list-none grid-cols-1 gap-[26px] p-0 sm:grid-cols-2 lg:mt-[26px] lg:grid-cols-4 lg:gap-[36px]">
        {AUDIT_STEPS.map((step) => {
          const day = AUDIT_WEEK.find((d) => d.step === step.n);
          return (
            <li
              key={step.n}
              id={`step-${step.n}`}
              className="scroll-mt-[24px] border-t border-fn-blue-300/40 pt-[14px]"
            >
              <div className="mb-[10px] flex items-baseline gap-[8px] font-fn-mono text-[11px] tracking-[0.1em]">
                <span className="text-fn-blue-mono">{step.n}</span>
                <span className="text-fn-blue-text">{step.label}</span>
                {day ? (
                  <span className="ml-auto text-fn-blue-mono lg:hidden">{day.label}</span>
                ) : null}
              </div>
              <p className="m-0 text-[13.5px] leading-[1.6] text-fn-blue-text-2 text-pretty lg:text-[14px]">
                {step.text}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default WeekRail;
