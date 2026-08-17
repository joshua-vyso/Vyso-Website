import { Band } from "@/components/finch/ground/Band";
import { CTA_TILE_DIM, GradientRibbon } from "@/components/finch/ground/GradientRibbon";
import { MagneticButton } from "@/components/finch/text/MagneticButton";

/* ── The COO comparison's closing band ───────────────────────────────────────
   §7 closes this page on **ink**. Round 3 (Josh: "replace the black background
   on the Book-your-audit tiles across the site with that gradient") drops the
   orange `OscillatingGrid` dots for the same dimmed `GradientRibbon` every
   other closing "Book your audit" tile now uses (`AuditBand`,
   `pricing/AuditCta`). It still replaces `AuditBand` on this page only — that
   component is the site's shared dark-plate CTA and eighteen other routes
   still render it; this is the one page whose ground sequence ends on a band
   rather than a plate, and giving `AuditBand` a mode would have changed
   eighteen pages to change one.

   The words are `AuditBand`'s, deliberately: the offer does not become a
   different offer because the band under it changed from dots to a gradient.  */
export function CooCta() {
  return (
    <Band
      ground="ink"
      /* §2's seam. The air above is the page's wrapper, not a margin here. */
      seam
      device={<GradientRibbon dim={CTA_TILE_DIM} />}
    >
      {/* The same lockup as `AuditBand` and `pricing/AuditCta` — serif h2 at
          28/34, body at 15/15.5, one magnetic button at 16px. Three closing
          CTAs on three grounds; the only thing that differs is the ground. */}
      <div className="flex flex-col items-start gap-[26px] lg:flex-row lg:items-center lg:justify-between lg:gap-[48px]">
        <div>
          <h2 className="m-0 mb-[12px] max-w-[560px] font-fn-serif text-[28px] font-medium leading-[1.18] tracking-[-0.02em] text-fn-ink-text lg:text-[34px]">
            Start with a one-week Operations Audit.
          </h2>
          <p className="m-0 max-w-[520px] text-[15px] leading-[1.65] text-fn-ink-text-2 text-pretty lg:text-[15.5px]">
            R2,000, credited to your first month. We tell you where the money is
            leaking — whether you sign or not.
          </p>
        </div>
        <MagneticButton
          href="/operations-audit"
          tone="ink"
          className="shrink-0 whitespace-nowrap text-[16px]"
          event="book_audit_click"
          eventProps={{ page: "compare-coo-cta" }}
        >
          Book your audit
        </MagneticButton>
      </div>
    </Band>
  );
}

export default CooCta;
