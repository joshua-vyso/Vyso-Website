import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { FindingCard } from "@/components/finch/FindingCard";
import { Breadcrumb, Eyebrow } from "@/components/finch/company/CompanyBits";
import { buildTurnNSliceSchema } from "@/components/finch/company/company-jsonld";
import { PriceListDemo } from "@/components/finch/company/PriceListDemo";

const TITLE = "Turn 'n Slice case study — OrderFlow replaces QuickBooks";
const DESCRIPTION =
  "How Turn 'n Slice, a Johannesburg food business, is replacing QuickBooks with OrderFlow — price lists, orders and invoices in South Africa.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/case-studies/turn-n-slice" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://vyso.co.za/case-studies/turn-n-slice",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "article",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* Byte-identical facts, kept out of the reskin entirely — grouped here so the
   next person can diff this block against the pre-rebuild file's JSX without
   hunting through the layout markup around it. Nothing in this array's
   values changed; only where/how they're rendered below did. */
const CAPABILITIES = [
  {
    title: "Price lists in seconds",
    copy: "Create and maintain customer-ready price lists without rebuilding them manually.",
  },
  {
    title: "Central customer accounts",
    copy: "Keep each customer, their pricing and their commercial history together in one operational record.",
  },
  {
    title: "Connected invoicing",
    copy: "Carry the same information from quote and order through to invoice and payment tracking.",
  },
  {
    title: "Repeat work automated",
    copy: "Reduce recurring invoicing administration while keeping people in control of commercial decisions.",
  },
] as const;

const STATS: [string, string][] = [
  ["Johannesburg", "South African operation"],
  ["FMCG food", "Sector"],
  ["Founding", "Customer relationship"],
  ["OrderFlow", "Invoicing platform"],
];

const REINFORCES = [
  "Customer accounts are more useful when pricing, quotes, orders, invoices and payments share the same context.",
  "Price-list creation should be a routine operational task, not a slow manual rebuild.",
  "Replacing QuickBooks as the invoicing system means giving the operating team a workflow built around how orders actually move.",
  "Automation is strongest when it removes repeat administration while leaving important commercial decisions visible.",
] as const;

/* `/case-studies/turn-n-slice` in the Finch design language. Every quote and
   fact above and in the quote block below is byte-identical to the
   pre-rebuild page — only the surrounding layout, typography and the two new
   additions (the price-list micro-demo, the closing FindingCard) are new. */
export default function TurnNSliceCaseStudyPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildTurnNSliceSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <FinchNav />

      <main id="main">
        <header className="mx-auto max-w-[860px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[100px]">
          <Breadcrumb
            trail={[
              { label: "Home", href: "/" },
              { label: "Food suppliers", href: "/industries/food-suppliers" },
              { label: "Turn 'n Slice", href: "/case-studies/turn-n-slice" },
            ]}
          />
          <Eyebrow>FOUNDING-CUSTOMER STORY</Eyebrow>
          <h1 className="m-0 mb-[16px] font-fn-serif text-[36px] font-medium leading-[1.08] tracking-[-0.02em] lg:mb-[20px] lg:text-[50px]">
            Replacing invoicing admin with one operational brain.
          </h1>
          {/* Byte-identical to the pre-rebuild `compactLead`. */}
          <p className="m-0 mb-[32px] max-w-[620px] text-[15.5px] leading-[1.65] text-fn-ink-3 text-pretty lg:mb-[40px] lg:text-[16px]">
            Turn &apos;n Slice is a Johannesburg food business and Vyso&apos;s first
            founding customer. OrderFlow is already replacing QuickBooks as its
            invoicing system, bringing price lists, customer accounts, quotes, orders,
            invoices and payments into one connected operation.
          </p>

          <div className="flex flex-wrap gap-[14px]">
            <Link
              href="/founding-client"
              className="rounded-[10px] bg-fn-orange-cta px-[24px] py-[13px] text-[14.5px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange hover:text-white"
            >
              Become a founding client
            </Link>
            <Link
              href="/"
              className="rounded-[10px] border border-fn-line-3 bg-fn-surface px-[24px] py-[13px] text-[14.5px] font-semibold text-fn-ink transition-colors duration-150 hover:border-fn-line-hover"
            >
              Explore Finch
            </Link>
          </div>
        </header>

        <section
          aria-labelledby="case-facts-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]"
        >
          <h2 id="case-facts-heading" className="sr-only">
            Turn n Slice case-study facts
          </h2>
          <div className="grid grid-cols-1 gap-[28px] lg:grid-cols-[280px_1fr] lg:items-center lg:gap-[40px]">
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
            <div className="grid grid-cols-2 gap-[16px] md:grid-cols-4">
              {STATS.map(([value, label]) => (
                <article key={label} className="rounded-[10px] border border-fn-line bg-fn-surface px-[16px] py-[18px]">
                  <p className="m-0 mb-[4px] font-fn-serif text-[19px] font-medium tracking-[-0.01em] text-fn-ink">
                    {value}
                  </p>
                  <p className="m-0 font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-muted">
                    {label.toUpperCase()}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="demo-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-[1fr_420px] lg:items-center lg:gap-[56px]">
            <div>
              <Eyebrow>SEE IT WORK</Eyebrow>
              <h2
                id="demo-heading"
                className="m-0 mb-[12px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[32px]"
              >
                Price lists in seconds, not a manual rebuild.
              </h2>
              <p className="m-0 max-w-[480px] text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
                This is how it feels day to day: type the item, the priced row is already there —
                current cost, current margin, current customer terms, applied automatically.
              </p>
            </div>
            <PriceListDemo />
          </div>
        </section>

        <section
          aria-labelledby="case-challenge-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <div className="mb-[36px] max-w-[720px] lg:mb-[48px]">
            <Eyebrow>THE INVOICING TRANSITION</Eyebrow>
            <h2 className="m-0 mb-[12px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[32px]">
              From QuickBooks and manual pricing to one connected operation.
            </h2>
            <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
              Invoicing is more than producing a document. It depends on current prices, the right
              customer terms, an accurate quote and order trail, and a clear view of what has been
              paid. Turn &apos;n Slice is moving that day-to-day work into{" "}
              <Link href="/platform/modules/orderflow" className="text-fn-ink underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep">
                OrderFlow
              </Link>
              , with one system carrying the context from pricing to payment.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
            {CAPABILITIES.map(({ title, copy }) => (
              <article key={title} className="rounded-[10px] border border-fn-line bg-fn-surface px-[22px] py-[22px]">
                <h3 className="m-0 mb-[8px] font-fn-serif text-[18px] font-medium text-fn-ink">{title}</h3>
                <p className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-3">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="case-result-heading"
          className="mx-auto max-w-[860px] px-[20px] pt-[80px] text-center lg:px-[40px] lg:pt-[120px]"
        >
          <p className="m-0 mb-[16px] font-fn-serif text-[52px] leading-none text-fn-line-3" aria-hidden="true">
            &ldquo;
          </p>
          {/* Byte-identical to the pre-rebuild `quoteText`/`quoteByline`. */}
          <h2
            id="case-result-heading"
            className="m-0 mb-[20px] font-fn-serif text-[24px] leading-[1.35] tracking-[-0.015em] text-pretty lg:text-[30px]"
          >
            Vyso is automating our entire invoicing operation. We can build price
            lists in seconds and manage every customer account from one central
            operational brain.
          </h2>
          <p className="m-0 mb-[8px] font-fn-mono text-[11.5px] tracking-[0.1em] text-fn-muted">
            Roberto · Turn &apos;n Slice · Johannesburg, South Africa
          </p>
          <p className="m-0 mx-auto max-w-[500px] text-[13px] leading-[1.6] text-fn-faint">
            Founding-customer statement about the current OrderFlow implementation.
          </p>
        </section>

        <section
          aria-labelledby="case-learning-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[80px] lg:px-[40px] lg:pt-[120px]"
        >
          <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-[1fr_460px] lg:items-start lg:gap-[56px]">
            <div>
              <Eyebrow>WHAT THE WORK REINFORCES</Eyebrow>
              <h2
                id="case-learning-heading"
                className="m-0 mb-[20px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]"
              >
                Invoicing works better when it is part of the operation.
              </h2>
              <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
                {REINFORCES.map((text) => (
                  <li key={text} className="flex gap-[12px] text-[14.5px] leading-[1.6] text-fn-ink-2">
                    <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-fn-faint" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <FindingCard
              agent="ORDERFLOW"
              observation="Every price list, order and invoice for Turn 'n Slice now runs through one system."
              impact="Founding customer, live today"
              evidence="Case study"
              meta="TURN 'N SLICE · JOHANNESBURG"
              state="resolved"
              actions={["Become a founding client"]}
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
