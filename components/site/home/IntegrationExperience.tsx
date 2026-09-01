"use client";

/* ── Integration experience ──────────────────────────────────────────────────
   The page's visual climax: one ~420vh sticky black section with two phases.

   Phase one — a scroll-controlled vertical wheel through WhatsApp → Outlook →
   Xero → "30+ integrations" (real brand SVGs from `public/finch/integrations`;
   "30+" is the total capability, not an extra count).

   Phase two — the wheel dissolves into a particle field on ONE canvas: two
   broad waves of dotted curves enter from left and right and converge on a
   warm-orange Vyso node, with "ONE / BRAIN." set as environmental type in the
   negative space. Everything is driven by native scroll position (no
   hijacking); the canvas redraws only when progress changes and goes idle
   once the composition resolves. Reduced motion gets a static, legible final
   composition with the logos listed above it; particle density is reduced on
   small screens. */

import { useEffect, useRef } from "react";
import { useStaticMotion } from "@/components/site/motion-preference";
import { useMediaQuery } from "@/components/site/use-media-query";
import { useStickyProgress } from "./scroll";

const WHEEL = [
  { id: "whatsapp", label: "WhatsApp", icon: "/finch/integrations/whatsapp.svg" },
  { id: "outlook", label: "Outlook", icon: "/finch/integrations/outlook.svg" },
  { id: "xero", label: "Xero", icon: "/finch/integrations/xero.svg" },
  { id: "more", label: "30+ integrations", icon: null },
] as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/* Deterministic per-dot scatter (stable across renders and resizes). */
function seeded(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ── The particle canvas ──────────────────────────────────────────────────── */

function drawField(
  canvas: HTMLCanvasElement,
  p: number,
  compact: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const scatter = easeOut(span(p, 0.52, 0.72)); // dissolve → field
  const head = easeOut(span(p, 0.58, 0.9)); // how far along each curve dots run
  const resolve = span(p, 0.8, 0.94); // node + type
  if (scatter <= 0) return;

  const cx = w / 2;
  const cy = h / 2;
  const curvesPerSide = compact ? 9 : 16;
  const dotsPerCurve = compact ? 16 : 24;

  let dotIndex = 0;
  for (let side = 0; side < 2; side += 1) {
    const dir = side === 0 ? -1 : 1;
    for (let i = 0; i < curvesPerSide; i += 1) {
      const lane = (i + 0.5) / curvesPerSide; // 0..1 down the height
      const wob = seeded(side * 97 + i); // per-curve character
      /* Vary each stream's entry and pull so the field reads as curved waves,
         not aligned columns: outer lanes enter wider and bend harder. */
      const spread = Math.abs(lane - 0.5) * 2; // 0 centre … 1 edges
      const startX = cx + dir * w * (0.5 + 0.16 * wob + 0.1 * spread);
      const startY = h * 0.18 + lane * h * 0.64;
      const ctrlX = cx + dir * w * (0.14 + 0.18 * spread + 0.06 * wob);
      const ctrlY = cy + (startY - cy) * (0.55 + 0.35 * wob);
      const phase = seeded(side * 131 + i * 7) * 0.9;
      for (let j = 0; j < dotsPerCurve; j += 1) {
        dotIndex += 1;
        const t = ((j + 0.5 + phase) % dotsPerCurve) / dotsPerCurve;
        if (t > head + 0.04) continue;
        /* Quadratic bezier point */
        const u = 1 - t;
        let x = u * u * startX + 2 * u * t * ctrlX + t * t * cx;
        let y = u * u * startY + 2 * u * t * ctrlY + t * t * cy;
        /* Scatter offset during the dissolve, decaying to the curve */
        const loose = 1 - scatter;
        if (loose > 0.001) {
          x += (seeded(dotIndex) - 0.5) * 260 * loose;
          y += (seeded(dotIndex * 3 + 1) - 0.5) * 200 * loose;
        }
        const nearEnd = t > 0.82;
        const alpha =
          scatter *
          (0.25 + 0.55 * (1 - Math.abs(t - head) * 1.4)) *
          (nearEnd ? 0.9 : 1);
        if (alpha <= 0.02) continue;
        ctx.beginPath();
        ctx.arc(x, y, nearEnd ? 1.3 : 1.6, 0, Math.PI * 2);
        ctx.fillStyle = nearEnd
          ? `rgba(255, 119, 39, ${alpha})`
          : `rgba(250, 249, 246, ${Math.min(0.75, alpha)})`;
        ctx.fill();
      }
    }
  }

  /* The Vyso node: warm-orange glow at the convergence point. */
  if (resolve > 0.01) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
    glow.addColorStop(0, `rgba(255, 119, 39, ${0.4 * resolve})`);
    glow.addColorStop(0.5, `rgba(189, 74, 14, ${0.16 * resolve})`);
    glow.addColorStop(1, "rgba(189, 74, 14, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 90, cy - 90, 180, 180);

    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 178, 122, ${0.5 * resolve})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 119, 39, ${Math.min(1, 0.35 + resolve)})`;
    ctx.fill();
  }
}

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

/* ── Environmental type + canvas stage (shared by live and static forms) ──── */

function FieldStage({ progress, compact }: { progress: number; compact: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resolve = span(progress, 0.8, 0.94);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawField(canvas, progress, compact);
  }, [progress, compact]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const observer = new ResizeObserver(() => drawField(canvas, progress, compact));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [progress, compact]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[10%] text-center text-[clamp(3.2rem,11vw,8.5rem)] font-semibold leading-none tracking-[0.04em] text-ondark"
        style={{ opacity: resolve * 0.95, transform: `translateY(${(1 - resolve) * 16}px)` }}
      >
        ONE
      </p>
      <p
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-[9%] text-center text-[clamp(3.2rem,11vw,8.5rem)] font-semibold leading-none tracking-[0.04em] text-ondark"
        style={{ opacity: resolve * 0.95, transform: `translateY(${(1 - resolve) * -16}px)` }}
      >
        BRAIN.
      </p>
      {/* The message, for readers and crawlers (the giant words are decoration). */}
      <p className="sr-only">Thirty-plus integrations, coordinated by one Vyso brain.</p>
    </>
  );
}

/* ── Live pinned experience ───────────────────────────────────────────────── */

function PinnedExperience({ compact }: { compact: boolean }) {
  const { ref, progress } = useStickyProgress<HTMLDivElement>();

  const introFade = 1 - span(progress, 0.04, 0.12);
  const wheelIndex = span(progress, 0.06, 0.5) * (WHEEL.length - 1);
  const wheelFade = 1 - easeOut(span(progress, 0.52, 0.66));

  return (
    <div ref={ref} className={compact ? "relative h-[320vh]" : "relative h-[420vh]"}>
      <div className="sticky top-0 h-svh overflow-hidden bg-[#050403]">
        <FieldStage progress={progress} compact={compact} />

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

function StaticExperience({ compact }: { compact: boolean }) {
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
      <div className="relative mx-auto mt-12 h-[440px] max-w-[1100px] md:h-[520px]">
        <FieldStage progress={1} compact={compact} />
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
      {staticMotion ? <StaticExperience compact /> : <PinnedExperience compact={compact} />}
    </section>
  );
}
