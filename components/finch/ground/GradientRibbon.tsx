"use client";

import dynamic from "next/dynamic";

import { Deferred } from "./Deferred";
import type { GradientRibbonProps } from "./impl/GradientRibbonCanvas";
import { useStaticMotion } from "@/components/finch/motion-preference";

const GradientRibbonCanvas = dynamic(() => import("./impl/GradientRibbonCanvas"), { ssr: false });

/** Round 3: the one `dim` every "Book your audit" tile shares — `AuditBand`
    (both variants), `pricing/AuditCta`, `compare/CooCta`. One exported
    number rather than four call sites agreeing on 0.28 by convention, same
    reasoning as `STRAIGHT_ANSWERS_OVERHANG` elsewhere in this codebase.
    Measured against `--fn-ink-text` / `--fn-ink-text-2` on the tile's own
    darkest and brightest sampled regions — see `implementation_phase6.md`,
    "6b fixes — round 3" for the numbers this value was picked to clear. */
export const CTA_TILE_DIM = 0.28;

/* §9's reduced-motion matrix says "ribbon → hairline" for the original 320px
   accent strip, and it means the *hairline*, not a frozen ribbon: a still
   frame of a mesh gradient is a smudge, whereas the orange→blue hairline is
   the same statement the rest of the site already makes and is a finished
   graphic on its own.

   Round 3 spends this component a second way — as the full-bleed background
   of a CTA tile, dimmed via `dim` — and a 3px hairline in the middle of that
   tile would read as an accent line floating on a background that isn't
   there, not as "the reduced-motion form of this ground". So a tile passing
   `dim > 0` gets a full-bleed **static** gradient instead: the canvas
   version's own base stops (orange → blue-700 → blue-300), mixed toward
   `--fn-ink` by the same `dim` via `color-mix`, computed once at layout —
   there is no animation to be static about, so there is nothing to sample a
   frame from. `dim === 0` (the homepage strip's original use, still exercised
   on `/design`) keeps the hairline unchanged. */
export function GradientRibbon(props: GradientRibbonProps & { className?: string }) {
  const { className = "", dim = 0, ...rest } = props;
  const reduceMotion = useStaticMotion();

  if (reduceMotion) {
    if (dim > 0) {
      const pct = `${Math.round((1 - dim) * 100)}%`;
      return (
        <div
          aria-hidden
          className={"absolute inset-0 " + className}
          style={{
            background:
              `linear-gradient(90deg, ` +
              `color-mix(in srgb, var(--fn-orange) ${pct}, var(--fn-ink)) 0%, ` +
              `color-mix(in srgb, var(--fn-blue-700) ${pct}, var(--fn-ink)) 55%, ` +
              `color-mix(in srgb, var(--fn-blue-300) ${pct}, var(--fn-ink)) 100%)`,
          }}
        />
      );
    }
    return (
      <div aria-hidden className={"absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 " + className}>
        <div className="h-full w-full rounded-[2px]" style={{ background: "var(--fn-grad)" }} />
      </div>
    );
  }

  return (
    <Deferred className={"absolute inset-0 overflow-hidden " + className}>
      <GradientRibbonCanvas {...rest} dim={dim} />
    </Deferred>
  );
}

export type { GradientRibbonProps };
export default GradientRibbon;
