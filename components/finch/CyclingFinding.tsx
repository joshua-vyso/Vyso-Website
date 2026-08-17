"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";

import { FindingCard, type FindingVariant } from "./FindingCard";
import { getFinding, type FindingId } from "@/lib/marketing/findings";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── The cycling hero card ───────────────────────────────────────────────────
   §5's variety rule: heroes cycle three findings — crossfade plus a 6px lift
   every 6s, paused on hover, and under reduced motion the first one only.

   The reason it exists is an honesty problem, not a motion one. The butternut
   card was on every hero on the site, which quietly said "this is the finding
   Finch produces". Three cards saying three different things in three different
   agents' voices says the true thing instead: the roster is set per business.

   **The first card is server-rendered.** `index` starts at 0 and only ever
   advances in a timer, so the server HTML carries a real, complete finding
   card. If JS never arrives, the hero is still the hero.

   `AnimatePresence` with `mode="popLayout"` rather than a stack of absolutely
   positioned cards: the three findings are different lengths, and a fixed
   height sized to the tallest would leave the short ones floating in a box.   */

export type CyclingFindingProps = {
  /** Three ids, in the order they should appear. More than three is allowed;
      §5 says three because that is what a 6s cycle can show before a reader
      scrolls past. */
  ids: readonly FindingId[];
  variant?: FindingVariant;
  intervalMs?: number;
  className?: string;
  cardClassName?: string;
};

export function CyclingFinding({
  ids,
  variant = "standard",
  intervalMs = 6000,
  className = "",
  cardClassName,
}: CyclingFindingProps) {
  const reduceMotion = useStaticMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  /* A hero that has scrolled away should not keep cycling — nobody is reading
     it, and every tick is a re-render plus an enter animation. */
  const onScreen = useInView(ref, { margin: "0px" });

  const cycling = !reduceMotion && ids.length > 1 && !paused && onScreen;

  useEffect(() => {
    if (!cycling) return;
    /* `setInterval`, not a chain of timeouts: the cadence is fixed and a
       dropped frame should not push the next card later. The `setState` is in
       the *timer*, not in the effect body, so nothing here is the
       render-phase-state pattern `react-hooks/set-state-in-effect` rejects. */
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % ids.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [cycling, ids.length, intervalMs]);

  const id = ids[index] ?? ids[0];
  const finding = getFinding(id);

  return (
    <div
      ref={ref}
      className={className}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      /* Keyboard users get the same pause: the card's actions are focusable,
         and a card that swapped out from under a focused control would move
         focus to nothing. */
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={id}
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <FindingCard finding={finding} variant={variant} className={cardClassName} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default CyclingFinding;
