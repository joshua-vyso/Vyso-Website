"use client";

import { motion } from "motion/react";

import { useStaticMotion } from "@/components/finch/motion-preference";

import {
  FindingActions,
  FindingCardFrame,
  FindingEvidence,
  FindingHeader,
  FindingImpact,
  FindingObservation,
} from "@/components/finch/FindingCard";
import type { ExampleFinding } from "@/lib/marketing/industries";

/* ── The finding deck ────────────────────────────────────────────────────────
   The signature visual of `/industries/*`, and the only place on the site three
   finding cards appear together. It exists because a vertical page's argument
   is not "here is a finding" (the homepage already made that point) but "these
   are the findings *your* business gets" — and three of them said in your own
   vocabulary is the argument.

   The move: the three cards enter fanned (rotate −4° / 0 / +4°, spread on x),
   then straighten and settle into a cascade over 600ms, once. Hovering one
   raises it above the other two. That is §1 motion principle 1 (reveal on
   enter, once) given a shape, not a new kind of animation.

   Composed from `FindingCard`'s pieces rather than the whole card so the
   actions can be `interactive={false}`: three stacked cards' worth of
   hover-styled buttons would read as a live inbox, and these are worked
   examples. The caption under the deck says so.

   Layout:
   - `lg` and up: absolutely positioned cascade, 96px apart vertically and 18px
     horizontally. The container carries an explicit height so nothing below it
     moves when the cards animate (§7.1: CLS < 0.05).
   - below `lg`: normal flow, one card under the next — an overlapping deck is
     unreadable at 375px. `overflow-x-clip` there because the fan's rotation
     briefly puts a corner past the card's own box, and at phone width the card
     already fills the column; clipping 8px of shadow for 600ms is better than a
     horizontal scrollbar. `clip` rather than `hidden` so the page keeps its own
     scrolling behaviour.

   SSR: `motion` serialises `initial` into the server HTML, so the deck arrives
   fanned and complete — real text in real cards at their real positions, not
   empty boxes waiting on hydration. That is why the enter animation moves
   transforms only and never opacity. Under reduced motion the same props run at
   zero duration, so the deck lands settled in the first frame (see `DeckCard`
   for why that replaced the old `initial={false}` branch).                     */

/** Per-card fan: rotation, and how far apart the cards start. Index-aligned. */
const FAN = [
  { rotate: -4, x: -14, y: 10 },
  { rotate: 0, x: 0, y: 0 },
  { rotate: 4, x: 14, y: 10 },
] as const;

/** The settled cascade at `lg`: how far each card sits below and right of the
    first. 116px is measured, not chosen — 22px of card padding, a 31px agent
    header and two 24.6px lines of observation — so the cards underneath show a
    whole sentence rather than a clipped one. Showing three findings is the
    point of the deck; showing two and a half is a bug that looks like a bug. */
const CASCADE = ["lg:top-0 lg:left-0", "lg:top-[116px] lg:left-[18px]", "lg:top-[232px] lg:left-[36px]"];

/** Later cards sit above earlier ones so the cascade reads top-down; hover
    lifts whichever card the pointer is on above all of them. */
const LAYER = ["lg:z-0", "lg:z-10", "lg:z-20"];

function DeckCard({
  finding,
  index,
  reduceMotion,
}: {
  finding: ExampleFinding;
  index: number;
  reduceMotion: boolean;
}) {
  const fan = FAN[index] ?? FAN[1];

  /* Transform only — deliberately no opacity. An opacity-0 initial state
     serialises into the server HTML, which would ship three invisible cards
     until hydration; `AgentsOnShift` refused the same trade for the same
     reason. Fanned-and-readable is a real static form.

     Reduced motion changes the *duration*, not the shape of these props (6a).
     It used to swap the whole set for `initial={false}`, which meant the server
     serialised the fan transform and a reduced-motion client rendered no
     transform at all — a hydration mismatch React reports in the console, and
     one that would have stranded two of the three cards mid-fan. Zero duration
     lands on the same settled deck, in the first frame, with one tree. */
  const motionProps = {
    initial: { rotate: fan.rotate, x: fan.x, y: fan.y },
    whileInView: { rotate: 0, x: 0, y: 0 },
    viewport: { once: true, amount: 0.3 },
    /* 600ms ease-out, per the plan. The stagger is the §1 default (60ms) so the
       three don't straighten in the same frame. */
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: index * 0.06 },
  };

  return (
    <motion.div
      {...motionProps}
      className={`group relative w-full origin-center will-change-transform lg:absolute lg:w-[440px] lg:hover:z-30 ${CASCADE[index]} ${LAYER[index]}`}
    >
      {/* The hover lift is CSS on a *child*, not `whileHover` on the motion
          element: once the enter animation finishes, `motion` leaves
          `style="transform: none"` inline, and an inline transform beats any
          utility class on the same element. The z-index half is CSS too
          (`lg:hover:z-30` above), so "hover brings one forward" works whether
          or not the gesture layer has hydrated. `motion-safe` keeps the deck
          genuinely static under reduced motion. */}
      <div className="transition-transform duration-200 ease-out motion-safe:lg:group-hover:-translate-y-[6px]">
        <FindingCardFrame tilt={false} state="new" className="w-full">
          <FindingHeader agent={finding.agent} state="new" />
          <FindingObservation>{finding.observation}</FindingObservation>
          <FindingImpact>{finding.impact}</FindingImpact>
          <FindingEvidence evidence={finding.evidence} meta={finding.meta} />
          <FindingActions actions={[...finding.actions]} interactive={false} />
        </FindingCardFrame>
      </div>
    </motion.div>
  );
}

export function FindingDeck({ findings }: { findings: readonly ExampleFinding[] }) {
  const reduceMotion = useStaticMotion();

  return (
    <div>
      {/* Explicit height because the cards are absolutely positioned: 232px of
          cascade plus the tallest third card across the eight verticals. */}
      <div className="relative flex flex-col gap-[16px] max-lg:overflow-x-clip lg:block lg:h-[516px] lg:w-[476px]">
        {findings.slice(0, 3).map((finding, index) => (
          <DeckCard
            key={finding.agent + finding.meta}
            finding={finding}
            index={index}
            reduceMotion={reduceMotion}
          />
        ))}
      </div>
      <div className="mt-[16px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint lg:w-[476px] lg:text-right">
        ILLUSTRATIVE EXAMPLES
      </div>
    </div>
  );
}

export default FindingDeck;
