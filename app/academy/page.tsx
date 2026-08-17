import type { Metadata } from "next";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { AcademyInterest } from "@/components/finch/academy/AcademyInterest";
import { buildAcademySchema } from "@/components/finch/academy/academy-jsonld";
import { PRICE } from "@/components/finch/pricing/pricing-data";
import { SITE } from "@/lib/marketing/site";

/* `/academy` — new page, `.ai/vyso_v2.md` §2.3 / phase-3 plan Workstream C.
   Content is the same "coming soon" facts already published on `/pricing`'s
   `AcademyCard` (R500/seat, workshops + templates + the weekly-brief
   discipline) — this page is the first full page for it, not new claims.
   The four curriculum modules are new copy, explicitly marked PLANNED and
   framed as teaching the same operating method Finch runs, per the existing
   `AcademyCard` copy ("Vyso Academy teaches your team the same operating
   method Finch runs"). No dates, no curriculum detail beyond what's honest
   to promise before the first cohort exists. */

const rand = (value: number) => `R${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

const TITLE = `Vyso Academy — ${rand(PRICE.academySeat)}/seat, the DIY operations course`;
const DESCRIPTION =
  "Vyso Academy teaches South African food businesses the operating method Finch runs — workshops, templates, weekly briefs. R500 per seat. Coming soon.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/academy" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/academy`,
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

const MODULES = [
  {
    n: "01",
    title: "Reading the numbers",
    body: "Margin vs markup, VAT-inclusive pricing, and how to read a supplier invoice for what it's actually costing you.",
  },
  {
    n: "02",
    title: "Supplier & price tracking",
    body: "Build your own price-watch sheet and spot creep line by line, the manual version of what Price Watch automates.",
  },
  {
    n: "03",
    title: "Debtors & stock hygiene",
    body: "Ageing debtors and stock cover days as a weekly routine, so nothing quietly thins out before it becomes a problem.",
  },
  {
    n: "04",
    title: "The weekly-brief discipline",
    body: "The habit of writing the three things that matter every Monday — the same discipline Finch's Brief runs on WhatsApp.",
  },
] as const;

export default function AcademyPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildAcademySchema()).replace(/</g, "\\u003c") }}
      />

      <FinchNav />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]">
          <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
            <p className="m-0 font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
              VYSO ACADEMY
            </p>
            <span className="inline-block rounded-[4px] border border-fn-line px-[7px] py-[3px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
              COMING SOON
            </span>
          </div>
          <h1 className="m-0 mb-[16px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.02em] lg:text-[50px]">
            Vyso Academy — the DIY option.
          </h1>
          <p className="m-0 max-w-[620px] text-[15.5px] leading-[1.65] text-fn-ink-3 lg:text-[16px]">
            The same operating method Finch runs, taught to your team instead of automated for
            you — workshops, templates and the weekly-brief discipline. No agents; just the
            playbook.
          </p>
          <div className="mt-[24px] font-fn-serif text-[30px] font-medium tracking-[-0.02em] lg:text-[34px]">
            {rand(PRICE.academySeat)}
            <span className="text-[16px] font-normal tracking-normal text-fn-muted"> / seat</span>
          </div>
        </section>

        {/* Curriculum — planned, not live */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
            WHAT IT WILL COVER
          </p>
          <h2 className="m-0 mb-[24px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
            Four modules, planned for the first cohort.
          </h2>
          <div className="grid grid-cols-1 gap-[20px] sm:grid-cols-2">
            {MODULES.map((m) => (
              <div key={m.n} className="rounded-[12px] border border-fn-line bg-fn-surface px-[22px] py-[22px]">
                <div className="mb-[10px] flex items-center justify-between gap-[10px]">
                  <span className="font-fn-mono text-[11px] tracking-[0.12em] text-fn-muted">
                    {m.n}
                  </span>
                  <span className="rounded-[4px] border border-fn-line px-[7px] py-[3px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-muted">
                    PLANNED
                  </span>
                </div>
                <div className="mb-[8px] font-fn-serif text-[18px] font-medium tracking-[-0.01em] text-fn-ink">
                  {m.title}
                </div>
                <p className="m-0 text-[14px] leading-[1.6] text-fn-ink-3">{m.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The seat grid + interest form — the signature visual */}
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <p className="mb-[10px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
            BEFORE THE FIRST COHORT
          </p>
          <h2 className="m-0 mb-[16px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
            Register interest — we&rsquo;ll write when it opens.
          </h2>
          <p className="m-0 mb-[32px] max-w-[620px] text-[14.5px] leading-[1.65] text-fn-ink-3 lg:mb-[40px]">
            No cohort is open yet and no payment happens here. Twelve seats shown below — filling
            in this form fills one, for this session only. It&rsquo;s a small, honest gesture, not
            a count of real signups.
          </p>
          <AcademyInterest />
        </section>

        <div className="pt-[64px] lg:pt-[96px]">
          <AuditBand />
        </div>
      </main>

      <FinchFooter />
    </div>
  );
}
