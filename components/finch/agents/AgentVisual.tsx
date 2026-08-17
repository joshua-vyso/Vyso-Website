"use client";

import { motion, type Variants } from "motion/react";
import type { ExampleAgent } from "./agents-data";

/* ── Evidence micro-visuals ──────────────────────────────────────────────────
   One per example agent: the smallest honest picture of what that agent
   actually looks at. Each plays once when its card enters, in ≤ 600ms.

   They are variant children: the card sets `rest` → `play` (or goes straight to
   `play` under reduced motion) and every element in here follows, so there is
   no per-visual state, no timers and nothing to reset.

   Colour discipline: everything drawn here is evidence, so everything is blue.
   The one exception is the price sparkline's end dot, which marks the current
   price the agent is flagging — the same orange dot the homepage chart uses. */

const MONO = "var(--font-plex-mono), 'IBM Plex Mono', monospace";
const SANS = "var(--font-instrument), 'Instrument Sans', system-ui, sans-serif";

const W = 240;
const H = 68;

/** Draw a stroke from nothing to whole. */
const draw = (to = 1): Variants => ({ rest: { pathLength: 0 }, play: { pathLength: to } });
/** Appear late — for the value a drawing resolves to. */
const late = (delay: number): Variants => ({
  rest: { opacity: 0 },
  play: { opacity: 1, transition: { duration: 0.2, delay } },
});
/** Grow left → right (an ageing bar, a highlight sweep). */
const sweep = (to = 1): Variants => ({ rest: { scaleX: 0 }, play: { scaleX: to } });
/** A number stamping in, the way rand figures do everywhere else on the site. */
const stamp = (delay: number): Variants => ({
  rest: { opacity: 0, scale: 1.3 },
  play: { opacity: 1, scale: 1, transition: { duration: 0.22, delay } },
});

const drawTransition = { duration: 0.55, ease: "easeOut" } as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden className="block">
      {children}
    </svg>
  );
}

/* Supplier prices, line by line — a six-month sparkline with today's price. */
function PriceVisual() {
  return (
    <Frame>
      <line x1="4" y1="62" x2="236" y2="62" stroke="#F0EDE5" strokeWidth="1" />
      <motion.path
        d="M 8 50 L 52 46 L 96 40 L 140 34 L 184 22 L 230 8"
        fill="none"
        stroke="#4B96DD"
        strokeWidth="2"
        strokeLinecap="round"
        variants={draw()}
        transition={drawTransition}
      />
      <motion.circle cx="230" cy="8" r="3.5" fill="#FF7727" variants={late(0.5)} />
      <motion.text
        x="236"
        y="26"
        textAnchor="end"
        fontFamily={MONO}
        fontSize="9"
        fill="#C94F0E"
        variants={late(0.55)}
      >
        +12%
      </motion.text>
    </Frame>
  );
}

/* Invoiced against delivered — the row that doesn't match gets picked out. */
function ReconVisual() {
  return (
    <Frame>
      <text x="6" y="12" fontFamily={MONO} fontSize="8.5" letterSpacing="0.1em" fill="#A39D8E">
        INVOICED
      </text>
      <text x="130" y="12" fontFamily={MONO} fontSize="8.5" letterSpacing="0.1em" fill="#A39D8E">
        DELIVERED
      </text>
      <motion.rect
        x="126"
        y="32"
        width="108"
        height="16"
        rx="3"
        fill="#D9E9F8"
        style={{ originX: 0, transformBox: "fill-box" }}
        variants={sweep()}
        transition={drawTransition}
      />
      {[
        ["24 × 10kg", "24", 28],
        ["20 × 5L", "18", 44],
        ["12 × 6kg", "12", 60],
      ].map(([left, right, y]) => (
        <g key={String(y)}>
          <text x="6" y={y} fontFamily={MONO} fontSize="10.5" fill="#6B6659">
            {left}
          </text>
          <text x="130" y={y} fontFamily={MONO} fontSize="10.5" fill="#2F6FAE">
            {right}
          </text>
        </g>
      ))}
      <motion.text
        x="234"
        y="44"
        textAnchor="end"
        fontFamily={MONO}
        fontSize="9.5"
        letterSpacing="0.08em"
        fill="#2F6FAE"
        style={{ originX: 1, transformBox: "fill-box" }}
        variants={stamp(0.4)}
      >
        2 SHORT
      </motion.text>
    </Frame>
  );
}

/* An account ageing past terms. */
function DebtorsVisual() {
  return (
    <Frame>
      <text x="6" y="16" fontFamily={MONO} fontSize="8.5" letterSpacing="0.1em" fill="#A39D8E">
        DAYS OUTSTANDING
      </text>
      <rect x="6" y="28" width="228" height="10" rx="5" fill="#F0EDE5" />
      <motion.rect
        x="6"
        y="28"
        width="228"
        height="10"
        rx="5"
        fill="#4B96DD"
        style={{ originX: 0, transformBox: "fill-box" }}
        variants={sweep(0.8)}
        transition={drawTransition}
      />
      <motion.text
        x="188"
        y="56"
        textAnchor="middle"
        fontFamily={MONO}
        fontSize="9.5"
        letterSpacing="0.08em"
        fill="#2F6FAE"
        style={{ originX: 0.5, transformBox: "fill-box" }}
        variants={stamp(0.45)}
      >
        DAY 48
      </motion.text>
      <text x="6" y="56" fontFamily={MONO} fontSize="8.5" fill="#B9B3A3">
        0
      </text>
      <text x="234" y="56" textAnchor="end" fontFamily={MONO} fontSize="8.5" fill="#B9B3A3">
        60+
      </text>
    </Frame>
  );
}

/* Stock cover, as a gauge — days of stock against the orders on their way. */
function StockVisual() {
  const arc = "M 72 58 A 48 48 0 0 1 168 58";
  return (
    <Frame>
      <path d={arc} fill="none" stroke="#F0EDE5" strokeWidth="6" strokeLinecap="round" />
      <motion.path
        d={arc}
        fill="none"
        stroke="#4B96DD"
        strokeWidth="6"
        strokeLinecap="round"
        variants={draw(0.55)}
        transition={drawTransition}
      />
      <motion.text
        x="120"
        y="52"
        textAnchor="middle"
        fontFamily={SANS}
        fontSize="19"
        fontWeight="600"
        fill="#14120E"
        style={{ originX: 0.5, transformBox: "fill-box" }}
        variants={stamp(0.45)}
      >
        22
      </motion.text>
      <text x="120" y="66" textAnchor="middle" fontFamily={MONO} fontSize="8.5" letterSpacing="0.1em" fill="#A39D8E">
        DAYS COVER
      </text>
    </Frame>
  );
}

/* The week's findings, arriving as one message. */
function BriefVisual() {
  return (
    <Frame>
      {[14, 30, 46].map((cx, i) => (
        <motion.circle key={cx} cx={cx} cy="14" r="3.5" fill="#B9B3A3" variants={late(0.08 * i)} />
      ))}
      <motion.g variants={late(0.35)}>
        <rect x="6" y="28" width="196" height="34" rx="9" fill="#FFFFFF" stroke="#E7E3DA" />
        <rect x="6" y="54" width="10" height="8" fill="#FFFFFF" />
        <text x="18" y="49" fontFamily={SANS} fontSize="11" fill="#4A463C">
          3 things need your attention.
        </text>
      </motion.g>
    </Frame>
  );
}

/* A route against its delivery notes — the drop that never got signed. */
function DeliveryVisual() {
  return (
    <Frame>
      <motion.path
        d="M 14 52 L 110 26 L 226 42"
        fill="none"
        stroke="#4B96DD"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={draw()}
        transition={drawTransition}
      />
      <circle cx="14" cy="52" r="3.5" fill="#D8D3C6" />
      <circle cx="110" cy="26" r="3.5" fill="#D8D3C6" />
      <motion.circle
        cx="226"
        cy="42"
        r="4.5"
        fill="#4B96DD"
        style={{ originX: 0.5, originY: 0.5, transformBox: "fill-box" }}
        variants={stamp(0.45)}
      />
      <motion.text
        x="234"
        y="62"
        textAnchor="end"
        fontFamily={MONO}
        fontSize="9"
        letterSpacing="0.08em"
        fill="#2F6FAE"
        variants={late(0.5)}
      >
        STOP 3 · NOT SIGNED
      </motion.text>
    </Frame>
  );
}

const VISUALS: Record<ExampleAgent["visual"], () => React.ReactElement> = {
  price:    PriceVisual,
  recon:    ReconVisual,
  debtors:  DebtorsVisual,
  stock:    StockVisual,
  brief:    BriefVisual,
  delivery: DeliveryVisual,
};

export function AgentVisual({ kind }: { kind: ExampleAgent["visual"] }) {
  const Visual = VISUALS[kind];
  return <Visual />;
}

export default AgentVisual;
