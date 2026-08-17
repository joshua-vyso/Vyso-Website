"use client";

import { useRef } from "react";
import { motion } from "motion/react";

import { Band } from "../ground/Band";
import { OscillatingGrid } from "../ground/OscillatingGrid";
import { useStaticMotion } from "../motion-preference";
import { SplitReveal } from "../text/Statement";
import { DIRECT_ANSWER, FOUNDING_TERMS } from "./pricing-data";

/* ── The price, on ink ───────────────────────────────────────────────────────
   §7 gives `/pricing` the site's other ink hero, and the reason is editorial
   rather than decorative: this page has exactly one thing to say, and a number
   at 96px on near-black says it before a word is read. The homepage hero is
   warm-white with a card; this one is dark with a figure. No two adjacent nav
   pages share a hero device, and these two now share neither ground nor device.

   The band's one device is an `OscillatingGrid` in orange dots with **cursor
   attraction on and the price block as its mask**. Both halves matter:

   - The mask (§3.1 / §4.3) dims cells within 80px of the `<h1>`'s box by 40%,
     so the field visibly makes room for the number. Without it a crest rolling
     under 96px type is the one place this design could actually hurt legibility.
   - The attraction (spring 0.08 toward the pointer) is what makes the page feel
     like a surface rather than a poster. It is on here and nowhere else on this
     page, because the CTA band's grid is in the bolder `squares` mode and a
     bold field that also chases the cursor is two effects arguing.

   Two text motions, in sequence, and they are §6's "stat stamps" and §4.4's
   split-word reveal doing different jobs: the unit words rise 10px on a 30ms
   stagger, and then the figure **stamps** — scale 1.3 → 1, never a count-up.
   §6 is explicit that rand figures do not count up outside a calculator; a
   number that spins is a number a reader watches instead of reads.

   A client component now, where it used to be pure server: the mask needs a
   ref to the price block, and a ref needs the client. Everything the page
   *says* is still in the server HTML — the h1, the price, the direct answer and
   the terms are all real text in the response, and nothing here is gated on
   hydration.                                                                  */

const EASE = [0.22, 1, 0.36, 1] as const;

export function PricingHero() {
  const priceRef = useRef<HTMLHeadingElement | null>(null);
  const reduceMotion = useStaticMotion();

  return (
    <>
      <Band
        ground="ink"
        as="header"
        /* The ink runs to the top edge of the window, behind the nav, which is
           what lets `NavGround` invert it (§7 wants an inverted nav here). */
        underNav
        /* `down`: the dark slab is on top here, so §2's seam is mirrored — a
           24px *bottom* radius and a 48px overlap into the paper band below,
           with the founding-terms strip straddling the join. */
        overlap="down"
        /* Content-driven, and the content here starts with the nav's own height
           inside it (`underNav`). The ink preset's 112px on top of that opened
           the page on ~200px of nothing above an 11px eyebrow; 78 puts the price
           block ~120px below the nav, which is where §7 wants it. The bottom is
           the preset's, less the 48px the downward overlap gives back to the
           founding-terms plate. */
        paddingClassName="pt-[44px] pb-[72px] lg:pt-[78px] lg:pb-[104px]"
        intrinsicHeight={620}
        contentClassName="text-center"
        device={
          <OscillatingGrid
            mode="dots"
            color="--fn-orange"
            cursor
            maskRef={priceRef}
            opacity={0.3}
          />
        }
      >
        <div className="mx-auto max-w-[820px]">
          <div className="mb-[22px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-ink-mono lg:mb-[28px] lg:text-[11px]">
            ONE OFFER · NO TIERS · NO MATRIX
          </div>

          <h1
            ref={priceRef}
            className="m-0 mb-[16px] font-fn-serif text-[62px] font-medium leading-[1.0] tracking-[-0.03em] text-fn-ink-text lg:mb-[20px] lg:text-[96px]"
          >
            {/* `display: inline-block` so the scale has a box to act on; the
                transform never changes layout, so the stamp costs no CLS. */}
            <motion.span
              className="inline-block"
              initial={{ scale: 1.3 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : /* After the split reveal below, not with it: the words
                       settle, then the figure lands. */
                    { duration: 0.5, delay: 0.3, ease: EASE }
              }
            >
              R6,000
            </motion.span>
            {/* `inline-block` so the unit gets its own inline formatting
                context. Without it, `SplitReveal`'s per-word wrappers are
                `align-bottom` inside the *h1's* 96px line box, which drops a
                30px unit well below the figure's baseline — the two read as two
                lines rather than one price. */}
            {/* The space lives outside the `inline-block`: leading whitespace
                inside one is collapsed away, and the price would read
                "R6,000/ location". */}
            {" "}
            <span className="inline-block align-baseline text-[20px] font-normal tracking-normal text-fn-ink-text-2 lg:text-[30px]">
              <SplitReveal text="/ location / month" />
            </span>
          </h1>

          <p className="m-0 mb-[18px] font-fn-serif text-[21px] italic text-fn-ink-text lg:mb-[20px] lg:text-[26px]">
            Everything included.
          </p>

          <p className="mx-auto m-0 max-w-[560px] text-[15px] leading-[1.6] text-fn-ink-text-2 text-pretty lg:text-[16px]">
            {DIRECT_ANSWER}
          </p>
        </div>
      </Band>

      {/* ── The seam element ────────────────────────────────────────────────
          §2's "a card/plate straddles the seam", and the founding terms are the
          right thing to put there: they are the page's second offer, they read
          on either ground, and a white plate crossing from ink into paper is
          what makes the two bands one page instead of two.

          `-mt-[8px]` on top of the band's own `-mb-[48px]` puts the strip's top
          56px above the ink edge; the strip is ~112px tall at desktop, so it
          sits half on ink and half on paper. `z-20` because the band that
          overlaps carries `z-10` — without it the plate would slide under the
          slab it is meant to cross.                                          */}
      <div className="relative z-20 -mt-[8px] mx-auto max-w-[1160px] px-[20px] lg:px-[40px]">
        <div className="flex flex-col divide-y divide-fn-line-2 rounded-[12px] border border-fn-line bg-fn-surface shadow-[var(--fn-shadow-float)] lg:flex-row lg:divide-x lg:divide-y-0">
          {FOUNDING_TERMS.map((term) => (
            <div key={term} className="flex-1 px-[24px] py-[20px] text-center lg:py-[26px]">
              <div className="mb-[8px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-orange-deep">
                FOUNDING TERMS
              </div>
              <div className="text-[15px] text-fn-ink-2">{term}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default PricingHero;
