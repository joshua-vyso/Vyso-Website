import type { Metadata } from "next";

import { Button } from "@/components/vyso/Button";
import { Shell } from "@/components/vyso/Shell";
import { ALL_FAQ_QUESTIONS, FAQ_GROUPS } from "@/lib/marketing/faq";
import { SITE } from "@/lib/marketing/site";

import { FaqDeepLinkHandler, FaqFilter } from "./FaqInteractive";

/* ── /faq ─────────────────────────────────────────────────────────────────────
   Rebuilt for the 2026 redesign on the `--vy-*` system
   (`.ai/plan_vyso_redesign_2026.md` §7.6). `lib/marketing/faq.ts` carries the
   brief's full question set (`.ai/brief_redesign_2026_copy.md`'s FAQ list);
   this file is the shell around it. The accordion is still native `<details>`
   with the whole page working with JavaScript off — `FaqFilter` and
   `FaqDeepLinkHandler` are progressive-enhancement layers over the same
   static markup, unchanged from the previous design.

   The `pricing` group id is load-bearing: `/pricing-faq` 301s to
   `/faq#pricing` (`next.config.ts`), and `lib/marketing/faq.ts` keeps that id
   for exactly this reason. */

const TITLE = "FAQ: pricing, security and how Vyso works";
const DESCRIPTION =
  "Answers about what Vyso automates, pricing philosophy, security, POPIA, and how Vyso compares to Zapier, an ERP or hiring more admin help.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/faq` },
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

/* One `<script type="application/ld+json">`, same `@graph` shape the sitewide
   layout uses. The FAQPage entities are read straight off `ALL_FAQ_QUESTIONS`,
   so the schema can never say something the page itself doesn't render. */
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

export default function FaqPage() {
  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFaqSchema()).replace(/</g, "\\u003c"),
        }}
      />
      <FaqDeepLinkHandler />

      <FaqHero />

      <section className="px-[var(--vy-gutter)] pb-[96px] md:px-[40px] md:pb-[140px]">
        <div className="mx-auto w-full max-w-[var(--vy-content)]">
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
                        className="block rounded-[var(--vy-radius)] px-[10px] py-[7px] text-[13.5px] font-medium text-[color:var(--vy-ink-3)] transition-colors duration-150 hover:bg-[color:var(--vy-surface-2)] hover:text-[color:var(--vy-ink)]"
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
                    <p className="vy-label mb-[8px] text-[color:var(--vy-ink-3)]">
                      {group.eyebrow}
                    </p>
                    <h2 id={`${group.id}-heading`} className="vy-h2 mb-[8px] text-[color:var(--vy-ink)]">
                      {group.title}
                    </h2>
                    <p className="vy-body mb-[24px] max-w-[640px] text-[color:var(--vy-ink-3)]">
                      {group.description}
                    </p>

                    <div className="border-t border-[color:var(--vy-line)]">
                      {group.questions.map((item) => (
                        <details
                          key={item.id}
                          id={item.id}
                          data-faq-item
                          data-faq-group={group.id}
                          data-faq-text={`${item.question} ${item.answer}`.toLowerCase()}
                          className="group scroll-mt-[100px] border-b border-[color:var(--vy-line)]"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-[16px] py-[18px] text-[15.5px] font-medium text-[color:var(--vy-ink)] transition-colors duration-150 hover:text-[color:var(--vy-ink-2)] [&::-webkit-details-marker]:hidden">
                            {item.question}
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 12 12"
                              className="h-[11px] w-[11px] shrink-0 text-[color:var(--vy-ink-4)] transition-transform duration-150 ease-out group-open:rotate-90"
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
                          <p className="vy-body m-0 max-w-[720px] pb-[20px] text-[color:var(--vy-ink-3)]">
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
        </div>
      </section>

      <section
        data-vy-ground="dark"
        className="border-t border-[color:var(--vy-dark-line)] px-[var(--vy-gutter)] py-[80px] text-center md:px-[40px] md:py-[112px]"
      >
        <div className="mx-auto w-full max-w-[720px]">
          <h2 className="vy-h2 text-[color:var(--vy-ink)]">Still have a question?</h2>
          <p className="vy-body-lg mt-[16px] text-[color:var(--vy-ink-3)]">
            If it isn&rsquo;t answered here, ask us directly or start with a free Operations Audit.
          </p>
          <div className="mt-[32px] flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
            <Button
              href="/operations-audit"
              size="lg"
              event="book_audit_click"
              eventProps={{ page: "faq-close" }}
            >
              Get a free Operations Audit
            </Button>
            <Button href="/contact" variant="secondary" size="lg">
              Ask us directly
            </Button>
          </div>
        </div>
      </section>
    </Shell>
  );
}

/* The page's h1. A small hand-rolled hero rather than `Section`'s header,
   because this is the one page where the header needs a search field docked
   under it, which `Section` has no slot for. */
function FaqHero() {
  return (
    <header className="px-[var(--vy-gutter)] pt-[56px] pb-[40px] md:px-[40px] md:pt-[96px] md:pb-[56px]">
      <div className="mx-auto w-full max-w-[var(--vy-content)]">
        <p className="vy-label mb-[16px] text-[color:var(--vy-ink-3)]">FAQ</p>
        <h1 className="vy-h1 text-[color:var(--vy-ink)]">
          Straight answers, <span className="text-[color:var(--vy-ink-3)]">no sales copy.</span>
        </h1>
        <p className="vy-body-lg mt-[18px] max-w-[600px] text-[color:var(--vy-ink-3)]">
          What Vyso automates, how it&rsquo;s priced, how it compares to the alternatives, and how
          your data is handled. If it&rsquo;s not answered here, ask us directly.
        </p>
      </div>
    </header>
  );
}
