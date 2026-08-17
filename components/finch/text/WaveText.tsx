"use client";

import { Fragment, useEffect, useRef } from "react";
import { useInView } from "motion/react";

import { useWaveClock, waveAt } from "@/components/finch/ground/wave-clock";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── Type that rides the field ───────────────────────────────────────────────
   §4.1, the signature move of the whole redesign: on a `WaveField` band the
   headline's `y` follows the field's own sine at the headline's x-centre, and
   per-word, so the line visibly *lifts* as a crest passes under it.

   Three deliberate choices:

   1. **Same clock as the canvas.** Not a copy of the equation with its own
      timer — `waveAt` and `clock.params` are literally the ones the field draws
      with (`ground/wave-clock.tsx`). Two loops drift apart; one cannot.
   2. **3px, not 16 — and ≤ 1.5px of it between the first word and the last.**
      The lines swing at the field's amplitude; the type swings at 3. 6b shipped
      5px at the field's own spatial frequency, which over a wide line put ~10px
      of travel between one end and the other: at that spread the line does not
      *lift*, it **warps**, and Josh's review called it. The amplitude is now 3,
      and the per-word phase is compressed so the extreme words can never differ
      by more than `MAX_SPREAD_PX` — the crest still crosses the line left to
      right, but as one thing breathing rather than as letters on water.
   3. **Direct style writes, no React state.** A per-word `y` at 30fps through
      `setState` would re-render the headline thirty times a second forever. The
      words' x-centres are measured once on mount and again on resize; the loop
      only writes transforms.

   Renders a plain `<span>` and nothing else: it *wraps* a heading rather than
   being one, so the page keeps control of the tag, the size and the single-h1
   rule. No clock (used outside a wave band), reduced motion, or off-screen →
   the words sit where the type set them and nothing is measured or subscribed. */

export type WaveTextProps = {
  children: string;
  /** Peak displacement in px. §4: ≤ 8. */
  amplitude?: number;
  className?: string;
};

/** The most the first word and the last may ever differ by. Everything about
    the effect follows from this number: at 1.5px the line reads as one plane
    tilting slightly; at 6 it reads as the words being pulled apart. */
const MAX_SPREAD_PX = 1.5;

export function WaveText({ children, amplitude = 3, className = "" }: WaveTextProps) {
  const clock = useWaveClock();
  const reduceMotion = useStaticMotion();
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const onScreen = useInView(rootRef, { margin: "120px" });
  const riding = Boolean(clock) && !reduceMotion && onScreen;

  useEffect(() => {
    if (!riding || !clock) return;
    const root = rootRef.current;
    if (!root) return;

    const words = Array.from(root.querySelectorAll<HTMLElement>("[data-wave-word]"));
    if (words.length === 0) return;

    /* x-centres relative to the **left edge of the line**, not its middle, so
       every `WaveText` under one clock — the three lines of the audit
       Statement, say — shares a phase at x=0 and the crest crosses all of them
       as one front rather than each line wobbling around its own centre. */
    let centres: number[] = [];
    /* How much of the field's spatial frequency the type actually takes. The
       field's own `k` across a 900px headline is most of a cycle, which is what
       made 6b's version warp; this scales x down until the extreme words differ
       by at most `MAX_SPREAD_PX`, and leaves short lines (where the natural
       spread is already inside the cap) untouched at 1. */
    let spread = 1;
    const measure = () => {
      const base = root.getBoundingClientRect();
      centres = words.map((word) => {
        const box = word.getBoundingClientRect();
        return box.left - base.left + box.width / 2;
      });
      const span = Math.max(...centres) - Math.min(...centres);
      /* |Δy| ≤ A·Δphase for small Δphase, so cap the phase at spread/amplitude. */
      const maxPhase = MAX_SPREAD_PX / Math.max(amplitude, 0.001);
      const natural = clock.params.k * span;
      spread = natural > maxPhase ? maxPhase / natural : 1;
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(root);

    /* `will-change` only for the duration of the ride: left on permanently it
       would hold a composited layer per word on every page that ever renders a
       WaveText, including the ones where it never animates. */
    words.forEach((word) => {
      word.style.willChange = "transform";
    });

    const unsubscribe = clock.subscribe((t) => {
      const params = { ...clock.params, amplitude };
      for (let i = 0; i < words.length; i += 1) {
        const y = waveAt(centres[i] * spread, t, params);
        words[i].style.transform = `translate3d(0,${y.toFixed(2)}px,0)`;
      }
    });

    return () => {
      ro.disconnect();
      unsubscribe();
      words.forEach((word) => {
        word.style.transform = "";
        word.style.willChange = "";
      });
    };
  }, [riding, clock, amplitude]);

  const words = children.split(/\s+/).filter(Boolean);

  return (
    <span ref={rootRef} className={className}>
      {words.map((word, i) => (
        /* The space sits *between* the inline-blocks, not inside one: inside,
           it stops being a line-break opportunity and the headline refuses to
           wrap at phone width. */
        <Fragment key={`${word}-${i}`}>
          <span data-wave-word className="inline-block">
            {word}
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}

export default WaveText;
