/* ── Learn content ───────────────────────────────────────────────────────────
   The eight articles behind `/learn` and `/learn/[slug]`.

   Phase 3 (workstream D) reframed this file rather than rewriting it. What
   changed and — more importantly — what deliberately did not:

   - **Claims are untouched.** Every figure, range and sentence of analysis is
     what it was, with one exception: the old tiered-pricing paragraph in
     `how-much-time-can-workflow-automation-save`, which described a package
     that no longer exists (`.ai/vyso_v2.md` §0 — the site sells one offer
     now). It is rewritten to the single offer, and it is the only body text
     whose meaning moved.
   - **Vyso → Finch** where the sentence is about the product doing the
     watching. Vyso is the company; Finch is the thing that reads the invoice.
     Section headings became "How Finch helps"; the prose under them follows.
   - **`author`** is the founder from `lib/marketing/site.ts`, replacing the
     "Vyso Team" byline. Vyso is a one-person company at this stage (see
     `.ai/vyso_v2.md` §2.3 — "Founder (Josh Moreira, Johannesburg)"), so the
     named byline is the more honest of the two, and E-E-A-T wants a person
     (§7.4).
   - **Dates** are derived, not invented. `datePublished` is the per-article
     date this file already carried. `dateModified` is `LEARN_LAST_MODIFIED`
     below — the file's only commit date, read from git. See its comment.
   - **`sources`** is present only on the four articles whose own text states
     where a range came from. None of the eight cites an external study, so
     none gets an external citation here; inventing one would be the exact
     failure the honesty rules exist to prevent.
   - **`agents`**, `endFinding` and `keyTerms` are new presentation data (the
     related-agent rows, the closing finding card, the glossary links §7.5
     asks every article to carry). They add no claim the site doesn't already
     make: agent labels and statuses are copied from
     `components/finch/agents/agents-data.ts` verbatim.                        */

import { SITE } from "@/lib/marketing/site";

/** The byline on every article, and the `Person` in each `Article` schema. */
export const ARTICLE_AUTHOR = SITE.founder.name;

/* Derived, not chosen. `lib/marketing/learn-articles.ts` has exactly one
   commit in this repo:

       $ git log --follow --format=%aI -- lib/marketing/learn-articles.ts
       2026-08-03T15:52:11+02:00

   — so there is no per-article modification history to read, and the plan's
   fallback applies: the file's single commit date stands as `dateModified`
   for all eight. It is deliberately NOT today's date: this phase's edits are
   uncommitted, and a `dateModified` that runs ahead of the repository would be
   a claim git cannot support.

   TODO(user): bump this when the file is next committed. */
export const LEARN_LAST_MODIFIED = "2026-08-03";

export const LEARN_CATEGORIES = [
  "Operations",
  "Automation",
  "Procurement",
  "Reporting",
  "Inventory",
  "AI in Business",
] as const;

export type LearnCategory = (typeof LEARN_CATEGORIES)[number];

export type ArticleSection = {
  heading: string;
  body: readonly string[];
  list?: readonly string[];
};

/** One row of the article's "related agents" block. Label and status are
    copied from `components/finch/agents/agents-data.ts` — the roster the
    `/#agents` anchor these rows link to actually renders. */
export type ArticleAgent = {
  label: string;
  status: "ROLLING OUT" | "FROM YOUR AUDIT ROADMAP";
  /** What this agent does *for the problem this article describes*. */
  role: string;
};

/** Where a figure in the article came from. Only used where the article's own
    body names its basis; there is no external citation on any of the eight, so
    there is no `href` on this type yet — adding one when a real source exists
    is the additive change, inventing one now is not. */
export type ArticleSource = {
  label: string;
  basis: string;
};

/** The closing finding card. Rand figures in these are worked examples and
    every render captions them `ILLUSTRATIVE EXAMPLE`, exactly as `/solutions`
    and the homepage hero do. */
export type ArticleFinding = {
  agent: string;
  observation: string;
  impact: string;
  evidence: string;
  meta: string;
  actions: readonly string[];
};

export type LearnArticle = {
  slug: string;
  title: string;
  category: LearnCategory;
  description: string;
  author: string;
  /** ISO date. Carried over from this file's original `publishedDate`. */
  datePublished: string;
  /** ISO date. `LEARN_LAST_MODIFIED` for all eight — see its comment. */
  dateModified: string;
  readingTime: string;
  heroLead: string;
  /** What the `Article` schema's `about` names — the subject, in plain words. */
  about: string;
  sections: readonly ArticleSection[];
  agents: readonly ArticleAgent[];
  endFinding: ArticleFinding;
  /** Glossary slugs. §7.5: every article links to at least one term. */
  keyTerms: readonly string[];
  sources?: readonly ArticleSource[];
  relatedArticleSlugs: readonly string[];
  relatedSolutionHrefs: readonly string[];
  relatedIndustryHrefs: readonly string[];
};

export const LEARN_ARTICLES: readonly LearnArticle[] = [
  {
    slug: "why-businesses-lose-money-without-realising-it",
    title: "Why Businesses Lose Money Without Realising It",
    category: "Operations",
    description:
      "Most South African SMEs are not losing money in one dramatic event. They are losing it in small, repeated, invisible ways across procurement, stock and admin. Here is where to look first.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-06",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "7 min read",
    heroLead:
      "Owners rarely discover money leakage from a single bad decision. They discover it eighteen months later, when the bank balance does not match the story the business has been telling itself.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "Every operational business leaks a little money every week. Not through fraud, and not usually through one bad decision — through dozens of small gaps that never get added up. A supplier invoice that is R180 higher than the quote and nobody checks. Two staff members buying the same stock item because neither knew the other had already ordered it. A price increase from a supplier that quietly erodes margin for three months before anyone notices.",
          "None of these show up as a single line item marked \"loss.\" They show up as a business that works hard, grows revenue, and somehow never has the cash position that growth should produce. By the time an owner sits down to ask why, the leakage has usually been happening for a year or more.",
        ],
      },
      {
        heading: "Why this happens",
        body: [
          "Money leakage is almost always a visibility problem, not a discipline problem. Most South African SMEs run their operations across a mix of WhatsApp groups, paper delivery notes, spreadsheets that only one person understands, and whatever the accounting package happens to capture at month-end. Each of those tools works fine in isolation. None of them talk to each other.",
          "Because no single system holds the full picture, nobody in the business — not the owner, not the ops manager — can see procurement, stock movement, pricing and cash flow at the same time. Small errors that would be obvious in a connected system stay invisible in a fragmented one. The bigger the business gets, the more places there are for money to quietly slip through the gaps between tools.",
        ],
      },
      {
        heading: "What it's costing you",
        body: [
          "The number varies by business, but the pattern does not. In our conversations with South African operators, unmonitored leakage across procurement, stock variance and duplicated admin routinely runs between 2% and 8% of monthly revenue. For a business turning over R500,000 a month, that is R10,000 to R40,000 disappearing every month without a single dramatic cause — just accumulated small gaps.",
          "The compounding cost is worse than the direct cost. Owners who cannot see where money is leaking make pricing and hiring decisions on a distorted picture of profitability. Growth gets funded by margin that was never really there, which is how healthy-looking businesses end up with cash flow problems they cannot explain.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        body: [
          "You do not need new software to start closing the gap. Start with visibility, then decide what needs automating.",
        ],
        list: [
          "Pick one week and reconcile every supplier invoice against the original quote or price list — not the PO, the original agreed price.",
          "Ask two people who touch procurement to independently list what they ordered last week, then compare. Overlaps and gaps both matter.",
          "Track wastage or stock write-offs for two weeks in a simple shared log, even if it is just a spreadsheet. Most businesses underestimate this figure by half.",
          "Look at the last three months of supplier pricing for your top five inputs. Quiet increases are easy to miss line by line and obvious once compared side by side.",
          "Time how long it takes your team to produce a weekly ops report. If it is more than an hour, that hour is itself a cost worth counting.",
        ],
      },
      {
        heading: "How Finch helps",
        body: [
          "Finch exists specifically to close this visibility gap. Rather than replacing every tool your team already uses, Finch connects procurement, stock, supplier records and reporting into one operating picture, so the small gaps that hide in disconnected systems become visible in a connected one.",
          "InsightGen surfaces the patterns — a supplier whose pricing has crept up, a stock line with abnormal variance, a workflow generating repeated manual corrections — before they cost another quarter of margin. ProcurePulse keeps purchasing and stock intelligence in one place so duplicated or uncontrolled buying is caught at the point of order rather than discovered at month-end. For businesses ready to see their full leakage picture, our dedicated solution page on reducing money leakage walks through exactly how this works in practice.",
        ],
      },
    ],
    about: "Money leakage in South African SMEs",
    agents: [
      {
        label: "PRICE WATCH",
        status: "ROLLING OUT",
        role: "Compares every supplier price against six months of your own invoices, so a quiet increase is caught on the invoice it starts on.",
      },
      {
        label: "RECON",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Matches what was invoiced against what actually arrived, line by line, so short deliveries stop being paid for.",
      },
      {
        label: "THE BRIEF",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Puts the week's leaks in front of you on a Monday instead of leaving them to a year-end conversation.",
      },
    ],
    endFinding: {
      agent: "PRICE WATCH",
      observation: "Cooking oil up 9% at your main supplier since May — three invoices, no notification.",
      impact: "\u2248 R3,100/yr at current volumes",
      evidence: "3 invoices",
      meta: "SUPPLIER \u00b7 +9% \u00b7 MAY\u2013AUG",
      actions: ["Draft supplier email", "Show 6-month trend", "Dismiss"],
    },
    keyTerms: ["money-leakage", "price-creep", "operations-audit"],
    sources: [
      {
        label: "Vyso's own conversations with South African operators",
        basis:
          "First-party, and the article says so in the sentence the range appears in. These are patterns seen in operator conversations, not a measured statistic from a published study.",
      },
    ],
    relatedArticleSlugs: [
      "hidden-cost-of-manual-procurement",
      "the-real-cost-of-poor-stock-control",
      "why-weekly-reports-are-usually-too-late",
    ],
    relatedSolutionHrefs: ["/solutions/reduce-money-leakage", "/solutions/reporting-automation"],
    relatedIndustryHrefs: ["/industries/restaurants", "/industries/wholesale"],
  },
  {
    slug: "15-signs-your-business-has-operational-chaos",
    title: "15 Signs Your Business Has Operational Chaos",
    category: "Operations",
    description:
      "Operational chaos rarely announces itself. It shows up as small, familiar frustrations that owners learn to live with. Here are 15 signs worth taking seriously.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-08",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "6 min read",
    heroLead:
      "Most operators do not describe their business as chaotic. They describe it as \"just how it is\" — which is usually the first sign that chaos has become the default operating state.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "Operational chaos is not one big failure. It is a collection of small, familiar frictions that a team has quietly normalised: the manager who is the only person who knows how the ordering process really works, the report that takes half a Sunday to compile, the WhatsApp thread that is technically the supplier order system. Individually, each one feels manageable. Together, they define how much of the business's energy goes into just keeping the lights on rather than growing.",
        ],
      },
      {
        heading: "Why this happens",
        body: [
          "Chaos accumulates gradually, which is exactly why it is hard to see from inside the business. A process that was reasonable at five staff members becomes unworkable at twenty, but nobody redesigns it — they just add another person to manage the exceptions. Growth outpaces the systems supporting it, and the gap gets filled with manual effort, tribal knowledge and good will, none of which scale.",
        ],
      },
      {
        heading: "The 15 signs",
        body: [
          "If more than a handful of these feel familiar, it is worth treating operational visibility as a priority rather than a nice-to-have.",
        ],
        list: [
          "One person is the only one who understands how a critical process actually works.",
          "Weekly reports take hours to compile and are out of date by the time they are read.",
          "Stock counts routinely do not match what the system — or the spreadsheet — says should be there.",
          "Supplier orders are placed from memory or habit rather than from a checked reorder point.",
          "Staff use WhatsApp for approvals, purchase requests or handovers that should be traceable.",
          "The owner finds out about a problem from a customer before hearing it from the team.",
          "Two people can independently place the same order without either knowing.",
          "Pricing decisions are made without a clear view of current input costs.",
          "New staff take weeks to learn processes that live only in someone's head.",
          "Invoices are checked against memory rather than against the original quote or PO.",
          "Nobody can say, without checking three different places, what the business is owed and what it owes.",
          "Wastage is estimated rather than measured.",
          "Reports get built freshly by hand every week instead of being generated from live data.",
          "Approvals happen informally, so nobody can reconstruct who agreed to what and when.",
          "The management team spends more time firefighting than reviewing performance.",
        ],
      },
      {
        heading: "What it's costing you",
        body: [
          "Operational chaos has a direct cost in wasted hours and duplicated work, and an indirect cost that is often larger: decisions made on incomplete or outdated information. A manager reordering stock without visibility of what is already committed, or a leadership team pricing a product without current cost data, is not making a bad decision — they are making the only decision available to them given what they can see. Businesses in this position frequently report losing 10 to 15 hours a week across the team to admin that a connected system would remove entirely.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        list: [
          "List every process that currently depends on one person's memory, and write down the steps while they are available to explain it.",
          "Time how long your weekly or monthly report actually takes to produce, start to finish.",
          "Identify the three approvals most often handled over WhatsApp, and note how each one should ideally be tracked.",
          "Run a spot stock count against your records for your five highest-value items.",
        ],
        body: [],
      },
      {
        heading: "How Finch helps",
        body: [
          "Finch is built around exactly this pattern: growing businesses that have outgrown spreadsheets, WhatsApp and paper, but are not ready for — or do not need — a full enterprise system. The one-week Operations Audit maps where chaos is concentrated in your business specifically, rather than assuming every business has the same gaps. From there, modules like ShiftBoard, ProcurePulse and InsightGen give the team one place to plan, track and report, instead of five disconnected ones.",
          "Our operations dashboard solution page shows what a single, connected operating view actually looks like once the chaos has been mapped and addressed.",
        ],
      },
    ],
    about: "Operational chaos in growing SMEs",
    agents: [
      {
        label: "THE BRIEF",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Replaces the report someone rebuilds by hand every Friday with the same numbers, in the same order, every Monday.",
      },
      {
        label: "STOCK SENSE",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Holds stock on hand against orders already on their way, so two people cannot order the same thing twice.",
      },
      {
        label: "RECON",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Turns invoice checking from a memory exercise into a documented match against the order and the delivery note.",
      },
    ],
    endFinding: {
      agent: "THE BRIEF",
      observation: "Monday\u2019s report took four hours to compile and was six days old by the time it was read.",
      impact: "\u2248 R5,200/month in admin hours",
      evidence: "4 weeks of reports",
      meta: "REPORTING \u00b7 4H/WEEK \u00b7 JUL\u2013AUG",
      actions: ["Show what a brief replaces", "Book your audit", "Dismiss"],
    },
    keyTerms: ["weekly-brief", "operations-audit", "money-leakage"],
    relatedArticleSlugs: [
      "why-businesses-lose-money-without-realising-it",
      "why-weekly-reports-are-usually-too-late",
      "how-much-time-can-workflow-automation-save",
    ],
    relatedSolutionHrefs: ["/solutions/operations-dashboard", "/solutions/reduce-money-leakage"],
    relatedIndustryHrefs: ["/industries/hospitality", "/industries/catering-companies"],
  },
  {
    slug: "how-much-time-can-workflow-automation-save",
    title: "How Much Time Can Workflow Automation Save?",
    category: "Automation",
    description:
      "A realistic look at how many hours a week South African SMEs spend on repeatable admin, and what actually happens to that time once workflows are automated.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-10",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "6 min read",
    heroLead:
      "\"How much time will automation actually save us?\" is usually the second question owners ask, right after \"is this going to be worth it?\" Both deserve a specific, honest answer.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "A meaningful share of the working week at most SMEs goes to tasks that are repeatable, rules-based and require no real judgement — retyping an order into a second system, chasing a supplier for a delivery date, manually compiling a report from three spreadsheets. None of this work is difficult. All of it is time-consuming, and it crowds out the judgement-based work that actually grows the business.",
        ],
      },
      {
        heading: "Why this happens",
        body: [
          "Manual admin persists not because teams are inefficient, but because the alternative — building or buying a system to automate it — has historically felt like a bigger project than the admin itself. So the workaround becomes permanent: someone retypes the order, someone manually checks the invoice against the PO, someone compiles the weekly report from scratch every Friday. Each task alone seems too small to justify automating. Added together across a team and a year, it rarely is.",
        ],
      },
      {
        heading: "What it's costing you",
        body: [
          "In our conversations with South African operators across food, retail and wholesale, staff involved in admin or operations typically spend between 8 and 15 hours a week on tasks that follow a repeatable pattern: order capture, invoice checking, report compilation, status chasing. At a fully loaded staff cost of R150 to R250 an hour for a mid-level operations person, that is R4,800 to R15,000 a month per person, before counting the cost of the errors that manual, repetitive work inevitably introduces.",
          "The less visible cost is opportunity. Time spent on manual admin is time not spent reviewing supplier performance, checking margin, or planning ahead — the work that actually protects and grows profit.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        list: [
          "Ask each person on your ops team to log their tasks for three days and flag anything they do more than twice in that period the same way.",
          "Rank those repeated tasks by frequency, not by how long each instance takes — frequency is usually the better predictor of total time lost.",
          "Pick the single highest-frequency task and ask: does this follow the same rule every time? If yes, it is a strong automation candidate.",
          "Estimate the error rate on that task honestly. Repetitive manual work is where small mistakes compound fastest.",
        ],
        body: [],
      },
      {
        heading: "How Finch helps",
        body: [
          /* Rewritten in Phase 3, repriced by `.ai/plan_home_only.md`. The
             paragraph this replaces named the old entry-level package and its
             "up to five automations" cap, then the one published monthly rate
             that succeeded it — pricing the business no longer sells. The
             claims below are the ones `/operations-audit` and `/faq` already
             make. */
          "Finch is built for exactly this first step: agents that watch the tools your team already uses — WhatsApp, Xero, spreadsheets, email — without a platform migration. The free operations audit ranks where the repeatable work actually is in your operation, and agents are activated against that roadmap in the order the findings justify, rather than by a package you picked before anyone had looked. Each item on the roadmap is priced on its own scope, quoted to you directly.",
          "As the highest-value workflow becomes clear, it moves into a dedicated module like OrderFlow or Doc-U, with Finch giving your team a lighter interface to work from day to day.",
          "Our procurement automation and reporting automation solution pages go into more detail on the two areas where South African SMEs typically see the fastest time savings.",
        ],
      },
    ],
    about: "Workflow automation and admin time in SMEs",
    agents: [
      {
        label: "RECON",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Removes the retyping step: the invoice, the order and the delivery note are matched without anyone keying them twice.",
      },
      {
        label: "THE BRIEF",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Removes the compilation step: the weekly report assembles itself from what already moved through the operation.",
      },
      {
        label: "PRICE WATCH",
        status: "ROLLING OUT",
        role: "Removes the checking step: prices are compared against your own history on every invoice, not when someone has time.",
      },
    ],
    endFinding: {
      agent: "RECON",
      observation: "Eleven invoices this month were typed into two systems, by two different people.",
      impact: "\u2248 R7,400/month in duplicated admin",
      evidence: "3 days of task logs",
      meta: "ADMIN \u00b7 9H/WEEK \u00b7 AUG",
      actions: ["List the repeated tasks", "Book your audit", "Dismiss"],
    },
    keyTerms: ["operations-audit", "invoice-line-item", "weekly-brief"],
    sources: [
      {
        label: "Vyso's own conversations with South African operators",
        basis:
          "First-party, and the article says so in the sentence the range appears in. These are patterns seen in operator conversations, not a measured statistic from a published study.",
      },
    ],
    relatedArticleSlugs: [
      "hidden-cost-of-manual-procurement",
      "why-weekly-reports-are-usually-too-late",
      "why-businesses-lose-money-without-realising-it",
    ],
    relatedSolutionHrefs: ["/solutions/procurement-automation", "/solutions/reporting-automation"],
    relatedIndustryHrefs: ["/industries/wholesale", "/industries/food-suppliers"],
  },
  {
    slug: "hidden-cost-of-manual-procurement",
    title: "The Hidden Cost of Manual Procurement",
    category: "Procurement",
    description:
      "Manual procurement rarely fails loudly. It fails quietly — through duplicated orders, missed price checks and approvals nobody can trace. Here is what that actually costs.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-13",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "7 min read",
    heroLead:
      "Procurement is one of the few places in a business where a small process gap turns directly into a Rand figure — and it is usually the last place owners think to look.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "Manual procurement means orders placed from memory, price checks skipped under time pressure, and approvals given verbally or over WhatsApp with no record. It works, in the sense that stock keeps arriving and the business keeps running. What it does not do is protect the business from the accumulated cost of small procurement mistakes — mistakes that are individually forgivable and collectively expensive.",
        ],
      },
      {
        heading: "Why this happens",
        body: [
          "Procurement often sits with whoever has capacity that day, not with a consistent process. Under pressure to keep stock flowing, price checks against the agreed list get skipped, duplicate orders happen because nobody can see what was already requested, and approvals get given quickly and informally because a formal process would slow things down. None of this is negligence — it is what happens when procurement runs on individual judgement rather than a shared, visible system.",
        ],
      },
      {
        heading: "What it's costing you",
        body: [
          "The direct cost shows up in three places: paying above the agreed price because nobody checked, duplicated orders that create excess stock or wastage, and rushed emergency purchases at a premium because a shortage was not caught early. Across South African food and wholesale operators, these three patterns combined typically account for 1.5% to 4% of total procurement spend — on a business spending R300,000 a month with suppliers, that is R4,500 to R12,000 leaking every month through process gaps alone.",
          "The indirect cost is supplier relationships built on inconsistency. Suppliers who notice a business does not check pricing closely have less incentive to hold their prices, and inconsistent order timing makes it harder to negotiate better terms.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        list: [
          "Build a single, shared price list per supplier that every person placing orders can see — even a shared spreadsheet is better than memory.",
          "Require every order over a set Rand threshold to have a named approver, and record who approved it.",
          "Reconcile the last month of supplier invoices against the agreed price list, line by line.",
          "Identify where duplicate orders are most likely — usually where more than one person can place orders for the same category — and add a simple check before order confirmation.",
        ],
        body: [],
      },
      {
        heading: "How Finch helps",
        body: [
          "ProcurePulse gives your team one shared view of purchasing and stock intelligence, so reorder points, current pricing and outstanding orders are visible to everyone who needs them — not held in one person's head. Doc-U captures supplier documents and extracts the detail automatically, so invoices can be checked against the original quote without manual retyping. Together they turn procurement from an individual judgement call into a consistent, auditable process.",
          "If procurement is where you suspect the biggest leakage is happening, our procurement automation solution page walks through the full workflow, from approval to reconciliation.",
        ],
      },
    ],
    about: "Manual procurement in South African food and wholesale businesses",
    agents: [
      {
        label: "PRICE WATCH",
        status: "ROLLING OUT",
        role: "Checks every invoiced price against the agreed list, so paying above it stops depending on who had time that day.",
      },
      {
        label: "RECON",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Matches the order, the delivery note and the invoice, so a short or substituted line is caught before it is paid.",
      },
      {
        label: "STOCK SENSE",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Shows what is already ordered and already held, which is what stops the same order going out twice.",
      },
    ],
    endFinding: {
      agent: "RECON",
      observation: "Two orders for the same 20kg of tomatoes went out on Tuesday, from two people.",
      impact: "\u2248 R2,800 in excess stock",
      evidence: "2 purchase orders",
      meta: "PROCUREMENT \u00b7 DUPLICATE \u00b7 TUE",
      actions: ["Show both orders", "Book your audit", "Dismiss"],
    },
    keyTerms: ["price-creep", "delivery-note-reconciliation", "invoice-line-item"],
    sources: [
      {
        label: "Vyso's own conversations with South African operators",
        basis:
          "First-party, and the article says so in the sentence the range appears in. These are patterns seen in operator conversations, not a measured statistic from a published study.",
      },
    ],
    relatedArticleSlugs: [
      "supplier-scorecards-what-to-track-and-why",
      "why-businesses-lose-money-without-realising-it",
      "the-real-cost-of-poor-stock-control",
    ],
    relatedSolutionHrefs: ["/solutions/procurement-automation", "/solutions/reduce-money-leakage"],
    relatedIndustryHrefs: ["/industries/food-suppliers", "/industries/farms"],
  },
  {
    slug: "supplier-scorecards-what-to-track-and-why",
    title: "Supplier Scorecards: What to Track and Why",
    category: "Procurement",
    description:
      "Most SMEs judge suppliers on gut feel. A simple scorecard turns that gut feel into a record you can act on — here is what to track and why it matters.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-16",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "6 min read",
    heroLead:
      "Ask most operators which supplier is their most reliable, and they will have an answer. Ask them to prove it with numbers, and most cannot.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "Supplier performance is usually judged on memory and recent events rather than on a consistent record. A supplier who delivered late once last week feels less reliable than one who has been quietly missing delivery windows for three months — because the recent, memorable event outweighs the pattern nobody has been tracking. Without a scorecard, businesses end up renegotiating with, or dropping, the wrong suppliers based on incomplete information.",
        ],
      },
      {
        heading: "Why this happens",
        body: [
          "Tracking supplier performance properly requires capturing the same data points every time — on-time delivery, price accuracy, quality issues, response time to queries — and that discipline is hard to maintain manually, especially across a supplier base of thirty or fifty relationships. It falls away under day-to-day pressure, and the business is left with impressions instead of evidence.",
        ],
      },
      {
        heading: "What a good supplier scorecard tracks",
        body: [
          "A scorecard does not need to be complicated to be useful. The most valuable ones stay simple enough that someone will actually keep them updated.",
        ],
        list: [
          "On-time delivery rate — the percentage of orders delivered within the agreed window.",
          "Price accuracy — how often invoiced prices match the agreed price list without a manual correction.",
          "Order accuracy — whether the correct items and quantities arrived, and how often a delivery required a follow-up.",
          "Quality issues — returns, rejections or complaints linked to that supplier's stock.",
          "Responsiveness — how quickly the supplier answers a query or resolves an issue once raised.",
          "Communication of changes — whether pricing or availability changes are flagged proactively or discovered on the invoice.",
        ],
      },
      {
        heading: "What it's costing you to skip this",
        body: [
          "Businesses without supplier scorecards typically discover pricing drift, quality decline or delivery reliability problems three to six months after they started — long enough for the cost to have compounded significantly. A supplier whose on-time delivery quietly drops from 95% to 80% over two quarters can force emergency purchases, rushed substitutions and stockouts, all of which cost more than the original order would have.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        list: [
          "Pick your top ten suppliers by spend and start logging on-time delivery and price accuracy for each order, even in a basic spreadsheet.",
          "Review the log monthly, not just when a problem is already visible.",
          "Use the scorecard, not memory, the next time a supplier renegotiation comes up.",
        ],
        body: [],
      },
      {
        heading: "How Finch helps",
        body: [
          "SupplySync keeps supplier records and relationship history in one place, so scorecard data builds automatically from the orders, deliveries and invoices already flowing through the system — rather than requiring a separate manual log that inevitably falls away. Paired with ProcurePulse, it gives your team an evidence-based view of which suppliers are actually earning their place in your business.",
          "This connects directly to our procurement automation solution — worth a look if supplier reliability has been a recurring source of frustration.",
        ],
      },
    ],
    about: "Supplier performance measurement for SMEs",
    agents: [
      {
        label: "PRICE WATCH",
        status: "ROLLING OUT",
        role: "Supplies the price-accuracy column of the scorecard from the invoices themselves, rather than a memory of the last dispute.",
      },
      {
        label: "DELIVERY WATCH",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Supplies on-time and in-full delivery rates from the delivery notes as they arrive.",
      },
      {
        label: "RECON",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Supplies order accuracy: which lines arrived as ordered, and which needed a follow-up.",
      },
    ],
    endFinding: {
      agent: "DELIVERY WATCH",
      observation: "On-time delivery at your second-largest supplier fell from 94% to 78% over two months.",
      impact: "\u2248 R4,600 in emergency purchases",
      evidence: "36 deliveries",
      meta: "SUPPLIER \u00b7 \u221216PP \u00b7 JUN\u2013AUG",
      actions: ["Open the scorecard", "Draft supplier email", "Dismiss"],
    },
    keyTerms: ["delivery-note-reconciliation", "price-creep", "operations-audit"],
    relatedArticleSlugs: [
      "hidden-cost-of-manual-procurement",
      "the-real-cost-of-poor-stock-control",
      "why-weekly-reports-are-usually-too-late",
    ],
    relatedSolutionHrefs: ["/solutions/procurement-automation", "/solutions/operations-dashboard"],
    relatedIndustryHrefs: ["/industries/wholesale", "/industries/farms"],
  },
  {
    slug: "why-weekly-reports-are-usually-too-late",
    title: "Why Weekly Reports Are Usually Too Late",
    category: "Reporting",
    description:
      "By the time a weekly report reaches leadership, the problem it describes is already a week old. Here is why that delay is expensive, and what real-time visibility changes.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-20",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "6 min read",
    heroLead:
      "A weekly report is a photograph of last week, delivered this week, to be acted on next week. For fast-moving operational problems, that lag is where the real cost hides.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "Most SMEs run on a weekly reporting cycle: someone compiles numbers from stock, sales and procurement into a spreadsheet, sends it to leadership, and the team discusses it at the next meeting. By that point the data is anywhere from three to ten days old, and whatever caused the number to move — a supplier price change, a wastage spike, a stock shortfall — has usually already repeated itself at least once.",
        ],
      },
      {
        heading: "Why this happens",
        body: [
          "Weekly reporting exists because it is the fastest cycle a manual process can sustain. Pulling numbers from multiple spreadsheets, checking them, formatting them and writing commentary takes real time, and doing it daily by hand is usually not realistic for a small ops team. The reporting cadence is set by how long the manual compilation takes, not by how quickly the underlying problem needs a response.",
        ],
      },
      {
        heading: "What it's costing you",
        body: [
          "Delayed reporting means delayed decisions. A wastage spike that shows up in Friday's report was probably a Monday problem — meaning the business absorbed four extra days of the same loss before anyone could act. A supplier price increase caught a week after it started has already been paid on every order placed in that window. Across the operators we speak to, the gap between a problem starting and a decision-maker seeing it in a report averages five to seven days — and every one of those days carries a cost that compounds with the size of the business.",
          "There is also a trust cost. Teams that only see performance data once a week lose the habit of checking it, discussing it, and reacting to it quickly — reporting becomes a compliance exercise rather than a management tool.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        list: [
          "Time your current report compilation process, start to finish, including everyone involved.",
          "Identify which two or three metrics actually change your decisions week to week — most reports contain far more data than gets acted on.",
          "Ask whether those two or three metrics could be checked daily rather than weekly, even manually, as a test.",
          "Note how many days typically pass between a problem starting and it being visible in your current report.",
        ],
        body: [],
      },
      {
        heading: "How Finch helps",
        body: [
          "InsightGen replaces the manual compilation step with live dashboards built from the data already moving through your operation — procurement, stock, sales and staffing — so the report your team currently spends hours building by hand exists automatically, and updates continuously rather than weekly. That turns a five-to-seven-day decision lag into something closer to real time.",
          "Our reporting automation and operations dashboard solution pages show what this looks like once weekly compilation is replaced with a live operating view.",
        ],
      },
    ],
    about: "Operational reporting lag in SMEs",
    agents: [
      {
        label: "THE BRIEF",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Sends the same handful of numbers, in the same shape, on a schedule \u2014 so a change stands out instead of being compiled.",
      },
      {
        label: "STOCK SENSE",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Flags a wastage or variance spike on the day it happens, not in the report four days later.",
      },
      {
        label: "DEBTORS",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Watches accounts thinning out as they age, rather than at the month-end review.",
      },
    ],
    endFinding: {
      agent: "THE BRIEF",
      observation: "Wastage spiked on Monday. Friday\u2019s report was the first anyone saw of it.",
      impact: "\u2248 R3,900 across four extra days",
      evidence: "1 week of stock movement",
      meta: "WASTAGE \u00b7 4 DAYS LATE \u00b7 AUG",
      actions: ["Show the daily view", "Book your audit", "Dismiss"],
    },
    keyTerms: ["weekly-brief", "debtors-ageing", "money-leakage"],
    sources: [
      {
        label: "Vyso's own conversations with South African operators",
        basis:
          "First-party, and the article says so in the sentence the range appears in. These are patterns seen in operator conversations, not a measured statistic from a published study.",
      },
    ],
    relatedArticleSlugs: [
      "15-signs-your-business-has-operational-chaos",
      "why-businesses-lose-money-without-realising-it",
      "ai-for-small-and-medium-businesses-practical-use-cases",
    ],
    relatedSolutionHrefs: ["/solutions/reporting-automation", "/solutions/operations-dashboard"],
    relatedIndustryHrefs: ["/industries/hospitality", "/industries/restaurants"],
  },
  {
    slug: "the-real-cost-of-poor-stock-control",
    title: "The Real Cost of Poor Stock Control",
    category: "Inventory",
    description:
      "Stock variance feels like a small operational annoyance until you add it up. Here is what poor stock control actually costs South African food and wholesale businesses.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-23",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "7 min read",
    heroLead:
      "Ask most operators how accurate their stock counts are and you will hear \"pretty close.\" Pretty close, multiplied across a year of stock movement, is rarely cheap.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "Poor stock control shows up as small, familiar discrepancies: the count that does not quite match the system, the ingredient that runs out mid-week despite \"having enough,\" the stock take that always turns up a bit less than expected. Individually, none of these feel urgent. Over a year, they represent real product — and real Rand value — leaving the business without being properly accounted for.",
        ],
      },
      {
        heading: "Why this happens",
        body: [
          "Stock control breaks down when the record of what should be in stock and the reality of what is actually in stock are updated in different places, at different times, by different people. A delivery gets logged late. A wastage event gets remembered rather than recorded. A staff member takes stock for a legitimate reason and forgets to note it. None of these are big failures — they are small timing and recording gaps that accumulate into a system nobody fully trusts, which is why so many businesses fall back on physical counts rather than relying on their records.",
        ],
      },
      {
        heading: "What it's costing you",
        body: [
          "For food and hospitality operators specifically, unrecorded wastage and stock variance typically runs between 4% and 8% of cost of goods sold — on a business spending R200,000 a month on stock, that is R8,000 to R16,000 a month that shows up nowhere except a slightly disappointing gross margin. Wholesale and distribution businesses see a smaller percentage but a larger absolute figure, because volumes are higher.",
          "The secondary cost is decision quality. Purchasing decisions based on stock records that do not match reality lead to both overstocking, which ties up cash, and stockouts, which cost sales and force rushed, premium-priced emergency purchases.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        list: [
          "Run a full physical count on your ten highest-value stock lines and compare against system or spreadsheet records.",
          "For any line with more than 5% variance, trace back through the last two weeks of deliveries, sales and wastage entries to find where the gap started.",
          "Introduce a same-day wastage log, even a simple one, for anyone who removes stock for spoilage, testing or staff use.",
          "Review reorder points against actual usage rather than habit — many reorder points are set once and never revisited.",
        ],
        body: [],
      },
      {
        heading: "How Finch helps",
        body: [
          "WasteWatch captures wastage and shrinkage close to the moment it happens, with a reason attached, so the pattern is visible instead of estimated. Combined with ProcurePulse's stock intelligence, your team gets a stock picture that reflects what is actually happening in the operation, not what the last full count assumed. InsightGen then surfaces variance trends automatically, rather than requiring a manual investigation every time a number looks off.",
          "This connects directly to our reduce money leakage solution, and if food or hospitality wastage specifically is your biggest concern, our restaurant industry page covers the same problem from an operational angle.",
        ],
      },
    ],
    about: "Stock control and variance in food and wholesale businesses",
    agents: [
      {
        label: "STOCK SENSE",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Holds counted stock against deliveries, sales and recorded wastage, so a gap has a week rather than a quarter attached to it.",
      },
      {
        label: "RECON",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Confirms that what the stock record thinks arrived is what the delivery note says arrived.",
      },
      {
        label: "THE BRIEF",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Puts variance in front of the person who can act on it while the trail is still warm.",
      },
    ],
    endFinding: {
      agent: "STOCK SENSE",
      observation: "Butternut counted 38kg short against deliveries, sales and recorded wastage for the week.",
      impact: "\u2248 R1,900 unaccounted, this week",
      evidence: "1 stock count",
      meta: "STOCK \u00b7 \u221238KG \u00b7 WK 33",
      actions: ["Trace the two weeks", "Book your audit", "Dismiss"],
    },
    keyTerms: ["stock-cover-days", "money-leakage", "delivery-note-reconciliation"],
    relatedArticleSlugs: [
      "hidden-cost-of-manual-procurement",
      "why-businesses-lose-money-without-realising-it",
      "supplier-scorecards-what-to-track-and-why",
    ],
    relatedSolutionHrefs: ["/solutions/reduce-money-leakage", "/solutions/operations-dashboard"],
    relatedIndustryHrefs: ["/industries/restaurants", "/industries/catering-companies"],
  },
  {
    slug: "ai-for-small-and-medium-businesses-practical-use-cases",
    title: "AI for Small and Medium Businesses: Practical Use Cases",
    category: "AI in Business",
    description:
      "Beyond the hype, AI already does specific, practical work for South African SMEs today — finding bottlenecks, reading documents, and flagging problems before they grow. Here is what that looks like.",
    author: ARTICLE_AUTHOR,
    datePublished: "2026-07-27",
    dateModified: LEARN_LAST_MODIFIED,
    readingTime: "7 min read",
    heroLead:
      "Most SME owners have heard enough AI hype to be sceptical of it, and rightly so. The useful question is not whether AI is impressive — it is what it actually does for a business your size, today.",
    sections: [
      {
        heading: "The problem in plain terms",
        body: [
          "AI is talked about mostly in the abstract — chatbots, generative content, big enterprise transformation programmes — none of which map cleanly onto the daily reality of running a restaurant group, a wholesale operation or a catering business. The practical question for most SME owners is not \"should we adopt AI\" but \"is there anything AI actually does that would save my team time or catch a problem earlier this week?\" The honest answer is yes, but the useful applications are narrower and less flashy than the marketing suggests.",
        ],
      },
      {
        heading: "Why this gets confused",
        body: [
          "AI is sold at the platform level — as a general capability — when the value for a specific SME almost always shows up at the workflow level: reading a scanned invoice accurately, spotting a stock variance pattern a human would only notice after three months, flagging that a supplier's pricing has crept above the agreed list. These are narrow, specific applications, and they are easy to miss under the noise of AI as a category.",
        ],
      },
      {
        heading: "Practical AI use cases that matter for SMEs",
        body: [
          "The most useful applications for operational SMEs cluster around a few specific jobs:",
        ],
        list: [
          "Document extraction — reading supplier invoices, delivery notes and WhatsApp order screenshots, and turning them into structured, checkable data without manual retyping.",
          "Pattern and anomaly detection — spotting stock variance, pricing drift or unusual order volumes automatically, rather than waiting for a human to notice during a monthly review.",
          "Automated reporting — compiling live operational summaries from data that already exists in the business, replacing hours of manual spreadsheet work.",
          "Workflow triage — flagging which approvals, orders or exceptions need a person's attention first, instead of leaving everything at equal priority in an inbox.",
          "Forecasting support — using historical order and wastage patterns to suggest more accurate reorder points than habit-based purchasing.",
        ],
      },
      {
        heading: "What it's costing you to skip this",
        body: [
          "Businesses relying entirely on manual review for the tasks above are not just slower — they are structurally more likely to miss the slow-moving problems AI is good at catching, like a gradual price increase or a stock pattern that only becomes obvious once you compare several months side by side. These are exactly the kinds of leakage described elsewhere in this series, and they are the hardest for a busy human team to catch unaided.",
        ],
      },
      {
        heading: "Practical steps you can take this month",
        list: [
          "List the manual tasks in your business that involve reading a document and typing what it says into another system — this is the clearest AI use case available today.",
          "Ask your team which recurring problems they only notice \"eventually\" rather than immediately — these are strong candidates for automated pattern detection.",
          "Treat AI as a tool for narrow, specific jobs first. Broad \"AI transformation\" without a defined workflow rarely produces a return.",
        ],
        body: [],
      },
      {
        heading: "How Finch helps",
        body: [
          "Finch applies AI at exactly this practical, workflow level. Doc-U reads and extracts supplier documents and order screenshots automatically. InsightGen applies pattern detection to your operational data to catch variance and drift early. None of this is presented as a general AI platform — it is AI applied to specific, named operational problems, which is where SMEs actually see a return.",
          "Our AI vs Spreadsheets comparison and operations dashboard solution page go further into how this plays out once AI-assisted reporting replaces manual compilation.",
        ],
      },
    ],
    about: "Practical AI use cases for South African SMEs",
    agents: [
      {
        label: "PRICE WATCH",
        status: "ROLLING OUT",
        role: "Pattern detection applied to one narrow job: pricing drift across a run of invoices for the same item.",
      },
      {
        label: "RECON",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Document extraction applied to one narrow job: reading an invoice and a delivery note and disagreeing with them.",
      },
      {
        label: "THE BRIEF",
        status: "FROM YOUR AUDIT ROADMAP",
        role: "Triage applied to one narrow job: which three things this week actually need you.",
      },
    ],
    endFinding: {
      agent: "RECON",
      observation: "A delivery note and its invoice disagreed on two lines. Doc-U read both without retyping.",
      impact: "\u2248 R840 on one delivery",
      evidence: "1 invoice \u00b7 1 delivery note",
      meta: "RECON \u00b7 2 LINES \u00b7 AUG",
      actions: ["Open both documents", "Book your audit", "Dismiss"],
    },
    keyTerms: ["operations-audit", "invoice-line-item", "money-leakage"],
    relatedArticleSlugs: [
      "why-weekly-reports-are-usually-too-late",
      "how-much-time-can-workflow-automation-save",
      "hidden-cost-of-manual-procurement",
    ],
    relatedSolutionHrefs: ["/solutions/reporting-automation", "/solutions/operations-dashboard"],
    relatedIndustryHrefs: ["/industries/food-suppliers", "/industries/wholesale"],
  },
] as const;

export function getLearnArticle(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((article) => article.slug === slug);
}

export function getRelatedArticles(article: LearnArticle): readonly LearnArticle[] {
  return article.relatedArticleSlugs
    .map((slug) => getLearnArticle(slug))
    .filter((found): found is LearnArticle => Boolean(found));
}
