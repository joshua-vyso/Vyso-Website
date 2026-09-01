"use client";

/* ── Integration experience ──────────────────────────────────────────────────
   The page's visual climax: one ~420vh sticky black section with two phases.

   Phase one — a scroll-controlled vertical wheel through WhatsApp → Outlook →
   Xero → "30+ integrations" (real brand SVGs from `public/finch/integrations`;
   "30+" is the total capability, not an extra count).

   Phase two — the wheel gives way to the exact-source ThreeUI
   `ConstellationField` "gateway-flow" (registered `GatewayFlow` export from
   `src/shaders/neuform-isolated/NeuformBatchEffects.tsx`, canonical source
   `sources/gateway-flow.html`, SHA-256 verified — see
   `.ai/threeui_source_record.md`): a black-stage flow canvas of streaming
   gateway trajectories, over which "ONE / BRAIN." resolves as environmental
   type around a warm-orange Vyso node. Scroll position only fades layers —
   no hijacking. The renderer mounts as the phase approaches and unmounts
   with the section; density drops on small screens via the supported prop.
   Reduced motion gets a static, legible final composition (no animated
   renderer) with the logos listed above it. */

import dynamic from "next/dynamic";
import { useStaticMotion } from "@/components/site/motion-preference";
import { useMediaQuery } from "@/components/site/use-media-query";
import { useStickyProgress } from "./scroll";

import { TestimonialsHead } from "./Sections";

const GatewayFlow = dynamic(
  () => import("@/src/shaders/neuform-isolated/NeuformBatchEffects").then((m) => m.GatewayFlow),
  { ssr: false },
);

const WHEEL = [
  { id: "whatsapp", label: "WhatsApp", icon: "/finch/integrations/whatsapp.svg" },
  { id: "outlook", label: "Outlook", icon: "/finch/integrations/outlook.svg" },
  { id: "xero", label: "Xero", icon: "/finch/integrations/xero.svg" },
  { id: "more", label: "30+ integrations", icon: null },
] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/* ── Wheel tile ───────────────────────────────────────────────────────────── */

function WheelTile({ item, distance }: { item: (typeof WHEEL)[number]; distance: number }) {
  const opacity = Math.max(0, 1 - distance * 0.42);
  const scale = 1 - Math.min(0.3, distance * 0.11);
  const blur = Math.min(5, distance * 2.4);
  return (
    <div
      className="absolute left-1/2 top-1/2 flex w-max items-center gap-5"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
      }}
    >
      {item.icon ? (
        <span className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl border border-[#2A2722] bg-[#14110D] p-3.5 md:h-20 md:w-20 md:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local brand SVGs at fixed size */}
          <img src={item.icon} alt="" className="h-full w-full object-contain" />
        </span>
      ) : (
        <span className="vy-mono flex h-16 flex-none items-center rounded-2xl border border-signal/50 bg-[#1B1408] px-5 text-2xl text-signal-ondark md:h-20 md:text-3xl">
          30+
        </span>
      )}
      <span
        className="text-2xl font-semibold tracking-[-0.01em] md:text-4xl"
        style={{ color: distance < 0.5 ? "var(--color-ondark)" : "var(--color-ondark-3)" }}
      >
        {item.label}
      </span>
    </div>
  );
}

/* ── Finale: exact-source Gateway Flow + environmental type ───────────────── */

function FinaleStage({ progress, compact }: { progress: number; compact: boolean }) {
  const enter = easeOut(span(progress, 0.42, 0.58));
  const resolve = span(progress, 0.62, 0.76);
  /* Extended-pin handoff: after a short hold, the whole brain composition
     shrinks and lifts while the reviews header rises into the lower half —
     the stage then releases straight into the (headerless) card grid. */
  const handoff = easeOut(span(progress, 0.78, 0.95));
  const mounted = progress > 0.32;

  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          transform: `translateY(${-handoff * 27}svh) scale(${1 - handoff * 0.5})`,
          opacity: 1 - handoff * 0.25,
        }}
      >
        <div className="absolute inset-0" aria-hidden="true" inert style={{ opacity: enter }}>
          {mounted ? (
            <div className="shader-frame absolute inset-0 vy-gateway-frame">
              <GatewayFlow
                variant="gateway-flow"
                mode="dark"
                speed={1.0}
                size={1.0}
                length={1.0}
                density={compact ? 0.55 : 1.0}
                opacity={1.0}
                hue={0}
                saturation={1.0}
                brightness={1.0}
              />
            </div>
          ) : null}
          {/* The Vyso node at the convergence point. */}
          <span className="vy-brain-node" style={{ opacity: resolve }} />
        </div>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10 text-center text-[clamp(1.8rem,4.6vw,3.4rem)] font-semibold leading-none tracking-[0.14em] text-ondark"
          style={{
            bottom: "calc(50% + 74px)",
            opacity: resolve * 0.95,
            transform: `translateY(${(1 - resolve) * 12}px)`,
          }}
        >
          ONE
        </p>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10 text-center text-[clamp(1.8rem,4.6vw,3.4rem)] font-semibold leading-none tracking-[0.14em] text-ondark"
          style={{
            top: "calc(50% + 74px)",
            opacity: resolve * 0.95,
            transform: `translateY(${(1 - resolve) * -12}px)`,
          }}
        >
          BRAIN
        </p>
      </div>
      {/* The reviews header, rising to meet the release point. */}
      <div
        className="absolute inset-x-0 bottom-[7%] z-20 px-6"
        style={{
          opacity: handoff,
          transform: `translateY(${(1 - handoff) * 44}px)`,
          pointerEvents: handoff > 0.5 ? "auto" : "none",
        }}
      >
        <div className="mx-auto max-w-[1200px]">
          <TestimonialsHead />
        </div>
      </div>
      {/* The message, for readers and crawlers (the giant words are decoration). */}
      <p className="sr-only">Thirty-plus integrations, coordinated by one Vyso brain.</p>
    </>
  );
}

/* ── Live pinned experience ───────────────────────────────────────────────── */

function PinnedExperience({ compact }: { compact: boolean }) {
  const { ref, progress } = useStickyProgress<HTMLDivElement>();

  const introFade = 1 - span(progress, 0.03, 0.1);
  const wheelIndex = span(progress, 0.05, 0.42) * (WHEEL.length - 1);
  const wheelFade = 1 - easeOut(span(progress, 0.44, 0.56));

  return (
    <div ref={ref} className={compact ? "relative h-[420vh]" : "relative h-[560vh]"}>
      <div className="sticky top-0 h-svh overflow-hidden bg-[#050403]">
        <FinaleStage progress={progress} compact={compact} />

        {/* Intro copy */}
        <div
          className="absolute inset-x-0 top-[13%] px-6 text-center"
          style={{ opacity: introFade, transform: `translateY(${(1 - introFade) * -12}px)` }}
        >
          <p className="vy-eyebrow text-ondark-3">Integrations</p>
          <h2
            id="integrations-heading"
            className="mx-auto mt-4 max-w-[680px] text-balance text-[clamp(1.9rem,3.8vw,3rem)] font-semibold leading-[1.06] tracking-[-0.015em] text-ondark"
          >
            Your tools.{" "}
            <em className="vy-serif font-normal italic text-signal-ondark">Finally working together.</em>
          </h2>
        </div>

        {/* The wheel */}
        <div className="absolute inset-0" style={{ opacity: wheelFade, transform: `scale(${0.94 + wheelFade * 0.06})` }} aria-hidden={wheelFade < 0.1}>
          {WHEEL.map((item, index) => (
            <div
              key={item.id}
              className="absolute inset-0"
              style={{ transform: `translateY(${(index - wheelIndex) * (compact ? 108 : 132)}px)` }}
            >
              <WheelTile item={item} distance={Math.abs(index - wheelIndex)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Static / reduced-motion form ─────────────────────────────────────────── */

function StaticExperience() {
  return (
    <div className="bg-[#050403] px-6 py-24 md:py-32">
      <div className="mx-auto max-w-[760px] text-center">
        <p className="vy-eyebrow text-ondark-3">Integrations</p>
        <h2
          id="integrations-heading"
          className="mx-auto mt-4 text-balance text-[clamp(1.9rem,3.8vw,3rem)] font-semibold leading-[1.06] tracking-[-0.015em] text-ondark"
        >
          Your tools.{" "}
          <em className="vy-serif font-normal italic text-signal-ondark">Finally working together.</em>
        </h2>
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-3" role="list">
          {WHEEL.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-full border border-[#2A2722] bg-[#14110D] py-2 pl-2.5 pr-4"
            >
              {item.icon ? (
                // eslint-disable-next-line @next/next/no-img-element -- local brand SVGs
                <img src={item.icon} alt="" className="h-6 w-6 object-contain" />
              ) : (
                <span className="vy-mono text-sm text-signal-ondark">30+</span>
              )}
              <span className="text-sm text-ondark-2">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* Static final composition — no animated renderer under reduced motion. */}
      <div className="relative mx-auto mt-12 h-[440px] max-w-[1100px] overflow-hidden rounded-3xl border border-[#211E19] bg-black md:h-[520px]">
        <span className="vy-brain-node" style={{ opacity: 1 }} />
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10 text-center text-[clamp(1.8rem,4.6vw,3.4rem)] font-semibold leading-none tracking-[0.14em] text-ondark"
          style={{ bottom: "calc(50% + 74px)" }}
        >
          ONE
        </p>
        <p
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10 text-center text-[clamp(1.8rem,4.6vw,3.4rem)] font-semibold leading-none tracking-[0.14em] text-ondark"
          style={{ top: "calc(50% + 74px)" }}
        >
          BRAIN
        </p>
        <p className="sr-only">Thirty-plus integrations, coordinated by one Vyso brain.</p>
      </div>
      {/* The reviews header renders here in the static flow (the pinned
          handoff carries it otherwise), so it exists exactly once. */}
      <div className="mx-auto mt-20 max-w-[1200px]">
        <TestimonialsHead />
      </div>
    </div>
  );
}

export function IntegrationExperience() {
  const staticMotion = useStaticMotion();
  /* Hydration-safe (server snapshot false → desktop density first paint). */
  const compact = useMediaQuery("(max-width: 767px)", false);
  return (
    <section className="border-t border-[#211E19]" aria-labelledby="integrations-heading">
      {staticMotion ? <StaticExperience /> : <PinnedExperience compact={compact} />}
    </section>
  );
}
