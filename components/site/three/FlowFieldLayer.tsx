"use client";

/* ── Testimonial-section atmosphere: ThreeUI Flow Field, exact source ────────
   Mounts the registered `FlowField` (PortalFieldCollection variant
   "flow-field" — `src/shaders/neuform-isolated/NeuformBatchEffects.tsx`,
   hash-verified) with the brief's configured invocation: speed/size/length/
   density/opacity all 1.00, hue 0 / saturation 1.00 / brightness 1.00 — the
   warm amber, gold and coral particles tracing the authored simplex-noise
   field.

   Purely an atmospheric layer: testimonial copy is semantic HTML rendered
   ABOVE it, never into the canvas. The wrapper mounts the renderer only when
   the section nears the viewport and unmounts it once far offscreen (the
   authored document keeps its own loop; teardown happens by unmounting the
   sandboxed iframe). Under reduced motion the layer simply never mounts and
   the section keeps its ink ground. The variant renders on Canvas 2D, so it
   also works with WebGL disabled — no fallback needed beyond the ground. */

import dynamic from "next/dynamic";
import { useStaticMotion } from "@/components/finch/motion-preference";
import { useNearViewport } from "./lifecycle";

const FlowField = dynamic(
  () => import("@/src/shaders/neuform-isolated/NeuformBatchEffects").then((m) => m.FlowField),
  { ssr: false },
);

export function FlowFieldLayer() {
  const staticMotion = useStaticMotion();
  const { ref, near } = useNearViewport<HTMLDivElement>("500px");

  return (
    <div ref={ref} className="vy-flowfield" aria-hidden="true">
      {!staticMotion && near ? (
        <div className="shader-frame absolute inset-0 vy-flowfield-frame">
          <FlowField
            speed={1.0}
            size={1.0}
            length={1.0}
            density={1.0}
            opacity={1.0}
            hue={0}
            saturation={1.0}
            brightness={1.0}
          />
        </div>
      ) : null}
    </div>
  );
}
