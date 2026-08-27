/* One OG image per article, on the `--vy-*` template (`lib/og/vyso.tsx`,
   Phase 1) — import only, per `.ai/plan_vyso_redesign_2026.md` §7.6: this
   file wires an article's own data into the shared renderer, it does not
   touch the renderer itself. The card is the article's `endFinding` (the
   finding the piece closes on), shown as a two-row feed: what happened, then
   the number it costs, exactly the "Vyso noticed" grammar every other demo
   on the site uses. Illustrative, and captioned as such (see
   `ArticleFinding`'s own comment in `lib/marketing/learn-articles.ts`). */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";
import { getLearnArticle } from "@/lib/marketing/learn-articles";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Vyso Insights: operations writing for South African SMEs";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getLearnArticle(slug);

  if (!article) {
    return renderVysoOgImage({
      eyebrow: "INSIGHTS",
      title: "Operations writing for",
      continuation: "South African SMEs.",
      lead: "Where the money goes in an operation, and what to do about it.",
      frameTitle: "Insights",
      feed: [
        { time: "1", text: "Eight problems, in order of how often they cost you." },
        { time: "2", text: "Every piece ends with the finding it would produce in a real week." },
      ],
    });
  }

  const finding = article.endFinding;
  return renderVysoOgImage({
    eyebrow: `INSIGHTS · ${article.category.toUpperCase()}`,
    title: article.title,
    lead: article.heroLead,
    frameTitle: "Finding",
    feed: [
      { time: finding.meta ?? finding.evidence ?? "OBSERVED", text: finding.observation },
      {
        time: "IMPACT",
        text: `${finding.impact}, illustrative example`,
        accent: true,
        label: "VYSO NOTICED",
      },
    ],
  });
}
