/* ── The finding library ─────────────────────────────────────────────────────
   Single source of truth for every finding card on the marketing site: heroes,
   the scroll sequence, the showcase frame, the brief bubbles, the day strip,
   industry decks, solutions pages and the OG images all draw from here by id.
   No inline card copy anywhere else (`.ai/vyso_v3_design.md` §5).

   Deliberately a **plain data module** — no `"use client"`, no React, no
   imports. That is the whole point: `app/opengraph-image.tsx` (a server route)
   and `components/finch/FindingCard.tsx` (a client component) both need the
   same strings, and before this file existed the OG route kept a hand-copied
   duplicate with a comment apologising for it. A module with no directive is
   readable from both sides of the boundary, so the duplicate is gone.

   ── The magnitude rule ──────────────────────────────────────────────────────
   Impacts are annualised **at a stated volume**, and the volume is printed in
   the card's own mono meta line (`≈ 650 BAGS/MO`, `18 PALLETS/MO`,
   `R2.1M/MO PURCHASES`). That is what makes a five-figure number believable
   rather than boastful: the reader can do the arithmetic themselves. Flagship
   examples land between R38,000 and R240,000 a year. The two small ones (R756,
   R9,800) are kept on purpose, flagged `small`, and only ever used as the
   "minor / already resolved" contrast — never as the headline.

   Everything here is illustrative. Card surfaces render an `ILLUSTRATIVE
   EXAMPLE(S)` caption; these are worked examples at a plausible operation's
   volumes, not measurements taken from a client.                              */

export type FindingState = "new" | "in-progress" | "resolved";

/** Which micro-visual the `wide` card variant draws (`components/finch/agents/
    AgentVisual.tsx` owns the drawings). `null` = the card carries no visual. */
export type FindingVisual = "sparkline" | "diff" | "bar" | "gauge" | null;

/** Vertical tags, matching `lib/marketing/industries.ts` slugs. A card with no
    tags is general-purpose and may appear on any page. */
export type FindingIndustry =
  | "restaurants"
  | "wholesalers"
  | "farms"
  | "manufacturers"
  | "retailers"
  | "distributors"
  | "security"
  | "insurance";

export type Finding = {
  id:          FindingId;
  /** The agent label, in the card's mono header. */
  agent:       string;
  observation: string;
  /** The rand line. Carries its own "≈" and its own unit — impacts are not
      formatted at the call site, because the shape varies (per year, still
      outstanding, tied up) and a formatter would flatten that. */
  impact:      string;
  evidence:    string;
  /** The mono trail: source · movement · **volume basis** · period. */
  meta:        string;
  state:       FindingState;
  actions:     readonly string[];
  visual:      FindingVisual;
  industries:  readonly FindingIndustry[];
  /** Four-figure or smaller. Only ever shown as contrast beside a real one. */
  small?:      boolean;
};

export type FindingId =
  | "butternut-price"
  | "cooking-oil-price"
  | "tomatoes-price"
  | "packaging-film-price"
  | "diesel-depots-price"
  | "recon-drums"
  | "recon-crates"
  | "recon-old-price-list"
  | "recon-delivery-fee"
  | "debtors-thyme-basil"
  | "debtors-past-60"
  | "debtors-drift"
  | "stock-oil-cover"
  | "stock-frozen-writeoff"
  | "stock-holiday-overstock"
  | "margin-slip"
  | "margin-below-cost"
  | "delivery-route-km"
  | "waste-plate"
  | "roster-guard-hours"
  | "roster-vehicle-fuel"
  | "renewals-lapsing"
  | "renewals-commission-short"
  | "brief-evening";

/* ── The roster ──────────────────────────────────────────────────────────────
   24 cards. Grouped by agent in source order so the file reads like the roster
   it is; nothing depends on the order.                                        */

const ROSTER: readonly Finding[] = [
  /* ── Price Watch ────────────────────────────────────────────────────────── */
  {
    /* THE FLAGSHIP. Homepage hero, sequence beat 4, showcase 1a/1c, the first
       brief bubble, the day strip, the root OG card. Arithmetic behind the
       number, so it survives being checked: ~650 × 10kg bags a month at R62 a
       bag is R40,300/mo of butternut; 12% of that is R4,836/mo ≈ R58,000/yr. */
    id: "butternut-price",
    agent: "PRICE WATCH",
    observation: "Butternut up 12% at FreshCo since June.",
    impact: "≈ R58,000/yr at current volumes",
    evidence: "3 invoices",
    meta: "FRESHCO · +12% · ≈ 650 BAGS/MO · JUN–AUG",
    state: "new",
    actions: ["Draft supplier email", "Show 6-month trend", "Dismiss"],
    visual: "sparkline",
    industries: ["restaurants", "wholesalers", "retailers", "distributors"],
  },
  {
    id: "cooking-oil-price",
    agent: "PRICE WATCH",
    observation: "Sunflower oil up 14% at Umgeni Oils across two price lists.",
    impact: "≈ R82,000/yr at current volumes",
    evidence: "4 invoices",
    meta: "UMGENI OILS · +14% · 6 × 20L/DAY · 26 DAYS/MO",
    state: "new",
    actions: ["Draft supplier email", "Compare two quotes", "Dismiss"],
    visual: "sparkline",
    industries: ["restaurants", "wholesalers", "manufacturers"],
  },
  {
    id: "tomatoes-price",
    agent: "PRICE WATCH",
    observation: "Grade 1 tomatoes are running R7.10/kg against a R5.40 winter average.",
    impact: "≈ R41,000/yr if this holds",
    evidence: "8 weeks of invoices",
    meta: "TWO SUPPLIERS · +31% · ≈ 1.9t/MO · MAY–AUG",
    state: "new",
    actions: ["Show the seasonal curve", "Draft supplier email", "Dismiss"],
    visual: "sparkline",
    industries: ["restaurants", "retailers", "wholesalers"],
  },
  {
    id: "packaging-film-price",
    agent: "PRICE WATCH",
    observation: "Shrink film is up 9% since the March list and nobody re-quoted it.",
    impact: "≈ R28,000/yr at current volumes",
    evidence: "2 invoices + 1 price list",
    meta: "PACKCO · +9% · 18 PALLETS/MO · MAR–AUG",
    state: "new",
    actions: ["Request a fresh quote", "Show 6-month trend", "Dismiss"],
    visual: "sparkline",
    industries: ["manufacturers", "distributors", "wholesalers"],
  },
  {
    id: "diesel-depots-price",
    agent: "PRICE WATCH",
    observation: "Diesel is 71c/l cheaper at the Pietermaritzburg depot than the one your trucks use.",
    impact: "≈ R96,000/yr on current fuel volumes",
    evidence: "3 months of fuel slips",
    meta: "2 DEPOTS · 71c/l GAP · ≈ 11,300 l/MO",
    state: "new",
    actions: ["Show the depot comparison", "Draft a route note", "Dismiss"],
    visual: "bar",
    industries: ["farms", "wholesalers", "distributors"],
  },

  /* ── Recon ──────────────────────────────────────────────────────────────── */
  {
    /* The deliberately small one. It stays in the library because a roster
       where every card is five figures is a roster nobody believes — this is
       the card that proves the agent reads *everything*, not just the big
       numbers. Never used as a headline; §5 keeps it as "small but real". */
    id: "recon-drums",
    agent: "RECON",
    observation: "Umgeni Oils INV-88412 bills 20 × 5L sunflower oil; your delivery note shows 18.",
    impact: "R756 over-billed",
    evidence: "invoice + delivery note",
    meta: "UMGENI OILS · INV-88412 · 2 SHORT",
    state: "in-progress",
    actions: ["Draft credit request", "Open both documents", "Dismiss"],
    visual: "diff",
    industries: [],
    small: true,
  },
  {
    id: "recon-crates",
    agent: "RECON",
    observation: "Thursday deliveries bill 40 crates and sign for 36, four weeks running.",
    impact: "≈ R58,000/yr at this rate",
    evidence: "4 delivery notes",
    meta: "WEEKLY · 4 CRATES SHORT · JUL–AUG",
    state: "new",
    actions: ["Draft credit request", "Show the four weeks", "Dismiss"],
    visual: "diff",
    industries: ["restaurants", "retailers", "wholesalers"],
  },
  {
    id: "recon-old-price-list",
    agent: "RECON",
    observation: "Three invoices are priced off last quarter's list, not the one you agreed in July.",
    impact: "≈ R33,000/yr if it keeps running",
    evidence: "3 invoices + the agreed list",
    meta: "1 SUPPLIER · 3 LINES · R2.1M/MO PURCHASES",
    state: "new",
    actions: ["Draft correction email", "Show the line differences", "Dismiss"],
    visual: "diff",
    industries: ["wholesalers", "distributors", "manufacturers"],
  },
  {
    id: "recon-delivery-fee",
    agent: "RECON",
    observation: "The delivery fee appears twice on every Monday invoice from this supplier.",
    impact: "≈ R14,000/yr double-billed",
    evidence: "6 invoices",
    meta: "MONDAYS · R268 × 52 · MAR–AUG",
    state: "new",
    actions: ["Draft credit request", "Show the six invoices", "Dismiss"],
    visual: "diff",
    industries: [],
  },

  /* ── Debtors ────────────────────────────────────────────────────────────── */
  {
    id: "debtors-thyme-basil",
    agent: "DEBTORS",
    observation: "Thyme & Basil Catering is 18 days past terms — day 48, their longest ever.",
    impact: "R23,400 outstanding",
    evidence: "2 unpaid invoices",
    meta: "THYME & BASIL · DAY 48 · TERMS 30",
    state: "new",
    actions: ["Draft polite reminder", "Payment history", "Dismiss"],
    visual: "bar",
    industries: ["restaurants", "wholesalers", "distributors"],
  },
  {
    id: "debtors-past-60",
    agent: "DEBTORS",
    observation: "Three accounts have crossed 60 days in the same month.",
    impact: "R187,000 outstanding",
    evidence: "9 unpaid invoices",
    meta: "3 ACCOUNTS · 60+ DAYS · AUG",
    state: "new",
    actions: ["Draft three reminders", "Show the ageing", "Dismiss"],
    visual: "bar",
    industries: ["wholesalers", "distributors", "manufacturers"],
  },
  {
    id: "debtors-drift",
    agent: "DEBTORS",
    observation: "Your second-biggest customer has paid 12 days later each quarter for a year.",
    impact: "≈ R41,000/yr in cash-flow cost",
    evidence: "16 settled invoices",
    meta: "1 ACCOUNT · +12 DAYS/QUARTER · 12 MONTHS",
    state: "new",
    actions: ["Show the drift", "Draft a terms conversation", "Dismiss"],
    visual: "bar",
    industries: ["wholesalers", "distributors"],
  },

  /* ── Stock Sense ────────────────────────────────────────────────────────── */
  {
    /* The second deliberately small card, and the site's only `resolved` one —
       it exists so the state chip has something honest to sit on. */
    id: "stock-oil-cover",
    agent: "STOCK SENSE",
    observation: "Cooking oil cover is 22 days and another pallet lands Thursday.",
    impact: "≈ R9,800 sitting in overstock",
    evidence: "stock sheet + 3 open orders",
    meta: "22 DAYS COVER · TARGET 14 · 6 × 20L/DAY",
    state: "resolved",
    actions: ["Pause Thursday's order", "Show cover history", "Dismiss"],
    visual: "gauge",
    industries: ["restaurants", "retailers"],
    small: true,
  },
  {
    id: "stock-frozen-writeoff",
    agent: "STOCK SENSE",
    observation: "Frozen stock is written off at 3.1% of intake, twice the rate of your dry store.",
    impact: "≈ R64,000/yr written off",
    evidence: "6 months of waste sheets",
    meta: "FROZEN · 3.1% OF INTAKE · ≈ R172k/MO PURCHASES",
    state: "new",
    actions: ["Show the write-off lines", "Draft a par-level change", "Dismiss"],
    visual: "gauge",
    industries: ["restaurants", "retailers"],
  },
  {
    id: "stock-holiday-overstock",
    agent: "STOCK SENSE",
    observation: "You are holding 31 days of cover into a week with two public holidays.",
    impact: "≈ R38,000 tied up",
    evidence: "stock sheet + 5 open orders",
    meta: "31 DAYS COVER · TARGET 14 · SEP",
    state: "new",
    actions: ["Show what to defer", "Draft supplier note", "Dismiss"],
    visual: "gauge",
    industries: ["retailers", "wholesalers", "restaurants"],
  },

  /* ── Margin Watch (new example agent, §5) ───────────────────────────────── */
  {
    id: "margin-slip",
    agent: "MARGIN WATCH",
    observation: "Gross margin has slipped from 31.4% to 29.3% over four months.",
    impact: "≈ R223,000/yr — R18,600 a month",
    evidence: "4 monthly margin runs",
    meta: "−2.1 POINTS · R886k/MO REVENUE · APR–AUG",
    state: "new",
    actions: ["Show what moved", "Draft a price review", "Dismiss"],
    visual: "sparkline",
    industries: ["wholesalers", "manufacturers", "distributors", "retailers"],
  },
  {
    id: "margin-below-cost",
    agent: "MARGIN WATCH",
    observation: "One SKU has been selling below landed cost since the supplier's June increase.",
    impact: "≈ R52,000/yr at current volumes",
    evidence: "cost + 9 weeks of sales",
    meta: "1 SKU · −R4.80/UNIT · ≈ 900 UNITS/MO",
    state: "new",
    actions: ["Show the cost change", "Draft a price change", "Dismiss"],
    visual: "bar",
    industries: ["retailers", "wholesalers", "manufacturers"],
  },

  /* ── Delivery Watch ─────────────────────────────────────────────────────── */
  {
    id: "delivery-route-km",
    agent: "DELIVERY WATCH",
    observation: "Two routes log 340km more a week than their delivery notes account for.",
    impact: "≈ R71,000/yr in fuel",
    evidence: "route logs + delivery notes",
    meta: "2 ROUTES · 340km/WEEK · ≈ 11,300 l/MO",
    state: "new",
    actions: ["Show the two routes", "Draft a driver note", "Dismiss"],
    visual: "bar",
    industries: ["wholesalers", "farms", "distributors"],
  },

  /* ── Waste Watch ────────────────────────────────────────────────────────── */
  {
    id: "waste-plate",
    agent: "WASTE WATCH",
    observation: "Two menu lines come back 4.2% by weight, against 1.3% across the rest.",
    impact: "≈ R47,000/yr in food cost",
    evidence: "8 weeks of plate returns",
    meta: "2 LINES · 4.2% BY WEIGHT · ≈ 1,400 COVERS/WK",
    state: "new",
    actions: ["Show the two lines", "Draft a portion change", "Dismiss"],
    visual: "gauge",
    industries: ["restaurants"],
  },

  /* ── Roster Watch (experimental — vertical pages only, §5) ──────────────── */
  {
    id: "roster-guard-hours",
    agent: "ROSTER WATCH",
    observation: "One contract bills 1,240 guard hours a month against 1,106 rostered.",
    impact: "≈ R120,000/yr on this contract",
    evidence: "roster + 3 invoices",
    meta: "1 CONTRACT · 134 HRS/MO GAP · JUN–AUG",
    state: "new",
    actions: ["Show the shift gaps", "Draft a client query", "Dismiss"],
    visual: "diff",
    industries: ["security"],
  },
  {
    id: "roster-vehicle-fuel",
    agent: "ROSTER WATCH",
    observation: "Three response vehicles have crept 18% above their own six-month fuel average.",
    impact: "≈ R39,000/yr",
    evidence: "6 months of fuel cards",
    meta: "3 VEHICLES · +18% · FEB–AUG",
    state: "new",
    actions: ["Show the three vehicles", "Draft a supervisor note", "Dismiss"],
    visual: "sparkline",
    industries: ["security"],
  },

  /* ── Renewals (experimental — vertical pages only, §5) ──────────────────── */
  {
    id: "renewals-lapsing",
    agent: "RENEWALS",
    observation: "11 policies lapse in the next 30 days and none have been contacted.",
    impact: "R84,000 in commission at risk",
    evidence: "11 policy records",
    meta: "11 POLICIES · ≤ 30 DAYS · SEP",
    state: "new",
    actions: ["Draft 11 renewal notes", "Show the list", "Dismiss"],
    visual: "bar",
    industries: ["insurance"],
  },
  {
    id: "renewals-commission-short",
    agent: "RENEWALS",
    observation: "This month's commission statement is short three policies you placed in June.",
    impact: "R6,400 short-paid",
    evidence: "statement + 3 policies",
    meta: "1 INSURER · 3 LINES · JUN",
    state: "new",
    actions: ["Draft a query", "Show the three lines", "Dismiss"],
    visual: "diff",
    industries: ["insurance"],
    small: true,
  },

  /* ── The Brief ──────────────────────────────────────────────────────────── */
  {
    /* The summary card. Its impact line is the day's three findings side by
       side, so it is the one card whose rand figures are derived rather than
       written — see `FLAGSHIP_RAND` and `EVENING_IMPACT` below. */
    id: "brief-evening",
    agent: "THE BRIEF",
    observation: "Evening. Three things from today — one’s worth R58,000.",
    impact: "R58,000 · R23,400 · R756",
    evidence: "3 findings",
    meta: "TODAY · 3 OF 4 FINDINGS · 17:55",
    state: "new",
    actions: ["Open the brief", "Show what I skipped", "Dismiss"],
    visual: null,
    industries: [],
  },
];

/** Every finding, keyed by id. Frozen so a page cannot mutate the roster. */
export const FINDINGS: Readonly<Record<FindingId, Finding>> = Object.freeze(
  Object.fromEntries(ROSTER.map((f) => [f.id, f])) as Record<FindingId, Finding>,
);

/** Source order, for the `/design` kitchen sink and any "all cards" surface. */
export const FINDING_IDS: readonly FindingId[] = ROSTER.map((f) => f.id);

export const ALL_FINDINGS: readonly Finding[] = ROSTER;

/** Lookup that fails loudly in dev rather than rendering an empty card. */
export function getFinding(id: FindingId): Finding {
  const finding = FINDINGS[id];
  if (!finding) throw new Error(`Unknown finding id: ${id}`);
  return finding;
}

export function getFindings(ids: readonly FindingId[]): readonly Finding[] {
  return ids.map(getFinding);
}

/* ── Derived constants ───────────────────────────────────────────────────────
   The flagship's rand figure appears in five places that are *not* finding
   cards — a headline ("…one is worth R58,000 a year"), a WhatsApp bubble, the
   showcase's hero stat, the evening greeting, the day strip. They read the
   number from here so the site can never quote two different magnitudes for
   the same example. That was the actual failure this file was created to fix:
   R4,200 lived in nine files and had to be changed in nine places.            */

export const FLAGSHIP = FINDINGS["butternut-price"];

/** Just the rand figure, unformatted — `R58,000`. */
export const FLAGSHIP_RAND = "R58,000";

/** The volume the flagship's figure is calculated at, in the showcase's words. */
export const FLAGSHIP_VOLUME = "~6.5t/month";

/** Butternut per-kg prices behind the flagship, for the showcase's price chart
    and evidence list. R6.20/kg is R62 a 10kg bag — the basis in the card's own
    meta line — and R6.94 is that plus the 12% the card reports, so the chart,
    the invoice list and the rand figure all agree. */
export const FLAGSHIP_PRICES = {
  before: "R6.20/kg",
  now:    "R6.94/kg",
  /** The alternative supplier's quote: back at the pre-increase price. */
  quote:  "R6.20/kg",
  /** (6.94 − 6.20) × 6,500 kg — the monthly cost of the increase. */
  gapPerMonth: "R4,810/mo",
  gapBasis:    "Gap on 6.5t/mo",
} as const;

/** The three findings the evening/morning brief carries, in order. */
export const BRIEF_IDS = ["butternut-price", "debtors-thyme-basil", "recon-drums"] as const;

/** The homepage hero cycles these three (§5: no two pages show the same card,
    and a hero never repeats another hero's). */
export const HOME_HERO_CYCLE = [
  "butternut-price",
  "recon-crates",
  "debtors-past-60",
] as const satisfies readonly FindingId[];
