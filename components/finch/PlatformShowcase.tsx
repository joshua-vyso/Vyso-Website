"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion } from "motion/react";
import { track } from "@/lib/analytics";
import { Band } from "./ground/Band";
import { FacetPlane } from "./ground/FacetPlane";
import { BriefHome } from "./showcase/BriefHome";
import { BriefMobile, MOBILE_H, MOBILE_W } from "./showcase/BriefMobile";
import { DemoCursor } from "./showcase/Cursor";
import { FindingDetail } from "./showcase/FindingDetail";

/* ── The platform showcase ───────────────────────────────────────────────────
   After five beats of "here is what Finch finds", this is the answer to "and
   where do I see it?": the product's own Brief screen, drawn at its logical
   1440×1000 and scaled into the page, playing a scripted click.

   v3 makes the demo bidirectional and driven by scroll DIRECTION rather than
   by a one-shot "it came into view". While the frame is at least 40% on
   screen: scrolling down on the Brief plays the forward demo (cursor → "Show
   6-month trend" → the finding detail, whose price chart draws itself);
   scrolling up on the detail plays it in reverse (cursor → "‹ Back to today's
   brief" → the feed, whose cards stagger back in). It can play as many times
   as the reader scrolls, which turns the section into something you can
   *scrub* rather than something you missed.

   Four rules shape the implementation:
   · The frame is a picture of the app, so inside it the PLATFORM palette and
     type scale apply, copied from `.ai/design/vyso-brief/Vyso - The Brief.dc
     .html`. Outside it, the marketing tokens are untouched.
   · Everything the demo does by itself, you can also do by hand. The two real
     buttons work, Back works, and a real interaction kills the demo in flight
     — an animation that fights the pointer is worse than no animation. Unlike
     v2 it does not disable it: the next matching scroll plays again.
   · One imperative controller owns the timeline. `phaseRef` is the state
     machine, `runRef` is the cancellation token every awaited beat checks, and
     nothing reads `window` during render.
   · Layout is reserved by aspect-ratio, not by measured height, so the section
     never shifts once the scale lands.                                      */

const FRAME_W = 1440;
const FRAME_H = 1000;

/** Where the pointer fades in for each direction, in frame coords. */
const CURSOR_START_FORWARD = { x: 980, y: 780 };
const CURSOR_START_REVERSE = { x: 120, y: 140 };

/* Forward beats, ms from the trigger. The chart's own timings live in
   FindingDetail and hang off the 2000ms view swap. */
const T_CURSOR_IN  = 600;
const T_TRAVEL     = 1000;
const T_PRESS      = 1750;
const T_SWAP       = 2000;
const T_CURSOR_OUT = 2400;

/* Reverse beats. Same shape, tightened: the reader has already seen the
   pointer once, and the back link is a shorter journey than the feed. */
const R_CURSOR_IN  = 300;
const R_TRAVEL     = 900;
const R_PRESS      = 1300;
const R_SWAP       = 1550;
const R_CURSOR_OUT = 1950;

const FADE_MS  = 250;
const PRESS_MS = 240;

/** Committed scroll travel, px, before a direction counts. Trackpad jitter
    flips sign long before it covers this, so it never reaches a trigger. */
const DIRECTION_THRESHOLD = 24;
/** Quiet period after a demo ends or is cancelled, so the tail of the same
    gesture cannot immediately start the next one. */
const REARM_MS = 400;

const FADE        = { duration: FADE_MS / 1000, ease: "easeOut" } as const;
/* `times` stays mutable: `as const` would hand `animate()` a readonly tuple,
   which its keyframe overload does not accept. */
const PRESS_PULSE = { duration: PRESS_MS / 1000, times: [0, 0.5, 1] as number[], ease: "easeOut" as const };

const sleep = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });

/** Fit a fixed logical width into whatever the container turns out to be. */
function useFitScale(logicalWidth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // A hidden variant reports 0; keeping the last good scale means the
      // frame is already sized correctly when a resize reveals it.
      if (width > 0) setScale(Math.min(1, width / logicalWidth));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [logicalWidth]);

  return [ref, scale] as const;
}

/** Centre of `el` in the frame's own 1440×1000 coordinates, so the cursor
    lands on the target at any container width. */
function frameCentre(frame: HTMLElement, el: HTMLElement) {
  const f = frame.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const s = f.width / FRAME_W || 1;
  return {
    x: (r.left - f.left + r.width / 2) / s,
    y: (r.top - f.top + r.height / 2) / s,
  };
}

/* ── Desktop (≥ lg): the scroll-driven demo ──────────────────────────────── */

function DesktopShowcase({ onPlayingChange }: { onPlayingChange: (playing: boolean) => void }) {
  const reduceMotion = useReducedMotion();
  const [frameRef, scale] = useFitScale(FRAME_W);
  const trendRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const inView = useInView(frameRef, { amount: 0.4 });

  const [view, setView] = useState<"brief" | "detail">("brief");
  const [pressed, setPressed] = useState(false);
  const [backPressed, setBackPressed] = useState(false);
  /* The feed only stages its cards once it has something to come *back* from;
     on first paint 1a is simply there. */
  const [returning, setReturning] = useState(false);

  const cursorX = useMotionValue(CURSOR_START_FORWARD.x);
  const cursorY = useMotionValue(CURSOR_START_FORWARD.y);
  const cursorOpacity = useMotionValue(0);
  const cursorScale = useMotionValue(1);

  /* The controller. All of it is refs: the scroll listener runs on every
     frame of a flick and must never depend on a re-render to see the truth. */
  const viewRef = useRef<"brief" | "detail">("brief");
  const phaseRef = useRef<"idle" | "forward" | "reverse">("idle");
  const runRef = useRef(0);
  const rearmAtRef = useRef(0);
  const lastYRef = useRef(0);
  const accumRef = useRef(0);
  const directionRef = useRef<"up" | "down" | null>(null);
  const inViewRef = useRef(false);
  /* `demo_played {direction}`, once per direction per pageview — a `Set` ref
     rather than state: it gates a `track()` call, not a re-render. */
  const playedDirectionsRef = useRef<Set<"forward" | "reverse">>(new Set());

  const showDetail = useCallback(() => {
    viewRef.current = "detail";
    setView("detail");
  }, []);

  const showBrief = useCallback(() => {
    viewRef.current = "brief";
    setReturning(true);
    setView("brief");
  }, []);

  const cancel = useCallback(() => {
    /* Bumping the run invalidates every beat the running sequence is still
       awaiting — no timer bookkeeping, and a beat can never fire late. */
    runRef.current += 1;
    phaseRef.current = "idle";
    onPlayingChange(false);
    rearmAtRef.current = performance.now() + REARM_MS;
    cursorX.stop();
    cursorY.stop();
    cursorScale.stop();
    cursorScale.set(1);
    setPressed(false);
    setBackPressed(false);
    animate(cursorOpacity, 0, FADE);
  }, [cursorOpacity, cursorScale, cursorX, cursorY, onPlayingChange]);

  const finish = useCallback((run: number) => {
    if (runRef.current !== run) return;
    phaseRef.current = "idle";
    onPlayingChange(false);
    rearmAtRef.current = performance.now() + REARM_MS;
  }, [onPlayingChange]);

  const placeCursor = useCallback(
    (at: { x: number; y: number }) => {
      cursorX.stop();
      cursorY.stop();
      cursorScale.stop();
      cursorX.set(at.x);
      cursorY.set(at.y);
      cursorScale.set(1);
      cursorOpacity.set(0);
    },
    [cursorOpacity, cursorScale, cursorX, cursorY],
  );

  const playForward = useCallback(async () => {
    const frame = frameRef.current;
    const button = trendRef.current;
    if (!frame || !button) return;

    const run = ++runRef.current;
    phaseRef.current = "forward";
    onPlayingChange(true);

    if (!playedDirectionsRef.current.has("forward")) {
      playedDirectionsRef.current.add("forward");
      track("demo_played", { direction: "forward" });
    }

    if (reduceMotion) {
      showDetail();
      finish(run);
      return;
    }

    placeCursor(CURSOR_START_FORWARD);
    await sleep(T_CURSOR_IN);
    if (runRef.current !== run) return;

    /* Measured here rather than at mount: the rects are only trustworthy once
       the frame has settled at its final scale. */
    const target = frameCentre(frame, button);
    animate(cursorOpacity, 1, FADE);
    animate(cursorX, target.x, { duration: T_TRAVEL / 1000, ease: "easeOut" });
    animate(cursorY, target.y, { duration: T_TRAVEL / 1000, ease: "easeOut" });

    await sleep(T_PRESS - T_CURSOR_IN);
    if (runRef.current !== run) return;
    setPressed(true);
    animate(cursorScale, [1, 0.88, 1], PRESS_PULSE);

    await sleep(T_SWAP - T_PRESS);
    if (runRef.current !== run) return;
    setPressed(false);
    showDetail();

    await sleep(T_CURSOR_OUT - T_SWAP);
    if (runRef.current !== run) return;
    animate(cursorOpacity, 0, FADE);

    await sleep(FADE_MS);
    finish(run);
  }, [cursorOpacity, cursorScale, cursorX, cursorY, finish, frameRef, onPlayingChange, placeCursor, reduceMotion, showDetail]);

  const playReverse = useCallback(async () => {
    const frame = frameRef.current;
    const button = backRef.current;
    if (!frame || !button) return;

    const run = ++runRef.current;
    phaseRef.current = "reverse";
    onPlayingChange(true);

    if (!playedDirectionsRef.current.has("reverse")) {
      playedDirectionsRef.current.add("reverse");
      track("demo_played", { direction: "reverse" });
    }

    if (reduceMotion) {
      showBrief();
      finish(run);
      return;
    }

    placeCursor(CURSOR_START_REVERSE);
    await sleep(R_CURSOR_IN);
    if (runRef.current !== run) return;

    const target = frameCentre(frame, button);
    animate(cursorOpacity, 1, FADE);
    animate(cursorX, target.x, { duration: R_TRAVEL / 1000, ease: "easeOut" });
    animate(cursorY, target.y, { duration: R_TRAVEL / 1000, ease: "easeOut" });

    await sleep(R_PRESS - R_CURSOR_IN);
    if (runRef.current !== run) return;
    setBackPressed(true);
    animate(cursorScale, [1, 0.88, 1], PRESS_PULSE);

    await sleep(R_SWAP - R_PRESS);
    if (runRef.current !== run) return;
    setBackPressed(false);
    showBrief();

    await sleep(R_CURSOR_OUT - R_SWAP);
    if (runRef.current !== run) return;
    animate(cursorOpacity, 0, FADE);

    await sleep(FADE_MS);
    finish(run);
  }, [cursorOpacity, cursorScale, cursorX, cursorY, finish, frameRef, onPlayingChange, placeCursor, showBrief, reduceMotion]);

  /* The one rule, in one place: a committed direction + the matching view +
     an idle, re-armed controller. Everything else is plumbing. */
  const consider = useCallback(
    (direction: "up" | "down") => {
      if (!inViewRef.current) return;
      if (phaseRef.current !== "idle") return;
      if (performance.now() < rearmAtRef.current) return;
      if (direction === "down" && viewRef.current === "brief") void playForward();
      else if (direction === "up" && viewRef.current === "detail") void playReverse();
    },
    [playForward, playReverse],
  );

  useEffect(() => {
    inViewRef.current = inView;
    /* A reader who scrolls the frame into place and stops gets no further
       scroll events, so the crossing itself has to re-ask the question with
       the direction they arrived on. */
    if (inView && directionRef.current) consider(directionRef.current);
  }, [consider, inView]);

  useEffect(() => {
    lastYRef.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastYRef.current;
      lastYRef.current = y;
      if (dy === 0) return;
      /* A sign flip restarts the count, so jitter can never accumulate its
         way to a trigger — only DIRECTION_THRESHOLD px of committed travel
         one way does. */
      accumRef.current = Math.sign(dy) === Math.sign(accumRef.current) ? accumRef.current + dy : dy;
      if (Math.abs(accumRef.current) < DIRECTION_THRESHOLD) return;
      const direction = accumRef.current > 0 ? "down" : "up";
      accumRef.current = 0;
      directionRef.current = direction;
      consider(direction);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [consider]);

  /* Unmounting invalidates whatever is in flight, so no beat lands on a
     component that is gone. */
  useEffect(() => () => { runRef.current += 1; }, []);

  const openDetail = useCallback(() => {
    cancel();
    showDetail();
  }, [cancel, showDetail]);

  const backToBrief = useCallback(() => {
    cancel();
    showBrief();
  }, [cancel, showBrief]);

  const brief = (
    <BriefHome
      onOpenDetail={openDetail}
      trendRef={trendRef}
      trendPressed={pressed}
      staggerCards={returning && !reduceMotion}
    />
  );
  const detail = (
    <FindingDetail
      onBack={backToBrief}
      backRef={backRef}
      backPressed={backPressed}
      animateChart={!reduceMotion}
    />
  );

  return (
    <div
      ref={frameRef}
      onPointerDownCapture={cancel}
      /* Escape is the escape hatch: the reader has focus inside the frame and
         wants the pointer to stop moving under their hands. Every other key
         that can activate a real control routes through its onClick, which
         cancels there. */
      onKeyDownCapture={(event) => { if (event.key === "Escape") cancel(); }}
      /* A deep, cold shadow rather than the paper one: the frame now floats on
         a blue band, and a warm grey drop shadow on `#1F5FA8` reads as a dirty
         edge instead of as height (§2). */
      className="relative w-full overflow-hidden rounded-[20px] border border-[#E4E9F0] bg-white shadow-[0_30px_80px_-20px_rgba(6,20,45,0.55)]"
      style={{ aspectRatio: `${FRAME_W} / ${FRAME_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: FRAME_W, height: FRAME_H, transform: `scale(${scale})` }}
      >
        {reduceMotion ? (
          <div className="absolute inset-0">{view === "brief" ? brief : detail}</div>
        ) : (
          /* Both halves are mounted through the swap, so 1c's fade-out and
             1a's fade-in overlap. Remounting also means the chart always
             draws from zero — an interrupted draw leaves nothing behind. */
          <AnimatePresence initial={false}>
            {view === "brief" ? (
              <motion.div
                key="brief"
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1, transition: { duration: 0.32, ease: "easeOut" } }}
                exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.32, ease: "easeOut" } }}
              >
                {brief}
              </motion.div>
            ) : (
              <motion.div
                key="detail"
                className="absolute inset-0"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.38, delay: 0.06, ease: "easeOut" } }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.26, ease: "easeOut" } }}
              >
                {detail}
              </motion.div>
            )}
          </AnimatePresence>
        )}
        {reduceMotion ? null : (
          <DemoCursor x={cursorX} y={cursorY} opacity={cursorOpacity} scale={cursorScale} />
        )}
      </div>
    </div>
  );
}

/* ── Below lg: the design's phone-width screen, tapped rather than clicked ── */

function MobileShowcase() {
  const [frameRef, scale] = useFitScale(MOBILE_W);
  return (
    <div
      ref={frameRef}
      className="relative mx-auto w-full max-w-[390px] overflow-hidden rounded-[20px] border border-[#E4E9F0] bg-white shadow-[0_18px_50px_-18px_rgba(6,20,45,0.55)]"
      style={{ aspectRatio: `${MOBILE_W} / ${MOBILE_H}` }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: MOBILE_W, height: MOBILE_H, transform: `scale(${scale})` }}
      >
        <BriefMobile />
      </div>
    </div>
  );
}

/* ── Section ─────────────────────────────────────────────────────────────── */

/* ── The band ────────────────────────────────────────────────────────────────
   6b puts this section on the homepage's one **blue** ground (§7): deep blue
   given structure by a `FacetPlane` rather than a wash, with the app frame
   floating on it. The seam is upward — the band's 24px top radius rises 48px
   into the scroll sequence above it, so the sequence's phone appears to come to
   rest on the join rather than to stop above a hard cut.

   **The facets yield to the demo.** §3's budget is two moving things per
   viewport and a band's background is one of them; the Brief demo — a
   travelling cursor, a view swap and a chart drawing itself — is unambiguously
   the other, and while it is running it is what the reader is meant to be
   watching. So `playing` gates `FacetPlane`'s `paused`: drift stops the moment
   a demo starts and resumes when it finishes or is cancelled. Without that the
   band would read 2 for its whole life and offer the reader a choice of two
   things to follow at the exact moment it has something to say.

   `playing` state lives here rather than inside `DesktopShowcase` because the
   band is this component's, and the mobile variant has no demo at all — on a
   phone the facets simply never pause, because nothing else in the band is
   moving.                                                                     */
export function PlatformShowcase() {
  const [playing, setPlaying] = useState(false);

  return (
    <Band
      ground="blue"
      seam
      device={<FacetPlane seed={31} paused={playing} />}
      intrinsicHeight={900}
    >
      <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-blue-mono lg:text-[11px]">
        THE BRIEF · WHAT YOU OPEN EVERY MORNING
      </div>
      <h2 className="m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-fn-blue-text lg:text-[38px]">
        Finch is ready to go, whenever you need it.
      </h2>
      <p className="m-0 mb-[32px] max-w-[560px] text-[15.5px] leading-[1.65] text-fn-blue-text-2 lg:mb-[40px]">
        One screen. Today&rsquo;s findings, ranked by rand impact, each with its evidence a click
        away — and a chat bar underneath for anything else.
      </p>

      {/* Both variants are always in the DOM: `display:none` keeps the wrong
          one out of the layout AND out of IntersectionObserver, so the demo
          and the tap nudge each fire only on the surface they belong to —
          no viewport measurement at render, nothing to get wrong on the
          server. */}
      <div className="hidden lg:block">
        <DesktopShowcase onPlayingChange={setPlaying} />
      </div>
      <div className="lg:hidden">
        <MobileShowcase />
      </div>

      <div className="mt-[10px] text-right font-fn-mono text-[10px] tracking-[0.1em] text-fn-blue-mono">
        ILLUSTRATIVE · DEMO DATA
      </div>
    </Band>
  );
}

export default PlatformShowcase;
