"use client";

/* ── Operations that scale ───────────────────────────────────────────────────
   Five full-width capability bands beside a sticky section heading (desktop).
   Each row: number, title, one-line description, and a small operational
   schematic that grows more connected down the list — one node, a link, a
   chain, a mesh, a hub. The row nearest the viewport's focus carries an
   orange node and brighter ink. Mobile stacks naturally with the same active
   state; reduced motion renders everything active and still. */

import { useStaticMotion } from "@/components/site/motion-preference";
import { useActiveIndex } from "./scroll";

const OPERATIONS = [
  {
    title: "Read & organise",
    body: "Turn scattered company data into clear, useful information.",
  },
  {
    title: "Check & reconcile",
    body: "Catch rising costs, errors and mismatches before they hurt your margins.",
  },
  {
    title: "Monitor & alert",
    body: "Know the moment something important changes.",
  },
  {
    title: "Follow up & coordinate",
    body: "Keep your people, tasks and systems moving together.",
  },
  {
    title: "Brief & report",
    body: "See exactly what's happening—without chasing updates.",
  },
] as const;

/* Progressively connected schematics, drawn on a shared 48×48 grid. */
function Schematic({ step, active }: { step: number; active: boolean }) {
  const stroke = active ? "var(--color-signal)" : "#5A554B";
  const node = active ? "var(--color-signal)" : "#8A8474";
  const dim = "#3A362F";
  const common = {
    fill: "none",
    stroke,
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeDasharray: "3 4",
  };
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-12 w-12 flex-none transition-opacity duration-500"
      aria-hidden="true"
      style={{ opacity: active ? 1 : 0.6 }}
    >
      {step >= 1 ? <circle cx="24" cy="24" r="4" fill={node} /> : null}
      {step >= 2 ? (
        <>
          <circle cx="10" cy="24" r="3" fill={dim} />
          <path d="M13 24h7" {...common} />
        </>
      ) : null}
      {step >= 3 ? (
        <>
          <circle cx="38" cy="24" r="3" fill={dim} />
          <path d="M28 24h7" {...common} />
        </>
      ) : null}
      {step >= 4 ? (
        <>
          <circle cx="24" cy="9" r="3" fill={dim} />
          <circle cx="24" cy="39" r="3" fill={dim} />
          <path d="M24 12v8M24 28v8" {...common} />
        </>
      ) : null}
      {step >= 5 ? (
        <>
          <path d="M12.5 21.5 21 12M35.5 21.5 27 12M12.5 26.5 21 36M35.5 26.5 27 36" {...common} />
          <circle cx="24" cy="24" r="7.5" {...common} strokeDasharray="2 3" />
        </>
      ) : null}
    </svg>
  );
}

export function OperationsSection() {
  const staticMotion = useStaticMotion();
  const { containerRef, active } = useActiveIndex<HTMLDivElement>(OPERATIONS.length, staticMotion);

  return (
    <section className="border-t border-[#211E19] py-24 md:py-36" aria-labelledby="operations-heading">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div>
          <div className="lg:sticky lg:top-36">
            <p className="vy-eyebrow text-ondark-3">Capabilities</p>
            <h2
              id="operations-heading"
              className="mt-5 text-balance text-[clamp(1.9rem,3.8vw,3rem)] font-semibold leading-[1.06] tracking-[-0.015em] text-ondark"
            >
              Operations that{" "}
              <em className="vy-serif font-normal italic text-signal-ondark">scale.</em>
            </h2>
            <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-ondark-2">
              From one automated task to systems that run whole operations — the same five
              capabilities, connected further each time.
            </p>
          </div>
        </div>

        <div ref={containerRef} className="flex flex-col">
          {OPERATIONS.map((operation, index) => {
            const isActive = staticMotion || index === active;
            return (
              <div
                key={operation.title}
                data-active-item
                className="relative flex items-center gap-6 border-t border-[#211E19] py-9 first:border-t-0 md:gap-10 md:py-11"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-[-24px] top-1/2 hidden h-9 w-[3px] -translate-y-1/2 rounded-full bg-signal transition-opacity duration-400 lg:block"
                  style={{ opacity: isActive ? 1 : 0 }}
                />
                <span
                  className="vy-mono flex-none text-sm transition-colors duration-400"
                  style={{ color: isActive ? "var(--color-signal-ondark)" : "var(--color-ondark-3)" }}
                >
                  0{index + 1}
                </span>
                <div className="flex-1">
                  <h3
                    className="text-xl font-semibold tracking-[-0.01em] transition-colors duration-400 md:text-2xl"
                    style={{ color: isActive ? "var(--color-ondark)" : "var(--color-ondark-2)" }}
                  >
                    {operation.title}
                  </h3>
                  <p className="mt-2 max-w-[440px] text-[15px] leading-relaxed text-ondark-3">
                    {operation.body}
                  </p>
                </div>
                <Schematic step={index + 1} active={isActive} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
