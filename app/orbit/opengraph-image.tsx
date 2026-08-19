/* The subsite's OG image, and the fallback for every Orbit route without one
   of its own — Next's file convention applies an `opengraph-image` to its
   segment *and* all descendants, so this covers `/orbit`, `/orbit/waitlist`
   and `/orbit/for` unless a nearer generator exists. */

import { OG_CONTENT_TYPE, OG_SIZE, renderOrbitOgImage } from "@/lib/og/orbit";
import { ORBIT } from "@/lib/orbit/site";

export const runtime = "nodejs";
export const alt = "Orbit — run your trade from WhatsApp.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOrbitOgImage({
    eyebrow: "ORBIT BY VYSO",
    /* The `/orbit` H1 verbatim. */
    title: "Run your trade from WhatsApp.",
    lead: ORBIT.promise.split(". ").slice(1).join(". "),
  });
}
