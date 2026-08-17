"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useInView, useReducedMotion } from "motion/react";
import { track } from "@/lib/analytics";
import { INTEGRATIONS } from "./integrations";

/* ── Integrations orbit ──────────────────────────────────────────────────────
   The right half of the Senses section: the roster queues along a hidden arc
   and one tool at a time slides into the dock beside Finch. v4 dropped the
   drawn ring and the status chip (the chip's job moved to `IntegrationPrompt`,
   rendered by `Senses.tsx` from the `active` index this component reports up)
   — see that file for how the two stay in sync off one timer.

   Mechanically this is still folk.com's hero widget as reverse-engineered in
   `.ai/research/integrations-orbit.md`, not a rotation animation: a single
   `step` integer advances on an interval, every tile re-renders with a new
   inline transform/opacity, and a CSS transition does the travelling. That is
   why there is no per-tile animation state to keep in sync — one number is the
   whole machine, so pausing is just "don't tick", and reduced motion is just
   "never tick". folk rotates the transform (`rotate → translateY → rotate`)
   rather than translating to a point, which is what makes the interpolation
   follow the arc instead of cutting the chord; that trick is kept verbatim.

   Sizing is CSS-only. The widget is authored against a fixed logical canvas
   and every coordinate is `calc(n * var(--u))`, where `--u` is one canvas
   pixel expressed in container-query units. No ResizeObserver, no mounted-
   width state, so the server's markup is already correct at any width. The
   `FINCH` label's font-size gets a `max(…px, …)` floor: below `lg` the canvas
   shrinks to ~0.6 scale and 10 canvas-px of label text would be 6px on a
   phone.                                                                     */

/* ── Geometry ─────────────────────────────────────────────────────────────────
   Derived, not eyeballed: the ring centre is placed so the dock (the right end
   of the capsule) sits exactly on the ring, which is what lets tiles arrive by
   travelling rather than by flying in from nowhere. The arc's lower run passes
   behind the capsule — that is where the roster queues out of sight.

   v4: the canvas is centred and its bottom band is gone (no chip to make room
   for below the capsule any more), so CAPSULE/FINCH/DOCK all shifted left by
   the same amount the canvas narrowed by — nothing in the vertical relationships
   changed, since that geometry was never dictated by the chip in the first
   place, only the canvas height was. */
const CANVAS_W = 560;
const CANVAS_H = 372;
/** One canvas pixel. 100cqw is the rendered canvas width, so 100/560 cqw = 1px
    of the logical canvas at whatever size the column happens to be. */
const UNIT = "0.17857143cqw";

const CAPSULE = { x: 90, y: 176, w: 380, h: 156 };
const FINCH   = { cx: 168, cy: 254, d: 120 };
const DOCK    = { cx: 392, cy: 254 };
const LABEL_Y = 344;

const RING_R     = 195;
const DOCK_ANGLE = -5;  /* where on the ring the dock sits, ccw from 3 o'clock */
/* v4: 5 slots instead of 8 (dock + next 4 only), so the step between them
   opened up from 26° to 35° — the queue now reads as an arc over the dock's
   shoulder (roughly 10 → 2 o'clock) instead of a tight fan. */
const STEP_ANGLE = 35;  /* between neighbouring slots */
/* The docked tile is 120px against its neighbours' 64px, so the slot right
   after the dock gets a little extra elbow room or the queue touches it. */
const DOCK_GAP   = 4;

const RING_CX = DOCK.cx - RING_R * Math.cos((DOCK_ANGLE * Math.PI) / 180);
const RING_CY = DOCK.cy + RING_R * Math.sin((DOCK_ANGLE * Math.PI) / 180);

/** Every tile is laid out in the same 120px box and scaled down; that keeps one
    transform doing all the work (folk's approach) instead of animating width. */
const TILE_BOX = 120;

/* Size/opacity by slot offset from the dock — a lookup table, as folk uses.
   v4: only the docked tile + next 4 are visible at all (the plan's "next 4
   only"); everything past offset 4 is `PARKED` below, fully transparent but
   still positioned and still transitioning, so a tile fades in the instant it
   crosses into +4 rather than popping. */
const SLOTS = [
  { size: 120, opacity: 1    }, /* docked */
  { size: 64,  opacity: 0.95 }, /* +1 */
  { size: 60,  opacity: 0.80 }, /* +2 */
  { size: 56,  opacity: 0.60 }, /* +3 */
  { size: 52,  opacity: 0.40 }, /* +4 */
];
/* Offset -1: the tool that just left the dock. It slides down behind the
   capsule, so it fades out rather than ghosting across the pill. */
const LEAVING = { size: 64, opacity: 0 };
/* Everything further back is parked on the hidden run of the arc, invisible —
   still shrinking a step further than +4 so it doesn't "jump" size when it
   next becomes visible. */
const PARKED  = { size: 48, opacity: 0 };

const STEP_MS      = 2400; /* calmer than folk's 1800 — this is a marketing rest stop */
const TRANSFORM_MS = 700;
const OPACITY_MS   = 450;
const EASE         = "cubic-bezier(.22,1,.36,1)";

const N = INTEGRATIONS.length;

/** Canvas px → CSS length. */
const u = (n: number) => `calc(${n} * var(--u))`;

function slotOffset(index: number, active: number) {
  const raw = (index - active + N) % N; /* 0 … N-1 */
  return raw === N - 1 ? -1 : raw;
}

function slotFor(offset: number) {
  if (offset < 0) return LEAVING;
  return SLOTS[offset] ?? PARKED;
}

/** CSS `rotate()` angle for a slot: clockwise from 12 o'clock, which is the
    frame `rotate(φ) translateY(-R) rotate(-φ)` works in. */
function slotRotation(offset: number) {
  const gap = offset === 0 ? 0 : offset > 0 ? DOCK_GAP : -DOCK_GAP;
  return 90 - (DOCK_ANGLE + STEP_ANGLE * offset + gap);
}

export function IntegrationsOrbit({
  onActiveChange,
}: {
  /** Reports the docked index up so `Senses.tsx` can drive `IntegrationPrompt`
      off the same number — one timer, two renderers, per the v4 plan. */
  onActiveChange?: (index: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  /* rootMargin keeps it ticking slightly before/after the section is on screen,
     so a reader arriving mid-cycle never catches it frozen. */
  const inView = useInView(rootRef, { amount: 0.25, margin: "160px 0px" });

  const [hovered, setHovered] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [step, setStep] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  /* `orbit_hover`, once per pageview — a ref guard, not state: it gates a
     `track()` call rather than anything that re-renders. */
  const hoverTrackedRef = useRef(false);

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  /* SSR safety comes free from `inView`: it is false on the server and on the
     first client render, so the markup both produce is step 0 — Xero docked,
     everything else parked on the arc — and cycling only begins once the
     observer has fired post-mount. No separate mounted gate needed. */
  const running = inView && tabVisible && !hovered && !reduceMotion;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setStep((s) => s + 1), STEP_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const active = step % N;

  /* The only cross-component state sync in this file: `active` is derived
     (from `step`), not a second source of truth, so reporting it up on change
     is not "state that could be computed during render" — the parent can't
     compute it, it doesn't own the interval. */
  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  const transition = reduceMotion
    ? "none"
    : `transform ${TRANSFORM_MS}ms ${EASE}, opacity ${OPACITY_MS}ms ${EASE}`;

  return (
    <div className="w-full">
      {/* The canvas is decorative; this is the same information as prose. */}
      <ul className="sr-only">
        {INTEGRATIONS.map((it) => (
          <li key={it.slug}>
            {it.name} — {it.short}
          </li>
        ))}
      </ul>

      <div
        ref={rootRef}
        aria-hidden="true"
        onPointerEnter={() => {
          setHovered(true);
          if (!hoverTrackedRef.current) {
            hoverTrackedRef.current = true;
            track("orbit_hover", {});
          }
        }}
        onPointerLeave={() => setHovered(false)}
        className="relative mx-auto w-full max-w-[560px] overflow-hidden"
        style={{
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          containerType: "inline-size",
          ...({ "--u": UNIT } as React.CSSProperties),
        }}
      >
        {/* Capsule: the dock Finch and the current tool share. Flat by design —
            no blur, no translucency anywhere on this surface. v4: no drawn
            ring behind it any more — tiles still travel the same circular
            path, only the 1px arc line is gone. */}
        <span
          className="absolute border border-fn-line"
          style={{
            left:         u(CAPSULE.x),
            top:          u(CAPSULE.y),
            width:        u(CAPSULE.w),
            height:       u(CAPSULE.h),
            borderRadius: u(CAPSULE.h / 2),
            background:   "#F5F2EA",
          }}
        />

        <span
          className="absolute z-[1] flex items-center justify-center rounded-full border border-fn-line bg-fn-surface shadow-[var(--fn-shadow-card)]"
          style={{
            left:   u(FINCH.cx - FINCH.d / 2),
            top:    u(FINCH.cy - FINCH.d / 2),
            width:  u(FINCH.d),
            height: u(FINCH.d),
          }}
        >
          <Image
            src="/finch/finch-bird.svg"
            alt=""
            width={44}
            height={44}
            style={{ width: u(44), height: u(44) }}
          />
        </span>

        {/* The one orange thing in the widget: an agent-activity pulse each time
            the dock changes hands. Keyed by step so it re-plays, and skipped at
            step 0 so nothing animates on load. */}
        {!reduceMotion && step > 0 ? (
          <motion.span
            key={step}
            className="pointer-events-none absolute z-[4] rounded-full"
            style={{
              left:   u(FINCH.cx - FINCH.d / 2),
              top:    u(FINCH.cy - FINCH.d / 2),
              width:  u(FINCH.d),
              height: u(FINCH.d),
              border: "2px solid rgba(255,119,39,0.45)",
            }}
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.12, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        ) : null}

        <span
          className="absolute z-[4] -translate-x-1/2 font-fn-mono text-fn-muted"
          style={{
            left:          u(FINCH.cx),
            top:           u(LABEL_Y),
            fontSize:      `max(9px, ${u(10)})`,
            letterSpacing: "0.14em",
          }}
        >
          FINCH
        </span>

        {INTEGRATIONS.map((it, i) => {
          const offset   = slotOffset(i, active);
          const slot     = slotFor(offset);
          const rotation = slotRotation(offset);
          const isActive = offset === 0;
          const failed   = broken.includes(it.slug);

          return (
            <span
              key={it.slug}
              className="absolute"
              style={{
                left:   u(RING_CX),
                top:    u(RING_CY),
                width:  u(TILE_BOX),
                height: u(TILE_BOX),
                /* Rotate → step out along the radius → rotate back upright. The
                   angle is what interpolates, so the tile travels the arc. */
                transform:
                  `translate(-50%, -50%) rotate(${rotation}deg) ` +
                  `translateY(${u(-RING_R)}) rotate(${-rotation}deg) ` +
                  `scale(${slot.size / TILE_BOX})`,
                opacity:    slot.opacity,
                transition,
                willChange: "transform, opacity",
                zIndex:     isActive ? 3 : 2,
              }}
            >
              <span
                className="flex h-full w-full items-center justify-center rounded-full border border-fn-line bg-fn-surface"
                style={{
                  boxShadow:  isActive ? "var(--fn-shadow-card)" : "none",
                  transition: reduceMotion ? "none" : `box-shadow ${OPACITY_MS}ms ${EASE}`,
                }}
              >
                {failed ? (
                  /* A broken logo would read as a bug; an initial reads as a
                     tool we simply have no mark for. */
                  <span
                    className="font-fn-mono text-fn-muted"
                    style={{ fontSize: u(20), letterSpacing: "0.06em" }}
                  >
                    {it.name.charAt(0)}
                  </span>
                ) : (
                  <Image
                    src={`/finch/integrations/${it.slug}.svg`}
                    alt=""
                    width={56}
                    height={56}
                    onError={() => setBroken((b) => (b.includes(it.slug) ? b : [...b, it.slug]))}
                    className="object-contain"
                    style={{
                      /* 56 of the 120px tile box, so the docked mark is 56px and
                         an arc tile's is ~30px — both without a second scale. */
                      width:      "46.667%",
                      height:     "46.667%",
                      filter:     isActive ? "none" : "grayscale(1)",
                      opacity:    isActive ? 1 : 0.75,
                      transition: reduceMotion
                        ? "none"
                        : `filter ${OPACITY_MS}ms ${EASE}, opacity ${OPACITY_MS}ms ${EASE}`,
                    }}
                  />
                )}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default IntegrationsOrbit;
