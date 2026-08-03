import type { MarketingModule } from "../module-types";

export const supplysync: MarketingModule = {
  slug: "supplysync",
  name: "SupplySync",
  role: "Supplier relationships",
  tagline: "Supplier history and risk, in one searchable record.",
  description:
    "SupplySync is the record of who you buy from and how well they are performing: scorecards, price movement with the annual impact spelled out, credits you are still owed, compliance documents that expire, and every conversation you have had.",
  capabilities: [
    "A supplier directory with scorecards for reliability, quality, delivery, price stability and compliance",
    "Price-change detection with the annualised rand impact of each move",
    "Same-item cross-supplier comparison showing the annual saving from switching",
    "A credit and dispute ledger chasing short-ships and quality rejects to resolution",
    "Rebate agreements tracked as expected against received",
    "A compliance worklist for missing and expiring documents, with a real chase logged on request",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/supplysync-pricing.png",
      alt: "SupplySync pricing intelligence showing detected price changes with annualised impact and cross-supplier comparison.",
      label: "app.vyso.co.za/supplysync/pricing",
    },
    {
      src: "/screenshots/modules/supplysync-overview.png",
      alt: "SupplySync overview showing active suppliers, risk alerts, price moves and documents to action.",
      label: "app.vyso.co.za/supplysync",
    },
  ],
  featureSections: [
    {
      id: "pricing",
      title: "Every price move, with the annual cost of it",
      copy:
        "A three percent increase on one line reads as nothing and costs a fortune. Pricing intelligence detects each move as documents come in, states the old and new price, the change and its annualised impact, and then answers the follow-up question — is anyone else cheaper for the same item, and by how much a year.",
      bullets: [
        "“Price changes detected” lists Item, Supplier, Old → new, Change, Annualised impact, Source, Seen and Severity",
        "“Same item, different suppliers” shows the cheapest and dearest supplier, the spread, and the annual saving from switching",
        "Price watch compares each item against a market average and recommends Buy — below market, Review / negotiate or Stable",
        "Buying opportunities are badged Buy now, Negotiate, Review or Watch — and hand the actual purchase back to ProcurePulse",
      ],
      screenshot: null,
    },
    {
      id: "overview",
      title: "The state of your supply base, in one look",
      copy:
        "The overview is built for the question a buyer actually asks on a Monday: is anything about to go wrong. Risk alerts, price moves, documents needing action and the top suppliers' scorecards all sit on one screen, so you are not opening twelve supplier records to find the one that matters.",
      bullets: [
        "KPI tiles cover Active suppliers, Preferred suppliers, High-risk suppliers, Average reliability, Docs to action, Avg on-time delivery, Price alerts, Unresolved credits and Price moves detected",
        "“Top suppliers” scores Overall, Reliability, Price stability, Delivery and Compliance side by side",
        "Supplier opportunities carry a Buy now, Negotiate, Review or Watch badge with a link into the supplier record",
        "A mobile snapshot strip shows the widgets the companion app surfaces — risk alerts, missing documents, credits owed and rebates outstanding",
      ],
      screenshot: {
        src: "/screenshots/modules/supplysync-overview.png",
        alt: "SupplySync overview with supplier KPIs, risk alerts, detected price changes and a top suppliers scorecard table.",
        label: "app.vyso.co.za/supplysync",
      },
    },
    {
      id: "directory",
      title: "A directory you can actually filter",
      copy:
        "The supplier list carries the scorecard in the row, so triage happens without opening anything. Filter by category, status, risk level, compliance state or preferred-only, then compare up to three suppliers side by side when the choice is genuinely close.",
      bullets: [
        "Columns run Supplier, Category, Main contact, Status, Overall, Reliability, Price stability, Delivery, Compliance and Last order",
        "Filters cover category, status (Preferred / Active / On review), risk level, compliance state and preferred-only, with sorting by reliability, last order, risk or overall score",
        "The compare drawer puts up to three suppliers against each other on every metric plus price position and last issue",
        "A supplier profile chains Supplier → Contacts → Documents → Performance → Pricing → Risk, with the Doc-U documents filed against them listed",
      ],
      screenshot: {
        src: "/screenshots/modules/supplysync-list.png",
        alt: "SupplySync supplier directory listing suppliers with category, contact, status and scorecard columns.",
        label: "app.vyso.co.za/supplysync/list",
      },
    },
    {
      id: "performance",
      title: "Measured performance, kept separate from the model",
      copy:
        "Most supplier scorecards are a model dressed up as a fact. SupplySync splits them: a “Measured” section counts only what has genuinely been logged in the relationship record, and the wider scorecard view is badged Illustrative. Suppliers with nothing logged are left out rather than shown as perfect.",
      bullets: [
        "The measured table counts Events, Late, Delivery issues, Quality, Compliance, Issues / 30d, Last issue and Last contact per supplier",
        "Scorecards score Overall, Reliability, Quality, Delivery, Price stability, Responsiveness and Compliance with a trend sparkline",
        "Trend charts are captioned as shaped by live supplier data rather than presented as a measured series",
        "Highlights call out Best overall, Most improved, Most at risk, Most reliable and Most price-stable",
      ],
      screenshot: {
        src: "/screenshots/modules/supplysync-performance.png",
        alt: "SupplySync performance screen with measured supplier events and illustrative scorecards side by side.",
        label: "app.vyso.co.za/supplysync/performance",
      },
    },
    {
      id: "credits",
      title: "The money the supplier is still holding",
      copy:
        "Short-ships, quality rejects and price errors usually live in a WhatsApp thread and then nowhere. The credit tracker turns each one into a claim with an age on it, chased through to credited or written off — and rebate agreements get the same treatment, tracked as expected against actually received.",
      bullets: [
        "Credit rows carry Supplier, Issue, What happened, Claimed, Credited, Status, Age and Chased by, moving through claimed → acknowledged → credited or written off",
        "KPIs cover Unresolved credits, Oldest unresolved, Recovered, Recovery rate, Rebates outstanding and Rebates received",
        "Rebate agreements support percentage-of-spend or flat basis, with a qualifying threshold, period and expected amount",
        "Each rebate shows received against expected as a progress bar, with individual receipts recorded against it",
      ],
      screenshot: {
        src: "/screenshots/modules/supplysync-credits.png",
        alt: "SupplySync credits and rebates screen showing the credit dispute tracker and rebate agreement progress.",
        label: "app.vyso.co.za/supplysync/credits",
      },
    },
    {
      id: "risk",
      title: "Compliance documents that chase themselves",
      copy:
        "Tax clearances, insurance, BEE certificates and food-safety documents expire quietly and become urgent at the worst moment. The document worklist ranks them by urgency and, when you press Request, writes a real document-request event onto that supplier's timeline with a follow-up due in seven days — rather than leaving the chase in someone's head.",
      bullets: [
        "Documents are badged Missing, Expired, Expires soon or Renewal due, with the expiry date and days remaining",
        "The risk register lists Supplier, Risk type, Severity, Description, Suggested action, Owner, Status and Due date, moving through start, resolve or ignore",
        "KPIs cover High-risk suppliers, Missing documents, Expiring soon, Late deliveries, Quality issues and Price volatility alerts",
        "“Request” logs the chase on the record; nothing depends on remembering that you sent an email",
      ],
      screenshot: {
        src: "/screenshots/modules/supplysync-risk.png",
        alt: "SupplySync risk and compliance screen with a document expiry worklist and a supplier risk register.",
        label: "app.vyso.co.za/supplysync/risk",
      },
    },
    {
      id: "history",
      title: "Every conversation, with the follow-up tracked",
      copy:
        "Supplier relationships live in call histories and message threads that leave with the person who had them. Relationship history logs each touchpoint against the supplier — channel, summary, contact, owner — and turns the follow-up into something with a due date rather than an intention.",
      bullets: [
        "The communication log runs Date, Supplier, Contact, Channel, Summary, Follow-up and Owner",
        "Channels cover call, WhatsApp, email, meeting, price update, document request, complaint and delivery issue",
        "Follow-ups are colour-coded overdue, due today or due later, and closed off with “Mark done”",
        "A notes board keeps the latest notes per supplier so context survives a staff change",
      ],
      screenshot: {
        src: "/screenshots/modules/supplysync-history.png",
        alt: "SupplySync relationship history showing the communication log, notes board and outstanding follow-ups.",
        label: "app.vyso.co.za/supplysync/history",
      },
    },
  ],
  workflow: [
    {
      title: "Let the documents build the record",
      copy:
        "Every invoice and price list Doc-U reads updates that supplier's profile, spend rollup and price history. The supply base builds itself from paperwork you were handling anyway.",
    },
    {
      title: "Check the price moves first",
      copy:
        "Detected increases carry their annualised impact, so a three percent line is either fine or a conversation — and you know which before you have it.",
    },
    {
      title: "Chase what is owed to you",
      copy:
        "Log the short-ship or quality reject as it happens, then work the credit ledger by age. Rebates get tracked as expected against received rather than trusted.",
    },
    {
      title: "Clear the compliance worklist",
      copy:
        "Request the expiring certificate from the worklist. The request is logged on the supplier's timeline with a seven-day follow-up attached.",
    },
    {
      title: "Buy in ProcurePulse",
      copy:
        "SupplySync tells you who to buy from and why; the purchase order itself is raised in ProcurePulse. The two are deliberately not the same screen.",
    },
  ],
  worksWith: [
    {
      slug: "doc-u",
      reason:
        "Every invoice and price list Doc-U extracts writes into the supplier's SupplySync profile, timeline and price history automatically.",
    },
    {
      slug: "procurepulse",
      reason:
        "SupplySync recommends and compares; the buying itself happens in ProcurePulse, which the module links you to rather than duplicating.",
    },
    {
      slug: "insightgen",
      reason:
        "InsightGen reads open supplier risks for its daily brief and carries rules for a supplier price jump and an open high-severity supplier risk.",
    },
    {
      slug: "orderflow",
      reason:
        "Suppliers share the same canonical record the documents, stock and order modules use, so a supplier is one entity across the platform.",
    },
  ],
  industryFit: [
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "Many suppliers on similar lines, where price stability and reliability decide the margin more than the headline price does.",
    },
    {
      href: "/industries/food-suppliers",
      name: "Food suppliers",
      reason:
        "Food-safety, BEE and tax-clearance documents that expire on their own schedule and need chasing before they lapse.",
    },
    {
      href: "/industries/hospitality",
      name: "Hospitality",
      reason:
        "Credits and rebates that quietly go unclaimed across a long tail of suppliers nobody owns end to end.",
    },
  ],
  faqs: [
    {
      question: "Can we place orders with suppliers from SupplySync?",
      answer:
        "No, deliberately. SupplySync surfaces pricing, scores performance and recommends who to buy from; the purchase order itself is raised in ProcurePulse. The module links you there rather than keeping a second buying workflow.",
    },
    {
      question: "Do we have to fill in supplier scorecards by hand?",
      answer:
        "No. There are two tracks: a scorecard model badged as illustrative, and a separate measured-performance section that counts only what has genuinely been logged — calls, deliveries, quality issues. Suppliers with nothing logged are left out rather than shown as perfect.",
    },
    {
      question: "How does it know a supplier's price changed?",
      answer:
        "It reads the invoices and price lists Doc-U has already extracted, compares each item against its own history and the market average, and flags material moves with a severity and an annualised rand impact.",
    },
    {
      question: "Can it track credits we're owed and rebate agreements per supplier?",
      answer:
        "Yes. Credits run claimed → acknowledged → credited or written off with an age on each claim, and rebate agreements — percentage-of-spend or flat — track expected against received with individual receipts recorded.",
    },
    {
      question: "Does it chase expiring compliance documents?",
      answer:
        "It gives you a prioritised worklist of missing, expiring and expired documents, and pressing Request writes a real document-request event onto that supplier's timeline with a seven-day follow-up — so the chase is on the record, not in someone's memory.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/procurement-automation"],
  relatedIndustryHrefs: ["/industries/wholesale", "/industries/hospitality"],
  appUrlLabel: "app.vyso.co.za/supplysync",
};
