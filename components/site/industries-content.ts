/* ── Industry pages content ──────────────────────────────────────────────────
   Three substantial pages (food & hospitality, construction, insurance) — the
   operations Vyso understands well enough to be specific about. Honesty rules:
   food & hospitality is where Vyso's production builds run today; construction
   and insurance are described as the workflows we design for those operations,
   with no invented deployments, customers or results. */

export type IndustryWorkflow = {
  title: string;
  problem: string;
  flow: string[];
  human: string;
};

export type IndustryContent = {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  headlineEm: string;
  lead: string;
  status: string;
  workflows: IndustryWorkflow[];
  example: { label: string; lines: string[] };
  outcomes: string[];
};

export const INDUSTRY_PAGES: IndustryContent[] = [
  {
    slug: "food-hospitality",
    name: "Food & hospitality",
    metaTitle: "AI automation for food & hospitality businesses",
    metaDescription:
      "Vyso automates the paper trail of food and hospitality operations: supplier invoices read line by line, prices watched against history, delivery notes reconciled, debtors chased, and a daily brief for management.",
    eyebrow: "Industries · Food & hospitality",
    headline: "The paper trail of every kitchen and warehouse,",
    headlineEm: "read and reconciled daily.",
    lead: "Food businesses run on documents that never stop: supplier invoices, delivery notes, price lists, statements, credit notes. Vyso's production builds run in this industry today — reading that paper, catching what drifts, and briefing the people who run the operation.",
    status:
      "Our first production automations run in South African food businesses today — this is the operation we know best.",
    workflows: [
      {
        title: "Supplier invoices, captured and priced",
        problem:
          "Invoices arrive as PDFs, photos and email attachments. Someone retypes them, and price creep hides in the line items.",
        flow: [
          "An invoice lands in the inbox",
          "Line items are extracted with confidence scoring",
          "Every price is compared against that supplier's history",
          "Drift is flagged with the six-month trend attached",
        ],
        human: "Low-confidence reads queue for review; nobody's books are written to silently.",
      },
      {
        title: "Deliveries reconciled against billing",
        problem: "Invoiced for 40 crates; the signed delivery note says 36. Caught at month-end, that's margin already gone.",
        flow: [
          "Delivery notes and invoices are matched per supplier and date",
          "Quantity and price mismatches are surfaced with both documents side by side",
          "The exception routes to whoever handles that supplier",
        ],
        human: "Your team decides whether to query, claim or let it go — with evidence in hand.",
      },
      {
        title: "Debtors chased before cash gets tight",
        problem: "Customer accounts age quietly until someone runs a statement and starts phoning.",
        flow: [
          "Payment ages are watched continuously",
          "Reminder drafts are prepared in your tone as accounts cross thresholds",
          "Each thread is tracked until it resolves",
        ],
        human: "Every reminder waits for approval before it leaves the building.",
      },
      {
        title: "The morning brief",
        problem: "Knowing how the operation is actually running means asking five people.",
        flow: [
          "Everything the automations saw overnight rolls up into a short brief",
          "Exceptions rank by financial impact — a price change, a mismatch, two debtors",
          "Each item carries its evidence and a one-click next action",
        ],
        human: "The brief proposes; the operations lead disposes.",
      },
    ],
    example: {
      label: "Illustrative demo data",
      lines: [
        "06:58 — Brief compiled: 3 exceptions from 41 documents processed",
        "① Butternut up 12% at your produce supplier — ≈R58,000/yr at current volumes",
        "② Delivery mismatch: invoiced 40 crates, POD says 36 — claim drafted",
        "③ Two accounts crossed 14 days — polite reminders drafted, awaiting approval",
      ],
    },
    outcomes: [
      "Price increases surface in days, not at month-end",
      "Fewer disputes about what happened — the evidence is attached",
      "Data capture stops being someone's job",
      "Management starts the day with the exceptions, not the paperwork",
    ],
  },
  {
    slug: "construction",
    name: "Construction",
    metaTitle: "AI automation for construction businesses",
    metaDescription:
      "Vyso designs automations for construction operations: purchase orders, delivery notes and supplier invoices reconciled per site, document chasing handled automatically, and commercial teams briefed while details are fresh.",
    eyebrow: "Industries · Construction",
    headline: "Three documents for one delivery —",
    headlineEm: "and none of them agree.",
    lead: "Construction runs on a paper triangle: the purchase order, the delivery note signed on site, and the supplier invoice that follows. When they drift apart, the difference lands in the final account. Vyso builds automations that keep the triangle honest, per site, while the details are still fresh.",
    status:
      "These are the workflows we design for construction operations — scoped around your sites, suppliers and document flow during the mapping phase.",
    workflows: [
      {
        title: "PO → delivery → invoice, reconciled per site",
        problem:
          "Site reports, purchase orders and supplier invoices fall out of sync, and mismatches surface as end-of-month surprises.",
        flow: [
          "Supplier documents are read and filed against the right site and order",
          "Quantities and rates are checked PO-to-POD-to-invoice",
          "Mismatches surface with all three documents side by side",
        ],
        human: "Your commercial team follows up while the delivery is still fresh in everyone's memory.",
      },
      {
        title: "The chasing, handled",
        problem: "Missing delivery notes, unsigned variations, unanswered quotes — project managers become admin clerks.",
        flow: [
          "Missing-document requests are drafted and tracked per supplier and site",
          "Quote follow-ups keep moving until answered",
          "Progress reminders go to the right person, not a group chat",
        ],
        human: "Drafts wait for approval; escalation paths are yours to define.",
      },
      {
        title: "Cost signals per project",
        problem: "Material price drift across suppliers is invisible until the QS reprices.",
        flow: [
          "Invoice prices build a per-supplier, per-material memory",
          "Drift beyond your threshold raises an alert with the trend attached",
          "A weekly roll-up shows each project's exceptions",
        ],
        human: "Procurement decides where to push back or re-source.",
      },
    ],
    example: {
      label: "Illustrative demo data",
      lines: [
        "07:02 — Site brief: 2 exceptions across 3 active sites",
        "① Rebar invoice 8.4% above PO rate — PO, POD and invoice attached",
        "② Delivery note missing for Tuesday's ready-mix — request drafted to supplier",
      ],
    },
    outcomes: [
      "Mismatches caught before they reach the final account",
      "Project managers spend less time acting as admin clerks",
      "A per-site view of what's outstanding, without a spreadsheet",
      "Fewer month-end surprises for the commercial team",
    ],
  },
  {
    slug: "insurance",
    name: "Insurance",
    metaTitle: "AI automation for insurance brokers",
    metaDescription:
      "Vyso designs automations for insurance brokerages: renewals monitored in one view, outstanding client documents chased automatically, inbox triage, and a daily brief of what needs a person.",
    eyebrow: "Industries · Insurance",
    headline: "Renewals shouldn't depend on",
    headlineEm: "somebody remembering.",
    lead: "A brokerage's risk lives in scattered state: renewals across calendars, outstanding documents across inboxes, follow-ups in individual memory. Vyso builds automations that hold that state in one place — and chase what's missing before it becomes a lapsed policy or a compliance gap.",
    status:
      "These are the workflows we design for brokerages — scoped around your book, your insurers and your compliance requirements during the mapping phase.",
    workflows: [
      {
        title: "Renewals in one view",
        problem: "What's due, what's missing and who needs a follow-up lives in calendars, inboxes and memory.",
        flow: [
          "Renewal dates are monitored continuously across the book",
          "Each approaching renewal shows what information is still outstanding",
          "Client follow-up drafts are prepared ahead of the date",
        ],
        human: "Brokers approve every client message; nothing is sent on autopilot.",
      },
      {
        title: "Document collection, chased",
        problem: "Compliance packs and claim documents arrive in pieces, and someone has to keep asking.",
        flow: [
          "Required documents are tracked per client and matter",
          "Polite chasing drafts go out as items stay outstanding",
          "Arriving documents are read, filed and ticked off automatically",
        ],
        human: "Sensitive conversations are flagged to a person instead of chased automatically.",
      },
      {
        title: "Inbox triage",
        problem: "Claims, amendments, queries and marketing all land in one inbox, and urgency is invisible.",
        flow: [
          "Incoming mail is classified and routed to the right person",
          "Claims-related mail is flagged with its policy context attached",
          "A daily summary shows what arrived and what's still unanswered",
        ],
        human: "Routing rules are yours; the automation learns from your corrections.",
      },
    ],
    example: {
      label: "Illustrative demo data",
      lines: [
        "07:05 — Book brief: 4 renewals in 30 days, 2 with outstanding information",
        "① Fleet policy renews in 12 days — updated asset register still outstanding, chase drafted",
        "② Claim query from yesterday unanswered — routed to the responsible broker",
      ],
    },
    outcomes: [
      "Clients hear from you sooner",
      "Fewer things depend on someone remembering",
      "One view of the book's outstanding items",
      "Compliance gaps visible before they matter",
    ],
  },
];
