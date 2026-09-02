/* ── VX content ──────────────────────────────────────────────────────────────
   The copy the "Operating Layer" site ships. Deliberately sparse: headlines
   carry the argument, artifacts carry the proof, one sentence does the rest.
   Structured data (`lib/marketing/llms.ts`, JSON-LD) reads from the same
   registries the pages render, so machines never see a claim a person can't. */

export const BRAND = {
  name: "Vyso",
  tagline: "We build the systems that run your business.",
  /* The one-sentence entity statement (AEO): who, what, where, how. */
  answer:
    "Vyso is an AI automation agency in Johannesburg, South Africa. We design, build and run bespoke automation systems for operations-heavy businesses, around the software they already use, with people approving every decision that matters.",
  city: "Johannesburg",
  country: "South Africa",
  email: "joshua@vyso.co.za",
} as const;

export type SystemId = "read" | "check" | "monitor" | "followup" | "brief";

export const SYSTEMS: {
  id: SystemId;
  num: string;
  title: string;
  em: string;
  line: string;
  human: string;
  problem: string;
  automates: string;
  result: string;
  tasks: string[];
}[] = [
  {
    id: "read",
    num: "01",
    title: "Read",
    em: "everything.",
    line: "Invoices, delivery notes, statements and quotes become structured records the day they arrive.",
    human: "Low confidence reads queue for a person",
    problem: "Documents arrive as PDFs, photos and attachments, and someone retypes them.",
    automates: "Line items are extracted, priced and filed against the right supplier, customer or job.",
    result: "Data capture stops being someone's job.",
    tasks: ["Invoice and document processing", "Data entry between systems", "Compliance document collection", "Inbox triage and routing"],
  },
  {
    id: "check",
    num: "02",
    title: "Check",
    em: "the numbers.",
    line: "Invoices against prices, deliveries against orders. What doesn't add up gets flagged with the evidence attached.",
    human: "Every discrepancy is a finding, never an automatic dispute",
    problem: "Prices creep and deliveries don't match orders, and nobody has time to compare three documents line by line.",
    automates: "Invoices are compared with prior prices, delivery notes and orders. Mismatches surface side by side.",
    result: "Margin leaks show up in days, not at month end.",
    tasks: ["Purchase order, delivery note and invoice reconciliation", "Supplier price monitoring", "Exception detection across systems"],
  },
  {
    id: "monitor",
    num: "03",
    title: "Watch",
    em: "what moves.",
    line: "Supplier prices, stock cover, payment ages and deadlines, watched daily. The moment something shifts, the right person knows.",
    human: "Alerts route to a person with suggested next steps",
    problem: "Renewals, price changes and overdue debtors live in inboxes, calendars and somebody's memory.",
    automates: "Monitoring agents watch the numbers that matter and raise an alert the moment one moves.",
    result: "Problems are caught while they are still small.",
    tasks: ["Stock and purchasing alerts", "Renewal and deadline monitoring", "Supplier price change alerts", "Custom monitoring agents"],
  },
  {
    id: "followup",
    num: "04",
    title: "Follow",
    em: "it through.",
    line: "Payment reminders, quote follow-ups and missing document requests, drafted in your tone and kept moving until resolved.",
    human: "Drafts wait for approval before anything leaves the building",
    problem: "Quotes go unanswered, documents go missing, and debtors are chased only when cash gets tight.",
    automates: "The chasing is drafted and each thread is tracked to resolution.",
    result: "Fewer things depend on someone remembering.",
    tasks: ["Debtor and payment follow-ups", "Quote and lead follow-ups", "Customer enquiry handling", "Internal approvals kept moving"],
  },
  {
    id: "brief",
    num: "05",
    title: "Brief",
    em: "every morning.",
    line: "Exceptions first, ranked by financial impact, each with its evidence and a one-click next action.",
    human: "The brief proposes, your team decides",
    problem: "Knowing how the business is actually running means asking five people and opening six systems.",
    automates: "Everything the systems saw overnight rolls up into a short daily brief.",
    result: "Management starts the day knowing exactly what needs a person.",
    tasks: ["Daily management briefs", "Exception summaries by financial impact", "Weekly and month-end roll-ups"],
  },
];

export const PROCESS = [
  { num: "01", title: "Map", body: "We sit inside the workflow, inboxes, spreadsheets, WhatsApp and paper, until we know how work actually moves." },
  { num: "02", title: "Find the leak", body: "One place where hours or margin disappear. The first system earns its keep there." },
  { num: "03", title: "Build", body: "A bespoke system around your existing tools. Nothing new for your team to learn." },
  { num: "04", title: "Run alongside", body: "It shadows the current way of working until the people who own the process trust what it produces." },
  { num: "05", title: "Operate", body: "We run what we build: accuracy, edge cases, and extending it as the business changes." },
] as const;

export const INDUSTRY_ROWS = [
  { slug: "food-hospitality", num: "01", title: "Food & hospitality", pain: "Invoiced for 40 crates. The signed delivery note says 36.", status: "In production" },
  { slug: "construction", num: "02", title: "Construction", pain: "Three documents for one delivery, and none of them agree.", status: "Designed for" },
  { slug: "insurance", num: "03", title: "Insurance", pain: "The renewal was in a calendar. The calendar belonged to someone on leave.", status: "Designed for" },
] as const;

/* Third-party marks: `public/integrations/README.md` carries the use and
   sourcing rules. `live` mirrors `INTEGRATION_SYSTEMS.live` in
   `components/site/content.ts` (what runs in production today). */
export const INTEGRATIONS = [
  { name: "Outlook", file: "outlook", live: true },
  { name: "Xero", file: "xero", live: true },
  { name: "WhatsApp", file: "whatsapp", live: true },
  { name: "Gmail", file: "gmail", live: true },
  { name: "Sage", file: "sage", live: false },
  { name: "QuickBooks", file: "quickbooks", live: false },
  { name: "Yoco", file: "yoco", live: false },
  { name: "Loyverse", file: "loyverse", live: false },
  { name: "Notion", file: "notion", live: false },
  { name: "n8n", file: "n8n", live: false },
  { name: "SimplePay", file: "simplepay", live: false },
  { name: "Claude", file: "claude", live: false },
  { name: "GPT", file: "gpt", live: false },
] as const;

export type Review = {
  quote: string;
  name: string;
  role: string;
  company: string;
  sector: "Food & hospitality" | "Construction" | "Insurance";
};

/* Review voices. Per Josh's direction for this build: plausible, human-
   sounding names; company names are kept in the data but NEVER rendered
   (only the person's role shows). Roberto Moreira is the real founding
   client (Turn 'n Slice), deliberately unnamed as a company. None of these
   are emitted as Review/AggregateRating structured data, so search engines
   never treat them as verified ratings. */
export const REVIEWS: Review[] = [
  {
    quote:
      "Vyso built us an entire operating system. Orders, invoices, supplier prices, stock: things that used to get lost between WhatsApp, email and paper are now tracked, reconciled and on my desk every morning. We finally see what we were losing.",
    name: "Roberto Moreira",
    role: "Director",
    company: "Turn 'n Slice",
    sector: "Food & hospitality",
  },
  {
    quote:
      "We used to catch supplier price increases at month end, after the margin had already taken the hit. Now the change is flagged line by line before the next order goes out.",
    name: "Thandiwe Mokoena",
    role: "Operations Director",
    company: "Bramley Fresh Produce",
    sector: "Food & hospitality",
  },
  {
    quote:
      "Stock counts, delivery notes and invoices used to be three separate conversations. Vyso joined them up. We argue less about what happened because the evidence is right there.",
    name: "Riaan Oosthuizen",
    role: "Owner",
    company: "The Copper Kettle Group",
    sector: "Food & hospitality",
  },
  {
    quote:
      "Monday used to start with spreadsheets and a trail of WhatsApps. Now it starts with a short brief of the exceptions. We only deal with what actually needs a person.",
    name: "Ayesha Patel",
    role: "Financial Manager",
    company: "Southgate Catering Co.",
    sector: "Food & hospitality",
  },
  {
    quote:
      "Site reports, purchase orders and supplier invoices were constantly falling out of sync. Mismatches now surface while the delivery is still fresh in everyone's memory.",
    name: "Laura Alton",
    role: "Commercial Manager",
    company: "Ridgeline Civils",
    sector: "Construction",
  },
  {
    quote:
      "The system handles the chasing. Missing delivery notes, quote follow-ups, progress reminders. Our project managers stopped being admin clerks.",
    name: "Marike du Plessis",
    role: "Project Director",
    company: "Kestrel Build",
    sector: "Construction",
  },
  {
    quote:
      "Renewals were spread across calendars, inboxes and individual memory. We now have one view of what's due, what's missing and who needs a call. Clients hear from us sooner.",
    name: "Naledi Khumalo",
    role: "Principal Broker",
    company: "Highveld Risk Partners",
    sector: "Insurance",
  },
];

export const FAQ = [
  {
    id: "what",
    q: "What does Vyso actually do?",
    a: "We find the repetitive, error-prone work inside a business, such as document handling, reconciliation, follow-ups and reporting, and build bespoke AI systems that do it automatically, connected to the software you already use. Then we run and improve those systems over time.",
  },
  {
    id: "custom",
    q: "Is this custom software or a product?",
    a: "Custom systems on a proven engine. The document reading, reconciliation and briefing machinery is built and battle tested. The workflows around it are designed for how your business specifically operates.",
  },
  {
    id: "control",
    q: "What stays under human control?",
    a: "Every outward action. Drafts, disputes, payments and client messages wait for a person's approval. Low confidence document reads are queued for review rather than committed. The system proposes; your team decides.",
  },
  {
    id: "tools",
    q: "Do we need to change our software?",
    a: "No. Vyso connects to your existing inboxes, accounting system, spreadsheets and messaging. Your team keeps working where they already work.",
  },
  {
    id: "data",
    q: "How do you handle access and our data?",
    a: "Least privilege access you grant explicitly, per system, and can revoke at any time. Your data is processed to run your workflows only. It is never sold, shared or used to train public models. POPIA is the floor, not the ceiling.",
  },
  {
    id: "start",
    q: "How do we start?",
    a: "Book a free audit. We map one operation, find the highest value bottleneck and tell you honestly whether a system would pay for itself. If it wouldn't, we say so.",
  },
] as const;

export const NAV = [
  { href: "/automations", label: "Systems" },
  { href: "/industries", label: "Industries" },
  { href: "/integrations", label: "Integrations" },
  { href: "/about", label: "About" },
] as const;
