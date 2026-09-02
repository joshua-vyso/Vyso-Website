"use client";

/* ── Built for: industry rows ────────────────────────────────────────────────
   Three rows on ink. Hovering a row floats a miniature brief card that
   follows the cursor (fine pointers only); the row itself is a plain link. */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { INDUSTRY_ROWS } from "../content";
import { Arrow, Reveal, Words } from "../primitives";

const CARDS: Record<string, { head: string; lines: [string, string][] }> = {
  "food-hospitality": {
    head: "07:00 · Kitchen brief",
    lines: [
      ["Butternut +12% at produce supplier", "signal"],
      ["40 crates invoiced, 36 delivered", "signal"],
      ["2 accounts crossed 14 days", "muted"],
    ],
  },
  construction: {
    head: "07:02 · Site brief · 3 sites",
    lines: [
      ["Rebar invoice 8.4% above PO rate", "signal"],
      ["POD missing for Tuesday's ready-mix", "signal"],
      ["Quote follow-up sent · 2 open", "muted"],
    ],
  },
  insurance: {
    head: "07:05 · Book brief",
    lines: [
      ["14 renewals due in 30 days", "signal"],
      ["6 compliance packs incomplete", "signal"],
      ["Claim docs received · filed", "muted"],
    ],
  },
};

export function Industries() {
  const card = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const node = card.current;
    if (!node || !window.matchMedia("(pointer: fine)").matches) return undefined;
    const move = (e: PointerEvent) => {
      node.style.left = `${e.clientX + 160}px`;
      node.style.top = `${e.clientY}px`;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const data = active ? CARDS[active] : null;

  return (
    <section className="vx-section vx-on-ink" aria-labelledby="industries-h" onPointerLeave={() => setActive(null)}>
      <div className="vx-wrap">
        <div className="vx-section-head">
          <div>
            <Reveal>
              <p className="vx-eyebrow">Built for</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h2" text="Operations we know" em="by name." />
            <span id="industries-h" className="sr-only">
              Industries
            </span>
          </div>
          <Reveal delay={100}>
            <p className="vx-lead">The systems don&rsquo;t change per industry. What changes is which one earns its place first.</p>
          </Reveal>
        </div>

        <ul className="vx-rows" role="list">
          {INDUSTRY_ROWS.map((row) => (
            <li key={row.slug}>
              <Link
                href={`/industries/${row.slug}`}
                className="vx-row"
                data-cursor-label="Open"
                onPointerEnter={() => setActive(row.slug)}
                onFocus={() => setActive(row.slug)}
              >
                <span className="n">{row.num}</span>
                <span className="t">{row.title}</span>
                <span className="p">{row.pain}</span>
                <span className="a" aria-hidden="true">
                  <Arrow />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div ref={card} className="vx-row-card" data-show={active ? "true" : "false"} aria-hidden="true">
          {data ? (
            <div className="vx-art-card" style={{ position: "relative", padding: 14, fontFamily: "var(--vx-mono)", fontSize: "0.7rem", color: "var(--vx-ondark-2)" }}>
              <div style={{ color: "var(--vx-ondark)", marginBottom: 10 }}>{data.head}</div>
              {data.lines.map(([text, tone], i) => (
                <div key={text} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--vx-ink-line-2)" }}>
                  <span className={`vx-chip vx-chip-${tone}`}>{i + 1}</span>
                  <span style={{ color: tone === "signal" ? "var(--vx-ondark)" : undefined }}>{text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
