import type { Metadata } from "next";

import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { DaySection } from "@/components/finch/day/DaySection";
import { BandHead, Section, SideLinks } from "@/components/finch/compare/CompareBits";
import { CompareFaqs } from "@/components/finch/compare/CompareFaqs";
import { CompareTable } from "@/components/finch/compare/CompareTable";
import { CooCta } from "@/components/finch/compare/CooCta";
import { CooHero } from "@/components/finch/compare/CooHero";
import { CostBars, CostSources } from "@/components/finch/compare/CostBars";
import { buildCompareSchema } from "@/components/finch/compare/compare-jsonld";
import { Band } from "@/components/finch/ground/Band";
import { FacetPlane } from "@/components/finch/ground/FacetPlane";
import { SplitReveal } from "@/components/finch/text/Statement";
import { COO, SALARY } from "@/lib/marketing/compare";

/* 49 chars before the sitewide "| Vyso" template. */
const title = "Finch vs hiring a COO — R6,000 vs a salary";
/* 154 chars. The query, the two numbers, the place, and the honest half. */
const description =
  "Finch does a COO’s reading, checking and chasing for R6,000 per location per month. Sourced South African operations manager salaries, and what a COO still wins.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: COO.canonical },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: COO.canonical,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

const TRAIL = [
  { label: "Home", href: "/" },
  { label: "Compare", href: "/compare" },
  { label: "Finch vs hiring a COO", href: `/compare/${COO.slug}` },
];

/* `/compare/finch-vs-hiring-a-coo` — the flagship comparison, and the one page
   on the site that renders the day strip (`components/finch/day/*`, built in
   phase 1b and wired to nothing until now). It runs its default beats: this
   page's argument is that a COO's day and Finch's day are the same day read
   twice, so a second set of beats would break the equivalence the section is
   making. Only the header copy is this page's.

   The order is the argument: what Finch is (hero) → what the day looks like
   (strip) → what each one costs (bars) → what each one gives you (table) →
   when you should hire the person instead. The honest section is not a
   footnote at the bottom; it has an `<h2>` like everything else.

   ── Ground sequence (`.ai/vyso_v3_design.md` §7) ────────────────────────────
   **ink** (hero: wave field, the Statement riding it, the page's one hairline)
   → **paper** (the day strip — the page's pinned section, and its only one) →
   **blue** (cost bars behind a facet plane, the Finch bar the band's single
   orange element) → **paper** (table, then "when you should hire a COO
   instead" with its pull line) → **ink** (closing CTA, orange dots).

   The nav is wrapped in its own positioned layer because the ink hero leans up
   underneath it: `CooHero` borrows the nav's height back as a negative margin
   so §8's inversion has a dark band to actually invert over, and without a
   stacking layer here the band would paint over the nav instead of behind it. */
export default function FinchVsHiringACooPage() {
  return (
    <div
      /* §8's inversion, at first paint — `CooHero` is an `underNav` ink band.
         See `/pricing`'s copy of this and `NavGround.tsx`'s header. */
      data-nav-hero="ink"
      className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildCompareSchema({ canonical: COO.canonical, trail: TRAIL, faqs: COO.faqs }),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <div className="relative z-20">
        <FinchNav />
      </div>
      <main id="main">
        <CooHero
          trail={TRAIL}
          title={COO.h1}
          statement={COO.statement}
          answer={COO.answer}
        />

        {/* The 48px the ink hero's downward overlap took back, so the day
            section's own hairline is not tucked under the slab's rounded edge. */}
        <div className="pt-[48px]" aria-hidden />

        {/* The strip's own section header carries the two-track framing; the
            tracks themselves land under it, after the day has played. */}
        <DaySection
          id="day"
          eyebrow={COO.day.eyebrow}
          title={COO.day.title}
          sub={COO.day.sub}
          footnote={COO.day.footnote}
        />

        {/* The air above the blue band lives here rather than as a margin on
            the band: `seam` sets `-mt-[48px]`, and a `mt-*` in the band's
            `className` would be a second value for the same property. Net gap
            after the overlap: 64px / 104px. */}
        <div className="mx-auto max-w-[1160px] px-[20px] pb-[112px] pt-[32px] lg:px-[40px] lg:pb-[152px] lg:pt-[48px]">
          <div className="grid grid-cols-1 gap-[28px] md:grid-cols-2 md:gap-[48px]">
            {COO.day.tracks.map((track) => (
              <div key={track.label} className="border-t border-fn-line-3 pt-[16px]">
                <div className="mb-[10px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-ink-2">
                  {track.label}
                </div>
                <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
                  {track.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* The blue band. One device (the facet plane), one orange element
            (the Finch bar), and a two-column split so the bars can be
            bottom-aligned: their baseline lands on the band's own bottom edge
            rather than floating in the middle of it, which is what the plan
            means by the bars sitting on the seam. Below `lg` the columns
            stack and the bars come first — the picture is the argument and it
            should not be under 200 words of sourcing on a phone. */}
        <Band
          id="cost"
          ground="blue"
          seam
          className="scroll-mt-[80px]"
          device={<FacetPlane seed={73} />}
          contentClassName="grid gap-[40px] lg:grid-cols-2 lg:items-end lg:gap-[56px]"
        >
          <div className="order-2 lg:order-1">
            <BandHead
              eyebrow={COO.cost.eyebrow}
              title={COO.cost.title}
              sub={COO.cost.sub}
              tone="blue"
            />
            <CostSources
              salary={SALARY}
              finchNote={COO.cost.finchNote}
              tone="blue"
              className="mt-[26px]"
            />
          </div>
          <CostBars salary={SALARY} tone="blue" className="order-1 lg:order-2" />
        </Band>

        <Section
          id="side-by-side"
          eyebrow="SIDE BY SIDE"
          title="What you get, and what you give up."
          sub="The rows where the person wins are the reason this table exists."
        >
          <CompareTable spec={COO.table} label="A COO you hire compared with Finch" />
        </Section>

        <Section
          id="hire-instead"
          eyebrow={COO.hireInstead.eyebrow}
          title={COO.hireInstead.title}
          sub={COO.hireInstead.sub}
          narrow
        >
          <ul className="m-0 mt-[28px] list-none p-0">
            {COO.hireInstead.cases.map((item) => (
              <li
                key={item}
                className="border-t border-fn-line-2 py-[16px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty"
              >
                {item}
              </li>
            ))}
          </ul>
          {/* The pull line. §4's Statement scale at 44px rather than the full
              72 — this is the page conceding a point, not announcing one, and
              a `<p>` because the section already has its `<h2>` and a second
              heading here would be a heading with nothing under it. Written
              out rather than through `Statement`, whose own `text-[72px]`
              cannot be overridden reliably: two arbitrary Tailwind values for
              one property resolve by stylesheet order. */}
          <p className="m-0 mt-[36px] border-t border-fn-line pt-[36px] font-fn-serif text-[32px] font-medium leading-[1.1] tracking-[-0.02em] text-fn-ink text-balance lg:text-[44px]">
            <SplitReveal text="Sometimes the answer is a person." />
          </p>
          <p className="m-0 mt-[20px] text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
            {COO.hireInstead.both}
          </p>
        </Section>

        <CompareFaqs title="Before you hire, or don’t." faqs={COO.faqs} />

        <SideLinks
          links={[
            { label: "Finch vs an ERP", href: "/compare/finch-vs-erp" },
            { label: "Finch vs spreadsheets", href: "/compare/finch-vs-spreadsheets" },
            { label: "All three comparisons", href: "/compare" },
            { label: "What Finch does", href: "/finch" },
            { label: "Fit & alternatives FAQ", href: "/faq#fit" },
          ]}
        />

        {/* Same arrangement as the blue band: the wrapper carries the air, the
            band's own seam eats 48px of it. */}
        <div className="pt-[112px] lg:pt-[152px]">
          <CooCta />
        </div>
      </main>
      <div className="pt-[56px] lg:pt-[88px]">
        <FinchFooter />
      </div>
    </div>
  );
}
