"use client";

/* ── Homepage hero ───────────────────────────────────────────────────────────
   Black, full-bleed stage carrying the exact-source Halftone Flow field, with
   the positioning statement and the Plasma waitlist CTA in semantic DOM above
   it. The stage is `position: sticky`, so the off-white sheet that follows
   scrolls OVER it — the dark-to-paper transition is native scrolling (no
   pinned timeline, nothing hijacked, back/forward safe). This component adds
   the one scroll-linked flourish on top: as the sheet arrives, the hero copy
   eases up and dims, selling the handover from the abstract automation field
   to the plain explanation. Opacity/transform only, rAF-throttled, and fully
   inert under reduced motion (where the stage also stops sticking — see
   `.vy-hero-stage`'s reduced-motion block). */

import Link from "next/link";
import { useEffect, useRef } from "react";
import { HalftoneField } from "@/components/site/three/HalftoneField";
import { PlasmaCta } from "@/components/site/three/PlasmaCta";
import { useStaticMotion } from "@/components/site/motion-preference";

export function Hero() {
  const contentRef = useRef<HTMLDivElement>(null);
  const staticMotion = useStaticMotion();

  useEffect(() => {
    if (staticMotion) return undefined;
    const node = contentRef.current;
    if (!node) return undefined;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.85)));
      node.style.opacity = String(1 - progress * 0.9);
      node.style.transform = `translateY(${(-progress * 46).toFixed(1)}px)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      node.style.opacity = "";
      node.style.transform = "";
    };
  }, [staticMotion]);

  return (
    <section className="vy-hero-stage" aria-label="Introduction">
      <HalftoneField />
      <div className="vy-hero-scrim" />
      <div className="vy-hero-content mx-auto flex max-w-[1200px] flex-col justify-center px-6">
        <div ref={contentRef} className="max-w-[760px] pt-24 will-change-transform">
          <p className="vy-eyebrow text-ondark-3">
            Vyso · AI automation agency · Johannesburg
          </p>
          <h1 className="mt-6 text-balance text-[clamp(2.6rem,6.2vw,4.9rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-ondark">
            Automate the work that keeps you{" "}
            <em className="vy-serif font-normal italic text-signal-ondark">losing time and money.</em>
          </h1>
          <p className="mt-7 max-w-[560px] text-pretty text-lg leading-relaxed text-ondark-2">
            We design, build and run custom AI workflows around the tools you already use —
            reading documents, checking numbers, chasing follow-ups and briefing you every
            morning. Your team stays in charge of every decision that matters.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <PlasmaCta />
            <Link
              href="/automations"
              className="text-sm font-medium text-ondark-2 underline decoration-ondark-3 underline-offset-4 transition-colors hover:text-ondark"
            >
              See what we automate
            </Link>
          </div>
        </div>
        <p
          className="vy-hero-cue vy-eyebrow pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 text-ondark-3 md:block"
          aria-hidden="true"
        >
          Scroll
        </p>
      </div>
    </section>
  );
}
