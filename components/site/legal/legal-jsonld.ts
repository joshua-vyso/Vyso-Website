/* ── Legal page structured data ──────────────────────────────────────────────
   `/privacy`, `/terms`, `/popia` all render the same small graph: `WebPage` +
   `BreadcrumbList`. `Organization`/`WebSite` already come from the sitewide
   graph in `app/layout.tsx` — minting them again here would assert a second
   entity, so this stays page-scoped (same convention as `compare-jsonld.ts`,
   `audit-jsonld.ts`). */

import { SITE } from "@/lib/marketing/site";

export function buildLegalSchema({
  path,
  name,
  description,
}: {
  /** e.g. "/privacy" */
  path: string;
  name: string;
  description: string;
}) {
  const url = `${SITE.url}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name,
        description,
        isPartOf: { "@id": `${SITE.url}/#website` },
        inLanguage: SITE.locale,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name, item: url },
        ],
      },
    ],
  };
}
