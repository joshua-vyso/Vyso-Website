"use client";

import { motion, type MotionValue } from "motion/react";

/* The demo pointer. It lives inside the unscaled 1440×1000 frame, so its
   coordinates are frame coordinates and it shrinks with the mock instead of
   drifting off the button when the container narrows. The arrow's tip — not
   its box — is the hotspot, hence the negative margins and the matching
   transform origin, so a press scales around the point that "clicks". */

const TIP_X = 4.6;
const TIP_Y = 1.8;

export function DemoCursor({
  x, y, opacity, scale,
}: {
  x:       MotionValue<number>;
  y:       MotionValue<number>;
  opacity: MotionValue<number>;
  scale:   MotionValue<number>;
}) {
  return (
    <motion.svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20"
      style={{
        x, y, opacity, scale,
        marginLeft: -TIP_X,
        marginTop:  -TIP_Y,
        transformOrigin: `${TIP_X}px ${TIP_Y}px`,
        filter: "drop-shadow(0 2px 4px rgba(20,24,20,0.28))",
      }}
    >
      <path
        d="M5 2 L5 18.6 L9.1 14.9 L11.7 20.5 L14.4 19.2 L11.8 13.8 L16.7 13.8 Z"
        fill="#14120E"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </motion.svg>
  );
}

export default DemoCursor;
