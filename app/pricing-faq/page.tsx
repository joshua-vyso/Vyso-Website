import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, ReceiptText } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const TITLE = "Pricing FAQ | How Vyso Is Priced";
const DESCRIPTION =
  "Straight answers about how Vyso is priced — modules, implementation, custom scoping, pilots, support and payback — without a hard sell before you're ready.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/pricing-faq",
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/pricing-faq",
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

type PricingFaqItem = {
  question: string;
  answer: string;
};

const PRICING_FAQS: readonly PricingFaqItem[] = [
  {
    question: "How is Vyso priced?",
    answer:
      "Vyso is priced based on your business size, operational complexity, modules, and integration requirements. Most teams start with a focused implementation around one or two high-impact workflows. Every engagement moves through a phased structure — a short paid audit, an implementation stage with a once-off setup component, and an ongoing monthly retainer — with the current published tiers and rates shown on our pricing page.",
  },
  {
    question: "Is pricing based on users, locations, or modules?",
    answer:
      "Mainly on modules and the scope of what's being implemented, rather than a strict per-seat licence fee. The number of locations, departments or integration points a workflow touches can add complexity, and therefore cost — that's assessed during scoping rather than charged as a flat per-user rate.",
  },
  {
    question: "Do you offer custom pricing?",
    answer:
      "Yes. Every implementation is scoped after we understand the workflow, so pricing is not a generic off-the-shelf package. The one-week operations audit is what turns a general conversation into a specific, costed recommendation for your business.",
  },
  {
    question: "Is there an implementation fee?",
    answer:
      "Yes. Implementation combines a once-off setup component with an ongoing monthly retainer — the setup covers configuring the workflow, migrating data and getting your team onboarded, while the retainer keeps the system running, maintained and improved afterwards. Current amounts by tier are published on our pricing page.",
  },
  {
    question: "What affects the cost of Vyso?",
    answer:
      "The main drivers are: how many modules or workflows are in scope, how many systems need to be integrated (POS, accounting, banking, supplier platforms), how many locations or departments are involved, how much historical data needs migrating, and how much customisation the workflow genuinely requires beyond what's already configurable.",
  },
  {
    question: "Can we start with one department or location?",
    answer:
      "Yes — that's the recommended approach for most businesses. Rather than implementing everything at once, we identify the single highest-value workflow during the audit, get that working properly, and expand to other departments or locations once it's proven.",
  },
  {
    question: "Do you offer a pilot?",
    answer:
      "The one-week operations audit functions as your low-commitment first step. It's a paid diagnostic rather than a free trial — we map your actual workflow, identify the highest-value gap, and give you a specific, honest recommendation before any larger implementation begins.",
  },
  {
    question: "What is included in support?",
    answer:
      "Every tier includes a defined support period immediately after setup. From there, the monthly retainer takes over — covering proactive maintenance, fixes, and ongoing improvements delivered on an agreed cycle. What's included scales with tier, and the specifics are published alongside pricing.",
  },
  {
    question: "How quickly can Vyso pay for itself?",
    answer:
      "It depends on how much your current manual work, wastage, reporting delays or procurement errors are actually costing you each month — which varies a lot by business. Use the ROI calculator to put your own numbers in and get a rough payback estimate, then we can validate it against your real workflow.",
  },
];

const pricingFaqUrl = "https://vyso.co.za/pricing-faq";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${pricingFaqUrl}#webpage`,
      url: pricingFaqUrl,
      name: TITLE,
      description: DESCRIPTION,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": `${pricingFaqUrl}#breadcrumb` },
      mainEntity: { "@id": `${pricingFaqUrl}#faq` },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${pricingFaqUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Pricing FAQ", item: pricingFaqUrl },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${pricingFaqUrl}#faq`,
      mainEntity: PRICING_FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

export default function PricingFaqPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="pricing-faq-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Pricing FAQ" }]} />
          <p className={styles.eyebrow}>Pricing, honestly</p>
          <h1 id="pricing-faq-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>What Vyso costs,</span>{" "}
            <span className={styles.blendAccent}>and what drives it.</span>
          </h1>
          <p className={styles.compactLead}>
            Vyso is priced based on your business size, operational complexity,
            modules, and integration requirements. Most teams start with a
            focused implementation around one or two high-impact workflows.
            Here&apos;s how that actually plays out.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/pricing">
              View pricing tiers
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pricing-faq-list-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Common questions</p>
              <h2 id="pricing-faq-list-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Nine questions we get before every audit.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              These answers explain the structure and the factors that move the
              number. For the current published rates by tier, see the pricing
              page — this page won&apos;t repeat figures that can change.
            </p>
          </div>

          <div className={styles.answerGrid}>
            {PRICING_FAQS.map(({ question, answer }) => (
              <article key={question} className={styles.answerCard}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pricing-faq-tools-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Work out your own numbers</p>
            <h2 id="pricing-faq-tools-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Two ways to get closer to a real figure.
            </h2>
            <p className={styles.sectionCopy}>
              A generic price range rarely means much on its own. These two
              resources give you something closer to your actual numbers before
              you speak to us.
            </p>
          </div>
          <div className={styles.answerGrid} style={{ gridTemplateColumns: "1fr" }}>
            <article className={styles.glassCard}>
              <span className={styles.cardIcon}>
                <Calculator aria-hidden="true" size={19} />
              </span>
              <h3 className={styles.cardTitle}>ROI calculator</h3>
              <p className={styles.cardCopy}>
                Estimate the hours and Rand value currently lost to manual work,
                reporting delays and stock or wastage loss — and a rough
                payback period for closing that gap.
              </p>
              <div className={styles.cardFoot}>
                <Link className={styles.textLink} href="/roi-calculator">
                  Open the ROI calculator <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
            <article className={styles.glassCard}>
              <span className={styles.cardIcon}>
                <ReceiptText aria-hidden="true" size={19} />
              </span>
              <h3 className={styles.cardTitle}>Published pricing</h3>
              <p className={styles.cardCopy}>
                See the current audit fee and the Start, Create and Scale tiers
                — including once-off setup and monthly retainer amounts for
                each.
              </p>
              <div className={styles.cardFoot}>
                <Link className={styles.textLink} href="/pricing">
                  View pricing <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Ready for a specific number"
        title="Get a recommendation shaped by your actual workflow."
        copy="The one-week audit turns these general answers into a specific, costed recommendation for your business — no obligation to proceed after it."
        primaryLabel="Join Waitlist"
        secondaryLabel="Read the general FAQ"
        secondaryHref="/faq"
      />
    </PublicPageShell>
  );
}
