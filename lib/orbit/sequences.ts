/* ── The conversations ───────────────────────────────────────────────────────
   Every phone render on the Orbit subsite draws from this file. The rule is the
   same one `lib/marketing/findings.ts` enforces for Finch's cards: no inline
   chat copy anywhere, because a conversation retyped into a page is a
   conversation that will one day promise something Orbit does not do.

   Two things shape the message list below.

   1. **What Orbit replies is a draft, not an action.** `ORBIT.draftsOnly`.
      Every outgoing reply here either records something ("Tracking that now"),
      or offers something ("Invoice #0042 drafted — tap to send"). None of them
      says Orbit sent, paid, or filed anything on its own, because it does not.
   2. **The trades speak like trades.** The brief's own example —
      "fixed tiling at job on 1st avenue. charged 3800." — is deliberately
      lower-case, unpunctuated and abbreviated. That is the point of the
      product: it reads what a person actually types at the end of a job, on a
      phone, with one hand.

   Times are strings, never `new Date()`. A render-time clock would make the
   markup differ between the server and the client, and a chat whose timestamps
   change on every deploy is a diff nobody can review.                          */

export type ChatMessage = {
  /** `out` is the tradesperson (green bubble, right); `in` is Orbit. */
  side: "out" | "in";
  /** The bubble's body. Rendered as plain text — no markup is interpreted. */
  text: string;
  /** Optional labelled rows under the text, for Orbit's structured replies. */
  rows?: [string, string][];
  /** `HH:MM`, 24-hour, matching how a South African phone is usually set. */
  time: string;
  /** Outgoing only. `read` draws the blue double tick. */
  status?: "sent" | "delivered" | "read";
};

export type ChatScript = {
  id: string;
  /** The `aria-label` on the phone. Describes the conversation in one line for
      anyone who cannot see it — the plan's "alt text on every phone render". */
  alt: string;
  /** The mono caption under the phone, where a page shows one. */
  caption?: string;
  messages: ChatMessage[];
};

/** Shown in every chat header. Orbit has no "typing…" state on this site: it
    would be an animation claiming a latency nobody has measured. */
export const CHAT_HEADER = { name: "Orbit", presence: "online" } as const;

/* ── The flagship: the brief's own example, beat by beat ─────────────────────
   This is the script the homepage scroll sequence plays. `OrbitSequence`
   reveals one message at a time as the section scrolls; under reduced motion
   the same list renders complete. Keep the order — the sequence's beat
   boundaries are indices into this array. */
export const JOB_TO_INVOICE: ChatScript = {
  id: "job-to-invoice",
  alt: "A WhatsApp-style chat in which a tiler texts Orbit “fixed tiling at job on 1st avenue. charged 3800.”, Orbit replies that it is tracking the job, and then drafts invoice #0042 for R3,800 when asked.",
  caption: "ILLUSTRATIVE EXAMPLE",
  messages: [
    {
      side: "out",
      text: "fixed tiling at job on 1st avenue. charged 3800.",
      time: "16:41",
      status: "read",
    },
    {
      side: "in",
      text: "Tracking that now ✅",
      rows: [
        ["Job", "1st Avenue — tiling"],
        ["Charged", "R3,800.00"],
        ["Status", "Done"],
      ],
      time: "16:41",
    },
    { side: "out", text: "invoice it", time: "16:42", status: "read" },
    {
      side: "in",
      text: "Invoice #0042 drafted — tap to send.",
      rows: [
        ["To", "M. Naidoo · 1st Avenue"],
        ["Amount", "R3,800.00"],
        ["Due", "14 days"],
      ],
      time: "16:42",
    },
  ],
};

/** The first exchange only — the hero's phone. Sliced from `JOB_TO_INVOICE`
    rather than retyped, so the hero and the sequence below it can never show
    two different versions of the same conversation. The hero shows the premise
    and the confirmation; the sequence then plays the whole thing and shows the
    record it produces, which is the build the page is arguing. */
export const HERO_GLIMPSE: ChatScript = {
  id: "hero-glimpse",
  alt: "A WhatsApp-style chat where a tiler texts Orbit “fixed tiling at job on 1st avenue. charged 3800.” and Orbit replies that it is tracking the job at R3,800.",
  caption: "ILLUSTRATIVE EXAMPLE",
  messages: JOB_TO_INVOICE.messages.slice(0, 2),
};

/* ── The other two flows `/orbit/how-it-works` walks through ─────────────── */

export const MATERIALS: ChatScript = {
  id: "materials",
  alt: "A WhatsApp-style chat in which a builder texts Orbit “bought 12 bags cement 1090 at buildit”, and Orbit records it as a material cost against the Rivonia job.",
  caption: "ILLUSTRATIVE EXAMPLE",
  messages: [
    { side: "out", text: "bought 12 bags cement 1090 at buildit", time: "07:12", status: "read" },
    {
      side: "in",
      text: "Logged against Rivonia — say “no, it's for X” if that's the wrong job.",
      rows: [
        ["Material", "Cement × 12"],
        ["Cost", "R1,090.00"],
        ["Job", "Rivonia — bathroom"],
      ],
      time: "07:12",
    },
    { side: "out", text: "who still owes me", time: "07:13", status: "read" },
    {
      side: "in",
      text: "Three open invoices.",
      rows: [
        ["#0039 · M. Naidoo", "R3,800 · 21 days"],
        ["#0041 · Bekker", "R1,450 · 9 days"],
        ["#0042 · Rivonia", "R6,200 · 2 days"],
      ],
      time: "07:13",
    },
  ],
};

export const END_OF_DAY: ChatScript = {
  id: "end-of-day",
  alt: "A WhatsApp-style chat showing Orbit's end-of-day summary: three jobs done, R9,450 charged, one invoice waiting to be sent.",
  caption: "ILLUSTRATIVE EXAMPLE",
  messages: [
    {
      side: "in",
      text: "That's your day.",
      rows: [
        ["Jobs done", "3"],
        ["Charged", "R9,450.00"],
        ["Materials", "R1,090.00"],
        ["Waiting to send", "1 invoice"],
      ],
      time: "17:30",
    },
    { side: "out", text: "send the rivonia one", time: "17:31", status: "read" },
    {
      side: "in",
      text: "Opened it for you — check the amount, then hit send. Orbit never sends on your behalf.",
      time: "17:31",
    },
  ],
};

export const CORRECTION: ChatScript = {
  id: "correction",
  alt: "A WhatsApp-style chat in which a painter corrects Orbit — “no that was 3500 not 3800” — and Orbit updates the job and the draft invoice.",
  caption: "ILLUSTRATIVE EXAMPLE",
  messages: [
    { side: "out", text: "no that was 3500 not 3800", time: "16:44", status: "read" },
    {
      side: "in",
      text: "Fixed. The draft invoice moved with it.",
      rows: [
        ["Job", "1st Avenue — tiling"],
        ["Charged", "R3,500.00"],
      ],
      time: "16:44",
    },
  ],
};

export const ALL_SCRIPTS: ChatScript[] = [JOB_TO_INVOICE, HERO_GLIMPSE, MATERIALS, END_OF_DAY, CORRECTION];

export default JOB_TO_INVOICE;
