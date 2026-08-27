import type { Metadata } from "next";
import Link from "next/link";

import { HUB, INDUSTRY_LIST } from "@/lib/marketing/industries";
import { IndustryCard } from "@/components/vyso/industries/IndustryCard";
import { Button } from "@/components/vyso/Button";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";
import { SITE } from "@/lib/marketing/site";

/* ── /industries ──────────────────────────────────────────────────────────────
   Plan §7.5. Three verticals, one hub. Not in the nav (plan §5), reachable
   from the footer and from internal links, which is what it is worth. */

export const metadata: Metadata = {
  title: HUB.title,
  description: HUB.description,
  alternates: { canonical: `${SITE.url}/industries` },
  openGraph: {
    title: HUB.title,
    description: HUB.description,
    url: `${SITE.url}/industries`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: HUB.title, description: HUB.description },
};

const url = `${SITE.url}/industries`;

const JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
        { "@type": "ListItem", position: 2, name: "Industries", item: url },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${url}#list`,
      name: HUB.title,
      itemListElement: INDUSTRY_LIST.map((industry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: industry.shortName,
        url: `${url}/${industry.slug}`,
      })),
    },
  ],
};

export default function IndustriesPage() {
  return (
    <Shell active="none">
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
          <li className="text-[color:var(--vy-ink-3)]">Industries</li>
        </ol>
      </nav>

      <Section
        headingLevel={1}
        eyebrow={HUB.eyebrow}
        heading={HUB.h1Plain}
        continuation={HUB.h1Accent}
        lead={HUB.lead}
        width="narrow"
      />

      <Section id="verticals" divider>
        <ul className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-3">
          {INDUSTRY_LIST.map((industry) => (
            <li key={industry.slug}>
              <IndustryCard industry={industry} />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="start"
        ground="dark"
        spacing="loose"
        align="center"
        heading="Don't see your operation here?"
        lead="The audit works the same way regardless. Tell us how your business runs and we'll tell you honestly what we find."
      >
        <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "industries-hub" }}
          >
            Get a free Operations Audit
          </Button>
        </div>
      </Section>
    </Shell>
  );
}
