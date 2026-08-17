"use client";

import Image from "next/image";
import { motion, type MotionStyle } from "motion/react";
import { EVENING_BRIEF, type BriefFinding } from "./day-beats";

/* ── The evening brief ───────────────────────────────────────────────────────
   The 17:55 beat of the day strip.

   `BriefPhone` could not be reused directly: its greeting ("Morning. 3 things
   need your attention…"), its status line ("● ONLINE · 06:45") and its bubble
   choreography are hardcoded for the homepage's Monday-morning story. What *is*
   reused is the thing that matters — the three findings themselves
   (`BRIEF_FINDINGS`, via `EVENING_BRIEF`), so the day strip, the evening brief
   and the homepage all carry the same three — and the frame's dimensions,
   radii, shadow and type scale, copied from that component so the two phones
   are recognisably the same object.

   Greeting, findings and the clock on the status line are props so a second
   day (Phase 2's COO-vs-Finch comparison) can tell a different evening without
   a second phone. Every part also takes an optional motion style so the sticky
   stage can land the greeting and the findings one after another.             */

const BUBBLE =
  "rounded-[10px_10px_10px_3px] bg-fn-surface px-[14px] py-[12px] shadow-[0_1px_2px_rgba(20,18,14,0.06)]";

export function DayBriefPhone({
  greeting = EVENING_BRIEF.greeting,
  findings = EVENING_BRIEF.findings,
  time = "17:55",
  greetingStyle,
  findingStyles = [],
}: {
  greeting?: string;
  findings?: readonly BriefFinding[];
  /** The clock on the status line — the moment the message lands. */
  time?: string;
  greetingStyle?: MotionStyle;
  /** One style per finding, in `findings` order. */
  findingStyles?: (MotionStyle | undefined)[];
}) {
  return (
    <div className="w-[300px] rounded-[42px] border border-fn-line-3 bg-fn-surface p-[12px] shadow-[var(--fn-shadow-phone)]">
      <div className="flex flex-col overflow-hidden rounded-[32px] bg-fn-surface-2 pb-[14px]">
        <div className="flex items-center gap-[10px] border-b border-fn-line bg-fn-surface px-[16px] pt-[16px] pb-[12px]">
          <Image
            src="/finch/finch-bird.svg"
            alt=""
            width={30}
            height={30}
            className="h-[30px] w-[30px] rounded-full border border-fn-line bg-fn-bg p-[2px]"
          />
          <div>
            <div className="text-[13.5px] font-semibold">Finch</div>
            <div className="font-fn-mono text-[9.5px] text-fn-blue">● ONLINE · {time}</div>
          </div>
        </div>

        <motion.div
          style={greetingStyle}
          className={`mx-[12px] mt-[14px] text-[13px] leading-[1.5] ${BUBBLE}`}
        >
          {greeting}
        </motion.div>

        {findings.map((finding, i) => (
          <motion.div
            key={finding.label}
            style={findingStyles[i]}
            className={`mx-[12px] mt-[10px] ${BUBBLE}`}
          >
            <div className="mb-[8px] flex items-center gap-[7px]">
              <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange" />
              <span className="font-fn-mono text-[10px] tracking-[0.12em] text-fn-ink-3">
                {finding.label}
              </span>
            </div>
            <div className="mb-[6px] text-[13px] leading-[1.5]">{finding.observation}</div>
            <div className="mb-[8px] text-[15px] font-semibold text-fn-orange-deep">
              {finding.impact}
            </div>
            <span className="rounded-[6px] bg-fn-blue-tint px-[9px] py-[3px] font-fn-mono text-[10.5px] text-fn-blue-deep">
              {finding.chip}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default DayBriefPhone;
