"use client";

import { createContext, useContext } from "react";

import { useMediaQuery } from "@/components/site/use-media-query";

/* ── "Should this be static?" — one answer, one place ────────────────────────
   Every primitive in phases 6a+ asks this question, and the honest answer has
   two sources:

   1. The OS setting, via `motion`'s `useReducedMotion()`.
   2. The `/design` emulation toggle, so the reduced-motion form can be reviewed
      on a machine whose OS setting is off.

   `<MotionConfig reducedMotion="always">` does **not** cover (2), which is worth
   writing down because it is the obvious-looking wrong answer: `MotionConfig`
   changes how `motion` components animate, but `useReducedMotion()` reads the
   media query directly and ignores it. Measured on `/design` — with only
   `MotionConfig` in place, flipping the toggle left every canvas running.

   So the toggle needs a channel of its own, and every primitive reads this hook
   instead of `useReducedMotion()`. `MotionConfig` is still used alongside it on
   `/design`, for the `motion`-driven reveals inside the finding cards.

   Not applied to the two global mounts (`RouteFade`, `SmoothScroll`): they live
   above every provider in `app/layout.tsx` and have no reason to follow a
   review page's toggle.

   ── Why not `motion`'s `useReducedMotion()` ─────────────────────────────────
   Besides missing the toggle, it reads the media query synchronously on the
   client's *first* render, which is the hydration render. The server has no
   media query and always renders the full-motion branch, so any component that
   branches on it hands React two different trees and throws
   "Hydration failed because the server rendered HTML didn't match the client."
   Measured: emulating `prefers-reduced-motion: reduce` on `/design` threw
   exactly that, listing every `Statement` word and the facet plane.

   `useMediaQuery` is a `useSyncExternalStore`, which is the API built for this:
   hydration uses the server snapshot (`false`), React commits a matching tree,
   and *then* re-renders with the real value. No mismatch, and reduced motion
   still applies a frame later.

   The other half of the contract is on the components: a reduced-motion branch
   must be a **different value**, not a different element or a missing `style`.
   A branch that drops `style={{ y }}` leaves whatever transform the server
   serialised stuck on the element forever; a branch that zeroes the range
   cannot. See `Parallax`, `FacetPlane` and `Statement`.                        */

const ForceStaticContext = createContext(false);

export function MotionPreferenceProvider({
  forceStatic,
  children,
}: {
  forceStatic: boolean;
  children: React.ReactNode;
}) {
  return <ForceStaticContext.Provider value={forceStatic}>{children}</ForceStaticContext.Provider>;
}

/** True when motion should be replaced by its static form. Outside a provider
    this is exactly the OS setting, which is every real page. Always `false` on
    the server and on the hydration render — see the header. */
export function useStaticMotion(): boolean {
  const forced = useContext(ForceStaticContext);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)", false);
  return forced || reduced;
}
