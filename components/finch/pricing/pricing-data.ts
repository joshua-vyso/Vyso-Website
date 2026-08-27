/* ── /pricing content ────────────────────────────────────────────────────────
   Every line on the pricing page is either (a) derived from data that already
   exists in the repo, or (b) a settled positioning fact from
   `.ai/plan_site_rebrand.md`. Nothing here is invented: no stats, no
   testimonials, no support promises the site does not already make. Sources are
   named per group so the next person can re-check a claim without a grep.

   The single copy of the price/terms constants also feeds the JSON-LD builder
   (`pricing-jsonld.ts`), so the structured data can never drift from the page. */

import { INTEGRATIONS } from "../integrations";

/* ── The offer ───────────────────────────────────────────────────────────── */

export const PRICE = {
  finch: 6000,
  audit: 2000,
  academySeat: 500,
  currency: "ZAR",
} as const;

export const CANONICAL_URL = "https://vyso.co.za/pricing";

/** The AEO direct answer: one sentence, complete on its own. `/pricing` is
    deleted, but this string still ships to readers through `/llms.txt`
    (`lib/marketing/llms.ts`), so it carries the current model rather than the
    published monthly rate it used to quote (`.ai/plan_home_only.md`). */
export const DIRECT_ANSWER =
  "Finch is priced per customer and per scope: every item on your audit roadmap carries a fixed build price and a monthly run price, quoted to you directly after a free audit of about an hour. The monthly fee covers every module and agent activated from that roadmap, a monthly ops review with your Vyso lead, and 30 days’ notice to cancel.";

export const FOUNDING_TERMS = ["Setup waived", "First month free", "Rate locked"] as const;

/* ── What's included ─────────────────────────────────────────────────────── */

export type IncludedItem = {
  label: string;
  /** One line of capability. Sentence case, ends without a full stop only when
      it is a fragment that reads as a continuation of the label. */
  note: string;
  /** Small mono status chip. Used only where the honesty rule needs one
      (parent plan AC8) — an unchipped line reads as "you get this". */
  chip?: string;
};

export type IncludedGroup = {
  id: string;
  title: string;
  items: IncludedItem[];
  /** Rendered under the list, in muted type — scope caveats, not capabilities. */
  footnote?: string;
  /** Plural noun for the mono count that reveals on hover ("10 MODULES").
      The number is `items.length`, never written down — an accordion that
      claims six agents and lists five is the kind of drift this whole file
      exists to prevent. */
  countNoun: string;
  /** One final, visually distinct row — round 3 (Josh: "have a custom bullet
      point — custom modules, custom agents, custom integrations"). Rendered
      by `WhatsIncluded.tsx`'s `CustomRow`, not folded into `items`: the hover
      count is a count of the catalogue, and a custom row is a promise about
      work that is not in it — counting it would make "10 modules" mean 9
      modules and a promise. Omitted on `support`, the one group with nothing
      grounded to promise custom. */
  customRow?: IncludedItem;
};

/* Agent copy is lifted verbatim from `components/finch/agents/agents-data.ts`
   (the same agents the homepage roster draws, Title Case here rather than the
   section's mono caps).
   Status chips follow the parent plan's honesty rule: document intelligence
   (Doc-U) is the only thing live, Price Watch is rolling out, the rest are
   sequenced by the audit. "FROM YOUR AUDIT ROADMAP" is the short form of the
   plan's "activated from your audit roadmap" — the full phrase does not fit a
   chip. */
const AGENTS: IncludedItem[] = [
  {
    label: "Document intelligence (Doc-U)",
    note: "Invoices, statements and delivery notes read into structured, reviewable line items.",
    chip: "LIVE",
  },
  {
    label: "Price Watch",
    note: "Supplier prices, line by line, against six months of memory.",
    chip: "ROLLING OUT",
  },
  {
    label: "Recon",
    note: "What was invoiced against what actually arrived at the back door.",
    chip: "FROM YOUR AUDIT ROADMAP",
  },
  {
    label: "Debtors",
    note: "Accounts quietly thinning before they become bad debt.",
    chip: "FROM YOUR AUDIT ROADMAP",
  },
  {
    label: "Stock Sense",
    note: "Stock on hand against the orders already on their way.",
    chip: "FROM YOUR AUDIT ROADMAP",
  },
  {
    label: "The Brief",
    note: "Monday morning on WhatsApp: the three things that matter.",
    chip: "FROM YOUR AUDIT ROADMAP",
  },
];

/* `lib/marketing/modules.ts` and `/platform/modules` were deleted in
   `.ai/plan_vyso_redesign_2026.md` Phase 4 (the module-codename showcase is
   retired site-wide). This file survives Phase 4 only because `/terms`
   still imports `FOUNDING_TERMS` below, and `WhatsIncluded.tsx` (the only
   consumer of `INCLUDED_GROUPS`, hence of this constant) has had zero
   importers since `/pricing` itself was deleted in an earlier phase — so
   nothing renders this list today. Left as an empty, correctly-typed
   placeholder rather than deleted, to avoid rewriting page copy that isn't
   this phase's scope. */
const MODULES: IncludedItem[] = [];

/* Same roster, same order as the homepage orbit — one source of truth, so a
   tool can never be promised here and missing there. */
const INTEGRATION_ITEMS: IncludedItem[] = INTEGRATIONS.map((integration) => ({
  label: integration.name,
  // `short` is written to follow the tool name, e.g. Xero — "reads your books".
  note: integration.short.charAt(0).toUpperCase() + integration.short.slice(1) + ".",
}));

export const INCLUDED_GROUPS: IncludedGroup[] = [
  {
    id: "platform",
    title: "The platform",
    items: MODULES,
    countNoun: "MODULES",
    customRow: {
      label: "Custom modules",
      note: "built to your workflow when nothing on the list fits. Priced on scope.",
      chip: "CUSTOM",
    },
  },
  {
    id: "agents",
    title: "The agents",
    items: AGENTS,
    countNoun: "AGENTS",
    customRow: {
      label: "Custom agents",
      note: "built around your business in the audit; your roster is set from the roadmap, not a catalogue.",
      chip: "CUSTOM",
    },
  },
  {
    id: "integrations",
    title: "Integrations",
    items: INTEGRATION_ITEMS,
    countNoun: "INTEGRATIONS",
    footnote: "More on request — expanded mandates priced on scope.",
    customRow: {
      label: "Custom integrations",
      note: "anything with an API or an export. Priced on scope.",
      chip: "CUSTOM",
    },
  },
  {
    /* Deliberately short. The only support commitments in the repo today are the
       two settled positioning facts plus the hands-on-implementation promise on
       `/faq` ("we remain involved after launch"); the tiered support periods in
       `/faq` and `/pricing-faq` belong to the retired Start/Create/Scale tiers
       and are not repeated here. No business-hours or response-time claim exists
       anywhere in the copy, so none is made. */
    id: "support",
    title: "Support",
    countNoun: "COMMITMENTS",
    items: [
      {
        label: "Monthly ops review",
        note: "With your Vyso lead, every month.",
      },
      {
        label: "Hands-on implementation",
        note: "We configure the agreed workflow with your team and stay involved after launch.",
      },
      {
        label: "Cancel with 30 days’ notice",
        note: "No lock-in.",
      },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    countNoun: "STEPS",
    customRow: {
      label: "Custom rollout order",
      note: "agents and modules activated in the priority your audit roadmap sets.",
      chip: "CUSTOM",
    },
    items: [
      {
        label: "1 · Operations Audit",
        note: "One week, R2,000, credited to your first month.",
      },
      {
        label: "2 · The leak report",
        note: "Where the money is going, in rand, with the evidence attached.",
      },
      {
        label: "3 · Activation",
        note: "Agents and modules switched on in priority order from the audit roadmap.",
      },
      {
        label: "4 · Your tools connected",
        note: "Finch reads what you already run. Nothing to migrate.",
      },
      {
        label: "5 · First ops review",
        note: "The monthly rhythm starts with your Vyso lead.",
      },
    ],
  },
];

/* ── Straight answers (AEO) ──────────────────────────────────────────────────
   Verbatim from `.ai/plan_homepage_finch_v4.md` Part B §4. The same strings are
   the FAQPage entities in the JSON-LD, so page and schema always match. Each
   answer opens with a complete direct answer and stays under 45 words. */

export type StraightAnswer = { question: string; answer: string };

export const STRAIGHT_ANSWERS: StraightAnswer[] = [
  {
    question: "How much does Finch cost?",
    answer:
      "R6,000 per location per month, everything included. No setup fee for founding clients, first month free, rate locked for as long as you stay.",
  },
  {
    question: "Is there a setup fee?",
    answer:
      "No. Setup is waived for founding clients. Every engagement starts with a one-week Operations Audit for R2,000, credited to your first month.",
  },
  {
    question: "What if we have several branches or need custom integrations?",
    answer:
      "Multi-entity groups and custom integrations are expanded mandates, priced on scope. Book the audit and we’ll quote it in the roadmap.",
  },
  {
    question: "Can we cancel?",
    answer: "Yes — 30 days’ notice, no lock-in.",
  },
];
