import { SITE } from "@/lib/marketing/site";
import { HUB, SOLUTION_LIST, type Solution } from "@/lib/marketing/solutions";

/* ── /solutions structured data ──────────────────────────────────────────────
   Rebuilt on the Vyso entity (`.ai/plan_vyso_redesign_2026.md` §8): the
   `Service` nodes reference `${SITE.url}/#organization`, the SAME `@id`
   `app/layout.tsx`'s graph declares, rather than inventing a second entity —
   the pattern the file this replaces got right, just pointed at the wrong
   company. Both builders read the exact objects the pages render, so the
   schema can never claim something the page doesn't say. */

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
        name: solution.name,
        serviceType: "Operations automation and implementation",
        description: solution.description,
        provider: ORG,
        areaServed: { "@type": "Country", name: "South Africa" },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        /* Mirrors the visible `<dl>` exactly, no hidden Q&As (plan §7.4). */
        mainEntity: solution.faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}
