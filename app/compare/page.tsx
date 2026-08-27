import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { ArrowLink, HonestyNote } from "@/components/finch/compare/CompareBits";
import { CompareHero } from "@/components/finch/compare/CompareHero";
import { buildCompareHubSchema } from "@/components/finch/compare/compare-jsonld";
import { HUB } from "@/lib/marketing/compare";

/* 46 chars before the sitewide "| Vyso" template. */
const title = "Compare Finch — vs a COO, an ERP, spreadsheets";
/* 152 chars. Leads with the comparison intent, carries the price and the place. */
const description =
  "Honest comparisons for South African operators: Finch versus hiring a COO, running an ERP, or living in spreadsheets. Priced per scope, after a free audit.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: HUB.canonical },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: HUB.canonical,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

const TRAIL = [
  { label: "Home", href: "/" },
  { label: "Compare", href: "/compare" },
];

/* `/compare` — the hub. Three cards, each with the verdict on its own page and
   the case against it in a finding-card frame: a comparison page that never
   says "not us" is an advert, and an operator can tell. No signature widget
   here — the hub's job is to route, and the day strip belongs to the COO page
   (`.ai/vyso_v2.md` §1: no widget is reused across pages).

   Server component throughout; the only client code is the finding-card frame's
   hover shadow. */
export default function ComparePage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildCompareHubSchema({
              canonical: HUB.canonical,
              trail: TRAIL,
              items: HUB.cards.map(({ href, title: cardTitle }) => ({ href, title: cardTitle })),
            }),
          ).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav />
      <main id="main">
        <CompareHero
          trail={TRAIL}
          eyebrow="CHOOSING WELL"
          title={HUB.h1}
          answer={HUB.answer}
          secondary={{ label: "Book your free audit", href: "/operations-audit" }}
        />

        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <div className="grid grid-cols-1 gap-[20px] border-t border-fn-line pt-[40px] lg:grid-cols-3 lg:gap-[24px] lg:pt-[56px]">
            {HUB.cards.map((card) => (
              <article key={card.href} className="flex flex-col">
                <Link
                  href={card.href}
                  className="group flex flex-1 flex-col rounded-[10px] border border-fn-line bg-fn-surface px-[24px] py-[24px] transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-[2px] hover:border-fn-line-hover hover:shadow-[var(--fn-shadow-card-hover)]"
                >
                  <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
                    {card.eyebrow}
                  </div>
                  <h2 className="m-0 mb-[12px] font-fn-serif text-[22px] font-medium tracking-[-0.02em] text-fn-ink lg:text-[24px]">
                    {card.title}
                  </h2>
                  <p className="m-0 mb-[20px] flex-1 text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">
                    {card.verdict}
                  </p>
                  <span className="inline-flex items-center gap-[7px] text-[14px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                    Read the comparison
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]"
                    >
                      →
                    </span>
                  </span>
                </Link>
                <HonestyNote>{card.notTheAnswer}</HonestyNote>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1160px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[96px]">
          <div className="flex flex-wrap items-center gap-x-[28px] gap-y-[14px] border-t border-fn-line pt-[28px]">
            <ArrowLink href="/faq#fit">The full fit-and-alternatives FAQ</ArrowLink>
            <ArrowLink href="/finch">What Finch does</ArrowLink>
            <ArrowLink href="/operations-audit">How the free audit works</ArrowLink>
          </div>
        </section>

        <AuditBand />
      </main>
      <div className="pt-[56px] lg:pt-[88px]">
        <FinchFooter />
      </div>
    </div>
  );
}
