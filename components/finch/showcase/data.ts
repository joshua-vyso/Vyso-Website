/* ── Platform mock copy ──────────────────────────────────────────────────────
   Every string the showcase frame renders, lifted verbatim from
   `.ai/design/vyso-brief/Vyso - The Brief.dc.html` (frames 1a · 1c · 1e) and
   its `renderVals()` placeholder data. It lives in one file so the three view
   components stay pure layout — this is a picture of the product, so the copy
   is the part that has to stay in sync with the design, not the markup.

   The colours travel with the copy for the same reason: inside the frame the
   PLATFORM palette applies, not the marketing `--fn-*` ramp, and the design
   file is the source of truth for both.                                      */

import { FLAGSHIP_PRICES, FLAGSHIP_RAND, FLAGSHIP_VOLUME } from "@/lib/marketing/findings";

export const RAIL_MODULES = ["Doc-U", "Suppliers", "Stock", "Margins", "Debtors", "Reports"];

export const BRIEF = {
  dateLine:  "Wednesday 13 August · Johannesburg",
  greeting:  "Morning Josh.",
  headline:  "3 things need your attention — one is worth ",
  highlight: `${FLAGSHIP_RAND} a year`,
  sub:       "Overnight I read 12 new invoices and checked prices across 6 suppliers.",
  navBrief:  "Today's brief",
  navCount:  "3",
  navHistory: "History",
  railHeading: "Under the hood",
  userInitials: "JM",
  userName:  "Josh · Meadow Fresh",
  chatPlaceholder: "Ask Vyso anything about your operation…",
  chatCaption: "Tap any finding to bring it into the conversation",
};

export type BriefCard = {
  id:        string;
  agent:     string;
  agentFg:   string;
  agentBg:   string;
  agentDot:  string;
  found:     string;
  status:    string;
  statusFg:  string;
  statusBg:  string;
  /** The "Awaiting supplier" pill breathes; the "New" pills do not. */
  statusDot?:   string;
  statusPulse?: boolean;
  /** Accent bar down the left edge — the resolved-in-progress card has none. */
  bar:       boolean;
  /** [lead, emphasised run, tail] — only the Price Watch card uses all three. */
  body:      readonly [string] | readonly [string, string, string];
  figure:    string;
  figureTail: string;
  link?:     string;
  actions?:  readonly [string, string, string];
  note?:     string;
};

export const BRIEF_CARDS: readonly BriefCard[] = [
  {
    id: "price",
    agent: "Price Watch", agentFg: "#854F0B", agentBg: "#FBEEDA", agentDot: "#BE5D23",
    found: "Found this morning",
    status: "New", statusFg: "#0C447C", statusBg: "#E6F1FB",
    bar: true,
    body: [
      "Butternut is up 12% at FreshCo Produce since June. Dew Valley Farms quoted ",
      FLAGSHIP_PRICES.quote,
      " for the same grade last week.",
    ],
    figure: `≈ ${FLAGSHIP_RAND}`, figureTail: "/yr at current volumes",
    link: "3 invoices ↗",
    actions: ["Draft supplier email", "Show 6-month trend", "Dismiss"],
  },
  {
    id: "debtors",
    agent: "Debtors", agentFg: "#B0466A", agentBg: "#FBE9EE", agentDot: "#B0466A",
    found: "Found this morning",
    status: "New", statusFg: "#0C447C", statusBg: "#E6F1FB",
    bar: true,
    body: ["Thyme & Basil Catering is 18 days past terms. They usually settle by day 32 — this is day 48, their longest ever."],
    figure: "R23,400", figureTail: " outstanding",
    link: "2 unpaid invoices ↗",
    actions: ["Draft polite reminder", "Payment history", "Dismiss"],
  },
  {
    id: "recon",
    agent: "Reconciliation", agentFg: "#0C447C", agentBg: "#E6F1FB", agentDot: "#3E7BC4",
    found: "Yesterday",
    status: "Awaiting supplier", statusFg: "#854F0B", statusBg: "#FBEEDA",
    statusDot: "#BE5D23", statusPulse: true,
    bar: false,
    body: ["Umgeni Oils invoice INV-88412 bills 20 × 5L sunflower oil; your delivery note shows 18 received."],
    figure: "R756", figureTail: " over-billed",
    note: "Credit request sent to Umgeni Oils on Tue 11 Aug. I'll flag their reply.",
  },
];

export const RESOLVED_CARD = {
  agent: "Stock",
  body:  "Cooking oil cover at 22 days — overstocked ~R9,800 for winter volumes.",
  status: "Resolved",
  note:  "You paused Thursday's order. Next review when cover drops under 14 days.",
};

/* ── 1c · finding detail ─────────────────────────────────────────────────── */

export const DETAIL = {
  back:      "‹ Back to today's brief",
  agent:     "Price Watch",
  status:    "New",
  found:     "Found 06:14, Wed 13 Aug",
  sendToChat: "Send to chat",
  headline:  "Butternut is up 12% at FreshCo Produce since June.",
  figure:    `≈ ${FLAGSHIP_RAND}/yr`,
  figureNote: `at your current ${FLAGSHIP_VOLUME}`,
  chartTitle: "Butternut · R/kg · Jan–Aug",
  legend:    [
    { label: "FreshCo",           color: "#BE5D23" },
    { label: "Dew Valley quote",  color: "#3E7BC4" },
  ],
  months:    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"],
  /* Chart geometry is in the design's own 520×180 user space. */
  freshcoPath: "M0,120 L74,124 L148,118 L222,112 L296,106 L370,78 L444,58 L520,44",
  quoteLine:   { x1: 370, y1: 98, x2: 520, y2: 96 },
  gridlines:   [45, 90, 135],
  endDots:     [
    { cx: 520, cy: 44, fill: "#BE5D23" },
    { cx: 520, cy: 96, fill: "#3E7BC4" },
  ],
  stats: [
    { label: "FreshCo today",           value: FLAGSHIP_PRICES.now,         color: "#171A17" },
    { label: "Dew Valley quote",        value: FLAGSHIP_PRICES.quote,       color: "#171A17" },
    { label: FLAGSHIP_PRICES.gapBasis,  value: FLAGSHIP_PRICES.gapPerMonth, color: "#0F6E56" },
  ],
  recommendedHeading: "Recommended",
  recommended: `Ask FreshCo to match ${FLAGSHIP_PRICES.quote.replace("/kg", "")} — you've bought from them for 3 years and paid on time every month. If they hold, split the volume with Dew Valley for a quarter.`,
  recommendedNote: "Switching cost is low: Dew Valley already delivers to your area on Tuesdays.",
  recommendedActions: ["Draft email to FreshCo", "Request Dew Valley trial order"],
  evidenceHeading: "Evidence · 3 invoices from Doc-U",
  evidenceLink: "Open in Doc-U ↗",
  /* The three invoices the card's "3 invoices ↗" chip points at, and the
     arithmetic behind the 12%: R6.20 → R6.94 is +11.9%. */
  invoices: [
    { no: "INV-77201", date: "4 Jun · FreshCo", price: FLAGSHIP_PRICES.before },
    { no: "INV-79118", date: "9 Jul · FreshCo", price: "R6.58/kg" },
    { no: "INV-80442", date: "6 Aug · FreshCo", price: FLAGSHIP_PRICES.now },
  ],
};

/* ── 1e · mobile companion ───────────────────────────────────────────────── */

export type MobileCard = {
  id:        string;
  agent:     string;
  agentFg:   string;
  agentBg:   string;
  status:    string;
  statusFg:  string;
  statusBg:  string;
  statusDot?: string;
  bar:       boolean;
  body:      string;
  figure?:   string;
  figureTail?: string;
  actions?:  readonly [string, string];
};

export const MOBILE: {
  headline: string;
  highlight: string;
  sub: string;
  chatPlaceholder: string;
  cards: readonly MobileCard[];
} = {
  headline:  "3 things need your attention — one is worth ",
  highlight: `${FLAGSHIP_RAND} a year`,
  sub:       "12 invoices read overnight · 6 suppliers checked",
  chatPlaceholder: "Ask Vyso anything…",
  cards: [
    {
      id: "price",
      agent: "Price Watch", agentFg: "#854F0B", agentBg: "#FBEEDA",
      status: "New", statusFg: "#0C447C", statusBg: "#E6F1FB",
      bar: true,
      body: `Butternut up 12% at FreshCo since June. Dew Valley quoted ${FLAGSHIP_PRICES.quote} last week.`,
      figure: `≈ ${FLAGSHIP_RAND}`, figureTail: "/yr",
      actions: ["Draft email", "6-mo trend"],
    },
    {
      id: "debtors",
      agent: "Debtors", agentFg: "#B0466A", agentBg: "#FBE9EE",
      status: "New", statusFg: "#0C447C", statusBg: "#E6F1FB",
      bar: true,
      body: "Thyme & Basil Catering: 18 days past terms, their longest ever.",
      figure: "R23,400", figureTail: " outstanding",
      actions: ["Draft reminder", "History"],
    },
    {
      id: "recon",
      agent: "Reconciliation", agentFg: "#0C447C", agentBg: "#E6F1FB",
      status: "Awaiting supplier", statusFg: "#854F0B", statusBg: "#FBEEDA",
      statusDot: "#BE5D23",
      bar: false,
      body: "Umgeni Oils over-billed R756 on INV-88412. Credit request sent Tue.",
    },
  ],
};
