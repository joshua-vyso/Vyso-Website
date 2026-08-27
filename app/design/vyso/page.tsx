import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/vyso/Button";
import { Card, Pill } from "@/components/vyso/Card";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";
/* From `./stagger`, NOT from `./Reveal`: this page is a server component, and
   every export of a `"use client"` module reaches one as an opaque client
   reference. Importing it from `Reveal` throws "Attempted to call stagger()
   from the server" at render, which is exactly what happened the first time
   this file was written. */
import { stagger } from "@/components/vyso/stagger";
import { ChromeFrame, WhatsAppBubble } from "@/components/vyso/demo/ChromeFrame";
import { EventTimeline, type TimelineScript } from "@/components/vyso/demo/EventTimeline";
import { FindingCard } from "@/components/vyso/demo/FindingCard";

/* ── `/design/vyso` — the Phase 0 kitchen sink ───────────────────────────────
   Every `components/vyso/*` primitive on one page, with the plan's own hero
   script as the sample data, so the system can be judged as a system rather
   than a screenshot at a time. Built for one review: Josh and Fable look at
   this on localhost before Phase 1 builds the homepage on top of it.

   **Not a public route.** Two independent guards, the same pair `/design` uses:

   1. `notFound()` in production unless `NEXT_PUBLIC_DESIGN_ROUTE=1`. This is
      the real gate: the route 404s on the deployed site, so there is nothing to
      find whatever a crawler does.
   2. `robots: noindex, nofollow` on top of that, for the case where the env var
      IS set (a preview deploy Josh wants to look at from his phone).

   It is also absent from `app/sitemap.ts` by construction, which enumerates a
   hand-written list this is not on. */

export const metadata: Metadata = {
  title: { absolute: "Vyso design system, Phase 0" },
  robots: { index: false, follow: false },
};

/* The plan's §7.1 hero script, verbatim in intent: a Tuesday morning order
   arrives on WhatsApp, is captured, is invoiced, is checked against stock, and
   the shortage nobody would have seen until Thursday becomes a recommendation
   with a number attached.

   Every timestamp is a STATIC string. Rand figures are OPERATIONAL: they are
   what a distributor pays a supplier, not what Vyso charges anybody, which is
   the one kind of number the copy rules encourage. */
const HERO_SCRIPT: TimelineScript = [
  {
    time: "09:41",
    kind: "event",
    title: "An order arrives on WhatsApp",
    body: "Thyme and Basil ask for 40 boxes of butternut for Thursday morning.",
    meta: "WHATSAPP",
  },
  {
    time: "09:41",
    kind: "event",
    title: "The order is captured",
    body: "Line items, quantities and the delivery date are read off the message and written into the order book. Nobody retypes anything.",
    meta: "8 LINE ITEMS",
  },
  {
    time: "09:42",
    kind: "event",
    title: "The invoice is drafted",
    body: "R18,420, on this customer's own agreed pricing, waiting for someone to approve it.",
    meta: "DRAFT, AWAITING APPROVAL",
  },
  {
    time: "09:42",
    kind: "check",
    title: "Stock is checked against the order",
    body: "Butternut on hand: 31 boxes. Ordered: 40.",
    meta: "INVENTORY",
  },
  {
    time: "09:43",
    kind: "alert",
    title: "You are 9 boxes short for Thursday",
    body: "At the current rate of sale the shortage would have been found on the loading bay, on the morning of the delivery.",
    meta: "BUTTERNUT, THURSDAY 06:00",
  },
  {
    time: "09:43",
    kind: "recommendation",
    title: "Supplier A has butternut at R91 per kg",
    body: "That is R4 per kg under the price you paid last week, and they deliver on Wednesdays. Ordering today covers Thursday.",
    meta: "SUPPLIER A, PRICE LIST OF 24 AUGUST",
  },
];

const SPEC = [
  ["Display", "vy-display", "clamp(2.6rem, 6.5vw, 5rem) / 1.05, tracking -0.03em"],
  ["Heading 1", "vy-h1", "clamp(2.2rem, 4.5vw, 3.4rem) / 1.1"],
  ["Heading 2", "vy-h2", "clamp(1.7rem, 3vw, 2.4rem) / 1.15"],
  ["Heading 3", "vy-h3", "1.25rem / 1.3"],
  ["Body large", "vy-body-lg", "1.125rem / 1.6, Inter"],
  ["Body", "vy-body", "1rem / 1.65, Inter"],
  ["Small", "vy-small", "0.875rem / 1.55, Inter"],
  ["Label", "vy-label", "0.75rem, IBM Plex Mono, uppercase, +0.08em"],
] as const;

const PALETTE = [
  ["--vy-bg", "#FAFAF7"],
  ["--vy-surface", "#FFFFFF"],
  ["--vy-surface-2", "#F3F3EF"],
  ["--vy-ink", "#101010"],
  ["--vy-ink-2", "#3D3D3A"],
  ["--vy-ink-3", "#6E6E68"],
  ["--vy-ink-4", "#9C9C95"],
  ["--vy-line", "#E7E7E2"],
  ["--vy-line-2", "#D9D9D3"],
  ["--vy-accent", "#E05E1F"],
  ["--vy-accent-ink", "#A8410C"],
  ["--vy-accent-tint", "#FBEDE4"],
  ["--vy-dark-bg", "#101010"],
] as const;

export default function VysoDesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_DESIGN_ROUTE !== "1") {
    notFound();
  }

  return (
    <Shell>
      {/* One h1 per page, and on a review page it is the review page's own. */}
      <Section
        heading="Vyso design system"
        continuation="Phase 0 primitives, on one page."
        headingLevel={1}
        eyebrow="Internal, not indexed"
        lead="Every component in components/vyso, with the homepage hero script as sample data. Nothing here is customer-facing copy."
        spacing="tight"
      />

      {/* ── Type ────────────────────────────────────────────────────────── */}
      <Section
        eyebrow="Type scale"
        heading="Instrument Sans for display,"
        continuation="Inter for reading, IBM Plex Mono for data."
        divider
      >
        <div className="flex flex-col gap-[28px]">
          {SPEC.map(([name, cls, note]) => (
            <div key={cls} className="border-t border-[color:var(--vy-line)] pt-[16px]">
              <div className="vy-label mb-[10px] text-[color:var(--vy-ink-4)]">
                {name} · .{cls} · {note}
              </div>
              <p className={`${cls} text-[color:var(--vy-ink)]`}>
                Automation that knows what happens next.
              </p>
            </div>
          ))}
          <div className="border-t border-[color:var(--vy-line)] pt-[16px]">
            <div className="vy-label mb-[10px] text-[color:var(--vy-ink-4)]">
              Two-tier headline · the section header construction
            </div>
            <h3 className="vy-h2 text-[color:var(--vy-ink)]">
              Most automation stops when the task is complete.{" "}
              <span className="text-[color:var(--vy-ink-3)]">
                Vyso looks at what happened next.
              </span>
            </h3>
          </div>
        </div>
      </Section>

      {/* ── Palette ─────────────────────────────────────────────────────── */}
      <Section
        eyebrow="Palette"
        heading="Monochrome, and one accent"
        continuation="that never touches a button."
        divider
      >
        <ul className="m-0 grid list-none grid-cols-2 gap-[12px] p-0 md:grid-cols-4">
          {PALETTE.map(([token, hex]) => (
            <li key={token}>
              <span
                aria-hidden="true"
                className="block h-[56px] w-full rounded-[var(--vy-radius)] border border-[color:var(--vy-line)]"
                style={{ background: `var(${token})` }}
              />
              <span className="vy-mono mt-[8px] block text-[11px] text-[color:var(--vy-ink-2)]">
                {token}
              </span>
              <span className="vy-mono block text-[11px] text-[color:var(--vy-ink-4)]">{hex}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Buttons and pills ───────────────────────────────────────────── */}
      <Section
        eyebrow="Actions"
        heading="One filled style,"
        continuation="repeated verbatim everywhere."
        divider
      >
        <div className="flex flex-wrap items-center gap-[16px]">
          <Button href="/operations-audit">Free Operations Audit</Button>
          <Button href="/operations-audit" size="lg">
            Get your free operations audit
          </Button>
          <Button href="/how-it-works" variant="secondary">
            See how Vyso works
          </Button>
          <Button href="/how-it-works" variant="quiet">
            See how Vyso works
          </Button>
        </div>
        <div className="mt-[28px] flex flex-wrap items-center gap-[12px]">
          <Pill>Automation is only the beginning</Pill>
          <Pill accent>Vyso noticed</Pill>
        </div>
      </Section>

      {/* ── Cards and the reveal ────────────────────────────────────────── */}
      <Section
        eyebrow="Cards"
        heading="Flat by default."
        continuation="The one shadow belongs to window chrome."
        divider
      >
        <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-3">
          {["Orders", "Margin", "Suppliers"].map((title, i) => (
            <Reveal key={title} as="li" delay={stagger(i)}>
              <Card padding="lg" className="h-full">
                <div className="vy-label mb-[12px] text-[color:var(--vy-ink-4)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="vy-h3 text-[color:var(--vy-ink)]">{title}</h3>
                <p className="vy-small mt-[8px] text-[color:var(--vy-ink-3)]">
                  Each card is one idea, a hairline border and no shadow. The reveal is a 12px
                  lift with a 70ms stagger, and it does not run under reduced motion.
                </p>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Section>

      {/* ── The timeline ────────────────────────────────────────────────── */}
      <Section
        eyebrow="Event timeline"
        heading="A Tuesday morning,"
        continuation="from the message to the decision."
        lead="The recurring visual grammar. Every page feeds it its own scenario through a typed TimelineScript."
        divider
        width="content"
      >
        <div className="grid grid-cols-1 gap-[40px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ChromeFrame variant="whatsapp" title="Thyme and Basil" subtitle="online">
            <div className="flex flex-col gap-[8px]">
              <WhatsAppBubble time="09:41">
                Morning. Can we get 40 boxes butternut for Thursday please, same as last week
                plus 10.
              </WhatsAppBubble>
              <WhatsAppBubble side="out" time="09:41">
                Got it. Thursday, 40 boxes butternut. I will confirm the invoice shortly.
              </WhatsAppBubble>
            </div>
          </ChromeFrame>

          <ChromeFrame title="Operations feed" meta="Tue 26 Aug">
            <div className="px-[20px] py-[22px]">
              <EventTimeline script={HERO_SCRIPT} replay label="Example: a Tuesday morning order" />
            </div>
          </ChromeFrame>
        </div>
      </Section>

      {/* ── Findings ────────────────────────────────────────────────────── */}
      <Section
        eyebrow="Finding cards"
        heading="Small problems become expensive"
        continuation="when nobody notices them."
        divider
      >
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          <FindingCard
            state="alert"
            observation="Your supplier invoiced butternut at R95.20 per kg. The agreed price on their own list is R91.00."
            impact="R4.20 per kg over, on 380 kg"
            evidence="INV-4471"
            meta="24 AUGUST"
            actions={["Query the supplier", "Draft the email", "Dismiss"]}
          />
          <FindingCard
            state="watching"
            source="VYSO IS WATCHING"
            observation="Gross margin on prepared vegetables has moved from 17.8% to 15.2% over three weeks."
            impact="Down 2.6 points"
            evidence="MARGIN, 3 WEEKS"
            meta="UPDATED WEEKLY"
            actions={["Open the breakdown"]}
          />
          <FindingCard
            state="resolved"
            source="VYSO NOTICED"
            observation="The short delivery on Thursday was covered from Supplier A at the price you were quoted."
            impact="Covered in full"
            evidence="PO-2210"
            meta="26 AUGUST"
          />
          <Card padding="lg">
            <h3 className="vy-h3 text-[color:var(--vy-ink)]">Three states, one accent</h3>
            <p className="vy-small mt-[8px] text-[color:var(--vy-ink-3)]">
              Only the alert state is painted. Three cards on a page and one of them accented is
              the intended ratio: four accented cards is a page with no signal in it.
            </p>
          </Card>
        </div>
      </Section>

      {/* ── The dark band ───────────────────────────────────────────────── */}
      <Section
        ground="dark"
        eyebrow="Closing band"
        heading="What's costing your business time?"
        continuation="Find out in about an hour."
        lead="One dark band per page, and it is the last thing on it. Every primitive inside is the same component under a re-pointed ramp."
        spacing="loose"
        align="center"
      >
        <div className="flex flex-wrap items-center justify-center gap-[16px]">
          <Button href="/operations-audit" size="lg">
            Get your free operations audit
          </Button>
          <Button href="/contact" variant="secondary" size="lg">
            Talk to Vyso
          </Button>
        </div>
        <div className="mx-auto mt-[40px] max-w-[520px] text-left">
          <FindingCard
            state="alert"
            observation="On the dark band the card is the same component: only the tokens under it changed."
            impact="No second copy to keep in sync"
            evidence="DATA-VY-GROUND=DARK"
            meta="GLOBALS.CSS"
          />
        </div>
      </Section>
    </Shell>
  );
}
