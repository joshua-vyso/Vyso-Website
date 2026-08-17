import { SITE } from "@/lib/marketing/site";
import { HUB, SOLUTION_LIST, type Solution } from "@/lib/marketing/solutions";

/* ── /solutions structured data ──────────────────────────────────────────────
   Both builders read the same objects the pages render, so the schema can
   never claim something the page doesn't say. Server-only by construction —
   `lib/marketing/solutions.ts` imports nothing with `"use client"`.

   `@id`s are page-scoped (`…/solutions/<slug>#service`) and deliberately do
   NOT reuse the sitewide `#finch` node from `app/layout.tsx`: these describe
   the implementation service Vyso sells around a problem, not the product.  */

const ORG = { "@id": `${SITE.url}/#organization` };

export function buildSolutionsHubSchema() {
  const url = `${SITE.url}/solutions`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Solutions", item: url },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: HUB.title,
        itemListElement: SOLUTION_LIST.map((solution, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: solution.shortName,
          url: `${url}/${solution.slug}`,
        })),
      },
    ],
  };
}

export function buildSolutionSchema(solution: Solution) {
  const url = `${SITE.url}/solutions/${solution.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Solutions", item: `${SITE.url}/solutions` },
          { "@type": "ListItem", position: 3, name: solution.shortName, item: url },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `${solution.name} with Finch`,
        serviceType: "Operations software and implementation",
        description: solution.description,
        provider: ORG,
        areaServed: { "@type": "Country", name: "South Africa" },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        /* Mirrors the visible `<dl>` exactly — no hidden Q&As (§7.4). */
        mainEntity: solution.faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}
