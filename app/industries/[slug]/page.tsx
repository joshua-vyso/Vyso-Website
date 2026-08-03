import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, ClipboardList, HandCoins, Route } from "lucide-react";

import {
  AbstractFlowBackdrop,
  Breadcrumbs,
  JsonLd,
  MarketingCta,
  PublicPageShell,
  marketingStyles as styles,
} from "@/components/marketing/PublicMarketing";

type Industry = {
  name: string;
  shortName: string;
  title: string;
  description: string;
  eyebrow: string;
  heroPlain: string;
  heroAccent: string;
  lead: string;
  gaps: readonly { title: string; copy: string }[];
  modules: readonly { name: string; role: string }[];
  outcomes: readonly string[];
  faqs: readonly { question: string; answer: string }[];
};

const INDUSTRIES: Record<string, Industry> = {
  restaurants: {
    name: "Restaurant operations",
    shortName: "Restaurants",
    title: "Restaurant Operations Software in South Africa | Vyso",
    description:
      "Vyso helps South African restaurants create clearer workflows for procurement, stock, waste, staffing, pricing and operational reporting.",
    eyebrow: "Vyso for restaurants",
    heroPlain: "Less firefighting before service.",
    heroAccent: "Clearer operations behind it.",
    lead:
      "Vyso helps restaurant teams replace scattered routines with connected workflows for purchasing, stock, waste, shifts, pricing and management visibility—configured around the way the operation actually runs.",
    gaps: [
      { title: "Buying without one source of truth", copy: "Supplier orders, expected deliveries and price changes live across messages, calls and separate sheets." },
      { title: "Waste recorded too late—or not at all", copy: "The cost is visible in the month-end numbers, but the daily reason and recurring pattern are missing." },
      { title: "Labour and demand are disconnected", copy: "Shifts are planned separately from the operating picture, making labour decisions harder to review." },
      { title: "Margins drift between reviews", copy: "Ingredient costs move faster than selling prices, while owners wait for another spreadsheet update." },
    ],
    modules: [
      { name: "ProcurePulse", role: "Purchasing and stock intelligence" },
      { name: "WasteWatch", role: "Daily waste and shrinkage patterns" },
      { name: "ShiftBoard", role: "Staff availability and shift planning" },
      { name: "PricePilot", role: "Selling-price and margin decisions" },
      { name: "InsightGen", role: "Cross-workflow reporting and alerts" },
      { name: "Doc-U", role: "Supplier-document capture and extraction" },
    ],
    outcomes: [
      "A repeatable purchasing routine that does not depend on one person's message history.",
      "Waste captured close to the moment it happens, with reasons that can be reviewed.",
      "Labour, buying and margin information that can be discussed from the same operating record.",
      "Short, role-based workflows designed for the people doing the work.",
    ],
    faqs: [
      { question: "Does Vyso replace a restaurant POS?", answer: "Not by default. Vyso focuses on operational workflows around the POS—such as purchasing, stock, waste, staffing, pricing and reporting. Any useful POS connection is assessed during scoping." },
      { question: "Can a restaurant start with only one workflow?", answer: "Yes. The recommended approach is to begin with the highest-value operational gap, implement it properly and add another module only when the next need is clear." },
      { question: "Is Vyso only for restaurant groups?", answer: "No. A single growing restaurant can be a fit when the repeated admin and handovers have already outgrown WhatsApp, paper or spreadsheets." },
    ],
  },
  "food-suppliers": {
    name: "Food supplier order management",
    shortName: "Food suppliers",
    title: "Food Supplier Order Management Software | Vyso",
    description:
      "Connect customer orders, price lists, quotes, invoices, delivery notes and payments with OrderFlow for South African food suppliers and distributors.",
    eyebrow: "Vyso for food suppliers",
    heroPlain: "From customer request",
    heroAccent: "to paid invoice—one flow.",
    lead:
      "OrderFlow gives food suppliers and distributors a connected route through customer records, price lists, orders, invoices, delivery documents and payment tracking—without rebuilding the same commercial record at each step.",
    gaps: [
      { title: "Orders arrive in every format", copy: "Customers send messages, emails, spreadsheets, PDFs and photos that someone still needs to interpret and recapture." },
      { title: "The right price depends on the customer", copy: "Contract pricing, rebates and exceptions are hard to apply consistently when lists live in separate files." },
      { title: "Documents repeat the same information", copy: "A quote becomes an order, delivery note and invoice, but teams retype the customer and line items each time." },
      { title: "Outstanding money is checked after the fact", copy: "The operational team can see the order, while payment status sits somewhere else and follow-up loses context." },
    ],
    modules: [
      { name: "OrderFlow", role: "Customer order-to-cash workflow" },
      { name: "Doc-U", role: "Customer-order and supplier-document intake" },
      { name: "PricePilot", role: "Customer pricing and margin context" },
      { name: "SupplySync", role: "Supplier records and relationship history" },
      { name: "ProcurePulse", role: "Stock and purchasing intelligence" },
      { name: "InsightGen", role: "Operational reporting and alerts" },
    ],
    outcomes: [
      "One customer record connected to the documents and commercial rules that matter.",
      "A visible status from request and quote through order, invoice and payment.",
      "Customer-specific pricing resolved inside the workflow rather than recalled from memory.",
      "Uploaded customer orders reviewed by a person before they become confirmed records.",
    ],
    faqs: [
      { question: "Can OrderFlow handle customer-specific price lists?", answer: "Yes. Customer and shared price lists can be used when preparing quotes, orders and invoices, with commercial rules confirmed during implementation." },
      { question: "Can customers continue ordering through WhatsApp or email?", answer: "Potentially, yes. The implementation maps how orders currently arrive and decides which intake routes can feed a controlled review workflow without forcing customers into an unsuitable process." },
      { question: "Does OrderFlow include delivery notes and payment tracking?", answer: "Yes. Delivery notes, credit notes and received payments can remain connected to the originating customer and commercial documents." },
    ],
  },
  farms: {
    name: "Farm and producer order management",
    shortName: "Farms & producers",
    title: "Farm Order Management Software in South Africa | Vyso",
    description:
      "Vyso helps South African farms and producers manage repeat customer orders, price lists, availability, invoices, delivery documents and payments in one workflow.",
    eyebrow: "Vyso for farms & producers",
    heroPlain: "Repeat buyers. Variable supply.",
    heroAccent: "A clearer commercial workflow.",
    lead:
      "Vyso helps farms and producers manage the operational handover between what is available, what a buyer ordered, what price applies, what was delivered and what remains unpaid.",
    gaps: [
      { title: "Availability changes faster than the spreadsheet", copy: "Products, grades and quantities move while customer orders are still being consolidated through calls and messages." },
      { title: "Repeat buyers have different terms", copy: "Customer prices, rebates, delivery arrangements and payment terms are difficult to apply from memory." },
      { title: "Order and delivery records separate", copy: "The team needs to know not only what was requested, but what was confirmed, packed, delivered and invoiced." },
      { title: "Commercial visibility arrives late", copy: "Outstanding invoices and recent order activity are harder to act on when they live outside the daily workflow." },
    ],
    modules: [
      { name: "OrderFlow", role: "Repeat customer orders and invoicing" },
      { name: "ProcurePulse", role: "Availability and stock intelligence" },
      { name: "PricePilot", role: "Customer pricing and margin context" },
      { name: "Doc-U", role: "Order and document extraction" },
      { name: "SupplySync", role: "Input supplier records and history" },
      { name: "InsightGen", role: "Operational reporting and alerts" },
    ],
    outcomes: [
      "Repeat customer orders kept against one account history.",
      "Prices and commercial terms available when the order is prepared.",
      "Delivery and invoice documents connected to the same originating order.",
      "A clearer view of outstanding money and recent customer activity.",
    ],
    faqs: [
      { question: "Is Vyso farm-management or agronomy software?", answer: "Vyso is focused on the operational and commercial workflow around customers, orders, stock context, documents and payments. It is not positioned as agronomy, crop-planning or precision-agriculture software." },
      { question: "Can OrderFlow support repeat wholesale buyers?", answer: "Yes. Repeat customer records, price lists, orders, invoices, delivery notes and payments are central to the OrderFlow workflow." },
      { question: "Can a producer start before every process is standardised?", answer: "Yes. The one-week audit maps the current reality first and defines one practical starting workflow rather than assuming the whole operation is already standardised." },
    ],
  },
  "catering-companies": {
    name: "Catering operations",
    shortName: "Catering companies",
    title: "Catering Company Operations Software in South Africa | Vyso",
    description:
      "Vyso helps South African catering companies cost events accurately, coordinate procurement and production, generate invoices and keep weekly wastage and margin under control.",
    eyebrow: "Vyso for catering companies",
    heroPlain: "Every event costed properly.",
    heroAccent: "Every week under control.",
    lead:
      "Vyso helps catering teams connect event costing, procurement, production planning, invoicing and wastage into one operating record—so a good week is not just the ones somebody happened to track closely.",
    gaps: [
      { title: "Event costs are estimated, not tracked", copy: "Quotes are built from experience and old spreadsheets, while the real ingredient, labour and hire cost of an event is rarely compared back afterwards." },
      { title: "Procurement runs event to event", copy: "Buying decisions are made per booking, with little visibility into what was already ordered, on hand, or needed across the week's functions." },
      { title: "Production planning lives in someone's head", copy: "Prep lists, staffing and kitchen timelines are coordinated verbally or on paper, and get harder to hold together as bookings overlap." },
      { title: "Invoicing trails the event by weeks", copy: "Final invoices, extras and deposits are reconciled long after the function, making cash flow and client billing harder to manage." },
    ],
    modules: [
      { name: "PlanWise", role: "Event costing and margin forecasting" },
      { name: "ProcurePulse", role: "Procurement and stock across bookings" },
      { name: "ShiftBoard", role: "Kitchen and event staff planning" },
      { name: "OrderFlow", role: "Quotes, invoicing and client accounts" },
      { name: "WasteWatch", role: "Wastage across functions and prep" },
      { name: "InsightGen", role: "Weekly operational reporting" },
    ],
    outcomes: [
      "Each event costed against real ingredient, labour and hire numbers, not last year's guess.",
      "One purchasing view across overlapping bookings, instead of ordering event by event.",
      "Production and staffing plans that hold together when the week gets busy.",
      "Invoices and deposits reconciled close to the event, not weeks later.",
    ],
    faqs: [
      { question: "Can Vyso cost individual events or functions?", answer: "Yes. Event-level costing—ingredients, labour, hire and other line items—can be tracked and compared against the original quote as part of the implementation." },
      { question: "Does Vyso help when several events overlap in the same week?", answer: "Yes. Procurement, production planning and staffing are designed to give one operating view across concurrent bookings rather than treating each event in isolation." },
      { question: "Can a catering business start with just invoicing or just procurement?", answer: "Yes. The audit identifies where the biggest operational gap is—often costing or procurement—and that becomes the first workflow, with other modules added later." },
    ],
  },
  wholesale: {
    name: "Wholesale operations",
    shortName: "Wholesale",
    title: "Wholesale Operations Software in South Africa | Vyso",
    description:
      "Vyso helps South African wholesalers control purchasing, inventory movement, order processing, supplier management, margin and operational reporting from one connected system.",
    eyebrow: "Vyso for wholesale",
    heroPlain: "Stock moves fast.",
    heroAccent: "Your visibility should too.",
    lead:
      "Vyso helps wholesale operations connect purchasing, inventory movement, order processing, supplier management and margin decisions—so volume does not mean losing sight of what's actually happening.",
    gaps: [
      { title: "Purchasing reacts to stockouts", copy: "Reorder decisions are triggered by a shortage someone notices, rather than a clear view of stock levels and movement across lines." },
      { title: "Inventory movement is hard to trust", copy: "What's on the shelf, in transit and on order lives across different systems and sheets, so counts drift from reality." },
      { title: "Order processing depends on manual capture", copy: "Customer orders arriving by call, email or message still need to be retyped into the system that actually ships and invoices." },
      { title: "Margin is reviewed after the fact", copy: "Cost price changes from suppliers reach the selling price late, if at all, so margin erosion is only visible at month-end." },
    ],
    modules: [
      { name: "ProcurePulse", role: "Purchasing and inventory intelligence" },
      { name: "OrderFlow", role: "Order processing and invoicing" },
      { name: "SupplySync", role: "Supplier records and performance" },
      { name: "PricePilot", role: "Margin and selling-price control" },
      { name: "InsightGen", role: "Operational reporting across lines" },
      { name: "Doc-U", role: "Purchase order and invoice capture" },
    ],
    outcomes: [
      "Reorder decisions based on real stock movement, not the next stockout.",
      "One inventory record that purchasing, sales and dispatch can all trust.",
      "Customer orders captured once and carried through to invoicing.",
      "Selling prices that keep pace with supplier cost changes, reviewed on a routine, not a surprise.",
    ],
    faqs: [
      { question: "Does Vyso replace our warehouse or inventory management system?", answer: "Not necessarily. Vyso can sit alongside existing stock systems or become the operational record for purchasing, orders and reporting—confirmed during scoping." },
      { question: "Can Vyso handle high order volumes?", answer: "Yes. OrderFlow is built to carry repeat customer orders, pricing and invoicing through a connected workflow rather than a per-order manual process, and volume and workflow shape are assessed during the audit." },
      { question: "Can we start with purchasing before touching order processing?", answer: "Yes. The recommended approach is to start with the workflow carrying the most risk—often purchasing or margin visibility—and expand once that value is proven." },
    ],
  },
  hospitality: {
    name: "Hospitality operations",
    shortName: "Hospitality",
    title: "Hospitality Operations Software in South Africa | Vyso",
    description:
      "Vyso gives South African hospitality operators multi-department visibility, supplier control, procurement approvals, staff workflows and executive dashboards in one connected system.",
    eyebrow: "Vyso for hospitality",
    heroPlain: "Every department, its own routine.",
    heroAccent: "One dashboard above it all.",
    lead:
      "Vyso helps hospitality operations connect kitchen, front-of-house, procurement and back-office workflows into a single operating picture—so leadership can see performance without chasing each department for an update.",
    gaps: [
      { title: "Departments run on separate routines", copy: "Kitchen, bar, housekeeping and front-of-house each track their own numbers, making it hard to see how the operation is performing as a whole." },
      { title: "Procurement approvals happen informally", copy: "Purchase requests move through calls, messages and verbal sign-off, with little record of who approved what and why." },
      { title: "Supplier performance is remembered, not recorded", copy: "Which suppliers deliver late, short or over-priced tends to live in someone's memory rather than a reviewable history." },
      { title: "Leadership waits for the report", copy: "Executives see performance once a manager has compiled it, rather than having a live view of the operation underneath them." },
    ],
    modules: [
      { name: "InsightGen", role: "Executive dashboards across departments" },
      { name: "ProcurePulse", role: "Procurement and stock intelligence" },
      { name: "SupplySync", role: "Supplier control and performance history" },
      { name: "ShiftBoard", role: "Staff scheduling and department workflows" },
      { name: "PlanWise", role: "Budgeting and forecasting by department" },
      { name: "Doc-U", role: "Approval and document capture" },
    ],
    outcomes: [
      "One operating picture across kitchen, front-of-house and back-office departments.",
      "Procurement approvals with a clear, reviewable record instead of a verbal trail.",
      "Supplier performance tracked consistently, not remembered selectively.",
      "Executives able to see performance directly, without waiting on a manual report.",
    ],
    faqs: [
      { question: "Can Vyso work across multiple departments in one property?", answer: "Yes. Vyso is designed to connect procurement, stock, staffing and reporting across departments into one operating record, configured around how the property actually runs." },
      { question: "Does Vyso support formal procurement approval chains?", answer: "Yes. Purchase requests and approvals can be routed and recorded as part of the procurement workflow, with the approval structure confirmed during implementation." },
      { question: "Is Vyso suitable for a multi-property hospitality group?", answer: "It can be. Group-level visibility depends on how consistently each property currently operates, which the audit assesses before recommending a rollout approach." },
    ],
  },
};

const GAP_ICONS = [ClipboardList, Boxes, HandCoins, Route] as const;

export function generateStaticParams() {
  return Object.keys(INDUSTRIES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const industry = INDUSTRIES[slug];
  if (!industry) return {};

  return {
    title: industry.title,
    description: industry.description,
    alternates: { canonical: `/industries/${slug}` },
    openGraph: {
      title: industry.title,
      description: industry.description,
      url: `/industries/${slug}`,
      siteName: "Vyso",
      locale: "en_ZA",
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Vyso — Operations, connected." }],
    },
    twitter: {
      card: "summary_large_image",
      title: industry.title,
      description: industry.description,
      images: ["/og.png"],
    },
  };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const industry = INDUSTRIES[slug];
  if (!industry) notFound();

  const url = `https://vyso.co.za/industries/${slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: industry.title,
        description: industry.description,
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
          { "@type": "ListItem", position: 2, name: "Vyso for SMEs", item: "https://vyso.co.za/platform/vyso-for-smes" },
          { "@type": "ListItem", position: 3, name: industry.shortName, item: url },
        ],
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `${industry.name} with Vyso`,
        serviceType: "Configurable operations software and implementation",
        description: industry.description,
        provider: { "@id": "https://vyso.co.za/#organization" },
        areaServed: { "@type": "Country", name: "South Africa" },
        audience: { "@type": "BusinessAudience", audienceType: industry.shortName },
      },
      {
        "@type": "FAQPage",
        mainEntity: industry.faqs.map(({ question, answer }) => ({
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

      <section className={styles.compactHero} aria-labelledby="industry-heading">
        <AbstractFlowBackdrop />
        <div className={styles.shell}>
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Vyso for SMEs", href: "/platform/vyso-for-smes" },
              { label: industry.shortName },
            ]}
          />
          <p className={styles.eyebrow}>{industry.eyebrow}</p>
          <h1 id="industry-heading" className={styles.compactTitle}>
            <span className={styles.blendPlain}>{industry.heroPlain}</span>{" "}
            <span className={styles.blendAccent}>{industry.heroAccent}</span>
          </h1>
          <p className={styles.compactLead}>{industry.lead}</p>
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

      <section className={styles.section} aria-labelledby="gaps-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>Operating gaps</p>
              <h2 id="gaps-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Start where information keeps falling through.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              These are the repeated breakdowns Vyso is designed to diagnose. The
              audit confirms which ones are actually present before a system is
              recommended.
            </p>
          </div>

          <div className={styles.answerGrid}>
            {industry.gaps.map(({ title: gapTitle, copy }, index) => {
              const Icon = GAP_ICONS[index % GAP_ICONS.length];
              return (
                <article key={gapTitle} className={styles.glassCard}>
                  <span className={styles.cardIcon}><Icon aria-hidden="true" size={19} /></span>
                  <h3 className={styles.cardTitle}>{gapTitle}</h3>
                  <p className={styles.cardCopy}>{copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="industry-modules-heading">
        <div className={styles.shell}>
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionKicker}>A possible module shape</p>
              <h2 id="industry-modules-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
                Configure the combination the workflow earns.
              </h2>
            </div>
            <p className={styles.sectionCopy}>
              This is a relevant module set, not a compulsory bundle. The audit
              decides where to start and which tools should remain in place.
            </p>
          </div>

          <div className={styles.moduleGrid}>
            {industry.modules.map(({ name, role }) => (
              <article key={name} className={styles.moduleCard}>
                <p className={styles.cardKicker}>Vyso module</p>
                <h3 className={styles.cardTitle}>{name}</h3>
                <p className={styles.cardCopy}>{role}</p>
              </article>
            ))}
          </div>
          <div className={styles.actions}>
            <Link className={styles.textLink} href="/platform/vyso-for-smes">
              Explore every Vyso module <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="outcomes-heading">
        <div className={`${styles.shell} ${styles.splitSection}`}>
          <div>
            <p className={styles.sectionKicker}>What better looks like</p>
            <h2 id="outcomes-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
              Clearer handovers. Less repeated admin.
            </h2>
          </div>
          <ul className={styles.list}>
            {industry.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}
          </ul>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="industry-faq-heading">
        <div className={styles.shell}>
          <p className={styles.sectionKicker}>Common questions</p>
          <h2 id="industry-faq-heading" className={`${styles.sectionTitle} ${styles.blendPlain}`}>
            Fit before implementation.
          </h2>
          <div className={styles.answerGrid} style={{ marginTop: "2.5rem" }}>
            {industry.faqs.map(({ question, answer }) => (
              <article key={question} className={styles.answerCard}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <MarketingCta
        eyebrow="Start with the operation"
        title={`Show us how ${industry.shortName.toLowerCase()} handle the work today.`}
        copy="We will map the actual workflow, identify the highest-value gap and tell you honestly whether Vyso is the right system to address it."
        primaryLabel="Join Waitlist"
        secondaryLabel="View the platform"
        secondaryHref="/platform"
      />
    </PublicPageShell>
  );
}
