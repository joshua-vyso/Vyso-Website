import { FindingCard } from "../FindingCard";
import { FinchBirdMark } from "../FinchBirdMark";
import { Band } from "../ground/Band";
import { FacetPlane } from "../ground/FacetPlane";
import { STRAIGHT_ANSWERS } from "./pricing-data";

/* ── Straight answers, on blue ───────────────────────────────────────────────
   The page's evidence band (§2: blue is where evidence lives) and its only
   `FacetPlane` — deep blue given geometric structure rather than a flat wash,
   the one thing §1.2 says makes a dominant blue section read as premium rather
   than as a gradient hero from 2014.

   Two composition decisions:

   1. **A bird before every answer.** Each `<dd>` is preceded by a small flat
      Finch mark in `--fn-blue-text-2`. It is the cheapest possible way to say
      "this is Finch answering", and on a page whose whole argument is "one
      offer, no matrix", four short answers in the product's own voice is the
      argument. Flat, masked from the real logo (`FinchBirdMark`) — the gradient
      bird's blue half is invisible on `#1F5FA8`.
   2. **One `wide` card, straddling the bottom seam.** §5 allows exactly one
      card in this band and §7 names it: Margin Watch's 31.4 → 29.3% slip. It
      sits at the band's right edge with a negative bottom margin, so it crosses
      into the paper band below — the plate-across-the-join move from §2, and
      the reason the reader's eye leaves this band downward rather than
      stopping at a hard cut. It is `wide` (it carries its sparkline) but toned
      `ink`, because a paper-white card on blue is a hole and a blue-on-blue
      card is invisible.

      **The straddle only works if the receiving band reserves the overhang.**
      6b shipped it with a 190px negative margin over a band whose own top
      padding was 56px, so the card's bottom edge landed 14px inside the Academy
      section and read as cut off. The overhang is now a named constant, the
      card is right-aligned to the same 1160 rail as everything else on the page
      (it used to run 150px past the accordion's right edge, which is what made
      it read as falling off the band), and `/pricing` adds `OVERHANG` to the
      Academy section's top padding. One number, exported, used twice.

   The dl/dt/dd structure and every string are unchanged: the same four answers
   are the FAQPage entities in this page's JSON-LD, so page and schema still
   match exactly. Only the ground and the marks are new.

   Nothing in this band loops except the facets. The card's micro-visual draws
   once on enter and stops, which §3 does not count — so the band reads 1.      */

/** How far the margin card hangs past the band's bottom edge at `lg`. The page
    adds this to the next section's top padding; below `lg` the card sits inside
    the band and the overhang is 0. */
export const STRAIGHT_ANSWERS_OVERHANG = 72;

export function StraightAnswers() {
  return (
    <Band ground="blue" intrinsicHeight={620} device={<FacetPlane seed={53} />}>
      {/* The same eyebrow/H2 lockup every other section band on the site opens
          with — mono 10/11px at .14em, then the serif H2 at 28/38. The blue
          band used to open on a bare 26px H2, which is why `/pricing` read as
          three pages stapled together. */}
      <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-blue-mono lg:text-[11px]">
        BEFORE YOU ASK
      </div>
      <h2 className="m-0 mb-[24px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-fn-blue-text lg:mb-[36px] lg:text-[38px]">
        Straight answers
      </h2>

      <dl className="m-0 grid max-w-[860px] grid-cols-1 gap-[26px] md:grid-cols-2 md:gap-x-[48px] md:gap-y-[30px]">
        {STRAIGHT_ANSWERS.map(({ question, answer }) => (
          <div key={question}>
            <dt className="mb-[7px] font-fn-serif text-[17px] font-medium text-fn-blue-text">
              {question}
            </dt>
            <dd className="m-0 flex gap-[10px] text-[15px] leading-[1.6] text-fn-blue-text-2 text-pretty">
              <FinchBirdMark
                color="var(--fn-blue-text-2)"
                size={20}
                /* 20px, not 16: the mark is a stroked line drawing, and below
                   about 18px the strokes fuse and it reads as a scribble rather
                   than as a bird. Nudged down to sit on the first line's cap
                   height rather than its box top. */
                className="mt-[2px]"
              />
              <span>{answer}</span>
            </dd>
          </div>
        ))}
      </dl>

      {/* The seam plate. The negative margin is the band's own bottom padding
          (104) plus `STRAIGHT_ANSWERS_OVERHANG` (72), so the card clears the
          band by exactly the number the page reserves below — written as one
          arbitrary value because Tailwind needs a literal, and asserted against
          the constant in the comment rather than computed, which JIT cannot do.
          `z-10` keeps it above the band below, which is a later sibling and
          would otherwise paint over it. */}
      <div className="relative z-10 mt-[44px] flex justify-end lg:-mb-[176px] lg:mt-[56px]">
        <FindingCard finding="margin-slip" variant="wide" tone="ink" className="w-full max-w-[560px]" />
      </div>
    </Band>
  );
}

export default StraightAnswers;
