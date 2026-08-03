import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FileCheck2, ListChecks, RefreshCw, UsersRound } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "Case Studies | Vyso Operations Software";
const description =
  "Real founding-customer stories showing how Vyso is replacing manual invoicing, pricing and operational admin—starting with Turn 'n Slice in Johannesburg.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/case-studies" },
  openGraph: {
    title,
    description,
    url: "/case-studies",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const url = "https://vyso.co.za/case-studies";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": `${url}#breadcrumb` },
      mainEntity: { "@id": `${url}#list` },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Case studies", item: url },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${url}#list`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Turn 'n Slice",
          url: "https://vyso.co.za/case-studies/turn-n-slice",
        },
      ],
    },
  ],
};

export default function CaseStudiesLandingPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="case-studies-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Case studies" }]} />
          <p className={styles.eyebrow}>Proof, not promises</p>
          <h1 id="case-studies-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Real operations.</span>{" "}
            <span className={styles.blendAccent}>Real change.</span>
          </h1>
          <p className={styles.compactLead}>
            Vyso is early. Rather than publish a wall of logos, we are
            documenting founding-customer implementations honestly as they
            happen—starting with the first one, in Johannesburg.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/founding-client">
              Founding-client programme
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="turn-n-slice-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Founding-customer story</p>
              <h2 id="turn-n-slice-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Turn &apos;n Slice: one operational brain for invoicing.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              A Johannesburg FMCG food business, and Vyso&apos;s first founding
              customer. OrderFlow is already replacing QuickBooks as its
              invoicing system, bringing price lists, customer accounts,
              quotes, orders, invoices and payments into one connected
              workflow.
            </p>
          </div>

          <Link href="/case-studies/turn-n-slice" className={styles.proofGrid}>
            <div className={styles.logoCard}>
              <Image
                src="/turn-n-slice-logo-clean.png"
                alt="Turn n Slice"
                width={500}
                height={500}
                sizes="(max-width: 760px) 70vw, 420px"
              />
            </div>
            <div className={styles.answerCard}>
              <p className={styles.cardKicker}>Read the case study</p>
              <h3 style={{ marginTop: "0.6rem" }}>
                Replacing invoicing admin with one operational brain
              </h3>
              <p>
                Price lists in seconds, central customer accounts and
                connected invoicing—see how OrderFlow is changing the way Turn
                &apos;n Slice runs its commercial operation.
              </p>
              <div className={styles.actions}>
                <span className={styles.textLink}>
                  Read the full story <span aria-hidden="true">→</span>
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="more-stories-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>What we are building toward</p>
            <h2 id="more-stories-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              More stories, as they become real.
            </h2>
            <p className={styles.sectionCopy}>
              Every new case study will be a genuine founding customer, with
              approved metrics and quotes—not a composite or a projection. As
              more operations go live on Vyso, their results will be added
              here.
            </p>
          </div>
          <ul className={styles.list}>
            {[
              { icon: ListChecks, text: "Documented before-and-after workflows, not just headline numbers." },
              { icon: FileCheck2, text: "Metrics and quotes published only with the customer's approval." },
              { icon: UsersRound, text: "Stories drawn from the industries Vyso already understands—food, catering, wholesale and hospitality." },
              { icon: RefreshCw, text: "Updated as founding-client implementations mature." },
            ].map(({ text }) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      </section>

      <MarketingCta
        eyebrow="Become the next story"
        title="Join as a founding client and help write the next case study."
        copy="Founding clients get hands-on implementation and a direct role in shaping the platform. If it works, we will document it properly and ask before we publish anything."
        primaryLabel="Join Waitlist"
        secondaryLabel="Founding-client programme"
        secondaryHref="/founding-client"
      />
    </PublicPageShell>
  );
}
