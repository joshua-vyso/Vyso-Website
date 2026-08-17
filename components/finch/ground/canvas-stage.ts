"use client";

import { useEffect, useRef } from "react";

import { recordFrameCost, useMotionBudget } from "./motion-budget";
import type { WaveClock } from "./wave-clock";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The canvas stage ────────────────────────────────────────────────────────
   Every canvas device on the site runs through this hook, so the whole §3
   contract lives in one place instead of being re-argued five times:

   - **DPR capped at 1.5.** A 3× retina backing store for a background texture
     is nine times the fill for a difference nobody can see.
   - **~30fps with a delta clamp.** These are ambient fields, not UI feedback;
     30 is indistinguishable at these speeds and halves the paint budget. The
     clamp stops a tab that was backgrounded for a minute from advancing the
     wave by a minute in one frame.
   - **Paused the moment it leaves the viewport, and when the tab is hidden.**
     An `IntersectionObserver` with no margin and a 10%-of-itself threshold,
     plus `visibilitychange`. Both numbers were measured rather than guessed on
     `/design`'s counter: a 200px warm-up margin put three devices inside the
     §3 two-moving-things budget at every band boundary, and dropping the margin
     still left three whenever a 30px sliver of the band above was on screen.
     There is nothing to warm up — `Deferred` already mounts the device a
     viewport early and a resumed stage re-initialises nothing — so the strict
     gate costs nothing and keeps the budget honest.
   - **Reduced motion draws exactly one frame at t=0** and never starts a loop —
     not a slower loop, no loop. The static frame is a real picture (a grid, a
     wave, a field), which is why every device's t=0 state is composed rather
     than empty.
   - **Resize repaints at the current t**, so a rotation or a devtools drag
     never blanks the band for a frame.

   `draw` must be a `useCallback` at the call site: it is an effect dependency,
   so an inline closure would tear down and rebuild the loop on every render.   */

export type StageFrame = {
  /** CSS pixels. The context is pre-scaled, so draw in these. */
  w: number;
  h: number;
  /** Seconds since the loop started, delta-clamped. 0 under reduced motion. */
  t: number;
  dpr: number;
  /** For devices that need to relate the canvas to another element (the grid's
      text mask). Reading its rect inside the rAF body is free — nothing in a
      draw invalidates layout. */
  canvas: HTMLCanvasElement;
};

export type DrawFn = (ctx: CanvasRenderingContext2D, frame: StageFrame) => void;

/** §9: "DPR ≤ 1.5". */
export const MAX_DPR = 1.5;

const FRAME_MS = 1000 / 30;
/** A frame that claims more than 100ms of elapsed time was a stall, not motion. */
const MAX_DELTA_MS = 100;
/** How much of a device must be on screen before it is worth animating. */
const VISIBLE_RATIO = 0.1;

export function useCanvasStage(
  draw: DrawFn,
  options: {
    /** What the motion-budget counter calls this device. */
    label: string;
    /** When given, the stage paints on this clock's ticks instead of running
        its own rAF — so a `WaveField` and the `WaveText` riding it share one
        loop, one phase and one entry in the motion budget. */
    clock?: WaveClock | null;
    /** Paint one frame at t=0 and never loop — the same path reduced motion
        takes, taken deliberately (the footer's static wave, §8). */
    frozen?: boolean;
    /** Multiplier on the (already capped) DPR. Below 1 for devices that are
        pure gradient and have no edge to soften — the ribbon fills the whole
        canvas four times a frame, and at 0.6 it does so for a third of the
        pixels with no visible difference. */
    dprScale?: number;
  },
) {
  const { label, clock, frozen = false, dprScale = 1 } = options;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useStaticMotion();
  const budget = useMotionBudget();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let t = 0;
    let onScreen = false;
    let tabVisible = !document.hidden;
    let release: (() => void) | null = null;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const paint = () => {
      if (w === 0 || h === 0) return;
      const started = performance.now();
      ctx.clearRect(0, 0, w, h);
      draw(ctx, { w, h, t, dpr, canvas });
      recordFrameCost(performance.now() - started);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextW = Math.max(1, Math.round(rect.width));
      const nextH = Math.max(1, Math.round(rect.height));
      const nextDpr = Math.min(window.devicePixelRatio || 1, MAX_DPR) * dprScale;
      if (nextW === w && nextH === h && nextDpr === dpr) return;
      w = nextW;
      h = nextH;
      dpr = nextDpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      /* setTransform, not scale: `scale` compounds across resizes. */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const elapsed = now - last;
      if (elapsed < FRAME_MS) return;
      /* Keep the remainder so the loop doesn't drift slow against the display. */
      last = now - (elapsed % FRAME_MS);
      t += Math.min(elapsed, MAX_DELTA_MS) / 1000;
      paint();
    };

    /* A shared clock owns the timing; the stage is only a painter. */
    const onClockTick = (clockT: number) => {
      t = clockT;
      paint();
    };

    let unsubscribe: (() => void) | null = null;

    const sync = () => {
      const shouldRun = onScreen && tabVisible && !reduceMotion && !frozen;
      if (clock) {
        /* The clock owns the rAF and the budget entry; subscribing/unsubscribing
           is how this stage starts and stops. Unsubscribing when the band leaves
           the viewport is also what lets the clock stop itself. */
        if (shouldRun && !unsubscribe) unsubscribe = clock.subscribe(onClockTick);
        else if (!shouldRun && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        return;
      }
      if (shouldRun && raf === 0) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
        release = budget?.register(label) ?? null;
      } else if (!shouldRun && raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
        release?.();
        release = null;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        /* A sliver of a band at the edge of the viewport is not something
           anyone is looking at; requiring a tenth of the device to be visible
           is what keeps two adjacent bands from ever counting as three. */
        onScreen = (entry?.isIntersecting ?? false) && entry.intersectionRatio >= VISIBLE_RATIO;
        sync();
      },
      { rootMargin: "0px", threshold: [0, VISIBLE_RATIO] },
    );
    io.observe(canvas);

    const onVisibility = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe?.();
      if (raf !== 0) cancelAnimationFrame(raf);
      release?.();
    };
  }, [draw, reduceMotion, budget, label, clock, frozen, dprScale]);

  return canvasRef;
}

/* ── Token colours in a canvas ───────────────────────────────────────────────
   Canvas has no `var()`, so a device that wants `--fn-orange` has to resolve it
   against the document. Cached module-wide: these are `:root` custom properties
   that never change at runtime, and `getComputedStyle` is the one genuinely
   expensive call in a draw. */

const tokenCache = new Map<string, string>();

/** `cssColor("--fn-orange", "#FF7727")` — the fallback is what SSR/JSDOM get. */
export function cssColor(token: string, fallback: string): string {
  const cached = tokenCache.get(token);
  if (cached) return cached;
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const resolved = value || fallback;
  tokenCache.set(token, resolved);
  return resolved;
}

/** `#RRGGBB` + alpha → `rgba(...)`. Devices vary alpha per cell every frame, and
    building a string is cheaper than switching `globalAlpha` per cell. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}
