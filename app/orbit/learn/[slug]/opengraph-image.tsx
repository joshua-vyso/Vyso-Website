import { OG_CONTENT_TYPE, OG_SIZE, renderOrbitOgImage } from "@/lib/og/orbit";
import { ORBIT_ARTICLES, getOrbitArticle } from "@/lib/orbit/articles";

export const runtime = "nodejs";
export const alt = "Orbit guides for South African tradespeople.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return ORBIT_ARTICLES.map((article) => ({ slug: article.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getOrbitArticle(slug);

  if (!article) {
    return renderOrbitOgImage({
      eyebrow: "ORBIT · GUIDES",
      title: "Guides for South African trades.",
    });
  }

  return renderOrbitOgImage({
    eyebrow: "ORBIT · GUIDE",
    title: article.title,
    lead: article.standfirst,
  });
}
