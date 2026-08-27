/* `/operations-audit`'s OG image, rebuilt on the `--vy-*` template
   (`lib/og/vyso.tsx`, plan §8). It used to render the Finch-era
   `renderAuditOgImage`, which is still what `/operations-audit/score` and
   `/operations-audit/calculator` use through their own segment files. Those two
   routes are out of scope this phase, so their images are untouched and this
   one moves alone.

   Headline is the page's own h1. The card is the findings report rather than an
   event feed: this page's subject is an hour and a document, not a Tuesday
   morning, and reusing the homepage's order script here would say the two pages
   are the same page. The left column carries the step numbers the page's own
   list carries.

   No figure for Vyso's work appears on the card. The audit is free and the
   footer says so, which is the only price claim this site makes anywhere. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";

export const runtime = "nodejs";

const TITLE = "Find out where your operation";
const CONTINUATION = "is leaking time and money.";

export const alt = `${TITLE} ${CONTINUATION}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderVysoOgImage({
    eyebrow: "VYSO · FREE OPERATIONS AUDIT",
    title: TITLE,
    continuation: CONTINUATION,
    lead: "About an hour with you, then a written report of what would be worth automating first.",
    frameTitle: "Findings report",
    feed: [
      { time: "01", text: "You walk us through how the work actually moves through the business." },
      { time: "02", text: "We look at the repetitive work, the bottlenecks and the blind spots." },
      {
        time: "03",
        accent: true,
        label: "WHERE TO START",
        text: "A written report, ranked by what fixing each problem is worth.",
      },
    ],
    footerNote: "Free, about an hour",
  });
}
