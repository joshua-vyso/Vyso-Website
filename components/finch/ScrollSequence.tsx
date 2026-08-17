"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { InvoiceCard } from "./InvoiceCard";
import { BriefPanel, BriefPhone } from "./BriefPhone";
import {
  FindingActions,
  FindingCard,
  FindingCardFrame,
  FindingEvidence,
  FindingHeader,
  FindingImpact,
  FindingObservation,
  FINDING_DEFAULTS,
} from "./FindingCard";

/* ── The scroll sequence ─────────────────────────────────────────────────────
   Five beats — invoice in, extraction, price memory, the finding, your brief —
   driven by scroll progress over a 480vh wrapper with a sticky 100vh stage.
   Every segment boundary and easing here is lifted from the tick() function in
   .ai/design/Homepage.dc.html; changing one number changes the choreography.  */

const CAPTIONS = [
  "01 INVOICE IN",
  "02 EXTRACTION",
  "03 PRICE MEMORY",
  "04 THE FINDING",
  "05 YOUR BRIEF",
];

const STAGE_W = 1160;
/* 710, not the v1 660: the brief now carries three findings and the phone had
   to grow to 680px to hold them (see PHONE_H). The stage only grows downward —
   every beat is absolutely positioned from the top — so the composition is
   unchanged apart from sitting ~25px higher on screen. */
const STAGE_H = 710;
const PHONE_H = 680;

/* ── Where the finding card comes to rest inside the phone ─────────────────
   Stage coords: the card starts at (480,100) and the phone at (790,10), so
   these offsets put the card's top-left 13px inside the phone screen, which
   leaves the design's ~12px side margins at 0.56 scale. The Y was 118 in v1,
   when the brief was one bubble and the card could sit low in the screen; a
   three-bubble thread needs it tucked straight under the greeting. Measured
   on localhost at 1440×900: landed card 246.4 × 128.7. */
const CARD_LAND_X = 336;
const CARD_LAND_Y = 74;
const CARD_LAND_SCALE = 0.56;
/* Gap above the landed card + its scaled height — the footprint the phone's
   flex column reserves so the DEBTORS bubble lands below the card, not under
   it. Derived from the two constants above, so it lives with them. */
const CARD_SLOT_H = 140;

/** clamp((t-a)/(b-a)) — how far through segment [a,b] progress t is. */
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
/** ease-out cubic */
const eo = (p: number) => 1 - Math.pow(1 - p, 3);

type Scale = number | MotionValue<number>;

/* ── Static pieces shared by all three renders ───────────────────────────── */

const EXTRACTED: [string, string, string][] = [
  ["butternut_10kg · 24 @ R62.00",  "+12% vs Jan", "text-fn-orange-deep"],
  ["tomato_gr1_6kg · 18 @ R89.50",  "steady",      "text-fn-muted"],
  ["cooking_oil_20l · 6 @ R748.00", "−2% vs Jan",  "text-fn-muted"],
  ["onion_10kg · 12 @ R71.00",      "steady",      "text-fn-muted"],
];

function ExtractedRows() {
  return (
    <div className="rounded-[8px] border border-fn-line bg-fn-surface px-[22px] py-[20px]">
      <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
        EXTRACTED · 4 LINE ITEMS · 99.2% CONF
      </div>
      <div className="flex flex-col gap-[10px] font-fn-mono text-[12px] text-fn-blue-deep">
        {EXTRACTED.map(([item, delta, tone]) => (
          <div key={item} className="flex justify-between">
            <span>{item}</span>
            <span className={tone}>{delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PriceChart({ draw = 1, endOpacity = 1 }: { draw?: Scale; endOpacity?: Scale }) {
  return (
    <div>
      <div className="mb-[16px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-muted">
        BUTTERNUT · R PER 10KG BAG · JAN–JUN 2026
      </div>
      <svg
        width="560"
        height="300"
        viewBox="0 0 560 300"
        className="max-w-full overflow-visible"
        aria-hidden
      >
        <line x1="20" y1="270" x2="540" y2="270" stroke="#E7E3DA" strokeWidth="1" />
        <line x1="20" y1="170" x2="540" y2="170" stroke="#F0EDE5" strokeWidth="1" />
        <line x1="20" y1="70"  x2="540" y2="70"  stroke="#F0EDE5" strokeWidth="1" />
        <motion.path
          d="M 20 180 L 120 196 L 220 164 L 320 148 L 420 108 L 520 52"
          fill="none"
          stroke="#4B96DD"
          strokeWidth="2.5"
          strokeLinecap="round"
          style={{ pathLength: draw }}
        />
        <motion.circle cx="520" cy="52" r="4.5" fill="#FF7727" style={{ opacity: endOpacity }} />
        <motion.text
          x="520"
          y="32"
          textAnchor="middle"
          fontFamily="var(--font-plex-mono), 'IBM Plex Mono', monospace"
          fontSize="12"
          fill="#C94F0E"
          style={{ opacity: endOpacity }}
        >
          R62.00
        </motion.text>
        <text x="20" y="292" fontFamily="var(--font-plex-mono), 'IBM Plex Mono', monospace" fontSize="10" fill="#B9B3A3">
          JAN
        </text>
        <text x="520" y="292" textAnchor="end" fontFamily="var(--font-plex-mono), 'IBM Plex Mono', monospace" fontSize="10" fill="#B9B3A3">
          JUN
        </text>
      </svg>
    </div>
  );
}

function Captions({ active }: { active: number | null }) {
  return (
    <div className="flex flex-wrap justify-center gap-[26px] font-fn-mono text-[10.5px] tracking-[0.1em]">
      {CAPTIONS.map((caption, i) => (
        <span
          key={caption}
          className="transition-colors duration-200"
          style={{ color: i === active ? "#14120E" : "#B9B3A3" }}
        >
          {caption}
        </span>
      ))}
    </div>
  );
}

/* ── Desktop: the sticky, scroll-linked stage ────────────────────────────── */

function DesktopSequence() {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress: t } = useScroll({ target: wrap, offset: ["start start", "end end"] });

  // The stage is drawn at a fixed 1160×660 and then scaled to fit, so the beats
  // never reflow — only the whole picture gets smaller on short viewports.
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () =>
      setScale(Math.min(1, (window.innerWidth - 40) / STAGE_W, (window.innerHeight - 60) / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const [active, setActive] = useState(0);
  useMotionValueEvent(t, "change", (v) => {
    setActive(v < 0.15 ? 0 : v < 0.38 ? 1 : v < 0.58 ? 2 : v < 0.78 ? 3 : 4);
  });

  /* beat 1 — the invoice drifts in, then slides out left under the chart */
  const invoiceOpacity = useTransform(t, (v) => Math.min(eo(seg(v, 0, 0.14)), 1 - eo(seg(v, 0.4, 0.52)) * 0.9));
  const invoiceY       = useTransform(t, (v) => (1 - eo(seg(v, 0, 0.14))) * 70);
  const invoiceX       = useTransform(t, (v) => -eo(seg(v, 0.4, 0.52)) * 80);
  const invoiceRotate  = useTransform(t, (v) => -3 + eo(seg(v, 0, 0.14)) * 3);
  const invoiceScale   = useTransform(t, (v) => 1 - eo(seg(v, 0.4, 0.52)) * 0.06);

  /* beat 2 — highlights sweep line by line, structured rows appear */
  const highlights = [
    useTransform(t, (v) => eo(seg(v, 0.15, 0.23))),
    useTransform(t, (v) => eo(seg(v, 0.18, 0.26))),
    useTransform(t, (v) => eo(seg(v, 0.21, 0.29))),
    useTransform(t, (v) => eo(seg(v, 0.24, 0.32))),
  ];
  const rowsOpacity = useTransform(t, (v) => Math.min(eo(seg(v, 0.2, 0.3)), 1 - eo(seg(v, 0.38, 0.46))));
  const rowsX       = useTransform(t, (v) => (1 - eo(seg(v, 0.2, 0.3))) * 50 - eo(seg(v, 0.38, 0.46)) * 40);

  /* beat 3 — the price chart draws itself */
  const chartOpacity = useTransform(t, (v) => Math.min(eo(seg(v, 0.4, 0.48)), 1 - eo(seg(v, 0.58, 0.66))));
  const chartX       = useTransform(t, (v) => (1 - eo(seg(v, 0.4, 0.48))) * 50 - eo(seg(v, 0.58, 0.66)) * 70);
  const chartDraw    = useTransform(t, (v) => eo(seg(v, 0.42, 0.56)));
  // The end dot and its label only appear once the line has effectively landed.
  const chartEnd     = useTransform<number, number>(t, (v) => (eo(seg(v, 0.42, 0.56)) > 0.97 ? 1 : 0));

  /* beat 4 — the finding card assembles piece by piece */
  const cardOpacity = useTransform(t, (v) => eo(seg(v, 0.6, 0.66)));
  const pieces = [
    useTransform(t, (v) => eo(seg(v, 0.6,   0.67))),
    useTransform(t, (v) => eo(seg(v, 0.635, 0.705))),
    useTransform(t, (v) => eo(seg(v, 0.67,  0.74))),
    useTransform(t, (v) => eo(seg(v, 0.705, 0.775))),
    useTransform(t, (v) => eo(seg(v, 0.74,  0.81))),
  ];
  const piece0Y = useTransform(pieces[0], (p) => (1 - p) * 20);
  const piece1Y = useTransform(pieces[1], (p) => (1 - p) * 20);
  // The rand impact stamps in rather than sliding — it is the point of the card.
  const piece2Scale = useTransform(pieces[2], (p) => 1.3 - p * 0.3);
  const piece3Y = useTransform(pieces[3], (p) => (1 - p) * 20);
  const piece4Y = useTransform(pieces[4], (p) => (1 - p) * 20);

  /* beat 5 — phone rises, card shrinks into it, brief bubble lands */
  const cardIntoX  = useTransform(t, (v) => eo(seg(v, 0.8, 0.92)) * CARD_LAND_X);
  const cardIntoY  = useTransform(t, (v) => eo(seg(v, 0.8, 0.92)) * CARD_LAND_Y);
  const cardScale  = useTransform(t, (v) => 1 - eo(seg(v, 0.8, 0.92)) * (1 - CARD_LAND_SCALE));
  const phoneOpacity = useTransform(t, (v) => eo(seg(v, 0.78, 0.86)));
  const phoneY       = useTransform(t, (v) => (1 - eo(seg(v, 0.78, 0.86))) * 60);
  const briefOpacity = useTransform(t, (v) => eo(seg(v, 0.9, 0.97)));
  const briefY       = useTransform(t, (v) => (1 - eo(seg(v, 0.9, 0.97))) * 14);
  /* The other two findings land after the card, one behind the other, so the
     brief reads as a thread arriving rather than a block appearing. */
  const debtorsOpacity = useTransform(t, (v) => eo(seg(v, 0.93, 0.97)));
  const debtorsY       = useTransform(t, (v) => (1 - eo(seg(v, 0.93, 0.97))) * 14);
  const reconOpacity   = useTransform(t, (v) => eo(seg(v, 0.95, 0.99)));
  const reconY         = useTransform(t, (v) => (1 - eo(seg(v, 0.95, 0.99))) * 14);

  return (
    <div ref={wrap} className="relative h-[480vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div
          className="relative shrink-0"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "center" }}
        >
          <motion.div
            className="absolute left-[10px] top-[40px] w-[400px]"
            style={{ opacity: invoiceOpacity, x: invoiceX, y: invoiceY, rotate: invoiceRotate, scale: invoiceScale }}
          >
            <InvoiceCard highlights={highlights} />
          </motion.div>

          <motion.div
            className="absolute left-[480px] top-[110px] w-[430px]"
            style={{ opacity: rowsOpacity, x: rowsX }}
          >
            <ExtractedRows />
          </motion.div>

          <motion.div
            className="absolute left-[470px] top-[70px] w-[580px]"
            style={{ opacity: chartOpacity, x: chartX }}
          >
            <PriceChart draw={chartDraw} endOpacity={chartEnd} />
          </motion.div>

          <motion.div
            className="absolute left-[480px] top-[100px] z-[2] w-[440px]"
            style={{
              opacity: cardOpacity,
              x: cardIntoX,
              y: cardIntoY,
              scale: cardScale,
              transformOrigin: "top left",
            }}
          >
            <FindingCardFrame className="w-full max-w-none shadow-[var(--fn-shadow-float)]">
              <motion.div style={{ opacity: pieces[0], y: piece0Y }}>
                <FindingHeader />
              </motion.div>
              <motion.div style={{ opacity: pieces[1], y: piece1Y }}>
                <FindingObservation className="text-[16.5px]">
                  {FINDING_DEFAULTS.observation}
                </FindingObservation>
              </motion.div>
              <motion.div style={{ opacity: pieces[2], scale: piece2Scale, transformOrigin: "left center" }}>
                <FindingImpact>{FINDING_DEFAULTS.impact}</FindingImpact>
              </motion.div>
              <motion.div style={{ opacity: pieces[3], y: piece3Y }}>
                <FindingEvidence className="mb-[14px]" />
              </motion.div>
              <motion.div style={{ opacity: pieces[4], y: piece4Y }}>
                <FindingActions interactive={false} />
              </motion.div>
            </FindingCardFrame>
          </motion.div>

          <motion.div
            className="absolute left-[790px] top-[10px]"
            style={{ opacity: phoneOpacity, y: phoneY }}
          >
            <BriefPhone
              bubbleStyle={{ opacity: briefOpacity, y: briefY }}
              debtorsStyle={{ opacity: debtorsOpacity, y: debtorsY }}
              reconStyle={{ opacity: reconOpacity, y: reconY }}
              cardSlot="spacer"
              cardSlotHeight={CARD_SLOT_H}
              height={PHONE_H}
            />
          </motion.div>

          <div className="absolute inset-x-0 bottom-[-6px]">
            <Captions active={active} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Static storyboard ───────────────────────────────────────────────────────
   Server render (nothing has measured the viewport yet) and every reduced-motion
   visitor: the same five beats, each already arrived, stacked down the page. */

function StaticStoryboard() {
  return (
    <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-[40px] px-[20px] py-[40px] lg:px-[40px]">
      <div className="w-full max-w-[400px]">
        <InvoiceCard highlights={[1, 1, 1, 1]} />
      </div>
      <div className="w-full max-w-[430px]">
        <ExtractedRows />
      </div>
      <div className="w-full max-w-[580px]">
        <PriceChart />
      </div>
      <FindingCard tilt={false} className="w-full max-w-[460px]" />
      <div className="hidden lg:block">
        <BriefPhone />
      </div>
      <div className="w-full max-w-[460px] lg:hidden">
        <BriefPanel />
      </div>
      <Captions active={null} />
    </div>
  );
}

/* ── Mobile storyboard (< lg, motion OK) ─────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children:   React.ReactNode;
  delay?:     number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

function MobileSequence() {
  return (
    <>
      <section className="border-t border-fn-line px-[20px] pt-[32px]">
        <div className="mb-[22px] text-balance font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted">
          01 AN INVOICE COMES IN → 04 A FINDING COMES OUT
        </div>
        <Reveal>
          <InvoiceCard compact />
        </Reveal>
        <Reveal delay={0.15} className="flex justify-center py-[14px]">
          <span className="font-fn-mono text-[11px] text-fn-muted">↓ FINCH READS IT</span>
        </Reveal>
        <Reveal delay={0.3}>
          <FindingCard tilt={false} className="max-w-full" />
          <div className="mt-[10px] text-right font-fn-mono text-[9px] tracking-[0.1em] text-fn-faint">
            ILLUSTRATIVE EXAMPLE
          </div>
        </Reveal>
      </section>

      <section className="px-[20px] pt-[56px] pb-[48px]">
        <div className="mb-[22px] text-balance font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted">
          05 YOUR MONDAY BRIEF · ON WHATSAPP
        </div>
        <Reveal>
          <BriefPanel />
        </Reveal>
      </section>
    </>
  );
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

const DESKTOP_QUERY = "(min-width: 1024px)";

/** `null` until hydration finishes — the server has no viewport to measure. */
function useIsDesktop(): boolean | null {
  return useSyncExternalStore<boolean | null>(
    (onChange) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null,
  );
}

export function ScrollSequence() {
  const reduceMotion = useReducedMotion();
  const isDesktop = useIsDesktop();

  // Before hydration there is nothing to branch on, so the storyboard renders —
  // it is the variant that is correct at every width and needs no measurement.
  if (isDesktop === null || reduceMotion) return <StaticStoryboard />;
  return isDesktop ? <DesktopSequence /> : <MobileSequence />;
}

export default ScrollSequence;
