/* One OG image per solution, from that solution's own `og` field in
   `lib/marketing/solutions.ts`. Renders on the `--vy-*` template
   (`lib/og/vyso.tsx`, Phase 1) — import only, per plan §7.4: this file wires
   a page's own data into the shared renderer, it does not touch the
   renderer itself. */

import { renderVysoOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/vyso";
import { HUB, getSolution } from "@/lib/marketing/solutions";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Vyso, automation that knows what happens next";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const solution = getSolution(slug);

  if (!solution) {
    return renderVysoOgImage({
      eyebrow: HUB.eyebrow,
      title: HUB.heading,
      continuation: HUB.continuation,
      lead: HUB.lead,
      frameTitle: "Solutions",
      feed: [
        { time: "1", text: "WhatsApp orders, invoicing and spreadsheets, automated." },
        { time: "2", text: "Procurement, stock and reporting, watched continuously." },
        { time: "3", text: "Documents read and money leakage caught, before it compounds." },
      ],
    });
  }

  return renderVysoOgImage(solution.og);
}
