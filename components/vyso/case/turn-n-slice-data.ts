import type { CaseStudyData } from "./CaseTemplate";

/* ── Turn 'n Slice ────────────────────────────────────────────────────────────
   Every fact below is preserved from the pre-redesign
   `app/case-studies/turn-n-slice/page.tsx`: the four capabilities, the
   Roberto quote and its byline, the stats. Two things were removed, and
   nothing else was:

   1. "OrderFlow" (the module codename Vyso built the invoicing workflow on)
      is gone from customer-facing copy, per plan §2's ban on module
      codenames. What was built is described by what it does instead of what
      it was called internally: an order and invoicing workflow that carries
      price lists, customer accounts, quotes, orders, invoices and payments in
      one place, replacing QuickBooks as the invoicing system. That is the
      same fact the old page stated with the codename attached.
   2. "Founding client" / "founding customer" is gone, per plan §2's ban on
      that exact phrase. "Our first client" is the honest, plainer framing
      Phase 1's `HomeCase` already uses for this same company, so this page
      says the same true thing the same way.

   The two `[TNS_NUMBER]` placeholders are new to this page but not invented:
   they are copied verbatim from `components/vyso/home/HomeCase.tsx` (Phase
   1), so the homepage teaser and this full page ask for exactly the same two
   figures rather than two different guesses at what "the numbers" are. */

export const TURN_N_SLICE: CaseStudyData = {
  slug: "turn-n-slice",
  company: "Turn 'n Slice",
  eyebrow: "OUR FIRST CLIENT",
  h1: "Replacing invoicing admin with one connected system.",
  lead:
    "Turn 'n Slice is a Johannesburg fresh produce wholesaler, an FMCG food business, and Vyso's first client. This is what was actually built, and what is still being confirmed.",
  logoSrc: "/turn-n-slice-logo-clean.png",
  logoAlt: "Turn 'n Slice",
  stats: [
    ["Johannesburg", "South African operation"],
    ["FMCG food", "Sector"],
    ["Our first client", "Client relationship"],
    ["Invoicing", "Workflow replaced"],
  ],

  industry: "Fresh produce wholesale, Johannesburg, South Africa.",
  situation:
    "Turn 'n Slice ran its invoicing through QuickBooks, disconnected from the price lists, customer accounts and orders that actually decide what an invoice should say.",
  problem:
    "Invoicing depends on current prices, the right customer terms, an accurate quote and order trail, and a clear view of what has already been paid. None of that context travelled with QuickBooks, so it had to be rebuilt, by hand, for every invoice.",

  before: [
    "Price lists were rebuilt manually for each customer, a slow, repeatable task rather than a one time setup.",
    "Customer pricing, quotes and order history lived apart from the invoice that was eventually sent.",
    "QuickBooks handled the invoicing document itself, without the commercial context behind it.",
    "Repeat administration competed with the commercial decisions that actually needed someone's attention.",
  ],

  builtIntro:
    "An order and invoicing workflow that carries price lists, customer accounts, quotes, orders, invoices and payments in one connected place, replacing QuickBooks as the invoicing system.",
  capabilities: [
    {
      title: "Price lists in seconds",
      copy: "Create and maintain customer-ready price lists without rebuilding them manually.",
    },
    {
      title: "Central customer accounts",
      copy: "Keep each customer, their pricing and their commercial history together in one operational record.",
    },
    {
      title: "Connected invoicing",
      copy: "Carry the same information from quote and order through to invoice and payment tracking.",
    },
    {
      title: "Repeat work automated",
      copy: "Reduce recurring invoicing administration while keeping people in control of commercial decisions.",
    },
  ],

  howItWorksEyebrow: "See it work",
  howItWorksHeading: "Price lists in seconds, not a manual rebuild.",
  howItWorksCopy:
    "This is how it feels day to day: type the item, the priced row is already there, current cost, current margin, current customer terms, applied automatically. The names and figures below are illustrative, not this account's own numbers.",

  outcomesIntro: "Invoicing works better when it is part of the operation.",
  outcomes: [
    "Customer accounts are more useful when pricing, quotes, orders, invoices and payments share the same context.",
    "Price list creation should be a routine operational task, not a slow manual rebuild.",
    "Replacing QuickBooks as the invoicing system means giving the operating team a workflow built around how orders actually move.",
    "Automation is strongest when it removes repeat administration while leaving important commercial decisions visible.",
  ],

  results: [
    "[TNS_NUMBER] supplier invoices processed a month.",
    "[TNS_NUMBER] hours a week returned to the owner.",
  ],
  resultsNote: "Figures being confirmed with the client before publication.",

  quote: {
    text: "Vyso is automating our entire invoicing operation. We can build price lists in seconds and manage every customer account from one central operational brain.",
    byline: "Roberto, Turn 'n Slice, Johannesburg, South Africa",
    note: "A statement from our first client about the invoicing workflow described above.",
  },

  ctaPrimary: { href: "/operations-audit", label: "Start your own operations audit" },
  ctaSecondary: { href: "/how-it-works", label: "See how Vyso works" },
};

export default TURN_N_SLICE;
