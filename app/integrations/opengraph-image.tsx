/* `/integrations`'s own OG image, on the `--vy-*` template. Two rows are the
   real connections; the third names the honesty rule itself rather than
   picking one roadmap tool to feature over another. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";

export const runtime = "nodejs";

const TITLE = "Connect what you";
const CONTINUATION = "already run.";

export const alt = `${TITLE} ${CONTINUATION}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderVysoOgImage({
    eyebrow: "VYSO · INTEGRATIONS",
    title: TITLE,
    continuation: CONTINUATION,
    lead: "Nothing to migrate. Read, not replaced, and only once you say so.",
    frameTitle: "Reading table",
    feed: [
      { time: "01", text: "Xero: invoices, bills, contacts and balances. Connected." },
      { time: "02", text: "WhatsApp Business: order intake. Connected." },
      {
        time: "03",
        accent: true,
        label: "EVERYTHING ELSE",
        text: "Designed around, or roadmap, scoped in your audit.",
      },
    ],
    footerNote: "Free operations audit",
  });
}
