import Link from "next/link";

import { BriefPhone } from "@/components/finch/BriefPhone";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { Band } from "@/components/finch/ground/Band";
import { FacetPlane } from "@/components/finch/ground/FacetPlane";
import { Glow } from "@/components/finch/ground/Glow";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import { SeamHairline } from "@/components/finch/ground/SeamHairline";
import { WaveField } from "@/components/finch/ground/WaveField";
import { IntegrationsOrbit } from "@/components/finch/IntegrationsOrbit";
import { AuditClose } from "@/components/finch/site/AuditClose";
import { ProofSequence } from "@/components/finch/site/ProofSequence";
import { Reveal } from "@/components/finch/site/Reveal";
/* From the plain module, not from `Reveal.tsx`: this is a server component —
   see `components/finch/site/reveal-stagger.ts`. */
import { stagger } from "@/components/finch/site/reveal-stagger";
import { ScrollRail } from "@/components/finch/site/ScrollRail";
import {
  ArrowLink,
  BandSection,
  CARD_BASE,
  CARD_ON_BLUE,
  Section,
} from "@/components/finch/site/SiteSection";
import { CursorDrift } from "@/components/finch/text/CursorDrift";
import { MagneticButton } from "@/components/finch/text/MagneticButton";
import { Parallax } from "@/components/finch/text/Parallax";
import { SplitReveal } from "@/components/finch/text/Statement";

/* ── / ─────────────────────────────────────────────────────────────────────
   The agency home page (`.ai/plan_home_only.md`, change 2). What used to stand
   here was Finch's product page; it moved to `/finch` intact and this took its
   place.

   What stands here instead is the agency itself: **Vyso is an AI automation
   agency in Johannesburg building operational automation for South African
   SMEs.** That sentence is the page's job, the root `<title>`'s job and the
   Organization schema's job, and it is written once in each so a search engine
   asking "AI automation agency South Africa" finds the same answer three
   times.

   ── The ground rhythm ───────────────────────────────────────────────────────
   `.ai/vyso_v3_design.md` §2: a band is a material, and a reader who has
   crossed four of them has felt the page's structure without being told it.
   No two adjacent bands share a ground and no band carries two devices.

     paper   hero          one orange `Glow`, the page's one drawn hairline
     paper   your tools    the folk-style wheel, hubbed on Vyso, no bird
     blue    what we do    `OscillatingGrid` dots under five cards
     paper   how we work   the four steps, with `ScrollRail` filling as you read
     paper   proof         `ProofSequence` — the invoice→decision sequence
     ink     the quote     `WaveField`, straddling the seam it lies over
     blue    the products  `FacetPlane` under Finch and Orbit
     paper   close         the gradient CTA plate (`AuditClose`)

   The hero is paper, so `FinchNav` needs no static inversion declaration on
   the wrapper — `NavGround` inverts it over the blue and ink bands as the
   reader reaches them.

   ── Copy rules in force ─────────────────────────────────────────────────────
   "Agency" is wanted now: it is the search target. Still banned everywhere in
   rendered copy: COO, module codenames, any rand amount, "per location",
   "everything included", invented client numbers, em/en dashes. SA spelling,
   sentence case. The two `[TNS_NUMBER]` placeholders under the quote are the
   owner's to fill before launch and are deliberately left visible.

   No `metadata` export: the root layout already declares this route's title,
   description and canonical of "/". Restating it here would be a second copy
   to keep in sync.

   Server component. The client leaves are the phone mock, the glow, the
   hairline, the split reveals, the reveals, the wheel, the rail, the proof
   sequence and the two band devices — all leaves, so every heading and every
   sentence below is plain HTML in the response, which is what an answer engine
   reads.                                                                      */

const HEADLINE = "Your business is running on WhatsApp and spreadsheets. That ends here.";

const QUOTE =
  "“Finch automates our invoicing, ordering, and insight into how our company is actually running.”";

/** The wheel's hub on this page: the Vyso wordmark, not Finch's bird. The
    label is omitted because the mark is already a wordmark — see
    `IntegrationsOrbit`'s `OrbitHub`. */
const VYSO_HUB = {
  src: "/finch/vyso-wordmark.svg",
  width: 66,
  height: 17,
  label: "",
};

/* ── What we automate ────────────────────────────────────────────────────────
   Five jobs, in the customer's vocabulary rather than ours, and deliberately
   **not vertical-gated**: a panel beater, a security company and a caterer all
   recognise at least three of these, which is the whole point of a page that
   is no longer a router into six industries. */
const WORK: readonly { title: string; body: string }[] = [
  {
    title: "Orders coming in",
    body: "A customer sends an order on WhatsApp at six in the morning. It becomes a real order, priced off that customer's own price list, before anyone opens a laptop.",
  },
  {
    title: "Supplier invoices",
    body: "Every invoice that arrives is read line by line and checked against what you paid last time, so a price that moved quietly does not stay quiet.",
  },
  {
    title: "Stock",
    body: "What you have, what you used and what needs reordering, kept current from the documents already moving through the business instead of a Friday afternoon count.",
  },
  {
    title: "Quotes",
    body: "A quote out the same hour it was asked for, on your terms and at your prices, instead of the one that goes out on Monday to a customer who has already phoned someone else.",
  },
  {
    title: "Debtors",
    body: "Who owes you, how long it has been, and the reminder already drafted for you to read and send.",
  },
];

const STEPS: readonly { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Audit.",
    body: "Free. We sit down with you for about an hour and understand exactly where money and time leak.",
  },
  {
    n: "2",
    title: "Map.",
    body: "We write down how your team actually does the work, not how a system thinks they should.",
  },
  {
    n: "3",
    title: "Build.",
    body: "We build around that, on tools you already use. Fixed price, agreed before we start.",
  },
  {
    n: "4",
    title: "Run.",
    body: "We keep it running, watch it daily, and fix what breaks. One monthly fee.",
  },
];

/* ── The two products ────────────────────────────────────────────────────────
   Everything Vyso builds is a system for one business. Two of them have been
   built enough times to have become products with their own pages, and this is
   the honest distinction between them: one is live and one is a waitlist. */
const PRODUCTS: readonly {
  name: string;
  status: string;
  live: boolean;
  heading: string;
  body: string;
  href: string;
  cta: string;
}[] = [
  {
    name: "Finch",
    status: "Live",
    live: true,
    heading: "For catering and wholesale.",
    body: "Every supplier invoice read overnight, every price move caught line by line, and one morning brief on WhatsApp telling the owner what is worth a phone call today.",
    href: "/finch",
    cta: "See Finch",
  },
  {
    name: "Orbit",
    status: "Waitlist",
    live: false,
    heading: "For the trades.",
    body: "Jobs, quotes and invoices from the WhatsApp thread a tradesperson already has open. Being built now, and the waitlist is how you hear when it opens.",
    href: "/orbit",
    cta: "Join the waitlist",
  },
];

/* ── The product card ────────────────────────────────────────────────────────
   `CARD_ON_BLUE` at 7% white is right for the five small tiles on a band whose
   only device is a dot grid. These two stand on `FacetPlane`, whose facet
   edges are wide enough to cut straight through a 7% card and leave the body
   copy sitting on two different blues at once. So the fill is doubled and the
   hairline is stated rather than mixed: same object, one band louder. Measured
   against `--fn-blue-500` (#27649F), the lightest facet step — `--fn-blue-text`
   reads 5.85:1 on that and the wash only ever lightens what is under it, so
   nothing here can fall below AA. */
const PRODUCT_CARD =
  CARD_BASE +
  " border-fn-blue-300/70 bg-[rgba(255,255,255,0.14)] px-[24px] py-[28px] " +
  "hover:-translate-y-[3px] hover:border-fn-blue-300 hover:bg-[rgba(255,255,255,0.19)] " +
  "hover:shadow-[0_18px_40px_rgba(6,26,52,0.35)]";

export default function Home() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <FinchNav />

      <main id="main">
        {/* ── Hero (paper, one glow) ─────────────────────────────────────── */}
        {/* `isolate`: the glow sits at `-z-10`, and without a stacking context
            here a negative z-index escapes the header and paints behind
            `.finch-site`'s own background, i.e. invisibly. `overflow-x-clip`
            (not `hidden`, which would clip the drift vertically too) stops the
            glow's box producing a horizontal scrollbar at 375px. */}
        <header className="relative isolate mx-auto grid max-w-[1160px] grid-cols-1 items-center gap-[48px] overflow-x-clip px-[20px] pt-[40px] pb-[8px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-[72px] lg:px-[40px] lg:pt-[80px] lg:pb-[24px]">
          <CursorDrift direction={-1} className="pointer-events-none absolute inset-0 -z-10">
            <Glow
              tone="orange"
              size={340}
              className="left-[16%] top-[36%] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2"
            />
          </CursorDrift>

          <div>
            {/* The page's one drawn hairline (§2 rations it to once), in
                `--fn-grad` — the orange→blue the owner asked for, as a mark
                rather than as a fill. */}
            <SeamHairline className="mb-[18px] w-[44px] lg:mb-[22px] lg:w-[52px]" />
            {/* The category, said before the headline says anything else. This
                is the line the target query matches against, and it is a
                statement of fact rather than a keyword: the page has to earn
                "AI automation agency South Africa" by being one. */}
            <p className="m-0 mb-[18px] font-fn-mono text-[11px] tracking-[0.12em] text-fn-muted lg:mb-[22px] lg:text-[11.5px]">
              AI automation agency, Johannesburg
            </p>
            <h1 className="m-0 mb-[22px] font-fn-serif text-[36px] font-medium leading-[1.08] tracking-[-0.025em] text-pretty lg:mb-[28px] lg:text-[60px] lg:leading-[1.04] lg:tracking-[-0.03em]">
              <SplitReveal text={HEADLINE} />
            </h1>
            <p className="m-0 mb-[32px] max-w-[560px] text-[16px] leading-[1.7] text-fn-ink-2 text-pretty lg:mb-[40px] lg:text-[18px]">
              Vyso builds the operational automation South African businesses are missing, around
              the way they already work. Orders, supplier invoices, stock, quotes, debtors,
              whatever runs your day, automated without replacing the tools your team already
              uses.
            </p>
            {/* The audit is the front door and it is free, so the primary
                button says so and lands on the page that books it. `/contact`
                is one step behind it in the same row for anyone who wants to
                ask a question before they book an hour. */}
            <div className="flex flex-col items-start gap-[18px] sm:flex-row sm:items-center sm:gap-[26px]">
              <MagneticButton
                href="/operations-audit"
                event="book_audit_click"
                eventProps={{ page: "home-hero" }}
                className="w-full text-[16px] sm:w-auto"
              >
                Book your free audit
              </MagneticButton>
              <ArrowLink href="/contact">Talk to us</ArrowLink>
            </div>
          </div>

          {/* The morning brief mock, static: no autoplay, no carousel, and the
              `sender="vyso"` relabel (bird dropped with it) is scoped to this
              page — `/finch` still renders `<BriefPhone />` as Finch. §4.2's
              1.06 plane separates it from the headline by ~12px across a
              viewport pass; a depth cue, not a slide. */}
          <div className="flex justify-center lg:justify-end">
            <Parallax speed={1.06} className="flex flex-col items-center">
              <BriefPhone sender="vyso" />
              <p className="m-0 mt-[14px] w-full max-w-[300px] text-right font-fn-mono text-[10px] tracking-[0.1em] text-fn-faint">
                Illustrative example
              </p>
            </Parallax>
          </div>
        </header>

        {/* ── On your tools (paper, the wheel) ───────────────────────────── */}
        {/* The one widget on this site that is genuinely folk's idiom, hubbed
            on Vyso rather than Finch — the plan is explicit that the agency
            page carries no bird, and `IntegrationsOrbit` grew a `hub` prop for
            exactly this. `IntegrationPrompt` is deliberately NOT rendered
            beside it: every one of its eleven lines is written in Finch's
            voice ("Finch, fetch our books from Xero"), and putting the product
            in the agency's mouth is the kind of small lie this rebuild exists
            to remove. The tools speak for themselves. */}
        <Section
          id="tools"
          eyebrow="On your tools"
          heading="We build on what you already run."
          className="pt-[64px] lg:pt-[96px]"
        >
          <div className="grid grid-cols-1 items-center gap-[24px] lg:grid-cols-[0.85fr_1.15fr] lg:gap-[56px]">
            <div>
              <p className="m-0 max-w-[440px] text-[15.5px] leading-[1.7] text-fn-ink-2 text-pretty lg:text-[16.5px]">
                Nothing to migrate and nothing to retrain on. Your books, your inbox, your till
                and the WhatsApp thread your customers already use stay exactly where they are.
                The automation goes on top of them.
              </p>
              <p className="m-0 mt-[18px] max-w-[440px] text-[15px] leading-[1.7] text-fn-ink-3 text-pretty">
                If something you run is not on the wheel, it usually still connects. That is one
                of the questions the audit answers.
              </p>
            </div>
            <IntegrationsOrbit hub={VYSO_HUB} />
          </div>
        </Section>

        {/* ── What we automate (blue band) ───────────────────────────────── */}
        {/* Dots rather than the facet plane: five cards in a grid is a lattice
            already, and a second lattice under it would be two devices in one
            band by any honest reading of §1.3. 0.24 peak alpha, inside §2's
            25–40% band for blue and low enough that a crest passing under the
            card hairlines cannot take their text below AA. */}
        <BandSection
          id="work"
          ground="blue"
          className="mt-[80px] lg:mt-[128px]"
          eyebrow="What we automate"
          heading="The jobs your team repeats every single day."
          lead="Not a vertical and not a package. These are the five places time and money leak in most South African businesses, and they are where we usually start."
          device={
            <OscillatingGrid
              mode="dots"
              color="--fn-blue-300"
              colorFallback="#3E7BC4"
              opacity={0.24}
              pitch={26}
            />
          }
        >
          <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2 lg:grid-cols-3 lg:gap-[20px]">
            {WORK.map((item, i) => (
              <Reveal key={item.title} as="li" delay={stagger(i)} className="h-full">
                <div className={CARD_ON_BLUE + " flex h-full flex-col"}>
                  <h3 className="m-0 mb-[10px] font-fn-serif text-[20px] font-medium leading-[1.2] tracking-[-0.015em] text-fn-blue-text lg:text-[22px]">
                    {item.title}
                  </h3>
                  <p className="m-0 text-[14.5px] leading-[1.7] text-fn-blue-text-2 text-pretty lg:text-[15px]">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
            {/* The sixth cell answers "and if mine is none of those" without
                needing a sixth card that pretends to be one. */}
            <Reveal as="li" delay={stagger(5)} className="h-full">
              <div className="flex h-full flex-col justify-center px-[22px] py-[24px] lg:px-[26px]">
                <p className="m-0 text-[15px] leading-[1.7] text-fn-blue-text-2 text-pretty">
                  Something else? If your business runs on people, paper and WhatsApp, the answer
                  is usually yes.
                </p>
                <ArrowLink href="/contact" tone="blue" className="mt-[10px]">
                  Tell us what yours does
                </ArrowLink>
              </div>
            </Reveal>
          </ul>
        </BandSection>

        {/* ── How we work (paper, the rail) ──────────────────────────────── */}
        {/* Four steps "always in this order", with the order drawn: a 2px track
            down the left of the list that fills orange→blue as the reader
            descends. Same two hues as `--fn-grad` and the same direction of
            travel as the reading, so the fill *is* the progress rather than a
            decoration beside it. Reduced motion gets the finished rail — see
            `ScrollRail.tsx`. */}
        <Section
          id="how"
          eyebrow="How we work"
          heading="Four steps, always in this order."
          lead="The first one is free and costs you an hour. Everything after it carries a fixed price you agree before it starts, quoted to you privately once we know what you actually need."
        >
          <div className="relative pl-[26px] lg:pl-[34px]">
            <ScrollRail className="left-0" />
            <ol className="m-0 flex list-none flex-col gap-[32px] p-0 lg:gap-[44px]">
              {STEPS.map((step, i) => (
                <Reveal
                  key={step.n}
                  as="li"
                  delay={stagger(i, 0.07)}
                  className="relative grid grid-cols-1 gap-[6px] md:grid-cols-[100px_1fr] md:items-baseline md:gap-[28px]"
                >
                  {/* The station on the line. Orange is agent activity on this
                      site, and the step markers are the one place it is
                      allowed to be a shape rather than a glow. */}
                  <span
                    aria-hidden="true"
                    className="absolute -left-[26px] top-[9px] h-[7px] w-[7px] rounded-full bg-fn-orange lg:-left-[34px]"
                  />
                  <span className="block font-fn-mono text-[11px] tracking-[0.12em] text-fn-muted">
                    Step {step.n}
                  </span>
                  <span className="block">
                    <span className="block font-fn-serif text-[24px] font-medium leading-[1.2] tracking-[-0.018em] text-fn-ink lg:text-[30px]">
                      {step.title}
                    </span>
                    <span className="mt-[10px] block max-w-[620px] text-[15px] leading-[1.7] text-fn-ink-2 text-pretty lg:text-[16px]">
                      {step.body}
                    </span>
                  </span>
                </Reveal>
              ))}
            </ol>
          </div>
        </Section>

        {/* ── Proof (paper) ──────────────────────────────────────────────── */}
        <Section
          id="proof"
          eyebrow="Built for a Johannesburg produce wholesaler"
          heading="One invoice, read overnight."
          lead="This is the invoice capture and price watch system we built for a produce wholesaler in Johannesburg. It reads every supplier invoice overnight and flags the ones worth a phone call."
          /* Bottom padding pays for the ink band's 48px overlap below. */
          className="pb-[96px] lg:pb-[140px]"
        >
          <ProofSequence />
        </Section>

        {/* ── The quote (ink band, straddling the seam) ──────────────────── */}
        {/* §2's Illoca move, downward: the dark slab lies 48px over the paper
            section above it with a 24px top radius, so the join is a material
            change rather than a rule. Grain comes free with the ink ground;
            the wave field is the one device, at 0.22. */}
        <Band
          ground="ink"
          overlap="up"
          device={<WaveField lines={9} amplitude={16} color="--fn-orange" opacity={0.22} />}
        >
          <figure className="m-0 flex max-w-[820px] gap-[24px] lg:gap-[32px]">
            {/* The orange→blue rule, vertical. Static: `SeamHairline` is the
                animated form and the hero above already spent it. */}
            <span
              aria-hidden="true"
              className="mt-[6px] w-[2px] shrink-0 rounded-[2px] self-stretch"
              style={{ background: "linear-gradient(180deg, var(--fn-orange), var(--fn-blue))" }}
            />
            <div>
              <blockquote className="m-0">
                <p className="m-0 font-fn-serif text-[26px] font-normal leading-[1.3] tracking-[-0.018em] text-balance text-fn-ink-text lg:text-[38px] lg:leading-[1.22]">
                  <SplitReveal text={QUOTE} />
                </p>
              </blockquote>
              <figcaption className="mt-[26px] lg:mt-[32px]">
                <span className="block font-fn-mono text-[11px] tracking-[0.1em] text-fn-ink-mono">
                  Roberto &middot; Turn &rsquo;n Slice &middot; Johannesburg &middot; founding client
                </span>
                {/* PLACEHOLDERS: owner to confirm both figures before launch
                    (`.ai/plan_minimal_agency_site.md`). Deliberately visible —
                    an invented number is the one thing worse than a gap. */}
                <span className="mt-[16px] block text-[15.5px] leading-[1.7] text-fn-ink-text-2 lg:text-[16.5px]">
                  [TNS_NUMBER] invoices captured a month. [TNS_NUMBER] hours a week back.
                </span>
              </figcaption>
            </div>
          </figure>
        </Band>

        {/* ── The products (blue band) ───────────────────────────────────── */}
        {/* The facet plane rather than dots: two large cards is not a lattice,
            and the plane's slow steps read as depth behind a pair of objects
            in a way a dot grid behind two cards does not. */}
        <BandSection
          id="products"
          ground="blue"
          device={<FacetPlane />}
          eyebrow="What we have built"
          heading="Two of our systems became products."
          lead="Everything we build is a system for one business. Two of them have now been built enough times to have a name, a page and a life of their own."
        >
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 lg:gap-[24px]">
            {PRODUCTS.map((product, i) => (
              <Reveal key={product.name} delay={stagger(i, 0.08)} className="h-full">
                <Link
                  href={product.href}
                  className={
                    "group relative isolate flex h-full flex-col overflow-hidden " +
                    PRODUCT_CARD +
                    " lg:px-[34px] lg:py-[36px]"
                  }
                >
                  {/* The gradient rule marks the live product, once. Orbit's
                      absence of one is information: it is not live yet. */}
                  {product.live ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                      style={{ background: "var(--fn-grad)" }}
                    />
                  ) : null}

                  <div className="mb-[16px] flex items-center gap-[12px]">
                    <span className="font-fn-serif text-[26px] font-medium leading-none tracking-[-0.015em] text-fn-blue-text lg:text-[30px]">
                      {product.name}
                    </span>
                    <span
                      className={
                        "rounded-full border px-[9px] py-[3px] font-fn-mono text-[10px] tracking-[0.1em] " +
                        (product.live
                          ? "border-fn-orange-on-ink/50 text-fn-orange-on-ink"
                          : "border-fn-blue-300 text-fn-blue-mono")
                      }
                    >
                      {product.status}
                    </span>
                  </div>

                  <h3 className="m-0 mb-[10px] text-[16.5px] font-semibold tracking-[-0.01em] text-fn-blue-text">
                    {product.heading}
                  </h3>
                  <p className="m-0 text-[14.5px] leading-[1.7] text-fn-blue-text-2 text-pretty lg:text-[15.5px]">
                    {product.body}
                  </p>

                  <span className="mt-auto flex items-center gap-[8px] pt-[24px] text-[14px] font-medium text-fn-blue-text transition-colors duration-150 group-hover:text-fn-orange-on-ink">
                    {product.cta}
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-150 ease-out group-hover:translate-x-[3px]"
                    >
                      &rarr;
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </BandSection>

        {/* ── Close (paper, gradient plate) ──────────────────────────────── */}
        <AuditClose page="home-close" />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
