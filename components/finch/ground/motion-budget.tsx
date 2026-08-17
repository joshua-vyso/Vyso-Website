"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

/* ── The motion budget, made countable ───────────────────────────────────────
   `.ai/vyso_v3_design.md` §3 sets a hard budget: **at most two moving things in
   any viewport**, and a band's living background counts as one of them. That is
   easy to write down and impossible to police by eye once six primitives exist,
   so every device registers itself here *while it is actually looping* — not
   while it is mounted, not while it is on screen and paused. The `/design`
   kitchen sink renders the count; if it ever reads 3 outside the cards grid,
   the composition is over budget and the page is wrong.

   Deliberately an external store read through `useSyncExternalStore` rather
   than context state: a device registering itself would otherwise mean a
   `setState` inside an effect (which `react-hooks/set-state-in-effect` rejects,
   and which would re-render every consumer on every band that scrolls past).
   Here registration is a plain `Set.add` and only the counter re-renders.      */

export type MotionBudget = {
  /** Called when a device starts looping. Returns its own unregister. */
  register(label: string): () => void;
  subscribe(onChange: () => void): () => void;
  /** Cached snapshot — `useSyncExternalStore` requires referential stability. */
  snapshot(): readonly string[];
};

export function createMotionBudget(): MotionBudget {
  /* A multiset: two OscillatingGrids both register as "OscillatingGrid" and
     both must be counted, so entries are unique objects with a label. */
  const entries = new Map<symbol, string>();
  const listeners = new Set<() => void>();
  let cached: readonly string[] = [];

  const publish = () => {
    cached = [...entries.values()].sort();
    listeners.forEach((fn) => fn());
  };

  return {
    register(label) {
      const key = Symbol(label);
      entries.set(key, label);
      publish();
      return () => {
        entries.delete(key);
        publish();
      };
    },
    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    snapshot: () => cached,
  };
}

const MotionBudgetContext = createContext<MotionBudget | null>(null);

/** Null on every real page — the counter is a `/design` instrument, and the
    devices must not pay for it in production. */
export function useMotionBudget(): MotionBudget | null {
  return useContext(MotionBudgetContext);
}

export function MotionBudgetProvider({ children }: { children: React.ReactNode }) {
  const budget = useMemo(() => createMotionBudget(), []);
  return <MotionBudgetContext.Provider value={budget}>{children}</MotionBudgetContext.Provider>;
}

const EMPTY: readonly string[] = [];

/** The live list of devices currently looping. */
export function useMovingThings(): readonly string[] {
  const budget = useMotionBudget();
  return useSyncExternalStore(
    budget ? budget.subscribe : noopSubscribe,
    budget ? budget.snapshot : emptySnapshot,
    emptySnapshot,
  );
}

const noopSubscribe = () => () => {};
const emptySnapshot = () => EMPTY;

/** Register a non-canvas device (the facet plane, the glow) for as long as it
    is actually animating. Canvas devices go through `useCanvasStage`, which
    does this itself at the point where its rAF starts and stops. */
export function useBudgetEntry(label: string, active: boolean) {
  const budget = useMotionBudget();
  useEffect(() => {
    if (!budget || !active) return;
    return budget.register(label);
  }, [budget, active, label]);
}

/* ── Frame-cost sampler ──────────────────────────────────────────────────────
   §9's budget is "total main-thread work per frame < 4ms". Every canvas stage
   times its own paint and drops the number in this ring buffer; `/design` reads
   the buffer and shows worst/mean. Module-level rather than context because the
   whole point is to sum across devices that share no ancestor, and because two
   `performance.now()` calls at 30fps is not a cost worth wiring through React. */

const SAMPLES = 240;
const ring = new Float32Array(SAMPLES);
let cursor = 0;
let filled = 0;

export function recordFrameCost(ms: number) {
  ring[cursor] = ms;
  cursor = (cursor + 1) % SAMPLES;
  if (filled < SAMPLES) filled += 1;
}

export function readFrameCost(): { mean: number; worst: number; samples: number } {
  if (filled === 0) return { mean: 0, worst: 0, samples: 0 };
  let total = 0;
  let worst = 0;
  for (let i = 0; i < filled; i += 1) {
    total += ring[i];
    if (ring[i] > worst) worst = ring[i];
  }
  return { mean: total / filled, worst, samples: filled };
}

export function resetFrameCost() {
  cursor = 0;
  filled = 0;
}
