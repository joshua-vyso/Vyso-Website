import { Band } from "@/components/finch/ground/Band";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";

import { AUDIT_HOUR_NOTE } from "./audit-content";
import { WeekRail } from "./WeekRail";

/* ── How the hour runs — the page's blue band ────────────────────────────────
   `.ai/vyso_v3_design.md` §7: `/operations-audit`'s deep band is "how it runs"
   on blue with an `OscillatingGrid` in light-blue dots, the four steps drawn
   along a rail. This is the ground sequence's first cut from paper, and it is
   the only place on the page where the shape of the audit is a *picture*
   rather than a list.

   `.ai/plan_home_only.md`, change 4: this band described a paid week and a
   Mon→Sun rail. The audit is a free hour now, so the rail carries the four
   steps themselves rather than seven days (`WeekRail.tsx`) and the copy says
   an hour.

   Device discipline (§3): light-blue dots, **cursor attraction off** — the plan
   reserves the cursor-aware field for the pricing hero, and a section this far
   down the page is read, not played with. One device, and the dots stamping in
   are a once-only enter reveal rather than a second loop, so the band holds one
   moving thing at rest.

   The band carries extra bottom padding because the section below straddles the
   seam: `AuditTools`' header card pulls up over this band's bottom edge (§2's
   Illoca move), and the padding is what stops it landing on the rail.          */
export function AuditWeek() {
  return (
    <Band
      ground="blue"
      /* §2's seam: the slab overlaps the hero by 48px with a 24px top radius.
         The 52/80px of air above it is `AuditHero`'s bottom padding, not a
         margin here — `seam` sets `-mt-[48px]`, and a `mt-*` in `className`
         would be a second value for the same property. */
      seam
      /* 6b-fixes: the blue preset (96/104) plus the straddle spacer below
         double-reserved bottom room — 813px measured band vs 458px content.
         `AuditTools`' card only pulls up 68/104 (its own `-mt-*`), so the
         band's own bottom padding pays for the *clearance* and the spacer
         below pays for the overhang, once each.

         6b fixes r2: that clearance was 24px, which is a hairline rather than
         a breath — the rule for an intended straddle is ≥48px of clear ground
         above the straddler's top edge on the dark side, the same 48 the seam
         itself is worth. Measured after: the mono "THE SHAPE OF THE WEEK" note
         now ends 48px above the card's top edge (both breakpoints). Total bottom clearance is
         48+68=116 / 48+104=152 — the overhang plus the clearance, still not a
         second helping of the preset. */
      paddingClassName="pt-[52px] pb-[48px] lg:pt-[88px] lg:pb-[48px]"
      device={
        <OscillatingGrid
          mode="dots"
          color="--fn-blue-300"
          colorFallback="#3E7BC4"
          /* 0.28, not §2's 0.40 ceiling: measured, a crest passing directly
             under the 11px mono step labels took `--fn-blue-mono` on them from
             6.9:1 to 4.1:1 — below AA. At 0.28 the worst pixel under any text
             on this band clears 4.5, and the wave is still plainly a wave. */
          opacity={0.28}
          pitch={24}
        />
      }
    >
      <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-blue-mono lg:text-[11px]">
        HOW THE HOUR RUNS
      </div>
      <h2 className="m-0 mb-[16px] max-w-[620px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-fn-blue-text lg:text-[38px]">
        Four steps, start to roadmap.
      </h2>
      <p className="m-0 mb-[30px] max-w-[560px] text-[15px] leading-[1.65] text-fn-blue-text-2 text-pretty lg:mb-[44px] lg:text-[15.5px]">
        One sitting of about an hour, and then the roadmap. Nothing to prepare
        beforehand and nothing owed afterwards.
      </p>

      <WeekRail />

      <div className="mt-[26px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-blue-mono lg:mt-[34px]">
        {AUDIT_HOUR_NOTE}
      </div>

      {/* The straddle allowance. A spacer rather than a `pb-*` in `className`:
          this band's own `paddingClassName` above already sets `pb-[24px]
          lg:pb-[24px]`, and two arbitrary Tailwind values for the same
          property resolve by stylesheet order, not by the order they are
          written here. A box is unambiguous. Sized to `AuditTools`' own
          `-mt-[68px] lg:-mt-[104px]` exactly — the overhang, not a rounder
          number — so the 24px above comes entirely from the band's padding. */}
      <div aria-hidden className="h-[68px] lg:h-[104px]" />
    </Band>
  );
}

export default AuditWeek;
