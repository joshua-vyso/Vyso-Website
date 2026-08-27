/* `/about`'s OG image, rebuilt on the `--vy-*` template (`lib/og/vyso.tsx`).
   The previous version of this file read "The company behind Finch." — the
   exact phrase plan §7.6 flagged for Phase 2b to fix. Every line below is
   `lib/marketing/site.ts` or a fact this page itself states. */

import { renderVysoOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/vyso";

export const runtime = "nodejs";
export const alt = "About Vyso, an AI operations company in Johannesburg";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderVysoOgImage({
    eyebrow: "ABOUT VYSO",
    title: "One company,",
    continuation: "not a platform or a product line.",
    lead: "The founder story, how we work as one team, and how we handle data and POPIA.",
    frameTitle: "Vyso",
    feed: [
      { time: "THEN", text: "Started inside a family wholesale business, not a whiteboard." },
      {
        time: "NOW",
        text: "One team runs the audit, builds the system and keeps watching it.",
        accent: true,
        label: "ONE COMPANY, NOT A PRODUCT LINE",
      },
    ],
    footerNote: "Johannesburg, South Africa",
  });
}
