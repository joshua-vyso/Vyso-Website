"use client";

/* ── The principle ───────────────────────────────────────────────────────────
   One sentence, centred, and a switch that flips itself when it comes into
   view: the system proposes, a person turns it on. */

import { useEffect, useRef, useState } from "react";
import { Reveal, Words } from "../primitives";

export function Principle() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        window.setTimeout(() => setOn(true), 700);
        io.disconnect();
      }
    }, { threshold: 0.6 });
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <section className="vx-section vx-principle" aria-labelledby="principle-h">
      <div className="vx-wrap">
        <Reveal>
          <p className="vx-eyebrow" style={{ justifyContent: "center" }}>
            The line we never cross
          </p>
        </Reveal>
        <Words as="h2" className="vx-display vx-h2" text="Software proposes." em="People decide." startIndex={0} />
        <span id="principle-h" className="sr-only">
          Software proposes. People decide.
        </span>
        <Reveal delay={120}>
          <p className="vx-lead" style={{ margin: "28px auto 0", textAlign: "center" }}>
            Client messages, disputes and payments wait for approval. Uncertain reads queue for review. Findings arrive with evidence.
          </p>
        </Reveal>
        <div ref={ref} style={{ marginTop: 36 }}>
          <button type="button" className="vx-switch" data-on={on ? "true" : "false"} onClick={() => setOn((v) => !v)} aria-pressed={on}>
            <span className="knob" aria-hidden="true" />
            {on ? "Approved by a person" : "Awaiting approval"}
          </button>
        </div>
      </div>
    </section>
  );
}
