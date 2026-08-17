import { HUB, INDUSTRY_LIST, type Industry } from "@/lib/marketing/industries";
import { SITE } from "@/lib/marketing/site";

/* ── /industries structured data ─────────────────────────────────────────────
   Both builders read the same objects the pages render, so the schema can never
   claim something the page doesn't say. Server-only by construction —
   `lib/marketing/industries.ts` imports nothing with `"use client"`.

   `@id`s are page-scoped (`…/industries/<slug>#service`) and deliberately do
   NOT reuse the sitewide `#finch` node from `app/layout.tsx`: these describe the
   service Vyso sells to a kind of business, not the product.

   The `ItemList` carries all eight verticals including the two experimental
   ones — they are indexed pages, linked from this hub, and hiding them from the
   list while linking them on the page would be the schema and the markup
   telling a crawler two different things.                                     */

const ORG = { "@id": `${SITE.url}/#organization` };

export function buildIndustriesHubSchema() {
  const url = `${SITE.url}/industries`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Industries", item: url },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: HUB.title,
        itemListElement: INDUSTRY_LIST.map((industry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: industry.shortName,
          url: `${url}/${industry.slug}`,
        })),
      },
    ],
  };
}

export function buildIndustrySchema(industry: Industry) {
  const url = `${SITE.url}/industries/${industry.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Industries", item: `${SITE.url}/industries` },
          { "@type": "ListItem", position: 3, name: industry.shortName, item: url },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `${industry.name} with Finch`,
        serviceType: "Operations software and implementation",
        description: industry.description,
        provider: ORG,
        areaServed: { "@type": "Country", name: "South Africa" },
        audience: { "@type": "BusinessAudience", audienceType: industry.shortName },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        /* Mirrors the visible `<dl>` exactly — no hidden Q&As (§7.4). */
        mainEntity: industry.faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}
