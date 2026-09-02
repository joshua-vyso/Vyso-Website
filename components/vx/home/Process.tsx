"use client";

/* ── How it runs: pinned horizontal ──────────────────────────────────────────
   The section is tall (420svh); its stage sticks and the track translates
   across as the page scrolls, so five steps read like one long line. Above
   900px only; phones get a vertical stack (CSS) and this effect no-ops.
   rAF-throttled, transform only, and inert under reduced motion. */

import { useEffect, useRef } from "react";
import { useStaticMotion } from "@/components/site/motion-preference";
import { PROCESS } from "../content";
import { Reveal, Words } from "../primitives";

export function Process() {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const staticMotion = useStaticMotion();

  useEffect(() => {
    if (staticMotion) return undefined;
    const section = root.current;
    const rail = track.current;
    if (!section || !rail) return undefined;
    const mq = window.matchMedia("(min-width: 900px)");
    let raf = 0;
    const apply = () => {
      raf = 0;
      if (!mq.matches) {
        rail.style.transform = "";
        return;
      }
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -rect.top / total));
      /* Exactly the overflow: step 01 sits at its padding at p=0, step 05's
         right edge meets the gutter at p=1. */
      const travel = Math.max(0, rail.scrollWidth - rail.clientWidth);
      rail.style.transform = `translate3d(${(-p * travel).toFixed(1)}px, 0, 0)`;
      bar.current?.style.setProperty("--p", p.toFixed(3));
      const steps = rail.querySelectorAll<HTMLElement>(".vx-step");
      const active = Math.min(steps.length - 1, Math.floor(p * steps.length + 0.15));
      steps.forEach((el, i) => el.classList.toggle("is-active", i === active));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [staticMotion]);

  return (
    <section ref={root} className="vx-process" aria-labelledby="process-h">
      <div className="vx-process-stage">
        <div className="vx-process-head">
          <div>
            <Reveal>
              <p className="vx-eyebrow">How it runs</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h3" text="Map. Build. Run alongside." em="Then operate." />
            <span id="process-h" className="sr-only">
              How an engagement runs
            </span>
          </div>
          <Reveal delay={100}>
            <p className="vx-small" style={{ maxWidth: "30ch" }}>
              No transformation decks. One operation, one leak, one system that earns its keep, then the next.
            </p>
          </Reveal>
        </div>

        <div ref={track} className="vx-process-track">
          {PROCESS.map((s, i) => (
            <article className={`vx-step ${i === 0 ? "is-active" : ""}`} key={s.num}>
              <div className="vx-step-num" aria-hidden="true">
                {s.num}
              </div>
              <div>
                <h3 className="vx-step-title">
                  <span className="vx-mono" style={{ fontSize: "0.66rem", letterSpacing: "0.14em", color: "var(--vx-text-3)", display: "block", marginBottom: 10 }}>
                    Step {s.num}
                  </span>
                  {s.title}
                </h3>
                <p className="vx-step-body">{s.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div ref={bar} className="vx-process-progress" aria-hidden="true">
          <i />
        </div>
      </div>
    </section>
  );
}
