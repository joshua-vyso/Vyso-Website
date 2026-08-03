import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  Clock,
  Eye,
  FileWarning,
  LayoutDashboard,
  Workflow,
} from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

type RelatedLink = { label: string; href: string };

export type Solution = {
  name: string;
  shortName: string;
  summary: string;
  title: string;
  description: string;
  eyebrow: string;
  heroPlain: string;
  heroAccent: string;
  lead: string;
  problem: readonly string[];
  struggles: readonly { title: string; copy: string }[];
  costIntro: string;
  costStats: readonly { value: string; label: string }[];
  costNote: string;
  helpIntro: string;
  modules: readonly { name: string; role: string }[];
  workflow: readonly { title: string; copy: string }[];
  industries: readonly RelatedLink[];
  learnArticles: readonly RelatedLink[];
  faqs: readonly { question: string; answer: string }[];
};

export const SOLUTIONS: Record<string, Solution> = {
  "reduce-money-leakage": {
    name: "Reduce money leakage",
    shortName: "Reduce Money Leakage",
    summary:
      "A visibility layer that shows where cost, time, stock and margin are quietly being lost across the operation.",
    title: "Reduce Money Leakage in Your Business | Vyso",
    description:
      "Vyso helps South African SMEs see where cost, time, stock and margin are leaking across procurement, waste and pricing—before it shows up in next month's numbers.",
    eyebrow: "Vyso for money leakage",
    heroPlain: "The money isn't missing.",
    heroAccent: "It's just not visible yet.",
    lead:
      "Most businesses don't lose money in one dramatic event. It leaks out in small, repeated amounts—stock variance, price creep, duplicated spend, hours of unbilled admin—scattered across tools that never talk to each other.",
    problem: [
      "Money leakage rarely looks like fraud or a single bad decision. It looks like a delivery that was short by a few units and never flagged, a supplier price that crept up three months ago and was never renegotiated, or a manager who quietly absorbed two extra hours of admin because the report had to go out on Friday.",
      "Individually, each of these looks too small to investigate. Collectively, across a month of orders, waste and pricing decisions, they add up to a meaningful share of margin—and because the information sits in different spreadsheets, WhatsApp threads and people's memory, no one is actually positioned to see the pattern.",
    ],
    struggles: [
      { title: "No single source of truth", copy: "Stock counts, supplier spend, orders and waste live in separate spreadsheets and apps, so nobody can compare them against each other." },
      { title: "Reviews happen monthly, leaks happen weekly", copy: "By the time a manager sits down to reconcile the numbers, the small losses that caused the gap are long forgotten." },
      { title: "Ownership is unclear", copy: "Spotting leakage is technically everyone's job—which in practice means it is often no one's job." },
      { title: "Small losses look too small to chase", copy: "A R200 variance here and a R400 price increase there rarely trigger action on their own, even though the pattern repeats every week." },
    ],
    costIntro:
      "The figures below are indicative, based on the patterns we typically see in growing South African food and operations businesses before tighter controls are in place. Your own numbers are confirmed during the one-week audit.",
    costStats: [
      { value: "R8k–R25k", label: "typical monthly stock and pricing variance before tighter controls" },
      { value: "6–10 hrs", label: "manager time spent reconciling numbers across spreadsheets each week" },
      { value: "3–5%", label: "of revenue that can quietly erode through untracked margin drift" },
      { value: "30+ days", label: "average delay before a leak becomes visible in a monthly report" },
    ],
    costNote:
      "None of these numbers are dramatic on their own. That is exactly why they are hard to catch without a system that is watching continuously, rather than a person reviewing once a month.",
    helpIntro:
      "Vyso does not add another spreadsheet to reconcile. It connects the workflows where leakage actually happens—purchasing, stock, pricing and reporting—so variances surface as they occur, not weeks later.",
    modules: [
      { name: "InsightGen", role: "Cross-workflow reporting and anomaly alerts" },
      { name: "WasteWatch", role: "Daily waste and shrinkage patterns" },
      { name: "PricePilot", role: "Selling-price and margin decisions" },
      { name: "ProcurePulse", role: "Purchasing and stock intelligence" },
    ],
    workflow: [
      { title: "Connect the workflow", copy: "Stock, spend and orders are pulled into one operating record instead of separate files." },
      { title: "Set the thresholds", copy: "You define what counts as a meaningful variance, price movement or delay worth flagging." },
      { title: "Surface it early", copy: "InsightGen flags anomalies as they happen, not once someone finally reconciles the month." },
      { title: "Review and close the loop", copy: "Managers action flagged items inside the same workflow, so the fix is recorded, not just noticed." },
    ],
    industries: [
      { label: "Restaurants", href: "/industries/restaurants" },
      { label: "Catering companies", href: "/industries/catering-companies" },
      { label: "Wholesale", href: "/industries/wholesale" },
      { label: "Hospitality", href: "/industries/hospitality" },
      { label: "Food suppliers", href: "/industries/food-suppliers" },
      { label: "Farms & producers", href: "/industries/farms" },
    ],
    learnArticles: [
      { label: "Why Businesses Lose Money Without Realising It", href: "/learn/why-businesses-lose-money-without-realising-it" },
      { label: "How Poor Procurement Creates Cost Leakage", href: "/learn/how-poor-procurement-creates-cost-leakage" },
      { label: "How Stock Variance Impacts Profit", href: "/learn/how-stock-variance-impacts-profit" },
      { label: "How Manual Reporting Hides Operational Problems", href: "/learn/how-manual-reporting-hides-operational-problems" },
    ],
    faqs: [
      { question: "How does Vyso find money leakage we can't see today?", answer: "By connecting the workflows where it actually happens—purchasing, stock and pricing—into one record, then flagging variances against thresholds you set. The one-week audit maps where your business is most exposed before any system is configured." },
      { question: "Do we need to replace our existing reporting before this works?", answer: "No. Vyso can sit alongside your current tools while the audit determines which parts of the workflow are creating the biggest blind spots, and which should move into Vyso first." },
      { question: "How quickly can we expect to see where money is leaking?", answer: "That depends on the workflow and the data available. Some patterns—like recurring stock variance—become visible within the first weeks of tighter tracking. The audit gives a realistic view before any commitment is made." },
      { question: "Is this only useful for large operations?", answer: "No. A single growing restaurant, farm or supplier can be a fit once the leakage is no longer small enough to shrug off, even without multiple locations or a large team." },
    ],
  },
  "procurement-automation": {
    name: "Procurement automation",
    shortName: "Procurement Automation",
    summary:
      "Fewer manual approvals, fewer supplier errors, less duplicated work and clearer visibility before money goes out the door.",
    title: "Procurement Automation Software | Vyso",
    description:
      "Vyso automates purchase requests, approvals, supplier pricing and reconciliation for South African SMEs, so procurement stops running on WhatsApp messages and memory.",
    eyebrow: "Vyso for procurement automation",
    heroPlain: "Purchasing shouldn't run",
    heroAccent: "on memory and WhatsApp.",
    lead:
      "When approvals happen over a phone call and prices live in someone's head, purchasing decisions are made blind. Vyso brings requests, approvals, supplier terms and reconciliation into one workflow that a team can actually see.",
    problem: [
      "In a lot of growing SMEs, procurement is not a process—it is a set of habits. A manager notices stock is low, sends a message to a supplier, and the order happens before anyone else in the business knows it was placed. Approval, if it happens at all, comes after the money is already committed.",
      "The same gap shows up in pricing. Supplier terms and negotiated rates live in an old spreadsheet, an inbox, or a person's memory, so the price actually paid can quietly drift from the price that was agreed—and nobody notices until the invoice lands.",
    ],
    struggles: [
      { title: "Approvals happen after the spend", copy: "By the time anyone reviews a purchase, the order has already been placed and the supplier is expecting payment." },
      { title: "Prices live in someone's head", copy: "Negotiated rates and rebates sit in old sheets or memory, so the price actually charged can drift from what was agreed." },
      { title: "Orders get duplicated", copy: "Without one shared view, two people can raise the same order because neither could see what had already gone out." },
      { title: "No paper trail when something goes wrong", copy: "When a delivery is short or a price is wrong, there is no consistent record of what was requested, approved or agreed." },
    ],
    costIntro:
      "These figures are indicative, based on patterns we typically see in food and operations businesses before procurement is brought into one workflow. Your own exposure is confirmed during the audit.",
    costStats: [
      { value: "R5k–R20k", label: "extra monthly spend from duplicated or rushed orders" },
      { value: "5–8 hrs", label: "admin time spent chasing approvals and confirming prices each week" },
      { value: "2–4 weeks", label: "typical time before a bad supplier deal is even noticed" },
      { value: "Untracked", label: "emergency purchases made at higher prices when the normal channel was too slow" },
    ],
    costNote:
      "Most of this cost is invisible in a standard set of accounts. It shows up as slightly higher cost of goods sold, without ever being traced back to a specific broken step in the buying process.",
    helpIntro:
      "Vyso does not remove human judgement from purchasing. It gives requests, approvals and supplier terms a single visible home, so decisions are made with the right information in front of the right person.",
    modules: [
      { name: "ProcurePulse", role: "Purchasing and stock intelligence" },
      { name: "SupplySync", role: "Supplier records, terms and relationship history" },
      { name: "Doc-U", role: "Supplier-document capture and extraction" },
      { name: "PricePilot", role: "Agreed pricing and margin context" },
    ],
    workflow: [
      { title: "Request raised", copy: "A manager raises a purchase request inside the workflow, with the reason and urgency attached—not a chat thread." },
      { title: "Approval routed automatically", copy: "The right approver is notified and can approve or decline from one place, based on rules you set." },
      { title: "Order matched to supplier terms", copy: "SupplySync applies the agreed price and terms automatically, so the order reflects what was actually negotiated." },
      { title: "Delivery and invoice reconciled", copy: "Doc-U captures the delivery note and invoice, and reconciles them against the original order." },
    ],
    industries: [
      { label: "Restaurants", href: "/industries/restaurants" },
      { label: "Catering companies", href: "/industries/catering-companies" },
      { label: "Wholesale", href: "/industries/wholesale" },
      { label: "Hospitality", href: "/industries/hospitality" },
      { label: "Food suppliers", href: "/industries/food-suppliers" },
      { label: "Farms & producers", href: "/industries/farms" },
    ],
    learnArticles: [
      { label: "The Hidden Cost of Manual Procurement", href: "/learn/hidden-cost-of-manual-procurement" },
      { label: "How to Reduce Supplier Mistakes", href: "/learn/how-to-reduce-supplier-mistakes" },
      { label: "Procurement Approval Process Best Practices", href: "/learn/procurement-approval-process-best-practices" },
      { label: "Supplier Scorecards: What to Track", href: "/learn/supplier-scorecards-what-to-track" },
    ],
    faqs: [
      { question: "Does procurement automation mean we lose control over purchasing?", answer: "No—it is the opposite. Approval rules, spend limits and sign-off are configured by you. Vyso makes sure requests are visible and routed correctly, rather than removing human decisions from the process." },
      { question: "Can approvals still happen quickly for urgent orders?", answer: "Yes. Urgent requests can be flagged and routed to the right approver immediately. The goal is a faster, visible approval—not a slower one." },
      { question: "Do our suppliers need to change how they send orders or invoices?", answer: "Not necessarily. Doc-U can capture documents in the formats suppliers already use—email, PDF or photographed paperwork—for review before they become confirmed records. Any deeper supplier integration is confirmed during scoping." },
      { question: "What happens to our current approval process during rollout?", answer: "The one-week audit maps your current process first. Implementation then reproduces the decisions that already make sense inside Vyso, rather than forcing an unfamiliar workflow on day one." },
    ],
  },
  "reporting-automation": {
    name: "Reporting automation",
    shortName: "Reporting Automation",
    summary:
      "Live dashboards and automated operational summaries that replace the weekly report someone has to build by hand.",
    title: "Reporting Automation Software | Vyso",
    description:
      "Vyso replaces manual weekly reporting with live dashboards and automated operational summaries, so South African SME leadership sees problems days earlier.",
    eyebrow: "Vyso for reporting automation",
    heroPlain: "Stop building the same report",
    heroAccent: "by hand, every single week.",
    lead:
      "By the time a manually built weekly report reaches leadership, the numbers in it are already days old and the person who built it has spent hours copying figures between spreadsheets instead of running the business.",
    problem: [
      "Manual reporting is one of the most common places operational time disappears. A manager pulls stock figures from one system, sales from another, waste from a notebook and supplier spend from an inbox, then spends an evening turning it into something leadership can actually read.",
      "The report that results is a snapshot of last week, not this week. Decisions get made on numbers that were already out of date by the time anyone opened the spreadsheet—and if the person who builds the report is out sick, the report often just doesn't happen.",
    ],
    struggles: [
      { title: "Numbers live in five different places", copy: "Stock, sales, waste and spend sit in separate tools before anyone can pull them into one report." },
      { title: "Reports are outdated before they're read", copy: "Building the report takes long enough that the numbers inside it have already moved on." },
      { title: "One person owns a fragile spreadsheet", copy: "A single broken formula or a person's absence can mean the report simply doesn't get built that week." },
      { title: "Leadership sees problems late", copy: "By the time an issue shows up in a weekly report, it has usually already cost money for several days." },
    ],
    costIntro:
      "These figures are indicative, based on patterns we typically see across South African SME operations before reporting is automated. Your own numbers are confirmed during the audit.",
    costStats: [
      { value: "6–12 hrs", label: "manager or admin time spent compiling weekly reports by hand" },
      { value: "3–7 days", label: "typical delay between a problem occurring and it appearing in a report" },
      { value: "R15k+", label: "monthly value of admin hours spent assembling reports manually" },
      { value: "1 broken link", label: "away from the report simply not happening that week" },
    ],
    costNote:
      "The real cost is rarely the hours themselves—it is the decisions made a week too late because the report that should have flagged the problem hadn't been built yet.",
    helpIntro:
      "Vyso builds the report from the workflow itself, as work happens, instead of asking a person to reconstruct it afterwards. Finch adds a way to ask follow-up questions without waiting for someone to dig through the numbers.",
    modules: [
      { name: "InsightGen", role: "Cross-workflow reporting and automated summaries" },
      { name: "Finch", role: "Operations assistant that answers questions on authorised data" },
      { name: "Doc-U", role: "Document capture feeding the operating record" },
      { name: "OrderFlow", role: "Connected commercial data behind the numbers" },
    ],
    workflow: [
      { title: "Data flows in as work happens", copy: "Orders, stock movements, waste and purchases update the record live, not once a week." },
      { title: "InsightGen builds the summary automatically", copy: "The weekly report is assembled from the connected workflow instead of copied by hand." },
      { title: "Finch answers the follow-up questions", copy: "Ask about a specific number instead of waiting for someone to go and find it." },
      { title: "Leadership sees it before it becomes a problem", copy: "Flags surface days earlier than a manually built report ever could." },
    ],
    industries: [
      { label: "Restaurants", href: "/industries/restaurants" },
      { label: "Catering companies", href: "/industries/catering-companies" },
      { label: "Wholesale", href: "/industries/wholesale" },
      { label: "Hospitality", href: "/industries/hospitality" },
      { label: "Food suppliers", href: "/industries/food-suppliers" },
      { label: "Farms & producers", href: "/industries/farms" },
    ],
    learnArticles: [
      { label: "12 Operational KPIs Every CEO Should Track", href: "/learn/12-operational-kpis-every-ceo-should-track" },
      { label: "Why Weekly Reports Are Usually Too Late", href: "/learn/why-weekly-reports-are-usually-too-late" },
      { label: "Excel vs AI Reporting Software", href: "/learn/excel-vs-ai-reporting-software" },
      { label: "How Real-Time Dashboards Improve Decision-Making", href: "/learn/how-real-time-dashboards-improve-decision-making" },
    ],
    faqs: [
      { question: "Will this replace the spreadsheets we already report from?", answer: "That depends on the workflow. Some spreadsheets can be retired once the underlying data moves into Vyso; others may remain as a working tool while Vyso handles the summary and reporting layer. The audit confirms the sensible boundary." },
      { question: "How much manual work is still required once this is set up?", answer: "Considerably less. The aim is for the report to build itself from work that already happened in the workflow, rather than requiring someone to reconstruct it. Some exceptions may still need a person's input before they're reported on." },
      { question: "Can Finch answer questions managers currently dig for manually?", answer: "Finch can read authorised data and answer questions about it, but current design keeps consequential actions under human review—it prepares answers and drafts rather than finalising decisions on its own." },
      { question: "Do we need clean data before reporting automation can work?", answer: "Not perfectly clean. The audit looks at what data already exists and how reliable it is, and implementation is scoped around what can realistically be automated first." },
    ],
  },
  "operations-dashboard": {
    name: "Operations dashboard",
    shortName: "Operations Dashboard",
    summary:
      "One connected view across procurement, inventory, labour, sales and workflow status—instead of six separate spreadsheets.",
    title: "Operations Dashboard Software | Vyso",
    description:
      "Vyso gives South African SME leadership one connected dashboard across procurement, inventory, labour and sales, instead of stitching together separate spreadsheets.",
    eyebrow: "Vyso for operations dashboards",
    heroPlain: "One dashboard.",
    heroAccent: "Every part of the operation.",
    lead:
      "Leadership often has to check five or six different systems and spreadsheets to get a partial picture of how the business is doing. Vyso brings procurement, stock, labour, sales and workflow status into one connected view.",
    problem: [
      "Most growing businesses don't lack data—they lack a place to see it together. Procurement has its own spreadsheet, stock has another, shift schedules live somewhere else, and sales figures come from a separate system entirely. Getting a single view means someone manually stitching all of it together.",
      "That stitching is fragile. It breaks when a format changes, it depends on one person remembering to update it, and it usually only happens once a week—so leadership ends up asking staff for updates instead of simply seeing them.",
    ],
    struggles: [
      { title: "Every department has its own version of the truth", copy: "Procurement, stock, labour and sales are tracked separately, with no shared record to compare them against." },
      { title: "A combined view means manual copying", copy: "Building one picture of the business currently means someone assembling numbers from several sources by hand." },
      { title: "Dashboards get built once, then abandoned", copy: "A spreadsheet dashboard breaks the first time the underlying data changes shape, and often never gets fixed." },
      { title: "Owners end up asking staff for updates", copy: "Without a live view, leadership relies on someone remembering to report status rather than seeing it directly." },
    ],
    costIntro:
      "These figures are indicative, based on patterns we typically see across South African SME operations before a connected dashboard is in place.",
    costStats: [
      { value: "5+ spreadsheets", label: "commonly stitched together manually to see one view of the business" },
      { value: "R10k+", label: "monthly value of leadership and admin time spent assembling cross-department views" },
      { value: "Days, not minutes", label: "how long it typically takes to answer \"how are we doing right now?\"" },
      { value: "Recurring", label: "decisions made on outdated numbers because a live picture wasn't available" },
    ],
    costNote:
      "The cost here is mostly opportunity cost—decisions delayed or made on stale information because nobody had time to assemble the full picture sooner.",
    helpIntro:
      "Vyso doesn't ask each department to report into a shared spreadsheet. Every module records its own activity, and InsightGen pulls that activity together into one dashboard, scoped to what each role actually needs to see.",
    modules: [
      { name: "InsightGen", role: "Cross-module dashboards and alerts" },
      { name: "OrderFlow", role: "Connected commercial and sales activity" },
      { name: "ProcurePulse", role: "Purchasing and stock intelligence" },
      { name: "ShiftBoard", role: "Staff availability and shift planning" },
    ],
    workflow: [
      { title: "Each module records its own activity", copy: "Orders, stock, shifts and waste update as the work happens across teams." },
      { title: "InsightGen consolidates it into one view", copy: "Procurement, inventory, labour and sales sit on the same connected dashboard." },
      { title: "Roles see what's relevant to them", copy: "A shift manager sees their section; leadership sees the whole operation from one place." },
      { title: "Alerts replace status-chasing", copy: "Flagged issues surface on the dashboard instead of arriving as a WhatsApp message." },
    ],
    industries: [
      { label: "Restaurants", href: "/industries/restaurants" },
      { label: "Catering companies", href: "/industries/catering-companies" },
      { label: "Wholesale", href: "/industries/wholesale" },
      { label: "Hospitality", href: "/industries/hospitality" },
      { label: "Food suppliers", href: "/industries/food-suppliers" },
      { label: "Farms & producers", href: "/industries/farms" },
    ],
    learnArticles: [
      { label: "How Real-Time Dashboards Improve Decision-Making", href: "/learn/how-real-time-dashboards-improve-decision-making" },
      { label: "12 Operational KPIs Every CEO Should Track", href: "/learn/12-operational-kpis-every-ceo-should-track" },
      { label: "Why Weekly Reports Are Usually Too Late", href: "/learn/why-weekly-reports-are-usually-too-late" },
      { label: "How Manual Reporting Hides Operational Problems", href: "/learn/how-manual-reporting-hides-operational-problems" },
    ],
    faqs: [
      { question: "Can different roles see different parts of the dashboard?", answer: "Yes. Access and views are scoped by role, so a shift manager sees what's relevant to their section while leadership can see the full cross-module picture." },
      { question: "Does the dashboard replace our existing systems?", answer: "Not necessarily. It depends on which systems already produce reliable data. The audit determines what feeds the dashboard directly and what, if anything, should move into a Vyso module first." },
      { question: "How long does it take to get a working dashboard live?", answer: "It depends on how many modules and data sources are involved. A dashboard built on one or two connected workflows is quicker than one spanning the full operation. Timing is confirmed after the audit." },
      { question: "Can we start with one department before expanding?", answer: "Yes. Most teams start with the area causing the most friction—often procurement or stock—and expand the dashboard as more of the operation moves into Vyso." },
    ],
  },
};

const STRUGGLE_ICONS = [Eye, Clock, AlertTriangle, FileWarning] as const;
const WORKFLOW_ICONS = [ClipboardList, Workflow, Bell, LayoutDashboard] as const;

export function generateStaticParams() {
  return Object.keys(SOLUTIONS).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const solution = SOLUTIONS[slug];
  if (!solution) return {};

  return {
    title: solution.title,
    description: solution.description,
    alternates: { canonical: `/solutions/${slug}` },
    openGraph: {
      title: solution.title,
      description: solution.description,
      url: `/solutions/${slug}`,
      siteName: "Vyso",
      locale: "en_ZA",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
    },
    twitter: {
      card: "summary_large_image",
      title: solution.title,
      description: solution.description,
      images: ["/og.png"],
    },
  };
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const solution = SOLUTIONS[slug];
  if (!solution) notFound();

  const url = `https://vyso.co.za/solutions/${slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: solution.title,
        description: solution.description,
        isPartOf: { "@id": "https://vyso.co.za/#website" },
        breadcrumb: { "@id": `${url}#breadcrumb` },
        mainEntity: { "@id": `${url}#service` },
        inLanguage: "en-ZA",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za/" },
          { "@type": "ListItem", position: 2, name: "Solutions", item: "https://vyso.co.za/solutions" },
          { "@type": "ListItem", position: 3, name: solution.shortName, item: url },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `${solution.name} with Vyso`,
        serviceType: "Configurable operations software and implementation",
        description: solution.description,
        provider: { "@id": "https://vyso.co.za/#organization" },
        areaServed: { "@type": "Country", name: "South Africa" },
      },
      {
        "@type": "FAQPage",
        mainEntity: solution.faqs.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };

  return (
    <PublicPageShell>
      <JsonLd data={structuredData} />

      <section className={styles.compactHero} aria-labelledby="solution-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Solutions", href: "/solutions" },
              { label: solution.shortName },
            ]}
          />
          <p className={styles.eyebrow}>{solution.eyebrow}</p>
          <h1 id="solution-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>{solution.heroPlain}</span>{" "}
            <span className={styles.blendAccent}>{solution.heroAccent}</span>
          </h1>
          <p className={styles.compactLead}>{solution.lead}</p>
          <div className={styles.actions}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.glassButton} href="/pricing">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solution-problem-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>The problem</p>
              <h2 id="solution-problem-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Why this keeps happening.
              </h2>
            </div>
            <div>
              {solution.problem.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className={styles.sectionCopy}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solution-struggles-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Why businesses struggle</p>
              <h2 id="solution-struggles-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                It&apos;s rarely one big failure.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              These are the recurring patterns behind {solution.name.toLowerCase()}. The
              audit confirms which ones are actually present in your operation.
            </p>
          </div>

          <div className={styles.answerGrid}>
            {solution.struggles.map(({ title, copy }, index) => {
              const Icon = STRUGGLE_ICONS[index % STRUGGLE_ICONS.length];
              return (
                <article key={title} className={styles.glassCard}>
                  <span className={styles.cardIcon}><Icon aria-hidden="true" size={19} /></span>
                  <h3 className={styles.cardTitle}>{title}</h3>
                  <p className={styles.cardCopy}>{copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solution-cost-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>What it costs</p>
              <h2 id="solution-cost-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Small losses, repeated often.
              </h2>
            </div>
            <p className={styles.sectionCopy}>{solution.costIntro}</p>
          </div>

          <div className={styles.statGrid}>
            {solution.costStats.map(({ value, label }) => (
              <div key={label} className={styles.statCard}>
                <p className={styles.statValue}>{value}</p>
                <p className={styles.statLabel}>{label}</p>
              </div>
            ))}
          </div>
          <p className={styles.bodyCopy} style={{ marginTop: "1.5rem" }}>{solution.costNote}</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solution-help-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>How Vyso helps</p>
              <h2 id="solution-help-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                A possible module shape.
              </h2>
            </div>
            <p className={styles.sectionCopy}>{solution.helpIntro}</p>
          </div>

          <div className={styles.moduleGrid}>
            {solution.modules.map(({ name, role }) => (
              <article key={name} className={styles.moduleCard}>
                <p className={styles.cardKicker}>Vyso module</p>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardCopy}>{role}</p>
              </article>
            ))}
          </div>
          <div className={styles.actions}>
            <Link className={styles.textLink} href="/platform">
              Explore the full platform <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solution-workflow-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Example workflow</p>
              <h2 id="solution-workflow-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                What it looks like in practice.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              A representative flow—the exact sequence is confirmed for your operation
              during implementation.
            </p>
          </div>

          <ol className={`${styles.processLine} ${styles.processLineFour}`} aria-label={`${solution.name} workflow`}>
            {solution.workflow.map(({ title, copy }, index) => {
              const Icon = WORKFLOW_ICONS[index % WORKFLOW_ICONS.length];
              return (
                <li key={title} className={styles.processStep}>
                  <span className={styles.processMarker}>
                    <Icon aria-hidden="true" size={21} strokeWidth={1.8} />
                  </span>
                  <div className={styles.processText}>
                    <h3 className={styles.processTitle}>{title}</h3>
                    <p className={styles.processCopy}>{copy}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solution-related-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>Relevant industries</p>
            <h2 id="solution-related-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Where this fits.
            </h2>
            <div className={styles.actions}>
              {solution.industries.map(({ label, href }) => (
                <Link key={href} className={styles.textLink} href={href}>
                  {label} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className={styles.sectionKicker}>Related reading</p>
            <h3 className={styles.cardTitle}>Go deeper on this problem.</h3>
            <div className={styles.actions}>
              {solution.learnArticles.map(({ label, href }) => (
                <Link key={href} className={styles.textLink} href={href}>
                  {label} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="solution-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Common questions</p>
          <h2 id="solution-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Fit before implementation.
          </h2>
          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            {solution.faqs.map(({ question, answer }) => (
              <article key={question} className={styles.answerCard}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Start with the problem"
        title={`Show us how ${solution.name.toLowerCase()} shows up in your business.`}
        copy="We will map the actual workflow, identify the highest-value gap and tell you honestly whether Vyso is the right system to address it."
        primaryLabel="Join Waitlist"
        secondaryLabel="View the platform"
        secondaryHref="/platform"
      />
    </PublicPageShell>
  );
}
