/* ── /compare — every word the comparison cluster renders ────────────────────
   The three sub-pages and the hub read from here, and so does their JSON-LD
   (`components/finch/compare/compare-jsonld.ts`), so the schema can never claim
   something the page doesn't say. Same arrangement as
   `components/finch/audit/audit-content.ts`.

   Two of the three comparisons are ports: the tables, the four-step processes
   and the FAQs come from the old `/compare/vyso-vs-erp-systems` and
   `/compare/vyso-vs-spreadsheets` pages, reframed into the Finch language
   (Vyso is the company, Finch is the product) and onto the single offer —
   the old copy's "scoped to the workflow", "add modules once the next need is
   clear" and "high upfront cost" framing predates R6,000 per location per
   month, everything included.

   No number in this file is invented. The salary range carries its publisher,
   its year and its URL; if that cannot be verified the range is `null` and the
   bar renders unlabelled (see `CostBars`).                                    */

export const COMPARE_ORIGIN = "https://vyso.co.za";

/** Finch's price, in rand per location per month. The one number the whole
    cluster is arguing about. */
export const FINCH_MONTHLY = 6000;

export type Crumb = { label: string; href: string };

export type CompareFaq = { id: string; question: string; answer: string };

/** One row of a comparison table. `theirs` is the alternative, `finch` is us. */
export type CompareRow = { criterion: string; theirs: string; finch: string };

export type CompareTableSpec = {
  /** Column headers, left to right. The first is the row-header column. */
  columns: readonly [string, string, string];
  caption: string;
  rows:    readonly CompareRow[];
};

/** A page's single FindingCard. `note` is the provenance line under it — every
    example finding on this site says it is an example. */
export type FindingExample = {
  agent:       string;
  observation: string;
  impact:      string;
  evidence:    string;
  meta:        string;
  actions:     readonly string[];
  /** The sentence beside the card that says why it is on this page. */
  lead:        string;
  note:        string;
};

export type Step = { n: string; label: string; text: string };

/** The shape the two ported comparisons share. `/compare/finch-vs-erp` and
    `/compare/finch-vs-spreadsheets` came from two pages that were already
    structurally identical (strengths → breakdowns → differences → table →
    fit → four steps → FAQs), so they render through one component and differ
    only in this data. The COO page is deliberately NOT this shape — it has the
    day strip, the cost bars and the "hire instead" section. */
export type PortedComparison = {
  slug:      string;
  canonical: string;
  eyebrow:   string;
  h1:        string;
  answer:    string;
  finding:   FindingExample;
  strengths:   { eyebrow: string; title: string; sub: string; items: readonly string[] };
  breakdowns:  {
    eyebrow: string;
    title:   string;
    sub:     string;
    items:   readonly { title: string; text: string }[];
  };
  differences: { eyebrow: string; title: string; sub: string; items: readonly string[] };
  table: CompareTableSpec;
  fit: {
    eyebrow: string;
    title:   string;
    /** When the alternative is still the right answer. */
    theirs:  { label: string; items: readonly string[] };
    ours:    { label: string; items: readonly string[] };
  };
  steps: { eyebrow: string; title: string; items: readonly Step[] };
  faqs:  readonly CompareFaq[];
};

/* ── The hub ─────────────────────────────────────────────────────────────── */

export type HubCard = {
  href:     string;
  eyebrow:  string;
  title:    string;
  /** The one-line verdict on the card. */
  verdict:  string;
  /** The honesty note, rendered in a finding-card frame. */
  notTheAnswer: string;
};

export const HUB = {
  canonical: `${COMPARE_ORIGIN}/compare`,
  eyebrow:   "CHOOSING WELL",
  h1:        "Which is right for your stage?",
  /* ≤ 45 words: the answer to the page's question, before the cards. */
  answer:
    "Three honest comparisons. Finch is R6,000 per location per month and does a COO’s reading, checking and chasing. A COO decides. An ERP records. A spreadsheet holds whatever you last typed. Each of the three is the right answer for someone.",
  cards: [
    {
      href:    "/compare/finch-vs-hiring-a-coo",
      eyebrow: "VS HIRING A COO",
      title:   "Finch vs hiring a COO",
      verdict:
        "A COO decides, negotiates and stands in the room. Finch does the reading, checking and chasing a decision needs — for a fraction of a salary.",
      notTheAnswer:
        "If the real problem is that nobody owns the decisions, software will not fix it. Hire the person.",
    },
    {
      href:    "/compare/finch-vs-erp",
      eyebrow: "VS AN ERP",
      title:   "Finch vs an ERP",
      verdict:
        "An ERP is a system of record. Finch reads records — yours and your suppliers’ — and tells you what changed and what it costs.",
      notTheAnswer:
        "If you need formal, business-wide resource planning across many entities, buy the ERP. Finch is not a smaller one.",
    },
    {
      href:    "/compare/finch-vs-spreadsheets",
      eyebrow: "VS SPREADSHEETS & DIY",
      title:   "Finch vs spreadsheets",
      verdict:
        "Spreadsheets are fine until more than one person needs the same number on the same day — or until nobody notices a price moved.",
      notTheAnswer:
        "One person, one stable process, one sheet: keep the sheet. R6,000 a month would buy you nothing you don’t already have.",
    },
  ] as const satisfies readonly HubCard[],
} as const;

/* ── Salary evidence for the COO comparison ──────────────────────────────────
   The only external number on this cluster. It is filled in from a public
   salary guide, with the publisher, the year and the URL; `monthlyLow` /
   `monthlyHigh` are `null` when nothing could be verified, and `CostBars` then
   draws the bar unlabelled rather than inventing a figure.                    */

export type SalarySource = {
  /** ZAR per month. `null` when nothing could be verified. */
  monthlyLow:  number | null;
  monthlyHigh: number | null;
  /** The mono line under the bar: average and sample size, or "" to omit. */
  detail:      string;
  /** The role exactly as the source names it. */
  role:        string;
  publisher:   string;
  year:        string;
  url:         string;
  /** What the figure is and is not, in plain words, under the citation. */
  workings:    string;
  /** Corroborating sources, linked but not drawn. */
  alsoSee:     readonly { label: string; url: string }[];
};

/* Fetched 2026-08-15 with the `firecrawl` skill. Every figure below is read
   literally off the cited page; nothing is converted, averaged or estimated
   here.

   The plan named Robert Walters SA, PayScale SA and Michael Page SA. Robert
   Walters' Africa salary survey publishes only CEO, CTO and CFO pages for South
   Africa — no COO, no operations manager — and Michael Page's public SA guide
   (2022) has no row for either role and never states its units. PayScale SA
   does carry both roles but publishes **annual** base salary, and these bars
   are per month; converting PayScale's annual figure would be our arithmetic
   presented as their number. Indeed's South African page states a monthly range
   directly, so that is what the bars draw, with PayScale linked beside it. */
export const SALARY: SalarySource = {
  monthlyLow:  13251,
  monthlyHigh: 52519,
  detail:      "AVERAGE R26,381 · 252 REPORTED SALARIES",
  role:        "Operations manager",
  publisher:   "Indeed South Africa",
  year:        "2026",
  url:         "https://za.indeed.com/career/operations-manager/salaries",
  workings:
    "Indeed’s South African page for the role, updated 5 August 2026 from 252 reported salaries: an average of R26,381 a month, typically between R13,251 and R52,519. That is average base salary, not cost to company — add the usual employer costs on top. A full COO sits well above an operations manager: PayScale South Africa puts the average COO base salary at R997,515 a year (2026, 200 profiles).",
  alsoSee: [
    {
      label: "PayScale South Africa — Operations Manager (2026)",
      url:   "https://www.payscale.com/research/ZA/Job=Operations_Manager/Salary",
    },
    {
      label: "PayScale South Africa — Chief Operating Officer (2026)",
      url:   "https://www.payscale.com/research/ZA/Job=Chief_Operating_Officer_(COO)/Salary",
    },
  ],
};

/* ── The COO comparison ──────────────────────────────────────────────────── */

export const COO = {
  slug:      "finch-vs-hiring-a-coo",
  canonical: `${COMPARE_ORIGIN}/compare/finch-vs-hiring-a-coo`,
  eyebrow:   "VS HIRING A COO",
  h1:        "Finch vs hiring a COO.",
  /* The display deck of the ink hero — the line that rides the wave field
     (`.ai/vyso_v3_design.md` §7). It sits *inside* the same `<h1>` as the
     line above it: `h1` is what the page is about and has to keep the query in
     it, `statement` is what the page says. Five words, so it holds at 72px. */
  statement: "A COO’s day. Done by breakfast.",
  /* 41 words. */
  answer:
    "A COO is a person with judgement, relationships and authority. Finch is software that does a COO’s reading, checking and chasing — every invoice, every price, every debtor — and briefs you on WhatsApp for R6,000 per location per month. It doesn’t decide.",

  finding: {
    agent:       "RECON",
    observation: "FreshCo invoiced 40 crates. The delivery note you signed says 36.",
    impact:      "≈ R2,180 short on one delivery",
    evidence:    "invoice + delivery note",
    meta:        "FRESHCO · 14 AUG · 4 CRATES",
    actions:     ["Draft the query", "Show this supplier’s history", "Dismiss"],
    lead:
      "This is the kind of thing a good COO catches by reading every invoice against every delivery note. The catch is the word every.",
    note: "ILLUSTRATIVE — EXAMPLE FINDING",
  } satisfies FindingExample,

  /* The two-track framing around the day strip. */
  day: {
    eyebrow: "A COO’S DAY · WHAT FINCH DOES WITH IT",
    title:   "A COO reads, checks, chases and reports.",
    sub:
      "Finch does the reading, the checking and the chasing, and leaves the deciding to you. Here is one working day: four findings between 06:14 and 11:30, a quiet afternoon, and the three that mattered in one message at 17:55.",
    footnote: "ILLUSTRATIVE — DEMO DATA",
    /* The two tracks, spelled out under the strip. */
    tracks: [
      {
        label: "THE COO",
        text:  "Opens the mail, samples the invoices, phones the supplier about the short delivery, chases two debtors, and writes the report on Friday — if Friday is quiet.",
      },
      {
        label: "FINCH",
        text:  "Reads all of it, every day, and puts the three findings worth acting on into one WhatsApp message at 17:55. The other one it keeps, ranked below the line.",
      },
    ],
  },

  cost: {
    eyebrow: "WHAT EACH ONE COSTS",
    title:   "A salary, or R6,000 per location per month.",
    sub:
      "The honest comparison is not like-for-like — one is a person and one is software. It is still the comparison every owner runs, so here it is with the salary sourced.",
    finchLabel: "Finch",
    finchNote:  "Everything included: every agent on your roadmap, every integration, WhatsApp, support.",
  },

  table: {
    columns: ["What you are buying", "A COO you hire", "Finch"],
    caption:
      "A person and a piece of software, side by side. The rows where the COO wins are the point of the table.",
    rows: [
      {
        criterion: "Judgement on a hard call",
        theirs:    "Yes — that is what the salary is for.",
        finch:     "No. It surfaces the call with the evidence; you make it.",
      },
      {
        criterion: "Relationships with suppliers",
        theirs:    "Yes — walks into the meeting and negotiates.",
        finch:     "No. It drafts the email; you decide whether to send it.",
      },
      {
        criterion: "Presence in the room",
        theirs:    "On the floor, in the huddle, at the bank.",
        finch:     "A message on WhatsApp.",
      },
      {
        criterion: "Hiring, coaching and managing people",
        theirs:    "Yes.",
        finch:     "No. Not now, not later.",
      },
      {
        criterion: "Reading every invoice, every day",
        theirs:    "In practice, a sample — there are only so many hours.",
        finch:     "Every one, every day, including the boring ones.",
      },
      {
        criterion: "Noticing a 3% price move on one line",
        theirs:    "Only if they happen to be looking at that line.",
        finch:     "Compares every line against its own history.",
      },
      {
        criterion: "Hours covered",
        theirs:    "Working hours, minus leave and notice periods.",
        finch:     "Reads as documents arrive; briefs you at 17:55.",
      },
      {
        criterion: "What it costs per month",
        theirs:    "A salary — see the sourced range above.",
        finch:     "R6,000 per location, everything included.",
      },
      {
        criterion: "Time before it is useful",
        theirs:    "A search, a notice period, then learning your business.",
        finch:     "One week: the Operations Audit, R2,000, credited.",
      },
      {
        criterion: "What happens when they leave",
        theirs:    "The institutional memory walks out with them.",
        finch:     "The history stays in the data.",
      },
      {
        criterion: "Getting your team to change how they work",
        theirs:    "Yes — in person, which is usually what it takes.",
        finch:     "No. That part is still you.",
      },
    ],
  } satisfies CompareTableSpec,

  hireInstead: {
    eyebrow: "THE HONEST SECTION",
    title:   "When you should hire a COO instead.",
    sub:
      "Finch is not a cheaper COO. It is a different thing that overlaps with part of the job. These are the cases where the person is the answer and we will say so.",
    cases: [
      "You need someone to own decisions, not surface them. If every call still lands on you, more visibility makes the pile taller, not shorter.",
      "The problem is people: hiring, coaching, performance, someone leaving. That is a job for a person with authority.",
      "The problem is structure or accountability — nobody knows who owns what. Software makes a fuzzy structure fuzzier, faster.",
      "You need someone in the room with a bank, a landlord, a big customer or a regulator. Finch cannot be in a room.",
      "You are big enough that a salary is small next to the decisions it improves. At that size the question stops being either/or.",
    ],
    both:
      "Plenty of operations need both. Finch is cheap enough to sit under a COO and do their reading for them — most of the founding conversations we have are with owners who are doing the COO job themselves and want the reading off their desk.",
  },

  faqs: [
    {
      id: "is-finch-a-replacement-for-a-coo",
      question: "Is Finch a replacement for hiring a COO?",
      answer:
        "No. A COO brings judgement, relationships, authority and presence — Finch has none of those. What Finch replaces is the part of the job that is reading: every invoice, price, delivery note, statement and debtor day, every day, with the evidence attached to whatever it flags.",
    },
    {
      id: "how-much-does-a-coo-cost-in-south-africa",
      question: "How much does a COO or operations manager cost in South Africa?",
      answer:
        "Indeed South Africa puts an operations manager at an average of R26,381 a month in 2026, typically between R13,251 and R52,519 — average base salary, before employer costs. A full COO sits well above that: PayScale South Africa gives an average base salary of R997,515 a year. Both are linked on this page so you can check them against your own market.",
    },
    {
      id: "can-finch-work-alongside-a-coo",
      question: "Can Finch work alongside a COO or operations manager we already have?",
      answer:
        "Yes, and that is the common case. Finch does the reading and the chasing, and the person spends their week on the decisions and the relationships instead of on a stack of invoices. The brief goes to whoever should be acting on it.",
    },
    {
      id: "what-does-finch-do-on-its-own",
      question: "What does Finch actually do on its own?",
      answer:
        "It reads documents as they arrive, compares them to history and to each other, ranks what it finds by what it costs you in rand, and sends the findings worth acting on to WhatsApp. It does not send supplier emails, approve payments or change prices without you.",
    },
  ] satisfies readonly CompareFaq[],
} as const;

/* ── The ERP comparison (ported from /compare/vyso-vs-erp-systems) ────────── */

export const ERP = {
  slug:      "finch-vs-erp",
  canonical: `${COMPARE_ORIGIN}/compare/finch-vs-erp`,
  eyebrow:   "VS AN ERP",
  h1:        "Finch vs an ERP.",
  /* 44 words. */
  answer:
    "An ERP is a system of record: it stores what your business does, across departments, once everyone puts it in. Finch is a reader: it watches the documents you already receive and tells you what changed and what it costs. Different jobs, often both.",

  finding: {
    agent:       "PRICE WATCH",
    observation: "Every one of the 14 invoices went into the system correctly. None of them said cooking oil moved from R289 to R327 a case.",
    impact:      "≈ R11,400/yr at current volumes",
    evidence:    "14 invoices",
    meta:        "MAY–AUG · +13% · ONE LINE",
    actions:     ["Show the 6-month trend", "Draft supplier email", "Dismiss"],
    lead:
      "What Finch would have caught that the ERP didn’t. The ERP was not wrong — recording is its job, and it recorded. Nothing was watching the line.",
    note: "ILLUSTRATIVE — EXAMPLE FINDING",
  } satisfies FindingExample,

  strengths: {
    eyebrow: "WHERE AN ERP GENUINELY FITS",
    title:   "A serious tool for a serious scope.",
    sub:     "For the right organisation an enterprise ERP is the correct category, not a fallback.",
    items: [
      "Organisations that genuinely need broad, formal resource planning across many departments.",
      "One system of record for a large or complex business with the internal capacity to run a multi-module programme.",
      "Standardising process across multiple entities, sites or business units at once.",
      "When the requirement is a business-wide platform, not a single operational fix.",
    ],
  },

  breakdowns: {
    eyebrow: "WHERE IT IS SLOW FOR A GROWING SME",
    title:   "The size of the programme becomes the problem.",
    sub:
      "This is not a knock against ERP as a category. It is what happens when a business-wide programme meets a business that needed one thing watched.",
    items: [
      {
        title: "Go-live is measured in months, not weeks",
        text:  "Scoping, configuring and testing many modules before the business sees any value at all.",
      },
      {
        title: "It usually assumes business-wide adoption on day one",
        text:  "Even where one workflow is causing the pain, many ERP programmes are structured around replacing everything at once.",
      },
      {
        title: "It expects internal project capacity",
        text:  "A dedicated project team, IT resourcing and change management are assumed — capacity a growing SME rarely has spare.",
      },
      {
        title: "It records; it does not watch",
        text:  "An ERP will hold every invoice line you enter. Noticing that one of those lines has crept up 13% since May is still a person’s job.",
      },
    ],
  },

  differences: {
    eyebrow: "HOW FINCH IS DIFFERENT",
    title:   "Not a smaller ERP. A different job.",
    sub:
      "Finch does not ask you to move your operation into it. It connects to what you already run, reads what arrives, and tells you what it found.",
    items: [
      "Connects to the tools you already use — no migration, nothing to move first.",
      "Reads the documents that already exist: invoices, statements, delivery notes, stock sheets.",
      "Every finding carries a rand figure and the evidence behind it.",
      "One offer, R6,000 per location per month — the agents you need are switched on from your audit roadmap, at the same price.",
    ],
  },

  table: {
    columns: ["What matters", "A traditional ERP", "Finch"],
    caption:
      "A general comparison. Specific ERP products and implementations vary widely.",
    rows: [
      {
        criterion: "What it is for",
        theirs:    "Holding the record of what the business did.",
        finch:     "Reading the record and flagging what changed.",
      },
      {
        criterion: "Time to first value",
        theirs:    "Often months of configuration before go-live.",
        finch:     "One week: the audit gives you the leak report before you sign anything.",
      },
      {
        criterion: "Starting scope",
        theirs:    "Frequently business-wide from the outset.",
        finch:     "The documents you already receive; nothing to migrate.",
      },
      {
        criterion: "Internal capacity needed",
        theirs:    "A dedicated project team and IT resourcing assumed.",
        finch:     "Connected during onboarding by Vyso; minimal internal lift.",
      },
      {
        criterion: "What it costs",
        theirs:    "Licensing, consulting and configuration, quoted per programme.",
        finch:     "R6,000 per location per month, everything included.",
      },
      {
        criterion: "Fit to your process",
        theirs:    "Powerful, but changing it is a customisation project.",
        finch:     "Configured around how you already work, in the audit week.",
      },
      {
        criterion: "Best-fit business",
        theirs:    "Large, complex or multi-entity organisations.",
        finch:     "SMEs where the owner is still the one reading the invoices.",
      },
      {
        criterion: "Adding more later",
        theirs:    "Change requests and new project phases.",
        finch:     "More agents off your audit roadmap — same price.",
      },
      {
        criterion: "Who you deal with",
        theirs:    "Support contracts and ticket queues.",
        finch:     "Vyso, in Johannesburg, on WhatsApp.",
      },
    ],
  } satisfies CompareTableSpec,

  fit: {
    eyebrow: "BEST-FIT SCENARIOS",
    title:   "Match the tool to the scope of the problem.",
    theirs: {
      label: "Still buy the ERP when",
      items: [
        "You need formal, business-wide resource planning across departments.",
        "You have the internal team and the timeline for a multi-module programme.",
        "Standardising process across several entities or sites is the actual goal.",
      ],
    },
    ours: {
      label: "Finch is the better first step when",
      items: [
        "Money is leaking somewhere in purchasing, stock or debtors and nobody has the hours to find it.",
        "You have no project team and no appetite for a rollout.",
        "You want the leak quantified in rand before you commit to anything at all.",
      ],
    },
  },

  steps: {
    eyebrow: "HOW TO START SMALLER THAN AN ERP PROGRAMME",
    title:   "No rip-and-replace required.",
    items: [
      {
        n: "01",
        label: "AUDIT",
        text: "One week. We read a week of your invoices, statements and stock sheets and quantify what is leaking, with the evidence.",
      },
      {
        n: "02",
        label: "CONNECT",
        text: "Your existing tools are connected during onboarding — Xero, WhatsApp, whatever the documents already flow through. Nothing is migrated.",
      },
      {
        n: "03",
        label: "SWITCH ON",
        text: "The agents the audit put at the top of the roadmap start reading. You get the first brief in the first week.",
      },
      {
        n: "04",
        label: "EXPAND",
        text: "More agents come off the roadmap as they earn their place. The price does not change.",
      },
    ] satisfies readonly Step[],
  },

  faqs: [
    {
      id: "is-finch-replacing-erp",
      question: "Is Finch trying to replace enterprise ERP systems?",
      answer:
        "No. An organisation that genuinely needs broad, formal resource planning across many departments is better served by an ERP and the internal capacity to run that programme. Finch reads what your business already produces and tells you what it found — it is not a system of record.",
    },
    {
      id: "can-finch-run-alongside-our-erp",
      question: "Can Finch run alongside an ERP we already have?",
      answer:
        "Yes, and that is the usual case. The ERP keeps holding the record; Finch reads the documents that flow in and out of it and flags price moves, short deliveries and debtors slipping past terms. The connections are set up during onboarding.",
    },
    {
      id: "do-we-need-a-project-team",
      question: "Do we need an internal project team to implement Finch?",
      answer:
        "No. Onboarding is hands-on: Vyso connects your tools, sets up the agents from your audit roadmap and stays involved afterwards. There is no dedicated project team, no IT resourcing assumption and nothing to migrate first.",
    },
    {
      id: "how-do-we-know-we-need-an-erp",
      question: "How do we know if we need an ERP instead of Finch?",
      answer:
        "If the requirement is a formal, business-wide resource-planning programme across many departments and entities, an ERP is the right category and we will say so. If the problem is that money is leaking and nobody has the hours to find it, that is what Finch is for.",
    },
  ] satisfies readonly CompareFaq[],
} as const;

/* ── The spreadsheets comparison (ported from /compare/vyso-vs-spreadsheets) ─ */

export const SPREADSHEETS = {
  slug:      "finch-vs-spreadsheets",
  canonical: `${COMPARE_ORIGIN}/compare/finch-vs-spreadsheets`,
  eyebrow:   "VS SPREADSHEETS & DIY",
  h1:        "Finch vs spreadsheets.",
  /* 43 words. */
  answer:
    "A spreadsheet holds whatever was last typed into it, by whoever last opened it. Finch reads the source documents instead — invoices, statements, delivery notes — and tells you what changed. Spreadsheets are genuinely the right tool right up until they aren’t.",

  finding: {
    agent:       "RECON",
    observation: "Line 214 of the purchase sheet was typed as 4,400. The supplier invoice for that line says 440.",
    impact:      "≈ R3,960 overstated in this month’s cost",
    evidence:    "purchase sheet + invoice",
    meta:        "AUG · LINE 214 · ONE DIGIT",
    actions:     ["Show the invoice", "Recheck the month", "Dismiss"],
    lead:
      "What Finch would have caught that the spreadsheet didn’t. The sheet added up perfectly. Nothing in it knew what the invoice said.",
    note: "ILLUSTRATIVE — EXAMPLE FINDING",
  } satisfies FindingExample,

  strengths: {
    eyebrow: "WHERE SPREADSHEETS GENUINELY WIN",
    title:   "Free, instant and yours.",
    sub:     "Nobody should be talked out of a spreadsheet that is working.",
    items: [
      "Free, familiar and instant to start — no procurement, no waiting on anyone.",
      "Flexible enough for one-off analysis, a quick calculation or one person’s private tracking.",
      "No vendor, no support contract, no dependency on anyone else’s uptime.",
      "Genuinely the right tool when the process is small, stable and used by one or two people.",
    ],
  },

  breakdowns: {
    eyebrow: "WHERE THEY QUIETLY BREAK DOWN",
    title:   "The sheet is only ever as current as the last person to open it.",
    sub:
      "None of these are arguments against spreadsheets. They are what happens when a growing team runs an operation out of one.",
    items: [
      {
        title: "Version conflicts multiply",
        text:  "Once more than one person edits the same workbook, copies fork, formulas break, and nobody is sure which tab is current.",
      },
      {
        title: "Visibility waits for someone to update it",
        text:  "You see what is happening when someone stops, updates, saves and sends — which is usually after the thing has happened.",
      },
      {
        title: "The same number gets retyped everywhere",
        text:  "A quote becomes an order, an order becomes an invoice, and every step is a fresh chance for a digit to move.",
      },
      {
        title: "Nothing in the sheet is watching the sheet",
        text:  "A spreadsheet will happily hold a price that has crept up 13% since May. It has no opinion about it.",
      },
    ],
  },

  differences: {
    eyebrow: "WHAT CHANGES WITH FINCH",
    title:   "Read the source, not the retyping.",
    sub:
      "Finch does not ask you to abandon your sheets. It reads the documents those sheets were built from, and checks the two against each other.",
    items: [
      "The invoice, statement and delivery note are read directly — no one retypes them.",
      "Every finding compares a document to history or to another document, and shows both.",
      "Findings arrive on WhatsApp when they are found, not when someone remembers to send the file.",
      "Keep the sheets you like. Most businesses do; the audit says which ones are worth leaving alone.",
    ],
  },

  table: {
    columns: ["What matters", "Spreadsheets", "Finch"],
    caption:
      "Spreadsheets are the baseline almost every SME starts from — this is where the two diverge.",
    rows: [
      {
        criterion: "One person tracking a simple process",
        theirs:    "Works well. Keep it.",
        finch:     "Overkill at this size, honestly.",
      },
      {
        criterion: "Several people updating the same data",
        theirs:    "Version conflicts and overwritten cells.",
        finch:     "Reads the source documents, so there is one version of the number.",
      },
      {
        criterion: "Knowing a supplier price moved",
        theirs:    "Only if someone compares this month to last month by hand.",
        finch:     "Compares every line against its own history, every time.",
      },
      {
        criterion: "Catching a typo",
        theirs:    "The sheet adds up either way.",
        finch:     "The invoice is the check — a retyped digit shows up as a mismatch.",
      },
      {
        criterion: "Linking orders, invoices and payments",
        theirs:    "Retyped across separate sheets or tabs.",
        finch:     "Matched document to document, with both shown.",
      },
      {
        criterion: "Visibility for the owner",
        theirs:    "When someone opens and shares the file.",
        finch:     "One WhatsApp message with the findings worth acting on.",
      },
      {
        criterion: "Knowing who changed what, and when",
        theirs:    "Limited or no history.",
        finch:     "Every finding keeps the documents it was drawn from.",
      },
      {
        criterion: "Scaling past one location",
        theirs:    "Tends to fork into many versions.",
        finch:     "R6,000 per location per month; each location reads its own documents.",
      },
      {
        criterion: "Effort and cost to start",
        theirs:    "Free and instant.",
        finch:     "A one-week audit at R2,000, credited to your first month.",
      },
    ],
  } satisfies CompareTableSpec,

  fit: {
    eyebrow: "BEST-FIT SCENARIOS",
    title:   "Know which side of the line you are on.",
    theirs: {
      label: "Stay on spreadsheets when",
      items: [
        "One or two people run the process and it is stable.",
        "The numbers are checked by the same person who typed them, the same week.",
        "Nothing downstream breaks when the sheet is a few days out of date.",
      ],
    },
    ours: {
      label: "Finch earns its place when",
      items: [
        "More than one person needs the same number on the same day.",
        "You only find out about a price increase when the month-end numbers look wrong.",
        "Somebody is retyping invoice lines, and everybody knows it.",
      ],
    },
  },

  steps: {
    eyebrow: "HOW THE MOVE ACTUALLY GOES",
    title:   "Nothing gets deleted.",
    items: [
      {
        n: "01",
        label: "MAP",
        text: "The audit reads the sheets you actually use, and what each one is really doing for the business.",
      },
      {
        n: "02",
        label: "DECIDE",
        text: "Not every sheet needs to go. We agree which reading is worth handing over and which sheets stay exactly where they are.",
      },
      {
        n: "03",
        label: "CONNECT",
        text: "The documents behind those sheets — invoices, statements, stock counts — are connected during onboarding.",
      },
      {
        n: "04",
        label: "RUN BOTH",
        text: "Keep the sheet for as long as you want the comfort of it. The brief starts arriving in the first week either way.",
      },
    ] satisfies readonly Step[],
  },

  faqs: [
    {
      id: "are-spreadsheets-bad",
      question: "Is Finch saying spreadsheets are bad?",
      answer:
        "No. Spreadsheets are genuinely useful, especially for small, stable processes run by one or two people. The comparison is about what happens once a process is shared across a growing team and starts feeding decisions that cost real money.",
    },
    {
      id: "can-we-keep-our-spreadsheets",
      question: "Can we keep using spreadsheets alongside Finch?",
      answer:
        "Yes, and most businesses do. Finch reads the source documents rather than your sheets, so the two do not fight. The audit is where we agree which sheets are worth leaving exactly as they are.",
    },
    {
      id: "will-our-team-learn-a-new-system",
      question: "Will our team have to learn a whole new system?",
      answer:
        "There is less to learn than you would expect: the findings arrive on WhatsApp, which your team already uses. Vyso connects the tools and sets the agents up during onboarding rather than handing you a manual.",
    },
    {
      id: "our-process-is-specific",
      question: "What if our process is quite specific to our business?",
      answer:
        "That is normal, and it is what the one-week Operations Audit is for. It reads the process as it actually runs today — your suppliers, your units, your prices — before anything is configured.",
    },
  ] satisfies readonly CompareFaq[],
} as const;
