/* ── /compare structured data ────────────────────────────────────────────────
   One `@graph` per page: `BreadcrumbList`, plus `FAQPage` where the page has
   FAQs and `ItemList` on the hub. Same shape as `audit-jsonld.ts` /
   `pricing-jsonld.ts`, and every string is read from `lib/marketing/compare.ts`
   — the file the pages render from — so the schema cannot drift from the
   visible text.

   `Organization`, `WebSite` and the `SoftwareApplication` for Finch already
   come from the sitewide graph in `app/layout.tsx`; minting them again here
   would assert a second entity, so this file stays page-scoped.               */

import { COMPARE_ORIGIN, type CompareFaq, type Crumb } from "@/lib/marketing/compare";

type Graph = Record<string, unknown>;

function breadcrumbList(canonical: string, trail: readonly Crumb[]): Graph {
  return {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumbs`,
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.label,
      item: `${COMPARE_ORIGIN}${crumb.href === "/" ? "" : crumb.href}`,
    })),
  };
}

function faqPage(canonical: string, faqs: readonly CompareFaq[]): Graph {
  return {
    "@type": "FAQPage",
    "@id": `${canonical}#faq`,
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/** A comparison sub-page: breadcrumbs + its four questions. */
export function buildCompareSchema({
  canonical,
  trail,
  faqs,
}: {
  canonical: string;
  trail:     readonly Crumb[];
  faqs:      readonly CompareFaq[];
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [breadcrumbList(canonical, trail), faqPage(canonical, faqs)],
  };
}

/** The hub: breadcrumbs + the three comparisons as an ordered list. */
export function buildCompareHubSchema({
  canonical,
  trail,
  items,
}: {
  canonical: string;
  trail:     readonly Crumb[];
  items:     readonly { href: string; title: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      breadcrumbList(canonical, trail),
      {
        "@type": "ItemList",
        "@id": `${canonical}#comparisons`,
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.title,
          url: `${COMPARE_ORIGIN}${item.href}`,
        })),
      },
    ],
  };
}
