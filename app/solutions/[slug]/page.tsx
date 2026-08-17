import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import {
  HowFinchFixesIt,
  SolutionCost,
  SolutionFaqs,
  SolutionHero,
  SolutionProblem,
  SolutionRelated,
  SolutionStruggles,
  SolutionWorkflow,
} from "@/components/finch/solutions/SolutionSections";
import { buildSolutionSchema } from "@/components/finch/solutions/solutions-jsonld";
import { SITE } from "@/lib/marketing/site";
import { SOLUTION_ORDER, getSolution } from "@/lib/marketing/solutions";

/* `/solutions/[slug]` in the Finch design language. The content moved to
   `lib/marketing/solutions.ts` (Phase 2, workstream D) — the hub used to have
   to import this route module to read it. */

export function generateStaticParams() {
  return SOLUTION_ORDER.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) return {};

  const url = `${SITE.url}/solutions/${slug}`;
  return {
    /* Plain string, not `absolute`: the root layout's `%s | Vyso` template
       supplies the suffix and these titles don't carry it themselves. */
    title: solution.title,
    description: solution.description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: solution.title,
      description: solution.description,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: solution.title,
      description: solution.description,
    },
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const solution = getSolution(slug);
  if (!solution) notFound();

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSolutionSchema(solution)).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav />

      <main id="main">
        <SolutionHero solution={solution} />
        <SolutionProblem solution={solution} />
        <SolutionStruggles solution={solution} />
        <SolutionCost solution={solution} />
        <HowFinchFixesIt solution={solution} />
        <SolutionWorkflow solution={solution} />
        <SolutionRelated solution={solution} />
        <SolutionFaqs solution={solution} />
        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
