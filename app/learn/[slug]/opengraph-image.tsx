/* One OG image per article. The card is the article's `endFinding` — the card
   the piece closes on — so sharing the article previews the thing it argues
   towards. Illustrative, and captioned as such (see `ArticleFinding`'s own
   comment in `lib/marketing/learn-articles.ts`). */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { getLearnArticle } from "@/lib/marketing/learn-articles";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Vyso Learn — operations writing for South African SMEs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getLearnArticle(slug);

  if (!article) {
    return renderOgImage({
      eyebrow: "LEARN",
      title: "Operations writing for South African SMEs.",
      finding: {
        agent: "VYSO LEARN",
        observation: "Where the money goes in an operation, and what to do about it.",
        impact: "R6,000 / location / month",
        evidence: "vyso.co.za/learn",
      },
      state: null,
    });
  }

  const finding = article.endFinding;
  return renderOgImage({
    eyebrow: `LEARN · ${article.category.toUpperCase()}`,
    title: article.title,
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
