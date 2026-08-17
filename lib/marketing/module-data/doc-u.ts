import type { MarketingModule } from "../module-types";

export const docU: MarketingModule = {
  slug: "doc-u",
  name: "Doc-U",
  role: "Document intake & extraction",
  tagline: "Turn incoming documents into reviewable data, not retyped data.",
  description:
    "Doc-U captures operational documents — supplier invoices, statements, delivery notes, price lists and customer orders — and turns their fields and line items into structured, reviewable data instead of manual recapture.",
  capabilities: [
    "Upload, forward by email or hand a document to the assistant for automatic field and line-item extraction",
    "A review queue with confidence scoring, so uncertain reads get a human check before they count",
    "A per-field confidence breakdown across supplier, number, date, total, line items, VAT and document type",
    "Rule-based flags for duplicate invoices, unknown suppliers and low-confidence reads",
    "Supplier statements reconciled month by month and exported as CSV",
    "Core Data: the shared customer, product, price-list and company records every other module reads",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/docu-overview.png",
      alt: "Doc-U documents hub showing folders by document type with total documents, awaiting review and average confidence.",
      label: "app.vyso.co.za/docu",
    },
    {
      src: "/screenshots/modules/docu-reconciliation.png",
      alt: "Doc-U reconciliation view showing supplier statement totals grouped by month.",
      label: "app.vyso.co.za/docu/reconciliation",
      cropTop: true,
    },
  ],
  featureSections: [
    {
      id: "intake",
      title: "Three ways in, one filing system",
      copy:
        "A document can be uploaded by hand, forwarded to your organisation's own intake address, or handed to the assistant in chat — and all three land in the same place, extracted the same way. The hub organises them by folder and month rather than as one endless list, with the counts that matter sitting above it.",
      bullets: [
        "Default folders for Invoices, Statements, Delivery notes, Price lists and Orders, plus any custom folders you add",
        "KPI tiles show Total documents, Awaiting review (extracted + pending) and Avg confidence over the last 7 days",
        "Uploads accept PDF, JPG or PNG up to 20MB and start extracting immediately",
        "Every inbound email is recorded once and only once, so a forwarded document can't be processed twice",
      ],
      screenshot: null,
    },
    {
      id: "awaiting",
      title: "A queue of what still needs your eyes",
      copy:
        "“Awaiting review” filters the archive down to documents that have been extracted or are still processing but haven't been signed off. It is the working list — not the whole library — so the question each morning is “what's left”, not “what came in”.",
      bullets: [
        "Scoped to documents at extracted or pending status, with the same search, filter and upload controls as the hub",
        "Rows carry the document type, supplier, date, line count and confidence percentage at a glance",
        "A separate Confidence view re-sorts everything lowest-confidence-first, so the riskiest reads surface without hunting",
        "The Review tab in the module bar carries a live count whenever the queue isn't empty",
      ],
      screenshot: {
        src: "/screenshots/modules/docu-awaiting.png",
        alt: "Doc-U awaiting review screen listing extracted documents ready to be checked.",
        label: "app.vyso.co.za/docu/awaiting",
      },
    },
    {
      id: "commit-gate",
      title: "Nothing updates your stock or invoices until you save",
      copy:
        "Automated intake only works if you trust it, so the rule is written into the code rather than the marketing. Documents that arrive by email are held, uncommitted, in a review queue until an owner or admin presses Save. Uploads a person made themselves commit inline, because a human was already there.",
      bullets: [
        "The review queue states it plainly: nothing updates your stock, orders or invoices until you Save",
        "Save and Discard are owner/admin actions — everyone else sees the queue but can't commit it",
        "Two people can't double-commit the same document; the save is claimed atomically, and a stalled claim is safely retried after five minutes",
        "Discarding a document leaves the queue without touching anything downstream",
      ],
      screenshot: null,
    },
    {
      id: "confidence",
      title: "Confidence you can inspect field by field",
      copy:
        "An overall confidence score tells you very little when the total is right and the invoice number is wrong. Doc-U breaks the read into seven separate categories with a coloured bar each, and tells you how many fields fell below 90% so you know exactly where to look.",
      bullets: [
        "Scored separately for Supplier, Invoice number, Date, Total amount, Line items, VAT / tax and Document type",
        "Bars run green at 90% and above, amber from 70%, red below — with a footer note counting the fields worth a check",
        "Rule-based flags call out a Duplicate invoice, an Unknown supplier, a Credit note detected or a Low-confidence extraction",
        "The extracted data sits beside the original file — image or PDF — so you're correcting against the source, not from memory",
      ],
      screenshot: {
        src: "/screenshots/modules/docu-confidence.png",
        alt: "Doc-U confidence view listing documents ordered lowest-confidence first.",
        label: "app.vyso.co.za/docu/confidence",
      },
    },
    {
      id: "reconciliation",
      title: "Supplier statements reconciled without retyping totals",
      copy:
        "Statement reconciliation is the job nobody wants and everybody does by hand. Doc-U parses the transaction summary off each uploaded statement, groups them by the month on the statement, and shows a Check column that either balances or tells you by how much it doesn't.",
      bullets: [
        "Columns run Date, Supplier, Opening, Payments, Purchases, Pallet refunds, Pallet usage, VAT, Closing and Check",
        "Check shows a tick when the statement balances, or the discrepancy in red when it doesn't",
        "Each month exports to CSV for your bookkeeper in one click",
        "A banner counts statements whose totals haven't parsed yet, so a gap is visible instead of silent",
      ],
      screenshot: {
        src: "/screenshots/modules/docu-reconciliation.png",
        alt: "Doc-U reconciliation table showing opening, payments, purchases, VAT, closing and a check column by month.",
        label: "app.vyso.co.za/docu/reconciliation",
        cropTop: true,
      },
    },
    {
      id: "core-data",
      title: "Core Data: the records every document is matched against",
      copy:
        "Extraction is only as good as what it can match to. The Databases surface holds the shared master records — customers, contacts, delivery addresses, products, price lists, payment terms, VAT rates, company profile and document templates — and states on each card which downstream module consumes it.",
      bullets: [
        "Nine entities with live row counts, each editable in its own dedicated screen",
        "Customers, contacts, addresses, products and price lists import from an Excel or CSV export",
        "The importer maps your columns onto Vyso's fields in a grid, and saves nothing until you confirm",
        "Company profile and banking details flow straight through onto OrderFlow invoices, quotes and delivery notes",
      ],
      screenshot: {
        src: "/screenshots/modules/docu-databases.png",
        alt: "Doc-U Core Data databases hub showing customers, contacts, products, price lists and company profile cards.",
        label: "app.vyso.co.za/docu/databases",
      },
    },
  ],
  workflow: [
    {
      title: "Forward the post to one address",
      copy:
        "Supplier invoices, statements and delivery notes go to your organisation's intake address as they arrive. Nobody files them; they file themselves into the right folder and month.",
    },
    {
      title: "Extraction does the typing",
      copy:
        "Fields and line items come out structured, with a confidence score per category and the original file kept alongside for comparison.",
    },
    {
      title: "Clear the queue once a day",
      copy:
        "Work “Awaiting review” or the confidence-sorted list, fix what needs fixing, and press Save. That press is the moment anything downstream changes.",
    },
    {
      title: "Data lands where the work happens",
      copy:
        "Saved documents feed stock into ProcurePulse and supplier history into SupplySync; customer orders become priced OrderFlow orders.",
    },
    {
      title: "Reconcile statements at month end",
      copy:
        "Open Reconciliation, check the balancing column, and export the month as CSV instead of rebuilding the summary by hand.",
    },
  ],
  worksWith: [
    {
      slug: "orderflow",
      reason:
        "An extracted customer order becomes a matched, priced OrderFlow order — and a real invoice once the customer match is confident enough.",
    },
    {
      slug: "procurepulse",
      reason:
        "Saved invoices, statements and delivery notes feed line items into ProcurePulse stock, which is how live stock levels build themselves.",
    },
    {
      slug: "supplysync",
      reason:
        "The same documents update each supplier's SupplySync profile, spend rollups and price history without anyone re-keying them.",
    },
    {
      slug: "pricepilot",
      reason:
        "Product cost history in PricePilot links back to the Doc-U document it came from, so a price move has a source you can open.",
    },
  ],
  industryFit: [
    {
      href: "/industries/food-suppliers",
      name: "Food suppliers",
      reason:
        "Daily supplier invoices and market statements that currently get retyped into a spreadsheet before anyone can use them.",
    },
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "High document volume where the same supplier's paperwork has to reconcile against stock, pricing and month-end.",
    },
    {
      href: "/industries/restaurants",
      name: "Restaurants",
      reason:
        "Deliveries arriving with paperwork nobody has time to capture during service, but which drives food cost all the same.",
    },
  ],
  faqs: [
    {
      question: "Will an emailed attachment automatically change our stock or invoices?",
      answer:
        "No. Documents that arrive by email are held at extracted status in the review queue and commit nothing until an owner or admin presses Save. Only uploads a person made themselves commit inline, because someone was already looking at them.",
    },
    {
      question: "What happens if two people approve the same document at once?",
      answer:
        "Only one save proceeds. The commit is claimed atomically on the document record, so the second press is a no-op rather than a duplicate. If a commit crashes mid-way, the stale claim is released after five minutes and can be retried safely.",
    },
    {
      question: "Can we see how confident the extraction was about specific fields?",
      answer:
        "Yes. The confidence breakdown scores seven categories separately — supplier, invoice number, date, total amount, line items, VAT and document type — with a colour band per field and a count of how many fell below 90%.",
    },
    {
      question: "How does Doc-U decide whether to auto-invoice a customer order?",
      answer:
        "It is confidence-gated. An order only auto-invoices when the matched customer clears their confidence threshold — 80 by default, overridable per customer — and every line has a resolvable price. Anything else is held as a draft for a person to confirm.",
    },
    {
      question: "Can we reconcile supplier statements without retyping the totals?",
      answer:
        "Yes. Uploaded statements are grouped by the month on the statement with opening and closing balances, payments, purchases, pallet fees and VAT parsed out, unbalanced statements flagged, and a CSV export per month.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/procurement-automation", "/solutions/reporting-automation"],
  relatedIndustryHrefs: ["/industries/food-suppliers", "/industries/wholesale"],
  appUrlLabel: "app.vyso.co.za/docu",
  group: "documents",
  status: "LIVE",
  agents: ["DOC-U", "PRICE WATCH", "RECON"],
  howFinchUsesIt:
    "Doc-U is Finch's one agent that is already live: it reads every invoice, statement and delivery note the moment they're saved, and every other agent's evidence traces back to a document read here. Price Watch pulls its price history straight from Doc-U's extracted line items; Recon compares what Doc-U read off an invoice against what OrderFlow shows as delivered.",
};
