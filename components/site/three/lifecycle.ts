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

import { useEffect, useRef, useState } from "react";

export function useNearViewport<T extends HTMLElement>(margin = "600px") {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return undefined;
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

export function useWebGLAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(webglProbe);

  useEffect(() => {
    if (webglProbe !== null) {
      setAvailable(webglProbe);
      return;
    }
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
    setAvailable(webglProbe);
  }, []);

  return available;
}
