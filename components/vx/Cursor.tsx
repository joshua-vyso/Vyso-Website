"use client";

/* ── Custom cursor ───────────────────────────────────────────────────────────
   The logo's "o": an orange dot with a lagging ring, blended with
   `difference` so it reads on ink and paper alike. Fine pointers only; the
   native cursor is hidden via `html[data-vx-cursor="custom"]`. Elements opt
   into modes with `data-cursor="link"` or `data-cursor-label="Open"`. */

import { useEffect, useRef } from "react";

export function Cursor() {
  const root = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = root.current;
    if (!fine || reduced || !node) return undefined;

    document.documentElement.dataset.vxCursor = "custom";
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let raf = 0;
    let visible = false;

    const dot = node.querySelector<HTMLElement>(".vx-cursor-dot")!;
    const ring = node.querySelector<HTMLElement>(".vx-cursor-ring")!;

    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      dot.style.transform = `translate(${x}px, ${y}px)`;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      raf = requestAnimationFrame(loop);
    };

    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        visible = true;
        node.dataset.mode = node.dataset.mode === "hidden" ? "" : node.dataset.mode;
      }
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-cursor-label], [data-cursor], a, button, summary, [role=button]",
      );
      if (!target) {
        node.dataset.mode = "";
        return;
      }
      const text = target.dataset.cursorLabel;
      if (text) {
        node.dataset.mode = "label";
        if (label.current) label.current.textContent = text;
      } else {
        node.dataset.mode = "link";
      }
    };
    const leave = () => {
      visible = false;
      node.dataset.mode = "hidden";
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("mouseleave", leave);
      delete document.documentElement.dataset.vxCursor;
    };
  }, []);

  return (
    <div ref={root} className="vx-cursor" data-mode="hidden" aria-hidden="true">
      <div className="vx-cursor-ring" style={{ position: "fixed" }}>
        <span ref={label} className="vx-cursor-label" />
      </div>
      <div className="vx-cursor-dot" style={{ position: "fixed" }} />
    </div>
  );
}
