"use client";

import { motion, type MotionStyle } from "motion/react";
import { FindingCardFrame } from "../FindingCard";
import type { DayBeat } from "./day-beats";

/* One beat of the COO's day, as a compact finding card.

   It reuses `FindingCardFrame` (border, orange state bar, shadow, hover lift)
   but writes its own header row: the standalone card's header carries a
   NEW/IN PROGRESS chip on the right, and here that slot belongs to the time —
   the time is what ties the card to the clock underneath.

   `style` is a motion style so the sticky stage can drive opacity/scale from
   scroll progress; every other caller passes nothing and gets a static card. */
export function DayCard({
  beat,
  style,
  className = "",
  compact = false,
}: {
  beat:       DayBeat;
  style?:     MotionStyle;
  className?: string;
  /** The 5-across static row: same card, one notch down in type. */
  compact?:   boolean;
}) {
  return (
    <motion.div style={style} className={className}>
      <FindingCardFrame tilt={false} className="h-full">
        <div className="mb-[12px] flex items-center gap-[8px]">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-fn-orange" />
          <span className="font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-ink-3">
            {beat.agent}
          </span>
          <span className="ml-auto font-fn-mono text-[10.5px] tracking-[0.08em] text-fn-muted-2">
            {beat.time}
          </span>
        </div>
        <div
          className={
            (compact ? "text-[14px] " : "text-[15px] lg:text-[15.5px] ") +
            "mb-[10px] leading-[1.45] text-fn-ink"
          }
        >
          {beat.observation}
        </div>
        <div
          className={
            (compact ? "text-[16px] " : "text-[18px] ") +
            "mb-[12px] font-semibold tracking-[-0.01em] text-fn-orange-deep"
          }
        >
          {beat.impact}
        </div>
        <span className="inline-block whitespace-nowrap rounded-[6px] bg-fn-blue-tint px-[9px] py-[4px] font-fn-mono text-[10.5px] text-fn-blue-deep">
          {beat.evidence}
        </span>
      </FindingCardFrame>
    </motion.div>
  );
}

export default DayCard;
