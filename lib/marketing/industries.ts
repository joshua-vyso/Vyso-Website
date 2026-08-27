/* ── /industries content ─────────────────────────────────────────────────────
   Trimmed for the 2026 redesign (`.ai/plan_vyso_redesign_2026.md` §7.5).

   Eight verticals become three, on the SAME slugs the live site already ranks
   for: `food-suppliers`, `wholesale`, `hospitality`. `farms`, `restaurants`,
   `catering-companies`, `security-companies` and `insurance-brokers` are gone
   from this registry; their URLs 301 to a kept sibling (plan §6) rather than
   404. `app/sitemap.ts` is Phase 3/4's file, not this phase's — it currently
   hardcodes the five removed URLs as literal strings rather than mapping over
   this registry, so trimming here does not by itself remove them from the
   sitemap. Flagged in `.ai/implementation_redesign_2026_phase2d.md`.

   Every "Finch does X" from the pre-redesign copy is now "Vyso does X" — Finch
   is retired from the public site (plan §2). The three kept verticals are
   rewritten in full: title, description, hero, the finding deck, the gaps, the
   FAQs, the audit script and the internal links. `deck` is reused directly by
   `components/vyso/industries/IndustryDeck.tsx` as the page's `FindingCard`
   demo, so it earns real craft rather than being a formality.

   ── Why the type keeps fields the new pages never render ────────────────────
   `agents`, `modules`, `moduleNote`, `watchIntro`, `cardFinding`, `cardAgents`
   and `experimentalNote` are NOT rendered by the new `app/industries/**`
   pages. They stay on the `Industry` type, populated, because
   `components/finch/industries/*` (`IndustryCards`, `IndustrySections`,
   `FindingDeck`, `industries-jsonld`) still import this registry and are out
   of this phase's scope to edit or delete (plan §10/§12: "when in doubt, leave
   the file"). Nothing routes to them any more once this phase's page rewrite
   ships, so they are dead code, not a public surface — but they still have to
   TYPE-CHECK, which is the only reason these fields exist below. `ModuleSlug`
   is local to this file (checked — nothing outside it imports the type), so
   its members were renamed away from the old module codenames entirely rather
   than carried over, which is what keeps the copy-rule sweep over
   `lib/marketing` clean without touching the orphaned consumer.           */

/* ── Link slugs ───────────────────────────────────────────────────────────────
   `LearnSlug` is unchanged: the 8 live Learn articles, slugs untouched
   (plan §10, `learnDate()` throws on drift). `SolutionSlug` is the plan §5
   list this phase was handed directly — the 3 kept live slugs plus the 5 new
   ones Phase 2c is building in parallel. Some of these 404 until that phase
   lands; that is expected (Phase 0's Footer already established the same
   pattern for the same reason: the page's real shape should be reviewable
   without waiting for every sibling phase to land first).                   */

/** Internal capability slugs for the (dead, type-compat-only) `modules` field.
    Renamed away from the old Finch module codenames — see the header. */
export type ModuleSlug =
  | "order-capture"
  | "price-monitoring"
  | "invoice-matching"
  | "supplier-records"
  | "reporting-alerts";

export type LearnSlug =
  | "why-businesses-lose-money-without-realising-it"
  | "15-signs-your-business-has-operational-chaos"
  | "how-much-time-can-workflow-automation-save"
  | "hidden-cost-of-manual-procurement"
  | "supplier-scorecards-what-to-track-and-why"
  | "why-weekly-reports-are-usually-too-late"
  | "the-real-cost-of-poor-stock-control"
  | "ai-for-small-and-medium-businesses-practical-use-cases";

export type SolutionSlug =
  | "reduce-money-leakage"
  | "procurement-automation"
  | "reporting-automation"
  | "whatsapp-order-automation"
  | "invoice-automation"
  | "spreadsheet-automation"
  | "inventory-automation"
  | "document-processing";

/* ── Shapes ───────────────────────────────────────────────────────────────── */

/** Kept for the audit-roadmap framing (plan §7.1's own Process section: audit,
    diagnose, prioritise, build, improve) — "FROM YOUR AUDIT ROADMAP" already
    says exactly what the new positioning means by it. */
export type AgentStatus = "LIVE" | "ROLLING OUT" | "FROM YOUR AUDIT ROADMAP";

export type IndustryAgent = {
  label: string;
  watches: string;
  status: AgentStatus;
};

/** One card in the finding deck. Three per vertical, all illustrative — the
    figures are worked examples at a plausible operation's volumes, never a
    client's measured result. This is the data `IndustryDeck` renders as
    `FindingCard`s on the live page. */
export type ExampleFinding = {
  agent: string;
  observation: string;
  impact: string;
  evidence: string;
  meta: string;
  actions: readonly string[];
};

export type ModuleRef = { slug: ModuleSlug; role: string };

export type Industry = {
  slug: string;
  name: string;
  shortName: string;
  singular: string;
  tier: "primary" | "experimental";

  title: string;
  description: string;

  eyebrow: string;
  h1Plain: string;
  h1Accent: string;
  lead: string;

  /** Unused by the three kept (all `tier: "primary"`) verticals; kept on the
      type for the orphaned consumer. */
  experimentalNote?: string;

  deck: readonly [ExampleFinding, ExampleFinding, ExampleFinding];

  cardFinding: string;
  cardAgents: readonly string[];

  watchIntro: string;
  agents: readonly IndustryAgent[];

  modules: readonly ModuleRef[];
  moduleNote: string;

  audit: readonly [string, string, string];

  solutions: readonly SolutionSlug[];
  learn: readonly LearnSlug[];
  siblings: readonly string[];

  gaps: readonly { title: string; copy: string }[];

  faqs: readonly { question: string; answer: string }[];
};

/* ── The three kept verticals ────────────────────────────────────────────── */

const foodSuppliers: Industry = {
  slug: "food-suppliers",
  name: "Food distribution and fresh produce operations",
  shortName: "Food distributors and fresh produce",
  singular: "food distributor",
  tier: "primary",

  title: "Food distributor software for South African SMEs",
  description:
    "Vyso automates WhatsApp orders, customer pricing, invoice capture and stock visibility for South African food distributors. Free operations audit.",

  eyebrow: "FOOD DISTRIBUTORS AND FRESH PRODUCE · SOUTH AFRICA",
  h1Plain: "Every order, price list and delivery note.",
  h1Accent: "Read and checked before the truck leaves.",
  lead:
    "Orders arrive as WhatsApp messages, photos and spreadsheets. Prices depend on the customer, and the delivery note rarely gets checked against the invoice before it is paid. Vyso reads all of it and tells you what moved.",

  deck: [
    {
      agent: "ORDER CAPTURE",
      observation:
        "Kloof Fresh Meats asked for 40 boxes of chicken on WhatsApp for Thursday. Stock on hand covers 31.",
      impact: "9 boxes short for Thursday's delivery",
      evidence: "WhatsApp order + stock count",
      meta: "KLOOF FRESH MEATS · THU DELIVERY",
      actions: ["Show the order", "Suggest a supplier", "Dismiss"],
    },
    {
      agent: "PRICE WATCH",
      observation:
        "Your cost on cooking oil is up R38 per 5L since May. The price list you quote from has not moved.",
      impact: "≈ R3,400 a month of margin",
      evidence: "6 supplier invoices",
      meta: "MAY TO AUG · UP 11%",
      actions: ["Show the trend", "Draft a price list update", "Dismiss"],
    },
    {
      agent: "RECON",
      observation:
        "Tuesday's delivery to Kloof Spar was invoiced for 40 crates. The signed delivery note says 36.",
      impact: "≈ R1,840 likely to be short paid",
      evidence: "delivery note + invoice",
      meta: "KLOOF SPAR · PO 4471",
      actions: ["Open both documents", "Raise a credit note", "Dismiss"],
    },
  ],
  cardFinding: "Invoiced 40 crates. The signed delivery note says 36.",
  cardAgents: ["ORDER CAPTURE", "PRICE WATCH", "RECON"],

  watchIntro:
    "What gets built depends on the audit, but for a distributor running WhatsApp orders, customer pricing and daily deliveries, these are the problems that usually pay for themselves first.",
  agents: [
    {
      label: "ORDER CAPTURE",
      watches:
        "Customer orders however they arrive, a WhatsApp photo, an emailed PDF, a spreadsheet, read into one order record instead of retyped.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Every line on every supplier invoice against recent history, so a cost increase reaches your price list rather than your margin.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "What you invoiced against what the signed delivery note says actually left the yard.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      watches: "What is on hand against what has already been promised for tomorrow's route.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DEBTORS",
      watches:
        "Customer accounts drifting past terms, and regulars whose weekly order is quietly shrinking.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "order-capture", role: "Customer order intake and invoicing" },
    { slug: "price-monitoring", role: "Supplier price tracking and margin context" },
    { slug: "invoice-matching", role: "Delivery note and invoice reconciliation" },
    { slug: "supplier-records", role: "Supplier history and performance" },
    { slug: "reporting-alerts", role: "Operational alerts and weekly reporting" },
  ],
  moduleNote:
    "A relevant starting set, not a fixed bundle. The audit decides where to start, and which of your existing tools should simply stay where they are.",

  audit: [
    "We take a week of your customer orders, price lists, delivery notes and supplier invoices, in whatever form they already arrive.",
    "We check what was ordered against what was delivered and invoiced, and compare every purchase price against recent history.",
    "You get the gaps in rand, ranked by return, and the order we would build them in, whether you go ahead or not.",
  ],

  solutions: [
    "whatsapp-order-automation",
    "invoice-automation",
    "procurement-automation",
    "inventory-automation",
    "reduce-money-leakage",
  ],
  learn: [
    "hidden-cost-of-manual-procurement",
    "why-businesses-lose-money-without-realising-it",
    "supplier-scorecards-what-to-track-and-why",
    "the-real-cost-of-poor-stock-control",
  ],
  siblings: ["wholesale", "hospitality"],

  gaps: [
    {
      title: "Orders arrive in every format",
      copy: "Customers send messages, photos, emails and spreadsheets that someone still has to read and recapture by hand.",
    },
    {
      title: "The right price depends on the customer",
      copy: "Contract pricing and exceptions are hard to apply consistently when the lists live in separate files.",
    },
    {
      title: "Documents repeat the same information",
      copy: "An order becomes a delivery note, then an invoice, and the same line items get retyped each time.",
    },
    {
      title: "Wastage is felt, not tracked",
      copy: "Stock that spoils or gets returned shows up in the month end number, with no record of why.",
    },
  ],

  faqs: [
    {
      question: "Can Vyso handle customer specific price lists?",
      answer:
        "Yes. Customer and shared price lists can be used when preparing quotes, orders and invoices, with the commercial rules confirmed during the build. From there, price checks flag what you were charged against what you agreed, and what you charge against your own cost.",
    },
    {
      question: "Can customers keep ordering on WhatsApp?",
      answer:
        "Yes, and most do. Reading a photographed order or a WhatsApp message into a reviewable record is built around how orders already arrive, not a new process your customers have to learn.",
    },
    {
      question: "Does this cover delivery notes and payments?",
      answer:
        "Yes. Delivery notes, credit notes and payments stay connected to the order they belong to, which is what makes it possible to compare an invoice to the delivery note behind it.",
    },
    {
      question: "What does Vyso cost for a food distributor?",
      answer:
        "It depends on the scope. It starts with a free operations audit, and every opportunity that comes out of it is quoted to you directly before anything is built. You get the roadmap either way.",
    },
  ],
};

const wholesale: Industry = {
  slug: "wholesale",
  name: "Wholesale operations",
  shortName: "Wholesalers",
  singular: "wholesaler",
  tier: "primary",

  title: "Wholesale operations software for South African SMEs",
  description:
    "Vyso checks every invoice line against what you agreed and what actually moved, so small losses do not disappear into wholesale volumes. Free audit.",

  eyebrow: "WHOLESALERS · SOUTH AFRICA",
  h1Plain: "Volume hides the small losses.",
  h1Accent: "Vyso counts them.",
  lead:
    "At wholesale volumes, a two rand cost increase and a two crate short delivery both disappear into the month. Vyso checks every line on every invoice against what you agreed and what actually left the truck.",

  deck: [
    {
      agent: "PRICE WATCH",
      observation: "Your cost on 10kg potato pockets moved twice since June, without a notice.",
      impact: "≈ R11,400 a month at current volumes",
      evidence: "12 supplier invoices",
      meta: "2 MOVES · JUN TO AUG",
      actions: ["Draft a supplier email", "Show the trend", "Dismiss"],
    },
    {
      agent: "DELIVERY WATCH",
      observation: "Four drops on Tuesday's route came back without a signature.",
      impact: "≈ R18,000 you cannot prove was delivered",
      evidence: "4 delivery notes",
      meta: "TUESDAY ROUTE",
      actions: ["List the four drops", "Send to the drivers", "Dismiss"],
    },
    {
      agent: "DEBTORS",
      observation: "Your third largest account has quietly halved its weekly order since May.",
      impact: "≈ R31,000 a month of revenue",
      evidence: "order history",
      meta: "DOWN 48% · MAY TO AUG",
      actions: ["Show the order history", "Draft a call list", "Dismiss"],
    },
  ],
  cardFinding: "Potato pockets moved twice since June, without a notice.",
  cardAgents: ["PRICE WATCH", "RECON", "DELIVERY WATCH"],

  watchIntro:
    "For a wholesaler running volume through its own trucks, these are the problems that usually pay for themselves first.",
  agents: [
    {
      label: "ORDER CAPTURE",
      watches:
        "Purchase orders, supplier invoices and delivery notes read into one record. The volume is exactly why nobody has time to key them by hand.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Every line on every supplier invoice against recent history, because at your volumes a small move is a real number.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "What was invoiced against what was received, line by line, instead of a spot check when something feels wrong.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DELIVERY WATCH",
      watches: "Routes against delivery notes, including the drops that come back unsigned.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DEBTORS",
      watches:
        "Accounts drifting past terms, and regulars whose weekly order is quietly getting smaller.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "invoice-matching", role: "Purchase order and invoice capture" },
    { slug: "price-monitoring", role: "Margin and selling price control" },
    { slug: "supplier-records", role: "Supplier records and performance" },
    { slug: "reporting-alerts", role: "Operational reporting across lines" },
  ],
  moduleNote:
    "A relevant starting set, not a fixed bundle. Vyso can sit alongside an existing warehouse system or become the operating record. The audit decides which.",

  audit: [
    "We take a week of purchase orders, supplier invoices, delivery notes and your debtors ageing, at whatever volume they come in.",
    "We check every invoice line against recent history and against what was received, and look at which accounts are drifting.",
    "You get the gaps in rand, ranked by return, and the workflow carrying the most risk, usually purchasing or margin visibility.",
  ],

  solutions: [
    "procurement-automation",
    "invoice-automation",
    "inventory-automation",
    "reduce-money-leakage",
  ],
  learn: [
    "the-real-cost-of-poor-stock-control",
    "supplier-scorecards-what-to-track-and-why",
    "why-businesses-lose-money-without-realising-it",
    "hidden-cost-of-manual-procurement",
  ],
  siblings: ["food-suppliers", "hospitality"],

  gaps: [
    {
      title: "Purchasing reacts to stockouts",
      copy: "Reorder decisions are triggered by a shortage someone notices, rather than a clear view of stock and movement across lines.",
    },
    {
      title: "Inventory movement is hard to trust",
      copy: "What is on the shelf, in transit and on order lives across different systems and sheets, so counts drift from reality.",
    },
    {
      title: "Order processing depends on manual capture",
      copy: "Customer orders arriving by call, email or message still need to be retyped into the system that ships and invoices.",
    },
    {
      title: "Margin is reviewed after the fact",
      copy: "Cost price changes from suppliers reach the selling price late, if at all, so margin erosion is only visible at month end.",
    },
  ],

  faqs: [
    {
      question: "Does Vyso replace our warehouse system?",
      answer:
        "Not necessarily. Vyso can read from an existing stock system or become the operating record for purchasing, orders and reporting. The audit confirms which sources are reliable enough to build on.",
    },
    {
      question: "Can it handle our order volumes?",
      answer:
        "Yes. Repeat customer orders, pricing and invoicing run through a connected workflow rather than a per order manual process, and the shape and volume of that workflow is assessed during the audit.",
    },
    {
      question: "Can we start with purchasing before order processing?",
      answer:
        "Yes, and most do. The audit ranks the opportunities by return, so you start with the workflow carrying the most risk and expand once that value is proven.",
    },
    {
      question: "What does Vyso cost for a wholesaler?",
      answer:
        "It depends on the scope. It starts with a free operations audit, and every opportunity that comes out of it is quoted to you directly before anything is built.",
    },
  ],
};

const hospitality: Industry = {
  slug: "hospitality",
  name: "Hospitality operations",
  shortName: "Hospitality",
  singular: "hospitality operation",
  tier: "primary",

  title: "Hospitality operations software for South African SMEs",
  description:
    "Vyso reads across kitchen, bar and housekeeping purchasing and sends what changed on Monday morning. Free operations audit for SA hospitality.",

  eyebrow: "HOSPITALITY · SOUTH AFRICA",
  h1Plain: "Every department has its own numbers.",
  h1Accent: "You need one picture.",
  lead:
    "Kitchen, bar, housekeeping and procurement each track their own week, and leadership waits for someone to compile it. Vyso reads across all of them and sends what changed.",

  deck: [
    {
      agent: "THE BRIEF",
      observation:
        "Beverage margin fell 2.1 points last week. The bar's cost price moved, the list price did not.",
      impact: "≈ R9,400 on last week's covers",
      evidence: "sales + purchases",
      meta: "BAR · WEEK 31",
      actions: ["Show the drivers", "Send to the manager", "Dismiss"],
    },
    {
      agent: "PRICE WATCH",
      observation: "Housekeeping consumables are up 16% across two suppliers since April.",
      impact: "≈ R4,700 a month",
      evidence: "9 invoices",
      meta: "APR TO AUG · UP 16%",
      actions: ["Show the two suppliers", "Draft a supplier email", "Dismiss"],
    },
    {
      agent: "RECON",
      observation: "Two approved purchase orders have no matching delivery note this month.",
      impact: "≈ R7,300 unaccounted",
      evidence: "2 purchase orders",
      meta: "AUGUST",
      actions: ["Open the two orders", "Ask the department", "Dismiss"],
    },
  ],
  cardFinding: "Beverage margin fell 2.1 points. The list price never moved.",
  cardAgents: ["PRICE WATCH", "RECON", "THE BRIEF"],

  watchIntro:
    "For a property running several departments against one set of numbers, these are the problems that usually pay for themselves first.",
  agents: [
    {
      label: "ORDER CAPTURE",
      watches:
        "Purchase requests, supplier invoices and delivery notes from every department, read into one record rather than four folders.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Supplier prices across food, beverage and consumables, so a double digit move in one department is not something you find in the annual accounts.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "Approved purchase orders against what was actually delivered and invoiced, with a reviewable record instead of a verbal trail.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning: what moved across every department last week, ranked, instead of waiting for a manager to compile it.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "reporting-alerts", role: "Reporting across departments" },
    { slug: "invoice-matching", role: "Purchase order and delivery reconciliation" },
    { slug: "supplier-records", role: "Supplier control and performance history" },
    { slug: "price-monitoring", role: "Cost tracking across food, beverage and consumables" },
  ],
  moduleNote:
    "A relevant starting set, not a fixed bundle. What a group rollout needs depends on how consistently each property already operates, which the audit assesses first.",

  audit: [
    "We take a week of purchase requests, supplier invoices, delivery notes and department numbers from across the property.",
    "We check prices against recent history, approvals against deliveries, and how long it takes a department's numbers to reach you.",
    "You get the gaps in rand, ranked by department, and an honest view of whether a group rollout makes sense yet.",
  ],

  solutions: [
    "reporting-automation",
    "procurement-automation",
    "document-processing",
    "reduce-money-leakage",
  ],
  learn: [
    "why-weekly-reports-are-usually-too-late",
    "15-signs-your-business-has-operational-chaos",
    "why-businesses-lose-money-without-realising-it",
    "hidden-cost-of-manual-procurement",
  ],
  siblings: ["food-suppliers", "wholesale"],

  gaps: [
    {
      title: "Departments run on separate routines",
      copy: "Kitchen, bar, housekeeping and front of house each track their own numbers, making it hard to see how the operation performs as a whole.",
    },
    {
      title: "Procurement approvals happen informally",
      copy: "Purchase requests move through calls, messages and verbal sign off, with little record of who approved what and why.",
    },
    {
      title: "Supplier performance is remembered, not recorded",
      copy: "Which suppliers deliver late, short or over priced tends to live in someone's memory rather than a reviewable history.",
    },
    {
      title: "Leadership waits for the report",
      copy: "Executives see performance once a manager has compiled it, rather than having a live view of the operation underneath them.",
    },
  ],

  faqs: [
    {
      question: "Can Vyso work across several departments in one property?",
      answer:
        "Yes. Procurement, stock, staffing and reporting can connect into one operating record configured around how the property actually runs.",
    },
    {
      question: "Does it support formal approval chains?",
      answer:
        "Yes. Purchase requests and approvals can be routed and recorded as part of the procurement workflow, with the approval structure confirmed during the build.",
    },
    {
      question: "Is this suitable for a multi property group?",
      answer:
        "It can be. Group level visibility depends on how consistently each property currently operates, which the audit assesses before recommending a rollout.",
    },
    {
      question: "What does Vyso cost for a hospitality operation?",
      answer:
        "It depends on the scope. It starts with a free operations audit, and every opportunity that comes out of it is quoted to you directly before anything is built.",
    },
  ],
};

/* ── Registry ─────────────────────────────────────────────────────────────── */

/** Food distribution first, per plan §7.5: the deepest page and the strongest
    proof vertical (Turn 'n Slice). */
export const PRIMARY_INDUSTRY_ORDER = ["food-suppliers", "wholesale", "hospitality"] as const;

/** No experimental verticals in the trimmed set. Kept as an empty tuple, not
    removed, so the orphaned `ExperimentalCards` consumer keeps a valid (empty)
    list to map over rather than an undefined import. */
export const EXPERIMENTAL_INDUSTRY_ORDER = [] as const;

export const INDUSTRY_ORDER: readonly string[] = [
  ...PRIMARY_INDUSTRY_ORDER,
  ...EXPERIMENTAL_INDUSTRY_ORDER,
];

export const INDUSTRIES: Record<string, Industry> = {
  "food-suppliers": foodSuppliers,
  wholesale,
  hospitality,
};

export const INDUSTRY_LIST: readonly Industry[] = INDUSTRY_ORDER.map((slug) => INDUSTRIES[slug]);

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES[slug];
}

/* ── The hub ──────────────────────────────────────────────────────────────── */

export const HUB = {
  title: "Industries: who Vyso builds for in South Africa",
  description:
    "Vyso builds operational systems for South African food distributors, wholesalers and hospitality operations. Free operations audit.",
  eyebrow: "WHO VYSO BUILDS FOR",
  h1Plain: "Built for operations heavy",
  h1Accent: "South African businesses.",
  lead:
    "Vyso does not change per industry. What changes is which problem earns its place first, and in whose vocabulary. These are the operations we understand well enough to be specific about.",
} as const;
