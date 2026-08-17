import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { AboutTimeline } from "@/components/finch/about/AboutTimeline";
import { buildAboutSchema } from "@/components/finch/about/about-jsonld";
import { PRICE } from "@/components/finch/pricing/pricing-data";
import { SITE } from "@/lib/marketing/site";

/* `/about` rebuild — `.ai/vyso_v2.md` §2.3, `.ai/plan_phase3_company_
   verticals_content.md` Workstream C. Every fact below is either in
   `lib/marketing/site.ts` (name, location, founder) or grounded in the
   published case study / pricing (Turn 'n Slice as the first founding
   customer, R6,000/R2,000/R500 figures) — nothing invented. The one open
   item is the founder photo/bio, marked with a `TODO(user)` below. */

const TITLE = "About Vyso — the company behind Finch";
const DESCRIPTION =
  "Vyso is a Johannesburg company. Founder Josh Moreira. Finch, its AI operations agent for South African food SMEs, costs R6,000 per location per month.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
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

const PRINCIPLES = [
  {
    label: "Evidence first",
    body: "Every finding Finch surfaces points at the invoice, statement or delivery note it came from. Nothing is asserted without the source attached.",
  },
  {
    label: "Rand, not vibes",
    body: "Impact is quantified in rand wherever the numbers support it. Where they don't yet, the page says so rather than round up.",
  },
  {
    label: "Your tools, not ours",
    body: "Finch reads what a business already runs — invoices, spreadsheets, WhatsApp, Xero, Sage — instead of asking anyone to migrate to a new system.",
  },
  {
    label: "We tell you if you don't need us",
    body: "The Operations Audit is delivered whether or not a business signs up afterward. If there's nothing worth automating yet, that's the finding.",
  },
];

const rand = (value: number) => `R${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export default function AboutPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildAboutSchema()).replace(/</g, "\\u003c") }}
      />

      <FinchNav />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]">
          <p className="mb-[14px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">ABOUT VYSO</p>
          <h1 className="m-0 mb-[18px] font-fn-serif text-[40px] font-medium leading-[1.05] tracking-[-0.02em] lg:text-[54px]">
            Vyso, the company.
          </h1>
          <p className="m-0 max-w-[620px] text-[15.5px] leading-[1.65] text-fn-ink-3 lg:text-[16px]">
            Finch is the product — a company&rsquo;s own COO, built from AI agents. Vyso is who
            built it, who runs the audits, who teaches the Academy, and whose name is on the
            invoice.
          </p>
        </section>

        {/* Founder */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-[160px_1fr] lg:gap-[48px]">
            {/* TODO(user): replace with a real photo (160×160, object-cover).
                Placeholder is an honest initials mark, not a stand-in photo —
                nothing here pretends to be a picture of Josh. */}
            <div
              aria-hidden
              className="flex h-[120px] w-[120px] items-center justify-center rounded-full border border-fn-line bg-fn-surface font-fn-serif text-[34px] font-medium text-fn-muted lg:h-[160px] lg:w-[160px] lg:text-[44px]"
            >
              JM
            </div>
            <div>
              <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">FOUNDER</p>
              <h2 className="m-0 mb-[12px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
                Josh Moreira, Johannesburg.
              </h2>
              <p className="m-0 max-w-[600px] text-[15px] leading-[1.65] text-fn-ink-3">
                Josh founded Vyso and leads it from Johannesburg — the operations audits, the
                Finch build, and Vyso Academy.
              </p>
              {/* TODO(user): a two-line bio goes here — background, why food
                  operations, whatever's true and worth a reader's ten seconds.
                  Left out rather than invented. */}
            </div>
          </div>
        </section>

        {/* Why Finch */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <div className="max-w-[680px]">
            <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">WHY FINCH</p>
            <h2 className="m-0 mb-[16px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
              Most operations software wasn&rsquo;t built for how South African food businesses
              actually run.
            </h2>
            <p className="m-0 mb-[14px] text-[15px] leading-[1.65] text-fn-ink-3">
              They run on WhatsApp, spreadsheets and a manager who remembers the price of
              butternut from three suppliers ago. A fractional or full-time COO is out of reach
              for most of them, and generic dashboards need someone to fill them in every day —
              which is the job that&rsquo;s already not getting done.
            </p>
            <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3">
              Finch reads what&rsquo;s already there — invoices, stock, suppliers, debtors,
              margins — and tells the owner, in rand, where it&rsquo;s leaking. That&rsquo;s the
              whole idea: a company&rsquo;s own COO, at a tenth of the cost, watching all day
              instead of waiting to be asked.
            </p>
          </div>
        </section>

        {/* Honest stage */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <div className="max-w-[680px]">
            <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
              WHERE WE ARE RIGHT NOW
            </p>
            <h2 className="m-0 mb-[16px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
              A small founding cohort, not a finished company.
            </h2>
            <p className="m-0 mb-[14px] text-[15px] leading-[1.65] text-fn-ink-3">
              Vyso is taking on founding clients rather than claiming a track record it
              doesn&rsquo;t have yet.{" "}
              <Link
                href="/case-studies/turn-n-slice"
                className="font-medium text-fn-ink underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep"
              >
                Turn &rsquo;n Slice
              </Link>
              , a Johannesburg food business, is the first — OrderFlow is already replacing
              QuickBooks as its invoicing system.
            </p>
            <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3">
              Founding clients get setup waived, the first month free and their rate locked. See{" "}
              <Link
                href="/founding-client"
                className="font-medium text-fn-ink underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep"
              >
                the founding client terms
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Beyond Finch */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
            BEYOND FINCH
          </p>
          <h2 className="m-0 mb-[24px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
            What Vyso does beyond Finch.
          </h2>
          <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2">
            <Link
              href="/operations-audit"
              className="block rounded-[12px] border border-fn-line bg-fn-surface px-[22px] py-[22px] transition-colors duration-150 hover:border-fn-line-hover"
            >
              <div className="mb-[8px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-muted">
                THE OPERATIONS AUDIT
              </div>
              <div className="mb-[8px] font-fn-serif text-[19px] font-medium tracking-[-0.01em] text-fn-ink">
                One week, {rand(PRICE.audit)}, credited to your first month.
              </div>
              <p className="m-0 text-[14px] leading-[1.6] text-fn-ink-3">
                Vyso finds where the money is leaking, in rand, with the evidence attached —
                whether or not a business goes on to run Finch.
              </p>
            </Link>
            <Link
              href="/academy"
              className="block rounded-[12px] border border-fn-line bg-fn-surface px-[22px] py-[22px] transition-colors duration-150 hover:border-fn-line-hover"
            >
              <div className="mb-[8px] font-fn-mono text-[10.5px] tracking-[0.12em] text-fn-muted">
                VYSO ACADEMY
              </div>
              <div className="mb-[8px] font-fn-serif text-[19px] font-medium tracking-[-0.01em] text-fn-ink">
                {rand(PRICE.academySeat)} / seat — the DIY option.
              </div>
              <p className="m-0 text-[14px] leading-[1.6] text-fn-ink-3">
                For teams who&rsquo;d rather run the operating method themselves — workshops,
                templates, the weekly-brief discipline. Coming soon.
              </p>
            </Link>
          </div>
        </section>

        {/* Principles */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
            HOW WE WORK
          </p>
          <h2 className="m-0 mb-[24px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
            Four principles, applied the same way every time.
          </h2>
          <div className="grid grid-cols-1 gap-[24px] sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.label} className="border-t border-fn-line pt-[16px]">
                <div className="mb-[8px] font-fn-serif text-[17px] font-medium tracking-[-0.01em] text-fn-ink">
                  {p.label}
                </div>
                <p className="m-0 text-[14px] leading-[1.6] text-fn-ink-3">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline — the signature visual */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
            SO FAR
          </p>
          <h2 className="m-0 mb-[32px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:mb-[44px] lg:text-[30px]">
            Milestones.
          </h2>
          <AboutTimeline />
        </section>

        <div className="pt-[64px] lg:pt-[96px]">
          <AuditBand />
        </div>
      </main>

      <FinchFooter />
    </div>
  );
}
