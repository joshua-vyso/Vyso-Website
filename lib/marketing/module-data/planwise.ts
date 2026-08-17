import type { MarketingModule } from "../module-types";

export const planwise: MarketingModule = {
  slug: "planwise",
  name: "PlanWise",
  role: "Budgeting & forecasting",
  tagline: "Set the target. See how the operation is tracking against it.",
  description:
    "PlanWise sits above the operational modules: you set the budget, goals and forecast, and it measures reality against them live — pro-rated to today rather than flattering you until month-end.",
  capabilities: [
    "Budget lines compared against actuals pro-rated to the day of the month, not the whole month",
    "Actuals measured from OrderFlow sales, product cost and WasteWatch events rather than typed in",
    "Goals for revenue, profit, expenses and margin that every other module measures itself against",
    "Forecast lines with a likely range and confidence, editable when you disagree with the projection",
    "Scenario sliders that recalculate projected revenue, profit, cash and runway as you move them",
    "Recommended decisions that name the module able to act on each one",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/planwise-overview.png",
      alt: "PlanWise overview showing monthly revenue target, budget pace, forecast profit and cash runway.",
      label: "app.vyso.co.za/planwise",
    },
    {
      src: "/screenshots/modules/planwise-forecast.png",
      alt: "PlanWise forecast cards showing revenue, expense, profit and cash projections with confidence.",
      label: "app.vyso.co.za/planwise/forecast",
    },
  ],
  featureSections: [
    {
      id: "budget",
      title: "Over budget today, not over budget on the 31st",
      copy:
        "Comparing a part-month actual against a whole-month budget makes every line look healthy until it suddenly isn't. PlanWise pro-rates each budget line to the elapsed fraction of the month, so on day eight you are measured against eight days of plan. The banner says how much is over pace and across how many categories — same-day, not month-end.",
      bullets: [
        "Every category shows Actual so far, Budget to date, Tracking to and Full-month plan side by side",
        "Pace badges run Over pace, Edging over, Within pace, Ahead of pace, Slightly behind, Behind pace or No plan",
        "A source chip marks each line Measured · OrderFlow, Measured · order cost, Measured · WasteWatch or From plan — so you can see which numbers are live",
        "The budget table adds Profit impact, a suggested action and a “Review →” link to the module that can act on it",
      ],
      screenshot: {
        src: "/screenshots/modules/planwise-budget.png",
        alt: "PlanWise budget vs actual view with a doughnut of categories and per-category pace status.",
        label: "app.vyso.co.za/planwise/budget",
      },
    },
    {
      id: "goals",
      title: "The numbers the rest of the platform measures itself against",
      copy:
        "Goals is where an owner sets the north-star figures once, instead of maintaining a target in every module. Revenue, desired monthly profit, maximum expenses and target gross margin live here — and each field states which module uses it, with a link straight there.",
      bullets: [
        "Core goals cover revenue, desired monthly profit, maximum expenses and target gross margin; strategic goals add cash reserve, growth and an outstanding-invoice target",
        "Each goal ring shows progress against target with a “● Live” badge when the figure is measured from real rows",
        "A goal timeline marks month start, today, forecast finish and the goal itself, with an on-track or behind-by reading",
        "The “How your goals connect” chain runs Revenue → Margins → Profit → Cash → Growth, each chip tagged with the module that owns it",
      ],
      screenshot: {
        src: "/screenshots/modules/planwise-goals.png",
        alt: "PlanWise goals screen with progress rings, goal timeline and the goal chain from revenue through to growth.",
        label: "app.vyso.co.za/planwise/goals",
      },
    },
    {
      id: "forecast",
      title: "Where the month lands, and why",
      copy:
        "Each forecast line — revenue, expenses, profit, cash position — carries a projection, a likely range, how much has been measured so far this month and a confidence meter. Underneath, plain-English commentary explains the projection in sentences rather than leaving you to read a chart.",
      bullets: [
        "Forecast cards show a trend direction, the value against target, a likely low-to-high range and a confidence percentage",
        "Any card can be edited when you disagree — and the tone recalculates, so an edited card can't stay green while it's under target",
        "“What is driving this forecast?” ranks cost categories by share of spend, each linking to the module responsible",
        "Commentary is badged Measured this month or Illustrative, so you always know whether you're reading your data or an example",
      ],
      screenshot: {
        src: "/screenshots/modules/planwise-forecast.png",
        alt: "PlanWise forecast screen showing revenue, expense, profit and cash forecast cards with confidence meters.",
        label: "app.vyso.co.za/planwise/forecast",
      },
    },
    {
      id: "scenarios",
      title: "What-if, before you commit to it",
      copy:
        "Scenarios is a sandbox for the conversation you have anyway: what happens if we grow revenue four percent, or cut waste, or fix the under-target lines. Five sliders map onto the modules that would deliver the change, and the projected outcome recalculates as you move them.",
      bullets: [
        "Sliders cover revenue growth, expense reduction, margin improvement, waste reduction and invoice recovery — each tagged to its owning module",
        "Live results show projected revenue, expenses, profit, cash position, runway and the delta against where you are now",
        "A comparison table lines scenarios up on revenue, profit, cash, growth, variance, risk and probability",
        "An AI-generated “best scenario” is on the roadmap; today the sandbox is yours to drive",
      ],
      screenshot: {
        src: "/screenshots/modules/planwise-scenarios.png",
        alt: "PlanWise scenarios workspace with assumption sliders, live projected results and a scenario comparison table.",
        label: "app.vyso.co.za/planwise/scenarios",
      },
    },
    {
      id: "decisions",
      title: "Numbers that turn into named, costed decisions",
      copy:
        "A dashboard that only reports is a dead end. The recommended decisions panel on the overview turns the month's gaps into tracked items with a rand value against each — recover outstanding invoices, pull cost of goods back to plan, reprice the below-target products — and routes each one to the module where the work actually happens.",
      bullets: [
        "Tracked decisions cycle Open → In progress → Done, with a “Review →” link into the owning module",
        "Freshly derived suggestions appear alongside them and can be promoted to tracked with one action",
        "The panel header totals the value still open against the number completed",
        "The financial flow card traces Revenue → Gross margin → Gross profit → Expenses → Net profit → Cash position, each node linking to its module",
      ],
      screenshot: null,
    },
  ],
  workflow: [
    {
      title: "Set the goals first",
      copy:
        "Revenue, profit, expense ceiling and target margin. These are the figures PricePilot, InsightGen and the rest measure themselves against, so they are worth an hour.",
    },
    {
      title: "Lay out the budget by category",
      copy:
        "Add the cost lines your business actually runs on. Where a module can measure one — sales, order cost, waste — it will, and mark the line as measured.",
    },
    {
      title: "Check pace mid-month, not month-end",
      copy:
        "The overview tells you what is over pace today. Being eleven days into the month is no longer an excuse for not knowing.",
    },
    {
      title: "Read the forecast commentary",
      copy:
        "Plain sentences on where the month is likely to land and why — ahead of or short of target, and which cost category is driving it.",
    },
    {
      title: "Decide, then act in the right module",
      copy:
        "Track the decision here, do the work where it lives: chase invoices in OrderFlow, reprice in PricePilot, cut waste in WasteWatch.",
    },
  ],
  worksWith: [
    {
      slug: "orderflow",
      reason:
        "Revenue and receivables are measured from OrderFlow orders and invoices — not typed into a budget sheet.",
    },
    {
      slug: "pricepilot",
      reason:
        "Cost of goods comes from PricePilot's average unit cost, and the target margin set here is what PricePilot flags products against.",
    },
    {
      slug: "wastewatch",
      reason:
        "Logged waste events feed the cost lines directly, so waste appears in the budget as an actual rather than a footnote.",
    },
    {
      slug: "insightgen",
      reason:
        "InsightGen treats PlanWise as a reportable source and reads your margin target when checking cost variance rules.",
    },
  ],
  industryFit: [
    {
      href: "/industries/catering-companies",
      name: "Catering companies",
      reason:
        "Lumpy, event-driven months where pace against plan matters far more than a month-end comparison.",
    },
    {
      href: "/industries/hospitality",
      name: "Hospitality",
      reason:
        "Labour, food cost and revenue tracked against one set of targets rather than three separate spreadsheets.",
    },
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "Cash position and runway that depend on collections, with the outstanding-invoice target measured live.",
    },
  ],
  faqs: [
    {
      question: "Is “over budget” measured at month end or as of today?",
      answer:
        "As of today. Each cost line's actual is compared against its budget pro-rated to the elapsed fraction of the month, specifically so a line can't look fine on the 8th and blow up on the 31st.",
    },
    {
      question: "Where do the budget and forecast numbers come from — are they manual?",
      answer:
        "Both. PlanWise stores the plan you set, but measures reality live from OrderFlow sales and invoices, product cost, and WasteWatch events. Where a measured figure exists it is shown alongside the plan and marked as measured.",
    },
    {
      question: "Does it update when a colleague changes something?",
      answer:
        "Yes. Budget lines, targets, goals, forecasts and decisions are all watched live, so an edit made elsewhere — including a target changed from the pricing module — appears without a manual refresh.",
    },
    {
      question: "Can we override a forecast we disagree with?",
      answer:
        "Yes. Every forecast card is editable — forecast value, target, likely range and confidence — and the trend colouring recalculates from the new figure, so an edited card can't stay optimistic while sitting under target.",
    },
    {
      question: "Does the scenario builder save scenarios?",
      answer:
        "Not yet. The sliders, live results and comparison table are fully interactive, but saving a scenario and the AI “generate best scenario” action are still on the roadmap rather than working features today.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/operations-dashboard", "/solutions/reporting-automation"],
  relatedIndustryHrefs: ["/industries/catering-companies", "/industries/hospitality"],
  appUrlLabel: "app.vyso.co.za/planwise",
  group: "suppliers-stock",
  status: "LIVE",
  agents: ["THE BRIEF", "DEBTORS"],
  howFinchUsesIt:
    "The Brief reads PlanWise's pace and forecast data to say whether the month is on track. Debtors reads the outstanding-invoice target PlanWise tracks as one of its strategic goals — the same figure, not a second one kept separately.",
};
