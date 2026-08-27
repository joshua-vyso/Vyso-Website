/* `/case-studies`'s own OG image, on the `--vy-*` template
   (`.ai/plan_vyso_redesign_2026.md` §8). Every timestamp is a static string;
   the figures in the feed are the same `[TNS_NUMBER]` placeholders the page
   itself ships, not a number invented for the thumbnail. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";

export const runtime = "nodejs";

const TITLE = "Built in the real world.";

export const alt = TITLE;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderVysoOgImage({
    eyebrow: "VYSO · CASE STUDIES",
    title: TITLE,
    lead: "One real client story so far, documented honestly.",
    frameTitle: "Turn 'n Slice",
    feed: [
      { time: "01", text: "Fresh produce wholesale, Johannesburg. Our first client." },
      { time: "02", text: "QuickBooks invoicing replaced with one connected workflow." },
      {
        time: "03",
        accent: true,
        label: "RESULTS",
        text: "[TNS_NUMBER] supplier invoices processed a month.",
      },
    ],
    footerNote: "Free operations audit",
  });
}
