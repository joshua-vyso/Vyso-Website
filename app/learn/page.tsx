import type { Metadata } from "next";
import Link from "next/link";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";
import { LEARN_ARTICLES, LEARN_CATEGORIES, type LearnCategory } from "@/lib/marketing/learn-articles";

const PAGE_TITLE = "Learn | Operations, Automation & Procurement Insights | Vyso";
const PAGE_DESCRIPTION =
  "Practical, problem-first articles on operations, automation, procurement, reporting, inventory and AI in business — written for South African SMEs.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/learn" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "https://vyso.co.za/learn",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/og.png"],
  },
};

const ALL_FILTER = "All" as const;
type CategoryFilter = typeof ALL_FILTER | LearnCategory;

function isLearnCategory(value: string): value is LearnCategory {
  return (LEARN_CATEGORIES as readonly string[]).includes(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function LearnLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: rawCategory } = await searchParams;
  const activeCategory: CategoryFilter =
    rawCategory && isLearnCategory(rawCategory) ? rawCategory : ALL_FILTER;

  const articles =
    activeCategory === ALL_FILTER
      ? LEARN_ARTICLES
      : LEARN_ARTICLES.filter((article) => article.category === activeCategory);

  const url = "https://vyso.co.za/learn";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: PAGE_TITLE,
        description: PAGE_DESCRIPTION,
        isPartOf: { "@id": "https://vyso.co.za/#website" },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: "en-ZA",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
          { "@type": "ListItem", position: 2, name: "Learn", item: url },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${url}#articles`,
        itemListElement: LEARN_ARTICLES.map((article, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${url}/${article.slug}`,
          name: article.title,
        })),
      },
    ],
  };

  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="learn-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Learn" }]} />
          <p className={styles.eyebrow}>Learn</p>
          <h1 id="learn-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Operations knowledge,</span>{" "}
            <span className={styles.blendAccent}>not sales copy.</span>
          </h1>
          <p className={styles.compactLead}>
            Practical, problem-first articles on the operational gaps that quietly
            cost South African SMEs time and margin — operations, automation,
            procurement, reporting, inventory and AI in business.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="learn-articles-heading">
        <div className={styles.shell}>
          <h2 id="learn-articles-heading" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Learn articles
          </h2>

          <nav className={styles.tagList} aria-label="Filter by category" style={{ marginBottom: "2.5rem" }}>
            <Link
              href="/learn"
              className={styles.statusPill}
              style={
                activeCategory === ALL_FILTER
                  ? { background: "var(--marketing-orange)", color: "white", borderColor: "transparent" }
                  : undefined
              }
            >
              All
            </Link>
            {LEARN_CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/learn?category=${encodeURIComponent(category)}`}
                className={styles.statusPill}
                style={
                  activeCategory === category
                    ? { background: "var(--marketing-orange)", color: "white", borderColor: "transparent" }
                    : undefined
                }
              >
                {category}
              </Link>
            ))}
          </nav>

          {articles.length === 0 ? (
            <div className={styles.glassCard}>
              <p className={styles.cardCopy}>
                There are no published articles in this category yet. Browse{" "}
                <Link className={styles.textLink} href="/learn">
                  all articles
                </Link>{" "}
                instead, or check back soon — we publish new operational content
                regularly.
              </p>
            </div>
          ) : (
            <div className={styles.featureGrid}>
              {articles.map((article) => (
                <article key={article.slug} className={styles.glassCard}>
                  <span className={styles.statusPill}>{article.category}</span>
                  <h3 className={styles.cardTitle}>
                    <Link href={`/learn/${article.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                      {article.title}
                    </Link>
                  </h3>
                  <p className={styles.cardCopy}>{article.description}</p>
                  <div className={styles.cardFoot}>
                    <p className={styles.cardCopy} style={{ color: "#8c8c8c" }}>
                      {formatDate(article.publishedDate)} · {article.readingTime}
                    </p>
                    <Link className={styles.textLink} href={`/learn/${article.slug}`}>
                      Read article <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <MarketingCta
        eyebrow="Ready to see it applied"
        title="See how this plays out in your own operation."
        copy="These articles describe the patterns. The one-week audit maps which ones are actually present in your business, and what to do about them first."
        primaryLabel="Join Waitlist"
        secondaryLabel="Explore solutions"
        secondaryHref="/solutions"
      />
    </PublicPageShell>
  );
}
