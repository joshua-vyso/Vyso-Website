"use client";

/* ── Shared lifecycle for the ThreeUI effect layers ──────────────────────────
   The registered ThreeUI components (`src/shaders/**`, hash-verified — see
   `.ai/threeui_source_record.md`) render their effects into sandboxed srcDoc
   iframes. The site never edits those files; everything performance- and
   accessibility-shaped happens out here:

   - `useNearViewport` mounts an effect only when its stage approaches the
     viewport and unmounts it again once it is far offscreen, so a page never
     pays for a renderer it isn't showing. (Sandboxed srcDoc iframes are
     cross-origin, so browsers additionally render-throttle them offscreen —
     the unmount is the belt to that brace, and it guarantees teardown.)
   - `useWebGLAvailable` probes once for a usable WebGL context so WebGL
     effects can fall back to a static layer instead of a black box.
   - Reduced motion is handled by callers via `useStaticMotion()` (the site's
     hydration-safe media-query hook): a static fallback is rendered and the
     iframe never mounts. */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export function useNearViewport<T extends HTMLElement>(margin = "600px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      /* No IO (very old browsers): mount on the next frame instead. */
      const frame = requestAnimationFrame(() => setNear(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry?.isIntersecting ?? false),
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [margin]);

  return { ref, near };
}

let webglProbe: boolean | null = null;

function probeWebGL(): boolean {
  if (webglProbe !== null) return webglProbe;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ?? canvas.getContext("experimental-webgl");
    webglProbe = Boolean(gl);
    if (gl && "getExtension" in gl) {
      (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}

const noSubscription = () => () => {};

/** WebGL availability never changes within a session, so it reads as an
    external store: probed once, `null` on the server/hydration snapshot so the
    server and first client render agree. */
export function useWebGLAvailable(): boolean | null {
  return useSyncExternalStore(noSubscription, probeWebGL, () => null);
}

/* Post-idle gate for hero-adjacent effects: the static ground paints with the
   first frame, and the sandboxed renderer (whose srcDoc pulls its own script
   dependencies) only mounts once the main thread has gone quiet — so the
   effect never competes with LCP or hydration on a slow connection. */
export function useAfterIdle(maxWaitMs = 1600): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const arm = () => {
      if (!cancelled) setIdle(true);
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(arm, { timeout: maxWaitMs });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(handle);
      };
    }
    const timer = window.setTimeout(arm, maxWaitMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [maxWaitMs]);

  return idle;
}
