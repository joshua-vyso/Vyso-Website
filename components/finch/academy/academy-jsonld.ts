/* ── /academy structured data ─────────────────────────────────────────────────
   Breadcrumb only. `.ai/vyso_v2.md` §2.3 is explicit: no `Course` schema
   until Academy is real ("NO Course schema until real; Breadcrumb only") —
   Academy is COMING SOON with no curriculum, no dates and no seats sold, so
   asserting a `Course`/`Offer` entity would tell search engines and AI
   crawlers something not yet true. `Organization`/`WebSite` already come
   from the sitewide graph in `app/layout.tsx`. */

import { SITE } from "@/lib/marketing/site";

export function buildAcademySchema() {
  const url = `${SITE.url}/academy`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Academy", item: url },
        ],
      },
    ],
  };
}
