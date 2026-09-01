import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageHero, JsonLd, breadcrumbs } from "@/components/site/PageShell";
import { INDUSTRY_PAGES } from "@/components/site/industries-content";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "The operations Vyso knows well enough to be specific about: food & hospitality (where our production builds run today), construction, and insurance — each with the workflows we automate and what stays under human control.",
  alternates: { canonical: "/industries" },
};

export default function IndustriesPage() {
  return (
    <PageShell>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Industries", "/industries"]])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          "@id": `${SITE.url}/industries#list`,
          itemListElement: INDUSTRY_PAGES.map((industry, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: industry.name,
            url: `${SITE.url}/industries/${industry.slug}`,
          })),
        }}
      />
      <PageHero
        eyebrow="Industries"
        title={
          <>
            Operations we know well enough{" "}
            <em className="vy-serif font-normal italic text-signal-deep">to be specific about.</em>
          </>
        }
        lead="The automations don't change per industry — what changes is which workflows earn their place first, and in whose vocabulary. These are the three operations where we can be concrete rather than general."
      />
      <div className="mx-auto max-w-[1200px] space-y-5 px-6 pb-24">
        {INDUSTRY_PAGES.map((industry, index) => (
          <Link
            key={industry.slug}
            href={`/industries/${industry.slug}`}
            className="group grid gap-6 rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-[var(--vy-shadow-float)] md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)_auto] md:items-center md:p-8"
          >
            <div>
              <p className="vy-mono text-sm text-signal-deep">0{index + 1}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.01em]">{industry.name}</h2>
            </div>
            <p className="max-w-[560px] text-sm leading-relaxed text-ink-2">{industry.lead}</p>
            <span
              className="hidden text-signal-deep transition-transform group-hover:translate-x-1 md:block"
              aria-hidden="true"
            >
              →
            </span>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
