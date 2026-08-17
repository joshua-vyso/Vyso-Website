"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { DETAIL, MOBILE } from "./data";
import { PriceChart } from "./FindingDetail";

/* ── Frame 1e · the mobile companion (+ its finding detail) ──────────────────
   Below lg the 1440px desktop frame would scale down to an unreadable
   thumbnail, so the showcase shows the design's phone-width screen instead —
   the content of frame 1e, without the phone chrome and status bar, since the
   surrounding frame already says "this is a screen".

   There is no cursor here: on a touch device a fake pointer is a lie. The
   "6-mo trend" button nudges itself once instead, which is the mobile way of
   saying "press me".                                                        */

/* The design's 390×844 phone minus the status bar and home indicator the frame
   no longer needs; 812 is what leaves the third card clear of the chat pill's
   fade (measured: the card bottoms out at 702). */
export const MOBILE_W = 390;
export const MOBILE_H = 812;

function InertButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-disabled tabIndex={-1} aria-hidden className={"cursor-default font-[inherit] " + className}>
      {children}
    </button>
  );
}

function ChatPill() {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0),#FFFFFF_45%)] px-[16px] pb-[18px] pt-[20px]">
      <div className="rounded-[999px] bg-[linear-gradient(115deg,#BE5D23,#D9730D_35%,#3E8FE0)] p-[1.5px] shadow-[0_12px_36px_-10px_rgba(31,95,168,0.3)]">
        <div className="flex items-center gap-[10px] rounded-[999px] bg-white py-[11px] pl-[16px] pr-[6px]">
          <span className="bg-[linear-gradient(115deg,#BE5D23,#3E8FE0)] bg-clip-text text-[14px] text-transparent">✦</span>
          <span className="flex-1 text-[13.5px] text-[#8A8E86]">{MOBILE.chatPlaceholder}</span>
          <InertButton className="grid h-[34px] w-[34px] place-items-center rounded-full border-none bg-[#171A17] text-white">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </InertButton>
        </div>
      </div>
    </div>
  );
}

function MobileBrief({ onOpenDetail, nudge }: { onOpenDetail: () => void; nudge: boolean }) {
  return (
    <div className="h-full w-full bg-[linear-gradient(180deg,#FBF9F6,#FFFFFF_340px)]">
      <div className="h-full px-[20px] pb-[120px] pt-[18px]">
        <div className="flex items-center justify-between px-[2px] pt-[6px]">
          <Image src="/finch/vyso-wordmark.svg" alt="Vyso" width={52} height={13} className="block h-[13px] w-[52px]" />
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[#EAF2FC] text-[11px] font-semibold text-[#1F5FA8]">
            JM
          </span>
        </div>
        <div
          role="heading"
          aria-level={3}
          className="of-display mt-[20px] text-balance text-[21.5px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#171A17]"
        >
          Morning Josh. {MOBILE.headline}
          <span className="bg-[linear-gradient(100deg,#BE5D23,#3E8FE0)] bg-clip-text text-transparent">
            {MOBILE.highlight}
          </span>
          .
        </div>
        <div className="mt-[8px] text-[12.5px] text-[#6B6F68]">
          <span className="text-[#3E8FE0]">✦</span> {MOBILE.sub}
        </div>

        <div className="mt-[22px] flex flex-col gap-[12px]">
          {MOBILE.cards.map((card) => (
            <div
              key={card.id}
              className={
                "relative overflow-hidden rounded-[16px] border border-[#EAEDF2] bg-white " +
                (card.actions
                  ? "p-[16px] shadow-[0_1px_2px_rgba(20,24,20,0.03)]"
                  : "px-[16px] py-[14px]")
              }
            >
              {card.bar ? (
                <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[linear-gradient(180deg,#BE5D23,#3E8FE0)]" />
              ) : null}
              <div className="flex items-center gap-[8px]">
                <span
                  className="rounded-[999px] px-[8px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: card.agentFg, background: card.agentBg }}
                >
                  {card.agent}
                </span>
                <span
                  className="ml-auto inline-flex items-center gap-[5px] rounded-[999px] px-[8px] py-[3px] text-[10px] font-semibold"
                  style={{ color: card.statusFg, background: card.statusBg }}
                >
                  {card.statusDot ? (
                    <span
                      className="vyso-pulse h-[4px] w-[4px] rounded-full"
                      style={{ background: card.statusDot, animationDuration: "1.6s" }}
                    />
                  ) : null}
                  {card.status}
                </span>
              </div>
              <p className={"mx-0 mt-[10px] text-[14px] leading-[1.45] text-[#2C333B] " + (card.figure ? "mb-[4px]" : "mb-0")}>
                {card.body}
              </p>
              {card.figure ? (
                <div className="of-num text-[18px] font-semibold text-[#171A17]">
                  {card.figure}
                  <span className="text-[12px] font-medium text-[#8A8E86]">{card.figureTail}</span>
                </div>
              ) : null}
              {card.actions ? (
                <div className="mt-[12px] flex gap-[7px]">
                  <InertButton className="flex-1 rounded-[9px] border-none bg-[#171A17] py-[9px] text-[12px] font-semibold text-white">
                    {card.actions[0]}
                  </InertButton>
                  {card.id === "price" ? (
                    <motion.button
                      type="button"
                      onClick={onOpenDetail}
                      className="flex-1 cursor-pointer rounded-[9px] border border-[#E4E9F0] bg-white py-[9px] font-[inherit] text-[12px] font-semibold text-[#3E4A57] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9DEF7]"
                      whileInView={nudge ? { scale: [1, 1.04, 1] } : undefined}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.6, delay: 1.2, times: [0, 0.5, 1], ease: "easeInOut" }}
                    >
                      {card.actions[1]}
                    </motion.button>
                  ) : (
                    <InertButton className="flex-1 rounded-[9px] border border-[#E4E9F0] bg-white py-[9px] text-[12px] font-semibold text-[#3E4A57]">
                      {card.actions[1]}
                    </InertButton>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <ChatPill />
    </div>
  );
}

function MobileDetail({ onBack, animateChart }: { onBack: () => void; animateChart: boolean }) {
  return (
    <div className="h-full w-full overflow-hidden bg-[linear-gradient(180deg,#FBF9F6,#FFFFFF_340px)]">
      <div className="px-[20px] pb-[24px] pt-[20px]">
        <button
          type="button"
          onClick={onBack}
          className="cursor-pointer font-[inherit] text-[13px] text-[#6B6F68] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9DEF7]"
        >
          {DETAIL.back}
        </button>
        <div className="mt-[16px] flex items-center gap-[8px]">
          <span className="inline-flex items-center gap-[6px] rounded-[999px] bg-[#FBEEDA] px-[8px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#854F0B]">
            <span className="h-[4px] w-[4px] rounded-full bg-[#BE5D23]" />
            {DETAIL.agent}
          </span>
          <span className="rounded-[999px] bg-[#E6F1FB] px-[8px] py-[3px] text-[10px] font-semibold text-[#0C447C]">
            {DETAIL.status}
          </span>
          <span className="text-[11px] text-[#A0A49C]">{DETAIL.found}</span>
        </div>
        <div
          role="heading"
          aria-level={3}
          className="of-display mt-[12px] text-balance text-[20px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#171A17]"
        >
          {DETAIL.headline}
        </div>
        <div className="mt-[10px] flex items-baseline gap-[12px]">
          <div className="of-num bg-[linear-gradient(100deg,#BE5D23,#3E8FE0)] bg-clip-text text-[26px] font-semibold text-transparent">
            {DETAIL.figure}
          </div>
          <div className="text-[12px] text-[#6B6F68]">{DETAIL.figureNote}</div>
        </div>

        <div className="mt-[18px] rounded-[16px] border border-[#EAEDF2] bg-white px-[16px] py-[16px] shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          {/* Stacked, not the desktop's justify-between row: at 390px the
              title and both legend keys cannot share a line without one of
              them wrapping mid-label. */}
          <div className="flex flex-col items-start gap-[6px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8A8E86]">
              {DETAIL.chartTitle}
            </div>
            <div className="flex gap-[12px] text-[10.5px] text-[#6B6F68]">
              {DETAIL.legend.map((l) => (
                <span key={l.label} className="inline-flex items-center gap-[5px]">
                  <span className="h-[2.5px] w-[9px] rounded-[2px]" style={{ background: l.color }} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
          <PriceChart animate={animateChart} />
        </div>

        <div className="mt-[12px] flex flex-col overflow-hidden rounded-[16px] border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <div className="h-[3px] bg-[linear-gradient(90deg,#BE5D23,#3E8FE0)]" />
          <div className="px-[16px] pb-[16px] pt-[14px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8A8E86]">
              {DETAIL.recommendedHeading}
            </div>
            <p className="mx-0 mb-0 mt-[8px] text-[13.5px] leading-[1.5] text-[#2C333B]">{DETAIL.recommended}</p>
            <div className="mt-[10px] flex flex-col gap-[8px]">
              <InertButton className="rounded-[9px] border-none bg-[#171A17] py-[10px] text-[12.5px] font-semibold text-white">
                {DETAIL.recommendedActions[0]}
              </InertButton>
              <InertButton className="rounded-[9px] border border-[#E4E9F0] bg-white py-[10px] text-[12.5px] font-semibold text-[#3E4A57]">
                {DETAIL.recommendedActions[1]}
              </InertButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BriefMobile() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<"brief" | "detail">("brief");
  return view === "brief" ? (
    <MobileBrief onOpenDetail={() => setView("detail")} nudge={!reduceMotion} />
  ) : (
    <MobileDetail onBack={() => setView("brief")} animateChart={!reduceMotion} />
  );
}

export default BriefMobile;
