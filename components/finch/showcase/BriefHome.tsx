"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { BRIEF, BRIEF_CARDS, RAIL_MODULES, RESOLVED_CARD, type BriefCard } from "./data";

/* ── Frame 1a · the Brief home screen ────────────────────────────────────────
   A 1440×1000 picture of the product, drawn at logical size and scaled by the
   parent. Everything here is the design file's own platform palette and type
   scale (`.ai/design/vyso-brief/Vyso - The Brief.dc.html`, frame 1a) rather
   than the marketing `--fn-*` ramp — inside the frame we are looking at the
   app, not at the page. `.of-num` / `.of-display` are the shared Space Grotesk
   helpers from globals.css.

   Two controls are real: "Show 6-month trend" and the "3 invoices ↗" link,
   both of which open the finding detail. Everything else is inert — a mock
   that pretends to do more than it does is worse than one that admits it.  */

/** A control that is part of the picture, not part of the page. */
function InertButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-disabled tabIndex={-1} aria-hidden className={"cursor-default font-[inherit] " + className}>
      {children}
    </button>
  );
}

function Pill({
  children, fg, bg, dot, pulse, className = "",
}: {
  children: React.ReactNode;
  fg: string;
  bg: string;
  dot?: string;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-[6px] rounded-[999px] px-[9px] py-[3px] text-[11px] " +
        "font-semibold uppercase tracking-[0.08em] " + className
      }
      style={{ color: fg, background: bg }}
    >
      {dot ? (
        <span
          className={"h-[5px] w-[5px] rounded-full " + (pulse ? "vyso-pulse" : "")}
          style={{ background: dot, ...(pulse ? { animationDuration: "1.6s" } : null) }}
        />
      ) : null}
      {children}
    </span>
  );
}

function FeedCard({
  card, onOpen, trendRef, trendPressed,
}: {
  card:          BriefCard;
  onOpen?:       () => void;
  trendRef?:     React.Ref<HTMLButtonElement>;
  trendPressed?: boolean;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-[#EAEDF2] bg-white px-[22px] py-[20px] shadow-[0_1px_2px_rgba(20,24,20,0.03)]"
    >
      {card.bar ? (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-[linear-gradient(180deg,#BE5D23,#3E8FE0)]" />
      ) : null}
      <div className="flex items-center gap-[10px]">
        <Pill fg={card.agentFg} bg={card.agentBg} dot={card.agentDot}>{card.agent}</Pill>
        <span className="text-[11.5px] text-[#A0A49C]">{card.found}</span>
        <Pill
          className="ml-auto"
          fg={card.statusFg}
          bg={card.statusBg}
          dot={card.statusDot}
          pulse={card.statusPulse}
        >
          {card.status}
        </Pill>
      </div>
      <p className="mx-0 mb-[4px] mt-[12px] text-[16px] leading-[1.5] text-[#2C333B]">
        {card.body[0]}
        {card.body.length === 3 ? (
          <>
            <span className="of-num font-semibold">{card.body[1]}</span>
            {card.body[2]}
          </>
        ) : null}
      </p>
      <div className="of-num mb-[2px] mt-[6px] text-[22px] font-semibold text-[#171A17]">
        {card.figure}
        <span className="text-[14px] font-medium text-[#8A8E86]">{card.figureTail}</span>
      </div>
      {card.link && onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="cursor-pointer font-[inherit] text-[12.5px] text-[#1F5FA8] hover:text-[#BE5D23] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9DEF7]"
        >
          {card.link}
        </button>
      ) : card.link ? (
        <InertButton className="text-[12.5px] text-[#1F5FA8]">{card.link}</InertButton>
      ) : null}
      {card.actions ? (
        <div className="mt-[16px] flex gap-[8px]">
          <InertButton className="rounded-[9px] border-none bg-[#171A17] px-[14px] py-[8px] text-[12.5px] font-semibold text-white">
            {card.actions[0]}
          </InertButton>
          {onOpen ? (
            <button
              ref={trendRef}
              type="button"
              onClick={onOpen}
              className={
                "cursor-pointer rounded-[9px] border font-[inherit] px-[14px] py-[8px] text-[12.5px] font-semibold " +
                "transition-colors duration-150 focus-visible:outline focus-visible:outline-2 " +
                "focus-visible:outline-offset-2 focus-visible:outline-[#C9DEF7] " +
                (trendPressed
                  ? "border-[#C9DEF7] bg-[#F7FAFD] text-[#174C87]"
                  : "border-[#E4E9F0] bg-white text-[#3E4A57] hover:border-[#C9DEF7] hover:text-[#174C87]")
              }
            >
              {card.actions[1]}
            </button>
          ) : (
            <InertButton className="rounded-[9px] border border-[#E4E9F0] bg-white px-[14px] py-[8px] text-[12.5px] font-semibold text-[#3E4A57]">
              {card.actions[1]}
            </InertButton>
          )}
          <InertButton className="ml-auto border-none bg-transparent px-[10px] py-[8px] text-[12.5px] text-[#8A8E86]">
            {card.actions[2]}
          </InertButton>
        </div>
      ) : null}
      {card.note ? (
        <div className="mt-[14px] flex items-center gap-[8px] rounded-[9px] border border-[#EEF1F5] bg-[#FBFCFE] px-[12px] py-[9px] text-[12.5px] text-[#6B6F68]">
          <span className="text-[#3E8FE0]">✦</span> {card.note}
        </div>
      ) : null}
    </div>
  );
}

export function BriefHome({
  onOpenDetail, trendRef, trendPressed = false, staggerCards = false,
}: {
  onOpenDetail:  () => void;
  trendRef?:     React.Ref<HTMLButtonElement>;
  trendPressed?: boolean;
  /* Coming back from the finding detail, the feed deals itself out again
     rather than simply reappearing — 60ms apart is enough to read as three
     cards and not enough to read as a loading state. On first paint the feed
     is just there, so the parent leaves this off. */
  staggerCards?: boolean;
}) {
  return (
    <div className="flex h-full w-full bg-[linear-gradient(180deg,#FBF9F6_0%,#FFFFFF_420px)]">
      {/* left rail */}
      <div className="flex w-[216px] flex-none flex-col gap-[8px] border-r border-[#EFEDE8] px-[20px] pb-[24px] pt-[28px]">
        <div className="px-[8px] pb-[22px]">
          <Image src="/finch/vyso-wordmark.svg" alt="Vyso" width={64} height={16} className="block h-[16px] w-[64px]" />
        </div>
        <div className="flex items-center gap-[10px] rounded-[10px] border border-[#EAEDF2] bg-white px-[10px] py-[9px] text-[13.5px] font-semibold text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.04)]">
          <span className="vyso-pulse h-[8px] w-[8px] rounded-full bg-[linear-gradient(115deg,#BE5D23,#3E8FE0)]" />
          {BRIEF.navBrief}
          <span className="of-num ml-auto text-[11px] font-semibold text-[#BE5D23]">{BRIEF.navCount}</span>
        </div>
        <div className="flex items-center gap-[10px] rounded-[10px] px-[10px] py-[9px] text-[13.5px] text-[#6B6F68]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
          {BRIEF.navHistory}
        </div>
        <div className="mt-auto flex flex-col gap-[2px]">
          <div className="px-[10px] pb-[8px] text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#A0A49C]">
            {BRIEF.railHeading}
          </div>
          {RAIL_MODULES.map((m) => (
            <div key={m} className="flex items-center gap-[9px] rounded-[8px] px-[10px] py-[6px] text-[12.5px] text-[#8A8E86]">
              <span className="h-[5px] w-[5px] rounded-[2px] bg-[#C9CCC4]" />
              {m}
            </div>
          ))}
          <div className="mt-[14px] flex items-center gap-[9px] border-t border-[#EFEDE8] px-[10px] pt-[10px]">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-[#EAF2FC] text-[11px] font-semibold text-[#1F5FA8]">
              {BRIEF.userInitials}
            </span>
            <span className="text-[12.5px] text-[#6B6F68]">{BRIEF.userName}</span>
          </div>
        </div>
      </div>

      {/* main */}
      <div className="relative flex-1 overflow-hidden">
        <div className="mx-auto max-w-[760px] px-[40px] pb-[150px] pt-[52px]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8A8E86]">
            {BRIEF.dateLine}
          </div>
          <div
            role="heading"
            aria-level={3}
            className="of-display mt-[10px] text-balance text-[33px] font-semibold leading-[1.25] tracking-[-0.01em] text-[#171A17]"
          >
            {BRIEF.greeting} {BRIEF.headline}
            <span className="whitespace-nowrap bg-[linear-gradient(100deg,#BE5D23,#3E8FE0)] bg-clip-text text-transparent">
              {BRIEF.highlight}
            </span>
            .
          </div>
          <div className="mt-[14px] flex items-center gap-[8px] text-[13.5px] text-[#6B6F68]">
            <span className="text-[#3E8FE0]">✦</span> {BRIEF.sub}
          </div>

          <div className="mt-[36px] flex flex-col gap-[14px]">
            {BRIEF_CARDS.map((card, i) => (
              <motion.div
                key={card.id}
                initial={staggerCards ? { opacity: 0, y: 10 } : false}
                animate={staggerCards ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.3, delay: 0.06 * i, ease: "easeOut" }}
              >
                <FeedCard
                  card={card}
                  onOpen={card.id === "price" ? onOpenDetail : undefined}
                  trendRef={card.id === "price" ? trendRef : undefined}
                  trendPressed={card.id === "price" ? trendPressed : undefined}
                />
              </motion.div>
            ))}

            <div className="rounded-[16px] border border-[#EFEDE8] bg-[#FBFAF8] px-[22px] py-[16px] opacity-[0.82]">
              <div className="flex items-center gap-[10px]">
                <Pill fg="#2E7D67" bg="#E1F5EE" dot="#2E7D67">{RESOLVED_CARD.agent}</Pill>
                <span className="text-[13.5px] text-[#6B6F68] line-through decoration-[#C9CCC4]">
                  {RESOLVED_CARD.body}
                </span>
                <Pill className="ml-auto" fg="#0F6E56" bg="#E1F5EE">{RESOLVED_CARD.status}</Pill>
              </div>
              <div className="ml-[2px] mt-[8px] text-[12px] text-[#8A8E86]">{RESOLVED_CARD.note}</div>
            </div>
          </div>
        </div>

        {/* chat bar — pinned to the bottom of the frame exactly as the design's
            absolute bar. The scrim is a solid-to-transparent white fade, not a
            blur: the feed simply runs out of light behind it. */}
        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#FFFFFF_55%)] px-[40px] pb-[26px] pt-[28px]">
          <div className="relative mx-auto max-w-[680px] rounded-[999px] bg-[linear-gradient(115deg,#BE5D23,#D9730D_35%,#3E8FE0)] p-[1.5px] shadow-[0_16px_50px_-12px_rgba(31,95,168,0.25)]">
            <div className="flex items-center gap-[12px] rounded-[999px] bg-white py-[13px] pl-[20px] pr-[8px]">
              <span className="bg-[linear-gradient(115deg,#BE5D23,#3E8FE0)] bg-clip-text text-[15px] text-transparent">✦</span>
              <span className="flex-1 text-[14.5px] text-[#8A8E86]">{BRIEF.chatPlaceholder}</span>
              <InertButton className="grid h-[38px] w-[38px] place-items-center rounded-full border-none bg-[#171A17] text-white">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </InertButton>
            </div>
          </div>
          <div className="mx-auto mt-[8px] max-w-[680px] text-center text-[11.5px] text-[#A0A49C]">
            {BRIEF.chatCaption}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BriefHome;
