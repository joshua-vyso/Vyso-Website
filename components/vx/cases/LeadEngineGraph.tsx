"use client";

/* ── Vyso Lead Engine v2, rendered ───────────────────────────────────────────
   A faithful, simplified map of the real n8n workflow (50 nodes; read via
   the n8n MCP on 2026-09-02, never executed from here). Three lanes run in
   sequence every weekday at 06:00: check replies, draft follow-ups, discover
   new leads. Everything ends in a Gmail DRAFT and a Notion row; nothing is
   sent by the machine. Pure SVG: nodes are real text, edges animate with a
   dashed stroke once the graph is in view. */

import { useEffect, useRef } from "react";

type Node = { id: string; x: number; y: number; w?: number; label: string; kind: "trigger" | "notion" | "ai" | "code" | "gmail" | "http" | "gate" | "end" };
type Edge = [string, string];

const W = 1180;
const H = 560;
const NW = 150;
const NH = 44;

const NODES: Node[] = [
  { id: "trig", x: 20, y: 258, w: 132, label: "Every weekday 06:00", kind: "trigger" },
  { id: "sig", x: 172, y: 258, w: 120, label: "Extract signature", kind: "code" },
  { id: "camp", x: 312, y: 258, w: 132, label: "Campaigns · templates", kind: "notion" },

  // Lane 1 — replies
  { id: "l1", x: 470, y: 60, w: 140, label: "Fetch recent inbox", kind: "gmail" },
  { id: "l1b", x: 630, y: 60, w: 130, label: "Match replies", kind: "code" },
  { id: "l1c", x: 780, y: 60, w: 150, label: "Verify reply is genuine", kind: "ai" },
  { id: "l1d", x: 950, y: 60, w: 130, label: "Mark lead replied", kind: "notion" },
  { id: "l1e", x: 780, y: 120, w: 150, label: "Detect bounces", kind: "code" },
  { id: "l1f", x: 950, y: 120, w: 130, label: "Mark email bounced", kind: "notion" },

  // Lane 2 — follow-ups
  { id: "l2", x: 470, y: 258, w: 140, label: "Follow-ups due today", kind: "notion" },
  { id: "l2b", x: 630, y: 258, w: 130, label: "Prep · defer rules", kind: "code" },
  { id: "l2c", x: 780, y: 258, w: 150, label: "Write follow-up email", kind: "ai" },
  { id: "l2d", x: 950, y: 258, w: 130, label: "Gmail draft", kind: "gmail" },
  { id: "l2e", x: 950, y: 318, w: 130, label: "Advance lead stage", kind: "notion" },

  // Lane 3 — discovery
  { id: "l3", x: 470, y: 456, w: 140, label: "Dedupe set · segments", kind: "notion" },
  { id: "l3b", x: 630, y: 456, w: 130, label: "Plan discovery round", kind: "code" },
  { id: "l3c", x: 780, y: 456, w: 150, label: "Find new leads · web search", kind: "ai" },
  { id: "l3d", x: 780, y: 396, w: 150, label: "Scrape home + contact page", kind: "http" },
  { id: "l3e", x: 950, y: 396, w: 130, label: "Qualify & draft", kind: "ai" },
  { id: "l3f", x: 950, y: 456, w: 130, label: "Gate · quota", kind: "gate" },
  { id: "l3g", x: 950, y: 516, w: 130, label: "Draft + add to Notion", kind: "end" },
];

const EDGES: Edge[] = [
  ["trig", "sig"], ["sig", "camp"],
  ["camp", "l1"], ["l1", "l1b"], ["l1b", "l1c"], ["l1c", "l1d"], ["l1", "l1e"], ["l1e", "l1f"],
  ["camp", "l2"], ["l2", "l2b"], ["l2b", "l2c"], ["l2c", "l2d"], ["l2d", "l2e"],
  ["camp", "l3"], ["l3", "l3b"], ["l3b", "l3c"], ["l3c", "l3d"], ["l3d", "l3e"], ["l3e", "l3f"], ["l3f", "l3g"], ["l3f", "l3b"],
];

const KIND: Record<Node["kind"], { fill: string; stroke: string; tag: string }> = {
  trigger: { fill: "#FF6B2C", stroke: "#FF6B2C", tag: "cron" },
  notion: { fill: "#131315", stroke: "rgba(255,255,255,0.18)", tag: "notion" },
  ai: { fill: "#131315", stroke: "#4C8DFF", tag: "gpt-5.5" },
  code: { fill: "#131315", stroke: "rgba(255,255,255,0.18)", tag: "code" },
  gmail: { fill: "#131315", stroke: "#4CD07D", tag: "gmail · draft" },
  http: { fill: "#131315", stroke: "rgba(255,255,255,0.18)", tag: "firecrawl" },
  gate: { fill: "#131315", stroke: "#FF6B2C", tag: "if" },
  end: { fill: "#F2EFE8", stroke: "#F2EFE8", tag: "notion + gmail" },
};

function byId(id: string) {
  return NODES.find((n) => n.id === id)!;
}

function path(a: Node, b: Node) {
  const aw = a.w ?? NW;
  const ax = a.x + aw;
  const ay = a.y + NH / 2;
  const bx = b.x;
  const by = b.y + NH / 2;
  if (b.x < a.x) {
    /* loop-back (gate → plan another round) */
    const yy = Math.max(a.y, b.y) + NH + 26;
    return `M${a.x + aw / 2},${a.y + NH} V${yy} H${b.x + (b.w ?? NW) / 2} V${b.y + NH}`;
  }
  const mx = (ax + bx) / 2;
  return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
}

export function LeadEngineGraph() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        node.classList.add("is-live");
        io.disconnect();
      }
    }, { threshold: 0.3 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div className="vx-graph-wrap">
      <svg ref={ref} className="vx-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Vyso Lead Engine v2: a scheduled workflow that checks replies, drafts follow-ups and discovers new leads, ending in Gmail drafts and Notion rows">
        {[
          { y: 40, label: "01 · Replies & bounces" },
          { y: 238, label: "02 · Follow-ups due today" },
          { y: 376, label: "03 · Discover · scrape · qualify" },
        ].map((lane) => (
          <g key={lane.label}>
            <line x1={460} x2={W - 20} y1={lane.y - 12} y2={lane.y - 12} stroke="rgba(255,255,255,0.08)" />
            <text x={460} y={lane.y - 20} className="vx-graph-lane">
              {lane.label}
            </text>
          </g>
        ))}
        {EDGES.map(([a, b]) => (
          <path key={`${a}-${b}`} d={path(byId(a), byId(b))} className="vx-graph-edge" />
        ))}
        {NODES.map((n, i) => {
          const k = KIND[n.kind];
          const w = n.w ?? NW;
          const dark = n.kind === "end" || n.kind === "trigger";
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`} className="vx-graph-node" style={{ "--i": i } as React.CSSProperties}>
              <rect width={w} height={NH} rx={10} fill={k.fill} stroke={k.stroke} />
              <text x={12} y={19} className="vx-graph-label" fill={dark ? "#0A0A0B" : "#F2EFE8"}>
                {n.label}
              </text>
              <text x={12} y={34} className="vx-graph-tag" fill={dark ? "rgba(10,10,11,0.7)" : "#8A8882"}>
                {k.tag}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="vx-graph-legend" aria-hidden="true">
        <li><i style={{ background: "#FF6B2C" }} /> trigger / gate</li>
        <li><i style={{ borderColor: "#4C8DFF" }} /> reasoning</li>
        <li><i style={{ borderColor: "#4CD07D" }} /> gmail, drafts only</li>
        <li><i style={{ background: "#F2EFE8" }} /> written to notion</li>
      </ul>
    </div>
  );
}
