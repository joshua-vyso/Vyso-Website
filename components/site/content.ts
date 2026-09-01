/* ── Agency site content system ──────────────────────────────────────────────
   The copy the redesign ships, in one place (see `.ai/positioning_agency_2026.md`
   for the message hierarchy). Rules carried from the brief: no invented
   metrics, customers or capabilities; integrations described honestly by
   status; testimonials are labelled illustrative placeholders. */

export const CAPABILITY_GROUPS = [
  {
    id: "read",
    title: "Read & organise",
    problem:
      "Invoices, delivery notes, statements and quotes arrive as PDFs, photos and email attachments — and someone retypes them.",
    automates:
      "Vyso reads the documents your business already receives, extracts the line items and files each one against the right supplier, customer or job.",
    human: "Low-confidence reads are queued for a person, never silently committed.",
    result: "Documents become structured records the same day they arrive, without data capture.",
    example:
      "A supplier invoice lands in your inbox → line items are extracted → it's filed against the supplier with every price remembered.",
  },
  {
    id: "check",
    title: "Check & reconcile",
    problem:
      "Prices creep, deliveries don't match orders, and nobody has time to compare three documents line by line.",
    automates:
      "Vyso compares invoices against prior prices, delivery notes and orders, and flags what doesn't add up — with the evidence attached.",
    human: "Every discrepancy is a finding for your team to act on, not an automatic dispute.",
    result: "Margin leaks and billing errors surface in days, not at month-end.",
    example:
      "An invoice bills 40 crates → the signed delivery note says 36 → the difference is flagged with both documents side by side.",
  },
  {
    id: "monitor",
    title: "Monitor & alert",
    problem:
      "Renewals, price changes, stock levels and overdue debtors live in inboxes, calendars and someone's memory.",
    automates:
      "Monitoring agents watch the numbers that matter to you — supplier prices, stock cover, payment ages, deadlines — and raise an alert the moment something moves.",
    human: "Alerts route to the right person with suggested next steps; nothing is sent to a client without sign-off.",
    result: "Problems are caught while they're still small.",
    example:
      "A staple ingredient's price rises at one supplier → your operations lead gets the alert with the six-month trend before the next order goes out.",
  },
  {
    id: "followup",
    title: "Follow up & coordinate",
    problem:
      "Quotes go unanswered, documents go missing, and debtors are chased only when cash gets tight.",
    automates:
      "Vyso drafts the chasing — payment reminders, quote follow-ups, missing-document requests — and keeps each thread moving until it's resolved.",
    human: "Drafts wait for approval before anything leaves the building.",
    result: "Fewer things depend on someone remembering.",
    example:
      "An account goes 14 days overdue → a polite reminder is drafted in your tone → a person approves it → the thread is tracked to payment.",
  },
  {
    id: "brief",
    title: "Brief & report",
    problem:
      "Knowing how the business is actually running means asking five people and opening six systems.",
    automates:
      "Everything the automations see rolls up into a short daily brief: exceptions first, ranked by financial impact, each with its evidence and a next action.",
    human: "The brief proposes; your team disposes. Every action is a one-click approval, not an auto-send.",
    result: "Management starts the day knowing exactly what needs a person.",
    example:
      "07:00 — today's brief: one supplier price change, one delivery mismatch, two debtors to nudge. Everything else handled.",
  },
] as const;

export const PROCESS_STEPS = [
  {
    title: "Map the operation",
    body: "We sit inside your workflow — the inboxes, spreadsheets, WhatsApp threads and paper — until we understand how work actually moves.",
  },
  {
    title: "Find the highest-value bottleneck",
    body: "One place where hours leak or problems hide. That's where the first automation earns its keep.",
  },
  {
    title: "Build the workflow",
    body: "A custom automation around your existing tools — not new software your team has to learn.",
  },
  {
    title: "Test with the team",
    body: "It runs alongside the current way of working until the people who own the process trust what it produces.",
  },
  {
    title: "Run, monitor, improve",
    body: "We operate what we build: watching accuracy, handling edge cases, and extending it as your operation changes.",
  },
] as const;

/* Integration honesty: statuses reflect what the platform actually runs today
   (Xero sync, inbound email via Resend + Microsoft Graph/Outlook, WhatsApp).
   Everything else is "commonly connect" language, per the brief. */
export const INTEGRATION_WORKFLOWS = [
  {
    id: "invoice-lane",
    title: "The invoice lane",
    steps: [
      "An invoice arrives in your inbox",
      "Vyso extracts the line items",
      "Prices are compared with prior invoices",
      "The delivery note is checked against it",
      "An exception goes to the right person on WhatsApp",
    ],
    systems: ["Outlook", "Gmail", "WhatsApp"],
  },
  {
    id: "books-lane",
    title: "The books lane",
    steps: [
      "Approved documents post to your accounting system",
      "Supplier and customer records stay in sync",
      "Month-end starts reconciled instead of ending that way",
    ],
    systems: ["Xero", "Sage", "QuickBooks"],
  },
  {
    id: "ops-lane",
    title: "The operations lane",
    steps: [
      "Stock, price and debtor signals are watched daily",
      "Findings rank by financial impact",
      "The morning brief lands before the day starts",
    ],
    systems: ["Spreadsheets", "Internal systems", "APIs"],
  },
] as const;

export const INTEGRATION_SYSTEMS = {
  live: ["Microsoft Outlook", "Xero", "WhatsApp", "Gmail"],
  common: [
    "Google Workspace",
    "Microsoft 365",
    "Sage",
    "QuickBooks",
    "Yoco",
    "Loyverse",
    "Notion",
    "n8n",
    "SimplePay",
    "Spreadsheets",
    "Databases",
    "APIs & internal systems",
  ],
} as const;

export const INDUSTRIES = [
  {
    slug: "food-hospitality",
    title: "Food & hospitality",
    teaser:
      "Supplier invoices, delivery notes, price lists and stock — the paper trail of every kitchen and warehouse, read and reconciled daily.",
    pain: "Invoiced for 40 crates. The signed delivery note says 36.",
  },
  {
    slug: "construction",
    title: "Construction",
    teaser:
      "Site reports, purchase orders and supplier invoices that fall out of sync — caught before they become end-of-month surprises.",
    pain: "Three documents for one delivery, and none of them agree.",
  },
  {
    slug: "insurance",
    title: "Insurance",
    teaser:
      "Renewals, outstanding documents and client follow-ups in one view — so nothing depends on somebody remembering.",
    pain: "The renewal was in a calendar. The calendar belonged to someone on leave.",
  },
] as const;

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  sector: string;
};

/* DRAFT PLACEHOLDERS — labelled "Illustrative client voice" wherever rendered.
   Real identities, photographs and written permission must replace these
   before the section can be presented as verified (see launch checklist). */
export const TESTIMONIAL_PLACEHOLDERS: Testimonial[] = [
  {
    quote:
      "We used to catch supplier price increases at month-end, after the margin had already taken the hit. Vyso now flags changes line by line and gives our operations manager something useful before breakfast. It feels like adding a sharp analyst without adding another meeting.",
    name: "[Name]",
    role: "[Role]",
    company: "[Food business]",
    sector: "Food & hospitality",
  },
  {
    quote:
      "Stock counts, delivery notes and invoices used to be three separate conversations. Vyso joined them up. The biggest change isn't only the time saved—our team spends less time arguing about what happened because the evidence is right there.",
    name: "[Name]",
    role: "[Role]",
    company: "[Food business]",
    sector: "Food & hospitality",
  },
  {
    quote:
      "Monday used to start with spreadsheets and a trail of WhatsApps. Now we get a short brief of the exceptions: a late supplier, a price change, or stock that needs attention. We only deal with what actually needs a person.",
    name: "[Name]",
    role: "[Role]",
    company: "[Hospitality business]",
    sector: "Food & hospitality",
  },
  {
    quote:
      "Site reports, purchase orders and supplier invoices were constantly falling out of sync. Vyso surfaces mismatches before they become end-of-month surprises. Our commercial team can follow up while the details are still fresh.",
    name: "[Name]",
    role: "[Role]",
    company: "[Construction business]",
    sector: "Construction",
  },
  {
    quote:
      "The automation handles the chasing—missing documents, quote follow-ups and progress reminders. Our project managers spend less time acting as admin clerks and more time keeping the build moving.",
    name: "[Name]",
    role: "[Role]",
    company: "[Construction business]",
    sector: "Construction",
  },
  {
    quote:
      "Renewals were spread across calendars, inboxes and individual memory. Vyso gives us one view of what's due, what information is missing and who needs a follow-up. Clients hear from us sooner, and fewer things depend on someone remembering.",
    name: "[Name]",
    role: "[Role]",
    company: "[Insurance brokerage]",
    sector: "Insurance",
  },
];

export const HOME_FAQ = [
  {
    id: "what",
    q: "What does an AI automation agency actually do?",
    a: "We find the repetitive, error-prone work inside a business — document handling, reconciliation, follow-ups, reporting — and build AI workflows that do it automatically, connected to the software you already use. Then we run and improve those workflows over time.",
  },
  {
    id: "custom",
    q: "Is this custom software or a product?",
    a: "Custom automation on a proven engine. The document-reading, reconciliation and briefing machinery is built and battle-tested; the workflows around it are designed for how your business specifically operates.",
  },
  {
    id: "control",
    q: "What stays under human control?",
    a: "Every outward action. Drafts, disputes, payments and client messages wait for a person's approval. Low-confidence document reads are queued for review rather than committed. The automation proposes; your team decides.",
  },
  {
    id: "tools",
    q: "Do we need to change our software?",
    a: "No — that's the point. Vyso connects to your existing inboxes, accounting system, spreadsheets and messaging. Your team keeps working where they already work.",
  },
  {
    id: "data",
    q: "How do you handle access and our data?",
    a: "Least-privilege access you grant explicitly, per system, and can revoke at any time. Your data is processed to run your workflows — it is never sold, shared or used to train public models. POPIA applies and we treat it as the floor, not the ceiling.",
  },
  {
    id: "waitlist",
    q: "Why a waitlist?",
    a: "Each build gets senior attention through mapping, build and run-in, so we onboard a small number of businesses at a time. The waitlist keeps that honest. Joining takes a minute and costs nothing.",
  },
] as const;
