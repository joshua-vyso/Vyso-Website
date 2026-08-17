"use client";

import { useCallback } from "react";

import { cssColor, useCanvasStage, withAlpha, type StageFrame } from "../canvas-stage";

/* ── The gradient ribbon ─────────────────────────────────────────────────────
   §3, the "plus": the site's one orange→blue moment, a Stripe-style flowing
   mesh confined to a ~320px strip and used on exactly one band sitewide (the
   homepage closing CTA). Everywhere else the orange→blue relationship is stated
   by the 3px hairline, not a gradient.

   Built as four soft radial stops drifting on independent value-noise paths
   over a base linear gradient. That is the cheap approximation of a mesh
   gradient: four `createRadialGradient` fills a frame at 30fps on a 320px strip
   is a fraction of a millisecond, where a real mesh means a fragment shader.

   **On escalating to `three`:** the plan's decision (§11, §1.4) is canvas 2D
   first, WebGL only if this demonstrably misses the bar — and `three` was
   uninstalled in phase 5, so escalating means reinstalling a ~150KB dependency
   for one strip on one page. If Josh judges this insufficient after seeing it
   on `/design`, the escalation path is a single fragment shader on a
   `<canvas webgl2>` (no `three` needed for a full-screen quad, and `three` is
   the wrong tool for one quad anyway) — not this component with more stops.

   The noise is inline on purpose: `simplex-noise` is a dependency for ~30 lines
   of hashing, and the plan allows exactly one new dep (Lenis).                 */

export type GradientRibbonProps = {
  /** Peak alpha of the moving stops over the base gradient. */
  intensity?: number;
  /** Seconds per full drift cycle, roughly. Slower reads richer. */
  speed?: number;
  /** 0–1. Round 3 (Josh: gradient as the background of every closing "Book
      your audit" tile): multiplies every stop toward `--fn-ink`, linearly, so
      the ribbon can sit dimmed behind warm-white copy instead of only as the
      bright 320px accent strip it shipped as. 0 (default) is that original
      strip, unchanged. `GradientRibbon.tsx` exports `CTA_TILE_DIM` (0.28),
      the one number the three CTA tiles share. */
  dim?: number;
};

/** `#RRGGBB` → `[r, g, b]`. Local to this file — `withAlpha` below already
    does the same string surgery for the alpha case; this is the "mix two
    hexes" case `dim` needs and nowhere else in the codebase does. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Linear-interpolates `hex` toward `toward` by `amount` (0 = `hex` unchanged,
    1 = `toward` exactly). This is what "multiplies the palette toward ink"
    means in practice: a stop mixed most of the way to `--fn-ink` and then
    composited over an ink ground at its usual alpha all but disappears,
    which is the point — dimming the hue, not just the opacity, is what keeps
    the gradient from reading as "the same gradient with a dark filter". */
function mixToward(hex: string, toward: string, amount: number): string {
  if (amount <= 0) return hex;
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(toward);
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * amount);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(lerp(r1, r2))}${toHex(lerp(g1, g2))}${toHex(lerp(b1, b2))}`;
}

/* ── Value noise ─────────────────────────────────────────────────────────────
   A hash-and-smoothstep 2D value noise. Not simplex — for four drifting points
   the difference is invisible, and this is a dozen lines with no gradient
   tables to get wrong. Deterministic: no `Math.random` anywhere. */

function hash(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const smooth = (f: number) => f * f * (3 - 2 * f);

function noise2(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Four stops: two orange, two blue, with their own noise offsets and radii so
    the strip never settles into a symmetry. */
const STOPS = [
  { token: "--fn-orange",   fallback: "#FF7727", seed: 0.0,  radius: 0.62, weight: 1.0 },
  { token: "--fn-blue-300", fallback: "#3E7BC4", seed: 11.3, radius: 0.70, weight: 0.9 },
  { token: "--fn-orange",   fallback: "#FF7727", seed: 27.9, radius: 0.44, weight: 0.6 },
  { token: "--fn-blue-700", fallback: "#1F5FA8", seed: 41.2, radius: 0.80, weight: 0.8 },
] as const;

export function GradientRibbonCanvas({ intensity = 0.5, speed = 0.06, dim = 0 }: GradientRibbonProps) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { w, h, t }: StageFrame) => {
      const ink = cssColor("--fn-ink", "#14120E");

      /* Base: the site's own orange→blue, at a low alpha so the ink ground
         still reads as ink and the ribbon reads as light across it. Each stop
         is mixed toward ink by `dim` first — see `mixToward` above. */
      const base = ctx.createLinearGradient(0, 0, w, 0);
      base.addColorStop(0, withAlpha(mixToward(cssColor("--fn-orange", "#FF7727"), ink, dim), 0.16));
      base.addColorStop(0.5, withAlpha(mixToward(cssColor("--fn-blue-700", "#1F5FA8"), ink, dim), 0.10));
      base.addColorStop(1, withAlpha(mixToward(cssColor("--fn-blue-300", "#3E7BC4"), ink, dim), 0.16));
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      /* `lighter` is what turns four overlapping washes into a mesh instead of
         four visible discs — the overlaps brighten rather than occlude. */
      ctx.globalCompositeOperation = "lighter";
      const time = t * speed;

      for (const stop of STOPS) {
        /* Each stop wanders the strip on two decorrelated noise channels. The
           ×1.4/−0.2 spread lets a stop drift off the edge, so the strip is
           never a row of four evenly-spaced blobs. */
        const nx = noise2(stop.seed + time, stop.seed * 0.5);
        const ny = noise2(stop.seed * 0.7, stop.seed + time * 1.3);
        const cx = (nx * 1.4 - 0.2) * w;
        const cy = (ny * 1.2 - 0.1) * h;
        const r = stop.radius * Math.max(w * 0.4, h);

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const hex = mixToward(cssColor(stop.token, stop.fallback), ink, dim);
        grad.addColorStop(0, withAlpha(hex, intensity * stop.weight * 0.5));
        grad.addColorStop(0.55, withAlpha(hex, intensity * stop.weight * 0.16));
        grad.addColorStop(1, withAlpha(hex, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = "source-over";
    },
    [intensity, speed, dim],
  );

  /* 0.6× the capped DPR: four full-canvas radial fills a frame is by far the
     most expensive draw of the five devices (measured at 4.7ms worst-frame on
     `/design` at full DPR, against a < 4ms budget), and a mesh gradient is the
     one thing on the page with no edge to lose. */
  const ref = useCanvasStage(draw, { label: "GradientRibbon", dprScale: 0.6 });

  return <canvas ref={ref} className="block h-full w-full" />;
}

export default GradientRibbonCanvas;
