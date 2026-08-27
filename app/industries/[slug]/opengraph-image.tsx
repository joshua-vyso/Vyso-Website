/* One OG image per vertical. Eyebrow, title and card all come from the
   vertical's own entry in `lib/marketing/industries.ts`: the card is `deck[0]`,
   the first of the three finding cards the page itself fans out, so the preview
   shows exactly what the page shows. Illustrative, and captioned as such. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { getIndustry } from "@/lib/marketing/industries";

export const runtime = "nodejs";
/* Segment-level, not per-slug: `alt` is a module constant and cannot read
   `params`. Each image's own title is in the picture. */
export const alt = "Finch by Vyso — what Finch watches in your industry";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = getIndustry(slug);

  /* The page 404s on an unknown slug; this route still has to return an image,
     so it returns the hub's own framing rather than throwing. */
  if (!industry) {
    return renderOgImage({
      eyebrow: "INDUSTRIES · SOUTH AFRICA",
      title: "Finch, built for South African operations.",
      finding: {
        agent: "FINCH",
        observation: "Agents are set per business in the audit, in the order they earn their place.",
        impact: "Priced per scope, after a free audit",
        evidence: "vyso.co.za/industries",
      },
      state: null,
    });
  }

  const finding = industry.deck[0];
  return renderOgImage({
    eyebrow: industry.eyebrow,
    title: industry.title,
    finding: {
      agent: finding.agent,
      observation: finding.observation,
      impact: finding.impact,
      evidence: finding.evidence,
      meta: finding.meta,
    },
    caption: "ILLUSTRATIVE EXAMPLE",
  });
}
