/* ── /operations-audit content ───────────────────────────────────────────────
   Every string the audit page shows lives here so the JSON-LD builder can read
   the same words the page renders — FAQPage and HowTo have to mirror on-page
   text exactly, and the only way to guarantee that is one source.

   Honesty rules (`.ai/vyso_v2.md` §4): the price and the credit are the two
   facts we can state without qualification; the start date is not, so the
   fourth FAQ says we confirm it when you book rather than promising a week we
   cannot verify. No rand figures are quoted for anyone's leakage — that number
   comes out of the audit itself, not out of this page. */

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

export const PRICE = { audit: 2000, finch: 6000, currency: "ZAR" } as const;

/** The audit OG card's alt text — the page's own `<h1>`, which is what the
    image renders. Shared by all three routes in the cluster: the two tool pages
    re-use `/operations-audit`'s generator, and Next reads `alt` as a segment
    export in each file, so it has to be *declared* there rather than
    re-exported. One constant is what stops three copies drifting. */
export const AUDIT_OG_ALT = "One week. Let’s find out where you’re leaking money and time.";

/** The AEO direct answer: complete on its own, with the number and the unit. */
export const DIRECT_ANSWER =
  "The Operations Audit is one week. We take your invoices, statements and stock sheets and come back with where the money is leaking — in rand, with the evidence attached. R2,000, credited to your first month of Finch.";

/* ── What we need / what you get ──────────────────────────────────────────────
   These two lists now sit inside the hero, in a column that shares its row with
   the booking form, so they are written as phrases rather than as the full
   sentences the old standalone band carried. Nothing was dropped: the long form
   of "what we need" is the second FAQ answer word for word, and "you keep the
   report" is the third — so the quotable version still exists on the page. */

export const WHAT_WE_NEED: readonly string[] = [
  "Last month’s supplier invoices.",
  "Bank and creditor statements.",
  "A stock sheet, or a POS export.",
  "Thirty minutes with whoever signs the orders.",
];

export const WHAT_YOU_GET: readonly string[] = [
  "A leak report: every finding in rand, with the evidence.",
  "A priority roadmap: what to switch on first, and in what order.",
  "The R2,000 credited if you go ahead. The report is yours either way.",
];

/* ── The week, four steps ────────────────────────────────────────────────────
   Doubles as the `HowTo` steps. Deliberately describes what we do, not how
   fast: the only timing claim is that the audit runs over a week. */

export type AuditStep = { n: string; label: string; text: string };

export const AUDIT_STEPS: readonly AuditStep[] = [
  {
    n: "01",
    label: "BOOK",
    text: "You send the documents through and we confirm the start date when you book.",
  },
  {
    n: "02",
    label: "READ",
    text: "Every invoice, statement and stock sheet is read into line items — supplier, unit, price, date.",
  },
  {
    n: "03",
    label: "QUANTIFY",
    text: "Each finding gets a rand figure and the evidence behind it. No number without its working.",
  },
  {
    n: "04",
    label: "REPORT",
    text: "Thirty minutes with you: the leak report, the priority roadmap, and what we would switch on first.",
  },
];

/* ── The same week, as seven days ────────────────────────────────────────────
   The blue band draws the four steps along a Mon→Sun rail (6b: "seven dots on
   a hairline, the four step labels anchored to their days"). This is the map
   between the two, and it is deliberately *shape*, not schedule: the audit runs
   over a week, the working days carry the work and the weekend does not, but
   which Monday is a thing we confirm when you book — the fourth FAQ says so and
   `AUDIT_WEEK_NOTE` repeats it under the rail so the picture cannot be read as
   a promise the page has not made.

   `short` is the single-letter form the 375px rail uses, where seven three-
   letter labels do not fit and abbreviating them further would be illegible. */

export type AuditDay = {
  label: string;
  short: string;
  /** The `AUDIT_STEPS` number that lands on this day, if any. */
  step?: string;
};

export const AUDIT_WEEK: readonly AuditDay[] = [
  { label: "MON", short: "M", step: "01" },
  { label: "TUE", short: "T", step: "02" },
  { label: "WED", short: "W" },
  { label: "THU", short: "T", step: "03" },
  { label: "FRI", short: "F", step: "04" },
  { label: "SAT", short: "S" },
  { label: "SUN", short: "S" },
];

export const AUDIT_WEEK_NOTE =
  "THE SHAPE OF THE WEEK · WE CONFIRM THE START DAY WHEN YOU BOOK";

/* ── FAQs ────────────────────────────────────────────────────────────────── */

export type Faq = { question: string; answer: string };

export const AUDIT_FAQS: readonly Faq[] = [
  {
    question: "What does the audit cost?",
    answer:
      "R2,000, once off. If you go ahead with Finch, that R2,000 is credited to your first month. Finch is R6,000 per location per month after that, everything included.",
  },
  {
    question: "What do you need from us?",
    answer:
      "Last month’s supplier invoices, your bank and creditor statements for the same period, a current stock sheet or POS export, and about thirty minutes with whoever signs the orders. If something is missing we work with what you have and say so in the report.",
  },
  {
    question: "What if we don’t sign?",
    answer:
      "You keep the report either way — the findings, the rand figures and the evidence behind them. There is no lock-in and nothing to cancel.",
  },
  {
    question: "How soon can it start?",
    answer:
      "We confirm the start date when you book. The audit itself runs over one week, from the day your documents are in.",
  },
];
