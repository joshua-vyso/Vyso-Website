import type { MarketingModule } from "../module-types";

export const wastewatch: MarketingModule = {
  slug: "wastewatch",
  name: "WasteWatch",
  role: "Wastage & shrinkage",
  tagline: "Make preventable waste visible to the people who can act.",
  description:
    "WasteWatch records what gets thrown away with enough context to do something about it — item, reason, recipe, person, device — then costs it, separates preventable from unavoidable, and shows what it is doing to your food cost.",
  capabilities: [
    "A waste log capturing item, quantity, cost, reason code, recipe, person, device and location",
    "Waste costed in rand and split into preventable and unavoidable",
    "Over-portioning measured per recipe against its expected quantity",
    "Day-of-week, service-period and per-person patterns rather than a single monthly total",
    "Non-punitive coaching notes that deliberately exclude natural spoilage",
    "Waste expressed as a share of food cost — the figure margin analysis attributes drift to",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/wastewatch-overview.png",
      alt: "WasteWatch overview showing waste cost, preventable share, waste percentage of food cost and top categories.",
      label: "app.vyso.co.za/wastewatch",
    },
    {
      src: "/screenshots/modules/wastewatch-analytics.png",
      alt: "WasteWatch analytics showing waste by category, over-portioning by recipe and day-of-week patterns.",
      label: "app.vyso.co.za/wastewatch/analytics",
    },
  ],
  featureSections: [
    {
      id: "log",
      title: "One event table everything else is computed from",
      copy:
        "The waste log is the grain of the whole module — every other screen is an aggregation of it, and the module says so. Each row carries the item, quantity, cost, reason, recipe, employee, device and location, so a number on the overview can always be traced back to the events that made it.",
      bullets: [
        "Columns run Date, Time, Item, Category, Qty, Cost, Reason, Recipe, Employee, Device and Location",
        "Reason codes cover Spoiled, Expired, Wilted, Day-old, Over-portioned, Damaged, Trim, Prep error and Other",
        "Filter by category, employee, device, recipe or reason, or search item, recipe and employee free-text",
        "Opening a row shows the linked ProcurePulse ingredient, supplier and batch where the connection exists",
      ],
      screenshot: {
        src: "/screenshots/modules/wastewatch-log.png",
        alt: "WasteWatch waste log table listing each waste event with item, quantity, cost, reason, recipe, employee and device.",
        label: "app.vyso.co.za/wastewatch/log",
      },
    },
    {
      id: "overview",
      title: "What it cost, and how much of it was avoidable",
      copy:
        "A waste total on its own tends to produce a shrug. The overview splits the number: what it cost, how much was preventable, and what it represents as a share of food cost — with a plain-language list of what to change next week rather than a chart to interpret.",
      bullets: [
        "KPI tiles cover Waste cost, Preventable, Waste % of food cost, Top category and Waste events",
        "The weekly report ranks top causes with a preventable or unavoidable badge, and lists costliest items with their main reason",
        "Top waste sources are clickable category tiles that filter the log to that category",
        "A cost timeline runs across today, week, month, quarter and year, captioned when the curve is illustrative rather than yours",
      ],
      screenshot: null,
    },
    {
      id: "analytics",
      title: "Patterns, not just totals",
      copy:
        "Waste is rarely random — it clusters on a service, a recipe, a weekday. Analytics breaks the log down by category, reason, recipe, person and time so the conversation moves from “we're wasting too much” to “Saturday dinner over-portions this dish”.",
      bullets: [
        "“Over-portioning by recipe” compares expected against actual quantity with the excess cost and the number of events",
        "Day-of-week bars stack preventable against unavoidable per weekday, with a written callout naming the worst day",
        "A service-period heatmap crosses Morning, Lunch and Dinner against weekdays, and says outright when it is illustrative",
        "Categories are yours to create, rename, recolour or remove — and totals are recomputed from the log on every load",
      ],
      screenshot: {
        src: "/screenshots/modules/wastewatch-analytics.png",
        alt: "WasteWatch analytics with a waste-by-category donut, over-portioning by recipe table and day-of-week pattern bars.",
        label: "app.vyso.co.za/wastewatch/analytics",
      },
    },
    {
      id: "coaching",
      title: "Coaching that doesn't blame people for the weather",
      copy:
        "Per-person waste data is easy to misuse, so the coaching view is built to exclude natural spoilage on purpose — nobody is flagged for produce that arrived past its best. What remains is preventable waste, with a tone badge and a written note per person rather than a leaderboard.",
      bullets: [
        "Coaching cards are scoped to preventable waste only, and say so on the panel",
        "Tone badges run Doing well, Worth a refresher and Keep an eye — framed as support, not discipline",
        "A separate waste-by-employee ranking shows cost, event count and the trend against the team average",
        "Preventable versus unavoidable is shown as its own split, so the ratio is visible before any individual is",
      ],
      screenshot: null,
    },
    {
      id: "devices",
      title: "Scales and stations, ready for automatic capture",
      copy:
        "Typing waste in is the reason waste logs die. The Devices tab is the register for the scales, sensors and stations that will weigh it instead — device, type, location, status, battery, last sync, current user and current recipe — with the hardware capture path still being wired up rather than quietly implied.",
      bullets: [
        "KPIs cover Connected devices, Online, Offline, Needs calibration, Events today and Battery alerts",
        "The add-device wizard covers Bluetooth, bench, floor and kitchen scales, IoT sensors, barcode and camera stations",
        "Device detail shows firmware, calibration state, live measurements and history, with the operator linked through to ShiftBoard",
        "Automatic capture from a paired scale is in progress; manual logging is the working path today",
      ],
      screenshot: {
        src: "/screenshots/modules/wastewatch-devices.png",
        alt: "WasteWatch devices screen listing connected scales and stations with status, battery, last sync and current user.",
        label: "app.vyso.co.za/wastewatch/devices",
      },
    },
  ],
  workflow: [
    {
      title: "Log it where it happens",
      copy:
        "“+ Log waste” sits on every tab. Item, quantity, unit, category, cost, reason and optionally the recipe — a few seconds, close to the moment, rather than a reconstruction on Friday.",
    },
    {
      title: "Read the weekly report on Monday",
      copy:
        "What it cost, what share was preventable, which categories and items drove it, and a written list of what to change this week.",
    },
    {
      title: "Fix the recipe, not the person",
      copy:
        "Over-portioning is measured against each recipe's expected quantity, so the correction is usually a portion size or a prep method.",
    },
    {
      title: "Have the coaching conversation with data",
      copy:
        "Preventable waste only, tone-badged per person, with spoilage excluded — a support conversation rather than an accusation.",
    },
    {
      title: "Watch it land in the margin",
      copy:
        "Waste as a share of food cost is the figure margin analysis attributes drift to, and a week-on-week waste spike raises a cross-module anomaly.",
    },
  ],
  worksWith: [
    {
      slug: "pricepilot",
      reason:
        "Waste as a share of food cost is read directly by the margin variance panel — it's the food cost that never reaches an invoice line.",
    },
    {
      slug: "procurepulse",
      reason:
        "Waste events link back to the ProcurePulse ingredient, supplier and batch, and purchase data underpins the food-cost basis.",
    },
    {
      slug: "shiftboard",
      reason:
        "Devices are tied to the operator on shift, which is the foundation for capturing waste per person automatically.",
    },
    {
      slug: "insightgen",
      reason:
        "InsightGen reads waste events for its daily brief and raises an anomaly when 7-day waste cost jumps against the previous seven days.",
    },
  ],
  industryFit: [
    {
      href: "/industries/restaurants",
      name: "Restaurants",
      reason:
        "Portioning, prep errors and day-old stock — the preventable half of food cost that never shows on an invoice.",
    },
    {
      href: "/industries/catering-companies",
      name: "Catering companies",
      reason:
        "Batch production where over-portioning against a recipe is measurable and worth measuring.",
    },
    {
      href: "/industries/food-suppliers",
      name: "Food suppliers",
      reason:
        "Shrinkage across cold store and dispatch, costed by reason so the fix is targeted rather than general.",
    },
  ],
  faqs: [
    {
      question: "Do staff have to type everything in, or does it connect to scales?",
      answer:
        "Both paths are in the product, but only one is finished. Manual logging works today. The Devices tab already registers and monitors paired scales and stations, while automatic weigh-and-log capture is still being wired up — the app says so rather than implying otherwise.",
    },
    {
      question: "How does it know what was preventable and what was just spoilage?",
      answer:
        "Every event carries a reason code. Over-portioned, prep error and damaged are treated as preventable; spoilage and expiry are not — and the coaching view deliberately excludes the unavoidable half so nobody is flagged for produce that arrived past its best.",
    },
    {
      question: "Does this actually connect to our margin numbers?",
      answer:
        "Yes. Waste as a share of food cost is computed against real purchase data, or against sales and your target margin where purchase data is thin — and it is the figure the pricing module attributes margin drift to.",
    },
    {
      question: "Will it flag a problem, or do we have to go looking?",
      answer:
        "InsightGen carries a waste-spike rule: if 7-day waste cost runs a set percentage above the previous seven days, it surfaces as a cross-module anomaly with the rule that fired it printed on the card.",
    },
    {
      question: "Can we set our own waste categories?",
      answer:
        "Yes. Categories are yours to create, rename, recolour and remove from the Analytics tab. Categories that appeared from the log itself are marked as such, and every total is recomputed from the log so the tabs always agree.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/reduce-money-leakage", "/solutions/operations-dashboard"],
  relatedIndustryHrefs: ["/industries/restaurants", "/industries/catering-companies"],
  appUrlLabel: "app.vyso.co.za/wastewatch",
};
