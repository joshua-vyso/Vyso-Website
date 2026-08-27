import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { ALL_FAQ_QUESTIONS, FAQ_GROUPS } from "@/lib/marketing/faq";
import { SITE } from "@/lib/marketing/site";

import { FaqDeepLinkHandler, FaqFilter } from "./FaqInteractive";

const TITLE = "FAQ: Finch pricing, the audit & POPIA";
const DESCRIPTION =
  "Straight answers about what Finch costs, the free operations audit, founding terms, POPIA and how Finch fits the tools you already run.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/faq`,
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

/* One `<script type="application/ld+json">`, same `@graph` shape as
   `app/layout.tsx` and `components/finch/pricing/pricing-jsonld.ts`. The
   FAQPage entities are read straight off `ALL_FAQ_QUESTIONS`, so the schema
   can never say something the page itself doesn't render. */
function buildFaqSchema() {
  const url = `${SITE.url}/faq`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumbs`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
          { "@type": "ListItem", position: 2, name: "FAQ", item: url },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: ALL_FAQ_QUESTIONS.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
    ],
  };
}

/* `/faq` in the Finch design language, absorbing the retired `/pricing-faq`
   (`next.config.ts` 301s it to `/faq#pricing` — group id `pricing` below is
   load-bearing for that redirect target). The accordion is native
   `<details>`, exactly as `/pricing`'s `WhatsIncluded` does it, so the whole
   page works with JavaScript off; `FaqFilter` and `FaqDeepLinkHandler` are
   the only two client components, both progressive-enhancement layers on top
   of the same static markup rather than replacements for it. */
export default function FaqPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFaqSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FaqDeepLinkHandler />

      <FinchNav />

      <main id="main">
        <section className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[88px]">
          <p className="mb-[14px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">FAQ</p>
          <h1 className="m-0 mb-[16px] font-fn-serif text-[40px] font-medium tracking-[-0.02em] lg:text-[52px]">
            Straight answers.
          </h1>
          <p className="m-0 max-w-[560px] text-[15.5px] leading-[1.6] text-fn-ink-3 lg:text-[16px]">
            What Finch costs, how the audit works, what&rsquo;s live today, and how it fits the
            tools you already run. If it&rsquo;s not answered here,{" "}
            <Link href="/contact" className="text-fn-ink underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep">
              ask us directly
            </Link>
            .
          </p>
        </section>

        <section className="mx-auto max-w-[1160px] px-[20px] pt-[40px] pb-[96px] lg:px-[40px] lg:pt-[56px] lg:pb-[130px]">
          <FaqFilter>
            <div className="grid grid-cols-1 gap-y-[56px] lg:grid-cols-[200px_1fr] lg:gap-x-[56px] lg:gap-y-0">
              {/* Sticky group nav, ≥ lg only — below lg the filter input plus the
                  in-flow group headings do the same job without competing for
                  vertical space with a phone-width sticky rail. */}
              <nav aria-label="FAQ sections" className="hidden lg:sticky lg:top-[110px] lg:block lg:self-start">
                <ul className="m-0 list-none space-y-[4px] p-0">
                  {FAQ_GROUPS.map((group) => (
                    <li key={group.id}>
                      <a
                        href={`#${group.id}`}
                        className="block rounded-[6px] px-[10px] py-[7px] text-[13.5px] font-medium text-fn-ink-3 transition-colors duration-150 hover:bg-[#F5F2EA] hover:text-fn-ink"
                      >
                        {group.eyebrow}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="flex flex-col gap-[64px] lg:gap-[80px]">
                {FAQ_GROUPS.map((group) => (
                  <section
                    key={group.id}
                    id={group.id}
                    data-faq-group-section={group.id}
                    aria-labelledby={`${group.id}-heading`}
                    className="scroll-mt-[100px]"
                  >
                    <p className="mb-[8px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
                      {group.eyebrow.toUpperCase()}
                    </p>
                    <h2
                      id={`${group.id}-heading`}
                      className="m-0 mb-[8px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[30px]"
                    >
                      {group.title}
                    </h2>
                    <p className="m-0 mb-[24px] max-w-[640px] text-[14.5px] leading-[1.6] text-fn-ink-3">
                      {group.description}
                    </p>

                    <div className="border-t border-fn-line">
                      {group.questions.map((item) => (
                        <details
                          key={item.id}
                          id={item.id}
                          data-faq-item
                          data-faq-group={group.id}
                          data-faq-text={`${item.question} ${item.answer}`.toLowerCase()}
                          className="group scroll-mt-[100px] border-b border-fn-line"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-[16px] py-[18px] text-[15.5px] font-medium text-fn-ink transition-colors duration-150 hover:text-fn-orange-deep [&::-webkit-details-marker]:hidden">
                            {item.question}
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 12 12"
                              className="h-[11px] w-[11px] shrink-0 text-fn-muted transition-transform duration-150 ease-out group-open:rotate-90"
                            >
                              <path
                                d="M4 2.5 L8 6 L4 9.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </summary>
                          <p className="m-0 max-w-[720px] pb-[20px] text-[14.5px] leading-[1.6] text-fn-ink-3">
                            {item.answer}
                          </p>
                        </details>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </FaqFilter>
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}
