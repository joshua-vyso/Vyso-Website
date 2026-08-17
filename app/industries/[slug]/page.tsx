import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import {
  ExperimentalNote,
  IndustryAudit,
  IndustryFaqs,
  IndustryGaps,
  IndustryHero,
  IndustryModules,
  IndustryRelated,
  WhatFinchWatchesHere,
} from "@/components/finch/industries/IndustrySections";
import { buildIndustrySchema } from "@/components/finch/industries/industries-jsonld";
import { INDUSTRY_ORDER, getIndustry } from "@/lib/marketing/industries";
import { SITE } from "@/lib/marketing/site";

/* `/industries/[slug]` in the Finch design language. The content moved to
   `lib/marketing/industries.ts` (Phase 3, workstream A) — this file used to
   hold the whole `INDUSTRIES` object inline, which meant the hub could not
   read a word of it without importing a route module.

   Eight verticals: six primary, plus `security-companies` and
   `insurance-brokers`, which are indexed and in the sitemap but linked only
   from the hub's "Also watching" row (`.ai/vyso_v2.md` §2.2). */

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
    /* Plain string, not `absolute`: the root layout's `%s | Vyso` template
       supplies the suffix and these titles don't carry it themselves. */
    title: industry.title,
    description: industry.description,
    alternates: { canonical: url },
    /* Indexed, including the experimental pair — they are real pages with real
       (clearly framed) content, and §2.2 says indexed. */
    robots: { index: true, follow: true },
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

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildIndustrySchema(industry)).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav active="industries" />

      <main id="main">
        <IndustryHero industry={industry} />
        <ExperimentalNote industry={industry} />
        <IndustryGaps industry={industry} />
        <WhatFinchWatchesHere industry={industry} />
        <IndustryModules industry={industry} />
        <IndustryAudit industry={industry} />
        <IndustryRelated industry={industry} />
        <IndustryFaqs industry={industry} />
        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
