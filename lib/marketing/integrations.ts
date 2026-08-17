/* ── `/integrations` content ─────────────────────────────────────────────────
   Extends `components/finch/integrations.ts` (read-only — the roster, slugs,
   logo paths, "you ask Finch" prompt strings and the screen-reader `short`
   line all live there and stay untouched) with the per-tool copy the page
   needs: an honest status chip, what Finch reads, what Finch can do with it,
   and how the connection gets set up.

   STATUS IS GROUNDED, NOT ASPIRATIONAL. Checked against the running product
   (2026-08-15), not the marketing roster:
     - `app/api/integrations/xero/{connect,callback,status,disconnect}` +
       `lib/platform/xero.ts` / `xero-core.ts` — a real OAuth connection.
       Xero is CONNECTED IN ONBOARDING.
     - `app/api/whatsapp/{inbound,process}` + `lib/platform/whatsapp-send.ts` /
       `whatsapp-ingest.ts` / `whatsapp-policy.ts` — a real, signed webhook
       that turns inbound orders into OrderFlow orders and replies with a
       confirmation. WhatsApp Business is CONNECTED IN ONBOARDING.
     - `app/api/serviceden/gmail/{connect,callback,sync,cron}` +
       `lib/platform/serviceden-gmail.ts` — a real, working Gmail OAuth
       connection, but scoped to ServiceDen only, which
       `lib/platform/serviceden-data.ts` gates to a single internal Vyso
       account (`SERVICEDEN_ACCOUNT_EMAIL`) and `lib/marketing/module-data/
       serviceden.ts` already describes on-site as "run internally at Vyso
       and rolled out with selected service businesses ahead of a wider
       release." Gmail is LIMITED ROLLOUT — a deliberate third status beyond
       the plan's two-value example (`CONNECTED IN ONBOARDING` / `ROADMAP`),
       chosen because "LIMITED ROLLOUT" is already the site's own chip for
       this exact situation (`MODULE_CHIPS.serviceden` in
       `components/finch/pricing/pricing-data.ts`) — reusing it here says the
       same true thing about the same real feature, rather than forcing a
       binary that would either overclaim (CONNECTED IN ONBOARDING, which
       reads as "yours will connect too") or underclaim (ROADMAP, which reads
       as "not built") a connection that is both built and gated.
     - Sage, Yoco, Loyverse, Outlook, Notion, n8n, SimplePay: zero references
       in `lib/**` or `app/api/**` beyond marketing copy (`lib/marketing/
       faq.ts`) or, for Notion/n8n, Vyso's own INTERNAL sales-outreach engine
       (`lib/platform/notion-outreach.ts` — "Notion is the system of record
       for the n8n outreach engine" — which is Vyso's own tooling, not a
       customer-facing connection). All ROADMAP.
     - QuickBooks: no live connection. `lib/platform/csv.ts` and
       `app/api/import/{assist,parse-xlsx}` support QuickBooks-*shaped*
       spreadsheet exports as an import format (alias-guessing headers,
       parsing multi-sheet workbooks) — that is import/mapping support, not a
       live read. ROADMAP, with the CSV nuance stated honestly in its copy
       rather than folded into a claim of a live connection.

   Order matches `INTEGRATIONS` (Xero first, per its own SSR-dock comment). */

import { INTEGRATIONS, type Integration } from "@/components/finch/integrations";

export type IntegrationStatus = "CONNECTED IN ONBOARDING" | "LIMITED ROLLOUT" | "ROADMAP";

export type IntegrationDetail = Integration & {
  status: IntegrationStatus;
  /** Short mono field labels for the reading-table row — 2-4 items, lowercase,
      joined with " · " at render time. Only rendered in blue/checked for a
      status that is actually live (see ReadingTable's colour rule). */
  fields: readonly string[];
  /** "What Finch reads" — one or two sentences, present tense only if true today. */
  reads: string;
  /** "What Finch can do with it" — the capability that follows from the read,
      or honestly "not built yet" where that is the truth. */
  canDo: string;
  /** How the connection is made (or isn't yet). */
  setup: string;
};

const DETAILS: Record<string, Omit<IntegrationDetail, keyof Integration>> = {
  xero: {
    status: "CONNECTED IN ONBOARDING",
    fields: ["invoices", "bills", "contacts", "account balances"],
    reads:
      "Invoices, bills, contacts and account balances, kept in sync automatically once connected.",
    canDo:
      "Nothing back into Xero yet — today Finch reads it for context (matching invoices against deliveries, watching prices) rather than writing anything to your books.",
    setup: "Connected with your own Xero login during onboarding. No exports, no manual entry.",
  },
  whatsapp: {
    status: "CONNECTED IN ONBOARDING",
    fields: ["orders", "photographed invoices", "delivery notes"],
    reads:
      "Orders your customers send to your WhatsApp Business number, plus photographed invoices and delivery notes forwarded to it.",
    canDo:
      "Confirms a captured order back to the customer automatically. It doesn't send your brief over WhatsApp yet — that part is roadmap; your brief arrives by email today.",
    setup: "Connected to your existing WhatsApp Business number during onboarding, verified through Meta.",
  },
  gmail: {
    status: "LIMITED ROLLOUT",
    fields: ["sales-conversation threads", "company research"],
    reads:
      "Read-only access to a connected inbox: threads that look like sales conversations, for ServiceDen's lead pipeline.",
    canDo:
      "Drafts a reply from the thread, fact-tagged company research and your own past emails — every draft needs a person to approve it before ServiceDen sends anything.",
    setup:
      "Live today only inside ServiceDen, which Vyso runs internally and has rolled out to a small number of service businesses — not yet part of standard Finch onboarding.",
  },
  yoco: {
    status: "ROADMAP",
    fields: ["daily takings", "transaction totals"],
    reads: "Daily takings and transaction totals, once connected.",
    canDo:
      "Would flag a takings day that doesn't match what left the shelf or what's in the order book — not built yet.",
    setup: "Not connected yet. Tell us you run Yoco during your audit and we'll scope it.",
  },
  sage: {
    status: "ROADMAP",
    fields: ["invoices", "payments", "account balances"],
    reads: "The ledger — invoices, payments and account balances, the same shape as the Xero connection.",
    canDo: "Would read Sage the same way Xero is read today, once the connection exists — not built yet.",
    setup: "Not connected yet. Flagged in the audit if Sage is your system of record.",
  },
  loyverse: {
    status: "ROADMAP",
    fields: ["POS sales lines", "stock movements"],
    reads: "What leaves the shelf — POS sales lines, per product, per till.",
    canDo:
      "Would connect what leaves the shelf to what was ordered and what's on hand — not built yet.",
    setup: "Not connected yet. Scoped during onboarding if Loyverse is your POS.",
  },
  quickbooks: {
    status: "ROADMAP",
    fields: ["spreadsheet exports (import only)"],
    reads:
      "No live read today. QuickBooks-formatted spreadsheet exports can already be imported and mapped during onboarding; a live connection that reads automatically is roadmap.",
    canDo: "Spreadsheet exports import and map into Finch today. Automatic reconciliation is roadmap.",
    setup: "Spreadsheet exports import today, mapped during onboarding. A live connection is scoped on request.",
  },
  outlook: {
    status: "ROADMAP",
    fields: ["supplier statements", "order confirmations"],
    reads:
      "Supplier statements and order confirmations landing in a connected inbox — the same shape as the Gmail connection above.",
    canDo:
      "Would surface supplier mail the way a connected Gmail inbox does for ServiceDen — not built for Outlook yet.",
    setup: "Not connected yet. Flagged in the audit if Outlook is where your suppliers email you.",
  },
  notion: {
    status: "ROADMAP",
    fields: ["ops notes", "pages"],
    reads: "Ops notes and pages you already keep in Notion, once connected.",
    canDo:
      "Vyso runs its own sales workflow on Notion internally — that's Vyso's tooling, not a customer connection. Writing your ops notes into a Notion workspace you own is roadmap.",
    setup: "Not connected yet. Tell us during your audit if Notion is where your team keeps its notes.",
  },
  n8n: {
    status: "ROADMAP",
    fields: ["workflow triggers"],
    reads: "Nothing to read — n8n would be a trigger Finch fires, not a source it reads.",
    canDo:
      "Would let a Finch finding kick off a workflow you've already built — not built yet. Vyso uses n8n for its own internal automation today, which is a different thing.",
    setup: "Not connected yet, and scoped case by case — every n8n setup is different.",
  },
  simplepay: {
    status: "ROADMAP",
    fields: ["payroll runs", "payment dates"],
    reads: "Payroll runs and payment dates, once connected.",
    canDo: "Would flag a payroll run that doesn't match your roster or hours — not built yet.",
    setup: "Not connected yet. Flagged in the audit if SimplePay runs your payroll.",
  },
};

export const INTEGRATION_DETAILS: readonly IntegrationDetail[] = INTEGRATIONS.map((integration) => {
  const detail = DETAILS[integration.slug];
  if (!detail) {
    throw new Error(`lib/marketing/integrations.ts: no detail copy for "${integration.slug}"`);
  }
  return { ...integration, ...detail };
});

export default INTEGRATION_DETAILS;

/* ── FAQs ─────────────────────────────────────────────────────────────────
   Four questions, mirrored verbatim into the page's FAQPage JSON-LD. */

export const INTEGRATIONS_FAQS: readonly { id: string; question: string; answer: string }[] = [
  {
    id: "which-integrations-are-live",
    question: "Which integrations does Finch actually have today?",
    answer:
      "Two are connected during onboarding: Xero (invoices, bills, contacts and balances) and WhatsApp Business (order intake, with an automatic confirmation reply). Gmail is live today too, but only inside ServiceDen, a limited-rollout module run for a small number of service businesses. Sage, Yoco, Loyverse, QuickBooks, Outlook, Notion, n8n and SimplePay are roadmap — scoped during your audit if you run one of them.",
  },
  {
    id: "migrate-data-first",
    question: "Do we need to migrate our data before Finch connects?",
    answer:
      "No. There's nothing to migrate — Finch reads your systems where they already live. Xero connects with your own login during onboarding; nothing is exported or re-typed to get started.",
  },
  {
    id: "who-sees-connected-data",
    question: "Who can see the data Finch reads from a connected tool?",
    answer:
      "Access is organisation-scoped: what Finch reads from Xero or WhatsApp stays inside your account. It supports your existing records; it isn't a data-collection product built on top of them.",
  },
  {
    id: "can-finch-write-back",
    question: "Can Finch write back to Xero — post entries, send invoices from it?",
    answer:
      "Not today. Finch reads Xero for context — matching invoices to deliveries, watching prices — but it doesn't post entries or push documents back into your books.",
  },
] as const;

/* ── "Don't see your tool?" ──────────────────────────────────────────────── */

export const DONT_SEE_YOUR_TOOL =
  "Integrations beyond the standard roster are expanded mandates, priced on scope — book your audit, tell us what you run, and we'll quote the connection in your roadmap.";
