import type { Metadata } from "next";
import Link from "next/link";

import { Shell } from "@/components/vyso/Shell";
import {
  ArrowLink,
  ArticleCard,
  Breadcrumb,
  CategoryFilter,
  Eyebrow,
  FeaturedArticle,
  H2,
  LEAD,
  SECTION,
} from "@/components/finch/learn/LearnBits";
import { buildLearnHubSchema } from "@/components/finch/learn/learn-jsonld";
import { GLOSSARY_TERMS } from "@/lib/marketing/glossary";
import { LEARN_ARTICLES, LEARN_CATEGORIES, type LearnCategory } from "@/lib/marketing/learn-articles";
import { RESOURCES } from "@/lib/marketing/resources";
import { SITE } from "@/lib/marketing/site";

const TITLE = "Operations articles for South African SMEs";
const DESCRIPTION =
  "Eight problem-first articles on where South African SMEs lose money: procurement, stock, reporting and admin, plus a 12-term operations glossary.";

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
   has its own URL and the page ships no JavaScript of its own.

   `.ai/plan_vyso_redesign_2026.md` §7.6: chrome swap onto the vyso `Shell`
   (`active="insights"`, per plan §5 — the nav label is Insights, the URL
   stays `/learn`). Content, structure and every article/glossary/resource
   fact are unchanged; only the chrome and the obvious `--fn-*` styling moved
   to `--vy-*`. */
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
    <Shell active="insights">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildLearnHubSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <section className="mx-auto max-w-[1160px] px-[var(--vy-gutter)] pt-[36px] lg:px-[40px] lg:pt-[56px]">
        <Breadcrumb
          trail={[
            { label: "Home", href: "/" },
            { label: "Insights", href: "/learn" },
          ]}
        />
        <Eyebrow>INSIGHTS</Eyebrow>
        <h1 className="vy-h1 m-0 mb-[18px] max-w-[820px] text-pretty text-[color:var(--vy-ink)] lg:mb-[22px]">
          Operations knowledge, <span className="text-[color:var(--vy-ink-3)]">not sales copy.</span>
        </h1>
        <p className="vy-body-lg m-0 max-w-[620px] text-pretty text-[color:var(--vy-ink-3)]">
          Problem-first articles on the operational gaps that quietly cost South African SMEs
          time and margin: procurement, stock, reporting, admin and where AI actually helps.
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
            ? "Each one describes a pattern we see in operations-heavy South African businesses, what it costs, and what to do about it this month, before any software is involved."
            : `Articles filed under ${active}. Every article is also listed under All.`}
        </p>

        <div className="mb-[32px] lg:mb-[44px]">
          <CategoryFilter active={active} />
        </div>

        {filtered.length === 0 ? (
          <p className="vy-body m-0 text-[color:var(--vy-ink-3)]">
            Nothing filed under {active} yet.{" "}
            <Link href="/learn" className="text-[color:var(--vy-ink)] underline underline-offset-[3px]">
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
        <Eyebrow>ALSO IN INSIGHTS</Eyebrow>
        <h2 id="more-heading" className={H2}>
          Definitions and things you can use on Monday.
        </h2>
        <div className="mt-[32px] grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:mt-[44px]">
          <Link
            href="/learn/glossary"
            className="group flex flex-col rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[24px] py-[24px] transition-colors duration-150 hover:border-[color:var(--vy-line-2)]"
          >
            <span className="vy-label mb-[12px] text-[color:var(--vy-ink-3)]">
              GLOSSARY · {GLOSSARY_TERMS.length} TERMS
            </span>
            <span className="mb-[10px] text-[21px] font-medium tracking-[-0.015em] text-[color:var(--vy-ink)] transition-colors duration-150 group-hover:text-[color:var(--vy-ink-2)]">
              The operations glossary
            </span>
            <span className="vy-small text-[color:var(--vy-ink-3)] text-pretty">
              Money leakage, price creep, stock cover days, debtors ageing, POPIA: defined in a
              sentence each, then explained for a business that buys and holds stock.
            </span>
          </Link>
          <Link
            href="/resources"
            className="group flex flex-col rounded-[var(--vy-radius)] border border-[color:var(--vy-line)] bg-[color:var(--vy-surface)] px-[24px] py-[24px] transition-colors duration-150 hover:border-[color:var(--vy-line-2)]"
          >
            <span className="vy-label mb-[12px] text-[color:var(--vy-ink-3)]">
              RESOURCES · {RESOURCES.length} DOCUMENTS
            </span>
            <span className="mb-[10px] text-[21px] font-medium tracking-[-0.015em] text-[color:var(--vy-ink)] transition-colors duration-150 group-hover:text-[color:var(--vy-ink-2)]">
              Checklists, templates, scorecards
            </span>
            <span className="vy-small text-[color:var(--vy-ink-3)] text-pretty">
              An operations audit checklist, a weekly report template and a supplier scorecard.
              Every one previews its full contents before you ask for it.
            </span>
          </Link>
        </div>
        <p className="m-0 mt-[28px] text-[14px] text-[color:var(--vy-ink-3)]">
          <ArrowLink href="/solutions">See what Vyso builds</ArrowLink>
        </p>
      </section>
    </Shell>
  );
}
