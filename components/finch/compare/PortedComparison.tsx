import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import type { Crumb, PortedComparison as Spec } from "@/lib/marketing/compare";

import { FitSplit, PointGrid, RuleList, Section, SideLinks, StepRow } from "./CompareBits";
import { CompareFaqs } from "./CompareFaqs";
import { CompareHero } from "./CompareHero";
import { CompareTable } from "./CompareTable";
import { buildCompareSchema } from "./compare-jsonld";

/* ── The two ported comparisons, rendered once ───────────────────────────────
   `/compare/finch-vs-erp` and `/compare/finch-vs-spreadsheets` were already the
   same page twice on the old site — same seven sections, same order, different
   subject. Porting them into two page files would have ported the duplication
   too, so the shape lives here and the two routes are metadata plus a data
   object.

   The COO comparison does NOT come through here: it has the day strip, the cost
   bars and the "when to hire instead" section, and forcing it into this shape
   would have meant six optional props and a component that renders three
   different pages.

   Server component; the finding card's tilt is the only thing that hydrates. */

export function PortedComparisonPage({
  spec,
  trail,
  tableLabel,
  faqTitle,
  secondary,
  sideLinks,
}: {
  spec:       Spec;
  trail:      readonly Crumb[];
  tableLabel: string;
  faqTitle:   string;
  secondary:  Crumb;
  sideLinks:  readonly Crumb[];
}) {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildCompareSchema({ canonical: spec.canonical, trail, faqs: spec.faqs }),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav />
      <main id="main">
        <CompareHero
          trail={trail}
          eyebrow={spec.eyebrow}
          title={spec.h1}
          answer={spec.answer}
          example={spec.finding}
          secondary={secondary}
        />

        {/* The alternative's case, first and without hedging — a comparison
            page that opens by knocking the thing it is compared to is an advert
            with a table in it. */}
        <Section
          id="where-it-fits"
          eyebrow={spec.strengths.eyebrow}
          title={spec.strengths.title}
          sub={spec.strengths.sub}
        >
          <RuleList items={spec.strengths.items} />
        </Section>

        <Section
          id="where-it-breaks"
          eyebrow={spec.breakdowns.eyebrow}
          title={spec.breakdowns.title}
          sub={spec.breakdowns.sub}
        >
          <PointGrid items={spec.breakdowns.items} />
        </Section>

        <Section
          id="how-finch-differs"
          eyebrow={spec.differences.eyebrow}
          title={spec.differences.title}
          sub={spec.differences.sub}
        >
          <RuleList items={spec.differences.items} />
        </Section>

        <Section
          id="side-by-side"
          eyebrow="SIDE BY SIDE"
          title="At a glance."
          sub="The rows businesses actually decide on, in one place."
        >
          <CompareTable spec={spec.table} label={tableLabel} />
        </Section>

        <Section id="fit" eyebrow={spec.fit.eyebrow} title={spec.fit.title}>
          <FitSplit left={spec.fit.theirs} right={spec.fit.ours} />
        </Section>

        <Section id="how-it-starts" eyebrow={spec.steps.eyebrow} title={spec.steps.title}>
          <StepRow items={spec.steps.items} />
        </Section>

        <CompareFaqs title={faqTitle} faqs={spec.faqs} />

        <SideLinks links={sideLinks} />

        <AuditBand />
      </main>
      <div className="pt-[56px] lg:pt-[88px]">
        <FinchFooter />
      </div>
    </div>
  );
}

export default PortedComparisonPage;
