"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionStyle } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";
import { JOB_TO_INVOICE } from "@/lib/orbit/sequences";

import { HERO_INVOICE, HERO_JOB, InvoiceDraftCard, JobCard } from "./JobRecordCard";
import { Bubble, ChatBody, DayChip, PhoneFrame } from "./WhatsAppPhone";

/* ── The Orbit sequence ──────────────────────────────────────────────────────
   The homepage's one pinned section: a phone on the left playing the flagship
   conversation message by message as the reader scrolls, and the record it
   produces assembling on the right. Same mechanism as
   `components/finch/ScrollSequence.tsx` — a tall wrapper with a sticky stage,
   a `scrollYProgress` from `useScroll`, and every element's opacity/offset a
   `useTransform` of it — because that mechanism is already tuned, already
   accessible and already understood by whoever reads this next.

   Three things are deliberately different from the Finch sequence:

   - **It is shorter.** 320vh, not 480. Four messages and two cards is less
     choreography than five beats of invoice extraction, and a wrapper taller
     than its content is a section the reader scrolls through wondering when it
     will end.
   - **It is direction-agnostic.** `PlatformShowcase` plays forward and reverse
     because its content is a comparison. A conversation only reads one way, so
     scrolling back up simply un-plays it, which is the correct behaviour for a
     scrubbed timeline and needs no code.
   - **The stage is not scaled to fit.** Finch's sequence draws at a fixed
     1160×710 and scales the whole picture down on short viewports, because its
     beats are absolutely positioned. This one is a two-column flex layout that
     just gets narrower, which means the chat text never renders at 0.7× and
     stops being readable — the text *is* the content here.

   ── The three renders ───────────────────────────────────────────────────────
   Server and pre-hydration → the static storyboard (correct at every width,
   needs no measurement). Reduced motion → the same storyboard. Desktop with
   motion → the sticky stage. Below `lg` → the storyboard as well: a sticky
   two-column stage on a 390px screen is one column with a phone in it, which
   is what the storyboard already is.                                           */

const MESSAGES = JOB_TO_INVOICE.messages;

const CAPTIONS = ["01 YOU TEXT", "02 ORBIT TRACKS", "03 YOU SAY INVOICE", "04 ORBIT DRAFTS"];

/** Where each message lands in scroll progress.

    **The first message is not in this list.** It renders at full opacity from
    the moment the stage pins, and the beats below cover the three replies. The
    first version revealed all four, which meant the pinned stage's opening
    frame was an empty phone and an empty column — technically the "before"
    state, and in practice a section that looks broken for the second and a
    half before the reader scrolls again. The tradesperson's message is the
    premise, not a beat; Orbit's answer to it is the thing worth revealing. */
const BEATS: [number, number][] = [
  [0.10, 0.26],
  [0.34, 0.50],
  [0.58, 0.74],
];

/** clamp((t-a)/(b-a)) — how far through segment [a,b] progress t is. */
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
/** ease-out cubic */
const eo = (p: number) => 1 - Math.pow(1 - p, 3);

/* ── Shared furniture ───────────────────────────────────────────────────── */

function Captions({ active }: { active: number | null }) {
  return (
    <div className="flex flex-wrap justify-center gap-[22px] font-fn-mono text-[10px] tracking-[0.1em] lg:text-[10.5px]">
      {CAPTIONS.map((caption, i) => (
        <span
          key={caption}
          className="transition-colors duration-200"
          style={{ color: i === active ? "var(--ob-text)" : "var(--ob-mono)" }}
        >
          {caption}
        </span>
      ))}
    </div>
  );
}

function RecordColumn({
  jobStyle,
  invoiceStyle,
}: {
  jobStyle?: MotionStyle;
  invoiceStyle?: MotionStyle;
}) {
  return (
    <div className="flex w-full max-w-[400px] flex-col gap-[14px]">
      <div>
        <p className="m-0 mb-[4px] font-fn-mono text-[10px] tracking-[0.14em] text-ob-mono uppercase">
          Inside Vyso, at the same moment
        </p>
        <p className="m-0 text-[14px] leading-[1.55] text-ob-text-2">
          The message is not the record. It makes one — on the operations
          platform Vyso already runs for South African businesses.
        </p>
      </div>
      <motion.div style={jobStyle}>
        <JobCard job={HERO_JOB} />
      </motion.div>
      <motion.div style={invoiceStyle}>
        <InvoiceDraftCard invoice={HERO_INVOICE} />
      </motion.div>
    </div>
  );
}

/* ── Desktop: the sticky, scroll-linked stage ───────────────────────────── */

function PinnedSequence() {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress: t } = useScroll({ target: wrap, offset: ["start start", "end end"] });

  const [active, setActive] = useState(0);
  useMotionValueEvent(t, "change", (v) => {
    setActive(v < 0.14 ? 0 : v < 0.38 ? 1 : v < 0.62 ? 2 : 3);
  });

  /* One opacity and one y per revealed message. Hooks are called
     unconditionally in a fixed order — `BEATS` is a module constant, so the
     count can never change between renders. */
  const m1 = useTransform(t, (v) => eo(seg(v, BEATS[0][0], BEATS[0][1])));
  const m2 = useTransform(t, (v) => eo(seg(v, BEATS[1][0], BEATS[1][1])));
  const m3 = useTransform(t, (v) => eo(seg(v, BEATS[2][0], BEATS[2][1])));
  const reveals = [m1, m2, m3];

  const y1 = useTransform(m1, (p) => (1 - p) * 12);
  const y2 = useTransform(m2, (p) => (1 - p) * 12);
  const y3 = useTransform(m3, (p) => (1 - p) * 12);
  const offsets = [y1, y2, y3];

  /* The record column. Its heading is standing copy and is visible from the
     first frame (see `BEATS`); the job card lands with Orbit's first reply and
     the invoice draft with its second, so the two columns are visibly the same
     event seen twice rather than two things happening. */
  const jobOpacity = useTransform(t, (v) => eo(seg(v, 0.14, 0.30)));
  const jobY = useTransform(jobOpacity, (p) => (1 - p) * 18);
  const invoiceOpacity = useTransform(t, (v) => eo(seg(v, 0.58, 0.74)));
  const invoiceY = useTransform(invoiceOpacity, (p) => (1 - p) * 18);

  return (
    <div ref={wrap} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-[26px] px-[40px]">
          <div className="flex items-center justify-center gap-[64px]">
            <PhoneFrame
              label={JOB_TO_INVOICE.alt}
              statusTime={MESSAGES[0].time}
              header={{ name: "Orbit", presence: "online" }}
            >
              <ChatBody>
                <DayChip />
                {/* The reveal lives on a wrapper, not on `Bubble`'s own
                    `style`: a `MotionValue` only drives an element that
                    `motion` owns, and `Bubble` is a plain server-safe
                    component precisely so a static page can render it. */}
                <Bubble message={MESSAGES[0]} />
                {MESSAGES.slice(1).map((message, i) => (
                  <motion.div
                    key={`${message.side}-${i}`}
                    style={{ opacity: reveals[i], y: offsets[i] }}
                  >
                    <Bubble message={message} />
                  </motion.div>
                ))}
              </ChatBody>
            </PhoneFrame>

            <RecordColumn
              jobStyle={{ opacity: jobOpacity, y: jobY }}
              invoiceStyle={{ opacity: invoiceOpacity, y: invoiceY }}
            />
          </div>
          <Captions active={active} />
        </div>
      </div>
    </div>
  );
}

/* ── The storyboard ─────────────────────────────────────────────────────────
   Server render, every viewport below `lg`, and every reduced-motion visitor:
   the same conversation and the same record, already arrived. */

function Storyboard() {
  return (
    <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-[36px] px-[20px] py-[8px] lg:flex-row lg:items-start lg:justify-center lg:gap-[64px] lg:px-[40px]">
      <div className="flex flex-col items-center gap-[18px]">
        <PhoneFrame
          label={JOB_TO_INVOICE.alt}
          statusTime={MESSAGES[0].time}
          header={{ name: "Orbit", presence: "online" }}
        >
          <ChatBody>
            <DayChip />
            {MESSAGES.map((message, i) => (
              <Bubble key={`${message.side}-${i}`} message={message} />
            ))}
          </ChatBody>
        </PhoneFrame>
        <p className="m-0 font-fn-mono text-[9.5px] tracking-[0.1em] text-ob-mono uppercase">
          {JOB_TO_INVOICE.caption}
        </p>
      </div>
      <RecordColumn />
    </div>
  );
}

/* ── Entry point ─────────────────────────────────────────────────────────── */

const DESKTOP_QUERY = "(min-width: 1024px)";

/** `null` until hydration finishes — the server has no viewport to measure.
    Same `useSyncExternalStore` shape as `ScrollSequence`'s `useIsDesktop`, and
    for the same reason: reading a media query during the hydration render is a
    tree mismatch waiting to happen. */
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

/** The pinned stage needs a viewport tall enough to hold a 640px phone plus
    the captions. Below that it falls back to the storyboard rather than
    clipping the phone against the top of a sticky 100vh box. */
const MIN_STAGE_H = 760;

function useTallEnough(): boolean {
  const [tall, setTall] = useState(true);
  useLayoutEffect(() => {
    const measure = () => setTall(window.innerHeight >= MIN_STAGE_H);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return tall;
}

export function OrbitSequence() {
  const reduceMotion = useStaticMotion();
  const isDesktop = useIsDesktop();
  const tallEnough = useTallEnough();

  if (isDesktop === null || reduceMotion || !isDesktop || !tallEnough) return <Storyboard />;
  return <PinnedSequence />;
}

export default OrbitSequence;
