"use client";

import dynamic from "next/dynamic";

import { Deferred } from "./Deferred";
import type { WaveFieldProps } from "./impl/WaveFieldCanvas";
import { useWaveClock, WaveClockProvider } from "./wave-clock";

const WaveFieldCanvas = dynamic(() => import("./impl/WaveFieldCanvas"), { ssr: false });

/* §3.2's public face. Same split as `OscillatingGrid`, plus one wrinkle: the
   field wants to share its clock with the `WaveText` riding it (§4.1), and the
   text is a *sibling* in the band, not a child of the canvas. So the clock has
   to come from a provider above both.

   A band that wants wave-riding type wraps itself in `WaveClockProvider` and
   uses `WaveField` inside it. A band that just wants the field (or the footer's
   static frame) uses `WaveField` alone, and it provides its own clock so it
   still works — the `if` below reads a context, not a condition on props, so
   the hook order is identical either way. */
export function WaveField(props: WaveFieldProps) {
  const clock = useWaveClock();

  const field = (
    <Deferred>
      <WaveFieldCanvas {...props} />
    </Deferred>
  );

  if (clock || props.static) return field;
  return <WaveClockProvider amplitude={props.amplitude}>{field}</WaveClockProvider>;
}

export type { WaveFieldProps };
export { WaveClockProvider, useWaveClock } from "./wave-clock";
export default WaveField;
