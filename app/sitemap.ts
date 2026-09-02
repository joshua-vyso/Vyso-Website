import type { MetadataRoute } from "next";

/* ── The sitemap ─────────────────────────────────────────────────────────────
   Agency redesign (2026-09, `.ai/positioning_agency_2026.md`): the site is
   deliberately lean, so the sitemap is a hand-checked list rather than the
   old registry-driven generator. Every URL here renders a real page; every
   removed URL 308s via `next.config.ts` and is deliberately absent.

   `/terms` and `/popia` stay listed despite `noindex` (carried decision from
   the previous sitemap: the pages exist and are linked; the robots meta is
   what keeps them out of the index while under legal review). `/login` is
   excluded — robots.ts disallows it. */

const BASE_URL = "https://vyso.co.za";

/* Bump when shipping meaningful content changes. */
const CONTENT_LAST_MODIFIED = new Date("2026-09-02");

const ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/automations", priority: 0.9, changeFrequency: "monthly" },
  { path: "/industries", priority: 0.8, changeFrequency: "monthly" },
  { path: "/industries/food-hospitality", priority: 0.8, changeFrequency: "monthly" },
  { path: "/industries/construction", priority: 0.8, changeFrequency: "monthly" },
  { path: "/industries/insurance", priority: 0.8, changeFrequency: "monthly" },
  { path: "/integrations", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/join", priority: 0.9, changeFrequency: "monthly" },
  { path: "/construction", priority: 0.8, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/popia", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: CONTENT_LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
