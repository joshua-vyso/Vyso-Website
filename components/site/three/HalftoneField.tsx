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
import { useStaticMotion } from "@/components/site/motion-preference";
import { useAfterIdle, useNearViewport, useWebGLAvailable } from "./lifecycle";

const HalftoneFlow = dynamic(
  () => import("@/src/shaders/neuform-isolated/NeuformCraftEffects").then((m) => m.HalftoneFlow),
  { ssr: false },
);

/* Static ground: an ember gradient in the field's palette covers pre-paint;
   the captured poster (`/site/halftone-poster.webp`, an authorised still of
   the exact registered component) loads ONLY in the true fallback states —
   reduced motion or no WebGL — so the ~400KB never rides along when the live
   field is about to take over. */
function StaticGround({ poster }: { poster: boolean }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-black">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 70% 62%, rgba(189,74,14,0.5), transparent 70%)," +
            "radial-gradient(60% 50% at 82% 30%, rgba(255,119,39,0.28), transparent 72%)," +
            "#000",
        }}
      />
      {poster ? (
        /* eslint-disable-next-line @next/next/no-img-element -- decorative
           fallback poster with graceful onError removal */
        <img
          src="/site/halftone-poster.webp"
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => event.currentTarget.remove()}
        />
      ) : null}
    </div>
  );
}

export function HalftoneField() {
  const staticMotion = useStaticMotion();
  const webgl = useWebGLAvailable();
  const { ref, near } = useNearViewport<HTMLDivElement>("900px");
  const idle = useAfterIdle();

  const live = !staticMotion && webgl === true && near && idle;
  const fallback = staticMotion || webgl === false;

  return (
    <div ref={ref} className="vy-hero-field" aria-hidden="true" inert>
      <StaticGround poster={fallback} />
      {live ? (
        <div className="shader-frame absolute inset-0">
          <HalftoneFlow hue={0} saturation={1.0} brightness={1.0} className="vy-halftone-frame" />
        </div>
      ) : null}
    </div>
  );
}
