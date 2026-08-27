/* `/industries`'s own OG image, on the `--vy-*` template
   (`.ai/plan_vyso_redesign_2026.md` §8). */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";
import { HUB, INDUSTRY_LIST } from "@/lib/marketing/industries";

export const runtime = "nodejs";

export const alt = `${HUB.h1Plain} ${HUB.h1Accent}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderVysoOgImage({
    eyebrow: HUB.eyebrow,
    title: HUB.h1Plain,
    continuation: HUB.h1Accent,
    lead: HUB.lead,
    frameTitle: "Industries",
    feed: INDUSTRY_LIST.map((industry, i) => ({
      time: `0${i + 1}`,
      text: `${industry.shortName}: ${industry.cardFinding}`,
    })),
    footerNote: "Free operations audit",
  });
}
