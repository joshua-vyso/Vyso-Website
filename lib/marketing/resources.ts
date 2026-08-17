/* ── Resources ───────────────────────────────────────────────────────────────
   Content for `/resources` and `/resources/[slug]`.

   Phase 3 (workstream D) touched three things and nothing else — the preview
   sections, the "what it helps" bullets and the "who it's for" copy are all
   exactly what they were, because they describe real documents:

   1. **Titles lost their "| Free Resource | Vyso" suffix.** The root layout
      now appends " | Vyso" via `title.template`, so a self-contained title
      renders as "… | Vyso | Vyso" (see the comment on `app/layout.tsx`'s
      metadata). Each title is rewritten to lead with the query instead.
   2. **A dead Learn link is fixed.** `weekly-operations-report-template`
      pointed at `/learn/12-operational-kpis-every-ceo-should-track`, which has
      never existed in `lib/marketing/learn-articles.ts` — the same class of bug
      Phase 2 found nine times in the solutions data. Every `href` in this file
      is now a route that resolves.
   3. **Vyso → Finch** where a sentence describes the product rather than the
      company. Only `weekly-operations-report-template`'s description carried
      one.                                                                     */

export type ResourcePreviewSection = {
  readonly heading: string;
  readonly items: readonly string[];
};

export type RelatedArticle = {
  readonly href: string;
  readonly title: string;
};

export type Resource = {
  readonly slug: string;
  readonly shortName: string;
  /** <title> tag content. */
  readonly title: string;
  /** Meta description. */
  readonly description: string;
  readonly eyebrow: string;
  readonly heroPlain: string;
  readonly heroAccent: string;
  /** Short explanation of the resource, shown at the top of the detail page. */
  readonly summary: string;
  readonly whoItsFor: string;
  readonly whatItHelps: readonly string[];
  readonly preview: readonly ResourcePreviewSection[];
  readonly relatedSolutionSlug: "reduce-money-leakage" | "reporting-automation" | "procurement-automation";
  readonly relatedSolutionName: string;
  readonly relatedArticles: readonly RelatedArticle[];
};

export const RESOURCES: readonly Resource[] = [
  {
    slug: "operations-audit-checklist",
    shortName: "Operations Audit Checklist",
    title: "Operations audit checklist for South African SMEs",
    description:
      "A free checklist for reviewing procurement, inventory, reporting and staff workflows before they leak money. Built for South African operators.",
    eyebrow: "Free resource",
    heroPlain: "Find the leaks before",
    heroAccent: "they cost you a season.",
    summary:
      "A structured, print-and-use checklist that walks an owner or operations manager through the areas where South African SMEs typically lose money without noticing — buying, stock, reporting, staffing and approvals. Use it before you commit to any new tool or process change.",
    whoItsFor:
      "Owners, operations managers and finance leads in growing SMEs — especially restaurants, catering businesses, wholesalers and hospitality operations — who suspect something is leaking but don't yet have proof.",
    whatItHelps: [
      "Spot which operational areas rely on memory, WhatsApp or paper instead of a repeatable process.",
      "Identify where stock, purchasing and wastage are tracked in disconnected places.",
      "Surface reporting gaps that leave leadership waiting for numbers instead of seeing them.",
      "Prioritise the one or two fixes that would matter most in the next 90 days.",
      "Give a consistent basis for comparing notes across sites, shifts or departments.",
    ],
    preview: [
      {
        heading: "Procurement & suppliers",
        items: [
          "Every supplier has an agreed price list on file, not just a remembered rate.",
          "Purchase orders exist in writing before stock arrives, not after.",
          "Someone checks delivered quantities and quality against what was ordered.",
          "Repeat supplier issues — late deliveries, short orders, quality — are tracked over time.",
        ],
      },
      {
        heading: "Inventory & wastage",
        items: [
          "Stock counts happen on a fixed schedule, not only when something runs out.",
          "Wastage is recorded with a reason at the time it happens, not estimated later.",
          "Stock variance between expected and counted quantities is reviewed weekly.",
          "Fast-moving and slow-moving items are both visible to whoever orders stock.",
        ],
      },
      {
        heading: "Reporting & visibility",
        items: [
          "Leadership can see key numbers without asking a manager to compile them.",
          "Weekly reports are available within a day of the week ending, not a week later.",
          "The same KPIs are tracked consistently from week to week.",
          "Reports show trends over time, not just a single week in isolation.",
        ],
      },
      {
        heading: "Staff workflows & approvals",
        items: [
          "Purchase and expense approvals happen through a tracked process, not informal messages.",
          "Handovers between shifts or roles are recorded somewhere other than memory.",
          "It's clear who is responsible for each recurring operational task.",
          "New staff can follow a written process instead of relying on a colleague's knowledge.",
        ],
      },
      {
        heading: "Finance & margin control",
        items: [
          "Menu, service or product pricing is reviewed against current input costs at least quarterly.",
          "Margin on core products or services is visible, not just total revenue.",
          "Outstanding supplier and customer balances are reviewed on a fixed schedule.",
        ],
      },
    ],
    relatedSolutionSlug: "reduce-money-leakage",
    relatedSolutionName: "Reduce Money Leakage",
    relatedArticles: [
      {
        href: "/learn/why-businesses-lose-money-without-realising-it",
        title: "Why Businesses Lose Money Without Realising It",
      },
      {
        href: "/learn/15-signs-your-business-has-operational-chaos",
        title: "15 Signs Your Business Has Operational Chaos",
      },
    ],
  },
  {
    slug: "weekly-operations-report-template",
    shortName: "Weekly Operations Report Template",
    title: "Weekly operations report template for SME owners",
    description:
      "A free weekly operations report structure — sales, stock, procurement, staffing, risks — for South African owners tired of chasing numbers.",
    eyebrow: "Free resource",
    heroPlain: "One report.",
    heroAccent: "Every Monday, without the chase.",
    summary:
      "A structured template for the weekly operations report managers should already be sending leadership — covering the numbers that matter and a consistent format, so nobody has to rebuild it from scratch every Friday afternoon.",
    whoItsFor:
      "Operations managers, general managers and owners who currently piece together a weekly update from memory, spreadsheets and WhatsApp threads — or who don't get one at all.",
    whatItHelps: [
      "Standardise what a 'weekly operations report' actually contains, so every manager reports the same things.",
      "Cut the time spent compiling a report from scratch each week.",
      "Give leadership a consistent view of sales, stock, procurement and staffing in one document.",
      "Make it easier to compare this week against last week, not just report a snapshot.",
      "Create a record of decisions and issues that would otherwise only live in someone's head.",
    ],
    preview: [
      {
        heading: "Sales & revenue summary",
        items: [
          "Total revenue for the week vs. previous week and vs. target.",
          "Revenue by site, department or product line.",
          "Notable one-off events affecting the numbers — weather, public holiday, promotion.",
        ],
      },
      {
        heading: "Stock & wastage",
        items: [
          "Closing stock value vs. expected stock value.",
          "Wastage recorded this week, by cause.",
          "Stock items running low or already out.",
        ],
      },
      {
        heading: "Procurement & suppliers",
        items: [
          "Orders placed this week, and any delays or short deliveries.",
          "Supplier price changes noticed this week.",
          "Outstanding supplier queries or disputes.",
        ],
      },
      {
        heading: "Staffing & labour",
        items: [
          "Hours worked vs. planned or budgeted hours.",
          "Staffing gaps, overtime or turnover notes.",
          "Any training or onboarding in progress.",
        ],
      },
      {
        heading: "Risks & outstanding actions",
        items: [
          "Top three risks or blockers this week.",
          "Actions carried over from last week, with status.",
          "Decisions needed from leadership before next week.",
        ],
      },
    ],
    relatedSolutionSlug: "reporting-automation",
    relatedSolutionName: "Reporting Automation",
    relatedArticles: [
      {
        href: "/learn/why-weekly-reports-are-usually-too-late",
        title: "Why Weekly Reports Are Usually Too Late",
      },
      /* Was `/learn/12-operational-kpis-every-ceo-should-track` — a slug that
         has never existed. Replaced with a real article on the same problem
         (the hours the weekly report costs to build). */
      {
        href: "/learn/how-much-time-can-workflow-automation-save",
        title: "How Much Time Can Workflow Automation Save?",
      },
    ],
  },
  {
    slug: "supplier-scorecard",
    shortName: "Supplier Scorecard",
    title: "Supplier scorecard template for South African buyers",
    description:
      "A free supplier scorecard for tracking delivery, quality, price and communication, so supplier decisions rest on a record. Built for SA buyers.",
    eyebrow: "Free resource",
    heroPlain: "Score suppliers on",
    heroAccent: "evidence, not memory.",
    summary:
      "A scoring framework for reviewing suppliers on the things that actually affect your operation — delivery reliability, order accuracy, quality, price and communication — so renewal and negotiation conversations are based on a record rather than whoever complained loudest that month.",
    whoItsFor:
      "Procurement leads, operations managers and owners who manage more than a handful of suppliers and currently judge them on gut feel or the most recent complaint.",
    whatItHelps: [
      "Track supplier performance consistently instead of relying on whoever remembers the last issue.",
      "Build a fair, evidence-based case for renegotiating price or switching suppliers.",
      "Catch a slipping supplier relationship before it becomes a recurring cost.",
      "Give new staff a clear reference for how existing suppliers are actually performing.",
      "Create a record you can point to when a supplier disputes a complaint.",
    ],
    preview: [
      {
        heading: "Delivery & fulfilment",
        items: [
          "On-time delivery rate over the review period.",
          "Order fill rate — delivered in full vs. short-delivered.",
          "Lead time consistency vs. quoted lead time.",
        ],
      },
      {
        heading: "Quality & accuracy",
        items: [
          "Order accuracy — right items, right quantities.",
          "Quality consistency and rejection or return rate.",
          "Frequency of quality-related complaints.",
        ],
      },
      {
        heading: "Commercial",
        items: [
          "Price competitiveness vs. comparable suppliers.",
          "Invoice accuracy vs. agreed pricing.",
          "Flexibility on payment terms and volume pricing.",
        ],
      },
      {
        heading: "Communication & service",
        items: [
          "Responsiveness to queries and order changes.",
          "Clarity and advance notice of price changes.",
          "Speed and fairness of complaint resolution.",
        ],
      },
      {
        heading: "Overall relationship",
        items: [
          "Willingness to accommodate urgent or changed orders.",
          "Consistency of account contact and continuity.",
          "Overall score and recommended action — retain, review or replace.",
        ],
      },
    ],
    relatedSolutionSlug: "procurement-automation",
    relatedSolutionName: "Procurement Automation",
    relatedArticles: [
      {
        href: "/learn/hidden-cost-of-manual-procurement",
        title: "The Hidden Cost of Manual Procurement",
      },
      {
        href: "/learn/supplier-scorecards-what-to-track-and-why",
        title: "Supplier Scorecards: What to Track and Why",
      },
    ],
  },
] as const;

export function getResource(slug: string): Resource | undefined {
  return RESOURCES.find((resource) => resource.slug === slug);
}
