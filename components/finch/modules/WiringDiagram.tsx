"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";

/* ── The wiring diagram ──────────────────────────────────────────────────────
   This page's one signature visual (the plan: "not a carousel, not the
   orbit"): the Finch mark in the middle, the ten modules around it, hairline
   connectors that draw once on enter. Everything here is one <svg> — lines,
   tile chrome and mono labels together — rather than an HTML layer plus an
   SVG overlay, so the two can never drift out of alignment at different
   viewport widths. The whole thing scales as one fixed-aspect picture
   (`viewBox`, `w-full h-auto`), the same trick `AgentVisual.tsx`'s `Frame`
   uses for its micro-visuals.

   Read vs write is not decoration — it is the honesty rule made visible.
   Blue = Finch's agents read this module's own numbers (OrderFlow's
   invoices, WasteWatch's log, ...). Ink = the module's own data is written
   automatically rather than typed in (ProcurePulse's stock from scanned
   documents, PricePilot's sell prices from cost + margin rule, PlanWise's
   actuals "measured ... rather than typed in" — its own words). ServiceDen
   gets neither: per its own module data it is "a standalone front office
   rather than a data feed into the rest of the platform", so its connector
   is a plain hairline in the line colour, not read-blue or write-ink — that
   is the honest picture, not an omission.

   Order around the ring follows `MODULE_GROUPS`: Documents → Orders & money
   → Suppliers & stock → People → Insight, the same reading order as the grid
   below it, so the diagram previews the page rather than reshuffling it.

   Below `sm` the ring becomes illegible — a 375px-wide render of a
   1160×460 canvas puts 10.5px mono labels at ~3px and a 1px hairline at a
   third of a pixel, both effectively invisible (measured in-browser). Rather
   than ship an unreadable "signature visual" on mobile, `WiringList` below
   is a plain mono list carrying the same facts (module, read/write/none,
   data label) at a size a phone can actually read. Both variants are always
   in the DOM — `hidden sm:block` / `sm:hidden` — the same always-mounted
   dual-render trick `PlatformShowcase.tsx` uses for its desktop/mobile split,
   so there is no client measurement and no hydration mismatch.            */

const MONO = "var(--font-plex-mono), 'IBM Plex Mono', monospace";

const W = 1160;
const H = 460;
const CX = W / 2;
const CY = H / 2 + 6;
const RING_R = 178;
const TILE_W = 130;
const TILE_H = 34;
const MARK_R = 34;

type Kind = "read" | "write" | "none";

const READ_COLOR = "#4B96DD";
const WRITE_COLOR = "#4A463C";
const NONE_COLOR = "#D8D3C6";

const KIND_LABEL: Record<Kind, string> = { read: "reads", write: "writes", none: "not yet connected" };

const NODES: { slug: string; name: string; kind: Kind; dataLabel?: string }[] = [
  { slug: "doc-u", name: "Doc-U", kind: "read", dataLabel: "documents" },
  { slug: "orderflow", name: "OrderFlow", kind: "read", dataLabel: "invoices" },
  { slug: "pricepilot", name: "PricePilot", kind: "write", dataLabel: "margins" },
  { slug: "procurepulse", name: "ProcurePulse", kind: "write", dataLabel: "stock" },
  { slug: "supplysync", name: "SupplySync", kind: "read" },
  { slug: "wastewatch", name: "WasteWatch", kind: "read", dataLabel: "waste" },
  { slug: "planwise", name: "PlanWise", kind: "write", dataLabel: "actuals" },
  { slug: "shiftboard", name: "ShiftBoard", kind: "read", dataLabel: "labour" },
  { slug: "serviceden", name: "ServiceDen", kind: "none" },
  { slug: "insightgen", name: "InsightGen", kind: "read" },
];

const ANGLE_STEP = 360 / NODES.length;

function pointOnRing(index: number) {
  const deg = -90 + index * ANGLE_STEP;
  const rad = (deg * Math.PI) / 180;
  return { x: CX + RING_R * Math.cos(rad), y: CY + RING_R * Math.sin(rad) };
}

const drawLine = (): Variants => ({ rest: { pathLength: 0, opacity: 0 }, play: { pathLength: 1, opacity: 1 } });
const fadeTile = (delay: number): Variants => ({
  rest: { opacity: 0, scale: 0.94 },
  play: { opacity: 1, scale: 1, transition: { duration: 0.28, delay, ease: "easeOut" } },
});
const markPop: Variants = {
  rest: { opacity: 0, scale: 0.9 },
  play: { opacity: 1, scale: 1, transition: { duration: 0.32, ease: "easeOut" } },
};
const fadeRow = (delay: number): Variants => ({
  rest: { opacity: 0, x: -6 },
  play: { opacity: 1, x: 0, transition: { duration: 0.26, delay, ease: "easeOut" } },
});

function Legend() {
  return (
    <div className="mt-[10px] flex flex-wrap items-center gap-x-[16px] gap-y-[6px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint sm:justify-end">
      <span className="inline-flex items-center gap-[6px]">
        <span className="inline-block h-[1px] w-[14px]" style={{ background: READ_COLOR }} />
        FINCH READS
      </span>
      <span className="inline-flex items-center gap-[6px]">
        <span className="inline-block h-[1px] w-[14px]" style={{ background: WRITE_COLOR }} />
        FINCH WRITES
      </span>
      <span className="inline-flex items-center gap-[6px]">
        <span className="inline-block h-[1px] w-[14px]" style={{ background: NONE_COLOR }} />
        NOT YET CONNECTED
      </span>
    </div>
  );
}

function Ring({ motionProps }: { motionProps: Record<string, unknown> }) {
  return (
    <motion.svg
      {...motionProps}
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Diagram: the Finch mark at the centre, connected by hairlines to the ten modules — blue lines where Finch's agents read a module's data, ink lines where the module's own data is written automatically, and one plain line to ServiceDen, which is not yet connected."
    >
      {NODES.map((node, i) => {
        const p = pointOnRing(i);
        const color = node.kind === "read" ? READ_COLOR : node.kind === "write" ? WRITE_COLOR : NONE_COLOR;
        /* Total draw is ~10 × 0.05s stagger + 0.5s duration ≈ 1s, under the
           plan's 1.2s budget, with the mark popping first. */
        const delay = 0.15 + i * 0.05;

        return (
          <g key={node.slug}>
            <motion.line
              x1={CX}
              y1={CY}
              x2={p.x}
              y2={p.y}
              stroke={color}
              strokeWidth={1}
              variants={drawLine()}
              transition={{ duration: 0.5, ease: "easeOut", delay }}
            />

            {node.dataLabel ? (
              <motion.text
                x={(CX + p.x) / 2}
                y={(CY + p.y) / 2 - 8}
                textAnchor="middle"
                fontFamily={MONO}
                fontSize={9.5}
                letterSpacing="0.06em"
                fill={color}
                variants={fadeTile(delay + 0.35)}
              >
                {node.dataLabel}
              </motion.text>
            ) : null}

            <motion.g variants={fadeTile(delay + 0.15)}>
              <rect
                x={p.x - TILE_W / 2}
                y={p.y - TILE_H / 2}
                width={TILE_W}
                height={TILE_H}
                rx={8}
                fill="#FFFFFF"
                stroke="#E7E3DA"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontFamily={MONO}
                fontSize={10.5}
                letterSpacing="0.06em"
                fill="#4A463C"
              >
                {node.name.toUpperCase()}
              </text>
            </motion.g>
          </g>
        );
      })}

      {/* The Finch mark, centred, popping in first. `<image>` references the
          same asset `BirdHop.tsx` uses for the 404 — an SVG file embedded
          inside this SVG, which every evergreen browser rasterises/vector-
          renders correctly, and which stays crisp at any scale factor since
          it is the source file, not a path copy. */}
      <motion.g variants={markPop}>
        <circle cx={CX} cy={CY} r={MARK_R} fill="#FAF9F6" stroke="#E7E3DA" />
        <image
          href="/finch/finch-bird.svg"
          x={CX - MARK_R * 0.62}
          y={CY - MARK_R * 0.62}
          width={MARK_R * 1.24}
          height={MARK_R * 1.24}
        />
      </motion.g>
    </motion.svg>
  );
}

/** The mobile fallback: same facts, a size a phone can read. */
function WiringList({ motionProps }: { motionProps: Record<string, unknown> }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-0 border-t border-fn-line p-0">
      {NODES.map((node, i) => {
        const color = node.kind === "read" ? READ_COLOR : node.kind === "write" ? WRITE_COLOR : NONE_COLOR;
        return (
          <motion.li
            key={node.slug}
            {...motionProps}
            variants={fadeRow(0.03 * i)}
            className="flex items-center justify-between gap-[12px] border-b border-fn-line py-[12px]"
          >
            <Link href={`/platform/modules/${node.slug}`} className="flex items-center gap-[10px]">
              <span className="inline-block h-[1px] w-[16px] shrink-0" style={{ background: color }} aria-hidden="true" />
              <span className="font-fn-mono text-[12px] tracking-[0.06em] text-fn-ink">
                {node.name.toUpperCase()}
              </span>
            </Link>
            <span className="font-fn-mono text-[10.5px] tracking-[0.06em] text-fn-muted">
              {node.dataLabel ? `${node.dataLabel} · ` : ""}
              {KIND_LABEL[node.kind]}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

export function WiringDiagram() {
  const reduceMotion = useReducedMotion();

  const motionProps = reduceMotion
    ? ({ initial: "play" as const, animate: "play" as const })
    : ({
        initial: "rest" as const,
        whileInView: "play" as const,
        viewport: { once: true, amount: 0.4 },
      });

  return (
    <div className="mx-auto max-w-[1160px]">
      <div className="hidden sm:block">
        <Ring motionProps={motionProps} />
      </div>
      <div className="sm:hidden">
        <WiringList motionProps={motionProps} />
      </div>
      <Legend />
    </div>
  );
}

export default WiringDiagram;
