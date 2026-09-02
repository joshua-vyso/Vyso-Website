"use client";

/* ── Artifacts ───────────────────────────────────────────────────────────────
   Five miniature systems, one per capability. Each is real DOM + CSS; the
   component only observes the viewport and adds `.is-live`, at which point
   the stylesheet runs the choreography. Values are illustrative demo data. */

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

function Stage({ kind, children }: { kind: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add("is-live");
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`vx-art ${kind}`} aria-hidden="true">
      {children}
    </div>
  );
}

/** Marks an element as a choreography step that appears `t` ms after the
    stage goes live; `extra` merges any layout styles. */
const step = (t: number, extra: CSSProperties = {}) => ({
  "data-step": "",
  style: { "--t": t, ...extra } as CSSProperties,
});

const card = (extra: CSSProperties): CSSProperties => ({ position: "relative", ...extra });

/* 01 — Read: a supplier invoice being scanned into rows. */
export function DocScan() {
  return (
    <Stage kind="vx-scan">
      <div className="vx-art-card" style={{ left: 18, right: 18, top: 22, bottom: 22, overflow: "hidden" }}>
        <div className="vx-art-bar" />
        <div style={{ padding: "12px 12px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "var(--vx-ondark)" }}>INV-20418 · Bramley Fresh</span>
          <span className="vx-chip vx-chip-blue" {...step(2300)}>
            filed
          </span>
        </div>
        <div className="vx-art-row" {...step(500)}>
          <span className="k">Butternut 10kg</span>
          <span className="v">R 486,00</span>
          <span className="vx-chip vx-chip-green">98%</span>
        </div>
        <div className="vx-art-row" {...step(900)}>
          <span className="k">Free-range eggs, tray</span>
          <span className="v">R 1 240,00</span>
          <span className="vx-chip vx-chip-green">96%</span>
        </div>
        <div className="vx-art-row" {...step(1300)}>
          <span className="k">Ice, 4kg bag ×20</span>
          <span className="v">R 380,00</span>
          <span className="vx-chip vx-chip-signal">review</span>
        </div>
        <div className="vx-art-row" {...step(1700)}>
          <span className="k">Delivery</span>
          <span className="v">R 150,00</span>
          <span className="vx-chip vx-chip-green">99%</span>
        </div>
      </div>
    </Stage>
  );
}

/* 02 — Check: invoiced vs delivered. */
export function Reconcile() {
  return (
    <Stage kind="vx-recon">
      <div style={{ position: "absolute", inset: 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div className="vx-recon-nums">
          <div {...step(200)}>
            <div style={{ marginBottom: 8 }}>Invoiced</div>
            <div className="vx-art-big">
              <span className="strike">40</span>
            </div>
          </div>
          <div {...step(700)}>
            <div style={{ marginBottom: 8 }}>Delivered · POD</div>
            <div className="vx-art-big">36</div>
          </div>
        </div>
        <div
          className="vx-art-card"
          {...step(2000, card({ padding: "10px 12px", display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }))}
        >
          <span style={{ color: "var(--vx-ondark)" }}>4 crates short · R 2 140</span>
          <span className="vx-chip vx-chip-signal">flagged</span>
        </div>
      </div>
    </Stage>
  );
}

/* 03 — Watch: a supplier price drifting past its threshold. */
export function Drift() {
  return (
    <Stage kind="vx-drift">
      <div style={{ position: "absolute", inset: 20, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Butternut · 6 months</span>
          <span className="vx-chip vx-chip-signal" {...step(2200)}>
            +12%
          </span>
        </div>
        <svg viewBox="0 0 300 90" preserveAspectRatio="none" style={{ flex: 1, width: "100%", marginTop: 12, overflow: "visible" }}>
          <line x1="0" y1="40" x2="300" y2="40" stroke="rgba(255,255,255,0.18)" strokeDasharray="3 5" />
          <path
            className="line"
            d="M0,64 L30,60 L60,62 L90,55 L120,58 L150,50 L180,52 L210,44 L240,46 L270,30 L300,26"
            fill="none"
            stroke="var(--vx-signal)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <circle className="pt-ring" cx="300" cy="26" r="6" fill="var(--vx-signal)" />
          <circle className="pt" cx="300" cy="26" r="4" fill="var(--vx-signal)" />
        </svg>
        <div {...step(2400, { display: "flex", justifyContent: "space-between", marginTop: 10 })}>
          <span>threshold 8%</span>
          <span style={{ color: "var(--vx-ondark)" }}>≈ R 58 000 / yr</span>
        </div>
      </div>
    </Stage>
  );
}

/* 04 — Follow: a drafted reminder waiting for a human. */
export function Approval() {
  return (
    <Stage kind="vx-approve">
      <div className="vx-art-card" {...step(300, { left: 18, right: 18, top: 20, padding: 14 })}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span>Draft · WhatsApp</span>
          <span className="vx-chip vx-chip-muted">14 days</span>
        </div>
        <p style={{ color: "var(--vx-ondark)", fontFamily: "var(--vx-sans)", fontSize: "0.86rem", lineHeight: 1.45 }}>
          Hi Sam, a quick nudge on invoice 1043 (R 18 400), due 14 days ago. Could you let us know when it&rsquo;s scheduled?
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <span className="vx-chip vx-chip-muted">Edit</span>
          <span className="vx-chip press" style={{ background: "var(--vx-ondark)", color: "var(--vx-ink)" }}>
            Approve &amp; send
          </span>
        </div>
      </div>
      <div className="sent" style={{ position: "absolute", left: 18, right: 18, bottom: 18, display: "flex", justifyContent: "space-between" }}>
        <span className="vx-chip vx-chip-green">sent 09:12 · tracked</span>
        <span>Naledi K. approved</span>
      </div>
    </Stage>
  );
}

/* 05 — Brief: the 07:00 roll-up. */
export function Brief() {
  const rowStyle = card({ padding: "10px 12px" });
  return (
    <Stage kind="vx-brief">
      <div style={{ position: "absolute", inset: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--vx-ondark)" }}>07:00 · Morning brief</span>
          <span>41 documents</span>
        </div>
        <div className="vx-art-card" {...step(400, rowStyle)}>
          <span className="vx-chip vx-chip-signal" style={{ marginRight: 8 }}>
            1
          </span>
          Butternut up 12% at produce supplier
        </div>
        <div className="vx-art-card" {...step(800, rowStyle)}>
          <span className="vx-chip vx-chip-signal" style={{ marginRight: 8 }}>
            2
          </span>
          40 crates invoiced, 36 delivered. Claim drafted
        </div>
        <div className="vx-art-card" {...step(1200, rowStyle)}>
          <span className="vx-chip vx-chip-signal" style={{ marginRight: 8 }}>
            3
          </span>
          Two accounts crossed 14 days. Reminders ready
        </div>
        <div {...step(1700, { marginTop: "auto", display: "flex", justifyContent: "space-between" })}>
          <span className="vx-chip vx-chip-green">everything else handled</span>
          <span>3 need you</span>
        </div>
      </div>
    </Stage>
  );
}

const ARTIFACTS = { read: DocScan, check: Reconcile, monitor: Drift, followup: Approval, brief: Brief } as const;

/** Server components can't index into a client module's object exports (they
    only receive component references), so the lookup happens here. */
export function Artifact({ id }: { id: keyof typeof ARTIFACTS }) {
  const Component = ARTIFACTS[id];
  return <Component />;
}
