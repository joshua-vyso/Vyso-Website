"use client";

import { useCallback, useSyncExternalStore } from "react";

/* `useSyncExternalStore` rather than the usual `useState` + `useEffect` pair:
   a media query is by definition an external mutable source, and reading it
   into state inside an effect is exactly the pattern `react-hooks/set-state-in-
   effect` rejects. It also gets the SSR story right for free — the server
   snapshot is a fixed value, and React re-renders once on the client with the
   real one instead of throwing a hydration mismatch. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Desktop-and-up, matching the Finch surface's `lg` breakpoint. */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)", true);

/** True on touch devices, where "hover" effects can never be seen and
    pointer-driven motion (magnetic buttons, cursor attraction) is dead weight. */
export const useCoarsePointer = () => useMediaQuery("(pointer: coarse)", false);
