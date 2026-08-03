import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { LazyShaderBackground } from "@/components/marketing/LazyShaderBackground";
import { SiteFooter } from "@/components/sections/SiteFooter";

import styles from "./faq.module.css";

const PAGE_TITLE = "Frequently Asked Questions | Vyso Operations Platform";
const PAGE_DESCRIPTION =
  "Clear answers about Vyso's South African operations platform, OrderFlow, VAT-aware documents, payments, implementation, pricing and software fit.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "https://vyso.co.za/faq",
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

type FaqItem = {
  question: string;
  answer: string;
};

type FaqGroup = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  questions: readonly FaqItem[];
};

const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: "platform",
    eyebrow: "The platform",
    title: "What Vyso is",
    description:
      "The short version: flexible software, configured with you and supported by people who understand the workflow.",
    questions: [
      {
        question: "What is Vyso?",
        answer:
          "Vyso is a configurable operations platform for small and medium businesses. We combine reusable software modules with hands-on implementation: we map the workflow, configure the right system and automations, help your team adopt it, and support it after launch.",
      },
      {
        question: "Who is Vyso for?",
        answer:
          "Vyso is for growing SMEs whose day-to-day operations have outgrown WhatsApp, spreadsheets, paper and disconnected tools. It is most useful when repeated admin, missing information or manual handovers are making the business harder to run.",
      },
      {
        question: "Does Vyso only work with food businesses?",
        answer:
          "No. Vyso can support SMEs across sectors, but food operations are our current focus. Restaurants, farms, producers, caterers, bakeries, suppliers and distributors give us a clear set of operational problems to solve well, from ordering and stock to waste and supplier coordination.",
      },
      {
        question: "Is Vyso off-the-shelf software or custom development?",
        answer:
          "Vyso sits between the two. The platform provides reusable modules and a shared operating foundation, while implementation configures workflows, data and automations around your business. That gives you more fit than a rigid point tool without starting every project from a blank page.",
      },
      {
        question: "What is OrderFlow?",
        answer:
          "OrderFlow is Vyso's flagship order-management module. It brings customers, quotes, orders, invoices, delivery notes, payments and price lists into one connected workflow. It is especially relevant to farms, producers, caterers, bakeries, food suppliers and distributors that sell repeatedly to other businesses.",
      },
    ],
  },
  {
    id: "getting-started",
    eyebrow: "Getting started",
    title: "From messy process to working system",
    description:
      "We begin with the operation itself, then decide what should be simplified, automated or moved into Vyso.",
    questions: [
      {
        question: "What happens during the one-week audit?",
        answer:
          "The one-week audit maps the current workflow, identifies bottlenecks and repeated manual work, and defines the most useful next step. You receive a practical recommendation before committing to a larger implementation. The audit costs R2,000 once-off.",
      },
      {
        question: "Do we need to replace all our current tools?",
        answer:
          "Not necessarily. We first decide what is already working and what is creating friction. Vyso can automate parts of an existing workflow, replace a weak tool with a module, or connect several steps into one clearer process. The audit determines the sensible boundary.",
      },
      {
        question: "How long does implementation take?",
        answer:
          "Timing depends on the workflow, data and integrations involved. A focused automation is quicker than a multi-module rollout. After the audit, we define the scope, sequence and expected delivery window before implementation begins.",
      },
      {
        question: "Will our team receive help using Vyso?",
        answer:
          "Yes. Hands-on implementation is part of the Vyso model. We configure the agreed workflow, help the relevant people understand the new process and remain involved after launch so the system can be supported and improved as real use reveals what matters.",
      },
      {
        question: "Can Vyso connect with tools we already use?",
        answer:
          "Potentially, yes. The right approach depends on whether the existing tool provides a reliable way to exchange data. We assess each required connection during scoping and confirm what can be integrated before it becomes part of the implementation.",
      },
    ],
  },
  {
    id: "pricing",
    eyebrow: "Pricing",
    title: "What it costs",
    description:
      "A clear starting point, with the final scope agreed before implementation begins.",
    questions: [
      {
        question: "How much does Vyso cost?",
        answer:
          "The one-week audit is R2,000 once-off. Start is R10,000 once-off plus R8,000 per month. Create is R30,000 once-off plus R10,000 per month. Scale is R50,000 once-off plus R15,000 per month, with additional modules on Scale at R3,000 per month each. Your recommended tier depends on the workflow and implementation scope.",
      },
      {
        question: "What's included in the Start tier?",
        answer:
          "Start focuses on automating the tools you already use — WhatsApp, Google Sheets, Outlook and similar. It includes up to five automations, proactive maintenance, new automations on a monthly delivery cycle, basic workflow documentation, a monthly automation health check and a 30-day support period after setup. Start doesn't include Vyso modules or Finch — it's about making your existing stack work harder.",
      },
      {
        question: "What's included in the Create tier?",
        answer:
          "Create moves a key workflow out of scattered tools and into one productised Vyso module of your choice. Your Start automations are migrated into the module, and Finch — our companion app — is included for that module. You also get team onboarding, a 60-day support period, one round of post-launch revisions, a basic dashboard and reporting view, user roles and access setup, and full documentation and handover.",
      },
      {
        question: "What's included in the Scale tier?",
        answer:
          "Scale is the full operating platform. It includes everything in Create, plus the ability to add modules as your operation grows, Finch across all your modules, two-way integrations with outside systems such as accounting, POS, banking, CRMs and supplier systems, cross-module dashboards and reporting, advanced permissions and team workflows, monthly ops reports, priority development and a quarterly optimisation session. Additional modules are R3,000 per month each.",
      },
      {
        question: "What counts as an additional module, and how are they priced?",
        answer:
          "Each Vyso module covers one operational area — orders, suppliers, shifts, wastage and so on. Create includes one module; Scale lets you add more at R3,000 per month each. A new operational area handled by its own module counts as an additional module.",
      },
      {
        question: "Is Finch included?",
        answer:
          "Finch is the companion app that helps your team interact with their workflows — capture updates, approve actions, receive notifications and use Vyso from a lighter, mobile-friendly interface. It's included in Create for your chosen module, and works across all your modules in Scale. It isn't part of Start, because Start automates your existing tools rather than running on Vyso modules — and Finch is built to work on top of those modules.",
      },
      {
        question: "What does the monthly retainer cover?",
        answer:
          "The retainer keeps your setup running and improving: proactive maintenance and fixes, support for the agreed workflows, new automations on the monthly cycle in Start, and ongoing reporting and optimisation in the higher tiers. It isn't a general development budget — larger additions are scoped separately.",
      },
      {
        question: "What happens after setup?",
        answer:
          "Every tier includes a support period after setup — 30 days on Start, 60 days on Create, and ongoing support on Scale. From there the monthly retainer takes over: we keep things running, fix breakages proactively and keep delivering improvements on the agreed cycle.",
      },
      {
        question: "What if we need more than what's included?",
        answer:
          "Additional modules, major new workflows, or third-party systems outside the agreed setup are scoped separately. We'll always agree the scope with you before anything new is built, so there are no surprise invoices.",
      },
      {
        question: "Are third-party integrations included?",
        answer:
          "Scale includes two-way integrations with outside systems such as accounting, POS, banking, CRMs and supplier systems. In Start and Create your existing tools are part of the automation work, but new third-party integrations outside the agreed setup are scoped separately.",
      },
      {
        question: "Can we start with Start and upgrade later?",
        answer:
          "Yes — that's the intended path for many teams. Start proves the value inside your current tools; when you're ready, Create migrates those automations into a Vyso module so nothing you've invested is lost, and Scale adds modules from there.",
      },
      {
        question: "Which plan should we choose?",
        answer:
          "You do not need to choose a plan before speaking to us. The one-week audit establishes the operational need and gives both sides enough context to recommend Start, Create or Scale based on the work required.",
      },
    ],
  },
  {
    id: "south-africa",
    eyebrow: "South African operations",
    title: "Rands, VAT and local workflows",
    description:
      "Specific answers about how OrderFlow fits the commercial details South African SMEs and SMMEs handle every day.",
    questions: [
      {
        question: "Can OrderFlow create VAT-aware South African tax invoices?",
        answer:
          "Yes. OrderFlow supports seller and customer details, VAT numbers, document numbering, line items, VAT values and standard, zero-rated or exempt VAT treatment. Your accountant or tax practitioner remains responsible for confirming the correct tax treatment and statutory requirements for your business.",
      },
      {
        question: "Can OrderFlow create quotes and invoices in South African rand?",
        answer:
          "Yes. OrderFlow keeps customer pricing, document totals, payments and balances in ZAR, including customer-specific price lists and commercial terms.",
      },
      {
        question: "Can OrderFlow handle EFT, cash and card payments?",
        answer:
          "Yes. Teams can record EFT, cash, card and other payments, add a reference, and see what has been paid, what remains outstanding and what is overdue. This records payments and account status; it does not imply that Vyso processes every payment method directly.",
      },
      {
        question: "Can customers keep sending orders through WhatsApp or email?",
        answer:
          "OrderFlow can accept uploaded WhatsApp screenshots, email captures, PDFs and photographed orders for extraction and review. A direct WhatsApp or email integration is a separate requirement and is confirmed during scoping.",
      },
      {
        question: "Does OrderFlow replace Sage, Pastel, Xero or QuickBooks?",
        answer:
          "OrderFlow can replace parts of the operating workflow, such as customer pricing, order capture and invoicing, but it is not presented as a full accounting ledger or tax-submission product. Any required accounting connection or migration boundary is agreed during implementation.",
      },
      {
        question: "Does using Vyso make a business POPIA compliant?",
        answer:
          "No software makes a business POPIA compliant by itself. Vyso can support more consistent records, organisation-scoped access and role-aware permissions, while compliance still depends on how your business collects, uses, retains, shares and protects personal information.",
      },
    ],
  },
  {
    id: "choosing",
    eyebrow: "Choosing well",
    title: "Fit, alternatives and next steps",
    description:
      "Vyso is one way to solve an operations problem. The right choice depends on how standard, broad or specialised that problem is.",
    questions: [
      {
        question: "How is Vyso different from its competitors?",
        answer:
          "Vyso combines a configurable operations platform with hands-on implementation. Unlike a fixed point tool, we can configure connected workflows across modules. Unlike a broad enterprise ERP, we can start with one practical operational problem. Unlike a standalone consultant or one-off custom build, the diagnosis, software, rollout and ongoing support sit within one working relationship.",
      },
      {
        question: "When might Vyso not be the right fit?",
        answer:
          "Vyso may not be the right fit if a simple off-the-shelf tool already matches the process, if the business only needs short-term advice with no system implementation, or if the requirement is a full enterprise ERP programme. We use the first conversation and audit to test fit honestly.",
      },
      {
        question: "How do we get started?",
        answer:
          "Start with a conversation about the workflow that is causing the most friction. If Vyso appears to fit, the next step is the one-week audit. From there, you receive a practical recommendation and can decide whether to proceed with Start, Create or Scale.",
      },
    ],
  },
];

const ALL_QUESTIONS = FAQ_GROUPS.flatMap((group) => group.questions);

type ComparisonOption = {
  label: string;
  bestFor: string;
  difference: string;
  featured?: boolean;
};

const COMPARISON_OPTIONS: readonly ComparisonOption[] = [
  {
    label: "Off-the-shelf point software",
    bestFor:
      "A standard, well-defined job where the available product already matches the way your team works.",
    difference:
      "A point tool usually solves one part of the operation. Vyso can configure several connected workflows and includes help putting the system into practice.",
  },
  {
    label: "Enterprise ERP",
    bestFor:
      "Organisations that need broad, formal resource planning and have the time and internal capacity for a larger programme.",
    difference:
      "Vyso can begin with one high-value operational problem and expand in modules, instead of requiring a business-wide system as the first step.",
  },
  {
    label: "Consultants or custom developers",
    bestFor:
      "A business that needs independent advice, or a genuinely unique system built entirely to its own specification.",
    difference:
      "Vyso combines diagnosis, reusable platform modules, configuration, rollout and ongoing support in one relationship.",
  },
  {
    label: "Vyso",
    bestFor:
      "An SME that has outgrown manual work or disconnected tools, but needs a system shaped around its real operation.",
    difference:
      "You get a configurable operations platform and hands-on implementation together, with the option to add modules as the need becomes clear.",
    featured: true,
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ALL_QUESTIONS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <>
      {/* `blend-surface` — universal reactive text blend, see app/globals.css. */}
      <div className="blend-surface" style={{ position: "relative", isolation: "isolate" }}>
        <LazyShaderBackground global />
        <Navbar visible />

        <main className={styles.page} style={{ minHeight: "100vh" }}>
          <section className={styles.hero} aria-labelledby="faq-heading">
            <div className={styles.heroGlow} aria-hidden="true" />
            <div className={styles.shell}>
              <p className={styles.eyebrow}>Questions, answered</p>
              <h1 id="faq-heading" className={styles.heroTitle}>
                <span className={`blend-h-plain ${styles.blendPlain}`}>
                  Clarity before
                </span>
                <span className={`blend-h-orange ${styles.blendOrange}`}>
                  commitment.
                </span>
              </h1>
              <p className={styles.heroCopy}>
                Straight answers about what Vyso is, how implementation works,
                what it costs and when another option may be a better fit.
              </p>

              <nav className={styles.jumpNav} aria-label="FAQ sections">
                {FAQ_GROUPS.map((group) => (
                  <a key={group.id} href={`#${group.id}`}>
                    {group.eyebrow}
                  </a>
                ))}
                <a href="#comparison">Compare options</a>
              </nav>
            </div>
          </section>

          <div className={styles.shell}>
            <div className={styles.faqLayout}>
              <aside className={styles.sideNote} aria-label="Quick introduction">
                <p className={styles.sideNoteLabel}>The simple answer</p>
                <p className={styles.sideNoteText}>
                  Vyso gives growing businesses systems that fit the way their
                  operations actually work — then helps their people put those
                  systems to use.
                </p>
                <Link href="/pricing" className={styles.textLink}>
                  See pricing <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </aside>

              <div className={styles.groups}>
                {FAQ_GROUPS.map((group, groupIndex) => (
                  <section
                    key={group.id}
                    id={group.id}
                    className={styles.faqGroup}
                    aria-labelledby={`${group.id}-heading`}
                  >
                    <div className={styles.groupHeading}>
                      <span className={styles.groupNumber}>
                        {String(groupIndex + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className={styles.groupEyebrow}>{group.eyebrow}</p>
                        <h2
                          id={`${group.id}-heading`}
                          className={styles.plainInk}
                        >
                          {group.title}
                        </h2>
                        <p>{group.description}</p>
                      </div>
                    </div>

                    <div className={styles.questionList}>
                      {group.questions.map(({ question, answer }) => (
                        <details key={question} className={styles.question}>
                          <summary>
                            <span className={styles.plainInk}>
                              {question}
                            </span>
                            <span className={styles.questionControl} aria-hidden="true" />
                          </summary>
                          <p>{answer}</p>
                        </details>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </div>

          <section
            id="comparison"
            className={styles.comparisonSection}
            aria-labelledby="comparison-heading"
          >
            <div className={styles.shell}>
              <div className={styles.comparisonIntro}>
                <div>
                  <p className={styles.eyebrow}>A fair comparison</p>
                  <h2
                    id="comparison-heading"
                    className={styles.plainInk}
                  >
                    Different tools suit different jobs.
                  </h2>
                </div>
                <p>
                  The useful question is not whether one category is universally
                  better. It is which approach fits the problem, the team and the
                  stage of the business.
                </p>
              </div>

              <div className={styles.comparisonGrid}>
                {COMPARISON_OPTIONS.map((option) => (
                  <article
                    key={option.label}
                    className={`${styles.comparisonCard} ${
                      option.featured ? styles.featuredCard : ""
                    }`}
                  >
                    {option.featured ? (
                      <span className={styles.vysoBadge}>
                        <Check aria-hidden="true" size={12} /> Our approach
                      </span>
                    ) : (
                      <span className={styles.categoryBadge}>Alternative</span>
                    )}
                    <h3>{option.label}</h3>
                    <div className={styles.comparisonPoint}>
                      <p className={styles.comparisonLabel}>Best fit when</p>
                      <p>{option.bestFor}</p>
                    </div>
                    <div className={styles.comparisonDivider} aria-hidden="true">
                      <Minus size={16} />
                    </div>
                    <div className={styles.comparisonPoint}>
                      <p className={styles.comparisonLabel}>How Vyso differs</p>
                      <p>{option.difference}</p>
                    </div>
                  </article>
                ))}
              </div>

              <p className={styles.comparisonFootnote}>
                Not sure which category fits? The first conversation is for testing
                that — before you commit to an audit or implementation.
              </p>
            </div>
          </section>

          <section className={styles.cta} aria-labelledby="faq-cta-heading">
            <div className={styles.ctaGlow} aria-hidden="true" />
            <div className={styles.ctaInner}>
              <p className={styles.eyebrow}>Still deciding?</p>
              <h2
                id="faq-cta-heading"
                className={styles.plainInk}
              >
                Bring us the messy workflow.
              </h2>
              <p>
                Tell us what keeps falling through the cracks. We&apos;ll help you
                work out whether Vyso is the right way to fix it.
              </p>
              <div className={styles.ctaActions}>
                <Link href="/contact" className={styles.primaryButton}>
                  Join Waitlist <ArrowRight aria-hidden="true" size={16} />
                </Link>
                <Link href="/pricing" className={styles.secondaryButton}>
                  View pricing
                </Link>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
