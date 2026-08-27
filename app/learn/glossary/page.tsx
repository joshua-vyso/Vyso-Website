import type { Metadata } from "next";
import Link from "next/link";

import { Shell } from "@/components/vyso/Shell";
import { ArrowLink, Breadcrumb, Eyebrow, H2, LEAD, SECTION } from "@/components/finch/learn/LearnBits";
import { buildGlossaryHubSchema } from "@/components/finch/learn/learn-jsonld";
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
   speed and clarity are the feature here, and a list of definitions that
   answers in the first sentence is what both a reader and an answer engine
   want. Each row shows the first sentence of the real definition (computed,
   not re-written) so the hub can never summarise the term differently from
   the term's own page.

   `.ai/plan_vyso_redesign_2026.md` §7.6: chrome swap onto the vyso `Shell`
   (`active="insights"`). Every term and definition is unchanged here; only
   the chrome and the `--fn-*` styling moved to `--vy-*`. */
export default function GlossaryHubPage() {
  return (
    <Shell active="insights">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildGlossaryHubSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <section className="mx-auto max-w-[1160px] px-[var(--vy-gutter)] pt-[36px] lg:px-[40px] lg:pt-[56px]">
        <Breadcrumb
          trail={[
            { label: "Home", href: "/" },
            { label: "Insights", href: "/learn" },
            { label: "Glossary", href: "/learn/glossary" },
          ]}
        />
        <Eyebrow>{GLOSSARY_HUB.eyebrow}</Eyebrow>
        <h1 className="vy-h1 m-0 mb-[18px] max-w-[820px] text-pretty text-[color:var(--vy-ink)] lg:mb-[22px]">
          {GLOSSARY_HUB.h1Plain} <span className="text-[color:var(--vy-ink-3)]">{GLOSSARY_HUB.h1Accent}</span>
        </h1>
        <p className="vy-body-lg m-0 max-w-[620px] text-pretty text-[color:var(--vy-ink-2)]">
          {GLOSSARY_HUB.lead}
        </p>
      </section>

      <section className={SECTION} aria-labelledby="terms-heading">
        <Eyebrow>A TO Z</Eyebrow>
        <h2 id="terms-heading" className={H2}>
          {GLOSSARY_ALPHABETICAL.length} terms, defined in one sentence each.
        </h2>
        <p className={`${LEAD} mb-[32px] lg:mb-[44px]`}>
          The full entry on each page adds what the term means for a business that buys, holds
          and delivers stock in South Africa, and one worked example of the finding it produces.
        </p>

        <dl className="m-0 border-t border-[color:var(--vy-line)]">
          {GLOSSARY_ALPHABETICAL.map((term) => (
            <div
              key={term.slug}
              className="grid grid-cols-1 gap-[6px] border-b border-[color:var(--vy-line)] py-[22px] md:grid-cols-[minmax(0,260px)_1fr] md:gap-[40px] md:py-[26px]"
            >
              <dt>
                <Link
                  href={`/learn/glossary/${term.slug}`}
                  className="group inline-flex items-baseline gap-[8px] text-[19px] font-medium tracking-[-0.015em] text-[color:var(--vy-ink)] transition-colors duration-150 hover:text-[color:var(--vy-ink-2)]"
                >
                  {term.term}
                  <span
                    aria-hidden="true"
                    className="text-[13px] text-[color:var(--vy-ink-3)] transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
                  >
                    →
                  </span>
                </Link>
                {term.aka && term.aka.length > 0 ? (
                  <div className="vy-label mt-[5px] text-[color:var(--vy-ink-3)]">
                    ALSO: {term.aka.join(" · ").toUpperCase()}
                  </div>
                ) : null}
              </dt>
              <dd className="vy-body m-0 text-pretty text-[color:var(--vy-ink-3)]">
                {firstSentence(term.definition[0])}
              </dd>
            </div>
          ))}
        </dl>

        <p className="m-0 mt-[32px] text-[14px] text-[color:var(--vy-ink-3)]">
          <ArrowLink href="/learn">Back to the articles</ArrowLink>
        </p>
      </section>
    </Shell>
  );
}
