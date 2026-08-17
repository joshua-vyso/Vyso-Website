"use client";

import { useRef } from "react";
import { useInView } from "motion/react";

/* ── Mount-on-approach ───────────────────────────────────────────────────────
   §3: devices are `dynamic`-imported and mounted when the band is ≤ 1 viewport
   away. This is the gate half — `next/dynamic` in each device's own module is
   the code-splitting half.

   A `100%` root margin is literally "one viewport in either direction", which
   is why it's written as a percentage rather than a pixel guess that would be
   wrong on every screen that isn't the one it was tuned on.

   `once` on purpose: a device that unmounted on scroll-away would re-run its
   chunk's evaluation and reset its phase every time the band came back. Pausing
   is the cheap part (`useCanvasStage` already does it and a paused stage costs
   nothing); unmounting would only save memory the page has already allocated. */
export function Deferred({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const near = useInView(ref, { once: true, margin: "100% 0px 100% 0px" });

  return (
    /* `aria-hidden` here rather than on each device: everything mounted through
       this gate is decoration. A living background that announced itself to a
       screen reader would be a bug in every single case. */
    <div ref={ref} aria-hidden className={className || "absolute inset-0 overflow-hidden"}>
      {near ? children : null}
    </div>
  );
}

export default Deferred;
