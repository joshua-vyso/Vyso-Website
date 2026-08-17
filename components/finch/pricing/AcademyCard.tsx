import Link from "next/link";

import { RAIL } from "../ground/Band";

/* The DIY option, deliberately quieter than Finch: smaller type, a flat white
   card, a secondary button and no orange anywhere. It has to be findable
   without competing with the R6,000 offer above it.

   On the page's 1160 rail like everything else — its own centred 860 column put
   its right edge 150px inside the margin card hanging out of the band above,
   which is most of why that card read as falling off rather than as crossing a
   seam. The card's radius matches the founding-terms plate at the top of the
   page: one card radius on `/pricing`.

   `?topic=academy` is a hint for whoever picks up the enquiry — `/contact` does
   not read search params today, so the query is inert rather than broken.

   6b fixes r2 — the bottom padding. This section had none, so the card's
   bottom border and the ink CTA band's top edge were the same line: measured
   0px of paper between them at 1440. Nothing straddles that join (the CTA is a
   plain ink band, and the only straddler on this page is the margin card
   *above*, which the `lg:pt-[128px]` wrapper in `app/pricing/page.tsx` already
   pays for), so the paper section keeps its full bottom rhythm. */
export function AcademyCard() {
  return (
    <section id="academy" className={`${RAIL} pb-[64px] pt-[64px] lg:pb-[110px] lg:pt-[96px]`}>
      <div className="flex flex-col gap-[24px] rounded-[12px] border border-fn-line bg-fn-surface px-[24px] py-[28px] lg:flex-row lg:items-center lg:justify-between lg:gap-[40px] lg:px-[40px] lg:py-[36px]">
        <div className="max-w-[520px]">
          <div className="mb-[10px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
            VYSO ACADEMY · THE DIY OPTION
          </div>
          <h2 className="m-0 mb-[10px] font-fn-serif text-[22px] font-medium tracking-[-0.02em] lg:text-[26px]">
            Rather run the playbook yourself?
          </h2>
          <p className="m-0 text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">
            Vyso Academy teaches your team the same operating method Finch runs — workshops,
            templates and the weekly-brief discipline — without the agents doing it for you.
          </p>
        </div>

        <div className="shrink-0 lg:text-right">
          <div className="mb-[8px] font-fn-serif text-[30px] font-medium tracking-[-0.02em] lg:text-[34px]">
            R500
            <span className="text-[16px] font-normal tracking-normal text-fn-muted"> / seat</span>
          </div>
          <div className="mb-[16px]">
            <span className="inline-block rounded-[4px] border border-fn-line px-[7px] py-[3px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
              COMING SOON
            </span>
          </div>
          <Link
            href="/contact?topic=academy"
            className="inline-block rounded-[8px] border border-fn-line-3 bg-fn-surface px-[18px] py-[10px] text-[13.5px] font-semibold text-fn-ink transition-colors duration-150 hover:border-fn-line-hover"
          >
            Register interest
          </Link>
        </div>
      </div>
    </section>
  );
}

export default AcademyCard;
