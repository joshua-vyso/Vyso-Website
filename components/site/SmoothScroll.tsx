"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "motion/react";

/* ── Lenis smooth scroll — now the default ───────────────────────────────────
   §11.1 shipped this behind an off-by-default toggle so Josh could judge it
   live. He has (2026-08-16: "Lenis stays"), so the polarity flips: momentum
   scrolling is ON for everyone, and the `/design` switch becomes an **off**
   switch rather than an on switch.

   That flip is one line of meaning and three of consequence:

   - **`"0"` is the only value that disables it.** Absent key, `"1"`, anything
     else → on. Written as "not disabled" rather than "enabled" on purpose: the
     overwhelmingly common case is a reader who has never touched the toggle,
     and they must get the designed experience, not the fallback.
   - **Reduced motion still wins, unconditionally.** Momentum scrolling is
     motion, and someone who asked the OS for less of it did not mean "except
     scrolling". No toggle overrides this — the switch can only turn Lenis
     *off*, never on against the media query.
   - **`data-lenis` on `<html>`, not just the `lenis` class.** Lenis sets its own
     classes when it initialises, but 6b's pages need to *ask* whether momentum
     is running from CSS (and, in one place, from a hit test) before the library
     has finished loading its chunk. The attribute is written by this component
     synchronously alongside the dynamic import, so it is true from the first
     frame the decision is made rather than from whenever the chunk lands.

   The import stays dynamic. It is no longer about withholding the bytes from
   people who opted out — it is that scrolling must work before the chunk
   arrives, which it does, natively, and Lenis takes over when it is ready.    */

/* ── The snappy tuning (6b fixes) ────────────────────────────────────────────
   6b shipped `duration: 1.05` with an exponential ease, which is Lenis at its
   most cinematic: a single wheel notch kept moving for the better part of a
   second after the fingers stopped. Josh's review: "floaty". Correct — a
   duration-driven Lenis always takes the same wall-clock time to arrive, so a
   small input feels as slow as a large one.

   `lerp` instead of `duration` fixes the class of problem rather than the
   number: it is a per-frame fraction of the remaining distance, so a small
   scroll settles quickly and a big one still eases.

   **0.25, not the plan's 0.2** — measured, on `/operations-audit` at 1440, from
   a dispatched wheel event to the last frame that moved the page by more than
   half a pixel:

   | lerp | one notch | three | a fling (1200) |
   |---|---|---|---|
   | 6b (`duration: 1.05`) | 771ms | 898ms | 998ms |
   | 0.2  | 449ms | 542ms | 658ms |
   | 0.25 | **366ms** | 433ms | 533ms |

   0.2 is a 25% improvement that still misses the plan's own acceptance number
   (~350ms for a single notch); 0.25 hits it and a fling still takes half a
   second to arrive, which is the part worth keeping. The rest:

   - `wheelMultiplier: 1.1` — a notch covers slightly more than native, so the
     eased scroll never feels like it is behind the wheel.
   - `syncTouch: false` + `touchMultiplier: 1.5` — touch stays the platform's
     own scroll (syncing it is what makes phones feel rubbery and is where
     Lenis fights iOS momentum); the multiplier only scales drag distance.
   - `anchors: false` (Lenis's default, restated) — every in-page hash on the
     site relies on the browser's instant jump plus the target's `scroll-mt`.

   `data-lenis-snappy` on `<html>` alongside `data-lenis` so this is a *mode*
   the page can read, not an anonymous set of numbers — it is the default and
   currently the only one, and naming it is what lets a future feel be A/B'd
   from CSS or a probe without another boolean. */
const SNAPPY = {
  lerp: 0.25,
  smoothWheel: true,
  wheelMultiplier: 1.1,
  syncTouch: false,
  touchMultiplier: 1.5,
  anchors: false,
} as const;

/* ── The Orbit tuning ────────────────────────────────────────────────────────
   Josh, 2026-08-19: the subsite "feels slow / anti-movement". The bulk of that
   was the homepage's pinned sequence — 320vh of wrapper, 2.2 viewports of it
   spent not moving, on a page only 9.5 viewports long (`OrbitSequence`'s
   `WRAP_VH` carries the numbers and the fix). But it is not the whole of it,
   and the rest is a property of the subsite rather than of Lenis:

   Finch's pages are paper bands alternating with dark ones. A reader always has
   a hard edge arriving to tell them the page is moving. Orbit is ten bands of
   near-identical ink — even more so now that the seams between them are soft on
   purpose — so between headings there is very little in the frame that changes.
   The same lerp that reads as "eased" on `/` reads as "lagging" here, because
   there is nothing else moving to calibrate against.

   So the subsite gets a lighter instance: settle faster, and cover slightly
   more ground per wheel notch.

   The numbers are **derived, not measured** — from Lenis's own damping law
   rather than from a stopwatch, because the two differ by a rounding error and
   the law generalises. `Animate.advance` is
   `damp(value, to, lerp * 60, dt)` = `lerp(value, to, 1 - e^(-lerp*60*dt))`
   (node_modules/lenis/dist/lenis.mjs:37,86), so the distance still to travel
   decays as `d·e^(−60·lerp·t)` and the time to fall inside half a pixel is
   `ln(2d)/(60·lerp)`, with `d` the wheel delta times `wheelMultiplier`:

   | mode          | one notch | three | a fling (1200) |
   |---|---|---|---|
   | `SNAPPY` (0.25 / 1.1) | 360ms | 433ms | 525ms |
   | `ORBIT`  (0.32 / 1.2) | 285ms | 343ms | 415ms |

   The `SNAPPY` row is the check on the arithmetic: those three figures are
   within 2% of the ones actually measured on a wheel probe when this file's
   0.25 was chosen (366 / 433 / 533, table above), so the law describes what the
   library does and the `ORBIT` row can be trusted without re-measuring.

   Not a different feel — the same feel with the subsite's ground accounted for.
   Everything else is inherited verbatim, including `syncTouch: false`, because
   the phone behaviour has nothing to do with any of this.                      */
const ORBIT = {
  ...SNAPPY,
  lerp: 0.32,
  wheelMultiplier: 1.2,
} as const;

export const LENIS_KEY = "fn:lenis";
/** Dispatched by the `/design` toggle so the change takes effect without a
    reload. `storage` only fires in *other* tabs, which is the opposite of
    what a live toggle needs. */
export const LENIS_EVENT = "fn:lenis-change";

const subscribeLenis = (onChange: () => void) => {
  window.addEventListener(LENIS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LENIS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** The one place the polarity is written down. Default on; `"0"` is the opt-out
    the `/design` switch writes. */
function readEnabled(): boolean {
  return window.localStorage.getItem(LENIS_KEY) !== "0";
}

/** Whether smooth scroll is currently switched on. `useSyncExternalStore`
    because `localStorage` is an external mutable source and reading it into
    state inside an effect is the pattern this codebase's lint config rejects.

    `getServerSnapshot` returns `true` — the default — so the `/design` switch
    hydrates in its checked state instead of flashing off for a frame. */
export function useLenisEnabled(): boolean {
  return useSyncExternalStore(subscribeLenis, readEnabled, () => true);
}

/* ── Marketing only — never `/app/*` ─────────────────────────────────────────
   This component is mounted by the ROOT layout, which wraps the signed-in
   platform as well as the marketing site, and that turned out to be the whole
   of the "you cannot scroll anywhere under /app" bug (2026-08-17).

   Lenis takes over the DOCUMENT scroll: `wrapper` defaults to `window` and
   `content` to `document.documentElement` (node_modules/lenis/dist/lenis.mjs
   :434). On every wheel event it walks the composed path looking for an
   opt-out, and finding none it calls `event.preventDefault()` and re-applies
   the delta to the document (same file, ~:609-628). `allowNestedScroll` also
   defaults to `false`, so a nested scroller is NOT auto-detected — the
   library's contract is that you mark it yourself.

   That is fine on the marketing pages, where the document is the scroller. It
   is fatal under `/app/*`: the shell root is `flex h-screen … overflow-hidden`
   (app/app/layout.tsx:85) and the real scroller is the `<main
   class="… overflow-y-auto">` inside it (:127-130). The document there has
   nothing to scroll, so Lenis swallowed the wheel event and then animated a
   scroll of zero pixels — and because `preventDefault()` had already run,
   `<main>` never got the native scroll either. Wheel and trackpad were dead on
   the Brief and on every module page; keyboard, scrollbar drag and touch
   (`syncTouch: false`) still worked, which is exactly the shape of the report.

   W0 (commit 2d0c160) chased a different theory — html/body as a competing
   scroll container — and its `overflow-y: visible` override is still correct,
   so it stays. It just was not this.

   Two defences, deliberately both:

   - **Here**, the instance is not created under `/app/*` at all. The platform
     has no momentum-scroll design; it is a dense operations UI, and running a
     scroll library over it buys nothing to offset the risk.
   - **There**, `<main>` carries `data-lenis-prevent` (app/app/layout.tsx) so
     that even a Lenis that somehow is running — the tail of a marketing→
     platform client navigation before this effect tears down, a future mount
     from somewhere else — hands the wheel back to the native scroller.

   `isPlatform` is a BOOLEAN in the dep array rather than `pathname` itself:
   marketing→marketing navigation must not destroy and rebuild the instance
   (that would drop momentum mid-scroll on every internal link), so the effect
   may only re-run when the marketing/platform boundary is actually crossed. */
export function SmoothScroll() {
  const reduceMotion = useReducedMotion() ?? false;
  const pathname = usePathname();
  // Not a bare `startsWith("/app")` — that would also match a future marketing
  // route like `/apply` or `/appointments`. The platform is `/app` exactly, or
  // anything below it.
  const isPlatform = pathname === "/app" || pathname.startsWith("/app/");
  /* Same shape as `isPlatform`, and a boolean for the same reason: it is in the
     dep array, and navigating *within* the subsite must not tear the instance
     down mid-scroll. Only crossing the Finch↔Orbit boundary rebuilds it, which
     is a full-page change of ground anyway. */
  const isOrbit = pathname === "/orbit" || pathname.startsWith("/orbit/");

  useEffect(() => {
    const root = document.documentElement;

    if (reduceMotion || isPlatform) {
      delete root.dataset.lenis;
      delete root.dataset.lenisSnappy;
      delete root.dataset.lenisMode;
      return;
    }

    /* One effect owns the whole lifecycle — start, stop, restart — so nothing
       here needs React state and the component never re-renders. */
    let instance: { raf(time: number): void; destroy(): void } | null = null;
    let raf = 0;
    let cancelled = false;

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      instance?.destroy();
      instance = null;
      delete root.dataset.lenis;
      delete root.dataset.lenisSnappy;
      delete root.dataset.lenisMode;
    };

    const start = async () => {
      /* Set before the await, not after: pinned/scroll-linked sections read
         this to know which scroll they are being driven by, and a one-chunk-
         load window where the answer is wrong is a window where they compute
         the wrong offsets. */
      root.dataset.lenis = "on";
      root.dataset.lenisSnappy = "on";
      root.dataset.lenisMode = isOrbit ? "orbit" : "snappy";
      const { default: Lenis } = await import("lenis");
      if (cancelled || instance) return;
      instance = new Lenis(isOrbit ? ORBIT : SNAPPY);
      const loop = (time: number) => {
        instance?.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };

    const sync = () => {
      const enabled = readEnabled();
      if (enabled && !instance) void start();
      else if (!enabled && instance) stop();
      else if (!enabled) delete root.dataset.lenis;
    };

    sync();
    window.addEventListener(LENIS_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      cancelled = true;
      window.removeEventListener(LENIS_EVENT, sync);
      window.removeEventListener("storage", sync);
      stop();
    };
  }, [reduceMotion, isPlatform, isOrbit]);

  return null;
}

export default SmoothScroll;
