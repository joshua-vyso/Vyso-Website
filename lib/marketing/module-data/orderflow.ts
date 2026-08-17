import type { MarketingModule } from "../module-types";

export const orderflow: MarketingModule = {
  slug: "orderflow",
  name: "OrderFlow",
  role: "Orders, invoicing & customer operations",
  tagline: "From incoming order to fulfilment and invoicing in one flow.",
  description:
    "OrderFlow connects the commercial work your team repeats every day: customers, quotes, orders, invoices, delivery documents, payments and price lists — inside one clear operating workflow, instead of the same commercial record being rebuilt at each step.",
  capabilities: [
    "Customer records with quotes, orders and invoices kept on one account history",
    "Price lists and customer-specific pricing applied automatically when quoting or invoicing",
    "Invoices, credit notes and delivery notes generated from the same originating order",
    "Payment tracking against outstanding invoices, so collections stay visible",
    "Rebate and customer-term handling built into the commercial workflow",
    "A dashboard view of orders ready to invoice and current outstanding balances",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/orderflow-invoicing.png",
      alt: "OrderFlow invoices screen showing outstanding, overdue and due-this-week balances for a demo wholesale business.",
      label: "app.vyso.co.za/orderflow/invoices",
    },
    {
      src: "/screenshots/modules/orderflow-overview.png",
      alt: "OrderFlow dashboard with revenue, outstanding balances and recent invoices.",
      label: "app.vyso.co.za/orderflow",
    },
  ],
  featureSections: [
    {
      id: "dashboard",
      title: "One screen that answers “where is our money?”",
      copy:
        "Most order books can tell you what was sold. The OrderFlow dashboard is built to tell you what is still owed and what is about to go late. Revenue this month carries a seven-month sparkline and a month-on-month delta, and the Outstanding tile splits what you're owed across an ageing bar rather than showing one unhelpful total.",
      bullets: [
        "The ageing bar on “Outstanding · owed to you” splits the balance into not yet due, 1–30, 31–60 and 60+ days overdue",
        "Secondary chips track Quote requests, Quotes awaiting, Orders to invoice, Customers and Open invoices",
        "Global search (⌘K) runs across customers, quotes, orders and invoices from anywhere in the module",
        "Revenue and outstanding tiles are admin-gated, so members see the operational picture without the money",
      ],
      screenshot: {
        src: "/screenshots/modules/orderflow-overview.png",
        alt: "OrderFlow dashboard showing revenue this month, invoices today, outstanding with an ageing bar, and recent invoices.",
        label: "app.vyso.co.za/orderflow",
      },
    },
    {
      id: "orders",
      title: "Orders that arrive as a photo, not a form",
      copy:
        "Customers send orders the way that suits them — a WhatsApp screenshot, an emailed PDF, a photograph of a scribbled list. “↑ Upload order” pushes that file through Doc-U's extraction, matches the customer and every line against your catalogue, prices it and hands you back a real order. Anything the system is not confident about is held as a draft instead of being guessed at.",
      bullets: [
        "The KPI strip tracks Today's orders, Pending confirmation, Ready to invoice, Delivered today, Outstanding value and Avg order value",
        "A clickable stepper moves an order Draft → Confirmed → Picking → Packed → Out for delivery → Delivered",
        "Select rows for bulk “Generate invoices”, “Export CSV”, “Mark delivered” or “Cancel orders”",
        "An uploaded order auto-invoices only when the customer match clears its confidence threshold and every line has a resolvable price",
      ],
      screenshot: {
        src: "/screenshots/modules/orderflow-orders.png",
        alt: "OrderFlow orders list with status, payment, items, delivery and total columns plus an orders-needing-attention panel.",
        label: "app.vyso.co.za/orderflow/orders",
      },
    },
    {
      id: "quotes",
      title: "Website enquiries, triaged before they become work",
      copy:
        "Quote requests submitted through your public contact form land in a review inbox above the quotes list. Nothing is priced or linked to a customer until someone drafts the quote — and the enquirer's raw message sits read-only beside the builder rather than being pasted into a document that also carries your banking details.",
      bullets: [
        "Each request offers “Draft a quote” or “Dismiss”, with likely-spam rows flagged for a human to confirm or override with “Not spam”",
        "KPIs cover Open quote value (draft + sent), Awaiting decision and Accepted this month",
        "A drafted quote converts straight to an order or an invoice without re-keying line items",
        "Website request lines are deliberately not auto-priced — a person picks the product and therefore the price",
      ],
      screenshot: {
        src: "/screenshots/modules/orderflow-quotes.png",
        alt: "OrderFlow quotes screen showing open quote value, quotes awaiting decision and the quote table.",
        label: "app.vyso.co.za/orderflow/quotes",
      },
    },
    {
      id: "payments",
      title: "Every receipt against the invoice it settles",
      copy:
        "Payments is the single ledger of money actually received, reconciled against invoice balances rather than tracked in a separate spreadsheet. Recording a payment updates the invoice's balance panel, which breaks the total down through rebate, paid, credited and balance due.",
      bullets: [
        "The table carries Date, Customer, Invoice, Amount, Method, Reference and Receipt so proof of payment stays attached",
        "KPIs show Received this month, Received today, Outstanding and Overdue invoices",
        "Recording a payment is admin-gated and starts from an invoice picker, so receipts can't land on the wrong document",
        "Credit notes raised against an invoice appear on the same balance panel, keeping the audit trail in one place",
      ],
      screenshot: {
        src: "/screenshots/modules/orderflow-payments.png",
        alt: "OrderFlow payments ledger showing received this month, outstanding and a table of payments with method and reference.",
        label: "app.vyso.co.za/orderflow/payments",
      },
    },
    {
      id: "customers",
      title: "A customer record that learns how that customer orders",
      copy:
        "The customer book holds real financial standing, not just contact details — terms, credit limit, outstanding balance and last invoice. Open a profile and you also get the rules that make automation reliable for that specific account: how they write their order lines, which price basis to invoice on, and how confident the system must be before it invoices without you.",
      bullets: [
        "The list shows Customer, Type, Terms, Outstanding, Last invoice and Status; the profile adds Lifetime invoiced and Outstanding",
        "“Order mappings” translate a customer's own wording — “FF - NAARTJIES Box” — to a clean catalogue item, invoice name and billing unit",
        "Per-customer settings cover VAT treatment, price basis (your price list or the document's own price), prefix stripping and a payment-terms override",
        "The auto-invoice confidence threshold is per customer, so a messy account can be held for review while a tidy one runs unattended",
      ],
      screenshot: {
        src: "/screenshots/modules/orderflow-customers.png",
        alt: "OrderFlow customers list showing customer type, payment terms, outstanding balance, last invoice and account status.",
        label: "app.vyso.co.za/orderflow/customers",
      },
    },
    {
      id: "documents",
      title: "Credit notes and delivery documents that keep the trail intact",
      copy:
        "Reversing a sale is where most systems quietly lose the thread. In OrderFlow a credit note is a real document raised against a specific invoice, and cancelling an invoice reverts the linked order to confirmed and returns the stock it took out. Delivery notes work the same way — generated from an order or invoice, then closed off with proof of delivery.",
      bullets: [
        "Credit notes list Credit #, Customer, Against invoice, Issued, Total, Reason and Status, with Total credited and Credited this month above",
        "Delivery notes filter by All, Draft, Out for delivery and Delivered, and capture a signed-by name on delivery",
        "Proof-of-delivery files attach to the note itself, so the evidence lives with the document rather than on a phone",
        "Cancelling an invoice explicitly reverses the stock movement it created — the reversal is part of the workflow, not a clean-up job",
      ],
      screenshot: {
        src: "/screenshots/modules/orderflow-credit-notes.png",
        alt: "OrderFlow credit notes screen showing total credited, credited this month and credit notes raised against invoices.",
        label: "app.vyso.co.za/orderflow/credit-notes",
      },
    },
  ],
  workflow: [
    {
      title: "Open the dashboard before anything else",
      copy:
        "The ageing bar tells you in one glance whether the problem this week is new sales or old money. Overdue reads “✓ nothing past due” when there genuinely is nothing to chase.",
    },
    {
      title: "Take orders however they arrive",
      copy:
        "Photograph, forward or upload the customer's order and let extraction do the typing — or use Quick order with “↻ Repeat last order” for the accounts that buy the same thing every week.",
    },
    {
      title: "Confirm, pick and dispatch",
      copy:
        "Move the order along its stepper, raise a delivery note as a picking slip, and close it off with a signed-by name and a proof-of-delivery file.",
    },
    {
      title: "Invoice from the order, not from scratch",
      copy:
        "Generate the invoice off the order that already carries the customer, price list and rebate. Standing rebate percentages are snapshotted onto the invoice and deducted automatically.",
    },
    {
      title: "Chase what is actually outstanding",
      copy:
        "Work the overdue bucket from Invoices, record receipts against the right invoice in Payments, and raise a credit note when something genuinely needs reversing.",
    },
  ],
  worksWith: [
    {
      slug: "doc-u",
      reason:
        "Doc-U extracts an uploaded customer order and OrderFlow turns it into a matched, priced order — creating the customer and catalogue items it needs along the way.",
    },
    {
      slug: "procurepulse",
      reason:
        "Every invoiced order writes a negative stock movement and decrements on-hand in ProcurePulse — and cancelling the invoice reverses it.",
    },
    {
      slug: "pricepilot",
      reason:
        "OrderFlow price lists and per-item overrides are the same records PricePilot reads, so a margin rule set in one place applies in the other.",
    },
    {
      slug: "insightgen",
      reason:
        "InsightGen rebuilds sales and revenue trends straight from OrderFlow order lines, using the same derivation as the pricing module.",
    },
  ],
  industryFit: [
    {
      href: "/industries/food-suppliers",
      name: "Food suppliers",
      reason:
        "Repeat customers, contract prices and daily delivery documents — the exact chain OrderFlow is built around.",
    },
    {
      href: "/industries/farms",
      name: "Farms & producers",
      reason:
        "Wholesale buyers with their own terms and rebates, ordering against availability that changes week to week.",
    },
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "High document volume where a quote, order, delivery note and invoice all describe the same transaction.",
    },
  ],
  faqs: [
    {
      question: "Can staff photograph or forward a customer's order instead of typing it in?",
      answer:
        "Yes. “↑ Upload order” accepts a PDF, photo or WhatsApp screenshot. Doc-U extracts the line items, OrderFlow matches the customer and products against your records, prices the lines and creates the order — auto-invoicing it when the match is confident enough.",
    },
    {
      question: "Will it invoice the wrong customer or price off a messy order?",
      answer:
        "No. Auto-invoicing only fires when the customer-match confidence clears a threshold (80 by default, configurable per customer) and every line has a resolvable price. Anything short of that is held as a draft order and routed to Doc-U review for a person to confirm.",
    },
    {
      question: "Does selling something in OrderFlow update stock automatically?",
      answer:
        "Yes. The moment an order is invoiced, a negative “sale” movement is logged against each line and on-hand quantities drop in ProcurePulse. Cancelling the order or the invoice reverses the movement rather than leaving stock understated.",
    },
    {
      question: "What happens to quote requests from our website contact form?",
      answer:
        "They land in a dedicated review inbox above the quotes list. Likely spam is flagged for a human rather than filtered away, and nothing is priced or attached to a customer record until someone drafts the quote.",
    },
    {
      question: "Can we connect OrderFlow to Xero?",
      answer:
        "There is a Xero connection an owner or admin can authorise under Settings, but invoice and payment syncing is not wired to it yet. We would rather say that plainly than let you plan around a sync that does not exist today.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/reduce-money-leakage", "/solutions/operations-dashboard"],
  relatedIndustryHrefs: ["/industries/food-suppliers", "/industries/farms"],
  appUrlLabel: "app.vyso.co.za/orderflow",
  group: "orders-money",
  status: "LIVE",
  agents: ["RECON", "DEBTORS", "THE BRIEF"],
  howFinchUsesIt:
    "Recon reads OrderFlow's orders, invoices and delivery notes to check what was invoiced against what actually left the warehouse. Debtors reads the same outstanding-balance and ageing data to watch accounts before they turn into bad debt, and the Brief carries both into your weekly summary.",
};
