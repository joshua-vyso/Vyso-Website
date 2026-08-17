"use client";

import { motion } from "motion/react";
import { DETAIL } from "./data";

/* ── Frame 1c · the finding detail ───────────────────────────────────────────
   The other half of the showcase: what "its evidence a click away" actually
   looks like. Same rules as BriefHome — the design file's platform palette,
   `.of-num`/`.of-display` for the Space Grotesk figures, and only the back
   link is a real control.

   The chart draws itself on mount, with the delays measured from the moment
   1c appears (0.5s → line, 1.1s → the quote, 1.3s → dots and stats). That
   keeps the demo timeline in one place: the parent only has to swap the view
   at the right moment and the chart takes care of its own beat.            */

const CHART_DRAW   = { duration: 0.8, delay: 0.5,  ease: "easeOut" } as const;
const QUOTE_FADE   = { duration: 0.3, delay: 1.1,  ease: "easeOut" } as const;
const DOT_POP      = { duration: 0.3, delay: 1.3,  ease: [0.2, 0.8, 0.3, 1] } as const;
const STATS_RISE   = { duration: 0.3, delay: 1.3,  ease: "easeOut" } as const;

function InertButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-disabled tabIndex={-1} aria-hidden className={"cursor-default font-[inherit] " + className}>
      {children}
    </button>
  );
}

export function PriceChart({ animate = true }: { animate?: boolean }) {
  const dotRadius = 4.5;
  return (
    <>
      <svg
        viewBox="0 0 520 180"
        preserveAspectRatio="none"
        className="mt-[10px] h-[190px] w-full"
        aria-hidden
      >
        {DETAIL.gridlines.map((y) => (
          <line key={y} x1="0" y1={y} x2="520" y2={y} stroke="#EEF1F5" />
        ))}
        <motion.path
          d={DETAIL.freshcoPath}
          fill="none"
          stroke="#BE5D23"
          strokeWidth="3"
          strokeLinecap="round"
          initial={animate ? { pathLength: 0 } : false}
          animate={animate ? { pathLength: 1 } : undefined}
          transition={CHART_DRAW}
        />
        <motion.line
          x1={DETAIL.quoteLine.x1}
          y1={DETAIL.quoteLine.y1}
          x2={DETAIL.quoteLine.x2}
          y2={DETAIL.quoteLine.y2}
          stroke="#3E7BC4"
          strokeWidth="2.5"
          strokeDasharray="6 5"
          strokeLinecap="round"
          initial={animate ? { opacity: 0 } : false}
          animate={animate ? { opacity: 1 } : undefined}
          transition={QUOTE_FADE}
        />
        {DETAIL.endDots.map((dot) => (
          /* `r`, not `scale`: the SVG is stretched by preserveAspectRatio
             ="none", so a transform-based pop would pop lopsided. */
          <motion.circle
            key={dot.fill}
            cx={dot.cx}
            cy={dot.cy}
            fill={dot.fill}
            r={animate ? undefined : dotRadius}
            initial={animate ? { r: 0 } : false}
            animate={animate ? { r: dotRadius } : undefined}
            transition={DOT_POP}
          />
        ))}
      </svg>
      <div className="of-num flex justify-between px-[2px] pt-[2px] text-[11px] text-[#A0A49C]">
        {DETAIL.months.map((m) => <span key={m}>{m}</span>)}
      </div>
      <motion.div
        className="mt-[14px] flex gap-[26px] border-t border-[#EEF1F5] pt-[12px]"
        initial={animate ? { opacity: 0, y: 8 } : false}
        animate={animate ? { opacity: 1, y: 0 } : undefined}
        transition={STATS_RISE}
      >
        {DETAIL.stats.map((stat) => (
          <div key={stat.label}>
            <div className="text-[11px] text-[#8A8E86]">{stat.label}</div>
            <div className="of-num text-[17px] font-semibold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </motion.div>
    </>
  );
}

export function FindingDetail({
  onBack, backRef, backPressed = false, animateChart = true,
}: {
  onBack:        () => void;
  /* The reverse demo has to aim at this link and show it being pressed, the
     same way the forward demo borrows the trend button in 1a. */
  backRef?:      React.Ref<HTMLButtonElement>;
  backPressed?:  boolean;
  animateChart?: boolean;
}) {
  return (
    <div className="h-full w-full overflow-hidden bg-[linear-gradient(180deg,#FBF9F6_0%,#FFFFFF_420px)]">
      <div className="mx-auto max-w-[880px] px-[40px] py-[44px]">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          className={
            "cursor-pointer font-[inherit] text-[13px] transition-colors duration-150 " +
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
            "focus-visible:outline-[#C9DEF7] " +
            (backPressed ? "text-[#BE5D23]" : "text-[#6B6F68] hover:text-[#BE5D23]")
          }
        >
          {DETAIL.back}
        </button>

        <div className="mt-[24px] flex items-center gap-[10px]">
          <span className="inline-flex items-center gap-[6px] rounded-[999px] bg-[#FBEEDA] px-[9px] py-[3px] text-[11px] font-semibold uppercase tracking-[0.08em] text-[#854F0B]">
            <span className="h-[5px] w-[5px] rounded-full bg-[#BE5D23]" />
            {DETAIL.agent}
          </span>
          <span className="rounded-[999px] bg-[#E6F1FB] px-[9px] py-[3px] text-[11px] font-semibold text-[#0C447C]">
            {DETAIL.status}
          </span>
          <span className="text-[12px] text-[#A0A49C]">{DETAIL.found}</span>
          <InertButton className="ml-auto inline-flex items-center gap-[8px] rounded-[999px] border border-[#E4E9F0] bg-white px-[16px] py-[8px] text-[12.5px] font-semibold text-[#3E4A57]">
            <span className="bg-[linear-gradient(115deg,#BE5D23,#3E8FE0)] bg-clip-text text-transparent">✦</span>
            {DETAIL.sendToChat}
          </InertButton>
        </div>

        <div
          role="heading"
          aria-level={3}
          className="of-display mt-[16px] text-balance text-[30px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#171A17]"
        >
          {DETAIL.headline}
        </div>
        <div className="mt-[12px] flex items-baseline gap-[24px]">
          <div className="of-num bg-[linear-gradient(100deg,#BE5D23,#3E8FE0)] bg-clip-text text-[34px] font-semibold text-transparent">
            {DETAIL.figure}
          </div>
          <div className="text-[13.5px] text-[#6B6F68]">{DETAIL.figureNote}</div>
        </div>

        <div className="mt-[28px] grid grid-cols-[1.6fr_1fr] gap-[16px]">
          {/* price history */}
          <div className="rounded-[16px] border border-[#EAEDF2] bg-white px-[20px] py-[18px] shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8A8E86]">
                {DETAIL.chartTitle}
              </div>
              <div className="flex gap-[14px] text-[11.5px] text-[#6B6F68]">
                {DETAIL.legend.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-[6px]">
                    <span className="h-[2.5px] w-[10px] rounded-[2px]" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            <PriceChart animate={animateChart} />
          </div>

          {/* recommendation */}
          <div className="flex flex-col overflow-hidden rounded-[16px] border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            <div className="h-[3px] bg-[linear-gradient(90deg,#BE5D23,#3E8FE0)]" />
            <div className="flex flex-1 flex-col px-[20px] pb-[20px] pt-[16px]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8A8E86]">
                {DETAIL.recommendedHeading}
              </div>
              <p className="mx-0 mb-0 mt-[10px] text-[14.5px] leading-[1.55] text-[#2C333B]">
                {DETAIL.recommended}
              </p>
              <div className="mt-[10px] text-[12.5px] text-[#6B6F68]">{DETAIL.recommendedNote}</div>
              <div className="mt-auto flex flex-col gap-[8px] pt-[16px]">
                <InertButton className="rounded-[9px] border-none bg-[#171A17] py-[10px] text-[13px] font-semibold text-white">
                  {DETAIL.recommendedActions[0]}
                </InertButton>
                <InertButton className="rounded-[9px] border border-[#E4E9F0] bg-white py-[10px] text-[13px] font-semibold text-[#3E4A57]">
                  {DETAIL.recommendedActions[1]}
                </InertButton>
              </div>
            </div>
          </div>
        </div>

        {/* evidence */}
        <div className="mt-[20px]">
          <div className="flex items-baseline gap-[10px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8A8E86]">
              {DETAIL.evidenceHeading}
            </div>
            <span className="text-[12px] text-[#1F5FA8]">{DETAIL.evidenceLink}</span>
          </div>
          <div className="mt-[12px] grid grid-cols-3 gap-[14px]">
            {DETAIL.invoices.map((inv) => (
              <div
                key={inv.no}
                className="flex items-center gap-[12px] rounded-[12px] border border-[#EAEDF2] bg-white p-[12px]"
              >
                <div className="flex h-[66px] w-[52px] flex-none flex-col gap-[4px] rounded-[3px] border border-[#E5E5E5] bg-[#FDFDFC] px-[6px] py-[7px] shadow-[0_1px_3px_rgba(20,24,20,0.08)]">
                  <div className="h-[4px] w-[55%] rounded-[2px] bg-[#C9CCC4]" />
                  <div className="h-[3px] w-[85%] rounded-[2px] bg-[#E5E5E5]" />
                  <div className="h-[3px] w-[75%] rounded-[2px] bg-[#E5E5E5]" />
                  <div className="h-[3px] w-[82%] rounded-[2px] bg-[#E5E5E5]" />
                  <div className="mt-auto h-[3px] w-[40%] rounded-[2px] bg-[#E5E5E5]" />
                  <div className="h-[4px] w-[60%] rounded-[2px] bg-[#BE5D23] opacity-[0.55]" />
                </div>
                <div className="min-w-0">
                  <div className="of-num text-[13px] font-semibold text-[#171A17]">{inv.no}</div>
                  <div className="mt-[2px] text-[12px] text-[#6B6F68]">{inv.date}</div>
                  <div className="of-num mt-[2px] text-[12px] text-[#8A8E86]">Butternut @ {inv.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FindingDetail;
