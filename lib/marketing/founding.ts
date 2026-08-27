/* ── Founding-client, case-studies and South Africa copy ─────────────────────
   Workstream B of `.ai/plan_phase3_company_verticals_content.md`: the data
   this workstream's pages read. `/founding-client`'s content lives here in
   full; `/case-studies` + `/case-studies/turn-n-slice` keep their body copy
   inline in their own page files (the workstream constraint is "copy refresh
   only — every quote and fact must remain byte-identical", and moving that
   copy through a shared data file adds a place a character could drift
   without being caught by a direct before/after diff); `/south-africa` keeps
   its own arrays inline too, matching the pattern the pre-rebuild page itself
   already used. Nothing here is invented: the founding terms are the exact
   three facts `pricing-data.ts` already states (imported, not retyped), the
   FAQ answers are imported verbatim from `lib/marketing/faq.ts`, and the
   "gets"/"asks" lists are the plan's own settled copy
   (`.ai/plan_phase3_company_verticals_content.md`, Workstream B). */

import { FOUNDING_TERMS } from "@/components/finch/pricing/pricing-data";
import { FAQ_GROUPS, type FaqItem } from "./faq";

export { FOUNDING_TERMS };

export const CANONICAL_URL = "https://vyso.co.za/founding-client";

/* ≤60 chars leading with the query, ≤155 with a number and "South Africa" —
   the plan's own metadata rule, verified by script (54 / 143 chars). */
export const TITLE = "Founding client terms — setup waived, first month free";
export const DESCRIPTION =
  "Vyso founding-client terms: setup waived, first month free, rate locked. Starts with the free operations audit, for South African food SMEs.";

/* ── What a founding client gets ─────────────────────────────────────────── */

export type FoundingStep = { title: string; copy: string };

export const FOUNDING_GETS: readonly FoundingStep[] = [
  {
    title: "The Operations Audit",
    copy: "One week on your invoices, statements and stock sheets — where the money is leaking, in rand, with the evidence attached.",
  },
  {
    title: "A priority roadmap",
    copy: "The leak report becomes an order: which agents and modules go live first, and why.",
  },
  {
    title: "Agents, switched on in order",
    copy: "Nothing switched on speculatively — each agent activates against the workflow the audit found first.",
  },
  {
    title: "A monthly ops review",
    copy: "With your Vyso lead, every month — what changed, what to fix next.",
  },
  {
    title: "A direct line to the founder",
    copy: "Founding clients reach Josh directly, not a support queue.",
  },
] as const;

/* ── What we ask in return ───────────────────────────────────────────────── */

export const FOUNDING_ASKS: readonly string[] = [
  "Specific feedback as you use it — what's wrong, what's missing, what nobody on your team touches.",
  "A monthly call to review how it's actually going.",
  "Permission to quote an outcome once it's real, and only once you've approved the wording.",
] as const;

/* ── The cohort row ───────────────────────────────────────────────────────
   `null` = an open slot, drawn hollow with a mono `OPEN` chip. Fill only what
   is true: one founding client is live today. The count of circles (8) is a
   design choice for the row, not a stated cap — nowhere on the page asserts
   a maximum cohort size, because none is settled. */

export type CohortSeat = {
  name:  string;
  label: string;
  href:  string;
} | null;

export const COHORT: readonly CohortSeat[] = [
  { name: "Turn 'n Slice", label: "TURN 'N SLICE", href: "/case-studies/turn-n-slice" },
  null,
  null,
  null,
  null,
  null,
  null,
  null,
] as const;

/* ── FAQs, imported not duplicated ───────────────────────────────────────
   The exact question/answer strings from `lib/marketing/faq.ts`'s "pricing"
   group — the terms a prospective founding client actually asks about. Same
   text feeds the page and its FAQPage JSON-LD, so they can never drift. */

const FOUNDING_FAQ_IDS = [
  "how-much-does-finch-cost",
  "is-there-a-setup-cost",
  "founding-terms",
  "several-locations-custom-integrations",
  "can-we-cancel",
] as const;

const PRICING_GROUP = FAQ_GROUPS.find((group) => group.id === "pricing");
if (!PRICING_GROUP) {
  throw new Error("founding.ts: lib/marketing/faq.ts has no 'pricing' group to import from.");
}

export const FOUNDING_FAQS: readonly FaqItem[] = FOUNDING_FAQ_IDS.map((id) => {
  const item = PRICING_GROUP.questions.find((q) => q.id === id);
  if (!item) {
    throw new Error(`founding.ts: FAQ id "${id}" not found in lib/marketing/faq.ts's pricing group.`);
  }
  return item;
});

const FOUNDING_CONTENT = {
  CANONICAL_URL,
  TITLE,
  DESCRIPTION,
  FOUNDING_TERMS,
  FOUNDING_GETS,
  FOUNDING_ASKS,
  COHORT,
  FOUNDING_FAQS,
};

export default FOUNDING_CONTENT;
