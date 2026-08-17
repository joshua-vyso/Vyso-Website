import type { Metadata } from "next";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { Breadcrumb, Eyebrow } from "@/components/finch/industries/IndustryBits";
import { ExperimentalCards, IndustryCards } from "@/components/finch/industries/IndustryCards";
import { buildIndustriesHubSchema } from "@/components/finch/industries/industries-jsonld";
import {
  EXPERIMENTAL_INDUSTRY_ORDER,
  HUB,
  PRIMARY_INDUSTRY_ORDER,
} from "@/lib/marketing/industries";
import { SITE } from "@/lib/marketing/site";

/* `/industries` — the vertical hub. Six primary operations, then a quiet "Also
   watching" row for the two experimental verticals, which are linked from here
   and the sitemap and nowhere else (`.ai/vyso_v2.md` §2.2).

   Root layout supplies the `%s | Vyso` suffix, so the title here is the page
   half only. `.finch-site` scopes the `--fn-*` tokens and opts the route out of
   the site-wide blend surface, exactly as `/` and `/pricing` do. */

export const metadata: Metadata = {
  title: HUB.title,
  description: HUB.description,
  alternates: { canonical: `${SITE.url}/industries` },
  robots: { index: true, follow: true },
  openGraph: {
    title: HUB.title,
    description: HUB.description,
    url: `${SITE.url}/industries`,
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

export default function IndustriesPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildIndustriesHubSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav active="industries" />

      <main id="main">
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[36px] lg:px-[40px] lg:pt-[56px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Industries", href: "/industries" },
            ]}
          />
          <Eyebrow>{HUB.eyebrow}</Eyebrow>
          <h1 className="m-0 mb-[18px] max-w-[820px] font-fn-serif text-[36px] font-medium leading-[1.1] tracking-[-0.02em] text-pretty lg:mb-[22px] lg:text-[54px] lg:leading-[1.06] lg:tracking-[-0.025em]">
            {HUB.h1Plain} <span className="text-fn-ink-3">{HUB.h1Accent}</span>
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:text-[17px]">
            {HUB.lead}
          </p>
        </section>

        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[84px]"
          aria-labelledby="primary-heading"
        >
          <Eyebrow>{HUB.primaryEyebrow}</Eyebrow>
          <h2
            id="primary-heading"
            className="m-0 mb-[16px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]"
          >
            {HUB.primaryHeading}
          </h2>
          <p className="m-0 mb-[32px] max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 text-pretty lg:mb-[44px] lg:text-[15.5px]">
            {HUB.primaryLead}
          </p>
          <IndustryCards slugs={PRIMARY_INDUSTRY_ORDER} />
        </section>

        {/* "Also watching" — quieter by design: these two are experimental, and
            the row's weight should say so before the chip does. */}
        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
          aria-labelledby="also-heading"
        >
          <div className="border-t border-fn-line pt-[36px]">
            <Eyebrow>{HUB.alsoEyebrow}</Eyebrow>
            <h2
              id="also-heading"
              className="m-0 mb-[12px] font-fn-serif text-[22px] font-medium leading-[1.2] tracking-[-0.015em] lg:text-[26px]"
            >
              {HUB.alsoHeading}
            </h2>
            <p className="m-0 mb-[28px] max-w-[560px] text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">
              {HUB.alsoLead}
            </p>
            <ExperimentalCards slugs={EXPERIMENTAL_INDUSTRY_ORDER} />
          </div>
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
