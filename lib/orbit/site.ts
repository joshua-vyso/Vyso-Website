/* ── Orbit: the constants the whole subsite reads ────────────────────────────
   Orbit is the second product surface on vyso.co.za: WhatsApp operations for
   South African tradespeople, sitting under `/orbit` on the same domain so the
   subsite inherits the root domain's authority rather than starting a new one
   (`.ai/plan_orbit_site.md`, approved 2026-08-19).

   **Nothing here is a claim about a shipped product.** Orbit is not built yet.
   Every page states that in its own words and every call to action is "Join
   Waitlist" — see `STATUS` and `PROMISE` below, which are the two strings that
   carry the honesty and are therefore written once, here, rather than retyped
   per page where one of them would eventually drift into a promise.

   What *is* true today, and what the site is allowed to lean on, is the
   platform underneath: Doc-U, OrderFlow, Price Watch and Finch are running for
   South African food businesses today (see `/case-studies/turn-n-slice`, which
   is public). Orbit is a WhatsApp front door onto that same backend. That is
   the "tested and proven Vyso operations software" line, stated as `BUILT_ON`
   in the only form the evidence supports — a description of the backend, with
   no numbers that the case-study page does not itself publish. */

import { SITE } from "@/lib/marketing/site";

export const ORBIT = {
  name: "Orbit",
  /** Every canonical under the subsite is built off this. */
  path: "/orbit",
  url: `${SITE.url}/orbit`,

  /** The one-line promise. Also the OG subtitle and the llms.txt entry. */
  promise:
    "Run your trade from WhatsApp. Text Orbit what you did and what you charged — it tracks the job, drafts the invoice and keeps your books.",

  /** ≤155 characters, the meta description budget. Counted: 152. */
  description:
    "Orbit is WhatsApp operations for South African tradespeople. Text what you did and what you charged; Orbit tracks the job and drafts the invoice.",

  /** The single honest status sentence. Used on every page that could be
      mistaken for a product announcement, and in the JSON-LD `availability`. */
  status:
    "Orbit is in development. Join the waitlist and we WhatsApp you when it opens.",

  /** Price, as a number and as the string the copy uses. R99 per month per
      tradesperson. VAT treatment is *not* settled, so the site says so rather
      than guessing — see `PRICE.vatNote`. */
  price: {
    amount: 99,
    currency: "ZAR",
    display: "R99",
    unit: "per tradesperson, per month",
    vatNote: "VAT-inclusive pricing confirmed at launch.",
  },

  /** WhatsApp is Meta's, and every phone render on this site is hand-built
      HTML/CSS rather than a screenshot. Both facts are stated in the footer. */
  trademark:
    "WhatsApp is a trademark of Meta Platforms, Inc. Orbit is not affiliated with, endorsed by or sponsored by Meta. The chat screens on this site are illustrations drawn by us, not screenshots.",

  /** The "built on Vyso" claim, in the only shape the evidence supports. */
  builtOn:
    "Orbit runs on the same Vyso operations platform already working for South African food businesses — document capture, order and price tracking, invoicing and the Finch assistant. Orbit is the WhatsApp front door onto it.",

  /** Drafts-only. This is a standing rule across every Vyso surface and it is
      as true of Orbit as it is of Finch: nothing is sent on your behalf. */
  draftsOnly: "Orbit drafts. You send.",

  waitlistCta: "Join Waitlist",
} as const;

/** Every Orbit route, in one place. `app/sitemap.ts`, `lib/marketing/llms.ts`,
    the footer and the verification crawl all read this, so a page added
    without an entry here is a page that is invisible to all four at once. */
export type OrbitRoute = { path: string; label: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number };

export const ORBIT_STATIC_ROUTES: OrbitRoute[] = [
  { path: "/orbit",                                       label: "Orbit — WhatsApp operations for tradespeople", changeFrequency: "weekly",  priority: 0.9 },
  { path: "/orbit/how-it-works",                          label: "How Orbit works",                              changeFrequency: "monthly", priority: 0.8 },
  { path: "/orbit/pricing",                               label: "Orbit pricing — R99 per month",                changeFrequency: "monthly", priority: 0.8 },
  { path: "/orbit/faq",                                   label: "Orbit FAQ",                                    changeFrequency: "monthly", priority: 0.7 },
  { path: "/orbit/waitlist",                              label: "Join the Orbit waitlist",                      changeFrequency: "monthly", priority: 0.7 },
  { path: "/orbit/for",                                   label: "Orbit by trade",                               changeFrequency: "monthly", priority: 0.6 },
  { path: "/orbit/compare/orbit-vs-job-management-apps",  label: "Orbit vs job management apps",                 changeFrequency: "monthly", priority: 0.6 },
  { path: "/orbit/compare/orbit-vs-spreadsheets",         label: "Orbit vs spreadsheets and a notebook",         changeFrequency: "monthly", priority: 0.6 },
  { path: "/orbit/learn",                                 label: "Orbit — guides for South African trades",      changeFrequency: "monthly", priority: 0.6 },
];

/** The date every Orbit page was published. One constant rather than one per
    file: they were all written in the same sitting, and a single named value
    is one place to bump when a page actually changes. Same pattern as
    `CONTENT_LAST_MODIFIED` in `app/sitemap.ts`. */
export const ORBIT_PUBLISHED = "2026-08-19";

export default ORBIT;
