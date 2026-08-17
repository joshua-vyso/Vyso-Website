"use client";

import { motion } from "motion/react";
import { AgentVisual } from "./AgentVisual";
import { EXAMPLE_AGENTS, type ExampleAgent } from "./agents-data";

/* ── Custom agents on shift: the grid ────────────────────────────────────────
   The six example cards. The section around them — eyebrow, H2, the honesty
   line — is server-rendered by `components/finch/WhatFinchWatches.tsx`; only
   the grid needs the client, because each card's evidence micro-visual (see
   `AgentVisual.tsx`) draws itself once when it enters.

   The card itself never animates. It is the homepage's roster and the target
   of `/#agents`, so it has to be a real card in the server HTML — a staggered
   opacity reveal would ship the section as six empty boxes until hydration,
   and an anchor lands you there before that. What plays is the drawing inside
   it: the wrapper below is the variant parent, `rest` → `play` once on enter.

   No `useReducedMotion()` branch here (6a follow-up). It used to switch to
   `initial="play", animate="play"` under reduced motion — a different prop
   shape than the `initial="rest"` the server always serialises, since the
   server has no media query and always renders the full-motion tree. A
   reduced-motion client's hydration render disagreed with that tree: a
   hydration mismatch, the same one `FindingDeck` had. `initial` is now always
   `"rest"`; `motion` already honours the OS setting *inside* the animation
   (its default `reducedMotion: "user"` snaps the reveal straight to its end
   value) — same outcome, the finished drawing, without branching the render.
   `FindingCard.tsx`'s `FindingMicroVisual` wraps this same `AgentVisual` the
   same way, for the same reason.

   3 across at `lg`, 2 at `md`, one below: these cards each carry a micro-visual
   and a status chip, and six of them in one row would be unreadable.          */

function AgentCard({ agent, index }: { agent: ExampleAgent; index: number }) {
  return (
    /* 6b: the roster gains a hover lift — 3px and a deeper card shadow over
       180ms. Transform and box-shadow only, so it composites and never
       relayouts the grid; `motion-reduce:` drops the lift (and the transition
       with it) rather than leaving a card that jumps, because a 3px hop is
       exactly the kind of incidental movement §9's reduced-motion matrix is
       about. The border colour change stays either way — it is a colour, not
       motion. */
    <div className="flex flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[20px] py-[22px] shadow-[var(--fn-shadow-card)] transition-[transform,box-shadow,border-color] duration-[180ms] ease-out hover:-translate-y-[3px] hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card-hover)] motion-reduce:transition-colors motion-reduce:hover:translate-y-0">
      <div className="mb-[12px] flex items-center gap-[8px]">
        <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-fn-orange" />
        <span className="font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-ink-2">
          {agent.label}
        </span>
      </div>
      <div className="mb-[16px] text-[14px] leading-[1.5] text-fn-ink-3">{agent.body}</div>
      <div className="mt-auto">
        <motion.div
          initial="rest"
          whileInView="play"
          viewport={{ once: true, amount: 0.55 }}
          /* Left to right across the row, so the three drawings don't all
             start in the same frame. */
          transition={{ delay: (index % 3) * 0.06 }}
        >
          <AgentVisual kind={agent.visual} />
        </motion.div>
        <div className="mt-[14px] border-t border-fn-line-2 pt-[12px]">
          <span className="inline-block rounded-[99px] border border-fn-line px-[9px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-muted">
            {agent.status}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AgentsOnShift({ agents = EXAMPLE_AGENTS }: { agents?: ExampleAgent[] }) {
  return (
    <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent, i) => (
        <AgentCard key={agent.label} agent={agent} index={i} />
      ))}
    </div>
  );
}

export default AgentsOnShift;
