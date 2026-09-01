"use client";

/* ── Sticky-section scroll progress ──────────────────────────────────────────
   One hook for the homepage's pinned sequences: give a tall wrapper a sticky
   100vh stage inside it, and this reports how far the wrapper has been
   scrolled through as 0..1. rAF-throttled, passive listeners, active only
   while the wrapper is near the viewport, and never mounted under reduced
   motion (callers render their static form instead). No scroll hijacking —
   the page scrolls natively; only the visuals read the position. */

import { useEffect, useRef, useState } from "react";

export function useStickyProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let frame = 0;
    let watching = false;
    let last = -1;

    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      const value = Math.min(1, Math.max(0, -rect.top / travel));
      if (Math.abs(value - last) < 0.0004) return;
      last = value;
      setProgress(value);
    };
    const onScroll = () => {
      if (watching && !frame) frame = requestAnimationFrame(measure);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        watching = entry?.isIntersecting ?? false;
        if (watching) onScroll();
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(node);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return { ref, progress };
}

/** Index of the list item whose centre is nearest the viewport's focus band —
    drives "active row" states without pinning anything. */
export function useActiveIndex<T extends HTMLElement>(count: number, disabled = false) {
  const containerRef = useRef<T>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (disabled) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;
    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-active-item]"));
    if (items.length === 0) return undefined;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const focus = window.innerHeight * 0.44;
      let best = 0;
      let bestDistance = Infinity;
      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - focus);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      setActive((current) => (current === best ? current : best));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [count, disabled]);

  return { containerRef, active };
}
