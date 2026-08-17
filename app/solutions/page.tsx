import type { Metadata } from "next";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { Breadcrumb, Eyebrow } from "@/components/finch/solutions/SolutionBits";
import { SolutionCards } from "@/components/finch/solutions/SolutionCards";
import { buildSolutionsHubSchema } from "@/components/finch/solutions/solutions-jsonld";
import { SymptomChecklist } from "@/components/finch/solutions/SymptomChecklist";
import { HUB, SOLUTION_ORDER } from "@/lib/marketing/solutions";
import { SITE } from "@/lib/marketing/site";

/* Root layout supplies the `%s | Vyso` suffix, so the title here is the page
   half only (Workstream D, phase 1). */
export const metadata: Metadata = {
  title: HUB.title,
  description: HUB.description,
  alternates: { canonical: `${SITE.url}/solutions` },
  robots: { index: true, follow: true },
  openGraph: {
    title: HUB.title,
    description: HUB.description,
    url: `${SITE.url}/solutions`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HUB.title,
    description: HUB.description,
  },
};

/* `/solutions` — the problem-led hub. One widget (the symptom checklist), one
   finding card (the one the checklist writes), and the four cards. `.finch-site`
   scopes the `--fn-*` tokens and opts the route out of the site-wide blend
   surface, exactly as `/` and `/pricing` do. */
export default function SolutionsPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSolutionsHubSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav />

      <main id="main">
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[36px] lg:px-[40px] lg:pt-[56px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Solutions", href: "/solutions" },
            ]}
          />
          <Eyebrow>{HUB.eyebrow}</Eyebrow>
          <h1 className="m-0 mb-[18px] max-w-[820px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[56px] lg:leading-[1.06] lg:tracking-[-0.025em]">
            {HUB.h1Plain} <span className="text-fn-ink-3">{HUB.h1Accent}</span>
          </h1>
          <p className="m-0 max-w-[600px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:text-[17px]">
            {HUB.lead}
          </p>
        </section>

        {/* The signature visual. */}
        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[48px] lg:px-[40px] lg:pt-[72px]"
          aria-labelledby="symptoms-heading"
        >
          <h2 id="symptoms-heading" className="sr-only">
            Match the symptom
          </h2>
          <SymptomChecklist />
        </section>

        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
          aria-labelledby="solutions-heading"
        >
          <Eyebrow>FOUR PLACES TO START</Eyebrow>
          <h2
            id="solutions-heading"
            className="m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]"
          >
            What Finch fixes.
          </h2>
          <p className="m-0 mb-[32px] max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 lg:mb-[44px] lg:text-[15.5px]">
            Each page names the problem, the agents that would work it, and what Finch can honestly
            do about it today. They overlap — most operations recognise more than one.
          </p>
          <SolutionCards slugs={SOLUTION_ORDER} />
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
