"use client";

import dynamic from "next/dynamic";

import { Deferred } from "./Deferred";
import type { OscillatingGridProps } from "./impl/OscillatingGridCanvas";

/* The public face of §3.1. Two jobs, both of them boring on purpose:
   code-split the canvas out of the page bundle, and hold the IO gate that
   decides when it mounts. Everything visual is in `impl/`.

   `ssr: false` because a canvas renders nothing on the server anyway — the
   server would ship an empty `<canvas>` and the reserved height, which is what
   `Band` already guarantees. */
const OscillatingGridCanvas = dynamic(() => import("./impl/OscillatingGridCanvas"), {
  ssr: false,
});

export function OscillatingGrid(props: OscillatingGridProps) {
  return (
    <Deferred>
      <OscillatingGridCanvas {...props} />
    </Deferred>
  );
}

export type { OscillatingGridProps };
export default OscillatingGrid;
