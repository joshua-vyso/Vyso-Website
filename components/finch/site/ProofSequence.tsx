"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

import {
  FINDING_DEFAULTS,
  FindingActions,
  FindingCard,
  FindingCardFrame,
  FindingEvidence,
  FindingHeader,
  FindingImpact,
  FindingObservation,
} from "@/components/finch/FindingCard";
import { InvoiceCard } from "@/components/finch/InvoiceCard";
import { useMediaQuery } from "@/components/finch/ground/use-media-query";
import { useStaticMotion } from "@/components/finch/motion-preference";

/* ── One invoice, read overnight — as a sequence ─────────────────────────────
   Site repositioning Phase 3.5 (`.ai/plan_site_repositioning.md`, AMENDMENT 2,
   point 3: "the scroll-driven proof sequence rather than a static card").

   Phase 3 put the home page's proof section on the page as two stationary
   cards side by side with a label over each. That is the *end state* of the
   thing `/finch`'s `ScrollSequence` spends five beats arriving at, and showing
   only the end state is why the section reads as a screenshot rather than as a
   claim being demonstrated.

   So this is `ScrollSequence`'s idiom at a third of its length, told with the
   two objects the home page already had and no others: **the invoice arrives,
   Vyso reads it line by line, the decision assembles.** Two beats and a join,
   not five — the home page is a router, and a 480vh sequence is what `/finch`
   is for.

   ── What is deliberately the same as `ScrollSequence` ───────────────────────
   - `seg()` / `eo()`, the same clamp-and-ease-out pair, so the choreography
     sits in the same hand as the sequence on `/finch`.
   - `InvoiceCard`'s `highlights` prop takes MotionValues, so the four line
     sweeps are driven from scroll progress without re-rendering React.
   - The finding assembles out of `FindingCardFrame` + its five parts, exactly
     as beat 4 of `/finch` does, off `FINDING_DEFAULTS` — which *is*
     `butternut-price` (`lib/marketing/findings.ts`, `FLAGSHIP`), the finding
     the static version named. Same words, same order.

   ── What is deliberately different ──────────────────────────────────────────
   - **No captions strip and no phone.** The brief mock is the hero's job on
     this page and the brief's five-beat vocabulary belongs to `/finch`.
   - **A join between the columns.** A 2px `--fn-grad` rule that draws
     left-to-right between the two beats: it is the sentence the section's own
     heading makes, drawn once.

   ── The three renders ───────────────────────────────────────────────────────
   Server / pre-hydration and reduced motion get `Storyboard`, which is Phase
   3's exact markup — both labels, both cards, the illustrative-example line.
   Below `lg` the same storyboard, because a sticky stage on a phone is a
   scroll trap. Desktop with motion gets the sequence. `useIsDesktop` is a
   `useSyncExternalStore`, so there is no hydration mismatch to manage; see
   `motion-preference.tsx`.                                                     */

const LABEL_IN = "m-0 mb-[14px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-muted";
const CAPTION =
  "m-0 mt-[12px] text-right font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint";

/** clamp((t-a)/(b-a)) — how far through segment [a,b] progress t is. */
const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
/** ease-out cubic */
const eo = (p: number) => 1 - Math.pow(1 - p, 3);

/* ── The static form ─────────────────────────────────────────────────────── */

function Storyboard() {
  return (
    <div className="grid grid-cols-1 items-start gap-[28px] lg:grid-cols-2 lg:gap-[48px]">
      <div>
        <p className={LABEL_IN}>What arrives</p>
        <InvoiceCard />
      </div>
      <div>
        <p className={LABEL_IN}>What comes back</p>
        {/* `tilt` off: the pointer tilt is the one bit of motion this page does
            not need. `interactive` stays on, and deliberately: the
            non-interactive branch of `FindingActions` renders its three labels
            in a single non-wrapping row, which overflows a 375px card. */}
        <FindingCard finding="butternut-price" tilt={false} />
        <p className={CAPTION}>Illustrative example</p>
      </div>
    </div>
  );
}

/* ── The scroll-linked form ──────────────────────────────────────────────── */

function Sequence() {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress: t } = useScroll({
    target: wrap,
    offset: ["start start", "end end"],
  });

  /* Beat 1 — the invoice. **It does not fade in**, and that is the fix for the
     hole the first cut of this had: `offset: ["start start", …]` means progress
     is pinned at 0 for the whole approach, while the heading is still on
     screen and the stage is already laid out under it. A beat-1 that begins at
     `opacity: 0` therefore shows the reader an empty half-screen for as long as
     it takes them to read the lead. The invoice is the *input*; it is simply
     there, and what the sequence animates is the reading of it.

     It recedes at the end instead: by the time the decision is assembled the
     document is no longer the thing being looked at. */
  const invoiceOpacity = useTransform(t, (v) => 1 - eo(seg(v, 0.72, 0.95)) * 0.42);
  const invoiceScale   = useTransform(t, (v) => 1 - eo(seg(v, 0.72, 0.95)) * 0.035);

  /* Vyso reading it, line by line. Same 0.04 stagger `ScrollSequence` uses. */
  const highlights = [
    useTransform(t, (v) => eo(seg(v, 0.06, 0.17))),
    useTransform(t, (v) => eo(seg(v, 0.10, 0.21))),
    useTransform(t, (v) => eo(seg(v, 0.14, 0.25))),
    useTransform(t, (v) => eo(seg(v, 0.18, 0.29))),
  ];

  /* The join: the one gradient mark in the section, drawn once. */
  const joinDraw = useTransform(t, (v) => eo(seg(v, 0.24, 0.38)));

  /* Beat 2 — the decision assembles. */
  const labelOutOpacity = useTransform(t, (v) => eo(seg(v, 0.30, 0.40)));
  const cardOpacity     = useTransform(t, (v) => eo(seg(v, 0.32, 0.41)));
  const cardY           = useTransform(t, (v) => (1 - eo(seg(v, 0.32, 0.41))) * 26);

  const pieces = [
    useTransform(t, (v) => eo(seg(v, 0.34, 0.43))),
    useTransform(t, (v) => eo(seg(v, 0.40, 0.50))),
    useTransform(t, (v) => eo(seg(v, 0.47, 0.57))),
    useTransform(t, (v) => eo(seg(v, 0.54, 0.64))),
    useTransform(t, (v) => eo(seg(v, 0.61, 0.71))),
  ];
  const piece0Y = useTransform(pieces[0], (p) => (1 - p) * 16);
  const piece1Y = useTransform(pieces[1], (p) => (1 - p) * 16);
  /* The rand impact stamps in rather than sliding — it is the point of the
     card, and the one number the section exists to produce. */
  const piece2Scale = useTransform(pieces[2], (p) => 1.24 - p * 0.24);
  const piece3Y = useTransform(pieces[3], (p) => (1 - p) * 16);
  const piece4Y = useTransform(pieces[4], (p) => (1 - p) * 16);

  const captionOpacity = useTransform(t, (v) => eo(seg(v, 0.72, 0.84)));

  return (
    /* 260vh of track for two beats — the same ~110vh a beat `ScrollSequence`
       spends on five over 480, so a reader moving between the two sections
       never has to change gear. */
    <div ref={wrap} className="relative h-[260vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="grid w-full grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-0">
          <motion.div style={{ opacity: invoiceOpacity, scale: invoiceScale }}>
            <p className={LABEL_IN}>What arrives</p>
            <InvoiceCard highlights={highlights} />
          </motion.div>

          {/* The join. `aria-hidden`: it is the heading's sentence drawn, and
              the heading is already on the page. */}
          <div aria-hidden className="flex items-center justify-center">
            <motion.span
              className="block h-[2px] w-full origin-left rounded-[2px]"
              style={{ background: "var(--fn-grad)", scaleX: joinDraw }}
            />
          </div>

          <motion.div style={{ opacity: cardOpacity, y: cardY }}>
            <motion.p className={LABEL_IN} style={{ opacity: labelOutOpacity }}>
              What comes back
            </motion.p>
            <FindingCardFrame className="w-full max-w-none shadow-[var(--fn-shadow-float)]">
              <motion.div style={{ opacity: pieces[0], y: piece0Y }}>
                <FindingHeader />
              </motion.div>
              <motion.div style={{ opacity: pieces[1], y: piece1Y }}>
                <FindingObservation>{FINDING_DEFAULTS.observation}</FindingObservation>
              </motion.div>
              <motion.div style={{ opacity: pieces[2], scale: piece2Scale, transformOrigin: "left center" }}>
                <FindingImpact>{FINDING_DEFAULTS.impact}</FindingImpact>
              </motion.div>
              <motion.div style={{ opacity: pieces[3], y: piece3Y }}>
                <FindingEvidence meta={FINDING_DEFAULTS.meta} className="mb-[14px]" />
              </motion.div>
              <motion.div style={{ opacity: pieces[4], y: piece4Y }}>
                <FindingActions interactive={false} />
              </motion.div>
            </FindingCardFrame>
            <motion.p className={CAPTION} style={{ opacity: captionOpacity }}>
              Illustrative example
            </motion.p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/** `false` on the server, so the response carries the storyboard — the variant
    that is correct at every width and needs no measurement, exactly as
    `ScrollSequence` resolves the same question. */
export function ProofSequence() {
  const still = useStaticMotion();
  const desktop = useMediaQuery("(min-width: 1024px)", false);

  if (still || !desktop) return <Storyboard />;
  return <Sequence />;
}

export default ProofSequence;
