/* `/faq`'s OG image. The counts are read off `lib/marketing/faq.ts` rather than
   typed, so the image cannot claim more answers than the page renders. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { ALL_FAQ_QUESTIONS, FAQ_GROUPS } from "@/lib/marketing/faq";

export const runtime = "nodejs";
export const alt = "FAQ: Finch pricing, the audit & POPIA";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({
    eyebrow: "FREQUENTLY ASKED",
    title: "Straight answers about Finch, the audit and POPIA.",
    finding: {
      agent: "THE QUESTIONS",
      observation:
        "Pricing, the Operations Audit, founding terms, POPIA, and how Finch fits the tools you already run.",
      impact: `${ALL_FAQ_QUESTIONS.length} questions answered`,
      evidence: `${FAQ_GROUPS.length} groups`,
      meta: "NO SALES COPY IN THE ANSWERS",
    },
    state: null,
  });
}
