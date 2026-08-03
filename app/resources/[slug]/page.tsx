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
import ContactForm from "@/components/ContactForm";
import { RESOURCES, getResource } from "@/lib/marketing/resources";

export function generateStaticParams() {
  return RESOURCES.map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resource = getResource(slug);
  if (!resource) return {};

  return {
    title: resource.title,
    description: resource.description,
    alternates: { canonical: `/resources/${slug}` },
    openGraph: {
      title: resource.title,
      description: resource.description,
      url: `/resources/${slug}`,
      siteName: "Vyso",
      locale: "en_ZA",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
    },
    twitter: {
      card: "summary_large_image",
      title: resource.title,
      description: resource.description,
      images: ["/og.png"],
    },
  };
}

export default async function ResourceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resource = getResource(slug);
  if (!resource) notFound();

  const url = `https://vyso.co.za/resources/${slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: resource.title,
        description: resource.description,
        isPartOf: { "@id": "https://vyso.co.za/#website" },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: "en-ZA",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
          { "@type": "ListItem", position: 2, name: "Resources", item: "https://vyso.co.za/resources" },
          { "@type": "ListItem", position: 3, name: resource.shortName, item: url },
        ],
      },
    ],
  };

  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="resource-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Resources", href: "/resources" },
              { label: resource.shortName },
            ]}
          />
          <p className={styles.eyebrow}>{resource.eyebrow}</p>
          <h1 id="resource-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>{resource.heroPlain}</span>{" "}
            <span className={styles.blendAccent}>{resource.heroAccent}</span>
          </h1>
          <p className={styles.compactLead}>{resource.summary}</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="resource-fit-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Who it&apos;s for</p>
            <h2 id="resource-fit-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Built for a specific job, not everyone.
            </h2>
            <p className={styles.sectionCopy}>{resource.whoItsFor}</p>
          </div>
          <div>
            <p className={styles.sectionKicker}>What it helps you do</p>
            <ul className={styles.list}>
              {resource.whatItHelps.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="resource-preview-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Preview</p>
              <h2 id="resource-preview-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                What&apos;s actually inside.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              This is the real content, not a teaser. Requesting the resource
              gets you this in a format you can use directly with your team.
            </p>
          </div>

          <div className={styles.moduleGrid}>
            {resource.preview.map((section) => (
              <article key={section.heading} className={styles.moduleCard}>
                <p className={styles.cardKicker}>Section</p>
                <h3 className={styles.cardTitle}>{section.heading}</h3>
                <ul className={styles.list}>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="resource-request-heading">
        <div className={styles.shell}>
          <div className={styles.ctaCard} style={{ maxWidth: 720, marginInline: "auto" }}>
            <p className={styles.eyebrow}>Request this resource</p>
            <h2 id="resource-request-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Tell us where to send it.
            </h2>
            <p className={styles.ctaCopy}>
              Send your details and we&apos;ll get the {resource.shortName.toLowerCase()} to
              you directly. We&apos;ll also flag anything in your reply that looks
              worth a proper conversation.
            </p>
            <div style={{ textAlign: "left", marginTop: "2rem" }}>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="resource-related-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Keep exploring</p>
          <h2 id="resource-related-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Related reading and the solution behind it.
          </h2>
          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            <article className={styles.answerCard}>
              <h3>Related solution</h3>
              <p>
                {resource.shortName} connects most directly to how Vyso
                approaches {resource.relatedSolutionName.toLowerCase()}.
              </p>
              <div className={styles.cardFoot}>
                <Link className={styles.textLink} href={`/solutions/${resource.relatedSolutionSlug}`}>
                  {resource.relatedSolutionName} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
            <article className={styles.answerCard}>
              <h3>Related articles</h3>
              <p>Background reading on the problem this resource addresses.</p>
              <div className={styles.cardFoot} style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {resource.relatedArticles.map((article) => (
                  <Link key={article.href} className={styles.textLink} href={article.href}>
                    {article.title} <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </article>
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Beyond the checklist"
        title="Ready to see what this looks like as a working system?"
        copy="A resource can flag the problem. Vyso is built to fix the underlying workflow — configured around how your operation actually runs."
        primaryLabel="Join Waitlist"
        secondaryLabel="View all resources"
        secondaryHref="/resources"
      />
    </PublicPageShell>
  );
}
