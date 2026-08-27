/* ── /how-it-works structured data ───────────────────────────────────────────
   One `@graph`, one node: a `BreadcrumbList`, following the pattern every other
   marketing route on this site already uses (`components/finch/audit/
   audit-jsonld.ts`, `components/finch/solutions/solutions-jsonld.ts`) — a
   two-deep trail whose `@id` is page-scoped so it cannot collide with the
   sitewide graph in `app/layout.tsx`.

   ── Why there is no FAQPage here, deliberately ──────────────────────────────
   The page's three comparison blocks (`HowDifferences`) are exactly the shape
   `FAQPage` wants, and marking them up would be valid. They are not marked up
   because `/faq` carries the same three questions (brief §41 names all three),
   and two pages on one domain claiming `FAQPage` for the same question text
   asks Google to choose between them for the same rich result. The rewritten
   `/faq` is the page that should win that, so it is the page that gets the
   markup. The answers here stay plain, crawlable prose, which is what the AEO
   requirement (plan §8) actually needs; rich-result eligibility is a separate
   thing and it belongs to one page, not two.

   If `/faq` ever drops one of the three, this is where its markup should move. */

const ORIGIN = "https://vyso.co.za";

export const HOW_IT_WORKS_CANONICAL_URL = `${ORIGIN}/how-it-works`;

export function buildHowItWorksSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${HOW_IT_WORKS_CANONICAL_URL}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: ORIGIN },
          {
            "@type": "ListItem",
            position: 2,
            name: "How it works",
            item: HOW_IT_WORKS_CANONICAL_URL,
          },
        ],
      },
    ],
  };
}
