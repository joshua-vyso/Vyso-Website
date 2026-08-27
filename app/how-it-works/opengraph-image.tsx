/* `/how-it-works`'s OG image, on the `--vy-*` template (`lib/og/vyso.tsx`).

   The headline is the page's own h1 and the feed is the page's own demo
   (`components/vyso/how/HowProactive.tsx`), abbreviated to three rows because a
   470px card cannot carry five. Deliberately NOT the homepage's order script:
   the two images sit next to each other in a search result and in a WhatsApp
   thread, and two identical cards would say the two pages are the same page.

   Every timestamp is a STATIC string. R4.20 per kg is an OPERATIONAL figure,
   what a supplier charged a distributor, never a Vyso fee. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";

export const runtime = "nodejs";

const TITLE = "We automate the work.";
const CONTINUATION = "Then we watch what happens next.";

export const alt = `${TITLE} ${CONTINUATION}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderVysoOgImage({
    eyebrow: "VYSO · HOW IT WORKS",
    title: TITLE,
    continuation: CONTINUATION,
    lead: "The mechanism, the loop, and how a project is scoped and priced.",
    frameTitle: "Supplier invoices",
    feed: [
      { time: "07:10", text: "Twenty three supplier invoices arrive overnight." },
      { time: "07:14", text: "Twenty two reconcile against the agreed price and need nobody." },
      {
        time: "07:14",
        accent: true,
        label: "NEEDS ATTENTION",
        text: "Supplier B charged R4.20 per kg above the price last agreed.",
      },
    ],
    footerNote: "Free operations audit",
  });
}
