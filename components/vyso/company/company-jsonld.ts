/* ── Structured data for the redesigned company pages ────────────────────────
   `/contact` and `/south-africa`'s own JSON-LD, kept as a fresh, small module
   rather than importing `components/finch/company/company-jsonld.ts`: that
   file's `buildSouthAfricaSchema` is fine on its own, but the module also
   imports `lib/marketing/founding.ts` (a page slated for deletion in Phase 4,
   `.ai/plan_vyso_redesign_2026.md` §11) to build `buildFoundingSchema`, and
   pulling in that coupling here just to reuse one function is the wrong
   trade. `Organization`/`WebSite`/`ProfessionalService` stay in
   `app/layout.tsx`'s sitewide graph; every node below references
   `#organization` rather than redeclaring it. Nothing here asserts a fact the
   page doesn't render: the FAQPage entities are read straight off whichever
   `FaqItem[]` the page itself displays. `/about` keeps using
   `components/finch/about/about-jsonld.ts`, which has no such coupling
   (it only imports `lib/marketing/site.ts`). */

import type { FaqItem } from "@/lib/marketing/faq";

const ORIGIN = "https://vyso.co.za";
const ORG_ID = `${ORIGIN}/#organization`;

function faqEntities(items: readonly FaqItem[]) {
  return items.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  }));
}

/* ── /contact ─────────────────────────────────────────────────────────────── */
export function buildContactSchema() {
  const url = `${ORIGIN}/contact`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ContactPage",
        "@id": `${url}#webpage`,
        url,
        about: { "@id": ORG_ID },
        breadcrumb: { "@id": `${url}#breadcrumbs` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Contact", item: url },
        ],
      },
    ],
  };
}

/* ── /south-africa ────────────────────────────────────────────────────────── */
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
        "@type": "ProfessionalService",
        "@id": `${url}#service`,
        name: "Vyso operations automation for South African businesses",
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
