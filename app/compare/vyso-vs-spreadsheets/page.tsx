import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  ListChecks,
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

const PAGE_TITLE = "Vyso vs Spreadsheets | Why Growing SMEs Outgrow Excel & Sheets";
const PAGE_DESCRIPTION =
  "A fair comparison of spreadsheets and Vyso for South African SMEs: where Excel and Google Sheets still work well, where they break down, and how a connected operations platform differs.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/compare/vyso-vs-spreadsheets",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/compare/vyso-vs-spreadsheets",
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
  "Free, familiar and instant to start—no procurement process, no waiting on anyone.",
  "Flexible enough for one-off analysis, quick calculations or a single person's private tracking.",
  "No dependency on a vendor, an internet connection to a third-party system, or a support contract.",
  "Genuinely the right tool when the process is small, stable and used by one or two people.",
];

const BREAKDOWNS: readonly { title: string; copy: string; icon: typeof AlertTriangle }[] = [
  {
    title: "Version conflicts multiply",
    copy: "Once more than one person edits the same workbook, copies fork, formulas break, and nobody is fully sure which tab is current.",
    icon: AlertTriangle,
  },
  {
    title: "Visibility depends on someone opening the file",
    copy: "Owners and managers only see what's happening when someone stops to update, save and share a spreadsheet—usually after the fact.",
    icon: AlertTriangle,
  },
  {
    title: "The same information gets retyped everywhere",
    copy: "A quote becomes an order, an order becomes an invoice, and each step is a separate tab or file with its own chance of a typo.",
    icon: AlertTriangle,
  },
  {
    title: "Approvals happen informally, if at all",
    copy: "Purchase decisions, discounts and credit limits are easy to wave through in a spreadsheet because there's no structured step to stop and check.",
    icon: AlertTriangle,
  },
];

const DIFFERENCES: readonly string[] = [
  "One shared operational record instead of a workbook full of tabs and copies.",
  "Live dashboards owners can check without asking someone to send the latest version.",
  "Role-based access, so people see and edit only what's relevant to their part of the workflow.",
  "Structured approval steps for the decisions that currently rely on someone remembering to check.",
];

type TableRow = { criterion: string; spreadsheets: string; vyso: string };

const COMPARISON_ROWS: readonly TableRow[] = [
  {
    criterion: "One person tracking a simple process",
    spreadsheets: "Works well",
    vyso: "Works well, with room to grow",
  },
  {
    criterion: "Several people updating the same data",
    spreadsheets: "Version conflicts, overwritten cells",
    vyso: "One shared record, role-based access",
  },
  {
    criterion: "Real-time visibility for owners and managers",
    spreadsheets: "Only when someone opens and shares the file",
    vyso: "Live dashboards and alerts",
  },
  {
    criterion: "Approvals on purchases, discounts or credit",
    spreadsheets: "Manual, easy to skip",
    vyso: "Structured approval steps",
  },
  {
    criterion: "Linking orders, invoices and payments",
    spreadsheets: "Re-typed across separate sheets or tabs",
    vyso: "One connected workflow",
  },
  {
    criterion: "Knowing who changed what, and when",
    spreadsheets: "Limited or no history",
    vyso: "Tracked activity and change history",
  },
  {
    criterion: "Scaling past one location or team",
    spreadsheets: "Tends to fork into many versions",
    vyso: "Configured to grow with the operation",
  },
  {
    criterion: "Effort and cost to get started",
    spreadsheets: "Free, instant",
    vyso: "Scoped through a one-week audit, then implemented",
  },
];

const MIGRATION_STEPS: readonly { title: string; copy: string; icon: typeof ClipboardList }[] = [
  {
    title: "Map the current sheets",
    copy: "The audit reviews the spreadsheets and files you actually use today, and what each one is really doing for the business.",
    icon: ClipboardList,
  },
  {
    title: "Decide what moves and what stays",
    copy: "Not every spreadsheet needs to go. We agree which workflow is the highest-value first move, and which tools can stay in place for now.",
    icon: ListChecks,
  },
  {
    title: "Configure and bring across history",
    copy: "The agreed workflow is configured around how your team actually works, with relevant existing records brought into the new system.",
    icon: RefreshCw,
  },
  {
    title: "Run in parallel, then cut over",
    copy: "Your team gets support using the new workflow before the old spreadsheet is retired, so nothing falls through the gap.",
    icon: CheckCircle2,
  },
];

const FAQS: readonly { question: string; answer: string }[] = [
  {
    question: "Is Vyso saying spreadsheets are bad?",
    answer:
      "No. Spreadsheets are genuinely useful, especially for small, stable processes run by one or two people. The comparison here is about what happens once a process is shared across a growing team and starts feeding into other decisions.",
  },
  {
    question: "Can we keep using spreadsheets for some things and Vyso for others?",
    answer:
      "Yes. Most businesses don't need to replace every spreadsheet at once. The audit helps decide which workflow is causing the most friction today, and which spreadsheets are fine to leave exactly where they are.",
  },
  {
    question: "Will our team need to learn a completely new system?",
    answer:
      "There's a learning step, but implementation is hands-on—we configure the workflow with you, help the relevant people understand it, and stay involved after launch rather than handing over a manual and disappearing.",
  },
  {
    question: "What if our spreadsheet process is quite specific to our business?",
    answer:
      "That's normal, and it's exactly what the one-week audit is for. It maps the process as it actually works today, rather than assuming a generic version of it, before anything is configured.",
  },
];

const url = "https://vyso.co.za/compare/vyso-vs-spreadsheets";

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
        { "@type": "ListItem", position: 3, name: "Vyso vs Spreadsheets", item: url },
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

export default function VysoVsSpreadsheetsPage() {
  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="compare-spreadsheets-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Compare", href: "/compare" },
              { label: "Vyso vs Spreadsheets" },
            ]}
          />
          <p className={styles.eyebrow}>Vyso vs Spreadsheets</p>
          <h1 id="compare-spreadsheets-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>Spreadsheets get you started.</span>{" "}
            <span className={styles.blendAccent}>Vyso keeps it together as you grow.</span>
          </h1>
          <p className={styles.compactLead}>
            Excel and Google Sheets are a reasonable way to run a small operation. This
            page is an honest look at where that keeps working, where it quietly starts
            costing you, and what changes with a connected operations platform instead.
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

      <section className={styles.section} aria-labelledby="spreadsheets-good-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Where spreadsheets earn their place</p>
            <h2 id="spreadsheets-good-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Nobody should feel bad about using Excel.
            </h2>
            <p className={styles.sectionCopy}>
              Spreadsheets aren&apos;t a mistake—for a lot of businesses, at a lot of
              stages, they&apos;re exactly the right tool.
            </p>
          </div>
          <ul className={styles.list}>
            {STRENGTHS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="spreadsheets-break-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Where it starts to break down</p>
              <h2 id="spreadsheets-break-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                The cracks show up as the team grows.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              None of this is about spreadsheets being poorly built. It&apos;s about what
              happens when one person&apos;s tracking tool becomes several people&apos;s
              shared workflow.
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

      <section className={styles.section} aria-labelledby="spreadsheets-different-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>How Vyso is different</p>
            <h2 id="spreadsheets-different-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              One workflow, not one workbook per person.
            </h2>
            <p className={styles.sectionCopy}>
              Vyso doesn&apos;t try to be a bigger spreadsheet. It replaces the workflow
              that spreadsheets were being stretched to hold.
            </p>
          </div>
          <ul className={styles.list}>
            {DIFFERENCES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="spreadsheets-table-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Side by side</p>
          <h2 id="spreadsheets-table-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Spreadsheets vs Vyso, at a glance.
          </h2>
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <caption style={{ textAlign: "left", padding: "1rem 1.35rem 0", fontSize: "0.76rem", color: "var(--marketing-body)" }}>
                A general comparison. Your actual fit depends on the specific workflow.
              </caption>
              <thead>
                <tr>
                  <th scope="col" style={thStyle}>What matters</th>
                  <th scope="col" style={thStyle}>Spreadsheets</th>
                  <th scope="col" style={thStyle}>Vyso</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.criterion}>
                    <th scope="row" style={{ ...tdStyle, fontWeight: 700, color: "var(--marketing-ink)" }}>
                      {row.criterion}
                    </th>
                    <td style={tdStyle}>{row.spreadsheets}</td>
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

      <section className={styles.section} aria-labelledby="spreadsheets-fit-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Best-fit scenarios</p>
              <h2 id="spreadsheets-fit-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Choose based on the job, not the trend.
              </h2>
            </div>
          </div>
          <div className={`${styles.splitSection}`}>
            <div>
              <p className={styles.cardKicker}>Still choose spreadsheets when</p>
              <ul className={styles.list}>
                <li>One or two people run the whole process and know it well.</li>
                <li>The workflow is simple, stable and unlikely to change soon.</li>
                <li>You need a quick, one-off calculation rather than a repeatable system.</li>
              </ul>
            </div>
            <div>
              <p className={styles.cardKicker}>Vyso becomes the better fit when</p>
              <ul className={styles.list}>
                <li>More than a couple of people touch the same data every week.</li>
                <li>Owners need to see what&apos;s happening without chasing an update.</li>
                <li>Mistakes from re-typing or missed approvals are starting to cost money.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="spreadsheets-migration-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Moving off spreadsheets</p>
          <h2 id="spreadsheets-migration-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Nothing gets switched off overnight.
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

      <section className={styles.section} aria-labelledby="spreadsheets-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Common questions</p>
          <h2 id="spreadsheets-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
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
        eyebrow="Ready to compare properly?"
        title="Bring us the spreadsheets you're actually using."
        copy="We'll map the real workflow behind them and give you an honest view of whether it's time to move, or whether the spreadsheet is still doing its job."
        primaryLabel="Join Waitlist"
        secondaryLabel="Compare Vyso vs ERP systems"
        secondaryHref="/compare/vyso-vs-erp-systems"
      />
    </PublicPageShell>
  );
}
