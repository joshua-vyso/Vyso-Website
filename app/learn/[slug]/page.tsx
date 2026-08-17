import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { ArticleToc } from "@/components/finch/learn/ArticleToc";
import {
  ArticleAgents,
  ArticleCard,
  AuthorBox,
  H2,
  IllustrativeFinding,
  SECTION,
  SourcesBlock,
  TermChips,
  formatDate,
  headingId,
} from "@/components/finch/learn/LearnBits";
import { ReadingProgress } from "@/components/finch/learn/ReadingProgress";
import { buildArticleSchema } from "@/components/finch/learn/learn-jsonld";
import { ArrowLink, Breadcrumb, Eyebrow } from "@/components/finch/solutions/SolutionBits";
import {
  LEARN_ARTICLES,
  getLearnArticle,
  getRelatedArticles,
} from "@/lib/marketing/learn-articles";
import { SITE } from "@/lib/marketing/site";

/* Labels for the two related-link rows. Both maps are keyed by href and both
   are checked against the real routes: `SOLUTION_LABELS` covers the four
   `/solutions` pages that exist, `INDUSTRY_LABELS` the six industry slugs. An
   href with no label here would render as a raw path, so `generateStaticParams`
   time is when a bad link would be noticed rather than in production. */
const SOLUTION_LABELS: Record<string, string> = {
  "/solutions/reduce-money-leakage": "Reduce money leakage",
  "/solutions/procurement-automation": "Procurement automation",
  "/solutions/reporting-automation": "Reporting automation",
  "/solutions/operations-dashboard": "Operations dashboard",
};

const INDUSTRY_LABELS: Record<string, string> = {
  "/industries/restaurants": "Restaurants",
  "/industries/food-suppliers": "Food suppliers",
  "/industries/farms": "Farms & producers",
  "/industries/catering-companies": "Catering companies",
  "/industries/wholesale": "Wholesale",
  "/industries/hospitality": "Hospitality",
};

/* Only one article's own title breaks the ≤60-char budget once the root
   layout appends " | Vyso" (54 + 7 = 61), so only that one is overridden.
   The `<h1>` still carries the full title — this is the `<title>` tag. */
const META_TITLES: Record<string, string> = {
  "ai-for-small-and-medium-businesses-practical-use-cases":
    "AI for small businesses: practical use cases",
};

/* Hand-written meta descriptions, ≤155 chars, each naming South Africa or the
   article's own figure. The `description` field in the data file is the card
   copy on `/learn` and runs longer than a meta description should; trimming it
   there would make the cards worse to serve the head. */
const META_DESCRIPTIONS: Record<string, string> = {
  "why-businesses-lose-money-without-realising-it":
    "South African SMEs lose money in small, repeated gaps across procurement, stock and admin — not one dramatic event. Where to look first, and what it costs.",
  "15-signs-your-business-has-operational-chaos":
    "Fifteen signs operational chaos has become normal in a growing South African business — and the four checks worth running this month to confirm it.",
  "how-much-time-can-workflow-automation-save":
    "SA operations staff spend 8–15 hours a week on repeatable admin. What that costs per person per month, and which tasks are worth automating first.",
  "hidden-cost-of-manual-procurement":
    "Manual procurement costs South African food and wholesale operators 1.5–4% of supplier spend. Where it goes, and how to close the gap this month.",
  "supplier-scorecards-what-to-track-and-why":
    "The six things a supplier scorecard should track — delivery, price accuracy, quality, responsiveness — and why South African buyers need the record.",
  "why-weekly-reports-are-usually-too-late":
    "The gap between a problem starting and leadership seeing it averages five to seven days. Why weekly reporting is too slow for an SA operation.",
  "the-real-cost-of-poor-stock-control":
    "Unrecorded wastage and stock variance runs 4–8% of cost of goods for South African food operators. What that is in rand, and how to find it.",
  "ai-for-small-and-medium-businesses-practical-use-cases":
    "Five practical AI use cases for South African SMEs — document extraction, anomaly detection, automated reporting, triage and forecasting support.",
};

export function generateStaticParams() {
  return LEARN_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getLearnArticle(slug);
  if (!article) return {};

  const title = META_TITLES[slug] ?? article.title;
  const description = META_DESCRIPTIONS[slug] ?? article.description;
  const url = `${SITE.url}/learn/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: "en_ZA",
      type: "article",
      publishedTime: article.datePublished,
      modifiedTime: article.dateModified,
      authors: [article.author],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/* `/learn/[slug]` — the reading layout. 720px column, sticky TOC from `lg`,
   author box, sources where the article states its basis, the agents the
   problem would put on shift, and the finding the week would have produced.

   The reading-progress hairline is this tree's signature visual and appears
   on no other route. */
export default async function LearnArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getLearnArticle(slug);
  if (!article) notFound();

  const related = getRelatedArticles(article);
  const toc = article.sections.map((section) => ({
    id: headingId(section.heading),
    label: section.heading,
  }));

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildArticleSchema(article)).replace(/</g, "\\u003c"),
        }}
      />
      <ReadingProgress />
      <FinchNav active="learn" />

      <main id="main">
        <header className="mx-auto max-w-[1160px] px-[20px] pt-[36px] lg:px-[40px] lg:pt-[56px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Learn", href: "/learn" },
              { label: article.category, href: `/learn?category=${encodeURIComponent(article.category)}` },
            ]}
          />
          <div className="max-w-[820px]">
            <Eyebrow>{article.category.toUpperCase()}</Eyebrow>
            <h1 className="m-0 mb-[18px] font-fn-serif text-[34px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[50px] lg:leading-[1.07] lg:tracking-[-0.025em]">
              {article.title}
            </h1>
            <p className="m-0 mb-[22px] max-w-[720px] text-[16px] leading-[1.6] text-fn-ink-2 text-pretty lg:text-[18px]">
              {article.heroLead}
            </p>
            <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px] font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-muted">
              <span>{article.author.toUpperCase()}</span>
              <span className="text-fn-line-3">·</span>
              <time dateTime={article.datePublished}>
                {formatDate(article.datePublished).toUpperCase()}
              </time>
              <span className="text-fn-line-3">·</span>
              <span>{article.readingTime.toUpperCase()}</span>
            </div>
          </div>
        </header>

        <div className="mx-auto mt-[44px] grid max-w-[1160px] grid-cols-1 gap-[48px] px-[20px] lg:mt-[64px] lg:grid-cols-[minmax(0,720px)_1fr] lg:gap-[72px] lg:px-[40px]">
          <article>
            {article.sections.map((section) => (
              <section
                key={section.heading}
                aria-labelledby={headingId(section.heading)}
                className="mb-[40px] last:mb-0"
              >
                <h2
                  id={headingId(section.heading)}
                  className="m-0 mb-[14px] scroll-mt-[24px] font-fn-serif text-[24px] font-medium leading-[1.2] tracking-[-0.02em] lg:text-[28px]"
                >
                  {section.heading}
                </h2>
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="m-0 mb-[18px] text-[16px] leading-[1.72] text-fn-ink-2 text-pretty last:mb-0 lg:text-[17px]"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.list && section.list.length > 0 ? (
                  <ul className="m-0 mt-[18px] flex list-none flex-col gap-[12px] p-0">
                    {section.list.map((item) => (
                      <li
                        key={item.slice(0, 40)}
                        className="border-l border-fn-line pl-[16px] text-[15.5px] leading-[1.62] text-fn-ink-2 text-pretty"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}

            {article.sources && article.sources.length > 0 ? (
              <SourcesBlock sources={article.sources} />
            ) : null}

            <div className="mt-[40px]">
              <AuthorBox dateModified={article.dateModified} />
            </div>
          </article>

          <aside className="hidden lg:block">
            <ArticleToc items={toc} />
          </aside>
        </div>

        <section className={SECTION} aria-labelledby="finding-heading">
          <Eyebrow>WHAT THIS LOOKS LIKE AS A FINDING</Eyebrow>
          <h2 id="finding-heading" className={H2}>
            The card this week would have produced.
          </h2>
          <div className="mt-[28px] grid grid-cols-1 gap-[32px] lg:mt-[40px] lg:grid-cols-[minmax(0,460px)_1fr] lg:gap-[64px]">
            <IllustrativeFinding finding={article.endFinding} className="max-w-[460px]" />
            <div className="flex flex-col gap-[28px]">
              <ArticleAgents agents={article.agents} />
              <TermChips slugs={article.keyTerms} />
            </div>
          </div>
        </section>

        <section className={SECTION} aria-labelledby="take-further-heading">
          <Eyebrow>TAKE IT FURTHER</Eyebrow>
          <h2 id="take-further-heading" className={H2}>
            Where this problem gets fixed.
          </h2>

          <div className="mt-[32px] grid grid-cols-1 gap-[40px] border-t border-fn-line pt-[28px] md:grid-cols-2 md:gap-[64px] lg:mt-[44px]">
            <div>
              <Eyebrow>WHAT FINCH FIXES</Eyebrow>
              <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                {article.relatedSolutionHrefs.map((href) => (
                  <li key={href}>
                    <ArrowLink href={href}>{SOLUTION_LABELS[href] ?? href}</ArrowLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Eyebrow>WHERE WE SEE IT</Eyebrow>
              <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
                {article.relatedIndustryHrefs.map((href) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-block rounded-[99px] border border-fn-line bg-fn-surface px-[13px] py-[6px] text-[13.5px] text-fn-ink-3 transition-colors duration-150 hover:border-fn-line-hover hover:text-fn-orange-deep"
                    >
                      {INDUSTRY_LABELS[href] ?? href}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {related.length > 0 ? (
          <section className={SECTION} aria-labelledby="related-heading">
            <Eyebrow>KEEP READING</Eyebrow>
            <h2 id="related-heading" className={H2}>
              Usually the same operation.
            </h2>
            <ul className="m-0 mt-[32px] grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-3 lg:mt-[44px]">
              {related.map((item) => (
                <li key={item.slug}>
                  <ArticleCard article={item} />
                </li>
              ))}
            </ul>
            <p className="m-0 mt-[28px] text-[14px] text-fn-muted">
              <ArrowLink href="/learn">All articles</ArrowLink>
            </p>
          </section>
        ) : null}

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
