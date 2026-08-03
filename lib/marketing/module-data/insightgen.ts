import type { MarketingModule } from "../module-types";

export const insightgen: MarketingModule = {
  slug: "insightgen",
  name: "InsightGen",
  role: "Reporting & operational insight",
  tagline: "Cross-workflow data, turned into reports and alerts.",
  description:
    "InsightGen reads the other modules directly — orders, waste, shifts, stock and suppliers — and turns them into a daily brief, a transparent rule-based alert set and CSV exports of the raw rows behind every number.",
  capabilities: [
    "A Daily Ops Brief assembled live from five modules' own tables",
    "Threshold alerts across margin, supplier pricing, labour, waste, stock and supplier risk",
    "Every alert states the exact rule and threshold that fired it",
    "A filterable cross-module insight feed with CSV export",
    "Five raw-row datasets you can preview, scope by date and export",
    "Saved report definitions you can re-run and export on demand",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/insightgen-overview.png",
      alt: "InsightGen overview showing the Daily Ops Brief, open anomalies and 14-day sales and waste trends.",
      label: "app.vyso.co.za/insightgen",
    },
    {
      src: "/screenshots/modules/insightgen-insights.png",
      alt: "InsightGen insight feed filtered by module and severity.",
      label: "app.vyso.co.za/insightgen/insights",
    },
  ],
  featureSections: [
    {
      id: "anomalies",
      title: "Alerts that show their working",
      copy:
        "InsightGen does not pretend to be a model, and says so on the screen: the anomalies are rule-based, not modelled. Six fixed rules run against your own rows, and every card prints the rule and threshold that fired it — which makes an alert something you can argue with, tune or trust, rather than something you have to take on faith.",
      bullets: [
        "The rule book is published in the app: food-cost variance, supplier price jump, labour spike, waste spike, low stock and open supplier risk",
        "Each card carries the severity, the module it came from, the metric and value, the rule text, and an acknowledge or reopen action",
        "KPIs cover Open anomalies, Critical, Acknowledged, Rules evaluated and the window in days",
        "When nothing fires it says so outright — margin, supplier pricing, labour, waste and stock are all inside their thresholds",
      ],
      screenshot: {
        src: "/screenshots/modules/insightgen-anomalies.png",
        alt: "InsightGen anomalies screen showing detected anomalies with their severity, metric and the rule that fired.",
        label: "app.vyso.co.za/insightgen/anomalies",
      },
    },
    {
      id: "insights",
      title: "One feed across every module",
      copy:
        "The insight feed is where the cross-module picture actually shows up: week-on-week sales, margin against target, waste trend and preventability, labour, stock and supplier risk in one filterable list. Each row is labelled by where it came from — computed live from your rows this request, or stored — so you always know what you are reading.",
      bullets: [
        "Filter by module, by severity (Critical, Watch, Info, Positive) and by origin (derived now or stored)",
        "Each row shows a severity dot, the finding, the metric value, and badges for anomaly status and source module",
        "Derived insights are recomputed on every load over the rolling window rather than cached and quietly aged",
        "Export the filtered feed to CSV with severity, module, origin, insight, metric and value",
      ],
      screenshot: {
        src: "/screenshots/modules/insightgen-insights.png",
        alt: "InsightGen insight feed with module, severity and origin filters over a list of cross-module findings.",
        label: "app.vyso.co.za/insightgen/insights",
      },
    },
    {
      id: "reports",
      title: "Reports that hand you the rows, not a picture of them",
      copy:
        "The report builder is deliberately unglamorous: choose the datasets, choose the range, preview it and export the raw rows. The CSV is the underlying data with no rounding or summarising applied — which is what makes it useful to a bookkeeper or an accountant rather than only to a dashboard.",
      bullets: [
        "Five datasets: Sales lines, Waste events, Labour, Stock levels and Suppliers — each with its real column set and live row count",
        "Scope the selection to the last 7 days, last 30 days or the full window, then preview before exporting",
        "Saved report definitions list Report name, Scope, Modules, Schedule, Last run, Owner and Status, and re-run on demand",
        "Every row came from an org-scoped query against the source module's own table on that request",
      ],
      screenshot: {
        src: "/screenshots/modules/insightgen-reports.png",
        alt: "InsightGen reports screen with dataset picker cards, a preview table and saved report definitions.",
        label: "app.vyso.co.za/insightgen/reports",
      },
    },
    {
      id: "sources",
      title: "Where the numbers actually come from",
      copy:
        "InsightGen holds no data of its own worth speaking of. Every figure is recomputed on each page load from the source modules' own tables over a rolling 60-day window, and the overview names them on the screen rather than making you take it on trust. A KPI tile tells you how many of those modules are currently feeding it.",
      bullets: [
        "The Daily Ops Brief reads sales yesterday, waste logged yesterday, staff on shift today, stock alerts and open supplier risks",
        "The brief's own footnote names its sources: orders, waste events, attendance, stock items and supplier records — no stored snapshot",
        "A “Modules feeding data” tile shows how many of the source modules are connected, and lists them",
        "Twin 14-day sparklines track sales and waste, each captioned with the derivation behind it",
      ],
      screenshot: null,
    },
  ],
  workflow: [
    {
      title: "Read the brief with your coffee",
      copy:
        "Sales yesterday, waste yesterday, who is on today, stock alerts and open supplier risks — assembled from five modules without anyone compiling anything.",
    },
    {
      title: "Work “Needs attention”",
      copy:
        "Open anomalies are listed with the module they came from. If nothing fired, the screen says so rather than filling the space.",
    },
    {
      title: "Check the rule before you act on the alert",
      copy:
        "Each card prints its rule and threshold, so you can tell the difference between a genuine outlier and a threshold set too tight.",
    },
    {
      title: "Acknowledge what you have handled",
      copy:
        "Acknowledged anomalies drop out of the default view and can be reopened, so the list stays a working queue.",
    },
    {
      title: "Export what the accountant asked for",
      copy:
        "Pick the datasets and the range, preview, export the raw rows. Save the selection as a definition when it's a report you run every month.",
    },
  ],
  worksWith: [
    {
      slug: "orderflow",
      reason:
        "Sales, revenue trends and the sales-lines dataset are rebuilt from OrderFlow order lines on non-draft orders.",
    },
    {
      slug: "wastewatch",
      reason:
        "Waste cost and the waste-spike rule read WasteWatch events directly, including the preventable split.",
    },
    {
      slug: "shiftboard",
      reason:
        "Labour cost and labour percentage of same-day sales are computed from ShiftBoard rosters and attendance.",
    },
    {
      slug: "supplysync",
      reason:
        "Open supplier risks and supplier price jumps come from SupplySync's register and price history.",
    },
  ],
  industryFit: [
    {
      href: "/industries/hospitality",
      name: "Hospitality",
      reason:
        "Food cost, labour and waste that only make sense read together, not as three separate weekly reports.",
    },
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "Board packs and monthly summaries that currently take a day to compile from five different places.",
    },
    {
      href: "/industries/restaurants",
      name: "Restaurants",
      reason:
        "A morning brief covering yesterday's sales, waste and today's cover — instead of a manager's mental checklist.",
    },
  ],
  faqs: [
    {
      question: "Is InsightGen using AI to find these anomalies?",
      answer:
        "No, and we would rather be straight about it. The anomalies come from a fixed six-rule book run against your own rows — the app labels them rule-based, not modelled, and prints the rule on each card. Vyso does use AI elsewhere, in document extraction and product matching, but not here.",
    },
    {
      question: "Which modules does InsightGen need connected?",
      answer:
        "It reads OrderFlow for sales, WasteWatch for waste, ShiftBoard for labour, ProcurePulse for stock, SupplySync for suppliers and PlanWise for your margin target, with Doc-U selectable as a report scope. A tile on the overview shows how many are currently feeding it.",
    },
    {
      question: "Can we export the underlying data, or is it only a dashboard?",
      answer:
        "Every dataset in Reports exports as raw-row CSV — the data itself, not a rendered summary — and the anomalies and insight feeds each have their own CSV export with defined columns.",
    },
    {
      question: "What happens if we haven't set up the other modules yet?",
      answer:
        "Every screen has an explicit empty state explaining that InsightGen needs source-module rows before anything appears. Nothing is faked, defaulted or filled with sample numbers.",
    },
    {
      question: "How far back does it look?",
      answer:
        "A rolling 60-day window, shown on screen, with the report builder able to narrow to the last 7 or 30 days.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/reporting-automation", "/solutions/operations-dashboard"],
  relatedIndustryHrefs: ["/industries/hospitality", "/industries/wholesale"],
  appUrlLabel: "app.vyso.co.za/insightgen",
};
