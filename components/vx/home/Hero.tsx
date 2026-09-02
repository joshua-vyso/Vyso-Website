"use client";

/* ── Hero plate ──────────────────────────────────────────────────────────────
   An ink screen inset from the viewport edge, carrying the exact-source
   ThreeUI Halftone Flow (hash-verified, `src/shaders/**`, never edited). The
   headline sits over it in real DOM. On scroll the plate eases back
   (scale + corner growth) so the paper page appears to slide up over a
   device. Under reduced motion or without WebGL the ember ground + poster
   stand in and nothing moves. */

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { useStaticMotion } from "@/components/site/motion-preference";
import { useAfterIdle, useNearViewport, useWebGLAvailable } from "@/components/site/three/lifecycle";
import { BRAND } from "../content";
import { Btn, Words } from "../primitives";

const HalftoneFlow = dynamic(
  () => import("@/src/shaders/neuform-isolated/NeuformCraftEffects").then((m) => m.HalftoneFlow),
  { ssr: false },
);

function Field() {
  const staticMotion = useStaticMotion();
  const webgl = useWebGLAvailable();
  const { ref, near } = useNearViewport<HTMLDivElement>("600px");
  const idle = useAfterIdle();
  const live = !staticMotion && webgl === true && near && idle;
  const poster = staticMotion || webgl === false;
  return (
    <div ref={ref} className="vx-hero-field" aria-hidden="true" inert>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(80% 70% at 72% 60%, rgba(200,68,12,0.55), transparent 70%), radial-gradient(50% 50% at 85% 25%, rgba(255,107,44,0.3), transparent 72%), #000",
        }}
      />
      {poster ? (
        /* eslint-disable-next-line @next/next/no-img-element -- fallback still of the registered field */
        <img src="/site/halftone-poster.webp" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
      {live ? (
        <div className="shader-frame">
          <HalftoneFlow hue={0} saturation={1} brightness={1} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
        </div>
      ) : null}
    </div>
  );
}

export function Hero() {
  const plate = useRef<HTMLDivElement>(null);
  const staticMotion = useStaticMotion();

  useEffect(() => {
    if (staticMotion) return undefined;
    const node = plate.current;
    if (!node) return undefined;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));
      node.style.transform = `scale(${1 - p * 0.06}) translateY(${p * 40}px)`;
      node.style.borderRadius = `${28 + p * 28}px`;
      node.style.opacity = String(1 - p * 0.35);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      node.style.transform = "";
      node.style.borderRadius = "";
      node.style.opacity = "";
    };
  }, [staticMotion]);

  return (
    <section className="vx-hero" aria-label="Introduction">
      <div ref={plate} className="vx-hero-plate">
        <Field />
        <div className="vx-hero-scrim" />
        <div className="vx-hero-content">
          <div className="vx-hero-top">
            <p className="vx-eyebrow">AI automation agency · {BRAND.city}</p>
          </div>
          <h1 className="vx-hero-h1 vx-display vx-h1">
            <Words text="We build the systems that run your" em="business." immediate delay={200} />
          </h1>
          <div className="vx-hero-foot">
            <p className="vx-lead">
              Documents read. Numbers checked. Follow-ups sent. A brief every morning. People approving what matters.
            </p>
            <div className="vx-hero-cta">
              <Btn href="/join" variant="vx-btn-signal" onClick={() => track("join_waitlist_click", { source: "hero_plasma" })}>
                Book a free audit
              </Btn>
              <a href="#systems" className="vx-link" style={{ color: "var(--vx-ondark-2)" }}>
                See the systems
              </a>
            </div>
          </div>
          <p className="vx-hero-cue" aria-hidden="true">
            Scroll <i />
          </p>
        </div>
      </div>
    </section>
  );
}
