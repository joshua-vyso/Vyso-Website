/* `/finch`'s own OG image. Until this file existed the page's composition lived
   at `/` and shared the site-wide default (`app/opengraph-image.tsx`); that
   default now carries the agency line, so the Finch treatment moves here with
   the page rather than being lost.

   Same `renderOgImage` helper every other route uses (`lib/og/render.tsx`) — no
   new template. The card is `FLAGSHIP`, the same finding the hero's cycling
   card opens on, so the preview can never show a claim the page itself does not
   make. `footerNote` is passed explicitly because the helper's default is the
   old published monthly price, and nothing on this page states an amount any
   more (`.ai/plan_home_only.md`, change 1). */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { FLAGSHIP } from "@/lib/marketing/findings";

export const runtime = "nodejs";
export const alt = "Meet Finch. Your company's own COO, at a tenth of the cost.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "FINCH BY VYSO",
    /* The page's H1 verbatim (`components/finch/HomeHero.tsx`). */
    title: "Meet Finch. Your company’s own COO — at a tenth of the cost.",
    finding: {
      agent: FLAGSHIP.agent,
      observation: FLAGSHIP.observation,
      impact: FLAGSHIP.impact,
      evidence: FLAGSHIP.evidence,
      meta: FLAGSHIP.meta,
    },
    caption: "ILLUSTRATIVE EXAMPLE",
    footerNote: "Start with a free audit, vyso.co.za/operations-audit",
  });
}
