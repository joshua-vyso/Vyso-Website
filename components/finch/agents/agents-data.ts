/* ── The example agent roster ────────────────────────────────────────────────
   Six *examples*, not a catalogue: the roster is set per business in the audit,
   and the homepage section says so above the grid and again underneath it.
   Every card carries the status chip its claim can actually support.

   Server-safe by construction — nothing here imports a `"use client"` module —
   so the section header can read `AGENT_HONESTY` without pulling the grid onto
   the server.                                                                 */

export type AgentStatus = "ROLLING OUT" | "FROM YOUR AUDIT ROADMAP";

export type ExampleAgent = {
  label:   string;
  body:    string;
  status:  AgentStatus;
  /** Which evidence micro-visual the card draws on enter. */
  visual:  "price" | "recon" | "debtors" | "stock" | "brief" | "delivery";
};

/* The five product agents keep the one-liners the site has always used for
   them, so the homepage, the brief and the day strip make the same claim in the
   same words. Delivery Watch is the vertical example; it is on the roadmap like
   the rest, and says so. */
export const EXAMPLE_AGENTS: ExampleAgent[] = [
  {
    label: "PRICE WATCH",
    body: "Supplier prices, line by line, against six months of memory.",
    status: "ROLLING OUT",
    visual: "price",
  },
  {
    label: "RECON",
    body: "What was invoiced against what actually arrived at the back door.",
    status: "FROM YOUR AUDIT ROADMAP",
    visual: "recon",
  },
  {
    label: "DEBTORS",
    body: "Accounts quietly thinning before they become bad debt.",
    status: "FROM YOUR AUDIT ROADMAP",
    visual: "debtors",
  },
  {
    label: "STOCK SENSE",
    body: "Stock on hand against the orders already on their way.",
    status: "FROM YOUR AUDIT ROADMAP",
    visual: "stock",
  },
  {
    label: "THE BRIEF",
    body: "Monday morning on WhatsApp: the three things that matter.",
    status: "FROM YOUR AUDIT ROADMAP",
    visual: "brief",
  },
  {
    label: "DELIVERY WATCH",
    body: "Routes against delivery notes, for wholesalers running their own trucks.",
    status: "FROM YOUR AUDIT ROADMAP",
    visual: "delivery",
  },
];

export const AGENT_HONESTY =
  "Document intelligence (Doc-U) is live today; agents are activated in priority order from your audit roadmap.";
