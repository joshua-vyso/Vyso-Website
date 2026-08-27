/* The site-wide OG image, and the fallback for every route without its own:
   Next's file convention applies an `opengraph-image` to the segment it sits in
   *and* all of its descendants, so this one covers `/`, `/contact`,
   `/case-studies/*`, `/resources/*` and anything else added later that doesn't
   ship a generator of its own. That is why no page's metadata hard-codes an
   image — the convention resolves the nearest one.

   Rebuilt on the `--vy-*` template (`.ai/plan_vyso_redesign_2026.md` §8, Phase
   1): the positioning line in its two-tier form, and the first three beats of
   the homepage's own hero script in window chrome. The routes that still render
   the Finch-era template keep it until Phase 3 rebuilds them; this is the first
   image on the new system, not a sweep of them all.

   The feed is the homepage's demo, abbreviated to three rows because a 470px
   card in a feed thumbnail cannot carry six. Every timestamp is a STATIC
   string, and R91 per kg is an OPERATIONAL figure (what a distributor pays a
   supplier), never a Vyso fee. */

import { renderVysoOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/vyso";

export const runtime = "nodejs";

const TITLE = "Automation that knows";
const CONTINUATION = "what happens next.";

export const alt = `${TITLE} ${CONTINUATION}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderVysoOgImage({
    eyebrow: "VYSO · AI OPERATIONS · JOHANNESBURG",
    title: TITLE,
    continuation: CONTINUATION,
    lead: "Operational systems that automate the repetitive work, then tell you when something needs your attention.",
    frameTitle: "Operations feed",
    feed: [
      { time: "09:41", text: "An order arrives on WhatsApp and is captured automatically." },
      { time: "09:42", text: "Inventory checked. Available: 31. Required: 40." },
      {
        time: "09:43",
        accent: true,
        label: "VYSO RECOMMENDS",
        text: "You are 9 boxes short for tomorrow. Supplier A has stock at R91 per kg.",
      },
    ],
    footerNote: "Free operations audit",
  });
}
