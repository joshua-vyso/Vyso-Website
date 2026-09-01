"use client";

/* ── Hero environment: ThreeUI Halftone Flow, exact source ───────────────────
   Mounts the registered `HalftoneFlow` component (PredictiveArcCanvas,
   variant "halftone-flow" — `src/shaders/neuform-isolated/
   NeuformCraftEffects.tsx`, hash-verified) as the full-bleed hero field with
   the brief's configured invocation: hue 0 / saturation 1.00 / brightness
   1.00, preserving the authored red-orange flow and six-pixel halftone
   matrix.

   The wrapper owns everything the registered file doesn't: reduced-motion and
   WebGL-unavailable fallbacks (a static poster layer), lazy unmount once the
   hero is scrolled far out of view, and a paint-in so the iframe never pops.
   Essential hero copy lives OUTSIDE this layer in semantic DOM. */

import dynamic from "next/dynamic";
import { useStaticMotion } from "@/components/finch/motion-preference";
import { useNearViewport, useWebGLAvailable } from "./lifecycle";

const HalftoneFlow = dynamic(
  () => import("@/src/shaders/neuform-isolated/NeuformCraftEffects").then((m) => m.HalftoneFlow),
  { ssr: false },
);

/* Static ground shown before the field paints, under reduced motion, and when
   WebGL is unavailable: a quiet ember gradient in the field's own palette so
   the hero is never a flat void. (A captured poster of the authored frame can
   replace the gradient by dropping `/site/halftone-poster.webp` in place —
   the <img> below prefers it and falls back silently.) */
function StaticGround() {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative
          poster with graceful onError removal; next/image would render its
          own error UI */}
      <img
        src="/site/halftone-poster.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={(event) => event.currentTarget.remove()}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 70% 62%, rgba(189,74,14,0.5), transparent 70%)," +
            "radial-gradient(60% 50% at 82% 30%, rgba(255,119,39,0.28), transparent 72%)," +
            "#000",
        }}
      />
    </div>
  );
}

export function HalftoneField() {
  const staticMotion = useStaticMotion();
  const webgl = useWebGLAvailable();
  const { ref, near } = useNearViewport<HTMLDivElement>("900px");

  const live = !staticMotion && webgl === true && near;

  return (
    <div ref={ref} className="vy-hero-field" aria-hidden="true">
      <StaticGround />
      {live ? (
        <div className="shader-frame absolute inset-0">
          <HalftoneFlow hue={0} saturation={1.0} brightness={1.0} className="vy-halftone-frame" />
        </div>
      ) : null}
    </div>
  );
}
