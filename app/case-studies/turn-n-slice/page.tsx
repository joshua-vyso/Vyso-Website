import type { Metadata } from "next";
import Link from "next/link";

import { CaseTemplate } from "@/components/vyso/case/CaseTemplate";
import { PriceListPeek } from "@/components/vyso/case/PriceListPeek";
import { TURN_N_SLICE } from "@/components/vyso/case/turn-n-slice-data";
import { Shell } from "@/components/vyso/Shell";
import { SITE } from "@/lib/marketing/site";

/* ── /case-studies/turn-n-slice ──────────────────────────────────────────────
   Plan §7.6, brief §37. Every fact here is preserved from the pre-redesign
   page (see `components/vyso/case/turn-n-slice-data.ts`'s own header for the
   two things that changed and why: the module codename and the "founding
   client" phrase, neither of which is a fact). "Turn 'n Slice" is the house
   spelling throughout, including in the `<title>` and URL slug, which stays
   `turn-n-slice` for the existing link equity. */

const TITLE = "Turn 'n Slice case study: replacing invoicing admin";
const DESCRIPTION =
  "How Turn 'n Slice, a Johannesburg fresh produce wholesaler and Vyso's first client, replaced QuickBooks invoicing with one connected order and invoicing workflow.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/case-studies/turn-n-slice` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/case-studies/turn-n-slice`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "article",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const url = `${SITE.url}/case-studies/turn-n-slice`;

const JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Case studies", item: `${SITE.url}/case-studies` },
        { "@type": "ListItem", position: 3, name: "Turn 'n Slice", item: url },
      ],
    },
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline: TITLE,
      description: DESCRIPTION,
      about: { "@type": "Organization", name: "Turn 'n Slice" },
      author: { "@id": `${SITE.url}/#organization` },
      publisher: { "@id": `${SITE.url}/#organization` },
    },
  ],
};

export default function TurnNSliceCaseStudyPage() {
  return (
    <Shell active="case-studies">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="mx-auto max-w-[var(--vy-content)] px-[var(--vy-gutter)] pt-[24px] md:px-[40px]">
        <ol className="m-0 flex list-none flex-wrap items-center gap-[6px] p-0 text-[12px] text-[color:var(--vy-ink-4)]">
          <li>
            <Link href="/" className="hover:text-[color:var(--vy-ink-2)]">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/case-studies" className="hover:text-[color:var(--vy-ink-2)]">Case studies</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[color:var(--vy-ink-3)]">Turn &apos;n Slice</li>
        </ol>
      </nav>

      <CaseTemplate data={{ ...TURN_N_SLICE, demo: <PriceListPeek /> }} />
    </Shell>
  );
}
