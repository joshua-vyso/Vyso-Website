import type { Metadata } from "next";

import { Button } from "@/components/vyso/Button";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";
import { TrustPoints } from "@/components/vyso/company/TrustPoints";
import { buildAboutSchema } from "@/components/finch/about/about-jsonld";
import { SITE } from "@/lib/marketing/site";

/* ── /about ───────────────────────────────────────────────────────────────────
   Rebuilt for the 2026 redesign (`.ai/plan_vyso_redesign_2026.md` §7.6): the
   founder story expanded honestly, one cohesive company (no Finch, no module
   brands, no "the company behind X"), South African identity, and a trust
   section covering POPIA awareness, plain language data handling and human
   approval of actions. Everything the old page said about Finch, OrderFlow,
   the Academy and a founding cohort with waived setup fees is gone: Vyso is
   presented as one team building operational systems, not a company whose
   whole story is a single named product.

   `buildAboutSchema()` is untouched (`components/finch/about/about-jsonld.ts`)
   because it only ever asserted a `Person` node for the founder plus this
   page's `BreadcrumbList`, both sourced from `lib/marketing/site.ts` — nothing
   in it depended on Finch or needed a rewrite.

   No demo, no timeline, no FindingCard on this page. Every other Vyso page
   argues the product's case with a vignette; this one is about the people and
   the principles behind it, and a demo here would be the wrong kind of proof. */

const TITLE = "The team building Vyso's operational systems";
const DESCRIPTION =
  "Vyso is a Johannesburg based AI operations company: the founder story, how we work as one team, and how we handle data and POPIA.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/about` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/about`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FOUNDER_STORY: readonly string[] = [
  "Vyso began inside a wholesale business, not in front of a whiteboard. Its founder, Josh Moreira, grew up working in his father's: early mornings, a phone that never stopped with WhatsApp orders, spreadsheets that held the real picture of the business, invoices that needed checking by hand, stock that ran short without warning, and supplier prices that changed more often than anyone had time to track.",
  "Most of what mattered was already there, somewhere. It was just scattered across chats, sheets and someone's memory, and the decisions that shaped a week often got made because a person happened to remember the right fact at the right moment rather than because the business could see it clearly.",
  "The question that started Vyso was a small one: could technology give some of that time back? Not to a large corporate with a systems team already in place, but to an owner running the business themselves, most of it in their head.",
  "Vyso is that question, scaled to other people carrying the same weight: owners, founders, partners and operators who built something real and now spend too much of it on admin that a system could be watching instead.",
];

export default function AboutPage() {
  return (
    <Shell active="about">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildAboutSchema()).replace(/</g, "\\u003c") }}
      />

      <Section
        eyebrow="About Vyso"
        heading="One company,"
        continuation="not a platform, a fractional executive or a product line."
        lead="We don't sell one size fits all software. We build systems around the way your business actually works, and one team sees that work through from the first audit to the system that's still running a year later."
        headingLevel={1}
      >
        <div className="flex flex-wrap items-center gap-[16px]">
          <Button href="/operations-audit" event="book_audit_click" eventProps={{ page: "about-hero" }}>
            Get your free Operations Audit
          </Button>
          <Button href="/contact" variant="secondary">
            Talk to Vyso
          </Button>
        </div>
      </Section>

      <Section
        id="founder"
        eyebrow="Why Vyso exists"
        heading="Your business should give you a life."
        continuation="Not consume one."
        width="narrow"
        divider
      >
        <Reveal>
          <div className="flex flex-col gap-[20px]">
            {FOUNDER_STORY.map((paragraph) => (
              <p key={paragraph.slice(0, 24)} className="vy-body-lg text-[color:var(--vy-ink-2)] text-pretty">
                {paragraph}
              </p>
            ))}
          </div>
          <p className="vy-label mt-[28px] text-[color:var(--vy-ink-3)]">
            Josh Moreira, founder, Johannesburg
          </p>
        </Reveal>
      </Section>

      <Section
        id="one-company"
        eyebrow="How we're structured"
        heading="One team, one system."
        continuation="No separate products to learn, and no module names to keep track of."
        width="narrow"
        divider
      >
        <Reveal>
          <p className="vy-body-lg text-[color:var(--vy-ink-2)] text-pretty">
            Vyso doesn&rsquo;t sell a suite of branded tools. The same team that runs your
            Operations Audit designs the system, builds it, and keeps watching it once it&rsquo;s
            live, evolving it as your business changes. There&rsquo;s one relationship to manage,
            not a handful of vendors each responsible for a different piece.
          </p>
          <Button href="/how-it-works" variant="quiet" className="mt-[20px]">
            See how the process works
          </Button>
        </Reveal>
      </Section>

      <Section
        id="south-africa"
        eyebrow="Where we work"
        heading="A South African company,"
        continuation="built for how South African businesses actually run."
        width="narrow"
        divider
      >
        <Reveal>
          <p className="vy-body-lg text-[color:var(--vy-ink-2)] text-pretty">
            Vyso is based in Johannesburg, and we work with businesses across the country. That
            means building for WhatsApp orders, spreadsheets that carry real operational weight,
            Sage and Xero as the accounting layer, and pricing, invoicing and payments that happen
            in rand, rather than translating a workflow built somewhere else.
          </p>
          <Button href="/south-africa" variant="quiet" className="mt-[20px]">
            Read more about Vyso in South Africa
          </Button>
        </Reveal>
      </Section>

      <Section
        id="trust"
        eyebrow="Trust"
        heading="Sensible about data,"
        continuation="honest about limits."
        lead="A few things worth stating plainly rather than leaving implied."
        divider
      >
        <TrustPoints />
      </Section>

      <Section
        id="proof"
        eyebrow="Where we've proven this"
        heading="Built in the real world,"
        continuation="starting with one real client."
        width="narrow"
        divider
      >
        <Reveal>
          <p className="vy-body-lg text-[color:var(--vy-ink-2)] text-pretty">
            Turn &rsquo;n Slice, a Johannesburg fresh produce wholesaler, is Vyso&rsquo;s first real
            proof case, and we say that plainly rather than dress it up as something bigger.
            It&rsquo;s where the procurement visibility, stock management and supplier pricing work
            described
            on this site is actually running, not a hypothetical.
          </p>
          <Button href="/case-studies/turn-n-slice" variant="quiet" className="mt-[20px]">
            Read the Turn &rsquo;n Slice case study
          </Button>
        </Reveal>
      </Section>

      <Section
        id="start"
        ground="dark"
        spacing="loose"
        align="center"
        heading="Ready to see where your operation leaks time?"
        lead="Start with a free Operations Audit. Diagnosis first, with no obligation to buy anything afterward."
      >
        <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "about-close" }}
          >
            Get a free Operations Audit
          </Button>
          <Button href="/contact" variant="secondary" size="lg">
            Talk to Vyso
          </Button>
        </div>
      </Section>
    </Shell>
  );
}
