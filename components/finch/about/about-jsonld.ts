/* ── /about structured data ───────────────────────────────────────────────────
   `Organization` and `WebSite` already come from the sitewide graph in
   `app/layout.tsx` — minting `Organization` again here would assert a second
   entity (same convention as `compare-jsonld.ts`, `audit-jsonld.ts`). What
   this page adds is the `Person` entity for the founder, using the SAME
   `@id` the root layout already mints (`${SITE.url}/#josh`) so the two nodes
   merge rather than describe two different people, enriched with `sameAs`
   from `SITE.sameAs` (omitted while empty — see `lib/marketing/site.ts`'s own
   comment on why an empty array is not published) and `worksFor` pointing at
   the sitewide Organization. Plus this page's own `BreadcrumbList`. */

import { SITE } from "@/lib/marketing/site";

export function buildAboutSchema() {
  const url = `${SITE.url}/about`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${SITE.url}/#josh`,
        name: SITE.founder.name,
        jobTitle: SITE.founder.jobTitle,
        url,
        worksFor: { "@id": `${SITE.url}/#organization` },
        address: {
          "@type": "PostalAddress",
          addressLocality: SITE.address.addressLocality,
          addressCountry: SITE.address.addressCountry,
        },
        ...(SITE.sameAs.length > 0 ? { sameAs: SITE.sameAs } : {}),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "About", item: url },
        ],
      },
    ],
  };
}
