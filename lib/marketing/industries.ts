/* ── /industries content ─────────────────────────────────────────────────────
   Moved out of `app/industries/[slug]/page.tsx` (Phase 3, workstream A), which
   held the whole `INDUSTRIES` object inline — a route module nothing else could
   read without importing a page.

   Server-safe by construction: nothing here imports a `"use client"` module,
   because `industries-jsonld.ts` reads it from a server component. See
   `.ai/implementation_phase1.md` §B deviation 1 for what happens when that rule
   is broken.

   What changed in the move, and why:
   - Vyso → Finch. Vyso is the company (the audit, the invoice); Finch is the
     product doing the watching. Every "Vyso does X" became "Finch does X", and
     the old module-shopping framing ("configure the combination the workflow
     earns") became agent framing: what Finch watches in *this* business.
   - `deck` added per vertical: three `ExampleFinding`s for the finding deck,
     the signature visual of this route. Always rendered under an
     `ILLUSTRATIVE EXAMPLES` caption — the rand figures are worked examples at a
     plausible operation's volumes, not measurements from a client.
   - `agents` added: 4–6 example agents in the vertical's own vocabulary, each
     with the honesty status `.ai/vyso_v2.md` §4 assigns it. Doc-U is the only
     `LIVE` one; Price Watch is `ROLLING OUT`; everything else is
     `FROM YOUR AUDIT ROADMAP`.
   - `modules`, `learn`, `solutions` added, and typed as **literal-union slugs**
     rather than free-text hrefs. Phase 2 found nine dead Learn links in
     `lib/marketing/solutions.ts` that had been live on the published site (see
     `.ai/implementation_phase2.md` §D content decision 2); an href written as a
     string can rot silently, a slug in a union cannot — a wrong one is a
     compile error. The components resolve the label and the URL from the
     registries (`learn-articles.ts`, `modules.ts`, `solutions.ts`), so the link
     text cannot drift from the page it points at either.
   - The old `/platform/vyso-for-smes` breadcrumb and "Explore every Vyso
     module" link are gone: that URL 308s to `/` (see `next.config.ts`). Module
     links now point at `/platform/modules/<slug>`, which is where the module
     pages actually live.
   - `outcomes` dropped. The four "what better looks like" bullets per vertical
     restated the gaps in the positive and said nothing the agent rows don't say
     more concretely; the gaps themselves are kept verbatim in `gaps`.
   - Two experimental verticals added (`security-companies`,
     `insurance-brokers`) per `.ai/vyso_v2.md` §2.2. They carry an
     `experimentalNote` stating plainly that Finch was built for food and
     produce operations and that no audit has been run in one of these
     businesses yet. They are linked from the industries hub and the sitemap and
     nowhere else — not the nav, not the homepage, not the footer.             */

/* ── Link slugs ───────────────────────────────────────────────────────────────
   The union members are the real routes, checked against the registries on
   2026-08-15: `MARKETING_MODULE_SLUGS` (10), `LEARN_ARTICLES` (8) and
   `SOLUTION_ORDER` (4). Adding a page there and forgetting it here is harmless;
   naming a page here that does not exist there is a type error.               */

export type ModuleSlug =
  | "doc-u"
  | "orderflow"
  | "pricepilot"
  | "procurepulse"
  | "supplysync"
  | "wastewatch"
  | "planwise"
  | "shiftboard"
  | "serviceden"
  | "insightgen";

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
  | "operations-dashboard";

/* ── Shapes ───────────────────────────────────────────────────────────────── */

/** Honesty chips, per `.ai/vyso_v2.md` §4. Doc-U is the only `LIVE` one. */
export type AgentStatus = "LIVE" | "ROLLING OUT" | "FROM YOUR AUDIT ROADMAP";

export type IndustryAgent = {
  /** Mono label, matching the roster on `/#agents`. */
  label:   string;
  /** What it watches *in this business* — not its generic one-liner. */
  watches: string;
  status:  AgentStatus;
};

/** One card in the finding deck. Three per vertical, all `ILLUSTRATIVE`. */
export type ExampleFinding = {
  agent:       string;
  observation: string;
  impact:      string;
  evidence:    string;
  meta:        string;
  actions:     readonly string[];
};

export type ModuleRef = { slug: ModuleSlug; role: string };

export type Industry = {
  slug:      string;
  /** Full descriptive name, for schema and the `<title>`-adjacent copy. */
  name:      string;
  /** Short label for cards, breadcrumbs and chips. */
  shortName: string;
  /** Mid-sentence noun ("How the audit runs for a food supplier"). */
  singular:  string;
  tier:      "primary" | "experimental";

  /* Metadata. `title` ≤ 53 chars — the root layout appends " | Vyso". */
  title:       string;
  description: string;

  /* Hero. */
  eyebrow:   string;
  h1Plain:   string;
  h1Accent:  string;
  /** The AEO answer: ≤ 45 words, answering the page's question directly. */
  lead:      string;

  /** Only on the two experimental verticals. Rendered as its own band. */
  experimentalNote?: string;

  /** The signature visual: three fanned finding cards. */
  deck: readonly [ExampleFinding, ExampleFinding, ExampleFinding];

  /** The hub card's one-line example finding, in the vertical's words. */
  cardFinding: string;
  /** The hub card's agent chips — a subset of `agents`. */
  cardAgents:  readonly string[];

  /* "What Finch watches in a <vertical>". */
  watchIntro: string;
  agents:     readonly IndustryAgent[];

  /* "Under the hood". */
  modules:    readonly ModuleRef[];
  moduleNote: string;

  /** "How the audit runs for a <vertical>" — three sentences, no more. */
  audit: readonly [string, string, string];

  /* Internal links (§7.5: ≥ 2 solutions, a Learn cluster, ≥ 3 siblings). */
  solutions:  readonly SolutionSlug[];
  learn:      readonly LearnSlug[];
  siblings:   readonly string[];

  /** The operating gaps, kept from the pre-Finch pages (grounded, reframed). */
  gaps: readonly { title: string; copy: string }[];

  faqs: readonly { question: string; answer: string }[];
};

/* ── The six primary verticals ───────────────────────────────────────────── */

const foodSuppliers: Industry = {
  slug: "food-suppliers",
  name: "Food supplier operations",
  shortName: "Food suppliers",
  singular: "food supplier",
  tier: "primary",

  title: "Food supplier operations software — South Africa",
  description:
    "Finch reads every order, price list, delivery note and invoice a South African food supplier produces, and flags what moved. R6,000 per location/month.",

  eyebrow: "FOOD SUPPLIERS · SOUTH AFRICA",
  h1Plain: "Every invoice, delivery note and price list —",
  h1Accent: "read before you've had coffee.",
  lead:
    "Orders arrive as photos, PDFs and spreadsheets; prices depend on the customer; the delivery note and the invoice rarely get held up against each other. Finch reads all of it, checks each line against what was agreed, and tells you what moved.",

  deck: [
    {
      agent: "RECON",
      observation:
        "Tuesday's drop to Kloof Spar was invoiced for 40 crates. The signed delivery note says 36.",
      impact: "≈ R1,840 they will short-pay",
      evidence: "delivery note + invoice",
      meta: "KLOOF SPAR · PO 4471 · 04 AUG",
      actions: ["Open both documents", "Raise a credit note", "Dismiss"],
    },
    {
      agent: "PRICE WATCH",
      observation:
        "Your cost on cooking oil is up R38 per 5L since May. The list you quote from hasn't moved.",
      impact: "≈ R3,400/mo of margin",
      evidence: "6 invoices",
      meta: "VERMAAK · +11% · MAY–AUG",
      actions: ["Show affected customers", "Draft a price-list update", "Dismiss"],
    },
    {
      agent: "DEBTORS",
      observation: "Three restaurant accounts have slipped past 60 days since June.",
      impact: "≈ R48,000 outstanding",
      evidence: "debtors ageing",
      meta: "3 ACCOUNTS · 60+ DAYS",
      actions: ["Draft the follow-ups", "Show the ageing", "Dismiss"],
    },
  ],
  cardFinding: "Invoiced for 40 crates. The signed delivery note says 36.",
  cardAgents: ["DOC-U", "PRICE WATCH", "RECON", "DEBTORS"],

  watchIntro:
    "Agents are set per business in the audit. For a supplier running orders, deliveries and customer pricing, these are the ones that usually earn their place first.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Customer orders however they arrive — a WhatsApp photo, an emailed PDF, a spreadsheet — read into one order record instead of retyped.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Every line on every supplier invoice against six months of the same supplier's prices, so a cost increase reaches your price list rather than your margin.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "What you invoiced against what the signed delivery note says actually left the yard — before the customer's accounts department finds it first.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DEBTORS",
      watches:
        "Customer accounts drifting past their terms, and regulars whose weekly order is quietly getting smaller.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      watches:
        "What is on hand against what has already been promised for tomorrow morning's route.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning on WhatsApp: the three things that moved against you last week, ranked, with the document behind each one.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "orderflow", role: "Customer order-to-cash workflow" },
    { slug: "doc-u", role: "Customer-order and supplier-document intake" },
    { slug: "pricepilot", role: "Customer pricing and margin context" },
    { slug: "supplysync", role: "Supplier records and relationship history" },
    { slug: "procurepulse", role: "Stock and purchasing intelligence" },
    { slug: "insightgen", role: "Operational reporting and alerts" },
  ],
  moduleNote:
    "A relevant module set, not a compulsory bundle. The audit decides where to start and which of your existing tools should simply stay where they are.",

  audit: [
    "We take a week of your customer orders, price lists, delivery notes and supplier invoices — in whatever form they already arrive.",
    "We reconcile what was ordered against what was delivered and invoiced, and check every purchase price against the previous three months.",
    "You get the leaks in rand, ranked, and the order the agents would be switched on in — whether you sign or not.",
  ],

  solutions: ["procurement-automation", "reduce-money-leakage", "operations-dashboard"],
  learn: [
    "hidden-cost-of-manual-procurement",
    "why-businesses-lose-money-without-realising-it",
    "supplier-scorecards-what-to-track-and-why",
    "the-real-cost-of-poor-stock-control",
  ],
  siblings: ["wholesale", "farms", "restaurants"],

  gaps: [
    {
      title: "Orders arrive in every format",
      copy: "Customers send messages, emails, spreadsheets, PDFs and photos that someone still needs to interpret and recapture.",
    },
    {
      title: "The right price depends on the customer",
      copy: "Contract pricing, rebates and exceptions are hard to apply consistently when lists live in separate files.",
    },
    {
      title: "Documents repeat the same information",
      copy: "A quote becomes an order, delivery note and invoice, but teams retype the customer and line items each time.",
    },
    {
      title: "Outstanding money is checked after the fact",
      copy: "The operational team can see the order, while payment status sits somewhere else and follow-up loses context.",
    },
  ],

  faqs: [
    {
      question: "Can Finch handle customer-specific price lists?",
      answer:
        "Yes. Customer and shared price lists can be used when preparing quotes, orders and invoices, with the commercial rules confirmed during implementation. Price Watch then checks what you are charged against what you agreed, and what you charge against your own cost.",
    },
    {
      question: "Can customers keep ordering on WhatsApp or by email?",
      answer:
        "Yes, and most do. Document intelligence — reading a photographed order or an emailed PDF into a reviewable record — is the part of Finch that is live today. Onboarding maps how orders actually arrive rather than forcing customers into a new process.",
    },
    {
      question: "Does this cover delivery notes and payment tracking?",
      answer:
        "Yes. Delivery notes, credit notes and received payments stay connected to the originating customer and commercial documents, which is what lets an agent compare an invoice to the delivery note it belongs to.",
    },
    {
      question: "What does Finch cost for a food supplier?",
      answer:
        "R6,000 per location per month, everything included. It starts with the one-week Operations Audit at R2,000, credited to your first month — you get the written leak report either way.",
    },
  ],
};

const farms: Industry = {
  slug: "farms",
  name: "Farm and producer operations",
  shortName: "Farms & producers",
  singular: "farm or producer",
  tier: "primary",

  title: "Farm operations software — South Africa",
  description:
    "Finch reads the orders, dispatch notes, input invoices and debtors of a South African farm or producer, and flags what moved. R6,000 per location/month.",

  eyebrow: "FARMS & PRODUCERS · SOUTH AFRICA",
  h1Plain: "Variable supply, repeat buyers —",
  h1Accent: "one record that keeps up with both.",
  lead:
    "What is available changes daily. What a buyer ordered, which price applies, what was actually dispatched and what is still unpaid should not have to be remembered. Finch reads the documents and tells you what moved.",

  deck: [
    {
      agent: "PRICE WATCH",
      observation: "Diesel is up 9% at both depots since May.",
      impact: "≈ R6,100/mo across deliveries",
      evidence: "8 invoices",
      meta: "2 DEPOTS · +9% · MAY–AUG",
      actions: ["Show the trend", "Send to my bookkeeper", "Dismiss"],
    },
    {
      agent: "RECON",
      observation:
        "Last week's packhouse dispatch to Fruit & Veg City was 18 crates short of the invoice.",
      impact: "≈ R2,700 that will be short-paid",
      evidence: "dispatch note + invoice",
      meta: "FVC · WK 31 · −18 CRATES",
      actions: ["Open both documents", "Raise a credit note", "Dismiss"],
    },
    {
      agent: "DEBTORS",
      observation: "Two wholesale buyers have stretched from 30 days to 52 since March.",
      impact: "≈ R94,000 outstanding",
      evidence: "debtors ageing",
      meta: "2 BUYERS · 30 → 52 DAYS",
      actions: ["Draft the follow-ups", "Show the ageing", "Dismiss"],
    },
  ],
  cardFinding: "Diesel up 9% at both depots since May.",
  cardAgents: ["DOC-U", "PRICE WATCH", "RECON", "DEBTORS"],

  watchIntro:
    "Agents are set per business in the audit. For a producer selling to repeat wholesale buyers, these are the ones that usually earn their place first.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Buyer orders, dispatch notes and input invoices — including the ones photographed in the packhouse — read into one record.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Input costs line by line: diesel, fertiliser, packaging, crates. A 9% move is visible on the second invoice, not in the annual accounts.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "What was dispatched against what was invoiced, so a short load is caught before the buyer's remittance is the thing that tells you.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      watches:
        "Available grades and quantities against what has already been committed to buyers this week.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DEBTORS",
      watches:
        "Repeat buyers stretching their terms, and accounts whose volumes are quietly thinning.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning on WhatsApp: the three things that moved against you last week, with the invoice or dispatch note attached.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "orderflow", role: "Repeat customer orders and invoicing" },
    { slug: "procurepulse", role: "Availability and stock intelligence" },
    { slug: "pricepilot", role: "Buyer pricing and margin context" },
    { slug: "doc-u", role: "Order and document extraction" },
    { slug: "supplysync", role: "Input supplier records and history" },
    { slug: "insightgen", role: "Operational reporting and alerts" },
  ],
  moduleNote:
    "A relevant module set, not a compulsory bundle. Finch is not agronomy, crop-planning or precision-agriculture software — it watches the commercial side of the operation.",

  audit: [
    "We take a week of buyer orders, dispatch notes, input invoices and your debtors ageing, in whatever form they exist today.",
    "We check dispatched against invoiced, input costs against the previous three months, and how long each buyer is actually taking to pay.",
    "You get the leaks in rand, ranked, and one practical starting workflow — not an assumption that the whole operation is already standardised.",
  ],

  solutions: ["reduce-money-leakage", "operations-dashboard", "procurement-automation"],
  learn: [
    "why-businesses-lose-money-without-realising-it",
    "the-real-cost-of-poor-stock-control",
    "hidden-cost-of-manual-procurement",
    "why-weekly-reports-are-usually-too-late",
  ],
  siblings: ["food-suppliers", "wholesale", "catering-companies"],

  gaps: [
    {
      title: "Availability changes faster than the spreadsheet",
      copy: "Products, grades and quantities move while customer orders are still being consolidated through calls and messages.",
    },
    {
      title: "Repeat buyers have different terms",
      copy: "Customer prices, rebates, delivery arrangements and payment terms are difficult to apply from memory.",
    },
    {
      title: "Order and delivery records separate",
      copy: "The team needs to know not only what was requested, but what was confirmed, packed, delivered and invoiced.",
    },
    {
      title: "Commercial visibility arrives late",
      copy: "Outstanding invoices and recent order activity are harder to act on when they live outside the daily workflow.",
    },
  ],

  faqs: [
    {
      question: "Is Finch farm-management or agronomy software?",
      answer:
        "No. Finch watches the operational and commercial side — buyers, orders, dispatch, input costs, documents and payments. It is not positioned as agronomy, crop-planning or precision-agriculture software, and the audit will say so if that is what you actually need.",
    },
    {
      question: "Can Finch support repeat wholesale buyers?",
      answer:
        "Yes. Repeat buyer records, price lists, orders, invoices, dispatch notes and payments are the core of the commercial workflow, and the agents read across all of them.",
    },
    {
      question: "Can a producer start before every process is standardised?",
      answer:
        "Yes. The one-week audit maps the current reality first and defines one practical starting point, rather than assuming the whole operation is already tidy enough to automate.",
    },
    {
      question: "What does Finch cost for a farm?",
      answer:
        "R6,000 per location per month, everything included. It starts with the one-week Operations Audit at R2,000, credited to your first month — you get the written leak report either way.",
    },
  ],
};

const restaurants: Industry = {
  slug: "restaurants",
  name: "Restaurant operations",
  shortName: "Restaurants",
  singular: "restaurant",
  tier: "primary",

  title: "Restaurant operations software — South Africa",
  description:
    "Finch reads a South African restaurant's invoices, delivery notes and stock counts and flags what moved this week, in rand. R6,000 per location/month.",

  eyebrow: "RESTAURANTS · SOUTH AFRICA",
  h1Plain: "Know what the kitchen cost you before service —",
  h1Accent: "not at month end.",
  lead:
    "Ingredient costs move faster than menu prices, and waste only becomes visible in the month-end number. Finch reads your supplier invoices, delivery notes and stock counts, and tells you what moved this week, in rand.",

  deck: [
    {
      agent: "PRICE WATCH",
      observation: "Cooking oil is up R38 per 5L since May. Nothing on the menu has moved.",
      impact: "≈ R2,900/mo on current covers",
      evidence: "6 invoices",
      meta: "VERMAAK · +11% · MAY–AUG",
      actions: ["Show affected dishes", "Draft supplier email", "Dismiss"],
    },
    {
      agent: "STOCK SENSE",
      observation: "Fresh cream runs out Thursday lunch. The next delivery is Friday morning.",
      impact: "≈ R4,800 of Thursday's desserts at risk",
      evidence: "stock + open orders",
      meta: "CREAM · 1 DAY SHORT · PO 2214",
      actions: ["Bring the order forward", "Show cover days", "Dismiss"],
    },
    {
      agent: "RECON",
      observation: "Friday's produce delivery was invoiced in full. Two crates were signed short.",
      impact: "≈ R980 over-billed",
      evidence: "delivery note + invoice",
      meta: "FRI 01 AUG · −2 CRATES",
      actions: ["Open both documents", "Query the supplier", "Dismiss"],
    },
  ],
  cardFinding: "Cooking oil up R38 per 5L. Nothing on the menu has moved.",
  cardAgents: ["DOC-U", "PRICE WATCH", "STOCK SENSE"],

  watchIntro:
    "Agents are set per business in the audit. For a kitchen buying daily and pricing a menu monthly, these are the ones that usually earn their place first.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Supplier invoices and delivery notes — including the photographed ones that land in the manager's WhatsApp at 6am — read into a reviewable record.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Every ingredient line against six months of the same supplier's prices, so a creeping cost reaches you before it reaches the plate cost.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "What was invoiced against what was actually signed for at the back door on a busy Friday.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      watches:
        "What is on hand against the orders already on their way, so a shortage is visible the day before service, not during it.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning on WhatsApp: the three things that moved against you last week — usually a price, a variance and a short delivery.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "procurepulse", role: "Purchasing and stock intelligence" },
    { slug: "wastewatch", role: "Daily waste and shrinkage patterns" },
    { slug: "shiftboard", role: "Staff availability and shift planning" },
    { slug: "pricepilot", role: "Selling-price and margin decisions" },
    { slug: "insightgen", role: "Cross-workflow reporting and alerts" },
    { slug: "doc-u", role: "Supplier-document capture and extraction" },
  ],
  moduleNote:
    "A relevant module set, not a compulsory bundle. Finch does not replace your POS by default — it watches the operation around it.",

  audit: [
    "We take a week of supplier invoices, delivery notes, stock counts and waste records, however they are kept today.",
    "We check every purchase price against the previous three months, every invoice against its delivery note, and what the waste actually cost.",
    "You get the leaks in rand, ranked, and the highest-value place to start — often purchasing, sometimes waste.",
  ],

  solutions: ["reduce-money-leakage", "procurement-automation", "operations-dashboard"],
  learn: [
    "the-real-cost-of-poor-stock-control",
    "hidden-cost-of-manual-procurement",
    "why-businesses-lose-money-without-realising-it",
    "15-signs-your-business-has-operational-chaos",
  ],
  siblings: ["hospitality", "catering-companies", "food-suppliers"],

  gaps: [
    {
      title: "Buying without one source of truth",
      copy: "Supplier orders, expected deliveries and price changes live across messages, calls and separate sheets.",
    },
    {
      title: "Waste recorded too late — or not at all",
      copy: "The cost is visible in the month-end numbers, but the daily reason and the recurring pattern are missing.",
    },
    {
      title: "Labour and demand are disconnected",
      copy: "Shifts are planned separately from the operating picture, making labour decisions harder to review.",
    },
    {
      title: "Margins drift between reviews",
      copy: "Ingredient costs move faster than selling prices, while owners wait for another spreadsheet update.",
    },
  ],

  faqs: [
    {
      question: "Does Finch replace our POS?",
      answer:
        "Not by default. Finch watches the operation around the POS — purchasing, stock, waste, staffing, pricing and reporting. Any useful POS connection is assessed during the audit rather than assumed.",
    },
    {
      question: "Can a restaurant start with one thing?",
      answer:
        "Yes, and that is the recommendation. Start with the gap costing the most — usually purchasing or waste — prove it, and switch the next agent on from the roadmap when the need is clear.",
    },
    {
      question: "Is this only for restaurant groups?",
      answer:
        "No. A single growing restaurant is a fit once the repeated admin and handovers have outgrown WhatsApp, paper and spreadsheets. Pricing is per location, so one site is one line on the invoice.",
    },
    {
      question: "What does Finch cost for a restaurant?",
      answer:
        "R6,000 per location per month, everything included. It starts with the one-week Operations Audit at R2,000, credited to your first month — you get the written leak report either way.",
    },
  ],
};

const cateringCompanies: Industry = {
  slug: "catering-companies",
  name: "Catering operations",
  shortName: "Catering companies",
  singular: "catering company",
  tier: "primary",

  title: "Catering operations software — South Africa",
  description:
    "Finch reads the invoices behind every function a South African caterer runs and compares them to the quote. R6,000 per location per month, audit R2,000.",

  eyebrow: "CATERING COMPANIES · SOUTH AFRICA",
  h1Plain: "Every function costed against",
  h1Accent: "what it actually cost.",
  lead:
    "Quotes get built from experience and last year's spreadsheet; the real ingredient, labour and hire cost is rarely compared back. Finch reads the invoices behind each booking and tells you which functions made money.",

  deck: [
    {
      agent: "THE BRIEF",
      observation: "Saturday's 180-cover wedding came in 14% over its quoted food cost.",
      impact: "≈ R5,600 off the margin",
      evidence: "quote + 9 invoices",
      meta: "SAT 09 AUG · 180 COVERS",
      actions: ["Show the overspend", "Compare to the quote", "Dismiss"],
    },
    {
      agent: "PRICE WATCH",
      observation: "Chicken breast is up R21/kg since June, across both suppliers.",
      impact: "≈ R3,100 per large function",
      evidence: "7 invoices",
      meta: "+14% · JUN–AUG",
      actions: ["Reprice the standard menus", "Show the trend", "Dismiss"],
    },
    {
      agent: "RECON",
      observation: "Three hire items on last week's invoice never appeared on a delivery note.",
      impact: "≈ R2,400 to query",
      evidence: "hire invoice + note",
      meta: "WK 31 · 3 ITEMS",
      actions: ["Open both documents", "Query the supplier", "Dismiss"],
    },
  ],
  cardFinding: "Saturday's wedding came in 14% over its quoted food cost.",
  cardAgents: ["DOC-U", "PRICE WATCH", "THE BRIEF"],

  watchIntro:
    "Agents are set per business in the audit. For a caterer running overlapping bookings, these are the ones that usually earn their place first.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Ingredient, hire and staffing invoices read into the booking they belong to, instead of into a folder nobody opens again.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Ingredient costs against six months of history, so the standard menus get repriced before the next quote goes out at last season's numbers.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "Hire and supplier invoices against what was actually delivered to the venue — the easiest place for a line to be paid twice.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      watches:
        "What is already bought and on hand across the week's overlapping bookings, instead of ordering event by event.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning on WhatsApp: which of the weekend's functions came in over quote, and by how much.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "planwise", role: "Event costing and margin forecasting" },
    { slug: "procurepulse", role: "Procurement and stock across bookings" },
    { slug: "shiftboard", role: "Kitchen and event staff planning" },
    { slug: "orderflow", role: "Quotes, invoicing and client accounts" },
    { slug: "wastewatch", role: "Wastage across functions and prep" },
    { slug: "insightgen", role: "Weekly operational reporting" },
  ],
  moduleNote:
    "A relevant module set, not a compulsory bundle. The audit usually finds costing or procurement is the place to start, and the rest follows the roadmap.",

  audit: [
    "We take a month of quotes and the invoices that followed them — ingredients, hire, casual labour — for the functions you actually ran.",
    "We compare quoted cost to real cost function by function, and check the ingredient prices against the previous three months.",
    "You get the gap in rand per function, ranked, and the first agent worth switching on.",
  ],

  solutions: ["reduce-money-leakage", "reporting-automation", "procurement-automation"],
  learn: [
    "hidden-cost-of-manual-procurement",
    "why-businesses-lose-money-without-realising-it",
    "why-weekly-reports-are-usually-too-late",
    "the-real-cost-of-poor-stock-control",
  ],
  siblings: ["restaurants", "hospitality", "food-suppliers"],

  gaps: [
    {
      title: "Event costs are estimated, not tracked",
      copy: "Quotes are built from experience and old spreadsheets, while the real ingredient, labour and hire cost of an event is rarely compared back afterwards.",
    },
    {
      title: "Procurement runs event to event",
      copy: "Buying decisions are made per booking, with little visibility into what was already ordered, on hand, or needed across the week's functions.",
    },
    {
      title: "Production planning lives in someone's head",
      copy: "Prep lists, staffing and kitchen timelines are coordinated verbally or on paper, and get harder to hold together as bookings overlap.",
    },
    {
      title: "Invoicing trails the event by weeks",
      copy: "Final invoices, extras and deposits are reconciled long after the function, making cash flow and client billing harder to manage.",
    },
  ],

  faqs: [
    {
      question: "Can Finch cost individual functions?",
      answer:
        "Yes. Ingredients, labour, hire and other line items can be tracked against a booking and compared to the original quote, which is what lets an agent tell you a function came in over.",
    },
    {
      question: "Does it help when several events overlap?",
      answer:
        "Yes. Procurement, production planning and staffing are designed to give one view across concurrent bookings rather than treating each event in isolation.",
    },
    {
      question: "Can we start with just costing, or just procurement?",
      answer:
        "Yes. The audit identifies the biggest operational gap — often costing or procurement — and that becomes the first workflow, with the rest activated from the roadmap.",
    },
    {
      question: "What does Finch cost for a catering business?",
      answer:
        "R6,000 per location per month, everything included. It starts with the one-week Operations Audit at R2,000, credited to your first month — you get the written leak report either way.",
    },
  ],
};

const wholesale: Industry = {
  slug: "wholesale",
  name: "Wholesale operations",
  shortName: "Wholesale",
  singular: "wholesaler",
  tier: "primary",

  title: "Wholesale operations software — South Africa",
  description:
    "At wholesale volumes a R2 cost move vanishes into the month. Finch checks every invoice line against what you agreed. R6,000/location/month, South Africa.",

  eyebrow: "WHOLESALE · SOUTH AFRICA",
  h1Plain: "Volume hides the small losses.",
  h1Accent: "Finch counts them.",
  lead:
    "At wholesale volumes a R2 cost increase and a two-crate short delivery both disappear into the month. Finch checks every line on every invoice against what you agreed and what actually moved off the truck.",

  deck: [
    {
      agent: "PRICE WATCH",
      observation: "Your cost on 10kg potato pockets moved twice since June, without a notice.",
      impact: "≈ R11,400/mo at current volumes",
      evidence: "12 invoices",
      meta: "2 MOVES · JUN–AUG",
      actions: ["Draft supplier email", "Show the 6-month trend", "Dismiss"],
    },
    {
      agent: "DELIVERY WATCH",
      observation: "Four drops on Tuesday's Soweto route came back without a signature.",
      impact: "≈ R18,000 you cannot prove you delivered",
      evidence: "4 delivery notes",
      meta: "TUE · SOWETO ROUTE",
      actions: ["List the four drops", "Send to the drivers", "Dismiss"],
    },
    {
      agent: "DEBTORS",
      observation: "Your third-largest account has quietly halved its weekly order since May.",
      impact: "≈ R31,000/mo of revenue",
      evidence: "order history",
      meta: "−48% · MAY–AUG",
      actions: ["Show the order history", "Draft a call list", "Dismiss"],
    },
  ],
  cardFinding: "Potato pockets moved twice since June, without a notice.",
  cardAgents: ["PRICE WATCH", "RECON", "DELIVERY WATCH", "DEBTORS"],

  watchIntro:
    "Agents are set per business in the audit. For a wholesaler running volume through its own trucks, these are the ones that usually earn their place first.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Purchase orders, supplier invoices and delivery notes read into one record — the volume is exactly why nobody has time to key them.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Every line on every supplier invoice against six months of history, because at your volumes a R2 move is a real number.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "What was invoiced against what was received, line by line, instead of a spot-check when something feels wrong.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DELIVERY WATCH",
      watches:
        "Routes against delivery notes, for wholesalers running their own trucks — including the drops that come back unsigned.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      watches:
        "Stock on hand against the orders already on their way, so a reorder is a decision rather than a reaction to a stockout.",
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
    { slug: "procurepulse", role: "Purchasing and inventory intelligence" },
    { slug: "orderflow", role: "Order processing and invoicing" },
    { slug: "supplysync", role: "Supplier records and performance" },
    { slug: "pricepilot", role: "Margin and selling-price control" },
    { slug: "insightgen", role: "Operational reporting across lines" },
    { slug: "doc-u", role: "Purchase order and invoice capture" },
  ],
  moduleNote:
    "A relevant module set, not a compulsory bundle. Finch can sit alongside an existing warehouse system or become the operating record — the audit decides which.",

  audit: [
    "We take a week of purchase orders, supplier invoices, delivery notes and your debtors ageing, at whatever volume they come in.",
    "We check every invoice line against the previous three months and against what was received, and look at which accounts are drifting.",
    "You get the leaks in rand, ranked, and the workflow carrying the most risk — usually purchasing or margin visibility.",
  ],

  solutions: ["procurement-automation", "reduce-money-leakage", "operations-dashboard"],
  learn: [
    "the-real-cost-of-poor-stock-control",
    "supplier-scorecards-what-to-track-and-why",
    "why-businesses-lose-money-without-realising-it",
    "hidden-cost-of-manual-procurement",
  ],
  siblings: ["food-suppliers", "farms", "restaurants"],

  gaps: [
    {
      title: "Purchasing reacts to stockouts",
      copy: "Reorder decisions are triggered by a shortage someone notices, rather than a clear view of stock levels and movement across lines.",
    },
    {
      title: "Inventory movement is hard to trust",
      copy: "What's on the shelf, in transit and on order lives across different systems and sheets, so counts drift from reality.",
    },
    {
      title: "Order processing depends on manual capture",
      copy: "Customer orders arriving by call, email or message still need to be retyped into the system that actually ships and invoices.",
    },
    {
      title: "Margin is reviewed after the fact",
      copy: "Cost price changes from suppliers reach the selling price late, if at all, so margin erosion is only visible at month-end.",
    },
  ],

  faqs: [
    {
      question: "Does Finch replace our warehouse system?",
      answer:
        "Not necessarily. Finch can read from an existing stock system or become the operating record for purchasing, orders and reporting. The audit confirms which sources are reliable enough for an agent to say anything useful about.",
    },
    {
      question: "Can it handle our order volumes?",
      answer:
        "Yes. Repeat customer orders, pricing and invoicing run through a connected workflow rather than a per-order manual process, and the shape and volume of that workflow is assessed during the audit.",
    },
    {
      question: "Can we start with purchasing before order processing?",
      answer:
        "Yes, and most do. Start with the workflow carrying the most risk — usually purchasing or margin visibility — and expand once that value is proven.",
    },
    {
      question: "What does Finch cost for a wholesaler?",
      answer:
        "R6,000 per location per month, everything included. It starts with the one-week Operations Audit at R2,000, credited to your first month — you get the written leak report either way.",
    },
  ],
};

const hospitality: Industry = {
  slug: "hospitality",
  name: "Hospitality operations",
  shortName: "Hospitality",
  singular: "hospitality operation",
  tier: "primary",

  title: "Hospitality operations software — South Africa",
  description:
    "Kitchen, bar and housekeeping each track their own week. Finch reads across all of them and sends what changed. R6,000/location/month, South Africa.",

  eyebrow: "HOSPITALITY · SOUTH AFRICA",
  h1Plain: "Every department has its own numbers.",
  h1Accent: "You need one picture.",
  lead:
    "Kitchen, bar, housekeeping and procurement each track their own week, and leadership waits for a manager to compile it. Finch reads across all of them and sends what changed on Monday morning.",

  deck: [
    {
      agent: "THE BRIEF",
      observation:
        "Beverage margin fell 2.1 points last week. The bar's cost price moved; the list price didn't.",
      impact: "≈ R9,400 on last week's covers",
      evidence: "sales + purchases",
      meta: "BAR · WK 31 · −2.1 PTS",
      actions: ["Show the drivers", "Send to the F&B manager", "Dismiss"],
    },
    {
      agent: "PRICE WATCH",
      observation: "Housekeeping consumables are up 16% across two suppliers since April.",
      impact: "≈ R4,700/mo",
      evidence: "9 invoices",
      meta: "+16% · APR–AUG",
      actions: ["Show the two suppliers", "Draft supplier email", "Dismiss"],
    },
    {
      agent: "RECON",
      observation: "Two approved purchase orders have no matching delivery note this month.",
      impact: "≈ R7,300 unaccounted",
      evidence: "2 purchase orders",
      meta: "AUG · 2 OPEN",
      actions: ["Open the two POs", "Ask the department", "Dismiss"],
    },
  ],
  cardFinding: "Beverage margin fell 2.1 points; the list price never moved.",
  cardAgents: ["DOC-U", "PRICE WATCH", "RECON", "THE BRIEF"],

  watchIntro:
    "Agents are set per business in the audit. For a property running several departments against one P&L, these are the ones that usually earn their place first.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Purchase requests, supplier invoices and delivery notes from every department, read into one record rather than four folders.",
      status: "LIVE",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Supplier prices across food, beverage and consumables, so a 16% move in housekeeping stock is not something you find in the annual accounts.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      watches:
        "Approved purchase orders against what was actually delivered and invoiced, with a reviewable record instead of a verbal trail.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      watches:
        "Stock on hand per department against what has already been ordered, so one department's shortage is visible before service.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning on WhatsApp: what moved across every department last week, ranked — instead of waiting for a manager to compile it.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "insightgen", role: "Executive reporting across departments" },
    { slug: "procurepulse", role: "Procurement and stock intelligence" },
    { slug: "supplysync", role: "Supplier control and performance history" },
    { slug: "shiftboard", role: "Staff scheduling and department workflows" },
    { slug: "planwise", role: "Budgeting and forecasting by department" },
    { slug: "doc-u", role: "Approval and document capture" },
  ],
  moduleNote:
    "A relevant module set, not a compulsory bundle. Group-level visibility depends on how consistently each property already operates, which the audit assesses first.",

  audit: [
    "We take a week of purchase requests, supplier invoices, delivery notes and department numbers from across the property.",
    "We check prices against the previous three months, approvals against deliveries, and how long it takes a department's numbers to reach you.",
    "You get the leaks in rand, ranked by department, and an honest view of whether a group rollout makes sense yet.",
  ],

  solutions: ["operations-dashboard", "reporting-automation", "reduce-money-leakage"],
  learn: [
    "why-weekly-reports-are-usually-too-late",
    "15-signs-your-business-has-operational-chaos",
    "why-businesses-lose-money-without-realising-it",
    "hidden-cost-of-manual-procurement",
  ],
  siblings: ["restaurants", "catering-companies", "wholesale"],

  gaps: [
    {
      title: "Departments run on separate routines",
      copy: "Kitchen, bar, housekeeping and front-of-house each track their own numbers, making it hard to see how the operation is performing as a whole.",
    },
    {
      title: "Procurement approvals happen informally",
      copy: "Purchase requests move through calls, messages and verbal sign-off, with little record of who approved what and why.",
    },
    {
      title: "Supplier performance is remembered, not recorded",
      copy: "Which suppliers deliver late, short or over-priced tends to live in someone's memory rather than a reviewable history.",
    },
    {
      title: "Leadership waits for the report",
      copy: "Executives see performance once a manager has compiled it, rather than having a live view of the operation underneath them.",
    },
  ],

  faqs: [
    {
      question: "Can Finch work across several departments in one property?",
      answer:
        "Yes. Procurement, stock, staffing and reporting connect into one operating record configured around how the property actually runs, and the agents read across all of it.",
    },
    {
      question: "Does it support formal approval chains?",
      answer:
        "Yes. Purchase requests and approvals can be routed and recorded as part of the procurement workflow, with the approval structure confirmed during implementation.",
    },
    {
      question: "Is this suitable for a multi-property group?",
      answer:
        "It can be. Group-level visibility depends on how consistently each property currently operates, which the audit assesses before recommending a rollout. Pricing is per location, so a group is priced per site.",
    },
    {
      question: "What does Finch cost for a hospitality operation?",
      answer:
        "R6,000 per location per month, everything included. It starts with the one-week Operations Audit at R2,000, credited to your first month — you get the written leak report either way.",
    },
  ],
};

/* ── The two experimental verticals ──────────────────────────────────────────
   Per `.ai/vyso_v2.md` §2.2: indexed, in the sitemap, linked from the industries
   hub and nowhere else. `experimentalNote` is rendered as its own band directly
   under the hero, before any claim is made — a reader should learn that no audit
   has been run in this vertical before they read a rand figure, not after.    */

const securityCompanies: Industry = {
  slug: "security-companies",
  name: "Security company operations",
  shortName: "Security companies",
  singular: "security company",
  tier: "experimental",

  title: "Security company operations software — SA",
  description:
    "Rostered hours, contracted hours and invoiced hours should match. Finch reads the rosters, contracts and invoices. R6,000 per location/month, South Africa.",

  eyebrow: "SECURITY COMPANIES · SOUTH AFRICA · EXPERIMENTAL",
  h1Plain: "Rostered hours, contracted hours, invoiced hours —",
  h1Accent: "three numbers that should match.",
  lead:
    "Finch is built for operations-heavy South African SMEs, and a guarding business is one. It reads your rosters, client contracts and supplier invoices, and flags where the hours you pay for and the hours you bill diverge.",

  experimentalNote:
    "This is an experimental vertical. Finch was built for South African food and produce operations, and everything on this page is the same machinery pointed at a guarding business: reading documents, watching prices, reconciling one record against another. We have not run an audit in a security company yet, so there is no case study here and nothing on this page is a measured result. If the description fits your operation, the audit is how we both find out.",

  deck: [
    {
      agent: "RECON",
      observation:
        "Devland site was rostered for 744 guard hours in July and invoiced to the client for 720.",
      impact: "≈ R9,100 of paid hours not billed",
      evidence: "roster + contract",
      meta: "DEVLAND · JUL · −24 HRS",
      actions: ["Open the roster", "Check the contract", "Dismiss"],
    },
    {
      agent: "PRICE WATCH",
      observation: "Vehicle servicing and fuel are up 13% across the fleet since April.",
      impact: "≈ R7,800/mo",
      evidence: "11 invoices",
      meta: "FLEET · +13% · APR–AUG",
      actions: ["Show the trend", "Split by vehicle", "Dismiss"],
    },
    {
      agent: "DOC-U",
      observation:
        "Nine incident reports came in as photographs this week. Three name the same client site.",
      impact: "3 of 9 at one site",
      evidence: "9 photographed reports",
      meta: "WK 31 · READ ON INTAKE",
      actions: ["Open the three", "Send to the client", "Dismiss"],
    },
  ],
  cardFinding: "Rostered 744 hours. Invoiced the client for 720.",
  cardAgents: ["DOC-U", "RECON", "PRICE WATCH"],

  watchIntro:
    "The same agents, in a guarding vocabulary. None of this has been run against a real security business yet — it is what the audit would go looking for.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Incident reports, guard registers and supplier invoices — including the ones photographed on a phone at three in the morning — read into a reviewable record.",
      status: "LIVE",
    },
    {
      label: "RECON",
      watches:
        "Rostered hours against contracted hours against invoiced hours, per client site, so paid-but-unbilled time surfaces in the month it happened.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "PRICE WATCH",
      watches:
        "Vehicle, fuel, uniform and equipment costs line by line, against six months of the same supplier's prices.",
      status: "ROLLING OUT",
    },
    {
      label: "DEBTORS",
      watches:
        "Client accounts drifting past terms — in a contract business, the ones that drift tend to keep drifting.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning on WhatsApp: which sites cost more than they billed last week, ranked.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "doc-u", role: "Incident-report and invoice intake" },
    { slug: "shiftboard", role: "Rostering and labour deployment" },
    { slug: "orderflow", role: "Client billing and the commercial record" },
    { slug: "supplysync", role: "Supplier records and cost history" },
    { slug: "insightgen", role: "Site-level reporting and alerts" },
  ],
  moduleNote:
    "The modules a guarding business would most likely start from. They were built for food and produce operations, so the audit is where we establish what genuinely transfers and what does not.",

  audit: [
    "We take a month of rosters, client contracts, issued invoices and supplier invoices, in whatever form they exist.",
    "We reconcile rostered against contracted against invoiced hours per site, and check fleet and equipment costs against the previous three months.",
    "You get the gaps in rand per site — and an honest answer about whether Finch is the right tool for a guarding business at all.",
  ],

  solutions: ["operations-dashboard", "reduce-money-leakage", "reporting-automation"],
  learn: [
    "why-businesses-lose-money-without-realising-it",
    "15-signs-your-business-has-operational-chaos",
    "why-weekly-reports-are-usually-too-late",
    "ai-for-small-and-medium-businesses-practical-use-cases",
  ],
  /* Primary verticals only, deliberately: the hub is the one entry point to
     an experimental page, so these pages link *up* into the real business and
     never sideways into each other. */
  siblings: ["hospitality", "wholesale", "food-suppliers"],

  gaps: [
    {
      title: "Rostered hours and billed hours drift apart",
      copy: "A site covered above its contracted hours costs wages immediately and shows up on an invoice weeks later, if at all.",
    },
    {
      title: "Site profitability is a monthly guess",
      copy: "Wages, vehicles, equipment and the contract value sit in different places, so nobody can say which sites actually make money.",
    },
    {
      title: "Incident reports arrive as photographs",
      copy: "Paperwork written at a gate at night reaches the office as an image, and the pattern across a client's sites is never assembled.",
    },
    {
      title: "Fleet and equipment costs creep",
      copy: "Servicing, fuel, uniforms and radios each move a little, and none of the increases is big enough on its own to trigger a conversation.",
    },
  ],

  faqs: [
    {
      question: "Has Finch been implemented in a security company?",
      answer:
        "No. Finch's live work is with South African food and produce operations, and Turn 'n Slice is the only client we quote. This page describes what the same agents would watch in a guarding business, not something we have measured in one.",
    },
    {
      question: "What would Finch actually read?",
      answer:
        "Rosters, client contracts, issued invoices, supplier and fleet invoices, and incident reports — including photographed ones. Document intelligence is the part of Finch that is live today; the reconciliation agents are activated from your audit roadmap.",
    },
    {
      question: "Does Finch handle PSIRA compliance?",
      answer:
        "No, and we would not claim otherwise. Finch is an operations layer that watches hours, costs and documents. Registration, grading and statutory compliance stay with the systems and people that already handle them.",
    },
    {
      question: "How would we find out whether it fits?",
      answer:
        "The one-week Operations Audit, R2,000, credited to your first month. Because this vertical is experimental, the audit's first job is to tell you honestly whether Finch is the right tool — and we will say so if it is not.",
    },
  ],
};

const insuranceBrokers: Industry = {
  slug: "insurance-brokers",
  name: "Insurance brokerage operations",
  shortName: "Insurance brokers",
  singular: "brokerage",
  tier: "experimental",

  title: "Insurance broker operations software — SA",
  description:
    "Finch reads commission statements, checks them against the policies you placed, and flags renewals going quiet. R6,000 per location/month, South Africa.",

  eyebrow: "INSURANCE BROKERS · SOUTH AFRICA · EXPERIMENTAL",
  h1Plain: "Renewals, commission statements and follow-ups —",
  h1Accent: "none of them should live in a diary.",
  lead:
    "Finch is built for operations-heavy South African SMEs, and a brokerage is a document-and-date business. It reads the commission statements, checks them against the policies you placed, and tells you which renewals are about to go quiet.",

  experimentalNote:
    "This is an experimental vertical. Finch was built for South African food and produce operations, and everything on this page is the same machinery pointed at a brokerage: reading documents, reconciling one record against another, and surfacing what changed. We have not run an audit in a brokerage yet, so there is no case study here and nothing on this page is a measured result. If the description fits your practice, the audit is how we both find out.",

  deck: [
    {
      agent: "RECON",
      observation: "Four policies placed in May do not appear on the June commission statement.",
      impact: "≈ R6,400 of commission unaccounted",
      evidence: "statement + policy list",
      meta: "JUN · 4 POLICIES",
      actions: ["List the four", "Query the insurer", "Dismiss"],
    },
    {
      agent: "DOC-U",
      observation:
        "This month's commission statements arrived as three PDFs in three different layouts.",
      impact: "312 lines read, 6 flagged",
      evidence: "3 statements",
      meta: "AUG · READ ON ARRIVAL",
      actions: ["Open the six", "Export the lines", "Dismiss"],
    },
    {
      agent: "THE BRIEF",
      observation:
        "Eleven policies renew inside 30 days. Four have had no client contact since inception.",
      impact: "≈ R41,000 of annual premium at risk",
      evidence: "renewal diary",
      meta: "NEXT 30 DAYS · 11 RENEWALS",
      actions: ["Show the four", "Draft the follow-ups", "Dismiss"],
    },
  ],
  cardFinding: "Four policies placed in May are missing from June's statement.",
  cardAgents: ["DOC-U", "RECON", "THE BRIEF"],

  watchIntro:
    "The same agents, in a brokerage vocabulary. None of this has been run against a real brokerage yet — it is what the audit would go looking for.",
  agents: [
    {
      label: "DOC-U",
      watches:
        "Commission statements, policy schedules and endorsements read into a reviewable record — three insurers, three layouts, one set of lines.",
      status: "LIVE",
    },
    {
      label: "RECON",
      watches:
        "The commission statement against the policies you actually placed, so a missing or short-paid line is a finding rather than an accepted rounding.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "THE BRIEF",
      watches:
        "Monday morning on WhatsApp: renewals inside 30 days, statements that came up short, and clients who have gone quiet.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DEBTORS",
      watches:
        "Premium collections and client accounts drifting past their terms, before a lapse becomes the first anyone hears of it.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],

  modules: [
    { slug: "doc-u", role: "Statement and policy-document intake" },
    { slug: "orderflow", role: "Client records and the commercial trail" },
    { slug: "insightgen", role: "Renewal and follow-up reporting" },
    { slug: "planwise", role: "Commission income against target" },
  ],
  moduleNote:
    "The modules a brokerage would most likely start from. They were built for food and produce operations, so the audit is where we establish what genuinely transfers and what does not.",

  audit: [
    "We take three months of commission statements, your policy register and your renewal diary, in whatever form they exist.",
    "We reconcile every statement line against the policies placed, and check which renewals and follow-ups have had no contact.",
    "You get the unaccounted commission and the at-risk renewals in rand — and an honest answer about whether Finch suits a brokerage at all.",
  ],

  solutions: ["reduce-money-leakage", "reporting-automation", "operations-dashboard"],
  learn: [
    "why-businesses-lose-money-without-realising-it",
    "why-weekly-reports-are-usually-too-late",
    "how-much-time-can-workflow-automation-save",
    "ai-for-small-and-medium-businesses-practical-use-cases",
  ],
  /* Primary verticals only — see the note on `security-companies`. */
  siblings: ["hospitality", "food-suppliers", "wholesale"],

  gaps: [
    {
      title: "Commission is reconciled by sampling, if at all",
      copy: "A statement runs to hundreds of lines in the insurer's layout, so most practices check a few and accept the total.",
    },
    {
      title: "Renewals live in a diary",
      copy: "The date is recorded somewhere; whether the client has been spoken to since inception usually is not.",
    },
    {
      title: "Follow-up cadence depends on who is busy",
      copy: "Client contact happens when someone has a gap, which means the quiet accounts stay quiet the longest.",
    },
    {
      title: "The admin is document-heavy by nature",
      copy: "Schedules, endorsements, statements and FICA paperwork all arrive as files that someone reads once and files away.",
    },
  ],

  faqs: [
    {
      question: "Has Finch been implemented in a brokerage?",
      answer:
        "No. Finch's live work is with South African food and produce operations, and Turn 'n Slice is the only client we quote. This page describes what the same agents would watch in a brokerage, not something we have measured in one.",
    },
    {
      question: "What would Finch actually read?",
      answer:
        "Commission statements, policy schedules, endorsements and your renewal register. Document intelligence — reading a statement in the insurer's own layout into reviewable lines — is the part of Finch that is live today.",
    },
    {
      question: "Is this an FSP compliance or advice system?",
      answer:
        "No, and we would not claim otherwise. Finch watches operational and commercial records — statements, renewals, follow-ups, costs. Advice records, FAIS compliance and regulatory reporting stay with the systems built for them.",
    },
    {
      question: "How would we find out whether it fits?",
      answer:
        "The one-week Operations Audit, R2,000, credited to your first month. Because this vertical is experimental, the audit's first job is to tell you honestly whether Finch is the right tool — and we will say so if it is not.",
    },
  ],
};

/* ── Registry ─────────────────────────────────────────────────────────────── */

/** Hub order. Food suppliers first — the primary vertical, per §0. */
export const PRIMARY_INDUSTRY_ORDER = [
  "food-suppliers",
  "farms",
  "restaurants",
  "catering-companies",
  "wholesale",
  "hospitality",
] as const;

/** The "Also watching" row. The only place these two are linked from. */
export const EXPERIMENTAL_INDUSTRY_ORDER = ["security-companies", "insurance-brokers"] as const;

export const INDUSTRY_ORDER: readonly string[] = [
  ...PRIMARY_INDUSTRY_ORDER,
  ...EXPERIMENTAL_INDUSTRY_ORDER,
];

export const INDUSTRIES: Record<string, Industry> = {
  "food-suppliers": foodSuppliers,
  farms,
  restaurants,
  "catering-companies": cateringCompanies,
  wholesale,
  hospitality,
  "security-companies": securityCompanies,
  "insurance-brokers": insuranceBrokers,
};

export const INDUSTRY_LIST: readonly Industry[] = INDUSTRY_ORDER.map((slug) => INDUSTRIES[slug]);

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES[slug];
}

/* ── The hub ──────────────────────────────────────────────────────────────── */

export const HUB = {
  title: "Industries — who Finch works for in SA",
  description:
    "Finch watches operations-heavy South African food businesses: suppliers, farms, restaurants, caterers, wholesalers, hospitality. R6,000 per location/month.",
  eyebrow: "WHO FINCH WORKS FOR",
  h1Plain: "Built for operations-heavy",
  h1Accent: "South African food businesses.",
  lead:
    "Finch does not change per industry — what changes is which agents earn their place first, and in whose vocabulary. These are the operations we understand well enough to be specific about.",
  primaryEyebrow: "SIX OPERATIONS WE KNOW WELL",
  primaryHeading: "Find the operation that looks like yours.",
  primaryLead:
    "Each page names the findings that vertical actually gets, the agents behind them, and what Finch can honestly do today. The example figures are worked examples, not client results.",
  alsoEyebrow: "ALSO WATCHING",
  alsoHeading: "Two we are still learning.",
  alsoLead:
    "Operations-heavy businesses outside food that keep asking. The machinery is the same — the experience is not, and these pages say so.",
} as const;
