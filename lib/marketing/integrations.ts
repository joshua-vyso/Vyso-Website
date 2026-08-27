/* ── `/integrations` content ─────────────────────────────────────────────────
   Rewritten for the 2026 redesign (`.ai/plan_vyso_redesign_2026.md` §7.6).
   Extends `components/finch/integrations.ts` (read-only per plan §10 — the
   roster, slugs, logo paths and prompt strings live there and stay untouched;
   it also still backs the pre-redesign `IntegrationsOrbit`/`IntegrationPrompt`
   widgets, which are out of this phase's scope) with the honest per-tool copy
   this page needs: a status chip, what Vyso reads, what Vyso can do with it,
   and how the connection gets set up.

   Two entries — `excel` and `google-sheets` — are NOT in that roster (it has
   no Google Sheets tool and its "excel" surface is really the CSV importer).
   They are appended directly below as plain `IntegrationDetail` objects rather
   than added to `components/finch/integrations.ts`, because that file is out
   of scope and still feeds the old orbit widget: adding two spreadsheet tools
   to an orbit built for a Xero-leads, eleven-item rotation is a different
   decision than this page needs to make.

   STATUS IS GROUNDED, NOT ASPIRATIONAL. Checked against the running product,
   same as before this rewrite:
     - `app/api/integrations/xero/{connect,callback,status,disconnect}` +
       `lib/platform/xero.ts` — a real OAuth connection. Xero is CONNECTED.
     - `app/api/whatsapp/{inbound,process}` + `lib/platform/whatsapp-send.ts` /
       `whatsapp-ingest.ts` — a real, signed webhook that turns inbound orders
       into order records and replies with a confirmation. WhatsApp Business is
       CONNECTED.
     - A Gmail OAuth connection exists in this codebase
       (`app/api/serviceden/gmail/**`), but it is scoped to a single internal
       workflow gated to one Vyso-run account and a small number of service
       businesses, not part of standard onboarding. That is stated honestly
       below without naming the internal module it lives in (plan §2: no
       module codenames in public copy) — "a specific internal workflow" is
       what a visitor needs to know, not what it used to be called.
     - Sage, Yoco, Loyverse, Outlook, Notion, n8n, SimplePay: zero references
       in `lib/**` or `app/api/**` beyond marketing copy. ROADMAP.
     - QuickBooks: no live connection. `lib/platform/csv.ts` and
       `app/api/import/{assist,parse-xlsx}` support QuickBooks-*shaped*
       spreadsheet exports as an import format — that is import/mapping
       support, not a live read. ROADMAP, with the CSV nuance stated honestly.
     - Excel / Google Sheets: the same CSV/XLSX importer supports spreadsheet
       uploads today; nothing reads a live Google Sheet or a workbook without
       it being uploaded. Stated as ROADMAP for a live connection, with the
       import path named honestly.

   Order: the two real connections first (Xero, WhatsApp), then the roster in
   its existing order, then the two appended spreadsheet tools. */

import { INTEGRATIONS, type Integration } from "@/components/finch/integrations";

/* Kept as "CONNECTED IN ONBOARDING" rather than shortened to "CONNECTED":
   `components/finch/integrations-page/IntegrationSections.tsx` (orphaned by
   this phase's page rewrite, out of scope to edit) keys a local
   `Record<IntegrationStatus, string>` off this exact literal, and changing the
   union would fail that file's type-check even though nothing routes to it
   any more. */
export type IntegrationStatus = "CONNECTED IN ONBOARDING" | "LIMITED ROLLOUT" | "ROADMAP";

export type IntegrationDetail = Integration & {
  status: IntegrationStatus;
  /** Short mono field labels for the reading table row, 2 to 4 items,
      lowercase, joined with " · " at render time. */
  fields: readonly string[];
  /** "What Vyso reads", present tense only if true today. */
  reads: string;
  /** "What Vyso can do with it", or honestly "not built yet". */
  canDo: string;
  /** How the connection is made, or isn't yet. */
  setup: string;
};

const DETAILS: Record<string, Omit<IntegrationDetail, keyof Integration>> = {
  xero: {
    status: "CONNECTED IN ONBOARDING",
    fields: ["invoices", "bills", "contacts", "account balances"],
    reads: "Invoices, bills, contacts and account balances, kept in sync automatically once connected.",
    canDo:
      "Nothing back into Xero yet. Today Vyso reads it for context, matching invoices against deliveries, watching prices, rather than writing anything to your books.",
    setup: "Connected with your own Xero login. No exports, no manual entry.",
  },
  whatsapp: {
    status: "CONNECTED IN ONBOARDING",
    fields: ["orders", "photographed invoices", "delivery notes"],
    reads:
      "Orders your customers send to your WhatsApp Business number, plus photographed invoices and delivery notes forwarded to it.",
    canDo:
      "Confirms a captured order back to the customer automatically. It does not send a written brief over WhatsApp yet, that part is roadmap.",
    setup: "Connected to your existing WhatsApp Business number, verified through Meta.",
  },
  gmail: {
    status: "LIMITED ROLLOUT",
    fields: ["sales conversation threads", "company research"],
    reads:
      "Read only access to a connected inbox: threads that look like sales conversations, for one internal Vyso workflow.",
    canDo:
      "Drafts a reply from the thread and past research, and every draft needs a person to approve it before anything sends.",
    setup:
      "Live today only inside a specific internal workflow, run by Vyso and rolled out to a small number of service businesses, not yet part of standard onboarding.",
  },
  yoco: {
    status: "ROADMAP",
    fields: ["daily takings", "transaction totals"],
    reads: "Daily takings and transaction totals, once connected.",
    canDo:
      "Would flag a takings day that does not match what left the shelf or what is in the order book. Not built yet.",
    setup: "Not connected yet. Tell us you run Yoco during your audit and we will scope it.",
  },
  sage: {
    status: "ROADMAP",
    fields: ["invoices", "payments", "account balances"],
    reads: "The ledger, invoices, payments and account balances, the same shape as the Xero connection.",
    canDo: "Would read Sage the same way Xero is read today, once the connection exists. Not built yet.",
    setup: "Not connected yet. Flagged in the audit if Sage is your system of record.",
  },
  loyverse: {
    status: "ROADMAP",
    fields: ["POS sales lines", "stock movements"],
    reads: "What leaves the shelf, POS sales lines, per product, per till.",
    canDo:
      "Would connect what leaves the shelf to what was ordered and what is on hand. Not built yet.",
    setup: "Not connected yet. Scoped during the build if Loyverse is your POS.",
  },
  quickbooks: {
    status: "ROADMAP",
    fields: ["spreadsheet exports (import only)"],
    reads:
      "No live read today. QuickBooks-formatted spreadsheet exports can already be imported and mapped; a live connection that reads automatically is roadmap.",
    canDo: "Spreadsheet exports import and map in today. Automatic reconciliation is roadmap.",
    setup: "Spreadsheet exports import today. A live connection is scoped on request.",
  },
  outlook: {
    status: "ROADMAP",
    fields: ["supplier statements", "order confirmations"],
    reads:
      "Supplier statements and order confirmations landing in a connected inbox, the same shape as the Gmail connection above.",
    canDo:
      "Would surface supplier mail the way the limited Gmail rollout does. Not built for Outlook yet.",
    setup: "Not connected yet. Flagged in the audit if Outlook is where your suppliers email you.",
  },
  notion: {
    status: "ROADMAP",
    fields: ["ops notes", "pages"],
    reads: "Ops notes and pages you already keep in Notion, once connected.",
    canDo: "Writing your ops notes into a Notion workspace you own is roadmap.",
    setup: "Not connected yet. Tell us during your audit if Notion is where your team keeps its notes.",
  },
  n8n: {
    status: "ROADMAP",
    fields: ["workflow triggers"],
    reads: "Nothing to read. n8n would be a trigger Vyso fires, not a source it reads.",
    canDo: "Would let a Vyso finding kick off a workflow you have already built. Not built yet.",
    setup: "Not connected yet, and scoped case by case. Every setup is different.",
  },
  simplepay: {
    status: "ROADMAP",
    fields: ["payroll runs", "payment dates"],
    reads: "Payroll runs and payment dates, once connected.",
    canDo: "Would flag a payroll run that does not match your roster or hours. Not built yet.",
    setup: "Not connected yet. Flagged in the audit if SimplePay runs your payroll.",
  },
};

const BASE_INTEGRATIONS: readonly IntegrationDetail[] = INTEGRATIONS.map((integration) => {
  const detail = DETAILS[integration.slug];
  if (!detail) {
    throw new Error(`lib/marketing/integrations.ts: no detail copy for "${integration.slug}"`);
  }
  return { ...integration, ...detail };
});

/** Not part of `components/finch/integrations.ts` — see the header. Both are
    the spreadsheet path most South African SMEs actually run on. */
const EXTRA_INTEGRATIONS: readonly IntegrationDetail[] = [
  {
    slug: "excel",
    name: "Excel",
    prompt: "“Vyso, pull this week's numbers from the spreadsheet.”",
    short: "where most of the operation already lives",
    status: "ROADMAP",
    fields: ["spreadsheet uploads (import only)"],
    reads:
      "No live read of a file on your machine today. A workbook you upload can be parsed and mapped during onboarding; watching a file automatically is roadmap.",
    canDo:
      "Uploaded spreadsheets import and map in today, price lists, stock counts, customer lists. A live watch on a file is roadmap.",
    setup: "Upload a workbook and it gets mapped during onboarding. A live connection is scoped on request.",
  },
  {
    slug: "google-sheets",
    name: "Google Sheets",
    prompt: "“Vyso, check the stock sheet before you confirm that order.”",
    short: "the shared spreadsheet a team already updates",
    status: "ROADMAP",
    fields: ["shared sheets (not yet connected)"],
    reads: "No connection today. A downloaded or exported copy can be imported the same way an Excel file is.",
    canDo:
      "Would read a shared sheet directly rather than needing a fresh export each time. Not built yet.",
    setup: "Not connected yet. Tell us during your audit if a shared sheet is where your team works.",
  },
];

export const INTEGRATION_DETAILS: readonly IntegrationDetail[] = [
  ...BASE_INTEGRATIONS,
  ...EXTRA_INTEGRATIONS,
];

export default INTEGRATION_DETAILS;

/* ── FAQs ─────────────────────────────────────────────────────────────────
   Mirrored verbatim into the page's FAQPage JSON-LD. */

export const INTEGRATIONS_FAQS: readonly { id: string; question: string; answer: string }[] = [
  {
    id: "which-integrations-are-live",
    question: "Which integrations does Vyso actually have today?",
    answer:
      "Two connect directly: Xero (invoices, bills, contacts and balances) and WhatsApp Business (order intake, with an automatic confirmation reply). Gmail is live too, but only inside one internal workflow run for a small number of service businesses. Sage, Yoco, Loyverse, QuickBooks, Outlook, Notion, n8n, SimplePay, Excel and Google Sheets are roadmap, scoped during your audit if you run one of them.",
  },
  {
    id: "migrate-data-first",
    question: "Do we need to migrate our data before Vyso connects?",
    answer:
      "No. There is nothing to migrate. Vyso reads your systems where they already live. Xero connects with your own login; nothing is exported or retyped to get started.",
  },
  {
    id: "who-sees-connected-data",
    question: "Who can see the data Vyso reads from a connected tool?",
    answer:
      "Access is organisation scoped: what Vyso reads from Xero or WhatsApp stays inside your account. It supports your existing records, it is not a data collection product built on top of them.",
  },
  {
    id: "can-vyso-write-back",
    question: "Can Vyso write back to Xero, post entries, send invoices from it?",
    answer:
      "Not today. Vyso reads Xero for context, matching invoices to deliveries, watching prices, but it does not post entries or push documents back into your books.",
  },
] as const;

/* ── "Don't see your tool?" ──────────────────────────────────────────────── */

export const DONT_SEE_YOUR_TOOL =
  "Anything beyond the standard roster is scoped like the rest of your system: book your audit, tell us what you run, and we will tell you honestly what connecting it would take.";
