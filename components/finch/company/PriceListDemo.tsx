"use client";

import { useEffect, useRef } from "react";
import { useInView, useReducedMotion } from "motion/react";

/* ── The "price list in seconds" micro-demo ──────────────────────────────────
   `/case-studies/turn-n-slice`'s signature visual. On enter, a mono item name
   types in (40ms/char — the same DOM-write typewriter idiom as `/solutions`'s
   `SymptomChecklist`, so a per-character interval never costs a React
   re-render), then a priced row appears behind a blue highlight sweep — the
   same "evidence, just read" motif `InvoiceCard`'s line highlights use.
   Plays once, on enter, total ≤1.5s (18 characters × 40ms ≈ 720ms of typing +
   a 250ms reveal). Reduced motion → the finished row renders immediately, no
   typing, no sweep.

   Every write below goes straight to `element.style`/`textContent` through
   refs, the same idiom `FindingCard.tsx`'s `useTilt` uses — nothing here is
   React state, so there is no synchronous `setState` inside an effect to
   trigger cascading renders (the repo's ESLint errors on
   `react-hooks/set-state-in-effect`), and a discrete two-step reveal costs
   zero re-renders either way.

   This is a worked example, not a screenshot of Turn 'n Slice's own data —
   captioned as such so nobody reads it as a captured customer price list. */

const ITEM = "Butternut 10kg bag";
const PRICE = "R 620.00 / bag";

export function PriceListDemo() {
  const reduceMotion = useReducedMotion() ?? false;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const typedRef = useRef<HTMLSpanElement | null>(null);
  const sweepRef = useRef<HTMLSpanElement | null>(null);
  const priceRef = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.6 });

  const reveal = () => {
    const sweep = sweepRef.current;
    const price = priceRef.current;
    if (sweep) sweep.style.transform = "scaleX(1)";
    if (price) price.style.opacity = "1";
  };

  useEffect(() => {
    const typed = typedRef.current;

    if (reduceMotion) {
      if (typed) typed.textContent = ITEM;
      reveal();
      return;
    }

    if (!inView || !typed) return;

    let i = 0;
    typed.textContent = "";
    const id = window.setInterval(() => {
      i += 1;
      typed.textContent = ITEM.slice(0, i);
      if (i >= ITEM.length) {
        window.clearInterval(id);
        reveal();
      }
    }, 40);

    return () => window.clearInterval(id);
  }, [inView, reduceMotion]);

  return (
    <div
      ref={containerRef}
      className="max-w-[420px] rounded-[10px] border border-fn-line bg-fn-surface px-[22px] py-[20px] shadow-[var(--fn-shadow-card)]"
    >
      <div className="mb-[14px] flex items-center justify-between">
        <span className="font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted">
          PRICE LIST · TURN &rsquo;N SLICE
        </span>
        <span className="font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-faint">LIVE IN ORDERFLOW</span>
      </div>

      <div className="relative overflow-hidden rounded-[6px] px-[12px] py-[13px]">
        <span
          ref={sweepRef}
          aria-hidden="true"
          className="absolute inset-0 bg-fn-blue-hl"
          style={{
            transformOrigin: "left",
            transform: reduceMotion ? "scaleX(1)" : "scaleX(0)",
            transition: reduceMotion ? undefined : "transform 320ms ease-out 50ms",
          }}
        />
        <div className="relative flex items-baseline justify-between gap-[16px] font-fn-mono text-[14px]">
          <span ref={typedRef} aria-hidden="true" className="text-fn-ink" />
          <span
            ref={priceRef}
            className="shrink-0 font-medium text-fn-ink"
            style={{
              opacity: reduceMotion ? 1 : 0,
              transition: reduceMotion ? undefined : "opacity 250ms ease-out 120ms",
            }}
          >
            {PRICE}
          </span>
        </div>
        <span className="sr-only" role="status">
          {ITEM} — {PRICE}
        </span>
      </div>

      <p className="m-0 mt-[14px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-faint">
        ILLUSTRATIVE DEMO — TYPE AN ITEM, THE PRICED ROW APPEARS
      </p>
    </div>
  );
}

export default PriceListDemo;
