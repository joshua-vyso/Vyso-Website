import type { MarketingModule } from "../module-types";

export const procurepulse: MarketingModule = {
  slug: "procurepulse",
  name: "ProcurePulse",
  role: "Procurement & stock intelligence",
  tagline: "Buying decisions grounded in real stock movement.",
  description:
    "ProcurePulse builds live stock from the supplier documents you already scan, tracks per-product thresholds, compares what every supplier charges you, and turns a shortage into a costed order your team can actually send.",
  capabilities: [
    "Live stock levels built automatically from scanned supplier invoices, statements and delivery notes",
    "Per-product low, par, lead-time and freshness thresholds that drive severity-ranked alerts",
    "AI-assisted product matching that reconciles messy invoice names against your catalogue",
    "A supplier price-comparison matrix showing who is cheapest per product and the saving on the table",
    "Suggested orders grouped by supplier, totalled with VAT and tracked as order history",
    "Recipes costed against live stock, with the limiting ingredient named before you start a batch",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/procurepulse-overview.png",
      alt: "ProcurePulse dashboard showing stock value, items low, out of stock and stock by category.",
      label: "app.vyso.co.za/procurepulse",
    },
    {
      src: "/screenshots/modules/procurepulse-intelligence.png",
      alt: "ProcurePulse procurement intelligence matrix comparing supplier prices per product.",
      label: "app.vyso.co.za/procurepulse/intelligence",
    },
  ],
  featureSections: [
    {
      id: "live-stock",
      title: "Stock levels that build themselves",
      copy:
        "ProcurePulse has no clipboard step. Live stock is assembled from the supplier invoices, delivery notes and market statements Doc-U has already read, and it keeps itself current in the background rather than waiting for someone to remember. Each product shows both its purchase unit and a kilogram figure derived from the weights on those same documents.",
      bullets: [
        "Columns run Product, Stock on hand (kg), Units on hand, Stock status, Recent activity, Updated and Category",
        "“Recent activity” reads the latest OrderFlow order quantity per item, so sales and stock aren't two separate stories",
        "Filter by All, Low or Out and by category, then jump straight to “Reorder low”",
        "“✦ Categorise” sorts an uncategorised catalogue into categories in bulk; “+ Add stock” handles the manual top-up",
      ],
      screenshot: {
        src: "/screenshots/modules/procurepulse-stock.png",
        alt: "ProcurePulse live stock table showing stock on hand, units, status, recent activity and category per product.",
        label: "app.vyso.co.za/procurepulse/stock",
      },
    },
    {
      id: "products",
      title: "One catalogue, even when suppliers can't spell",
      copy:
        "Supplier documents never name a product the same way twice, which is how a catalogue quietly grows four versions of the same tomato. Product matching surfaces the likely duplicates for you to confirm or dismiss, then remembers the decision so the next document routes straight to the right item.",
      bullets: [
        "Matches are tagged “Exact match” or scored by AI with the reasoning shown, and never merged automatically",
        "Confirming a match merges movements, order lines and reorder requests onto the surviving item and sums the on-hand quantities",
        "The Thresholds tab sets Low, Par, Lead time, Freshness, Alerts and Notes per product — lettuce two days, broccoli three",
        "The Units tab records how a product is purchased, stocked and used in recipes, with the conversion factor between them",
      ],
      screenshot: {
        src: "/screenshots/modules/procurepulse-products.png",
        alt: "ProcurePulse products screen with the master catalogue and a product matching section for reconciling discovered names.",
        label: "app.vyso.co.za/procurepulse/products",
      },
    },
    {
      id: "alerts",
      title: "Shortages ranked by how much they matter",
      copy:
        "A low-stock list is only useful if it tells you what to do about it. Every alert carries the on-hand quantity, the threshold it fell below, a suggested order quantity and the cheapest supplier currently quoting on that item — so the decision and the action sit on the same row.",
      bullets: [
        "Columns run Product, Pack, Severity, On hand, Threshold, Suggested, Best supplier and Actions",
        "Severity shows as Low or Out, sorted worst-first, with “Reorder all” to sweep the whole list into an order",
        "Best supplier shows the cheapest current price for that item, or “No quote” when nobody has priced it",
        "Snooze clears a row for the session when you already know about it, without pretending the stock is there",
      ],
      screenshot: {
        src: "/screenshots/modules/procurepulse-alerts.png",
        alt: "ProcurePulse low-stock alerts table with severity, on hand, threshold, suggested quantity and best supplier.",
        label: "app.vyso.co.za/procurepulse/alerts",
      },
    },
    {
      id: "reorder",
      title: "From “we're short” to an order the team can send",
      copy:
        "Stock orders puts the system's suggestions and your own requests on one page, grouped by supplier with subtotals, so a buyer isn't reconciling three lists in their head. The summary rail totals it excluding and including VAT before anything is sent, and every sent order is kept as history by week.",
      bullets: [
        "“Suggested from low stock” lists Product, Qty, Unit price and Line total, grouped by supplier with a subtotal per supplier",
        "Add your own requests with product, quantity, unit, supplier and a note, then mark them ordered as they're placed",
        "The order summary breaks out suggested items, suppliers, your requests and VAT at 15% before the total",
        "Order history groups sent orders by week with item count, supplier, status and total",
      ],
      screenshot: {
        src: "/screenshots/modules/procurepulse-reorder.png",
        alt: "ProcurePulse stock orders screen showing suggested low-stock lines grouped by supplier with an order summary.",
        label: "app.vyso.co.za/procurepulse/reorder",
      },
    },
    {
      id: "intelligence",
      title: "Who is actually cheapest, per product",
      copy:
        "Once several suppliers' documents have been read, the price you pay stops being a matter of opinion. The intelligence matrix puts one column per supplier against one row per product, marks the cheapest price and shows the saving available on the dearest line — all built from the documents you already scanned.",
      bullets: [
        "A matrix of Product against every discovered supplier, with the cheapest cell highlighted and “—” where nobody has quoted",
        "A “Best saving” column quantifies the gap between what you pay and the cheapest quote on file",
        "A top-opportunities rail surfaces the items where switching supplier is worth the most",
        "Prices come from scanned documents rather than a manually maintained list, so the comparison ages with your buying",
      ],
      screenshot: {
        src: "/screenshots/modules/procurepulse-intelligence.png",
        alt: "ProcurePulse procurement intelligence matrix comparing per-product prices across suppliers with a best saving column.",
        label: "app.vyso.co.za/procurepulse/intelligence",
      },
    },
    {
      id: "recipes",
      title: "How many batches can we actually make right now?",
      copy:
        "Recipes turn tracked stock into finished items, and answers the question a kitchen or pack-house asks every morning before it becomes a problem at two in the afternoon. Each recipe shows how many batches your current stock supports, which ingredient is the constraint, and what a batch costs in stock terms.",
      bullets: [
        "KPIs cover Active recipes, Short on stock, Stock value for one batch each, and your most-used ingredient",
        "Every card shows a readiness badge — “Make N now”, “Short on stock” or “Link ingredients” — with the limiting ingredient named",
        "The batch plan takes a batch count and returns the per-ingredient shortfall with a total stock cost for the run",
        "“Reorder what's short” hands the shortfall straight into a stock order",
      ],
      screenshot: {
        src: "/screenshots/modules/procurepulse-recipes.png",
        alt: "ProcurePulse recipes screen showing active recipes, batches available now and stock cost per batch.",
        label: "app.vyso.co.za/procurepulse/recipes",
      },
    },
  ],
  workflow: [
    {
      title: "Scan the delivery paperwork",
      copy:
        "Supplier invoices, delivery notes and market statements go into Doc-U. That is the whole data-entry step — stock is a consequence of it, not a separate task.",
    },
    {
      title: "Tidy the names once",
      copy:
        "Confirm any product matches the system flags. The mapping is remembered, so the same supplier's odd wording routes correctly from then on.",
    },
    {
      title: "Let the thresholds do the watching",
      copy:
        "Low, par, lead time and freshness are set per product. Alerts rank what's below threshold by severity instead of asking someone to eyeball a list.",
    },
    {
      title: "Send one order, not five messages",
      copy:
        "Sweep the alerts into a suggested order, add anything your team asked for, check the total including VAT and send it to the team — where it stays as history.",
    },
    {
      title: "Check the price you're paying",
      copy:
        "Once a few weeks of documents have landed, the intelligence matrix shows whether you're buying from the cheapest supplier or just the most familiar one.",
    },
  ],
  worksWith: [
    {
      slug: "doc-u",
      reason:
        "Doc-U's extracted invoices, statements and delivery notes are ProcurePulse's primary data-in path — this is how stock levels exist at all.",
    },
    {
      slug: "orderflow",
      reason:
        "An invoiced OrderFlow sale writes a negative stock movement here, and Live stock reads recent OrderFlow order quantities per item.",
    },
    {
      slug: "pricepilot",
      reason:
        "PricePilot builds sell prices on top of ProcurePulse's product costs — its own empty state says the products and their costs are already here.",
    },
    {
      slug: "supplysync",
      reason:
        "SupplySync scores and compares your suppliers, then hands the buying decision back to ProcurePulse rather than duplicating it.",
    },
  ],
  industryFit: [
    {
      href: "/industries/restaurants",
      name: "Restaurants",
      reason:
        "Recipe-level costing and freshness thresholds set per ingredient, for stock that goes off in days rather than months.",
    },
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "Many suppliers quoting the same lines, where knowing who is cheapest this week is the whole margin.",
    },
    {
      href: "/industries/catering-companies",
      name: "Catering companies",
      reason:
        "Batch production planned against live stock, with the limiting ingredient known before the prep list is written.",
    },
  ],
  faqs: [
    {
      question: "Do we have to count and enter stock manually?",
      answer:
        "No — that is the point. Live stock is built from the supplier invoices, delivery notes and market statements already scanned into Doc-U, and re-syncs itself in the background. A manual “Add stock” option exists as a fallback rather than the default path.",
    },
    {
      question: "Our suppliers never spell product names the same way twice. Will that create duplicates?",
      answer:
        "Product matching catches them. An exact-match pass plus an optional AI scan surfaces likely duplicates for you to confirm or dismiss — never merging on its own — and remembers each confirmed mapping so future documents route straight to the right item.",
    },
    {
      question: "Can it tell us who is cheapest for a given ingredient?",
      answer:
        "Yes. Procurement intelligence builds a per-product supplier price matrix from your scanned documents, highlights the cheapest supplier per line and shows the saving available against what you're currently paying.",
    },
    {
      question: "Will we know about a shortage before it stops a batch?",
      answer:
        "The recipe editor computes how many batches your current stock supports, names the limiting ingredient, and links straight to “Reorder what's short” — so the constraint is visible at planning time rather than mid-production.",
    },
    {
      question: "Does ProcurePulse do cycle counts?",
      answer:
        "Not yet. The Counts tab is a placeholder for planned stock-accuracy work and does nothing today. Everything you see on Live stock is derived from document feeds, sales movements and manual adjustments.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/procurement-automation", "/solutions/reduce-money-leakage"],
  relatedIndustryHrefs: ["/industries/restaurants", "/industries/wholesale"],
  appUrlLabel: "app.vyso.co.za/procurepulse",
};
