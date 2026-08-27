import type { Metadata } from "next";

import { Shell } from "@/components/vyso/Shell";
import { Section } from "@/components/vyso/Section";
import { SolutionCard } from "@/components/vyso/solutions/SolutionCard";
import { SolutionClose } from "@/components/vyso/solutions/SolutionClose";
import { buildSolutionsHubSchema } from "@/components/vyso/solutions/solutions-jsonld";
import { HUB, SOLUTION_LIST } from "@/lib/marketing/solutions";
import { SITE } from "@/lib/marketing/site";

/* `/solutions` — the problem-first hub (plan §7.4: "overview grid of the 8,
   problem-first framing, audit CTA"). Root layout supplies the `%s | Vyso`
   title suffix, so `title` here is the page half only. */
export const metadata: Metadata = {
  title: HUB.title,
  description: HUB.description,
  alternates: { canonical: `${SITE.url}/solutions` },
  robots: { index: true, follow: true },
  openGraph: {
    title: HUB.title,
    description: HUB.description,
    url: `${SITE.url}/solutions`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HUB.title,
    description: HUB.description,
  },
};

export default function SolutionsPage() {
  return (
    <Shell active="solutions">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSolutionsHubSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <section className="px-[var(--vy-gutter)] pt-[44px] pb-[16px] md:px-[40px] md:pt-[72px]">
        <div className="mx-auto max-w-[var(--vy-content)]">
          <p className="vy-label mb-[18px] text-[color:var(--vy-ink-3)]">{HUB.eyebrow}</p>
          <h1 className="vy-h1 max-w-[820px] text-[color:var(--vy-ink)]">
            {HUB.heading} <span className="text-[color:var(--vy-ink-3)]">{HUB.continuation}</span>
          </h1>
          <p className="vy-body-lg mt-[22px] max-w-[640px] text-[color:var(--vy-ink-3)]">
            {HUB.lead}
          </p>
        </div>
      </section>

      <Section spacing="tight" divider>
        <ul className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-2 lg:grid-cols-3">
          {SOLUTION_LIST.map((solution) => (
            <SolutionCard key={solution.slug} solution={solution} />
          ))}
        </ul>
      </Section>

      <SolutionClose page="solutions-hub" />
    </Shell>
  );
}
