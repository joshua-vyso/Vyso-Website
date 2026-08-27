/* `/south-africa`'s own OG image, on the `--vy-*` template (`lib/og/vyso.tsx`).
   Previously this segment re-exported the site-wide image; this page earns
   its own design now, themed on the page's own local example (a VAT line
   caught on a supplier invoice) rather than the homepage's order/shortage
   script, so a shared link previews as this page's own proof, not the
   homepage's. */

import { renderVysoOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/vyso";

export const runtime = "nodejs";
export const alt = "Vyso: built for South African operations";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderVysoOgImage({
    eyebrow: "VYSO IN SOUTH AFRICA",
    title: "Built for how South African",
    continuation: "businesses actually run.",
    lead: "WhatsApp orders, Excel, Sage and Xero, rand, VAT and EFT, built in from the start.",
    frameTitle: "VAT review",
    feed: [
      { time: "14:12", text: "Supplier invoice INV-2291 arrives on WhatsApp." },
      {
        time: "14:13",
        text: "Standard rate VAT applied to a line that's normally zero rated.",
        accent: true,
        label: "VYSO NOTICED",
      },
    ],
    footerNote: "Johannesburg, South Africa",
  });
}
