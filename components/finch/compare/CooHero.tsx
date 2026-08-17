import { Band } from "@/components/finch/ground/Band";
import { SeamHairline } from "@/components/finch/ground/SeamHairline";
import { WaveClockProvider } from "@/components/finch/ground/wave-clock";
import { WaveField } from "@/components/finch/ground/WaveField";
import { MagneticButton } from "@/components/finch/text/MagneticButton";
/* From the plain module, not from `Statement.tsx`: this is a server
   component, and every export of a `"use client"` module reaches one as an
   opaque client reference. See `text/statement-class.ts`. */
import { STATEMENT_CLASS } from "@/components/finch/text/statement-class";
import { WaveText } from "@/components/finch/text/WaveText";
import type { Crumb } from "@/lib/marketing/compare";

import { Breadcrumb } from "./CompareBits";

/* ── The COO comparison's hero ───────────────────────────────────────────────
   `.ai/vyso_v3_design.md` §7 gives this page an **ink hero** with a `WaveField`
   in orange and the Statement "A COO's day. Done by breakfast." riding it — the
   one hero on the site whose type moves with what is behind it, and the reason
   the page reads as nothing else in the cluster. It is deliberately not
   `CompareHero`: that component is the paper split hero the hub and the two
   ported comparisons share, and giving it an ink mode would have put a branch
   in three pages' hero to serve one.

   ── Two decisions worth stating ─────────────────────────────────────────────

   1. **The `<h1>` carries both lines.** The plan's Statement is the display
      line, but this page exists to answer the query "finch vs hiring a COO",
      and an `<h1>` that no longer contains that phrase is an SEO regression
      dressed as a design decision. So the heading is one element with two
      decks: `COO.h1` at kicker scale, the Statement under it at Statement
      scale. One `<h1>`, both strings, and the accessible name reads as the
      sentence it is.
   2. **The band is pulled up under the nav.** §8's inversion only means
      anything if the nav is actually *over* a dark band, and `FinchNav` is
      static markup above `<main>`, so an ink band that starts below it never
      inverts anything visible. That is `Band`'s `underNav`, which now carries
      the nav's **measured** 76/92 (it used to carry 64/80, which left an 11px
      strip of paper above `/pricing`'s hero) and pads the content back down by
      the same amount. This file used to do both halves by hand; it no longer
      needs to. The page wraps the nav in a positioned layer so it still paints
      on top.

   The hairline under the Statement is **the page's one hairline** (§2: once per
   page). It is placed with `SeamHairline` rather than `Band`'s `hairline` prop
   because §4.4 draws it *with* the Statement, and the prop puts it at the top
   of the band's content, above the breadcrumb.

   The hero is ~78vh at 1440×900, not the ~107vh 6b shipped: the ink preset's
   112/120 padding *plus* the nav's height inside the content is 320px of air
   around 470px of copy. `paddingClassName` trims it to 64/80 — the hero still
   opens on more air than any other band on the page, and the first CTA is now
   above the fold.                                                             */

export function CooHero({
  trail,
  title,
  statement,
  answer,
}: {
  trail:     readonly Crumb[];
  /** The keyword deck — the page's actual subject. */
  title:     string;
  /** The display deck, the line that rides the wave. */
  statement: string;
  answer:    string;
}) {
  return (
    <WaveClockProvider amplitude={20}>
      <Band
        as="header"
        ground="ink"
        underNav
        paddingClassName="pt-[40px] pb-[60px] lg:pt-[64px] lg:pb-[80px]"
        /* The slab leans *down* over the day strip: §2's seam with the dark
           band on top, so the radius is on the bottom corners. The page adds
           the 48px back above `DaySection` so its hairline is not tucked under
           the rounded edge. */
        overlap="down"
        device={<WaveField lines={12} amplitude={20} color="--fn-orange" opacity={0.34} />}
      >
        <Breadcrumb trail={trail} tone="ink" />

        {/* No eyebrow. It was `COO.eyebrow` — "VS HIRING A COO" — stacked
            directly under a breadcrumb ending "FINCH VS HIRING A COO" and
            directly above an `<h1>` kicker reading "Finch vs hiring a COO.":
            three near-identical lines in 60px of a hero. The breadcrumb states
            where you are and the kicker states what the page is; a mono
            restatement between them is noise. The string stays in
            `lib/marketing/compare.ts` (the hub and the ported comparisons still
            read their own). */}
        <h1 className="m-0 mt-[26px] lg:mt-[34px]">
          <span className="mb-[14px] block font-fn-serif text-[20px] font-medium leading-[1.2] tracking-[-0.01em] text-fn-ink-text-2 lg:mb-[18px] lg:text-[24px]">
            {title}
          </span>
          {/* 20ch, not 15: `text-balance` at 15ch chose three lines and broke
              the sentence mid-clause ("A COO's / day. Done / by breakfast.").
              At 20 it breaks where the full stop is, on two lines, and the hero
              loses ~90px it was spending on a bad rag. */}
          <span className={STATEMENT_CLASS + " block max-w-[20ch] text-fn-ink-text"}>
            <WaveText>{statement}</WaveText>
          </span>
        </h1>

        <SeamHairline className="mt-[26px] w-[160px] lg:mt-[34px] lg:w-[240px]" />

        <p className="m-0 mt-[26px] max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-text-2 text-pretty lg:mt-[34px] lg:text-[16.5px]">
          {answer}
        </p>

        <div className="mt-[30px] flex flex-wrap items-center gap-[14px] lg:mt-[38px]">
          <MagneticButton
            href="/operations-audit"
            tone="dark"
            event="book_audit_click"
            eventProps={{ page: "compare-coo-hero" }}
          >
            Book your audit
          </MagneticButton>
          {/* An in-page hash — a plain anchor, and Lenis runs with its own
              anchor handling off, so the browser's instant jump stands and
              `#day`'s `scroll-mt` keeps it clear of the nav. */}
          <MagneticButton href="#day" variant="secondary" tone="dark">
            See the day
          </MagneticButton>
        </div>
      </Band>
    </WaveClockProvider>
  );
}

export default CooHero;
