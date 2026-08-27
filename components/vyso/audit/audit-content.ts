/* ── /operations-audit content ───────────────────────────────────────────────
   The strings the page renders AND the strings its `HowTo` schema publishes,
   in one place, because the two have to agree exactly: a `HowTo` whose steps
   are not visible on the page is a manual action waiting to happen. The Phase 0
   era file `components/finch/audit/audit-content.ts` did the same job for the
   old page and is left alone (Phase 4 deletes it with the route's old
   components).

   ── The two facts this page may state without qualification ─────────────────
   It is free, and it takes about an hour. Everything else about timing is
   confirmed when you book, because we cannot promise a date we have not looked
   at. What comes AFTER the audit is priced per problem and quoted privately, so
   no figure for Vyso's work appears here, in the schema, or anywhere on the
   site (plan §3.1). The only permitted price on the whole surface is the audit's
   own zero, which lives in the sitewide `Service` node in `app/layout.tsx`. */

const ORIGIN = "https://vyso.co.za";

export const AUDIT_PATH = "/operations-audit";
export const AUDIT_CANONICAL_URL = `${ORIGIN}${AUDIT_PATH}`;

/* The two tools that live under this route. Restyled onto this same shell in
   Phase 5 (`components/vyso/audit/AuditToolPage.tsx`), so their canonical URLs
   are derived from the one path above rather than duplicated as string
   literals in each tool page. */
export const SCORE_PATH = `${AUDIT_PATH}/score`;
export const CALCULATOR_PATH = `${AUDIT_PATH}/calculator`;
export const SCORE_CANONICAL_URL = `${ORIGIN}${SCORE_PATH}`;
export const CALCULATOR_CANONICAL_URL = `${ORIGIN}${CALCULATOR_PATH}`;

/** The in-page anchor every "book the audit" on this page and in the two tools
    points at. The form is in the hero. */
export const BOOK_HREF = `${AUDIT_PATH}#book`;

/** The AEO direct answer (plan §8): the first two sentences of the page, and
    complete on their own if an answer engine lifts them out of the document. */
export const DIRECT_ANSWER =
  "The operations audit is free and takes about an hour. We walk through how work actually " +
  "moves through your business, then send you a written report of where time and money are " +
  "leaking and what would be worth automating first.";

export type AuditStep = { n: string; label: string; text: string };

/* The brief's five steps. Written as what we do rather than as how long it
   takes, because the hour is the only timing claim on the page. */
export const AUDIT_STEPS: readonly AuditStep[] = [
  {
    n: "01",
    label: "Tell us how your operation works",
    text: "You walk us through an ordinary week: how orders arrive, who touches them, what gets retyped, where things wait. Whoever actually runs the day should be in the room. There is nothing to prepare and nothing to send first.",
  },
  {
    n: "02",
    label: "We examine where the work goes",
    text: "Repetitive processes, how information moves between people and tools, manual admin, bottlenecks, and the blind spots: the things nobody sees until they have already cost you something.",
  },
  {
    n: "03",
    label: "We identify the opportunities",
    text: "Each one is a specific piece of work that could happen by itself, or a specific problem the system could catch on its own, with an honest view of what it is plausibly worth to you.",
  },
  {
    n: "04",
    label: "You get a written findings report",
    text: "Plain language, ranked by potential return, yours to keep and to act on with us, with somebody else, or on your own. It is the output of the audit, not a proposal wearing a report's clothes.",
  },
  {
    n: "05",
    label: "We recommend where to start",
    text: "One place, the one with the highest return, with a fixed build price and a monthly run price quoted for it. Starting there is a decision you make after you have read the report.",
  },
];

/* What the audit is FOR, in the owner's terms. Six outcomes, from the brief. */
export type AuditOutcome = { title: string; body: string };

export const AUDIT_OUTCOMES: readonly AuditOutcome[] = [
  {
    title: "Time back",
    body: "The work that repeats every day and needs a person only because nobody has taken it off them.",
  },
  {
    title: "Fewer mistakes",
    body: "The retyped quantity, the wrong price on the invoice, the order captured twice on a busy morning.",
  },
  {
    title: "Visibility",
    body: "Knowing what is happening across the operation today, instead of assembling it from three people at month end.",
  },
  {
    title: "Protected margins",
    body: "Supplier prices that crept, orders earning less than they should, discounts that outlived the deal that justified them.",
  },
  {
    title: "Faster response",
    body: "Problems that surface while there is still time to do something about them, rather than on the loading bay.",
  },
  {
    title: "Less admin",
    body: "Fewer hours spent moving information between a spreadsheet, an inbox and an accounting package.",
  },
];

/** The honesty line (plan §3.8). It appears ONCE on the site, and this is it. */
export const HONESTY_LINE =
  "Sometimes the right answer is a better spreadsheet. If that's the case, we'll tell you.";
