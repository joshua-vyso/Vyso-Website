"use client";

/* ── Preloader ───────────────────────────────────────────────────────────────
   A 0→100 count in the display face, once per session. Server-rendered as
   visible so there is never a flash of page-then-overlay; `sessionStorage`
   decides on the client whether it plays or is removed on the first frame.
   Total budget: ~1.3s count + 0.9s wipe. Under reduced motion CSS hides it. */

import { useEffect, useState, useSyncExternalStore } from "react";

const KEY = "vx:loaded";
const noSub = () => () => {};
const seen = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export function Preloader() {
  const alreadySeen = useSyncExternalStore(noSub, seen, () => false);
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (alreadySeen) return undefined;
    document.documentElement.style.overflow = "hidden";
    const start = performance.now();
    const dur = 1050;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setN(Math.round(eased * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setDone(true);
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {
          /* fine */
        }
        window.setTimeout(() => {
          setGone(true);
          document.documentElement.style.overflow = "";
          window.dispatchEvent(new CustomEvent("vx:loaded"));
        }, 800);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.style.overflow = "";
    };
  }, [alreadySeen]);

  if (alreadySeen || gone) return null;

  return (
    <div className="vx-loader" data-done={done ? "true" : "false"} aria-hidden="true">
      <div className="vx-loader-count">
        {String(n).padStart(3, "0")}
        <sup>%</sup>
      </div>
      <div className="vx-loader-foot" style={{ "--p": n / 100 } as React.CSSProperties}>
        <i />
        <span>Vyso · Operating layer</span>
        <span>Johannesburg</span>
      </div>
    </div>
  );
}
