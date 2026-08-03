import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Sprout,
  Truck,
  UtensilsCrossed,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const title = "Industries | Vyso Operations Software";
const description =
  "Vyso configures the same connected operations platform around how restaurants, food suppliers, farms, caterers, wholesalers and hospitality operators actually work.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/industries" },
  openGraph: {
    title,
    description,
    url: "/industries",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

type IndustrySummary = {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
};

const INDUSTRY_SUMMARIES: readonly IndustrySummary[] = [
  {
    slug: "restaurants",
    name: "Restaurants",
    description: "Procurement, waste, staffing, pricing and daily operational reporting behind every service.",
    icon: UtensilsCrossed,
  },
  {
    slug: "food-suppliers",
    name: "Food suppliers",
    description: "Customer orders, pricing, invoicing, delivery documents and payments in one connected flow.",
    icon: Truck,
  },
  {
    slug: "farms",
    name: "Farms & producers",
    description: "Repeat buyer orders, availability, pricing, delivery documents and payments in one workflow.",
    icon: Sprout,
  },
  {
    slug: "catering-companies",
    name: "Catering companies",
    description: "Event costing, procurement, production planning, invoicing and wastage under weekly control.",
    icon: CalendarClock,
  },
  {
    slug: "wholesale",
    name: "Wholesale",
    description: "Purchasing, inventory movement, order processing, supplier management and margin control.",
    icon: Warehouse,
  },
  {
    slug: "hospitality",
    name: "Hospitality",
    description: "Multi-department visibility, supplier control, procurement approvals and executive dashboards.",
    icon: Building2,
  },
] as const;

const url = "https://vyso.co.za/industries";

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
        { "@type": "ListItem", position: 2, name: "Industries", item: url },
      ],
    },
    {
      "@type": "ItemList",
      "@id": `${url}#list`,
      itemListElement: INDUSTRY_SUMMARIES.map((industry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: industry.name,
        url: `https://vyso.co.za/industries/${industry.slug}`,
      })),
    },
  ],
};

export default function IndustriesLandingPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="industries-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Industries" }]} />
          <p className={styles.eyebrow}>Vyso by industry</p>
          <h1 id="industries-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>The same platform.</span>{" "}
            <span className={styles.blendAccent}>Configured around your operation.</span>
          </h1>
          <p className={styles.compactLead}>
            Vyso does not change the product for each industry—it changes which
            modules matter first and how they are configured. These are the
            operations we already understand deeply.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/platform">
              Explore the platform
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="industries-list-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Where Vyso starts</p>
              <h2 id="industries-list-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Find the operation that looks like yours.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Each page covers the specific gaps, module shape, outcomes and
              questions relevant to that industry—not a relabelled version of
              the same page.
            </p>
          </div>

          <div className={styles.moduleGrid}>
            {INDUSTRY_SUMMARIES.map(({ slug, name, description: industryDescription, icon: Icon }) => (
              <Link key={slug} href={`/industries/${slug}`} className={styles.moduleCard}>
                <span className={styles.cardIcon}><Icon aria-hidden="true" size={19} /></span>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardCopy}>{industryDescription}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Not sure where you fit"
        title="Tell us how your business actually operates."
        copy="If your operation does not fit neatly into one of these industries, the audit still applies. We will map the real workflow and tell you honestly whether Vyso is the right system."
        primaryLabel="Join Waitlist"
        secondaryLabel="View the platform"
        secondaryHref="/platform"
      />
    </PublicPageShell>
  );
}
