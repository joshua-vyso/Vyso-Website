"use client";

import { useEffect, useRef } from "react";

import { readFrameCost, useMovingThings } from "@/components/finch/ground/motion-budget";
import { LENIS_EVENT, LENIS_KEY } from "@/components/finch/SmoothScroll";

/* ── The instrument panel ────────────────────────────────────────────────────
   Sticky, top-right, on every scroll position of the sink. Four switches and
   two meters, and the meters are the point: §3's "max two moving things in any
   viewport" and §9's "< 4ms of main-thread work per frame" are both numbers,
   and a design review that cannot see the numbers is a design review that
   argues about them.

   The meters write straight into DOM nodes from a rAF loop rather than through
   state. A React re-render per frame to display a frame counter would be the
   single most expensive thing on this page, and it would make the FPS reading a
   measurement of the meter.                                                    */

export type DesignToggles = {
  forceStatic: boolean;
  cursor: boolean;
  lenis: boolean;
};

function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-[8px] py-[5px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-[2px] h-[13px] w-[13px] shrink-0 accent-[#BD4A0E]"
      />
      <span>
        <span className="block font-fn-mono text-[10px] tracking-[0.1em] text-fn-ink">{label}</span>
        <span className="block text-[11px] leading-[1.35] text-fn-muted">{hint}</span>
      </span>
    </label>
  );
}

export function DesignControls({
  toggles,
  onChange,
}: {
  toggles: DesignToggles;
  onChange: (next: DesignToggles) => void;
}) {
  const moving = useMovingThings();
  const fpsRef = useRef<HTMLSpanElement | null>(null);
  const costRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let frames = 0;
    let windowStart = performance.now();
    let raf = 0;

    const loop = (now: number) => {
      frames += 1;
      /* A one-second window: shorter and the number jitters too much to read,
         longer and it stops responding to a band you just scrolled into. */
      if (now - windowStart >= 1000) {
        const fps = Math.round((frames * 1000) / (now - windowStart));
        if (fpsRef.current) fpsRef.current.textContent = String(fps);
        const cost = readFrameCost();
        if (costRef.current) {
          costRef.current.textContent =
            cost.samples === 0 ? "—" : `${cost.mean.toFixed(2)} / ${cost.worst.toFixed(2)}`;
        }
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* Lenis reads `localStorage` and a custom event, not props — it lives in the
     root layout, above this page. Writing both here is the whole toggle. */
  const setLenis = (next: boolean) => {
    window.localStorage.setItem(LENIS_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(LENIS_EVENT));
    onChange({ ...toggles, lenis: next });
  };

  const overBudget = moving.length > 2;

  return (
    /* `h-0` so the panel floats over the first band instead of pushing it down
       — a sticky element still occupies flow height, and 200px of blank at the
       top of the sink would misrepresent the first band's own rhythm.
       `items-start` with it, or the flex default (`stretch`) hands the panel a
       0px height, its background paints as a 40px sliver and the labels render
       on bare ink with nothing behind them. */
    <div className="pointer-events-none sticky top-[12px] z-50 flex h-0 items-start justify-end px-[20px] lg:px-[40px]">
      <div className="pointer-events-auto w-[248px] rounded-[10px] border border-fn-line bg-fn-surface p-[14px] shadow-[var(--fn-shadow-float)]">
        <div className="mb-[8px] font-fn-mono text-[9.5px] tracking-[0.14em] text-fn-muted-2">
          DESIGN SINK · CONTROLS
        </div>

        <Switch
          label="REDUCED MOTION"
          hint="Emulates the OS setting: every device draws its static frame."
          checked={toggles.forceStatic}
          onChange={(next) => onChange({ ...toggles, forceStatic: next })}
        />
        <Switch
          label="CURSOR ATTRACTION"
          hint="Grid wave origin eases toward the pointer."
          checked={toggles.cursor}
          onChange={(next) => onChange({ ...toggles, cursor: next })}
        />
        <Switch
          label="LENIS SMOOTH SCROLL"
          hint="Momentum scrolling. On by default now — untick to switch it off."
          checked={toggles.lenis}
          onChange={setLenis}
        />

        <div className="mt-[10px] border-t border-fn-line-2 pt-[10px] font-fn-mono text-[10px] leading-[1.7] tracking-[0.06em]">
          <div className="flex justify-between text-fn-ink-3">
            <span>FPS</span>
            <span ref={fpsRef}>—</span>
          </div>
          <div className="flex justify-between text-fn-ink-3">
            <span>MS/FRAME μ/MAX</span>
            <span ref={costRef}>—</span>
          </div>
          <div
            className="flex justify-between"
            style={{ color: overBudget ? "#A8410C" : "var(--fn-ink-3)" }}
          >
            <span>MOVING THINGS</span>
            <span>
              {moving.length}
              {overBudget ? " ⚠" : ""}
            </span>
          </div>
          {moving.length > 0 ? (
            <div className="mt-[4px] text-[9px] leading-[1.5] text-fn-muted-2">
              {moving.join(" · ")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default DesignControls;
