import { Button } from "@/components/vyso/Button";
import { ChromeFrame } from "@/components/vyso/demo/ChromeFrame";
import { EventTimeline, type TimelineScript } from "@/components/vyso/demo/EventTimeline";

/* ── The hero ────────────────────────────────────────────────────────────────
   Plan §7.1.1 and §7.1.2, which are one thing on the page: the sentence and
   the picture of the sentence. "Automation that knows what happens next" is an
   abstract claim until a reader watches an order arrive, get captured, get
   invoiced, get checked against stock, and turn into a shortage nobody would
   otherwise have seen until the loading bay on Thursday morning. The claim is
   the left column; the proof of it is the right one.

   ── Why this section does not use `Section`'s header ─────────────────────────
   `Section` stacks eyebrow → heading → lead above its children in a 760px
   column, which is right for every other section on this page and wrong for a
   hero, where the headline and the demo sit BESIDE each other. So the h1 is
   written here, in the grid, rather than handed to `Section`. It is still the
   page's one and only `h1` (the rule Phase 0 could not enforce in code), and it
   is still the two-tier construction every section header uses: the strong
   clause in `--vy-ink`, the continuation in `--vy-ink-3`.

   The section element is hand-rolled for the same reason, and it repeats
   `Section`'s own rhythm constants (gutter, content width) rather than
   inventing new ones. It carries no `divider`: a rule with nothing above it is
   a rule drawn under the nav.

   ── The script ──────────────────────────────────────────────────────────────
   The brief's hero script, verbatim in content: the WhatsApp order, the
   capture, the invoice, the stock check, the shortage, the recommendation with
   a real supplier price on it. Every timestamp is a STATIC string. Every rand
   figure is OPERATIONAL (what a distributor invoices and what a supplier
   charges), never a Vyso fee. */

const EYEBROW = "AI operations for South African businesses";

const SUPPORT =
  "Vyso builds tailored operational systems that automate repetitive work, connect your " +
  "business data and proactively tell you when something needs your attention.";

const REASSURANCE = "Free, about an hour, and diagnosis comes first. No obligation to buy software.";

const HERO_SCRIPT: TimelineScript = [
  {
    time: "09:41",
    kind: "event",
    title: "An order arrives on WhatsApp",
    body: "Hi, can we get 40 boxes delivered tomorrow?",
    meta: "WHATSAPP",
  },
  {
    time: "09:41",
    kind: "event",
    title: "The order is captured automatically",
    body: "Line items, quantities and the delivery date are read off the message and written into the order book. Nobody retypes anything.",
    meta: "8 LINE ITEMS",
  },
  {
    time: "09:42",
    kind: "event",
    title: "The invoice is generated",
    body: "R18,420, on this customer's own agreed pricing, waiting for someone to approve it.",
    meta: "DRAFT, AWAITING APPROVAL",
  },
  {
    time: "09:42",
    kind: "check",
    title: "Inventory is checked",
    body: "Available: 31. Required: 40.",
    meta: "STOCK ON HAND",
  },
  {
    time: "09:43",
    kind: "alert",
    title: "Shortage detected: 9 boxes required",
    body: "At the current rate of sale, the gap would have been found on the loading bay on the morning of the delivery.",
    meta: "DELIVERY TOMORROW 06:00",
  },
  {
    time: "09:43",
    kind: "recommendation",
    title: "Supplier A has sufficient stock",
    body: "Latest recorded purchase price: R91 per kg. Ordering before 11:00 covers tomorrow.",
    meta: "SUPPLIER A, PRICE LIST OF 24 AUGUST",
  },
];

export function HomeHero() {
  return (
    <section className="px-[var(--vy-gutter)] pt-[44px] pb-[72px] md:px-[40px] md:pt-[72px] md:pb-[112px]">
      <div className="mx-auto grid w-full max-w-[var(--vy-content)] grid-cols-1 items-center gap-[44px] lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-[64px]">
        <div>
          <p className="vy-label mb-[20px] text-[color:var(--vy-ink-3)]">{EYEBROW}</p>

          {/* The page's single h1. Two tiers, one sentence, one heading. */}
          <h1 className="vy-h1 text-[color:var(--vy-ink)]">
            Automation that knows{" "}
            <span className="text-[color:var(--vy-ink-3)]">what happens next.</span>
          </h1>

          <p className="vy-body-lg mt-[22px] max-w-[560px] text-[color:var(--vy-ink-3)]">
            {SUPPORT}
          </p>

          <div className="mt-[34px] flex flex-col items-start gap-[12px] sm:flex-row sm:items-center sm:gap-[26px]">
            <Button
              href="/operations-audit"
              size="lg"
              event="book_audit_click"
              eventProps={{ page: "home-hero" }}
            >
              Get your free operations audit
            </Button>
            <Button href="/how-it-works" variant="quiet" size="lg">
              See how Vyso works
            </Button>
          </div>

          <p className="vy-small mt-[20px] max-w-[420px] text-[color:var(--vy-ink-3)]">
            {REASSURANCE}
          </p>
        </div>

        {/* The one place on the page licensed to lift off the paper: window
            chrome, and the demo inside it. */}
        <div>
          <ChromeFrame title="Operations feed" meta="Tue 26 Aug">
            <div className="px-[18px] py-[24px] md:px-[26px] md:py-[28px]">
              <EventTimeline
                script={HERO_SCRIPT}
                replay
                label="Example: an order arriving on a Tuesday morning"
              />
            </div>
          </ChromeFrame>
          <p className="vy-label mt-[12px] text-right text-[10.5px] text-[color:var(--vy-ink-4)]">
            Illustrative example
          </p>
        </div>
      </div>
    </section>
  );
}

export default HomeHero;
