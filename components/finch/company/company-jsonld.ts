/* ── Structured data for the company cluster ─────────────────────────────────
   One `@graph`-shaped builder per page in this workstream, same pattern as
   `components/finch/pricing/pricing-jsonld.ts` / `compare/compare-jsonld.ts`:
   page-scoped nodes only (`BreadcrumbList` + whatever the page itself needs).
   `Organization`/`WebSite`/`SoftwareApplication` stay in `app/layout.tsx`'s
   sitewide graph; every node below references `#organization` rather than
   redeclaring it. Nothing here asserts a fact the page doesn't render — the
   FAQPage entities are read straight off the same arrays the pages render. */

import type { FaqItem } from "@/lib/marketing/faq";
import { CANONICAL_URL as FOUNDING_URL, FOUNDING_FAQS } from "@/lib/marketing/founding";

const ORIGIN = "https://vyso.co.za";
const ORG_ID = `${ORIGIN}/#organization`;

function faqEntities(items: readonly FaqItem[]) {
  return items.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  }));
}

/* ── /founding-client ────────────────────────────────────────────────────── */
export function buildFoundingSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${FOUNDING_URL}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Founding client", item: FOUNDING_URL },
        ],
      },
      {
        "@type": "Service",
        "@id": `${FOUNDING_URL}#service`,
        name: "Vyso founding-client programme",
        serviceType: "Operations software implementation and structured product partnership",
        provider: { "@id": ORG_ID },
        areaServed: { "@type": "Country", name: "South Africa" },
      },
      {
        "@type": "FAQPage",
        "@id": `${FOUNDING_URL}#faq`,
        mainEntity: faqEntities(FOUNDING_FAQS),
      },
    ],
  };
}

/* ── /case-studies ───────────────────────────────────────────────────────── */
export function buildCaseStudiesHubSchema() {
  const url = `${ORIGIN}/case-studies`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Case studies", item: url },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Turn 'n Slice",
            url: `${ORIGIN}/case-studies/turn-n-slice`,
          },
        ],
      },
    ],
  };
}

/* ── /case-studies/turn-n-slice ──────────────────────────────────────────────
   `Article`, not `Review`: no `aggregateRating`, no star rating, ever — this
   is a documented implementation, not a testimonial with a score. `about`
   names Turn 'n Slice as its own `Organization` node (a real business, not a
   fabricated one), separate from `author`/`publisher`, which are Vyso. */
export function buildTurnNSliceSchema() {
  const url = `${ORIGIN}/case-studies/turn-n-slice`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
          {
            "@type": "ListItem",
            position: 2,
            name: "Food suppliers",
            item: `${ORIGIN}/industries/food-suppliers`,
          },
          { "@type": "ListItem", position: 3, name: "Turn 'n Slice", item: url },
        ],
      },
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: "How OrderFlow is replacing QuickBooks for Turn 'n Slice invoicing",
        genre: "Case study",
        image: `${ORIGIN}/turn-n-slice-logo-clean.png`,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        about: {
          "@type": "Organization",
          name: "Turn 'n Slice",
          industry: "FMCG food preparation and supply",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Johannesburg",
            addressCountry: "ZA",
          },
        },
      },
    ],
  };
}

/* ── /south-africa ───────────────────────────────────────────────────────── */
export function buildSouthAfricaSchema(faqs: readonly FaqItem[]) {
  const url = `${ORIGIN}/south-africa`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "South Africa", item: url },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: "Finch by Vyso for South African operations",
        provider: { "@id": ORG_ID },
        areaServed: { "@type": "Country", name: "South Africa" },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqEntities(faqs),
      },
    ],
  };
}
