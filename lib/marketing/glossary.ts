/* ── The glossary ────────────────────────────────────────────────────────────
   Twelve short definitional pages behind `/learn/glossary` and
   `/learn/glossary/[term]`, per `.ai/vyso_v2.md` §2.3 and §7.4. The asset is an
   AEO/GEO one: an engine (or a person) asking "what is price creep" should get
   a complete answer in the first sentence and be able to stop reading there.

   Rules this file keeps, all of them from the plan's honesty section:

   1. **Definition first, and it is a definition** — not a pitch with a
      definition inside it. Each `definition` runs 60–120 words and would be
      correct on any site. Vyso, where it appears at all, appears in
      `whyItMatters`, not before it (`.ai/plan_vyso_redesign_2026.md` §7.6:
      copy pass, no Finch, no module codenames, `fractional-coo` rewritten
      definition-only with an honest "Vyso is not one" note).
   2. **No invented statistics.** The only numbers here are arithmetic (the
      markup/margin worked example) or illustrative operational figures.
   3. **No quoted tax rate.** `vat-inclusive-pricing` explains the mechanic and
      points at SARS for the rate, because a rate printed in a glossary is a
      fact with an expiry date and nothing here checks it. See its `note`.
   4. **Every example finding is illustrative** and every render says so —
      the same caption the homepage hero and `/solutions` carry.
   5. **Every term links up (Learn), sideways (≥ 2 sibling terms) and out**
      (a real page), per the §7.5 hub-and-spoke rule. Every `href` in
      `relatedPages` is a route that exists.

   Server-safe by construction: nothing here imports a `"use client"` module,
   so the JSON-LD builders can read it from a server component.               */

import { FLAGSHIP } from "./findings";

/** One worked example, shaped for `components/finch/FindingCard`. */
export type GlossaryExample = {
  agent: string;
  observation: string;
  impact: string;
  evidence: string;
  meta: string;
  actions: readonly string[];
};

export type GlossaryLink = {
  label: string;
  href: string;
};

export type GlossaryTerm = {
  slug: string;
  /** The headword, as a reader would say it. */
  term: string;
  /** Other names the same thing goes by, if any. Rendered as a mono aside. */
  aka?: readonly string[];
  /** `<title>`, ≤ 60 chars before the root layout appends " | Vyso". */
  metaTitle: string;
  /** Meta description, ≤ 155 chars. */
  metaDescription: string;
  /** 60–120 words, definition first. The hub shows the first sentence. */
  definition: readonly string[];
  whyItMatters: readonly string[];
  /** A caveat the definition would be wrong without. Optional by design. */
  note?: string;
  example: GlossaryExample;
  /** Slugs of sibling terms. Two or more, always. */
  relatedTerms: readonly string[];
  /** Learn article slugs. */
  relatedArticles: readonly string[];
  /** Real routes elsewhere on the site. */
  relatedPages: readonly GlossaryLink[];
};

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
  {
    slug: "fractional-coo",
    term: "Fractional COO",
    aka: ["part-time COO", "outsourced operations director"],
    metaTitle: "Fractional COO: what it means for an SA business",
    metaDescription:
      "A fractional COO is a chief operating officer hired for part of a week rather than full time. What the role covers, what it costs, and the alternative.",
    definition: [
      "A fractional COO is a chief operating officer you hire for part of a week rather than full time: typically a few days a month on a retainer, to run or repair the operating side of a business that cannot justify an executive salary. The work is the same work: process, suppliers, stock, reporting, people. Only the hours and the cost change. In South Africa the arrangement is common among SMEs that have outgrown owner-run operations but are several years away from an executive payroll, and it is usually bought when the owner has become the bottleneck.",
    ],
    whyItMatters: [
      "A food supplier turning over a few million rand a year has the problems of a much larger business and none of the head count to solve them. Somebody has to watch prices, deliveries, stock and debtors every week, and in most SMEs that somebody is the owner, at night.",
      "Vyso is not a fractional COO, and it is worth being direct about that here. A fractional COO makes judgement calls: what to prioritise, who to hire, which supplier relationship to end. Vyso automates the repetitive work underneath those decisions and flags what needs attention, which is a narrower and different kind of help. Some businesses need both, some need neither, and an operations audit is a reasonable way to work out which applies to yours.",
    ],
    example: {
      agent: "THE BRIEF",
      observation: "Three things needed you last week. Two of them had been true since Tuesday.",
      impact: "≈ R4,800 in decisions made late",
      evidence: "1 week of operations",
      meta: "OPERATIONS · 3 ITEMS · WK 33",
      actions: ["Open the brief", "Book your audit", "Dismiss"],
    },
    relatedTerms: ["operations-audit", "weekly-brief", "money-leakage"],
    relatedArticles: ["15-signs-your-business-has-operational-chaos"],
    relatedPages: [
      { label: "The free operations audit", href: "/operations-audit" },
      { label: "How Vyso works", href: "/how-it-works" },
    ],
  },

  {
    slug: "operations-audit",
    term: "Operations audit",
    aka: ["operational audit", "ops review"],
    metaTitle: "Operations audit: what it is and what it produces",
    metaDescription:
      "An operations audit is a fixed-scope review of how a business buys, holds, invoices and collects, done against real documents, not a conversation.",
    definition: [
      "An operations audit is a fixed-scope review of how a business actually runs: what it buys, what it holds, what it invoices, what it is owed, and how long each of those takes, carried out against real documents rather than a conversation. It produces two things: a list of the places money is leaving that nobody planned for, with the evidence attached to each one, and an order of work. It is a diagnosis, not an implementation, and a good one is useful even if you never buy anything afterwards.",
    ],
    whyItMatters: [
      "Most operational advice fails because it starts from a description of the business rather than its paperwork. Owners describe the process they designed; the invoices describe the process that is running. Where those two differ is where the money goes.",
      "Vyso runs its audit free, in about an hour with you. You walk us through how the work actually moves; you get where the money and the time are leaking and a roadmap of what to automate first, with a fixed build price and a monthly run price against each item, quoted to you directly. If the finding is that you do not need software, that is what the roadmap says.",
    ],
    example: {
      agent: "AUDIT",
      observation: "Four leaks found in one hour with the owner. Two of them are the same supplier.",
      impact: "≈ R11,200/yr at current volumes",
      evidence: "1 hour, no documents needed",
      meta: "AUDIT · 4 FINDINGS · FREE",
      actions: ["Open the roadmap", "Book your free audit", "Dismiss"],
    },
    relatedTerms: ["money-leakage", "price-creep", "fractional-coo"],
    relatedArticles: [
      "why-businesses-lose-money-without-realising-it",
      "15-signs-your-business-has-operational-chaos",
    ],
    relatedPages: [
      { label: "The free operations audit", href: "/operations-audit" },
      { label: "Operations audit checklist", href: "/resources/operations-audit-checklist" },
    ],
  },

  {
    slug: "money-leakage",
    term: "Money leakage",
    aka: ["margin leakage", "profit leakage"],
    metaTitle: "Money leakage: the losses nobody adds up",
    metaDescription:
      "Money leakage is what a business loses through small, repeated gaps rather than one visible failure. Where it hides in a South African operation.",
    definition: [
      "Money leakage is what a business loses through small, repeated, unplanned gaps rather than through one visible failure: a price increase nobody checked, a delivery two crates short, an invoice paid twice, stock written off with no reason attached. Each event is too small to investigate on its own, and none of them appear in the accounts under their own name. Added together they show up as a business that is busy, growing, and somehow never holding the cash the growth should have produced.",
    ],
    whyItMatters: [
      "Leakage is a visibility problem before it is a discipline problem. An SA food operation runs across WhatsApp groups, paper delivery notes, a spreadsheet only one person understands, and an accounting package that sees everything a month late. Each tool is fine; none of them compare notes, and the gaps between them is where the losses live.",
      "It is also the one thing an owner cannot fix by working harder, because the events are individually invisible. Finding leakage means comparing documents that currently never meet: the price list against the invoice, the order against the delivery note, the stock count against both.",
    ],
    /* The flagship card, with this entry's own framing of the observation —
       everything else comes from the findings library so the magnitude and the
       volume basis can never drift from the rest of the site. */
    example: {
      agent: FLAGSHIP.agent,
      observation: "Butternut up 12% at FreshCo since June, across three invoices nobody compared.",
      impact: FLAGSHIP.impact,
      evidence: FLAGSHIP.evidence,
      meta: FLAGSHIP.meta,
      actions: FLAGSHIP.actions,
    },
    relatedTerms: ["price-creep", "operations-audit", "delivery-note-reconciliation"],
    relatedArticles: [
      "why-businesses-lose-money-without-realising-it",
      "the-real-cost-of-poor-stock-control",
    ],
    relatedPages: [
      { label: "Reduce money leakage", href: "/solutions/reduce-money-leakage" },
      { label: "Start your operations audit", href: "/operations-audit" },
    ],
  },

  {
    slug: "gross-margin-vs-markup",
    term: "Gross margin vs markup",
    metaTitle: "Gross margin vs markup: the difference",
    metaDescription:
      "Markup is profit over cost; gross margin is profit over selling price. Buy at R80, sell at R100: 25% markup, 20% margin. Why the mix-up costs money.",
    definition: [
      "Gross margin and markup describe the same rand of profit against two different bases. Markup expresses profit as a percentage of what the item cost you. Gross margin expresses the same profit as a percentage of what you sold it for. Buy at R80 and sell at R100 and you have made R20: that is a 25% markup and a 20% gross margin. Markup is always the larger of the two numbers, which is why using it where margin is meant flatters profitability every single time.",
    ],
    whyItMatters: [
      "Price lists are usually built on markup, because that is how a buyer thinks: cost plus. Management accounts are always read in margin, because that is how a bank and a landlord think: percentage of turnover. Businesses that move between the two without converting end up pricing to a margin they never actually earned.",
      "In food the gap is expensive because the percentages are thin to begin with. A kitchen aiming at 30% margin and pricing at 30% markup is running roughly 23% margin and does not know it. On tight volumes that is the difference between a good month and a flat one.",
    ],
    example: {
      agent: "PRICE WATCH",
      observation: "Six menu lines are priced on markup where the target was margin.",
      impact: "≈ R7,600/month of assumed profit",
      evidence: "1 price list",
      meta: "PRICING · 6 LINES · AUG",
      actions: ["Show the recalculation", "Book your audit", "Dismiss"],
    },
    relatedTerms: ["vat-inclusive-pricing", "price-creep", "invoice-line-item"],
    relatedArticles: ["why-businesses-lose-money-without-realising-it"],
    relatedPages: [
      { label: "Reduce money leakage", href: "/solutions/reduce-money-leakage" },
      { label: "Hospitality", href: "/industries/hospitality" },
    ],
  },

  {
    slug: "debtors-ageing",
    term: "Debtors ageing",
    aka: ["aged receivables", "debtors age analysis"],
    metaTitle: "Debtors ageing: reading the age analysis properly",
    metaDescription:
      "A debtors ageing groups what customers owe you by how long it has been outstanding. Why the shape of the report matters more than the total.",
    definition: [
      "A debtors ageing groups everything your customers owe you by how long it has been outstanding: current, 30, 60, 90 days and older. It is the fastest read available on whether sales are turning into cash. The shape matters more than the total: a book weighted to the current column is healthy at any size, while one with weight in the 60- and 90-day columns describes a cash-flow problem that has already happened, whatever the revenue line says about the same period.",
    ],
    whyItMatters: [
      "Food businesses sell on terms and buy on shorter ones. A wholesaler paying suppliers in 15 days while being paid in 55 is financing its own customers, and the ageing report is where that shows up first, long before the bank balance makes it obvious.",
      "The other reason to read it weekly rather than monthly is that ageing is where a customer in trouble becomes visible. An account that quietly thins out (smaller orders, slower payment) is a different problem from one large late invoice, and only the trend shows it.",
    ],
    example: {
      agent: "DEBTORS",
      observation: "Two accounts moved from the 30-day column to the 60-day column this month.",
      impact: "≈ R38,000 sitting past terms",
      evidence: "1 age analysis",
      meta: "DEBTORS · 2 ACCOUNTS · AUG",
      actions: ["Draft follow-up", "Show the trend", "Dismiss"],
    },
    relatedTerms: ["money-leakage", "weekly-brief", "invoice-line-item"],
    relatedArticles: ["why-weekly-reports-are-usually-too-late"],
    relatedPages: [
      { label: "Reporting automation", href: "/solutions/reporting-automation" },
      { label: "Wholesale", href: "/industries/wholesale" },
    ],
  },

  {
    slug: "delivery-note-reconciliation",
    term: "Delivery-note reconciliation",
    aka: ["three-way match", "GRN matching"],
    metaTitle: "Delivery-note reconciliation: the 3-way match",
    metaDescription:
      "Delivery-note reconciliation checks that what a supplier invoiced is what came off the truck: order, delivery note and invoice matched line by line.",
    definition: [
      "Delivery-note reconciliation is the check that what a supplier invoiced you for is what actually came off the truck. It matches three documents line by line: the order you placed, the delivery note signed at the back door, and the invoice that follows, and flags any line where the quantity, the unit or the price disagrees. In fresh produce it is the difference between paying for 40kg and receiving 37kg. Done by hand it is the first thing skipped under pressure; done automatically it happens on every delivery, including the busy ones.",
    ],
    whyItMatters: [
      "The busiest deliveries are the ones most worth checking, and they are exactly the ones nobody checks. A short crate on a Friday afternoon is signed for, invoiced in full, and paid three weeks later by somebody who was not at the back door.",
      "Substitutions matter as much as shortages. A grade or pack size swapped at the depot arrives looking like the thing you ordered and prices like something else; only a line-level match catches it, because the invoice total will usually still look about right.",
    ],
    example: {
      agent: "RECON",
      observation: "Delivery note says 37kg. Invoice says 40kg. Same load, same day.",
      impact: "≈ R840 on one delivery",
      evidence: "1 invoice · 1 delivery note",
      meta: "RECON · 2 LINES · AUG",
      actions: ["Open both documents", "Draft supplier email", "Dismiss"],
    },
    relatedTerms: ["invoice-line-item", "price-creep", "stock-cover-days"],
    relatedArticles: [
      "hidden-cost-of-manual-procurement",
      "supplier-scorecards-what-to-track-and-why",
    ],
    relatedPages: [
      { label: "Procurement automation", href: "/solutions/procurement-automation" },
      { label: "Food suppliers", href: "/industries/food-suppliers" },
    ],
  },

  {
    slug: "price-creep",
    term: "Price creep",
    aka: ["price drift", "supplier creep"],
    metaTitle: "Price creep: the supplier increases nobody announces",
    metaDescription:
      "Price creep is the slow, unannounced upward drift of supplier prices: a few percent at a time, across months, on invoices that are otherwise correct.",
    definition: [
      "Price creep is the slow, unannounced upward drift of supplier prices: a few percent at a time, spread across months and across line items, on invoices that are otherwise entirely correct. No single increase is large enough to trigger a phone call, which is precisely why it works. It is only visible when you compare the same item's price across a run of invoices, rather than checking each invoice against the one before it. By the time it shows in your margin it has usually been paid for a quarter or more.",
    ],
    whyItMatters: [
      "Produce prices move for real reasons (season, fuel, weather), so an increase is never obviously wrong. That is the cover it hides under. The question worth asking is not whether a price went up but whether it went up further than the market did, and only your own invoice history answers that.",
      "It compounds quietly across a supplier base. Two percent on a handful of lines at three suppliers is a rounding error on any single invoice and a five-figure number over a year on the volumes a food business actually buys.",
    ],
    example: {
      agent: "PRICE WATCH",
      observation: "Cooking oil up 9% since May at your main supplier: three invoices, no notification.",
      impact: "≈ R3,100/yr at current volumes",
      evidence: "3 invoices",
      meta: "SUPPLIER · +9% · MAY-AUG",
      actions: ["Draft supplier email", "Show 6-month trend", "Dismiss"],
    },
    relatedTerms: ["money-leakage", "invoice-line-item", "gross-margin-vs-markup"],
    relatedArticles: [
      "hidden-cost-of-manual-procurement",
      "supplier-scorecards-what-to-track-and-why",
    ],
    relatedPages: [
      { label: "Procurement automation", href: "/solutions/procurement-automation" },
      { label: "Supplier scorecard", href: "/resources/supplier-scorecard" },
    ],
  },

  {
    slug: "stock-cover-days",
    term: "Stock cover days",
    aka: ["days of cover", "days on hand"],
    metaTitle: "Stock cover days: how long your stock actually lasts",
    metaDescription:
      "Stock cover days is how many days of trading your stock will last at your recent rate of use. How to work it out, and why perishables have a hard ceiling.",
    definition: [
      "Stock cover days is how many days of trading your current stock will last at your recent rate of use: divide the quantity you hold of an item by its average daily usage. Two days of cover on a fast-moving line is a stockout waiting for one late delivery; forty days on a slow one is cash sitting in a cold room. It is a per-item number, not a warehouse number: an average across a store hides both problems at once, which is the usual reason neither gets fixed.",
    ],
    whyItMatters: [
      "For perishables the figure has a hard ceiling: cover beyond shelf life is not cover, it is future wastage with a date on it. Reorder points set once and never revisited are how a kitchen ends up holding eleven days of something that keeps for six.",
      "The number is also the honest input to a purchasing conversation. Ordering by habit produces both stockouts and dead cash in the same week, and the only way to see which lines are which is to hold each one's cover against its usage rather than against a feeling about how fast it moves.",
    ],
    example: {
      agent: "STOCK SENSE",
      observation: "Tomatoes at 1.8 days' cover against Thursday's orders already placed.",
      impact: "≈ R2,400 at risk of a rush buy",
      evidence: "1 stock count · 4 orders",
      meta: "STOCK · 1.8 DAYS · THU",
      actions: ["Show usage rate", "Adjust reorder point", "Dismiss"],
    },
    relatedTerms: ["delivery-note-reconciliation", "money-leakage", "weekly-brief"],
    relatedArticles: ["the-real-cost-of-poor-stock-control"],
    relatedPages: [
      { label: "Reduce money leakage", href: "/solutions/reduce-money-leakage" },
      { label: "Hospitality", href: "/industries/hospitality" },
    ],
  },

  {
    slug: "vat-inclusive-pricing",
    term: "VAT-inclusive pricing",
    aka: ["VAT-inclusive vs ex-VAT"],
    metaTitle: "VAT-inclusive pricing vs ex-VAT: the difference",
    metaDescription:
      "A VAT-inclusive price contains VAT; an ex-VAT price does not. Margin is calculated on the ex-VAT figure, and mixing the two quietly costs margin.",
    definition: [
      "A VAT-inclusive price already contains value-added tax. A VAT-exclusive price, usually written ex-VAT, does not. The distinction matters because margin is calculated on the ex-VAT figure: the VAT portion was never your money, it is collected on behalf of SARS. To move from an inclusive price to the ex-VAT price, divide by one plus the VAT rate. Mixing the two across a price list, a quote and an invoice is one of the quietest sources of margin error in South African trade, because both numbers look equally plausible on the page.",
    ],
    whyItMatters: [
      "Food businesses sit on both sides of the line at once: retail and menu prices are quoted inclusive because that is what a customer pays, while supplier price lists and cost calculations are usually ex-VAT. Anyone costing a dish or a delivery has to know which number they are holding.",
      "The failure is rarely a single mistake. It is a price list built on one basis and a margin target read on the other, repeated across every line for as long as nobody checks, which makes it exactly the kind of thing worth catching at the document, not at year-end.",
    ],
    note: "No rate is quoted here on purpose: the standard rate is set by National Treasury and changes by budget, and a number printed in a glossary is a fact with an expiry date. Check the current standard rate with SARS or your accountant before doing the sum.",
    example: {
      agent: "PRICE WATCH",
      observation: "Supplier quote is ex-VAT; the costing sheet reads it as inclusive.",
      impact: "≈ R5,900/month of overstated margin",
      evidence: "1 quote · 1 costing sheet",
      meta: "PRICING · MIXED BASIS · AUG",
      actions: ["Show the recalculation", "Book your audit", "Dismiss"],
    },
    relatedTerms: ["gross-margin-vs-markup", "invoice-line-item", "money-leakage"],
    relatedArticles: ["why-businesses-lose-money-without-realising-it"],
    relatedPages: [
      { label: "Straight answers", href: "/faq" },
      { label: "Built for South Africa", href: "/south-africa" },
    ],
  },

  {
    slug: "popia",
    term: "POPIA",
    aka: ["Protection of Personal Information Act"],
    metaTitle: "POPIA: what the data law asks of an SA business",
    metaDescription:
      "POPIA is South Africa's data-protection law. What counts as personal information in an operations business, and what the Act requires you to do.",
    definition: [
      "POPIA is the Protection of Personal Information Act, South Africa's data-protection law, in force since 2021. It sets conditions for how any organisation collects, stores, uses and shares personal information about people: customers, staff, drivers, the individuals at your suppliers. Information must be collected for a stated purpose, kept secure, kept no longer than it is needed, and made available to the person it describes on request. Every business holds personal information, so the Act applies whether or not a business thinks of itself as handling data.",
    ],
    whyItMatters: [
      "An operations business holds more personal information than it realises: driver names on delivery notes, staff rosters and hours, customer contact numbers in a WhatsApp group, the individual at a supplier whose cellphone number is on every order. All of it is in scope.",
      "It also shapes what you should expect from any software you connect to that data: where it is stored, who at the vendor can see it, and what happens to it if you leave. Those are fair questions to ask before an integration, not after one.",
    ],
    example: {
      agent: "DOC CHECK",
      observation: "Delivery notes carry driver names and cell numbers. Retention was never set.",
      impact: "Personal information held with no stated purpose",
      evidence: "1 document set",
      meta: "POPIA · RETENTION · AUG",
      actions: ["Set a retention rule", "Read the privacy policy", "Dismiss"],
    },
    relatedTerms: ["operations-audit", "invoice-line-item", "weekly-brief"],
    relatedArticles: ["ai-for-small-and-medium-businesses-practical-use-cases"],
    relatedPages: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Straight answers", href: "/faq" },
    ],
  },

  {
    slug: "weekly-brief",
    term: "Weekly brief",
    aka: ["weekly operations report", "Monday brief"],
    metaTitle: "Weekly brief: the report shape that gets read",
    metaDescription:
      "A weekly brief is a short, fixed-format summary of how the operation ran and what needs a decision: same numbers, same order, same day, every week.",
    definition: [
      "A weekly brief is a short, fixed-format summary of how the operation ran last week and what needs a decision this week, sent on a schedule, in the same shape every time, to the people who can act on it. It is not a dashboard and it is not a report pack. The discipline is the format: the same handful of numbers, in the same order, on the same day, so that a change stands out precisely because everything around it is familiar.",
    ],
    whyItMatters: [
      "The usual weekly report fails for a structural reason: it is rebuilt by hand, so it arrives late, looks different each week, and contains far more than anyone acts on. A brief that is generated rather than compiled can be short, because nothing in it had to be justified by the effort of producing it.",
      "Delivery matters as much as content. In an SA food business the people who need the brief are on the floor or in a vehicle, not at a desk, which is why Vyso sends it on WhatsApp rather than as an attachment somebody opens on Wednesday.",
    ],
    example: {
      agent: "THE BRIEF",
      observation: "Monday, 06:40: three things need you this week. One is new since Friday.",
      impact: "≈ R6,300 across the three",
      evidence: "1 week of operations",
      meta: "BRIEF · 3 ITEMS · MON",
      actions: ["Open the brief", "Book your audit", "Dismiss"],
    },
    relatedTerms: ["debtors-ageing", "operations-audit", "fractional-coo"],
    relatedArticles: [
      "why-weekly-reports-are-usually-too-late",
      "15-signs-your-business-has-operational-chaos",
    ],
    relatedPages: [
      { label: "Reporting automation", href: "/solutions/reporting-automation" },
      {
        label: "Weekly operations report template",
        href: "/resources/weekly-operations-report-template",
      },
    ],
  },

  {
    slug: "invoice-line-item",
    term: "Invoice line item",
    aka: ["line-level detail"],
    metaTitle: "Invoice line item: why totals are not evidence",
    metaDescription:
      "An invoice line item is one row: item, quantity, unit, unit price, line total. Almost every quiet loss lives at line level and is invisible from the total.",
    definition: [
      "An invoice line item is a single row on a supplier invoice: the item, the quantity, the unit, the unit price and the line total. It is the smallest level at which a price can be checked, a delivery can be matched and a margin can be traced. Reconciling at invoice-total level catches only errors large enough to move the total. Almost every quiet loss (a wrong unit, a substituted grade, a crept price) lives at line level, and is invisible when you look at one document at a time.",
    ],
    whyItMatters: [
      "Line-level detail is also what makes an invoice comparable to anything else. Without it you cannot hold this month's price against last quarter's, or the invoice against the delivery note, because there is nothing to match on but a total that was never meant to be evidence.",
      "This is the practical reason document reading matters in an operations business. Vyso extracts the lines from a scanned invoice or a photographed delivery note so the comparison can happen at all: before that, checking properly means retyping, and retyping is what does not happen on a busy week.",
    ],
    example: {
      agent: "DOC CHECK",
      observation: "Line 4 reads 'tomatoes, grade 2' at the grade 1 price agreed in June.",
      impact: "≈ R1,150 on this invoice",
      evidence: "1 invoice · 1 price list",
      meta: "DOC CHECK · LINE 4 · AUG",
      actions: ["Open the invoice", "Draft supplier email", "Dismiss"],
    },
    relatedTerms: ["delivery-note-reconciliation", "price-creep", "vat-inclusive-pricing"],
    relatedArticles: [
      "hidden-cost-of-manual-procurement",
      "ai-for-small-and-medium-businesses-practical-use-cases",
    ],
    relatedPages: [
      { label: "How Vyso works", href: "/how-it-works" },
      { label: "Procurement automation", href: "/solutions/procurement-automation" },
    ],
  },
] as const;

/** Alphabetical by headword — the order the hub renders and the order the
    `DefinedTermSet` lists, so the page and the schema agree. */
export const GLOSSARY_ALPHABETICAL: readonly GlossaryTerm[] = [...GLOSSARY_TERMS].sort((a, b) =>
  a.term.localeCompare(b.term, "en"),
);

export const GLOSSARY_SLUGS: readonly string[] = GLOSSARY_TERMS.map((term) => term.slug);

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((term) => term.slug === slug);
}

/** The hub shows the first sentence of each definition rather than a separate
    hand-written summary, so the two can never drift apart. Splits on ". "
    followed by a capital, which is enough for prose that carries no
    abbreviations — and every definition above is written to stay that way.
    `[\s\S]` rather than `.` with the `s` flag: this repo's tsconfig targets
    ES2017, where `s` is a compile error. */
export function firstSentence(text: string): string {
  const match = /^[\s\S]*?[.!?](?=\s+[A-Z]|$)/.exec(text.trim());
  return match ? match[0] : text;
}

export const GLOSSARY_HUB = {
  eyebrow: "GLOSSARY",
  h1Plain: "The words operators use,",
  h1Accent: "defined properly.",
  lead: "Twelve terms that come up in every operations conversation in South African food and produce, each defined in a sentence you can quote, then explained in the context of a business that buys, holds and delivers stock.",
  title: "Operations glossary for South African businesses",
  description:
    "Plain definitions of the operations terms SA food and produce businesses use: money leakage, price creep, stock cover days, debtors ageing and POPIA.",
} as const;
