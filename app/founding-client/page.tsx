import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { FindingCard } from "@/components/finch/FindingCard";
import { Breadcrumb, Eyebrow } from "@/components/finch/company/CompanyBits";
import { CohortRow } from "@/components/finch/company/CohortRow";
import { buildFoundingSchema } from "@/components/finch/company/company-jsonld";
import { TermsStrip } from "@/components/finch/company/TermsStrip";
import {
  CANONICAL_URL,
  COHORT,
  DESCRIPTION,
  FOUNDING_ASKS,
  FOUNDING_FAQS,
  FOUNDING_GETS,
  FOUNDING_TERMS,
  TITLE,
} from "@/lib/marketing/founding";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/founding-client" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL_URL,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* `/founding-client` in the Finch design language. Server component
   throughout except the two signature bits that animate on enter
   (`TermsStrip`, `CohortRow`) — the FAQ answers are native `<dl>` text, no
   accordion needed for five short questions. */
export default function FoundingClientPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFoundingSchema()).replace(/</g, "\\u003c") }}
      />

      <FinchNav />

      <main id="main">
        <header className="mx-auto max-w-[860px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[100px]">
          <Breadcrumb trail={[{ label: "Home", href: "/" }, { label: "Founding client", href: "/founding-client" }]} />
          <Eyebrow>FOUNDING CLIENT</Eyebrow>
          <h1 className="m-0 mb-[16px] font-fn-serif text-[40px] font-medium leading-[1.05] tracking-[-0.02em] lg:mb-[20px] lg:text-[56px]">
            Founding client terms.
          </h1>
          <p className="m-0 mb-[36px] max-w-[620px] text-[15.5px] leading-[1.65] text-fn-ink-3 text-pretty lg:mb-[48px] lg:text-[16px]">
            Same offer — priced per customer and per scope, fixed after a free audit — on terms that
            reward being early: setup waived, your first month free, and your rate locked for as long
            as you stay.
          </p>

          <TermsStrip terms={FOUNDING_TERMS} />

          <div className="mt-[28px] flex flex-wrap gap-[14px] lg:mt-[36px]">
            <Link
              href="/operations-audit"
              className="rounded-[10px] bg-fn-orange-cta px-[24px] py-[13px] text-[14.5px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange hover:text-white"
            >
              Book your audit
            </Link>
            <Link
              href="/case-studies/turn-n-slice"
              className="rounded-[10px] border border-fn-line-3 bg-fn-surface px-[24px] py-[13px] text-[14.5px] font-semibold text-fn-ink transition-colors duration-150 hover:border-fn-line-hover"
            >
              Read the Turn &rsquo;n Slice story
            </Link>
          </div>
        </header>

        <section
          aria-labelledby="founding-gets-heading"
          className="mx-auto max-w-[860px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]"
        >
          <h2
            id="founding-gets-heading"
            className="m-0 mb-[8px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]"
          >
            What a founding client gets
          </h2>
          <p className="m-0 mb-[28px] max-w-[560px] text-[15px] leading-[1.6] text-fn-ink-3 lg:mb-[36px]">
            Five steps, in order — nothing switched on before the step before it.
          </p>

          <ol className="m-0 flex list-none flex-col gap-0 border-t border-fn-line p-0">
            {FOUNDING_GETS.map((step, i) => (
              <li key={step.title} className="flex gap-[18px] border-b border-fn-line-2 py-[20px]">
                <span className="shrink-0 pt-[2px] font-fn-mono text-[13px] tracking-[0.06em] text-fn-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="m-0 mb-[4px] text-[16px] font-medium text-fn-ink">{step.title}</h3>
                  <p className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-3">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="founding-asks-heading"
          className="mx-auto max-w-[860px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[72px]"
        >
          <h2
            id="founding-asks-heading"
            className="m-0 mb-[16px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]"
          >
            What we ask in return
          </h2>
          <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
            {FOUNDING_ASKS.map((ask) => (
              <li key={ask} className="flex gap-[12px] text-[15px] leading-[1.6] text-fn-ink-2">
                <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-fn-faint" />
                {ask}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="founding-cohort-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <Eyebrow>THE COHORT, HONESTLY</Eyebrow>
          <h2
            id="founding-cohort-heading"
            className="m-0 mb-[10px] font-fn-serif text-[28px] font-medium tracking-[-0.02em] lg:text-[34px]"
          >
            One founding client so far. The rest of the row is open.
          </h2>
          <p className="m-0 mb-[40px] max-w-[620px] text-[15px] leading-[1.65] text-fn-ink-3 lg:mb-[52px]">
            We fill in a circle only once a business is actually live on Finch. Everything hollow
            is an open seat, not a waitlist number.
          </p>

          <CohortRow seats={COHORT} />

          <div className="mt-[48px] grid grid-cols-1 gap-[32px] lg:grid-cols-[1fr_460px] lg:items-start lg:gap-[56px]">
            <p className="m-0 max-w-[520px] text-[14.5px] leading-[1.65] text-fn-muted">
              Turn &rsquo;n Slice, a Johannesburg food business, is Vyso&rsquo;s first founding
              client — live on OrderFlow today. Every other seat in the row is genuinely open.
            </p>
            <FindingCard
              agent="ORDERFLOW"
              observation="Turn 'n Slice's price lists, orders and invoices now run through one system — no more rebuilding a price list by hand."
              impact="Founding client, live today"
              evidence="Case study"
              meta="TURN 'N SLICE · JOHANNESBURG"
              state="resolved"
              actions={["Read the case study"]}
              className="max-w-[460px]"
            />
          </div>
        </section>

        <section
          aria-labelledby="founding-faq-heading"
          className="mx-auto max-w-[860px] px-[20px] pt-[72px] pb-[24px] lg:px-[40px] lg:pt-[110px]"
        >
          <h2
            id="founding-faq-heading"
            className="m-0 mb-[24px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:mb-[32px] lg:text-[30px]"
          >
            The terms, straight
          </h2>
          <dl className="m-0 grid grid-cols-1 gap-[26px] md:grid-cols-2 md:gap-x-[48px] md:gap-y-[30px]">
            {FOUNDING_FAQS.map(({ question, answer }) => (
              <div key={question}>
                <dt className="mb-[7px] font-fn-serif text-[16.5px] font-medium text-fn-ink">{question}</dt>
                <dd className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">{answer}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/faq#pricing"
            className="mt-[24px] inline-block text-[14.5px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep"
          >
            Full pricing FAQ →
          </Link>
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
