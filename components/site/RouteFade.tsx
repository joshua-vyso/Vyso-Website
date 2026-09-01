"use client";

import { useEffect, useRef } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";

/* ── Route transitions ───────────────────────────────────────────────────────
   §6: a 220ms crossfade of `.finch-site` on navigation, nav persists.

   **Why not the View Transitions API.** Next 16.2 ships `<ViewTransition>` but
   only behind `experimental.viewTransition` (`node_modules/next/dist/docs/
   01-app/02-guides/view-transitions.md`), and the plan's instruction was "use
   it if stable in 16.2, else the wrapper". It is not stable, and turning on an
   experimental flag globally to fade one route into another is a bad trade for
   a marketing site that has to survive a Next minor.

   **Why an imperative animation and not `<AnimatePresence>`.** Two reasons,
   both structural rather than stylistic:

   1. An `initial={{ opacity: 0 }}` on a wrapper around `{children}` serialises
      `opacity: 0` into the server HTML — the entire site would ship invisible
      and stay invisible for anyone whose JS fails. Every other reveal in this
      codebase refuses that trade (see `FindingDeck`, `Statement`); the one
      wrapping the whole document is not where to start making an exception.
   2. In the App Router the `children` prop swaps to the new page in the same
      commit the pathname changes, so an `AnimatePresence` exit animation plays
      *the new page* fading out before it fades in. The well-known fix is to
      freeze the router context, which means reaching into Next internals.

   So: the page ships at full opacity, and on each *subsequent* pathname change
   the wrapper is animated 0 → 1 over 220ms. First paint is untouched (no LCP
   cost, no flash), navigations get the fade, reduced motion gets neither.      */

/** Fired on `window` when a route transition has finished — after the 220ms
    fade, or immediately under reduced motion, where there is no fade to wait
    for. `NavGround` listens for it: the ground under the nav can only be
    measured once the incoming page has settled, and this is the one moment
    that is true for every navigation. A plain `Event` on `window` rather than a
    context or a store, because the listener is not a React subtree — it is one
    attribute write on `<html>`. */
export const ROUTE_FADE_END = "fn:route-fade-end";

export function RouteFade({ children }: { children: React.ReactNode }) {
  const [scope, animate] = useAnimate();
  const pathname = usePathname();
  const reduceMotion = useReducedMotion() ?? false;
  /* Skip the first run: on initial load there is nothing to transition *from*,
     and fading the first paint in is exactly the flash this design avoids. */
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const done = () => window.dispatchEvent(new Event(ROUTE_FADE_END));
    if (reduceMotion || !scope.current) {
      done();
      return;
    }
    /* `animate()` returns thenable playback controls. The rejection handler is
       not optional bookkeeping: a second navigation inside 220ms cancels this
       one, and an unhandled rejection in a layout-level effect would surface as
       a console error on every fast double-click through the nav. The cancelled
       transition needs no `done()` — the navigation that replaced it fires its
       own. */
    animate(scope.current, { opacity: [0, 1] }, { duration: 0.22, ease: "easeOut" }).then(
      done,
      () => {},
    );
  }, [pathname, animate, scope, reduceMotion]);

  /* A plain div, no transform and no `will-change`: the homepage's scroll
     sequence is `position: sticky` inside here, and a transformed ancestor
     would silently become its containing block. `data-route-fade` is the
     handle a verification script (or a future bug) needs to find this one div
     among the layout's siblings without guessing at DOM order. */
  return <div ref={scope} data-route-fade>{children}</div>;
}

export default RouteFade;
