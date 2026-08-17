import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { H2, LEAD, SECTION } from "@/components/finch/learn/LearnBits";
import { buildGlossaryHubSchema } from "@/components/finch/learn/learn-jsonld";
import { ArrowLink, Breadcrumb, Eyebrow } from "@/components/finch/solutions/SolutionBits";
import { GLOSSARY_ALPHABETICAL, GLOSSARY_HUB, firstSentence } from "@/lib/marketing/glossary";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: GLOSSARY_HUB.title,
  description: GLOSSARY_HUB.description,
  alternates: { canonical: `${SITE.url}/learn/glossary` },
  robots: { index: true, follow: true },
  openGraph: {
    title: GLOSSARY_HUB.title,
    description: GLOSSARY_HUB.description,
    url: `${SITE.url}/learn/glossary`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: GLOSSARY_HUB.title,
    description: GLOSSARY_HUB.description,
  },
};

/* `/learn/glossary` — deliberately the plainest page in the tree. No widget:
   `.ai/vyso_v2.md` §2.3 says speed and clarity are the feature here, and a
   list of definitions that answers in the first sentence is what both a reader
   and an answer engine want. Each row shows the first sentence of the real
   definition (computed, not re-written) so the hub can never summarise the
   term differently from the term's own page. */
export default function GlossaryHubPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildGlossaryHubSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav active="learn" />

      <main id="main">
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[36px] lg:px-[40px] lg:pt-[56px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Learn", href: "/learn" },
              { label: "Glossary", href: "/learn/glossary" },
            ]}
          />
          <Eyebrow>{GLOSSARY_HUB.eyebrow}</Eyebrow>
          <h1 className="m-0 mb-[18px] max-w-[820px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[56px] lg:leading-[1.06] lg:tracking-[-0.025em]">
            {GLOSSARY_HUB.h1Plain} <span className="text-fn-ink-3">{GLOSSARY_HUB.h1Accent}</span>
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:text-[17px]">
            {GLOSSARY_HUB.lead}
          </p>
        </section>

        <section className={SECTION} aria-labelledby="terms-heading">
          <Eyebrow>A–Z</Eyebrow>
          <h2 id="terms-heading" className={H2}>
            {GLOSSARY_ALPHABETICAL.length} terms, defined in one sentence each.
          </h2>
          <p className={`${LEAD} mb-[32px] lg:mb-[44px]`}>
            The full entry on each page adds what the term means for a business that buys, holds
            and delivers stock in South Africa, and one worked example of the finding it produces.
          </p>

          <dl className="m-0 border-t border-fn-line">
            {GLOSSARY_ALPHABETICAL.map((term) => (
              <div
                key={term.slug}
                className="grid grid-cols-1 gap-[6px] border-b border-fn-line py-[22px] md:grid-cols-[minmax(0,260px)_1fr] md:gap-[40px] md:py-[26px]"
              >
                <dt>
                  <Link
                    href={`/learn/glossary/${term.slug}`}
                    className="group inline-flex items-baseline gap-[8px] font-fn-serif text-[19px] font-medium tracking-[-0.015em] text-fn-ink transition-colors duration-150 hover:text-fn-orange-deep"
                  >
                    {term.term}
                    <span
                      aria-hidden="true"
                      className="text-[13px] text-fn-faint transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
                    >
                      →
                    </span>
                  </Link>
                  {term.aka && term.aka.length > 0 ? (
                    <div className="mt-[5px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
                      ALSO: {term.aka.join(" · ").toUpperCase()}
                    </div>
                  ) : null}
                </dt>
                <dd className="m-0 text-[15px] leading-[1.62] text-fn-ink-3 text-pretty">
                  {firstSentence(term.definition[0])}
                </dd>
              </div>
            ))}
          </dl>

          <p className="m-0 mt-[32px] text-[14px] text-fn-muted">
            <ArrowLink href="/learn">Back to the articles</ArrowLink>
          </p>
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
