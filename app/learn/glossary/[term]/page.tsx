import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import {
  H2,
  IllustrativeFinding,
  READING_COLUMN,
  SECTION,
  TermChips,
} from "@/components/finch/learn/LearnBits";
import { buildGlossaryTermSchema } from "@/components/finch/learn/learn-jsonld";
import { ArrowLink, Breadcrumb, Eyebrow } from "@/components/finch/solutions/SolutionBits";
import { GLOSSARY_SLUGS, getGlossaryTerm } from "@/lib/marketing/glossary";
import { getLearnArticle } from "@/lib/marketing/learn-articles";
import { SITE } from "@/lib/marketing/site";

export function generateStaticParams() {
  return GLOSSARY_SLUGS.map((term) => ({ term }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ term: string }>;
}): Promise<Metadata> {
  const { term: slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) return {};

  const url = `${SITE.url}/learn/glossary/${slug}`;
  return {
    title: term.metaTitle,
    description: term.metaDescription,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title: term.metaTitle,
      description: term.metaDescription,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: term.metaTitle,
      description: term.metaDescription,
    },
  };
}

/* `/learn/glossary/[term]` — definition first, in the largest body type on the
   site, because the first paragraph is the whole job of the page. Everything
   below it (why it matters here, the caveat, the worked example, the links) is
   for the reader who wants more; an answer engine can stop at paragraph one
   and still be right. */
export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ term: string }>;
}) {
  const { term: slug } = await params;
  const term = getGlossaryTerm(slug);
  if (!term) notFound();

  const articles = term.relatedArticles
    .map((articleSlug) => getLearnArticle(articleSlug))
    .filter((article) => article !== undefined);

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildGlossaryTermSchema(term)).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav active="learn" />

      <main id="main">
        <header className="mx-auto max-w-[1160px] px-[20px] pt-[36px] lg:px-[40px] lg:pt-[56px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Learn", href: "/learn" },
              { label: "Glossary", href: "/learn/glossary" },
              { label: term.term, href: `/learn/glossary/${term.slug}` },
            ]}
          />
          <Eyebrow>GLOSSARY</Eyebrow>
          <h1 className="m-0 mb-[6px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.025em] text-pretty lg:text-[52px]">
            {term.term}
          </h1>
          {term.aka && term.aka.length > 0 ? (
            <div className="font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-muted">
              ALSO CALLED: {term.aka.join(" · ").toUpperCase()}
            </div>
          ) : null}
        </header>

        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[28px] lg:px-[40px] lg:pt-[40px]"
          aria-labelledby="definition-heading"
        >
          <h2 id="definition-heading" className="sr-only">
            Definition
          </h2>
          <div className={READING_COLUMN}>
            {term.definition.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="m-0 mb-[18px] text-[18px] leading-[1.65] text-fn-ink text-pretty last:mb-0 lg:text-[20px] lg:leading-[1.6]"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>

        <section className={SECTION} aria-labelledby="why-heading">
          <Eyebrow>WHY IT MATTERS FOR AN SA FOOD BUSINESS</Eyebrow>
          <h2 id="why-heading" className={H2}>
            What it changes in practice.
          </h2>
          <div className={READING_COLUMN}>
            {term.whyItMatters.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="m-0 mb-[18px] text-[16px] leading-[1.7] text-fn-ink-2 text-pretty last:mb-0 lg:text-[16.5px]"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {term.note ? (
            /* Neutral ink on a hairline, not a coloured callout: a caveat is
               neither agent activity nor evidence, and the colour rules leave
               it exactly one option. */
            <div className="mt-[24px] max-w-[720px] rounded-[10px] border border-fn-line bg-fn-surface px-[20px] py-[16px]">
              <div className="mb-[8px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
                ONE CAVEAT
              </div>
              <p className="m-0 text-[14px] leading-[1.62] text-fn-ink-3 text-pretty">{term.note}</p>
            </div>
          ) : null}
        </section>

        <section className={SECTION} aria-labelledby="example-heading">
          <Eyebrow>AS A FINDING</Eyebrow>
          <h2 id="example-heading" className={H2}>
            What it looks like when Finch catches it.
          </h2>
          <div className="mt-[28px] lg:mt-[40px]">
            <IllustrativeFinding finding={term.example} className="max-w-[460px]" />
          </div>
        </section>

        <section className={SECTION} aria-labelledby="related-heading">
          <Eyebrow>KEEP READING</Eyebrow>
          <h2 id="related-heading" className={H2}>
            Related terms and reading.
          </h2>

          <div className="mt-[32px] grid grid-cols-1 gap-[36px] border-t border-fn-line pt-[28px] md:grid-cols-3 md:gap-[48px] lg:mt-[44px]">
            <TermChips slugs={term.relatedTerms} label="RELATED TERMS" />

            <div>
              <Eyebrow>ARTICLES</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                {articles.map((article) => (
                  <li key={article.slug}>
                    <ArrowLink href={`/learn/${article.slug}`}>{article.title}</ArrowLink>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Eyebrow>ON THE SITE</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                {term.relatedPages.map((page) => (
                  <li key={page.href}>
                    <ArrowLink href={page.href}>{page.label}</ArrowLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="m-0 mt-[32px] text-[14px] text-fn-muted">
            <Link
              href="/learn/glossary"
              className="transition-colors duration-150 hover:text-fn-orange-deep"
            >
              ← All glossary terms
            </Link>
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
