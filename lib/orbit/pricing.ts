/* ── Orbit pricing ───────────────────────────────────────────────────────────
   One plan, one number: R99 per tradesperson per month.

   Two things this file deliberately does not do.

   1. **It does not invent an offer.** The brief asked whether waitlist members
      get a first month free; the answer, absent a decision from Josh, is that
      the site does not say so. What it says instead is the thing that is true:
      joining the waitlist locks founding pricing. Anything stronger would be a
      commitment made by a website rather than by a person.
   2. **It does not resolve the VAT question.** R99 is the price. Whether it is
      quoted inclusive of VAT is settled at launch, and `ORBIT.price.vatNote`
      says exactly that, on the pricing page, next to the number.

   The comparison rows below are against "a notebook, WhatsApp and a bank
   statement", which is what the alternative actually is for most one-person
   trade businesses — not a competitor product. The claims in the left column
   are about that way of working; the right column is what Orbit is being built
   to do, phrased as intent because it is not shipped.                          */

import { ORBIT } from "./site";

export const ORBIT_PLAN = {
  name: "Orbit",
  price: ORBIT.price.display,
  cadence: "/ month",
  unit: ORBIT.price.unit,
  vatNote: ORBIT.price.vatNote,
  /** The one-line summary answer engines will lift. */
  directAnswer:
    "Orbit costs R99 per tradesperson per month. It is one plan with everything in it; there is no tiering, no per-invoice fee and no setup cost. Orbit is in development, and joining the waitlist locks founding pricing.",
  included: [
    "Job tracking from WhatsApp — what you did, where, and what you charged",
    "Draft invoices prepared from the job, ready for you to check and send",
    "Materials and costs recorded against the job that used them",
    "A live answer to “who still owes me”",
    "An end-of-day summary of what the day earned",
    "Your own price history, per customer and per address",
    "Records held on the Vyso operations platform, exportable and yours",
  ],
  /** Stated as absent so nobody has to guess. */
  notIncluded: [
    "Quoting (roadmap)",
    "Taking payment inside the chat (roadmap)",
    "Reading photos of slips and delivery notes (roadmap)",
    "More than one person on one account (roadmap)",
    "Afrikaans and isiZulu (roadmap)",
  ],
  waitlistNote:
    "Nothing is charged today. Orbit is in development; the waitlist is free, commits you to nothing, and locks founding pricing for the people on it.",
} as const;

export type CompareRow = { question: string; today: string; orbit: string };

/** "Notebook + WhatsApp + bank statement" versus Orbit. Tables are the format
    generative engines quote most readily, which is why the same content is
    laid out as one on `/orbit/pricing` and both `/orbit/compare/*` pages. */
export const AGAINST_THE_NOTEBOOK: CompareRow[] = [
  {
    question: "Where the job gets written down",
    today: "A notebook in the bakkie, a photo of a page, or nowhere at all.",
    orbit: "One WhatsApp message, sent when the job finishes.",
  },
  {
    question: "When the invoice gets written",
    today: "An evening, days later, from memory — if the job was big enough to be worth it.",
    orbit: "Drafted from the job on the spot; you check it and send it.",
  },
  {
    question: "Small jobs",
    today: "Often never invoiced, because the admin costs more than the job earns.",
    orbit: "Recorded in one line, so a R450 job costs seconds rather than an evening.",
  },
  {
    question: "Materials",
    today: "Slips in the bakkie, matched to jobs weeks later or not at all.",
    orbit: "Told to Orbit as you buy them, held against the job.",
  },
  {
    question: "Knowing who owes you",
    today: "A bank statement and a memory.",
    orbit: "Ask in the chat; the answer comes from your own records.",
  },
  {
    question: "Knowing what you charged last time",
    today: "A guess, usually low.",
    orbit: "A searchable history per customer and per address.",
  },
  {
    question: "What it costs",
    today: "Nothing up front, and the unbilled work you never noticed.",
    orbit: "R99 per tradesperson per month.",
  },
];

/** The billing questions `/orbit/pricing` answers under the table. Ids match
    `lib/orbit/faq.ts` where the same question is answered there, so the two
    pages cannot drift; anything billing-specific lives here. */
export const PRICING_FAQ_IDS = ["what-does-it-cost", "vat", "valid-invoice", "payments", "contract", "when-does-it-launch"] as const;

export default ORBIT_PLAN;
