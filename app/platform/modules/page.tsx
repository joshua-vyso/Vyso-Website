import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { ModuleCard } from "@/components/finch/modules/ModuleCard";
import { WiringDiagram } from "@/components/finch/modules/WiringDiagram";
import { MARKETING_MODULE_BY_SLUG, MODULE_GROUPS } from "@/lib/marketing/modules";
import { SITE } from "@/lib/marketing/site";

const TITLE = "Finch's 10 modules: the machinery underneath";
const DESCRIPTION =
  "See all 10 modules Finch's agents read from and write to — documents, orders, pricing, stock, people and insight — built for South African operators.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/platform/modules" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/platform/modules`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* BreadcrumbList only — this page has no FAQs of its own (each module detail
   page carries its own FAQPage; see `[slug]/page.tsx`). */
function buildModulesIndexSchema() {
  const url = `${SITE.url}/platform/modules`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "Under the hood", item: url },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${url}#modules`,
        itemListElement: MODULE_GROUPS.flatMap((group) => group.slugs).map((slug, index) => {
          const module_ = MARKETING_MODULE_BY_SLUG[slug];
          return {
            "@type": "ListItem",
            position: index + 1,
            name: module_.name,
            description: module_.tagline,
            url: `${url}/${slug}`,
          };
        }),
      },
    ],
  };
}

/* `/platform/modules` in the Finch design language. The signature visual is
   the wiring diagram (`WiringDiagram.tsx`) — the Finch mark at the centre,
   the ten modules on a ring, hairline connectors that draw once on enter.
   Everything below it is server-rendered: the grid needs no client
   JavaScript, only the diagram does. */
export default function AllModulesPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildModulesIndexSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <FinchNav />

      <main id="main">
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]">
          <p className="mb-[14px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
            UNDER THE HOOD
          </p>
          <h1 className="m-0 mb-[16px] font-fn-serif text-[40px] font-medium tracking-[-0.02em] lg:text-[52px]">
            The machinery Finch runs on.
          </h1>
          <p className="m-0 max-w-[620px] text-[15.5px] leading-[1.6] text-fn-ink-3 lg:text-[16px]">
            Ten modules, one operating foundation. Finch&rsquo;s agents read from and write to
            these — you rarely need to open them.
          </p>
        </section>

        <section
          className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[80px]"
          aria-label="How the ten modules connect to Finch"
        >
          <WiringDiagram />
        </section>

        <section
          className="mx-auto max-w-[1160px] px-[20px] pb-[96px] pt-[64px] lg:px-[40px] lg:pb-[130px] lg:pt-[88px]"
          aria-labelledby="modules-grid-heading"
        >
          <h2 id="modules-grid-heading" className="sr-only">
            All ten modules, grouped
          </h2>

          <div className="flex flex-col gap-[56px] lg:gap-[72px]">
            {MODULE_GROUPS.map((group) => (
              <div key={group.id}>
                <h3 className="m-0 mb-[20px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted lg:mb-[24px]">
                  {group.label.toUpperCase()}
                </h3>
                <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
                  {group.slugs.map((slug) => (
                    <ModuleCard key={slug} module_={MARKETING_MODULE_BY_SLUG[slug]} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-[1160px] px-[20px] pb-[40px] lg:px-[40px]">
          <p className="m-0 text-[13.5px] text-fn-ink-3">
            Looking for what Finch fixes, not the modules underneath?{" "}
            <Link
              href="/solutions"
              className="text-fn-ink underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep"
            >
              See what Finch fixes
            </Link>
            .
          </p>
        </div>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
