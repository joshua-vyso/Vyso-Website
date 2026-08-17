"use client";

import Image from "next/image";
import { motion, type MotionStyle } from "motion/react";

import { BRIEF_IDS, FLAGSHIP_RAND, getFinding } from "@/lib/marketing/findings";

/* Beat 5: the finding arrives as a WhatsApp brief. Desktop gets the phone
   frame from Homepage.dc.html; below lg the same conversation runs full-width
   as a panel (Mobile.dc.html) — a phone drawn inside a phone reads as a toy. */

function FinchAvatar({ size }: { size: number }) {
  return (
    <Image
      src="/finch/finch-bird.svg"
      alt=""
      width={size}
      height={size}
      className="rounded-full border border-fn-line bg-fn-bg p-[2px]"
      style={{ width: size, height: size }}
    />
  );
}

/* ── The three findings ──────────────────────────────────────────────────────
   "3 things need your attention" has to be literally true on screen, so the
   brief carries all three — the PRICE WATCH card the sequence already builds
   plus the two the platform's own Brief screen shows (design frames 1a/1e).  */

export const BRIEF_FINDINGS = BRIEF_IDS.map((id) => {
  const finding = getFinding(id);
  return {
    label:       finding.agent,
    observation: finding.observation,
    impact:      finding.impact,
    /* The bubble's chip carries its own arrow; the card's `FindingEvidence`
       adds one. Same string, one owner. */
    chip:        `${finding.evidence} ↗`,
  };
});

type Finding = (typeof BRIEF_FINDINGS)[number];

/* One bubble shape, two type scales: the 300px phone frame runs a notch
   tighter than the full-width mobile panel. Everything else is identical, so
   a size switch beats two near-duplicate components. */
function FindingBubble({
  finding,
  scale,
  style,
  className = "",
}: {
  finding:    Finding;
  scale:      "phone" | "panel";
  style?:     MotionStyle;
  className?: string;
}) {
  const phone = scale === "phone";
  return (
    <motion.div
      style={style}
      className={
        (phone
          ? "rounded-[10px_10px_10px_3px] px-[14px] py-[12px] "
          : "rounded-[12px_12px_12px_3px] p-[14px] ") +
        "bg-fn-surface shadow-[0_1px_2px_rgba(20,18,14,0.06)] " +
        className
      }
    >
      <div className="mb-[8px] flex items-center gap-[7px]">
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange"
          style={{ animation: "fn-pulse 2s ease-out infinite" }}
        />
        <span className="font-fn-mono text-[10px] tracking-[0.12em] text-fn-ink-3">{finding.label}</span>
      </div>
      <div className={(phone ? "text-[13px] leading-[1.5] " : "text-[14px] leading-[1.45] ") + "mb-[6px]"}>
        {finding.observation}
      </div>
      <div className={(phone ? "text-[15px] " : "text-[16px] ") + "mb-[8px] font-semibold text-fn-orange-deep"}>
        {finding.impact}
      </div>
      <span className="font-fn-mono text-[10.5px] text-fn-blue-deep bg-fn-blue-tint rounded-[6px] px-[9px] py-[3px]">
        {finding.chip}
      </span>
    </motion.div>
  );
}

export function BriefPhone({
  bubbleStyle,
  debtorsStyle,
  reconStyle,
  /* In the scroll sequence the PRICE WATCH bubble IS the finding card flying in
     from the stage, so the phone only reserves its footprint; everywhere else
     (static storyboard, reduced motion) the phone draws the bubble itself. */
  cardSlot = "bubble",
  cardSlotHeight = 0,
  height,
}: {
  bubbleStyle?:    MotionStyle;
  debtorsStyle?:   MotionStyle;
  reconStyle?:     MotionStyle;
  cardSlot?:       "bubble" | "spacer";
  cardSlotHeight?: number;
  height?:         number;
}) {
  const sequenced = cardSlot === "spacer";
  return (
    /* Fixed height only in the sequence, where the stage geometry depends on
       it. Standing on its own the phone grows to its four bubbles rather than
       clipping them — the frame was sized for a one-bubble brief. */
    <div
      className="w-[300px] rounded-[42px] border border-fn-line-3 bg-fn-surface p-[12px] shadow-[var(--fn-shadow-phone)]"
      style={height ? { height } : undefined}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[32px] bg-fn-surface-2 pb-[14px]">
        <div className="flex items-center gap-[10px] border-b border-fn-line bg-fn-surface px-[16px] pt-[16px] pb-[12px]">
          <FinchAvatar size={30} />
          <div>
            <div className="text-[13.5px] font-semibold">Finch</div>
            <div className="font-fn-mono text-[9.5px] text-fn-blue">● ONLINE · 06:45</div>
          </div>
        </div>
        <motion.div
          className="mx-[12px] mt-[14px] rounded-[10px_10px_10px_3px] bg-fn-surface px-[14px] py-[12px] text-[13px] leading-[1.5] shadow-[0_1px_2px_rgba(20,18,14,0.06)]"
          style={bubbleStyle}
        >
          Morning. 3 things need your attention — one&rsquo;s worth{" "}
          <strong className="text-fn-orange-deep">{FLAGSHIP_RAND}</strong>.
        </motion.div>

        {sequenced ? (
          /* Reserves the gap + the landed card's own height so the two bubbles
             below sit where the thread would put them. */
          <div aria-hidden className="shrink-0" style={{ height: cardSlotHeight }} />
        ) : (
          <FindingBubble finding={BRIEF_FINDINGS[0]} scale="phone" className="mx-[12px] mt-[10px]" />
        )}

        <FindingBubble
          finding={BRIEF_FINDINGS[1]}
          scale="phone"
          style={debtorsStyle}
          className="mx-[12px] mt-[10px]"
        />
        <FindingBubble
          finding={BRIEF_FINDINGS[2]}
          scale="phone"
          style={reconStyle}
          className="mx-[12px] mt-[10px]"
        />
      </div>
    </div>
  );
}

export function BriefPanel() {
  return (
    <div className="overflow-hidden rounded-[18px] border border-fn-line bg-fn-surface-2">
      <div className="flex items-center gap-[10px] border-b border-fn-line bg-fn-surface px-[16px] py-[14px]">
        <FinchAvatar size={32} />
        <div>
          <div className="text-[14px] font-semibold">Finch</div>
          <div className="font-fn-mono text-[9.5px] text-fn-blue">● ONLINE · MON 06:45</div>
        </div>
      </div>
      <div className="flex flex-col gap-[10px] px-[14px] pt-[16px] pb-[20px]">
        <div className="max-w-[88%] rounded-[12px_12px_12px_3px] bg-fn-surface px-[14px] py-[12px] text-[14px] leading-[1.5] shadow-[0_1px_2px_rgba(20,18,14,0.06)]">
          Morning. 3 things need your attention — one&rsquo;s worth{" "}
          <strong className="text-fn-orange-deep">{FLAGSHIP_RAND}</strong>.
        </div>
        {BRIEF_FINDINGS.map((finding) => (
          <FindingBubble key={finding.label} finding={finding} scale="panel" />
        ))}
        <div className="max-w-[70%] self-end rounded-[12px_12px_3px_12px] bg-fn-green-bubble px-[14px] py-[10px] text-[14px]">
          Draft the supplier email
        </div>
        <div className="max-w-[70%] rounded-[12px_12px_12px_3px] bg-fn-surface px-[14px] py-[10px] text-[14px] shadow-[0_1px_2px_rgba(20,18,14,0.06)]">
          Done. It&rsquo;s in your drafts.
        </div>
      </div>
    </div>
  );
}

export default BriefPhone;
