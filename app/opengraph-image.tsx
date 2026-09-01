/* The site-wide OG image, and the fallback for every route without its own:
   Next's file convention applies an `opengraph-image` to the segment it sits in
   *and* all of its descendants, so this one covers `/`, `/contact`,
   `/case-studies/*`, `/resources/*` and anything else added later that doesn't
   ship a generator of its own. That is why no page's metadata hard-codes an
   image any more — the convention resolves the nearest one. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { FLAGSHIP } from "@/lib/marketing/findings";

export const runtime = "nodejs";
export const alt = "Vyso — AI automation for the work that slows your business down.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "VYSO · AI AUTOMATION AGENCY",
    /* The homepage H1 verbatim (`components/site/home/Hero.tsx`). */
    title: "AI automation for the work that slows your business down.",
    /* The hero's card, read from the findings library rather than hand-copied.
       `lib/marketing/findings.ts` carries no `"use client"` directive precisely
       so a server route can read it — the previous copy of these five strings
       lived here with a comment promising to keep it in sync, and did not. */
    finding: {
      agent: FLAGSHIP.agent,
      observation: FLAGSHIP.observation,
      impact: FLAGSHIP.impact,
      evidence: FLAGSHIP.evidence,
      meta: FLAGSHIP.meta,
    },
    caption: "ILLUSTRATIVE DEMO DATA",
  });
}
