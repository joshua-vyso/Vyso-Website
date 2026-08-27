/* `/contact`'s own OG image, on the `--vy-*` template (`lib/og/vyso.tsx`).
   Previously this segment re-exported the site-wide image because the page
   set its own `openGraph` block with no image file of its own to back it —
   see the note that used to live here. This page earns its own design now. */

import { renderVysoOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/vyso";

export const runtime = "nodejs";
export const alt = "Contact Vyso in Johannesburg";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderVysoOgImage({
    eyebrow: "CONTACT",
    title: "Talk to Vyso,",
    continuation: "about your operation.",
    lead: "Start an audit, ask a question, or talk through an operational problem.",
    frameTitle: "Get in touch",
    feed: [
      { time: "TODAY", text: "Tell us how your operation runs, in your own words." },
      {
        time: "1 DAY",
        text: "We reply within one business day, no automated form letter.",
        accent: true,
        label: "WHAT HAPPENS NEXT",
      },
    ],
    footerNote: "joshua@vyso.co.za",
  });
}
