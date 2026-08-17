/* ── /pricing structured data ────────────────────────────────────────────────
   One `<script type="application/ld+json">` for the whole page (a `@graph`, the
   same shape `app/layout.tsx` uses) — Product + FAQPage + BreadcrumbList.

   Everything numeric or quotable is read from `pricing-data.ts`, so the schema
   cannot drift from what the page renders. Nothing is asserted that the page
   does not show: no aggregateRating, no reviews, no fabricated availability
   dates. Offers carry a `UnitPriceSpecification` because "R6,000" alone is
   ambiguous — the unit is a location-month, and that is the fact answer engines
   need to quote us correctly. */

import {
  CANONICAL_URL,
  DIRECT_ANSWER,
  PRICE,
  STRAIGHT_ANSWERS,
} from "./pricing-data";

const ORIGIN = "https://vyso.co.za";

/** A price with its unit spelled out: per <unitText>, optionally per month. */
function unitPricedOffer(opts: {
  name: string;
  description: string;
  price: number;
  /** What one unit of the price covers: "location", "seat". */
  unitText: string;
  /** UN/CEFACT code — "MON" for the monthly subscription. Omitted for the
      once-off Academy seat, which is not billed by the month. */
  unitCode?: "MON";
  availability: "InStock" | "PreOrder";
}) {
  return {
    "@type": "Offer",
    name: opts.name,
    description: opts.description,
    price: String(opts.price),
    priceCurrency: PRICE.currency,
    availability: `https://schema.org/${opts.availability}`,
    url: CANONICAL_URL,
    eligibleRegion: { "@type": "Country", name: "ZA" },
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: opts.price,
      priceCurrency: PRICE.currency,
      ...(opts.unitCode ? { unitCode: opts.unitCode } : {}),
      referenceQuantity: {
        "@type": "QuantitativeValue",
        value: 1,
        unitText: opts.unitText,
      },
    },
  };
}

export function buildPricingSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${CANONICAL_URL}#finch`,
        name: "Finch",
        description: DIRECT_ANSWER,
        url: CANONICAL_URL,
        brand: { "@type": "Brand", name: "Vyso" },
        offers: [
          unitPricedOffer({
            name: "Finch",
            description:
              "Every module and agent, activated in priority order from your operations audit, plus a monthly ops review with your Vyso lead.",
            price: PRICE.finch,
            unitText: "location",
            unitCode: "MON",
            availability: "InStock",
          }),
          {
            /* The audit is a one-week engagement, not a subscription, so it gets
               a plain price rather than a per-month unit spec. */
            "@type": "Offer",
            name: "Operations Audit",
            description:
              "A one-week Operations Audit: where the money is leaking, in rand, with the evidence attached. Credited to your first month of Finch.",
            price: String(PRICE.audit),
            priceCurrency: PRICE.currency,
            availability: "https://schema.org/InStock",
            url: CANONICAL_URL,
            eligibleRegion: { "@type": "Country", name: "ZA" },
          },
          unitPricedOffer({
            name: "Vyso Academy",
            description:
              "Workshops, templates and the weekly-brief discipline, taught to your team. Coming soon.",
            price: PRICE.academySeat,
            unitText: "seat",
            availability: "PreOrder",
          }),
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${CANONICAL_URL}#faq`,
        mainEntity: STRAIGHT_ANSWERS.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${CANONICAL_URL}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Pricing", item: CANONICAL_URL },
        ],
      },
    ],
  };
}
