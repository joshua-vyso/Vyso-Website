"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import { useMotionBudget, type MotionBudget } from "./motion-budget";

/* ── One clock, shared by the field and the type that rides it ───────────────
   §4.1: on a `WaveField` band the headline's `y` follows the field's own sine
   at the headline's x-centre. "The field's own sine" is the load-bearing part —
   two independent 30fps loops drift apart within seconds and the effect (type
   and lines breathing together) collapses into type and lines both wobbling.

   So the clock is the shared thing, not the animation. `WaveField` subscribes
   and paints; `WaveText` subscribes and writes transforms; both read the same
   `t` in the same frame from the same `sin`. One rAF, one entry in the motion
   budget, one phase.

   The clock is **subscriber-driven**: it runs only while something is
   subscribed and the tab is visible, and every subscriber gates its own
   subscription on being on screen. So a wave band that scrolls away stops the
   loop without the clock needing to know anything about layout.               */

export type WaveParams = {
  /** Spatial frequency, radians per CSS pixel. */
  k: number;
  /** Temporal frequency, radians per second. */
  omega: number;
  /** Peak displacement of a line, in CSS pixels. */
  amplitude: number;
};

export const DEFAULT_WAVE_PARAMS: WaveParams = { k: 0.008, omega: 0.5, amplitude: 16 };

export type WaveClock = {
  /** Live values, read at draw time rather than captured — the field and the
      type both look them up every frame, so a prop change reaches both without
      remounting either. Changed through `setParams`, never assigned directly:
      the clock is a hook dependency, and `react-hooks/immutability` (rightly)
      rejects reaching into one and writing a field. */
  readonly params: Readonly<WaveParams>;
  setParams(next: WaveParams): void;
  subscribe(listener: (t: number) => void): () => void;
  /** Internal: the provider owns the `visibilitychange` listener. */
  setTabVisible(visible: boolean): void;
};

const FRAME_MS = 1000 / 30;
const MAX_DELTA_MS = 100;

function createWaveClock(params: WaveParams, budget: MotionBudget | null): WaveClock {
  const listeners = new Set<(t: number) => void>();
  let raf = 0;
  let last = 0;
  let t = 0;
  let tabVisible = true;
  let release: (() => void) | null = null;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const elapsed = now - last;
    if (elapsed < FRAME_MS) return;
    last = now - (elapsed % FRAME_MS);
    t += Math.min(elapsed, MAX_DELTA_MS) / 1000;
    listeners.forEach((fn) => fn(t));
  };

  const sync = () => {
    const shouldRun = listeners.size > 0 && tabVisible;
    if (shouldRun && raf === 0) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
      release = budget?.register("WaveClock") ?? null;
    } else if (!shouldRun && raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
      release?.();
      release = null;
    }
  };

  const live: WaveParams = { ...params };

  return {
    params: live,
    setParams(next) {
      live.k = next.k;
      live.omega = next.omega;
      live.amplitude = next.amplitude;
    },
    subscribe(listener) {
      listeners.add(listener);
      /* Hand the newcomer the current phase immediately so it doesn't render a
         frame at t=0 before the next tick — visible as a jump on a slow band. */
      listener(t);
      sync();
      return () => {
        listeners.delete(listener);
        sync();
      };
    },
    setTabVisible(visible) {
      tabVisible = visible;
      sync();
    },
  };
}

const WaveClockContext = createContext<WaveClock | null>(null);

/** Null outside a provider — every consumer treats that as "no wave to ride". */
export function useWaveClock(): WaveClock | null {
  return useContext(WaveClockContext);
}

export function WaveClockProvider({
  children,
  k = DEFAULT_WAVE_PARAMS.k,
  omega = DEFAULT_WAVE_PARAMS.omega,
  amplitude = DEFAULT_WAVE_PARAMS.amplitude,
}: {
  children: React.ReactNode;
  k?: number;
  omega?: number;
  amplitude?: number;
}) {
  const budget = useMotionBudget();
  const clock = useMemo(() => createWaveClock(DEFAULT_WAVE_PARAMS, budget), [budget]);

  /* Params are mutated rather than passed through context state: a prop change
     must not remount the clock (that would reset the phase mid-wave) and must
     not re-render every subscriber. */
  useEffect(() => {
    clock.setParams({ k, omega, amplitude });
  }, [clock, k, omega, amplitude]);

  useEffect(() => {
    const onVisibility = () => clock.setTabVisible(!document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      /* Nothing to cancel: the clock stops on its own once the last subscriber
         unsubscribes, and every subscriber unsubscribes on unmount. */
    };
  }, [clock]);

  return <WaveClockContext.Provider value={clock}>{children}</WaveClockContext.Provider>;
}

/** The one wave equation, used by the canvas and by the type riding it. */
export function waveAt(x: number, t: number, params: WaveParams, phase = 0): number {
  return params.amplitude * Math.sin(x * params.k + t * params.omega + phase);
}
