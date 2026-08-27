/* ── /operations-audit content ───────────────────────────────────────────────
   Every string the audit page shows lives here so the JSON-LD builder can read
   the same words the page renders — FAQPage and HowTo have to mirror on-page
   text exactly, and the only way to guarantee that is one source.

   ── The audit is free (`.ai/plan_home_only.md`, change 4) ────────────────────
   It used to be a paid week at a published price, credited against the first
   month. It is free now, and it is about an hour with you rather than a week
   with your documents. What comes out of it is a roadmap.

   The one thing this page must not do is publish a price for what follows.
   Pricing is per customer and per scope: every item on the roadmap gets a fixed
   build price and a monthly run price, and both are quoted to you directly
   after the audit. Nothing is published, so nothing here quotes an amount, and
   the "credited against your first month" language is gone with the fee.

   Honesty rules (`.ai/vyso_v2.md` §4): the price (nothing) and the length
   (about an hour) are the two facts we can state without qualification; the
   date is not, so the fourth FAQ says we confirm it when you book rather than
   promising a day we cannot verify. No rand figures are quoted for anyone's
   leakage — that number comes out of the audit itself, not out of this page. */

export const CANONICAL_URL = "https://vyso.co.za/operations-audit";

/* ── The audit cluster's three URLs, once ────────────────────────────────────
   6b fixes r2 split the two tools out of `/operations-audit` into pages of
   their own. Paths and canonicals are both needed and are both derived from
   the one string above: an `href` has to be root-relative for `next/link` (and
   for `MagneticButton`, which decides between a client navigation and a plain
   anchor on exactly that test), while metadata, JSON-LD and the sitemap need
   the absolute form. Two constants that happen to agree would eventually not. */
export const AUDIT_PATH = "/operations-audit";
export const SCORE_PATH = `${AUDIT_PATH}/score`;
export const CALCULATOR_PATH = `${AUDIT_PATH}/calculator`;
export const SCORE_CANONICAL_URL = `${CANONICAL_URL}/score`;
export const CALCULATOR_CANONICAL_URL = `${CANONICAL_URL}/calculator`;
/** Every "Book the audit" inside the two tools points here — the booking form
    is on the parent page now, so an in-page `#book` would be a dead hash. */
export const BOOK_HREF = `${AUDIT_PATH}#book`;

/** The audit OG card's alt text — the page's own `<h1>`, which is what the
    image renders. Shared by all three routes in the cluster: the two tool pages
    re-use `/operations-audit`'s generator, and Next reads `alt` as a segment
    export in each file, so it has to be *declared* there rather than
    re-exported. One constant is what stops three copies drifting. */
export const AUDIT_OG_ALT = "An hour, free. Let’s find out where you’re leaking money and time.";

/** The AEO direct answer: complete on its own, with the offer and the output. */
export const DIRECT_ANSWER =
  "The operations audit is free and takes about an hour with you. We walk through how the work actually moves through your business and come back with where the money and the time are leaking, and a roadmap of what to automate first.";

/* ── What we need / what you get ──────────────────────────────────────────────
   These two lists sit inside the hero, in a column that shares its row with the
   booking form, so they are written as phrases rather than as the full
   sentences a standalone band would carry. The long form of "what we need" is
   the second FAQ answer and "the roadmap is yours" is the third, so the
   quotable version still exists on the page. */

export const WHAT_WE_NEED: readonly string[] = [
  "About an hour of your time.",
  "Whoever actually runs the day, in the room.",
  "An honest walk through how the work moves.",
  "Nothing to prepare and nothing to send first.",
];

export const WHAT_YOU_GET: readonly string[] = [
  "Where the money and the time are leaking.",
  "A roadmap: what to automate first, and in what order.",
  "A fixed build price and a monthly run price for each item, quoted to you directly.",
];

/* ── The hour, four steps ────────────────────────────────────────────────────
   Doubles as the `HowTo` steps. Deliberately describes what we do, not how
   fast: the only timing claim is that the audit takes about an hour. */

export type AuditStep = { n: string; label: string; text: string };

export const AUDIT_STEPS: readonly AuditStep[] = [
  {
    n: "01",
    label: "BOOK",
    text: "You pick a time and we confirm it. There is nothing to prepare and nothing to send through first.",
  },
  {
    n: "02",
    label: "WALK",
    text: "We walk your day with you, order to invoice to payment, and write down what actually happens rather than what a system says should.",
  },
  {
    n: "03",
    label: "FIND",
    text: "We name where the money and the time are leaking, and what it would take to close each one.",
  },
  {
    n: "04",
    label: "ROADMAP",
    text: "You get a roadmap: what to automate first and in what order, with a fixed build price and a monthly run price against each item.",
  },
];

export const AUDIT_HOUR_NOTE =
  "THE SHAPE OF THE HOUR · WE CONFIRM THE TIME WHEN YOU BOOK";

/* ── FAQs ────────────────────────────────────────────────────────────────── */

export type Faq = { question: string; answer: string };

export const AUDIT_FAQS: readonly Faq[] = [
  {
    question: "What does the audit cost?",
    answer:
      "Nothing. It is free, it takes about an hour, and there is no obligation at the end of it. What we build afterwards is priced per customer and per scope: every item on your roadmap carries a fixed build price and a monthly run price, quoted to you directly once we know what you actually need.",
  },
  {
    question: "What do you need from us?",
    answer:
      "About an hour, and whoever actually runs the day in the room with us. Nothing to prepare and nothing to send through first. If it helps to look at a few real documents while we talk, bring them, but the hour works without them.",
  },
  {
    question: "What if we don’t go ahead?",
    answer:
      "You keep the roadmap either way, with what we found and what we would do about it. There is nothing owed, no lock-in and nothing to cancel.",
  },
  {
    question: "How soon can it start?",
    answer:
      "We confirm the time when you book. It is one sitting of about an hour, in person in Johannesburg or on a call anywhere in South Africa.",
  },
];
