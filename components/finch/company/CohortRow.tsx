"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import type { CohortSeat } from "@/lib/marketing/founding";

/* ── The cohort row ──────────────────────────────────────────────────────────
   `/founding-client`'s signature visual and the only place on the site this
   shape appears: a row of quiet circles, one filled for each real founding
   client, the rest hollow with a mono `OPEN` chip. On enter each circle
   scales in from 0.6→1 with a fade, staggered 60ms left to right (the
   site's default group stagger). Reduced motion → every circle renders at
   its finished state immediately.

   Colour discipline: a filled seat is neither agent activity nor evidence,
   so it is plain ink — not orange, not blue. The only orange on the row is
   the hover state of the one real link. */
export function CohortRow({ seats }: { seats: readonly CohortSeat[] }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-wrap items-start justify-center gap-x-[22px] gap-y-[28px] lg:justify-between lg:gap-x-[16px]">
      {seats.map((seat, i) => {
        const filled = seat !== null;

        const circle = (
          <motion.span
            aria-hidden="true"
            className={
              "block h-[38px] w-[38px] rounded-full transition-colors duration-150 lg:h-[44px] lg:w-[44px] " +
              (filled
                ? "bg-fn-ink"
                : "border border-dashed border-fn-line-3 bg-transparent")
            }
            initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: reduceMotion ? 0 : i * 0.06 }}
          />
        );

        return (
          <div key={seat?.href ?? `open-${i}`} className="flex w-[64px] flex-col items-center gap-[10px] text-center">
            {filled ? (
              <Link href={seat.href} className="group flex flex-col items-center gap-[10px]">
                <span className="transition-transform duration-150 ease-out group-hover:scale-[1.06]">
                  {circle}
                </span>
                <span className="font-fn-mono text-[9px] leading-[1.3] tracking-[0.08em] text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                  {seat.label}
                </span>
              </Link>
            ) : (
              <>
                {circle}
                <span className="font-fn-mono text-[9px] tracking-[0.12em] text-fn-faint">OPEN</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default CohortRow;
