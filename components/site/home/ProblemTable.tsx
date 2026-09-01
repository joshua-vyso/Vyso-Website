"use client";

/* ── Problem section: one rounded table ──────────────────────────────────────
   "Where time and money disappear." Three cause→cost rows in a single rounded
   container on the near-black page. Restrained motion: rows stagger in on
   first approach, dividers draw left→right, costs warm from grey to white,
   and a small orange indicator tracks the row nearest the viewport's focus.
   All of it collapses to a static, fully-legible table under reduced motion.
   Mobile stacks the cause above its cost inside each row. */

import { useEffect, useRef, useState } from "react";
import { useStaticMotion } from "@/components/site/motion-preference";
import { useActiveIndex } from "./scroll";

const ROWS = [
  { cause: "Spreadsheets across the business", cost: "Hours every week" },
  { cause: "Orders buried in WhatsApp", cost: "Lost revenue" },
  { cause: "Processes living in your head", cost: "No room to scale" },
] as const;

export function ProblemTable() {
  const staticMotion = useStaticMotion();
  const [entered, setEntered] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { containerRef, active } = useActiveIndex<HTMLDivElement>(ROWS.length, staticMotion);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setEntered(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-120px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const on = entered || staticMotion;

  return (
    <section ref={sectionRef} className="py-24 md:py-36" aria-labelledby="problem-heading">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2
          id="problem-heading"
          className="max-w-[720px] text-balance text-[clamp(1.9rem,3.8vw,3rem)] font-semibold leading-[1.06] tracking-[-0.015em] text-ondark"
        >
          Where time and money{" "}
          <em className="vy-serif font-normal italic text-signal-ondark">disappear.</em>
        </h2>

        <div
          ref={containerRef}
          className="relative mt-14 overflow-hidden rounded-3xl border border-[#2A2722] bg-[#14110D]"
          role="table"
          aria-label="Where work gets stuck, and what it costs"
        >
          {/* Column labels */}
          <div role="row" className="hidden gap-6 px-8 pb-0 pt-7 md:grid md:grid-cols-2 lg:px-12">
            <span role="columnheader" className="vy-eyebrow text-ondark-3">
              Where work gets stuck
            </span>
            <span role="columnheader" className="vy-eyebrow text-ondark-3">
              What it costs
            </span>
          </div>

          {/* Orange indicator riding the active row */}
          <span
            aria-hidden="true"
            className="absolute left-0 w-[3px] rounded-full bg-signal transition-[top] duration-500 [transition-timing-function:var(--vy-ease)]"
            style={{
              top: `calc(${staticMotion ? 0 : active} * (100% - 58px) / ${ROWS.length} + 46px)`,
              height: "44px",
              opacity: on ? 1 : 0,
            }}
          />

          <div role="rowgroup">
            {ROWS.map((row, index) => {
              const isActive = staticMotion || index === active;
              return (
                <div
                  key={row.cause}
                  role="row"
                  data-active-item
                  className="group relative grid gap-2 px-8 py-8 transition-colors duration-500 hover:bg-[#1B150F] md:grid-cols-2 md:items-baseline md:gap-6 md:py-10 lg:px-12"
                  style={{
                    opacity: on ? 1 : 0,
                    transform: on ? "none" : "translateY(18px)",
                    transition: `opacity 0.6s var(--vy-ease) ${index * 130}ms, transform 0.6s var(--vy-ease) ${index * 130}ms, background-color 0.5s`,
                  }}
                >
                  {/* Divider that draws in (skipped on the first row) */}
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-8 top-0 h-px origin-left bg-[#2A2722] lg:inset-x-12"
                      style={{
                        transform: on ? "scaleX(1)" : "scaleX(0)",
                        transition: `transform 0.8s var(--vy-ease) ${index * 130 + 150}ms`,
                      }}
                    />
                  ) : null}
                  <span role="cell" className="text-[15px] leading-relaxed text-ondark-2 md:text-base">
                    <span className="vy-eyebrow mb-1.5 block text-ondark-3 md:hidden">
                      Where work gets stuck
                    </span>
                    {row.cause}
                  </span>
                  <span
                    role="cell"
                    className="text-[clamp(1.3rem,2.6vw,1.9rem)] font-semibold tracking-[-0.01em] transition-colors duration-500"
                    style={{ color: isActive ? "var(--color-ondark)" : "var(--color-ondark-3)" }}
                  >
                    <span className="vy-eyebrow mb-1.5 block font-normal text-ondark-3 md:hidden">
                      What it costs
                    </span>
                    {row.cost}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
