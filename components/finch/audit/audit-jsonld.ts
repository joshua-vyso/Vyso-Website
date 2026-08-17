/* ── /operations-audit structured data ───────────────────────────────────────
   One `@graph` for the page: Service · FAQPage · HowTo · BreadcrumbList.

   Every string is read from `audit-content.ts`, which is what the page renders,
   so the schema cannot drift from the visible text (a hidden Q&A is a manual
   action waiting to happen).

   The Service deliberately reuses the sitewide graph's `#audit` @id rather than
   minting a page-scoped one: same @id means the two nodes merge into a single
   entity, where a second id would assert that Vyso sells two different audits.
   The price lives in the sitewide node only, for the same reason — one offer,
   stated once. Everything else here is page-scoped (`#faq`, `#howto`,
   `#breadcrumbs`) and cannot collide. */

import { AUDIT_FAQS, AUDIT_STEPS, CANONICAL_URL, DIRECT_ANSWER, PRICE } from "./audit-content";

const ORIGIN = "https://vyso.co.za";

/* ── The two tool pages ──────────────────────────────────────────────────────
   `/operations-audit/score` and `/operations-audit/calculator` carry a
   `BreadcrumbList` and nothing else. Deliberately nothing else: neither tool
   asks a question the page answers in prose, so there is no FAQ to mark up,
   and neither is a `SoftwareApplication` in any sense a search engine should
   be told about — they are two forms that do arithmetic in the browser.

   The trail is three deep (Home › Operations Audit › this page), which is what
   makes the parent page the thing that ranks and these the pages that support
   it rather than compete with it. */
export function buildAuditToolSchema({ url, name }: { url: string; name: string }) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Operations Audit", item: CANONICAL_URL },
          { "@type": "ListItem", position: 3, name, item: url },
        ],
      },
    ],
  };
}

export function buildAuditSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${ORIGIN}/#audit`,
        name: "Operations Audit",
        serviceType: "Operations audit",
        description: DIRECT_ANSWER,
        url: CANONICAL_URL,
        provider: { "@id": `${ORIGIN}/#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${CANONICAL_URL}#faq`,
        mainEntity: AUDIT_FAQS.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
      {
        "@type": "HowTo",
        "@id": `${CANONICAL_URL}#howto`,
        name: "How the Operations Audit works",
        description: DIRECT_ANSWER,
        totalTime: "P7D",
        estimatedCost: {
          "@type": "MonetaryAmount",
          currency: PRICE.currency,
          value: String(PRICE.audit),
        },
        step: AUDIT_STEPS.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.label.charAt(0) + s.label.slice(1).toLowerCase(),
          text: s.text,
          url: `${CANONICAL_URL}#step-${s.n}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${CANONICAL_URL}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          { "@type": "ListItem", position: 2, name: "Operations Audit", item: CANONICAL_URL },
        ],
      },
    ],
  };
}
