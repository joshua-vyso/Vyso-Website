import type { MetadataRoute } from "next";

const BASE_URL = "https://vyso.co.za";

/* Marketing routes only. `/app`, `/api`, `/login` and `/onboarding` are the
   product — noindex per `.ai/vyso_v2.md` §7.1 ("noindex only /app, /login,
   /onboarding, /api"). */
const DISALLOW = ["/api/", "/app/", "/login", "/onboarding"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everyone else: crawl the marketing site, stay out of the product.
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      // Named AI/answer-engine crawlers, explicitly allowed rather than left
      // to fall through the `*` rule — `.ai/vyso_v2.md` §7.4: "let the bots
      // in… decide consciously; the goal is to be cited." Each still respects
      // the product disallow list.
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "anthropic-ai",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "Applebot-Extended",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        userAgent: "CCBot",
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
