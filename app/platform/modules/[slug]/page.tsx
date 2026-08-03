import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
import {
  MARKETING_MODULE_BY_SLUG,
  MARKETING_MODULE_SLUGS,
  getAdjacentModules,
} from "@/lib/marketing/modules";
import type { ModuleFeatureSection } from "@/lib/marketing/modules";

import moduleStyles from "../modules.module.css";

const SOLUTION_LABELS: Record<string, string> = {
  "/solutions/reduce-money-leakage": "Reduce money leakage",
  "/solutions/procurement-automation": "Procurement automation",
  "/solutions/reporting-automation": "Reporting automation",
  "/solutions/operations-dashboard": "Operations dashboard",
};

/** Sizes hint for the one large above-the-fold frame. */
const HERO_SIZES = "(max-width: 760px) 92vw, (max-width: 1100px) 88vw, 880px";
/** Sizes hint for the half-width frames inside the alternating feature rows. */
const FEATURE_SIZES = "(max-width: 760px) 92vw, (max-width: 1020px) 88vw, 560px";

export function generateStaticParams() {
  return MARKETING_MODULE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const module_ = MARKETING_MODULE_BY_SLUG[slug];
  if (!module_) return {};

  const title = `${module_.name} | ${module_.role} | Vyso`;
  const description = module_.description;

  return {
    title,
    description,
    alternates: { canonical: `/platform/modules/${slug}` },
    openGraph: {
      title,
      description,
      url: `/platform/modules/${slug}`,
      siteName: "Vyso",
      locale: "en_ZA",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

/** The media column of a feature row: a real screenshot, or a gradient surface panel. */
function FeatureMedia({ section }: { section: ModuleFeatureSection }) {
  if (section.screenshot) {
    return (
      <div className={moduleStyles.featureMedia}>
        <ScreenshotFrame
          src={section.screenshot.src}
          alt={section.screenshot.alt}
          label={section.screenshot.label}
          cropTop={section.screenshot.cropTop}
          sizes={FEATURE_SIZES}
        />
      </div>
    );
  }

  return (
    <div className={moduleStyles.featureMedia}>
      <div className={moduleStyles.surfacePanel}>
        <div className={moduleStyles.placeholderInner}>
          <span className={moduleStyles.placeholderIcon}>
            <LayoutGrid aria-hidden="true" size={20} />
          </span>
          <p className={moduleStyles.placeholderLabel}>{section.title}</p>
          <div className={moduleStyles.placeholderTags}>
            {(section.placeholderTags ?? []).map((tag) => (
              <span key={tag} className={moduleStyles.placeholderTag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const module_ = MARKETING_MODULE_BY_SLUG[slug];
  if (!module_) notFound();

  const { previous, next } = getAdjacentModules(slug);
  const url = `https://vyso.co.za/platform/modules/${slug}`;
  const title = `${module_.name} | ${module_.role} | Vyso`;
  const heroShot = module_.screenshots[0];

  const worksWith = module_.worksWith
    .map((entry) => ({ ...entry, module: MARKETING_MODULE_BY_SLUG[entry.slug] }))
    .filter((entry) => Boolean(entry.module));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description: module_.description,
        isPartOf: { "@id": "https://vyso.co.za/#website" },
        about: { "@id": `${url}#software` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        inLanguage: "en-ZA",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
          { "@type": "ListItem", position: 2, name: "Platform", item: "https://vyso.co.za/platform" },
          { "@type": "ListItem", position: 3, name: "All Modules", item: "https://vyso.co.za/platform/modules" },
          { "@type": "ListItem", position: 4, name: module_.name, item: url },
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#software`,
        name: module_.name,
        applicationCategory: "BusinessApplication",
        applicationSuite: "Vyso",
        operatingSystem: "Web browser",
        description: module_.description,
        publisher: { "@id": "https://vyso.co.za/#organization" },
        featureList: module_.capabilities,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        isPartOf: { "@id": `${url}#webpage` },
        inLanguage: "en-ZA",
        mainEntity: module_.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="module-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Platform", href: "/platform" },
              { label: "All Modules", href: "/platform/modules" },
              { label: module_.name },
            ]}
          />
          <p className={styles.eyebrow}>{module_.role}</p>
          <h1 id="module-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>{module_.name}.</span>{" "}
            <span className={styles.blendAccent}>{module_.tagline}</span>
          </h1>
          <p className={styles.compactLead}>{module_.description}</p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/platform/modules">
              All modules
            </Link>
          </div>

          <div style={{ maxWidth: heroShot ? 880 : 640, margin: "3.2rem auto 0" }}>
            {heroShot ? (
              <ScreenshotFrame
                src={heroShot.src}
                alt={heroShot.alt}
                label={heroShot.label}
                cropTop={heroShot.cropTop}
                sizes={HERO_SIZES}
                priority
              />
            ) : (
              <div className={moduleStyles.placeholder}>
                <div className={moduleStyles.placeholderInner}>
                  <span className={moduleStyles.placeholderIcon}>
                    <LayoutGrid aria-hidden="true" size={22} />
                  </span>
                  <p className={moduleStyles.placeholderLabel}>Internal preview</p>
                  <p className={moduleStyles.placeholderNote}>
                    {module_.name} runs internally at Vyso and with selected
                    service businesses, so there are no public screenshots yet.
                    Here is what it currently covers:
                  </p>
                  <div className={moduleStyles.placeholderTags}>
                    <span className={moduleStyles.placeholderTag}>Leads</span>
                    <span className={moduleStyles.placeholderTag}>Research</span>
                    <span className={moduleStyles.placeholderTag}>Templates</span>
                    <span className={moduleStyles.placeholderTag}>Invoices</span>
                    <span className={moduleStyles.placeholderTag}>Gmail-linked drafts</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="module-inside-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Inside {module_.name}</p>
              <h2 id="module-inside-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Feature by feature, on the real screens.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              {heroShot
                ? "Every screen below was captured from the running platform with a demo organisation — not drawn as a mockup. The labels, columns and tiles are the ones your team would work in."
                : `${module_.name} is not publicly available yet, so the panels below stand in for the screens. Everything described is built and working — it is access that is limited, not the functionality.`}
            </p>
          </div>

          <div className={moduleStyles.featureList}>
            {module_.featureSections.map((section, index) => {
              const ordinal = String(index + 1).padStart(2, "0");

              // Sections with no screen to show become one wide glass card, so
              // the alternating rhythm of the screenshot rows is not broken by
              // a lopsided empty column.
              if (!section.screenshot && !section.placeholderTags) {
                return (
                  <article key={section.id} id={section.id} className={moduleStyles.featureSolo}>
                    <div className={moduleStyles.featureCopy}>
                      <p className={moduleStyles.featureIndex}>{ordinal}</p>
                      <h3 className={moduleStyles.featureTitle}>{section.title}</h3>
                      <p className={moduleStyles.featureCopyText}>{section.copy}</p>
                    </div>
                    <ul className={moduleStyles.featureBullets}>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              }

              return (
                <article
                  key={section.id}
                  id={section.id}
                  className={
                    index % 2 === 1
                      ? `${moduleStyles.featureRow} ${moduleStyles.featureRowFlipped}`
                      : moduleStyles.featureRow
                  }
                >
                  <div className={moduleStyles.featureCopy}>
                    <p className={moduleStyles.featureIndex}>{ordinal}</p>
                    <h3 className={moduleStyles.featureTitle}>{section.title}</h3>
                    <p className={moduleStyles.featureCopyText}>{section.copy}</p>
                    <ul className={moduleStyles.featureBullets}>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <FeatureMedia section={section} />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="module-workflow-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>How it fits your week</p>
              <h2 id="module-workflow-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                The routine, not the feature list.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Software only helps if it changes what someone actually does on a
              Tuesday. This is the working rhythm {module_.name} is built around.
            </p>
          </div>

          <ol className={moduleStyles.workflowList}>
            {module_.workflow.map((step, index) => (
              <li key={step.title} className={moduleStyles.workflowStep}>
                <span className={moduleStyles.workflowNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={moduleStyles.workflowTitle}>{step.title}</h3>
                <p className={moduleStyles.workflowCopy}>{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {worksWith.length > 0 ? (
        <section className={styles.section} aria-labelledby="module-works-with-heading">
          <div className={styles.shell}>
            <div className={styles.sectionIntro}>
              <div>
                <p className={styles.sectionKicker}>Works with the rest of Vyso</p>
                <h2
                  id="module-works-with-heading"
                  className={`${styles.sectionTitle} ${styles.blendPlain}`}
                >
                  Connected where the workflow needs it.
                </h2>
              </div>
              <p className={styles.sectionCopy}>
                These are real data relationships, not a logo wall. Each one
                describes what actually moves between {module_.name} and the
                module beside it.
              </p>
            </div>

            <div className={moduleStyles.linkCardGrid}>
              {worksWith.map((entry) => (
                <Link
                  key={entry.slug}
                  href={`/platform/modules/${entry.slug}`}
                  className={moduleStyles.linkCard}
                >
                  <p className={styles.cardKicker}>{entry.module.role}</p>
                  <h3 className={moduleStyles.linkCardName}>{entry.module.name}</h3>
                  <p className={moduleStyles.linkCardReason}>{entry.reason}</p>
                  <span className={moduleStyles.linkCardFoot}>
                    Explore {entry.module.name} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {module_.industryFit.length > 0 ? (
        <section className={styles.section} aria-labelledby="module-industry-heading">
          <div className={styles.shell}>
            <div className={styles.sectionIntro}>
              <div>
                <p className={styles.sectionKicker}>Who it&apos;s for</p>
                <h2
                  id="module-industry-heading"
                  className={`${styles.sectionTitle} ${styles.blendPlain}`}
                >
                  Where {module_.name} earns its place.
                </h2>
              </div>
            </div>

            <div className={moduleStyles.linkCardGrid}>
              {module_.industryFit.map((industry) => (
                <Link key={industry.href} href={industry.href} className={moduleStyles.linkCard}>
                  <h3 className={moduleStyles.linkCardName}>{industry.name}</h3>
                  <p className={moduleStyles.linkCardReason}>{industry.reason}</p>
                  <span className={moduleStyles.linkCardFoot}>
                    Vyso for {industry.name.toLowerCase()} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="module-faq-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Straight answers</p>
              <h2 id="module-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                {module_.name} questions, answered honestly.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Including the parts that are still on the roadmap. You should be
              able to plan around what exists today, not around a promise.
            </p>
          </div>

          <div className={styles.answerGrid}>
            {module_.faqs.map((faq) => (
              <article key={faq.question} className={styles.answerCard}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="module-related-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker} id="module-related-heading">
            Where this fits
          </p>
          <h2 className={`${styles.sectionTitle} ${styles.blendPlain}`}>Related solutions.</h2>
          <div className={styles.actions}>
            {module_.relatedSolutionHrefs.map((href) => (
              <Link key={href} className={styles.textLink} href={href}>
                {SOLUTION_LABELS[href] ?? href} <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Wayfinding, not content — deliberately a single low row rather than a
          full marketing section. See `.navSection` in modules.module.css. */}
      <section className={moduleStyles.navSection} aria-labelledby="module-nav-heading">
        <div className={styles.shell}>
          <p
            className={`${styles.sectionKicker} ${moduleStyles.navKicker}`}
            id="module-nav-heading"
          >
            More modules
          </p>
          <div className={moduleStyles.navRow}>
            <Link className={moduleStyles.navLink} href={`/platform/modules/${previous.slug}`}>
              <span className={moduleStyles.navLabel}>← Prev</span>
              <span className={moduleStyles.navName}>{previous.name}</span>
            </Link>
            <Link
              className={`${moduleStyles.navLink} ${moduleStyles.navLinkNext}`}
              href={`/platform/modules/${next.slug}`}
            >
              <span className={moduleStyles.navName}>{next.name}</span>
              <span className={moduleStyles.navLabel}>Next →</span>
            </Link>
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="See it on your own operation"
        title={`Show us where ${module_.name.toLowerCase()} would fit in your workflow.`}
        copy="We will map the actual workflow, identify the highest-value gap and tell you honestly whether Vyso is the right system to address it."
        primaryLabel="Join Waitlist"
        secondaryLabel="All modules"
        secondaryHref="/platform/modules"
      />
    </PublicPageShell>
  );
}
