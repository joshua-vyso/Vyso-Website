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
import RoiCalculator from "@/components/marketing/RoiCalculator";

const PAGE_TITLE = "ROI Calculator: Estimate Operational Savings | Vyso";
const PAGE_DESCRIPTION =
  "Estimate the hours and Rand value you could save by automating manual reporting, procurement admin and stock/wastage tracking — with every assumption visible and editable.";
const PAGE_URL = "https://vyso.co.za/roi-calculator";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/roi-calculator",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_URL,
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

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: PAGE_TITLE,
      description: PAGE_DESCRIPTION,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": `${PAGE_URL}#breadcrumb` },
      about: { "@id": "https://vyso.co.za/#organization" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${PAGE_URL}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "ROI Calculator", item: PAGE_URL },
      ],
    },
  ],
};

export default function RoiCalculatorPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="roi-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "ROI Calculator" },
            ]}
          />
          <p className={styles.eyebrow}>Free interactive tool</p>
          <h1 id="roi-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>What is manual work</span>{" "}
            <span className={styles.blendAccent}>actually costing you?</span>
          </h1>
          <p className={styles.compactLead}>
            Estimate the hours and Rand value your business could recover by
            automating manual reporting, procurement coordination and
            stock/wastage tracking. Every input and assumption below is yours
            to change — this is a starting estimate, not a quote.
          </p>
          <div className={styles.actions}>
            <Link className={styles.textLink} href="/pricing-faq">
              How Vyso is priced <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section
        className={styles.section}
        aria-labelledby="calculator-heading"
        style={{ paddingTop: 0 }}
      >
        <h2 id="calculator-heading" className="sr-only">
          ROI calculator
        </h2>
        <div className={styles.shell}>
          <RoiCalculator />
        </div>
      </section>

      <MarketingCta
        eyebrow="Still deciding?"
        title="Bring us your real numbers."
        copy="A one-week audit maps your actual workflow and confirms whether these estimates hold up — before you commit to an implementation."
        primaryLabel="Join Waitlist"
        secondaryLabel="Read the pricing FAQ"
        secondaryHref="/pricing-faq"
      />
    </PublicPageShell>
  );
}
