import type { MetadataRoute } from "next";

import { GLOSSARY_SLUGS } from "@/lib/marketing/glossary";
import { ORBIT_ARTICLES } from "@/lib/orbit/articles";
import { ORBIT_PUBLISHED, ORBIT_STATIC_ROUTES } from "@/lib/orbit/site";
import { TRADES } from "@/lib/orbit/trades";
import { LEARN_ARTICLES } from "@/lib/marketing/learn-articles";
import { MARKETING_MODULE_SLUGS } from "@/lib/marketing/modules";

const BASE_URL = "https://vyso.co.za";

/* Every entry below now carries a `lastModified`. Two sources:
   1. Real per-item dates where the data actually has one — `learnDate()`
      reads each article's own `dateModified` (`lib/marketing/learn-articles.ts`,
      itself derived from git log — see that file's comment).
   2. `CONTENT_LAST_MODIFIED`, for every section whose data file carries no
      date of its own (`lib/marketing/{solutions,industries,integrations,
      resources}.ts`, `app/south-africa`, `app/founding-client`,
      `app/case-studies`, `app/privacy`) — this phase's date, per
      `.ai/plan_phase4_search_ai_visibility.md` §A.3 ("use a
      CONTENT_LAST_MODIFIED constant per data file, set to today's date").
      One shared constant rather than one per file: they'd all hold the same
      value today, and a single named constant is one place to bump instead
      of several. TODO(user): split it out, or move the date onto the page
      itself, the day any one of these sections actually changes without the
      others. Glossary (`lib/marketing/glossary.ts`) and the product/pricing
      pages already carry their own explicit dates below from earlier phases
      and are left as they were — this constant only fills genuine gaps. */
const CONTENT_LAST_MODIFIED = new Date("2026-08-16");

/** Throws rather than silently omitting a date if a learn slug here ever
    drifts from `lib/marketing/learn-articles.ts` — the same fail-loud pattern
    `lib/marketing/founding.ts` uses for its FAQ imports. */
function learnDate(slug: string): Date {
  const article = LEARN_ARTICLES.find((a) => a.slug === slug);
  if (!article) {
    throw new Error(`app/sitemap.ts: no learn article for slug "${slug}".`);
  }
  return new Date(article.dateModified);
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Core marketing pages. `/` is the agency page and `/finch` is the product
    // page (`.ai/plan_home_only.md`); `/platform*` still 308s to `/`, and the
    // sitemap only lists the final URL, per `.ai/vyso_v2.md` §3.
    {
      url: BASE_URL,
      lastModified: new Date("2026-08-27"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // The product page, moved off `/` this change.
      url: `${BASE_URL}/finch`,
      lastModified: new Date("2026-08-27"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/platform/modules`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...MARKETING_MODULE_SLUGS.map((slug) => ({
      url: `${BASE_URL}/platform/modules/${slug}`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: `${BASE_URL}/south-africa`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/founding-client`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/industries/restaurants`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/industries/food-suppliers`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/industries/farms`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/case-studies/turn-n-slice`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    // `/pricing` is deleted and 308s to `/operations-audit`, which is listed
    // below; the sitemap carries the destination only.
    {
      // Rebuilt this phase — absorbed `/pricing-faq` (removed below).
      url: `${BASE_URL}/faq`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // `/terms` and `/popia` are DRAFT · UNDER LEGAL REVIEW and carry
    // `robots: noindex` (see the pages themselves) — still listed here per
    // `.ai/vyso_v2.md` §2.3's phase-3 instruction to add them, with the
    // lowest priority on the site, matching `/privacy`'s changeFrequency.
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/popia`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    // Rebuilt this phase — the `/about → /platform` redirect is removed in
    // `next.config.ts`, so the page is real again.
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // New this phase. COMING SOON, but the page itself is real and indexed.
    {
      url: `${BASE_URL}/academy`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.6,
    },

    // Solutions.
    {
      url: `${BASE_URL}/solutions`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/solutions/reduce-money-leakage`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/solutions/procurement-automation`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/solutions/reporting-automation`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/solutions/operations-dashboard`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },

    // Industries index + newer industry pages.
    {
      url: `${BASE_URL}/industries`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/industries/catering-companies`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/industries/wholesale`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/industries/hospitality`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // The two experimental verticals (Phase 3, workstream A). Indexed and
    // listed here, but linked from the `/industries` hub only — not the nav,
    // the homepage or the footer (`.ai/vyso_v2.md` §2.2). Lower priority than
    // the six primary verticals because that is what they are to us.
    {
      url: `${BASE_URL}/industries/security-companies`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/industries/insurance-brokers`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // Case studies index.
    {
      url: `${BASE_URL}/case-studies`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // Learn hub.
    {
      url: `${BASE_URL}/learn`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/learn/why-businesses-lose-money-without-realising-it`,
      lastModified: learnDate("why-businesses-lose-money-without-realising-it"),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/15-signs-your-business-has-operational-chaos`,
      lastModified: learnDate("15-signs-your-business-has-operational-chaos"),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/how-much-time-can-workflow-automation-save`,
      lastModified: learnDate("how-much-time-can-workflow-automation-save"),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/hidden-cost-of-manual-procurement`,
      lastModified: learnDate("hidden-cost-of-manual-procurement"),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/supplier-scorecards-what-to-track-and-why`,
      lastModified: learnDate("supplier-scorecards-what-to-track-and-why"),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/why-weekly-reports-are-usually-too-late`,
      lastModified: learnDate("why-weekly-reports-are-usually-too-late"),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/the-real-cost-of-poor-stock-control`,
      lastModified: learnDate("the-real-cost-of-poor-stock-control"),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/ai-for-small-and-medium-businesses-practical-use-cases`,
      lastModified: learnDate("ai-for-small-and-medium-businesses-practical-use-cases"),
      changeFrequency: "monthly",
      priority: 0.55,
    },

    // Glossary — hub + one page per term, generated from the data file rather
    // than listed by hand, so a thirteenth term cannot ship unlisted.
    {
      url: `${BASE_URL}/learn/glossary`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...GLOSSARY_SLUGS.map((slug) => ({
      url: `${BASE_URL}/learn/glossary/${slug}`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),

    // Resources.
    {
      url: `${BASE_URL}/resources`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/resources/operations-audit-checklist`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/resources/weekly-operations-report-template`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/resources/supplier-scorecard`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.6,
    },

    // Interactive tools. `/roi-calculator` removed — the calculator is a page
    // under the audit now (`/operations-audit/calculator`) and the old URL 308s
    // there. The two tools list below their parent and one step lower in
    // priority: they support the page that sells the audit rather than
    // competing with it for the same query.
    {
      url: `${BASE_URL}/operations-audit`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/operations-audit/score`,
      lastModified: new Date("2026-08-17"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/operations-audit/calculator`,
      lastModified: new Date("2026-08-17"),
      changeFrequency: "monthly",
      priority: 0.6,
    },

    // Integrations. `/pricing-faq` removed — 301s to `/faq#pricing`.
    {
      url: `${BASE_URL}/integrations`,
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // Comparisons. The two `vyso-vs-*` URLs 308 to these (see `next.config.ts`)
    // and the sitemap lists finals only, per `.ai/vyso_v2.md` §3.
    {
      url: `${BASE_URL}/compare`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      // The flagship: the "AI COO / fractional COO" intent cluster from §7,
      // and the only page carrying a sourced salary figure.
      url: `${BASE_URL}/compare/finch-vs-hiring-a-coo`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/compare/finch-vs-spreadsheets`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/compare/finch-vs-erp`,
      lastModified: new Date("2026-08-15"),
      changeFrequency: "monthly",
      priority: 0.6,
    },

    /* ── Orbit ────────────────────────────────────────────────────────────
       The `/orbit` subsite (`.ai/plan_orbit_site.md`). Generated from the same
       three registries the pages themselves read — `ORBIT_STATIC_ROUTES`,
       `TRADES` and `ORBIT_ARTICLES` — so a page added there appears here, and
       in `/llms.txt`, and in the footer, without anyone remembering to.

       All of them share `ORBIT_PUBLISHED`: the subsite was written in one
       sitting and every page's real `lastmod` is that date. Same reasoning as
       `CONTENT_LAST_MODIFIED` above, with a constant of its own because these
       pages will move on a different clock to the Finch ones.

       Priorities are below the Finch money pages deliberately. Orbit is a
       waitlist for an unreleased product; `/pricing` and `/founding-client`
       sell something that exists today, and the sitemap should not suggest
       otherwise. */
    ...ORBIT_STATIC_ROUTES.map((route) => ({
      url: `${BASE_URL}${route.path}`,
      lastModified: new Date(ORBIT_PUBLISHED),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    })),
    ...TRADES.map((trade) => ({
      url: `${BASE_URL}/orbit/for/${trade.slug}`,
      lastModified: new Date(ORBIT_PUBLISHED),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...ORBIT_ARTICLES.map((article) => ({
      url: `${BASE_URL}/orbit/learn/${article.slug}`,
      lastModified: new Date(article.dateModified),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}
