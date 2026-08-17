import { Band } from "../ground/Band";
import { CTA_TILE_DIM, GradientRibbon } from "../ground/GradientRibbon";
import { MagneticButton } from "../text/MagneticButton";

/* ── The closing CTA, on the gradient ────────────────────────────────────────
   Round 3 (Josh: "replace the black background on the Book-your-audit tiles
   across the site with that gradient"): the page's second ink band drops the
   `squares`-mode `OscillatingGrid` — previously the only reserved bold field
   on the site — for the same dimmed `GradientRibbon` the other two closing
   "Book your audit" tiles now use (`AuditBand`, `compare/CooCta`). `/pricing`
   no longer opens on a grid and closes on a louder one of the same kind; it
   closes on the gradient every closing tile on the site now shares.

   No cursor attraction here, unlike the hero. A moving gradient that also
   chases the pointer is two effects arguing, and the magnetic button is
   already the thing in this band that responds to where the reader is.

   Copy is verbatim from `.ai/design/Pricing.dc.html`; the audit is booked at
   `/operations-audit`, same as every other "Book your audit" CTA on the Finch
   surface. The `EXPANDED MANDATES PRICED ON SCOPE` line stays under it — it is
   the honesty rule this page's single price depends on — and now reads
   `--fn-ink-text-2`, the same secondary as the paragraph above it, not the
   separate (and on a gradient, lower-contrast) `--fn-ink-mono`.                */
export function AuditCta() {
  return (
    <Band
      ground="ink"
      id="audit"
      contentClassName="text-center"
      device={<GradientRibbon dim={CTA_TILE_DIM} />}
    >
      {/* The closing-CTA lockup the three of them share (`AuditBand`,
          `compare/CooCta`, this): serif h2 28/34, body 15/15.5, one magnetic
          button at 16px. Centred here because the whole page is. */}
      <div className="mx-auto max-w-[700px]">
        <h2 className="m-0 mb-[14px] font-fn-serif text-[28px] font-medium leading-[1.18] tracking-[-0.02em] text-fn-ink-text lg:text-[34px]">
          It starts with a one-week Operations Audit.
        </h2>
        <p className="m-0 mb-[26px] text-[15px] leading-[1.65] text-fn-ink-text-2 text-pretty lg:mb-[30px] lg:text-[15.5px]">
          R2,000, credited to your first month. We take a week of your invoices, statements and stock
          sheets and come back with where the money is leaking — in rand, with the evidence attached.
        </p>
        <MagneticButton
          href="/operations-audit"
          tone="ink"
          event="book_audit_click"
          eventProps={{ page: "pricing" }}
          className="text-[16px]"
        >
          Book your audit
        </MagneticButton>
        <div className="mt-[30px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-ink-text-2 lg:mt-[36px]">
          EXPANDED MANDATES PRICED ON SCOPE
        </div>
      </div>
    </Band>
  );
}

export default AuditCta;
