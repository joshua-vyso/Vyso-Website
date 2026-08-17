"use client";

import { useCallback, useEffect, useRef } from "react";

import { cssColor, useCanvasStage, withAlpha, type StageFrame } from "../canvas-stage";

/* ── The oscillating grid ────────────────────────────────────────────────────
   §3.1. A lattice at a 22–28px pitch where each cell's brightness is
   `0.5 + 0.5·sin(t·ω + dist(cell, origin)·k)` — one slow wave rolling out from
   an origin every ~8s. Two modes: `dots` (2px, the calm default) and `squares`
   (grid lines that brighten in a wave, bolder, for an ink CTA band only).

   Three things here are not decoration:

   1. **The origin eases toward the pointer** when `cursor` is on. Easing, not
      following — the field responds to where you are without becoming a
      cursor-tracker, which §4 rules out explicitly.
   2. **Cells near the headline are dimmed 40%** when a `maskRef` is given
      (§3.1 + §4.3). This is what makes type read as *in* the field rather than
      on top of it, and it is also the only reason the type stays legible over a
      bright crest.
   3. **A distance-keyed phase, not a per-cell random.** Random per-cell phase
      is noise; distance phase is a wave, and a wave is a thing your eye can
      follow across a 1400px band.                                             */

export type OscillatingGridProps = {
  mode?: "dots" | "squares";
  /** A CSS custom property name. Resolved once against `:root`. */
  color?: string;
  /** Fallback for the token, and what SSR would use if this ever ran there. */
  colorFallback?: string;
  pitch?: number;
  /** Radians per second. 0.6 rolls a crest across the band every ~8s. */
  speed?: number;
  /** Peak alpha at a crest. §2: 20–35% on ink, 25–40% on blue. */
  opacity?: number;
  cursor?: boolean;
  /** Cells within 80px of this element's box are dimmed 40%. */
  maskRef?: React.RefObject<HTMLElement | null>;
};

/** Radians per pixel of distance from the origin. Tuned so a 1400px band shows
    roughly one and a half crests — more reads as stripes, less as a flat pulse. */
const DIST_K = 0.006;
const MASK_RADIUS = 80;
const MASK_DIM = 0.4;

/* ── Why this draws in buckets ───────────────────────────────────────────────
   A 1425 × 780 band at a 24px pitch is ~1,950 cells. Drawn one at a time —
   build an `rgba()` string, set `fillStyle`, `beginPath`, `arc`, `fill` — that
   measured **3.27ms mean and 6.20ms worst** on `/design`, against §9's < 4ms
   budget, and `fillStyle` assignment was most of it: every write is a colour
   parse and a paint-state invalidation.

   So cells are quantised into 20 brightness levels (× 2 for masked cells), all
   the cells at one level go into one path, and each level costs exactly one
   `fillStyle` write and one `fill()`. 40 state changes a frame instead of
   1,950. Twenty levels across a field whose peak alpha is 0.3 is a step of
   0.015 — well below what an eye resolves on a background texture. Re-measured
   after the change: 0.44ms mean / 0.80ms worst for a plain field, 1.45 / 3.00
   for one also carrying the cursor origin and the text mask (both of which read
   a `getBoundingClientRect` per frame). */
const LEVELS = 20;

export function OscillatingGridCanvas({
  mode = "dots",
  color = "--fn-orange",
  colorFallback = "#FF7727",
  pitch = 24,
  speed = 0.6,
  opacity = 0.3,
  cursor = false,
  maskRef,
}: OscillatingGridProps) {
  /* The wave origin, in canvas-local CSS pixels. A ref, not state: it changes
     on every pointer move and every animation frame, and none of those should
     re-render React. `null` means "not yet placed" — the first paint centres
     it, which needs the canvas size the ref doesn't have yet. */
  const origin = useRef<{ x: number; y: number } | null>(null);
  const target = useRef<{ x: number; y: number } | null>(null);
  /* 2 × LEVELS flat [x, y, x, y, …] lists, allocated once. */
  const bucketsRef = useRef<number[][]>(Array.from({ length: LEVELS * 2 }, () => []));

  useEffect(() => {
    if (!cursor) return;
    const onMove = (event: PointerEvent) => {
      /* Stored in client coordinates and converted at draw time: the canvas may
         have scrolled between the move and the frame that consumes it. */
      target.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [cursor]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { w, h, t, canvas }: StageFrame) => {
      const hex = cssColor(color, colorFallback);

      if (!origin.current) origin.current = { x: w / 2, y: h / 2 };
      if (cursor && target.current) {
        const rect = canvas.getBoundingClientRect();
        const tx = target.current.x - rect.left;
        const ty = target.current.y - rect.top;
        /* Spring 0.08 — slow enough that a fast mouse sweep leaves the field
           still travelling after the pointer has stopped. */
        origin.current.x += (tx - origin.current.x) * 0.08;
        origin.current.y += (ty - origin.current.y) * 0.08;
      }
      const ox = origin.current.x;
      const oy = origin.current.y;

      /* The mask box, in canvas-local pixels. Read once per frame, before any
         drawing — nothing in a canvas paint invalidates layout, so this is a
         cached-layout read, not a forced reflow. */
      let mask: { left: number; top: number; right: number; bottom: number } | null = null;
      const maskEl = maskRef?.current;
      if (maskEl) {
        const canvasRect = canvas.getBoundingClientRect();
        const box = maskEl.getBoundingClientRect();
        mask = {
          left:   box.left   - canvasRect.left - MASK_RADIUS,
          top:    box.top    - canvasRect.top  - MASK_RADIUS,
          right:  box.right  - canvasRect.left + MASK_RADIUS,
          bottom: box.bottom - canvasRect.top  + MASK_RADIUS,
        };
      }

      const cols = Math.ceil(w / pitch) + 1;
      const rows = Math.ceil(h / pitch) + 1;

      /* One bucket per brightness level, doubled: the upper half is the masked
         set, which shares a level's radius but not its alpha. Reused across
         frames (a fresh array of 40 arrays per frame would be 30 allocations a
         second of pure garbage). */
      const buckets = bucketsRef.current;
      for (let i = 0; i < buckets.length; i += 1) buckets[i].length = 0;

      for (let cx = 0; cx < cols; cx += 1) {
        const x = cx * pitch;
        for (let cy = 0; cy < rows; cy += 1) {
          const y = cy * pitch;
          const dx = x - ox;
          const dy = y - oy;
          /* `sqrt` rather than `Math.hypot`: hypot guards against overflow with
             a scaling pass that costs several times a plain sqrt, and these are
             screen coordinates. */
          const dist = Math.sqrt(dx * dx + dy * dy);
          const wave = 0.5 + 0.5 * Math.sin(t * speed - dist * DIST_K);
          const level = (wave * (LEVELS - 1)) | 0;
          const masked =
            mask !== null && x > mask.left && x < mask.right && y > mask.top && y < mask.bottom;
          const bucket = buckets[masked ? level + LEVELS : level];
          bucket.push(x, y);
        }
      }

      const squares = mode === "squares";
      if (squares) ctx.lineWidth = 1;

      for (let i = 0; i < buckets.length; i += 1) {
        const bucket = buckets[i];
        if (bucket.length === 0) continue;
        const level = i % LEVELS;
        const wave = level / (LEVELS - 1);
        const alpha = wave * opacity * (i >= LEVELS ? 1 - MASK_DIM : 1);
        if (alpha < 0.012) continue; // below this it is a wasted fill, not a dot
        const colour = withAlpha(hex, alpha);
        ctx.beginPath();
        if (squares) {
          for (let n = 0; n < bucket.length; n += 2) {
            /* Half-pixel offset so a 1px stroke lands on a device pixel rather
               than straddling two and rendering as a 2px smear. */
            ctx.rect(bucket[n] + 0.5, bucket[n + 1] + 0.5, pitch, pitch);
          }
          ctx.strokeStyle = colour;
          ctx.stroke();
        } else {
          /* Scale as well as opacity: a dot that only fades reads as a flicker;
             one that also grows reads as something breathing. */
          const r = 1 + wave * 0.6;
          for (let n = 0; n < bucket.length; n += 2) {
            ctx.moveTo(bucket[n] + r, bucket[n + 1]);
            ctx.arc(bucket[n], bucket[n + 1], r, 0, Math.PI * 2);
          }
          ctx.fillStyle = colour;
          ctx.fill();
        }
      }
    },
    [mode, color, colorFallback, pitch, speed, opacity, cursor, maskRef, bucketsRef],
  );

  const ref = useCanvasStage(draw, { label: "OscillatingGrid" });

  return <canvas ref={ref} className="block h-full w-full" />;
}

export default OscillatingGridCanvas;
