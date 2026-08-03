import type { Metadata } from "next";
import Link from "next/link";
import { Award, ClipboardCheck, FileText } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";
import { RESOURCES } from "@/lib/marketing/resources";

const TITLE = "Free Operations Resources | Vyso";
const DESCRIPTION =
  "Practical checklists, templates and scorecards for South African SMEs — an operations audit checklist, a weekly operations report template and a supplier scorecard.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/resources",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
};

const RESOURCE_ICONS = [ClipboardCheck, FileText, Award] as const;

export default function ResourcesPage() {
  const url = "https://vyso.co.za/resources";
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { "@id": "https://vyso.co.za/#website" },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: "en-ZA",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
          { "@type": "ListItem", position: 2, name: "Resources", item: url },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${url}#itemlist`,
        itemListElement: RESOURCES.map((resource, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: resource.shortName,
          url: `${url}/${resource.slug}`,
        })),
      },
    ],
  };

  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="resources-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Resources" }]} />
          <p className={styles.eyebrow}>Free resources</p>
          <h1 id="resources-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Practical tools,</span>{" "}
            <span className={styles.blendAccent}>not another ebook.</span>
          </h1>
          <p className={styles.compactLead}>
            Checklists, templates and scorecards built from the same operational
            problems Vyso solves for South African SMEs. Request the one that
            matches what is breaking down for you right now.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="resources-list-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Start here</p>
              <h2 id="resources-list-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Three resources to get moving.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Each resource previews everything it contains before you request
              it. No downloads gated behind vague promises — just what a
              working checklist, template or scorecard should look like.
            </p>
          </div>

          <div className={styles.audienceGrid}>
            {RESOURCES.map((resource, index) => {
              const Icon = RESOURCE_ICONS[index % RESOURCE_ICONS.length];
              return (
                <article key={resource.slug} className={styles.glassCard}>
                  <span className={styles.cardIcon}>
                    <Icon aria-hidden="true" size={19} />
                  </span>
                  <p className={styles.cardKicker}>{resource.eyebrow}</p>
                  <h3 className={styles.cardTitle}>{resource.shortName}</h3>
                  <p className={styles.cardCopy}>{resource.summary}</p>
                  <div className={styles.cardFoot}>
                    <Link className={styles.textLink} href={`/resources/${resource.slug}`}>
                      Preview &amp; request <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Not sure which one fits"
        title="Tell us what's breaking down and we'll point you to the right resource."
        copy="If none of these three match your operation, send us the messy version anyway — we'll respond with something more useful than a generic template."
        primaryLabel="Join Waitlist"
        secondaryLabel="Read the Learn hub"
        secondaryHref="/learn"
      />
    </PublicPageShell>
  );
}
