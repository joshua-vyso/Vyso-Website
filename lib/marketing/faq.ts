/* ── FAQ content ───────────────────────────────────────────────────────────
   Every answer on `/faq` — merged from the old `FAQ_GROUPS` (app/faq) and
   `PRICING_FAQS` (app/pricing-faq, now retired to a 301 → /faq#pricing) and
   rewritten from scratch against the single settled offer
   (`.ai/vyso_v2.md` §0): R6,000 per location per month, everything included;
   the free operations audit (`.ai/plan_home_only.md`, change 4: it was a paid
   week credited to month one and is now a free hour); founding terms (setup
   waived, first
   month free, rate locked); 30 days' notice; expanded mandates priced on
   scope. None of the retired three-tier pricing model survives here — no
   once-off/monthly tier pairs, no per-module add-on rate, no old product
   codename. Grounded product facts that were true before (VAT
   handling, ZAR, OrderFlow, POPIA, role-based access, EFT/cash/card capture)
   are kept, reframed from "the Vyso platform" to "Finch, by Vyso" where that
   reads naturally.

   Every answer opens with a sentence that directly answers the question and
   stays at or under 90 words total. The same question/answer strings feed
   the FAQPage JSON-LD on `/faq` (`ALL_FAQ_QUESTIONS` below) — schema and
   on-page text can never drift apart because there is only one copy. */

export type FaqItem = {
  /** Stable slug — the `<details id>` a deep link (`/faq#<id>`) opens. */
  id: string;
  question: string;
  answer: string;
};

export type FaqGroup = {
  /** Section anchor. `pricing` is load-bearing: `/pricing-faq` 301s to
      `/faq#pricing` (see `next.config.ts`), so this id must stay `pricing`. */
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  questions: readonly FaqItem[];
};

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: "finch",
    eyebrow: "Finch",
    title: "What Finch is",
    description:
      "The product, who it's for, and what it watches today versus what comes from your audit roadmap.",
    questions: [
      {
        id: "what-is-finch",
        question: "What is Finch?",
        answer:
          "Finch is Vyso's AI operations assistant — your company's own COO. It watches invoices, stock, suppliers, debtors and margins, and briefs you on WhatsApp. Vyso is the company that builds and runs it; Finch is the product you use every day.",
      },
      {
        id: "who-is-finch-for",
        question: "Who is Finch for?",
        answer:
          "Finch is built for South African food and produce SMEs — suppliers, farms, restaurants, caterers, wholesalers and hospitality businesses running on WhatsApp, spreadsheets and gut feel. It's most useful once repeated admin or missing information is slowing the business down.",
      },
      {
        id: "only-food-businesses",
        question: "Does Finch only work for food businesses?",
        answer:
          "Food and produce SMEs are the primary focus, and every agent is tuned to that trade — VAT-aware documents, rand pricing, delivery-note reconciliation. We're also running quiet pilots in a couple of adjacent industries. If you're unsure whether Finch fits, the audit will tell you honestly.",
      },
      {
        id: "what-is-orderflow",
        question: "What is OrderFlow?",
        answer:
          "OrderFlow is the order-management module Finch runs on for most food businesses — customers, quotes, orders, invoices, delivery notes, payments and price lists in one connected workflow. It's especially useful for farms, producers, caterers, bakeries, suppliers and distributors who sell repeatedly to other businesses.",
      },
      {
        id: "which-agents-are-live",
        question: "Which agents are live today?",
        answer:
          "Document intelligence (Doc-U) already reads invoices, statements and delivery notes into structured, reviewable line items. Price Watch is rolling out. Recon, Debtors, Stock Sense and The Brief are activated in priority order from your audit roadmap — your roster is set in the audit, not a fixed catalogue.",
      },
      {
        id: "whatsapp-email-orders",
        question: "Can customers keep sending orders through WhatsApp or email?",
        answer:
          "Yes. Finch accepts WhatsApp screenshots, email captures, PDFs and photographed orders for extraction and review. A direct WhatsApp or email integration is confirmed during onboarding.",
      },
      {
        id: "eft-cash-card-payments",
        question: "Can Finch record EFT, cash and card payments?",
        answer:
          "Yes. Your team can record EFT, cash, card and other payments, add a reference, and see what's paid, outstanding and overdue. This records payments and account status — it doesn't mean Finch processes every payment method directly.",
      },
    ],
  },
  {
    id: "pricing",
    eyebrow: "Pricing & terms",
    title: "What it costs",
    description:
      "One offer, no tiers. What R6,000 a month includes, the founding terms, and how cancelling works.",
    questions: [
      {
        id: "how-much-does-finch-cost",
        question: "How much does Finch cost?",
        answer:
          "R6,000 per location per month, everything included: every module and agent, activated in priority order from your Operations Audit, plus a monthly ops review with your Vyso lead.",
      },
      {
        id: "is-there-a-setup-cost",
        question: "Is there a setup cost?",
        answer:
          "Not for founding clients — setup is waived, the first month is free, and your rate is locked for as long as you stay. Every engagement starts with the operations audit, which is free and takes about an hour.",
      },
      {
        id: "founding-terms",
        question: "What are the founding terms?",
        answer:
          "Setup waived, first month free, rate locked. That's the full offer — no fine print — and it's how Vyso builds its first cohort honestly, rather than with a limited-time discount.",
      },
      {
        id: "several-locations-custom-integrations",
        question: "What if we have several locations or need custom integrations?",
        answer:
          "Each location is billed at R6,000 a month. Multi-location groups and integrations beyond the standard roster are expanded mandates, priced on scope — book the audit and we'll quote it in your roadmap.",
      },
      {
        id: "can-we-cancel",
        question: "Can we cancel?",
        answer: "Yes — 30 days' notice, no lock-in. There's no long-term contract to break.",
      },
      {
        id: "what-does-r6000-include",
        question: "What does R6,000 actually include?",
        answer:
          "Every module Finch runs on, every agent activated from your audit roadmap, your current tools connected, and a monthly ops review with your Vyso lead. There's no separate module fee and no hidden tier above it.",
      },
    ],
  },
  {
    id: "audit",
    eyebrow: "The audit & onboarding",
    title: "How it starts",
    description: "What the free operations audit involves, what we need from you, and what happens next.",
    questions: [
      {
        id: "what-happens-during-the-audit",
        question: "What happens during the operations audit?",
        answer:
          "It is about an hour with you. We walk through how the work actually moves through your business and come back with where the money and the time are leaking, and a roadmap of what to automate first, whether you go ahead with us or not. It is free.",
      },
      {
        id: "what-do-you-need-from-us",
        question: "What do you need from us?",
        answer:
          "About an hour, and whoever actually runs the day in the room with us. Nothing to prepare and nothing to send through first. If it helps to look at a few real documents while we talk, bring them, but the hour works without them.",
      },
      {
        id: "what-if-we-dont-sign",
        question: "What if we don't sign up after the audit?",
        answer:
          "Nothing owed. The audit is free and you keep the roadmap either way — what we found and what we would do about it first.",
      },
      {
        id: "how-soon-can-it-start",
        question: "How soon can the audit start?",
        answer: "We confirm the time when you book. It is one sitting of about an hour, in person in Johannesburg or on a call anywhere in South Africa.",
      },
      {
        id: "how-does-onboarding-work",
        question: "How does Finch get set up after the audit?",
        answer:
          "You get a rand-quantified leak report with evidence, then agents and modules are activated in priority order, then your monthly ops review starts with your Vyso lead. Your existing tools are connected during onboarding — nothing to migrate.",
      },
    ],
  },
  {
    id: "data",
    eyebrow: "Data, POPIA & security",
    title: "Data & compliance",
    description: "What Finch does and doesn't do for your compliance obligations, and who can see what.",
    questions: [
      {
        id: "does-finch-make-us-popia-compliant",
        question: "Does using Finch make us POPIA compliant?",
        answer:
          "No software makes a business POPIA compliant on its own. Finch supports more consistent records and role-aware access, while compliance still depends on how your business collects, uses, retains, shares and protects personal information.",
      },
      {
        id: "vat-aware-invoices",
        question: "Can Finch create VAT-aware South African tax invoices?",
        answer:
          "Yes. Finch, through OrderFlow, supports seller and customer details, VAT numbers, document numbering, line items and standard, zero-rated or exempt VAT treatment. Your accountant or tax practitioner remains responsible for confirming the correct tax treatment for your business.",
      },
      {
        id: "role-based-access",
        question: "Who can see what inside Finch?",
        answer:
          "Access is organisation-scoped and role-aware, so people only see the workflows and data their role needs. Full detail on how we collect, use, retain and protect information sits in our Privacy Policy.",
      },
    ],
  },
  {
    id: "integrations",
    eyebrow: "Integrations & your tools",
    title: "Your current tools",
    description: "Finch is built to read what you already run, not to replace it wholesale.",
    questions: [
      {
        id: "connect-current-tools",
        question: "Can Finch connect to the tools we already use?",
        answer:
          "Yes — Finch reads what you already run: Xero, Sage, WhatsApp, Yoco and more, connected during onboarding. Integrations beyond the standard roster are scoped and priced separately.",
      },
      {
        id: "does-finch-replace-accounting-software",
        question: "Does Finch replace Xero, Sage or QuickBooks?",
        answer:
          "Finch replaces the operational workflow around them — pricing, order capture, invoicing, reconciliation — not your accounting ledger or tax submissions. Any accounting connection or migration boundary is agreed during onboarding.",
      },
      {
        id: "keep-current-pos-or-stock-system",
        question: "Can we keep using our current POS or stock system?",
        answer:
          "In most cases, yes — Finch reads from your existing POS or stock export rather than requiring you to replace it. What gets connected, and how, is confirmed during onboarding.",
      },
    ],
  },
  {
    id: "fit",
    eyebrow: "Comparison & fit",
    title: "Fit & alternatives",
    description: "Whether Finch is the right next step, and how it differs from the obvious alternatives.",
    questions: [
      {
        id: "finch-vs-hiring-a-coo",
        question: "How is Finch different from hiring a COO?",
        answer:
          "A COO's job is watching invoices, stock, suppliers, debtors and margins, and telling you what matters. Finch does that watching for R6,000 per location a month, with evidence attached to every finding — you still make the calls.",
      },
      {
        id: "when-finch-isnt-the-right-fit",
        question: "When might Finch not be the right fit?",
        answer:
          "If a simple off-the-shelf tool already matches your workflow, or you need a full enterprise ERP rollout, Finch may not be the right first step. The audit tests that fit honestly before you commit to anything.",
      },
      {
        id: "finch-vs-a-point-tool",
        question: "How is Finch different from a single-purpose tool?",
        answer:
          "A point tool usually solves one part of the operation. Finch connects several — invoices, stock, suppliers, debtors, margins — into one weekly brief, set up hands-on by Vyso rather than a dashboard you configure alone.",
      },
      {
        id: "which-plan-should-we-choose",
        question: "Which plan should we choose?",
        answer:
          "There's one offer: R6,000 per location per month, everything included. The Operations Audit tells us which agents and modules matter most for your business, and sets the order they're switched on in — no tier to pick beforehand.",
      },
    ],
  },
];

/** Flat list for the FAQPage JSON-LD — identical question/answer text to what
    the page renders, so the schema can never say something the page doesn't. */
export const ALL_FAQ_QUESTIONS: readonly FaqItem[] = FAQ_GROUPS.flatMap((group) => group.questions);

export default FAQ_GROUPS;
