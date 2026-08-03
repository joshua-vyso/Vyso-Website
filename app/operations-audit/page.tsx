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
import OperationsAudit from "@/components/marketing/OperationsAudit";

const PAGE_TITLE = "Interactive Operations Audit: Score Your Business | Vyso";
const PAGE_DESCRIPTION =
  "A free, guided self-assessment covering reporting, procurement, inventory, suppliers, approvals and finance visibility. Get an operations score out of 100, a risk level and your top 3 operational risks.";
const PAGE_URL = "https://vyso.co.za/operations-audit";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/operations-audit",
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
        { "@type": "ListItem", position: 2, name: "Operations Audit", item: PAGE_URL },
      ],
    },
  ],
};

export default function OperationsAuditPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="audit-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Operations Audit" },
            ]}
          />
          <p className={styles.eyebrow}>Free guided self-assessment</p>
          <h1 id="audit-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>How exposed is</span>{" "}
            <span className={styles.blendAccent}>your operation, really?</span>
          </h1>
          <p className={styles.compactLead}>
            Answer 10 quick questions about reporting, procurement, inventory,
            suppliers, approvals and finance visibility. You&apos;ll get an
            operations score out of 100, a risk level, your top 3 operational
            risks and recommended next steps — nothing is sent anywhere, the
            scoring happens entirely in your browser.
          </p>
          <div className={styles.actions}>
            <Link className={styles.textLink} href="/roi-calculator">
              Estimate the Rand value instead <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="audit-tool-heading" style={{ paddingTop: 0 }}>
        <h2 id="audit-tool-heading" className="sr-only">
          Operations audit
        </h2>
        <div className={styles.shell} style={{ maxWidth: 860, marginInline: "auto" }}>
          <OperationsAudit />
        </div>
      </section>

      <MarketingCta
        eyebrow="Prefer a conversation?"
        title="Skip the self-assessment. Talk to us directly."
        copy="A one-week audit maps the real workflow with your team and gives you a concrete, prioritised plan — not just a score."
        primaryLabel="Join Waitlist"
        secondaryLabel="Explore Vyso solutions"
        secondaryHref="/solutions"
      />
    </PublicPageShell>
  );
}
