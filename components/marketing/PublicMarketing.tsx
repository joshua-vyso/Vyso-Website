import type { ReactNode } from "react";
import Link from "next/link";

import { Navbar } from "@/components/Navbar";
import { LazyShaderBackground } from "./LazyShaderBackground";
import { SiteFooter } from "@/components/sections/SiteFooter";

import styles from "./public-marketing.module.css";

export { styles as marketingStyles };

export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    // `blend-surface` opts this whole tree (Navbar, page content, SiteFooter)
    // into the universal reactive text blend defined in app/globals.css, so
    // every text run — not just the display headings — shifts colour when the
    // shader's dark band sweeps behind it. See that file for the mechanism.
    <div className={`${styles.page} blend-surface`}>
      <LazyShaderBackground global />
      <Navbar visible />
      <main className={styles.main}>{children}</main>
      <SiteFooter />
    </div>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function Breadcrumbs({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AbstractFlowBackdrop({ quiet = false }: { quiet?: boolean }) {
  return (
    <div
      className={`${styles.abstractFlow} ${quiet ? styles.abstractFlowQuiet : ""}`}
      aria-hidden="true"
    >
      <span className={`${styles.flowRail} ${styles.flowRailOne}`} />
      <span className={`${styles.flowRail} ${styles.flowRailTwo}`} />
      <span className={`${styles.flowRail} ${styles.flowRailThree}`} />
      <span className={`${styles.flowGlow} ${styles.flowGlowOrange}`} />
      <span className={`${styles.flowGlow} ${styles.flowGlowBlue}`} />
    </div>
  );
}

export function MarketingCta({
  eyebrow,
  title,
  copy,
  primaryLabel = "Join Waitlist",
  primaryHref = "/contact",
  secondaryLabel,
  secondaryHref,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className={styles.ctaSection}>
      <div className={`${styles.shell} ${styles.ctaCard}`}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={`${styles.sectionTitle} ${styles.blendPlain}`}>{title}</h2>
        <p className={styles.ctaCopy}>{copy}</p>
        <div className={styles.actions}>
          <Link className={styles.primaryButton} href={primaryHref}>
            {primaryLabel} <span aria-hidden="true">→</span>
          </Link>
          {secondaryLabel && secondaryHref ? (
            <Link className={styles.glassButton} href={secondaryHref}>
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
