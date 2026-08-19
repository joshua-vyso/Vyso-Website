import { OG_CONTENT_TYPE, OG_SIZE, renderOrbitOgImage } from "@/lib/og/orbit";
import { ORBIT } from "@/lib/orbit/site";

export const runtime = "nodejs";
export const alt = "Orbit pricing — R99 per tradesperson per month.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOrbitOgImage({
    eyebrow: "ORBIT · PRICING",
    title: `${ORBIT.price.display} a month, everything included.`,
    lead: "One plan, no tiers and no per-invoice fee. Orbit is in development — the waitlist locks founding pricing.",
    /* The price is already the title; repeating it in the footer is the one
       place `render.tsx`'s own rule (drop `footerNote` on the pricing page)
       applies here too. */
    footerNote: null,
  });
}
