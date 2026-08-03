import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileSpreadsheet } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const PAGE_TITLE = "Vyso Comparisons | Spreadsheets, ERP Systems & Vyso";
const PAGE_DESCRIPTION =
  "Fair, problem-led comparisons for South African SMEs deciding between spreadsheets, enterprise ERP systems and Vyso's configurable operations platform.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/compare",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/compare",
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

type ComparisonEntry = {
  slug: string;
  icon: typeof FileSpreadsheet;
  label: string;
  title: string;
  bestReadWhen: string;
  summary: string;
};

const COMPARISONS: readonly ComparisonEntry[] = [
  {
    slug: "vyso-vs-spreadsheets",
    icon: FileSpreadsheet,
    label: "Vyso vs Spreadsheets",
    title: "When spreadsheets stop being enough",
    bestReadWhen:
      "You're running purchasing, stock, orders or reporting out of Google Sheets or Excel, and it's starting to show.",
    summary:
      "Where spreadsheets genuinely work well, where they quietly break down as a team grows, and what changes with a connected workflow instead.",
  },
  {
    slug: "vyso-vs-erp-systems",
    icon: Building2,
    label: "Vyso vs ERP Systems",
    title: "When a full ERP programme isn't the right first step",
    bestReadWhen:
      "You're weighing a traditional enterprise ERP against a lighter, faster way to fix one operational problem first.",
    summary:
      "What ERP systems are built for, why they can be slow for a growing SME to adopt, and how a modular approach compares.",
  },
];

const url = "https://vyso.co.za/compare";

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
      about: { "@id": "https://vyso.co.za/#organization" },
      breadcrumb: { "@id": `${url}#breadcrumb` },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Compare", item: url },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${url}#comparisons`,
      itemListElement: COMPARISONS.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: entry.label,
        url: `${url}/${entry.slug}`,
      })),
    },
  ],
};

export default function ComparePage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="compare-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Compare" }]} />
          <p className={styles.eyebrow}>Choosing well</p>
          <h1 id="compare-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Which tool actually fits</span>{" "}
            <span className={styles.blendAccent}>your stage of growth?</span>
          </h1>
          <p className={styles.compactLead}>
            Spreadsheets, ERP systems and Vyso are all reasonable choices—just for
            different situations. These pages compare them honestly, so you can work
            out which one fits your business today, not just which one sounds bigger.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/faq#comparison">
              See the full fit comparison
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="compare-approach-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>How to use this page</p>
              <h2 id="compare-approach-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                No tool is right for every business.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Every option below solves real problems for real businesses. The useful
              question isn&apos;t which one is universally better—it&apos;s which one
              matches the size, complexity and stage of the operation you&apos;re
              running right now.
            </p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="compare-pages-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Pick a comparison</p>
          <h2 id="compare-pages-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Start with what you use today.
          </h2>
          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            {COMPARISONS.map(({ slug, icon: Icon, label, title, bestReadWhen, summary }) => (
              <article key={slug} className={styles.glassCard}>
                <span className={styles.cardIcon}>
                  <Icon aria-hidden="true" size={19} />
                </span>
                <p className={styles.cardKicker}>{label}</p>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardCopy}>{summary}</p>
                <p className={styles.cardCopy} style={{ marginTop: "0.75rem", fontWeight: 700 }}>
                  Read this if: {bestReadWhen}
                </p>
                <div className={styles.cardFoot}>
                  <Link className={styles.textLink} href={`/compare/${slug}`}>
                    Compare now <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Still not sure?"
        title="Tell us what you're using today—we'll help you work out the honest answer."
        copy="If a spreadsheet or an off-the-shelf tool already fits, we'll say so. If your operation has outgrown it, we'll show you where Vyso fits instead."
        primaryLabel="Join Waitlist"
        secondaryLabel="View the platform"
        secondaryHref="/platform"
      />
    </PublicPageShell>
  );
}
