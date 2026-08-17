"use client";

import { useMemo, useRef } from "react";
import { motion, useInView, useScroll, useTransform } from "motion/react";

import { useBudgetEntry } from "./motion-budget";

import { useIsDesktop } from "./use-media-query";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The faceted plane ───────────────────────────────────────────────────────
   §3.3, the Prolibu move: 24–40 large low-poly triangles tiling a blue band,
   fills stepped between `--fn-blue-900` and `--fn-blue-500`, each drifting
   1–3px on a slow loop, the whole plane parallaxing at 1.08× on scroll.

   SVG rather than canvas because it is *structure*, not a field: the facets
   never change shape, only nudge, so there is nothing to redraw — the browser
   composites 28 transforms and the main thread does nothing at all. A canvas
   would repaint a full band 30 times a second to move some triangles 2px.

   **Deterministic by construction.** The triangulation comes from a seeded PRNG
   (`seed` prop), never `Math.random`, for the reason every SSR bug in this
   codebase has had in common: a random value chosen at render is a different
   value on the server and the client. Same seed → same plane, every render,
   both sides of the boundary.                                                 */

export type FacetPlaneProps = {
  /** Any integer. Two bands on the same page should not share one. */
  seed?: number;
  /** Facet drift, in viewBox units (≈ px). §3.3: 1–3. */
  drift?: number;
  /** Hold the drift still while something else in the band is the moving thing.
      The homepage showcase band is the case this exists for: the Brief demo is
      itself an animation, and §3's budget is two moving things per viewport —
      the facets yield to the demo while it plays and resume when it stops. The
      parallax is unaffected, because a scroll-linked transform only moves while
      the reader is moving and is not a second animation. */
  paused?: boolean;
  className?: string;
};

/** mulberry32 — 4 lines, uniform enough for a triangulation, and identical on
    every engine, which `Math.random` explicitly is not. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VB_W = 1200;
const VB_H = 600;

type Facet = { points: string; fill: string; delay: number; duration: number; dy: number };

/** A jittered lattice cut into triangles. Jitter is capped at 40% of a cell so
    facets stay convex and roughly even — beyond that the plane starts showing
    slivers, which read as rendering errors rather than geometry. */
function buildFacets(seed: number, cols: number, rows: number, drift: number): Facet[] {
  const cw = VB_W / cols;
  const ch = VB_H / rows;

  /* Lattice corners are pinned so the plane always tiles the band edge to edge;
     only interior points move. */
  const pts: { x: number; y: number }[][] = [];
  const randP = rng(seed);
  for (let r = 0; r <= rows; r += 1) {
    pts[r] = [];
    for (let c = 0; c <= cols; c += 1) {
      const edge = r === 0 || r === rows || c === 0 || c === cols;
      pts[r][c] = {
        x: c * cw + (edge ? 0 : (randP() - 0.5) * cw * 0.8),
        y: r * ch + (edge ? 0 : (randP() - 0.5) * ch * 0.8),
      };
    }
  }

  /* Four steps between --fn-blue-900 and --fn-blue-500. Stepped, not
     continuous: §2 wants structure you can see, and a smooth ramp across 28
     facets is indistinguishable from a flat fill. */
  const fills = [
    "var(--fn-blue-900)",
    "color-mix(in oklab, var(--fn-blue-900), var(--fn-blue-700) 60%)",
    "var(--fn-blue-700)",
    "color-mix(in oklab, var(--fn-blue-700), var(--fn-blue-500) 70%)",
  ];

  const facets: Facet[] = [];
  const randF = rng(seed + 104729);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const a = pts[r][c];
      const b = pts[r][c + 1];
      const d = pts[r + 1][c];
      const e = pts[r + 1][c + 1];
      /* Alternate the diagonal so the plane doesn't read as a hatched grid. */
      const flip = (r + c) % 2 === 0;
      const tri1 = flip ? [a, b, d] : [a, b, e];
      const tri2 = flip ? [b, e, d] : [a, e, d];
      for (const tri of [tri1, tri2]) {
        facets.push({
          points: tri.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
          fill: fills[Math.floor(randF() * fills.length)],
          /* 10–14s per §3.3, with a per-facet phase so the plane breathes
             rather than pulsing as one sheet. */
          duration: 10 + randF() * 4,
          delay: -randF() * 14,
          dy: (0.4 + randF() * 0.6) * drift,
        });
      }
    }
  }
  return facets;
}

export function FacetPlane({ seed = 1, drift = 3, paused = false, className = "" }: FacetPlaneProps) {
  const reduceMotion = useStaticMotion();
  const desktop = useIsDesktop();
  const ref = useRef<HTMLDivElement | null>(null);
  /* Not `once`: unlike a reveal, the drift is a loop, and a loop that keeps
     ticking on a band four screens away is exactly the cost §9 is trying to
     avoid. Off screen → `animate` goes undefined → motion stops the loop. */
  const onScreen = useInView(ref, { amount: 0.1 });
  const drifting = !reduceMotion && onScreen && !paused;
  useBudgetEntry("FacetPlane", drifting);

  /* 28 facets desktop (7×2 cells × 2 triangles), 16 mobile (4×2 × 2) — §6.5 of
     the plan: "facets simplify to ≤ 16" at 375. */
  const facets = useMemo(
    () => buildFacets(seed, desktop ? 7 : 4, 2, drift),
    [seed, desktop, drift],
  );

  /* 1.08× parallax on the band's own scroll progress (§3.3). `offset` spans
     the band entering to leaving, so the plane travels ~8% of the band height
     across a full pass — the depth cue, not a slide. */
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  /* Zeroed rather than removed under reduced motion: dropping `style={{ y }}`
     would leave the transform the server serialised stuck on the plane. Same
     element, same style, different range — see `motion-preference.tsx`. */
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? ["0%", "0%"] : ["-4%", "4%"]);

  return (
    <div ref={ref} className={"absolute inset-0 overflow-hidden " + className}>
      <motion.svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="h-[112%] w-full"
        style={{ y }}
        aria-hidden
      >
        {facets.map((facet, i) => (
          <motion.polygon
            key={i}
            points={facet.points}
            fill={facet.fill}
            /* A hairline of the facet's own fill closes the sub-pixel seams
               that `preserveAspectRatio="none"` opens between neighbours. */
            stroke={facet.fill}
            strokeWidth={1}
            animate={drifting ? { y: [0, facet.dy, 0] } : undefined}
            transition={
              !drifting
                ? undefined
                : {
                    duration: facet.duration,
                    delay: facet.delay,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
            }
          />
        ))}
      </motion.svg>
    </div>
  );
}

export default FacetPlane;
