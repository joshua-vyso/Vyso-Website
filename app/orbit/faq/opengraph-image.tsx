import { OG_CONTENT_TYPE, OG_SIZE, renderOrbitOgImage } from "@/lib/og/orbit";
import { ALL_ORBIT_FAQS } from "@/lib/orbit/faq";

export const runtime = "nodejs";
export const alt = "Orbit FAQ — straight answers about WhatsApp invoicing for trades.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOrbitOgImage({
    eyebrow: "ORBIT · FAQ",
    title: "Orbit, answered.",
    lead: `${ALL_ORBIT_FAQS.length} questions about what Orbit is, what it costs, where your data lives and when it opens — each answered in the first sentence.`,
  });
}
