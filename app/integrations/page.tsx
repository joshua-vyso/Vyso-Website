import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Code2,
  FileSpreadsheet,
  Landmark,
  Lock,
  MessageSquare,
  Plug,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

const PAGE_TITLE = "Vyso Integrations | Connect Vyso to Your Existing Tools";
const PAGE_DESCRIPTION =
  "How Vyso connects to accounting software, POS, inventory, spreadsheets, communication tools, supplier systems and reporting tools—including Xero and custom API integrations.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/integrations",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/integrations",
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

type Category = {
  name: string;
  icon: typeof Landmark;
  status: string;
  copy: string;
};

const CATEGORIES: readonly Category[] = [
  {
    name: "Accounting software",
    icon: Landmark,
    status: "Xero: connected today",
    copy: "Vyso connects directly with Xero, so invoices, payments and account balances can stay aligned with your books. Other accounting platforms are assessed as custom integrations during scoping.",
  },
  {
    name: "POS systems",
    icon: ShoppingCart,
    status: "Custom integration",
    copy: "Sales, till transactions and daily takings are a common source of truth for reporting. POS connections are scoped and built around the specific system you already run.",
  },
  {
    name: "Inventory systems",
    icon: Boxes,
    status: "Custom integration",
    copy: "If stock is already tracked in a dedicated inventory or warehouse system, Vyso can connect to it during implementation rather than asking your team to duplicate records.",
  },
  {
    name: "Spreadsheets",
    icon: FileSpreadsheet,
    status: "Import & migration",
    copy: "Existing spreadsheet data—customers, price lists, stock counts—can be imported during onboarding so nothing has to be recaptured from scratch.",
  },
  {
    name: "Communication tools",
    icon: MessageSquare,
    status: "Supported intake",
    copy: "Uploaded WhatsApp exports, email captures, PDFs and photographed orders can be reviewed and turned into structured records, with a person in the loop before anything is confirmed.",
  },
  {
    name: "Supplier systems",
    icon: Truck,
    status: "Custom integration",
    copy: "Supplier price lists, purchase orders and delivery documents can be connected or imported so pricing and stock stay consistent with what suppliers actually send.",
  },
  {
    name: "Reporting tools",
    icon: BarChart3,
    status: "Custom integration",
    copy: "If your team already reports into a dashboard or BI tool, Vyso data can be made available to feed that reporting rather than replacing it outright.",
  },
  {
    name: "Custom APIs",
    icon: Code2,
    status: "Scoped in implementation",
    copy: "For any system with an API, webhook or a reliable way to exchange data, a custom integration can be scoped and built as part of implementation.",
  },
];

const IMPLEMENTATION_STEPS: readonly { title: string; copy: string; icon: typeof ClipboardList }[] = [
  {
    title: "Confirm the systems in use",
    copy: "The audit maps which tools your business already relies on, and which connections would actually save time.",
    icon: ClipboardList,
  },
  {
    title: "Map the data and connection points",
    copy: "We confirm whether each system offers a reliable way to exchange data, and what a sensible connection looks like.",
    icon: Plug,
  },
  {
    title: "Configure and test",
    copy: "Agreed integrations are configured and tested against real data before they touch anything your team relies on daily.",
    icon: RefreshCw,
  },
  {
    title: "Go live and monitor",
    copy: "Connections are monitored after launch, with proactive maintenance as part of the ongoing relationship.",
    icon: CheckCircle2,
  },
];

const CUSTOM_OPTIONS: readonly string[] = [
  "Direct API or webhook connections where the target system supports them.",
  "Scheduled or triggered data syncs for systems without a live connection.",
  "File-based import and export for tools where that's the most reliable exchange method.",
  "A confirmed boundary for what's integrated versus what stays a manual step—agreed upfront, not assumed.",
];

const SECURITY_NOTES: readonly string[] = [
  "Access to connected systems is organisation-scoped, with role-aware permissions for who can see and use what.",
  "Every connection is confirmed and agreed with you before it becomes part of the live implementation.",
  "Your data and records remain yours—integrations are built to support your workflow, not to lock information away.",
  "No software makes a business POPIA compliant by itself. Vyso supports more consistent records and access control; compliance still depends on how your business collects, uses and protects personal information.",
];

const FAQS: readonly { question: string; answer: string }[] = [
  {
    question: "Does Vyso integrate with Xero?",
    answer:
      "Yes. Vyso connects directly with Xero today, so relevant invoices, payments and account information can stay aligned between the two systems.",
  },
  {
    question: "Can Vyso connect to our accounting, POS or inventory system if it isn't listed here?",
    answer:
      "Potentially, yes. The right approach depends on whether the existing system offers a reliable way to exchange data. We assess each required connection during scoping and confirm what can be integrated before it becomes part of the implementation.",
  },
  {
    question: "Can our team keep sending orders through WhatsApp or email?",
    answer:
      "Vyso can accept uploaded WhatsApp screenshots, email captures, PDFs and photographed orders for extraction and review. A direct WhatsApp or email integration is a separate requirement and is confirmed during scoping.",
  },
  {
    question: "Do we need technical staff to set up an integration?",
    answer:
      "No. Integrations are scoped and configured as part of implementation. Your team is involved in confirming what's connected and how, but the technical setup is handled for you.",
  },
];

const url = "https://vyso.co.za/integrations";

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
        { "@type": "ListItem", position: 2, name: "Integrations", item: url },
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

export default function IntegrationsPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="integrations-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Integrations" }]} />
          <p className={styles.eyebrow}>Integrations</p>
          <h1 id="integrations-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Connect Vyso to</span>{" "}
            <span className={styles.blendAccent}>the tools your team already uses.</span>
          </h1>
          <p className={styles.compactLead}>
            Vyso is not asking you to throw out every system you rely on. Some
            connections are ready today, others are scoped as custom work during
            implementation—this page explains which is which, honestly.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/faq">
              Read the full FAQ
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="integration-categories-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Integration categories</p>
              <h2 id="integration-categories-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Where Vyso typically connects in.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Every business runs a different combination of systems. These are the
              categories we most often connect to—some available now, most confirmed
              and built during implementation.
            </p>
          </div>

          <div className={styles.moduleGrid}>
            {CATEGORIES.map(({ name, icon: Icon, status, copy }) => (
              <article key={name} className={styles.moduleCard}>
                <span className={styles.cardIcon}>
                  <Icon aria-hidden="true" size={19} />
                </span>
                <p className={styles.statusPill}>{status}</p>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardCopy}>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="integration-process-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>How implementation works</p>
          <h2 id="integration-process-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Confirmed before it&apos;s connected.
          </h2>
          <ol className={`${styles.processLine} ${styles.processLineFour}`}>
            {IMPLEMENTATION_STEPS.map(({ icon: Icon, title, copy }) => (
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

      <section className={styles.section} aria-labelledby="custom-integrations-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Custom integration options</p>
            <h2 id="custom-integrations-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              If it isn&apos;t listed, ask us anyway.
            </h2>
            <p className={styles.sectionCopy}>
              Most integrations beyond Xero are handled as custom work, scoped to your
              actual systems rather than a fixed list of pre-built connectors.
            </p>
          </div>
          <ul className={styles.list}>
            {CUSTOM_OPTIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="integration-security-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Security and data handling</p>
              <h2 id="integration-security-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Access is scoped. Nothing connects silently.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              Integrations are built to support your team&apos;s workflow, with the same
              care applied to access and data handling as the rest of the platform.
            </p>
          </div>
          <div className={styles.answerGrid}>
            {SECURITY_NOTES.map((note, index) => (
              <article key={note} className={styles.glassCard}>
                <span className={styles.cardIcon}>
                  {index === 0 ? (
                    <ShieldCheck aria-hidden="true" size={19} />
                  ) : (
                    <Lock aria-hidden="true" size={19} />
                  )}
                </span>
                <p className={styles.cardCopy}>{note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="integration-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Integration FAQ</p>
          <h2 id="integration-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Common questions before scoping.
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
        eyebrow="Bring us your stack"
        title="Tell us what you're already running—we'll confirm what connects."
        copy="The one-week audit maps your current systems and tells you honestly which connections are ready now and which need to be scoped as custom work."
        primaryLabel="Join Waitlist"
        secondaryLabel="View pricing"
        secondaryHref="/pricing"
      />
    </PublicPageShell>
  );
}
