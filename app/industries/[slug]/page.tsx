import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { INDUSTRY_ORDER, getIndustry } from "@/lib/marketing/industries";
import { IndustryBody } from "@/components/vyso/industries/IndustryBody";
import { Shell } from "@/components/vyso/Shell";
import { SITE } from "@/lib/marketing/site";

/* ── /industries/[slug] ──────────────────────────────────────────────────────
   Plan §7.5. Three verticals: `food-suppliers` (retitled "Food distributors
   and fresh produce", the deepest page), `wholesale` (retitled
   "Wholesalers"), `hospitality`. All three slugs are the existing live URLs,
   kept for SEO equity — nothing here is a new route. */

export function generateStaticParams() {
  return INDUSTRY_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) return {};

  const url = `${SITE.url}/industries/${slug}`;
  return {
    title: industry.title,
    description: industry.description,
    alternates: { canonical: url },
    openGraph: {
      title: industry.title,
      description: industry.description,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: industry.title,
      description: industry.description,
    },
  };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) notFound();

  const url = `${SITE.url}/industries/${slug}`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Industries", item: `${SITE.url}/industries` },
          { "@type": "ListItem", position: 3, name: industry.shortName, item: url },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `${industry.name} with Vyso`,
        serviceType: "Operational automation and implementation",
        description: industry.description,
        provider: { "@id": `${SITE.url}/#organization` },
        areaServed: { "@type": "Country", name: "South Africa" },
        audience: { "@type": "BusinessAudience", audienceType: industry.shortName },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: industry.faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };

  return (
    <Shell active="none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="Breadcrumb" className="mx-auto max-w-[var(--vy-content)] px-[var(--vy-gutter)] pt-[24px] md:px-[40px]">
        <ol className="m-0 flex list-none flex-wrap items-center gap-[6px] p-0 text-[12px] text-[color:var(--vy-ink-3)]">
          <li>
            <Link href="/" className="hover:text-[color:var(--vy-ink-2)]">Home</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/industries" className="hover:text-[color:var(--vy-ink-2)]">Industries</Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[color:var(--vy-ink-3)]">{industry.shortName}</li>
        </ol>
      </nav>

      <IndustryBody industry={industry} />
    </Shell>
  );
}
