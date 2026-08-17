"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

/* One hop on mount, then it rests — the 404's whole personality budget.
   The image renders identically under reduced motion; only the y keyframes go. */
export function BirdHop({ size = 44, className = "" }: { size?: number; className?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={false}
      animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
      transition={{ duration: 0.3, ease: "easeOut", times: [0, 0.5, 1] }}
    >
      <Image
        src="/finch/finch-bird.svg"
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    </motion.div>
  );
}

export default BirdHop;
