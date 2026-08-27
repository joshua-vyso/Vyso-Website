/* One OG image per solution, from that solution's own entry in
   `lib/marketing/solutions.ts`. The card is its `exampleFinding` — the single
   worked card the page renders under an ILLUSTRATIVE EXAMPLE caption, and the
   caption travels with it here. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { getSolution } from "@/lib/marketing/solutions";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Finch by Vyso — what Finch fixes";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = getSolution(slug);

  if (!solution) {
    return renderOgImage({
      eyebrow: "WHAT FINCH FIXES",
      title: "Four problems Finch was built to watch.",
      finding: {
        agent: "FINCH",
        observation: "Money leakage, procurement, reporting and the operations dashboard.",
        impact: "Priced per scope, after a free audit",
        evidence: "vyso.co.za/solutions",
      },
      state: null,
    });
  }

  const finding = solution.exampleFinding;
  return renderOgImage({
    eyebrow: solution.eyebrow,
    title: solution.title,
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
