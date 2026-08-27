/* `/about`'s OG image. Every line is `lib/marketing/site.ts` or the published
   price — the same facts the page's `<h1>` and its schema carry, and the only
   location claim the site makes anywhere. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { SITE } from "@/lib/marketing/site";

export const runtime = "nodejs";
export const alt = "About Vyso — the company behind Finch";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "ABOUT VYSO",
    title: "The company behind Finch.",
    lead: SITE.description,
    finding: {
      agent: "VYSO",
      observation:
        "One product, priced per customer and per scope, and a free audit that says so if the answer is that you don’t need software.",
      impact: "Fixed after a free audit",
      evidence: `Founded by ${SITE.founder.name}`,
      meta: `${SITE.address.addressLocality.toUpperCase()} · ${SITE.locale.toUpperCase()}`,
    },
    state: null,
  });
}
