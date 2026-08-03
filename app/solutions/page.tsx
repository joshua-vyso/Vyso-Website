import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

import { SOLUTIONS } from "./[slug]/page";

const PAGE_TITLE = "Solutions | Vyso Operations Software for South African SMEs";
const PAGE_DESCRIPTION =
  "Explore Vyso's solutions for reducing money leakage, automating procurement, replacing manual reporting and building one connected operations dashboard.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/solutions" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "https://vyso.co.za/solutions",
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

// Fixed presentation order (matches WEBSITE_EXPANSION_PLAN.md §3 priority list).
const SOLUTION_ORDER = [
  "reduce-money-leakage",
  "procurement-automation",
  "reporting-automation",
  "operations-dashboard",
] as const;

const SOLUTION_CARDS = SOLUTION_ORDER.map((slug) => ({ slug, ...SOLUTIONS[slug] }));

const CHOOSE_BY_SYMPTOM = [
  {
    symptom: "Costs feel higher than they should be, but nobody can say exactly why.",
    slug: "reduce-money-leakage",
  },
  {
    symptom: "Purchasing runs on WhatsApp messages and someone's memory of the price.",
    slug: "procurement-automation",
  },
  {
    symptom: "Someone spends hours every week rebuilding the same report by hand.",
    slug: "reporting-automation",
  },
  {
    symptom: "Leadership checks five spreadsheets to get a partial view of the business.",
    slug: "operations-dashboard",
  },
] as const;

const url = "https://vyso.co.za/solutions";

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
        { "@type": "ListItem", position: 2, name: "Solutions", item: url },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${url}#solutions`,
      itemListElement: SOLUTION_CARDS.map((solution, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: solution.shortName,
        url: `https://vyso.co.za/solutions/${solution.slug}`,
      })),
    },
  ],
};

export default function SolutionsPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="solutions-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Solutions" }]} />
          <p className={styles.eyebrow}>Solutions</p>
          <h1 id="solutions-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Fix the problem,</span>{" "}
            <span className={styles.blendAccent}>not just the symptom.</span>
          </h1>
          <p className={styles.compactLead}>
            Most businesses don&apos;t start by searching for &quot;operations software&quot;.
            They start with a specific problem—money that&apos;s hard to account for,
            purchasing that runs on WhatsApp, a report someone rebuilds every week. Start
            with what&apos;s actually costing you time and money.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/industries">
              Browse by industry
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solutions-grid-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Where to start</p>
              <h2 id="solutions-grid-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Four high-impact places to begin.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Each solution targets a specific operational gap—visibility, purchasing,
              reporting or a connected view of the business. They can be implemented on
              their own or combined as the need becomes clear.
            </p>
          </div>

          <div className={styles.moduleGrid}>
            {SOLUTION_CARDS.map((solution) => (
              <article key={solution.slug} className={styles.glassCard}>
                <p className={styles.cardKicker}>{solution.eyebrow}</p>
                <h3 className={styles.cardTitle}>{solution.shortName}</h3>
                <p className={styles.cardCopy}>{solution.summary}</p>
                <div className={styles.cardFoot}>
                  <Link className={styles.textLink} href={`/solutions/${solution.slug}`}>
                    Explore solution <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solutions-symptom-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Not sure where to start?</p>
            <h2 id="solutions-symptom-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Match the symptom.
            </h2>
            <p className={styles.sectionCopy}>
              These are common early signs. If more than one sounds familiar, the
              one-week audit will confirm which gap is worth solving first.
            </p>
          </div>
          <ul className={styles.list}>
            {CHOOSE_BY_SYMPTOM.map(({ symptom, slug }) => (
              <li key={slug}>
                <Link className={styles.textLink} href={`/solutions/${slug}`}>
                  {symptom}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <MarketingCta
        eyebrow="Start with the operation"
        title="Tell us what's actually going wrong."
        copy="We will map the workflow, identify the highest-value gap and tell you honestly whether Vyso is the right system to address it."
        primaryLabel="Join Waitlist"
        secondaryLabel="View the platform"
        secondaryHref="/platform"
      />
    </PublicPageShell>
  );
}
