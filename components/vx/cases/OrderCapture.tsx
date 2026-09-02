"use client";

/* ── Order capture, rendered ─────────────────────────────────────────────────
   A customer places an order the way they already do (a WhatsApp message,
   an email with a PO attached); the system reads it, matches the customer
   and the products, and creates the order for a person to confirm. This is
   the same ingest pattern that runs in production: verify → resolve the
   customer from a key they can't choose → capture → propose, never finalise
   unprompted. Choreographed with the shared `.vx-art` step vocabulary. */

import { useEffect, useRef, type CSSProperties } from "react";

const step = (t: number, extra: CSSProperties = {}) => ({ "data-step": "", style: { "--t": t, ...extra } as CSSProperties });

export function OrderCapture() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        node.classList.add("is-live");
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="vx-art vx-capture" aria-hidden="true">
      {/* WhatsApp */}
      <div className="vx-capture-col">
        <div className="vx-capture-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/integrations/whatsapp.svg" alt="" width={16} height={16} /> WhatsApp · Boland Trading
        </div>
        <div className="vx-bubble" {...step(200)}>
          Morning, for Thursday please: 20 crates butternut, 10 bags potatoes 10kg, 6 trays eggs. Same address.
          <span className="t">07:41</span>
        </div>
        <div className="vx-bubble me" {...step(2600)}>
          Got it. Order ORD-1366 for Thursday, 3 lines, R 6 918. We&rsquo;ll confirm shortly.
          <span className="t">07:41</span>
        </div>
      </div>

      {/* Email */}
      <div className="vx-capture-col">
        <div className="vx-capture-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/integrations/outlook.svg" alt="" width={16} height={16} /> Outlook · orders@
        </div>
        <div className="vx-mail" {...step(600)}>
          <div className="from">Sam Naidoo · Klapmuts Farm Stall</div>
          <div className="subj">PO 4471 · delivery Fri</div>
          <div className="att">
            <span className="vx-chip vx-chip-muted">PO-4471.pdf</span>
            <span className="vx-chip vx-chip-blue" {...step(1400)}>read · 97%</span>
          </div>
        </div>
      </div>

      {/* Captured order */}
      <div className="vx-capture-col">
        <div className="vx-capture-head">Captured → OrderFlow</div>
        <div className="vx-art-card vx-order" {...step(1800, { position: "relative" })}>
          <div className="row head">
            <span>ORD-1366 · Boland Trading</span>
            <span className="vx-chip vx-chip-signal">to confirm</span>
          </div>
          <div className="row"><span>Butternut, crate ×20</span><span>R 2 940</span></div>
          <div className="row"><span>Potatoes 10kg ×10</span><span>R 1 080</span></div>
          <div className="row"><span>Eggs, tray ×6</span><span>R 2 898</span></div>
          <div className="row total"><span>Matched 96% · Aug price list</span><span>R 6 918</span></div>
        </div>
        <div className="vx-capture-foot" {...step(3000)}>
          <span className="vx-chip vx-chip-green">confirmed by Thandi · 07:52</span>
          <span>invoice drafted · awaiting send</span>
        </div>
      </div>
    </div>
  );
}
