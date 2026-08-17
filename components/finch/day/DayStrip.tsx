"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { DayCard } from "./DayCard";
import { DayBriefPhone } from "./DayBriefPhone";
import {
  AFTERNOON_NOTE,
  CLOCK_HOURS,
  DAY_BEATS,
  EVENING_BRIEF,
  type DayBeat,
  type EveningBrief,
} from "./day-beats";

/* ── A day, as a scroll-linked strip ─────────────────────────────────────────
   Built on the same machinery as the homepage sequence
   (`components/finch/ScrollSequence.tsx`): a 300vh wrapper, a sticky 100vh
   stage drawn at a fixed logical size and scaled to fit, and motion values
   derived from `scrollYProgress` so nothing re-renders per frame.

   The default story is a working day as Finch runs it, 06:00 → 18:00. A
   hairline clock runs under the cards with an ink tick that advances linearly
   with scroll; four findings stamp in as the tick reaches their times; the
   afternoon is quiet on purpose; at 17:55 the headline findings arrive as one
   WhatsApp message and the fourth — real, but not a headline — dims. Three out
   of four is the product: Finch ranks, it doesn't forward everything.

   The day fills the first 55% of the scroll and the brief the rest: scroll is
   not time, and the evening beat needs room to land.

   Everything it draws is a prop, so a second day can be told with the same
   machinery (Phase 2 runs a COO's day against Finch's). The choreography is
   composed for **four day beats plus a closing one**: the stage lays out four
   cards 2×2 and up to five clock dots, and the phone lands up to three
   findings. Extra beats still get a caption and a card in the static and
   mobile forms; they just don't get their own stamp on the stage.             */

const STAGE_W = 1160;
const STAGE_H = 700;

/* Left half: the four cards over the clock. */
const CARD_W = 380;
const CARD_H = 200;
const CARD_COL = [0, 420];
const CARD_ROW = [36, 260];

const CLOCK_Y  = 546;   /* the hairline itself */
const CLOCK_X0 = 20;    /* inset so the tick's time readout never clips */
const CLOCK_W  = 780;

const NOTE_Y     = 486;
const CAPTIONS_Y = 664;

/* Right half: the phone. 300 wide, ~670 tall once the three findings land. */
const PHONE_X = 850;
const PHONE_Y = 6;

/* Where the day sits in the scroll. */
const DAY_T0 = 0.05;
const DAY_T1 = 0.6;
/** How long a card takes to stamp in, in scroll progress (≈220ms at a normal
    scroll rate over a 300vh wrapper). */
const STAMP = 0.045;
/** A caption lights just before its card stamps, so the eye is already there. */
const CAPTION_LEAD = 0.013;

/** The stage's fixed slots: four day cards, five clock dots, three bubbles. */
const CARD_SLOTS = 4;

/** clamp((t-a)/(b-a)) — how far through segment [a,b] progress t is. */
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
/** ease-out cubic */
const eo = (p: number) => 1 - Math.pow(1 - p, 3);

/** 0…1 across the day → "hh:mm", quantised to 5 minutes. */
function clockLabel(fraction: number) {
  const minutes = 6 * 60 + Math.round((fraction * 12 * 60) / 5) * 5;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type DayStripProps = {
  /** The day's beats, in time order. See the note above on how many land. */
  beats?:        DayBeat[];
  /** The message that closes the day. */
  eveningBrief?: EveningBrief;
  /** One label per beat under the clock. Defaults to `${time} ${agent}`. */
  captions?:     string[];
  /** Labels along the clock hairline, left to right. */
  clockHours?:   string[];
  /** The quiet stretch between the last day beat and the brief. "" to omit. */
  quietNote?:    string;
};

/* ── Desktop: the sticky, scroll-linked stage ────────────────────────────── */

function DayStage({
  beats,
  eveningBrief,
  captions,
  clockHours,
  quietNote,
}: Required<DayStripProps>) {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress: t } = useScroll({ target: wrap, offset: ["start start", "end end"] });

  /* Drawn at a fixed 1160×700 and scaled to fit, so the beats never reflow —
     only the whole picture gets smaller on short viewports. */
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () =>
      setScale(Math.min(1, (window.innerWidth - 40) / STAGE_W, (window.innerHeight - 60) / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /** When beat `i` stamps in, in scroll progress. */
  const beatT = (i: number) => DAY_T0 + (DAY_T1 - DAY_T0) * (beats[i]?.at ?? 1);

  /* Two pieces of text change as you scroll. Both are quantised — the caption
     to the beat, the readout to five minutes — so this is a handful of
     re-renders across the whole section, not one per frame. */
  const [active, setActive] = useState(0);
  const [now, setNow] = useState(() => clockLabel(0));
  useMotionValueEvent(t, "change", (v) => {
    if (v >= DAY_T1) {
      setActive(captions.length - 1);
    } else {
      let index = 0;
      for (let i = 0; i < Math.min(CARD_SLOTS, beats.length); i++) {
        if (v >= beatT(i) - CAPTION_LEAD) index = i;
      }
      setActive(index);
    }
    setNow(clockLabel(seg(v, DAY_T0, DAY_T1)));
  });

  /* The clock tick advances linearly: a clock that eases is a clock that lies. */
  const tickX = useTransform(t, (v) => CLOCK_X0 + CLOCK_W * seg(v, DAY_T0, DAY_T1));

  /* The four findings. Each stamps: opacity 0→1, scale 1.06→1. */
  const cardOpacity = [
    useTransform(t, (v) => eo(seg(v, beatT(0), beatT(0) + STAMP))),
    useTransform(t, (v) => eo(seg(v, beatT(1), beatT(1) + STAMP))),
    useTransform(t, (v) => eo(seg(v, beatT(2), beatT(2) + STAMP))),
    /* The fourth dims when the three headlines leave for the phone. */
    useTransform(t, (v) => eo(seg(v, beatT(3), beatT(3) + STAMP)) * (1 - eo(seg(v, 0.62, 0.72)) * 0.62)),
  ];
  const cardScale = [
    useTransform(t, (v) => 1.06 - eo(seg(v, beatT(0), beatT(0) + STAMP)) * 0.06),
    useTransform(t, (v) => 1.06 - eo(seg(v, beatT(1), beatT(1) + STAMP)) * 0.06),
    useTransform(t, (v) => 1.06 - eo(seg(v, beatT(2), beatT(2) + STAMP)) * 0.06),
    useTransform(t, (v) => 1.06 - eo(seg(v, beatT(3), beatT(3) + STAMP)) * 0.06),
  ];

  /* The event dots on the clock light as the tick passes them. */
  const dotOpacity = [
    useTransform(t, (v) => eo(seg(v, beatT(0), beatT(0) + STAMP))),
    useTransform(t, (v) => eo(seg(v, beatT(1), beatT(1) + STAMP))),
    useTransform(t, (v) => eo(seg(v, beatT(2), beatT(2) + STAMP))),
    useTransform(t, (v) => eo(seg(v, beatT(3), beatT(3) + STAMP))),
    useTransform(t, (v) => eo(seg(v, DAY_T1 - STAMP, DAY_T1))),
  ];

  /* The quiet afternoon. */
  const noteOpacity = useTransform(t, (v) =>
    Math.min(eo(seg(v, 0.34, 0.39)), 1 - eo(seg(v, 0.52, 0.57))),
  );

  /* 17:55 — the phone rises, then the message arrives line by line. */
  const phoneOpacity = useTransform(t, (v) => eo(seg(v, 0.6, 0.7)));
  const phoneY       = useTransform(t, (v) => (1 - eo(seg(v, 0.6, 0.7))) * 44);
  const greetOpacity = useTransform(t, (v) => eo(seg(v, 0.72, 0.78)));
  const greetY       = useTransform(t, (v) => (1 - eo(seg(v, 0.72, 0.78))) * 12);
  const findOpacity = [
    useTransform(t, (v) => eo(seg(v, 0.8,   0.85))),
    useTransform(t, (v) => eo(seg(v, 0.855, 0.905))),
    useTransform(t, (v) => eo(seg(v, 0.91,  0.96))),
  ];
  const findY = [
    useTransform(t, (v) => (1 - eo(seg(v, 0.8,   0.85))) * 12),
    useTransform(t, (v) => (1 - eo(seg(v, 0.855, 0.905))) * 12),
    useTransform(t, (v) => (1 - eo(seg(v, 0.91,  0.96))) * 12),
  ];

  return (
    <div ref={wrap} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div
          className="relative shrink-0"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "center" }}
        >
          {/* Positioned, never flowed: the stage must not reflow as beats land.
              The coordinates live here rather than inside DayCard so the card
              stays layout-agnostic for the static and mobile paths. */}
          {beats.slice(0, CARD_SLOTS).map((beat, i) => (
            <DayCard
              key={beat.time}
              beat={beat}
              className="absolute"
              style={{
                left:   CARD_COL[i % 2],
                top:    CARD_ROW[Math.floor(i / 2)],
                width:  CARD_W,
                height: CARD_H,
                opacity: cardOpacity[i],
                scale:   cardScale[i],
              }}
            />
          ))}

          <motion.div
            className="absolute"
            style={{
              left: PHONE_X,
              top: PHONE_Y,
              opacity: phoneOpacity,
              y: phoneY,
            }}
          >
            <DayBriefPhone
              greeting={eveningBrief.greeting}
              findings={eveningBrief.findings}
              time={beats[beats.length - 1]?.time}
              greetingStyle={{ opacity: greetOpacity, y: greetY }}
              findingStyles={[
                { opacity: findOpacity[0], y: findY[0] },
                { opacity: findOpacity[1], y: findY[1] },
                { opacity: findOpacity[2], y: findY[2] },
              ]}
            />
          </motion.div>

          {/* ── The clock ─────────────────────────────────────────────────── */}
          {quietNote ? (
            <motion.div
              className="absolute font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted"
              style={{ left: 0, top: NOTE_Y, opacity: noteOpacity }}
            >
              {quietNote}
            </motion.div>
          ) : null}

          <div
            className="absolute h-px bg-fn-line"
            style={{ left: CLOCK_X0, top: CLOCK_Y, width: CLOCK_W }}
          />
          {clockHours.map((label, i) => (
            <div
              key={label}
              className="absolute w-[60px] -translate-x-1/2 text-center font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-faint"
              style={{ left: CLOCK_X0 + (CLOCK_W / (clockHours.length - 1)) * i, top: CLOCK_Y + 12 }}
            >
              {label}
            </div>
          ))}
          {beats.slice(0, dotOpacity.length).map((beat, i) => (
            <div
              key={`tick-${beat.time}`}
              className="absolute h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-fn-line-3"
              style={{ left: CLOCK_X0 + CLOCK_W * beat.at, top: CLOCK_Y - 3 }}
            >
              <motion.span
                className="block h-[7px] w-[7px] rounded-full bg-fn-ink"
                style={{ opacity: dotOpacity[i] }}
              />
            </div>
          ))}
          <motion.div
            className="absolute flex -translate-x-1/2 flex-col items-center"
            style={{ left: 0, top: CLOCK_Y - 26, x: tickX }}
          >
            <span className="font-fn-mono text-[10px] tracking-[0.08em] text-fn-ink">{now}</span>
            <span className="mt-[4px] block h-[14px] w-px bg-fn-ink" />
          </motion.div>

          {/* ── Captions, under the clock, like the homepage sequence ─────── */}
          <div
            className="absolute flex flex-wrap justify-center gap-[22px] font-fn-mono text-[10px] tracking-[0.1em]"
            style={{ left: 0, top: CAPTIONS_Y, width: CLOCK_X0 + CLOCK_W }}
          >
            {captions.map((caption, i) => (
              <span
                key={caption}
                className="transition-colors duration-200"
                style={{ color: i === active ? "#14120E" : "#B9B3A3" }}
              >
                {caption}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Static: the server render, and every reduced-motion visitor ──────────────
   The same beats, already arrived, five across. */

function StaticStrip({ beats, quietNote }: { beats: DayBeat[]; quietNote: string }) {
  return (
    <div className="mx-auto max-w-[1160px] px-[20px] pt-[32px] lg:px-[40px]">
      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-5">
        {beats.map((beat) => (
          <DayCard key={beat.time} beat={beat} compact />
        ))}
      </div>
      {quietNote ? (
        <div className="mt-[16px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-faint">
          {quietNote}
        </div>
      ) : null}
    </div>
  );
}

/* ── Mobile (< lg, motion OK): the same day, read downwards ──────────────── */

function MobileStrip({ beats, quietNote }: { beats: DayBeat[]; quietNote: string }) {
  /* The quiet note sits where it belongs in time: above the closing beat. */
  const noteBefore = beats.length - 1;

  return (
    <div className="mx-auto max-w-[1160px] px-[20px] pt-[32px]">
      <div className="flex flex-col gap-[16px]">
        {beats.map((beat, i) => (
          <motion.div
            key={beat.time}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
          >
            {quietNote && i === noteBefore ? (
              <div className="mb-[16px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-faint">
                {quietNote}
              </div>
            ) : null}
            <DayCard beat={beat} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

const DESKTOP_QUERY = "(min-width: 1024px)";

/** `null` until hydration finishes — the server has no viewport to measure.
    (The same pattern `ScrollSequence` uses; it is not exported from there.) */
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

export function DayStrip({
  beats = DAY_BEATS,
  eveningBrief = EVENING_BRIEF,
  captions,
  clockHours = CLOCK_HOURS,
  quietNote = AFTERNOON_NOTE,
}: DayStripProps = {}) {
  const reduceMotion = useReducedMotion();
  const isDesktop = useIsDesktop();

  if (isDesktop === null || reduceMotion) return <StaticStrip beats={beats} quietNote={quietNote} />;
  if (!isDesktop) return <MobileStrip beats={beats} quietNote={quietNote} />;
  return (
    <DayStage
      beats={beats}
      eveningBrief={eveningBrief}
      captions={captions ?? beats.map((beat) => `${beat.time} ${beat.agent}`)}
      clockHours={clockHours}
      quietNote={quietNote}
    />
  );
}

export default DayStrip;
