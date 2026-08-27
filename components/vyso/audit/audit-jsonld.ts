/* ── /operations-audit structured data ───────────────────────────────────────
   One `@graph`: `Service` · `HowTo` · `BreadcrumbList`. Every string is read
   from `audit-content.ts`, which is what the page renders, so the schema cannot
   drift from the visible text.

   The `Service` deliberately reuses the sitewide graph's `#audit` @id rather
   than minting a page-scoped one: the same @id means the two nodes merge into
   one entity, where a second id would assert that Vyso sells two different
   audits. The zero-price `Offer` stays in the sitewide node only, stated once
   (`app/layout.tsx`) — and it is the ONLY price anywhere in this site's
   structured data, because the audit is genuinely free and what follows it is
   scoped per problem and quoted privately (plan §3.1).

   No `FAQPage` here: the rewritten `/faq` owns that markup for the site, and
   this page asks no question it answers in a Q&A shape anyway. */

import { AUDIT_CANONICAL_URL, AUDIT_STEPS, DIRECT_ANSWER } from "./audit-content";

const ORIGIN = "https://vyso.co.za";

/* ── The two tool pages ──────────────────────────────────────────────────────
   `/operations-audit/score` and `/operations-audit/calculator` carry a
   `BreadcrumbList` and nothing else, mirroring the Phase 0 era
   `components/finch/audit/audit-jsonld.ts#buildAuditToolSchema` this replaces
   now that both tool pages render on the `--vy-*` shell (Phase 5). Neither tool
   asks a question the page answers in prose, so there is no FAQ to mark up,
   and neither is a `SoftwareApplication` in any sense worth telling a search
   engine — they are two forms that do arithmetic in the browser.

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
          { "@type": "ListItem", position: 2, name: "Operations Audit", item: AUDIT_CANONICAL_URL },
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
        name: "Free operations audit",
        serviceType: "Operations audit",
        description: DIRECT_ANSWER,
        url: AUDIT_CANONICAL_URL,
        provider: { "@id": `${ORIGIN}/#organization` },
        areaServed: "ZA",
      },
      {
        "@type": "HowTo",
        "@id": `${AUDIT_CANONICAL_URL}#howto`,
        name: "How the free operations audit works",
        description: DIRECT_ANSWER,
        /* About an hour, and free. A zero `estimatedCost` is the valid way to
           state "free"; what follows the audit is not in this graph at all. */
        totalTime: "PT1H",
        estimatedCost: {
          "@type": "MonetaryAmount",
          currency: "ZAR",
          value: "0",
        },
        step: AUDIT_STEPS.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.label,
          text: s.text,
          url: `${AUDIT_CANONICAL_URL}#step-${s.n}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${AUDIT_CANONICAL_URL}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          {
            "@type": "ListItem",
            position: 2,
            name: "Operations Audit",
            item: AUDIT_CANONICAL_URL,
          },
        ],
      },
    ],
  };
}
