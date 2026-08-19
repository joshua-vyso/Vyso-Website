import { SITE } from "@/lib/marketing/site";
import { ORBIT } from "@/lib/orbit/site";

/* ── Orbit's structured data ─────────────────────────────────────────────────
   One builder per page shape, all emitting the same `@graph` form the rest of
   the site uses (`app/layout.tsx`, `app/faq/page.tsx`,
   `components/finch/pricing/pricing-jsonld.ts`).

   Three rules the whole file exists to keep:

   1. **The Organization is never redeclared.** The root layout already emits
      `${SITE.url}/#organization`, and that node is on every page including
      these — a second, subtly different Organization on the subsite is how a
      knowledge panel ends up describing two companies. Everything here
      *references* it by `@id`.
   2. **`availability` is `PreOrder`, everywhere a price appears.** Orbit is not
      purchasable. `InStock` on an unreleased product is the single most
      consequential lie this file could tell, because it is the one a shopping
      surface would act on. schema.org's `PreOrder` is the correct term for
      "announced, priced, not yet released", and it is used with no
      `priceValidUntil` because there is no launch date to bound it with.
   3. **Nothing is asserted that the page does not render.** Every FAQ entity
      is built from the same array the page maps over; every breadcrumb name is
      the page's own H1 or nav label. There is no hand-typed schema copy.       */

const ORG = { "@id": `${SITE.url}/#organization` };

/** The Orbit product node. One `@id` for the whole subsite, so a page that
    references the product and a page that declares it agree. */
export const ORBIT_ID = `${ORBIT.url}#orbit`;

type Json = Record<string, unknown>;

export function orbitProductNode(): Json {
  return {
    "@type": "SoftwareApplication",
    "@id": ORBIT_ID,
    name: "Orbit",
    alternateName: "Orbit by Vyso",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Field service and invoicing",
    operatingSystem: "WhatsApp (Android, iOS)",
    url: ORBIT.url,
    description: ORBIT.description,
    inLanguage: "en-ZA",
    provider: ORG,
    publisher: ORG,
    areaServed: { "@type": "Country", name: "South Africa" },
    audience: {
      "@type": "BusinessAudience",
      audienceType: "Tradespeople and small trade businesses in South Africa",
    },
    releaseNotes: ORBIT.status,
    offers: {
      "@type": "Offer",
      url: `${ORBIT.url}/pricing`,
      price: String(ORBIT.price.amount),
      priceCurrency: ORBIT.price.currency,
      // See rule 2 in the header. Orbit cannot be bought today.
      availability: "https://schema.org/PreOrder",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: ORBIT.price.amount,
        priceCurrency: ORBIT.price.currency,
        unitCode: "MON",
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: 1,
          unitText: "tradesperson",
        },
      },
    },
  };
}

export function breadcrumbNode(url: string, trail: [string, string][]): Json {
  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumbs`,
    itemListElement: trail.map(([name, item], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: item.startsWith("http") ? item : `${SITE.url}${item}`,
    })),
  };
}

export function faqNode(url: string, questions: { question: string; answer: string }[]): Json {
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

export function webPageNode(url: string, name: string, description: string, extra: Json = {}): Json {
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: "en-ZA",
    isPartOf: { "@id": `${SITE.url}/#website` },
    about: { "@id": ORBIT_ID },
    publisher: ORG,
    ...extra,
  };
}

/** The graph wrapper. Every page calls this once and renders the result. */
export function orbitGraph(nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** `JSON.stringify` with `<` escaped, matching how every other page on the
    site injects a graph — a `</script>` inside a string would otherwise close
    the tag early. */
export function jsonLd(graph: Json): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}

/* ── `/orbit/how-it-works` ───────────────────────────────────────────────────
   A `HowTo`. Legitimately so: the page really is a set of ordered steps a
   person performs, which is the only thing `HowTo` should ever be used for.
   No `estimatedCost` and no `totalTime` — both would be invented. */
export function howToNode(url: string, steps: { name: string; text: string }[]): Json {
  return {
    "@type": "HowTo",
    "@id": `${url}#howto`,
    name: "How to run your trade from WhatsApp with Orbit",
    description:
      "Text Orbit what you did and what you charged. It records the job, keeps the costs against it and drafts the invoice for you to check and send.",
    inLanguage: "en-ZA",
    step: steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

/* ── `/orbit/learn/[slug]` ───────────────────────────────────────────────── */
export function articleNode(
  url: string,
  article: { title: string; standfirst: string; datePublished: string; dateModified: string },
): Json {
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: article.title,
    description: article.standfirst,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    inLanguage: "en-ZA",
    /* The organisation is the author. There is no by-line on these pieces, and
       inventing a `Person` to satisfy a schema validator would be exactly the
       kind of fiction this codebase refuses elsewhere. */
    author: ORG,
    publisher: ORG,
    isPartOf: { "@id": `${SITE.url}/#website` },
    about: { "@id": ORBIT_ID },
    mainEntityOfPage: url,
  };
}

/* ── `/orbit/pricing` ────────────────────────────────────────────────────────
   A `Product` alongside the `SoftwareApplication`, because a pricing page is
   the one place a shopping surface looks for one — same offer, same
   `PreOrder`, `isSimilarTo` linking the two so they are not read as two
   different things for sale. */
export function pricingProductNode(url: string): Json {
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: "Orbit",
    description: ORBIT.description,
    brand: { "@type": "Brand", name: "Vyso" },
    category: "Business software subscription",
    isSimilarTo: { "@id": ORBIT_ID },
    offers: {
      "@type": "Offer",
      url,
      price: String(ORBIT.price.amount),
      priceCurrency: ORBIT.price.currency,
      availability: "https://schema.org/PreOrder",
      seller: ORG,
      eligibleRegion: { "@type": "Country", name: "South Africa" },
    },
  };
}
