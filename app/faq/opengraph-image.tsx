/* `/faq`'s OG image, rebuilt on the `--vy-*` template (`lib/og/vyso.tsx`). The
   counts are read off `lib/marketing/faq.ts` rather than typed, so the image
   can never claim more answers than the page renders. */

import { renderVysoOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/vyso";
import { ALL_FAQ_QUESTIONS, FAQ_GROUPS } from "@/lib/marketing/faq";

export const runtime = "nodejs";
export const alt = "FAQ: pricing, security and how Vyso works";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderVysoOgImage({
    eyebrow: "FREQUENTLY ASKED",
    title: "Straight answers,",
    continuation: "no sales copy.",
    lead: "What Vyso automates, how it's priced, how it compares, and how your data is handled.",
    frameTitle: "Vyso FAQ",
    feed: [
      {
        time: FAQ_GROUPS.length.toString().padStart(2, "0"),
        text: "sections, each one grouped around a real question.",
      },
      {
        time: ALL_FAQ_QUESTIONS.length.toString().padStart(2, "0"),
        text: "questions answered, with no sales copy attached.",
        accent: true,
        label: "EVERY ANSWER, ONE PLACE",
      },
    ],
    footerNote: null,
  });
}
