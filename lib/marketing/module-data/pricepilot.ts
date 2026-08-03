import type { MarketingModule } from "../module-types";

export const pricepilot: MarketingModule = {
  slug: "pricepilot",
  name: "PricePilot",
  role: "Pricing & margin recommendations",
  tagline: "Keep selling prices connected to current cost.",
  description:
    "PricePilot builds sell prices from the costs ProcurePulse and Doc-U already carry, measures the margin you actually earned on every invoiced sale, and tells you whether a margin drop came from cost, price or mix.",
  capabilities: [
    "Sell prices built from live product cost plus your margin rules, per list or per customer",
    "Automated, rule-based repricing recommendations with the monthly rand impact of each change",
    "A variance breakdown attributing margin drift to cost inflation, selling price and sales mix",
    "Realised margin on every invoiced sale, filterable down to the orders that lost money",
    "Customer contract pricing with validity windows and expiry warnings before a contract lapses",
    "Published price-list versions you can compare and roll back",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/pricepilot-overview.png",
      alt: "PricePilot dashboard showing a pricing health score, revenue and profit tiles and an opportunity centre.",
      label: "app.vyso.co.za/pricepilot",
    },
    {
      src: "/screenshots/modules/pricepilot-analytics.png",
      alt: "PricePilot analytics view showing revenue, gross profit and a margin variance breakdown.",
      label: "app.vyso.co.za/pricepilot/analytics",
    },
  ],
  featureSections: [
    {
      id: "products",
      title: "Every product, sorted by the ones losing you money",
      copy:
        "The pricing catalogue exists to answer one question quickly: which lines are underpriced right now. Costs arrive from ProcurePulse, margins come from your price list, and the filter chips split the catalogue into what's below target, what's on target and what has no cost recorded at all.",
      bullets: [
        "Columns run Product, Category, Cost, Margin, Sell, Sold 30d and Status, with badges for Below target, On target and No cost",
        "Sort by lowest margin first, highest margin, highest price, most sold in 30 days or A–Z",
        "The subhead states the position plainly: how many products, the average margin and the target you set",
        "A product's own page charts realised margin and cost history, and links back to the Doc-U document the cost came from",
      ],
      screenshot: {
        src: "/screenshots/modules/pricepilot-products.png",
        alt: "PricePilot products table showing cost, margin, sell price, units sold in 30 days and below-target status.",
        label: "app.vyso.co.za/pricepilot/products",
      },
    },
    {
      id: "price-lists",
      title: "Margin rules you can publish, compare and roll back",
      copy:
        "A price list here is a rule, not a static sheet: base cost times your margin, with per-row overrides where a product needs a different answer. Because pricing mistakes are expensive, every published version is kept — so you can compare what changed and restore a prior state in one action.",
      bullets: [
        "Create a general list or a customer-specific one, with a default margin percentage and a cadence of standard, daily, weekly or monthly",
        "The editable table shows Product, Base price, Margin % and Sell price, with a reset control per row",
        "Version history publishes a snapshot with an optional note, and shows whether you're up to date or carrying unpublished changes",
        "Compare any published version against live margins, or restore it outright",
      ],
      screenshot: {
        src: "/screenshots/modules/pricepilot-price-lists.png",
        alt: "PricePilot price lists screen showing lists with their customer, cadence, margin and creation date.",
        label: "app.vyso.co.za/pricepilot/price-lists",
      },
    },
    {
      id: "recommendations",
      title: "A reprice queue with the rand impact attached",
      copy:
        "Recommendations turn “below target” into a decision you can act on. Each card states the current margin against your target, how many units sold in the last thirty days, the before-and-after sell price, and what the change is worth per month. The logic is deterministic and stated on the card — no black box, and no guessing at your intent.",
      bullets: [
        "Every recommendation carries a High, Medium or Low confidence badge and a written reason for the suggested change",
        "Accept a single change with an edited target margin, or accept the whole queue behind a confirmation step",
        "A warning appears whenever a suggestion would lower a price rather than raise it",
        "When nothing needs repricing the queue says so outright instead of inventing work",
      ],
      screenshot: {
        src: "/screenshots/modules/pricepilot-recommendations.png",
        alt: "PricePilot recommendations screen showing suggested price changes with margin before and after and monthly impact.",
        label: "app.vyso.co.za/pricepilot/recommendations",
      },
    },
    {
      id: "analytics",
      title: "Why your margin moved — cost, price or mix",
      copy:
        "“Margin is down” is not a finding. The variance panel decomposes the drift between your baseline and current margin into three signed effects that add up exactly: cost inflation, selling price and sales mix. Waste is shown separately, because food cost that never reaches an invoice line is a different problem with a different fix.",
      bullets: [
        "Baseline margin → current margin → drift, split across Cost inflation, Selling price and Sales mix over 30 or 90 days",
        "A “Biggest cost movements” table names the products behind the shift with their unit cost and extra spend",
        "Waste sits in its own sub-panel with a link straight into WasteWatch",
        "Dimension tabs re-cut revenue, gross profit and margin by customer, category or product",
      ],
      screenshot: {
        src: "/screenshots/modules/pricepilot-analytics.png",
        alt: "PricePilot analytics screen with revenue, gross profit, average margin and a why-your-margin-moved variance panel.",
        label: "app.vyso.co.za/pricepilot/analytics",
      },
    },
    {
      id: "recent-sales",
      title: "The margin you actually earned, sale by sale",
      copy:
        "List price is a plan; realised margin is what happened. Recent sales is an auditable ledger of every invoiced order with its cost, profit and margin worked out — filterable down to exactly the orders that quietly went out below target or with a cost missing.",
      bullets: [
        "Columns run Invoice, Customer, Status, Revenue, Cost, Profit, Margin and Date",
        "Filter by margin band — all, below target, at or above target, or missing costs — and sort by newest, biggest, most profit or worst margin",
        "Stat tiles summarise the filtered set: sales shown, revenue, gross profit and average margin",
        "The sales hub re-cuts the same realised sales by month, by customer and by product, with drill-downs into what each customer buys",
      ],
      screenshot: {
        src: "/screenshots/modules/pricepilot-recent-sales.png",
        alt: "PricePilot recent sales ledger showing revenue, cost, profit and margin per invoice.",
        label: "app.vyso.co.za/pricepilot/recent-sales",
      },
    },
    {
      id: "customers",
      title: "Contract pricing that doesn't lapse quietly",
      copy:
        "Negotiated prices have end dates, and the expensive failure is a contract that expires without anyone noticing. The customers view tracks every contract price list with its validity window and warns before it runs out — alongside a consolidated alert feed for below-target margins and supplier cost spikes.",
      bullets: [
        "KPIs cover Customers, On contract pricing, Expiring soon and Expired",
        "Each contract row carries a validity badge — Active, Scheduled, Expiring soon, Expired or No expiry — with dates editable in place",
        "An expiry reminders panel lists the contracts about to lapse, so the renegotiation happens before the invoice does",
        "Notifications add cost spikes and cost creep per product on top of contract and margin alerts",
      ],
      screenshot: null,
    },
  ],
  workflow: [
    {
      title: "Set the target once, in PlanWise",
      copy:
        "Target margin lives with your other goals rather than buried in a pricing screen. PricePilot measures everything against it and links you there if it isn't set.",
    },
    {
      title: "Build the price list off real cost",
      copy:
        "Products and their costs are already there from ProcurePulse. You add the margin rule — general, per customer, with overrides where a line needs a different answer.",
    },
    {
      title: "Work the reprice queue",
      copy:
        "Recommendations shows what's below target with the monthly rand impact of fixing it. Accept individually or in bulk, and publish the version.",
    },
    {
      title: "Check what you actually earned",
      copy:
        "Recent sales shows realised margin per invoice. Filter to below-target and missing-cost orders — that is where the leak usually is.",
    },
    {
      title: "Explain the movement, don't guess at it",
      copy:
        "When margin drifts, the variance panel says how much came from cost, how much from price, how much from mix, and how much waste took out before the sale.",
    },
  ],
  worksWith: [
    {
      slug: "procurepulse",
      reason:
        "Product costs and price history come from ProcurePulse — PricePilot's own empty state tells you the products and their costs are already there.",
    },
    {
      slug: "orderflow",
      reason:
        "Customers and realised sales come from OrderFlow invoices, and both modules read and write the same price lists and overrides.",
    },
    {
      slug: "wastewatch",
      reason:
        "The variance panel reads WasteWatch events directly — waste is the food cost that never reaches an invoice line, so it's shown as its own drag on margin.",
    },
    {
      slug: "planwise",
      reason:
        "Target margin and revenue goals are set in PlanWise; PricePilot measures every product and sale against them rather than keeping a second target.",
    },
  ],
  industryFit: [
    {
      href: "/industries/food-suppliers",
      name: "Food suppliers",
      reason:
        "Customer-specific contract pricing with expiry dates, against costs that move every week.",
    },
    {
      href: "/industries/farms",
      name: "Farms & producers",
      reason:
        "Repeat buyers on negotiated terms, where input costs move faster than the price list gets revisited.",
    },
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "Thin margins across many lines, where realised margin per invoice matters more than an average.",
    },
  ],
  faqs: [
    {
      question: "Can we set different prices per customer, and get warned before a contract expires?",
      answer:
        "Yes. A price list can be attached to one customer with valid-from and valid-until dates. Contracts show as Active, Scheduled, Expiring soon or Expired, and an expiry reminders panel lists the ones about to lapse.",
    },
    {
      question: "If margin drops, can the system tell us whether it's cost or underpricing?",
      answer:
        "That is exactly what the variance panel does. It decomposes the drift into cost inflation, selling price and sales mix — three signed effects that sum to the total movement — and shows waste separately on top.",
    },
    {
      question: "Do we have to recalculate sell prices every time a supplier cost changes?",
      answer:
        "No. Sell price is computed live from the current cost and your margin rule. Cost spikes and slower cost creep are detected per product and surfaced as reprice alerts with a suggested new price.",
    },
    {
      question: "Are the recommendations AI-generated?",
      answer:
        "No, and we would rather be straight about it. Recommendations and their confidence badges are produced by deterministic rules over your own cost, margin-target and sales data — the reasoning is printed on each card. Vyso does use AI elsewhere, in document extraction and product matching.",
    },
    {
      question: "Can we undo a pricing change?",
      answer:
        "Yes. Publish a version of a price list, compare it against live margins later, and restore it in one action if a change turns out to be wrong.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/reduce-money-leakage", "/solutions/reporting-automation"],
  relatedIndustryHrefs: ["/industries/food-suppliers", "/industries/farms"],
  appUrlLabel: "app.vyso.co.za/pricepilot",
};
