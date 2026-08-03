import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";
import { LEARN_ARTICLES, getLearnArticle, getRelatedArticles } from "@/lib/marketing/learn-articles";

const SOLUTION_LABELS: Record<string, string> = {
  "/solutions/reduce-money-leakage": "Reduce Money Leakage",
  "/solutions/procurement-automation": "Procurement Automation",
  "/solutions/reporting-automation": "Reporting Automation",
  "/solutions/operations-dashboard": "Operations Dashboard",
};

const INDUSTRY_LABELS: Record<string, string> = {
  "/industries/restaurants": "Restaurants",
  "/industries/food-suppliers": "Food Suppliers",
  "/industries/farms": "Farms & Producers",
  "/industries/catering-companies": "Catering Companies",
  "/industries/wholesale": "Wholesale",
  "/industries/hospitality": "Hospitality",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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

  const url = `/learn/${slug}`;

  return {
    title: `${article.title} | Vyso Learn`,
    description: article.description,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description: article.description,
      url: `https://vyso.co.za${url}`,
      siteName: "Vyso",
      locale: "en_ZA",
      type: "article",
      publishedTime: article.publishedDate,
      authors: [article.author],
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: ["/og.png"],
    },
  };
}

export default async function LearnArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getLearnArticle(slug);
  if (!article) notFound();

  const url = `https://vyso.co.za/learn/${slug}`;
  const relatedArticles = getRelatedArticles(article);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        datePublished: article.publishedDate,
        dateModified: article.publishedDate,
        inLanguage: "en-ZA",
        articleSection: article.category,
        author: { "@id": "https://vyso.co.za/#organization" },
        publisher: { "@id": "https://vyso.co.za/#organization" },
        mainEntityOfPage: { "@id": `${url}#webpage` },
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: article.title,
        description: article.description,
        isPartOf: { "@id": "https://vyso.co.za/#website" },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: "en-ZA",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
          { "@type": "ListItem", position: 2, name: "Learn", item: "https://vyso.co.za/learn" },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
    ],
  };

  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="article-heading">
        <AbstractFlowBackdrop quiet />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Learn", href: "/learn" },
              { label: article.title },
            ]}
          />
          <p className={styles.eyebrow}>{article.category}</p>
          <h1 id="article-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>{article.title}</span>
          </h1>
          <p className={styles.compactLead}>{article.heroLead}</p>
          <ul className={styles.tagList} aria-label="Article details">
            <li>{article.author}</li>
            <li>{formatDate(article.publishedDate)}</li>
            <li>{article.readingTime}</li>
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="article-body-heading">
        <div className={styles.shell}>
          <h2 id="article-body-heading" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
            Article content
          </h2>
          <div style={{ maxWidth: 760 }}>
            {article.sections.map((section) => (
              <div key={section.heading} style={{ marginBottom: "2.75rem" }}>
                <h3 className={styles.cardTitle}>{section.heading}</h3>
                {section.body.map((paragraph, index) => (
                  <p
                    key={`${section.heading}-${index}`}
                    className={styles.sectionCopy}
                    style={{ maxWidth: "none" }}
                  >
                    {paragraph}
                  </p>
                ))}
                {section.list && section.list.length > 0 ? (
                  <ul className={styles.list}>
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="article-links-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Take it further</p>
          <h2 id="article-links-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Related solutions, industries & reading.
          </h2>

          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            <article className={styles.answerCard}>
              <h3>Relevant Vyso solutions</h3>
              <ul className={styles.list}>
                {article.relatedSolutionHrefs.map((href) => (
                  <li key={href}>
                    <Link className={styles.textLink} href={href}>
                      {SOLUTION_LABELS[href] ?? href}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
            <article className={styles.answerCard}>
              <h3>Relevant industries</h3>
              <ul className={styles.list}>
                {article.relatedIndustryHrefs.map((href) => (
                  <li key={href}>
                    <Link className={styles.textLink} href={href}>
                      {INDUSTRY_LABELS[href] ?? href}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          </div>

          {relatedArticles.length > 0 ? (
            <div style={{ marginTop: "3.5rem" }}>
              <p className={styles.sectionKicker}>Related articles</p>
              <div className={styles.featureGrid} style={{ marginTop: "1.5rem" }}>
                {relatedArticles.map((related) => (
                  <article key={related.slug} className={styles.glassCard}>
                    <span className={styles.statusPill}>{related.category}</span>
                    <h3 className={styles.cardTitle}>
                      <Link href={`/learn/${related.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {related.title}
                      </Link>
                    </h3>
                    <p className={styles.cardCopy}>{related.description}</p>
                    <div className={styles.cardFoot}>
                      <Link className={styles.textLink} href={`/learn/${related.slug}`}>
                        Read article <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <MarketingCta
        eyebrow="See it in your own operation"
        title="Bring us the workflow this article describes."
        copy="The one-week audit maps whether this specific problem is costing your business, and what to do about it first."
        primaryLabel="Join Waitlist"
        secondaryLabel="Back to Learn"
        secondaryHref="/learn"
      />
    </PublicPageShell>
  );
}
