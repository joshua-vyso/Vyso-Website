/* ── A COO's day: the default content ────────────────────────────────────────
   The day strip (`DayStrip.tsx`) takes every string it draws as a prop; this
   file is the default set — one working day as Finch runs it. Phase 2's
   `/compare/finch-vs-hiring-a-coo` passes its own beats to the same component.

   Every beat is derived from `lib/marketing/findings.ts` by id. That file is
   a plain data module (no `"use client"`), so — unlike this file's previous
   shape, which read `BRIEF_FINDINGS` out of `BriefPhone.tsx` and was therefore
   client-only by construction — this module carries no client boundary of its
   own and could be imported from either side of the App Router split.

   The three headline findings are chosen for what this page argues (COO vs
   Finch, in rand): `debtors-past-60` at R187,000 is the biggest of the three,
   alongside the flagship `butternut-price` and the shorted-crates
   `recon-crates`. This is deliberately **not** `BriefPhone.tsx`'s own
   `BRIEF_IDS` (`butternut-price`, `debtors-thyme-basil`, `recon-drums`) —
   that set stays the homepage's morning/evening brief, untouched here. The
   fourth, dimmed beat is `stock-holiday-overstock` (≈ R38,000 tied up) — not
   the library's other Stock Sense card, `stock-oil-cover` (R9,800,
   `resolved`, kept deliberately small as contrast elsewhere).

   The evening card's rand figure is derived, not hardcoded: it is the largest
   of the three headline impacts, read out of their own `impact` strings, so
   the copy cannot drift out of sync with the library the way a written-out
   "R58,000" once could.                                                      */

import { getFinding, type Finding, type FindingId } from "@/lib/marketing/findings";

export type DayBeat = {
  /** Wall-clock label, and half of the caption the beat gets under the stage. */
  time:        string;
  /** 0 at 06:00, 1 at 18:00 — drives both the clock tick and the beat order. */
  at:          number;
  agent:       string;
  observation: string;
  impact:      string;
  evidence:    string;
};

/** One bubble of the evening message. Structurally the same shape the
    homepage's brief bubbles use. */
export type BriefFinding = {
  label:       string;
  observation: string;
  impact:      string;
  chip:        string;
};

export type EveningBrief = {
  greeting: string;
  /** Up to three; the stage lands them one after another. */
  findings: readonly BriefFinding[];
};

/** 06:00 → 18:00 is the working day the clock draws; everything maps onto it. */
const DAY_START_MIN = 6 * 60;
const DAY_SPAN_MIN  = 12 * 60;
const at = (hh: number, mm: number) => (hh * 60 + mm - DAY_START_MIN) / DAY_SPAN_MIN;

/** Pulls the leading "Rxxx,xxx" out of an `impact` string — every card's
    impact carries exactly one, per `findings.ts`'s own magnitude rule. */
function randFigure(impact: string): string {
  const match = impact.match(/R[\d,]+/);
  if (!match) throw new Error(`No rand figure in impact: "${impact}"`);
  return match[0];
}
function randAmount(impact: string): number {
  return Number(randFigure(impact).slice(1).replace(/,/g, ""));
}

/** The three headline findings, in the order they land on the stage. */
const HEADLINE_IDS = [
  "butternut-price",
  "debtors-past-60",
  "recon-crates",
] as const satisfies readonly FindingId[];

const HEADLINES: readonly Finding[] = HEADLINE_IDS.map(getFinding);

/** The fourth beat: real, but not one of the three that makes the evening
    message — the strip dims it for exactly that reason. */
const OVERSTOCK = getFinding("stock-holiday-overstock");

/** Composition-independent parts of the library's summary card — the agent
    label and the generic "3 findings" evidence apply to any three-finding
    brief, so they're reused rather than re-typed. */
const BRIEF_LABEL = getFinding("brief-evening");

/** The biggest of the three headline impacts, by its own stated rand figure. */
const LARGEST = HEADLINES.reduce((max, f) => (randAmount(f.impact) > randAmount(max.impact) ? f : max));

export const DAY_BEATS: DayBeat[] = [
  {
    time: "06:14",
    at: at(6, 14),
    agent: HEADLINES[0].agent,
    observation: HEADLINES[0].observation,
    impact: HEADLINES[0].impact,
    evidence: `${HEADLINES[0].evidence} ↗`,
  },
  {
    time: "07:40",
    at: at(7, 40),
    agent: HEADLINES[1].agent,
    observation: HEADLINES[1].observation,
    impact: HEADLINES[1].impact,
    evidence: `${HEADLINES[1].evidence} ↗`,
  },
  {
    time: "09:05",
    at: at(9, 5),
    agent: HEADLINES[2].agent,
    observation: HEADLINES[2].observation,
    impact: HEADLINES[2].impact,
    evidence: `${HEADLINES[2].evidence} ↗`,
  },
  {
    /* The fourth finding of the day, and the one that does NOT make the evening
       brief — which is why the strip dims it when the three headlines leave for
       the phone. Three headlines out of four findings is the point: Finch
       ranks, it doesn't forward everything. */
    time: "11:30",
    at: at(11, 30),
    agent: OVERSTOCK.agent,
    observation: OVERSTOCK.observation,
    impact: OVERSTOCK.impact,
    evidence: `${OVERSTOCK.evidence} ↗`,
  },
  {
    /* The evening card: the agent label and evidence phrasing come from the
       library's own summary card, but the observation and the three-figure
       impact line are built from this file's own headline three, not the
       library's `BRIEF_IDS` composition — see the header note. */
    time: "17:55",
    at: at(17, 55),
    agent: BRIEF_LABEL.agent,
    observation: `Evening. Three things from today — one’s worth ${randFigure(LARGEST.impact)}.`,
    impact: HEADLINES.map((f) => randFigure(f.impact)).join(" · "),
    evidence: `${BRIEF_LABEL.evidence} ↗`,
  },
];

/** Hour labels along the clock hairline. */
export const CLOCK_HOURS = ["06:00", "09:00", "12:00", "15:00", "18:00"];

/** The quiet afternoon: the stretch where the honest answer is "nothing". */
export const AFTERNOON_NOTE = "12:00–17:00 · NOTHING WORTH INTERRUPTING YOU FOR";

/** What the phone says at 17:55 — the same sentence the closing beat carries. */
export const EVENING_GREETING = DAY_BEATS[DAY_BEATS.length - 1].observation;

/** The three headline findings, as the phone's bubble shape. */
const EVENING_FINDINGS: readonly BriefFinding[] = HEADLINES.map((f) => ({
  label:       f.agent,
  observation: f.observation,
  impact:      f.impact,
  chip:        `${f.evidence} ↗`,
}));

/** What the phone says at 17:55 — the same three findings, one message. */
export const EVENING_BRIEF: EveningBrief = {
  greeting: EVENING_GREETING,
  findings: EVENING_FINDINGS,
};
