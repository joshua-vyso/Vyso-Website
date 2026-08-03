import type { MetadataRoute } from "next";

import { MARKETING_MODULE_SLUGS } from "@/lib/marketing/modules";

const BASE_URL = "https://vyso.co.za";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // Core marketing pages.
    {
      url: BASE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/platform`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/platform/finch`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/platform/vyso-for-smes`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/platform/modules`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...MARKETING_MODULE_SLUGS.map((slug) => ({
      url: `${BASE_URL}/platform/modules/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    {
      url: `${BASE_URL}/south-africa`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/founding-client`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/industries/restaurants`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/industries/food-suppliers`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/industries/farms`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/case-studies/turn-n-slice`,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/faq`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },

    // Solutions.
    {
      url: `${BASE_URL}/solutions`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/solutions/reduce-money-leakage`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/solutions/procurement-automation`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/solutions/reporting-automation`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/solutions/operations-dashboard`,
      changeFrequency: "monthly",
      priority: 0.6,
    },

    // Industries index + newer industry pages.
    {
      url: `${BASE_URL}/industries`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/industries/catering-companies`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/industries/wholesale`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/industries/hospitality`,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // Case studies index.
    {
      url: `${BASE_URL}/case-studies`,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // Learn hub.
    {
      url: `${BASE_URL}/learn`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/learn/why-businesses-lose-money-without-realising-it`,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/15-signs-your-business-has-operational-chaos`,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/how-much-time-can-workflow-automation-save`,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/hidden-cost-of-manual-procurement`,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/supplier-scorecards-what-to-track-and-why`,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/why-weekly-reports-are-usually-too-late`,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/the-real-cost-of-poor-stock-control`,
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: `${BASE_URL}/learn/ai-for-small-and-medium-businesses-practical-use-cases`,
      changeFrequency: "monthly",
      priority: 0.55,
    },

    // Resources.
    {
      url: `${BASE_URL}/resources`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/resources/operations-audit-checklist`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/resources/weekly-operations-report-template`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/resources/supplier-scorecard`,
      changeFrequency: "monthly",
      priority: 0.6,
    },

    // Interactive tools.
    {
      url: `${BASE_URL}/roi-calculator`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/operations-audit`,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // Integrations + pricing FAQ.
    {
      url: `${BASE_URL}/integrations`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/pricing-faq`,
      changeFrequency: "monthly",
      priority: 0.7,
    },

    // Comparisons.
    {
      url: `${BASE_URL}/compare`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/compare/vyso-vs-spreadsheets`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/compare/vyso-vs-erp-systems`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
