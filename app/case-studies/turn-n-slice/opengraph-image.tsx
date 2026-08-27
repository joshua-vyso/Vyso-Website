/* `/case-studies/turn-n-slice`'s own OG image, on the `--vy-*` template. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";

export const runtime = "nodejs";

const TITLE = "Replacing invoicing admin";
const CONTINUATION = "with one connected system.";

export const alt = `${TITLE} ${CONTINUATION}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderVysoOgImage({
    eyebrow: "TURN 'N SLICE · JOHANNESBURG",
    title: TITLE,
    continuation: CONTINUATION,
    lead: "Our first client. Fresh produce wholesale, Johannesburg.",
    frameTitle: "Price list · Highveld Foods",
    feed: [
      { time: "01", text: "Price lists, customer accounts, quotes and orders, one record." },
      { time: "02", text: "QuickBooks replaced as the invoicing system." },
      {
        time: "03",
        accent: true,
        label: "RESULTS",
        text: "[TNS_NUMBER] hours a week returned to the owner.",
      },
    ],
    footerNote: "Our first client",
  });
}
