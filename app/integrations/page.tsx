import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { DontSeeYourTool } from "@/components/finch/integrations-page/DontSeeYourTool";
import { IntegrationsFaqs } from "@/components/finch/integrations-page/IntegrationsFaqs";
import { buildIntegrationsSchema } from "@/components/finch/integrations-page/integrations-jsonld";
import { IntegrationSections } from "@/components/finch/integrations-page/IntegrationSections";
import { ReadingTable } from "@/components/finch/integrations-page/ReadingTable";
import { SITE } from "@/lib/marketing/site";

/* Root layout sets `title.template: "%s | Vyso"` — this string gets " | Vyso"
   appended automatically, so it does not carry the suffix itself (same rule
   `/pricing` and `/faq` follow). */
const title = "Integrations — Xero, Sage, WhatsApp, Yoco, Loyverse & more";
const description =
  "Xero and WhatsApp connect today for South African SMEs; Sage, Yoco, Loyverse, QuickBooks and 4 more are roadmap, scoped in your audit.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/integrations" },
  openGraph: {
    title,
    description,
    url: `${SITE.url}/integrations`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

/* `/integrations` in the Finch design language: "senses, not integrations".
   Server component throughout apart from `ReadingTable`, the signature
   visual — everything else (hero, per-tool `<dl>` sections, FAQ accordion) is
   static markup, exactly like `/pricing` and `/faq`. */
export default function IntegrationsPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildIntegrationsSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav />
      <main id="main">
        <section className="mx-auto max-w-[860px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]">
          <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
            SENSES, NOT INTEGRATIONS
          </div>
          <h1 className="m-0 mb-[18px] font-fn-serif text-[32px] font-medium leading-[1.14] tracking-[-0.02em] lg:text-[46px]">
            Connect what you already run. Finch starts watching.
          </h1>
          <p className="m-0 max-w-[620px] text-[15.5px] leading-[1.65] text-fn-ink-3">
            Nothing to migrate. Xero and WhatsApp connect during onboarding — the rest of your
            stack is read, not replaced, and only once you say so. What Finch reads from a
            connected tool stays yours.
          </p>
        </section>

        <section className="mx-auto max-w-[860px] px-[20px] pt-[40px] lg:px-[40px] lg:pt-[56px]">
          <ReadingTable />
        </section>

        <section
          id="tools"
          className="mx-auto max-w-[860px] scroll-mt-[80px] px-[20px] pt-[64px] lg:px-[40px] lg:pt-[88px]"
        >
          <h2 className="m-0 mb-[8px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]">
            Every tool, honestly.
          </h2>
          <p className="m-0 mb-[8px] text-[15px] leading-[1.6] text-fn-ink-3">
            What each one is for, what Finch actually reads from it today, and what&rsquo;s still
            roadmap.
          </p>
          <IntegrationSections />
        </section>

        <DontSeeYourTool />
        <IntegrationsFaqs />

        <p className="mx-auto max-w-[860px] px-[20px] pt-[24px] text-[13px] text-fn-muted lg:px-[40px]">
          More on integration boundaries, POPIA and data handling: see the{" "}
          <Link href="/faq#integrations" className="underline decoration-fn-line-3 underline-offset-4 hover:text-fn-orange-deep">
            full FAQ
          </Link>
          .
        </p>
      </main>
      <AuditBand />
      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
