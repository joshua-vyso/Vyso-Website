import { OG_CONTENT_TYPE, OG_SIZE, renderOrbitOgImage } from "@/lib/og/orbit";
import { ORBIT_COMPARISONS, getOrbitComparison } from "@/lib/orbit/compare";

export const runtime = "nodejs";
export const alt = "Orbit compared — WhatsApp operations for South African trades.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return ORBIT_COMPARISONS.map((comparison) => ({ slug: comparison.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const comparison = getOrbitComparison(slug);

  if (!comparison) {
    return renderOrbitOgImage({ eyebrow: "ORBIT · COMPARE", title: "Orbit, compared." });
  }

  return renderOrbitOgImage({
    eyebrow: "ORBIT · COMPARE",
    title: comparison.h1,
    /* The first sentence of the direct answer — the part an engine would quote
       and the part a reader scanning a link preview actually needs. */
    lead: `${comparison.answer.split("; ")[0]}.`,
  });
}
