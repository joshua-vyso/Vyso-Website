"use client";

import { motion, type MotionValue } from "motion/react";

/* The FreshCo invoice — beat 1 of the scroll sequence, and the opening frame of
   the mobile storyboard. Line highlights take either a plain number (static /
   reduced-motion render) or a MotionValue, so the desktop sequence can drive
   them from scroll progress without re-rendering React on every frame. */

type Scale = number | MotionValue<number>;

const LINES: [string, string][] = [
  ["Butternut 10kg bag × 24", "R 1,488.00"],
  ["Tomatoes Gr.1 6kg × 18",  "R 1,611.00"],
  ["Cooking oil 20L × 6",     "R 4,488.00"],
  ["Onions 10kg × 12",        "R 852.00"],
];

export function InvoiceCard({
  highlights = [0, 0, 0, 0],
  compact = false,
}: {
  highlights?: Scale[];
  compact?:    boolean;
}) {
  if (compact) {
    return (
      <div className="rounded-[6px] border border-fn-line bg-fn-surface p-[18px] shadow-[0_8px_24px_rgba(20,18,14,0.06)]">
        <div className="font-fn-mono text-[11px] font-medium">FRESHCO PRODUCE MARKET (PTY) LTD</div>
        <div className="mt-[3px] mb-[12px] font-fn-mono text-[9px] text-fn-muted">
          CITY DEEP · JHB · INV-38412 · 14 JUN 2026
        </div>
        {LINES.slice(0, 3).map(([item, amount], i) => (
          <div
            key={item}
            className={
              "flex justify-between px-[5px] py-[7px] font-fn-mono text-[10.5px] " +
              (i === 0 ? "rounded-[3px] bg-fn-blue-hl" : "")
            }
          >
            <span>{item}</span>
            <span>{amount}</span>
          </div>
        ))}
        <div className="mt-[4px] flex justify-between border-t border-fn-ink px-[5px] pt-[8px] font-fn-mono text-[11px] font-medium">
          <span>TOTAL INCL VAT</span>
          <span>R 8,439.00</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[6px] border border-fn-line bg-fn-surface px-[28px] py-[26px] shadow-[var(--fn-shadow-invoice)]">
      <div className="font-fn-mono text-[12px] font-medium tracking-[0.06em]">
        FRESHCO PRODUCE MARKET (PTY) LTD
      </div>
      <div className="mt-[4px] font-fn-mono text-[10px] text-fn-muted">
        CITY DEEP FRESH PRODUCE MARKET · JOHANNESBURG
      </div>
      <div className="mt-[10px] mb-[16px] flex gap-[8px]">
        <span className="h-[9px] w-[90px] rounded-[2px] bg-fn-line" />
        <span className="h-[9px] w-[60px] rounded-[2px] bg-fn-line" />
      </div>
      <div className="mb-[4px] flex justify-between border-y border-fn-line-2 py-[8px] font-fn-mono text-[10.5px] text-fn-ink-3">
        <span>TAX INVOICE · INV-38412</span>
        <span>14 JUN 2026</span>
      </div>
      <div className="flex flex-col">
        {LINES.map(([item, amount], i) => (
          <div
            key={item}
            className="relative flex justify-between px-[6px] py-[9px] font-fn-mono text-[11.5px]"
          >
            <motion.span
              aria-hidden
              className="absolute inset-x-0 inset-y-[2px] rounded-[3px] bg-fn-blue-hl"
              style={{ scaleX: highlights[i] ?? 0, transformOrigin: "left" }}
            />
            <span className="relative">{item}</span>
            <span className="relative">{amount}</span>
          </div>
        ))}
      </div>
      <div className="mt-[6px] flex justify-between border-t border-fn-ink px-[6px] pt-[10px] font-fn-mono text-[12px] font-medium">
        <span>TOTAL INCL VAT</span>
        <span>R 8,439.00</span>
      </div>
    </div>
  );
}

export default InvoiceCard;
