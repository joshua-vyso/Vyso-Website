"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";

import { track } from "@/lib/analytics";
import { AgentVisual } from "./agents/AgentVisual";
import type { ExampleAgent } from "./agents/agents-data";
import {
  FLAGSHIP,
  getFinding,
  type Finding,
  type FindingId,
  type FindingState,
  type FindingVisual,
} from "@/lib/marketing/findings";

/* ── The finding card ────────────────────────────────────────────────────────
   The atomic component of the Finch marketing surface: every other Finch
   surface (hero, scroll sequence, mobile storyboard) reuses either the whole
   card or its pieces. Ported 1:1 from .ai/design/FindingCard.dc.html — sizes,
   colours and the ±4° tilt maths are the design's, not invented here.

   Phase 6a added two things and changed nothing else: a `finding` prop that
   pulls the copy out of `lib/marketing/findings.ts` by id (so a page names a
   card instead of restating it), and a `variant` for the four shapes §5 needs.
   Every existing caller passes neither and gets exactly what it got before —
   which is why the props are additive and the defaults are the old defaults.  */

/* Re-exported because ~15 modules already import `FindingState` from this file;
   the type moved to the library with the data, the import path did not. */
export type { FindingState, FindingId, Finding } from "@/lib/marketing/findings";

/** `compact` bubble-sized · `standard` today's card · `wide` with the evidence
    micro-visual · `ink` the dark-band variant (§5's "card variants"). */
export type FindingVariant = "compact" | "standard" | "wide" | "ink";

type StateStyle = {
  label:  string;
  color:  string;
  border: string;
  dot:    string;
  /* The pulse is the page's only looping animation; reduced motion kills it
     globally via `.finch-site *` in globals.css. */
  pulse:  boolean;
  bar:    string;
};

const STATE_STYLES: Record<FindingState, StateStyle> = {
  "new": {
    label: "NEW", color: "#C94F0E", border: "#F3D9C6", dot: "#FF7727", pulse: true, bar: "#FF7727",
  },
  "in-progress": {
    label: "IN PROGRESS", color: "#6B6659", border: "#E7E3DA", dot: "#FF7727", pulse: false, bar: "#FF7727",
  },
  "resolved": {
    label: "RESOLVED", color: "#8A8474", border: "#E7E3DA", dot: "#B9B3A3", pulse: false, bar: "#D8D3C6",
  },
};

/** The state chip is the one piece with hard-coded hex (the ramp has no token
    for "NEW orange on a warm chip"), so the ink card needs its own set. Nothing
    else does — see `INK_VARS`. */
const INK_STATE_STYLES: Record<FindingState, StateStyle> = {
  "new": {
    label: "NEW", color: "#FFB27A", border: "#4A3A2C", dot: "#FF7727", pulse: true, bar: "#FF7727",
  },
  "in-progress": {
    label: "IN PROGRESS", color: "#B9B3A3", border: "#2A2722", dot: "#FF7727", pulse: false, bar: "#FF7727",
  },
  "resolved": {
    label: "RESOLVED", color: "#8A8474", border: "#2A2722", dot: "#6B6659", pulse: false, bar: "#3A362F",
  },
};

/** The default card is the site's signature example, and the signature example
    lives in the library. Spread rather than referenced so the shape (and every
    existing `FINDING_DEFAULTS.observation` call site) is unchanged. */
export const FINDING_DEFAULTS = {
  agent:       FLAGSHIP.agent,
  observation: FLAGSHIP.observation,
  impact:      FLAGSHIP.impact,
  evidence:    FLAGSHIP.evidence,
  meta:        FLAGSHIP.meta,
  state:       FLAGSHIP.state,
  actions:     [...FLAGSHIP.actions],
};

/* ── The ink variant, done with custom properties ────────────────────────────
   Every piece below paints through `--fn-*` tokens (`bg-fn-surface`,
   `text-fn-ink-3`, `border-fn-line-2`…). So the dark card is not a second set
   of components or a `tone` prop threaded through six of them — it is the same
   components under a re-pointed palette. Change a piece once and both variants
   follow, which is the only version of this that stays in sync.

   Values are §2's ink ramp: `#1B1915` fill, `#2A2722` hairline, `#FFB27A` for
   orange *text* on ink (8:1 — plain `#FF7727` is a glow colour, not a text
   colour), and the evidence chip as a translucent blue rather than the paper
   tint, which would glow white on a near-black card. */
const INK_VARS = {
  "--fn-surface": "var(--fn-ink-fill)",
  "--fn-line": "var(--fn-ink-line)",
  "--fn-line-2": "var(--fn-ink-line)",
  "--fn-line-3": "#3A362F",
  "--fn-line-hover": "#4A463C",
  "--fn-ink": "var(--fn-ink-text)",
  "--fn-ink-2": "#D8D3C6",
  "--fn-ink-3": "var(--fn-ink-text-2)",
  "--fn-muted-2": "var(--fn-ink-mono)",
  "--fn-orange-deep": "var(--fn-orange-on-ink)",
  "--fn-blue-deep": "var(--fn-blue-text-2)",
  "--fn-blue-tint": "rgba(63,123,196,0.16)",
  /* An ink card sits on an ink band: a drop shadow has nothing to fall on. */
  "--fn-shadow-card": "none",
  "--fn-shadow-card-hover": "none",
} as CSSProperties;

/* ── Tilt ────────────────────────────────────────────────────────────────────
   Writes straight to element.style rather than through React state — the card
   is a pointer-follower, so a re-render per mousemove would be wasted work.
   Off on coarse pointers (a tilt that can never be seen still costs listeners)
   and under reduced motion.                                                   */
function useTilt(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    // Read only after mount: the server has no pointer, and assuming "fine"
    // keeps the SSR markup byte-identical to the first client render.
    const mq = window.matchMedia("(pointer: coarse)");
    const sync = () => setCoarsePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const active = enabled && !reduceMotion && !coarsePointer;

  const onMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!active || !el) return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width  - 0.5;
    const y = (event.clientY - rect.top)  / rect.height - 0.5;
    el.style.transform  = `perspective(900px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateY(-2px)`;
    el.style.transition = "box-shadow 200ms ease-out";
  }, [active]);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!active || !el) return;
    el.style.transform  = "perspective(900px) rotateY(0deg) rotateX(0deg)";
    el.style.transition = "transform 250ms ease-out, box-shadow 200ms ease-out";
  }, [active]);

  return { ref, onMouseMove, onMouseLeave };
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

/** Which palette the card's hard-coded hex comes from. Everything else follows
    the custom properties `INK_VARS` re-points. */
export type FindingTone = "paper" | "ink";

const stateStyles = (state: FindingState, tone: FindingTone) =>
  (tone === "ink" ? INK_STATE_STYLES : STATE_STYLES)[state];

export function FindingCardFrame({
  children,
  tilt = false,
  state = "new",
  tone = "paper",
  /** `compact` trims the padding; the other three share the design's numbers. */
  dense = false,
  className = "",
  style,
}: {
  children:   React.ReactNode;
  tilt?:      boolean;
  state?:     FindingState;
  tone?:      FindingTone;
  dense?:     boolean;
  className?: string;
  style?:     React.CSSProperties;
}) {
  const { ref, onMouseMove, onMouseLeave } = useTilt(tilt);

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={tone === "ink" ? { ...INK_VARS, ...style } : style}
      className={
        "relative cursor-default rounded-[10px] border border-fn-line bg-fn-surface " +
        (dense
          ? "pt-[15px] pr-[16px] pb-[13px] pl-[19px] "
          : "pt-[22px] pr-[24px] pb-[18px] pl-[27px] ") +
        "will-change-transform " +
        "shadow-[var(--fn-shadow-card)] transition-[box-shadow] duration-200 ease-out " +
        "hover:shadow-[var(--fn-shadow-card-hover)] " + className
      }
    >
      <span
        className={
          "absolute left-0 w-[3px] rounded-[2px] " + (dense ? "top-[10px] bottom-[10px]" : "top-[14px] bottom-[14px]")
        }
        style={{ background: stateStyles(state, tone).bar }}
      />
      {children}
    </div>
  );
}

export function FindingHeader({
  agent = FINDING_DEFAULTS.agent,
  state = "new",
  tone = "paper",
  className = "",
}: {
  agent?:     string;
  state?:     FindingState;
  tone?:      FindingTone;
  className?: string;
}) {
  const s = stateStyles(state, tone);
  return (
    <div className={"flex items-center gap-[8px] mb-[12px] " + className}>
      <span
        className="h-[7px] w-[7px] rounded-full"
        style={{
          background: s.dot,
          animation:  s.pulse ? "fn-pulse 2s ease-out infinite" : undefined,
        }}
      />
      <span className="font-fn-mono text-[11px] tracking-[0.12em] text-fn-ink-3">{agent}</span>
      <span
        className="ml-auto font-fn-mono text-[10px] tracking-[0.1em] rounded-[99px] px-[9px] py-[3px]"
        style={{ color: s.color, border: `1px solid ${s.border}` }}
      >
        {s.label}
      </span>
    </div>
  );
}

export function FindingObservation({
  children,
  className = "",
}: {
  children:   React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"text-[17px] leading-[1.45] text-fn-ink mb-[10px] " + className}>
      {children}
    </div>
  );
}

export function FindingImpact({
  children,
  className = "",
}: {
  children:   React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"text-[21px] font-semibold tracking-[-0.01em] text-fn-orange-deep mb-[12px] " + className}>
      {children}
    </div>
  );
}

export function FindingEvidence({
  evidence = FINDING_DEFAULTS.evidence,
  meta,
  className = "",
}: {
  evidence?:  string;
  meta?:      string;
  className?: string;
}) {
  return (
    <div className={"flex flex-wrap items-center gap-x-[8px] gap-y-[6px] mb-[16px] " + className}>
      {/* nowrap: at phone width the chip is the first thing to buckle, and a
          chip with its arrow on a second line stops reading as a chip. */}
      <span className="shrink-0 whitespace-nowrap font-fn-mono text-[11.5px] text-fn-blue-deep bg-fn-blue-tint rounded-[6px] px-[10px] py-[4px]">
        {evidence} ↗
      </span>
      {meta ? (
        /* nowrap: the meta label drops to its own line as a whole rather than
           breaking mid-text (e.g. orphaning "AUG") at narrow widths. */
        <span className="whitespace-nowrap font-fn-mono text-[10.5px] tracking-[0.08em] text-fn-muted-2">{meta}</span>
      ) : null}
    </div>
  );
}

export function FindingActions({
  actions = FINDING_DEFAULTS.actions,
  /* The sequence card is a picture of a card, not a card you can press — its
     actions are plain labels with the design's wider gap. */
  interactive = true,
  /** Only read when `interactive` — the agent label for `finding_card_action_
      click {agent, action}` (Phase 4, §7.7). Non-interactive cards (picture-
      of-a-card usages) never fire it. */
  agent = FINDING_DEFAULTS.agent,
  className = "",
}: {
  actions?:     string[];
  interactive?: boolean;
  agent?:       string;
  className?:   string;
}) {
  if (!interactive) {
    return (
      <div
        className={
          "flex gap-[14px] border-t border-fn-line-2 pt-[13px] text-[13px] font-medium text-fn-ink-2 " + className
        }
      >
        {actions.map((label, i) => (
          <span key={label} className="contents">
            {i > 0 ? <span className="text-fn-line-3">·</span> : null}
            <span>{label}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    /* wrap, don't squeeze: three actions do not fit on one line at phone width,
       and half-width labels broken over two lines read worse than a second row.
       Each item is an inline-flex unit that carries its own leading separator,
       so a wrap never strands a "·" at the start of a line. Below 400px the
       separators are hidden and the row gap widens to 14px so the labels just
       space out on their own (see .finch-site rule in globals.css). */
    <div className={"flex flex-wrap items-center gap-x-[6px] gap-y-[4px] max-[399px]:gap-x-[14px] border-t border-fn-line-2 pt-[13px] " + className}>
      {actions.map((label, i) => (
        <span key={label} className="inline-flex items-center gap-[6px]">
          {i > 0 ? <span className="max-[399px]:hidden text-[12px] text-fn-line-3">·</span> : null}
          <span
            onClick={() => track("finding_card_action_click", { agent, action: label })}
            className="cursor-pointer whitespace-nowrap rounded-[5px] px-[6px] py-[3px] text-[13px] font-medium text-fn-ink-2 transition-all duration-[120ms] hover:bg-[#F5F2EA] hover:text-fn-ink"
          >
            {label}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ── The evidence micro-visual ───────────────────────────────────────────────
   `wide` adds the smallest honest picture of what the agent looked at, and the
   six drawings already exist in `agents/AgentVisual.tsx` (built for the
   homepage roster). Reused rather than redrawn — one set of evidence graphics
   for the whole site is the point, and a second set would drift within a month.

   The library's visual names are stated in the plan's own vocabulary
   (`sparkline`/`diff`/`bar`/`gauge`); the drawings are named after the agents
   that first needed them. This is the join. */
const VISUAL_KIND: Record<Exclude<FindingVisual, null>, ExampleAgent["visual"]> = {
  sparkline: "price",
  diff:      "recon",
  bar:       "debtors",
  gauge:     "stock",
};

function FindingMicroVisual({ visual }: { visual: Exclude<FindingVisual, null> }) {
  /* No `useReducedMotion()` branch here on purpose. `motion` already honours
     the OS setting *inside* the animation (its default `reducedMotion: "user"`
     snaps transform and path animations straight to their end value), which is
     the same outcome — the finished drawing — without the render branching that
     produced a hydration mismatch: the server has no media query, so it always
     serialises the full-motion tree, and a client that renders the other branch
     hands React a tree that doesn't match. Measured on `/design` with
     `prefers-reduced-motion: reduce` emulated. */
  return (
    <motion.div
      initial="rest"
      whileInView="play"
      viewport={{ once: true, amount: 0.6 }}
      className="mb-[14px] border-t border-fn-line-2 pt-[14px]"
    >
      <AgentVisual kind={VISUAL_KIND[visual]} />
    </motion.div>
  );
}

/* ── The composed card ───────────────────────────────────────────────────────
   Four variants (§5). The prop surface is deliberately backwards-compatible:
   every existing call site passes individual strings and gets `standard` on
   paper, byte for byte what it rendered before. New call sites pass a `finding`
   id and stop restating copy that already lives in the library.               */

/** Per-variant geometry. Everything colour-related is `tone`'s job. */
const VARIANT: Record<FindingVariant, {
  tone: FindingTone;
  dense: boolean;
  width: string;
  observation: string;
  impact: string;
  actions: boolean;
  visual: boolean;
}> = {
  compact:  { tone: "paper", dense: true,  width: "max-w-[340px]", observation: "text-[14px] leading-[1.45]", impact: "text-[16px] mb-[10px]", actions: false, visual: false },
  standard: { tone: "paper", dense: false, width: "max-w-[460px]", observation: "", impact: "", actions: true, visual: false },
  wide:     { tone: "paper", dense: false, width: "max-w-[560px]", observation: "", impact: "", actions: true, visual: true },
  ink:      { tone: "ink",   dense: false, width: "max-w-[460px]", observation: "", impact: "", actions: true, visual: false },
};

export function FindingCard({
  /** Pull every string from `lib/marketing/findings.ts`. Individual props still
      win over it, so a page can borrow a card and override one line. */
  finding,
  variant = "standard",
  /** Overrides the variant's own ground. The one case 6b needs is `/pricing`'s
      single `wide` card, which straddles a blue band's bottom seam and so has
      to be dark while still carrying the `wide` micro-visual — a combination
      the five variants in §5 don't name, and one that does not deserve a sixth
      variant when it is purely a question of which ground the card is sitting
      on. Geometry stays the variant's; colour becomes the caller's. */
  tone,
  agent,
  observation,
  impact,
  evidence,
  meta,
  state,
  tilt        = true,
  actions,
  /** Only honoured by `wide`; `null` in the library means "no visual". */
  visual,
  interactive = true,
  className,
}: {
  finding?:     FindingId | Finding;
  variant?:     FindingVariant;
  tone?:        FindingTone;
  agent?:       string;
  observation?: string;
  impact?:      string;
  evidence?:    string;
  meta?:        string;
  state?:       FindingState;
  tilt?:        boolean;
  actions?:     readonly string[];
  visual?:      FindingVisual;
  interactive?: boolean;
  className?:   string;
}) {
  const source: Finding | typeof FINDING_DEFAULTS =
    finding === undefined
      ? FINDING_DEFAULTS
      : typeof finding === "string"
        ? getFinding(finding)
        : finding;

  const v = VARIANT[variant];
  const cardTone = tone ?? v.tone;
  const resolved = {
    agent:       agent       ?? source.agent,
    observation: observation ?? source.observation,
    impact:      impact      ?? source.impact,
    evidence:    evidence    ?? source.evidence,
    meta:        meta        ?? source.meta,
    state:       state       ?? source.state,
    actions:     actions     ?? source.actions,
    visual:      visual      ?? ("visual" in source ? source.visual : null),
  };

  return (
    <FindingCardFrame
      tilt={tilt}
      state={resolved.state}
      tone={cardTone}
      dense={v.dense}
      className={className ?? v.width}
    >
      <FindingHeader agent={resolved.agent} state={resolved.state} tone={cardTone} />
      <FindingObservation className={v.observation}>{resolved.observation}</FindingObservation>
      <FindingImpact className={v.impact}>{resolved.impact}</FindingImpact>
      {v.visual && resolved.visual ? <FindingMicroVisual visual={resolved.visual} /> : null}
      <FindingEvidence evidence={resolved.evidence} meta={resolved.meta} />
      {v.actions ? (
        <FindingActions actions={[...resolved.actions]} agent={resolved.agent} interactive={interactive} />
      ) : null}
    </FindingCardFrame>
  );
}

export default FindingCard;
