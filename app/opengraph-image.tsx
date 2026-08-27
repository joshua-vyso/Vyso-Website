/* The site-wide OG image, and the fallback for every route without its own:
   Next's file convention applies an `opengraph-image` to the segment it sits in
   *and* all of its descendants, so this one covers `/`, `/contact`,
   `/case-studies/*`, `/resources/*` and anything else added later that doesn't
   ship a generator of its own. That is why no page's metadata hard-codes an
   image any more — the convention resolves the nearest one.

   Regenerated around the agency line (`.ai/plan_home_only.md`, change 2) rather
   than around the old home hero, so a shared link previews as what Vyso is
   rather than as one product's headline. No bird: `renderOgImage` never drew
   one, and none is added here. The Finch treatment moved with its page — see
   `app/finch/opengraph-image.tsx`.

   `footerNote` is passed explicitly because the helper still defaults to the
   old published monthly price for the routes that have not been repositioned;
   this image is not one of them. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { FLAGSHIP } from "@/lib/marketing/findings";

export const runtime = "nodejs";

const TITLE = "An AI automation agency for South African businesses.";

export const alt = TITLE;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "VYSO · AI AUTOMATION AGENCY · JOHANNESBURG",
    title: TITLE,
    /* The proof section's card, read from the findings library rather than
       hand-copied. `lib/marketing/findings.ts` carries no `"use client"`
       directive precisely so a server route can read it. */
    finding: {
      agent: FLAGSHIP.agent,
      observation: FLAGSHIP.observation,
      impact: FLAGSHIP.impact,
      evidence: FLAGSHIP.evidence,
      meta: FLAGSHIP.meta,
    },
    caption: "ILLUSTRATIVE EXAMPLE",
    footerNote: "Start with a free audit, vyso.co.za/operations-audit",
  });
}
