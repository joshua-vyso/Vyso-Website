import { CTA_TILE_DIM, GradientRibbon } from "@/components/finch/ground/GradientRibbon";
import { MagneticButton } from "@/components/finch/text/MagneticButton";

/* ── The closing audit block ─────────────────────────────────────────────────
   Site repositioning Phase 3, brief §5's close, revised by Phase 3.5
   (AMENDMENT 2).

   Phase 3 made this a flat `--fn-ink` plate, on the reading of brief §13 that
   ruled gradients out of the new pages. AMENDMENT 2 reverses that reading — the
   owner's words are "beautiful orange-blue gradients" — so the plate now takes
   exactly the ground `AuditBand`'s `default` variant has carried on the other
   ~18 routes since 6b round 3: `GradientRibbon` dimmed to `CTA_TILE_DIM`, plus
   the ink grain over it. The two closing tiles on this site are now the same
   object, which is what they always claimed to be.

   The button follows `AuditBand` for the same measured reason: orange on a
   gradient risks orange-on-orange in the tile's warm half, so this one CTA
   takes `tone="ink"` — `--fn-ink` fill, `--fn-ink-text` label, `--fn-ink-fill`
   on hover. Every other "Book your free audit" on the site stays orange.

   `extraLine` is the per-page sentence the brief allows after the standing two
   (hotels: "The audit works across properties…"). Everything else is fixed,
   because it is the same offer on every page that closes with it.

   Amendment 1 (`.ai/plan_site_repositioning.md`): the audit was a paid week at
   a published price, credited against the first build. It is a free hour now,
   and nothing on this site carries an amount — so the close leads with the
   hour and with the one promise that does not depend on the outcome.

   Copy is untouched by 3.5: the heading, the line and the button label are the
   strings Phase 3 shipped.                                                    */

const HEADING = "Start with a free operations audit.";
const LINE =
  "An hour with you, free. We tell you where the money is leaking whether you work with us or not.";

export function AuditClose({
  page,
  extraLine,
}: {
  /** The `book_audit_click` label for this page's button. */
  page: string;
  extraLine?: string;
}) {
  return (
    <section
      aria-labelledby="audit-close-heading"
      className="mx-auto max-w-[1160px] px-[20px] pt-[88px] pb-[24px] lg:px-[40px] lg:pt-[140px] lg:pb-[40px]"
    >
      {/* `isolate` + `-z-10` on the ground layer, same as `AuditBand`: the
          ribbon has to sit under the copy without escaping the plate. */}
      <div className="fn-ground-grain relative isolate overflow-hidden rounded-[16px] bg-fn-ink px-[24px] py-[40px] lg:px-[56px] lg:py-[60px]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[16px]"
        >
          <GradientRibbon dim={CTA_TILE_DIM} />
        </div>

        <div className="flex flex-col items-start gap-[28px] lg:flex-row lg:items-center lg:justify-between lg:gap-[56px]">
          <div>
            <h2
              id="audit-close-heading"
              className="m-0 mb-[16px] max-w-[560px] font-fn-serif text-[28px] font-medium leading-[1.16] tracking-[-0.022em] text-fn-ink-text text-pretty lg:text-[38px]"
            >
              {HEADING}
            </h2>
            <p className="m-0 max-w-[540px] text-[15.5px] leading-[1.7] text-fn-ink-text-2 text-pretty lg:text-[16.5px]">
              {LINE}
            </p>
            {extraLine ? (
              <p className="m-0 mt-[14px] max-w-[540px] text-[15.5px] leading-[1.7] text-fn-ink-text-2 text-pretty lg:text-[16.5px]">
                {extraLine}
              </p>
            ) : null}
          </div>
          <MagneticButton
            /* `/operations-audit` on this tree, not `/contact`: the audit page
               exists here and carries the booking form, so the close lands on
               the offer rather than one step short of it. */
            href="/operations-audit"
            tone="ink"
            event="book_audit_click"
            eventProps={{ page }}
            className="w-full shrink-0 whitespace-nowrap text-[16px] sm:w-auto"
          >
            Book your free audit
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}

export default AuditClose;
