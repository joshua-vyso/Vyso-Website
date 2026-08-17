import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import {
  ArticleCard,
  CategoryFilter,
  FeaturedArticle,
  H2,
  LEAD,
  SECTION,
} from "@/components/finch/learn/LearnBits";
import { buildLearnHubSchema } from "@/components/finch/learn/learn-jsonld";
import { ArrowLink, Breadcrumb, Eyebrow } from "@/components/finch/solutions/SolutionBits";
import { GLOSSARY_TERMS } from "@/lib/marketing/glossary";
import { LEARN_ARTICLES, LEARN_CATEGORIES, type LearnCategory } from "@/lib/marketing/learn-articles";
import { RESOURCES } from "@/lib/marketing/resources";
import { SITE } from "@/lib/marketing/site";

const TITLE = "Operations articles for South African SMEs";
const DESCRIPTION =
  "Eight problem-first articles on where South African SMEs lose money — procurement, stock, reporting and admin — plus a 12-term operations glossary.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/learn` },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/learn`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const ALL = "All" as const;

function isLearnCategory(value: string): value is LearnCategory {
  return (LEARN_CATEGORIES as readonly string[]).includes(value);
}

/* `/learn` — the content hub. The signature visual of this tree (the reading-
   progress hairline) lives on the article pages, not here: the hub is a list,
   and a progress indicator on a list of links measures nothing.

   The category filter is server-side and link-driven, so every filtered view
   has its own URL and the page ships no JavaScript of its own. */
export default async function LearnHubPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: raw } = await searchParams;
  const active: LearnCategory | typeof ALL = raw && isLearnCategory(raw) ? raw : ALL;

  /* The featured slot is fixed, not "newest": `why-businesses-lose-money-
     without-realising-it` is the piece every other article refers back to, so
     it is the right first read whatever the publication order says. It stays
     out of the grid below when no filter is applied, and rejoins it when one
     is, because a filtered view should show everything that matches. */
  const featured = LEARN_ARTICLES[0];
  const filtered =
    active === ALL
      ? LEARN_ARTICLES.filter((article) => article.slug !== featured.slug)
      : LEARN_ARTICLES.filter((article) => article.category === active);

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildLearnHubSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav active="learn" />

      <main id="main">
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[36px] lg:px-[40px] lg:pt-[56px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Learn", href: "/learn" },
            ]}
          />
          <Eyebrow>LEARN</Eyebrow>
          <h1 className="m-0 mb-[18px] max-w-[820px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[56px] lg:leading-[1.06] lg:tracking-[-0.025em]">
            Operations knowledge, <span className="text-fn-ink-3">not sales copy.</span>
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:text-[17px]">
            Problem-first articles on the operational gaps that quietly cost South African SMEs
            time and margin — procurement, stock, reporting, admin and where AI actually helps.
            Every piece ends with the finding it would produce in a real week.
          </p>
        </section>

        <section className={SECTION} aria-labelledby="featured-heading">
          <h2 id="featured-heading" className="sr-only">
            Start here
          </h2>
          <FeaturedArticle article={featured} />
        </section>

        <section className={SECTION} aria-labelledby="articles-heading">
          <Eyebrow>ALL ARTICLES</Eyebrow>
          <h2 id="articles-heading" className={H2}>
            {active === ALL ? "Eight problems, in order of how often they cost you." : `${active}.`}
          </h2>
          <p className={`${LEAD} mb-[28px] lg:mb-[36px]`}>
            {active === ALL
              ? "Each one describes a pattern we see in operations-heavy South African businesses, what it costs, and what to do about it this month — before any software is involved."
              : `Articles filed under ${active}. Every article is also listed under All.`}
          </p>

          <div className="mb-[32px] lg:mb-[44px]">
            <CategoryFilter active={active} />
          </div>

          {filtered.length === 0 ? (
            <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3">
              Nothing filed under {active} yet.{" "}
              <Link href="/learn" className="text-fn-ink underline underline-offset-[3px]">
                See all articles
              </Link>
              .
            </p>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((article) => (
                <li key={article.slug}>
                  <ArticleCard article={article} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={SECTION} aria-labelledby="more-heading">
          <Eyebrow>ALSO IN LEARN</Eyebrow>
          <h2 id="more-heading" className={H2}>
            Definitions and things you can use on Monday.
          </h2>
          <div className="mt-[32px] grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:mt-[44px]">
            <Link
              href="/learn/glossary"
              className="group flex flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[24px] py-[24px] transition-[border-color,box-shadow] duration-200 ease-out hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card)]"
            >
              <span className="mb-[12px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
                GLOSSARY · {GLOSSARY_TERMS.length} TERMS
              </span>
              <span className="mb-[10px] font-fn-serif text-[21px] font-medium tracking-[-0.015em] transition-colors duration-150 group-hover:text-fn-orange-deep">
                The operations glossary
              </span>
              <span className="text-[14px] leading-[1.6] text-fn-ink-3 text-pretty">
                Money leakage, price creep, stock cover days, debtors ageing, POPIA — defined in a
                sentence each, then explained for a business that buys and holds stock.
              </span>
            </Link>
            <Link
              href="/resources"
              className="group flex flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[24px] py-[24px] transition-[border-color,box-shadow] duration-200 ease-out hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card)]"
            >
              <span className="mb-[12px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
                RESOURCES · {RESOURCES.length} DOCUMENTS
              </span>
              <span className="mb-[10px] font-fn-serif text-[21px] font-medium tracking-[-0.015em] transition-colors duration-150 group-hover:text-fn-orange-deep">
                Checklists, templates, scorecards
              </span>
              <span className="text-[14px] leading-[1.6] text-fn-ink-3 text-pretty">
                An operations audit checklist, a weekly report template and a supplier scorecard.
                Every one previews its full contents before you ask for it.
              </span>
            </Link>
          </div>
          <p className="m-0 mt-[28px] text-[14px] text-fn-muted">
            <ArrowLink href="/solutions">See what Finch fixes</ArrowLink>
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
