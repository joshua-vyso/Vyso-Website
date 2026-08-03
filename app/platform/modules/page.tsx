import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";
import { ScreenshotFrame } from "@/components/marketing/ScreenshotFrame";
import { MARKETING_MODULES } from "@/lib/marketing/modules";

import moduleStyles from "./modules.module.css";

const title = "All Modules | Vyso Operations Platform";
const description =
  "Every Vyso module in one place: OrderFlow, Doc-U, ProcurePulse, PricePilot, PlanWise, WasteWatch, ShiftBoard, SupplySync, InsightGen and ServiceDen — with real screenshots from the platform.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/platform/modules" },
  openGraph: {
    title,
    description,
    url: "/platform/modules",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://vyso.co.za/platform/modules#webpage",
      url: "https://vyso.co.za/platform/modules",
      name: title,
      description,
      isPartOf: { "@id": "https://vyso.co.za/#website" },
      breadcrumb: { "@id": "https://vyso.co.za/platform/modules#breadcrumb" },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": "https://vyso.co.za/platform/modules#breadcrumb",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Platform", item: "https://vyso.co.za/platform" },
        { "@type": "ListItem", position: 3, name: "All Modules", item: "https://vyso.co.za/platform/modules" },
      ],
    },
    {
      "@type": "ItemList",
      name: "Vyso modules",
      itemListElement: MARKETING_MODULES.map((module, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: module.name,
        description: module.description,
        url: `https://vyso.co.za/platform/modules/${module.slug}`,
      })),
    },
  ],
};

export default function AllModulesPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="all-modules-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Platform", href: "/platform" },
              { label: "All Modules" },
            ]}
          />
          <p className={styles.eyebrow}>The full module set</p>
          <h1 id="all-modules-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>One platform.</span>{" "}
            <span className={styles.blendAccent}>Every module your operation needs.</span>
          </h1>
          <p className={styles.compactLead}>
            Ten connected modules, each with one clear operational job. Below is
            every module with a look at the real screens — not mockups — plus
            what it does, who it&apos;s for and where it fits alongside the rest
            of the platform.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/platform/vyso-for-smes">
              Vyso for SMEs
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="modules-grid-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Browse every module</p>
              <h2 id="modules-grid-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Start with the workflow causing the most friction.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Each module shares customer, product, supplier and document context
              where the workflow requires it — so adding one doesn&apos;t mean
              adding another disconnected tool.
            </p>
          </div>

          <div className={moduleStyles.grid}>
            {MARKETING_MODULES.map((module) => {
              const primaryShot = module.screenshots[0];
              return (
                <Link
                  key={module.slug}
                  href={`/platform/modules/${module.slug}`}
                  className={moduleStyles.card}
                  aria-label={`Explore ${module.name}: ${module.role}`}
                >
                  {primaryShot ? (
                    <ScreenshotFrame
                      src={primaryShot.src}
                      alt={primaryShot.alt}
                      label={module.appUrlLabel}
                      cropTop={primaryShot.cropTop}
                    />
                  ) : (
                    <div className={moduleStyles.placeholder}>
                      <div className={moduleStyles.placeholderInner}>
                        <span className={moduleStyles.placeholderIcon}>
                          <LayoutGrid aria-hidden="true" size={20} />
                        </span>
                        <p className={moduleStyles.placeholderLabel}>Internal preview</p>
                        <p className={moduleStyles.placeholderNote}>
                          Piloted internally ahead of a wider release.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className={moduleStyles.cardBody}>
                    <p className={styles.cardKicker}>{module.role}</p>
                    <h3 className={styles.cardTitle} style={{ margin: 0 }}>{module.name}</h3>
                    <p className={styles.cardCopy}>{module.tagline}</p>
                    <span className={moduleStyles.cardFoot}>
                      Explore {module.name} <span aria-hidden="true">→</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Choose the first problem"
        title="You do not need to implement every module at once."
        copy="Start with the one-week audit, define the highest-value workflow and add the next module only when the need is clear."
        primaryLabel="Join Waitlist"
        secondaryLabel="See pricing"
        secondaryHref="/pricing"
      />
    </PublicPageShell>
  );
}
