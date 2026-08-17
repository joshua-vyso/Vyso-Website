import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { FindingCard } from "@/components/finch/FindingCard";
import { Breadcrumb, Eyebrow } from "@/components/finch/company/CompanyBits";
import { buildCaseStudiesHubSchema } from "@/components/finch/company/company-jsonld";

const TITLE = "Case studies: Turn 'n Slice, a founding-client story";
const DESCRIPTION =
  "One founding-client case study so far: Turn 'n Slice in Johannesburg, South Africa, replacing QuickBooks invoicing with OrderFlow.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/case-studies" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://vyso.co.za/case-studies",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* `/case-studies` in the Finch design language. Copy refresh only, per the
   plan — the one entry's description below is byte-identical to the sentence
   `/case-studies/turn-n-slice`'s own hero uses, verified against that page's
   `compactLead` string before shipping either. */
export default function CaseStudiesPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildCaseStudiesHubSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <FinchNav />

      <main id="main">
        <header className="mx-auto max-w-[860px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[100px]">
          <Breadcrumb trail={[{ label: "Home", href: "/" }, { label: "Case studies", href: "/case-studies" }]} />
          <Eyebrow>PROOF, NOT PROMISES</Eyebrow>
          <h1 className="m-0 mb-[16px] font-fn-serif text-[40px] font-medium leading-[1.05] tracking-[-0.02em] lg:mb-[20px] lg:text-[56px]">
            Real operations. Real change.
          </h1>
          <p className="m-0 max-w-[620px] text-[15.5px] leading-[1.65] text-fn-ink-3 text-pretty lg:text-[16px]">
            Vyso is early. Rather than publish a wall of logos, we document founding-client
            implementations honestly as they happen — starting with the first one, in
            Johannesburg.
          </p>
        </header>

        <section
          aria-labelledby="turn-n-slice-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]"
        >
          <h2 id="turn-n-slice-heading" className="sr-only">
            Turn &rsquo;n Slice: one operational brain for invoicing
          </h2>
          <Link
            href="/case-studies/turn-n-slice"
            className="group grid grid-cols-1 gap-[28px] rounded-[14px] border border-fn-line bg-fn-surface p-[24px] transition-colors duration-150 hover:border-fn-line-hover lg:grid-cols-[280px_1fr] lg:items-center lg:gap-[40px] lg:p-[36px]"
          >
            <div className="flex items-center justify-center rounded-[10px] bg-fn-surface-2 p-[32px]">
              <Image
                src="/turn-n-slice-logo-clean.png"
                alt="Turn n Slice"
                width={220}
                height={220}
                sizes="(max-width: 760px) 60vw, 220px"
                className="h-auto w-full max-w-[220px]"
              />
            </div>
            <div>
              <p className="m-0 mb-[10px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted">
                FOUNDING-CLIENT STORY
              </p>
              <h3 className="m-0 mb-[10px] font-fn-serif text-[24px] font-medium tracking-[-0.02em] lg:text-[28px]">
                Replacing invoicing admin with one operational brain
              </h3>
              {/* Byte-identical to the pre-rebuild hub's own paragraph (verified by
                  diff against the prior `app/case-studies/page.tsx`) — copy refresh
                  changes the frame around this sentence, never the sentence. */}
              <p className="m-0 mb-[18px] max-w-[560px] text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">
                A Johannesburg FMCG food business, and Vyso&apos;s first founding
                customer. OrderFlow is already replacing QuickBooks as its
                invoicing system, bringing price lists, customer accounts, quotes, orders, invoices
                and payments into one connected workflow.
              </p>
              <span className="inline-flex items-center gap-[6px] text-[14.5px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                Read the full story
                <span aria-hidden="true" className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]">
                  →
                </span>
              </span>
            </div>
          </Link>
        </section>

        <section
          aria-labelledby="more-stories-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <div className="grid grid-cols-1 gap-[40px] lg:grid-cols-[1fr_460px] lg:items-start lg:gap-[56px]">
            <div>
              <Eyebrow>WHAT WE&rsquo;RE BUILDING TOWARD</Eyebrow>
              <h2
                id="more-stories-heading"
                className="m-0 mb-[16px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]"
              >
                More stories, as they become real.
              </h2>
              <p className="m-0 mb-[24px] max-w-[520px] text-[15px] leading-[1.6] text-fn-ink-3">
                Every new case study will be a genuine founding client, with approved metrics and
                quotes — not a composite or a projection.
              </p>
              <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
                {[
                  "Documented before-and-after workflows, not just headline numbers.",
                  "Metrics and quotes published only with the customer's approval.",
                  "Drawn from the industries Finch already understands — food, catering, wholesale and hospitality.",
                  "Updated as founding-client implementations mature.",
                ].map((text) => (
                  <li key={text} className="flex gap-[12px] text-[14.5px] leading-[1.6] text-fn-ink-2">
                    <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-fn-faint" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <FindingCard
              agent="CASE STUDIES"
              observation="One founding client live so far — Turn 'n Slice, Johannesburg."
              impact="More case studies as founding clients go live"
              evidence="1 case study"
              meta="TURN 'N SLICE · SINCE FOUNDING"
              state="in-progress"
              actions={["Read Turn 'n Slice", "Become a founding client"]}
              className="max-w-[460px]"
            />
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
