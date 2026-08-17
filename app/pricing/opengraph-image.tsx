/* `/pricing`'s OG image. The card holds published facts rather than a worked
   example, so it carries no state chip and no ILLUSTRATIVE caption — every line
   is `PRICE`/`DIRECT_ANSWER` from `components/finch/pricing/pricing-data.ts`,
   the same constants the page and its JSON-LD read. */

import { PRICE } from "@/components/finch/pricing/pricing-data";
import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";

export const runtime = "nodejs";
export const alt = "Finch pricing — R6,000 per location per month, everything included";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** "6000" → "6,000", the way every price on the site is written. */
function rand(amount: number): string {
  return `R${amount.toLocaleString("en-US")}`;
}

export default function Image() {
  return renderOgImage({
    eyebrow: "PRICING · ONE OFFER",
    title: `${rand(PRICE.finch)} per location per month. Everything included.`,
    finding: {
      agent: "WHAT YOU PAY",
      /* The middle clause of `DIRECT_ANSWER`, verbatim in substance. */
      observation:
        "Every module and agent, activated in priority order from your operations audit, and a monthly ops review with your Vyso lead.",
      impact: `${rand(PRICE.finch)} / location / month`,
      evidence: `${rand(PRICE.audit)} audit, credited`,
      meta: "30 DAYS’ NOTICE · NO TIERS",
    },
    state: null,
    /* The card is the price; the footer would only say it a second time. */
    footerNote: null,
  });
}
