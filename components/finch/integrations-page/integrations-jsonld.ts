/* ── `/integrations` structured data ─────────────────────────────────────────
   One `@graph`: BreadcrumbList + FAQPage, same shape as `pricing-jsonld.ts` /
   `audit-jsonld.ts`. FAQ entities are read straight off `INTEGRATIONS_FAQS`,
   so the schema can't say anything the page itself doesn't render. */

import { INTEGRATIONS_FAQS } from "@/lib/marketing/integrations";

const ORIGIN = "https://vyso.co.za";
const CANONICAL_URL = `${ORIGIN}/integrations`;

export function buildIntegrationsSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${CANONICAL_URL}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Integrations", item: CANONICAL_URL },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${CANONICAL_URL}#faq`,
        mainEntity: INTEGRATIONS_FAQS.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}
