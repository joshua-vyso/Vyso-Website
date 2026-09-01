"use client";

/* ── Primary hero CTA: ThreeUI ShaderButtons "Plasma", exact source ──────────
   Mounts the registered `PlasmaButton` (ShaderButtons variant
   "plasma-button" — `src/shaders/neuform-isolated/NeuformIsolatedEffects.tsx`,
   hash-verified) with the configured invocation: mode "dark", hue 0 /
   saturation 1.00 / brightness 1.00 — the deep-blue laboratory field with its
   luminous plasma control.

   The control's label reads "BOOK A FREE AUDIT": the registered source
   exposes no label API and its sandboxed document is unreachable at runtime,
   so the text is applied by a build-time module transform
   (`scripts/vyso-plasma-label.loader.cjs`, wired in next.config.ts) while the
   registered file itself stays byte-exact on disk.

   Presentation: no chrome of its own — the frame carries no border or shadow
   and its edges feather into the hero's black with a CSS mask on the SITE's
   wrapper, so the module reads as one seamless control rather than a pasted
   card. A real <a href="/join"> sits exactly over the plasma control with the
   accessible name, focus ring and analytics event; keyboard, touch, screen
   readers, WebGL-off and reduced motion all resolve to the same link (as the
   solid `.vy-btn-primary` button when the field can't run). Mounted only near
   the viewport after idle; exactly one plasma renderer exists per page. */

import dynamic from "next/dynamic";
import { track } from "@/lib/analytics";
import { useStaticMotion } from "@/components/site/motion-preference";
import { useAfterIdle, useNearViewport, useWebGLAvailable } from "./lifecycle";

const PlasmaButton = dynamic(
  () => import("@/src/shaders/neuform-isolated/NeuformIsolatedEffects").then((m) => m.PlasmaButton),
  { ssr: false },
);

export function PlasmaCta() {
  const staticMotion = useStaticMotion();
  const webgl = useWebGLAvailable();
  const { ref, near } = useNearViewport<HTMLDivElement>("400px");
  const idle = useAfterIdle();

  const live = !staticMotion && webgl === true && near && idle;

  return (
    <div ref={ref} className="vy-plasma">
      {live ? (
        <div className="shader-frame vy-plasma-frame" aria-hidden="true" inert>
          <PlasmaButton mode="dark" hue={0} saturation={1.0} brightness={1.0} />
        </div>
      ) : null}
      <a
        href="/join"
        aria-label="Book a free audit"
        className={live ? "vy-plasma-link" : "vy-btn vy-btn-primary"}
        onClick={() => track("join_waitlist_click", { source: "hero_plasma" })}
      >
        {live ? <span className="sr-only">Book a free audit</span> : "Book a free audit"}
      </a>
    </div>
  );
}
