"use client";

/* ── Primary hero CTA: ThreeUI ShaderButtons "Plasma", exact source ──────────
   Mounts the registered `PlasmaButton` (ShaderButtons variant
   "plasma-button" — `src/shaders/neuform-isolated/NeuformIsolatedEffects.tsx`,
   hash-verified) with the brief's configured invocation: mode "dark",
   hue 0 / saturation 1.00 / brightness 1.00 — the deep-blue laboratory field
   with its luminous plasma control, untouched.

   The registered source exposes no routing or label API (the control lives
   inside a sandboxed srcDoc iframe), so per the integration brief it is
   preserved as an exact visual layer inside an accessible application-level
   link: a real <a href="/join"> spans the frame, carries the accessible name,
   the focus ring and the analytics event, and sits directly over the plasma
   control's authored centre — not over unrelated canvas. Keyboard, touch,
   screen readers, WebGL-off and reduced motion all resolve to the same link;
   without a live field the link renders as the site's system-blue button so
   the action never depends on WebGL. Mounted only near the viewport; exactly
   one plasma renderer exists per page (this component is used once, in the
   hero — supporting CTAs use `.vy-btn-system`). */

import dynamic from "next/dynamic";
import { track } from "@/lib/analytics";
import { useStaticMotion } from "@/components/finch/motion-preference";
import { useNearViewport, useWebGLAvailable } from "./lifecycle";

const PlasmaButton = dynamic(
  () => import("@/src/shaders/neuform-isolated/NeuformIsolatedEffects").then((m) => m.PlasmaButton),
  { ssr: false },
);

export function PlasmaCta() {
  const staticMotion = useStaticMotion();
  const webgl = useWebGLAvailable();
  const { ref, near } = useNearViewport<HTMLDivElement>("400px");

  const live = !staticMotion && webgl === true && near;

  return (
    <div ref={ref} className="vy-plasma">
      {live ? (
        <div className="shader-frame vy-plasma-frame" aria-hidden="true">
          <PlasmaButton mode="dark" hue={0} saturation={1.0} brightness={1.0} />
        </div>
      ) : null}
      <a
        href="/join"
        className={live ? "vy-plasma-link" : "vy-btn vy-btn-system"}
        onClick={() => track("join_waitlist_click", { source: "hero_plasma" })}
      >
        <span className={live ? "vy-plasma-label" : undefined}>Join the waitlist</span>
      </a>
    </div>
  );
}
