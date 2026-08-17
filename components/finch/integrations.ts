/* ── Integration roster ──────────────────────────────────────────────────────
   The data behind the Senses section's orbit widget. Order matters twice: it is
   the order the orbit cycles in, and index 0 is what renders docked on the
   server (see IntegrationsOrbit's SSR note), so Xero — the one live integration
   — leads. Logos live in `public/finch/integrations/` and were sourced by the
   research pass (`.ai/research/integrations-orbit.md`).

   v4: Claude and GPT were dropped — they are "built with" badges, not data
   senses, and read oddly under a section titled "senses" (flagged by the v3
   architect review). Eleven tools remain. The status-chip `verb` field went
   with the chip itself; `prompt` is its replacement, read by
   `IntegrationPrompt` instead of the widget canvas.                          */

export type Integration = {
  slug: string;
  name: string;
  /** The "you ask Finch" prompt line while this tool is docked — a first-
      person request a user would actually type or say, verbatim copy from the
      plan (typographic quotes are part of the string, not added at render). */
  prompt: string;
  /** The same fact for the screen-reader list, phrased to follow the tool name
      rather than stand alone. These are the exact roles the section's old
      five-row text list used, kept so nothing was lost in the swap. */
  short: string;
};

export const INTEGRATIONS: Integration[] = [
  { slug: "xero",       name: "Xero",              prompt: "“Finch, fetch our books from Xero.”",                        short: "reads your books" },
  { slug: "whatsapp",   name: "WhatsApp Business", prompt: "“Finch, send me this morning’s brief on WhatsApp.”",         short: "where Finch talks to you" },
  { slug: "yoco",       name: "Yoco",              prompt: "“Can you check today’s Yoco takings, Finch?”",               short: "watches the takings" },
  { slug: "sage",       name: "Sage",              prompt: "“Finch, pull the ledger from Sage.”",                        short: "reads the ledger" },
  { slug: "loyverse",   name: "Loyverse",          prompt: "“Can you check our latest orders in Loyverse, Finch?”",      short: "sees what leaves the shelf" },
  { slug: "quickbooks", name: "QuickBooks",        prompt: "“Finch, reconcile QuickBooks against last week’s invoices.”", short: "keeps the other set of books" },
  { slug: "gmail",      name: "Gmail",             prompt: "“Anything from suppliers in Gmail this morning, Finch?”",    short: "reads what lands in your inbox" },
  { slug: "outlook",    name: "Outlook",           prompt: "“Finch, watch the Outlook inbox for statements.”",           short: "watches your Outlook inbox" },
  { slug: "notion",     name: "Notion",            prompt: "“Finch, put the ops notes in Notion.”",                      short: "remembers what's written down" },
  { slug: "n8n",        name: "n8n",               prompt: "“Finch, kick off the n8n workflow when the order lands.”",   short: "runs the workflows behind the scenes" },
  { slug: "simplepay",  name: "SimplePay",         prompt: "“Can you check this month’s payroll in SimplePay, Finch?”",  short: "watches payday" },
];

export default INTEGRATIONS;
