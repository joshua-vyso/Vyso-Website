"use client";

import { useState } from "react";
import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The event timeline ──────────────────────────────────────────────────────
   THE recurring visual grammar of the whole site (plan §4). A vertical feed of
   timestamped operational events: an order arrives, the system captures it, it
   checks stock, it notices a shortage, it recommends something. Every page
   feeds it a different scenario through a typed `TimelineScript`, so the reader
   learns to read one picture once and then recognises it on eight solution
   pages, three industry pages and the case study.

   It exists because the differentiation sentence needs a picture: "most
   automation stops when the task is complete, Vyso looks at what happened
   next". A list of features cannot show "next". A timeline is literally the
   shape of "next".

   ── Four rules this component enforces so no page has to remember them ──────

   1. **Timestamps are static strings the caller passes in.** Never `Date.now()`
      and never `new Date()`. A time computed at render differs between the
      server and the client, which is a hydration error; and a demo that claims
      to be a record of a Tuesday morning should not silently claim it happened
      one second ago, forever.
   2. **Accent only on `alert` and `recommendation`.** Those two kinds are the
      "Vyso noticed" moment — the entire reason the rest of the site is
      monochrome. `event` and `check` are grey. A script where everything is an
      alert is a script with no signal in it.
   3. **Every word is real DOM text.** No canvas, no image of a UI. This is the
      demo a search engine and a screen reader both read, and on a site whose
      whole pitch is "we notice things", a picture of noticing is worth less
      than the sentence.
   4. **Reduced motion renders the finished list, immediately.** Not a shorter
      animation: no animation, no dependence on scrolling into view at all.

   ── What animates, and what deliberately does not ───────────────────────────
   `motion` serialises a variant's rest state into the SERVER HTML. So the row
   content animates on TRANSFORM ONLY (14px, inside the system's 16px ceiling):
   an `opacity: 0` rest state would ship a demo that is invisible until the
   JavaScript arrives, which is the trade `components/finch/site/Reveal.tsx`
   refused for the same reason. The dot and the rail DO fade and grow, because
   they are decoration — a reader who never sees them has lost nothing, and
   they are what make the sequence read as arrival rather than as rows
   twitching.

   The 550ms default between events is a NARRATIVE sequence, not the ≤80ms grid
   stagger `Reveal` caps itself at. Those are different things: a grid of four
   cards is one idea arriving in four pieces, and this is five things happening
   one after another over a morning. Plan §7.1 asks for roughly 600ms. */

export type TimelineEventKind = "event" | "check" | "alert" | "recommendation";

export type TimelineEvent = {
  /** A STATIC string: "09:41", "TUE 06:00", "DAY 3". See rule 1 above. */
  time: string;
  kind: TimelineEventKind;
  title: string;
  /** The sentence under the title. Optional — a routine `check` often needs
      nothing more than its own title. */
  body?: string;
  /** Provenance, mono and quiet: an invoice number, a supplier, a channel. */
  meta?: string;
};

export type TimelineScript = TimelineEvent[];

/* `alert` and `recommendation` are the two accented kinds and they are drawn as
   a bordered box rather than a plain row: a finding is a thing you can act on,
   and it should look like one thing rather than like more feed. */
const KIND: Record<
  TimelineEventKind,
  { dot: string; rail: string; boxed: boolean; label?: string }
> = {
  event: {
    dot: "bg-[color:var(--vy-ink-3)]",
    rail: "bg-[color:var(--vy-line)]",
    boxed: false,
  },
  check: {
    dot: "border border-[color:var(--vy-line-2)] bg-[color:var(--vy-surface)]",
    rail: "bg-[color:var(--vy-line)]",
    boxed: false,
  },
  alert: {
    dot: "bg-[color:var(--vy-accent)]",
    rail: "bg-[color:var(--vy-line)]",
    boxed: true,
    label: "NEEDS ATTENTION",
  },
  recommendation: {
    dot: "bg-[color:var(--vy-accent)]",
    rail: "bg-[color:var(--vy-line)]",
    boxed: true,
    label: "VYSO RECOMMENDS",
  },
};

const EASE = [0.22, 1, 0.36, 1] as const;

/* Rest/play, declared once and propagated to every child by the parent's
   `initial` / `whileInView`. Variants rather than per-item `delay` arithmetic so
   the stagger is one number in one place. */
const ROW = {
  rest: { y: 14 },
  play: { y: 0 },
};

const MARK = {
  rest: { opacity: 0, scale: 0.4 },
  play: { opacity: 1, scale: 1 },
};

const RAIL = {
  rest: { scaleY: 0 },
  play: { scaleY: 1 },
};

export function EventTimeline({
  script,
  /** Seconds between events. See the header on why this is not the 80ms cap. */
  interval = 0.55,
  /** Offer a "play again" button under the feed. The hero wants one; a timeline
      illustrating a paragraph halfway down a solutions page does not. */
  replay = false,
  /** Accessible name for the feed. Every instance on a page needs its own —
      "Example: a Tuesday morning order", not "Timeline". */
  label = "Example sequence",
  className = "",
}: {
  script: TimelineScript;
  interval?: number;
  replay?: boolean;
  label?: string;
  className?: string;
}) {
  const still = useStaticMotion();
  /* Replay by remount: bumping the key puts every child back at its rest
     variant and lets the in-view animation run again from the top. Cheaper and
     more predictable than driving eleven elements from an animation control,
     and the list is a dozen nodes. */
  const [run, setRun] = useState(0);

  const duration = still ? 0 : 0.5;

  return (
    <div className={className}>
      <motion.ol
        key={run}
        aria-label={label}
        className="m-0 list-none p-0"
        initial="rest"
        /* Reduced motion does not wait to be scrolled to: it plays at mount,
           with a zero duration, which is the same thing as rendering the
           finished list. */
        {...(still
          ? { animate: "play" }
          : { whileInView: "play", viewport: { once: true, amount: 0.25 } })}
        transition={
          still
            ? { duration: 0 }
            : { staggerChildren: interval, delayChildren: 0.15 }
        }
      >
        {script.map((item, i) => {
          const k = KIND[item.kind];
          const last = i === script.length - 1;
          return (
            <li
              key={`${item.time}-${item.title}`}
              className="grid grid-cols-[52px_1fr] gap-x-[14px] md:grid-cols-[68px_1fr] md:gap-x-[18px]"
            >
              <motion.span
                variants={ROW}
                transition={{ duration, ease: EASE }}
                className="vy-mono pt-[2px] text-[11.5px] text-[color:var(--vy-ink-3)] md:text-[12px]"
              >
                {item.time}
              </motion.span>

              <div className={`relative pl-[22px] ${last ? "pb-0" : "pb-[22px]"}`}>
                {/* The rail. Absolutely positioned rather than a left border so
                    it can grow; hidden on the last row because a rail that
                    continues past the final event promises a sixth. */}
                {last ? null : (
                  <motion.span
                    aria-hidden="true"
                    variants={RAIL}
                    transition={{ duration, ease: EASE }}
                    style={{ originY: 0 }}
                    className={`absolute top-[14px] bottom-0 left-[3px] w-px ${k.rail}`}
                  />
                )}
                <motion.span
                  aria-hidden="true"
                  variants={MARK}
                  transition={{ duration, ease: EASE }}
                  className={`absolute top-[6px] left-0 h-[7px] w-[7px] rounded-full ${k.dot}`}
                />

                <motion.div variants={ROW} transition={{ duration, ease: EASE }}>
                  {k.boxed ? (
                    <div className="rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-accent-tint)] px-[16px] py-[13px]">
                      {k.label ? (
                        <div className="vy-label mb-[6px] text-[10px] text-[color:var(--vy-accent-ink)]">
                          {k.label}
                        </div>
                      ) : null}
                      <p className="vy-body text-[15px] font-medium text-[color:var(--vy-ink)]">
                        {item.title}
                      </p>
                      {item.body ? (
                        <p className="vy-small mt-[5px] text-[color:var(--vy-ink-2)]">
                          {item.body}
                        </p>
                      ) : null}
                      {item.meta ? (
                        <p className="vy-label mt-[9px] text-[10px] text-[color:var(--vy-ink-2)]">
                          {item.meta}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="vy-body text-[15px] font-medium text-[color:var(--vy-ink)]">
                        {item.title}
                      </p>
                      {item.body ? (
                        <p className="vy-small mt-[4px] text-[color:var(--vy-ink-3)]">
                          {item.body}
                        </p>
                      ) : null}
                      {item.meta ? (
                        <p className="vy-label mt-[7px] text-[10px] text-[color:var(--vy-ink-3)]">
                          {item.meta}
                        </p>
                      ) : null}
                    </>
                  )}
                </motion.div>
              </div>
            </li>
          );
        })}
      </motion.ol>

      {/* No replay button under a static list: there is nothing to play again,
          and a control that does nothing is worse than no control. */}
      {replay && !still ? (
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="vy-label mt-[20px] ml-[66px] text-[10.5px] text-[color:var(--vy-ink-3)] transition-colors duration-150 hover:text-[color:var(--vy-ink)] md:ml-[86px]"
        >
          Play again
        </button>
      ) : null}
    </div>
  );
}

export default EventTimeline;
