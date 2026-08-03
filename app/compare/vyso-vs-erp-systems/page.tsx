import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Layers,
  RefreshCw,
} from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const PAGE_TITLE = "Vyso vs ERP Systems | A Lighter Way to Fix One Workflow First";
const PAGE_DESCRIPTION =
  "A fair comparison of enterprise ERP systems and Vyso for South African SMEs: what ERP is built for, where it's slow for a growing business, and how a modular approach differs.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/compare/vyso-vs-erp-systems",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/compare/vyso-vs-erp-systems",
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

const STRENGTHS: readonly string[] = [
  "Built for organisations that genuinely need broad, formal resource planning across many departments.",
  "One system of record for large or complex businesses with the internal capacity to run a multi-module programme.",
  "Strong at standardising process across multiple entities, sites or business units at once.",
  "The right category when the requirement is a business-wide platform, not a single operational fix.",
];

const BREAKDOWNS: readonly { title: string; copy: string; icon: typeof AlertTriangle }[] = [
  {
    title: "Go-live is measured in months, not weeks",
    copy: "A full ERP rollout typically means scoping, configuring and testing many modules before the business sees any value at all.",
    icon: AlertTriangle,
  },
  {
    title: "It often assumes business-wide adoption on day one",
    copy: "Even if only one workflow is causing pain, many ERP programmes are structured around replacing everything at once.",
    icon: AlertTriangle,
  },
  {
    title: "It expects internal project capacity",
    copy: "A dedicated project team, IT resourcing and change-management effort are usually assumed—capacity a growing SME may not have to spare.",
    icon: AlertTriangle,
  },
  {
    title: "Cost and complexity scale before value does",
    copy: "Licensing, consulting and configuration cost can be significant before the first workflow is actually delivering time or money back.",
    icon: AlertTriangle,
  },
];

const DIFFERENCES: readonly string[] = [
  "Starts with the single highest-value operational gap, not a business-wide rollout.",
  "Configured around the workflow you actually run, rather than requiring the workflow to fit the software.",
  "Modules are added only once the next need is clear, so scope grows with the business.",
  "Implementation, configuration and ongoing support sit within one working relationship.",
];

type TableRow = { criterion: string; erp: string; vyso: string };

const COMPARISON_ROWS: readonly TableRow[] = [
  {
    criterion: "Time to first value",
    erp: "Often months of configuration before go-live",
    vyso: "Starts with one workflow, live in weeks",
  },
  {
    criterion: "Starting scope",
    erp: "Frequently business-wide from the outset",
    vyso: "Begins with the highest-value operational gap",
  },
  {
    criterion: "Internal capacity needed",
    erp: "Dedicated project team and IT resourcing assumed",
    vyso: "Guided implementation, minimal internal lift",
  },
  {
    criterion: "Cost to start",
    erp: "High upfront licensing and consulting cost",
    vyso: "Scoped to the workflow being solved",
  },
  {
    criterion: "Configurability",
    erp: "Powerful, but heavy customisation projects",
    vyso: "Configured around your actual process",
  },
  {
    criterion: "Best-fit business size",
    erp: "Large, complex or multi-entity organisations",
    vyso: "Growing SMEs that have outgrown manual tools",
  },
  {
    criterion: "Adding scope later",
    erp: "New change requests, new project phases",
    vyso: "Add modules once the next need is clear",
  },
  {
    criterion: "Ongoing support",
    erp: "Formal support contracts and ticket queues",
    vyso: "Hands-on implementation partner, built in",
  },
];

const MIGRATION_STEPS: readonly { title: string; copy: string; icon: typeof ClipboardList }[] = [
  {
    title: "Audit the real bottleneck",
    copy: "The one-week audit maps the actual workflow causing the most friction, rather than assuming the whole operation needs replacing.",
    icon: ClipboardList,
  },
  {
    title: "Agree the first module",
    copy: "One high-value operational area is scoped and configured first, so value is visible before anything else is committed to.",
    icon: Layers,
  },
  {
    title: "Configure, connect and test",
    copy: "The workflow is configured around your process, with any relevant existing systems connected and confirmed during scoping.",
    icon: RefreshCw,
  },
  {
    title: "Go live, then expand deliberately",
    copy: "Further modules are added only once the next operational need is clear—not on a fixed programme timeline.",
    icon: CheckCircle2,
  },
];

const FAQS: readonly { question: string; answer: string }[] = [
  {
    question: "Is Vyso trying to replace enterprise ERP systems?",
    answer:
      "No. Large or complex organisations that genuinely need broad, formal resource planning are usually better served by an enterprise ERP with the internal capacity to run that programme. Vyso is built for growing SMEs that need to fix one or two operational problems well.",
  },
  {
    question: "Can Vyso grow into something closer to an ERP over time?",
    answer:
      "Vyso can expand module by module as new operational needs become clear. It isn't positioned as a full enterprise resource-planning replacement, but it can cover meaningfully more of the operation as the business grows and the fit is confirmed.",
  },
  {
    question: "Do we need an internal project team to implement Vyso?",
    answer:
      "No dedicated internal project team is assumed. Implementation is hands-on: we map the workflow, configure the system and help your team adopt it, with support continuing after launch.",
  },
  {
    question: "How do we know if we need an ERP instead of Vyso?",
    answer:
      "If the requirement is a formal, business-wide resource-planning programme across many departments and entities, an ERP is likely the right category. If the priority is fixing a specific operational bottleneck without a multi-month rollout, that's the situation Vyso is built for. The first conversation is for testing that fit honestly.",
  },
];

const url = "https://vyso.co.za/compare/vyso-vs-erp-systems";

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
      mainEntity: { "@id": `${url}#faq` },
      inLanguage: "en-ZA",
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
        { "@type": "ListItem", position: 2, name: "Compare", item: "https://vyso.co.za/compare" },
        { "@type": "ListItem", position: 3, name: "Vyso vs ERP Systems", item: url },
      ],
    },
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: FAQS.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

const tableWrapperStyle: CSSProperties = {
  overflowX: "auto",
  marginTop: "2.5rem",
  border: "1px solid rgb(255 255 255 / 72%)",
  borderRadius: 20,
  background: "rgb(255 255 255 / 57%)",
  boxShadow:
    "inset 0 1.5px 0 rgb(255 255 255 / 90%), inset 0 -1px 0 rgb(0 0 0 / 4%), 0 0 0 0.5px rgb(255 255 255 / 28%), 0 18px 56px rgb(0 0 0 / 9%)",
  backdropFilter: "blur(24px) saturate(1.8)",
  WebkitBackdropFilter: "blur(24px) saturate(1.8)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 680,
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "1rem 1.35rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--marketing-ink)",
  borderBottom: "1px solid rgb(13 13 13 / 10%)",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "1rem 1.35rem",
  fontSize: "0.86rem",
  lineHeight: 1.55,
  color: "var(--marketing-body)",
  borderBottom: "1px solid rgb(13 13 13 / 6%)",
  verticalAlign: "top",
};

const vysoCellStyle: CSSProperties = {
  ...tdStyle,
  color: "var(--marketing-ink)",
  fontWeight: 600,
  background: "rgb(190 93 35 / 6%)",
};

export default function VysoVsErpSystemsPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="compare-erp-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Compare", href: "/compare" },
              { label: "Vyso vs ERP Systems" },
            ]}
          />
          <p className={styles.eyebrow}>Vyso vs ERP Systems</p>
          <h1 id="compare-erp-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>ERP is built for the enterprise.</span>{" "}
            <span className={styles.blendAccent}>Vyso starts with one workflow.</span>
          </h1>
          <p className={styles.compactLead}>
            Enterprise ERP systems are a serious, capable category—for the businesses
            that actually need one. This page looks honestly at what ERP is built for,
            where it&apos;s slow going for a growing SME, and how a modular approach compares.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/compare">
              See all comparisons
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="erp-good-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Where ERP genuinely fits</p>
            <h2 id="erp-good-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              A serious tool for a serious scope.
            </h2>
            <p className={styles.sectionCopy}>
              For the right organisation, an enterprise ERP is the correct category of
              tool—not a fallback.
            </p>
          </div>
          <ul className={styles.list}>
            {STRENGTHS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="erp-break-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Where it&apos;s slow for a growing SME</p>
              <h2 id="erp-break-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                The size of the programme becomes the problem.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              This isn&apos;t a knock against ERP as a category. It&apos;s what happens when a
              business-wide programme is applied to a business that needed one
              workflow fixed.
            </p>
          </div>
          <div className={styles.answerGrid}>
            {BREAKDOWNS.map(({ title, copy, icon: Icon }) => (
              <article key={title} className={styles.glassCard}>
                <span className={styles.cardIcon}>
                  <Icon aria-hidden="true" size={19} />
                </span>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardCopy}>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="erp-different-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>How Vyso is different</p>
            <h2 id="erp-different-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              One high-value workflow, configured properly.
            </h2>
            <p className={styles.sectionCopy}>
              Vyso isn&apos;t a smaller ERP. It&apos;s a different way to reach the same
              outcome—operational visibility and control—without the multi-month
              programme.
            </p>
          </div>
          <ul className={styles.list}>
            {DIFFERENCES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="erp-table-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Side by side</p>
          <h2 id="erp-table-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            ERP vs Vyso, at a glance.
          </h2>
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <caption style={{ textAlign: "left", padding: "1rem 1.35rem 0", fontSize: "0.76rem", color: "var(--marketing-body)" }}>
                A general comparison. Specific ERP products and implementations vary.
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={thStyle}>What matters</th>
                  <th scope="col" style={thStyle}>Traditional ERP</th>
                  <th scope="col" style={thStyle}>Vyso</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.criterion}>
                    <th scope="row" style={{ ...tdStyle, fontWeight: 700, color: "var(--marketing-ink)" }}>
                      {row.criterion}
                    </th>
                    <td style={tdStyle}>{row.erp}</td>
                    <td style={vysoCellStyle}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                        <Check aria-hidden="true" size={14} style={{ color: "var(--marketing-orange)", flexShrink: 0 }} />
                        {row.vyso}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="erp-fit-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Best-fit scenarios</p>
              <h2 id="erp-fit-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Match the tool to the scope of the problem.
              </h2>
            </div>
          </div>
          <div className={styles.splitSection}>
            <div>
              <p className={styles.cardKicker}>Still choose an ERP when</p>
              <ul className={styles.list}>
                <li>You need formal, business-wide resource planning across departments.</li>
                <li>You have the internal team and timeline for a multi-module programme.</li>
                <li>Standardising process across multiple entities or sites is the goal.</li>
              </ul>
            </div>
            <div>
              <p className={styles.cardKicker}>Vyso becomes the better fit when</p>
              <ul className={styles.list}>
                <li>One or two operational problems are costing real time or money now.</li>
                <li>You don&apos;t have a dedicated project team to run a large rollout.</li>
                <li>You&apos;d rather prove value on one workflow before expanding scope.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="erp-migration-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>How to start smaller than an ERP programme</p>
          <h2 id="erp-migration-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            No rip-and-replace required.
          </h2>
          <ol className={`${styles.processLine} ${styles.processLineFour}`}>
            {MIGRATION_STEPS.map(({ icon: Icon, title, copy }) => (
              <li key={title} className={styles.processStep}>
                <span className={styles.processMarker}>
                  <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
                </span>
                <div className={styles.processText}>
                  <h3 className={styles.processTitle}>{title}</h3>
                  <p className={styles.processCopy}>{copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="erp-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Common questions</p>
          <h2 id="erp-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Before you decide.
          </h2>
          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            {FAQS.map(({ question, answer }) => (
              <article key={question} className={styles.answerCard}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Not sure which category you need?"
        title="We'll tell you honestly if you need an ERP instead."
        copy="If your business genuinely needs a full enterprise resource-planning programme, we'll say so. If it needs one workflow fixed well, that's exactly where Vyso starts."
        primaryLabel="Join Waitlist"
        secondaryLabel="Compare Vyso vs Spreadsheets"
        secondaryHref="/compare/vyso-vs-spreadsheets"
      />
    </PublicPageShell>
  );
}
