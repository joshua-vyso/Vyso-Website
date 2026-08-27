/* ── /solutions content ──────────────────────────────────────────────────────
   Moved out of `app/solutions/[slug]/page.tsx` (Phase 2, workstream D), where
   the hub page had to import a route module to read it.

   Server-safe by construction: nothing here imports a `"use client"` module,
   because `solutions-jsonld.ts` reads it from a server component. See
   `.ai/implementation_phase1.md` §B deviation 1 for what happens when that
   rule is broken.

   What changed in the move, and why:
   - Vyso → Finch. Vyso is the company (the audit, the invoice); Finch is the
     product doing the watching. Every "Vyso does X" became "Finch does X".
   - `agents` added per solution: the example agents that would work this
     problem, each with the honesty status `.ai/vyso_v2.md` §4 assigns it.
     Doc-U is the only thing presented as live.
   - `exampleFinding` added per solution: one page-specific FindingCard, always
     rendered under an `ILLUSTRATIVE EXAMPLE` caption (the homepage hero's
     pattern) because the figures are worked examples, not measurements.
   - `costStats` dropped. The four numbers per solution ("R8k–R25k typical
     monthly variance", "3–5% of revenue"…) carried no source and were framed
     as patterns "we typically see" — with one client, that is not a pattern we
     can publish. They are replaced by `costShapes`: the shapes the cost takes,
     no figures, and a closing line saying the audit is what produces the rand
     number. Nothing else grounded was removed.
   - Learn links repointed at articles that exist. Nine of the sixteen original
     hrefs pointed at slugs `lib/marketing/learn-articles.ts` has never had
     (e.g. `12-operational-kpis-every-ceo-should-track`) — all were 404s.       */

export type RelatedLink = { label: string; href: string };

/** Honesty chips, per `.ai/vyso_v2.md` §4. Doc-U is the only `LIVE` one. */
export type AgentStatus = "LIVE" | "ROLLING OUT" | "FROM YOUR AUDIT ROADMAP";

export type SolutionAgent = {
  /** Mono label, matching the roster on `/#agents`. */
  label:  string;
  /** What this agent does *for this problem* — not its generic one-liner. */
  role:   string;
  status: AgentStatus;
};

/** One worked FindingCard per page. Always captioned `ILLUSTRATIVE EXAMPLE`. */
export type ExampleFinding = {
  agent:       string;
  observation: string;
  impact:      string;
  evidence:    string;
  meta:        string;
  actions:     readonly string[];
};

export type Solution = {
  slug:        string;
  name:        string;
  shortName:   string;
  /** The problem as a noun phrase, for mid-sentence use ("behind …"). */
  problemNoun: string;
  /** The hub card's one-liner. */
  summary:     string;
  title:       string;
  description: string;
  eyebrow:     string;
  heroPlain:   string;
  heroAccent:  string;
  /** The AEO answer: ≤ 45 words, directly answering the page's question. */
  lead:        string;
  problem:     readonly string[];
  struggles:   readonly { title: string; copy: string }[];
  costIntro:   string;
  costShapes:  readonly { label: string; copy: string }[];
  costNote:    string;
  helpIntro:   string;
  agents:      readonly SolutionAgent[];
  /** The modules underneath the agents — links to `/platform/modules`. */
  modules:     readonly { name: string; role: string }[];
  workflow:    readonly { title: string; copy: string }[];
  exampleFinding: ExampleFinding;
  industries:  readonly RelatedLink[];
  learnArticles: readonly RelatedLink[];
  /** Sibling solution slugs — §7.5 wants ≥ 3 sideways links per spoke. */
  related:     readonly string[];
  faqs:        readonly { question: string; answer: string }[];
};

/* ── The four solutions ───────────────────────────────────────────────────── */

const reduceMoneyLeakage: Solution = {
  slug: "reduce-money-leakage",
  name: "Reduce money leakage",
  shortName: "Reduce money leakage",
  problemNoun: "money leakage",
  summary:
    "The money isn't missing — it leaves in small, repeated amounts nobody is positioned to see. Finch watches all of them at once.",
  title: "Reduce money leakage in your business",
  description:
    "Finch's agents watch invoices, stock, supplier prices and debtors, so money leaking out of a South African operation surfaces in days, not at month end.",
  eyebrow: "WHAT FINCH FIXES · MONEY LEAKAGE",
  heroPlain: "The money isn't missing.",
  heroAccent: "Nobody is watching it leave.",
  lead:
    "Money rarely leaves in one dramatic event. It leaves in small, repeated amounts — a short delivery, a price that crept up, a stock variance — spread across tools that never talk. Finch's agents watch all of them, continuously, and tell you what moved.",
  problem: [
    "Money leakage rarely looks like fraud or a single bad decision. It looks like a delivery that was short by a few crates and never flagged, a supplier price that crept up three months ago and was never renegotiated, or a manager who quietly absorbed two extra hours of admin because the report had to go out on Friday.",
    "Individually, each of these looks too small to investigate. Collectively — across a month of orders, waste and pricing decisions — they add up to a meaningful share of margin. And because the information sits in different spreadsheets, WhatsApp threads and people's memory, nobody is actually positioned to see the pattern.",
  ],
  struggles: [
    {
      title: "No single place to compare",
      copy: "Stock counts, supplier spend, orders and waste live in separate spreadsheets and apps, so nobody can hold them up against each other.",
    },
    {
      title: "Reviews happen monthly, leaks happen weekly",
      copy: "By the time someone sits down to reconcile the numbers, the small losses that caused the gap are weeks old and nobody remembers the detail.",
    },
    {
      title: "Ownership is unclear",
      copy: "Spotting leakage is technically everyone's job — which in practice means it is often nobody's job on any particular Tuesday.",
    },
    {
      title: "Small losses look too small to chase",
      copy: "A R200 variance here and a R400 price increase there rarely trigger action on their own, even though the pattern repeats every single week.",
    },
  ],
  costIntro:
    "We don't publish an industry figure for this, because we haven't measured one we'd be willing to stand behind. What we can describe is the shape the cost takes before anything is watching.",
  costShapes: [
    {
      label: "The delay",
      copy: "A leak that starts on a Tuesday is usually first visible in a month-end report — after it has repeated three or four times.",
    },
    {
      label: "The admin hours",
      copy: "Reconciling numbers across spreadsheets is manager time, and it is spent looking for the problem rather than fixing it.",
    },
    {
      label: "The margin drift",
      copy: "Cost of goods creeps up a percent at a time. Each step is too small to argue about; the sum shows up in the annual accounts.",
    },
    {
      label: "The decisions made late",
      copy: "The expensive part is rarely the loss itself — it is the week of ordering, pricing and staffing done on numbers that were already wrong.",
    },
  ],
  costNote:
    "The rand figure for your business is what the one-week Operations Audit produces, from your own invoices, statements and stock sheets. We would rather hand you that number than guess it here.",
  helpIntro:
    "Finch doesn't add another spreadsheet to reconcile. Its agents read the places leakage actually happens — purchase invoices, delivery notes, price lists, stock counts, debtor ages — and surface what moved, with the document it came from attached.",
  agents: [
    {
      label: "THE BRIEF",
      role: "Monday morning on WhatsApp: the three things that moved against you last week, ranked.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "PRICE WATCH",
      role: "Supplier prices, line by line, against six months of memory — so a creep is caught at the second invoice.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      role: "What was invoiced against what actually arrived at the back door.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      role: "Stock on hand against the orders already on their way, so a variance is visible before the count.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],
  modules: [
    { name: "InsightGen", role: "Cross-workflow reporting and anomaly alerts" },
    { name: "WasteWatch", role: "Daily waste and shrinkage patterns" },
    { name: "PricePilot", role: "Selling-price and margin decisions" },
    { name: "ProcurePulse", role: "Purchasing and stock intelligence" },
  ],
  workflow: [
    {
      title: "Your tools stay where they are",
      copy: "Finch connects to the systems you already run — accounting, orders, stock, the WhatsApp thread the invoices arrive in — and reads from them.",
    },
    {
      title: "You set what counts as worth flagging",
      copy: "A 3% price move on cooking oil may matter; the same move on serviettes may not. The thresholds are yours, set in onboarding.",
    },
    {
      title: "Agents surface it as it happens",
      copy: "A finding names the thing, the rand impact at your volumes, and the invoice or count it came from. Not a dashboard you have to remember to open.",
    },
    {
      title: "You decide; Finch records the close",
      copy: "Draft the supplier email, bring the order forward, or dismiss it. Either way the finding is closed against evidence, not forgotten.",
    },
  ],
  exampleFinding: {
    agent: "THE BRIEF",
    observation:
      "Three things moved against you last week: a short delivery, a supplier price rise and a stock variance.",
    impact: "≈ R6,800 across the three",
    evidence: "3 findings",
    meta: "MON 04 AUG · RANKED",
    actions: ["Open all three", "Send to my bookkeeper", "Dismiss"],
  },
  industries: [
    { label: "Food suppliers", href: "/industries/food-suppliers" },
    { label: "Restaurants", href: "/industries/restaurants" },
    { label: "Wholesale", href: "/industries/wholesale" },
    { label: "Catering companies", href: "/industries/catering-companies" },
    { label: "Farms & producers", href: "/industries/farms" },
    { label: "Hospitality", href: "/industries/hospitality" },
  ],
  learnArticles: [
    {
      label: "Why businesses lose money without realising it",
      href: "/learn/why-businesses-lose-money-without-realising-it",
    },
    {
      label: "15 signs your business has operational chaos",
      href: "/learn/15-signs-your-business-has-operational-chaos",
    },
    { label: "The real cost of poor stock control", href: "/learn/the-real-cost-of-poor-stock-control" },
    { label: "The hidden cost of manual procurement", href: "/learn/hidden-cost-of-manual-procurement" },
  ],
  related: ["procurement-automation", "reporting-automation", "operations-dashboard"],
  faqs: [
    {
      question: "How does Finch find money leakage we can't see today?",
      answer:
        "By reading the documents the leakage already lives in — purchase invoices, delivery notes, price lists, stock counts — and comparing each one against what came before it. The one-week audit maps where your business is most exposed before any agent is switched on.",
    },
    {
      question: "Do we need to replace our accounting or stock system first?",
      answer:
        "No. Finch reads from the tools you already run rather than replacing them. The audit confirms which sources are reliable enough to watch and which need tidying before an agent can say anything useful about them.",
    },
    {
      question: "How quickly would we see where money is leaking?",
      answer:
        "The audit gives you a written picture within the week. After that it depends on the data: a supplier price creep shows up on the second invoice, while a stock pattern needs a few counts before it means anything.",
    },
    {
      question: "Is this only worth it for businesses with several locations?",
      answer:
        "No. A single growing restaurant, farm or supplier is a fit once the leakage is no longer small enough to shrug off. Finch is priced per customer and per scope, so one location is priced as one location.",
    },
  ],
};

const procurementAutomation: Solution = {
  slug: "procurement-automation",
  name: "Procurement automation",
  shortName: "Procurement automation",
  problemNoun: "manual procurement",
  summary:
    "Requests, approvals, agreed prices and the invoice that follows — in one place, checked by an agent instead of remembered by a person.",
  title: "Procurement automation software for SA businesses",
  description:
    "Finch reads supplier invoices and delivery notes, checks each price against what you agreed, and flags the gap — for South African food businesses.",
  eyebrow: "WHAT FINCH FIXES · PROCUREMENT",
  heroPlain: "Purchasing shouldn't run",
  heroAccent: "on memory and WhatsApp.",
  lead:
    "When approvals happen on a phone call and prices live in someone's head, buying decisions get made blind. Finch reads every supplier invoice and delivery note, checks the price against what you agreed, and flags the gap the same day.",
  problem: [
    "In a lot of growing SMEs, procurement is not a process — it is a set of habits. A manager notices stock is low, sends a message to a supplier, and the order happens before anyone else in the business knows it was placed. Approval, if it happens at all, comes after the money is already committed.",
    "The same gap shows up in pricing. Supplier terms and negotiated rates live in an old spreadsheet, an inbox, or a person's memory, so the price actually paid can quietly drift from the price that was agreed — and nobody notices until someone happens to compare two invoices side by side.",
  ],
  struggles: [
    {
      title: "Approvals happen after the spend",
      copy: "By the time anyone reviews a purchase, the order has been placed and the supplier is already expecting payment.",
    },
    {
      title: "Prices live in someone's head",
      copy: "Negotiated rates and rebates sit in old sheets or memory, so the price actually charged can drift from what was agreed.",
    },
    {
      title: "Orders get duplicated",
      copy: "Without one shared view, two people can raise the same order because neither could see what had already gone out.",
    },
    {
      title: "No paper trail when it goes wrong",
      copy: "When a delivery is short or a price is wrong, there is no consistent record of what was requested, approved or agreed.",
    },
  ],
  costIntro:
    "We don't publish an industry figure for what broken purchasing costs, because we haven't measured one we'd stand behind. Here is the shape of it instead.",
  costShapes: [
    {
      label: "The price you didn't agree to",
      copy: "A rate creeps up between invoices. Nothing about the invoice looks wrong — it only looks wrong next to the one before it.",
    },
    {
      label: "The delivery that was short",
      copy: "A crate that never arrived is invoiced anyway. Catching it needs the delivery note and the invoice in the same pair of hands.",
    },
    {
      label: "The emergency order",
      copy: "When the normal channel is too slow, someone buys retail at retail prices, and it lands in cost of goods without a label on it.",
    },
    {
      label: "The chasing",
      copy: "Confirming a price, finding who approved something, or asking a supplier to resend a document is admin time that produces nothing.",
    },
  ],
  costNote:
    "Most of this is invisible in a standard set of accounts. It shows up as a slightly higher cost of goods sold, never traced back to a specific broken step. The audit is where it gets traced.",
  helpIntro:
    "Finch doesn't take judgement out of purchasing. It reads the paperwork purchasing already produces — the invoice, the delivery note, the price list — and puts the discrepancy in front of the person who can do something about it, the same day it arrives.",
  agents: [
    {
      label: "PRICE WATCH",
      role: "Every line on every supplier invoice, against six months of the same supplier's prices.",
      status: "ROLLING OUT",
    },
    {
      label: "RECON",
      role: "What was invoiced against what actually arrived at the back door, line by line.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DOC-U",
      role: "Reads invoices, delivery notes and statements — including the photographed ones that arrive on WhatsApp.",
      status: "LIVE",
    },
  ],
  modules: [
    { name: "ProcurePulse", role: "Purchasing and stock intelligence" },
    { name: "SupplySync", role: "Supplier records, terms and relationship history" },
    { name: "Doc-U", role: "Supplier-document capture and extraction" },
    { name: "PricePilot", role: "Agreed pricing and margin context" },
  ],
  workflow: [
    {
      title: "The document arrives however it arrives",
      copy: "Emailed PDF, a photograph in the WhatsApp group, a printed delivery note. Doc-U reads all three into the same record.",
    },
    {
      title: "Every line is checked against history",
      copy: "Price Watch compares each line to what that supplier charged you before, and to the rate you agreed with them.",
    },
    {
      title: "The gap is flagged with the evidence",
      copy: "You get the item, the movement, the rand impact at your volumes, and the invoices it was read from — not a number without a source.",
    },
    {
      title: "You decide what happens next",
      copy: "Finch will draft the supplier email. Sending it, renegotiating, or deciding the increase is fair is yours — consequential actions stay under human review.",
    },
  ],
  exampleFinding: {
    agent: "PRICE WATCH",
    observation:
      "Cooking oil is R38 more per 5L than the rate you agreed with Marco's in May.",
    impact: "≈ R3,400/mo at current volumes",
    evidence: "6 invoices",
    meta: "MARCO'S · +11% · MAY–AUG",
    actions: ["Draft supplier email", "Show 6-month trend", "Dismiss"],
  },
  industries: [
    { label: "Food suppliers", href: "/industries/food-suppliers" },
    { label: "Restaurants", href: "/industries/restaurants" },
    { label: "Wholesale", href: "/industries/wholesale" },
    { label: "Catering companies", href: "/industries/catering-companies" },
    { label: "Farms & producers", href: "/industries/farms" },
    { label: "Hospitality", href: "/industries/hospitality" },
  ],
  learnArticles: [
    { label: "The hidden cost of manual procurement", href: "/learn/hidden-cost-of-manual-procurement" },
    {
      label: "Supplier scorecards: what to track and why",
      href: "/learn/supplier-scorecards-what-to-track-and-why",
    },
    {
      label: "Why businesses lose money without realising it",
      href: "/learn/why-businesses-lose-money-without-realising-it",
    },
    { label: "The real cost of poor stock control", href: "/learn/the-real-cost-of-poor-stock-control" },
  ],
  related: ["reduce-money-leakage", "reporting-automation", "operations-dashboard"],
  faqs: [
    {
      question: "Does this mean we lose control over purchasing?",
      answer:
        "The opposite. Finch reads and checks; it doesn't buy. Approval rules, spend limits and sign-off stay yours, and consequential actions stay under human review — an agent drafts the supplier email, you send it.",
    },
    {
      question: "Do our suppliers need to change how they send invoices?",
      answer:
        "No. Doc-U reads the formats suppliers already use — emailed PDFs, printed delivery notes, photographs taken in a WhatsApp group. Document intelligence is the part of Finch that is live today.",
    },
    {
      question: "What if a price increase is legitimate?",
      answer:
        "Most are. The point isn't to fight every increase — it's to know about it the week it happens rather than at year end, and to decide deliberately whether to absorb it, pass it on or renegotiate.",
    },
    {
      question: "How does this start?",
      answer:
        "With the free operations audit: about an hour with you, no obligation. We walk your day with you and tell you what a price and delivery check would have caught — whether you go ahead or not.",
    },
  ],
};

const reportingAutomation: Solution = {
  slug: "reporting-automation",
  name: "Reporting automation",
  shortName: "Reporting automation",
  problemNoun: "reporting built by hand",
  summary:
    "The weekly report builds itself from the work that already happened, and arrives on WhatsApp before you've opened a laptop.",
  title: "Reporting automation for South African SMEs",
  description:
    "Finch builds your weekly operations report from data you already produce and sends it on WhatsApp on Monday. Priced per scope, free audit, South Africa.",
  eyebrow: "WHAT FINCH FIXES · REPORTING",
  heroPlain: "Stop rebuilding the same report",
  heroAccent: "by hand, every single week.",
  lead:
    "By the time a hand-built weekly report reaches you, its numbers are days old and someone spent an evening copying figures between spreadsheets. Finch assembles the brief from work that already happened and sends it on WhatsApp on Monday morning.",
  problem: [
    "Manual reporting is one of the most common places operational time disappears. A manager pulls stock figures from one system, sales from another, waste from a notebook and supplier spend from an inbox, then spends an evening turning it into something leadership can actually read.",
    "The report that results is a snapshot of last week, not this week. Decisions get made on numbers that were already out of date by the time anyone opened the file — and if the person who builds the report is off sick, the report often just doesn't happen at all.",
  ],
  struggles: [
    {
      title: "Numbers live in five different places",
      copy: "Stock, sales, waste and spend sit in separate tools before anyone can pull them into one report.",
    },
    {
      title: "Reports are outdated before they're read",
      copy: "Building the report takes long enough that the numbers inside it have already moved on.",
    },
    {
      title: "One person owns a fragile spreadsheet",
      copy: "A single broken formula, or one person's absence, can mean the report simply doesn't get built that week.",
    },
    {
      title: "Problems surface a week late",
      copy: "By the time an issue reaches a weekly report, it has usually already cost money for several days running.",
    },
  ],
  costIntro:
    "We don't publish an hours-saved figure, because the honest answer depends entirely on who currently builds your report and out of what. The shape of the cost is consistent, though.",
  costShapes: [
    {
      label: "The evening",
      copy: "Someone senior enough to interpret the numbers spends their Thursday night copying them instead.",
    },
    {
      label: "The lag",
      copy: "A problem that started on Monday is read about the following Monday, after a full week of ordering and pricing on the back of it.",
    },
    {
      label: "The single point of failure",
      copy: "One spreadsheet, one author, one set of formulas nobody else fully understands.",
    },
    {
      label: "The questions it can't answer",
      copy: "The report shows the number, not why. Asking why means someone goes digging again, by hand.",
    },
  ],
  costNote:
    "The audit puts real hours and a real rand figure against your own reporting cycle. Until then, we would rather describe the problem accurately than quantify it invented.",
  helpIntro:
    "Finch builds the report out of the workflow itself, as work happens, instead of asking a person to reconstruct it afterwards. The Brief is the weekly output; because it's built on the underlying record, you can ask it a follow-up instead of waiting for someone to go and look.",
  agents: [
    {
      label: "THE BRIEF",
      role: "Monday morning on WhatsApp: the three things that matter, in order, with the evidence attached.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DOC-U",
      role: "Reads the invoices, statements and delivery notes the numbers are built from.",
      status: "LIVE",
    },
    {
      label: "STOCK SENSE",
      role: "Keeps the stock line in the report honest — on hand against what's already on its way.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
  ],
  modules: [
    { name: "InsightGen", role: "Cross-workflow reporting and automated summaries" },
    { name: "Doc-U", role: "Document capture feeding the operating record" },
    { name: "OrderFlow", role: "Connected commercial data behind the numbers" },
    { name: "WasteWatch", role: "Daily waste and shrinkage patterns" },
  ],
  workflow: [
    {
      title: "Data lands as the work happens",
      copy: "Orders, deliveries, stock movements, waste and purchases update the record continuously, not once a week in a batch.",
    },
    {
      title: "The brief assembles itself",
      copy: "What moved, what's unusual, and what needs a decision — ranked, rather than every number the business produced.",
    },
    {
      title: "It arrives where you already are",
      copy: "On WhatsApp, Monday morning. Three things, each with the document or count behind it one tap away.",
    },
    {
      title: "You ask the follow-up",
      copy: "Ask about a specific number instead of asking a person to go and find it. Finch reads authorised data and answers on it.",
    },
  ],
  exampleFinding: {
    agent: "THE BRIEF",
    observation:
      "Margin fell 1.4 points at the Fourways branch last week — mostly cooking oil and tomatoes.",
    impact: "≈ R9,100 on last week's volumes",
    evidence: "sales + purchases",
    meta: "FOURWAYS · WK 31 · −1.4 PTS",
    actions: ["Show the drivers", "Send to WhatsApp", "Dismiss"],
  },
  industries: [
    { label: "Food suppliers", href: "/industries/food-suppliers" },
    { label: "Restaurants", href: "/industries/restaurants" },
    { label: "Wholesale", href: "/industries/wholesale" },
    { label: "Catering companies", href: "/industries/catering-companies" },
    { label: "Farms & producers", href: "/industries/farms" },
    { label: "Hospitality", href: "/industries/hospitality" },
  ],
  learnArticles: [
    { label: "Why weekly reports are usually too late", href: "/learn/why-weekly-reports-are-usually-too-late" },
    {
      label: "How much time can workflow automation save?",
      href: "/learn/how-much-time-can-workflow-automation-save",
    },
    {
      label: "AI for small and medium businesses: practical use cases",
      href: "/learn/ai-for-small-and-medium-businesses-practical-use-cases",
    },
    {
      label: "15 signs your business has operational chaos",
      href: "/learn/15-signs-your-business-has-operational-chaos",
    },
  ],
  related: ["operations-dashboard", "reduce-money-leakage", "procurement-automation"],
  faqs: [
    {
      question: "Will this replace the spreadsheets we report from today?",
      answer:
        "Some of them. Others stay as working tools while Finch handles the summary layer on top. The audit confirms the sensible boundary rather than forcing everything into one system on day one.",
    },
    {
      question: "Can Finch answer questions managers currently dig for?",
      answer:
        "Finch reads authorised data and answers questions about it. Consequential actions stay under human review — it prepares answers and drafts rather than finalising decisions on its own.",
    },
    {
      question: "Do we need clean data before this works?",
      answer:
        "Not perfectly clean. The audit looks at what data exists and how reliable it is, and the roadmap is scoped around what can realistically be reported on first.",
    },
    {
      question: "Why WhatsApp rather than a dashboard?",
      answer:
        "Because a dashboard is something you have to remember to open, and most operators read WhatsApp before they read anything else. The underlying record is still there when you want to go deeper.",
    },
  ],
};

const operationsDashboard: Solution = {
  slug: "operations-dashboard",
  name: "Operations dashboard",
  shortName: "Operations dashboard",
  problemNoun: "a missing single view",
  summary:
    "One view across purchases, stock, debtors and margin — delivered as a brief you read, not a dashboard you must remember to open.",
  title: "Operations dashboard software for SA SMEs",
  description:
    "One view across purchases, stock, debtors and margin for South African SMEs — Finch's brief instead of five spreadsheets. Priced per scope, free audit.",
  eyebrow: "WHAT FINCH FIXES · ONE VIEW",
  heroPlain: "One view of the operation.",
  heroAccent: "Delivered, not looked up.",
  lead:
    "Most owners check five systems to get a partial picture of the business. Finch keeps one connected view across purchases, stock, debtors and margin — and instead of waiting for you to open it, it sends you the part that changed.",
  problem: [
    "Most growing businesses don't lack data — they lack a place to see it together. Purchasing has its own spreadsheet, stock has another, shift schedules live somewhere else, and sales figures come from a separate system entirely. Getting a single view means someone manually stitching all of it together.",
    "That stitching is fragile. It breaks when a format changes, it depends on one person remembering to update it, and it usually only happens once a week — so leadership ends up asking staff for updates instead of simply seeing them.",
  ],
  struggles: [
    {
      title: "Every area has its own version of the truth",
      copy: "Purchasing, stock, labour and sales are tracked separately, with no shared record to compare them against.",
    },
    {
      title: "A combined view means manual copying",
      copy: "Building one picture of the business currently means someone assembling numbers from several sources by hand.",
    },
    {
      title: "Dashboards get built once, then abandoned",
      copy: "A spreadsheet dashboard breaks the first time the underlying data changes shape, and often never gets fixed.",
    },
    {
      title: "Owners end up asking staff for status",
      copy: "Without a live view, you rely on someone remembering to report a problem rather than seeing it directly.",
    },
  ],
  costIntro:
    "There is no honest single number for what a missing view of the business costs — it is mostly opportunity cost. What it looks like is consistent.",
  costShapes: [
    {
      label: "The question you stop asking",
      copy: "\"How are we actually doing this week?\" takes long enough to answer that people stop asking it between month ends.",
    },
    {
      label: "The stale decision",
      copy: "Ordering, pricing and staffing get set against last week's picture because this week's picture doesn't exist yet.",
    },
    {
      label: "The chase",
      copy: "Status arrives because someone was asked for it, which means it arrives late and only about the thing you thought to ask about.",
    },
    {
      label: "The rebuild",
      copy: "Every few months the stitched-together view breaks and somebody spends a day rebuilding it.",
    },
  ],
  costNote:
    "The audit is where this stops being a shape and becomes a number: which decisions were made on stale information last month, and what they cost.",
  helpIntro:
    "Finch doesn't ask each area of the business to report into a shared spreadsheet. Each module records its own activity as work happens, and the agents read across all of it — so the view is a by-product of the work rather than a job somebody has to do.",
  agents: [
    {
      label: "THE BRIEF",
      role: "The dashboard, delivered: what changed across the whole operation, ranked, on WhatsApp.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "STOCK SENSE",
      role: "Stock on hand against the orders already on their way, so a gap is visible before it bites.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "DEBTORS",
      role: "Accounts quietly thinning or slipping past terms, before they become bad debt.",
      status: "FROM YOUR AUDIT ROADMAP",
    },
    {
      label: "PRICE WATCH",
      role: "The purchase side of the margin line, watched invoice by invoice.",
      status: "ROLLING OUT",
    },
  ],
  modules: [
    { name: "InsightGen", role: "Cross-module dashboards and alerts" },
    { name: "OrderFlow", role: "Connected commercial and sales activity" },
    { name: "ProcurePulse", role: "Purchasing and stock intelligence" },
    { name: "ShiftBoard", role: "Staff availability and shift planning" },
  ],
  workflow: [
    {
      title: "Each module records its own activity",
      copy: "Orders, stock, shifts and waste update as the work happens, in the systems the work already happens in.",
    },
    {
      title: "The agents read across all of it",
      copy: "Purchases, stock, debtors and margin are held against each other rather than reviewed one spreadsheet at a time.",
    },
    {
      title: "People see what's theirs",
      copy: "A shift manager sees their section; you see the whole operation. Access is scoped by role, not by who has the file.",
    },
    {
      title: "The change comes to you",
      copy: "What moved arrives as a finding with its evidence, instead of waiting behind a login for someone to go looking.",
    },
  ],
  exampleFinding: {
    agent: "STOCK SENSE",
    observation: "Tomatoes run out Thursday. The next order lands Friday morning.",
    impact: "≈ R7,200 of Thursday's orders at risk",
    evidence: "stock + open orders",
    meta: "TOMATOES · 2 DAYS SHORT · PO 4471",
    actions: ["Bring the order forward", "Show cover days", "Dismiss"],
  },
  industries: [
    { label: "Food suppliers", href: "/industries/food-suppliers" },
    { label: "Restaurants", href: "/industries/restaurants" },
    { label: "Wholesale", href: "/industries/wholesale" },
    { label: "Catering companies", href: "/industries/catering-companies" },
    { label: "Farms & producers", href: "/industries/farms" },
    { label: "Hospitality", href: "/industries/hospitality" },
  ],
  learnArticles: [
    { label: "Why weekly reports are usually too late", href: "/learn/why-weekly-reports-are-usually-too-late" },
    {
      label: "15 signs your business has operational chaos",
      href: "/learn/15-signs-your-business-has-operational-chaos",
    },
    { label: "The real cost of poor stock control", href: "/learn/the-real-cost-of-poor-stock-control" },
    {
      label: "Why businesses lose money without realising it",
      href: "/learn/why-businesses-lose-money-without-realising-it",
    },
  ],
  related: ["reporting-automation", "reduce-money-leakage", "procurement-automation"],
  faqs: [
    {
      question: "Can different roles see different parts of it?",
      answer:
        "Yes. Access is scoped by role, so a shift manager sees what's relevant to their section while you can see the whole operation across locations.",
    },
    {
      question: "Does this replace our existing systems?",
      answer:
        "Not necessarily. It depends on which systems already produce reliable data. The audit determines what Finch reads from directly and what, if anything, is worth moving into a Finch module first.",
    },
    {
      question: "Can we start with one area before expanding?",
      answer:
        "Yes, and most do. Teams usually start where the friction is loudest — normally purchasing or stock — and widen the view as more of the operation is connected.",
    },
    {
      question: "Is it a dashboard or a WhatsApp message?",
      answer:
        "Both, and the message is the point. The connected view exists and you can open it; The Brief is what makes sure you don't have to remember to.",
    },
  ],
};

/* ── Registry ─────────────────────────────────────────────────────────────── */

/** Fixed presentation order: the hub-of-hubs first, then its three spokes. */
export const SOLUTION_ORDER = [
  "reduce-money-leakage",
  "procurement-automation",
  "reporting-automation",
  "operations-dashboard",
] as const;

export const SOLUTIONS: Record<string, Solution> = {
  "reduce-money-leakage": reduceMoneyLeakage,
  "procurement-automation": procurementAutomation,
  "reporting-automation": reportingAutomation,
  "operations-dashboard": operationsDashboard,
};

export const SOLUTION_LIST: readonly Solution[] = SOLUTION_ORDER.map((slug) => SOLUTIONS[slug]);

export function getSolution(slug: string): Solution | undefined {
  return SOLUTIONS[slug];
}

/* ── The hub ──────────────────────────────────────────────────────────────── */

export const HUB = {
  title: "Solutions — what Finch fixes in your operation",
  description:
    "Money leaking, procurement on WhatsApp, reports built by hand, no single view. Four problems Finch fixes for South African operations, from a free audit.",
  eyebrow: "WHAT FINCH FIXES",
  h1Plain: "Fix the problem,",
  h1Accent: "not the symptom.",
  lead:
    "Nobody starts by searching for operations software. They start with a symptom — costs that don't add up, purchasing that runs on WhatsApp, a report someone rebuilds every week. Tick what sounds like your week and see what it points at.",
} as const;

/* ── The symptom checklist ────────────────────────────────────────────────────
   The hub's signature visual. `finding` is the clause the FindingCard types —
   it must read as a complete observation on its own, because with one symptom
   ticked that is the whole sentence. `solutions` are the pages that symptom
   points at, most relevant first.                                             */

export type Symptom = {
  id:        string;
  /** The checkbox label, in the operator's own words. */
  label:     string;
  /** The same thing said back as an observation, for the card. */
  finding:   string;
  solutions: readonly string[];
};

export const SYMPTOMS: readonly Symptom[] = [
  {
    id: "price-increases",
    label: "We only find out about price increases at month end.",
    finding: "Supplier price increases only surface at month end",
    solutions: ["procurement-automation", "reduce-money-leakage"],
  },
  {
    id: "deliveries",
    label: "Deliveries don't always match the invoice.",
    finding: "Deliveries and invoices don't always match",
    solutions: ["procurement-automation", "reduce-money-leakage"],
  },
  {
    id: "whatsapp-purchasing",
    label: "Purchasing runs on WhatsApp and someone's memory of the price.",
    finding: "Purchasing runs on WhatsApp and someone's memory",
    solutions: ["procurement-automation"],
  },
  {
    id: "debtors",
    label: "Debtors slip past terms before anyone chases them.",
    finding: "Debtors slip past terms before anyone chases them",
    solutions: ["operations-dashboard", "reduce-money-leakage"],
  },
  {
    id: "stock-counts",
    label: "Stock counts surprise us.",
    finding: "Stock counts come back with surprises in them",
    solutions: ["reduce-money-leakage", "operations-dashboard"],
  },
  {
    id: "reports-late",
    label: "Reports arrive too late to act on.",
    finding: "Reports arrive too late to act on",
    solutions: ["reporting-automation"],
  },
  {
    id: "report-by-hand",
    label: "Someone rebuilds the same report by hand every week.",
    finding: "The same report is rebuilt by hand every week",
    solutions: ["reporting-automation"],
  },
  {
    id: "five-spreadsheets",
    label: "Answering one question means opening five spreadsheets.",
    finding: "One question means opening five spreadsheets",
    solutions: ["operations-dashboard", "reporting-automation"],
  },
  {
    id: "costs-unexplained",
    label: "Costs are up and nobody can say exactly why.",
    finding: "Costs are up and nobody can say exactly why",
    solutions: ["reduce-money-leakage"],
  },
  {
    id: "status-chasing",
    label: "We ask staff for status instead of seeing it.",
    finding: "Status has to be asked for rather than seen",
    solutions: ["operations-dashboard", "reporting-automation"],
  },
];

/* Copy the checklist's card uses. The impact line is deliberately generic and
   deliberately true: we will not invent a rand figure from ten checkboxes.   */
export const CHECKLIST_COPY = {
  agent:        "SYMPTOM CHECK",
  emptyPrompt:  "Nothing ticked yet. Pick whatever sounds like your week.",
  impact:       "Worth quantifying — that's the audit.",
  emptyActions: "Book your audit",
} as const;

/** `n more sign(s) point the same way` — one place, so the grammar can't drift. */
export function checklistObservation(findings: readonly string[]): string {
  if (findings.length === 0) return CHECKLIST_COPY.emptyPrompt;
  if (findings.length === 1) return `${findings[0]}.`;
  const rest = findings.length - 1;
  return `${findings[0]} — and ${rest} more sign${rest === 1 ? "" : "s"} pointing the same way.`;
}
