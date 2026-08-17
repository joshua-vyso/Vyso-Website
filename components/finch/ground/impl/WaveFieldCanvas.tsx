"use client";

import { useCallback } from "react";

import { cssColor, useCanvasStage, withAlpha, type StageFrame } from "../canvas-stage";
import { DEFAULT_WAVE_PARAMS, useWaveClock, waveAt } from "../wave-clock";

/* ── The wave field ──────────────────────────────────────────────────────────
   §3.2. Eight to fourteen horizontal sine lines across the band, each
   `y = base_i + A·sin(x·k + t·ω + φ_i)` with a slight per-line phase so the
   field has depth instead of reading as one thick rope.

   The line is drawn in 12px steps rather than per pixel: at A ≤ 24px and
   k = 0.008 the curve's second derivative is small enough that a 12px polyline
   is visually identical to a 1px one, and it is roughly a twelfth of the path
   commands. On a 1400px band that is the difference between ~1,200 segments a
   frame and ~14,000.

   Reads the shared clock when there is one (so `WaveText` rides the same sine —
   §4.1) and falls back to its own stage clock when used alone, e.g. the footer,
   which passes `static` and never loops at all.                               */

export type WaveFieldProps = {
  lines?: number;
  amplitude?: number;
  speed?: number;
  color?: string;
  colorFallback?: string;
  opacity?: number;
  /** Draw one frame and stop — the footer's frame (§8). */
  static?: boolean;
};

const STEP = 12;

export function WaveFieldCanvas({
  lines = 10,
  amplitude = 16,
  speed = 0.5,
  color = "--fn-orange",
  colorFallback = "#FF7727",
  opacity = 0.35,
  static: isStatic = false,
}: WaveFieldProps) {
  const shared = useWaveClock();
  const clock = isStatic ? null : shared;

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { w, h, t }: StageFrame) => {
      const hex = cssColor(color, colorFallback);
      /* When a clock is present its params win: `WaveText` computes its own y
         from those same numbers, and a field drawing a different k would put
         the type on a crest the lines never reach. */
      const params = clock ? clock.params : { k: DEFAULT_WAVE_PARAMS.k, omega: speed, amplitude };
      const time = isStatic ? 0 : t;
      /* Lines are inset by one amplitude top and bottom so a crest never
         touches the band edge, where it would read as a clipped shape. */
      const usable = h - params.amplitude * 2;
      const gap = usable / (lines - 1 || 1);

      ctx.lineWidth = 1;
      ctx.lineCap = "round";

      for (let i = 0; i < lines; i += 1) {
        const base = params.amplitude + i * gap;
        /* Golden-ratio phase stepping: any rational step eventually puts two
           lines exactly in phase and they visibly fuse. */
        const phase = i * 2.39996;
        /* The middle of the field is brightest, so the band has a horizon
           rather than a uniform hatch. */
        const centreBias = 1 - Math.abs(i / (lines - 1 || 1) - 0.5) * 0.9;
        ctx.strokeStyle = withAlpha(hex, opacity * centreBias);
        ctx.beginPath();
        for (let x = 0; x <= w + STEP; x += STEP) {
          const y = base + waveAt(x, time, params, phase);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    [lines, amplitude, speed, color, colorFallback, opacity, isStatic, clock],
  );

  const ref = useCanvasStage(draw, { label: "WaveField", clock, frozen: isStatic });

  return <canvas ref={ref} className="block h-full w-full" />;
}

export default WaveFieldCanvas;
