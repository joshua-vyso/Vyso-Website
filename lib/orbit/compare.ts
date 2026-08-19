/* ── The two comparison pages ────────────────────────────────────────────────
   `/orbit/compare/orbit-vs-job-management-apps` and
   `/orbit/compare/orbit-vs-spreadsheets`.

   The honesty rule that matters most on a comparison page is the one about the
   *other* side. No competitor is named, no competitor's pricing is quoted, and
   nothing is claimed about a named product's features — because we have not
   audited them, and a comparison table that gets a rival's feature wrong is
   both dishonest and legally interesting. What is compared instead is the
   **category**: what job-management apps as a class ask of a one-person trade
   business, and what a spreadsheet as a class does.

   The Orbit column is written in the same "being built to" voice as every
   other page, because Orbit is not shipped. A comparison table is the easiest
   place in a website to accidentally promise something, so every cell in the
   Orbit column below was written after asking: is this a description of intent,
   and does it read as one?                                                     */

import type { CompareRow } from "./pricing";

export type OrbitComparison = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  /** The direct answer, first paragraph, quotable on its own. */
  answer: string;
  /** Column headings for the table. */
  columns: [string, string, string];
  rows: CompareRow[];
  /** Two or three paragraphs after the table. */
  body: string[];
  /** The honest "when the other one is the right answer" section. */
  whenNot: { title: string; body: string };
};

export const VS_JOB_APPS: OrbitComparison = {
  slug: "orbit-vs-job-management-apps",
  metaTitle: "Orbit vs job management apps for SA trades",
  metaDescription:
    "How Orbit differs from job management apps: no app to install, no per-user dashboard to learn — it runs in WhatsApp, from R99 a month.",
  h1: "Orbit vs job management apps.",
  answer:
    "Job management apps ask a tradesperson to adopt a new app, log in, and keep it up to date alongside the work; Orbit is being built to work inside WhatsApp, where the work is already being discussed. Both end up with jobs and invoices — the difference is what has to change about your day to get there. Orbit is in development at R99 per tradesperson per month.",
  columns: ["", "A job management app", "Orbit"],
  rows: [
    {
      question: "What you install",
      today: "An app, on every phone that needs it, kept updated.",
      orbit: "Nothing. Orbit is being built as a WhatsApp conversation.",
    },
    {
      question: "What you learn",
      today: "A dashboard, a job list, a settings screen and a workflow.",
      orbit: "How to type a sentence, which you already know.",
    },
    {
      question: "When the record gets made",
      today: "When someone opens the app — often that evening, often not at all.",
      orbit: "When the job finishes, in the message you were half-writing anyway.",
    },
    {
      question: "Who it is designed for",
      today: "Usually a team with an office, a scheduler and a manager.",
      orbit: "One or two people, no office, phone in a pocket.",
    },
    {
      question: "Scheduling and dispatch",
      today: "Usually the core feature, and often the reason for the price.",
      orbit: "Not the point, and not in the first release.",
    },
    {
      question: "Invoices",
      today: "Generated in the app; you send from the app.",
      orbit: "Drafted in the chat; you check and send. Orbit drafts, you send.",
    },
    {
      question: "What it costs",
      today: "Varies widely by product and seat count — check the vendor.",
      orbit: "R99 per tradesperson per month, one plan.",
    },
  ],
  body: [
    "The category is not wrong. Job management software is genuinely good at what it is for: a business with several teams, a person in an office moving them around, and enough volume that a scheduler earns its keep. If that is your business, a proper job-management product will beat a chat thread, and this page is not going to pretend otherwise.",
    "The problem it does not solve is adoption by a person who is not at a desk. The reason so many small trade businesses buy one of these products and stop using it inside a month is not the software — it is that using it requires a second habit, formed after a nine-hour day, in an app nobody opens for any other reason. WhatsApp does not have that problem, because it is already open.",
    "So Orbit is being built for the narrow case: the record, the money and the invoice, made in one message, by the person who did the work, at the moment they finished it. Everything that requires an office is deliberately out of scope.",
  ],
  whenNot: {
    title: "When a job management app is the better answer",
    body:
      "If you dispatch several teams a day, need a live schedule everyone can see, run stock across a warehouse, or have an office person whose job is coordination, a dedicated job-management product will do things Orbit is not being built to do. Orbit is aimed at one- and two-person operations, and it will not pretend to scale past them.",
  },
};

export const VS_SPREADSHEETS: OrbitComparison = {
  slug: "orbit-vs-spreadsheets",
  metaTitle: "Orbit vs spreadsheets for tradespeople",
  metaDescription:
    "A spreadsheet only works if you sit down and fill it in. Orbit is being built to take the record from a WhatsApp message. R99 a month.",
  h1: "Orbit vs a spreadsheet and a notebook.",
  answer:
    "A spreadsheet is free, flexible and completely dependent on somebody sitting down to fill it in; Orbit is being built so the record is made by the message you send when the job ends. If your spreadsheet is up to date this week, it is doing its job — most are not, and the gap is where unbilled work lives. Orbit is in development at R99 per tradesperson per month.",
  columns: ["", "A spreadsheet or notebook", "Orbit"],
  rows: [
    {
      question: "Where the data comes from",
      today: "You, later, from memory.",
      orbit: "The message you send when the job finishes.",
    },
    {
      question: "How up to date it is",
      today: "As up to date as your last quiet evening.",
      orbit: "As up to date as your last message.",
    },
    {
      question: "Small jobs",
      today: "Usually missing, because a row is more effort than the job feels worth.",
      orbit: "One line, so they get recorded.",
    },
    {
      question: "Making an invoice",
      today: "A separate document, retyped from the sheet.",
      orbit: "Drafted from the job you already recorded.",
    },
    {
      question: "Finding what you charged before",
      today: "Scrolling, or a filter, if the sheet has the job in it at all.",
      orbit: "Ask in the chat.",
    },
    {
      question: "Working on a phone",
      today: "Possible, unpleasant, rarely done.",
      orbit: "The only way it works.",
    },
    {
      question: "What it costs",
      today: "Nothing, plus the evenings and the work that never got billed.",
      orbit: "R99 per tradesperson per month.",
    },
  ],
  body: [
    "Spreadsheets are underrated. They cost nothing, they do exactly what you tell them, and a tradesperson who genuinely keeps one current has a better view of their business than most people with software. The trouble is the word \"current\": a sheet is a record of the discipline you had last week, not of the work you did.",
    "The failure is predictable and it is always the same shape. The big jobs go in, because they are memorable and worth the effort. The small ones do not, because a R450 callout does not feel like it justifies opening a laptop. Over a month, the sheet describes a business that does five large jobs, when the real one did five large jobs and nineteen small ones, eleven of which were never invoiced.",
    "Orbit is being built to move the moment of recording from the evening to the job. Not because typing a message is more accurate than typing a row, but because you will actually do it. A record that exists is worth more than a better record that does not.",
  ],
  whenNot: {
    title: "When a spreadsheet is still the right tool",
    body:
      "If you are pricing a job, modelling what a rate change does to a year, or building a quote with thirty line items, use a spreadsheet — it is better at all three than any chat interface will be. Orbit is being built for capture, not for calculation.",
  },
};

export const ORBIT_COMPARISONS: OrbitComparison[] = [VS_JOB_APPS, VS_SPREADSHEETS];

export function getOrbitComparison(slug: string): OrbitComparison | undefined {
  return ORBIT_COMPARISONS.find((c) => c.slug === slug);
}

export default ORBIT_COMPARISONS;
