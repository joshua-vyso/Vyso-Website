/* One OG image per vertical, on the `--vy-*` template. The feed is the
   vertical's own `deck` (`lib/marketing/industries.ts`), so the preview shows
   the same illustrative examples the page itself fans out as `FindingCard`s,
   never a number invented for the thumbnail. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";
import { getIndustry, HUB } from "@/lib/marketing/industries";

export const runtime = "nodejs";
/* Segment-level, not per-slug: `alt` is a module constant and cannot read
   `params`. Each image's own title is in the picture. */
export const alt = "Vyso, built for South African operations";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = getIndustry(slug);

  /* The page 404s on an unknown slug; this route still has to return an
     image, so it falls back to the hub's own framing rather than throwing. */
  if (!industry) {
    return renderVysoOgImage({
      eyebrow: "VYSO · INDUSTRIES",
      title: HUB.h1Plain,
      continuation: HUB.h1Accent,
      lead: HUB.lead,
      frameTitle: "Industries",
      feed: [{ time: "01", text: "The audit decides what earns its place first, and in whose vocabulary." }],
      footerNote: "Free operations audit",
    });
  }

  const [first, second, third] = industry.deck;
  return renderVysoOgImage({
    eyebrow: industry.eyebrow,
    title: industry.h1Plain,
    continuation: industry.h1Accent,
    lead: industry.lead,
    frameTitle: "Illustrative examples",
    feed: [
      { time: "01", text: first.observation },
      { time: "02", text: second.observation },
      { time: "03", accent: true, label: third.agent, text: third.observation },
    ],
    footerNote: "Free operations audit",
  });
}
