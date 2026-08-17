"use client";

import { motion, useReducedMotion } from "motion/react";

/* ── The seat grid ────────────────────────────────────────────────────────────
   `/academy`'s signature visual: 12 quiet circles. SSR renders every seat
   hollow — there is no server-side count to seed with, and `.ai/vyso_v2.md`
   §2.3 is explicit that this must never simulate social proof. When THIS
   visitor's own interest form succeeds, `AcademyInterest.tsx` (the client
   parent that owns the submit state) increments `filled` by one and this
   component fills the next hollow seat. That fill is real — it reflects the
   submit that just happened, in this tab, this session — and resets on
   reload. Nothing here claims anyone else has signed up. */

const SEAT_COUNT = 12;

export function SeatGrid({ filled }: { filled: number }) {
  const reduce = useReducedMotion() ?? false;
  const count = Math.max(0, Math.min(filled, SEAT_COUNT));

  return (
    <div role="img" aria-label={`${count} of ${SEAT_COUNT} seats filled this session`}>
      <div className="grid grid-cols-6 gap-[14px] sm:grid-cols-12 sm:gap-[12px]">
        {Array.from({ length: SEAT_COUNT }, (_, i) => {
          const isFilled = i < count;
          return (
            <motion.span
              key={i}
              aria-hidden
              className="block h-[22px] w-[22px] rounded-full border-2"
              style={{
                borderColor: isFilled ? "var(--fn-orange-cta)" : "var(--fn-line-3)",
                background: isFilled ? "var(--fn-orange-cta)" : "transparent",
              }}
              initial={false}
              animate={{ scale: isFilled ? [1, 1.18, 1] : 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.32, ease: "easeOut" }}
            />
          );
        })}
      </div>
      <p className="m-0 mt-[14px] font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-muted">
        {count > 0
          ? `${count} SEAT${count === 1 ? "" : "S"} FILLED THIS SESSION`
          : "12 SEATS · NONE FILLED YET"}
      </p>
    </div>
  );
}

export default SeatGrid;
