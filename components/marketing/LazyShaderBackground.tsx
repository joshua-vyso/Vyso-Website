"use client";

import dynamic from "next/dynamic";

// The WebGL background pulls in three.js (~500KB chunk) and only runs in the
// browser, so it's lazy-loaded (ssr:false) — exactly the pattern app/page.tsx
// uses inline. `ssr: false` is not allowed inside a Server Component, so the
// dynamic() call lives here in a "use client" module that the (server-rendered)
// marketing pages can import without pulling three.js into their first load JS.
const WebGLShaderBackground = dynamic(
  () => import("@/components/WebGLShaderBackground").then((m) => m.WebGLShaderBackground),
  { ssr: false },
);

export function LazyShaderBackground({ global }: { global?: boolean }) {
  return <WebGLShaderBackground global={global} />;
}
